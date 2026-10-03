# Canonical VOWL SLICE-006 qualification

## Scope and status

The owner resumed candidate qualification on 3 October 2026 after the SLICE-005 merge at `1d91eb30ba12386e0b58bc7b41552814afdddc99`.
Work continues on `feat/canonical-vowl-qualification` in the primary checkout.
The retained `feat/canonical-vowl` branch and detached worktree remain intact by owner decision.
The unrelated `skills-lock.json` changes remain untouched.

The approved candidate laboratory qualification passes, with the owner's explicitly limited independent-review acceptance recorded below.
The complete SLICE-006 controlled-cutover outcome remains open for deployment reconciliation and the separate production gates.
The qualification operator and evidence custodian is this implementation task; a production observer remains to be assigned at cutover.
The production entry point, dependencies and configuration are unchanged.
The owner approved the separate [embedded-work default amendment](../specs/2026-10-03-canonical-vowl-embedded-work-amendment.md); canonical bytes and mapping rules remain unchanged.
Production cutover, freeze, publication and retirement retain their separate approval gates.
The SLICE-005 independent-review waiver does not apply to this slice.

## Measurement method

Evidence is retained under `C:/Users/maksy/.hi/w/e/operator-reports/canonical-vowl-01a0f1b9/slice006-qualification-20261003-01/`.
`resources.json` records one fresh browser process per fixture and engine, exact input/record/quad counts, timings, errors and sampled process memory.
The host is Windows `10.0.26300`, Intel Core i9-12900K, 24 logical processors and 34,053,869,568 bytes of physical memory.
The matrix uses Chromium `153.0.8010.12`, Firefox `155.0` and Playwright WebKit `26.6`, desktop 1280 by 900, English locale and UTC.
WebKit on Windows is not Safari on macOS or iOS certification.
This matrix also does not establish support across every browser version covered by the repository's Baseline policy.

The harness runs actual application worker load and capture operations.
The initial `resources.json` uses the original defaults; `final-resources.json` uses the approved 1,500,000 embedded-work default and consolidated optimizations.
It separates main-thread scene construction and synchronous request dispatch from asynchronous operation time.
The ten-millisecond heartbeat measures event-loop scheduling gaps, not INP or a guarantee of input latency.
Quad inspection runs after the timed operation and only for accepted artifacts.
Rejected operations expose neither partial output nor partial quad counts.

The external sampler measures the entire isolated browser process tree, including startup and post-operation quad inspection.
Private bytes and working set are different measures; neither is a JavaScript heap size.
Sampling includes process enumeration overhead, with observed intervals around half a second.
Short runs have only one or two samples and can miss their true peak.
The report therefore calls these sampled high-water observations and leaves exact per-operation `peakMemoryBytes` unset.
There are no automatic retries and no percentile or sustained-load claims.

## Observed resource boundary

| Fixture | Chromium elapsed | Firefox elapsed | WebKit elapsed | Outcome |
| --- | ---: | ---: | ---: | --- |
| Connected 100 classes | 0.693 s | 0.968 s | 1.864 s | Capture accepted in all three engines. |
| Connected 500 classes | 2.121 s | 2.769 s | 4.438 s | Capture accepted in all three engines. |
| Connected 2,000 classes | 5.799 s | 6.828 s | 8.566 s | Load accepted; capture rejected with `RDF_RESOURCE_LIMIT`. |
| Disconnected 2,000 classes | 3.424 s | 5.410 s | 11.230 s | Chromium and Firefox accepted; WebKit capture reached its operation deadline. |
| Symmetric disjoint 16 classes | 0.415 s | 0.903 s | 0.680 s | Capture accepted in all three engines. |
| Depth 160 | 0.119 s | 0.309 s | 0.137 s | Rejected with `MODEL_RESOURCE_LIMIT`. |
| 1,000 classes with a 100-record budget | 0.122 s | 0.270 s | 0.173 s | Rejected with `MODEL_RESOURCE_LIMIT`. |

The 500-class connected case has 1,499 primary records, 1,498 occurrences and 28,108 refined quads.
Its maximum heartbeat gaps are 43.3, 44 and 47 ms respectively; synchronous capture dispatch takes 17.2, 18 and 20 ms.
Its sampled private-byte high waters are 309,141,504, 733,925,376 and 1,411,653,632 bytes respectively.
These are fixture observations, not a general 500-class capacity limit: topology, retained annotations, occurrences, depth and symmetry also determine cost.

