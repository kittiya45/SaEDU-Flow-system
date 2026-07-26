-- ============================================================================
-- Performance indexes สำหรับ query pattern ที่รันบ่อยที่สุดในแอป
-- รันใน Supabase SQL Editor (idempotent — รันซ้ำได้)
--
-- ตารางเหล่านี้ยังไม่มี index รองรับ query ที่หน้าเว็บยิงทุกครั้งที่ nav():
--   - workflow_steps ?assigned_to=eq.X            (docList/dashboard/layout/homeViews — นับ badge ทุกหน้า)
--   - workflow_steps ?document_id=eq.X&order=step_number   (ทุกหน้า detail/edit/report)
--   - documents ?order=created_at.desc            (รายการเอกสารหลัก)
--   - documents ?created_by=eq.X / forwarded_to_id=eq.X / final_recipient_id=eq.X  (or-filter ของแต่ละ user)
--   - document_files ?document_id=eq.X&order=version.desc (แนบไฟล์/ประวัติเวอร์ชัน)
--   - document_history ?document_id=eq.X&order=performed_at.desc  (audit trail)
--   - documents ?doc_number=like.<prefix>*         (ตัวสร้างเลขที่ placeholder ใน docForm.js — ดู 35 คู่กับ query fix ใน docForm.js)
--
-- Postgres ไม่ auto-index FK column ให้ — ตารางเหล่านี้โตต่อเนื่องตาม
-- จำนวนเอกสาร ถ้าไม่มี index จะเริ่มเป็น sequential scan เมื่อข้อมูลถึงหลักพัน-หมื่นแถว
-- ============================================================================

-- workflow_steps: "ขั้นตอนของฉัน" — ดึงทุก step ของ user คนหนึ่งไม่ว่าสถานะใด
-- (ต่างจาก workflow_steps_active_assignee_idx ใน 22_scale_hardening.sql ที่เป็น partial index
--  เฉพาะ status='active' เท่านั้น — ไม่ครอบคลุม query ที่ไม่กรอง status)
create index if not exists workflow_steps_assigned_to_idx
  on public.workflow_steps (assigned_to);

-- workflow_steps: โหลดขั้นตอนทั้งหมดของเอกสารหนึ่งใบ เรียงตามลำดับ (hot path ที่สุดของหน้า detail)
create index if not exists workflow_steps_document_step_idx
  on public.workflow_steps (document_id, step_number);

-- documents: รายการเอกสารหลักเรียงใหม่สุดก่อน (ORDER BY ... LIMIT ใช้ index นี้ได้ตรง ๆ ไม่ต้อง sort)
create index if not exists documents_created_at_idx
  on public.documents (created_at desc);

-- documents: or-filter ของแต่ละ user ("เอกสารที่ฉันสร้าง / ถูกส่งต่อให้ / เป็นผู้รับปลายทาง")
create index if not exists documents_created_by_idx
  on public.documents (created_by);

create index if not exists documents_forwarded_to_id_idx
  on public.documents (forwarded_to_id);

create index if not exists documents_final_recipient_id_idx
  on public.documents (final_recipient_id);

-- document_files: ไฟล์แนบ + ประวัติเวอร์ชันของเอกสารหนึ่งใบ
create index if not exists document_files_document_version_idx
  on public.document_files (document_id, version desc);

-- document_history: audit trail ของเอกสารหนึ่งใบ เรียงล่าสุดก่อน
create index if not exists document_history_document_performed_idx
  on public.document_history (document_id, performed_at desc);

-- documents.doc_number: รองรับ LIKE 'prefix%' (text_pattern_ops จำเป็นสำหรับ index-backed prefix
-- match เมื่อ collation ของ DB ไม่ใช่ "C" — btree ธรรมดาอาจไม่ถูกเลือกใช้กับ LIKE)
-- ใช้คู่กับ genDocNumber()/genOutDocNumber() ใน docForm.js ที่เปลี่ยนจากดึงทุกแถวมา
-- หา max ฝั่ง client เป็นกรองด้วย doc_number=like.<prefix>* ที่ DB ก่อนแล้ว
create index if not exists documents_doc_number_pattern_idx
  on public.documents (doc_number text_pattern_ops);
