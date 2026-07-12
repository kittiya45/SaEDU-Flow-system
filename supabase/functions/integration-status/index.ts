// Supabase Edge Function: integration-status
// คืนสถานะว่า secret บริการภายนอกถูกตั้งค่าแล้วหรือยัง (ไม่เปิดเผยค่า secret)
// GET หรือ POST — ต้องมี JWT ของ ROLE-DEV / ROLE-SYS / ROLE-STF
// @ts-nocheck

import { corsHeaders, json } from '../_shared/cors.ts';
import { requireAuth } from '../_shared/requireAuth.ts';

function hasEnv(key: string): boolean {
  return (Deno.env.get(key) ?? '').trim().length > 0;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'GET' && req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const { caller } = await requireAuth(req);
    if (
      caller.type !== 'system' &&
      !['ROLE-DEV', 'ROLE-SYS', 'ROLE-STF'].includes(caller.role_code)
    ) {
      return json({ error: 'forbidden' }, 403);
    }

    const emailOk = hasEnv('BREVO_API_KEY') && hasEnv('FROM_EMAIL');
    const lineOk = hasEnv('LINE_CHANNEL_ACCESS_TOKEN');
    const lineWebhookOk = hasEnv('LINE_CHANNEL_SECRET');
    const docxOk = hasEnv('CLOUDCONVERT_API_KEY');
    const cronOk = hasEnv('OVERDUE_CRON_SECRET');

    return json({
      ok: true,
      checked_at: new Date().toISOString(),
      integrations: {
        email: {
          label: 'อีเมล (Brevo)',
          configured: emailOk,
          parts: {
            BREVO_API_KEY: hasEnv('BREVO_API_KEY'),
            FROM_EMAIL: hasEnv('FROM_EMAIL'),
            FROM_NAME: hasEnv('FROM_NAME'),
          },
        },
        line: {
          label: 'LINE OA (ส่งข้อความ)',
          configured: lineOk,
          parts: {
            LINE_CHANNEL_ACCESS_TOKEN: lineOk,
          },
        },
        line_webhook: {
          label: 'LINE Webhook (ผูกบัญชี)',
          configured: lineWebhookOk,
          parts: {
            LINE_CHANNEL_SECRET: lineWebhookOk,
          },
        },
        docx_preview: {
          label: 'ดูตัวอย่าง Word (CloudConvert)',
          configured: docxOk,
          parts: {
            CLOUDCONVERT_API_KEY: docxOk,
          },
        },
        overdue_cron: {
          label: 'Cron แจ้งเตือนเกินกำหนด',
          configured: cronOk,
          optional: true,
          parts: {
            OVERDUE_CRON_SECRET: cronOk,
          },
        },
      },
    });
  } catch (err) {
    const e = err as { status?: number; message?: string };
    if (e.status) return json({ error: e.message }, e.status);
    console.error('integration-status error:', err);
    return json({ error: String(err) }, 500);
  }
});
