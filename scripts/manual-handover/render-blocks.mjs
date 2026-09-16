/* render-blocks.mjs — แปลง block model จาก manual.html (extractAll ใน scripts/build-manual-docx.mjs) เป็น docx
   ใช้ร่วมกันโดย build-user-manual.mjs (คู่มือทั้งหัวข้อ) และ build-detailed-manual.mjs (ภาคผนวกตารางอ้างอิง/FAQ) */
import { run, P, empty, table, calloutBox, GRAY, PT, NBSP, AUTO, BLUE } from './style.mjs';

const ROLE_TH = { student: 'นิสิต กนค.', teacher: 'อาจารย์', staff: 'เจ้าหน้าที่ / ผู้ดูแลระบบ' };
export const roleLine = roles => roles ? [P(run('เฉพาะ: ' + roles.map(r => ROLE_TH[r] || r).join(' · '), { italics: true, color: GRAY, size: PT(14) }), { spacing: { after: 40 }, keepNext: true })] : [];

export function norm(runs) {
  const r = (runs || []).filter(x => x.br || (x.text && x.text.length));
  if (r.length && r[0].text) r[0].text = r[0].text.replace(/^\s+/, '');
  if (r.length && r[r.length - 1].text) r[r.length - 1].text = r[r.length - 1].text.replace(/\s+$/, '');
  const out = [];
  for (const x of r) { const l = out[out.length - 1]; if (l && !x.br && !l.br && !x.badge && !l.badge && l.b === x.b && l.i === x.i && l.code === x.code && l.small === x.small) l.text += x.text; else out.push(Object.assign({}, x)); }
  return out.filter(x => x.br || x.text);
}
export function mkRuns(runs, base) {
  base = base || {};
  return norm(runs).map(x => {
    if (x.br) return run('', { break: 1 });
    const o = Object.assign({}, base, { text: x.text });
    if (x.b) o.bold = true; if (x.i) o.italics = true;
    if (x.small) { o.size = PT(13); o.color = GRAY; }
    if (x.code) { o.font = 'Consolas'; o.size = PT(12); }
    if (x.badge) { o.text = '[' + x.text + ']'; o.size = PT(14); o.color = x.bc === 'b-green' ? '2E8B57' : x.bc === 'b-red' ? 'C00000' : x.bc === 'b-blue' ? BLUE : x.bc === 'b-orange' || x.bc === 'b-amber' ? 'B45309' : GRAY; }
    return run(o.text, o);
  });
}
export class R {
  constructor(c) { this.c = c; this.out = []; }
  push(...x) { x.flat(Infinity).forEach(el => this.out.push(el)); }
  blocks(list, ctx) { for (const b of list) this.block(b, ctx || {}); }
  block(b, ctx) {
    if (b.roles && b.t !== 'h1') this.push(roleLine(b.roles));
    switch (b.t) {
      case 'h1': return; // จัดการที่ระดับ section
      case 'card': if (b.title) this.push(this.c.heading(2, b.title)); return this.blocks(b.blocks, ctx);
      case 'p': return this.push(P(mkRuns(b.runs), { indent: ctx.indent ? { left: ctx.indent } : undefined }));
      case 'h3': return this.push(this.c.heading(3, b.text));
      case 'ul': case 'ol': return this.push(this.c.bullets(b.items.map(it => mkRuns(it)), b.t === 'ol' ? 'decimal' : 'bullets'));
      case 'table': {
        const rows = b.rows.filter(r => r.cells.length); if (!rows.length) return;
        const ncol = Math.max(...rows.map(r => r.cells.length));
        const len = new Array(ncol).fill(8); rows.forEach(r => r.cells.forEach((cell, i) => { len[i] = Math.max(len[i], Math.min(60, cell.runs.map(x => x.text || '').join('').length)); }));
        const sum = len.reduce((a, x) => a + x, 0); const widths = len.map(x => Math.max(0.11, x / sum)); const s2 = widths.reduce((a, x) => a + x, 0);
        const data = rows.map(r => r.cells.map(cell => mkRuns(cell.runs, { size: PT(14), bold: r.head })));
        return this.push(table(data, { widths: widths.map(x => x / s2), noHead: !rows[0].head, size: 14, center: rows[0].cells.map((cell, i) => cell.center ? i : -1).filter(i => i >= 0) }));
      }
      case 'al': { const kind = b.kind === 'warn' ? 'warn' : b.kind === 'ok' ? 'ok' : b.kind === 'tip' ? 'note' : 'info'; return this.push(calloutBox(mkRuns(b.runs, { size: PT(15) }), kind)); }
      case 'steps': {
        const items = b.items.map(it => [run(it.title, { bold: true })]);
        const inst = ++this.c.listSeq;
        b.items.forEach((it, i) => {
          this.push(P([run(it.title, { bold: true })], { numbering: { reference: 'decimal', level: 0, instance: inst }, spacing: { after: 30, line: 276, lineRule: AUTO }, keepNext: true }));
          const sub = new R(this.c); sub.blocks(it.blocks, { indent: 640 }); this.push(sub.out);
        });
        return this.push(empty(60));
      }
      case 'flow': {
        const runs = [run('ลำดับสถานะ:' + NBSP, { bold: true, color: GRAY, size: PT(15) })];
        b.steps.forEach((s, i) => { if (i) runs.push(run(NBSP + '→' + NBSP, { bold: true, color: BLUE })); runs.push(run(s.label, { bold: true })); if (s.small) runs.push(run(' (' + s.small + ')', { size: PT(13), color: GRAY })); });
        return this.push(P(runs, { spacing: { after: 120, line: 300, lineRule: AUTO } }));
      }
      case 'roles': return b.cards.forEach(cd => {
        this.push(this.c.heading(3, cd.name));
        if (cd.perms.length) this.push(P([run('สิทธิ์:' + NBSP, { bold: true }), ...mkRuns(cd.perms.flatMap(p => [{ text: p.text, badge: true, bc: p.bc }, { text: ' ' }]))]));
        this.push(P([run('ได้มาอย่างไร:' + NBSP, { bold: true }), ...mkRuns(cd.reg)]));
      });
      case 'faq': {
        this.push(P([run('ถาม:' + NBSP, { bold: true, color: BLUE }), run(b.q, { bold: true })], { spacing: { before: 160, after: 60 }, keepNext: true }));
        const sub = new R(this.c); sub.blocks(b.blocks, { indent: 500 }); return this.push(sub.out);
      }
      default: console.warn('unknown block', b.t);
    }
  }
}

