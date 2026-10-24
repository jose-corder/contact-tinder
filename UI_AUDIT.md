# UI audit — Contacts.

Contacts. has a recognizable editorial surface, but its core workflow is not yet state of the art: it loses information on short screens, interrupts classification with competing layers, and conceals consequential changes behind benign navigation labels. This audit identifies **43 findings: 1 Critical, 14 High, 24 Medium, and 4 Low**. The three changes that would move the needle most are **an adaptive deck/sheet layout that keeps identity and actions visible**, **an explicit sorting model with reversible reclassification and reviewed restore**, and **a consistent accessible control system covering focus, hit areas, contrast, and input sizing**. Cosmetic embellishment should follow those changes.

Scope: all 23 supplied screenshots; DESIGN.md read fully before source inspection; all components under src/features and src/ui, all hooks, App.tsx, tokens, and relevant taxonomy/import/export/persistence/platform code. No other Markdown files were read. No app files were changed, dependencies installed, server started, or tests run. The findings distinguish screenshot evidence from static-code inference; Safari, assistive-technology, keyboard-open, and animation timing claims requiring execution are explicitly identified. Screenshot measurements are CSS pixels, not the doubled bitmap pixels; full-page captures may be rescaled. The supplied Chrome device emulation is not evidence of actual iPhone Safari behavior. Contract deviations are identified separately from deliberate recommendations to improve the contract.

## Critical

### 1. Selecting a backup immediately replaces the current database

**Severity:** Critical · **Dimensions:** E, F, G, I  
**Evidence:** Screenshots 14, 15; src/features/export/RestoreInput.tsx:14, :31; src/export/json.ts:58; src/db/repo.ts:213.

**Experience / shortfall:** Replace is preselected, and choosing a valid file immediately clears contacts, decisions, and tags absent from that backup. The explanatory paragraph exists, but there is no file-specific preview, final commit step, or in-app rollback; a file picker is being used as the confirmation for potentially losing the user's only current copy.

**Fix:** Parse first and show the backup date plus exact added, changed, and removed counts; commit only through “Replace this app’s data” or “Merge backup.” Retain a pre-restore snapshot for Undo, and make the removal count explicit immediately above the replacement action.

## High

### 2. The short-screen card cuts through a phone number instead of adapting

**Severity:** High · **Dimensions:** A, B, H  
**Evidence:** Screenshots 07, 21; src/features/deck/SwipeCard.tsx:17, :71; src/features/deck/CardFields.tsx:7; src/features/deck/DeckScreen.tsx:54.

**Experience / shortfall:** At 320×568, the role disappears and only a slice of the phone row survives; metadata and the details button remain intact. At 390×844 the same composition leaves a large empty middle: filling available space follows DESIGN.md, but fixed 72 px avatar, 20 px padding, and an overflow-hidden content stack sacrifice the information needed to decide.

**Fix:** Below approximately 680 px available height, use a 40–48 px avatar beside the name, 16 px card padding, and a one-line metadata footer. Keep identity plus at least one complete phone/email row visible, then expose remaining details through a scrollable region or explicit “More details”; never crop a row mid-glyph, and allow scrolling rather than collapse at large text sizes.

### 3. The action bar reserves space for invisible Undo and truncates the decision label

**Severity:** High · **Dimensions:** B, E, G  
**Evidence:** Screenshots 07, 11, 21; src/features/deck/ActionBar.tsx:12.

**Experience / shortfall:** A permanent 44 px Undo slot pushes the four decisions rightward even before Undo exists. At 320 px, 280 px content width must hold 44 + 4×56 + gaps, leaving essentially no room for captions; “Personal” becomes “PERSON…”, which is unacceptable on a primary decision control.

**Fix:** Use four equal-width action columns and move persistent Undo to the header or a separate 44 px control. At 320 px use 48 px circles with complete 12 px Inter captions, retain 56 px circles where space permits, and keep the bar inside bottom safe-area padding.

### 4. Follow-up actions scroll away inside nested sheet scrollers

**Severity:** High · **Dimensions:** B, E, H  
**Evidence:** Screenshots 09, 10, 22; src/ui/Sheet.tsx:76, :89; src/features/deck/FollowUpSheet.tsx:110, :141; src/features/deck/ChipRow.tsx:25.

**Experience / shortfall:** A short screen is dominated by identity, status chips, two rows of type chips, and their spacing; the opt-out is below the viewport, with the action row near the edge. The shared sheet, follow-up body, and capped chip row can all scroll, so entering a custom tag or adding more tags can bury completion controls further.

**Fix:** Give Sheet a single scrolling body and a separate fixed footer containing Later and Done, with max(16px, env(safe-area-inset-bottom)) padding. Keep the identity header to 56–72 px on short screens, use one 8 px chip gap system, and ensure the footer remains reachable with the software keyboard open.

### 5. Undo toast collides with both the deck controls and the modal

**Severity:** High · **Dimensions:** B, D, E, G  
**Evidence:** Screenshots 09, 11; src/ui/toast.tsx:57, :66; src/features/deck/DeckScreen.tsx:47; src/ui/Sheet.tsx:75.

**Experience / shortfall:** The fixed bottom offset of 88 px does not know the height of the actual action bar. In 11 the toast occupies the tag/action boundary and overlaps the top of the circles; in 09 it covers the follow-up footer because z-60 sits above the z-50 sheet. Its Undo is outside the dialog focus trap, so a visually prominent action is not part of the sheet’s keyboard path.

**Fix:** Render “Moved to Work · Undo” inside the sheet when one opens, and otherwise reserve a measured feedback slot above the deck toolbar with at least 12 px clearance. Pause actionable-toast expiry on focus/hover and provide persistent Undo in Review as well as the deck; four seconds alone is insufficient for that Review recovery path.

### 6. “Re-swipe these” silently erases classification before reclassification starts

**Severity:** High · **Dimensions:** E, F  
**Evidence:** Screenshots 13, 16; src/features/review/ReviewScreen.tsx:71; src/features/review/model.ts:18; src/features/review/reswipe.ts:9; src/features/review/RowSheet.tsx:88.

**Experience / shortfall:** The quiet text action immediately resets every filtered contact’s bucket or primary status/relation. “Jump to deck” performs the same reset for one contact; navigating back without swiping leaves old decisions cleared, although both labels read like navigation rather than edits.

**Fix:** Open a review queue that preserves each decision until its replacement is committed. If resetting is genuinely required, use “Restart sorting for N contacts,” preview exactly what will clear, and offer a batch Undo snapshot.

### 7. Personal classification forces a false Friend / Family / Ex choice

**Severity:** High · **Dimensions:** E, F  
**Evidence:** Code-only Personal counterpart of screenshots 09–10; src/features/deck/FollowUpSheet.tsx:71, :85; src/domain/taxonomy.ts:91, :108.

**Experience / shortfall:** Selecting Neighbor, Acquaintance, or Service provider cannot complete a Personal contact without also choosing Friend, Family, or Ex. A plumber or distant acquaintance may be none of those, so users must invent a relationship or leave an otherwise classified contact incomplete; this is a weakness in the contract itself, not merely its implementation.

