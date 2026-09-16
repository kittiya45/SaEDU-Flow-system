/* probe.mjs — พิมพ์รายการองค์ประกอบที่กดได้/กรอกได้ของหน้าจอหนึ่ง เพื่อใช้เขียน selector ของวงเลขใน walkthroughs.mjs
   ใช้: node scripts/manual-handover/probe.mjs <shot-id จาก SETS.all|student|staff> [--set=student]
   พิมพ์: tag#id[data-action] "ข้อความ" @x,y wxh  — เฉพาะที่มองเห็นและอยู่ในหน้าจอ */
import { chromium } from 'playwright';
import { SETS, openSession } from './capture.mjs';

const args = Object.fromEntries(process.argv.slice(2).map(a => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : ['_', a]; }));
const id = args._; const setName = args.set || 'all';
const def = SETS[setName].find(s => s.id === id);
if (!def) { console.error('no shot', id); process.exit(1); }
const { browser, page, close } = await openSession(def.vp || (def.tall ? { width: 1366, height: 1900 } : { width: 1366, height: 860 }), def.as);
await def.run(page);
const rows = await page.evaluate(() => {
  const out = [];
  const seen = new Set();
  document.querySelectorAll('button,a,input,select,textarea,label,[data-action],[onclick],[role=button],canvas,.itab,.badge,.card-head,.card-head-title,h1,h2,h3,h4,.nav-item,.sb-item,[id]').forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.width < 6 || r.height < 6 || r.bottom < 0 || r.right < 0 || r.top > innerHeight || r.left > innerWidth) return;
    const st = getComputedStyle(el); if (st.visibility === 'hidden' || st.display === 'none' || st.opacity === '0') return;
    const key = el.tagName + '|' + Math.round(r.left) + '|' + Math.round(r.top) + '|' + Math.round(r.width);
    if (seen.has(key)) return; seen.add(key);
    const txt = (el.value && el.tagName !== 'BUTTON' ? '' : (el.innerText || el.textContent || '')).replace(/\s+/g, ' ').trim().slice(0, 40);
    out.push(`${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${el.dataset.action ? '[data-action=' + el.dataset.action + ']' : ''}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : ''}${el.placeholder ? ' ph="' + el.placeholder.slice(0, 25) + '"' : ''} "${txt}" @${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)}`);
  });
  return out;
});
console.log(rows.join('\n'));
await close();
