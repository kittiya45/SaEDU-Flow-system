-- ===========================================================================
-- กนค. — ตั้งอายุบัญชี 1 ปี เริ่ม 20 พ.ค. 2569 (ค.ศ. 2026-05-20)
-- หมดอายุ: 20 พ.ค. 2570 00:00 เวลาไทย (ค.ศ. 2027-05-20)
-- รันใน Supabase Dashboard → SQL Editor (idempotent)
-- ต้องมีคอลัมน์ expires_at แล้ว (ดู 15_add_user_expires_at.sql)
-- ===========================================================================

-- ดูสถานะก่อนอัปเดต
select id, full_name, user_type, approval_status, is_active, expires_at
from public.users
where user_type = 'gnk'
order by full_name;

-- ตั้งวันหมดอายุรอบปัจจุบันให้ กนค. ทุกคน
update public.users
set expires_at = timestamptz '2027-05-20 00:00:00+07'
where user_type = 'gnk';

-- ตรวจผล
select id, full_name, approval_status, is_active, expires_at
from public.users
where user_type = 'gnk'
order by full_name;