**Fix:** Treat a selected Personal type as a valid completion when no primary relationship applies, or add an explicit “Other relationship” completion state. Update deck membership, progress, export labels, and both editing surfaces together so “Done” means the same thing everywhere.

### 8. The meaning of Delete arrives after users have already acted

**Severity:** High · **Dimensions:** E, F  
**Evidence:** Screenshots 01, 06, 13, 14; src/features/home/FirstRun.tsx:15; src/features/deck/DeckCoach.tsx:17; src/features/export/ExportScreen.tsx:102; src/export/platform.ts:9.

**Experience / shortfall:** Onboarding says “Delete,” but the hard constraint that the phone address book remains unchanged appears at the very bottom of Export. The iPhone hint tells users how to add a vCard, without putting the distinction between adding, replacing, and actually removing originals beside the primary action; importing a clean file is not a deletion workflow.

**Fix:** Introduce “Delete marks a list; your phone contacts stay unchanged” before the first decision and repeat it on the Delete review tab. Place platform-specific next steps immediately beneath the clean export button, explicitly saying that importing the file does not remove originals and may produce duplicates depending on the destination.

### 9. Import keeps the obsolete upload screen above the next required action

**Severity:** High · **Dimensions:** B, D, E  
**Evidence:** Screenshots 02–05; src/features/import/ImportScreen.tsx:53, :59, :94, :117; src/features/import/ImportPreview.tsx:22.

**Experience / shortfall:** Preview is appended beneath the hero, 192 px drop zone, demo button, and blank/status spacing; in 04 the confirmation action is below the viewport. After success, instructions for obtaining a file still dominate the page, and there is no focus or scroll handoff to the newly available next step.

**Fix:** Replace the upload panel with a compact selected-file row when preview begins, and replace preview with a result panel after commit. Focus the new heading, put “Import N contacts” or “Start sorting” within the first viewport, and collapse source instructions once a file has been read successfully.

### 10. Selected status colors fail text contrast despite healthy body tokens

**Severity:** High · **Dimensions:** C, G  
**Evidence:** Screenshots 09–10, 19; src/index.css:14, :35; src/ui/index.tsx:145; src/features/deck/FollowUpSheet.tsx:122; src/features/export/ExportScreen.tsx:101.

**Experience / shortfall:** Selected chips always use text-paper. In light mode that gives **3.95:1 on Old** and **4.08:1 on Potential**; in dark mode it gives **4.09:1 on Delete/Ex**. Dark Delete-colored small error text also measures **4.09:1 on paper / 3.80:1 on paper-2**, below the 4.5:1 normal-text threshold; Current in screenshot 10 is not the failing case. See [WCAG contrast guidance](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).

**Fix:** Introduce explicit on-color foreground tokens instead of assuming paper works for every fill, and adjust the failing fill/error tokens until all 13–15 px combinations reach at least 4.5:1. Test light Old/Potential and dark Delete/Ex selections plus inline errors, rather than changing the already-legible ink-2 token.

### 11. Tap-target compliance depends on which screen mounted the control

**Severity:** High · **Dimensions:** G, I  
**Evidence:** Screenshots 13–19; src/ui/index.tsx:48, :151, :221; src/features/deck/deck.css:19; src/ui/toast.tsx:86.

**Experience / shortfall:** Deck-specific CSS expands shared chips and Back/Undo, but the same primitives remain smaller elsewhere. The following is the complete identified sub-44 px control inventory in the reviewed UI; width-sensitive text controls need computed-bound checks, while explicit dimensions are definitive. The requested 44×44 bar is the enhanced target-size criterion, not a claim that every item automatically violates WCAG AA. See [W3C target-size guidance](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html).

| Control | Size / affected locations | Evidence |
|---|---|---|
| Back chevron outside the deck | 40×40 px | src/ui/index.tsx:48; deck-only expansion at deck.css:23 |
| Review filter chips | 36 px high | src/features/review/Filters.tsx:31; src/ui/index.tsx:151 |
| Row-sheet bucket/status/type/custom-tag chips | 36 px high | src/features/review/RowSheet.tsx:49, :54, :59, :65, :70, :76 |
| Toast Undo/Reload outside the deck | 32 px high | src/ui/toast.tsx:86; deck-only override at deck.css:25 |
| Shared segmented short labels | 44 px high but no minimum width; “All,” “Old,” “Ex,” and “Light” are narrower than 44 px at nominal 15 px Inter | src/ui/index.tsx:221; src/features/review/Filters.tsx:26; SettingsScreen.tsx:30 |
| “Clear” filters | No minimum width; short 14 px label | src/features/review/Filters.tsx:30 |
| “Official instructions” | About 32 px high: 12/16 text + 16 px bottom padding | src/features/import/HowToExport.tsx:52 |
| “Why a file?” disclosure | About 32 px high: 12/16 text + 16 px vertical padding | src/features/import/HowToExport.tsx:57 |
| “Original contact fields” disclosure | About 20 px high; no padding | src/features/review/RowSheet.tsx:45 |
| Empty Export “Import contacts” link | Inline text-height target | src/features/export/ExportScreen.tsx:55 |
| Home “Export” navigation link; conditional “Install” button | Height is at least 44 px, but short 14 px labels have no 44 px width floor | src/features/home/HomeScreen.tsx:62; src/features/home/InstallRow.tsx:12 |

**Fix:** Put 44 px minimum hit dimensions into shared controls and disclosures; preserve 36 px chip visuals with a non-overlapping transparent hit region if necessary. Keep the already-correct deck detail buttons, 44 px review Select/Cancel, 44 px copy buttons, and checkbox label hit areas intact—the checkbox’s 20 px glyph is not its touch target.

### 12. Route transitions animate the page without moving or announcing focus

**Severity:** High · **Dimensions:** D, G  
**Evidence:** All route changes; src/App.tsx:27, :33; src/ui/index.tsx:52; index.html:14.

**Experience / shortfall:** New pages get a focusable main wrapper but nothing calls focus; the document title remains “Contacts.” and top-bar titles are spans. Keyboard/screen-reader users can lose their place after the initiating control unmounts, especially on Review and Settings, where there is no page h1; the 160 ms exit followed by 160 ms entry also adds a serial transition to routine navigation.

**Fix:** After navigation, focus a proper h1 or the main landmark without scrolling, update the document title, and restore the relevant row/scroll position on Back. Use a single 120–160 ms transition without a full exit-before-enter delay, and a 120 ms fade under reduced motion if maintaining the contract’s fade behavior.

### 13. The accessible deck path is incomplete at card changes and copying

**Severity:** High · **Dimensions:** E, G  
**Evidence:** Screenshots 07–08, 11; src/features/deck/DeckScreen.tsx:59, :110; src/features/deck/SwipeCard.tsx:35; src/features/deck/CardFields.tsx:18; src/hooks/useKeyboard.ts:17.

