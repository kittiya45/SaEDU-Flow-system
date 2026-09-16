/* capture-steps.mjs — ถ่ายภาพทีละขั้นของทุกงานใน walkthroughs.mjs พร้อมวาด "วงเลข" ชี้ปุ่ม/ช่องบนภาพ
   ผลลัพธ์: shots/steps/<role>/<task>-<k>.jpg + shots/steps/<role>/manifest.json
   ใช้: node scripts/manual-handover/capture-steps.mjs [--role=student,teacher,staff] [--task=create-out] [--headed]
   วงเลขวาดในหน้าเว็บก่อนถ่าย (div ตำแหน่ง fixed ตาม boundingBox ของ selector) — selector ที่หาไม่พบจะถูกรายงานท้ายรัน */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openSession } from './capture.mjs';
import { TASKS } from './walkthroughs.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(process.argv.slice(2).map(a => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const ROLES = args.role ? String(args.role).split(',') : Object.keys(TASKS);
const ONLY_TASK = args.task ? String(args.task).split(',') : null;
const VP = { width: 1366, height: 860 }, VP_TALL = { width: 1366, height: 1900 };

const DRAW = (marks) => {
  let c = document.getElementById('__callouts'); if (c) c.remove();
  c = document.createElement('div'); c.id = '__callouts'; c.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483647';
  marks.forEach(m => {
    const pad = 5;
    const ring = document.createElement('div');
    ring.style.cssText = `position:fixed;left:${m.x - pad}px;top:${m.y - pad}px;width:${m.w + pad * 2}px;height:${m.h + pad * 2}px;border:3px solid #E11D48;border-radius:10px;box-shadow:0 0 0 2px rgba(255,255,255,.9),0 4px 14px rgba(225,29,72,.25);box-sizing:border-box`;
    const badge = document.createElement('div');
    const bx = Math.max(2, m.x - pad - 13), by = Math.max(2, m.y - pad - 13);
    badge.style.cssText = `position:fixed;left:${bx}px;top:${by}px;width:28px;height:28px;border-radius:50%;background:#E11D48;color:#fff;font:700 15px/28px Arial,sans-serif;text-align:center;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35);box-sizing:border-box`;
    badge.textContent = String(m.n);
    c.appendChild(ring); c.appendChild(badge);
  });
  document.body.appendChild(c);
};

async function locate(page, sel) {
  const cands = sel.split(/\s*\|\s*/);
  for (const s of cands) {
    try {
      const loc = page.locator(s).first();
      if (await loc.count() === 0) continue;
      const box = await loc.boundingBox();
      if (!box || box.width < 2 || box.height < 2) continue;
      return box;
    } catch (e) { /* selector ผิดรูปแบบ → ลองตัวถัดไป */ }
  }
  return null;
}

