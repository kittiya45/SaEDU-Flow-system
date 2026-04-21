-- ============================================================
-- Migration 008: ช่องข้อมูลแบบกำหนดเองต่อประเภทเอกสาร
--                + ระยะเวลาขั้นต่ำในการดำเนินการ
-- วิธีรัน: Supabase Dashboard → SQL Editor → วาง + Run
-- ============================================================

-- เพิ่ม column ใหม่ใน doc_types
ALTER TABLE doc_types
  ADD COLUMN IF NOT EXISTS min_days      INTEGER  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS enable_deadline BOOLEAN NOT NULL DEFAULT true;

-- ตารางช่องข้อมูลในฟอร์มต่อประเภทเอกสาร
CREATE TABLE IF NOT EXISTS doc_type_fields (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  doc_type_id  UUID        NOT NULL REFERENCES doc_types(id) ON DELETE CASCADE,
  db_column    TEXT        NOT NULL,   -- from_department | addressed_to | subject_line | doc_date | description
  label        TEXT        NOT NULL,
  placeholder  TEXT        NOT NULL DEFAULT '',
  required     BOOLEAN     NOT NULL DEFAULT false,
  field_type   TEXT        NOT NULL DEFAULT 'text',  -- text | date | textarea
  sort_order   INTEGER     NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (doc_type_id, db_column)
);

CREATE INDEX IF NOT EXISTS idx_doc_type_fields_type ON doc_type_fields(doc_type_id, sort_order);

-- Seed ช่องข้อมูลสำหรับ 4 ประเภทเดิม
-- incoming
INSERT INTO doc_type_fields (doc_type_id, db_column, label, placeholder, required, field_type, sort_order)
SELECT id, 'from_department', 'จากหน่วยงาน / ผู้ส่ง', 'เช่น ฝ่ายวิชาการ', true,  'text',     1 FROM doc_types WHERE code='incoming' ON CONFLICT DO NOTHING;
INSERT INTO doc_type_fields (doc_type_id, db_column, label, placeholder, required, field_type, sort_order)
SELECT id, 'addressed_to',   'เรียน / ส่งถึงฝ่าย',  'ระบุผู้รับเอกสาร', true,  'text',     2 FROM doc_types WHERE code='incoming' ON CONFLICT DO NOTHING;
INSERT INTO doc_type_fields (doc_type_id, db_column, label, placeholder, required, field_type, sort_order)
SELECT id, 'subject_line',   'เลขที่หนังสือ (อ้างอิง)', '—',            false, 'text',     3 FROM doc_types WHERE code='incoming' ON CONFLICT DO NOTHING;
INSERT INTO doc_type_fields (doc_type_id, db_column, label, placeholder, required, field_type, sort_order)
SELECT id, 'doc_date',       'วันที่รับเอกสาร',       '',              false, 'date',     4 FROM doc_types WHERE code='incoming' ON CONFLICT DO NOTHING;
INSERT INTO doc_type_fields (doc_type_id, db_column, label, placeholder, required, field_type, sort_order)
SELECT id, 'description',    'รายละเอียดเพิ่มเติม',   'รายละเอียด...',  false, 'textarea', 5 FROM doc_types WHERE code='incoming' ON CONFLICT DO NOTHING;

-- outgoing
INSERT INTO doc_type_fields (doc_type_id, db_column, label, placeholder, required, field_type, sort_order)
SELECT id, 'from_department', 'จากฝ่าย / หน่วยงาน',           'เช่น ฝ่ายวิชาการ', true,  'text',     1 FROM doc_types WHERE code='outgoing' ON CONFLICT DO NOTHING;
INSERT INTO doc_type_fields (doc_type_id, db_column, label, placeholder, required, field_type, sort_order)
SELECT id, 'addressed_to',   'เรียน (ส่งถึงใคร)',              'ระบุผู้รับเอกสาร', true,  'text',     2 FROM doc_types WHERE code='outgoing' ON CONFLICT DO NOTHING;
INSERT INTO doc_type_fields (doc_type_id, db_column, label, placeholder, required, field_type, sort_order)
SELECT id, 'subject_line',   'หัวข้ออีเมลแจ้งเตือน',          '—',                false, 'text',     3 FROM doc_types WHERE code='outgoing' ON CONFLICT DO NOTHING;
INSERT INTO doc_type_fields (doc_type_id, db_column, label, placeholder, required, field_type, sort_order)
SELECT id, 'description',    'รายละเอียดเพิ่มเติม',            'รายละเอียด...',    false, 'textarea', 4 FROM doc_types WHERE code='outgoing' ON CONFLICT DO NOTHING;

-- certificate
INSERT INTO doc_type_fields (doc_type_id, db_column, label, placeholder, required, field_type, sort_order)
SELECT id, 'addressed_to',   'ออกให้แก่ / เรียน',             'ระบุผู้รับเอกสาร', true,  'text',     1 FROM doc_types WHERE code='certificate' ON CONFLICT DO NOTHING;
INSERT INTO doc_type_fields (doc_type_id, db_column, label, placeholder, required, field_type, sort_order)
SELECT id, 'description',    'รายละเอียดเพิ่มเติม',            'รายละเอียด...',    false, 'textarea', 2 FROM doc_types WHERE code='certificate' ON CONFLICT DO NOTHING;

-- memo
INSERT INTO doc_type_fields (doc_type_id, db_column, label, placeholder, required, field_type, sort_order)
SELECT id, 'from_department', 'จาก (ฝ่าย / ผู้บันทึก)', 'เช่น ฝ่ายวิชาการ', true,  'text',     1 FROM doc_types WHERE code='memo' ON CONFLICT DO NOTHING;
INSERT INTO doc_type_fields (doc_type_id, db_column, label, placeholder, required, field_type, sort_order)
SELECT id, 'addressed_to',   'ถึง (ฝ่าย / ผู้รับ)',    'ระบุผู้รับเอกสาร', true,  'text',     2 FROM doc_types WHERE code='memo' ON CONFLICT DO NOTHING;
INSERT INTO doc_type_fields (doc_type_id, db_column, label, placeholder, required, field_type, sort_order)
SELECT id, 'description',    'รายละเอียดเพิ่มเติม',     'รายละเอียด...',    false, 'textarea', 3 FROM doc_types WHERE code='memo' ON CONFLICT DO NOTHING;
