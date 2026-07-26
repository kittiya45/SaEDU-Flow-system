-- ============================================================================
-- 27_phase2_dev_ops.sql — เครื่องมือซ่อมเอกสารขั้นสูงสำหรับ ROLE-DEV (ระยะ 2)
-- รันใน Supabase SQL Editor — idempotent
-- ============================================================================

drop policy if exists documents_delete_dev on public.documents;
create policy documents_delete_dev on public.documents
  for delete using (public.is_dev());

drop policy if exists document_files_delete_dev on public.document_files;
create policy document_files_delete_dev on public.document_files
  for delete using (public.is_dev());

drop policy if exists workflow_steps_delete_dev on public.workflow_steps;
create policy workflow_steps_delete_dev on public.workflow_steps
  for delete using (public.is_dev());
