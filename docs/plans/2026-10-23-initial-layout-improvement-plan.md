# Bounded initial-layout improvement plan

> **Status:** Approved revision 6, 24 October 2026; PERF-DEC-013 option A remains selected, with the real extended universal ontology as the primary experiment fixture.
> The owner accepts the documented AC-104 cadence limitation below.
> Manifest 56 verifies first-paint admission and actual-glyph spacing, including foreground W6 imagery; manual platform acceptance remains pending.
> **Baseline:** signed closeout `302fb27516ae60553bc8b4bd4cde1c34b2cf9c3b`, tree `67e137c8fbd3951e50da3334ca96607fa89f3db8`.
> **Delivery:** continue on `feat/architecture-performance-ui` in [draft PR #85](https://github.com/Hadden-Industries/webvowl/pull/85).
> **Route:** bounded R2 follow-up to the accepted architecture/performance/UI programme; reuse its invariants and verification route.
> **Owner:** Maksym Shostak; the implementing coordinator owns integration, evidence and resource handoff.
> **Purpose:** make a newly loaded large graph usable while it relaxes, including count adjustment before settlement, without changing its semantic meaning or silently weakening acceptance.

## 1. Accepted direction and decision record

The owner selected “Keep PR draft; plan a bounded initial-layout improvement” after reviewing the [closeout](2026-10-23-programme-closeout.md).
The owner also selected “Keep manual acceptance pending until the batch is validated.”
Those closeout decisions authorized planning and preserved both acceptance holds.
The owner subsequently approved option A and the numerical targets after reviewing revision 2, authorizing its bounded implementation.
No new force algorithm, configuration change, merge or deployment is approved.
The [manual packet](2026-10-23-ui-manual-validation.md) remains the single actual-platform batch.

PERF-DEC-012 reserves broader renderer/physics work for a concrete decision.
This record supplies that decision for a narrow follow-up; it does not reopen completed architecture, SF, S7, count batching or bounded renderer reuse.
The owner's subsequent proposal is to compute inexpensive approximate positions from the loaded graph before first render, prioritizing ontology source-file loading.
This revision makes that the first bounded experiment, keeping force equations and scheduling unchanged.
The relative frequency of source and saved-layout loading is a product assumption supplied by the owner, not measured telemetry.

### PERF-DEC-013 — Approved implementation envelope

| Option                                                                        | Result and trade-off                                                                                                                                                                                                                                                                                      | Disposition                   |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| **A. Better initial placement before changing the force loop**                | Compare a cheap topology-aware seed with the existing spiral and a spacing-only control. Integrate the simplest successful seed for fresh unsaved loads, with bounded initial framing. Preserve the existing solver, scheduling and later interactions. Initial and final unsaved coordinates may change. | **Approved 23 October 2026**  |
| B. Diagnostics only, then another implementation decision                     | Establish attribution and geometry costs without implementing a replacement seed. Requires another decision before integrating an improvement.                                                                                                                                                            | Available alternative         |
| C. Change force scheduling, use a multilevel solver/worker or replace SVG now | These may address a residual bottleneck, but would mix mechanisms before the cheaper placement hypothesis is tested. Each requires its own evidence and bounded design.                                                                                                                                   | Deferred, not authorized by A |

Option A permits one production initialization strategy plus its required framing, correctness and lifetime integration.
The three seed strategies are diagnostic alternatives, not permanent user settings or runtime experiment infrastructure.
If spacing alone gives the same benefit, prefer it over topology preprocessing.
If neither improves the real initial-load/count experience, retain the evidence and return with the next causal proposal; do not quietly expand A to force scheduling or cosmetic changes.

Approval of A also selects the acceptance targets in section 6.
If attribution requires a mechanism outside this envelope, or those targets cannot be met without a different contract, return with the measured result and a narrower decision.
Do not silently lower a target or substitute a different workload.

## 2. What the existing evidence establishes

| Evidence                             | Established observation                                                                                                                                                                                    | Limit on its use                                                                                                                                                                     |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Completed W4 and W5 closeout cohorts | Batched count application on an established drawing preserves count, document identity and layout intent; controller application ranges were 164.8–236.7 ms for W4 and 64.4–84.0 ms for W5.                | Four samples per operation/state combination; descriptive contended-host observations, not a complete A/A or before/after comparison.                                                |
| Fresh-paused W4 diagnostic           | The first warmup took 14.20 seconds from initial input through the observed frame boundary, including 5.14 seconds in controller application. Repeated expensive observations justified stopping that run. | A retained warmup/stress observation, not a p95 or an ordinary automatic-load baseline. Controller duration includes a paint await.                                                  |
| W4 active-layout observation         | Four changed-geometry frames over 6.68 seconds; three frame intervals. A subsequent settling phase lasted 127.17 seconds.                                                                                  | The collector loads paused and deliberately pauses/resumes; Resume reheats the force. The settling phase is a separate post-reheat observation, not 127 seconds of normal load time. |
| Headless fresh-paused W4 trace       | Approximately 4.51 seconds of GPU task durations and 0.60 seconds of renderer-main task durations in the retained window.                                                                                  | Nested/nonexclusive thread durations are not additive CPU attribution or proof of a driver defect. Headless trace timing is not foreground acceptance.                               |
| Backdrop control                     | Removing only the four-pixel `.modern-popover::backdrop` blur did not materially improve that diagnostic.                                                                                                  | It did not remove the popover panel's separate 20-pixel blur, and cannot rule out every paint/compositing cause.                                                                     |
| Final source verification            | All 15 hosted checks passed at the closeout head; the preceding full UI check and narrow closeout checks/review are retained.                                                                              | Verification of existing source is not evidence that this proposed improvement works.                                                                                                |

Retain the raw records under `C:/Users/maksy/.hi/w/e/operator/16557566c924469fb5e117f2cfbe6e03`, particularly the closeout's named foreground/trace groups, production manifest, review records and hosted-check readback.
Do not rewrite those records or rename them as new baseline cohorts.

### Source facts that constrain the design

- [Measurement load](../../util/measure-production-performance.mjs) explicitly requests `layout: "pause"`; [the count collector](../../util/productionCountAdjustment.mjs) resumes for observation and again for settlement.
  Add a distinct ordinary automatic-load scenario; retain this controlled paused/resume scenario under its existing meaning.
- [Legacy force](../../src/webvowl/js/runtime/legacyForceSimulation.js) resets alpha to 0.1 on Resume, multiplies it by 0.99 per tick and ends below 0.005.
  Arithmetic gives 299 clock advances to the ending check, approximately five seconds at 60 callbacks per second before considering actual work.
  The current timer advances one step per callback; neither arithmetic nor callback rate proves real settling latency.
- [Renderer position recalculation](../../src/webvowl/js/runtime/renderedGraphInternals.js) both writes SVG geometry and recenters solitary labels by changing `label.x/y`.
  Those labels participate in force state.
  Skipping the callback without preserving its model effects can change subsequent trajectories.
- [Scene initialization](../../src/app/js/controller/canonicalVowlScene.js) already distributes fresh nodes with deterministic phyllotaxis and respects supplied/retained positions.
  The seed radius is `10 * sqrt(0.5 + index)`; the first two centers are approximately 18.1 world units apart, and the 2,000th center is approximately 447 units from the center.
  [Canonical element construction](../../src/webvowl/js/parsing/canonicalRenderElements.js) uses `50 * radiusFactor` for circular class radii, so an ordinary factor-one class is 100 units across.
  These facts establish initial crowding, not its share of the measured delay.
  PERF-DEC-013 explicitly proposes changing fresh initialization; it does not assume all nodes start at zero.
- [The runtime adapter](../../src/webvowl/js/runtime/d3RenderedGraphAdapter.js) owns drawing admission, currentness, observed-paint completion and recovery.
  [The layout settler](../../src/app/js/controller/graphLayoutSettler.js) has an existing 12-second default and bounded failure/best-effort semantics.
  Neither timeout inflation nor early “settled” reporting is an optimization.

### Primary workflow: ontology source to a new drawing

[OWL loading](../../src/app/js/controller/canonicalVowlWorkerOperations.js) returns `visualization: null`.
[The document session](../../src/app/js/controller/canonicalVowlDocumentSession.js) consequently generates placements, selects automatic node count and defaults to running layout.
That is the primary optimization and acceptance path, including local ontology files and acquired ontology sources.
Canonical or migrated VOWL without a visualization also needs initialization; a VOWL filename alone does not mean positions have already been saved.

An explicitly saved visualization instead restores its placements/camera and defaults to paused layout unless the caller requests otherwise.
Preserving that existing branch is a regression constraint, not a second optimization programme.
There is no new cache, saved-layout migration, file format or persistent layout service in this proposal.

Better seeding aims to reduce initial overlap, long links, node travel and expensive moving geometry.
It does not guarantee a unique final arrangement or fewer iterations: the present force still performs its fixed cooling sequence.
The expected gain is a better first drawing and cheaper/more useful visible relaxation; wall-clock settlement must be measured.

## 3. Reuse assessment and research

Research checked on 23 October 2026; no package or configuration change is proposed.

| Capability                                              | Current fit and selection                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Existing legacy force and renderer                      | Reuse their actual position-Verlet state, force parameters, event ports, drawing admission and recovery. The initial-layout bottleneck is not yet causally attributed. The retained D3 v3.5.17 BSD-3-Clause notice and immutable reference fixture remain required.                                                                                                                                                                                                                                                                                                                         |
| Existing spiral and incidence placement                 | Reuse complete scene ownership, supplied/retained-position precedence and operator/label placement. The cheapest control changes only spacing, using the existing force-distance policy rather than copying renderer dimensions into the scene.                                                                                                                                                                                                                                                                                                                                             |
| D3 hierarchy/tree, installed d3-hierarchy 3.1.2         | Current npm stable metadata matches the installed ISC package, already exported by the declared D3 dependency. [D3 tree](https://d3js.org/d3-hierarchy/tree) supplies linear-time tree layout and radial coordinates. A deterministic spanning forest can provide its input without changing the ontology graph. This is a candidate seed, not proof that a tree approximates every graph well. Audit preprocessing too: the installed hierarchy constructor propagates heights through ancestors, so the tree-layout complexity claim alone does not bound end-to-end work on deep chains. |
| Graphviz sfdp / multilevel layout                       | [Graphviz's multilevel force layout](https://graphviz.org/docs/layouts/sfdp/) establishes a mature coarse-to-fine alternative for large graphs. Adopting it here would require a browser delivery/integration choice and another solver, rather than reuse of the existing loop. Deferred unless the bounded seed fails; no version, browser package or licence selection is claimed.                                                                                                                                                                                                       |
| D3 7.9.0 / d3-timer 3.0.1                               | Installed identities match current npm stable metadata; ISC. Reuse the supported timer/stop interface already imported by production. [D3 timer documentation](https://d3js.org/d3-timer) describes its animation-frame scheduling; a second independent timer would add ownership and synchronization risk.                                                                                                                                                                                                                                                                                |
| Modern d3-force 3.0.0                                   | Installed and current npm stable metadata; ISC. It uses velocity state and different integration/event semantics. Its manual ticks do not dispatch tick events, unlike this repository's legacy wrapper. It is not a drop-in optimization. [Force simulation documentation](https://d3js.org/d3-force/simulation)                                                                                                                                                                                                                                                                           |
| Browser task scheduling                                 | Native animation scheduling is available through the existing integration. [Scheduler.yield](https://developer.mozilla.org/en-US/docs/Web/API/Scheduler/yield) can divide long tasks, but is not universally available and does not make GPU paint cheaper. Do not add it or a compatibility layer without an actual need and explicit browser behavior.                                                                                                                                                                                                                                    |
| Browser diagnosis                                       | Reuse existing CDP traces, CPU profiles, work counters and manifests. [Chrome rendering tools](https://developer.chrome.com/docs/devtools/rendering/performance) distinguish paint, layers and frame presentation; [Performance reference](https://developer.chrome.com/docs/devtools/performance/reference) separates input, processing and presentation delay.                                                                                                                                                                                                                            |
| New workers, Canvas/WebGL or additional layout packages | No adoption is selected or approved. A need for these ends this bounded plan and triggers dedicated alternatives, current versions, rights, migration and accessibility research. Existing D3 exports may be reused without adding a dependency.                                                                                                                                                                                                                                                                                                                                            |

The retrieved Modern Web Guidance `performance` guide supports separating computation from UI work and avoiding repeated layout reads/writes.
Its warning, “DON'T overuse `will-change` globally,” argues against adding compositor layers to thousands of primitives speculatively.
No blanket containment, hidden-graph prewarming or animation-layer promotion is selected.

## 4. Scope, invariants and ownership

### Included

Fresh ontology source loads, using ordinary automatic node count first and explicit all-node stress cases separately; direct count changes while the drawing is still relaxing; established running, settled and manually paused controls.
The production change is an inexpensive initial-position policy before the first complete usable frame.

The owner's 23 October fixture amendment makes **W6-extended**, the real universal extended ontology `dist/universal/extended/20260912-full`, the primary case for selecting an initializer.
Its source is 3,023,054 bytes with SHA-256 `d7eb7980436600ab50c8a5df35401a4a345fe4362d111f2d8e6f90217505b077`.
Actual source admission produces 953 node occurrences (807 class nodes and 146 datatype nodes), 1,204 edge occurrences and 1,174 labels; these counts include occurrences subsequently hidden by default filters or node selection.
The existing real **W5-core** ontology remains an independent comparison.
**W4-connected/disconnected** remain synthetic worst-case guards, not representative product workloads or the sole basis for choosing the initializer.
In particular, W4-connected is a 2,000-node chain: a tree-shaped seed that succeeds only on that chain is insufficient evidence for the ontology use case.
Run the three-way diagnostic on W6 first, then corroborate on W5 and check W4 and the small shape guards.
Keep fixture identities, automatic/all-node modes and source admission timings separate; do not pool them or relabel earlier W4/W5 results.
Apply the approved 50 ms preparation, one-second usable-frame/count, active-frame and settlement targets to W6 as well; the original W4/W5 obligations remain unwaived.
Retain only fixture hashes, aggregate structure and measurement results in public evidence; read the owner's local source files without copying their contents into the repository or external review inputs.

### Bounded seed experiment

1. Measure the existing seed's overlap, link lengths, bounds and fixed-step travel on the actual occurrence graph, including labels and operators.
   Compare three candidates: unchanged spiral; spacing-only spiral; topology-aware placement.
   Run pure/headless controls first, with identical visible content and matched camera as well as each candidate's proposed first view.
2. For the topology candidate, build undirected adjacency from admitted occurrence incidence, identify components and choose a deterministic breadth-first spanning forest.
   Use stable inventory order to break ties; start each component from a highest-degree node.
   Ignore direction only for this seed calculation, and never merge equal-IRI occurrences.
   Keep every original edge, direction and label in the actual drawing and force model.
3. Reuse D3's tidy-tree/radial layout for that temporary forest where suitable.
   Component placement, hierarchy construction and coordinate conversion must remain bounded on chains, stars, cycles, dense graphs and many isolated nodes.
   Do not add all-pairs distances, spectral decomposition, community detection or a second full force solve.
   Reject a poor shape or excessive preprocessing cost instead of silently adding another algorithm.
4. Derive world-unit spacing from the existing shared class/datatype force-distance policy and any explicit initial distance request.
   Measure real rendered footprints to judge overlap; do not copy `50`, `120` or `200` into a second geometry-policy table.
   Retain existing incidence-based operator and label placement after positioning their endpoints.
   Do not promise zero overlap for every label or n-ary construct.
5. Generate complete scene positions once per fresh load, including initially hidden occurrences.
   Later count/filter changes reveal their retained positions; they must not rerun a whole-graph seed or move surviving nodes.
   Semantic edits, supplied positions, pins and saved visualization restoration retain their current precedence and behavior.
   Partial explicitly supplied placement uses the existing path in this bounded change; it does not trigger a new constraint solver.
6. Permit one initial fit of the actually visible drawing when there is no saved layout, supplied placement or explicit initial camera request.
   Reuse existing renderer bounds, viewport occlusion and zoom limits, applying the camera before declaring the first usable frame.
   Never refit during relaxation, count changes, pan, zoom or dragging.
   Keep the operation inside existing admission/currentness/recovery ownership; no new public viewport command or persisted field.
   If the existing path cannot provide that safely, return with the concrete seam change before integration.
7. Select one strategy only if it improves the failing experience without unacceptable preprocessing or visual regression.
   Compare the topology candidate with spacing alone, not just with the crowded baseline.
   Keep the simpler strategy if topology adds no corroborated benefit.
   Remove diagnostic alternatives from production; retain their evidence.

The forest is an implementation aid, not a claim that an ontology is a tree or an added visual grouping.
All semantic relationships remain visible according to the existing filters, and the unchanged force then relaxes the seed.
Initial framing is a disclosed user-visible change: a large graph may start as an overview rather than at zoom 1.
Compare matched cameras to distinguish cheaper geometry from reduced on-screen detail; a benchmark that wins only by putting content offscreen is rejected.
No drawing waits for full force settlement, and no hidden prewarming phase precedes the first frame.

### Excluded and requiring another decision

Force equations/parameters/cooling thresholds, changes to tick scheduling or per-step projection, placement beyond the fresh-load envelope above, reduced semantic content, graph culling, hidden labels/edges, worker ownership, new renderer/dependencies, persistent view/schema changes, new feature flags and configuration changes.
Also excluded: reducing benchmark sizes to pass, weakening focus/visibility checks, increasing timeout thresholds, disabling GPU acceleration, changing drivers or modifying global browser settings.

| Rule / current authority                                     | Consumers and implementation boundary                                       | DRY and failure decision                                                                                                                                                                                                                |
| ------------------------------------------------------------ | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Numerical step and cooling: legacy force                     | Timer, manual reference tests, renderer, layout observations                | Unchanged numerical implementation and scheduler. Keep the independent immutable reference as an oracle, not a second production implementation.                                                                                        |
| Geometry projection and SVG drawing: renderer                | Ordinary/editor draw, selection, drag, bounds and export                    | Reuse model projection and existing bounds/framing authority. Read/write counters must not become a parallel renderer.                                                                                                                  |
| Desired Pause/Resume and temporary holds: controller/runtime | Count batching, export/capture, load/reset, direct calls and WebMCP         | Preserve latest explicit intent, generation ownership and exactly-once hold release. No local saved boolean that resumes a newer operation.                                                                                             |
| Drawing admission/publication: adapter and session           | First load, revisions, recovery, capture and public state                   | One synchronous installation transaction. Do not yield inside partial live installation or admit geometry from a retired mount.                                                                                                         |
| Placement/identity: scene                                    | Fresh load, semantic edit, visible/hidden occurrences, pins and saved files | One scene-owned initializer. An ephemeral adjacency/forest may use admitted occurrences; it must not duplicate the semantic read model or persist another topology cache. Preserve supplied/retained positions and occurrence identity. |
| Initial spacing: shared force-distance policy                | Scene seed and renderer link settings                                       | Reuse the existing value source and explicit request; no parallel default table or configuration change.                                                                                                                                |
| Proof and reporting: production collector                    | Counter, trace and untraced runs                                            | Derive scenario metadata from the actual selected mode; retain different preconditions as distinct evidence. Historical reports stay immutable.                                                                                         |

No wire-format migration, backfill, data reconciliation or compatibility shim is needed.
A changed public meaning/name or new persistent field requires replanning; no alias is authorized.
Private fixture contents remain local and are never included in external reviews or public issues.

## 5. Ranked hypotheses and cheapest discriminating work

These are hypotheses, not established causes.
SLICE-010 tests placement first; a worker is not the default response to a slow animation.

| Rank | Hypothesis and prediction                                                                        | Discriminating diagnostic                                                                                                                                                                                                            |
| ---- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| H1   | Crowded, connectivity-blind initial positions make early movement and overlapping SVG expensive. | Compare seed overhead, initial overlap, edge lengths, fixed-step travel and main/GPU/presentation work for the three seed strategies. Include matched-camera controls so merely zooming out cannot masquerade as a faster algorithm. |
| H2   | Dense SVG paint or compositing remains expensive even with a better seed.                        | Reuse traces; correlate frames, paint/layers, bounds and updates. Compare Filters closed/open. Any isolated effect control is diagnostic only; the separate 20-pixel panel blur was not ruled out by the earlier backdrop test.      |
| H3   | Numerical/projection work or frame coupling remains dominant.                                    | Count actual steps and alpha changes; separate pure force, per-step model projection and SVG writes. If this defeats the seed approach, propose a later scheduling/physics decision with that evidence; do not alter it under A.     |
| H4   | Harness preconditions or host/browser state amplify a narrower problem.                          | Compare ordinary running load, fresh-paused/resume and established controls explicitly. Retain viewport, pixel ratio, browser/GPU identity and CPU exception; investigate a Chromium-specific result on another installed engine.    |

Reuse existing failed/successful runs first.
Do not repeat a broad unoptimized foreground census.
A negative control must be reversible, isolated to diagnostic execution and clearly marked as altered production presentation.
Never count its timing as production acceptance.
Freeze a minimal reproduction with a clear failing signal before making the selected product change.

## 6. Requirements, proposed acceptance and quality scenarios

REQ-101: separate ordinary initial-load behavior from paused/resume diagnostics.
REQ-102: make fresh-layout count changes and visible drawing progress usable.
REQ-103: preserve numerical, semantic and ownership contracts, allowing changed fresh unsaved coordinates only within PERF-DEC-013.
REQ-104: remain responsive to Pause/Resume, load, reset, capture and disposal.
REQ-105: retain small-input behavior, browser compatibility and bounded resource use.
REQ-106: deliver attributable evidence with truthful acceptance and release status.
REQ-107: prioritize source-file loading with bounded, deterministic initialization; preserve explicit layouts as a compatibility branch.

The owner approved the following numerical targets; they are acceptance requirements, not existing measurements or standards, subject to the explicit AC-104 owner disposition below.
Apply them to the documented qualified Windows/browser/viewport cohort, retaining the owner's CPU exception; they are not guarantees for every device.

| Acceptance ID | Falsifiable criterion                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| AC-101        | Results identify automatic running load, fresh-paused/resume and established layout separately. Actual accepted placements, counts, document identity and visible moving geometry are observed; a timer heartbeat alone cannot pass active-layout proof.                                                                                                                                                                                                                                               |
| AC-102        | From admitted occurrence data being available for initial positioning to the first complete usable observed frame: p95 at most one second for W4/W5. This includes seed construction, projection, installation and initial framing. Report parsing/ranking and total user load separately; no hidden preprocessing or full-settlement phase outside the boundary.                                                                                                                                      |
| AC-103        | During fresh active layout, flush/dismissal to accepted final count plus observed frame: p95 at most one second for W4/W5. Report the intentional quiet second and immediate control feedback separately. The original B3 W4 no-LoAF-over-200-ms and W5 half-baseline gates remain additional requirements, unchanged.                                                                                                                                                                                 |
| AC-104        | Initial active-layout observation: p95 frame interval at most 50 ms, no observed frame interval above 200 ms, and actual geometry movement until natural completion. Natural completion before five seconds is reported separately and must not be rejected as “no movement.” Across repeated automatic-load/resume runs, p95 settlement is at most the existing 12-second default without changing its semantics or timeout.                                                                          |
| AC-105        | Given the same explicit starting positions, random stream and interaction script, per-step alpha, numerical state and projection match the frozen reference. New unsaved seeds intentionally have different trajectories and need not match old final coordinates. Semantics, occurrence identity, completeness, deterministic initialization and capture consistency remain exact. Saved/supplied/retained positions, pins, explicit camera and user layout intent pass existing independent oracles. |
| AC-106        | Pause/cancel/load/reset/dispose retire owned work; no stale paint/state publication or leaked callback/owner survives. Capture sees a coherent accepted drawing and final required geometry; recovery/failure behavior remains explicit.                                                                                                                                                                                                                                                               |
| AC-107        | W1–W3 retain the existing max(10%, 25 ms) corroborated regression guard; established W4/W5 controls do not regress beyond it. Ten equal-live-size lifecycle cycles and a deliberately retained-owner positive control demonstrate bounded ownership.                                                                                                                                                                                                                                                   |
| AC-108        | Production manifests, fixture identity, scenario preconditions, raw samples, rejected runs, scoped reviews and hosted checks are retained. Manual acceptance remains pending; PR stays draft until all required owner dispositions.                                                                                                                                                                                                                                                                    |
| AC-109        | Initial seed preparation has a proposed p95 budget of 50 ms on W4/W5 and remains included in AC-102. Report allocated/retained state, actual footprint overlap, link lengths, travel, initial bounds and camera. The selected seed must improve the failing experience; topology must show a corroborated benefit over spacing alone to justify its extra code. No offscreen-content shortcut, hidden edge, full pre-solve or relaxed count/settlement gate is accepted.                               |

Sampling follows the original plan's A/A calibration, ABBA ordering and at least 20 accepted samples per version/fixture for a numerical comparison.
Separate running/paused and quiet/dismissal cases; never pool them to reach the sample requirement.
For active layout use independent runs as the statistical unit, report per-run frame distributions, and do not pool a few intervals into a stable percentile.
Existing short observations locate the problem; the selected optimized candidate receives the focused qualification.
The three-way seed comparison is initially pure/headless; only the selected candidate and necessary matched baseline proceed to foreground acceptance.
Only matched baseline data needed for that comparison are collected, after headless/static avenues and the candidate repair.
If noise prevents a conclusion, report an unqualified result; the CPU exception does not excuse hidden-window timing.

| QA ID  | Stimulus and required response                                                                                                                                                                              |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| QA-101 | Load W4/W5 through ordinary defaults; a complete drawing appears, moves and settles within the proposed qualified-host targets.                                                                             |
| QA-102 | Change count repeatedly before settlement, then dismiss Filters or wait; only the last requested count installs and current user layout intent survives.                                                    |
| QA-103 | Pause, drag/pin, resume and enter/leave editor mode during activity; numerical intent and coherent geometry remain correct.                                                                                 |
| QA-104 | Start another load/edit/reset or dispose between callbacks; old work cannot touch the accepted owner.                                                                                                       |
| QA-105 | Export/share/capture during adjustment or relaxation; existing flush, settle, timeout and recovery rules remain authoritative.                                                                              |
| QA-106 | Hide/restore the page and test reduced motion on supported engines; no runaway queue, elapsed-time catch-up burst or misleading completion is allowed.                                                      |
| QA-107 | Inject renderer failure and a stale scheduled completion; retain the existing full-rebuild recovery and recovery-failure signal.                                                                            |
| QA-108 | Repeat equal-live-size load/update/capture/dispose cycles; retained old-owner positive control is detectable and the real candidate retires its resources.                                                  |
| QA-109 | Load chains, stars, cycles, dense and disconnected graphs, self/parallel edges, repeated IRIs and operator/datatype cases; seeds are finite, deterministic and bounded, with all actual incidence retained. |
| QA-110 | Reload a saved layout, supply partial positions or an explicit camera, edit a graph and reveal hidden nodes; only eligible fresh loads use the new initializer and one-time framing.                        |

### AC-104 owner disposition — 24 October 2026

The owner selected **“Accept the documented cadence limitation”** after reviewing the [final foreground observations](2026-10-24-active-graph-performance-follow-up.md#foreground-cache-qualification-and-deep-path-placement--manifests-5051).
For this delivery, further work to reach the 50-ms active-frame target is no longer an acceptance blocker.
This is acceptance of a measured limitation, not a numerical pass or a replacement frame-time guarantee.

- W4, manifest 51: two foreground observations have per-load frame p95 of 62.5 and 70.8 ms.
  These bounded stress observations do not qualify a population percentile.
- W6, manifest 50: forty independent loads yield A/B distributions of per-load frame p95 of 50.1 and 49.9 ms; four individual loads exceed 50 ms, and the largest per-load p95 is 54.2 ms.
  Manifest 51 preserves W6's initial coordinates; the retained qualification is not relabeled as a fresh manifest-51 cohort.

The exception applies only to the documented cadence limitation of this candidate.
The original 50-ms target and all raw results remain visible for future assessment; this decision creates no universal 70.8-ms allowance.
AC-104's 200-ms maximum-interval, actual-movement and twelve-second settlement conditions remain unchanged, as do the other acceptance criteria.
The [subsequent first-paint repair](2026-10-24-active-graph-performance-follow-up.md#initial-paint-and-glyph-clearance--manifest-56) separately establishes initial node containment and clearance on W6-all, W6-auto and W4 through native headless geometry and screencast observations.
The subsequent foreground W6 observation also confirms the prepared image.
Changed initial positions are not covered by the earlier population timing cohorts.
The actual-device and assistive-technology [manual batch](2026-10-23-ui-manual-validation.md) remains pending, with no unrun combination waived.
This disposition does not authorize a commit, push, PR change, merge or deployment.
Retained failed checks and the earlier final-verification receipt remain unchanged.

### Initial spacing correction — 24 October 2026

The owner rejected the prepared image because class circles still touched despite the 200-unit Class distance.
The coarse seed had reserved only half the requested distance between centers, without accounting for actual glyph sizes.
The fresh-drawing boundary now adds the current Class/Datatype clear gap outside measured glyph footprints before fitting the viewport.
At the defaults, two ordinary 100-unit-diameter class circles therefore start at least 300 graph units apart center to center, leaving a 200-unit clear gap.
These are graph units; initial fit scales them on screen.
The native force retains its spring-distance semantics afterward, so this does not promise a permanent collision floor during relaxation.

The change applies only to eligible fresh loads, after native text sizing; saved/supplied views, ordinary revisions and explicit cameras retain their compatibility paths.
The existing first-paint boundary releases the initial force timer only while its drawing is still current and the user's running intent remains active.
Subsequent force steps, cooling, notation and interaction behavior remain unchanged.
Actual property-label readability, later moving-graph bounds and the outstanding platform packet are not waived by node-clearance evidence.

## 7. Ordered implementation slices

### SLICE-010 — Establish the actual load boundary and test the seed hypothesis

Extend the existing collector only where it cannot represent ordinary source loading, seed preparation and fixed-step attribution.
Retain the existing fresh-paused scenario, current production source/worker binding and cancellation safeguards.
Analyze retained traces first, then run the smallest necessary headless controls and work-count probes.
Use actual force/renderer/session inputs; mocks may control clocks and external transport, not fabricate expected layout behavior.
Freeze the crowded seed as the reproduction, then compare spacing-only and the bounded topology candidate without product flags or a permanent experiment subsystem.
Check graph shapes, preprocessing overhead and the first-view policy before choosing the production candidate.

**Exit:** a reproducible failing case, phase attribution, complete precondition record and one selected initializer within option A, or an explicit failed-experiment result.
Record why it wins over both the original and simpler control before production integration.
If only new physics, scheduling, another seed family, a worker or renderer can satisfy the evidence, return for a bounded owner decision.
Likely files: `util/measure-production-performance.mjs`, `util/productionCountAdjustment.mjs`, their meaningful tests, and a small private diagnostic helper only if warranted.
Reuse actual scene/runtime inputs without introducing another persistent graph representation.

### SLICE-011 — Repair one full initial-layout/count path

Implement the selected initializer across the scene/session boundary, with an independent regression oracle before the repair.
Keep all later placement/interaction paths authoritative and integrate one-time initial framing through the renderer's existing ownership.
Keep the existing force algorithm, scheduling, per-step projection, first drawing, labels, editor, capture and S8 recovery coherent.

**Exit:** the minimized failure improves for the predicted reason; AC-105/106/107/109 functional, preparation and lifecycle obligations pass; fresh and established count paths remain correct.
No GPU/presentation improvement is claimed solely from a faster JavaScript handler.
Likely files: `canonicalVowlScene.js`, a private seed helper if it provides a coherent seam, `canonicalVowlDocumentSession.js` and their tests; existing renderer bounds/initial admission and affected real-runtime tests only where first framing requires it.
No force, CSS paint-effect or scheduler change is bundled with this experiment.
Adapter/controller files change only for demonstrated contract integration, not a second layout authority.

### SLICE-012 — Qualify the optimized candidate and deliver

Run affected unit/runtime, corpus/export, lifecycle and browser checks, then the existing full `npm run check`.
Resolve all failures before external review.
Perform focused untraced foreground qualification only after diagnostic avenues are exhausted and optimized code is ready; keep trace/counter passes separate.
Do not repeat unrelated S0 operations or the entire earlier UI review.

Consolidate the final candidate, then obtain the authorized AGY Flash 3.8 High review with a 60-minute timeout and no other model limits.
Use narrowly scoped follow-up review for actual corrections; assess security/lifecycle implications on the changed scope through the existing route.
Reuse valid evidence for equal-content staging and documentation; do not rerun tests solely to satisfy native bookkeeping.

**Exit:** acceptance table resolved with actual evidence, signed source commit and authorized branch push, exact-head hosted checks, updated PR/handoff and reconciled resource disposition or a truthful retained blocker.
Keep the PR draft and manual packet pending.
Merge/release acceptance is a later owner action.

### Traceability

| Slice     | Requirements / acceptance / scenarios / decisions                                              | Proof                                                                                                  | Release and cleanup implication                                                                |
| --------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| SLICE-010 | REQ-101/106/107; AC-101/108/109; QA-101/109/110; PERF-DEC-013                                  | Retained traces, seed controls, actual preconditions, graph-shape and preparation-cost proof           | Diagnostic evidence only; isolate/reconcile resources; no production speed claim               |
| SLICE-011 | REQ-102–105/107; AC-105–107/109; QA-102–110; PERF-DEC-012 invariants and PERF-DEC-013 envelope | Independent scene/force oracles, saved/explicit layout regression, runtime/currentness and count tests | One fresh-load initializer; existing reconstruction and cancellation recover or report failure |
| SLICE-012 | REQ-106; AC-102–109; QA-101–110; original performance gates                                    | Full check, targeted browser proof, qualified comparison, final narrow reviews and hosted checks       | Source publication only; manual and release holds remain; preserve accepted/rejected evidence  |

The slices are sequential because attribution, initial placement and publication share mutable ownership.
No parallel source writers or new subagents are authorized by this plan.
Independent read-only research can be separated later only under the session's actual delegation authority.

## 8. Verification, interruption and release

Reuse [legacyForceSimulation.test.js](../../src/webvowl/js/runtime/legacyForceSimulation.test.js)'s checksum-bound official D3 v3.5.17 reference.
It already checks every numerical step, real labels, pins, reheating and representative size.
The modern-force label test alone is insufficient to prove the production legacy trajectory.
Add actual renderer projection/drawing comparisons because the force-only oracle does not contain the DOM callback's label recentering.
Use hand-checkable occurrence graphs to prove seed connectivity and preservation; do not generate expected answers by rerunning the new seed helper.
Exercise the existing no-saved-state OWL path as the primary integration case, with canonical documents lacking visualization as a compatibility case.
Update only tests whose old unsaved coordinates/bounds were intentionally superseded; keep restored-layout, exact numerical and ownership oracles intact.

Affected checks should include the changed helper tests, legacy-force and real renderer/adapter tests, controller count adjustment, layout settlement, capture/export and editing paths.
Run the repository's `npm test -- --runInBand <exact affected paths>` and existing lint/format consumers; final verification is `npm run check`.
No new verification profile, lint exception, package, lockfile, runtime declaration or CI setting is proposed.
If one becomes necessary, identify the exact file/setting and obtain the repository-required approval first.

On interruption, preserve the last accepted scene, cancel task-owned diagnostics and record the candidate, fixture and pending phase.
Resume from those records after verifying current source/manifest identity; never keep a stale browser timer alive as a continuation mechanism.
Use the existing count/revision full-rebuild recovery for runtime failures.
Before publication a rejected experiment is removed through targeted reversal of its own edits, not Git restoration of shared work.
After publication, rollback would be a separately authorized signed source reversal and requalification; no deployed rollback or automatic release is claimed.

The operator evidence root already exceeds its recorded allowance and native scratch disposal is blocked by [HISEW #197](https://github.com/Hadden-Industries/software-engineering-workflow/issues/197).
Reuse retained fixtures and valid evidence; reuse scratch only after proving it is eligible, isolated and does not contaminate the new measurement or alter a frozen review snapshot.
Any new profile/candidate must have a bounded lifecycle and explicit evidence need.
Do not copy the entire evidence root, silently increase its allowance, use ad-hoc deletion or claim native completion.
Reassess the existing retained-resource handoff before launching new expensive work.

The responsible observer is the implementing coordinator, reporting to the owner.
Publication requires a final evidence summary covering scope, fixed source, before/after preconditions, remaining performance limits, rejected hypotheses, affected browser checks and resource status.
Stop/replan on altered physics/scheduling, placement outside the fresh-load envelope, failure to preserve exact-step projection for identical inputs, excessive seed preparation, misleading initial framing, increased retained ownership, a new trust boundary, unsupported browser behavior or failure of the proposed budgets.
Manual actual-platform acceptance remains the owner's pending batch; no new benchmark result can waive it.

## 10. Implementation observations — in progress

The owner-selected W6 source is now admitted by the existing production harness as separately hashed automatic/all-node cases.
The first pure comparison used the actual admitted occurrence graph, native pre-draw glyph geometry, unchanged legacy force and derived-label recentering.
It did not measure browser paint, font layout or foreground latency.

| Fixture / full graph   | Existing spiral: overlap pairs / median travel | Spacing-only: overlap pairs / median travel | Radial forest: overlap pairs / median travel |
| ---------------------- | ---------------------------------------------- | ------------------------------------------- | -------------------------------------------- |
| W6 extended, 953 nodes | 37,143 / 6,455 world units                     | 6 / 5,095 world units                       | 4,565 / 3,978 world units                    |
| W5 core, 664 nodes     | 23,869 / 5,268 world units                     | 6 / 3,976 world units                       | 776 / 2,561 world units                      |

The radial forest's complete preparation p95 was 11.69 ms for W6 and 9.53 ms for W5 across 20 balanced preparations each.
Fixed-step travel is a deterministic model diagnostic, not a speedup percentage or a promise of a final arrangement.
The automatic 50-node case is separate: topology reduced W6 median travel, but increased W5 median travel slightly relative to the old seed.
The candidate must therefore still pass ordinary automatic loading and full-graph browser checks.
W4 exposed a poor deep-chain radial shape; the candidate uses the already-compared spacing-only seed for a component whose breadth-first depth exceeds the square root of its node count, before constructing a D3 hierarchy.
This retains a bounded extent and avoids deep-chain hierarchy preparation; it adds no solver or persistent graph owner.

The current uncommitted candidate applies the initializer only to fresh unsupplied scenes, retains the previous edit/partial-supplied path, and fits an eligible initial drawing once without a camera animation.
Saved visualizations, explicit initial camera requests and supplied positions suppress automatic framing.
The session records separate seed and admitted-data-to-usable-drawing durations; the latter includes defensive ownership, preparation, installation and observed paint.
Nine focused suites passed 252 tests, including the existing fixed-step force oracle; the first independent glyph-spacing regression failed against the old 18.10-unit separation before the repair.
The latest full product-candidate check passed all 10,050 JavaScript tests across 187 suites, Python and integration checks, lint, formatting, production build and generated JSON validation.
The first two full runs exposed an application-layer dependency violation, a fixture that read the session before load acceptance and an omitted runtime method declaration; all three were repaired without relaxing either architecture oracle.
The application owns the temporary spanning forest and final placements; the renderer interface supplies only the pure tree-coordinate calculation.
Rendererless scenes retain the spacing fallback.
The production build and changed source files at that checkpoint are bound by `initial-layout-production-manifest-4.json` and its source-input record.
The owner subsequently waived AGY review and additional HISEW bookkeeping runs; real checks for changed source remain required.

The initial instrumented W6 automatic-load run is incomplete: its first frame-interval calculation mixed callback-entry time with a frame timestamp.
The collector now establishes a frame-timestamp baseline, retains raw observations before summary validation, and counts only actual node-container glyphs rather than editor helper nodes.
Earlier receipts remain unchanged.
Clone-size estimation adds substantial overhead in counter mode; those durations are not clean latency evidence and are not subtracted to manufacture an accepted time.
An explicitly headless, uninstrumented initial-layout diagnostic mode is available for the next causal check; it remains ineligible for foreground acceptance.

Raw comparisons, frozen prototype `initial-layout-seed-prototype-v1.mjs`, source/build identities and browser records are retained in the existing operator evidence root.
Private fixture contents and private browser page text stay outside repository documents and external review inputs.
This progress record selects no new mechanism, waives no target and does not mark the follow-up complete.

The first uninstrumented headless W6 full-graph run observed all 953 actual node glyphs, 10.2 ms seed preparation, 789 ms admitted-data-to-usable drawing, 10.40 seconds to settlement and per-run frame intervals of 37.6 ms p95 / 54.4 ms maximum.
The ordinary automatic case observed 50 glyphs, 9.4 ms preparation, 318 ms admitted-data-to-usable drawing and natural early settlement at 1.57 seconds; its headless frame cadence was approximately 4.2 ms and must not be presented as an ordinary 60 Hz foreground result.
Complete source-to-frame time was 12.75 and 12.21 seconds respectively, including source admission and ranking outside the one-second rendering target.
The screenshot check confirms real graph geometry, including the source ontology's dense self-loops; a single initial fit does not continuously refit later force motion.
Raw early bounds also record 15 full-graph nodes and one automatic-case node outside the viewport after the observed load boundary; no nodes or links are culled to obtain the timing.

The W6 fresh-running count diagnostic now reloads before each operation and verifies that operation's load generation, rather than the earlier setup generation.
Its earlier generation-assertion failure remains retained as a collector defect.
After correction, quiet-period application-to-paint was 195.5 ms (the intentional wait was 1,009.6 ms); Filters dismissal application-to-paint was 159.3 ms.
Both used native inputs, applied only the final count and preserved running intent without an extra pre-measurement Resume/reheat.
These are individual headless observations, not accepted foreground percentiles or a before/after comparison.

A two-times spacing diagnostic reduced full-graph travel further but worsened the W6 automatic-case median travel from approximately 1,050 to 1,893 world units and made its initial extent much larger.
That alternative is not integrated; the current candidate keeps the first topology spacing and its bounded deep-chain fallback.

The subsequent W6 lifetime run passed two positive-control checks and ten equal-live-size load/edit/capture cycles, with zero retired owners and zero workers after each cycle and disposal.
An earlier run retained a one-worker observation after its third capture; the browser-target collector now records immediate and bounded teardown observations instead of one instantaneous inventory assertion.
The successful run observed zero workers on every first read, so it does not prove the earlier worker was merely delayed in disappearing from the browser inventory.
Those collector changes passed ten focused tests across three suites and remain subject to the final consolidated full check.

Four same-candidate W6 all-node foreground observations retained actual visibility/focus and all 953 glyphs.
Seed preparation was 5.8–6.8 ms, admitted-data-to-usable drawing 773–846 ms, natural settlement 10.97–11.26 seconds, and each run's frame-interval p95 37.6–41.7 ms.
Complete already-acquired-source-to-frame time remained 12.797–12.992 seconds.
Four loads are insufficient for the accepted twenty-sample p95 gate, and these are not before/after comparisons.

The owner rejected that whole-load delay as a satisfactory user experience and requested deep profiling before further qualification.
The [whole-load profile and optimization proposal](2026-10-23-whole-load-profile-and-optimization-proposal.md) identifies stable ranking, repeated preparation and RDF query materialization as the next concerns.
The owner approved PERF-DEC-014 Option A and subsequently PERF-DEC-015's bounded display-order experiment with conditional adoption.
The OWLAPI read improvements landed on remote `main` through PR #85 before WebVOWL adopted the exact tested source commit.
The next foreground cohorts use the consolidated optimized candidate after full checks; existing targets and manual acceptance remain unchanged.

The owner then authorized cheap initial selection and drawing before final count ordering, with count controls disabled during preparation.
The implemented [first-image extension](2026-10-23-display-ranking-identity-decision.md#approved-first-image-extension-and-implementation) preserves visible nodes when the final ordering completes.
Validation/path/snapshot and native text-shortening optimizations are consolidated with it; focused evidence is recorded in the whole-load proposal.
The owner subsequently waived AGY review and required full checks only at the final commit, superseding SLICE-012's external-review instruction for this follow-up.
Foreground qualification follows the optimized consolidated build; manual acceptance and the draft-PR disposition remain unchanged.

The consolidated full check passed 10,119 tests and the complete check pipeline; the later narrow allocation repair passed 98 affected tests and ten native lifetime cycles through disposal.
The foreground attempt failed Chrome admission before any accepted timing sample.
The [whole-load proposal](2026-10-23-whole-load-profile-and-optimization-proposal.md#final-verification-and-retained-limits) separates those results and the remaining acceptance requirements.
