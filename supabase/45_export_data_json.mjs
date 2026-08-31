// ============================================================================
// SAEDU Flow — ส่งออกข้อมูลทั้งระบบเป็น JSON (backup / ย้ายไปเก็บบน server เอง)
//
// ได้อะไรออกมา: โฟลเดอร์ 1 ชุด มีไฟล์ JSON ตารางละไฟล์ + manifest.json
//   backup-2026-08-28T10-00-00Z/
//     manifest.json          — รันเมื่อไหร่ ตารางไหนกี่แถว sha256 ของแต่ละไฟล์
//     users.json
//     documents.json
//     workflow_steps.json
//     ... (ทุกตารางใน public)
//     files/                 — ไฟล์แนบจริงจาก Storage (เฉพาะเมื่อใส่ --files)
//
// ⚠️ ไฟล์แนบ (PDF) ไม่ได้อยู่ในฐานข้อมูล — อยู่ใน Storage bucket
//    JSON เก็บแค่ file_path สำรองแต่ JSON = ได้ทะเบียนแต่ไม่ได้ตัวเอกสาร ต้องใส่ --files ด้วย
//
// รันเอง ในเครื่องตัวเอง — service_role key ไม่ต้องบอกใครทั้งนั้น
//
// เตรียม (ครั้งเดียว):
//   cd supabase
//   npm install @supabase/supabase-js     # ถ้ายังไม่เคยรัน 03/44 มาก่อน
//
// env ที่ต้องมี (ตั้งใน shell ห้ามเขียนลงไฟล์ ห้าปๆม commit):
//   SUPABASE_URL              — https://jrubupvzltxqstzcpoov.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY — Dashboard → Settings → API → service_role (ลับ!)
//   ต้องใช้ service_role เท่านั้น เพราะ RLS ปิดกั้น anon/ผู้ใช้ทั่วไปจาก users/notifications
//   (anon key จะได้ JSON ที่ขาดแถวไปเงียบ ๆ ไม่ error)
//
// วิธีใช้:
//   node 45_export_data_json.mjs                          # ส่งออกทุกตาราง เป็นโฟลเดอร์
//   node 45_export_data_json.mjs --out=/backup/saedu      # กำหนดที่เก็บเอง
//   node 45_export_data_json.mjs --single-file            # รวมเป็นไฟล์เดียว saedu-backup.json
//   node 45_export_data_json.mjs --gzip                   # บีบอัดทุกไฟล์ (.json.gz)
//   node 45_export_data_json.mjs --redact                 # ตัดข้อมูลส่วนบุคคลออก (ดูด้านล่าง)
//   node 45_export_data_json.mjs --tables=documents,workflow_steps
//   node 45_export_data_json.mjs --files                  # ดาวน์โหลดไฟล์แนบจาก Storage ด้วย
//
// --redact ตัดอะไรบ้าง (ใช้เมื่อจะส่งไฟล์ให้คนอื่น / เอาไปทำ dataset ทดสอบ):
//   users.email / contact_email / password_hash / student_id / line_user_id / line_link_code
//   notifications.recipient_email / body
//   document_history.performer_email
//   → อย่าใช้ --redact กับ backup ที่ตั้งใจเอาไว้กู้คืน มันกู้กลับไม่ครบ
//
// ส่งขึ้น server หลังรันเสร็จ (เลือกอย่างใดอย่างหนึ่ง):
//   scp -r backup-2026-08-28T10-00-00Z user@server:/srv/saedu-backup/
//   rsync -av --delete backup-*/ user@server:/srv/saedu-backup/latest/
//   ตั้ง cron ในเครื่อง/บน server ที่มี node:  0 2 * * * cd /path/supabase && node 45_export_data_json.mjs --out=/srv/saedu-backup --gzip
// ============================================================================

