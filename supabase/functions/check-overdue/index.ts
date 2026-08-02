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

function workingDaysElapsed(from: Date): number {
  const start = new Date(from);
  start.setHours(0, 0, 0, 0);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  if (start >= now) return 0;
  let count = 0;
  const cur = new Date(start);
  while (cur < now) {
    cur.setDate(cur.getDate() + 1);
    const d = cur.getDay();
    if (d !== 0 && d !== 6) count++;
  }
  return count;
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
  const stats = { scanned: 0, warned: 0, autoApproved: 0, stallWarned: 0, errors: [] as string[] };

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

    // ── สแกนที่ 2: ขั้นตอนค้างเกินกำหนดลงนาม → แจ้ง LINE เท่านั้น ──
    // อิสระจากลูปข้างบน (ซึ่งวัดจาก due_date = วันจัดกิจกรรม) ล้มก็ไม่ทำให้ทั้ง job พัง
    try {
      const { data: urlRow } = await admin.from('app_settings').select('value').eq('key', 'app_url').maybeSingle();
      stats.stallWarned = await scanStalledSteps(admin, emailPrefix, urlRow?.value || '');
    } catch (stallErr) {
      stats.errors.push(`stall-scan: ${String(stallErr)}`);
    }

    return json({ ok: true, ...stats });
  } catch (err) {
    console.error('check-overdue error:', err);
    return json({ error: String(err), ...stats }, 500);
  }
});

/* ═══ ขั้นตอนค้างเกินกำหนดลงนาม — แจ้งทาง LINE เท่านั้น ═══
   คนละเงื่อนไขกับลูป overdue ด้านบน:
     overdue      = documents.due_date ผ่านไปแล้ว (วันจัดกิจกรรม)
     step-stall   = workflow_steps.deadline_datetime ผ่านไปแล้ว (เส้นตายที่ผู้ลงนามต้องกด)
   เดิมไม่มีอะไรอ่าน deadline_datetime เลย เอกสารที่ค้างที่คนกลางเป็นสัปดาห์จึงเงียบสนิท
   ตราบใดที่วันจัดกิจกรรมยังมาไม่ถึง

   ⚠️ notification_type = 'step_overdue' — ห้ามใช้ 'overdue'
      overdue_notif_sent_at() นับแถว type='overdue' เป็นจุดเริ่มนาฬิกา auto_approve_overdue
      ถ้าใช้ type เดียวกัน เอกสารจะถูกนับว่าเตือนแล้วทั้งที่ยังไม่เคยเตือน แล้วถูก
      อนุมัติอัตโนมัติเร็วกว่าที่ควร

   เตือนครั้งเดียวต่อรอบการ active ของขั้นตอน — dedup ด้วยแถว notifications ที่ sent_at
   ใหม่กว่าเวลาที่ขั้นนั้นถูกเปิด (ขั้นที่ถูก re-activate หลังตีกลับจึงเตือนได้ใหม่)
   ตรรกะเดียวกับ stepStallInfo()/sendStepStallLineNotifs() ฝั่ง client — แก้ที่ไหนต้องแก้คู่กัน */
