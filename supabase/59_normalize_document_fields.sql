-- 59_normalize_document_fields.sql
-- ทำความสะอาดข้อมูลข้อความในตาราง documents ที่กรอกไม่สม่ำเสมอ จนตัวกรอง/รายงานโครงการแตกกลุ่ม
-- (พบ 2026-10-13: "Born to Speak" / "โครงการ Born to Speak" / "โครงการBorn to speak" เป็น 3 ตัวเลือกในตัวกรอง,
--  เว้นวรรคซ้อน "ค่ายคณิตศาสตร์สัญจร  ครั้งที่ 26", และหนังสือขาเข้า 10 จาก 14 ฉบับมีชื่อโครงการเฉพาะใน description)
--
-- ไม่เปลี่ยน "ความหมาย" ของคอลัมน์ใด — รหัสชมรม/ประเภทจดหมาย/ตำแหน่งของหนังสือขาเข้า
-- (from_department / subject_line / addressed_to) ยังเป็นรหัสเหมือนเดิม เพราะ docNum.js ใช้ประกอบเลขหนังสือ
-- ฝั่งหน้าเว็บอ่านได้ทั้งก่อนและหลังรันสคริปต์นี้ (docFacets/projKey ใน utils.js) จึงรันเมื่อไรก็ได้
--
-- วิธีใช้: รันส่วน PREVIEW ก่อน ตรวจผล แล้วจึงรันส่วน APPLY (อยู่ใน transaction เดียว)

-- กุญแจเดียวกับ projKey() ใน utils.js: ตัดเว้นวรรคเกิน → ตัวพิมพ์เล็ก → ตัดคำนำหน้า "โครงการ" → ตัดเว้นวรรคทั้งหมด
create or replace function pg_temp.proj_key(t text) returns text language sql immutable as $$
  select regexp_replace(regexp_replace(lower(btrim(regexp_replace(coalesce(t,''), '\s+', ' ', 'g'))), '^โครงการ\s*', ''), '\s+', '', 'g')
$$;
create or replace function pg_temp.norm(t text) returns text language sql immutable as $$
  select nullif(btrim(regexp_replace(coalesce(t,''), '\s+', ' ', 'g')), '')
$$;

-- ═══════════════ PREVIEW ═══════════════
-- 1) ชื่อโครงการหลังทำความสะอาด (เทียบค่าเดิม → ค่าใหม่ทีละแถว)
with src as (
  select id, doc_number, project_name as old,
         pg_temp.norm(coalesce(project_name, case when doc_type='incoming' then description end)) as v
  from documents
), canon as (
  select distinct on (pg_temp.proj_key(v)) pg_temp.proj_key(v) k, v as label
  from (select v, count(*) n from src where v is not null group by v) x
  order by pg_temp.proj_key(v), n desc, length(v)
)
select s.doc_number, s.old, c.label as new
from src s join canon c on c.k = pg_temp.proj_key(s.v)
where s.old is distinct from c.label
order by c.label, s.doc_number;

-- 2) ชื่อเรื่อง / ชื่อผู้ส่งที่มีเว้นวรรคเกิน
select doc_number, title, from_department from documents
where title is distinct from pg_temp.norm(title)
   or (doc_type='outgoing' and from_department is distinct from pg_temp.norm(from_department));

-- ═══════════════ APPLY ═══════════════
begin;

with src as (
  select id, pg_temp.norm(coalesce(project_name, case when doc_type='incoming' then description end)) as v
  from documents
), canon as (
  select distinct on (pg_temp.proj_key(v)) pg_temp.proj_key(v) k, v as label
  from (select v, count(*) n from src where v is not null group by v) x
  order by pg_temp.proj_key(v), n desc, length(v)
)
update documents d set project_name = c.label
from src s join canon c on c.k = pg_temp.proj_key(s.v)
where d.id = s.id and d.project_name is distinct from c.label;

update documents set title = pg_temp.norm(title)
where title is distinct from pg_temp.norm(title) and pg_temp.norm(title) is not null;

-- ขาออกเท่านั้น — ขาเข้าเก็บรหัสชมรมใน from_department
update documents set from_department = pg_temp.norm(from_department)
where doc_type = 'outgoing' and from_department is distinct from pg_temp.norm(from_department);

commit;

-- ตรวจผล: ควรได้ 0 แถว
select pg_temp.proj_key(project_name) k, array_agg(distinct project_name)
from documents where project_name is not null
group by 1 having count(distinct project_name) > 1;
