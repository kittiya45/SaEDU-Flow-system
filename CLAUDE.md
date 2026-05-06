# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**SAEDU Flow** — ระบบเสนอเอกสารอิเล็กทรอนิกส์สำหรับคณะกรรมการนิสิต (กนค.)  
Zero-build, zero-npm, pure vanilla JS + HTML + CSS single-page application backed by Supabase.

## Development

**No build step.** Open `index.html` directly in a browser, or serve with any static file server:

```bash
npx serve .
# or
python3 -m http.server 8080
```

There are no tests, no linter, no type checking. TypeScript is used only in the two Deno edge functions:
- `supabase/functions/send-email/` — Brevo API transactional email sender; called by `fetch(SU+'/functions/v1/send-email', ...)` from the client
- `supabase/functions/verify-login/` — server-side PBKDF2 password verification with hash auto-upgrade (SHA-256 → PBKDF2); called during login to avoid exposing `password_hash` via client-side query

Deploy instructions are in `supabase/DEPLOY.md`.

`manual.html` is a standalone 2800-line user manual (Thai) — it is not part of the app and does not share any scripts with `index.html`.

## Architecture

### Script load order (`index.html`)
`config.js` → `utils.js` → `events.js` → `auth.js` → `dashboard.js` → `docList.js` → `docForm.js` → `workflow.js` → `report.js` → `docDetail.js` → `docNum.js` → `notif.js` → `viewer.js` → `editor.js` → `stats.js` → `sysAdmin.js` → `docTypeAdmin.js` → `templates.js` → `admin.js` → `adminImport.js` → `layout.js` → `boot.js`

`boot.js` calls `showAuth()` to start the app. All scripts load as globals — there are no modules.

### Navigation model
All routing goes through `nav(view, id)` in `layout.js`. It re-renders the entire `#app` div (via `rdr()` in `utils.js`) on every navigation.

**Views:** `dash`, `todo`, `docs`, `new`, `edit`, `det`, `tmpl`, `adm`, `sys`, `stat`

Modals are rendered into `#mwrap` (rendered inside `#app` by `layout.js`). Closing a modal sets `#mwrap.innerHTML = ''`.

`layout.js` already renders the page title in the fixed `<header>` element for every view. View functions (`vDocs()`, `vTmpl()`, etc.) must NOT render their own page title.

### Event handling
`events.js` registers a single delegated `click` listener on `document`. Every interactive element uses `data-action="..."` attributes — no inline `onclick` except legacy `oninput` cases on form inputs. **Adding a new action requires a new `else if` branch in `events.js`.**

### Supabase layer (`config.js`)
- `dg(table, query)` — GET
- `dp(table, body)` — POST (insert, returns array)
- `dpa(table, id, body)` — PATCH by id
- `dd(table, id)` — DELETE (blocked for `document_history` and `notifications`)
- `upFile(path, file)` — upload to `documents` Storage bucket (upsert)
- `furl(path)` — returns public URL for a Storage file
- `safeId(id)` — `encodeURIComponent(String(id||''))`, **always use this** when interpolating any id/UUID into a Supabase query string to prevent injection and encoding errors

`SU` (project URL) and `SK` (anon key) are hardcoded in `config.js`. No RLS is enforced client-side — RLS only protects the audit log from deletion.

### Auth & session (`auth.js`)
- `doLogin()` — checks rate limit (`_loginAttempts` / `_loginLockedUntil`: 5 attempts → 15 min lockout); both counters are persisted in `localStorage` (keys `_la` / `_llu`) so the lockout survives page refresh. Clears localStorage on successful login. Deletes `password_hash` from the user object before assigning to `CU`, then calls `_startSessionTimer()`
- `_startSessionTimer()` — registers named `_actHandler` listeners (click + keydown) and a 60-second interval that logs out after 30 min inactivity; always calls `removeEventListener` before `addEventListener` to prevent duplicates
- `_cleanupSession()` — clears interval, removes listeners, sets `CU = null`
- `doLogout()` — writes audit log entry then calls `_cleanupSession()` + `showAuth()`
- `doChangePw()` — re-fetches `password_hash` from DB instead of reading from `CU` (which no longer holds it)

### Global state (`config.js` + `docList.js`)
- `CU` — current logged-in user object (null when logged out)
- `CV` — current view name
- `CDI` — current document id
- `ADOCS` — document list cache for the docs view
- `AUSERS` — user list cache for admin view
- `FS`, `FF`, `FU`, `PF` — form state: workflow steps, existing files, loaded user list, pending uploads
- `PED` — PDF editor state
- `PC` — pending doc count (badge)
- `_PROJ_FILTER` — currently selected project filter in the docs list (outgoing docs only)
- `_lastAct`, `_sesTmr` — session timeout (30 min inactivity)

