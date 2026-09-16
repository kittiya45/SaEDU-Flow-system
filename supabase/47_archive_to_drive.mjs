// ============================================================================
// SAEDU Flow — ย้ายไฟล์ของเอกสารที่จบแล้วไปเก็บบนคลาวด์ (Google Drive หรือ OneDrive ผ่าน rclone)
//
// ทำอะไร: เอกสารสถานะ completed/cancelled/rejected ที่นิ่งมาเกิน N วัน จะถูกย้าย
//         "ไฟล์แนบ" ออกจาก Supabase Storage ไปไว้บน Google Drive
//         แถวใน document_files ยังอยู่ครบทุกแถว — เพิ่มแค่ archive_url/archive_ref/archived_at
//         ประวัติ ลายเซ็น เลขหนังสือ ผู้อัปโหลด ไม่หายไปไหน หน้าเว็บจะแสดงปุ่ม
//         "เปิดใน Google Drive" แทนปุ่ม ดู/แก้ไข/โหลด เดิม
//
// ทำไมถึงปลอดภัย: เอกสาร 3 สถานะนี้จบกระบวนการแล้ว ไม่มีใครลงนามเพิ่มอีก จึงไม่แตะ
//         pipeline ลายเซ็นเลย (_signPdfWorkingCopy/_signedStablePath/_invalidateFileUrl
//         ทำงานกับเอกสารที่ยังเดินอยู่เท่านั้น ซึ่งสคริปต์นี้ไม่ยุ่งด้วย)
//
// ⚠️ ต้องรัน 46_archive_to_drive.sql ก่อน ไม่งั้นคอลัมน์ยังไม่มี
//
// ── เตรียม rclone (ครั้งเดียว) ──────────────────────────────────────────────
//   brew install rclone
//   rclone config
//     n) New remote
//     name> saedu               ← ชื่ออะไรก็ได้ จำไว้ใช้ตอนรัน
//     Storage> drive            ← พิมพ์ drive
//     client_id / client_secret > กด Enter ข้ามทั้งคู่
//     scope> 1                  ← Full access
//     ที่เหลือกด Enter จนถึง "Use auto config?" ตอบ y แล้วล็อกอิน Google ในเบราว์เซอร์
//   rclone lsd saedu:           ← เช็คว่าต่อติด
//
// ── env ที่ต้องมี ────────────────────────────────────────────────────────────
//   SUPABASE_URL              — https://jrubupvzltxqstzcpoov.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY — Dashboard → Settings → API → secret key (ลับ!)
//
// ── วิธีใช้ ──────────────────────────────────────────────────────────────────
//   node 47_archive_to_drive.mjs --remote=saedu                 # dry-run (ไม่ย้ายอะไร)
//   node 47_archive_to_drive.mjs --remote=saedu --limit=3 --apply   # ลองจริงแค่ 3 เอกสาร
//   node 47_archive_to_drive.mjs --remote=saedu --apply             # ย้ายทั้งหมด
//
//   --min-age-days=N   เอกสารต้องนิ่งมาเกิน N วัน (ค่าเริ่มต้น 30)
//   --statuses=a,b     สถานะที่ย้าย (ค่าเริ่มต้น completed,cancelled,rejected)
//   --root=ชื่อโฟลเดอร์ โฟลเดอร์บนสุดใน Drive (ค่าเริ่มต้น SaEDU-Archive)
//   --limit=N          จำกัดจำนวนเอกสารต่อรอบ — ใช้ทดลองก่อนรันจริงทั้งหมด
//   --share=MODE       ลิงก์ที่จะบันทึกลง DB — ขึ้นกับชนิด remote (สคริปต์อ่านจาก rclone เอง):
//                        inherit  Google Drive เท่านั้น (ค่าเริ่มต้น) ไม่แตะสิทธิ์ ลิงก์จาก file ID
//                                 ใช้สิทธิ์ของโฟลเดอร์แม่ — ต้องแชร์โฟลเดอร์ root เองครั้งเดียว
//                        org      OneDrive for Business เท่านั้น: ลิงก์เปิดได้เฉพาะคนในองค์กร
//                                 (ทุกคนที่มีบัญชี M365 ของสถาบัน) — ค่าที่ควรใช้กับ OneDrive
//                        anyone   ทั้งสองแบบ: ใครมีลิงก์ก็เปิดได้ ไม่หมดอายุ
//                      OneDrive ไม่มีโหมด inherit เพราะไม่มี URL แบบ "เปิดตามสิทธิ์โฟลเดอร์" ให้สร้าง
//                      โดยไม่ผ่าน API แชร์ — ต้องเลือก org หรือ anyone ชัด ๆ
//
// ── OneDrive ──────────────────────────────────────────────────────────────────
//   rclone config → n → name> onedrive → Storage> onedrive → client_id/secret ข้าม → region> 1
//   → advanced n → auto config y → ล็อกอิน Microsoft ในเบราว์เซอร์ → เลือก "OneDrive Personal or Business"
//   → เลือก drive → y → q   แล้วรัน: node 47_archive_to_drive.mjs --remote=onedrive --share=org
//   ถ้าเป็น SharePoint/Teams ของหน่วยงาน เลือก "SharePoint site" ตอน "Type of connection" แทน
//
// ── เรื่องสิทธิ์ ต้องตัดสินใจก่อนรัน ──────────────────────────────────────────
//   inherit (ค่าเริ่มต้น) — ปลอดภัยกว่า ไฟล์เปิดได้เฉพาะคนที่มีสิทธิ์บนโฟลเดอร์คลัง
//     ต้องไปแชร์โฟลเดอร์ root ใน Drive เองครั้งเดียว ให้คนที่ควรเห็น
//     คนที่ไม่มีสิทธิ์กดลิงก์แล้วจะเจอหน้า "ขอสิทธิ์เข้าถึง" ของ Google
//   anyone — ใครถือลิงก์ก็เปิดได้ตลอดไป ไม่มีวันหมดอายุ
//     สะดวกกับผู้ใช้ที่ไม่มีบัญชี Google (อีเมล @gnk.student) แต่ลิงก์หลุด = เอกสารหลุด
//     เอกสารพวกนี้มีลายเซ็นจริงของกรรมการ คิดให้ดีก่อนเลือก
//
// ── ลำดับการทำงานต่อ 1 ไฟล์ (ห้ามสลับ) ──────────────────────────────────────
//   1. โหลดจาก Supabase Storage
//   2. อัปขึ้น Drive
//   3. เทียบขนาดไฟล์บน Drive ว่าตรงกับต้นฉบับ  ← ไม่ตรง = ข้าม ไม่ลบอะไร
//   4. เขียน archive_url ลง DB แล้วอ่านกลับมายืนยัน  ← เขียนไม่ติด = ข้าม ไม่ลบอะไร
//   5. ค่อยลบไฟล์ออกจาก Supabase Storage
//   สลับลำดับเมื่อไหร่ = มีโอกาสลบไฟล์ทิ้งโดยไม่มีที่อยู่ใหม่บันทึกไว้
//
// ⚠️ หลังย้ายแล้ว 45_export_data_json.mjs --files จะไม่ได้ไฟล์พวกนี้อีก (มันไม่อยู่ใน
//    Storage แล้ว) — ตัวคลังบน Drive กลายเป็นต้นฉบับ อย่าลบโฟลเดอร์นั้นเด็ดขาด
// ============================================================================

