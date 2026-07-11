// Supabase Edge Function: send-line
// Body: { recipientId, text, group?, flex?, documentId?, testSelf? }
// @ts-nocheck

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.108.2';
import { corsHeaders, json } from '../_shared/cors.ts';
import { requireAuth } from '../_shared/requireAuth.ts';
import { validateLineSend } from '../_shared/validateNotify.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const body = await req.json();
    const { recipientId, text, group, flex, documentId, testSelf } = body;
    if ((!recipientId && group !== true) || !text) {
      return json({ error: 'Missing required fields: recipientId (or group:true), text' }, 400);
    }

    const { caller, admin } = await requireAuth(req);
    await validateLineSend(admin, caller, { recipientId, group, documentId, testSelf });

    const LINE_TOKEN = Deno.env.get('LINE_CHANNEL_ACCESS_TOKEN') ?? '';
    if (!LINE_TOKEN) return json({ error: 'LINE_CHANNEL_ACCESS_TOKEN not configured' }, 500);

    let to: string;
    if (group === true) {
      const { data: row, error: gErr } = await admin
        .from('app_settings')
        .select('value')
        .eq('key', 'line_group_id')
        .maybeSingle();
      if (gErr) return json({ error: gErr.message }, 500);
      if (!row?.value) return json({ ok: false, skipped: 'no_group' });
      to = row.value;
    } else {
      const { data: profile, error: qErr } = await admin
        .from('users')
        .select('line_user_id')
        .eq('id', recipientId)
        .maybeSingle();
      if (qErr) return json({ error: qErr.message }, 500);
      if (!profile?.line_user_id) return json({ ok: false, skipped: 'not_linked' });
      to = profile.line_user_id;
    }

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
