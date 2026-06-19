-- ============================================================================
-- SAEDU Flow — Migrate to real Supabase Auth + enable RLS
-- Run this entire file in: Supabase Dashboard → SQL Editor → New query → Run
-- Uses your own dashboard session (DB owner) — never needs the service_role key.
-- Safe to run now: this script creates policies but does NOT enable RLS on
-- any table (see enable_rls.sql, a separate file, for that — run it later,
-- only once accounts are backfilled & verified per Phase D of the plan).
-- The live app keeps working exactly as before until enable_rls.sql runs.
-- ============================================================================

-- ── STEP 0: duplicate-email audit — MUST be empty before continuing ─────────
-- If this returns any rows, fix those duplicates first (the linking trigger
-- in step 3 matches accounts by email, so duplicates would link incorrectly).
select email, count(*) from public.users group by email having count(*) > 1;
-- ^ run this separately first and confirm 0 rows before running the rest.


-- ── STEP 1: linking column ───────────────────────────────────────────────
-- on delete set null: lets admin-delete-user (Edge Function) remove the
-- auth.users row in either order relative to the public.users row, without
-- the FK blocking it.
alter table public.users add column if not exists auth_uid uuid unique references auth.users(id) on delete set null;

-- case-insensitive unique index on email, required for the trigger's
-- "on conflict" matching to be reliable regardless of how email was typed.
create unique index if not exists users_email_lower_idx on public.users (lower(email));

-- registration no longer pre-checks "is this student_id already used" client
-- side (anon can't read the users table anymore — that's the whole point of
-- this migration). Enforce it here instead: a duplicate now fails the whole
-- signUp() server-side (the insert trigger raises, rolling back the
-- newly-created auth.users row too), surfaced to the client as an error.
create unique index if not exists users_student_id_idx on public.users (student_id) where student_id is not null;


-- ── STEP 2: helper — find the public.users row for the current request ────
create or replace function public.current_profile()
returns public.users
language sql stable security definer
as $$
  select * from public.users where auth_uid = auth.uid() limit 1;
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer
as $$
  select exists (
    select 1 from public.users
    where auth_uid = auth.uid() and role_code in ('ROLE-SYS','ROLE-STF')
  );
$$;

-- Login currently accepts either student_id or email (auth.js). A brand new
-- anonymous caller can't be given a broad SELECT on users just to resolve
-- this, so expose only this narrow lookup as an RPC instead.
create or replace function public.resolve_login_email(identifier text)
returns text
language sql stable security definer
as $$
  select coalesce(
    (select email from public.users where student_id = identifier limit 1),
    identifier
  );
$$;

grant execute on function public.resolve_login_email(text) to anon, authenticated;


