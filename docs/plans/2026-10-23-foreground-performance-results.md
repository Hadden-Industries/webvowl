# Foreground performance results after whole-load optimization

Date: 23 October 2026.

The optimized W6 ordinary-load cohorts meet the five-second whole-load p95 target in both automatic and all-node modes.
Fresh running-layout count changes meet the one-second response target for W4, W5 and W6.
These are qualified observations on the owner's contended Windows host.
They do not close every performance or platform acceptance requirement; draft PR #85 remains draft.

## Candidate and measurement boundaries

The measured application is signed commit `d9edffb9d0c476d91af94191c5df2402c9ae52cb`.
Production manifest 7 has SHA-256 `5305787a17325d010632f0dc61d9c71304139b928d167fc3010688e6ec3a3c22`.
Its build record names the pre-commit parent, so a separate binding verified all 65 non-document source inputs against the committed candidate.
The later CodeQL v4.38.3 pin update and this report do not change those production inputs.

Each load mode and each count finishing condition has 40 admitted observations, with 20 in each A/A group, after discarded warmups.
The ABBA schedule labels A and B use identical production bytes; they are calibration groups, not old and new implementations.
Percentiles use the nearest-rank method separately for each group.
There is no matched before/after speedup ratio.

The native collector retains viewport, browser/GPU identity, production/source hashes, fixture hashes, CPU readings, raw measurements and exceptions.
The owner explicitly allowed execution despite CPU-preflight failures.
Consequently these results do not satisfy the original quiet-host protocol.
Foreground visibility and focus remained mandatory throughout admitted operation windows.
Two observed animation-frame opportunities define the timing endpoint; it is not an external measurement of physical screen presentation.

W6 uses the real Universal Ontology extended source: 3,023,054 bytes, 953 counted nodes, SHA-256 `d7eb7980436600ab50c8a5df35401a4a345fe4362d111f2d8e6f90217505b077`.
Automatic mode initially shows 50 nodes; all-node mode shows 953.
W5 uses the real core source: 2,298,206 bytes, 664 counted nodes, SHA-256 `85214ddc93194fccf5c0fc4bbbc8f34ab54e54f4abb352f0543411fd56b1c3f6`.
W4 remains the connected 2,000-node synthetic stress case.
Private source contents remain outside Git.

## Ordinary W6 loads

Whole load includes browser-side loading/conversion, model preparation, drawing installation and the observed frame boundary.
File-picker interaction and acquisition of the local fixture are outside this boundary.
Seed preparation and admitted-data-to-frame are nested measurements, not additional costs to add to whole load.

| Metric                     | Auto A   | Auto B   | All A    | All B    |
| -------------------------- | -------- | -------- | -------- | -------- |
| Whole-load median          | 3.810 s  | 3.844 s  | 4.133 s  | 4.139 s  |
| Whole-load p95             | 3.974 s  | 4.012 s  | 4.281 s  | 4.211 s  |
| Seed preparation p95       | 6.2 ms   | 5.7 ms   | 8.6 ms   | 7.9 ms   |
| Admitted data to frame p95 | 292.7 ms | 300.2 ms | 570.2 ms | 530.5 ms |
| Natural settlement p95     | 1.536 s  | 1.544 s  | 10.874 s | 10.781 s |

The largest observed whole-load duration was 4.049 seconds in Auto and 4.284 seconds in All.
All 80 admitted runs naturally settled, retained their initially installed node elements and completed ordering.
The largest per-run p95 frame interval was 4.3 ms in Auto and 41.7 ms in All; the maximum individual intervals were 12.6 ms and 125 ms.
These observations satisfy the five-second whole-load, 50-ms seed, one-second admitted-data-to-frame, 50-ms frame-p95, 200-ms maximum-frame and 12-second settlement thresholds for these W6 cohorts.
They do not qualify W4/W5 initial-layout cohorts or the W1–W3 matched regression guard.

## Count changes while layout is still running

Each count operation starts from a freshly reloaded, automatically running all-node drawing, with final count ordering ready.
The collector asserts that layout is still relaxing.
Three native keyboard inputs produce one accepted final count, with a net change of one node.
Document identity and the user's running-layout choice are preserved.
This exercises batching during initial movement; it is not a measurement of every possible large count jump.

Quiet-period timing starts when application begins and excludes the intentional one-second delay after the last input.
Dismissal timing conservatively includes the entire input burst, dismissal, application and observed frame boundary.
The table reports the larger p95 of the two 20-sample A/A groups.

| Workload                  | Quiet: application to frame p95 | Dismissal: first input to frame p95 | Maximum quiet / dismissal |
| ------------------------- | ------------------------------- | ----------------------------------- | ------------------------- |
| W4 connected, 2,000 nodes | 558.0 ms                        | 874.6 ms                            | 612.5 / 914.6 ms          |
| W5 all, 664 nodes         | 191.0 ms                        | 156.9 ms                            | 241.3 / 164.2 ms          |
| W6 all, 953 nodes         | 186.2 ms                        | 338.4 ms                            | 210.8 / 352.7 ms          |

All 240 admitted count operations passed the batching, document-identity and layout-choice assertions.
These response measurements pass the one-second target in this scenario.
Controller application includes an asynchronous paint await and must not be reported as synchronous main-thread blocking.

