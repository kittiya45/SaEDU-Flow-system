# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the App

No build step. Serve with any static file server:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

`manual.html` is a standalone page — open it separately. It has no dependency on other JS files.

## Architecture

**Vanilla JS SPA — no framework, no bundler, no npm.** All code runs in the browser from static files served directly.

### Script Loading Order (index.html)

Scripts load via `defer` in strict dependency order. The order matters for function overriding:

```
config.js → utils.js → events.js → auth.js
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
- `CU` — current user object (null if not logged in)
- `CV` — current view string (`'dash'`, `'docs'`, `'new'`, `'edit'`, `'det'`, `'tmpl'`, `'adm'`, `'sys'`, `'stat'`)
- `CDI` — current document ID (for detail/edit views)
- `ADOCS` — all documents array (loaded in `vDocs()`)
- `PC` — pending document count (badge in sidebar/mobile nav)
- `MSTEPS` — doc IDs where CU has an active workflow step
- `FS`, `FF`, `FU`, `FDI`, `PF` — form state: workflow steps, files, users, edit doc ID, previous files
- `PED` — PDF editor state object (tool, scale, pages, drawn elements, signature color, etc.)

**Runtime-configurable settings:**
- `SETT` — loaded from `app_settings` table after login via `loadAppSettings()`. Properties: `sla_cascade_days`, `session_timeout_min`, `max_file_size_mb`, `email_prefix`, `system_announcement`, `system_announcement_type`. Always use `SETT.x||default` — never hardcode these values.

**Lookup constants (hardcoded):**
- `DTYPES` — doc type code → Thai label (overridden at runtime by `loadDocTypes()`)
- `DTYPE_CFG` — per-type form field config (also overridden by `loadDocTypes()`)
- `LETTER_TYPES` — 13 incoming document subject types
- `OUT_LTYPES` — outgoing letter types (index 1–9, index 0 is empty)
- `POSS`/`PTH`/`GNK_NUM` — position codes, labels, and doc-number digits
- `CLUBS` — club codes → names
- `STTH`/`RTH` — status/role Thai labels
- `SEMS` — semester codes → Thai labels (`{'1':'ภาคการศึกษาต้น','2':'ภาคการศึกษาปลาย'}`)
- `SENDER_POS` — sender position objects for incoming doc numbering (`{code, name, isClub}`)

### Supabase API Helpers (config.js)

PostgREST via `fetch` — no Supabase client library. Always use `safeId(id)` when interpolating IDs into query strings.

- `dg(table, query)` — GET. Returns parsed JSON (may be array or error object — always check).
- `dp(table, body)` — POST (insert). Returns array; use `res[0].id` for new row ID.
- `dpa(table, id, body)` — PATCH by `id=eq.{id}`. Use for updates.
- `dd(table, id)` — DELETE. Throws if table is `document_history` or `notifications` (protected).
- `upFile(path, file)` — upload File to Supabase Storage `documents` bucket.
- `furl(path)` — get public URL for a stored file path.

For operations that need non-id filters (e.g., PATCH by key), use `fetch(SU+'/rest/v1/'+table+'?key=eq.'+val, {method:'PATCH', headers:H, body:...})` directly.

### Database Tables

| Table | Purpose |
|---|---|
| `users` | Accounts with `role_code`, `position_code`, `is_active`, `approval_status` |
| `documents` | Core doc records with `status`, `doc_type`, `created_by`, `forwarded_to_id` |
| `workflow_steps` | Per-document steps: `status` (`pending`/`active`/`done`/`rejected`), `assigned_to`, `deadline_datetime` |
| `document_files` | Attached files with `file_path` (Storage key), `version` |
| `document_history` | Immutable audit log — **never delete client-side** |
| `notifications` | Email send log — **never delete client-side** |
| `doc_types` / `doc_type_fields` | Runtime doc type config (overrides hardcoded `DTYPE_CFG`) |
| `doc_number_settings` | Per-year prefix and outgoing sequence config |
| `app_settings` | Key-value runtime config → loaded into `SETT` |
| `workflow_templates` / `workflow_template_steps` | Default workflow step presets per doc type |
| `email_templates` | Per-action subject suffix and extra body note |
| `form_templates` | Downloadable form files (templates page) |
| `calendar_events` | Custom dashboard calendar events |

### Event Handling (events.js)

Single delegated `click` listener on `document`. All interactive elements use `data-action="actionName"` with optional `data-id`, `data-view`, `data-tab`, `data-act`, `data-type`, `data-url`, `data-name`. To add a new action: add the button HTML with `data-action="myAction"`, then add `else if(a==='myAction') myAction(id)` to the if/else chain in `events.js`.

### Navigation & Rendering

`nav(view, id)` is the main router — it first renders a loading spinner into the existing `<main>` element, then fetches data, renders the view function, builds the sidebar, and calls `rdr(html)`. `rdr(html)` replaces `#app` innerHTML. There is no URL routing — the app is a single shell.

