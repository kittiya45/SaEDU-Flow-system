-- ============================================================================
-- 43_incoming_receive_no_and_ack.sql
-- (1) เลขรับจากหน่วยงานต้นทาง บนเอกสารขาเข้า
-- (2) การเสนอเอกสารเพื่อ "รับทราบ" (document_acks)
--
-- (1) เลขรับ — documents.received_number / received_date
--     หนังสือขาเข้าที่ส่งมาถึง กนค. มีตราประทับ "เลขรับที่ / ลงวันที่" ของหน่วยงาน
--     ต้นทางติดมาแล้ว (เช่น 3544, (2791.03)/1212) ระบบเดิมไม่มีที่เก็บเลย ทำให้
--     ค้นหา/อ้างอิงกลับไปยังหนังสือต้นเรื่องไม่ได้ — เก็บเป็น free text เพราะรูปแบบ
--     ของแต่ละหน่วยงานไม่เหมือนกัน (ไม่ใช่ running number ของเราเอง ไม่ต้อง unique)
--
-- (2) document_acks — "เสนอเพื่อโปรดทราบ"
--     เอกสารขาเข้าไม่มี workflow อนุมัติ (สลับ 2026-07-22: incoming = ฟอร์มง่าย)
--     แต่ในทางปฏิบัติต้องเวียนให้เลขานุการ/หัวหน้านิสิตรับทราบ เดิมทำได้แค่ส่งอีเมล
--     ออกไปแล้วไม่มีใครรู้ว่ามีคนอ่านหรือยัง ตารางนี้เก็บ "ใครถูกเสนอ / รับทราบแล้วยัง"
--
--     ตั้งใจไม่ใช้ workflow_steps ซ้ำ เพราะ badge กระดิ่ง / vTodo / MSTEPS / RPC
--     workflow_action() ล้วนกรอง workflow_steps ตามสถานะล้วน ๆ โดยไม่ join เอกสาร —
--     การยัดขั้นตอน "รับทราบ" ลงไปจะทำให้เอกสารขาเข้ากลายเป็นเอกสารมีขั้นตอนอนุมัติ
--     ในสายตาของโค้ดเหล่านั้นทันที
--
-- idempotent — รันซ้ำได้
-- ต้องรันหลัง: 01_migration_auth_rls.sql, 17_create_dev_role.sql
-- frontend fail-open: ถ้ายังไม่รันสคริปต์นี้ การ์ด "การรับทราบ" จะไม่แสดง
--                     และช่องเลขรับจะบันทึกไม่ได้ (เงียบ) แต่ระบบเดิมทำงานปกติ
-- ============================================================================

-- ── (1) เลขรับจากหน่วยงานต้นทาง ──────────────────────────────────────────────
alter table public.documents add column if not exists received_number text;
alter table public.documents add column if not exists received_date  date;

comment on column public.documents.received_number is
  'เลขรับที่ประทับมาจากหน่วยงานต้นทาง (free text — ไม่ใช่เลขที่ กนค. ออกเอง)';
comment on column public.documents.received_date is
  'วันที่ตามตราประทับรับของหน่วยงานต้นทาง';

-- ค้นหาด้วยเลขรับได้เร็ว (เฉพาะแถวที่มีค่า)
create index if not exists documents_received_number_idx
  on public.documents (received_number)
  where received_number is not null;

-- ── (2) ตารางการรับทราบ ─────────────────────────────────────────────────────
create table if not exists public.document_acks (
  id           uuid primary key default gen_random_uuid(),
  document_id  uuid not null references public.documents(id) on delete cascade,
  user_id      uuid not null references public.users(id)     on delete cascade,
  status       text not null default 'pending',   -- pending | acked
  acked_at     timestamptz,
  note         text,
  signed       boolean not null default false,    -- ลงลายเซ็นรับทราบลงไฟล์ PDF แล้วหรือยัง
  requested_by uuid references public.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  unique (document_id, user_id)
);