import { createClient } from '@supabase/supabase-js';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('ขาด env: SUPABASE_URL หรือ SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const args = process.argv.slice(2);
const argVal = (n, d) => {
  const hit = args.find(a => a.startsWith(`--${n}=`));
  return hit ? hit.split('=').slice(1).join('=') : d;
};
const apply      = args.includes('--apply');
const remote     = argVal('remote', process.env.ARCHIVE_RCLONE_REMOTE || '');
const root       = argVal('root', 'SaEDU-Archive');
const minAgeDays = Number(argVal('min-age-days', '30'));
const limit      = Number(argVal('limit', '0'));
const shareMode  = argVal('share', 'inherit');
const statuses   = argVal('statuses', 'completed,cancelled,rejected').split(',').map(s => s.trim()).filter(Boolean);

if (!remote) {
  console.error('ต้องระบุ --remote=ชื่อ rclone remote (เช่น --remote=saedu)\nดูรายชื่อที่ตั้งไว้ด้วย: rclone listremotes');
  process.exit(1);
}
if (!Number.isFinite(minAgeDays) || minAgeDays < 0) { console.error('--min-age-days ต้องเป็นตัวเลข >= 0'); process.exit(1); }
if (!['inherit', 'anyone', 'org'].includes(shareMode)) { console.error("--share ต้องเป็น inherit, org หรือ anyone"); process.exit(1); }
const ALLOWED_ST = ['completed', 'cancelled', 'rejected', 'numbering', 'pending', 'draft', 'awaiting_submit'];
const badSt = statuses.filter(s => !ALLOWED_ST.includes(s));
if (badSt.length) { console.error('สถานะไม่รู้จัก: ' + badSt.join(', ')); process.exit(1); }
if (statuses.some(s => ['pending', 'draft', 'numbering', 'awaiting_submit'].includes(s))) {
  console.error('⚠️  หยุด: กำลังจะย้ายเอกสารที่ยังเดินอยู่ (' + statuses.join(',') + ')');
  console.error('    เอกสารพวกนี้ยังต้องลงนาม/ออกเลข ซึ่งต้องอ่านไฟล์จาก Supabase Storage');
  console.error('    ย้ายไป Drive แล้วขั้นตอนลงนามจะพัง — ย้ายเฉพาะ completed/cancelled/rejected เท่านั้น');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const BUCKET = 'documents';

/* ── rclone helper ── */
function rclone(argv, { json = false } = {}) {
  const out = execFileSync('rclone', argv, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return json ? JSON.parse(out || '[]') : out.trim();
}
/* ชนิดของ remote (drive / onedrive) — ตัดสินว่าใช้ flag อะไรตอนอัป และสร้างลิงก์แบบไหน */
let remoteType = '';
function checkRclone() {
  try { rclone(['version']); }
  catch { console.error('ไม่พบคำสั่ง rclone — ติดตั้งด้วย: brew install rclone'); process.exit(1); }
  let remotes;
  try {
    remotes = rclone(['listremotes', '--long']).split('\n').map(l => l.trim()).filter(Boolean)
      .map(l => { const m = l.match(/^([^:]+):\s+(\S+)/); return m ? { name: m[1], type: m[2] } : null; }).filter(Boolean);
  } catch { console.error('rclone listremotes ล้มเหลว'); process.exit(1); }
  const hit = remotes.find(r => r.name === remote);
  if (!hit) {
    console.error(`ไม่พบ remote "${remote}" — ที่ตั้งไว้มี: ${remotes.map(r => r.name).join(', ') || '(ยังไม่มีเลย)'}`);
    console.error('ตั้งใหม่ด้วย: rclone config');
    process.exit(1);
  }
  remoteType = hit.type;
  if (!['drive', 'onedrive'].includes(remoteType)) {
    console.error(`remote "${remote}" เป็นชนิด ${remoteType} — สคริปต์นี้รองรับแค่ drive (Google Drive) กับ onedrive`);
    process.exit(1);
  }
  if (remoteType === 'onedrive' && shareMode === 'inherit') {
    console.error('OneDrive ไม่มีโหมด --share=inherit — เลือก --share=org (เฉพาะคนในองค์กร) หรือ --share=anyone');
    process.exit(1);
  }
  if (remoteType === 'drive' && shareMode === 'org') {
    console.error('Google Drive ไม่มีโหมด --share=org — ใช้ inherit (แชร์โฟลเดอร์เอง) หรือ anyone');
    process.exit(1);
  }
  try { rclone(['lsd', `${remote}:`]); }
  catch (e) { console.error(`ต่อ remote "${remote}" ไม่ได้: ${String(e.message || e).split('\n')[0]}`); process.exit(1); }
}

/* flag ตอนอัป + วิธีสร้างลิงก์ ต่อชนิด remote — ใช้ร่วมกับ 51_migrate_archive_remote.mjs */
function uploadFlags() {
  return remoteType === 'drive' ? ['--drive-chunk-size', '32M'] : [];
}
function makeLink(dest, id) {
  if (remoteType === 'drive') {
    if (shareMode === 'anyone') return rclone(['link', `${remote}:${dest}`]);
    if (!id) throw new Error('ไม่ได้ ID ของไฟล์จาก Drive');
    return `https://drive.google.com/file/d/${id}/view`;
  }
  // onedrive: rclone link สร้าง sharing link ผ่าน Graph API — scope ตามที่เลือก
  const scope = shareMode === 'org' ? 'organization' : 'anonymous';
  return rclone(['link', `${remote}:${dest}`, '--onedrive-link-scope', scope, '--onedrive-link-type', 'view']);
}

/* ── ชื่อโฟลเดอร์/ไฟล์ที่ปลอดภัยกับ Drive ── */
// ตัดอักขระที่ทั้ง Drive และ OneDrive ไม่รับ + OneDrive ไม่รับชื่อที่ลงท้ายด้วยจุด/ช่องว่าง
const safeSeg = s => String(s || '').replace(/[\/\\:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim().replace(/[. ]+$/, '').slice(0, 120) || 'ไม่มีชื่อ';

/* ชื่อไฟล์ปลายทางต้องไม่ซ้ำกันภายในเอกสารเดียว — บทเรียนราคาแพง (2026-09-14):
   เอกสารหนึ่งมีหลายแถวชื่อเดียวกันเป็นเรื่องปกติของระบบนี้ ("[ลงนาม] X.pdf" ฉบับก่อนและหลังประทับเลข
   เป็นคนละแถว, อัปไฟล์ชื่อเดิมซ้ำเป็น version ใหม่) เดิมตั้งชื่อปลายทางจาก file_name อย่างเดียว
   → แถวที่ย้ายทีหลัง rclone copyto ทับไฟล์ของแถวก่อน ทั้งสองแถวได้ลิงก์เดียวกัน และ Drive ถือแค่
   เนื้อหาของแถวสุดท้าย (99 path / 219 แถว, 31 ไฟล์ที่ Drive ถือเวอร์ชันผิด — กู้จาก Drive revision
   ด้วย 53_repair_archive_collisions.mjs) ตอนนี้ชื่อซ้ำจะได้ " (vN)" ต่อท้าย และถ้า version ซ้ำอีก
   เติม id สั้น ๆ — ชื่อที่ไม่ซ้ำอยู่แล้วคงเดิม ลิงก์เก่าไม่กระทบ */
function uniqueDestNames(rows) {
  const count = new Map();
  for (const f of rows) { const n = safeSeg(f.file_name); count.set(n, (count.get(n) || 0) + 1); }
  const used = new Set(), out = new Map();
  for (const f of rows) {
    let name = safeSeg(f.file_name);
    if (count.get(name) > 1 || used.has(name)) {
      const m = name.match(/^(.*?)(\.[^.]{1,8})?$/);
      const base = m[1], ext = m[2] || '';
      name = `${base} (v${f.version || 1})${ext}`;
      if (used.has(name)) name = `${base} (v${f.version || 1}-${String(f.id).slice(0, 6)})${ext}`;
    }
    used.add(name); out.set(f.id, name);
  }
  return out;
}
const thaiYear = iso => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? 'ไม่ทราบปี' : String(d.getFullYear() + 543); };
const fmt = b => b >= 1048576 ? (b / 1048576).toFixed(1) + ' MB' : (b / 1024).toFixed(0) + ' kB';

(async () => {
  checkRclone();

  const cutoff = new Date(Date.now() - minAgeDays * 86400000).toISOString();
  console.log(`โหมด    : ${apply ? '⚠️  ย้ายจริง (--apply)' : 'dry-run (ไม่ย้าย ไม่ลบอะไร)'}`);
  console.log(`ปลายทาง : ${remote}:${root}`);
  console.log(`สถานะ   : ${statuses.join(', ')} · นิ่งเกิน ${minAgeDays} วัน (ก่อน ${cutoff.slice(0, 10)})`);
  console.log(`ชนิด    : ${remoteType === 'drive' ? 'Google Drive' : 'OneDrive'}`);
  console.log(`สิทธิ์   : ${shareMode === 'anyone' ? '⚠️  ใครมีลิงก์ก็เปิดได้' : shareMode === 'org' ? 'org — เฉพาะคนในองค์กร' : 'inherit — ใช้สิทธิ์ของโฟลเดอร์คลัง'}\n`);

  /* 1. เอกสารที่เข้าเกณฑ์ */
  const { data: docsRaw, error: dErr } = await sb.from('documents')
    .select('id,doc_number,title,status,created_at,updated_at,forwarded_to_id,forwarded_to_staff,accepted_at')
    .in('status', statuses).lt('updated_at', cutoff)
    .order('created_at', { ascending: true });
  if (dErr) { console.error('อ่านตาราง documents ล้มเหลว: ' + dErr.message); process.exit(1); }

  /* 1b. "จบแล้ว" ไม่ได้แปลว่านิ่งแล้ว — สองกรณีนี้เอกสารยังต้องการไฟล์ใน Supabase อยู่ ห้ามย้ายไม่ว่าจะเก่ากี่วัน:
     - completed ที่ส่งต่อให้ จนท. แล้วยังไม่มีใครรับ: จนท. กด "ไม่อนุมัติ — ส่งคืน" ได้ → กลับเป็น rejected
       → ผู้สร้างส่งใหม่ → ผู้ลงนามต้องอ่าน PDF เดิมจาก Storage (เกิดมาแล้ว 3 ครั้ง)
     - มี "เสนอเพื่อโปรดทราบ" ค้าง: ผู้รับทราบต้องประทับลายเซ็นลง PDF เดิม
     ฝั่งเว็บก็กรองไฟล์ในคลังออกจากตัวเลือกลงนามแล้ว (utils.js _signablePdfs) แต่กันตั้งแต่ต้นทางดีกว่า */
  const pendingFwd = new Set(docsRaw.filter(d => (d.forwarded_to_id || d.forwarded_to_staff) && !d.accepted_at).map(d => d.id));
  const pendingAck = new Set();
  {
    const { data: acks, error: aErr } = await sb.from('document_acks').select('document_id').eq('status', 'pending');
    if (aErr) {
      // ตาราง document_acks มีเฉพาะโปรเจกต์ที่รัน 43 แล้ว — ไม่มีก็ถือว่าไม่มี ack ค้าง
      if (!/document_acks|schema cache/i.test(aErr.message)) { console.error('อ่าน document_acks ล้มเหลว: ' + aErr.message); process.exit(1); }
    } else for (const a of acks) pendingAck.add(a.document_id);
  }
  const docs = docsRaw.filter(d => !pendingFwd.has(d.id) && !pendingAck.has(d.id));
  const heldFwd = docsRaw.filter(d => pendingFwd.has(d.id)).length;
  const heldAck = docsRaw.filter(d => !pendingFwd.has(d.id) && pendingAck.has(d.id)).length;
  if (heldFwd || heldAck) {
    console.log(`กันไว้ไม่ย้าย: ${heldFwd} เอกสารยังค้างส่งต่อให้ จนท. · ${heldAck} เอกสารมีรับทราบค้าง (จะย้ายเมื่อขั้นนั้นจบ)`);
  }
  if (!docs.length) { console.log('ไม่มีเอกสารที่เข้าเกณฑ์'); return; }

  /* 2. ไฟล์ที่ยังไม่ถูกย้าย */
  const ids = docs.map(d => d.id);
  const filesByDoc = new Map();
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await sb.from('document_files')
      .select('id,document_id,file_name,file_path,file_size,version,uploaded_at,archive_url')
      .in('document_id', ids.slice(i, i + 200)).is('archive_url', null);
    if (error) {
      if (/archive_url/.test(error.message)) {
        console.error('ยังไม่มีคอลัมน์ archive_url — รัน 46_archive_to_drive.sql ใน SQL Editor ก่อน');
        process.exit(1);
      }
      console.error('อ่าน document_files ล้มเหลว: ' + error.message); process.exit(1);
    }
    for (const f of data) {
      if (!f.file_path) continue;
      if (!filesByDoc.has(f.document_id)) filesByDoc.set(f.document_id, []);
      filesByDoc.get(f.document_id).push(f);
    }
  }

  let targets = docs.filter(d => filesByDoc.has(d.id));
  const totalFiles = targets.reduce((s, d) => s + filesByDoc.get(d.id).length, 0);
  const totalBytes = targets.reduce((s, d) => s + filesByDoc.get(d.id).reduce((a, f) => a + (f.file_size || 0), 0), 0);
  console.log(`เข้าเกณฑ์: ${targets.length} เอกสาร · ${totalFiles} ไฟล์ · ${fmt(totalBytes)}`);
  if (limit > 0 && targets.length > limit) {
    targets = targets.slice(0, limit);
    console.log(`จำกัดรอบนี้ (--limit=${limit}): ${targets.length} เอกสาร`);
  }
  console.log();

  if (!apply) {
    console.log('ตัวอย่าง 10 เอกสารแรกที่จะย้าย:');
    for (const d of targets.slice(0, 10)) {
      const fs_ = filesByDoc.get(d.id);
      const b = fs_.reduce((a, f) => a + (f.file_size || 0), 0);
      console.log(`  [${d.status}] ${d.doc_number || d.id.slice(0, 8)} · ${fs_.length} ไฟล์ · ${fmt(b)} · ${String(d.title || '').slice(0, 40)}`);
      console.log(`      → ${root}/${thaiYear(d.created_at)}/${safeSeg(d.doc_number || d.id.slice(0, 8))}/`);
    }
    if (targets.length > 10) console.log(`  … และอีก ${targets.length - 10} เอกสาร`);
    console.log('\nนี่คือ dry-run — ยังไม่ย้ายอะไร ตรวจแล้วพอใจค่อยรันซ้ำด้วย --apply');
    return;
  }

  /* 3. ย้ายจริง */
  const tmp = mkdtempSync(join(tmpdir(), 'saedu-arch-'));
  const done = [], skipped = [];
  let movedBytes = 0, n = 0;

  for (const d of targets) {
    const folder = `${root}/${thaiYear(d.created_at)}/${safeSeg(d.doc_number || d.id.slice(0, 8))}`;
    const destNames = uniqueDestNames(filesByDoc.get(d.id));
    for (const f of filesByDoc.get(d.id)) {
      n++;
      const label = `${d.doc_number || d.id.slice(0, 8)} · ${f.file_name}`;
      const localName = destNames.get(f.id);
      const dest = `${folder}/${localName}`;
      const tmpFile = join(tmp, 'f_' + f.id);
      try {
        // 1) โหลดจาก Supabase
        const { data: blob, error: dlErr } = await sb.storage.from(BUCKET).download(f.file_path);
        if (dlErr || !blob) throw new Error('โหลดจาก Storage ไม่ได้: ' + (dlErr?.message || 'ไม่มีข้อมูล'));
        const buf = Buffer.from(await blob.arrayBuffer());
        writeFileSync(tmpFile, buf);

        // 2) อัปขึ้น Drive
        rclone(['copyto', tmpFile, `${remote}:${dest}`, ...uploadFlags()]);

        // 3) ยืนยันขนาดบน Drive ตรงกับต้นฉบับ — ไม่ตรงคือไม่สำเร็จ อย่าลบอะไรทั้งนั้น
        const ls = rclone(['lsjson', `${remote}:${dest}`], { json: true });
        const up = Array.isArray(ls) ? ls[0] : null;
        if (!up) throw new Error('อัปขึ้น Drive แล้วหาไฟล์ไม่เจอ');
        if (Number(up.Size) !== buf.length) throw new Error(`ขนาดไม่ตรง: Drive ${up.Size} · ต้นฉบับ ${buf.length}`);

        // ลิงก์: Drive/inherit = file id ตรง ๆ ไม่แตะสิทธิ์ · อื่น ๆ = rclone link (แชร์ตาม scope)
        const url = makeLink(dest, up.ID);
        if (!/^https:\/\//.test(url)) throw new Error('ลิงก์ที่ได้ไม่ใช่ URL: ' + url);

        // 4) เขียน DB แล้วอ่านกลับมายืนยันก่อนลบของจริง
        const { data: upd, error: uErr } = await sb.from('document_files')
          .update({ archive_url: url, archive_ref: dest, archived_at: new Date().toISOString() })
          .eq('id', f.id).is('archive_url', null).select('id,archive_url');
        if (uErr) throw new Error('เขียน DB ล้มเหลว: ' + uErr.message);
        if (!upd || !upd.length || upd[0].archive_url !== url) throw new Error('เขียน DB แล้วไม่มีแถวไหนเปลี่ยน — ไม่ลบไฟล์ต้นทาง');

        // 5) ถึงตรงนี้ค่อยลบออกจาก Supabase Storage
        const { error: rmErr } = await sb.storage.from(BUCKET).remove([f.file_path]);
        if (rmErr) console.log(`  ⚠️  ${label} — ย้ายสำเร็จแต่ลบต้นทางไม่ได้: ${rmErr.message} (รัน 44_cleanup_orphan_storage.mjs เก็บกวาดทีหลังได้ — มันข้ามแถวที่มี archive_url แล้ว)`);

        done.push({ file_id: f.id, document_id: d.id, doc_number: d.doc_number, file_name: f.file_name, bytes: buf.length, drive_path: dest, url });
        movedBytes += buf.length;
        if (n % 10 === 0 || n === totalFiles) console.log(`  ${n}/${targets.reduce((s, x) => s + filesByDoc.get(x.id).length, 0)} · ${fmt(movedBytes)}`);
      } catch (e) {
        const msg = e.message || String(e);
        skipped.push({ file_id: f.id, file_name: f.file_name, doc_number: d.doc_number, error: msg });
        console.log(`  ✕ ${label} — ${msg}`);
      } finally {
        try { rmSync(tmpFile, { force: true }); } catch {}
      }
    }
  }
  try { rmSync(tmp, { recursive: true, force: true }); } catch {}

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const manifest = `archive-to-drive-${stamp}.json`;
  writeFileSync(manifest, JSON.stringify({
    ran_at: new Date().toISOString(), remote, remote_type: remoteType, root, statuses, min_age_days: minAgeDays,
    share_mode: shareMode, moved: done.length, moved_bytes: movedBytes,
    skipped: skipped.length, files: done, errors: skipped,
  }, null, 2));

  console.log(`\nเสร็จ: ย้าย ${done.length} ไฟล์ · คืนพื้นที่ ${fmt(movedBytes)}${skipped.length ? ` · ข้าม ${skipped.length}` : ''}`);
  console.log(`บันทึกรายการไว้ที่ ${manifest}`);
  if (shareMode === 'inherit') {
    console.log(`\n⚠️  อย่าลืมแชร์โฟลเดอร์ "${root}" ใน Google Drive ให้คนที่ต้องเปิดเอกสารได้`);
    console.log('    ไม่งั้นทุกคนจะเจอหน้า "ขอสิทธิ์เข้าถึง" ตอนกดลิงก์');
  }
  if (skipped.length) { console.error(`\n⚠️  มี ${skipped.length} ไฟล์ที่ย้ายไม่สำเร็จ — ไฟล์ต้นทางยังอยู่ครบ ดูรายละเอียดใน ${manifest}`); process.exit(1); }
})().catch(e => { console.error('ผิดพลาด:', e.message || e); process.exit(1); });
