# Contacts. — UI audit V3

**A mobile-first reviewer would still not call this state of the art.** Of the original 43 findings, **26 are Fixed, 17 Partial, 0 Open**; of V2’s nine additions (#44–#52), **8 are Fixed, 1 Partial, 0 Open**. This pass finds **5 new regressions (#53–#57), all Open**: across all 57 findings the totals are **34 Fixed / 18 Partial / 5 Open**. The top five remaining gaps, ordered by impact, are **recovery actions that queue behind long-lived notices or target the wrong restore snapshot (#55–#56)**; **Personal completion that disagrees between saved state and Review (#7, #53)**; **duplicate review that hides counterparts and forgets unresolved candidates (#35, #54)**; **short-viewport and long-feedback layouts that still lack sufficient space guarantees (#14, #38, #57)**; and **merged original fields still missing from the reader (#46)**. The ordinary portrait sorting path is substantially more usable, but trustworthy recovery and agreement between screens remain below the bar.

## Evidence and limits

Read `UI_AUDIT.md` and `UI_AUDIT_V2.md` first, then `DESIGN.md`, current source and relevant tests. No other Markdown files were read. The design addendum’s description of shipped fixes is a claim checked against implementation, not evidence of completion by itself.

`qa-screens-v3/` exists and contains the ten supplied composites. References below use their filename prefixes: **02** Import; **07** deck; **09** follow-up at 390; **09b** follow-up at both sizes; **14** Export; **15** Settings; **16** Review Unsorted; **16b** quick actions; **17** row sheet; **20** returning Home. The left frame represents 390×844 and the right represents 320×568. Normal content below the cropped right viewport is not itself a defect. In **09**, **16b**, and **17**, the right frame does not show the left frame’s open sheet; only **09b** establishes the short follow-up sheet’s visible footer. These captures do not establish keyboard-open, landscape, large-text, light-mode, desktop, long-content, recovery, or animation behavior.

Validation: **`npm run typecheck` passed**. **`npx vitest run --configLoader native --pool threads --maxWorkers 2` passed: 73 files, 451 tests**. The first typecheck launch encountered Windows process-creation access denial; the subsequent permitted run completed successfully. No server was started, dependencies installed, or source/tests edited. This report is the only authored file. Tests establish covered logic and DOM behavior, not native sharing, actual viewport geometry, or assistive-technology speech. New findings below are source-derived paths, not claims of browser reproduction.

**Fixed** closes the reported defect on available evidence; it does not certify every device. **Partial** identifies a concrete residual problem. Existing deficiencies are kept under their original number; new numbers identify consequences of the latest fixes.

## Original findings #1–#43

| # | Original finding | Status | Current evidence | Remaining work |
|---|---|---|---|---|
| 1 | Selecting a backup immediately replaces the current database | **Partial** | `src/features/export/RestoreInput.tsx:62` previews before explicit commit at :81; `src/export/json.ts:97` compares content, and `src/features/export/useRestoreRecovery.tsx:68` exposes persistent Undo. | Bind recovery to the particular restore and correct the ten-minute promise for Merge, which creates no recovery snapshot and clears an existing one (#56). |
| 2 | The short-screen card cuts through a phone number instead of adapting | **Fixed** | **07**, right frame, preserves role, a full phone row, email, metadata and details; `src/features/deck/CardFront.tsx:36` retains essential rows and :41 supplies scrolling. | — |
| 3 | The action bar reserves space for invisible Undo and truncates the decision label | **Fixed** | **07** shows four complete captions; `src/features/deck/ActionBar.tsx:15` uses four columns and `src/features/deck/DeckScreen.tsx:64` places Undo in the header. | — |
| 4 | Follow-up actions scroll away inside nested sheet scrollers | **Fixed** | **09b**, right frame, shows a scrolling body above reachable Later/Done; `src/ui/Sheet.tsx:112` separates the body from the nonshrinking footer at :114. | — |
| 5 | Undo toast collides with both the deck controls and the modal | **Partial** | `src/features/deck/FollowUpSheet.tsx:116` keeps Undo inside the sheet; `src/features/deck/FeedbackSlot.tsx:26` reserves 44 px; `src/features/review/ReviewRow.tsx:60` extends single-row Undo to ten seconds. | Size feedback to its actual wrapped height and provide durable Review recovery instead of relying on an expiring, queued toast (#55, #57). |
| 6 | “Re-swipe these” silently erases classification before reclassification starts | **Fixed** | `src/hooks/deckSession.ts:29` loads saved decisions for reclassification, and `src/hooks/useDeck.ts:159` writes only on action; **16** explicitly says nothing changes until a swipe. | — |
| 7 | Personal classification forces a false Friend / Family / Ex choice | **Partial** | `src/features/review/ClassificationEditor.tsx:37` now shares `toggleDeckType`; `src/export/vcf.ts:75` includes Other, but `src/features/deck/FollowUpSheet.tsx:79` can save types without a relation. | Distinguish an unfinished type-only draft from saved Other consistently in Review, completion counts and exports (#53). |
| 8 | The meaning of Delete arrives after users have already acted | **Fixed** | **20** places the phone-book boundary before Continue, **14** places import caveats beside export, and `src/features/review/ReviewScreen.tsx:94` repeats the boundary on Delete. | — |
| 9 | Import keeps the obsolete upload screen above the next required action | **Fixed** | `src/features/import/ImportScreen.tsx:26` supplies phase-specific focused headings; `src/features/import/ImportPreview.tsx:29` now puts confirmation before collapsed merge/sample details. | — |
| 10 | Selected status colors fail text contrast despite healthy body tokens | **Fixed** | `src/ui/index.tsx:165` selects semantic foreground tokens; `tests/ui/contrast.test.ts:17` checks selected labels and inline text across light, manual-dark and system-dark palettes. | — |
| 11 | Tap-target compliance depends on which screen mounted the control | **Fixed** | Shared buttons/back/chips use global minima in `src/ui/index.tsx:55`, :95, :161 and `src/index.css:278`, :282, :286; the inner chip label preserves that repair. | — |
| 12 | Route transitions animate the page without moving or announcing focus | **Partial** | `src/App.tsx:52` keys by pathname; `src/ui/useRouteFocus.ts:43` restores PUSH/POP focus; `tests/review/routes.test.tsx` exercises real routes and pagination restoration. | Preserve Review’s search, filters and selected-contact identity on return, since `useReviewContext.ts:5` saves only tab/scroll/limit and structural focus selectors cannot identify a changed row reliably. |
| 13 | The accessible deck path is incomplete at card changes and copying | **Fixed** | `src/features/deck/DeckEnd.tsx:62` focuses completion after results load; `DeckScreen.tsx:67` announces cards and `CardFields.tsx:29` provides shared copy controls and safe links. | — |
| 14 | All text-entry paths use small input text and lack keyboard-aware layout | **Partial** | `src/index.css:284` enforces 16 px coarse-pointer inputs; `src/hooks/useDeckViewport.ts:17` enables keyboard scrolling; bulk tag now uses a fixed footer (`BulkBar.tsx:85`). | Extend the deck’s minimum-stage/scroll fallback beyond the detected keyboard state to short or enlarged-text viewports, then verify native keyboard and zoom geometry (#38). |
| 15 | The card invents the contact’s provider from its file extension | **Fixed** | `src/features/deck/CardFront.tsx:61` and `src/features/review/ContactDetails.tsx:24` use `sourceLabel`; **07** truthfully identifies samples as Demo. | — |
| 16 | Three passes, Skip, and Later are exposed as mechanics rather than a clear promise | **Partial** | **09b** explains status versus Later; `src/features/deck/FollowUpSheet.tsx:94` now offers Keep/Discard with visible scope, but the two-skip rule remains in `ActionBar.tsx:20` title/ARIA only. | Put the two-skip explanation in touch-accessible help and reconcile Later’s deliberately incomplete Personal types with Review’s completed-looking Other state (#53). |
| 17 | The coach instructs triage users to choose a type that does not exist | **Fixed** | `src/features/deck/DeckCoach.tsx:9` supplies pass-specific instructions and :24 reuses action icons with explicit Got it dismissal. | — |
| 18 | Fraunces uses display optical size on small text | **Fixed** | `src/index.css:206` enables optical sizing and reserves display opsz; `src/ui/index.tsx:201` selects small/text avatar variants. | — |
| 19 | “All fields” still truncates field labels and exposes raw timestamps | **Fixed** | `src/features/deck/CardFields.tsx:24` stacks labels; `src/ui/format.ts:4` handles ISO/compact dates, and Review imports the shared type/date/phone formatting. | — |
| 20 | Review quick actions are invisible and omit one destination for unclassified contacts | **Fixed** | **16b** shows Work, Personal and Delete; `src/features/review/QuickActions.tsx:7` enumerates all other destinations and `ReviewRow.tsx:115` exposes More. | — |
| 21 | Search sits below the filtering machinery and conceals its scope | **Fixed** | **16** shows “Search in Unsorted”; `src/features/review/ReviewScreen.tsx:79` puts search above filters and `src/features/review/model.ts` retains normalized name/phone matching. | — |
| 22 | Bulk selection crosses hidden scopes and its success state vanishes | **Fixed** | `src/features/review/ReviewScreen.tsx:38` binds selection to scope; `BulkBar.tsx:58` names all results, :61 uses two columns and :73 retains Undo last action. | — |
| 23 | Contact details put the useful editing controls beneath an administrative dossier | **Partial** | **17** shows editing controls before values and a stable footer; `src/features/review/ContactDetails.tsx:13` now keeps phone/email expanded, but `RowSheet.tsx:54` still puts the entire editor first. | Put a compact phone/email identity block before classification so existing Work/Personal records with many chips/tags can be identified without scrolling through the editor. |
| 24 | Loading, empty, and failure states are uneven and sometimes unrecoverable in place | **Fixed** | `src/hooks/useDeck.ts:225` offers Retry, `DeckEnd.tsx:65` gates completion on data and exposes read Retry, and `src/App.tsx:54` wraps all screen routes in `ErrorBoundary`. | — |
| 25 | Share-first can unexpectedly become a series of downloads | **Partial** | `src/features/export/ExportAction.tsx:45` offers explicit fallback and :77 discloses multiple files, but `src/features/review/BulkBar.tsx:67` still calls the automatic fallback helper. | Migrate bulk export to the explicit share/fallback contract and replace timed multi-download dispatch with an archive or individually initiated downloads; a 300 ms delay is not per-file consent or proof of delivery. |
| 26 | Export is a long inventory of implementation formats, not a guided finish | **Fixed** | **14** leads with clean export and deletion checklist; `src/features/export/ExportScreen.tsx:60` collapses alternatives, explains overlap first, and :82 links to Settings instead of embedding restore. | — |
| 27 | Deck-end summaries can describe a different population from the completed queue | **Fixed** | `src/features/deck/DeckEnd.tsx:48` computes session results, :86 labels them, :94 explicitly labels global counts, and :74 selects a nonempty unfinished pass. | — |
| 28 | The dashboard delays Continue with redundant progress displays | **Fixed** | **20** keeps Continue ahead of progress and list counts; `src/features/home/HomeScreen.tsx:48` and `ProgressOverview.tsx:33` distinguish classified from fully sorted. | — |
| 29 | Dark structural boundaries are almost indistinguishable from their surfaces | **Fixed** | `src/index.css:13`, :43 and :73 strengthen control/track tokens; `tests/ui/contrast.test.ts:25` verifies at least 3:1 on both surfaces in all three palettes; Restore now uses `border-control`. | — |
| 30 | Review labels disappear behind 6 px dots and overly short accessible names | **Fixed** | `src/features/review/ReviewRow.tsx:53` names organization/classification; :107 shows textual list/status and :108 shows two additional labels plus an overflow count. | — |
| 31 | Tabs implement inconsistent keyboard and accessibility contracts | **Fixed** | Settings and filters use named `RadioGroup` (`SettingsScreen.tsx:37`, `Filters.tsx:18`); Import and Review use shared `Segmented` with panel IDs, and real-route consecutive-arrow tests pass. | — |
| 32 | Motion parameters largely match, but stamp timing and travel feel are not tuned as a whole | **Partial** | `src/features/deck/swipeMath.ts:50` now derives travel from card dimensions, but `src/features/deck/motion.ts:12` still saturates the stamp at 70% of commit distance. | Align stamp saturation with the actual commit threshold or explicitly revise the contract, then validate the handoff in motion rather than asserting polish from a test that preserves 0.7. |
| 33 | Reduced motion is treated inconsistently across interaction surfaces | **Fixed** | `src/features/review/ReviewRow.tsx:40` removes animated reveal travel and :43 reacts to preference changes; routes/sheets/next-card use the shared policy. | — |
| 34 | Feedback is duplicated, misplaced, and inconsistently styled as an error | **Partial** | `src/features/import/useImportAnnouncement.ts:19` throttles counts; Export/Restore use local `InlineNotice`; `src/ui/toast.tsx:33` preserves actions but queues them FIFO. | Give urgent recoveries an immediately reachable surface, expire or reconcile stale callbacks, and remove the separate toast-only long-press copy path (#55). |
| 35 | Import previews counts without making duplicate handling inspectable | **Partial** | `src/import/index.ts:42` persists candidate IDs and `ImportScreen.tsx:98` links to Review, but `ReviewScreen.tsx:41` restricts the candidates to one bucket. | Provide durable pair-level review across lists, including counterpart identity/reason and unresolved candidates from earlier imports (#54). |
| 36 | Settings is dominated by duplicated restore prose and technical controls | **Fixed** | **15** shows concise preference sections; `src/features/home/SettingsScreen.tsx:42` handles unsupported haptics, :64 names the tips behavior, and restore modes appear only after file selection. | — |
| 37 | Installation guidance is correctly special-cased for Safari but generic elsewhere on iPhone | **Partial** | `src/features/home/useInstallPrompt.ts:45` hides unsupported non-iOS help; `InstallRow.tsx:11` still gives every iOS browser exactly the same Share instruction. | Add a capability-appropriate fallback when the current iOS browser/container has no usable installation path instead of treating the OS predicate as proof of support. |
| 38 | Safe-area support is good in the frame but incomplete in landscape overlays | **Partial** | `src/ui/Sheet.tsx:99` and `BulkBar.tsx:55` respect side insets; `src/features/deck/deck.css:39` adds landscape layout, but only :33 gives the keyboard-open stage a minimum height. | Make the whole deck scroll or reflow when the fixed header/chip/feedback/action stack exceeds available height; landscape columns alone do not prevent a zero-height stage under short-height or text enlargement. |
| 39 | The type hierarchy mixes display styles and diagnostic text without a stable reading scale | **Partial** | The source scan finds no remaining numeric `text-[Npx]` or `text-xs`/`text-sm` in `src/features`/`src/ui`; `CardFront.tsx:46` allows roomy names, but :48 still truncates roles whenever stage height is below 680. | Use actual available room for two-line role/organization identity on tall portrait cards instead of retaining the compact-role truncation rule. |
| 40 | Desktop faithfully reproduces the mobile frame but contributes nothing extra | **Partial** | `HomeScreen.tsx:47` and `ReviewScreen.tsx:117` provide desktop context; `src/features/deck/DeckScreen.tsx:61` retains a single Frame with no adjacent workspace. | Add restrained desktop deck context/shortcuts and verify it visually; this remains an enhancement beyond the original 440 px design contract. |
| 41 | Editorial copy is repeated where literal task guidance would work harder | **Partial** | Import now says Sort contacts and follow-up keeps a stable Done label, but **07/09b/15** retain Triage, Name-drop flex, Back up (.json) and Danger zone. | Complete the literal action/state copy, especially unfinished Personal details and the scope of restore recovery, with any taxonomy-label change coordinated across exports. |
| 42 | Parallel implementations of the same pattern undermine polish | **Partial** | Shared footers, radios, tones and formatters are broadly adopted, but `src/features/deck/CardFields.tsx:35` and `src/features/review/rawFields.ts:15` remain separate readers, and `SwipeCard.tsx:31` retains local copying. | Consolidate the raw-field reader over all preserved records and finish the copy/toast contracts without duplicating their state handling. |
| 43 | The distinctive details emphasize decoration more than useful state changes | **Fixed** | `src/features/deck/DeckEnd.tsx:83` gates the completion seal and `src/ui/feedback.tsx:43` acknowledges copying locally; these implement two of the original optional finishing touches. | — |

### Shared-primitives integration check

- **Sheet/footer:** Follow-up, row details, reset, bulk move and bulk tag now use fixed footers and `SheetFooterActions`. QuickActions uses `Sheet.footer` with a single Cancel button, appropriately avoiding a fabricated primary action. **09b** validates the ordinary 320 px follow-up footer. The global descendant overflow override remains at `src/index.css:285`; it is not evidence that expanded confirmations or software-keyboard layouts fit.
- **InlineNotice and CopyButton:** Import, ExportAction, Restore and the main screen errors now share notices. CopyButton owns success, failure and retry, invalidates pending responses when its value changes, and works inside the modal. Deck long-press copying still uses its own toast-only implementation (`SwipeCard.tsx:31`); high-priority notices can delay its result. Do not describe all copy paths as consolidated.
- **LabelDot and Chip tone:** Main list/menu/home/end consumers use LabelDot and semantic chip tones. The toaster retains its own tone-to-color map and dot (`src/ui/toast.tsx:65`, :92). The new `.chip-label` clips inside an outer hit region (`src/index.css:293`); the original overflow conflict is fixed. Long-content rendered geometry is still unverified.
- **Hit areas and type roles:** Named type classes replace the identified ad-hoc numeric sizes throughout features/UI. The remaining literal sizes in CSS define the scale or specific stamp/eyebrow roles; they are not a missed screen migration. Global 44 px control contracts and 16 px coarse-pointer editable text remain present. Font/role adoption does not resolve the separate fixed-height layout defects.
- **RadioGroup, boundaries and formatters:** Named radios now cover appearance, exclusive filters and bulk destinations, with arrow navigation and disabled-option skipping. ErrorBoundary covers route content; it does not catch event-handler or arbitrary asynchronous errors, so explicit operation recovery remains necessary. Date/phone formatting and safe call/email links are shared; Review still imports `friendlyType` from a deck module, and raw field formatting differs between surfaces.

## New findings

### V2 additions rechecked: #44–#52

The following retain their V2 numbers and original severities. They are not counted as new V3 regressions.

### 44. Review’s new tab keyboard behavior is undone by route remounting

**Status:** Fixed · **Severity:** High · **Dimensions:** D, E, G  
**Evidence:** `src/App.tsx:52` keys the page by pathname; `src/ui/useRouteFocus.ts:73` ignores query-only changes. `tests/review/routes.test.tsx` now tests consecutive arrows through real AnimatedRoutes/Review and POP pagination/scroll restoration.  
**Experience now:** Tab nodes survive query replacement and consecutive arrows remain in the tab sequence.  
**Fix / remaining:** None for the remount defect; incomplete return context remains under #12.

### 45. Shared CopyButton feedback disappears inside the sheet that contains it

**Status:** Fixed · **Severity:** Medium · **Dimensions:** D, F, G  
**Evidence:** `src/ui/feedback.tsx:43` sets local Copied, :45 sets Copy failed, :48 provides a local status region and :50 exposes selectable fallback text; `tests/ui/platform-contracts.test.tsx:9` covers copying inside Sheet.  
**Experience now:** Feedback appears without closing the modal; failure can be retried on the same control.  
**Fix / remaining:** None for CopyButton; the separate long-press path is covered by #34/#42.

### 46. Reordered Review details remove access to preserved original fields

**Status:** Partial · **Severity:** Medium · **Dimensions:** E, F, I  
**Evidence:** `src/features/review/ContactDetails.tsx:28` reads only `contact.raw`, and :34 exposes only that original record; `src/import/metadata.ts:12` exposes additional `rawCards`, used by export at `src/export/vcardLines.ts:63`.  
**Experience:** A birthday, website or address in the primary raw card is readable again. A field stored only in a merged secondary source remains absent from both the readable view and original-record fallback, even though export preserves it. The new test at `tests/review/audit-v2.test.tsx:21` places an `X-MERGED-CUSTOM` property in the primary string; it does not test the actual `rawCards` representation.  
**Fix / remaining:** Read all preserved source cards through one decoded, deduplicated field reader shared with the deck, with explicit access to each source record.

### 47. The new SORTED seal celebrates contacts that were skipped out

**Status:** Fixed · **Severity:** Medium · **Dimensions:** D, F  
**Evidence:** `src/features/deck/DeckEnd.tsx:49` derives remaining session IDs, :57 chooses Pass finished, :65 waits for data and :83 requires a nonempty complete session for the seal. `tests/deck/reaudit.test.tsx:53` and :73 cover ordinary and scoped repeated skips.  
**Experience now:** Skipped-out sessions show outstanding work and retry; they no longer receive the seal.  
**Fix / remaining:** None for the reported false completion state; completion is pass-scoped, not a claim that all subsequent passes are finished.

### 48. A prepared export can silently become stale while its displayed counts update

**Status:** Fixed · **Severity:** High · **Dimensions:** E, F  
**Evidence:** `src/features/export/ExportScreen.tsx:18` reads rows/revision together; `ExportAction.tsx:29` invalidates ready artifacts and :37/:43 rechecks around preparation; `tests/export/staleness.test.tsx` covers changed classifications, later imports and preparation races.  
**Experience now:** A changed database removes the ready action and requires regeneration instead of sending the old clean set under new counts.  
**Fix / remaining:** None for retained-file staleness; actual large-file share activation remains unverified, especially because the ready action still awaits database reads.

### 49. New deck telephone links discard extension semantics

**Status:** Fixed · **Severity:** Medium · **Dimensions:** E, F, I  
**Evidence:** `src/features/deck/CardFields.tsx:13` now calls the same `phoneHref` as Review; `src/features/review/safeLinks.ts:13` preserves supported `;ext=` values even when e164 exists.  
**Experience now:** Supported extensions survive the dial target; unsupported values remain text with copying available.  
**Fix / remaining:** None for the reported link discrepancy.

### 50. Global chip hit-area styling defeats the deck’s text truncation

**Status:** Fixed · **Severity:** Medium · **Dimensions:** A, B, G, I  
**Evidence:** `src/ui/index.tsx:168` puts the label in its own span; `src/index.css:293` clips/ellipsizes that span while :286 preserves outer hit-area overflow.  
**Experience now:** The outer hit region no longer overrides label clipping.  
**Fix / remaining:** None for the CSS cascade conflict; the long-tag tests inspect structure/CSS, not actual mobile rendering.

### 51. Other is a completed Personal relationship with no corresponding export list

**Status:** Fixed · **Severity:** Medium · **Dimensions:** E, F, I  
**Evidence:** `src/export/vcf.ts:75` enumerates authoritative relationship metadata, including Other; `tests/export/other.test.ts` covers the new group.  
**Experience now:** Explicitly saved Other contacts have a relationship-specific export.  
**Fix / remaining:** None for explicit Other; inferred Other on unfinished saved drafts is a different new integration defect (#53).

### 52. Restore Undo can erase work performed after the restore

**Status:** Fixed · **Severity:** High · **Dimensions:** E, F  
**Evidence:** `src/export/json.ts:147` compares current content revision, :149 returns a conflict preview, :152 retains newer data before approved rollback, and :157 makes it recoverable; `tests/export/recovery.test.ts:27` and :47 cover intervening work and edits after review.  
**Experience now:** For one restore, subsequent edits require rollback review; another edit invalidates that approval, and approved rollback preserves the newer snapshot.  
**Fix / remaining:** None for the original intervening-edit scenario; multiple restores and existing toast identity are not covered by that revision guard (#56).

### Fresh regressions: #53–#57

### 53. Later → Keep produces unfinished Personal contacts that Review presents as Other

**Status:** Open · **Severity:** High · **Dimensions:** E, F, I  
**Evidence:** `src/features/deck/FollowUpSheet.tsx:79` intentionally saves types/tags with the original relation; `tests/deck/reaudit.test.tsx:106` verifies relation remains undefined. `src/features/review/ReviewRow.tsx:48`, `ReviewScreen.tsx:45` and `ClassificationEditor.tsx:32` infer Other for presentation/filtering, whereas `src/features/home/progress.ts:11`, `src/domain/taxonomy.ts:120` and `src/export/vcf.ts:76` require a persisted relation.  
**Experience:** Classify Personal, choose Neighbor, then Later → Keep. Review says “Personal · Other,” the Other filter includes the contact, and the editor displays Other selected. Home still counts it unfinished, the Personal deck still includes it, and Personal · Other export excludes it. Closing Review with Done merely closes the sheet; saving an unrelated tag can silently persist Other through `RowSheet.tsx:25`. The latest wave has introduced two meanings of the same selected state.  
**Fix:** Represent incomplete details explicitly. Either retain the deliberate unfinished Later state and show “Relationship pending” everywhere until completion, or deliberately persist Other and update the Later promise; make rows, editor, membership, counts and exports derive from the same saved semantics.

### 54. The duplicate-review destination hides counterparts and loses unresolved work

**Status:** Open · **Severity:** Medium · **Dimensions:** E, F  
**Evidence:** `src/features/import/ImportScreen.tsx:98` always links to `tab=unsorted&dupes=1`; `ReviewScreen.tsx:27` flattens pairs to IDs and :41 filters by bucket first; :75 clears filters when changing tabs. `src/import/index.ts:42` replaces the stored candidate array on every successful import, including an empty result.  
**Experience:** Import a conflicting contact sharing details with an existing Work contact. The “Review possible duplicates” link shows the new Unsorted record but hides its Work counterpart. Switching to Work clears the duplicate filter; the row does not name the counterpart or why it was flagged. Import an unrelated file next and the previous unresolved review set disappears. The banner counts pairs while the list counts contacts, including stale pairs whose members were removed.  
**Fix:** Use a cross-list pair review with both identities, shared-evidence reason, accurate live counts and explicit resolution/dismissal; retain unresolved pairs across imports instead of overwriting them.

### 55. Toast priority retains recovery actions but can make them inaccessible or stale

**Status:** Open · **Severity:** High · **Dimensions:** D, E, F, G  
**Evidence:** `src/ui/toast.tsx:33` queues any new high-priority notice behind the current one and :40 advances FIFO; `src/features/export/useRestoreRecovery.tsx:44` occupies the current slot for ten minutes. `ReviewRow.tsx:60` relies on that queue for single-row Undo and :61 writes its captured decision without a revision check. `tests/ui/toast.test.tsx:108` explicitly verifies queueing behind the current notice.  
**Experience:** Restore, navigate directly to Review, then move a contact. Its only Undo can sit behind the restore notice for almost ten minutes, while the row has already vanished from the current tab. When the old action finally appears, its original decision snapshot can overwrite newer edits. Low-priority copy feedback and update notices can also wait behind the long-lived action. This is action retention without timely access or validity.  
**Fix:** Keep long-duration restore recovery in a persistent screen-level control, prioritize or expose newer actions immediately, and bind each Undo to the version it reverses; show a conflict rather than applying an obsolete snapshot. Dismiss notices by identity rather than letting deck code remove whichever global notice happens to be current.

### 56. Restore recovery controls are not bound to the restore they describe

**Status:** Open · **Severity:** High · **Dimensions:** E, F  
**Evidence:** `src/features/export/useRestoreRecovery.tsx:44` creates an Undo callback without a restore ID; `src/export/json.ts:131` overwrites the sole `restoreUndo` entry, and :141 always reads that latest entry. The same line stores null for Merge, while `src/features/home/SettingsScreen.tsx:82` promises ten-minute Undo for replacing or merging.  
**Experience:** Restore backup A, then backup B before A’s toast expires. A’s still-visible Undo acts on B’s snapshot; it cannot recover the state before A. If the second operation is Merge, A’s remaining Undo reports expired because Merge cleared its snapshot even within ten minutes. The persistent button improves discoverability but does not identify which operation remains recoverable. The content-revision check in #52 cannot detect that the intended recovery record itself was replaced.  
**Fix:** Assign restore/recovery IDs and bind both notices and rollback approvals to them; retain a bounded recovery history or clearly supersede the old operation before replacing it. Either provide Merge recovery or accurately scope the promise and preserve an earlier valid snapshot when merging.

### 57. The new fixed feedback slot overlaps the toolbar when a toast wraps beyond two lines

**Status:** Open · **Severity:** Medium · **Dimensions:** B, D, G  
**Evidence:** `src/features/deck/FeedbackSlot.tsx:26` reserves exactly 44 px; `src/features/deck/deck.css:37` translates the toast down by its own height to align its top with that slot. `src/ui/toast.tsx:93` allows unconstrained wrapped text, while `DeckScreen.tsx:52` accepts an unbounded first-name token. The toolbar immediately follows the slot (`DeckScreen.tsx:126`).  
**Experience:** A long unbroken first name or longer queued recovery message at 320 px can require three or more 18 px text lines. The toast grows beyond the reserved 44 px and paints downward over the decision controls. The positioning test at `tests/deck/reaudit.test.tsx:189` checks the offset and fixed class, not rendered message height. The supplied screenshots show no visible long toast and cannot disprove this layout path.  
**Fix:** Measure the actual active feedback height and reserve it in flow, or use a bounded in-flow feedback component that retains readable text and an accessible action; test long names, larger text and queued recovery messages at 320 px.

## Re-scored per-screen scorecard

Same ten screens and 1–10 scale as both prior audits. Delta is against V2; the first score is retained for traceability. Scores include current code paths and their limitations, not just the supplied successful screenshot states.

| Screen | V1 | V2 | V3 / 10 | Delta vs V2 | Reason for change |
|---|---:|---:|---:|---:|---|
| Home first-run | 6 | 7 | 7 | 0 | Practical import/privacy guidance remains; no fresh first-run capture and the iOS installation fallback is still generic. |
| Home with data | 6 | 7 | 7 | 0 | Continue stays prominent and unsupported generic installation UI is gone, but unfinished Personal records can still look completed in Review while Home disagrees. |
| Import | 5 | 6 | 7 | +1 | Phase naming and confirmation-before-details now work; the new duplicate destination is incomplete and unresolved candidates are not durable. |
| Deck card | 4 | 7 | 7 | 0 | Completion focus, shared links and inner chip labels close defects, but fixed feedback height, enlarged-text geometry and hidden touch help prevent another point. |
| Follow-up sheet | 4 | 7 | 7 | 0 | **09b** verifies the short-screen footer and Keep/Discard explains saved scope; that path now creates contradictory Personal completion state. |
| Deck end | 5 | 6 | 8 | +2 | Completion waits for data, focuses a durable heading, handles errors and gates SORTED on the actual session with explicit retry. |
| Review list | 5 | 6 | 7 | +1 | Real-route arrow navigation, visible label summaries and correct filter radios improve control; duplicate scope, return context and queued Undo remain weak. |
| Row sheet | 4 | 6 | 7 | +1 | Phone/email are expanded and copy feedback is local; identity values still follow the full editor and merged secondary records remain inaccessible. |
| Export | 5 | 6 | 8 | +2 | Prepared artifacts invalidate against data revisions, Other has a list and Settings owns restore; sequential multi-downloads and native share timing still limit the finish. |
| Settings | 5 | 7 | 7 | 0 | Radio semantics and conflict-aware persistent recovery improve the single-restore case, but multiple-restore identity and the Merge recovery promise remain unsafe. |

**20** showing “38 to go,” “1 classified,” and “0 fully sorted” is not an arithmetic regression: a Work contact without status is classified but incomplete. The new Personal issue in #53 is different: Review invents a completed relationship while the stored decision and downstream calculations still omit it.

## Next wave

Items are ordered by impact within each owner.

**deck**

1. Agree with review-home on explicit unfinished Personal semantics; preserve Later’s promise without displaying a saved Other that does not exist (#7, #16, #53).
2. Replace the fixed 44 px toast assumption with measured/in-flow feedback and protect controls under long messages (#5, #57).
3. Add an overflow fallback for short-height and enlarged-text layouts; verify keyboard-open, portrait and landscape on actual devices (#14, #38).
4. Make Skip help available to touch users, allow roomy role/org lines, and align stamp saturation with commit (#16, #32, #39).
5. Add useful desktop context only after the mobile geometry and recovery paths are sound (#40).

**import-export**

1. Bind restore, Undo and rollback approval to immutable recovery IDs; preserve or explicitly supersede older snapshots and fix Merge’s recovery promise (#1, #56).
2. Preserve unresolved duplicate pairs across imports and coordinate a cross-list review destination with review-home (#35, #54).
3. Use one explicit sharing/fallback flow for bulk export and replace timer-driven multiple downloads with an archive or deliberate file actions (#25).
4. Verify prepared-file sharing under real native activation timing and large address books; preserve the repaired revision checks (#48).

**review-home**

1. Remove inferred saved Other from incomplete Personal rows/filters, or persist completion through an explicit shared transition (#53).
2. Provide immediate durable single-row Undo with expected-version checks; do not restore old decisions after newer edits (#5, #55).
3. Implement duplicate-pair comparison with both counterparts, reasons and durable resolution (#54).
4. Place compact contact values before the editor and read all merged source records; preserve search/filter/selected-row context on return (#12, #23, #46).
5. Finish capability-specific install fallback and literal Settings/state copy (#37, #41).

**platform-ui**

1. Replace FIFO-only recovery scheduling with immediate access, identity-based dismissal and validity checks, coordinating persistent recovery ownership (#34, #55–#56).
2. Supply measured feedback geometry and a shared constrained-viewport fallback; validate expanded confirmations and text scaling, not just class names (#14, #38, #57).
3. Consolidate all-source raw readers and long-press/copy feedback so each surface exposes the same information and acknowledgement (#42, #46).
4. Preserve semantic focus identity and screen context across Back, including data changes and filtered lists (#12).