The 2,000-class connected case has 5,999 primary records and 5,998 occurrences before capture.
Its largest heartbeat gap reaches 190 ms, and synchronous capture dispatch reaches 90 ms.
The earlier direct-operation diagnostic identifies `embeddedValues` 500,001 against the 500,000 default; the browser deliberately exposes only the safe error code.
The direct diagnostic remains in `live-recovery-20261003-01/resource-limit-diagnosis.json`.
No budget was raised for this initial measurement matrix; the later approved amendment and final results are recorded below.

The disconnected WebKit result is a genuine boundary finding: the previous probe accepted it in 9.284 seconds overall, while this run reaches the ten-second capture deadline after a successful load.
The overall load-plus-capture elapsed time can exceed ten seconds because each operation has its own deadline.
It is not defensible to label that workload reliably supported across the matrix from the earlier passing sample.
Before accepting a larger operating envelope, investigate refinement cost and main-thread checkpoint/scene work, then repeat only the affected cases under an agreed workload objective.

## Cancellation and stale work

`browser-gaps.json` supplements the resource runs with a real production worker paused at import acquisition.
Aborting the caller synchronously aborts the resolver's signal, rejects the operation with `LOAD_ABORTED`, and prevents a resolver that ignores cancellation from reviving it when its bytes arrive later.
This tests cooperative acquisition cancellation without relying on an external server.
CPU-bound worker cancellation uses immediate termination rather than waiting for a worker acknowledgement.

Across the final gap run, deliberately nonresponsive workers terminate in 0–1 ms after abort, below the 250 ms policy ceiling.
Deadline probes reject with `RESOURCE_LIMIT_EXCEEDED`; elapsed values include timer scheduling overhead.
Wrong-generation peer responses are ignored and each job terminates its worker exactly once.
These worker checks complement, rather than replace, the existing controller tests and SLICE-005 real-browser restoration/rollback evidence.

## Accessibility and presentation

The additional built-candidate probe passes eleven checks per engine, including its worker prerequisite, with no page errors.
It verifies a programmatically labelled section selector, all seventeen retained-facts sections, keyboard expansion of assertions, textual kind/property relationships, status announcements for pagination/revision, dark text on white, forced-colors control visibility, expanded content fitting a 320 CSS-pixel viewport, and focus restoration.
The probe inspects a retained functional data-property assertion, not merely a graph label.
The facts view provides textual access independently of graph colors, including qualifications and records that have no drawn shape.

These results extend the earlier nine-check native-dialog probes and the six SLICE-005 browser/locale/viewport runs with 107 checks each.
Those earlier runs cover full IRI text, modal background exclusion, Escape, paused restoration, hidden/pinned placements, camera state and independent display vectors.
A DevTools accessibility-tree inspection of the current built FOAF candidate also exposes labelled graph symbols, toolbar controls and zoom controls.
This is not an assistive-technology audit or a claim that all application interactions meet WCAG.
The plan's independent accessibility review for cutover remains outstanding; no additional reviewer was launched under an already-consumed approval.

The initial gap runner failed because its preview invocation resolved a relative output path beneath Vite's `src` root.
Using the existing `canonical` preview mode corrected the invocation without configuration changes.
A subsequent assertion read the native `details` element before its queued `toggle` handler populated fields; waiting for the first displayed field corrected the probe.
Both failed receipts are retained; neither was treated as product acceptance.

## Consumer and legacy reconciliation

| Surface | Qualified disposition | Remaining boundary |
| --- | --- | --- |
| OWL file, paste and remote source | Public owlapi parser capability selection, retained import closures and explicit format continuation. | Cross-origin availability and remote server behavior are not guaranteed by local fixtures. |
| Canonical file and URL | Package byte admission and paused portable-state restoration. | Draft identity remains experimental until freeze/publication. |
| Historical JSON | Only the named `webvowl-legacy-354ed3af8c1e82019f6280b2594acaceac96cca0` contract. | Unknown dialects and unrecoverable historical meaning are not inferred from shape. |
| Six named examples | Qualified source regeneration and fresh layouts; historical files retained. | Existing source/import notice and distribution questions remain publication gates. |
| New ontology and semantic edits | Package-owned creation and atomic edit paths with explicit loss and merge choices. | Experimental semantic edits remain outside WebMCP. |
| Share links | Source-reference links. | Edited documents must be exported; source links do not capture edited state. |
| Canonical JSON | Exact package bytes, `.vowl.json`, portable presentation. | Stable production writes require freeze/publication. |
| Original source | Exact retained bytes or explicit unavailability. | Artifacts without retained original bytes cannot reconstruct them. |
| Turtle | Current retained semantics through the package OWL adapter. | Does not claim reconstruction of excluded source statements. |
| SVG and LaTeX | Captured drawing exports. | A drawing is not a complete semantic exchange artifact. |
| Human and WebMCP arrangement | Shared runtime arrangement contract and existing regression evidence. | No certification of unknown external clients. |

