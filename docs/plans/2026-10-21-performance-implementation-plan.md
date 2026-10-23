# WebVOWL performance implementation plan

> **Status:** Approved delivery plan; revision 17 records the owner's bounded initial-layout implementation approval after final performance/UI source delivery on 23 October 2026.
> The final repaired source passed 9,930 tests in 172 suites and the full repository check.
> Substantive external/security review of the delivered implementation is complete with no unresolved source finding; numerical foreground acceptance remains unqualified, and native HISEW evidence-admission limits remain explicitly recorded.
> The owner accepted PERF-DEC-012 revision 2, option A: implement batched count adjustment and bounded renderer reuse now.
> The owner's CPU-admission exception remains in force; foreground measurements are authorized after diagnostic avenues are exhausted and optimized code is ready.
> S7 is selected only for the maintainability refactor in PERF-DEC-011; SF is reopened within the accepted scope of PERF-DEC-010.
> **Sequence:** Plan 2 of 3, after architecture and before UI.
> **Basis:** [Performance review](../reviews/20261020-performance-review.md), especially sections 6, 7 and 12, plus architecture contract S.
> **Method:** HISEW implementation planning with an accepted change dossier, R2 risk classification, conditional decisions, quality scenarios and traceability.
> **Purpose:** Improve measured user interactions and document operations without weakening correctness, ownership, resource limits or recovery.

## 1. Authority, baseline and entry gate

After the [programme closeout](2026-10-23-programme-closeout.md), the owner chose to keep PR #85 in draft and plan a bounded initial-layout improvement, with manual platform acceptance still pending.
The [follow-up plan](2026-10-23-initial-layout-improvement-plan.md) proposes SLICE-010–012 and PERF-DEC-013 against closeout source `302fb27516ae60553bc8b4bd4cde1c34b2cf9c3b`.
The owner approved PERF-DEC-013 option A and its numerical targets: compare initial spacing/topology seeds, integrate the simplest successful strategy and frame eligible fresh loads once, preserving the solver and scheduling.
Original B3/B4/B5 and small-input guards remain binding, and retained measurements are not relabeled as complete acceptance.

