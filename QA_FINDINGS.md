Review identified **32 findings: 0 Critical, 7 High, 20 Medium, and 5 Low**. The highest risks are destructive identity merges, discarded decisions during consolidation, incomplete merged vCard exports, stale decision writes, and partially committed bulk changes. DESIGN.md was read first, followed by all source and test files in the inspected inventory, with rereads of concurrent changes and newly added files; locations below refer to those per-file snapshots on 2026-10-24, not an atomic commit or a verified deployed version. Fifteen pure-code assertions passed against refreshed, transpiled source snapshots; database/UI findings explicitly distinguish static reasoning from executed probes. Typecheck, Vitest, and build were **not run successfully**: shell launch failed with Access denied and the alternate process launcher failed with EPERM; the live URL was also inaccessible to the web tool, so no device/native-import results are claimed. A throwaway `qa-probes/` snapshot probe was created and removed after use; that directory is gitignored by task convention, but the inspected `.gitignore` has no actual rule for it, and was not changed. No dependencies were installed and no product/test/configuration files were edited.

## Critical

None confirmed.

## High

1. **Shared household identifiers collapse different people**

   **Severity:** High  
   **File:line:** `src/import/dedupe.ts:80, 116`

   **What goes wrong:** Any shared phone is sufficient to merge, regardless of different names or primary email addresses; a shared family email also merges people when their primary addresses do not trigger the narrow same-domain guard. One name and one decision then represent multiple people.

   **Concrete repro/input:** Import Alice and Bob with distinct UIDs and the same +12025550101 landline; alternatively give both only family@example.test. The phone probe returned one Alice record.

   **Suggested fix:** Treat shared identifiers as duplicate candidates; preserve separate records when identity evidence conflicts and expose a merge review before destructive consolidation.

   **Evidence / test coverage:** Pure snapshot probe confirms the phone case; no negative household-identity regression test was present.

2. **Name-only records collide and inherit another person’s decision**

   **Severity:** High  
   **File:line:** `src/import/contact.ts:34`; `src/import/dedupe.ts:105, 116`

   **What goes wrong:** The ID omits organization and other distinguishing fields when there is no phone/email, and the updated merge also explicitly merges a name-only record with a same-name record that has contact details. Two different Alex Smiths become one contact.

   **Concrete repro/input:** Import two UID-less cards with FN:Alex Smith, no phone/email, and ORG:School versus ORG:Employer. The probe returned one record; importing the second after classifying the first transfers that classification to the combined identity.

   **Suggested fix:** Keep ambiguous same-name records separate using a stable source fingerprint or collision discriminator; name alone must not authorize a destructive merge.

   **Evidence / test coverage:** Pure snapshot probe; existing name-only tests cover repeated imports, not different people sharing a name.

3. **Every national number is interpreted as US**

   **Severity:** High  
   **File:line:** `src/import/dedupe.ts:6, 18`; `src/import/contact.ts:23`

   **What goes wrong:** Although phoneKey accepts a country argument, the actual import and merge callers always use its US default. This both misses international duplicates and can merge a foreign national number with an unrelated US number.

   **Concrete repro/input:** The probe normalized Mexican 55 1234 5678 to +15512345678, while +52 55 1234 5678 normalized to +525512345678. Import the national form alongside a US contact with +15512345678 to trigger the wrong merge.

   **Suggested fix:** Collect a country preference and pass it through parsing, IDs, and every dedupe operation; without one, avoid inventing a country code for ambiguous national numbers.

   **Evidence / test coverage:** Pure snapshot probe; the GB unit test passes a country directly and does not test the import callers.

4. **A bridging import deletes the losing record’s decisions**

   **Severity:** High  
   **File:line:** `src/import/index.ts:29, 36`; `src/import/dedupe.ts:119, 147`; `src/db/repo.ts:39`

   **What goes wrong:** A merged group retains the earliest existing contact and deletes superseded contacts together with their decisions. It never migrates a decision from a classified losing record to an undecided survivor or resolves conflicting labels.

   **Concrete repro/input:** Seed A with phone +12025550101 and no decision; seed B with b@example.test and Personal/Family plus a custom tag. Import a card containing A’s phone and B’s email: B is superseded, its decision is deleted, and A remains undecided.

   **Suggested fix:** Resolve decisions inside the merge transaction before deleting identities: migrate a sole decision and require an explicit conflict choice when both records are classified.

   **Evidence / test coverage:** The refreshed merge probe confirms B is superseded; decision deletion follows directly from repo.deleteContacts. Existing bridge test classifies only the surviving A.

