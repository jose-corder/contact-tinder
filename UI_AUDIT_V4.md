# Contacts. — fourth UI audit / strict verification

**No: a mobile-first reviewer would not yet call this state of the art.** Of the requested **57 existing findings, 47 are Fixed, 10 Partial, and 0 Open**; this pass identifies **4 new regressions, #58–#61, all Open**. Across all 61: **47 Fixed / 10 Partial / 4 Open**, with **0 existing findings exempt as Not fixable in web**. The top five remaining gaps across owners are **duplicate merging that can discard classifications and unresolved comparisons (#54, #58–#59)**; **recovery that expires, accepts reused timestamps, silently evicts snapshots, or changes the snapshot during Undo (#1, #5, #55–#56, #61)**; **Personal Skip unexpectedly completing a relationship (#16, #60)**; **expanded sheet footers that can consume the keyboard/landscape viewport (#14, #38)**; and **portrait identity truncation despite unused card space (#39)**. Passing tests close covered paths, not these integration gaps.

## Scope and evidence limits

Read `UI_AUDIT.md`, `UI_AUDIT_V2.md`, and the previous contents of `UI_AUDIT_V3.md`, then `DESIGN.md`, relevant current `src/**` and `tests/**`. No other Markdown files were read. This fourth-pass report is saved as **`UI_AUDIT_V3.md`**, following the last explicit output filename in the request; no `UI_AUDIT_V4.md` was created. “Previous V3” below means the report read before this replacement.

`qa-screens-v4/` contains exactly eight composites. Screenshot references mean:

| Reference | Actual file | What it establishes |
|---|---|---|
| 02 | `qa-screens-v4/02-import.jpg` | Initial chooser at both sizes; not preview/commit/error states. |
| 07 | `qa-screens-v4/07-deck-card.jpg` | Four readable action captions and whole phone/email rows at 320; tall card still has substantial unused space. |
| 09-prev | `qa-screens-v4/09-followup-sheet-prev-build.jpg` | Historical **Work** follow-up at both sizes, not current Personal or expanded Later confirmation. |
| 14 | `qa-screens-v4/14-export.jpg` | Clean-file guidance and deletion checklist hierarchy; not prepared-file sharing or ZIP delivery. |
| 15 | `qa-screens-v4/15-settings.jpg` | Preference/data sections; not restore preview or recovery. |
| 16 | `qa-screens-v4/16-review-work-tab.jpg` | Work tab, scoped search, filters and More buttons; not duplicate-pair review. |
| 17-prev | `qa-screens-v4/17-row-sheet-prev-build.jpg` | Historical row sheet at 390; the right frame shows the list with no sheet. |
| 20 | `qa-screens-v4/20-home-with-data.jpg` | Continue before progress/counts; four classified Work contacts still awaiting status. |

Left frames represent 390×844, right frames 320×568. Content continuing below a cropped frame is not itself clipping. There is **no 09b or 16b file**, no fresh current-build row/follow-up sheet capture, and no supplied light-mode, enlarged-text, keyboard-open, landscape, desktop, failure, merge, or recovery capture. Neither screenshot names nor comments saying “#N fixed” establish completion. New findings are source-derived execution paths; no running-browser reproduction is claimed.

Validation: **`npx vitest run --configLoader native --pool threads --maxWorkers 2` passed: 84 files, 526 tests. `npm run typecheck` passed.** Two PowerShell typecheck launches failed at process creation with access denied; the same command then succeeded through `cmd.exe`. No server was started, dependencies installed, or source/tests edited. The existing `.gitignore` modification was left intact. Several tests assert thresholds, class names, mocked rectangles or current behavior; those are not rendered-layout acceptance tests.

**Fixed** closes the reported failure on available evidence, without universal device certification. **Partial** identifies concrete remaining work with a change and acceptance test. **Open** applies to new unaddressed regressions.

## Verification of every existing finding

All original 43 items, nine V2 additions, and five previous-V3 additions are included. Every V2 Partial was rechecked, including those subsequently marked Fixed in V3.

