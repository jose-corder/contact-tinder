# Contacts. — fifth audit / closing verification

**No: a mobile-first reviewer would not yet call this state of the art.** Of the **61 existing findings, 59 are Fixed, 2 Partial, and 0 Open**; this pass adds **4 new findings, #62–#65, all Open**. The closing wave resolves **13 of its 14 assigned items**; #61 retains an unsafe deck recovery path. Of the **47 previously Fixed items, 46 retain that status and #52 regresses** because restore rollback now replaces duplicate-review metadata without checking it. Across all 65 findings: **59 Fixed / 2 Partial / 4 Open**. The top five remaining gaps are **timestamp-only deck Undo (#61)**, **unreviewed loss of duplicate resolutions during restore Undo (#52)**, **Home Retry completing legacy Personal records (#64)**, **disagreeing merge-recovery surfaces (#65)**, and **missing focus/visibility handoffs in pair review and expanded confirmations (#62–#63)**. These are implementable web defects; no numbered item is exempt from completion as “Not fixable in web.”

## Evidence and limits

Read `UI_AUDIT.md`, `UI_AUDIT_V2.md`, `UI_AUDIT_V3.md`, and `UI_AUDIT_V4.md` before inspecting `DESIGN.md`, current source and tests. No other Markdown files were read. This report is the only authored file. No dependencies were installed and no server was started; the existing `.gitignore` modification was left intact.

**There are no fresh screenshots for this build; this closing verification is based on code and tests.** Inspected all eight historical composites in `qa-screens-v4/`: `02-import.jpg`, `07-deck-card.jpg`, `09-followup-sheet-prev-build.jpg`, `14-export.jpg`, `15-settings.jpg`, `16-review-work-tab.jpg`, `17-row-sheet-prev-build.jpg`, and `20-home-with-data.jpg`. Their left frames are 390×844 and their right frames 320×568, cropped at 568 px. They establish earlier hierarchy and layout only. In particular, 09 shows the earlier Work sheet, and 17's right frame contains no open row sheet. They cannot validate this wave's measured identity, constrained footer, comparison or confirmation layouts. No other screenshot directory is treated as current-build evidence.

Validation completed:

- `npm run typecheck` — **passed**. The initial PowerShell launch failed at process creation with access denied; the permitted command succeeded through `cmd.exe`.
- `npx vitest run --configLoader native --pool threads --maxWorkers 2` — **96 files / 611 tests passed**.
- The standalone browser scripts under `tests/**` were read where relevant but **not run**. They are not included in the 611-test result. Several layout tests mock rectangles, visualViewport or motion; passing them establishes branching and DOM structure, not rendered mobile geometry.

**Fixed** means the reported behavior is repaired on the available source/test evidence. It does not certify actual iPhone keyboard, native share, assistive-technology speech or motion quality. **Partial** means concrete required behavior remains defective. New findings below are source-derived paths, not claimed browser reproductions. Missing screenshots alone do not keep an otherwise repaired implementation Partial.

## All existing findings #1–#61

Paths are relative to the repository root. Evidence refers to the current source; test references name coverage actually included in the passing suite unless explicitly described otherwise.

