-- ============================================================================
-- SAEDU Flow — ค้นหาไฟล์ลงนามซ้ำ (v2–v7) ก่อนเปลี่ยนเป็น upsert ฉบับเดียว
-- ============================================================================
-- รันใน Supabase Dashboard → SQL Editor (read-only diagnostic)
-- ลบไฟล์จริงต้องทำผ่าน Storage UI หรือ Dev Panel หลังตรวจสอบแล้ว

-- 1) รายการ document_files ที่เป็นฉบับลงนามเก่า (ชื่อมี [ลงนาม] และ path มีเลข v2+)
SELECT
  df.id,
  df.document_id,
  df.file_name,
  df.file_path,
  df.version,
  df.uploaded_at,
  d.doc_number,
  d.title
FROM public.document_files df
JOIN public.documents d ON d.id = df.document_id
WHERE df.file_path LIKE 'signed/%'
  AND (
    df.file_name ~ '\[ลงนาม\].*v[2-9]'
    OR df.file_path ~ '/v[2-9]\.'
    OR df.file_name ~ ' v[2-9]\.'
  )
ORDER BY df.document_id, df.version DESC, df.uploaded_at DESC;

-- 2) เอกสารที่มีหลายแถว [ลงนาม] (ควรเหลือแถวเดียวหลัง upsert)
SELECT
  df.document_id,
  count(*) AS signed_rows,
  array_agg(df.file_name ORDER BY df.version DESC) AS names
FROM public.document_files df
WHERE df.file_name LIKE '%[ลงนาม]%'
GROUP BY df.document_id
HAVING count(*) > 1
ORDER BY count(*) DESC;

-- 3) ลบแถว document_files ที่เป็น orphan (ไม่มีไฟล์ใน storage จริง) — รันทีละแถวหลังตรวจ
-- DELETE FROM public.document_files WHERE id = '<uuid>';
