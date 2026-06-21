-- ============================================================================
-- SAEDU Flow — close the document_history impersonation gap
-- Run this in: Supabase Dashboard → SQL Editor → New query → Run
-- Uses your own dashboard session (DB owner) — never needs the service_role key.
-- Safe to re-run (drop + create policy).
-- ============================================================================
--
-- Problem this fixes:
-- migration_auth_rls.sql's `document_history_insert` policy only checked
-- `auth.uid() is not null` — it never verified that the `performed_by` value
-- in the row being inserted actually matches the caller. Any authenticated
-- user could write a history row claiming a DIFFERENT user performed an
-- action ("ลบบัญชีผู้ใช้", "อนุมัติ / ลงนาม", etc.), undermining the audit
-- trail's whole purpose. Checked every dp('document_history', ...) call site
-- in the app (auth.js, admin.js, docDetail.js, docNum.js, docForm.js) — all
-- of them already set performed_by:CU.id, so this tightening doesn't change
-- any legitimate behavior, it just makes the existing convention mandatory.

drop policy if exists document_history_insert on public.document_history;
create policy document_history_insert on public.document_history for insert
  with check (performed_by = (select id from public.current_profile()));

-- ── notifications: deliberately NOT tightened the same way ────────────────
-- notifications has no actor/performed-by column to check against, so there
-- is no analogous identity-spoofing fix available. A document-participant
-- scoping (like document_files got) was considered but rejected: auth.js's
-- doLogin calls sendOverdueNotifs() (notif.js) once per browser per day on
-- EVERY login, which scans ALL system-wide overdue documents and inserts
-- notifications for them — regardless of whether the user who happened to
-- log in that day is a participant on any given overdue document. Scoping
-- the insert policy to document participants would silently break overdue
-- emails for any document the logging-in user isn't involved with, which is
-- most of them. Leaving notifications_insert as `auth.uid() is not null`
-- (unchanged from migration_auth_rls.sql) is the correct tradeoff until the
-- overdue-check mechanism itself is redesigned (e.g. as a scheduled Edge
-- Function instead of riding on whoever happens to log in).