async function scanStalledSteps(
  admin: ReturnType<typeof serviceAdmin>,
  prefix: string,
  appUrl: string,
): Promise<number> {
  const nowIso = new Date().toISOString();

  const { data: stalled } = await admin
    .from('workflow_steps')
    .select('document_id')
    .eq('status', 'active')
    .not('deadline_datetime', 'is', null)
    .lt('deadline_datetime', nowIso);
  const stalledIds = [...new Set((stalled ?? []).map((s) => s.document_id).filter(Boolean))];
  if (!stalledIds.length) return 0;

  const { data: docs } = await admin
    .from('documents')
    .select('id, title, subject_line, created_by, created_at')
    .in('id', stalledIds)
    .eq('status', 'pending')
    .eq('notify_overdue', true);
  if (!docs?.length) return 0;
  const docIds = docs.map((d) => d.id);

  const { data: allSteps } = await admin
    .from('workflow_steps')
    .select('document_id, step_number, step_name, assigned_to, status, action_at, completed_at, deadline_datetime')
    .in('document_id', docIds)
    .order('step_number');

  const { data: prev } = await admin
    .from('notifications')
    .select('document_id, sent_at')
    .in('document_id', docIds)
    .eq('notification_type', 'step_overdue');
  const lastWarn = new Map<string, number>();
  for (const n of prev ?? []) {
    const t = new Date(n.sent_at).getTime();
    if (!isNaN(t) && t > (lastWarn.get(n.document_id) ?? 0)) lastWarn.set(n.document_id, t);
  }

  const uids = new Set<string>();
  for (const d of docs) if (d.created_by) uids.add(d.created_by);
  for (const s of allSteps ?? []) if (s.status === 'active' && s.assigned_to) uids.add(s.assigned_to);
  const { data: users } = uids.size
    ? await admin.from('users').select('id, full_name').in('id', [...uids])
    : { data: [] as { id: string; full_name: string }[] };
  const nameOf = new Map((users ?? []).map((u) => [u.id, u.full_name]));

  let warned = 0;
  for (const doc of docs) {
    try {
      const steps = (allSteps ?? []).filter((s) => s.document_id === doc.id);
      const act = steps.filter((s) => s.status === 'active')
        .sort((a, b) => (a.step_number ?? 0) - (b.step_number ?? 0))[0];
      if (!act?.deadline_datetime) continue;
      const ddl = new Date(act.deadline_datetime);
      if (isNaN(ddl.getTime()) || new Date() <= ddl) continue;

      // เวลาที่ขั้นนี้ถูกเปิดให้ทำ = ตอนขั้นก่อนหน้าอนุมัติ (ขั้นแรกนับจากวันสร้างเอกสาร)
      let since: Date | null = null;
      for (const s of steps) {
        if ((s.step_number ?? 0) >= (act.step_number ?? 0)) continue;
        const t = s.completed_at || s.action_at;
        if (!t) continue;
        const ts = new Date(t);
        if (!isNaN(ts.getTime()) && (!since || ts > since)) since = ts;
      }
      if (!since && doc.created_at) {
        const c = new Date(doc.created_at);
        if (!isNaN(c.getTime())) since = c;
      }
      if (!since) continue;
      if ((lastWarn.get(doc.id) ?? 0) >= since.getTime()) continue;

      const days = workingDaysElapsed(since);
      const subj = doc.subject_line && doc.subject_line.length >= 3 ? doc.subject_line : (doc.title || '');
      const ddlStr = ddl.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
      const holder = act.assigned_to ? (nameOf.get(act.assigned_to) || '') : '';
      let sentAny = false;

      const targets: { id: string; text: string; subject: string }[] = [];
      if (act.assigned_to) {
        targets.push({
          id: act.assigned_to,
          subject: `[LINE] ค้างเกินกำหนดลงนาม: ${subj}`,
          text: [
            `${prefix} ⏰ ท่านมีเอกสารค้างเกินกำหนดลงนาม`,
            holder ? `เรียน ${holder}` : '',
            `เรื่อง: ${subj}`,
            `ขั้นตอนของท่าน: ${act.step_name || ''}`,
            `ครบกำหนดลงนาม: ${ddlStr}`,
            `ค้างมาแล้ว: ${days} วันทำการ`,
            'กรุณาเข้าระบบเพื่อลงนาม',
            appUrl,
          ].filter(Boolean).join('\n'),
        });
      }
      if (doc.created_by && doc.created_by !== act.assigned_to) {
        const crName = nameOf.get(doc.created_by) || '';
        targets.push({
          id: doc.created_by,
          subject: `[LINE] เอกสารของท่านค้างเกินกำหนด: ${subj}`,
          text: [
            `${prefix} ⏰ เอกสารของท่านค้างเกินกำหนด`,
            crName ? `เรียน ${crName}` : '',
            `เรื่อง: ${subj}`,
            `ค้างที่ขั้นตอน: ${act.step_name || ''}${holder ? ` (${holder})` : ''}`,
            `ครบกำหนดลงนาม: ${ddlStr}`,
            `ค้างมาแล้ว: ${days} วันทำการ`,
            'กรุณาติดตามกับผู้รับผิดชอบขั้นตอนนี้',
            appUrl,
          ].filter(Boolean).join('\n'),
        });
      }

      for (const t of targets) {
        const status = await pushLine(admin, t.id, t.text);
        if (status === 'skipped') continue;   // ไม่ได้ผูก LINE — ไม่บันทึก จะได้เตือนใหม่เมื่อผูกแล้ว
        sentAny = true;
        // insert ตรง ไม่ผ่าน log_notification RPC — service role ไม่มี auth.uid() ให้ RPC ตรวจ
        await admin.from('notifications').insert({
          document_id: doc.id,
          recipient_id: t.id,
          recipient_email: '',
          subject: t.subject,
          body: t.text,
          notification_type: 'step_overdue',
          status,
          sent_at: new Date().toISOString(),
        });
      }
      if (sentAny) warned++;
    } catch (e) {
      console.error('stall warn failed:', doc.id, e);
    }
  }
  return warned;
}

