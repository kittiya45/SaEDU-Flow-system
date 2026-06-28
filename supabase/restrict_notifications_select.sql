-- ════════════════════════════════════════════════════════════════════════
-- restrict_notifications_select.sql
-- ปิดช่องอีเมลรั่ว: เดิม notifications_select เปิดให้ผู้ล็อกอินทุกคนอ่านได้
-- (มี recipient_email) → นิสิตคนใดก็ query อีเมลคนอื่นได้ผ่าน REST
--
-- หลังรันไฟล์นี้: เห็น notifications ได้เฉพาะแถวที่ตัวเองเป็นผู้รับ หรือเป็นแอดมิน
--
-- ⚠️ ต้องมาคู่กับการแก้ notif.js (sendOverdueNotifs) ให้เรียก RPC ตรวจ dedup
--    แทนการ SELECT ตรง ๆ ไม่งั้น overdue email จะส่งซ้ำ (dedup มองไม่เห็นแถวของคนอื่น)
--    → deploy frontend ที่แก้แล้วพร้อมกับรัน SQL นี้
--
-- รันใน Supabase Dashboard SQL Editor
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. เปลี่ยน policy SELECT ของ notifications ──
DROP POLICY IF EXISTS notifications_select ON public.notifications;

CREATE POLICY notifications_select ON public.notifications
  FOR SELECT TO public
  USING (
    is_admin()
    OR recipient_id = (SELECT id FROM public.current_profile())
  );

-- ── 2. RPC สำหรับ dedup overdue (security definer — คืนแค่ boolean ไม่รั่วข้อมูล) ──
-- sendOverdueNotifs() ต้องรู้แค่ว่า "มี overdue notif ของเอกสารนี้ใน 24 ชม.ล่าสุดไหม"
-- ไม่จำเป็นต้องเห็นแถว/อีเมล จึงห่อด้วย security definer ให้ข้าม RLS ได้อย่างปลอดภัย
CREATE OR REPLACE FUNCTION public.overdue_notif_exists(p_doc uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.notifications
    WHERE document_id = p_doc
      AND notification_type = 'overdue'
      AND sent_at > now() - interval '24 hours'
  );
$$;

GRANT EXECUTE ON FUNCTION public.overdue_notif_exists(uuid) TO authenticated, anon;

-- ── ตรวจสอบ ──
-- policy ควรมี USING ที่อ้าง recipient_id / is_admin()
SELECT policyname, cmd, qual AS using_expr
FROM pg_policies
WHERE schemaname='public' AND tablename='notifications' AND cmd='SELECT';
