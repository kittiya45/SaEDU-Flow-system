-- ============================================================
-- Migration 006: เพิ่มฟิลด์ rejected_by ในตาราง workflow_steps
-- เพื่อเก็บข้อมูลว่าใครเป็นคนส่งคืนเอกสาร
-- วิธีรัน: Supabase Dashboard → SQL Editor → วาง + Run
-- ============================================================

ALTER TABLE workflow_steps
ADD COLUMN IF NOT EXISTS rejected_by UUID REFERENCES users(id);

-- สร้าง index สำหรับประสิทธิภาพ
CREATE INDEX IF NOT EXISTS idx_workflow_steps_rejected_by ON workflow_steps(rejected_by);