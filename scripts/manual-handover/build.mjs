#!/usr/bin/env node
/* build.mjs — ประกอบเอกสารส่งมอบระบบ SAEDU Flow เป็นชุด .docx และจัดโฟลเดอร์ผลผลิตส่งมอบ
   เนื้อหา: content.mjs · โครงสร้าง DB: schema.json · ภาพหน้าจอ: shots/manifest.json (จาก capture.mjs)
   ค่าคงที่อ้างอิง (ประเภทหนังสือ รหัสตำแหน่ง ชมรม รายการ SQL) อ่านจาก config.js / dev.js จริงผ่าน vm

   ผลลัพธ์
     manual-docx/SAEDU-Flow-คู่มือการใช้งานระบบ-ฉบับส่งมอบ.docx      เล่มรวม (ฟีเจอร์ + เทคนิคทั้งหมด)
     deliverables/                                                     ชุดผลผลิตตามข้อ 7 ของขอบเขตงาน
       00-รายการผลผลิตที่ส่งมอบ.docx
       02-SourceCode/  SAEDU-Flow-source-<วันที่>.zip + README-source.docx
       03-Database/    48_schema_dump.sql + migrations/ + โครงสร้างฐานข้อมูลและแนวทาง-Migration.docx
       04-Accounts/    บัญชีผู้ดูแลระบบและการจัดการบัญชีผู้ใช้.docx
       05-UserManual/  (build-user-manual.mjs + คู่มือย่อย 3 บทบาท)

   npm run build:handover        → จับภาพหน้าจอใหม่ทั้งหมด (capture.mjs ~2 นาที) แล้วสร้างทุกเอกสาร
   npm run build:handover:doc    → สร้างเอกสารจากภาพที่มีอยู่ใน shots/ (แก้เนื้อหาอย่างเดียว) */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as C from './content.mjs';
import { run, P, text, empty, labelLine, boldLine, table, codeBox, noteBox, calloutBox, makeCtx, makeFigure, packDocument, GRAY, HEAD_GRAY, PT, NBSP } from './style.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const args = Object.fromEntries(process.argv.slice(2).map(a => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const DOCX_DIR = path.resolve(ROOT, 'manual-docx');
const DELIV = path.resolve(ROOT, args.out || 'deliverables');
const STAMP = new Date().toISOString().slice(0, 10);
const thaiDate = d => { const M = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']; return `${d.getDate()} ${M[d.getMonth()]} ${d.getFullYear() + 543}`; };
const TODAY_TH = thaiDate(new Date());

/* ───────── ข้อมูลอ้างอิง ───────── */
const manifest = fs.existsSync(path.join(HERE, 'shots', 'manifest.json')) ? JSON.parse(fs.readFileSync(path.join(HERE, 'shots', 'manifest.json'), 'utf8')) : {};
const { figure, missing: missingShots } = makeFigure(manifest, path.join(HERE, 'shots'));
const schema = JSON.parse(fs.readFileSync(path.join(HERE, 'schema.json'), 'utf8'));
function loadAppConstants() {
  const w = { addEventListener() { }, location: { href: '' } };
  const ctx = { window: w, self: w, supabase: { createClient: () => ({ auth: {} }) }, document: { addEventListener() { }, getElementById() { return null; }, querySelector() { return null; } }, console: { log() { }, warn() { }, error() { } },
    localStorage: { getItem() { return null; }, setItem() { }, removeItem() { } }, sessionStorage: { getItem() { return null; }, setItem() { } }, fetch: () => Promise.resolve({ ok: false }), setTimeout, clearTimeout, navigator: { userAgent: '' }, MutationObserver: function () { return { observe() { } }; } };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'config.js'), 'utf8'), ctx);
  try { vm.runInContext(fs.readFileSync(path.join(ROOT, 'dev.js'), 'utf8'), ctx); } catch (e) { console.warn('dev.js constants unavailable:', e.message); }
  return ctx;
}
const K = loadAppConstants();
const gitHead = (() => { try { return execFileSync('git', ['log', '-1', '--format=%h %ad', '--date=short'], { cwd: ROOT }).toString().trim(); } catch (e) { return '-'; } })();

