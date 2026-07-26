-- ============================================================================
-- Rate limit สำหรับ send-email / send-line Edge Functions
-- รันใน Supabase SQL Editor (idempotent — รันซ้ำได้)
--
-- ที่มา: send-email/send-line เปิดให้ authenticated user ทุกคนเรียกได้ (มี
-- validateEmailSend/validateLineSend ใน _shared/validateNotify.ts จำกัดว่าต้อง
-- เป็นผู้เกี่ยวข้องกับเอกสารนั้นจริงก่อนแล้ว) แต่ไม่มีเพดานจำนวนครั้ง — บัญชี
-- ที่ถูก compromise ยังสามารถวนสร้างเอกสารแล้วยิงแจ้งเตือนซ้ำๆ ได้ไม่จำกัด
-- เสี่ยงโดนแบนโดเมนจาก Brevo/LINE OA policy นี้จำกัดเป็นราย-user ต่อชั่วโมง
-- แยกโควตา email/line กันคนละ bucket — ไม่กระทบ system/cron (caller.type='system'
-- ถูกข้ามใน checkNotifyRateLimit ฝั่ง Edge Function อยู่แล้ว)
-- ============================================================================

create table if not exists public.notification_rate_limits (
  caller_id uuid not null,
  kind text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (caller_id, kind, window_start)
);

comment on table public.notification_rate_limits is
  'ตัวนับ rate limit ของ send-email/send-line — เขียน/อ่านโดย service_role ผ่าน RPC เท่านั้น ไม่มี policy ให้ client เข้าถึงตรง';

alter table public.notification_rate_limits enable row level security;
-- ตั้งใจไม่สร้าง policy ใดๆ — RLS เปิดแต่ไม่มี policy = anon/authenticated เข้าไม่ได้เลย
-- service_role (ที่ Edge Function ใช้) bypass RLS อยู่แล้วตามปกติของ Supabase

create or replace function public.check_and_bump_notify_rate(
  p_caller uuid,
  p_kind text,
  p_limit integer,
  p_window_minutes integer default 60
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window timestamptz;
  v_count integer;
begin
  v_window := date_trunc('hour', now());

  insert into public.notification_rate_limits (caller_id, kind, window_start, count)
  values (p_caller, p_kind, v_window, 1)
  on conflict (caller_id, kind, window_start)
  do update set count = public.notification_rate_limits.count + 1
  returning count into v_count;

  return v_count <= p_limit;
end;
$$;

-- จำกัดเฉพาะ service_role (Edge Function) เรียกได้ — ไม่ grant ให้ authenticated/anon
grant execute on function public.check_and_bump_notify_rate(uuid, text, integer, integer) to service_role;

-- กันตารางโตไม่สิ้นสุด — ลบ bucket ที่เก่ากว่า 7 วันทิ้ง (เรียกเองเป็นครั้งคราวได้ ไม่บังคับ)
-- delete from public.notification_rate_limits where window_start < now() - interval '7 days';