### Role system (`config.js`)
Roles: `ROLE-SYS` (admin), `ROLE-SGN` (signer), `ROLE-REV` (reviewer), `ROLE-CRT` (creator), `ROLE-STF` (staff), `ROLE-ADV` (advisor).  
`CAN.cr/up/ed/sg/rv(role)` — permission helpers. All roles can create/edit/upload; only `ROLE-SGN`, `ROLE-ADV`, `ROLE-SYS` can sign.

Special cases:
- `GNK-SEC` position gets secretary-level doc visibility (same as admin).
- `GNK-PRE` (หัวหน้านิสิต) is auto-added as a locked mandatory signer at the end of every **incoming** document's workflow only. This is done inside `selectDocType()` in `docForm.js`. The locked step is skipped only if the creator is GNK-PRE themselves. **Outgoing docs do NOT get GNK-PRE added** (no workflow at all).
- All GNK positions default to `ROLE-CRT` on registration, **except** `GNK-PRE` which defaults to `ROLE-SGN` (the only position that can sign documents).
- `ROLE-STF` has the same user management permissions as `ROLE-SYS`: import users via CSV, approve/reject all account types (including advisors), delete users, reset passwords.

Positions (`POSS`/`PTH`/`PR`) map GNK codes to default `role_code` on registration. There are 25 positions total (GNK-PRE through GNK-FND), with numeric codes 01–26 stored in `GNK_NUM` (position 11 is intentionally unassigned).

### Document type config
`DTYPES` and `DTYPE_CFG` in `config.js` define hardcoded defaults. On app load, `loadDocTypes()` queries the `doc_types` and `doc_type_fields` Supabase tables and **overwrites** both `DTYPES` and `DTYPE_CFG`. The DB-driven config supports a `fields` array per type; the legacy config uses `showFrom`/`showTo`/`showRef`/`showDocDate` flags.

The form (`docForm.js → renderTypeFields()`) checks type before falling through to legacy rendering:
1. `type === 'outgoing'` → always uses a hardcoded custom layout (project + letter type + club + GNK position selector)
2. `type === 'incoming'` → always uses a hardcoded custom layout (letter type + sender info)
3. All other types → check `cfg.fields` for DB-driven layout, otherwise use legacy flags

The create-document form only shows `incoming` and `outgoing` types (filtered via `_VISIBLE_TYPES` in `vForm()`).

The "เลือกผู้ดำเนินการ" dropdown (`wfPersonOpts`) excludes the current user (`CU.id`) and all `ROLE-SYS` users.

### Document workflows by type

**หนังสือขาเข้า (incoming)**
- GNK-PRE is auto-added as locked final signer when type is selected
- Creator step (step 0 / ผู้จัดทำ) is **auto-approved at creation time** — the document immediately skips to step 2 (the next assigned person); no manual approval needed from creator
- Approval modal: signature is **mandatory** (not optional); user can click a PDF preview to place the signature at a chosen position (default: bottom-right of last page)
- When all steps complete → status becomes `numbering` (not `completed`)
- Creator opens `showNumModal` (in `docNum.js`) which **auto-generates** the doc number in format `กนค. SPPTNNN-CC/BBBB` with a wide modal + PDF preview + draggable stamps
- After numbering → status becomes `completed`; creator can optionally forward to staff
- `doSetDocNumber` does **not** modify `doc.title` — the doc number is stored only in `doc_number` column

**หนังสือขาออก (outgoing)**
- **No workflow** — กิจการนิสิต uploads a pre-approved document (already signed by dean/vice-dean) and selects a GNK position to receive it
- Submit → **`completed` immediately** (bypasses pending/workflow/numbering entirely)
- No GNK-PRE locked step, no sequential approvers; `#wf-card` is hidden in the form
- `ประเภทจดหมาย` field is optional (not required for submission)
- Email notification sent to the `addressed_to` GNK position user upon creation
- Documents are organized by project name (`description` field); project filter dropdown in the docs list

### Document status lifecycle
**Incoming:** `draft` → `pending` (submit; creator step auto-approved) → workflow steps (approve/reject loop) → `numbering` → `completed`

**Outgoing:** `draft` → `completed` (submit, instant — no intermediate steps)

