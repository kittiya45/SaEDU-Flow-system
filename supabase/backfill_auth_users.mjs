// ============================================================================
// SAEDU Flow — Phase D backfill: create a real Supabase Auth account for
// every existing public.users row, linked automatically by the trigger from
// migration_auth_rls.sql (matches by email, only sets auth_uid — never
// touches your existing profile data).
//
// Run this YOURSELF, locally. The service_role key never needs to be shared
// with the assistant — keep it only in your own shell environment.
//
// Setup (once):
//   cd supabase
//   npm init -y && npm install @supabase/supabase-js
//
// Required env vars (set in your shell, not in a file):
//   SUPABASE_URL              — e.g. https://jrubupvzltxqstzcpoov.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY — Dashboard → Settings → API → service_role (secret!)
//   DEFAULT_TEMP_PASSWORD     — temp password for accounts that don't already
//                               have one assigned (the 45 just-imported
//                               students already used "user@1234" at import
//                               time — reuse the same value here so nothing
//                               changes for them)
//
// IMPORTANT — fix the admin account's email first (Supabase Auth needs a
// valid email format; today it's literally the string "admin"). Update that
// row's email in the SQL editor or via the admin UI before running this.
//
// Usage:
//   node backfill_auth_users.mjs --dry-run                 # preview only, no writes
//   node backfill_auth_users.mjs --only=a@x.com,b@y.com     # test a small batch first
//   node backfill_auth_users.mjs                            # run against everyone
// ============================================================================

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DEFAULT_TEMP_PASSWORD = process.env.DEFAULT_TEMP_PASSWORD || 'user@1234';

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.');
  process.exit(1);
}

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const onlyArg = args.find((a) => a.startsWith('--only='));
const onlyEmails = onlyArg ? onlyArg.replace('--only=', '').split(',').map((e) => e.trim().toLowerCase()) : null;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function main() {
  const { data: users, error } = await admin
    .from('users')
    .select('id, email, full_name, student_id, position_code, role_code, department, contact_email, user_type, auth_uid');
  if (error) {
    console.error('Failed to read users table:', error.message);
    process.exit(1);
  }

  // duplicate-email guard (the SQL script's step 0 check, re-verified here)
  const seen = new Map();
  for (const u of users) {
    const key = (u.email || '').toLowerCase();
    if (seen.has(key)) {
      console.error(`Duplicate email found: "${u.email}" (rows ${seen.get(key)} and ${u.id}). Fix this before continuing.`);
      process.exit(1);
    }
    seen.set(key, u.id);
  }

  const targets = users.filter((u) => {
    if (u.auth_uid) return false; // already linked — safe to re-run this script
    if (onlyEmails && !onlyEmails.includes((u.email || '').toLowerCase())) return false;
    return true;
  });

  console.log(`${targets.length} of ${users.length} users need a new auth account.`);
  if (dryRun) {
    targets.forEach((u) => console.log(`  [dry-run] would create: ${u.email} (${u.full_name})`));
    return;
  }

  let ok = 0, fail = 0;
  for (const u of targets) {
    if (!u.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(u.email)) {
      console.error(`Skipping "${u.full_name}" (id ${u.id}) — invalid email "${u.email}". Fix this row's email first.`);
      fail++;
      continue;
    }
    const { error: createErr } = await admin.auth.admin.createUser({
      email: u.email,
      password: DEFAULT_TEMP_PASSWORD,
      email_confirm: true,
      user_metadata: {
        full_name: u.full_name,
        student_id: u.student_id,
        position_code: u.position_code,
        role_code: u.role_code,
        department: u.department,
        contact_email: u.contact_email,
        user_type: u.user_type,
      },
    });
    if (createErr) {
      console.error(`FAILED: ${u.email} — ${createErr.message}`);
      fail++;
    } else {
      console.log(`OK: ${u.email}`);
      ok++;
    }
  }
  console.log(`\nDone. ${ok} created, ${fail} failed.`);
  console.log('Verify a couple of these can log in with the temp password before running enable_rls.sql.');
}

main();
