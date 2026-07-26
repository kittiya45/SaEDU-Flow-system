-- 37_fix_workflow_action_doctype.sql
-- แก้ฟังก์ชันฝั่ง DB ให้รู้ความหมายใหม่ของ doc_type (สลับ 2026-07-22)
--
-- ปัญหา: 34_swap_doc_type_meaning.sql สลับเฉพาะ "ข้อมูล" ในตาราง documents
-- แต่ workflow_action() (จาก 22_scale_hardening.sql) และ auto_approve_overdue()
-- (จาก 21_overdue_once_auto_approve.sql) ฝังเงื่อนไขเดิมไว้ในตัวฟังก์ชัน:
--     CASE WHEN doc_type = 'incoming' THEN 'numbering' ELSE 'completed' END
-- ซึ่งเป็น mapping เก่า (incoming = สายอนุมัติ)
--
-- ผลถ้าไม่รันไฟล์นี้: หนังสือ "ขาออก" (สายอนุมัติในความหมายใหม่) เมื่ออนุมัติ
-- ขั้นสุดท้ายครบ จะถูกตั้งเป็น 'completed' ทันที ข้าม 'numbering' → ปุ่ม
-- "ออกเลขหนังสือ" ไม่ขึ้น → เอกสารไม่ได้เลขที่หนังสือจริงเลยสักฉบับ
-- (fallback ใน docDetail.js ที่เขียนถูกแล้วจะไม่ทำงาน เพราะ RPC มีอยู่จริงและ
--  return สำเร็จ — โค้ดใช้ผลจาก RPC เสมอเมื่อไม่ error)
--
-- ★ ลำดับการรัน: วาง 34_swap_doc_type_meaning.sql ต่อด้วยไฟล์นี้ "ในหน้าต่าง
--   SQL Editor เดียวกัน แล้วกด Run ครั้งเดียว" (Supabase ครอบ transaction ให้)
--   และทำหลัง Vercel build เสร็จ เพื่อลดช่วงที่ข้อมูลกับโค้ดไม่ตรงกันให้สั้นที่สุด
--
-- Idempotent — รันซ้ำได้ (create or replace ล้วน)
-- ต้องรันหลัง: 21_overdue_once_auto_approve.sql, 22_scale_hardening.sql

