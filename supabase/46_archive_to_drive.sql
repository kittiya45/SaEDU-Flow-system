-- ============================================================================
-- SAEDU Flow — คลังเก็บเอกสารเก่าบน Google Drive
--
-- ปัญหา: Storage bucket "documents" โต ~500 MB/เดือน ชนโควตา 1 GB ตั้งแต่เดือนที่ 2
--        (ส.ค. 2569: 1,026 MB จากเอกสารแค่ 2 เดือน)
--
-- แนวคิด: เอกสารที่ "จบกระบวนการแล้ว" (completed/cancelled/rejected) ไม่มีใครลงนามเพิ่ม
--         อีกแล้ว จึงย้ายไฟล์แนบออกไปเก็บบน Google Drive ได้ โดย **เก็บแถวใน
--         document_files ไว้ครบทุกแถว** — ประวัติ ลายเซ็น เลขหนังสือ ยังอยู่เหมือนเดิม
--         เปลี่ยนแค่ "ไฟล์จริงไปอยู่ที่ไหน"
--
--         เอกสารที่ยังเดินอยู่ (draft/pending/numbering) ไม่แตะเลย — pipeline ลายเซ็น
--         (_signPdfWorkingCopy / _signedStablePath / _invalidateFileUrl) ทำงานเหมือนเดิม
--         ทุกประการ นี่คือเหตุผลที่วิธีนี้ปลอดภัยกว่าการย้าย Storage ทั้งระบบไป Drive
--
-- คอลัมน์ที่เพิ่ม (ทั้งหมดอยู่บน document_files):
--   archive_url  — ลิงก์เปิดไฟล์บน Google Drive (null = ไฟล์ยังอยู่ใน Supabase Storage)
--   archive_ref  — path ในคลัง Drive เช่น "SaEDU-Archive/2569/กนค.1234/แบบฟอร์ม.pdf"
--                  เก็บไว้เผื่อลิงก์เสีย/ย้ายโฟลเดอร์ จะได้ตามหาไฟล์เจอด้วยมือ
--   archived_at  — ย้ายเมื่อไหร่
--
-- file_path เดิม **ไม่ลบทิ้ง** — เก็บไว้เป็นบันทึกว่าไฟล์เคยอยู่ที่ไหนใน Storage
-- (ถ้าลบ path ทิ้ง สคริปต์ 44 จะมองไม่เห็นความเชื่อมโยง และตรวจสอบย้อนหลังไม่ได้)
--
-- ใครเป็นคนเขียนคอลัมน์พวกนี้: สคริปต์ 47_archive_to_drive.mjs ที่รันด้วย service_role
-- ในเครื่องผู้ดูแล — ไม่มี UI ในเว็บที่เขียนค่านี้ จึงไม่ต้องเพิ่ม RLS policy ใหม่
-- (document_files SELECT เปิดให้ผู้ใช้ที่ล็อกอินอยู่แล้ว หน้าเว็บแค่ "อ่าน" archive_url)
--
-- รันใน Supabase Dashboard → SQL Editor · รันซ้ำได้ (idempotent)
-- ============================================================================

alter table public.document_files add column if not exists archive_url  text;
alter table public.document_files add column if not exists archive_ref  text;
alter table public.document_files add column if not exists archived_at  timestamptz;

comment on column public.document_files.archive_url is
  'ลิงก์ Google Drive ของไฟล์ที่ย้ายออกจาก Storage แล้ว — null = ไฟล์ยังอยู่ใน Supabase Storage';
comment on column public.document_files.archive_ref is
  'path ในคลัง Drive เผื่อลิงก์เสียจะได้ตามหาด้วยมือ';

-- ใช้ตอนหน้ารายละเอียดเช็คว่าเอกสารนี้มีไฟล์ที่ถูกย้ายไปคลังไหม
create index if not exists idx_document_files_archived
  on public.document_files (document_id)
  where archive_url is not null;

-- ตรวจผล
select
  count(*)                                          as ไฟล์ทั้งหมด,
  count(*) filter (where archive_url is not null)   as อยู่ในคลัง_drive,
  count(*) filter (where archive_url is null)       as อยู่ใน_supabase
from public.document_files;
