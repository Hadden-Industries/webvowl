# UI manual-validation packet

Status: the single residual browser and assistive-technology batch for the UI delivery on `feat/architecture-performance-ui`.
This packet does not claim that an untested platform passed, and does not authorize deployment.
On 23 October 2026 the owner explicitly kept manual acceptance pending until this batch is validated; no unrun combination is waived.
The [bounded initial-layout follow-up](2026-10-23-initial-layout-improvement-plan.md) proceeds through its separate design decision, while this packet remains the single manual acceptance batch.

## Candidate and starting state

Use the final commit containing this packet and the [delivery handoff](2026-10-23-ui-final-handoff.md), and record its full SHA below.
Build with the repository-pinned runtimes and the existing `npm run build` command; serve `deploy/` with the existing Vite preview command on a local test origin.
For a phone or another computer, use an owner-selected reachable test origin serving those same bytes.
Do not substitute the existing public deployment unless its build identity has been verified.
The [implementation evidence](2026-10-23-ui-implementation-evidence.md) identifies the retained production manifest and automated receipts.
The measured rendering build for this checkpoint is production manifest 56, SHA-256 `ecf5f2b245836ce414bcce81ae9651019c24eeeb629f6ad4895e48eb8e001f1a`.
Measurements were collected against source checkpoint `91ef9f2d2579de664862765856fcf987e445467c` and the following working changes; record the signed commit containing this packet as the manual-test candidate.
The [current rendering follow-up](2026-10-24-active-graph-performance-follow-up.md#initial-paint-and-glyph-clearance--manifest-56) identifies the scoped source and automated checks, separating them from manifest 51's earlier full verification.
Record that exact SHA in the candidate record when beginning manual testing.

Start each scenario with the packaged FOAF example, editor mode off, graph unpaused and no selection.
Use the visible Ontology control, clear the source field, choose FOAF from the examples group, then activate Visualize.
Use H1–H4 only for the source-selection scenario; their latest aliases are mutable and require network access.
For long semantic content, select a class or property, open Details and follow a related entity.
The independent automated fixture already covers all eight roles, hidden/anonymous relations, long annotations and every returned description field; manual checks concentrate on usability and announcements.

| Candidate record                              | Value                   |
| --------------------------------------------- | ----------------------- |
| Full commit SHA / build identity              | To record               |
| Test origin                                   | To record               |
| Tester and date                               | To record               |
| OS / device / browser version                 | To record per row below |
| AT name, version, input language and settings | To record per row below |

## Required combinations

Run the scenarios listed for each actual combination.
Reuse the shared steps rather than repeating separate checklists.
Mark unavailable combinations explicitly; the release owner must then choose to obtain coverage or accept a documented release limitation.

| Actual platform                                          | Scenarios | Result and evidence |
| -------------------------------------------------------- | --------- | ------------------- |
| Windows, NVDA with Firefox                               | M1–M4, M6 | Not run             |
| Windows, NVDA with Chrome                                | M1–M4, M6 | Not run             |
| Windows, JAWS with Chrome                                | M1–M4, M6 | Not run             |
| macOS, VoiceOver with Safari                             | M1–M5     | Not run             |
| iOS, VoiceOver with Safari and real software keyboard    | M1–M5     | Not run             |
| Android, TalkBack with Chrome and real software keyboard | M1–M5     | Not run             |

## M1 — Source choice, commitment and loading

1. Open Ontology and focus its source field.
   Navigate suggestions using arrows; inspect the announced item, its group and provenance.
   Search using a distinctive label or URL fragment.
2. Press Enter on an active suggestion once.
   Confirm that its URL is committed, the list closes, and no load starts.
   Press a separate deliberate Enter or activate Visualize; confirm exactly one load and an understandable status announcement.
3. Repeat with a packaged example and an H1–H4 source.
   Check that the field preserves the committed source and the loaded graph remains usable.
   Network/source warnings should remain available in Overview.
4. With a native Chinese, Japanese or Korean IME, commit a composition using Enter.
   Confirm that composition neither chooses an unintended suggestion nor starts a load.
   Then deliberately submit normally.
   Also hold Enter to exercise repeat suppression.
5. Enter an invalid/unreachable address and submit. Confirm the draft remains available for correction and the error/status can be discovered without losing focus.

**Pass:** focus remains on the editable combobox while navigating; active and committed choices are distinguishable; group/provenance information is understandable; only the deliberate load action loads; native composition is safe.
Record actual spoken output where an announcement is missing, duplicated or misleading.
Automation covers keyboard state, route, repeated and simulated composition events, scroll-to-active behavior and error/draft structure.
It cannot establish native IME event ordering or spoken AT output on these combinations.

## M2 — Overview, nested facts and focus return

1. Open Overview with the keyboard or AT activation.
   Read the dialog title, source, metadata, counts, warnings and available retained facts.
2. Open retained facts.
   Close the inner dialog using Escape or the platform's standard dismiss gesture.
   Confirm focus returns to the Facts invoker in Overview.
3. Close Overview.
   Confirm focus returns to the title/Overview control.
   Reopen it, traverse controls in both directions, and confirm a modal dialog contains keyboard focus without trapping dismissal.

**Pass:** headings and relationships are understandable, the inner surface closes first, each focus destination is visible, and the graph is reachable after closing.
Automation covers DOM semantics, native dialog containment and actual asynchronous focus return in Chromium, Firefox and WebKit.
Real Safari and AT reading/dismissal behavior remain unobserved.

## M3 — Preview, full Details and related descriptions

1. Select a graph item.
   Read its preview, type/role and concise content.
   Open Details and inspect the full fields, long IRI, copy control and retained facts link.
2. Follow a related entity in Details.
   Confirm the graph selection stays unchanged, the new subject is announced/readable, and Back returns to the original selected entity.
   Close Details and confirm focus returns to its surviving invoker.
3. On a wide viewport, pin the inspector and traverse between it and the graph.
   Unpin it.
   On a narrow viewport, confirm Details is modal and its close control remains reachable.
4. Select another entity, change language, then load a different source.
   Confirm obsolete content is not presented as current and closing/reopening does not return to a stale related page.

**Pass:** no field is inaccessible because of preview truncation; role, relation and navigation meaning is clear; focus returns predictably; no unexpected graph-selection or camera change occurs.
Automation covers field completeness, inert hostile content, role focus, related-description identity, lifetime, exports and DOM movement.
AT reading order and announcement quality need this actual-platform check.

## M4 — Zoom, narrow landscape, touch and the keyboard viewport

1. On desktop, use the browser's real 200% zoom.
   Check the chooser, Overview, Details and compact editor.
   Read long content and reach every close, action and disclosure control without horizontal page scrolling.
2. On a phone, focus the source field with the software keyboard open.
   Search and choose a suggestion, then dismiss the keyboard.
   Rotate to narrow landscape and repeat Overview/Details navigation.
3. Pan and pinch the graph, tap a node/property, dismiss a preview using a separate blank-canvas tap, and exercise editor controls.
   A drag-ending tap must not accidentally clear selection; essential actions must have a non-drag alternative.
   At several graph zoom levels, click/tap nodes with small natural hand movement: Details should open without moving the node or restarting settled layout.
   Move deliberately beyond the six-CSS-pixel threshold, including an off-centre grab: dragging should engage predictably without a jump and remain active when returning toward the starting point.
   Repeat while paused and while running; confirm the threshold feels usable with the actual mouse, touchpad and touch hardware.
4. Verify pinch zoom/text enlargement supported by the browser's accessibility settings.
   Confirm that the corrected viewport declaration permits the browser's zoom controls; report any remaining behavior with exact browser/device versions.
5. Let a larger graph settle, then pan across and beyond the initially visible region, release and zoom.
   Use the real extended Universal Ontology where available, and activate the total-count button in Filters to include all 953 nodes; record the actual count and whether layout is running or settled.
   Repeat after real browser zoom, display-density changes where available, viewport rotation and a theme/contrast change.
   Confirm the cached drawing and live SVG retain the same labels, dotted/dashed strokes, arrowheads and positions, with no blank edges, stale image, blur jump or inaccessible graph content.
   Move a node deliberately and pan again; the new position and attached links must appear immediately even while a new cache is preparing.
6. Reload a fresh ontology with no saved positions or explicit camera, at the default Class/Datatype distances of 200/120.
   Observe the initial overview before relaxation, both for the default 50-node view and a full larger graph.
   Circles must initially have visible clearance rather than touch; all node glyphs should fit the viewport, with VOWL notation intact.
   The settings are graph-unit gaps outside glyphs, scaled by the fitted camera; they are not 200/120 physical-screen-pixel guarantees.
   Record remaining property-label crowding and any abrupt or clipped movement as the force starts.
   Initial clearance does not establish later force separation or label readability.

**Pass:** focused controls stay visible, the software keyboard does not cover the active choice/action, dialogs scroll internally, controls have usable touch targets, and graph gestures remain distinct from dismissal.
Automation covers 320 CSS pixel reflow, 568-by-320 landscape, text spacing, target rules, pan-versus-click and viewport geometry.
Manifest 40 adds unit coverage plus native Chrome mouse and emulated-touch checks for click jitter, drag activation, grab offset and cancellation.
These are not real browser zoom, touch hardware or a mobile software keyboard.
Manifest 48 adds headless native Chrome cache, resolution, export and disposal checks; actual browser/device visual transitions remain part of step 5.
Manifest 50 adds foreground real-ontology mouse/touch-to-pinch checks, matching Chrome accessibility roles/names during caching, and renewed density/export/disposal proof.
The subsequent focused cache fixture passes painted-image, accessible-name, viewport-hit, restoration, mutation and disposal checks in Chrome 156.0.8078.48, Firefox 153 and Playwright WebKit 26.6.
These engine-level checks do not substitute for actual Safari/mobile hardware, screen-reader speech or the real-device visual comparison in step 5.
Manifest 56 adds native headless first-paint/clearance proof for 50, 953 and 2,000 nodes, plus exact geometry equality after optimizing placement searches.
After the owner unlocked the screen, a foreground W6 observation confirms all 953 initial nodes fit without overlap and meet the requested clearances.
Step 6's actual-platform acceptance remains part of this packet.

The owner-approved closeout removes `user-scalable=no` and `maximum-scale=1`; the accessibility qualifier now checks the viewport without that exemption.
The [closeout record](2026-10-23-programme-closeout.md) identifies the automated proof and preserves real zoom/pinch as an actual-platform check.

## M5 — Motion and spatial continuity on actual devices

1. Select nearby and distant items while the graph runs, then while paused.
   Repeatedly switch selection during preview movement.
   Pan/zoom and resize or rotate the viewport.
2. Confirm the selected item and focused controls remain usable, the preview does not chase every tick, and no old animation queues after the latest selection.
3. Enable the OS reduced-motion preference.
   Repeat selection and resizing.
   Confirm translation/scaling disappears and information remains available immediately.
4. Background and return to the page.
   Confirm the preview resumes at the current selection without stale movement.
   Use a repeated semantic entity, such as FOAF's multiple Thing occurrences, to check that the clicked occurrence anchors the same semantic description.
5. Pan a settled graph, then resume layout, select another entity or replace the ontology.
   Confirm no cached old drawing appears after the change, including when background preparation was interrupted.
   Repeat with OS reduced motion enabled; the cache must preserve the current drawing and gesture behavior without introducing a new transition.

**Pass:** stable placement and readable motion, no unexpected camera movement, correct occurrence versus entity meaning, and an effective reduced-motion alternative.
Unit/counter checks and production Chrome measurements cover queue bounds and callback cost. Actual mobile/Safari compositor behavior, device smoothness and comfort remain manual; timing values from the Windows host do not establish those results.

## M6 — Windows contrast themes and visible focus

1. Enable an actual Windows contrast theme, then open the chooser, Overview, Details and compact editor.
2. Traverse controls with Tab/Shift+Tab, expand disclosures, follow a relation, and close nested dialogs.
3. Check text, borders, links, selected/active suggestions and focus indicators; confirm badges convey meaning without color alone.

**Pass:** every control and state remains distinguishable, links are readable, focused elements are not obscured, and no dialog content disappears into its background.
Chromium forced-colors emulation and inspected screenshots passed the relevant surface checks.
That proxy does not prove every Windows theme or AT/browser combination.

## Record findings and release disposition

The whole-load follow-up adds one check to the same pending platform batch: load a large ontology with the automatic 50-node view and open Filters while count preparation is pending.
Confirm that the graph is already usable, count controls are disabled with an understandable preparation status, and they become available without moving focus or replacing the visible nodes when preparation finishes.
Use the same screen-reader/browser and touch/keyboard combinations above; automated status, disabled-control and stable-node checks do not establish actual spoken output.

For each failure, record scenario/step, exact versions and candidate, expected versus actual behavior, and a screenshot or short spoken-output transcript where useful.
Fix demonstrated defects, then repeat only the affected scenarios against the new candidate.
Unrun required combinations remain unqualified until the release owner records a decision; source delivery, merge, deployment and complete browser/AT acceptance are separate outcomes.
