\set ON_ERROR_STOP on
-- Isolated database only: creates a minimal schema with deliberately broad policies.
do $$ begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon; end if; end $$;
do $$ begin if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if; end $$;
do $$ begin if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role bypassrls; end if; end $$;
create schema auth;
create schema storage;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create function auth.role() returns text language sql stable as $$ select nullif(current_setting('request.jwt.claim.role',true),'') $$;
create table public.users (id uuid primary key, auth_uid uuid, role_code text, is_active boolean,
  approval_status text, expires_at timestamptz, email text, contact_email text, phone text,
  avatar_path text, signature_path text, signature_updated_at timestamptz,
  line_user_id text, line_link_code text, line_link_code_expires_at timestamptz);
create table public.app_settings(key text primary key, value text);
insert into public.app_settings values ('overdue_cron_secret','test-secret'),('app_name','Test');
alter table public.app_settings enable row level security;
create policy broad_old_policy on public.app_settings for all using(true);
grant select on public.app_settings to anon, authenticated;
create table public.documents(id int primary key, title text);
create table storage.objects(id int primary key);
insert into documents values (1,'private');
insert into storage.objects values (1);
insert into users(id,auth_uid,role_code,is_active,approval_status,email) values
('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','ROLE-CRT',true,'approved','a@example.test'),
('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002','ROLE-SYS',true,'approved','admin@example.test'),
('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000003','ROLE-DEV',true,'approved','dev@example.test');
grant usage on schema public,auth,storage to authenticated;
grant select,update on users to authenticated;
grant select,insert,update,delete on documents,storage.objects to authenticated;
alter table users enable row level security;
alter table documents enable row level security;
alter table storage.objects enable row level security;
create policy own_profile on users for all to authenticated using(auth_uid=auth.uid());
create policy broad_old_policy on documents for all to authenticated using(true) with check(true);
create policy broad_old_policy on storage.objects for all to authenticated using(true) with check(true);
\ir ../../supabase/61_security_access_guards.sql
\ir ../../supabase/61_security_access_guards.sql
set role authenticated;
select set_config('request.jwt.claim.role','authenticated',false);
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
do $$ begin
  if (select count(*) from app_settings where key='overdue_cron_secret') <> 0 then raise exception 'cron secret leaked'; end if;
  if (select count(*) from app_settings where key='app_name') <> 1 then raise exception 'public setting unavailable'; end if;
  update users set contact_email='new@example.test' where auth_uid=auth.uid();
  if (select count(*) from documents) <> 1 then raise exception 'active read failed'; end if;
  begin
    update users set role_code='ROLE-SYS' where auth_uid=auth.uid();
    raise exception 'self promotion allowed';
  exception when insufficient_privilege then null; end;
  begin
    update users set auth_uid='00000000-0000-0000-0000-000000000002' where auth_uid=auth.uid();
    raise exception 'identity change allowed';
  exception when insufficient_privilege then null; end;
  begin
    update users set line_user_id='forged-line-id' where auth_uid=auth.uid();
    raise exception 'forged LINE account allowed';
  exception when insufficient_privilege then null; end;
  begin
    update users set signature_path='other-user/signature.png' where auth_uid=auth.uid();
    raise exception 'foreign signature allowed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub','',false);
update users set is_active=false where id='00000000-0000-0000-0000-000000000001';
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
do $$ begin
  if (select count(*) from documents) <> 0 or (select count(*) from storage.objects) <> 0 then
    raise exception 'disabled user can read'; end if;
  begin
    insert into documents values (2,'attack'); raise exception 'disabled user can write';
  exception when insufficient_privilege then null; end;
  begin
    update users set is_active=true where auth_uid=auth.uid(); raise exception 'self reactivation allowed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub','',false);
update users set is_active=true, approval_status='pending' where id='00000000-0000-0000-0000-000000000001';
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
do $$ begin if (select count(*) from documents) <> 0 then raise exception 'pending read allowed'; end if; end $$;
reset role;
select set_config('request.jwt.claim.sub','',false);
update users set approval_status='approved', expires_at=now()-interval '1 day' where id='00000000-0000-0000-0000-000000000001';
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
do $$ begin if (select count(*) from documents) <> 0 then raise exception 'expired read allowed'; end if; end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
do $$ begin if not public.is_admin() then raise exception 'admin denied'; end if; end $$;
reset role;
select set_config('request.jwt.claim.sub','',false);
update users set is_active=false where role_code='ROLE-SYS';
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
do $$ begin if public.is_admin() then raise exception 'disabled admin allowed'; end if; end $$;
reset role;
select 'PASS: profile escalation, forged identity, pending/disabled/expired users, storage, admin checks, idempotency' as result;
