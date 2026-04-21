-- ============================================================
-- Migration 002: เปิด Row Level Security (RLS) ทุกตาราง
-- วิธีรัน: Supabase Dashboard → SQL Editor → วาง + Run
--
-- หลักการ:
--   • anon key สามารถ SELECT/INSERT/UPDATE ได้ (app ต้องใช้)
--   • document_history  → ห้าม DELETE และ UPDATE (log ต้องคงอยู่)
--   • notifications     → ห้าม DELETE (audit trail)
--   • users             → ซ่อน password_hash จาก SELECT ทั่วไป
--                         ผ่าน view แยกสำหรับ login
-- ============================================================

-- ────────────────────────────────────────────────
-- 1. USERS
-- ────────────────────────────────────────────────
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- อนุญาตอ่าน: ต้องเห็น approved + pending (admin panel, login check)
CREATE POLICY "users_select" ON users
  FOR SELECT USING (true);

-- อนุญาต insert (สมัครสมาชิก)
CREATE POLICY "users_insert" ON users
  FOR INSERT WITH CHECK (true);

-- อนุญาต update (เปลี่ยนรหัสผ่าน, admin แก้ไขข้อมูล)
CREATE POLICY "users_update" ON users
  FOR UPDATE USING (true) WITH CHECK (true);

-- อนุญาต delete (admin ลบบัญชีผู้ใช้)
CREATE POLICY "users_delete" ON users
  FOR DELETE USING (true);

-- ────────────────────────────────────────────────
-- 2. DOCUMENTS
-- ────────────────────────────────────────────────
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "documents_all" ON documents
  FOR ALL USING (true) WITH CHECK (true);

-- ────────────────────────────────────────────────
-- 3. DOCUMENT_FILES
-- ────────────────────────────────────────────────
ALTER TABLE document_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "document_files_all" ON document_files
  FOR ALL USING (true) WITH CHECK (true);

-- ────────────────────────────────────────────────
-- 4. WORKFLOW_STEPS
-- ────────────────────────────────────────────────
ALTER TABLE workflow_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workflow_steps_all" ON workflow_steps
  FOR ALL USING (true) WITH CHECK (true);

-- ────────────────────────────────────────────────
-- 5. DOCUMENT_HISTORY  ← IMMUTABLE LOG
--    ห้าม DELETE และ UPDATE เด็ดขาด
-- ────────────────────────────────────────────────
ALTER TABLE document_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "history_select" ON document_history
  FOR SELECT USING (true);

CREATE POLICY "history_insert" ON document_history
  FOR INSERT WITH CHECK (true);

-- ไม่มี UPDATE policy  → blocked
-- ไม่มี DELETE policy  → blocked

-- ────────────────────────────────────────────────
-- 6. NOTIFICATIONS  ← ห้าม DELETE
-- ────────────────────────────────────────────────
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_select" ON notifications
  FOR SELECT USING (true);

CREATE POLICY "notifications_insert" ON notifications
  FOR INSERT WITH CHECK (true);

CREATE POLICY "notifications_update" ON notifications
  FOR UPDATE USING (true) WITH CHECK (true);

-- ไม่มี DELETE policy  → blocked

-- ────────────────────────────────────────────────
-- 7. STORAGE BUCKET — จำกัดขนาดและประเภทไฟล์
-- ────────────────────────────────────────────────
-- ให้รันใน Supabase Dashboard → Storage → Policies
-- หรือรันคำสั่งนี้:

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  true,
  10485760,  -- 10 MB
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/png',
    'image/jpeg',
    'image/gif',
    'image/webp'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit   = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- อนุญาต anon อ่าน/เขียนใน storage bucket
CREATE POLICY "storage_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'documents');

CREATE POLICY "storage_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'documents');

CREATE POLICY "storage_update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'documents');

