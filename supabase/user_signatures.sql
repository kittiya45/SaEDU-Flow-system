-- ============================================================================
-- SAEDU Flow — ลายเซ็นส่วนตัว (1 รายการต่อผู้ใช้)
-- Run in Supabase Dashboard → SQL Editor (หลัง migration_auth_rls.sql)
-- Safe to re-run.
-- ============================================================================
--
-- เก็บ path อ้างอิงใน users + ไฟล์ PNG ใน bucket ส่วนตัว user-signatures
-- ไม่ใส่ใน user_directory view — คนอื่นอ่านลายเซ็นไม่ได้

alter table public.users add column if not exists signature_path text;
alter table public.users add column if not exists signature_updated_at timestamptz;

insert into storage.buckets (id, name, public)
values ('user-signatures', 'user-signatures', false)
on conflict (id) do update set public = false;

drop policy if exists user_signatures_select on storage.objects;
drop policy if exists user_signatures_insert on storage.objects;
drop policy if exists user_signatures_update on storage.objects;
drop policy if exists user_signatures_delete on storage.objects;

create policy user_signatures_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'user-signatures'
    and (storage.foldername(name))[1] = (select id::text from public.current_profile())
  );

create policy user_signatures_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'user-signatures'
    and (storage.foldername(name))[1] = (select id::text from public.current_profile())
  );

create policy user_signatures_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'user-signatures'
    and (storage.foldername(name))[1] = (select id::text from public.current_profile())
  )
  with check (
    bucket_id = 'user-signatures'
    and (storage.foldername(name))[1] = (select id::text from public.current_profile())
  );

create policy user_signatures_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'user-signatures'
    and (storage.foldername(name))[1] = (select id::text from public.current_profile())
  );
