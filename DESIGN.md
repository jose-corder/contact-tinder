# Contacts. — design and product spec

Read this fully before writing code. Shared contracts live in src/domain/types.ts, src/domain/taxonomy.ts, src/db/repo.ts and src/ui/index.tsx. Do not duplicate them.

## Context

The user wants a mobile web app that takes an exported address book and lets them triage it one contact at a time with Tinder-style swipes. Each contact ends up as **Delete**, **Work** or **Personal**. Work contacts get a status (**Old / Current / Potential**) and a type (**Client / Vendor / Relationship / Name-drop flex**). Personal contacts get a type (**Friend / Family / Ex / Acquaintance / Neighbor / Service provider**). Any card can also carry free-text custom tags.

Decisions already made with the user:
- **On-device only.** Installable PWA, contacts parsed and stored in IndexedDB, nothing uploaded. Output is exported vCard / CSV files.
- **Multi-pass decks.** Every swipe is a 3-way choice plus a down-swipe to skip. Sub-types are tap-chips on the card.
- **Stack:** Vite + React + TypeScript, Tailwind, Framer Motion, Dexie, vite-plugin-pwa.
- **Taxonomy v1:** core lists above + Personal extras (Acquaintance, Neighbor, Service provider) + custom tags. No extra Work types, no cross-cutting flags.

Hard constraint to surface in the UI: browsers cannot modify the phone's address book. "Delete" produces a list / vCard the user acts on in iOS or Google Contacts, or the user imports the cleaned vCard back after wiping the originals.

## Product design

### Flow

```
Home ─► Import ─► Pass 1 Triage ─► Pass 2 Work deck ─► Pass 3 Personal deck ─► Review ─► Export
```

| Pass | Deck contents | ← left | → right | ↑ up | ↓ down | Chips |
|---|---|---|---|---|---|---|
| 1 Triage | all undecided | Delete | Work | Personal | Skip (to end) | custom tags |
| 2 Work | bucket = work, no status | Old | Current | Potential | Skip | Client, Vendor, Relationship, Name-drop flex (multi), custom |
| 3 Personal | bucket = personal, no type | Ex | Friend | Family | Skip | Acquaintance, Neighbor, Service provider (multi), custom |

- Swipe threshold ~ 35% of card width or velocity > 500 px/s. Card tilts and a colored label fades in per direction (red Delete, blue Work, green Personal, grey Skip).
- Chips are tapped **before** swiping and travel with the card. Tapping a chip never advances the card.
- **Undo** button (and `Z` key) reverses the last decision; a stack of last 20.
- Bottom action bar mirrors the four directions with buttons for one-handed or desktop use. Keyboard: arrows, `Z` undo, `1-9` toggle chips.
- Progress bar "142 / 913" with bucket counts. Deck ends with a summary and a CTA into the next pass.
- Skipped cards return at the end of the same deck; a second skip leaves them "unsorted" for Review.
- **Follow-up sheet (added after user testing).** In triage, swiping Work or Personal opens a bottom sheet for that contact with the status/relation chips and type chips, plus custom tags. Done saves and the contact skips the later deck; Later leaves it for pass 2/3. A link in the sheet and a toggle in Settings turn it off.

### Card

Photo or initials avatar, display name, organization and title, up to 2 phones and 2 emails, notes excerpt, source (iPhone / Google), "last modified" if the vCard has REV. Tap the card to flip and see all fields. Long-press copies the number.

### Review screen

Tabs: Delete / Work / Personal / Unsorted. Inside Work: segmented control Old / Current / Potential and type filters. Search by name, org, phone, email. Each row has a quick re-bucket menu. Bulk select for move or export. "Re-swipe this list" sends a filtered set back into a deck.

### Export

- One `.vcf` per bucket or per status/type (e.g. `work-current-clients.vcf`). Original vCard bytes are preserved and a `CATEGORIES:` line is added so the labels survive the round trip into iOS or Google Contacts.
- One `.csv` with every contact and every label.
- `delete-list.txt` with names and numbers.
- Full JSON backup / restore of the local database.
- Uses the Web Share API when available, falls back to download.

