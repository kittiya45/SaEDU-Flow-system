-- ═══════════════════════════════════════════════════════════════════
-- 18_create_announcements.sql — บอร์ดประกาศหน้า Home (แดชบอร์ด)
--
-- รันในหน้า SQL Editor ของ Supabase Dashboard — idempotent รันซ้ำได้
--
-- ตาราง announcements: ประกาศหลายรายการ มีหัวข้อ/เนื้อหา/ระดับ/ปักหมุด/เปิด-ปิด
-- แสดงเป็นการ์ด "ประกาศ" บนหน้าภาพรวมของทุกคนที่ล็อกอิน (homeViews.js)
-- จัดการ (โพสต์/แก้/ปักหมุด/ปิด/ลบ) ได้ที่แท็บ "ตั้งค่าระบบ" — ทั้งแอดมิน (จัดการระบบ)
-- และนักพัฒนา (Dev Panel → จัดการระบบ)
--
-- อ่าน: ทุกคนที่ล็อกอิน | เขียน/ลบ: is_admin() หรือ is_dev()
-- (is_dev() มาจาก 17_create_dev_role.sql — ต้องรันไฟล์นั้นก่อนไฟล์นี้)
-- created_by อ้าง users แบบ on delete set null — ลบผู้ใช้ไม่ต้อง unlink ประกาศก่อน
-- ═══════════════════════════════════════════════════════════════════

create table if not exists public.announcements (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  body       text,
  level      text not null default 'info',   -- info | warning | error
  pinned     boolean not null default false, -- ปักหมุดขึ้นบนสุด
  is_active  boolean not null default true,  -- ปิด = ซ่อนจากหน้า Home แต่ยังอยู่ในหน้าจัดการ
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create index if not exists idx_announcements_home
  on public.announcements (is_active, pinned desc, created_at desc);

alter table public.announcements enable row level security;

drop policy if exists announcements_select on public.announcements;
create policy announcements_select on public.announcements
  for select using (auth.uid() is not null);

drop policy if exists announcements_write on public.announcements;
create policy announcements_write on public.announcements
  for all using (public.is_admin() or public.is_dev())
  with check (public.is_admin() or public.is_dev());