**Other types (certificate, memo, etc.):** `draft` → `pending` → workflow → `completed` (skip `numbering`)

**All statuses:** `draft`, `pending`, `rejected`, `numbering`, `completed`, `signed`

### Creator step auto-approval (`docForm.js`)
When a document is submitted (`status='pending'`):
- Step 1 (ผู้จัดทำ) is saved with `status:'done'`, `action_taken:'approve'`, `completed_at` immediately
- Step 2 (the next assigned person) is set to `status:'active'`
- `current_step` is set to `2` in the document record
- An audit log entry "ผู้จัดทำยืนยันเอกสาร (อัตโนมัติ)" is written
- Edge case: if only 1 step exists (creator only, no reviewers), the document transitions to `numbering` or `completed` automatically

### Key constants (`config.js`)
- `DTYPES` — document type labels (overridden from DB at runtime)
- `DTYPE_CFG` — per-doc-type field config (overridden from DB at runtime)
- `URG` — urgency labels
- `LETTER_TYPES` — ประเภทหนังสือ dropdown for **incoming** docs (9 values, 0-indexed); code = index + 1
- `OUT_LTYPES` — ประเภทจดหมาย for **outgoing** docs, 1-indexed array (index 1–9)
- `SENDER_POS` — ตำแหน่ง / สังกัด for incoming docs; **array of `{name, code, isClub}` objects** (38 items). `code` is a 2-digit string (01–24 for positions/departments, 01–15 for clubs). `isClub: true` means the sender is a club — the code is used for both PP (digits 2–3) and CC (digits 8–9) in the incoming doc number. Store/match by `name` field (backward compatible with DB values).
- `CLUBS` — club code → Thai name mapping for **outgoing** docs (separate code space from `SENDER_POS`)
- `SEMS` — semester codes: `'1'` = ภาคต้น, `'2'` = ภาคปลาย
- `GNK_NUM` — GNK position code → 2-digit numeric string (e.g. `'GNK-PRE' → '01'`); used for **incoming** PP digit only (outgoing no longer uses numbering)
- `STTH` — status labels in Thai (includes `numbering: 'รอออกเลขหนังสือ'`)
- `RTH` — role labels (Thai)
- `UTH` — user type labels: `gnk`, `advisor`, `staff`, `admin`
- `POSS` / `PTH` / `PR` — GNK position codes (25 total), Thai names, and default role mappings

### Incoming document field mapping
| Field label | Element ID | DB column |
|---|---|---|
| ประเภทหนังสือ | `fdsc` | `description` |
| ชื่อผู้ส่งเอกสาร | `ffromdept` | `from_department` |
| ตำแหน่ง / สังกัด | `fto` | `addressed_to` |
| (เลขที่อ้างอิง ถูกซ่อน) | `fsubject` (hidden) | `subject_line` |
| วันที่รับเอกสาร | `fdate` | `doc_date` |

### Outgoing document field mapping
| Field label | Element ID | DB column | Notes |
|---|---|---|---|
| โครงการ / กิจกรรม | `fdsc` | `description` | autocomplete via `<datalist id="project-list">` |
| ประเภทจดหมาย | `foutltype` | `subject_line` | optional; stores letter type code `'1'`–`'9'` |
| ชมรม (ถ้ามี) | `fclub` | `from_department` | stores club code e.g. `'07'`, empty if none |
| ส่งให้ตำแหน่งในกนค. | `fto` | `addressed_to` | stores GNK position **code** (e.g. `GNK-ACA`) |
| วันที่หนังสือ | `fdate` | `doc_date` | |
| วันที่กิจกรรม | `feventdate` | `due_date` | |

**Important:** for outgoing docs, `subject_line` stores a single digit (`'1'`–`'9'`), not a text subject. Code in `sendNotifEmail` (`docDetail.js`) detects this and falls back to `doc.title` for email subjects. `from_department` stores the club code, not the creator's department name.

In `docDetail.js`, `addressed_to` for outgoing docs is displayed as `PTH[doc.addressed_to]` (Thai position name). The `description` field is shown as the project name instead of `from_department`.

### Workflow UI helpers (`workflow.js`)
Companion to `docForm.js` for the in-form workflow builder:
- `rWfPeople()` — re-renders the workflow step list from `FS`
- `rmWfPerson(i)` — removes step `i` from `FS`; step 0 (creator) and locked steps are protected
- `addWfPerson()` — reads the person select, inserts a new step into `FS` **before** the first locked step
- `doUp(files)` — uploads files to Storage and appends to `FF`; tracks pending uploads in `PF`
- `delFF(fid, idx)` — deletes a file record from `document_files` and removes it from the `FF` display

