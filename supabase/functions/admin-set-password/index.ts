import { corsHeaders, json } from '../_shared/cors.ts';
import { requireStaff } from '../_shared/requireStaff.ts';

// เรียกโดย admin.js / dev panel (doAdmResetPw) — แอดมินหรือนักพัฒนาตั้งรหัสผ่านใหม่ให้ user คนอื่น
// ต้องใช้ service-role key เซ็ตรหัสผ่านของคนอื่นใน auth.users จึงต้องผ่าน Edge Function นี้
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { admin, role_code } = await requireStaff(req);

    const { targetAuthUid, newPassword } = await req.json();
    if (typeof targetAuthUid !== 'string' || typeof newPassword !== 'string' || !targetAuthUid || !newPassword) {
      return json({ error: 'targetAuthUid and newPassword are required' }, 400);
    }
    if (newPassword.length < 6) {
      return json({ error: 'newPassword must be at least 6 characters' }, 400);
    }

    const { data: target, error: targetErr } = await admin.from('users')
      .select('role_code').eq('auth_uid', targetAuthUid).maybeSingle();
    if (targetErr) throw { status: 500, message: 'unable to verify target account' };
    if (!target) return json({ error: 'target account not found' }, 404);
    // DEV cannot take over a SYS account by resetting its password.
    if (role_code === 'ROLE-DEV' && target.role_code === 'ROLE-SYS') {
      return json({ error: 'forbidden — dev cannot reset system administrator' }, 403);
    }

    const { error } = await admin.auth.admin.updateUserById(targetAuthUid, { password: newPassword });
    if (error) return json({ error: error.message }, 400);

    return json({ ok: true });
  } catch (e) {
    const err = e as { status?: number; message?: string };
    return json({ error: err.message || String(e) }, err.status || 500);
  }
});
