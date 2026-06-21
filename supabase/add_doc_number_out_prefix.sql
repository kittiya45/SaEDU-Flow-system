-- ============================================================================
-- SAEDU Flow — Add out_prefix to doc_number_settings
-- Run this entire file in: Supabase Dashboard → SQL Editor → New query → Run
--
-- Lets an admin customize the org prefix used in the temporary outgoing
-- doc_number assigned at document creation (genOutDocNumber() in docForm.js,
-- format "{out_prefix}{thaiYear}.{NN}"), the same way doc_number_settings.
-- prefix already customizes the incoming side (genDocNumber()). Previously
-- the outgoing prefix was hardcoded to "กนค." with no admin override.
--
-- Does NOT affect the official/final document number issued via the
-- "ออกเลขหนังสือ" button (_nextDocNum() in docNum.js) — that format's
-- "กนค. " prefix is a fixed bureaucratic numbering convention shared by
-- both incoming and outgoing, intentionally left untouched here.
--
-- No RLS change needed — doc_number_settings_all (gated by is_admin()) in
-- migration_auth_rls.sql already covers this new column.
-- Safe to re-run (idempotent ADD COLUMN IF NOT EXISTS).
-- ============================================================================

alter table public.doc_number_settings
  add column if not exists out_prefix text;
