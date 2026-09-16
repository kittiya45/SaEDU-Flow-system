#!/usr/bin/env node
/* เว็บเซิร์ฟเวอร์ static ขนาดเล็กสำหรับโฮสต์ที่ไม่ใช่ Vercel (เช่นโฟลเดอร์บนเครื่อง Amazon)
   ไม่ใช้ dependency ใด ๆ — รันได้ทันทีด้วย `node server.js` บน Node 18+

   ถูกคัดลอกเข้า dist/server.js โดย scripts/make-dist.mjs และเสิร์ฟทุกไฟล์ในโฟลเดอร์เดียวกับตัวมันเอง
   - port: env PORT (ค่าเริ่มต้น 3020)
   - `/` → index.html ; query string (?v=N ที่ index.html ใช้กัน cache) ถูกตัดทิ้งก่อนหาไฟล์
   - ถ้า nginx proxy มาโดยไม่ตัด prefix (เช่น /saeduflow/index.html) จะลอง strip ส่วนแรกของ path
     ให้อัตโนมัติเมื่อมันตรงกับชื่อโฟลเดอร์ หรือกำหนดเองผ่าน env BASE_PATH=/saeduflow
   - header (CSP ฯลฯ) อ่านจาก vercel.json ที่วางอยู่ข้าง ๆ ถ้ามี — ไฟล์นั้นเป็นแหล่งเดียวของ CSP
     ทั้งบน Vercel และที่นี่ จะได้ไม่ต้องแก้สองที่ ; ไม่มีไฟล์ก็เสิร์ฟต่อโดยไม่ใส่ header เหล่านั้น
   - index.html ส่ง no-cache เสมอ (ให้การ bump ?v=N มีผลทันที) ; ไฟล์อื่นแคชได้ 1 ชม.
*/
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = Number(process.env.PORT) || 3020;
const HOST = process.env.HOST || '0.0.0.0';
const BASE_PATH = String(process.env.BASE_PATH || '').replace(/\/+$/, '');
const DIR_NAME = path.basename(ROOT);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.mjs':  'text/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt':  'text/plain; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.webp': 'image/webp',
  '.otf':  'font/otf',
  '.ttf':  'font/ttf',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.pdf':  'application/pdf',
  '.map':  'application/json',
};

/* กฎ header จาก vercel.json — ใช้เฉพาะ source ที่เป็น path ตรง ๆ ('/' และ '/index.html') */
let HEADER_RULES = [];
try {
  const vj = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
  HEADER_RULES = (vj.headers || []).map(r => ({
    source: r.source,
    headers: (r.headers || []).map(h => [h.key, h.value]),
  }));
} catch (_) { /* ไม่มี vercel.json ก็ไม่เป็นไร */ }

function send(res, status, body, headers) {
  res.writeHead(status, Object.assign({ 'Content-Type': 'text/plain; charset=utf-8' }, headers || {}));
  res.end(body);
}

function cleanPath(rawUrl) {
  let p = decodeURIComponent((rawUrl || '/').split('?')[0].split('#')[0]);
  if (BASE_PATH && p.startsWith(BASE_PATH + '/')) p = p.slice(BASE_PATH.length);
  else if (BASE_PATH && p === BASE_PATH) p = '/';
  return p;
}

function resolveFile(urlPath) {
  const candidates = [urlPath];
  // nginx ที่ไม่ตัด prefix: /saeduflow/x.js → ลอง /x.js ด้วย
  const m = urlPath.match(/^\/([^/]+)(\/.*)?$/);
  if (m && m[1] === DIR_NAME) candidates.push(m[2] || '/');
  for (let p of candidates) {
    if (p === '/' || p === '') p = '/index.html';
    const abs = path.normalize(path.join(ROOT, p));
    if (!abs.startsWith(ROOT + path.sep) && abs !== ROOT) continue; // กัน ../ ออกนอกโฟลเดอร์
    let st;
    try { st = fs.statSync(abs); } catch (_) { continue; }
    if (st.isDirectory()) {
      const idx = path.join(abs, 'index.html');
      if (fs.existsSync(idx)) return { abs: idx, urlPath: (p.replace(/\/$/, '') + '/index.html') };
      continue;
    }
    if (st.isFile()) return { abs, urlPath: p };
  }
  return null;
}

const server = http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return send(res, 405, 'Method Not Allowed', { Allow: 'GET, HEAD' });
  }
  let urlPath;
  try { urlPath = cleanPath(req.url); } catch (_) { return send(res, 400, 'Bad Request'); }

  const hit = resolveFile(urlPath);
  if (!hit) return send(res, 404, 'Not Found');

  const ext = path.extname(hit.abs).toLowerCase();
  const headers = {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Cache-Control': ext === '.html' ? 'no-cache, no-store, must-revalidate' : 'public, max-age=3600',
    'X-Content-Type-Options': 'nosniff',
  };
  const isIndex = hit.urlPath === '/index.html';
  for (const rule of HEADER_RULES) {
    if (rule.source === hit.urlPath || (isIndex && rule.source === '/')) {
      for (const [k, v] of rule.headers) headers[k] = v;
    }
  }

  let st;
  try { st = fs.statSync(hit.abs); } catch (_) { return send(res, 404, 'Not Found'); }
  headers['Content-Length'] = st.size;
  res.writeHead(200, headers);
  if (req.method === 'HEAD') return res.end();
  const stream = fs.createReadStream(hit.abs);
  stream.on('error', () => { try { res.destroy(); } catch (_) {} });
  stream.pipe(res);
});

server.listen(PORT, HOST, () => {
  console.log(`SaEDU Flow static server: http://${HOST}:${PORT}/  (serving ${ROOT})`);
  if (BASE_PATH) console.log(`BASE_PATH = ${BASE_PATH}`);
  if (!HEADER_RULES.length) console.log('หมายเหตุ: ไม่พบ vercel.json — เสิร์ฟโดยไม่มี CSP/security headers');
});
