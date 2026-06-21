# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the App

One build step: compiling Tailwind CSS (see "CSS Build" below). Run it once, then serve with any static file server:

```bash
npm install
npm run build   # compiles tailwind.css -> styles.tailwind.css
python3 -m http.server 8000
# then open http://localhost:8000
```

If you're actively changing class names in any `.js` file, run `npm run watch` instead of `npm run build` so `styles.tailwind.css` stays current while you work.

`manual.html` is a standalone page — open it separately. It has no dependency on other JS files.

There is no lint/test tooling in this repo — verify changes by serving the site and exercising the feature in a browser (or via Playwright).

### CSS Build (Tailwind v4)

`styles.tailwind.css` is a **generated file, gitignored** — it does not exist until you run `npm run build`. The source is `tailwind.css` (just `@import "tailwindcss";` plus an `@theme` block carrying the brand color/font tokens that used to live in `index.html`'s inline `tailwind.config` for the old CDN script). `postcss.config.js` wires up `@tailwindcss/postcss`.

**This replaced the Tailwind CDN script** (`<script src="https://cdn.tailwindcss.com">`), which used to JIT-compile classes in the browser at runtime — that's gone from `index.html`; `<link rel="stylesheet" href="styles.tailwind.css">` now serves a pre-built file instead. Tailwind v4's build-time content scanner finds utility classes by statically scanning source files for literal strings — confirmed safe for this codebase because every Tailwind class here (including all the `text-[#xxxxxx]`-style arbitrary-value classes) appears as a complete literal string in some `.js` file; nothing constructs a class name dynamically via concatenation/interpolation. **If you ever add code that builds a Tailwind class name from a variable (e.g. `` `bg-${color}` ``), the scanner won't find it and the style will silently be missing from the compiled CSS** — use a lookup table of complete literal class strings instead (the rest of the codebase already does this for conditional classes, e.g. `roleColorCls`/`rowBg` in `workflow.js`).

Deployment (Vercel) is configured via `vercel.json` (`buildCommand: npm run build`, `outputDirectory: .`, `framework: null`) so the compiled CSS gets regenerated on every deploy — you never need to commit `styles.tailwind.css` yourself.

## Architecture

**Vanilla JS SPA — no framework, no bundler.** All app code runs in the browser from static files served directly; the only npm/build involvement is the Tailwind CSS compile step above (`package.json`'s `devDependencies` are all Tailwind/PostCSS tooling — no runtime JS dependencies are installed via npm). Backend is Supabase (Postgres + Auth + Storage + Edge Functions), hosted on Vercel (auto-deploys on push to `main`).

### Script Loading Order (index.html)

The Supabase JS client loads first (non-deferred, blocking) so `supabase.createClient` exists before any deferred script runs. Everything else loads via `defer` in strict dependency order — order matters because every file shares one global scope (no modules):

```
supabase-js (CDN, pinned version, blocking)
→ config.js → utils.js → events.js → auth.js
→ dashboard.js → docList.js → docForm.js → workflow.js → report.js
→ docSign.js → docDetail.js   ← docDetail MUST load after docSign and docList
→ docNum.js → notif.js → viewer.js → editor.js
→ stats.js → sysAdmin.js → docTypeAdmin.js → templates.js
→ admin.js → adminImport.js → layout.js → boot.js
```

**Critical override:** `docDetail.js` redefines `doAcceptFwd()` and `doDeclineFwd()` from `docList.js`. The docDetail version wins (loads later) and writes `'เจ้าหน้าที่รับเอกสาร'` to `document_history`. Queries that filter on accept/decline actions must use this string — not the old `'รับเอกสาร'`.

### Global State (config.js)

All state is global variables — no module system.

**Runtime state:**
- `CU` — current user's `public.users` profile row (null if not logged in)
- `CV` — current view string (`'dash'`, `'docs'`, `'new'`, `'edit'`, `'det'`, `'tmpl'`, `'adm'`, `'sys'`, `'stat'`)
- `CDI` — current document ID (for detail/edit views)
- `ADOCS` — all documents array (loaded in `vDocs()`)
- `PC` — pending document count (badge in sidebar/mobile nav)
- `MSTEPS` — doc IDs where CU has an active workflow step
- `FS`, `FF`, `FU`, `FDI`, `PF` — form state: workflow steps, files, users, edit doc ID, previous files
- `PED` — PDF editor state object (tool, scale, pages, drawn elements, signature color, etc.)
- `sb` — Supabase Auth client (`supabase.createClient(SU, SK)`). Used **only** for `sb.auth.*` and `sb.rpc('resolve_login_email', ...)` — all data access still goes through the `dg/dp/dpa/dd` REST helpers, not the supabase-js query builder.
- `H` — shared headers object passed to every `fetch()` call. `H.Authorization` is mutated in place (never reassign `H`) by a single `sb.auth.onAuthStateChange` subscription in `auth.js`, so it always carries the current session JWT (or falls back to the anon key when logged out). Every other file that does `fetch(url, {headers:H})` picks up the live value automatically.

**Runtime-configurable settings:**
- `SETT` — loads from the `app_settings` table after login via `loadAppSettings()` (table created by `supabase/create_admin_config_tables.sql`; see "Admin config tables" below). Falls back to the hardcoded default in `config.js` (`SETT.x||default`) for any key that hasn't been saved through "ตั้งค่าระบบ" yet.

**Lookup constants (hardcoded):**
- `DTYPES` — doc type code → Thai label (overridden at runtime by `loadDocTypes()`)
- `DTYPE_CFG` — per-type form field config (also overridden by `loadDocTypes()`)
- `LETTER_TYPES` — 13 incoming document subject types
- `OUT_LTYPES` — outgoing letter types (index 1–9, index 0 is empty)
- `POSS`/`PTH`/`PR` — position codes → Thai label → default role_code. 25 fixed กนค.-committee positions (`GNK-PRE`, `GNK-ACA`, etc.) plus 4 club-officer roles (`GNK-CPR`/`CVP`/`CSEC`/`CTRS` — president/VP/secretary/treasurer). The club-officer codes identify the *role*, not *which* club — the club name itself still goes in the user's free-text `department` column (admin.js edit-user modal), conventionally as `"{role label} — {club name}"`.
- `GNK_NUM` — position code → 2-digit numbering code (digits 2–3 of an outgoing/incoming doc number, see Document Numbering below). `11` is an intentionally-unused gap; `27`–`30` are the 4 club-officer codes.
- `CLUBS` — 2-digit club code → club name, used for the `{club}` suffix (digits 8–9) when numbering a document.
- `SENDER_POS` — flat `{name, code, isClub}` list for the "ตำแหน่ง/สังกัดผู้ส่ง" picker on **incoming** docs; overlaps with but is independent of `POSS`/`GNK_NUM` (a club entry here can share a 2-digit code with a non-club entry).
- `RTH` — role_code → Thai label. `UTH` — user_type (`gnk`/`advisor`/`staff`/`admin`) → Thai label; only `gnk`/`advisor`/`staff` are ever actually assigned (by `doRegG`/`doRegS` in auth.js) — `admin` has no registration path.
- `CAN` — client-side permission helpers: `CAN.sg(role)`, `CAN.rv(role)`, `CAN.cr(role)`, `CAN.ed(role)`, `CAN.up(role)`

### Supabase API Helpers (config.js)

PostgREST via raw `fetch` — no supabase-js query builder. Always use `safeId(id)` when interpolating IDs into query strings.

- `dg(table, query)` — GET. Returns parsed JSON (may be array or a PostgREST error object — always check, especially `Array.isArray(...)` before using `.length`. A wrong/missing column name returns an error object, not an empty array — see the `notif.js` `sent_at` vs `created_at` bug for a real example of this biting).
- `dp(table, body)` — POST (insert). Returns array; use `res[0].id` for new row ID.
- `dpa(table, id, body)` — PATCH by `id=eq.{id}`. Use for updates.
- `dd(table, id)` — DELETE. Throws if table is `document_history` or `notifications` (protected, append-only).
- `upFile(path, file)` — upload File to Supabase Storage `documents` bucket.
- `furl(path)` — get public URL for a stored file path.

For operations that need non-id filters (e.g., PATCH by key), use `fetch(SU+'/rest/v1/'+table+'?key=eq.'+val, {method:'PATCH', headers:H, body:...})` directly.

**Calling Edge Functions:** never pass the shared `H` object directly to a `fetch()` call targeting `/functions/v1/...`. `H` carries a `Prefer` header meant for PostgREST; Supabase Edge Functions' CORS preflight rejects it, and the failure is silent (the `fetch` promise just rejects with `TypeError: Failed to fetch`, easy to mistake for a stuck/hanging request). Build a minimal header object instead: `{apikey:SK, Authorization:H.Authorization, 'Content-Type':'application/json'}` — see `admin.js`'s calls to `admin-delete-user`/`admin-set-password` for the pattern.

### Database Tables

| Table | Purpose |
|---|---|
| `users` | Accounts — `role_code`, `position_code`, `is_active`, `approval_status`, `auth_uid` (links to `auth.users`) |
| `documents` | Core doc records with `status`, `doc_type`, `created_by`, `forwarded_to_id` |
| `workflow_steps` | Per-document steps: `status` (`pending`/`active`/`done`/`rejected`), `assigned_to`, `rejected_by`, `deadline_datetime` |
| `document_files` | Attached files with `file_path` (Storage key), `version`, `uploaded_by` |
| `document_history` | Immutable audit log — **never delete client-side**, enforced by both `dd()` and RLS |
| `notifications` | Email send log — **never delete client-side**, enforced by both `dd()` and RLS. Columns are `sent_at`/`status`/`notification_type`, **not** `created_at` |
| `doc_types` / `doc_type_fields` | Runtime doc type config (overrides hardcoded `DTYPE_CFG`) |
| `doc_number_settings` | Per-year prefix and outgoing sequence config |
| `form_templates` | Downloadable form files (templates page), `uploaded_by` |
| `calendar_events` | Custom dashboard calendar events, `created_by` |
| `projects` | Project/ฝ่าย list used in stats and doc forms |

**Admin config tables:** `app_settings`, `email_templates`, `workflow_templates`, `workflow_template_steps` were missing for a long time (the frontend — `sysAdmin.js`, `docForm.js`, `notif.js`, `config.js` — always called `dg()`/`dp()` against them, wrapped in `try/catch`, silently no-oping) until `supabase/create_admin_config_tables.sql` created them with matching columns + RLS (`is_admin()`-gated writes, any-logged-in-user reads). The corresponding admin UI ("ตั้งค่าระบบ", "แบบฟอร์มอีเมล", "เทมเพลต workflow" in `vSys()`) now actually persists.

### Event Handling (events.js)

Single delegated `click` listener on `document`. All interactive elements use `data-action="actionName"` with optional `data-id`, `data-view`, `data-tab`, `data-act`, `data-type`, `data-url`, `data-name`. To add a new action: add the button HTML with `data-action="myAction"`, then add `else if(a==='myAction') myAction(id)` to the if/else chain in `events.js`.

### Navigation & Rendering

`nav(view, id)` is the main router — it first renders a loading spinner into the existing `<main>` element, then fetches data, renders the view function, builds the sidebar, and calls `rdr(html)`. `rdr(html)` replaces `#app` innerHTML. There is no URL routing — the app is a single shell.

The modal container is `<div id="mwrap">` — clear it with `mw.innerHTML=''` to close. **Critical:** `showConfirm()` and `showAlert()` both replace the entire `mwrap.innerHTML`. Any code that reads form values after calling `showConfirm` will find those elements gone. Always capture form state into local variables before calling `showConfirm`. See `doSetDocNumber()` in `docNum.js` for the correct pattern.

`boot.js` is the entry point. It checks `sb.auth.getSession()` for an existing Supabase Auth session first (restoring `CU` and skipping straight to the dashboard if found); otherwise it calls `showAuth()`.

### View Functions

Each screen has an async `vXxx()` function that returns an HTML string:

| Function | File | Notes |
|---|---|---|
| `vDash()` | dashboard.js | Stats cards + calendar widget |
| `vTodo()` | dashboard.js | Active workflow steps assigned to CU |
| `vDocs()` | docList.js | Doc table with tabs, type filter, search |
| `vForm(id)` | docForm.js | Create/edit doc; `id` null = new |
| `vDet(id)` | docDetail.js | Detail view with action buttons |
| `vTmpl()` | templates.js | Form template downloads |
| `vAdm()` | admin.js | User management (ROLE-SYS / ROLE-STF) |
| `vSys()` | sysAdmin.js | System config, doc types, CMS panels |
| `vStat()` | stats.js | Statistics and reports |

Render helpers follow `rXxx(data)` naming convention and return HTML strings.

### Document Lifecycle

```
draft → pending → (each step: active → done/rejected)
              → numbering (single-step docs: incoming AND outgoing, after the step is done)
              → completed
     ↑ rejected (any step) → creator fixes → resubmit
```

**Outgoing docs skip the approval workflow** — they only ever have one step (the creator's own `ผู้จัดทำ` step, marked `done` immediately) — but they still go through `numbering` before `completed`, same as incoming: the creator must click "ออกเลขหนังสือ" to pick ภาคการศึกษา/ประเภทจดหมาย and get the real `กนค. {sem}{pos}{lt}{NNN}[-{club}]/{thaiYear}` number (`showNumModal()`'s `if(doc.doc_type==='outgoing')` branch in docNum.js, which derives `{pos}` from the creator's own `position_code` via `GNK_NUM`/`PTH`) — the placeholder number assigned at creation (`genOutDocNumber()`, a plain sequential `กนค.{year}.{seq}`) gets overwritten once numbering completes. The file is forwarded to `final_recipient_id` for download once `completed`.

**Forward flow:** `completed` docs can be forwarded to another user (`forwarded_to_id`). Recipient accepts/declines. Acceptance writes `'เจ้าหน้าที่รับเอกสาร'` to `document_history`.

**SLA:** Rejection deadline uses `addWorkingDays(date, SETT.sla_cascade_days||3)` — working days only (Mon–Fri). Helpers `addWorkingDays()` and `workingDaysLeft()` are in `utils.js`.

### Authentication & Session

Real **Supabase Auth** (`auth.users` + JWT sessions), migrated from a custom PBKDF2-in-`public.users` scheme. Key pieces:

- **Linking:** `public.users.auth_uid` (uuid, unique, `references auth.users(id) on delete set null`) links a profile row to its Supabase Auth identity. `public.users.id` itself was deliberately left untouched during the migration — it's still the FK anchor for `documents.created_by`, `document_files.uploaded_by`, `workflow_steps.assigned_to/rejected_by`, `document_history.performed_by`, `form_templates.uploaded_by`, etc. Never assume `auth_uid === id`.
- **Linking trigger:** a Postgres trigger (`on_auth_user_created` → `link_auth_user()`, see `supabase/migration_auth_rls.sql`) fires on every `auth.users` insert. It reads `raw_user_meta_data` and either creates a fresh pending `public.users` row (self-registration) or just sets `auth_uid` on a matching-by-email existing row (admin backfill) via `ON CONFLICT (email)`.
- **Login (`auth.js doLogin`):** login accepts a student ID *or* an email. If the input isn't email-shaped, it's resolved to an email first via `sb.rpc('resolve_login_email', {identifier})` (a `security definer` SQL function — anon can't query `users` directly to do this lookup themselves), then `sb.auth.signInWithPassword({email, password})`. After success, the profile row is fetched via `dg('users', '?auth_uid=eq.'+session.user.id)` and validated (`approval_status`, `is_active`, `gnk` expiry) before `CU` is set.
- **Registration (`doRegG`/`doRegS`):** `sb.auth.signUp({email, password, options:{data:{...}}})` — all profile fields (full_name, student_id, position_code, role_code, department, user_type, contact_email) are passed via `options.data` so the trigger can populate the full profile row in one shot. The code immediately calls `sb.auth.signOut()` after a successful signUp so registering doesn't auto-log-in (accounts start `approval_status:'pending'`).
- **Password changes:** `sb.auth.updateUser({password})`. Verifying the *old* password is done by attempting `sb.auth.signInWithPassword` with it first — there's no separate password-check primitive.
- **Session refresh:** one `sb.auth.onAuthStateChange` subscription (in `auth.js`) keeps `H.Authorization` in sync across login, logout, and supabase-js's automatic background token refresh. Don't add a second subscription or a one-off post-login header update — this is the single source of truth.
- **Admin actions needing `auth.users` access** (hard-deleting someone else's account, or an admin directly setting someone else's password) can't use the anon-key client at all — they go through two Edge Functions, `admin-delete-user` and `admin-set-password` (source in `supabase/functions/`), which verify the caller's JWT and `role_code` server-side via a service-role client before acting. Every other admin action (approve/reject/toggle-active/edit-profile/import) only touches `public.users` profile columns and stays a plain RLS-gated table write.
- `password_hash` column still exists on `users` and is no longer read by login/registration — kept temporarily as a rollback safety net, not because it's used.

### Row Level Security

RLS is enabled on every table. Policies generally follow this split (see `supabase/migration_auth_rls.sql` for the full set and rationale):
- `users`: precise — a user can read/update only their own row (`auth_uid = auth.uid()`); `is_admin()` (a `security definer` helper checking `role_code in ('ROLE-SYS','ROLE-STF')`) can see/manage all rows.
- Admin-only config tables (`doc_number_settings`, `doc_types`, `doc_type_fields`, `form_templates` writes, `projects` writes, etc.): gated by `is_admin()`.
- Document workflow tables (`documents`, `document_files`, `workflow_steps`, `document_history`, `notifications`): `SELECT` is open to any authenticated user (matches pre-migration app behavior — these are fetched in full and filtered client-side, no per-row secrecy between logged-in members was ever intended). Writes are gated by `auth.uid() is not null`, with explicit ownership checks (`created_by = current_profile().id`) layered on for `documents`/`calendar_events` insert/delete where the app already enforced that distinction client-side.

**If you add a new table that the app should read/write, it needs an explicit RLS policy** — there is no default-allow. `supabase/enable_rls.sql` is a separate, deliberately-deferred script that flips `ENABLE ROW LEVEL SECURITY` on (run together with a frontend deploy, never alone — see comments in that file).

**`user_directory` view (`supabase/user_directory_view.sql`):** because `users` RLS only lets a caller see their *own* row, every screen that needs to list/look up *other* people (workflow assignee/reviewer dropdowns, document creator/uploader names, forward-recipient pickers, etc.) reads from this view instead of the `users` table directly — it exposes only directory-safe columns (no email/password) to any authenticated user. Used across docForm.js, docDetail.js, docList.js, docNum.js, notif.js, sysAdmin.js, report.js, templates.js. **When adding a new lookup of another user's name/role, query `user_directory`, not `users`** — querying `users` for anyone but yourself returns `[]` once RLS is live, not an error, so the bug only shows up as silently-blank names.

### Roles & Permissions

| Role | Code | Access |
|---|---|---|
| ผู้ดูแลระบบ | `ROLE-SYS` | All views, all docs, all admin functions |
| ผู้ลงนาม | `ROLE-SGN` | Sign/approve workflow steps |
| ผู้ตรวจทาน | `ROLE-REV` | Review steps |
| ผู้จัดทำ | `ROLE-CRT` | Create incoming/outgoing docs |
| เจ้าหน้าที่ | `ROLE-STF` | All doc types, user management, stats, numbering |
| อาจารย์กิจการ | `ROLE-ADV` | All doc types, advisory role |

`CAN.sg(role)`, `CAN.rv(role)`, `CAN.cr(role)`, `CAN.ed(role)`, `CAN.up(role)` — client-side permission checks in `config.js`. `ROLE-SYS`/`ROLE-STF`/`ROLE-ADV` can see certificate and memo doc types in the creation form. The DB-side `is_admin()` SQL helper treats `ROLE-SYS` and `ROLE-STF` as admin-equivalent for RLS purposes — `ROLE-ADV` is **not** included there even though it has broad client-side access, since RLS only needs to gate the `users`-table management actions.

### `supabase/` folder — ops tooling, not app code

Not part of the deployed static site; these are one-time/admin scripts for managing the Supabase project itself. All are plain SQL files run manually in the Supabase Dashboard SQL Editor (or via `npx supabase db query --linked --file <path>` if the CLI is linked) — none are auto-applied on deploy. Listed roughly in the order they'd be needed on a fresh project:
- `migration_auth_rls.sql` — schema (the `auth_uid` column + indexes), helper SQL functions, the linking trigger, and all RLS policies. Idempotent (`if not exists` / `drop ... if exists` throughout) — safe to re-run.
- `enable_rls.sql` — the actual `ENABLE ROW LEVEL SECURITY` statements, kept separate so it can be run deliberately at cutover time, together with a frontend deploy.
- `backfill_auth_users.mjs` — one-time Node script (run locally by a project admin with their own `SUPABASE_SERVICE_ROLE_KEY`, never shared) that calls the Admin API to create a real `auth.users` account for every existing `public.users` row. Supports `--dry-run` and `--only=email1,email2` for testing a small batch first.
- `user_directory_view.sql` — creates the `user_directory` view (see "Row Level Security" above) — a post-RLS follow-up fix, run after `enable_rls.sql` broke every other-user lookup.
- `tighten_workflow_rls.sql`, `tighten_audit_rls.sql` — follow-up RLS hardening: the former scopes `documents`/`workflow_steps`/`document_files` writes to actual participants (creator/forwarded-to/assignee) instead of "any logged-in user"; the latter closes a `document_history` impersonation gap. Both close gaps left by the initial `migration_auth_rls.sql` pass, found by auditing actual write call sites against the policies.
- `create_admin_config_tables.sql` — creates `app_settings`/`email_templates`/`workflow_templates`/`workflow_template_steps` with RLS (see "Admin config tables" above).
- `backfill_club_officer_positions.sql` — one-time data fix setting `position_code` on real accounts whose club-officer/กนค.-position role was only ever recorded as free text in `department`.
- `add_doc_number_out_prefix.sql`, `add_doc_number_seq_reset.sql` — add admin-configurable `out_prefix` / `seq_reset_at` columns to `doc_number_settings` (outgoing-number org prefix; mid-year sequence reset).
- `update_template_leadtimes.sql` — one-time data fix setting lead-time requirements on existing `form_templates` rows, matched by the numeric prefix in `name` (same prefix `templates.js`'s `_tmplNumParts()` parses for sorting).
- `functions/` — Edge Function source (`admin-delete-user`, `admin-set-password`, `send-email`, `convert-docx`, `_shared/`). Deploy with `npx supabase functions deploy <name>` (requires `npx supabase login` + `npx supabase link --project-ref jrubupvzltxqstzcpoov` first). Deploying the same source via the Supabase Dashboard's inline editor is unreliable for multi-file functions — it has silently produced a working function under a *different*, auto-generated URL slug than the one you named it, leaving the real endpoint 404ing. The CLI route always makes the URL match the folder name. `admin-delete-user`/`admin-set-password` gate on `is_admin()` via `_shared/requireAdmin.ts`; `send-email`/`convert-docx` are open to any authenticated user (platform-level JWT check only, no role check) since they're not mutating `auth.users`.

### Document Preview (viewer.js)

`openViewer(url, name)` renders PDF/image/HTML/DOCX previews in a modal. **DOCX/DOC preview works by converting the file to PDF server-side, then reusing the PDF.js canvas viewer** (`_pdfBodyHtml()` + `renderPdfView()`) — not a client-side HTML conversion and not an embedded Microsoft/Google viewer. Two approaches were tried and rejected first: mammoth.js (client-side DOCX→HTML) drops page layout/fonts/tables, producing output that looks nothing like the original Word file; Microsoft Office Online Viewer (`view.officeapps.live.com` iframe) is unreliable for self-hosted (non-SharePoint/OneDrive) URLs and reliably fails with "Sorry, Word ran into a problem..." even when the URL is public and reachable.

The actual flow (`renderDocxAsPdf()` in `viewer.js`): calls the `convert-docx` Edge Function with `{url}`, which creates a CloudConvert job (`import/url` → `convert` → `export/url`), polls until finished (up to ~30s), and returns a temporary `pdfUrl`. The client then swaps the loading placeholder for the standard PDF toolbar markup and calls `renderPdfView(pdfUrl)` unchanged. **Requires the `CLOUDCONVERT_API_KEY` secret** (`npx supabase secrets set CLOUDCONVERT_API_KEY=...`) — sign up free at cloudconvert.com (free tier ≈25 conversion minutes/day). Without this secret configured, every DOCX/DOC preview in the app fails and falls back to a "ดาวน์โหลดไฟล์แทน" button.

### CMS / Admin Panels (sysAdmin.js)

`vSys()` renders four admin cards, all backed by real tables (see "Admin config tables" above):
1. `rDocNumCard()` — doc number prefix and sequence per year (`doc_number_settings`).
2. `rAppSettingsCard()` — editable `SETT` values (`app_settings`).
3. `rEmailTemplatesCard()` — per-action subject suffix and extra note (`email_templates`).
4. `rWfTemplatesCard()` — workflow step presets per doc type (`workflow_templates` + `workflow_template_steps`).

### Notification Bell (layout.js)

`_buildNotifBell(activeSteps, PC)` renders the header bell icon. The **badge number shows only `activeSteps`** (workflow steps requiring the user's action). `PC` (pending count) is shown inside the dropdown panel as a separate row but not in the badge — including it in the badge trains users to ignore it. `_toggleNotifPanel()` / `_closeNotifPanel()` handle the dropdown. Counts are recomputed on every `nav()` call.

### Email Notifications (notif.js)

`sendNotifEmail(docId, action, newStatus, note)` — called after workflow state changes. It:
1. Fetches the `email_templates` row for the action key (`subject_suffix`/`extra_note`, editable via "แบบฟอร์มอีเมล" in `vSys()`) — empty unless an admin has saved one
2. Sends via Supabase Edge Function `send-email` (Resend), using `H.Authorization` (the caller's real JWT) — not the static anon key
3. Logs to `notifications` table (`sent_at`, not `created_at` — see Database Tables)

`sendOverdueNotifs()` (called once after every login, capped to once/day per browser via `localStorage`) de-dupes per-document overdue emails by querying `notifications` for a row in the last 24h. That query must filter on `sent_at`, not `created_at` — get this wrong and the dedupe silently no-ops (the query returns a PostgREST error object, `.length` is `undefined`, the `if` falls through) and the same overdue email fires on every single login.

### Document Numbering (docNum.js)

`showNumModal(docId)` opens the numbering modal. On confirm, `doSetDocNumber(docId)` captures **all form values into a `_cap` object before calling `showConfirm`** (because `showConfirm` replaces `mwrap`, destroying the form). `_doSetDocNumberConfirmed(docId, cap)` then uses `cap.xxx` instead of reading from the DOM, computes the real number via `_nextDocNum()`, and PATCHes `documents.doc_number`/`status:'completed'`.

The real bureaucratic format (`กนค. {sem}{pos}{lt}{NNN}[-{club}]/{thaiYear}`) is **only** computed here, in `_nextDocNum()`/`_doSetDocNumberConfirmed()` — never by `genDocNumber()`/`genOutDocNumber()` (docForm.js), which just assign a throwaway sequential placeholder (`GNK-{year}-{seq}` / `กนค.{year}.{seq}`) at doc creation time, overwritten once numbering completes. `{pos}` comes from a different source depending on doc type: outgoing uses the **creator's own** `position_code` (via `GNK_NUM`/`PTH`); incoming uses `SENDER_POS` matched against `doc.addressed_to` (the sender being recorded, not the creator) — `position_code`/`GNK_NUM` are not consulted for incoming numbering at all.

### UI Conventions

- **Two icon systems** in utils.js: `svg(name, size)` renders Lucide icons via `<i data-lucide="...">` (auto-initialized by `_lcr()` and MutationObserver); `svgf(name, size)` renders custom filled SVG paths for solid icon variants.
- **Tailwind CSS, compiled at build time** (see "CSS Build" above) — brand tokens: `#E83A00` (orange-red primary), `#F4F2EF` (app bg), `#18120E` (text dark), `#a89e99` (muted). `tailwind.css`'s `@theme` block defines these as named tokens (`brand`, `navy`, `app`, `app-text-2/3`, etc.) for future use, but in practice every file today reaches for the raw hex value directly via Tailwind's arbitrary-value syntax (`text-[#a89e99]`, `bg-[#E83A00]`) rather than the named utility (`text-app-text-3`, `bg-brand`) — both work, but matching the existing convention (arbitrary hex) keeps new code consistent with the rest of the codebase. **Do not mix Tailwind semantic grey classes** (`text-gray-*`, `border-gray-*`) with the warm-neutral system — use CSS variables or system classes instead.
- CSS utility classes `.btn`, `.btn-primary`, `.btn-soft`, `.btn-danger`, `.fi`, `.fg`, `.fl`, `.fr`, `.al`, `.al-ok/.al-wa/.al-er/.al-in`, `.badge`, `.card`, `.card-head`, `.card-body` — defined in `styles.css`. Registration modals and other popups use `.cpopup-overlay` / `.cpopup-box` / `.cpopup-head` / `.cpopup-body`. The `.am-wrap`/`.am-drop`/`.am-trig` per-row action-menu pattern (admin.js, styles.css) uses `position:fixed` with JS-computed coordinates (`toggleAM()` in admin.js) rather than CSS-anchored `position:absolute` — it has to escape `overflow:hidden`/`auto` ancestors (table card wrappers) that would otherwise clip it. Don't revert this to `position:absolute`.
- `sBadge(status)` / `tBadge(type)` / `urgCls(urgency)` — status/type/urgency display helpers in utils.js
- `alrtH(type, msg)` — returns alert HTML string (type: `'ok'`/`'er'`/`'wa'`/`'in'`). Used for inline form alerts. Different from `showAlert()` which opens a modal.
- `fd(date)` — format date Thai short. `fdTime(date)` — date + time. `fsz(bytes)` — file size. `esc(str)` — HTML escape. Always `esc()` any value sourced from a free-text DB column (e.g. `department`) before interpolating into HTML — several of these fields are admin-editable free text, not enums.
- `showConfirm(title, msg, onConfirm, opts)` / `showAlert(msg, type)` — modal dialogs (never use browser `confirm()`/`alert()`). Both replace `mwrap.innerHTML` — see Navigation & Rendering for implications.
- All user-facing text in Thai. Line-height ≥ 1.7 for Thai readability.

## Key Constraints

- `document_history` and `notifications` are append-only — the `dd()` helper blocks deletes on these tables, and RLS now enforces the same restriction server-side.
- `safeId(id)` must wrap all user-supplied IDs before interpolating into PostgREST query strings.
- Session timeout and SLA days are runtime-configurable via `SETT`, backed by the real `app_settings` table — admins can change them in "ตั้งค่าระบบ". Keep using the `SETT.x||default` pattern (`SETT.session_timeout_min||30`, `SETT.sla_cascade_days||3`) so unsaved keys still fall back sensibly.
- Student ID length/suffix (`student_id_length`, `student_id_suffix` — defaults 10 digits ending in `27`, the กนค. cohort identifier) are editable via `app_settings` the same way.
- `showConfirm()` destroys the modal container's innerHTML. Any function that needs form values after a confirm step must capture them first. Pattern: capture → confirm → use captured values.
- Deleting a `users` row requires unlinking every FK that points at it first (`document_files.uploaded_by`, `form_templates.uploaded_by`, `workflow_steps.assigned_to`/`rejected_by`, `documents.forwarded_to_id`/`final_recipient_id`) — see `_admDelConfirmed()` in admin.js for the full sequence. This list has grown by trial and error (each omission surfaces as a Postgres FK-violation error on delete); if you add a new column referencing `users.id`, add the corresponding unlink step too.
- **For raw `fetch()` calls that bypass `dd()`/`dp()`/`dpa()`** (e.g. bulk-deleting child rows by a non-`id` filter before re-inserting, like wiping `workflow_template_steps`/`doc_type_fields` before a save), always use `headers:{apikey:SK,'Authorization':H.Authorization}` — never `'Authorization':'Bearer '+SK`. The latter authenticates as the anon role (no `auth.uid()`), so `is_admin()`-gated RLS silently denies the request — the fetch still resolves with a non-2xx-but-truthy response, no exception, and the UI reports success while the row never actually changes. Check `r.ok` and throw on failure, matching `dd()`'s own pattern.
