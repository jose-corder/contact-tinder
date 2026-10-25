# Contacts. — V6 final confirmation audit

**65 Fixed / 0 Partial / 0 Open / 0 new regressions.** The six remaining V5 findings, **#52, #61, #62, #63, #64 and #65**, are closed by the current implementation and covered tests; the other 59 retain their fixes. **I would not yet certify the live app as “state of the art” on this evidence alone:** this build has no fresh browser or physical-device observation. That is an evidence limit, not an additional defect or a reason to keep repaired findings open. The specified implementation work is complete. There are no remaining implementation gaps to rank as a top five; the five outstanding device-validation areas are listed separately below and excluded from the counts.

## Evidence and limits

Read `UI_AUDIT.md`, `UI_AUDIT_V2.md`, `UI_AUDIT_V3.md`, `UI_AUDIT_V4.md` and `UI_AUDIT_V5.md` first, then `DESIGN.md`, current source and relevant tests. No other Markdown files were read. This report is the only authored file. No server was started, dependencies installed, or source/test files edited.

**No fresh screenshots exist for this build. This is a code-and-test audit.** `qa-screens-v4/` exists; all eight historical composites were inspected: `02-import.jpg`, `07-deck-card.jpg`, `09-followup-sheet-prev-build.jpg`, `14-export.jpg`, `15-settings.jpg`, `16-review-work-tab.jpg`, `17-row-sheet-prev-build.jpg`, and `20-home-with-data.jpg`. Left frames are 390×844; right frames are 320×568, cropped at 568 px. These support the earlier hierarchy, complete short-screen rows and four action captions, not the latest geometry. The historical follow-up is Work; the row-sheet composite has no open sheet on its right side. There is no 09b or 16b file in this directory. Old visible labels such as Triage and Name-drop flex are not evidence that their current replacements failed.

Validation:

- `npm run typecheck` — **passed**.
- `npx vitest run --configLoader native --pool threads --maxWorkers 2` — **102 files, 638 tests passed**, exit code 0.
- Vitest emitted two “Not implemented: navigation to another Document” notices. These are environment limitations, not successful native-navigation observations or test failures.
- Browser scripts were not executed. JSDOM focus assertions, mocked viewport dimensions and observed `scrollIntoView` calls establish implementation behavior, not rendered visibility on a phone. No new browser reproduction is claimed.

**Fixed** means the reported implementation defect is addressed on this evidence. It does not mean every device or every possible future input has been certified. Evidence paths below are repository-relative and refer to the inspected current source. A dash in Remaining work means no further implementation change is required for that numbered finding.

## Status of all 65 findings

