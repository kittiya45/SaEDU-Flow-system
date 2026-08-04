import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type()==='error') errs.push(m.text()); });
await p.goto('http://localhost:8765/manual.html', { waitUntil: 'networkidle' });
await p.click('.rp-card'); await p.click('#rpConfirmBtn'); await p.waitForTimeout(400);
// ทดสอบค้นหาในเมนู
await p.fill('#navSearch', 'อ้างอิง');
await p.waitForTimeout(250);
const searchHits = await p.evaluate(() => [...document.querySelectorAll('#sidebarNav .nav-item')].filter(n => n.style.display !== 'none').map(n => n.textContent.trim()));
await p.fill('#navSearch', '');
// ทดสอบพิมพ์ (emulate print media)
await p.emulateMedia({ media: 'print' });
const printOk = await p.evaluate(() => ({
  sidebar: getComputedStyle(document.querySelector('.sidebar')).display,
  backTop: getComputedStyle(document.getElementById('backTop')).display
}));
await p.emulateMedia({ media: 'screen' });
console.log(JSON.stringify({ searchHits, printOk, errors: errs }, null, 1));
await b.close();
