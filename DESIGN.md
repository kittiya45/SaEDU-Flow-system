---
name: SAEDU Flow
description: ระบบเสนอเอกสารอิเล็กทรอนิกส์ กนค. คณะครุศาสตร์ จุฬาฯ — paperwork that breathes
colors:
  primary: "#E83A00"
  primary-deep: "#C03200"
  primary-light: "#FFF5F0"
  primary-mid: "#FFC9A8"
  primary-pale: "#FFF8F4"
  ink: "#18120E"
  ink-2: "#6B6560"
  ink-3: "#A89E99"
  app-bg: "#F4F2EF"
  surface: "#FFFFFF"
  surface-sunk: "#FAFAF8"
  border: "#EBEBEB"
  border-field: "#E8E4DE"
  nav: "#100800"
  success: "#16A34A"
  success-bg: "#F0FDF4"
  warning: "#D97706"
  warning-bg: "#FFFBEB"
  error: "#DC2626"
  error-bg: "#FEF2F2"
  info: "#2563EB"
  info-bg: "#EFF6FF"
  role-advisor: "#7C3AED"
  role-staff: "#0F766E"
typography:
  headline:
    fontFamily: "Noto Sans Thai, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: "-0.4px"
  title:
    fontFamily: "Noto Sans Thai, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 700
    lineHeight: 1.5
    letterSpacing: "normal"
  body:
    fontFamily: "Noto Sans Thai, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.7
    letterSpacing: "normal"
  label:
    fontFamily: "Noto Sans Thai, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.5
    letterSpacing: "0.2px"
  mono:
    fontFamily: "IBM Plex Mono, Courier New, monospace"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: 1.5
    letterSpacing: "0.3px"
rounded:
  field: "11px"
  button: "10px"
  card: "14px"
  pill: "20px"
spacing:
  xs: "6px"
  sm: "9px"
  md: "16px"
  lg: "18px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    rounded: "{rounded.button}"
    padding: "10px 18px"
  button-primary-hover:
    backgroundColor: "{colors.primary-deep}"
    textColor: "{colors.surface}"
    rounded: "{rounded.button}"
    padding: "10px 18px"
  button-soft:
    backgroundColor: "#F5F3F0"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.button}"
    padding: "10px 18px"
  input:
    backgroundColor: "{colors.surface-sunk}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    padding: "12px 14px"
  input-focus:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    padding: "12px 14px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "18px"
  badge:
    textColor: "{colors.ink-2}"
    rounded: "{rounded.pill}"
    padding: "3px 10px"
  choice-card:
    backgroundColor: "{colors.surface-sunk}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "15px 16px"
  choice-card-selected:
    backgroundColor: "{colors.primary-pale}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "15px 16px"
---

# Design System: SAEDU Flow

## 1. Overview

**Creative North Star: "Paperwork That Breathes"**

SAEDU Flow takes a paper bureaucracy (เอกสารขาเข้า/ขาออก, multi-step sign-off, official numbering with semester, position, letter-type, and club codes) and lets it exhale. The structure stays exact, because the structure is the point: step order, required roles, the digits of a document number all carry real meaning. What changes is the air around it. Generous line-height, deliberate grouping, and quiet surfaces turn a dense procedure into something a student who has never seen the paper process can read at a glance.

