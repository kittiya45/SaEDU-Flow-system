-- ============================================================================
-- SAEDU Flow — create the admin-config tables the frontend already expects
-- Run this entire file in: Supabase Dashboard → SQL Editor → New query → Run
-- Uses your own dashboard session (DB owner) — never needs the service_role key.
-- Safe to re-run (idempotent: create-if-not-exists tables, drop+create policies).
-- ============================================================================
--
-- Problem this fixes:
-- sysAdmin.js's "ตั้งค่าระบบ" / "แบบฟอร์มอีเมล" / "เทมเพลต workflow" cards (plus
-- docForm.js's _applyWfTemplate, notif.js's email-template lookup, and
-- config.js's loadAppSettings) all call dg()/dp() against app_settings,
-- email_templates, workflow_templates and workflow_template_steps — but none
-- of those four tables exist in this project. Every call is wrapped in
-- try/catch so it silently no-ops; the UI renders but nothing ever persists.
-- This script creates the tables with the exact columns those call sites
-- read/write, then RLS-enables them in the same shot (no separate cutover
-- step needed, unlike enable_rls.sql — there's no pre-existing anon-key-only
-- frontend reading these specific tables today).
--
-- Read access: any logged-in user (loadAppSettings runs for everyone after
-- login; docForm.js reads workflow_templates for any doc creator; notif.js
-- reads email_templates when any user's action triggers a notification).
-- Write access: is_admin() only (ROLE-SYS / ROLE-STF), matching doc_types.

-- app_settings ---------------------------------------------------------------
create table if not exists public.app_settings (
  key         text primary key,
  value       text,
  label       text,
  value_type  text not null default 'text'
                check (value_type in ('text','number','boolean','json')),
  updated_by  uuid references public.users(id),
  updated_at  timestamptz not null default now()
);
alter table public.app_settings enable row level security;

drop policy if exists app_settings_select on public.app_settings;
create policy app_settings_select on public.app_settings for select
  using (auth.uid() is not null);
drop policy if exists app_settings_write on public.app_settings;
create policy app_settings_write on public.app_settings for all
  using (public.is_admin()) with check (public.is_admin());

-- email_templates --------------------------------------------------------------
create table if not exists public.email_templates (
  key             text primary key,
  label           text,
  subject_suffix  text,
  extra_note      text,
  updated_by      uuid references public.users(id),
  updated_at      timestamptz not null default now()
);
alter table public.email_templates enable row level security;

drop policy if exists email_templates_select on public.email_templates;
create policy email_templates_select on public.email_templates for select
  using (auth.uid() is not null);
drop policy if exists email_templates_write on public.email_templates;
create policy email_templates_write on public.email_templates for all
  using (public.is_admin()) with check (public.is_admin());

-- workflow_templates -----------------------------------------------------------
create table if not exists public.workflow_templates (
  id          uuid primary key default gen_random_uuid(),
  doc_type    text not null
                check (doc_type in ('incoming','outgoing','certificate','memo')),
  name        text not null,
  is_default  boolean not null default false,
  created_by  uuid references public.users(id),
  created_at  timestamptz not null default now()
);
alter table public.workflow_templates enable row level security;

drop policy if exists workflow_templates_select on public.workflow_templates;
create policy workflow_templates_select on public.workflow_templates for select
  using (auth.uid() is not null);
drop policy if exists workflow_templates_write on public.workflow_templates;
create policy workflow_templates_write on public.workflow_templates for all
  using (public.is_admin()) with check (public.is_admin());

-- workflow_template_steps ------------------------------------------------------
create table if not exists public.workflow_template_steps (
  id             uuid primary key default gen_random_uuid(),
  template_id    uuid not null references public.workflow_templates(id) on delete cascade,
  step_number    int not null,
  step_name      text not null,
  role_required  text default '',
  assigned_to    uuid references public.users(id),
  deadline_days  int not null default 2,
  locked         boolean not null default false
);
alter table public.workflow_template_steps enable row level security;

drop policy if exists workflow_template_steps_select on public.workflow_template_steps;
create policy workflow_template_steps_select on public.workflow_template_steps for select
  using (auth.uid() is not null);
drop policy if exists workflow_template_steps_write on public.workflow_template_steps;
create policy workflow_template_steps_write on public.workflow_template_steps for all
  using (public.is_admin()) with check (public.is_admin());
