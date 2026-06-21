import { corsHeaders, json } from '../_shared/cors.ts';

// เรียกโดย viewer.js (renderDocxAsPdf) — แปลง DOCX/DOC เป็น PDF ผ่าน CloudConvert
// แล้วให้ฝั่ง client แสดงผลด้วย PDF.js viewer ที่มีอยู่แล้ว (เหมือนเปิดใน Word จริง)
// Secret: CLOUDCONVERT_API_KEY (สมัครฟรีที่ cloudconvert.com แล้ว `supabase secrets set CLOUDCONVERT_API_KEY=...`)

const CLOUDCONVERT_API = 'https://api.cloudconvert.com/v2';
const POLL_INTERVAL_MS = 1200;
const MAX_POLLS = 25; // ~30s

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { url } = await req.json();
    if (!url) return json({ error: 'url is required' }, 400);

    const apiKey = (Deno.env.get('CLOUDCONVERT_API_KEY') ?? '').trim();
    if (!apiKey) return json({ error: 'CLOUDCONVERT_API_KEY not configured' }, 500);
    // ตรวจว่า key เป็น ASCII ล้วน — ถ้าคัดลอกมาจากหน้าเว็บ มักมีอักขระแปลกปลอม (smart quote, zero-width space ฯลฯ)
    // ติดมาด้วยโดยไม่รู้ตัว ซึ่งจะทำให้ fetch() ด้านล่าง throw "...is not a valid ByteString" ทันที
    if (!/^[\x00-\xFF]*$/.test(apiKey)) {
      console.error('CLOUDCONVERT_API_KEY contains non-ASCII characters — likely a copy-paste artifact');
      return json({ error: 'CLOUDCONVERT_API_KEY มีอักขระที่ไม่ถูกต้อง (อาจติดมาจากการคัดลอก) กรุณาตั้งค่า secret ใหม่' }, 500);
    }

    const ccHeaders = {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    };

    const createRes = await fetch(`${CLOUDCONVERT_API}/jobs`, {
      method: 'POST',
      headers: ccHeaders,
      body: JSON.stringify({
        tasks: {
          'import-file': { operation: 'import/url', url },
          'convert-file': { operation: 'convert', input: 'import-file', output_format: 'pdf' },
          'export-file': { operation: 'export/url', input: 'convert-file' },
        },
      }),
    });
    const createData = await createRes.json();
    if (!createRes.ok) {
      return json({ error: createData?.message || 'สร้างงานแปลงไฟล์ไม่สำเร็จ' }, 502);
    }

    const jobId = createData.data.id;
    let job = createData.data;

    for (let i = 0; i < MAX_POLLS && job.status !== 'finished' && job.status !== 'error'; i++) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      const pollRes = await fetch(`${CLOUDCONVERT_API}/jobs/${jobId}`, { headers: ccHeaders });
      const pollData = await pollRes.json();
      job = pollData.data;
    }

    if (job.status !== 'finished') {
      return json({ error: 'แปลงไฟล์ไม่สำเร็จหรือใช้เวลานานเกินไป' }, 504);
    }

    type CCTask = { name: string; result?: { files?: Array<{ url?: string }> } };
    const exportTask = (job.tasks as CCTask[] | undefined)?.find((t) => t.name === 'export-file');
    const file = exportTask?.result?.files?.[0];
    if (!file?.url) return json({ error: 'ไม่พบไฟล์ผลลัพธ์จากการแปลง' }, 502);

    return json({ ok: true, pdfUrl: file.url });
  } catch (e) {
    const err = e as { message?: string };
    return json({ error: err.message || String(e) }, 500);
  }
});
