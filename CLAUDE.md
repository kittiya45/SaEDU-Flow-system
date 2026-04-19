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

**Edge Function** (email sending) lives in `supabase/functions/send-email/`:

```bash
supabase functions deploy send-email --project-ref jrubupvzltxqstzcpoov
supabase secrets set BREVO_API_KEY=xkeysib-xxx FROM_EMAIL=noreply@domain.com FROM_NAME="SAEDU Flow" \
  --project-ref jrubupvzltxqstzcpoov
```

There are no tests, no linter, no type checking for the main JS (only the Deno edge function has TypeScript).

## Architecture

### Script load order (index.html)
`config.js` → `utils.js` → `events.js` → `auth.js` → `dashboard.js` → `docList.js` → `docForm.js` → `workflow.js` → `report.js` → `docDetail.js` → `viewer.js` → `editor.js` → `admin.js` → `layout.js` → `boot.js`

`boot.js` just calls `showAuth()` to start the app.

### Navigation model
All routing goes through `nav(view, id)` in `layout.js`. It re-renders the entire `#app` div including the navbar on every navigation. Views: `dash`, `todo`, `docs`, `new`, `edit`, `det`, `adm`.

### Event handling
`events.js` registers a single delegated `click` listener on `document`. Every interactive element uses `data-action="..."` attributes — no inline `onclick` except in a few legacy `oninput` cases. Adding a new action requires a new `else if` branch in `events.js`.

### Supabase layer (config.js)
Four thin wrappers over the REST API:
- `dg(table, query)` — GET
- `dp(table, body)` — POST (insert)
- `dpa(table, id, body)` — PATCH by id
- `dd(table, id)` — DELETE (blocked for `document_history` and `notifications`)

`SU` and `SK` (anon key) are hardcoded in `config.js`. No RLS is enforced client-side.

### Global state (config.js)
- `CU` — current logged-in user object (null when logged out)
- `CV` — current view name
- `CDI` — current document id
- `ADOCS` — document list cache for the docs view
- `AUSERS` — user list cache for admin view
- `FS`, `FF`, `PF` — form state: workflow steps, existing files, pending uploads
- `PED` — PDF editor state
- `PC` — pending doc count (badge)
- `_lastAct`, `_sesTmr` — session timeout (30 min inactivity)

### Role system (config.js)
Roles: `ROLE-SYS` (admin), `ROLE-SGN` (signer), `ROLE-REV` (reviewer), `ROLE-CRT` (creator), `ROLE-STF` (staff), `ROLE-ADV` (advisor).  
`CAN.cr/up/ed/sg/rv(role)` — permission helpers.  
Special case: `GNK-SEC` position gets secretary-level doc visibility (same as admin).

### Password hashing
Done **client-side** via Web Crypto API. Format: `pbkdf2$<saltHex>$<hashHex>` (SHA-256, 100k iterations). Legacy SHA-256 and plaintext are auto-upgraded on next login (`auth.js`).

### Email notifications (docDetail.js + Edge Function)
`sendNotifEmail(docId, action, newStatus, note)` builds the recipient list and HTML, then calls `SU/functions/v1/send-email` (Brevo). Triggered at:
- Document submitted → notifies first workflow step assignee (`docForm.js:287`)
- Step approved → notifies next step assignee
- Step rejected → notifies document creator
- All steps done → notifies all assignees + creator + final recipient

### Document lifecycle
`draft` → `pending` (submit) → workflow steps (approve/reject loop) → `completed` or back to `rejected`.  
Each approval can embed a signature image into the latest PDF via `pdf-lib` (loaded on demand from CDN).

### Audit log
All significant actions write to `document_history` table. `document_history` and `notifications` cannot be deleted from client code (guarded in `dd()`).

## Key constants (config.js)
- `DTYPES` — document type labels
- `URG` — urgency labels  
- `STTH` — status labels (Thai)
- `RTH` — role labels (Thai)
- `POSS` / `PTH` / `PR` — GNK positions, their Thai names, and default role mappings
- `DTYPE_CFG` — per-doc-type field visibility config (controls which fields render in the form)
