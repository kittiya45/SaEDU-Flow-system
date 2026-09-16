// ============================================================================
// SAEDU Flow — ดึงไฟล์ของเอกสารคืนจากคลัง (Google Drive/OneDrive) กลับเข้า Supabase Storage
//
// ใช้เมื่อไหร่: เอกสารที่ "จบแล้ว" และไฟล์ถูก 47 ย้ายไปคลัง แต่ต้องกลับมาเดินใหม่ — เช่น
//   จนท. กด "ไม่อนุมัติ — ส่งคืน" เอกสาร completed ที่ส่งต่อมา → กลายเป็น rejected → ผู้สร้าง
//   ส่งใหม่ → ผู้ลงนามต้องอ่าน PDF เดิม ซึ่งไม่อยู่ใน Storage แล้ว หน้าเว็บจะขึ้นว่า
//   "ไฟล์ PDF ของเอกสารนี้ถูกย้ายไปคลัง Google Drive แล้ว" — รันสคริปต์นี้แล้วลงนามต่อได้ทันที
//
// ทำอะไร ต่อ 1 ไฟล์ (ลำดับเดียวกับ 47 แต่ย้อนทาง):
//   1. โหลดจากคลัง (remote:archive_ref)
//   2. อัปขึ้น Supabase Storage ที่ file_path เดิมของแถวนั้น (คอลัมน์นี้ 47 ตั้งใจเก็บไว้เพื่อการนี้)
//   3. โหลดกลับจาก Storage เทียบขนาดกับไฟล์ในคลัง  ← ไม่ตรง = ข้าม ไม่แตะ DB
//   4. ล้าง archive_url / archive_ref / archived_at แล้วอ่านกลับมายืนยัน
//   ไม่ลบไฟล์ในคลัง — ถ้าเอกสารจบอีกรอบ 47 จะอัปทับ path เดิมและออกลิงก์ใหม่ให้เอง
//
// ── วิธีใช้ ──────────────────────────────────────────────────────────────────
//   node 52_restore_from_archive.mjs --remote=saedu --doc="กนค. 1015002-01/2569"           # dry-run
//   node 52_restore_from_archive.mjs --remote=saedu --doc="กนค. 1015002-01/2569" --apply   # ดึงคืนจริง
//   --doc=  รับได้ทั้งเลขหนังสือ หรือ uuid ของเอกสาร · หลายฉบับคั่นด้วย ; (ไม่ใช่ , เพราะเลขหนังสือมี , ได้)
//   --remote= ชื่อ remote ใน rclone ที่ไฟล์อยู่ (ค่าเริ่มต้นจาก ARCHIVE_RCLONE_REMOTE หรือ saedu)
//
// env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (เหมือน 47) — key อยู่ใน Keychain:
//   export SUPABASE_SERVICE_ROLE_KEY="$(security find-generic-password -s saedu-service-role -w)"
// ============================================================================