| # | Finding | Status | Current evidence | Remaining work |
|---|---|---|---|---|
| 1 | Selecting a backup immediately replaces the database | **Fixed** | `src/features/export/RestoreInput.tsx:62` creates a preview; :81 requires explicit commit; `src/export/recovery.ts:42` retains all unexpired snapshots. | — |
| 2 | Short-screen card cuts through a phone row | **Fixed** | `src/features/deck/CardFront.tsx:35` reserves essential rows and :39 removes optional rows as units; `src/features/deck/deck.css:53` and :59 let constrained cards grow. | — |
| 3 | Invisible Undo slot truncates decision captions | **Fixed** | `src/features/deck/ActionBar.tsx:17` uses four equal columns; `src/features/deck/DeckScreen.tsx:66` keeps Undo in the header; `deck.css:17` retains 48 px narrow-screen circles. | — |
| 4 | Follow-up actions disappear in nested scrollers | **Fixed** | `src/ui/Sheet.tsx:128` owns body scrolling; :50 relocates the same footer into that body when constrained; `FollowUpSheet.tsx:96` supplies shared actions. | — |
| 5 | Undo feedback overlaps controls and Review recovery is fleeting | **Fixed** | `src/features/deck/DeckScreen.tsx:131` uses an in-flow dock; `FollowUpSheet.tsx:110` provides modal-local Undo; `src/features/review/ReviewScreen.tsx:23` mounts durable RecoveryBar. | —; Review move recovery is retained across route changes in the current runtime, not promised across hard reload. |
| 6 | Re-swipe navigation erases classification before action | **Fixed** | `src/hooks/deckSession.ts:25` loads saved decisions for reclassification; `src/hooks/useDeck.ts:171` commits only on an action; `ReviewScreen.tsx:111` states that boundary. | — |
| 7 | Personal forces Friend / Family / Ex | **Fixed** | `src/domain/taxonomy.ts:195` saves type-only completion as Other; `FollowUpSheet.tsx:82` applies it on save; `src/export/vcf.ts:75` enumerates all relationships. | — |
| 8 | Delete's meaning arrives after the decision | **Fixed** | `src/features/home/HomeScreen.tsx:43` explains the phone-book boundary before sorting; `ReviewScreen.tsx:98` repeats it on Delete; `ExportScreen.tsx:52` explains duplicate/original-contact consequences. | —; native address-book writes are outside the web workflow. |
| 9 | Obsolete import UI buries the next required action | **Fixed** | `src/features/import/ImportScreen.tsx:30` names phases and :32 focuses them; :96 replaces the chooser; `ImportPreview.tsx:29` puts commit before optional details. | — |
| 10 | Selected status colors fail text contrast | **Fixed** | `src/ui/index.tsx:175` uses semantic on-tone colors; `tests/ui/contrast.test.ts:17` verifies selected text/notices in light, manual-dark and system-dark palettes. | — |
| 11 | Hit targets depend on which screen mounted the control | **Fixed** | `src/index.css:279` defines hit-44, :283 covers disclosures and :287 expands chip targets; shared controls use those contracts at `src/ui/index.tsx:64`, :105 and :141. | — |
| 12 | Routes lack focus/title/return-context handoff | **Fixed** | `src/App.tsx:47` updates titles; `src/ui/useRouteFocus.ts:43` handles PUSH/POP; `src/features/review/useReviewContext.ts:25` restores filters/paging and :52 restores contact-ID focus. | — |
| 13 | Accessible deck path loses focus and lacks copying | **Fixed** | `src/features/deck/DeckScreen.tsx:69` announces cards with stable ActiveDeck; `DeckEnd.tsx:62` focuses completion; `CardFields.tsx:12` supplies safe, copyable fields. | — |
| 14 | Small editable text and insufficient keyboard layout | **Fixed** | `src/index.css:285` sets 16 px coarse-pointer inputs; `src/ui/useSheetLayout.ts:28` detects capacity limits; `Sheet.tsx:50` moves footer actions into the single scroller. | —; actual keyboard geometry is external validation. |
| 15 | File extension invents the provider | **Fixed** | `src/import/sourceLabel.ts:4` uses neutral format labels and only PRODID provider evidence; `CardFront.tsx:63` and `ContactFields.tsx:38` share it. | — |
| 16 | Passes, Skip and Later lack a truthful promise | **Fixed** | `src/features/deck/ActionBar.tsx:24` exposes touch Skip help; `FollowUpSheet.tsx:123` explains Keep; `src/hooks/useDeck.ts:157` postpones from saved state and :159 retains session drafts. | — |
| 17 | Coach asks users to choose nonexistent triage types | **Fixed** | `src/features/deck/DeckCoach.tsx:9` supplies pass-specific instructions, :25 shares action glyphs and :27 provides explicit dismissal. | — |
| 18 | Small Fraunces text uses display optical size | **Fixed** | `src/index.css:208` enables optical sizing and :213 supplies text/small variants; `src/ui/index.tsx:211` chooses avatar variants by size. | — |
| 19 | All-fields labels truncate and dates remain raw | **Fixed** | `src/ui/FieldList.tsx:19` wraps labels/values; `src/ui/format.ts:4` handles ISO/compact dates; `ContactFields.tsx:38` formats metadata. | — |
| 20 | Quick actions are hidden and omit a destination | **Fixed** | `src/features/review/ReviewRow.tsx:113` exposes More; `QuickActions.tsx:7` enumerates every other destination for both visible menu and swipe reveal. | — |
| 21 | Search is buried and conceals its scope | **Fixed** | `src/features/review/ReviewScreen.tsx:84` puts scoped search before filters; `model.ts:10` normalizes accents and :15 handles phone digits. | — |
| 22 | Bulk selection crosses hidden scopes and recovery disappears | **Fixed** | `src/features/review/ReviewScreen.tsx:41` binds selection to scope; `BulkBar.tsx:80` names all results, :83 uses two columns and :61 registers independent recovery. | — |
| 23 | Administrative fields bury identity and editing | **Fixed** | `src/features/review/RowSheet.tsx:49` orders identity, classification, then fields; `ContactFields.tsx:10` exposes first phone/email before the collapsed dossier at :43. | — |
| 24 | Loading, empty and failure recovery is uneven | **Fixed** | `src/App.tsx:54` wraps routes in ErrorBoundary; `useDeck.ts:240` exposes Retry; `DeckEnd.tsx:65` gates completion; `ExportScreen.tsx:38` and `HomeScreen.tsx:47` provide read recovery. | — |
| 25 | Share silently becomes multiple downloads | **Fixed** | `src/features/export/ExportAction.tsx:58` packages files, :63 offers explicit fallback and :74 disables automatic fallback; `BulkBar.tsx:86` uses the same action. | —; native delivery remains a device check. |
| 26 | Export is an unguided inventory | **Fixed** | `src/features/export/ExportScreen.tsx:46` leads with clean export, :55 supplies the deletion checklist, :60 collapses alternatives and :84 sends backup/restore to Settings. | — |
| 27 | Deck-end summaries describe the wrong population | **Fixed** | `src/features/deck/DeckEnd.tsx:48` derives the session population, :86 labels it and :94 separates global counts; :74 selects an unfinished nonempty pass. | — |
| 28 | Redundant dashboard progress delays Continue | **Fixed** | `src/features/home/HomeScreen.tsx:50` places the resume action before progress at :68; `ProgressOverview.tsx:33` distinguishes classified from fully sorted. | — |
| 29 | Dark control boundaries disappear | **Fixed** | `src/index.css:44` and :74 retain stronger control/track tokens; `tests/ui/contrast.test.ts:25` checks 3:1 against both surfaces. | — |
| 30 | Classification hides behind dots and short accessible names | **Fixed** | `src/features/review/ReviewRow.tsx:49` builds textual classification, :52 builds the accessible identity and :105 renders status plus type/tag summaries. | — |
| 31 | Tabs and exclusive choices have inconsistent keyboard semantics | **Fixed** | `src/ui/RadioGroup.tsx:19` names groups and :28 handles keys/disabled options; `Segmented.tsx:24` links tabs to panels; `tests/review/routes.test.tsx` covers real-route arrows. | — |
| 32 | Stamp saturation/travel disagree with commit | **Fixed** | `src/features/deck/motion.ts:12` defines the shared 0.35 threshold; `swipeMath.ts:27` and :36 reuse it, :50 derives card-bound travel; stampHold remains 120 ms. | —; perceived motion is not established by static code. |
| 33 | Reduced motion differs across surfaces | **Fixed** | `src/features/review/ReviewRow.tsx:40` bypasses reveal animation and :44 reacts to preference changes; `src/ui/Sheet.tsx:114` uses shared motion policy and :116 disables drag. | — |
| 34 | Feedback is duplicated, misplaced or styled as failure | **Fixed** | `useImportAnnouncement.ts:19` throttles updates; `ExportAction.tsx:97` uses local tone; `useCopyFeedback.tsx:3` emits no toast; `toastStore.ts:39` exposes new high-priority actions immediately. | — |
| 35 | Duplicate handling is not inspectable after import | **Fixed** | `src/features/import/ImportPreview.tsx:27` leads with added count; `ImportScreen.tsx:102` links to live pairs; `src/import/index.ts:48` preserves earlier candidates. | — |
| 36 | Settings repeats technical restore prose and capability claims | **Fixed** | `src/features/home/SettingsScreen.tsx:43` reports unavailable haptics, :65 names next-use tips; `RestoreInput.tsx:71` reveals restore modes after preview. | — |
| 37 | Non-Safari iPhone installation guidance is generic | **Fixed** | `src/features/home/useInstallPrompt.ts:19` distinguishes iOS/Safari and :47 suppresses unsupported non-iOS help; `InstallRow.tsx:11` gives Share or Open in Safari guidance. | — |
| 38 | Landscape/safe-area layouts lack a capacity fallback | **Fixed** | `src/ui/useSheetLayout.ts:18` measures safe areas and :28 computes capacity; `Sheet.tsx:108` caps the panel; `deck.css:53` permits constrained growth/reflow. | —; physical safe-area behavior is separately unverified. |
| 39 | Type roles and portrait identity wrapping are inconsistent | **Fixed** | `src/features/deck/CardFront.tsx:36` uses measured identity allocation; `src/hooks/useIdentitySpace.ts:18` reserves essential rows and :27 allocates extra name/role lines. | —; the remaining 680 px threshold controls avatar arrangement, not name/role line count. |
| 40 | Desktop contributes only a phone frame | **Fixed** | `src/features/deck/DesktopContext.tsx:10` adds shortcuts, upcoming contacts and counts; `deck.css:66` provides a 440+240 px composition; Home/Review retain companion columns. | — |
| 41 | Editorial/technical labels obscure literal tasks | **Fixed** | `src/domain/taxonomy.ts:28` provides Notable contact and :76 Sort contacts; `SettingsScreen.tsx:79`/ :88 use Back up app data / Reset app; `tests/export/audit-v4.test.ts:76` protects export compatibility. | —; stored keys and historical CATEGORIES/CSV labels deliberately remain compatible. |
| 42 | Parallel primitives undermine consistency | **Fixed** | `CardFields.tsx:3` and `ContactFields.tsx:4` share the all-source reader; `CardFront.tsx:72` shares copy state; `src/ui/toast.tsx:34` reuses LabelDot. | — for the reported behavior; the unused comparison component is noted below without inventing a defect. |
| 43 | Decorative details lack truthful state feedback | **Fixed** | `src/features/deck/DeckEnd.tsx:83` gates SORTED on known completion; `src/ui/useCopyFeedback.tsx:24` supplies local success and `feedback.tsx:30` swaps to a check. | — |
| 44 | Review tab navigation remounts the page | **Fixed** | `src/App.tsx:52` keys by pathname; `src/ui/useRouteFocus.ts:73` ignores query-only changes; actual route tests preserve consecutive tab arrows. | — |
| 45 | CopyButton feedback disappears inside sheets | **Fixed** | `src/ui/useCopyFeedback.tsx:34` supplies local status and :35 selectable failure fallback; `feedback.tsx:28` keeps the retryable control inside the modal. | — |
| 46 | Review hides original/merged fields | **Fixed** | `src/import/rawFields.ts:48` reads every preserved source; `ContactFields.tsx:41` renders decoded extras and :46 exposes each original record. | — |
| 47 | SORTED celebrates skipped-out contacts | **Fixed** | `src/features/deck/DeckEnd.tsx:49` includes skipped and unfinished IDs; :83 requires nonempty complete scope; `tests/deck/audit-v4.test.tsx:33` covers repeated Personal skips without false completion. | — |
| 48 | Prepared exports become stale under fresh counts | **Fixed** | `src/features/export/ExportScreen.tsx:18` reads data/revision consistently; `ExportAction.tsx:46` invalidates retained files and :54/:60 checks before/after preparation; staleness tests pass. | — |
| 49 | Deck phone links lose extensions | **Fixed** | `src/features/review/safeLinks.ts:9` conservatively validates phone values and :13 preserves extensions; deck and Review both call it. | — |
| 50 | Chip hit-region CSS defeats text truncation | **Fixed** | `src/ui/index.tsx:178` isolates the inner label; `src/index.css:294` clips it while :287 preserves the outer hit region. | — |
| 51 | Other lacks a relationship-specific export | **Fixed** | `src/export/vcf.ts:75` enumerates authoritative relationship metadata; `tests/export/other.test.ts` covers Other with and without optional types. | — |
| 52 | Restore Undo erases intervening work without review | **Fixed** | `src/export/json.ts:128` includes stored pair state in restoreRevision; :173 requires current approval and :176 snapshots intervening state; `useRestoreRecovery.tsx:91` discloses duplicate-decision changes. | — |
| 53 | Later Keep is unfinished in storage but appears as Other | **Fixed** | `src/features/deck/FollowUpSheet.tsx:81` saves retained types/tags through normalization at :82 and explains Other at :123; `ReviewScreen.tsx:48` filters by saved relationship. | — |
| 54 | Duplicate review hides counterparts and leaks unrelated scopes | **Fixed** | `src/features/review/ReviewScreen.tsx:68` returns a separate pair workspace; `PairReview.tsx:20` searches/filters both members; ordinary selection and bulk controls are absent there. | — |
| 55 | Queued/timestamp-weak Review Undo overwrites later work | **Fixed** | `src/features/review/undo.ts:43` checks the full batch before any write; :51 saves exact snapshots with expected content/contact guards; :58 owns durable screen-independent recovery. | — |
| 56 | Restore history targets the wrong operation or silently evicts it | **Fixed** | `src/export/json.ts:161` resolves immutable IDs; `src/export/recovery.ts:42` prunes only expired entries; `tests/export/audit-v4.test.ts:47` covers retained history through rollback. | — |
| 57 | Wrapped feedback outgrows its toolbar slot | **Fixed** | `src/features/deck/DeckScreen.tsx:131` places ToastDock in flow; `src/ui/ToastDock.tsx:22` grows without shrinking; `src/ui/layout.css:11` bounds/wraps the message. | — |
| 58 | Duplicate Merge discards classifications without review/Undo | **Fixed** | `src/features/review/MergeSheet.tsx:40` shows both classifications and shared values; :54 requires a conflict choice; `src/import/merge.ts:60` guards comparison and :94 guards exact Undo. | — |
| 59 | Merging one pair deletes other unresolved comparisons | **Fixed** | `src/import/merge.ts:68` reads pairs before deletion; `src/import/remapPairs.ts:25` remaps endpoints and :39 preserves unresolved evidence; remap/reload/import tests pass. | — |
| 60 | Selecting a Personal type makes Skip complete it | **Fixed** | `src/hooks/useDeck.ts:157` skips from saved state, :159 keeps only the session draft and :171 uses exact persistence; `tests/deck/audit-v4.test.tsx:33` covers ordinary/scoped Skip and explicit completion. | — |
| 61 | Recovery rewrites historical snapshots or accepts reused timestamps | **Fixed** | `src/hooks/useUndo.ts:37` supplies exact written content; `src/db/repo.ts:111` compares it atomically and :115 checks existence; `useUndo.ts:50` drops stale entries without restoring the card. | — |
| 62 | Entering/leaving pair review destroys same-path focus | **Fixed** | `src/features/review/usePairModeFocus.ts:13` focuses the pair heading; :16 restores the duplicates control or selected tab; `tests/review/platform-v5.test.tsx:32` covers list return, browser Back and final-pair fallback. | — |
| 63 | Inserted confirmations are silent and potentially offscreen | **Fixed** | `src/ui/SheetConfirm.tsx:29` focuses the safe target, :33 requests nearest reveal and :39 restores the trigger on cancellation; both actual consumers supply trigger refs. | —; current-device visibility remains external validation. |
| 64 | Home Retry completes legacy Personal records as Other | **Fixed** | `src/features/home/HomeScreen.tsx:60` uses `resetSavedSkips`; `src/hooks/resetSkips.ts:12` reads/writes atomically with exact saves; `src/domain/decks.ts:5` changes only requested counters and update time. | — |
| 65 | Merge recovery disagrees between Review and Settings | **Fixed** | `src/features/import/useMergeRecovery.ts:15` hydrates persisted IDs/expiry/guards; `src/ui/recoveryStore.ts:77` reconciles merge entries; `src/import/merge.ts:116` removes completed runtime actions. | — |