| # | Finding | Status | Current evidence | Remaining work: file, change, acceptance test |
|---|---|---|---|---|
| 1 | Selecting a backup immediately replaces the current database | **Partial** | `src/features/export/RestoreInput.tsx:59` previews and :78 requires explicit commit; `src/export/json.ts:140` snapshots both modes, but :145 silently retains only three entries. | In `src/export/json.ts` retain every unexpired recovery and prune expired entries; align `RestoreInput.tsx`/`useRestoreRecovery.tsx` promises. Accept four restores within ten minutes with all four IDs recoverable, or require explicit informed supersession before removing the first (#56). |
| 2 | Short-screen card cuts through a phone number | **Fixed** | **07**, right, shows complete phone/email rows; `src/features/deck/CardFront.tsx:34` retains essential rows and :43 makes the body scrollable. | — |
| 3 | Invisible Undo slot truncates the decision label | **Fixed** | **07** shows four captions; `src/features/deck/ActionBar.tsx:17` uses four columns; `DeckScreen.tsx:66` puts Undo in the header. | — |
| 4 | Follow-up actions scroll away inside nested sheet scrollers | **Fixed** | `src/ui/Sheet.tsx:112` owns body scrolling and :114 places footer outside it; `FollowUpSheet.tsx:92` supplies fixed actions. Historical **09-prev** supports only the ordinary earlier layout. | —; expanded-footer capacity is tracked in #14/#38. |
| 5 | Undo toast collides with controls/modal and Review recovery is fleeting | **Partial** | `DeckScreen.tsx:131` uses an in-flow dock; `FollowUpSheet.tsx:116` has modal-local Undo; `src/features/review/undo.ts:43` still provides only a ten-second single-row toast. | In `ReviewScreen.tsx` and `undo.ts`, retain accessible last-move recovery outside the departing row/toast, with content/version guards and retry after storage failure. Accept Undo after ten seconds, list-tab changes and a failed first attempt, without reverting subsequent edits. |
| 6 | Re-swipe navigation erases classification before action | **Fixed** | `src/hooks/deckSession.ts:29` loads saved decisions for reclassification; `src/hooks/useDeck.ts:160` commits on action; **16** explains the boundary. | — |
| 7 | Personal classification forces Friend / Family / Ex | **Fixed** | `src/domain/taxonomy.ts:190` persists type-only Personal as Other; `FollowUpSheet.tsx:80` and `ClassificationEditor.tsx:38` share the rule; Other is exported. | —; Skip and historical recovery consequences are new #60/#61. |
| 8 | Delete's meaning arrives after the decision | **Fixed** | **20** explains the phone-book boundary above Continue; `ReviewScreen.tsx:90` repeats it on Delete; **14** places import caveats near clean export. | — |
| 9 | Obsolete import UI buries the next required action | **Fixed** | `src/features/import/ImportScreen.tsx:96` replaces chooser with preview; `ImportPreview.tsx:29` puts commit before optional details; phase heading is focused. | — |
| 10 | Selected status colors fail text contrast | **Fixed** | `src/ui/index.tsx:171` uses on-tone colors; `src/index.css:16` and :46 define palettes; `tests/ui/contrast.test.ts` verifies 4.5:1 selected text/notices. | — |
| 11 | Tap-target compliance depends on mounted screen | **Fixed** | `src/index.css:279` defines hit-44, :283 covers disclosures, :287 expands chip hit regions; shared Back/Button/IconButton use global minima. | — |
| 12 | Routes animate without focus/title/context handoff | **Fixed** | `src/App.tsx:47` updates titles and :52 keys by pathname; `useReviewContext.ts:25` restores search/filters/pagination and :52 restores contact-ID focus; `tests/review/routes.test.tsx` exercises actual Back navigation. | — |
| 13 | Accessible deck path loses focus and lacks copy controls | **Fixed** | `DeckScreen.tsx:69` announces contacts; `DeckEnd.tsx:62` focuses completion; `CardFields.tsx:12` uses safe links and shared copyable fields. | — |
| 14 | Small inputs and insufficient keyboard-aware layout | **Partial** | `src/index.css:285` enforces 16 px touch inputs; deck fallback exists; `src/ui/Sheet.tsx:98` caps height while :114 makes the expanded footer nonshrinking. | In `Sheet.tsx`, `FollowUpSheet.tsx:94` and `RowSheet.tsx:33`, move expanded confirmation content into the single scrolling body or switch to a fully scrollable constrained sheet. Accept a 320×568 frame with 240 px visual viewport and enlarged text: Later Keep/Discard and removal confirmation retain reachable body, error, Cancel and primary actions without footer clipping. |
| 15 | File extension invents contact provider | **Fixed** | `src/features/deck/CardFront.tsx:62` and `src/features/review/ContactFields.tsx:38` share `sourceLabel`; **07** accurately says Demo. | — |
| 16 | Passes, Skip and Later lack a clear promise | **Partial** | `ActionBar.tsx:24` exposes touch Skip help; `FollowUpSheet.tsx:96` explains Keep/Discard, but `useDeck.ts:151` can make Skip complete Other, contradicting `KeyboardLegend.tsx:1`. | In `src/hooks/useDeck.ts` and the persistence transition, make Skip preserve the saved relationship and postpone the card; keep completion on explicit Done/Keep/relationship actions. Accept Neighbor → Skip retaining unfinished membership and returning once, then second Skip leaving it pending in Review (#60). |
| 17 | Coach tells triage users to choose nonexistent type chips | **Fixed** | `src/features/deck/DeckCoach.tsx:9` has pass-specific copy; :24 shares action icons and :27 provides explicit dismissal. | — |
| 18 | Small Fraunces text uses display optical size | **Fixed** | `src/index.css:207` enables optical sizing; :213–222 define small/text/eyebrow variants; `src/ui/index.tsx:207` selects avatar sizing by role. | — |
| 19 | All-fields labels truncate and timestamps remain raw | **Fixed** | `src/ui/FieldList.tsx:19` wraps labels/values; `src/ui/format.ts:4` handles ISO/compact dates; `ContactFields.tsx:38` formats metadata. | — |
| 20 | Invisible quick actions omit a destination for Unsorted contacts | **Fixed** | **16** shows More; `src/features/review/QuickActions.tsx:7` enumerates every other destination for menu/reveal. | — |
| 21 | Search is buried and conceals its scope | **Fixed** | **16** shows Search in Work before filters; `ReviewScreen.tsx:75` and `model.ts:10` provide scope and accent/phone normalization. | —; duplicate-mode scope is separately Partial in #54. |
| 22 | Bulk selection crosses hidden scopes and success vanishes | **Fixed** | `ReviewScreen.tsx:35` keys selection by scope; `BulkBar.tsx:78` names all results, :81 uses two columns and :87 retains bulk Undo. | —; same-version Undo validity remains #55. |
| 23 | Administrative details bury editing and contact identity | **Fixed** | `src/features/review/RowSheet.tsx:49` orders identity → classification → additional fields; `ContactFields.tsx:10` puts first phone/email before editing. | —; **17-prev** predates this change. |
| 24 | Loading, empty and failure recovery is uneven | **Fixed** | `src/App.tsx:54` wraps routes in ErrorBoundary; `useDeck.ts:226` retries loading; `DeckEnd.tsx:65` gates results/offers Retry; Home/Review/Export have skeleton/error branches. | —; ErrorBoundary does not replace async-operation recovery. |
| 25 | Share-first silently becomes multiple downloads | **Fixed** | `src/features/export/ExportAction.tsx:63` exposes explicit fallback; `BulkBar.tsx:84` adopts it; `src/export/zip.ts:62` packages multiple files into one ZIP. | —; native activation after awaited revision checks remains a device-validation risk, not demonstrated silent fallback. |
| 26 | Export is an inventory rather than a guided finish | **Fixed** | **14** leads with clean file/delete list; `ExportScreen.tsx:60` collapses alternatives, :62 explains overlap and :84 links to Settings for backup/restore. | — |
| 27 | Deck-end summaries use the wrong population | **Fixed** | `src/features/deck/DeckEnd.tsx:48` derives session population; :86 labels it separately from global counts; :74 selects a nonempty unfinished pass. | — |
| 28 | Redundant progress blocks delay Continue | **Fixed** | **20** places Continue first; `HomeScreen.tsx:49` precedes progress; `ProgressOverview.tsx:33` distinguishes classified from fully sorted. | — |
| 29 | Dark structural control boundaries disappear | **Fixed** | `src/index.css:44`/ :74 provide control/track tokens; shared controls adopt them; `tests/ui/contrast.test.ts` checks at least 3:1 against both surfaces. | — |
| 30 | Review classification is hidden behind dots and short names | **Fixed** | `ReviewRow.tsx:49` constructs textual classification, :105 renders it, :107 shows extra labels and :77 provides the fuller accessible row name. | — |
| 31 | Tabs/exclusive choices have inconsistent keyboard semantics | **Fixed** | `src/ui/RadioGroup.tsx:19` supplies named groups and roving keys; Settings/Filters/Bulk adopt it; `Segmented.tsx:24` links tabs/panels and real-route arrow tests pass. | — |
| 32 | Stamp saturation and travel disagree with commit | **Fixed** | `src/features/deck/motion.ts:12` defines one 0.35 threshold; `swipeMath.ts:27` and :36 share it; :50 computes card-bound travel; stampHold is 120 ms. | —; perceived motion still lacks current motion captures. |
| 33 | Reduced motion differs across surfaces | **Fixed** | `ReviewRow.tsx:40`/ :44 bypass and stop spatial reveals; `Sheet.tsx:102` uses shared motion policy and :104 disables drag under reduced motion. | — |
| 34 | Feedback is duplicated, displaced and styled as error | **Fixed** | `useImportAnnouncement.ts` throttles announcements; `ExportAction.tsx:97` uses local tone; `useCopyFeedback.tsx:3` emits no global toast; `toastStore.ts:39` preempts with new high-priority actions. | —; recovery lifetime/validity is #5/#55. |
| 35 | Duplicate handling is not inspectable after import | **Fixed** | `ImportPreview.tsx:27` leads with added count; `ImportScreen.tsx:102` links to live pairs; `src/import/index.ts:48` preserves earlier candidates across imports. | —; pair scope/new Merge behavior remain #54/#58/#59. |
| 36 | Settings repeats technical restore prose and capability claims | **Fixed** | `SettingsScreen.tsx:43` handles unsupported haptics; :65 names next-use tips; `RestoreInput.tsx:64` reveals modes after file selection; **15** confirms main hierarchy. | —; wording cleanup remains #41. |
| 37 | Non-Safari iPhone install guidance is generic | **Fixed** | `useInstallPrompt.ts:19` separates iOS/Safari; `InstallRow.tsx:11` gives Safari Share instructions or Open in Safari fallback; unsupported non-iOS rows are hidden. | — |
| 38 | Landscape/safe-area support lacks a constrained fallback | **Partial** | Sheet/Bulk side insets exist; `deck.css:48` gives the stage a floor and :55–64 supplies scroll/reflow; the portalled Sheet still caps/clips an arbitrarily tall nonshrinking footer (`Sheet.tsx:96–115`). | In `src/ui/Sheet.tsx` add a constrained-height path when header plus footer exceeds usable height, shared by follow-up/removal dialogs. Accept 568×320 with simulated side/bottom safe areas and 200% text: every action/body field remains reachable without horizontal clipping (#14). |
| 39 | Type roles and identity wrapping remain inconsistent | **Partial** | Numeric text utilities are migrated, but `src/features/deck/CardFront.tsx:23` defines roomy as stage ≥680 and :48/:50 truncates below it; **07** shows unused tall-card space. | In `CardFront.tsx` choose two-line name/role from measured available content space, not a 680 px cutoff; replace the threshold-preserving test in `tests/deck/audit-v3.test.tsx` with rendered 390×844 long-name/org acceptance, retaining whole essential rows and reachable details at 320×568. |
| 40 | Desktop is only a phone frame | **Fixed** | `src/features/deck/DesktopContext.tsx:10` adds read-only shortcuts, five upcoming names and counts; `deck.css:66` adds a 440+240 px composition; Home/Review retain companion columns. | —; no desktop screenshot was supplied. |
| 41 | Editorial/technical vocabulary displaces literal task copy | **Partial** | **07/15**, `taxonomy.ts:24`, :71 and `SettingsScreen.tsx:79`, :88 retain Name-drop flex, Triage, Back up (.json), Danger zone. | Change display strings in `src/domain/taxonomy.ts`/`SettingsScreen.tsx` to Notable contact, Sort contacts, Back up app data and Reset app; preserve stored keys and shared export labels. Accept screen/export-label tests without old action labels and with accurate recovery-retention wording (#56). |
| 42 | Parallel implementations undermine consistency | **Fixed** | `CardFields.tsx:3`/`ContactFields.tsx:4` share `readRawFields` and FieldList; `CardFront.tsx:71` uses shared long-press feedback; `toast.tsx:34` uses LabelDot. | —; `friendlyType` remains in a deck module but is reused, not duplicated. |
| 43 | Decorative detail lacks useful state feedback | **Fixed** | `DeckEnd.tsx:83` gates SORTED; `useCopyFeedback.tsx:24` supplies local Copied/check feedback without redundant toast. | — |
| 44 | Review tab navigation is undone by route remounting | **Fixed** | `src/App.tsx:52` keys by pathname; `useRouteFocus.ts:73` ignores query replacements; `tests/review/routes.test.tsx` checks consecutive arrows through actual AnimatedRoutes. | — |
| 45 | CopyButton feedback disappears inside sheets | **Fixed** | `src/ui/useCopyFeedback.tsx:34` emits local status and :35 selectable fallback; `feedback.tsx:28` retains retry; modal copy tests cover the path. | — |
| 46 | Review hides preserved original/merged fields | **Fixed** | `src/import/rawFields.ts:48` reads every preserved source; `ContactFields.tsx:41` renders decoded fields and :46 exposes each record; the new Review test uses actual secondary rawCards. | — |
| 47 | SORTED celebrates skipped-out contacts | **Fixed** | `DeckEnd.tsx:49` includes outstanding/skipped IDs; :83 requires a nonempty complete scope; `tests/deck/reaudit.test.tsx` covers ordinary/scoped repeated skips. | —; #60 creates a different misleading completion path upstream. |
| 48 | Ready export becomes stale while counts update | **Fixed** | `ExportScreen.tsx:18` reads rows/revision together; `ExportAction.tsx:46` invalidates before another gesture and :54/:60 rechecks preparation; staleness tests cover changed data/races. | — |
| 49 | Deck phone links lose extensions | **Fixed** | `CardFields.tsx:13` and `ContactFields.tsx:34` share `phoneHref`; `tests/review/safeLinks.test.tsx` covers supported extensions/unsafe-value rejection. | — |
| 50 | Chip hit region defeats label truncation | **Fixed** | `src/ui/index.tsx:174` isolates `.chip-label`; `src/index.css:294` clips the inner span while :287 preserves outer hit overflow. | — |
| 51 | Other has no relationship-specific export | **Fixed** | `src/export/vcf.ts:75` enumerates relationship metadata including Other; `tests/export/other.test.ts` covers the group. | — |
| 52 | Restore Undo erases intervening work without review | **Fixed** | `src/export/json.ts:165` checks revision/restore identity, :169 returns conflict preview and :176 snapshots newer data; recovery tests cover edits after preview. | —; exact legacy-state restoration is new #61. |
| 53 | Later Keep is unfinished in storage but appears as Other in Review | **Fixed** | `FollowUpSheet.tsx:80` deliberately saves Other, with disclosure at :96/:100; `ReviewScreen.tsx:42`/`ClassificationEditor.tsx:32` use only saved relation; Keep tests verify persistence. | —; untouched Later still leaves Personal unfinished. |
| 54 | Duplicate review hides counterparts and loses unresolved work | **Partial** | `PossibleDuplicates.tsx:22` shows both identities across lists and `import/index.ts:48` retains candidates; however `ReviewScreen.tsx:38–44` ignores duplicatesOnly in the normal list while :86 inserts pairs above it. | Make `/review?dupes=1` a distinct pair mode in `ReviewScreen.tsx`: hide ordinary count/selection/Sort again controls or explicitly separate their scope, and search/filter both pair members. Accept one Work/Unsorted pair plus an unrelated contact: only pair-relevant records/actions appear and no bulk action includes the unrelated contact. Preserve candidate remapping required by #59. |
| 55 | Toast priority makes recovery delayed or stale | **Partial** | `toastStore.ts:39` now preempts; `useDeckToast.ts:8` dismisses by ID; but `src/features/review/undo.ts:26`, :34, :48 validate only updatedAt, which restore can reuse (`repo.ts:223`). | In `undo.ts`/repository, atomically compare the complete expected decision or a mutation revision restore cannot reuse. Accept a later Merge restore that changes content but preserves updatedAt: row and bulk Undo must refuse to overwrite it. Retain retry after transient failure (#5). |
| 56 | Recovery targets the wrong restore or clears Merge history | **Partial** | `json.ts:138` creates IDs and :156 looks up the exact entry; both modes snapshot, but :145 evicts the oldest on restore four while `useRestoreRecovery.tsx:85` promises ten minutes unconditionally. | In `src/export/json.ts`, remove silent unexpired-entry eviction or require a pre-commit warning identifying the recovery being superseded. Accept A/B/C/D within ten minutes with A recoverable unless explicitly superseded; a queued A notice must not misleadingly report only “expired.” |
| 57 | Fixed feedback slot overlaps toolbar on wrapped toast | **Fixed** | `DeckScreen.tsx:131` uses an in-flow ToastDock; `ToastDock.tsx:22` grows and does not shrink; `layout.css:2` wraps/clamps text; toolbar follows it. | —; mocked-height tests support code-level closure, not a long-message browser capture. |

## Shared-primitives integration check

- **Sheet footer / SheetFooterActions:** Follow-up, row details, bulk move/tag and reset adopt shared fixed actions. Single-action Skip help and quick-action Cancel appropriately use Sheet.footer directly. The remaining fault is capacity: confirmation content is in the nonshrinking footer, and a ScrollFallback inside the row body cannot resize its portalled ancestor. The descendant overflow override at `src/index.css:286` does not solve that.
- **InlineNotice / LabelDot / toast:** Operation notices are local and toned; import announcements are throttled. Toaster reuses LabelDot, dismisses by ID and exposes the newest high-priority action. Single-row Review Undo still lacks persistent recovery. A comment mentioning `validUntil` at `useRestoreRecovery.tsx:54` is not an actual supplied callback; database validation remains authoritative there.
- **CopyButton / long press:** Both share `useCopyFeedback`, including invalidation after value changes, local success/failure and selectable fallback. Deck summary long press supplies local Retry; full details supply explicit buttons. Modal copy acknowledgement no longer depends on the global toaster.
- **Chip tone / inner label / hit-44:** Semantic foregrounds and inner clipping remain integrated; the pseudo-element preserves the 44 px chip hit region. Generic ink chips need no semantic tone. No `text-[Npx]`, `text-xs` or `text-sm` occurrences remain in `src/features` or `src/ui`. Named type-role adoption is complete; #39's space decision is not.
- **RadioGroup / routes / ErrorBoundary:** Exclusive filters, appearance and bulk destination use named radios with disabled-item skipping. Query changes retain tab nodes; Back restores filters and a stable row ID. ErrorBoundary covers route renders, not arbitrary asynchronous callbacks; operation recovery still needs explicit implementation.
- **Formatters / raw reader:** Date/phone helpers and safe core phone/email links are reused. Both detail surfaces share the decoded all-source reader and expose original records. Reader tests now use real secondary `rawCards`, correcting the previous coverage gap.
- **Completion / Later / export:** Explicit Other and Later Keep agree across persistence, Review, progress and exports; SORTED is pass-scoped. That agreement does not make Skip an appropriate completion command (#60). Ready artifacts invalidate on content changes; multi-file export uses one ZIP and bulk uses explicit fallback. Native sharing after asynchronous revision reads remains unverified on devices.

## New findings

### 58. Duplicate Merge discards conflicting classifications without a reviewed result or Undo

**Status:** Open · **Severity:** High · **Owner:** import-export, with review-home

**Evidence:** `src/features/review/PossibleDuplicates.tsx:13` calls merge directly from the button at :30; the card shows names, organizations and a generic reason (:22–27). `src/import/duplicates.ts:80–82` merges fields, migrates a decision and deletes the second record. `src/import/decisions.ts:14–16` selects the first already-classified decision wholesale, retaining only the union of custom tags. `tests/review/audit-v3.test.tsx` explicitly expects no Undo on the merge notice.

**Experience:** Compare a Work/Current/Client record with a Personal/Family/Neighbor record. Merge immediately keeps the first classification and removes the second contact's relationship/types. Neither those decisions nor the shared phone/email value are visible before the tap. “Contacts merged” offers no recovery. Atomicity prevents half-writes; it does not make the chosen result reviewable or reversible.

**Fix:** In `PossibleDuplicates.tsx`, open comparison showing actual shared values, both identities, both saved classifications and the proposed survivor. Require an explicit classification choice when classifications conflict. In `duplicates.ts`, snapshot both contacts, decisions and affected pair metadata before committing; expose Undo with expected-current-state protection. Keep field union and tag counts transactional.

**Acceptance test:** Seed the conflicting Work/Personal pair; cancel comparison and assert no writes. Confirm each classification choice and assert the displayed result matches storage/export. Undo must restore both records, decisions and unresolved comparisons while refusing to clobber a subsequent edit. Verify comparison/confirmation at 320×568.

### 59. Resolving one duplicate pair deletes other unresolved comparisons

**Status:** Open · **Severity:** Medium · **Owner:** import-export

**Evidence:** `src/import/duplicates.ts:82` deletes b; :83 calls `readPossibleDuplicates()`. The reader calls `prunePairs` at :62, dropping any pair with a missing member (:49–50). Nothing remaps b's remaining edges to survivor a. New tests cover a two-contact merge, not a chain.

**Experience:** A/B share a phone; B/C share a different email; A/C initially share neither. Merge B into A. A now contains B's email, but the B/C comparison disappears instead of becoming A/C. Review can say All reviewed while a known candidate remains unresolved. Candidate persistence survives unrelated imports but not the new Merge action.

**Fix:** In `duplicates.ts:mergePair`, read candidates before deletion, rewrite each surviving b endpoint to a, drop only self-pairs/the resolved pair, deduplicate canonical pair keys and recompute evidence from merged values. Preserve unrelated resolutions; an old dismissed survivor pair must not automatically erase newly introduced unresolved evidence.

**Acceptance test:** Seed only A/B shared-phone and B/C shared-email pairs; merge A/B and assert one unresolved A/C pair with the email reason survives reload and unrelated import. Resolve it before All reviewed appears. Failure must roll back records and candidate metadata together.

### 60. Selecting a Personal type turns Skip into completion

**Status:** Open · **Severity:** High · **Owner:** deck

**Evidence:** `src/domain/decks.ts:11` sets Other in the draft when Neighbor is selected. `src/hooks/useDeck.ts:150` resets the primary relationship for Skip, but :151 immediately normalizes the still-selected types back to Other. `taxonomy.ts:120` then makes `isInDeck` false, so :153 removes the contact after its first Skip. Visible help promises that Skip returns the card once (`KeyboardLegend.tsx:1`).

**Experience:** With follow-up disabled, open unfinished Personal, select Neighbor, then Skip because the relationship is undecided. The contact becomes completed Other, disappears immediately, contributes to fully sorted progress and enters the Other export. The toast still says Skip; a one-contact queue can show SORTED. Neither Done nor Keep was pressed.

**Fix:** Separate postponement from completion normalization in `src/hooks/useDeck.ts` and the repository transition. Skip should increment skips while retaining saved classification. Hold unsaved types as an in-session draft on the requeued card, or discard them with explicit copy. Persist type-implied Other only on an explicitly completing action; preserve intended Later Keep behavior.

**Acceptance test:** Personal without relation → Neighbor → Skip leaves relation absent, completion/Other export unchanged, and returns the card at queue end. Second Skip leaves it pending in Review without SORTED. Done and Later → Keep must still save Other. Include scoped reclassification.

### 61. Universal completion normalization rewrites historical snapshots during recovery

**Status:** Open · **Severity:** High · **Owner:** import-export, with platform-ui

**Evidence:** `src/db/repo.ts:78` normalizes every write, including `restoreAll` at :223. Restore Undo uses that path (`src/export/json.ts:172`). Row/bulk Undo calls normalized saves (`src/features/review/undo.ts:36`, :48); deck Undo does likewise (`useUndo.ts:37`). `tests/review/audit-v3.test.tsx` acknowledges valid legacy Personal/type-only decisions with no relation, inserting one without normalization.

**Experience:** A pre-wave Personal/Neighbor contact is unfinished. Replace with another backup, then Undo: the snapshot's absent relationship becomes Other. Recovery reports success, but progress, membership and exports differ from the original state. Moving that legacy record to Work and undoing also changes its relationship. Deck Undo can return the unnormalized snapshot to its local queue while persistence contains Other, recreating disagreement between surfaces.

**Fix:** In `src/db/repo.ts`, add exact snapshot restoration that updates tag counts atomically without completion inference. Use it for restore rollback, row/bulk Undo and deck Undo, retaining existence and expected-content/version guards. Keep explicit completion writes normalized. Any legacy migration should be a separate explicit operation before snapshots, not a hidden side effect of recovery.

**Acceptance test:** Seed legacy Personal/Neighbor without relation, with skips/tags; capture it and exercise Replace→Undo, Merge→Undo, row-move Undo, bulk Undo and deck Undo. Assert exact decision semantics, tags, progress, deck membership and Other-export membership return to the snapshot. Newly completed type-only decisions must still save Other normally.

## Re-scored per-screen scorecard

Same ten screens and 1–10 scale. Deltas compare with the previous V3. Scores include current code paths and supplied evidence, not certification of missing device states.

| Screen | V1 | V2 | Previous V3 | Fourth pass / 10 | Delta | One-line reason |
|---|---:|---:|---:|---:|---:|---|
| Home first-run | 6 | 7 | 7 | **8** | +1 | Browser-specific install fallback closes the remaining guidance gap; no fresh first-run capture was supplied. |
| Home with data | 6 | 7 | 7 | **8** | +1 | Saved Other now agrees with progress and Continue remains first; duplicate destination scope still needs repair. |
| Import | 5 | 6 | 7 | **7** | 0 | Durable candidates improve follow-through, but the new Merge route can discard decisions and unresolved comparisons. |
| Deck card | 4 | 7 | 7 | **7** | 0 | In-flow feedback, local copy and scroll fallback improve mechanics; Personal Skip and portrait truncation block a higher score. |
| Follow-up sheet | 4 | 7 | 7 | **7** | 0 | Later Keep saves the promised Other state; expanded-footer capacity and missing current sheet evidence remain. |
| Deck end | 5 | 6 | 8 | **8** | 0 | Scope, read recovery and ordinary skipped-out gating remain correct; #60 can feed an unintended completed decision. |
| Review list | 5 | 6 | 7 | **7** | 0 | Context restoration and prompt toast visibility improve continuity; duplicate scope and nondurable/version-weak Undo remain. |
| Row sheet | 4 | 6 | 7 | **8** | +1 | Identity precedes editing, with readable merged sources and local copying; expanded removal footer still needs constrained QA. |
| Export | 5 | 6 | 8 | **8** | 0 | ZIP/shared bulk fallback close #25; native delivery remains unverified and source decisions can be wrong through #60/#61. |
| Settings | 5 | 7 | 7 | **7** | 0 | Restore IDs/Merge snapshots repair major paths; eviction, exact-snapshot semantics and literal-copy gaps prevent closure. |

In **20**, 38 to go, four classified and zero fully sorted are consistent: four Work contacts without status are incomplete. This is not an arithmetic regression. Scrollable Import/Export/Settings content at 320×568 is also not automatically a failed mobile layout.

## Web boundaries and external verification

- **Native address-book deletion/replacement — Not fixable in web:** this PWA's browser APIs do not provide native address-book write access; exports/checklists and explicit next steps are its supported boundary. #8 is Fixed because it explains that boundary; adding native deletion is not required for completion.
- **Physical-device certification from source/tests alone — Not fixable in web:** repository changes and JSDOM cannot establish actual software-keyboard, assistive-technology, standalone safe-area or native-share behavior. Device validation is external evidence, not an additional numbered defect or grounds to waive concrete layout fixes #14/#38.

Before claiming device readiness, verify current follow-up/row sheets at both sizes, keyboard/constrained height, larger text, safe areas, reduced motion, long identities/tags, copy failure and large prepared-file sharing. No numbered finding is entirely a native-only requirement, so none was removed from the denominator.

## Next wave

Ordered by impact within each owner; at most five packages each.

**deck**

1. Separate Skip from type-implied Personal completion (#16, #60).
2. Coordinate constrained confirmation layouts and capture both sheet sizes (#14, #38).
3. Replace the 680 px identity cutoff with available-space behavior (#39).
4. Use exact snapshot writes for deck Undo; keep returned draft equal to persistence (#61).
5. Replace Triage/Name-drop flex display labels while preserving taxonomy keys (#41).

**import-export**

1. Make pair Merge reviewed, conflict-aware and reversible (#58).
2. Restore snapshots exactly and retain all promised recovery IDs (#1, #56, #61).
3. Remap unresolved candidate edges after merges (#59).
4. Supply pair values/classifications to the separate duplicate workspace (#54, #58).

**review-home**

1. Add durable retryable single-row Undo and content-safe row/bulk guards (#5, #55).
2. Isolate duplicate mode from ordinary tab/search/selection actions (#54).
3. Integrate reviewed Merge/recovery instead of immediate pair mutations (#58).
4. Move expanded removal confirmation out of the unbounded fixed footer (#14, #38).
5. Finish Settings labels and preserve exact legacy decisions on Undo (#41, #61).

**platform-ui**

1. Supply constrained-sheet capacity behavior and verify expanded states, not just classes (#14, #38).
2. Supply exact historical writes and content/epoch guards for recovery consumers (#55, #61).
3. Preserve in-flow toast sizing/ID dismissal while Review gains persistent recovery (#5).

## Definition of done

The final fix wave is exactly **#1, #5, #14, #16, #38, #39, #41, #54, #55, #56, #58, #59, #60 and #61**. All are implementable web changes. Primary ownership below avoids duplicate closure counts; shared integration remains required.

- **deck:** Close **#16/#60** with non-completing Skip and explicit-completion acceptance; close **#39** with measured portrait identity wrapping. Coordinate deck Undo for #61 and taxonomy display strings for #41.
- **import-export:** Close **#1/#56** by honoring recovery retention; **#58** with reviewed, conflict-aware, reversible Merge; **#59** with candidate-edge remapping; **#61** with exact snapshot recovery across all consumers.
- **review-home:** Close **#5/#55** with persistent retryable Undo and atomic content-safe validation; **#54** with a genuinely separate pair scope; **#41** with coordinated literal screen/export labels. Integrate pair comparison/recovery under #58/#61.
- **platform-ui:** Close **#14/#38** with a constrained sheet flow keeping expanded confirmations, errors and final actions reachable at the specified keyboard/landscape/text sizes; supply recovery primitives for #55/#61 without regressing fixed focus, copy, toast, radio or chip contracts.

Closure requires the acceptance cases above, the permitted typecheck/test suite passing, and fresh current-build evidence for changed geometry. A new test that merely asserts the faulty threshold, immediate merge or normalized historical snapshot does not close the item.
