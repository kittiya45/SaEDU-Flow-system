-- ============================================================================
-- SAEDU Flow — ปิดช่องที่ Supabase Security Advisor ชี้ (2026-09-20) + ช่อง Storage ที่ advisor ไม่เห็น
--
-- รันใน SQL Editor ได้เลย ไม่ต้อง deploy frontend คู่กัน — ไม่มีส่วนไหนของแอปเรียกของพวกนี้
-- ด้วยสิทธิ์ anon (ยกเว้น resolve_login_email ซึ่งคงไว้ตามเดิม) และ Edge Function / สคริปต์
-- กลางคืนใช้ service_role ซึ่ง bypass RLS อยู่แล้ว  ไฟล์นี้รันซ้ำได้ (idempotent)
--
-- 1) storage.objects — ⚠️ ร้ายแรงที่สุด และ advisor ไม่รายงาน
--    policy `allow_all_{select,upload,update,delete}` (role anon) กับ `storage_{select,insert,update}`
--    (role public) เป็นซากจากตอนตั้งโปรเจกต์ ก่อนที่ 24_private_storage_bucket.sql จะเพิ่ม
--    `documents_auth_*` เข้ามา  ผลคือ anon key ใน config.js (ทุกคนที่เปิดเว็บมองเห็น)
--    ลิสต์ / ดาวน์โหลด / เขียนทับ / ลบ ไฟล์ทุกไฟล์ใน bucket documents ได้โดยไม่ต้อง login
--    — ยืนยันด้วย POST /storage/v1/object/list/documents ด้วย anon key เมื่อ 2026-09-20
--    ลบทิ้งทั้ง 7 ตัว เหลือ `documents_auth_*` (authenticated) และ `user_signatures_*` ตามเดิม
--
-- 2) SECURITY DEFINER function ที่ anon/PUBLIC เรียกผ่าน /rest/v1/rpc ได้ (advisor 0028)
--    ฟังก์ชันส่วนใหญ่เช็ค auth.uid()/current_profile() ข้างในอยู่แล้ว แต่บางตัวไม่ได้เช็ค:
--    list_signed_duplicate_files (ลิสต์ชื่อไฟล์ทั้งระบบ), check_and_bump_notify_rate
--    (เขียนตาราง rate-limit ของคนอื่นได้), overdue_notif_* (เดาสถานะเอกสารจาก uuid)
--    → ถอน EXECUTE จาก PUBLIC + anon ทุกตัว แล้วให้เฉพาะ authenticated + service_role
--    ยกเว้น: resolve_login_email (หน้า login ยังไม่มี session ต้องเรียกได้) และ 4 ตัวช่วยของ RLS
--    (current_profile / is_admin / is_dev / is_template_manager) ซึ่ง policy บนตารางที่ anon
--    อ่านได้ (app_settings ตอนโหลดประกาศหน้า login) เรียกใช้ระหว่างประเมิน policy — ถ้าถอน anon
--    ออก query นั้นจะ error "permission denied for function" แทนที่จะคืน [] — คงไว้ ตัวมันเอง
--    คืน null/false ให้ anon ไม่รั่วอะไร
--    link_auth_user เป็น trigger function เรียกตรงไม่ได้อยู่แล้ว แต่ถอนไว้ให้ advisor เงียบ
--
-- 3) search_path (advisor 0011) — function ที่ยังไม่ได้ปักไว้ 9 ตัว ปักเป็น public
--    ป้องกันการวาง object ชื่อซ้ำใน schema อื่นมาดัก security definer
--
-- สิ่งที่ยังต้องทำเองใน Dashboard (ทำด้วย SQL ไม่ได้):
--    Authentication → Settings → Password → เปิด "Leaked password protection" (advisor)
-- ============================================================================

begin;

-- ── 1) Storage: ลบ policy anon/public ที่เปิดกว้าง ─────────────────────────
drop policy if exists allow_all_select on storage.objects;
drop policy if exists allow_all_upload on storage.objects;
drop policy if exists allow_all_update on storage.objects;
drop policy if exists allow_all_delete on storage.objects;
drop policy if exists storage_select   on storage.objects;
drop policy if exists storage_insert   on storage.objects;
drop policy if exists storage_update   on storage.objects;

-- ── 2) ถอน EXECUTE จาก anon/PUBLIC บน RPC ที่ต้อง login ──────────────────
do $$
declare
  f text;
begin
  foreach f in array array[
    'auto_approve_overdue(uuid)',
    'can_log_notification(uuid,uuid)',
    'check_and_bump_notify_rate(uuid,text,integer,integer)',
    'forward_accept(uuid,text)',
    'forward_decline(uuid,text)',
    'list_signed_duplicate_files()',
    'log_notification(uuid,uuid,text,text,text,text,text,timestamptz)',
    'overdue_notif_exists(uuid)',
    'overdue_notif_sent_at(uuid)',
    'purge_signed_duplicate_rows()',
    'recall_document(uuid)',
    'workflow_action(uuid,text,text,text)',
    'link_auth_user()',
    -- ตัวช่วยธรรมดา (ไม่ใช่ security definer) ก็ไม่มีเหตุให้ anon เรียกผ่าน rpc
    'add_working_days(timestamptz,integer)',
    'doc_needs_numbering(text)',
    'step_deadline_ts(integer)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated, service_role', f);
  end loop;
end $$;

-- ── 3) ปัก search_path ────────────────────────────────────────────────────
alter function public.step_deadline_ts(integer)            set search_path = public;
alter function public.current_profile()                    set search_path = public;
alter function public.resolve_login_email(text)            set search_path = public;
alter function public.is_template_manager()                set search_path = public;
alter function public.add_working_days(timestamptz,integer) set search_path = public;
alter function public.doc_needs_numbering(text)            set search_path = public;
alter function public.is_admin()                           set search_path = public;
alter function public.is_dev()                             set search_path = public;
alter function public.link_auth_user()                     set search_path = public;

commit;

-- ── ตรวจผล ────────────────────────────────────────────────────────────────
-- storage: ต้องเหลือแค่ documents_auth_* + user_signatures_* (ไม่มี role anon/public)
select policyname, roles, cmd from pg_policies
 where schemaname='storage' and tablename='objects' order by 1;
-- ฟังก์ชัน: anon_exec ต้องเป็น true เฉพาะ resolve_login_email, current_profile, is_admin, is_dev, is_template_manager
select p.proname,
       has_function_privilege('anon', p.oid, 'EXECUTE')          as anon_exec,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as auth_exec,
       p.proconfig
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' order by 1;
