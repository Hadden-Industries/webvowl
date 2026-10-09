# WebVOWL rendering performance and legacy animation follow-up plan

Status: draft implementation handoff, 9 October 2026.
This task creates this plan only.

The intended outcome is a responsive large-ontology drawing whose force animation matches legacy WebVOWL, while retaining the current canonical document, occurrence, interaction and export contracts.
Begin with two directly evidenced removals of unnecessary per-tick work, alongside a bounded investigation and correction of the force-model behavior difference.
Then select further optimizations from measured remaining costs; the catalogue below gives every identified option an implementation path and an advance or rejection condition.

The owner explicitly restated that animations should match legacy and reported seeing a rendering difference after the extra centering forces were identified.
That is a behavior requirement, not an optional trade-off to accept for higher throughput.
It does not establish that `forceCenter` is the sole cause or that deleting it restores legacy behavior.
The legacy-matching goal does not need approval again; exact behavioral tolerances and the implementation needed to meet it remain to be established.

## 1. Baseline and relationship to existing work

### Source and authority

The inspected checkout is `C:/Users/maksy/GitHub/webvowl`, branch `main`, HEAD `b7ee72199d75674578c6657d90964c039959b390`.
The authoritative starting point includes existing uncommitted changes to `README.md`, `package.json`, `packages/vowl/package.json`, `package-lock.json`, `src/owlapiConsumerBoundary.architecture.test.js`, and untracked `docs/owlapi-git-adoption.md`.
These belong to the earlier approved OwlAPI Git adoption and must remain intact.
Do not substitute clean HEAD dependency contents for the actual candidate environment when measuring it.

The shared-label accessor repair is already implemented in `b30a862be07c9fe378fefe4a9b643b03c044ad8d`, qualified through subsequent fixes including `5b182e341758db8e870ad49af735f400336b37b0` and `32322f1701973d8dd84987e4e0fd77d5ad8dd5cd`, and integrated by the current HEAD.
All nine `Label` force fields now share getter/setter functions across instances.
The [earlier rendering plan](2026-10-09-rendering-performance-regression-plan.md) records that work's original proposal and evidence design; its opening draft text is historical and does not make that initial experiment pending again.
This follow-up does not overwrite it or claim its accepted route automatically covers these additional changes.

This document is a proposed rendering amendment to the [Performance and Search programme](../designs/Performance-and-Search/implementation-plan.md), with its [dossier](../designs/Performance-and-Search/change-dossier.md) and [catalogue](<../designs/WebVOWL Performance and Search Improvements_ Catalogue and Applicability to Hadden-Industries_webvowl.md>).
Reuse that programme's current canonical transposition rather than creating competing implementations:

| Existing programme item               | Follow-up disposition                                                                                                                                                                                                                                 |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SLICE-001; REQ-001/AC-001/DEC-001     | The current renderer still performs link layering, loop grouping and incidence construction. This plan's SLICE-004 refines that same proposal and adds link-part flattening and a conditional old-label lookup.                                       |
| SLICE-002/003/004/005/011             | Canonical scene/reference lookup, edit reconciliation, visibility and reusable preparation have their own adapted plans. Attribute time to these phases if encountered; do not restore bypassed parser/filter targets or start duplicate caches here. |
| SLICE-008/009; REQ-009/AC-009/DEC-007 | The delivered label-accessor repair is a small completed case. Broader constructor sharing remains conditional in this plan's SLICE-010.                                                                                                              |
| SLICE-010                             | Retired-state ownership and recovery constraints apply to all proposed caches, buffers, callbacks and workers. No new eviction policy is selected here.                                                                                               |
| Older independent-review gates        | The owner's current instruction is no independent reviews unless requested. This follow-up uses focused proofs and consolidated verification; it does not import an automatic external-review round.                                                  |

All unqualified `REQ`, `AC`, `QA`, `DEC`, `GATE` and `SLICE` identifiers below are **local draft records in this document**.
References to the older programme are explicitly qualified.
The high-level legacy-animation requirement above is direct owner input; these draft records do not assert acceptance of a detailed design or numerical target.

Current-request HISEW applicability inspection reported personal workflow, `active: true`, for this checkout.
No execution is started or adopted by this plan, and no old execution or pending feedback is reused as implementation authority.
The broader implementation is provisionally R2 because it can affect simulation, canonical placements, capture and interaction lifecycle.
The implementing session must inspect current applicability and route the selected scope using its own ownership; the previous accessor route is historical evidence.
The requested draft is deliverable while those execution prerequisites remain open.

Only this new Markdown plan is authorized by the present task.
Apply [AGENTS.md](../../AGENTS.md): any future configuration change needs explicit approval for the exact file and setting, the smallest proposed edit, and its behavioral/pipeline impact.
No dependency, build, test-runner, lint, CI, hosting, environment or repository-policy change is selected by this plan.
Committing, pushing and deployment have their separate authorization boundaries.

### Legacy reference and history

