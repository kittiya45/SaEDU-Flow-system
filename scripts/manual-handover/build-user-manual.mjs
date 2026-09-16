#!/usr/bin/env node
/* build-user-manual.mjs — "คู่มือการใช้งานระบบสำหรับผู้ใช้งาน (User Manual)" ฉบับละเอียด ทุกบทบาท
   เนื้อหาทั้งหมดดึงจาก manual.html (ต้นฉบับเดียวกับคู่มือออนไลน์และคู่มือย่อยแยกบทบาท) ในโหมด "all"
   ผ่าน extractAll() ของ scripts/build-manual-docx.mjs แล้วจัดหน้าในสไตล์เอกสารส่งมอบ (style.mjs)
   พร้อมแทรกภาพหน้าจอจริงจาก shots/ ตามหัวข้อ (ตาราง FIG ด้านล่าง)

   ผลลัพธ์ (deliverables/05-UserManual/ + สำเนาใน manual-docx/):
     คู่มือการใช้งานระบบ-User-Manual.docx            ทุกบทบาท (ภาพจาก shots/)
     คู่มือการใช้งาน-นิสิต-กนค.docx                    เฉพาะเนื้อหาของนิสิต ภาพจาก shots/student/ (ถ่ายด้วยบัญชีนิสิต)
     คู่มือการใช้งาน-อาจารย์.docx                      shots/teacher/
     คู่มือการใช้งาน-เจ้าหน้าที่และผู้ดูแลระบบ.docx      shots/staff/
   ใช้: node scripts/manual-handover/build-user-manual.mjs [--role=student,teacher] */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AlignmentType } from 'docx';
import { extractAll } from '../build-manual-docx.mjs';
import { run, P, text, table, calloutBox, makeCtx, makeFigure, packDocument, GRAY, PT, NBSP } from './style.mjs';
import { R, mkRuns, roleLine } from './render-blocks.mjs';
import * as C from './content.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const args = Object.fromEntries(process.argv.slice(2).map(a => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const OUT_DIR = path.resolve(ROOT, args.out || 'deliverables/05-UserManual');

/* บทบาท → ป้าย ชื่อไฟล์ และคำนำ */
const ROLE_DEF = {
  all: { label: 'ทุกบทบาท', file: 'คู่มือการใช้งานระบบ-User-Manual.docx', title: 'คู่มือการใช้งานระบบ SAEDU Flow สำหรับผู้ใช้งาน',
    intro: 'คู่มือฉบับนี้อธิบายการใช้งานระบบ SAEDU Flow อย่างละเอียดสำหรับผู้ใช้ทุกบทบาท (นิสิต กนค. อาจารย์ที่ปรึกษาชมรม เจ้าหน้าที่ และผู้ดูแลระบบ) เรียงตามลำดับการใช้งานจริง หัวข้อที่ใช้ได้เฉพาะบางบทบาทมีป้าย "เฉพาะ:" กำกับ' },
  student: { label: 'นิสิต กนค.', file: 'คู่มือการใช้งาน-นิสิต-กนค.docx', title: 'คู่มือการใช้งานระบบ SAEDU Flow สำหรับนิสิต กนค.',
    intro: 'คู่มือฉบับนี้สำหรับนิสิตคณะกรรมการนิสิต (กนค.) ทุกตำแหน่ง ทั้งผู้จัดทำเอกสาร ประธานฝ่ายที่ตรวจทาน หัวหน้านิสิตและเหรัญญิกที่ลงนาม และเลขานุการที่ดูแลหนังสือขาเข้า — อธิบายทุกขั้นตอนตั้งแต่สมัครสมาชิก สร้างหนังสือ ติดตามสายอนุมัติ ลงนาม ออกเลข ไปจนถึงส่งต่อให้เจ้าหน้าที่ ภาพหน้าจอทั้งหมดถ่ายจากมุมมองของบัญชีนิสิตจริง' },
  teacher: { label: 'อาจารย์', file: 'คู่มือการใช้งาน-อาจารย์.docx', title: 'คู่มือการใช้งานระบบ SAEDU Flow สำหรับอาจารย์ที่ปรึกษา',
    intro: 'คู่มือฉบับนี้สำหรับอาจารย์ที่ปรึกษาชมรม/ฝ่าย ซึ่งเป็นผู้ลงนามขั้นสุดท้ายของสายอนุมัติหนังสือขาออก — เน้นการรับแจ้งเตือน เปิดดูเอกสาร อนุมัติ/ลงนาม หรือส่งคืนแก้ไข การบันทึกลายเซ็นไว้ใช้ซ้ำ และการเชื่อม LINE ภาพหน้าจอทั้งหมดถ่ายจากมุมมองของบัญชีอาจารย์จริง' },
  staff: { label: 'เจ้าหน้าที่และผู้ดูแลระบบ', file: 'คู่มือการใช้งาน-เจ้าหน้าที่และผู้ดูแลระบบ.docx', title: 'คู่มือการใช้งานระบบ SAEDU Flow สำหรับเจ้าหน้าที่และผู้ดูแลระบบ',
    intro: 'คู่มือฉบับนี้สำหรับเจ้าหน้าที่กิจการนิสิตและผู้ดูแลระบบ — ครอบคลุมงานในสายอนุมัติ (ขั้นเจ้าหน้าที่กิจการนิสิต) การรับเอกสารส่งต่อและยื่นในระบบคณะ การออกเลขหนังสือ การจัดการผู้ใช้ นำเข้า CSV สถิติ และเมนูจัดการระบบของผู้ดูแล ภาพหน้าจอถ่ายจากมุมมองของบัญชีเจ้าหน้าที่ (และผู้ดูแลระบบสำหรับหน้าจัดการระบบ)' },
};
const ROLES_TO_BUILD = args.role ? String(args.role).split(',') : ['all']; // ฉบับแยกบทบาทแบบละเอียดอยู่ที่ build-detailed-manual.mjs

