-- ============================================================
-- Migration 004: เพิ่มคอลัมน์ sent_at ใน notifications
-- วิธีรัน: Supabase Dashboard → SQL Editor → วาง + Run
-- ============================================================

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_notifications_sent_at ON notifications(sent_at DESC);
