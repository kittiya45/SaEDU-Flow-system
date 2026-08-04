import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto('http://localhost:8765/manual.html', { waitUntil: 'networkidle' });
// เลือกบทบาท "เจ้าหน้าที่" (การ์ดที่ 3)
await p.click('.rp-card:nth-child(3)');
await p.click('#rpConfirmBtn'); await p.waitForTimeout(500);
const info = await p.evaluate(() => ({
  role: document.getElementById('roleBadgeLabel').textContent,
  visibleSections: [...document.querySelectorAll('section.section')].filter(s => s.offsetParent !== null).map(s => s.id),
  adminNavShown: getComputedStyle(document.querySelector('.nav-section[data-admin-section]')).display !== 'none',
  accent: getComputedStyle(document.documentElement).getPropertyValue('--orange-500').trim()
}));
await p.evaluate(() => { const el = document.getElementById('sys-admin'); window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 80, behavior: 'instant' }); });
await p.waitForTimeout(400);
const bc = await p.textContent('#bcCurrent');
await p.screenshot({ path: 'l-staff.png' });
console.log(JSON.stringify({ ...info, breadcrumbAtSysAdmin: bc.trim(), errors: errs }, null, 1));
await b.close();
