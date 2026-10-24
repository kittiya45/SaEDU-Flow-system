-- 62_merge_project_names.sql
-- รวมชื่อโครงการที่ซ้ำ/ไม่ใช่โครงการ ในตัวกรอง "ทุกโครงการ" (หน้าเอกสาร / สถิติ / ZIP รายปี)
-- รันบนโปรดักชัน 2026-10-24 — เก็บไว้เป็นบันทึกว่าแถวไหนเคยชื่ออะไร
--
-- 59_normalize_document_fields.sql รวมได้เฉพาะชื่อที่ต่างแค่เว้นวรรค/ตัวพิมพ์/คำนำหน้า "โครงการ" (projKey)
-- ชุดนี้คือที่เหลือ ซึ่งต้องตัดสินใจทีละแถว จึงระบุด้วย id ตรง ๆ ไม่ใช้กฎทั่วไป
--
-- หนังสือขาเข้า (incoming) เก็บชื่อโครงการซ้ำใน description ด้วย และ docFacets() ใช้ description แทนเมื่อ
-- project_name ว่าง จึงต้องแก้ทั้งสองคอลัมน์ ไม่อย่างนั้นค่าเดิมจะโผล่กลับมาในตัวกรอง
--
-- ค่าเดิม → ค่าใหม่
--   โครงการ CU FRESHY GAME 2026 (กีฬาเพื่อนใหม่)            → โครงการ CU Freshy Games 2026 (กีฬาเพื่อนใหม่)
--   โครงการกีฬาเพื่อนใหม่ 2569 (ขาเข้า, จากมหาวิทยาลัย)      → โครงการ CU Freshy Games 2026 (กีฬาเพื่อนใหม่)
--   Born to Speak เพื่อใช้ซ้อมโต้วาที                         → Born to Speak
--   TEFL Chula English Camp 27                              → โครงการ TEFL Camp 27
--   กิจกรรมพบรักนักขนไก่ / พบรักนักขนไก่ (ขาเข้า)             → โครงการพบรักนักขนไก่
--   ชมรมคิดแบบนักวิทย์ (ชื่อชมรม ไม่ใช่โครงการ)                → โครงการค่ายเสริมทักษะวิชาการและการคิดแบบนักวิทยาศาสตร์ (ค่ายคิดวิทย์ 13)
--   การประชุมคณะกรรมการนิสิตฯ สมัยสามัญ ครั้งที่ 2/2569        → การประชุมคณะกรรมการนิสิตฯ
--   การประชุมคณะกรรมการนิสิตฯ สมัยสามัญ ครั้งที่ 3/2569        → การประชุมคณะกรรมการนิสิตฯ
--   การประชุมคณะกรรมการนิสิตฯ สมัยวิสามัญ ครั้งที่ 4/2569      → การประชุมคณะกรรมการนิสิตฯ
--   การประชุมสมัยวิสามัญ ครั้งที่ 2/2569 (ขาเข้า)              → การประชุมคณะกรรมการนิสิตฯ
--   ขอเรียนเชิญร่วมงานวันพูนทรัพย์ ประจาปี 2569 (ขาเข้า)        → ว่าง (หนังสือเชิญ ไม่ใช่โครงการ)

begin;

update documents set project_name = 'โครงการ CU Freshy Games 2026 (กีฬาเพื่อนใหม่)'
where id = '72b46b7b-22fb-451f-9e59-f52d5bfe8f92';
update documents set project_name = 'โครงการ CU Freshy Games 2026 (กีฬาเพื่อนใหม่)', description = 'โครงการ CU Freshy Games 2026 (กีฬาเพื่อนใหม่)'
where id = 'b248404a-1c62-449d-986a-85fb0a96cb95';

update documents set project_name = 'Born to Speak'
where id = '72685891-1e89-4b70-aaca-87c7772a7f1c';

update documents set project_name = 'โครงการ TEFL Camp 27'
where id = '55bb2b76-6b62-4593-b4d7-10ad9580e9c9';

update documents set project_name = 'โครงการพบรักนักขนไก่', description = 'โครงการพบรักนักขนไก่'
where id in ('63602ca1-8650-4da0-884d-ced8ea04e83b', 'd08246fb-ec88-40a4-a69b-14051c22db23');

update documents set project_name = 'โครงการค่ายเสริมทักษะวิชาการและการคิดแบบนักวิทยาศาสตร์ (ค่ายคิดวิทย์ 13)'
where id = 'f7c0fab2-c52f-4e46-9116-cd0cad078f4a';

update documents set project_name = 'การประชุมคณะกรรมการนิสิตฯ'
where id in ('2cde6f23-5cf6-4ad3-bd1f-130856cb0c26', '6aa617c9-4fe3-466b-bae4-a1cccec0b9a3', 'f98c502a-2f68-4a1a-9eaa-a968a894645e');
update documents set project_name = 'การประชุมคณะกรรมการนิสิตฯ', description = 'การประชุมคณะกรรมการนิสิตฯ'
where id = 'c31b5068-48d3-4379-9669-d9a8d5876492';

update documents set project_name = null, description = null
where id = 'dc9ba9ae-b162-419d-a00b-c58589810705';

commit;

-- ตรวจผล: รายชื่อโครงการทั้งหมดตามที่ตัวกรองเห็น
select coalesce(project_name, case when doc_type='incoming' then description end) as project, count(*)
from documents
where coalesce(project_name, case when doc_type='incoming' then description end) is not null
group by 1 order by 1;