**Experience / shortfall:** Buttons provide non-swipe classification, but ActiveDeck is keyed per contact, so its focused action button disappears on every decision. The toast announces the previous first name and outcome, not the new contact; the counter is not a live progress announcement, and the deck’s copy action is a long-press handler on a non-focusable dd, with no equivalent copy control or email link on the flipped card.

**Fix:** Keep the action toolbar mounted across cards and announce one concise message such as “Andres moved to Work. Carolina Cruz, Partner at Stark Legal. 2 of 38.” Add the same 44 px copy buttons and safe phone/email links used in Review to deck details, with an accessible “Keyboard shortcuts” help control on every input-capable platform.

### 14. All text-entry paths use small input text and lack keyboard-aware layout

**Severity:** High · **Dimensions:** G, H  
**Evidence:** src/features/deck/ChipRow.tsx:32; src/features/review/ReviewScreen.tsx:83; src/features/review/BulkBar.tsx:68; src/features/review/RowSheet.tsx:83; src/index.css:113.

**Experience / shortfall:** Deck tags and search explicitly use 13 px; bulk/row-sheet tag inputs inherit 15 px. These are iPhone focus-zoom risk candidates, not behavior proven by the Chrome screenshots; the fixed h-dvh deck and 85dvh sheet also have no explicit visual-viewport/keyboard treatment, so a focused tag input can consume the space intended for the card or footer.

**Fix:** Use 16 px text on all editable text inputs, maintain user zoom, and add scroll-padding so focused fields remain above the keyboard. Verify 320×568 and landscape with the keyboard open on a real iPhone, using visualViewport only where needed to keep the single sheet footer reachable.

### 15. The card invents the contact’s provider from its file extension

**Severity:** High · **Dimensions:** A, F, I  
**Evidence:** Screenshots 07, 08, 17; src/features/deck/SwipeCard.tsx:12, :80; src/features/review/RowSheet.tsx:41.

**Experience / shortfall:** Every vcf becomes “iCloud” and every csv becomes “Google,” although Import explicitly accepts exports from several providers. Review then shows “vcf” for the same record; this is not just ICLOUD versus iCloud casing, but contradictory and potentially false provenance.

**Fix:** Use truthful shared labels—“Contact file,” “CSV import,” “Phone,” and “Demo”—unless provider evidence was actually captured. Display provider and import format separately when known, and preserve brand casing rather than uppercasing iCloud.


## Medium

### 16. Three passes, Skip, and Later are exposed as mechanics rather than a clear promise

**Severity:** Medium · **Dimensions:** E, F  
**Evidence:** Screenshots 06, 09–10, 12, 20; src/domain/taxonomy.ts:64, :105; src/features/deck/FollowUpSheet.tsx:125, :151.

**Experience / shortfall:** “Triage,” the Work/Personal stepper, and a sheet after nearly every kept contact suggest several competing workflows. Skip means return once, then leave the pass; Later keeps the bucket but postpones details; dismissing a partially edited sheet also discards its draft, yet none of these distinctions is stated near the decision.

**Fix:** Introduce the model in one line: “Choose Work, Personal, or Delete; add details now or finish them later.” Use “Later: keep in Work and finish details later” in the sheet, explain the two-skip rule in contextual help, and clarify whether Later discards or retains already selected draft chips.

### 17. The coach instructs triage users to choose a type that does not exist

**Severity:** Medium · **Dimensions:** D, E, F, G  
**Evidence:** Screenshot 06; src/features/deck/DeckCoach.tsx:9, :17; src/features/deck/DeckScreen.tsx:91; src/domain/taxonomy.ts:74.

**Experience / shortfall:** Triage has only “+ tag,” but the coach says “Tap a chip first to add a type.” The full-card translucent overlay keeps irrelevant contact text faintly visible, consumes the entire reading surface, and disappears on any intercepted card click or drag; its direction arrows also differ from the X/check glyphs users must subsequently operate.

**Fix:** Make guidance pass-specific: “Swipe or use the buttons. You can add tags any time” for triage and “Choose any optional types, then a status” for Work. Use a compact 160–200 px guide with matching control glyphs and a clear dismissal, with one accessible reading order instead of faded contact content competing beneath it.

### 18. Fraunces uses display optical size on small text

**Severity:** Medium · **Dimensions:** A, I  
**Evidence:** Screenshots 07, 13, 16, 18; src/index.css:169; src/ui/index.tsx:191; src/features/review/ReviewRow.tsx:105.

**Experience / shortfall:** The name size is correctly 34/38 px, but every font-serif class explicitly forces opsz 144, including 17 px review names and small avatar initials. The resulting delicate display forms are less robust at list-reading sizes, and override the contract’s optical-sizing-on intent; the eyebrow separately fixes opsz 9.

**Fix:** Use font-optical-sizing: auto and remove the forced opsz axis for ordinary serif text, retaining intentional SOFT/WONK settings only where supported. Reserve an explicit display opsz for the large wordmark and stamp, then verify 17 px names and 14–20 px initials at 1× rendering.

### 19. “All fields” still truncates field labels and exposes raw timestamps

**Severity:** Medium · **Dimensions:** A, F  
**Evidence:** Screenshots 08, 17; src/features/deck/CardFields.tsx:7, :18; src/features/deck/SwipeCard.tsx:93; src/features/review/RowSheet.tsx:38.

**Experience / shortfall:** The 76 px label column shows “GIVEN N…” and “FAMILY …” even on the supposedly complete view. Raw CELL/INTERNET labels and ISO REV strings appear in Review; the local added timestamp includes seconds and an AM/PM suffix while the card uses an added year, making metadata noisier than useful contact information.

**Fix:** Share friendlyType and an Intl.DateTimeFormat-based formatter between both detail surfaces, showing “Added Oct 24, 2026” and “Updated Apr 10, 2023,” with raw timestamps only in advanced details. At narrow widths stack full-field labels above values or allow label wrapping; suppress empty metadata rather than printing technical placeholders.

### 20. Review quick actions are invisible and omit one destination for unclassified contacts

**Severity:** Medium · **Dimensions:** E, G  
**Evidence:** Screenshots 13, 16; src/features/review/ReviewRow.tsx:50, :65, :80.

**Experience / shortfall:** A sighted user gets no visible cue that rows swipe; the only instruction is aria-description. For an undecided contact, destinations contains Delete, Work, Personal but slice(0, 2) renders only Delete and Work, so the quick-action path arbitrarily excludes Personal.

**Fix:** Add a persistent 44 px “More actions” control or a clearly taught first-use row hint, and present all valid destinations in a shared menu. Keep keyboard and touch paths equivalent rather than encoding a different subset in the swipe reveal.

### 21. Search sits below the filtering machinery and conceals its scope

**Severity:** Medium · **Dimensions:** B, E, F  
**Evidence:** Screenshots 13, 16, 18; src/features/review/ReviewScreen.tsx:57, :65, :81; src/features/review/model.ts:12.

**Experience / shortfall:** Tabs, optional status/type filters, count, and “Re-swipe these” all precede search; searching a name actually searches only the current tab and filters, while the placeholder reads like global search. Plain substring matching also requires phone punctuation/spacing to match and does not normalize name diacritics, so plausible searches can miss visible contacts.

