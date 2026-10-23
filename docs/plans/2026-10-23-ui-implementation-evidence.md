# UI implementation evidence

Status: implementation checkpoint, 23 October 2026.
Final full verification, foreground qualification and external review have not run for this UI candidate.

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
These are overlapping scoped receipts, not a claim that the full UI suite has run.

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

Headless engine checks and accessibility trees do not prove spoken announcements, native IME behavior, real mobile keyboards, actual Safari/iOS or assistive-technology combinations.
Collect the remaining manual coverage in the final owner batch after automated work.
Foreground timings remain gated on consolidated optimized code and full automated checks, as required by the accepted plan.
