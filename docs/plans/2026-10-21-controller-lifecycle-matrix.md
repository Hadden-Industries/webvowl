# Architecture lifecycle evidence and policy

This implementation record accompanies [ARCH-DEC-010](2026-10-21-controller-lifecycle-decision.md).
It records implementation, focused and browser evidence; final configured verification and independent-review receipts remain in the HISEW execution handoff.
The protected parent is `e30d5014f82c5da13ca494af5550b6b96f4c0b73`.

## Independent characterization

Before changing the controller, PR-B exercised the real document session and in-process canonical worker operations against an owned drawing double.
The double models scene mutation, arrangement, cancellation and explicitly deferred paint.
It does not model browser painting, SVG geometry, force physics or worker scheduling.
SVG/drawing export data must be supplied explicitly as fixtures.

The original characterization ran 65 lifecycle tests, including 12 expected failures for accepted Q1/Q2 changes.
Those 12 cases are now ordinary passing tests.
Three additional regression cases bring the matrix to 68 passing tests: invalid pause, force-distance and continuous-zoom requests cannot retire an already accepted view.
The complete expectation source is [controllerLifecycle.test.js](../../src/app/js/controller/controllerLifecycle.test.js); it imports neither the lifecycle policy nor its class table.

| Operation           | Newer view                                                                           | Replacement/disposal                             | Pending edit                                                | Caller cancellation                                                      | Renderer failure                                                                  |
| ------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------ | ----------------------------------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| Standing view       | Retired work cannot publish/recover                                                  | No successor mutation                            | Accepted choices reconcile into the committed edit          | Q1: applied visibility remains and is published                          | Current scene recovery restores preceding visibility/language                     |
| Modes/reset         | No retired final publication                                                         | No successor mutation                            | Choices survive reconciliation                              | Applied modes/reset remain                                               | Failure stays observable; actual applied choices are published                    |
| Neighborhood reveal | No retired recovery into successor                                                   | No successor mutation                            | `VIEW_REJECTED`                                             | Current temporary scene is cleared                                       | Current temporary scene is cleared                                                |
| Arrangement         | No stale completion                                                                  | No successor mutation                            | Placements survive reconciliation                           | Applied placement remains; waiting stops                                 | Failure stays observable                                                          |
| Edit                | Standing changes can reconcile while its worker runs                                 | `EDIT_REJECTED`; no committed successor mutation | Session transaction boundary owns concurrent edit admission | No cancelled edit commit                                                 | Session restores accepted drawing/document; controller preserves the actual cause |
| SVG capture         | No publication or stale layout restoration                                           | No publication/restoration                       | Edit aborts capture                                         | No publication; only its still-current temporary layout pause may resume | No artifact; current capture recovery remains bounded                             |
| Canonical capture   | Incompatible scene work aborts its caller; session capture guard stays authoritative | `DOCUMENT_CAPTURE_SUPERSEDED`; no artifact       | Session transaction guard owns capture/edit admission       | `DOCUMENT_CAPTURE_SUPERSEDED`; no artifact                               | Encoding/publication failure does not mutate the document                         |
| Force distances     | Synchronous mutation; no deferred completion to race                                 | Admission/lifetime checks apply                  | No canonical semantic mutation                              | Already-aborted callers do not apply work                                | Synchronous failure stays observable                                              |
| Clear neighborhood  | Synchronous restoration followed, when needed, by the ordinary focus/view path       | Delegated view ticket protects any awaited paint | Session transaction guard remains authoritative             | Pre-abort does nothing; later focus waiting follows view policy          | Restoration failure stays observable                                              |

For synchronous operations, a later stimulus cannot race a nonexistent suspended continuation; meaningful checks are admission, mutation failure and the work they retire.
Export settlement/paint/worker gates model external waits independently, without asserting a browser scheduling result.
Successful SVG capture resumes only its own temporary pause.
Failed scene acceptance leaves a preceding valid view current.

## Executable document policy

The inventory covers all 37 actual public members: 29 document operations and 8 named application observations/controls.
An independent test compares this inventory with the real controller's returned members and rejects overlap.
The application inventory preserves loading-state observation, viewport resizing, editor preferences, diagnostics, subscription and disposal behavior.

| Class            | Pending-load admission       | Retires active work when accepted               | Temporary presentation            | Currency                | Ownership transfer          |
| ---------------- | ---------------------------- | ----------------------------------------------- | --------------------------------- | ----------------------- | --------------------------- |
| `load`           | Allowed; replaces prior load | Load, edit, view, transient view, capture       | Retire                            | Load epoch              | Validated source            |
| `edit`           | `EDIT_REJECTED`              | Capture; committed revision then retires views  | Retire                            | Generation              | Validated intent            |
| `view`           | Retryable `LOAD_PENDING`     | View, transient view, capture                   | Retire                            | Generation and revision | After scene acceptance      |
| `transient-view` | Retryable `LOAD_PENDING`     | View, transient view, capture                   | Explicit temporary-scene work     | Generation and revision | Accepted scene/request      |
| `capture`        | Retryable `LOAD_PENDING`     | None; a second capture is refused until release | Retain ordinary capture semantics | Generation and revision | Exclusive capture admission |
| `read`           | Retryable `LOAD_PENDING`     | None                                            | Retain                            | Generation and revision | Synchronous admission       |

