-- The frontend (auth.js login expiry check, admin.js approve/renew/expired-badge)
-- has always assumed public.users has an expires_at column for กนค. 1-year
-- account expiry, but it was never created in the live schema — silently
-- broke "อนุมัติบัญชี" for every กนค. user once dp()/dpa() started throwing
-- on real PostgREST errors instead of swallowing them.
-- Run manually in the Supabase Dashboard SQL Editor. Idempotent.

alter table public.users
  add column if not exists expires_at timestamptz;
