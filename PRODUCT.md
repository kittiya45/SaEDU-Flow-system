# Product

## Register

product

## Users

Two groups, both Thai-speaking:
- นิสิตคณะกรรมการนิสิต (กนค.) — student committee/club officers (ผู้จัดทำ, ผู้ลงนาม, ผู้ตรวจทาน, club presidents/VPs/secretaries/treasurers) who submit and approve incoming/outgoing official documents as part of running their committee and clubs.
- เจ้าหน้าที่/อาจารย์ที่ปรึกษา (ROLE-STF/ROLE-ADV) — staff and advisors who review documents, manage users, configure system settings, and oversee the document-numbering process.

Job to be done: move a paper-bureaucracy workflow (เอกสารขาเข้า/ขาออก, multi-step sign-off, official document numbering with semester/position/letter-type/club codes) into a system both groups can use without a procedures manual.

## Product Purpose

Digitizes the กนค. document approval pipeline end to end: draft → submit → multi-step approve/reject → official numbering → completed/forwarded. Success looks like a student who's never seen the paper process being able to submit a request and track it, and a signer being able to tell at a glance what's waiting on them and why.

## Brand Personality

ทันสมัย, มีรายละเอียดสวยงาม — modern and detail-considered, not flashy. The interface should feel like care was put into the small things (spacing, grouping, status clarity) without performing modernity for its own sake.

## Anti-references

Looking like a generic Thai government/university intranet system: dense unstyled tables, no visual hierarchy, gray-on-gray, cramped rows with no breathing room, status conveyed only through text labels. No specific external reference site to chase — the existing in-app language (warm orange `#E83A00` primary, warm-neutral palette, card-based panels, badge/status system) is already the right direction; extend it rather than importing a different aesthetic.

## Design Principles

- **Bureaucratic precision, not bureaucratic dullness.** The system encodes real formal structure (step order, required roles, document number digits) — make that structure visually legible (grouping, numbering, color-coded status) instead of flattening it into plain rows.
- **Every list item should read at a glance.** When most rows share the same role/category (e.g. most workflow participants are ROLE-CRT), surface the more specific, more useful distinction (their actual ตำแหน่ง) rather than the generic one everyone shares.
- **Thai readability is load-bearing, not cosmetic.** Line-height ≥ 1.7, no cramped Thai text — vowels and tone marks need vertical room or the UI looks broken, not just tight.
- **Extend the existing system, don't reskin it.** New components should reuse established tokens (`#E83A00`, warm-neutral grays, existing `.btn`/`.badge`/`.al` classes, the avatar-circle-number pattern) rather than introducing a parallel style.

## Accessibility & Inclusion

No special accommodations beyond standard practice — keep adequate contrast, touch-target sizing, and the existing Thai-readability line-height convention.