5. **Merged contact fields disappear from exported vCards**

   **Severity:** High  
   **File:line:** `src/import/dedupe.ts:36, 50`; `src/export/vcf.ts:11`

   **What goes wrong:** Merge unions phone/email arrays but keeps just one raw card, now selected by richness. Export prefers raw wholesale, so complementary numbers, emails, notes, and other fields from the other card are absent from the purported cleaned address book.

   **Concrete repro/input:** Import two Alice cards with the same email, one TEL:+12025550101 and one TEL:+12025550199, otherwise equal richness. The refreshed probe stores two phones but exports only +12025550101.

   **Suggested fix:** Reconcile merged fields into a preserved vCard representation, retaining unknown properties from all merged cards; do not choose a single raw card as the complete export of a union.

   **Evidence / test coverage:** Pure snapshot probe; import and export tests never exercise this combined round trip.

6. **Stale deck snapshots overwrite later decisions**

   **Severity:** High  
   **File:line:** `src/hooks/useDeck.ts:27, 63`; `src/db/repo.ts:53`; `src/features/deck/DeckScreen.tsx:32, 42`; `src/hooks/useUndo.ts:16, 26`

   **What goes wrong:** The queue is loaded once and whole decisions are written without checking the stored version. Other-tab edits, removals/reset, or a surviving global Undo toast from a previous pass can invalidate that queue; a subsequent swipe writes its old bucket/tags back.

   **Concrete repro/input:** Open the Work deck on A in tab 1. In tab 2 move A to Personal/Family, then swipe Current in tab 1: A becomes Work again. A same-tab variant is to enter Work immediately after triage and click the still-visible triage Undo toast; the loaded Work queue is not reconciled.

   **Suggested fix:** Use transactional version checks or merge intent against the latest stored decision, refresh deck membership on external writes, and clear or centrally own undo actions on route/session changes.

   **Evidence / test coverage:** Static control-flow finding; no multi-tab conflict, reset-with-open-deck, or cross-route toast regression test was present.

7. **Bulk changes can commit only part of the selection**

   **Severity:** High  
   **File:line:** `src/db/repo.ts:64`; `src/features/review/BulkBar.tsx:19, 57`; `src/features/review/ReviewScreen.tsx:71`

   **What goes wrong:** saveDecisions opens a separate transaction for every row. A failure midway leaves earlier contacts moved/reset/tagged, while the UI reports a generic failure and has no atomic rollback; this also creates 1,000 transactions and repeated live-query invalidations for 1,000 rows.

   **Concrete repro/input:** Select 1,000 contacts and Move to Personal, or Re-swipe these; inject a rejection on saveDecision number 501. The first 500 remain changed and the rest do not.

   **Suggested fix:** Wrap the complete batch and tag-vocabulary updates in one transaction, with an explicit bounded batch strategy if atomicity cannot be retained; report partial completion rather than implying a single failed operation.

   **Evidence / test coverage:** Static persistence finding; the bulk test uses one row and never injects a mid-batch failure.


## Medium

8. **Restore preserves decisions that were absent from the backup**

   **Severity:** Medium  
   **File:line:** `src/db/repo.ts:155, 165`; `src/features/export/RestoreInput.tsx:17`

   **What goes wrong:** Restore is an undocumented upsert merge, not a snapshot restore. Contacts added after the backup remain, and a backed-up undecided contact keeps a current decision because no decision row existed in the backup to overwrite it.

   **Concrete repro/input:** Import A, back up before any swipe, mark A Delete, then restore that backup. A is still Delete; a newly imported B also remains.

   **Suggested fix:** Offer clearly named replace and merge modes, and make replace restore contacts, decisions, and vocabulary to exactly the snapshot inside one transaction.

   **Evidence / test coverage:** Static finding; the round-trip test restores only into an empty database.

9. **Restoring even the current backup removes existing photo blobs**

   **Severity:** Medium  
   **File:line:** `src/db/repo.ts:160, 167`

   **What goes wrong:** dumpAll strips photo, then restoreAll bulkPut replaces each complete contact with the stripped object. An in-place restore removes photos already present on the device, and raw PHOTO content is never rehydrated into the avatar blob.

   **Concrete repro/input:** Import a vCard with a photo, export JSON, and immediately restore it without resetting. The restored Contact has no photo even though its raw vCard can still contain PHOTO.

   **Suggested fix:** Preserve existing photo blobs in merge mode and reconstruct thumbnails from preserved raw PHOTO data when replacing; describe separately what the backup retains in raw versus projected photo fields.

   **Evidence / test coverage:** Static field-replacement finding; no photo restore regression test.