/* ภาพหน้าจอประกอบแต่ละหัวข้อ (id ของ section ใน manual.html → id ภาพ) — ภาพที่ชุดของบทบาทนั้นไม่มีจะถูกข้าม */
const FIG = {
  register: ['login', 'register'], dashboard: ['dash'], todo: ['todo'], 'docs-list': ['docs'], 'create-doc': ['form_out', 'form_in'], workflow: ['det_own'],
  approve: ['det', 'sign'], numbering: ['num'], reject: ['reject', 'rejected_det', 'form_edit', 'recall', 'cancel'], forward: ['forward', 'fwd_staff', 'awaiting'],
  ack: ['ack_card', 'ack_propose', 'ack_modal'], notif: ['notif', 'line'], signature: ['sigprof'], files: ['viewer', 'editor', 'verhist'],
  calendar: ['calendar'], templates: ['tmpl'], '-users': ['adm', 'adm_edit'], '-import': ['import'], stats: ['stat'], 'sys-admin': ['sys'],
};

/* ───────── ประกอบ ───────── */
const extracted = await extractAll(ROLES_TO_BUILD);
for (const role of ROLES_TO_BUILD) {
  const def = ROLE_DEF[role];
  const shotsDir = role === 'all' ? path.join(HERE, 'shots') : path.join(HERE, 'shots', role);
  const manifest = fs.existsSync(path.join(shotsDir, 'manifest.json')) ? JSON.parse(fs.readFileSync(path.join(shotsDir, 'manifest.json'), 'utf8')) : {};
  const { figure, missing } = makeFigure(manifest, shotsDir, { skipMissing: true });
  const data = extracted[role];
  const c = makeCtx();
  const body = [];
  const push = (...x) => x.flat(Infinity).forEach(el => body.push(el));

  push(c.heading(1, 'เกี่ยวกับคู่มือฉบับนี้'));
  push(text(def.intro + ' เนื้อหาเดียวกันเปิดอ่านออนไลน์ได้จากลิงก์ "คู่มือการใช้งาน" ที่หน้าเข้าสู่ระบบ'));
  push(table([['รายการ', 'ค่า'], ['เข้าใช้งานระบบ', C.SYSTEM.url], ['คู่มือออนไลน์', C.SYSTEM.url + '/manual.html'], ['บัญชีนิสิต กนค.', 'เข้าสู่ระบบด้วยรหัสนิสิต 10 หลัก'], ['บัญชีอาจารย์/เจ้าหน้าที่', 'เข้าสู่ระบบด้วยอีเมล']], { widths: [0.3, 0.7] }));
  if (role === 'all' || role === 'staff') {
    push(c.heading(2, 'บทบาทผู้ใช้งานในระบบ'));
    push(table([['บทบาท', 'หน้าที่หลัก'], ...C.ROLES], { widths: [0.3, 0.7] }));
    push(calloutBox([run('หมายเหตุ:' + NBSP, { bold: true }), run(C.ROLE_NOTE)], 'note'));
  }

  let n = 0;
  for (const sec of data.sections) {
    const h1 = sec.blocks.find(b => b.t === 'h1');
    if (!h1) continue;
    n++;
    push(c.heading(1, `${n}. ${h1.text}`, { pageBreakBefore: true }));
    if (sec.roles) push(roleLine(sec.roles));
    if (h1.sub && h1.sub.length) push(P(mkRuns(h1.sub, { color: GRAY, size: PT(15) }), { spacing: { after: 160 } }));
    const ids = (FIG[sec.id] || []).filter(id => manifest[id]);
    ids.forEach((id, k) => push(figure(id, ids.length === 1 ? `ภาพระบบ${h1.text}` : `ภาพระบบ${h1.text} (${k + 1}/${ids.length}) — ${manifest[id].cap}`)));
    const r = new R(c); r.blocks(sec.blocks.filter(b => b.t !== 'h1')); push(r.out);
  }

  const out = path.join(OUT_DIR, def.file);
  const res = await packDocument({ title: def.title, subtitle: C.META.subtitle, edition: 'User Manual · ฉบับละเอียด · ' + C.META.edition.replace(/^.*· /, ''), body, toc: c.toc, outPath: out });
  fs.mkdirSync(path.join(ROOT, 'manual-docx'), { recursive: true });
  fs.copyFileSync(out, path.join(ROOT, 'manual-docx', def.file));
  console.log(`✓ ${path.relative(ROOT, out)}  (${(res.bytes / 1048576).toFixed(1)} MB, ${n} หัวข้อ, ภาพ ${Object.keys(manifest).length} ภาพ${missing.length ? ' — ไม่มีในชุดนี้: ' + [...new Set(missing)].join(', ') : ''})`);
}
