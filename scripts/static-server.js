#!/usr/bin/env node
/* เว็บเซิร์ฟเวอร์ static ขนาดเล็กสำหรับโฮสต์ที่ไม่ใช่ Vercel (เช่นโฟลเดอร์บนเครื่อง Amazon)
   ไม่ใช้ dependency ใด ๆ — รันได้ทันทีด้วย `node server.js` บน Node.js รุ่น LTS ที่ยังได้รับ security updates

   ถูกคัดลอกเข้า dist/server.js และเสิร์ฟเฉพาะไฟล์ที่ระบุใน public-files.json
   - port: env PORT (ค่าเริ่มต้น 3020)
   - `/` → index.html ; query string (?v=N ที่ index.html ใช้กัน cache) ถูกตัดทิ้งก่อนหาไฟล์
   - ถ้า nginx proxy มาโดยไม่ตัด prefix (เช่น /saeduflow/index.html) จะลอง strip ส่วนแรกของ path
     ให้อัตโนมัติเมื่อมันตรงกับชื่อโฟลเดอร์ หรือกำหนดเองผ่าน env BASE_PATH=/saeduflow
   - header (CSP ฯลฯ) อ่านจาก vercel.json ที่วางอยู่ข้าง ๆ ถ้ามี — ไฟล์นั้นเป็นแหล่งเดียวของ CSP
     ทั้งบน Vercel และที่นี่; ถ้าไม่มี manifest หรือ security headers จะไม่เริ่มเซิร์ฟเวอร์
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
// Only build output may be served, even if an operator copies extra files here.
const MANIFEST_PATH = path.join(ROOT, 'public-files.json');
let PUBLIC_FILES;
try {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  if (!Array.isArray(manifest) || !manifest.includes('index.html')) throw new Error('invalid manifest');
  PUBLIC_FILES = new Set(manifest);
} catch (_) {
  console.error('Missing/invalid public-files.json; run npm run build:dist and serve dist/');
  process.exit(1);
}
const REAL_ROOT = fs.realpathSync(ROOT);

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
} catch (_) {
  console.error('Missing/invalid vercel.json security headers');
  process.exit(1);
}
if (!HEADER_RULES.some(r => r.headers.some(([key]) => key.toLowerCase() === 'content-security-policy'))) {
  console.error('Missing Content-Security-Policy');
  process.exit(1);
}

function send(res, status, body, headers) {
  res.writeHead(status, Object.assign({ 'Content-Type': 'text/plain; charset=utf-8', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' }, securityHeaders(), headers || {}));
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
    const relative = p.slice(1);
    if (!PUBLIC_FILES.has(relative) || relative.split('/').some(part => part.startsWith('.'))) continue;
    const abs = path.resolve(ROOT, relative);
    if (!abs.startsWith(ROOT + path.sep)) continue;
    try {
      // realpath blocks symlinks to backups, secrets, and files outside dist.
      const real = fs.realpathSync(abs);
      if (real !== abs || !real.startsWith(REAL_ROOT + path.sep)) continue;
      if (fs.statSync(real).isFile()) return { abs: real, urlPath: p };
    } catch (_) { continue; }
  }
  return null;
}

function securityHeaders() {
  const headers = {};
  const rule = HEADER_RULES.find(r => r.source === '/index.html') || HEADER_RULES[0];
  for (const [key, value] of rule.headers) {
    if (key.toLowerCase() !== 'cache-control') headers[key] = value;
  }
  return headers;
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
  Object.assign(headers, securityHeaders());

  let st;
  try { st = fs.statSync(hit.abs); } catch (_) { return send(res, 404, 'Not Found'); }
  headers['Content-Length'] = st.size;
  res.writeHead(200, headers);
  if (req.method === 'HEAD') return res.end();
  const stream = fs.createReadStream(hit.abs);
  stream.on('error', () => { try { res.destroy(); } catch (_) {} });
  stream.pipe(res);
});

server.requestTimeout = 30_000;
server.headersTimeout = 10_000;
server.keepAliveTimeout = 5_000;
server.maxRequestsPerSocket = 100;

server.listen(PORT, HOST, () => {
  console.log(`SaEDU Flow static server: http://${HOST}:${PORT}/  (serving ${ROOT})`);
  if (BASE_PATH) console.log(`BASE_PATH = ${BASE_PATH}`);
});