/* push LINE ตรงไปยัง Messaging API — service role resolve line_user_id เองได้
   ไม่เรียก Edge Function send-line เพื่อเลี่ยง hop + rate limit ที่ผูกกับ caller */
async function pushLine(
  admin: ReturnType<typeof serviceAdmin>,
  userId: string,
  text: string,
): Promise<string> {
  const TOKEN = Deno.env.get('LINE_CHANNEL_ACCESS_TOKEN') ?? '';
  if (!TOKEN) return 'skipped';
  const { data: profile } = await admin
    .from('users')
    .select('line_user_id')
    .eq('id', userId)
    .maybeSingle();
  if (!profile?.line_user_id) return 'skipped';

  try {
    const r = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: profile.line_user_id,
        messages: [{ type: 'text', text: String(text).slice(0, 4900) }],
      }),
    });
    if (!r.ok) {
      console.error('LINE push failed:', r.status, await r.text().catch(() => ''));
      return 'failed';
    }
    return 'sent';
  } catch (e) {
    console.error('LINE push error:', e);
    return 'failed';
  }
}

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

    // insert ตรง ไม่ผ่าน log_notification RPC — RPC ตรวจสิทธิ์ด้วย current_profile()
    // ซึ่งอ่านจาก auth.uid() แต่ cron ใช้ service role ที่ไม่มี JWT ผู้ใช้ → auth.uid() เป็น null
    // → RPC โยน 'not authenticated' ทุกครั้ง แถว dedup จึงไม่เคยถูกเขียน
    // ผลคืออีเมลเตือนถูกส่งซ้ำทุกวันไม่รู้จบ และ auto_approve_overdue ไม่เคยเริ่มนับเวลา
    // (service role bypass RLS อยู่แล้ว จึง insert ตรงได้ — ฝั่ง client ยังใช้ RPC ตามเดิม)
    const { error: logErr } = await admin.from('notifications').insert({
      document_id: doc.id,
      recipient_id: u.id,
      recipient_email: em,
      subject: emailSubj,
      body: html,
      notification_type: 'overdue',
      status,
      sent_at: new Date().toISOString(),
    });
    // เขียน log ไม่ลง = dedup พัง ต้องดังพอให้เห็นใน stats.errors ไม่ใช่เงียบ
    if (logErr) throw new Error(`log overdue failed: ${logErr.message}`);
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

  // insert ตรงด้วยเหตุผลเดียวกับใน sendOverdueWarning (service role ไม่มี auth.uid())
  // แถวนี้เป็น audit อย่างเดียว ไม่มี dedup ผูกอยู่ — พังแล้วไม่ต้องหยุดทั้ง job
  const { error: logErr } = await admin.from('notifications').insert({
    document_id: doc.id,
    recipient_id: creator.id,
    recipient_email: em,
    subject: emailSubj,
    body: html,
    notification_type: 'approve',
    status,
    sent_at: new Date().toISOString(),
  });
  if (logErr) console.error('log post-auto failed:', doc.id, logErr.message);
}