-- ── 1. single source of truth ของ mapping ────────────────────────────────
-- แยกออกมาเป็นฟังก์ชันเดียว เพื่อไม่ให้เงื่อนไขนี้กระจายอยู่หลายที่อีก
-- (สาเหตุของบั๊กรอบนี้คือมันถูก hardcode ซ้ำใน 2 ฟังก์ชัน แล้วแก้ไม่ครบ)
-- ถ้าอนาคตสลับความหมาย incoming/outgoing อีก ให้แก้ที่ฟังก์ชันนี้ที่เดียว
-- แล้ว create or replace ทับ — ฟังก์ชันอื่นไม่ต้องแตะ
CREATE OR REPLACE FUNCTION public.doc_needs_numbering(p_doc_type text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_doc_type = 'outgoing';
$$;

GRANT EXECUTE ON FUNCTION public.doc_needs_numbering(text) TO authenticated;

COMMENT ON FUNCTION public.doc_needs_numbering(text) IS
  'ประเภทเอกสารนี้ต้องผ่านสถานะ numbering (ออกเลขหนังสือ) ก่อน completed หรือไม่ — สลับ 2026-07-22: outgoing = สายอนุมัติ + ออกเลข';


-- ── 2. workflow_action() — เหมือน 22_scale_hardening.sql ทุกอย่าง ────────
--     ต่างแค่บรรทัด v_nst := CASE ... (ใช้ doc_needs_numbering แทน hardcode)
CREATE OR REPLACE FUNCTION public.workflow_action(
  p_doc uuid,
  p_action text,
  p_note text DEFAULT '',
  p_revision_section text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_doc public.documents%ROWTYPE;
  v_cur public.workflow_steps%ROWTYPE;
  v_nx public.workflow_steps%ROWTYPE;
  v_all_done boolean;
  v_nst text;
  v_ns int;
  v_hist text;
BEGIN
  SELECT id INTO v_uid FROM public.current_profile();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF p_action NOT IN ('approve', 'reject') THEN
    RAISE EXCEPTION 'invalid action';
  END IF;

  SELECT * INTO v_doc FROM public.documents WHERE id = p_doc FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'document not found'; END IF;

  IF v_doc.status NOT IN ('pending', 'active', 'rejected') THEN
    RAISE EXCEPTION 'document not in workflow state';
  END IF;

  SELECT * INTO v_cur
  FROM public.workflow_steps
  WHERE document_id = p_doc AND status = 'active'
  ORDER BY step_number
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    SELECT * INTO v_cur
    FROM public.workflow_steps
    WHERE document_id = p_doc
    ORDER BY step_number
    LIMIT 1
    FOR UPDATE;
  END IF;

  IF NOT FOUND THEN RAISE EXCEPTION 'no workflow steps'; END IF;

  IF v_cur.assigned_to IS DISTINCT FROM v_uid
     AND NOT public.is_admin()
     AND NOT public.is_dev() THEN
    RAISE EXCEPTION 'not assigned to active step';
  END IF;

  IF p_action = 'approve' THEN
    UPDATE public.workflow_steps SET
      status = 'done',
      action_taken = 'approve',
      note = coalesce(p_note, ''),
      revision_section = p_revision_section,
      action_at = now(),
      completed_at = now(),
      rejected_by = NULL
    WHERE id = v_cur.id;

    SELECT * INTO v_nx
    FROM public.workflow_steps
    WHERE document_id = p_doc
      AND step_number > v_cur.step_number
      AND status <> 'done'
    ORDER BY step_number
    LIMIT 1;

    IF FOUND THEN
      UPDATE public.workflow_steps SET
        status = 'active',
        deadline_datetime = public.step_deadline_ts(deadline_days),
        action_taken = NULL,
        note = NULL,
        revision_section = NULL,
        action_at = NULL,
        completed_at = NULL,
        rejected_by = NULL
      WHERE id = v_nx.id;
    END IF;

    SELECT NOT EXISTS (
      SELECT 1 FROM public.workflow_steps ws
      WHERE ws.document_id = p_doc
        AND ws.step_number > v_cur.step_number
        AND ws.status <> 'done'
    ) INTO v_all_done;

    IF v_all_done THEN
      -- ★ จุดที่แก้: เดิม hardcode v_doc.doc_type = 'incoming'
      v_nst := CASE WHEN public.doc_needs_numbering(v_doc.doc_type) THEN 'numbering' ELSE 'completed' END;
    ELSE
      v_nst := 'pending';
    END IF;
    v_hist := 'อนุมัติ / ลงนาม';

  ELSE
    UPDATE public.workflow_steps SET
      status = 'rejected',
      action_taken = 'reject',
      note = coalesce(p_note, ''),
      revision_section = p_revision_section,
      action_at = now(),
      completed_at = NULL,
      rejected_by = v_uid
    WHERE id = v_cur.id;

    v_all_done := false;
    v_nst := 'rejected';
    v_hist := 'ส่งคืนแก้ไขไปยังผู้จัดทำ';
  END IF;

  v_ns := least(coalesce(v_doc.current_step, 1) + 1, coalesce(v_doc.total_steps, 1));

  UPDATE public.documents SET
    status = v_nst,
    current_step = v_ns,
    updated_at = now()
  WHERE id = p_doc;

  INSERT INTO public.document_history (document_id, action, performed_by, note)
  VALUES (p_doc, v_hist, v_uid, coalesce(p_note, ''));

  RETURN jsonb_build_object(
    'status', v_nst,
    'all_done', v_all_done,
    'current_step', v_ns,
    'cur_step_number', v_cur.step_number,
    'cur_step_id', v_cur.id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.workflow_action(uuid, text, text, text) TO authenticated;


-- ── 3. auto_approve_overdue() — เหมือน 21_overdue_once_auto_approve.sql ──
--     ต่างแค่ 2 บรรทัดที่เคย hardcode doc.doc_type = 'incoming'
--     (ค่าที่ return 'approved_numbering'/'approved_completed' ต้องคงเดิม —
--      notif.js:386-387 ใช้ค่านี้เลือกอีเมลที่จะส่งต่อให้ผู้จัดทำ)
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
      -- ★ จุดที่แก้: เดิม hardcode doc.doc_type = 'incoming'
      status = CASE WHEN public.doc_needs_numbering(doc.doc_type) THEN 'numbering' ELSE 'completed' END,
      current_step = least(coalesce(doc.current_step,1)+1, coalesce(doc.total_steps,1)),
      updated_at = now()
      WHERE id = p_doc;

    INSERT INTO public.document_history(document_id, action, performed_by, note)
      VALUES (p_doc, 'อนุมัติอัตโนมัติ (เลยกำหนด)',
              coalesce(act.assigned_to, doc.created_by),
              'ระบบอนุมัติขั้นตอนสุดท้าย "'||coalesce(act.step_name,'')||'" ให้อัตโนมัติ เนื่องจากเลยกำหนดและไม่มีการดำเนินการหลังแจ้งเตือนภายใน '||grace||' วันทำการ (ไม่มีลายเซ็นฝังในไฟล์)');

    -- ★ จุดที่แก้: เดิม hardcode doc.doc_type = 'incoming'
    RETURN CASE WHEN public.doc_needs_numbering(doc.doc_type) THEN 'approved_numbering' ELSE 'approved_completed' END;
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
-- คาดหวัง: needs_numbering_outgoing = true, needs_numbering_incoming = false,
--          leftover_old_logic = 0 (ไม่มีฟังก์ชันไหนใช้เงื่อนไขเก่าอยู่แล้ว)
-- หมายเหตุ: ต้องเทียบกับ 'CASE WHEN ...doc_type' ไม่ใช่แค่ 'doc_type = ''incoming'''
-- เพราะข้อความนั้นยังปรากฏใน comment ★ ที่อธิบายจุดที่แก้ (false positive)
SELECT
  public.doc_needs_numbering('outgoing') AS needs_numbering_outgoing,
  public.doc_needs_numbering('incoming') AS needs_numbering_incoming,
  (SELECT count(*) FROM pg_proc p
     JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname IN ('workflow_action','auto_approve_overdue')
     AND (p.prosrc LIKE '%CASE WHEN v_doc.doc_type = ''incoming''%'
       OR p.prosrc LIKE '%CASE WHEN doc.doc_type = ''incoming''%')) AS leftover_old_logic;
