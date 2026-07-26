-- ════════════════════════════════════════════════════════════════════════
-- 21_overdue_once_auto_approve.sql
-- นโยบายใหม่สำหรับเอกสารเลยกำหนด (แทนการเตือนซ้ำรายวัน):
--   1. อีเมลเตือนเลยกำหนด ส่งครั้งเดียวต่อเอกสาร (เดิม: วันละครั้ง)
--   2. หลังเตือนแล้ว ถ้ายังไม่มีการดำเนินการภายใน sla_cascade_days วันทำการ
--      (ค่าเริ่มต้น 3 — แก้ได้ใน "ตั้งค่าระบบ") ระบบจัดการให้อัตโนมัติ เฉพาะ 2 กรณี:
--        a) เอกสาร pending ที่ค้างอยู่ "ขั้นตอนสุดท้าย" ของ workflow
--           → อนุมัติขั้นตอนนั้นให้ (ไม่มีลายเซ็นฝังใน PDF — บันทึกใน history ชัดเจน)
--           → เอกสารไป numbering (ขาเข้า) / completed (ประเภทอื่น) ตาม flow ปกติ
--        b) เอกสาร completed ที่ส่งต่อแล้ว แต่ผู้รับปลายทางยังไม่กด "รับเอกสาร"
--           → บันทึก 'เจ้าหน้าที่รับเอกสาร' ให้ (ข้อความเดียวกับการกดรับจริง
--             เพราะ docDetail.js/layout.js filter ด้วย string นี้)
--      เอกสารที่ปิด notify_overdue จะไม่ถูกเตือนและไม่ถูกจัดการอัตโนมัติ
--
-- ทำเป็น RPC (security definer) เพราะ:
--   - ผู้ที่ล็อกอินตอนระบบตรวจ (sendOverdueNotifs หลัง login) มักไม่ใช่
--     ผู้มีสิทธิ์เขียนเอกสารนั้นตาม RLS — client เขียนตรงไม่ได้
--   - การเปลี่ยนสถานะแตะ 3 ตาราง ต้อง atomic (ฟังก์ชัน = 1 transaction)
--   - เงื่อนไขเวลา/ขั้นตอนถูกตรวจฝั่งเซิร์ฟเวอร์ ผู้ใช้เร่งเวลาเองไม่ได้
--
-- ⚠️ deploy คู่กับ frontend (notif.js) ที่เรียก overdue_notif_sent_at /
--    auto_approve_overdue — รัน SQL ก่อนหรือหลัง deploy ก็ได้ (โค้ดมี fallback)
-- รันใน Supabase Dashboard SQL Editor
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. เตือนครั้งเดียว: dedup แบบตลอดอายุเอกสาร ──────────────────────────
-- แทนที่ของเดิม (หน้าต่าง 24 ชม.) — client เก่าที่ยังเรียกฟังก์ชันนี้
-- จะได้พฤติกรรม "ครั้งเดียว" ทันทีโดยไม่ต้องรอ deploy frontend
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
  );
$$;
GRANT EXECUTE ON FUNCTION public.overdue_notif_exists(uuid) TO authenticated, anon;

-- คืนเวลาส่งเตือนครั้งแรก (null = ยังไม่เคยเตือน) — notif.js ใช้ตัวนี้เป็นหลัก
-- ทั้ง dedup และคำนวณ grace period ก่อนอนุมัติอัตโนมัติ
CREATE OR REPLACE FUNCTION public.overdue_notif_sent_at(p_doc uuid)
RETURNS timestamptz
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT min(sent_at) FROM public.notifications
  WHERE document_id = p_doc AND notification_type = 'overdue';
$$;
GRANT EXECUTE ON FUNCTION public.overdue_notif_sent_at(uuid) TO authenticated, anon;

-- ── 2. helper: บวกวันทำการ (จ.-ศ.) — ตรรกะเดียวกับ addWorkingDays ใน utils.js ──
CREATE OR REPLACE FUNCTION public.add_working_days(p_from timestamptz, p_days int)
RETURNS timestamptz
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  d timestamptz := p_from;
  i int := 0;
BEGIN
  WHILE i < p_days LOOP
    d := d + interval '1 day';
    IF extract(isodow FROM d) < 6 THEN i := i + 1; END IF;
  END LOOP;
  RETURN d;
END;
$$;

