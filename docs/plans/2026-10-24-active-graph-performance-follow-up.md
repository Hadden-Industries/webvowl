# Active graph replacement and count-control follow-up

Date: 24 October 2026.

This bounded iteration profiles the remaining active-replacement and W4 long-frame issues from the [foreground report](2026-10-23-foreground-performance-results.md).
It also implements the owner's request to make the total available node count clickable.
Changes are uncommitted on `feat/architecture-performance-ui`, based on `b35e0ed6ffae6b2776b850a2931745d53544c1e2`.
The unrelated skill-reconciliation files remain outside this change.

## Implemented changes

1. Temporarily hold a running old drawing while its replacement is acquired and prepared.
   Overlapping loads transfer hold ownership; obsolete cleanup cannot resume the drawing.
   Failure or cancellation restores the old running choice, while a successful new load retains its own initial-layout request.
   Already paused or settled drawings are not reheated, and disposal cannot resume a retired renderer.
2. Read and restore Details scroll position only when Details is open.
   The previously unconditional read forced layout during count changes even with the panel closed.
   Focus and scroll preservation for open Details remain in place.
3. Make the total a native button that immediately selects `nodesShown: { mode: "all" }`, replacing a pending slider adjustment.
   It expands to all nodes available under the current filters and uses the same shortcut styling as “50”.
   It is unavailable while ordering is pending/failed, when no nodes are available, or when all are already requested.
   The button's action name and the slider's available-count description are separate accessible text.

The production force solver, scheduling, graph semantics and blur styling are unchanged.
The collector adds lightweight frame observation, preserves nested script attribution, and supports isolated blur controls and graphics tracing without CPU sampling.
These modes remain diagnostic and cannot establish latency acceptance.

## Profile and bounded observations

All evidence below is retained under `C:/Users/maksy/.hi/w/e/operator/16557566c924469fb5e117f2cfbe6e03`.
Production manifests 11–14 contain identical application bytes; subsequent differences are collector inputs.
Manifest 7 binds the earlier baseline application.
The owner's busy-host exception remains in effect, and foreground measurements still require actual visibility and focus.

| Observation                                        | Before                                    | After                                                                 | Interpretation                                                                                       |
| -------------------------------------------------- | ----------------------------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| W6 headless replacement, two measured traced loads | 4.943 / 5.401 s                           | 4.570 / 4.578 s                                                       | Diagnostic comparison, not foreground latency or a p95.                                              |
| Old drawing during the first measured W6 trace     | About 2,133 ms inclusive force-tick work  | Main thread about 3,748 ms idle; old ticks absent from leading stacks | Confirms removal of competing old-drawing work. Inclusive stacks must not be summed.                 |
| W6 foreground replacement, two measured loads      | Earlier 80-load cohort p95 was 5.487 s    | 4.254 / 4.260 s                                                       | Promising new observations, not comparable percentile populations. Two warmups were 4.281 / 4.637 s. |
| Comparable W4 quiet-period application script      | 153.9 ms, including 27.2 ms forced layout | 129.0 ms, with zero attributed forced layout                          | The closed Details read is removed. Separate observations do not establish a stable speedup ratio.   |

The corrected graphics trace independently observes a 121-ms main-thread count-application timer, followed by a 231-ms renderer raster command-buffer task in Chrome's GPU process, including a 105-ms raster flush.
These are nested process timings, not additive costs or hardware-GPU execution measurements.
They locate remaining rendering work beyond the removed JavaScript/layout cost.

W4 still has an observed **207.4-ms frame** overlapping the count window, with zero reported blocking duration and no attributed script.
Removing only the full-screen backdrop blur did not consistently improve timing.
Removing both blur layers still produced a 200.9-ms overlapping warmup frame and did not improve the measured quiet-period application script.
Neither control justifies a production styling change.
Empty dismissal LoAF arrays do not prove the absence of long frames: entries may be delivered after the two-frame measurement boundary.
The strict W4 200-ms acceptance requirement remains open.

## Retained evidence and verification

| Evidence folder                          | Purpose                                                                                                                                                    |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `active-replacement-W6-baseline-trace-1` | Old-drawing force-tick attribution.                                                                                                                        |
| `active-replacement-W6-held-trace-1`     | Replacement-hold diagnostic.                                                                                                                               |
| `W6-replacement-foreground-candidate-1`  | Foreground observations on the real 953-node Universal Ontology source.                                                                                    |
| `W4-foreground-frames-baseline-1`        | Original lightweight frame and script attribution.                                                                                                         |
| `W4-foreground-frames-candidate-2`       | Removed forced-layout read and retained 207.4-ms frame.                                                                                                    |
| `W4-foreground-frames-control-1`         | Full-screen backdrop-blur control.                                                                                                                         |
| `W4-foreground-all-blur-control-1`       | Both blur layers removed only in the diagnostic page.                                                                                                      |
| `W4-foreground-graphics-trace-2`         | Graphics attribution, no CPU profiles, no trace-buffer loss.                                                                                               |
| `count-shortcuts-native-4`               | Real Chrome pointer, Tab, Enter and Space activation; accessibility-tree names/descriptions; 32-by-32-pixel target; All intent and final count assertions. |

Failed attempts remain unchanged.
The first candidate foreground attempt lost focus and cannot qualify the completed cohort.
The first graphics attempt still enabled the collector's separate CPU profiler despite disabling trace CPU categories; its “without CPU sampling” label is incorrect and it is not used for that claim.
The second attempt disables both paths and contains no CPU profiles.
Earlier shortcut probes exposed a saved-view precondition mismatch and incomplete native Enter injection; the successful probe supplies normal character data and verifies pointer hit testing after focus scrolling.

Focused controller tests cover replacement success, overlapping failure, cancellation, explicit pause, settled drawings and disposal.
The Details regression first failed on the closed-panel read and then passed with open-panel scroll restoration intact.
Count-control tests cover All intent, pending-adjustment replacement, changed eligibility and unavailable ordering.
Affected presenter, controller lifecycle, count-adjustment, stylesheet and measurement tests pass, as do scoped JavaScript/HTML/CSS lint, formatting and the production build.
The existing large-chunk build warning remains.

No full suite, external review, commit, push or PR operation was performed for this iteration.
The previous full-suite result remains historical evidence, not a claim about this new uncommitted tree.
W6 replacement p95, W4's strict long-frame limit, other previously open comparisons and the actual-platform manual packet remain acceptance work for the final delivery.
Any further W4 optimization should target unnecessary SVG raster work and first prove visual/interaction equivalence; the present evidence does not justify changing the force solver or hiding graph information.

## W4 dotted-link raster follow-up

The next iteration isolates the cost to the long dotted subclass links in the fresh 2,000-node W4 drawing.
A paused drawing was translated by 0.25 SVG units on alternating animation frames, with the same geometry and viewport throughout eight controls.
The headless graphics traces contain no CPU sampling and are diagnostic repaint work, not foreground interaction latency or acceptance evidence.
The first headed attempt lost focus; its retained timings are excluded from the comparison.

| Diagnostic control                        | Twelve-frame repaint cycle |
| ----------------------------------------- | -------------------------- |
| Original drawing                          | 4.693 s                    |
| Hide text                                 | 5.059 s                    |
| Hide links                                | 0.163 s                    |
| Make links solid                          | 0.422 s                    |
| Remove arrowheads                         | 5.776 s                    |
| Hide nodes                                | 4.968 s                    |
| Encode straight links with a line command | 3.194 s                    |
| Restore original drawing                  | 5.125 s                    |

The solid-link control removes about 91% of this diagnostic cycle, while hiding text, nodes or arrowheads does not improve it.
This identifies dashed-path rasterization as the dominant cost; it does not authorize removing the dots.
The line-command control reduces the cycle by about 32% against the first baseline and 38% against the returning baseline.
Its median raster-flush event is 56.2 ms, versus 95.7 and 96.9 ms in the two baselines.
These process-event durations are not hardware-GPU measurements, and nested raster events must not be added together.

The retained production change is confined to `src/shared/js/util/math.js`.
For default-tension curves whose points and controls trace one straight segment monotonically, it emits `M … L …` instead of two quadratic segments.
The collinearity guard admits only floating-point roundoff, and the control-order guard rejects paths that double back.
Bent links, loops, coincident endpoints and non-default tension retain the previous path construction.
Endpoint positions, arrow direction, mathematical path length, dash styling, hit geometry, labels and layout behaviour are preserved.
No force, scheduling, CSS, dependency or configuration change is included.

The frozen visual comparison applies the actual candidate math to the baseline path coordinates; 1,931 of 1,999 paths qualify after parsing the existing rounded coordinates.
Overview, detail and farther-out screenshots preserve the drawing and were inspected before and after.
They are not pixel-identical: Chrome rasterizes line dashes differently from equivalent quadratic dashes.
Mean absolute RGB-channel differences on the 0–255 scale are 0.70 at overview, 3.20 at detail and 0.31 farther out; positions and styling remain unchanged.
The geometry tests cover horizontal, vertical, reversed and large-coordinate straight paths, uneven spacing, bends, backtracking, coincident endpoints and loop tension.

Production manifest 15 binds the candidate application.
Its foreground frame run completes all eight operations with no focus loss or application exception.
For the measured quiet-period count change, the largest observed overlapping frame is 160.6 ms, compared with 207.4 ms in the previous candidate observation; the application script is 117.1 ms versus 129.0 ms.
However, the new warmup still includes a 208.2-ms overlapping frame, and a load observation includes a 255.3-ms frame.
Measured dismissal takes 849.4 ms including input and painting, with a 302.6-ms application interval; this is not a consistent improvement over earlier observations.
The samples establish a useful bounded optimization, not closure of W4's strict 200-ms limit or a stable percentile improvement.

Retained evidence:

- `W4-raster-isolation-1`: headed snapshot-command inspection and the focus-lost first control.
- `W4-raster-isolation-2`: completed headless primitive controls and graphics traces.
- `W4-raster-visual-1`: frozen before/after screenshots at three scales and candidate path counts.
- `W4-straight-foreground-frames-1`: foreground interaction and frame observations on manifest 15.

All 115 focused math, link and renderer tests pass, together with scoped ESLint, Prettier and the production bundle build.
The existing large-chunk warning remains.
No full checks, external review, commit, push or PR change was performed.

## Representative mixed-ontology follow-up

The owner rejected the solid-link proposal on 24 October: VOWL's dotted and dashed relationship notation must be preserved.
No solid-link styling was adopted in production.
The earlier 91% diagnostic saving describes a synthetic graph containing 1,999 subclass links; extrapolating it to ordinary ontology use or recommending a notation change was not justified.
W6, the real extended Universal Ontology, is the primary representative workload for subsequent investigation; W4 remains a separately labelled stress case.
This changes the emphasis of the investigation, not the previously agreed acceptance criteria.

The exact source remains `C:/Users/maksy/GitHub/universal-ontology/dist/universal/extended/20260912-full`, 3,023,054 bytes, SHA-256 `d7eb7980436600ab50c8a5df35401a4a345fe4362d111f2d8e6f90217505b077`.
Production manifest 15 is unchanged.
With all 953 counted nodes displayed, the rendered graph has 1,215 links:

| Rendered relationship   | Count | Share |
| ----------------------- | ----- | ----- |
| Object property         | 654   | 53.8% |
| Datatype property       | 146   | 12.0% |
| Subclass                | 374   | 30.8% |
| Disjointness            | 27    | 2.2%  |
| Set-operator connection | 14    | 1.2%  |

These are rendered link counts, not a census of all axioms in the source ontology.
The drawing contains 800 solid, 374 dotted and 41 dashed paths, including 55 loops, together with 2,191 text elements and 1,188 arrowhead markers.
The median path length is approximately 99 SVG units.

The same twelve-frame frozen-geometry repaint sequence takes 277 ms, and 293 ms when repeated after the controls, with every VOWL stroke style intact.
Diagnostic removal of subclass links reduces the sequence to 231 ms; removal of other links gives 193 ms, text 193 ms, arrowheads 164 ms, and all links 128 ms.
These controls remove information only in the diagnostic browser, and none is a proposed product change.
Their costs overlap and must not be summed as independent shares.
The mixed graph does not reproduce W4's dominance by dotted-link rasterization.

A separate same-drawing geometry comparison preserves every computed stroke pattern and compares the retained line-command optimization with the previous quadratic representation.
In a sixty-frame reversal sequence, the two reference observations take 1.650 and 1.680 seconds; the current candidate takes 1.597 and 1.806 seconds.
A diagnostic variant limiting simplification to patterned strokes takes 1.577 and 1.614 seconds.
There is no consistent demonstrated W6 improvement from the earlier W4 geometry optimization, and this evidence does not justify another production change.
Its W4 stress-case benefit must not be presented as a general ontology speedup.