10. **JSON validation admits non-Blob photo values and dangling decisions**

   **Severity:** Medium  
   **File:line:** `src/export/json.ts:11, 35`; `src/db/repo.ts:167`; `src/ui/index.tsx:179`

   **What goes wrong:** Validation checks selected fields but persists the original objects unchanged. A JSON photo:{} is accepted and reaches URL.createObjectURL, which throws; duplicate IDs and decisions referencing absent contacts are also accepted and can later attach to an imported identity.

   **Concrete repro/input:** Add "photo":{} to an otherwise valid backup contact and restore it, then open Review or a deck. Separately restore a decision for an absent contactId and later import that ID.

   **Suggested fix:** Construct sanitized Contact/Decision objects from a whitelist, reject JSON photo payloads unless explicitly decoded, and validate unique IDs and decision-to-contact references before committing.

   **Evidence / test coverage:** Static validation finding; malformed-shape tests do not cover these payloads.

11. **Export erases original CATEGORIES even for untouched contacts**

   **Severity:** Medium  
   **File:line:** `src/export/vcf.ts:14, 20`; `tests/export/vcf.test.ts:10, 14`

   **What goes wrong:** Every original category and its folded continuation are removed, not combined with the app’s labels. An untriaged contact exports with all original categories removed because decisionLabels returns an empty array.

   **Concrete repro/input:** Import FN:Alice with CATEGORIES:Family,VIP and immediately export all-contacts.vcf. The probe output has no CATEGORIES; classifying Work replaces Family,VIP with Work.

   **Suggested fix:** Preserve foreign categories and union them with app labels; identify app-owned categories explicitly if repeated exports need replacement.

   **Evidence / test coverage:** Pure probe; existing tests explicitly assert the destructive replacement/removal behavior.

12. **Custom tags disappear from untriaged vCard exports**

   **Severity:** Medium  
   **File:line:** `src/domain/taxonomy.ts:192`; `src/export/vcf.ts:93`

   **What goes wrong:** decisionLabels returns before appending customTags when bucket is unset. Tags persist through skips and can create tag-specific export files, but the cards inside those files carry none of those tags.

   **Concrete repro/input:** Add vip in triage, skip twice, then export tag-vip.vcf or unsorted.vcf. The probe returned [] for that decision’s labels.

   **Suggested fix:** Return customTags even without a bucket, and preserve tags in all export variants.

   **Evidence / test coverage:** Pure snapshot probe; tag-group tests check membership, not the cards’ CATEGORIES.

13. **Unencoded Windows-1252 text is irreversibly UTF-8 decoded**

   **Severity:** Medium  
   **File:line:** `src/import/index.ts:42`; `src/import/vcard.ts:37`

   **What goes wrong:** File.text()/readAsText default to UTF-8, and per-property CHARSET is considered only for quoted-printable fields. A vCard 2.1 literal Windows-1252 byte such as E9 is replaced before the parser sees it, corrupting both names and the supposedly verbatim raw string.

   **Concrete repro/input:** Import bytes for FN;CHARSET=Windows-1252:Andr followed by byte 0xE9, with no ENCODING parameter. Compare the displayed/exported name to André.

   **Suggested fix:** Read bytes and honor the applicable charset before converting each textual value, while retaining a faithful source representation; do not treat an already-decoded string as original bytes.

   **Evidence / test coverage:** Static byte-decoding finding. Quoted-printable Windows-1252 was separately probed and works.

14. **Apple grouped labels are discarded from phone/email projections**

   **Severity:** Medium  
   **File:line:** `src/import/vcardCodec.ts:33`; `src/import/vcard.ts:35, 41`

   **What goes wrong:** property strips the item group and parseVcf ignores X-ABLabel, so the association between item1.TEL and item1.X-ABLabel is lost. Custom labels such as Assistant, spouse, or a device name are unavailable when deciding which number belongs to whom.

   **Concrete repro/input:** Import item1.TEL:2025550101 followed by item1.X-ABLabel:Assistant. The phone probe has type:undefined; the raw field may be visible separately but is not associated with that number.

   **Suggested fix:** Retain property groups, collect X-ABLabel by group, and apply them to the matching phone/email entries after parsing.

   **Evidence / test coverage:** Pure snapshot probe; the test named “decodes iCloud groups” has no X-ABLabel fixture.

15. **ORG components after the company name are lost in the app and CSV**

   **Severity:** Medium  
   **File:line:** `src/import/vcard.ts:46`; `src/features/deck/CardFields.tsx:25`; `src/export/csv.ts:9`

   **What goes wrong:** Only the first structured ORG component is projected. Department/unit data disappears from search and CSV, and the full-fields card explicitly excludes raw ORG, so it also hides the omitted components.

   **Concrete repro/input:** Import ORG:Acme;Research;Biology. Search for Research and inspect the full card/CSV: only Acme is used. Raw vCard export still retains the original components.

   **Suggested fix:** Preserve structured organization components and expose them in full details, search, and CSV without conflating escaped literal semicolons with component separators.

   **Evidence / test coverage:** Static projection finding, supported by the ORG probe.

