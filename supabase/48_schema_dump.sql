-- ============================================================================
-- SAEDU Flow — โครงสร้างฐานข้อมูลทั้งหมด (schema เปล่า ไม่มีข้อมูล)
--
-- ดึงจากฐานข้อมูลจริง (jrubupvzltxqstzcpoov) เมื่อ 2026-09-07 — Postgres 17.6
-- ครอบคลุม: extension, 20 ตาราง, PK/UNIQUE/CHECK/FK, index, view user_directory,
--           21 ฟังก์ชัน, RLS ทุก policy
--
-- ใช้คู่กับไฟล์ข้อมูลที่ได้จาก 49_export_sql_dump.mjs:
--   psql "$TARGET" -v ON_ERROR_STOP=1 -f 48_schema_dump.sql          # สร้างโครงสร้างก่อน
--   psql "$TARGET" -v ON_ERROR_STOP=1 -f saedu-data-<วันเวลา>.sql    # แล้วค่อยเทข้อมูลลง
--
-- ไฟล์นี้เป็น SQL ล้วน ไม่มีคำสั่ง \ ของ psql — วางใน Supabase SQL Editor
-- หรือส่งผ่าน execute_sql ได้ตรง ๆ (ON_ERROR_STOP ย้ายไปเป็น -v ที่บรรทัดคำสั่ง
-- เพราะ \set มีแต่ psql ที่เข้าใจ ตัวอื่นจะ error ที่ "\" ทันที)
--
-- ย้ายไป Postgres ธรรมดา (ไม่ใช่ Supabase) ได้ — ไฟล์นี้สร้าง shim ของ auth.uid()
-- ให้เองถ้าไม่มี schema auth อยู่ (คืนค่า null → RLS จะปิดทุกอย่างไว้ก่อน
-- ให้ผู้ย้ายไปต่อระบบ auth ของตัวเองแล้วแก้ auth.uid() ให้คืน user id จริง)
--
-- ⚠️ สิ่งที่ไฟล์นี้ "ไม่" มี — ต้องจัดการแยก:
--   - บัญชีล็อกอินใน auth.users (Supabase Auth) — ตาราง public.users เก็บแค่ auth_uid
--   - ไฟล์แนบใน Storage bucket documents / user-signatures (1.1 GB) — ใช้ --files ของ 45
--   - Edge Functions, pg_cron job, secret ต่าง ๆ
-- ============================================================================

-- ── extension ──────────────────────────────────────────────────────────────
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto   WITH SCHEMA extensions;
-- ที่เหลือเป็นของฝั่ง Supabase ล้วน ๆ ไม่จำเป็นต่อการกู้ข้อมูล:
--   pg_cron (ตั้ง job แจ้งเตือนเลยกำหนด), pg_net (เรียก Edge Function),
--   pg_stat_statements (สถิติ query), supabase_vault (เก็บ secret)
-- ให้ search_path เห็น extensions ด้วย (uuid_generate_v4 ติดตั้งอยู่ที่นั่น)
-- ไม่ตายถ้าไม่มีสิทธิ์ ALTER DATABASE — ค่า default ในตารางเรียกแบบเต็ม path อยู่แล้ว
DO $sp$
BEGIN
  EXECUTE format('ALTER DATABASE %I SET search_path TO public, extensions', current_database());
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'ข้าม ALTER DATABASE search_path (ไม่มีสิทธิ์) — ไม่กระทบการกู้ข้อมูล';
END
$sp$;

-- ── shim ของ auth.uid() สำหรับเซิร์ฟเวอร์ที่ไม่ใช่ Supabase ────────────────
-- บน Supabase บล็อกนี้ไม่ทำอะไรเลย (auth.uid() มีอยู่แล้ว)
DO $shim$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth') THEN
    CREATE SCHEMA auth;
    EXECUTE $fn$
      CREATE FUNCTION auth.uid() RETURNS uuid
      LANGUAGE sql STABLE AS $body$
        SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
      $body$;
    $fn$;
    RAISE NOTICE 'สร้าง shim auth.uid() แล้ว — ต่อระบบ auth ของคุณเองแล้วแก้ฟังก์ชันนี้';
  END IF;
END
$shim$;

-- ============================================================================
-- ตาราง (20)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.users (
  id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
  email text NOT NULL,
  full_name text NOT NULL,
  position_code text,
  role_code text DEFAULT 'ROLE-CRT'::text NOT NULL,
  department text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  student_id text,
  user_type text DEFAULT 'staff'::text,
  approval_status text DEFAULT 'pending'::text,
  password_hash text,
  approved_at timestamp with time zone,
  approved_by text,
  reject_reason text,
  contact_email text,
  auth_uid uuid,
  expires_at timestamp with time zone,
  line_user_id text,
  line_link_code text,
  line_link_code_expires_at timestamp with time zone,
  signature_path text,
  signature_updated_at timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public.documents (
  id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
  doc_number text,
  title text NOT NULL,
  doc_type text NOT NULL,
  urgency text DEFAULT 'normal'::text,
  description text,
  status text DEFAULT 'draft'::text NOT NULL,
  created_by uuid,
  due_date date,
  doc_date date DEFAULT CURRENT_DATE,
  current_step integer DEFAULT 1,
  total_steps integer DEFAULT 3,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  from_department text,
  subject_line text,
  deadline_datetime timestamp with time zone,
  addressed_to text,
  final_recipient_id uuid,
  final_recipient_note text,
  forwarded_to_id uuid,
  forwarded_at timestamp with time zone,
  notify_step boolean DEFAULT true NOT NULL,
  notify_overdue boolean DEFAULT true NOT NULL,
  forwarded_to_staff boolean DEFAULT false NOT NULL,
  project_name text,
  accepted_by uuid,
  accepted_at timestamp with time zone,
  received_number text,
  received_date date
);

CREATE TABLE IF NOT EXISTS public.workflow_steps (
  id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
  document_id uuid,
  step_number integer NOT NULL,
  step_name text NOT NULL,
  role_required text NOT NULL,
  assigned_to uuid,
  status text DEFAULT 'pending'::text,
  action_taken text,
  note text,
  action_at timestamp with time zone,
  deadline_days integer DEFAULT 2,
  created_at timestamp with time zone DEFAULT now(),
  started_at timestamp with time zone,
  deadline_datetime timestamp with time zone,
  completed_at timestamp with time zone,
  revision_section text,
  rejected_by uuid
);

CREATE TABLE IF NOT EXISTS public.document_files (
  id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
  document_id uuid,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size bigint,
  file_type text,
  version integer DEFAULT 1,
  uploaded_by uuid,
  uploaded_at timestamp with time zone DEFAULT now(),
  archive_url text,
  archive_ref text,
  archived_at timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public.document_history (
  id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
  document_id uuid,
  action text NOT NULL,
  performed_by uuid,
  note text,
  performed_at timestamp with time zone DEFAULT now(),
  performer_name text,
  performer_email text
);

CREATE TABLE IF NOT EXISTS public.document_acks (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  document_id uuid NOT NULL,
  user_id uuid NOT NULL,
  status text DEFAULT 'pending'::text NOT NULL,
  acked_at timestamp with time zone,
  note text,
  signed boolean DEFAULT false NOT NULL,
  requested_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
  document_id uuid,
  recipient_id uuid,
  recipient_email text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  sent_at timestamp with time zone DEFAULT now(),
  status text DEFAULT 'pending'::text,
  notification_type text DEFAULT 'email'::text,
  processed_at timestamp with time zone,
  error_message text
);

CREATE TABLE IF NOT EXISTS public.notification_rate_limits (
  caller_id uuid NOT NULL,
  kind text NOT NULL,
  window_start timestamp with time zone NOT NULL,
  count integer DEFAULT 0 NOT NULL
);

CREATE TABLE IF NOT EXISTS public.form_templates (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  category text DEFAULT 'general'::text NOT NULL,
  description text,
  file_path text NOT NULL,
  file_name text NOT NULL,
  file_size bigint DEFAULT 0,
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  uploaded_by uuid,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.calendar_events (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  date date NOT NULL,
  title text NOT NULL,
  color text DEFAULT '#3B82F6'::text,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  is_private boolean DEFAULT false NOT NULL
);

CREATE TABLE IF NOT EXISTS public.projects (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid
);

CREATE TABLE IF NOT EXISTS public.announcements (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  title text NOT NULL,
  body text,
  level text DEFAULT 'info'::text NOT NULL,
  pinned boolean DEFAULT false NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public.system_logs (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  at timestamp with time zone DEFAULT now() NOT NULL,
  level text DEFAULT 'error'::text NOT NULL,
  source text,
  message text,
  detail text,
  user_id uuid
);

CREATE TABLE IF NOT EXISTS public.app_settings (
  key text NOT NULL,
  value text,
  label text,
  value_type text DEFAULT 'text'::text NOT NULL,
  updated_by uuid,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.email_templates (
  key text NOT NULL,
  label text,
  subject_suffix text,
  extra_note text,
  updated_by uuid,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.workflow_templates (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  doc_type text NOT NULL,
  name text NOT NULL,
  is_default boolean DEFAULT false NOT NULL,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.workflow_template_steps (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  template_id uuid NOT NULL,
  step_number integer NOT NULL,
  step_name text NOT NULL,
  role_required text DEFAULT ''::text,
  assigned_to uuid,
  deadline_days integer DEFAULT 2 NOT NULL,
  locked boolean DEFAULT false NOT NULL
);

CREATE TABLE IF NOT EXISTS public.doc_types (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  code text NOT NULL,
  label text NOT NULL,
  icon text DEFAULT 'doc'::text NOT NULL,
  show_from boolean DEFAULT false NOT NULL,
  from_label text DEFAULT ''::text NOT NULL,
  show_to boolean DEFAULT false NOT NULL,
  to_label text DEFAULT ''::text NOT NULL,
  show_ref boolean DEFAULT false NOT NULL,
  ref_label text DEFAULT ''::text NOT NULL,
  show_doc_date boolean DEFAULT false NOT NULL,
  doc_date_label text DEFAULT ''::text NOT NULL,
  event_label text DEFAULT 'วันกำหนดส่ง'::text NOT NULL,
  event_required boolean DEFAULT false NOT NULL,
  sort_order integer DEFAULT 0 NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  min_days integer DEFAULT 0 NOT NULL,
  enable_deadline boolean DEFAULT true NOT NULL
);

CREATE TABLE IF NOT EXISTS public.doc_type_fields (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  doc_type_id uuid NOT NULL,
  db_column text NOT NULL,
  label text NOT NULL,
  placeholder text DEFAULT ''::text NOT NULL,
  required boolean DEFAULT false NOT NULL,
  field_type text DEFAULT 'text'::text NOT NULL,
  sort_order integer DEFAULT 0 NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.doc_number_settings (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  year integer NOT NULL,
  prefix text NOT NULL,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  seq_reset_at timestamp with time zone,
  out_prefix text
);

-- ============================================================================
-- PRIMARY KEY / UNIQUE / CHECK
-- (DROP IF EXISTS ก่อนทุกอัน เพื่อให้รันซ้ำได้โดยไม่ error)
-- ============================================================================

ALTER TABLE public.users                   DROP CONSTRAINT IF EXISTS users_pkey CASCADE;
ALTER TABLE public.users                   ADD  CONSTRAINT users_pkey PRIMARY KEY (id);
ALTER TABLE public.documents               DROP CONSTRAINT IF EXISTS documents_pkey CASCADE;
ALTER TABLE public.documents               ADD  CONSTRAINT documents_pkey PRIMARY KEY (id);
ALTER TABLE public.workflow_steps          DROP CONSTRAINT IF EXISTS workflow_steps_pkey CASCADE;
ALTER TABLE public.workflow_steps          ADD  CONSTRAINT workflow_steps_pkey PRIMARY KEY (id);
ALTER TABLE public.document_files          DROP CONSTRAINT IF EXISTS document_files_pkey CASCADE;
ALTER TABLE public.document_files          ADD  CONSTRAINT document_files_pkey PRIMARY KEY (id);
ALTER TABLE public.document_history        DROP CONSTRAINT IF EXISTS document_history_pkey CASCADE;
ALTER TABLE public.document_history        ADD  CONSTRAINT document_history_pkey PRIMARY KEY (id);
ALTER TABLE public.document_acks           DROP CONSTRAINT IF EXISTS document_acks_pkey CASCADE;
ALTER TABLE public.document_acks           ADD  CONSTRAINT document_acks_pkey PRIMARY KEY (id);
ALTER TABLE public.notifications           DROP CONSTRAINT IF EXISTS notifications_pkey CASCADE;
ALTER TABLE public.notifications           ADD  CONSTRAINT notifications_pkey PRIMARY KEY (id);
ALTER TABLE public.notification_rate_limits DROP CONSTRAINT IF EXISTS notification_rate_limits_pkey CASCADE;
ALTER TABLE public.notification_rate_limits ADD  CONSTRAINT notification_rate_limits_pkey PRIMARY KEY (caller_id, kind, window_start);
ALTER TABLE public.form_templates          DROP CONSTRAINT IF EXISTS form_templates_pkey CASCADE;
ALTER TABLE public.form_templates          ADD  CONSTRAINT form_templates_pkey PRIMARY KEY (id);
ALTER TABLE public.calendar_events         DROP CONSTRAINT IF EXISTS calendar_events_pkey CASCADE;
ALTER TABLE public.calendar_events         ADD  CONSTRAINT calendar_events_pkey PRIMARY KEY (id);
ALTER TABLE public.projects                DROP CONSTRAINT IF EXISTS projects_pkey CASCADE;
ALTER TABLE public.projects                ADD  CONSTRAINT projects_pkey PRIMARY KEY (id);
ALTER TABLE public.announcements           DROP CONSTRAINT IF EXISTS announcements_pkey CASCADE;
ALTER TABLE public.announcements           ADD  CONSTRAINT announcements_pkey PRIMARY KEY (id);
ALTER TABLE public.system_logs             DROP CONSTRAINT IF EXISTS system_logs_pkey CASCADE;
ALTER TABLE public.system_logs             ADD  CONSTRAINT system_logs_pkey PRIMARY KEY (id);
ALTER TABLE public.app_settings            DROP CONSTRAINT IF EXISTS app_settings_pkey CASCADE;
ALTER TABLE public.app_settings            ADD  CONSTRAINT app_settings_pkey PRIMARY KEY (key);
ALTER TABLE public.email_templates         DROP CONSTRAINT IF EXISTS email_templates_pkey CASCADE;
ALTER TABLE public.email_templates         ADD  CONSTRAINT email_templates_pkey PRIMARY KEY (key);
ALTER TABLE public.workflow_templates      DROP CONSTRAINT IF EXISTS workflow_templates_pkey CASCADE;
ALTER TABLE public.workflow_templates      ADD  CONSTRAINT workflow_templates_pkey PRIMARY KEY (id);
ALTER TABLE public.workflow_template_steps DROP CONSTRAINT IF EXISTS workflow_template_steps_pkey CASCADE;
ALTER TABLE public.workflow_template_steps ADD  CONSTRAINT workflow_template_steps_pkey PRIMARY KEY (id);
ALTER TABLE public.doc_types               DROP CONSTRAINT IF EXISTS doc_types_pkey CASCADE;
ALTER TABLE public.doc_types               ADD  CONSTRAINT doc_types_pkey PRIMARY KEY (id);
ALTER TABLE public.doc_type_fields         DROP CONSTRAINT IF EXISTS doc_type_fields_pkey CASCADE;
ALTER TABLE public.doc_type_fields         ADD  CONSTRAINT doc_type_fields_pkey PRIMARY KEY (id);
ALTER TABLE public.doc_number_settings     DROP CONSTRAINT IF EXISTS doc_number_settings_pkey CASCADE;
ALTER TABLE public.doc_number_settings     ADD  CONSTRAINT doc_number_settings_pkey PRIMARY KEY (id);

ALTER TABLE public.users               DROP CONSTRAINT IF EXISTS users_email_key;
ALTER TABLE public.users               ADD  CONSTRAINT users_email_key UNIQUE (email);
ALTER TABLE public.users               DROP CONSTRAINT IF EXISTS users_auth_uid_key;
ALTER TABLE public.users               ADD  CONSTRAINT users_auth_uid_key UNIQUE (auth_uid);
ALTER TABLE public.documents           DROP CONSTRAINT IF EXISTS documents_doc_number_key;
ALTER TABLE public.documents           ADD  CONSTRAINT documents_doc_number_key UNIQUE (doc_number);
ALTER TABLE public.document_acks       DROP CONSTRAINT IF EXISTS document_acks_document_id_user_id_key;
ALTER TABLE public.document_acks       ADD  CONSTRAINT document_acks_document_id_user_id_key UNIQUE (document_id, user_id);
ALTER TABLE public.doc_types           DROP CONSTRAINT IF EXISTS doc_types_code_key;
ALTER TABLE public.doc_types           ADD  CONSTRAINT doc_types_code_key UNIQUE (code);
ALTER TABLE public.doc_type_fields     DROP CONSTRAINT IF EXISTS doc_type_fields_doc_type_id_db_column_key;
ALTER TABLE public.doc_type_fields     ADD  CONSTRAINT doc_type_fields_doc_type_id_db_column_key UNIQUE (doc_type_id, db_column);
ALTER TABLE public.doc_number_settings DROP CONSTRAINT IF EXISTS doc_number_settings_year_key;
ALTER TABLE public.doc_number_settings ADD  CONSTRAINT doc_number_settings_year_key UNIQUE (year);

ALTER TABLE public.app_settings       DROP CONSTRAINT IF EXISTS app_settings_value_type_check;
ALTER TABLE public.app_settings       ADD  CONSTRAINT app_settings_value_type_check CHECK ((value_type = ANY (ARRAY['text'::text, 'number'::text, 'boolean'::text, 'json'::text])));
-- หมายเหตุ: CHECK นี้ยังอนุญาต certificate/memo ซึ่งเลิกใช้ไปแล้ว (DTYPES เหลือ 2 ชนิด)
-- คงไว้ตามของจริงบน production ไม่แก้ในไฟล์สำรอง
ALTER TABLE public.workflow_templates DROP CONSTRAINT IF EXISTS workflow_templates_doc_type_check;
ALTER TABLE public.workflow_templates ADD  CONSTRAINT workflow_templates_doc_type_check CHECK ((doc_type = ANY (ARRAY['incoming'::text, 'outgoing'::text, 'certificate'::text, 'memo'::text])));

-- ============================================================================
-- FOREIGN KEY
-- ============================================================================

ALTER TABLE public.documents            DROP CONSTRAINT IF EXISTS documents_created_by_fkey;
ALTER TABLE public.documents            ADD  CONSTRAINT documents_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);
ALTER TABLE public.documents            DROP CONSTRAINT IF EXISTS documents_final_recipient_id_fkey;
ALTER TABLE public.documents            ADD  CONSTRAINT documents_final_recipient_id_fkey FOREIGN KEY (final_recipient_id) REFERENCES public.users(id);
ALTER TABLE public.documents            DROP CONSTRAINT IF EXISTS documents_forwarded_to_id_fkey;
ALTER TABLE public.documents            ADD  CONSTRAINT documents_forwarded_to_id_fkey FOREIGN KEY (forwarded_to_id) REFERENCES public.users(id);
ALTER TABLE public.documents            DROP CONSTRAINT IF EXISTS documents_accepted_by_fkey;
ALTER TABLE public.documents            ADD  CONSTRAINT documents_accepted_by_fkey FOREIGN KEY (accepted_by) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.workflow_steps       DROP CONSTRAINT IF EXISTS workflow_steps_document_id_fkey;
ALTER TABLE public.workflow_steps       ADD  CONSTRAINT workflow_steps_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE;
ALTER TABLE public.workflow_steps       DROP CONSTRAINT IF EXISTS workflow_steps_assigned_to_fkey;
ALTER TABLE public.workflow_steps       ADD  CONSTRAINT workflow_steps_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id);
ALTER TABLE public.workflow_steps       DROP CONSTRAINT IF EXISTS workflow_steps_rejected_by_fkey;
ALTER TABLE public.workflow_steps       ADD  CONSTRAINT workflow_steps_rejected_by_fkey FOREIGN KEY (rejected_by) REFERENCES public.users(id);
ALTER TABLE public.document_files       DROP CONSTRAINT IF EXISTS document_files_document_id_fkey;
ALTER TABLE public.document_files       ADD  CONSTRAINT document_files_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE;
ALTER TABLE public.document_files       DROP CONSTRAINT IF EXISTS document_files_uploaded_by_fkey;
ALTER TABLE public.document_files       ADD  CONSTRAINT document_files_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id);
ALTER TABLE public.document_history     DROP CONSTRAINT IF EXISTS document_history_document_id_fkey;
ALTER TABLE public.document_history     ADD  CONSTRAINT document_history_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE;
ALTER TABLE public.document_history     DROP CONSTRAINT IF EXISTS document_history_performed_by_fkey;
ALTER TABLE public.document_history     ADD  CONSTRAINT document_history_performed_by_fkey FOREIGN KEY (performed_by) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.document_acks        DROP CONSTRAINT IF EXISTS document_acks_document_id_fkey;
ALTER TABLE public.document_acks        ADD  CONSTRAINT document_acks_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE;
ALTER TABLE public.document_acks        DROP CONSTRAINT IF EXISTS document_acks_user_id_fkey;
ALTER TABLE public.document_acks        ADD  CONSTRAINT document_acks_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.document_acks        DROP CONSTRAINT IF EXISTS document_acks_requested_by_fkey;
ALTER TABLE public.document_acks        ADD  CONSTRAINT document_acks_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.notifications        DROP CONSTRAINT IF EXISTS notifications_document_id_fkey;
ALTER TABLE public.notifications        ADD  CONSTRAINT notifications_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE;
ALTER TABLE public.notifications        DROP CONSTRAINT IF EXISTS notifications_recipient_id_fkey;
ALTER TABLE public.notifications        ADD  CONSTRAINT notifications_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.calendar_events      DROP CONSTRAINT IF EXISTS calendar_events_created_by_fkey;
ALTER TABLE public.calendar_events      ADD  CONSTRAINT calendar_events_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.projects             DROP CONSTRAINT IF EXISTS projects_created_by_fkey;
ALTER TABLE public.projects             ADD  CONSTRAINT projects_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);
ALTER TABLE public.announcements        DROP CONSTRAINT IF EXISTS announcements_created_by_fkey;
ALTER TABLE public.announcements        ADD  CONSTRAINT announcements_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.system_logs          DROP CONSTRAINT IF EXISTS system_logs_user_id_fkey;
ALTER TABLE public.system_logs          ADD  CONSTRAINT system_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.app_settings         DROP CONSTRAINT IF EXISTS app_settings_updated_by_fkey;
ALTER TABLE public.app_settings         ADD  CONSTRAINT app_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);
ALTER TABLE public.email_templates      DROP CONSTRAINT IF EXISTS email_templates_updated_by_fkey;
ALTER TABLE public.email_templates      ADD  CONSTRAINT email_templates_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);
ALTER TABLE public.workflow_templates   DROP CONSTRAINT IF EXISTS workflow_templates_created_by_fkey;
ALTER TABLE public.workflow_templates   ADD  CONSTRAINT workflow_templates_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);
ALTER TABLE public.workflow_template_steps DROP CONSTRAINT IF EXISTS workflow_template_steps_template_id_fkey;
ALTER TABLE public.workflow_template_steps ADD  CONSTRAINT workflow_template_steps_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.workflow_templates(id) ON DELETE CASCADE;
ALTER TABLE public.workflow_template_steps DROP CONSTRAINT IF EXISTS workflow_template_steps_assigned_to_fkey;
ALTER TABLE public.workflow_template_steps ADD  CONSTRAINT workflow_template_steps_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id);
-- หมายเหตุ: form_templates.uploaded_by และ doc_number_settings.created_by ไม่มี FK บน production
-- (ตั้งใจหรือหลงลืมก็ตาม) — ไฟล์สำรองคัดลอกตามของจริง ไม่เติมให้เอง
ALTER TABLE public.doc_type_fields      DROP CONSTRAINT IF EXISTS doc_type_fields_doc_type_id_fkey;
ALTER TABLE public.doc_type_fields      ADD  CONSTRAINT doc_type_fields_doc_type_id_fkey FOREIGN KEY (doc_type_id) REFERENCES public.doc_types(id) ON DELETE CASCADE;

-- users.auth_uid → auth.users(id) มีเฉพาะบน Supabase — ข้ามถ้าไม่มีตารางนั้น
DO $authfk$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
             WHERE n.nspname = 'auth' AND c.relname = 'users') THEN
    ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_auth_uid_fkey;
    ALTER TABLE public.users ADD  CONSTRAINT users_auth_uid_fkey
      FOREIGN KEY (auth_uid) REFERENCES auth.users(id) ON DELETE SET NULL;
  ELSE
    RAISE NOTICE 'ข้าม FK users.auth_uid → auth.users (ไม่มีตาราง auth.users บนเซิร์ฟเวอร์นี้)';
  END IF;
