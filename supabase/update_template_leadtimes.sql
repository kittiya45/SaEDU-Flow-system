-- ============================================================================
-- SAEDU Flow — Set lead-time requirements on existing form_templates rows
-- Run this entire file in: Supabase Dashboard → SQL Editor → New query → Run
--
-- Matches each row by its existing numeric prefix (e.g. "1.1", "2.7") in the
-- `name` column — the same prefix templates.js already parses for sorting
-- (see _tmplNumParts in templates.js) — so it works regardless of the exact
-- wording after the number. Safe to re-run (idempotent UPDATEs).
--
-- NOTE: item "2.8" was not provided and is intentionally skipped — fill it
-- in manually via the templates page ("แก้ไข" button) once you have the text.
-- ============================================================================

update form_templates set description = 'ไม่ต่ำกว่า 4 สัปดาห์ก่อนเริ่มกิจกรรม/โครงการ'
  where is_active = true and name ~ '^1\.1(\D|$)';

update form_templates set description = 'ไม่ต่ำกว่า 4 สัปดาห์ก่อนเริ่มกิจกรรม/โครงการ'
  where is_active = true and name ~ '^1\.2(\D|$)';

update form_templates set description = 'ไม่ต่ำกว่า 1 สัปดาห์'
  where is_active = true and name ~ '^1\.3(\D|$)';

update form_templates set description = 'ไม่ต่ำกว่า 1 สัปดาห์ก่อนเริ่มกิจกรรม/โครงการ'
  where is_active = true and name ~ '^1\.4(\D|$)';

update form_templates set description = 'ไม่ต่ำกว่า 3 สัปดาห์ก่อนเริ่มกิจกรรม/โครงการ'
  where is_active = true and name ~ '^2\.1(\D|$)';

update form_templates set description = 'ไม่ต่ำกว่า 3 สัปดาห์ก่อนเริ่มกิจกรรม/โครงการ'
  where is_active = true and name ~ '^2\.2(\D|$)';

update form_templates set description = 'ไม่ต่ำกว่า 3 สัปดาห์ก่อนเริ่มกิจกรรม/โครงการ'
  where is_active = true and name ~ '^2\.3(\D|$)';

update form_templates set description = 'ไม่ต่ำกว่า 3 สัปดาห์ก่อนเริ่มกิจกรรม/โครงการ'
  where is_active = true and name ~ '^2\.4(\D|$)';

update form_templates set description = 'ไม่ต่ำกว่า 3 สัปดาห์ก่อนเริ่มกิจกรรม/โครงการ'
  where is_active = true and name ~ '^2\.5(\D|$)';

update form_templates set description = 'ไม่ต่ำกว่า 3 สัปดาห์ก่อนเริ่มกิจกรรม/โครงการ'
  where is_active = true and name ~ '^2\.6(\D|$)';

update form_templates set description = 'ไม่ต่ำกว่า 2 สัปดาห์ก่อนเริ่มกิจกรรม/โครงการ'
  where is_active = true and name ~ '^2\.7(\D|$)';

update form_templates set description = 'ไม่ต่ำกว่า 3 สัปดาห์ก่อนเริ่มกิจกรรม/โครงการ (ต้องประสานกับกายภาพก่อน)'
  where is_active = true and name ~ '^2\.9(\D|$)';

-- Sanity check — confirm all 12 rows picked up the new description.
select name, description from form_templates
  where name ~ '^(1\.[1-4]|2\.[1-7]|2\.9)(\D|$)'
  order by name;
