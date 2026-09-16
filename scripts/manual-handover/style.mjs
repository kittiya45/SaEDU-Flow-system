/* style.mjs — สไตล์และตัวช่วยสร้าง .docx ร่วมกันของเอกสารส่งมอบทุกเล่ม
   (เลียนแบบเอกสาร EDUSAPS: ปกเรียบ หัวข้อสีน้ำเงิน TH SarabunPSK 16pt ตารางเส้นบาง หัวกระดาษ/เลขหน้า) */
import fs from 'node:fs';
import path from 'node:path';
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType,
  AlignmentType, PageNumber, Header, Footer, ImageRun, LevelFormat, VerticalAlign, TableLayoutType, LineRuleType, TableOfContents, PageBreak,
} from 'docx';

export const FONT = 'TH SarabunPSK', MONO = 'Consolas';
export const PT = n => n * 2;
export const BLUE = '2E74B5', DARK = '1F3864', INK = '111111', GRAY = '595959', LIGHT = 'BFBFBF', HEAD_BLUE = 'DEEAF6', HEAD_GRAY = 'E7E6E6', CODE_BG = 'F2F2F2';
export const TEXT_W = 9354; // A4 − ซ้าย 25 มม. − ขวา 20 มม. (DXA)
export const NBSP = '\u00A0';
export const AUTO = LineRuleType.AUTO;

const thin = { style: BorderStyle.SINGLE, size: 4, color: LIGHT };
export const BORDERS = { top: thin, bottom: thin, left: thin, right: thin, insideHorizontal: thin, insideVertical: thin };
const none = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
export const NO_BORDERS = { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none };

export const run = (text, o) => new TextRun(Object.assign({ text }, o || {}));
export const P = (children, o) => new Paragraph(Object.assign({ children: Array.isArray(children) ? children : [children], spacing: { after: 100, line: 276, lineRule: AUTO } }, o || {}));
export const text = (t, o) => P(run(t, o && o.run), o);
export const empty = (after) => new Paragraph({ spacing: { after: after || 60 }, children: [] });
export const labelLine = (label, value, o) => P([run(label + ':' + NBSP, { bold: true }), ...(Array.isArray(value) ? value : [run(value)])], Object.assign({ spacing: { after: 60, line: 276, lineRule: AUTO } }, o || {}));
export const boldLine = t => P(run(t, { bold: true }), { spacing: { before: 60, after: 40 }, keepNext: true });
export const pageBreak = () => new Paragraph({ children: [new PageBreak()] });

/* แต่ละเอกสารมีตัวเก็บสารบัญของตัวเอง */
export function makeCtx() {
  const ctx = { toc: [], listSeq: 0 };
  ctx.heading = (level, t, opts) => {
    ctx.toc.push({ title: t, level });
    return new Paragraph(Object.assign({ heading: [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3][level - 1], children: [run(t)] }, opts || {}));
  };
  ctx.bullets = (items, ref) => {
    const inst = ++ctx.listSeq;
    return items.map(it => new Paragraph({ children: typeof it === 'string' ? [run(it)] : it, numbering: { reference: ref || 'bullets', level: 0, instance: inst }, spacing: { after: 50, line: 276, lineRule: AUTO } }));
  };
  return ctx;
}