/* ───────── ส่วนเนื้อหา (แต่ละส่วนคืน array ของ paragraph/table) ───────── */
const S = {};
S.features = (c, opt) => {
  const out = [];
  out.push(c.heading(1, 'คำอธิบายฟีเจอร์ระบบ SAEDU Flow', opt), text(C.META.intro));
  out.push(c.heading(2, 'ภาพรวมสิทธิ์การใช้งาน'), table([['บทบาท', 'หน้าที่หลัก'], ...C.ROLES], { widths: [0.3, 0.7] }), noteBox(C.ROLE_NOTE));
  C.FEATURES.forEach((f, i) => {
    out.push(c.heading(2, `${i + 1} ${f.title}`), labelLine('ผู้ใช้งานหลัก', f.users), labelLine('วัตถุประสงค์', f.purpose), boldLine('ขั้นตอนการทำงานโดยสรุป'), c.bullets(f.steps), labelLine('ผลลัพธ์', f.result));
    if (f.note) out.push(noteBox(f.note));
    (f.shots || []).forEach((id, k) => out.push(figure(id, f.shots.length === 1 ? `ภาพระบบ${f.title}` : `ภาพระบบ${f.title} (${k + 1}/${f.shots.length}) — ${(manifest[id] || {}).cap || id}`)));
  });
  return out;
};
S.reference = c => [
  c.heading(1, 'ตารางอ้างอิง', { pageBreakBefore: true }),
  c.heading(2, 'สถานะเอกสาร'), table([['สถานะ', 'ความหมาย'], ...C.STATUSES], { widths: [0.38, 0.62] }),
  c.heading(2, 'รูปแบบเลขที่หนังสือ กนค. SPPTNNN-CC/BBBB'), table([['หลัก', 'ชื่อ', 'ที่มา'], ...C.NUMBER_FORMAT], { widths: [0.18, 0.24, 0.58] }),
  c.heading(2, 'ประเภทหนังสือขาออก กำหนดยื่นล่วงหน้า และสายขั้นตอน (หลักที่ 4 = ลำดับ)'),
  table([['รหัส', 'ประเภทหนังสือ', 'ต้องยื่นล่วงหน้า', 'สายขั้นตอน'], ...K.LETTER_TYPES.map((t, i) => [String(i + 1), t, K.LT_LEADTIME[t] || 'ไม่ระบุ', K.BUDGET_LTYPES.includes(t) ? '7 ขั้น (งบประมาณ)' : '4 ขั้น (ทั่วไป)'])], { widths: [0.08, 0.42, 0.32, 0.18] }),
  c.heading(2, 'สายขั้นตอนเริ่มต้นของหนังสือขาออก'),
  table([['สาย', 'ลำดับขั้น'], ['ทั่วไป (4 ขั้น)', ['ผู้จัดทำ'].concat(K.FLOW_STEPS_GENERAL.map(s => s.step_name)).join(' → ')], ['งบประมาณ (7 ขั้น)', ['ผู้จัดทำ'].concat(K.FLOW_STEPS_BUDGET.map(s => s.step_name)).join(' → ')]], { widths: [0.25, 0.75] }),
  c.heading(2, 'ประเภทจดหมายของหนังสือขาเข้า (หลักที่ 4)'), table([['รหัส', 'ประเภทจดหมาย'], ...K.OUT_LTYPES.slice(1).map((t, i) => [String(i + 1), t])], { widths: [0.15, 0.85] }),
  c.heading(2, 'รหัสตำแหน่งใน กนค. (หลักที่ 2–3 ของหนังสือขาเข้า / บทบาทเริ่มต้น)'),
  table([['รหัส', 'ตำแหน่ง', 'รหัสตำแหน่ง', 'บทบาทเริ่มต้น'], ...K.POSS.map(p => [K.GNK_NUM[p] || '—', K.PTH[p], p, K.RTH[K.PR[p]] || K.PR[p]])], { widths: [0.1, 0.42, 0.22, 0.26], size: 14 }),
  c.heading(2, 'ตำแหน่ง/สังกัดผู้ส่งของหนังสือขาออก (หลักที่ 2–3 และ 8–9)'), table([['รหัส', 'ตำแหน่ง / สังกัด', 'ชมรม'], ...K.SENDER_POS.map(p => [p.code, p.name, p.isClub ? 'ใช่' : ''])], { widths: [0.12, 0.7, 0.18], size: 14 }),
  c.heading(2, 'รหัสชมรมมาตรฐาน (หลักที่ 8–9)'), table([['รหัส', 'ชื่อชมรม'], ...Object.entries(K.CLUBS).map(([k, n]) => [k, n])], { widths: [0.15, 0.85], size: 14 }),
];
S.arch = (c, opt) => [
  c.heading(1, 'สถาปัตยกรรมระบบ', opt), text(C.ARCH.intro),
  c.heading(2, 'องค์ประกอบของระบบ'), table([['ส่วน', 'รายละเอียด', 'ที่อยู่/บริการ'], ...C.ARCH.components], { widths: [0.2, 0.55, 0.25] }),
  c.heading(2, 'ไฟล์หลักของส่วนหน้า'), table([['ไฟล์', 'หน้าที่'], ...C.ARCH.files], { widths: [0.38, 0.62], size: 14 }),
  c.heading(2, 'Edge Functions และค่าลับ (Secrets)'),
  table([['ฟังก์ชัน', 'ตรวจ JWT', 'หน้าที่'], ...schema.edge_functions.map(f => [f.name, f.verify_jwt ? 'ใช่' : 'ไม่ (ตรวจเองในโค้ด)', f.note])], { widths: [0.22, 0.18, 0.6], size: 14 }),
  text('ฟังก์ชันเก่าที่ยัง deploy อยู่แต่ไม่ถูกเรียกแล้ว (ปลอดภัยที่จะลบด้วย npx supabase functions delete): ' + schema.legacy_edge_functions.join(', '), { run: { color: GRAY, size: PT(14) } }),
  table([['ตัวแปร', 'ใช้โดย', 'คำอธิบาย'], ...C.SECRETS], { widths: [0.32, 0.22, 0.46], size: 14 }),
];
S.schema = (c, opt) => {
  const out = [c.heading(1, 'Database Schema', opt),
    text(`โครงสร้างฐานข้อมูล (PostgreSQL บน Supabase) — snapshot จากฐานข้อมูลจริงเมื่อ ${schema.snapshot_at} ทุกตารางเปิด Row Level Security และมีนโยบายกำหนดสิทธิ์รายคำสั่ง ไฟล์ supabase/48_schema_dump.sql คือคำสั่งสร้างโครงสร้างทั้งหมด (DDL) ที่รันซ้ำได้`, { run: { italics: true, color: GRAY } }),
    c.heading(2, '1. ภาพรวม'), text(`ฐานข้อมูลประกอบด้วย ${schema.tables.length} ตาราง 1 มุมมอง (view) ${schema.functions.length} ฟังก์ชัน และ Storage 2 bucket ดังตารางด้านล่าง`),
    table([['ตาราง', 'จำนวนฟิลด์', 'RLS / นโยบาย', 'หมายเหตุ'], ...schema.tables.map(t => [t.name, String(t.columns.length), (t.rls ? 'เปิด' : 'ปิด') + ' / ' + t.policies, t.desc])], { widths: [0.24, 0.12, 0.14, 0.5], size: 14 }),
    c.heading(2, '2. รายละเอียดโครงสร้างแต่ละตาราง')];
  schema.tables.forEach(t => out.push(c.heading(3, t.name), text(t.desc, { run: { color: GRAY, size: PT(14) } }),
    table([['ฟิลด์ (Field)', 'ชนิดข้อมูล (Type)', 'จำเป็น', 'ค่าเริ่มต้น', 'หมายเหตุ'], ...t.columns.map(col => [col[0], col[1], col[2] ? 'ใช่' : '-', col[3] == null ? '-' : String(col[3]).replace(/::text$/, ''), col[4] || '-'])], { widths: [0.24, 0.16, 0.08, 0.16, 0.36], size: 13, headFill: HEAD_GRAY })));
  out.push(c.heading(2, '3. มุมมอง (View)'), ...schema.views.map(v => labelLine(v.name, v.desc)),
    c.heading(2, '4. ความสัมพันธ์ระหว่างตาราง (Foreign Keys)'), table([['จาก (ตาราง.ฟิลด์)', 'ไปยัง', 'เมื่อลบต้นทาง'], ...schema.fks.map(f => [f[0], f[1], f[2] || 'ห้ามลบ (RESTRICT)'])], { widths: [0.42, 0.3, 0.28], size: 14, headFill: HEAD_GRAY }),
    c.heading(2, '5. ฟังก์ชันและ RPC'), table([['ฟังก์ชัน', 'คืนค่า', 'security definer', 'หน้าที่'], ...schema.functions.map(f => [f[0], f[1], f[2] ? 'ใช่' : '-', f[3]])], { widths: [0.36, 0.12, 0.12, 0.4], size: 13, headFill: HEAD_GRAY }),
    c.heading(2, '6. นโยบาย Row Level Security'),
    text('หลักการ: users ให้แต่ละคนเห็น/แก้แถวของตนเอง ผู้ดูแล (is_admin = ROLE-SYS/ROLE-STF) เห็นทั้งหมด · ตารางเอกสารให้ผู้ที่เข้าสู่ระบบอ่านได้ทั้งหมด แต่เขียนได้เฉพาะผู้เกี่ยวข้อง (ผู้จัดทำ ผู้รับผิดชอบขั้น ผู้รับส่งต่อ) · notifications อ่านได้เฉพาะผู้รับ · document_history และ notifications ไม่มีนโยบาย UPDATE/DELETE · นักพัฒนา (is_dev) มีนโยบายชุด *_dev แยกต่างหาก'),
    table([['ตาราง', 'นโยบาย'], ...Object.entries(schema.policies).map(([t, p]) => [t, p.length ? p.join(', ') : '(ไม่มี — เข้าถึงผ่าน RPC/service_role เท่านั้น)'])], { widths: [0.28, 0.72], size: 13, headFill: HEAD_GRAY }),
    c.heading(2, '7. Storage และส่วนขยาย'), table([['Bucket', 'สาธารณะ', 'จำกัดขนาด', 'ใช้เก็บ'], ...schema.buckets.map(b => [b.id, b.public ? 'ใช่' : 'ไม่', b.file_size_limit ? (b.file_size_limit / 1048576) + ' MB' : '-', b.note])], { widths: [0.22, 0.14, 0.16, 0.48], size: 14, headFill: HEAD_GRAY }),
    text('ส่วนขยาย PostgreSQL ที่เปิดใช้: ' + schema.extensions.join(', ')));
  return out;
};
S.migration = (c, opt) => [
  c.heading(1, 'แนวทางการปรับปรุงโครงสร้างฐานข้อมูล (Migration)', opt), text(C.MIGRATION.intro),
  c.heading(2, 'กติกาในการรันและเพิ่มสคริปต์'), c.bullets(C.MIGRATION.rules),
  c.heading(2, 'ขั้นตอนเมื่อต้องเพิ่ม migration ใหม่'), c.bullets(C.MIGRATION.howToAdd, 'decimal'),
  c.heading(2, 'รายการสคริปต์ทั้งหมดใน supabase/'), table([['ไฟล์', 'ชนิด', 'สิ่งที่ทำ'], ...C.MIGRATION.files], { widths: [0.34, 0.16, 0.5], size: 13 }),
  ...(K.DEV_MIGRATIONS ? [c.heading(2, 'ลำดับที่แผงนักพัฒนาใช้ตรวจสุขภาพระบบ (ชุดขั้นต่ำสำหรับติดตั้งใหม่)'), table([['ลำดับ', 'ไฟล์', 'สิ่งที่สร้าง'], ...K.DEV_MIGRATIONS.map(m => [String(m.order), m.file, m.title + (m.desc ? ' — ' + m.desc : '')])], { widths: [0.1, 0.36, 0.54], size: 13 })] : []),
  c.heading(2, 'ติดตั้งใหม่ทั้งหมดด้วย DDL รวม'), codeBox('-- ใน Supabase SQL Editor ของโปรเจกต์ใหม่\n-- 1) วางเนื้อหา 48_schema_dump.sql แล้ว Run (โครงสร้าง + ฟังก์ชัน + RLS ครบ)\n-- 2) รัน 29_cron_overdue.sql เมื่อ deploy check-overdue และตั้ง secret แล้ว\n-- 3) ตั้งค่า schema_version\ninsert into app_settings(key, value, value_type, label) values (\'schema_version\', \'' + (K.REQUIRED_SCHEMA_VERSION || '3') + '\', \'text\', \'schema version\')\non conflict (key) do update set value = excluded.value;'),
];
S.backup = (c, opt) => [
  c.heading(1, 'การสำรองข้อมูล กู้คืน และคลังเอกสาร', opt), text(C.BACKUP.intro),
  c.heading(2, 'งานอัตโนมัติบนเครื่องผู้ดูแล (launchd)'), table([['งาน', 'กำหนดเวลา', 'สิ่งที่ทำ'], ...C.BACKUP.auto], { widths: [0.28, 0.16, 0.56], size: 14 }),
  text('ติดตั้ง / ตรวจสถานะ / สั่งรันทันที:'), codeBox(C.BACKUP.installCmd),
  c.heading(2, 'สำรองข้อมูลด้วยมือ'), codeBox(C.BACKUP.manualCmd),
  c.heading(2, 'การกู้คืน (Restore)'), c.bullets(C.BACKUP.restoreSteps, 'decimal'),
  c.heading(2, 'ดึงไฟล์คืนจากคลังเอกสาร'), text('ใช้เมื่อเอกสารที่จบแล้วต้องกลับมาลงนามหรือรับทราบอีก (ไฟล์ถูกย้ายไปคลังแล้วจึงลงนามบนไฟล์ไม่ได้)'), codeBox(C.BACKUP.restoreArchive),
  c.heading(2, 'ข้อควรระวัง'), c.bullets(C.BACKUP.notes),
];
S.export = (c, opt) => [c.heading(1, 'คู่มือการดึงข้อมูลจากฐานข้อมูล', opt), text(C.EXPORT.intro), table([['วิธี', 'รายละเอียด'], ...C.EXPORT.ways], { widths: [0.3, 0.7] }), c.heading(2, 'ตัวอย่างคำสั่ง SQL (Supabase → SQL Editor)'), codeBox(C.EXPORT.sqlExamples)];
S.install = (c, opt) => [
  c.heading(1, 'คู่มือการติดตั้งและตั้งค่าเบื้องต้น', opt),
  c.heading(2, 'ความต้องการของระบบก่อนติดตั้ง'), c.bullets(C.INSTALL.requirements),
  c.heading(2, 'ขั้นตอนที่ 1 เตรียมซอร์สโค้ดและ build'), codeBox(C.INSTALL.buildCmds),
  c.heading(2, 'ขั้นตอนที่ 2 ตั้งค่าฐานข้อมูล Supabase'), c.bullets(C.INSTALL.dbSteps, 'decimal'),
  c.heading(2, 'ขั้นตอนที่ 3 Deploy Edge Functions และตั้งค่า Secrets'), codeBox(C.INSTALL.fnCmds),
  c.heading(2, 'ขั้นตอนที่ 4 ตั้งค่าส่วนหน้าและบริการเสริม'), c.bullets(C.INSTALL.frontendSteps, 'decimal'),
  c.heading(2, 'ขั้นตอนที่ 5 Deploy'), labelLine('แบบเซิร์ฟเวอร์ของคณะ (ที่ใช้อยู่ — https://saeduflow.edu.chula.ac.th)', ''), codeBox(C.INSTALL.deployServer), codeBox(C.INSTALL.nginx), labelLine('แบบ Vercel (สำเนาสำรอง)', C.INSTALL.deployVercel), labelLine('แบบรัน Node เอง', ''), codeBox(C.INSTALL.deployStatic), noteBox(C.INSTALL.deployNote), noteBox(C.INSTALL.cacheNote),
];
S.accounts = (c, opt) => [
  c.heading(1, 'คู่มือการจัดการบัญชีผู้ใช้', opt), text(C.ACCOUNTS.intro), codeBox(C.ACCOUNTS.firstAdmin),
  c.heading(2, 'งานประจำของผู้ดูแล'), table([['งาน', 'วิธีทำ'], ...C.ACCOUNTS.tasks], { widths: [0.28, 0.72] }), figure('adm', 'ภาพระบบการจัดการบัญชีผู้ใช้'),
];
S.systemInfo = (c, opt) => [
  c.heading(1, 'ข้อมูลระบบที่ส่งมอบ', opt),
  table([['รายการ', 'ค่า'], ['ชื่อระบบ', C.SYSTEM.name], ['ขอบเขต', C.SYSTEM.scope], ['URL ระบบ (โดเมนของคณะ)', C.SYSTEM.url], ['URL สำเนาบน Vercel', C.SYSTEM.urlVercel], ['Repository', C.SYSTEM.repo], ['ซอร์สโค้ดรุ่นที่ส่งมอบ', 'commit ' + gitHead + ' (พร้อมการแก้ไขในชุดส่งมอบ ' + STAMP + ')'], ['วันที่จัดทำเอกสาร', TODAY_TH]], { widths: [0.3, 0.7] }),
  c.heading(2, 'สภาพแวดล้อมและบริการที่ใช้'), table([['ส่วน', 'บริการ', 'ที่อยู่/หมายเหตุ'], ...C.SYSTEM.hosting], { widths: [0.26, 0.42, 0.32], size: 14 }),
  c.heading(2, 'ขอบเขตฟีเจอร์ Phase 1 ที่พร้อมใช้งาน'), c.bullets(C.SYSTEM.phase1),
  c.heading(2, 'รายการตรวจรับ (Acceptance Checklist)'), table([['ข้อ', 'สิ่งที่ตรวจ', 'วิธี/หมายเหตุ', 'ผล'], ...C.SYSTEM.verify.map((v, i) => [String(i + 1), v[0], v[1], '☐'])], { widths: [0.06, 0.46, 0.4, 0.08], size: 14, center: [0, 3] }),
];
S.deliverables = c => [
  c.heading(1, 'รายการผลผลิตที่ส่งมอบ'),
  text('ตามข้อ 7 ของขอบเขตงาน ผู้พัฒนาส่งมอบผลผลิตดังต่อไปนี้ เพื่อให้ใช้งานระบบได้จริงและรองรับการบำรุงรักษา/ส่งต่องานในอนาคต ไฟล์ทั้งหมดอยู่ในโฟลเดอร์ชุดส่งมอบตามชื่อที่ระบุ'),
  table([['ข้อ', 'ผลผลิต', 'ไฟล์ / ที่อยู่'], ...C.DELIVERABLES.map(d => [String(d.n), d.name, d.files.map((f, i) => run((i ? '\n' : '') + '• ' + f, { size: PT(14) }))])], { widths: [0.06, 0.4, 0.54], center: [0] }),
  text('เอกสารเพิ่มเติม: ' + C.DELIVERABLES_EXTRA.join(' · '), { run: { color: GRAY, size: PT(14) } }),
];
S.signoff = c => [
  c.heading(2, 'การลงนามส่งมอบ–รับมอบ'),
  table([['', 'ผู้ส่งมอบ (ผู้พัฒนา)', 'ผู้รับมอบ (คณะ/ผู้ดูแลระบบ)'], ['ลงชื่อ', '\n\n………………………………………', '\n\n………………………………………'], ['ชื่อ-นามสกุล', '(………………………………………)', '(………………………………………)'], ['ตำแหน่ง', '', ''], ['วันที่', '……… / ……… / ………', '……… / ……… / ………']], { widths: [0.2, 0.4, 0.4], center: [1, 2] }),
];
S.source = (c, opt) => [
  c.heading(1, 'เอกสารประกอบซอร์สโค้ด', opt), text(C.SOURCE.intro),
  c.heading(2, 'โครงสร้างโฟลเดอร์'), table([['ไฟล์ / โฟลเดอร์', 'หน้าที่'], ...C.SOURCE.tree], { widths: [0.36, 0.64], size: 14 }),
  c.heading(2, 'สิ่งที่ไม่รวมในชุดซอร์สโค้ด'), c.bullets(C.SOURCE.excluded),
  c.heading(2, 'แนวปฏิบัติสำคัญของโค้ด'), c.bullets(C.SOURCE.conventions),
];
S.adminBootstrap = (c, opt) => [
  c.heading(1, 'บัญชีผู้ดูแลระบบเริ่มต้น', opt), text(C.ADMIN_BOOTSTRAP.intro),
  table(C.ADMIN_BOOTSTRAP.credentialsTable, { widths: [0.32, 0.68] }),
  c.heading(2, 'วิธีสร้างบัญชีผู้ดูแลระบบใหม่'), c.bullets(C.ADMIN_BOOTSTRAP.steps, 'decimal'), codeBox(C.ACCOUNTS.firstAdmin),
  figure('register', 'ภาพระบบหน้าต่างสมัครสมาชิก'), figure('login', 'ภาพระบบหน้าเข้าสู่ระบบ'),
  c.heading(1, 'แนวทางการจัดการบัญชีผู้ใช้', { pageBreakBefore: true }),
  c.heading(2, 'บทบาทและสิทธิ์'), table([['บทบาท', 'สิทธิ์', 'ได้มาอย่างไร'], ...C.ADMIN_BOOTSTRAP.roleModel], { widths: [0.26, 0.46, 0.28], size: 14 }), noteBox(C.ROLE_NOTE),
  c.heading(2, 'วงจรชีวิตของบัญชี'), table([['ขั้น', 'รายละเอียด', 'ค่าในฐานข้อมูล'], ...C.ADMIN_BOOTSTRAP.lifecycle], { widths: [0.16, 0.58, 0.26], size: 14 }),
  c.heading(2, 'งานประจำของผู้ดูแล'), table([['งาน', 'วิธีทำ'], ...C.ACCOUNTS.tasks], { widths: [0.28, 0.72] }),
  figure('adm', 'ภาพระบบหน้าจัดการผู้ใช้'), figure('adm_edit', 'ภาพระบบหน้าต่างแก้ไขผู้ใช้'), figure('import', 'ภาพระบบการนำเข้าผู้ใช้ด้วย CSV'),
  c.heading(2, 'ความปลอดภัยของบัญชี'), c.bullets(C.ADMIN_BOOTSTRAP.security),
];

