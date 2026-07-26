-- ============================================================================
-- ส่งเข้ากิจการทั้งหมด + สถานะหลังรับเอกสาร (awaiting_submit)
-- รันใน Supabase SQL Editor (idempotent — รันซ้ำได้)
--   1) คอลัมน์ forwarded_to_staff
--   2) forward_accept → status = awaiting_submit
--   3) RLS ให้ จนท. อัปเดต awaiting_submit → completed ได้
-- ============================================================================

alter table public.documents
  add column if not exists forwarded_to_staff boolean not null default false;

comment on column public.documents.forwarded_to_staff is
  'true = ส่งเข้าคิวจนท.กิจการทั้งกลุ่ม (แจ้งทุก ROLE-STF; คนใดคนหนึ่งกดรับได้)';

create index if not exists documents_fwd_staff_pending_idx
  on public.documents (status, forwarded_at desc)
  where forwarded_to_staff = true;

-- ── RLS: จนท. อัปเดตได้เมื่อเป็นคิวกลุ่ม ───────────────────────────────────
drop policy if exists documents_update_staff_pool on public.documents;
create policy documents_update_staff_pool on public.documents for update
  using (
    forwarded_to_staff = true
    and exists (
      select 1 from public.users u
      where u.auth_uid = auth.uid()
        and u.role_code = 'ROLE-STF'
        and coalesce(u.is_active, true)
    )
  )
  with check (true);

-- ── forward_accept: รองรับคิวกลุ่ม ──────────────────────────────────────────
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
begin
  select id into v_uid from public.current_profile();
  if v_uid is null then raise exception 'not authenticated'; end if;
  select role_code into v_role from public.users where id = v_uid;

  select * into v_doc from public.documents where id = p_doc for update;
  if not found then raise exception 'document not found'; end if;

  if v_doc.forwarded_to_staff then
    if v_role is distinct from 'ROLE-STF'
       and not public.is_admin()
       and not public.is_dev() then
      raise exception 'not a staff inbox recipient';
    end if;
  elsif v_doc.forwarded_to_id is distinct from v_uid
     and not public.is_admin()
     and not public.is_dev() then
    raise exception 'not forwarded to you';
  end if;

  update public.documents set
    status = 'awaiting_submit',
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

-- จนท. อัปเดตสถานะ awaiting_submit → completed ได้เมื่ออัปฉบับประทับ
drop policy if exists documents_update_awaiting_submit on public.documents;
create policy documents_update_awaiting_submit on public.documents for update
  using (
    status = 'awaiting_submit'
    and exists (
      select 1 from public.users u
      where u.auth_uid = auth.uid()
        and u.role_code in ('ROLE-STF', 'ROLE-SYS', 'ROLE-DEV')
        and coalesce(u.is_active, true)
    )
  )
  with check (true);

-- ── forward_decline: รองรับคิวกลุ่ม ────────────────────────────────────────
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

  if exists (
    select 1 from public.document_history h
    where h.document_id = p_doc
      and h.action = 'เจ้าหน้าที่รับเอกสาร'
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
