-- 34_swap_doc_type_meaning.sql
-- ONE-TIME DATA MIGRATION — รันพร้อมกับตอน deploy โค้ดที่สลับพฤติกรรม incoming/outgoing (2026-07-22)
--
-- บริบท: โค้ด docForm.js/docNum.js/docSign.js/docDetail.js/docList.js/stats.js/homeViews.js/dashboard.js/dev.js
-- ถูกแก้ให้สลับความหมายของ doc_type='incoming'/'outgoing' ทั้งระบบ:
--   เดิม: incoming = มีขั้นตอนอนุมัติ (ประธานฝ่าย/หัวหน้านิสิต/อาจารย์ที่ปรึกษา), outgoing = ฟอร์มง่าย ไม่อนุมัติ
--   ใหม่: outgoing = มีขั้นตอนอนุมัติ, incoming = ฟอร์มง่าย ไม่อนุมัติ
--
-- migration นี้สลับค่า doc_type บนเอกสารที่มีอยู่แล้ว "ทุกแถว ทุกสถานะ" (ไม่ใช่แค่ completed)
-- เพื่อให้ข้อมูลเดิมยังตรงกับโค้ดใหม่ — ไม่แตะคอลัมน์อื่นเลย (ชื่อผู้ส่ง/ผู้รับ, workflow_steps,
-- ไฟล์แนบ, ประวัติ, เลขที่หนังสือ ฯลฯ อยู่เหมือนเดิมทุกอย่าง)
--
-- สำคัญ: รันคำสั่งนี้ให้ใกล้เคียงกับเวลาที่โค้ดใหม่ deploy เสร็จมากที่สุด (ภายในไม่กี่นาที)
-- เพื่อลดช่วงเวลาที่ข้อมูลเก่ากับโค้ดจะไม่ตรงกัน — แนะนำทำช่วงดึกหรือคนใช้งานน้อย
--
-- ตรวจสอบก่อนรัน: SELECT doc_type, status, count(*) FROM documents GROUP BY doc_type, status;

update documents
set doc_type = case doc_type
  when 'incoming' then 'outgoing'
  when 'outgoing' then 'incoming'
  else doc_type
end
where doc_type in ('incoming','outgoing');

-- ตรวจสอบหลังรัน: จำนวนแถวต่อ doc_type ควรสลับกับก่อนรันพอดี (เช่น เดิม incoming=40/outgoing=10 -> หลังรัน incoming=10/outgoing=40)
-- select doc_type, status, count(*) from documents group by doc_type, status order by doc_type, status;
