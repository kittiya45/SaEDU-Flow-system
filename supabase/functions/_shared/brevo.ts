export async function sendBrevoEmail(opts: {
  to: string | string[];
  subject: string;
  html: string;
}): Promise<{ ok: true; messageId?: string } | { ok: false; error: unknown; status: number }> {
  const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY') ?? '';
  const FROM_NAME = Deno.env.get('FROM_NAME') ?? 'SAEDU Flow';
  const FROM_EMAIL = Deno.env.get('FROM_EMAIL') ?? '';

  if (!BREVO_API_KEY) {
    return { ok: false, error: 'BREVO_API_KEY not configured', status: 500 };
  }

  const toList = (Array.isArray(opts.to) ? opts.to : [opts.to]).map((email: string) => ({ email }));

  const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': BREVO_API_KEY,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      sender: { name: FROM_NAME, email: FROM_EMAIL },
      to: toList,
      subject: opts.subject,
      htmlContent: opts.html,
    }),
  });

  const data = await brevoRes.json();
  if (!brevoRes.ok) {
    console.error('Brevo error:', JSON.stringify(data));
    return { ok: false, error: data, status: brevoRes.status };
  }

  return { ok: true, messageId: data.messageId };
}
