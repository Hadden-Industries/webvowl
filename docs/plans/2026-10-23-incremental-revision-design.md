# PERF-DEC-012: Responsive node-count changes and bounded renderer reuse

| Field               | Value                                                                                                                   |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Status              | Accepted revision 2, option A; implemented, final qualification in progress                                             |
| Date                | 23 October 2026                                                                                                         |
| Decision owner      | Maksym Shostak                                                                                                          |
| Authority           | Owner-approved amendment to performance scope §2 and SLICE-009 / S8                                                     |
| Source baseline     | Signed and published checkpoint `528d8b821eb143b88fd761b4b4fa69647c983eab`                                              |
| Recommendation      | Implement bounded renderer reuse and batched count adjustment now, before the UI-plan discussion                        |
| Purpose             | Avoid reconstructing unaffected drawing objects; make repeated count adjustment responsive                              |
| Production coverage | Running, settled and manually paused drawings; no requirement to pause manually                                         |
| Confidence          | High in repeated rebuilding and identity opportunities; moderate in expected benefit; actual speedup remains unmeasured |

## Decision in plain language

**Implement both improvements now:** retain drawing objects whose rendering inputs are unchanged, and combine rapid node-count adjustments into one final application.
These solve different parts of the reported problem.
Reuse reduces work in each accepted update; batching avoids rendering intermediate counts the user has already moved past.

For example, adjusting from 500 through 700 and 900 to 1,000 should update the control immediately but apply only the latest requested count after a one-second quiet period or when Filters closes.
Within that application, an unaffected visible node should retain its primitive and SVG object.
A newly visible node is created; a removed node is retired; neighboring edges or labels are updated when their actual dependencies change.
Layout continues according to the user's latest Pause/Resume choice after the adjustment.
A manually paused graph remains paused.

The recommendation is no longer conditional solely on demonstrating a percentage speedup before choosing reuse.
Avoiding unnecessary reconstruction, preserving coherent object ownership and making invalidation explicit are legitimate architectural reasons for the bounded change.
The implementation must still demonstrate skipped work, correct dependency updates, bounded lifetime and coherent recovery.
A complicated retained-state mechanism that cannot meet those conditions would not become a good design merely because it uses keyed joins.

## Why do it now?

The approved S8 was a design-only slice and placed any implementation after UI.
That was a scope/risk decision, not a technical dependency.
Revision 1 followed it by proposing a later paused-only experiment.
The owner challenged both restrictions, reported unacceptable live count responsiveness, accepted considering a brief automatic hold and one-second quiet period, and asked to assess reuse on architectural grounds as well as speed.

Ordinary ontology loads resume layout by default in [the document session](../../src/app/js/controller/canonicalVowlDocumentSession.js); saved visualizations have different defaults.
Paused-only production eligibility would exclude the ordinary use case.
Both improvements must work when layout starts running, settled or manually paused.

The remaining [UI plan](2026-10-21-ui-design-implementation-plan.md) has no hard prerequisite for implementing these private renderer changes.
Its selection, editor, viewport and export contracts must continue to work.
Only the count-adjustment behavior and the minimum feedback needed to explain it are added here; the broader UI plan remains a later owner decision.

The owner approved option A of revision 2 on 23 October 2026: implement both bounded increments now.
This explicitly supersedes the original live-slider preservation and design-only S8 for the scope recorded here.
Earlier questions and discussion remain historical context; the subsequent explicit option-A answer is the implementation authority.

## Source evidence and design implications

The following observations describe the checkpoint before S8; the implementation below replaces the identified count scheduling and reconstruction behavior.