Git history from the dialect pin through merged `main` shows no changes to `vowlBuilder.js`, `vowlDocumentArrangement.js` or `vowlVisualizationSettings.js`.
The sole change to `visualizationArtifactService.js` in that range is SLICE-005: it adds canonical/source publication and factors Blob/publication handling while leaving the historical serialization branch unchanged.
This is source-history evidence, not a complete deployment ledger.
The six historical presets identify older OWL2VOWL 0.3.7/WebVOWL 1.1.7 exporters and retain their explicit regeneration disposition.
Actual deployed exporter revisions, any out-of-repository deployments and downstream consumers must still be reconciled before cutover/retirement.
No live deployment was changed or silently assumed to equal Git `main`.

## Accepted objectives and remaining production decisions

The owner subsequently accepted the two 2,000-class fixtures as repair targets: load and capture within ten seconds overall, heartbeat gaps below 100 ms, and sampled private browser memory below 2 GiB on this host, retaining existing budgets and cancellation protections.
An initial implementation batches up to 32 independent refinement hashes while bounding their combined scratch allocation by the existing string ceiling and preserving every work charge and round boundary.
The focused refinement/compatible-artifact suites pass 41 tests.
The affected WebKit disconnected fixture now captures in 5.309 seconds overall, with a 77 ms heartbeat gap and 1,511,194,624 sampled private bytes (`batched-resources.json`).
Scene initialization also replaces a whole-occurrence scan per class with one ordered operator-adjacency index; its six scene tests pass.
After both optimizations, the disconnected case passes in Chromium, Firefox and WebKit at 3.740, 4.642 and 5.423 seconds overall.
Their respective heartbeat gaps are 62.4, 75 and 76 ms; sampled private memory is 432,660,480, 785,195,008 and 1,602,686,976 bytes.
These runs are retained as `repaired-chromium-resources.json`, `repaired-firefox-resources.json` and `repaired-webkit-resources.json`.
The package tests plus scene tests pass 29 suites and 7,044 tests at this intermediate stage.
The worker-client test path supplied to that command did not name the actual worker test file; later focused runs explicitly exercise `canonicalVowlWorker.test.js`.
The initial governed full profile passed before these performance changes; it must be refreshed on the consolidated final source.

The connected fixture exposes a conflict between the accepted workload and the instruction to retain the current budget.
A separate Node diagnostic with an explicit, temporary 4,000,000 embedded-value allowance measures 1,198,948 required units for capture, including 1,188,891 units charged by refinement.
That diagnostic captures 942,135 bytes in 5.257 seconds; it is not default-budget or browser acceptance.
The current mapping contract explicitly charges index construction and every visited incident quad in every round.
Reducing hash latency cannot make that fixed computation fit the 500,000-unit default, and silently skipping those charges would violate the contract.
`refinement-diagnostic.json` retains the per-operation counts and identifies the diagnostic override.
The owner subsequently approved the 1,500,000 default, retaining the 4,000,000 maximum and all other limits.
The separate amendment preserves the evidence-pinned original contract and documents the broader parser/data admission impact.

The final 24-run resource matrix meets the accepted objectives for both target fixtures in all three engines.
Deep and poison fixtures still reject, and nonresponsive deadline/cancellation, stale responses and cooperative import cancellation still pass.
This is one final sampled run per fixture/engine, supplemented by retained developmental runs; it is not a percentile guarantee.

| Engine | Connected elapsed / heartbeat / sampled private bytes | Disconnected elapsed / heartbeat / sampled private bytes |
| --- | --- | --- |
| Chromium | 6.170 s / 89.9 ms / 577,376,256 | 2.784 s / 51.3 ms / 427,204,608 |
| Firefox | 7.775 s / 77 ms / 953,692,160 | 3.593 s / 37 ms / 784,900,096 |
| WebKit | 8.565 s / 91 ms / 1,684,647,936 | 4.470 s / 78 ms / 1,521,459,200 |

