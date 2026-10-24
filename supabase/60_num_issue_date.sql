-- 60_num_issue_date.sql
-- กติกาวันที่ออกเลขหนังสือขาออก (เปลี่ยนจากกติกา "ช่วงเวลาส่งเอกสารของนิสิต" เดิม — 2026-10-24)
--
-- 1) ถอดกติกาเดิม: trigger documents_submit_window ที่ห้ามนิสิตส่งเอกสารนอกวันทำการ/หลัง 22:00 น.
--    (ถูกรันบนโปรดักชันไปแล้ว) — นิสิตสร้างและส่งเอกสารได้ทุกวันทุกเวลา
-- 2) กติกาใหม่: เลขหนังสือขาออกต้องลงวันที่เป็นวันทำการ (จ.–ศ. ไม่รวมวันหยุดตามปฏิทินนิสิตใน
--    app_settings.num_holidays) และออกได้ไม่เกิน num_cutoff_time (22:00) ตามเวลาไทย —
--    ออกหลังเวลานั้น เลข (ปี พ.ศ.) และวันที่หนังสือเป็นของวันทำการถัดไปอัตโนมัติ
--    วันเสาร์–อาทิตย์/วันหยุด: num_holiday_mode='block' (ค่าเริ่มต้น) ออกเลขไม่ได้ · 'shift' ออกได้แต่ลงวันทำการถัดไป
--
-- ตรรกะชุดเดียวกับ numIssueInfo() ใน utils.js — แก้กติกาต้องแก้ทั้งสองที่ และค่าเริ่มต้นต้องตรงกับ SETT.num_* ใน config.js
-- หน้าเว็บเรียก num_issue_info() เพื่อใช้เวลาเซิร์ฟเวอร์ ถ้ายังไม่ได้รันไฟล์นี้หน้าเว็บคำนวณจากเวลาเครื่องแทน
-- trigger ตรวจซ้ำตอนเอกสารขาออกเปลี่ยน numbering → completed ว่า doc_date และปีท้ายเลขตรงกับกติกา
-- (ผ่อนผัน 5 นาที เผื่อกดยืนยันตอน 21:59) — เครื่องมือซ่อมของ dev ที่แก้ doc_number โดยไม่เปลี่ยนสถานะไม่ถูกตรวจ
-- รันซ้ำได้ ส่วนที่ 1 รันได้ทันทีโดยไม่ต้องรอหน้าเว็บ ส่วนที่ 2 ควรรันพร้อม/หลัง deploy หน้าเว็บที่มี numIssueInfo()
--
-- ⚠️ 2026-10-24: ไฟล์นี้ถูกรันบนโปรดักชันก่อนอัปโหลดหน้าเว็บ — หน้าเว็บเดิม (docNum.js?v=30) ส่งวันที่ UTC
--    จึงถูก trigger ปฏิเสธช่วง 00:00–07:00 / หลัง 22:00 / เสาร์–อาทิตย์ จึงปิด trigger ไว้ชั่วคราว:
--      alter table public.documents disable trigger documents_num_issue_date;
--    หลังอัปโหลด dist/ ที่มี numIssueInfo() (docNum.js?v=34 ขึ้นไป) แล้ว ให้เปิดกลับ:
--      alter table public.documents enable trigger documents_num_issue_date;
--    (การรันไฟล์นี้ซ้ำทั้งไฟล์ก็สร้าง trigger ใหม่แบบเปิดอยู่เช่นกัน)

-- ═══ 1) ถอดกติกาเวลาส่งเอกสารของนิสิต ═══
drop trigger if exists documents_submit_window on public.documents;
drop function if exists public.enforce_submit_window();
drop function if exists public.submit_window_state(timestamptz);

-- ═══ 2) วันที่ออกเลขหนังสือขาออก ═══
create or replace function public.num_issue_info(p_at timestamptz default now())
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_local   timestamp := p_at at time zone 'Asia/Bangkok';
  v_today   date := (p_at at time zone 'Asia/Bangkok')::date;
  v_s       jsonb;
  v_on      boolean;
  v_wk      boolean;
  v_shift   boolean;
  v_cut     time;
  v_hol     text;
  v_off     text;
  v_late    boolean;
  v_next    date;
  v_d       date;
  i         int;
