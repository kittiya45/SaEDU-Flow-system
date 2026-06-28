-- ════════════════════════════════════════════════════════════════════════
-- check_rls_status.sql — ตรวจสอบว่า Row Level Security เปิดจริงทุกตาราง
--
-- anon key ฝังอยู่ใน config.js (เปิดเผยต่อทุกคนที่เข้าหน้าเว็บ) ความปลอดภัย
-- ทั้งระบบจึงพึ่ง RLS ล้วน ถ้าตารางใด RLS ไม่ได้เปิด = ใครก็อ่าน/เขียนตารางนั้น
-- ได้ผ่าน REST โดยตรงด้วย anon key
--
-- รันใน Supabase Dashboard SQL Editor
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. ตารางไหนใน public ที่ RLS ยัง"ปิด" อยู่ (ต้องไม่มีแถวคืนมา) ──
-- ถ้ามีแถวคืนมา = ตารางนั้นเปิดโล่ง ต้องรีบรัน supabase/enable_rls.sql
SELECT n.nspname AS schema, c.relname AS table_name, c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'              -- ตารางจริงเท่านั้น
  AND c.relrowsecurity = false     -- ← RLS ปิดอยู่
ORDER BY c.relname;

-- ── 2. ภาพรวม: ทุกตารางพร้อมสถานะ RLS + จำนวน policy ──
-- ตารางที่ rls_enabled = true แต่ policy_count = 0 ก็อันตราย (เปิด RLS แต่ไม่มี policy = ปฏิเสธหมด
-- หรือถ้ามี policy permissive ที่หลวมก็ต้องดู) ตรวจคู่กับข้อ 3
SELECT c.relname AS table_name,
       c.relrowsecurity AS rls_enabled,
       (SELECT count(*) FROM pg_policies p WHERE p.schemaname='public' AND p.tablename=c.relname) AS policy_count
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname='public' AND c.relkind='r'
ORDER BY c.relname;

-- ── 3. รายละเอียด policy ทั้งหมด (ดูว่า USING/WITH CHECK สมเหตุผลไหม) ──
SELECT tablename, policyname, cmd, roles, qual AS using_expr, with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd, policyname;
