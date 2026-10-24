-- Apply after 55 and 60. Transactional and rerunnable. No data is deleted.
-- Test on staging first: self-service profile updates must work; self-promotion
-- and API calls by pending/disabled/expired users must fail.
begin;

create or replace function public.current_profile()
returns public.users language sql stable security definer
set search_path = public
as $$
  select u.* from public.users u where u.auth_uid = auth.uid()
    and u.is_active is true and u.approval_status = 'approved'
    and (u.expires_at is null or u.expires_at > now()) limit 1;
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.current_profile() p
    where p.role_code in ('ROLE-SYS', 'ROLE-STF'));
$$;

create or replace function public.is_dev()
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.current_profile() p where p.role_code = 'ROLE-DEV');
$$;

-- RLS on users permits own-row updates; it does not protect individual columns.
create or replace function public.guard_user_security_fields()
returns trigger language plpgsql security definer set search_path = public
as $$
declare caller_role text;
begin
  -- Trusted SQL maintenance and service-role jobs retain their existing access.
  if auth.role() = 'service_role' or
     (auth.uid() is null and session_user in ('postgres', 'supabase_admin')) then
    return new;
  end if;
  -- link_auth_user() (on auth.users insert, run by GoTrue as supabase_auth_admin) links a
  -- signup to an existing profile row by email via ON CONFLICT DO UPDATE. Allow exactly that:
  -- filling an empty auth_uid, nothing else.
  if session_user = 'supabase_auth_admin' and auth.uid() is null and old.auth_uid is null
     and (to_jsonb(new) - 'auth_uid') = (to_jsonb(old) - 'auth_uid') then
    return new;
  end if;
  select p.role_code into caller_role from public.current_profile() p;
  if caller_role in ('ROLE-SYS', 'ROLE-STF') then return new; end if;
  if caller_role = 'ROLE-DEV' and old.role_code <> 'ROLE-SYS' and new.role_code <> 'ROLE-SYS' then
    return new;
  end if;
  -- Allowlist self-service columns; new schema columns are protected by default.
  if caller_role is null or old.auth_uid is distinct from auth.uid() or
     (to_jsonb(new) - array['contact_email','phone','avatar_path','signature_path',
        'signature_updated_at','line_link_code','line_link_code_expires_at','line_user_id'])
       is distinct from
     (to_jsonb(old) - array['contact_email','phone','avatar_path','signature_path',
        'signature_updated_at','line_link_code','line_link_code_expires_at','line_user_id']) then
    raise exception 'Not authorized to change account security fields' using errcode = '42501';
  end if;
  if (new.line_user_id is distinct from old.line_user_id and new.line_user_id is not null)
     or (new.signature_path is distinct from old.signature_path and new.signature_path is not null
         and split_part(new.signature_path, '/', 1) <> old.id::text)
     or ((to_jsonb(new)->>'avatar_path') is distinct from (to_jsonb(old)->>'avatar_path')
         and (to_jsonb(new)->>'avatar_path') is not null
         and split_part(to_jsonb(new)->>'avatar_path', '/', 1) <> old.id::text) then
    raise exception 'Invalid profile asset or LINE account assignment' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_user_security_fields() from public, anon, authenticated;
drop trigger if exists users_security_fields on public.users;
create trigger users_security_fields before update on public.users
for each row execute function public.guard_user_security_fields();

-- Restrictive policies AND with existing policies, preventing a permissive old
-- policy from granting access to a pending, disabled, or expired account.
do $$
declare t text;
begin
  foreach t in array array['documents','document_files','workflow_steps','document_history',
    'notifications','document_acks','form_templates','calendar_events','projects',
    'system_logs','email_templates','workflow_templates','workflow_template_steps',
    'doc_types','doc_type_fields','doc_number_settings'] loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I enable row level security', t);
      execute format('drop policy if exists active_account_required on public.%I', t);
      execute format('create policy active_account_required on public.%I as restrictive for all to authenticated using ((select id from public.current_profile()) is not null) with check ((select id from public.current_profile()) is not null)', t);
    end if;
  end loop;
end;
$$;
drop policy if exists active_account_required on storage.objects;
create policy active_account_required on storage.objects as restrictive
for all to authenticated
using ((select id from public.current_profile()) is not null)
with check ((select id from public.current_profile()) is not null);

-- pg_cron reads this as the database owner; no browser account needs the value.
-- Restrictive prevents app_settings_select / admin FOR ALL from exposing it.
drop policy if exists hide_server_secrets on public.app_settings;
create policy hide_server_secrets on public.app_settings as restrictive
for select to anon, authenticated using (key <> 'overdue_cron_secret');

commit;
