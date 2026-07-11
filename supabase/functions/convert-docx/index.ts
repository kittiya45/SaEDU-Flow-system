import { corsHeaders, json } from '../_shared/cors.ts';
import { requireAuth } from '../_shared/requireAuth.ts';
import { validateStorageUrl } from '../_shared/validateNotify.ts';

const CLOUDCONVERT_API = 'https://api.cloudconvert.com/v2';
const POLL_INTERVAL_MS = 1200;
const MAX_POLLS = 25;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    await requireAuth(req);

    const { url } = await req.json();
    if (!url) return json({ error: 'url is required' }, 400);

    validateStorageUrl(url);

    const apiKey = (Deno.env.get('CLOUDCONVERT_API_KEY') ?? '').trim();
    if (!apiKey) return json({ error: 'CLOUDCONVERT_API_KEY not configured' }, 500);
    if (!/^[\x00-\xFF]*$/.test(apiKey)) {
      return json({ error: 'CLOUDCONVERT_API_KEY มีอักขระที่ไม่ถูกต้อง' }, 500);
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
    const err = e as { status?: number; message?: string };
    if (err.status) return json({ error: err.message }, err.status);
    return json({ error: err.message || String(e) }, 500);
  }
});
