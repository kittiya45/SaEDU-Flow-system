// ============================================================================
// SAEDU Flow — ลบเอกสารที่ "ยกเลิกแล้ว" ออกจากระบบถาวร หลังผ่านไป N วัน (ค่าเริ่มต้น 3)
//
// ตัดสินใจ 2026-09-18: เอกสารที่ยกเลิกไม่ต้องเก็บไว้เป็นหลักฐานอีก — เดิม "ยกเลิก" เก็บทุกอย่างไว้
// (ต่างจาก "ลบเอกสาร" ของแอดมิน) ทำให้มี 49 ฉบับค้างในรายการ และไฟล์ของมันถูก 47 ขนขึ้นคลาวด์
// ทั้งที่ไม่มีใครต้องการอีก ตอนนี้: ยกเลิกแล้วมีเวลา N วันให้แอดมินเปลี่ยนสถานะกลับ พ้นนั้นลบทิ้ง
//
// ทำอะไร ต่อ 1 เอกสาร (เรียงให้ล้มกลางทางแล้วรอบถัดไปเก็บต่อได้ ไม่เหลือขยะที่ไม่มีใครรู้จัก):
//   1. อ่านสถานะสด ๆ อีกครั้ง — ต้องยัง cancelled อยู่ (แอดมินอาจเปลี่ยนกลับระหว่างวัน)
//   2. ลบไฟล์ใน Supabase Storage (แถวที่ยังไม่ถูกย้ายไปคลัง)
//   3. ลบไฟล์ในคลาวด์ (แถวที่มี archive_ref) จากทุก remote ใน --remotes ที่มีไฟล์นั้น
//      — คลังถูก mirror ไว้สองที่ (saedu → onedrive) จึงต้องลบทั้งคู่ ไม่งั้น mirror เก็บซากไว้ตลอด
//   4. ลบแถว documents — FK ON DELETE CASCADE เก็บ workflow_steps / document_files /
//      document_history / document_acks / notifications ของฉบับนั้นให้เอง
//   ทุกแถวที่จะหายถูก snapshot ลง manifest ก่อนเริ่มลบ (purge-cancelled-*.json — gitignored)
//
// สิ่งที่ "ไม่ลบ" แม้จะยกเลิกครบวันแล้ว:
//   - เอกสารที่เลขหนังสือจริง (กนค. …) เป็นเลข "สูงสุด" ในหมวดของมัน ณ ตอนนี้
//     เพราะ _nextDocNum() (docNum.js) ออกเลขถัดไปจาก max+1 ของเลขที่มีอยู่ — ลบตัวที่เป็น max
//     = เลขนั้นถูกออกซ้ำให้เอกสารใบใหม่ ทั้งที่ใบเดิมอาจส่งถึงคณะไปแล้ว รอจนมีเลขที่สูงกว่า
//     ในหมวดเดียวกันค่อยลบ (สคริปต์เช็คใหม่ทุกคืน)
//   - เอกสารที่ลบไฟล์ในคลาวด์ไม่ได้ (rclone ล่ม/ไม่มีสิทธิ์) — ข้ามทั้งฉบับ ไม่ลบแถว DB
//     เพื่อให้ archive_ref ยังชี้ไปที่ไฟล์ค้างนั้นและรอบหน้าลองใหม่ได้
//
// ── วิธีใช้ ──────────────────────────────────────────────────────────────────
//   node 54_purge_cancelled_docs.mjs                       # dry-run: บอกว่าจะลบอะไร
//   node 54_purge_cancelled_docs.mjs --apply               # ลบจริง
//   --min-age-days=N   ยกเลิกมาแล้วเกิน N วัน (ไม่ระบุ = app_settings.cancel_purge_days หรือ 3; 0 = ปิดการลบ)
//   --remotes=a,b      remote ใน rclone ที่ต้องลบไฟล์คลังออก (ค่าเริ่มต้น saedu,onedrive — ที่ไม่มีในเครื่องจะข้าม)
//   --doc=เลข;uuid     เจาะจงบางฉบับ (คั่นด้วย ; เพราะเลขหนังสือมี , ได้) — ยังต้องเข้าเกณฑ์ทุกข้อ
//   --limit=N          ลบไม่เกิน N ฉบับต่อรอบ
//
// env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (เหมือน 47) — key อยู่ใน Keychain:
//   export SUPABASE_SERVICE_ROLE_KEY="$(security find-generic-password -s saedu-service-role -w)"
// ============================================================================

