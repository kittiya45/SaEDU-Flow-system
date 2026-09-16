#!/usr/bin/env node
/* build-manual-docx.mjs — สร้างคู่มือผู้ใช้เป็นไฟล์ Word (.docx) แยกตามบทบาท จาก manual.html
 *
 *   npm run build:manual            → manual-docx/SAEDU-Flow-คู่มือ-{นิสิต กนค.,อาจารย์,เจ้าหน้าที่}.docx
 *   node scripts/build-manual-docx.mjs --role=staff --out=/tmp/x
 *
 * manual.html คือแหล่งเดียวของเนื้อหา — สคริปต์นี้เปิดหน้าใน Chromium (Playwright) เรียก applyRole(role)
 * ตัวเดียวกับที่ตัวเลือก "คุณเป็นใคร?" ใช้ แล้วเก็บเฉพาะ section/แถว/การ์ดที่บทบาทนั้นมองเห็น
 * (data-roles / .role-content) ออกมาเป็นโครงสร้างกลาง (heading / card / steps / table / callout ...)
 * ก่อนแปลงเป็น Word ด้วยไลบรารี docx — ไม่ได้แปลง HTML ตรง ๆ เพราะ Word อ่าน flex/grid ไม่ออก
 *
 * ฟอนต์: TH SarabunPSK 16pt (มาตรฐานหนังสือราชการ) — ฝังไฟล์ฟอนต์ตัวปกติลงใน .docx ด้วยถ้าหาเจอในเครื่อง
 * (Word for Mac มีให้ที่ /Applications/Microsoft Word.app/…/DFonts) เครื่องที่ไม่มีฟอนต์จึงยังแสดงผลถูกต้อง
 * ถ้าหาไม่เจอจะข้ามการฝังและเตือนใน log — Word จะใช้ฟอนต์ไทยที่มีแทน */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType,
  BorderStyle, ShadingType, AlignmentType, PageNumber, Header, Footer, InternalHyperlink, Bookmark,
  LevelFormat, VerticalAlign, TableLayoutType, PageOrientation, LineRuleType
} from 'docx';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(process.argv.slice(2).map(a => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const OUT_DIR = path.resolve(ROOT, args.out || 'manual-docx');
const ONLY = args.role ? String(args.role).split(',') : null;

const FONT = 'TH SarabunPSK';
const ROLES = {
  student: { label: 'นิสิต กนค.', accent: 'E83A00', dark: '8A1F00', tint: 'FFF6F1', tint2: 'FFE7DA',
             blurb: 'สร้างและส่งเอกสาร ติดตามสถานะ อนุมัติ/ลงนามตามตำแหน่ง' },
  teacher: { label: 'อาจารย์', accent: 'CA8A04', dark: '78350F', tint: 'FEFCE8', tint2: 'FEF9C3',
             blurb: 'ตรวจทาน อนุมัติ และลงนามเอกสารของนิสิตในฐานะอาจารย์ที่ปรึกษาชมรม' },
  staff:   { label: 'เจ้าหน้าที่', accent: 'EA580C', dark: '9A3412', tint: 'FFF7ED', tint2: 'FFEDD5',
             blurb: 'สร้างเอกสาร ออกเลขหนังสือ รับเอกสารส่งต่อ ดูรายงาน และจัดการผู้ใช้' },
};
const INK = { 900: '14110F', 700: '3A332E', 500: '6B6560', 400: '9A9490', 200: 'E5E0DB', 100: 'F1EDE9', 50: 'F8F5F2' };
const AL = {
  info: { fill: 'EFF6FF', bar: '2563EB' },
  warn: { fill: 'FFFBEB', bar: 'D97706' },
  ok:   { fill: 'ECFDF3', bar: '10A65A' },
  tip:  { fill: 'FFFBEB', bar: 'D97706' },
};
const PT = n => n * 2;                 // half-points
const BADGE = { 'b-gray': ['F1EDE9', '3A332E'], 'b-green': ['D1FADF', '0A7C42'], 'b-blue': ['DBEAFE', '1D4ED8'], 'b-orange': ['FFE7DA', '8A1F00'], 'b-amber': ['FEF3C7', '92400E'], 'b-red': ['FEE2E2', '991B1B'] };
const TEXT_W = 9354;                   // A4 210mm − ซ้าย 25mm − ขวา 20mm (DXA)
const NBSP = '\u00A0';

/* ───────────────────────── 1. ดึงโครงสร้างจาก manual.html ───────────────────────── */
export async function extractAll(roles) {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('pageerror', e => console.warn('  [page error]', e.message));
  await page.goto('file://' + path.join(ROOT, 'manual.html'), { waitUntil: 'load' });
  const out = {};
  for (const role of roles || Object.keys(ROLES)) {
    if (ONLY && !ONLY.includes(role)) continue;
    out[role] = await page.evaluate(extractInPage, role);
  }
  await browser.close();
  return out;
}

/* ทำงานใน browser — ต้องเป็นฟังก์ชันที่ serialize ได้ (ห้ามอ้างตัวแปรนอก) */
function extractInPage(role) {
  const ALL = role === 'all';
  if (!ALL) applyRole(role);
  const hidden = el => !ALL && (el.classList.contains('section-hidden') ||
    (el.classList.contains('role-content') && !el.classList.contains('rc-show')));
  const roleTag = el => { if (!ALL || !el.getAttribute) return null; const r = el.getAttribute('data-roles'); if (!r) return null; const list = r.split(' ').filter(Boolean); return list.length >= 3 ? null : list; };
  const clean = t => t.replace(/\s+/g, ' ');

  function runs(node, st) {
    st = st || {};
    const out = [];
    node.childNodes.forEach(ch => {
      if (ch.nodeType === 3) { const t = clean(ch.nodeValue); if (t) out.push(Object.assign({ text: t }, st)); return; }
      if (ch.nodeType !== 1) return;
      const tag = ch.tagName.toLowerCase(), cl = ch.classList;
      if (tag === 'svg' || tag === 'script' || tag === 'style') return;
      if (hidden(ch)) return;
      if (tag === 'br') { out.push({ br: true }); return; }
      if (cl.contains('dot')) return;
      if (cl.contains('badge')) { const t = clean(ch.textContent).trim(); const bc = [...cl].find(c => /^b-/.test(c)) || ''; if (t) out.push(Object.assign({ text: t, badge: true, bc }, st)); return; }
      if (tag === 'strong' || tag === 'b') { out.push(...runs(ch, Object.assign({}, st, { b: true }))); return; }
      if (tag === 'em' || tag === 'i') { out.push(...runs(ch, Object.assign({}, st, { i: true }))); return; }
      if (tag === 'code' || tag === 'kbd') { out.push(...runs(ch, Object.assign({}, st, { code: true }))); return; }
      if (tag === 'small') { out.push(Object.assign({ text: ' (' }, st), ...runs(ch, Object.assign({}, st, { small: true })), Object.assign({ text: ')' }, st)); return; }
      out.push(...runs(ch, st));
    });
    return out;
  }
  function cellRuns(td) {
    if (td.classList.contains('perm-yes')) return [{ text: '✓', b: true, color: '0A7C42' }];
    if (td.classList.contains('perm-no')) return [{ text: '—', color: '9A9490' }];
    return runs(td);
  }
  const isBlockTag = t => /^(div|p|ul|ol|table|h[1-6]|section|pre)$/i.test(t);

  function blocks(el, opt) {
    opt = opt || {};
    const out = [];
    if (!el) return out;
    el.childNodes.forEach(ch => {
      const before = out.length;
      emit(ch);
      const tag = ch.nodeType === 1 ? roleTag(ch) : null;
      if (tag) for (let i = before; i < out.length; i++) if (!out[i].roles) out[i].roles = tag;
    });
    return out;
    function emit(ch) {
      if (ch.nodeType === 3) { const t = clean(ch.nodeValue).trim(); if (t) out.push({ t: 'p', runs: [{ text: t }] }); return; }
      if (ch.nodeType !== 1) return;
      if (hidden(ch)) return;
      const tag = ch.tagName.toLowerCase(), cl = ch.classList;
      if (tag === 'svg' || tag === 'script' || tag === 'style') return;
      if (cl.contains('back-top') || cl.contains('footer')) return;
      if (cl.contains('section-header')) {
        const h = ch.querySelector('h2'), p = ch.querySelector('p');
        out.push({ t: 'h1', text: h ? clean(h.textContent).trim() : '', sub: p ? runs(p) : [] }); return;
      }
      if (cl.contains('card')) {
        const head = ch.querySelector(':scope > .card-head'), body = ch.querySelector(':scope > .card-body');
        out.push({ t: 'card', title: head ? clean(head.textContent).trim() : '', blocks: blocks(body || ch, body ? {} : { skipHead: true }) }); return;
      }
      if (cl.contains('card-head') && opt.skipHead) return;
      if (tag === 'h4' && opt.skipH4) return;
      if (tag === 'p') { out.push({ t: 'p', runs: runs(ch) }); return; }
      if (/^h[3-6]$/.test(tag)) { out.push({ t: 'h3', text: clean(ch.textContent).trim() }); return; }
      if (tag === 'ul' || tag === 'ol') {
        out.push({ t: tag, items: [...ch.children].filter(li => !hidden(li)).map(li => runs(li)) }); return;
      }
      if (tag === 'table') {
        const rows = [];
        ch.querySelectorAll('tr').forEach(tr => {
          if (hidden(tr)) return;
          const gray = /background/.test(tr.getAttribute('style') || '') || tr.classList.contains('row-muted');
          rows.push({
            head: tr.parentElement && tr.parentElement.tagName === 'THEAD',
            gray,
            cells: [...tr.children].map(td => ({
              runs: cellRuns(td),
              center: /text-align\s*:\s*center/.test(td.getAttribute('style') || '') || td.classList.contains('perm-yes') || td.classList.contains('perm-no'),
              th: td.tagName === 'TH'
            }))
          });
        });
        out.push({ t: 'table', rows }); return;
      }
      if (cl.contains('al')) {
        out.push({ t: 'al', kind: cl.contains('al-warn') ? 'warn' : cl.contains('al-ok') ? 'ok' : 'info', runs: runs(ch) }); return;
      }
      if (cl.contains('tip')) { out.push({ t: 'al', kind: 'tip', runs: runs(ch) }); return; }
      if (cl.contains('flow-rejected')) { out.push({ t: 'al', kind: 'warn', runs: runs(ch) }); return; }
      if (cl.contains('steps')) {
        out.push({
          t: 'steps', items: [...ch.querySelectorAll(':scope > .step')].map(s => {
            const num = s.querySelector('.step-num'), h = s.querySelector('h4'), c = s.querySelector('.step-content');
            return { num: num ? clean(num.textContent).trim() : '', title: h ? clean(h.textContent).trim() : '', blocks: blocks(c || s, { skipH4: true }) };
          })
        }); return;
      }
      if (cl.contains('flow')) {
        const steps = [...ch.querySelectorAll(':scope > .flow-step')].map(fs => {
          const d = [...fs.children].find(x => !x.classList.contains('flow-icon'));
          let label = '', small = '';
          if (d) {
            d.childNodes.forEach(n => { if (n.nodeType === 3) label += n.nodeValue; });
            const sm = d.querySelector('small'); if (sm) small = clean(sm.textContent).trim();
          }
          return { label: clean(label).trim(), small, kind: fs.classList.contains('done') ? 'done' : fs.classList.contains('active') ? 'active' : '' };
        });
        out.push({ t: 'flow', steps }); return;
      }
      if (cl.contains('role-grid')) {
        out.push({
          t: 'roles', cards: [...ch.children].filter(c => !hidden(c)).map(c => ({
            name: clean((c.querySelector('.role-name') || {}).textContent || '').trim(),
            perms: [...c.querySelectorAll('.role-perm .badge')].map(b => ({ text: clean(b.textContent).trim(), bc: [...b.classList].find(x => /^b-/.test(x)) || '' })),
            reg: runs(c.querySelector('.role-reg span') || c.querySelector('.role-reg') || c)
          }))
        }); return;
      }
      if (cl.contains('faq-item')) {
        out.push({ t: 'faq', q: clean((ch.querySelector('.faq-q-text') || {}).textContent || '').trim(), blocks: blocks(ch.querySelector('.faq-a')) }); return;
      }
      if (cl.contains('file-tags')) {
        out.push({ t: 'p', runs: [...ch.querySelectorAll('.file-tag')].flatMap((x, i) => [{ text: (i ? '   ' : '') + clean(x.textContent).trim(), badge: true }]) }); return;
      }
      if (isBlockTag(tag) || tag === 'span' || tag === 'a') {
        const hasBlock = [...ch.children].some(c => isBlockTag(c.tagName) || c.classList.contains('al') || c.classList.contains('tip') || c.classList.contains('steps') || c.classList.contains('flow'));
        if (!hasBlock) { const r = runs(ch); if (r.some(x => x.text && x.text.trim())) out.push({ t: 'p', runs: r }); return; }
        out.push(...blocks(ch, opt)); return;
      }
      out.push(...blocks(ch, opt));
    }
  }

  const sections = [];
  document.querySelectorAll('.content > section.section').forEach(sec => {
    if (hidden(sec)) return;
    sections.push({ id: sec.id, blocks: blocks(sec), roles: roleTag(sec) });
  });
  const hero = document.querySelector('.hero p');
  const ver = document.querySelector('.hero-version');
  return { sections, tagline: hero ? clean(hero.textContent).trim() : '', version: ver ? clean(ver.textContent).trim() : '' };
}

/* ───────────────────────── 2. แปลงโครงสร้างเป็น Word ───────────────────────── */
function findFont() {
  const cands = [
    '/Applications/Microsoft Word.app/Contents/Resources/DFonts/thsarabun.ttf',
    path.join(os.homedir(), 'Library/Fonts/THSarabun.ttf'),
    '/Library/Fonts/THSarabun.ttf',
    'C:/Windows/Fonts/THSarabun.ttf',
  ];
  for (const p of cands) if (fs.existsSync(p)) return p;
  return null;
}

function norm(runs) {
  // ตัดช่องว่างหัว/ท้าย + รวม run ที่สไตล์เหมือนกัน
  const r = runs.filter(x => x.br || (x.text && x.text.length));
  if (r.length && r[0].text) r[0].text = r[0].text.replace(/^\s+/, '');
  if (r.length && r[r.length - 1].text) r[r.length - 1].text = r[r.length - 1].text.replace(/\s+$/, '');
  const out = [];
  for (const x of r) {
    const last = out[out.length - 1];
    if (last && !x.br && !last.br && !x.badge && !last.badge && last.b === x.b && last.i === x.i && last.code === x.code && last.small === x.small && last.color === x.color) last.text += x.text;
    else out.push(Object.assign({}, x));
  }
  return out.filter(x => x.br || x.text);
}

function mkRuns(runs, base) {
  base = base || {};
  return norm(runs).map(x => {
    if (x.br) return new TextRun({ break: 1 });
    const o = Object.assign({}, base, { text: x.text });
    if (x.b) o.bold = true;
    if (x.i) o.italics = true;
    if (x.color) o.color = x.color;
    if (x.small) { o.size = PT(13); o.color = o.color || INK[500]; }
    if (x.code) { o.font = 'Consolas'; o.size = (base.size || PT(16)) - PT(3); o.shading = { type: ShadingType.CLEAR, fill: INK[100], color: 'auto' }; o.color = x.color || '8A1F00'; }
    if (x.badge) { const bc = BADGE[x.bc] || BADGE['b-gray']; o.text = NBSP + x.text + NBSP; o.size = PT(13); o.bold = true; o.shading = { type: ShadingType.CLEAR, fill: bc[0], color: 'auto' }; o.color = bc[1]; }
    return new TextRun(o);
  });
}

const noBorder = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const NO_BORDERS = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder, insideHorizontal: noBorder, insideVertical: noBorder };
const thin = { style: BorderStyle.SINGLE, size: 4, color: INK[200] };

function para(runs, opt) {
  opt = opt || {};
  if (opt.spacing && opt.spacing.line && !opt.spacing.lineRule) opt.spacing.lineRule = LineRuleType.AUTO;
  return new Paragraph(Object.assign({ children: runs, spacing: { after: 100, line: 276, lineRule: LineRuleType.AUTO } }, opt));
}

class Builder {
  constructor(theme) { this.theme = theme; this.listSeq = 0; this.children = []; this.secNo = 0; }
  push(...x) { this.children.push(...x); }

  block(b, ctx) {
    ctx = ctx || {};
    switch (b.t) {
      case 'h1': return this.heading1(b);
      case 'card': return this.card(b, ctx);
      case 'p': return this.push(para(mkRuns(b.runs), { indent: ctx.indent ? { left: ctx.indent } : undefined }));
      case 'h3': return this.push(new Paragraph({ children: [new TextRun({ text: b.text, bold: true, size: PT(17), color: INK[900] })], spacing: { before: 140, after: 60 }, keepNext: true, indent: ctx.indent ? { left: ctx.indent } : undefined }));
      case 'ul': case 'ol': return this.list(b, ctx);
      case 'table': return this.table(b);
      case 'al': return this.callout(b);
      case 'steps': return this.steps(b);
      case 'flow': return this.flow(b);
      case 'roles': return this.roles(b);
      case 'faq': return this.faq(b);
      default: console.warn('  unknown block', b.t);
    }
  }
  blocks(list, ctx) { for (const b of list) this.block(b, ctx); }

  heading1(b) {
    this.secNo++;
    const id = 'sec-' + this.secNo;
    b.anchor = id;
    this.push(new Paragraph({
      heading: HeadingLevel.HEADING_1, pageBreakBefore: this.secNo > 1,
      children: [new Bookmark({ id, children: [new TextRun({ text: this.secNo + '.' + NBSP + b.text })] })],
    }));
    if (b.sub && b.sub.length) this.push(para(mkRuns(b.sub, { color: INK[500], size: PT(15) }), { spacing: { after: 200 } }));
  }
  card(b, ctx) {
    if (b.title) this.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: b.title })] }));
    this.blocks(b.blocks, ctx);
    this.push(new Paragraph({ spacing: { after: 60 }, children: [] }));
  }
  list(b, ctx) {
    const ref = b.t === 'ol' ? 'decimal' : 'bullets';
    const inst = ++this.listSeq;
    for (const item of b.items) {
      this.push(new Paragraph({
        children: mkRuns(item),
        numbering: { reference: ref, level: 0, instance: inst },
        spacing: { after: 60, line: 276, lineRule: LineRuleType.AUTO },
        indent: ctx.indent ? { left: ctx.indent + 480, hanging: 300 } : undefined,
      }));
    }
    this.push(new Paragraph({ spacing: { after: 40 }, children: [] }));
  }
  table(b) {
    const rows = b.rows.filter(r => r.cells.length);
    if (!rows.length) return;
    const ncol = Math.max(...rows.map(r => r.cells.length));
    // ความกว้างคอลัมน์จากความยาวข้อความ (ขั้นต่ำ 11%)
    const len = new Array(ncol).fill(0);
    rows.forEach(r => r.cells.forEach((c, i) => { const l = c.runs.map(x => x.text || '').join('').length; len[i] = Math.max(len[i], Math.min(l, 60)); }));
    const raw = len.map(l => Math.max(l, 8));
    const sum = raw.reduce((a, c) => a + c, 0);
    let w = raw.map(x => Math.max(0.11, x / sum));
    const s2 = w.reduce((a, c) => a + c, 0); w = w.map(x => Math.round(x / s2 * TEXT_W));
    const trs = rows.map(r => new TableRow({
      tableHeader: r.head, cantSplit: true,
      children: r.cells.map((c, i) => new TableCell({
        width: { size: w[i], type: WidthType.DXA },
        shading: r.head ? { type: ShadingType.CLEAR, fill: INK[100], color: 'auto' } : r.gray ? { type: ShadingType.CLEAR, fill: INK[50], color: 'auto' } : undefined,
        margins: { top: 70, bottom: 70, left: 110, right: 110 },
        verticalAlign: VerticalAlign.CENTER,
        children: [new Paragraph({
          children: mkRuns(c.runs, r.head ? { bold: true, size: PT(15), color: INK[700] } : { size: PT(15) }),
          alignment: c.center ? AlignmentType.CENTER : AlignmentType.LEFT,
          spacing: { after: 0, line: 260, lineRule: LineRuleType.AUTO },
        })],
      })),
    }));
    this.push(new Table({
      rows: trs, width: { size: TEXT_W, type: WidthType.DXA }, columnWidths: w, layout: TableLayoutType.FIXED,
      borders: { top: thin, bottom: thin, left: thin, right: thin, insideHorizontal: thin, insideVertical: thin },
    }));
    this.push(new Paragraph({ spacing: { after: 80 }, children: [] }));
  }
  callout(b) {
    const c = AL[b.kind] || AL.info;
    const bar = { style: BorderStyle.SINGLE, size: 24, color: c.bar };
    this.push(new Table({
      rows: [new TableRow({
        cantSplit: true,
        children: [new TableCell({
          width: { size: TEXT_W, type: WidthType.DXA },
          shading: { type: ShadingType.CLEAR, fill: c.fill, color: 'auto' },
          margins: { top: 110, bottom: 110, left: 180, right: 160 },
          borders: { top: noBorder, bottom: noBorder, right: noBorder, left: bar },
          children: [para(mkRuns(b.runs, { size: PT(15) }), { spacing: { after: 0, line: 276 } })],
        })],
      })],
      width: { size: TEXT_W, type: WidthType.DXA }, columnWidths: [TEXT_W], layout: TableLayoutType.FIXED,
      borders: NO_BORDERS,
    }));
    this.push(new Paragraph({ spacing: { after: 100 }, children: [] }));
  }
  steps(b) {
    const NUM_W = 640;
    const rows = b.items.map(it => {
      const sub = new Builder(this.theme);
      sub.blocks(it.blocks, {});
      const body = [new Paragraph({ children: [new TextRun({ text: it.title, bold: true, size: PT(16), color: INK[900] })], spacing: { after: 40 }, keepNext: true }), ...sub.children];
      // ตัดย่อหน้าว่างท้ายเซลล์
      while (body.length > 1 && body[body.length - 1] instanceof Paragraph && !body[body.length - 1].root.some(x => x.rootKey === 'w:r')) body.pop();
      return new TableRow({
        cantSplit: true,
        children: [
          new TableCell({
            width: { size: NUM_W, type: WidthType.DXA }, verticalAlign: VerticalAlign.TOP,
            margins: { top: 60, bottom: 60, left: 60, right: 60 },
            children: [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0 }, children: [new TextRun({ text: NBSP + it.num + NBSP, bold: true, color: 'FFFFFF', size: PT(14), shading: { type: ShadingType.CLEAR, fill: this.theme.accent, color: 'auto' } })] })],
          }),
          new TableCell({ width: { size: TEXT_W - NUM_W, type: WidthType.DXA }, margins: { top: 60, bottom: 100, left: 80, right: 80 }, children: body }),
        ],
      });
    });
    this.push(new Table({ rows, width: { size: TEXT_W, type: WidthType.DXA }, columnWidths: [NUM_W, TEXT_W - NUM_W], layout: TableLayoutType.FIXED, borders: NO_BORDERS }));
    this.push(new Paragraph({ spacing: { after: 60 }, children: [] }));
  }
  flow(b) {
    const runs = [new TextRun({ text: 'ลำดับสถานะ:' + NBSP, bold: true, color: INK[500], size: PT(15) })];
    b.steps.forEach((s, i) => {
      if (i) runs.push(new TextRun({ text: NBSP + '→' + NBSP, color: this.theme.accent, bold: true }));
      runs.push(new TextRun({ text: s.label, bold: true, color: s.kind === 'done' ? '0A7C42' : s.kind === 'active' ? this.theme.dark : INK[700] }));
      if (s.small) runs.push(new TextRun({ text: ' (' + s.small + ')', size: PT(13), color: INK[500] }));
    });
    this.push(para(runs, { spacing: { after: 120, line: 300 } }));
  }
  roles(b) {
    for (const c of b.cards) {
      this.push(new Paragraph({ children: [new TextRun({ text: c.name, bold: true, size: PT(17), color: this.theme.dark })], spacing: { before: 120, after: 40 }, keepNext: true }));
      if (c.perms.length) this.push(para([new TextRun({ text: 'สิทธิ์:' + NBSP, color: INK[500], size: PT(15) }), ...mkRuns(c.perms.flatMap(p => [{ text: p.text, badge: true, bc: p.bc }, { text: '  ' }]))], { spacing: { after: 40 } }));
      this.push(para([new TextRun({ text: 'ได้มาอย่างไร:' + NBSP, color: INK[500], size: PT(15) }), ...mkRuns(c.reg)], { spacing: { after: 120 } }));
    }
  }
  faq(b) {
    this.push(new Paragraph({ children: [new TextRun({ text: 'ถาม:' + NBSP, bold: true, color: this.theme.accent }), new TextRun({ text: b.q, bold: true, color: INK[900] })], spacing: { before: 160, after: 60 }, keepNext: true }));
    const sub = new Builder(this.theme);
    sub.blocks(b.blocks, { indent: 500 });
    this.push(...sub.children);
  }
}

