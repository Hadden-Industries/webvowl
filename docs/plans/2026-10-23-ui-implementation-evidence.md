# UI implementation evidence

Status: implementation, automated qualification and final reviews complete, 23 October 2026; residual manual platform qualification remains open.
The signed implementation checkpoint `29a59036361cec62f67b6398c910f17b2fd35ab4` is published on the feature branch.
The [final handoff](2026-10-23-ui-final-handoff.md) binds the reviewed source, delivery scope, review dispositions and remaining release requirements.

## Scope and decisions

The candidate implements accepted A1–A4 and B1–B5 after performance commit `20eb888693bae1434720b6023608c35dd3dc75f3` and documentation commit `73f6a44f0ae91b054ac77574b697bfde9278dfce`.
B6 remains unselected.
Publication remains confined to `feat/architecture-performance-ui`.

UI-DEC-022 option 1 is accepted: following a relation, including a hidden entity, changes the subject inside Details and preserves graph selection.
Back and closing Details return to the selected subject.
Generation/revision replacement invalidates the related page; a language change refreshes it.

The owner explicitly approved the one-element HTML `prefer-native-element` exception before the grouped ontology suggestions listbox and the one-line JavaScript `no-restricted-syntax` exception for the IME boundary marker.
Firefox automation exposed an unconditional composition-end latch that consumed the next ordinary Enter.
The corrected guard tracks actual composition Enter events and the 229 marker for the documented composition-end-before-keydown ordering.
The remaining numeric-key restrictions stay enabled.
[MDN documents this event ordering and marker](https://developer.mozilla.org/en-US/docs/Web/API/Element/keydown_event#keydown_events_with_ime).

## Implementation and diagnostic results

- The curated chooser preserves H1–H4 identities and packaged-example routes, searches recorded provenance, commits a suggestion before loading, and protects composition, draft text and failed input.
  One application owner publishes visual-viewport metrics.
- Overview retains title, IRI, version, authors, language, description, metadata annotations, semantic counts and visible graph counts.
  Source identity, warnings, reload and retained ontology facts are reachable without a permanent sidebar.
- Details and editor surfaces move their existing DOM only when the parent changes.
  This preserves focused controls during resizing.
  Compact editing retains both ontology controls and the creation palette; wide editing retains its dock.
- One shared description model retains every returned role and field.
  Preview truncation does not affect full Details.
  Description requests coalesce to one per frame and reject expired identities.
- Selected-occurrence geometry has an explicit renderer-observation contract: generation/revision, opaque occurrence reference, graph-viewport CSS coordinates, size, shape and repetition count.
  Per-frame observations do not enter frozen controller state.
  Repetition counting is cached until selection or drawing bindings change.
- HTML placement uses hysteresis, cached HTML box measurements and selected model geometry.
  It protects the selected box and visible zoom/focused controls, reports off-screen or missing anchors, and never moves the camera.
  Native animations cancel from their current state; reduced motion is immediate.

The focused combined run passed 290 tests in 16 suites.
Two additional composition cases then passed with the full 12-test chooser suite.
Eight preview scheduling tests separately prove 1,000/10,000 notification coalescing, no repeated box reads, hidden-tab and hidden-preview suspension, immediate missing/off-screen/stale-anchor fallback and disposal.
These are overlapping scoped receipts; the later full run is recorded separately below.

The independent real-DOM description fixture covers all eight semantic roles and every description field, long untruncated content, zero cardinality, French language metadata, inert untrusted text, anonymous identity, hidden related entities, bounded navigation, facts access, language/revision/generation changes and disposal.
Relation navigation performs one combined read and zero graph writes; the sole graph write in the fixture is the explicit preview Close action.

## Browser receipts and limits

Evidence is retained under `C:/Users/maksy/.hi/w/e/operator/16557566c924469fb5e117f2cfbe6e03`.
The reproducible harness is `util/qualify-ui-browser.mjs`, with independent fixtures in `util/uiPresentationFixtures.mjs`.
It accepts a caller-selected Playwright runtime; no project dependency, lockfile or test configuration was changed.

Chromium 156.0.8078.4 passed chooser keyboard/URL sanitization, overview and nested facts focus, complete relation navigation, wide pinning, 320 CSS pixel reflow, text spacing, editor DOM identity/focus, background pan versus click, reduced motion and application disposal (`chromium-functional-3/receipt.json`).
WebKit 27.2 passed the corresponding seven functional checks on the earlier candidate (`webkit-functional-1/receipt.json`).
These receipts precede the latest IME correction and are not final-candidate qualification.

Chromium then passed all eight checks on the checkpoint candidate (`chromium-functional-4/receipt.json`), including the complete-description fixture and role-control focus after language refresh.
The checkpoint also passes exact-scope JavaScript, HTML, CSS and Markdown lint, formatting and whitespace checks.

The installed Firefox 157 executable could not launch (`spawn UNKNOWN`); the installed Firefox 153 executable launches.
Its initial functional run found the composition latch defect described above.
Firefox 153 then passed all eight functional checks, including the complete-description fixture and corrected chooser (`firefox-functional-7/receipt.json`).
The failed launch and functional receipts remain retained.

The initial Chromium canvas-click check ran a click during D3's deliberate drag-ending click-suppression turn.
The harness now separates the next user gesture by a frame; the pan and subsequent click pass.
This was a test sequencing correction, not a relaxation of the pan/selection contract.

After the final placement-order correction, Chromium 156.0.8078.4, Firefox 153 and WebKit 27.2 each passed all eight checks (`chromium-functional-5`, `firefox-functional-9`, `webkit-functional-6`).
WebKit's earlier nested-dialog failures came from checking before native close/focus events completed; the harness now waits for the actual expected state and lets the nested close watcher register before Escape.
No product focus behavior was bypassed.

Headless engine checks and accessibility trees do not prove spoken announcements, native IME behavior, real mobile keyboards, actual Safari/iOS or assistive-technology combinations.
The [single manual-validation packet](2026-10-23-ui-manual-validation.md) contains all residual required coverage and its release-disposition ledger.

## Full automated verification

`ui-full-check-2.log` ran the complete 10,014-test JavaScript inventory: 10,012 passed and two failed because the runtime-contract vocabulary tests still expected the old exact method/event sets.
The production contract was correct; the expected sets now include the selected-occurrence read and geometry-change event.
The affected 68 tests then passed, and the production build plus generated JSON checks completed separately.
The first attempt used the wrong process Node version and stopped before tests; the direct PowerShell invocation of an npm forwarded flag also failed before its intended check.
All receipts remain retained; neither is relabeled as a successful full run.

The foreground overlap investigation subsequently found a real presentation-order defect: the new preview could paint at its previous position for one frame.
The presenter now notifies placement after rendering the content, and placement cancels any pending geometry callback and updates within that existing presentation frame.
Ordinary tick/zoom/drag geometry updates remain coalesced.
A regression test proves placement uses the new height immediately without leaving another queued update; 39 related tests and the three browser-engine passes above succeeded.
The full automated run after this product fix, `ui-full-check-4.log`, exited zero: 10,015 JavaScript tests in 182 suites, 28 Python tests with two skips, three Markdown integration tests, seven JSON integration tests, repository lint/format, production build and generated JSON qualification.
The intervening attempt stopped at the cheap Markdown-format check for the new manual packet, which was formatted before rerunning.

The owner then requested alignment with installed Node 24.22.1, npm 12.2.1, Python 3.15.1 and uv 0.13.5 and one maintained declaration per runtime.
The [plan amendment](2026-10-21-ui-design-implementation-plan.md#9-configuration-trust-boundaries-and-release) records the exact configuration and consumer changes.
The shared reader follows the existing HISEW repository's projection pattern; npm's native minimum also supplies its exact CI selection, and version files remain the Node/Python/uv authorities.
The existing `.venv` actually executes Python 3.15.1; its older creation metadata is not treated as the running version.
No global tool, application dependency or lock graph was changed.
Focused runtime/setup/CI tests pass: 95 tests across six suites in `runtime-alignment-tests.log`.
The subsequent full run on Node 24.22.1/npm 12.2.1 and the actual Python 3.15.1 interpreter, `ui-full-check-5.log`, exited zero: 10,026 JavaScript tests across 183 suites, 28 Python tests with two skips, three Markdown integration tests, seven JSON integration tests, repository lint/format, production build and generated JSON checks.
This receipt is separate from the preceding pinned-Node run; the existing large-bundle build warning remains visible.

## Accessibility, scale and export diagnostics

`util/qualify-ui-accessibility.mjs` uses a caller-selected Playwright runtime and an externally retained axe-core 4.14.0 distribution; no dependency, lockfile or shared configuration changed.
`accessibility-2/receipt.json` covers the initial page, chooser, Overview, nested facts, preview, Details, 320-pixel reflow, narrow landscape, forced colors and compact editing.
It exposed and led to fixes for button contrast, invalid heading/button roles, disclosure expansion state and forced-color dialog text.
The retained forced-colors screenshot was visually inspected.

Two rule dispositions remain explicit: the pre-existing viewport zoom restriction, and the listbox scroll rule whose input-owned active-descendant navigation is independently proved by keyboard scrolling to the last option while focus stays in the input.
These are not suppressed rules or a whole-application accessibility pass.
Incomplete automated contrast checks, especially graph SVG/background overlap, remain in the receipt and require the manual visibility checks.

`graph-1/receipt.json` proves distinct clicked occurrences for repeated FOAF Thing entities, identical canonical JSON and Turtle bytes, and identical fixed-state SVG geometry with Overview/Details open and closed.
Separate 1,000- and 10,000-node synthetic renderings exercised 100 rapid selections each: one presentation batch, zero SVG geometry reads and preserved paused intent/current identity.
These are functional/counter results, not foreground frame-rate claims.

## Foreground observations

Foreground collection began only after static, unit, real-DOM, browser, accessibility and counter diagnosis, implemented optimizations, and the complete automated inventory with its repairs.
Production bytes are retained by manifest; the harness binds its module hashes, Chrome binary and fixture bytes.
The private W5-all input has SHA-256 `85214ddc93194fccf5c0fc4bbbc8f34ab54e54f4abb352f0543411fd56b1c3f6` and 664 eligible nodes.
The owner's CPU exception permits recorded busy-host observations; actual visibility and focus remain checked.

`foreground-ui-W5-all-1` completed 40 uninstrumented selection samples, 20 in each A/A group, plus warmup: p95 49.4 and 53.4 ms, below the inherited 200 ms selection target.
This observes click completion plus two animation-frame paint opportunities, not field INP or presentation timestamps.
The selection-only route explicitly does not claim the complete S0 B2–B6 cohort or a baseline speedup.
These results precede the final placement-order correction; the affected final measurements are recorded in the handoff.

The repaired production candidate then completed the same 40 uninstrumented samples plus warmup in `foreground-ui-W5-all-2`: A/A group p95 values were 53.9 and 33.5 ms (medians 34.05 and 28.05 ms), with no exceptions and a clean browser exit.
Both groups are below the inherited 200 ms UI selection budget.
This is evidence for that budget on the recorded contended host, not a before/after improvement claim or the complete S0 programme.
After the held-zoom notification repair, `foreground-ui-W5-all-3` refreshed all 40 samples on `ui-production-manifest-final-2.json`: p95 50 and 38 ms, medians 31.15 and 31.65 ms, no exceptions and a clean browser exit.
These are the final production candidate's selection observations.

`foreground-ui-anchor-4` observed 61 geometry callbacks with p95 and maximum 0.2 ms, one maximum active animation, and Chrome layer reasons for accelerated transform and opacity animations.
It also exposed the one-frame stale-position overlap described above; that receipt is diagnostic, not the repaired candidate's keep-clear acceptance.
Overall frame p95 was 166.7 ms during the mixed running-layout/selection probe, which includes graph work and must not be described as smooth rendering.
The first two anchor probes returned no callback samples because successive selections cancelled the pending placement before it ran; their failed assertions remain retained.
The probe now observes separate presentation, running-layout and continuous-zoom phases and retains raw timing/overlap evidence before assertions.

`foreground-ui-anchor-5` and `foreground-ui-anchor-6` showed zero selected-node overlaps and one maximum animation after the placement fix, but neither recorded a geometry callback during held zoom.
The strengthened sixth probe proved actual zoom changed from 1.3424 to 4, exposing a missing notification in the renderer's direct viewport-update path.
The new real-browser regression failed on that candidate (`chromium-zoom-regression-before`) because no selected-occurrence observation arrived despite changed scale and geometry.
Direct viewport updates now use the shared viewport/selected-geometry publisher, covering held zoom and programmatic pan as well as existing animated paths.
Chromium, Firefox and WebKit then passed the new regression and all eight preceding functional checks (`chromium-functional-6`, `firefox-functional-10`, `webkit-functional-7`).
The full check after this renderer correction, `ui-full-check-6.log`, also exited zero with all 10,026 JavaScript tests across 183 suites and the complete Python/integration/lint/format/build/generated-JSON sequence.
These diagnostic receipts remain retained; neither earlier zero-overlap observation establishes qualification of the missing zoom path.

The repaired production bundle (`ui-production-manifest-final-2.json`) passed `foreground-ui-anchor-7`: 91 measured geometry callbacks, p95 and maximum 0.1 ms, zero observed selected-node overlaps, one maximum active animation, no foreground loss, and actual zoom from 1.3424 to 4 with 31 additional geometry callbacks in that phase.
Chrome again reported accelerated transform and opacity layers during motion.
The measured anchor work meets the selected 1 ms p95 and 50 ms maximum budgets; the overall frame p95 of 91.7 ms includes graph/selection work and is not a smooth-frame claim.
The resumed-layout phase produced no geometry changes on the already settled drawing, so it does not establish active-layout frame timing; the separate notification/coalescing and real-browser checks cover that contract's functional boundaries.

`foreground-ui-sources-1` loaded H1–H4 through the actual chooser, verified that commitment alone did not load, and observed all four ready and settled without foreground loss.
Ready times were 3.10, 7.10, 8.46 and 11.13 seconds; total observed times through settlement were 5.73, 8.72, 10.08 and 13.25 seconds.
Each used the initial 50-node view, with 181, 469, 567 and 856 eligible nodes respectively.
Source-assessment/excluded-constructor warnings and the actual source identities are retained.
These are single network observations against mutable latest aliases, not immutable-input cohorts or a speedup comparison.

The earlier full-operation W5 run was stopped during warmup after revealing that unrelated repeated edit operations would dominate this UI qualification.
Its owned browser was closed and the resulting CDP deadline failure is retained as an interrupted diagnostic, not a product failure or completed cohort.
The final UI timing route isolates the operation that changed while preserving the broader inherited performance limitations.

## Final reviews and unchanged application bytes

After full check 6 passed and the final foreground receipts were recorded, the complete candidate was frozen in an independent review clone at `c6eeb3eeceed762eb35deed2374a94333ff232a3`, tree `21b0123e7fe88427f75704e7836d7e30aef69849`.
Its source digest is `1197cb7658808d9a03a13cc20cb0117581edeaca9445e333076d7831feb909bf`; `frozen-candidate.json` also retains per-file hashes and the full-check log digest.
The snapshot is a disposable review artifact, not an additional development-history commit.

AGY 1.4.5 used `gemini-3.8-flash-high`, High, with a 60-minute answer timeout and no token, turn or spend cap.
The broad static review read all 121 frozen input parts representing 78 source/evidence documents, including the 73 changed paths relative to the performance baseline.
It requested no product fixes, but the parent rejected six out-of-range citations and overstatements about frame timing and untested platforms.
A narrow follow-up reread nine parts covering seven documents and corrected all five review observations; it did not repeat the broad review or change the application.
The five observations distinguish lab timing from field INP, anchor cost from aggregate frame intervals, automated proxies from native AT/device coverage, correct relation navigation, and the pre-existing viewport zoom restriction.
The original report, failed schema attempt, correction, process records and guard evidence remain retained.
Both review processes exited zero with complete capture and observed producer quiescence.
The AGY profile remains `observed-unqualified` with no qualified roles; OS access isolation was not established.
This is retained external static-review evidence under the owner's bookkeeping instruction, not native HISEW review qualification or independently executed tests.

Native Codex Security scan `e31b1178-cef7-4ec7-bc35-6457c725f062` completed and sealed its artifacts for the same snapshot.
It reviewed all 64 native source-inventory entries plus the nine remaining changed version, documentation and test-double paths, with a fresh independent threat model and disjoint discovery passes.
It reported zero security findings across six reviewed surfaces.
Reviewers executed no application code, tests, network requests or attacks; the result is a static assessment of the selected diff, with deployment, host authorization and dependency-audit limits retained in its report.

The parent rechecked all 33 follow-up file hashes against the frozen candidate before writing the final documentation: none had changed.
Only the plan, this evidence record, the manual packet's handoff link and the new final handoff are updated after review.
The passed full suite and browser/foreground receipts are therefore reused for unchanged application, runtime and qualification-tool bytes; final documentation receives its own formatting and lint checks.