Use upstream [WebVOWL v1.1.7](https://github.com/VisualDataWeb/WebVOWL/tree/v1.1.7), commit `28e7dd9540622e8cb723dc000824b5eef5ae775f`, as the source reference for the observed legacy service.
The local clean reference is `C:/Users/maksy/GitHub/VisualDataWeb/WebVOWL`.
The separate `C:/Users/maksy/GitHub/WebVOWL-Legacy` checkout at `28e92c7220302c50aa32cebab977ab6e884d8887` reports 1.3.9 and is not the exact hosted 1.1.7 comparison baseline.
Record any use of that later checkout separately.

The observed legacy runtime uses D3 3.5.17; the installed fork uses D3 7.9.0 with `d3-force` 3.0.0.
Historical commit `e1422da7660d3e1430ee622dad9bb14dba2e4788` describes replacing the old force layout with `forceSimulation`, many-body, center and x/y forces, and replacing start/resume with different alpha/restart calls.
Its author and committer dates differ, and current-path history also contains reconstruction commit `e342f5fe` and related migration history `89f3a1fd`.
Trace relevant parent diffs before assigning an introduction point; a commit message does not establish the user's authorization or a first bad runtime revision.
The current owner instruction resolves the desired direction without requiring a consent-history investigation.

### Evidence retained for a self-contained handoff

The prior qualification summary and the 9 October real-Chrome verification report are supporting records, not measurements performed while writing this plan.
The following facts are enough to interpret this proposal without accessing personal Downloads or an earlier evidence directory:

| Evidence                                | Observation and limit                                                                                                                                                                                                                                                                                                                       |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shared-accessor qualification           | An actual-renderer, seeded 300-tick comparison retained matching coordinate and SVG geometry hashes, with no nonfinite values. The comparison fixture had 1,453 simulation points and 1,578 link parts. It is distinct from both the generated force probe and the later already-loaded user tabs.                                          |
| Prior browser pairs                     | Two five-pair production comparisons reported median frame intervals of 37.3 to 25 ms and 33.3 to 25 ms. Machine contention and incomplete quiet-machine calibration limit these findings; they are not portable FPS promises or formal equivalence results.                                                                                |
| Real-Chrome input identity              | Both retained file inputs were 2,298,206 bytes, SHA-256 `85214ddc93194fccf5c0fc4bbbc8f34ab54e54f4abb352f0543411fd56b1c3f6`. The original filename was `20260912-full`. Neither application was reloaded for that observation.                                                                                                               |
| Real-Chrome drawing difference          | Fork: 668 node groups, 775 label groups, 11,707 SVG descendants. Legacy: 634, 740 and 11,397. Viewports and zoom also differed. Equal source bytes do not make these equivalent rendering workloads.                                                                                                                                        |
| Loaded repair                           | All 775 inspected fork labels shared one getter and one setter per field for `x`, `y`, `px`, `py`, `vx`, `vy`, `fixed`, `fx`, `fy`.                                                                                                                                                                                                         |
| Three contemporaneous five-second pairs | Fork/legacy observed node-transform updates per second: 47.246/32.974, 21.424/20.915, 22.688/21.027. The fork was not slower in these observations. Three variable pairs cannot establish statistical significance, an equivalence margin, or a remaining net performance regression.                                                       |
| Metric distinction                      | Animation-frame callbacks, changed graph transforms, force ticks and compositor paints are different observations. The legacy page sometimes had multiple animation-frame callbacks per observed transform change.                                                                                                                          |
| OwlAPI boundary                         | The adopted Git revision is `ccace6afe201c6e2cc6a49e53b2d50bd6617916f`; its existing manifest/lock edits remain uncommitted. The earlier hosted check matched the repaired worker and all 51 assets to the local build. Already-loaded pages cannot retrospectively establish profile-assessment duration. No OwlAPI work is selected here. |
| Known verification limit                | `util/verify-webvowl-lazy-parser-chunks.mjs` previously failed for both baseline and candidate because it expected parser assets under `deploy/js`, while parser code was in canonical worker assets. Preserve that failure as a separate existing limitation; do not report the verifier as passed or fix its configuration incidentally.  |

Static inspection establishes unnecessary operations and real algorithm differences.
It does not establish which remaining operation dominates the user's current browser or prove a net slowdown.
The owner's reported motion difference is independently relevant even when throughput is adequate.

## 2. Current path and complete opportunity catalogue

The canonical path materializes drawing rows in [canonicalRenderElements.js](../../src/webvowl/js/parsing/canonicalRenderElements.js), then enters `refreshGraphData` in [renderedGraphInternals.js](../../src/webvowl/js/runtime/renderedGraphInternals.js).
Its canonical branch bypasses legacy parsing/display filtering but still calls `refreshLinksAndLabels`, `linkCreator.createLinks`, `storeLinksOnNodes` and `setForceLayoutData`.
The simulation advances renderer objects.
Position recalculation updates SVG.
Namespaced tick and end listeners publish layout events through the [D3 renderer adapter](../../src/webvowl/js/runtime/d3RenderedGraphAdapter.js).
The canonical controller consumes those events; full snapshot consumers remain explicit.

`N` denotes class/datatype renderer nodes, `L` label wrappers, `E` rendered links, and `P` force link parts.
Confidence below concerns the identified work or difference, not an unmeasured speedup.

| Priority / option                                            | Confirmed mechanism and expected work removed                                                                                                                                                                                | Confidence / correctness risk                                                         | Advance or rejection condition                                                                                                                           |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| First: scalar layout events, SLICE-001                       | Each tick/end builds `N + L` coordinate records, keys and arrays through `readLayoutState`; the adapter retains only three scalar fields. Remove this O(N + L) preparation from ordinary event publication.                  | High / low with lifecycle coverage.                                                   | Advance on source trace and independent event/snapshot tests. No quiet-machine campaign is needed before implementing the bounded removal.               |
| First: controller status transitions, SLICE-002              | Every layout event rebuilds, recursively clones/freezes the whole controller state, compares changes, and notifies subscribers even with an empty changed-field list. Skip unchanged derived layout status before `publish`. | High / low to medium.                                                                 | Advance after checking subscribers' state-change contract. Keep the native per-tick event stream.                                                        |
| First: legacy animation, SLICE-003                           | Current center plus x/y forces traverse all simulation points four times, while the legacy gravity operation traverses once; integration, link relaxation, charge, initialization and reheating also differ.                 | Algorithm difference high; sole-cause attribution unproven / high behavior coupling.  | Required investigation/restoration for the stated legacy-matching goal. Choose correction through a legacy reference oracle, not FPS alone.              |
| Next: renderer preparation, SLICE-004                        | Node/link nested incidence scans, repeated layer/loop scans and repeated link-part concatenation have avoidable worst-case quadratic work.                                                                                   | High and production reachable / medium ordering and identity risk.                    | Advance when initial mount or drawing revision is materially affected. These are inherited setup costs, not a new per-tick regression.                   |
| Conditional: old-label restoration lookup, SLICE-004         | Labels without finite initial coordinates can search all old simulation objects through `equals`.                                                                                                                            | High source fact; canonical incidence low or unmeasured / medium equality risk.       | First count fallback use. Preserve finite-coordinate fast exit and exact first-match/equality semantics; defer if canonical placements bypass the scan.  |
| Conditional: export settlement snapshots, SLICE-005          | While an export waits, both every runtime event and animation-frame observation read full validated snapshots; frame processing creates Maps and displacement records.                                                       | High but export-only / medium cancellation and end-event risk.                        | Remove redundant non-ending event reads with contract proof; pursue buffer reuse only if export waiting remains material.                                |
| Conditional: curve/geometry allocation, SLICE-006            | Finite checks, intersections, control objects, degeneracy handling and ten coordinate roundings per five-point curve representation repeat during positioning.                                                               | Work high; relative cost unmeasured / medium to high visual safety risk.              | Profile and count first. Consolidate only redundant work while preserving curve strings, guard behavior and warnings.                                    |
| Conditional: topology/shape facts, SLICE-006                 | Per-label binding lookup and type checks in `isSolitaryLabel`, link endpoint metadata, radii and loop/layer facts can repeat within a stable drawing.                                                                        | High source fact; benefit unknown / medium invalidation risk.                         | Cache only facts whose invalidators are enumerated and tested. Canonical positionable labels remain freely placed.                                       |
| Conditional: unchanged SVG attributes, SLICE-007             | Node/label transforms, paths and cardinalities are written each tick even when an individual result is unchanged. This existed upstream.                                                                                     | High work fact; useful hit rate unknown / medium stale-DOM risk.                      | Count unchanged values by scenario. Reject if comparison/retention costs exceed saved writes or active graphs have negligible hits.                      |
| Conditional: paint scheduling, SLICE-008                     | A drawing update could be coalesced to the newest physics state when redundant updates occur before a browser frame.                                                                                                         | Scheduling opportunity unproven / high feedback and timing risk.                      | Advance only on measured redundant updates; preserve physics-side recentering, synchronous interaction/capture flushes and end semantics.                |
| Conditional: plain simulation records, SLICE-009             | Shared descriptors still call `this.property()` for numeric reads/writes throughout D3 force, quadtree and integration loops.                                                                                                | Forwarding high; full-runtime benefit unproven / high state-ownership risk.           | Measure real force work after the chosen legacy behavior is settled. Advance only if savings exceed synchronization cost with the complete state oracle. |
| Conditional: broader method sharing, SLICE-010               | Other constructors allocate per-instance closures; sharing could reduce allocation/retention.                                                                                                                                | Allocation fact; benefit depends on owner/shape / high receiver and inheritance risk. | Reuse the programme's constructor pilot. Require retained-heap and realistic operation evidence before expanding a family.                               |
| Conditional: general controller sharing, SLICE-002 extension | Remaining actual state changes may still clone more unchanged state than necessary.                                                                                                                                          | Mechanism known; residual significance unknown / high public immutability risk.       | Reprofile after the narrow status guard. Reject a general deep-freezer rewrite unless measured residual cost justifies a separately bounded design.      |
| Last: simulation worker, SLICE-011                           | Moving costly physics off the main thread may improve input responsiveness; serialization and painting remain.                                                                                                               | Benefit unproven / high protocol and lifecycle risk.                                  | Require persistent main-thread force pressure after smaller fixes, bounded transfer evidence and a selected protocol.                                    |
| Last: offscreen paint culling, SLICE-012                     | Avoiding drawing work for invisible occurrences may reduce SVG/paint load without removing physics or semantic occurrences.                                                                                                  | Benefit unproven / high visibility, accessibility and export risk.                    | Require large offscreen cost plus a complete visibility/picking/export design. No automatic hiding or selector change.                                   |
| Last: Canvas/WebGL or hybrid renderer, SLICE-013             | A different drawing backend may reduce SVG overhead at high densities.                                                                                                                                                       | Benefit unproven / very high feature and architecture risk.                           | A separate backend design is warranted only if SVG/paint remains the limiting cost after targeted fixes. No backend migration is selected now.           |

Current `groupPropertiesToLinks` already uses the native-Set-backed, property-ID membership wrapper in `src/shared/js/util/set.js`.
Do not propose another Set migration as a new optimization.
Current normal positioning uses native `setAttribute` inside D3 selection iteration; a wholesale D3-selection-to-DOM rewrite is not supported by this diagnosis.
No repeated layout-forcing read was identified in the ordinary unhighlighted tick; `distanceToBorder` is geometry arithmetic, while viewport fitting has separate measurements.
Do not label this path as layout thrashing without a trace.
Both force generations use Barnes-Hut approximation; no newly introduced all-pairs O(N²) charge algorithm was found.

## 3. Requirements, acceptance and design decisions

### Requirements and hard acceptance criteria

| Requirement                                                                       | Acceptance criterion                                                                                                                                                                                                                                                                        |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| REQ-001: Publish runtime layout facts without unused positions.                   | AC-001: Tick/end publication does not enumerate nodes/labels or create position records. Event fields, validation, generation identity and cadence remain correct; an explicit full snapshot remains complete and fresh.                                                                    |
| REQ-002: Publish controller layout state when its meaning changes.                | AC-002: Repeated identical derived status produces no new controller state or subscriber call. Each genuine `relaxing`, `paused` or `settled` transition remains observable, with existing load/disposal filtering. Native runtime listeners still receive their events.                    |
| REQ-003: Restore legacy force-animation behavior.                                 | AC-003: A controlled same-particle/same-link legacy reference demonstrates agreed motion, convergence and interaction correspondence. The owner can verify the intended legacy behavior on representative examples. An algorithm substitution cannot pass solely because it is faster.      |
| REQ-004: Construct identical renderer connectivity with bounded work.             | AC-004: Encounter order, endpoint object identity, multiplicity, inverse treatment, shared layer/loop arrays and indexes match the independent oracle. Incidence/grouping/flattening counts grow with admitted nodes/links/parts, not their cross-product.                                  |
| REQ-005: Observe settlement only as much as required.                             | AC-005: Native-end, stable-frame, timeout, cancellation and supersession results are unchanged. An ordinary active tick does not force a second export snapshot merely to discover `hasEnded: false`.                                                                                       |
| REQ-006: Preserve precise, safe geometry while reducing avoidable rendering work. | AC-006: Same coordinate inputs produce the same supported transforms, path/cardinality geometry, normalized curve text and guard outcomes. Invalid/degenerate inputs never bypass finite checks or zero-length-arrow protection.                                                            |
| REQ-007: Preserve simulation, rendering and interaction synchronization.          | AC-007: Drag, hover, pin, freeze, unpin, pause/resume, distance changes, drawing revision and capture observe the correct current coordinates. No stale frame or old operation mutates a newer generation.                                                                                  |
| REQ-008: Preserve document, occurrence and public contracts.                      | AC-008: Canonical records, roles, topology, exact `nodesShown`, occurrence identities, current inverse placement ownership, saved arrangement/camera, semantic exports and public runtime snapshot shapes remain unchanged. Intentional force-motion restoration is evaluated under AC-003. |
| REQ-009: Bound retained owners and asynchronous work.                             | AC-009: Replacement/disposal releases task-owned listeners, Maps, buffers, frames and workers; no old-generation work resumes or retains a retired graph. Failed edits/loads preserve the accepted document and recovery state.                                                             |
| REQ-010: Make proportional, evidence-backed completion claims.                    | AC-010: Results identify source/dirty-input/dependency/fixture/build identities, correctness oracle, phase, sample unit and environment limits. Static removed work, measured performance, source delivery and hosted acceptance are reported separately.                                   |

These criteria preserve the division between semantic document ownership and renderer projection in [ADR 0010](../adr/0010-rendered-graph-is-a-projection-not-the-store.md), and human/tool action parity in [ADR 0012](../adr/0012-human-and-agent-visualization-action-parity.md).
Native ESM and the existing D3 boundary remain mandatory: D3 imports and APIs stay under `src/webvowl/js/runtime`; new D3 coupling is not introduced into app, shared or element modules.

### Quality scenarios

| Scenario                         | Stimulus and independently observable response                                                                                                                                                                                                                                 |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| QA-001: Active rendering         | Advance identical restored drawings for fixed seeded ticks, then measure ordinary foreground operation. Report force, geometry, event/controller and SVG work separately, with no semantic/coordinate difference for behavior-neutral slices.                                  |
| QA-002: Legacy motion            | Run identical ordered force fixtures under v1.1.7/D3 3.5.17 and the candidate; compare per-step displacement, centroid/spread, link-length distribution, convergence and reheat responses. Use the same canonical drawing to isolate physics from legacy topology differences. |
| QA-003: User interaction         | Drag nodes and independently positionable property labels while active and paused; hover, pin/unpin, freeze/release, change class/datatype distances, and resize/zoom. Placements and action outcomes remain correct without a new camera jump or delayed pointer feedback.    |
| QA-004: Topology/setup           | Mount and revise empty, disconnected, loop-heavy, parallel-edge, inverse-direction, repeated-ID and mixed-type fixtures. Compare ordered incidence and metadata against hand-enumerated expectations and the unchanged baseline.                                               |
| QA-005: Capture/settlement       | Export active, paused and naturally ended drawings; trigger cancellation, replacement and explicit pause during capture. Preserve reason, timeout disposition, generation and pause ownership, plus SVG/LaTeX and canonical arrangement results.                               |
| QA-006: Geometry robustness      | Exercise coincident points, zero-length edges, nonfinite coordinates, extreme finite values, loops, rectangular shapes, editable labels and cardinalities. Current guard skips/warnings and finite export geometry remain effective.                                           |
| QA-007: Lifecycle/memory         | Repeat load, drawing revision, pause, failed load, clear and dispose at equal live graph size. Attribute retained owners and listener/frame/worker counts; distinguish allocation rate from retained heap and GC timing.                                                       |
| QA-008: Practical responsiveness | Compare the same foreground workload with A/A calibration and counterbalanced fresh runs. Separate input latency, graph-update interval and actual paint evidence; establish a useful margin before a performance pass/fail decision.                                          |

### Consequential decisions

| Decision | Direction and reason                                                                                                                                                                                      |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DEC-001  | Add or extract an internal scalar layout-status read while keeping the full snapshot API. A status-only name must not suggest it returns positions.                                                       |
| DEC-002  | Guard the canonical layout-event reducer before general state construction. Preserve the immutable public controller contract and native alpha-event stream.                                              |
| DEC-003  | Treat legacy animation as the required behavior reference. Select the smallest faithful correction supported by the comparative oracle; neither deleting forces nor a D3 downgrade is preselected.        |
| DEC-004  | Reuse native identity-keyed Maps/Sets and stable encounter order for renderer setup; do not merge endpoints by IRI or concatenate unescaped IDs.                                                          |
| DEC-005  | Preserve geometry algorithms, numeric rounding, guards and canonical positionability through behavior-neutral performance changes. Any deliberate motion change is isolated under DEC-003.                |
| DEC-006  | Keep physical state updates distinct from optional DOM scheduling. One explicit owner must resolve simulation, drag, arrangement and capture writes.                                                      |
| DEC-007  | Require measured benefit for numeric records, constructor expansion, broader cloning changes and backend/worker escalation. Prototype results do not silently select a production architecture.           |
| DEC-008  | Reuse native capabilities and current validators before new dependencies. New algorithm reuse, vendoring or backend functionality needs current selection and rights evidence for its exact residual gap. |
| DEC-009  | Deliver independently qualified slices; consolidate compatible changes before broad verification. No independent review, deployment or configuration mutation is implicit.                                |

NAM-01 applies to new or materially changed responsibilities and names.
No public compatibility alias or shim exception is assumed.
An explicitly selected internal implementation of legacy force behavior must be named for that behavior and fit the runtime seam; it is not permission to expose obsolete D3 APIs across the application.

## 4. Gates and implementation order

| Gate                                     | Minimum evidence and owner                                                                                                                                                                                                     | Blocks                                                                                                     |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| GATE-001: Implementation scope and route | Maksy's instruction to implement selected slices, plus the implementing session's baseline, current applicability and applicable route. The requested legacy-matching goal is already stated.                                  | Production edits, not completion of this draft.                                                            |
| GATE-002: Independent oracle             | Implementer retains a known-good baseline and fixtures before editing; legacy work also identifies the precise reference and operational tolerances. Maksy resolves a material unresolved behavioral choice.                   | Equivalence/restoration claims for the affected slice.                                                     |
| GATE-003: Conditional cost               | A focused trace, operation count or bounded experiment attributes material residual cost to the proposed conditional slice. The selected scope fits current authority; obtain further authority only if it materially expands. | Conditional optimizations, not SLICE-001/002 correctness work or the required legacy investigation.        |
| GATE-004: Performance interpretation     | Predeclare practical usefulness and non-regression margins from A/A variability and workload needs before viewing candidate outcomes. Maksy owns a product trade-off; the implementer owns valid measurement.                  | Numerical performance acceptance, not bounded source fixes whose unnecessary work is independently proved. |
| GATE-005: Artifact/release               | Frozen candidate, relevant checks, ordinary-build interaction proof, exact artifact identity and authorized publication/deployment path; identify available recovery or containment.                                           | Publication or hosted acceptance claims.                                                                   |

First wave: minimal baseline capture, SLICE-001 and SLICE-002, and the reference/behavior investigation portion of SLICE-003.
The two direct removals can ship independently while legacy restoration remains open; do not call the overall legacy requirement complete at that point.
Implement the selected legacy correction next, then rebaseline force/geometry timings before investing in more force-sensitive optimizations.
SLICE-004 and the small event-gating part of SLICE-005 can be selected independently when their affected operation is relevant.
SLICE-006/007 precede more complex scheduling, numeric-state or backend work unless the measured cost clearly favors another order.
SLICE-011/012/013 are separate last-resort branches, not a prescribed march toward a new renderer.

The assigned implementer owns integration, oracle integrity, retained evidence and the first authorized rollout observation, accountable to Maksy.
Independent fixture/history research and controller analysis are semantically separable, but runtime, geometry, numeric state and scheduler edits share an owner and must be integrated sequentially.
This dependency description does not authorize further agents or concurrent write work.
Benchmark runs remain serial and separate from builds, tests, scans and other measurements.

## 5. Independently demonstrable slices

### SLICE-000: Freeze only the evidence needed for the next decision

**Links:** REQ-008/010; AC-008/010; QA-001/002/008; DEC-009.
**Deliverable:** a small reproducible workload manifest, retained baseline identities and independent expected results, sufficient to start the first wave.

Record current source and dirty-file hashes, lockfile and installed D3 identities, fixture bytes, admitted occurrence order, force points/link parts, arrangements, viewport/DPR, settings, seeded randomness and runtime/browser versions.
Use at least a small hand-enumerated graph, representative loop/parallel/inverse cases, a normal shipped example and an authorized large canonical drawing.
Keep the actual owner file private; a digest and locally retained drawing suffice unless distribution is separately authorized.
Do not assume the old generated 668-node/750-label probe or either already-loaded browser tab reconstructs the current canonical fixture.

For SLICE-001/002, capture exact event/state traces and work counts first; these prove the avoidable operations without requiring a large benchmark programme.
For SLICE-003, retain the untouched v1.1.7 implementation or exact trace oracle and its identity before building the candidate.
One small A/A exercise and a discriminating paired measurement are the next performance step, followed by broader validation only if the result or intended claim requires it.

**Predicted seams:** existing `util/benchmark-rendering-force-layout.mjs`, `util/benchmarkEnvironment.mjs`, runtime integration harnesses and owned external evidence files.
The existing force benchmark varies `Label` construction on a generated topology; it does not cover runtime snapshot publication, controller cloning, SVG work or legacy physics.
Extend or add an accurately named focused harness only for the missing selected mechanism.

**Proof/release:** retained input manifests reconstruct two equivalent baseline runs; timers are stopped/disposed, errors are preserved, and expected data predates candidate edits.
This is evidence preparation, not a release or an excuse to defer the obvious fixes behind an open-ended benchmark campaign.

### SLICE-001: Publish scalar runtime layout status without coordinate snapshots

**Links:** REQ-001/007/008/009; AC-001/007/008/009; QA-001/003/005/007; DEC-001/009.
**Deliverable:** the same running, paused and ended drawing publishes the same runtime facts with O(1) status preparation per tick/end.

Separate the scalar status derivation from the full coordinate observation in `renderedGraphInternals`.
Derive the empty-graph condition from class/label counts, preserving the present `alpha < alphaMin` comparison and the independence of `isPaused` and `hasEnded`.
Keep `readLayoutState` and public `readGraphLayoutSnapshot` fully functional, current and validated for explicit consumers.
Use the scalar reader in the tick/end event path; the adapter already accepts only `forceAlpha`, `hasEnded`, `isPaused`.
The one-off pause-result read currently also requests a full snapshot just for `hasEnded`; use the same internal status seam there if it preserves the existing pause result.

Preserve namespaced listener registration/removal, event ordering, native final/end observation, load-generation fencing and disposal.
Do not throttle native events, cache stale alpha, remove terminal publication, or infer pause from low alpha.
An empty graph still reports ended; a paused but not naturally ended graph still reports paused without inventing a native-end event.
If SLICE-003 later changes the internal simulation, adapt status production explicitly while preserving these public meanings.

**Predicted files:** `src/webvowl/js/runtime/renderedGraphInternals.js`, `src/webvowl/js/runtime/d3RenderedGraphAdapter.js`; adapter tests, runtime seam tests and actual-renderer coverage.
No public runtime method addition or contract shape change is expected.

**Independent proof:** compare hand-authored scalar outcomes and actual event sequences for empty, one-node, active, paused, alpha-at-minimum, below-minimum, end, replacement and disposal cases.
Instrument the full-snapshot seam in a test to show that ticks do not call it; also exercise the real renderer to show positions remain fresh when explicitly requested.
Retain an exact seeded trajectory/geometry comparison because event work must not affect physics.
Observe allocation/work counts on increasing graph sizes; throughput improvement may be small or noisy and must be reported honestly.

**Release/recovery:** independently releasable after affected contracts and ordinary active/pause/export smoke; no data migration or stored-state change.
Reverse only this slice's source edits if needed; retain full-snapshot capability throughout.

### SLICE-002: Publish canonical layout state only on transitions

**Links:** REQ-002/007/008/009; AC-002/007/008/009; QA-001/003/005/007; DEC-002/009.
**Deliverable:** a running graph can emit changing alpha without rebuilding identical controller state or repeatedly notifying state subscribers.

At the canonical controller's `graph-layout-state-changed` branch, derive the next status using the present precedence: paused, then settled, otherwise relaxing.
Compare it with the current state before calling `publish`.
Keep existing pending-load, generation and disposal rejection ahead of the reducer.
Retain the normal immutable construction/validation for real changes and the runtime event stream for raw observers and the export settler.

The avoided clone covers controller state, not the full ontology model.
Many UI subscribers already gate work on changed fields, so do not claim a full sidebar redraw currently occurs each tick.
`canonicalFactsDialog.refresh` does assign the button's disabled state on each callback; reduced callbacks are a concrete smaller consequence.
Inventory any consumer that treats repeated state callbacks as a clock and qualify its legitimate need through the runtime event seam before changing it.

**Predicted files:** `src/app/js/controller/canonicalWebVowlController.js` and its tests; `webVowlControllerContracts.js`, `canonicalFactsDialog.js` and runtime/settler tests are contract consumers, not automatic rewrite targets.

**Independent proof:** an event sequence with multiple changing alphas produces one relaxing transition, one pause, one resume and one natural settlement at the correct points, with the correct frozen states and changed-field arrays.
Assert unchanged state identity and no notification on repeated derived status; separately assert all native events remain available.
Cover repeated paused/end events, superseded loads, failed-load retained state and disposal.
Count controller construction/subscriber calls against real runtime ticks, and run capture/export ownership regressions.

**Conditional extension:** only if actual remaining state transitions still produce material clone cost, design structural sharing of validated immutable subtrees or narrower publication.
Prove exact field validation, caller isolation and retained-state behavior first; replacing recursive freezing or all JSON comparisons is not the first patch.

**Release/recovery:** independent of SLICE-001 and independently releasable; no schema migration.
Remove only the narrow guard if a previously supported observation contract is demonstrated, then resolve that consumer explicitly.

### SLICE-003: Restore legacy force animation through a controlled reference

**Links:** REQ-003/007/008/010; AC-003/007/008/010; QA-002/003/005/008; DEC-003/008/009.
**Deliverable:** a selected, tested correction that makes the current renderer's animation match the legacy behavior requested by the owner, with current canonical topology and interaction ownership.

**Source distinction:** legacy gravity updates positions toward the viewport center in one traversal and uses position Verlet integration.
Its link relaxation, fixation and annealing are coupled to that implementation.
See the immutable [D3 3.5.17 force source](https://raw.githubusercontent.com/d3/d3/v3.5.17/src/layout/force.js).
The current [center force](https://github.com/d3/d3-force/blob/v3.0.0/src/center.js) computes and translates the centroid in two passes; separate x/y forces update velocities in one pass each. The current [simulation](https://github.com/d3/d3-force/blob/v3.0.0/src/simulation.js) integrates velocities and uses `fx`/`fy` constraints.
This is a genuine behavioral difference, not just additional traversals.
Both charge implementations approximate with a quadtree; their default theta values are 0.8 and 0.9 respectively.
Legacy's cooling from alpha 0.1 and the current default from 1 each imply roughly 300 ticks, so a larger default tick budget is not established as the cause.

Trace the actual WebVOWL wiring as well as library defaults: force execution order, link-part distance/radius calculation, charge scaling for labels, initial placement, pause/resume, drag reheating, distance-setting changes, drawing revision and style refresh.
The exposed charge/gravity/class/datatype/loop/link-strength defaults may match while the equations they feed do not.
Retain source history as provenance; do not treat the migration's description as evidence of accepted behavioral equivalence.

Create a deterministic reference harness with identical ordered particles, endpoints, link parts, initial positions and applicable settings.
Control both initialization and coincident-point randomness in the reference harness without leaving patched globals in production.
Use separately named scenarios for fresh load, resume after settlement, distance changes, dragging, pinned nodes and movable property labels.
Compare force-space motion independently of camera transformations, then qualify the real rendered interactions and export.
Use explicit starting coordinates to isolate force-law differences first; evaluate legacy initialization separately without replacing complete canonical saved placements.

| Acceptance dimension    | Required observation                                                                                                                                                                                                                               |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Motion                  | Per-step displacement and trajectory checkpoints for identical force fixtures, plus elapsed-time animation under a matched foreground environment. Distinguish algorithmic movement from frame scheduling.                                         |
| Shape and convergence   | Centroid drift, graph spread, link-length distribution, oscillation/overshoot and settlement behavior. Do not normalize away unwanted recentering when centroid behavior is the defect.                                                            |
| Reheating               | Compare load, pause/resume, class/datatype-distance updates, node drag and label drag independently. Preserve the legitimate current ability to relax after a paused drag.                                                                         |
| Fixation                | Drag/hover lock, explicit pin, freeze and release preserve intended coordinates and their owners; no movement leaks from an inverse label into another occurrence.                                                                                 |
| Canonical compatibility | Exact occurrence topology, current positionable labels, saved positions/pins, camera and semantic exports survive. The reference force receives a normalized identical graph; the two hosted pages' different node counts are not a parity oracle. |

Numerical tolerances must be declared from reference reproducibility before judging candidates.
Exact deterministic force-state matching is the preferred oracle when implementing the same algorithm.
If a smaller modern-force correction produces approximate legacy behavior, document the residual differences and concrete tolerance before describing it as matching; Maksy decides a material perceptual/behavioral compromise.
Do not reinterpret the requirement as merely preserving the modern trajectory.

Evaluate the smallest correction first: isolate the effect of centroid translation, axis attraction, execution order and reheat behavior using the harness.
Combining x/y loops can reduce passes while preserving the modern equations, but does not itself restore legacy gravity.
Removing center can remove centroid translation while leaving other incompatible dynamics; it is a discriminating experiment, not a predetermined fix.
Changing theta, charge, link strength, damping, decay or end thresholds purely to improve FPS is not an acceptable substitute for matching behavior.

If a bounded correction cannot meet the reference, design a faithful internal force implementation or precisely bounded reuse of the legacy algorithm behind the current runtime.
Document the residual custom gap, maintained/native alternatives, exact source identity, licence/notice obligations and consumer validation before selecting reused or vendored code.
A new simulation must map its state and termination to current runtime events, pause/end semantics and cancellation explicitly.
Do not downgrade the application-wide D3 dependency or reintroduce legacy drag/zoom APIs incidentally; any package/lock/build change first crosses the exact configuration approval boundary.
If the required correction materially changes architecture or stored/public contracts, return a concrete amended design before that implementation branch.

**Predicted files:** `renderedGraphInternals.js`, `d3RenderedGraphAdapter.js`, possibly a new accurately named force module under `src/webvowl/js/runtime`, the existing force/interaction tests and a proposed legacy-reference test/harness.
`forceLayoutNodeFunctions.js` and label ownership are contract seams, changed only if the selected mapping requires it.
The existing `labelForceState.test.js` intentionally proves modern numeric forwarding; retain its useful coverage or retarget it honestly after algorithm selection, rather than silently making a changed fixture the new oracle.

**Independent proof/release:** compare against the retained unmodified legacy implementation, hand-worked small cases and current canonical integration contracts.
Use an ordinary production preview for the representative motion/drag/distance/pause/export demonstration.
Record behavior restoration separately from timing gains; a correct restoration can still require further performance work.
This slice can release independently once the chosen behavioral oracle and existing contracts pass.
Recovery uses an actually available compatible artifact or a bounded forward repair; retain arrangement/camera state and identify any deliberate algorithm change clearly.

### SLICE-004: Build identical renderer links and force inputs in bounded passes

**Links:** REQ-004/008/009; AC-004/008/009; QA-004/007; DEC-004/009; existing programme SLICE-001.
**Deliverable:** an initial canonical mount or drawing revision has identical link/label structure with less setup work.

Use endpoint-object identity to group unordered endpoint pairs once, retaining first encounter and link order.
Assign one shared ordered `layers()` array per group and stable `layerIndex` values.
Group true self-loops by the existing reference predicate and preserve `loops()`/`loopIndex`, including undefined loop metadata on non-loops.
`PlainLink.isLoop()` currently uses element `equals`, whereas metadata grouping uses endpoint reference equality; preserve the distinct contracts rather than replacing one with the other.

Build adjacency once for supplied node objects and append links in input order; a self-loop enters an endpoint's list once.
Replace adjacency on refresh and do not mutate endpoints outside the supplied node collection.
Flatten `linkParts()` in one ordered pass, avoiding repeated copying of the accumulated array and argument-spread limits on large inputs.
Preserve the class-node then label-node order, force indexes, link-part object identities and actual force-registration order.
The target is O(N + E + P) traversal/annotation under ordinary native Map behavior, with bounded O(N + E + P) auxiliary references, rather than a blanket guarantee about adversarial Map implementations.

Keep property-ID membership and current inverse grouping behavior where used by the retained fallback.
Canonical inverse occurrences intentionally have independently owned label placements; do not pair them into a legacy shared label or merge their identities.
Do not conflate repeated IRIs or delimiter-containing IDs with endpoint identity.

Measure old-label fallback use before adding another index.
Current canonical labels already carry finite coordinates and skip the scan.
If material, index candidate old labels only under a proven key/equality contract, retain first-match precedence and current inverse equality, and recheck `equals` for collisions where required.
A Map keyed only by primary property ID is insufficient proof of `Label.equals` equivalence.

**Predicted files:** `src/webvowl/js/parsing/linkCreator.js`, `src/webvowl/js/runtime/renderedGraphInternals.js`; proposed focused link-construction tests and existing canonical materialization/runtime tests.
Reuse the programme's proposed incidence seam if it is implemented first; do not create a second competing owner.

**Independent proof:** hand-enumerated graph fixtures plus normalized baseline metadata, including reference-sharing assertions, absent fields and encounter order.
Cover empty/disconnected graphs, loops, reversed pairs, parallel links, mixed link kinds, distinct objects with equal IDs, repeated IRIs, both inverse paths and repeated revisions.
Use operation-count scaling to prove removed scans; measure preparation separately from parsing, canonicalization, physics and paint.
Run whole canonical load/revision/export smoke and retained fallback regressions because shared helper changes reach both paths.

**Release/recovery:** independently releasable setup optimization with no data/schema migration.
Indexes belong to one preparation/revision lifetime and are discarded with it; no global cache or changed filter policy.

### SLICE-005: Avoid redundant snapshots during active export settlement

**Links:** REQ-005/007/008/009; AC-005/007/008/009; QA-005/007; DEC-001/009.
**Deliverable:** exporting a running drawing retains settlement behavior with fewer full coordinate observations.

`graphLayoutSettler` runs when `canonicalVowlDrawingExport` waits, not on every ordinary load or continuously in the background.
Its event callback currently reads a full snapshot for each matching runtime event, although it uses that snapshot only to check native end; its animation-frame callback separately reads positions for displacement.
First gate non-ending events using their validated scalar payload, preserving a terminal current-generation check and immediate authoritative native-end observation.
Do not simply trust an arbitrary/stale event: establish the runtime event contract, current-generation validation and cancellation path explicitly.

Keep the existing stable-frame algorithm: eight qualifying frame comparisons, displacement at most 0.5, alpha at most 0.005 or paused, unchanged key-set comparability, timeout range 1,000–30,000 ms, default 12,000 ms, and `fail`/`best-effort` outcomes.
Runtime native end and the settler's low-alpha threshold are different concepts.
Keep full snapshots on the frame path when required; removing repeated validation or reusing position Maps/buffers is a later substep only after profiling and an immutable observation/lifetime proof.
Do not advance stability twice from an event and a frame or treat a skipped frame as a stable observation.

**Predicted files:** `src/app/js/controller/graphLayoutSettler.js` and its tests; `canonicalVowlDrawingExport.js`, runtime contracts and adapter tests as consumers.

**Independent proof:** a fake-clock/event harness with separately specified outcomes covers non-ending ticks, end before the next frame, stale/newer generations, key changes, paused movement, just-above/below thresholds, timeout boundaries, cancellation and disposal.
Count snapshot reads without making their exact implementation count the sole oracle; verify returned settlement reasons and capture geometry through the real runtime.
Retain font/two-paint waits, temporary capture pause and `canRestoreLayout` ownership: an old export must never resume a newer or explicitly paused graph.

**Release/recovery:** independent export-path improvement; no ordinary-rendering speedup claim is warranted unless a workload actually exports.
Remove task-owned observation resources on every completion path.

### SLICE-006: Reduce geometry preparation while preserving current output

**Links:** REQ-006/007/008/009; AC-006/007/008/009; QA-001/003/006/007; DEC-005/009.
**Deliverable:** the selected geometry hotspot performs less validation/allocation/preparation for the same coordinates and produces the same safe drawing.

Measure finite-validation calls, intersection/loop calculations, control-point creation and curve formatting separately from DOM writes.
The current shared math implementation rounds ten coordinates for five emitted points to 1e-12, normalizes negative zero, and has bounded degeneracy attempts and fallback controls.
Preserve those behaviors and their exact curve strings in the initial optimization.
Consolidate genuinely redundant reads/checks within one computation or reduce temporary objects only where values cannot change between validation and use.
Do not remove public boundary validation or substitute a different cardinal/spline algorithm because it benchmarks faster.

If topology/shape lookup is material, prepare immutable per-drawing descriptors for positionability, endpoint/link kind, loop/layer facts and stable shape dimensions.
Declare invalidation for document/drawing revision, node shape/radius, label width/language, compact/rectangular notation, editing and any setting actually consumed by a cached quantity.
Cache topology facts, not changing coordinates; measure retained bytes against lookup savings.
`isSolitaryLabel` deliberately returns false for canonical positionable labels: never snap their independent placement to a midpoint as a speed optimization.
Loop-angle state and cardinality offsets must update when their true inputs change.

**Predicted files:** `src/webvowl/js/runtime/renderedGraphInternals.js`, `src/shared/js/util/math.js`, focused math/graph-rendering tests, and canonical materialization tests if descriptors are prepared there.
No D3 import may enter shared math or element modules.

**Independent proof:** retain existing math expected strings and hand-enumerated coincident/degenerate cases; compare exact transforms, paths, cardinalities and warning outcomes from the unchanged implementation across representative trajectories.
Exercise normal and editing paths, pins, moving labels, shape/width changes and immediate redraw while paused.
Candidate and oracle must not both call a newly optimized helper to compute expected values.

**Advance/release:** select only measured redundant work; if validation is cheap or caching invalidation becomes broader than its benefit, retain current code.
Release independently after geometry and export checks; caches are mount/revision owned and disposable.

### SLICE-007: Skip SVG writes whose observable value is unchanged

**Links:** REQ-006/007/008/009; AC-006/007/008/009; QA-001/003/005/006/007; DEC-005/009.
**Deliverable:** repeated positioning of unchanged elements avoids redundant DOM mutation while retaining exact current visual state.

First count unchanged transform/path/cardinality values for active, nearly settled, pinned, paused-redraw and dragged graphs.
Use the result to choose a narrow attribute or dependency-based cache.
A mount-owned last-written value may avoid an attribute read, but must account for every legitimate writer, redraw/replacement and missing/recreated element.
Checking a cached string after computing it saves a DOM write, not geometry computation; state the actual gain.
Dependency-based dirty geometry can save more work but must include endpoint/label coordinates, shape, width, loop/layer state and relevant presentation changes.

Preserve the newest value even when most other attributes are unchanged.
Do not round positions more aggressively or use a movement epsilon that silently changes the drawing.
Invalid input still follows the current skip/warning path, and restoring finite input must repaint.
Do not use absence of a write as evidence that simulation or settlement has stopped.

**Predicted files:** `renderedGraphInternals.js` and its internal SVG guard/positioning loops, graph-rendering and capture/export tests.

**Independent proof:** identical force trajectory and serialized SVG at observed checkpoints, fewer actual `setAttribute` calls on known unchanged cases, and correct refresh after every invalidator.
Test external legitimate writes only where the application owns such a path; no permanent MutationObserver is presumed.
Real-browser evidence must show the saved mutation/paint work exceeds cache/comparison cost.

**Release/recovery:** independently releasable narrow attribute optimization; drop caches on redraw, revision retirement and disposal.
Reject if active workload hit rates or measured net savings are negligible.

### SLICE-008: Coalesce drawing updates without changing physical feedback

**Links:** REQ-003/006/007/008/009; AC-003/006/007/008/009; QA-001/002/003/005/007/008; DEC-003/006/009.
**Deliverable:** a measured redundant-rendering scenario draws the latest state once per useful browser frame while maintaining the selected force behavior and prompt interactions.

The current D3 timer already cooperates with browser frames; demonstrate multiple redundant drawing operations before adding a second scheduler.
First separate physics-affecting position work from pure DOM writes: solitary-label recentering currently writes `label.x/y` during `recalculatePositions`, and skipping that work can change the next force tick.
Preserve its required cadence for retained noncanonical/decorative labels and preserve canonical independently positionable labels.
Allow at most one pending draw request per active generation, replaced by newer state rather than an unbounded queue.

Specify immediate flushes for drag feedback, paused arrangement/style changes, initial canonical presentation, capture/export and the final ended state.
Preserve tick/end publication independently of paint coalescing.
Define hidden-tab behavior explicitly: no false settlement, lost cancellation, silently paused physics or timeout starvation; a pending final state must appear on return where applicable.
Do not batch extra physics ticks or alter animation speed unless that change is part of the qualified legacy-restoration design.

**Predicted files:** `renderedGraphInternals.js`, possibly a small runtime-owned drawing scheduler and existing runtime/capture tests.
Add a scheduler only if it simplifies ownership and can be tested as a complete interaction path.

**Independent proof:** scheduler tests with explicit frame/cancellation ordering, fixed-tick trajectory comparison including recentering, ordinary-browser drag latency and final/capture geometry.
An increased animation-frame callback rate is not a success metric; demonstrate fewer redundant draws or improved input/paint behavior.

**Release/recovery:** depends on a stable selected force contract and proven redundant rendering.
Pending requests are generation fenced and cancelled on retirement; reversible by removing this slice's scheduling layer without changing persisted state.

### SLICE-009: Separate plain numeric simulation records from renderer objects

**Links:** REQ-003/007/008/009; AC-003/007/008/009; QA-001/002/003/005/007/008; DEC-003/006/007/009.
**Deliverable:** real force iterations use plain numeric state and explicit synchronization, with a demonstrated whole-runtime benefit and unchanged selected behavior.

The delivered shared accessors remove per-instance accessor functions; they do not remove forwarding through `property()` on each numeric access.
Prototype plain simulation records only after SLICE-003 selects the force law to preserve, so the optimization does not entrench or optimize the wrong animation behavior.
Retain one mapping per occurrence, not per IRI or equivalent semantic property.
Map force links to those exact records and preserve point/link order, random sequence, charge/distance inputs and fixation meaning.

Write an ownership table for initialization, force integration, drag/hover, pin/freeze, unpin, arrangement application, solitary-label feedback, pause/resume, drawing revision, snapshot and export.
Each operation has one authoritative writer and explicit synchronization before its consumers observe state.
The proposal is not two independently mutable coordinate stores that eventually reconcile.
Avoid per-field forwarding inside the force loop; account for the cost of boundary copies and any synchronization needed each tick.

Preserve all supported fields and distinctions: `index`, `x`, `y`, `px`, `py`, `vx`, `vy`, `fixed`, `fx`, `fy`; preserve undefined/null semantics where current callers depend on them.
`Label.fixed` currently reads primary or current inverse fixation while setters update the primary only; ordinary inverse coordinates remain independently owned.
Retain supported direct, inherited and same-receiver access and existing callbacks, or state a concrete required internal contract amendment before adopting it.
Previously unsupported detached/substituted accessors do not become a new requirement, but that earlier decision is not blanket permission to break other element APIs.

**Predicted files:** runtime internals and a proposed runtime-owned numeric-state module; `Label.js`, `forceLayoutNodeFunctions.js`, canonical render bindings and adapter snapshot/capture seams only as required by the selected ownership design.
Keep D3 confined to runtime; do not spread simulation-specific APIs through canonical/app/shared objects.

**Independent proof:** real labels/properties and independent numeric references over seeded 300-tick runs, all fields/alpha/checkpoints and finiteness, then actual runtime geometry and interaction/capture tests.
Cover current-inverse replacement, inverse-only fixation, primary-only writes, lock/freeze combinations, active/paused dragging, failed/replaced loads, pin export and reopen.
Use the selected legacy oracle for changed physics and the frozen post-restoration baseline for representation-only equivalence.
Reject a surrogate result that omits production fields or real links/renderer feedback.

**Advance/release:** require savings in full force plus synchronization and ordinary rendering, with no retention or interaction regression.
Release independently after ownership proof; no new saved representation is intended.
A necessary schema change or inability to provide coherent snapshots triggers replanning, not a silent migration.

### SLICE-010: Extend method sharing only through a measured constructor pilot

**Links:** REQ-007/008/009/010; AC-007/008/009/010; QA-003/004/005/007/008; DEC-007/009; existing programme SLICE-008/009.
**Deliverable:** one constructor family has lower measured allocation/retention with identical callable behavior and consumer results.

Reuse the existing programme's receiver/state inventory and current canonical consumers.
Choose a family from allocation and retainer evidence; do not rewrite all closures because the small label-accessor fix helped.
Separate methods that can share behavior from instance-owned callbacks and private state that genuinely vary.
Preserve fluent return values, extraction/binding behavior that is supported, descriptor/enumeration shape, prototype/`instanceof` relationships and inheritance initialization.
Avoid replacing closures with per-instance `.bind` functions or introducing a dual API that negates the gain.

**Predicted files:** the measured link or element constructor family and its direct tests; no whole object-model conversion is preselected.
Current `Label` sharing is retained as the baseline, not repeated as a new deliverable.

**Independent proof:** receiver/state matrix, two-instance isolation, actual drawing/editing/export consumers, allocation and retained-owner comparisons at equal graph sizes across repeated lifecycle cycles.
Count functions only as a mechanism observation; report retained heap and user-operation cost separately.

**Advance/release:** expand beyond the pilot only if benefit survives its realistic consumers and the owner accepts any material trade-off already identified.
Current instructions do not require an independent review.
Release coherent families with no half-migrated inheritance chain; no data backfill.

### SLICE-011: Move simulation to a worker only if force still blocks interaction

**Links:** REQ-003/007/008/009/010; AC-003/007/008/009/010; QA-001/002/003/005/007/008; DEC-003/006/007/008/009.
**Deliverable:** a separately selected worker protocol and bounded prototype demonstrate better interaction latency with correct selected physics, then a complete worker-backed runtime path if accepted.

Require evidence that force remains a material main-thread cost after direct removals and the behavior correction.
Reuse the numerical ownership lesson from SLICE-009; an equivalent independently qualified representation can satisfy that dependency without shipping an unnecessary intermediate refactor.
Design bounded latest-state transfer, sequence numbers, load generation/document revision, pause/end/drag/pin commands, stale-result rejection and cancellation.
Measure startup, serialization, copying/transfer, queue backlog, return synchronization, main-thread SVG work and memory together.
Typed buffers are an option, not an assumed answer; detached/shared memory and supported browser requirements need explicit design.

Preserve immediate interaction feedback, paused edits, native settlement meaning, snapshot/capture fences and export pause ownership.
Terminate or retire all work on replacement/disposal and prove no orphan worker or old buffer can mutate a new drawing.
Keep the existing canonicalization worker's job and protocol separate; it is not automatically a suitable host for a long-lived simulation.

**Predicted files:** runtime adapter/internals, proposed runtime simulation-worker client/entry/protocol tests, capture and cancellation consumers.
Changes to bundler entry handling, CSP, worker asset policy or dependencies require exact configuration approval before editing.

**Independent proof/release:** cross-thread deterministic force traces, protocol validation and malformed/stale-message cases, browser worker lifecycle, saturated-input/cancellation tests, ordinary capture/export and measured latency.
Security/privacy assessment belongs to the selected worker boundary and implementing owner; no repository-wide scan or external review is launched automatically.
Reject if transfers or SVG dominate, the main thread is not relieved, or failure handling is more costly than the useful improvement.

### SLICE-012: Cull only offscreen drawing work under a complete visibility contract

**Links:** REQ-006/007/008/009; AC-006/007/008/009; QA-003/005/006/007/008; DEC-005/007/009.
**Deliverable:** a conditional visible-drawing path reduces demonstrated offscreen paint/update cost while keeping the complete simulation, document and export.

Measure offscreen cost before designing culling.
Visibility must use the camera and a conservative geometry bound including node extent, curved links crossing the viewport, labels, markers, halos and cardinalities.
Panning/zooming/resizing, selection/focus, dragging and graph motion invalidate visibility promptly.
Do not remove invisible occurrences from force, alter canonical hidden state, reduce `nodesShown`, or make details and keyboard/tool actions disappear.
Define a full-drawing capture path so offscreen content remains in exports and fit-to-graph calculations.

**Predicted files:** runtime viewport/positioning and drawing ownership, with existing selection, capture, viewport and accessibility consumers.
No semantic projection change is selected.

**Independent proof/release:** geometry bounds and edge-crossing fixtures, rapid pan/zoom/drag reentry, focus/selection and accessibility behavior, complete exports and lifecycle checks.
Measure culling/invalidation overhead as well as saved work.
Reject if large-graph cost is mainly onscreen or the complete visibility contract cannot be maintained economically; obtain a separate selected design before implementation.

### SLICE-013: Consider a different drawing backend only after an SVG bottleneck is proved

**Links:** REQ-003/006/007/008/009/010; AC-003/006/007/008/009/010; QA-002/003/005/006/007/008; DEC-007/008/009.
**Deliverable:** a separate backend feasibility decision, followed by its own implementation plan only if the measured benefit and feature obligations justify it.

Compare native Canvas, WebGL and a hybrid using the same accepted force state and scene; do not change physics or topology to make a backend look fast.
Account for text quality, label measurement, curves/markers, picking/hit testing, touch/keyboard interaction, focus/hover/pins, inline editing, accessible representation, DPR/zoom, context loss, memory and battery cost.
Preserve SVG/LaTeX export through an independently qualified complete drawing representation.
Canvas pixels or GPU primitives do not replace semantic/document ownership or an accessible interaction surface.

**Predicted seams:** the existing rendered-graph runtime boundary and a separate proposed backend; no precise production file list is credible before backend selection.
Native capability, current maintained options, browser support, licence/notice obligations, resource policy and any exact configuration changes are prerequisites for that later design.

**Independent proof/release:** an isolated representative prototype with the same scene, interaction/capture acceptance matrix and whole-operation measurements.
Reject if the useful improvement is absent or the feature gap is unacceptable.
No implementation, dependency or dual-backend compatibility layer is authorized merely by listing this option.

## 6. Traceability and release implications

| Slice     | Requirements / acceptance      | Quality / decisions                                 | Falsifiable proof                                                                                       | Release and cleanup implication                                       |
| --------- | ------------------------------ | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| SLICE-000 | REQ/AC-008,010                 | QA-001,002,008; DEC-009                             | Reconstruct equivalent baseline fixtures and retain independent expected data.                          | Evidence only; preserve raw/invalid samples and stop harness timers.  |
| SLICE-001 | REQ/AC-001,007,008,009         | QA-001,003,005,007; DEC-001,009                     | No full-snapshot enumeration during events; exact scalar/event/lifecycle and explicit snapshot results. | Independent patch; full snapshot contract remains.                    |
| SLICE-002 | REQ/AC-002,007,008,009         | QA-001,003,005,007; DEC-002,009                     | State changes occur exactly on layout transitions; native event stream remains.                         | Independent patch; no general state-contract rewrite.                 |
| SLICE-003 | REQ/AC-003,007,008,010         | QA-002,003,005,008; DEC-003,008,009                 | Independent v1.1.7 motion/reference checks plus current canonical interactions and capture.             | Behavioral restoration has its own acceptance and artifact identity.  |
| SLICE-004 | REQ/AC-004,008,009             | QA-004,007; DEC-004,009                             | Ordered identity/metadata equivalence and linear work-count scaling.                                    | Independent setup change; discard preparation indexes.                |
| SLICE-005 | REQ/AC-005,007,008,009         | QA-005,007; DEC-001,009                             | Same settlement/cancellation outcomes with fewer redundant event snapshots.                             | Export-only gain; release frames/listeners on all exits.              |
| SLICE-006 | REQ/AC-006,007,008,009         | QA-001,003,006,007; DEC-005,009                     | Exact geometry/guard outputs with lower measured preparation.                                           | Disposable geometry facts; no curve algorithm change.                 |
| SLICE-007 | REQ/AC-006,007,008,009         | QA-001,003,005,006,007; DEC-005,009                 | Fewer unchanged writes, same SVG and correct invalidation.                                              | Mount-owned caches; clear on redraw/revision/dispose.                 |
| SLICE-008 | REQ/AC-003,006,007,008,009     | QA-001,002,003,005,007,008; DEC-003,006,009         | Same selected physics, prompt interactions/capture, fewer redundant draws.                              | One pending generation-owned frame; cancel/flush correctly.           |
| SLICE-009 | REQ/AC-003,007,008,009         | QA-001,002,003,005,007,008; DEC-003,006,007,009     | Complete numeric/interaction oracle and lower force-plus-sync cost.                                     | One coordinate owner; retire maps/buffers with generation.            |
| SLICE-010 | REQ/AC-007,008,009,010         | QA-003,004,005,007,008; DEC-007,009                 | Receiver/isolation matrix and measured allocation/retained-heap benefit.                                | Coherent pilot/family only; no partial migration.                     |
| SLICE-011 | REQ/AC-003,007,008,009,010     | QA-001,002,003,005,007,008; DEC-003,006,007,008,009 | Cross-thread physics/ordering/cancellation and input-latency evidence.                                  | Separate protocol/asset qualification; terminate workers.             |
| SLICE-012 | REQ/AC-006,007,008,009         | QA-003,005,006,007,008; DEC-005,007,009             | Conservative visibility, complete action/export parity and net savings.                                 | Complete scene retained; reset visibility owner on replacement.       |
| SLICE-013 | REQ/AC-003,006,007,008,009,010 | QA-002,003,005,006,007,008; DEC-007,008,009         | Equal-scene backend prototype and complete feature feasibility.                                         | Separate design/release required; prototype is not a shipped backend. |

## 7. Verification and measurement discipline

### Oracle independence and practical proof

Maintain two distinct oracles.
For behavior-neutral changes, use the frozen current fork with the same canonical drawing, seed, force order and fixed ticks; compare coordinates, fields, events and SVG without regenerating expectations from the candidate.
For legacy restoration, use the retained exact legacy implementation and agreed operational observations, while current canonical tests remain authoritative for semantics, identity and export.
After accepting restoration, freeze that corrected behavior as the baseline for subsequent representation/scheduling changes.

The implementer owns oracle provenance and interpretation; Maksy owns unresolved behavior trade-offs.
No separate reviewer is automatically required.
Keep hand-worked small examples and fixed expected strings beside differential tests so an error shared by two harnesses cannot silently become the contract.
Assert finiteness explicitly: equality alone can accept matching invalid values.
Preserve case-sensitive import spelling; the previous accessor qualification found a Windows-hidden Linux import-case failure.

Use real D3/selected force code, actual Label/property/node instances and genuine link parts for force claims.
The adapter fixture is appropriate for event/state contracts but cannot alone prove actual hot-loop behavior.
Fake clocks/animation-frame boundaries for deterministic scheduling tests; mock only external timing, delivery, font/paint or artifact boundaries that the test intentionally controls.
Exercise real ordinary-browser rendering for paint, pointer behavior and scheduling claims, consistent with [ADR 0011](../adr/0011-a-test-double-must-behave-like-its-subject.md).
The present planning task does not open, reload or operate the user's Chrome tabs.

### Select checks by the actual slice

These are existing entry points and suites inspected during planning, not product checks executed by this document task.
Use `npm test -- --runInBand --runTestsByPath` followed by the relevant paths below; existing explicit serial runs retain `--runInBand` and existing configured worker limits remain intact.
New focused tests named by a slice are runnable only after they exist.

| Change seam                       | Existing focused test paths                                                                                                                                                                                                                                                                                                             |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scalar events/runtime lifecycle   | `src/webvowl/js/runtime/d3RenderedGraphAdapter.test.js`, `src/webvowl/js/runtime/renderedGraphSeamConformance.test.js`, `src/app/js/controller/renderedGraphRuntimeContracts.test.js`                                                                                                                                                   |
| Controller state                  | `src/app/js/controller/canonicalWebVowlController.test.js`, `src/app/js/controller/webVowlControllerContracts.test.js`                                                                                                                                                                                                                  |
| Force fields and ownership        | `src/webvowl/js/elements/links/Label.test.js`, `src/webvowl/js/runtime/labelForceState.test.js`, `src/webvowl/js/runtime/renderedGraphEditing.test.js`, `src/shared/js/modules/pickAndPin.test.js`                                                                                                                                      |
| Geometry and topology             | `src/shared/js/util/math.test.js`, `src/webvowl/js/graphRendering.test.js`, `src/webvowl/js/parsing/canonicalRenderElements.test.js`, `src/webvowl/js/elements/links/ArrowLink.test.js`, `src/webvowl/js/elements/links/BoxArrowLink.test.js`                                                                                           |
| Settlement/capture/export         | `src/app/js/controller/graphLayoutSettler.test.js`, `src/app/js/controller/canonicalVowlDrawingExport.test.js`, `src/webvowl/js/runtime/captureRenderedDrawing.test.js`, `src/webvowl/js/runtime/renderedSvgExportClone.test.js`                                                                                                        |
| Canonical placement/view/selector | `src/app/js/controller/canonicalVowlScene.test.js`, `src/app/js/controller/canonicalVowlViewControls.test.js`, `src/app/js/controller/canonicalVowlRenderProjection.test.js`, `src/app/js/controller/canonicalVowlDocumentSession.test.js`, `src/app/js/controller/nodesShownContracts.test.js`, `src/webvowl/js/graphViewport.test.js` |
| Architecture                      | `src/renderedGraphDecoupling.architecture.test.js`, `src/productionModuleFormat.architecture.test.js`, `src/productionGraph.architecture.test.js`                                                                                                                                                                                       |

Consolidate the selected implementation and run its affected checks first; then run applicable route-selected broader verification once on the candidate.
Current ordinary commands include `npm run lint`, `npm run format:check`, `npm test -- --runInBand` and `npm run build`.
Inspect the current package scripts and HISEW profiles rather than assuming a profile name proves coverage or execution order.
Build the production artifact after any harness that may have replaced output, then qualify that exact ordinary build.
The known lazy-parser verifier failure remains separately reported unless an authorized later task repairs it.
Do not trigger hosted CI manually without authority or treat pending/skipped checks as a pass.

For this plan alone, a focused Markdown/format check and link/coverage review suffice; no application tests, browser session or benchmark is required to establish a documentation edit.

### Measurements and acceptance levels

Record separate durations/counts for acquisition and parsing, canonical processing, scene/projection preparation, renderer construction, active force work, geometry, SVG mutations, runtime/controller publication, settlement waiting and capture/export.
Do not credit a setup index for per-tick improvement or an OwlAPI repair for steady-state rendering.
Measure a typical small graph as well as the authorized large drawing so extra cache/synchronization overhead is visible.

Use fixed-step, seeded work for algorithm and coordinate comparison, then ordinary foreground browser runs for user-visible timing.
[D3's manual tick contract](https://d3js.org/d3-force/simulation) does not emit tick/end events; explicitly exercise event dispatch and renderer callbacks where the harness otherwise omits them.
Keep trace instrumentation separate from untraced outcome samples and move DOM inspection/screenshots outside measured windows.
Match browser version, machine, foreground status, viewport, DPR, camera, settings, topology, initial arrangement and pause/reheat sequence.

Start with A/A noise and a small counterbalanced set of fresh-process or freshly restored independent runs; the existing force harness supports five fresh-process pairs and `--aa` for its narrower label question.
Retain per-run and per-session results instead of pooling away contradictory sessions.
Frames or ticks within one run are correlated observations, not hundreds of independent experimental samples.
If a formal statistical claim is needed, predeclare the run-level estimator, confidence interval, minimum useful effect and equivalence/non-inferiority margin; three favorable noisy pairs do not supply those.
Practical usefulness and formal statistical significance are separate decisions.

Apply [ADR 0003](../adr/0003-quiescent-benchmark-environment.md) and the existing benchmark guard.
The rendering-force utility requests a five-second idle sample and uses the shared 10% busy guard; do not weaken it to manufacture a pass.
No build, test, bulk scan or second benchmark runs concurrently with release-gated measurements.
Preserve rejected runs and reasons; a later clean run does not retroactively qualify them.
If the owner authorizes proceeding despite timing limits, complete correctness work and report limited observations without declaring quiet-machine acceptance.

| Completion level                 | Evidence needed                                                                                                                                            |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unnecessary work removed         | Source path plus deterministic operation/event/contract proof. Suitable for SLICE-001/002 even when small timing effects are below noise.                  |
| Legacy behavior restored         | Independent legacy reference and agreed motion/interaction acceptance, plus current canonical contract coverage. Throughput alone cannot close this level. |
| Performance improvement measured | Matched phase and whole-operation runs with environment/uncertainty disclosed and an accepted practical margin where a pass/fail claim is made.            |
| Source delivered                 | Authorized commit/publication and actual required check results for the exact candidate.                                                                   |
| Hosted acceptance                | Authorized deployment, hosted asset identity and agreed ordinary-browser behavior/performance observations for that artifact.                              |

No percentage gain is promised for the unimplemented slices.
The earlier plan's 15%/10% proposal thresholds are historical proposals for its experiment; do not silently transplant them onto unrelated event, setup or behavior-restoration work.

## 8. Compatibility, observability and delivery

All initial slices intend no saved-data/schema/public-snapshot change and therefore no backfill.
Canonical record/occurrence IDs, source bytes, accepted scene state and recovery checkpoints remain their current owners' responsibility.
Preserve round trips for pins, independent inverse placements, view controls, camera and semantic/drawing export rather than assuming an internal optimization cannot affect them.
Changing a stored representation, snapshot shape, supported import path or resource policy requires a concrete design/migration amendment before dependent implementation.

Indexes, dirty flags, prepared facts, numeric records and pending callbacks are mount/generation/revision owned as appropriate; presentation-derived caches also track their actual style/label invalidators.
State precisely whether a failed revision publishes nothing or restores the previous accepted state.
For asynchronous options, interruption and resumption must follow the current load-generation and capture pause owner; do not resume a newer graph from an older request.

Use local aggregate timing/count signals where they answer a decision: full-snapshot reads, position-record allocations, controller publications, SVG mutations, pending frames, force duration, snapshot/capture latency and retained owners.
Optional browser performance observations may be feature-detected, but no new telemetry library or production monitoring API is selected.
Do not retain or upload ontology labels, IRIs, raw files, query text or browser profiles as telemetry.
Before creating future evidence or scratch artifacts, rediscover the current HISEW external storage and an owned task directory; historical `.sdlc/runtime`, `.sdlc/tmp` and earlier execution paths are not defaults.

Initial local optimizations add no external trust boundary.
Validate untrusted coordinates, snapshots and stale references using current public validators and safe text/DOM behavior.
Worker/backend escalation has separate message, memory, asset and accessibility obligations; the implementing owner must route and assess those native boundaries before acceptance.
No new dependency/version/rights claim is inferred from an old research record.

After focused proofs, consolidate the selected candidate and run broad checks once, repeating only for changed inputs, failures or a concrete unresolved concern.
No independent or external review is required unless the owner asks.
Prepare a dedicated ordinary-build preview when browser proof is needed; preserve the owner's existing tabs and loaded state.
If later publication/deployment is authorized, record each outcome separately and verify actual hosted asset hashes before a live acceptance claim.

Maksy owns release decisions; the assigned implementer observes the first authorized rollout.
Before release, identify an actually available compatible predecessor or a credible containment/forward-repair path.
The earlier owner preference did not require making another artifact backup; this plan does not create a new backup exercise by default.
Do not promise restoration merely because an old commit exists: dependency/build inputs and artifact compatibility must be available.
Preserve user edits and exportable scene state before any action that could replace them.
Local recovery reverses only this task's edits; never use Git restoration to discard existing user changes.
Retain raw/invalid evidence, remove temporary variants/instrumentation after recording their results, and stop only task-owned previews, simulations, frames and workers.

Abort or contain a candidate for changed topology/semantics, failed legacy-motion acceptance, lost pins or inverse placements, camera drift, invalid geometry, stale capture/resume, orphan work, unbounded retention, a corroborated regression or missing artifact identity.
A reversible partial improvement may remain deliverable while a later conditional option is rejected; report the residual requirement honestly.

## 9. Principal unknowns and replanning conditions

| Unknown                                                                   | Cheapest discriminating work                                                                                                               | Decision and owner                                                                                                               |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| Which force differences explain the owner's visible mismatch?             | Identical small force fixtures; isolate center, axis attraction, order and reheat, then compare full legacy equations and ordinary motion. | Implementer attributes causes; Maksy resolves a material residual visual compromise. Legacy matching itself is already required. |
| Is exact legacy motion attainable with a bounded modern-force correction? | Compare deterministic trajectory/shape/reheat results against the retained reference before choosing a replacement algorithm.              | Select the smallest faithful design; if a deeper solver is necessary, record its reuse/rights/contract implications.             |
| How much per-tick overhead survives SLICE-001/002?                        | Operation counts and one focused force/geometry/event trace on the corrected candidate.                                                    | Select remaining work from measured cost, not the old hotspot ranking.                                                           |
| Does setup dominate current load/revision latency?                        | Time canonical preparation, renderer grouping/incidence/flattening and first paint separately.                                             | Select SLICE-004 without mislabeling it a steady-state fix.                                                                      |
| Does old-label fallback run for canonical drawings?                       | Count finite fast exits and fallback candidates on actual revision scenarios.                                                              | Defer its index if the path is immaterial.                                                                                       |
| Can geometry facts/writes be reused safely and profitably?                | Count repeated inputs/attributes and enumerate invalidators on loop, pin, edit and style cases.                                            | Select narrow SLICE-006/007 changes only when cache cost and lifetime are justified.                                             |
| Does paint coalescing save a frame's work?                                | Observe actual positioning calls per useful browser frame with instrumentation outside acceptance runs.                                    | Reject SLICE-008 if the existing timer already produces one useful update.                                                       |
| Are plain records better after complete synchronization?                  | A bounded real-runtime prototype using the selected force law, complete fields and interactions.                                           | Select SLICE-009 only on whole-operation benefit and a single coherent state owner.                                              |
| Is worker/backend work necessary?                                         | Attribute residual main-thread force versus SVG/paint cost and prototype only the limiting boundary.                                       | Separate selected architecture and exact configuration approval if needed; do not begin both escalations together.               |
| Is a claimed improvement larger than measurement noise?                   | A/A calibration and independent run-level paired repeats with the existing guard.                                                          | State inconclusive results; accept or revise the practical margin before claiming a performance pass.                            |

Rebaseline when source, dirty inputs, dependency installation, canonical fixture/topology, selected force law, browser or meaningful settings change.
Replan when current ownership changes, an oracle cannot discriminate candidate behavior, legacy fidelity needs a larger algorithm change, a cache cannot be invalidated correctly, native end/cancellation semantics cannot be preserved, or a stored/public/configuration boundary must change.
Do not change the correctness oracle to obtain an optimization pass.
Do not broaden work because another option appears in this catalogue: each conditional slice can close with an evidenced rejection or deferral.

The immediate handoff is to implement the two proven per-tick removals when authorized and establish the controlled legacy-motion correction, then use the resulting evidence to select further work.
