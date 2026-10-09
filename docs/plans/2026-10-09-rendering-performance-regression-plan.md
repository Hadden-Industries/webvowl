# WebVOWL active-rendering performance implementation plan

Status: detailed draft for owner review, 9 October 2026.
This document plans a renderer optimization; no implementation or performance acceptance is recorded.

Start with shared getter and setter functions for the nine existing own-property descriptors in `Label.js`.
Qualify the complete label contract, then measure the actual production rendering path against the same source baseline.
Consider changes to SVG updates, separate numeric simulation state, or a worker only when the remaining measured cost justifies the corresponding scope.

The intended outcome is a more responsive large-ontology drawing during force animation, dragging and distance adjustments, with the same ontology, occurrences, labels, saved arrangement and interaction behavior.
A faster isolated force probe is evidence for an experiment; delivery requires a corroborated browser improvement.

## 1. Baseline, provenance and authority

### Source material and inspected revision

The primary input is `C:/Users/maksy/Downloads/webvowl-rendering-performance-diagnosis-20261009.md`, SHA-256 `202c8ab2a926a9f975eaad41b8c5f6873c628ff805779f759876431e7300ada1`.
Its external probe is `C:/Users/maksy/AppData/Local/Temp/webvowl-force-layout-probe-20261009.mjs`, SHA-256 `88221a34b7dcf855de82ef8a12cc4d54abbf964be76e7d30b37bfc35b94416ba`.
Sections 2 and 6 retain the useful evidence and reproduction design so this plan remains understandable if those personal files are later removed.

Current source was inspected at commit `3254c1e291ee0567d437d1f1afaf5896a382a765` in `C:/Users/maksy/GitHub/webvowl`, with a clean working tree before this document was created.
The root `package-lock.json` SHA-256 was `a7be3d8d3bb6ff52cad245276753efe4ebc1745b4cf2145d9ab39405c7abf8b8`.
Installed package inspection found D3 `7.9.0` and `d3-force` `3.0.0`; the document-authoring environment reported Node `24.21.0` and npm `12.2.0`.
These checks do not establish the exact browser version or environment of every earlier measurement.
The diagnosis matched deployed hot-function snippets to local source, but did not establish a complete deployed-bundle-to-commit hash match.

The existing [performance and search plan](../designs/Performance-and-Search/implementation-plan.md), its [dossier](../designs/Performance-and-Search/change-dossier.md), and the [performance catalogue](<../designs/WebVOWL Performance and Search Improvements_ Catalogue and Applicability to Hadden-Industries_webvowl.md>) remain adjacent proposals.
Their REQ-009/AC-009/DEC-007 and SLICE-008/009 cover measured method sharing and broader occurrence-family migration.
This plan takes the receiver/state inventory and measurement discipline from that work, but selects a smaller label-accessor experiment for the newly observed active-animation hotspot.
It does not adopt the broader constructor migration, search work, or historical degree-filter proposals.
The [exact node-count selector plan](exact-node-count-selector-implementation-plan.md) documents the separate selector work; its implementation is already in the inspected application.

### Authorization and outstanding planning gates

The current request authorizes this plan document only.
Application implementation, configuration edits, commits, publication and deployment require their applicable authority when requested later.
Follow [AGENTS.md](../../AGENTS.md): any configuration change needs approval for the exact file and setting, with the smallest proposed change and its behavioral/pipeline impact.
No configuration or dependency change is expected for the initial accessor experiment.

HISEW `inspect-project-applicability` returned `personal`, `active: true` for this checkout during planning.
The parent inspection reported a ready personal workflow, `focused`, `affected` and `full` verification profiles, and no active execution.
This document creates no execution, adopts no previous execution, and claims no verified profile ordering.
Formal accepted requirements, an accepted risk route, benchmark target approval and a current execution baseline remain outstanding before governed implementation.

The proposed implementation route is R2 because force coordinates are coupled to dragging, pins, canonical placement, drawing capture and export, despite the small first source patch.
Maksy owns acceptance of the exact scope, risk route and performance targets; the assigned implementer owns integration, oracle integrity, evidence collection and the first authorized rollout observation.
All REQ, AC, QA, DEC, GATE and SLICE identifiers below are **draft, local to this document**.
They do not assert acceptance of identically numbered records in other plans.
The owner's standing preference is fast iteration with no independent reviews unless explicitly requested, including during future implementation.
Do not import the adjacent programme's review sequence.
The gates below are evidence and scope milestones, not a requirement for repeated permission prompts.
Later authorization to implement the selected scope covers its routine edits and checks; ask only when a material unresolved choice or an explicit approval boundary requires it.

| Gate     | Decision and minimum evidence                                                                                                                                                                                                            | Effect                                                                                                        |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| GATE-001 | Maksy accepts the chosen implementation scope, requirements and risk route; the implementing session records its own baseline and ownership through the applicable workflow.                                                             | Before application implementation. The requested draft is deliverable without this acceptance.                |
| GATE-002 | Record a repeatable same-input baseline and A/A noise; accept or revise the proposed numerical targets with reasons before comparing candidate results.                                                                                  | Before treating timing results as pass/fail or claiming the regression repaired.                              |
| GATE-003 | Qualify the shared accessor receiver contract and all nine descriptors against current consumers. Resolve any supported behavior that depends on captured-property getters.                                                              | Before selecting the accessor candidate as equivalent.                                                        |
| GATE-004 | The initial candidate misses its accepted usefulness target, or a qualified candidate leaves an explicitly documented performance problem; fresh traces identify the remaining dominant cost. Maksy accepts one bounded follow-up scope. | Before conditional SLICE-003, SLICE-004 or SLICE-005. No automatic escalation.                                |
| GATE-005 | Freeze the candidate, collect applicable verification and browser evidence, identify a practical recovery or forward-fix approach, and obtain the authority needed for publication/deployment.                                           | Source delivery and hosted acceptance are separate outcomes. No new backup exercise is required by this plan. |