import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('ขาด env: SUPABASE_URL หรือ SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const args = process.argv.slice(2);
const argVal = (name, dflt) => {
  const hit = args.find(a => a.startsWith(`--${name}=`));
  return hit ? hit.split('=').slice(1).join('=') : dflt;
};
const stamp = new Date().toISOString().replace(/[:.]/g, '-').replace(/-\d{3}Z$/, 'Z');
const outRoot = argVal('out', '.');
const singleFile = args.includes('--single-file');
const gzip = args.includes('--gzip');
const redact = args.includes('--redact');
const withFiles = args.includes('--files');
const onlyTables = (argVal('tables', '') || '').split(',').map(s => s.trim()).filter(Boolean);

// ── ตารางที่ export + คอลัมน์ที่ใช้เรียงลำดับ ───────────────────────────────
// เรียงเสมอ: PostgREST .range() แบ่งหน้าโดยไม่มี order = ลำดับไม่คงที่ แถวหายหรือซ้ำได้
// (ตารางไหนยังไม่มีในโปรเจกต์ เช่น document_acks ถ้ายังไม่รัน 43 — จะข้ามพร้อมบันทึกเหตุผล)
const TABLES = [
  ['users', ['created_at', 'id']],
  ['documents', ['created_at', 'id']],
  ['workflow_steps', ['document_id', 'step_number', 'id']],
  ['document_files', ['document_id', 'uploaded_at', 'id']],
  ['document_history', ['performed_at', 'id']],
  ['document_acks', ['id']],
  ['notifications', ['sent_at', 'id']],
  ['form_templates', ['sort_order', 'id']],
  ['calendar_events', ['date', 'id']],
  ['projects', ['sort_order', 'id']],
  ['announcements', ['created_at', 'id']],
  ['system_logs', ['at', 'id']],
  ['app_settings', ['key']],
  ['email_templates', ['key']],
  ['workflow_templates', ['created_at', 'id']],
  ['workflow_template_steps', ['template_id', 'step_number']],
  ['doc_types', ['sort_order', 'id']],
  ['doc_type_fields', ['doc_type_id', 'sort_order']],
  ['doc_number_settings', ['year']],
  ['notification_rate_limits', ['caller_id', 'kind', 'window_start']],
];

const REDACT_COLS = {
  users: ['email', 'contact_email', 'password_hash', 'student_id', 'line_user_id', 'line_link_code'],
  notifications: ['recipient_email', 'body'],
  document_history: ['performer_email'],
};

const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const PAGE = 1000;

/* ── ดึงทั้งตารางแบบแบ่งหน้า ── */
async function fetchAll(table, orderCols) {
  const rows = [];
  let from = 0;
  for (;;) {
    let q = sb.from(table).select('*');
    for (const col of orderCols) q = q.order(col, { ascending: true, nullsFirst: true });
    const { data, error } = await q.range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || !data.length) break;
    rows.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return rows;
}

function applyRedact(table, rows) {
  const cols = REDACT_COLS[table];
  if (!redact || !cols) return rows;
  return rows.map(r => {
    const c = { ...r };
    for (const k of cols) if (k in c) c[k] = c[k] == null ? null : '[REDACTED]';
    return c;
  });
}

function writeOut(dir, name, obj) {
  const json = JSON.stringify(obj, null, 2);
  const buf = gzip ? gzipSync(Buffer.from(json, 'utf8')) : Buffer.from(json, 'utf8');
  const file = join(dir, name + (gzip ? '.gz' : ''));
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, buf);
  return { file, bytes: buf.length, sha256: createHash('sha256').update(buf).digest('hex') };
}

/* ── ไล่ทุก object ใน bucket (list() ไม่ recursive ต้องเดินโฟลเดอร์เอง) ── */
async function listBucket(bucket, prefix = '') {
  const out = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await sb.storage.from(bucket).list(prefix, {
      limit: 100, offset, sortBy: { column: 'name', order: 'asc' },
    });
    if (error) throw new Error(`list ${bucket}/"${prefix}" ล้มเหลว: ${error.message}`);
    if (!data || !data.length) break;
    for (const item of data) {
      const full = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id === null || !item.metadata) out.push(...await listBucket(bucket, full));
      else out.push({ path: full, size: Number(item.metadata.size || 0) });
    }
    if (data.length < 100) break;
    offset += 100;
  }
  return out;
}

const fmt = b => b >= 1048576 ? (b / 1048576).toFixed(1) + ' MB' : (b / 1024).toFixed(0) + ' kB';

