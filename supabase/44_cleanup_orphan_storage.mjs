// ============================================================================
// SAEDU Flow — ล้างไฟล์กำพร้า (orphan) ออกจาก Storage bucket "documents"
//
// ไฟล์กำพร้า = object ที่อยู่ใน bucket จริง แต่ไม่มีแถวไหนในฐานข้อมูลอ้างถึงเลย
// (document_files.file_path / form_templates.file_path / users.signature_path)
//
// ต้นเหตุหลัก — ตอนสร้างเอกสารใหม่ workflow.js อัปโหลดไฟล์ขึ้น Storage ทันทีที่แนบ
// แต่แถวใน document_files ไปรอใน PF (ตัวแปรในหน้าเว็บ) แล้วค่อย insert ตอน saveDoc()
// ใครแนบไฟล์แล้วปิดแท็บ/เปลี่ยนหน้าโดยไม่บันทึก ไฟล์นั้นจะค้างอยู่ใน Storage ตลอดกาล
// (แก้ที่ต้นเหตุแล้วใน workflow.js — _discardPendingUploads/_sweepStalePendingUploads
//  สคริปต์นี้ไว้เก็บกวาดของเก่า + เป็นตาข่ายกันพลาดสำหรับเคสปิดแท็บข้ามเครื่อง)
//
// รันเอง ในเครื่องตัวเอง — service_role key ไม่ต้องบอกใครทั้งนั้น
//
// เตรียม (ครั้งเดียว):
//   cd supabase
//   npm init -y && npm install @supabase/supabase-js
//
// env ที่ต้องมี (ตั้งใน shell ห้ามเขียนลงไฟล์):
//   SUPABASE_URL              — https://jrubupvzltxqstzcpoov.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY — Dashboard → Settings → API → service_role (ลับ!)
//
// วิธีใช้:
//   node 44_cleanup_orphan_storage.mjs                    # dry-run (ค่าเริ่มต้น — ไม่ลบอะไร)
//   node 44_cleanup_orphan_storage.mjs --min-age-days=30  # นับเฉพาะไฟล์เก่ากว่า 30 วัน
//   node 44_cleanup_orphan_storage.mjs --apply            # ลบจริง
//
// ปลอดภัยเพราะ:
//   1. ค่าเริ่มต้นคือ dry-run — ต้องใส่ --apply เองถึงจะลบ
//   2. ข้ามไฟล์ที่ใหม่กว่า --min-age-days (ค่าเริ่มต้น 7 วัน) — กันลบไฟล์ของฟอร์มที่ยังเปิดค้างอยู่
//   3. ถ้าดึงรายการอ้างอิงจาก DB ได้ 0 แถว จะหยุดทันที (กันกรณี query พังแล้วลบเกลี้ยง bucket)
//   4. เขียน manifest JSON ทุกครั้งว่าลบอะไรไปบ้าง ไว้ตรวจย้อนหลัง
//
// ⚠️ ลบผ่าน Storage API เท่านั้น ห้าม DELETE จากตาราง storage.objects ตรง ๆ —
//    การลบแถวใน storage.objects ไม่ได้ลบไฟล์จริงใน S3 พื้นที่จะไม่ลดและไฟล์จะกลายเป็น
//    untracked object ที่มองไม่เห็นจากทุกที่
// ============================================================================