## Final-wave acceptance review

### #52 — restore rollback includes duplicate-review state

The restore-specific revision now combines the contact/decision revision with canonical stored `possibleDuplicates` metadata (`src/export/json.ts:128`). Ordinary export revision remains independent of that metadata at :113. Both Replace and Merge save this revision through the same transaction at :144. Undo checks it and the recovery identity inside the write transaction, rejects outdated approval, and retains the intervening pair snapshot before replacement (:158–185).

`tests/export/pairs-v5.test.tsx:22` exercises pair-only Keep both/Dismiss changes, renewed approval, approved rollback and recovery of the intervening resolutions. Its mounted-preview test at :43 verifies the displayed duplicate-decision count and a second confirmation after another change. Those new pair-specific cases use Replace; Merge uses the same guarded rollback implementation, while the existing suite separately covers Merge restore/Undo. This is sufficient source/test closure, not a claim that the new test independently exercised both modes.

### #61 — exact historical recovery with a full-content deck guard

`src/db/repo.ts:57` includes all Decision fields in the canonical comparison, including skips, tags, optional classification and update time. Validation, contact existence, exact restoration and tag counts occur in the same transaction (:104–128). `useUndo.ts:37` supplies `writtenDecision`, :42 updates earlier matching entries after repeated swipes, and :59 accepts follow-up amendments. A conflict removes that contact's stale history and announces failure without invoking the queue-restoration callback (:47–52). A transient non-conflict error retains the entry for retry.

