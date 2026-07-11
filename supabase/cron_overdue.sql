-- ============================================================================
-- SAEDU Flow — cron ตรวจเอกสารเลยกำหนด (รายวัน 01:00 น. ไทย)
-- ============================================================================
-- ต้อง deploy Edge Function ก่อน:
--   npx supabase secrets set OVERDUE_CRON_SECRET=<รหัสสุ่มยาว ๆ>
--   npx supabase functions deploy check-overdue --no-verify-jwt
--
-- ตั้งค่า secret เดียวกันใน app_settings (pg_cron อ่านจากตารางนี้):
--   UPDATE app_settings SET value = '<รหัสเดียวกับ OVERDUE_CRON_SECRET>'
--   WHERE key = 'overdue_cron_secret';
--
-- ทางเลือก: ตั้ง Schedule ใน Supabase Dashboard → Edge Functions → check-overdue
--   cron: 0 18 * * * (UTC) = 01:00 Asia/Bangkok
--   Header: x-cron-secret = <ค่า OVERDUE_CRON_SECRET>
-- ============================================================================

-- คีย์สำหรับ cron (แอดมินใส่ค่า secret จริงหลังรัน)
INSERT INTO public.app_settings (key, value, label, value_type)
VALUES (
  'overdue_cron_secret', '',
  'รหัสลับเรียก check-overdue (ต้องตรงกับ OVERDUE_CRON_SECRET ใน Edge Functions)',
  'text'
)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.app_settings (key, value, label, value_type)
VALUES ('overdue_cron_enabled', 'true', 'เปิด cron ตรวจเลยกำหนด', 'boolean')
ON CONFLICT (key) DO NOTHING;

-- pg_cron + pg_net (Supabase มีให้ — ถ้า extension ไม่มี ให้ใช้ Dashboard Schedule แทน)
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- ลบ job เดิม (ถ้ามี) แล้วสร้างใหม่
DO $$
DECLARE
  jid int;
BEGIN
  SELECT jobid INTO jid FROM cron.job WHERE jobname = 'saedu-check-overdue' LIMIT 1;
  IF jid IS NOT NULL THEN
    PERFORM cron.unschedule(jid);
  END IF;
END $$;

SELECT cron.schedule(
  'saedu-check-overdue',
  '0 18 * * *',
  $$
  SELECT net.http_post(
    url := 'https://jrubupvzltxqstzcpoov.supabase.co/functions/v1/check-overdue',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', coalesce(
        (SELECT value FROM public.app_settings WHERE key = 'overdue_cron_secret'),
        ''
      )
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- อัปเดต schema version
INSERT INTO public.app_settings (key, value, label, value_type)
VALUES ('schema_version', '3', 'เวอร์ชัน schema ที่ frontend ต้องการ', 'text')
ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value, updated_at = now();
