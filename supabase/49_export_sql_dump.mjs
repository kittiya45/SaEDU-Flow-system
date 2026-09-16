// ============================================================================
// SAEDU Flow — ส่งออกข้อมูลเป็นไฟล์ .sql ที่ยกไปลง Database Server อื่นได้เลย
//
// ได้อะไรออกมา: saedu-data-<วันเวลา>.sql — คำสั่ง INSERT ทุกตาราง เรียงตามลำดับ
// ที่ FK ไม่พัง ห่อไว้ใน transaction เดียว (ล้มกลางทาง = ไม่มีอะไรค้าง)
//
// ใช้คู่กับ 48_schema_dump.sql เสมอ:
//   createdb saedu
//   psql "postgresql://user@host/saedu" -f 48_schema_dump.sql
//   psql "postgresql://user@host/saedu" -f saedu-data-2026-09-07T....sql
//
// สองโหมด:
//   1) ดึงสดจาก Supabase — ต้องมี service_role key
//        export SUPABASE_URL="https://jrubupvzltxqstzcpoov.supabase.co"
//        export SUPABASE_SERVICE_ROLE_KEY="sb_secret_..."
//        node 49_export_sql_dump.mjs
//
//   2) แปลงจาก backup JSON ที่ 45_export_data_json.mjs ทำไว้แล้ว — ไม่ต้องใช้ key
//        node 49_export_sql_dump.mjs --from=backup-2026-09-07T10-00-00Z
//
// ตัวเลือกอื่น:
//   --out=DIR              ที่เก็บไฟล์ผลลัพธ์ (ค่าเริ่มต้น: โฟลเดอร์ปัจจุบัน)
//   --gzip                 บีบอัดเป็น .sql.gz
//   --on-conflict-nothing  ข้ามแถวที่ id ซ้ำ (ไว้เทข้อมูลทับของเดิม)
//   --null-auth-uid        เขียน users.auth_uid เป็น NULL ทั้งหมด
//                          (ใช้เมื่อปลายทางเป็น Supabase โปรเจกต์ใหม่ที่ยังไม่ได้ย้าย auth.users)
//   --tables=a,b           เอาเฉพาะบางตาราง (ลำดับ FK ยังคงเดิม)
//
// ⚠️ ไฟล์นี้มีข้อมูลส่วนบุคคลจริง (อีเมล รหัสนิสิต เนื้อหาอีเมลแจ้งเตือน) — ห้าม commit
//    .gitignore ครอบ saedu-*.sql* ไว้แล้ว
//
// ⚠️ ไฟล์แนบ (PDF ~1.1 GB) ไม่ได้อยู่ในนี้ — อยู่ใน Storage bucket
//    ต้องสำรองด้วย `node 45_export_data_json.mjs --files` แยกต่างหาก
//    ตาราง document_files เก็บแค่ file_path ชี้ไปหาไฟล์เท่านั้น
// ============================================================================

import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const argVal = (name, dflt) => {
  const hit = args.find(a => a.startsWith(`--${name}=`));
  return hit ? hit.split('=').slice(1).join('=') : dflt;
};
const fromDir = argVal('from', '');
const outRoot = argVal('out', '.');
const gzip = args.includes('--gzip');
const onConflictNothing = args.includes('--on-conflict-nothing');
const nullAuthUid = args.includes('--null-auth-uid');
const onlyTables = (argVal('tables', '') || '').split(',').map(s => s.trim()).filter(Boolean);

// ── ลำดับที่ปลอดภัยต่อ FK — พ่อต้องมาก่อนลูกเสมอ ─────────────────────────
// users มาก่อนทุกอย่าง (แทบทุกตารางชี้กลับมาที่นี่)
// documents มาก่อน workflow_steps / document_files / document_history / acks / notifications
// doc_types มาก่อน doc_type_fields · workflow_templates มาก่อน workflow_template_steps
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

