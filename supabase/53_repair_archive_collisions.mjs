// ============================================================================
// SAEDU Flow — ซ่อมคลัง Google Drive ที่หลายแถวชี้ไฟล์เดียวกัน (ชื่อไฟล์ซ้ำในเอกสารเดียว)
//
// เกิดอะไรขึ้น (พบ 2026-09-14): 47 รุ่นก่อนตั้งชื่อปลายทางบน Drive จาก file_name อย่างเดียว
//   เอกสารหนึ่งมีหลายแถวชื่อเดียวกันเป็นปกติ ("[ลงนาม] X.pdf" ก่อน/หลังประทับเลขเป็นคนละแถว)
//   แถวที่ย้ายทีหลังจึง copyto ทับไฟล์ของแถวก่อน → ทั้งคู่ได้ลิงก์เดียวกัน และ Drive ถือเนื้อหา
//   ของแถวสุดท้ายเท่านั้น (99 path / 219 แถว · 31 ไฟล์ที่ Drive ถือเวอร์ชันไม่ใช่ฉบับล่าสุด)
//
// ทำไมกู้ได้: Google Drive เก็บ revision ของไฟล์ที่ถูกอัปทับไว้ (ประมาณ 30 วัน / 100 revision)
//   revisions.list ของไฟล์เหล่านั้นยังมีเนื้อหาของทุกแถวอยู่ครบ — สคริปต์นี้ดึงแต่ละ revision
//   มาเทียบขนาดกับ "ไบต์จริงตอนย้าย" ที่บันทึกไว้ใน manifest ของ 47 (archive-to-drive-*.json)
//   แล้วแยกออกเป็นคนละไฟล์ให้ถูกแถว   ⚠️ ต้องรันก่อน revision รุ่นแรกหมดอายุ (~7 ต.ค. 2569)
//
// ต่อ 1 กลุ่ม (path เดียวกัน หลายแถว):
//   - แถว "ฉบับปัจจุบัน" ตามกติกาหน้าเว็บ (_fileGroups: uploaded_at ใหม่สุด → version) คงอยู่ที่
//     path เดิม ลิงก์เดิม — ถ้า Drive ถือเนื้อหาผิด จะดึง revision ที่ถูกมาอัปทับให้เป็นหัวใหม่
//   - แถวอื่น ๆ ดึง revision ของตัวเองมาอัปเป็นไฟล์ใหม่ชื่อ "X (vN).pdf" แล้วแก้ archive_ref/url
//     ของแถวนั้นให้ชี้ไฟล์ใหม่ (ไม่ลบอะไรบน Drive)
//   - แถวที่หา revision ขนาดตรงไม่เจอ → รายงาน ไม่แตะ (ลิงก์เดิมยังเปิดได้ แค่อาจเป็นคนละเวอร์ชัน)
//
// ── วิธีใช้ ──────────────────────────────────────────────────────────────────
//   node 53_repair_archive_collisions.mjs --remote=saedu            # dry-run: รายงานแผนทั้งหมด
//   node 53_repair_archive_collisions.mjs --remote=saedu --apply    # ซ่อมจริง
//   --manifests=dir1;dir2   โฟลเดอร์ที่มี archive-to-drive-*.json (ค่าเริ่มต้น: โฟลเดอร์นี้ +
//                           ~/Library/Application Support/SaEDU-Flow/archive ที่งานคืนละรอบใช้)
//   --limit=N               ทำแค่ N กลุ่มแรก — ทดลองก่อน
//
// ใช้ token ของ rclone (remote ชนิด drive, scope เต็ม) เรียก Drive API ตรง ๆ เพราะ rclone
// ไม่มีคำสั่งอ่าน revision — ไม่ต้องตั้งค่าอะไรเพิ่ม
// env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (เหมือน 47)
// ============================================================================