### Workflow (`docForm.js` + `workflow.js`)
`FS` is the in-memory array of workflow steps while the form is open. Step 0 (ผู้จัดทำ) is always the creator and cannot be deleted. Steps with `locked: true` (GNK-PRE for incoming only) show a lock icon and cannot be deleted. When adding a new person, they are inserted **before** the first locked step, not appended to the end.

`selectDocType(type)` in `docForm.js` manages `FS` when the user switches type:
- Clears any locked steps from `FS`
- Re-adds GNK-PRE locked step for **incoming only** (skipped if creator is GNK-PRE)
- **Outgoing**: hides `#wf-card`, changes submit button to "อัพโหลดและส่งเอกสาร"
- **Other types**: shows `#wf-card`, submit button is "ส่งเข้าขั้นตอนอนุมัติ"
- Calls `_populateProjectList()` for `outgoing` to fill the `<datalist>`

### Concurrency guards (`docDetail.js` + `docNum.js`)
All mutating async actions use module-level boolean guards to prevent double-submission. The pattern: check flag → set flag → do work → reset flag in success path AND in `.catch()` on the events.js call site.

- `_actBusy` — guards `doAct` (approve/reject). Reset on validation error returns, on success (before `setTimeout`), and via `doAct(...).catch(function(){_actBusy=false;})` in `events.js`.
- `_resubBusy` — same pattern for `doReSubmit`. Reset via `.catch()` in `events.js`.

`_nextDocNum(docId, docType, catPfx, club, thisYear, thaiYear)` in `docNum.js` — extracts sequence number logic into a reusable helper. Crucially, it **excludes `docId`** from the query (`id.neq.docId`) so retries don't count the current document's own in-flight number.

`doSetDocNumber` uses a **detect-and-retry loop** (max 3 iterations) after writing `doc_number` to DB:
1. Query: does any *other* document already have this `doc_number`?
2. If no conflict → done.
3. If conflict and `_r < 2` → call `_nextDocNum` again (fresh DB query), update `note`, patch the document with the new number.
4. If conflict and `_r === 2` → `console.warn` and `break` (do not write again). The document keeps the last written number. The warning check is **before** any new write so the document is never patched to a 4th candidate while an error is being reported.

The outgoing branch in `showNumModal` / `doSetDocNumber` is effectively unreachable in the current flow (outgoing skips `numbering` status). It is retained as legacy code.

### Rejection flow (`docDetail.js`)
When a workflow step is rejected (`doAct` with `action='reject'`):
- Reviewer selects "ส่วนที่ต้องแก้ไข" from a dropdown (required)
- Reviewer can optionally attach a correction file ("แนบไฟล์วงแก้ไข") — PDF or image with annotations/highlights
- Correction file is uploaded to Storage with prefix `reject_TIMESTAMP_` and saved to `document_files` with file name `[ตีกลับ] originalname` and the next available version number
- Files with `[ตีกลับ]` prefix display a red **ตีกลับ** badge in the file list and version history modal
- After rejection, the document status becomes `rejected` and appears in the creator's **"รอฉัน"** tab (not just the "ส่งคืน" tab)

### Export / print (`report.js`)
- `exportDocPDF(docId)` — opens a `window.open` print-ready HTML report with workflow steps and audit history; no PDF library, relies on browser print
- `exportCSV()` — exports `ADOCS` (current filtered list) as UTF-8 BOM CSV (BOM needed for Thai text in Excel); triggered by the "ส่งออก CSV" button in `vDocs()`

### Numbering flow (`docNum.js`)
**Incoming only** reaches `numbering` status after all workflow steps complete. `showNumModal(docId)` and `doSetDocNumber(docId)` in **`docNum.js`** handle this.

The "ออกเลขหนังสือ" button is shown when `doc.status==='numbering' && (doc.created_by===CU.id || ['ROLE-SYS','ROLE-STF'].includes(CU.role_code))`. Signers and reviewers cannot issue numbers.

Auto-generates a doc number in format `กนค. SPPTNNN-CC/BBBB` using a wide modal (880px) with left-side form and right-side PDF preview with draggable stamp overlays:
- `S` (หลักที่ 1) — ภาคการศึกษา: `1` = ต้น, `2` = ปลาย (user selects)
- `PP` (หลักที่ 2–3) — `SENDER_POS.find(p => p.name === doc.addressed_to).code`
- `T` (หลักที่ 4) — `LETTER_TYPES.indexOf(doc.description) + 1`
- `NNN` (หลักที่ 5–7) — running sequence per category+year, 3 digits
- `CC` (หลักที่ 8–9, after dash) — `SENDER_POS` entry `code` if `isClub === true`, otherwise omitted
- `/BBBB` — Thai year (CE + 543)

