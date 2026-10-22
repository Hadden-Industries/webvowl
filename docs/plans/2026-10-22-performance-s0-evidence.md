# Production performance baseline and slice selection

## Status and authority

S0's diagnostic collection and selection assessment are complete against the accepted architecture source.
Remaining foreground timing acceptance is deferred by the owner's 22 October instruction, "Prioritize diagnostics; defer foreground timings."
This report does not establish a speedup, a passed foreground budget, or completed performance implementation.

The [approved performance plan](2026-10-21-performance-implementation-plan.md) remains the authority for order, ownership contracts, numerical gates and later decisions.
Execution `53badedd-cb77-4c5d-9f81-79b73fff1a0c` owns this work.
The owner separately authorized observing rather than enforcing the CPU preflight; every reading and overridden rejection remains retained.
No product optimization or configuration change was made to obtain this baseline.

## Reproducible baseline

| Input                       | Identity                                                                                                             |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Source commit               | `16e67c902e3438543f3ab520a40b45b2d9e2910a`                                                                           |
| Source tree                 | `a283a59a8cd8a30c55942bc32b261a88ed2b3ffa`                                                                           |
| Production manifest SHA-256 | `b282de8668741c403f1faee1610f0c546efcf5d2649ac7f7d1fdd1acd3b10de4`                                                   |
| Lockfile SHA-256            | `6c137dc6f69bfb4f70cc5db0ef4d7997fd76a1fc3544d33605612a733c49c458`                                                   |
| Entry                       | `js/index.js`, SHA-256 `ce3c3098fd0b197897d795c8e3d6ea36730f38b18b5c066f893d05991d7d354c`                            |
| Worker                      | `assets/canonicalVowlWorker-BmFov8DA.js`, SHA-256 `1278d62ffa49c5b346e070583e4e897ba2c96d6c6b49538e1080f3f3ee64418f` |
| Browser/runtime             | Chrome `156.0.8078.48`; Node `v24.22.1`; Windows `10.0.26300`                                                        |
| Display setup               | 1440 × 900, DPR 1; AC power; fixed power plan; production fonts awaited                                              |

The manifest contains 45 assets totaling 4,068,533 bytes.
The hidden-source-map build has byte-identical JavaScript, verified individually before source attribution.
The analyzer validates trace hashes, profile/trace clock agreement and result linkage.
Different main-thread samplers are not added together; worker chunks are joined by process and profile ID, with the owning thread taken from the profile header.

The maintained companion [measurement driver](../../util/measure-production-performance.mjs) uses the real production page, native browser input, the application controller and the actual worker.
Each B2–B6 cohort checks load, count/filter revisions, four native slider steps, selected details, rendered search results and ten accepted label edits.
It records native animation-frame timestamps separately from callback-entry clocks.

All seven workload variants completed separate counter and trace passes: one discarded warmup and one measured 19-operation cohort per pass, totaling 532 checked operations, of which 266 are measured diagnostic operations.
These passes are explicitly headless, with `acceptanceEligible: false`.
Counter passes install nine native wrappers; trace passes install none.
No benchmark ran concurrently with a build, test, scan or analysis job from this task.

W1, W2 and W3 use the packaged FOAF, benchmark and GoodRelations fixtures.
W4 uses both independently reconstructed 2,000-class fixtures from the existing browser qualification.
W5 uses the approved private ontology in `auto` and `all` modes, with 664 eligible nodes in `all`.
Its bytes, facts, URLs and raw traces remain outside the repository.
Workload hashes and byte lengths are bound in every result.

## Foreground calibration retained

W1–W3 each have 40 complete A/A cohorts, 20 per label, using identical production bytes.
Navigation has 20 cold and 20 warm samples per label after its discarded warmup.
The labels are calibration labels, not baseline/candidate versions.

| Workload | Largest absolute A/B operation-median difference | Observation                                                                      |
| -------- | -----------------------------------------------: | -------------------------------------------------------------------------------- |
| W1       |                                         14.55 ms | Every median difference below 8%; edit tails remain noisy                        |
| W2       |                                          41.9 ms | Load difference about 1.8%; admitted complete cohorts span two retained attempts |
| W3       |                                            28 ms | Largest median difference about 2.6%; tail differences are larger                |

Complete cohorts from interrupted W2/W3 attempts are admitted only through exact result identities and completion checkpoints.
Failed and partial cohorts remain retained.
A legacy W2 checkpoint has a separate source-bound admission record; original results were not edited.

Two foreground W4-connected warmups failed when the page lost foreground; one became hidden and stopped delivering animation frames.
The owner then deferred further foreground collection.
These failures are not product latency measurements.
W4/W5 foreground A/A, baseline/candidate comparisons and the B3/B4/B5 numerical acceptance budgets remain deferred.
CPU overrides also prevent claiming the original quiescent protocol passed.

## Copy and ownership evidence

The following are native `structuredClone` times from instrumented diagnostic passes.
Serialized-byte estimates add their own measured overhead and are approximate work indicators, not heap measurements.
Native clone times are not substituted for untraced end-to-end latency.