### Replacing a running graph remains slower

The count collector also times the preceding loads, which replace an already running graph.
Those observations have different preconditions from the ordinary-load cohorts and are kept separate.

Across 80 W6 replacement loads, median whole load was 4.805 seconds, p95 was 5.487 seconds and the maximum was 6.664 seconds.
Fifteen exceeded five seconds.
The separate A/A p95 values were 5.487 and 5.459 seconds, so this replacement scenario does not meet the five-second threshold.
For W5 replacement loads, median was 3.613 seconds, p95 was 4.214 seconds and the maximum was 6.792 seconds.

CPU preflight readings reached about 46% during the W6 count cohort and 64% during W5.
Those readings establish host contention, not its causal contribution to a particular slow load.
No claim attributes the replacement gap to the force solver, old drawing, CPU contention or worker behavior without further profiling.
The bounded next diagnostic is to attribute replacement while retaining these ordinary-load and count results; a broad repeated benchmark census is unnecessary.

### W4 long-frame criterion remains open

The latency cohorts do not install a Long Animation Frames observer.
Their empty LoAF arrays therefore cannot prove the absence of long frames.

A separate instrumented W4 diagnostic contains warmup and measured quiet/dismissal operations, with complete traces and no trace-buffer loss.
The measured quiet operation contains a 202.7-ms animation frame beginning approximately 0.1 ms before the first input and overlapping its window.
The strict no-LoAF-over-200-ms criterion has not passed.

The same buffered observer reports 290.2-, 425.8- and 728.1-ms entries whose frame work ended before the corresponding count windows began.
Their later presentation timestamps are retained separately.
They cannot be attributed to count-application work merely because the observer delivered them during collection.
The available script entries do not provide source attribution.
One instrumented observation is not a stable regression estimate; the narrow remaining investigation is the overlapping frame and its cause, not another full-suite run.

## Retained receipts and selection

All evidence is under `C:/Users/maksy/.hi/w/e/operator/16557566c924469fb5e117f2cfbe6e03`.
The aggregate files list the exact receipt and cohort index for every selected observation.

| Evidence                                                                           | Role                                                                   |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `whole-load-foreground-committed-build-binding-1.json`                             | Committed-source to existing production-build binding.                 |
| `whole-load-foreground-summary-1.json`                                             | W6 Auto/All load, frame and settlement aggregates.                     |
| `whole-load-count-foreground-summary-1.json`                                       | W4/W5/W6 count aggregates and separately classified replacement loads. |
| `whole-load-W4-count-trace-summary-1.json`                                         | Raw LoAF timing and explicit interaction-window overlap.               |
| `whole-load-W6-auto-final-foreground-2`                                            | All 40 Auto load observations.                                         |
| `whole-load-W6-all-final-foreground-2`, `whole-load-W6-all-final-foreground-3`     | All-load indices 1–24 and resumed indices 25–40.                       |
| `whole-load-W4-count-fresh-foreground-1`, `whole-load-W4-count-fresh-foreground-2` | W4 count indices 1–4 and 5–40.                                         |
| `whole-load-W5-count-fresh-foreground-1`                                           | All W5 count observations.                                             |
| `whole-load-W6-count-fresh-foreground-1`, `whole-load-W6-count-fresh-foreground-2` | W6 count index 1 and resumed indices 2–40.                             |
| `whole-load-W4-count-fresh-trace-1`                                                | Separate diagnostic traces; no latency-percentile substitution.        |

The first All-load attempt lost foreground during index 25's layout observation.
That entire index was excluded, including its already recorded load row.
The first W6 count attempt lost foreground during index 2; that incomplete pair and its preceding load were excluded.
Both failed receipts remain unchanged.
New attempts resumed only unfinished indices, with new discarded warmups; every final group contains unique indices 1–40.
A W4 preflight focus loss occurred between samples and recovered before admission.
All collector Chrome processes exited normally, and the retained reports contain no browser exceptions.

## Acceptance and delivery

The [whole-load decision](2026-10-23-whole-load-profile-and-optimization-proposal.md) and [initial-layout plan](2026-10-23-initial-layout-improvement-plan.md) retain their original requirements.
This report updates the evidence; it does not waive an unmet budget.

Remaining work includes the slower W6 active-replacement scenario, W4's 200-ms LoAF requirement, W5's matched half-baseline requirement and any other original workload comparisons not qualified by these selected cohorts.
The historical settled-layout baseline cannot supply a valid ratio for fresh running-layout changes.
The [single manual packet](2026-10-23-ui-manual-validation.md) remains pending for actual assistive technology, native IME, zoom, touch/keyboard and contrast combinations.
Merge and deployment remain separate owner decisions.

The accompanying dependency update adopts the two CodeQL v4.38.3 action pins from [PR #80](https://github.com/Hadden-Industries/webvowl/pull/80).
Its stylelint-order 8.1.2 declaration, locked artifact and PostCSS constraint were already present and needed no edit.
The markdown-quality workflow and packages are unchanged.
Application source, dependencies and production output are unchanged by this evidence/CodeQL checkpoint, so existing full-suite and production evidence remains applicable to the application.
Scoped document/workflow checks and the new remote CodeQL run qualify this checkpoint; no application suite or browser census is repeated solely for bookkeeping.