`doSetDocNumber` does **not** prepend the doc number to `doc.title`; it is stored only in `doc_number`.

### Approval modal — signature placement (`docDetail.js`)
The approve modal (`showActModal`) includes a PDF position picker section:
- `_actSigPos` global `{xFrac, yFrac}` stores the chosen position as fractions (0–1) of page width/height from top-left
- `_actSigPdfW` / `_actSigPdfH` store the actual PDF page dimensions in points
- `_loadSigPosPreview(docId)` — lazy-loads PDF.js, renders the last page to a canvas, sets a default bottom-right position, attaches a click handler on the wrap div (accounting for `scrollTop`)
- `_updateSigPosIndicator()` — draws the red dashed indicator box at the chosen position using `canvas.offsetWidth/offsetHeight`
- In `doAct`, `_actSigPos` is used to compute pdf-lib coordinates: `pdfX = xFrac*pw`, `pdfY = (1-yFrac)*ph - 60`; defaults to bottom-right if null

### Password hashing
Done **client-side** via Web Crypto API. Format: `pbkdf2$<saltHex>$<hashHex>` (SHA-256, 100k iterations). Legacy SHA-256 hashes are auto-upgraded to PBKDF2 on the next successful login. **Plaintext passwords cannot log in** (`checkPw` returns `false` for them) — admin must reset via `admResetPw`.

### Email notifications
`sendNotifEmail(docId, action, newStatus, note)` in `notif.js` handles workflow step notifications. For outgoing docs at creation (`completed`), the email targets the user whose `position_code` matches `doc.addressed_to`. The `subj` variable detects single-digit `subject_line` values and uses `doc.title` instead.

### File version history (`docDetail.js`)
Files are grouped by version in the document detail view:
- **ฉบับปัจจุบัน** — files with `version === maxVer`, shown with green border + "v{N} ล่าสุด" badge
- **ประวัติเวอร์ชันก่อนหน้า** — shown in `showVerHist()` modal

File name prefixes carry semantic meaning but are **stripped from display** — shown as badges instead:
- `[ลงนาม]` / `signed_TIMESTAMP_` → **ลงนามแล้ว** badge
- `[ตีกลับ]` / `reject_TIMESTAMP_` → **ตีกลับ** badge (red)
- `[แก้ไข]` / `edited_TIMESTAMP_` → **แก้ไข** badge

The strip regex used everywhere: `.replace(/^(\[(ลงนาม|ตีกลับ|แก้ไข)\]\s*)+/g,'').replace(/^(signed|reject|edited)_\d+_/,'')`. This applies to both the rendered name and the `data-name` attribute on viewer/download/editor buttons.

Signing a file no longer stacks `[ลงนาม]` prefixes — existing prefixes are stripped before saving the new filename.

The card header shows "ดูฉบับเซ็น" and "โหลดฉบับเซ็น" shortcut buttons when a signed file exists (no separate banner row).

### Stats page (`stats.js`)
- Document files are queried with `order=version.desc,uploaded_at.desc` so `fls[0]` is always the latest version
- The download button (`_sdl`) downloads only the latest file (not all versions)

### Form templates (`templates.js`)
`vTmpl()` — view for browsing downloadable form templates, visible to all logged-in users. Templates are grouped into three categories: `incoming` (หนังสือขาเข้า), `outgoing` (หนังสือขาออก), `general` (ทั่วไป). Category constants live in `TMPL_CATS` / `TMPL_CAT_CLS` / `TMPL_CAT_ICO` at the top of `templates.js`.

Admin-only functions: `showTmplUpload()`, `doTmplUpload()`, `doTmplDelete(id, path)`.  
Preview function: `tmplPreview(url, name, ext)` — PDF opens in iframe modal; DOC/DOCX opens via Google Docs Viewer; other types show a "download instead" message.

Files are stored in the existing Supabase `documents` bucket with a `tmpl_TIMESTAMP_name` prefix (flat, no subdirectory — avoids `encodeURIComponent` slash-encoding issues). Metadata is stored in the `form_templates` table. Deletion is a soft-delete (`is_active = false`) because the anon key cannot delete from Storage.

