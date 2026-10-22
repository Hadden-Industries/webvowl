# Performance text-layout implementation evidence

## Scope and disposition

S6 implements synchronous SVG text placement and native text-width batching under the [approved performance plan](2026-10-21-performance-implementation-plan.md).
Its headless attribution gate is satisfied; native geometry controls explain the retained numeric differences described below.
Final full verification, consolidated external review, equal-size lifetime confirmation on the consolidated candidate, and deferred foreground acceptance remain outstanding.
No foreground latency, percentile, or long-frame budget is claimed here.

## Implementation and ownership

[Text layout](../../src/shared/js/util/textLayoutBatch.js) queues one synchronous document draw, reads all computed font sizes, writes line offsets, reads all text-block boxes, then writes centering coordinates.
The coordinate formulas are unchanged.
Outside a draw, editing helpers retain immediate behavior.
Queues are released on success and failure; different documents remain independent.

[Text widths](../../src/shared/js/util/textTools.js) use actual native measurement probes and reuse only exact normalized text/style requests within that same synchronous draw epoch.
All prepared probes are appended before width reads and removed afterwards.
Missing hints still use the native probe and the existing truncation algorithm.
Every draw discards its cache, including unique label strings.
The documented caller contract forbids changing the probes' inherited styles, fonts or viewport, or yielding, within that epoch.
Later stylesheet/font changes therefore start with fresh native widths; there is no cross-draw class-only cache, mutation observer or font listener.

The [renderer](../../src/webvowl/js/runtime/renderedGraphInternals.js) prepares hints from the actual visible classes and property labels.
Hints are optional preparation rather than an alternative authority for rendered text.
This follows the modern-web-guidance performance guidance to batch DOM reads and writes; native layout remains the metric oracle.

## Source and experiment identity

Raw evidence is retained outside Git in HISEW operator group `e85861ceab0149808faa4990bd7820d8`.
Architecture commit `16e67c902e3438543f3ab520a40b45b2d9e2910a` remains the Git baseline.
The comparison baseline is the corrected S2–S5 production build, `s5b-production`, in operator group `f5ede2a10d824c7590e41eef87aafedb`.
Each candidate has its own production manifest, source snapshots, product patch, build log and byte-identical source-map comparison.

| Candidate | Change                                                  | Disposition                                                                                 |
| --------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| S6a       | Batch SVG font/box reads and placement writes           | Insufficient alone: approximately 22–27% W1 style/layout reduction, below the 50% gate      |
| S6b       | S6a plus native width-probe batching and per-draw reuse | Selected: each measured layout/style family exceeds the gate on W1, W4-connected and W5-all |

S6b's entry SHA-256 is `3848064a74b780122332af41f26fffa5e27c3a55a41f0512a0f4f1dc57830a58`.
Its product-patch SHA-256 is `c7d7fd60049606c3fc3f6ad9fc6428cc91b9ef362bfaa20205a7bcffd1b83ed2`.
The worker bytes, lockfile and build configuration are unchanged.
The later arrangement-scan removal below is a separate focused change after these builds; these measurements are not relabelled as measurements of that later source.

## Narrow production attribution

Each version ran one warmup load/count and two measured count revisions in a fresh headless Chrome profile, with no concurrent task analysis or test work.
The retained CPU exception applies; contention and tracing overhead limit inference.
The raw state confirms the requested count transitions: W1 48 then 49 of 56 eligible nodes, W4-connected 1,998 then 1,999 of 2,000, and W5-all 662 then 663 of 664.
Source-mapped profiles and native timeline events attribute the reduction to the changed measurement path.

| Workload     | Baseline Layout, two samples (ms) |   S6b Layout (ms) | Baseline UpdateLayoutTree (ms) | S6b UpdateLayoutTree (ms) |
| ------------ | --------------------------------: | ----------------: | -----------------------------: | ------------------------: |
| W1           |                   32.938 / 37.793 |     3.686 / 3.557 |                41.665 / 44.789 |             3.046 / 2.932 |
| W4 connected |             5,923.119 / 5,745.726 |   65.737 / 58.856 |        12,723.885 / 12,101.211 |           49.251 / 45.562 |
| W5 all       |             1,447.872 / 1,210.926 | 128.251 / 146.278 |          2,431.373 / 2,173.657 |         166.831 / 183.047 |

