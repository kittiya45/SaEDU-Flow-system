import { corsHeaders, json } from '../_shared/cors.ts';
import { requireAdmin } from '../_shared/requireAdmin.ts';

// เรียกโดย admin.js (doAdmResetPw) — แอดมินตั้งรหัสผ่านใหม่ให้ user คนอื่นโดยตรง
// ต้องใช้ service-role key เซ็ตรหัสผ่านของคนอื่นใน auth.users จึงต้องผ่าน Edge Function นี้
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const admin = await requireAdmin(req);

    const { targetAuthUid, newPassword } = await req.json();
    if (!targetAuthUid || !newPassword) {
      return json({ error: 'targetAuthUid and newPassword are required' }, 400);
    }
    if (newPassword.length < 6) {
      return json({ error: 'newPassword must be at least 6 characters' }, 400);
    }

    const { error } = await admin.auth.admin.updateUserById(targetAuthUid, { password: newPassword });
    if (error) return json({ error: error.message }, 400);

    return json({ ok: true });
  } catch (e) {
    const err = e as { status?: number; message?: string };
    return json({ error: err.message || String(e) }, err.status || 500);
  }
});