| Current responsibility | Source and finding                                                                                                                                                                                                                            | Design implication                                                                             |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Count input            | [nodesShownControl.js](../../src/app/js/ui/nodesShownControl.js), `submit`, combines inputs within one animation frame; `change` submits immediately                                                                                          | A drag spanning many frames still triggers repeated revisions                                  |
| Application wiring     | [app.js](../../src/app/js/app.js) sends submissions to `setVisualizationView({ nodesShown })`                                                                                                                                                 | There is no settled adjustment owner across the burst                                          |
| View authority         | [canonicalWebVowlController.js](../../src/app/js/controller/canonicalWebVowlController.js) selects visibility, applies the session revision and publishes committed counts                                                                    | Retain one authoritative accepted result                                                       |
| Session transaction    | [canonicalVowlDocumentSession.js](../../src/app/js/controller/canonicalVowlDocumentSession.js), `updateView`, synchronizes placements and installs before committing scene state                                                              | Count/filter changes already have a seam within one semantic revision                          |
| Materialization        | [canonicalRenderElements.js](../../src/webvowl/js/parsing/canonicalRenderElements.js) creates new node/property objects and occurrence bindings for a complete drawing                                                                        | Reuse needs coherent primitive ownership, not only a DOM optimization                          |
| DOM installation       | [renderedGraphInternals.js](../../src/webvowl/js/runtime/renderedGraphInternals.js), `drawContent`, removes graph descendants and recreates layers and primitives                                                                             | Unchanged objects are currently rebuilt                                                        |
| Force simulation       | [legacyForceSimulation.js](../../src/webvowl/js/runtime/legacyForceSimulation.js) uses position-Verlet `x/y/px/py` state and reheats on `start`                                                                                               | Preserve the actual algorithm and restart behavior; modern D3 `vx/vy` assumptions do not apply |
| Link/label ownership   | [linkCreator.js](../../src/webvowl/js/parsing/linkCreator.js), [PlainLink.js](../../src/webvowl/js/elements/links/PlainLink.js) and [Label.js](../../src/webvowl/js/elements/links/Label.js) own endpoint layers, label wrappers and closures | Stable IDs do not by themselves prove unchanged routing or safe closures                       |
| Publication/recovery   | [d3RenderedGraphAdapter.js](../../src/webvowl/js/runtime/d3RenderedGraphAdapter.js) validates identity and publishes bindings after successful installation                                                                                   | Reuse preserves the existing admission and recovery path                                       |

The [S6 evidence](2026-10-23-performance-layout-evidence.md) shows large reductions from batched measurement, with substantial browser layout work remaining.
Two W4-connected count-change samples spent 65.737/58.856 ms in Layout and 49.251/45.562 ms in UpdateLayoutTree.
For W5-all the respective values were 128.251/146.278 ms and 166.831/183.047 ms.
These potentially overlapping event families must not be added or presented as foreground latency distributions.
S7 and SF did not change this renderer path.