### Import

- File picker accepting `.vcf` (iCloud, Google, Outlook exports; multi-contact files) and `.csv` (Google Contacts and Outlook CSV layouts).
- Contact Picker API (`navigator.contacts.select`) as a progressive extra on Android Chrome; hidden when unsupported.
- Dedupe on import by normalized phone or email; merged duplicates keep all numbers.
- Re-import of the same file is idempotent (stable id = hash of UID or of name + first phone).
- First-run panel explains how to export from iPhone (iCloud.com, or Settings › Contacts › Export) and from Google Contacts.

## Look and feel

Direction chosen with the user: **editorial, monochrome, premium**. Black ink on cream, serif names, hairline rules. Color appears only in the swipe stamps and selected chips. Motion is Tinder-level: tilt, fling, stacked next card, haptic tick, short end-of-deck moment. It should feel like a private CRM for a network worth curating, not a game.

### Typography

| Role | Face | Notes |
|---|---|---|
| Names, deck titles, numbers | **Fraunces** (variable, optical size on) | letter-spaced small caps for the deck title, large tight display for the name |
| Body, labels, chips, buttons | **Inter** (variable) | tabular numerals for the progress counter |
| Stamps | Fraunces 900 italic, uppercase | tilted -12°, hairline double border like a rubber stamp |

Fonts self-hosted in `public/fonts` (woff2, subset latin) so the PWA works offline. No icon font; a dozen inline SVG strokes at 1.5 px.

Scale: name 34/38 px, role 15 px, details 15 px, meta 12 px uppercase tracked, chips 13 px, deck title 11 px tracked 0.18 em.

### Color tokens

```
--paper        #F4EFE6   page background (light)
--paper-2      #EDE7DB   card surface, sheets
--ink          #141311   primary text, buttons
--ink-2        #5B5750   secondary text
--rule         #D8D1C3   hairlines, dividers
--stamp-delete #8E2B2B   oxblood
--stamp-work   #1F3A5F   navy
--stamp-personal #2F5D3A forest
--stamp-skip   #7A766E   stone
--status-old / current / potential → stone / navy / amber #9A6B1F
```

Dark mode follows `prefers-color-scheme` and a manual toggle: paper becomes `#121110`, paper-2 `#1B1917`, ink `#F1ECE2`, rule `#2C2A26`, stamp colors lifted one step. Same layout, no separate styling.

### Layout and components

- **Frame.** Max width 440 px centered on desktop, full-bleed on phone, 20 px side gutter, safe-area insets respected. Top bar: deck title left in tracked small caps, counter right in tabular figures, hairline under. Thin 2 px progress hairline that fills in ink.
- **Card.** Paper-2 surface, 1 px rule border, 20 px radius, soft shadow `0 20px 60px -30px rgba(20,19,17,.35)`. Content stack, top to bottom: avatar (72 px circle, photo or two initials in Fraunces), name, role and org line, hairline, phones and emails in a two-column label/value grid, hairline, meta row (source, added year, "last edited"). Tap flips the card to a plain field list for everything else. Height fills the space between top bar and chip row; text truncates with ellipsis rather than overflowing.
- **Next card** sits behind at 0.94 scale and 0.6 opacity, scales to 1 as the top card leaves. Third card not rendered.
- **Stamps.** One per direction, positioned in the corner the thumb drags toward (left-top for left, right-top for right, top-center for up, bottom-center for down). Opacity tied to drag distance, fully visible at the commit threshold. On commit the stamp holds 120 ms while the card flings.
- **Chip row** under the card: wrapping pills, 36 px tall, 1 px rule border, label in Inter 13 px. Selected pill fills with the deck's stamp color and inverts text. Last pill is `+ tag`, which opens an inline input with autocomplete from previous custom tags. Chips animate 150 ms. On pass 1 the row shows only `+ tag`.
- **Action bar.** Four round 56 px buttons with hairline borders and inline SVG glyphs: ✕ left, ↓ skip, ↑ up, ✓ right. Undo is a smaller 40 px text button "undo" to the far left, visible only when the stack is non-empty. Pressing a button animates the card the same way a swipe does.
- **Deck end.** Card area empties, a serif headline "Triage done." with three counts in a hairline table and a single ink button into the next pass. One restrained animation: counts tick up over 600 ms. No confetti.
- **Review.** Same frame. Top segmented control as underlined text tabs. Rows are 64 px: initials, name in Fraunces 17 px, org in Inter 13 px ink-2, right side shows a small stamp-colored dot per label. Swipe a row left for the re-bucket menu, long-press to multi-select. Search is a hairline input that sticks under the tabs.
- **Import and Export.** Centered copy in Fraunces, instructions as a numbered hairline list, one ink primary button, drop zone is a dashed-rule rectangle. Export shows the file list as a receipt-style table with a download glyph per row.
- **Home.** Wordmark "Contacts." in Fraunces, a one-line resume card if a session exists ("Triage · 142 of 913 · continue"), otherwise the Import button. Settings behind a text link: dark mode, haptics, reset data, backup.

