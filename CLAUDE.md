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

**Cache-busting:** the `<link>` and every `<script>` in `index.html` carry a `?v=N` query param (including `styles.tailwind.css?v=N`). The static host caches by URL, so **bump the relevant `?v=N` whenever you change that file** — and bump `styles.tailwind.css?v=N` specifically whenever you add new Tailwind classes anywhere, or returning browsers get stale CSS with the new classes missing (a real, recurring symptom: "my style change isn't showing" almost always means a `?v` wasn't bumped or the user didn't hard-refresh).

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
| `users` | Accounts — `role_code`, `position_code`, `is_active`, `approval_status`, `auth_uid` (links to `auth.users`), `line_user_id`/`line_link_code` (LINE OA linking — see LINE OA Notifications) |
| `documents` | Core doc records with `status`, `doc_type`, `created_by`, `forwarded_to_id` |
| `workflow_steps` | Per-document steps: `status` (`pending`/`active`/`done`/`rejected`), `assigned_to`, `rejected_by`, `deadline_datetime` |
| `document_files` | Attached files with `file_path` (Storage key), `version`, `uploaded_by` |
| `document_history` | Immutable audit log — **never delete client-side**, enforced by both `dd()` and RLS |
| `notifications` | Email send log — **never delete client-side**, enforced by both `dd()` and RLS. Columns are `sent_at`/`status`/`notification_type`, **not** `created_at`. `SELECT` is restricted to the recipient + admins (see RLS) — to check "was an overdue email already sent" use the `overdue_notif_sent_at(p_doc)` / `overdue_notif_exists(p_doc)` RPCs, not a direct `dg('notifications', ...)` |
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