The families are reported separately and are not added as though non-overlapping.
The smallest observed reduction in either family is approximately 88%, exceeding S6's 50% diagnostic gate.
W1's total traced windows fell from 133.1/146.3 ms to 32.5/30.4 ms; this supplies a small-corpus diagnostic guard, not statistical foreground acceptance.
Only two traced samples per version were collected for this causal comparison.

## Geometry and independent precision control

The exact differential compares actual SVG text, line offsets/fonts, bounding boxes, rectangles and captured SVG dimensions/line geometry.
W1 exercises count changes, all nodes, fixed width, dynamic widths of 60 and 160 px, expanded notation, German language, an edited label, changed styles, a loaded local font, SVG capture and document replacement.
W4-connected and W5-all cover the large count-revision state.
All completed probes found zero surviving measurement elements.

W4-connected and W5-all have zero exact geometry differences between baseline and S6b.
W1 has zero differences from S6a to S6b, but its baseline-to-S6a comparison retains 150 numeric differences in block `y`, bounding-box `y`, and height.
The largest is `0.000003814697265625` SVG units, up to three float32 representable steps.
Text, line offsets, widths, styles and the captured SVG fields agree.
The exact comparison is retained as non-identical; its tolerance was not relaxed.

A separate native control independently reconstructs incremental and batched SVG placement without calling the product measurement helpers.
It demonstrates that native `getBBox` rounding depends on the block's existing `y` coordinate when centering is repeated after each line.
All 24 label/style cases produced identical rasterized glyph pixels, with visible ink in every case.
Moving each result by one output pixel produced a detected difference in every case.
This explains the numeric difference at native SVG precision; it is not a claim that every floating-point attribute is bit-identical.

The first control used a one-SVG-unit shift, which became subpixel under graph zoom and was not discriminating for every case.
That failed control remains unchanged as `W1-native-text-control`.
The corrected one-output-pixel control is `W1-native-text-control-2`.
The standalone control was added after timed collection and has a distinct harness identity.

## Focused verification and sibling audit

The initial executable SVG-batch seam failed three intended ordering/isolation/cleanup tests before implementation.
The width-batch seam failed two intended native ordering/reuse/failure-boundary tests.
The completed candidate passed 149 tests across nine affected suites, covering text helpers, real rendering, settings, adapter/seam contracts, width transitions, SVG serialization and visualization export.
The real-renderer tests include both paused and running layout; foreground active-layout and capture timing remain deferred.

The planned P2f sibling audit found an unconditional endpoint-link intersection scan in arrangement reads, even though PR-E made canonical placement bindings authoritative.
Every populated-label path installs those bindings first; clearing them also clears the labels.
The scan and its unreachable legacy arrangement fallback were removed.
Four real-renderer cases failed when link reads were forbidden before the fix; all 12 renderer-editing tests then passed, with movement, pinning, camera and capture assertions retained.
Another 62 adapter/seam tests passed.
An initial green command also named two nonexistent test paths; only its reported 12 discovered tests count as evidence.
Scoped JavaScript formatting and lint passed.

## Retained failures and remaining gates

The first W1 baseline attempt requested an invalid 65 px width; the native validator correctly rejected it.
The harness was corrected to the supported 60 px step and the original failure was preserved.
The first SVG-only candidate's below-gate result and both strict numeric differences and failed precision control remain retained.
No failed receipt is converted into a pass.

Raw private W5 data, traces and labels remain external and must not enter Git, public issues or external review prompts.
The native inventory records retained review inputs; it does not establish cleanup or final verification.
The uncached baseline and all required failure evidence remain available through final review and acceptance.
