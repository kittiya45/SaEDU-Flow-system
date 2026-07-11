-- ============================================================================
-- SAEDU Flow — scale & security hardening (รันหลัง migration_auth_rls +
-- create_dev_role + overdue_once_auto_approve + tighten_workflow_rls +
-- tighten_audit_rls + restrict_notifications_select)
-- ============================================================================
-- สิ่งที่ migration นี้ทำ:
--   1. workflow_action()     — อนุมัติ/ตีกลับแบบ atomic (1 transaction)
--   2. forward_accept()      — รับเอกสารส่งต่อ + ล้าง forwarded_to_id
--   3. log_notification()    — บันทึก notifications พร้อมตรวจสิทธิ์ผู้ส่ง
--   4. จำกัด notifications INSERT ตรง (ต้องผ่าน RPC หรือ admin/dev)
--   5. index สำหรับ overdue scan
--   6. app_settings.schema_version = '2' (frontend แจ้งเตือนถ้ายังไม่ deploy)
-- รันใน Supabase Dashboard → SQL Editor (idempotent — รันซ้ำได้)

-- ── helpers (reuse add_working_days จาก overdue_once_auto_approve.sql) ─────
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

CREATE OR REPLACE FUNCTION public.step_deadline_ts(p_days int)
RETURNS timestamptz
LANGUAGE plpgsql
STABLE
AS $$
DECLARE d timestamptz;
BEGIN
  d := public.add_working_days(now(), coalesce(p_days, 2));
  RETURN date_trunc('day', d AT TIME ZONE 'Asia/Bangkok') AT TIME ZONE 'Asia/Bangkok' + interval '23 hours 59 minutes';
END;
$$;

-- ผู้ใช้มีสิทธิ์เขียน log แจ้งเตือนของเอกสารนี้หรือไม่
CREATE OR REPLACE FUNCTION public.can_log_notification(p_doc uuid, p_sender uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_admin()
    OR public.is_dev()
    OR exists (
      select 1 from public.users u
      where u.id = p_sender and u.role_code in ('ROLE-SYS', 'ROLE-STF')
    )
    OR exists (
      select 1 from public.documents d
      where d.id = p_doc
        and (
          d.created_by = p_sender
          or d.forwarded_to_id = p_sender
          or exists (
            select 1 from public.workflow_steps ws
            where ws.document_id = p_doc
              and (ws.assigned_to = p_sender or ws.rejected_by = p_sender)
          )
        )
    );
$$;

-- ── 1. Atomic approve / reject ─────────────────────────────────────────────
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
      v_nst := CASE WHEN v_doc.doc_type = 'incoming' THEN 'numbering' ELSE 'completed' END;
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

-- ── 2. Forward accept (ล้าง forwarded_to_id — แก้ overdue scan ซ้ำซ้อน) ───
CREATE OR REPLACE FUNCTION public.forward_accept(p_doc uuid, p_note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_doc public.documents%ROWTYPE;
BEGIN
  SELECT id INTO v_uid FROM public.current_profile();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  SELECT * INTO v_doc FROM public.documents WHERE id = p_doc FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'document not found'; END IF;

  IF v_doc.forwarded_to_id IS DISTINCT FROM v_uid
     AND NOT public.is_admin()
     AND NOT public.is_dev() THEN
    RAISE EXCEPTION 'not forwarded to you';
  END IF;

  UPDATE public.documents SET
    forwarded_to_id = NULL,
    forwarded_at = NULL,
    updated_at = now()
  WHERE id = p_doc;

  INSERT INTO public.document_history (document_id, action, performed_by, note)
  VALUES (
    p_doc,
    'เจ้าหน้าที่รับเอกสาร',
    v_uid,
    coalesce(p_note, 'รับและอนุมัติเอกสารเรียบร้อยแล้ว')
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.forward_accept(uuid, text) TO authenticated;

-- ── 3. Validated notification log ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.log_notification(
  p_document_id uuid,
  p_recipient_id uuid,
  p_recipient_email text,
  p_subject text,
  p_body text,
  p_notification_type text,
  p_status text,
  p_sent_at timestamptz DEFAULT now()
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_id uuid;
BEGIN
  SELECT id INTO v_uid FROM public.current_profile();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  IF p_document_id IS NOT NULL
     AND NOT public.can_log_notification(p_document_id, v_uid) THEN
    RAISE EXCEPTION 'not allowed to log notification for this document';
  END IF;

  INSERT INTO public.notifications (
    document_id, recipient_id, recipient_email,
    subject, body, notification_type, status, sent_at
  ) VALUES (
    p_document_id, p_recipient_id, p_recipient_email,
    p_subject, p_body, p_notification_type, p_status, coalesce(p_sent_at, now())
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_notification(uuid, uuid, text, text, text, text, text, timestamptz) TO authenticated;

-- ── 4. Tighten direct notifications INSERT ──────────────────────────────────
DROP POLICY IF EXISTS notifications_insert ON public.notifications;
CREATE POLICY notifications_insert ON public.notifications FOR INSERT
  WITH CHECK (public.is_admin() OR public.is_dev());

-- ── 5. Index สำหรับ overdue scan (ลด full-table scan เมื่อมีผู้ใช้เยอะ) ───
CREATE INDEX IF NOT EXISTS documents_overdue_scan_idx
  ON public.documents (due_date)
  WHERE notify_overdue = true AND status IN ('pending', 'completed');

CREATE INDEX IF NOT EXISTS workflow_steps_active_assignee_idx
  ON public.workflow_steps (assigned_to)
  WHERE status = 'active';

-- ── 6. Schema version marker ────────────────────────────────────────────────
INSERT INTO public.app_settings (key, value, label, value_type)
VALUES ('schema_version', '2', 'เวอร์ชัน schema ที่ frontend ต้องการ', 'text')
ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value,
      label = EXCLUDED.label,
      updated_at = now();
