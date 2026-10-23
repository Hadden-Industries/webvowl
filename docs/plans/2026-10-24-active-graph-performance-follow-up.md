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