/* ───────── ประกอบเป็นเอกสาร ───────── */
const SUB = C.META.subtitle;
async function makeDoc(file, title, sections, extra) {
  const c = makeCtx();
  const body = [];
  sections.forEach((fn, i) => body.push(...fn(c, i ? { pageBreakBefore: true } : {}).flat(Infinity)));
  const r = await packDocument(Object.assign({ title, subtitle: SUB, edition: 'ฉบับส่งมอบ · ' + TODAY_TH, body, toc: c.toc, outPath: file }, extra || {}));
  console.log('✓ ' + path.relative(ROOT, file) + '  (' + (r.bytes / 1048576).toFixed(1) + ' MB)');
}
const D = (...p) => path.join(DELIV, ...p);

await makeDoc(path.join(DOCX_DIR, 'SAEDU-Flow-คู่มือการใช้งานระบบ-ฉบับส่งมอบ.docx'), C.META.title,
  [S.features, S.reference, S.arch, S.schema, S.migration, S.backup, S.export, S.install, S.accounts]);

await makeDoc(D('00-รายการผลผลิตที่ส่งมอบ.docx'), 'เอกสารส่งมอบระบบ SAEDU Flow',
  [c => [...S.deliverables(c), ...S.signoff(c)], S.systemInfo]);
await makeDoc(D('02-SourceCode', 'README-source.docx'), 'ซอร์สโค้ดระบบ SAEDU Flow', [S.source, S.arch, S.install]);
await makeDoc(D('03-Database', 'โครงสร้างฐานข้อมูลและแนวทาง-Migration.docx'), 'โครงสร้างฐานข้อมูลและแนวทาง Migration', [S.schema, S.migration, S.backup, S.export]);
await makeDoc(D('04-Accounts', 'บัญชีผู้ดูแลระบบและการจัดการบัญชีผู้ใช้.docx'), 'บัญชีผู้ดูแลระบบและการจัดการบัญชีผู้ใช้', [S.adminBootstrap]);