Retaining elements through keyed joins is an established mechanism, but the application supplies correct keys, dirty dependencies, transaction ownership and recovery.
[D3 data joins](https://d3js.org/d3-selection/joining) Reducing overlapping expensive interactions and keeping immediate control feedback separate from heavy work align with [Chrome's input-delay guidance](https://web.dev/articles/optimize-input-delay) and the retrieved Modern Web Guidance `performance` guide.
Use native events/timers and the existing D3 dependency; no additional library is proposed.
These sources support the mechanisms, not an unmeasured WebVOWL speedup.

## Options and recommendation

| Option                                                    | Benefit                                                                                     | Cost and limitation                                                                                   | Recommendation                                                          |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| **A. Implement bounded reuse and batched adjustment now** | Avoids unnecessary reconstruction and intermediate revisions; covers ordinary active layout | Adds explicit dirty-dependency and temporary-hold ownership, with full correctness and lifetime proof | Recommended                                                             |
| B. Implement batched adjustment only                      | Smaller change removes intermediate revisions                                               | Final application still fully rebuilds; stable objects are still replaced                             | Valid narrower delivery, but does not address the architectural concern |
| C. Implement bounded reuse only                           | Retains unaffected objects and reduces work per update                                      | A long drag still requests many revisions; responsiveness remains exposed to their cumulative cost    | Possible, but the two mechanisms complement each other                  |

For option A, implement two coherent increments sequentially: responsive adjustment, then bounded reuse.
The first offers a smaller independently testable improvement; it is not a performance gate that automatically cancels the second.
Do not broaden either increment silently if an invariant cannot be preserved.

## S8-A: Responsive count adjustment

### User-visible behavior

| Event                                                               | Requested value and accepted drawing                                                              | Layout                                                        |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| First changed range value, range keyboard step, or plus/minus press | Update the requested count immediately; indicate pending application; retain the accepted drawing | Acquire one temporary hold if needed                          |
| Further changes within one second                                   | Replace the pending value and restart one timer; keep no queue of intermediate counts             | Keep the same hold                                            |
| Range pointer release or `change`                                   | Preserve the quiet-period rule; do not resubmit on every keyboard `change`                        | Continue holding until application completes                  |
| One second without a count change                                   | Apply the latest valid value once; skip an unchanged accepted intent                              | Release after success or handled failure                      |
| Filters closes, including Escape or outside click                   | Flush without waiting for the remaining quiet period                                              | Release after application                                     |
| Exact-number Enter/blur or explicit 50-node preset                  | Apply that value without the quiet-period delay, superseding an older pending count               | Release after application                                     |
| Escape inside an uncommitted exact-number draft                     | Preserve existing draft cancellation; restore the preceding requested/accepted value              | No orphaned hold                                              |
| User had paused, or explicitly chooses Pause during adjustment      | Apply the count normally                                                                          | Remain paused                                                 |
| User explicitly chooses Resume during a hold                        | Record the latest desired choice                                                                  | Resume when the hold ends unless a newer choice supersedes it |

The one-second policy is uniform initially; avoid an unmeasured graph-size cutoff or several subtly different slider modes.
It describes the quiet period before work is scheduled, not a guarantee that rendering completes within one second.
An existing long synchronous operation cannot be preempted merely by starting a timer.
Native timer callbacks can also run later than requested.
[MDN timers](https://developer.mozilla.org/en-US/docs/Web/API/Window/setTimeout)

Plus/minus uses the latest requested count so rapid presses accumulate.
The meanings of `auto`, `all`, exact counts and eligibility limits remain unchanged.
The native range stays keyboard/touch accessible.
Pending feedback uses the existing control area and concise accessible status, without repeated announcements on every movement.
Committed controller counts remain truthful: a draft is not an accepted scene revision.

### Ownership and competing actions

One adjustment owner encapsulates the pending count, timer, current application and cancellation.
The controller owns document currentness and temporary layout suspension; the UI never calls renderer internals.
Keep desired user layout intent distinct from the effective temporary hold.
A saved boolean followed by unconditional resume is insufficient.
Use the existing layout-intent protection around export as the integration point; do not introduce a competing pause authority.
Do not repurpose the existing neighborhood `temporaryPresentation` contract for count drafts.

At most one application runs and one newer desired value is retained.
Synchronous prepare/install remains indivisible.
A superseded asynchronous completion cannot publish or restore layout over a newer owner.
Every exit releases only its own hold, exactly once.

| Competing action                                             | Required handling                                                                                                                                                        |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Load, reset, semantic edit or disposal                       | Retire the pending count/timer before ownership transfers; a late callback cannot change or resume the replacement document                                              |
| Explicit count request from another caller, including WebMCP | Retire the older UI draft and preserve the direct controller operation's immediate contract                                                                              |
| Filter checkbox while a count is pending                     | Combine the latest valid count and explicit filter change in one accepted operation; preserve an exact target when eligibility shrinks                                   |
| Export/share/capture while pending                           | Flush and await the count before capture; preserve capture exclusivity and prevent layout-restoration races                                                              |
| Page becomes hidden                                          | Retain at most the latest draft; cancel the timer while hidden, release temporary simulation ownership safely, and recheck identity and elapsed quiet time on return     |
| Failure                                                      | Preserve/recover the previous accepted drawing, restore truthful feedback, report the existing error and release the hold according to the latest explicit layout intent |

Popover dismissal must cover native close, outside click, Escape and the existing mobile sheet dismissal.
Timer, close, Enter and blur can converge on the same flush; it must be idempotent.
[MDN toggle event](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/toggle_event) No new persisted view field or WebMCP tool is proposed.
Human and agent operations still produce the same accepted scene; only human draft scheduling differs.
Any additive controller operation/state needed for adjustment ownership receives contract and lifecycle tests.

### Likely files and proof

Predicted files: `src/app/js/ui/nodesShownControl.js` and tests, `src/app/js/app.js`, `src/app/js/ui/visualizationViewControlsAdapter.js` and tests, and a private adjustment module if it earns its interface.
Controller ownership belongs in `canonicalWebVowlController.js` and applicable state/lifecycle contracts and tests.
Minimal pending feedback may change `src/index.html`; reuse existing styling.
Only affected menu/export integration call sites should change.
These are source predictions, not configuration approval.

Use injected time and controllable promises at external timing seams, plus real controller/session/runtime tests for currentness and accepted drawing behavior.
A burst spanning multiple animation frames must install zero intermediate drawings and exactly one final drawing.
Timer/close/change races must not cause a duplicate installation.
Test keyboard repeat, repeated plus/minus, invalid exact input, all dismissal paths, running/settled/paused layout, later Pause/Resume, incoming direct requests, lifecycle conflicts and failures.
Compare final count, scene, selection, pins, camera and export with a direct request to the retained checkpoint.
After retirement/disposal there must be no live timer, hold or pending continuation retaining the old document.

## S8-B: Bounded renderer reuse

### Coverage and non-goals

Support count/filter visibility changes within one accepted semantic revision, with layout initially running, settled or paused.
Direct controller calls must work without the UI having acquired a temporary hold.
New loads, semantic edits, language/font/style/notation changes, changed primitive kinds and ambiguous identities take full rebuilding initially.

No simulator replacement, physics tuning, simulation worker, culling, cross-revision correspondence, persistent font cache or new dependency is included.
Retaining objects does not authorize changing their motion semantics.
Current materialization initializes `px/py` from canonical positions and the simulator reheats on restart; reuse must preserve that behavior unless a separately approved design changes it.

### Private owner, identity and dirty dependencies

The runtime adapter remains the public seam and sole accepted generation/revision publication authority.
Callers submit complete canonical drawings.
One private renderer owner holds primitive/DOM maps, coherent link/label/force objects and disposal actions, scoped to load generation and semantic revision.

Keys combine render kind, canonical occurrence identity and required role, including inverse directions and aliases.
An IRI, array index, label string or portable content hash is not runtime occurrence identity.
Duplicate/ambiguous keys choose full rebuilding before live mutation.

“Same key” means the same occurrence; “unchanged” additionally requires the same relevant rendering inputs.
An added or removed neighbor can dirty endpoint layers, self-loop indexing, routes, cardinalities, markers and export bounds.
Define those dependencies explicitly.
Reuse coherent object aggregates or rebind every affected reference; never leave a label closure pointing at a retired property merely because its SVG survived.

An unchanged eligible primitive should avoid construction, teardown and repeated text measurement.
A dirty retained primitive is updated; a new one is created; an exited one is disposed.
Text/layout reuse stays within the qualified owner and known rendering inputs.
Font/style/presentation changes invalidate through the full path.
There is no cross-document cache.

### Prepare, install, publish and recover

1. Validate the complete drawing and identity through the existing adapter.
   Reuse is not another admission path.
2. Prepare owned enters, updates, exits, ordering and dirty dependencies without mutating retained live primitives.
   Stage new nodes detached where useful; detached staging alone is not a speed claim.
   [MDN fragments](https://developer.mozilla.org/en-US/docs/Web/API/DocumentFragment#performance)
3. Retain the previous accepted drawing and canonical placement/pin/camera state needed for full recovery.
   Preserve interaction-epoch changes, active-gesture release and editor/hover retirement.
4. Install synchronously, with no yield between the first live mutation and success/recovery. Coordinate the actual legacy simulation's arrays, `x/y/px/py`, fixed/pinned state and computed parameters.
   Keep the correct effective paused/running state and a single simulation timer.
5. Update bindings, layer order, routing and required native measurements before publication.
   Keep S6 batched measurement and native SVG geometry authoritative.
6. On installation failure, reconstruct the previous accepted drawing through full rebuilding.
   Preserve `CANONICAL_DRAWING_RECOVERY_FAILED` and mount retirement if that recovery also fails.
7. Dispose exited primitives, obsolete closures, detached candidates and patch journals.
   New loads, semantic revisions and final disposal retire the whole owner.

Synchronous installation prevents timer callbacks interleaving inside the transaction; coherent force references and restoration still need proof.
Hidden placements remain scene-owned.
Capture observes a settled accepted installation with the same placement and export authority as today.

Predicted files: `renderedGraphInternals.js`, `canonicalRenderElements.js`, `linkCreator.js`, affected link/label implementations, and a private retained-owner module if needed.
Keep `d3RenderedGraphAdapter.js`'s public seam.
Its tests and `renderedGraphEditing.test.js` must cover actual publication, gestures and recovery.
Changes to the simulation itself are limited to a demonstrated installation need, with independent regression coverage; changing the physics algorithm requires replanning.

### Acceptance and evidence

| Claim                         | Required proof                                                                                                                                                                                 |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unnecessary work removed      | Independent construction/disposal, DOM mutation and text-measurement counts; unchanged eligible primitive and DOM identity retained                                                            |
| Actual dependencies updated   | Same-key label/routing/cardinality/loop and adjacency cases; compare against complete full rebuilding                                                                                          |
| Active and paused correctness | Real runtime cases for running/settled/paused modes; controlled initial force state and ticks for deterministic comparison; browser evidence of continued active layout with one timer         |
| Preserved drawing/export      | Full-rebuild oracle for canonical placements, bindings, aliases/inverse labels, pinning, camera, layer order, native geometry and capture; raster controls for explained precision differences |
| Recovery                      | Inject failures before mutation and during enter/update/exit; compare recovered state with the full-rebuild oracle; separately force recovery failure                                          |
| Interaction lifetime          | Delayed old drag/editor/hover callbacks cannot mutate the accepted owner; current interactions and selection still work                                                                        |
| Bounded ownership             | Ten equal-live-size cycles, final disposal and a deliberately retained old-owner positive control                                                                                              |
| Performance                   | Work-count proof first, then attributable diagnostic comparisons and qualified foreground timings when available; preserve existing small-input guards                                         |

Do not compare running layouts at arbitrary wall-clock instants and call differing positions a regression.
Compare identical canonical inputs and initial simulation state at controlled progress, and separately test real active animation.
Report intentional batching delay, input responsiveness and final-application time separately.
A faster slider handler alone does not prove the requested graph became available sooner.

The earlier proposed 25% renderer-time gate is not an adoption condition in this revision.
The owner is considering reuse for architectural correctness of invalidation and avoidance of demonstrably unnecessary work, as well as performance.
Timing remains evidence: disclose a negligible gain, regressions or cost moved elsewhere.
Any regression outside the existing small-workload guard, unbounded retention, incoherent recovery or required cross-revision inference stops adoption and returns a bounded decision to the owner.
Do not silently widen scope or declare the performance budgets passed.

## Delivery, traceability and disposition

| Increment                  | Traceability                                                      | Completion evidence                                                                                           | Recovery/handoff                                                                                     |
| -------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| S8-A responsive adjustment | REQ-002/003/006; AC-002/003/006; QA-005/007; PERF-DEC-012         | Burst work counts, final-result differential, lifecycle/pause/export tests and browser diagnostics            | Dispose timers/holds; retain checkpoint oracle; communicate changed control semantics to UI planning |
| S8-B bounded reuse         | REQ-002/003/006/008; AC-002/003/006/008; QA-005/007; PERF-DEC-012 | Work avoided, independent geometry/force/recovery proof, bounded lifetime and performance results             | Full rebuilding remains fallback; complete owner retirement                                          |
| Final qualification        | Existing performance §8 and owner review instructions             | Consolidated full `npm run check`, then final code/security/independent external review and narrow follow-ups | Feature-branch commit/push; revisit UI with explicit remaining measurement limitations               |

The implementation owner integrates these increments sequentially because lifecycle ownership and proof are coupled.
Use logical commit checkpoints and consolidate before broad reviews.
Reserve AGY Flash 3.8 High external reviews, with a 60-minute timeout, for the final fully tested candidate.
The checkpoint already passed `npm run check`: 9,886 tests in 170 suites, plus repository lint, formatting, integration checks and production build.
That result qualifies its source, not source subsequently added by this amendment.
Run meaningful focused checks during implementation, then full final verification after the consolidated changes and fixes.
Do not repeat unchanged checks solely to repair HISEW bookkeeping.

The owner's static/headless-first sequence and foreground timing deferral remain in effect.
Existing B3 and other numerical acceptance budgets are not waived.
No dependency, package/lockfile, build/test configuration, persisted schema, remote telemetry or deployment change is proposed.
Native events/timers and existing D3/runtime capabilities supply the reusable mechanisms; custom work is the application-specific ownership and invalidation.
Any discovered configuration requirement needs exact approval under repository instructions.
Source corrections reverse task-introduced changes only; no reset of user work.

**Owner disposition: option A accepted on 23 October 2026.**
Both bounded increments are authorized now, amending the plan's preserved live-slider behavior and design-only S8.
It does not approve the broader UI plan or waive correctness, recovery, final review or performance evidence.
If cross-revision reuse, physics changes, worker architecture or broader UI design becomes necessary, return with a new concrete decision.

## Implemented boundaries

The controller's private `nodeCountAdjustment` owner holds one draft, one timer and at most one running application.
Its document identity combines load generation and semantic revision.
The controller reserves a layout-hold owner before publishing effective suspension, so a subscriber staging a newer count during that publication shares the same hold.
`layout.requestedIsPaused` preserves the latest explicit user choice while the effective layout is held; release restores that choice only for the current document and owner.
The additive `nodeCountAdjustment` state distinguishes requested intent from the accepted `nodeCountStatus`.
The range and step controls stage drafts; exact input and presets keep immediate application.
The existing native Filters toggle event flushes dismissal, and visibility changes retire the timer and temporary hold while retaining at most one current draft.
Pending feedback uses the existing form styling and a status region; repeated movements do not repeatedly rewrite its unchanged announcement.

Export awaits a flush before it acquires capture ownership.
The human share action also awaits a flush and guards asynchronous URL publication against a newer request.
The synchronous `getVisualizationShareUrl()` API remains an accepted-state read; it does not silently start asynchronous work or change its return type.
Callers that deliberately want a pending human draft applied first use `flushNodeCountAdjustment()`.
Direct view requests keep their immediate contract and supersede older drafts; a filter request consumes the latest count in the same view transaction.

Renderer reuse is private to `renderedGraphInternals` and admitted by `canonicalDrawingReuse` only within the same accepted semantic revision and rendering presentation.
The complete canonical drawing remains the admission input.
Retained node/property/link/label aggregates preserve occurrence identity; placement updates are journaled until synchronous installation.
Neighbor-dependent layering, incidence, routes and force arrays are recomputed, while unaffected primitives, DOM and measured text survive.
New or dirty elements use the existing S6 measurement path.
Changed CSS, font identity, presentation, semantic revision or primitive kind falls back to full construction; there is no persistent metric cache.

Each installation advances interaction ownership and retires drag, editor and hover state before rebinding retained callbacks.
Failure recovers through a full reconstruction from the previous accepted drawing and live placement/pin/camera state.
Double failure retains the existing recovery-failed retirement contract.
Final disposal clears renderer references as well as DOM, and retains no prior-document object map.
The legacy force algorithm and its restart, `x/y/px/py`, pinning and settling semantics are unchanged.
