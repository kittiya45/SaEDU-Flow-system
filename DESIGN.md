---
name: SaEDU Flow
description: ระบบเสนอเอกสารอิเล็กทรอนิกส์ กนค. — the document lifecycle platform for Chulalongkorn's student committee.
colors:
  primary: "#E83A00"
  primary-deep: "#C03200"
  primary-light: "#fff5f0"
  primary-mid: "#ffc9a8"
  primary-pale: "#fff8f4"
  text-dark: "#18120E"
  text-secondary: "#6b6560"
  text-muted: "#a89e99"
  border: "#EBEBEB"
  surface-bg: "#F4F2EF"
  surface-card-head: "#FAFAF8"
  surface-white: "#FDFDFC"
  nav-dark: "#100800"
  status-ok: "#16A34A"
  status-ok-bg: "#F0FDF4"
  status-error: "#DC2626"
  status-error-bg: "#FEF2F2"
  status-warning: "#D97706"
  status-warning-bg: "#FFFBEB"
  status-info: "#2563EB"
  status-info-bg: "#EFF6FF"
typography:
  display:
    fontFamily: "'Noto Sans Thai', sans-serif"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: 1.35
    letterSpacing: "-0.4px"
  title:
    fontFamily: "'Noto Sans Thai', sans-serif"
    fontSize: "17px"
    fontWeight: 700
    lineHeight: 1.45
    letterSpacing: "normal"
  body:
    fontFamily: "'Noto Sans Thai', sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.7
    letterSpacing: "normal"
  label:
    fontFamily: "'Noto Sans Thai', sans-serif"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1.5
    letterSpacing: "normal"
  caption:
    fontFamily: "'Noto Sans Thai', sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.55
    letterSpacing: "normal"
  table-header:
    fontFamily: "'Noto Sans Thai', sans-serif"
    fontSize: "10px"
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: "0.7px"
  mono:
    fontFamily: "'IBM Plex Mono', monospace"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0.3px"
rounded:
  xs: "6px"
  sm: "8px"
  md: "10px"
  input: "11px"
  lg: "14px"
  xl: "20px"
  full: "9999px"
spacing:
  xs: "6px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "28px"
  2xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface-white}"
    rounded: "{rounded.md}"
    padding: "10px 18px"
  button-primary-hover:
    backgroundColor: "{colors.primary-deep}"
    textColor: "{colors.surface-white}"
    rounded: "{rounded.md}"
    padding: "10px 18px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.primary}"
    rounded: "{rounded.md}"
    padding: "10px 18px"
  button-soft:
    backgroundColor: "#F5F3F0"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.md}"
    padding: "10px 18px"
  button-soft-hover:
    backgroundColor: "#ECEAE6"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.md}"
    padding: "10px 18px"
  button-danger:
    backgroundColor: "{colors.status-error}"
    textColor: "{colors.surface-white}"
    rounded: "{rounded.md}"
    padding: "10px 18px"
  input:
    backgroundColor: "#FAFAF8"
    textColor: "{colors.text-dark}"
    rounded: "{rounded.input}"
    padding: "12px 14px"
  card:
    backgroundColor: "{colors.surface-white}"
    textColor: "{colors.text-dark}"
    rounded: "{rounded.lg}"
    padding: "18px"
---

# Design System: SaEDU Flow

## 1. Overview

**Creative North Star: "The Institutional Hearth"**

SaEDU Flow is an administrative system that must feel as trustworthy as an official stamp and as approachable as a senior student's advice. The visual system is built around a single sustained warmth: a near-black navigation bar of charred brown (#100800), warm off-white working surfaces (#F4F2EF), and one ember-orange accent (#E83A00) that appears exactly where the system needs the user's attention. The warmth is not cosmetic. It comes from the tinted neutrals: the background, the text, the shadows, the borders, all lean toward the orange-red hue at near-zero chroma. The room feels like a well-kept faculty office, not a startup dashboard.

This system explicitly rejects what PRODUCT.md names as anti-references: the dense grey tables of old Thai government portals, the English-defaulting neon-accent SaaS aesthetic, and anything that feels heavy or intimidating to a first-year student. It also rejects the opposite trap: a design so sanitised it reads as foreign, like a generic Western admin tool that happens to contain Thai text. Every spacing decision, line-height choice, and typography weight accounts for Thai letterforms first.

