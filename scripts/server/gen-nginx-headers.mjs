#!/usr/bin/env node
// สร้าง scripts/server/saeduflow-headers.conf (add_header สำหรับ nginx บนเซิร์ฟเวอร์คณะ)
// จาก vercel.json — ไฟล์นั้นเป็นแหล่งเดียวของ CSP/ส่วนหัวความปลอดภัย (server.js ก็อ่านจากที่เดียวกัน)
// เมื่อแก้ CSP ใน vercel.json ให้รันไฟล์นี้แล้ว install-nginx-headers.sh ใหม่ ไม่งั้นสองที่จะต่างกันเงียบ ๆ
//
//   node scripts/server/gen-nginx-headers.mjs        # เขียน scripts/server/saeduflow-headers.conf
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const vj = JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8'));
const rule = (vj.headers || []).find((r) => r.source === '/index.html') || (vj.headers || [])[0];
if (!rule) { console.error('vercel.json ไม่มี headers'); process.exit(1); }

// Cache-Control ของ vercel.json เป็น no-store สำหรับ index.html เท่านั้น — บน nginx ส่วนหัวชุดนี้ครอบทุกไฟล์
// จึงใช้ no-cache (ให้เบราว์เซอร์ถามเซิร์ฟเวอร์ก่อนใช้แคชทุกครั้ง — ETag ตอบ 304 ถูก ๆ) แทน:
// index.html ไม่ค้างเวอร์ชันเก่าอีก ส่วน js/css ยังพึ่ง ?v=N ตามเดิม
const lines = [
  '# SaEDU Flow — ส่วนหัวความปลอดภัย (สร้างโดย scripts/server/gen-nginx-headers.mjs จาก vercel.json — ห้ามแก้มือ)',
  '# include ไฟล์นี้ใน server {} ของ saeduflow.edu.chula.ac.th และใน location {} ทุกอันที่มี add_header ของตัวเอง',
  '# (nginx ไม่สืบทอด add_header จาก server เข้า location ที่มี add_header อยู่แล้ว — ลืม include ที่นั่น = ส่วนหัวหายเงียบ ๆ)',
];
for (const h of rule.headers) {
  if (h.key.toLowerCase() === 'cache-control') continue;
  lines.push(`add_header ${h.key} "${h.value.replace(/"/g, '\\"')}" always;`);
}
lines.push('add_header Cache-Control "no-cache" always;');
const out = join(root, 'scripts', 'server', 'saeduflow-headers.conf');
writeFileSync(out, lines.join('\n') + '\n');
console.log('เขียน', out, `(${rule.headers.length} ส่วนหัวจาก vercel.json)`);
