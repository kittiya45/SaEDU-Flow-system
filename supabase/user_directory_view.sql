-- ============================================================================
-- SAEDU Flow — user_directory view (post-RLS follow-up fix)
-- Run this in: Supabase Dashboard → SQL Editor → New query → Run
-- Uses your own dashboard session (DB owner) — never needs the service_role key.
-- Safe to re-run (create or replace).
-- ============================================================================
--
-- Problem this fixes:
-- migration_auth_rls.sql's `users_select` policy only lets a logged-in user
-- see their OWN row (or any row if is_admin()). But the app treats `users`
-- as an internal directory too — e.g. docForm.js builds the "เลือกผู้ตรวจ/
-- ผู้ลงนาม" dropdown from ALL active users, docDetail.js's forward-modal lists
-- all ROLE-STF/ROLE-ADV users, and many screens batch-resolve other people's
-- full_name for display (document creator, workflow assignee, file uploader,
-- forward recipient...). Once RLS is actually enabled, every one of those
-- queries returns [] for any caller who isn't ROLE-SYS/ROLE-STF, because
-- they're reading rows that aren't their own. That breaks document creation
-- and a dozen other screens for every non-admin role.
--
-- Fix: a narrow view exposing only directory-safe columns (no email/password
-- hash/auth_uid), owned by the same role that owns `public.users` (the
-- Dashboard SQL editor role). Views are not subject to the underlying
-- table's RLS policies when queried by a role other than the table owner —
-- only the view owner's privileges apply — so this view sees every row
-- regardless of who's asking, while only ever returning the columns listed
-- below. That's strictly narrower than how `users` behaved before the RLS
-- migration (anon could read every column, including password_hash, directly).

create or replace view public.user_directory as
  select
    id, full_name, email, contact_email,
    role_code, position_code, department,
    is_active, approval_status
  from public.users;

grant select on public.user_directory to authenticated;

-- Verify: as a non-admin logged-in user (not via the Dashboard owner role),
-- this should return rows for OTHER people too, not just your own:
--   curl "<SUPABASE_URL>/rest/v1/user_directory?select=id,full_name&limit=5" \
--        -H "apikey: <anon key>" -H "Authorization: Bearer <some non-admin user's JWT>"
