# W6 whole-load profile and optimization proposal

| Field          | Value                                                                                                                                                             |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Decision       | PERF-DEC-014, approved: Option A plus a separate design for cheaper display-ranking identity                                                                      |
| Date / owner   | 23 October 2026 / Maksym Shostak                                                                                                                                  |
| Trigger        | The owner considers the observed 12.8–13.0-second source load unacceptable and requested deep profiling and optimization proposals.                               |
| Predecessor    | Approved [PERF-DEC-013](2026-10-23-initial-layout-improvement-plan.md); its initial-placement candidate remains uncommitted and under qualification.              |
| Source         | `feat/architecture-performance-ui`, HEAD `0b9dd773028dc78cb1492cf0bfa41b7424d90a70`, plus the initial-layout candidate bound by production manifest 4             |
| Recommendation | Optimize redundant preparation, RDF query materialization and exact-identity computation in bounded experiments; preserve the current ranking contract initially. |
| Delivery state | [PR #85](https://github.com/Hadden-Industries/webvowl/pull/85) stays draft; actual-platform acceptance remains pending.                                           |

## Finding and measurement boundary

**The main delay precedes drawing. Better initial node positions address a different, smaller part of this load.**
Four untraced foreground loads of the real extended universal ontology, showing all 953 nodes, took 12.797–12.992 seconds from already-acquired source bytes to the observed frame boundary.
Their admitted-data-to-usable-drawing intervals were 773–846 ms, with seed preparation of 5.8–6.8 ms.
These four observations are descriptive; they do not establish the plan's twenty-sample p95 acceptance or a before/after improvement.

The latest diagnosis uses the same optimized production bytes and the same source, displaying the ordinary automatic selection of 50 nodes.
The worker still prepares the complete model and stable ranking identity.
A browser-wide trace captures that short-lived worker as well as the page; a page-only profile would miss the dominant work.
No force, scheduling, package, configuration or product implementation was changed for this investigation.

The workload is 3,023,054 source bytes, SHA-256 `d7eb7980436600ab50c8a5df35401a4a345fe4362d111f2d8e6f90217505b077`.
It contains 25,996 source RDF quads and produces 953 class/datatype node occurrences, 3,331 total visual occurrences and 26,500 structural primary records.
Those are different populations; visible-node count alone understates this implementation's preparation work.
Source contents remain local and are not included in this document or external review inputs.

**The load boundary excludes file selection, disk reading and network acquisition:** the harness supplies source bytes already in memory to the ordinary OWL controller route.
It includes worker startup, parsing, assessment, model preparation, checkpointing, ranking, return/publication, drawing and frame opportunities.
Natural layout settlement is subsequent and separate.

## Browser attribution

One headless traced automatic-view load took 13.979 seconds.
Tracing adds overhead, and the accepted busy-host exception remains in effect.
Use these measurements to locate work, not as foreground latency acceptance or as percentages to apply mechanically to the earlier 12.8–13.0-second runs.

| Serial interval                                  |     Time | Share of traced load | Interpretation                                                                                                                   |
| ------------------------------------------------ | -------: | -------------------: | -------------------------------------------------------------------------------------------------------------------------------- |
| Startup and dispatch                             |   109 ms |                 0.8% | Includes controller setup, worker creation/module work and request dispatch; not a pure startup timer.                           |
| OWL loading                                      | 2,774 ms |                19.8% | Syntax loading, RDF handling and OWL translation; not XML tokenization alone.                                                    |
| OWL assessment                                   |   587 ms |                 4.2% | Existing profile/source assessment.                                                                                              |
| Model construction and source retention          | 1,599 ms |                11.4% | Includes normalization; source retention itself is not the entire cost.                                                          |
| Live-model admission interval                    | 1,520 ms |                10.9% | Unmarked interval between retention completion and checkpoint start; sampled stacks identify admission/snapshot/validation work. |
| Inspection and checkpoint                        |   494 ms |                 3.5% | Existing `webvowl.owl-checkpoint` boundary.                                                                                      |
| Stable ranking identity                          | 6,271 ms |                44.9% | Full structural mapping, refinement and canonical identifier issuance.                                                           |
| Worker reply through main-thread admission start |   217 ms |                 1.5% | Includes reply preparation, serialization/deserialization, scheduling and client handling.                                       |
| Admitted data to usable drawing                  |   384 ms |                 2.7% | Ownership/preparation/rendering/paint boundary for 50 nodes.                                                                     |
| Remaining frame observation and interphase gaps  |    26 ms |                 0.2% | Approximately 24 ms after drawing and 2 ms between worker stages.                                                                |

The intervals partition the trace rather than adding overlapping CPU stacks.
The page's sampled idle time is approximately 13.4 seconds; most elapsed time is in the worker.
The actual automatic node-selection measure is **9 ms**; its expensive prerequisite is stable identity preparation.

Even eliminating the entire 6.27-second ranking phase would leave approximately **7.71 seconds** in this traced load.
That is an upper-bound illustration, not a feasible or approved removal: improving ranking alone cannot deliver a near-instant load.

## Expensive call paths

### 1. Structural ranking expands and repeatedly hashes the graph

The production path is [`readModelRankingIdentity`](../../packages/vowl/src/index.js) → [`issueIds`](../../packages/vowl/src/internalRdf.js) → [`refineDataset`](../../packages/vowl/src/refinedRdf.js) → `rdf.canonize`.
The private refinement prepares 209,716 mapped quads and 46,162 internal blank nodes.
Seven rounds produce 46,162 final classes; the augmented dataset sent to RDFC contains 255,878 quads.
The internal graph describes structural records, fields, sets and other values; it is much larger than the drawing.

An instrumented source-level run, preserving every native operation, counted:

| Work                                              |                           Count / volume |
| ------------------------------------------------- | ---------------------------------------: |
| Ground-term SHA-256 calls                         |                                   10,563 |
| Color-refinement SHA-256 calls                    |                                  287,890 |
| Total refinement digest input                     | 334,592,277 bytes, approximately 319 MiB |
| Largest color-signature digest input              |                          3,202,917 bytes |
| Maximum simultaneously pending refinement digests |                   32, the existing bound |

The browser trace contains 344,615 ranking digest events: the 298,453 refinement digests above plus 46,162 hashes attributable to the browser RDFC path.
Its native event forms include both complete and instant events; treating only complete events as the call count would undercount them.

Worker sampling attributes approximately 4.36 seconds inclusively to refinement and 2.43 seconds inclusively to its digest helper; **these overlap**.
Sample locations concentrate in digest submission and UTF-8 encoding, with roughly 0.25 seconds around the subsequent array/hex construction.
These are optimized-code sampling locations, not independent expression timers.
An isolated Node decomposition corroborates the structure: approximately 4.99 seconds in refinement and 0.53 seconds in RDFC, with exactly the same occurrence correspondence as the public ranking API.
Node's RDFC crypto backend differs from Chrome's, so those Node durations must not be substituted into the browser table.

**Implication:** optimize signature construction, encoding and digest execution before replacing the renderer or RDFC indiscriminately.
Simply increasing concurrency is not an established solution: the implementation already batches 32 digests and bounds their scratch storage.
Stopping refinement early, skipping “already unique” vertices, or changing signature spellings can change final colors and identifier ordering even when graph meaning remains equal.
Such changes are outside an exact-identity optimization.

### 2. Resource/deadline polling is itself material

The native-operation counter observed **21,309,617 [`ResourceBudget.check()`](../../packages/vowl/src/resourceBudget.js) calls** across one open/checkpoint/ranking sequence:

| Public operation |      Calls |
| ---------------- | ---------: |
| Open OWL model   | 10,952,874 |
| Checkpoint       |  2,402,956 |
| Ranking          |  7,953,787 |

The browser profile attributes approximately **2.43 seconds of sampled self time** to that method across the load.
This overlaps the serial phases above and is not an extra duration to add to them.
`charge()` and `bound()` both call it, while traversals also call it directly; every call consults the monotonic clock.
Snapshotting repeatedly checks field names, strings, depths and values, and builds error-pointer strings on successful paths.

This does **not** justify removing resource bounds or cancellation.
The [A8 contract](../specs/2026-09-24-canonical-vowl-core-contract.md#a8-resource-and-worker-policy) requires checks at stage boundaries and at least every 1,024 visited values/emitted quads, alongside exact aggregate bounds and whole-operation deadlines.
A carefully designed bounded polling cadence may satisfy that contract with much less clock traffic, but must explicitly preserve pre-aborted behavior, error precedence, post-await checks and pre-publication rejection.
Large strings and single expensive operations require their own bounded checks; counting only outer records is insufficient.
The existing worker deadline and termination remain independent safeguards.

[`normalizeDraft`](../../packages/vowl/src/editing.js) also performs whole-tree alias rewrites after deduplication steps even when a step adds no aliases.
The browser sampled about 1.27 seconds inclusively in normalization during model construction.
Tracking whether aliases changed, and delaying error-pointer formatting until needed where safe, are candidates for eliminating work while retaining exact semantics.
Their individual savings have not yet been measured.

### 3. RDF queries repeatedly materialize data

Source-level sampling identifies `RdfToOwlTranslator.#readDeclarations`, `DatasetCore.match`, `_findInIndex`, `_getQuad` and `_addToIndex`.
An independent counter probe of the unchanged OWL load observed:

| Work                                                 |                                  Count |
| ---------------------------------------------------- | -------------------------------------: |
| `DatasetCore.match()` calls / new matched datasets   |                                 27,384 |
| Whole-dataset matched copies                         |       14, each containing 25,996 quads |
| Subject-only queries                                 |                                 27,369 |
| Quads materialized by all matched datasets           |                                528,029 |
| Quad insertions across source and temporary datasets |                                580,021 |
| Full internal traversals of the main dataset         | 40, visiting 1,039,840 quad references |

These counters overlap; they are not independent costs to add.
The translator's `#outgoing(subject, predicate)` queries all outgoing quads for a subject, builds a new dataset, converts it to an array, then filters by predicate.
Several other paths request `match(null, null, null, null)` only to iterate the entire dataset.

The behavior of `match()` is required by the [RDF/JS Dataset specification](https://rdf.js.org/dataset-spec/#dfn-match): it returns a new dataset.
The optimization belongs in the translator's private read path, rather than changing that public method to return an alias.
An operation-local quad sequence and subject/predicate index can serve read-only traversal and queries without repeatedly rebuilding datasets.
It must preserve RDF term equality, ordering-sensitive recovery behavior, duplicates, graph handling, diagnostics, source evidence, cancellation and lifetime bounds.
This code is in the OWLAPI dependency, so implementation and subsequent dependency adoption need explicit scope and exact package-change approval.

## Approved order and bounded experiments

On 23 October 2026 the owner selected **“A plus a separate design for cheaper display-ranking identity.”**
This approves A1–A4 within their exact-semantics envelope and the five-second whole-load target below.
It also authorizes a separate B decision record, not implementation of a changed ranking contract.
New cryptographic backends and exact dependency/configuration changes remain separate decisions.

**Option A — retain existing semantics and identity; select bounded optimizations (recommended).**
The order favors demonstrated, localized waste before adding another algorithm or backend.

| Step | Proposed change                                                                                                                                                                                     | Why / bounded opportunity                                                                            | Proof and stopping condition                                                                                                                                                                                                                                                                                                |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1   | Avoid no-op normalization rewrites; reduce successful-path error-pointer and temporary-object construction.                                                                                         | Normalization occupies a substantial part of the 1.60-second construction phase.                     | Identical model, occurrence correspondence, diagnostics/error pointers and charged totals; aliases must still propagate at every required dependency boundary. Stop if validation or normalization order changes.                                                                                                           |
| A2   | Separate exact quota enforcement from bounded clock/cancellation polling inside privately owned traversal work.                                                                                     | About 21.3 million checks and 2.43 seconds sampled self time.                                        | Keep all quota charges before allocation, stage/await/publication checks, pre-aborted refusal and worker termination. Test expiry/cancellation inside every supported chunk, long strings, low-limit failures and worst-case overshoot. The precise cadence is a design choice to record, not permission to disable checks. |
| A3   | Give OWL translation one bounded, operation-local read index; remove unnecessary matched-dataset copies and broad queries.                                                                          | 27,384 materializations and 40 full internal traversals of the main source dataset.                  | Exact OWL model/source-assessment/evidence output across the real fixture and parser corpus; shuffled triples, blank nodes, recovery cases and hostile-input limits. Implement in OWLAPI, with no monkey patch of installed dependencies.                                                                                   |
| A4   | Compare allocation-conscious signature/UTF-8/hex preparation and, if still justified, an independently vetted SHA-256 execution backend. Keep exact preimages, rounds, hashes and identifier order. | Refinement dominates the 6.27-second ranking phase; encoding/submission dominates its digest helper. | Exact per-stage hash/correspondence/canonical-byte oracles and equivalent accounting, bounded scratch and cancellation. A new dependency/backend requires a concrete selection and exact configuration approval; it is not selected implicitly here.                                                                        |

For A4, native [`Uint8Array.toHex()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array/toHex) is a small candidate with a compatibility fallback, not a multi-second remedy by itself.
MDN records availability across current browsers since September 2025; the repository's supported-browser policy still governs adoption.
WebCrypto remains the correctness reference for any proposed SHA-256 backend.
Do not combine several messages into one hash: that changes the algorithm's inputs and outputs.
Do not expand digest caches solely on speculation; the earlier S7 work found limited exact repeat bytes on W5.

Each experiment is retained only if its targeted work count falls for the predicted reason, outputs remain equal and an uninstrumented comparison corroborates a useful gain.
Sampled phase costs are opportunity bounds, not promised savings; the steps overlap and their estimated benefits must not be added.

**Option B — also redesign display-ranking identity as a separate contract.**
Investigate whether automatic node selection needs canonical identifiers for the complete structural envelope at all.
A display-specific deterministic key could avoid much of the ranking phase while canonical export continues to use its complete validation and identity process.
This is a larger design decision: anonymous/symmetric entities, source-order independence, tie-breaking, default visible nodes, edits, capture and human/agent parity need explicit rules.
It must not silently replace public handles or weaken canonical export.
Deferring ranking only for an all-node view would not solve ordinary automatic 50-node loading.
Recommend deciding on B after A's bounded experiments establish the remaining cost, or choosing it explicitly if preserving current selection tie-breaks is less valuable than a much lower first-load budget.

**Option C — retain the measured delay and finish only initial placement.**
This remains possible but does not address the owner's stated usability concern; it is not recommended.

Worker warming/pooling, extra workers, progressive rendering, GPU work, a new force solver, lighter validation and a larger acceptance budget are not selected by any A step.
Startup/dispatch and the return gap together were only about 0.33 seconds in this trace.
Assessment was about 0.59 seconds; skipping it would sacrifice behavior while leaving most delay intact.
The [RDFC security considerations](https://www.w3.org/TR/rdf-canon/#security-considerations) and the [implementation's complexity controls](https://github.com/digitalbazaar/rdf-canonize#complexity-control) support retaining hostile-input bounds while optimizing normal work.

## Accepted target and delivery

The existing one-second **admitted-data-to-drawing** target stays distinct from the accepted **already-acquired-source-to-usable-frame** target.
For the latter, the owner accepted **p95 at or below 5 seconds for W6**, in both automatic and all-node modes, as the next acceptance goal.
This is a product budget, not an achieved result or a prediction that A must reach it.
If bounded exact-behavior work cannot reach it, return with the measured residual and a concrete B design rather than relaxing the budget or extending implementation silently.
Sub-two-second loading is a useful longer-term ambition; current evidence does not support promising it from a small change.

Use W6 as primary, W5 as a second real workload, smaller public fixtures for common-case regression and W4 as a stress guard.
Require identical semantic inspection, ranking correspondence and canonical bytes where A promises them; full malformed/adversarial corpus, aggregate-counter boundaries, cancellation/deadline and worker/session lifetime proof remain required.
No retained read index or buffer may outlive its operation without a separately justified owner.

Start with deterministic work counts, source-level tests and headless diagnosis.
Consolidate successful changes before broad verification and resolve actual test findings.
On 23 October 2026 the owner waived the final AGY review and any extra verification runs solely for HISEW bookkeeping.
Reuse applicable passing evidence, preserving failed receipts and unavailable coverage explicitly.
Only then qualify optimized code with untraced foreground A/A and before/after cohorts, at least twenty samples per version/workload as required by the performance plan.
Keep initial placement, full load, natural settlement and count adjustment as separate metrics.

This decision extends PERF-DEC-013 and the [S7 decision](2026-10-23-worker-experiment-decision.md) only for A's bounded package optimizations.
Changed ranking semantics and worker redesign remain unselected.
Any package, lockfile, build, test or policy setting still requires approval for its exact change under `AGENTS.md`.

## Implementation slices and proof

The accepted R2 execution continues; no new parallel writers or broad interim external reviews are introduced.
The source baseline is HEAD `0b9dd773028dc78cb1492cf0bfa41b7424d90a70` plus the retained initial-layout candidate and collector correction.
Manifest 4 and the profile receipts below describe the measured predecessor, not future optimized bytes.

| Slice                | Requirement and acceptance                                                                                                                   | Implementation seam and dependency                                                                                                                                                                                                                                      | Proof / recovery                                                                                                                                                                                                                                                      |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SLICE-013 / A1       | REQ-201 / AC-201: remove redundant normalization traversals while preserving model, handles, correspondence, diagnostics and charged totals. | `normalizeDraft` owns alias propagation. Skip rewriting only when no new aliases have been introduced since the previous rewrite; newly appended records must use resolved/current references.                                                                          | QA-201: aliases across subject, role, expression, endpoint and signature closure; full malformed corpus; identical W6 inspection/checkpoint/ranking hashes; measured traversal reduction. Reverse only this slice if equivalence fails.                               |
| SLICE-014 / A2       | REQ-202 / AC-202: reduce clock work with no quota weakening or publication after expiry/cancellation.                                        | `ResourceBudget` owns a maximum 1,024-step polling cadence. Immediate `check()` remains at stage, await and publication boundaries and within long-string chunks; exact quota enforcement precedes allocation. Migrate measured inner traversals only.                  | QA-202: deterministic deadline/abort checks at chunk boundaries, immediately after awaits and before return; quota error precedence and counters; long strings, hostile depth and existing worker termination. A failed proof retains immediate polling at that seam. |
| SLICE-015 / A3       | REQ-203 / AC-203: remove RDF matched-dataset materialization without changing OWL interpretation, source evidence or term equality.          | Private OWLAPI translation read access, one operation-owned immutable index. Inspect upstream source versus installed `0.1.0-rc.2` first; isolate source work from unrelated checkout ownership. Application adoption waits for a concrete, approved dependency change. | QA-203: independently equal OWL/assessment output, real W6 and RDF parser corpus, shuffled triples, blank nodes, named graphs and compatible recovery. Query counters must fall; temporary indexes must become unreachable at operation end.                          |
| SLICE-016 / A4       | REQ-204 / AC-204: reduce exact-identity allocation without changing preimages, hashes, rounds, IDs or limits.                                | Existing refinement digest producer, platform SHA-256 and standard typed arrays. A replacement backend is not selected.                                                                                                                                                 | QA-204: independent hash preimages and canonical-byte fixtures, forced compatibility path, existing scratch/concurrency bounds and cancellation. Retain only measured improvements.                                                                                   |
| SLICE-017 / B design | REQ-205 / AC-205: present a separate decision for cheaper display ranking.                                                                   | Application ranking versus package canonical identity; preserve public handles/export authority. Depends on A's residual profile.                                                                                                                                       | QA-205: compare anonymous/symmetric cases, source ordering, edits, selection ties, cached lifetime, human/agent parity and fallback costs. No ranking-semantic implementation before owner selection.                                                                 |

**Shared-rule ownership (DRY-01):** the A8 contract and `ResourceBudget` remain the single quota/deadline authority; traversals select immediate boundaries or bounded inner work, not their own cadence constants.
Normalization remains the sole alias-rewrite authority.
The OWLAPI translator owns its private RDF read semantics; no application monkey patch or duplicated parser is introduced.
The existing refinement producer owns exact identity bytes; the B design must name a distinct display rule rather than silently reuse canonical terminology.
Tests retain independent expected values instead of calling the optimized implementation to manufacture their oracle.

**Reuse and operational bounds:** extend existing modules and standard `Map`, typed-array and WebCrypto capabilities; introduce no dependency or policy configuration for A1/A2/A4.
The current browser policy requires feature detection for newly available `toHex` if selected.
Do not retain operation data in process-wide caches or expand the accepted resource limits.
Work-count probes precede uninstrumented timing; the optimized production build gets a new manifest before any foreground qualification.
Replan if a measured gain requires changed normalization/validation order, term identity, ranking semantics, worker scheduling or resource policy.
The owner retains acceptance of missed latency targets and unavailable manual-platform coverage.

## Evidence, checks and limitations

### Implementation checkpoint after approval

A1 now skips alias rewrites when no new aliases exist at that normalization boundary.
The first real-source counter comparison removed 1,024,755 open-path checks while preserving inspection, checkpoint and ranking hashes and charged totals.
A2 separates exact quota charging from clock/cancellation polling at most every 1,024 small work visits, retaining immediate operation, asynchronous and publication checks.
Regression tests cover final-result deadline expiry and mixed-width Unicode strings whose scalar offsets can skip an exact modulo boundary.
No budget is increased.

A3 is implemented in the separate OWLAPI worktree based on `e113c3f5f42eca4c8611b2b6251cea90a1cfc583`.
It preserves direct iteration and native matched-dataset iteration separately; a deterministic 1,000-case order probe found that direct filtering and native matching differed in 917 cases.
Subject results are materialized once and then queried through private predicate buckets.
The W6 matched-dataset count falls from 27,384 to 3,511, and materialized rows from 528,029 to 77,987.
No installed WebVOWL dependency has been patched or adopted implicitly.

Three uninstrumented Node source samples per upstream/read-view candidate observed median model-open time of 6.463 seconds versus 4.732 seconds.
The later candidate including the separately approved snapshot query improvements observed 4.464–5.077 seconds for opening, 0.369–0.383 seconds for checkpointing and 5.024–5.191 seconds for ranking.
All retained inspection/checkpoint/ranking hashes match the baseline.
These are sequential busy-host source diagnostics, excluding worker/startup/transfer/rendering; they establish neither browser speedup nor the five-second p95 target.

A4 currently feature-detects native hexadecimal conversion with the compatible fallback and independent digest-preimage tests.
Its browser benefit remains to be qualified; the exact digest inputs, refinement rounds, concurrency and identifiers are unchanged.
The owner approved the separate [PERF-DEC-015 display-key experiment](2026-10-23-display-ranking-identity-decision.md) with conditional adoption.
Its candidate returns revision-bound, purpose-tagged keys for counted nodes from the finite display mapping, while canonical capture and semantic/renderer handles retain their original operations.

The owner also approved the [OWLAPI read-path audit recommendations and comparison cleanup](2026-10-23-owlapi-read-path-opportunities.md), followed by exact provenance/rights metadata updates.
Those additions share immutable snapshot ownership without changing public collections or live import resolution.
They are outside A3's original translator-only scope and have their own recorded approval and tests.

The corrected consolidated OWLAPI candidate passed 16,382 tests in 278 suites, with 26 existing tests skipped.
The private position index now uses field names directly; the final JSON-identity lint finding is resolved without an exception.
Architecture checks, packaging and installed-consumer checks passed on this revised source; the ordinary format/lint stages retain their applicable passing evidence.
The owner approved the six native integrity entries in the reviewed browser import map: two new modules and four changed files, with imports/scopes/dependency URLs unchanged.
Native browser preparation passes; all six Chromium/WebKit bundler, import-map and DedicatedWorker checks pass.
The three Firefox checks fail before execution because the installed Firefox 157 cannot launch (`spawn UNKNOWN`), matching the previously recorded host limitation.
The retained local Firefox failure remains a limitation of that run.
Remote PR CI subsequently passed Chromium, Firefox and WebKit qualification, the complete installed-consumer matrix, required CI, metadata, dependency review and CodeQL.
The owner waived final AGY review and extra HISEW bookkeeping runs.
The OWLAPI source is signed and pushed at `86d02d38019013d56d11f0210b282373d29755f8` on `perf/bounded-rdf-read-index`, with [OWLAPI PR #85](https://github.com/Hadden-Industries/owlapi/pull/85).
The commit's tree, parent, exact message and SSH signature were verified by the maintained commit helper.
PR #85 merged normally as `9648eb923809391c9fda5c9a33829d9bd2fbf6f9`; remote comparison confirms the signed optimization commit is an ancestor of `main`.
WebVOWL then adopted that exact signed commit using native npm with lifecycle scripts disabled.
The regenerated lock changes only the selected package graph, and the installed-source boundary test passes.
Final application qualification remains separate.

### Exact WebVOWL dependency proposal

The owner clarified the adoption order on 23 October 2026: land OWLAPI on remote `main` first, then pin WebVOWL.
This supersedes the preceding “Keep the current dependency” response.
Required upstream CI and normal PR integration completed before applying the exact adoption below.
The scope is these two repository files only:

1. `package.json`: change `dependencies.owlapi` from `npm:@hadden-industries/owlapi@0.1.0-rc.2` to `git+https://github.com/Hadden-Industries/owlapi.git#86d02d38019013d56d11f0210b282373d29755f8`.
2. `package-lock.json`: regenerate with native npm for that exact selection and its dependency graph, preserving unrelated locked resolutions.

The existing root override `owlapi: "$owlapi"` makes the application and `packages/vowl` share this one selection.
The already configured `allow-git=root` admits the pinned source; no install scripts, build aliases, CI settings, workspace selectors or additional policy changes are proposed.

This moves from the published RC2 package to the current upstream baseline plus the approved optimization commit.
Upstream already changed `@hyperjump/uri` from 1.3.6 to 1.3.9 and `n3` from 2.7.12 to 2.13.12, and added `iconv-lite` 0.7.3 and `lzma-native` 8.0.6.
Those dependencies and their generated lock records are part of this concrete adoption; they were not introduced by the optimization diff.
The producer candidate passed installed-package and Chromium/WebKit qualification, but WebVOWL still needs its own clean install, package-boundary checks, consolidated tests and production build before performance qualification.
Existing install-script restrictions remain in force; any unsupported native-codec behavior or unrelated lock drift must be reported rather than changing policy implicitly.

Recovery is to reverse this exact source selector and its generated lock changes, then reinstall using the existing native npm procedure.
The implementation and publishing authorization does not replace the repository's exact-configuration approval for this adoption.

Evidence is retained under `operator/16557566c924469fb5e117f2cfbe6e03` relative to the HISEW evidence root:

- `initial-layout-production-manifest-4.json` (SHA-256 `1188f457ecca98ba1e07e29804f5928e4ba102ca60b10060344e6b8b20f628ca`) and `initial-layout-source-inputs-4.json` bind the production candidate; later documentation is not represented as an already-reviewed source snapshot.
- `initial-layout-W6-all-foreground-1/result.json`: four same-candidate foreground runs, no lost focus/visibility; not a before/after study.
- `whole-load-W6-trace-1/result.json` and `trace-0-initial-running-load.json.gz` (SHA-256 `a3ba8a40a30e3727e361f4a4b5975c542ab1e919b22fda342e81fb693875a9f0`): complete browser trace, no trace data loss, maximum buffer fraction 3.83%, normal Chrome exit.
- `whole-load-W6-browser-attribution-2.json`, `analyze-whole-load-trace.mjs` and `whole-load-W6-digest-sample-locations-1.json`: phase partition, sampled stacks and digest sample locations.
  Profile chunks were joined by process/profile ID; their emission thread is not mistaken for the sampled worker thread.
  Two tiny negative worker sample deltas total 26 microseconds; sampled totals are approximate and are not the phase timers.
- `whole-load-W6-node-attribution-1.json`, the three `whole-load-W6-node-*-1.cpuprofile` files and `whole-load-W6-source-hotspots-1.json`: source-level corroboration, not browser timing.
  Inspector start/stop samples remain visible and are not attributed to product work.
- `whole-load-W6-work-counts-1.json`: native method counters; the public and decomposed ranking have identical full correspondence and charged totals.
  Instrumented inspection/checkpoint/ranking hashes match the separate source-profile run.
- `whole-load-W6-rdf-query-counts-1.json`: query/materialization counters, with an unchanged semantic-inspection hash.
  Query terms and ontology contents are not persisted.
- `whole-load-profile-authority.md` and the external probe scripts: request, scope, limitations and reproducible invocations.
  All method wrappers execute the original implementation and are restored in `finally`.

The original profile was read-only; the subsequent approved implementation checkpoint above has its own product checks.
The initial-placement product candidate previously passed 10,050 JavaScript tests in 187 suites and the repository's full checks; subsequent collector changes have focused proof but still need the final consolidated full run.
No final external review is claimed; it was waived by the owner.
The OWLAPI source publication above is complete; no WebVOWL follow-up commit, merge or deployment is claimed at this checkpoint.
The unrelated `skills-lock.json` and `tools/repository-skills.pyz` modifications remain untouched.
Existing resource allowance overrun and the native cleanup limitation in HISEW #197 remain retained; neither this profile nor its normal browser exit constitutes complete native inventory closure.

## Consolidated first-image optimization checkpoint

The owner requested faster iteration, full checks only for the final commit, and a cheap first drawing before final node ordering.
The [display-order decision](2026-10-23-display-ranking-identity-decision.md#approved-first-image-extension-and-implementation) records that implemented extension and its changed initial tie-break contract.
The remaining bounded candidates are implemented as follows:

| Candidate                   | Result and preserved boundary                                                                                                                                                   | Focused evidence                                                                                                        |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Validation deadline polling | Expanded the existing 1,024-step polling cadence through graph/reference/typed/inspection traversals; exact quota charging, stage and publication checks remain.                | Resource exhaustion, pre-aborted work, traversal expiry and exact conformance fixtures; 4,161 tests across four suites. |
| JSON Pointer formatting     | Skip replacement allocation when a path segment contains neither `~` nor `/`; otherwise preserve exact escaping and single string conversion.                                   | Eight direct path cases plus the complete conformance fixture suite: 4,102 tests across two suites.                     |
| Snapshot allocation         | Use a null-prototype descriptor lookup, calculate each child path once, and hoist invariant classification. Every ownership snapshot and validation remains.                    | Poison-key/accessor/escaped-path cases, exact counters and canonical bytes; 4,177 tests across five suites.             |
| Native label shortening     | Batch the existing truncation algorithm's width probes by round within the current synchronous draw. Retain native browser widths and release all per-draw text/DOM references. | 157 tests across ten affected suites; exact browser text/geometry/export comparison across eleven W1 scenarios.         |

These counts overlap and must not be summed into a unique test total.
The whole-load source profile after validation/path/snapshot changes exposed repeated shortened-label measurements that the earlier S6 full-label hints did not cover.
Batching those measurements reduced the sampled full W6 drawing phase from **1,283.8 ms to 644 ms** in two separate traced diagnostics.
The latter instrumented whole-load window was 4,686.4 ms; neither trace is a latency percentile or an uninstrumented before/after speedup claim.
Browser geometry, labels, fonts, rectangle dimensions and captured SVG fields were exactly equal in all eleven W1 scenarios, including editing, stylesheet/font changes and document replacement.

The latest trace leaves approximately 1.44 seconds in OWL loading, 0.54 seconds in assessment, 0.73 seconds in model construction/retention and 0.73 seconds in live admission.
These are remaining attributed costs, not authorization to remove validation or ownership boundaries.
No further dependency, solver or scheduling change is introduced by this checkpoint.

Evidence in the same operator group includes `whole-load-snapshot-targeted-1.log`, `whole-load-path-targeted-1.log`, `whole-load-text-targeted-1.log`, `whole-load-text-geometry-comparison.json`, `whole-load-W6-preview-all-attribution-1.json` and `whole-load-W6-text-all-attribution-1.json`.
Production manifests 4 and 5 bind the respective traced builds; later public-error and measurement-readiness integration changes require the final build.
Count/lifetime diagnostics now explicitly await ordering readiness outside their measured action windows; first-image measurements continue to end at the original frame boundary.

### Final verification and retained limits

The consolidated repository check passed **10,119 JavaScript tests in 190 suites**, Python/setup and Markdown/JSON integration checks, all lint/format checks, the production build and generated-JSON validation (`whole-load-final-check-3.log`).
The subsequent native lifetime check exposed a retained lazy snapshot getter after the second load/edit cycle; both failing runs and the second run's private heap snapshot are retained.
The heap path was snapshot function feedback → allocation-site boilerplate → cached shape/descriptor → getter context → retired inspection.
Constructing the ordinary result with `Object.create(Object.prototype)` before assigning metadata removes that literal allocation-site retention without eager copying, a prototype change, or a new cache.

This narrow post-suite repair passed 98 session/controller/lifetime tests and scoped formatting/lint (`whole-load-retention-targeted-1.log`).
The final production candidate, manifest 7, passed the positive control and all ten W6 load/edit/capture cycles with zero retired owners and zero workers, then zero tracked owners/workers after disposal (`whole-load-W6-final-lifetime-3`).
The collector now preserves a bounded private heap snapshot on this specific ownership failure instead of discarding the retaining path when the browser exits.
The full suite was not repeated for this narrowly verified repair or for later evidence prose, respecting the owner's instruction against redundant full runs.
The full-suite result and post-repair proof are separate evidence claims.

Foreground W6 automatic qualification was attempted on manifest 6 after the full check, but Chrome could not pass foreground admission before the deadline; **no timing samples were accepted** (`whole-load-W6-auto-final-foreground-1`).
The five-second whole-load p95 and remaining W4/W5 active-layout/count budgets therefore remain pending, not waived.
The successful headless timings and the earlier display-key phase cohort do not substitute for those gates.
Final AGY review is waived, required raw evidence is retained, and no additional HISEW verification run is performed solely for receipt admission.
Source publication updates the existing draft PR; merge, deployment and the single actual-platform manual batch remain unapproved/uncompleted.
