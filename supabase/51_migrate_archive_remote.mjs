// ============================================================================
// SAEDU Flow — ย้ายคลังเอกสารเก่าจาก remote หนึ่งไปอีก remote (เช่น Google Drive → OneDrive)
//
// ทำอะไร: ไฟล์ที่ 47_archive_to_drive.mjs ย้ายออกจาก Supabase ไปแล้ว (แถวใน document_files
//         ที่มี archive_url) ถูกคัดลอกจาก remote เดิมไป remote ใหม่ทั้งโฟลเดอร์ แล้วสร้างลิงก์ใหม่
//         เขียนทับ archive_url ทีละแถว — archive_ref (path ในคลัง) คงเดิม เพราะโครงโฟลเดอร์เหมือนกัน
//
// ไม่ลบอะไรจาก remote เดิม — เก็บไว้เป็นสำเนาจนกว่าจะแน่ใจว่าลิงก์ใหม่เปิดได้ครบ
//   แล้วค่อยลบเองด้วยมือ (หรือ rclone purge saedu:SaEDU-Archive) ทีหลัง
//
// ── วิธีใช้ ──────────────────────────────────────────────────────────────────
//   node 51_migrate_archive_remote.mjs --from=saedu --to=onedrive --share=org           # dry-run
//   node 51_migrate_archive_remote.mjs --from=saedu --to=onedrive --share=org --apply   # ย้ายจริง
//
//   --root=ชื่อโฟลเดอร์  โฟลเดอร์บนสุดในคลัง (ค่าเริ่มต้น SaEDU-Archive) ต้องตรงกับที่ใช้กับ 47
//   --share=MODE       ลิงก์ที่จะสร้างบน remote ใหม่ — เหมือน 47: org (OneDrive เฉพาะคนในองค์กร)
//                      anyone (ใครมีลิงก์ก็เปิดได้) inherit (Google Drive เท่านั้น)
//   --limit=N          ทำแค่ N แถวแรก — ใช้ทดลองก่อน
//   --skip-copy        ข้ามขั้นคัดลอกทั้งโฟลเดอร์ (ถ้าเพิ่ง rclone copy ไปแล้วและอยากทำแค่ลิงก์)
//
// ── ลำดับการทำงาน ────────────────────────────────────────────────────────────
//   1. rclone copy from:root → to:root ทั้งโฟลเดอร์ทีเดียว (ขนานหลายไฟล์ เร็วกว่าทีละไฟล์มาก
//      ไฟล์ที่มีอยู่แล้วและขนาด/เวลาเท่ากันจะถูกข้าม — รันซ้ำได้)
//   2. lsjson ทั้งสองฝั่งครั้งเดียว แล้วต่อแถว: ไฟล์ต้องมีบนปลายทาง และขนาดเท่าต้นทาง
//      ← ไม่ตรง = ข้ามแถวนั้น ลิงก์เดิมยังใช้ได้
//   3. rclone link บนปลายทาง → เขียน archive_url ใหม่ลง DB แล้วอ่านกลับมายืนยัน
//   แถวที่ archive_url ชี้ไป remote ใหม่อยู่แล้วจะถูกข้าม — รันซ้ำเพื่อเก็บตกได้
//
// env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (เหมือน 47)
// ============================================================================