The system commits to one bold gesture and keeps everything else calm. A single warm orange (#E83A00) carries primary action and live state; it is the only saturated voice on the screen. Surfaces are warm-tinted whites, never clinical, never the cool gray of a government intranet. Type does the heavy lifting through weight and scale, not through color or chrome. Depth is whispered through one soft shadow, not stacked or dramatized. The interface should feel like care was put into the small things without performing modernity.

This system explicitly rejects the generic Thai government or university intranet: dense unstyled tables, gray-on-gray, cramped rows with no breathing room, status conveyed by text label alone. It also rejects the opposite overcorrection, a SaaS dashboard drowning in gradients, glass panels, and hero metrics. Formality with room to breathe, not flatness and not flash.

**Key Characteristics:**
- One saturated accent (orange), used on roughly 10% of any screen; the rest is warm neutral.
- Thai readability as a structural constraint: line-height 1.7 on body, never tighter.
- Real bureaucratic structure made visually legible: numbered steps, role color-coding, monospace document numbers.
- Quiet, flat-leaning surfaces; a single soft shadow lifts cards just off the page.
- IBM Plex Mono reserved for the things that are literally codes (document numbers, student IDs).

## 2. Colors

A warm-neutral world with one orange voice and a disciplined set of semantic states.

### Primary
- **กนค. Orange** (#E83A00): The single saturated voice. Primary buttons, the active/current step, focus rings, selected states, required-field markers, links, the avatar circle on the creator step. Never decorative; always means "act here" or "this is live."
- **Deep Ember** (#C03200): The pressed and hovered state of the orange. Also the weight used for monospace document numbers on light chips, where pure orange would vibrate.
- **Orange Pale / Light / Mid** (#FFF8F4 / #FFF5F0 / #FFC9A8): The tint family. Pale and light fill selected cards, icon chips, and tab hovers; mid is the hairline that appears on a choice card hover before full selection.

### Neutral
- **Ink** (#18120E): Primary text. A warm near-black, never pure #000.
- **Muted Ink** (#6B6560): Secondary text, field labels, soft-button text.
- **Faint Ink** (#A89E99): Tertiary text, hints, placeholders, breadcrumb captions, table row numbers.
- **Paper** (#F4F2EF): The application background. Warm, slightly toasted, the color of aged document paper.
- **Surface** (#FFFFFF) and **Sunk Surface** (#FAFAF8): Cards sit on white; inputs and card headers recede to the faint warm gray so fields read as wells, not raised tiles.
- **Border** (#EBEBEB) and **Field Border** (#E8E4DE): Hairlines. The field border is fractionally warmer and is always 1.5px, the divider border is 1px.
- **Nav Black** (#100800): The navigation chrome, a warm black distinct from ink.

### Tertiary (semantic state + role)
- **Success** (#16A34A on #F0FDF4): Completed steps, approved status, on-track deadlines.
- **Warning** (#D97706 on #FFFBEB): Pending, near-deadline, the active-but-waiting state.
- **Error** (#DC2626 on #FEF2F2): Rejected, overdue, destructive actions.
- **Info** (#2563EB on #EFF6FF): Draft status and instructional callouts (the blue "เลือกผู้ที่ต้องอนุมัติ" hint).
- **Advisor Violet** (#7C3AED) and **Staff Teal** (#0F766E): Role identity on badges only, so อาจารย์ที่ปรึกษา and เจ้าหน้าที่ are distinguishable at a glance without reading the label.

### Named Rules
**The One Voice Rule.** Orange appears on no more than about 10% of any screen and only where it means action or live state. A second saturated color never competes with it; role and status colors live exclusively inside badges and small status dots, never as fills on large surfaces.

**The No Cool Gray Rule.** Every neutral is tinted warm toward the paper hue. Tailwind's `gray-*` / `slate-*` families are forbidden; reach for the ink and surface tokens. A cool gray next to #F4F2EF reads as a bug.

## 3. Typography

**Body Font:** Noto Sans Thai (with system-ui, sans-serif)
**Label / Mono Font:** IBM Plex Mono (with Courier New, monospace)
**Institutional Display:** Chulalongkorn (loaded, held in reserve for the official wordmark; not used in running UI)

**Character:** One humanist Thai sans does everything from headings to labels; there is no display/body pairing, because product UI does not need one. Personality comes from weight and scale, not from a second face. The only deliberate face change is IBM Plex Mono, and only for content that is literally a code.

### Hierarchy
- **Headline** (700, 22px, line-height 1.4, -0.4px): Page titles. The largest type on a screen, used sparingly.
- **Title** (700, 17px, line-height 1.5): Section and modal titles.
- **Card Head** (700, 13px): The label on a card header beside its icon chip. Small and quiet on purpose; the header announces the card without shouting.
- **Body** (400, 15px, line-height 1.7): All running text and field values. Cap prose at 65 to 75ch.
- **Label** (600, 12px, 0.2px): Form field labels. Slightly tracked, muted ink.
- **Badge / Caption** (600, 11px): Status pills, file metadata, hints.

### Named Rules
**The Breathing Room Rule.** Body line-height never drops below 1.7. Thai vowels and tone marks stack vertically; cramp them and the UI looks broken, not dense. This is non-negotiable and overrides any desire to fit more rows.

**The Mono-Means-Code Rule.** IBM Plex Mono is reserved for document numbers, student IDs, and number-format previews. It signals "this is a machine identifier." Never use it for prose, labels, or decoration.

## 4. Elevation

The system is quiet and flat-leaning. Depth exists, but it is a whisper: a single soft, wide, low-opacity shadow lifts a card just barely off the warm paper background, the way a real sheet of paper sits on a desk. There is no second elevation layer, no dramatic drop shadow, no stacked shadows. Hierarchy comes from the surface-tone shift (white cards on #F4F2EF paper, sunk #FAFAF8 wells inside them), not from height.

### Shadow Vocabulary
- **Card rest** (`box-shadow: 0 1px 3px rgba(0,0,0,.05), 0 8px 24px rgba(0,0,0,.07)`): The default lift for cards. Soft and diffuse, barely there.
- **Hover lift** (`box-shadow: 0 4px 12px rgba(0,0,0,.08), 0 12px 32px rgba(0,0,0,.1)`): Reserved for genuinely interactive cards on hover. Most cards never use it.
- **Focus ring** (`box-shadow: 0 0 0 4px rgba(232,58,0,.1)`): The orange halo on a focused input. This is the one place a shadow carries the accent color, and it means focus, nothing else.
- **Primary button** (`box-shadow: 0 4px 14px rgba(232,58,0,.32)`): A warm orange glow under the single bold element. The exception that proves the flat rule.

### Named Rules
**The Flat-By-Default Rule.** Surfaces are flat at rest except for the one soft card shadow. New shadows are not a styling tool; if something needs to stand out, raise its surface tone or its type weight first. Stacking shadows or deepening opacity to "pop" an element is forbidden.

**The One Bold Layer Rule.** The orange primary button is the only element allowed to feel tactile (gradient fill plus colored glow). Everything else stays quiet. Do not promote a second element to that level of attention on the same screen.

## 5. Components

### Buttons
- **Shape:** Gently rounded (10px), comfortable padding (10px 18px), 600 weight, icon and label sharing a 6px gap.
- **Primary:** A warm orange gradient (#E83A00 to #FF5520) with white text and a soft orange glow (0 4px 14px rgba(232,58,0,.32)). The one tactile, confident element on any screen. On hover it deepens (#C03200 to #E83A00); the glow stays.
- **Soft (secondary):** #F5F3F0 fill, muted-ink text, 1.5px #E8E4DE border. The default for "back," "save draft," and other non-committal actions. Flat, no glow.
- **Danger / Success / Warn:** Solid semantic fills with a matching faint glow, used only for the action they name (delete, approve, overdue).
- **Sizes:** `sm` (6px 12px, 12px, radius 8px) and `xs` (4px 9px, 11px, radius 6px) for in-row and in-table actions.

### Inputs / Fields
- **Style:** Sunk well, not raised tile. #FAFAF8 background, 1.5px #E8E4DE border, 11px radius, 12px by 14px padding. Placeholder in faint warm gray (#C0BAB4).
- **Focus:** Background lifts to white, border turns orange, and a 4px orange halo (rgba(232,58,0,.1)) blooms. The transition is 0.2s. This is the clearest single signal in the system that an element is live.
- **Select:** Custom warm chevron, never the native arrow.

### Cards / Containers
- **Corner Style:** 14px radius.
- **Background:** White surface; the header recedes to #FAFAF8 with a 1px bottom hairline and carries a small orange-tinted icon chip (26px, 7px radius) plus a 13px/700 title.
- **Shadow Strategy:** Card-rest shadow only (see Elevation). No hover lift unless the whole card is a control.
- **Border:** 1px rgba(0,0,0,.055), barely visible, just enough to define the edge against white-on-white.
- **Internal Padding:** 18px body, 18px by 20px header. Nested cards are forbidden.

### Badges (status, type, role)
- **Style:** Pill (20px radius), 11px/600, 3px by 10px padding, optional 5px leading dot in the current color.
- **State:** Tonal pairs, soft tinted background with a darker text of the same hue: draft (blue), pending (amber), signed/completed (green), rejected (red). Role badges use the role hue (gnk orange, advisor violet, staff teal).

### Navigation (tabs)
- **Style:** Underline tabs over a 2px border track. Default in faint ink; hover tints the label and floods a pale orange background; active turns the label orange (700) and the underline orange. No pills, no boxes.

### Document Type Chooser (signature component)
The entry gate to creating a document. Instead of a dropdown, document types render as selectable cards in an auto-fit grid (min 220px). Each card carries a 38px icon chip, a 14px/700 Thai title, and a one-line description of what the type does. At rest the card is a sunk #FAFAF8 well with a faint border and a gray icon chip. On hover the border warms to #FFC9A8, the surface lifts to white, and the icon chip tints orange. On selection the border goes solid orange, the surface fills #FFF8F4, a 3px orange halo appears, the icon chip becomes solid orange with a white glyph, and a check mark fills the trailing radio dot. This makes the most consequential choice on the form legible and tactile without a single line of dropdown.

## 6. Do's and Don'ts

### Do:
- **Do** keep orange to roughly 10% of any screen, reserved for action and live state. Let warm neutrals carry the rest.
- **Do** tint every neutral warm toward the #F4F2EF paper hue. Use the ink and surface tokens.
- **Do** hold body line-height at 1.7 or higher. Thai readability is load-bearing, not cosmetic.
- **Do** make bureaucratic structure visible: number the workflow steps, color-code status, group the people picker by ตำแหน่ง when most rows share a role.
- **Do** keep surfaces flat at rest with the single soft card shadow; convey depth through surface tone (white card, #FAFAF8 well).
- **Do** set document numbers, student IDs, and number previews in IBM Plex Mono.
- **Do** let exactly one element (the orange primary button) feel tactile per screen.

### Don't:
- **Don't** look like a generic Thai government or university intranet: no dense unstyled tables, no gray-on-gray, no cramped rows, no status conveyed by text label alone.
- **Don't** use a colored `border-left` or `border-right` greater than 1px as a stripe accent on cards, list items, or callouts. Use a full border, a background tint, or a leading icon instead.
- **Don't** use gradient text (`background-clip: text`). Emphasize with weight and scale.
- **Don't** reach for glassmorphism, hero-metric blocks, or identical icon-heading-text card grids; they are SaaS clichés this product rejects.
- **Don't** introduce Tailwind `gray-*` or `slate-*` classes; they read cool and broken next to the warm neutrals.
- **Don't** stack shadows or deepen shadow opacity to make something pop. Raise its surface tone or type weight first.
- **Don't** promote a second element to the orange button's level of boldness on the same screen.
- **Don't** drop a Tailwind class built from a variable (e.g. `` `bg-${x}` ``); the v4 build scanner only sees complete literal strings.