/* ───────── จัดไฟล์ประกอบในชุดส่งมอบ ───────── */
fs.mkdirSync(D('03-Database', 'migrations'), { recursive: true });
fs.copyFileSync(path.join(ROOT, 'supabase', '48_schema_dump.sql'), D('03-Database', '48_schema_dump.sql'));
for (const f of fs.readdirSync(path.join(ROOT, 'supabase'))) if (/\.(sql|mjs|sh)$/.test(f)) fs.copyFileSync(path.join(ROOT, 'supabase', f), D('03-Database', 'migrations', f));
fs.mkdirSync(D('05-UserManual'), { recursive: true }); // เนื้อหาเขียนโดย build-user-manual.mjs
for (const f of fs.readdirSync(D('05-UserManual'))) if (/^SAEDU-Flow-คู่มือ-.*\.docx$/.test(f)) fs.unlinkSync(D('05-UserManual', f)); // ฉบับย่อแบบเก่า (ไม่มีภาพ) ไม่อยู่ในชุดส่งมอบแล้ว
fs.copyFileSync(path.join(DOCX_DIR, 'SAEDU-Flow-คู่มือการใช้งานระบบ-ฉบับส่งมอบ.docx'), D('SAEDU-Flow-คู่มือการใช้งานระบบ-ฉบับส่งมอบ.docx'));

