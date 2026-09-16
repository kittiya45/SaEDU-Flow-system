#!/usr/bin/env node
/* build-detailed-manual.mjs — คู่มือฉบับละเอียดแยกบทบาท "ทีละขั้น มีภาพทุกขั้น + วงเลขชี้ปุ่ม"
   เนื้อหา: walkthroughs.mjs (งาน/ขั้นตอน/คำอธิบายช่อง) · ภาพ: shots/steps/<role>/ (capture-steps.mjs)
   ภาคผนวก: ตารางอ้างอิง + คำถามที่พบบ่อย ของบทบาทนั้นจาก manual.html
   ผลลัพธ์: deliverables/05-UserManual/คู่มือการใช้งาน-<บทบาท>.docx (+ สำเนาใน manual-docx/)
   ใช้: node scripts/manual-handover/build-detailed-manual.mjs [--role=student,teacher,staff] */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AlignmentType } from 'docx';
import { extractAll } from '../build-manual-docx.mjs';
import { TASKS, ROLE_META } from './walkthroughs.mjs';
import * as C from './content.mjs';
import { run, P, text, empty, table, calloutBox, makeCtx, makeFigure, packDocument, GRAY, PT, NBSP, AUTO } from './style.mjs';
import { R } from './render-blocks.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const args = Object.fromEntries(process.argv.slice(2).map(a => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const OUT_DIR = path.resolve(ROOT, args.out || 'deliverables/05-UserManual');
const ROLES = args.role ? String(args.role).split(',') : Object.keys(TASKS);
const FILE = { student: 'คู่มือการใช้งาน-นิสิต-กนค.docx', teacher: 'คู่มือการใช้งาน-อาจารย์.docx', staff: 'คู่มือการใช้งาน-เจ้าหน้าที่และผู้ดูแลระบบ.docx' };
const RED = 'E11D48';

/* "(1) กด…" → เลข (1) เป็นตัวหนาสีแดงให้ตรงกับวงเลขในภาพ */
function markedRuns(t, base) {
  const out = []; let last = 0; const re = /\((\d{1,2})\)/g; let m;
  while ((m = re.exec(t))) { if (m.index > last) out.push(run(t.slice(last, m.index), base)); out.push(run('(' + m[1] + ')', Object.assign({}, base, { bold: true, color: RED }))); last = m.index + m[0].length; }
  if (last < t.length) out.push(run(t.slice(last), base));
  return out;
}
const circled = n => run('(' + n + ')', { bold: true, color: RED });

