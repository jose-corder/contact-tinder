# Contacts. — UI re-audit

The fix wave closes **17 of the original 43 findings; 26 are Partial and 0 are Open**, with **9 new regressions (#44–#52)**. The original critical trigger—selecting a backup immediately replacing app data—is fixed, but its new recovery path is not dependable enough to close the whole finding. The supplied short-screen deck now preserves complete contact rows and decision labels; the remaining blockers cluster around keyboard continuity, consistent completion semantics, recoverable operations, and integration of the shared primitives. **The app still does not meet a state-of-the-art bar for a mobile swipe utility:** opening a different Review tab can discard keyboard focus, copying inside a sheet gives no immediate acknowledgement, and restore/export recovery can act on a different data state than the user expects.

## Evidence and limits

Audited the current source and relevant tests against `UI_AUDIT.md` and `DESIGN.md`. No other Markdown files were read. The existing `qa-screens-v2/` contains six screenshot composites: **06** coach, **07** card, **09** follow-up/deck, **14** Export, **16** Review Unsorted, and **20** returning Home. These are the screenshots referenced below; previous screenshots are historical evidence only. In particular, **09 shows a follow-up sheet only at 390×844; its 320×568 half shows the deck**, so it cannot verify the short-screen sheet. There are no fresh Import, Restore, Settings, row-sheet, desktop, light-mode, landscape, keyboard-open, or motion captures.

`npx vitest run --configLoader native --pool threads --maxWorkers 2` completed: **63 test files, 382 tests passed**. `npm run typecheck` could not launch: the execution environment returned Windows `CreateProcessAsUserW failed: 5 (Access is denied.)`; this is not a compiler result. No server was started and no dependencies were installed. This report is the only authored file; existing changes to `.gitignore` and `src/features/deck/FollowUpSheet.tsx` were left intact. Line references describe the working tree inspected, including that follow-up change.

**Fixed** means the original failure is addressed by the available evidence, not that every device has been certified. **Partial** means there is a concrete remaining defect or incomplete part of the original workflow. New findings below are source-derived execution/layout paths unless explicitly backed by a screenshot; they were not reproduced in a running browser. Passing JSDOM tests that check class names, mock dimensions, or replace motion do not establish rendered geometry, screen-reader speech, or native mobile behavior.

## Original findings #1–#43

| # | Original finding | Status | Current evidence | Remaining work |
|---|---|---|---|---|
| 1 | Selecting a backup immediately replaces the current database | **Partial** | `src/features/export/RestoreInput.tsx:60` previews before the explicit commit at :81; `src/export/json.ts:113` snapshots Replace, but `src/ui/toast.tsx:27` replaces its only recovery control. | Expose persistent restore recovery for the promised ten minutes, compare decision contents rather than only timestamps in preview, and protect subsequent edits during Undo (#52). |
| 2 | The short-screen card cuts through a phone number instead of adapting | **Fixed** | Screenshot **07**, 320×568, shows role, complete phone row, email row, metadata and details action; `src/features/deck/CardFront.tsx:29` retains essential rows and :38 provides overflow scrolling. | — |
| 3 | The action bar reserves space for invisible Undo and truncates the decision label | **Fixed** | Screenshots **06–07** show four complete captions at both sizes; `src/features/deck/ActionBar.tsx:31` uses four equal columns, `deck.css:17` supplies 48 px short-width circles, and `DeckScreen.tsx:60` moves Undo to the header. | — |
| 4 | Follow-up actions scroll away inside nested sheet scrollers | **Fixed** | `src/ui/Sheet.tsx:114` separates the scrolling body from the nonshrinking footer; `src/features/deck/FollowUpSheet.tsx:82` uses that footer, and screenshot **09**, 390×844, shows Later/completion below its divider. | — |
| 5 | Undo toast collides with both the deck controls and the modal | **Partial** | `src/features/deck/FollowUpSheet.tsx:97` owns in-sheet Undo; `src/ui/toast.tsx:62` pauses expiry; `src/features/deck/ActionBar.tsx:22` measures clearance above the toolbar only. | Reserve feedback space above the complete tag/decision area and retain single-row Review Undo beyond the replaceable four-second toast. |
| 6 | “Re-swipe these” silently erases classification before reclassification starts | **Fixed** | `src/features/review/reswipe.ts:5` writes only a reclassification scope; `src/hooks/deckSession.ts:29` loads saved decisions and `src/hooks/useDeck.ts:149` writes replacements on action; screenshot **16** says nothing changes until a swipe. | — |
| 7 | Personal classification forces a false Friend / Family / Ex choice | **Partial** | `src/domain/taxonomy.ts:32` adds Other and :207 exports its label; `src/domain/decks.ts:5` auto-completes type-only deck choices, whereas `src/features/review/ClassificationEditor.tsx:36` still calls plain `toggleChip`. | Make type-only completion identical in Review and the deck, and include Other in the relation-specific export inventory (#51). |
| 8 | The meaning of Delete arrives after users have already acted | **Fixed** | `src/features/home/HomeScreen.tsx:41` explains the phone-book boundary before Continue/Import, `ReviewScreen.tsx:83` repeats it on Delete, and `ExportScreen.tsx:51` places destination/duplicate guidance beside clean export; screenshots **14**, **20** corroborate placement. | — |
| 9 | Import keeps the obsolete upload screen above the next required action | **Partial** | `src/features/import/ImportScreen.tsx:68` renders mutually exclusive phases and :25 focuses the heading, but `ImportPreview.tsx:29` and :38 still place the merge disclosure and three sample rows before confirmation at :47. | Put the preview commit action ahead of the optional sample/merge content so it is reachable in the first 320×568 viewport, and give the focused heading a phase-specific name. |
| 10 | Selected status colors fail text contrast despite healthy body tokens | **Fixed** | `src/ui/index.tsx:163` uses semantic on-color tokens; `src/index.css:28`, :30, :53 correct the failing colors, and `tests/ui/contrast.test.ts` passed across light/manual-dark/system-dark palettes. | — |
| 11 | Tap-target compliance depends on which screen mounted the control | **Fixed** | `src/ui/index.tsx:53`, :93, :129 and `src/ui/Segmented.tsx:41` apply global 44 px minima; `src/index.css:282` and :286 expand disclosures/chips, and the original small links now have minimum-height treatment. | — |
| 12 | Route transitions animate the page without moving or announcing focus | **Partial** | `src/App.tsx:51` updates titles, :55 focuses main on non-POP navigation, and :35 crossfades in 140 ms; :55 explicitly excludes POP and :70 remounts by history-entry key. | Restore a meaningful focus target and Review context on Back, and preserve the page during search-parameter-only tab changes (#44). |
| 13 | The accessible deck path is incomplete at card changes and copying | **Partial** | `src/features/deck/DeckScreen.tsx:67` no longer keys the entire active deck per contact, :63 announces the new card, and `CardFields.tsx:27` supplies CopyButton; the action toolbar still unmounts when the queue empties. | Move focus to completion or another durable target when the last card removes the toolbar, and finish the newly introduced copy/link paths (#45, #49). |
| 14 | All text-entry paths use small input text and lack keyboard-aware layout | **Partial** | `src/index.css:284` enforces 16 px coarse-pointer inputs and `src/ui/Sheet.tsx:31` reacts to visualViewport; `DeckScreen.tsx:57` still fixes and clips the deck while `ChipRow.tsx:42` inserts an input and suggestions below the card. | Provide a keyboard-open deck layout with enough scrollable space for identity, tag input and decisions, and verify the sheet height calculation on actual iPhone keyboard/zoom states. |
| 15 | The card invents the contact’s provider from its file extension | **Fixed** | `src/import/sourceLabel.ts:4` uses neutral format labels unless PRODID supplies provider evidence; both `CardFront.tsx:58` and `ContactDetails.tsx:26` call it, and screenshot **07** labels sample records Demo. | — |
| 16 | Three passes, Skip, and Later are exposed as mechanics rather than a clear promise | **Partial** | `src/features/deck/DeckCoach.tsx:15` adds the short model and `ActionBar.tsx:9` explains two skips through title/ARIA, but `FollowUpSheet.tsx:40` discards the draft and :44 explains Later only through an ARIA attribute. | Explain visibly that Later keeps the saved list but discards unsaved chips/tags, and expose the two-skip rule through touch-accessible contextual help. |
| 17 | The coach instructs triage users to choose a type that does not exist | **Fixed** | `src/features/deck/DeckCoach.tsx:9` supplies pass-specific instructions, :21 limits the guide, :24 reuses action glyphs, and :26 supplies explicit dismissal; screenshot **06** confirms the compact triage guide. | — |
| 18 | Fraunces uses display optical size on small text | **Fixed** | `src/index.css:206` removes blanket opsz 144; small/text serif variants use 9/24, display/stamp overrides are explicit, and `src/ui/index.tsx:199` chooses appropriate avatar variants. | — |
| 19 | “All fields” still truncates field labels and exposes raw timestamps | **Fixed** | `src/features/deck/CardFields.tsx:21` stacks full labels above wrapping values; `CardFront.tsx:8` and `src/features/review/ContactDetails.tsx:6` format dates, and the detail tests cover readable types/dates. | — |
| 20 | Review quick actions are invisible and omit one destination for unclassified contacts | **Fixed** | Screenshot **16** shows persistent More buttons; `src/features/review/ReviewRow.tsx:103` exposes the menu and `QuickActions.tsx:7` includes every other destination for both menu and reveal. | — |
| 21 | Search sits below the filtering machinery and conceals its scope | **Fixed** | `src/features/review/ReviewScreen.tsx:74` places scoped search before filters/actions; `model.ts:10` normalizes accents and :15 phone digits; screenshot **16** explicitly says Search in Unsorted (37). | — |
| 22 | Bulk selection crosses hidden scopes and its success state vanishes | **Fixed** | `src/features/review/ReviewScreen.tsx:37`, :77 and :81 clear selection across scope changes; `BulkBar.tsx:52` names all N results, :55 uses a two-column action grid and :67 retains Undo last action. | — |
| 23 | Contact details put the useful editing controls beneath an administrative dossier | **Partial** | `src/features/review/RowSheet.tsx:51` moves classification before details and :69 uses the shared footer, but `ContactDetails.tsx:17` collapses every phone/email together with metadata. | Keep a compact phone/email identity block ahead of classification and restore access to original fields without restoring the administrative wall (#46). |
| 24 | Loading, empty, and failure states are uneven and sometimes unrecoverable in place | **Partial** | Home/Review/Export/Settings now catch read failures and show Retry, but `src/hooks/useDeck.ts:72` still says reopen, `DeckScreen.tsx:65` is a blank card loader, `DeckEnd.tsx:35` has an uncaught query, and `src/main.tsx:26` has no error boundary. | Add a retryable deck/deck-end read state and app-level recovery boundary; do not render a success heading while completion data is unavailable. |
| 25 | Share-first can unexpectedly become a series of downloads | **Partial** | `src/features/export/ExportAction.tsx:42` requests a fresh gesture after activation loss and :49 offers explicit fallback, but `ExportScreen.tsx:77` still downloads the whole group and `src/features/review/BulkBar.tsx:61` still uses automatic fallback. | Route bulk export through the same explicit fallback flow and replace the many-download action with an archive or deliberate per-file choices. |
| 26 | Export is a long inventory of implementation formats, not a guided finish | **Partial** | Screenshot **14** leads with the clean file and its caveats; `src/features/export/ExportScreen.tsx:60` collapses named lists and explains overlap, but :79 retains backup and :84 retains Restore on Export. | Replace Export’s backup/restore controls with a Settings link and keep the secondary finish choices focused on contact files and the deletion checklist. |
| 27 | Deck-end summaries can describe a different population from the completed queue | **Fixed** | `src/features/deck/DeckEnd.tsx:49` separates This session from the global counts at :50–51, and `src/domain/decks.ts:11` chooses a nonempty unfinished pass; scoped-summary/empty-pass tests passed. | — |
| 28 | The dashboard delays Continue with redundant progress displays | **Fixed** | Screenshot **20** shows Continue before the smaller progress summary; `src/features/home/HomeScreen.tsx:48` puts resume first and `ProgressOverview.tsx:21` distinguishes completed/current/future steps. | — |
| 29 | Dark structural boundaries are almost indistinguishable from their surfaces | **Partial** | `src/index.css:43` introduces stronger control/track tokens, used by shared buttons/rings, but dark control-border is still only 1.69:1 on paper and 1.52:1 on paper-2; `RestoreInput.tsx:51` retains a rule-border file control. | Finish control-token adoption and strengthen state-bearing outlines/tracks selectively, without treating decorative rules as text-contrast failures. |
| 30 | Review labels disappear behind 6 px dots and overly short accessible names | **Partial** | `src/features/review/ReviewRow.tsx:45` names organization and all labels accessibly, :99 displays an 8 px dot with list/status text, and screenshot **16** visibly says Unsorted. | Include a concise visible type/custom-tag summary; those values are still absent from the rendered row despite being in its accessible name. |
| 31 | Tabs implement inconsistent keyboard and accessibility contracts | **Partial** | Review uses shared roving-arrow behavior and a panel (`ReviewScreen.tsx:79`), but `src/features/home/SettingsScreen.tsx:37` and `src/features/review/Filters.tsx:18` still use tab-role Segmented without panels. | Use radios for appearance and single-choice filters, name each group, and keep Review’s arrow-key focus alive across URL updates (#44). |
| 32 | Motion parameters largely match, but stamp timing and travel feel are not tuned as a whole | **Partial** | `src/features/deck/Stamp.tsx:14` now holds/fades the committed stamp over an explicit 120 ms phase, but `swipeMath.ts:50` still derives travel from the full viewport and `motion.ts:12` makes stamp opacity saturate at 70% of the commit distance. | Calculate exit travel from card bounds and reconcile visual stamp saturation with the actual commit threshold before visually validating the handoff. |
| 33 | Reduced motion is treated inconsistently across interaction surfaces | **Partial** | Routes, sheets and NextCard use reactive fades/unscaled handoff (`src/App.tsx:35`, `src/ui/Sheet.tsx:103`, `NextCard.tsx:11`), but `src/features/review/ReviewRow.tsx:39` still animates horizontal reveal even for keyboard actions under reduced motion. | Apply the shared reactive policy to Review’s programmatic reveal/close transitions and verify preference changes during active interactions. |
| 34 | Feedback is duplicated, misplaced, and inconsistently styled as an error | **Partial** | `ExportAction.tsx:63` localizes neutral status and Restore emits one success toast, but `src/ui/toast.tsx:27` still replaces any actionable notice and `ImportScreen.tsx:64` announces every progress update. | Prioritize durable actions, throttle import progress announcements, and distinguish local failures from neutral export/restore status; resolve modal copy feedback (#45). |
| 35 | Import previews counts without making duplicate handling inspectable | **Partial** | `src/features/import/ImportPreview.tsx:27` leads with added count and :29 exposes up to 20 merge/kept-apart pairs; `ImportScreen.tsx:93` reduces the result to a kept-apart count with no review action. | Retain candidate identities beyond the transient preview and provide a concrete Review possible duplicates route, including candidates beyond the 20-pair display cap. |
| 36 | Settings is dominated by duplicated restore prose and technical controls | **Fixed** | `src/features/home/SettingsScreen.tsx:42` shows unsupported haptics as Unavailable, :64 says Show tips next time, :78 says Back up app data, and :82 defers restore options; the old duplicated Replace/Merge explanation is gone. | — |
| 37 | Installation guidance is correctly special-cased for Safari but generic elsewhere on iPhone | **Partial** | `src/features/home/useInstallPrompt.ts:20` now detects all iOS browsers, but `InstallRow.tsx:11` gives them one Safari-style instruction and `useInstallPrompt.ts:45` still displays help in every uninstalled browser; screenshot **20** retains the inert generic row. | Distinguish a supported browser-specific installation route and hide or make dismissible the unsupported generic install row. |
| 38 | Safe-area support is good in the frame but incomplete in landscape overlays | **Partial** | `src/ui/Sheet.tsx:100` and `src/features/review/BulkBar.tsx:49` now include both side insets and `src/index.css:163` has vh/dvh fallback, but `DeckScreen.tsx:57` still clips a fixed-height stack with no landscape arrangement. | Add a short-landscape/large-text fallback that preserves the stage and toolbar, then verify overlays and keyboard-open layouts with real safe-area/viewport changes. |
| 39 | The type hierarchy mixes display styles and diagnostic text without a stable reading scale | **Partial** | `src/index.css:272` supplies six roles, but Import/Export/Review retain ad-hoc sizes; `CardFront.tsx:18` uses a 680 px **stage** threshold, making both screenshot **07** cards compact and :43–45 single-line even on the roomy 390 layout. | Finish role-token migration and permit fuller identity/role lines where the actual card has space instead of truncating throughout the common portrait range. |
| 40 | Desktop faithfully reproduces the mobile frame but contributes nothing extra | **Partial** | `src/features/home/HomeScreen.tsx:47` adds a two-column dashboard and `src/features/review/ReviewScreen.tsx:106` adds a detail pane, but `DeckScreen.tsx:57` still uses the 440 px Frame with no companion workspace. | Give the desktop deck useful adjacent context/shortcuts while retaining its mobile-sized card; desktop appearance still needs fresh visual evidence. |
| 41 | Editorial copy is repeated where literal task guidance would work harder | **Partial** | FirstRun/import privacy copy is now literal, but `src/features/import/ImportScreen.tsx:95` still says Start triage, `FollowUpSheet.tsx:85` changes the disabled completion label, and taxonomy retains Name-drop flex. | Finish task-oriented action/state copy, especially stable Done with associated validation, explicit Later semantics, and accurate skipped/completed headings. |
| 42 | Parallel implementations of the same pattern undermine polish | **Partial** | Shared footer/notices/dots/copy/tone are adopted, but `CardFields.tsx:46` and `ContactDetails.tsx:11` duplicate type formatting, deck/review build links differently, and `HowToExport.tsx:35` retains local tabs. | Consolidate contact formatting/link safety and remaining control variants, migrate local feedback/type styles, and fix the shared-chip overflow contract (#50). |
| 43 | The distinctive details emphasize decoration more than useful state changes | **Partial** | `src/features/deck/DeckEnd.tsx:46` adds a SORTED seal, but without a completion guard; `src/ui/feedback.tsx:30` still uses generic toast-only copy feedback, and import retains a sentence rather than a result receipt. | Make the chosen finishing touches truthful and local—first gate the seal (#47) and acknowledge copying in place—before adding any further decoration. |

### Shared-primitives integration check

- **Sheet/footer:** FollowUpSheet, RowSheet and Settings reset use `Sheet.footer`/`SheetFooterActions`. Bulk move, bulk tag and QuickActions still put completion/cancel buttons in the body (`BulkBar.tsx:72`, :81; `QuickActions.tsx:23`). Bulk tag is the important remaining keyboard-open case. The global descendant overflow override at `src/index.css:285` flattens nested scroll utilities; it is a migration patch, not evidence that every consumer’s layout has been designed for one scroller.
- **InlineNotice/CopyButton:** Deck, Review and Home largely use InlineNotice; Import, ExportAction and RestoreInput retain local alert/status markup. CopyButton is shared, but its toast-only acknowledgement is incompatible with modal suppression (#45). Long-press deck copy still has another implementation (`SwipeCard.tsx:31`).
- **LabelDot/Chip tone:** Review rows, menus, bulk actions, Home and DeckEnd use LabelDot; the toaster retains its own dot/tone map (`toast.tsx:51`, :79). Semantic selected chips now use `tone`; default ink chips do not need a semantic color. No currently identified semantic-chip consumer still passes the old custom color instead of `tone`.
- **Hit areas/type roles:** Shared 44 px controls are substantially integrated; do not undo that repair to solve text overflow. Remaining literal pixel text classes are in `ImportScreen.tsx:60` (38/24), `ImportPreview.tsx:42` (17/13), `HowToExport.tsx:38` (13), `ExportScreen.tsx:33` (40), `ReviewRow.tsx:97` (17/13), and `ReviewTabs.tsx:8` (13). Numerous `text-sm`/`text-xs` classes and `deck.css:8–9` also sit outside the named scale. Matching a token’s numeric size today does not make these sites share its future behavior.

Contrast figures here use the current solid sRGB tokens, not screenshot sampling or antialiased glyph pixels. The repaired original failures measure **4.63:1** for light Old, **4.82:1** for light Potential, and **5.25:1 / 4.73:1** for dark Delete on paper/paper-2. Control-border measures **1.86:1 / 1.73:1** in light and **1.69:1 / 1.52:1** in dark; these are stronger than the old rules but still weak for state-bearing boundaries. This is not a claim that every outlined text button requires its border alone to satisfy a non-text contrast criterion.

## New findings

### 44. Review’s new tab keyboard behavior is undone by route remounting

**Severity:** High · **Dimensions:** D, E, G  
**Evidence:** `src/ui/Segmented.tsx:38` changes selection then focuses the new tab; `src/features/review/ReviewScreen.tsx:70` implements that change with `setParams(..., { replace: true })`; `src/App.tsx:70` keys the whole page by `location.key`, and :55 focuses main on REPLACE navigation. `tests/ui/routes.test.tsx` mocks Review; Review tests mount it without AnimatedRoutes.

**Experience:** Press Right Arrow on a Review list tab. The shared component focuses the next tab, but the URL update creates a replacement route instance, destroys that tab node, and sends focus to main. The next arrow no longer continues the tab sequence. A local list switch also unnecessarily crossfades/reloads the page. This is a source-derived integration failure that the isolated tests do not cover.

**Fix:** Keep the route instance stable for same-path query changes, preserve focus in the selected tab, and test the real AnimatedRoutes + ReviewTabs composition with consecutive arrow presses and browser Back.

### 45. Shared CopyButton feedback disappears inside the sheet that contains it

**Severity:** Medium · **Dimensions:** D, F, G  
**Evidence:** `src/features/review/ContactDetails.tsx:23` mounts CopyButton inside RowSheet; `src/ui/feedback.tsx:30` sends both success and failure only through toast; `src/ui/Sheet.tsx:54` suppresses the toaster, and `src/ui/toast.tsx:42` discards suppressed notices after six seconds.

**Experience:** Expand Details and copy a phone number. The clipboard operation may succeed, but the open sheet provides no visible or accessible success result. A permission failure is equally hidden. Close quickly and an unrelated-looking message appears late; stay in the sheet and it is discarded. The global suppression that repairs the original collision breaks this newly shared control’s feedback contract.

**Fix:** Give CopyButton a local check and one local live result, with an adjacent failure/retry state; do not require closing a modal to learn whether its action worked.

### 46. Reordered Review details remove access to preserved original fields

**Severity:** Medium · **Dimensions:** E, F, I  
**Evidence:** `src/features/review/RowSheet.tsx:52` delegates to ContactDetails; `ContactDetails.tsx:13` and :25 enumerate only normalized phones/emails and a small set of properties, with no raw-field disclosure. In contrast, `src/features/deck/CardFields.tsx:33` still reads extra fields from raw vCard data. Original finding #23 documented an existing “Original contact fields” disclosure.

**Experience:** A contact’s birthday, address or website can remain in the stored/exported vCard but disappear from Review. The user must leave the editing surface and reopen the deck to inspect those fields. Collapsing administrative metadata has unintentionally removed information rather than relocating it.

**Fix:** Share a readable advanced-field view between deck and Review, including preserved extra/merged fields; keep it collapsed below classification and retain an explicit original-record fallback.

### 47. The new SORTED seal celebrates contacts that were skipped out

**Severity:** Medium · **Dimensions:** D, F  
**Evidence:** `src/features/deck/DeckEnd.tsx:46` always renders SORTED; :52 can simultaneously report skipped-twice contacts. `src/hooks/useDeck.ts:147` increments done when a second skip removes an item, and `src/domain/taxonomy.ts:85` still supplies “Work sorted.”

**Experience:** Skip every contact twice and the queue ends with a SORTED seal, a complete session counter, and a note that contacts still need sorting. The newly added visual completion cue is false even if the explanatory note is read. It also renders before the summary query completes.

**Fix:** Derive actual classified/remaining results for the completed scope; show “Pass finished” with outstanding work when appropriate, and render the seal only after the scope is known to be fully sorted.

### 48. A prepared export can silently become stale while its displayed counts update

**Severity:** High · **Dimensions:** E, F  
**Evidence:** `src/features/export/ExportAction.tsx:11` stores prepared File objects in local `ready` state; :31 reuses them on the next click without checking input identity. `src/features/export/ExportScreen.tsx:17` live-updates rows and :49 displays the new clean count, but the action at :50 has no data-version key or invalidation contract.

**Experience:** Prepare a clean export until “Share ready file” or “Download instead” appears, then change classifications in another app tab. The count and surrounding export model can update while the retained file still contains the earlier set—including contacts now marked Delete. The fresh-gesture fix introduces a persistent artifact whose scope is no longer necessarily the one shown.

**Fix:** Associate preparation with an immutable source revision and invalidate ready files when that revision changes, or explicitly present the prepared snapshot/count/date and require a choice to regenerate before sending it.

### 49. New deck telephone links discard extension semantics

**Severity:** Medium · **Dimensions:** E, F, I  
**Evidence:** `src/features/deck/CardFields.tsx:11` constructs `tel:` from `e164 || value` and removes everything outside `[^+\d*#,;]`; `src/features/review/safeLinks.ts:9` already has different, conservative handling that preserves `;ext=`.

**Experience:** For a value such as `+1 555 0100;ext=42`, the deck can strip the extension entirely when e164 exists or turn the raw value into `+15550100;42` otherwise. The displayed number and copied text still contain the original extension, so the new tap-to-call affordance behaves differently from the information shown and from Review.

**Fix:** Reuse the validated phone/email link helpers in the deck, preserve supported extension syntax, and leave unsupported values as copyable text instead of manufacturing a different dial target.

### 50. Global chip hit-area styling defeats the deck’s text truncation

**Severity:** Medium · **Dimensions:** A, B, G, I  
**Evidence:** `src/features/deck/ChipRow.tsx:36` gives custom-tag chips `max-w-full truncate`; `src/ui/index.tsx:166` renders the label directly in the button; the unlayered `.chip-hit` rule at `src/index.css:286` forces `overflow: visible`, overriding Tailwind’s layered truncation overflow.

**Experience:** A permitted 32-character unbroken tag can exceed a 280 px mobile rail. Its button is width-limited but its label no longer clips or ellipsizes, so the text can paint across the pill boundary and neighboring controls. This is a CSS-derived long-content regression; the supplied screenshots contain no long custom tags to validate it visually.

**Fix:** Preserve the outer visible overflow needed for the 44 px hit region and truncate/wrap a separate inner label span; check long tags in the deck rail, follow-up wrapping layout and Review editor at 320 px.

### 51. Other is a completed Personal relationship with no corresponding export list

**Severity:** Medium · **Dimensions:** E, F, I  
**Evidence:** `src/domain/taxonomy.ts:32` introduces Other and :207 includes it in decision labels, while `src/export/vcf.ts:75` still enumerates only `friend`, `family`, `ex` when generating relationship-specific files.

**Experience:** A user can explicitly complete an Other contact, see it counted in completion, and filter Other in Review, but cannot export “Personal · Other” alongside the other relationship lists. Other-only contacts remain in clean/all-Personal files; this is a missing subset action, not loss from every export. Type-only contacts may have a type file, which does not solve explicit Other without a type.

**Fix:** Generate relation export groups from the authoritative relation metadata and cover Other both with and without optional types in inventory tests.

### 52. Restore Undo can erase work performed after the restore

**Severity:** High · **Dimensions:** E, F  
**Evidence:** `src/export/json.ts:117` retains the pre-restore snapshot; :124–135 restores that entire snapshot with Replace, without checking current changes or previewing them. `src/features/export/RestoreInput.tsx:79` promises a ten-minute Undo window, and :39 wires directly to that operation.

**Experience:** Restore a backup, then edit classifications or import contacts in another app tab during the recovery window. Press Undo in the first tab: the operation also replaces those later decisions and removes later contacts, although the control was presented as Undo for the restore. The newly added recovery operation has become another unreviewed full-database replacement.

**Fix:** Track the post-restore revision and either reverse only unchanged restore effects or present a concrete rollback preview/confirmation when intervening changes exist; preserve those newer changes in a recoverable snapshot before replacement.

## Re-scored per-screen scorecard

Same ten screens and 1–10 scale as the first audit. Scores include current implementation and accessible/short-screen paths; improvements are not runtime certification. Only the screenshot-backed states identified above have fresh visual evidence.

| Screen | Previous | Now / 10 | Delta | Reason for change |
|---|---:|---:|---:|---|
| Home first-run | 6 | 7 | +1 | The Delete boundary and practical import explanation now arrive early; unsupported installation help and the large introductory composition remain. |
| Home with data | 6 | 7 | +1 | Continue now precedes the smaller progress summary and counts navigate directly; screenshot 20 still shows substantial scrolling and an inert install row. |
| Import | 5 | 6 | +1 | Exclusive phases and inspectable merge pairs clarify the task; preview confirmation is still behind samples, with no durable duplicate-review destination. |
| Deck card | 4 | 7 | +3 | Screenshot 07 repairs the decisive 320 px clipping/caption failures, and stable mid-queue controls improve keyboard use; completion focus, long tags, long identities and keyboard-open layout remain. |
| Follow-up sheet | 4 | 7 | +3 | Fixed footer, in-sheet Undo and Other remove the main obstructions; Later still silently discards draft details and short-screen keyboard behavior lacks visual evidence. |
| Deck end | 5 | 6 | +1 | Session/global labeling and next-pass selection are repaired, but the unconditional SORTED seal, skipped headings and missing read recovery undermine completion. |
| Review list | 5 | 6 | +1 | Non-destructive sorting, visible menus, scoped search and bulk Undo improve control; full-app tab remounting breaks the new keyboard path and visible labels still omit types/tags. |
| Row sheet | 4 | 6 | +2 | Classification and completion controls are reachable earlier; contact values are over-collapsed, original fields disappear, and CopyButton feedback is suppressed. |
| Export | 5 | 6 | +1 | Destination caveats and collapsed alternate lists clarify the finish; stale prepared files, missing Other lists and incomplete fallback consolidation prevent a higher score. |
| Settings | 5 | 7 | +2 | Preview-before-restore, truthful haptics capability and clearer tips/backup copy reduce risk; appearance semantics and fragile/destructive restore Undo remain. |

Screenshot 20’s “38 to go / 0%” alongside “Sort 1 / 38” is **not counted as a new arithmetic defect**: `src/features/home/progress.ts:10` measures fully completed contacts, so one Work contact awaiting status contributes zero overall completions. The differing progress concepts still need clearer explanation, as covered by #16.

## Next wave

Items are ordered by impact within each owner; fix behavior and integration before additional decorative changes.

**deck**

1. Preserve focus when the queue ends, move focus to an accurate completion state, and gate SORTED on actual scope completion (#13, #24, #47).
2. Provide short-landscape/keyboard-open/large-text layouts that keep identity, tag entry and decisions usable; validate 320×568, 390×844 and landscape (#14, #38).
3. Unify Personal completion with Review, including explicit Other and type-only choices; make Later’s unsaved-draft behavior visible (#7, #16).
4. Use the shared safe link helpers and a bounded inner chip label; allow fuller identities on roomy cards (#39, #49, #50).
5. Reserve space for feedback above tags/actions and tune card-bound fling/stamp timing with reduced-motion checks (#5, #32–33).

**import-export**

1. Make restore recovery persistent and safe after intervening edits, with accurate content-based comparison and reviewed rollback when necessary (#1, #52).
2. Version/invalidate prepared export files, unify bulk fallback with ExportAction, and replace uncontrolled multiple downloads (#25, #48).
3. Put Import confirmation before optional samples, announce the current phase clearly, and retain an actionable possible-duplicates review set (#9, #34–35).
4. Include Other in relationship export groups and verify its clean, grouped, CSV and backup round trips (#7, #51).
5. Move backup/restore ownership to Settings and complete literal finish/action copy plus shared type/feedback adoption (#26, #39, #41–42).

**review-home**

1. Coordinate with platform-ui to keep real Review tab focus stable; preserve meaningful Review context on return from the deck (#12, #31, #44).
2. Restore readable original-field access and keep phone/email identity visible without burying classification (#23, #46).
3. Adopt the same type-only Personal completion rule as the deck and show concise visible type/tag summaries (#7, #30).
4. Retain single-row move Undo in Review and migrate bulk tag actions to a fixed Sheet footer (#5, #14, #34).
5. Replace inert installation help with capability-specific guidance and clarify the distinction between classified and fully completed progress (#16, #37).

**platform-ui**

1. Stabilize same-path query navigation and restore meaningful focus on POP; test full route/screen compositions rather than mocked screens alone (#12, #44).
2. Give CopyButton local success/failure feedback and protect durable Undo/reload actions from toast replacement or six-second modal expiry (#1, #34, #45).
3. Finish Sheet consumer migration, keyboard/zoom geometry verification and the outer-hit-region/inner-label chip contract (#14, #38, #50).
4. Supply app/deck read-error recovery and consistent radio/filter/reduced-motion contracts (#24, #31, #33).
5. Consolidate contact formatters, type roles and state-bearing boundary tokens, then verify the missing light-mode and desktop states (#19, #29, #39–42).
