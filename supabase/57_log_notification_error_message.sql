-- 57_log_notification_error_message.sql  (2026-09-30)
--
-- เพิ่มพารามิเตอร์ p_error_message ให้ log_notification() — อีเมล/LINE ที่ส่งจากหน้าเว็บ
-- ส่งไม่สำเร็จแล้วบันทึกได้แค่ status='failed' โดยไม่มีสาเหตุ (notifications.error_message
-- ว่างทุกแถวที่มาจาก client; มีแต่แถวจาก check-overdue ที่เขียนเองด้วย service role)
-- ทำให้ไล่ไม่ได้ว่าล้มเพราะ Brevo ปฏิเสธที่อยู่, โควตา LINE หมด หรือเน็ตหลุด
--
-- เข้ากันได้ย้อนหลัง: พารามิเตอร์ใหม่มี DEFAULT NULL — หน้าเว็บเวอร์ชันเก่าที่ส่ง 8 ตัวยังเรียกได้
-- จึงรันก่อนหรือหลัง deploy หน้าเว็บก็ได้ (utils.js logNotifRow ส่ง p_error_message เฉพาะตอนมีค่า
-- และลองใหม่แบบไม่ส่งถ้า DB ยังไม่มีพารามิเตอร์นี้)
--
-- ต้อง DROP ก่อน เพราะเพิ่มพารามิเตอร์ = ฟังก์ชันใหม่ (overload) ถ้าปล่อยตัวเก่าไว้
-- PostgREST จะเจอสองตัวที่รับชื่อพารามิเตอร์ชุดเดียวกันแล้วตอบ ambiguous function
--
-- สิทธิ์ตามแบบ 55_harden_functions_and_storage.sql: ไม่ให้ anon/public, ปัก search_path

begin;

drop function if exists public.log_notification(uuid, uuid, text, text, text, text, text, timestamptz);

create function public.log_notification(
  p_document_id uuid,
  p_recipient_id uuid,
  p_recipient_email text,
  p_subject text,
  p_body text,
  p_notification_type text,
  p_status text,
  p_sent_at timestamptz default now(),
  p_error_message text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_uid uuid;
  v_id uuid;
begin
  select id into v_uid from public.current_profile();
  if v_uid is null then raise exception 'not authenticated'; end if;

  if p_document_id is not null
     and not public.can_log_notification(p_document_id, v_uid) then
    raise exception 'not allowed to log notification for this document';
  end if;

  insert into public.notifications (
    document_id, recipient_id, recipient_email,
    subject, body, notification_type, status, sent_at, error_message
  ) values (
    p_document_id, p_recipient_id, p_recipient_email,
    p_subject, p_body, p_notification_type, p_status, coalesce(p_sent_at, now()),
    left(nullif(p_error_message, ''), 1000)
  )
  returning id into v_id;

  return v_id;
end;
$function$;

revoke execute on function public.log_notification(uuid, uuid, text, text, text, text, text, timestamptz, text) from public, anon;
grant execute on function public.log_notification(uuid, uuid, text, text, text, text, text, timestamptz, text) to authenticated, service_role;

commit;

-- ให้ PostgREST รู้จักลายเซ็นใหม่ทันที
notify pgrst, 'reload schema';

-- ตรวจ: ควรเหลือฟังก์ชันเดียว มี 9 พารามิเตอร์ และ acl ไม่มี anon
-- select pg_get_function_identity_arguments(oid), proacl from pg_proc where proname = 'log_notification';
