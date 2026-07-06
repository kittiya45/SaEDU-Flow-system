---
name: verify
description: Runtime-verify frontend changes in this repo by serving the static site and driving it with Playwright, stubbing the Supabase data layer in-page (no real login needed).
---

# Verify (SaEDU Flow)

The app is a vanilla-JS SPA against a real Supabase backend — you can't log in from a verification session. But everything is global scope, so stub the data layer **in the page** and drive the real UI.

## Recipe that works

1. `npm run build` (styles.tailwind.css is gitignored, must exist), then `python3 -m http.server <port>` from repo root.
2. Playwright is already in `node_modules` — from a script outside the repo, `require('/Users/.../SaEDU-Flow-system/node_modules/playwright')` (CJS resolves from the script's path, not cwd).
3. Make the run hermetic with `page.route` fulfills:
   - `**://cdn.jsdelivr.net/**` → stub `window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),signOut:async()=>({})},rpc:async()=>({data:null,error:null})})}` (boot.js needs getSession; auth.js subscribes onAuthStateChange).
   - `**://unpkg.com/**` → `window.lucide={createIcons(){}}` (icons won't paint — cosmetic only).
   - `**://*.supabase.co/**` → `[]`; fonts → empty/abort.
4. After `goto` + networkidle, in `page.evaluate`: override `window.dg` (return fake `user_directory` rows, `[]` otherwise), `dp`/`dpa` (capture into `window._INSERTS`/`_PATCHES`, return `[{id:'new-N'}]`), `sendNotifEmail=async()=>{}`, `loadAppSettings=async()=>{}`; set `window.CU` to a fake profile. Then `nav('new')` (or any view).
5. Drive real UI: `click('[data-dtype="incoming"]')`, `selectOption('#fdsc', ...)`, `fill('#ftit', ...)` (title id is `ftit`, not `ftitle`), `click('[data-action="saveSend"]')`. Inspect `FS`, `window._INSERTS`, `#fal` text.

## Gotchas

- `page.screenshot({fullPage:true})` only captures the viewport — the scroll container is an inner div, not body. Screenshot the element instead: `page.locator('#wf-card').screenshot(...)` with a tall viewport.
- `user_directory` fake rows need `id, full_name, role_code, position_code` at minimum for form pickers.
- Validation errors render into `#fal` (inline), success paths may `nav('det', id)` after ~900ms — read `#fal` before that fires.
- Bump `?v=N` in index.html for changed JS or the served page may pull a cached copy in a headed browser (headless fresh profile is fine).

## Flows worth driving

- Create-doc form: doc-type cards → type-specific fields → workflow card (`FS` global) → saveSend → captured `workflow_steps`/`documents` inserts.
- Fixed workflow flows: incoming + letter type in `BUDGET_LTYPES` → 7 locked steps; other letter types → 4; ROLE-STF/ROLE-SYS CU → free-form (no locked steps, `#wfadd-row` visible).
- Notifications: call `sendNotifEmail(docId, action, status, note)` directly in `page.evaluate` with `dg` stubbed for documents/workflow_steps/user_directory/email_templates, and wrap `window.fetch` to capture bodies sent to `/functions/v1/send-line` / `send-email` — lets you assert the exact LINE Flex/email payloads without any backend. A captured Flex bubble can be visually previewed by mapping its box/text/button JSON to flexbox HTML in a second page and screenshotting.
