-- ============================================================================
-- SAEDU Flow — ข้อมูลโปรไฟล์ที่ผู้ใช้แก้เองได้ (หน้า "โปรไฟล์" จากเมนูมุมล่างซ้าย)
-- Run in Supabase Dashboard → SQL Editor (หลัง 19_user_signatures.sql)
-- Safe to re-run. เพิ่มคอลัมน์อย่างเดียว — frontend เก่าไม่อ่านคอลัมน์พวกนี้ รันก่อนหรือหลัง deploy ก็ได้
-- ============================================================================
--
-- phone        — เบอร์โทรติดต่อ (ข้อความอิสระ)
-- avatar_path  — รูปโปรไฟล์ใน bucket ส่วนตัว user-signatures ที่ {userId}/avatar-{timestamp}.jpg
--                ใช้ bucket เดิมของลายเซ็นเพราะ policy "โฟลเดอร์แรก = id ของตัวเอง" ตรงกันพอดี
--                path ใหม่ทุกครั้งที่เปลี่ยนรูป (ไม่เขียนทับ path เดิม — กัน signed URL/แคชคืนรูปเก่า)
-- ไม่ใส่ใน user_directory view — คนอื่นอ่านไฟล์ในโฟลเดอร์ของเราไม่ได้อยู่แล้ว

alter table public.users add column if not exists phone text;
alter table public.users add column if not exists avatar_path text;
