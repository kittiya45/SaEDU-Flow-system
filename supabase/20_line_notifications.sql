-- ═══════════════════════════════════════════════════════════════════
-- LINE OA NOTIFICATIONS — คอลัมน์ผูกบัญชี LINE กับ public.users
-- ═══════════════════════════════════════════════════════════════════
--
-- รันใน Supabase Dashboard SQL Editor (idempotent — รันซ้ำได้)
-- ใช้คู่กับ Edge Functions: send-line (push แจ้งเตือน) และ
-- line-webhook (รับ event จาก LINE เพื่อผูกบัญชีด้วยรหัส 6 หลัก)
--
-- โมเดลการผูกบัญชี:
--   1. ผู้ใช้กด "เชื่อมต่อ LINE" ในแอป → แอปสุ่มรหัส 6 หลักเขียนลง
--      line_link_code (+ หมดอายุ 10 นาที) ในแถวของตัวเอง
--      (RLS เดิม users_update: auth_uid = auth.uid() ครอบอยู่แล้ว)
--   2. ผู้ใช้แอด LINE OA เป็นเพื่อน แล้วพิมพ์รหัสส่งในแชท
--   3. line-webhook (service role — ข้าม RLS) จับคู่รหัส → เขียน
--      line_user_id ลงแถวนั้น แล้วล้างรหัสทิ้ง
--
-- ความปลอดภัย: line_user_id ไม่ถูกเพิ่มเข้า view user_directory
-- (ผู้ใช้อื่นมองไม่เห็น) — ฝั่ง client เห็นได้เฉพาะของตัวเองผ่านแถว
-- users ของตนเอง; การ resolve line_user_id ของ "ผู้รับ" ตอนส่งแจ้งเตือน
-- ทำฝั่ง server ใน Edge Function send-line เท่านั้น

alter table public.users add column if not exists line_user_id text;
alter table public.users add column if not exists line_link_code text;
alter table public.users add column if not exists line_link_code_expires_at timestamptz;

-- LINE userId หนึ่งบัญชีผูกได้กับผู้ใช้เดียว (webhook จะย้ายการผูกให้เอง
-- ถ้ามีการผูกซ้ำ — ล้างแถวเก่าก่อน insert ใหม่)
create unique index if not exists users_line_user_id_unique
  on public.users (line_user_id) where line_user_id is not null;

-- ให้ webhook ค้นรหัสเร็ว (แถวที่มีรหัสค้างอยู่มีจำนวนน้อยมาก)
create index if not exists users_line_link_code_idx
  on public.users (line_link_code) where line_link_code is not null;
