-- ============================================================================
-- phase3_dev_users.sql — จัดการผู้ใช้แบบจำกัดสำหรับ ROLE-DEV (ระยะ 3)
-- รันใน Supabase SQL Editor — idempotent
--
-- สิ่งที่ได้:
--   ✓ อ่านรายชื่อ users ทั้งหมด (ยกเว้นแก้แถว ROLE-SYS ไม่ได้)
--   ✓ อนุมัติ/ปฏิเสธ/เปิด-ปิดบัญชี/แก้ role (ห้ามตั้งเป็น ROLE-SYS)
--   ✗ ลบผู้ใช้ / สร้างผู้ใช้ — ยังต้องใช้แอดมิน + Edge Functions เดิม
-- ============================================================================

drop policy if exists users_select_dev on public.users;
create policy users_select_dev on public.users
  for select using (public.is_dev());

drop policy if exists users_update_dev on public.users;
create policy users_update_dev on public.users
  for update
  using (public.is_dev() and role_code <> 'ROLE-SYS')
  with check (public.is_dev() and role_code <> 'ROLE-SYS');
