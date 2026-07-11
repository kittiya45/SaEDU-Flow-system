-- ============================================================================
-- SAEDU Flow — ล้างไฟล์ลงนามซ้ำ (v2–v7) อัตโนมัติ
-- ============================================================================
-- รันหลัง private_storage_bucket.sql + frontend ที่ใช้ upsert ฉบับเดียว deploy แล้ว
-- หรือใช้ Dev Panel → สุขภาพระบบ → "ล้างไฟล์ลงนามซ้ำ" (แนะนำ — มี preview ก่อนลบ)
--
-- ฟังก์ชันนี้ลบเฉพาะแถว document_files ที่:
--   1) อยู่ใน signed/* และเป็นสำเนาเก่า (ชื่อมี v2–v9)
--   2) มีไฟล์ canonical ใหม่กว่าในเอกสารเดียวกันอยู่แล้ว
-- ไม่ลบไฟล์ใน Storage โดยตรง — ใช้ Dev Panel หรือรัน cleanup ผ่าน API แทน

CREATE OR REPLACE FUNCTION public.list_signed_duplicate_files()
RETURNS TABLE (
  id uuid,
  document_id uuid,
  file_name text,
  file_path text,
  version int,
  uploaded_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH signed AS (
    SELECT df.*
    FROM public.document_files df
    WHERE df.file_path LIKE 'signed/%'
      AND (
        df.file_name ~ '\[ลงนาม\].*v[2-9]'
        OR df.file_path ~ '/v[2-9]\.'
        OR df.file_name ~ ' v[2-9]\.'
      )
  ),
  canonical AS (
    SELECT DISTINCT document_id
    FROM public.document_files
    WHERE file_path LIKE 'signed/%'
      AND file_name NOT LIKE '%v2%'
      AND file_name NOT LIKE '%v3%'
      AND file_name NOT LIKE '%v4%'
      AND file_name NOT LIKE '%v5%'
      AND file_name NOT LIKE '%v6%'
      AND file_name NOT LIKE '%v7%'
      AND file_name NOT LIKE '%v8%'
      AND file_name NOT LIKE '%v9%'
  )
  SELECT s.id, s.document_id, s.file_name, s.file_path, s.version, s.uploaded_at
  FROM signed s
  WHERE EXISTS (SELECT 1 FROM canonical c WHERE c.document_id = s.document_id)
  ORDER BY s.document_id, s.uploaded_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.list_signed_duplicate_files() TO authenticated;

-- ลบแถว DB ที่ list ได้ (ไม่แตะ Storage — ใช้ Dev Panel ลบไฟล์จริง)
CREATE OR REPLACE FUNCTION public.purge_signed_duplicate_rows()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_cnt int;
BEGIN
  SELECT cp.id INTO v_uid FROM public.current_profile() cp;
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT public.is_dev() AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'dev or admin only';
  END IF;

  WITH doomed AS (
    SELECT * FROM public.list_signed_duplicate_files()
  ),
  del AS (
    DELETE FROM public.document_files df
    USING doomed d
    WHERE df.id = d.id
    RETURNING df.id
  )
  SELECT count(*)::int INTO v_cnt FROM del;

  RETURN v_cnt;
END;
$$;

GRANT EXECUTE ON FUNCTION public.purge_signed_duplicate_rows() TO authenticated;
