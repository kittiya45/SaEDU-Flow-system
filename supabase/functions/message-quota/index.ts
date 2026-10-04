// Supabase Edge Function: message-quota
// ยอดการส่งข้อความเทียบโควตา — อ่านค่าจริงจากผู้ให้บริการ + นับจากบันทึก notifications ของระบบเอง
//   LINE  : GET /v2/bot/message/quota (เพดานรายเดือนของแพ็กเกจ OA) + /quota/consumption (ใช้ไปแล้วเดือนนี้)
//           ตัวเลขของ LINE นับ "ต่อผู้รับ" — push เข้ากลุ่มนับเท่าจำนวนสมาชิก และไม่มีแถวใน notifications
//           จึงต่างจากยอดที่ระบบนับเองได้ ส่วนต่างนั้นคือกลุ่ม + การส่งจากที่อื่น (เช่น OA Manager)
//   Brevo : GET /v3/account — แผนฟรีเป็น creditsType 'sendLimit' = จำนวนที่ยังส่งได้ "วันนี้" (เพดานรายวัน)
// GET หรือ POST — ต้องมี JWT ของ ROLE-DEV / ROLE-SYS / ROLE-STF ไม่คืน secret ใด ๆ
// @ts-nocheck

import { corsHeaders, json } from '../_shared/cors.ts';
import { requireAuth } from '../_shared/requireAuth.ts';

const TZ_OFFSET_MS = 7 * 3600 * 1000;   // Asia/Bangkok ไม่มี DST

/* ต้นเดือน/ต้นวันตามเวลาไทย คืนเป็น ISO (UTC) สำหรับกรอง sent_at */
function bangkokStarts(now = new Date()) {
  const local = new Date(now.getTime() + TZ_OFFSET_MS);
  const y = local.getUTCFullYear(), m = local.getUTCMonth(), d = local.getUTCDate();
  return {
    month: new Date(Date.UTC(y, m, 1) - TZ_OFFSET_MS).toISOString(),
    day: new Date(Date.UTC(y, m, d) - TZ_OFFSET_MS).toISOString(),
  };
}

async function lineQuota() {
  const token = Deno.env.get('LINE_CHANNEL_ACCESS_TOKEN') ?? '';
  if (!token) return { configured: false };
  const h = { Authorization: `Bearer ${token}` };
  try {
    const [q, c] = await Promise.all([
      fetch('https://api.line.me/v2/bot/message/quota', { headers: h }),
      fetch('https://api.line.me/v2/bot/message/quota/consumption', { headers: h }),
    ]);
    if (!q.ok || !c.ok) {
      return { configured: true, error: `LINE ${q.ok ? c.status : q.status}: ${(await (q.ok ? c : q).text()).slice(0, 200)}` };
    }
    const qj = await q.json(), cj = await c.json();
    // type 'none' = แพ็กเกจไม่จำกัด (ไม่มี value)
    return {
      configured: true,
      limit: qj.type === 'limited' ? Number(qj.value) : null,
      used: Number(cj.totalUsage ?? 0),
    };
  } catch (e) {
    return { configured: true, error: String(e).slice(0, 200) };
  }
}

async function brevoQuota() {
  const key = Deno.env.get('BREVO_API_KEY') ?? '';
  if (!key) return { configured: false };
  try {
    const r = await fetch('https://api.brevo.com/v3/account', { headers: { 'api-key': key, accept: 'application/json' } });
    if (!r.ok) return { configured: true, error: `Brevo ${r.status}: ${(await r.text()).slice(0, 200)}` };
    const j = await r.json();
    const plans = Array.isArray(j.plan) ? j.plan : [];
    // อีเมลแบบ transactional ใช้เครดิตแถว sendLimit (แผนฟรี = รายวัน) หรือ type 'payAsYouGo'/'subscription'
    const p = plans.find((x) => x.creditsType === 'sendLimit') ?? plans[0] ?? null;
    return {
      configured: true,
      plan: p?.type ?? null,
      credits_type: p?.creditsType ?? null,
      remaining: p && p.credits !== undefined ? Number(p.credits) : null,
      // endDate มีเฉพาะแผนจ่ายรายเดือน — แผนฟรีรีเซ็ตทุกวัน
      end_date: p?.endDate ?? null,
    };
  } catch (e) {
    return { configured: true, error: String(e).slice(0, 200) };
  }
}

/* นับจาก notifications เดือนนี้ (เวลาไทย) แยกช่องทางด้วยคำนำหน้า subject '[LINE]' แบบเดียวกับ sendLineWithLog() */
async function ownCounts(admin) {
  const { month, day } = bangkokStarts();
  const rows: { subject: string | null; status: string | null; sent_at: string }[] = [];
  for (let from = 0; from < 20000; from += 1000) {
    const { data, error } = await admin
      .from('notifications')
      .select('subject,status,sent_at')
      .gte('sent_at', month)
      .order('sent_at', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + 999);
    if (error) return { error: error.message };
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  const blank = () => ({ sent: 0, failed: 0, skipped: 0 });
  const out = {
    month_start: month,
    day_start: day,
    email: { month: blank(), today: blank() },
    line: { month: blank(), today: blank() },
  };
  for (const r of rows) {
    const ch = /^\[LINE\]/.test(r.subject ?? '') ? out.line : out.email;
    const st = r.status === 'sent' || r.status === 'failed' || r.status === 'skipped' ? r.status : 'sent';
    ch.month[st]++;
    if (r.sent_at >= day) ch.today[st]++;
  }
  return out;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'GET' && req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const { caller, admin } = await requireAuth(req);
    if (caller.type !== 'system' && !['ROLE-DEV', 'ROLE-SYS', 'ROLE-STF'].includes(caller.role_code)) {
      return json({ error: 'forbidden' }, 403);
    }
    const [line, brevo, counts] = await Promise.all([lineQuota(), brevoQuota(), ownCounts(admin)]);
    return json({ ok: true, checked_at: new Date().toISOString(), line, brevo, counts });
  } catch (err) {
    const e = err as { status?: number; message?: string };
    if (e.status) return json({ error: e.message }, e.status);
    console.error('message-quota error:', err);
    return json({ error: String(err) }, 500);
  }
});