function buildDoc(role, data, fontBuf) {
  const th = ROLES[role];
  const title = 'คู่มือการใช้งาน SAEDU Flow';
  const sub = 'สำหรับ' + th.label;
  const b = new Builder(th);
  for (const sec of data.sections) b.blocks(sec.blocks, {});

  // สารบัญ — ลิงก์ภายในไปยัง bookmark ของแต่ละหัวข้อ (ไม่ใช้ TOC field เพื่อไม่ให้ Word ถามอัปเดตฟิลด์ตอนเปิด)
  const h1s = data.sections.flatMap(s => s.blocks.filter(x => x.t === 'h1'));
  const toc = [
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: 'สารบัญ' })] }),
    new Paragraph({ children: [new TextRun({ text: 'คลิกที่หัวข้อเพื่อไปยังหน้านั้น (ใน Word ใช้แถบนำทาง Navigation Pane ได้ด้วย)', color: INK[500], size: PT(14) })], spacing: { after: 160 } }),
    ...h1s.map((h, i) => new Paragraph({
      children: [new InternalHyperlink({ anchor: h.anchor, children: [new TextRun({ text: (i + 1) + '.' + NBSP + h.text, style: 'Hyperlink' })] })],
      spacing: { after: 70, line: 276, lineRule: LineRuleType.AUTO }, indent: { left: 200 },
    })),
  ];

  const cover = [
    new Paragraph({ spacing: { before: 2600 }, children: [] }),
    new Table({
      rows: [new TableRow({ children: [new TableCell({ width: { size: 2200, type: WidthType.DXA }, shading: { type: ShadingType.CLEAR, fill: th.accent, color: 'auto' }, margins: { top: 40, bottom: 40 }, children: [new Paragraph({ children: [] })] })] })],
      width: { size: 2200, type: WidthType.DXA }, columnWidths: [2200], layout: TableLayoutType.FIXED, borders: NO_BORDERS,
    }),
    new Paragraph({ spacing: { before: 360, after: 120, line: 276, lineRule: LineRuleType.AUTO }, children: [new TextRun({ text: title, bold: true, size: PT(40), color: INK[900] })] }),
    new Paragraph({ spacing: { after: 240, line: 276, lineRule: LineRuleType.AUTO }, children: [new TextRun({ text: sub, bold: true, size: PT(30), color: th.accent })] }),
    new Paragraph({ spacing: { after: 100, line: 300 }, children: [new TextRun({ text: th.blurb, size: PT(18), color: INK[700] })] }),
    new Paragraph({ spacing: { after: 100, line: 300 }, children: [new TextRun({ text: data.tagline, size: PT(16), color: INK[500] })] }),
    new Paragraph({ spacing: { before: 600 }, children: [new TextRun({ text: 'ระบบเสนอเอกสารอิเล็กทรอนิกส์ คณะกรรมการนิสิต (กนค.)', size: PT(15), color: INK[500] })] }),
    new Paragraph({ children: [new TextRun({ text: data.version, size: PT(15), color: INK[500] })] }),
    new Paragraph({ children: [new TextRun({ text: 'สร้างจากคู่มือออนไลน์ (manual.html) เมื่อ ' + thaiDate(new Date()), size: PT(13), color: INK[400] })] }),
  ];

  const hdr = t => new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: INK[200], space: 4 } }, children: [new TextRun({ text: t, size: PT(12), color: INK[500] })] })] });
  const ftr = new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'หน้า ', size: PT(12), color: INK[500] }), new TextRun({ children: [PageNumber.CURRENT], size: PT(12), color: INK[500] }), new TextRun({ text: ' / ', size: PT(12), color: INK[500] }), new TextRun({ children: [PageNumber.TOTAL_PAGES_IN_SECTION], size: PT(12), color: INK[500] })] })] });

  const pageProps = { size: { orientation: PageOrientation.PORTRAIT, width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1417, right: 1134 } };
  const runDefaults = { font: FONT, size: PT(16), color: INK[900], language: { value: 'en-US', bidirectional: 'th-TH' } };

  return new Document({
    creator: 'SAEDU Flow', title: title + ' — ' + sub, description: th.blurb, language: 'th-TH',
    fonts: fontBuf ? [{ name: FONT, data: fontBuf }] : undefined,
    styles: {
      default: { document: { run: runDefaults, paragraph: { spacing: { line: 276, lineRule: LineRuleType.AUTO } } } },
      paragraphStyles: [
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: PT(26), bold: true, color: th.accent }, paragraph: { spacing: { before: 0, after: 80 }, keepNext: true, outlineLevel: 0 } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: PT(19), bold: true, color: INK[900] }, paragraph: { spacing: { before: 260, after: 80 }, keepNext: true, outlineLevel: 1, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: th.tint2, space: 2 } } } },
      ],
      characterStyles: [{ id: 'Hyperlink', name: 'Hyperlink', run: { color: '1D4ED8', underline: {} } }],
    },
    numbering: {
      config: [
        { reference: 'bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 560, hanging: 300 } }, run: { color: th.accent, bold: true } } }] },
        { reference: 'decimal', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 560, hanging: 300 } }, run: { color: th.accent, bold: true } } }] },
      ],
    },
    sections: [
      { properties: { page: pageProps }, children: cover },
      { properties: { page: Object.assign({}, pageProps, { pageNumbers: { start: 1 } }) }, headers: { default: hdr(title + NBSP + '·' + NBSP + sub) }, footers: { default: ftr }, children: [...toc, ...b.children] },
    ],
  });
}