create index if not exists document_acks_doc_idx  on public.document_acks (document_id);
-- คิว "รอฉันรับทราบ" — กระดิ่ง/หน้างานของฉันยิงด้วยคู่นี้
create index if not exists document_acks_user_idx on public.document_acks (user_id, status);

alter table public.document_acks enable row level security;

-- SELECT: ผู้ใช้ที่ล็อกอินทุกคน — ตรงกับ documents/workflow_steps ที่เปิดอ่านทั้งหมด
-- แล้วกรองฝั่ง client (ไม่มีข้อมูลลับรายบุคคลในตารางนี้ ไม่มีอีเมล)
drop policy if exists document_acks_select on public.document_acks;
create policy document_acks_select on public.document_acks
  for select using (auth.uid() is not null);

-- INSERT: ผู้จัดทำเอกสารนั้น หรือ แอดมิน/dev เท่านั้น — คนนอกเสนอเอกสารของคนอื่นไม่ได้
drop policy if exists document_acks_insert on public.document_acks;
create policy document_acks_insert on public.document_acks
  for insert with check (
    is_admin() or is_dev()
    or exists (
      select 1 from public.documents d
      where d.id = document_acks.document_id
        and d.created_by = (select id from public.current_profile())
    )
  );

-- UPDATE: เจ้าของแถวกด "รับทราบ" ของตัวเองได้เท่านั้น (นอกนั้นแอดมิน/dev แก้ให้ได้)
-- ⚠️ ต้องมี with check ด้วย ไม่งั้นย้าย user_id ไปเป็นของคนอื่นแล้วกดแทนกันได้
drop policy if exists document_acks_update on public.document_acks;
create policy document_acks_update on public.document_acks
  for update
  using (
    is_admin() or is_dev()
    or user_id = (select id from public.current_profile())
  )
  with check (
    is_admin() or is_dev()
    or user_id = (select id from public.current_profile())
  );

-- DELETE: ถอนรายชื่อที่เสนอไปแล้ว — ผู้จัดทำเอกสาร หรือ แอดมิน/dev
drop policy if exists document_acks_delete on public.document_acks;
create policy document_acks_delete on public.document_acks
  for delete using (
    is_admin() or is_dev()
    or exists (
      select 1 from public.documents d
      where d.id = document_acks.document_id
        and d.created_by = (select id from public.current_profile())
    )
  );

-- ── (3) ให้ผู้ถูกเสนอรับทราบ แจ้งเตือนกลับได้ ──────────────────────────────
-- can_log_notification() (นิยามครั้งแรกใน 22_scale_hardening.sql) ยอมเฉพาะ
-- ผู้จัดทำ / ผู้ถูกส่งต่อ / ผู้รับผิดชอบขั้นตอน / staff — แต่คนที่กด "รับทราบ" มัก
-- ไม่ใช่ทั้งสี่กลุ่มนั้น การแจ้งกลับผู้จัดทำว่า "X รับทราบแล้ว" จึงถูกปฏิเสธ
-- เพิ่มเงื่อนไข: มีชื่ออยู่ใน document_acks ของเอกสารใบนั้น
-- ⚠️ ถ้าอนาคตแก้ 22_scale_hardening.sql แล้วรันทับ ต้องรันไฟล์นี้ซ้ำเพื่อคืนเงื่อนไขนี้
CREATE OR REPLACE FUNCTION public.can_log_notification(p_doc uuid, p_sender uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

-- ── ตรวจผล ──────────────────────────────────────────────────────────────────
-- คอลัมน์ใหม่ 2 คอลัมน์
select column_name, data_type
from information_schema.columns
where table_schema='public' and table_name='documents'
  and column_name in ('received_number','received_date');

-- ต้องเห็น policy ครบ 4 คำสั่ง (SELECT/INSERT/UPDATE/DELETE) และ rowsecurity = true
select cmd, policyname
from pg_policies
where schemaname='public' and tablename='document_acks'
order by cmd, policyname;

select relname, relrowsecurity
from pg_class
where oid = 'public.document_acks'::regclass;