`tests/deck/audit-v5.test.tsx:24` reproduces a Merge restore with the swipe timestamp but different relation/types/tags and asserts unchanged persisted data, tags and queue, plus no returning-card state. The missing-contact case at :48 also refuses restoration. Existing Undo, follow-up and legacy snapshot cases remain green, including `tests/deck/audit-v4.test.tsx:101` and `tests/export/audit-v4.test.ts:17`. This closes the residual V5 failure without changing explicit completion semantics.

### #62 — pair-mode focus without breaking ordinary tabs

`ReviewScreen.tsx:35` owns the mode hook while the route remains mounted. The hook changes focus only when pair mode changes, captures list scroll, focuses the pair heading and restores the duplicates trigger or selected-tab fallback on exit (`usePairModeFocus.ts:7–18`). List search, filters and paging stay in `useReviewContext`; query-only tab changes still retain route nodes.

`tests/review/platform-v5.test.tsx:32` mounts actual AnimatedRoutes and checks activeElement, preserved search/status/type/tag filters and scroll on Back to list, browser Back and return after resolving the final pair. Existing consecutive-arrow route tests pass. The test scroll is simulated; no rendered-browser scroll claim is made.

### #63 — confirmation activation, reveal and cancellation

`SheetConfirm.tsx:27` focuses the cancel control or requested heading after insertion, invokes nearest scrolling, and supplies a polite title announcement. It restores the connected trigger after cancellation. Follow-up supplies its Later ref (`FollowUpSheet.tsx:122`); removal supplies its Remove ref (`RowSheet.tsx:66`). Follow-up now has a separate Cancel that preserves the draft, alongside Keep and Discard; busy fieldsets prevent conflicting choices during persistence.

