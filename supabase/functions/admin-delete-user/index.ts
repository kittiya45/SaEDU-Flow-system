import { corsHeaders, json } from '../_shared/cors.ts';
import { requireAdmin } from '../_shared/requireAdmin.ts';

// เรียกโดย admin.js (_admDelConfirmed) หลังจาก unlink FK ต่างๆใน public.users เรียบร้อยแล้ว
// ลบ auth.users จริงต้องใช้ service-role key — ทำใน browser ไม่ได้ จึงต้องมาผ่าน Edge Function นี้
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const admin = await requireAdmin(req);

    const { targetAuthUid } = await req.json();
    if (!targetAuthUid) return json({ error: 'targetAuthUid is required' }, 400);

    const { error } = await admin.auth.admin.deleteUser(targetAuthUid);
    if (error) return json({ error: error.message }, 400);

    return json({ ok: true });
  } catch (e) {
    const err = e as { status?: number; message?: string };
    return json({ error: err.message || String(e) }, err.status || 500);
  }
});