### Motion spec

| Moment | Behavior |
|---|---|
| Drag | card follows thumb; rotate = x / 20 deg clamped ±15; stamp opacity = distance / threshold |
| Commit | fling along drag vector at ≥ 1200 px/s, 320 ms, ease-out; haptic 10 ms; next card springs to scale 1 (stiffness 300, damping 30) |
| Cancel | spring back (stiffness 500, damping 35) |
| Undo | previous card slides back in from the direction it left, 260 ms |
| Chip toggle | 150 ms fill, no bounce |
| Reduced motion | `prefers-reduced-motion`: no tilt, 120 ms fades, haptics off |


## Data model

The authoritative types are in `src/domain/types.ts`. Summary:

- `Contact`: id (stable hash), displayName, givenName, familyName, org, title, phones[] ({value, e164?, type?}), emails[] ({value, type?}), photo? (Blob), notes?, rev?, raw (original vCard text, kept verbatim), source ('vcf' | 'csv' | 'picker' | 'demo'), importedAt, phoneKeys[] and emailKeys[] (normalized dedupe keys, indexed).
- `Decision` (one per contact, keyed by contactId): bucket? ('delete' | 'work' | 'personal'), workStatus? ('old' | 'current' | 'potential', set by the Work deck swipe), workTypes[] ('client' | 'vendor' | 'relationship' | 'namedrop', set by Work deck chips), relation? ('friend' | 'family' | 'ex', set by the Personal deck swipe), personalTypes[] ('acquaintance' | 'neighbor' | 'service', set by Personal deck chips), customTags[] (free text, normalized), skips {triage, work, personal} (2 skips = leaves the deck as "unsorted"), updatedAt.
- Deck membership: `isInDeck(decision, pass)` in taxonomy.ts. Triage = no bucket. Work = bucket work and no workStatus. Personal = bucket personal and no relation.
- Pure transitions in taxonomy.ts: `applySwipe`, `setBucket`, `toggleChip`, `toggleCustomTag`, `decisionLabels` (labels for Review rows and vCard CATEGORIES). `PASS_META[pass]` gives title, swipes per direction (label + color), chips and chipColor.
- Persistence in `src/db/repo.ts`: upsertContacts, deckContacts(pass), getDecision, saveDecision, counts, allWithDecisions, allTags, dumpAll/restoreAll, resetAll, getMeta/setMeta. Use `useLiveQuery` from dexie-react-hooks around these for reactive screens.
- Undo is an in-memory stack of previous Decision snapshots (last 20); saveDecision is one transaction.
- UI primitives in `src/ui/index.tsx`: Frame, TopBar, Rule, Button, IconButton, Chip, Avatar, Segmented, Sheet, Empty, cx. Icons in `src/ui/icons.tsx`. Theme and haptics helpers in `src/ui/theme.ts`.
