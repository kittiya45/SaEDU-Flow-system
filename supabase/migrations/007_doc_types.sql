-- ============================================================
-- Migration 007: ตารางประเภทเอกสาร (จัดการผ่าน Admin UI)
-- วิธีรัน: Supabase Dashboard → SQL Editor → วาง + Run
-- ============================================================

CREATE TABLE IF NOT EXISTS doc_types (
  id             UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  code           TEXT        NOT NULL UNIQUE,
  label          TEXT        NOT NULL,
  icon           TEXT        NOT NULL DEFAULT 'doc',
  show_from      BOOLEAN     NOT NULL DEFAULT false,
  from_label     TEXT        NOT NULL DEFAULT '',
  show_to        BOOLEAN     NOT NULL DEFAULT false,
  to_label       TEXT        NOT NULL DEFAULT '',
  show_ref       BOOLEAN     NOT NULL DEFAULT false,
  ref_label      TEXT        NOT NULL DEFAULT '',
  show_doc_date  BOOLEAN     NOT NULL DEFAULT false,
  doc_date_label TEXT        NOT NULL DEFAULT '',
  event_label    TEXT        NOT NULL DEFAULT 'วันกำหนดส่ง',
  event_required BOOLEAN     NOT NULL DEFAULT false,
  sort_order     INTEGER     NOT NULL DEFAULT 0,
  is_active      BOOLEAN     NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_doc_types_sort ON doc_types(sort_order, created_at);

-- Seed ด้วยประเภทเดิมจาก config.js
INSERT INTO doc_types (code, label, icon, show_from, from_label, show_to, to_label, show_ref, ref_label, show_doc_date, doc_date_label, event_label, event_required, sort_order)
VALUES
  ('incoming',    'หนังสือขาเข้า',  'dn',   true,  'จากหน่วยงาน / ผู้ส่ง',       true,  'เรียน / ส่งถึงฝ่าย',                  true,  'เลขที่หนังสือ (อ้างอิง)',                    true,  'วันที่รับเอกสาร',                  'วันที่ต้องดำเนินการเสร็จ',              false, 1),
  ('outgoing',    'หนังสือขาออก',   'up',   true,  'จากฝ่าย / หน่วยงาน',         true,  'เรียน (ส่งถึงใคร)',                    true,  'หัวข้ออีเมลแจ้งเตือน',                      false, '',                                 'วันที่จัดกิจกรรม / วันที่ต้องใช้เอกสาร', true,  2),
  ('certificate', 'หนังสือรับรอง',  'doc',  false, '',                            true,  'ออกให้แก่ / เรียน',                   false, '',                                           false, '',                                 'วันที่ต้องการใช้ (Deadline)',            true,  3),
  ('memo',        'บันทึกข้อความ',  'edit', true,  'จาก (ฝ่าย / ผู้บันทึก)',     true,  'ถึง (ฝ่าย / ผู้รับ)',                 false, '',                                           false, '',                                 'วันที่ต้องการ (ถ้ามี)',                  false, 4)
ON CONFLICT (code) DO NOTHING;
