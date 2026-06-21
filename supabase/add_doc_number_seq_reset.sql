-- ============================================================================
-- SAEDU Flow — Add seq_reset_at to doc_number_settings
-- Run this entire file in: Supabase Dashboard → SQL Editor → New query → Run
--
-- Lets an admin force the official document-numbering sequence (issued via
-- the "ออกเลขหนังสือ" button, computed by _nextDocNum() in docNum.js) to
-- restart at 001 for every category (semester+position+letter-type[+club])
-- mid-year, instead of waiting for the automatic reset at the next
-- calendar-year boundary. _nextDocNum() will use the later of
-- (Jan 1 of the current Thai year) and this column's value as the cutoff
-- for which existing documents still count toward the running sequence.
--
-- No RLS change needed — doc_number_settings_all (gated by is_admin()) in
-- migration_auth_rls.sql already covers this new column.
-- Safe to re-run (idempotent ADD COLUMN IF NOT EXISTS).
-- ============================================================================

alter table public.doc_number_settings
  add column if not exists seq_reset_at timestamptz;