-- ── STEP 3: link new/backfilled auth.users rows to public.users by email ───
-- Reads everything from raw_user_meta_data (passed via supabase.auth.signUp's
-- options.data, or via the Admin API's user_metadata during backfill) so a
-- brand-new self-registration is fully populated at insert time — no
-- follow-up "patch after signup" step needed, which would otherwise depend
-- on email-confirmation being disabled to have an active session available.
create or replace function public.link_auth_user()
returns trigger
language plpgsql security definer
as $$
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
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.link_auth_user();


-- ── STEP 4: RLS policies ─────────────────────────────────────────────────
-- Tiering, by design (see plan doc for the full rationale):
--  • users: precise — own row, or is_admin() for all rows.
--  • admin-only config tables: precise — is_admin() gates writes.
--  • document workflow tables (documents, document_files, workflow_steps,
--    document_history, notifications, projects, doc_types, doc_type_fields,
--    form_templates, calendar_events): SELECT open to any authenticated
--    user (matches existing app behavior — these are fetched in full and
--    filtered client-side today, there is no per-row secrecy intended
--    between logged-in members). WRITE gated by authentication, with
--    ownership checks (created_by/uploaded_by/performed_by = self) added
--    where the app already enforces that distinction client-side
--    (e.g. calendar_events delete, documents delete-own-draft).
--    This closes the critical hole (anonymous access) without risking
--    breaking the live multi-step approval workflow by over-encoding every
--    role transition rule on day one. Tightening write rules further is a
--    safe follow-up once this baseline is proven in production.

-- users ----------------------------------------------------------------
drop policy if exists users_select on public.users;
create policy users_select on public.users for select
  using (auth_uid = auth.uid() or public.is_admin());
drop policy if exists users_update on public.users;
create policy users_update on public.users for update
  using (auth_uid = auth.uid() or public.is_admin());
drop policy if exists users_delete on public.users;
create policy users_delete on public.users for delete
  using (public.is_admin());
-- no insert policy: new rows are only created by the security-definer
-- trigger above (signUp / admin backfill), which bypasses RLS.

-- documents --------------------------------------------------------------
drop policy if exists documents_select on public.documents;
create policy documents_select on public.documents for select using (auth.uid() is not null);
drop policy if exists documents_insert on public.documents;
create policy documents_insert on public.documents for insert
  with check (created_by = (select id from public.current_profile()));
drop policy if exists documents_update on public.documents;
create policy documents_update on public.documents for update using (auth.uid() is not null);
drop policy if exists documents_delete on public.documents;
create policy documents_delete on public.documents for delete
  using (created_by = (select id from public.current_profile()) or public.is_admin());

-- document_files -----------------------------------------------------------
drop policy if exists document_files_all on public.document_files;
create policy document_files_all on public.document_files for all
  using (auth.uid() is not null) with check (auth.uid() is not null);

-- workflow_steps -----------------------------------------------------------
drop policy if exists workflow_steps_all on public.workflow_steps;
create policy workflow_steps_all on public.workflow_steps for all
  using (auth.uid() is not null) with check (auth.uid() is not null);

-- document_history (insert-only from the app; never updated/deleted) -------
drop policy if exists document_history_select on public.document_history;
create policy document_history_select on public.document_history for select using (auth.uid() is not null);
drop policy if exists document_history_insert on public.document_history;
create policy document_history_insert on public.document_history for insert
  with check (auth.uid() is not null);
-- no update/delete policy: history rows are immutable (app already enforces
-- this client-side via _PROTECTED_TABLES in config.js — now enforced for real).

-- notifications --------------------------------------------------------------
drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications for select using (auth.uid() is not null);
drop policy if exists notifications_insert on public.notifications;
create policy notifications_insert on public.notifications for insert
  with check (auth.uid() is not null);
-- no update/delete: same immutable-log reasoning as document_history.

-- form_templates -------------------------------------------------------------
drop policy if exists form_templates_select on public.form_templates;
create policy form_templates_select on public.form_templates for select using (auth.uid() is not null);
drop policy if exists form_templates_write on public.form_templates;
create policy form_templates_write on public.form_templates for all
  using (public.is_admin()) with check (public.is_admin());

-- calendar_events ------------------------------------------------------------
drop policy if exists calendar_events_select on public.calendar_events;
create policy calendar_events_select on public.calendar_events for select using (auth.uid() is not null);
drop policy if exists calendar_events_insert on public.calendar_events;
create policy calendar_events_insert on public.calendar_events for insert
  with check (created_by = (select id from public.current_profile()));
drop policy if exists calendar_events_delete on public.calendar_events;
create policy calendar_events_delete on public.calendar_events for delete
  using (created_by = (select id from public.current_profile()) or public.is_admin());

-- projects ---------------------------------------------------------------
drop policy if exists projects_select on public.projects;
create policy projects_select on public.projects for select using (auth.uid() is not null);
drop policy if exists projects_write on public.projects;
create policy projects_write on public.projects for all
  using (public.is_admin()) with check (public.is_admin());

-- doc_types / doc_type_fields (admin-managed, read by everyone) -----------
drop policy if exists doc_types_select on public.doc_types;
create policy doc_types_select on public.doc_types for select using (auth.uid() is not null);
drop policy if exists doc_types_write on public.doc_types;
create policy doc_types_write on public.doc_types for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists doc_type_fields_select on public.doc_type_fields;
create policy doc_type_fields_select on public.doc_type_fields for select using (auth.uid() is not null);
drop policy if exists doc_type_fields_write on public.doc_type_fields;
create policy doc_type_fields_write on public.doc_type_fields for all
  using (public.is_admin()) with check (public.is_admin());

-- workflow_templates / workflow_template_steps, email_templates, app_settings:
-- SKIPPED — these tables don't actually exist in this Supabase project yet.
-- The frontend code calls them (sysAdmin.js, docForm.js, notif.js, config.js)
-- but every call site wraps the result in try/catch and silently no-ops on
-- failure, so "จัดการระบบ" → ตั้งค่าระบบ/แบบฟอร์มอีเมล/เทมเพลต workflow have been
-- non-functional dead UI this whole time (defaults are used instead). Not
-- something this migration introduced — found it while running this script.
-- Not creating these tables here since that's a separate, unrelated feature
-- gap; flagging it back to you to decide if/when it's worth building.

-- doc_number_settings (admin-only, both ways) ------------------------------
drop policy if exists doc_number_settings_all on public.doc_number_settings;
create policy doc_number_settings_all on public.doc_number_settings for all
  using (public.is_admin()) with check (public.is_admin());


-- ── DONE — but RLS is NOT enabled yet ────────────────────────────────────
-- This script only created the policies above; it did NOT run
-- "alter table ... enable row level security" for any table, so nothing
-- about the live app changes yet. Policies sit dormant until enabled.
--
-- Next: run the Phase D backfill (creates real Supabase Auth accounts for
-- everyone, linked via the trigger above), verify a couple of test logins
-- work end-to-end, THEN run enable_rls.sql together with deploying the new
-- frontend in the same window. Flipping RLS on without the new frontend
-- deployed (or vice versa) will show an empty app to real users.
