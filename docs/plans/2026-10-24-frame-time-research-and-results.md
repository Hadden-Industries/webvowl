# Frame-time research and measured improvements

Date: 24 October 2026.
Status: implemented, scoped checks passed, bounded real-ontology foreground observations completed; programme acceptance remains separate.

## Scope and result

The owner requested deeper research and continued reduction toward the 50-ms frame target using the real extended universal ontology.
The owner clarified that preserving VOWL appearance does not require preserving SVG primitives: visually equivalent Canvas, GPU or different SVG representations are eligible candidates.
Dotted/dashed relationships, markers, labels, selection, editing and export remain part of the behavior to preserve.

This iteration implements two bounded changes: local force-visit state and native SVG translation updates.
Five ordinary foreground W6 loads have active-frame p95 values of **37.5–41.7 ms**, with natural settlement **5.37–5.75 seconds after admitted data**.
All five retain focus, all 953 node elements and observed movement.
Their largest individual frame interval is 83.4 ms, below the separate 200-ms ceiling.
These are five useful load observations, not the full matched acceptance cohort or a claim that every frame is below 50 ms.

W4 remains an explicit stress limitation: its two new headless runs have frame p95 values of 95.8 and 91.6 ms.
The real ontology and the subclass-heavy fixture expose different dominant costs.

## Candidate and measurement identity

The working branch remains `feat/architecture-performance-ui`, at HEAD `91ef9f2d2579de664862765856fcf987e445467c` with the existing uncommitted continuation.
This iteration changes only `legacyForceSimulation.js` and `renderedGraphInternals.js` in product source.
No dependency, configuration or publication change is made.

| Input                  | Identity                                                                                           |
| ---------------------- | -------------------------------------------------------------------------------------------------- |
| Real workload          | `C:/Users/maksy/GitHub/universal-ontology/dist/universal/extended/20260912-full`                   |
| Workload bytes         | 3,023,054; SHA-256 `d7eb7980436600ab50c8a5df35401a4a345fe4362d111f2d8e6f90217505b077`              |
| Real scene             | 953 class/datatype nodes, 1,215 link paths, 1,201 rendered label groups                            |
| Immediate baseline     | Production manifest 34; SHA-256 `0cf83aa2a6e6215274b7f2f2630a0834904b5c103929e6c8b8e42f34ec054454` |
| Final candidate        | Production manifest 37; SHA-256 `38a7c431bba02d886d3f40ee18f5587bf9942e25ddcff53eb23b38cede81f9c6` |
| Candidate entry        | `js/index.js`; SHA-256 `1d63f81ce6c5b857436b30baef0d0148424586050b03c61ef50a76e96d08ac2c`          |
| Browser                | Chrome 156.0.8078.48; existing task-owned profile; 1,440 × 900 viewport                            |
| External evidence root | `C:/Users/maksy/.hi/w/e/operator/16557566c924469fb5e117f2cfbe6e03`                                 |

The summary verifies the retained baseline entry bytes, current candidate entry and 18 unchanged runtime assets, including the selected worker, vendor JavaScript, HTML, styles and fonts.
The baseline entry override is restricted to headless diagnostics.
Foreground runs use unmodified candidate production assets and native randomness.
The owner's CPU exception remains explicit; raw reports retain `acceptanceEligible: false` and `owner-authorized-observe-only` rather than claiming a quiescent machine.

## What other graph renderers do

Research consulted primary documentation, implementation discussions and issue reports.
Their benchmark numbers are not predictions for WebVOWL; renderer, graph, styling, hardware and measurement boundaries differ.