(async () => {
  const dir = singleFile ? outRoot : join(outRoot, `backup-${stamp}`);
  mkdirSync(dir, { recursive: true });

  console.log(`ส่งออกจาก ${SUPABASE_URL}`);
  console.log(`ปลายทาง   ${dir}${gzip ? ' (gzip)' : ''}${redact ? ' · ตัดข้อมูลส่วนบุคคล (--redact)' : ''}\n`);

  const wanted = TABLES.filter(([t]) => !onlyTables.length || onlyTables.includes(t));
  if (onlyTables.length) {
    const unknown = onlyTables.filter(t => !TABLES.some(([n]) => n === t));
    if (unknown.length) { console.error('ไม่รู้จักตาราง: ' + unknown.join(', ')); process.exit(1); }
  }

  const manifest = {
    exported_at: new Date().toISOString(),
    source: SUPABASE_URL,
    redacted: redact,
    gzip,
    includes_storage_files: withFiles,
    tables: {},
    skipped: {},
  };
  const combined = {};
  let totalRows = 0, totalBytes = 0, failed = 0;

  for (const [table, orderCols] of wanted) {
    try {
      const rows = applyRedact(table, await fetchAll(table, orderCols));
      totalRows += rows.length;
      if (singleFile) {
        combined[table] = rows;
        manifest.tables[table] = { rows: rows.length };
      } else {
        const w = writeOut(dir, `${table}.json`, rows);
        totalBytes += w.bytes;
        manifest.tables[table] = { rows: rows.length, bytes: w.bytes, sha256: w.sha256 };
      }
      console.log(`  ${String(rows.length).padStart(6)} แถว  ${table}`);
    } catch (e) {
      const msg = e.message || String(e);
      // ตารางที่ยังไม่ได้สร้าง (เช่น document_acks ถ้ายังไม่รัน 43) — ข้าม ไม่ใช่ error
      const missing = /does not exist|Could not find the table|schema cache/i.test(msg);
      manifest.skipped[table] = msg;
      if (!missing) failed++;
      console.log(`  ${'ข้าม'.padStart(6)}  ${table} — ${missing ? 'ยังไม่มีตารางนี้ในโปรเจกต์' : msg}`);
    }
  }

  /* ── ไฟล์แนบจาก Storage ── */
  if (withFiles) {
    console.log('\nดาวน์โหลดไฟล์แนบจาก Storage...');
    manifest.storage = {};
    for (const bucket of ['documents', 'user-signatures']) {
      try {
        const objects = await listBucket(bucket);
        let done = 0, bytes = 0, errs = 0;
        for (const o of objects) {
          const { data, error } = await sb.storage.from(bucket).download(o.path);
          if (error || !data) { errs++; continue; }
          const buf = Buffer.from(await data.arrayBuffer());
          const dest = join(dir, 'files', bucket, o.path);
          mkdirSync(dirname(dest), { recursive: true });
          writeFileSync(dest, buf);
          done++; bytes += buf.length;
          if (done % 50 === 0) console.log(`  ${bucket}: ${done}/${objects.length}`);
        }
        manifest.storage[bucket] = { files: done, bytes, failed: errs };
        totalBytes += bytes;
        console.log(`  ${bucket}: ${done}/${objects.length} ไฟล์ · ${fmt(bytes)}${errs ? ` · ล้มเหลว ${errs}` : ''}`);
      } catch (e) {
        manifest.storage[bucket] = { error: e.message || String(e) };
        console.log(`  ${bucket}: ล้มเหลว — ${e.message || e}`);
        failed++;
      }
    }
  }

  if (singleFile) {
    const w = writeOut(dir, `saedu-backup-${stamp}.json`, { ...manifest, data: combined });
    totalBytes += w.bytes;
    console.log(`\nเขียนไฟล์เดียว: ${w.file} · ${fmt(w.bytes)}`);
  } else {
    writeOut(dir, 'manifest.json', manifest);
    console.log(`\nเสร็จ: ${totalRows} แถว · ${fmt(totalBytes)} · ${dir}`);
  }

  if (Object.keys(manifest.skipped).length) {
    console.log(`ข้าม ${Object.keys(manifest.skipped).length} ตาราง (ดูรายละเอียดใน manifest.json)`);
  }
  if (failed) { console.error(`\n⚠️  มี ${failed} รายการที่ล้มเหลวจริง (ไม่ใช่แค่ตารางที่ยังไม่มี) — backup นี้ไม่ครบ`); process.exit(1); }
})().catch(e => { console.error('ผิดพลาด:', e.message || e); process.exit(1); });