| # | Finding | Status | Evidence | Remaining work |
|---|---|---|---|---|
| 1 | Selecting a backup immediately replaces the database | **Fixed** | `src/features/export/RestoreInput.tsx:61` previews; :80 requires explicit commit; `src/export/recovery.ts:42` retains every unexpired snapshot; `tests/export/audit-v4.test.ts:47` exercises twelve restores. | —; the separate intervening-work guard is #52. |
| 2 | Short-screen card cuts through a phone row | **Fixed** | `src/features/deck/CardFront.tsx:35` reserves essential rows; `src/features/deck/deck.css:47` supplies the stage floor and :59 lets constrained faces grow; historical 07 shows complete row heights. | — |
| 3 | Invisible Undo slot truncates decision captions | **Fixed** | `src/features/deck/ActionBar.tsx:17` keeps four equal columns; `src/features/deck/DeckScreen.tsx:66` places Undo in the header; `deck.css:17` retains 48 px narrow-screen circles. | — |
| 4 | Follow-up actions disappear in nested scrollers | **Fixed** | `src/ui/Sheet.tsx:128` owns the body scroller; :50 moves the same footer host into it only when constrained; `FollowUpSheet.tsx:95` supplies shared actions. | —; newly inserted confirmation focus is #63. |
| 5 | Undo toast overlaps controls and Review recovery is fleeting | **Fixed** | `DeckScreen.tsx:131` uses an in-flow dock; `FollowUpSheet.tsx:109` has local Undo; `ReviewScreen.tsx:77` mounts RecoveryBar; `tests/review/recovery-v4.test.tsx:29` covers 11 seconds, tab/remount and failed-first-attempt retry. | —; Review decision callbacks persist for this tab's runtime, not through a hard reload. |
| 6 | Re-swipe navigation erases classification | **Fixed** | `src/features/review/reswipe.ts:8` writes only scope; `src/hooks/deckSession.ts:29` loads saved classifications; `src/hooks/useDeck.ts:171` writes on action. | — |
| 7 | Personal forces Friend / Family / Ex | **Fixed** | `src/domain/taxonomy.ts:195` completes selected types as Other; `FollowUpSheet.tsx:81` and `RowSheet.tsx:28` normalize explicit saves; `src/export/vcf.ts:75` includes Other. | —; incidental completion from Home Retry is #64. |
| 8 | Delete's meaning arrives too late | **Fixed** | `HomeScreen.tsx:42` explains the boundary before sorting; `ReviewScreen.tsx:92` repeats it on Delete; `ExportScreen.tsx:51` places destination caveats beside export. | — |
| 9 | Obsolete import UI buries the next action | **Fixed** | `ImportScreen.tsx:30` names phases, :32 focuses the new heading and :96 replaces the chooser; `ImportPreview.tsx:29` puts confirmation before optional details. | — |
| 10 | Selected status colors fail text contrast | **Fixed** | `src/ui/index.tsx:174` applies on-tone foregrounds; `tests/ui/contrast.test.ts:17` checks selected text and notices against light/manual-dark/system-dark tokens. | — |
| 11 | Hit targets depend on the mounted screen | **Fixed** | `src/index.css:279` defines global hit-44; :283 covers disclosures; :287 expands chips; shared Back/Button/IconButton use it at `src/ui/index.tsx:64`, :104, :140. | — |
| 12 | Routes lack focus/title/return-context handoff | **Fixed** | `src/App.tsx:47` updates titles; `useRouteFocus.ts:43` handles PUSH/POP; `useReviewContext.ts:25` restores filters and :52 focuses the saved contact ID; actual route tests cover Back. | — for pathname navigation; the new same-path pair workspace needs its own handoff (#62). |
| 13 | Accessible deck path loses focus and lacks copying | **Fixed** | `DeckScreen.tsx:69` announces new cards while ActiveDeck remains mounted; `DeckEnd.tsx:62` focuses completion; `CardFields.tsx:12` supplies safe links and copyable fields. | — |
| 14 | Small editable text and insufficient keyboard layout | **Fixed** | `src/index.css:285` enforces 16 px coarse-pointer inputs; `useSheetLayout.ts:28` detects insufficient capacity; `Sheet.tsx:50` puts actions in the scroller; follow-up/removal confirmations now occupy the body. | — for capacity; #63 covers discovering/focusing the newly inserted controls. Real-device keyboard geometry remains unverified. |
| 15 | File extension invents a provider | **Fixed** | `src/import/sourceLabel.ts:4` uses neutral format labels unless PRODID supplies evidence; `CardFront.tsx:63` and `ContactFields.tsx:38` share it. | — |
| 16 | Skip/Later/pass promises are unclear or contradictory | **Fixed** | `KeyboardLegend.tsx:1` explains the two-skip rule and retained session drafts; `ActionBar.tsx:24` exposes touch help; `FollowUpSheet.tsx:123` explains Keep/Discard; `useDeck.ts:157` skips from saved state. | — for these actions; Home Retry is separately #64. |
| 17 | Coach asks triage users to select nonexistent types | **Fixed** | `DeckCoach.tsx:9` has pass-specific instructions; :25 reuses action icons and :27 requires an explicit Got it dismissal. | — |
| 18 | Small Fraunces text uses display optical size | **Fixed** | `src/index.css:207` enables optical sizing and :213 defines text/small roles; `src/ui/index.tsx:210` chooses avatar roles by rendered size. | — |
| 19 | All-fields labels truncate and dates remain raw | **Fixed** | `src/ui/FieldList.tsx:19` wraps labels/values; `src/ui/format.ts:4` formats ISO/compact dates; `ContactFields.tsx:38` uses it for metadata. | — |
| 20 | Quick actions are hidden and omit a destination | **Fixed** | `ReviewRow.tsx:113` exposes More; `QuickActions.tsx:7` enumerates all other destinations for both menu and reveal. | — |
| 21 | Search is buried and conceals its scope | **Fixed** | `ReviewScreen.tsx:78` places named search above filters; `model.ts:10` normalizes accents and :15 handles phone digits. | — |
| 22 | Bulk selection crosses hidden scopes and recovery disappears | **Fixed** | `ReviewScreen.tsx:35` binds selection to scope; `BulkBar.tsx:80` names all results, :83 uses two columns and :61 registers independent recovery; the bulk tab-change test passes. | — |
| 23 | Administrative details bury identity and editing | **Fixed** | `RowSheet.tsx:48` orders ContactIdentity, ClassificationEditor, ContactFields; `ContactFields.tsx:10` keeps first phone/email visible and :43 collapses the dossier. | — |
| 24 | Loading/empty/failure recovery is uneven | **Fixed** | `src/App.tsx:54` wraps routes in ErrorBoundary; `useDeck.ts:240` exposes Retry; `DeckEnd.tsx:65` gates completion on data; Home/Review/Export retain explicit read-error branches. | —; event-handler errors still require their existing local catches. |
| 25 | Share silently becomes multiple downloads | **Fixed** | `ExportAction.tsx:58` packages files, :63 exposes explicit fallback and :74 disables silent fallback; `BulkBar.tsx:86` uses that action; `src/export/zip.ts:62` returns one archive. | —; native share activation after revision reads remains unverified, not a demonstrated new failure. |
| 26 | Export is an unguided inventory | **Fixed** | `ExportScreen.tsx:46` leads with clean export, :55 provides the deletion checklist, :60 collapses alternatives and :84 links to Settings for backup/restore. | — |
| 27 | Deck-end counts describe the wrong population | **Fixed** | `DeckEnd.tsx:48` derives the session population, :86 names it and :94 distinguishes global pass counts; :74 selects a nonempty unfinished pass. | — |
| 28 | Redundant dashboard progress delays Continue | **Fixed** | `HomeScreen.tsx:49` places Continue before `ProgressOverview` at :71; `ProgressOverview.tsx:33` distinguishes classified from fully sorted. | —; Retry's semantics are #64, not a hierarchy regression. |
| 29 | Dark control boundaries disappear | **Fixed** | `src/index.css:44` and :74 retain stronger control/track tokens; `tests/ui/contrast.test.ts:25` checks at least 3:1 against both surfaces. | — |
| 30 | Classification is hidden behind dots and short accessible names | **Fixed** | `ReviewRow.tsx:49` builds textual classification, :52 builds the accessible identity and :105–108 renders status plus type/tag summaries. | — |
| 31 | Tabs and exclusive controls have inconsistent keyboard semantics | **Fixed** | `src/ui/RadioGroup.tsx:19` provides named groups and disabled-option skipping; `Segmented.tsx:24` links tabs/panels and handles arrows; `tests/review/routes.test.tsx:16` exercises consecutive arrows through real routes. | — |
| 32 | Stamp saturation/travel disagree with commit | **Fixed** | `motion.ts:12`, `swipeMath.ts:27` and :36 share the 0.35 threshold; :50 derives travel from card dimensions; `motion.ts:11` keeps the 120 ms stamp phase. | —; no current motion capture supports a stronger polish claim. |
| 33 | Reduced motion differs across surfaces | **Fixed** | `ReviewRow.tsx:40` bypasses animated reveals and :44 stops active motion on preference change; `Sheet.tsx:114` shares the motion policy and :116 disables drag under reduced motion. | — |
| 34 | Feedback is duplicated, misplaced or styled as failure | **Fixed** | `useImportAnnouncement.ts:19` throttles announcements; `ExportAction.tsx:97` uses local tone; `useCopyFeedback.tsx:3` emits no global toast; `toastStore.ts:39` preempts with newer high-priority notices. | —; recovery state disagreement is #65. |
| 35 | Possible duplicates cannot be inspected after import | **Fixed** | `ImportPreview.tsx:27` leads with added count; `ImportScreen.tsx:102` links to live pairs; `src/import/index.ts:48` preserves earlier candidates across unrelated imports. | — |
| 36 | Settings repeats technical restore prose and capability claims | **Fixed** | `SettingsScreen.tsx:43` handles unavailable haptics, :65 says Show tips next time and :79 says Back up app data; `RestoreInput.tsx:70` reveals restore modes only after preview. | — |
| 37 | Non-Safari iPhone install guidance is generic | **Fixed** | `useInstallPrompt.ts:19` distinguishes iOS/Safari and :47 hides unsupported non-iOS rows; `InstallRow.tsx:11` supplies Share or Open in Safari guidance. | — |
| 38 | Landscape/safe-area layouts lack a capacity fallback | **Fixed** | `useSheetLayout.ts:18` measures safe areas and :28 compares content capacity; `Sheet.tsx:108` caps the panel and :50 relocates its footer; `deck.css:53` lets the constrained deck grow. | —; mocked viewport tests cover the fallback, not actual device rendering. |
| 39 | Type roles and portrait identity wrapping are inconsistent | **Fixed** | `CardFront.tsx:36` uses `useIdentitySpace`; that hook's :18 reserves essential rows and :27 allocates name/role lines from measured remaining height; `tests/deck/audit-v3.test.tsx:87` changes body space independently of stage size. | —; 680 px still controls avatar arrangement, but no longer determines the identity's line count. |
| 40 | Desktop is only a phone frame | **Fixed** | `DesktopContext.tsx:10` adds shortcuts, upcoming names and counts; `deck.css:66` supplies the 440+240 px composition; existing Home/Review companion layouts remain. | — |
| 41 | Editorial/technical labels obscure literal tasks | **Fixed** | `taxonomy.ts:28` adds Notable contact as uiLabel and :76 uses Sort contacts; `SettingsScreen.tsx:79`/ :88 use Back up app data / Reset app; `tests/export/audit-v4.test.ts:76` verifies deliberate stable export labels/filenames. | —; stored keys and existing CATEGORIES/CSV vocabulary remain compatible, while screen descriptions use uiLabel. |
| 42 | Parallel primitives undermine consistency | **Fixed** | `CardFields.tsx:3` and `ContactFields.tsx:4` share the all-source reader; `CardFront.tsx:72` shares copy state; `src/ui/toast.tsx:34` reuses LabelDot. | — for the reported raw-field/copy/control duplication; new recovery duplication is #65. |
| 43 | Decorative touches lack truthful state feedback | **Fixed** | `DeckEnd.tsx:83` gates SORTED on known complete scope; `useCopyFeedback.tsx:24` gives local success; `feedback.tsx:30` swaps the glyph for a check. | — |
| 44 | Review tab navigation remounts the page | **Fixed** | `src/App.tsx:52` keys by pathname and `useRouteFocus.ts:73` ignores query-only replacements; real consecutive-arrow tests pass. | —; this behavior must remain while adding the explicit workspace handoff in #62. |
| 45 | CopyButton feedback disappears in sheets | **Fixed** | `useCopyFeedback.tsx:34` supplies local status and :35 selectable failure fallback; `feedback.tsx:28` retains the retryable button inside the modal. | — |
| 46 | Review hides original/merged fields | **Fixed** | `src/import/rawFields.ts:48` iterates every preserved source; `ContactFields.tsx:41` renders decoded extras and :46 exposes each original record; secondary-rawCards tests pass. | — |
| 47 | SORTED celebrates skipped-out contacts | **Fixed** | `DeckEnd.tsx:49` includes both unfinished and skipped session IDs; :83 requires a nonempty complete scope; `tests/deck/audit-v4.test.tsx:59` rejects SORTED after repeated Personal skips. | —; Home Retry's separate completion mutation is #64. |
| 48 | Prepared exports become stale under fresh counts | **Fixed** | `ExportScreen.tsx:18` reads data/revision together; `ExportAction.tsx:46` invalidates retained artifacts and :54/:60 rechecks around preparation; staleness tests pass. | — |
| 49 | Deck phone links lose extensions | **Fixed** | `CardFields.tsx:13` and `ContactFields.tsx:34` share `phoneHref`; `tests/review/safeLinks.test.tsx` covers extensions and unsupported-value rejection. | — |
| 50 | Chip hit-region CSS defeats truncation | **Fixed** | `src/ui/index.tsx:177` isolates `.chip-label`; `src/index.css:294` clips it while :287 preserves the outer hit region. | — |
| 51 | Other lacks its relationship export | **Fixed** | `src/export/vcf.ts:75` enumerates authoritative relation metadata; `tests/export/other.test.ts` covers Other with and without types. | — |
| 52 | Restore Undo erases intervening work without review | **Partial — regressed** | `src/export/json.ts:103` explicitly excludes metadata from its revision, but :156 now restores saved pairs; `src/import/duplicates.ts:74` changes resolutions only in metadata. | In `src/export/json.ts` and `useRestoreRecovery.tsx`, bind rollback approval to a restore-specific revision including duplicate-pair state and show pair changes in its preview; accept Restore → Keep both/Dismiss → Undo only after review, invalidate approval after another resolution, and retain the newer pair snapshot for recovery. |
| 53 | Later Keep is unfinished in storage but appears as Other | **Fixed** | `FollowUpSheet.tsx:80` deliberately saves types/tags through normalization, :123 discloses Other; `ReviewScreen.tsx:42` and `ClassificationEditor.tsx:32` derive relationships only from saved state. | — |
| 54 | Duplicate review hides counterparts and unrelated scopes leak in | **Fixed** | `ReviewScreen.tsx:62` returns a distinct PairReview; `PairReview.tsx:20` searches/filters both members; `tests/review/pairs-v4.test.tsx` rejects ordinary selection, Sort again and unrelated rows in pair mode. | — for scope; its new navigation focus issue is #62. |
| 55 | Queued or timestamp-weak Review recovery overwrites later work | **Fixed** | `src/features/review/undo.ts:43` compares the full batch before any exact write; :58 registers independent recovery; `tests/review/recovery-v4.test.tsx:70` rejects Merge restores reusing updatedAt. | — for row/bulk recovery; the deck has not adopted the same protection (#61). |
| 56 | Restore history targets the wrong operation or silently evicts it | **Fixed** | `src/export/json.ts:138` resolves an immutable ID; `src/export/recovery.ts:42` prunes only expired entries; `tests/export/audit-v4.test.ts:47` retains twelve recoveries through reviewed rollback. | — |
| 57 | Wrapped feedback outgrows its toolbar slot | **Fixed** | `DeckScreen.tsx:131` puts the toast in flow before actions; `ToastDock.tsx:22` grows without shrinking; `src/ui/layout.css:11` wraps/clamps long messages. | — |
| 58 | Duplicate Merge discards conflicting classifications without review/Undo | **Fixed** | `MergeSheet.tsx:40` shows both saved classifications and shared values; :54 requires a conflict choice; `src/import/merge.ts:59` rejects stale comparison and :93 guards exact Undo; Settings mounts persisted MergeRecovery via `RestoreInput.tsx:45`. | — for reviewed, reversible merge; cross-surface recovery agreement remains #65. |
| 59 | Merging a pair deletes other unresolved comparisons | **Fixed** | `src/import/merge.ts:67` reads candidates before deletion; `remapPairs.ts:25` rewrites endpoints and :39 preserves unresolved evidence; `tests/import/remapPairs.test.ts:20` covers A/B → A/C through reload/unrelated import. | — |
| 60 | Selecting a Personal type makes Skip complete it | **Fixed** | `src/hooks/useDeck.ts:157` skips from the saved decision, :159 retains only a session draft and :171 uses exact persistence; `tests/deck/audit-v4.test.tsx:33` covers ordinary/scoped first Skip, second Skip and explicit Done. | —; #64 concerns the separate Home retry command on preserved legacy data. |
| 61 | Recovery normalizes historical snapshots instead of restoring them | **Partial** | `repo.ts:231`, `review/undo.ts:51`, `import/merge.ts:114` and `useUndo.ts:37` now write exact semantics; deck Undo still validates only updatedAt, which `restoreAll` now preserves exactly. | In `src/hooks/useUndo.ts`, `src/hooks/deckSession.ts` and `src/db/repo.ts`, atomically require contact existence and the complete expected written decision before restoring; accept a same-timestamp Merge restore followed by deck Undo only as a detected conflict, with no changed tags/decision/queue success, while genuine legacy Undo still restores unfinished membership. |

## Closing-wave result and grouped regression checks

The 14 assigned items are individually statused above. **Fixed:** #1, #5, #14, #16, #38, #39, #41, #54, #55, #56, #58, #59, #60. **Partial:** #61. Exact historical classification restoration passes its covered tests; the remaining requirement is safe validation in the deck consumer, not another normalization rewrite.

Every previously Fixed item was spot-checked against its current evidence line, grouped below. This is not a blanket claim that all 47 remained Fixed.

| Group | Previously Fixed IDs checked | Result |
|---|---|---|
| Deck presentation, interaction and completion | #2, #3, #4, #6, #7, #13, #15, #17, #27, #32, #33, #40, #43, #47, #49, #53, #57 | All 17 retain their reported fixes: essential rows/actions, navigation-only reclassification, explicit Other, focus at completion, motion contracts, safe links, Later Keep and in-flow feedback. |
| Review, Home and navigation | #8, #12, #20, #21, #22, #23, #28, #30, #31, #36, #37, #44, #46 | All 13 retain the original repaired behavior; pair-workspace navigation and Home Retry are new paths identified separately below. |
| Import/export and recovery | #9, #25, #26, #35, #48, #51, #52 | Six retain their fixes; **#52 is Partial** because the rollback's new pair-state write lies outside its revision/approval guard. |
| Shared presentation and feedback | #10, #11, #18, #19, #24, #29, #34, #42, #45, #50 | All 10 retain their original repaired contracts; the new shared confirmation and recovery integrations need the fixes below. |

## Shared-primitives integration check

- **Sheet / SheetFooterActions / SheetConfirm:** Follow-up, row details, bulk move/tag, reset and the mounted MergeSheet use the shared footer. A measured constrained path relocates the same footer host into the single scroller and preserves footer state/focus while moving it. Expanded follow-up/removal confirmations are now body content. However, **creating** a confirmation does not focus or reveal it (#63); moving an already focused footer is a different operation. The browser QA script manually calls `scrollIntoView` on candidates, so even a future passing run of that script would not establish automatic confirmation discovery.
- **InlineNotice / LabelDot / CopyButton / toast:** Local errors and copy outcomes remain local; long press shares `useCopyFeedback`; stale copy responses are invalidated on value changes. Toasts pause while focused/hovered, preempt by priority, and use ID dismissal. Review recovery is reachable after toast expiry and transient failure. There are now two independent merge-recovery presentations, backed by different stores (#65).
- **Chip tone / inner label / hit-44 / type scale:** Semantic chips use on-tone colors; inner clipping no longer fights the outer hit region. The source scan found **no numeric `text-[Npx]`, `text-xs` or `text-sm` classes in `src/features` or `src/ui`**. Remaining numeric CSS sizes define the scale or component geometry. Measured name/role allocation replaces the old truncation threshold without weakening hit targets.
- **RadioGroup / routes / ErrorBoundary:** Mounted MergeSheet joins Settings/Filters/Bulk in using the named RadioGroup. Native labeled restore radios remain valid controls. Same-path tab nodes remain stable; the new replacement of the entire list by PairReview needs explicit mode focus (#62). Route boundaries still cover render failures, while operations retain their own catches.
- **Formatters / raw fields:** Shared dates, core phone/email links and the all-source raw reader remain integrated. Original merged records remain accessible below classification. No new raw-reader regression was identified.
- **Completion / recovery / exports:** Skip no longer saves draft types or infers Other; Done and Later Keep still do. Restore, merge and Review Undo preserve legacy semantics. Home Retry was missed when distinguishing completing writes from administrative writes (#64). Prepared export invalidation and the Other inventory remain intact.
- **Local copies:** `src/features/import/MergeComparison.tsx:30` is a parallel comparison component, referenced by its own tests, while the live Review route uses `src/features/review/MergeSheet.tsx:8`. The former keeps actions in the body and uses native radios; the latter uses shared footer/radios. Do not count tests of the unused component as coverage of the mounted sheet. Consolidating these copies is advisable when addressing #65, but is not counted as another user-facing defect by itself.

## Remaining existing failures — reproducible acceptance cases

### #52 — rollback ignores duplicate-review work

**Severity:** High · **Owner:** import-export · **Status:** Partial, regressed.

Restore a backup while an unresolved A/B pair exists, then choose Keep both or Dismiss for that pair. `savePairResolution` writes only `possibleDuplicates` metadata. Neither `dbRevision()` nor `latestId` changes. `undoRestore` therefore takes the no-conflict branch and replaces the pair array with the pre-restore snapshot. The user's explicit resolution is lost without review. Even an already-open conflict approval remains valid after another pair-only edit.

**Required change:** Add a restore-specific state revision over every state rollback replaces, including canonical pair metadata, inside the existing transaction. Do not make ordinary export invalidation depend on irrelevant pair resolutions merely to reuse one function. Store the post-restore pair revision, include it in rollback approval, disclose changed pair/resolution counts in `useRestoreRecovery.tsx`, and snapshot intervening pair state before approved rollback.

**Acceptance:** For both Replace and Merge restore, seed A/B, restore, resolve A/B without changing contacts or decisions, and request Undo: require a preview. Change a resolution again after preview: require a fresh approval. Approve and undo the rollback: restore the intervening resolutions exactly. Existing contact/decision conflict and retention tests must remain green.

### #61 — deck Undo still accepts a reused timestamp

**Severity:** High · **Owner:** deck, with platform-ui · **Status:** Partial.

`useUndo.ts:37` supplies only `expectedUpdatedAt`. `deckSession.ts:12` checks existence, and `repo.ts:89` checks the timestamp, but neither compares the expected decision's content. A Merge restore can replace the just-swiped decision with different tags/classification while retaining that timestamp. Deck Undo then overwrites it and reports success. Review's complete-content guard at `review/undo.ts:43` demonstrates the stronger contract, but the deck does not use it.

**Required change:** Extend the repository/deck save contract with an expected decision snapshot or a mutation version that restore cannot reuse; validate it atomically with existence and exact restoration. Supply `entry.writtenDecision` from `useUndo`, including amendments after follow-up. On conflict preserve newer data and reconcile/discard the stale undo entry without inserting a falsely restored card.

**Acceptance:** Swipe a saved legacy Personal/type-only record, Merge-restore different content using the swipe's updatedAt, then invoke deck Undo without relying on visibility events: the newer decision and tags must survive and no success restoration may enter the queue. Also retain coverage for repeated swipes of one contact, follow-up amendments, transient failure retry and exact legacy relation/skips/export membership restoration.

## New findings

### 62. Entering and leaving the duplicate workspace destroys focus on a same-path transition

**Status:** Open · **Severity:** Medium · **Dimensions:** D, E, G · **Owner:** review-home.

**Evidence:** `src/features/review/ReviewScreen.tsx:62` replaces the normal tree with PairReview; :85–86 changes only query parameters. `src/ui/useRouteFocus.ts:73` deliberately ignores those changes. `src/features/review/PairReview.tsx:25` has an unfocusable heading and :27 returns through another same-path link; the component has no focus handoff. `tests/review/pairs-v4.test.tsx` checks returned content and selection, not activeElement.

**Experience:** Activate Possible duplicates from the keyboard. Its focused chip and the tab tree unmount, without a replacement focus target. Back to list removes its own focused link in the same way. Preserving tab nodes fixed ordinary tab arrows, but does not handle replacing the whole workspace under the same route.

**Fix:** In `ReviewScreen.tsx`/`PairReview.tsx`, track entry/exit of pair mode separately from ordinary tab query changes. Focus a `tabIndex={-1}` pair heading or pair search on entry; restore the Possible duplicates control on exit, falling back to the selected tab if all pairs have been resolved. Preserve the ordinary list's filter/scroll context.

**Acceptance:** Through real AnimatedRoutes, keyboard-activate Possible duplicates and assert focus enters pair mode; return by its link and by browser Back and assert a connected meaningful focus target and restored list context. Resolve the final pair before returning and test the fallback. Keep consecutive ordinary tab arrows stable without page remounting.

### 63. Moving confirmations into the body makes their appearance silent and potentially offscreen

**Status:** Open · **Severity:** Medium · **Dimensions:** B, E, G, H · **Owner:** platform-ui, with deck/review-home.

**Evidence:** `FollowUpSheet.tsx:48` only sets confirmLater; its confirmation is appended at :121 while Later remains in the footer at :96. `RowSheet.tsx:45` sets confirm and disables the triggering button; confirmation appears after the editor/raw fields at :64. `src/ui/SheetConfirm.tsx:18` renders a plain group with no focus, live announcement or reveal behavior. Sheet's initial focus effect at `Sheet.tsx:59` runs only on mount.

**Experience:** With the body at the top or a long editor expanded, Later or Remove from app inserts the required Keep/Discard or removal controls farther down the body without taking the user there. Keyboard focus remains on Later, or on a button that has just become disabled. The footer can still show Done while the requested confirmation is out of view. This is a discovery/focus regression caused by relocating the confirmation, not evidence that the new scroller cannot hold it.

**Fix:** Give SheetConfirm an explicit mount/activation handoff: focus its heading or safe cancel action and reveal that element within the sheet body using nearest scrolling and reduced-motion-compatible behavior. Restore the trigger after cancellation where it remains connected. In each consumer, ensure pending confirmation and failure states retain a clear keyboard path to both choices; do not depend on a global page scroll or a second dialog.

**Acceptance:** Open actual follow-up and row sheets with overflowing content, position their body at the top, focus/activate Later or Remove from app, and assert focus moves into the new confirmation. At 320×568 with a 240 px visual viewport, and 568×320 with enlarged text, its focused control must be in view and both choices reachable. Cancel returns focus appropriately; failed Keep/removal retains reachable error and retry. A test that manually scrolls the confirmation into view before asserting visibility does not close this finding.

### 64. Home's Retry skipped still turns preserved legacy Personal records into completed Other

**Status:** Open · **Severity:** High · **Dimensions:** E, F · **Owner:** review-home.

**Evidence:** `src/features/home/HomeScreen.tsx:60` resets skips using ordinary `saveDecisions` without `{ exact: true }`; `src/db/repo.ts:85` consequently calls `normalizeDecision`, which infers Other at `taxonomy.ts:196`. The equivalent deck retry was fixed to use exact writes at `src/hooks/deckSession.ts:55`. Restore now preserves the legacy input at `repo.ts:231`.

**Experience:** Restore a legacy Personal/Neighbor record with no relationship and personal skips = 2. With no other pending deck, Home offers Retry skipped. That action clears its skips but also saves Other, raising completion and adding it to the Other export before any classification choice. Navigation can land on an empty Personal deck. The exact-restore fix makes this legitimate unfinished state available again, but Home's retry path still completes it incidentally.

**Fix:** In `HomeScreen.tsx`, perform skip resets through an atomic exact-write helper using current saved records, preserving every classification/type/tag and changing only the intended skip counters plus a monotonic update version. Share the deck retry semantics where practical; do not normalize completion during retry.

**Acceptance:** Restore the legacy Personal/Neighbor/skips=2 fixture, render Home and activate Retry skipped. Assert relation remains absent, types/tags remain identical, personal skips become zero, the card is actually available in the Personal deck, overall completion does not rise, and `personal-other.vcf` remains absent. A later explicit Done may save Other. Cover mixed Work/Personal skipped records and a failed batch with no partial resets.

### 65. Merge recovery disagrees between Review and Settings after reload or recovery elsewhere

**Status:** Open · **Severity:** Medium · **Dimensions:** D, E, F, I · **Owner:** review-home, with import-export/platform-ui.

**Evidence:** `PossibleDuplicates.tsx:10` registers a callback in the runtime recovery store. `src/ui/recoveryStore.ts:26` persists only metadata; :48 reloads it with `available: false`. `RecoveryBar.tsx:74` therefore displays Undo unavailable. Review/PairReview do not rebind merge entries from IndexedDB. Meanwhile, `RestoreInput.tsx:45` mounts `MergeRecovery`, which reads persisted entries and can undo them at `MergeRecovery.tsx:23`; that success does not remove the corresponding runtime recovery-store entry.

**Experience:** Merge A/B and reload Review within the promised ten minutes: Review says Undo unavailable even though Settings can still undo that exact merge. There is no link explaining the alternate recovery route. Conversely, undo in Settings and return to Review in the same runtime: the old “Merged A and B” action can remain until clicked, then become “Changed since,” although it was successfully undone. The database snapshot is retained; the two UI owners disagree about its availability and outcome.

**Fix:** Make persisted merge recovery IDs/state authoritative for both surfaces. Rehydrate Review callbacks from unexpired repository entries with their original expiry and content guards, and remove or mark completed entries everywhere after successful Undo/Dismiss. Either share one recovery presenter or explicitly direct an unavailable Review entry to the identified Settings recovery; never imply the recovery is gone while an actionable copy exists elsewhere. Keep unrelated Review move recoveries separate from merge hydration.

**Acceptance:** Merge via the actual pair route, hard-reload within ten minutes, and recover from Review or an explicit linked recovery path without hunting through Settings. Undo in Settings and navigate back: no enabled or misleading stale merge recovery remains. Later contact edits produce a consistent conflict state on both surfaces; expiration and storage failure produce truthful retry/expiry behavior. Test the mounted MergeSheet route, not only the unused MergeComparison component.

## Re-scored per-screen scorecard

Same ten screens and 1–10 scale. Deltas compare with V4. Scores reflect source/test findings; historical screenshots do not certify changed geometry.

| Screen | V4 | V5 / 10 | Delta | Reason |
|---|---:|---:|---:|---|
| Home first-run | 8 | **8** | 0 | Practical import/delete/install guidance remains; this wave adds no verified first-run improvement. |
| Home with data | 8 | **7** | −1 | Continue hierarchy remains, but Retry skipped can complete a restored unfinished Personal contact without a decision (#64). |
| Import | 7 | **8** | +1 | Durable pair scope, reviewed classification conflicts and candidate remapping improve the post-import workflow. |
| Deck card | 7 | **8** | +1 | Skip preserves saved classification and identity lines use measured space; timestamp-weak Undo prevents closure. |
| Follow-up sheet | 7 | **7** | 0 | Capacity fallback is repaired, but moving confirmation into the body omitted its focus/reveal handoff. |
| Deck end | 8 | **8** | 0 | Session counts, read recovery and skipped-out gating remain correct; no new completion presentation evidence. |
| Review list | 7 | **7** | 0 | Durable content-safe move recovery and isolated pairs help, but mode focus and merge-recovery agreement remain broken. |
| Row sheet | 8 | **8** | 0 | Identity/raw-field/copy ordering remains and constrained capacity improves; expanded removal is not automatically revealed. |
| Export | 8 | **8** | 0 | ZIP/fallback/staleness/Other contracts remain; native delivery and fresh mobile rendering were not verified. |
| Settings | 7 | **8** | +1 | Recovery retention and literal labels are repaired; rollback still ignores intervening duplicate resolutions. |

## Web boundary

**Native address-book deletion/replacement — Not fixable in web:** this PWA has no implemented browser API for writing or deleting native address-book entries; export/checklist guidance defines its supported workflow, and #8 is Fixed for explaining that limitation. It is not an additional numbered requirement.

Actual physical-device validation cannot be supplied by source/JSDOM inspection. It remains external verification, not an excuse for the six concrete implementation failures above and not a separate counted defect. No numbered finding has been removed from the denominator.

## Definition of done

The next and final fix wave contains exactly **#52, #61, #62, #63, #64 and #65**. Primary owners below avoid duplicate counting; items are ordered by impact within each owner and refer to the precise changes and acceptance cases above.

- **deck:** **#61** — replace deck Undo's reusable-timestamp check with atomic expected-content/existence validation while retaining exact historical semantics. Integrate platform-ui's #63 handoff in FollowUpSheet.
- **import-export:** **#52** — include duplicate-review state in restore rollback conflict/approval checks and recover the intervening metadata after approved rollback. Support review-home's #65 from the persisted merge-recovery records.
- **review-home:** **#64** — make Home Retry an exact administrative skip reset; **#65** — reconcile persisted merge recovery across Review reloads and Settings Undo; **#62** — implement pair-mode entry/exit focus and list-context restoration. Integrate #63 in RowSheet.
- **platform-ui:** **#63** — supply and test shared confirmation focus/reveal/cancel restoration with actual sheet consumers; support #61's repository guard and #65's recovery-store synchronization.

Completion requires these acceptance cases, the permitted typecheck/Vitest suite passing, and honest separation of DOM assertions from later current-build browser/device validation. Do not mark an absent focus transition as verified because its destination exists in the DOM, or call a reusable timestamp a content guard.

**Final verdict: 59 of the 61 existing findings are Fixed. Existing findings remaining: #52 and #61. New findings remaining: #62, #63, #64 and #65. The exact remaining list is #52, #61, #62, #63, #64, #65.**
