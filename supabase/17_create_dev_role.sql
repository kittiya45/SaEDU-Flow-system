-- ═══════════════════════════════════════════════════════════════════
-- 17_create_dev_role.sql — role "นักพัฒนา" (ROLE-DEV) แบบแยกสิทธิ์จากแอดมิน
--
-- รันในหน้า SQL Editor ของ Supabase Dashboard (หรือ npx supabase db query --linked --file <path>)
-- idempotent — รันซ้ำได้ปลอดภัย (และถ้าเคยรันเวอร์ชันเก่าที่ยัด ROLE-DEV เข้า is_admin()
-- การรันไฟล์นี้จะถอน ROLE-DEV ออกจาก is_admin() ให้เองในข้อ 1)
--
-- โมเดลสิทธิ์: ROLE-DEV ≠ แอดมิน
--   is_admin()  = ROLE-SYS, ROLE-STF (เหมือนเดิมตาม 01_migration_auth_rls.sql)
--   is_dev()    = ROLE-DEV — ได้สิทธิ์เฉพาะที่เครื่องมือนักพัฒนาใช้จริง:
--     ✓ อ่าน/ลบ system_logs (error log)
--     ✓ อ่าน notifications (ดู log การแจ้งเตือน)
--     ✓ เขียนตาราง config ทั้งหมด (app_settings, email_templates, workflow_templates(+steps),
--       doc_types(+fields), doc_number_settings, projects, form_templates) — งาน "แก้ระบบหลังบ้าน"
--     ✓ UPDATE documents / workflow_steps (เครื่องมือซ่อมเอกสาร)
--     ✓ DELETE documents / document_files / workflow_steps (ลบเอกสารถาวร — phase 2)
--     ✗ จัดการผู้ใช้เต็มรูปแบบ (ลบ/สร้าง) — ดู phase3 สำหรับอนุมัติ/แก้ role แบบจำกัด
--     ✓ อ่าน/อัปเดต users แบบจำกัด (phase3) — อนุมัติ เปิด-ปิด แก้ role (ห้าม ROLE-SYS)
--     ✗ ลบเอกสาร/ไฟล์/ประวัติ, สร้างเอกสารแทนคนอื่น
--
-- หมายเหตุ: การสมัครสมาชิกไม่มีทางได้ ROLE-DEV — ต้องให้แอดมินแก้ role ผ่านหน้า
-- "จัดการผู้ใช้" (แก้ไขข้อมูล → สิทธิ์ → นักพัฒนา) เท่านั้น
-- ═══════════════════════════════════════════════════════════════════

-- 1) ยืนยันนิยาม is_admin() เดิม (ROLE-SYS, ROLE-STF) — ไม่รวม ROLE-DEV
--    (สำคัญถ้าเคยรันไฟล์นี้เวอร์ชันแรกที่เพิ่ม ROLE-DEV เข้าไป — บรรทัดนี้ถอนออกให้)
create or replace function public.is_admin()
returns boolean
language sql stable security definer
as $$
  select exists (
    select 1 from public.users
    where auth_uid = auth.uid() and role_code in ('ROLE-SYS','ROLE-STF')
  );
$$;

-- 2) helper ใหม่: is_dev()
create or replace function public.is_dev()
returns boolean
language sql stable security definer
as $$
  select exists (
    select 1 from public.users
    where auth_uid = auth.uid() and role_code = 'ROLE-DEV'
  );
$$;

-- 3) ตาราง system_logs — บันทึก JS error จากเบราว์เซอร์ผู้ใช้ (logSysErr ใน config.js)
create table if not exists public.system_logs (
  id      uuid primary key default gen_random_uuid(),
  at      timestamptz not null default now(),
  level   text not null default 'error',   -- error | warn | info
  source  text,                            -- จุดที่จับได้ เช่น window.onerror, unhandledrejection
  message text,
  detail  text,                            -- ข้อมูลประกอบ (stack, url) — text ตัดที่ ~2000 ตัวอักษรจาก client
  user_id uuid references public.users(id) on delete set null
);

create index if not exists idx_system_logs_at on public.system_logs (at desc);

alter table public.system_logs enable row level security;

drop policy if exists system_logs_insert on public.system_logs;
create policy system_logs_insert on public.system_logs
  for insert with check (auth.uid() is not null);

drop policy if exists system_logs_select on public.system_logs;
create policy system_logs_select on public.system_logs
  for select using (public.is_admin() or public.is_dev());

drop policy if exists system_logs_delete on public.system_logs;
create policy system_logs_delete on public.system_logs
  for delete using (public.is_admin() or public.is_dev());