| Workload        | Click clone input, approximate MB | Click native cloning | Median native cloning across ten edits |
| --------------- | --------------------------------: | -------------------: | -------------------------------------: |
| W1              |                             0.425 |               2.6 ms |                                30.4 ms |
| W2              |                             0.676 |               4.0 ms |                                43.7 ms |
| W3              |                             1.017 |               4.6 ms |                                63.1 ms |
| W4 connected    |                             5.034 |              32.2 ms |                               514.7 ms |
| W4 disconnected |                             2.935 |              17.6 ms |                               242.7 ms |
| W5 auto         |                            12.546 |              66.7 ms |                               931.5 ms |
| W5 all          |                            12.519 |              64.3 ms |                               966.0 ms |

Every workload had one projected whole-inspection clone during click/details.
Each load had seven canonical-inspection clones; a node-count revision had three; the first edit had eleven.
The source-mapped W5 click profile attributes approximately 67–70 ms of sampled intervals to [the document session](../../src/app/js/controller/canonicalVowlDocumentSession.js).
This corroborates the counter path without claiming exact CPU execution time from sampling.

S2 therefore has both per-interaction document-sized work and costs above P2's 10 ms click falsifier.
S3–S5 have concrete copy-count targets, but their caller, contract and ownership audits remain mandatory.
Removing a copy is not authorized to remove its isolation responsibility.

## Search-cue gate and S1 disposition

The broad search counter counts reference-shaped JSON serializations, not exact reference resolutions.
It cannot by itself establish the cost of reveal cues.
The original W4 all-node search also does not adequately exercise hidden-result cues.

A separate [cue-phase probe](../../util/productionSearchCues.mjs) therefore times the complete existing `getOntologyNeighborhoodRevealPlan` call during native search input.
It temporarily intercepts controller construction, restores native `Object.freeze` before measurement, preserves results and exceptions, and runs without native counters or a CPU profiler.
The production assets are unchanged.
Tests cover result/receiver/argument identity, freezing, unrelated accessors, thrown identity and measurement exclusion.

W4 uses the same admitted 2,000-node documents with `auto` visibility and query `C199`; W5 retains `auto` visibility and query `a`.
These are explicitly separate hidden-result diagnostics.
An initial probe found larger first-query costs, so a second probe used five fresh load generations, discarding the first generation.
Each generation contains one first search and twenty repeated searches; every cue answer is checked for stability across all generations.

| Workload        | Cues per search | First-query median after warmup, four generations | Median of repeated-query generation medians | Retained threshold crossing                                      |
| --------------- | --------------: | ------------------------------------------------: | ------------------------------------------: | ---------------------------------------------------------------- |
| W4 connected    |               6 |                                           4.25 ms |                                     2.00 ms | None in the measured repeat; largest repeated observation 4.9 ms |
| W4 disconnected |               5 |                                           2.50 ms |                                     1.03 ms | One repeated observation 9.3 ms                                  |
| W5 auto         |               4 |                                           4.90 ms |                                     2.10 ms | One first-query observation 6.0 ms                               |

**S1 disposition: not selected under the approved measurement policy.**
Document-linear resolution and unused hidden-list construction exist, but the isolated typical complete cue cost is below the accepted 5 ms stop threshold.
W5 first-query cost is borderline, and the retained crossings prevent claiming that every sample passed that threshold.
On this contended host they do not establish a repeatable material cue hotspot; the first fresh-browser observations also include preparation/warmup effects.
This assessment makes no claim that the algorithm is constant-time or that all possible search queries were covered.

No structural-purpose exception is invoked.
Implementing S1 despite this evidence would require the owner's separate ownership/correctness basis under plan §4.4.
The existing resolver, cue eagerness and reveal policy remain in place.
The completed slice is its evidenced no-selection disposition, not delivery of the proposed indexes or lightweight cue API.
Later semantic-read ownership decisions must not silently resurrect S1.

## Rendering and worker attribution

| Workload        | Conservative style/layout share of traced first slider step | Ranking/identity share of traced load | Ranking/identity share of first traced edit |
| --------------- | ----------------------------------------------------------: | ------------------------------------: | ------------------------------------------: |
| W1              |                                                       31.4% |                                 22.6% |                                       26.4% |
| W2              |                                                       29.8% |                                  7.5% |                                       30.3% |
| W3              |                                                       35.0% |                                 26.3% |                                       30.2% |
| W4 connected    |                                                       59.2% |                                  4.5% |                                        3.9% |
| W4 disconnected |                                                       51.6% |                                  9.6% |                                        8.3% |
| W5 auto         |                                                       11.4% |                                 42.2% |                                       41.9% |
| W5 all          |                                                       46.9% |                                 32.6% |                                       32.0% |

