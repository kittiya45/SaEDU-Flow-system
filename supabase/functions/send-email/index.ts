// Supabase Edge Function: send-email
// ส่งอีเมลจริงผ่าน Brevo Transactional API
// Secrets: BREVO_API_KEY, FROM_EMAIL, FROM_NAME
// Body: { to, subject, html, documentId?, recipientUserId?, testSelf? }
// @ts-nocheck

import { corsHeaders, json } from '../_shared/cors.ts';
import { requireAuth } from '../_shared/requireAuth.ts';
import { validateEmailSend } from '../_shared/validateNotify.ts';
import { sendBrevoEmail } from '../_shared/brevo.ts';
import { checkNotifyRateLimit } from '../_shared/rateLimit.ts';

const RATE_LIMIT_PER_HOUR = 50;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const body = await req.json();
    const { to, subject, html, documentId, recipientUserId, testSelf } = body;

    if (!to || !subject || !html) {
      return json({ error: 'Missing required fields: to, subject, html' }, 400);
    }

    const { caller, admin } = await requireAuth(req);
    await validateEmailSend(admin, caller, { to, documentId, recipientUserId, testSelf });
    await checkNotifyRateLimit(admin, caller, 'email', RATE_LIMIT_PER_HOUR);

    const result = await sendBrevoEmail({ to, subject, html });
    if (!result.ok) {
      return json({ error: result.error }, result.status);
    }

    return json({ ok: true, messageId: result.messageId });
  } catch (err) {
    const e = err as { status?: number; message?: string };
    if (e.status) return json({ error: e.message }, e.status);
    console.error('send-email error:', err);
    return json({ error: String(err) }, 500);
  }
});
