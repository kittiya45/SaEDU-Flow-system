-- ============================================================================
-- SAEDU Flow — Let GNK-SEC (เลขานุการ) manage form_templates, matching the
-- client-side check already in templates.js
-- Run this entire file in: Supabase Dashboard → SQL Editor → New query → Run
--
-- Bug fixed: templates.js gates the "อัปโหลดแบบฟอร์ม"/edit/delete buttons with
--   CU.role_code in ('ROLE-SYS','ROLE-STF') OR CU.position_code==='GNK-SEC'
-- but the DB-side form_templates_write policy (migration_auth_rls.sql) only
-- checked is_admin(), which is role_code in ('ROLE-SYS','ROLE-STF') — it never
-- included the GNK-SEC carve-out. A เลขานุการ with the default ROLE-CRT role
-- could see and click the buttons, but every write was silently rejected by
-- RLS (0 rows affected / permission denied).
--
-- Scoped narrowly to form_templates only — does NOT touch is_admin() itself,
-- so GNK-SEC still has no access to doc_number_settings, doc_types, projects,
-- or any other is_admin()-gated table.
-- Safe to re-run (drop + create).
-- ============================================================================

create or replace function public.is_template_manager()
returns boolean
language sql stable security definer
as $$
  select public.is_admin() or exists (
    select 1 from public.users
    where auth_uid = auth.uid() and position_code = 'GNK-SEC'
  );
$$;

drop policy if exists form_templates_write on public.form_templates;
create policy form_templates_write on public.form_templates for all
  using (public.is_template_manager()) with check (public.is_template_manager());