**Fix:** Put a 48 px search row directly below the header, with explicit scope (“Search Work contacts”) or a true All-contacts search. Keep filters beneath it, normalize phone digits and name accents, and move reclassification into the list action menu next to the result count.

### 22. Bulk selection crosses hidden scopes and its success state vanishes

**Severity:** Medium · **Dimensions:** B, E, F, G  
**Evidence:** Screenshot 18; src/features/review/ReviewScreen.tsx:42, :58, :92; src/features/review/BulkBar.tsx:21, :34.

**Experience / shortfall:** Selection persists across tab/filter changes, but “2 selected” does not say how many are outside the current list. “Select all in view” selects all filtered records, including rows not yet rendered by paging; a successful Move simply closes the bar without a success message or Undo, and four nowrap actions are vulnerable to cramped 320 px layouts.

**Fix:** Say “Select all N results” and show “N selected · M outside this view,” with an explicit selection-clear option on scope changes. Confirm moves with destination and count plus Undo, label Clear as “Clear selection,” and use a two-row or overflow layout below 360 px.

### 23. Contact details put the useful editing controls beneath an administrative dossier

**Severity:** Medium · **Dimensions:** B, E, I  
**Evidence:** Screenshot 17; src/features/review/RowSheet.tsx:27, :33, :45, :47; src/ui/Sheet.tsx:89.

**Experience / shortfall:** Given name, family name, organization, title, source, dates, and raw-field disclosure precede classification. The visible sheet ends before the editing tools, despite opening from a sorting product; duplicate name fields waste space, and a 75dvh internal scroller sits inside another scrolling Sheet body.

**Fix:** Order the sheet as identity → phone/email → classification → notes → collapsed import metadata. Use the shared single sheet scroller, keep Done/Close reachable, and move given/family splits and raw vCard content into “More details.”

### 24. Loading, empty, and failure states are uneven and sometimes unrecoverable in place

**Severity:** Medium · **Dimensions:** D, F, G  
**Evidence:** src/features/deck/DeckScreen.tsx:56; src/hooks/useDeck.ts:63; src/features/home/HomeScreen.tsx:27; src/features/export/ExportScreen.tsx:54; src/features/review/ReviewEmpty.tsx:3; src/main.tsx:26.

**Experience / shortfall:** Error handling exists for many mutations, but there is no app error boundary or designed database-read failure surface for Home, Review, Export, Settings, or DeckEnd. The shared Skeleton exists but is unused on these screens; the deck loader is an empty paper rectangle, and its load error asks the user to reopen rather than offering Retry.

| Surface | Existing state | Missing designed state / recovery |
|---|---|---|
| Home | FirstRun, plain Loading, retry-skipped error | Database-read error with Retry; stable dashboard skeleton |
| Import | Progress, preview, inline error list, already-imported state | Compact zero-readable-contact recovery; a clear summary/CTA beside partial parse errors |
| Deck | No-contacts CTA, blank loader, save rollback/error | Load/refresh Retry; deliberate loading placeholder matching card identity |
| Follow-up | Save error and disabled controls | No missing empty state needed; save-in-progress visual label remains generic |
| Deck end | Summary queried reactively | Loading/error state; until loaded, a done title and next CTA can exist with no counts |
| Review list | Illustrated per-tab empty state, plain Loading | Database-read error; “No matches” distinct from “Nothing here yet”; clear-filter/import CTA inside the empty panel |
| Row sheet | Inline save/remove errors | Pending-save feedback and visible explanation if a record disappears; no separate empty screen required |
| Export | No-contacts CTA, plain Loading, export message | Database-read error; visible file-preparation status near the action |
| Settings | Counting text, backup/reset errors, reset confirmation | Database-read recovery for counts/backup metadata; unsupported capability state |

**Fix:** Reuse one quiet loading skeleton and an error panel with a specific recovery action, preserving geometry and announcing only meaningful status changes. Give Review separate “No matching contacts” and genuinely empty-list states, with “Clear filters” or “Import contacts” directly inside the panel.

### 25. Share-first can unexpectedly become a series of downloads

**Severity:** Medium · **Dimensions:** D, E, H  
**Evidence:** Screenshots 14, 19; src/features/export/ExportScreen.tsx:43; src/export/prepare.ts:13; src/export/share.ts:23.

