# UI source handoff

Date: 23 October 2026.
The accepted A1–A4 and B1–B5 implementation, automated checks and final reviews are complete; B6 remains unselected.
The remaining real-device and assistive-technology requirements are collected in the [manual-validation packet](2026-10-23-ui-manual-validation.md).
Source publication is confined to `feat/architecture-performance-ui`; merge, hosted CI, deployment and complete platform acceptance are separate outcomes.

## Delivery and reviewed identity

The ordered programme retains architecture commit `16e67c902e3438543f3ab520a40b45b2d9e2910a`, performance commit `20eb888693bae1434720b6023608c35dd3dc75f3`, UI documentation checkpoint `73f6a44f0ae91b054ac77574b697bfde9278dfce` and signed UI implementation checkpoint `29a59036361cec62f67b6398c910f17b2fd35ab4`.
The final signed UI delivery is the feature-branch commit containing this handoff and its follow-up changes; its full SHA is reported after signature verification and remote readback.

Final reviews inspected the independent, clean review snapshot `c6eeb3eeceed762eb35deed2374a94333ff232a3`, tree `21b0123e7fe88427f75704e7836d7e30aef69849`, relative to the performance commit.
The recorded source digest is `1197cb7658808d9a03a13cc20cb0117581edeaca9445e333076d7831feb909bf`.
That disposable snapshot has independent Git storage and is retained as review evidence, not incorporated into development history.
The final documentation records review outcomes; application, runtime configuration and qualification-tool bytes remain those of the reviewed and tested candidate.

## Resulting behavior

The grouped ontology chooser searches curated H1–H4 sources and packaged examples, distinguishes committing a suggestion from loading it, protects IME composition and held Enter, and preserves drafts and current-source identity.
Overview and retained facts are available on demand.
Details and editing adapt between a dock and a modal while preserving their existing DOM and focus.

One semantic presentation model retains all eight supported roles and every returned description field.
Related entities, including hidden entities, can be inspected inside Details with Back to the graph selection, as accepted in UI-DEC-022 option 1.
Controller selection remains authoritative.

Selected previews use an explicit occurrence-geometry contract, one coalesced placement, cached box measurements, bounded animations, immediate reduced-motion behavior and hidden-tab suspension.
Final diagnosis fixed a one-frame stale placement and missing selected-geometry notification during held zoom.
These changes preserve graph/export identity and explicit Pause/Resume intent.

The runtime amendment uses one maintained declaration per tool: `.node-version` selects Node 24.22.1, `.python-version` selects Python 3.15.1, `.uv-version` selects uv 0.13.5, and `package.json` owns npm's native minimum of 12.2.1.
The shared `util/runtimeTargets.mjs` supplies validated projections to setup, Python tooling and CI; the exact CI npm installation derives from that same minimum.
README links replace duplicate version literals.
No application dependency, lock graph or global tool installation changed.

## Verification and measured limits

`npm.cmd run check` on the aligned toolchain completed with exit zero in `ui-full-check-6.log`: 10,026 JavaScript tests across 183 suites, 28 Python tests with two skips, three Markdown integration tests, seven JSON integration tests, repository lint/format, production build and generated JSON checks.
The existing large-bundle build warning remains visible.
Final documentation receives scoped formatting and lint; the application suite is reused because application and configuration bytes did not change after review.

Chromium 156.0.8078.4, Firefox 153 and WebKit 27.2 each passed all nine functional checks, including the held-zoom regression, complete semantic descriptions, relation identity, keyboard/focus, responsive surfaces and disposal.
The accessibility and graph diagnostics additionally cover forced colors, contrast fixes, export equivalence, distinct repeated occurrences, and rapid selections in 1,000- and 10,000-node synthetic renderings.
They do not establish actual Safari/iOS, native AT announcements, real mobile keyboards, touch latency or native IME behavior.

Final production Chrome observations used the retained production manifest and immutable W5-all fixture:

| Observation                             | Result                                                                                                          | Boundary                                                                                                                                  |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Selection, 40 samples in two A/A groups | p95 50 ms and 38 ms; below the inherited 200 ms target                                                          | Click completion plus two animation-frame opportunities on a contended host; not field INP, presentation timestamps or a baseline speedup |
| Selected-anchor callback cost           | 91 callbacks; p95 and maximum 0.1 ms                                                                            | Meets the selected 1 ms p95 and 50 ms maximum budgets for the measured callback                                                           |
| Placement and continuous zoom           | Zero observed selected-node overlaps; at most one active animation; zoom 1.3424 to 4 with 31 geometry callbacks | Does not prove every device or live-layout workload                                                                                       |
| Compositing and overall frames          | Accelerated transform/opacity layers observed; aggregate frame p95 91.7 ms                                      | Aggregate frames include graph/selection work and do not establish smooth rendering or its causal bottleneck                              |
| Curated source loading                  | H1–H4 ready and settled through the actual chooser without foreground loss                                      | Single network observations against mutable latest aliases, not comparative performance cohorts                                           |

The resumed-layout probe used an already settled drawing and recorded no geometry changes; active-layout timing remains unqualified.
The broader inherited performance limits remain in the [performance handoff](2026-10-23-performance-final-handoff.md).
The [detailed evidence](2026-10-23-ui-implementation-evidence.md) preserves failed attempts, repairs, exact receipts and measurement definitions.

## Final review and evidence boundaries

AGY Flash 3.8 on High completed one broad static review after the full suite and final measurements, followed by one narrow correction of citations and evidence wording.
Each invocation had a 60-minute answer timeout and no token, turn or spend cap.
The broad review read 121 input parts representing 78 documents; the correction reread nine parts covering seven documents.
Neither requested a product fix.
The parent checked the corrected source references and retained the five observations as measurement limits, unrun platform requirements, a positive semantic check and the existing viewport zoom limitation.

The original review contained six out-of-range citations and overstated evidence; it remains retained and is superseded for those claims by the correction.
Both processes exited zero with complete capture and observed producer quiescence.
The provider profile remains `observed-unqualified`, has no native qualified roles, and does not establish OS access isolation.
Under the owner's explicit instruction to use sufficient actual evidence despite HISEW bookkeeping problems, the corrected report is accepted as retained external static-review evidence, without relabeling it as native qualification or an independent test run.

Codex Security scan `e31b1178-cef7-4ec7-bc35-6457c725f062` completed and sealed its report with zero findings across six surfaces.
It covered all 64 native source-inventory entries and nine additional changed paths, using an independent threat model and disjoint discovery passes.
This is a static review of the selected diff, not a full dependency, hosting or deployment audit.
The native usage report has complete attribution across five threads: 15,920,486 total tokens, including 15,281,664 cached input tokens, with 67,661 output tokens.

Retained operator evidence is under `C:/Users/maksy/.hi/w/e/operator/16557566c924469fb5e117f2cfbe6e03`.
Important records include `frozen-candidate.json`, `ui-full-check-6.log`, `ui-production-manifest-final-2.json`, the final browser and foreground receipts, `agy-ui-output.ndjson`, `agy-ui-correction-output.ndjson`, and both process records.
The sealed security report is under `C:/Users/maksy/.codex/state/plugins/codex-security/scans/review/c6eeb3eeceed762eb35deed2374a94333ff232a3_20261023T075920Z_w1j_ief6`.
Private fixtures, raw traces and screenshots remain outside Git.

Native HISEW execution `1e018f86-e49b-4e50-954a-908df04f6cc6` still distinguishes its own receipt admission and resource reconciliation from this source handoff.
No failed receipt is rewritten, no unobserved check is claimed, and no expensive suite is repeated solely to populate bookkeeping.
This record does not claim native HISEW completion.

## Remaining owner batch and release decision

Use the [single manual-validation packet](2026-10-23-ui-manual-validation.md) for NVDA/Firefox and Chromium, JAWS/Chromium, VoiceOver/macOS and iOS, TalkBack/Android, native IME, real browser zoom, mobile keyboard/touch, device motion and actual Windows contrast themes.
Record the exact delivered commit, browser/OS/AT versions and results once per required combination.
Automated evidence is already identified alongside each scenario; only failures and affected follow-ups need additional testing.

The existing viewport meta restriction on zoom remains an explicit accessibility release limitation outside the accepted UI scope.
Unrun required combinations, active-layout timing and any manual findings need an owner disposition before claiming full platform acceptance.
No merge or deployment is authorized or performed by this handoff.