const ROWS_PER_INSERT = 200;
const stamp = new Date().toISOString().replace(/[:.]/g, '-').replace(/-\d{3}Z$/, 'Z');

/* ── แปลงค่า JS หนึ่งค่าเป็น literal ของ SQL ────────────────────────────────
   standard_conforming_strings = on (ตั้งไว้หัวไฟล์) → backslash เป็นอักขระธรรมดา
   เหลือแค่ single quote ที่ต้อง escape ด้วยการซ้ำตัวเอง                        */
function lit(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'NULL';
  if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'`;
  return `'${String(v).replace(/'/g, "''")}'`;
}

const ident = s => `"${String(s).replace(/"/g, '""')}"`;

/* ── สร้างบล็อก INSERT ของตารางหนึ่ง ── */
function tableSql(table, rows) {
  if (!rows.length) return `-- ${table}: ไม่มีข้อมูล\n`;

  // เอาชุดคอลัมน์จากแถวแรก แล้วตรวจว่าทุกแถวหน้าตาเหมือนกัน
  // (ถ้าโปรเจกต์ยังไม่ได้รัน 46_archive_to_drive.sql จะไม่มี archive_url — ไม่เป็นไร
  //  เพราะยึดตามที่ข้อมูลจริงมี ไม่ได้ยึดตาม schema ที่ hardcode ไว้)
  const cols = Object.keys(rows[0]);
  const colSet = cols.join(' ');
  for (let i = 1; i < rows.length; i++) {
    if (Object.keys(rows[i]).join(' ') !== colSet) {
      throw new Error(`${table}: แถวที่ ${i} มีคอลัมน์ไม่ตรงกับแถวแรก — ข้อมูลต้นทางเพี้ยน`);
    }
  }

  const colList = cols.map(ident).join(', ');
  const tail = onConflictNothing ? ' ON CONFLICT DO NOTHING' : '';
  const out = [`-- ${table}: ${rows.length} แถว`];

  for (let i = 0; i < rows.length; i += ROWS_PER_INSERT) {
    const chunk = rows.slice(i, i + ROWS_PER_INSERT);
    const values = chunk.map(r => {
      const vals = cols.map(c => {
        if (nullAuthUid && table === 'users' && c === 'auth_uid') return 'NULL';
        return lit(r[c]);
      });
      return `  (${vals.join(', ')})`;
    });
    out.push(`INSERT INTO public.${ident(table)} (${colList}) VALUES\n${values.join(',\n')}${tail};`);
  }
  return out.join('\n') + '\n';
}

/* ── โหมด 1: ดึงสดจาก Supabase ── */
async function fetchLive() {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('ขาด env: SUPABASE_URL หรือ SUPABASE_SERVICE_ROLE_KEY');
    console.error('(หรือใช้ --from=<โฟลเดอร์ backup JSON> เพื่อแปลงจากไฟล์ที่มีอยู่แล้ว ไม่ต้องใช้ key)');
    process.exit(1);
  }
  // ต้องเป็น service_role เท่านั้น — anon key จะได้แถวไม่ครบแบบเงียบ ๆ เพราะ RLS
  const { createClient } = await import('@supabase/supabase-js');
  const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const PAGE = 1000;

  const data = {}, skipped = {};
  for (const [table, orderCols] of TABLES) {
    if (onlyTables.length && !onlyTables.includes(table)) continue;
    const rows = [];
    let from = 0;
    try {
      for (;;) {
        let q = sb.from(table).select('*');
        // ต้อง order เสมอ — .range() โดยไม่เรียง ลำดับไม่คงที่ แถวซ้ำหรือหายได้
        for (const col of orderCols) q = q.order(col, { ascending: true, nullsFirst: true });
        const { data: page, error } = await q.range(from, from + PAGE - 1);
        if (error) throw error;
        if (!page || !page.length) break;
        rows.push(...page);
        if (page.length < PAGE) break;
        from += PAGE;
      }
    } catch (e) {
      skipped[table] = e.message || String(e);
      console.warn(`  ! ${table}: ${skipped[table]}`);
      continue;
    }
    data[table] = rows;
    console.log(`  ${table.padEnd(26)} ${String(rows.length).padStart(6)} แถว`);
  }
  return { data, skipped, source: SUPABASE_URL };
}

