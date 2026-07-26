import { corsHeaders, json } from '../_shared/cors.ts';
import { requireAuth } from '../_shared/requireAuth.ts';
import { validateStorageUrl } from '../_shared/validateNotify.ts';

const CLOUDCONVERT_API = 'https://api.cloudconvert.com/v2';
const POLL_INTERVAL_MS = 1200;
const MAX_POLLS = 25;
const MAX_BYTES = 20 * 1024 * 1024; // 20 MB — สอดคล้อง limit อัปโหลดในแอป
const CACHE_PREFIX = '_docx_cache/';
const CACHE_SIGNED_URL_TTL = 3600; // 1 ชั่วโมง — พอสำหรับเปิดดูทันทีหลัง request

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function mapCcError(msg: string): string {
  if (/unauthenticated/i.test(msg)) {
    return 'CloudConvert API Key ไม่ถูกต้อง — ตั้งค่า CLOUDCONVERT_API_KEY ใน Supabase Dashboard → Edge Functions → Secrets แล้วรัน npx supabase functions deploy convert-docx';
  }
  return msg;
}

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** เลข path ต้นทางที่ใช้ทำ cache key เดียวกันไม่ว่าจะเรียกด้วย storagePath หรือ url ของไฟล์เดียวกัน */
function cacheSourcePath(storagePath?: string, url?: string): string | null {
  if (storagePath) return String(storagePath).replace(/^\/+/, '');
  if (url) {
    const m = String(url).match(/\/documents\/([^?]+)/);
    if (m) return decodeURIComponent(m[1]);
  }
  return null;
}

type ImportTask =
  | { operation: 'import/base64'; file: string; filename: string }
  | { operation: 'import/url'; url: string };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const { admin } = await requireAuth(req);

    const { url, path: storagePath } = await req.json();

    // ── cache: ไฟล์ DOCX เดิมเคยแปลงแล้วให้ใช้ผลเดิม ไม่ต้องเรียก CloudConvert ซ้ำ ──
    const srcPath = cacheSourcePath(storagePath, url);
    const cachePath = srcPath ? CACHE_PREFIX + (await sha256Hex(srcPath)) + '.pdf' : null;
    if (cachePath) {
      const { data: cached } = await admin.storage.from('documents').createSignedUrl(cachePath, CACHE_SIGNED_URL_TTL);
      if (cached?.signedUrl) {
        return json({ ok: true, pdfUrl: cached.signedUrl, cached: true });
      }
    }

    let importTask: ImportTask | null = null;

    if (storagePath) {
      const clean = String(storagePath).replace(/^\/+/, '');
      const { data: fileData, error: dlErr } = await admin.storage.from('documents').download(clean);
      if (dlErr || !fileData) {
        return json({ error: 'ดาวน์โหลดไฟล์จาก Storage ไม่สำเร็จ' + (dlErr?.message ? ': ' + dlErr.message : '') }, 502);
      }
      const bytes = new Uint8Array(await fileData.arrayBuffer());
      if (bytes.length > MAX_BYTES) {
        return json({ error: 'ไฟล์ใหญ่เกิน 20 MB — กรุณาดาวน์โหลดแล้วเปิดด้วย Word แทน' }, 413);
      }
      const filename = clean.split('/').pop() || 'document.docx';
      importTask = { operation: 'import/base64', file: bytesToBase64(bytes), filename };
    } else if (url) {
      validateStorageUrl(url);
      importTask = { operation: 'import/url', url };
    }

    if (!importTask) return json({ error: 'path or url is required' }, 400);

    const apiKey = (Deno.env.get('CLOUDCONVERT_API_KEY') ?? '').trim();
    if (!apiKey) {
      return json({ error: 'ยังไม่ได้ตั้ง CLOUDCONVERT_API_KEY — สมัครฟรีที่ cloudconvert.com แล้ว npx supabase secrets set CLOUDCONVERT_API_KEY=...' }, 500);
    }
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
          'import-file': importTask,
          'convert-file': { operation: 'convert', input: 'import-file', output_format: 'pdf' },
          'export-file': { operation: 'export/url', input: 'convert-file' },
        },
      }),
    });
    const createData = await createRes.json();
    if (!createRes.ok) {
      const raw = createData?.message || 'สร้างงานแปลงไฟล์ไม่สำเร็จ';
      return json({ error: mapCcError(raw) }, 502);
    }

    const jobId = createData.data.id;
    let job = createData.data;

    for (let i = 0; i < MAX_POLLS && job.status !== 'finished' && job.status !== 'error'; i++) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      const pollRes = await fetch(`${CLOUDCONVERT_API}/jobs/${jobId}`, { headers: ccHeaders });
      const pollData = await pollRes.json();
      job = pollData.data;
    }

    if (job.status === 'error') {
      type CCTaskErr = { name?: string; status?: string; message?: string; result?: { error?: { message?: string } } };
      const failed = (job.tasks as CCTaskErr[] | undefined)?.find((t) => t.status === 'error');
      const raw = failed?.message || failed?.result?.error?.message || 'แปลงไฟล์ไม่สำเร็จ';
      return json({ error: mapCcError(raw) }, 502);
    }

    if (job.status !== 'finished') {
      return json({ error: 'แปลงไฟล์ไม่สำเร็จหรือใช้เวลานานเกินไป' }, 504);
    }

    type CCTask = { name: string; result?: { files?: Array<{ url?: string }> } };
    const exportTask = (job.tasks as CCTask[] | undefined)?.find((t) => t.name === 'export-file');
    const file = exportTask?.result?.files?.[0];
    if (!file?.url) return json({ error: 'ไม่พบไฟล์ผลลัพธ์จากการแปลง' }, 502);

    // ── เก็บผลลัพธ์ลง Storage ไว้ใช้ครั้งถัดไป (best-effort — พังแล้ว fallback กลับไปใช้ URL ของ CloudConvert ตรงๆ) ──
    if (cachePath) {
      try {
        const pdfRes = await fetch(file.url);
        if (pdfRes.ok) {
          const pdfBytes = new Uint8Array(await pdfRes.arrayBuffer());
          const { error: upErr } = await admin.storage
            .from('documents')
            .upload(cachePath, pdfBytes, { contentType: 'application/pdf', upsert: true });
          if (!upErr) {
            const { data: signed } = await admin.storage.from('documents').createSignedUrl(cachePath, CACHE_SIGNED_URL_TTL);
            if (signed?.signedUrl) return json({ ok: true, pdfUrl: signed.signedUrl, cached: false });
          }
        }
      } catch (cacheErr) {
        console.warn('convert-docx: cache write failed, falling back to CloudConvert URL:', cacheErr);
      }
    }

    return json({ ok: true, pdfUrl: file.url });
  } catch (e) {
    const err = e as { status?: number; message?: string };
    if (err.status) return json({ error: mapCcError(err.message || 'error') }, err.status);
    return json({ error: mapCcError(err.message || String(e)) }, 500);
  }
});
