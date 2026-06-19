import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.108.2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

/**
 * ตรวจ JWT ของผู้เรียก ยืนยันว่ามี role_code เป็นแอดมิน (ROLE-SYS/ROLE-STF) ใน public.users
 * คืน service-role client ให้ใช้ทำ Admin API ต่อ ถ้าไม่ผ่านจะ throw (caller จับแล้วตอบ 401/403)
 */
export async function requireAdmin(req: Request): Promise<SupabaseClient> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) throw { status: 401, message: 'missing authorization' };

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const jwt = authHeader.replace('Bearer ', '');
  const { data: callerData, error: callerErr } = await admin.auth.getUser(jwt);
  if (callerErr || !callerData?.user) throw { status: 401, message: 'invalid session' };

  const { data: profile } = await admin
    .from('users')
    .select('role_code')
    .eq('auth_uid', callerData.user.id)
    .maybeSingle();

  if (!profile || !['ROLE-SYS', 'ROLE-STF'].includes(profile.role_code)) {
    throw { status: 403, message: 'forbidden — admin only' };
  }

  return admin;
}
