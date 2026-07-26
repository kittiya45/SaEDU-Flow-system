-- 33_add_project_name_column.sql
-- เพิ่มคอลัมน์ project_name บน documents — เก็บชื่อโครงการ/กิจกรรมแยกจาก description
-- ใช้ร่วมกันทั้ง 2 ประเภทเอกสาร (ขาเข้า/ขาออก) เพื่อให้ "สรุปโครงการประจำปี" (stats.js/homeViews.js/dashboard.js/docList.js)
-- ดึงข้อมูลโครงการจากทั้งสองประเภทมารวมกันได้ในคอลัมน์เดียว แทนที่จะพึ่ง description ซึ่งมีความหมายต่างกันไปตามประเภทเอกสาร
-- Idempotent — ปลอดภัยที่จะรันซ้ำ
alter table documents add column if not exists project_name text;
