-- Adds a privacy toggle to calendar_events: a custom event can now be
-- created as private (visible only to its creator, or an admin) or public
-- (visible to every logged-in user — the only behavior that existed before
-- this script). Run manually in the Supabase Dashboard SQL Editor.
-- Idempotent — safe to re-run.

alter table public.calendar_events
  add column if not exists is_private boolean not null default false;

drop policy if exists calendar_events_select on public.calendar_events;
create policy calendar_events_select on public.calendar_events for select
  using (
    is_private is false
    or created_by = (select id from public.current_profile())
    or public.is_admin()
  );