const extracted = await extractAll(ROLES);
for (const role of ROLES) {
  const meta = ROLE_META[role];
  const tasks = TASKS[role];
  const dir = path.join(HERE, 'shots', 'steps', role);
  const manifest = fs.existsSync(path.join(dir, 'manifest.json')) ? JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8')) : {};
  const { figure, missing } = makeFigure(Object.fromEntries(Object.entries(manifest).map(([k, v]) => [k, { file: v.file, cap: '', w: v.w, h: v.h }])), dir, { skipMissing: false });
  const c = makeCtx();
  const body = [];
  const push = (...x) => x.flat(Infinity).forEach(el => body.push(el));

  // ── บทนำ ──
  push(c.heading(1, 'เกี่ยวกับคู่มือฉบับนี้'));
  push(text(meta.intro));
  push(table([['รายการ', 'ค่า'], ['เข้าใช้งานระบบ', C.SYSTEM.url], ['คู่มือออนไลน์', C.SYSTEM.url + '/manual.html'], ['บัญชีนิสิต กนค.', 'เข้าสู่ระบบด้วยรหัสนิสิต 10 หลัก'], ['บัญชีอาจารย์/เจ้าหน้าที่', 'เข้าสู่ระบบด้วยอีเมล'], ['ติดต่อผู้ดูแล', 'เจ้าหน้าที่กิจการนิสิต คณะครุศาสตร์ (ผ่านกลุ่ม LINE ของ กนค. หรืออีเมลของฝ่าย)']], { widths: [0.3, 0.7] }));
  push(c.heading(2, 'วิธีอ่านคู่มือ'));
  push(P([run('ทุกขั้นตอนมีภาพหน้าจอจริง ปุ่มหรือช่องที่ต้องใช้ถูกล้อมด้วยกรอบสีแดงและมีวงเลข '), circled(1), run(' '), circled(2), run(' … ตรงกับเลขในข้อความอธิบายและตาราง "ส่วนประกอบในภาพ" ใต้ภาพ · ข้อมูลในภาพทั้งหมดเป็นข้อมูลจำลอง')]));
  push(calloutBox([run('ผลลัพธ์ที่ควรเห็น:' + NBSP, { bold: true }), run('กล่องสีเขียว = สิ่งที่ระบบจะแสดงหรือทำหลังจากขั้นตอนนั้นสำเร็จ ใช้ตรวจว่าทำถูกหรือไม่')], 'ok'));
  push(calloutBox([run('หมายเหตุ:' + NBSP, { bold: true }), run('กล่องสีเหลือง = ข้อมูลเพิ่มเติมที่ช่วยให้เข้าใจพฤติกรรมของระบบ')], 'note'));
  push(calloutBox([run('ข้อควรระวัง:' + NBSP, { bold: true }), run('กล่องสีแดง = สิ่งที่ทำผิดแล้วแก้ยาก หรือทำให้เอกสารเดินต่อไม่ได้')], 'warn'));
  push(c.heading(2, 'งานทั้งหมดในคู่มือเล่มนี้'));
  push(table([['งานที่', 'ชื่องาน', 'ใครทำ', 'ใช้เมื่อ'], ...tasks.map((t, i) => [String(i + 1), t.title, t.who || '', t.when || '—'])], { widths: [0.08, 0.4, 0.26, 0.26], size: 14, center: [0] }));
  if (role !== 'teacher') { push(c.heading(2, 'บทบาทผู้ใช้งานในระบบ')); push(table([['บทบาท', 'หน้าที่หลัก'], ...C.ROLES], { widths: [0.3, 0.7], size: 14 })); push(calloutBox([run('หมายเหตุ:' + NBSP, { bold: true }), run(C.ROLE_NOTE)], 'note')); }

  // ── งานทีละขั้น ──
  let figNo = 0;
  tasks.forEach((task, ti) => {
    push(c.heading(1, `งานที่ ${ti + 1}: ${task.title}`, { pageBreakBefore: true }));
    push(table([['ใครทำ', task.who || 'ทุกคน'], ['ใช้เมื่อ', task.when || 'เมื่อต้องการ'], ['จำนวนขั้นตอน', task.steps.length + ' ขั้น']], { widths: [0.22, 0.78], noHead: true, size: 15 }));
    task.steps.forEach((st, k) => {
      const id = `${task.id}-${k + 1}`;
      const m = manifest[id];
      push(c.heading(2, `ขั้นตอนที่ ${k + 1} · ${st.title}`));
      push(P(markedRuns(st.text), { spacing: { after: 120, line: 276, lineRule: AUTO } }));
      figNo++;
      push(figure(id, `ภาพที่ ${ti + 1}.${k + 1} ${st.title}`));
      if (m && m.marks && m.marks.length) {
        push(P(run('ส่วนประกอบในภาพ', { bold: true, size: PT(15) }), { spacing: { after: 40 }, keepNext: true }));
        push(table([['หมายเลข', 'ส่วนประกอบ', 'คำอธิบาย'], ...m.marks.map(mk => [[circled(mk.n)], mk.label + (mk.missing ? ' (ไม่ปรากฏในภาพนี้)' : ''), mk.desc || '—'])], { widths: [0.12, 0.34, 0.54], size: 14, center: [0] }));
      }
      if (st.fields && st.fields.length) {
        push(P(run('ความหมายของแต่ละช่อง / ตัวเลือก', { bold: true, size: PT(15) }), { spacing: { after: 40 }, keepNext: true }));
        push(table([['ช่อง / ตัวเลือก', 'คำอธิบาย'], ...st.fields], { widths: [0.3, 0.7], size: 14 }));
      }
      if (st.result) push(calloutBox([run('ผลลัพธ์ที่ควรเห็น:' + NBSP, { bold: true }), ...markedRuns(st.result)], 'ok'));
      if (st.note) push(calloutBox([run('หมายเหตุ:' + NBSP, { bold: true }), ...markedRuns(st.note)], 'note'));
      if (st.warn) push(calloutBox([run('ข้อควรระวัง:' + NBSP, { bold: true }), ...markedRuns(st.warn)], 'warn'));
    });
  });

  // ── ภาคผนวก: ตารางอ้างอิง + FAQ ของบทบาทนี้จาก manual.html ──
  const data = extracted[role];
  const appendix = data.sections.filter(s => s.id === 'reference' || s.id === 'faq');
  appendix.forEach((sec, i) => {
    const h1 = sec.blocks.find(b => b.t === 'h1');
    push(c.heading(1, `ภาคผนวก ${String.fromCharCode(0x0E01 + i)}: ${h1 ? h1.text : sec.id}`, { pageBreakBefore: true }));
    const r = new R(c); r.blocks(sec.blocks.filter(b => b.t !== 'h1')); push(r.out);
  });

  const out = path.join(OUT_DIR, FILE[role]);
  const res = await packDocument({ title: meta.title, subtitle: C.META.subtitle, edition: 'User Manual · ฉบับละเอียดทีละขั้นตอน · ' + C.META.edition.replace(/^.*· /, ''), body, toc: c.toc, outPath: out });
  fs.mkdirSync(path.join(ROOT, 'manual-docx'), { recursive: true });
  fs.copyFileSync(out, path.join(ROOT, 'manual-docx', FILE[role]));
  const nSteps = tasks.reduce((a, t) => a + t.steps.length, 0);
  console.log(`✓ ${path.relative(ROOT, out)}  (${(res.bytes / 1048576).toFixed(1)} MB, ${tasks.length} งาน, ${nSteps} ขั้น, ${figNo} ภาพ${missing.length ? ' — ภาพที่ขาด: ' + [...new Set(missing)].join(', ') : ''})`);
}