`tests/ui/confirmation-v5.test.tsx:13` checks focus/reveal and reduced-motion behavior. Its actual RowSheet cases at :32 check activation, cancellation, failed-removal recovery and retry. `tests/deck/audit-v5.test.tsx:72` checks the actual follow-up handoff and :100 checks failed Keep with the draft and confirmation intact. These tests observe the component's own reveal request; they do not manually scroll the confirmation into position to manufacture a pass. They still cannot establish actual phone geometry.

### #64 — Retry is an administrative skip reset

Home and deck now share the exact-write helper. It reads current records inside a transaction, selects the intended counters, and preserves classification/types/tags; update time advances monotonically (`resetSkips.ts:12`, `domain/decks.ts:5`). Home chooses its destination from the returned reset rows, rather than inferring completion from the stale dashboard snapshot (`HomeScreen.tsx:60`).

`tests/home/audit-v5.test.tsx:27` covers restored legacy Personal/Neighbor: relation stays absent, the Personal deck is populated, progress stays incomplete and `personal-other.vcf` remains absent. Cases at :46, :69 and :100 cover mixed passes/newer data, transaction rollback after a partial attempted batch, retry, removed contacts and contacts completed before the operation. The deck-scoped helper is also checked at `tests/deck/audit-v5.test.tsx:60`.