The style/layout column takes the larger separately unioned `Layout` or `UpdateLayoutTree` interval family divided by the traced operation window.
It does not add potentially overlapping families.
Source profiles and the actual [text-width probe](../../src/shared/js/util/textTools.js) and [text-positioning reads](../../src/shared/js/util/CenteringTextElement.js) corroborate script-driven layout.
These diagnostic shares support selection, not predicted end-user speedups.

The existing `layoutReadMs` counter covers `getBBox`, `getBoundingClientRect` and `getComputedTextLength`.
It excludes `offsetWidth` and computed-style reads, so it is not total forced-layout cost.
W4-connected revisions construct roughly 44,000 DOM elements and perform about 6,000 counted bounding-box reads; its trace exposes the much larger repeated style/layout work.
LoAF entries are retained where observed.
Support without entries is not reported as zero long frames, and headless LoAF results do not satisfy the deferred foreground slider budget.

S6 passes its initial attribution gate on W4 and W5 `all`; geometry, font/style invalidation and lifetime proof still determine whether a candidate is acceptable.
Do not jump ahead of S2–S5.

The worker has explicit ranking/identity phase marks.
W5's approximately 4.3-second marked phase exceeds the stronger 25% experiment-admission gate in both modes.
This is not authorization for package changes: S7's exact experiment and package scope remain owner decisions after S6.
Worker profile start is not worker-ready time; no startup claim justifies an idle-worker exception.
The no-idle-worker default remains accepted.

## Ordered disposition and next proof

| Slice | Current disposition                                                         | Required next proof or decision                                                                                       |
| ----- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| S0    | Diagnostic selection work complete; foreground acceptance deferred by owner | Preserve raw evidence and qualify later candidates against the retained baseline                                      |
| S1    | Not selected                                                                | No optimization or claimed cue speedup; retain resolver/cue limitations                                               |
| S2    | Selected for implementation under DEC-002                                   | Audit every inspector consumer; prove deep immutability, owned outputs and zero selected-read whole-inspection copies |
| SF    | Owner decision pending after S2                                             | Residual read preparation or a specifically accepted invalidation-ownership benefit                                   |
| S3    | Copy evidence supports its gate; wait for SF disposition                    | Complete result-consumer audit and originating-revision materialization proof                                         |
| S4    | Copy evidence supports its gate; wait for S3                                | Independent drawing-consumer audit and contract R conformance                                                         |
| S5    | Copy evidence supports investigation; wait for S4                           | Producer ownership, untrusted admission/accounting, mutating collaborator and lifetime proof                          |
| S6    | Initial attribution gate met; wait for S5                                   | At least 50% lower attributable layout with unchanged geometry and correct invalidation                               |
| S7    | Package-phase experiment is a measured option, not selected                 | Owner chooses one exact experiment and package scope after predecessor evidence                                       |
| S8    | Conditional                                                                 | Reassess remaining construction/DOM cost after S2–S7; design only if selected                                         |

## Evidence retention and limitations

All locators below are relative to the configured HISEW evidence root, outside Git.
Raw private traces must not be supplied to public reviews or issues.
Native verification receipts and operator/browser evidence are distinct.

| Evidence group                              | Retained material                                                                                                                                 |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `operator/08f580d8ff5a45a0be9dfe528e20d732` | Production assets/maps/manifest, W1–W3 and navigation A/A, all foreground failures, owner CPU/foreground decisions, admission/checkpoint analyses |
| `operator/e98a6aa85e9f4834873cbc4b1840a899` | W1–W3 counters/traces, source-map analyzer, `s0-diagnostic-matrix.json`, immutable harness snapshots 12/13                                        |
| `operator/6c46426162594a15a9910d2ea3d6bb97` | W4-connected counters, failed trace, successful `trace-2`, source attribution                                                                     |
| `operator/876b8c340e9a4635b5d307cf88222466` | W4-disconnected counters, trace and attribution                                                                                                   |
| `operator/2e9a137a6ef345608a9ab9f988933b0e` | Private W5-auto counters, trace and attribution                                                                                                   |
| `operator/ff117630943c442a83c7bd9be3d695d1` | Private W5-all counters, trace and attribution                                                                                                    |
| `operator/2c673ca938384aa49bc849147f11c459` | Initial and repeated-load cue probes, `cue-repeat-summary.json`, immutable harness snapshots 14/15                                                |

The first W4-connected trace failed Chrome's data-loss check.
Its bytes remain retained.
The retry used a bounded 512 MiB diagnostic trace buffer with usage reporting, reached at most 39.4% observed occupancy and completed all operations with no lost data.
No lost-data trace was admitted.
The change affects diagnostic collection only.

The analyzer preserves main/worker coverage, unmapped intervals and sampling gaps.
CPU-profile intervals represent sampled elapsed attribution, not exact CPU time under contention.
Inclusive categories overlap.
A/A labels refer to the same source; candidate switching and subsequent comparisons are still required when foreground work resumes.
The full performance candidate's configured tests and final external AGY review have not yet run.
Harness checks currently pass 13 tests across two suites, plus focused formatting/lint and the retained real-browser runs.