export function table(rows, opt) {
  opt = opt || {};
  const ncol = rows[0].length;
  const w = opt.widths ? opt.widths.map(x => Math.round(x * TEXT_W)) : rows[0].map(() => Math.round(TEXT_W / ncol));
  const cell = (c, i, isHead, ri) => new TableCell({
    width: { size: w[i], type: WidthType.DXA },
    shading: isHead ? { type: ShadingType.CLEAR, fill: opt.headFill || HEAD_BLUE, color: 'auto' } : (opt.shadeRow && opt.shadeRow(rows[ri]) ? { type: ShadingType.CLEAR, fill: 'F7F7F7', color: 'auto' } : undefined),
    margins: { top: 60, bottom: 60, left: 100, right: 100 }, verticalAlign: VerticalAlign.CENTER,
    children: [P(Array.isArray(c) ? c : [run(String(c == null ? '' : c), { bold: isHead, size: PT(opt.size || 15) })],
      { spacing: { after: 0, line: 260, lineRule: AUTO }, alignment: (isHead && opt.centerHead) || (opt.center && opt.center.includes(i)) ? AlignmentType.CENTER : AlignmentType.LEFT })],
  });
  const trs = rows.map((r, ri) => new TableRow({ tableHeader: ri === 0 && !opt.noHead, cantSplit: true, children: r.map((c, i) => cell(c, i, ri === 0 && !opt.noHead, ri)) }));
  return [new Table({ rows: trs, width: { size: TEXT_W, type: WidthType.DXA }, columnWidths: w, layout: TableLayoutType.FIXED, borders: BORDERS }), empty(120)];
}
export function codeBox(code) {
  const lines = String(code).split('\n');
  return [new Table({
    rows: [new TableRow({ children: [new TableCell({
      width: { size: TEXT_W, type: WidthType.DXA }, shading: { type: ShadingType.CLEAR, fill: CODE_BG, color: 'auto' }, margins: { top: 80, bottom: 80, left: 140, right: 140 },
      children: lines.map(l => new Paragraph({ children: [run(l || NBSP, { font: MONO, size: PT(10.5) })], spacing: { after: 0, line: 240, lineRule: AUTO } })),
    })] })],
    width: { size: TEXT_W, type: WidthType.DXA }, columnWidths: [TEXT_W], layout: TableLayoutType.FIXED, borders: BORDERS,
  }), empty(120)];
}
export function calloutBox(children, kind) {
  const k = { note: ['FFF8E5', 'D9A400'], info: ['EEF4FB', '2E74B5'], warn: ['FDECEC', 'C00000'], ok: ['EAF6EE', '2E8B57'] }[kind || 'note'];
  return [new Table({
    rows: [new TableRow({ children: [new TableCell({
      width: { size: TEXT_W, type: WidthType.DXA }, shading: { type: ShadingType.CLEAR, fill: k[0], color: 'auto' }, margins: { top: 80, bottom: 80, left: 140, right: 140 },
      borders: { top: none, bottom: none, right: none, left: { style: BorderStyle.SINGLE, size: 24, color: k[1] } },
      children: Array.isArray(children) && children[0] instanceof Paragraph ? children : [P(children, { spacing: { after: 0, line: 276, lineRule: AUTO } })],
    })] })],
    width: { size: TEXT_W, type: WidthType.DXA }, columnWidths: [TEXT_W], layout: TableLayoutType.FIXED, borders: NO_BORDERS,
  }), empty(120)];
}
export const noteBox = (t, kind) => calloutBox([run((kind === 'warn' ? 'ข้อควรระวัง' : kind === 'info' ? 'ข้อมูลเพิ่มเติม' : 'หมายเหตุ') + ':' + NBSP, { bold: true }), run(t)], kind);

/* ───────── ภาพหน้าจอ ───────── */
export function makeFigure(manifest, shotsDir, opt) {
  const missing = [];
  function figure(id, caption) {
    const m = manifest[id];
    if (!m || !fs.existsSync(path.join(shotsDir, path.basename(m.file)))) { missing.push(id); return opt && opt.skipMissing ? [] : placeholder(caption); }
    const data = fs.readFileSync(path.join(shotsDir, path.basename(m.file)));
    const maxW = 610, maxH = 640;
    let w = maxW, h = Math.round(m.h * maxW / m.w);
    if (h > maxH) { h = maxH; w = Math.round(m.w * maxH / m.h); }
    return [
      P(run(caption, { bold: true, size: PT(15) }), { alignment: AlignmentType.CENTER, spacing: { before: 120, after: 80 }, keepNext: true }),
      new Table({
        rows: [new TableRow({ cantSplit: true, children: [new TableCell({ width: { size: TEXT_W, type: WidthType.DXA }, margins: { top: 60, bottom: 60, left: 60, right: 60 }, shading: { type: ShadingType.CLEAR, fill: 'FAFAFA', color: 'auto' },
          children: [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0 }, children: [new ImageRun({ type: 'jpg', data, transformation: { width: w, height: h }, altText: { title: caption, description: caption, name: id } })] })] })] })],
        width: { size: TEXT_W, type: WidthType.DXA }, columnWidths: [TEXT_W], layout: TableLayoutType.FIXED, borders: BORDERS,
      }),
      empty(160),
    ];
  }
  function placeholder(caption) {
    return [
      P(run(caption, { bold: true, size: PT(15) }), { alignment: AlignmentType.CENTER, spacing: { before: 120, after: 80 }, keepNext: true }),
      new Table({ rows: [new TableRow({ height: { value: 3600, rule: 'atLeast' }, children: [new TableCell({ width: { size: TEXT_W, type: WidthType.DXA }, shading: { type: ShadingType.CLEAR, fill: 'E7E6E6', color: 'auto' }, verticalAlign: VerticalAlign.CENTER, children: [P(run('(ภาพหน้าจอ — ยังไม่ได้จับภาพ)', { color: GRAY }), { alignment: AlignmentType.CENTER, spacing: { after: 0 } })] })] })], width: { size: TEXT_W, type: WidthType.DXA }, columnWidths: [TEXT_W], layout: TableLayoutType.FIXED, borders: BORDERS }),
      empty(160),
    ];
  }
  return { figure, missing };
}

