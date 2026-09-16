#!/usr/bin/env node
/* สร้างโฟลเดอร์ dist/ = ชุดไฟล์ที่พร้อมลากขึ้นโฮสต์ที่ไม่ใช่ Vercel (SFTP/FTP เข้าโฟลเดอร์บน server)

   ใช้: npm run build:dist   (รัน npm run build ก่อนเสมอ เพราะ styles.tailwind.css / dev-sql-bundle.js
                              เป็นไฟล์ที่สร้างจาก build — ไม่มีอยู่ใน git)

   หลักการคัดไฟล์: allowlist เท่านั้น — เอาเฉพาะสิ่งที่ index.html / JS โหลดตอนรัน
   ทุกอย่างที่ไม่อยู่ในรายการนี้ *ไม่ขึ้น* server โดยอัตโนมัติ (supabase/, scripts/, *.md, node_modules,
   ไฟล์ทดสอบ, และ .txt ทุกไฟล์ — img/t.txt เคยเป็นรายชื่อบัญชี/รหัสผ่าน)
   เพิ่มไฟล์ใหม่ที่แอปโหลดตอนรันแล้ว ให้มาเพิ่มที่ TOP_FILES / DIRS ด้วย */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');

/* ไฟล์ชั้นบนสุดที่ต้องไป — นอกเหนือจาก *.js ทุกไฟล์ (เก็บโดย glob ด้านล่าง) */
const TOP_FILES = [
  'index.html', 'manual.html', 'dev-manual.html',
  'styles.css', 'styles.tailwind.css',
  'vercel.json', // server.js อ่าน CSP/security headers จากไฟล์นี้ — ไม่มีความลับข้างใน
];
/* *.js ชั้นบนสุดที่ *ไม่ใช่* โค้ดแอป */
const SKIP_JS = new Set(['postcss.config.js']);
/* โฟลเดอร์ asset — คัดลอกทั้งโฟลเดอร์ ยกเว้น dotfile และ .txt */
const DIRS = ['img', 'font', 'vendor'];
const SKIP_EXT = new Set(['.txt', '.md']);

function fail(msg) { console.error('✖ ' + msg); process.exit(1); }

for (const f of ['styles.tailwind.css', 'dev-sql-bundle.js']) {
  if (!fs.existsSync(path.join(ROOT, f))) fail(`ไม่พบ ${f} — รัน npm run build ก่อน (หรือใช้ npm run build:dist)`);
}

let count = 0, bytes = 0;
const copied = [];
function copyFile(rel) {
  const src = path.join(ROOT, rel), dst = path.join(DIST, rel);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
  count++; bytes += fs.statSync(src).size; copied.push(rel);
}
function copyDir(rel) {
  for (const ent of fs.readdirSync(path.join(ROOT, rel), { withFileTypes: true })) {
    if (ent.name.startsWith('.') || ent.name === 'Icon\r') continue;
    const r = path.join(rel, ent.name);
    if (ent.isDirectory()) copyDir(r);
    else if (ent.isFile() && !SKIP_EXT.has(path.extname(ent.name).toLowerCase())) copyFile(r);
  }
}

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST);

for (const f of TOP_FILES) {
  if (!fs.existsSync(path.join(ROOT, f))) fail(`ไม่พบ ${f}`);
  copyFile(f);
}
for (const name of fs.readdirSync(ROOT)) {
  if (name.endsWith('.js') && !SKIP_JS.has(name) && fs.statSync(path.join(ROOT, name)).isFile()) copyFile(name);
}
for (const d of DIRS) {
  if (!fs.existsSync(path.join(ROOT, d))) fail(`ไม่พบโฟลเดอร์ ${d}/`);
  copyDir(d);
}

/* เซิร์ฟเวอร์สำรอง + package.json ให้ `npm start` / pm2 ใช้ได้ทันที */
fs.copyFileSync(path.join(ROOT, 'scripts', 'static-server.js'), path.join(DIST, 'server.js'));
fs.writeFileSync(path.join(DIST, 'package.json'), JSON.stringify({
  name: 'saeduflow',
  private: true,
  description: 'SaEDU Flow — static site (build output, see README.txt)',
  engines: { node: '>=18' },
  scripts: { start: 'node server.js' },
}, null, 2) + '\n');
fs.writeFileSync(path.join(DIST, 'README.txt'), `SaEDU Flow — ไฟล์เว็บพร้อมใช้ (สร้างเมื่อ ${new Date().toISOString()})

เว็บนี้เป็น static site (HTML/JS) ติดต่อฐานข้อมูล Supabase จาก browser โดยตรง
ไม่ต้องติดตั้ง dependency ใด ๆ บน server

วิธีเปิดใช้ (เลือกอย่างใดอย่างหนึ่ง)
  ก) ให้ web server (nginx/Apache) เสิร์ฟโฟลเดอร์นี้เป็นไฟล์ static — index.html คือหน้าแรก
  ข) รันด้วย Node 18+ :  node server.js        → เปิดที่ port 3020
     (เปลี่ยน port: PORT=8080 node server.js ; รันค้างไว้: pm2 start server.js --name saeduflow)
     ถ้า proxy มาใต้ path เช่น https://host/saeduflow/ ให้ตั้ง BASE_PATH=/saeduflow

vercel.json ในโฟลเดอร์นี้ไม่มีความลับ — server.js ใช้อ่าน security headers (CSP) เท่านั้น
`);

const mb = (bytes / 1048576).toFixed(1);
console.log(`✔ dist/ พร้อมแล้ว — ไฟล์แอป ${count} ไฟล์ (${mb} MB) + server.js, package.json, README.txt`);
console.log('  ' + copied.filter(f => !f.includes('/')).join(', '));
console.log('  ' + DIRS.map(d => d + '/ (' + copied.filter(f => f.startsWith(d + '/')).length + ')').join(', '));