## 2. Diagnosis retained as evidence

### Observed browser comparison

The investigation used two already-loaded Chrome tabs: [the fork](https://haddenindustries.com/webvowl/#file=20260912-full), reporting WebVOWL 2.0.0, and [the legacy service](https://service.tib.eu/webvowl/#file=20260912-full), reporting 1.1.7.
The legacy URL has no trailing full stop.
Both views used the same ontology filename, but the input bytes were not independently compared and neither document was reloaded.

| Property                  |                  Fork |             Legacy |
| ------------------------- | --------------------: | -----------------: |
| Selection setting         |  Exact node count 664 | Degree threshold 0 |
| Class / datatype distance |             200 / 120 |          200 / 120 |
| Zoom                      | Approximately 0.18946 |            0.10975 |
| SVG descendants           |                11,457 |             11,397 |
| Node groups               |                   668 |                634 |
| Label groups              |                   750 |                740 |

DOM node-group counts are not the selector's counting contract.
Preserve the existing `nodesShown` definition; do not interpret the observed 664/668 difference as a selector defect.
The different topology and viewport mean the legacy comparison motivates the investigation but cannot be the acceptance oracle for a patch to the fork.

Originally the fork was active and legacy paused.
Each measured simulation ran with the other paused, after pause/resume or a temporary class-distance change from 200 to 210 and back.
The investigation restored those original pause states, class distance 200, fork selection 664 and the closed Options panel; coordinates naturally evolved while running.
This planning task does not reuse or disturb those tabs.

| Measurement                        |       Fork |     Legacy |
| ---------------------------------- | ---------: | ---------: |
| Final untraced sample elapsed time | 5,079.5 ms | 5,028.7 ms |
| Frame intervals observed           |         75 |         96 |
| Median frame interval              |    62.5 ms |    50.0 ms |
| p95 frame interval                 |    91.4 ms |    70.8 ms |
| Intervals over 50 ms               |         75 |         46 |
| Traced application callbacks       |         80 |         84 |
| Median application callback        |  34.156 ms |  23.460 ms |
| p95 application callback           |  57.329 ms |  41.140 ms |

Frame sampling and tracing were separate runs.
The traced median application callback was about 46% more expensive in the fork; these callback/frame observations are not a portable FPS guarantee.
The fork's active trace attributed about 844 ms of CPU-sample self time to D3 many-body application and 322 ms to quadtree traversal; position recalculation and SVG attribute writes also consumed significant time.
The recorded aggregate paint time was about 1,718 ms in the fork and 2,344 ms in legacy.
Paint matters in both, but this comparison does not establish extra fork painting as the principal regression.

Earlier buffered observations included forced layout in resize/visual-viewport callbacks.
The sustained active trace instead implicated force and position updates.
Browser-extension DOM inspection produced isolated stalls, including one over a second; exclude attributed inspection cost from application conclusions and keep snapshots outside measurement windows.
The profiling approach follows [Chrome's runtime-performance guidance](https://developer.chrome.com/docs/devtools/performance): retain separate untraced outcome samples and traces for attribution.

### Force-only probe

The probe constructs 1,418 particles: 668 ordinary points and 750 label-like objects.
All variants start from deterministic phyllotaxis coordinates, zero velocities and null fixed coordinates.
Many-body strengths are -500 for the first 668 particles and -400 for the rest.
It uses installed D3, stops its timer, warms with 30 manual ticks, then measures 120 ticks.
There are no links, DOM updates, ontology parsing or production interactions in this probe.

The diagnosis publishes round 1; the diagnostic handoff also retained rounds 0 and 2 from the same final four-case run:

| Round | Plain points, ms/tick | Current `Label`, ms/tick | Shared prototype, direct backing reference | Shared functions, own descriptors |
| ----- | --------------------: | -----------------------: | -----------------------------------------: | --------------------------------: |
| 0     |                 2.864 |                    9.731 |                                      6.087 |                             7.054 |
| 1     |                 5.448 |                    9.407 |                                      5.920 |                             6.738 |
| 2     |                 5.021 |                    9.407 |                                      5.816 |                             6.791 |

The own-descriptor surrogate was about 28% faster than current `Label` in round 1.
Absolute timings varied, and earlier two-case runs had different absolute costs.
The fixed case order also permits JIT/thermal/order effects.
These exploratory observations select a plausible mechanism; they are not release-quality performance evidence.

The surrogate defines only `x`, `y`, `vx`, `vy`, `fx` and `fy`.
Production `Label` also defines `px`, `py` and `fixed`, plus constructor callbacks and prototype behavior.
The shared-prototype variant also changes the backing-state representation.
Neither alternative establishes full production equivalence.
The first benchmarked production candidate must retain all nine descriptors and the complete constructor/prototype contract.

Live legacy D3 was 3.5.17; the fork uses 7.9.0.
History places the D3 upgrade at `89f3a1fd59cb9d029fd748a3bd059e330d2ae9ee`, dated 24 July 2026, and velocity forwarding at `7f4c0b41ec3e6ca3002de4a41fcfa4bee2ebf259`, dated 31 July 2026, with parallel history at `84cc4155`.
Both predate canonicalization.
No bisection established the first bad revision, and this plan does not assign that causal claim to either change.
Cold loading, OwlAPI parsing, canonicalization and materialization latency were not measured by this investigation.

## 3. Current ownership and proposed change boundary

The production application admits canonical documents and produces a drawing projection before the rendered runtime constructs occurrence objects.
Semantic records and source facts remain application/canonical concerns; simulation coordinates remain renderer concerns under [ADR 0010](../adr/0010-rendered-graph-is-a-projection-not-the-store.md).

| Current owner                                                                                                                                                                 | Relevant behavior                                                                                                                                              | Initial change implication                                                                      |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| [Label.js](../../src/webvowl/js/elements/links/Label.js)                                                                                                                      | Nine per-instance getter/setter pairs forward force state to the captured primary property. `fixed` also reads the current inverse.                            | Predicted sole production patch target: share functions through own descriptors.                |
| [forceLayoutNodeFunctions.js](../../src/webvowl/js/elements/forceLayoutNodeFunctions.js)                                                                                      | `locked`, `frozen` and `pinned` closures maintain `fixed`, `fx` and `fy`.                                                                                      | Compatibility oracle; leave state ownership and fluent returns intact.                          |
| [renderedGraphInternals.js](../../src/webvowl/js/runtime/renderedGraphInternals.js)                                                                                           | `setForceLayoutData` concatenates class and label objects, installs real link parts; `refreshGraphStyle` installs charge, center, x/y and link settings.       | Benchmark actual objects, links, force registration and settings. No new simulation parameters. |
| Same runtime: `recalculatePositions` and `svgRenderingGuard`                                                                                                                  | Updates node/label transforms, curves and cardinalities; solitary labels may write centered coordinates back to label state; finite guards preserve valid SVG. | Tick equivalence must include this feedback. Keep finite/curve guards.                          |
| Same runtime: drag handlers, `applyArrangement`, `drawCurrentGraphData`, `paused`, disposal                                                                                   | Coordinates, zero velocities, pins, reheating, immediate paused redraw and timer lifetime are coupled.                                                         | Exercise the complete interactions through existing runtime seams.                              |
| [canonicalRenderElements.js](../../src/webvowl/js/parsing/canonicalRenderElements.js) and [d3RenderedGraphAdapter.js](../../src/webvowl/js/runtime/d3RenderedGraphAdapter.js) | Occurrence bindings, positionability, arrangement snapshots and generation-bound drawing operations.                                                           | Reuse exact identities and existing boundaries; avoid a second semantic model.                  |
| [canonicalVowlDrawingExport.js](../../src/app/js/controller/canonicalVowlDrawingExport.js)                                                                                    | Temporarily pauses native capture and respects replacement/explicit pause ownership.                                                                           | Verify capture and resume ownership with candidate coordinates.                                 |

The initial patch introduces no schema, saved-document, public API or dependency change.
It retains `Label` construction, `instanceof`, method names, link/property callbacks and inherited behavior.
There is no class conversion, prototype-property migration, `.bind`-per-instance replacement or compatibility alias.
Shared descriptor objects/functions belong to the module; each label still owns its accessor properties.
Native `Object.defineProperties` supplies that mechanism without another package.

[D3's simulation contract](https://d3js.org/d3-force/simulation) mutates numeric position, velocity and index fields; fixed coordinates constrain positions and reset the corresponding velocities.
Manual `tick()` does not dispatch tick/end events.
Use the installed implementation and current contracts as the oracle; keep timers and renderer callbacks explicit in test harnesses.
The [many-body documentation](https://d3js.org/d3-force/many-body) describes approximation and distance parameters whose changes affect force behavior.
Altering those settings is a separate behavior change.

### Explicit non-goals

- Replacing or reverting the exact node-count selector, accepting obsolete `doc`/`minDegree` aliases, or dropping nodes, labels, relationships or rendering detail to improve timings.
- Changing charge strengths, theta, distance bounds, link strength/distances, gravity, cooling, reheating, tick count or the current default pause policy.
- Removing finite-geometry checks, safe curve generation, current warnings or generation fences.
- Changing OwlAPI, canonical admission/profiles, source acquisition, search indexing, materialization caching, or cold-load performance.
- Replacing SVG with Canvas/WebGL, upgrading D3, migrating all occurrence constructors, or adding a worker as part of the first patch.
- Changing configuration, dependencies, CI, hosting, public telemetry, release artifacts or historical tests/goldens merely to make an experiment pass.

## 4. Draft requirements, decisions and acceptance

| Requirement                                                                  | Acceptance criterion                                                                                                                                                                                         | Proof                                                                            |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| REQ-001: Reduce unnecessary active-layout work on the owner's large graph.   | AC-001: Meet the accepted paired-force and production-browser targets in section 6, with raw runs and noise retained.                                                                                        | QA-001 and QA-002; microbenchmark alone cannot satisfy it.                       |
| REQ-002: Preserve label state and object contracts.                          | AC-002: All nine fields retain forwarding, descriptor defaults, supported receiver semantics and instance isolation; inverse values change only through existing explicit owners.                            | QA-003, descriptor/behavior tests and current consumer inventory.                |
| REQ-003: Preserve layout, geometry and interaction semantics.                | AC-003: Equivalent per-tick state, finite geometry, drag/pin/pause/restore behavior and disposal; no weakened numerical or geometry assertions.                                                              | QA-003 and QA-004; real force and runtime tests plus browser interaction checks. |
| REQ-004: Preserve canonical meaning, occurrence topology and view selection. | AC-004: Identical admitted facts, occurrence keys/order, edges, labels, `nodesShown` results, presentation and saved scene meaning for the same input/settings.                                              | QA-004 and QA-005; existing canonical/view contracts and same-input comparisons. |
| REQ-005: Preserve capture, export and recovery.                              | AC-005: Current placements and pin state survive capture/export/reopen; an old capture cannot resume a replaced document or override an explicit pause.                                                      | QA-005 and generation/ownership regression tests.                                |
| REQ-006: Keep the patch measurable, bounded and recoverable.                 | AC-006: Exact source/build/input identities and all applicable checks are retained; evidence distinguishes source delivery, browser qualification and hosted acceptance; no unrelated/configuration changes. | QA-006 and GATE-005.                                                             |

| Decision | Selected direction and consequence                                                                                                                                                                                                                                                                               |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DEC-001  | Optimize the confirmed force/position path first. Treat resize/reflow, paint and loading as distinct measured costs.                                                                                                                                                                                             |
| DEC-002  | First candidate shares module-scope accessor functions while installing all nine as own non-enumerable, non-configurable properties. Preserve the constructor and prototype. GATE-003 controls receiver compatibility.                                                                                           |
| DEC-003  | The current fork at a frozen revision is the correctness/performance baseline. Legacy remains diagnostic context because its topology, viewport and engine differ.                                                                                                                                               |
| DEC-004  | Keep physics parameters, scene topology, numeric precision and output contracts fixed. Reject improvements caused by less work being requested or rendered.                                                                                                                                                      |
| DEC-005  | Measure on the production composition and keep instrumentation outside normal hot paths where possible. No telemetry service or new benchmarking dependency is selected.                                                                                                                                         |
| DEC-006  | Choose conditional follow-ups from fresh attribution: exact SVG write suppression for proven redundant writes; separate numeric state for residual accessor cost; worker isolation only for remaining UI-thread simulation cost. Each needs its own accepted scope and proof.                                    |
| DEC-007  | Reuse current renderer, D3, native descriptors, benchmark guard and canonical validators. New capability/library selection in an escalation requires refreshed primary-source research, exact rights/integration review and any configuration approval; existing installation does not qualify a new dependency. |

### Accessor compatibility contract

Extend [Label.test.js](../../src/webvowl/js/elements/links/Label.test.js), which currently covers primary-only `x/y/px/py` writes and `fixed/fx/fy` writes, with meaningful gaps:

1. Read and write `x`, `y`, `px`, `py`, `vx`, `vy`, `fx` and `fy` through independent labels.
   Preserve zero, negative values, undefined initialization and null fixed coordinates.
   Direct mutations of the primary property must be immediately visible.
   Do not add coercion or normalization in accessors.
2. `fixed` reads the current primary-or-inverse value using the existing truthiness/value behavior; its setter changes only the primary property.
   Cover absent inverse, a changing inverse reference and inverse fixation toggled after label construction.
   Do not cache the inverse or coerce the returned value to Boolean.
3. All nine descriptors are own accessors with `enumerable: false` and `configurable: false`, with both getters and setters.
   Preserve own-key order if any reachable reflection consumer relies on it.
   Assert shared function identity across instances for the intended cohort, without confusing reduced function allocation with a measured speed or heap gain.
4. Preserve `link()`, `property()`, `actualRadius()`, `draw()`, `inverse()` and `equals()` behavior, plus the identities/receiver and return semantics of copied `frozen`, `locked` and `pinned` callbacks.
   Sharing accessor functions does not authorize moving these callbacks.
5. Inventory assignment/override of `label.property`, descriptor extraction, inherited access, explicit `Reflect.get/set` receivers and detached/borrowed getters.
   The current accessors close over the constructor's property; proposed shared functions using `this.property()` instead depend on the receiver.
   These are observably different for arbitrary reflective calls.
   Current source search found no such Label consumer, but absence of a text hit is not universal equivalence proof.
   State the supported contract explicitly and test its reachable consumers.
   If a supported consumer relies on captured-property behavior, stop this candidate for redesign; do not silently weaken the oracle or introduce a shim.

## 5. Slices and execution order

SLICE-001 precedes SLICE-002.
SLICE-002 is the first candidate that can be delivered as a product fix.
Only GATE-004 selects any later slice.
SLICE-003 and SLICE-004 are alternative next experiments based on the remaining hotspot; both may eventually be useful, but neither is automatically required.
SLICE-005 requires a qualified numeric boundary from SLICE-004 and fresh evidence that main-thread simulation remains material.
One implementer integrates coupled label/runtime/test changes.
Independent fixture preparation or read-only source review may proceed separately if authorized; never run builds, tests, scans or other agents' work during trusted timing windows.

| Slice                  | Traceability                                                              | Demonstrable result and proof                                                                                                 | Release / cleanup implication                                                                           |
| ---------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| SLICE-001              | REQ-001–006; AC-001–006; QA-001–006; DEC-003–005                          | Frozen comparable workload, accessor contract, valid A/A baseline and reproducible measurement recipe.                        | Evidence only; preserve raw and rejected samples.                                                       |
| SLICE-002              | REQ-001–006; AC-001–006; QA-001–006; DEC-001–005                          | Shared own-accessor candidate renders/interacts/exports equivalently and meets accepted usefulness targets.                   | Independently deliverable after GATE-005; discard unused variants, retain comparison evidence.          |
| SLICE-003, conditional | REQ-001, REQ-003–006; AC-001, AC-003–006; QA-002, QA-004–006; DEC-004–006 | Exact unchanged SVG attributes are not redundantly written, with measured benefit and unchanged geometry.                     | Separate bounded renderer change; no precision loss or geometry-guard removal.                          |
| SLICE-004, conditional | REQ-001–006; AC-001–006; QA-001–006; DEC-004, DEC-006–007                 | Numeric simulation points integrate with current occurrence interactions and snapshots without duplicate authoritative state. | Rebaseline the larger runtime seam; qualify independently before release or worker work.                |
| SLICE-005, conditional | REQ-001, REQ-003–006; AC-001, AC-003–006; QA-002, QA-004–006; DEC-004–007 | Bounded worker simulation improves responsiveness while pause/capture/input/replacement ordering remains correct.             | New protocol, cancellation and deployment qualification; a worker is not accepted by force-only timing. |

### SLICE-001: Establish a comparable rendering workload and oracle

**Predicted changes:** focused additions to `Label.test.js`; a small developer benchmark such as `util/benchmark-rendering-force-layout.mjs` if existing utilities cannot express the comparison; fixture data only after ownership/provenance is established.
These paths are predictions, not existing commands or permission to publish the owner's ontology.

Freeze the baseline source and production bundle hashes, dependency lock, browser/runtime versions, machine/concurrent load, input bytes and view state.
Obtain the exact owner's large input or a locally retained equivalent artifact through the later authorized qualification workflow; never infer byte identity from its filename.
Record both selector-count facts and renderer node/label/link-part occurrence identities.
Retain seed, array order, starting coordinates/velocities/fixation, all force settings, viewport dimensions/device scale/zoom/translation, pause state and whether edit mode is enabled.

Build a small hand-enumerated suite of ordinary links, independent inverse directions, loops, parallel links, contextual datatypes, disconnected nodes and pinned labels, with zero coordinates and missing initial velocities.
Use real `Label`, property/node constructors and link parts for representative comparisons.
The 1,418-particle synthetic case remains a separate diagnostic workload.
Create independently reconstructed baseline/candidate graphs; D3 mutates nodes and link endpoints, so shallow copies or running the candidate on already-simulated baseline objects invalidate the comparison.

Establish A/A variation before examining candidate timings. Verify counts and starting state before every pair, preserve failed/incomplete runs, and keep trace attribution separate from untraced frame sampling.
The implementer owns fixture construction; hand-enumerated expected state and current canonical/renderer contracts own correctness.
Neither the proposed accessor implementation nor the faster variant supplies its own expected answers.
**Exit:** GATE-002 has a calibrated recipe and targets, and GATE-003 has a supported contract or an explicit unresolved blocker.
No product performance claim is made here.

### SLICE-002: Share the complete Label accessor cohort

**Predicted production file:** `src/webvowl/js/elements/links/Label.js`.
**Predicted proof files:** its existing unit test, a focused real-force test under `src/webvowl/js/runtime/` if needed, and extensions to the existing editing/adapter/export tests only where their current assertions do not cover the change.
Keep D3 imports within the existing runtime boundary; `Label.js` itself needs none.

Create module-owned shared functions/descriptors and install them through `Object.defineProperties` in each constructor call, maintaining the existing descriptor order and full behavior from section 4.
First resolve the receiver issue; do not hide it behind a private-store redesign whose force cost has never been measured.
Preserve all existing constructor callbacks, prototype methods, primary/inverse state ownership and class identity.

Run deterministic force comparisons at initialization and after ticks 1, 30, 120 and 300, including fixed and unfixed trajectories, with identical random source, force insertion order and link ordering.
Compare `index`, `x/y`, `vx/vy`, `fx/fy`, `px/py`, relevant primary/inverse state, alpha and termination conditions.
Exact equality is the first expectation for a representation-only patch in the same engine.
The proposed fallback tolerance for finite coordinates/velocities is `abs(a-b) <= 1e-9 * max(1, abs(a), abs(b))`, agreed before results; it is not permission to overlook different identities, pin values, NaN, infinities or divergent convergence.
Explain any nonzero difference before accepting a tolerance-based pass.

A pure D3 trajectory is insufficient: execute the current renderer's post-tick path for integration cases, including solitary-label recentering, curved/loop geometry, cardinalities and editor controls.
Manual ticks do not invoke that callback automatically.
Use real layout behavior in the existing native-renderer harness and the browser.
Mock only genuine unavailable boundaries such as browser layout metrics or external event delivery; do not stub accessors, forces, placement mappings or the state transitions being proved.

Qualify active and paused drag, pick-and-pin on/off, explicit pin/unpin, repeated pause/resume, distance changes, scene restore, view changes, document revision/replacement, capture/export and disposal.
Compare label content, occurrence counts/order and geometry at equal simulation state, then collect the paired performance evidence in section 6.
**Exit:** all hard correctness gates pass and the accepted performance target passes.
If only force timing improves, record a partial optimization result and invoke GATE-004; do not describe the user-visible problem as solved.

### SLICE-003: Conditionally suppress exact redundant SVG writes

**Trigger:** fresh traces and per-attribute counts show that repeated writes of identical serialized values are a material residual cost.
**Predicted file:** `renderedGraphInternals.js`, principally `svgRenderingGuard.setTransform`, `setCurvePath` and their callers; tests stay with the runtime/viewport/geometry owners.

Choose one coherent transform/path update path.
Compare the exact string that would be written with the last value owned for that actual DOM element; skip only an identical value.
Do not round coordinates, hide labels, skip active ticks, or read layout per element to decide whether to write.
Account for redraw/replaced DOM, other attribute writers, edit-mode controls and failed/non-finite writes.
A cache must not treat an invalid or unwritten value as committed, survive a retired element incorrectly, or retain detached SVG trees.
If ownership cannot prove that a cached value remains authoritative, use an appropriately measured current-attribute check or redesign the local owner before suppressing writes.

Prove identical attributes and warnings after moving, stopping, pausing, redrawing, editing and exporting; measure saved writes, main-thread work and frame delivery.
**Exit:** qualify the accepted residual target on its own baseline.
Zero useful duplicate writes or insignificant end-to-end benefit ends this experiment without expanding it into a renderer replacement.

### SLICE-004: Conditionally separate numeric force state

**Trigger:** the shared-accessor candidate is insufficient and controlled measurements still attribute material cost to wrapper/heterogeneous-object access after accounting for rendering feedback.
**Predicted files:** runtime-local numeric-state ownership beside `renderedGraphInternals.js`, its force assembly/interactions, and affected arrangement/capture tests.
A new file is justified only by a clear owning seam.

Map every current simulation occurrence to one ordinary numeric point with stable field shape and a revision-bound renderer key.
Preserve exact array ordering and existing inverse/label grouping; do not key by IRI or merge equal-looking occurrences.
Prepare the existing force inputs from occurrence facts, including link-part endpoints, charge categories, radii and distance rules, without retaining a second semantic graph.
Reconcile reuse/removal explicitly when topology changes; a reused semantic ID in a new generation is not an old simulation point.

Define ownership of active position/velocity and the synchronization transaction. Apply drag, pin, pause and arrangement commands before the next applicable step; publish positions to drawing/capture at the established boundary.
Handle solitary-label centering as explicit feedback into the next simulation step.
Copying coordinates one way while the renderer also writes them would change the algorithm.
Keep `px/py` compatibility where current drag/restore consumers need it.
Preserve primary-only versus explicitly inverse-mutating behavior.

Prove exact trajectory/interaction equivalence, unchanged snapshot/export schemas, removal/disposal of maps and timers, and net improvement including mapping/synchronization/allocation cost.
Measure the plain-state production candidate against the qualified accessor candidate, with original baseline results retained.
**Exit:** a useful, independently qualified runtime boundary.
If it needs a public contract, stored-scene or semantic identity change, stop and replan that change before continuing.

### SLICE-005: Conditionally isolate simulation in a worker

**Trigger:** numeric-state qualification still shows simulation monopolizing the UI thread enough to miss the accepted interaction target.
Measure a prototype including messages and boundary synchronization before selecting this architecture.
[D3's worker recommendation](https://d3js.org/d3-force/simulation) concerns large static layouts; it is not direct qualification of this application's interactive worker protocol.

**Predicted work:** a runtime-owned simulation worker/client and tests, existing force-state owner, drawing/capture integration, production worker artifact validation.
Inspect bundler support first; any required Vite/package/test/hosting setting has a separate exact-change approval gate.
The existing canonical worker owns admission, not the interactive force simulation.
Reuse applicable cancellation/bounded-message patterns without sharing ownership or coupling layout progress to admission jobs.

Define and test a small protocol with mount/load generation, document or drawing revision, simulation generation and monotonic command/result sequence.
Transfer bounded numeric state and link indices rather than renderer objects, executable functions or ontology contents.
Validate message shape, array lengths, indices and finite values against admitted graph bounds.
One actor owns each position buffer at a time; cap in-flight results and coalesce obsolete intermediate frames without losing the final state.
Main-thread painting consumes at most one accepted result per render opportunity; state what happens when it falls behind.

Preserve ordered drag/pin commands, latest-input precedence, pause acknowledgment, capture fences, resume ownership and end notification.
Reject delayed results after replacement, newer commands, cancellation or disposal, even when occurrence keys happen to match.
A paused export must capture the acknowledged current state and must not resume a document it no longer owns.
Specify startup/error/termination behavior and recovery before integration; do not silently add a second simulation mode as an unapproved compatibility fallback.

Prove saturation, rapid topology replacement, worker failure, pause during an in-flight tick, export during drag, repeated disposal and no orphan worker/buffer growth.
Measure input-to-render latency, frame intervals, worker time, main-thread callback time, message bytes/count and retained state on supported browsers and the exact production artifact.
**Exit:** accepted responsiveness and recovery evidence.
Paint costs remain separately attributable; a faster worker cannot make an SVG-paint bottleneck disappear.

## 6. Measurement and quality scenarios

### Reproducible force measurements

The original exploratory command is:

```powershell
node 'C:/Users/maksy/AppData/Local/Temp/webvowl-force-layout-probe-20261009.mjs'
```

If that temporary file is unavailable, its diagnostic recipe is: import the repository's installed `forceSimulation`/`forceManyBody` and production `Label`; for indices 0–1417, set `x = cos(index * 2.399963) * sqrt(index) * 35`, `y = sin(index * 2.399963) * sqrt(index) * 35`, `vx = vy = 0`, `fx = fy = null`; use ordinary points for indices below 668 and the selected label representation thereafter; assign strengths -500/-400 by that same index split; stop the timer, warm 30 ticks and time 120 ticks; repeat each of the four variants for three rounds.
This reconstructs the diagnostic mechanism, not its exact machine timings or a fully qualified surrogate.

The implementation benchmark must improve on that recipe:

- Call `assertQuiescentMachine` from [benchmarkEnvironment.mjs](../../util/benchmarkEnvironment.mjs) before trusted measurement groups and follow [ADR 0003](../adr/0003-quiescent-benchmark-environment.md).
  The current default samples 500 ms and rejects over 10% CPU busy.
  Record concurrent load; do not run other tools during timing.
- Record exact baseline/candidate revisions and file hashes, runtime/dependency identities and fixture recipe/bytes.
  Freeze relevant source before each group; changes invalidate the comparison.
- Use complete real labels and representative production object/link shapes; keep the synthetic force-only case separately named.
- Warm each representation equivalently; start every timed pair from independent identical state.
  Counterbalance baseline/candidate order with a recorded schedule, and use fresh-process repetitions to expose JIT/order effects.
  Include all complete pairs, with objective invalidation reasons retained.
- Separate initialization/allocation, per-tick force work, full runtime tick work and retained state.
  Report median and p95 per workload, raw run counts and paired ratios; do not pool unrelated shapes or claim a heap reduction from fewer function identities.

### Same-input production browser comparison

Use two retained production artifacts from the same source/dependency baseline, differing only by the candidate patch, in dedicated qualification tabs.
Load identical bytes, await the existing load-complete contract, then restore the same arrangement and view settings through supported application paths.
Use the owner's large graph as the primary acceptance fixture and small representative shipped/correctness fixtures for regression checks.
Confirm semantic/occurrence/selection parity before starting timing; failed parity invalidates performance interpretation.

Record browser build, OS/hardware, power state, device scale, viewport dimensions, zoom/translation, fonts, edit mode, panels, diagnostics and all force settings.
Keep only the measured graph active, with no debugger pauses, tracing, DOM snapshots, extension inspection or screen capture inside untraced windows.
Use identical external instrumentation for both builds; if a test-only hook is unavoidable, describe its overhead and verify outcomes on the ordinary build too.
Raw `requestAnimationFrame` timestamps measure frame opportunities; label them as frame intervals rather than claiming they directly measure INP or guaranteed presented FPS.

For the large graph, propose five paired five-second active windows in each of two otherwise quiet sessions, with counterbalanced A/B order.
Each window starts from the same captured state and the same existing reheat stimulus; do not continuously reheat or change cooling to keep a sample busy.
Observe actual start/end/tick state.
If the simulation ends inside a window, report active and idle portions separately and add settle-time evidence; never let idle frames inflate apparent active-rendering performance.
Repeat tracing separately on matched state for callback/many-body/position-update/paint attribution.
Browser control latency and extension stalls remain separately attributed.

Capture median/p95 frame interval, count and fraction over 50 ms, active callback durations, force/tick counts, settle state, invalid-geometry warnings and interaction results.
Check the same drag/pin/pause/distance/export script on both builds; collect browser screenshots and detached geometry outside timing windows to support visual/coordinate comparison.

### Proposed quantitative gates

These are proposed usefulness thresholds, not historical promises.
GATE-002 accepts or recalibrates them from baseline variability before candidate results are examined.

| Scenario                                     | Stimulus and required response                                                                              | Proposed acceptance                                                                                                                                                                                                                                                                                                                                                                        |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| QA-001: Real force work                      | The same large occurrence/link graph advances through the same deterministic steps.                         | At least 15% lower median full-force tick cost, with no corroborated p95 regression over 5%; zero unexplained state differences under the predeclared oracle. Synthetic results are supporting evidence only.                                                                                                                                                                              |
| QA-002: Active browser rendering             | The primary graph resumes or its class distance is changed, using identical restored state.                 | At least 10% lower median application callback cost and at least 10% lower untraced median frame interval. If frame quantization masks the median, a preselected alternative is at least 20% lower fraction of intervals over 50 ms; select this alternative at GATE-002, not after seeing results. Neither frame nor callback p95 may regress over 5% without a documented noise finding. |
| QA-003: Coordinates and object behavior      | D3 initializes/ticks labels; callers mutate primary/inverse fixation or access independent instances.       | All accessor and numerical invariants in sections 4–5 hold, including exact descriptor shape, primary-only mutation, state isolation and supported receiver behavior.                                                                                                                                                                                                                      |
| QA-004: Interaction and geometry             | Active/paused dragging, pin/unpin, distance changes, filters, selection, topology updates and disposal.     | Same affected occurrences and layout transitions, no stale coordinates or timers, no missing labels/relationships, finite SVG, intact guards, current `nodesShown` behavior and no new console error.                                                                                                                                                                                      |
| QA-005: Capture and recovery                 | Capture/export/reopen after pinning and movement, followed by replacement or explicit pause during capture. | Same semantic content and supported scene/placement state; snapshots fence the correct generation and pause owner. No old operation resumes newer state.                                                                                                                                                                                                                                   |
| QA-006: Bounded change and smaller workloads | Run the same small corpus and repeated mount/dispose cycles.                                                | No corroborated regression greater than the larger of 10% or 25 ms in an end-to-end interaction; no retained retired-graph owner or unbounded map/buffer growth; no unauthorized configuration, protocol or storage change.                                                                                                                                                                |

Keep per-run and per-session values; demonstrate the chosen improvement in both sessions rather than pooling a favorable mean across contradictory sessions.
If A/A variability is comparable to a target, classify the result as inconclusive and improve the environment/recipe before accepting a claim.
Corroborate threshold breaches under ADR 0003.
Preserve invalid samples and the evidence that made them invalid; do not keep rerunning only until one result passes.
The initial patch is accepted only when all hard compatibility checks and the selected usefulness gates pass.
A safe but insufficient patch may be considered separately by the owner, with its residual problem stated.

## 7. Verification commands and evidence ownership

The following are planned implementation checks using current repository interfaces.
They were inspected while authoring this document; they are not reported as executed product verification.
Run commands from the repository root with the installed toolchain.
New test files become runnable only after their slice creates them.
Use existing Jest worker policy; explicit serial runs retain `--runInBand`.
Timing benchmarks run separately from all test/build work.

| Scope                                     | Current command or suite selection                                                                                                                                                                                                                                                                                                                    |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Label unit contract                       | `npm test -- --runInBand --runTestsByPath src/webvowl/js/elements/links/Label.test.js`                                                                                                                                                                                                                                                                |
| Native renderer, movement and view        | `npm test -- --runInBand --runTestsByPath src/webvowl/js/parsing/canonicalRenderElements.test.js src/webvowl/js/runtime/renderedGraphEditing.test.js src/webvowl/js/runtime/renderedGraphSeamConformance.test.js src/webvowl/js/runtime/d3RenderedGraphAdapter.test.js src/webvowl/js/graphViewport.test.js src/shared/js/modules/pickAndPin.test.js` |
| Capture/export ownership                  | `npm test -- --runInBand --runTestsByPath src/webvowl/js/runtime/captureRenderedDrawing.test.js src/webvowl/js/runtime/renderedSvgExportClone.test.js src/app/js/controller/canonicalVowlDrawingExport.test.js`                                                                                                                                       |
| Canonical placement and selector boundary | `npm test -- --runInBand --runTestsByPath src/app/js/controller/canonicalVowlScene.test.js src/app/js/controller/canonicalVowlViewControls.test.js src/app/js/controller/canonicalVowlRenderProjection.test.js src/app/js/controller/canonicalVowlDocumentSession.test.js src/app/js/controller/nodesShownContracts.test.js`                          |
| Architecture                              | `npm test -- --runInBand --runTestsByPath src/renderedGraphDecoupling.architecture.test.js src/productionModuleFormat.architecture.test.js src/productionGraph.architecture.test.js`                                                                                                                                                                  |
| Candidate source verification             | Applicable route-selected checks, including `npm run lint`, `npm run format:check` and `npm test -- --runInBand`; select additional canonical/resource suites if escalation changes those boundaries.                                                                                                                                                 |
| Production artifact                       | After tests that may replace build output: `npm run build`, then `node util/verify-webvowl-lazy-parser-chunks.mjs`, then `npm run preview` for real-browser qualification of that exact artifact.                                                                                                                                                     |
| This document                             | `tooling/markdown/node_modules/.bin/markdown-quality.cmd check --execution-profile .markdown-quality-execution.json --diagnostic-level warning -- docs/plans/2026-10-09-rendering-performance-regression-plan.md`                                                                                                                                     |

Current `package.json` provides `test:markdown`, `check:docs` and `format:docs:check`; it does not provide the older adjacent plan's `test:prose` command.
Use current interfaces rather than copying stale command tables.
Read the selected HISEW profile definitions at implementation time.
A `full` receipt that covers a build does not substitute for product tests, browser evidence, performance measurements or live recovery.
Do not manually dispatch hosted CI unless authorized, and do not describe skipped/pending checks as passed.

The existing renderer editing harness uses real D3/parser/SVG elements with supplied browser metrics/event boundaries; it can prove important state transitions but cannot prove browser paint or scheduling performance.
The adapter suite also uses an internal fixture, so passing it alone cannot qualify the hot loop.
Retain focused real-force coverage plus actual browser evidence instead of rewriting tests to match the proposed implementation.

## 8. Evidence, privacy, compatibility and release

Before writing new benchmark reports, rediscover the current HISEW evidence/temp destinations and an owned task directory.
Do not assume historical `.sdlc/runtime`, `.sdlc/tmp` or an earlier execution's directory is appropriate.
Retain the source report/probe provenance, candidate/baseline/input hashes, workload settings, raw paired results, A/A noise, trace identities, invalidations, contract outcomes and final acceptance interpretation together.
Keep large traces and private ontology bytes outside the repository unless their storage and distribution are explicitly authorized.
A fixture manifest can bind local source bytes without publishing them.

Diagnostics should contain aggregate times/counts, operation identity, generation/revision and sanitized failure codes.
Do not upload ontology labels, IRIs, query text, file contents or browser profiles as telemetry.
Reuse current local diagnostics when adequate; optional performance APIs need feature detection and trace alternatives.
The modern-web-guidance search/retrieval informed measurement separation; no INP/RUM library or new production API is selected.

The first accessor patch has no backfill or data migration: coordinates still reside in the same primary properties, and descriptor enumerability plus serialized contracts remain intact.
Verify saved scene round trips and canonical exports instead of assuming an internal object change cannot affect them.
A later numeric/worker phase must preserve the same external contracts; needing a new stored format, public snapshot shape or import policy reopens design and migration scope.
No material public names change.
New internal names must describe their owner and units precisely; no obsolete alias/shim override is assumed.

The initial patch adds no trust boundary, so it does not itself justify a repository-wide security scan.
Review changed state handling and untrusted-coordinate rejection within existing checks.
A worker/message protocol or new dependency is a new scoped security/privacy/integration concern and requires the applicable route and native assessment ownership before acceptance; this plan does not launch that work.

For the first release candidate, identify an existing usable predecessor and its identity if available, or document containment and forward repair.
The owner previously declined additional rollback preservation; this plan does not require a new artifact backup.
Run same-input qualification against the candidate artifact, then report source checks and browser results separately.
If deployment is later authorized, verify hosted asset identity and repeat the agreed active-layout/interaction smoke in a dedicated tab; only that observation establishes hosted acceptance.
The assigned implementer observes the initial rollout and reports the accepted metrics and any residual hotspot to Maksy.

Abort on changed semantics/topology/selection, unexplained coordinate differences, invalid geometry, stale capture/resume, lost pins/placements, orphan work, corroborated regression or missing artifact identity.
During local iteration reverse only task-owned edits; never restore or discard another task's working tree.
For an authorized hosted release, use an existing compatible artifact through the established deployment path if restoration is appropriate and available, or contain and forward-fix.
Verify the selected approach before claiming recovery support; an available predecessor is not a performed recovery test.
Retain accepted/rejected measurement records, and remove temporary experiment variants and instrumentation only after their evidence is preserved. Stop task-owned preview processes and dispose qualification simulations/workers.

## 9. Unknowns and replanning conditions

| Unknown                                                  | Cheapest useful experiment                                                                                           | Decision owner / consequence                                                                                                     |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Shared own accessors help real production shapes         | Complete nine-descriptor candidate with actual property/node/link objects, then matched production browser pairs.    | Implementer/Maksy: qualify SLICE-002 or retain an explicit insufficient result.                                                  |
| Captured-property behavior is a supported contract       | Consumer inventory and targeted reflective/receiver cases before changing implementation.                            | Implementer identifies consumers; Maksy resolves any material contract change. GATE-003 blocks an unsupported equivalence claim. |
| The owner's loaded view can be reconstructed exactly     | Retain actual bytes, admitted occurrence manifest and arrangement/settings, then check two baseline reconstructions. | Implementer/Maksy: without parity, use a clearly named substitute and leave owner-workload acceptance incomplete.                |
| Force savings survive rendering feedback                 | Equal-step real runtime comparison including solitary-label recentering and curve/transform updates.                 | Implementer: revise the benchmark or candidate before interpreting timing.                                                       |
| Residual SVG work is avoidable                           | Count identical transform/path writes and trace their cost after the physics candidate.                              | Maksy chooses SLICE-003 only with material evidence.                                                                             |
| Separate numeric state is worth its synchronization cost | Bounded actual-runtime prototype with the same full-force and interaction oracle.                                    | Maksy chooses SLICE-004; no automatic migration across constructor families.                                                     |
| Worker isolation helps the interaction outcome           | Prototype bounded messages, pause/capture fences and saturation; measure total interaction latency and paint.        | Maksy chooses SLICE-005 only after numeric-state qualification and architecture review.                                          |
| First bad historical revision                            | A separate controlled bisection with reproducible input/build environments if the causal history is needed.          | Optional diagnostic work; not required to test the present mechanism and not established by commit dates.                        |

Rebaseline when source/lock/input/build identities change materially; pause the affected comparison when unrelated edits alter its workload.
Replan when the measured hotspot disappears, receiver compatibility cannot be preserved, scene/identity ownership changes, data/protocol migration is needed, numeric targets are below environmental noise, or configuration/dependency changes become necessary.
Do not broaden the plan merely because a later option exists.
The first completion decision is whether the complete shared-own-accessor candidate preserves the current application and produces the accepted visible improvement.
