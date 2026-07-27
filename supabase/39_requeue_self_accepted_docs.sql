-- ============================================================================
-- 39_requeue_self_accepted_docs.sql
-- ส่งเอกสารที่ "ผู้จัดทำกดรับเอง" กลับเข้าคิวเจ้าหน้าที่กิจการนิสิต
-- รันใน Supabase SQL Editor (idempotent — รันซ้ำได้)
-- ต้องรันหลัง 38_accepted_by_and_forward_guard.sql
--
--   1) forward_decline ใหม่: เช็ค "รับไปแล้ว" เฉพาะรายการที่เกิดหลังการส่งต่อ
--      รอบล่าสุด (document_history ลบไม่ได้ — รายการรับเก่าต้องไม่ล็อกเอกสาร
--      ที่ถูกส่งต่อใหม่ไว้ตลอดไป) ตรงกับ acceptIsCurrent() ฝั่ง frontend
--   2) แก้ข้อมูล: เอกสารสถานะ awaiting_submit ที่ผู้รับคือผู้สร้างเอกสารเอง
--      → กลับไปเป็น completed + เข้าคิวกลุ่ม จนท. (forwarded_to_staff) ให้ จนท.
--      กดรับใหม่ตามขั้นตอนจริง
-- ============================================================================

-- ── 1) forward_decline: เทียบเวลารับกับ forwarded_at ───────────────────────
create or replace function public.forward_decline(p_doc uuid, p_note text default '')
returns void
language plpgsql
security definer
set search_path = public
as $$
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
$$;

grant execute on function public.forward_decline(uuid, text) to authenticated;

-- ── 2) ส่งเอกสารที่ผู้จัดทำกดรับเองกลับเข้าคิว จนท. ────────────────────────
-- บันทึกประวัติก่อน (อ้างสถานะเดิม) แล้วค่อยอัปเดตเอกสาร
insert into public.document_history (document_id, action, performed_by, note)
select d.id,
       'ส่งเข้ากิจการทั้งหมด',
       coalesce(
         (select u.id from public.users u where u.role_code = 'ROLE-SYS' order by u.created_at limit 1),
         d.created_by
       ),
       'แก้ไขย้อนหลัง: เอกสารถูกผู้จัดทำกดรับเองโดยไม่ผ่านเจ้าหน้าที่ — ส่งกลับเข้าคิวกิจการนิสิตให้ จนท. รับตามขั้นตอน'
from public.documents d
join public.users u2 on u2.id = d.accepted_by
where d.status = 'awaiting_submit'
  and d.accepted_by = d.created_by
  and u2.role_code not in ('ROLE-STF', 'ROLE-ADV', 'ROLE-SYS', 'ROLE-DEV');

update public.documents d set
  status = 'completed',
  forwarded_to_staff = true,
  forwarded_to_id = null,
  forwarded_at = now(),
  accepted_by = null,
  accepted_at = null,
  updated_at = now()
from public.users u2
where u2.id = d.accepted_by
  and d.status = 'awaiting_submit'
  and d.accepted_by = d.created_by
  and u2.role_code not in ('ROLE-STF', 'ROLE-ADV', 'ROLE-SYS', 'ROLE-DEV');

-- ── ตรวจผล ────────────────────────────────────────────────────────────────
-- select doc_number, status, forwarded_to_staff, forwarded_at, accepted_by
-- from public.documents where status in ('completed','awaiting_submit')
-- order by updated_at desc limit 10;