| Evidence                                                                                                                                                                         | Useful technique                                                                                                                                             | Application here                                                                                                                                                                                              |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Cytoscape performance documentation](https://js.cytoscape.org/#performance)                                                                                                     | Treat edges, labels, styling and pixel density as separate costs; reuse rendered work.                                                                       | Separate the mixed W6 scene from W4's concentrated dotted-edge stress. Avoid selecting solid lines or omitted labels as an optimization because that changes the accepted appearance.                         |
| [Cytoscape WebGL preview](https://blog.js.cytoscape.org/2025/01/13/webgl-preview/)                                                                                               | Render reusable glyphs into texture atlases, then position them with GPU draws.                                                                              | A credible design for repeated VOWL node/label glyphs. The January 2025 preview's unsupported styles are historical limitations to investigate, not evidence that current releases still lack them.           |
| [Cytoscape maintainer discussion](https://github.com/cytoscape/cytoscape.js/discussions/3325)                                                                                    | Texture compression, atlas size and OffscreenCanvas lifetime affect startup, memory and cleanup.                                                             | A backend experiment must include first-image cost and explicit release of image/texture resources; raw animation FPS is insufficient.                                                                        |
| [Cytoscape integrated-GPU report](https://github.com/cytoscape/cytoscape.js/issues/3436)                                                                                         | A reported GPU-renderer regression depends on the device and workload.                                                                                       | Measure on this machine and representative graphs; a WebGL label alone does not establish a gain. This is one issue report, not a universal conclusion about GPU rendering.                                   |
| [Sigma rendering architecture](https://www.sigmajs.org/concepts/rendering/) and [performance guidance](https://www.sigmajs.org/how-to/technical/performance/)                    | Generate GPU primitives, cache label textures, use a separate picking pass, and profile CPU and GPU costs independently. Overdraw and blending can dominate. | A potential VOWL backend must reproduce dashed strokes, arrows, ordering and picking while retaining the semantic controller. GPU thread totals must not be added to main-thread duration as elapsed time.    |
| [Sigma label-buffer issue](https://github.com/jacomyal/sigma.js/issues/1553)                                                                                                     | Rebuilding and uploading unchanged label data can dominate an animated graph.                                                                                | Reuse invariant presentation and change positions only. The issue concerns its reported version; it is evidence for the mechanism, not a current Sigma-wide defect claim.                                     |
| [PixiJS performance guidance](https://pixijs.com/8.x/guides/concepts/performance-tips) and [graphics contexts](https://pixijs.com/8.x/guides/components/scene-objects/graphics)  | Reuse immutable geometry, batch compatible draws, and avoid repeatedly rebuilding text. Culling can cost more in a CPU-bound scene.                          | Supports a future cached-glyph experiment. Offscreen omission must preserve viewport re-entry and interaction; wholesale culling is not automatically beneficial.                                             |
| [D3 force simulation](https://d3js.org/d3-force/simulation) and [Graphology ForceAtlas2](https://graphology.github.io/standard-library/layout-forceatlas2.html)                  | Precompute invariant force inputs; separate simulation and drawing; large static computations can use workers with explicit lifecycle.                       | First remove repeated work in the existing numerical algorithm. The current solver already uses Barnes–Hut; changing solver or adopting a worker has separate transfer, synchronization and trajectory costs. |
| [Chromium rendering architecture](https://developer.chrome.com/docs/chromium/renderingng-architecture?hl=en)                                                                     | Main-thread animation, style/layout, paint and parallel raster/compositor work are distinct phases.                                                          | Attribute the actual W6 frame before selecting a renderer rewrite. Nested trace totals and parallel threads are not additive wall time.                                                                       |
| [MDN SVG translation API](https://developer.mozilla.org/en-US/docs/Web/API/SVGTransform/setTranslate) and [SVG coordinate specification](https://www.w3.org/TR/SVG2/coords.html) | Update an existing native translation directly. Attribute reflection still exists.                                                                           | Measure the native API instead of assuming it removes all serialization or paint work. Retain the initial string path and read the current live transform item on each update.                                |

The immediate conclusion is to eliminate repeated CPU work and use the existing native transform representation, then consider a different drawing backend for the remaining paint-heavy cases.
Canvas/WebGL remain eligible; their scope is a faithful rendering implementation, including lifecycle, export and interaction, rather than a change to VOWL styling.

## Profile and bounded implementation

### Local force-visit state

The diagnostic profile loads W6 paused, waits for ordering, then observes resumed motion through natural completion with startup-seeded randomness.
It records a native CPU profile, graphics trace and Long Animation Frames, separately from uninstrumented foreground timing.
No trace data loss is reported.

The baseline samples approximately 3,514 ms inside numerical force steps, including 3,051 ms in the topmost quadtree visit.
W6 property-backed label coordinates repeatedly invoke forwarding accessors for every visited cell.
This is a real-ontology CPU cost; W4's earlier SVG raster attribution cannot be transferred to W6 by assumption.

`repulse` now reads current `x`/`y` once per node visit and keeps previous `px`/`py` values local while applying each force contribution in the original order.
It writes those previous coordinates back before visiting the next node.
The quadtree traversal reads current positions and does not read another point's previous coordinates, so no intermediate update is observable to another step.
The values are captured after tree accumulation, which may jitter coincident current positions.

There is no persistent cache, extra timer, changed force formula, traversal order, approximation parameter, cooling schedule, random sequence or step count.
Existing per-step visible-label projection and the two-step publication cap remain intact.
The candidate profile samples approximately 1,534 ms inside numerical steps and 1,120 ms in the topmost tree visit.
These are instrumented attribution figures, not standalone stopwatch gains that can be added to the browser timings.

### Native SVG translation

A frozen real-scene ABBA diagnostic updates 2,154 node/label transforms with identical alternating positions.
String updates take 1.3–1.4 ms median per frame; direct native updates take 0.6 ms.
The corresponding frame intervals remain about 12.5–12.6 ms median, demonstrating that this local saving alone is not a large whole-frame improvement.
All compared native matrices match exactly in this isolated experiment.

The renderer now updates the current single `SVGTransform` through `setTranslate` when both coordinates fit the API's finite single-precision range.
Initial empty lists, compound transforms, non-native DOM implementations and larger finite values retain the existing attribute-assignment route.
The transform item is read fresh each time because an attribute replacement can detach an earlier item.
No cached DOM handle or alternate resource lifetime is introduced.

Native attribute reflection uses a shorter numerical representation.
The force-only candidate preserves all 4,572 recorded W6 element attributes exactly at both initial and final states; the final native-transform candidate preserves paths, order, identity and stroke styles exactly while translate strings may differ by up to 0.005107 graph units.
Both full-size settled screenshots were inspected.
The graph pixels are identical; only 14 pixels in the bottom Resume control differ, each by one channel level out of 255.
The screenshot equality claim is bounded to this deterministic W6 scene and browser, not every zoom level or browser.

## Measurements

### Headless diagnostics

Each row below contains two seeded resumed-layout runs, not independent ordinary-load acceptance cohorts.
No build, lint or test workload runs concurrently with browser measurement.

| Version                                              | W6 settlement   | Per-run active-frame p95 |
| ---------------------------------------------------- | --------------- | ------------------------ |
| Immediate baseline, manifest 34                      | 6.546 / 6.479 s | 54.1 / 50.1 ms           |
| Local force state, manifest 36                       | 4.883 / 4.997 s | 41.6 / 45.8 ms           |
| Local force state and native transforms, manifest 37 | 4.815 / 4.908 s | 37.7 / 41.6 ms           |

The final diagnostic's mean settling time is about 25% below the immediate baseline.
The native transform's smaller incremental difference is not isolated from run-to-run variation in these two-run browser samples; its ABBA write-cost result supports the local saving.
The earlier invariant-`x`/`y`-only prototype, manifest 35, remains retained and is superseded by the complete local-state implementation.

W4's two final stress diagnostics settle in 9.467 and 9.498 seconds, with frame p95 of 95.8 and 91.6 ms and maximum intervals of 200.0 and 170.8 ms.
They preserve all 8,004 recorded elements' non-transform attributes against the retained manifest-34 comparison; only native translate reflection differs, by at most 0.005200 graph units.
This does not establish a W4 cadence improvement, and headless observations do not close its foreground gate.

### Ordinary foreground W6 loads

The optimized candidate receives one excluded warmup followed by five automatic running loads.
The observer does not pause, resume or reheat the graph before observing it.
The harness's A/B labels are an A/A schedule using the same candidate bytes, not a baseline/candidate foreground comparison.

| Load | Source to observed frame | Seed    | Admitted data to usable drawing | Admitted data to settlement | Active-frame p95 | Maximum frame |
| ---- | ------------------------ | ------- | ------------------------------- | --------------------------- | ---------------- | ------------- |
| 1    | 3,988.5 ms               | 22.0 ms | 504.1 ms                        | 5,536.0 ms                  | 37.9 ms          | 54.2 ms       |
| 2    | 4,162.7 ms               | 20.1 ms | 489.7 ms                        | 5,612.1 ms                  | 41.6 ms          | 62.7 ms       |
| 3    | 4,115.9 ms               | 18.7 ms | 483.9 ms                        | 5,477.3 ms                  | 37.6 ms          | 71.0 ms       |
| 4    | 4,139.7 ms               | 21.0 ms | 534.6 ms                        | 5,372.6 ms                  | 37.5 ms          | 83.4 ms       |
| 5    | 4,339.7 ms               | 19.4 ms | 524.9 ms                        | 5,754.8 ms                  | 41.7 ms          | 66.9 ms       |

Every measured run retains focus, all 953 nodes and genuine movement through natural settlement.
There are no browser exceptions, and the owned Chrome process exits with code 0.
The excluded warmup has frame p95 of 37.6 ms and settlement of 5,431.9 ms.
The frame observations start after initial motion has begun; 121–123 node bounds are already outside the viewport.
This result therefore does not certify initial framing or overlap quality.

These observed W6 values meet the numerical frame/settlement limits in [AC-104](2026-10-23-initial-layout-improvement-plan.md#6-requirements-proposed-acceptance-and-quality-scenarios), but five runs do not replace the plan's repeated matched cohort requirements.
The separate five-second active-replacement p95 requirement, W4/W5 foreground qualification, framing and final cross-workload acceptance remain open.
Source-to-frame timing includes preparation; settlement timing begins at admitted graph data, so these columns must not be subtracted as if they share an origin.

## Verification, retained evidence and next boundary

The final source passes 124 tests across four affected suites: force equivalence, renderer adapter, editing and finite SVG rendering guards.
The independent retained D3 3.5.17 oracle compares numerical steps, including property-backed labels, fixed points, coincident points and reheat/stop behavior.
Scoped JavaScript formatting and ESLint pass, and the production bundle builds successfully with the existing large-chunk warning.
Earlier unchanged VOWL-package checks are retained rather than rerun.
No full suite, external review, commit, push or PR change is performed.

Evidence under the external root:

- `frame-research-summary.json`, `summarize-frame-research.mjs`: source/report hashes, selected runtime-asset preservation, five foreground run assertions and W4 geometry comparison.
- `frame-research-comparison.json`, `compare-frame-research.mjs`: exact force-only attributes and bounded native translate reflection.
- `W6-active-frame-research-1` and `W6-active-frame-candidate-1`: CPU profiles, compressed graphics traces, no-data-loss receipts and attribution summaries.
- `W6-frame-research-baseline-1`, `W6-invariant-coordinates-candidate-1`, `W6-local-force-state-candidate-1`, `W6-native-transform-candidate-1`: baseline and successive headless candidates.
- `W6-native-transform-api-1`: ABBA native/string update timings and exact matrix comparisons for 2,154 elements.
- `frame-research-screenshot-comparison.json`, `frame-research-screenshot-statistics-2.json`: full-image hashes and the 14 one-level differences confined to the Resume control.
- `W6-frame-improvement-foreground-1`: raw uninstrumented headed observations, excluded warmup, foreground assertions and normal browser exit.
- `W4-frame-improvement-diagnostic-1`: two synthetic stress runs; the remaining slow frames stay visible.
- `frame-research-baseline-index.js`, `frame-research-baseline-manifest-36.json` and production manifests 34–37: retained source bindings and intermediate candidates.

The initial pixel-comparison route found no local Pillow installation; the dependency-helper connection was unavailable.
The first native screenshot-statistics helper failed to compile its drawing references and wrote a null statistics artifact.
That invalid artifact remains unchanged; the corrected helper uses locked bitmap bytes and writes the separate `statistics-2` result.
An earlier baseline command had a mistyped authority path and failed before browser launch; the corrected baseline completed normally.
These are tooling failures, not discarded application timing samples.

The strongest next rendering experiment is a faithful cached Canvas/WebGL edge or glyph layer, measured on both W6 and W4 while preserving the existing semantic controller and export contract.
Measure actual paint/raster savings, first-image cost, text/marker quality, picking, zoom/device-pixel-ratio behavior and teardown before adoption.
Changing primitives is explicitly permitted by the owner; adding a rendering dependency or altering configuration would still require the exact configuration approval.
This record selects no new library or GPU backend and does not treat a backend rewrite as necessary to explain the measured W6 improvement.

## Interactive rendering follow-up

The owner distinguishes initial loading from static panning and node dragging.
The [manifest-38 follow-up](2026-10-24-active-graph-performance-follow-up.md#interactive-panning-and-dragging--manifest-38) records the source fix, foreground observations and their limits.
The implemented change skips equal geometry writes; it does not replace the visual renderer.

### What the primary sources support

[Cytoscape's rendering options](https://js.cytoscape.org/#init-opts/rendering-options) describe reusing a viewport texture during panning and zooming, while noting that its newer renderer already makes the explicit hint less useful.
This supports testing cached static content, not assuming that merely adding Canvas will improve this application.
Its optional edge hiding and reduced resolution are not adopted because this task preserves visible notation and quality.

[PixiJS's render-group documentation](https://pixijs.download/v8.0.0-rc/docs/scene.Container.html) explains that a group can retain rendering instructions and apply camera transforms on the GPU.
It also cautions that separate groups cannot batch together.
The transferable principle is to move a stable scene without reconstructing its drawing instructions; it is not a recommendation to add a layer for every node.

[SVG repeated gradients](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/spreadMethod) offer another way to paint a repeated pattern.
However, [SVG paint-server inheritance](https://www.w3.org/TR/SVG2/pservers.html#LinearGradientElement) comes from the paint server's own ancestors, so a shared gradient does not automatically inherit a referencing path's hover color.
[SVG hit testing](https://www.w3.org/TR/SVG2/interact.html#PointerEventsProperty) must also be preserved independently of what is visibly painted.
These constraints matter to the retained-gradient experiments below.

### Bounded experiments

All rows below are diagnostic controls; none is a production backend or complete visual/interaction qualification.

| Experiment                                                                     | Observed result                                                                                                                                                                             | Disposition                                                                                                                                                       |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frozen W4 straight dotted strokes painted by repeated gradients                | Thirty forced repaints fall from 9.45–9.83 seconds to 1.51–1.64 seconds. W6 improves only about 9% in the same small control.                                                               | Promising raster isolation, not active-graph evidence. The local-coordinate version changes export coordinate interpretation, hit coverage and edge antialiasing. |
| Gradient overlay retaining native marker and hit geometry                      | Exact final geometry matches. W4 active-frame p95 stays in roughly the 87–105-ms range, without a reliable improvement; the opacity-zero and unpainted hit-path variants are both retained. | Do not adopt the extra paths and state for an unproved interaction gain.                                                                                          |
| Promote W6's outer SVG layer during native detailed-view panning               | Baseline p95 about 20.9 ms; hint about 25.1 ms.                                                                                                                                             | Rejected for this scene/browser.                                                                                                                                  |
| Promote the SVG graph group or use its CSS 3D transform                        | P95 rises to 133.5–141.7 ms. The baseline return is about 20.9 ms.                                                                                                                          | Rejected; a GPU-related hint does not establish cheaper rendering.                                                                                                |
| Canvas link pass inside SVG foreign content                                    | P95 rises from about 20.7 to 133.4 ms.                                                                                                                                                      | Rejected.                                                                                                                                                         |
| Canvas link pass as a separate HTML layer, avoiding the per-update matrix read | The 1,215 links form 43 consecutive style-preserving batches. P95 is 25.2 ms versus 16.9–20.8 ms in the surrounding SVG controls.                                                           | Rejected as a standalone panning optimization. Native SVG markers, labels and hit paths still carry substantial work.                                             |

The Canvas controls preserve dotted/dashed patterns and path ordering; they are not solid-line controls.
The screenshots are retained, but spot checks do not establish complete visual parity.
The primitive substitutions exist only in external diagnostic scripts, and each successful run restores the drawing before its browser exits.

### Next experiment boundary

For a settled graph, test a bounded cache of the complete static drawing during panning, prepared outside the gesture where practical.
It must cover newly exposed content, keep the same resolution, invalidate on every relevant scene change and fall back safely when the cache cannot represent the view.
Measure preparation cost and memory as well as gesture frames.
Zoom, active physics, node movement, hover/selection changes, export and disposal must not consume a stale image.

When physics runs, most objects move and a static viewport cache is insufficient.
The retained trace separates force cost from SVG drawing; the next experiment must reduce that combined budget while preserving step-level geometry, responsive dragging and the existing currentness/lifetime rules.
A retained GPU scene or off-thread force calculation are candidates for a separately bounded experiment, not selected dependencies or promised gains.

### Results of the next opportunities — manifest 39

The [interaction follow-up](2026-10-24-active-graph-performance-follow-up.md#interactive-step-budget-and-static-cache--manifest-39) records the implemented drag scheduling change and complete static-image experiments.
One unchanged force step per frame during a current drag leaves more time for drawing; the existing two-step schedule returns after release.
The paired seeded W6 headless gesture observes p95 39.5 → 33.1 ms, with the same 953 nodes, starting position, 60-link class and 72 native pointer moves.
This is scoped evidence, not foreground qualification; the owner deferred foreground comparisons after an admission failure.

[MDN's Canvas performance guidance](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas#pre-render_similar_primitives_or_repeating_objects_on_an_offscreen_canvas) supports retaining expensive drawing as an image instead of repeating its drawing operations every frame.
The complete-image prototype demonstrates that mechanism: corrected W6 A/B/B/A controls reduce headless panning p95 from roughly 12.1 to 6.1–6.2 ms without dropping dotted/dashed notation.
However, the preparation path matters just as much as the gesture.
Computed-style deduplication reduces preparation from 529.6 to 249.7 ms, but yielding style collection in small tasks still leaves a 121-ms native SVG-image preparation long task.
The cache therefore stays outside product code.
Further work should bound image decoding/rasterization, then prove scene invalidation and lifetime behavior before adoption; general GPU hints or JavaScript yielding alone do not address this remaining cost.

The current browser does not expose the HTML-in-Canvas capability checked by the modern-web guidance, so no experimental API, browser flag or polyfill is selected.
The private drag scheduler uses the existing [D3 mouse/touch gesture model](https://d3js.org/d3-drag), including pointer identity and cancellation, rather than introducing a separate input system.

### Background preparation and click intent — manifest 40

The [manifest-40 follow-up](2026-10-24-active-graph-performance-follow-up.md#click-intent-and-background-cache-preparation--manifest-40) records the owner's next request, implemented gesture protection and improved external cache prototype.
The renderer waits for more than six CSS screen pixels before moving a node or reheating layout, and corrects the D3 subject callback to preserve the grab offset.
[D3's click-distance control](https://d3js.org/d3-drag#drag_clickDistance) suppresses the eventual click but does not delay drag callbacks, so an application-level intent gate is needed as well.
This protects Details clicks from small pointer movements without replacing the existing gesture system.

[Idle callbacks](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestIdleCallback) allow cooperative background preparation, but each callback still runs on the main thread and must stay bounded.
Splitting style collection alone was insufficient; splitting native SVG image preparation also removes the earlier observed long task in this control.
The prototype composites small fragments in paint order and includes only marker definitions actually referenced by each fragment.
All 1,188 used marker definitions remain represented, while serialized input falls to 2.63 MB across 57 chunks.
The final real-W6 headless control takes 423.3 ms overall, with no recorded long tasks, a largest 4.9-ms chunk and an 18.3-ms longest preparation animation-callback interval.
Cached-pan p95 is 5.8–5.9 ms versus 12.0 ms in the surrounding live SVG blocks.
This is a scheduling improvement over the 255.3-ms control with a 121-ms stall, not a claim that total preparation has become free or moved off-thread.

[OffscreenCanvas](https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas) can move supported canvas work to a worker, but it does not by itself move DOM/computed-style collection or establish support for the required SVG decoding path.
This Chrome rejects the tested SVG Blob through `createImageBitmap`; the successful prototype uses bounded native image batches on the main thread.
No new backend, browser flag, dependency or configuration is selected.

The complete-image cache still requires production cancellation, scene invalidation and visual/lifetime qualification before adoption.
Pure translation can reuse it; moving a node or changing visible state invalidates the image.
The live SVG must remain available throughout preparation and after invalidation.
Reduced accidental dragging avoids needless layout movement but does not remove appearance invalidation caused by selection or hover.
Foreground comparisons and the programme's existing acceptance limits remain open.

### Production cancellation and invalidation — manifest 48

The [production follow-up](2026-10-24-active-graph-performance-follow-up.md#production-pan-cache-cancellation-and-invalidation--manifest-48) implements the cache owner, cancellable incremental preparation, stale-result rejection and bounded SVG fallback.
Scene/appearance changes, node movement, active layout, scale/size/density changes and renderer retirement invalidate the image.
Translation can reuse a current image within its captured margin; export still clones the live SVG, and disposal releases owned images, URLs, observers and listeners.

The implementation passes 174 affected tests and bounded real-W6 native Chrome checks for display/restoration, cancellation, replacement, decode failure, timer fallback, density limits, export during panning and disposal.
The follow-up distinguishes completed probes from cases reached before a later failed assertion; failed receipts are preserved.
These are headless correctness checks, not fresh panning measurements or broad browser qualification.
The earlier approximately halved panning intervals remain prototype observations, and production foreground comparisons remain deferred.

### Foreground qualification and remaining cadence — manifests 50–51

The [latest follow-up](2026-10-24-active-graph-performance-follow-up.md#foreground-cache-qualification-and-deep-path-placement--manifests-5051) supersedes the deferred-production-timing status above.
Foreground testing exposed expensive Chrome layer construction beneath the opacity-only cache.
A viewport-relative empty scene clip removes that work while retaining the SVG viewport, geometry and accessibility; browsers lacking the exact capability keep ordinary SVG rendering.
Twenty native gestures per version reduce the median of gesture medians from 8.3 to 4.2 ms, while the median gesture p95 remains 8.4 ms.
The report preserves the baseline/candidate chronology, shared assets, 33.3-ms largest candidate interval and distinction from field performance.
Native Chrome and targeted Chrome/Firefox/WebKit checks cover restoration, input ownership, accessibility-name continuity, invalidation and disposal.

Forty independent W6 loads meet the scoped source-to-frame, seed, usable-drawing and settlement targets, but miss the strict active-frame target: the A/B distributions of per-load frame p95 reach 50.1/49.9 ms, with individual maxima of 54.2 ms.
No observed interval exceeds 112.6 ms.
The retained CPU exception does not authorize discarding those misses or lowering the target.

W4 additionally benefits from retaining topology when seeding a deep simple path.
Its old spiral placed adjacent nodes thousands of world units apart; folded incidence order starts every path edge at the existing spacing distance without changing the solver or notation.
The real W6 placement is unchanged.
Two foreground W4 observations improve to 62.5–70.8-ms frame p95; a camera-matched headless control corroborates a gain with all 2,000 nodes visible.
Neither evidence set closes the 50-ms stress requirement, and first-paint framing/overlap still needs its own observation.
The [consolidated source verification](2026-10-24-active-graph-performance-follow-up.md#evidence-and-remaining-closeout) completes the required stages, retaining an initial native JSON-tool failure and one stale CI-test assertion repaired through an eleven-test follow-up.
All 10,215 JavaScript tests are covered by the full run and that narrow repair; the production source and assets remain frozen.
On 24 October the owner selected **“Accept the documented cadence limitation.”** The [AC-104 disposition](2026-10-23-initial-layout-improvement-plan.md#ac-104-owner-disposition--24-october-2026) accepts the current delivery's measured W4/W6 cadence limitation without relabeling a miss as a pass or setting a new general target.
Further work toward 50 ms is no longer an acceptance blocker for this delivery.
The later [initial-paint and actual-glyph spacing repair](2026-10-24-active-graph-performance-follow-up.md#initial-paint-and-glyph-clearance--manifest-56) addresses the owner's rejection of touching class circles.
Manifest 56 passes headless native containment, clearances and first-frame position checks for W6-all, W6-auto and W4; a subsequent foreground W6 observation also confirms the prepared image.
The actual-device/AT batch remains pending.
Earlier full-suite and timing evidence remains attached to its original candidate, and the other acceptance conditions are unchanged.
