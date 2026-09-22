-- ============================================================================
-- SAEDU Flow — "เตือนแล้ว" ต้องหมายถึงเตือนถึงจริง ไม่ใช่แค่พยายามส่ง
-- รันใน: Supabase Dashboard → SQL Editor → New query → Run   (idempotent รันซ้ำได้)
--
-- ปัญหาที่แก้ (พบ 2026-09-22 ตอนไล่ดูแบนเนอร์ "อีเมลแจ้งเตือนส่งไม่สำเร็จ"):
--   ทั้ง overdue_notif_exists / overdue_notif_sent_at (21_overdue_once_auto_approve.sql)
--   และคิวรี min(sent_at) ที่ฝังอยู่ใน auto_approve_overdue นับแถว notifications ทุกแถว
--   ที่ notification_type='overdue' โดย *ไม่ดู status* — แถวที่ status='failed' (Brevo ปฏิเสธ)
--   จึงถูกนับว่า "เตือนแล้ว" ด้วย ผลคือสองอย่างพร้อมกัน:
--     1. นโยบาย "เตือนครั้งเดียวตลอดกาล" กลืนการเตือนครั้งเดียวนั้นทิ้ง — ผู้รับไม่มีวันได้รับอีก
--     2. นาฬิกา grace period เริ่มเดินจากการเตือนที่ไม่เคยถึงใคร พอครบ sla_cascade_days
--        auto_approve_overdue จะอนุมัติขั้นตอนสุดท้ายให้เอง ทั้งที่คนที่ต้องเซ็นไม่เคยรู้เรื่อง
--   เกิดจริงแล้วกับ กนค. 1065001/2569 (15 ก.ย. 69 อีเมลเตือนล้มทั้ง 2 ฉบับ) — รอดเพราะ
--   เจ้าหน้าที่บังเอิญมากดรับเองวันที่ 17 ก่อนนาฬิกาจะครบ
--
-- แก้โดยเปลี่ยนนิยาม "เตือนแล้ว" เป็น status <> 'failed' ทั้งสามจุด:
--   - ส่งอีเมลไม่สำเร็จ และ LINE ก็ไม่สำเร็จ → ถือว่ายังไม่เคยเตือน รอบถัดไปเตือนใหม่
--   - ส่งได้ทางใดทางหนึ่ง (อีเมลหรือ LINE — sendLineWithLog เขียน notification_type เดียวกัน)
--     → ถือว่าเตือนแล้ว เหมือนเดิมทุกประการ
--   - แถว status='skipped' (ไม่มีทั้งอีเมลและ LINE ให้ส่ง) ยังนับเป็นเตือนแล้วเหมือนเดิม
--     ไม่งั้นคนที่ติดต่อไม่ได้เลยจะโดนสแกนซ้ำทุกวันตลอดไป
--
-- ⚠️ ผลข้างเคียงที่ตั้งใจ: เอกสารที่ทุกช่องทางล้มจะถูกเตือนใหม่ในรอบถัดไป (วันละครั้ง)
--    จนกว่าจะส่งสำเร็จ — ตามสถิติ 3 เดือนแรกล้ม 15 จาก 1,388 ฉบับ (1.1%) จึงแทบไม่เพิ่มอีเมล
--    และดีกว่าปล่อยให้ระบบอนุมัติแทนคนโดยอ้างการเตือนที่ไม่มีอยู่จริง
--
-- ต้องรันหลัง: 21_overdue_once_auto_approve.sql (และ 55_harden_functions_and_storage.sql
--              ถ้ารันแล้ว — ไฟล์นี้ตั้ง GRANT/REVOKE ให้ตรงกับ 55 ไว้แล้ว ไม่ต้องรัน 55 ซ้ำ)
-- ฝั่งหน้าเว็บ: ไม่ต้องแก้และไม่ต้อง deploy พร้อมกัน — notif.js เรียก RPC ตัวเดิมชื่อเดิม
-- ============================================================================

-- ── 1. มีการเตือนที่ "ถึงผู้รับ" แล้วหรือยัง ────────────────────────────────
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
      AND coalesce(status,'') <> 'failed'
  );
$$;

-- ── 2. เวลาที่เตือนสำเร็จครั้งแรก (null = ยังไม่เคยเตือนถึงใครเลย) ──────────
-- notif.js ใช้ตัวนี้เป็นหลัก ทั้ง dedup และคำนวณ grace period
CREATE OR REPLACE FUNCTION public.overdue_notif_sent_at(p_doc uuid)
RETURNS timestamptz
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT min(sent_at) FROM public.notifications
  WHERE document_id = p_doc
    AND notification_type = 'overdue'
    AND coalesce(status,'') <> 'failed';
$$;

-- ── 3. auto_approve_overdue: จุดเดียวที่แก้คือคิวรี warn_at ─────────────────
-- (ที่เหลือคัดลอกจาก 21_overdue_once_auto_approve.sql ทั้งดุ้น — แก้ที่นั่นด้วยถ้าจะแก้ตรรกะอื่น)
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

  -- ต้องเตือน "สำเร็จ" ก่อนเสมอ แล้วรอครบ grace period (วันทำการ) นับจากเวลาที่เตือนถึงจริง
  -- status='failed' ไม่นับ — ไม่งั้นระบบอนุมัติแทนคนโดยอ้างอีเมลที่ไม่เคยส่งถึง
  SELECT min(sent_at) INTO warn_at FROM public.notifications
    WHERE document_id = p_doc
      AND notification_type = 'overdue'
      AND coalesce(status,'') <> 'failed';
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

-- ── 4. สิทธิ์: ตามแบบเดียวกับ 55_harden_functions_and_storage.sql ───────────
-- (CREATE OR REPLACE ไม่ล้าง GRANT เดิม แต่ประกาศซ้ำให้ชัดว่าใครเรียกได้ เผื่อ DB ที่ยังไม่ได้รัน 55)
REVOKE EXECUTE ON FUNCTION public.overdue_notif_exists(uuid)  FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.overdue_notif_sent_at(uuid) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.auto_approve_overdue(uuid)  FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.overdue_notif_exists(uuid)  TO authenticated, service_role;
GRANT  EXECUTE ON FUNCTION public.overdue_notif_sent_at(uuid) TO authenticated, service_role;
GRANT  EXECUTE ON FUNCTION public.auto_approve_overdue(uuid)  TO authenticated, service_role;

-- ── ตรวจสอบหลังรัน ──
-- คาดหวัง: ทั้ง 3 ฟังก์ชันมี 'failed' อยู่ในนิยาม (คือกรองสถานะแล้ว)
SELECT p.proname,
       (pg_get_functiondef(p.oid) LIKE '%failed%') AS กรอง_failed_แล้ว
FROM pg_proc p
WHERE p.pronamespace = 'public'::regnamespace
  AND p.proname IN ('overdue_notif_exists','overdue_notif_sent_at','auto_approve_overdue')
ORDER BY 1;

-- เอกสารที่เคย "เตือนล้มอย่างเดียว" — หลังรันไฟล์นี้จะถูกเตือนใหม่ในรอบถัดไป
SELECT d.doc_number, d.title, d.status, min(n.sent_at) AS เตือนล้มครั้งแรก
FROM public.notifications n
JOIN public.documents d ON d.id = n.document_id
WHERE n.notification_type = 'overdue'
GROUP BY d.id, d.doc_number, d.title, d.status
HAVING bool_and(n.status = 'failed')
ORDER BY 4 DESC;
