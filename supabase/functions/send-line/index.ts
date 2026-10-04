// Supabase Edge Function: send-line
// Body: { recipientId, text, flex?, documentId?, testSelf? }  (group:true ถูกปฏิเสธตั้งแต่ 2026-10-04)
// @ts-nocheck

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.108.2';
import { corsHeaders, json } from '../_shared/cors.ts';
import { requireAuth } from '../_shared/requireAuth.ts';
import { validateLineSend } from '../_shared/validateNotify.ts';
import { checkNotifyRateLimit } from '../_shared/rateLimit.ts';

const RATE_LIMIT_PER_HOUR = 50;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const body = await req.json();
    const { recipientId, text, group, flex, documentId, testSelf } = body;
    /* ยกเลิกการส่งเข้ากลุ่ม LINE เจ้าหน้าที่ 2026-10-04 — ข้อความกลุ่มหักโควตาเท่าจำนวนสมาชิก
       (โควตาเดือน ก.ย. 69 หมดวันที่ 28) ปฏิเสธที่ฝั่ง server ด้วย เพราะเบราว์เซอร์ที่ยังถือ JS รุ่นเก่า
       จะยังยิง group:true มาได้จนกว่าจะรีเฟรช — แจ้งรายคนเฉพาะคนที่เอกสารถึงคิวแทน */
    if (group === true) return json({ ok: false, skipped: 'group_disabled' });
    if (!recipientId || !text) {
      return json({ error: 'Missing required fields: recipientId, text' }, 400);
    }

    const { caller, admin } = await requireAuth(req);
    await validateLineSend(admin, caller, { recipientId, group, documentId, testSelf });
    await checkNotifyRateLimit(admin, caller, 'line', RATE_LIMIT_PER_HOUR);

    const LINE_TOKEN = Deno.env.get('LINE_CHANNEL_ACCESS_TOKEN') ?? '';
    if (!LINE_TOKEN) return json({ error: 'LINE_CHANNEL_ACCESS_TOKEN not configured' }, 500);

    const { data: profile, error: qErr } = await admin
      .from('users')
      .select('line_user_id')
      .eq('id', recipientId)
      .maybeSingle();
    if (qErr) return json({ error: qErr.message }, 500);
    if (!profile?.line_user_id) return json({ ok: false, skipped: 'not_linked' });
    const to: string = profile.line_user_id;

    const lineRes = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + LINE_TOKEN,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to,
        messages: [
          flex && typeof flex === 'object'
            ? { type: 'flex', altText: String(text).slice(0, 400), contents: flex }
            : { type: 'text', text: String(text).slice(0, 4900) },
        ],
      }),
    });

    if (!lineRes.ok) {
      const detail = await lineRes.json().catch(() => ({}));
      console.error('LINE push error:', lineRes.status, JSON.stringify(detail));
      return json({ error: detail?.message || 'LINE push failed', status: lineRes.status }, 502);
    }

    return json({ ok: true });
  } catch (err) {
    const e = err as { status?: number; message?: string };
    if (e.status) return json({ error: e.message }, e.status);
    console.error('send-line error:', err);
    return json({ error: String(err) }, 500);
  }
});
