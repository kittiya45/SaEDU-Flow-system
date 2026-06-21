-- ============================================================================
-- SAEDU Flow — tighten write RLS on documents / workflow_steps / document_files
-- Run this in: Supabase Dashboard → SQL Editor → New query → Run
-- Uses your own dashboard session (DB owner) — never needs the service_role key.
-- Safe to re-run (drop + create policies).
-- ============================================================================
--
-- Problem this fixes:
-- migration_auth_rls.sql's policies for documents (update), workflow_steps
-- (all) and document_files (all) only checked `auth.uid() is not null` — ANY
-- logged-in user, including the lowest-privilege role (ROLE-CRT), could call
-- the REST API directly (bypassing the app's client-side CAN.* checks) to:
--   - edit/change the status of someone else's document
--   - mark another person's workflow_steps row 'done'/'rejected' (forge a
--     signature/approval) or insert fake steps
--   - attach/delete document_files on any document
-- The app's actual authorization for these actions lived entirely client-
-- side. This migration adds real server-side scoping: a caller may only
-- write to a document's rows if they are the document's creator, its
-- current forwarded_to_id holder, a participant somewhere in its
-- workflow_steps (assigned_to or rejected_by on any step, any status), or
-- is_admin(). This matches every actual write call site in the app today
-- (verified against admin.js, docForm.js, docDetail.js, docNum.js,
-- workflow.js, editor.js) — it does not add new restrictions beyond what
-- the client-side CAN.* checks already enforced, it just makes them real.

-- documents --------------------------------------------------------------
drop policy if exists documents_update on public.documents;
create policy documents_update on public.documents for update
  using (
    public.is_admin()
    or created_by = (select id from public.current_profile())
    or forwarded_to_id = (select id from public.current_profile())
    or exists (
      select 1 from public.workflow_steps ws
      where ws.document_id = documents.id
        and (ws.assigned_to = (select id from public.current_profile())
             or ws.rejected_by = (select id from public.current_profile()))
    )
  );
-- documents_select / documents_insert / documents_delete unchanged from
-- migration_auth_rls.sql — already scoped correctly.

-- workflow_steps -----------------------------------------------------------
drop policy if exists workflow_steps_all on public.workflow_steps;

create policy workflow_steps_select on public.workflow_steps for select
  using (auth.uid() is not null);

-- insert: only the parent document's creator may add steps (happens once,
-- at document creation, in docForm.js).
create policy workflow_steps_insert on public.workflow_steps for insert
  with check (
    public.is_admin()
    or exists (
      select 1 from public.documents d
      where d.id = workflow_steps.document_id
        and d.created_by = (select id from public.current_profile())
    )
  );

-- update: the doc's creator, its current forwarded_to_id holder (needed for
-- doDeclineFwd's bulk step reset in docDetail.js), or anyone who is
-- assigned_to/rejected_by on ANY step of this same document (covers
-- approve/reject advancing a DIFFERENT row than the one the actor is
-- assigned to — e.g. approving step N activates step N+1, which belongs to
-- someone else; the actor's authority comes from being a participant in
-- this document's workflow at all, not from owning that specific row).
create policy workflow_steps_update on public.workflow_steps for update
  using (
    public.is_admin()
    or exists (
      select 1 from public.documents d
      where d.id = workflow_steps.document_id
        and (d.created_by = (select id from public.current_profile())
             or d.forwarded_to_id = (select id from public.current_profile()))
    )
    or exists (
      select 1 from public.workflow_steps ws2
      where ws2.document_id = workflow_steps.document_id
        and (ws2.assigned_to = (select id from public.current_profile())
             or ws2.rejected_by = (select id from public.current_profile()))
    )
  );
-- no delete policy: app never deletes workflow_steps rows directly.

-- document_files -----------------------------------------------------------
drop policy if exists document_files_all on public.document_files;

create policy document_files_select on public.document_files for select
  using (auth.uid() is not null);

create policy document_files_insert on public.document_files for insert
  with check (
    public.is_admin()
    or exists (
      select 1 from public.documents d
      where d.id = document_files.document_id
        and (d.created_by = (select id from public.current_profile())
             or d.forwarded_to_id = (select id from public.current_profile()))
    )
    or exists (
      select 1 from public.workflow_steps ws
      where ws.document_id = document_files.document_id
        and (ws.assigned_to = (select id from public.current_profile())
             or ws.rejected_by = (select id from public.current_profile()))
    )
  );

create policy document_files_delete on public.document_files for delete
  using (
    public.is_admin()
    or uploaded_by = (select id from public.current_profile())
    or exists (
      select 1 from public.documents d
      where d.id = document_files.document_id
        and d.created_by = (select id from public.current_profile())
    )
  );
-- no update policy: app never PATCHes document_files, only inserts new
-- versions (dpa('document_files', ...) does not appear anywhere in the code).