import { createClient } from '@supabase/supabase-js';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) { console.error('ขาด env: SUPABASE_URL หรือ SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }

const args = process.argv.slice(2);
const argVal = (n, d) => { const hit = args.find(a => a.startsWith(`--${n}=`)); return hit ? hit.split('=').slice(1).join('=') : d; };
const apply  = args.includes('--apply');
const remote = argVal('remote', process.env.ARCHIVE_RCLONE_REMOTE || 'saedu');
const limit  = Number(argVal('limit', '0'));
const HERE = dirname(fileURLToPath(import.meta.url));
const manifestDirs = argVal('manifests', `${HERE};${join(homedir(), 'Library/Application Support/SaEDU-Flow/archive')}`).split(';').filter(Boolean);

const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const fmt = b => b >= 1048576 ? (b / 1048576).toFixed(1) + ' MB' : (b / 1024).toFixed(0) + ' kB';

/* ── rclone + token ── */
function rclone(argv, { json = false } = {}) {
  const out = execFileSync('rclone', argv, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return json ? JSON.parse(out || '[]') : out.trim();
}
{
  const types = Object.fromEntries(rclone(['listremotes', '--long']).split('\n').map(l => l.trim().match(/^([^:]+):\s+(\S+)/)).filter(Boolean).map(m => [m[1], m[2]]));
  if (types[remote] !== 'drive') { console.error(`remote "${remote}" ต้องเป็นชนิด drive (Google Drive) — ที่มี: ${JSON.stringify(types)}`); process.exit(1); }
}
let _token = '';
function refreshToken() {
  rclone(['lsd', `${remote}:`]);                      // ให้ rclone ต่ออายุ token ก่อน
  const dump = JSON.parse(rclone(['config', 'dump']));
  _token = JSON.parse(dump[remote].token).access_token;
  if (!_token) throw new Error('อ่าน access_token จาก rclone ไม่ได้');
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
/* client_id กลางของ rclone มีโควตา "requests per minute" ที่ใช้ร่วมกับผู้ใช้ทั้งโลก — โดน 403
   rateLimit/quota ได้ง่าย ต้องถอยแล้วลองใหม่แบบ exponential backoff เหมือนที่ rclone ทำเอง */
async function gapi(url, { binary = false } = {}) {
  let wait = 2000, auth401 = 0, netErr = 0;
  for (let attempt = 1; ; attempt++) {
    if (!_token) refreshToken();
    let r;
    try { r = await fetch(url, { headers: { Authorization: `Bearer ${_token}` } }); }
    catch (e) {   // เน็ตสะดุด (fetch failed) — รอแล้วลองใหม่ ไม่ใช่ความผิดของไฟล์
      if (++netErr > 5) throw new Error('เครือข่ายล้มเหลวซ้ำ: ' + (e.message || e));
      await sleep(wait); wait = Math.min(wait * 2, 60000); continue;
    }
    if (r.ok) return binary ? Buffer.from(await r.arrayBuffer()) : r.json();
    const body = await r.text();
    // token หมดอายุกลางทาง (รอบซ่อมใช้เวลาหลายชั่วโมง) — ให้ rclone ต่ออายุแล้วอ่านใหม่ อาจต้องรอ
    // สักครู่ให้ rclone เห็นว่าหมดอายุจริง จึงลองได้ถึง 3 ครั้ง
    if (r.status === 401) { if (++auth401 > 3) throw new Error('ต่ออายุ token ไม่สำเร็จ'); _token = ''; await sleep(3000 * auth401); continue; }
    const throttled = r.status === 429 || (r.status === 403 && /quota|rate ?limit/i.test(body));
    if (throttled && attempt <= 8) { await sleep(wait); wait = Math.min(wait * 2, 60000); continue; }
    throw new Error(`Drive API ${r.status}: ${body.replace(/\s+/g, ' ').slice(0, 160)}`);
  }
}
const fileIdOf = url => { const m = String(url || '').match(/\/file\/d\/([^/?#]+)/); return m ? m[1] : null; };
async function listRevisions(fileId) {
  const j = await gapi(`https://www.googleapis.com/drive/v3/files/${fileId}/revisions?fields=revisions(id,size,modifiedTime)&pageSize=200`);
  return (j.revisions || []).map(r => ({ id: r.id, size: Number(r.size), at: r.modifiedTime })).sort((a, b) => a.at.localeCompare(b.at));
}
const downloadRevision = (fileId, revId) => gapi(`https://www.googleapis.com/drive/v3/files/${fileId}/revisions/${revId}?alt=media`, { binary: true });

/* ── manifest: ไบต์จริงของแต่ละแถวตอนย้าย ── */
const actualBytes = new Map();
for (const dir of manifestDirs) {
  let names = [];
  try { names = readdirSync(dir).filter(n => /^archive-to-drive-.*\.json$/.test(n)); } catch { continue; }
  for (const n of names) {
    try {
      const m = JSON.parse(readFileSync(join(dir, n), 'utf8'));
      for (const f of m.files || []) if (f.file_id && f.bytes) actualBytes.set(f.file_id, f.bytes);
    } catch (e) { console.error(`อ่าน manifest ${n} ไม่ได้: ${e.message}`); }
  }
}
console.log(`manifest: รู้ไบต์จริงของ ${actualBytes.size} แถว จาก ${manifestDirs.join(' · ')}`);

const safeSeg = s => String(s || '').replace(/[\/\\:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim().replace(/[. ]+$/, '').slice(0, 120) || 'ไม่มีชื่อ';
function altName(name, version, id, taken) {
  const m = name.match(/^(.*?)(\.[^.]{1,8})?$/); const base = m[1], ext = m[2] || '';
  let n = `${base} (v${version || 1})${ext}`;
  if (taken.has(n)) n = `${base} (v${version || 1}-${String(id).slice(0, 6)})${ext}`;
  return n;
}

(async () => {
  console.log(`โหมด : ${apply ? '⚠️  ซ่อมจริง (--apply)' : 'dry-run (ไม่อัป ไม่เขียน DB)'}\n`);

  /* 1. กลุ่มที่ชน */
  const rows = [];
  for (let off = 0; ; off += 1000) {
    const { data, error } = await sb.from('document_files')
      .select('id,document_id,file_name,file_size,version,uploaded_at,archive_url,archive_ref')
      .not('archive_ref', 'is', null).order('id').range(off, off + 999);
    if (error) { console.error('อ่าน document_files ล้มเหลว: ' + error.message); process.exit(1); }
    rows.push(...data); if (data.length < 1000) break;
  }
  const groups = new Map();
  for (const r of rows) { if (!groups.has(r.archive_ref)) groups.set(r.archive_ref, []); groups.get(r.archive_ref).push(r); }
  let shared = [...groups.entries()].filter(([, l]) => l.length > 1);
  console.log(`แถวในคลัง ${rows.length} · path ที่ถูกใช้ร่วม ${shared.length} (${shared.reduce((s, [, l]) => s + l.length, 0)} แถว)`);
  if (limit > 0) shared = shared.slice(0, limit);
  if (!shared.length) { console.log('ไม่มีอะไรต้องซ่อม'); return; }

  /* 2. วางแผน / ทำ ต่อกลุ่ม */
  const tmp = mkdtempSync(join(tmpdir(), 'saedu-repair-'));
  const report = { ran_at: new Date().toISOString(), apply, groups: [] };
  let nFixedHead = 0, nSplit = 0, nUnrecoverable = 0, nDb = 0;
  const folderNames = new Map();   // folder → Set ชื่อไฟล์ที่มีอยู่ (กันตั้งชื่อใหม่ไปชนของเดิม)
  const namesIn = folder => {
    if (!folderNames.has(folder)) {
      try { folderNames.set(folder, new Set(rclone(['lsjson', `${remote}:${folder}`], { json: true }).map(e => e.Name))); }
      catch { folderNames.set(folder, new Set()); }
    }
    return folderNames.get(folder);
  };

  for (const [ref, list] of shared) {
    await sleep(700);   // เว้นจังหวะกันชนโควตาต่อนาที
    const g = { ref, rows: [], actions: [] };
    report.groups.push(g);
    const folder = ref.slice(0, ref.lastIndexOf('/')), baseName = ref.slice(ref.lastIndexOf('/') + 1);
    list.sort((a, b) => (new Date(b.uploaded_at) - new Date(a.uploaded_at)) || ((b.version || 1) - (a.version || 1)));
    const cur = list[0];
    const ids = new Set(list.map(r => fileIdOf(r.archive_url)).filter(Boolean));
    console.log(`\n${ref.replace(/^SaEDU-Archive\//, '')}  (${list.length} แถว)`);
    if (ids.size !== 1) { console.log('  ⚠️  แถวในกลุ่มชี้ Drive file คนละ ID — ข้าม'); g.actions.push({ skip: 'mixed file ids' }); continue; }
    const fileId = [...ids][0];
    let revs;
    try { revs = await listRevisions(fileId); }
    catch (e) { console.log('  ✕ อ่าน revision ไม่ได้: ' + e.message); g.actions.push({ skip: e.message }); continue; }
    const head = revs[revs.length - 1];
    const usedRev = new Set();
    const pick = row => {
      const want = actualBytes.get(row.id) || row.file_size;
      let cands = revs.filter(r => r.size === Number(want) && !usedRev.has(r.id));
      let reused = false;
      if (!cands.length) {
        // ไม่มี revision ว่างขนาดตรง แต่มีอันที่แถวอื่นใช้ไปแล้วขนาดเท่ากัน — สองแถวอัปไฟล์เดียวกัน
        // ซ้ำ (เช่น .docx ที่แนบสองครั้ง) Drive ไม่สร้าง revision ใหม่ให้เนื้อหาเหมือนเดิม ใช้ร่วมได้
        cands = revs.filter(r => r.size === Number(want)); reused = cands.length > 0;
      }
      return { want, rev: cands.length ? cands[cands.length - 1] : null, reused };
    };

    for (const row of list) {
      const isCur = row.id === cur.id;
      const { want, rev, reused } = pick(row);
      if (rev) usedRev.add(rev.id);
      if (reused) console.log(`  · [v${row.version || 1}] ขนาดเท่ากับ revision ที่แถวอื่นใช้แล้ว — ถือว่าเนื้อหาเดียวกัน`);
      const tag = isCur ? 'ปัจจุบัน' : `v${row.version || 1}`;
      g.rows.push({ file_id: row.id, version: row.version, uploaded_at: row.uploaded_at, is_current: isCur, expected_bytes: want, revision: rev ? rev.id : null });
      if (!rev) {
        nUnrecoverable++;
        console.log(`  ✕ [${tag}] ${row.file_name} — ไม่พบ revision ขนาด ${want} (มี: ${revs.map(r => r.size).join(', ')})`);
        g.actions.push({ file_id: row.id, result: 'no matching revision', expected: want });
        continue;
      }
      if (isCur) {
        if (head && head.size === rev.size) { console.log(`  ✓ [ปัจจุบัน] ${row.file_name} — Drive ถือเนื้อหาถูกอยู่แล้ว`); g.actions.push({ file_id: row.id, result: 'head ok' }); continue; }
        // Drive ถือเวอร์ชันอื่น → ดึง revision ที่ถูกมาอัปทับ path เดิม (ลิงก์/ID เดิม)
        console.log(`  ↻ [ปัจจุบัน] ${row.file_name} — Drive ถือ ${head.size} ต้องเป็น ${rev.size} → อัปทับด้วย revision ที่ถูก`);
        if (apply) {
          try {
            const buf = await downloadRevision(fileId, rev.id);
            if (buf.length !== rev.size) throw new Error(`โหลด revision ได้ ${buf.length} ไม่ตรง ${rev.size}`);
            const tf = join(tmp, 'h_' + row.id); writeFileSync(tf, buf);
            rclone(['copyto', tf, `${remote}:${ref}`, '--drive-chunk-size', '32M']);
            const chk = rclone(['lsjson', `${remote}:${ref}`], { json: true })[0];
            if (!chk || Number(chk.Size) !== buf.length) throw new Error('อัปทับแล้วขนาดไม่ตรง');
            if (chk.ID !== fileId) throw new Error('อัปทับแล้ว ID เปลี่ยน (ไม่ควรเกิด)');
            rmSync(tf, { force: true });
            nFixedHead++; g.actions.push({ file_id: row.id, result: 'head replaced', bytes: buf.length });
          } catch (e) { console.log('     ✕ ' + e.message); g.actions.push({ file_id: row.id, result: 'head replace FAILED', error: e.message }); }
        } else { nFixedHead++; g.actions.push({ file_id: row.id, result: 'would replace head' }); }
        continue;
      }
      // แถวอื่น → แยกออกเป็นไฟล์ใหม่
      const taken = namesIn(folder);
      const newName = altName(safeSeg(baseName), row.version, row.id, taken);
      const newRef = `${folder}/${newName}`;
      console.log(`  → [${tag}] ${row.file_name} — แยกเป็น "${newName}" (${fmt(rev.size)})`);
      if (!apply) { taken.add(newName); nSplit++; g.actions.push({ file_id: row.id, result: 'would split', new_ref: newRef }); continue; }
      try {
        const buf = await downloadRevision(fileId, rev.id);
        if (buf.length !== rev.size) throw new Error(`โหลด revision ได้ ${buf.length} ไม่ตรง ${rev.size}`);
        const tf = join(tmp, 's_' + row.id); writeFileSync(tf, buf);
        rclone(['copyto', tf, `${remote}:${newRef}`, '--drive-chunk-size', '32M']);
        const up = rclone(['lsjson', `${remote}:${newRef}`], { json: true })[0];
        if (!up || Number(up.Size) !== buf.length) throw new Error('อัปแล้วขนาดไม่ตรง');
        if (!up.ID) throw new Error('ไม่ได้ ID จาก Drive');
        rmSync(tf, { force: true });
        taken.add(newName);
        const url = `https://drive.google.com/file/d/${up.ID}/view`;
        const { data: upd, error: uErr } = await sb.from('document_files')
          .update({ archive_url: url, archive_ref: newRef }).eq('id', row.id).eq('archive_url', row.archive_url).select('id,archive_url');
        if (uErr) throw new Error('เขียน DB ล้มเหลว: ' + uErr.message);
        if (!upd || !upd.length || upd[0].archive_url !== url) throw new Error('เขียน DB แล้วไม่มีแถวไหนเปลี่ยน');
        nSplit++; nDb++;
        g.actions.push({ file_id: row.id, result: 'split', new_ref: newRef, new_url: url, old_url: row.archive_url, bytes: buf.length });
      } catch (e) { console.log('     ✕ ' + e.message); g.actions.push({ file_id: row.id, result: 'split FAILED', error: e.message }); }
    }
  }
  try { rmSync(tmp, { recursive: true, force: true }); } catch {}

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const out = `repair-archive-${stamp}.json`;
  writeFileSync(out, JSON.stringify({ ...report, summary: { head_fixed: nFixedHead, split: nSplit, db_updated: nDb, unrecoverable: nUnrecoverable } }, null, 2));
  console.log(`\n${apply ? 'เสร็จ' : 'แผน'}: อัปทับหัวไฟล์ให้ถูก ${nFixedHead} · แยกไฟล์ ${nSplit}${apply ? ` (แก้ DB ${nDb})` : ''} · กู้ไม่ได้ ${nUnrecoverable}`);
  console.log(`บันทึกรายละเอียดไว้ที่ ${out}`);
  if (!apply) console.log('นี่คือ dry-run — ตรวจแล้วรันซ้ำด้วย --apply');
})().catch(e => { console.error('ผิดพลาด:', e.message || e); process.exit(1); });
