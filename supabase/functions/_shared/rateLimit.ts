import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.108.2';
import type { Caller } from './requireAuth.ts';

/**
 * จำกัดจำนวนครั้งที่ user คนหนึ่งสั่งส่งแจ้งเตือน (email/LINE) ต่อชั่วโมง
 * ป้องกันบัญชีที่ถูก compromise ใช้เป็น spam relay — ไม่กันการยิงจาก system/cron
 * fail-open ถ้า RPC ยังไม่ deploy (migration 36 ยังไม่ได้รัน) เพื่อไม่ให้การแจ้งเตือนปกติพังทั้งระบบ
 */
export async function checkNotifyRateLimit(
  admin: SupabaseClient,
  caller: Caller,
  kind: 'email' | 'line',
  limitPerHour: number,
): Promise<void> {
  if (caller.type !== 'user') return;
  try {
    const { data, error } = await admin.rpc('check_and_bump_notify_rate', {
      p_caller: caller.id,
      p_kind: kind,
      p_limit: limitPerHour,
    });
    if (error) {
      console.error('checkNotifyRateLimit RPC error (fail-open):', error.message);
      return;
    }
    if (data === false) {
      throw { status: 429, message: 'ส่งแจ้งเตือนบ่อยเกินไป กรุณาลองใหม่ภายหลัง' };
    }
  } catch (e) {
    const err = e as { status?: number };
    if (err.status === 429) throw e;
    console.error('checkNotifyRateLimit unexpected error (fail-open):', e);
  }
}