Color strategy is Restrained: tinted neutrals carry the surface, the ember accent appears on primary actions and current selections only. Depth is expressed through tonal layering (bg to card-head to white) reinforced by gentle diffuse shadows. Motion is state-feedback only: lift on hover, focus glow on inputs, no choreographed entrances.

**Key Characteristics:**
- Single-family typography (Noto Sans Thai) from nav labels to table headers, with IBM Plex Mono for document numbers and codes
- Warm off-white working surface (#F4F2EF) — never pure white, never cool grey
- Near-black charcoal sidebar (#100800) as the frame, ember accent as the guide
- Status vocabulary (ok/error/warning/info) with full bg/border/text triads for every state
- Line-height 1.7 minimum for all body Thai text; 1.55 minimum for compact UI text

## 2. Colors: The Ember Palette

A warm neutral field interrupted by one precise accent. The orange earns its authority by appearing nowhere except actions and current state.

### Primary
- **Chulalongkorn Ember** (#E83A00, oklch(57% 0.21 32)): The accent. Primary buttons, active tab underlines, focus rings, inline links, required-field markers. Never used decoratively. Its presence means "this is where you act."
- **Deep Ember** (#C03200, oklch(47% 0.19 30)): Hover and active states for primary buttons and icon accents. Slightly darker, slightly cooler. The ember compressed.
- **Ember Blush** (#fff5f0): Hover background for ghost buttons and active mobile nav items. The orange made nearly invisible; presence confirmed only by comparison.
- **Warm Copper** (#ffc9a8): Mid-range tint used on file-item hover borders and subtle accents. Bridging the ember to the white surface.
- **Morning Warmth** (#fff8f4): Hover background on tabs and nav items. The lightest visible trace of the primary.

### Neutral
- **Charred Brown** (#18120E, oklch(11% 0.015 40)): Primary text. Not black — a very dark warm brown. All headings, body, labels.
- **Weathered Stone** (#6b6560, oklch(46% 0.012 38)): Secondary text. Form labels, timestamps, supporting metadata.
- **Pale Stone** (#a89e99, oklch(66% 0.012 33)): Muted text, placeholder text, empty state messages, table header labels.
- **Linen Fold** (#EBEBEB): Default border color. Dividers between cards, table row separators, modal borders.
- **Faculty Paper** (#F4F2EF, oklch(95% 0.006 75)): App background. The surface everything sits on. Warmer than grey, cooler than cream.
- **Warm Canvas** (#FAFAF8): Card headers, table headers, modal footers. One step lighter than Faculty Paper; slightly warmer.
- **Document White** (#FFFFFF, used as #FDFDFC in tinted form): Card bodies, inputs at rest, modal backgrounds.
- **Midnight Carbon** (#100800, oklch(7% 0.01 35)): Sidebar and footer background. The darkest surface in the system.

### Status
Four semantic color families, each with three tokens (solid / background / border):

- **Registrar Green** (#16A34A / #F0FDF4 / #BBF7D0): Completed, approved, signed documents.
- **Rejection Red** (#DC2626 / #FEF2F2 / #FECACA): Rejected, error, destructive actions.
- **Deadline Amber** (#D97706 / #FFFBEB / #FDE68A): Pending, in-review, warning states.
- **Reference Blue** (#2563EB / #EFF6FF / #BFDBFE): Draft status, informational alerts, in-progress steps.

### Named Rules
**The One Ember Rule.** The primary #E83A00 appears on at most 10% of any given screen. A primary button, an active tab underline, a focus ring. Never as a background fill, decorative stripe, or illustration color. Its rarity makes it directional.

**The Tinted Neutral Rule.** No pure greys. Every neutral token leans toward the orange hue at chroma 0.005–0.015. If a new neutral is needed, sample from the existing warm scale; do not introduce a cool or blue-shifted grey.

## 3. Typography

**Body/UI Font:** Noto Sans Thai (with system-ui, sans-serif fallback)
**Label/Code Font:** IBM Plex Mono (for document numbers, codes, mono badges)

**Character:** A single Thai-native sans across every surface. No display font pairing, no serif headlines. The hierarchy is built entirely through weight and size contrast; the family stays constant. IBM Plex Mono appears only as a supporting voice for structured codes: document numbers, version strings, file sizes. It never appears in running prose.

### Hierarchy
- **Display** (700, 22px, line-height 1.35, tracking -0.4px): Page titles, modal titles. The largest text in the system. Appears once per screen.
- **Title** (700, 17px, line-height 1.45): Section headings within a page, card titles in standalone views.
- **Body** (400, 15px, line-height 1.7): All paragraph text, list content, form descriptions. Line-height 1.7 is non-negotiable for Thai body text; lower values cause Thai descenders to clip.
- **Label** (600, 13px, line-height 1.5): Form labels, table cell content, action labels in dropdowns, timeline entries. The workhorse weight.
- **Caption** (500, 12px, line-height 1.55): Timestamps, file sizes, secondary metadata, form hints. Pale Stone (#a89e99) as the default color.
- **Table Header** (700, 10px, line-height 1.4, tracking 0.7px, uppercase): Column labels only. Never used in running text. Pale Stone color; uppercase is a deliberate density signal for data tables, not a general pattern.
- **Mono** (IBM Plex Mono 400, 11px, tracking 0.3px): Document number codes, `.mono` badges. Background #F5F3F0 chip; never freestanding in text.

### Named Rules
**The Single Family Rule.** Noto Sans Thai is the only type family for UI text. Display pairings, serif headlines, and geometric display fonts are prohibited. Hierarchy is built through weight and size alone.

**The 1.7 Floor Rule.** Body and label text for Thai content must have line-height ≥ 1.7. This is not a preference; it is a legibility requirement for Thai letterforms with top diacritics. Compact components (table rows, badges, buttons) may use 1.4–1.55 where vertical space is explicitly constrained.

## 4. Elevation

This system uses **gentle ambient depth**: surfaces cast soft diffuse shadows at rest, suggesting a slight lift off the Faculty Paper background — like printed documents stacked on a desk. Shadows deepen on hover and reach their maximum on modals and floating panels. There is no flat-by-default aesthetic; every card has a resting shadow. The tonal hierarchy (bg → card-head → card-body → white) reinforces the depth signal.

### Shadow Vocabulary
- **Surface Rest** (`0 1px 3px rgba(0,0,0,.05), 0 8px 24px rgba(0,0,0,.07)`): Cards and content panels at rest. Diffuse, barely present; establishes that the card floats.
- **Hover Lift** (`0 4px 12px rgba(0,0,0,.08), 0 12px 32px rgba(0,0,0,.1)`): Card hover state. The same diffuse shape, slightly stronger and higher. Applied via `transform: translateY(-1px)` to reinforce the lift.
- **Ambient** (`0 1px 2px rgba(0,0,0,.04), 0 4px 16px rgba(0,0,0,.06)`): Lower-priority containers and inline panels.
- **Floating** (`0 8px 28px rgba(0,0,0,.13), 0 2px 8px rgba(0,0,0,.06)`): Dropdown menus and action menus. Structured (closer second shadow) to indicate a clearly floating layer.
- **Modal** (`0 24px 80px rgba(0,0,0,.25), 0 0 0 1px rgba(0,0,0,.06)`): Dialog overlays. The largest shadow in the system. The 1px outline ring at low opacity sharpens the edge.

### Named Rules
**The Ambient Floor Rule.** Cards always have a resting shadow. Flat cards are forbidden; they dissolve into the Faculty Paper background and lose their interactive affordance. The shadow is the affordance.

**The Deepening Stack Rule.** Shadow intensity increases strictly with layer elevation: bg (no shadow) < card rest < card hover < dropdown < modal. Never use a heavier shadow at a lower elevation.

## 5. Components

### Buttons
Tactile and weight-bearing. Every button variant is immediately legible as its role without color alone.

- **Shape:** Gently rounded corners (10px radius). Consistent across all variants and sizes. Never pill-shaped (`border-radius: 9999px`) except `.full` special cases.
- **Primary:** Ember background (#E83A00 → #FF5520 subtle gradient), white text, shadow `0 4px 14px rgba(232,58,0,.32)`. Hover: `translateY(-2px)` with deeper shadow. Active: `translateY(0)` with flattened shadow.
- **Ghost:** Transparent background, Ember text (#E83A00), 1.5px Ember border. Hover: Ember Blush fill (`#fff5f0`), slight lift. Sibling to Primary; used for secondary actions on the same surface.
- **Soft:** #F5F3F0 background, Weathered Stone text, #E8E4DE border. Neutral. Used for cancel, dismiss, or low-priority actions. Hover: #ECEAE6.
- **Danger:** Rejection Red (#DC2626) background, white text. Same shape and shadow pattern as Primary. Never appears alongside a Primary button without visual separation.
- **Warning:** Deadline Amber (#D97706), white text. Same pattern.
- **Success:** Registrar Green (#16A34A), white text. Same pattern.
- **Nav:** Semi-transparent white on dark surface (`rgba(255,255,255,.08)` bg, `rgba(255,255,255,.65)` text). Used only inside the Midnight Carbon sidebar.
- **Size modifiers:** `.sm` (12px text, 6px/12px padding, 8px radius), `.xs` (11px text, 4px/9px padding, 6px radius), `.btn-icon` (32px square, 8px radius, no text).

### Cards / Containers
- **Corner Style:** Gently curved (14px radius, `--r`).
- **Background:** Document White body; Warm Canvas (#FAFAF8) header band.
- **Shadow Strategy:** Surface Rest at all times. Deepens to Hover Lift on pointer entry.
- **Border:** 1px at `rgba(0,0,0,.055)` — barely visible, present only to sharpen the edge on Faculty Paper.
- **Card Head:** 14px/18px padding, bottom border at `rgba(0,0,0,.05)`, 13px/700 title in Charred Brown.
- **Card Body:** 18px padding.
- **Empty State:** 56px top/bottom padding, centered, Pale Stone text at 14px/500. Empty states teach rather than announce vacancy.

### Inputs / Fields
- **Style:** 1.5px #E8E4DE border, 11px radius, #FAFAF8 background. Slightly off-white at rest to confirm the field boundary against Document White card surfaces.
- **Focus:** Border shifts to Chulalongkorn Ember (#E83A00); background becomes white; 4px focus ring at `rgba(232,58,0,.1)`. Transition: 0.2s `cubic-bezier(.4,0,.2,1)`.
- **Placeholder:** Pale Stone (#C0BAB4 on inputs, #a89e99 for general muted).
- **Error Hint:** `.hint.er` — Rejection Red, 11px, appears below the field, no icon required (error context is already in the label or inline message).
- **Disabled:** `.btn:disabled` pattern — `opacity: 0.4`, `pointer-events: none`. Consistent across all interactive elements.

### Badges / Status Chips
- **Shape:** Pill (20px radius). 3px/10px padding. 11px/600.
- **Structure:** Leading 5px color dot (`.bdot`) + Thai label text. The dot ensures color is never the only status signal.
- **Variants:** draft (blue tint), pending (amber tint), signed/completed (green tint), rejected (red tint), gnk (primary-light/ember), advisor (violet tint), staff (teal tint), admin (grey tint).
- **Mono Codes:** `.mono` class renders document numbers and codes as 11px IBM Plex Mono in a #F5F3F0 chip, 6px radius. Functional, not decorative.

### Navigation
- **Sidebar (desktop):** Midnight Carbon (#100800) background, full height. Active items: Ember text (#E83A00) at 600 weight, Ember Blush left-band fill (full background, not a stripe). Default items: rgba(255,255,255,.65). Hover: rgba(255,255,255,1).
- **Mobile Bottom Nav:** rgba(255,255,255,.95) background with 12px blur backdrop-filter; 1px Faculty Paper border on top. Active item: Ember color only (no background fill). Label: 10px/600, tracked -0.1px.
- **Tabs (page-level):** 2px Faculty Paper bottom border; active tab: 2px Ember underline, Ember text, 700 weight. Hover: Morning Warmth background fill, Charred Brown text.

### Workflow Timeline (Signature Component)
The document approval timeline is the most distinctive visual element in the system. It conveys the full lifecycle at a glance.

- **Spine:** 2px line connecting dots. Done segments: Registrar Green. Waiting segments: Linen Fold border.
- **Dots:** 28px circles. Done: green tint bg, green text, 2px #C8E6C9 border. Active/pending: amber tint, amber text, 2px #FFE0B2 border. Waiting: #F5F5F5 bg, #bbb text, Linen Fold border. Rejected: red tint, 2px #FECACA border.
- **Typography:** Step title at 13px/600; sub-label and timestamps at 12px/Pale Stone. Notes in italic Pale Stone.
- **Do not collapse** the timeline into a progress bar. The step-by-step structure is load-bearing information for all three user roles.

### Action Dropdown Menu
- **Shape:** 12px radius, Document White background, #E8E4DE border.
- **Shadow:** Floating (`0 8px 28px rgba(0,0,0,.13)`).
- **Entry animation:** `opacity 0 → 1` with `translateY(-8px) scale(.97) → none`, 150ms `cubic-bezier(.4,0,.2,1)`. Origin: top right.
- **Items:** 13px/500, 10px/14px padding. Hover: #F5F3F0 fill. Danger items: Rejection Red text, red tint hover. OK items: green text, green tint hover.
- **Divider:** 1px Linen Fold, 4px top/bottom margin.

### Upload Zone (Drag & Drop)
- **Shape:** 2px dashed border, 16px radius, `min-height: 180px`. The dashed border signals "receptive area" without occupying visual weight at rest.
- **Background:** Warm Canvas (#FAFAF8). Never cool grey (`#fafafa`, `#f5f5f5`); those read as disconnected from the warm working field.
- **Border at rest:** Linen Fold (#EBEBEB, `var(--border)`). Dashed, 2px.
- **Hover:** Border shifts to Chulalongkorn Ember (#E83A00); background shifts to Morning Warmth (#fff8f4, `var(--orange-pale)`). Mirrors the hover vocabulary of file items and inputs.
- **Icon:** Stroke-weight icon at 48px, 25% opacity — present enough to indicate drag target, invisible enough not to compete with surrounding form content.
- **Text:** Upload instruction at 14px/500, Charred Brown. Hint line at 12px, Pale Stone (#a89e99). No additional icon in the text; the large zone icon carries the affordance alone.
- **Legacy notice:** The current `.upload-zone` CSS (as of June 2025) uses off-brand cool greys (`#e5e7eb`, `#fafafa`, `#9ca3af`). These are a legacy port from a generic component. Any new upload zone or file drop target must use the warm values above.

### Change Password Popup
- **Overlay:** Fixed, rgba(0,0,0,.6) with 6px backdrop blur — slightly heavier than the standard modal overlay (rgba 50%, 4px blur) to signal a security-critical action.
- **Container:** 22px radius, white body, max-width 400px. Entry animation: `slideUp` at 0.28s `cubic-bezier(.34,1.4,.64,1)` — same entrance as the auth card.
- **Header band:** Full-width gradient from near-black (#1c0a03) to Chulalongkorn Ember (#E83A00), 135deg. White title (16px/700) and sub-label (12px, rgba(255,255,255,.65)). This dark-to-ember gradient is one of only two contexts in the app where a gradient fill is intentional (the other is the auth card header). Both mark elevated-stakes surfaces.
- **Close control:** 28px square, 8px radius, rgba(255,255,255,.15) background, white icon. Matches nav-button vocabulary exactly.
- **Body:** 24px padding, standard `.fi` form fields with ember focus ring.

### Colored Stat Cards
- **Purpose:** High-level numeric summaries on the dashboard stats row only. A distinct visual register from the neutral card system: these communicate role at a glance, not at reading distance.
- **Shape:** 16px radius, white text throughout, `0 10px 25px rgba(0,0,0,.15)` shadow. No border.
- **Variants:** Four role-coded 135deg gradient pairs — completed/green (`#22c55e → #4ade80`), in-progress/blue (`#3b82f6 → #60a5fa`), attention/pink (`#ec4899 → #f472b6`), pending/amber-orange (`#f59e0b → #fb923c`).
- **Named Rule:** **The Stat Card Quarantine Rule.** These gradient cards are permitted exclusively on the dashboard stats row. They must not appear in document lists, admin panels, or any other context. Mixing them with the semantic status vocabulary (Registrar Green, Rejection Red, etc.) within a single view destroys the authority of the status system.

## 6. Do's and Don'ts

### Do:
- **Do** use Noto Sans Thai for all user-facing text, including buttons, labels, table headers, and form hints. Thai speakers are the primary audience; system-ui fallbacks are for render speed only.
- **Do** use the dark-to-ember gradient (`#1c0a03 → #E83A00`, 135deg) exclusively for the two elevated-stakes surfaces: the auth card header and the change-password popup header. This gradient signals exceptional system-level actions. Using it on ordinary feature cards devalues the signal.
- **Do** set body and label line-height to 1.7 minimum for any Thai text in running prose or multi-line UI labels.
- **Do** pair every status color with a non-color signal: the `.bdot` dot in badges, an icon in alerts, a text label in timeline dots. Never rely on hue alone to convey document state.
- **Do** use the tonal layering (Faculty Paper bg → Warm Canvas header → Document White body) as the primary depth signal before adding shadows.
- **Do** keep #E83A00 to ≤10% of any screen surface. Its authority is proportional to its rarity.
- **Do** use `cubic-bezier(.4,0,.2,1)` for all state transitions. Duration 150–220ms for micro-interactions, 200–280ms for panel entrances.
- **Do** write all user-facing copy in Thai. Never mix English labels into Thai UI except for proper nouns (system name, role codes like ROLE-SYS).
- **Do** give every empty state a Thai instructional sentence: what the empty list means and what the user should do next.

### Don't:
- **Don't** use border-left or border-right greater than 1px as a colored accent stripe on cards, list items, callouts, or alerts. This is the most common replication error from generic UI kits. Rewrite with background tints, full borders, or leading icons.
- **Don't** use gradient text (`background-clip: text` with a gradient fill) in any new component. The auth header currently uses this pattern on `.auth-title`; it is a legacy exception and must not be replicated elsewhere. All emphasis is through weight or size.
- **Don't** introduce cool-shifted or blue-tinted neutrals. Every new grey must be sampled from the warm neutral scale (chroma ≥ 0.005 toward hue 30–75). A cool surface will read as visually disconnected from the rest of the system.
- **Don't** use backdrop-filter blur decoratively. It appears on the modal overlay (functional: dims the background) and mobile nav (functional: readability over page content). Not on cards, panels, or tooltips.
- **Don't** build layouts that feel like old Thai government systems: dense tables with Times New Roman, no visual hierarchy, สีเข้ม-on-สีขาว tables without row hover states or adequate padding. Every table row gets hover treatment; every header gets proper tracking and uppercase.
- **Don't** default to English-first SaaS patterns: neon accents, gradient hero metrics, startup-speak copy, or identical icon-heading-text card grids. If a new feature looks like it belongs on a Vercel pricing page, reconsider the structure.
- **Don't** use the hero-metric template (big number, small label, gradient accent) on any dashboard stat. Stats are rendered with supporting context and semantic color triads, not as decorative numbers.
- **Don't** reduce Midnight Carbon (#100800) to plain black (#000 or #111). The warmth of the nav must match the warmth of the working surface. A pure-black sidebar against a warm-off-white page creates visual dissonance.
- **Don't** use cool grey for drag-and-drop upload zones or file drop targets. The current `.upload-zone` CSS uses `#fafafa`, `#e5e7eb`, and `#9ca3af` — all cool-shifted legacy errors. Any new upload zone must use `#FAFAF8` (Warm Canvas) at rest and `#fff8f4` (Morning Warmth) on hover.
- **Don't** extend the colored stat card pattern (`.card-soft` with `.green`, `.blue`, `.pink`, `.orange` gradient variants) outside the dashboard stats row. These cards are a purposeful exception with a fixed scope. Placing them in admin panels, document lists, or anywhere else corrupts the semantic status vocabulary that the rest of the system depends on.
