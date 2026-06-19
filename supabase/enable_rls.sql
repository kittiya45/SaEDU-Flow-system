-- ============================================================================
-- SAEDU Flow — flip RLS on (Phase D cutover step)
-- Run ONLY after: migration_auth_rls.sql has been run, the backfill script has
-- created + linked auth accounts for everyone, and you've confirmed a couple
-- of test logins work end-to-end with the NEW frontend (Phase B code).
--
-- Run this in the SAME window as deploying the new frontend. The moment this
-- finishes, the OLD frontend (anon-key-only login) stops working for
-- everyone — that is the point. Do this at a low-traffic time.
-- ============================================================================

alter table public.users enable row level security;
alter table public.documents enable row level security;
alter table public.document_files enable row level security;
alter table public.workflow_steps enable row level security;
alter table public.document_history enable row level security;
alter table public.notifications enable row level security;
alter table public.form_templates enable row level security;
alter table public.calendar_events enable row level security;
alter table public.projects enable row level security;
alter table public.doc_types enable row level security;
alter table public.doc_type_fields enable row level security;
alter table public.doc_number_settings enable row level security;
-- workflow_templates, workflow_template_steps, email_templates, app_settings
-- intentionally omitted — these tables don't exist in this project (see the
-- note in migration_auth_rls.sql). Nothing to enable RLS on.

-- Verify immediately after running this: from a terminal with NO login,
-- using only the public anon key, this should now return an empty array
-- or a 401/403 — NOT real user data:
--   curl "<SUPABASE_URL>/rest/v1/users?select=*" -H "apikey: <anon key>"
