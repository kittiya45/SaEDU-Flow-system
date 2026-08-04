-- ============================================================================
-- 41_workflow_steps_delete_policy.sql
-- เพิ่ม DELETE policy บน public.workflow_steps ให้ผู้จัดทำ/แอดมินลบขั้นตอนได้
--
-- ปัญหา: workflow_steps มี DELETE policy เดียวคือ workflow_steps_delete_dev (is_dev())
-- ผู้จัดทำเอกสารจึงลบขั้นตอนของเอกสารตัวเองไม่ได้เลย
--
-- อาการที่เกิดจริง: _rebuildDraftSteps() ใน docForm.js (ใช้ตอน "ดึงกลับ" แล้วแก้ลำดับ
-- ผู้ลงนามแล้วส่งใหม่) ลบขั้นตอนชุดเดิมก่อนแล้วค่อยใส่ชุดใหม่ — การลบถูก RLS ปฏิเสธ
-- แต่ PostgREST คืน 204 เสมอแม้ RLS กรองทิ้งหมด dd() จึงไม่รู้ว่าลบไม่สำเร็จ
-- โค้ดเดินหน้าใส่ชุดใหม่ต่อ → เอกสารมีขั้นตอน 2 ชุดซ้อนกัน และมี active พร้อมกัน 2 จุด
-- ยิ่งแก้ซ้ำยิ่งทวีคูณ เพราะฟอร์มอ่านขั้นตอนที่ซ้ำอยู่แล้วกลับเข้ามาเขียนใหม่อีก
-- (GNK-2569-056 กลายเป็น 56 แถวจากขั้นตอนจริง 7 ขั้น)
--
-- ขอบเขตสิทธิ์: ผู้จัดทำเอกสารนั้น หรือแอดมิน — แคบกว่า workflow_steps_update ตั้งใจ
-- ไม่ให้ผู้ลงนาม/ผู้ถูกส่งต่อลบขั้นตอนของคนอื่นทิ้งได้
--
-- ⚠️ ต้อง deploy โค้ดที่แก้ _rebuildDraftSteps (ให้หยุดเมื่อลบไม่สำเร็จ) คู่กับสคริปต์นี้
--    รันสคริปต์นี้อย่างเดียวก็ปลอดภัย แค่ทำให้การลบทำงานได้จริงเท่านั้น
-- idempotent — รันซ้ำได้
-- ต้องรันหลัง: 01_migration_auth_rls.sql, 05_tighten_workflow_rls.sql
-- ============================================================================

drop policy if exists workflow_steps_delete on public.workflow_steps;
create policy workflow_steps_delete on public.workflow_steps
  for delete
  using (
    is_admin()
    or exists (
      select 1 from public.documents d
      where d.id = workflow_steps.document_id
        and d.created_by = (select id from current_profile())
    )
  );

-- ── ตรวจผล: ต้องเห็น DELETE 2 แถว (ของผู้จัดทำ/แอดมิน + ของ dev) ──
select policyname, cmd
from pg_policies
where schemaname = 'public' and tablename = 'workflow_steps'
order by cmd, policyname;