/* ── โหมด 2: อ่านจากโฟลเดอร์ backup JSON ── */
function readFromDir(dir) {
  if (!existsSync(dir)) { console.error(`ไม่พบโฟลเดอร์ ${dir}`); process.exit(1); }
  const manPath = join(dir, 'manifest.json');
  const manifest = existsSync(manPath) ? JSON.parse(readFileSync(manPath, 'utf8')) : null;

  const data = {}, skipped = {};
  for (const [table] of TABLES) {
    if (onlyTables.length && !onlyTables.includes(table)) continue;
    const f = join(dir, `${table}.json`);
    if (!existsSync(f)) {
      skipped[table] = 'ไม่มีไฟล์ในโฟลเดอร์ backup';
      continue;
    }
    const rows = JSON.parse(readFileSync(f, 'utf8'));
    if (!Array.isArray(rows)) { console.error(`${f} ไม่ใช่ array`); process.exit(1); }
    data[table] = rows;
    console.log(`  ${table.padEnd(26)} ${String(rows.length).padStart(6)} แถว`);
  }
  return { data, skipped, source: manifest?.source || dir, exportedAt: manifest?.exported_at };
}

(async () => {
  console.log(fromDir ? `แปลงจาก backup JSON: ${fromDir}\n` : 'ดึงข้อมูลสดจาก Supabase\n');
  const { data, skipped, source, exportedAt } = fromDir ? readFromDir(fromDir) : await fetchLive();

  const outName = `saedu-data-${stamp}.sql`;
  const header = [
    '-- SAEDU Flow — ข้อมูลทั้งระบบ (INSERT อย่างเดียว ไม่มีโครงสร้าง)',
    `-- สร้างเมื่อ ${new Date().toISOString()}`,
    `-- ต้นทาง     ${source}`,
    exportedAt ? `-- ข้อมูล ณ   ${exportedAt}` : null,
    '--',
    '-- รัน 48_schema_dump.sql ให้เสร็จก่อนเสมอ แล้วค่อยรันไฟล์นี้',
    '--   psql "$TARGET" -v ON_ERROR_STOP=1 -f 48_schema_dump.sql',
    `--   psql "$TARGET" -v ON_ERROR_STOP=1 -f ${outName}`,
    '--',
    '-- ไม่มีคำสั่ง \\ ของ psql ในไฟล์นี้ — วางใน SQL Editor ได้ (ON_ERROR_STOP',
    '-- อยู่ที่ -v บรรทัดคำสั่งแทน เพราะ \\set มีแต่ psql ที่เข้าใจ)',
    '--',
    '-- ไฟล์แนบ (PDF) ไม่ได้อยู่ในนี้ — document_files เก็บแค่ file_path',
    '-- ต้องกู้จาก Storage backup (45_export_data_json.mjs --files) แยกต่างหาก',
    '',
    "SET standard_conforming_strings = on;",
    "SET client_encoding = 'UTF8';",
    '',
    'BEGIN;',
    '',
    '-- ปลดล็อก FK users.auth_uid ก่อน — ถ้าปลายทางเป็น Supabase โปรเจกต์ใหม่',
    '-- auth.users จะยังว่าง ทำให้ INSERT users ตกทั้งชุด (ต่อกลับให้ท้ายไฟล์)',
    'ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_auth_uid_fkey;',
    '',
  ].filter(l => l !== null).join('\n');

  const parts = [header];
  const counts = {};
  let total = 0;
  for (const [table] of TABLES) {
    if (!(table in data)) continue;
    parts.push('');
    parts.push(tableSql(table, data[table]));
    counts[table] = data[table].length;
    total += data[table].length;
  }

  const footer = [
    '',
    'COMMIT;',
    '',
    '-- ต่อ FK users.auth_uid กลับ — เฉพาะเมื่อค่าทุกตัวชี้ไปหา auth.users ที่มีอยู่จริง',
    '-- ถ้ายังไม่ได้ย้ายบัญชีล็อกอินมา จะข้ามพร้อมบอกให้รันซ้ำทีหลัง',
    'DO $authfk$',
    'DECLARE v_missing bigint;',
    'BEGIN',
    "  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace",
    "                 WHERE n.nspname = 'auth' AND c.relname = 'users') THEN",
    "    RAISE NOTICE 'ข้าม FK auth_uid — เซิร์ฟเวอร์นี้ไม่มี auth.users';",
    '    RETURN;',
    '  END IF;',
    "  EXECUTE 'SELECT count(*) FROM public.users u WHERE u.auth_uid IS NOT NULL'",
    "       || ' AND NOT EXISTS (SELECT 1 FROM auth.users a WHERE a.id = u.auth_uid)'",
    '    INTO v_missing;',
    '  IF v_missing > 0 THEN',
    "    RAISE NOTICE 'ข้าม FK auth_uid — มี % แถวที่ยังไม่มีบัญชีปลายทาง ย้าย auth.users แล้วค่อยรัน:', v_missing;",
    "    RAISE NOTICE '  ALTER TABLE public.users ADD CONSTRAINT users_auth_uid_fkey FOREIGN KEY (auth_uid) REFERENCES auth.users(id) ON DELETE SET NULL;';",
    '  ELSE',
    '    ALTER TABLE public.users ADD CONSTRAINT users_auth_uid_fkey',
    '      FOREIGN KEY (auth_uid) REFERENCES auth.users(id) ON DELETE SET NULL;',
    "    RAISE NOTICE 'ต่อ FK auth_uid กลับเรียบร้อย';",
    '  END IF;',
    'END',
    '$authfk$;',
    '',
    'ANALYZE;',
    `-- รวม ${total} แถว จาก ${Object.keys(counts).length} ตาราง`,
    '',
  ].join('\n');
  parts.push(footer);

  mkdirSync(outRoot, { recursive: true });
  const name = outName + (gzip ? '.gz' : '');
  const sql = parts.join('\n');
  const buf = gzip ? gzipSync(Buffer.from(sql, 'utf8')) : Buffer.from(sql, 'utf8');
  const file = join(outRoot, name);
  writeFileSync(file, buf);

  const sha = createHash('sha256').update(buf).digest('hex');
  writeFileSync(join(outRoot, `saedu-data-${stamp}.manifest.json`), JSON.stringify({
    generated_at: new Date().toISOString(),
    source, data_as_of: exportedAt || null,
    file: name, bytes: buf.length, sha256: sha,
    gzip, on_conflict_nothing: onConflictNothing, null_auth_uid: nullAuthUid,
    total_rows: total, tables: counts, skipped,
    note: 'ไฟล์แนบใน Storage ไม่รวมอยู่ในนี้ — ดู 45_export_data_json.mjs --files',
  }, null, 2), 'utf8');

  const mb = (buf.length / 1048576).toFixed(1);
  console.log(`\nเขียนแล้ว ${file}  (${mb} MB, ${total} แถว)`);
  console.log(`sha256 ${sha}`);
  if (Object.keys(skipped).length) {
    console.log('\nข้ามไป:');
    for (const [t, why] of Object.entries(skipped)) console.log(`  ${t}: ${why}`);
  }
  console.log(`\nกู้คืนที่ปลายทาง:\n  psql "$TARGET" -f 48_schema_dump.sql\n  psql "$TARGET" -f ${file}`);
})().catch(e => { console.error('ล้มเหลว:', e.message || e); process.exit(1); });