// ซอร์สโค้ด: zip เฉพาะไฟล์ที่ git ติดตาม/ไม่ถูก ignore (ไม่รวม node_modules, ค่าลับ, ผลลัพธ์, ชุดสำรองข้อมูล และ img/t.txt)
if (!args['no-zip']) {
  fs.mkdirSync(D('02-SourceCode'), { recursive: true });
  const zip = D('02-SourceCode', `SAEDU-Flow-source-${STAMP}.zip`);
  if (fs.existsSync(zip)) fs.unlinkSync(zip);
  const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: ROOT }).toString().split('\0')
    .filter(f => f && fs.existsSync(path.join(ROOT, f)) && !/^(img\/t\.txt|l-staff\.png|.*\.DS_Store|styles\.tailwind\.css|deliverables\/.*|manual-docx\/.*)$/.test(f) && !/(^|\/)(backup-|saedu-backup|\.env)/.test(f));
  const listFile = path.join(HERE, 'shots', '.zip-list.txt'); fs.mkdirSync(path.dirname(listFile), { recursive: true }); fs.writeFileSync(listFile, files.join('\n') + '\n');
  execFileSync('zip', ['-q', zip, '-@'], { cwd: ROOT, input: files.join('\n') + '\n' });
  fs.unlinkSync(listFile);
  console.log('✓ ' + path.relative(ROOT, zip) + '  (' + (fs.statSync(zip).size / 1048576).toFixed(1) + ' MB, ' + files.length + ' ไฟล์)');
}
console.log(`ชุดส่งมอบอยู่ที่ ${path.relative(ROOT, DELIV)}/${missingShots.length ? '  ⚠ ภาพที่ยังไม่มี: ' + [...new Set(missingShots)].join(', ') : ''}`);
