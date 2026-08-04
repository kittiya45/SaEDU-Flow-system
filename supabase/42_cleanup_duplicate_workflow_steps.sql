-- ============================================================================
-- 42_cleanup_duplicate_workflow_steps.sql
-- ล้างขั้นตอนซ้ำซ้อนที่เกิดจากบั๊กใน _rebuildDraftSteps (ดู 41_workflow_steps_delete_policy.sql)
--
-- ✅ รันบน production แล้ว 2026-08-04 — ลบไป 87 แถวจาก 7 เอกสาร
--    เก็บบันทึกไว้เป็นหลักฐานว่าทำอะไรไป ไม่ต้องรันซ้ำ (รันซ้ำจะไม่ลบอะไรเพิ่ม)
--
-- ⚠️ บทเรียน: อย่าใช้กฎ "เก็บชุดใหม่สุด" แบบเหมารวม
--    ตอนแรกวางแผนจะ dedup ด้วย row_number() เก็บแถวใหม่สุดของแต่ละ step_number
--    แต่พอ preview ก่อนลบจริงพบว่า:
--      • GNK-2569-048 ชุด "เก่า" ต่างหากที่เดินเรื่องอยู่ (มี active) การอนุมัติเมื่อ 08-01
--        ลงที่ชุดเก่า ส่วนชุดใหม่ 07-27 เป็นชุดค้างเปล่า — เก็บชุดใหม่จะทำให้เอกสารไม่มี
--        ขั้นตอน active เลย = งานค้างไม่ถึงมือใคร
--      • GNK-2569-056 ถูก rebuild 4 รอบจนรายการขั้นตอนทวีคูณเป็น 14 แล้ว 28 ขั้น
--        (ชุดแรก 7 ขั้นถูกต้อง) — dedup ตาม step_number จะเหลือ 28 ขั้นซึ่งยังผิดอยู่ดี
--    จึงเปลี่ยนมาระบุ "ชุดที่จะเก็บ" ทีละเอกสารตามว่าชุดไหนมีความคืบหน้าจริง
--
-- เกณฑ์เลือกชุดที่เก็บ: ชุดที่มี done/active ที่เป็นความคืบหน้าจริง
-- ตรวจก่อนลบแล้วว่าไม่มีแถวที่ถูกลบซึ่งถือ action_at ที่ไม่ซ้ำกับแถวที่เก็บไว้
-- ============================================================================


-- ── STEP 1: ดูก่อนว่าจะลบอะไร (อ่านอย่างเดียว) ────────────────────────────────
-- คอลัมน์ "แถวที่ลบซึ่งเคยมีการกระทำ" ต้องเป็น 0 หรือเป็นแถวที่ซ้ำกับที่เก็บไว้เป๊ะ
-- คอลัมน์ "active_ที่เหลือ" ต้องเป็น 1 ทุกเอกสาร ไม่งั้นงานจะค้างไม่ถึงมือใคร
with keep(doc_no, keep_at) as (values
  ('GNK-2569-041', timestamptz '2026-07-27 16:36'),  -- สองชุดเหมือนกัน เก็บชุดใหม่
  ('GNK-2569-044', timestamptz '2026-07-27 16:35'),  -- สองชุดเหมือนกัน เก็บชุดใหม่
  ('GNK-2569-048', timestamptz '2026-07-22 08:41'),  -- ชุดเก่ามี active ที่เดินเรื่องอยู่
  ('GNK-2569-054', timestamptz '2026-08-03 03:46'),  -- ชุดใหม่มี done+active ถูกต้อง
  ('GNK-2569-055', timestamptz '2026-08-01 07:28'),  -- ชุดใหม่มี done+active
  ('GNK-2569-056', timestamptz '2026-07-27 03:10'),  -- ชุดแรก 7 ขั้นถูกต้อง ชุดหลังทวีคูณ
  ('GNK-2569-057', timestamptz '2026-07-27 15:55')   -- สองชุดเหมือนกัน เก็บชุดใหม่
)
select k.doc_no,
  count(*) filter (where date_trunc('minute',s.created_at)=k.keep_at) as เก็บ,
  count(*) filter (where date_trunc('minute',s.created_at)<>k.keep_at) as ลบ,
  count(*) filter (where date_trunc('minute',s.created_at)=k.keep_at and s.status='active') as active_ที่เหลือ,
  count(*) filter (where date_trunc('minute',s.created_at)=k.keep_at and s.status='done') as done_ที่เหลือ,
  count(*) filter (where date_trunc('minute',s.created_at)<>k.keep_at and s.action_at is not null) as แถวที่ลบซึ่งเคยมีการกระทำ
from keep k
join documents d on d.doc_number=k.doc_no
join workflow_steps s on s.document_id=d.id
group by k.doc_no order by k.doc_no;


-- ── STEP 2: ลบจริง (รันไปแล้ว 2026-08-04 — 87 แถว) ──────────────────────────
/*
with keep(doc_no, keep_at) as (values
  ('GNK-2569-041', timestamptz '2026-07-27 16:36'),
  ('GNK-2569-044', timestamptz '2026-07-27 16:35'),
  ('GNK-2569-048', timestamptz '2026-07-22 08:41'),
  ('GNK-2569-054', timestamptz '2026-08-03 03:46'),
  ('GNK-2569-055', timestamptz '2026-08-01 07:28'),
  ('GNK-2569-056', timestamptz '2026-07-27 03:10'),
  ('GNK-2569-057', timestamptz '2026-07-27 15:55')
), doomed as (
  select s.id
  from keep k
  join documents d on d.doc_number = k.doc_no
  join workflow_steps s on s.document_id = d.id
  where date_trunc('minute', s.created_at) <> k.keep_at
)
delete from workflow_steps where id in (select id from doomed);
*/


-- ── STEP 3: ตรวจผล — ทั้ง 3 บรรทัดต้องได้ 0 (ยืนยันแล้วหลังรันจริง) ──────────
select 'เอกสารที่ยังมีขั้นตอนซ้ำ' as ตรวจ, count(*) as ต้องเป็น0 from (
  select document_id from workflow_steps group by document_id
  having count(*) > count(distinct step_number)) x
union all
select 'pending แต่ active ไม่เท่ากับ 1', count(*) from (
  select d.id from documents d join workflow_steps s on s.document_id=d.id
  where d.status='pending' group by d.id
  having count(*) filter (where s.status='active') <> 1) y
union all
select 'draft ที่มี active เกิน 1', count(*) from (
  select d.id from documents d join workflow_steps s on s.document_id=d.id
  where d.status='draft' group by d.id
  having count(*) filter (where s.status='active') > 1) z;