On 21 October 2026, the owner accepted all recommendations in the decision walkthrough and approved the performance plan.
Revision 2 records acceptance of draft revision 1, its R2 risk classification, DEC-001–004 and DEC-008, including the proof conditions attached to the contract changes.
The recommended defaults and evidence-driven decision policies for DEC-005–007 and DEC-009 were also accepted; their later exact selections are recorded in PERF-DEC-010/011/012 and the terminal slice table below.
On 22 October, the owner accepted closing SF as not selected after S0 and S2.
On 23 October, after architectural reassessment, the owner approved bounded SF for ownership and maintainability, independently of a speedup.
This supersedes the no-selection disposition while preserving its evidence and completed S3–S7 work.
On 23 October, the owner approved PERF-DEC-011 revision 2: private checkpoint-admission refactoring within `packages/vowl/src/liveModel.js`, affected public admission/resource/conformance tests and documentation, for maintainability independently of a material speedup.
All snapshots, accounting, native trust-boundary validation and worker lifecycle remain unchanged.
The subsequent owner instruction authorizes implementation after architecture, commit-message selection, commits, branch pushes and configuration changes required by the approved plan.
Follow the [authorized delivery checkpoints](2026-10-21-architecture-implementation-plan.md#authorized-delivery-checkpoints): documentation commit first, consolidated reviews, full tests and fixes before external review of the final candidate.
The owner's subsequent reviewer instruction selects AGY, Flash 3.8 at High, with a 60-minute timeout; it supersedes the original Claude selection.
Approval is not a measured speedup, benchmark result, completed implementation or publication.

On 23 October, the owner requested a logical commit checkpoint for the accumulated implementation.
The consolidated S2–S7 and SF changes were signed and published on the existing feature branch as `528d8b821eb143b88fd761b4b4fa69647c983eab`, after exact-scope formatting and lint, using their retained focused, corpus and production evidence.
Its tree is `f52378a0727bd969c344bedac74712ed75655ef2`.
The subsequent `npm run check` passed: 9,886 tests in 170 suites, repository lint and formatting, integration checks and the production build.
The retained full-check log has SHA-256 `15fae0b937892e802e736091bc2600b460fe028cf865c99e82a63b12ec3d17fd`; it is task execution evidence, not a claim that HISEW admitted a native full-verification receipt.
That was an intermediate source checkpoint; the later S8 implementation, final source verification and review dispositions are recorded in the [final performance handoff](2026-10-23-performance-final-handoff.md).
The subsequent option-A approval resolves the S8 selection decision; its implementation and evidence are recorded in [PERF-DEC-012](2026-10-23-incremental-revision-design.md).
External review remains reserved for the final candidate after the full tests and any resulting fixes.
The owner also authorized using sufficient task evidence instead of repeating checks solely to satisfy HISEW evidence bookkeeping.
Retain failed or rejected native records unchanged and state their limitations; this authority neither converts them to passing receipts nor waives a source defect or an unmeasured numerical acceptance criterion.

The owner challenged the proposed S8 deferral and paused-only eligibility, reported poor live count responsiveness, and offered temporary pausing with a one-second quiet period or Filters dismissal as an acceptable interaction tradeoff.
The owner also asked to assess bounded reuse on architectural grounds, independently of a percentage speedup.
[PERF-DEC-012 revision 2](2026-10-23-incremental-revision-design.md) therefore recommends implementing both bounded renderer reuse and batched count adjustment now, for running, settled and manually paused drawings.
The owner's subsequent explicit option-A answer accepts that scope, ownership, recovery and proof; the preceding questions remain historical discussion.

S2's internal `readOntologyInspection()` borrows the session's existing deeply frozen projection, including nested retained facts; `inspectOntology()` retains its external owned-copy contract.
Controller summary, description, focus and filtered arrangement use the internal reader.
Eight new ownership tests, 208 affected tests and 223 downstream UI/WebMCP tests pass, as do the production build and separate W5 all counter/trace cohorts.
The measured production click has zero whole-inspection clones; total approximate cloned bytes fall from 12,518,764 to 142,858.
Foreground B4 and numerical phase-reduction acceptance remain deferred; the checkpoint's consolidated full verification passed and final review remains ahead.
The [SF decision record](2026-10-22-semantic-read-model-decision.md) records the original no-selection disposition and the owner's subsequent approval of bounded SF.
Contract S is implemented as one session-owned revision/presentation read model, with existing semantic rule helpers and unchanged public bounds.
Its focused verification passed 229 tests in nine suites and 9,084 public-result comparisons against the retained pre-SF implementation on three shipped corpora.
Ten production lifetime cycles retired every previous projection, inspection and populated read model; a retained-owner positive control was detected and all 66 tracked owners were collectible after disposal.
These support the implementation checkpoint; the final handoff adds consolidated verification and the bounded-search repair while retaining the original evidence.

| Baseline item               | Recorded identity                                                                                                                                                                                                                  |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Planning checkout           | `C:/Users/maksy/GitHub/webvowl`, `main`                                                                                                                                                                                            |
| Planning HEAD               | `37fd52759f231d3c1b4794f15b5c599f717b0ddc`                                                                                                                                                                                         |
| Review's source HEAD        | `62961414530e141f8f79ec369afee2d68b9036a6`                                                                                                                                                                                         |
| Performance review SHA-256  | `c483c595bedeae7a75e817267e941501e9f1c3ea1c1ae368855898e62296b937e`                                                                                                                                                                |
| Planning lockfile SHA-256   | `6c137dc6f69bfb4f70cc5db0ef4d7997fd76a1fc3544d33605612a733c49c458`                                                                                                                                                                 |
| Drift checked               | No changes under `src/`, `packages/`, `util/` or `docs/adr/` since the review source; package and lockfile have changed                                                                                                            |
| Actual performance baseline | Accepted architecture source `16e67c902e3438543f3ab520a40b45b2d9e2910a`, tree `a283a59a8cd8a30c55942bc32b261a88ed2b3ffa`; [S0 diagnostic evidence](2026-10-22-performance-s0-evidence.md) complete; foreground acceptance deferred |

The [architecture plan](2026-10-21-architecture-implementation-plan.md) must complete before S0.
Do not run S0 first to reprioritize architecture.
Architecture uses existing evidence paths to check its own neutrality; S0 then measures the delivered architecture.

The owner accepted the architecture source handoff and its `completed-elsewhere` workflow closure.
The exact architecture source has its separately retained full verification; that closure makes no additional verification claim.
Performance execution `53badedd-cb77-4c5d-9f81-79b73fff1a0c` owns the subsequent S0–S8 work on `feat/architecture-performance-ui`.

Expected inherited capabilities:

- Contract R and independent runtime conformance from PR-A.
- Honest deferred-paint/revision double and lifecycle matrix from PR-B.
- Single lifecycle owner, accepted cancellation semantics and retryable `LOAD_PENDING` from PR-C.
- Published `temporaryPresentation`, unified retirement and subscriber isolation from PR-D.
- Canonical-only renderer input from PR-E.

The original sequence was S0 → S1 → S2 → SF → S3 → S4 → S5 → S6 → S7 → S8.
The owner's 23 October SF approval amends the remaining order: preserve implemented S3–S7, integrate bounded SF, then S8 and consolidated final qualification.
Measured ranking determines selection and effort within that order; it does not silently reorder the programme.
SF is architecture PR-F, transferred here to avoid a backward dependency.

A slice completes by merge or by its own evidenced gate disposition: not selected, stopped by its falsifier, or deferred by the owner.
Unanswered decisions remain pending until the owner supplies a disposition.
After architecture and performance implementation are complete, with every performance slice having such a terminal record, revisit acceptance and open decisions in [the UI plan](2026-10-21-ui-design-implementation-plan.md), as the owner directed on 21 October 2026.
The owner's subsequent 23 October instruction requires GPT-6.1 Sol on High for that UI stage, or a pause after performance publication and its record updates if the current chat cannot switch itself.
That review must use the delivered contracts and measurements; UI implementation requires its own accepted plan and authority.
Revival of a closed slice belongs to a new plan after UI.
Closed slices do not imply their proposed capabilities were delivered.

## 2. Scope and HISEW route

In scope: production measurement and attribution; search-cue resolution; inspection copying; revision-owned semantic reads; session-result materialization; drawing payload; producer-boundary ownership; text metrics and worker experiments; accepted batched count adjustment and bounded incremental rendering under PERF-DEC-012.

Preserve the existing UI behavior, route vocabulary, canonical identity, human/agent parity, admission/resource budgets, termination-based cancellation, synchronous atomic publication and recoverable renderer replacement.
PERF-DEC-012 changes slider application timing while keeping immediate requested-count feedback: a one-second quiet period or Filters dismissal applies the latest value, with a temporary layout hold that preserves user intent.
Search-cue eagerness, initial `window.load` timing and details presentation remain unchanged.

Non-goals: persistent model-holding workers, simulation worker, renderer replacement, culling, broader constructor migration, generic caching, budget increases, ontology-materialization-cache implementation or live deployment.

### Risk class:

**R2 accepted by the owner on 21 October 2026.**
Material performance/availability, concurrency, ownership contracts and possible package-admission changes justify elevated assurance.

### Decision owner:

The repository owner has accepted the plan, R2 classification, numeric gates and DEC-001–004 contract/measurement decisions with their stated proof conditions.
The owner retains the evidence-dependent adoption and experiment decisions recorded in DEC-005–007 and DEC-009.
The implementation owner integrates slices and retains evidence.
An independent verifier checks measurement validity and correctness.
Package/security owners participate only if S7 selects their scope.

### Reasoning:

The review identifies reachable O(document) copies, linear reference scans, text layout reads and repeated worker work.
Their magnitude is unknown.
Removing a copy or validation without preserving its responsibility could corrupt state or weaken admission.

### Potential blast radius:

Load, edit, search, summary, describe, focus, view revisions, capture, worker cancellation and canonical package consumers.

### Reversibility:

No persistent schema migration is proposed.
Each optimization is a coherent candidate against the accepted previous slice.
Contract changes require coordinated consumers; reversibility after UI adoption must account for those consumers.

### Principal unknowns:

Production phase shares, private W5 availability, measurement noise, mutable collaborators, retained-memory effects, font invalidation and actual worker startup versus admission costs.

### Required artifacts:

Accepted plan/decisions, immutable baseline and candidate manifests, workload rights/identity record, raw timing and attribution evidence, deterministic counters, independent equivalence outputs, gate dispositions and handoff.

### Required specialist lenses:

Performance measurement and experimental design; concurrency/ownership review.
Selected worker admission or network/input-boundary work triggers the approved native security workflow and corpus specialist review.
No scan or delegation is launched by drafting.

### Required verification:

Focused red/green and differential checks per slice; ADR 0003 measurement; configured final `full` profile; separate real-browser, lifetime and production-bundle proof.

### Required human approvals:

Plan/R2 acceptance, production measurement, the section 4.4 numerical gates and the DEC-002–004 contract directions were approved on 21 October 2026; do not request unchanged approvals again.
SF's earlier no-selection disposition is superseded by the owner's bounded maintainability adoption in PERF-DEC-010.
PERF-DEC-011 selects S7's exact package scope and maintainability purpose under §4.4; worker warming, parser splitting and ranking changes remain unselected.
Implementation, commit messages, commits, branch pushes and configuration changes required by this approved plan are pre-authorized.
New shims, releases and changes beyond the approved plan retain separate authority.

### Maximum sensible autonomy:

Complete the documentation checkpoint, then implement selected performance slices after architecture under the authorized delivery checkpoints.
After implementation authorization, execute only selected slices and experiments within accepted gates.
A falsified hotspot is closed with evidence, not optimized anyway.

### Next lifecycle step:

After architecture completes, perform S0's re-anchoring, native route checks and measurement admission under the current implementation authority, using the accepted plan/R2 classification and DEC-001/008.
Do not repeat their approval request unless material drift changes the accepted scope or criteria.

## 3. Requirements, decisions and quality scenarios

IDs are local to this document; cross-plan references use `PERF:`.

| Requirement                                            | Acceptance criterion                                                                                                                                                       | Source            |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| REQ-001 Measure the actual production composition      | AC-001 Manifest binds source, real entry/worker assets, fixture, browser, environment and harness; W1–W5 cover B2–B6 with independent untraced/traced/counter evidence     | P1, section 6     |
| REQ-002 Optimize only demonstrated work                | AC-002 Every selected slice meets the accepted selection rule, defeats its falsifier and records uncertainty; unchanged behavior is verified                               | Sections 5–8      |
| REQ-003 Preserve semantics and identity                | AC-003 Ordered search, ambiguity/refusal results, scene/occurrence identity, placements, error codes and canonical bytes remain equal except an accepted contract change   | Section 6.8       |
| REQ-004 Remove per-interaction whole-inspection copies | AC-004 Selected S2 read paths have zero full-inspection clones, unchanged outputs and explicit immutable-input/owned-output contracts                                      | P2a               |
| REQ-005 Preserve ownership while reducing copies       | AC-005 Caller mutation cannot alter accepted state; no discarded eager snapshot copy; any drawing-field removal is approved and independently tested                       | P2b–e             |
| REQ-006 Bound preparation lifetime                     | AC-006 Revision/presentation caches invalidate on their actual semantic inputs and retire with the owning generation; ten-cycle equal-live-size checks pass                | SF, S6, B9        |
| REQ-007 Preserve worker admission and cancellation     | AC-007 Full untrusted checkpoint validation, accounting, deadlines, canonical identity and termination remain effective; idle-worker behavior follows an explicit decision | P5                |
| REQ-008 Hand usable evidence to UI                     | AC-008 UI receives the S0 harness, actual describe/summary/focus capability, accepted budgets and limitations at the final source identity                                 | Review section 12 |

| Decision                | Approval status and affected gate                                                                                                 | Accepted recommendation or decision policy                                                                                                               |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DEC-001 / review 1.5-1  | Accepted 21 October: production measurement after architecture completes, before S0 optimization selection                        | Reuse native browser/timing tools and existing harness; no configuration change                                                                          |
| DEC-002 / review 1.5-2c | Accepted 21 October: immutable by-reference internal inspector input for S2/SF, subject to consumer and mutation-isolation proof  | Keep externally promised owned-copy APIs; use a narrow internal read path with owned or explicitly deep-frozen outputs                                   |
| DEC-003 / review 1.5-2b | Direction accepted 21 October for S3; caller audit must establish the compatible materialization mechanism                        | Preserve existing readable fields; choose explicit/lazy materialization only after enumerating callers, with results bound to their originating revision |
| DEC-004 / review 1.5-2a | Accepted 21 October for S4, conditional on independent consumer audit and contract R proof                                        | Remove unused `inspection` from the drawing DTO without changing geometry or semantic ownership                                                          |
| DEC-005 / review 3      | Default and decision policy accepted 21 October; an idle-worker exception still requires S7 measurements and owner approval       | Keep no-idle-worker behavior unless measured startup cost justifies an explicitly accepted, bounded single-use exception                                 |
| DEC-006 / review 4      | Narrow admission refactor accepted under PERF-DEC-011 revision 2 and implemented; ranking redesign remains outside this selection | Preserve full external checkpoint validation and accounting; publish validated private state without a redundant second structural pass                  |
| DEC-007 / SF            | Owner reopened bounded SF on 23 October for ownership and maintainability under PERF-DEC-010                                      | One session-owned revision/presentation read model; preserve semantics, public bounds and S2–S7; prove transitions and retirement                        |
| DEC-008                 | Accepted 21 October: numerical gates in section 4.4 apply before comparisons                                                      | Laboratory acceptance criteria, not measured results or field guarantees                                                                                 |
| DEC-009                 | One-experiment policy accepted 21 October; exact initial S7 experiment remains an owner decision after attribution                | Select the cheapest experiment addressing the dominant phase; persistent model worker excluded                                                           |

Existing architecture Q1–Q5/R4 are inherited, not new decisions.
If the consumer audit shows that DEC-002's accepted immutable contract cannot be met, reopen only the affected decision rather than silently weakening it or claiming S2 delivered a copy-free path.
Record the impact on SF and UI's B3 prerequisite before closing the programme.
Approval of a direction does not satisfy its audit, measurement, conformance or implementation gate.

| Scenario                     | Stimulus/environment                                                               | Required response/proof                                                                                                            |
| ---------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| QA-001 Measurement validity  | Same source in A/A cohorts; foreground production page, quiet host                 | Noise measured; contaminated samples retained with reasons; inconclusive result never promoted                                     |
| QA-002 Search complexity     | Up to six visible hidden-result cues on admitted large input                       | Identical ambiguity, role, refusal and count answers; constant key resolution per reference and no hidden-list allocation for cues |
| QA-003 Read-only interaction | Rapid click/focus/summary calls on W5                                              | Zero whole-inspection clones after S2; unchanged owned outputs; accepted B4 budget                                                 |
| QA-004 Mutation isolation    | Mutate caller inputs/results and injected worker results around load/edit/revision | Accepted state and later exports remain unaffected under the chosen ownership contract                                             |
| QA-005 Revision correctness  | Node-count/filter/language/reveal changes                                          | Identical scene/geometry/export; no stale semantic indexes or font metrics                                                         |
| QA-006 Worker failure        | Abort, deadline, supersession, malformed checkpoint, worker error                  | Termination, bounded accounting, previous-document recovery and no stale publication                                               |
| QA-007 Lifetime              | Ten load/search/edit/export/dispose cycles at W1 and W5 sizes                      | Equal-live-size retention comparison, positive controls and no surviving retired owners                                            |
| QA-008 Small-input guard     | W1–W3 paired baseline/candidate runs                                               | No independently corroborated regression beyond max(10%, 25 ms)                                                                    |

## 4. Measurement protocol and decision gates

### 4.1 Workloads and identities

| Workload                                  | Required scope                                                                                                                                                             |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| W1 FOAF                                   | Packaged canonical fixture; bind current bytes and full SHA-256                                                                                                            |
| W2 benchmark                              | Packaged canonical fixture; bind current bytes and full SHA-256                                                                                                            |
| W3 GoodRelations                          | Packaged canonical fixture; record admitted occurrence/record counts                                                                                                       |
| W4 2,000-class connected and disconnected | Recover fixture construction and hashes from [canonical qualification](../reviews/canonical-vowl-slice006-qualification.md); do not substitute synthetic inspector records |
| W5 private `20260912-full`                | 2,298,206 bytes; expected SHA-256 `85214ddc93194fccf5c0fc4bbbc8f34ab54e54f4abb352f0543411fd56b1c3f6`; measure `auto` and `all`; keep bytes outside the repository          |
| W6 optional multi-import OWL              | Rights-reviewed source for acquisition diagnostics; not a new implementation slice                                                                                         |

Synthetic inspector records, scene occurrences, density/loop families and long-label/fact-heavy families supplement complexity and correctness checks.
They are not evidence of admitted ontology capacity.
Missing W5 or an unrecoverable W4 identity is an evidence gap requiring an owner-approved substitute or defer decision; never present a smaller fixture as equivalent.

For every cohort record source HEAD/tree and dirty-input hashes, lockfile, actual production assets, browser/OS, power plan, refresh rate, viewport/DPR, fonts, fixture and harness hashes.
Bind the worker asset referenced by the current entry bundle, not the newest file found in `deploy/assets`.
The build retains older outputs because `emptyOutDir` is false.
Use manifests and isolated candidate outputs; do not delete shared deployment assets as incidental cleanup.

### 4.2 Operation boundaries

| Boundary         | Start → end                                                         | Required observation                                                                            |
| ---------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| B1 navigation    | Navigation → first ontology paint                                   | Cold/warm cache, load-event gap and resource timing                                             |
| B2 load          | Controller call → first paint after completion/two animation frames | Acquisition, worker ready/phases, delivery, projection, validation, construction, redraw, paint |
| B3 revision      | View request → completed revision plus paint                        | One node-count step, filter toggle and controlled slider sequence                               |
| B4 click/details | Real pointer event → next painted details                           | Event latency and describe/allocation contribution                                              |
| B5 search        | Input event → next painted result list                              | Full UI cue path, not only `findOntologyElements`                                               |
| B6 edit          | Edit request → accepted revision drawn                              | Ten repeated label edits, worker and main-thread attribution                                    |
| B7 export        | Export request → artifact publication                               | Settlement, capture, serialization and hashing                                                  |
| B8 active layout | Reheat → five-second observation                                    | Separate active/idle intervals; run-level frame statistics                                      |
| B9 lifetime      | Ten complete operation/disposal cycles                              | Equal-live-size retained heap, allocation sampling, idle worker count                           |
| B10 cancellation | Replacement at fixed load phase → stale work stopped                | Time to stop and absence of stale publication                                                   |

S0 establishes W1–W5 timing and counters for B2–B6 and a navigation baseline.
B7–B10 are required where a selected slice changes capture, active layout, lifetime or cancellation.
Keep the scenario boundaries usable by UI B3/B5.
A controller-only timing does not establish click-to-painted-preview latency.

### 4.3 Environment, attribution and statistics

Follow [ADR 0003](../adr/0003-quiescent-benchmark-environment.md): foreground measurement, no concurrent build/test/scan/bulk-read work, 10% busy over 500 ms preflight.
Reuse existing settle/idle-wait controls without raising thresholds.
Bound and record retries; persistent guard rejection leaves measurement incomplete.

**Owner-authorized measurement exception, 22 October 2026:** the owner requested running these benchmarks even when the CPU guard fails.
For this execution, an explicit per-run override may make the 10%/500 ms check observational: retain each reading and overridden rejection, label affected results as measurements on a contended host, and bind the owner's decision in the run manifest. Shared guard defaults stay unchanged. Foreground, power, manifest, workload, completion and correctness requirements still apply. Use A/A calibration and paired comparisons; results indistinguishable from noise remain inconclusive, and an overridden run does not satisfy the original quiescent-protocol claim.
This exception does not pre-accept numerical outcomes or evidence-dependent SF/S7 decisions.

**Owner-directed diagnostic priority, 22 October 2026:** after two W4-connected warmups lost foreground, the owner selected "Prioritize diagnostics; defer foreground timings."
Collect explicitly labeled headless counter and trace passes against the same production assets and workloads, with separate decision linkage and all completion/correctness assertions. They supply attribution and work-count evidence; they do not establish foreground paint latency, numerical latency-budget acceptance or a user-facing speedup. Retain the completed W1–W3 and navigation A/A results, every failed attempt and any admitted complete-cohort checkpoints.
Remaining W4/W5 foreground samples and subsequent foreground comparisons are deferred, not waived or passed.
S0 and later decisions must identify any gate that still depends on those measurements.

The owner's subsequent sequencing clarification prioritizes static analysis and targeted headless attribution, then fixes and correctness/ownership checks, then foreground comparisons of the consolidated candidate.
Retain only the baseline collection required for a concrete comparison or selection decision; do not expand foreground calibration before implementing the selected fixes.
Existing completed baseline evidence remains usable within its recorded limitations.

Use the real production page and CSS in headed Chrome, fixed viewport/DPR, dedicated profile with extensions disabled, AC/fixed power plan and no active competing tabs.
Wait for fonts before B3–B8.
Run one discarded warmup per fixture/cohort, A/A calibration and ABBA comparisons.
Use at least 20 samples per version/fixture for nearest-rank p95.
Report raw samples, cohort medians/p95 and run-level frame statistics; frames from one run are not independent samples.
Label 4×/6× CPU throttling as emulation and identify any real constrained device separately.

Separate untraced latency, traced attribution and instrumented counter passes.
Count clone calls and approximate serialized-byte work, freeze walks, text/layout reads, constructions, key resolutions and worker spawns.
The clone-byte estimator itself performs work; its samples cannot become acceptance timings.
Clear optional User Timing records after collection and keep diagnostic instrumentation out of ordinary production behavior.

Long Animation Frames expose forced style/layout duration within scripts, with source attribution limitations and browser-specific support.
Use them for attribution, not as proof that an unavailable API measured zero cost.
The current [Chrome LoAF documentation](https://developer.chrome.com/docs/web-platform/long-animation-frames) was checked on 21 October 2026.
Screenshots and DOM inspection occur outside timed windows.

### 4.4 Accepted measurement and selection rules

| Gate            | Accepted rule                                                                                                        |
| --------------- | -------------------------------------------------------------------------------------------------------------------- |
| Slice admission | At least 15% of an operation on one admitted workload, or counters prove O(document) waste on a per-interaction path |
| Targeted phase  | At least 25% median reduction, subject to valid A/A discrimination                                                   |
| Small corpus    | No corroborated regression larger than max(10%, 25 ms)                                                               |
| B4 click        | W5 `all` p95 at most 200 ms                                                                                          |
| B5 search       | W5 `auto` p95 at most 100 ms                                                                                         |
| B3 revision     | No LoAF over 200 ms per W4-connected slider step; W5 `all` median at most half baseline                              |
| Read copies     | Zero full-inspection clones on selected read-only paths                                                              |
| Load copies     | At most one inspection-sized main-thread copy beyond deserialization, if S3–S5 are selected and accepted             |
| Lifetime        | No increase after ten cycles at equal live size; investigate retained owners with positive controls                  |
| S6              | Forced-layout contribution reduced by at least 50%, with identical geometry                                          |

The 200 ms click target is an accepted lab p95 adaptation, not field INP conformance.
Aggregate copy/revision targets may require multiple selected slices.
If gated slices are closed, record the unmet aggregate target and owner disposition rather than claiming it passed.

A threshold breach needs an isolated repeat, scaling check or arithmetic corroboration before being recorded as a genuine regression.
If A/A spread is comparable to the target, the result is inconclusive.
Select/no-select gates are resolved at the current baseline, not by historical speedup figures.

| Opportunity | Falsifier / no-select evidence                                                                             |
| ----------- | ---------------------------------------------------------------------------------------------------------- |
| P2          | Clone/freeze work under 10 ms per click and under 5% of load/revision/edit on W5                           |
| P3          | Complete cue planning under 5 ms per keystroke on W5 `auto` and W4                                         |
| P4          | Attributable forced style/layout under 15% of revision time on W5 `all` and W4                             |
| P5          | Startup under 5%, and ranking/readmission validation under 15%, of load/edit across FOAF, benchmark and W5 |
| P8          | After selected S2–S6, construction/DOM work no longer dominates revisions                                  |

A structural counter benefit and a timing falsifier can conflict.
The owner may accept a separate ownership/correctness purpose, but must record that basis; it is not a measured speedup.

## 5. Ownership, reuse and compatibility design

| Shared rule            | Authority and consumers                                                         | Strategy, boundary and drift check                                                                                                   |
| ---------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Entity-key resolution  | Current controller reference contract; search projection and inspector          | Reuse the native key meaning and ambiguity rules; separate full/coarse indexes; independent ambiguity fixtures                       |
| Semantic read lifetime | Session's accepted generation/revision plus language/prefix/presentation inputs | SF, if selected, owns preparation once; visibility changes refresh visibility-dependent answers without corrupting semantic identity |
| Inspection ownership   | DTO producer, session and inspector consumers                                   | Freeze/copy at the actual owner boundary; public result promises remain explicit; no generic mutable cache                           |
| Drawing contract       | Runtime R and drawing validator                                                 | Remove unused semantic payload only with DEC-004; geometry and entity semantics keep distinct owners                                 |
| Worker transport       | Worker client and consumer admission validators                                 | Fresh deserialization supplies ownership, not validation or immutability; keep measurement/accounting and untrusted-input validation |
| Text metrics           | Document/font/style epoch and measurement helper                                | Document-scoped cache only after all width-affecting inputs and invalidation are demonstrated                                        |
| Test oracles           | Existing semantic contracts, corpus and baseline outputs                        | Do not compute expected outputs using the optimized resolver/read model/cache                                                        |

Reuse the existing search preparation, scene indexes, native structured messaging, document font events, package validators and benchmark guard.
No new dependency is selected.
The HTML [message-port algorithm](https://html.spec.whatwg.org/multipage/web-messaging.html#message-port-post-message-steps), checked 21 October 2026, serializes before enqueueing receiver deserialization.
That supports investigating a redundant pre-send clone; it does not eliminate validation, resource charging or fake-client ownership obligations.

REU-01/VER-01/LIC-01 require a current software-selection record if an experiment needs a new capability or package.
Existing tool absence is not permission to install or downgrade.
No new NSH-01 bridge or generic cache framework is proposed.
Independent expected outputs and existing boundary validators remain independent even when internal production logic is reused.

## 6. Ordered implementation slices

All slices begin by rechecking their gate against the latest accepted predecessor, write discriminating tests first, and end with a bounded sibling-defect sweep.
File lists are predictions.
No benchmark runs in parallel with other work.

### SLICE-000 — S0: production measurement and deterministic counters

**Entry:** architecture complete, implementation authority present, exact plan/route and DEC-001/008 accepted.

Re-anchor every reviewed hotspot against plan 1's output, including moved contract validators and controller helpers.
Confirm workflow applicability, execution ownership and current profiles.
Extend [the browser qualification harness](../../util/qualify-canonical-browser.mjs) or a narrowly scoped companion to run the production preview with the actual application page.
Its current development/headless behavior must remain honestly labeled; invent no unsupported production CLI flags.

Add phase measurement and separate counters only where attribution requires them.
Keep fixture bytes, raw traces, rejected preflights and summaries in the HISEW evidence root.
A harness self-check must demonstrate phase order, measured boundaries, disabled-instrumentation behavior and manifest linkage.

**Accept:** AC-001, valid W1–W5 evidence, B2–B6 counters, A/A spread, ranked opportunities and a proposed disposition for each later slice.
S0 does not itself improve product speed.
**Stop/recovery:** unavailable workload, noisy host or incomplete phase coverage remains a named gap; preserve samples and seek the smallest owner disposition.
Do not weaken guards.

### SLICE-001 — S1: make search reveal cues bounded by references

**Dependencies:** S0 selection, architecture PR-D.
**Predicted files:** [canonical search projection](../../src/app/js/controller/canonicalSearchProjection.js), [controller contracts](../../src/app/js/controller/webVowlControllerContracts.js), [document session](../../src/app/js/controller/canonicalVowlDocumentSession.js), corresponding controller/WebMCP tests.

Build revision-owned full-key and coarse-key indexes using current reference semantics.
Separate a lightweight `canReveal`/reason/count answer from real-reveal hidden-list construction.
Both paths share the actual admission/refusal policy; eager UI cue behavior remains unchanged.

**Tests/oracle:** independent cases for exact role, coarse ambiguity, missing entity, duplicate references, refusal precedence, caps, counts and exact real-reveal hidden lists.
Differential current versus candidate over admitted inputs.
Count key lookups and hidden-list construction separately from BFS work; O(1) lookup does not imply O(1) total neighborhood traversal.

**Accept:** equivalent answers and WebMCP projection, O(1) lookup per reference, no full hidden list for a cue, accepted B5 result.
**Stop:** ambiguity/refusal drift or P3 falsifier.
**Cleanup/recovery:** retire indexes on revision change; reverse the cohesive candidate if correctness differs.

### SLICE-002 — S2: remove whole-inspection copies from read-only operations

**Dependencies:** S1 disposition, S0 selection, DEC-002.
**Predicted files:** [controller](../../src/app/js/controller/canonicalWebVowlController.js), session, [inspector](../../src/app/js/controller/ontologyInspector.js), relevant tests.

Use a narrow internal immutable read path for summary, describe, focus and arrangement filtering.
Retain `inspectOntology()`'s external owned-copy promise where required.
Do not expose live indexes or relax result ownership.
Audit every current consumer before adopting by-reference input.

**Tests/oracle:** deep immutability including nested `retainedFacts`; attempted mutation; independent descriptions/summaries/focus/arrangement expectations; clone counters around whole controller paths, using PR-B's honest runtime double.
Outputs must remain unchanged and either owned or explicitly accepted deep-frozen references.

**Accept:** AC-004, zero full-inspection clones on selected reads and measured B4 result.
**Stop:** a mutating consumer or an unaccepted public contract change.
**Handoff:** record exact internal-reader contract for SF and UI; no claim that UI rendering is already optimized.

### SLICE-003 — SF: optional revision-owned semantic read model

**Dependencies:** S2 disposition, accepted ownership basis, DEC-007.
This is architecture PR-F and contract S, not an extra architecture phase.

Select if the owner accepts consolidating invalidation ownership, or S0/S2 show material residual index preparation on B4.
Otherwise close as not selected.
If S2 was closed without the required immutable ownership contract, resolve that prerequisite before SF.

**Predicted files:** session, inspector, controller; a small semantic read-model module only if it owns a coherent rule.
Create lazily per accepted generation/revision/presentation.
Own describe, focusable resolution, prepared find, neighborhood planning and reveal ranks as justified by actual consumers.
Do not force visibility-independent semantic indexes to rebuild per pan or selection.

**Tests/oracle:** old inspector functions over FOAF, GoodRelations and benchmark remain a differential oracle until acceptance.
Cover edit/load retirement, language/prefix refresh, visibility changes, selection roles, same-revision reuse and old-generation rejection.
Internal indexes never escape.
Results satisfy S2's owned-copy rule or the explicitly accepted deep-frozen equivalent.
Bounds stay at WebMCP, never as truncation inside the model.

**Accept:** contract S1–S4, independent differential, lifetime proof and actual ownership benefit.
**Stop/recovery:** differing answers or unclear invalidation ownership; restore direct inspector calls coherently before downstream adoption.
No speedup claim from consolidation alone.

### SLICE-004 — S3: avoid eagerly discarded session snapshots

**Dependencies:** SF disposition, DEC-003, current copy evidence.
**Predicted files:** session `load`, `edit`, `updateView`, reveal/clear callers and their tests.

Inventory every consumer of returned inspection/checkpoint/projection fields, including tests.
Audit callers, choose the materialization mechanism within DEC-003's accepted readable-field and originating-revision contract, and update consumers in one slice.
Lazy getters must not pass through object spread, which evaluates them.
Bind a lazy read to its originating accepted result identity so a later revision cannot change the meaning of a previously returned result.

**Tests/oracle:** existing public session expectations remain meaningful; count zero inspection/checkpoint clones when results are discarded; access-once/multiple-access semantics; mutation isolation; result read after a later load/edit; failure and cancellation.
Do not weaken tests to erase the old responsibility.

**Accept:** no discarded snapshot copies and the explicitly accepted result contract.
**Stop:** contract rejection or a consumer that requires eager ownership not covered by the decision.
**Recovery:** coordinated restoration of result construction and consumers; no silent dual API.

### SLICE-005 — S4: remove inspection from the drawing payload

**Dependencies:** S3 disposition, DEC-004, architecture canonical-only renderer.
**Predicted files:** [render projection](../../src/app/js/controller/canonicalVowlRenderProjection.js), drawing validator and tests.

Recheck all drawing consumers, then remove only the unused semantic inspection payload.
Keep drawing rows, bindings, camera/display and recovery inputs.
Update the test pinning that field deliberately against DEC-004.
Any changed runtime member/request is covered by contract R.

**Tests/oracle:** independent renderer conformance, details/facts responses, drawing capture, SVG/canonical export and failed-revision recovery.
**Accept:** expected two inspection-sized copies and one freeze walk removed per drawing, verified by counters; no geometry/content change.
**Stop:** a real inspection reader or recovery dependency is found.
**Recovery:** coherent DTO/consumer reversal before later adoption.

### SLICE-006 — S5: move ownership duties to producer boundaries

**Dependencies:** S4 disposition, accepted producer/consumer ownership contract.

**Predicted files:**

- [Worker client](../../src/app/js/controller/canonicalVowlWorkerClient.js) and session result/projection preparation.
- [Inspection projector](../../src/app/js/controller/canonicalVowlInspectionProjector.js) and related tests.

For checkpoint messages, examine replacing deep pre-send copy with a shallow envelope that contains only the independently changed limit field.
Do not mutate the caller's checkpoint.
Use synchronous serialization and fresh receiver deserialization where they actually establish isolation.
Freeze or copy at the declared producer boundary before consumers reuse the inspection.
Point `retainedFacts` at one accepted frozen inspection only when that lifetime is correct.

Keep `measureCheckpointInput`, limits, deadlines and full admission validation.
Fake worker clients must honor the same isolation contract; tests should deliberately use a retaining/mutating collaborator to prove the boundary.

**Accept:** lower copy counts and equal-live-size retention, identical outputs, mutation isolation and unchanged accounting.
**Stop:** any accounting change, unsafe injected collaborator or increased retained generation lifetime.
**Recovery:** retain boundary copies until their replacement responsibility is proved; never remove an isolation guarantee for a timing win.

### SLICE-007 — S6: reduce text measurement layout cost

**Dependencies:** S5 disposition, P4 selected by S0.
**Predicted files:** [text tools](../../src/shared/js/util/textTools.js), [centering text](../../src/shared/js/util/CenteringTextElement.js), property/rectangular-node consumers and focused geometry tests.

First measure which reads force layout; do not treat call count alone as elapsed cost.
Evaluate a document-scoped `WeakMap` cache and batching reads before writes.
Prove that the key includes every width-affecting font/style/text input: class name alone is insufficient if inherited font or style changes.
Use a font/style epoch, clear on actual stylesheet/font changes, and retain injectable-document behavior.
Do not add a generic cache or mutation observer without a demonstrated invalidation need.

**Tests/oracle:** cached versus uncached independent width/truncation results before/after font load, language, compact notation, inline edit, style changes and document replacement.
Check `dynamicLabelWidth`, `maxLabelWidth`, capture width and fixed-state SVG geometry.
Bound retention of unique labels across load/dispose.

**Accept:** at least 50% lower attributable forced-layout contribution, unchanged geometry and no small-corpus regression.
**Stop:** unexplained geometry change or P4 falsifier.
**Recovery:** remove the cache/batching candidate coherently; the uncached oracle remains available until acceptance.

### SLICE-008 — S7: select one bounded worker experiment

**Dependencies:** S6 disposition, phase attribution, DEC-005/006/009.
**Predicted files:** worker client/worker operations and their tests; package sources only under DEC-006.

| Option                            | Selection evidence                                                                      | Non-negotiable proof                                                                                                           |
| --------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Lazy parser loading within worker | Unused parser compile/evaluation dominates startup for edit/capture                     | Production-referenced assets load in supported deployment paths; deadlines, failures and cancellation still work               |
| Pre-warmed single-use worker      | Startup ≥15% of load/edit or ≥100 ms at 4× throttle; owner accepts idle memory/lifetime | Single job only; bounded idle worker lifetime; termination on cancellation/disposal; no model retained between jobs            |
| Package validation/ranking reuse  | Targeted phase ≥25% of operation and package scope accepted                             | At least one full validation of every untrusted checkpoint; exact canonical bytes/IDs and complete relevant corpus conformance |

Do not try all options concurrently.
Publish a before/after phase hypothesis before implementing the selected experiment.
Lazy imports may use source changes without changing bundler configuration; a necessary bundler/package/lockfile change is covered only when required by the approved plan, with exact scope and rationale recorded.
A change beyond that scope requires a new decision.
A persistent model-holding worker remains excluded.

**Tests/oracle:** stale reply, abort before ready/during work, whole-job deadline, malformed checkpoint, imports, worker error, capture failure and real browser worker-target retirement.
Use package conformance and native validators; no memoized trust based only on object identity.
**Accept:** targeted reduction, small-corpus guard, unchanged accounting/bytes/IDs and explicitly accepted idle-worker behavior.
**Stop/recovery:** canonical/corpus drift or weakened validation; restore the last qualified worker path as one coherent change.

### SLICE-009 — S8: responsive count adjustment and bounded renderer reuse

**Dependencies:** implemented S2–S7/SF and accepted [PERF-DEC-012 revision 2](2026-10-23-incremental-revision-design.md), option A.

The owner amended the original design-only slice on 23 October 2026.
Implement responsive count adjustment first, then renderer reuse within an accepted semantic revision, for running, settled and paused drawings.
Reuse is selected to avoid unnecessary reconstruction and consolidate coherent ownership as well as to improve performance; no minimum percentage speedup selects it.
Keep the existing full renderer as the independent reference and recovery path.

**Accept:** the decision record's burst work-count, direct-result differential, pause/currentness/capture, dependency invalidation, geometry/export, recovery, active simulation and lifetime proofs, followed by consolidated full verification and final reviews.
Preserve numerical acceptance limitations until foreground measurements are qualified.
Cross-revision reuse, physics changes, worker architecture or a broader UI redesign require a new concrete decision.

## 7. Traceability and disposition record

| Slice          | Requirement / acceptance / quality / decision               | Proof                                                                                  | Release/cleanup implication                             | Final disposition                                                                                                                                        |
| -------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S0 / SLICE-000 | REQ-001/002 / AC-001/002 / QA-001 / DEC-001/008             | Production manifest, A/A, counters, phase shares                                       | Preserve reusable harness and private evidence          | Diagnostic work complete; W1–W3 A/A and all seven counter/trace variants retained; foreground acceptance deferred by owner                               |
| S1 / SLICE-001 | REQ-002/003 / AC-002/003 / QA-002                           | Search differential and work counts                                                    | Retire revision indexes correctly                       | Not selected: isolated cue work typically below 5 ms; first-query uncertainty and threshold crossings retained in S0 evidence                            |
| S2 / SLICE-002 | REQ-004/005 / AC-004/005 / QA-003/004 / DEC-002             | Read equality, frozen ownership, zero-copy counters                                    | Publish exact read contract to UI                       | Implemented with ownership tests and production zero-copy proof; foreground acceptance deferred                                                          |
| SF / SLICE-003 | REQ-003/006 / AC-003/006 / QA-003/007 / DEC-007             | Contract S differential and retirement                                                 | Remove scattered caches only after equivalence          | Implemented and finally source-verified; 9,084 corpus comparisons and ten-cycle retirement pass; bounded-search review repair included                   |
| S3 / SLICE-004 | REQ-005 / AC-005 / QA-004 / DEC-003                         | Materialization/lifetime and public-result tests                                       | Coordinated result contract                             | Implemented; lazy-result isolation and ten-cycle retirement passed after fixing the retained load sequencing result                                      |
| S4 / SLICE-005 | REQ-003/005 / AC-003/005 / QA-005 / DEC-004                 | R conformance, geometry/export, clone counts                                           | Remove unused DTO field                                 | Implemented; drawing semantics preserved and production inspection copies removed                                                                        |
| S5 / SLICE-006 | REQ-005/006/007 / AC-005/006/007 / QA-004/006/007           | Ownership/admission and equal-live-size heap                                           | Eliminate duplicate ownership work                      | Implemented; producer/transport isolation, lower copy counts and ten-cycle equal-size lifetime proof passed                                              |
| S6 / SLICE-007 | REQ-002/003/006 / AC-002/003/006 / QA-005/008               | Font/style differential and layout attribution                                         | Cache disposal; preserve uncached oracle until accepted | Implemented and finally source-verified; layout/native geometry controls pass; documented float differences retained; foreground timing deferred         |
| S7 / SLICE-008 | REQ-002/007 / AC-002/007 / QA-006/007/008 / DEC-005/006/009 | Worker experiment and corpus/cancellation                                              | Retire only the selected obsolete worker path           | Implemented narrow admission refactor; affected, lifetime and consolidated full checks pass; final substantive review complete                           |
| S8 / SLICE-009 | REQ-002/008 / AC-002/008 / QA-005 / PERF-DEC-012            | Burst, reuse/full-renderer differential, recovery, native geometry/export and lifetime | Retire adjustment timers, holds and renderer owners     | Option A implemented; full checks and final substantive review complete; production work/geometry/lifetime evidence retained; foreground timing deferred |

Record the exact source/merge identity or no-select/falsifier/owner decision, raw evidence location, reviewer and remaining limitation for every row.
[S3–S5 development evidence](2026-10-22-performance-ownership-evidence.md) records the source-bound counters, retained failure, corrected lifetime run and proof limitations.
[S6 development evidence](2026-10-23-performance-layout-evidence.md) records the two-stage layout experiment, exact geometry comparisons, native precision control and P2f scan removal.
[The approved S7 decision](2026-10-23-worker-experiment-decision.md) records the implemented private checkpoint-admission refactor for maintainability, preservation checks, unchanged accounting and ten-cycle retirement evidence.
[S8 implementation evidence](2026-10-23-performance-renderer-reuse-evidence.md) records count batching, native geometry equivalence, production work avoidance, recovery, active layout, export and ten-cycle lifetime proof on FOAF and the connected 2,000-node workload.
The consolidated full check passed after S8: 9,928 tests in 172 suites, lint, formatting, integration checks and the production build.
After the final security finding was repaired, the second full check passed 9,930 tests in 172 suites and the same remaining gates.
The [final handoff](2026-10-23-performance-final-handoff.md) is authoritative for final review dispositions, evidence limitations and the UI model-switch pause.
Numerical foreground acceptance remains explicitly deferred.
P2f's legacy `hasParallelLinks` scan is not a hidden extra slice: check whether PR-E removed its obsolete meaning; if still present, disposition it explicitly within S4/S6 only if semantically in scope, otherwise later work.
P6 initialization, P7 import overlap and P9 deferred frame options remain observations for a new plan after UI.

## 8. Verification, security and operational acceptance

Current HISEW declarations are `focused → npm run lint`, `affected → npm run test`, `full → npm run check`, each with a 600-second timeout.
Coverage and input-order declarations are absent.
Reinspect and select the accepted route at execution time; do not treat a profile name as measured coverage.
Use the existing npm Jest entry point for focused tests and the dependency-aware selector for impacted-test inspection.
Run the admitted full relevant profile after the candidate and review fixes are stable.

The independent verifier checks:

1. Baseline/candidate differ only in the intended slice; source, lockfile, assets and workloads are correctly bound.
2. Tests have independent expected outputs and exercise real session/package boundaries.
3. Untraced timings, attribution and counters are not mixed.
4. Reported improvements defeat noise and falsifiers; small inputs and cancellation do not regress.
5. Lifetime claims use equal live size and positive controls, and do not claim exact peak heap from samples.
6. Worker/input changes retain native validation and receive any triggered scoped security assessment.
7. Operator/browser results remain separate from native verification receipts and hosted CI.

Private ontology contents, source statements, heap snapshots and traces stay in appropriately restricted evidence storage.
Summaries can use hashes/counts without exposing private facts or URLs.
No telemetry backend, authentication behavior or automatic network reporting is introduced.
Rendering untrusted ontology text and URL acquisition retain existing boundary validation.

## 9. Rollout, recovery, interruption and handoff

No backfill or persisted schema migration is planned.
For each selected slice, retain the preceding qualified source, complete artifact manifest and independent oracle until acceptance.
If a candidate fails, reverse only its introduced edits or develop a coherent correction; do not reset user work.
After interruption, refresh source/dirty state, execution ownership, environment and phase evidence before resuming.
Never combine cohorts collected under different environments as one experiment.

Merge, local verification, hosted qualification, publication and deployed acceptance are separate checkpoints.
An authorized release observer checks exact deployed worker assets, load/edit/revision/export, cancellation and console failures.
Abort rollout on canonical-byte/identity drift, admission weakening, stale publication, retention growth or corroborated performance regression.
Rollback is conditional on current consumers and artifact compatibility; after UI adoption, qualify the full dependent set or forward-fix.

The handoff to UI contains the actual final baseline; all slice dispositions; S0 harness and workload identities; accepted B3/B4/B5 budgets; describe/summary/focus ownership contracts; SF adoption status; worker/font behavior; and unresolved environment/security/browser gaps.
After architecture and performance implementation, use that handoff to revisit UI acceptance and all open UI decisions with the owner.
First finish the authorized performance commit/push and evidence records, then pause before the UI stage until GPT-6.1 Sol with High reasoning is selected, as the owner requested.
Completing this plan does not approve the UI plan.
If S2 or S0 did not deliver a required capability, identify the dependent UI gate explicitly.
Do not reopen an earlier plan silently to satisfy it.

Replan if an oracle cannot discriminate, a hotspot vanishes, noise defeats comparison, private fixtures are unavailable, unexpected identity/contracts change, or implementation needs new configuration/dependencies/package scope.
Expected architecture changes named in section 1 are the starting point, not a replanning trigger.
The programme succeeds through demonstrated user benefit with preserved invariants, including a justified decision not to implement an optimization.