const missingAll = [];
let session = null;
try {
  for (const role of ROLES) {
    const dir = path.join(HERE, 'shots', 'steps', role);
    fs.mkdirSync(dir, { recursive: true });
    const manifest = {};
    console.log('■ ' + role);
    for (const task of TASKS[role]) {
      if (ONLY_TASK && !ONLY_TASK.includes(task.id)) continue;
      const startVp = task.start && task.start.vp ? task.start.vp : task.start && task.start.tall ? VP_TALL : VP;
      if (!session) session = await openSession(startVp, null);
      const { browser, close } = session;
      const { ctx, page } = await session.newPage(startVp);
      const h = { go: session.go, modalOpen: session.modalOpen, waitPdf: session.waitPdf, login: session.login };
      try {
        if (task.start && task.start.as) await session.login(page, task.start.as);
        let k = 0;
        for (const st of task.steps) {
          k++;
          const id = `${task.id}-${k}`;
          const t0 = Date.now();
          try {
            const vp = st.vp || (st.tall ? VP_TALL : (task.start && task.start.tall && !st.crop ? VP_TALL : VP));
            await page.setViewportSize(vp);
            if (st.as) await session.login(page, st.as);
            await st.do(page, h);
            await page.waitForTimeout(350);
            // วงเลข
            const found = [], missing = [];
            for (let i = 0; i < (st.marks || []).length; i++) {
              const m = st.marks[i];
              const box = await locate(page, m.sel);
              if (box) found.push({ n: i + 1, x: box.x, y: box.y, w: box.width, h: box.height, label: m.label, desc: m.desc || '' });
              else { missing.push(m.sel); found.push({ n: i + 1, x: -999, y: -999, w: 0, h: 0, label: m.label, desc: m.desc || '', missing: true }); }
            }
            if (missing.length) missingAll.push({ role, id, missing });
            await page.evaluate(() => { document.querySelectorAll('.sp,.sp-dark').forEach(e => e.style.visibility = 'hidden'); });
            await page.evaluate(DRAW, found.filter(f => !f.missing));
            // พื้นที่ภาพ
            let clip = { x: 0, y: 0, width: vp.width, height: vp.height };
            const clipBox = st.clip ? await locate(page, st.clip) : null;
            if (clipBox) {
              // ตัดให้เหลือองค์ประกอบที่ระบุ (+ขอบ) เพื่อให้วงเลขและตัวหนังสือในภาพใหญ่อ่านง่าย
              const pad = 26; const x = Math.max(0, clipBox.x - pad), y = Math.max(0, clipBox.y - pad);
              clip = { x, y, width: Math.min(vp.width - x, clipBox.width + pad * 2), height: Math.min(vp.height - y, clipBox.height + pad * 2) };
            } else if (st.crop) {
              const box = await page.evaluate(() => { const cands = ['#mwrap .modal', '.cpopup-box', '#mwrap > * > *']; for (const c of cands) { const el = document.querySelector(c); if (el) { const r = el.getBoundingClientRect(); if (r.width > 280 && r.height > 120) return { x: r.left, y: r.top, w: r.width, h: r.height }; } } return null; });
              if (box) { const pad = 30; clip = { x: Math.max(0, box.x - pad), y: Math.max(0, box.y - pad), width: Math.min(vp.width - Math.max(0, box.x - pad), box.w + pad * 2), height: Math.min(vp.height - Math.max(0, box.y - pad), box.h + pad * 2) }; }
            } else if (vp.height > 1000) {
              clip.height = await page.evaluate(vh => { const m = document.querySelector('#app main'); if (!m) return vh; let bottom = 0; m.querySelectorAll('*').forEach(el => { const r = el.getBoundingClientRect(); if (r.height > 0 && r.bottom > bottom && r.bottom < vh + 4000) bottom = r.bottom; }); return Math.max(860, Math.min(vh, Math.ceil(bottom + 28))); }, vp.height);
            }
            const file = path.join(dir, id + '.jpg');
            await page.screenshot({ path: file, type: 'jpeg', quality: 86, clip });
            await page.evaluate(() => { const c = document.getElementById('__callouts'); if (c) c.remove(); });
            manifest[id] = { file: `shots/steps/${role}/${id}.jpg`, w: Math.round(clip.width), h: Math.round(clip.height), marks: found.map(f => ({ n: f.n, label: f.label, desc: f.desc, missing: !!f.missing })) };
            console.log(`  ✓ ${id.padEnd(16)} ${String(Date.now() - t0).padStart(5)} ms${missing.length ? '  ⚠ ไม่พบ: ' + missing.join(' ; ') : ''}`);
          } catch (e) {
            console.warn(`  ✗ ${id}: ${e.message.split('\n')[0]}`);
            missingAll.push({ role, id, error: e.message.split('\n')[0] });
          }
        }
      } finally { await ctx.close(); }
    }
    const mf = path.join(dir, 'manifest.json');
    const prev = fs.existsSync(mf) ? JSON.parse(fs.readFileSync(mf, 'utf8')) : {};
    fs.writeFileSync(mf, JSON.stringify(Object.assign(prev, manifest), null, 2));
  }
} finally { if (session) await session.close(); }
if (missingAll.length) { console.log('\nสรุปสิ่งที่ต้องแก้:'); missingAll.forEach(m => console.log(' -', m.role, m.id, m.error || m.missing.join(' ; '))); }