**Fixed workflow flows (incoming docs):** creating an incoming doc forces a **locked step chain** chosen by the selected letter type — a letter type in `BUDGET_LTYPES` (config.js: the two ขออนุมัติโครงการ variants + ขออนุมัติปรับงบ) gets the 7-step budget flow `FLOW_STEPS_BUDGET` (เหรัญญิก → เจ้าหน้าที่กิจการนิสิต → ผู้รับผิดชอบโครงการ again → ประธานฝ่าย → หัวหน้านิสิต → อาจารย์ที่ปรึกษา, after the creator's step 1); everything else gets the 4-step `FLOW_STEPS_GENERAL`. `_applyFixedFlow()` (docForm.js) rebuilds `FS` on doc-type select and again on every letter-type change (hooked into `_updateLtHint()`), carrying over manual assignee picks by step name. Locked steps can't be deleted or reordered (add-person row hidden; `rmWfPerson` guards `locked`) but **each step's assignee is editable** via a per-step dropdown in `rWfPeople()` (workflow.js) — except the `fixSelf` step (budget step 4, always the creator). Per-step dropdowns and the main `#wfadd` picker share `_wfPersonOptsHtml()` (workflow.js) — position/role-grouped `<optgroup>` options; don't regress a person picker to a flat name list. A second อาจารย์ที่ปรึกษา step can be appended via `addAdvisorStep()` (the "+ เพิ่มอาจารย์ที่ปรึกษา" button rWfPeople renders under locked flows) — it carries `extra:true`, which makes it deletable (unlike other locked steps) and survives letter-type switches as-is. Defaults are resolved from `user_directory` by `position_code` (`pos:` — GNK-PRE, GNK-TRS) or first user with `role_code` (`role:` — ROLE-STF, ROLE-ADV); ประธานฝ่าย has no default and must be picked. `ROLE-STF`/`ROLE-SYS` creators are exempt (free-form steps as before; workflow templates still auto-apply for them only). `locked`/`fixSelf` are UI-only flags — stripped before `workflow_steps` insert. All locked steps must have an assignee before save, **including drafts** — steps are frozen at creation (the edit form has no workflow card), so an unassigned locked step could never be filled later.

**Forward flow:** `completed` docs can be forwarded to another user (`forwarded_to_id`). Recipient accepts/declines. Acceptance writes `'เจ้าหน้าที่รับเอกสาร'` to `document_history`.

**Recall flow ("ดึงกลับ"):** the creator can pull a `pending` doc back to `draft` — but only while **no step beyond step 1 is `done`** (step 1 is the creator's own auto-done step; once anyone else approves, recall is blocked and the holder must "ส่งคืนแก้ไข" instead). `doRecall()`/`_doRecallConfirmed()` in docDetail.js re-checks doc status + steps fresh from the DB before acting (guards against an approval landing while the page sat open), then resets steps to the exact shape of a freshly-created draft — step 1 `active` (deadline reset), steps 2+ `pending` (deadline cleared), all action fields nulled. That shape matters: on re-submit, docForm.js's edit branch (`FDI` set) doesn't touch steps at all except re-activating a `rejected` one, so a recalled doc must already look like a natural draft or it re-enters `pending` with no active step. Recall logs `'ดึงเอกสารกลับ'` to `document_history` and emails the previously-active assignee directly (respecting `notify_step`; `notification_type:'recall'`) — it does NOT go through `sendNotifEmail()`, whose recipient routing has no recall case.

**SLA:** Rejection deadline uses `addWorkingDays(date, SETT.sla_cascade_days||3)` — working days only (Mon–Fri). Helpers `addWorkingDays()` and `workingDaysLeft()` are in `utils.js`.

**Approve/reject is not atomic** (multiple sequential REST writes: step update → next-step activate → document status → history; no transaction). `doAct()` in docDetail.js wraps the core writes in try/catch and on failure calls `_reconcileDocState(docId)` — a self-heal guard that re-derives the document's canonical status from its `workflow_steps` (active step → `pending`; rejected step → `rejected`; only touches docs still in `pending`/`active`/`rejected`, never `numbering`/`completed`, to avoid re-firing numbering/forward side-effects). It's a mitigation, not true atomicity; the correct long-term fix is a Postgres RPC for the whole transition.

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
- Document workflow tables (`documents`, `document_files`, `workflow_steps`, `document_history`): `SELECT` is open to any authenticated user (matches pre-migration app behavior — these are fetched in full and filtered client-side, no per-row secrecy between logged-in members was ever intended). Writes are gated by `auth.uid() is not null`, with explicit ownership checks (`created_by = current_profile().id`) layered on for `documents`/`calendar_events` insert/delete where the app already enforced that distinction client-side.
- `notifications`: **`SELECT` is NOT open** — restricted to `is_admin() OR recipient_id = current_profile().id` (it carries `recipient_email`, an email-leak risk if open). Set by `supabase/restrict_notifications_select.sql`, which also adds the `overdue_notif_exists(p_doc)` security-definer RPC so the overdue-dedup in `notif.js` can still check existence without reading rows. If you tighten `documents`/`document_files`/`document_history` SELECT the same way later, do it via an RPC for any cross-user existence check the client still needs.

**RLS is live in production** — all tables have `ENABLE ROW LEVEL SECURITY` on (verified). `supabase/check_rls_status.sql` is the read-only query to re-verify (catches a table with RLS off, or policies that exist but RLS disabled). **If you add a new table that the app should read/write, it needs an explicit RLS policy AND `ENABLE ROW LEVEL SECURITY`** — there is no default-allow, and policies are inert until RLS is enabled. `supabase/enable_rls.sql` holds the enable statements (run together with a frontend deploy, never alone — see comments in that file).

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
- `add_doc_number_unique_index.sql` — partial unique index `documents(doc_number) WHERE doc_number IS NOT NULL` so the DB rejects duplicate official numbers under concurrent issuance (the client-side `_nextDocNum()` is check-then-act with no lock; the index is what makes the retry in `_doSetDocNumberConfirmed()` actually prevent dupes). Includes a duplicate-finder query to run first (CREATE UNIQUE INDEX fails if dups already exist).
- `restrict_notifications_select.sql` — restricts `notifications` SELECT to recipient/admin + adds the `overdue_notif_exists()` RPC (see RLS section). Deploy the frontend (`notif.js` calling the RPC) together with running this, or overdue-email dedup breaks temporarily.
- `overdue_once_auto_approve.sql` — the overdue policy RPCs (see "Email Notifications"): redefines `overdue_notif_exists()` to all-time (warn once ever, not per-24h), adds `overdue_notif_sent_at()` (first-warning timestamp, drives the grace-period math) and `auto_approve_overdue()` (security definer; atomically auto-approves the last workflow step or auto-accepts a forwarded doc after the warning + `sla_cascade_days` working days — done server-side because the logged-in user running the check usually has no RLS write access to that doc). Frontend has a fallback for pre-SQL deploys, so ordering vs. frontend deploy doesn't matter.
- `check_rls_status.sql` — read-only diagnostics: which tables have RLS off, per-table RLS+policy-count overview, full policy dump.
- `line_notifications.sql` — adds `line_user_id` / `line_link_code` / `line_link_code_expires_at` columns to `users` (+ partial unique index on `line_user_id`) for the LINE OA notification channel (see "LINE OA Notifications").
- `functions/` — Edge Function source (`admin-delete-user`, `admin-set-password`, `send-email`, `convert-docx`, `send-line`, `line-webhook`, `_shared/`). Deploy with `npx supabase functions deploy <name>` (requires `npx supabase login` + `npx supabase link --project-ref jrubupvzltxqstzcpoov` first). Deploying the same source via the Supabase Dashboard's inline editor is unreliable for multi-file functions — it has silently produced a working function under a *different*, auto-generated URL slug than the one you named it, leaving the real endpoint 404ing. The CLI route always makes the URL match the folder name. `admin-delete-user`/`admin-set-password` gate on `is_admin()` via `_shared/requireAdmin.ts`; `send-email`/`convert-docx`/`send-line` are open to any authenticated user (platform-level JWT check only, no role check) since they're not mutating `auth.users`. `line-webhook` must be deployed with **`--no-verify-jwt`** (LINE's servers have no Supabase JWT) — it authenticates requests via the `x-line-signature` HMAC header instead.

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

`sendOverdueNotifs()` (called once after every login, capped to once/day per browser via `localStorage`) implements the overdue policy: **warn once per document ever** (not once/day), then **auto-process** stuck docs. Flow per overdue doc (`due_date` passed, `notify_overdue=true` — covers both `pending` docs and `completed`+forwarded docs whose recipient hasn't accepted yet, the latter filtered client-side against `document_history action=eq.เจ้าหน้าที่รับเอกสาร`):
1. `overdue_notif_sent_at(p_doc)` security-definer RPC (needed because `notifications` SELECT is restricted to the recipient — the runner usually can't see other users' rows) returns the first-warning timestamp, or null.
2. Null → send the one-and-only overdue email (recipients: active-step assignee and/or `forwarded_to_id`, plus creator; the email states the auto-process deadline when the doc qualifies).
3. Warned and `addWorkingDays(sentAt, SETT.sla_cascade_days||3)` has passed → call the **`auto_approve_overdue(p_doc)` RPC**, which re-validates everything server-side and atomically either approves the **last** workflow step (doc → `numbering`/`completed`; no signature is embedded — the history entry says so) or writes the `'เจ้าหน้าที่รับเอกสาร'` acceptance for a forwarded doc. Only those two shapes qualify; a doc stuck mid-workflow just stays warned-once. On `approved_*` the client then emails the creator via the normal `numbering`/`completed` path.
All three RPCs live in `supabase/overdue_once_auto_approve.sql`. If the new RPC isn't deployed yet (404), the code falls back to the old `overdue_notif_exists(p_doc)` boolean dedup and never auto-approves — warning emails are fail-open, auto-approve is fail-closed. Docs with `notify_overdue=false` get neither warnings nor auto-processing (query + RPC both check it).

### LINE OA Notifications (notif.js)

Supplementary push channel for users who rarely open email — email remains the primary channel; every LINE failure is silent/fail-open. Requires the `LINE_CHANNEL_ACCESS_TOKEN` + `LINE_CHANNEL_SECRET` secrets and a LINE OA with Messaging API enabled (see `supabase/functions/send-line/index.ts` + `line-webhook/index.ts` headers for setup).

- **Account linking (6-digit code flow):** bell panel → "รับแจ้งเตือนทาง LINE" → `showLineLink()` modal (notif.js). `doLineLinkCode()` writes a random 6-digit code + 10-min expiry to the user's own `users.line_link_code` (own-row RLS covers it). The user adds the OA as a friend (add-friend link built from `SETT.line_oa_id`) and sends the code in chat; the **`line-webhook` Edge Function** (deployed with `--no-verify-jwt`, authenticated via `x-line-signature` HMAC instead) matches the code with the service-role client, writes `users.line_user_id`, clears the code, and replies confirmation (reply messages are free — push messages consume the OA's monthly quota). `unfollow` events clear `line_user_id` (blocked OA can't be pushed to anyway).
- **Sending:** `sendLinePush(recipientId, text)` calls the **`send-line` Edge Function** with the profile `users.id` — the function resolves `line_user_id` server-side with the service role. `line_user_id` is deliberately **not** in the `user_directory` view; never try to read another user's `line_user_id` client-side. Not-linked recipients return `{skipped:'not_linked'}` — not an error.
- **Logging:** `sendLineWithLog()` logs attempted sends (never `skipped`) to `notifications` with the **same `notification_type` as the email of that action**, subject prefixed `[LINE]`. That type-sharing is deliberate: the overdue dedup RPCs filter `notification_type='overdue'`, so a LINE-only warning (recipient with no real email) still marks the doc as warned and starts the auto-approve clock. Don't switch LINE rows to a distinct type without reworking that dedup.
- **Recipient lists include email-less users:** `sendNotifEmail()` builds recipients via `_push(u)` with an `emailOk` flag — users with `@gnk.student` placeholder emails now enter the list (they're exactly the LINE-only audience); email sends and email log rows stay gated on `emailOk`. LINE is also wired into `sendRejectFyiEmail()`, docDetail.js forward + recall, and docNum.js outgoing + post-numbering forward.
- **Message text:** `buildLineText(o)` — compact plain-text sibling of `buildEmailHtml()`; appends `SETT.app_url` as the login link when set. `SETT.line_oa_id` / `SETT.app_url` are editable in "ตั้งค่าระบบ" (`rAppSettingsCard`).
- **Flex Message cards:** `buildLineFlex(o)` (notif.js) builds a styled bubble — brand-orange header, doc info rows, a "ความคืบหน้า x/y ขั้นตอน" section listing every workflow step with ✓ (done) / ● รออยู่ (active) / ○ (pending) / ✕ (rejected) markers and assignee names (resolved via `_lineStepsInfo()` → `user_directory`), and a CTA button (only when `SETT.app_url` is a valid http(s) URL — LINE rejects invalid URIs). `sendLinePush`/`sendLineWithLog`/`sendLineGroupPush` all take an optional trailing `flex` arg; `buildLineText` output still travels alongside as the **altText** (chat-list preview, 400-char cap) and as the fallback. The `send-line` Edge Function sends `{type:'flex'}` when `flex` is present, plain text otherwise — an **older deployed function version simply ignores the `flex` field** (destructuring drops it), so the frontend can ship first, but the cards only appear after `npx supabase functions deploy send-line`. Every flex build site is wrapped in its own try/catch with `null` fallback — a builder bug degrades to plain text, never blocks the notification.
- **Staff group channel:** one LINE group (system-wide) can also receive notifications — `sendLineGroupPush()` calls `send-line` with `{group:true}`; the function resolves the groupId from `app_settings` key `line_group_id` server-side. Fired **once per event** (not per recipient) at the end of `sendNotifEmail()`, only for actions in `SETT.line_group_events` (default `create,resubmit,overdue`); group sends are **not** logged to `notifications` (no per-recipient row; overdue dedup relies on the per-recipient rows written in the loop). Linking mirrors the personal flow: invite the bot to the group (requires "allow bot to join groups" in OA Manager; `join` event replies instructions), admin generates a 6-digit code in ตั้งค่าระบบ (`_genLineGroupCode()` writes `app_settings` keys `line_group_link_code`/`line_group_link_expires`), someone posts it in the group, `line-webhook` matches and upserts `line_group_id`. A `leave` event (bot kicked) clears `line_group_id`. Group messages never trigger personal linking (the webhook's personal-code branch requires `source.type === 'user'`).

### Document Numbering (docNum.js)

`showNumModal(docId)` opens the numbering modal. On confirm, `doSetDocNumber(docId)` captures **all form values into a `_cap` object before calling `showConfirm`** (because `showConfirm` replaces `mwrap`, destroying the form). `_doSetDocNumberConfirmed(docId, cap)` then uses `cap.xxx` instead of reading from the DOM, computes the real number via `_nextDocNum()`, and PATCHes `documents.doc_number`/`status:'completed'`.

The real bureaucratic format (`กนค. {sem}{pos}{lt}{NNN}[-{club}]/{thaiYear}`) is **only** computed here, in `_nextDocNum()`/`_doSetDocNumberConfirmed()` — never by `genDocNumber()`/`genOutDocNumber()` (docForm.js), which just assign a throwaway sequential placeholder (`GNK-{year}-{seq}` / `กนค.{year}.{seq}`) at doc creation time, overwritten once numbering completes. `{pos}` comes from a different source depending on doc type: outgoing uses the **creator's own** `position_code` (via `GNK_NUM`/`PTH`); incoming uses `SENDER_POS` matched against `doc.addressed_to` (the sender being recorded, not the creator) — `position_code`/`GNK_NUM` are not consulted for incoming numbering at all.

`{club}` (digits 8–9) is **canonical to `CLUBS`** for both directions. Outgoing stores a `CLUBS` code in `from_department` directly; incoming resolves the club via `_clubCodeByName()` (docNum.js), which maps the `SENDER_POS` club *name* to its `CLUBS` code (with a small `_CLUB_NAME_ALIAS` for names that differ between the two lists), falling back to the `SENDER_POS` code only if the club isn't in `CLUBS`. So the same physical club gets the same 8–9 digits regardless of in/out.

**Concurrency:** the write in `_doSetDocNumberConfirmed()` is wrapped in a retry loop that catches a unique-violation (from the `documents_doc_number_unique` partial index, see `supabase/add_doc_number_unique_index.sql`), recomputes `_nextDocNum()`, and retries — this is what actually prevents duplicate official numbers when two staff issue simultaneously. The client check alone (read max, +1) is racy; the DB index is the real guard. If the Thai font can't load when stamping the number onto the PDF, stamping is **skipped** (with an audit-log note) rather than stamping a Thai-stripped, wrong-looking number — the `doc_number` in the DB is already correct.

### UI Conventions

**Visual design system:** `DESIGN.md` (project root, Google Stitch format) is the canonical visual spec — color roles, typography scale, elevation, component patterns, and named rules (e.g. "One Voice Rule": orange ≤10% of a screen, reserved for action/live state; "One Bold Layer Rule": the orange primary button is the only tactile element). `.impeccable/design.json` is its machine-readable sidecar. Consult DESIGN.md before restyling; new UI should extend these tokens, not introduce a parallel style.

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
