import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.108.2';
import type { Caller } from './requireAuth.ts';
import { isStaffRole } from './requireAuth.ts';

function normEmail(e: string | null | undefined): string {
  return String(e || '').trim().toLowerCase();
}

/** อีเมลปลายทางตรงกับผู้รับที่ระบุหรือไม่ */
export function emailMatchesRecipient(
  to: string | string[],
  recipientEmail: string | null,
  contactEmail: string | null,
): boolean {
  const allowed = new Set(
    [recipientEmail, contactEmail].map(normEmail).filter(Boolean),
  );
  const list = Array.isArray(to) ? to : [to];
  return list.every((e) => allowed.has(normEmail(e)));
}

/** ส่งทดสอบถึงตัวเองเท่านั้น */
export function isSelfTest(caller: Caller, to: string | string[]): boolean {
  if (caller.type !== 'user') return false;
  return emailMatchesRecipient(to, caller.email, caller.contact_email);
}

/** ตรวจสิทธิ์ส่งแจ้งเตือน — สอดคล้อง can_log_notification() ใน 22_scale_hardening.sql */
export async function canNotifyDocument(
  admin: SupabaseClient,
  senderId: string,
  roleCode: string,
  documentId: string,
): Promise<boolean> {
  if (isStaffRole(roleCode)) return true;

  const { data: doc } = await admin
    .from('documents')
    .select('id, created_by, forwarded_to_id')
    .eq('id', documentId)
    .maybeSingle();
  if (!doc) return false;

  if (doc.created_by === senderId || doc.forwarded_to_id === senderId) return true;

  const { data: steps } = await admin
    .from('workflow_steps')
    .select('assigned_to, rejected_by')
    .eq('document_id', documentId);

  return (steps ?? []).some(
    (s) => s.assigned_to === senderId || s.rejected_by === senderId,
  );
}

export async function validateEmailSend(
  admin: SupabaseClient,
  caller: Caller,
  body: {
    to: string | string[];
    documentId?: string | null;
    recipientUserId?: string | null;
    testSelf?: boolean;
  },
): Promise<void> {
  if (caller.type === 'system') return;

  if (body.testSelf) {
    if (!isSelfTest(caller, body.to)) throw { status: 403, message: 'testSelf: recipient must be self' };
    return;
  }

  if (!body.documentId || !body.recipientUserId) {
    throw { status: 403, message: 'documentId and recipientUserId required' };
  }

  const { data: recip } = await admin
    .from('users')
    .select('id, email, contact_email')
    .eq('id', body.recipientUserId)
    .maybeSingle();
  if (!recip) throw { status: 403, message: 'recipient not found' };

  if (!emailMatchesRecipient(body.to, recip.email, recip.contact_email)) {
    throw { status: 403, message: 'to email does not match recipient' };
  }

  const ok = await canNotifyDocument(admin, caller.id, caller.role_code, body.documentId);
  if (!ok) throw { status: 403, message: 'not allowed to notify for this document' };
}

export async function validateLineSend(
  admin: SupabaseClient,
  caller: Caller,
  body: {
    recipientId?: string | null;
    group?: boolean;
    documentId?: string | null;
    testSelf?: boolean;
  },
): Promise<void> {
  if (caller.type === 'system') return;

  /* กลุ่ม LINE เป็นกล่องรวมของทั้งระบบ ไม่ใช่กล่องส่วนตัวของใคร
     เดิมด่านนี้จำกัดไว้ที่ staff/dev เท่านั้น ซึ่งกันผิดคน: การแจ้งเข้ากลุ่มเกิดตอน
     "สร้าง / ส่งใหม่ / อนุมัติ" ซึ่งผู้ลงมือคือนิสิตหรืออาจารย์ ไม่ใช่เจ้าหน้าที่
     → ถูกตอบ 403 ทุกครั้งแบบเงียบ ๆ (ฝั่ง client แค่ console.warn ไม่มี log ลง DB
     เพราะ group push ไม่ถูกบันทึกใน notifications) กลุ่มจึงไม่ได้รับอะไรเลยตั้งแต่
     26 ก.ค. 69 ที่ deploy guard นี้ — ข้อความสุดท้ายในกลุ่มคือ 21 ก.ค. 69

     ตอนนี้: staff/dev ผ่านเสมอ (ครอบปุ่ม "ทดสอบส่ง" ในหน้าตั้งค่าระบบซึ่งไม่มี documentId)
     คนอื่นต้องเป็นผู้เกี่ยวข้องกับเอกสารใบนั้นจริง — เกณฑ์เดียวกับ push รายคนด้านล่าง
     ปลอดภัยเท่าเดิมเพราะเนื้อหาที่เข้ากลุ่มคือข้อมูลเอกสารชุดเดียวกับที่เขาส่งหา
     ผู้รับรายคนได้อยู่แล้ว ไม่ได้เปิดช่องให้ยิงข้อความอิสระเข้ากลุ่ม */
  if (body.group === true) {
    if (caller.type !== 'user') throw { status: 403, message: 'group LINE: user session required' };
    if (isStaffRole(caller.role_code)) return;
    if (!body.documentId) throw { status: 403, message: 'group LINE: documentId required' };
    const okGroup = await canNotifyDocument(admin, caller.id, caller.role_code, body.documentId);
    if (!okGroup) throw { status: 403, message: 'not allowed to notify for this document' };
    return;
  }

  if (!body.recipientId) throw { status: 400, message: 'recipientId required' };

  if (body.testSelf && caller.type === 'user' && body.recipientId === caller.id) return;

  if (!body.documentId) throw { status: 403, message: 'documentId required for LINE push' };

  const ok = await canNotifyDocument(admin, caller.id, caller.role_code, body.documentId);
  if (!ok) throw { status: 403, message: 'not allowed to notify for this document' };
}

/** convert-docx: อนุญาตเฉพาะ URL ใน documents bucket ของโปรเจกต์นี้ (public หรือ signed) */
export function validateStorageUrl(url: string): void {
  const base = Deno.env.get('SUPABASE_URL') ?? '';
  const okPrefixes = [
    `${base}/storage/v1/object/public/documents/`,
    `${base}/storage/v1/object/sign/documents/`,
  ];
  if (!url || !okPrefixes.some((p) => url.startsWith(p))) {
    throw { status: 403, message: 'url must be a documents bucket URL for this project' };
  }
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:') throw new Error('https only');
  } catch {
    throw { status: 403, message: 'invalid url' };
  }
}