import { createClient } from '@supabase/supabase-js';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) { console.error('ขาด env: SUPABASE_URL หรือ SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }

const args = process.argv.slice(2);
const argVal = (n, d) => { const hit = args.find(a => a.startsWith(`--${n}=`)); return hit ? hit.split('=').slice(1).join('=') : d; };
const apply    = args.includes('--apply');
const skipCopy = args.includes('--skip-copy');
const from     = argVal('from', '');
const to       = argVal('to', '');
const root     = argVal('root', 'SaEDU-Archive');
const limit    = Number(argVal('limit', '0'));
let shareMode  = argVal('share', '');
if (!from || !to || from === to) { console.error('ต้องระบุ --from=remoteเดิม --to=remoteใหม่ (คนละชื่อ)'); process.exit(1); }

const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

function rclone(argv, { json = false, inherit = false } = {}) {
  const out = execFileSync('rclone', argv, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: inherit ? 'inherit' : ['ignore', 'pipe', 'inherit'] });
  if (inherit) return '';
  return json ? JSON.parse(out || '[]') : out.trim();
}
function remoteTypes() {
  const list = rclone(['listremotes', '--long']).split('\n').map(l => l.trim()).filter(Boolean)
    .map(l => { const m = l.match(/^([^:]+):\s+(\S+)/); return m ? [m[1], m[2]] : null; }).filter(Boolean);
  return Object.fromEntries(list);
}
const types = remoteTypes();
for (const r of [from, to]) {
  if (!types[r]) { console.error(`ไม่พบ remote "${r}" — ที่มี: ${Object.keys(types).join(', ') || '(ไม่มี)'}`); process.exit(1); }
  if (!['drive', 'onedrive'].includes(types[r])) { console.error(`remote "${r}" ชนิด ${types[r]} — รองรับแค่ drive/onedrive`); process.exit(1); }
  try { rclone(['lsd', `${r}:`]); } catch (e) { console.error(`ต่อ remote "${r}" ไม่ได้: ${String(e.message || e).split('\n')[0]}`); process.exit(1); }
}
const toType = types[to];
if (!shareMode) shareMode = toType === 'onedrive' ? 'org' : 'inherit';
if (!['inherit', 'anyone', 'org'].includes(shareMode)) { console.error('--share ต้องเป็น inherit, org หรือ anyone'); process.exit(1); }
if (toType === 'onedrive' && shareMode === 'inherit') { console.error('OneDrive ไม่มี --share=inherit — ใช้ org หรือ anyone'); process.exit(1); }
if (toType === 'drive' && shareMode === 'org') { console.error('Google Drive ไม่มี --share=org — ใช้ inherit หรือ anyone'); process.exit(1); }

/* ลิงก์แบบเดียวกับ 47 */
function makeLink(rel, id) {
  const dest = `${root}/${rel}`;
  if (toType === 'drive') {
    if (shareMode === 'anyone') return rclone(['link', `${to}:${dest}`]);
    if (!id) throw new Error('ไม่ได้ ID ของไฟล์จาก Drive');
    return `https://drive.google.com/file/d/${id}/view`;
  }
  const scope = shareMode === 'org' ? 'organization' : 'anonymous';
  return rclone(['link', `${to}:${dest}`, '--onedrive-link-scope', scope, '--onedrive-link-type', 'view']);
}
/* ลิงก์นี้ชี้ไป remote ชนิดไหน — ใช้ข้ามแถวที่ย้ายแล้ว */
function urlProvider(u) {
  let h = ''; try { h = new URL(u).hostname.toLowerCase(); } catch {}
  if (/(^|\.)(drive|docs)\.google\.com$/.test(h)) return 'drive';
  if (/sharepoint\.com$/.test(h) || /(^|\.)onedrive\.live\.com$/.test(h) || h === '1drv.ms') return 'onedrive';
  return '';
}
const fmt = b => b >= 1048576 ? (b / 1048576).toFixed(1) + ' MB' : (b / 1024).toFixed(0) + ' kB';

(async () => {
  console.log(`โหมด    : ${apply ? '⚠️  ย้ายจริง (--apply)' : 'dry-run (ไม่คัดลอก ไม่เขียน DB)'}`);
  console.log(`จาก     : ${from}:${root} (${types[from]})`);
  console.log(`ไป      : ${to}:${root} (${toType}) · ลิงก์แบบ ${shareMode}\n`);

  /* 1. แถวที่ต้องย้าย */
  const rows = [];
  for (let off = 0; ; off += 1000) {
    const { data, error } = await sb.from('document_files')
      .select('id,document_id,file_name,file_size,archive_url,archive_ref')
      .not('archive_url', 'is', null).order('id').range(off, off + 999);
    if (error) { console.error('อ่าน document_files ล้มเหลว: ' + error.message); process.exit(1); }
    rows.push(...data); if (data.length < 1000) break;
  }
  const prefix = root + '/';
  const skippedPre = [];
  let targets = rows.filter(r => {
    if (!r.archive_ref || !r.archive_ref.startsWith(prefix)) { skippedPre.push({ id: r.id, why: 'archive_ref ไม่อยู่ใต้ ' + root }); return false; }
    if (urlProvider(r.archive_url) === toType) return false;           // ย้ายแล้ว
    return true;
  });
  const already = rows.length - targets.length - skippedPre.length;
  const totalBytes = targets.reduce((s, r) => s + (r.file_size || 0), 0);
  console.log(`ในคลังทั้งหมด ${rows.length} ไฟล์ · ชี้ไป ${to} แล้ว ${already} · ต้องย้าย ${targets.length} ไฟล์ · ${fmt(totalBytes)}`);
  if (skippedPre.length) console.log(`ข้าม ${skippedPre.length} แถวที่ path ไม่อยู่ใต้ ${root}`);
  if (limit > 0 && targets.length > limit) { targets = targets.slice(0, limit); console.log(`จำกัดรอบนี้ (--limit=${limit}): ${targets.length} ไฟล์`); }
  if (!targets.length) { console.log('ไม่มีอะไรต้องย้าย'); return; }
  console.log();

  if (!apply) {
    for (const r of targets.slice(0, 8)) console.log(`  ${r.archive_ref}  (${fmt(r.file_size || 0)})`);
    if (targets.length > 8) console.log(`  … และอีก ${targets.length - 8} ไฟล์`);
    console.log('\nนี่คือ dry-run — ตรวจแล้วรันซ้ำด้วย --apply');
    return;
  }

  /* 2. คัดลอกทั้งโฟลเดอร์ทีเดียว */
  if (!skipCopy) {
    console.log(`คัดลอก ${from}:${root} → ${to}:${root} …`);
    rclone(['copy', `${from}:${root}`, `${to}:${root}`, '--transfers', '8', '--checkers', '8', '--stats', '30s', '--stats-one-line'], { inherit: true });
    console.log('คัดลอกเสร็จ\n');
  }

  /* 3. เทียบไฟล์สองฝั่ง */
  const index = remote => {
    const list = rclone(['lsjson', '--recursive', '--files-only', `${remote}:${root}`], { json: true });
    return new Map(list.map(e => [e.Path, e]));
  };
  console.log('อ่านรายการไฟล์ทั้งสองฝั่ง…');
  const srcIdx = index(from), dstIdx = index(to);
  console.log(`ต้นทาง ${srcIdx.size} ไฟล์ · ปลายทาง ${dstIdx.size} ไฟล์\n`);

  /* 4. ต่อแถว: ตรวจ → ลิงก์ → DB */
  const done = [], skipped = [];
  let n = 0;
  for (const r of targets) {
    n++;
    const rel = r.archive_ref.slice(prefix.length);
    try {
      const src = srcIdx.get(rel), dst = dstIdx.get(rel);
      if (!src) throw new Error('ไม่พบไฟล์บนต้นทาง');
      if (!dst) throw new Error('ไม่พบไฟล์บนปลายทาง (คัดลอกไม่ครบ?)');
      if (Number(src.Size) !== Number(dst.Size)) throw new Error(`ขนาดไม่ตรง: ต้นทาง ${src.Size} · ปลายทาง ${dst.Size}`);
      const url = makeLink(rel, dst.ID);
      if (!/^https:\/\//.test(url)) throw new Error('ลิงก์ที่ได้ไม่ใช่ URL: ' + url);
      const { data: upd, error: uErr } = await sb.from('document_files')
        .update({ archive_url: url }).eq('id', r.id).eq('archive_url', r.archive_url).select('id,archive_url');
      if (uErr) throw new Error('เขียน DB ล้มเหลว: ' + uErr.message);
      if (!upd || !upd.length || upd[0].archive_url !== url) throw new Error('เขียน DB แล้วไม่มีแถวไหนเปลี่ยน');
      done.push({ file_id: r.id, document_id: r.document_id, ref: r.archive_ref, old_url: r.archive_url, new_url: url });
      if (n % 25 === 0 || n === targets.length) console.log(`  ${n}/${targets.length}`);
    } catch (e) {
      const msg = e.message || String(e);
      skipped.push({ file_id: r.id, ref: r.archive_ref, error: msg });
      console.log(`  ✕ ${rel} — ${msg}`);
    }
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const manifest = `migrate-archive-${stamp}.json`;
  writeFileSync(manifest, JSON.stringify({ ran_at: new Date().toISOString(), from, to, to_type: toType, root, share_mode: shareMode, migrated: done.length, skipped: skipped.length, files: done, errors: skipped }, null, 2));
  console.log(`\nเสร็จ: เปลี่ยนลิงก์ ${done.length} ไฟล์${skipped.length ? ` · ข้าม ${skipped.length}` : ''}`);
  console.log(`บันทึกรายการ (ลิงก์เก่า→ใหม่ ใช้ย้อนกลับได้) ไว้ที่ ${manifest}`);
  console.log(`\nสำเนาบน ${from}:${root} ยังอยู่ครบ — ตรวจว่าลิงก์ใหม่เปิดได้แล้วค่อยลบเอง`);
  if (skipped.length) { console.error(`\n⚠️  มี ${skipped.length} ไฟล์ที่ย้ายไม่สำเร็จ — ลิงก์เดิมของไฟล์พวกนั้นยังใช้ได้ ดู ${manifest}`); process.exit(1); }
})().catch(e => { console.error('ผิดพลาด:', e.message || e); process.exit(1); });