On 24 October the owner asked to retain straight-link encoding for its representation and maintainability value even without a demonstrated W6 speedup.
The recommendation is to retain the existing bounded implementation on that basis.
Both encodings are valid SVG; [`L` directly represents a straight segment](https://www.w3.org/TR/SVG2/paths.html#PathDataLinetoCommands), while [stroke dashing is specified independently](https://www.w3.org/TR/SVG2/painting.html#StrokeDasharrayProperty).
This makes the emitted path more direct and removes redundant curve segments; it is a small renderer cleanup, not a claim of a broader architecture improvement or less implementation code.
The collinearity and monotonicity guards remain necessary: visual straightness at a particular zoom is insufficient, and replacing a reversing collinear curve would change its length and dash progression.
Preserve curved links, loops, endpoint markers and the existing dotted/dashed notation, including the previously recorded rasterization differences.
The production comment now states that geometric purpose rather than implying that a particular rasterization saving is guaranteed.
No behavioral change or additional performance run is needed for this rationale update; the existing focused tests and visual evidence remain applicable.

### Native foreground observations

All runs preserve the production VOWL styles, use the real source above and the owner's busy-host exception, and retain visibility/focus checks.
The bounded observations are not percentile qualification or a matched before/after improvement claim.

| Operation                                         | Observed time                                                                                                  | Long-frame evidence                                                                                 |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Two measured fresh all-node loads                 | 4.270 / 4.299 s                                                                                                | 562.5 / 519.0-ms frames; principal scripts 514.3 / 474.0 ms, including 88.8 / 86.2 ms forced layout |
| Quiet-period small count change                   | 97.6-ms application interval; 1.187 s including the deliberate one-second batching delay and frame observation | 85.9-ms overlapping frame                                                                           |
| Small count change completed by Filters dismissal | 198.4 ms; 98.9-ms application interval                                                                         | 85.3-ms overlapping frame                                                                           |
| Native total-count button: 50 → 953               | 331.5 ms from click to the two-frame boundary; state publication after 243.0 ms                                | 298.4-ms frame; 243.1-ms principal script including 59.1 ms forced layout                           |
| Native “50” button: 953 → 50                      | 94.0 ms; state publication after 82.6 ms                                                                       | 86.9-ms frame; zero attributed forced layout                                                        |

Both native count shortcuts reach the requested final count with no focus loss.
The larger 50-to-all jump exposes materially more work than a one-node adjustment and must be retained in representative iteration checks.
The next investigation should target initial/expanded SVG construction and the associated synchronous layout work, while preserving all relationship notation.
The current observations do not establish that every real-world interaction meets the 200-ms frame limit.

Evidence remains under the common external root:

- `W6-mixed-raster-isolation-1`: rendered relationship census, screenshot and primitive-removal graphics diagnostics.
- `W6-mixed-geometry-comparison-1` and `W6-mixed-geometry-comparison-2`: paired geometry-only controls, including the longer reversal sequence.
- `W6-mixed-foreground-frames-1`: four all-node loads and four native small count changes, including warmups.
- `W6-native-count-jumps-1`: foreground native 50 → 953 → 50 button interactions and script/layout attribution.

No production code, configuration, line styling or dependency changed in this follow-up.
Existing focused code checks were reused; only this report's formatting and Markdown checks were refreshed.
No full checks, external review, commit, push or PR change was performed.

## Initial crowding and distance-aware preparation

The owner subsequently requested better prepared positions on W6 and explicitly required initial spacing to follow the Class distance and Datatype distance settings.
This continues the approved fresh-load initialization envelope in PERF-DEC-013.
It changes neither the force solver nor its scheduling, and retains supplied positions, saved visualizations, pins, later count-change positions and VOWL relationship notation.

The minimized regression is a 64-leaf connected cluster: the previous fixed-radius radial tree puts neighboring centers only 19.63 world units apart, although ordinary class circles are 100 units across.
The new regression failed against that implementation before the repair.
The radial tree supplied angular grouping but did not reserve enough space for broad levels.

The application now supplies the existing class/datatype distance values separately to the temporary tree.
An edge incident to a datatype uses Datatype distance, matching the renderer's existing policy even if that setting exceeds Class distance.
Pure-class components no longer inherit an unrelated larger datatype setting, and pure-datatype components no longer inherit Class distance.
Defaults remain owned by `visualizationDefaults.js`; no setting or configuration file is added.

The coordinate helper retains uncrowded starting points and moves crowded points into nearby available cells.
Its clearance scales with the same distance settings; it is a placement heuristic, not a second force law or a promise that every visible edge has exactly its requested final length.
The existing spacing-only scale reserves half the requested distance across each node; rendered datatype text and incidence-centered set operators can still exceed that estimate.
All packing state is temporary to one component and is released after preparation.
Previously exhausted search rings are reused within that calculation because occupancy only grows; this avoids repeatedly searching a full dense hub for each new leaf.

### Observed geometry and limits

| Observation on the real W6 ontology                                              | Previous radial seed | Candidate           |
| -------------------------------------------------------------------------------- | -------------------- | ------------------- |
| Full-graph native pre-DOM glyph overlap pairs                                    | 4,565                | 15                  |
| Full-graph median cumulative model travel over the unchanged 299-step relaxation | 3,977.9 world units  | 3,563.1 world units |
| Automatic 50-node median cumulative model travel                                 | 1,045.0 world units  | 935.7 world units   |
| Actual Chrome prepared node overlap pairs, after native label sizing             | 4,531                | 42                  |
| Actual Chrome prepared class-circle/class-circle overlap pairs                   | 3,928                | 0                   |
| Actual Chrome seed preparation, one diagnostic load each                         | 10.2 ms              | 28.0 ms             |

The browser result is a 99.1% reduction in initial node-overlap pairs, not a claim that the diagram is free of all overlapping text, labels or links.
The 42 remaining pairs involve datatype boxes and set-operator nodes.
The fixed-step model travel improves by approximately 10% in both W6 count modes; it is diagnostic evidence of less rearrangement, not a measured wall-clock speedup.
The existing solver can still create overlaps during relaxation.
In the paused/resumed browser diagnostic, settled overlaps were 184 before and 181 after; observed relaxation took 10.76 and 13.87 seconds respectively on the contended host.
Those single headless observations do not establish faster settlement or satisfy the ordinary foreground settlement gate.

The initial alternative with nested circle packing eliminated model overlaps but expanded W6 to about 26,000 world units across and increased travel substantially, so it was rejected.
A full grid and a wider local-spreading variant improved the full graph but increased travel in the initial 50-node view.
The integrated local correction improves both W6 views without those large extents.
The W5 core diagnostic retains only 13 initial model-overlap pairs and approximately 2,550 world units median full-graph travel; this is additional shape coverage, not a new acceptance workload.

A 2,000-leaf star exposed a 516-ms median preparation cost in the first local-spreading prototype.
Reusing exhausted search rings reduced that diagnostic median to 39.8 ms, with a 45.6-ms maximum over ten observations; the chain fallback and isolated-node cases remained below 11 ms.
These are pure initializer diagnostics and exclude scene cloning, browser rendering and foreground admission.
No linear-time complexity or universal timing guarantee is claimed.

Evidence under the common external root includes `W6-spacing-experiment-v2.json`, `W6-spacing-experiment-v3.json`, `W6-spacing-candidate-v4.json`, `W6-spacing-candidate-v5.json`, `W5-spacing-candidate-v5.json`, both `spacing-shape-cost` records, and `W6-initial-spacing-baseline-1` / `W6-initial-spacing-candidate-1` with actual prepared/relaxed screenshots.
The v5 W6 model run overlapped a bundle build, so its preparation durations are not isolated timing evidence; its deterministic geometry results remain useful.
Production manifest 16 binds the integrated initializer and unchanged VOWL stroke counts: 800 solid, 374 dotted and 41 dashed paths.

The six focused lifecycle, scene, initializer, adapter and unchanged-force suites passed 171 tests before the final search-cache optimization.
After that optimization and the mixed-distance scaling regression, the three directly affected initializer/scene suites passed all 28 tests.
Scoped ESLint, Prettier and the production bundle build passed; the build retains its existing large-chunk warning.
The earlier missing-brace lint findings were corrected without changing lint policy.

The production initializer was then observed through ordinary foreground source loading with no pre-observation pause or reheat:

| W6 display mode     | Source-to-frame | Seed preparation | Admitted-data-to-usable drawing | Natural settlement |
| ------------------- | --------------- | ---------------- | ------------------------------- | ------------------ |
| Automatic, 50 nodes | 4.102 s         | 27.3 ms          | 333.7 ms                        | 1.580 s            |
| All 953 nodes       | 4.784 s         | 28.3 ms          | 628.1 ms                        | 11.313 s           |

Both runs retained actual visibility/focus, completed with no recorded browser exceptions, and retained the requested node count.
These are one observation per mode under the owner's busy-host exception, not matched before/after timing cohorts or accepted p95 gates.
They do not establish a whole-load speedup; the additional seed work improves initial geometry.
The initial viewport observation still records one outside node in automatic mode and sixteen in all-node mode; this change does not add culling or continuously refit force motion.
The records are `W6-spacing-foreground-auto-1` and `W6-spacing-foreground-all-1`.
An initial collector invocation selected the headless-only diagnostic mode for a foreground run and was rejected before browser launch; the actual observations use the existing latency mode with one diagnostic cohort.

Initial SVG construction, larger count-expansion frames, remaining datatype/operator and label overlaps, and the earlier programme's formal/manual acceptance remain open.
No full checks, external review, commit, push or PR change is authorized or performed for this iteration.

## SVG construction and reuse-comparison follow-up

The next iteration profiles the real W6 native 50-to-953 expansion using production manifest 16.
The instrumented click task took 261.1 ms: drawing and its text-layout batch accounted for approximately 158.5 ms, including 77.8 ms in SVG construction.
Native width reads accounted for 46.7 ms of sampled self time and native text bounding-box reads for 17.3 ms.
The long-frame observer attributed 65.6 ms to forced style/layout inside the principal script.
These are headless attribution observations, not foreground acceptance or percentile estimates.

Individual-probe containment, a shared contained measurement host, and deferring new group display until text completion did not reduce the observed work enough to justify adoption.
Those variants remain external diagnostics; none changes the shipping CSS, native width oracle, truncation algorithm, font measurement or graph visibility.
The first deferred-group diagnostic intercepted append operations but missed D3's insert-before path; its corrected diagnostic also failed to improve the result.
The `performance` and `interactions-in-complex-layouts` guidance informed those rejected isolation experiments; it does not establish a benefit for SVG containment here.

The retained changes remove specific unnecessary work:

- Fresh text blocks, text spans and link paths initialize their classes in one attribute write.
  Endpoint, contrast, dotted/dashed and other style classes remain the same.
  Both text implementations share the span initialization helper.
- Node and property drawing already installs hover listeners.
  The enclosing drawing loop now refreshes listeners only for retained elements, avoiding immediate replacement of fresh listeners.
  Retained inverse-property labels refresh both directions, preserving current-generation interaction guards.
- Recursive drawing comparison reuses one private empty exclusion set and skips filtering key arrays when there are no omitted fields.
  Field comparison and reuse eligibility remain unchanged; hashes and object identity do not replace structural comparison.

The listener regression failed before the repair: a newly drawn node installed its mouseover listener twice instead of once.
It now verifies one initial installation, one refresh per retained revision and one installation for a reintroduced node.
A separate regression checks current and expired hover callbacks on retained inverse labels.

### Evidence and measured limits

On the real W6 canonical drawing, an alternating Node diagnostic compared the original and final comparison implementations over 40 measured batches of eight comparisons each, after ten warmup batches.
Temporary `Set` allocations per successful comparison fell from 48,927 to 3.
Median comparison time fell from 4.03 ms to 2.99 ms, approximately 26%; this excludes source admission, SVG construction, layout and painting.
The diagnostic retains the source and fixture hashes in `W6-reuse-comparison-2.json`; the intermediate allocation-only result is retained separately.

The Chrome trace for the class/listener candidate recorded native class-list self time of 7.4 ms versus the initial 16.7 ms.
However, its complete instrumented click task took 337.1 ms versus 261.1 ms, and other phases also slowed on the contended host.
These observations establish less targeted work, not an end-to-end speedup or completion of the 200-ms interaction target.
A subsequent foreground attempt could not obtain focus and was rejected before measurement; no foreground timing is claimed for this iteration.

The final production bundle is bound by manifest 19.
Chrome local text geometry, rectangle geometry and link classes/styles match manifest 16 exactly for initial all-node drawing, return to 50 and expansion back to all.
The full drawing retains 2,191 text elements and 1,215 links, including the established VOWL stroke patterns.
All 2,154 displayed node/label elements have both hover bindings after expansion, and no measurement probes remain.

Six focused suites passed all 55 tests after the class/listener changes.
The 32 renderer editing/reuse tests passed again after the comparison optimization, and the final contrast initializer passed its two focused tests.
Scoped ESLint, Prettier and production bundle builds passed; the existing large-chunk warning remains.
No full checks, external reviews, configuration changes, commits, pushes or PR changes were performed.

Evidence under the common external root:

- `W6-svg-draw-profile-1`, `W6-svg-containment-probe-1` / `-2`, and `W6-svg-deferred-groups-probe-1` / `-2`: initial attribution and rejected controls.
- `W6-svg-construction-baseline-1`, `W6-svg-construction-candidate-1` / `-2`, and `W6-svg-construction-comparison-1.json` / `-2.json`: native geometry/style comparison and final hover-binding census.
- `W6-svg-construction-profile-1`: instrumented class/listener candidate; this predates the final comparison optimization.
- `W6-svg-construction-foreground-1`: rejected foreground admission, retained without a timing claim.
- `W6-reuse-comparison-1.json` / `-2.json`: isolated allocation and comparison-cost diagnostics using the real ontology.

Native text measurement/layout and the remaining synchronous drawing/model preparation remain the larger targets.
The unsuccessful containment experiments should not be repeated without a new mechanism or changed evidence.

## Scene preparation and layout-status follow-up

This continuation starts from checkpoint `14d873d25419c1222ad4ee025419a2e68b518d06`.
The owner also authorizes bounded code-quality corrections without requiring a performance gain.
The real W6 ontology remains the representative workload; VOWL strokes, label measurement, force behavior and scheduling are unchanged.

Private scene updates now retain unchanged values and copy changed placements before atomic publication.
Presentation proposals likewise retain unchanged private placements; their public previews remain independent copies.
The session returns its already-owned committed preview instead of taking another complete snapshot.
Validation, failed-publication recovery, expired proposals, negative-zero coordinates, caller mutation isolation and lazy document-field ownership remain covered.
This removes unnecessary copying without introducing a persistent cache or weakening an input boundary.

One redundant empty SVG marker-definition container was also removed.
Its removal is a code-quality correction, with no material speedup claimed.
An additional native check exposed a pre-existing status bug: a view-API pause stopped the renderer but could leave controller state reporting `relaxing`, because the stopped simulation emitted no further tick.
View layout commands now publish the actual renderer status after paint; a superseded command still cannot overwrite a newer explicit choice.

### Diagnostic results and preservation

Each count operation previously copied the complete 2,127-placement scene seven times; the optimized path copies it three times.
Six measured samples per direction, following two warmups, produced these headless instrumented medians:

| W6 count operation      | Baseline scene-copy time | Optimized scene-copy time | Baseline operation | Optimized operation |
| ----------------------- | ------------------------ | ------------------------- | ------------------ | ------------------- |
| All to automatic 50     | 8.50 ms                  | 3.50 ms                   | 85.30 ms           | 78.05 ms            |
| Automatic 50 to all 953 | 9.00 ms                  | 3.55 ms                   | 227.95 ms          | 208.40 ms           |

These small sequential samples establish reduced copying and diagnostic observations, not a foreground speedup, a p95 estimate or acceptance of the 200-ms target.
Manifest 21 binds the final scene optimization; manifest 22 adds the status-reporting repair, which does not execute on count-only requests.
The remaining large costs are SVG construction and native text/style/layout work.

Matched native-browser runs of checkpoint manifest 19 and final manifest 22 have exactly equal text, rectangle and link-style observations for initial all-node drawing, return to 50 and re-expansion.
The full graph retains 2,191 text elements, 1,215 links and 1,188 resolved arrow markers; the single marker container also survives reuse.
Running count changes retain `relaxing`; paused count changes retain `paused` after the reporting repair.
No browser exceptions were recorded in the final run.

An initial comparison against an older saved capture found label-centering differences.
Fresh execution of the unchanged checkpoint also differed from that historical capture; comparison with the freshly observed checkpoint passed exactly, without tolerances or geometry normalization.
The baseline and intermediate candidate also reproduced the stale pause-status failure, which the final candidate fixes.
All failed records remain retained.

Probe pooling reduced temporary-element creation but did not show a consistent timing improvement and added lifetime complexity, so it was rejected.
Checking SVG attributes before every write was also rejected: during running layout almost every position/path changed, leaving little redundant work to remove.
Neither experiment remains in product code.

The six focused scene, session, controller, adapter, render-element and renderer-editing suites passed 204 distinct tests across their affected revisions.
Scoped ESLint, formatting and production builds passed; the existing large-chunk warning remains.
No full checks, external reviews, configuration changes, commits, pushes or PR changes were performed.

Evidence under the common external root:

- `W6-text-probe-reuse-1` through `-3`, `W6-rendering-writes-1`: rejected controls and native traces.
- `W6-scene-preparation-baseline-1`, `W6-scene-preparation-candidate-1` / `-2`: copying counts, timing observations and traces; candidate 2 retains the later historical-capture comparison failure separately from its completed samples.
- `W6-scene-preservation-baseline-1`, `W6-scene-preservation-candidate-1` / `-2`: matched visual comparison, reproduced status failure and final passing native checks.
- `rendering-scene-preparation-summary.json`: exact comparison and diagnostic medians.

After the first failed probe setup, all subsequent runs reused the same task-owned Chrome profile.
The profile is released by Chrome on exit and remains held for the previously blocked native cleanup process; no user browser profile was used.

## Fixed marker geometry follow-up

A fresh W6 expansion census found 6,102 width-hint requests but only one unused unique hint.
The existing draw-local width cache already removes repeated native reads; expanding that cache's lifetime is not part of this iteration.
The same expansion created 1,104 markers and made 8,846 observed marker-related `setAttribute` calls.

Arrow and diamond construction now share one private module.
It initializes at most four detached geometry templates per document and clones the required shape for each property.
Every mounted marker still owns its ID, D3 datum, path classes and hover state.
The templates retain no property, drawing, font measurement or event-handler references; their document keys are weak.
This removes duplicated constructors and fixed-attribute setup without sharing live marker state.

In matched native Chrome observations, the expansion's marker-related attribute calls fell from 8,846 to 1,111.
The candidate cloned 1,104 independent markers and initialized one additional shape template; the initial automatic drawing had already initialized the other required shape.
The final full graph still contains 1,188 markers with resolved references and correct owning-property bindings.
Actual property hover affected its own marker and cleared on mouseout.

Text and rectangle geometry, link classes and computed styles, marker attributes, marker paths and marker computed styles match exactly across initial all-node drawing, return to automatic 50 and re-expansion.
The full graph retains 2,191 text elements and 1,215 links, including all VOWL dotted and dashed styles.
Running and paused count changes retain their requested layout status, with no recorded browser exceptions.

Six uninstrumented application samples per direction, after two warmups, gave these headless diagnostic medians:

| W6 count operation      | Baseline manifest 22 | Candidate manifest 23 |
| ----------------------- | -------------------- | --------------------- |
| All to automatic 50     | 68.25 ms             | 68.00 ms              |
| Automatic 50 to all 953 | 196.05 ms            | 192.40 ms             |

The small timing difference does not establish a user-visible speedup, foreground latency, p95 acceptance or completion of the interaction target.
The retained benefits are less fixed setup work and one implementation of marker geometry.
Native text/style/layout work remains a larger cost.

All 37 focused arrow, diamond and renderer-editing/reuse tests pass.
They cover inverse geometry, independent properties and classes, document isolation, mounted-marker mutation isolation, and reuse/recovery behavior.
The DOM fixture needed a correction because xmldom copies JavaScript expando methods during cloning, unlike a browser; its bound insertion shim could otherwise mutate the source while cloning.
Two affected test runs were interrupted before that fixture repair; the repaired focused suites complete normally.
An initial missing-brace lint finding was corrected, and scoped ESLint, formatting and the production build pass with the existing large-chunk warning.

Evidence under the common external root:

- `W6-rendering-census-1`: width/shortening/marker census and native expansion trace.
- `W6-markers-baseline-1`, `W6-markers-candidate-1`: matched geometry, styles, ownership, hover, layout-state checks, screenshots and diagnostic samples.
- `rendering-markers-summary.json`: exact preservation comparison and medians.
- `rendering-markers-baseline-index.js` and production manifests 22/23: immutable baseline entry and source bindings; only the application entry differs.

All Chrome runs reuse the existing task-owned diagnostic profile.
No full checks, external reviews, configuration changes, commits, pushes or PR changes were performed.

## Original-plan continuation: renderer drawing ownership

The next change continues S5's producer-boundary ownership and S8's reuse/recovery obligations.
The public adapter already validates, owns and deeply freezes each drawing request.
Its private renderer nevertheless cloned that complete drawing again solely for reuse comparison and recovery.
The only production caller is the adapter; materialization reads the drawing and keeps mutable positions on separate render primitives.
The renderer now retains that owned drawing unchanged.
Failure recovery still clones the accepted drawing before applying live positions and camera state, then transfers its private reconstruction to preparation.
Both private entry points and the public request constructor now document these ownership duties.

The new real-renderer regression first failed on the redundant mount copy.
It now verifies no additional whole-drawing copy on normal mount/revision, caller mutation isolation through the real request constructor, unchanged admitted positions after runtime movement, and exactly one mutable reconstruction on failed publication.
The adapter tests separately prove deep freezing at mount and revision admission.
One recovery fixture previously mutated its own accepted input in place; it now constructs a separate next request, matching the actual adapter boundary.
An initially incorrect arrangement key in the new test was corrected to the existing `node:a` contract.
All 157 affected renderer, adapter, request-contract and materialization tests pass, along with scoped lint/formatting and the production build.

### Native comparison and lifetime

Production manifests 23 and 24 bind the before/after candidates.
In real W6 count changes, full drawing copies fall from two to one per revision, each covering 953 node rows, 1,204 edge rows and 1,174 label rows.
The removed private copy took 9.5–9.8 ms in three baseline observations.
The public boundary copy remains; no external validation, mutation isolation or recovery guarantee is removed.
Exact native text/rectangle geometry, link/marker attributes and styles, independent hover, reference resolution, and paused/running status match across initial all-node drawing, return to 50 and expansion.

Six samples per count direction, after two warmups, observed headless application medians of 90.95 to 60.60 ms for all-to-50 and 239.05 to 175.50 ms for 50-to-all.
These sequential busy-host observations vary more than the removed copy cost, so they do not establish a causal end-to-end speedup or a foreground acceptance result.
The deterministic improvement is one fewer document-sized ownership copy on every revision.

The existing full W6 lifetime probe passes both retained-result controls and ten equal-live-size load/edit/capture cycles, with zero retired inspection/projection/read-model owners and zero workers after each cycle and disposal.
A separate drawing-specific weak-reference probe detects an intentionally retained old drawing, releases it, then performs ten 51-to-50 cycles.
Only the current drawing remains alive after each cycle; all 22 tracked drawings are collectible after disposal.
This tests the ownership affected by the change directly rather than inferring it from overall heap size.

The first lifetime launch mistakenly used the external runner's unconditional raster-probe branch and failed before lifetime collection.
The retained corrected companion runner dispatches to the repository's existing lifetime and count procedures, reusing the same profile; no product or configuration change was needed for that collector correction.

Evidence under the common external root:

- `W6-drawing-ownership-baseline-1`, `W6-drawing-ownership-candidate-1`, `rendering-drawing-ownership-summary.json`: source-bound native preservation, drawing-copy counts and diagnostic observations.
- `W6-drawing-ownership-lifetime-1` / `-2`: failed collector selection and completed ten-cycle lifetime proof.
- `W6-drawing-retirement-1`: drawing-specific retained-owner control, ten revision cycles and disposal.
- `rendering-ownership-baseline-index.js`, production manifests 23/24: retained baseline entry and candidate identities.

The original plan's remaining acceptance work is tracked in [its current programme section](2026-10-21-performance-implementation-plan.md#10-original-programme-continuation--24-october-2026).
Full checks remain reserved for the final commit; no commit, push, external review or PR mutation accompanies this continuation.

### Remaining original-plan measurement gates

The optimized manifest-24 W4 stress diagnostic completes one warmup and one measured quiet/dismissal pair on fresh running drawings.
Both measured operations apply only the final 1,999-node count and preserve document identity and running intent.
Quiet-period application-to-frame is 268.6 ms, excluding the intentional delay; dismissal input-to-frame is 329.8 ms.
The observer's recorded overlapping long-animation-frame entries are 72.1 and 67.3 ms respectively; earlier buffered entries are retained separately by their timestamps.
The graphics traces report no buffer loss.
These two headless observations do not qualify the original strict foreground LoAF criterion or a percentile budget, and W4 remains a synthetic stress case rather than a substitute for W6.
Raw evidence is `W4-plan-long-frames-1`.

The subsequent uninstrumented W6 foreground count/replacement attempt, `W6-plan-foreground-count-1`, fails admission before collecting samples.
The Windows observation records an unsuccessful activation request; its foreground process resolves to `LockApp`.
The desktop must be unlocked before the remaining foreground gates can run.
The failed receipt is retained, the owned browser exits cleanly, and no headless timing is relabelled as foreground acceptance.
No further foreground attempt was warranted until that condition changed.

## Remaining rendering investigation and foreground qualification

The desktop subsequently admitted foreground Chrome, and the owner requested continuation of the outstanding performance criteria.
Every run below reuses the existing task-owned Chrome profile and retains the CPU exception, actual focus/visibility checks, production manifests, correctness assertions and failed attempts.
Builds and tests are not run concurrently with these measurements.

### Rejected experiments and retained label-order improvement

A fresh real-W6 native-button trace attributed about 74 ms of a 249-ms expansion task to forced style/layout work.
Prewarming label-shortening widths before SVG construction preserved exact geometry but changed the measured application median only from 206.0 to 198.1 ms in four pairs, with unchanged native-read counts and an extra measurement round in the traced case.
The additional speculative width work and shape coupling were not retained.
Its 48 focused tests and both before/after observations remain evidence of the experiment, not a delivered optimization.

The first complete W4 foreground frame cohort recorded four frames above 200 ms across 40 count operations, with a maximum of 228.2 ms; all four occurred during Filters dismissal.
A two-frame dismissal prototype passed 47 focused timing/currentness tests and separated most closing work from graph application, but its complete cohort still contained three frames above 200 ms, including two quiet-period applications.
The prototype's maximum was 284.7 ms, and one animation callback still shared a delayed frame with rendering.
That scheduling change and its tests were reversed precisely; production keeps its original dismissal timing and solver scheduling.

The subsequent W4 application trace and native DOM census found an independent, deterministic defect in bounded reuse.
Every count revision first restored canonical label order, then prepended each subclass label to restore its lower stacking position.
A one-node reduction moved 3,995 retained label groups even though their required final order had not changed.
The renderer now computes the final order before the keyed join: subclasses in the existing reversed order, followed by other visible labels in their existing order.
The join moves only groups whose final positions changed, including restoration after hover foregrounding.
The same census now records zero retained-label moves; four editor-group insertions remain.
No force parameter, geometry, line style, public request contract or configuration changes.

The regression test first failed on the unnecessary moves, then passed with unchanged mixed subclass/property stacking, retained DOM identity, hide/show behavior and hover-order recovery.
All 100 affected renderer, adapter and seam tests pass, along with scoped formatting/lint and the production build; the existing chunk-size warning remains.
The matched native W6 comparison preserves exact text/rectangle geometry, link/marker attributes and computed styles, resolved marker references, independent hover, and running/paused intent across expansion, return to automatic 50 and re-expansion.
An initial comparison used different initial count modes and was rejected; the matching automatic-mode comparison passes.
The small sequential headless timing samples are not a speedup or percentile claim.

### Completed W5 relative-revision comparison

Four sequential ABBA blocks compare the retained architecture baseline with optimized manifest 27, using ten measured samples per block and one discarded warmup per run.
Both versions start from a freshly loaded, explicitly paused W5 all-node drawing; no settled/fresh or running/paused preconditions are mixed.
Each version contributes 20 samples per operation.

| Operation                | Baseline median / p95 | Optimized median / p95 | Median reduction |
| ------------------------ | --------------------- | ---------------------- | ---------------- |
| Count revision           | 1,871.0 / 2,033.6 ms  | 86.3 / 91.4 ms         | 95.4%            |
| Datatype filter revision | 1,423.3 / 1,612.9 ms  | 82.9 / 90.7 ms         | 94.2%            |

This closes the matched half-baseline requirement for those operations and preconditions under the CPU exception.
The comparison predates the final label-order improvement; its measured source remains manifest 27, not an invented result for every later candidate.
The original architecture baseline is bound by its retained manifest and source metadata, not the collector checkout's current HEAD.
No new baseline repository or browser profile was created.

### W4 frame criterion passes with final-order joining

Manifest 29 completes 20 measured fresh-running cohorts after the discarded warmup: 40 native count operations with 117 overlapping LoAF entries.
None exceeds 200 ms; the maximum is 183.0 ms.
All three native inputs reach each adjustment, only the final count is applied, document identity is preserved, and layout resumes in the requested running state.
There are no browser exceptions or foreground losses, and the owned browser exits normally.
The CPU readings span 8.0%–39.1% busy under the recorded exception.

Quiet-period application-to-frame p95 is 378.1 ms, and dismissal input-to-frame p95 is 420.5 ms, each from 20 measured operations.
These satisfy the one-second response target as well as the observed strict 200-ms frame gate.
The evidence is `W4-label-order-foreground-frames-1` and `remaining-W4-label-order-summary.json`.
The deterministic claim is removal of redundant DOM moves; sequential cohort timing differences do not isolate a causal speedup from host variation.

### W5 first-search criterion passes

Manifest 29 completes 40 fresh paused W5 automatic-load/first-query cohorts, split into 20-sample A/A groups.
Each native query must paint actual results; loading and ordering preparation are outside the search window.
Search p95 is 23.0 ms in A and 28.9 ms in B, below the 100-ms B5 target; pooled median is 20.65 ms and pooled p95 is 25.2 ms.
The corresponding load observations are retained separately and are not W6 replacement evidence.
The run is `remaining-search-W5-auto-candidate-1`, with `remaining-search-summary-v2.json` binding the samples, groups, harness and manifest.

### W6 replacement remains borderline

On manifest 27, all 80 measured running-graph replacement loads complete correctly, with median 4.414 seconds and pooled p95 4.912 seconds.
The separate 40-sample A/A p95 values are 4.868 and 5.081 seconds; four of the 80 observations exceed five seconds.
Because one calibration group remains over the target, this does not establish a stable five-second acceptance result for replacement.
No samples are discarded or added merely to cross that threshold.
CPU preflight readings range from 7.0% to 89.3% busy, but that observation alone does not assign the slow samples' cause to contention.

The same W6 cohort passes the count-response target: p95 is 248.7 ms from quiet-period application to the observed frame, and 532.0 ms from the first dismissal-burst input to the observed frame.
The intentional one-second quiet period is excluded only from the former metric.
All final-count, single-application, document-identity and running-layout assertions pass, with no browser exceptions.
Ordinary-load acceptance from the earlier report remains separate from replacement.

The predeclared final-renderer cohort on manifest 29 subsequently completes 40 replacement loads, split into two 20-sample groups.
Median is 4.914 seconds and pooled p95 is 6.826 seconds; A/A p95 values are 6.826 and 6.308 seconds, with 19 loads above five seconds.
This misses the replacement target; no slow observation is excluded.
The CPU preflight range is 19.9%–78.5% busy, which does not by itself establish the cause of individual slow loads.
Both count-response gates still pass: quiet-period application p95 281.6 ms and dismissal p95 668.7 ms, with every correctness assertion passing, no browser exceptions and normal browser exit.

A separate headless trace of the measured replacement load records 4,738.0 ms and no trace-buffer loss.
Its explicit phase boundaries attribute 1,511.4 ms to OWL loading, 546.4 ms to assessment, 738.6 ms to model building/retention, 736.3 ms to the live-admission gap and 188.8 ms to checkpoint creation.
Those worker phases total about 3.72 seconds, or 78.5% of this traced operation.
Initial drawing takes 574.2 ms and the remaining observed-frame boundary 98.0 ms; startup/dispatch and reply/admission gaps are recorded separately.
This supports focusing the next load investigation on OWL/model preparation rather than attributing the full delay to SVG.
It does not prove that CPU contention caused the slower foreground samples or qualify the five-second gate from a traced sample below that threshold.
Sampling records small negative deltas and overlapping inclusive stacks, so source-level sample weights remain diagnostic; the explicit phase durations are the primary attribution.

### Small-input comparison and remaining initial-layout gates

The complete W1 ABBA comparison uses manifest 29 and the same retained architecture baseline, with 20 measured samples per version for each of 15 operations.
Every operation passes both median and p95 regression guards of baseline plus the greater of 10% or 25 ms.
Load p95 falls from 785.7 to 473.0 ms, count revision from 76.2 to 17.4 ms, filter revision from 52.2 to 19.8 ms, selection from 17.3 to 16.4 ms, and search from 11.0 to 7.5 ms.
All ten consecutive edit positions also pass, preserving the observed revision and label assertions.
This is the scoped 15-operation comparison, not the entire original 19-operation S0 census.

W2 completed seven baseline cohorts before Chrome lost foreground during the eighth cohort's fourth edit.
The collector stopped, retained its failed report and exited the owned browser normally.
Only complete cohorts enter the derivative summary; the eight completed operations from the interrupted cohort remain explicitly excluded.
W2 candidate/completion blocks and W3 remain unqualified.
The subsequent desktop inspection found GitHub Desktop in front, so foreground availability was requested before resuming.

The [initial-layout plan's AC-102/104/109](2026-10-23-initial-layout-improvement-plan.md#6-requirements-proposed-acceptance-and-quality-scenarios) remain additional obligations for W4/W5: initial usable frame, active frame cadence and settlement, and seed preparation.
The W4 count-operation LoAF result cannot establish initial-layout frame intervals or the 12-second settlement target.
Likewise, W5 paused search/revision cohorts do not qualify an ordinary running load.
The next initial-layout observations must retain those distinct boundaries and report any failure before collecting a large acceptance cohort.
Previously qualified ordinary W6 results remain separate; no original W4/W5 obligation has been waived.

After the owner confirmed foreground availability, the final-renderer W6 replacement cohort resumed.
The preceding one-run headless initial-layout diagnostics give the following separate attribution, without qualifying foreground percentiles:

| Fixture / display         | Seed    | Admitted data to usable drawing | Observed settlement                      | Active frame p95 / maximum |
| ------------------------- | ------- | ------------------------------- | ---------------------------------------- | -------------------------- |
| W4 connected, 2,000 nodes | 20.3 ms | 908.1 ms                        | Still relaxing at the 12-second deadline | 129.0 / 166.6 ms           |
| W5 all, 664 nodes         | 10.7 ms | 571.2 ms                        | 7,026.3 ms                               | 25.2 / 41.6 ms             |
| W5 automatic, 50 nodes    | 9.9 ms  | 260.2 ms                        | 1,508.3 ms                               | 4.3 / 4.3 ms               |

All three retain their initial node groups and observe actual geometry movement.
Headless frame cadence differs from the interactive desktop; these are diagnostic results from one load each, not acceptance samples.
W4's unresolved cost is sustained relaxation/rendering after the initial image, not expensive seed construction.
The unchanged legacy solver cools alpha by a fixed factor per numerical tick; a closer initial placement does not itself reduce the required cooling steps.
Changing solver convergence, tick scheduling or which intermediate states are drawn remains outside the approved bounded seed/rendering envelope.

The subsequent foreground W4 observation confirms the initial-layout failure without changing the source or drawing behavior.
Its measured load takes 1,888.1 ms source-to-frame, including a 9.1-ms seed and 626.7-ms admitted-data-to-usable drawing.
Actual geometry moves through 167 observed frames; active frame p95 is 112.4 ms, maximum 133.3 ms, and the layout remains relaxing at the 12-second deadline.
Warmup also misses settlement, and neither run loses foreground.
This is a useful failing observation, not a sufficiently sized passing cohort for first-frame or preparation percentiles.
W4's strict count-operation LoAF result remains a separate passing gate.

W5's subsequent foreground warmup loses focus during initial relaxation and is rejected.
The source still reports relaxing when its deadline fires, but that observation cannot be attributed to product settlement because foreground admission failed.
The owned browser exits normally; the next desktop observation finds ChatGPT in front.
No W5 initial-layout acceptance samples are claimed from this interrupted attempt, and no completed W1 comparison is repeated.

The later W2 continuation reuses the seven complete baseline cohorts and starts only at cohort 8.
Its warmup completes, then foreground is lost again before a measured cohort completes.
The collector retains the failed attempt and exits its browser normally; there is no additional admitted comparison cohort and no automatic repeated retry.
`remaining-small-partial-summary-2.json` combines only fully completed cohorts from both ledgers and preserves each interruption and incomplete sample separately.
The remaining foreground work therefore needs an uninterrupted Chrome interval; foreground loss is not a product failure or a reason to relabel headless observations.

A separate W4 fresh-paused/resumed isolation retains the same solver and projection calculations while withholding SVG `transform`/`d` writes in the middle control only.
Both normal-rendering controls remain relaxing at 12 seconds; the suppressed-write control settles in 6,180.5 ms over 299 observed frames.
This deliberately removes visible motion during the control, then flushes the final geometry after restoring the native setter; it is diagnosis, never a proposed production mode or an acceptance result.
The three controls record zero repeated identical geometry values among 935,689, 1,787,405 and 833,723 writes respectively.
Consequently, an attribute-equality cache would add checks without avoiding this workload's updates.
A separate census finds that all 1,999 W4 relationship paths already use SVG line commands.
The remaining sustained cost is in repeatedly publishing and rendering changing geometry, with the VOWL stroke patterns intact; more seed tuning or straight-path substitution is not supported as its remedy.

### Evidence for this continuation

All paths are relative to the common external evidence root above:

- `W6-remaining-svg-profile-3`, `W6-width-hints-profile-1`, `W6-width-hints-comparison-1`: layout attribution and the rejected width-hint experiment; preceding collector setup failures remain retained.
- `W6-remaining-foreground-count-1`, `remaining-W6-summary.json`: 80 replacement loads and 80 native count operations, their exact sample groups and limitations.
- `W6-final-renderer-foreground-count-1`, `remaining-W6-final-summary.json`: the final candidate's 40 replacement loads and 40 count operations, retaining the unmet replacement target.
- `W6-final-replacement-profile-1`, `W6-final-replacement-attribution-1.json`: separate instrumented replacement attribution, selected measured sample 4, trace hash/no-loss check and exact worker manifest binding.
- `remaining-revision-W5-all-baseline-1`, `remaining-revision-W5-all-candidate-2`, `remaining-revision-W5-all-candidate-3`, `remaining-revision-W5-all-baseline-4`, `remaining-revision-summary-v2.json`: complete matched W5 comparison.
  The first derived summary had a misspelled median property; raw samples are unchanged and the corrected derivative is separate.
- `W4-remaining-foreground-frames-1`, `W4-dismissal-foreground-frames-1`, `remaining-W4-dismissal-summary.json`: complete frame observations before and during the rejected scheduling experiment.
- `W4-remaining-application-trace-1`, `W4-remaining-application-attribution-2.json`: source-bound 105.4-ms application task and sampled main-thread attribution.
  The separate longer force-timer sample is not mistaken for count application.
- `W4-revision-dom-census-3` and `-4`: 3,995-to-zero retained-label move counts; the earlier module-path and script-escaping collector failures are retained in `-1` and `-2`.
- `W6-label-order-preservation-1` and `-2`, `rendering-label-order-summary-2.json`: initial all-mode observations and the accepted matched automatic-mode preservation comparison.
- `remaining-small-runs.json`, `remaining-small-partial-summary-1.json`, and the referenced W1/W2 raw reports: complete W1 comparison, seven complete W2 baseline cohorts, and the retained foreground interruption with explicit incomplete-cohort exclusion.
- `remaining-small-W2-baseline-1-resumed`, `remaining-small-resumed-runs.json`, `remaining-small-partial-summary-2.json`: the subsequent foreground interruption, with no complete new measured cohort and no replay of accepted W1 samples.
- `W4-final-initial-diagnostic-1`, `W5-all-final-initial-diagnostic-1`, `W5-auto-final-initial-diagnostic-1`: one actual moving initial layout per fixture, including W4's retained settlement-deadline result; headless diagnosis only.
- `remaining-initial-W4-connected-bounded-1`, `remaining-initial-W5-auto-bounded-1`, `remaining-initial-bounded-runs.json`: accepted foreground W4 observations with failing cadence/settlement, followed by the rejected W5 warmup.
- `W4-active-svg-isolation-1`, `W4-link-command-census-1`: normal/suppressed/normal SVG-update controls, identical-write census and proof that all W4 links already use line commands.
  These controls are diagnostic only and leave production behavior unchanged.
- Production manifests 27–29, `rendering-dismissal-baseline-index.js`, and retained prototype sources bind the stable baseline, rejected scheduler and retained label-order candidate.

The continuous LoAF collector observes complete operation windows and drains pending entries after the measurement boundary.
Overlap uses each frame's start and duration, not its later presentation timestamp; the drain does not extend the timed operation.
These focused collectors do not claim the entire original S0 operation census, field INP or the original quiescent-host protocol.
Full checks remain reserved for the final commit; no external review, commit, push or PR mutation accompanies this continuation.

## Resumed W2/W3 comparisons — completed 24 October 2026

The owner requested resumption of only the unfinished W2/W3 comparisons.
W2 resumes at baseline cohort 8, retaining its seven complete original cohorts; no accepted W1 or W2 cohort is repeated.
Both fixtures now have 20 baseline and 20 candidate samples for each of the 15 scoped operations: load, count revision, datatype-filter revision, native selection, native search and ten consecutive label edits.
All 30 operation comparisons pass both median and nearest-rank p95 guards of baseline plus the greater of 10% or 25 ms.

| Operation                                          | W2 baseline → candidate p95  | W3 baseline → candidate p95      |
| -------------------------------------------------- | ---------------------------- | -------------------------------- |
| Load                                               | 2,521.1 → 2,156.8 ms         | 1,249.7 → 778.3 ms               |
| Count revision                                     | 74.4 → 19.1 ms               | 165.9 → 24.9 ms                  |
| Datatype-filter revision                           | 74.0 → 18.5 ms               | 168.8 → 28.7 ms                  |
| Native selection                                   | 18.9 → 15.4 ms               | 19.5 → 17.9 ms                   |
| Native search                                      | 12.5 → 11.5 ms               | 11.9 → 12.0 ms                   |
| Ten edit positions: range of individual p95 values | 637.5–710.5 → 257.3–273.9 ms | 1,083.8–1,319.9 → 484.5–541.4 ms |

The edit row is a range of ten separately assessed operation percentiles, not a pooled edit percentile.
The only positive p95 difference is W3 search's 0.1 ms, within its 25-ms allowance; its median is unchanged.
The comparison preserves the original baseline–candidate–candidate–baseline block order, splitting interrupted blocks only at complete-cohort boundaries.
Every accepted cohort retains the native result, document/revision/label and foreground assertions.

W3 loses foreground at the first measured load of its second candidate block after ten baseline and ten candidate cohorts have completed.
That failed report remains unchanged and contributes no measured cohort.
After the owner confirms Chrome availability again, only candidate cohorts 11–20 and baseline cohorts 11–20 run.
All owned browsers exit normally, and no browser exceptions are recorded.
The earlier W2 partial cohorts remain explicitly excluded, including their eight and thirteen completed operations; warmups are also excluded.

The derivative verification checks each raw report hash, expected baseline/candidate manifest, fixture bytes, uninstrumented foreground mode, CPU-exception policy, viewport, browser binary/version, Node/OS environment and unchanged measurement-harness hashes.
The baseline remains architecture source `16e67c902e3438543f3ab520a40b45b2d9e2910a`; the candidate remains manifest 29 with SHA-256 `289097e4ee1df92418ac36d9097d0b8eae09de5adf7aaa6a0a558bd7dc0c8590`.
These are scoped passing comparisons under the retained CPU exception, not the entire original 19-operation S0 census or a quiescent-host claim.
W6 replacement and W4/W5 initial-layout obligations remain separate.

Evidence under the common external root:

- `remaining-small-resumed-resume-2-runs.json`: W2 completion, W3 first blocks and the retained interruption.
- `remaining-small-resumed-resume-3-runs.json`: only the two final W3 blocks.
- `remaining-small-resume-3-summary.json`: all completed-cohort selections, exclusions, raw values, medians, percentiles and guard results, including the previously completed W1 evidence.
- `remaining-small-resume-3-verification.json`: raw-report hashes and matching source/runtime/harness/workload checks.
- `remaining-small-resume-2-summary.json` and `remaining-small-resume-2-verification.json`: retained intermediate W2 pass/W3 partial result.

This resumption changes no product source or configuration.
Only the performance records receive scoped formatting/Markdown checks; no full suite, external review, commit, push or PR mutation is performed.

## Preparation and batched drawing — implemented 24 October 2026

The owner's “Proceed with both” authorizes the bounded W6 preparation investigation and batching intermediate SVG updates while retaining every numerical force step.
This explicitly permits this scheduling experiment within the existing continuation; it does not select a different solver, change cooling, remove validation, or authorize configuration or publication changes.
The candidate remains uncommitted on the existing branch, with current HEAD `91ef9f2d2579de664862765856fcf987e445467c`.
Production manifest 34 has SHA-256 `0cf83aa2a6e6215274b7f2f2630a0834904b5c103929e6c8b8e42f34ec054454`.

### Model preparation

Two private redundancies are removed:

1. Cache each scalar validator against its grammar descriptor, avoiding repeated schema allocation and serialization for every scalar value.
   Object descriptors use the existing weak descriptor cache; named descriptors use a finite grammar-name map.
   Every input value still passes the same Ajv type/enum validation and named scalar-domain checks.
   No document value or validation result is cached.
2. Pass the assertion-support lookup derived during structural validation directly into inspection of that same owned structural tree.
   The lookup remains local to synchronous admission and publication.
   Checkpoint recovery still validates its received representation and builds its own lookup after the final ownership snapshot.
   Snapshots, deep freezing, qualification checks, budget polling and aggregate resource accounting remain in place.

Isolated W6 ABBA diagnostics retain exact normalized outputs and resource counts:

| Diagnostic                                        | Samples per version | Baseline median | Candidate median |
| ------------------------------------------------- | ------------------- | --------------- | ---------------- |
| Scalar validation of the real W6 structural input | 10                  | 72.239 ms       | 45.520 ms        |
| Admission, with the new scalar cache in both arms | 6                   | 971.187 ms      | 873.182 ms       |

These isolate different costs; they are not independent whole-load gains that can be added together.
The final two headless W6 source-to-observed-frame results are 4.197 and 4.053 seconds, compared with 4.014 and 4.017 seconds in their baseline controls.
That small browser sample does not establish a whole-load improvement or close the active-replacement p95 requirement.
The preparation changes are retained for their measured local savings and removal of duplicate work.

A separate transitive-freeze cache was tried and removed after its profile showed no useful reduction.
Its evidence remains retained, and neither `snapshot.js` nor the temporary characterization test remains changed by this iteration.

### Numerical steps and SVG publication

The existing D3 timer now separates a numerical `step` from a drawing `tick`.
The renderer permits at most two numerical steps before publishing SVG, checking elapsed time between steps against a 32-ms budget.
An atomic solver step can exceed that budget; this is not a promise that every callback or browser frame completes within 32 ms.
Other force consumers retain the one-step default, and explicit/manual `tick()` still performs one numerical step and one drawing.
No extra timer, background worker, physics formula or cooling change is introduced.

Solitary-label projection still runs after every numerical step because its positions feed the next solver iteration.
The projection iterates exactly the rendered label groups, preserving the old exclusion of invisible set-operator labels.
Direct drag, arrangement and redraw paths still project and draw immediately.
The last moving state is published before natural completion; stopping or replacing the timer cancels the remaining work in its frame.
Transient invalid-label references are cleared on retirement and graph clearing.

Intermediate visual states are intentionally published less often, while the numerical trajectory and final geometry are preserved under identical inputs and randomness.
VOWL dotted/dashed strokes, markers and glyphs remain unchanged.
This applies the performance guidance to separate heavy computation from UI publication while retaining the [existing D3 timer](https://d3js.org/d3-timer).

### Matched headless controls

The final comparison uses two fresh-paused loads followed by explicit resume per version, with the same random sequence installed before application startup and reset before each resume.
It is a deterministic diagnostic, not ordinary running-load acceptance or a p95 cohort.
The baseline serves the exact retained manifest-29 application and worker; its other runtime asset bytes are verified unchanged against manifest 34.
The candidate uses the unmodified manifest-34 production bundle.
Both use the same owned Chrome profile, workload bytes, browser, viewport and harness, with no concurrent build or test workload.

| Workload                                  | Baseline settlement | Candidate settlement | Baseline → candidate observed frames | Exact initial/final comparison |
| ----------------------------------------- | ------------------- | -------------------- | ------------------------------------ | ------------------------------ |
| W6 extended universal ontology, 953 nodes | 9.636–9.807 s       | 6.347–6.505 s        | 299 → 151                            | 4,572 SVG elements match       |
| W4 connected subclass stress, 2,000 nodes | 16.264–16.666 s     | 9.485–9.807 s        | 299 → 151                            | 8,004 SVG elements match       |

The exact comparison covers measured element identity/order, transforms, paths and computed stroke/dash styles.
The renderer tests separately compare complete serialized SVG, state, bindings and force points.
W4 remains a synthetic stress fixture; W6 supplies the diverse real-ontology check.

W4's largest observed frame decreases from 229.1 to 179.3 ms across these controls, but its candidate frame p95 values remain 87.5 and 95.6 ms.
W6 candidate frame p95 values are 58.2 and 45.9 ms, compared with 41.7 and 37.6 ms in the baseline.
The gain is shorter total settling and fewer SVG publications; it is not a demonstrated improvement in every frame interval.

The first four-step/eight-ms prototype rarely performed a second W4 step and was replaced.
The first W6 probe seeded randomness too late to control the solver's captured random source; those runs cannot establish exact final-geometry equality.
The corrected startup-seeded comparison then exposed unintended recentering of invisible set-operator labels.
Restricting projection to rendered groups fixes that divergence; the final controls match exactly and the regression is covered in both editing and viewing modes.
All earlier reports, including the failed geometry comparisons, remain retained.

### Bounded foreground observation

After the optimized code and scoped checks, each fixture receives one excluded warmup and one measured ordinary running load in foreground Chrome.
These passes use native randomness, uninstrumented production bytes and no pause/resume before the observation.
Both retain focus throughout, preserve all initial node elements and finish naturally before the 12-second observation deadline.
They are one measured load per fixture, not the required distribution of independent loads for programme acceptance.

| Measured load | Source to observed frame | Seed preparation | Admitted data to usable drawing | Admitted data to settlement | Active-frame p95 | Maximum frame |
| ------------- | ------------------------ | ---------------- | ------------------------------- | --------------------------- | ---------------- | ------------- |
| W6-all        | 4,064.0 ms               | 20.8 ms          | 511.4 ms                        | 7,097.5 ms                  | 50.1 ms          | 66.7 ms       |
| W4-connected  | 1,691.7 ms               | 11.1 ms          | 692.2 ms                        | 10,591.2 ms                 | 95.8 ms          | 129.2 ms      |

The retained W6 warmup is 6,788.9 ms to settlement with 45.9-ms frame p95; W4's warmup is 11,671.5 ms with 116.7-ms frame p95.
Warmups do not become extra acceptance samples.
W6's observation starts after movement has begun and reports 124 node bounds outside the viewport; this check does not certify framing or overlap quality.
The previous strict W4 count-operation LoAF result is a different boundary and remains bound to its earlier candidate.
W6 active-replacement p95, W4 active-frame cadence, W5 foreground qualification and final cross-workload acceptance remain open.

### Verification and retained evidence

The final affected source passes 309 VOWL tests across eight suites and 112 renderer/adapter/force tests across three suites: 421 tests in total.
The force tests compare every numerical step against the retained official D3 3.5.17 oracle, exercise the frame/time caps, stop ownership and final drawing before completion.
Renderer tests cover visible and invisible labels in both editor modes, drawing equivalence, revision recovery and lifetime behavior.
Scoped JavaScript formatting/ESLint and the production bundle build pass; the existing large-chunk warning remains.
No configuration, full-suite run, external review, commit, push or PR mutation is part of this iteration.

Evidence under the common external root:

- `profile-preparation.mjs`, `preparation-baseline-1.json` and the subsequent preparation profiles: source-level attribution, including the retained rejected freeze-cache experiment.
- `compare-typed-validation.mjs`, `preparation-scalar-comparison-1.json`: ten samples per version, exact normalized output and budget observations.
- `compare-live-admission.mjs`, `preparation-support-comparison-1.json`: six samples per version, exact inspection/correspondence hashes and resource counts.
- `W6-batching-seeded-baseline-1`, `W6-batching-seeded-candidate-2`, `W4-batching-seeded-baseline-1`, `W4-batching-seeded-candidate-1`: final deterministic controls, raw SVG observations and screenshots.
- `run-batched-layout-seeded.mjs`, `probe-layout-batching-seeded.mjs`: retained diagnostic-only startup seeding and resumed-layout observer; the earlier probe and reports remain separate.
- `W6-batching-foreground-initial-1`, `W4-batching-foreground-initial-1`: the two ordinary foreground passes with excluded warmups and full frame intervals.
- `preparation-rendering-summary-1.json`, `summarize-preparation-rendering.mjs`: verified runtime-asset preservation, exact geometry comparisons, input/report/source hashes and explicit acceptance limits.
- `rendering-production-manifest-34.json`, `preparation-rendering-baseline-manifest-34.json`, `preparation-rendering-baseline-index.js`: exact final candidate and retained baseline bindings.

## Real-ontology frame cost — researched and reduced 24 October 2026

The owner requests deeper online research and clarifies that visually equivalent rendering primitives are permitted.
The [research and results record](2026-10-24-frame-time-research-and-results.md) compares primary guidance from Cytoscape, Sigma, PixiJS, D3, Graphology and browser documentation with the actual W6 profile.
It retains Canvas/WebGL and cached glyphs as credible future experiments while implementing the measured private CPU and native SVG improvements now.

Manifest 37 caches invariant coordinates within each synchronous force visit and applies previous-position arithmetic locally in its original order.
It also uses the current native SVG translation item where available, preserving the existing attribute path for initialization and other transform shapes.
The numerical algorithm, dotted/dashed styles, markers, labels and semantic behavior remain unchanged.
The new source passes 124 affected tests, scoped JavaScript formatting/ESLint and the bundle build.
The W6 graph pixels match the deterministic baseline screenshot; its force-only intermediate also preserves every recorded geometry attribute exactly.

Five ordinary foreground W6 loads retain focus and all 953 nodes, with active-frame p95 values of **37.5–41.7 ms** and natural settlement **5.37–5.75 seconds after admission**.
The largest individual interval is 83.4 ms.
These observations satisfy the numerical 50-ms p95 and 200-ms maximum limits for the five loads, without claiming complete matched-cohort acceptance.
The CPU exception stays explicit.
Two new headless W4 stress runs remain at 91.6–95.8-ms frame p95, so that distinct cadence obligation stays open.
The record preserves source hashes, profile attribution, exact and visual comparisons, intermediate failures and the remaining acceptance boundaries.
No full checks, external review or publication operation is performed.

## Remaining acceptance — resumed on manifest 37

The owner asks to continue the unfinished original programme.
The production bytes remain manifest 37, SHA-256 `38a7c431bba02d886d3f40ee18f5587bf9942e25ddcff53eb23b38cede81f9c6`.
The already-passing affected source checks remain applicable; no source or configuration changes are needed for these measurements.
The earlier failed and interrupted observations remain historical evidence above.

### W6 active replacement passes

Forty measured fresh-running W6 replacements complete in uninterrupted foreground Chrome, with twenty loads in each A/A calibration group and two excluded load warmups.
The groups use the same production bytes; they are not a before/after comparison.
The extended Universal Ontology fixture retains SHA-256 `d7eb7980436600ab50c8a5df35401a4a345fe4362d111f2d8e6f90217505b077`, 953 counted nodes and 1,215 links.

| Group | Measured replacements | Median     | p95        | Maximum    |
| ----- | --------------------- | ---------- | ---------- | ---------- |
| A     | 20                    | 3,994.3 ms | 4,220.8 ms | 4,350.8 ms |
| B     | 20                    | 3,991.7 ms | 4,255.6 ms | 4,260.0 ms |

Both p95 values meet the five-second replacement requirement.
The accompanying count operations retain one final accepted count, the same generation/revision, pending-state behavior and the user's running intent.
Their application-to-paint p95 values are 166.1 and 181.6 ms; those are supporting diagnostics, with only ten quiet-period and ten dismissal operations per group.
The intentional one-second quiet period remains part of raw input-to-paint time and is not relabeled as execution cost.
This uninstrumented pass makes no new long-animation-frame claim.

A separate two-load headless trace still attributes most replacement time to OWL/model preparation in the worker.
It confirms that the old drawing does not continue competing for force steps during replacement.
It does not justify removing structural validation, snapshot ownership or resource accounting.

Retained evidence: `W6-remaining-replacement-foreground-1/result.json`, its `verified-summary.json`, `W6-remaining-replacement-profile-1` and `summarize-remaining-criteria-37.mjs` under the common evidence root.
The summary verifies raw report, production manifest, workload bytes and harness hashes, sample counts and state invariants.
CPU-guard exceptions remain explicitly owner-authorized, with the raw `acceptanceEligible: false` preserved.
The scenario is deliberately fresh-running; `quiescentProtocolSatisfied: false` does not claim settled-layout qualification.

### W5 initial-layout timing passes

After a successful headless diagnostic on the optimized code, forty ordinary running foreground loads complete, with twenty in each A/A group and one excluded warmup.
The core Universal Ontology fixture is 2,298,206 bytes, SHA-256 `85214ddc93194fccf5c0fc4bbbc8f34ab54e54f4abb352f0543411fd56b1c3f6`, with 664 counted nodes.
Every measured run retains focus, observes actual geometry movement, retains its initial nodes and settles naturally.

| Group | Seed p95 | Admitted data to usable drawing p95 | Admitted data to settlement p95 | Largest per-load frame p95 | Maximum individual frame |
| ----- | -------- | ----------------------------------- | ------------------------------- | -------------------------- | ------------------------ |
| A     | 10.8 ms  | 462.0 ms                            | 4,480.6 ms                      | 35.4 ms                    | 62.3 ms                  |
| B     | 10.2 ms  | 444.1 ms                            | 4,648.1 ms                      | 37.6 ms                    | 55.8 ms                  |

These groups meet the selected W5 seed, one-second usable-drawing, twelve-second settlement, 50-ms frame-p95 and 200-ms maximum-frame targets under the retained CPU exception.
Total source-to-frame p95 is separately 3,880.0 and 3,992.1 ms.
Frame intervals are summarized within each load; individual animation frames are not counted as independent load samples.
The viewport observer reads bounds after movement begins, so this pass does not certify first-paint framing or overlap quality.
It also does not qualify W4, another browser engine, manual assistive technology, or the complete programme.

Retained evidence: `W5-remaining-initial-diagnostic-37`, `W5-remaining-initial-foreground-37/result.json` and its `verified-summary.json`.
The earlier foreground loss remains rejected rather than included in the new cohort.
Final full checks, publication and the manual platform packet remain separate outstanding actions.

## Interactive panning and dragging — manifest 38

The owner redirects the next investigation toward interaction frame rate: panning a static graph and moving one node at high counts.
Load duration, natural settlement and interaction frame rate are different boundaries.
Further load cohorts are deferred while the interaction candidate is consolidated.

### Implemented: avoid unchanged SVG geometry writes

The real W6 paused-drag trace moves the same 60-link class over 72 native pointer inputs.
Manifest 37 writes all 1,215 link paths for every move: **87,480 path writes**.
Manifest 38 compares the actual current path before writing, reducing this to **4,320**, exactly the 60 incident links per input, a **95.1% reduction**.
Native SVG translations likewise avoid a write when their current translation already equals the requested single-precision coordinates; initialization and other transform shapes retain the attribute fallback.
Both checks read current DOM state, so external edits are repaired rather than hidden by a stale value cache.
The geometry calculations, physics, dotted/dashed notation, markers and selection behavior are unchanged.

The separate headless observation improves paused-drag frame p95 from 27.8 to 23.5 ms and median from 22.7 to 17.8 ms.
These are one gesture per candidate, not a statistically qualified before/after distribution.
Running-layout dragging still updates nearly the entire graph, so the same fix does not establish a meaningful speedup there.

### Foreground interaction observation

The final untraced foreground probe uses the 953-node real W6 source, natural settlement before each gesture and native wheel input to enter a detailed view.
Each gesture sends 72 native pointer moves as quickly as the browser accepts them, without an artificial timer delay.
The observer verifies actual camera/node geometry changes, all 953 nodes and uninterrupted foreground.

| Gesture                       | Moving-frame median | Moving-frame p95 | Maximum callback interval | Observed geometry changes |
| ----------------------------- | ------------------- | ---------------- | ------------------------- | ------------------------- |
| Static graph pan              | 16.7 ms             | 21.1 ms          | 25.2 ms                   | 72                        |
| Node drag with layout paused  | 16.5 ms             | 17.0 ms          | 24.8 ms                   | 72                        |
| Node drag with layout running | 33.4 ms             | 41.5 ms          | 41.8 ms                   | 72                        |

These are bounded diagnostics on the optimized local candidate, not a field frame-rate guarantee or independent-gesture acceptance cohort.
The native-input protocol itself bounds event delivery.
Earlier paced observations included idle animation callbacks between inputs; their smaller callback intervals are not substituted for visible movement.
The final probe records changed geometry on every input and keeps those earlier reports intact.
The remaining running-layout cost includes force calculations and full-scene drawing; replacing the same paths more selectively cannot eliminate genuine movement.

### Rejected paint experiments and next investigation

The [research record](2026-10-24-frame-time-research-and-results.md#interactive-rendering-follow-up) records primary-source guidance and bounded alternative-primitive experiments.
GPU promotion hints and a separate Canvas link pass fail to improve real W6 panning; none is adopted.
The promising frozen repeated-gradient control also fails to establish an active-layout gain when native hit geometry and markers are retained.
It does not justify changing VOWL notation or claiming the W4 cadence gate has passed.

The next static-panning experiment should reuse an already-rendered drawing during translation, with bounded memory, complete newly exposed content, crisp final output and invalidation on scene changes.
Running-layout dragging needs a separate rendering/physics investigation because most objects move; cached static content alone cannot solve it.
No worker migration, new renderer dependency, permanent Canvas backend or configuration change is selected here.

### Verification and evidence

The final source passes **113 affected tests** across the rendering guard, renderer editing and adapter suites, scoped JavaScript formatting/ESLint, and the production bundle build.
The initial new-test failure was a missing ESM `jest` import; it is corrected and the affected suite passes.
Only the application entry differs between production manifests 37 and 38; every other production asset matches.
Manifest 38 SHA-256 is `d2aaac926d61220c4cb88b6e87a4bae1c3307fafc5a41cd50fa29bd924aad577`.

Evidence under the common root:

- `W6-drag-diagnostic-37` and `W6-drag-diagnostic-38`: native pointer inputs, separate CPU traces and path-write counts.
- `W6-interaction-foreground-saturated-38`: final foreground geometry/cadence observation; `interaction-rendering-summary-38.json` verifies its state, counts and asset identities.
- `W6-interaction-foreground-detail-38` and `W6-interaction-foreground-moving-38`: retained earlier observer stages, with the idle-frame limitation above.
- `W6-pan-compositing-38`, `W6-pan-canvas-links-38-corrected` and `W6-pan-canvas-html-38`: rejected compositor/Canvas experiments.
- `W4-repeating-stroke-probe-1`, `W6-repeating-stroke-probe-1` and `W4-gradient-overlay-diagnostic-1`/`-2`: frozen and moving gradient experiments.
- `interaction-diagnostic-source-final-38.mjs`, `summarize-interaction-38.mjs`, and `rendering-baseline-37-index.js`: retained final interaction observer, independent summary assertions and the original entry bytes.

The initial link-datum selection error and Canvas-module syntax error remain in their failed diagnostic directories; neither is treated as a successful experiment.
All owned browser runs exit; diagnostic paint substitutions remain outside product source.
No full-suite run, external review, configuration change, commit, push or PR mutation is performed.

## Interactive step budget and static cache — manifest 39

The owner's next-opportunities instruction selects the two bounded investigations above.
After the headed run could not acquire foreground, the owner expressly chose to continue diagnostics and defer foreground comparisons.
The following measurements are headless controls; none closes a foreground acceptance criterion.

### Implemented: leave drawing time during a drag

The force scheduler now publishes one numerical step per frame while a current drag is active, restoring its existing two-step/32-ms batching after the last pointer releases.
The renderer owns the active pointer identifiers, including simultaneous mouse/touch gestures and touch cancellation.
Replacing or retiring the drawing clears that ownership; callbacks from an old generation cannot remove a current gesture.
The private force scheduler receives only a batching predicate and retains ownership of its timer, numerical steps and drawing publication.

This reduces the work competing with pointer feedback in each frame.
It does not make an individual force step cheaper: layout advances fewer steps per frame during the drag, then returns to the existing schedule on release.
The force equations, per-step label projection, pinning and Pause/Resume choice are unchanged.
The independent D3 oracle verifies identical numerical state at every step while the batching policy changes.

The comparison uses the real 953-node W6 source, deterministic startup placement, natural settlement and native wheel input before dragging.
Both candidates select the same 60-link class at exactly the same starting position and receive 72 native pointer moves, with 72 observed geometry changes.
There is one gesture per candidate, without CPU tracing or mutation counting.

| Running-layout drag | Moving-frame median | Moving-frame p95 | Maximum callback interval |
| ------------------- | ------------------- | ---------------- | ------------------------- |
| Manifest 38         | 32.1 ms             | 39.5 ms          | 48.0 ms                   |
| Manifest 39         | 27.4 ms             | 33.1 ms          | 40.9 ms                   |

The observed p95 reduction is 16.2%; median falls 14.6%.
This is a promising scoped diagnostic, not independent-gesture qualification, foreground frame-rate proof or a 60-fps claim.

### Experimental only: cache the complete static drawing

The diagnostic retains the original SVG as the camera and interaction owner and temporarily paints a complete snapshot during pure translation.
It uses the current resolution, a 256-pixel margin, a 16-million-pixel cap and an immediate SVG fallback outside the captured region or on a scale change.
The tested image occupies 10,681,344 bitmap bytes at device-pixel ratio 1; memory grows with resolution.
It preserves dotted/dashed notation, labels and markers rather than hiding expensive content.

The corrected controls each use an A/B/B/A sequence with 72 native moves per block, 146 cache hits and no misses across the cached blocks.
The original computed-style snapshot costs 529.6 ms to prepare and serializes 9.30 MB.
Deduplicating computed styles cuts preparation to 249.7 ms and serialization to 1.78 MB.
In that smaller control, p95 is 12.0–12.1 ms with native SVG and 6.1–6.2 ms with the cache, approximately a halving of the headless moving-frame interval.
Screenshots retain the visible notation, but spot checks do not establish full visual parity.

Yielding the style collection in 2.0–5.2-ms chunks retains that gain, but native SVG-image preparation still produces a **121-ms long task** and a 126.5-ms animation-callback interval.
Its total preparation is 255.3 ms.
The current snapshot pipeline is therefore **not adopted**: moving this work to gesture start would introduce a delay, while starting it later can still interrupt another interaction.
The next cache experiment would need to bound native decoding/rasterization as well as JavaScript, before production invalidation, resize, resolution, export and disposal qualification.
No persistent cache, new rendering backend or dependency is added to the application.

The first two cache controls had zero hits because the probe compared double-precision camera values against SVG's single-precision representation.
They remain retained and are excluded from the speed comparison.
The corrected probe compares scale in the same single-precision representation; changes to that rendered scale still fall back to SVG.

### Verification and retained evidence

The two new regression tests fail on the previous behavior and pass after the change.
Initial missing event-port/window fields in the renderer test fixture were corrected before observing its intended scheduling failure.
The final **127 affected tests in four suites**, scoped JavaScript formatting/ESLint and production bundle build pass.
The build retains its ordinary large-chunk warning.
Only the application entry changes between manifests 38 and 39; all other assets match.
Manifest 39 SHA-256 is `6243c4f4add23f0bb10dc4d89e528785ad8626289a3f9c2c51898f7a57943750`.

Evidence under the common root:

- `W6-interactive-drag-diagnostic-38` and `W6-interactive-drag-diagnostic-39`: seeded native-input comparison and original observations.
- `W6-interactive-drag-foreground-39`: retained foreground-admission failure; no accepted sample.
- `W6-cached-pan-diagnostic-1`, `-2` and `-3`: rejected first probes and corrected complete-image control.
- `W6-cached-pan-compact-diagnostic` and `W6-cached-pan-yielded-diagnostic`: smaller snapshot, preparation timings, long-task observation and A/B/B/A comparisons.
- `summarize-interaction-39.mjs` and `interaction-candidates-summary-39.json`: assertions for asset/workload identity, identical drag target, pointer/geometry counts, cache hits and diagnostic-only status.
- `rendering-baseline-38-index.js`, `interaction-drag-source-final-39.mjs` and each cache directory's retained probe source: reproducible diagnostic inputs.

All owned browsers exit normally after successful diagnostics; the unsuccessful foreground attempt is retained separately.
The source remains uncommitted, foreground comparisons are deferred by the owner, and the existing programme gates remain open as recorded in section 10 of the performance plan.
No full-suite run, external review, configuration change, commit, push or PR mutation is performed.

## Click intent and background cache preparation — manifest 40

The owner asks to prepare the panning cache ahead of interaction and make node movement deliberate enough that click jitter does not move a node intended for Details.
Foreground comparisons remain deferred by the owner's earlier instruction.
The drag behavior below is implemented; the cache remains an external prototype.

### Implemented: require deliberate movement before dragging

Each pointer now has a pending gesture until it moves **more than six CSS screen pixels** from its starting position.
The threshold uses client coordinates and therefore stays the same apparent distance at different graph zoom levels.
Pending gestures do not move or lock the node, restart layout, activate the interactive force budget, clear hover, or start an editor drag.
Releasing a pending gesture takes the existing selection path; cancelling a touch does not select.
After crossing the threshold, dragging stays active even when the pointer returns inside it.
Per-pointer ownership and render-generation guards continue to handle overlap, replacement and retirement.

The D3 drag subject now returns the node datum from the second callback argument.
The former one-argument callback returned the event instead, allowing the node to jump toward the pointer when grabbed away from its centre.
The corrected subject preserves the original grab offset.
[D3's click-distance setting](https://d3js.org/d3-drag#drag_clickDistance) also uses client coordinates, but only controls click suppression; it does not defer drag callbacks.
The application therefore uses the same six-pixel distance for native click suppression and explicitly delays the effects of dragging.
The modern-web `drag` guide supports both waiting for deliberate movement and preserving the pointer offset.

The existing paused/running choice, pinning, editor operations and force equations remain in place.
This change reduces accidental geometry invalidation; selecting or hovering an entity can still change its appearance and would separately invalidate a complete-image cache.

### Experimental: prepare the image in bounded idle work

The earlier yielded prototype left a 121-ms native SVG-image preparation task.
The new prototype splits both style collection and native image preparation into bounded work, preserving the existing paint order.
It serializes batches of up to 64 painted children, decodes each small SVG image, and composites them into one cache image.
Idle callbacks separate batches, with a timer fallback where the API is unavailable.
Each fragment includes only its referenced marker definitions; the final control retains all 1,188 definitions used by the drawing without repeating every definition in every fragment.
VOWL dotted/dashed strokes, labels and arrowheads remain represented.

The real 953-node W6 control reports:

| Preparation or interaction observation          | Result             |
| ----------------------------------------------- | ------------------ |
| Total preparation                               | 423.3 ms           |
| Preparation chunks                              | 57; largest 4.9 ms |
| Recorded preparation long tasks                 | 0                  |
| Longest preparation animation-callback interval | 18.3 ms            |
| Serialized fragment bytes                       | 2,626,338          |
| Bitmap memory at device-pixel ratio 1           | 10,681,344 bytes   |
| Live SVG panning p95, two A/B/B/A blocks        | 12.0 / 12.0 ms     |
| Cached panning p95, two A/B/B/A blocks          | 5.8 / 5.9 ms       |

All four blocks deliver 72 native moves with 72 observed geometry changes; the cached blocks record 146 hits and no misses.
These are headless diagnostic observations, not independent foreground acceptance or a general frame-rate guarantee.
Preparation takes longer overall than the previous 255.3-ms monolithic-image control, but it no longer produces that control's measured 121-ms stall.
This is cooperative work on the main thread, not an established worker implementation.
The browser rejects the tested SVG Blob through `createImageBitmap`; an off-thread decoding route is not demonstrated.

### Cache invalidation and integration boundary

The proposed production behavior is to prepare a cache only for a stable drawing, while the live SVG remains usable.
An unfinished build must belong to one scene revision and be cancelled or discarded when that revision changes; only a current, complete image may become visible.
Pure translation within the captured margin can reuse it.
Node movement, active layout, geometry or visible style changes invalidate it, as do scale/resolution changes and changes to viewport size, fonts or theme.
Moving one node therefore invalidates this complete-image cache, including its attached links and labels; rebuilding separate tiles is not implemented or assumed here.
While rebuilding, during active layout, or outside the captured region, the original SVG must render normally.
The source SVG remains the export and interaction owner.

The successful prototype retains a 256-pixel margin and 16-million-pixel cap, revokes image URLs and restores the original drawing on teardown.
It does **not** yet implement the production scene-invalidation, cancellation, resize, font/theme or lifetime contract above.
Spot-checked screenshots preserve notation but do not establish complete visual parity.
Those integration and correctness checks precede adoption; foreground comparisons remain deferred.

### Verification and retained evidence

The new regressions fail on the old behavior and pass with the gesture change.
Final validation passes **140 affected tests in five suites**, scoped JavaScript formatting/ESLint and the production bundle build, retaining the ordinary large-chunk warning.
Tests cover zoom-independent jitter, deliberate activation and continued dragging, correct subject, touch cancellation, multi-pointer scheduling and retired render generations.
Native Chrome mouse input on real W6 verifies that jitter selects without moving or reheating both paused and settled drawings; the paused deliberate-drag control verifies the preserved grab offset.
Chrome's emulated touch control independently verifies tap selection, cancellation and a deliberate drag, with the checks separated beyond the existing selection-deduplication interval.
This is not actual mobile-device qualification; drag feel remains in the [single manual packet](2026-10-23-ui-manual-validation.md#m4--zoom-narrow-landscape-touch-and-the-keyboard-viewport).

Only the application entry changes between production manifests 39 and 40; every other asset matches.
Manifest 40 SHA-256 is `d355b84ece125081b1a7bdeca2d3c2a93f2d49d93c88c719e631edce6b999c0d`.

Evidence under the common root:

- `W6-drag-intent-diagnostic-40`: native mouse correctness and original observations.
- `W6-touch-intent-diagnostic-40` and `W6-touch-intent-diagnostic-40-separated`: initial and separated touch controls, with their probe sources retained.
- `W6-background-cache-diagnostic-1`, `-2` and `-3`: successive decoding, idle scheduling and referenced-marker experiments; the final directory contains the 423.3-ms control and its exact probe source.
- `summarize-interaction-40.mjs` and `interaction-intent-and-background-summary-40.json`: assertions for source, asset/workload identity, input counts, cache hits and diagnostic-only status.
  The derived summary distinguishes a passed paused-mouse grab-offset check from the running-mouse case where that additional check was not run; raw observations remain unchanged.
- `rendering-baseline-39-index.js`: previous production entry bytes.

All successful diagnostic browsers exit normally.
No full-suite run, external review, configuration change, commit, push or PR mutation is performed.

## Production pan-cache cancellation and invalidation — manifest 48

The owner requested production cancellation and invalidation after the manifest-40 prototype.
The working tree now contains the private cache and its renderer integration; this is a local implementation, not a publication or completed foreground acceptance.
The source checkpoint remains `91ef9f2d2579de664862765856fcf987e445467c`.

### Ownership and fallback

Each renderer mount owns one cache generation, one optional image and at most one current preparation job.
A stable drawing starts preparing after 200 ms of quiet time, with the live SVG still visible and interactive.
Style collection yields in approximately four-ms slices, and native SVG images contain at most 64 painted children per fragment.
The preparation uses idle callbacks with a bounded wait and a timer fallback; its overall deadline is ten seconds.
This remains cooperative main-thread work, not worker rendering.

An abort signal cancels idle waits and decode waits; every image URL is revoked and a failed or retired canvas is removed and zeroed.
An image completing after cancellation or document replacement cannot publish into a newer renderer generation.
Only a complete, current image can be used during a pan.
The image has a 256-CSS-pixel margin and a 16-million-pixel allocation cap; unsupported content, active compositing effects, decode failure, deadline expiry or exceeded limits leave the live SVG in use.
Failure does not trigger an automatic retry loop; a changed scene or raster viewport can permit a new attempt.

Moving a node, running physics, changing topology, labels, selection, hover or visible styles invalidates the complete image.
Font events, ancestor/head appearance changes, viewport resizing, pixel-density changes, system theme/contrast changes, visibility transitions and retirement invalidate it too.
Pending mutation records are consumed before publication and before use, so an input cannot expose an image that is already stale but whose observer callback has not run.
Pure translation within the margin and at the same scale/resolution reuses the image; zoom and movement beyond that margin fall back immediately.
Editor mode and active layout do not prepare this cache.

The original SVG continues to own selection, gestures, accessibility and exports.
While a cached pan is visible, its canvas is hidden from assistive technology and cannot receive pointers; the SVG drawing remains in the accessibility tree.
The renderer freezes transient SVG hover during that already-owned pan and restores normal drawing on release or invalidation.
Export temporarily exposes live SVG appearance while making its detached clone, including when export is requested during a held pan.
No cache canvas or hiding class enters the exported SVG.
The existing detached-SVG style boundary and resolved visual-property list are shared rather than creating another presentation-policy exception.

### Scoped verification and findings

The final source passes **174 affected tests in eight suites**, scoped ESLint, Prettier and CSS lint.
The production bundle is exercised by the native Chrome probes; no full-suite or HISEW bookkeeping run is added.
New regressions cover cancellation races, pending mutation delivery, silent density changes, failure recovery, bounded retries, exports and disposal.

Native Chrome checks use the real 953-node W6 ontology in headless diagnostic mode:

| Case                                                    | Observed result and evidence                                                                                                                                                                                                                   |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Native pan and release                                  | Manifest 43 displays a positioned, painted cache, preserves all 953 nodes and restores live SVG; style changes and resumed layout retire it. Retained screenshots were spot-checked, not accepted as complete visual parity.                   |
| Interrupted decode                                      | Manifest 45 releases the held image URL and rejects its late completion when layout resumes. That run later fails on an unrelated probe variable; its receipt remains failed.                                                                  |
| Decode failure, document replacement and timer fallback | The manifest-45 remaining-cases run reaches and passes these assertions before its later density assertion fails. Late completion cannot replace the new document's sole cache; URLs are released. This is partial evidence from a failed run. |
| Pixel density and allocation limit                      | Manifest 48 rebuilds at DPR 2 as a 3904-by-2736 image, falls back to SVG at DPR 3 when the pixel cap is exceeded, then recovers at DPR 1.                                                                                                      |
| Export during a native held pan                         | Manifest 48 exports all 953 nodes with visible scene opacity and no cache canvas or hiding class.                                                                                                                                              |
| Application disposal                                    | Manifest 48 ends with zero cache canvases, retained image URLs, active hiding classes or owned positioning classes.                                                                                                                            |

The probes exposed and corrected four integration issues: focusing the SVG root unnecessarily retired a ready image; SVG roots lacked the HTMLElement offsets initially used for canvas positioning; wheel animation completed after the gesture's end event and needed its own preparation refresh; silent density changes could bypass notifications and retain a failed-attempt gate.
An idle-callback starvation case additionally required a bounded callback wait.
Density and raster dimensions are now checked again on pointer press and before cached display.
Earlier failures and temporary diagnostic instrumentation are retained as evidence; the instrumentation is absent from production source.

### Evidence and remaining acceptance

Manifest 48 SHA-256 is `6ee556c081f2349a9b33de26c207cf918fd4a4369914c801240d63f3ea423108`.
The common evidence root retains:

- `W6-production-pan-cache-43`: passed native pan, placement and invalidation checks, with screenshots.
- `W6-production-pan-cache-lifetime-45` and `W6-production-pan-cache-lifetime-45-remaining`: failed overall receipts containing the earlier completed case sequence; their limitations above remain explicit.
- `W6-production-pan-cache-resolution-48`: completed density, allocation, export and disposal checks, plus its retained probe source.
- `pan-cache-48-affected-tests.log`, `pan-cache-48-prettier.log` and `pan-cache-production-summary-48.json`: scoped verification and the derived evidence/source index.
- Production manifests 40–48 and the intermediate probe directories: retained unsuccessful attempts, diagnostics and corrected candidates.

The earlier cache preparation and panning timings belong to the external prototype, not to this production integration.
No production speedup or final frame-time acceptance is claimed by these correctness checks.
Foreground comparisons remain owner-deferred, and cross-browser/device visual transitions, real zoom/density changes and assistive-technology coverage remain in the [single manual packet](2026-10-23-ui-manual-validation.md).
No dependency/configuration change, external review, commit, push or PR change is made.

## Foreground cache qualification and deep-path placement — manifests 50–51

The owner made foreground Chrome available for final qualification on 24 October.
The completed observations below retain the CPU-admission exception and actual visibility/focus checks.
The source remains an uncommitted continuation of `91ef9f2d2579de664862765856fcf987e445467c`; these results do not claim publication or manual acceptance.

### Foreground discovery and bounded repair

The first production-cache comparison exposed a regression absent from the earlier headless checks: ordinary SVG panning had an approximately 8.3-ms median, while the opacity-only cache reached roughly 96–108 ms.
An instrumented diagnostic attributed approximately 6.82 seconds of a 7.63-second gesture to Chrome's `Layerize` work.
Making the live SVG transparent had not removed its expensive layer construction during translation.
Canvas/SVG promotion, containment, isolation and opacity controls did not solve this case; hiding the SVG with `display:none` was rejected because it removes geometry and accessibility.

The final cache additionally applies `clip-path: inset(50%) view-box` to the scene while its complete image is shown.
The [viewport reference box](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/clip-path) avoids the scene-bounds work observed with a shape-relative clip.
Clipping the outer SVG instead would remove its input region under [SVG hit-testing rules](https://www.w3.org/TR/SVG/interact.html), so the viewport remains unclipped and owns the gesture.
The source SVG remains present, and release, invalidation and export restore its ordinary drawing.
A capability check leaves browsers without this exact CSS value on the existing SVG path.
Entering blank viewport space also no longer retires a prepared image; native touch enters that space immediately before panning.
Entering drawing content still invalidates hover-dependent appearance.

Twenty measured native pan gestures per version, with an excluded warmup in each block, produce:

| Observation                                        | SVG baseline | Production cache |
| -------------------------------------------------- | ------------ | ---------------- |
| Median of per-gesture median frame intervals       | 8.3 ms       | 4.2 ms           |
| Median of per-gesture frame p95                    | 8.4 ms       | 8.4 ms           |
| P95 across the twenty per-gesture frame p95 values | 9.5 ms       | 8.4 ms           |
| Largest observed interval                          | 12.6 ms      | 33.3 ms          |

Every gesture retains 953 nodes, 72 native pointer moves and 72 observed geometry changes.
Candidate gestures visibly use the prepared cache; release restores the SVG.
Typical intervals improve, but the tail is not halved and the largest transition interval increases while remaining below 50 ms.
These saturated native-input observations are not field INP or a guarantee of frame rate on other devices.
The baseline uses retained manifest-40 entry bytes with shared candidate assets.
The first baseline block preceded discovery and repair; final candidate/candidate/baseline blocks followed, so this is not an uninterrupted fresh ABBA experiment.
The harness retains its generic diagnostic/admission flags; the derived record states this narrower foreground gesture scope without rewriting those flags.

Native Chrome additionally preserves the exact unignored accessibility roles/names during an active cached pan: 13,184 entries before and during, with focus established before comparison.
The viewport remains the pointer target, a second touch transitions into pinch zoom and restores SVG, DPR 2 builds the expected image, DPR 3 exceeds the allocation cap and falls back, and DPR 1 recovers.
Export during a held native pan contains all 953 nodes with visible SVG appearance and no cache canvas/class.
Disposal leaves zero owned canvases, URLs and hiding/positioning classes.

Targeted native-module integration passes on Chrome 156.0.8078.48, Firefox 153 and Playwright WebKit 26.6.
The independent layered SVG fixture verifies painted cache preparation, accessibility-name continuity, viewport hit testing, release, pending-mutation invalidation and disposal.
These are engine checks, not actual Safari, mobile hardware, screen-reader output or complete W6 visual parity.
Earlier attempts used an incompatible default executable selection or a fixture missing the renderer's required layer groups; their failed receipts remain.
WebKit screenshot automation also retired the image before a later assertion, so the narrow follow-up waits for a current image at each case boundary instead of treating screenshot-induced changes as production failure.

### Independent real-ontology load qualification

Manifest 50 completes forty ordinary running W6 loads: twenty A and twenty B observations of the same candidate, plus an excluded warmup.
No load is paused or reheated before observing natural settlement.
All retain focus, visible geometry movement and all 953 nodes.

| Boundary                                  | A p95      | B p95      | Disposition                                              |
| ----------------------------------------- | ---------- | ---------- | -------------------------------------------------------- |
| Source submission to observed frame       | 4,594.6 ms | 4,674.3 ms | Meets the five-second scoped load target                 |
| Initial seed preparation                  | 21.0 ms    | 23.4 ms    | Meets 50 ms                                              |
| Admitted data to usable drawing           | 600.8 ms   | 586.9 ms   | Meets one second                                         |
| Natural settlement                        | 6,501.8 ms | 6,705.1 ms | Meets twelve seconds                                     |
| Distribution of per-load frame p95 values | 50.1 ms    | 49.9 ms    | Numerical miss retained; limitation owner-accepted below |

The median per-load frame p95 is approximately 41.7 ms; four individual loads exceed 50 ms, with a largest per-load p95 of 54.2 ms.
The largest individual interval is 112.6 ms, and every load settles naturally.
The 50.1-ms result is not rounded down into a pass or discarded under the CPU exception.
Frames within a load are not counted as independent load samples.
The load boundary starts with source bytes already available to the application; it does not include browser startup, network transfer or a file picker.
The observer starts after the first drawing is already moving and finds 121–124 nodes outside the viewport; this does not certify first-paint framing or overlap acceptance.

### Bounded deep-path initialization

W4's two foreground stress observations on manifest 50 still record frame p95 of 100.0 and 104.2 ms, despite settling in 10.54–10.64 seconds.
The deep-tree fallback had discarded connectivity and placed nodes in an inventory-ordered spiral.
For the 2,000-node path, its median initial edge length was approximately 5,895 world units and its maximum approximately 8,334.

Manifest 51 handles a deep, connected simple path with two endpoints and no branching by walking its incidence and folding consecutive nodes into compact rows.
Every adjacent pair starts one existing component-spacing unit apart; W4 therefore starts with 1,999 edges of 200 world units.
The rule is based on topology, not fixture identity or node labels.
Other deep shapes retain the bounded fallback; the force solver, cooling, drawing schedule, VOWL strokes and later interactions remain unchanged.
The pure W6 comparison changes zero coordinates, with identical position hashes.
The new shuffled-inventory regression fails on the previous initializer and passes after repair; all thirty affected initializer/scene/tree tests pass.

Two ordinary foreground W4 observations then record frame p95 of 70.8 and 62.5 ms and settlement in 9.03 and 8.92 seconds.
These are bounded observations, not sufficient samples to qualify a percentile population, and they still miss the 50-ms requirement.
The post-load observer sees 138 nodes outside the viewport after early motion, so the proposed-view comparison alone cannot attribute the gain independently of framing.
A separate headless control uses the same explicit scale and centered camera for both versions, retains all 2,000 nodes in the viewport at observation, and records per-run frame p95 of 79.2 to 66.7 ms and settlement of 10.26 to 8.75 seconds.
That corroborates an improvement beyond changed framing; it is not foreground acceptance or a repeated-sample speedup estimate.
No larger W4 cohort is run merely to reconfirm the remaining miss.

### Owner acceptance of cadence limitation — 24 October 2026

After reviewing these W4 and W6 results, the owner selected **“Accept the documented cadence limitation.”**
The [AC-104 disposition](2026-10-23-initial-layout-improvement-plan.md#ac-104-owner-disposition--24-october-2026) records this exception for the current delivery: further optimization toward 50 ms is no longer an acceptance blocker.
The measured misses, W4's limited sample count, candidate identities and original target remain unchanged; this is not a numerical pass or a new general frame-time allowance.
The other AC-104 conditions and all other acceptance criteria remain in force.
First-frame framing/overlap and the actual-device/AT manual batch remain pending.
This later owner decision does not rewrite the prior verification receipt or authorize publication.

### Evidence and remaining closeout

Manifest 50 SHA-256 is `2693cf98bfcf2efc19da1e6ef3a80bf6c201f311309b40b0d83012e0d7c7c765`.
Manifest 51 SHA-256 is `c96921e9341037a02a93013d713d3a574670b4b85d75d55ff258ba9534e0e384`.
The worker bytes remain unchanged.
The common external root retains:

- `foreground-qualification-summary-50.json` and its summarizer: report hashes, gesture distributions and forty independent-load assertions.
- `W6-pan-foreground-48-A1-nodes`, `W6-pan-foreground-50-B1`, `-B2` and `-A2`: accepted scoped pan observations; the regressed manifest-48 blocks and compositor controls remain separate.
- `W6-pan-clip-continuity-50`, `W6-cache-export-density-50` and `W6-independent-initial-50`: real-ontology native correctness and load evidence.
- `pan-cache-browser-engines-51-layered.json` and `pan-cache-browser-engines-51-webkit-complete.json`: completed Chrome/Firefox checks and the narrow completed WebKit follow-up; earlier failed receipts are retained.
- `deep-path-seed-diagnostic.json`, `W4-bounded-initial-50`, `W4-deep-path-diagnostic-51-cpu-exception`, `W4-deep-path-foreground-51` and `deep-path-camera-control-51.json`: pure, headless, foreground and camera-matched evidence with distinct scopes.

The first deep-path diagnostic omitted the owner's CPU-exception flag and was stopped before collecting a sample; its admission records and explicit interruption note remain unchanged.
The consolidated final verification starts from `rendering-final-source-51.json`, which retains the 29 changed application/package source and test files, their hashes and contents.
It also verifies that the final W6 position hash matches the earlier initializer and that only the application entry changes between manifests 50 and 51.

The first `npm run check` passes HTML/CSS/JavaScript/Python lint and the complete 105-document Markdown check, then exits 2 in the installed JSON engine with `operation-failed: statement-step`.
The remaining stages run once without repeating those successful stages.
Application/Python formatting, 28 Python tests with two platform skips, three Markdown integration tests, four storage probes, all 7,227 corpus-storage artifacts, seven JSON integration tests and the production build pass.
The JSON integration test independently completes the full pinned repository/corpus obligations.

The complete JavaScript run passes 10,214 of 10,215 tests across 193 suites.
Its sole failure is a stale assertion in `util/markdownWorkflow.test.js`: the existing CI workflow and gate already require corpus storage, but the expected dependency list omitted `corpus`.
Only that test expectation is corrected; CI configuration is unchanged.
Its eleven-test suite then passes, together with scoped Prettier/ESLint.
This supplies complete test coverage through the full run plus the narrow repair, not a claim that the original failed invocation exited zero.
No second full JavaScript run is added for bookkeeping.

The final generated-output JSON check exits zero and reports all inventory, linkage, freshness, diagnostics and contract obligations complete for 7,100 members.
Its overall quality flag retains the deliberate negative-corpus findings; the repository contract succeeds under the existing pinned expectations.
The earlier native failure does not recur in either the complete integration check or the final CLI check; its cause is not claimed fixed and its failed log remains intact.
No dependency, resource-limit or policy override is used to obtain the pass.
The production build retains the existing large-chunk warning.

The exact stage logs, scoped repair and final JSON terminal are indexed by `rendering-final-check-summary-51.json`.
Application source and generated assets are rechecked against the frozen candidate after verification; the only later code edit is the stated test expectation.
The owner accepts the documented W4/W6 cadence limitation under the disposition above. First-paint framing/overlap remains open; passing load and settled-pan targets does not establish it.
Actual-device visual/gesture checks and the required AT combinations remain in the [single manual packet](2026-10-23-ui-manual-validation.md).
No configuration/dependency change, external review, commit, push or PR mutation is performed in this qualification.

## Initial paint and glyph clearance — manifest 56

The owner accepted only the documented cadence limitation, then correctly rejected the prepared image because class circles still touched with Class distance set to 200.
Viewport containment and a zero-overlap count do not establish the requested clearance.
This continuation fixes two separate defects in eligible fresh drawings.

First, the native force timer could advance the seed before the adapter's existing two-animation-callback paint boundary.
Manifest 51's real-W6 admission snapshot contains all 953 nodes in the viewport, but its first callback already has seven nodes outside and 698 overlapping footprint pairs.
The native load now holds that initial timer until the adapter accepts its current drawing after the existing paint boundary.
The completion callback is single-use, retains alpha and running intent, and cannot restart a retired/replaced mount or override a user pause.
[Animation callbacks run before repaint](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame); the boundary supplies a paint opportunity, not a claimed physical-display timestamp.
The manifest-52 headed screencast confirms that the prepared drawing is actually presented, but its touching circles and 43 footprint overlaps remain unacceptable spacing.

Second, the coarse initializer reserved half the requested Class/Datatype distance between centers without native glyph extents.
After native text sizing, a private placement pass now applies the selected clear gap outside the actual glyph footprints, then shifts associated property positions with their endpoint displacement and fits the initial viewport.
Rectangular glyphs use enclosing disks, conservatively protecting diagonal clearance.
Both current and previous coordinates move together, avoiding artificial initial velocity.
This applies only to eligible fresh loads; explicit views, supplied/saved positions and ordinary revisions keep their existing branches.
The shared native settings and glyph sizes remain authoritative; no duplicate default-radius setting is added.

The first implementation spent unnecessary time repeatedly probing occupied grid cells.
The final helper uses numeric column/row maps and shares permanently rejected grid positions among equal footprints while occupancy grows.
Its temporary indexes live only for that placement call.
An intermediate string-key rejection cache worsened W6 and was removed; the retained numeric version preserves every verified initial coordinate.

### Observed initial geometry

Native headless Chrome observes the ordinary running load at admission and its first four animation callbacks, with native screencast images.
The final candidate exactly matches manifest 53's admitted coordinates, types and native dimensions in every tested workload.

| Workload                                | Nodes | Initial nodes outside viewport | Initial node overlaps | Minimum class clear gap | Minimum datatype clear gap    |
| --------------------------------------- | ----- | ------------------------------ | --------------------- | ----------------------- | ----------------------------- |
| Real extended ontology, all             | 953   | 0                              | 0                     | 200 graph units         | 123.53 graph units            |
| Real extended ontology, automatic count | 50    | 0                              | 0                     | 200 graph units         | No datatype pair in this view |
| W4 connected path                       | 2,000 | 0                              | 0                     | 200 graph units         | No datatype pair in this view |

The defaults request 200/120 graph units, measured outside glyphs; fitted zoom scales those distances on screen.
The initial geometry survives both first animation callbacks unchanged, then the ordinary running force advances.
The force treats its distances as spring targets: later nodes can approach or overlap, and some moving nodes can leave the initially fitted viewport.
Property-label readability and a permanent collision floor are not established by this initial node-spacing proof.
No VOWL stroke, marker, shape or semantic relationship is hidden to obtain the result.

### Cost, checks and remaining acceptance

Thirty measured Node-only preparations, after one warmup, reuse retained native glyph sizes and pre-correction coordinates.
The additional spacing pass has median/p95 costs of **6.56/7.26 ms for W6-all**, **0.046/0.073 ms for W6-auto**, and **8.88/9.74 ms for W4**.
The initial implementation's corresponding medians were 31.69, 0.077 and 90.88 ms.
These isolated diagnostics exclude native text sizing, DOM writes and paint; they are not browser p95 acceptance or a replacement for AC-102/AC-109 measurement.
A separate manifest-53 W6 headless running-load observation reaches a usable frame in 541 ms and settles in 5.42 seconds, retaining all 953 nodes.
It is a single diagnostic on that earlier candidate, not a new foreground qualification of manifest 56.

After the screen is unlocked, one ordinary foreground running-load observation per workload checks the final manifest-56 source without instrumentation or a changed solver:

| Workload        | Source to observed frame | Admitted data to usable frame | Natural settlement | Per-load frame p95 |
| --------------- | ------------------------ | ----------------------------- | ------------------ | ------------------ |
| W6, 953 nodes   | 3,985.3 ms               | 481.1 ms                      | 5,221.4 ms         | 37.5 ms            |
| W4, 2,000 nodes | 1,481.7 ms               | 561.1 ms                      | 9,406.5 ms         | 70.9 ms            |

Both retain every node and foreground throughout the observation, with actual moving geometry and natural completion.
These single observations do not establish population p95 or a before/after improvement.
The W4 cadence miss remains explicit; the owner's accepted limitation is not relabeled as a numerical pass.
The existing application seed marker measures the coarse preparation only: the additional native footprint pass remains inside the usable-frame and source-to-frame boundaries, and is reported separately in the isolated diagnostics above.

The final source passes **137 affected tests in four suites**, scoped ESLint/Prettier and the production build.
Regression tests first reproduced timer movement before paint and a zero-unit gap between ordinary class circles; they now cover actual glyph clearance, differing Class/Datatype settings, idempotence and stale/pause/retirement callback safety.
The earlier manifest-51 full verification remains unchanged and is not relabeled as a full run against this source.

The manifest-53 foreground visual attempt fails admission with `Deadline: headed Chrome foreground admission`, before collecting a sample.
An attempt to use the native computer-use tool for task-window activation returns `Transport closed`; no UI input is issued.
After the owner unlocks the screen, the ordinary native runner completes the foreground W6 check on manifest 56: all 953 initial nodes fit without overlaps, with minimum class/datatype gaps of 200/123.53 graph units and exact geometry equality to the diagnostic candidate.
The native first image is inspected; this establishes the scoped first-paint geometry, not comprehensive property-label readability or actual-platform acceptance.
The [single actual-device/AT packet](2026-10-23-ui-manual-validation.md) remains pending.
The owner-accepted cadence limitation remains a limitation, and no new population timing claim is made for the changed initial positions.

Manifest 56 SHA-256 is `ecf5f2b245836ce414bcce81ae9651019c24eeeb629f6ad4895e48eb8e001f1a`.
The common external evidence root retains:

- `W6-first-frame-presented-51`, `W6-first-frame-foreground-52` and their probe modules: the pre-paint defect and the timer-only repair, with the rejected spacing retained.
- `W6-first-spacing-53`, `W6-auto-first-spacing-53` and `W4-first-spacing-53`: the initial clearance correction before search optimization.
- `W6-first-spacing-56`, `W6-auto-first-spacing-56` and `W4-first-spacing-56`: final native geometry, exact-position comparison, screenshots and complete receipts.
- `W6-first-spacing-foreground-56`: the same first-paint/clearance assertions and inspected native first image after the owner unlocked the screen.
- `W6-first-spacing-layout-foreground-56` and `W4-first-spacing-layout-foreground-56`: final foreground running-load/settlement regression observations, one per workload.
- `footprint-preparation-cost-53.json` through `footprint-preparation-cost-56.json`, with their measurement scripts: the successive isolated cost diagnostics, including the unsuccessful string-cache attempt.
- `W6-first-spacing-layout-diagnostic-53` and `W6-first-spacing-foreground-53`: the bounded headless settlement observation and unsuccessful foreground admission.
- `first-spacing-affected-tests-56.log`, `first-spacing-build-56.log`, `rendering-first-spacing-source-56.json` and `initial-spacing-summary-56.json`: scoped verification, exact retained source and evidence index.

No further full check, external review, configuration change, commit, push or PR mutation is performed.
