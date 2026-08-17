-- ============================================================================
-- 43_lock_down_user_views.sql — ปิดช่องโหว่ข้อมูลผู้ใช้รั่วผ่าน view
-- รันบน production แล้วเมื่อ 2026-08-11
-- ============================================================================
--
-- อาการ: ใครก็ได้ที่มี anon key (ซึ่งอยู่ใน config.js บรรทัด 3 — เปิด DevTools
-- ของเว็บก็เห็น ไม่ต้อง login) ดึงรายชื่อผู้ใช้ทั้งหมดพร้อมอีเมลจริงและรหัสนิสิตได้
--
--   curl "$SU/rest/v1/users_public?select=full_name,email,student_id" \
--        -H "apikey: $ANON" -H "Authorization: Bearer $ANON"
--   → 200 ได้ครบ 64 คน   (ขณะที่ /rest/v1/users คืน [] เพราะ RLS ทำงานถูก)
--
-- สาเหตุ: ทั้ง user_directory และ users_public เป็น view แบบ SECURITY DEFINER
-- (security_invoker = false) เจ้าของคือ postgres ซึ่งมี rolbypassrls = true
-- → query ผ่าน view จึงข้าม RLS ของ public.users ทั้งหมด
-- แถมถูก GRANT ให้ anon + authenticated ครบทุกคำสั่ง และทั้งคู่ is_updatable = YES
-- → anon PATCH ได้ด้วย (ตอบ HTTP 204) และทั้งสอง view มีคอลัมน์ role_code /
--   is_active / approval_status → เขียน role_code ตัวเองเป็น ROLE-SYS ได้
--
-- ⚠️ ห้ามแก้ด้วยการเปลี่ยน user_directory เป็น security_invoker — หน้าที่ของ view นี้
--    คือข้าม RLS ของ users เพื่อให้ค้นชื่อคนอื่นได้ (ดู 04_user_directory_view.sql)
--    ถ้าเปลี่ยนเป็น invoker ทุก dropdown ผู้ลงนาม/ผู้รับ/ชื่อผู้จัดทำจะว่างหมด
--    วิธีที่ถูกคือคง definer ไว้ แล้วตัดสิทธิ์ anon + ตัดสิทธิ์เขียนออก

-- ── 1) users_public: ไม่มีโค้ดไหนเรียกใช้เลย ──────────────────────────────
-- grep -rn "users_public" --include={*.js,*.html,*.sql,*.ts,*.mjs} → 0 ผลลัพธ์
-- เป็นซากจากยุค PBKDF2 login ก่อนย้ายไป Supabase Auth
drop view if exists public.users_public;

-- ── 2) user_directory: อ่านอย่างเดียว เฉพาะผู้ที่ล็อกอินแล้ว ────────────────
-- ตรวจแล้วว่าไม่มี call site ไหนเขียนผ่าน view นี้ (ไม่มี dp()/dpa()/dd())
-- และไม่มีหน้าไหนอ่านก่อน login — auth.js / boot.js / config.js ไม่แตะ view นี้เลย
-- (การ resolve อีเมลตอน login ใช้ RPC resolve_login_email ซึ่งเป็นคนละทาง)
revoke all on public.user_directory from anon;
revoke all on public.user_directory from authenticated;
revoke all on public.user_directory from public;
grant select on public.user_directory to authenticated;

-- ── 3) กัน view/table ที่สร้างใหม่ในอนาคตไม่ให้ตกไปหา anon โดยอัตโนมัติ ────
-- ต้นเหตุจริงของบั๊กนี้คือ default privilege ของ schema public ที่แจก anon อยู่แล้ว
-- ทำให้ view ใหม่ทุกตัว "เปิดให้คนนอก" ตั้งแต่วินาทีที่ถูกสร้าง โดยไม่มีใครสั่ง
alter default privileges in schema public revoke all on tables from anon;

-- ── ตรวจผล ─────────────────────────────────────────────────────────────────
-- select grantee, privilege_type from information_schema.role_table_grants
--   where table_name = 'user_directory';
-- ควรเหลือแค่ authenticated / SELECT (+ postgres, service_role)
