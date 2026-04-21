-- ============================================================
-- Migration 003: สร้าง Admin User เริ่มต้น
-- วิธีรัน: Supabase Dashboard → SQL Editor → วาง + Run
--
-- รหัสผ่านเริ่มต้น: admin1234
-- (ระบบจะ auto-upgrade เป็น PBKDF2 เมื่อ login ครั้งแรก)
-- ============================================================

INSERT INTO users (
  email,
  full_name,
  role_code,
  user_type,
  department,
  approval_status,
  is_active,
  password_hash
)
VALUES (
  'admin',
  'ผู้ดูแลระบบ',
  'ROLE-SYS',
  'admin',
  'กนค.',
  'approved',
  true,
  'admin1234'          -- plaintext ชั่วคราว — จะ auto-upgrade เป็น PBKDF2 เมื่อ login ครั้งแรก
)
ON CONFLICT (email) DO UPDATE
  SET role_code       = 'ROLE-SYS',
      approval_status = 'approved',
      is_active       = true;
