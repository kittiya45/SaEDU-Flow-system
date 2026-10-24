# บันทึกการเพิ่มความปลอดภัย — 24 ตุลาคม 2026

## เปิดใช้งานบน Supabase แล้ว

โปรเจกต์ `jrubupvzltxqstzcpoov`:

- รัน `supabase/61_security_access_guards.sql` แล้ว ป้องกันผู้ใช้แก้ role, auth_uid, สถานะอนุมัติ, วันหมดอายุ และฟิลด์ที่ไม่ใช่ข้อมูลส่วนตัวผ่าน API
- `current_profile`, `is_admin`, `is_dev` ตรวจ active + approved + วันหมดอายุ และมี restrictive RLS ปิดการเข้าถึงตารางงาน/Storage ของบัญชีที่ไม่ผ่านเงื่อนไข โดยคงกติกาสิทธิ์เดิมของแต่ละตาราง
- ซ่อน `app_settings.overdue_cron_secret` จาก anon/authenticated รวมถึงแอดมินที่เรียกผ่านเว็บ และหมุน secret ใหม่ทั้ง Edge Functions กับฐานข้อมูลแล้ว
- deploy `admin-create-user`, `admin-delete-user`, `admin-set-password`, `convert-docx`, `integration-status`, `message-quota`, `send-line`, `send-email` แล้ว: ตรวจสถานะบัญชีที่ฝั่งเซิร์ฟเวอร์ และ DEV reset รหัสผ่าน SYS ไม่ได้
- general API ไม่รับ cron secret เป็นสิทธิ์ system อีกต่อไป; `check-overdue` ตรวจ cron secret ของตัวเองตามเดิม
- คง gateway JWT เดิม: send-email=false (ตรวจ auth ภายใน), อีกเจ็ดฟังก์ชัน=true; webhook และ cron ไม่มีการเปลี่ยน gateway

ตรวจฐานจริงก่อนแก้: ทุก public table เปิด RLS, buckets documents/user-signatures เป็น private, ไม่มี storage policy anon ที่เปิดกว้างจากแพตช์เก่า และ users ยังไม่มี trigger ป้องกันฟิลด์สิทธิ์

## เตรียมในซอร์สและ dist แล้ว — ต้องนำขึ้นเว็บคณะ

- ปิด eval ในทุก PDF.js getDocument ตาม workaround ของผู้พัฒนา สำหรับ CVE-2024-4367 (ยังใช้ PDF.js 3.11.174 เดิม; การย้ายรุ่นใหญ่ควรทดสอบเครื่องมือเซ็น/ประทับ/แก้ PDF แยก)
- vendored DOMPurify 3.4.17 กรอง HTML ที่แปลงจาก DOCX ก่อนแสดงผล และ escape ข้อผิดพลาดที่แทรกเป็น HTML
- build ใช้รายชื่อ JavaScript และ vendor ที่ระบุชัดเจน จำกัดชนิดรูป/ฟอนต์ และปฏิเสธ symlink
- Node static server เสิร์ฟเฉพาะ `public-files.json` ปิดไฟล์ config/server/backup/dotfile และ symlink ไม่เริ่มเมื่อไม่มี manifest/CSP เพิ่ม timeout และ security headers ทุก response
- CSP เพิ่ม `base-uri 'none'`, upgrade-insecure-requests และ HSTS (ไม่มี includeSubDomains)
- CSP ยังต้องใช้ unsafe-inline เพราะแอปเดิมมี inline event handlers; ยังไม่ได้ย้าย handlers ทั้งระบบ

นำขึ้นโฮสต์:

1. `npm run build:dist` แล้วอัปโหลดไฟล์ใน `dist/` ให้ครบ รวม `vendor/purify.min.js` และ `public-files.json` **ไฟล์รุ่นเก่าที่ไม่ควรเปิดเผยต้องเอาออกจาก web root ด้วย**
2. Node host: ใช้ Node.js LTS ที่ยังได้รับการสนับสนุนและแพตช์ล่าสุด รันจาก dist/ เท่านั้น อย่าใช้ Node 18 ที่คำแนะนำเก่าเคยระบุ
3. nginx host: ติดตั้ง `scripts/server/saeduflow-headers.conf` ด้วยสคริปต์เดิม และ include `scripts/server/saeduflow-private-files.conf` หนึ่งครั้งใน HTTPS server {} (ไม่ใช่ใน location {}) ตรวจ location regex เดิมให้ deny rule อยู่ก่อน PHP/CGI handlers หรือเอา handlers ที่ไม่ใช้กับ static site ออก
4. `nginx -t` ต้องผ่านก่อน reload แล้วตรวจ headers และการเปิด PDF/DOCX/เซ็น/อัปโหลดจริง

ยังไม่มี SSH/SFTP user หรือ path ของเว็บคณะใน session นี้ จึงยังไม่ได้อัปโหลด frontend หรือเปลี่ยน nginx/OS/Node บนเครื่องจริง

## การทดสอบ

