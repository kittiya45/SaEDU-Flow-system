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
  const stats = { scanned: 0, warned: 0, autoApproved: 0, stallWarned: 0, stageWarned: 0, errors: [] as string[] };

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

    const { data: urlRow } = await admin.from('app_settings').select('value').eq('key', 'app_url').maybeSingle();
    const appUrl = urlRow?.value || '';

    // ── สแกนที่ 2: ขั้นตอนค้างเกินกำหนดลงนาม → แจ้ง LINE เท่านั้น ──
    // อิสระจากลูปข้างบน (ซึ่งวัดจาก due_date = วันจัดกิจกรรม) ล้มก็ไม่ทำให้ทั้ง job พัง
    try {
      stats.stallWarned = await scanStalledSteps(admin, emailPrefix, appUrl);
    } catch (stallErr) {
      stats.errors.push(`stall-scan: ${String(stallErr)}`);
    }

    // ── สแกนที่ 3: เอกสารค้างที่ numbering / awaiting_submit ──
    // จุดบอดเดิม: สแกน 1 ดูแค่ status='pending' กับ completed+forwarded และสแกน 2 ดูแค่
    // workflow_steps ที่ active — เอกสารที่ผ่านลายเซ็นครบแล้วจึงหลุดจากทั้งสองตะแกรง
    // ทั้งที่ยังไม่จบเรื่อง: numbering = ผู้จัดทำยังไม่กด "ออกเลขหนังสือ",
    // awaiting_submit = จนท.รับไปแล้วแต่ยังไม่ได้ยื่นเข้าระบบมหาวิทยาลัย
    // (ตอนพบมี 14 + 10 ใบค้าง ใบเก่าสุด 29 วัน โดยไม่มีใครได้รับแจ้งอะไรเลย)
    try {
      stats.stageWarned = await scanStuckStages(admin, emailPrefix, appUrl, slaDays);
    } catch (stageErr) {
      stats.errors.push(`stage-scan: ${String(stageErr)}`);
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
  // ทุกขั้น ไม่เฉพาะขั้นที่ค้าง — การ์ดแสดงชื่อผู้รับผิดชอบครบทุกขั้นในแถบความคืบหน้า
  for (const s of allSteps ?? []) if (s.assigned_to) uids.add(s.assigned_to);
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

      // แถบ "ความคืบหน้า" บนการ์ด — ทุกขั้นของเอกสารพร้อมชื่อผู้รับผิดชอบ
      const flexSteps = steps
        .slice()
        .sort((a, b) => (a.step_number ?? 0) - (b.step_number ?? 0))
        .map((s) => ({
          name: s.step_name || `ขั้นที่ ${s.step_number}`,
          person: s.assigned_to ? (nameOf.get(s.assigned_to) || '') : '',
          st: s.status,
        }));

      const targets: { id: string; text: string; subject: string; flex: Record<string, unknown> | null }[] = [];
      const mkFlex = (o: Partial<FlexOpts>) => {
        try { return lineFlex({ subj, steps: flexSteps, appUrl, ...o } as FlexOpts); } catch { return null; }
      };
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
          flex: mkFlex({
            head: '⏰ ท่านมีเอกสารค้างเกินกำหนดลงนาม',
            recipName: holder,
            // ไม่ใส่แถว "ขั้นตอนของท่าน" — แถบความคืบหน้าชี้ด้วย ● อยู่แล้ว
            rows: [['ครบกำหนดลงนาม', ddlStr], ['ค้างมาแล้ว', `${days} วันทำการ`]],
            infoText: 'กรุณาเข้าระบบเพื่อลงนามให้เอกสารเดินต่อ',
            button: 'ไปลงนาม',
          }),
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
          flex: mkFlex({
            head: '⏰ เอกสารของท่านค้างเกินกำหนด',
            recipName: crName,
            rows: [['ครบกำหนดลงนาม', ddlStr], ['ค้างมาแล้ว', `${days} วันทำการ`]],
            infoText: 'กรุณาติดตามกับผู้รับผิดชอบขั้นตอนนี้',
            button: 'เปิดดูเอกสาร',
          }),
        });
      }

      for (const t of targets) {
        const status = await pushLine(admin, t.id, t.text, t.flex);
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

/* ═══ เอกสารค้างที่ numbering / awaiting_submit ═══
   สองสถานะนี้อยู่ "หลังลายเซ็นครบ" จึงหลุดตะแกรงทั้งสองอันข้างบน:
     สแกน 1 (overdue)   ดู status='pending' และ completed+forwarded เท่านั้น
     สแกน 2 (step-stall) ดู workflow_steps.status='active' — พวกนี้ done หมดแล้ว
   ผลคือเอกสารที่ผ่านทุกลายเซ็นแล้วแต่ไม่มีใครกดต่อ จะเงียบสนิทตลอดไป

   ⚠️ notification_type = 'stage_stuck' — ห้ามใช้ 'overdue'
      overdue_notif_sent_at() นับแถว type='overdue' เป็นจุดเริ่มนาฬิกา auto_approve_overdue
      ถ้าใช้ type เดียวกัน เอกสารจะถูกนับว่าเตือนเรื่องเลยกำหนดแล้วทั้งที่ไม่เคยเตือน
      แล้วถูกอนุมัติอัตโนมัติเร็วกว่าที่ควร (เหตุผลเดียวกับ 'step_overdue')

   จังหวะเตือน: เริ่มเตือนเมื่อค้างเกิน slaDays วันทำการนับจาก updated_at
   แล้วเตือนซ้ำได้ทุก RENOTIFY_WORKING_DAYS วันทำการ — ไม่ใช่ทุกวัน
   (บั๊กที่เพิ่งแก้ไปคือเตือนซ้ำทุกวันเพราะ dedup เขียนไม่ลง จึงต้องระวังเป็นพิเศษตรงนี้) */
const RENOTIFY_WORKING_DAYS = 5;

function subWorkingDays(from: Date, days: number): Date {
  const d = new Date(from);
  let count = 0;
  while (count < days) {
    d.setDate(d.getDate() - 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) count++;
  }
  return d;
}

const STAGE_LABEL: Record<string, string> = {
  numbering: 'รอออกเลขหนังสือ',
  awaiting_submit: 'รอเจ้าหน้าที่ยื่นในระบบมหาวิทยาลัย',
};

async function scanStuckStages(
  admin: ReturnType<typeof serviceAdmin>,
  prefix: string,
  appUrl: string,
  slaDays: number,
): Promise<number> {
  const cutoff = subWorkingDays(new Date(), Math.max(1, slaDays)).toISOString();

  const { data: docs } = await admin
    .from('documents')
    .select('id, doc_number, title, subject_line, status, created_by, accepted_by, updated_at, notify_overdue')
    .in('status', ['numbering', 'awaiting_submit'])
    .eq('notify_overdue', true)
    .lt('updated_at', cutoff);
  if (!docs?.length) return 0;

  const docIds = docs.map((d) => d.id);

  // เตือนล่าสุดของแต่ละเอกสาร — ใช้ทั้งกัน "เตือนซ้ำเร็วเกินไป" และรีเซ็ตเมื่อสถานะขยับ
  const { data: prev } = await admin
    .from('notifications')
    .select('document_id, sent_at')
    .in('document_id', docIds)
    .eq('notification_type', 'stage_stuck');
  const lastWarn = new Map<string, number>();
  for (const n of prev ?? []) {
    const t = new Date(n.sent_at).getTime();
    if (!isNaN(t) && t > (lastWarn.get(n.document_id) ?? 0)) lastWarn.set(n.document_id, t);
  }

  const uids = new Set<string>();
  for (const d of docs) {
    if (d.created_by) uids.add(d.created_by);
    if (d.accepted_by) uids.add(d.accepted_by);
  }
  const { data: users } = uids.size
    ? await admin.from('users').select('id, full_name, email, contact_email').in('id', [...uids])
    : { data: [] as UserRow[] };
  const userOf = new Map((users ?? []).map((u) => [u.id, u as UserRow]));

  const renotifyBefore = subWorkingDays(new Date(), RENOTIFY_WORKING_DAYS).getTime();
  let warned = 0;

  for (const doc of docs) {
    try {
      const last = lastWarn.get(doc.id) ?? 0;
      // เคยเตือนหลังจากสถานะขยับล่าสุด และยังไม่ถึงรอบเตือนซ้ำ → ข้าม
      if (last > new Date(doc.updated_at).getTime() && last > renotifyBefore) continue;

      const subj = doc.subject_line && doc.subject_line.length >= 3 ? doc.subject_line : (doc.title || '');
      const days = workingDaysElapsed(new Date(doc.updated_at));
      const stage = STAGE_LABEL[doc.status] ?? doc.status;
      const num = doc.doc_number || '—';

      // numbering = ผู้จัดทำต้องกด "ออกเลขหนังสือ"
      // awaiting_submit = จนท.ที่กดรับไปถืออยู่ (แจ้งผู้จัดทำด้วยเพื่อให้ตามได้)
      const targets: { id: string; action: string }[] = [];
      if (doc.status === 'numbering') {
        if (doc.created_by) targets.push({ id: doc.created_by, action: 'กรุณาเข้าระบบแล้วกด "ออกเลขหนังสือ" เพื่อให้เอกสารเดินต่อ' });
      } else {
        if (doc.accepted_by) targets.push({ id: doc.accepted_by, action: 'ท่านเป็นผู้รับเอกสารนี้ไว้ — กรุณายื่นเข้าระบบมหาวิทยาลัยแล้วอัปโหลดฉบับประทับกลับเข้าระบบ' });
        if (doc.created_by && doc.created_by !== doc.accepted_by) targets.push({ id: doc.created_by, action: 'เอกสารของท่านอยู่กับเจ้าหน้าที่ — กรุณาติดตามหากเรื่องเร่งด่วน' });
      }
      if (!targets.length) continue;

      let sentAny = false;
      for (const t of targets) {
        const u = userOf.get(t.id);
        if (!u) continue;

        const emailSubj = `${prefix} ⏳ เอกสารค้าง ${days} วันทำการ: ${subj}`;
        const html = `<p>เรียน <strong>${u.full_name}</strong></p>
          <p>เอกสารเลขที่ <strong>${num}</strong> เรื่อง "<strong>${subj}</strong>" ค้างอยู่ที่สถานะ <strong>${stage}</strong> มาแล้ว ${days} วันทำการ</p>
          <p>${t.action}</p>
          ${appUrl ? `<p><a href="${appUrl}">เข้าสู่ระบบ</a></p>` : ''}
          <p style="color:#888;font-size:12px">อีเมลนี้ส่งโดยระบบอัตโนมัติ (cron)</p>`;

        const em = u.contact_email || u.email || '';
        let status = 'skipped';
        if (okEmail(em)) {
          const r = await sendBrevoEmail({ to: em, subject: emailSubj, html });
          status = r.ok ? 'sent' : 'failed';
        }

        const lineText = [
          `${prefix} ⏳ เอกสารค้าง ${days} วันทำการ`,
          `เรียน ${u.full_name}`,
          `เลขที่: ${num}`,
          `เรื่อง: ${subj}`,
          `สถานะ: ${stage}`,
          t.action,
          appUrl,
        ].filter(Boolean).join('\n');
        let lineCard: Record<string, unknown> | null = null;
        try {
          lineCard = lineFlex({
            head: `⏳ เอกสารค้าง ${days} วันทำการ`,
            headColor: '#C77A1A',
            subj, recipName: u.full_name, appUrl,
            rows: ([['สถานะ', stage], ['ค้างมาแล้ว', `${days} วันทำการ`]] as [string, string][])
              .concat(doc.doc_number ? [['เลขที่', num]] : []),
            infoText: t.action,
            button: doc.status === 'numbering' ? 'ไปออกเลขหนังสือ' : 'เปิดดูเอกสาร',
            buttonColor: '#C77A1A',
          });
        } catch { /* การ์ดพัง → ส่ง text ธรรมดาต่อ */ }
        const lineStatus = await pushLine(admin, t.id, lineText, lineCard);

        // ไม่ได้ผูก LINE และไม่มีอีเมลใช้ได้ → ไม่มีอะไรถูกส่งจริง ห้ามบันทึกเป็น "เตือนแล้ว"
        // ไม่งั้นคนที่ติดต่อไม่ได้เลยจะถูก dedup กลบไปตลอดกาล
        if (status === 'skipped' && lineStatus === 'skipped') continue;
        sentAny = true;

        await admin.from('notifications').insert({
          document_id: doc.id,
          recipient_id: t.id,
          recipient_email: okEmail(em) ? em : '',
          subject: emailSubj,
          body: html,
          notification_type: 'stage_stuck',
          status: status === 'skipped' ? lineStatus : status,
          sent_at: new Date().toISOString(),
        });
      }
      if (sentAny) warned++;
    } catch (e) {
      console.error('stage warn failed:', doc.id, e);
    }
  }
  return warned;
}

/* ═══ การ์ด LINE (Flex Message) ═══
   ⚠️ ทำซ้ำจาก buildLineFlex() ใน notif.js ฝั่ง client โดยตั้งใจ — cron ส่งเองไม่ผ่านไฟล์นั้น
   หน้าตาการ์ดต้องเหมือนกันทั้งสองทาง แก้ที่ไหนต้องแก้คู่กัน
   ถ้า build พัง จะ fallback เป็น text ธรรมดา (ผู้เรียกห่อ try/catch ไว้) */
type FlexStep = { name: string; person: string; st: string };
type FlexOpts = {
  head: string;
  headColor?: string;
  subj: string;
  recipName?: string;
  rows?: [string, string][];
  steps?: FlexStep[];
  infoText?: string;
  button?: string;
  buttonColor?: string;
  headIcon?: string;
  appUrl?: string;
};

function lineFlex(o: FlexOpts) {
  const accent = o.headColor || '#E83A00';
  /* ต้องตรงกับ buildLineFlex() ใน notif.js — การ์ดจาก cron กับจากแอปต้องหน้าตาเดียวกัน
     แถบหัวสีทึบ (ชื่อระบบ + สถานะตัวขาว) → เนื้อพื้นขาว → ปุ่มทึบเต็มความกว้าง */
  const row = (label: string, value: string, vColor?: string) => ({
    type: 'box', layout: 'horizontal', spacing: 'sm', margin: 'sm',
    contents: [
      { type: 'text', text: String(label), size: 'sm', color: '#8C837A', flex: 5 },
      { type: 'text', text: String(value || '—'), size: 'sm', color: vColor || '#18120E', flex: 7, wrap: true, weight: 'bold' },
    ],
  });

  /* ไอคอนหัวการ์ด — ไฟล์ PNG ใน img/line/ ของเว็บเอง (LINE รับเฉพาะรูปที่ https จริง)
     ไม่มี appUrl แบบ https → ถอยไปใช้อีโมจินำหน้าหัวข้อตามเดิม */
  const base = String(o.appUrl || '').trim().replace(/\/+$/, '');
  const icoUrl = /^https:\/\//i.test(base) ? `${base}/img/line/${o.headIcon || 'late'}.png` : null;
  const headTxt = icoUrl ? String(o.head).replace(/^[^\u0E00-\u0E7Fa-zA-Z0-9(]+/, '') : String(o.head);
  const headLine = icoUrl
    ? {
        type: 'box', layout: 'baseline', spacing: 'md',
        contents: [
          { type: 'icon', url: icoUrl, size: 'lg' },
          { type: 'text', text: headTxt, size: 'lg', weight: 'bold', color: '#FFFFFF', wrap: true },
        ],
      }
    : { type: 'text', text: headTxt, size: 'lg', weight: 'bold', color: '#FFFFFF', wrap: true };
  const header = {
    type: 'box', layout: 'vertical', spacing: 'xs', paddingAll: '16px', backgroundColor: accent,
    contents: [
      {
        type: 'box', layout: 'baseline', spacing: 'sm',
        contents: [
          { type: 'text', text: 'SAEDU FLOW', size: 'xs', weight: 'bold', color: '#FFFFFF', flex: 0 },
          { type: 'text', text: '· ระบบเสนอเอกสาร กนค.', size: 'xs', color: '#FFFFFF' },
        ],
      },
      headLine,
    ],
  };

  const body: Record<string, unknown>[] = [
    { type: 'text', text: String(o.subj || '—'), weight: 'bold', size: 'lg', wrap: true, color: '#18120E' },
  ];
  if (o.recipName) body.push(row('เรียน', o.recipName));
  for (const r of o.rows ?? []) body.push(row(r[0], r[1]));

  const steps = o.steps ?? [];
  if (steps.length) {
    const done = steps.filter((s) => s.st === 'done').length;
    body.push({ type: 'separator', margin: 'xl', color: '#EDE7E0' });
    body.push({ type: 'text', text: `ความคืบหน้า ${done}/${steps.length} ขั้นตอน`, size: 'sm', color: '#A79C92', margin: 'lg' });
    for (const s of steps) {
      let mark = '○', mc = '#D5CDC5', tc = '#A79C92', bold = false, tag = '';
      if (s.st === 'done') { mark = '✓'; mc = '#16A34A'; tc = '#6B6157'; }
      else if (s.st === 'active') { mark = '●'; mc = accent; tc = '#18120E'; bold = true; tag = '← รออยู่'; }
      else if (s.st === 'rejected') { mark = '✕'; mc = '#DC2626'; tc = '#B4534E'; tag = '← ตีกลับ'; }
      else if (s.st === 'cancelled') { mark = '⊘'; mc = '#C4BBB2'; tc = '#A79C92'; tag = '← ยกเลิก'; }
      const txt = (s.name || '—') + (s.person ? ' — ' + s.person : '') + (tag ? '  ' + tag : '');
      const t: Record<string, unknown> = { type: 'text', text: txt, size: 'sm', color: tc, wrap: true };
      if (bold) t.weight = 'bold';
      // เครื่องหมายอยู่คอลัมน์กว้างคงที่ — ชื่อยาวที่ตัดบรรทัดจึงไม่ดันเครื่องหมายหลุดแนว
      body.push({
        type: 'box', layout: 'horizontal', spacing: 'sm', margin: 'md',
        contents: [
          { type: 'box', layout: 'vertical', width: '16px', flex: 0, contents: [{ type: 'text', text: mark, size: 'sm', color: mc, align: 'center' }] },
          { type: 'box', layout: 'vertical', spacing: 'none', contents: [t] },
        ],
      });
    }
  }
  if (o.infoText) body.push({ type: 'text', text: String(o.infoText), size: 'xs', color: '#A79C92', wrap: true, margin: 'xl' });

  const bubble: Record<string, unknown> = {
    type: 'bubble', size: 'mega',
    header,
    body: { type: 'box', layout: 'vertical', spacing: 'none', paddingAll: '18px', backgroundColor: '#FFFFFF', contents: body },
  };
  // ⚠️ LINE ปฏิเสธทั้งข้อความถ้า uri ไม่ใช่ http(s)
  const url = String(o.appUrl || '').trim();
  if (/^https?:\/\//.test(url)) {
    bubble.footer = {
      type: 'box', layout: 'vertical', paddingAll: '18px', paddingTop: '0px', backgroundColor: '#FFFFFF',
      contents: [
        {
          type: 'button', style: 'primary', height: 'sm', color: o.buttonColor || accent,
          action: { type: 'uri', label: o.button || 'เข้าสู่ระบบเพื่อดำเนินการ', uri: url },
        },
      ],
    };
  }
  return bubble;
}

/* push LINE ตรงไปยัง Messaging API — service role resolve line_user_id เองได้
   ไม่เรียก Edge Function send-line เพื่อเลี่ยง hop + rate limit ที่ผูกกับ caller
   flex = การ์ด Flex Message (ถ้ามี) — text ยังส่งไปด้วยเสมอในฐานะ altText/fallback */
async function pushLine(
  admin: ReturnType<typeof serviceAdmin>,
  userId: string,
  text: string,
  flex?: Record<string, unknown> | null,
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
        messages: [
          flex && typeof flex === 'object'
            ? { type: 'flex', altText: String(text).slice(0, 400), contents: flex }
            : { type: 'text', text: String(text).slice(0, 4900) },
        ],
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