16. **Generated vCard lines are never folded by UTF-8 octet count**

   **Severity:** Medium  
   **File:line:** `src/export/vcf.ts:10, 20, 35`

   **What goes wrong:** New CATEGORIES and synthesized properties are emitted as single unlimited lines. Many multibyte tags or a long note can exceed the recommended 75-octet content-line length; this is an interoperability risk, not evidence that a particular Apple/Google version rejected a card.

   **Concrete repro/input:** Assign ten long multibyte tags and export a 4.0 raw card or a CSV-origin card. A probe generated a 370-byte CATEGORIES line.

   **Suggested fix:** Fold generated lines at UTF-8 character boundaries with CRLF plus one space, keeping unchanged source lines intact. RFC 6350 §3.2 describes this recommendation: [vCard line folding](https://www.rfc-editor.org/rfc/rfc6350.html#section-3.2).

   **Evidence / test coverage:** Pure length probe and specification review; native iOS/Google imports were not executed.

17. **Done does not guarantee that a follow-up contact skips the later deck**

   **Severity:** Medium  
   **File:line:** `src/features/deck/FollowUpSheet.tsx:66, 76, 123`; `src/domain/taxonomy.ts:113`

   **What goes wrong:** Done saves whatever is selected, even if there is no Work status or Personal relation. A Personal contact given only Neighbor, or Work given only Vendor, immediately reappears in the later deck despite the contract saying Done skips it.

   **Concrete repro/input:** Swipe Personal, select Neighbor only, press Done, then open the Personal deck; the contact is still eligible because relation is unset.

   **Suggested fix:** Make the completion rule explicit: require a primary choice before Done, or record follow-up completion independently so a type-only classification can finish the pass.

   **Evidence / test coverage:** Static membership finding; the follow-up test selects both a primary value and a type.

18. **Follow-up saves can be dismissed while pending and lose their error/draft**

   **Severity:** Medium  
   **File:line:** `src/features/deck/FollowUpSheet.tsx:24, 76, 128`; `src/ui/Sheet.tsx:74, 83`

   **What goes wrong:** The body disables Done/Later during save, but the outer close callback, close handle, drag dismissal, and disable-follow-up link remain active. A rejected save after dismissal updates an unmounted body, so its error and chosen classifications disappear.

   **Concrete repro/input:** Delay/reject saveDecision for Done, dismiss via the backdrop or “Don’t ask” link before it settles, then reject with a quota/storage error. Only the initial triage bucket remains and there is no visible retry error.

   **Suggested fix:** Lift the pending state to the sheet owner and gate every dismissal path; alternatively retain the draft and report save failures outside the unmounted body.

   **Evidence / test coverage:** Static async control-flow finding; no pending-save dismissal test.

19. **Follow-up CSS disables shrinking on the sheet’s scroll viewport**

   **Severity:** Medium  
   **File:line:** `src/features/deck/deck.css:14`; `src/ui/Sheet.tsx:89`

   **What goes wrong:** The selector for every direct child other than .deck-followup-body also matches Sheet’s wrapping scroll div, because the body is nested inside it. flex-shrink:0 prevents that viewport from fitting the 85dvh panel, whose overflow:hidden can clip Done/Later instead of creating a usable scroll area.

   **Concrete repro/input:** At a short mobile viewport such as 390×568, open Work follow-up and add enough tags to exceed the panel height; inspect the direct wrapper’s flex-shrink and attempt to reach Done.

   **Suggested fix:** Remove the broad child selector and let the shared sheet’s min-height:0 scroll wrapper shrink; apply nonshrinking rules only to the handle/title.

   **Evidence / test coverage:** Static CSS/layout finding; requires browser layout confirmation.

20. **Re-swipe and Jump to deck do not scope the deck to the requested list**

   **Severity:** Medium  
   **File:line:** `src/features/review/ReviewScreen.tsx:70`; `src/features/review/RowSheet.tsx:92`; `src/hooks/useDeck.ts:39`

   **What goes wrong:** Review resets the filtered records but opens the global pass queue. Jump to deck sends contactIds in route state, but the deck never reads them; unrelated eligible contacts can precede the requested contact and are included in its progress total.

   **Concrete repro/input:** Keep an unclassified Work contact named Aaron, filter Review to a classified Work contact named Zoe, and choose Re-swipe these or Jump to deck. Aaron is dealt before Zoe.

   **Suggested fix:** Pass an explicit session contact-ID set into useDeck, load only those IDs for that session, and define how later passes retain the same scope.

   **Evidence / test coverage:** Static caller/callee finding; the review navigation test substitutes a placeholder instead of rendering the real deck.

21. **Mixed Unsorted re-swipe can strand earlier passes**

   **Severity:** Medium  
   **File:line:** `src/features/review/model.ts:18, 22, 28`; `src/features/deck/DeckEnd.tsx:43`

   **What goes wrong:** resetForReview chooses the pass of the first alphabetical row, not the earliest pass represented by the list. All rows are reset, but the forward-only completion flow may never visit triage or Work after starting in Personal.

   **Concrete repro/input:** Unsorted contains Amy in Personal with two skips, Bob in Work with two skips, and Zoe undecided with two triage skips. Re-swipe these starts Personal; finishing goes to Review while Bob and Zoe have never been dealt.

   **Suggested fix:** Choose the earliest needed pass using PASS_ORDER and maintain a scoped multi-pass session, or let the user choose a pass without resetting the other ones.

   **Evidence / test coverage:** Static finding; model tests assert first-row behavior and do not exercise the completion flow.

22. **Arrow keys in the scrollable card details still classify the contact**

   **Severity:** Medium  
   **File:line:** `src/features/deck/DeckScreen.tsx:68, 70`; `src/hooks/useKeyboard.ts:17`; `src/features/deck/SwipeCard.tsx:87`

   **What goes wrong:** Opening details disables pointer dragging but does not disable deck keyboard shortcuts. The focused “All contact fields” scroll container is not one of the ignored input targets, so ArrowDown intended to scroll commits Skip; left/right can classify instead.

   **Concrete repro/input:** Flip a contact with many fields, Tab to the scrollable details region, then press ArrowDown or ArrowRight. The global handler prevents scrolling and invokes a swipe.

   **Suggested fix:** Suppress deck shortcuts while details are open or while focus is within an interactive/scrollable details region; retain explicit action buttons for classification.

   **Evidence / test coverage:** Static keyboard event-path finding; input tests cover textboxes only.

23. **Home Continue silently revives cards deliberately skipped out**

   **Severity:** Medium  
   **File:line:** `src/features/home/progress.ts:7`; `src/features/home/HomeScreen.tsx:35`

   **What goes wrong:** Home treats skipped-out cards as an unfinished earliest pass and Continue resets their skip counts. Returning Home after triage therefore sends the user back through twice-skipped triage contacts instead of proceeding to Work, contrary to the contract that those cards wait for Review.

   **Concrete repro/input:** Skip A twice, classify B as Work with Later, return Home, and press Continue. A’s triage skips are reset to zero and A is dealt again.

   **Suggested fix:** Select the next pass using active deck membership; offer an explicit Review/retry-skipped action instead of resetting skips as part of ordinary Continue.

   **Evidence / test coverage:** Static finding in newly added home progress/resume code.

24. **Persistent storage is never requested or checked**

   **Severity:** Medium  
   **File:line:** `src/main.tsx:9`; `src/db/schema.ts:10`; `src/features/import/ImportScreen.tsx:21`

   **What goes wrong:** Contacts, decisions, raw base64 photos, and blobs depend entirely on best-effort browser storage; there is no persist/persisted/estimate call or quota-specific recovery guidance. Safari may evict origin data under storage pressure; its documented inactivity rule concerns seven days of Safari use without site interaction, not simply seven elapsed days, and Home Screen apps have a separate exception.

   **Concrete repro/input:** Import and sort contacts in an ordinary Safari tab without a backup, then subject the origin to storage pressure/inactivity eviction; the next load has an empty database. This device scenario was not executed.

   **Suggested fix:** After a successful import, feature-detect navigator.storage.persisted()/persist(), check estimate() for large imports, and make backup/recovery guidance clear without promising permanence. See [WebKit storage policy](https://webkit.org/blog/14403/updates-to-storage-policy/) and [Safari inactivity and Home Screen distinction](https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/).

   **Evidence / test coverage:** Static absence plus platform documentation; this is not a claim that IndexedDB Blob storage itself is unsupported on iOS.

25. **Opening Export synchronously materializes every overlapping vCard file**

   **Severity:** Medium  
   **File:line:** `src/features/export/ExportScreen.tsx:22`; `src/export/vcf.ts:79, 91`

   **What goes wrong:** The render-time memo builds clean, all, every bucket/status/type, and every tag file before any export action. vcfText creates a card array and one giant joined string for each group, duplicating photo-heavy raw content on the main thread and retaining all resulting Files.

   **Concrete repro/input:** Use 5,000 contacts with 100 KiB raw photo payloads and several labels. One complete book is roughly 488 MiB before temporary copies; clean/all and overlapping groups multiply that allocation merely by visiting Export.

   **Suggested fix:** Prepare files on demand or in cancellable chunks/worker jobs, cache only needed results, and show preparation progress before offering native Share; avoid a rows×distinct-tags scan for grouping.

   **Evidence / test coverage:** Static allocation/complexity finding, not a measured timing or crash benchmark.

26. **Share failure has no download escape path**

   **Severity:** Medium  
   **File:line:** `src/export/share.ts:23`; `src/features/export/ExportScreen.tsx:38`

   **What goes wrong:** canShare may return true while share rejects with NotAllowedError/DataError or another non-cancellation failure. The UI only offers the same Share action again, and neither the helper nor the error UI provides a download fallback.

   **Concrete repro/input:** Stub canShare to true and share to reject with NotAllowedError; click Share clean address book. No download is attempted and retry calls the failing API again.

   **Suggested fix:** Preserve AbortError as cancellation, but offer an explicit Download action or a fallback for other share failures.

   **Evidence / test coverage:** Static branch finding; existing share tests cover success, unsupported capability, and cancellation only.

27. **Unescaped mailto values can inject recipients or headers**

   **Severity:** Medium  
   **File:line:** `src/features/review/RowSheet.tsx:38`; `src/import/dedupe.ts:13`

   **What goes wrong:** Email values are accepted on the presence of @ and interpolated directly into a mailto URL. A value containing ?bcc= or &body= changes the compose request instead of remaining literal contact data; this is URI injection requiring a user click, not HTML execution or automatic upload.

   **Concrete repro/input:** Import EMAIL:friend@example.test?bcc=other@example.test&subject=hello and click it in Review. The email app receives the injected query fields.

   **Suggested fix:** Validate address syntax and encode the address portion according to mailto rules; construct tel links from validated dial strings and explicit supported extension parameters. [RFC 6068 syntax](https://www.rfc-editor.org/rfc/rfc6068.html#section-2) defines reserved delimiters.

   **Evidence / test coverage:** Static data-to-URL finding; no malicious URI fixture test.


## Low

28. **Removing contacts leaves orphaned custom-tag vocabulary**

   **Severity:** Low  
   **File:line:** `src/db/repo.ts:39, 72`

   **What goes wrong:** deleteContacts deletes contacts and decisions but never decrements db.tags. Removing the only contact carrying a tag leaves that tag in autocomplete, including tags from identities removed by import consolidation.

   **Concrete repro/input:** Give A custom tag private-client, remove A from the app, then open + tag on another contact. allTags still returns private-client.

   **Suggested fix:** Update tag counts in the deletion transaction or rebuild the vocabulary from surviving decisions after batch deletion.

   **Evidence / test coverage:** Static persistence finding; tag tests cover toggle removal only.

29. **Several frequent controls remain below 44 CSS pixels**

   **Severity:** Low  
   **File:line:** `src/ui/index.tsx:48, 151`; `src/features/deck/ActionBar.tsx:14`; `src/features/deck/SwipeCard.tsx:80`; `src/features/review/ReviewRow.tsx:75`

   **What goes wrong:** Chips are 36px tall, Back and Undo are 40×40, View all fields has a 32px minimum height, and the selection checkbox is 20×20 without a wrapping label hit area. These are below the requested 44px review target; the 36px/40px dimensions also originate in DESIGN.md and need an explicit product adjustment.

   **Concrete repro/input:** On a mobile viewport inspect the rendered hit rectangles and attempt adjacent chip/checkbox selection with a finger.

   **Suggested fix:** Keep the visual sizes if desired but expand the actual interactive hit areas to at least 44×44 with sufficient spacing.

   **Evidence / test coverage:** Static CSS dimensions; not presented as an automatic WCAG 2.2 AA violation, whose target-size rule has different thresholds/exceptions.

30. **Import announcements are nested and repeat the result**

   **Severity:** Low  
   **File:line:** `src/features/import/ImportScreen.tsx:34, 96`; `src/features/import/ImportPreview.tsx:7`; `src/ui/toast.tsx:68`

   **What goes wrong:** The import progress status is inside another atomic live region; on completion the live region and global toast both announce the same imported/merged result. Frequent progress changes can also announce the surrounding preview controls.

   **Concrete repro/input:** Import several chunks with a screen reader and observe the nested live-region changes, then the identical completion text in the toast and page.

   **Suggested fix:** Use one dedicated live announcer, keep previews/buttons outside it, and throttle progress announcements while retaining a single completion message.

   **Evidence / test coverage:** Static accessibility finding; actual announcement behavior depends on the screen-reader/browser combination and was not device-tested.

31. **The long-press Review test depends on real wall-clock timing**

   **Severity:** Low  
   **File:line:** `tests/review/ReviewScreen.test.tsx:88`; `src/features/review/ReviewRow.tsx:88`

   **What goes wrong:** The test waits for an actual 500ms long-press timer with waitFor’s default timeout rather than controlling time. Slow CI/event-loop contention can consume the remaining timeout budget, and the suite unnecessarily pays the half-second wait.

   **Concrete repro/input:** Run the Review test under CPU contention; the real timer must fire and React must render before the default waitFor deadline.

   **Suggested fix:** Use fake timers, advance exactly 500ms inside act, and explicitly test release/cancel before the threshold without arbitrary animation sleeps.

   **Evidence / test coverage:** Test-source finding; no runtime flake was claimed because the test runner could not launch.

32. **An accepted END:VCARD with trailing whitespace loses new labels**

   **Severity:** Low  
   **File:line:** `src/import/vcard.ts:26`; `src/export/vcf.ts:19`

   **What goes wrong:** The parser accepts trailing spaces/tabs on the END marker, but export only finds an exact END:VCARD line. Such a card is imported successfully and then exported without the new CATEGORIES line.

   **Concrete repro/input:** Parse BEGIN:VCARD\nFN:A\nEND:VCARD \n and export with Work. The probe retained the card but inserted no categories.

   **Suggested fix:** Use the same tolerated END-marker syntax in export as in import, inserting before the original line without changing unrelated raw text.

   **Evidence / test coverage:** Pure snapshot probe; this concerns tolerated noncanonical input, not a claim that trailing whitespace is required by the vCard standard.

## Verified OK

- UTF-8 quoted-printable bytes split between =C3= and the next line’s =A9 decode to José; the quoted-printable Windows-1252 example decodes to André €. LF-only cards, a family-only N:Smith;;;;, and an ORG-only company card also parsed in the probe.

- Folded base64 PHOTO with CRLF plus a continuation space decodes to a five-byte Blob in the refreshed probe. Remote HTTP(S) PHOTO values are not fetched, and the current codec rejects decoded photos above its explicit 2 MiB thumbnail-input limit; raw still retains the source payload.

- Blank/invalid phone and email values produce no generated dedupe keys. The refreshed merge recomputes keys, so the initial concern about imported stored empty-string keys causing a merge no longer reproduces; two records with blank stored keys remained separate.

- Ordinary same-ID re-import retains the survivor’s decision because import does not rewrite that decision. Import contact writes and superseded deletions share one transaction; this does not resolve the decision-conflict problem in finding 4.

- One saveDecision transaction covers its decision and vocabulary changes. resetAll clears contacts, decisions, tags, and metadata in one transaction; ordinary UI reset has confirmation and busy/error handling. Preferences in localStorage are intentionally separate from that IndexedDB reset.

- First skip queues a card once at the end; second skip removes it from the active pass and isUnsorted reports it. Within one pass, undo avoids duplicate queue entries and adjusts progress differently for a first skip versus a completed/second-skipped card. Existing tests cover these cases.

- Ordinary swipe failure rolls the optimistic queue/draft/counter back, and a ref prevents overlapping deck saves. Normal deck buttons and keyboard actions are disabled while follow-up is open. Follow-up stores the target contact ID rather than the new top card’s ID.

- A follow-up with a saved Work status or Personal relation is excluded when that later deck loads; the triage counter already advanced once and does not increment again on Done. The type-only case is finding 17.

- Keyboard handling ignores input, textarea, select, contenteditable=true, modifier shortcuts, and repeated keydown events. Chips remain drafts until swipe, which the existing tests assert; no blanket “shortcuts fire inside inputs” defect was found.

- Work status, selected types, selected tags, and search combine as intersections. Switching tabs through the UI resets incompatible status/type/tag filters. Multi-selection lookup uses Set.has, not a nested row search; the expensive bulk persistence path is finding 7.

- For ordinary raw cards, export preserves CRLF versus LF and retains non-category folded lines. Commas, backslashes, semicolons, and newlines are escaped in generated category values; complete existing CATEGORIES properties and their whitespace-folded continuations are removed together. The semantic loss from removal is finding 11.

- A raw VERSION:4.0 remains 4.0 and adding a TEXT-list CATEGORIES property is valid in that version; version conversion is unnecessary for that operation. This is a specification inference, not proof that iOS/Google Contacts expose those categories as native groups/labels: [RFC 6350 CATEGORIES](https://www.rfc-editor.org/rfc/rfc6350.html#section-6.7.1) and [vCard 3.0 CATEGORIES](https://www.rfc-editor.org/rfc/rfc2426.html#section-3.6.1). Native application round trips were not tested.

- CSV export enables Papa Parse escapeFormulae, and the delete-list export strips embedded line breaks. The current clean-file selector excludes Delete and the Export screen now labels overlapping lists explicitly.

- No contact-upload call, analytics call, dangerouslySetInnerHTML, eval of imported data, or raw-vCard HTML rendering appeared in the inspected source. raw is React text inside pre; fonts are local assets. Demo fetches, service-worker asset requests, user-invoked external help links, and explicit native Share are the observed network-related paths.

- The refreshed shared Sheet provides a portal, accessible title, focus containment, Escape handling, focus restoration, body-scroll locking, and reduced-motion handling. The earlier missing-focus-management implementation was replaced during this review and is not reported as a current defect; the follow-up wrapper and pending-close issues remain findings 18–19.

- GitHub Pages base is supplied by the deployment workflow, BrowserRouter derives its basename from BASE_URL, and current Workbox navigateFallback uses that base. postbuild copies index.html to 404.html. These source paths are consistent; offline installation and first-visit deep-link HTTP behavior were not browser-tested.

- The pre-existing dist/assets inventory contained 16 files totaling 1,415,552 bytes, largest JS 722,002 bytes, all below the configured 6 MiB per-file precache cap. Fonts, app assets, icons, and demo were listed in the existing worker precache. This inspected dist predates concurrent edits and is not evidence of a fresh successful build.

## Suggested test additions

- `dedupe_keeps_distinct_people_with_shared_landline_or_family_email` — two people with conflicting identity evidence remain separate until an explicit merge choice (finding 1).

- `dedupe_disambiguates_same_name_without_contact_keys` — two Alex Smiths with different source identity/organization are not collapsed, while re-importing the identical source is idempotent (finding 2).

- `import_threads_country_into_all_phone_keys` — Mexican national and +52 forms match each other, never the coincident +1 number; include UK national/explicit country pairs (finding 3).

- `bridge_merge_preserves_or_resolves_both_decisions` — classify only the losing record, then both records with conflicting buckets/tags; assert no decision disappears silently (finding 4).

- `merged_vcard_exports_union_of_fields` — merge complementary raw cards, export and parse, then assert both phones/emails and unknown source fields survive (finding 5).

- `deck_rejects_stale_decision_after_other_tab_edit_or_reset` — interleave load, external move/delete/reset, and swipe/undo; assert no obsolete bucket, tag, or orphan decision is written (finding 6).

- `triage_to_work_invalidates_or_reconciles_global_undo` — navigate with a visible Undo toast, invoke it, and assert Work membership/progress and stored decisions agree (finding 6).

- `bulk_mutation_rolls_back_on_row_501` — fail a 1,000-row move/reset/tag batch midway and assert all rows and tag counts remain unchanged; count transactions/live-query invalidations (finding 7).

- `restore_replaces_absent_decisions_and_preserves_photo_policy` — restore an undecided snapshot over Delete, include an extra live contact and photo, and assert the chosen replace/merge semantics exactly (findings 8–9).

- `restore_rejects_photo_objects_duplicate_ids_and_dangling_decisions` — malformed backup leaves all tables unchanged and never crashes Avatar (finding 10).

- `vcard_preserves_foreign_categories_and_unsorted_tags` — existing folded categories and tags on twice-skipped contacts survive export/re-import (findings 11–12).

- `vcard_21_charsets_and_grouped_labels` — literal Windows-1252 bytes, QP multibyte soft breaks, folded base64, item-group labels, family-only N, ORG-only companies, and structured ORG units produce expected values (findings 13–15 and verified cases).

- `vcard_generated_lines_fold_utf8_without_splitting_codepoints` — long category/note values unfold to the original strings, with generated physical lines no longer than 75 octets (finding 16).

- `followup_done_type_only_has_defined_completion` — assert documented membership after Neighbor-only/Vendor-only Done, plus Later and completed-primary variants (finding 17).

- `followup_pending_save_blocks_every_dismissal` — defer/reject persistence; exercise backdrop, close handle, Escape, drag, global undo, and disable-follow-up link, preserving retry state (finding 18).

- `followup_actions_remain_scroll_reachable_on_small_screen` — browser test at 390×568 with many tags and keyboard open; Done/Later remain reachable and focus stays visible (finding 19).

- `review_reswipe_scopes_real_decks_and_orders_mixed_passes` — mount the real destination deck with unrelated eligible contacts and a mixed Unsorted selection; assert only requested IDs are dealt in pass order (findings 20–21).

- `details_arrow_keys_scroll_without_deciding` and `home_continue_respects_twice_skipped_cards` — details scrolling never calls swipe, and ordinary Continue does not reset skip counters (findings 22–23).

- `export_preparation_is_bounded_and_share_failure_offers_download` — photo-heavy 5,000-contact browser fixture has bounded preparation/retained files; non-AbortError share failure exposes download while AbortError remains cancellation (findings 25–26).

- `mailto_reserved_characters_cannot_add_headers` — imported reserved delimiters cannot produce extra recipients, subject/body parameters, or unintended tel parameters (finding 27).

- `remove_contact_updates_vocabulary`, `import_announces_completion_once`, and `review_longpress_uses_fake_time` — deleted tags vanish, one completion is announced, and 499ms/500ms release behavior is deterministic (findings 28, 30–31).
