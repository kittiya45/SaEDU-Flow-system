-- ============================================================================
-- SAEDU Flow — atomic forward decline + recall (รันหลัง 22_scale_hardening.sql)
-- ============================================================================
--   1. forward_decline()  — ไม่อนุมัติเอกสารที่ส่งต่อ (atomic)
--   2. recall_document()  — ผู้จัดทำดึงกลับเป็นฉบับร่าง (atomic)
--   3. app_settings.schema_version = '3' (ถ้ายังไม่ถึง v3 จาก 29_cron_overdue.sql)
-- รันใน Supabase Dashboard → SQL Editor (idempotent)

-- ── 1. Forward decline (ส่งคืนผู้จัดทำ) ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.forward_decline(p_doc uuid, p_note text DEFAULT '')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_doc public.documents%ROWTYPE;
  v_first_rev uuid;
  v_step public.workflow_steps%ROWTYPE;
BEGIN
  SELECT id INTO v_uid FROM public.current_profile();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  IF coalesce(trim(p_note), '') = '' THEN
    RAISE EXCEPTION 'note required';
  END IF;

  SELECT * INTO v_doc FROM public.documents WHERE id = p_doc FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'document not found'; END IF;

  IF v_doc.status <> 'completed' THEN
    RAISE EXCEPTION 'document not completed';
  END IF;

  IF v_doc.forwarded_to_id IS NULL THEN
    RAISE EXCEPTION 'document not forwarded';
  END IF;

  IF v_doc.forwarded_to_id IS DISTINCT FROM v_uid
     AND NOT public.is_admin()
     AND NOT public.is_dev() THEN
    RAISE EXCEPTION 'not forwarded to you';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.document_history h
    WHERE h.document_id = p_doc
      AND h.action = 'เจ้าหน้าที่รับเอกสาร'
  ) THEN
    RAISE EXCEPTION 'already accepted';
  END IF;

  SELECT ws.id INTO v_first_rev
  FROM public.workflow_steps ws
  WHERE ws.document_id = p_doc AND ws.step_number > 1
  ORDER BY ws.step_number
  LIMIT 1;

  IF v_first_rev IS NULL THEN
    SELECT ws.id INTO v_first_rev
    FROM public.workflow_steps ws
    WHERE ws.document_id = p_doc
    ORDER BY ws.step_number
    LIMIT 1;
  END IF;

  FOR v_step IN
    SELECT * FROM public.workflow_steps
    WHERE document_id = p_doc
    ORDER BY step_number
    FOR UPDATE
  LOOP
    IF v_step.id = v_first_rev THEN
      UPDATE public.workflow_steps SET
        status = 'rejected',
        action_taken = NULL,
        note = NULL,
        revision_section = NULL,
        action_at = NULL,
        completed_at = NULL,
        rejected_by = v_uid,
        deadline_datetime = NULL
      WHERE id = v_step.id;
    ELSE
      UPDATE public.workflow_steps SET
        status = 'pending',
        action_taken = NULL,
        note = NULL,
        revision_section = NULL,
        action_at = NULL,
        completed_at = NULL,
        rejected_by = NULL,
        deadline_datetime = NULL
      WHERE id = v_step.id;
    END IF;
  END LOOP;

  UPDATE public.documents SET
    status = 'rejected',
    forwarded_to_id = NULL,
    forwarded_at = NULL,
    updated_at = now()
  WHERE id = p_doc;

  INSERT INTO public.document_history (document_id, action, performed_by, note)
  VALUES (p_doc, 'ไม่อนุมัติ — ส่งคืนให้ดำเนินการใหม่', v_uid, p_note);
END;
$$;

GRANT EXECUTE ON FUNCTION public.forward_decline(uuid, text) TO authenticated;

-- ── 2. Recall document (ดึงกลับเป็นฉบับร่าง) ─────────────────────────────
CREATE OR REPLACE FUNCTION public.recall_document(p_doc uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_doc public.documents%ROWTYPE;
  v_step public.workflow_steps%ROWTYPE;
  v_notify uuid[] := '{}';
BEGIN
  SELECT id INTO v_uid FROM public.current_profile();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  SELECT * INTO v_doc FROM public.documents WHERE id = p_doc FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'document not found'; END IF;

  IF v_doc.status <> 'pending' THEN
    RAISE EXCEPTION 'document not pending';
  END IF;

  IF v_doc.created_by IS DISTINCT FROM v_uid
     AND NOT public.is_admin()
     AND NOT public.is_dev() THEN
    RAISE EXCEPTION 'only creator can recall';
  END IF;

  FOR v_step IN
    SELECT * FROM public.workflow_steps
    WHERE document_id = p_doc
    ORDER BY step_number
    FOR UPDATE
  LOOP
    IF v_step.step_number > 1
       AND v_step.status IN ('active', 'done')
       AND v_step.assigned_to IS NOT NULL
       AND v_step.assigned_to <> v_doc.created_by THEN
      v_notify := array_append(v_notify, v_step.assigned_to);
    END IF;

    IF v_step.step_number = 1 THEN
      UPDATE public.workflow_steps SET
        status = 'active',
        action_taken = NULL,
        note = NULL,
        revision_section = NULL,
        action_at = NULL,
        completed_at = NULL,
        rejected_by = NULL,
        deadline_datetime = public.step_deadline_ts(v_step.deadline_days)
      WHERE id = v_step.id;
    ELSE
      UPDATE public.workflow_steps SET
        status = 'pending',
        action_taken = NULL,
        note = NULL,
        revision_section = NULL,
        action_at = NULL,
        completed_at = NULL,
        rejected_by = NULL,
        deadline_datetime = NULL
      WHERE id = v_step.id;
    END IF;
  END LOOP;

  UPDATE public.documents SET
    status = 'draft',
    current_step = 1,
    updated_at = now()
  WHERE id = p_doc;

  INSERT INTO public.document_history (document_id, action, performed_by, note)
  VALUES (
    p_doc,
    'ดึงเอกสารกลับ',
    v_uid,
    'ผู้จัดทำดึงเอกสารกลับเป็นฉบับร่าง — รีเซ็ตขั้นตอนอนุมัติทั้งหมด'
  );

  RETURN jsonb_build_object(
    'notify_ids', to_jsonb(v_notify)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.recall_document(uuid) TO authenticated;

-- ── 3. schema version marker ────────────────────────────────────────────────
INSERT INTO public.app_settings (key, value, label, value_type)
VALUES ('schema_version', '3', 'เวอร์ชัน schema ที่ frontend ต้องการ', 'text')
ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value, updated_at = now();