begin
  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) into v_s
    from public.app_settings where key like 'num\_%';

  v_on    := lower(coalesce(nullif(btrim(v_s->>'num_window_enabled'), ''), 'true')) not in ('false','0','no','off');
  v_wk    := lower(coalesce(nullif(btrim(v_s->>'num_weekdays_only'), ''), 'true')) not in ('false','0','no','off');
  v_shift := coalesce(v_s->>'num_holiday_mode', 'block') = 'shift';
  v_hol   := coalesce(v_s->>'num_holidays', '');
  begin v_cut := coalesce(nullif(btrim(v_s->>'num_cutoff_time'), ''), '22:00')::time;
  exception when others then v_cut := '22:00'; end;

  if not v_on then
    return jsonb_build_object('date', v_today, 'today', v_today, 'blocked', false, 'shifted', false,
                              'reason', null, 'server_now', p_at);
  end if;

  v_off := case
             when v_wk and extract(isodow from v_today) in (6, 7) then 'weekend'
             when position(to_char(v_today, 'YYYY-MM-DD') in v_hol) > 0 then 'holiday'
           end;
  v_late := v_cut <> '00:00'::time and v_local::time >= v_cut;

  if v_off is null and not v_late then
    return jsonb_build_object('date', v_today, 'today', v_today, 'blocked', false, 'shifted', false,
                              'reason', null, 'server_now', p_at);
  end if;

  for i in 1..60 loop
    v_d := v_today + i;
    if not (v_wk and extract(isodow from v_d) in (6, 7))
       and position(to_char(v_d, 'YYYY-MM-DD') in v_hol) = 0 then
      v_next := v_d; exit;
    end if;
  end loop;

  return jsonb_build_object(
    'date', v_next, 'today', v_today,
    'blocked', v_off is not null and not v_shift,
    'shifted', not (v_off is not null and not v_shift),
    'reason', coalesce(v_off, 'late'),
    'server_now', p_at);
end;
$$;

revoke execute on function public.num_issue_info(timestamptz) from public, anon;
grant  execute on function public.num_issue_info(timestamptz) to authenticated, service_role;

create or replace function public.enforce_num_issue_date()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_a jsonb := public.num_issue_info(now());
  v_b jsonb := public.num_issue_info(now() - interval '5 minutes');
  v_ok boolean;
begin
  if new.doc_type <> 'outgoing' or old.status is distinct from 'numbering' or new.status <> 'completed'
     or new.doc_number is not distinct from old.doc_number then
    return new;
  end if;

  v_ok := (not (v_a->>'blocked')::boolean and new.doc_date = (v_a->>'date')::date)
       or (not (v_b->>'blocked')::boolean and new.doc_date = (v_b->>'date')::date);
  if not coalesce(v_ok, false) then
    raise exception 'ออกเลขหนังสือไม่ได้: วันที่หนังสือต้องเป็นวันทำการตามกติกาการออกเลข (วันที่ที่ถูกต้องคือ %) — กรุณาเปิดหน้าออกเลขใหม่',
      coalesce(v_a->>'date', 'ยังไม่มี') using errcode = 'P0001';
  end if;
  if new.doc_number not like '%/' || (extract(year from new.doc_date)::int + 543)::text then
    raise exception 'ออกเลขหนังสือไม่ได้: ปีท้ายเลขหนังสือไม่ตรงกับวันที่หนังสือ' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke execute on function public.enforce_num_issue_date() from public, anon;

drop trigger if exists documents_num_issue_date on public.documents;
create trigger documents_num_issue_date
  before update of status, doc_number on public.documents
  for each row execute function public.enforce_num_issue_date();

-- ตรวจผล
select public.num_issue_info() as now_info;
select tgname from pg_trigger where tgname in ('documents_submit_window', 'documents_num_issue_date');
