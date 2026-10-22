# Performance ownership implementation evidence

## Scope and status

S3–S5 are implemented under the [approved performance plan](2026-10-21-performance-implementation-plan.md).
These are development and headless diagnostic results, not final full verification, external review, or foreground acceptance.
The owner deferred foreground timings and confirmed the sequence: diagnose, fix, verify correctness and lifetime, then compare the consolidated candidate in the foreground.
Architecture commit `16e67c902e3438543f3ab520a40b45b2d9e2910a` remains the source baseline.

## Implemented contracts

- S3: session results capture identity and scene immediately; enumerable inspection and checkpoint fields produce one mutable owned copy on first read.
  Repeated reads reuse that result's copy, while separate results and older revisions remain isolated.
  Result forwarding avoids enumerating the lazy fields.
- S4: drawing DTOs no longer contain the unused semantic inspection.
  Rows, bindings, camera, display and their ownership boundaries remain intact.
- S5: one copied, recursively frozen inspection is owned at acceptance and reused by internal preparation and retained facts.
  A private weak identity set recognizes only inspections this boundary has actually owned; a shallow-frozen collaborator result is insufficient.
  Checkpoint transport uses native synchronous serialization for receiver isolation while preserving full measurement, limits, deadlines and validation.

Public owned-copy reads remain available.
The S2 internal reader remains deeply frozen and borrowed.
SF was not selected; contract S was not adopted.

## Copy diagnostics

Production W1, W3 and W5-all each passed 19 warmup and 19 measured operations.
The source-bound `s5-manifest.json`, source snapshots, patch and raw results are retained in HISEW operator group `f5ede2a10d824c7590e41eef87aafedb`.
Baseline counts come from the corresponding S0 workload results.

| Operation     | S0 inspection copies | S5 inspection copies | Other result                                             |
| ------------- | -------------------: | -------------------: | -------------------------------------------------------- |
| Load          |                    7 |                    1 | Projected-inspection copies 1 → 0                        |
| Visible count |                    3 |                    0 | No whole inspection copied                               |
| Filter        |                    3 |                    0 | No whole inspection copied                               |
| Click         |                    0 |                    0 | Projected-inspection copies 1 → 0, retaining S2's result |
| Edit          |                   11 |                    4 | Projected-inspection copies 2 → 0                        |

For W5-all, approximate serialized input to clone calls fell from 210,370,495 to 109,606,078 bytes on load, 65,442,619 to 2,628,031 on count, and 312,475,058 to 78,945,373 on the first edit.
These byte estimates describe clone inputs, not actual heap allocation or latency.

## Retirement failure and repair

The first optimized lifetime run detected one old inspection still reachable after an edit.
The session's presentation sequencing promise forwarded the successful load result, retaining its newly lazy fields.
The repair makes only the stored sequencing promise discard both successful and failed result values; the public load still returns its original acceptance result.
Focused session/controller checks passed all 77 tests after the repair.
The failed run is retained unchanged as `W5-auto-lifetime`.

The corrected source has its own `s5b-manifest.json`, build log, patch and source snapshots.
The prior counter run predates this repair; the repair changes retained promise values, with no change to clone-call paths.
No source identity is relabelled.

## Equal-live-size lifetime proof

The S2 production build is the baseline because it exposes the borrowed internal reader needed by the weak-owner probe.
Both builds used W5-auto and completed two retained-result positive-control generations, release of those controls, ten load/edit/capture cycles in one live application, and final controller disposal.
The probe captured the real session without replacing its methods and restored native freeze after capture.
Each cycle had 2,192 occurrences, revision 1, a complete capture, zero retired borrowed inspections/projections, and zero live workers.
Positive controls detected two old owners and their release returned that count to zero.
All tracked owners were collectible after disposal.

| Diagnostic checkpoint                   |      S2 baseline | Corrected S5 candidate |
| --------------------------------------- | ---------------: | ---------------------: |
| Heap used after collection, cycle 10    | 84,982,216 bytes |       34,146,744 bytes |
| Heap used after disposal                | 45,011,020 bytes |        6,926,544 bytes |
| Retired owners alive, every cycle       |                0 |                      0 |
| Workers alive, every cycle and disposal |                0 |                      0 |

Raw runs are `W5-auto-lifetime-baseline-2` and `W5-auto-lifetime-2` in the same operator group.
The first baseline attempt failed on missing harness cohort metadata; its result and the corrective test's red/green logs remain retained.
The baseline weak probe cannot identify independent eager result copies as borrowed inspections, but the heap totals include those copies.
These are forced-GC observations at equal live size, not exact peak memory, statistical latency results or physical paint measurements.

## Tests, audit and remaining gates

S3 affected verification passed 132 tests in six suites; S4 passed 222 in nine suites.
S5 ownership/worker tests passed after correcting a draft fixture to model a deserialized mutable checkpoint; the original failing receipt remains available.
The maintained lifetime harness has positive-control and orchestration tests, including a test that failed on the first harness defect.
All scoped source formatting and lint checks passed before production collection.

The bounded sibling audit found the legacy `hasParallelLinks` scan still runs before canonical pinning bindings override its answer.
Its scope and any removal remain part of the S6 rendering audit.
S6, S7 selection, S8 disposition, final exact-candidate verification, final AGY review and UI handoff remain outstanding.