**Experience / shortfall:** The button promises Share based on empty file stubs, then prepares potentially large files asynchronously before requesting the native sheet. Slow preparation can outlive user activation, after which any non-abort share error automatically starts one download per file; this is a code-derived risk, not a reproduced Safari failure. The [Web Share specification](https://www.w3.org/TR/web-share/) requires transient activation for share().

**Fix:** Prepare the chosen export with visible progress, then offer an explicit “Share ready file” action when a new gesture is necessary. On share failure present “Download instead” as a choice, and use a single archive/download strategy or deliberate per-file controls for multiple lists rather than firing many downloads silently.

### 26. Export is a long inventory of implementation formats, not a guided finish

**Severity:** Medium · **Dimensions:** A, B, E, F  
**Evidence:** Screenshots 14, 19; src/features/export/ExportScreen.tsx:57, :66, :93, :100; src/export/vcf.ts:58.

**Experience / shortfall:** A clear primary clean-file section is followed by overlapping file groups, four equal outline buttons, and restore controls, producing a very long page. Filenames lead every row, “all-contacts” includes Delete, “all vCards” contains overlapping membership, and the warning about overlap comes after users have already passed the list actions.

**Fix:** Keep clean export and its next steps first, show “Other lists” as a disclosure with human labels (“Work · Current”) and filenames as secondary text, and put the overlap explanation before those controls. Move backup/restore to Settings with one “Back up or restore app data” link here, leaving CSV and deletion checklist as explicit secondary export choices.

### 27. Deck-end summaries can describe a different population from the completed queue

**Severity:** Medium · **Dimensions:** D, E, F  
**Evidence:** Screenshot 12; src/features/deck/DeckEnd.tsx:30, :40, :43; src/hooks/useDeck.ts:55; src/hooks/deckSession.ts:24.

**Experience / shortfall:** Scoped review decks count selected contacts at the top, but DeckEnd reads global counts and labels them “sorted in this pass.” The next CTA blindly follows the pass order—even screenshot 12 offers “Sort personal contacts” while the supplied session has zero Personal contacts—so completion can send users into another empty summary.

**Fix:** Pass session population/results into DeckEnd and distinguish “This session” from “All Work contacts.” Compute the next nonempty unfinished pass, otherwise lead with “Review contacts”; keep the 600 ms tick-up but expose the final count as stable accessible text.

### 28. The dashboard delays Continue with redundant progress displays

**Severity:** Medium · **Dimensions:** B, E, I  
**Evidence:** Screenshot 20; src/features/home/HomeScreen.tsx:23, :28, :51; src/features/home/ProgressOverview.tsx:8.

**Experience / shortfall:** A large wordmark, tagline, 96 px ring, explanatory headline, pass stepper, and tall resume card repeat progress before the main action. The contract’s one-line resume became a substantial panel; the ring and stepper are stylistically related hairlines, but completed/current dots use the same outlined form and the Work completion check has to explain the difference.

**Fix:** Put a compact “Continue sorting · 36 remaining” panel directly below the wordmark, then a single progress summary. Use filled/outlined/checked step states with text labels, retain tabular counts, and reduce returning-user header top spacing from 40 to 24 px.

### 29. Dark structural boundaries are almost indistinguishable from their surfaces

**Severity:** Medium · **Dimensions:** C, G  
**Evidence:** Screenshots 19, 20; src/index.css:27; src/ui/index.tsx:91, :151; src/features/home/ProgressOverview.tsx:12.

**Experience / shortfall:** Paper-2 versus paper is only **1.08:1** in both themes; rule versus paper/card is **1.32/1.22:1 dark**, **1.33/1.23:1 light**. Decorative hairlines need not meet text contrast, but using that same faint rule for outline-control boundaries, ring tracks, step dots, and divisions makes interactive structure excessively dependent on text, especially in dim dark-mode screenshots.

**Fix:** Keep --rule for editorial decoration and introduce a stronger --control-border / --progress-track token for boundaries that communicate a control or state. Increase those selectively rather than brightening every divider, and test focus/selected states independently on both paper surfaces.

### 30. Review labels disappear behind 6 px dots and overly short accessible names

**Severity:** Medium · **Dimensions:** C, E, G  
**Evidence:** Screenshots 13, 16; src/features/review/ReviewRow.tsx:49, :80, :108; src/features/review/DecisionLabels.tsx:6.

**Experience / shortfall:** A Delete row has only a 6 px colored dot at the far right, and rows omit Work types and custom tags entirely; incomplete Work contacts in Unsorted can be identified only by the bucket dot. aria-label “View [name]” replaces the button’s useful content-derived name, leaving organization and classification out of its accessible name even where a status is visually printed.

**Fix:** Display a concise textual status/type summary with an optional 8 px decorative dot, and expose organization plus classification through aria-describedby or a complete row name. Reuse a shared DecisionLabels variant for list, sheet, and export so category information never requires recognizing a color.

### 31. Tabs implement inconsistent keyboard and accessibility contracts

**Severity:** Medium · **Dimensions:** E, G, I  
**Evidence:** Screenshots 02, 13, 15; src/ui/index.tsx:207; src/features/review/ReviewTabs.tsx:10; src/features/import/HowToExport.tsx:35.

**Experience / shortfall:** Import has roving focus, arrow/Home/End handling, and a linked panel; ReviewTabs and Segmented put tab roles on ordinary buttons without those behaviors or associated panels. Settings’ appearance selector is presented as tabs even though it changes a preference rather than selecting content.

**Fix:** Extract the fully keyboard-operable tab behavior for Review/Import and provide associated tabpanel semantics. Use a radio group or segmented radio control for appearance and mutually exclusive status selection, preserving the same 44 px visual rhythm.

### 32. Motion parameters largely match, but stamp timing and travel feel are not tuned as a whole

**Severity:** Medium · **Dimensions:** D  
**Evidence:** Source-only motion inspection; src/hooks/useSwipe.ts:56; src/features/deck/swipeMath.ts:43; src/features/deck/NextCard.tsx:8; src/features/deck/Stamp.tsx:11.

**Experience / shortfall:** Rotation, thresholds, cancel spring, next-card spring, and 320 ms duration match the contract, but the committed stamp remains at opacity 1 for the whole fling with no separately controlled 120 ms stamp phase. Fling distance uses 1.5× the full viewport, so identical gestures travel far more on desktop than on mobile; the “at least 1200 px/s” calculation guarantees average displacement, not instantaneous speed throughout an ease-out curve.

**Fix:** Specify the stamp’s first 120 ms of commit explicitly without adding a blocking pre-fling pause. Calculate the offscreen target from card bounds plus a modest exit margin and minimum travel distance, then visually verify handoff to the next card on 320, 390, and 1280 px viewports before calling the motion polished.

### 33. Reduced motion is treated inconsistently across interaction surfaces

**Severity:** Medium · **Dimensions:** D, G  
**Evidence:** src/App.tsx:34; src/ui/Sheet.tsx:78; src/features/review/ReviewRow.tsx:71; src/features/deck/NextCard.tsx:10; src/index.css:210.

**Experience / shortfall:** Swipe/undo/flip mostly use 120 ms fades and disable tilt/haptics, but routes and sheets switch instantly, review rows still drag, and the sheet remains drag-enabled. NextCard deliberately stays scaled to 0.94 during reduced-motion advancement and is then replaced by the full-size active card, creating a potential size jump rather than a clean fade; CSS animation-duration overrides cannot control every Framer Motion value.

**Fix:** Centralize a reactive reduced-motion policy: 120 ms opacity transitions, no autonomous spatial travel, and no scaled next-card handoff. Preserve direct manipulation only where useful and user-controlled, with equivalent buttons, and verify toggling the OS preference while a deck is mounted.

### 34. Feedback is duplicated, misplaced, and inconsistently styled as an error

**Severity:** Medium · **Dimensions:** D, F, G  
**Evidence:** src/features/import/ImportScreen.tsx:94; src/features/import/ImportPreview.tsx:7; src/features/export/RestoreInput.tsx:39; src/features/export/ExportScreen.tsx:101; src/ui/toast.tsx:30.

**Experience / shortfall:** Import repeats progress as a large status sentence and a separate progress component; Restore emits both an inline status and a toast for the same success. Export renders “Preparing vCards…” and cancellation in Delete red below the restore controls, far from the initiating action; the global single-toast slot also lets unrelated PWA/offline messages replace actionable feedback. role=status plus aria-live on the same element is not, by itself, proof of duplicate speech—the independent success regions are the actual duplication.

**Fix:** Give each operation one live announcement source and put progress next to its initiating control, using neutral ink-2 for preparation/cancellation and error color only for failure. Queue or prioritize actionable notices, debounce import announcements to phase changes or meaningful milestones, and announce a single final result.

### 35. Import previews counts without making duplicate handling inspectable

**Severity:** Medium · **Dimensions:** E, F  
**Evidence:** Screenshots 04–05; src/features/import/ImportPreview.tsx:28; src/features/import/ImportScreen.tsx:106; src/import/index.ts:58.

**Experience / shortfall:** “40 contacts found · 2 duplicates will merge · 0 with photos” mixes input, merge, and photo counts without plainly stating the final number added. “Possible duplicates kept apart · review later” offers no route or retained review filter for those candidates, and the three preview names are arbitrary samples rather than the records whose identity will change.

**Fix:** Lead with “38 contacts will be added; 2 duplicate entries will merge,” adjusting for existing-record updates, and provide an inspectable merge summary. Retain possible-duplicate candidate IDs and offer “Review N possible duplicates”; hide the zero-photo statistic unless it explains a meaningful limitation.

### 36. Settings is dominated by duplicated restore prose and technical controls

**Severity:** Medium · **Dimensions:** B, E, F  
**Evidence:** Screenshot 15; src/features/home/SettingsScreen.tsx:33, :48, :59; src/features/export/RestoreInput.tsx:27; src/ui/theme.ts:79.

**Experience / shortfall:** Replace/Merge is explained twice, backup details expose raw-vCard/thumbnail mechanics, and “app session metadata” appears in a deletion warning. “Replay gesture coach” only schedules its next appearance, and Haptics can show On even where navigator.vibrate is unavailable, promising a capability that may do nothing.

**Fix:** Use compact sections in this order: Appearance, Sorting behavior, Backup and restore, About, Reset; reveal restore options only after “Restore backup.” Rename the coach action “Show tips next time,” present unsupported haptics as unavailable or hide that setting, and reduce backup help to what is saved and what the user can recover.

### 37. Installation guidance is correctly special-cased for Safari but generic elsewhere on iPhone

**Severity:** Medium · **Dimensions:** F, H  
**Evidence:** Screenshots 01, 20; src/features/home/InstallRow.tsx:10; src/features/home/useInstallPrompt.ts:20.

**Experience / shortfall:** The screenshots show the generic browser-install sentence, but source already gives iPhone Safari “Share → Add to Home Screen”; reporting that as missing would be wrong. The ios predicate explicitly excludes CriOS/FxiOS/EdgiOS, however, so iPhone users in those browsers get the vague sentence, and unsupported desktop browsers get a prominent inert install row.

**Fix:** Detect iOS separately from browser capability and offer a precise supported route, such as “Open in Safari, then Share → Add to Home Screen,” when the current browser has no usable install path. Make unsupported installation help dismissible and subordinate to Continue; the Safari path is supported by [Apple’s installation guidance](https://support.apple.com/guide/iphone/open-as-web-app-iphea86e5236/ios).

### 38. Safe-area support is good in the frame but incomplete in landscape overlays

**Severity:** Medium · **Dimensions:** B, H  
**Evidence:** Screenshot 21 as short-height evidence; src/ui/index.tsx:20; src/ui/Sheet.tsx:76; src/features/review/BulkBar.tsx:30; src/features/deck/deck.css:14; vite.config.ts:45.

**Experience / shortfall:** Frame accounts for all safe-area sides, but sheets and bulk bars use fixed 20 px horizontal padding and bottom-only safe-area protection. The portrait manifest preference does not solve a short landscape browser viewport; fixed-height overflow-hidden deck layout can collapse further, and deck.css unconditionally uses 85dvh despite the shared vh fallback.

**Fix:** Apply shared safe-area padding to overlays, scope dynamic-height overrides behind support checks, and add a short-landscape layout with scrollable content or side-by-side identity/actions. Keep touch-action:none restricted to the active swipe surface and retain pan-y/overscroll containment for detail scrollers; do not add a pull-to-refresh gesture that competes with downward Skip.

### 39. The type hierarchy mixes display styles and diagnostic text without a stable reading scale

**Severity:** Medium · **Dimensions:** A, B, I  
**Evidence:** Screenshots 02, 07–08, 12, 14–18, 20; src/index.css:174; src/features/deck/SwipeCard.tsx:79; src/features/deck/CardFields.tsx:18; src/features/home/ProgressOverview.tsx:18.

**Experience / shortfall:** Major contract sizes are correct, but the shared 11 px Fraunces eyebrow is reused for field labels and action captions that were specified as body/label text; metadata is tracked uppercase Inter, dates elsewhere are unformatted body text, and headline sizes range from 22 to 40 px without explicit role tokens. Long role/org and email values are truncated even when the card has abundant empty space; in 22 “Studio” becomes an isolated second line, while in 08 the raw timestamp creates a much worse wrap. The email in 07 fits; 11 is the clear email-ellipsis example, and 21 is vertical clipping, not ordinary ellipsis.

**Fix:** Define named type roles for display, screen title, contact name, row name, label, metadata, and numeric count, keeping 34/38 names, 15 px role/details, 12 px metadata, and 13 px chips as the baseline. Let role/org use two balanced lines where room exists; single-line email ellipsis is acceptable on the summary only with an obvious full-details/copy path, while all-field views must reveal the whole value.


## Low

### 40. Desktop faithfully reproduces the mobile frame but contributes nothing extra

**Severity:** Low · **Dimensions:** B, E, J  
**Evidence:** Screenshot 23; src/ui/index.tsx:19; src/features/deck/ActionBar.tsx:24; src/features/deck/deck.css:9.

**Experience / shortfall:** At 1280×800, the 440 px outer frame leaves roughly 840 px unused, while the keyboard legend is tiny and far below the contact. This follows the explicit design contract and remains usable; nevertheless, it feels like a phone preview rather than a considered desktop workspace.

**Fix:** Above 960 px, retain the 400 px inner card and optionally add a 240–280 px side panel separated by a hairline, showing the current pass, next few names, and labeled keyboard shortcuts. Keep the panel read-only and restrained; do not simply stretch phone typography across the canvas.

### 41. Editorial copy is repeated where literal task guidance would work harder

**Severity:** Low · **Dimensions:** F, J  
**Evidence:** Screenshots 01–06, 12, 14–15, 20; src/features/home/FirstRun.tsx:11; src/features/home/ProgressOverview.tsx:18; src/features/import/ImportScreen.tsx:54; src/domain/taxonomy.ts:24.

**Experience / shortfall:** The voice is mostly consistent but repeatedly poetic at state transitions that need precision. “Triage,” “Re-swipe,” “Bucket,” “vCard,” and the jokey “Name-drop flex” require users to learn the implementation or a tone that does not match the otherwise private, restrained product.

| Visible copy / role | Audit decision / concrete alternative |
|---|---|
| “Contacts.” | Keep the wordmark |
| “Swipe. Sort. Stay in touch with the right people.” | “Sort your contacts. Keep the people who matter.”; staying in touch is not an offered feature |
| “Room for the right people.” | Keep as the sole first-run editorial headline |
| “Bring your address book. Find a place for everyone.” | “Import a contact file, sort it, then export your lists.” |
| “Your address book, considered” | Remove; it repeats the hero without adding an instruction |
| “Bring your contacts.” | Keep; pair with supported file extensions and source help |
| “Nothing leaves this device.” | “Your contacts are processed here. Nothing is uploaded.”; less absolute once explicit sharing is available |
| “Choose a contact file” | Keep; helper “Contact file (.vcf) or spreadsheet (.csv)” |
| “or drop files here” | Show only on pointer/fine layouts |
| “Try with 40 demo contacts” | “Try 40 sample contacts”; disclose that the samples will be added to this app |
| “Ready when you are.” | “Ready to import 38 contacts.” with the actual projected result |
| “38 imported · 2 merged” | “38 contacts added · 2 duplicate entries merged” |
| “Start triage” / “Triage” | “Start sorting” / “Sort contacts,” or explain triage once if the name must stay |
| “A little direction.” | “How to sort” or retain only if the instructions beneath are corrected |
| “Choose a status” disabled action | Keep a stable “Done” label and connect “Choose one status to continue” to the status group; do not make an inert button look like it opens a picker |
| “Don’t ask after swipes; I’ll sort types in the Work deck” | “Add details later” with secondary “Turn off this prompt” preference text |
| “Work sorted.” / “Triage done.” | Use only when complete; otherwise “Work pass finished” plus outstanding count |
| “A little more clarity.” | “36 contacts left to sort” on returning Home |
| “Take it with you.” | Keep; the neighboring section must explain exactly what leaves |
| “One file, ready to keep” | “Your cleaned contact file” or remove redundant eyebrow |
| “Clean address book” | Keep with the existing explanation that unsorted contacts are included |
| “Individual lists” | “Other lists”; make overlap explicit before actions |
| “Re-swipe these” / “Jump to deck” | “Review N contacts again” only after fixing the reset semantics in finding 6 |
| “Unsorted” | Explain “Not classified or skipped twice”; do not imply all unfinished Work details are here |
| “Bucket” / “Relation” | “List” / “Relationship” |
| “Name-drop flex” | “Notable contact” if the owner agrees to a taxonomy-label change |
| “Back up (.json)” / “Backup (.json)” | Consistent verb “Back up app data”; extension secondary |
| “Danger zone” / “app session metadata” | “Reset app” / “saved progress” |
| “Use your browser’s install option when available” | Platform-specific instructions or suppress the inactive row |

**Fix:** Retain one editorial headline per screen and make actions, results, and recovery copy literal. Keep taxonomy-label changes coordinated with exports and existing saved values, rather than renaming underlying keys casually.

### 42. Parallel implementations of the same pattern undermine polish

**Severity:** Low · **Dimensions:** A, C, G, I  
**Evidence:** Screenshots 08, 13–19; src/features/deck/CardFields.tsx:18; src/features/review/ContactValue.tsx:8; src/features/review/DecisionLabels.tsx:6; src/features/export/ExportScreen.tsx:75; src/ui/index.tsx:207.

**Experience / shortfall:** Copying is long-press text in the deck and a visible glyph in Review; dots are separately built in rows, details, Home, and Export; disclosures mix native summaries with “View all fields” and an unstructured raw-text panel. Segmented controls and ReviewTabs also differ behaviorally; Settings combines a tab underline with another section divider, and the card’s inset white highlight adds a second bright edge above its existing rule border.

**Fix:** Extract shared contact-value, decision-label, disclosure, and selection-control variants, including focus-ring clearance inside horizontal filter scrollers. Keep the established 20 px card/sheet radius, pill controls, and 1.5 px icon strokes, but remove redundant rules/highlights and centralize the remaining hardcoded card-highlight/theme-color values with the tokens.

### 43. The distinctive details emphasize decoration more than useful state changes

**Severity:** Low · **Dimensions:** D, J  
**Evidence:** Screenshots 01, 05, 10, 12, 20; src/features/deck/DeckEnd.tsx:37; src/features/home/HomeScreen.tsx:23; src/features/review/ContactValue.tsx:8.

**Experience / shortfall:** The type and palette already provide identity, but completed sorting, a copied field, and a successfully saved classification mostly resolve to generic text, pills, or toasts. More decoration everywhere would obscure the product; a few precise state changes would make it feel intentionally finished.

**Fix:** After the functional work, choose from these five inexpensive touches, each with a reduced-motion fade or static equivalent. Remove the three named sources of noise rather than adding additional panels.

| Add, at most five | Concrete treatment |
|---|---|
| A completion seal | Small monochrome double-hairline “SORTED” stamp, max 72×28 px, 120 ms fade only when no work remains in the completed scope |
| Local copy acknowledgement | Swap the copy glyph for a check for 1 second; keep one accessible success announcement and avoid a redundant toast |
| A concise import receipt | Three aligned rows—Added, Merged, Kept separate—with tabular serif counts and a single 160 ms rule reveal |
| One first-run wordmark flourish | A 180 ms hairline reveal beneath Contacts., once per first-run session, without delaying the Import button |
| A settled classification check | Brief 120 ms check beside the chosen status when save succeeds, before closing the sheet; preserve the current no-bounce chip behavior |

| Remove, at most three | Why |
|---|---|
| “Your address book, considered” eyebrow | Duplicate sentiment before a practical file task |
| Expanded restore controls on Export | Compete with finishing the export task; keep a Settings link |
| One of Home’s duplicate progress blocks | Ring/stepper/resume should not all restate the same work before Continue |

## Per-screen scorecard

Scores assess the supplied state and its implementation, including short-screen and accessible use; they are not measurements of code quality.

| Screen | Score / 10 | One-line reason |
|---|---:|---|
| Home first-run | 6 | Clear import action, but oversized introduction and late explanation of what Delete actually does |
| Home with data | 6 | Useful counts, but ring, stepper, and resume repeat information before the primary task |
| Import | 5 | Preview and source instructions exist, yet the current phase and next action are buried in an accumulating page |
| Deck card | 4 | Recognizable identity and usable standard layout; clipped details and truncated actions at 320×568 break the core interaction |
| Follow-up sheet | 4 | Required-choice logic is visible, but nested scrolling, toast collision, and Personal completion semantics obstruct progress |
| Deck end | 5 | Restrained count presentation, but global/session counts and empty next-pass routing weaken the meaning of completion |
| Review list | 5 | Good row rhythm and explicit Select mode; hidden quick actions, scoped search, and destructive re-swipe behavior need work |
| Row sheet | 4 | Copy/link controls work as designed, while raw metadata and buried classification make a simple edit feel administrative |
| Export | 5 | Clean export is prominent, but destination guidance, overlapping files, restore placement, and preparation feedback need reordering |
| Settings | 5 | Preferences and reset confirmation exist; duplicated technical prose and immediate Replace restore undermine confidence |

## Verified good

These are verified from screenshots and source unless otherwise qualified; they are not a claim of runtime or assistive-technology certification.

- **Frame and baseline typography:** Frame is max-width 440 px with 20 px gutters and safe-area-aware padding (src/ui/index.tsx:19). The main name is 34/38 px, avatar 72 px, role/details 15 px, metadata 12 px tracked, chips 13 px with 36 px visuals, and top-bar eyebrow 11 px / 0.18em; retain these defaults while fixing short-height behavior. Review rows are 64 px with 17 px serif names and 13 px secondary lines.
- **Secondary text contrast is not a defect:** Ratios below were computed from the exact sRGB hex tokens in src/index.css using linearized relative luminance, then (Llighter + 0.05)/(Ldarker + 0.05). Values are rounded to two decimals, use solid token backgrounds, and do not include disabled opacity or antialiasing; ink-2 passes the normal-text 4.5:1 criterion in both themes.

| Token pair | Light | Dark |
|---|---:|---:|
| ink-2 on paper | 6.27:1 | 7.00:1 |
| ink-2 on paper-2 | 5.83:1 | 6.51:1 |
| rule on paper | 1.33:1 | 1.32:1 |
| rule on paper-2 | 1.23:1 | 1.22:1 |
| paper-2 against paper | 1.08:1 | 1.08:1 |

- **Dark stamp colors are lifted:** Work and Personal are 5.97:1 and 6.61:1 against dark paper, respectively; Delete is 4.09:1, acceptable for a large stamp or redundant dot but not the small text cases in finding 10. The palette is not globally too low-contrast. Tiny dots cannot bear semantic meaning alone even when their color contrast is adequate.
- **Icon, radius, and numeral foundations:** Shared SVG glyphs use 1.5 px strokes and currentColor, not an icon font; copy and custom bucket glyphs also use 1.5 px. Card/sheet corners use 20 px, chips/buttons use pills, progress counters use Inter tabular figures, and Home/DeckEnd counts explicitly combine Fraunces with tabular numerals. Right-aligned serif counts against Inter labels in 20 are intentional and align with the contract, not a reason to replace them wholesale.
- **Measured touch exceptions:** Deck-chip pseudo-elements expand the 36 px visual to 44 px with surrounding space; deck Back expands from 40 to 44 px. “View all fields” and card Back have min-h/min-w 44 px, Review Select/Cancel has minimum 44×44, copy glyph buttons are 44×44, and row checkbox labels are at least 44×44 despite their 20 px input glyph. Do not regress these while consolidating primitives.
- **Focus and modal groundwork:** The global focus-visible outline is 2 px with a 2 px offset. Sheet traps keyboard focus, handles Escape, restores focus when the opener is still connected, locks the body, and provides a 44 px close-handle button; hidden card faces are inert and aria-hidden, and the next card is hidden from assistive technology. Focus restoration cannot repair an opener that was unmounted, which is why findings 5, 12, and 13 remain.
- **Core non-gesture actions exist:** Four decision buttons, Undo, details flip/back buttons, explicit Review Select mode, and a keyboard mapping all exist. Shortcuts ignore text-entry and detail contexts, modifiers, and held-key repetition; accessibility work should complete these paths, not replace the swipe experience.
- **Motion constants mostly match:** Static inspection gives the following contract comparison; screenshots do not verify actual frame pacing or perceived smoothness.

| Motion requirement | Source evidence / result |
|---|---|
| Rotation x/20, clamp ±15° | swipeMath.ts:39 — exact |
| Commit at ~35% width or velocity >500 px/s | swipeMath.ts:21 — exact for resolved displacement; down resistance intentionally increases finger travel |
| Stamp opacity distance/threshold | swipeMath.ts:31 — exact for resolved displacement; full at threshold |
| 320 ms ease-out fling with minimum travel | useSwipe.ts:64 and swipeMath.ts:48 — duration and minimum distance implemented; desktop normalization discussed in 32 |
| Cancel spring 500/35 | useSwipe.ts:77 — exact |
| Next card 0.94 / 0.6, spring 300/30 | NextCard.tsx:10 — exact normal-motion values |
| Undo directional return, 260 ms | useSwipe.ts:43 — implemented |
| Chip fill 150 ms, no bounce | ui/index.tsx:151 — implemented |
| Count tick-up 600 ms | DeckEnd.tsx:10 — implemented with reduced-motion bypass |
| Reduced tilt/haptics and fade-based swipe/undo | useSwipe.ts:21, :45, :62; ui/theme.ts:79 — implemented; remaining coverage issues in 33 |

- **Safety and recovery already present:** Import previews before committing real files, reports unreadable records, and protects concurrent operations; identical files have an already-imported state. Deck save failure restores the card, stale writes reconcile, Undo retains 20 entries during the session, follow-up cannot close mid-save, reset has a separate confirmation with counts, and row removal explicitly says the phone book is unchanged. The restore transaction is atomic, but atomicity does not replace a review/confirmation UX.
- **Export fundamentals:** Clean export explicitly includes unsorted contacts and excludes Delete; the file count is visible; unsupported sharing falls back to download, and AbortError is treated as cancellation rather than automatically downloading. File preparation is lazy rather than eager for the entire address book. These are useful foundations, separate from the large-file activation and workflow issues.
- **Platform foundations:** index.html includes viewport-fit=cover; root height has vh/dvh fallback; body overscroll is suppressed; card details and sheet scrollers use containment; theme-color is synchronized for manual/system appearance. iPhone Safari install copy already mentions Share → Add to Home Screen and standalone mode hides the install row. The fixed Apple status-bar style and light manifest launch background require real-device verification in dark standalone mode; the supplied screenshots cannot establish a status-bar-color defect.
- **Hardcoded color review:** Screen content generally uses tokens; exceptions found are the deck’s white inset highlight, repeated light/dark theme-color hex values in ui/theme.ts/index.html, and manifest theme/background colors in vite.config.ts. Shadow rgba values are intentional token definitions, not arbitrary per-component status colors; avoid inventing a widespread hardcoded-color problem.

## Suggested implementation order

- **deck — first unblock the deciding task:** Own src/features/deck/* and src/hooks/useSwipe.ts/useDeck.ts/useKeyboard.ts. Address short-height card clipping and the action bar (2–3), shared sheet footer integration and toast ownership (4–5), Personal completion with taxonomy/progress owners (7), and stable focus/copy paths (13); then fix coach/Skip/Later guidance (16–17), metadata (15, 19, 39), scoped DeckEnd/next-pass routing (27), and motion/reduced-motion handoff (32–33). Verify at 320×568, 390×844, short landscape, long names, multiple contact values, many tags, keyboard-open, and reduced motion.
- **import-export — protect state, then simplify completion:** Own src/features/import/*, src/features/export/*, and src/export/*. Prioritize preview-before-restore with removal counts and recovery (1), then replace stacked import phases (9), explain phone-book limitations before export (8), make merge candidates inspectable (35), and keep preparation/share feedback adjacent to actions (25, 34). Collapse alternate export lists and relocate restore (26), refine copy (41), and verify large-file sharing on actual iOS/Android rather than relying on Chrome emulation.
- **review-home — preserve decisions and make the information architecture obvious:** Own src/features/review/*, src/features/home/*, with taxonomy/deck coordination. Fix non-destructive re-swipe first (6), then reveal all quick destinations (20), expose search scope (21), retain understandable bulk selection with Undo (22), and reorder detail sheets (23). Improve label/accessibility semantics (30–31), dashboard focus (28), Settings prose/capability states (36), and install fallbacks (37); add the missing read-error/no-match recovery states with platform-ui (24).
- **platform-ui — establish shared behavior before visual flourishes:** Own src/ui/*, src/index.css, src/App.tsx, index.html, and vite.config.ts. Supply the shared footer/single-scroller Sheet and feedback slots needed by deck, fix contrast and global target dimensions (10–11), implement route focus/title handling (12), 16 px editable inputs and keyboard-aware layouts (14), optical sizing and control-border tokens (18, 29), consistent tabs/live feedback/reduced motion (31, 33–34), and landscape safe areas (38). Consolidate repeated patterns (42), preserve verified-good defaults, and only then consider the optional desktop composition and five restrained touches (40, 43).