/* ───────── ประกอบเอกสารและบันทึก ───────── */
export function findFont() {
  const cands = ['/Applications/Microsoft Word.app/Contents/Resources/DFonts/thsarabun.ttf', path.join(process.env.HOME || '', 'Library/Fonts/THSarabun.ttf'), '/Library/Fonts/THSarabun.ttf', 'C:/Windows/Fonts/THSarabun.ttf'];
  for (const p of cands) if (fs.existsSync(p)) return p;
  return null;
}
let fontBuf;
export async function packDocument({ title, subtitle, edition, coverLines, body, toc, outPath, tocTitle }) {
  const fontPath = findFont();
  if (fontPath && !fontBuf) fontBuf = fs.readFileSync(fontPath);
  const hdr = new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [run(title, { size: PT(11), color: '7F7F7F' })] })] });
  const ftr = new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: [PageNumber.CURRENT], size: PT(11), color: '7F7F7F' })] })] });
  const pageProps = { size: { width: 11906, height: 16838 }, margin: { top: 1418, bottom: 1418, left: 1418, right: 1134 } };
  const cover = [
    new Paragraph({ spacing: { before: 5200 }, children: [] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 240, line: 276, lineRule: AUTO }, children: [run(title, { bold: true, size: PT(30) })] }),
    ...(subtitle ? [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 160, line: 276, lineRule: AUTO }, children: [run(subtitle, { size: PT(17), color: GRAY })] })] : []),
    ...(coverLines || []).map(l => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [run(l, { size: PT(15), color: GRAY })] })),
    ...(edition ? [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 200 }, children: [run(edition, { size: PT(15), color: GRAY })] })] : []),
  ];
  const tocBlock = toc && toc.length ? [
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [run(tocTitle || 'สารบัญ')] }),
    new TableOfContents('สารบัญ', { hyperlink: true, headingStyleRange: '1-3', cachedEntries: toc.map(e => ({ title: e.title, level: e.level })) }),
    pageBreak(),
  ] : [];
  const doc = new Document({
    creator: 'SAEDU Flow', title, description: subtitle || '',
    fonts: fontBuf ? [{ name: FONT, data: fontBuf }] : undefined,
    features: { updateFields: !!(toc && toc.length) },
    styles: {
      default: { document: { run: { font: FONT, size: PT(16), color: INK, language: { value: 'en-US', bidirectional: 'th-TH' } }, paragraph: { spacing: { line: 276, lineRule: AUTO } } } },
      paragraphStyles: [
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: PT(22), bold: true, color: DARK }, paragraph: { spacing: { before: 120, after: 160 }, keepNext: true, outlineLevel: 0 } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: PT(18), bold: true, color: BLUE }, paragraph: { spacing: { before: 280, after: 100 }, keepNext: true, outlineLevel: 1 } },
        { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: PT(16), bold: true, color: BLUE }, paragraph: { spacing: { before: 200, after: 60 }, keepNext: true, outlineLevel: 2 } },
        { id: 'TOC1', name: 'toc 1', basedOn: 'Normal', next: 'Normal', run: { font: FONT, size: PT(16), bold: true }, paragraph: { spacing: { after: 60 } } },
        { id: 'TOC2', name: 'toc 2', basedOn: 'Normal', next: 'Normal', run: { font: FONT, size: PT(15) }, paragraph: { spacing: { after: 40 }, indent: { left: 360 } } },
        { id: 'TOC3', name: 'toc 3', basedOn: 'Normal', next: 'Normal', run: { font: FONT, size: PT(14), color: GRAY }, paragraph: { spacing: { after: 30 }, indent: { left: 720 } } },
      ],
      characterStyles: [{ id: 'Hyperlink', name: 'Hyperlink', run: { color: INK } }],
    },
    numbering: { config: [
      { reference: 'bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 640, hanging: 300 } } } }] },
      { reference: 'decimal', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 640, hanging: 360 } } } }] },
    ] },
    sections: [
      { properties: { page: pageProps }, headers: { default: hdr }, children: cover },
      { properties: { page: Object.assign({}, pageProps, { pageNumbers: { start: 1 } }) }, headers: { default: hdr }, footers: { default: ftr }, children: [...tocBlock, ...body] },
    ],
  });
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const buf = await Packer.toBuffer(doc);
  fs.writeFileSync(outPath, buf);
  return { bytes: buf.length, font: !!fontBuf };
}