The `form_templates` table requires an RLS policy (already applied):
```sql
CREATE POLICY "form_templates_all" ON form_templates FOR ALL TO public USING (true) WITH CHECK (true);
```

### Audit log
All significant actions write to `document_history` table. `document_history` and `notifications` cannot be deleted from client code (guarded in `dd()`) and are also protected by RLS.

### Viewer and PDF Editor
- `viewer.js` — `openViewer(url, name)` opens a full-screen overlay to display PDF/image files from Storage
- `editor.js` — `openEditor(url, name, fileId, docId)` opens the PDF editor for placing signatures, text, and images on a PDF. State tracked in global `PED`. Saves back to Storage and updates `document_files`.

### Admin modules
- `admin.js` — `vAdm()` user management view. Both `ROLE-SYS` and `ROLE-STF` have full access: approve/reject all registrations (including advisors), toggle active, reset passwords, delete users, edit user info, import users via CSV
- `adminImport.js` — CSV import guarded by `ROLE-SYS || ROLE-STF`
- `sysAdmin.js` — `vSys()` system settings including `doc_number_settings` table (legacy; the `กนค. SPPTNNN-CC/BBBB` format is now hardcoded in `docNum.js` for incoming only)
- `docTypeAdmin.js` — manage document types in DB (`showDocTypeModal`, `saveDocType`, `deleteDocType`) affecting `doc_types` and `doc_type_fields` tables

### Docs list (`docList.js`)
The **"รอฉัน"** tab (`DTAB === 'mine'`) includes:
1. Documents where the current user has an **active** workflow step (`MSTEPS`)
2. Documents with `status === 'rejected'` where `created_by === CU.id`

This ensures creators see their rejected documents in "งานของฉัน" without navigating to the separate "ส่งคืน" tab.

### Utility functions (`utils.js`)
- `rdr(html)` — replaces entire `#app` innerHTML
- `esc(s)` — HTML-escape
- `gv(id)` / `$e(id)` — shorthand for `getElementById` value / element
- `alrtH(type, msg)` — renders an alert banner (`ok`, `er`, `in`, `wa`). **`msg` is HTML-escaped** — do not pass raw HTML tags. When markup is needed inside the message, build the `<div class="al al-...">` string directly.
- `svg(name, size)` — returns inline SVG by icon name (primary icon system; Lucide CDN is loaded but rarely used)
- `svgf(name, size)` — filled/solid icon variants used for stat-card icons on coloured backgrounds (e.g. `svgf('doc_f',16)`)
- `fd(date)` — Thai locale date formatter
- `fsz(bytes)` — human-readable file size (B/KB/MB)
- `ini(name)` — initials from full name (2 chars)
- `sBadge(status)` / `tBadge(type)` — status/type badge HTML
- `urgCls(urgency)` — CSS class for urgency level
- `debounce(fn, ms)` — standard debounce; used for search inputs (e.g. `fDocsDebounced` in `docList.js`)
- `loadSc(src)` — dynamically injects a `<script>` tag and returns a Promise; used to lazy-load heavy CDN libraries (PDF.js, pdf-lib, fontkit) only when needed rather than at page startup

## CSS / Styling rules

The app uses **Tailwind CSS (CDN)** for utility classes alongside a custom `styles.css` that defines the design system via CSS custom properties (`--orange`, `--text`, `--border`, etc.).

**Always prefer existing CSS classes** over inline styles:
- Cards: `.card`, `.card-head`, `.card-head-title`, `.card-body`, `.card-empty`
- Admin stat cards: `.adm-stat-card` (provides CSS-hover lift; set `--card-sh-base` and `--card-sh-hover` as inline CSS custom properties for per-card shadow colours)
- File rows: `.file-item`, `.file-icon`, `.file-info`, `.file-name`, `.file-meta`, `.file-actions`
- Search: `.search-wrap` + `.search-icon` span (matches `docList.js` pattern)
- Modals: `.mo`, `.modal`, `.modal-head`, `.modal-title`, `.modal-body`, `.modal-foot`
- Alerts: `.al.al-ok/er/in/wa`
- Tabs: `.page-tabs`, `.ptab`, `.ptab.on`

**Do not** use inline `onmouseenter`/`onmouseleave` for hover effects — CSS `:hover` via `.card:hover`, `.file-item:hover`, `.btn:hover` handles all hover states.

View functions render HTML strings via `html.push()` and `html.join('')`. The only exception is modals, which set `$e('mwrap').innerHTML` directly.
