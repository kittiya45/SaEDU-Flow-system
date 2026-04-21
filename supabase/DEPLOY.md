# คู่มือ Deploy — Supabase Dashboard

ทำตามลำดับ 3 ขั้นตอนนี้ครั้งเดียว ไม่ต้องติดตั้งอะไรเพิ่ม

---

## ขั้นตอนที่ 1 — รัน SQL Migrations

ไปที่ **Supabase Dashboard → Project `jrubupvzltxqstzcpoov` → SQL Editor**

### 1a. สร้างตาราง notifications
คัดลอกเนื้อหาจาก [`migrations/001_create_notifications.sql`](migrations/001_create_notifications.sql) วางใน SQL Editor แล้วกด **Run**

### 1b. เปิด RLS ทุกตาราง
คัดลอกเนื้อหาจาก [`migrations/002_enable_rls.sql`](migrations/002_enable_rls.sql) วางใน SQL Editor แล้วกด **Run**

ผลที่ได้:
- ✅ `document_history` — ลบ/แก้ไม่ได้แม้รู้ API key
- ✅ `notifications` — ลบไม่ได้
- ✅ Storage `documents` bucket จำกัดขนาดและประเภทไฟล์

---

## ขั้นตอนที่ 2 — Deploy Edge Function (send-email)

ไปที่ **Supabase Dashboard → Edge Functions → Deploy a new function**

1. ตั้งชื่อ function: `send-email`
2. คัดลอกเนื้อหาจาก [`functions/send-email/index.ts`](functions/send-email/index.ts) วางใน editor
3. กด **Deploy**

### ตั้งค่า Secrets
ไปที่ **Project Settings → Edge Functions → Secrets** แล้วเพิ่ม:

| Key | Value |
|-----|-------|
| `BREVO_API_KEY` | API key จาก app.brevo.com → SMTP & API → API Keys |
| `FROM_EMAIL` | อีเมลที่ verify ใน Brevo (เช่น `noreply@yourdomain.com`) |
| `FROM_NAME` | `SAEDU Flow` |

> **หมายเหตุ Brevo Free:** ถ้ายังไม่ได้ verify domain จะส่งได้เฉพาะ email ที่ลงทะเบียนกับ Brevo  
> หลัง verify domain → ส่งได้ทุก address (300 อีเมล/วัน ฟรี)

### ทดสอบ Edge Function
ไปที่ **Edge Functions → send-email → Test** แล้วใส่ body:

```json
{
  "to": "your-email@example.com",
  "subject": "ทดสอบ SAEDU Flow",
  "html": "<h1>ทดสอบส่งอีเมล</h1><p>Edge Function ทำงานปกติ</p>"
}
```

กด **Send Test** — ถ้าได้รับอีเมลคือสำเร็จ ✅

---

## ขั้นตอนที่ 3 — ตรวจสอบ RLS

ไปที่ **Table Editor → document_history** แล้วลองกด Delete แถวใดก็ได้  
ต้องขึ้น error: `new row violates row-level security policy` ✅

---

## สิ่งที่ยังต้องทำในอนาคต (ระดับสูงขึ้น)

ปัจจุบัน RLS ป้องกันการลบ log แต่ยังไม่มี **per-user row isolation**  
(ใครรู้ anon key ยังอ่านข้อมูลทุกคนได้)

การแก้แบบสมบูรณ์ต้องเพิ่ม:
1. **Migration 003** — `verify-password` Edge Function รับ username+password แล้วคืน user object (แทนการให้ client query `users` table โดยตรง)
2. จากนั้น RLS จะสามารถบล็อก SELECT บน `users.password_hash` ได้อย่างปลอดภัย
