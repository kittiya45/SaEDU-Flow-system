-- ============================================================================
-- SAEDU Flow — backfill position_code for club officers / mislabeled กนค. heads
-- Run this entire file in: Supabase Dashboard → SQL Editor → New query → Run
-- Uses your own dashboard session (DB owner) — never needs the service_role key.
-- One-time data fix — re-running is safe (each UPDATE is scoped by exact
-- current `department` text, so already-migrated rows won't match again
-- once their position_code is set... actually position_code isn't part of
-- the WHERE clause, so this IS safe to re-run/idempotent either way).
-- ============================================================================
--
-- Problem this fixes:
-- users.position_code (the GNK-* lookup in config.js's POSS/PTH/GNK_NUM/PR,
-- read by docNum.js's showNumModal() to compute the {pos} digits of an
-- outgoing document number) was never set for club officers or for several
-- กนค.-committee department heads — instead, whoever filled in their profile
-- typed the role + department/club as free text into `department`
-- ("{role} — {name}", em dash separator), a field showNumModal() never
-- reads. Result: these users' documents were numbered with pos='00' /
-- "ไม่ระบุตำแหน่ง" regardless of their real role.
--
-- This script requires the 4 new position codes added to config.js's POSS/
-- PTH/PR/GNK_NUM (GNK-CPR/GNK-CVP/GNK-CSEC/GNK-CTRS) to already be deployed
-- — otherwise the frontend won't recognize these position_code values.
--
-- Club identity itself is NOT touched here — `department` is left as-is
-- (still the only place the club name lives; the {club} suffix in an
-- outgoing doc number is still chosen via the manual dropdown at numbering
-- time, unchanged by this script).

-- 31 unambiguous club officers (role prefix exactly matches the convention) --
update public.users set position_code='GNK-CPR' where user_type='gnk' and department like 'ประธานชมรม —%';
update public.users set position_code='GNK-CVP' where user_type='gnk' and department like 'รองประธานชมรม —%';
update public.users set position_code='GNK-CSEC' where user_type='gnk' and department like 'เลขานุการชมรม —%';
update public.users set position_code='GNK-CTRS' where user_type='gnk' and department like 'เหรัญญิกชมรม —%';

-- 3 club presidents mislabeled "ประธานฝ่าย — {club}" instead of "ประธานชมรม — {club}" --
update public.users set position_code='GNK-CPR'
  where id in (
    '582b0365-6fd1-4abf-943b-59cecf2f7e73', -- กชรัตน์ ชัยวรานุรักษ์ — ชมรมต้นกล้าคณิตศาสตร์
    'ecfaae9e-1061-4ac0-8e47-22bc68d461ac', -- ทิพธัญญพร ทองเกลี้ยง — ชมรมนิสิตเพื่อนที่ปรึกษาเพื่อการพัฒนาสังคม (ICU CLUB)
    '24e5238d-f434-4527-b1a3-bf36379a8d2f'  -- ปุนนรินทร์ วัฒนไทยสวัสดิ์ — ชมรมแบดมินตัน
  );

-- 9 rows that are actually existing กนค.-committee positions, just labeled
-- "ประธานฝ่าย — {PTH label}" in department instead of having position_code set --
update public.users set position_code='GNK-SPT'  where id='41e1f759-2707-4671-a28d-a21e5b3f69fc'; -- นพรัตน์ รังสิมานนท์ — ฝ่ายกีฬา
update public.users set position_code='GNK-STR'  where id='4e965ed9-fddb-4db1-b671-a13f0abaa2fc'; -- ธิญดา เมธากรศิริ — ฝ่ายนิสิตสัมพันธ์
update public.users set position_code='GNK-SDV'  where id='0f11f7dc-e384-45d1-9dde-f65ed2a7544b'; -- พีชญุตม์ สุขเกษม — ฝ่ายพัฒนาสังคมและบำเพ็ญประโยชน์
update public.users set position_code='GNK-ACA'  where id='a93d73df-52d9-435f-b34e-d9af9fd71547'; -- ชนันธร ณัฏฐ์เศรษฐ์ — ฝ่ายวิชาการ
update public.users set position_code='GNK-ART'  where id='b7aebb5a-1977-477e-92ff-3f1bb4a95b1b'; -- ธนพัฒน์ เทศนอก — ฝ่ายศิลปะและวัฒนธรรม
update public.users set position_code='GNK-VPR'  where id='26dfc60c-b574-442e-ae97-a3fe6337d59f'; -- สรรวัชญ์ ลี้จันทรากุล — รองหัวหน้านิสิต คนที่ 1
update public.users set position_code='GNK-VPR2' where id='5db18ff2-e131-4f03-b318-9ea11771f29e'; -- ธัญชนก ล้วนศิริ — รองหัวหน้านิสิต คนที่ 2
update public.users set position_code='GNK-PRE'  where id='43fe3f46-c019-4375-a46e-98ae3eb845e4'; -- กิตตินันท์ พูนดี — หัวหน้านิสิต
update public.users set position_code='GNK-TRS'  where id='20b7445a-5867-4713-a244-e145943e8bc3'; -- นุสรา สายสลำ — เหรัญญิก

-- NOT touched (left position_code as-is, needs a human decision):
--   edc9e7f3-7d17-48ae-97b3-09a8e54f2648 ธนัชชา เสาเวียง — department "ประธานฝ่าย — หัวชั้นปี"
--   doesn't match any existing POSS/PTH label (GNK-YR1..YR4 are each a single
--   specific year, "หัวชั้นปี" doesn't say which) — confirm the intended
--   position_code with this user/admin and set it manually via the
--   "จัดการผู้ใช้" edit-profile UI once known.
--   วิทยา ถายะ — department "สมาชิกชมรม — ชมรมวอลเลย์บอล" is a plain club
--   member, not an officer — no GNK-C* code applies, left untouched.
