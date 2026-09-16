/* จับภาพหน้าจอจริงของระบบด้วยข้อมูลจำลอง (fixtures.mjs) สำหรับเอกสารส่งมอบ
   - เสิร์ฟ repo ด้วย python http.server แล้วเปิดใน Chromium (Playwright)
   - แทน vendor/supabase.js ด้วย stub (ไม่มี session → หน้า login) และทับ dg/dp/dpa/dd ด้วย fake-rest.js
   - เข้าระบบด้วย _enterAppAsUser(row) ตัวจริง แล้วเรียก nav()/modal ตัวจริงเพื่อถ่ายภาพ
   ผลลัพธ์: shots/<id>.jpg + shots/manifest.json (build.mjs อ่านไปวางในเอกสาร)
   ใช้: node scripts/manual-handover/capture.mjs [--set=all,student,teacher,staff] [--only=id1,id2] [--headed] */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { TABLES, CU_BY_ROLE } from './fixtures.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const ASSETS = path.join(HERE, 'assets');
const SHOTS_DIR = path.join(HERE, 'shots');
const PORT = 8137;
const BASE = 'http://127.0.0.1:' + PORT;
const args = Object.fromEntries(process.argv.slice(2).map(a => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const ONLY = args.only ? String(args.only).split(',') : null;
const VP = { width: 1366, height: 860 };
const VP_TALL = { width: 1366, height: 1900 };

/* ───────── assets: PDF ตัวอย่าง + ลายเซ็นตัวอย่าง ───────── */
async function ensureAssets(browser) {
  fs.mkdirSync(ASSETS, { recursive: true });
  const pdfPath = path.join(ASSETS, 'sample.pdf'), sigPath = path.join(ASSETS, 'sig.png');
  if (fs.existsSync(pdfPath) && fs.existsSync(sigPath) && !args['rebuild-assets']) return;
  const page = await browser.newPage();
  const letter = (n, total) => `
  <div class="pg">
    <div class="head"><div class="crest">กนค.</div><div><div class="org">คณะกรรมการนิสิต คณะครุศาสตร์ จุฬาลงกรณ์มหาวิทยาลัย</div><div class="sub">ถนนพญาไท แขวงวังใหม่ เขตปทุมวัน กรุงเทพฯ 10330</div></div></div>
    <table class="meta"><tr><td>ที่ กนค. ............../2569</td><td class="r">วันที่ 8 กันยายน 2569</td></tr></table>
    <p><b>เรื่อง</b>&nbsp;&nbsp;ขออนุมัติโครงการกีฬาสานสัมพันธ์ครุศาสตร์ ประจำปีการศึกษา 2569</p>
    <p><b>เรียน</b>&nbsp;&nbsp;คณบดีคณะครุศาสตร์</p>
    <p><b>สิ่งที่ส่งมาด้วย</b>&nbsp;&nbsp;1. รายละเอียดโครงการ จำนวน 1 ชุด&nbsp;&nbsp;2. ประมาณการงบประมาณ จำนวน 1 ชุด</p>
    <p class="body">ด้วยฝ่ายกีฬา คณะกรรมการนิสิตคณะครุศาสตร์ มีความประสงค์จะจัดโครงการกีฬาสานสัมพันธ์ครุศาสตร์ ประจำปีการศึกษา 2569 ในวันเสาร์ที่ 18 ตุลาคม 2569 ณ สนามกีฬาคณะครุศาสตร์ เพื่อเสริมสร้างความสามัคคีระหว่างนิสิตทุกชั้นปีและส่งเสริมสุขภาพพลานามัยของนิสิต โดยมีนิสิตเข้าร่วมประมาณ 350 คน ใช้งบประมาณจากเงินกิจกรรมนิสิต จำนวน 85,000 บาท (แปดหมื่นห้าพันบาทถ้วน) รายละเอียดตามสิ่งที่ส่งมาด้วย</p>
    <p class="body">จึงเรียนมาเพื่อโปรดพิจารณาอนุมัติโครงการและงบประมาณดังกล่าว จักขอบพระคุณยิ่ง</p>
    <div class="signs">
      <div class="sig"><div class="line"></div><div>(นายกิตติภพ แสงทอง)</div><div class="pos">ประธานฝ่ายกีฬา คณะกรรมการนิสิต</div></div>
      <div class="sig"><div class="line"></div><div>(นายภาคิน วงศ์สุวรรณ)</div><div class="pos">หัวหน้านิสิต</div></div>
    </div>
    <div class="signs">
      <div class="sig"><div class="line"></div><div>(ผศ.ดร.สุภาวดี รัตนโกศล)</div><div class="pos">อาจารย์ที่ปรึกษา</div></div>
      <div class="sig"><div class="line"></div><div>(...............................................)</div><div class="pos">รองคณบดีฝ่ายกิจการนิสิต</div></div>
    </div>
    <div class="foot">หน้า ${n} / ${total}</div>
  </div>`;
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    @page{size:A4;margin:0} body{margin:0;font-family:'TH Sarabun New','TH SarabunPSK',Tahoma,sans-serif;font-size:16pt;color:#111;line-height:1.55}
    .pg{width:210mm;height:297mm;box-sizing:border-box;padding:22mm 22mm 18mm 28mm;position:relative;page-break-after:always;background:#fff}
    .head{display:flex;gap:12px;align-items:center;margin-bottom:10mm}.crest{width:58px;height:58px;border-radius:50%;background:#E83A00;color:#fff;font-weight:700;display:flex;align-items:center;justify-content:center;font-size:15pt}
    .org{font-weight:700;font-size:17pt}.sub{font-size:13pt;color:#444}.meta{width:100%;margin-bottom:6mm}.meta td.r{text-align:right}
    p{margin:0 0 5px}.body{text-indent:2.5cm;text-align:justify;margin-top:8px}.signs{display:flex;gap:30px;margin-top:38px}.sig{flex:1;text-align:center}.sig .line{height:34px;border-bottom:1px dotted #333;margin:0 20px 6px}.pos{font-size:14pt;color:#333}
    .foot{position:absolute;bottom:10mm;right:22mm;font-size:12pt;color:#666}
  </style></head><body>${letter(1, 2)}${letter(2, 2).replace('ขออนุมัติโครงการกีฬาสานสัมพันธ์ครุศาสตร์ ประจำปีการศึกษา 2569', 'รายละเอียดโครงการ (เอกสารแนบ 1)')}</body></html>`;
  await page.setContent(html, { waitUntil: 'load' });
  await page.pdf({ path: pdfPath, format: 'A4', printBackground: true });
  // ลายเซ็นตัวอย่าง — เส้นโค้งหมึกน้ำเงินบนพื้นโปร่ง
  const dataUrl = await page.evaluate(() => {
    const c = document.createElement('canvas'); c.width = 600; c.height = 220; const x = c.getContext('2d');
    x.strokeStyle = '#1f2a5c'; x.lineWidth = 5; x.lineCap = 'round'; x.lineJoin = 'round';
    x.beginPath(); x.moveTo(40, 150);
    x.bezierCurveTo(60, 40, 120, 30, 130, 120); x.bezierCurveTo(140, 190, 90, 200, 110, 140);
    x.bezierCurveTo(150, 60, 220, 60, 250, 130); x.bezierCurveTo(270, 175, 300, 150, 310, 110);
    x.bezierCurveTo(330, 60, 380, 80, 370, 130); x.bezierCurveTo(360, 170, 410, 165, 440, 120);
    x.bezierCurveTo(470, 70, 520, 90, 545, 140); x.stroke();
    x.lineWidth = 3; x.beginPath(); x.moveTo(60, 178); x.bezierCurveTo(200, 160, 380, 200, 560, 165); x.stroke();
    return c.toDataURL('image/png');
  });
  fs.writeFileSync(sigPath, Buffer.from(dataUrl.split(',')[1], 'base64'));
  await page.close();
}

/* ───────── static server ───────── */
function startServer() {
  const p = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1', '--directory', ROOT], { stdio: 'ignore' });
  return new Promise((ok, no) => { const t0 = Date.now(); (async function poll() { try { const r = await fetch(BASE + '/index.html'); if (r.ok) return ok(p); } catch (e) { } if (Date.now() - t0 > 8000) return no(new Error('static server did not start')); setTimeout(poll, 150); })(); });
}

const SB_STUB = `
window.supabase={createClient:function(){return window.__SB_STUB}};
window.__assetUrl=function(b,p){var base='https://assets.local/';if(b==='user-signatures')return base+'sig.png';p=String(p||'').toLowerCase();if(/\\.(png|jpe?g)$/.test(p))return base+'sig.png';return base+'sample.pdf'};
window.__SB_STUB={auth:{getSession:async()=>({data:{session:null},error:null}),getUser:async()=>({data:{user:null},error:null}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),signOut:async()=>({error:null}),signInWithPassword:async()=>({data:{},error:{message:'stub'}}),updateUser:async()=>({data:{},error:null}),signUp:async()=>({data:{},error:null})},
 rpc:async()=>({data:null,error:null}),
 storage:{from:function(b){return{createSignedUrl:async(p)=>({data:{signedUrl:window.__assetUrl(b,p)},error:null}),download:async(p)=>{var r=await fetch(window.__assetUrl(b,p));return{data:await r.blob(),error:null}},remove:async()=>({data:[],error:null}),list:async()=>({data:[],error:null}),upload:async()=>({data:{path:'stub'},error:null})}}}};`;

async function newPage(browser, viewport) {
  const ctx = await browser.newContext({ viewport: viewport || VP, deviceScaleFactor: 1.5, locale: 'th-TH', timezoneId: 'Asia/Bangkok' });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.warn('    [pageerror]', e.message));
  await page.route('**/vendor/supabase.js*', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: SB_STUB }));
  // ไฟล์ตัวอย่างเสิร์ฟผ่านโดเมนสมมติแบบ https — viewer.js รับเฉพาะ https URL
  await page.route('https://assets.local/**', r => { const f = path.join(ASSETS, path.basename(new URL(r.request().url()).pathname)); if (!fs.existsSync(f)) return r.fulfill({ status: 404, body: '' }); r.fulfill({ status: 200, contentType: f.endsWith('.pdf') ? 'application/pdf' : 'image/png', body: fs.readFileSync(f), headers: { 'access-control-allow-origin': '*' } }); });
  await page.route('**://*.supabase.co/functions/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"skipped":"stub"}' }));
  await page.route('**://*.supabase.co/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
  await page.addScriptTag({ content: 'window.__FIX=' + JSON.stringify(TABLES) + ';' });
  await page.addScriptTag({ path: path.join(HERE, 'fake-rest.js') });
  await page.waitForFunction(() => window.__REST_READY === true);
  // เปลี่ยน "วันนี้" ของหน้าเป็นวันที่ข้อมูลจำลองอ้างอิง เพื่อให้ป้าย "ใกล้ถึงกำหนด/เกินกำหนด" คงที่ทุกครั้งที่จับภาพ
  return { ctx, page };
}
async function login(page, uid) {
  const row = CU_BY_ROLE[uid];
  await page.evaluate(async r => { await _enterAppAsUser(r, { logLogin: false }); }, row);
  await page.waitForFunction(() => document.querySelector('#app main') && !document.querySelector('#app main .sp'), null, { timeout: 15000 }).catch(() => { });
  await page.waitForTimeout(400);
}
const go = async (page, view, id) => { await page.evaluate(([v, i]) => nav(v, i), [view, id || null]); await page.waitForFunction(() => !document.querySelector('#app main .sp-dark'), null, { timeout: 15000 }).catch(() => { }); await page.waitForTimeout(500); };
const waitPdf = (page, sel) => page.waitForFunction(s => document.querySelectorAll(s + ' canvas').length > 0, sel, { timeout: 40000 }).then(() => page.waitForTimeout(700));
const modalOpen = page => page.waitForFunction(() => (document.querySelector('#mwrap') && document.querySelector('#mwrap').children.length > 0) || document.querySelector('.cpopup-overlay'), null, { timeout: 10000 }).then(() => page.waitForTimeout(600));

/* ───────── รายการภาพ ─────────
   ฟังก์ชันสร้างรายการภาพแต่ละแบบ รับ "ผู้ใช้ที่ล็อกอิน" (as) และเอกสารเป้าหมาย เพื่อใช้ซ้ำในชุดภาพของแต่ละบทบาท
   (คู่มือของนิสิตต้องเห็นหน้าจอแบบที่นิสิตเห็น ไม่ใช่แบบที่เจ้าหน้าที่เห็น) */
const F = {
  login: () => ({ id: 'login', cap: 'หน้าเข้าสู่ระบบ', vp: { width: 1000, height: 820 }, run: async p => { } }),
  register: (which) => ({ id: 'register', cap: which === 'staff' ? 'หน้าต่างสมัครสมาชิกสำหรับอาจารย์และเจ้าหน้าที่' : 'หน้าต่างสมัครสมาชิกสำหรับนิสิต กนค.', vp: { width: 1000, height: 900 }, crop: true, run: async p => { await p.click(which === 'staff' ? '[data-action="showRegStaffPopup"]' : '[data-action="showRegGnkPopup"]'); await modalOpen(p); } }),
  dash: (as, cap) => ({ id: 'dash', cap: cap || 'หน้าภาพรวม (Dashboard)', as, tall: true, run: async p => { await go(p, 'dash'); } }),
  todo: (as) => ({ id: 'todo', cap: 'หน้างานของฉัน — รายการที่ถึงคิวต้องดำเนินการ', as, run: async p => { await go(p, 'todo'); } }),
  docs: (as) => ({ id: 'docs', cap: 'หน้ารายการเอกสาร (แท็บ ตัวกรอง ค้นหา ส่งออก CSV)', as, tall: true, run: async p => { await go(p, 'docs'); } }),
  form_out: (as, cap) => ({ id: 'form_out', cap: cap || 'ฟอร์มสร้างหนังสือขาออก พร้อมสายขั้นตอนที่ระบบเติมให้ตามประเภทหนังสือ', as, tall: true, run: async p => {
    await go(p, 'new'); await p.click('[data-dtype="outgoing"]'); await p.waitForTimeout(400);
    await p.fill('#ftit', 'ขออนุมัติโครงการกีฬาสานสัมพันธ์ครุศาสตร์ ประจำปีการศึกษา 2569').catch(() => { });
    if (await p.$('#fdsc')) await p.selectOption('#fdsc', { label: 'ขออนุมัติโครงการ ไม่เกิน 1 แสนบาท' }).catch(() => { });
    await p.waitForTimeout(600); } }),
  form_in: (as) => ({ id: 'form_in', cap: 'ฟอร์มสร้างหนังสือขาเข้า (ฟอร์มอย่างง่าย ไม่มีสายขั้นตอน)', as, tall: true, run: async p => { await go(p, 'new'); await p.click('[data-dtype="incoming"]'); await p.waitForTimeout(500); } }),
  form_edit: (as, doc) => ({ id: 'form_edit', cap: 'ฟอร์มแก้ไขเอกสารที่ถูกส่งคืน ก่อนกด "ส่งใหม่"', as, tall: true, run: async p => { await go(p, 'edit', doc); await p.waitForTimeout(500); } }),
  det: (as, doc, cap) => ({ id: 'det', cap: cap || 'หน้ารายละเอียดเอกสาร — สายขั้นตอน ไฟล์แนบ ประวัติ และปุ่มดำเนินการ', as, tall: true, run: async p => { await go(p, 'det', doc); } }),
  det_own: (as, doc) => ({ id: 'det_own', cap: 'หน้ารายละเอียดเอกสารของตนเองระหว่างรอลงนาม — ติดตามว่าอยู่ที่ขั้นใด', as, tall: true, run: async p => { await go(p, 'det', doc); } }),
  sign: (as, doc) => ({ id: 'sign', crop: true, cap: 'หน้าต่างอนุมัติ/ลงนาม — เลือกลายเซ็นและวางตำแหน่งบนเอกสาร', as, run: async p => {
    await go(p, 'det', doc); await p.evaluate(d => showActModal('approve', d), doc); await modalOpen(p);
    await waitPdf(p, '#sig-pos-wrap'); await p.evaluate(() => { try { _addSigMarkAt(0.28, 0.63, 1); } catch (e) { } }); await p.waitForTimeout(600); } }),
  reject: (as, doc) => ({ id: 'reject', crop: true, cap: 'หน้าต่างส่งคืนแก้ไข — เลือกส่วนที่ต้องแก้และระบุหมายเหตุ', as, run: async p => { await go(p, 'det', doc); await p.evaluate(d => showActModal('reject', d), doc); await modalOpen(p); await p.waitForTimeout(800); } }),
  cancel: (as, doc) => ({ id: 'cancel', crop: true, cap: 'หน้าต่างยกเลิกเอกสาร (ต้องระบุเหตุผล)', as, run: async p => { await go(p, 'det', doc); await p.evaluate(d => showCancelDocModal(d), doc); await modalOpen(p); } }),
  recall: (as, doc) => ({ id: 'recall', crop: true, cap: 'กล่องยืนยันดึงเอกสารกลับเป็นร่าง (ทำได้เมื่อยังไม่มีใครอนุมัติ)', as, run: async p => { await go(p, 'det', doc); await p.evaluate(d => doRecall(d), doc); await modalOpen(p); } }),
  rejected_det: (as, doc) => ({ id: 'rejected_det', cap: 'เอกสารที่ถูกส่งคืนแก้ไข — ผู้จัดทำเห็นส่วนที่ต้องแก้และปุ่มแก้ไข/ส่งใหม่', as, tall: true, run: async p => { await go(p, 'det', doc); } }),
  num: (as, doc) => ({ id: 'num', crop: true, cap: 'หน้าต่างออกเลขหนังสือ — เลือกภาคการศึกษา/ประเภท และลากตำแหน่งประทับเลขบน PDF', as, run: async p => { await go(p, 'det', doc); await p.evaluate(d => showNumModal(d), doc); await modalOpen(p); await waitPdf(p, '#mwrap'); } }),
  forward: (as, doc) => ({ id: 'forward', crop: true, cap: 'หน้าต่างส่งต่อเอกสาร — ระบุชื่อบุคคล หรือส่งเข้าคิวกลุ่มเจ้าหน้าที่กิจการนิสิต', as, run: async p => { await go(p, 'det', doc); await p.evaluate(d => showFwdModal(d), doc); await modalOpen(p); } }),
  fwd_staff: (as, doc) => ({ id: 'fwd_staff', cap: 'มุมมองเจ้าหน้าที่ — เอกสารในคิวกลุ่มรอกดรับ', as, tall: true, run: async p => { await go(p, 'det', doc); } }),
  awaiting: (as, doc) => ({ id: 'awaiting', cap: 'เอกสารสถานะรอเจ้าหน้าที่ยื่นในระบบ — เจ้าหน้าที่อัปโหลดฉบับประทับกลับเข้ามา', as, tall: true, run: async p => { await go(p, 'det', doc); } }),
  ack_card: (as, doc) => ({ id: 'ack_card', cap: 'การ์ดการรับทราบของหนังสือขาเข้า — ผู้จัดทำเห็นว่าใครรับทราบแล้ว/ยังรอ', as, tall: true, run: async p => { await go(p, 'det', doc); } }),
  ack_propose: (as, doc) => ({ id: 'ack_propose', crop: true, cap: 'หน้าต่างเสนอเอกสารเพื่อรับทราบ — ระบบติ๊กเลขานุการและหัวหน้านิสิตให้ก่อน', as, run: async p => { await go(p, 'det', doc); await p.evaluate(d => showAckProposeModal(d), doc); await modalOpen(p); } }),
  ack_modal: (as, doc) => ({ id: 'ack_modal', crop: true, cap: 'หน้าต่างรับทราบเอกสาร — ลงลายเซ็นรับทราบและวางตำแหน่งบน PDF', as, run: async p => { await go(p, 'det', doc); await p.evaluate(d => showAckModal(d), doc); await modalOpen(p); await waitPdf(p, '#sig-pos-wrap').catch(() => { }); await p.evaluate(() => { try { _addSigMarkAt(0.7, 0.35, 1); } catch (e) { } }); await p.waitForTimeout(500); } }),
  notif: (as) => ({ id: 'notif', cap: 'กระดิ่งแจ้งเตือน — งานที่ถึงคิว และทางเข้าเชื่อม LINE', as, run: async p => { await go(p, 'dash'); await p.evaluate(() => _toggleNotifPanel()); await p.waitForTimeout(600); } }),
  line: (as) => ({ id: 'line', crop: true, cap: 'หน้าต่างเชื่อมบัญชี LINE OA ด้วยรหัส 6 หลัก', as, run: async p => { await go(p, 'dash'); await p.evaluate(() => showLineLink()); await modalOpen(p); } }),
  sigprof: (as) => ({ id: 'sigprof', cap: 'หน้าลายเซ็นของฉัน — วาดหรืออัปโหลดลายเซ็นเก็บไว้ใช้ตอนอนุมัติ', as, run: async p => { await go(p, 'prof'); } }),
  verhist: (as, doc) => ({ id: 'verhist', crop: true, cap: 'ประวัติเวอร์ชันไฟล์ (เจ้าหน้าที่/ผู้ดูแล) — ไฟล์ต้นฉบับ ฉบับลงนาม และไฟล์ที่ย้ายไปคลัง', as, run: async p => { await go(p, 'det', doc); await p.evaluate(d => showVerHist(d), doc); await modalOpen(p); } }),
  viewer: (as, doc) => ({ id: 'viewer', cap: 'หน้าต่างพรีวิวไฟล์ PDF ในระบบ', as, crop: true, run: async p => { await go(p, 'det', doc); await p.click('[data-action="openViewer"][data-path$=".pdf"]'); await modalOpen(p); await waitPdf(p, '#mwrap'); } }),
  editor: (as, doc) => ({ id: 'editor', cap: 'ตัวแก้ไข PDF ในตัว — เพิ่มลายเซ็น/ข้อความ แล้วบันทึกเป็นเวอร์ชันใหม่', as, crop: true, run: async p => { await go(p, 'det', doc); await p.click('[data-action="openEditor"][data-path$=".pdf"]'); await modalOpen(p); await waitPdf(p, '#mwrap'); await p.waitForTimeout(800); } }),
  calendar: (as) => ({ id: 'calendar', crop: true, cap: 'หน้าต่างเพิ่มกิจกรรมในปฏิทิน', as, run: async p => { await go(p, 'dash'); await p.evaluate(() => showCalAddEvt()); await modalOpen(p); } }),
  tmpl: (as, cap) => ({ id: 'tmpl', cap: cap || 'หน้าแบบฟอร์มดาวน์โหลด', as, run: async p => { await go(p, 'tmpl'); } }),
  adm: (as, cap) => ({ id: 'adm', cap: cap || 'หน้าจัดการผู้ใช้ — อนุมัติบัญชี แก้ไขบทบาท ต่ออายุ', as, tall: true, run: async p => { await go(p, 'adm'); } }),
  adm_edit: (as) => ({ id: 'adm_edit', crop: true, cap: 'หน้าต่างแก้ไขผู้ใช้ — บทบาท ตำแหน่ง สังกัด', as, run: async p => { await go(p, 'adm'); await p.evaluate(() => showEU('u05')); await modalOpen(p); } }),
  import: (as) => ({ id: 'import', crop: true, cap: 'หน้าต่างนำเข้าผู้ใช้ด้วยไฟล์ CSV', as, run: async p => { await go(p, 'adm'); await p.evaluate(() => showImport()); await modalOpen(p); } }),
  stat: (as) => ({ id: 'stat', cap: 'หน้าสถิติและรายงาน', as, tall: true, run: async p => { await go(p, 'stat'); } }),
  sys: (as) => ({ id: 'sys', cap: 'หน้าจัดการระบบ — เลขที่เอกสาร ตั้งค่าระบบ แบบฟอร์มอีเมล เทมเพลตขั้นตอน ประกาศ', as, tall: true, run: async p => { await go(p, 'sys'); } }),
  dev: (as) => ({ id: 'dev', cap: 'แผงนักพัฒนา (ROLE-DEV) — สุขภาพระบบ รายการ SQL บันทึกข้อผิดพลาด เครื่องมือซ่อม', as, tall: true, run: async p => { await go(p, 'dev'); } }),
};

/* ชุดภาพ: all = ชุดรวมสำหรับเอกสารส่งมอบ (shots/) · student/teacher/staff = ภาพที่ผู้ใช้บทบาทนั้นเห็นจริง (shots/<role>/) */
export const SETS = {
  all: [F.login(), F.register(), F.dash('u05', 'หน้าภาพรวม (Dashboard) ของผู้จัดทำ'), F.todo('u04'), F.docs('u05'), F.form_out('u05'), F.form_in('u02'),
    F.det('u07', 'd01', 'หน้ารายละเอียดเอกสาร — สายขั้นตอน ไฟล์แนบ ประวัติ และปุ่มดำเนินการของผู้ที่ถึงคิว'), F.sign('u07', 'd01'), F.reject('u07', 'd01'), F.cancel('u05', 'd01'), F.rejected_det('u04', 'd06'),
    F.num('u05', 'd03'), F.forward('u05', 'd08'), F.fwd_staff('u07', 'd08'), F.awaiting('u07', 'd04'), F.ack_card('u02', 'd05'), F.ack_propose('u02', 'd05'), F.ack_modal('u01', 'd05'),
    F.notif('u04'), F.line('u04'), F.sigprof('u05'), F.verhist('u07', 'd08'), F.viewer('u05', 'd01'), F.editor('u05', 'd01'), F.calendar('u02'), F.tmpl('u05'),
    F.adm('u08', 'หน้าจัดการผู้ใช้ (เจ้าหน้าที่/ผู้ดูแลระบบ) — อนุมัติบัญชี แก้ไขบทบาท ต่ออายุ'), F.adm_edit('u08'), F.import('u08'), F.stat('u08'), F.sys('u08'), F.dev('u12')],
  // นิสิต กนค.: ผู้จัดทำ (u05 ฝ่ายกีฬา) · ประธานฝ่ายที่ต้องตรวจทาน (u04) · หัวหน้านิสิตที่ต้องรับทราบ (u01) · เลขานุการที่สร้างหนังสือขาเข้า (u02)
  student: [F.login(), F.register('gnk'), F.dash('u05', 'หน้าภาพรวมของนิสิต กนค.'), F.todo('u04'), F.docs('u05'), F.form_out('u05'), F.form_in('u02'),
    F.det_own('u05', 'd01'), F.det('u04', 'd02', 'หน้ารายละเอียดเอกสารเมื่อถึงคิวของเรา — มีปุ่ม อนุมัติ/ลงนาม และ ส่งคืนแก้ไข'), F.sign('u04', 'd02'), F.reject('u04', 'd02'),
    F.recall('u10', 'd02'), F.cancel('u05', 'd01'), F.rejected_det('u04', 'd06'), F.form_edit('u04', 'd06'), F.num('u05', 'd03'), F.forward('u05', 'd08'),
    F.ack_card('u02', 'd05'), F.ack_propose('u02', 'd05'), F.ack_modal('u01', 'd05'), F.notif('u04'), F.line('u04'), F.sigprof('u05'), F.viewer('u05', 'd01'), F.editor('u05', 'd01'), F.calendar('u02'), F.tmpl('u05')],
  // อาจารย์ที่ปรึกษาชมรม (u06) — เป็นขั้นสุดท้ายของสายอนุมัติ d10
  teacher: [F.login(), F.register('staff'), F.dash('u06', 'หน้าภาพรวมของอาจารย์ที่ปรึกษา'), F.todo('u06'), F.docs('u06'), F.form_out('u06'),
    F.det('u06', 'd10', 'หน้ารายละเอียดเอกสารที่ถึงคิวอาจารย์ที่ปรึกษา (ขั้นสุดท้ายของสายอนุมัติ)'), F.sign('u06', 'd10'), F.reject('u06', 'd10'), F.rejected_det('u06', 'd06'),
    F.notif('u06'), F.line('u06'), F.sigprof('u06'), F.viewer('u06', 'd10'), F.calendar('u06'), F.tmpl('u06')],
  // เจ้าหน้าที่ (u07) และผู้ดูแลระบบ (u08) — หน้าจัดการระบบใช้ผู้ดูแล
  staff: [F.login(), F.register('staff'), F.dash('u07', 'หน้าภาพรวมของเจ้าหน้าที่ (มีแบนเนอร์เฝ้าระวังระบบเมื่อมีปัญหา)'), F.todo('u07'), F.docs('u07'),
    F.form_out('u07', 'ฟอร์มสร้างหนังสือขาออกของเจ้าหน้าที่ — กำหนดสายขั้นตอนเองอิสระ'), F.form_in('u07'),
    F.det('u07', 'd01', 'หน้ารายละเอียดเอกสารเมื่อถึงขั้น "เจ้าหน้าที่กิจการนิสิต" ในสายงบประมาณ'), F.sign('u07', 'd01'), F.reject('u07', 'd01'), F.cancel('u07', 'd01'),
    F.num('u07', 'd03'), F.forward('u07', 'd08'), F.fwd_staff('u07', 'd08'), F.awaiting('u07', 'd04'), F.ack_card('u07', 'd05'), F.ack_propose('u07', 'd05'),
    F.notif('u07'), F.line('u07'), F.sigprof('u07'), F.verhist('u07', 'd08'), F.viewer('u07', 'd01'), F.editor('u07', 'd01'), F.calendar('u07'), F.tmpl('u07', 'หน้าแบบฟอร์มดาวน์โหลด (เจ้าหน้าที่อัปโหลด/แก้ไข/ลบได้)'),
    F.adm('u07', 'หน้าจัดการผู้ใช้ในมุมมองเจ้าหน้าที่'), F.adm_edit('u07'), F.import('u07'), F.stat('u07'), F.sys('u08'), F.dev('u12')],
};
export const SHOTS = SETS.all;

/* เปิดเซสชันเดียวสำหรับสคริปต์อื่น (probe.mjs, capture-steps.mjs): server + browser + หน้าใหม่ที่ล็อกอินแล้ว */
export async function openSession(viewport, asUser) {
  const server = await startServer();
  const browser = await chromium.launch({ headless: !args.headed });
  await ensureAssets(browser);
  const { ctx, page } = await newPage(browser, viewport || VP);
  if (asUser) await login(page, asUser);
  return { browser, page, ctx, newPage: (vp) => newPage(browser, vp), login, go, waitPdf, modalOpen, close: async () => { await browser.close(); server.kill(); } };
}

export async function captureAll() {
  const setNames = args.set ? String(args.set).split(',') : Object.keys(SETS);
  const server = await startServer();
  const browser = await chromium.launch({ headless: !args.headed });
  const done = {};
  try {
    await ensureAssets(browser);
    for (const setName of setNames) {
      const dir = setName === 'all' ? SHOTS_DIR : path.join(SHOTS_DIR, setName);
      fs.mkdirSync(dir, { recursive: true });
      const manifest = {};
      console.log('■ ชุดภาพ ' + setName);
      for (const s of SETS[setName]) {
        if (ONLY && !ONLY.includes(s.id)) continue;
        const t0 = Date.now();
        const vp = s.vp || (s.tall ? VP_TALL : VP);
        const { ctx, page } = await newPage(browser, vp);
        try {
          if (s.as) await login(page, s.as);
          await s.run(page);
          await page.evaluate(() => { document.querySelectorAll('.sp,.sp-dark').forEach(e => e.style.visibility = 'hidden'); });
          const file = path.join(dir, s.id + '.jpg');
          let clip = { x: 0, y: 0, width: vp.width, height: vp.height };
          if (s.tall) {
            clip.height = await page.evaluate(vh => {
              const m = document.querySelector('#app main'); if (!m) return vh;
              let bottom = 0; m.querySelectorAll('*').forEach(el => { const r = el.getBoundingClientRect(); if (r.height > 0 && r.bottom > bottom && r.bottom < vh + 4000) bottom = r.bottom; });
              return Math.max(860, Math.min(vh, Math.ceil(bottom + 28)));
            }, vp.height);
          } else if (s.crop) {
            const box = await page.evaluate(() => {
              const cands = ['#mwrap .modal', '.cpopup-box', '#mwrap > * > *'];
              for (const c of cands) { const el = document.querySelector(c); if (el) { const r = el.getBoundingClientRect(); if (r.width > 280 && r.height > 120) return { x: r.left, y: r.top, w: r.width, h: r.height }; } }
              return null;
            });
            if (box) { const pad = 28; clip = { x: Math.max(0, box.x - pad), y: Math.max(0, box.y - pad), width: Math.min(vp.width - Math.max(0, box.x - pad), box.w + pad * 2), height: Math.min(vp.height - Math.max(0, box.y - pad), box.h + pad * 2) }; }
          }
          await page.screenshot({ path: file, type: 'jpeg', quality: 86, clip });
          manifest[s.id] = { file: 'shots/' + (setName === 'all' ? '' : setName + '/') + s.id + '.jpg', cap: s.cap, w: Math.round(clip.width), h: Math.round(clip.height), as: s.as || null };
          console.log('  ✓ ' + s.id.padEnd(13) + (Date.now() - t0) + ' ms');
        } catch (e) {
          console.warn('  ✗ ' + s.id + ': ' + e.message);
        } finally { await ctx.close(); }
      }
      const mf = path.join(dir, 'manifest.json');
      const prev = fs.existsSync(mf) ? JSON.parse(fs.readFileSync(mf, 'utf8')) : {};
      fs.writeFileSync(mf, JSON.stringify(Object.assign(prev, manifest), null, 2));
      done[setName] = manifest;
    }
  } finally {
    await browser.close(); server.kill();
  }
  return done;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await captureAll();
}