END
$authfk$;

-- ============================================================================
-- INDEX (ที่ไม่ได้มาจาก constraint)
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx ON public.users USING btree (lower(email));
CREATE UNIQUE INDEX IF NOT EXISTS users_student_id_idx ON public.users USING btree (student_id) WHERE (student_id IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS users_line_user_id_unique ON public.users USING btree (line_user_id) WHERE (line_user_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS users_line_link_code_idx ON public.users USING btree (line_link_code) WHERE (line_link_code IS NOT NULL);

-- documents_doc_number_unique คือด่านกันเลขหนังสือซ้ำตอนออกเลขพร้อมกัน (ดู 11_add_doc_number_unique_index.sql)
CREATE UNIQUE INDEX IF NOT EXISTS documents_doc_number_unique ON public.documents USING btree (doc_number) WHERE (doc_number IS NOT NULL);
CREATE INDEX IF NOT EXISTS documents_created_at_idx ON public.documents USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS documents_created_by_idx ON public.documents USING btree (created_by);
CREATE INDEX IF NOT EXISTS documents_doc_number_pattern_idx ON public.documents USING btree (doc_number text_pattern_ops);
CREATE INDEX IF NOT EXISTS documents_final_recipient_id_idx ON public.documents USING btree (final_recipient_id);
CREATE INDEX IF NOT EXISTS documents_forwarded_to_id_idx ON public.documents USING btree (forwarded_to_id);
CREATE INDEX IF NOT EXISTS documents_accepted_by_idx ON public.documents USING btree (accepted_by) WHERE (accepted_by IS NOT NULL);
CREATE INDEX IF NOT EXISTS documents_fwd_staff_pending_idx ON public.documents USING btree (status, forwarded_at DESC) WHERE (forwarded_to_staff = true);
CREATE INDEX IF NOT EXISTS documents_overdue_scan_idx ON public.documents USING btree (due_date) WHERE ((notify_overdue = true) AND (status = ANY (ARRAY['pending'::text, 'completed'::text])));
CREATE INDEX IF NOT EXISTS documents_received_number_idx ON public.documents USING btree (received_number) WHERE (received_number IS NOT NULL);

CREATE INDEX IF NOT EXISTS workflow_steps_document_step_idx ON public.workflow_steps USING btree (document_id, step_number);
CREATE INDEX IF NOT EXISTS workflow_steps_assigned_to_idx ON public.workflow_steps USING btree (assigned_to);
CREATE INDEX IF NOT EXISTS workflow_steps_active_assignee_idx ON public.workflow_steps USING btree (assigned_to) WHERE (status = 'active'::text);
CREATE INDEX IF NOT EXISTS idx_workflow_steps_rejected_by ON public.workflow_steps USING btree (rejected_by);

CREATE INDEX IF NOT EXISTS document_files_document_version_idx ON public.document_files USING btree (document_id, version DESC);
CREATE INDEX IF NOT EXISTS idx_document_files_archived ON public.document_files USING btree (document_id) WHERE (archive_url IS NOT NULL);
CREATE INDEX IF NOT EXISTS document_history_document_performed_idx ON public.document_history USING btree (document_id, performed_at DESC);
CREATE INDEX IF NOT EXISTS document_acks_doc_idx ON public.document_acks USING btree (document_id);
CREATE INDEX IF NOT EXISTS document_acks_user_idx ON public.document_acks USING btree (user_id, status);

CREATE INDEX IF NOT EXISTS idx_notifications_document ON public.notifications USING btree (document_id);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON public.notifications USING btree (recipient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_sent_at ON public.notifications USING btree (sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON public.notifications USING btree (status) WHERE (status = 'pending'::text);

CREATE INDEX IF NOT EXISTS idx_announcements_home ON public.announcements USING btree (is_active, pinned DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_logs_at ON public.system_logs USING btree (at DESC);
CREATE INDEX IF NOT EXISTS idx_doc_types_sort ON public.doc_types USING btree (sort_order, created_at);
CREATE INDEX IF NOT EXISTS idx_doc_type_fields_type ON public.doc_type_fields USING btree (doc_type_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_doc_number_settings_year ON public.doc_number_settings USING btree (year);

-- ============================================================================
-- VIEW
-- user_directory คือทางเดียวที่ผู้ใช้คนหนึ่งจะเห็นชื่อ/ตำแหน่งของคนอื่นได้
-- (RLS ของตาราง users เปิดให้เห็นแค่แถวตัวเอง) — เผยเฉพาะคอลัมน์ที่ปลอดภัย
-- ไม่มี password_hash / line_user_id / signature_path
-- ============================================================================

CREATE OR REPLACE VIEW public.user_directory AS
  SELECT id, full_name, email, contact_email, role_code,
         position_code, department, is_active, approval_status
  FROM public.users;

-- ============================================================================
-- ฟังก์ชัน (21) — เรียงตามลำดับที่ต้องพึ่งพากัน
-- ============================================================================

CREATE OR REPLACE FUNCTION public.add_working_days(p_from timestamp with time zone, p_days integer)
 RETURNS timestamp with time zone
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
DECLARE
  d timestamptz := p_from;
  i int := 0;
BEGIN
  WHILE i < p_days LOOP
    d := d + interval '1 day';
    IF extract(isodow FROM d) < 6 THEN i := i + 1; END IF;
  END LOOP;
  RETURN d;
END;
$function$;

CREATE OR REPLACE FUNCTION public.current_profile()
 RETURNS public.users
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  select * from public.users where auth_uid = auth.uid() limit 1;
$function$;

CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  select exists (
    select 1 from public.users
    where auth_uid = auth.uid() and role_code in ('ROLE-SYS','ROLE-STF')
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_dev()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  select exists (
    select 1 from public.users
    where auth_uid = auth.uid() and role_code = 'ROLE-DEV'
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_template_manager()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  select public.is_admin() or exists (
    select 1 from public.users
    where auth_uid = auth.uid() and position_code = 'GNK-SEC'
  );
$function$;

-- ⚠️ incoming/outgoing สลับความหมายกันเมื่อ 2026-07-22 (ดู 34_swap_doc_type_meaning.sql)
-- 'outgoing' = หนังสือที่มี workflow อนุมัติ และต้องออกเลข
CREATE OR REPLACE FUNCTION public.doc_needs_numbering(p_doc_type text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT p_doc_type = 'outgoing';
$function$;

CREATE OR REPLACE FUNCTION public.step_deadline_ts(p_days integer)
 RETURNS timestamp with time zone
 LANGUAGE plpgsql
 STABLE
AS $function$
DECLARE d timestamptz;
BEGIN
  d := public.add_working_days(now(), coalesce(p_days, 2));
  RETURN date_trunc('day', d AT TIME ZONE 'Asia/Bangkok') AT TIME ZONE 'Asia/Bangkok' + interval '23 hours 59 minutes';
END;
$function$;

CREATE OR REPLACE FUNCTION public.resolve_login_email(identifier text)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  select coalesce(
    (select email from public.users where student_id = identifier limit 1),
    identifier
  );
$function$;

CREATE OR REPLACE FUNCTION public.overdue_notif_exists(p_doc uuid)
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS(
    SELECT 1 FROM public.notifications
    WHERE document_id = p_doc
      AND notification_type = 'overdue'
  );
$function$;

CREATE OR REPLACE FUNCTION public.overdue_notif_sent_at(p_doc uuid)
 RETURNS timestamp with time zone
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT min(sent_at) FROM public.notifications
  WHERE document_id = p_doc AND notification_type = 'overdue';
$function$;

CREATE OR REPLACE FUNCTION public.can_log_notification(p_doc uuid, p_sender uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    public.is_admin()
    OR public.is_dev()
    OR exists (
      select 1 from public.users u
      where u.id = p_sender and u.role_code in ('ROLE-SYS', 'ROLE-STF')
    )
    OR exists (
      select 1 from public.document_acks a
      where a.document_id = p_doc and a.user_id = p_sender
    )
    OR exists (
      select 1 from public.documents d
      where d.id = p_doc
        and (
          d.created_by = p_sender
          or d.forwarded_to_id = p_sender
          or exists (
            select 1 from public.workflow_steps ws
            where ws.document_id = p_doc
              and (ws.assigned_to = p_sender or ws.rejected_by = p_sender)
          )
        )
    );
$function$;

CREATE OR REPLACE FUNCTION public.check_and_bump_notify_rate(p_caller uuid, p_kind text, p_limit integer, p_window_minutes integer DEFAULT 60)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_window timestamptz;
  v_count integer;
begin
  v_window := date_trunc('hour', now());

  insert into public.notification_rate_limits (caller_id, kind, window_start, count)
  values (p_caller, p_kind, v_window, 1)
  on conflict (caller_id, kind, window_start)
  do update set count = public.notification_rate_limits.count + 1
  returning count into v_count;

  return v_count <= p_limit;
end;
$function$;

-- trigger function ของ Supabase Auth — trigger ตัวจริงอยู่บน auth.users
-- (on_auth_user_created) ซึ่งไฟล์นี้สร้างให้ไม่ได้ ดู 01_migration_auth_rls.sql
CREATE OR REPLACE FUNCTION public.link_auth_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
begin
  insert into public.users (
    auth_uid, email, full_name, student_id, position_code, role_code,
    department, contact_email, user_type, approval_status, is_active
  )
  values (
    new.id,
    lower(new.email),
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.raw_user_meta_data->>'student_id',
    new.raw_user_meta_data->>'position_code',
    coalesce(new.raw_user_meta_data->>'role_code', 'ROLE-CRT'),
    new.raw_user_meta_data->>'department',
    coalesce(new.raw_user_meta_data->>'contact_email', lower(new.email)),
    coalesce(new.raw_user_meta_data->>'user_type', 'gnk'),
    'pending',
    false
  )
  on conflict (email) do update set auth_uid = new.id
  where lower(public.users.email) = lower(new.email);
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.log_notification(p_document_id uuid, p_recipient_id uuid, p_recipient_email text, p_subject text, p_body text, p_notification_type text, p_status text, p_sent_at timestamp with time zone DEFAULT now())
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid;
  v_id uuid;
BEGIN
  SELECT id INTO v_uid FROM public.current_profile();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  IF p_document_id IS NOT NULL
     AND NOT public.can_log_notification(p_document_id, v_uid) THEN
    RAISE EXCEPTION 'not allowed to log notification for this document';
  END IF;

  INSERT INTO public.notifications (
    document_id, recipient_id, recipient_email,
    subject, body, notification_type, status, sent_at
  ) VALUES (
    p_document_id, p_recipient_id, p_recipient_email,
    p_subject, p_body, p_notification_type, p_status, coalesce(p_sent_at, now())
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.list_signed_duplicate_files()
 RETURNS TABLE(id uuid, document_id uuid, file_name text, file_path text, version integer, uploaded_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH signed AS (
    SELECT df.*
    FROM public.document_files df
    WHERE df.file_path LIKE 'signed/%'
      AND (
        df.file_name ~ '\[ลงนาม\].*v[2-9]'
        OR df.file_path ~ '/v[2-9]\.'
        OR df.file_name ~ ' v[2-9]\.'
      )
  ),
  canonical AS (
    SELECT DISTINCT document_id
    FROM public.document_files
    WHERE file_path LIKE 'signed/%'
      AND file_name NOT LIKE '%v2%'
      AND file_name NOT LIKE '%v3%'
      AND file_name NOT LIKE '%v4%'
      AND file_name NOT LIKE '%v5%'
      AND file_name NOT LIKE '%v6%'
      AND file_name NOT LIKE '%v7%'
      AND file_name NOT LIKE '%v8%'
      AND file_name NOT LIKE '%v9%'
  )
  SELECT s.id, s.document_id, s.file_name, s.file_path, s.version, s.uploaded_at
  FROM signed s
  WHERE EXISTS (SELECT 1 FROM canonical c WHERE c.document_id = s.document_id)
  ORDER BY s.document_id, s.uploaded_at DESC;
$function$;

CREATE OR REPLACE FUNCTION public.purge_signed_duplicate_rows()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid;
  v_cnt int;
BEGIN
  SELECT cp.id INTO v_uid FROM public.current_profile() cp;
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT public.is_dev() AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'dev or admin only';
  END IF;

  WITH doomed AS (
    SELECT * FROM public.list_signed_duplicate_files()
  ),
  del AS (
    DELETE FROM public.document_files df
    USING doomed d
    WHERE df.id = d.id
    RETURNING df.id
  )
  SELECT count(*)::int INTO v_cnt FROM del;

  RETURN v_cnt;
END;
$function$;

CREATE OR REPLACE FUNCTION public.forward_accept(p_doc uuid, p_note text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid;
  v_role text;
  v_doc public.documents%rowtype;
  v_priv boolean;
begin
  select id into v_uid from public.current_profile();
  if v_uid is null then raise exception 'not authenticated'; end if;
  select role_code into v_role from public.users where id = v_uid;
  v_priv := public.is_admin() or public.is_dev();

  select * into v_doc from public.documents where id = p_doc for update;
  if not found then raise exception 'document not found'; end if;

  -- ผู้จัดทำกดรับเอกสารของตัวเองไม่ได้ — ต้องผ่านมือ จนท.จริงเท่านั้น
  -- (admin/dev ยกเว้นไว้ เผื่อใช้ซ่อมเอกสารที่ค้าง)
  if v_doc.created_by = v_uid and not v_priv then
    raise exception 'creator cannot accept own document';
  end if;

  -- เฉพาะ จนท.กิจการนิสิต / อาจารย์ที่ปรึกษา (ผู้รับที่ส่งต่อถึงได้) เท่านั้น
  if not v_priv and coalesce(v_role, '') not in ('ROLE-STF', 'ROLE-ADV') then
    raise exception 'only staff can accept documents';
  end if;

  if v_doc.forwarded_to_staff then
    if coalesce(v_role, '') is distinct from 'ROLE-STF' and not v_priv then
      raise exception 'not a staff inbox recipient';
    end if;
  elsif v_doc.forwarded_to_id is distinct from v_uid and not v_priv then
    raise exception 'not forwarded to you';
  end if;

  update public.documents set
    status = 'awaiting_submit',
    accepted_by = v_uid,
    accepted_at = now(),
    forwarded_to_id = null,
    forwarded_to_staff = false,
    forwarded_at = null,
    updated_at = now()
  where id = p_doc;

  -- ⚠️ ข้อความ 'เจ้าหน้าที่รับเอกสาร' เป็นตัวระบุ ไม่ใช่ข้อความแสดงผล
  -- docDetail.js / docList.js / sendOverdueNotifs() filter ด้วยสตริงนี้เป๊ะ ๆ
  insert into public.document_history (document_id, action, performed_by, note)
  values (
    p_doc,
    'เจ้าหน้าที่รับเอกสาร',
    v_uid,
    coalesce(p_note, 'รับเอกสารแล้ว — รอเจ้าหน้าที่ยื่นในระบบมหาวิทยาลัย')
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.forward_decline(p_doc uuid, p_note text DEFAULT ''::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid;
  v_role text;
  v_doc public.documents%rowtype;
  v_first_rev uuid;
  v_step public.workflow_steps%rowtype;
begin
  select id into v_uid from public.current_profile();
  if v_uid is null then raise exception 'not authenticated'; end if;
  select role_code into v_role from public.users where id = v_uid;

  if coalesce(trim(p_note), '') = '' then
    raise exception 'note required';
  end if;

  select * into v_doc from public.documents where id = p_doc for update;
  if not found then raise exception 'document not found'; end if;

  if v_doc.status <> 'completed' then
    raise exception 'document not completed';
  end if;

  if v_doc.forwarded_to_staff then
    if v_role is distinct from 'ROLE-STF'
       and not public.is_admin()
       and not public.is_dev() then
      raise exception 'not a staff inbox recipient';
    end if;
  else
    if v_doc.forwarded_to_id is null then
      raise exception 'document not forwarded';
    end if;
    if v_doc.forwarded_to_id is distinct from v_uid
       and not public.is_admin()
       and not public.is_dev() then
      raise exception 'not forwarded to you';
    end if;
  end if;

  -- นับเฉพาะการรับที่เกิดหลังการส่งต่อรอบล่าสุด
  if exists (
    select 1 from public.document_history h
    where h.document_id = p_doc
      and h.action = 'เจ้าหน้าที่รับเอกสาร'
      and (v_doc.forwarded_at is null or h.performed_at >= v_doc.forwarded_at)
  ) then
    raise exception 'already accepted';
  end if;

  select ws.id into v_first_rev
  from public.workflow_steps ws
  where ws.document_id = p_doc and ws.step_number > 1
  order by ws.step_number
  limit 1;

  if v_first_rev is null then
    select ws.id into v_first_rev
    from public.workflow_steps ws
    where ws.document_id = p_doc
    order by ws.step_number
    limit 1;
  end if;

  for v_step in
    select * from public.workflow_steps
    where document_id = p_doc
    order by step_number
    for update
  loop
    if v_step.id = v_first_rev then
      update public.workflow_steps set
        status = 'rejected',
        action_taken = null, note = null, revision_section = null,
        action_at = null, completed_at = null,
        rejected_by = v_uid, deadline_datetime = null
      where id = v_step.id;
    else
      update public.workflow_steps set
        status = 'pending',
        action_taken = null, note = null, revision_section = null,
        action_at = null, completed_at = null,
        rejected_by = null, deadline_datetime = null
      where id = v_step.id;
    end if;
  end loop;

  update public.documents set
    status = 'rejected',
    forwarded_to_id = null,
    forwarded_to_staff = false,
    forwarded_at = null,
    updated_at = now()
  where id = p_doc;

  insert into public.document_history (document_id, action, performed_by, note)
  values (p_doc, 'ไม่อนุมัติ — ส่งคืนให้ดำเนินการใหม่', v_uid, p_note);
end;
$function$;

CREATE OR REPLACE FUNCTION public.recall_document(p_doc uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid;
  v_doc public.documents%ROWTYPE;
  v_step public.workflow_steps%ROWTYPE;
  v_notify uuid[] := '{}';
BEGIN
  SELECT id INTO v_uid FROM public.current_profile();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  SELECT * INTO v_doc FROM public.documents WHERE id = p_doc FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'document not found'; END IF;

  IF v_doc.status <> 'pending' THEN
    RAISE EXCEPTION 'document not pending';
  END IF;

  IF v_doc.created_by IS DISTINCT FROM v_uid
     AND NOT public.is_admin()
     AND NOT public.is_dev() THEN
    RAISE EXCEPTION 'only creator can recall';
  END IF;

  FOR v_step IN
    SELECT * FROM public.workflow_steps
    WHERE document_id = p_doc
    ORDER BY step_number
    FOR UPDATE
  LOOP
    IF v_step.step_number > 1
       AND v_step.status IN ('active', 'done')
       AND v_step.assigned_to IS NOT NULL
       AND v_step.assigned_to <> v_doc.created_by THEN
      v_notify := array_append(v_notify, v_step.assigned_to);
    END IF;

    IF v_step.step_number = 1 THEN
      UPDATE public.workflow_steps SET
        status = 'active',
        action_taken = NULL,
        note = NULL,
        revision_section = NULL,
        action_at = NULL,
        completed_at = NULL,
        rejected_by = NULL,
        deadline_datetime = public.step_deadline_ts(v_step.deadline_days)
      WHERE id = v_step.id;
    ELSE
      UPDATE public.workflow_steps SET
        status = 'pending',
        action_taken = NULL,
        note = NULL,
        revision_section = NULL,
        action_at = NULL,
        completed_at = NULL,
        rejected_by = NULL,
        deadline_datetime = NULL
      WHERE id = v_step.id;
    END IF;
  END LOOP;

  UPDATE public.documents SET
    status = 'draft',
    current_step = 1,
    updated_at = now()
  WHERE id = p_doc;

  INSERT INTO public.document_history (document_id, action, performed_by, note)
  VALUES (
    p_doc,
    'ดึงเอกสารกลับ',
    v_uid,
    'ผู้จัดทำดึงเอกสารกลับเป็นฉบับร่าง — รีเซ็ตขั้นตอนอนุมัติทั้งหมด'
  );

  RETURN jsonb_build_object(
    'notify_ids', to_jsonb(v_notify)
  );
END;
$function$;

-- ⚠️ 'อนุมัติ / ลงนาม' ต้องตรงกับที่ doAct() ใน docDetail.js เขียนใน fallback path เป๊ะ ๆ
CREATE OR REPLACE FUNCTION public.workflow_action(p_doc uuid, p_action text, p_note text DEFAULT ''::text, p_revision_section text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid;
  v_doc public.documents%ROWTYPE;
  v_cur public.workflow_steps%ROWTYPE;
  v_nx public.workflow_steps%ROWTYPE;
  v_all_done boolean;
  v_nst text;
  v_ns int;
  v_hist text;
BEGIN
  SELECT id INTO v_uid FROM public.current_profile();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF p_action NOT IN ('approve', 'reject') THEN
    RAISE EXCEPTION 'invalid action';
  END IF;

  SELECT * INTO v_doc FROM public.documents WHERE id = p_doc FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'document not found'; END IF;

  IF v_doc.status NOT IN ('pending', 'active', 'rejected') THEN
    RAISE EXCEPTION 'document not in workflow state';
  END IF;

  SELECT * INTO v_cur
  FROM public.workflow_steps
  WHERE document_id = p_doc AND status = 'active'
  ORDER BY step_number
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    SELECT * INTO v_cur
    FROM public.workflow_steps
    WHERE document_id = p_doc
    ORDER BY step_number
    LIMIT 1
    FOR UPDATE;
  END IF;

  IF NOT FOUND THEN RAISE EXCEPTION 'no workflow steps'; END IF;

  IF v_cur.assigned_to IS DISTINCT FROM v_uid
     AND NOT public.is_admin()
     AND NOT public.is_dev() THEN
    RAISE EXCEPTION 'not assigned to active step';
  END IF;

  IF p_action = 'approve' THEN
    UPDATE public.workflow_steps SET
      status = 'done',
      action_taken = 'approve',
      note = coalesce(p_note, ''),
      revision_section = p_revision_section,
      action_at = now(),
      completed_at = now(),
      rejected_by = NULL
    WHERE id = v_cur.id;

    SELECT * INTO v_nx
    FROM public.workflow_steps
    WHERE document_id = p_doc
      AND step_number > v_cur.step_number
      AND status <> 'done'
    ORDER BY step_number
    LIMIT 1;

    IF FOUND THEN
      UPDATE public.workflow_steps SET
        status = 'active',
        deadline_datetime = public.step_deadline_ts(deadline_days),
        action_taken = NULL,
        note = NULL,
        revision_section = NULL,
        action_at = NULL,
        completed_at = NULL,
        rejected_by = NULL
      WHERE id = v_nx.id;
    END IF;

    SELECT NOT EXISTS (
      SELECT 1 FROM public.workflow_steps ws
      WHERE ws.document_id = p_doc
        AND ws.step_number > v_cur.step_number
        AND ws.status <> 'done'
    ) INTO v_all_done;

    IF v_all_done THEN
      v_nst := CASE WHEN public.doc_needs_numbering(v_doc.doc_type) THEN 'numbering' ELSE 'completed' END;
    ELSE
      v_nst := 'pending';
    END IF;
    v_hist := 'อนุมัติ / ลงนาม';

  ELSE
    UPDATE public.workflow_steps SET
      status = 'rejected',
      action_taken = 'reject',
      note = coalesce(p_note, ''),
      revision_section = p_revision_section,
      action_at = now(),
      completed_at = NULL,
      rejected_by = v_uid
    WHERE id = v_cur.id;

    v_all_done := false;
    v_nst := 'rejected';
    v_hist := 'ส่งคืนแก้ไขไปยังผู้จัดทำ';
  END IF;

  v_ns := least(coalesce(v_doc.current_step, 1) + 1, coalesce(v_doc.total_steps, 1));

  UPDATE public.documents SET
    status = v_nst,
    current_step = v_ns,
    updated_at = now()
  WHERE id = p_doc;

  INSERT INTO public.document_history (document_id, action, performed_by, note)
  VALUES (p_doc, v_hist, v_uid, coalesce(p_note, ''));

  RETURN jsonb_build_object(
    'status', v_nst,
    'all_done', v_all_done,
    'current_step', v_ns,
    'cur_step_number', v_cur.step_number,
    'cur_step_id', v_cur.id
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.auto_approve_overdue(p_doc uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  doc record;
  act record;
  warn_at timestamptz;
  grace int;
BEGIN
  IF auth.uid() IS NULL THEN RETURN 'not_authenticated'; END IF;

  SELECT * INTO doc FROM public.documents WHERE id = p_doc FOR UPDATE;
  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  IF coalesce(doc.notify_overdue, true) = false THEN RETURN 'notify_off'; END IF;
  IF doc.due_date IS NULL OR doc.due_date >= current_date THEN RETURN 'not_overdue'; END IF;

  -- ต้องเตือนก่อนเสมอ แล้วรอครบ grace period (วันทำการ) นับจากเวลาที่เตือนจริง
  SELECT min(sent_at) INTO warn_at FROM public.notifications
    WHERE document_id = p_doc AND notification_type = 'overdue';
  IF warn_at IS NULL THEN RETURN 'no_warning_yet'; END IF;

  SELECT coalesce(nullif(value,'')::int, 3) INTO grace
    FROM public.app_settings WHERE key = 'sla_cascade_days';
  IF grace IS NULL THEN grace := 3; END IF;
  IF now() < public.add_working_days(warn_at, grace) THEN RETURN 'in_grace'; END IF;

  -- กรณี a) ค้างขั้นตอนสุดท้ายของ workflow
  IF doc.status = 'pending' THEN
    SELECT * INTO act FROM public.workflow_steps
      WHERE document_id = p_doc AND status = 'active'
      ORDER BY step_number DESC LIMIT 1;
    IF NOT FOUND THEN RETURN 'no_active_step'; END IF;
    IF EXISTS (SELECT 1 FROM public.workflow_steps
               WHERE document_id = p_doc AND step_number > act.step_number
                 AND status <> 'done') THEN
      RETURN 'not_last_step';
    END IF;

    UPDATE public.workflow_steps SET
      status = 'done', action_taken = 'approve',
      note = 'อนุมัติอัตโนมัติโดยระบบ — เลยกำหนดและไม่มีการดำเนินการหลังแจ้งเตือนภายใน '||grace||' วันทำการ',
      action_at = now(), completed_at = now()
      WHERE id = act.id;

    UPDATE public.documents SET
      status = CASE WHEN public.doc_needs_numbering(doc.doc_type) THEN 'numbering' ELSE 'completed' END,
      current_step = least(coalesce(doc.current_step,1)+1, coalesce(doc.total_steps,1)),
      updated_at = now()
      WHERE id = p_doc;

    INSERT INTO public.document_history(document_id, action, performed_by, note)
      VALUES (p_doc, 'อนุมัติอัตโนมัติ (เลยกำหนด)',
              coalesce(act.assigned_to, doc.created_by),
              'ระบบอนุมัติขั้นตอนสุดท้าย "'||coalesce(act.step_name,'')||'" ให้อัตโนมัติ เนื่องจากเลยกำหนดและไม่มีการดำเนินการหลังแจ้งเตือนภายใน '||grace||' วันทำการ (ไม่มีลายเซ็นฝังในไฟล์)');

    RETURN CASE WHEN public.doc_needs_numbering(doc.doc_type) THEN 'approved_numbering' ELSE 'approved_completed' END;
  END IF;

  -- กรณี b) รอผู้รับปลายทางกดรับเอกสาร (ส่งต่อแล้วเงียบ)
  IF doc.status = 'completed' AND doc.forwarded_to_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.document_history
               WHERE document_id = p_doc
                 AND action LIKE '%เจ้าหน้าที่รับเอกสาร%') THEN
      RETURN 'already_accepted';
    END IF;

    INSERT INTO public.document_history(document_id, action, performed_by, note)
      VALUES (p_doc, 'เจ้าหน้าที่รับเอกสาร', doc.forwarded_to_id,
              'รับเอกสารอัตโนมัติโดยระบบ เนื่องจากเลยกำหนดและไม่มีการดำเนินการหลังแจ้งเตือนภายใน '||grace||' วันทำการ');

    UPDATE public.documents SET
      forwarded_to_id = NULL,
      forwarded_at = NULL,
      updated_at = now()
    WHERE id = p_doc;

    RETURN 'accepted_forward';
  END IF;

  RETURN 'not_eligible';
END;
$function$;

-- ============================================================================
-- ROW LEVEL SECURITY
--
-- ⚠️ policy อยู่ได้โดยที่ RLS ยังปิด — แล้วมันจะไม่ทำงานเลย ต้อง ENABLE ด้วยเสมอ
-- ⚠️ ตารางที่มี policy "บางคำสั่ง" ไม่เท่ากับมีครบทุกคำสั่ง — document_files เคยไม่มี
--    UPDATE policy อยู่ 2 เดือนโดยไม่มีใครรู้ เพราะ PostgREST คืน 200 + [] ไม่ใช่ error
--    (ดู 40_document_files_update_policy.sql)
--
-- เขียน (SELECT id FROM public.current_profile()) แทนรูปแบบที่ pg_policies คลี่ออกมา
-- ความหมายเหมือนกันทุกประการ แต่ไม่ต้องไล่แก้เวลาคอลัมน์ใน users เปลี่ยน
-- ============================================================================

ALTER TABLE public.users                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_steps           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_files           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_history         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_acks            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_templates           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_events          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_logs              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_templates          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_templates       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_template_steps  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doc_types                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doc_type_fields          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doc_number_settings      ENABLE ROW LEVEL SECURITY;

-- ── users: เห็นได้เฉพาะแถวตัวเอง (คนอื่นดูผ่าน view user_directory) ────────
DROP POLICY IF EXISTS users_select ON public.users;
CREATE POLICY users_select ON public.users FOR SELECT
  USING (((auth_uid = auth.uid()) OR is_admin()));
DROP POLICY IF EXISTS users_select_dev ON public.users;
CREATE POLICY users_select_dev ON public.users FOR SELECT
  USING (is_dev());
DROP POLICY IF EXISTS users_update ON public.users;
CREATE POLICY users_update ON public.users FOR UPDATE
  USING (((auth_uid = auth.uid()) OR is_admin()));
-- dev แก้ผู้ใช้ได้ แต่แตะบัญชี ROLE-SYS ไม่ได้
DROP POLICY IF EXISTS users_update_dev ON public.users;
CREATE POLICY users_update_dev ON public.users FOR UPDATE
  USING ((is_dev() AND (role_code <> 'ROLE-SYS'::text)))
  WITH CHECK ((is_dev() AND (role_code <> 'ROLE-SYS'::text)));
DROP POLICY IF EXISTS users_delete ON public.users;
CREATE POLICY users_delete ON public.users FOR DELETE
  USING (is_admin());

-- ── documents ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS documents_select ON public.documents;
CREATE POLICY documents_select ON public.documents FOR SELECT
  USING ((auth.uid() IS NOT NULL));
DROP POLICY IF EXISTS documents_insert ON public.documents;
CREATE POLICY documents_insert ON public.documents FOR INSERT
  WITH CHECK ((created_by = (SELECT id FROM public.current_profile())));
DROP POLICY IF EXISTS documents_update ON public.documents;
CREATE POLICY documents_update ON public.documents FOR UPDATE
  USING ((is_admin()
    OR (created_by = (SELECT id FROM public.current_profile()))
    OR (forwarded_to_id = (SELECT id FROM public.current_profile()))
    OR (EXISTS (SELECT 1 FROM public.workflow_steps ws
                WHERE ws.document_id = documents.id
                  AND ((ws.assigned_to = (SELECT id FROM public.current_profile()))
                    OR (ws.rejected_by = (SELECT id FROM public.current_profile())))))));
DROP POLICY IF EXISTS documents_update_dev ON public.documents;
CREATE POLICY documents_update_dev ON public.documents FOR UPDATE
  USING (is_dev()) WITH CHECK (is_dev());
-- จนท.คนไหนก็คว้าเอกสารจากกล่องรวม ROLE-STF ได้ (ดู 31_forward_to_staff_pool.sql)
DROP POLICY IF EXISTS documents_update_staff_pool ON public.documents;
CREATE POLICY documents_update_staff_pool ON public.documents FOR UPDATE
  USING (((forwarded_to_staff = true) AND (EXISTS (SELECT 1 FROM public.users u
    WHERE u.auth_uid = auth.uid() AND u.role_code = 'ROLE-STF'::text AND COALESCE(u.is_active, true)))))
  WITH CHECK (true);
DROP POLICY IF EXISTS documents_update_awaiting_submit ON public.documents;
CREATE POLICY documents_update_awaiting_submit ON public.documents FOR UPDATE
  USING (((status = 'awaiting_submit'::text) AND (EXISTS (SELECT 1 FROM public.users u
    WHERE u.auth_uid = auth.uid()
      AND u.role_code = ANY (ARRAY['ROLE-STF'::text, 'ROLE-SYS'::text, 'ROLE-DEV'::text])
      AND COALESCE(u.is_active, true)))))
  WITH CHECK (true);
DROP POLICY IF EXISTS documents_delete ON public.documents;
CREATE POLICY documents_delete ON public.documents FOR DELETE
  USING (((created_by = (SELECT id FROM public.current_profile())) OR is_admin()));
DROP POLICY IF EXISTS documents_delete_dev ON public.documents;
CREATE POLICY documents_delete_dev ON public.documents FOR DELETE
  USING (is_dev());

-- ── workflow_steps ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS workflow_steps_select ON public.workflow_steps;
CREATE POLICY workflow_steps_select ON public.workflow_steps FOR SELECT
  USING ((auth.uid() IS NOT NULL));
DROP POLICY IF EXISTS workflow_steps_insert ON public.workflow_steps;
CREATE POLICY workflow_steps_insert ON public.workflow_steps FOR INSERT
  WITH CHECK ((is_admin() OR (EXISTS (SELECT 1 FROM public.documents d
    WHERE d.id = workflow_steps.document_id
      AND d.created_by = (SELECT id FROM public.current_profile())))));
DROP POLICY IF EXISTS workflow_steps_update ON public.workflow_steps;
CREATE POLICY workflow_steps_update ON public.workflow_steps FOR UPDATE
  USING ((is_admin()
    OR (EXISTS (SELECT 1 FROM public.documents d
        WHERE d.id = workflow_steps.document_id
          AND ((d.created_by = (SELECT id FROM public.current_profile()))
            OR (d.forwarded_to_id = (SELECT id FROM public.current_profile())))))
    OR (EXISTS (SELECT 1 FROM public.workflow_steps ws2
        WHERE ws2.document_id = workflow_steps.document_id
          AND ((ws2.assigned_to = (SELECT id FROM public.current_profile()))
            OR (ws2.rejected_by = (SELECT id FROM public.current_profile())))))));
DROP POLICY IF EXISTS workflow_steps_update_dev ON public.workflow_steps;
CREATE POLICY workflow_steps_update_dev ON public.workflow_steps FOR UPDATE
  USING (is_dev()) WITH CHECK (is_dev());
-- DELETE แคบกว่า UPDATE ตั้งใจ — ผู้ลงนามลบขั้นตอนของคนอื่นไม่ได้ (ดู 41_workflow_steps_delete_policy.sql)
DROP POLICY IF EXISTS workflow_steps_delete ON public.workflow_steps;
CREATE POLICY workflow_steps_delete ON public.workflow_steps FOR DELETE
  USING ((is_admin() OR (EXISTS (SELECT 1 FROM public.documents d
    WHERE d.id = workflow_steps.document_id
      AND d.created_by = (SELECT id FROM public.current_profile())))));
DROP POLICY IF EXISTS workflow_steps_delete_dev ON public.workflow_steps;
CREATE POLICY workflow_steps_delete_dev ON public.workflow_steps FOR DELETE
  USING (is_dev());

-- ── document_files ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS document_files_select ON public.document_files;
CREATE POLICY document_files_select ON public.document_files FOR SELECT
  USING ((auth.uid() IS NOT NULL));
DROP POLICY IF EXISTS document_files_insert ON public.document_files;
CREATE POLICY document_files_insert ON public.document_files FOR INSERT
  WITH CHECK ((is_admin()
    OR (EXISTS (SELECT 1 FROM public.documents d
        WHERE d.id = document_files.document_id
          AND ((d.created_by = (SELECT id FROM public.current_profile()))
            OR (d.forwarded_to_id = (SELECT id FROM public.current_profile())))))
    OR (EXISTS (SELECT 1 FROM public.workflow_steps ws
        WHERE ws.document_id = document_files.document_id
          AND ((ws.assigned_to = (SELECT id FROM public.current_profile()))
            OR (ws.rejected_by = (SELECT id FROM public.current_profile())))))));
DROP POLICY IF EXISTS document_files_update ON public.document_files;
CREATE POLICY document_files_update ON public.document_files FOR UPDATE
  USING ((is_admin()
    OR (EXISTS (SELECT 1 FROM public.documents d
        WHERE d.id = document_files.document_id
          AND ((d.created_by = (SELECT id FROM public.current_profile()))
            OR (d.forwarded_to_id = (SELECT id FROM public.current_profile())))))
    OR (EXISTS (SELECT 1 FROM public.workflow_steps ws
        WHERE ws.document_id = document_files.document_id
          AND ((ws.assigned_to = (SELECT id FROM public.current_profile()))
            OR (ws.rejected_by = (SELECT id FROM public.current_profile())))))))
  WITH CHECK ((is_admin()
    OR (EXISTS (SELECT 1 FROM public.documents d
        WHERE d.id = document_files.document_id
          AND ((d.created_by = (SELECT id FROM public.current_profile()))
            OR (d.forwarded_to_id = (SELECT id FROM public.current_profile())))))
    OR (EXISTS (SELECT 1 FROM public.workflow_steps ws
        WHERE ws.document_id = document_files.document_id
          AND ((ws.assigned_to = (SELECT id FROM public.current_profile()))
            OR (ws.rejected_by = (SELECT id FROM public.current_profile())))))));
DROP POLICY IF EXISTS document_files_update_dev ON public.document_files;
CREATE POLICY document_files_update_dev ON public.document_files FOR UPDATE
  USING (is_dev()) WITH CHECK (is_dev());
DROP POLICY IF EXISTS document_files_delete ON public.document_files;
CREATE POLICY document_files_delete ON public.document_files FOR DELETE
  USING ((is_admin()
    OR (uploaded_by = (SELECT id FROM public.current_profile()))
    OR (EXISTS (SELECT 1 FROM public.documents d
        WHERE d.id = document_files.document_id
          AND d.created_by = (SELECT id FROM public.current_profile())))));
DROP POLICY IF EXISTS document_files_delete_dev ON public.document_files;
CREATE POLICY document_files_delete_dev ON public.document_files FOR DELETE
  USING (is_dev());

-- ── document_history: append-only ไม่มี policy UPDATE/DELETE โดยเจตนา ──────
DROP POLICY IF EXISTS document_history_select ON public.document_history;
CREATE POLICY document_history_select ON public.document_history FOR SELECT
  USING ((auth.uid() IS NOT NULL));
DROP POLICY IF EXISTS document_history_insert ON public.document_history;
CREATE POLICY document_history_insert ON public.document_history FOR INSERT
  WITH CHECK ((performed_by = (SELECT id FROM public.current_profile())));

-- ── document_acks ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS document_acks_select ON public.document_acks;
CREATE POLICY document_acks_select ON public.document_acks FOR SELECT
  USING ((auth.uid() IS NOT NULL));
DROP POLICY IF EXISTS document_acks_insert ON public.document_acks;
CREATE POLICY document_acks_insert ON public.document_acks FOR INSERT
  WITH CHECK ((is_admin() OR is_dev() OR (EXISTS (SELECT 1 FROM public.documents d
    WHERE d.id = document_acks.document_id
      AND d.created_by = (SELECT id FROM public.current_profile())))));
DROP POLICY IF EXISTS document_acks_update ON public.document_acks;
CREATE POLICY document_acks_update ON public.document_acks FOR UPDATE
  USING ((is_admin() OR is_dev() OR (user_id = (SELECT id FROM public.current_profile()))))
  WITH CHECK ((is_admin() OR is_dev() OR (user_id = (SELECT id FROM public.current_profile()))));
DROP POLICY IF EXISTS document_acks_delete ON public.document_acks;
CREATE POLICY document_acks_delete ON public.document_acks FOR DELETE
  USING ((is_admin() OR is_dev() OR (EXISTS (SELECT 1 FROM public.documents d
    WHERE d.id = document_acks.document_id
      AND d.created_by = (SELECT id FROM public.current_profile())))));

-- ── notifications: SELECT ปิด (มี recipient_email) INSERT ผ่าน RPC เท่านั้น ─
DROP POLICY IF EXISTS notifications_select ON public.notifications;
CREATE POLICY notifications_select ON public.notifications FOR SELECT
  USING ((is_admin() OR (recipient_id = (SELECT id FROM public.current_profile()))));
DROP POLICY IF EXISTS notifications_select_dev ON public.notifications;
CREATE POLICY notifications_select_dev ON public.notifications FOR SELECT
  USING (is_dev());
DROP POLICY IF EXISTS notifications_insert ON public.notifications;
CREATE POLICY notifications_insert ON public.notifications FOR INSERT
  WITH CHECK ((is_admin() OR is_dev()));

-- ── ตารางตั้งค่า: ใครล็อกอินก็อ่านได้ เขียนได้เฉพาะ admin / dev ───────────
DROP POLICY IF EXISTS app_settings_select ON public.app_settings;
CREATE POLICY app_settings_select ON public.app_settings FOR SELECT
  USING ((auth.uid() IS NOT NULL));
-- ข้อยกเว้น: หน้า login ยังไม่มี session แต่ต้องอ่านประกาศ popup ได้
DROP POLICY IF EXISTS app_settings_login_announce ON public.app_settings;
CREATE POLICY app_settings_login_announce ON public.app_settings FOR SELECT
  USING ((key ~~ 'login_announcement%'::text));
DROP POLICY IF EXISTS app_settings_write ON public.app_settings;
CREATE POLICY app_settings_write ON public.app_settings FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS app_settings_write_dev ON public.app_settings;
CREATE POLICY app_settings_write_dev ON public.app_settings FOR ALL
  USING (is_dev()) WITH CHECK (is_dev());

DROP POLICY IF EXISTS email_templates_select ON public.email_templates;
CREATE POLICY email_templates_select ON public.email_templates FOR SELECT
  USING ((auth.uid() IS NOT NULL));
DROP POLICY IF EXISTS email_templates_write ON public.email_templates;
CREATE POLICY email_templates_write ON public.email_templates FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS email_templates_write_dev ON public.email_templates;
CREATE POLICY email_templates_write_dev ON public.email_templates FOR ALL
  USING (is_dev()) WITH CHECK (is_dev());

DROP POLICY IF EXISTS workflow_templates_select ON public.workflow_templates;
CREATE POLICY workflow_templates_select ON public.workflow_templates FOR SELECT
  USING ((auth.uid() IS NOT NULL));
DROP POLICY IF EXISTS workflow_templates_write ON public.workflow_templates;
CREATE POLICY workflow_templates_write ON public.workflow_templates FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS workflow_templates_write_dev ON public.workflow_templates;
CREATE POLICY workflow_templates_write_dev ON public.workflow_templates FOR ALL
  USING (is_dev()) WITH CHECK (is_dev());

DROP POLICY IF EXISTS workflow_template_steps_select ON public.workflow_template_steps;
CREATE POLICY workflow_template_steps_select ON public.workflow_template_steps FOR SELECT
  USING ((auth.uid() IS NOT NULL));
DROP POLICY IF EXISTS workflow_template_steps_write ON public.workflow_template_steps;
CREATE POLICY workflow_template_steps_write ON public.workflow_template_steps FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS workflow_template_steps_write_dev ON public.workflow_template_steps;
CREATE POLICY workflow_template_steps_write_dev ON public.workflow_template_steps FOR ALL
  USING (is_dev()) WITH CHECK (is_dev());

DROP POLICY IF EXISTS doc_types_select ON public.doc_types;
CREATE POLICY doc_types_select ON public.doc_types FOR SELECT
  USING ((auth.uid() IS NOT NULL));
DROP POLICY IF EXISTS doc_types_write ON public.doc_types;
CREATE POLICY doc_types_write ON public.doc_types FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS doc_types_write_dev ON public.doc_types;
CREATE POLICY doc_types_write_dev ON public.doc_types FOR ALL
  USING (is_dev()) WITH CHECK (is_dev());

DROP POLICY IF EXISTS doc_type_fields_select ON public.doc_type_fields;
CREATE POLICY doc_type_fields_select ON public.doc_type_fields FOR SELECT
  USING ((auth.uid() IS NOT NULL));
DROP POLICY IF EXISTS doc_type_fields_write ON public.doc_type_fields;
CREATE POLICY doc_type_fields_write ON public.doc_type_fields FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS doc_type_fields_write_dev ON public.doc_type_fields;
CREATE POLICY doc_type_fields_write_dev ON public.doc_type_fields FOR ALL
  USING (is_dev()) WITH CHECK (is_dev());

DROP POLICY IF EXISTS doc_number_settings_all ON public.doc_number_settings;
CREATE POLICY doc_number_settings_all ON public.doc_number_settings FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS doc_number_settings_write_dev ON public.doc_number_settings;
CREATE POLICY doc_number_settings_write_dev ON public.doc_number_settings FOR ALL
  USING (is_dev()) WITH CHECK (is_dev());

DROP POLICY IF EXISTS projects_select ON public.projects;
CREATE POLICY projects_select ON public.projects FOR SELECT
  USING ((auth.uid() IS NOT NULL));
DROP POLICY IF EXISTS projects_write ON public.projects;
CREATE POLICY projects_write ON public.projects FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS projects_write_dev ON public.projects;
CREATE POLICY projects_write_dev ON public.projects FOR ALL
  USING (is_dev()) WITH CHECK (is_dev());

-- form_templates: เลขานุการ (GNK-SEC) เขียนได้ด้วย ไม่ใช่แค่ admin
-- (ดู 13_allow_secretary_template_write.sql)
DROP POLICY IF EXISTS form_templates_select ON public.form_templates;
CREATE POLICY form_templates_select ON public.form_templates FOR SELECT
  USING ((auth.uid() IS NOT NULL));
DROP POLICY IF EXISTS form_templates_write ON public.form_templates;
CREATE POLICY form_templates_write ON public.form_templates FOR ALL
  USING (is_template_manager()) WITH CHECK (is_template_manager());
DROP POLICY IF EXISTS form_templates_write_dev ON public.form_templates;
CREATE POLICY form_templates_write_dev ON public.form_templates FOR ALL
  USING (is_dev()) WITH CHECK (is_dev());

DROP POLICY IF EXISTS calendar_events_select ON public.calendar_events;
CREATE POLICY calendar_events_select ON public.calendar_events FOR SELECT
  USING (((is_private IS FALSE)
    OR (created_by = (SELECT id FROM public.current_profile()))
    OR is_admin()));
DROP POLICY IF EXISTS calendar_events_insert ON public.calendar_events;
CREATE POLICY calendar_events_insert ON public.calendar_events FOR INSERT
  WITH CHECK ((created_by = (SELECT id FROM public.current_profile())));
DROP POLICY IF EXISTS calendar_events_delete ON public.calendar_events;
CREATE POLICY calendar_events_delete ON public.calendar_events FOR DELETE
  USING (((created_by = (SELECT id FROM public.current_profile())) OR is_admin()));

DROP POLICY IF EXISTS announcements_select ON public.announcements;
CREATE POLICY announcements_select ON public.announcements FOR SELECT
  USING ((auth.uid() IS NOT NULL));
DROP POLICY IF EXISTS announcements_write ON public.announcements;
CREATE POLICY announcements_write ON public.announcements FOR ALL
  USING ((is_admin() OR is_dev())) WITH CHECK ((is_admin() OR is_dev()));

DROP POLICY IF EXISTS system_logs_select ON public.system_logs;
CREATE POLICY system_logs_select ON public.system_logs FOR SELECT
  USING ((is_admin() OR is_dev()));
DROP POLICY IF EXISTS system_logs_insert ON public.system_logs;
CREATE POLICY system_logs_insert ON public.system_logs FOR INSERT
  WITH CHECK ((auth.uid() IS NOT NULL));
DROP POLICY IF EXISTS system_logs_delete ON public.system_logs;
CREATE POLICY system_logs_delete ON public.system_logs FOR DELETE
  USING ((is_admin() OR is_dev()));

-- notification_rate_limits: RLS เปิดแต่ไม่มี policy เลย = เข้าถึงตรง ๆ ไม่ได้
-- อ่าน/เขียนผ่าน check_and_bump_notify_rate() (SECURITY DEFINER) เท่านั้น — ตั้งใจ

-- ============================================================================
-- เสร็จ — ต่อด้วยไฟล์ข้อมูลจาก 49_export_sql_dump.mjs
-- ============================================================================
