import { corsHeaders, json } from '../_shared/cors.ts';
import { requireAdmin } from '../_shared/requireAdmin.ts';

// เรียกโดย admin.js (saveAddAdvisor) และ adminImport.js (doImport)
// แอดมินสร้างบัญชีให้คนอื่นโดยตรงโดยไม่ต้องให้เจ้าของบัญชี signUp เอง —
// ต้องใช้ service-role สร้างแถวใน auth.users จึงต้องผ่าน Edge Function นี้
// (ก่อนหน้านี้ทั้งสองจุดเรียกใช้ insert ตรงเข้า public.users แบบ password_hash
// ซึ่งเป็นรูปแบบก่อนย้ายไป Supabase Auth — ไม่มี auth.users row จึง login ไม่ได้
// และตาราง users ไม่มี insert policy ฝั่ง RLS เลย insert จะถูกปฏิเสธตั้งแต่แรก)
//
// createUser() จะไปสะกิด trigger link_auth_user() ให้สร้างแถว public.users
// แบบ approval_status='pending', is_active=false ตาม default เสมอ — โค้ดนี้
// patch ให้ approved+active ทันทีหลังจากนั้น (เทียบเท่าพฤติกรรมเดิมของฟีเจอร์นี้)
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const admin = await requireAdmin(req);

    const { email, password, full_name, role_code, department, user_type, contact_email, position_code, approved_by } = await req.json();
    if (!email || !password || !full_name || !role_code) {
      return json({ error: 'email, password, full_name, role_code are required' }, 400);
    }
    if (password.length < 6) {
      return json({ error: 'password must be at least 6 characters' }, 400);
    }

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, role_code, department, user_type: user_type || 'staff', contact_email, position_code },
    });
    if (createErr) return json({ error: createErr.message }, 400);
    if (!created?.user) return json({ error: 'createUser returned no user' }, 500);

    const { error: updErr } = await admin
      .from('users')
      .update({ approval_status: 'approved', is_active: true, approved_at: new Date().toISOString(), approved_by: approved_by || null })
      .eq('auth_uid', created.user.id);
    if (updErr) return json({ error: updErr.message }, 400);

    return json({ ok: true, id: created.user.id });
  } catch (e) {
    const err = e as { status?: number; message?: string };
    return json({ error: err.message || String(e) }, err.status || 500);
  }
});