-- ── 3. อนุมัติ/รับเอกสารอัตโนมัติเมื่อเลยกำหนดเกิน grace period ────────────
-- คืนค่า: 'approved_numbering' | 'approved_completed' | 'accepted_forward'
--        หรือรหัสเหตุผลที่ไม่ทำ ('in_grace', 'not_last_step', ...)
CREATE OR REPLACE FUNCTION public.auto_approve_overdue(p_doc uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  doc record;
  act record;
  warn_at timestamptz;
  grace int;
BEGIN
  IF auth.uid() IS NULL THEN RETURN 'not_authenticated'; END IF;

  SELECT * INTO doc FROM public.documents WHERE id = p_doc FOR UPDATE;
  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  IF coalesce(doc.notify_overdue, true) = false THEN RETURN 'notify_off'; END IF;
  IF doc.due_date IS NULL OR doc.due_date >= current_date THEN RETURN 'not_overdue'; END IF;

  -- ต้องเตือนก่อนเสมอ แล้วรอครบ grace period (วันทำการ) นับจากเวลาที่เตือนจริง
  SELECT min(sent_at) INTO warn_at FROM public.notifications
    WHERE document_id = p_doc AND notification_type = 'overdue';
  IF warn_at IS NULL THEN RETURN 'no_warning_yet'; END IF;

  SELECT coalesce(nullif(value,'')::int, 3) INTO grace
    FROM public.app_settings WHERE key = 'sla_cascade_days';
  IF grace IS NULL THEN grace := 3; END IF;
  IF now() < public.add_working_days(warn_at, grace) THEN RETURN 'in_grace'; END IF;

  -- กรณี a) ค้างขั้นตอนสุดท้ายของ workflow
  IF doc.status = 'pending' THEN
    SELECT * INTO act FROM public.workflow_steps
      WHERE document_id = p_doc AND status = 'active'
      ORDER BY step_number DESC LIMIT 1;
    IF NOT FOUND THEN RETURN 'no_active_step'; END IF;
    IF EXISTS (SELECT 1 FROM public.workflow_steps
               WHERE document_id = p_doc AND step_number > act.step_number
                 AND status <> 'done') THEN
      RETURN 'not_last_step';
    END IF;

    UPDATE public.workflow_steps SET
      status = 'done', action_taken = 'approve',
      note = 'อนุมัติอัตโนมัติโดยระบบ — เลยกำหนดและไม่มีการดำเนินการหลังแจ้งเตือนภายใน '||grace||' วันทำการ',
      action_at = now(), completed_at = now()
      WHERE id = act.id;

    UPDATE public.documents SET
      status = CASE WHEN doc.doc_type = 'incoming' THEN 'numbering' ELSE 'completed' END,
      current_step = least(coalesce(doc.current_step,1)+1, coalesce(doc.total_steps,1)),
      updated_at = now()
      WHERE id = p_doc;

    INSERT INTO public.document_history(document_id, action, performed_by, note)
      VALUES (p_doc, 'อนุมัติอัตโนมัติ (เลยกำหนด)',
              coalesce(act.assigned_to, doc.created_by),
              'ระบบอนุมัติขั้นตอนสุดท้าย "'||coalesce(act.step_name,'')||'" ให้อัตโนมัติ เนื่องจากเลยกำหนดและไม่มีการดำเนินการหลังแจ้งเตือนภายใน '||grace||' วันทำการ (ไม่มีลายเซ็นฝังในไฟล์)');

    RETURN CASE WHEN doc.doc_type = 'incoming' THEN 'approved_numbering' ELSE 'approved_completed' END;
  END IF;

  -- กรณี b) รอผู้รับปลายทางกดรับเอกสาร (ส่งต่อแล้วเงียบ)
  IF doc.status = 'completed' AND doc.forwarded_to_id IS NOT NULL THEN
    -- เช็คการรับด้วย LIKE ให้ตรงกับ client (indexOf('เจ้าหน้าที่รับเอกสาร'))
    IF EXISTS (SELECT 1 FROM public.document_history
               WHERE document_id = p_doc
                 AND action LIKE '%เจ้าหน้าที่รับเอกสาร%') THEN
      RETURN 'already_accepted';
    END IF;

    -- action ต้องเป็น 'เจ้าหน้าที่รับเอกสาร' เป๊ะ ๆ — layout.js filter ด้วย eq.
    INSERT INTO public.document_history(document_id, action, performed_by, note)
      VALUES (p_doc, 'เจ้าหน้าที่รับเอกสาร', doc.forwarded_to_id,
              'รับเอกสารอัตโนมัติโดยระบบ เนื่องจากเลยกำหนดและไม่มีการดำเนินการหลังแจ้งเตือนภายใน '||grace||' วันทำการ');

    -- ล้าง forwarded state — ให้สอดคล้องกับ forward_accept() และไม่ให้ overdue scan เจอซ้ำ
    UPDATE public.documents SET
      forwarded_to_id = NULL,
      forwarded_at = NULL,
      updated_at = now()
    WHERE id = p_doc;

    RETURN 'accepted_forward';
  END IF;

  RETURN 'not_eligible';
END;
$$;
GRANT EXECUTE ON FUNCTION public.auto_approve_overdue(uuid) TO authenticated;

-- ── ตรวจสอบหลังรัน ──
SELECT proname, prosecdef AS security_definer
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND proname IN ('overdue_notif_exists','overdue_notif_sent_at','add_working_days','auto_approve_overdue');