The consolidated repair batches independent ground and round hashes with bounded concurrent scratch storage, reuses identical hashes within each batch, precomputes fixed JSON term spellings and hexadecimal bytes, and aggregates exact string-byte charging before allocation.
It retains periodic deadline checks and every incident-work charge.
Checkpoint accounting avoids per-character callbacks for plain ASCII and avoids constructing unused JSON Pointers; the source-byte exemption still requires the exact nested field path.
Worker results resume consumer processing in a subsequent task so large clone receipt does not share a task with scene construction and the next request snapshot.
Cancellation and deadline settlement remain active during that interval.
Targeted tests cover exact work-boundary failure with pending hashes, ASCII/escaped/Unicode/surrogate byte boundaries, cancellation during result delivery and rejection of slash-containing keys masquerading as nested byte paths.
The two larger fixtures remain explicit acceptance cases rather than disappearing because smaller examples pass.
The owner-selected repair target is a measurable floor, not a promise that all ontologies with 2,000 classes have equivalent cost.
The only default adjustment is the owner's explicitly approved embedded-work amendment, supported by the measured accounting conflict.

Candidate qualification and production approval remain distinct.
A production successor must record its exact build digest, core/adapter/dependency identities, both frozen canonical profiles, all emitted mapping profiles and corresponding published corpus/adapter results.
Every candidate-to-production difference, including removal of experimental identification, needs scoped requalification.
Before exposing new writes, the previous application can be redeployed.
After users have canonical-only files, recovery must preserve a qualified new reader; disabling affected writes or applying a forward fix is preferable to assuming the old reader can reopen them.
Assign the production observer and record the cutover decision only when those gates and consumer reconciliation are complete.

## Consolidated checks and independent review

The final functional matrix passes 107 checks in each of six browser/viewport/locale variants, with no console errors or warnings, and loads all six rebuilt examples in each desktop engine.
The final 24-run resource matrix is `final-resources.json`.
After the reviewer-requested terminal-message repair, `post-review-browser-gaps.json` passes eleven checks in each engine, including real-worker cancellation/deadline/stale-import checks and the built-candidate facts interface.
The resource matrix predates only that terminal-message guard; the guard does not change the normal capture computation, and its affected worker path has targeted post-change checks.

The first final repository run passed 9,117 tests and failed one architecture test when its recursive authored-source scan entered Vite's generated `src/node_modules/.vite` cache while that cache changed.
The crawler now excludes dependency directories without changing its authored-consumer import rules.
The repaired affected profile passes all 165 suites and 9,119 tests.
The test runner's `Prettier would reformat` messages refer to deliberate negative fixtures inside passing documentation tests, not unformatted working-tree documents.
The governed full profile passes application formatting/linting and the production build; the authoritative final receipt is retained as `final-full.log` alongside `repaired-affected.log`.
The build retains its existing large-chunk advisory; no bundler setting was changed to suppress it.

The owner authorized one Claude review capped at ten minutes with no automatic retry.
Claude Code 2.1.285 completed it in approximately 145 seconds and the reviewed file hashes remained unchanged.
It found no canonical mapping, accounting or scene-order defect in the source it read.
It found a low-severity worker issue: a peer import arriving after a result but before deferred settlement could still start acquisition.
The client now closes peer messages/errors after the first result while keeping caller cancellation and deadlines active, with a regression proving no late import acquisition and one final settlement.
Three documentation findings were corrected by explicitly superseding the mapping draft's historical default statement, distinguishing baseline measurements from approved changes, and separating intermediate from final checks.

The reviewer could not read the external patch and evidence files because its restricted file tools were confined to the repository.
It therefore did not independently verify the measurements or compare the old source with the patch, and did not review the complete harness or increased parser allowance effects.
This is a bounded source review with explicit gaps, not full independent qualification coverage.
Exact evidence copies were prepared in the ignored repository cache for a proposed narrowly scoped follow-up.
The owner instead accepted the limited source review and explicitly waived the remaining independent coverage for this increment.
No follow-up reviewer was run; the unread scopes remain disclosed rather than relabelled as reviewed.
The waiver neither grants production approval nor retrospectively certifies the complete application, parser envelope or assistive-technology experience.

## Resumption checkpoint

All implementation changes remain uncommitted on `feat/canonical-vowl-qualification`.
The final source/build/evidence inventory is `completion.json` in the evidence directory above.
The preserved branch/worktree and unrelated `skills-lock.json` edits remain outside this increment.
No commit, push, freeze, publication, deployment or legacy deletion occurred during qualification.
The next programme stage must reconcile actual deployed legacy exporter revisions and consumers, resolve the recorded publication obligations, and prepare exact freeze/publication and production-artifact decisions under the accepted plan.
Reuse the qualified source and retained measurements; rerun only checks affected by subsequent changes or a changed environment.