Scene preparation retires incompatible captures before attempting scene work; it does not transfer the view ticket before acceptance.
The session retains its separate busy, transaction and revision guards.
Caller cancellation affects the combined wait signal, while ownership remains current until supersession, identity replacement, release or disposal.
Success, recovery and final publication consult the same ticket.
Release is idempotent and cannot release a successor's ticket.

There are two named document-policy exceptions:

1. `setVisualizationView`: focus/camera-only requests may retain a neighborhood; visibility, language, layout or clearing focus retires it.
2. `revealOntologyNeighborhood`: reject an active edit, while arrangement and standing view work can reconcile.

Application controls are outside this exception count, as approved in DEC-010.
No caller-supplied flags can override policy.

## Bounded implementation findings

The original uncoded renderer failure during an edit was masked by an invalid `details.reason: undefined` error.
The controller now includes that detail only for a string code, preserving the original cause and the session's unchanged rollback behavior.

PR-D publishes a closed, revision-bound neighborhood descriptor and routes it through the existing presenter.
The menu no longer maintains neighborhood ownership or a sequence counter.
Subscriber notifications are isolated; failures append one bounded diagnostic warning and warning delivery never recursively reports another subscriber failure.

PR-E's canonical renderer ports pass label-submission expiry, wheel-after-pan revision, viewport retention, explicit zero loop-label placement and canonical MUTO mount checks.
The MUTO port exposed a test-DOM limitation: `xmldom` corrupts its child list for `insertBefore(node, node)`.
A standalone reproduction failed without WebVOWL code; the fixture now implements the [DOM pre-insert reference-child step](https://dom.spec.whatwg.org/#concept-node-pre-insert).
The production renderer was not changed to accommodate the fixture.

## Browser qualification and performance guard

Chrome 155.0.8059.85 passes all 108 `live-recovery` checks with no uncaught browser exceptions.
The checks include worker transactions, rollback, SVG/LaTeX/Turtle/canonical exports, byte-preserving reopen, native editing and permanent legacy migration.
The retained receipt is `architecture-live-recovery-4/browser-qualification.json` in the implementation evidence directory identified by the architecture plan.
Blink is qualified within this development/headless scope; Gecko and WebKit have not been qualified in this environment.

The final `performance-search` qualification passes ten load/edit/reveal/export/dispose cycles.
Its live-heap positive control observes session, controller, runtime, graph, worker, scene and preparation owners; the retired heap retains none of those tracked owners and no worker target remains.
The complete receipt and paired heap snapshots are retained in `architecture-browser-final`.

The live fixture required three corrections against unchanged production behavior:

- A worker edit with an artificial one-quad RDF budget fails in both the protected parent and candidate because ranking requires two quads.
  The fixture now asserts that bounded rejection, then verifies edit and recovery with normal limits.
- Local file acquisition reads bytes asynchronously before presenting its dialog.
  The fixture now waits for the observable dialog under its existing abort deadline.
- The loader detects syntax from bytes when no format is supplied.
  The format-choice fixture now supplies an intentionally unsupported explicit format to exercise the existing human-choice continuation and verify cached acquisition without a refetch.

No production resource limit, input-selection policy or timeout was changed for these corrections.
The independent canonical renderer ports and static production reachability checks cover retirement of the old renderer input path.

The quiescent architecture guard compares the protected parent and candidate using the existing FOAF and benchmark workloads.
Each cohort has one warm-up and five measured samples per fixture; all query answers and fixture hashes are identical.
The candidate's first idle preflight rejected 15.5% CPU activity, before measurement; the subsequent accepted cohort and the rejection are both retained.
No build, test or bulk scan ran alongside either cohort.

| Signal                       | Protected parent median | Candidate median |
| ---------------------------- | ----------------------- | ---------------- |
| FOAF load to next paint      | 570.2 ms                | 615.7 ms         |
| Benchmark load to next paint | 2341.3 ms               | 2351.9 ms        |
| FOAF first / warm query      | 0.3 / 0.1 ms            | 0.3 / 0.1 ms     |
| Benchmark first / warm query | 0.4 / 0.2 ms            | 0.4 / 0.2 ms     |

Load p95 decreased in both cohorts; these five-sample observations show no corroborated regression outside the prior budget.
They do not establish a production performance improvement or replace performance S0's stronger baseline.
Raw cohorts and the derived comparison are retained as `architecture-latency-parent-1`, `architecture-latency-candidate-1` and `architecture-timing-comparison.json`.

## Final assurance boundary

Legacy renderer retirement and the consolidated internal review are complete.
Configured full verification, final external review, any narrowly scoped repair proof and signed branch delivery must be admitted before the architecture handoff is complete.
Only the final architecture candidate receives the authorized Claude Opus 5.5 review at Max with a 60-minute time limit and no other resource limits.
Performance implementation starts after that handoff; UI decisions remain deferred.
