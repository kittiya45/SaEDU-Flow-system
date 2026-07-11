// Supabase Edge Function: check-overdue
// Cron รายวัน — ตรวจเอกสารเลยกำหนด + เตือนครั้งเดียว + auto-approve หลัง grace period
// Deploy: npx supabase functions deploy check-overdue --no-verify-jwt
// Secret: OVERDUE_CRON_SECRET (ตั้งค่าเดียวกับ app_settings.overdue_cron_secret)
// @ts-nocheck

import { corsHeaders, json } from '../_shared/cors.ts';
import { serviceAdmin } from '../_shared/requireAuth.ts';
import { sendBrevoEmail } from '../_shared/brevo.ts';

function addWorkingDays(from: Date, days: number): Date {
  const d = new Date(from);
  let count = 0;
  while (count < days) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) count++;
  }
  return d;
}

function okEmail(em: string | null | undefined): boolean {
  return !!(em && em.includes('@') && !em.includes('@gnk.student'));
}

type DocRow = {
  id: string;
  title: string;
  subject_line: string | null;
  status: string;
  due_date: string | null;
  created_by: string | null;
  forwarded_to_id: string | null;
  notify_overdue: boolean;
};

type UserRow = { id: string; full_name: string; email: string; contact_email: string | null };

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const cronSecret = Deno.env.get('OVERDUE_CRON_SECRET') ?? '';
  if (!cronSecret || req.headers.get('x-cron-secret') !== cronSecret) {
    return json({ error: 'forbidden' }, 403);
  }

  const admin = serviceAdmin();
  const today = new Date().toISOString().substring(0, 10);
  const stats = { scanned: 0, warned: 0, autoApproved: 0, errors: [] as string[] };

  try {
    const { data: slaRow } = await admin.from('app_settings').select('value').eq('key', 'sla_cascade_days').maybeSingle();
    const slaDays = Math.max(1, parseInt(slaRow?.value ?? '3', 10) || 3);

    const { data: prefixRow } = await admin.from('app_settings').select('value').eq('key', 'email_prefix').maybeSingle();
    const emailPrefix = prefixRow?.value || '[กนค.]';

    const { data: pendDocs } = await admin
      .from('documents')
      .select('id, title, subject_line, status, due_date, created_by, forwarded_to_id, notify_overdue')
      .eq('status', 'pending')
      .eq('notify_overdue', true)
      .lt('due_date', today);

    const { data: fwdDocsRaw } = await admin
      .from('documents')
      .select('id, title, subject_line, status, due_date, created_by, forwarded_to_id, notify_overdue')
      .eq('status', 'completed')
      .eq('notify_overdue', true)
      .not('forwarded_to_id', 'is', null)
      .lt('due_date', today);

    let fwdDocs = fwdDocsRaw ?? [];
    if (fwdDocs.length) {
      const ids = fwdDocs.map((d) => d.id);
      const { data: accHist } = await admin
        .from('document_history')
        .select('document_id')
        .in('document_id', ids)
        .eq('action', 'เจ้าหน้าที่รับเอกสาร');
      const accIds = new Set((accHist ?? []).map((h) => h.document_id));
      fwdDocs = fwdDocs.filter((d) => !accIds.has(d.id));
    }

    const overdueDocs: DocRow[] = [...(pendDocs ?? []), ...fwdDocs];
    stats.scanned = overdueDocs.length;

    for (const doc of overdueDocs) {
      try {
        const { data: sentAt } = await admin.rpc('overdue_notif_sent_at', { p_doc: doc.id });

        if (sentAt === null) {
          await sendOverdueWarning(admin, doc, emailPrefix);
          stats.warned++;
          continue;
        }

        if (!sentAt) continue;

        if (new Date() < addWorkingDays(new Date(sentAt), slaDays)) continue;

        const { data: res, error: aErr } = await admin.rpc('auto_approve_overdue', { p_doc: doc.id });
        if (aErr) {
          stats.errors.push(`${doc.id}: ${aErr.message}`);
          continue;
        }
        if (res === 'approved_numbering' || res === 'approved_completed') {
          stats.autoApproved++;
          await sendPostAutoEmail(admin, doc, res, emailPrefix);
        }
      } catch (docErr) {
        stats.errors.push(`${doc.id}: ${String(docErr)}`);
      }
    }

    return json({ ok: true, ...stats });
  } catch (err) {
    console.error('check-overdue error:', err);
    return json({ error: String(err), ...stats }, 500);
  }
});

