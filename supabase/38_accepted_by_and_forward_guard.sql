-- ============================================================================
-- 38_accepted_by_and_forward_guard.sql
-- บันทึก "ใครเป็นคนรับเอกสาร" + กันผู้จัดทำกดรับเอกสารของตัวเอง
-- รันใน Supabase SQL Editor (idempotent — รันซ้ำได้)
-- ต้องรันหลัง 31_forward_to_staff_pool.sql (แก้นิยาม forward_accept ของไฟล์นั้น)
--
--   1) คอลัมน์ documents.accepted_by / accepted_at
--      เดิม forward_accept() ล้าง forwarded_to_id/forwarded_to_staff ทิ้งตอนกดรับ
--      ทำให้เอกสารสถานะ awaiting_submit ทุกฉบับหน้าตาเหมือนกันหมด (null/false)
--      แยกไม่ออกว่าใครถืออยู่ ต้องไล่ document_history เอาเอง
--   2) backfill คอลัมน์ใหม่จาก document_history ของเอกสารที่รับไปแล้ว
--   3) forward_accept() ใหม่: เขียน accepted_by/accepted_at + guard 2 ชั้น
--      - ผู้กดรับต้องเป็น จนท./อาจารย์ที่ปรึกษา/แอดมิน/dev (นิสิตผู้จัดทำกดไม่ได้)
--      - ห้ามผู้สร้างเอกสารกดรับเอกสารของตัวเอง (ยกเว้น admin/dev ที่ใช้ซ่อมข้อมูล)
-- ============================================================================

-- ── 1) คอลัมน์ผู้รับเอกสาร ──────────────────────────────────────────────────
alter table public.documents
  add column if not exists accepted_by uuid references public.users(id) on delete set null;

alter table public.documents
  add column if not exists accepted_at timestamptz;

comment on column public.documents.accepted_by is
  'ผู้ที่กดรับเอกสาร (forward_accept) — คนที่ถือเอกสารอยู่ในสถานะ awaiting_submit';
comment on column public.documents.accepted_at is
  'เวลาที่กดรับเอกสาร';

create index if not exists documents_accepted_by_idx
  on public.documents (accepted_by)
  where accepted_by is not null;

-- ── 2) backfill จาก document_history (เอกสารที่รับไปก่อนมีคอลัมน์นี้) ────────
update public.documents d set
  accepted_by = h.performed_by,
  accepted_at = h.performed_at
from (
  select distinct on (document_id) document_id, performed_by, performed_at
  from public.document_history
  where action = 'เจ้าหน้าที่รับเอกสาร'
  order by document_id, performed_at desc
) h
where h.document_id = d.id
  and d.accepted_by is null;

-- ── 3) forward_accept: guard + บันทึกผู้รับ ─────────────────────────────────
create or replace function public.forward_accept(p_doc uuid, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
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

  insert into public.document_history (document_id, action, performed_by, note)
  values (
    p_doc,
    'เจ้าหน้าที่รับเอกสาร',
    v_uid,
    coalesce(p_note, 'รับเอกสารแล้ว — รอเจ้าหน้าที่ยื่นในระบบมหาวิทยาลัย')
  );
end;
$$;

grant execute on function public.forward_accept(uuid, text) to authenticated;

-- ── ตรวจผล: เอกสารที่รอยื่นในระบบ ตอนนี้รู้แล้วว่าใครถือ ──────────────────
-- select d.doc_number, d.status, u.full_name as ผู้รับเอกสาร, d.accepted_at
-- from public.documents d
-- left join public.users u on u.id = d.accepted_by
-- where d.status = 'awaiting_submit'
-- order by d.accepted_at desc nulls last;