-- 4) สิทธิ์ ROLE-DEV เพิ่มเติม — policy คู่ขนานกับของแอดมิน (permissive policies ทำงานแบบ OR
--    จึงเพิ่มได้โดยไม่แตะ policy เดิม)

-- 4.1 ตาราง config (จาก 07_create_admin_config_tables.sql + 01_migration_auth_rls.sql)
drop policy if exists app_settings_write_dev on public.app_settings;
create policy app_settings_write_dev on public.app_settings
  for all using (public.is_dev()) with check (public.is_dev());

drop policy if exists email_templates_write_dev on public.email_templates;
create policy email_templates_write_dev on public.email_templates
  for all using (public.is_dev()) with check (public.is_dev());

drop policy if exists workflow_templates_write_dev on public.workflow_templates;
create policy workflow_templates_write_dev on public.workflow_templates
  for all using (public.is_dev()) with check (public.is_dev());

drop policy if exists workflow_template_steps_write_dev on public.workflow_template_steps;
create policy workflow_template_steps_write_dev on public.workflow_template_steps
  for all using (public.is_dev()) with check (public.is_dev());

drop policy if exists doc_types_write_dev on public.doc_types;
create policy doc_types_write_dev on public.doc_types
  for all using (public.is_dev()) with check (public.is_dev());

drop policy if exists doc_type_fields_write_dev on public.doc_type_fields;
create policy doc_type_fields_write_dev on public.doc_type_fields
  for all using (public.is_dev()) with check (public.is_dev());

drop policy if exists doc_number_settings_write_dev on public.doc_number_settings;
create policy doc_number_settings_write_dev on public.doc_number_settings
  for all using (public.is_dev()) with check (public.is_dev());

drop policy if exists projects_write_dev on public.projects;
create policy projects_write_dev on public.projects
  for all using (public.is_dev()) with check (public.is_dev());

drop policy if exists form_templates_write_dev on public.form_templates;
create policy form_templates_write_dev on public.form_templates
  for all using (public.is_dev()) with check (public.is_dev());

-- 4.2 log การแจ้งเตือน — SELECT ปกติจำกัด recipient/is_admin (16_restrict_notifications_select.sql)
drop policy if exists notifications_select_dev on public.notifications;
create policy notifications_select_dev on public.notifications
  for select using (public.is_dev());

-- 4.3 เครื่องมือซ่อมเอกสาร — UPDATE เท่านั้น (ห้าม insert/delete)
--    การเขียน document_history ของ dev ใช้ policy เดิมได้ (performed_by = ตัวเอง — 06_tighten_audit_rls.sql)
drop policy if exists documents_update_dev on public.documents;
create policy documents_update_dev on public.documents
  for update using (public.is_dev()) with check (public.is_dev());

drop policy if exists workflow_steps_update_dev on public.workflow_steps;
create policy workflow_steps_update_dev on public.workflow_steps
  for update using (public.is_dev()) with check (public.is_dev());

drop policy if exists documents_delete_dev on public.documents;
create policy documents_delete_dev on public.documents
  for delete using (public.is_dev());

drop policy if exists document_files_delete_dev on public.document_files;
create policy document_files_delete_dev on public.document_files
  for delete using (public.is_dev());

drop policy if exists workflow_steps_delete_dev on public.workflow_steps;
create policy workflow_steps_delete_dev on public.workflow_steps
  for delete using (public.is_dev());

-- 4.4 จัดการผู้ใช้แบบจำกัด (28_phase3_dev_users.sql)
drop policy if exists users_select_dev on public.users;
create policy users_select_dev on public.users
  for select using (public.is_dev());

drop policy if exists users_update_dev on public.users;
create policy users_update_dev on public.users
  for update
  using (public.is_dev() and role_code <> 'ROLE-SYS')
  with check (public.is_dev() and role_code <> 'ROLE-SYS');

-- 5) ประกาศหน้า Login (popup ก่อนล็อกอิน)
--    หน้า Login ยังไม่มี session — เปิดให้ anon อ่าน app_settings ได้ "เฉพาะ" key ประกาศหน้า login
--    key ที่ใช้: login_announcement_active ('true'/'false'), login_announcement_title,
--                login_announcement (ข้อความ), login_announcement_type ('info'|'warning'|'error')
--    จัดการในการ์ด "Popup ประกาศหน้า Login" (แท็บตั้งค่าระบบ — ทั้งหน้าจัดการระบบของแอดมิน
--    และแท็บจัดการระบบใน Dev Panel)
drop policy if exists app_settings_login_announce on public.app_settings;
create policy app_settings_login_announce on public.app_settings
  for select using (key like 'login_announcement%');