The modal container is `<div id="mwrap">` — clear it with `mw.innerHTML=''` to close. **Critical:** `showConfirm()` and `showAlert()` both replace the entire `mwrap.innerHTML`. Any code that reads form values after calling `showConfirm` will find those elements gone. Always capture form state into local variables before calling `showConfirm`. See `doSetDocNumber()` in `docNum.js` for the correct pattern.

`boot.js` is the entry point — it calls `showAuth()` on DOMContentLoaded to start the app.

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
              → numbering (incoming after all steps done)
              → completed
     ↑ rejected (any step) → creator fixes → resubmit
```

**Outgoing docs skip the workflow entirely** — they go directly to `completed` when submitted (no approval steps). The file is forwarded to `final_recipient_id` for download.

**Forward flow:** `completed` docs can be forwarded to another user (`forwarded_to_id`). Recipient accepts/declines. Acceptance writes `'เจ้าหน้าที่รับเอกสาร'` to `document_history`.

**SLA:** Rejection deadline uses `addWorkingDays(date, SETT.sla_cascade_days||3)` — working days only (Mon–Fri). Helpers `addWorkingDays()` and `workingDaysLeft()` are in `utils.js`.

### Authentication & Session

Custom PBKDF2 via Web Crypto API. Passwords stored as `pbkdf2$<saltHex>$<hashHex>`. Legacy SHA-256 hashes auto-upgrade on login. Session timeout is `SETT.session_timeout_min * 60 * 1000` ms of inactivity. After login: `loadDocTypes()` then `loadAppSettings()` are called before `nav('dash')`.

### Roles & Permissions

| Role | Code | Access |
|---|---|---|
| ผู้ดูแลระบบ | `ROLE-SYS` | All views, all docs, all admin functions |
| ผู้ลงนาม | `ROLE-SGN` | Sign/approve workflow steps |
| ผู้ตรวจทาน | `ROLE-REV` | Review steps |
| ผู้จัดทำ | `ROLE-CRT` | Create incoming/outgoing docs |
| เจ้าหน้าที่ | `ROLE-STF` | All doc types, user management, stats, numbering |
| อาจารย์กิจการ | `ROLE-ADV` | All doc types, advisory role |

`CAN.sg(role)`, `CAN.rv(role)`, `CAN.cr(role)`, `CAN.ed(role)`, `CAN.up(role)` — permission checks in `config.js`. `ROLE-SYS` and `ROLE-STF` and `ROLE-ADV` can see certificate and memo doc types in the creation form.

### CMS / Admin Panels (sysAdmin.js)

`vSys()` renders four admin cards:
1. `rDocNumCard()` — doc number prefix and sequence per year
2. `rAppSettingsCard()` — editable `SETT` values (saved to `app_settings` table)
3. `rEmailTemplatesCard()` — per-action subject suffix and extra note (saved to `email_templates`)
4. `rWfTemplatesCard()` — workflow step presets per doc type (saved to `workflow_templates` + `workflow_template_steps`)

`saveAppSettings()` PATCHes rows in `app_settings` then calls `loadAppSettings()` to refresh `SETT`. When a new key is saved, `value_type` is inferred from the input element type.

### Notification Bell (layout.js)

`_buildNotifBell(activeSteps, PC)` renders the header bell icon. The **badge number shows only `activeSteps`** (workflow steps requiring the user's action). `PC` (pending count) is shown inside the dropdown panel as a separate row but not in the badge — including it in the badge trains users to ignore it. `_toggleNotifPanel()` / `_closeNotifPanel()` handle the dropdown. Counts are recomputed on every `nav()` call.

### Email Notifications (notif.js)

`sendNotifEmail(docId, action, newStatus, note)` — called after workflow state changes. It:
1. Fetches the `email_templates` row for the action key
2. Appends `subject_suffix` to the email subject
3. Passes `extra_note` into `buildEmailHtml()` (rendered as amber callout block)
4. Sends via Supabase Edge Function `send-email` (Resend)
5. Logs to `notifications` table

### Document Numbering (docNum.js)

`showNumModal(docId)` opens the numbering modal. On confirm, `doSetDocNumber(docId)` captures **all form values into a `_cap` object before calling `showConfirm`** (because `showConfirm` replaces `mwrap`, destroying the form). `_doSetDocNumberConfirmed(docId, cap)` then uses `cap.xxx` instead of reading from the DOM.

Outgoing number format: `กนค. {sem}{pos}{lt}{NNN}[-{club}]/{thaiYear}` — computed by `_nextDocNum()` which scans existing doc numbers in the same category to find the next sequence.

### UI Conventions

- **Two icon systems** in utils.js: `svg(name, size)` renders Lucide icons via `<i data-lucide="...">` (auto-initialized by `_lcr()` and MutationObserver); `svgf(name, size)` renders custom filled SVG paths for solid icon variants.
- **Tailwind CSS via CDN** — brand tokens: `#E83A00` (orange-red primary), `#F4F2EF` (app bg), `#18120E` (text dark), `#a89e99` (muted). The Tailwind config in `index.html` extends these as `brand.*`, `navy`, `app`, etc. **Do not mix Tailwind semantic grey classes** (`text-gray-*`, `border-gray-*`) with the warm-neutral system — use CSS variables or system classes instead.
- CSS utility classes `.btn`, `.btn-primary`, `.btn-soft`, `.btn-danger`, `.fi`, `.fg`, `.fl`, `.fr`, `.al`, `.al-ok/.al-wa/.al-er/.al-in`, `.badge`, `.card`, `.card-head`, `.card-body` — defined in `styles.css`. Registration modals and other popups use `.cpopup-overlay` / `.cpopup-box` / `.cpopup-head` / `.cpopup-body`.
- `sBadge(status)` / `tBadge(type)` / `urgCls(urgency)` — status/type/urgency display helpers in utils.js
- `alrtH(type, msg)` — returns alert HTML string (type: `'ok'`/`'er'`/`'wa'`/`'in'`). Used for inline form alerts. Different from `showAlert()` which opens a modal.
- `fd(date)` — format date Thai short. `fdTime(date)` — date + time. `fsz(bytes)` — file size. `esc(str)` — HTML escape.
- `showConfirm(title, msg, onConfirm, opts)` / `showAlert(msg, type)` — modal dialogs (never use browser `confirm()`/`alert()`). Both replace `mwrap.innerHTML` — see Navigation & Rendering for implications.
- All user-facing text in Thai. Line-height ≥ 1.7 for Thai readability.
- Design system tokens, component patterns, and do/don't rules are documented in `DESIGN.md`.

## Key Constraints

- `document_history` and `notifications` are append-only — the `dd()` helper blocks deletes on these tables.
- The Supabase anon key in `config.js` is intentionally public — Row Level Security enforces access on the DB side.
- `safeId(id)` must wrap all user-supplied IDs before interpolating into PostgREST query strings.
- Session timeout and SLA days are runtime-configurable via `SETT` — **never hardcode** `30` (minutes) or `3` (days); always use `SETT.session_timeout_min||30` and `SETT.sla_cascade_days||3`.
- Outgoing doc number format: encodes semester + position code + letter type + sequence (+ optional club suffix). See `genOutDocNumber()` in docForm.js.
- Student IDs must be 10 digits ending in `27` (กนค. cohort identifier).
- Stat summary tiles (dashboard, todo, stats, admin) use warm neutral white cards with semantic value colors — **not** gradient backgrounds. The gradient card pattern is reserved for nothing; it was removed as an anti-pattern.
- `showConfirm()` destroys the modal container's innerHTML. Any function that needs form values after a confirm step must capture them first. Pattern: capture → confirm → use captured values.