### #65 — one persisted merge-recovery authority

Review mounts `useMergeRecovery` before branching into list/pair mode (`ReviewScreen.tsx:22`). Settings mounts the same hook and RecoveryBar through `MergeRecovery.tsx:6`. Hydration preserves original IDs/expiry, validates the affected contact/decision/pairs, removes absent merge entries, and leaves independent move recoveries alone. `undoMerge` and persistent dismissal remove runtime actions only after repository work succeeds (`merge.ts:116`, `export/json.ts:134`). Restore presentation now reads only `restoreEntries` (`useRestoreRecovery.tsx:5`), so merge history is not mislabeled as a backup restore.

`tests/review/platform-v5.test.tsx:73` merges through the mounted MergeSheet, removes runtime callbacks and remounts Review to prove rebinding and successful recovery. Cases at :92, :111 and :124 cover Settings Undo/Dismiss, failure/retry and expiration. `tests/ui/merge-hydration-v5.test.ts:5` checks metadata rehydration without renewing expiry or losing move recovery. This simulates reload state loss; it is not a literal browser hard-reload capture. Both presenters call the same advisory and transactional content guard (`src/import/merge.ts:120`).

## Grouped checks of previously Fixed findings

The requested original 47-item checkpoint was rechecked item by item using the current evidence above. All 47 are now Fixed, including #52, which regressed in V5 and is repaired here.

