# WebVOWL JavaScript performance improvements: HISEW implementation plan

## 1. Status, authority and source

| Field                          | Value                                                                                                                                                                  |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status                         | Draft synthesis for review; implementation, risk routing and new execution are not approved by this document                                                           |
| Prepared                       | 26 October 2026                                                                                                                                                        |
| Decision owner                 | Repository owner, Maksym Shostak                                                                                                                                       |
| Integration owner              | To be assigned when implementation is authorized; one owner must integrate the controller, renderer and worker changes                                                 |
| Source                         | `C:\Users\maksy\Downloads\webvowl-javascript-performance-improvements.md`, titled “Production JavaScript Performance Audit: WebVOWL”                                   |
| Source identity                | 40,605 bytes; SHA-256 `a169cf315797be3496e75fa289fe5b97b5ab8b5e9afee9b874940d90e77a0305`                                                                               |
| Inspected repository baseline  | `ac9461d327dca6eea545913496acca3369182945`, plus the current working tree on 26 October 2026                                                                           |
| Existing working-tree material | Untracked `docs/canonical-vowl/` was present before this task and is outside this plan's editing scope                                                                 |
| Planning procedure             | HISEW `hadden-industries-plan-software-change`, installed development release `0.1.0-dev.29`                                                                           |
| Identifier scope               | `REQ-###`, `AC-###`, `QA-###`, `DEC-###` and `SLICE-###` below belong to this document; qualify references with this filename to distinguish earlier performance plans |

This plan preserves the audit's substantive findings, workload definitions, measurements, proposed changes, verification intentions, budgets and exclusions.
It consolidates repeated recommendations instead of reproducing the audit's patches as implementation instructions.
Historical source line numbers are replaced by module/function references because the current source is authoritative.
The opening transcript of inspection commands is provenance, not an additional requirement.

The user authorized this document's creation in `docs/plans/`.
This does not authorize code changes, configuration changes, tests of a new implementation, commits, publication, telemetry collection or deployment.
No implementation or benchmark was executed while preparing this plan.

### 1.1 HISEW applicability and prerequisite boundary

Read-only engine inspection reports personal applicability as active, with `focused`, `affected` and `full` verification profiles.
It also reports execution `1e018f86-e49b-4e50-954a-908df04f6cc6`, generation `1`, as active and unrelated to this session.
Its purpose is “Implement accepted UI A1 through A4 and B1 through B5 from performance commit 20eb888; B6 not selected.”

This document neither adopts nor closes that execution and does not start a new one.
Before implementation, the owner must explicitly decide whether to continue/adopt the retained work or adopt and close it through the supported workflow.
Recheck its current generation and session ownership then.
The 27 pending workflow continuations are not instructions to launch unrelated feedback work from this planning task.

The audit is input to a draft dossier, not an accepted design or risk route.
The requirements and targets below are proposals derived from it.
Missing prerequisites are: accepted scope and numerical targets, current risk classification, decisions reopening previously excluded worker options, assigned integration/review/production observers, and exact approval for any configuration changes.
These block the affected implementation slices, not preservation of their proposals here.
Capability resolution is required when an actual code/security/commit/independent-verifier operation is selected; discovering a provider is not evidence that it reviewed this plan.

### 1.2 Related controlling records