import { createClient } from '@supabase/supabase-js';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) { console.error('ขาด env: SUPABASE_URL หรือ SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }

const args = process.argv.slice(2);
const argVal = (n, d) => { const hit = args.find(a => a.startsWith(`--${n}=`)); return hit ? hit.split('=').slice(1).join('=') : d; };
const apply  = args.includes('--apply');
const remote = argVal('remote', process.env.ARCHIVE_RCLONE_REMOTE || 'saedu');
const docArg = argVal('doc', '');
if (!docArg) { console.error('ต้องระบุ --doc="เลขหนังสือ" หรือ --doc=uuid (หลายฉบับคั่นด้วย ;)'); process.exit(1); }
const wanted = docArg.split(';').map(s => s.trim()).filter(Boolean);

const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const BUCKET = 'documents';
const isUuid = s => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
const fmt = b => b >= 1048576 ? (b / 1048576).toFixed(1) + ' MB' : (b / 1024).toFixed(0) + ' kB';

function rclone(argv, { json = false } = {}) {
  const out = execFileSync('rclone', argv, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return json ? JSON.parse(out || '[]') : out.trim();
}
try { rclone(['lsd', `${remote}:`]); }
catch (e) { console.error(`ต่อ remote "${remote}" ไม่ได้: ${String(e.message || e).split('\n')[0]}`); process.exit(1); }

(async () => {
  console.log(`โหมด : ${apply ? '⚠️  ดึงคืนจริง (--apply)' : 'dry-run (ไม่อัป ไม่เขียน DB)'}`);
  console.log(`คลัง : ${remote}:\n`);

  /* 1. หาเอกสาร */
  const docs = [];
  for (const w of wanted) {
    const q = sb.from('documents').select('id,doc_number,title,status');
    const { data, error } = await (isUuid(w) ? q.eq('id', w) : q.eq('doc_number', w));
    if (error) { console.error('อ่าน documents ล้มเหลว: ' + error.message); process.exit(1); }
    if (!data.length) { console.error(`ไม่พบเอกสาร "${w}"`); process.exit(1); }
    docs.push(...data);
  }

  /* 2. ไฟล์ที่อยู่ในคลัง */
  const { data: files, error: fErr } = await sb.from('document_files')
    .select('id,document_id,file_name,file_path,file_size,archive_url,archive_ref')
    .in('document_id', docs.map(d => d.id)).not('archive_url', 'is', null);
  if (fErr) { console.error('อ่าน document_files ล้มเหลว: ' + fErr.message); process.exit(1); }

  for (const d of docs) {
    const fs_ = files.filter(f => f.document_id === d.id);
    console.log(`[${d.status}] ${d.doc_number || d.id} · ${String(d.title || '').slice(0, 50)}`);
    console.log(`    ไฟล์ในคลัง ${fs_.length} ไฟล์ · ${fmt(fs_.reduce((s, f) => s + (f.file_size || 0), 0))}`);
    for (const f of fs_) console.log(`      ${f.file_name}  ←  ${f.archive_ref}`);
  }
  if (!files.length) { console.log('\nไม่มีไฟล์ในคลังสำหรับเอกสารที่ระบุ — ไม่ต้องทำอะไร'); return; }
  if (!apply) { console.log('\nนี่คือ dry-run — ตรวจแล้วรันซ้ำด้วย --apply'); return; }

  /* 3. ดึงคืนทีละไฟล์ */
  const tmp = mkdtempSync(join(tmpdir(), 'saedu-restore-'));
  const done = [], skipped = [];
  for (const f of files) {
    const label = `${f.file_name}`;
    const tmpFile = join(tmp, 'f_' + f.id);
    try {
      if (!f.archive_ref) throw new Error('แถวนี้ไม่มี archive_ref');
      if (!f.file_path) throw new Error('แถวนี้ไม่มี file_path เดิมให้วางคืน');

      // 1) โหลดจากคลัง
      rclone(['copyto', `${remote}:${f.archive_ref}`, tmpFile]);
      const buf = readFileSync(tmpFile);
      if (!buf.length) throw new Error('ไฟล์ในคลังว่างเปล่า');

      // 2) อัปขึ้น Storage ที่ path เดิม (upsert เผื่อมีซากค้างจากรอบที่ลบไม่สำเร็จ)
      const { error: upErr } = await sb.storage.from(BUCKET)
        .upload(f.file_path, buf, { upsert: true, contentType: guessType(f.file_name), cacheControl: 'no-store' });
      if (upErr) throw new Error('อัปขึ้น Storage ไม่ได้: ' + upErr.message);

      // 3) โหลดกลับมาเทียบขนาด — ไม่ตรงห้ามแตะ DB
      const { data: back, error: dlErr } = await sb.storage.from(BUCKET).download(f.file_path);
      if (dlErr || !back) throw new Error('อ่านกลับจาก Storage ไม่ได้: ' + (dlErr?.message || 'ไม่มีข้อมูล'));
      const backLen = (await back.arrayBuffer()).byteLength;
      if (backLen !== buf.length) throw new Error(`ขนาดไม่ตรง: Storage ${backLen} · คลัง ${buf.length}`);

      // 4) ล้างตัวชี้คลัง แล้วอ่านกลับยืนยัน
      const { data: upd, error: uErr } = await sb.from('document_files')
        .update({ archive_url: null, archive_ref: null, archived_at: null })
        .eq('id', f.id).eq('archive_url', f.archive_url).select('id,archive_url');
      if (uErr) throw new Error('เขียน DB ล้มเหลว: ' + uErr.message);
      if (!upd || !upd.length || upd[0].archive_url !== null) throw new Error('เขียน DB แล้วไม่มีแถวไหนเปลี่ยน');

      done.push({ file_id: f.id, file_name: f.file_name, file_path: f.file_path, bytes: buf.length, from: f.archive_ref });
      console.log(`  ✓ ${label} (${fmt(buf.length)})`);
    } catch (e) {
      const msg = e.message || String(e);
      skipped.push({ file_id: f.id, file_name: f.file_name, error: msg });
      console.log(`  ✕ ${label} — ${msg}`);
    } finally {
      try { rmSync(tmpFile, { force: true }); } catch {}
    }
  }
  try { rmSync(tmp, { recursive: true, force: true }); } catch {}

  console.log(`\nเสร็จ: ดึงคืน ${done.length} ไฟล์${skipped.length ? ` · ข้าม ${skipped.length}` : ''}`);
  console.log('หน้าเอกสารจะกลับมามีปุ่ม ดู/แก้ไข/โหลด และลงนามต่อได้ทันที (รีเฟรชหน้า)');
  if (skipped.length) { console.error(`\n⚠️  มี ${skipped.length} ไฟล์ที่ดึงคืนไม่สำเร็จ — ลิงก์คลังของไฟล์พวกนั้นยังใช้ได้`); process.exit(1); }
})().catch(e => { console.error('ผิดพลาด:', e.message || e); process.exit(1); });

function guessType(name) {
  const ext = String(name || '').toLowerCase().split('.').pop();
  return ({ pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', doc: 'application/msword',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', html: 'text/html', txt: 'text/plain' })[ext] || 'application/octet-stream';
}