function thaiDate(d) {
  const M = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
  return d.getDate() + ' ' + M[d.getMonth()] + ' ' + (d.getFullYear() + 543);
}

/* ───────────────────────── 3. main ───────────────────────── */
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) await main();
async function main() {
const fontPath = findFont();
const fontBuf = fontPath ? fs.readFileSync(fontPath) : null;
console.log(fontPath ? 'ฝังฟอนต์ ' + FONT + ' จาก ' + fontPath : '⚠ ไม่พบไฟล์ฟอนต์ ' + FONT + ' — จะไม่ฝังฟอนต์ (Word จะใช้ฟอนต์ไทยที่มีในเครื่องแทน)');
const data = await extractAll();
fs.mkdirSync(OUT_DIR, { recursive: true });
for (const role of Object.keys(data)) {
  const d = data[role];
  const nSec = d.sections.length, nBlocks = d.sections.reduce((a, s) => a + s.blocks.length, 0);
  const doc = buildDoc(role, d, fontBuf);
  const buf = await Packer.toBuffer(doc);
  const file = path.join(OUT_DIR, 'SAEDU-Flow-คู่มือ-' + ROLES[role].label.replace(/\s+/g, '-').replace(/\.+$/, '') + '.docx');
  fs.writeFileSync(file, buf);
  console.log('✓ ' + path.relative(ROOT, file) + '  (' + nSec + ' หัวข้อ, ' + nBlocks + ' บล็อก, ' + (buf.length / 1024).toFixed(0) + ' KB)');
}
}
