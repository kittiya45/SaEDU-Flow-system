-- ════════════════════════════════════════════════════════════════════════
-- add_doc_number_unique_index.sql
-- ป้องกันเลขที่หนังสือซ้ำจาก race condition (เจ้าหน้าที่ออกเลขพร้อมกัน)
--
-- ที่มา: docNum.js คำนวณเลขถัดไปฝั่ง client (อ่าน max แล้ว +1) ซึ่งเป็น
-- check-then-act ที่ไม่มี lock — สองคนออกเลขประเภทเดียวกันพร้อมกันได้เลขซ้ำ
-- index นี้ทำให้ Postgres ปฏิเสธการเขียนเลขซ้ำจริง แล้ว retry loop ใน
-- _doSetDocNumberConfirmed() จะคำนวณเลขถัดไปใหม่ได้ถูกต้อง
--
-- รันใน Supabase Dashboard SQL Editor (หรือ npx supabase db query --linked --file ...)
-- ════════════════════════════════════════════════════════════════════════

-- ── ขั้นที่ 1: ตรวจหาเลขซ้ำที่มีอยู่ก่อน ──
-- ต้องไม่มีแถวคืนมา ไม่งั้น CREATE UNIQUE INDEX จะล้มเหลว
-- ถ้ามีเลขซ้ำ ให้แก้เลขด้วยมือ (เก็บของจริงไว้ เปลี่ยนของซ้ำ) ก่อนรันขั้นที่ 2
SELECT doc_number, count(*) AS dup_count, array_agg(id) AS doc_ids
FROM public.documents
WHERE doc_number IS NOT NULL
GROUP BY doc_number
HAVING count(*) > 1
ORDER BY dup_count DESC;

-- ── ขั้นที่ 2: สร้าง partial unique index ──
-- partial (WHERE doc_number IS NOT NULL) เพราะ draft/pending ยังไม่มีเลข
-- ปล่อยให้หลายแถวเป็น NULL ได้ แต่เลขที่ "มีค่า" ต้องไม่ซ้ำ
-- รันบรรทัดนี้หลังยืนยันว่าขั้นที่ 1 ไม่คืนแถวใด ๆ แล้ว
CREATE UNIQUE INDEX IF NOT EXISTS documents_doc_number_unique
  ON public.documents (doc_number)
  WHERE doc_number IS NOT NULL;

-- ── ตรวจสอบว่าสร้างสำเร็จ ──
-- ควรเห็น index ชื่อ documents_doc_number_unique
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'documents' AND indexname = 'documents_doc_number_unique';