async function sendOverdueWarning(admin: ReturnType<typeof serviceAdmin>, doc: DocRow, prefix: string) {
  const { data: steps } = await admin
    .from('workflow_steps')
    .select('assigned_to, status, step_number')
    .eq('document_id', doc.id)
    .order('step_number');

  const active = (steps ?? []).find((s) => s.status === 'active');
  const subj = doc.subject_line && doc.subject_line.length >= 3 ? doc.subject_line : (doc.title || '');

  const recipientIds = new Set<string>();
  if (active?.assigned_to) recipientIds.add(active.assigned_to);
  if (doc.status === 'completed' && doc.forwarded_to_id) recipientIds.add(doc.forwarded_to_id);
  if (doc.created_by) recipientIds.add(doc.created_by);

  if (!recipientIds.size) return;

  const { data: users } = await admin
    .from('users')
    .select('id, full_name, email, contact_email')
    .in('id', [...recipientIds]);

  const emailSubj = `${prefix} ⚠️ เลยกำหนด: ${subj}`;
  const deadlineStr = doc.due_date
    ? new Date(doc.due_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: '2-digit' })
    : '';

  for (const u of (users ?? []) as UserRow[]) {
    const em = u.contact_email || u.email || '';
    const html = `<p>เรียน <strong>${u.full_name}</strong></p>
      <p>เอกสารเรื่อง "<strong>${subj}</strong>" เลยกำหนดส่งแล้ว กรุณาดำเนินการโดยด่วน</p>
      ${deadlineStr ? `<p>กำหนดส่ง: ${deadlineStr}</p>` : ''}
      <p style="color:#888;font-size:12px">อีเมลนี้ส่งโดยระบบอัตโนมัติ (cron)</p>`;

    let status = 'failed';
    if (okEmail(em)) {
      const r = await sendBrevoEmail({ to: em, subject: emailSubj, html });
      status = r.ok ? 'sent' : 'failed';
    }

    await admin.rpc('log_notification', {
      p_document_id: doc.id,
      p_recipient_id: u.id,
      p_recipient_email: em,
      p_subject: emailSubj,
      p_body: html,
      p_notification_type: 'overdue',
      p_status: status,
      p_sent_at: new Date().toISOString(),
    });
  }
}

async function sendPostAutoEmail(
  admin: ReturnType<typeof serviceAdmin>,
  doc: DocRow,
  result: string,
  prefix: string,
) {
  if (!doc.created_by) return;
  const { data: creator } = await admin
    .from('users')
    .select('id, full_name, email, contact_email')
    .eq('id', doc.created_by)
    .maybeSingle();
  if (!creator) return;

  const subj = doc.subject_line && doc.subject_line.length >= 3 ? doc.subject_line : (doc.title || '');
  const isNumbering = result === 'approved_numbering';
  const emailSubj = `${prefix} ${isNumbering ? '🔢 รอออกเลขหนังสือ: ' : 'เสร็จสิ้น: '}${subj}`;
  const html = `<p>เรียน <strong>${creator.full_name}</strong></p>
    <p>เอกสารเรื่อง "<strong>${subj}</strong>" ${
      isNumbering ? 'ผ่านทุกขั้นตอนแล้ว — กรุณาออกเลขหนังสือ' : 'ดำเนินการเสร็จสิ้นแล้ว (อนุมัติอัตโนมัติเมื่อเลยกำหนด)'
    }</p>`;

  const em = creator.contact_email || creator.email || '';
  let status = 'failed';
  if (okEmail(em)) {
    const r = await sendBrevoEmail({ to: em, subject: emailSubj, html });
    status = r.ok ? 'sent' : 'failed';
  }

  await admin.rpc('log_notification', {
    p_document_id: doc.id,
    p_recipient_id: creator.id,
    p_recipient_email: em,
    p_subject: emailSubj,
    p_body: html,
    p_notification_type: 'approve',
    p_status: status,
    p_sent_at: new Date().toISOString(),
  });
}
