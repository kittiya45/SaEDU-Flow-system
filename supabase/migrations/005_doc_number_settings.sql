-- ============================================================
-- Migration 005: ตารางตั้งค่าเลขที่เอกสารรายปี
-- วิธีรัน: Supabase Dashboard → SQL Editor → วาง + Run
-- ============================================================

CREATE TABLE IF NOT EXISTS doc_number_settings (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  year       INTEGER     NOT NULL UNIQUE,   -- พ.ศ. เช่น 2568
  prefix     TEXT        NOT NULL,          -- เช่น "GNK" หรือ "กนค"
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_doc_number_settings_year ON doc_number_settings(year);
