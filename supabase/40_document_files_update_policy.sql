-- ============================================================================
-- 40_document_files_update_policy.sql
-- เพิ่ม UPDATE policy ที่ขาดหายไปบน public.document_files
--
-- ปัญหา: document_files มี policy ครบทุกคำสั่ง "ยกเว้น UPDATE"
--   document_files_select (SELECT) / _insert (INSERT) / _delete + _delete_dev (DELETE)
-- RLS เปิดอยู่ และ Postgres ปฏิเสธทุกอย่างที่ไม่มี policy รองรับ ทุก UPDATE จึงถูกบล็อก
-- PostgREST ไม่ถือว่าเป็น error — คืน [] เฉย ๆ (dpa() ใน config.js ถึงต้องเช็ค 0 rows เอง)
--
-- อาการที่เกิดจริง: การฝังลายเซ็น "ครั้งแรก" ของเอกสารเป็น INSERT (ผ่าน) แต่ครั้งที่ 2
-- เป็นต้นไป doAct() ทำ PATCH ทับแถวฉบับลงนามเดิม (ตั้งใจให้เหลือไฟล์ลงนามไฟล์เดียว
-- ไม่ใช่ไฟล์ละคน) จึงโดนบล็อกทุกครั้ง → "บันทึกผลการอนุมัติแล้ว แต่ฝังลายเซ็นลงไฟล์
-- ไม่สำเร็จ: ไม่มีสิทธิ์แก้ไขข้อมูลนี้ หรือไม่พบรายการ (RLS/0 rows affected)"
-- ไม่เกี่ยวกับว่าเป็นคนเดิมเซ็นซ้ำหรือคนละคน — ผู้ลงนามคนที่ 2 ของเอกสารพังเสมอ
--
-- ขอบเขตสิทธิ์: ให้ตรงกับ document_files_insert ทุกประการ (ผู้จัดทำ / ผู้ถูกส่งต่อ /
-- ผู้รับผิดชอบขั้นตอนใน workflow / แอดมิน) — คนที่แนบไฟล์ได้อยู่แล้วย่อมเซ็นทับได้
--
-- รันได้ทุกเมื่อ ไม่ต้องคู่กับ deploy frontend (เป็นการเปิดสิทธิ์ที่โค้ดเรียกใช้อยู่แล้ว)
-- idempotent — รันซ้ำได้
-- ต้องรันหลัง: 01_migration_auth_rls.sql, 05_tighten_workflow_rls.sql, 17_create_dev_role.sql
-- ============================================================================

drop policy if exists document_files_update on public.document_files;
create policy document_files_update on public.document_files
  for update
  using (
    is_admin()
    or exists (
      select 1 from public.documents d
      where d.id = document_files.document_id
        and (
          d.created_by = (select id from current_profile())
          or d.forwarded_to_id = (select id from current_profile())
        )
    )
    or exists (
      select 1 from public.workflow_steps ws
      where ws.document_id = document_files.document_id
        and (
          ws.assigned_to = (select id from current_profile())
          or ws.rejected_by = (select id from current_profile())
        )
    )
  )
  with check (
    is_admin()
    or exists (
      select 1 from public.documents d
      where d.id = document_files.document_id
        and (
          d.created_by = (select id from current_profile())
          or d.forwarded_to_id = (select id from current_profile())
        )
    )
    or exists (
      select 1 from public.workflow_steps ws
      where ws.document_id = document_files.document_id
        and (
          ws.assigned_to = (select id from current_profile())
          or ws.rejected_by = (select id from current_profile())
        )
    )
  );

-- ROLE-DEV: policy คู่ขนานเหมือนตารางอื่น (permissive policy ต่อกันด้วย OR)
drop policy if exists document_files_update_dev on public.document_files;
create policy document_files_update_dev on public.document_files
  for update using (is_dev()) with check (is_dev());

-- ── ตรวจผล: ต้องเห็น UPDATE ครบ 2 แถว ──
select policyname, cmd
from pg_policies
where schemaname = 'public' and tablename = 'document_files'
order by cmd, policyname;
