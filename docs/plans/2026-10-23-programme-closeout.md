# Architecture, performance and UI closeout

Date: 23 October 2026.
The ordered implementation is published on `feat/architecture-performance-ui` and consolidated in [PR #85](https://github.com/Hadden-Industries/webvowl/pull/85).
Architecture, performance and UI source delivery are complete at their recorded checkpoints; this follow-up removes the viewport zoom restriction and makes the remaining acceptance limits explicit.
On 25 October 2026 the owner authorized repairing CI and normally merging the PR after the required checks pass; the actual-platform acceptance batch remains unrun.
No deployment or change to the legacy force algorithm is included.

## Zoom and automated accessibility

The viewport declaration now retains device width, initial scale and safe-area fitting without `maximum-scale=1` or `user-scalable=no`.
The accessibility qualifier no longer exempts the `meta-viewport` rule.
HTML validation, formatting and the production build passed.
The existing accessibility qualification passed the page, Overview, nested facts, preview, Details, narrow portrait/landscape, forced-colors and compact-editor checks.
The chooser retains its separately justified `scrollable-region-focusable` disposition and keyboard-scroll proof.

This removes a page-authored zoom constraint; it does not prove physical pinch gestures, actual browser zoom, native screen-reader announcements or mobile keyboard behavior.
A DevTools keyboard-shortcut attempt did not change the observed zoom and is not counted as real-zoom evidence.
The [single manual packet](2026-10-23-ui-manual-validation.md) retains those checks.

## Focused count and layout observations

The production collector now supports `--count-adjustment-only`, using the existing immutable manifest/fixture bindings, native keyboard input, CPU exception, foreground admission and two-frame boundary.
Three native inputs must produce exactly one accepted final count, with unchanged document identity and the user's Pause/Resume choice restored.
It separates first-input-to-frame time, the last-input delay, controller application and application-to-frame time.
Controller application includes the runtime's observed-paint await; it is not a CPU-only duration.

`--count-initial-layout=settled` first observes at least five seconds of initial active layout, with movement verified from retained node transforms, then waits for settlement before count observations.
The `fresh-paused` alternative preserves the initial-load stress case without warming it through layout first.
`--count-backdrop-control` is restricted to headless traces and explicitly records altered presentation; it cannot supply production latency acceptance.
Setup now rechecks foreground immediately before loading the workload, and the active-layout probe has a bounded wait for missing animation frames.

The final foreground runs each completed four ABBA cohorts with four operation combinations per cohort, plus four warmups: 16 recorded operations per workload, four per combination.
All count-batching, document-identity and layout-choice assertions passed, with no foreground loss during those observations and a clean Chrome exit.
These are descriptive observations on the authorized contended host, not twenty samples per A/A group, complete S0 cohorts, field INP or a before/after improvement ratio.

| Workload and state                 | Controller application | Application through two frame opportunities |
| ---------------------------------- | ---------------------- | ------------------------------------------- |
| W5-all, 664 nodes, running         | 66.8–84.0 ms           | 110.4–128.2 ms                              |
| W5-all, paused                     | 64.4–74.7 ms           | 80.2–92.6 ms                                |
| W4-connected, 2,000 nodes, running | 167.6–236.7 ms         | 240.6–372.9 ms                              |
| W4-connected, paused               | 164.8–188.8 ms         | 188.2–209.8 ms                              |

The intentional quiet period was approximately 1,003–1,014 ms after the final input.
Filters dismissal started application approximately 9–25 ms after the final input instead.
The ranges above exclude that waiting period; the retained receipts also contain complete input-to-frame durations.

Initial active layout remains slow.
W5-all recorded 15 changed-geometry frames over 5.14 seconds, with 14 frame intervals and a median of 337 ms.
W4-connected recorded four changed-geometry frames over 6.68 seconds, with only three intervals and a median of 2,887 ms.
The graph then took a further 8.25 and 127.17 seconds respectively to settle in these particular runs.
Those small frame samples prove actual movement and poor observed cadence; they do not establish a stable percentile or performance across devices.

## Diagnosis and unresolved acceptance

Before settlement, the first W4 warmup took 14.20 seconds from input through the frame boundary, including 5.14 seconds in controller application.
Repeated observations confirmed the problem, so the collector was deliberately stopped rather than completing forty expensive cohorts.
A separate headless trace recorded about 4.51 seconds in GPU tasks and 0.60 seconds in renderer-main tasks during its roughly five-second window.
These are thread-duration observations, not additive exclusive CPU costs or proof of a particular GPU/driver defect.
Disabling only the full-page popover backdrop blur did not materially change the result, so no styling change was adopted.

After settlement, the headless trace's recorded application durations were 184.7–202.4 ms; its running-dismissal observation still contained a 235.2 ms long animation frame.
The trace is instrumented and cannot qualify the original foreground budget.
The W4 requirement of no long animation frame over 200 ms and W5's half-baseline requirement remain unqualified; no baseline ratio is invented and no budget is waived.
The established drawing and fresh-load cases must not be pooled or substituted for one another.

The accepted S8 decision explicitly reserves physics changes and broader renderer architecture for a new owner decision.
Further work on initial layout should therefore begin with a bounded design and a reproducible fresh-load comparison, preserving drawing identity, exports, force semantics and existing small-workload guards.
The present closeout does not claim that the initial large-graph experience is fast.

## Evidence, publication and remaining owner batch

Retained evidence is under `C:/Users/maksy/.hi/w/e/operator/16557566c924469fb5e117f2cfbe6e03`:

- `accessibility-closeout-2` and `ui-production-manifest-closeout.json` bind the viewport correction and production output.
- `foreground-closeout-W5-settled-1` and `foreground-closeout-W4-settled-3` contain the completed observations above.
- `foreground-closeout-W4-1`, `trace-closeout-W4-1`, `trace-closeout-backdrop-control-1` and `trace-closeout-W4-settled-1` retain the stress case, diagnosis and rejected hypothesis.
- `foreground-closeout-W4-settled-1` and `foreground-closeout-W4-settled-2` retain rejected setup attempts: foreground loss and a hidden-window frame wait.
  Neither is an acceptance pass.

The full UI check remains the previously passed 10,026-test candidate; application JavaScript, runtime declarations and dependencies are unchanged by this closeout.
The HTML change receives HTML/build/accessibility checks; measurement-tool changes receive focused tests and lint/format checks.
A narrow external follow-up reviews this delta after those checks, preserving the earlier broad review and security scan instead of repeating them.
AGY Flash 3.8 High completed that review against independent snapshot `3998dc10444ef11d0b34ae5ff243e7f64c65afa5` (tree `68ef8b8e14b0f19d58f1286427d577da31f97a11`) with no findings or requested source changes.
Its 60-minute allowance was unchanged; the process exited successfully after approximately 7.4 minutes with complete output and no remaining producers.
The final report matches the supplied candidate and assignment digests and passes its JSON schema; all ten development files matched the reviewed bytes before this outcome was added.
The native report-submission hook rejected its `finish` call after a corrected schema attempt, so the report is retained as external static evidence under the owner's bookkeeping instruction, without claiming native reviewer qualification.
No source, command or browser tool executed during the review; the immutable raw output, extracted report and parent disposition are retained as `agy-closeout-output.ndjson`, `agy-closeout-report.json` and `agy-closeout-disposition.json`.
This review-outcome addition is checked by the parent separately and is not represented as part of the frozen external input.
Before the closeout push, all 15 hosted checks passed for `1a2c644be56be19f906249c6e6343ef9e1f3e88f`; a later push requires its own hosted readback.

The owner batch consists of the manual packet's actual-platform combinations, an explicit disposition of the performance limits above, and then merge/release acceptance.
Unavailable combinations remain recorded as unrun until the owner accepts that limitation or supplies results.
Deployment remains separate.
HISEW receipt admission and retained-resource disposal remain separate from source delivery; [HISEW issue #197](https://github.com/Hadden-Industries/software-engineering-workflow/issues/197) tracks the native scratch-disposal blocker.
The later resource observation records approximately 1.87 GiB of retained evidence and browser scratch, exceeding the existing 1.25 GiB allowance; that unresolved overrun is recorded in the resource handoff rather than silently increasing the allowance or bypassing native cleanup.
No failed receipt is rewritten, no native completion is claimed, and no unchanged full suite is repeated merely for bookkeeping.

## Owner disposition after closeout

On 23 October 2026 the owner selected “Keep PR draft; plan a bounded initial-layout improvement” and “Keep manual acceptance pending until the batch is validated.”
The performance limits and unrun platform combinations are therefore not waived.
The [initial-layout improvement plan](2026-10-23-initial-layout-improvement-plan.md) records the bounded follow-up; the owner subsequently approved PERF-DEC-013 option A and its numerical targets on 23 October 2026.
Following the owner's suggestion, its recommended first experiment compares better spacing with inexpensive topology-aware initial positions for newly loaded ontology sources, keeping the force solver and scheduling unchanged.
Saved layouts remain a compatibility constraint; there is no usage telemetry establishing their relative frequency.
It also distinguishes this collector's paused-load/reheat preconditions from an ordinary automatically running load: the 127.17-second settling phase followed a deliberate reheat, rather than measuring ordinary load duration.
The retained observations remain unchanged.

The approved initial-placement follow-up now has a tested production candidate and four real W6 all-node foreground observations, but its final qualification, review and delivery remain incomplete.
The owner considers the remaining 12.797–12.992-second source-to-frame delay unacceptable and requested deeper attribution.
The [whole-load profile and optimization proposal](2026-10-23-whole-load-profile-and-optimization-proposal.md) records the measured worker bottlenecks, bounded optimization options and a proposed separate whole-load budget.
The owner approved PERF-DEC-014 Option A plus a separate design for cheaper display-ranking identity, including the five-second W6 whole-load p95 target.
Bounded exact-semantics optimizations are authorized; changed ranking semantics, exact dependency/configuration changes and acceptance waivers remain separate decisions.

The owner subsequently approved PERF-DEC-015's bounded display-order experiment with conditional adoption.
OWLAPI PR #85 passed remote qualification and merged normally before WebVOWL pinned the tested signed commit.
The combined candidate is undergoing application qualification; this does not waive the whole-load targets or the outstanding manual acceptance batch.
The owner waived AGY review and extra runs solely for HISEW bookkeeping for this follow-up.

The owner subsequently authorized a cheap connected first selection, graph drawing before final ordering, and disabled count controls until preparation completes.
This is implemented with continuation in the same worker and no replacement of the visible prefix.
One headless automatic W6 load reached its first fifty nodes in 4.071 seconds while ordering was still preparing; the final whole-load foreground percentile remains unqualified.
The other bounded validation, snapshot, path-formatting and label-shortening candidates are implemented with focused correctness and geometry evidence in the whole-load proposal.
The final full check is reserved for this consolidated commit, as requested; neither these diagnostics nor earlier full-suite results close manual platform acceptance.

That full check passed 10,119 tests across 190 suites and the complete repository check pipeline.
A subsequent heap-backed retention finding was repaired with a narrow allocation change, then passed 98 affected tests and ten native W6 load/edit/capture cycles plus disposal with zero retained old owners or workers.
The full suite was not repeated solely to relabel that focused repair as a fresh broad receipt.
The first optimized foreground attempt failed admission before collecting samples; its receipt remains unchanged.
The later [foreground performance report](2026-10-23-foreground-performance-results.md) records complete W6 Auto/All load cohorts and W4/W5/W6 fresh running-layout count cohorts against signed source commit `d9edffb9d0c476d91af94191c5df2402c9ae52cb`.
W6 ordinary-load p95 is at most 4.282 seconds, and all three count-response cohorts meet one second under the owner's CPU exception.
W6 replacement of a running graph remains slower at 5.487 seconds p95; W4's 200-ms LoAF criterion and W5's matched half-baseline criterion remain open.
These distinct outcomes update the evidence without completing programme acceptance.
The manual packet now also includes announcement/focus behavior while count preparation transitions from disabled to available.
This follow-up is source delivery to the existing draft PR, with no merge, deployment or complete programme acceptance claim.

## CI repair and merge authorization, 25 October 2026

The owner authorized fixing the failing CI and a normal merge of PR #85 when those checks pass.
This supersedes the earlier draft-only delivery instruction, while preserving the manual packet's unrun status and the accepted active-frame cadence limitation documented in the [rendering follow-up](2026-10-24-active-graph-performance-follow-up.md).
It does not authorize deployment or establish device and assistive-technology results.

At head `9510bbebc1a97f3d85fcc0929ce9d68c6120ec69`, Ubuntu's application and JSON jobs failed during JSON Quality installation because the pinned Git dependency's lock integrity did not identify an available npm cache archive.
Windows installation succeeded, but its complete corpus test exhausted the default 120-second aggregate check deadline.
The original failures remain recorded in [CI run 40173928213](https://github.com/Hadden-Industries/webvowl/actions/runs/40173928213).

The JSON Quality registry migration was separately approved by the owner on 24 October in Codex thread `01a165ac-9451-7c30-813a-c81e5f34223e`.
WebVOWL now selects the published `@hadden-industries/json-quality@1.0.0-rc.1` and its exact optional native platform packages through a native npm-generated lockfile.
The producer's matching acquisition bootstrap forbids Git dependencies for this isolated JSON installation and retains installed-payload verification.
All seven local JSON integration tests pass with this release, including the independent 5,851-document corpus census in 79.4 seconds; this local result does not establish hosted Windows timing.
The owner approved a five-minute aggregate JSON check deadline on 25 October.
The single `runtimeControls.maxCheckTimeMs` setting in `.json-quality.json` applies to both API tests and CLI checks; all document coverage, validation and other limits remain unchanged.