- [Original performance implementation plan](2026-10-21-performance-implementation-plan.md), [S0 evidence](2026-10-22-performance-s0-evidence.md) and [ownership evidence](2026-10-22-performance-ownership-evidence.md).
- [Worker experiment decision](2026-10-23-worker-experiment-decision.md), [display-ranking identity decision](2026-10-23-display-ranking-identity-decision.md) and [whole-load proposal](2026-10-23-whole-load-profile-and-optimization-proposal.md).
- [Initial-layout plan and AC-104 disposition](2026-10-23-initial-layout-improvement-plan.md#ac-104-owner-disposition--24-october-2026), [active-graph follow-up](2026-10-24-active-graph-performance-follow-up.md) and [frame-time research](2026-10-24-frame-time-research-and-results.md).
- [ADR 0003: quiescent benchmark environment](../adr/0003-quiescent-benchmark-environment.md) and [ADR 0010: rendered graph as projection](../adr/0010-rendered-graph-is-a-projection-not-the-store.md), with its recorded action-parity amendments.
- [Pending device and assistive-technology validation](2026-10-23-ui-manual-validation.md).

These records retain authority for their accepted scopes.
This draft does not silently reopen a closed delivery, inherit a previous waiver, or turn administrative workflow closure into product verification.

## 2. Purpose, scope and risk proposal

The intended outcome is more responsive ontology editing, count/filter changes and drawing on realistic large ontologies, with bounded memory and predictable cancellation.
Improvements must retain semantic correctness, exact occurrence identity, visual notation, accessible interaction, saved-view compatibility and reliable recovery.

The audit identifies three principal residual clusters: worker startup/admission cost; main-thread join and inspection-copy allocation; and SVG text style/geometry work.
It also identifies quadtree allocation and generated-worker artifact accumulation, and asks for better interaction and network evidence.

Its starting point includes earlier spatial placement/scene indexing in `canonicalVowlScene.js`, bounded neighborhood reveal and revision-owned search preparation in `canonicalSearchProjection.js`, batched numerical ticks/scalar transition publication in `legacyForceSimulation.js`, and immutable selection inspection borrowing in `canonicalVowlDocumentSession.js`.
Preserve those gains and their current contracts while investigating the remaining paths.

The proposed order remains: first remove unnecessary semantic inspection copies and join allocations; next investigate text metrics/layout; then evaluate worker changes individually against refreshed measurements.
Artifact hygiene and instrumentation have their own gates.
Quadtree pooling remains conditional on allocation evidence.
Calling the first group “zero-risk” would be inaccurate: each has ownership, identity or rendering invariants to prove.

### 2.1 Included outcomes

1. Preserve independent-copy APIs while allowing safe internal borrowing of current immutable semantic records.
2. Reduce avoidable D3 join serialization and class-token allocations without changing DOM reuse or interaction behavior.
3. Reduce text measurement costs without changing truncation, glyph placement, fonts, language behavior or exports.
4. Discriminate worker startup cost from parsing, admission, ranking, transport and publication before selecting warming or module splitting.
5. Confirm whether any redundant admission work remains after the already implemented private publication refactor.
6. Measure quadtree/GC cost before pooling storage; preserve the existing force algorithm and numerical oracle.
7. Propose bounded removal of demonstrably obsolete generated worker files and explicit performance gates.
8. Establish useful local interaction/LoAF evidence and a separately approved field-measurement design.

### 2.2 Non-goals and preserved exclusions

- A general Canvas/WebGL renderer rewrite is not selected.
  The audit cites SVG accessibility, vector quality and pointer handling as benefits.
  Later repository work already includes a bounded static panning cache and experiments with other primitives; this plan preserves those improvements and does not interpret the audit as an instruction to remove them or prohibit all future renderer research.
- Replacing dotted subclass links with solid links is excluded.
  The audit reports a 91% raster-cost reduction in a synthetic control, but the owner rejected changing VOWL notation.
  That number is not an admissible product speedup.
- Offscreen DOM culling is not selected.
  The audit warns about visual popping and synchronization overhead.
  Force participation and DOM visibility are separate concerns; do not use this rationale to claim culling inherently requires deleting nodes from the simulation.
  Any future proposal needs a separate visibility/accessibility/hit-testing design.
- No new force algorithm, changed physics, hidden nodes/edges, reduced visual quality, weaker validation, resource-budget increase, semantic identity change, or silent count/ranking policy change.
- No persistent worker/model pool, general cache, new library, new telemetry endpoint, package upgrade, benchmark exception or CI change is authorized by this plan.

### 2.3 Proposed risk and proportionality

Propose an overall **R2** route because worker ownership, rendering identity, lifetime and untrusted-input admission can be affected.
The router may classify isolated local join/borrow changes more narrowly after checking scope.
Any removal of trust-boundary validation, new shared model lifetime, external data collection or broader delivery architecture requires fresh routing; this document does not self-approve a higher-risk exception.

Proposed lenses are ordinary code review; ownership/currentness and recovery; numerical/visual equivalence; browser performance; native security assessment for admission or worker-boundary changes; and privacy review if field reporting is selected.
The owner appoints reviewers and selects applicable verification profiles before execution.
Existing provider consent must be reused only within its actual scope.

## 3. Source evidence retained, with its limits

All values in this section are **reported by the supplied audit**, not newly measured in this task.
Its `MEASURED` and `VERIFIED` labels are preserved as source classifications; artifact identity and applicability must be established before using them as candidate acceptance evidence.

### 3.1 Workload inventory

| ID  | Source workload and shape                                                                                  | Modes and purpose                                                                                                                     |
| --- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| W1  | FOAF; 131 KB canonical JSON; 38 nodes; 134 scene occurrences                                               | Default; small calibration baseline                                                                                                   |
| W2  | Benchmark preset; 145 KB canonical JSON; 77 nodes; 143 occurrences                                         | Default; restrictions, datatypes and syntactic richness                                                                               |
| W3  | GoodRelations; 288 KB canonical JSON; 132 nodes; 566 occurrences                                           | Default; medium eCommerce ontology                                                                                                    |
| W4  | Connected and disconnected synthetic stress fixtures; 2,000 classes; source describes 1,999 subclass links | Automatic 50 and All 2,000; layout, text and SVG stress. Record each topology's actual edge count rather than assume identical shapes |
| W5  | Universal Ontology `20260912-full`; 2,298,206 bytes; abbreviated SHA-256 `85214ddc...`; 664 eligible nodes | Automatic 50 and All 664; OWL ingestion, ranking and inspection costs                                                                 |
| W6  | Extended Universal Ontology; 3,023,054 bytes; abbreviated SHA-256 `d7eb7980...`; 953 nodes and 1,215 links | Full graph; active layout, transforms and quiet-period count changes                                                                  |

Full private-fixture hashes, authorized local paths and actual occurrence counts must be bound in the implementation evidence manifest.
Abbreviated hashes do not establish fixture identity.
Private ontology contents remain private; redact labels, IRIs and source bytes from shared traces and screenshots where needed.

### 3.2 Reported runtime and production footprint

| Item                | Audit value                                                                                                                                                               |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Application         | Client-side Vite/D3 v7 application with canonical `packages/vowl` core; the audit describes a WebAssembly/JavaScript core without separately attributing WebAssembly work |
| Node                | `24.22.1`, x64, Windows `10.0.26300`                                                                                                                                      |
| V8                  | `13.4.114.19-node.20`                                                                                                                                                     |
| Chrome              | `156.0.8078.48`; 1440 × 900 viewport; DPR 1                                                                                                                               |
| Build               | Vite `8.3.4`, `es2022`, Rolldown/Oxc, minification enabled                                                                                                                |
| Package manager     | npm `>=12.2.1`; workspace includes `packages/vowl`                                                                                                                        |
| Tests               | Jest `30.5.2`, experimental VM modules; 194 suites, 10,225 tests, 128.3 seconds                                                                                           |
| Manifest            | 45 assets; 4,068,533 total bytes                                                                                                                                          |
| Entry               | `deploy/js/index.js`: 649,142 bytes                                                                                                                                       |
| Application vendor  | `deploy/js/vendor-application.js`: 289,471 bytes                                                                                                                          |
| Worker              | `deploy/assets/canonicalVowlWorker-*`: 1,185,577 bytes                                                                                                                    |
| Accumulated workers | 21 bundles, approximately 25 MB in `deploy/assets/`                                                                                                                       |

These are historical environment/build identities, not a dependency-selection recommendation or a claim about the tools installed today.
Refresh the candidate manifest and actual tool versions without upgrading configuration.
Distinguish emitted assets, files present on disk, transferred bytes, compressed bytes and retained runtime memory.

### 3.3 Reported timing and allocation observations

| Observation                                      | W1               | W3               | W4                                                | W5 / W6                                                                  |
| ------------------------------------------------ | ---------------- | ---------------- | ------------------------------------------------- | ------------------------------------------------------------------------ |
| Native inspection clone per selection click      | 2.6 ms / 0.42 MB | 4.6 ms / 1.02 MB | Connected: 32.2 ms / 5.03 MB                      | W5 All: 64.3 ms / 12.52 MB                                               |
| Worker ranking/identity share, load / first edit | 22.6% / 26.4%    | 26.3% / 30.2%    | Not supplied                                      | W5: 42.2% / 41.9%; about 4.3 seconds for load ranking                    |
| Style/layout share of traced revision frames     | 31.4%            | Not supplied     | Connected: 59.2%                                  | W5 All: 46.9%                                                            |
| Active frame p95                                 | Not supplied     | Not supplied     | Subclass stress: 91.6–95.8 ms; peaks above 200 ms | W6: 37.5–41.7 ms; source reports settlement 5.37–5.75 seconds after load |

The source also reports approximately 44,000 DOM elements and 6,000 `getBBox` calls for the large drawing workload, approximately 4,000 child class checks and 4,000 key serializations per large revision, and three full inspection copies across command/acceptance paths, estimated at 37.5 MB per label edit. These are workload/path hypotheses to count again, not guarantees that every event performs those exact calls.

Worker cold startup is estimated at 150–350 ms.
The audit compares W2 operation time of 2,225 ms with W1 at 558 ms and attributes the difference to admission/ranking.
Different ontology content can explain different costs; that comparison alone does not isolate startup or duplicate validation.

The audit describes `bindPrimitiveGroups` as cyclomatic complexity 7 and reports four sequential text-batch traversals over blocks/spans.
These are source characterizations, not independently recomputed complexity scores.
High call frequency and allocation volume, rather than a complexity score alone, motivate the proposed experiments.

| Source cost model                                     | Source proposed model              | Interpretation to verify                                                                                                                        |
| ----------------------------------------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Key evaluation: `O(N × L)` serialization              | `O(N)` concatenation               | Both traverse elements and produce strings; retain identifier-length cost and measure allocation savings                                        |
| Child filtering: `O(C × K)` class splitting           | `O(C)` native class lookup         | Native membership avoids explicit split arrays; no constant-time or bitmask guarantee is assumed                                                |
| Text layout: `O(T × R)` with two layout barriers      | `O(T)` with no forced flush        | Browser trace must establish real flushes and whether dependent geometry permits fewer barriers                                                 |
| Edit record preparation: `O(S)` whole inspection copy | `O(1)` reference borrow            | Borrowing itself is constant-size; reference construction and downstream traversal still have their own costs                                   |
| Quadtree: `O(N log N)` construction/allocation claim  | Same algorithm with pooled storage | Typical construction complexity is not an allocation count or a worst-case guarantee; measure nodes, coordinate capacity and adversarial shapes |

Here `N` is scene elements or force nodes as appropriate, `L` identifier length, `C` child elements, `K` class-string/token work, `T` text spans, `R` layout cost and `S` retained statement/inspection size.
The source assumes two numerical steps per frame; preserve the current drag-specific scheduling exception rather than restoring an obsolete universal schedule.

### 3.4 Source results and forecasts must remain separate

| Source claim                                                         | Source status           | Treatment in this plan                                                                                                         |
| -------------------------------------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| W5 click cloning 64.3 ms to below 1.0 ms                             | `VERIFIED (S2/Patch 1)` | Likely overlaps earlier selection borrowing; require a matching artifact and path before crediting this new edit-path proposal |
| W5 ten-edit cloning 966.0 ms to below 15.0 ms                        | `VERIFIED (Patch 1)`    | No matching new patch receipt supplied; retain as an audit assertion, not current edit-path verification                       |
| W4 slider scripting about 129 to 108 ms, approximately 16% reduction | `MEASURED DIAGNOSTIC`   | Preserve as diagnostic context; source/candidate pairing must be recovered                                                     |
| W4 style/layout share 59.2%, candidate unmeasured                    | `BENCHMARK PLAN`        | Open measurement obligation                                                                                                    |
| W6 frame p95 remains 37.5–41.7 ms                                    | `MEASURED`              | Historical scoped observation; later qualification below prevents a universal pass claim                                       |

Forecasts retained from the audit are 30–40% lower worker latency, 10–15% lower revision scripting, 30–50% lower forced-layout time, 60–65 ms less edit preparation freeze, 15–25% less quadtree-related heap churn, and about 25 MB reclaimed artifact storage.
None is a measured outcome of this plan.
Worker startup savings cannot be equated to the entire ranking share, and removing copies does not guarantee the full end-to-end event improves by their isolated duration.

### 3.5 Missing evidence

- Field INP, mobile/low-spec CPU and RAM behavior, and actual-device/assistive-technology acceptance.
- Remote multi-import fetching under bandwidth limits, packet loss, slow responses and cancellation; no evidence yet for a backpressure implementation change.
- `API_LATENCY_SLO` and `MOBILE_DEVICE_CONSTRAINTS` are unspecified in the source.
  Client-side processing has no general API latency target here; import network time still needs separate accounting.
- Raw receipts binding all claimed “verified” patches to exact source and production bytes.

## 4. Reconciliation with the inspected code and decisions

| Finding                                          | Audit classification, severity, effort/risk                   | Inspected state and required disposition                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------------------ | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PERF-01: transient worker and repeated admission | Measured; critical/high confidence; large effort, medium risk | `canonicalVowlWorkerClient.js` still creates and terminates workers, but `liveModel.js` already separates `admit` from private `publishValidatedState`; the approved duplicate checkpoint-validation refactor must not be reimplemented. `canonicalVowlWorkerOperations.js` calls `readModelDisplayOrderKeys`, with preview/continuation support. Historical double `issueIds`/4.3-second ranking attribution is not the current algorithm by default |
| PERF-02: join key serialization/class splitting  | Measured; high/high; small effort, low source risk            | `primitiveKey` still serializes `[type, id]`; `bindPrimitiveGroups` still splits class strings. Current candidate for bounded optimization after proving key semantics                                                                                                                                                                                                                                                                                |
| PERF-03: text read/write phases                  | Measured; high/high; medium effort, low source risk           | `withTextLayoutBatch` already groups font reads, line writes, block reads and centering writes. There is a dependency between line placement and measured block height; this is not evidence of one full layout flush per `getBBox` call                                                                                                                                                                                                              |
| PERF-04: whole-record copies                     | Measured; high/high; small effort, low source risk            | Three controller call sites still use `inspectRecords()`, which clones the accepted inspection. An existing `readOntologyInspection()` borrows a different projection; `readModel()` also exists. Choose the narrowest current native read contract rather than duplicate an equivalent API                                                                                                                                                           |
| PERF-05: quadtree allocations                    | Strongly inferred; medium/medium; medium effort, medium risk  | `createLegacyQuadtree` creates coordinate arrays and quad objects. Allocation attribution and any link to GC/frame tails remain unproved; pooling is conditional                                                                                                                                                                                                                                                                                      |
| PERF-06: stale worker artifacts                  | Measured; medium/high; small effort, low source risk          | `webvowlGeneratedJavaScriptCleanupPlugin` only removes prior names matching its `js/` allowlist; worker asset coverage needs investigation. Exact cleanup/configuration approval is mandatory before changing it                                                                                                                                                                                                                                      |

### 4.1 Corrections that affect implementation safety

1. **Delimiter keys:** Concatenating type, colon and ID is not generically injective.
   For example, pairs `("a:b", "c")` and `("a", "b:c")` collide.
   Verify the admitted type/ID domain, including number/string distinctions, empty values and punctuation.
   The source's two distinct IRIs test does not exercise a delimiter collision.
   Prefer a proven encoding or existing unique occurrence handle; do not switch to semantic IRI identity.
2. **Complexity claims:** String concatenation still depends on produced string length; native class membership does not promise a bitmask or constant-time complexity.
   Preserve the optimization hypothesis as fewer transient arrays/serialization operations, not a proven asymptotic improvement.
   Count D3 key calls on both existing elements and incoming data.
3. **Font cache keys:** A class string does not prove equal computed font size: inheritance, ancestor selectors, inline styles, document context and font changes matter.
   The audit's assertion that styles are exclusively class-based requires a complete current consumer/style proof.
   No persistent cache or “default” key may merge inequivalent styling contexts.
4. **Geometry ordering:** `getBBox` returns current SVG geometry.
   Reading before span placement can measure the wrong layout.
   Preserve necessary dependency barriers unless an analytically equivalent metric is demonstrated.
   A bounded batched barrier can be correct even when the source demands exactly two phases or zero forced reflows.
   [SVG geometry API](https://developer.mozilla.org/en-US/docs/Web/API/SVGGraphicsElement/getBBox).
5. **Ownership:** Zero whole-inspection copies in internal read-only edit preparation does not mean zero `structuredClone` calls in the entire operation.
   Worker transport, owned checkpoint/snapshot APIs and mutable external copies can remain necessary.
   Count and classify copies by payload and boundary.
6. **Worker terminology:** A pre-warmed worker consumed by one job and then terminated shifts startup; it does not amortize startup across multiple jobs.
   Reusing a completed worker is a persistent-worker design with additional isolation and retention obligations.
   The source mixes these alternatives; DEC-005 separates them.
7. **Artifact count:** The source says “stale worker count = 1” while also requiring zero orphans.
   Interpret its intent as one current worker entry for the current unsplit architecture and zero stale entries.
   If parser splitting is selected, the valid emitted asset closure may contain multiple chunks.
8. **Measurement oracles:** A MutationObserver callback alone does not establish synchronous read/write ordering or the count of browser layout flushes. Use explicit phase instrumentation for ordering and native traces for style/layout cost; do not write a test whose assertion merely repeats the implementation.

### 4.2 Newer records supersede the audit's broad framing

The [worker decision](2026-10-23-worker-experiment-decision.md) explicitly selected a narrow checkpoint-admission refactor for maintainability and excluded worker warming/pooling, parser splitting, ranking/digest changes, copy removal and resource-policy changes from that slice.
Its source implementation retains snapshots, boundary validation, cancellation/deadline checks, qualification and freezing.
Reopening any excluded option requires its own decision.

The [display-ranking record](2026-10-23-display-ranking-identity-decision.md) records a later bounded W6 worker cohort at median 172.8 ms/p95 195 ms for display keys, and a preview-first two-message lifecycle. This phase timing cannot be combined with the audit's 4.3-second earlier ranking cost as though the algorithm and candidate were unchanged. Preserve purpose `display-order-v1`, preview prefix behavior, generation/revision checks, count-control pending/failure behavior and separate canonical artifact identity.

The [AC-104 owner disposition](2026-10-23-initial-layout-improvement-plan.md#ac-104-owner-disposition--24-october-2026) accepts the documented cadence limitation for the previous delivery: W4 observations at 62.5/70.8 ms p95; W6 forty-load A/B distributions at 50.1/49.9 ms, with maximum per-load p95 54.2 ms. This is neither a universal pass at 50 ms nor a new 70.8-ms allowance. The 200-ms maximum, actual movement and twelve-second settlement requirements remain, as do other criteria. The later initial-paint repair and pending manual device/AT batch retain their distinct evidence boundaries.

## 5. Proposed dossier: requirements and acceptance

Acceptance below is **proposed** for this programme.
Existing constraints remain binding; new targets need DEC-001.
Use both independent correctness evidence and production measurements, not timing-only approval.

| Requirement | Observable requirement                                                                         | Acceptance criterion                                                                                                                                                                                                                                                |
| ----------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| REQ-001     | Make edit preparation and revision acceptance read admitted records without unnecessary copies | AC-001: zero whole-inspection clones attributable to the selected read-only controller sites; immutable borrow identity stable within a revision; old values remain immutable after replacement; external copies remain independently mutable                       |
| REQ-002     | Preserve occurrence identity while reducing join allocations                                   | AC-002: no tuple JSON serialization or regex class splitting in the selected hot join path; unchanged enter/update/exit and DOM reuse for nodes, labels, cardinalities and links; adversarial key-domain cases pass                                                 |
| REQ-003     | Reduce text style/geometry work while preserving the drawing                                   | AC-003: exact line/truncation/centering outputs on controlled fixtures and native visual/geometry parity; target more than 95% fewer computed-style queries only for proven homogeneous workload groups; report heterogeneous cases separately                      |
| REQ-004     | Reduce user-visible worker overhead without weakening cancellation or admission                | AC-004: separately report startup, module evaluation, import/admission, display ordering, messages and acceptance; every selected worker candidate preserves currentness, deadlines, preview acknowledgment, recovery and bounded lifetime                          |
| REQ-005     | Share already established admission knowledge only inside its owning boundary                  | AC-005: no caller-controlled trusted flag, no skipped receiving-worker validation, no changed resource/depth/qualification checks; prove any remaining duplicate pass before modifying the already refactored path                                                  |
| REQ-006     | Reduce measured allocation pressure without changing force semantics                           | AC-006: step-level equivalence to the retained independent force oracle, bounded reusable capacity, no retired graph references, and corroborated allocation/GC improvement if pooling is selected                                                                  |
| REQ-007     | Keep generated assets bounded without deleting required deployment inputs                      | AC-007: zero demonstrably orphaned generated worker files in the selected build output; complete current worker/chunk closure retained; foreign files and retained rollback assets preserved; failed builds do not prune valid artifacts                            |
| REQ-008     | Measure interaction delay, drawing stalls and import latency usefully                          | AC-008: bounded optional local Event Timing/LoAF attribution for selected interactions, overhead measured, unsupported browsers remain functional; field reporting absent until an approved privacy/data-delivery design exists                                     |
| REQ-009     | Make performance comparisons reproducible and falsifiable                                      | AC-009: immutable baseline/candidate source and asset manifests, full fixture hashes, raw samples, warmup labels, admission evidence, environment, failures and independent corroboration retained; no favorable rerun selection                                    |
| REQ-010     | Keep existing contracts and delivery decisions intact                                          | AC-010: semantic results, canonical/saved-view bytes where contractually exact, source access, count/filter behavior, export, accessibility, currentness, error and cancellation behavior pass their impacted checks; accepted cadence limits are reported honestly |
| REQ-011     | Turn accepted budgets into appropriate release checks                                          | AC-011: exact configuration approval precedes new CI wiring; deterministic budgets and performance evidence are distinguished; candidate/source binding and accepted thresholds are explicit                                                                        |
| REQ-012     | Deliver a recoverable, observed change                                                         | AC-012: each selected slice has a retained baseline, compatible recovery route, named observer and cleanup disposition; no open blocking finding or unapproved deployment action is represented as completion                                                       |

### 5.1 Quality scenarios

| Scenario                          | Stimulus and environment                                                                                             | Required response / evidence                                                                                                                                          |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| QA-001: edit responsiveness       | Ten W5 edits, with selection preparation and accepted revisions                                                      | Count copied inspection bytes and classified clone calls; preserve resulting edits/references; compare main-thread latency and frame observation to a paired baseline |
| QA-002: revision stability        | W4/W6 count changes, filters, language switches, reveals and repeated updates                                        | Retain appropriate DOM identities and handlers; no stale selection, missing links or changed multiplicity; measure script/allocation and full interaction time        |
| QA-003: text correctness          | Mixed text/subtext/count labels, multiline text, font loading/change, inherited and inline sizes, multiple documents | Correct truncation and final coordinates; no cache reuse across inequivalent style/owner contexts; recover after nested/throwing draws                                |
| QA-004: cancellation/currentness  | Abort, timeout, document replacement or disposal during worker creation, preview, imports, ordering and reply        | Retire job and pending work; late replies cannot publish; active worker terminates; retained/standby resources stay within the selected bounds                        |
| QA-005: hostile admission         | Malformed checkpoint/source, changed caller data, deeply nested expressions, exhausted budgets and cancelled imports | Preserve native validation, error class, accounting and deadline behavior; rejected inputs never gain publication authority                                           |
| QA-006: numerical integrity       | W4/W6, coincident/fixed points, empty/small graph, reheat/stop, replacement with smaller/larger graph                | Same numerical steps and finite geometry; no stale pooled references; allocation and frame tails reported separately                                                  |
| QA-007: artifact safety           | Two changed successful builds, interrupted build, dynamic chunk load, old open tab and rollback                      | Current dependency closure loads; no unsafe path deletion; previous release assets remain available under the deployment's retention policy                           |
| QA-008: browser and accessibility | Supported Chrome/Firefox/WebKit paths, high DPR, zoom, keyboard, screen reader and representative devices            | Same readable/interactable graph and exports; missing optional performance APIs do not fail the application; pending manual combinations remain pending               |
| QA-009: privacy and overhead      | Local metrics, private ontology, observer buffer pressure and navigation/disposal                                    | No ontology text, labels, IRIs or raw source leakage; bounded buffers, sampling and teardown; measured observer overhead                                              |
| QA-010: network resilience        | Throttled/delayed/failed imports and user cancellation                                                               | Attribute fetch separately, preserve limits/error reporting and prompt cancellation; no unbounded queue or new retry policy without a design                          |
| QA-011: release recovery          | Regression discovered after staging or limited exposure                                                              | Observer can identify candidate/asset versions, stop promotion and restore a retained compatible release without discarding user work                                 |

## 6. Decisions, seams and reuse

### 6.1 Decision register

| ID      | Decision required or constraint                                                                          | Owner / present disposition                                                                                   |
| ------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| DEC-001 | Accept the refreshed baseline, selected slices, risk route and numerical gates                           | Repository owner; open. Audit forecasts are not commitments                                                   |
| DEC-002 | Resolve HISEW execution ownership and assign implementation/integration observers                        | Repository owner; open; no execution adopted here                                                             |
| DEC-003 | Choose a native borrowed-record contract and precise name; preserve copying API semantics                | Integration owner with ownership reviewer; open. `readRecords()` is a source suggestion, not a required alias |
| DEC-004 | Prove a collision-free occurrence key and style-equivalence/cache lifetime                               | Renderer owner/reviewer; open; reject unsupported colon/class-only assumptions                                |
| DEC-005 | Select cold on-demand, one pre-warmed single-use standby, or a separately designed persistent worker     | Repository owner after experiment; existing cold model remains baseline; persistent reuse excluded here       |
| DEC-006 | Reopen parser splitting or further admission work only for a demonstrated residual problem               | Repository owner and package/security reviewers; earlier narrow refactor already exists                       |
| DEC-007 | Approve exact build cleanup and CI settings with deletion/deployment implications                        | Repository owner; open, governed by `AGENTS.md`                                                               |
| DEC-008 | Select device/network cohorts and any field INP collection, data schema, endpoint, consent and retention | Repository owner; open; local diagnostics can be designed first                                               |
| DEC-009 | Preserve canonical ontology/occurrence identities, VOWL notation and public resource/trust contracts     | Existing architecture constraints; no override proposed                                                       |
| DEC-010 | Treat prior cadence acceptance as scoped; decide new programme targets explicitly                        | Repository owner; prior delivery remains accepted with documented limits                                      |
| DEC-011 | Approve rollout/abort criteria and retained artifacts before release                                     | Release owner; unassigned/open                                                                                |

No prior no-shim override is assumed.
Apply NAM-01 to any changed responsibility or name: a borrowed read must not imply independent ownership, a display-order key must not imply canonical identity, and a standby worker must not be named as a persistent model cache.
NSH-01 does not permit a compatibility shim merely to keep the audit's proposed name.
Keeping a public copy method with its original behavior is a retained contract, not permission to introduce an alias.

### 6.2 Architectural seams and DRY-01 decisions

Paths below are predictions for implementation, not an approved file list or promised line numbers.

| Rule and current authority                                                                                | Current consumers / boundary                                                                                  | Proposed strategy and deliberate separation                                                                                                                              |
| --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Admission/immutability: document session and its inspection ownership helper                              | Controller commands, revision acceptance, edit validation, semantic read model; main-thread accepted revision | Reuse native ownership once per admitted value. Add only the missing internal borrowing seam; retain independently mutable external snapshots and cross-worker admission |
| Semantic reference creation: `createCanonicalSemanticReferences` in `canonicalVowlInspectionProjector.js` | The three controller read sites; load generation and record tokens                                            | Consume immutable records without a parallel index or second source of semantic truth; test generation/revision binding                                                  |
| Join identity/class membership: `renderedGraphInternals.js`                                               | Node, property-label, cardinality and link joins; renderer mount                                              | One key rule per actual identity domain and one direct-child matching path; do not share semantic IRIs with occurrence joins                                             |
| Text measurements: `textLayoutBatch.js`, `textTools.js`, `CenteringTextElement.js`                        | Native SVG drawing and synchronous edits; document/draw lifetime                                              | Share proven equal metrics within the batch only. Keep read/write barriers required by geometry and clear all retained elements on success/failure                       |
| Worker lifecycle: `canonicalVowlWorkerClient.js`, worker protocol and policy modules                      | Load/edit/recover/capture/source/export, import resolver and two-message preview path                         | One owner for job lifetime, cancellation and timers; retain validation at each receiving trust boundary. Standby lifecycle must not duplicate document authority         |
| Package validation/publication: `packages/vowl/src/liveModel.js`                                          | Open/edit/checkpoint readmission in each worker                                                               | Existing structural validator remains authority. Reuse private validated-state publication; do not merge independent snapshot/accounting/trust obligations               |
| Force state: `legacyForceSimulation.js`, `legacyForceQuadtree.js`                                         | Each active simulation, including current drag-step schedule                                                  | Capacity belongs to the simulation or bounded step owner; no global pool; preserve traversal/precision and independent numerical oracle                                  |
| Generated artifact ownership: `vite.config.mjs` cleanup plugin                                            | Local production output, manifest, deployment and old clients                                                 | Ownership manifest and current emitted dependency closure govern cleanup; deployment rollback retention is a separate authority                                          |
| Evidence: production driver, `productionPerformance.mjs`, benchmark guard                                 | Local/CI measurement, browser and release observer                                                            | Reuse existing manifests/cohort driver; do not create a competing percentile implementation or bypass quiescence                                                         |

Shared rules are consolidated only where authority, consumers, failure behavior and deployment scope match.
Repeated validation across workers and mutable snapshot copies are deliberate boundary protections, not automatic DRY violations.

### 6.3 Native reuse, versions and rights

Prefer existing D3 joins, native DOM class tokens, existing session read models, current module workers, private package publication, native performance observers and the repository's benchmark tooling.
No new functionality package or backend is selected.
Any later dependency proposal requires current maintained-version/LTS research, consumer compatibility, actual license/terms clearance and a stated residual gap before adoption.
Do not infer clearance from a package name or the source audit's versions.
Preserve the existing D3-derived force/quadtree license notices.

The Modern Web Guidance `performance` and `identify-inp-causes` guides were consulted.
Applicable principles are batching dependency-compatible reads/writes, distinguishing input/processing/presentation delay and using optional LoAF attribution. Generic suggestions to add libraries, beacons, containment, yielding, bundler changes or a renderer backend are not adopted wholesale. In particular, yielding halfway through a currently synchronous draw needs its own publication/currentness design.

## 7. Vertical implementation slices

Every slice includes its observable path, proof and release/cleanup consequence. A rejected experiment with retained evidence is a valid result; speculative code need not be integrated. “Depends on SLICE-001” includes the ownership/scope decisions, not just taking a measurement.

### SLICE-001 — Establish the current baseline and accepted scope

**Outcome:** A reviewer can reproduce one current load/edit/count path and distinguish old measurements from the exact candidate.

- Recheck current source, uncommitted work, retained HISEW ownership, selected route and verification profiles.
  Bind W1–W6 fixtures and production assets; recover relevant historical receipts without publishing private inputs.
- Inventory remaining clone sites, emitted worker/chunk dependencies, current ranking/preview behavior, text consumers and actual force schedule.
  Separate allocation count, CPU cost, layout, paint/raster and network time.
- Establish cold/warm cache conditions, baseline/candidate ordering, sample counts, observer overhead and the performance targets the owner accepts.
  A/A calibration precedes A/B when the measurement route is new.
- **Proof:** REQ-009/010, AC-009/010, QA-008/010; manifests, representative functional checks, quiescence and candidate-bound baseline observations.
- **Exit/cleanup:** Owner accepts DEC-001/002/010; retain immutable baseline and raw failures.
  No production optimization is required to finish this slice.
  Missing receipts remain labeled missing.

### SLICE-002 — Complete one edit path using immutable semantic-record borrowing

**Outcome:** A W5 label edit reaches accepted revision/selection references with unchanged semantics and without the selected full-record copies.

- Predicted files: `canonicalVowlDocumentSession.js`, `canonicalWebVowlController.js`, existing ownership/session/controller tests; projector/read-model modules only if their existing contract needs a narrow extension.
- Trace all three `inspectRecords()` consumers.
  Prefer an existing sufficient native read capability; otherwise expose a precisely named internal immutable-record accessor.
  Preserve the public copying method and owned checkpoint/snapshot fields.
- Capture the correct revision when an operation begins; do not retain a live session closure as the meaning of an old read.
  Prove deep immutability and no downstream mutation before removing copies.
- **Proof:** REQ-001/010, AC-001/010, QA-001/004/005; deep nested mutation attempts, same-revision identity, new/old revision behavior, rejection/cancellation/replacement and independently mutable external copies.
  Native clone counters classify only relevant whole-inspection copies; benchmark W5 ten-edit latency and lifetime.
- **Exit/cleanup:** No copy regression on selection/search and no retired document owner after ten cycles/disposal.
  Release independently if proven; reverse only this candidate's borrowing edits if ownership fails.
  Source expectations below 1-ms click cloning and below 15-ms ten-edit total are retained targets to validate, not inherited passes.

### SLICE-003 — Preserve renderer joins with cheaper key and class matching

**Outcome:** Count/filter changes reuse the same intended elements with fewer temporary allocations.

- Predicted file: `renderedGraphInternals.js`; affected editing/rendering/adapter tests.
  Keep joins scoped to direct children and all existing primitive groups.
- Establish type/ID domain and collision proof before choosing string construction, length-delimited encoding or an already adequate occurrence handle.
  Keep runtime identity distinct from ontology IRI and display-order identity.
- Replace regex class token splitting with supported native class membership, preserving non-element filtering and class matching.
  Verify SVG and supported test/native environments; do not add a broad fallback shim without need.
- **Proof:** REQ-002/010, AC-002/010, QA-002/008; adversarial delimiters, types/IDs and occurrence multiplicity; positive/negative/whitespace class cases; exact enter/update/exit and listener/selection/drag continuity.
  Native allocations and W4/W6 scripting substantiate any gain. D3 defines keys as identity for binding/reuse, not presentation ordering: [D3 joining data](https://d3js.org/d3-selection/joining).
- **Exit/cleanup:** Preserve functional output and improve the attributed cost without a material full-interaction regression.
  The 10–15% forecast and 129-to-108-ms diagnostic remain comparison hypotheses.
  No retained cross-revision key cache unless separately justified and bounded.

### SLICE-004 — Reduce SVG text measurement on one complete redraw

**Outcome:** Initial mount or count/language redraw produces identical text while reducing demonstrated measurement work.

- Predicted files: `textLayoutBatch.js`, `textTools.js`, `CenteringTextElement.js` and their existing tests.
  First isolate per-batch metric reuse; assess geometry barrier removal as a separate candidate within this slice so its effect remains attributable.
- Prove which spans share computed metrics, including ancestors and font changes.
  Use a batch-local cache only for proven equivalent contexts; otherwise read directly.
  Keep multiple documents, nested batches, throw cleanup and immediate non-batched edits correct.
- Profile the current four grouped phases plus preceding truncation writes.
  Do not move `getBBox` ahead of required placement writes or estimate height from line count unless glyph/line spacing equivalence is demonstrated.
  Retaining a necessary batched layout barrier is acceptable; document why the audit's “exactly two phases” is unattainable if so.
- **Proof:** REQ-003/010, AC-003/010, QA-003/008; exact controlled geometry, multilingual/fallback font, mixed sizes, browser visual checks and export.
  Explicit ordered probes test scheduling; native Chrome traces report `Layout`/`UpdateLayoutTree`, flush counts and absolute durations.
  Query-count reduction alone cannot claim a 30–50% layout improvement.
- **Exit/cleanup:** More than 95% fewer font queries is a proposed homogeneous-workload goal; the source's “under five” depends on actual distinct contexts.
  No long-lived font/node cache; no visual approximation or changed font configuration.
  Accept only independently demonstrated improvements.

### SLICE-005 — Evaluate a bounded worker-startup change

**Outcome:** A load/edit/export job pays less user-visible startup delay while keeping established cancellation and preview behavior.

- Requires DEC-005 reopening the previously excluded option.
  Predicted files: worker client, worker entry/protocol/policy and worker/session tests.
  Do not implement a pool merely because startup was historically expensive.
- Compare cold on-demand creation with at most one pre-warmed **single-use** standby.
  Define ready handshake, startup failure, idle expiry, replacement, disposal and creation scheduling; record bounds for active jobs and standby separately.
  Preserve existing concurrency or explicitly decide a queueing change.
- The standby receives no ontology/model until assigned. Terminate the assigned worker on cancel/deadline and after its completed lifecycle; do not return it to an idle persistent-model pool.
  Replenish only under a bounded owner policy and account for work shifted into idle periods.
- Preserve import messaging, preview acknowledgment/final ordering, operation IDs, generation/revision checks and failure projection.
  Native termination stops a worker immediately; cleanup cannot rely on its code finishing: [Worker termination](https://developer.mozilla.org/en-US/docs/Web/API/Worker/terminate).
- **Proof:** REQ-004/010, AC-004/010, QA-004/005/010; cold/warm startup decomposition, replacement/abort races, timeout during import/preview, stale messages, no standby data retention, ten-cycle heap/owner tests and low-spec memory observations.
  Compare whole operation and first usable frame, not just time to ready.
- **Exit/cleanup:** Reject if startup is no longer material, cold-load cost rises, memory exceeds the accepted bound, or lifetime complexity lacks benefit.
  Retain on-demand behavior as a separately qualified recovery path only if explicitly designed; do not promise a transparent fallback after partially completed jobs.

### SLICE-006 — Evaluate parser loading and any residual admission duplication

**Outcome:** One canonical/edit operation avoids proven unnecessary dependency/admission work while OWL/import/export operations remain complete.

- Requires DEC-006.
  Evaluate parser splitting independently from SLICE-005 so gains/failures are attributable.
  Predicted modules: `canonicalVowlWorkerOperations.js`, worker entry, `packages/vowl` public entry points, and `liveModel.js` only for a newly demonstrated residual.
- Map reachable RDF/XML, JSON-LD, N3, XML DOM, schema-validation and canonicalization dependencies. Native dynamic import may defer OWL-specific code; it introduces loading/deployment/error costs that must be measured.
  Do not assume all named dependencies are avoidable for canonical jobs.
- Check the existing `publishValidatedState` refactor before editing admission.
  If the alleged duplicate is already gone, close that audit recommendation with source/receipt references.
  A second pass may remain necessary across a different trust, snapshot or asynchronous ownership boundary.
- Any additional deduplication must keep original inputs untrusted, private validated ownership, snapshots/resource charges, expression depth, source integrity, supports/archive checks, qualification, freezing and publication order.
  No public `alreadyValidated` flag, inter-worker admission cache or canonical-identity shortcut.
- **Proof:** REQ-004/005/007/010, AC-004/005/007/010, QA-004/005/007; independent malformed/resource corpus, native package/browser conformance, parser formats/imports, cold/warm chunk failures, whole load/edit/export and byte-identical contractual outputs.
  Scoped native security assessment owns trust-boundary review.
- **Exit/cleanup:** Keep only a selected proven option.
  If bundler/package configuration becomes necessary, stop that change at DEC-007 with an exact proposed diff. Update budget interpretation for the entire worker dependency closure; preserve deploy/rollback asset compatibility.

### SLICE-007 — Pool force storage only after proving allocation cost

**Outcome:** The same numerical relaxation uses less measured allocation without retaining retired graphs.

- Predicted files: `legacyForceQuadtree.js`, `legacyForceSimulation.js`, their affected oracle/runtime tests. Profile W4/W6 first; separate quadtree allocation from renderer/path/text allocation, GC and raster cost.
- If justified, bound reusable coordinate storage and quad-node capacity per simulation.
  Preserve double precision, insertion/traversal order, coincident-point behavior, numerical steps, current drag scheduling and lifecycle semantics. Reset references and release capacity on retirement; choose explicit resize/retention limits.
- **Proof:** REQ-006/010, AC-006/010, QA-006; independent retained D3 3.5.17 step oracle, fixed/coincident/empty/symmetric cases, large-to-small replacement, reheat/stop/disposal, heap retainers and GC counters. Report allocation bytes, retained capacity, GC pauses, frame p95/maximum and settlement separately.
- **Exit/cleanup:** The source's 15–25% heap-churn reduction is an experiment target.
  If GC is not the limiting factor or retained memory worsens materially, do not integrate pooling.
  No force-library replacement or hidden graph-size reduction.

### SLICE-008 — Bound generated worker artifacts safely

**Outcome:** Repeated production builds retain all current worker assets and remove only proven obsolete generated files.

- Requires exact DEC-007 approval for `vite.config.mjs` cleanup behavior.
  Inventory current output first; the audit's 21 bundles/~25 MB is not the deletion list.
- Use build ownership/provenance plus current emitted/referenced closure.
  Validate resolved paths remain inside the approved output directory; preserve foreign files, non-JavaScript assets and retained releases.
  Do not turn on blanket `emptyOutDir` as a shortcut.
- Handle worker assets emitted through nested build paths, chunk references, success/failure publication and legacy unmanifested files.
  Unproven files require disposition rather than name-only deletion.
  Separate local output hygiene from assets needed by old browser tabs or deployment rollback.
- **Proof:** REQ-007/011/012, AC-007/011/012, QA-007/011; successive changed builds, malformed/escaped manifest entries, foreign-file controls, failed build, worker/dynamic import loading, old-client and retained-release recovery.
- **Exit/cleanup:** Zero proven orphans; one worker entry only while the architecture has one entry.
  Measure logical bytes actually removed and retained; do not claim disk recovery from count changes alone.
  Retain the recovery asset set before pruning.

### SLICE-009 — Attribute real interactions and import/network delays

**Outcome:** Details open, count-slider release and graph dragging have bounded diagnostic signals that explain delays.

- Predicted area: existing production measurement utilities; application instrumentation only if selected.
  Use Event Timing for relevant discrete interactions and frame cadence/LoAF for drawing/continuous gestures.
  Report input delay, handler processing and presentation separately; do not label a single click duration or drag-frame p95 as page-level INP.
- Feature-detect optional observer entry types, cap buffers, disconnect on disposal and quantify instrumentation overhead.
  LoAF supplies rendering-cycle attribution beyond long-task counts; absence is unsupported/missing evidence, not a zero-stall pass. [Long animation frame timing](https://developer.mozilla.org/en-US/docs/Web/API/Performance_API/Long_animation_frame_timing).
- Measure import latency, concurrency, bytes and cancellation under bounded local throttling/delay/failure controls before designing backpressure.
  Add selected low-spec/mobile/device cohorts only after their environment and constraints are agreed.
- Field INP remains a separate decision: proposed schema, collection purpose, minimization, sampling, consent, destination, retention, deletion and observer must be accepted before any transmission.
  A new RUM package or service needs reuse/version/rights research and exact package/configuration approval.
- **Proof:** REQ-008/009/010, AC-008/009/010, QA-008/009/010; supported/unsupported observers, bounded queues, redaction, teardown, controlled slow-input cases, network failures and measured overhead against an uninstrumented control.
- **Exit/cleanup:** Local diagnostic capability can stand alone.
  Do not claim field coverage from headless results, or silently enable beacons to satisfy a generic guide.

### SLICE-010 — Enforce accepted budgets through the existing delivery path

**Outcome:** Review/release evidence detects genuine regressions without treating noisy CI timing or stale artifacts as truth.

- Requires accepted thresholds and exact CI/configuration approval. Predicted workflow: `.github/workflows/webvowl-ci.yml`; existing measurement/manifest utilities are preferred over a second gate framework.
- Enforce deterministic size, asset-closure, ownership and clone invariants in appropriate automated checks.
  Route timing gates through an admitted environment and frozen candidate evidence; a busy shared runner must not silently pass or establish a performance regression.
- Bind baseline source, candidate source, workload, metric definition and evidence receipt.
  Preserve existing relevant-check/evidence-reuse behavior rather than replacing it with a broad unreviewed job.
- **Proof:** REQ-009/011, AC-009/011, QA-007/009/011; intentional over-budget control, invalid/missing/stale evidence, unquiet machine and supported exact-match receipt.
  Confirm accepted >10% regression and absolute thresholds trigger the specified result.
- **Exit/cleanup:** No workflow/runner/timeout/script/dependency setting changes without exact approval.
  Retire obsolete temporary checks only after the approved native gate covers their intended rule.

### SLICE-011 — Qualify and release only the selected candidate

**Outcome:** The accepted change has coherent correctness, performance, lifetime, security and recovery evidence.

- Freeze source and production manifest after focused/affected checks. Execute the route-selected final profiles, applicable ordinary/specialist review and admitted foreground measurements in dependency order.
  New fixes invalidate affected evidence; do not relabel an earlier full suite as covering later changes.
- Demonstrate W1/W2/W3 calibration/regression paths and W4/W5/W6 accepted scenarios. Retain numerical/visual/semantic checks and the pending actual-device/AT obligations.
  Report accepted limitations separately from passed targets.
- **Proof:** REQ-001 through REQ-012 as selected; AC-001 through AC-012; relevant QA scenarios, signed-off decisions, exact candidate receipts and release-readiness assessment.
- **Exit/cleanup:** Owner approves promotion; named observer checks early deployment and rollback readiness.
  Commit/push/publication and production changes require their own authorization.
  Remove only candidate-owned temporary artifacts after retention decisions; retain baseline, failures, final source binding and recovery assets.

### 7.1 Dependency and traceability table

| Slice     | Requirement / acceptance / quality / decision links            | Dependencies and proof                                            | Release / cleanup consequence                                    |
| --------- | -------------------------------------------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------- |
| SLICE-001 | REQ-009/010; AC-009/010; QA-008/010; DEC-001/002/010           | Current baseline, manifest and accepted scope                     | Establishes evidence and ownership; no optimized release         |
| SLICE-002 | REQ-001/010; AC-001/010; QA-001/004/005; DEC-003               | 001; ownership and native edit counters                           | Independently releasable borrow path; no retained old owners     |
| SLICE-003 | REQ-002/010; AC-002/010; QA-002/008; DEC-004                   | 001; collision/DOM/native allocation proof                        | Independently releasable joins; no identity migration            |
| SLICE-004 | REQ-003/010; AC-003/010; QA-003/008; DEC-004                   | 001; browser text/phase proof; remeasure if 003 changes joins     | Batch-local storage cleared; preserve synchronous publication    |
| SLICE-005 | REQ-004/010; AC-004/010; QA-004/005/010; DEC-005               | 001 and separate worker decision; lifecycle/whole-operation proof | Standby owner bounded; no persistent model pool                  |
| SLICE-006 | REQ-004/005/007/010; matching ACs; QA-004/005/007; DEC-006/007 | 001; refreshed package dependency/admission proof                 | Optional split/admission change; preserve complete asset closure |
| SLICE-007 | REQ-006/010; AC-006/010; QA-006; DEC-001/009                   | 001 and allocation evidence                                       | Conditional pooling; release retired capacity                    |
| SLICE-008 | REQ-007/011/012; matching ACs; QA-007/011; DEC-007             | 001; coordinate with 006 asset graph                              | Safe output pruning; retained release assets survive             |
| SLICE-009 | REQ-008/009/010; matching ACs; QA-008/009/010; DEC-008         | 001; selected local diagnostics and privacy decisions             | Bounded observers; field reporting independently gated           |
| SLICE-010 | REQ-009/011; AC-009/011; QA-007/009/011; DEC-001/007/010       | Selected slice evidence and accepted budgets                      | Approved CI wiring only; no noisy-run pass                       |
| SLICE-011 | All selected REQs/ACs/QAs; DEC-011                             | All selected slices and reviews; current source binding           | Observed release, recovery and explicit retention disposition    |

Semantic independence permits separate preparation of borrowing, joins and diagnostic design after baseline acceptance; it does not authorize agents or concurrent writes.
Renderer/text changes share visual/currentness evidence, worker/admission/splitting share protocol and trust boundaries, and splitting/cleanup share the asset graph. One integration owner resolves those couplings. Performance measurements run sequentially on the admitted quiet host, never alongside tests/builds or another workload.

## 8. Verification design and benchmark commands

### 8.1 Oracle ownership and mocking boundaries

- Controller/session contracts own semantic ownership and currentness assertions; tests must observe externally meaningful copy/immutability behavior, not assert the implementation's preferred accessor name.
- The existing native package validator and malformed/resource corpus own admission correctness.
  Do not replace the validator with a mock to prove a validation-elision change safe.
- The retained independent D3 force oracle owns numerical equivalence.
  Keep it unchanged while changing production storage; do not regenerate expected results from the candidate.
- Real browsers own SVG metrics, font layout, event delivery and rendering cost.
  DOM-only tests may check phase ordering, but cannot certify reflow counts, paint or native geometry.
- Mock genuine external boundaries such as network responses, clock/deadline scheduling, worker transport failure and optional observer support. Complement mocks with native worker/browser/import tests.
- Mutation observers and profiler counters are diagnostic instruments, not substitutes for visual/semantic assertions.
  Independent oracle changes require review and justification separate from the candidate.

### 8.2 Focused checks: existing targets, to run during authorized implementation

Run from the repository root.
These commands are examples verified against existing paths/scripts, not a record of execution in this task.
Select relevant suites per slice; broaden when changes or failures justify it.

```powershell
npm test -- --runInBand src/app/js/controller/controllerReadOwnership.test.js src/app/js/controller/canonicalVowlDocumentSession.test.js src/app/js/controller/canonicalWebVowlController.test.js
npm test -- --runInBand src/webvowl/js/runtime/renderedGraphEditing.test.js src/webvowl/js/graphRendering.test.js
npm test -- --runInBand src/shared/js/util/textLayoutBatch.test.js
npm test -- --runInBand src/app/js/controller/canonicalVowlWorker.test.js
npm test -- --runInBand src/webvowl/js/runtime/legacyForceSimulation.test.js
npm test -- --runInBand packages/vowl/test/liveModel.test.js
npm test -- --runInBand util/benchmarkEnvironment.test.js
```

The audit's proposed `renderedGraphInternals.test.js` need not become a new file just to test a private key.
Prefer meaningful existing rendering tests, adding a new focused suite only if its seam warrants one.
A shallow freeze assertion and two ordinary IDs are insufficient for the ownership/collision contracts described above.

Use the existing affected-test selection and route-selected profiles after inspecting their actual commands.
Current `npm run check` includes lint/docs/JSON, formatting, setup tests, Markdown/JSON integration, corpus storage, full Jest, production bundling and generated JSON checks.
Do not bypass prerequisite ordering or treat these configured profiles as proven complete merely because their names exist.
HISEW inspection currently reports opaque input ordering as unverified.

### 8.3 Corrected benchmark invocation templates

The source's production-driver command omits required arguments; its canonical benchmark supplies a relative output despite the current absolute-path contract.
Passing the current `Label.js` as its own baseline also cannot establish before/after improvement.
Preserve the tools, correct their invocation and bind immutable inputs before use.

```powershell
# Bind these variables to retained, verified artifacts before executing.
node --expose-gc util/benchmark-canonical-performance.mjs $BaselineCommit $AbsoluteResultJson
node util/benchmark-rendering-force-layout.mjs $RetainedBaselineLabelModule
node util/measure-production-performance.mjs $ChromeExecutable $FrozenProductionDirectory $ProductionManifest $NewEvidenceDirectory --mode=latency --fixture=W5-all "--private-fixture=$PrivateFixture"
```

Use the production driver's supported modes (`latency`, `counters`, `trace`, `frames`, `cues`, `lifetime`, `layout`, `reuse`, `functional`, `navigation`, `initial-layout`) for their stated purpose.
Choose existing count/selection-specific switches only after checking the current contract.
Every run uses a new evidence directory.
W1–W3 and synthetic W4 do not require a private fixture.
Do not run the rendering-force microbenchmark for an unrelated patch simply because the audit listed it.

### 8.4 Measurement protocol

1. Freeze baseline/candidate source and build manifests, fixture hashes, browser/runtime versions, viewport/DPR, power mode, font readiness and cache policy.
   Record candidate order and any code changes between cohorts.
2. Follow ADR 0003: machine CPU busy fraction below 10% over the 500-ms preflight window, foreground benchmark execution on an otherwise idle host.
   Do not suspend or kill unrelated user work to obtain admission.
   Prior busy-host exceptions are not inherited.
3. Retain at least one explicitly discarded warmup and twenty measured observations per comparison label as proposed by the audit; use the existing driver schedule and distinguish per-label cohorts, per-load distributions and per-frame samples.
   Report median and nearest-rank p95, maximum, sample count and raw data.
   Twenty observations do not establish broad field confidence.
4. Use uninstrumented comparisons for latency and separate instrumented passes for attribution, allocations, LoAF and heap lifetime.
   Measure instrumentation overhead.
   Match visible node count, topology, camera, selection and layout state.
5. Name clock origins: source submission to first usable observed frame; worker start to ready; admission/ranking phase; command to accepted revision plus frame; active-layout interval and settlement origin.
   Do not subtract durations with different origins or combine percentages from different candidates.
6. Retain failures and slow samples.
   A threshold breach requires an independent corroborating check under ADR 0003; invalid samples may be excluded only with evidence of invalidity and retained reasons.
   Do not rerun until a favorable percentile appears.
7. For ten-cycle lifetime proof, use replacement/disposal and a positive control that the retired-owner detector can actually detect retention. Report owned objects, workers, DOM/listeners and heap separately from browser/runtime noise.
8. For W5/W6 shared evidence, keep fixture contents private and record hashes/shape.
   Raw profiles, URLs, screenshots and heap data can contain ontology content and need explicit sanitization before external review.

### 8.5 Proposed budget register

| Budget from audit                                         | Proposed precise interpretation / approval boundary                                                                                                                                                                |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Any degradation above 10% fails                           | Define selected metric, immutable baseline, measurement uncertainty and absolute gates first; use corroborated admitted comparisons. The audit's unspecified `baseline.md` is not an established baseline artifact |
| Entry at most 680 KB                                      | Proposed decimal 680,000 uncompressed bytes for production entry; owner must confirm units and compression basis                                                                                                   |
| Application vendor at most 300 KB                         | Proposed decimal 300,000 uncompressed bytes; bind exact manifest role rather than only filename                                                                                                                    |
| Worker at most 1.25 MB                                    | Proposed decimal 1,250,000 uncompressed bytes; after splitting separately report entry, operation-specific transferred/evaluated closure and total emitted closure; splitting cannot conceal a budget increase     |
| Zero whole-inspection clones                              | Selection, search focus and the selected read-only command-preparation sites; preserve required transport/copy ownership and classify separately                                                                   |
| W6 active frame p95 at most 50 ms; maximum at most 200 ms | Retain as proposed future target; prior delivery has the explicitly accepted scoped cadence limitation. Do not rewrite it as a current pass or silently remove the target                                          |
| One current worker / zero orphans                         | One entry only for current single-entry design; retain all reachable chunks and approved rollback assets                                                                                                           |
| Font queries reduced by more than 95%                     | Only for a proven comparable homogeneous workload; preserve exact text and report all contexts                                                                                                                     |

The audit's expected 30–40%, 10–15%, 30–50% and 15–25% gains are investigation hypotheses, not additional CI gates unless the owner expressly selects them.

## 9. Configuration proposals requiring exact approval

No configuration file is changed by this document.
`AGENTS.md` requires approval for the exact file and setting before creating, editing, renaming or deleting configuration.
A planning or implementation approval does not substitute for it.

| Potential file / setting                                                                                        | Smallest proposal and behavior                                                                                 | Pipeline / delivery effect and decision                                                                                                              |
| --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `vite.config.mjs`: `webvowlGeneratedJavaScriptCleanupPlugin`, emitted ownership manifest and deletion allowlist | Extend proven generated-file tracking to worker outputs; keep `emptyOutDir: false` unless separately justified | Changes build-time deletion. Must prove containment, current chunk reachability, successful-build ordering and old-release retention before approval |
| `.github/workflows/webvowl-ci.yml`: selected verification jobs/steps and evidence inputs                        | Add only accepted deterministic budget checks and admitted timing-evidence validation                          | Can fail or lengthen CI and alter receipt requirements. Present exact job, commands, inputs and expected failure behavior before approval            |
| `vite.config.mjs`: worker/chunk configuration, if native imports are insufficient                               | No specific setting selected; first inspect actual worker asset output                                         | Changes lazy request graph, failure and deployment behavior. A source experiment does not authorize this configuration                               |
| `package.json` / lockfiles, only if a new script or metric library is selected                                  | Prefer existing commands/native capabilities; no package or version selected                                   | Changes installation/build/test inputs. Obtain exact dependency/version/license and setting approval first                                           |
| Any telemetry/hosting/environment policy                                                                        | No endpoint or policy selected                                                                                 | External collection, data retention and deployment controls require explicit design and exact settings                                               |

The implementer prepares a concrete minimal diff and impact explanation before requesting configuration approval, then stops that configuration-dependent slice until it is granted.
Other accepted independent slices may continue.
Do not broaden directory cleanup or change test/lint policy to make the candidate pass.

## 10. Compatibility, security, rollout and recovery

### 10.1 Data and schema treatment

No persisted ontology/schema migration, backfill or saved-view conversion is intended. Canonical identity, revision/token semantics, imported source fidelity and existing public copy APIs remain unchanged.
If implementation discovers a format or policy-version change is necessary, stop and add a migration/reconciliation design rather than presenting it as an optimization.

Borrowed values are immutable and revision-owned; old values do not mutate into new revisions.
Worker chunks must remain compatible with their parent entry/manifest.
Package validation proof is local to the owned representation and cannot be transmitted as authority.
Cleanup manifests may need a compatibility decision if their format changes; do not assume that is covered by the present cleanup proposal.

### 10.2 Interruption and resumption

Each slice records source identity, selected decisions, tests completed, failed/invalid observations, open findings and artifact ownership. On resumption, recheck current files and HISEW ownership; preserve all changes made by others. Reuse evidence only when relevant source/input identity and environment applicability still hold.
Do not repeat expensive checks solely to produce fresh timestamps, or replay a partially completed worker operation without its lifecycle/recovery contract.

### 10.3 Security and privacy ownership

The package/native security reviewer must assess any admission or worker-lifetime change before release. Preserve untrusted source/import/checkpoint boundaries, cancellation/deadline/resource enforcement, immutable publication and source integrity. No relaxed validation or cross-document cache is justified by speed. Renderer keys must not permit identity confusion; instrumentation must not expose ontology content or retain old documents. Export remains based on authoritative semantic/source state and the existing live-SVG export contract, not stale cached drawings.

Field telemetry has no approved destination or consent in this plan.
Its design owner and observer are unassigned.
Shared external review must keep private source contents private even when real filenames and module names are useful to explain a finding.

### 10.4 Release sequence and observation

1. Resolve prerequisites and accept only selected slices; establish baseline and retain source/asset recovery sets.
2. Integrate independently proven borrowing/join/text changes in small candidate increments.
   Measure combined behavior after interaction between slices becomes possible.
3. Integrate worker/admission/storage candidates only after their specific decisions and proof.
   Keep unsuccessful experiments out of the release while retaining their evidence.
4. Freeze candidate, complete route-selected verification/review and assess release readiness separately from implementation completion.
5. With explicit publication/deployment authorization, stage the exact production asset set and exercise load, edit, count/filter, text, export, cancel/replacement and old-client chunk behavior.
6. A named release observer checks errors, stale publications, latency, memory/worker lifetime, asset failures and accessible interaction during the agreed observation window.
   Owner must set window and stop conditions; this document does not invent them.

Abort promotion for identity/semantic/visual corruption, stale document publication, lost cancellation, validation weakening, missing chunks, unsafe cleanup, unbounded retention, private-data leakage or a corroborated violation of accepted performance criteria.
Report a diagnostic target miss without silently weakening its threshold.

### 10.5 Recovery and cleanup

Before claiming rollback is possible, verify a complete previously qualified application/worker/chunk asset set is retained and deployable with the current persisted data.
Source-only changes can be reversed through a reviewed targeted patch; never discard unrelated working-tree changes or use Git restoration to undo current task edits.
If old-client asset compatibility or manifest changes prevent restoration, define a forward fix and keep promotion blocked until the route is credible.

Worker rollback must leave no standby owners/timers; text rollback must clear all candidate caches; pooling rollback must release retained capacity.
Asset cleanup is the least reversible slice: retain needed recovery copies before deletion and distinguish safe local obsolete outputs from assets still required by deployed clients.

Retain source/candidate manifests, baseline and raw failing samples, accepted decisions, final review/security evidence, necessary fixture hashes and recovery assets.
Remove only task-owned scratch outputs after their evidence/retention role is settled. No physical space-recovery claim follows from an archive/move alone.

## 11. Open questions, cheapest experiments and replanning

| Unknown / decision                                            | Cheapest discriminating evidence                                                               | Consequence                                                            |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Which source “verified” patch claims match actual candidates? | Recover manifest/hash and call-path receipts; compare with current three controller copy sites | Unmatched claims remain unverified; do not credit projected savings    |
| How much current time is startup versus ranking/admission?    | One instrumented current W5/W6 load/edit plus matched uninstrumented control                   | Drop or reprioritize worker work if historical attribution is obsolete |
| Can an existing read model serve controller references?       | Trace required fields, ownership and revision binding through current consumers                | Prefer native reuse; add only the actual missing seam                  |
| Is colon concatenation safe for all admitted keys?            | Domain inventory plus adversarial collision tests                                              | Choose a proven encoding/handle or retain current keys                 |
| Are text metrics equivalent for equal classes?                | Mixed inheritance/inline/style/font fixtures and measured computed values                      | Refine cache key/scope or reject memoization                           |
| How many real layout flushes are caused by batching?          | Native trace of a fixed redraw with explicit phase markers                                     | Retain required barriers; do not optimize a guessed flush count        |
| Does quadtree allocation drive GC/frame tails?                | Allocation profile correlated with GC and script/raster time on W4/W6                          | Reject pooling if not material; no inference-only production patch     |
| Which generated assets are actually orphaned?                 | Current/previous manifests, references and directory inventory                                 | Safe candidate deletion list; unknown provenance remains retained      |
| What mobile/network/field envelope matters?                   | Owner-selected device/network matrix and minimal local diagnostics                             | No invented field SLO, collection policy or universal timing claim     |
| Which release/recovery path is authorized?                    | Retained release asset audit and assigned observer                                             | Promotion stays blocked until complete                                 |

Replan if the baseline or current uncommitted code changes materially; accepted scope conflicts with prior decisions; key/metric equivalence cannot be proved; new dependency/configuration/trust-boundary changes become necessary; preview/currentness/worker concurrency must change; measured cost lies elsewhere; asset retention prevents safe cleanup; or mobile/field evidence contradicts desktop gains.
Change one hypothesis at a time and retain its rejected alternative/evidence.
Do not combine unrelated rewrites merely because the initial small change misses a forecast.

## 12. Source-to-plan preservation map

| Supplied audit content                                                                         | Preserved disposition                                                                                                                |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| A: diagnosis, spatial/search/layout/inspection work already completed, three residual clusters | Sections 2–4 distinguish prior work and current residuals; new slices do not redo accepted changes                                   |
| A/E PERF-01 and J S-2/S-3: cold workers, bundle cost, repeated validation and ranking          | Historical costs in section 3; current-source correction in section 4; independently gated SLICE-005/006                             |
| A/E PERF-02, Patch 2, J W-2, top-three item 2                                                  | SLICE-003, key-domain proof, native class matching, DOM/allocation verification                                                      |
| A/E PERF-03, Patch 3, J S-1, top-three item 3                                                  | SLICE-004; per-batch metrics, dependency-correct geometry, fonts, trace and query targets                                            |
| A/E PERF-04, Patch 1, J W-1, top-three item 1                                                  | SLICE-002; three consumers, immutable borrow, preserved owned copies, edit/lifetime measurements                                     |
| C PERF-05 and D quadtree allocation estimate                                                   | SLICE-007 with independent numeric oracle and attribution gate                                                                       |
| C PERF-06 and J W-3                                                                            | SLICE-008 and exact `vite.config.mjs` approval proposal                                                                              |
| B: W1–W6, runtime/build/test environment, sizes, costs, unspecified inputs                     | Sections 3.1–3.5 preserve quantities and evidence status                                                                             |
| C/D: severity, confidence, effort/risk, complexity, traversal and allocation claims            | Sections 3–4 preserve classifications and estimates while correcting unsupported complexity/flush claims                             |
| F: patch intent, risks, focused suites and rollback                                            | Slices 002–004 and sections 8/10 preserve behavioral intent and strengthen proof; full proposed code is intentionally not duplicated |
| G: quiet machine, warmup/repeats, statistics, four commands and results table                  | Sections 3.4 and 8 preserve values, correct CLI arguments and separate historical evidence from future execution                     |
| H: freeze/reference stability, key uniqueness and layout-order tests                           | AC-001/002/003 and section 8.1 add deep ownership, adversarial identity and native geometry oracles                                  |
| I: >10% regression, bundle, clone, orphan and active-frame gates                               | Section 8.5 and SLICE-010 retain proposed thresholds with units, baseline and approval obligations                                   |
| J M-1/M-2: field INP and LoAF                                                                  | SLICE-009, privacy/unsupported-browser/overhead design; no automatic field transmission                                              |
| J R-1/R-2/R-3: renderer rewrite, solid links and culling exclusions                            | Section 2.2 preserves rationale and reconciles newer scoped renderer work                                                            |
| Missing field/mobile and import-network evidence                                               | QA-008/009/010, section 3.5 and SLICE-009; no speculative network optimization                                                       |

The first proposed implementation candidates remain immutable record borrowing, renderer joins and text metric reuse.
Their acceptance depends on the current-source proofs above.
Worker, artifact, instrumentation and force-storage work retain distinct decisions so the resulting delivery can demonstrate real benefit without losing semantic, visual, ownership or recovery guarantees.