import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'node:fs';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('ขาด env: SUPABASE_URL หรือ SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const minAgeDays = Number((args.find(a => a.startsWith('--min-age-days=')) || '').split('=')[1] || 7);
const BUCKET = 'documents';

if (!Number.isFinite(minAgeDays) || minAgeDays < 0) {
  console.error('--min-age-days ต้องเป็นตัวเลข >= 0');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

/* ── 1. ไล่ทุก object ใน bucket (list() ไม่ recursive เอง ต้องเดินโฟลเดอร์เอง เช่น signed/{docId}/) ── */
async function listAll(prefix = '') {
  const out = [];
  const PAGE = 100;
  let offset = 0;
  for (;;) {
    const { data, error } = await sb.storage.from(BUCKET).list(prefix, {
      limit: PAGE, offset, sortBy: { column: 'name', order: 'asc' },
    });
    if (error) throw new Error(`list("${prefix}") ล้มเหลว: ${error.message}`);
    if (!data || !data.length) break;
    for (const item of data) {
      const full = prefix ? `${prefix}/${item.name}` : item.name;
      // โฟลเดอร์จะไม่มี id/metadata — ต้องเดินลงไปต่อ
      if (item.id === null || !item.metadata) out.push(...await listAll(full));
      else out.push({ path: full, size: Number(item.metadata.size || 0), created_at: item.created_at });
    }
    if (data.length < PAGE) break;
    offset += PAGE;
  }
  return out;
}

/* ── 2. รวม path ทั้งหมดที่ยังมีแถวอ้างถึง ── */
async function loadReferenced() {
  const refs = new Set();
  const sources = [
    ['document_files', 'file_path'],
    ['form_templates', 'file_path'],
    ['users', 'signature_path'],
  ];
  // document_files ที่ถูกย้ายไปคลัง Google Drive แล้ว (archive_url ไม่ว่าง) ไม่นับว่ายัง
  // "อ้างถึง" path เดิมใน Storage — ของจริงอยู่บน Drive แล้ว ถ้าไฟล์ยังค้างใน Storage อยู่
  // (เช่นตอนย้ายลบต้นทางไม่สำเร็จ) ก็คือขยะที่ควรเก็บกวาด
  // เลือกคอลัมน์แบบเผื่อไว้: โปรเจกต์ที่ยังไม่รัน 46_archive_to_drive.sql จะไม่มีคอลัมน์นี้
  let archiveAware = true;
  {
    const { error } = await sb.from('document_files').select('archive_url').limit(1);
    if (error) archiveAware = false;
  }
  if (!archiveAware) console.log('(ยังไม่มีคอลัมน์ archive_url — ข้ามการตรวจไฟล์ในคลัง Drive)');

  for (const [table, col] of sources) {
    const withArch = archiveAware && table === 'document_files';
    const sel = withArch ? `${col},archive_url` : col;
    let from = 0;
    const PAGE = 1000;
    for (;;) {
      const { data, error } = await sb.from(table).select(sel).not(col, 'is', null).range(from, from + PAGE - 1);
      if (error) throw new Error(`อ่าน ${table}.${col} ล้มเหลว: ${error.message}`);
      if (!data || !data.length) break;
      for (const row of data) {
        if (withArch && row.archive_url) continue;
        if (row[col]) refs.add(String(row[col]));
      }
      if (data.length < PAGE) break;
      from += PAGE;
    }
  }
  return refs;
}

const fmt = b => b >= 1048576 ? (b / 1048576).toFixed(1) + ' MB' : (b / 1024).toFixed(0) + ' kB';

(async () => {
  console.log(`โหมด: ${apply ? '⚠️  ลบจริง (--apply)' : 'dry-run (ไม่ลบอะไร)'} · ข้ามไฟล์ที่ใหม่กว่า ${minAgeDays} วัน\n`);

  const [objects, referenced] = await Promise.all([listAll(), loadReferenced()]);

  // ตาข่ายกันพลาด: DB ต้องอ้างถึงอะไรบ้างเสมอ ถ้าว่างเปล่าแปลว่า query พัง ไม่ใช่ว่าไฟล์กำพร้าหมด bucket
  if (!referenced.size) {
    console.error('หยุด: ไม่พบ path ที่ถูกอ้างถึงเลยสักรายการ — น่าจะเป็นปัญหาการเชื่อมต่อ/สิทธิ์ ไม่ใช่ว่าไฟล์กำพร้าจริง');
    process.exit(1);
  }

  const cutoff = Date.now() - minAgeDays * 86400000;
  const orphans = [], tooNew = [];
  let liveBytes = 0;

  for (const o of objects) {
    if (referenced.has(o.path)) { liveBytes += o.size; continue; }
    if (new Date(o.created_at).getTime() > cutoff) tooNew.push(o);
    else orphans.push(o);
  }

  const orphanBytes = orphans.reduce((s, o) => s + o.size, 0);
  const tooNewBytes = tooNew.reduce((s, o) => s + o.size, 0);

  console.log(`ทั้ง bucket      : ${objects.length} ไฟล์ · ${fmt(objects.reduce((s, o) => s + o.size, 0))}`);
  console.log(`ใช้งานอยู่        : ${objects.length - orphans.length - tooNew.length} ไฟล์ · ${fmt(liveBytes)}`);
  console.log(`กำพร้าแต่ยังใหม่   : ${tooNew.length} ไฟล์ · ${fmt(tooNewBytes)}  (ข้าม)`);
  console.log(`กำพร้า ลบได้      : ${orphans.length} ไฟล์ · ${fmt(orphanBytes)}\n`);

  if (!orphans.length) { console.log('ไม่มีอะไรต้องลบ'); return; }

  // สรุปตามชนิด ให้เห็นว่าขยะมาจากทางไหน
  const kindOf = p => p.startsWith('signed/') ? 'signed/* (ลายเซ็นเวอร์ชันเก่า)'
    : p.startsWith('stamped_') ? 'stamped_* (ประทับเลข)'
    : p.startsWith('edited_') ? 'edited_* (จาก PDF editor)'
    : p.startsWith('reject_') ? 'reject_* (ไฟล์แนบตอนส่งคืนแก้ไข)'
    : p.startsWith('tmpl_') ? 'tmpl_* (แบบฟอร์ม)'
    : 'อัปโหลดปกติ (ฟอร์มที่ถูกทิ้ง)';
  const byKind = {};
  for (const o of orphans) {
    const k = kindOf(o.path);
    byKind[k] = byKind[k] || { n: 0, b: 0 };
    byKind[k].n++; byKind[k].b += o.size;
  }
  console.log('แยกตามชนิด:');
  for (const [k, v] of Object.entries(byKind).sort((a, b) => b[1].b - a[1].b)) {
    console.log(`  ${String(v.n).padStart(4)} ไฟล์ · ${fmt(v.b).padStart(9)}  ${k}`);
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const manifest = `orphan-cleanup-${stamp}.json`;
  writeFileSync(manifest, JSON.stringify({
    ran_at: new Date().toISOString(), applied: apply, min_age_days: minAgeDays,
    total_files: orphans.length, total_bytes: orphanBytes, files: orphans,
  }, null, 2));
  console.log(`\nบันทึกรายการไว้ที่ ${manifest}`);

  if (!apply) {
    console.log('\nนี่คือ dry-run — ยังไม่ลบอะไร ตรวจ manifest ให้พอใจแล้วรันซ้ำด้วย --apply');
    return;
  }

  let done = 0, failed = 0;
  const BATCH = 100;
  for (let i = 0; i < orphans.length; i += BATCH) {
    const chunk = orphans.slice(i, i + BATCH).map(o => o.path);
    const { error } = await sb.storage.from(BUCKET).remove(chunk);
    if (error) { failed += chunk.length; console.error(`  ลบ batch ${i / BATCH + 1} ล้มเหลว: ${error.message}`); }
    else { done += chunk.length; console.log(`  ลบแล้ว ${done}/${orphans.length}`); }
  }
  console.log(`\nเสร็จ: ลบ ${done} ไฟล์ (คืนพื้นที่ ~${fmt(orphanBytes)})${failed ? ` · ล้มเหลว ${failed}` : ''}`);
})().catch(e => { console.error('ผิดพลาด:', e.message); process.exit(1); });
