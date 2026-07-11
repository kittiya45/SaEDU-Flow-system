import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.108.2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

export type Caller =
  | { type: 'system' }
  | {
      type: 'user';
      authUid: string;
      id: string;
      role_code: string;
      email: string;
      contact_email: string | null;
    };

export function serviceAdmin(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
}

/** คืน caller = system (service role / cron) หรือ user profile จาก JWT */
export async function requireAuth(req: Request): Promise<{ caller: Caller; admin: SupabaseClient }> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) throw { status: 401, message: 'missing authorization' };

  const token = authHeader.slice(7);
  const admin = serviceAdmin();

  if (token === SERVICE_ROLE_KEY) {
    return { caller: { type: 'system' }, admin };
  }

  const cronSecret = Deno.env.get('OVERDUE_CRON_SECRET') ?? '';
  if (cronSecret && req.headers.get('x-cron-secret') === cronSecret) {
    return { caller: { type: 'system' }, admin };
  }

  const { data: callerData, error: callerErr } = await admin.auth.getUser(token);
  if (callerErr || !callerData?.user) throw { status: 401, message: 'invalid session' };

  const { data: profile, error: pErr } = await admin
    .from('users')
    .select('id, role_code, email, contact_email')
    .eq('auth_uid', callerData.user.id)
    .maybeSingle();

  if (pErr || !profile) throw { status: 403, message: 'profile not found' };

  return {
    caller: {
      type: 'user',
      authUid: callerData.user.id,
      id: profile.id,
      role_code: profile.role_code,
      email: profile.email,
      contact_email: profile.contact_email,
    },
    admin,
  };
}

export function isStaffRole(role: string): boolean {
  return ['ROLE-SYS', 'ROLE-STF', 'ROLE-DEV'].includes(role);
}
