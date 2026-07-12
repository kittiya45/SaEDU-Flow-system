import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.108.2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

/** แอดมิน (ROLE-SYS/ROLE-STF) หรือนักพัฒนา (ROLE-DEV) — สำหรับ reset password ฯลฯ */
export async function requireStaff(req: Request): Promise<{ admin: SupabaseClient; role_code: string }> {
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

  if (!profile || !['ROLE-SYS', 'ROLE-STF', 'ROLE-DEV'].includes(profile.role_code)) {
    throw { status: 403, message: 'forbidden — staff/dev only' };
  }

  return { admin, role_code: profile.role_code };
}