import { createClient } from '@supabase/supabase-js';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) { console.error('ขาด env: SUPABASE_URL หรือ SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }

const args = process.argv.slice(2);
const argVal = (n, d) => { const hit = args.find(a => a.startsWith(`--${n}=`)); return hit ? hit.split('=').slice(1).join('=') : d; };
const apply   = args.includes('--apply');
const ageArg  = argVal('min-age-days', '');
const remotes = argVal('remotes', process.env.PURGE_RCLONE_REMOTES || 'saedu,onedrive').split(',').map(s => s.trim()).filter(Boolean);
const limit   = Number(argVal('limit', '0'));
const wanted  = argVal('doc', '').split(';').map(s => s.trim()).filter(Boolean);
if (ageArg !== '' && (!Number.isFinite(Number(ageArg)) || Number(ageArg) < 0)) { console.error('--min-age-days ต้องเป็นตัวเลข >= 0'); process.exit(1); }

const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const BUCKET = 'documents';
const HERE = dirname(fileURLToPath(import.meta.url));
const isUuid = s => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
const fmt = b => b >= 1048576 ? (b / 1048576).toFixed(1) + ' MB' : (b / 1024).toFixed(0) + ' kB';
const die = (m) => { console.error(m); process.exit(1); };

/* ── rclone (ใช้เฉพาะเมื่อมีแถวที่อยู่ในคลัง) ── */
function rclone(argv) {
  return execFileSync('rclone', argv, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}
let liveRemotes = null;   // null = ยังไม่เช็ค · [] = ไม่มี rclone หรือไม่มี remote ที่ใช้ได้
function ensureRemotes() {
  if (liveRemotes) return liveRemotes;
  liveRemotes = [];
  let names = [];
  try { names = rclone(['listremotes']).split('\n').map(l => l.trim().replace(/:$/, '')).filter(Boolean); }
  catch { return liveRemotes; }
  for (const r of remotes) if (names.includes(r)) liveRemotes.push(r);
  return liveRemotes;
}
/* ลบ 1 ไฟล์จาก 1 remote — "ไม่มีไฟล์" ถือว่าสำเร็จ (คลังอยู่แค่ฝั่งเดียวได้) ที่เหลือ throw */
function cloudDelete(remote, ref) {
  try { rclone(['deletefile', `${remote}:${ref}`]); return 'deleted'; }
  catch (e) {
    const err = String(e.stderr || e.message || e);
    if (/not found|doesn't exist|does not exist|no such/i.test(err)) return 'absent';
    throw new Error(`${remote}: ${err.split('\n').filter(Boolean).pop() || 'rclone ล้มเหลว'}`);
  }
}

/* เลขหนังสือจริง กนค. {หมวด}{NNN}[-{ชมรม}]/{ปี} — แยกหมวดออกจากลำดับ ให้ตรงกับ _nextDocNum() */
function parseRealNum(n) {
  const m = /^กนค\. (\d+?)(\d{3})(?:-(\d+))?\/(\d{4})$/.exec(String(n || ''));
  return m ? { cat: m[1], seq: Number(m[2]), club: m[3] || '', year: m[4] } : null;
}

(async () => {
  /* 0. อายุขั้นต่ำ — แอดมินตั้งได้ในหน้า "ตั้งค่าระบบ" (cancel_purge_days) ให้ตรงกับที่ modal ยกเลิกบอกผู้ใช้ */
  let minAgeDays = 3, ageSrc = 'ค่าเริ่มต้น';
  if (ageArg !== '') { minAgeDays = Number(ageArg); ageSrc = '--min-age-days'; }
  else {
    const { data } = await sb.from('app_settings').select('value').eq('key', 'cancel_purge_days').maybeSingle();
    if (data && data.value !== null && data.value !== '' && Number.isFinite(Number(data.value)) && Number(data.value) >= 0) {
      minAgeDays = Number(data.value); ageSrc = 'app_settings.cancel_purge_days';
    }
  }
  const cutoff = new Date(Date.now() - minAgeDays * 86400000).toISOString();
  console.log(`โหมด  : ${apply ? '⚠️  ลบจริง (--apply)' : 'dry-run (ไม่ลบอะไร)'}`);
  console.log(`เกณฑ์ : ยกเลิกมาแล้วเกิน ${minAgeDays} วัน (${ageSrc}) → ก่อน ${cutoff.slice(0, 16).replace('T', ' ')}`);
  if (minAgeDays === 0) { console.log('cancel_purge_days = 0 — ปิดการลบอัตโนมัติ ไม่ทำอะไร'); console.log('เสร็จ: ปิดการลบ (0 วัน)'); return; }

  /* 1. เอกสารที่ยกเลิกแล้ว */
  let q = sb.from('documents').select('id,doc_number,doc_type,title,status,created_at,updated_at').eq('status', 'cancelled');
  if (wanted.length) {
    const ids = wanted.filter(isUuid), nums = wanted.filter(w => !isUuid(w));
    q = q.or([ids.length ? `id.in.(${ids.join(',')})` : '', nums.length ? `doc_number.in.(${nums.map(n => `"${n.replace(/"/g, '')}"`).join(',')})` : ''].filter(Boolean).join(','));
  }
  const { data: cancelled, error: dErr } = await q.order('updated_at', { ascending: true });
  if (dErr) die('อ่านตาราง documents ล้มเหลว: ' + dErr.message);
  if (!cancelled.length) { console.log('ไม่มีเอกสารสถานะยกเลิกแล้ว'); console.log('เสร็จ: ลบ 0 เอกสาร'); return; }

  /* 1b. เวลายกเลิกจริง = แถว "ยกเลิกเอกสาร" ล่าสุดใน document_history (updated_at ถูกเขียนทับได้จาก
     การแก้อย่างอื่น เช่น แอดมินเปลี่ยนสถานะไปมา) — ใช้ค่าที่ใหม่กว่าระหว่างสองอย่างนั้น */
  const cancelledAt = new Map(cancelled.map(d => [d.id, d.updated_at]));
  {
    const ids = cancelled.map(d => d.id);
    for (let i = 0; i < ids.length; i += 200) {
      const { data, error } = await sb.from('document_history').select('document_id,performed_at')
        .eq('action', 'ยกเลิกเอกสาร').in('document_id', ids.slice(i, i + 200));
      if (error) die('อ่าน document_history ล้มเหลว: ' + error.message);
      for (const h of data) if (h.performed_at > (cancelledAt.get(h.document_id) || '')) cancelledAt.set(h.document_id, h.performed_at);
    }
  }
  const aged = cancelled.filter(d => (cancelledAt.get(d.id) || d.updated_at) < cutoff);
  const tooNew = cancelled.length - aged.length;

  /* 1c. กันเลขหนังสือถูกออกซ้ำ — ดูเลขจริงทั้งระบบ (ทุกสถานะ) ว่าฉบับไหนเป็น max ของหมวดตัวเอง */
  const { data: numbered, error: nErr } = await sb.from('documents').select('id,doc_type,doc_number').like('doc_number', 'กนค. %');
  if (nErr) die('อ่านเลขหนังสือล้มเหลว: ' + nErr.message);
  const maxSeq = new Map();   // key หมวด → seq สูงสุด
  const keyOf = (d, p) => `${d.doc_type}|${p.cat}|${p.club}|${p.year}`;
  for (const d of numbered) { const p = parseRealNum(d.doc_number); if (!p) continue; const k = keyOf(d, p); if ((maxSeq.get(k) || 0) < p.seq) maxSeq.set(k, p.seq); }
  const held = [], targets = [];
  for (const d of aged) {
    const p = parseRealNum(d.doc_number);
    if (p && maxSeq.get(keyOf(d, p)) === p.seq) held.push(d); else targets.push(d);
  }

  /* 2. ไฟล์ของแต่ละฉบับ — แยกที่ยังอยู่ใน Storage กับที่อยู่ในคลัง */
  const filesByDoc = new Map();
  {
    const ids = targets.map(d => d.id);
    for (let i = 0; i < ids.length; i += 200) {
      const { data, error } = await sb.from('document_files').select('*').in('document_id', ids.slice(i, i + 200));
      if (error) die('อ่าน document_files ล้มเหลว: ' + error.message);
      for (const f of data) { if (!filesByDoc.has(f.document_id)) filesByDoc.set(f.document_id, []); filesByDoc.get(f.document_id).push(f); }
    }
  }
  const liveOf = d => (filesByDoc.get(d.id) || []).filter(f => f.file_path && !f.archive_url);
  const archOf = d => (filesByDoc.get(d.id) || []).filter(f => f.archive_url);
  const needCloud = targets.some(d => archOf(d).length);
  const live = needCloud ? ensureRemotes() : [];

  console.log(`ยกเลิกแล้วทั้งหมด ${cancelled.length} ฉบับ · ยังไม่ครบ ${minAgeDays} วัน ${tooNew} ฉบับ · เข้าเกณฑ์ ${aged.length} ฉบับ`);
  if (held.length) {
    console.log(`กันไว้ ${held.length} ฉบับ — เลขหนังสือยังเป็นเลขสูงสุดของหมวด ลบแล้วเลขจะถูกออกซ้ำ (จะลบเมื่อมีเลขถัดไปในหมวดนั้น):`);
    for (const d of held) console.log(`  ⏸ ${d.doc_number} · ${String(d.title || '').slice(0, 45)}`);
  }
  if (needCloud) console.log(`คลัง  : ${live.length ? 'ลบจาก ' + live.join(', ') : '⚠️  ไม่พบ rclone/remote ที่ใช้ได้ — ฉบับที่มีไฟล์ในคลังจะถูกข้าม'}`);

  let batch = targets;
  if (limit > 0 && batch.length > limit) { batch = batch.slice(0, limit); console.log(`จำกัดรอบนี้ (--limit=${limit}): ${batch.length} ฉบับ`); }
  const totalLive = batch.reduce((s, d) => s + liveOf(d).length, 0);
  const totalArch = batch.reduce((s, d) => s + archOf(d).length, 0);
  const totalBytes = batch.reduce((s, d) => s + liveOf(d).reduce((a, f) => a + (f.file_size || 0), 0), 0);
  console.log(`จะลบ  : ${batch.length} ฉบับ · ไฟล์ใน Storage ${totalLive} (${fmt(totalBytes)}) · ไฟล์ในคลัง ${totalArch}\n`);
  if (!batch.length) { console.log('เสร็จ: ลบ 0 เอกสาร'); return; }

  for (const d of batch.slice(0, 15)) {
    const days = Math.floor((Date.now() - new Date(cancelledAt.get(d.id) || d.updated_at).getTime()) / 86400000);
    console.log(`  ✕ ${d.doc_number || d.id.slice(0, 8)} · ยกเลิกเมื่อ ${days} วันก่อน · Storage ${liveOf(d).length} · คลัง ${archOf(d).length} · ${String(d.title || '').slice(0, 40)}`);
  }
  if (batch.length > 15) console.log(`  … และอีก ${batch.length - 15} ฉบับ`);
  if (!apply) { console.log('\nนี่คือ dry-run — ยังไม่ลบอะไร ตรวจแล้วพอใจค่อยรันซ้ำด้วย --apply'); console.log('เสร็จ: dry-run ' + batch.length + ' เอกสาร'); return; }

  /* 3. snapshot ทุกแถวที่จะหายลง manifest ก่อนแตะอะไร — ไม่มีวิธีกู้อื่นหลังลบ */
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const manifestPath = join(HERE, `purge-cancelled-${stamp}.json`);
  const snapshot = [];
  for (const d of batch) {
    const ids = [d.id];
    const [steps, hist, acks, notifs] = await Promise.all([
      sb.from('workflow_steps').select('*').in('document_id', ids),
      sb.from('document_history').select('*').in('document_id', ids),
      sb.from('document_acks').select('*').in('document_id', ids),
      sb.from('notifications').select('*').in('document_id', ids),
    ]);
    for (const r of [steps, hist, notifs]) if (r.error) die('snapshot ล้มเหลว: ' + r.error.message);
    // document_acks มีเฉพาะโปรเจกต์ที่รัน 43 แล้ว
    if (acks.error && !/document_acks|schema cache/i.test(acks.error.message)) die('snapshot document_acks ล้มเหลว: ' + acks.error.message);
    const { data: full, error: fErr } = await sb.from('documents').select('*').eq('id', d.id).single();
    if (fErr) die('snapshot documents ล้มเหลว: ' + fErr.message);
    snapshot.push({ document: full, files: filesByDoc.get(d.id) || [], workflow_steps: steps.data, document_history: hist.data, document_acks: acks.data || [], notifications: notifs.data });
  }
  const writeManifest = (extra) => writeFileSync(manifestPath, JSON.stringify({ ran_at: new Date().toISOString(), min_age_days: minAgeDays, cutoff, remotes: live, held: held.map(d => ({ id: d.id, doc_number: d.doc_number })), snapshot, ...extra }, null, 2));
  writeManifest({ status: 'in-progress' });

  /* 4. ลบจริง */
  const done = [], skipped = [];
  let freedBytes = 0;
  for (const d of batch) {
    const label = d.doc_number || d.id.slice(0, 8);
    try {
      // 4.1 สถานะสด — แอดมินเปลี่ยนกลับระหว่างที่สคริปต์รันอยู่ก็ได้
      const { data: fresh, error: rErr } = await sb.from('documents').select('status').eq('id', d.id).maybeSingle();
      if (rErr) throw new Error('อ่านสถานะสดไม่ได้: ' + rErr.message);
      if (!fresh) { skipped.push({ id: d.id, doc_number: d.doc_number, reason: 'ถูกลบไปแล้ว' }); continue; }
      if (fresh.status !== 'cancelled') { skipped.push({ id: d.id, doc_number: d.doc_number, reason: 'สถานะเปลี่ยนเป็น ' + fresh.status }); console.log(`  ↩ ${label} — สถานะไม่ใช่ยกเลิกแล้ว (${fresh.status}) ข้าม`); continue; }

      // 4.2 ไฟล์ในคลาวด์ก่อน — ถ้าลบไม่ได้ต้องหยุดทั้งฉบับ ไม่งั้น archive_ref ที่ชี้ไปหามันจะหายไปกับแถว
      const arch = archOf(d);
      if (arch.length && !live.length) throw new Error('มีไฟล์ในคลัง แต่ไม่มี remote ให้ลบ');
      const cloud = [];
      for (const f of arch) {
        if (!f.archive_ref) throw new Error(`แถว ${f.file_name} อยู่ในคลังแต่ไม่มี archive_ref — ลบมือก่อน: ${f.archive_url}`);
        for (const r of live) cloud.push({ remote: r, ref: f.archive_ref, result: cloudDelete(r, f.archive_ref) });
      }
      // โฟลเดอร์ของเอกสารในคลังว่างแล้วก็เก็บทิ้ง (ไม่สำคัญ — ล้มก็ช่าง)
      for (const r of live) for (const dir of new Set(arch.map(f => dirname(f.archive_ref)))) { try { rclone(['rmdir', `${r}:${dir}`]); } catch {} }

      // 4.3 ไฟล์ใน Storage — remove() ไม่ error เมื่อไม่มีไฟล์ จึงรันซ้ำได้
      const paths = liveOf(d).map(f => f.file_path);
      if (paths.length) {
        const { error: sErr } = await sb.storage.from(BUCKET).remove(paths);
        if (sErr) throw new Error('ลบจาก Storage ไม่ได้: ' + sErr.message);
      }

      // 4.4 แถว DB — ใส่เงื่อนไข status อีกชั้น + select กลับมายืนยันว่าหายจริง
      const { data: del, error: delErr } = await sb.from('documents').delete().eq('id', d.id).eq('status', 'cancelled').select('id');
      if (delErr) throw new Error('ลบแถว documents ไม่ได้: ' + delErr.message);
      if (!del || !del.length) throw new Error('ลบแถว documents แล้วไม่มีแถวไหนหาย');

      const bytes = liveOf(d).reduce((a, f) => a + (f.file_size || 0), 0);
      freedBytes += bytes;
      done.push({ id: d.id, doc_number: d.doc_number, title: d.title, storage_files: paths.length, cloud, bytes });
      console.log(`  ✓ ${label} · Storage ${paths.length} ไฟล์ · คลัง ${arch.length} ไฟล์ · ${fmt(bytes)}`);
    } catch (e) {
      const msg = e.message || String(e);
      skipped.push({ id: d.id, doc_number: d.doc_number, reason: msg });
      console.log(`  ✕ ${label} — ${msg}`);
    }
  }

  writeManifest({ status: 'done', done, skipped });
  console.log(`\nmanifest: ${manifestPath}`);
  const nFiles = done.reduce((s, x) => s + x.storage_files, 0);
  console.log(`เสร็จ: ลบ ${done.length} เอกสาร · ${nFiles} ไฟล์ · ${fmt(freedBytes)}${skipped.length ? ` · ข้าม ${skipped.length}` : ''}${held.length ? ` · กันไว้ ${held.length}` : ''}`);
  if (skipped.some(s => !/สถานะเปลี่ยน|ถูกลบไปแล้ว/.test(s.reason))) process.exit(2);
})().catch(e => { console.error('ล้มเหลว: ' + (e.message || e)); process.exit(1); });
