-- ============================================================================
-- 26_phase1_dev_extras.sql — สิทธิ์เพิ่มสำหรับ ROLE-DEV (ระยะ 1)
-- รันใน Supabase SQL Editor ถ้าเคยรัน 17_create_dev_role.sql ไปแล้วก่อนมี policy นี้
-- idempotent — รันซ้ำได้ปลอดภัย
-- ============================================================================

drop policy if exists form_templates_write_dev on public.form_templates;
create policy form_templates_write_dev on public.form_templates
  for all using (public.is_dev()) with check (public.is_dev());