| Group | Findings checked | Result |
|---|---|---|
| Deck presentation, interaction and completion | #2, #3, #4, #6, #7, #13, #15, #17, #27, #32, #33, #40, #43, #47, #49, #53, #57 | All 17 retain essential rows/actions, safe reclassification, explicit completion, accessible details, motion contracts and truthful session feedback. |
| Review, Home and navigation | #8, #12, #20, #21, #22, #23, #28, #30, #31, #36, #37, #44, #46 | All 13 retain identity/editing order, scoped selection/search, visible labels, route context, radio/tab semantics and preserved-source access. |
| Import/export and recovery | #9, #25, #26, #35, #48, #51, #52 | All seven are Fixed; six retain their repairs and #52 now includes pair-only work in rollback review. |
| Shared presentation and feedback | #10, #11, #18, #19, #24, #29, #34, #42, #45, #50 | All ten retain contrast/hit-area/type, loading/recovery, local copy, priority and inner-label contracts. |

The earlier 14-item closing wave also remains closed: **#1, #5, #14, #16, #38, #39, #41, #54, #55, #56, #58, #59, #60 and #61**. #61 now has the full-content guard that prevented closure in V5. Together with the final-wave checks above, this accounts for all 65 IDs without silently dropping an earlier Partial.

## Shared-primitives and integration check

- **Sheet footer / SheetFooterActions / SheetConfirm:** Follow-up, row details, bulk move/tag, reset and the mounted MergeSheet use shared actions. Single-action Skip help and quick-action Cancel appropriately use Sheet.footer directly. Capacity fallback preserves the same footer host; confirmation activation now has its own focus/reveal handoff. No concrete new overlap or lost-choice path was identified from these integrations.
- **InlineNotice / LabelDot / CopyButton:** Operation errors remain local; the toaster shares LabelDot. Button and long-press copy share `useCopyFeedback`, including value-change invalidation, local success and selectable failure fallback. Copying inside a sheet does not wait for a hidden toast.
- **Toast priority and recovery:** New high-priority actions preempt; hover/focus/modal suppression pause expiry; deck dismissal uses notice identity. Review move recovery lives outside departing rows, while persisted merge recovery is hydrated on both surfaces. Review move recovery remains runtime-only; this pass does not expand its promise into durable cross-reload decision history.
- **Chip tone / inner label / hit-44 / type scale:** Semantic selections use on-tone foregrounds. The outer target and inner clipped label remain separate. The source scan found no numeric `text-[Npx]`, `text-xs` or `text-sm` classes under `src/features` or `src/ui`. Remaining numeric CSS defines the scale/geometry rather than screen-specific copies.
- **RadioGroup / routes / ErrorBoundary:** Settings, exclusive filters, bulk destinations and merge conflict choices use named radios. Import/Review retain tab/panel relationships and arrow behavior. Query changes preserve tab nodes; explicit pair-mode transitions now move focus. Route error boundaries remain in place alongside local asynchronous error handling.
- **Formatters / raw fields / completion / exports:** Deck and Review retain shared date/phone formatting, core safe links and the all-source raw reader. Later Keep persists its disclosed Other semantics; Skip/Retry do not infer completion. SORTED remains scope-gated. Other exports, ZIP delivery and prepared-file revision invalidation remain integrated.
- **Unused parallel component:** `src/features/import/MergeComparison.tsx:58` still defines a comparison sheet with body actions/native radios; the mounted Review path uses `src/features/review/MergeSheet.tsx:34`. This is unused parallel code, not a demonstrated user defect. Its isolated tests were not substituted for the mounted-route evidence above, and removing it is not added to the final fix scope.