- `npm run build:dist`, syntax checks และ `git diff --check` ผ่าน
- `npm run test:security`: ทดสอบ file traversal, ไฟล์ลับ, symlink, HTTP methods/headers, account states, cron credential scope, ขอบเขต DEV/SYS ในการ reset รหัสผ่าน, DOCX XSS payload และ PDF entry points (รวม 6 tests ผ่าน); ต้องอนุญาต localhost/headless Chromium และใช้ Node ที่รองรับ stripTypeScriptTypes (ทดสอบด้วย Node 25.9.0 ในเครื่องพัฒนา)
- `tests/security/access-guards.sql`: รันเฉพาะฐานจำลองใหม่ ทดสอบ self-promotion, เปลี่ยน identity, ปลอม LINE, signature ของคนอื่น, pending/disabled/expired, disabled admin และรัน migration ซ้ำ
- ทดสอบฐานจริงใน transaction ที่ rollback: แก้ contact_email ค่าเดิมได้, self-promotion/แก้ฟิลด์ความปลอดภัยถูกปฏิเสธ, anon/authenticated อ่าน cron secret ไม่ได้
- `node scripts/security/verify-live.mjs`: ผ่าน 13 probes บนระบบจริง — 10 Edge Functions ปฏิเสธคนไม่ล็อกอินด้วย 401/403, users/cron secret/Storage ไม่คืนข้อมูลให้ anon โดยไม่พิมพ์ keys หรือข้อมูลตอบกลับ

นิยามฟังก์ชัน/RLS ก่อนแก้อยู่ `/tmp/saedu-security-preflight.json` และ SQL ย้อนแพตช์อยู่ `/tmp/saedu-security-rollback.sql` (ไฟล์ชั่วคราว) การดาวน์โหลดสำรอง Edge source ถูกปฏิเสธจึงไม่มีสำเนาซอร์สก่อน deploy ใน session นี้

## งานที่ต้องเจ้าของบัญชีหรือโฮสต์ดำเนินการต่อ

- เชื่อม SSH/SFTP สำหรับอัปโหลด frontend/ตั้ง nginx และตรวจ security updates ของ OS, nginx และ Node จริง
- เปิด MFA บน Supabase/GitHub/โฮสติ้งด้วยอุปกรณ์ของเจ้าของบัญชี; ยังไม่ได้บังคับ MFA ภายในแอปเพื่อป้องกันล็อกผู้ดูแลออกก่อนลงทะเบียน
- ระบบเคยมีไฟล์รายชื่อบัญชี/รหัสผ่านใน git history ตามบันทึก CLAUDE.md: ยืนยันว่าเปลี่ยนรหัสผ่านเหล่านั้นแล้ว การเพิ่มโค้ดป้องกันไม่ทำให้รหัสผ่านเก่าปลอดภัยขึ้น
- ตรวจ recovery ของ backup และบัญชีปลายทางจริง; งานนี้ไม่ได้ทดลอง restore production
- ~~ตรวจ obsolete Edge Functions~~ — ตรวจซอร์สและลบแล้ว 2026-10-24: `super-api` (ส่งอีเมลผ่าน Brevo ได้อิสระ), `super-endpoint`/`clever-task` (verify-login แบบ PBKDF2 เดิม ใช้ service role ตรวจ `password_hash` และคืนโปรไฟล์ เรียกได้ด้วย anon key), `super-function` (ไฟล์ helper ที่ deploy ผิด) — ไม่มีการเรียกใน log และไม่มีโค้ดอ้างถึง ยังเหลือ secret `CRON_SECRET` (เมษายน 2026) ที่ไม่มีโค้ดใช้ ให้เจ้าของบัญชีลบด้วย `npx supabase secrets unset CRON_SECRET`
- **trigger `documents_num_issue_date` ปิดชั่วคราว** (หน้าเว็บคณะยังเป็นรุ่นเก่า) — หลังอัปโหลด dist ให้รัน `alter table public.documents enable trigger documents_num_issue_date;`
- `guard_user_security_fields()` แก้ให้ GoTrue (`supabase_auth_admin`) เติม `auth_uid` ที่ว่างผ่าน `link_auth_user()` ได้ — เดิมการสมัคร/สร้างบัญชีด้วยอีเมลที่มีแถวโปรไฟล์อยู่แล้วจะล้มด้วย "Database error saving new user"
- Storage documents ยังใช้การแชร์ระหว่างสมาชิกที่ล็อกอินตามนโยบายเดิม ไม่ได้เปลี่ยนเป็นสิทธิ์รายเอกสาร; ต้องออกแบบสิทธิ์ผู้เซ็น/เจ้าหน้าที่/ไฟล์ที่ยังไม่ผูกเอกสารก่อนเปลี่ยน

อ้างอิง: [PDF.js advisory](https://github.com/mozilla/pdf.js/security/advisories/GHSA-wgrm-67xf-hhpq), [DOMPurify](https://github.com/cure53/DOMPurify), [PostgreSQL restrictive policies](https://www.postgresql.org/docs/current/sql-createpolicy.html)
