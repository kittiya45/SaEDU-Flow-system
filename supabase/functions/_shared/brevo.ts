/* ข้อความสั้น ๆ ของสาเหตุที่ล้ม — เอาไปเก็บใน notifications.error_message ให้ Dev Panel อ่านได้
   (เดิมทิ้งไว้ใน console.error ของ Edge Function ซึ่งไม่มีใครเห็น จึงเดาไม่ออกว่า Brevo ปฏิเสธเพราะอะไร) */
export function brevoErrText(r: { error?: unknown; status?: number }): string {
  const e = r.error as Record<string, unknown> | string | undefined;
  const msg = typeof e === 'string' ? e
    : (e && typeof e === 'object' && (e.message ?? e.code)) ? String(e.message ?? e.code)
    : JSON.stringify(e ?? '');
  return `Brevo ${r.status ?? '?'}: ${msg}`.slice(0, 500);
}

/* ล้มชั่วคราวต้องลองใหม่ ไม่ใช่ทิ้ง — อีเมล "เลยกำหนด" ส่งครั้งเดียวตลอดกาล (ดู overdue_notif_sent_at)
   ล้มรอบเดียวคือผู้รับไม่มีวันได้รับเลย 429 = เกินอัตราที่ Brevo ยอม, 5xx = ฝั่ง Brevo, network = IP
   ของ Edge Function เปลี่ยน/หลุด — ทั้งสามหายเองใน 1-2 วินาที ส่วน 4xx อื่น (อีเมลผิด, sender ไม่ยืนยัน,
   Authorised IPs บล็อก) ลองซ้ำกี่ครั้งก็ได้ผลเดิม จึงคืนค่าทันที */
const RETRYABLE = (s: number) => s === 0 || s === 429 || s >= 500;   // 0 = เน็ตหลุด (ดู sendBrevoOnce)
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function sendBrevoEmail(opts: {
  to: string | string[];
  subject: string;
  html: string;
  attempts?: number;
}): Promise<{ ok: true; messageId?: string } | { ok: false; error: unknown; status: number }> {
  // ไม่ได้ตั้ง secret — ลองซ้ำก็ไม่ช่วย ตอบทันที (status 500 จะเข้าเงื่อนไข RETRYABLE โดยไม่ตั้งใจ)
  if (!Deno.env.get('BREVO_API_KEY')) {
    return { ok: false, error: 'BREVO_API_KEY not configured', status: 500 };
  }
  const attempts = Math.max(1, opts.attempts ?? 3);
  let last: { ok: false; error: unknown; status: number } = { ok: false, error: 'no attempt', status: 0 };
  for (let i = 1; i <= attempts; i++) {
    const r = await sendBrevoOnce(opts);
    if (r.ok) {
      if (i > 1) console.log(`Brevo ส่งสำเร็จในครั้งที่ ${i}`);
      return r;
    }
    last = r;
    if (i === attempts || !RETRYABLE(r.status)) break;
    await sleep(i * 1500);   // 1.5s, 3s
  }
  return last;
}

async function sendBrevoOnce(opts: {
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

  let brevoRes: Response;
  try {
    brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
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
  } catch (e) {
    // เน็ตหลุด/DNS/timeout — status 0 ให้ตัวเรียกรู้ว่าลองใหม่ได้ (เดิม throw ทะลุออกไปเป็น 500)
    return { ok: false, error: String((e as Error)?.message ?? e), status: 0 };
  }

  const data = await brevoRes.json().catch(() => ({}));
  if (!brevoRes.ok) {
    console.error('Brevo error:', JSON.stringify(data));
    return { ok: false, error: data, status: brevoRes.status };
  }

  return { ok: true, messageId: data.messageId };
}