## New findings

**None. No #66+ finding is warranted by the inspected paths.** No reproducible user-facing regression was established from this wave. Missing current screenshots, mocked layout measurements, unused component duplication and unobserved native behavior are not promoted into new numbered defects. This conclusion is bounded by the code/test scope above, not a claim that exhaustive browser testing occurred.

## Re-scored per-screen scorecard

Same ten screens and 1–10 scale; deltas compare with V5. These scores assess implementation and covered behavior. They do not turn historical composites into current visual evidence, and closure of all findings does not require a 10/10 score.

| Screen | V5 | V6 / 10 | Delta | Reason |
|---|---:|---:|---:|---|
| Home first-run | 8 | **8** | 0 | Import/Delete/install guidance retains its repairs; this wave does not change the first-run experience. |
| Home with data | 7 | **8** | +1 | Retry preserves legacy unfinished decisions and navigates to a populated pass without changing completion. |
| Import | 8 | **8** | 0 | Phase hierarchy and durable duplicate follow-through remain intact; no new import interaction was demonstrated. |
| Deck card | 8 | **9** | +1 | Undo now rejects same-timestamp replacement content while preserving exact historical decisions and failure retry. |
| Follow-up sheet | 7 | **8** | +1 | Later now reveals/focuses its confirmation and Cancel returns to the trigger without losing the draft. |
| Deck end | 8 | **8** | 0 | Session/global counts, retry and SORTED gating remain correct; this wave adds no separate completion improvement. |
| Review list | 7 | **8** | +1 | Pair entry/exit preserves meaningful focus/context, and persisted merge recovery agrees with Settings. |
| Row sheet | 8 | **9** | +1 | Removal confirmation gains focus/reveal/cancel continuity and retains accessible failure/retry alongside the repaired identity/raw-field order. |
| Export | 8 | **8** | 0 | ZIP, explicit fallback, source-revision checks and Other inventory retain their repairs. |
| Settings | 8 | **9** | +1 | Rollback now guards duplicate decisions and merge recovery shares authority, expiration and outcome with Review. |

## Needs a physical device

These are the five remaining **validation areas**, not five unresolved implementation findings. They are excluded from the open count and do not request another speculative code wave.

1. **Keyboard and viewport:** On iPhone, exercise deck tags and actual follow-up/removal confirmations with the software keyboard open; check the focused target, errors and every final action as the visual viewport changes.
2. **Safe areas and text enlargement:** Exercise portrait/landscape browser and standalone PWA layouts with larger text, long identities/tags and long recovery messages; inspect notch/home-indicator clearance and scrolling.
3. **Native export delivery:** Share a large prepared vCard and ZIP on iOS/Android, then cancel/fail sharing and deliberately download; verify activation and the receiving app/file contents.
4. **Assistive technology and clipboard permissions:** Use VoiceOver/TalkBack and a hardware keyboard through cards, tabs, pair mode, confirmations and recovery; verify spoken context and local copy success/denial feedback.
5. **Motion and platform presentation:** Inspect actual swipe/stamp/next-card timing, reduced-motion changes, haptics capability, installation guidance and light/dark standalone presentation.

**Native address-book deletion/replacement — Not fixable in web:** this PWA's supported browser integration does not provide native address-book write/delete access; it supplies export/checklist guidance instead. #8 is Fixed for explaining this boundary. No numbered finding is exempted or removed from the denominator.

## Next wave / Definition of done

No implementation fix wave remains within findings #1–#65, and no new numbered regression was established.

- **deck:** Nothing remains.
- **import-export:** Nothing remains.
- **review-home:** Nothing remains.
- **platform-ui:** Nothing remains.

The separate physical-device checks above are evidence gathering, not unclosed audit findings. No additional feature, stylistic redesign, cleanup-only task or native permission requirement is added to completion.

**Final verdict: 65 of 65 findings are Fixed. Nothing remains.**
