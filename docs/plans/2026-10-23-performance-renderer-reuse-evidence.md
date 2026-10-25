# Performance count adjustment and renderer reuse evidence

## Scope and source

S8 implements option A of [PERF-DEC-012 revision 2](2026-10-23-incremental-revision-design.md): one-second count batching and bounded renderer reuse for running, settled and paused drawings.
The source baseline is signed/published checkpoint `528d8b821eb143b88fd761b4b4fa69647c983eab`.
The implementation boundaries, fallback conditions and asynchronous share/export contracts are recorded in that decision.
No configuration, dependency, physics algorithm or persisted format changed.

Final S8 diagnostics are retained in external operator group `59b30a65391942319612b9a002cac313`.
`s8-manifest.json`, `s8-product.patch`, `source-s8/`, `s8-build.log` and `s8-maps-comparison.json` identify the exact production source and assets, including untracked source files.
The production build contains 50 assets totaling 12,694,727 bytes, including hidden maps used for attribution.
Build preparation verifies source stability and guards the existing deployment directory against build-hook removal of unrelated maps or fixture data.
This is a diagnostic build, not a deployment.

## Independent reference and work avoided

The retained pre-S8 full renderer is `sf-production` in operator group `1aa50dbf88f44b05a24d9989246e6ada`.
Its browser control is `s8-reuse-reference-1/result.json`; the final candidate is `reuse-w1-final/result.json` in the final S8 group.
`final-native-reuse-comparison.json` binds both result hashes and compares their full native geometry observations.

| FOAF count | Full renderer SVG elements created | S8 elements created | Full renderer width / box reads | S8 width / box reads | Retained primitive and DOM pairs |
| ---------- | ---------------------------------- | ------------------- | ------------------------------- | -------------------- | -------------------------------- |
| 55         | 1,234                              | 38                  | 95 / 136                        | 0 / 0                | 217                              |
| 54         | 1,218                              | 38                  | 94 / 134                        | 0 / 0                | 214                              |
| 56         | 1,251                              | 69                  | 96 / 138                        | 6 / 4                | 214                              |

These are actual production DOM construction and native measurement counts, not estimated savings.
The restored occurrences at 56 require new elements and fresh measurements.
The retained full-renderer control and final S8 candidate have **zero differing native geometry leaves** across all three counts, including text, computed fonts, paths, markers, rectangles and native SVG bounds.
Geometry is measured with layout paused; separate evidence below covers active simulation.
Neither construction counts nor headless geometry comparisons establish foreground interaction latency.

## Controller and production behavior

The final FOAF browser run completed with no captured exceptions and a confirmed browser exit.
A real range-input burst across animation frames leaves the accepted count at 56 while the requested count becomes 54.
The temporary hold reports effective Pause with explicit user intent still Resume.
One quiet-period application publishes 54; a subsequent Filters dismissal publishes 53 once.
Both release back to active layout.
The separate active-layout check observes 55 nodes move across six animation frames after a retained revision.

Export with a pending count flushes to 55 nodes, clears the draft and preserves manual Pause.
The resulting `renderer-reuse.svg` parses as SVG and contains the expected visible node count.
The retained screenshot shows the native Filters popover and count controls; the accessibility tree exposes named slider and exact-count controls with accepted values and available-node descriptions.
Focused tests additionally check pending announcement stability, immediate presets/exact values, hidden-page ownership, explicit Pause/Resume during a hold, direct view/filter requests and cancellation on document changes.

Changing a stylesheet or adding a loaded font forces full reconstruction: the browser control observes replaced primitives and zero retained pairs in each invalidated revision.
There is no cross-document font or text cache.

## Correctness, recovery and lifetime

The real-renderer differential compares reuse with complete rebuilding for paused, settled and running modes, including controlled force progress, `x/y/px/py`, pins, camera, bindings, layer order, parallel links, loops and visibility removal/restoration.
Additional-operand indications dirty the affected node and coherent links while unrelated elements survive.
Semantic revision, labels, cardinalities, kinds, language and notation exercise conservative full fallback.
Old hover, click, drag and inline-editor callbacks cannot mutate the accepted interaction owner.

