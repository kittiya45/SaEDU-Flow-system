-- ============================================================
-- Migration 001: สร้างตาราง notifications
-- วิธีรัน: Supabase Dashboard → SQL Editor → วาง + Run
-- ============================================================

CREATE TABLE IF NOT EXISTS notifications (
  id               UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id      UUID        REFERENCES documents(id) ON DELETE SET NULL,
  recipient_id     UUID,
  recipient_email  TEXT,
  subject          TEXT,
  body             TEXT,
  notification_type TEXT       DEFAULT 'email',
  status           TEXT        DEFAULT 'pending',  -- 'pending' | 'sent' | 'failed'
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Index สำหรับ query ตาม recipient และ document
CREATE INDEX IF NOT EXISTS idx_notifications_recipient  ON notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_document   ON notifications(document_id);
CREATE INDEX IF NOT EXISTS idx_notifications_status     ON notifications(status);
