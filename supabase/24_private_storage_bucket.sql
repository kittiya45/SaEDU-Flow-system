-- ============================================================================
-- SAEDU Flow — Private documents bucket + Storage RLS
-- ============================================================================
-- รันหลัง migration_auth_rls + enable_rls (และหลัง frontend ที่ใช้ signed URL deploy แล้ว)
-- ทำให้ bucket `documents` ไม่ public — client ใช้ createSignedUrl() แทน public URL
-- idempotent — รันซ้ำได้
--
-- ⚠️  Deploy พร้อมกับ frontend ที่มี resolveFilePath() / data-path แล้วเท่านั้น
--     ถ้ารัน SQL ก่อน deploy frontend ไฟล์จะเปิดไม่ได้ชั่วคราว

-- ── 1. ปิด public access บน bucket ─────────────────────────────────────────
UPDATE storage.buckets
SET public = false
WHERE id = 'documents';

-- สร้าง bucket ถ้ายังไม่มี (บางโปรเจกต์สร้างผ่าน Dashboard แล้ว)
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- ── 2. Storage RLS policies (authenticated เท่านั้น) ─────────────────────
-- สอดคล้องกับแนวคิด document_files: สมาชิกที่ล็อกอินแล้วอ่านไฟล์ร่วมกันได้

DROP POLICY IF EXISTS documents_public_read ON storage.objects;
DROP POLICY IF EXISTS documents_auth_select ON storage.objects;
DROP POLICY IF EXISTS documents_auth_insert ON storage.objects;
DROP POLICY IF EXISTS documents_auth_update ON storage.objects;
DROP POLICY IF EXISTS documents_auth_delete ON storage.objects;

CREATE POLICY documents_auth_select ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'documents');

CREATE POLICY documents_auth_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documents');

CREATE POLICY documents_auth_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'documents')
  WITH CHECK (bucket_id = 'documents');

CREATE POLICY documents_auth_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'documents');

-- ── 3. หมายเหตุ Edge Function convert-docx ─────────────────────────────────
-- validateStorageUrl รองรับ signed URL แล้ว — deploy send-email/convert-docx ชุดล่าสุดด้วย