Failure injection covers preparation and enter/update/exit/finish installation; recovery reconstructs the prior accepted drawing through the full path.
A separate double-failure check preserves `CANONICAL_DRAWING_RECOVERY_FAILED` and retirement behavior.
The controller tests exercise publication reentrancy: a subscriber staging a newer count during automatic pause must share the already reserved hold.

Ten equal-live-size production cycles keep 440 tracked live DOM/primitive objects and **zero retired objects alive** after forced collection in every cycle.
A deliberately retained old-owner control is detected; releasing it restores zero retired survivors.
Final application disposal leaves zero tracked objects alive, even with the diagnostic controller reference retained.
Forced collection establishes bounded ownership under this workload, not a general browser heap plateau or foreground timing result.

The larger `reuse-w4-final/result.json` run repeats the production protocol on the connected 2,000-node fixture, with zero captured exceptions and browser exit zero.
Counts 1,999 and 1,998 each create 38 SVG elements, perform zero width/box reads and retain 5,995 / 5,992 primitive-and-DOM pairs.
Restoring 2,000 creates 70 elements with six width and four box reads, retaining 5,992 pairs.
The burst publishes 1,998 after quiet and 1,997 after dismissal; both resume according to the user's intent.
The active check observes 1,999 nodes move, and pending export contains exactly 1,999 nodes while preserving Pause.
All ten cycles retain the same 11,996 live tracked objects with zero retired survivors; final disposal collects all tracked objects.
This larger run confirms behavior and work avoidance; the independent native geometry comparison above remains explicitly scoped to FOAF.

## Verification and retained failures

Meaningful initial red checks demonstrated repeated burst installations, lost primitive identity and the reentrant hold failure before their fixes.
The corrected focused run `followup-2.log` passes 174 tests in nine suites, including the renderer, controller, UI, worker admission and consumer boundary.
Earlier focused passes and all failed attempts remain in the prior operator group.

An incorrectly invoked affected-test script ran its full fallback outside npm, producing missing-`npm_execpath` environment failures; these are retained as failed evidence.
That run also exposed a real test-isolation defect: a CodeQL deadline test restored `performance.now` with the wrong property descriptor, making a later spy fail in the same worker.
The test now restores the original descriptor or removes its temporary own property.
The correct npm focused invocation passes the affected suites.
This is a test isolation correction, with no product or configuration effect.

The consolidated `npm run check` passed after the source fixes: **9,928 tests in 172 suites**, repository lint and formatting, 28 Python tests with two skips, three Markdown integration tests, seven JSON integration tests, the production build and the generated-JSON check.
The JavaScript suite took 229.221 seconds; the production build completed in 630 ms.
The full log is `performance-full-check-1.log`, SHA-256 `a2b4fb000985f4fda2db9c08031a097c47952ef68c01489020ae5946e88d8802`, with an independently retained zero exit code.
The build retains its informational chunk-size warning; no configuration change was made to suppress it.
GitHub run IDs printed by test fixtures are test data, not hosted qualification.
Subsequent evidence-only documentation updates receive scoped formatting/lint; unchanged product source does not require repeating the full suite for bookkeeping.
That check preceded the final external/security reviews.
A later bounded-search repair passed a second full check: **9,930 tests in 172 suites**, the same repository/integration gates and the production build.
It changes semantic search materialization, not this renderer implementation or the recorded browser workload.
The [final programme handoff](2026-10-23-performance-final-handoff.md) records the repair, review dispositions, final verification and UI-stage pause.
The browser evidence above remains bound to its original source and manifest; it is not relabeled as a fresh browser run after the search repair.
The owner deferred foreground timings and accepted diagnostic execution despite CPU-guard failures.
The intentional one-second quiet period, final rendering cost, foreground percentiles and small-workload latency guards remain separate claims; no numerical foreground acceptance is inferred from the checks above.
