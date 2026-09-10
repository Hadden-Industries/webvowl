# WebVOWL action parity amendment

The owner's accepted outcome is the same non-editing application actions for a
human reader and a WebMCP caller. This amends the accepted 2026-08-29 design and
plan. It does not authorise ontology editing, publication or additional network
retrieval policies. Browser artifacts remain local to the page.

The [motivating outcome](2026-08-29-webmcp-integration.md#motivation-and-intended-outcome--2026-09-09)
is a source-grounded ontology figure produced through WebVOWL after an agent's
AQFO diagram invented a "Fishing Vessel" class, as reported by the owner. Action
parity makes the agent's chosen view inspectable and adjustable by the reader.
The parity inventory serves that outcome; completing it must also satisfy the
[AQFO acceptance scenario](../evaluations/webmcp-integration.md#motivating-aqfo-acceptance-scenario),
including exact-IRI resolution, actual viewport framing, faithful SVG content and
honest artifact delivery. Its result remains pending independently of earlier
parity checkpoints.

[ADR 0012](../adr/0012-human-and-agent-visualization-action-parity.md) records
the superseded ownership restrictions and distinct identity boundaries.

## Action semantics

Pause stops automatic layout motion and retains the arrangement. Resume restarts
motion, including after native settlement. An omitted layout action leaves the
current running/paused choice alone. Zoom and center changes magnification and
translation to frame the visible graph; it does not rearrange nodes. These are
the existing human controls' meanings. `preserve` and `fit` are retired without
aliases. Standing view choices are recorded separately from transient commands.

The implementation plan's action-parity table is the acceptance inventory. Each
entry requires one shared domain implementation, observable state in the human
interface, closed validated inputs at the agent boundary and browser evidence.
Experimental editing has no agent registration. Presentation gestures do not
become a generic command channel.

## Reuse and software selection

Inspected 2026-09-09: application dependencies, installed package exports and
licences, current upstream documentation and registry metadata. The application
keeps AGPL-3.0-only and its pinned owlapi Git contract. No library is required for
pause, viewport, filters, display modes, distances, reset or arrangement: use the
existing D3 7.9.0 renderer and native DOM/AbortSignal interfaces. D3's installed
ISC notice is retained. The current [WebMCP draft](https://webmachinelearning.github.io/webmcp/)
owns registration, not WebVOWL's domain definitions.

JSON and SVG have native browser serializers (`JSON.stringify`, `XMLSerializer`).
Blob/object URLs and Web Crypto already own local artifact publication and hashing.
Retain these owners and test resulting documents with their consumers.

Turtle has no native browser serializer. The pinned owlapi public exports explicitly
defer concrete storers (`node_modules/owlapi/index.js`); importing its private or
transitive implementation would violate application dependency ownership. The
current UI exporter hand-builds Turtle and mutates renderer elements to store prefix
representations. The owner explicitly directed preservation of that generation logic
on 2026-09-09: this initiative wires Turtle export only. Its content correctness and
eventual replacement by a public owlapi storer are separate work.

The maintained [N3.js writer](https://github.com/rdfjs/N3.js#writing) accepts RDF/JS
terms and owns Turtle serialization and escaping. Registry lookup on 2026-09-09
reports stable **2.7.12**, Node >=12, runtime dependencies `buffer` ^6.0.3 and
`readable-stream` ^4.0.0, and an upstream browser ESM build. Its
[MIT licence](https://github.com/rdfjs/N3.js/blob/main/LICENSE.md) requires retention
of the copyright and permission notice. This is compatible with retaining this
application's AGPL terms; no relicensing is proposed. Browser bundling and actual
installed notice retention still require verification after installation.

The N3 research above is retained as an evaluated alternative. The proposed N3
dependency and new VOWL-to-RDF/JS mapping are withdrawn under that owner decision;
neither package.json nor package-lock.json changes for Turtle wiring.

Move the existing generation code to `runtime/ontologyTurtleSerializer.js` beneath
the renderer boundary, preserving its content-generating helpers. The runtime's
`createTurtleDocumentSnapshot` returns only generation and generated text. The
controller routes human and WebMCP requests to the same artifact publication owner,
which hashes and publishes those bytes verbatim, without layout settlement. This
does not certify the existing Turtle as semantically complete or syntactically valid
for every ontology. Preserve the original generation test and source evidence.

LaTeX remains WebVOWL-specific TikZ drawing output. Preserve the existing drawing
semantics while extracting immutable rendered geometry under the renderer owner;
escape ontology text as data and independently inspect the generated document.
Do not import a second rendering engine merely to duplicate the live graph.

## Verification and review

The R1 pause/viewport correction retains test-first RED/GREEN evidence. Broader
action parity is R2 because it extends the external input contract. Its prior
accepted baseline is the committed 2026-08-29 design/plan; the owner's current
task messages provide the explicit parity amendment. The local lifecycle CLI
currently accepts only Issue-shaped R2 baseline records, so it cannot faithfully
encode this pre-existing task baseline. Do not invent an Issue or claim that a
generated record establishes acceptance. Retain the baseline Git identity and
owner decisions here and apply the R2 independent review, security review and
full/manual proof obligations directly.

The owner explicitly authorised independent read-only review and the scoped native
Codex Security workflow, including review workers. Implementation remains serial.
Tests/build do not establish browser behavior, deployment or release acceptance.

## Actual renderer observation and cancellation

The resumed audit found a synthetic layout simulation behind the observation
contract, stale all-model visibility counts and early viewport completion. Remove
that second simulation. The renderer owns actual force alpha, node/property-label
positions, filtered drawn identities, and viewport transition completion. The
adapter translates these observations into the established immutable contracts.
[D3 transition completion](https://d3js.org/d3-transition/control-flow#transition_end)
and native AbortSignal composition supply the mechanism; no compatibility layer
is required. Drawing after a paused recomputation must position its SVG elements
immediately, without waiting for a force tick that pause prevents.

Readiness is established before the final browser paint observation. The browser
observer uses two animation frames with cancellation of the outstanding callback;
a single callback occurs before its frame is painted. A retained pause must not
deadlock a replacement behind hidden layout optimization.

The controller retains the last accepted VOWL model for recovery. Cancellation
before replacement leaves the prior mount alone; cancellation after replacement
re-renders the accepted model and standing view in a fresh, monotonically allocated
generation. Anonymous references are rebound to that mount. Recovery can itself be
superseded by a newer load. A failed first candidate is cleared through the runtime
lifecycle operation `clearRenderedGraph`. This is restoration of a usable accepted
ontology, not a guarantee of byte-identical SVG geometry. Report actual recovered
viewport observations. Disposal retires native drawing activity and application
resize observers/listeners as well as registrations.

Mount validity survives request cancellation chains. If a newer request interrupts
recovery and then fails before mounting, recovery must run again; republishing the
old controller state cannot restore an absent graph. Failed recovery clears both
the rendered graph and the last accepted controller-state baseline. Coded fetch or
parse failures that precede replacement reactivate the retained mount's generation,
so its view operations and events remain usable.

Native mouse drag and pan listeners live on their originating window during a
gesture. Retirement releases only the listener functions captured for this graph
and restores native selection through [D3 dragEnable](https://d3js.org/d3-drag#dragEnable).
Callbacks from retired interaction epochs cannot mutate the current simulation.
Each replacement owns a fresh SVG root and native drag/zoom behaviours; retaining
the previous root would retain D3's unfinished zoom gesture state and could disable
wheel zoom. No code rewrites D3's private gesture bookkeeping.

## Remaining view actions

Local VOWL JSON is a text document source, `vowl-json-text`, with `text` and an
optional `displayName`. It shares the source loader's native JSON validation and
exact-byte fingerprinting. The internal parsed `vowl-model` source remains distinct
and is not an agent input. Both text source kinds accept the same optional document
name; local names are provenance display names, not remote retrieval identities.
The renderer replacement contract takes the generation, model and optional
initial visualization choices. Loading and recovery must work for local sources
without a remote identity or a name.
Ontology summaries retain the actual optional identity/name from provenance.
Human document input uses the pinned owlapi parser's native input-byte limit
(currently 32 MiB), including VOWL JSON text. WebMCP separately limits supplied
text to 1 MiB of UTF-8. That agent input ceiling must not reject an otherwise
supported human file or pasted document.
Pasted JSON-LD remains ontology syntax text. Direct input labels the action Load.

Source adapters retain the accepted drawing while the controller validates a
replacement. Failed fetch/read/parse presentation leaves that drawing usable.
Pending file reads are superseded by newer selected files, source actions, observed
controller loads or adapter disposal. Source parsing and replacement remain with
the loader/controller; UI adapters identify input syntax and present outcomes.

Reset is one shared asynchronous operation. It restores default modes (including
label width 120 and same external color), class/datatype distances 200/120,
minimum degree zero and all filter groups except disjointness; clears focus and
selection; restores the default viewport; and resumes layout. It retains the
ontology and chosen label language. Existing pins and experimental editing mode
are not reset effects. Completion follows the actual SVG transform and paint.
Cancellation publishes defaults already applied to the drawing and retains layout
observation. A later human selection survives completion. Reset is rejected with
`VIEW_REJECTED` during loading/parsing/rendering so it cannot relabel the retained
mount as a pending generation; idle reset remains available. Human controls
remain available during background layout: `relaxing` follows initial paint and
must not be presented as a still-loading, disabled graph.

Explicit pan uses `translation: {xPx, yPx}` in viewport pixels and preserves
magnification and node arrangement. The shared request boundary uses the same
0.01–4 magnification interval advertised to the browser agent. Requested viewport
coordinates remain transient; published translation describes the actual view.

Display modes and force distances are standing choices and must be included in
applied-view state and exported recipes. Mode requests name Boolean choices,
the existing `same`/`gradient` external-color options and label widths from
20 through 600 pixels. Distance requests name class and datatype distances from
10 through 600 pixels, matching the human sliders. Internal loop distance is not
a new agent-only tuning option. The plural `setVisualizationModes` names several
independently selected modes; the singular designation has no retained alias.

Native label animations complete geometry, text and focus even when interrupted.
Cancellation stops waiting for a request; it does not undo already applied standing
choices. Immutable `visualization-view-changed` observations publish those actual
choices independently of request success, and retired generations cannot publish.
Agent results omit whole focused/selected references to meet their bounded response
budget, retain the original counts and core visualization values, and never shorten
retained reference identities into different identifiers.

Human controls subscribe to applied state; importing, resetting or agent actions
must not depend on simulated checkbox clicks or reading values back from menus.
Reset restores the existing visualization defaults and clears focus/selection
through a single shared operation. Experimental editing remains excluded.

## Saved visualization and share-link ownership

The application decodes persisted VOWL settings into the shared view, display-mode
and force-distance requests. False and zero are explicit values. Saved pause and
viewport coordinates are applied before first paint; cancellation recovery uses
the same initial-choice path. Explicit load choices override corresponding saved
fields, retaining other saved choices. Invalid settings reject a candidate before
replacing the accepted graph.

JSON settings export reads applied controller state, including language, precise
viewport coordinates, external-color mode and label width. It retains the existing
VOWL checkbox identifiers as file-format vocabulary. Share links retain existing
short option names and additionally carry pause, language, viewport coordinates
and label width. Native URL and URLSearchParams parsing preserves an ontology IRI
fragment. Links name the accepted remote source, rather than the location left by
an earlier load; local documents require a file export to share their content.
Experimental editor and sidebar presentation options remain human UI concerns.

## Artifact capture and publication

SVG, VOWL JSON and LaTeX use `visualizationArtifactService` for native Blob
creation, exact-byte SHA-256, single-current object URL ownership and publication.
The menu and agent caller invoke the same controller export operation. JSON
serializes a detached canonical document with the current arrangement and applied
settings; it neither waits for settlement nor changes layout motion. SVG and
LaTeX wait for settlement, fonts and paint before taking a detached snapshot.
The runtime captures LaTeX drawing values in graph pixels; `tikzSerializer`
retains WebVOWL's established shapes and link presentation while escaping labels
as text. It reads no renderer objects or live DOM.

Only one export owns capture at a time. Replacement, disposal and caller
cancellation retire it before obsolete bytes can be published. A temporary
capture pause is restored only in its own generation and only if no validated
layout intent has replaced it. A rejected view/reset request is not such an
intent. Native browser checks on FOAF verified exact SVG, JSON and LaTeX hashes,
JSON saved pause, SVG XML parsing and finite TikZ output. This does not establish
TeX-engine compilation or a downloaded local file.

The owner approved moving the two existing export exception paths in
`eslint.config.js` from the menu to the TikZ serializer on 2026-09-09. This
restores the normal style restrictions on the menu; the serializer's TeX
`/.style` declarations are not HTML style attributes.

The existing TikZ consumer remains PGF/TikZ. The current
[CTAN package](https://ctan.org/pkg/pgf) is 3.1.12; its listed distribution terms
are LPPL 1.3c, GPL-2.0 and FDL for the corresponding package components. No PGF
code is bundled or installed by this application change. The generated file
retains the existing TikZ/LaTeX package requirements, including graphicx for
resizebox. No `pdflatex` executable was found on the verification host's PATH;
actual TeX compilation remains an explicit verification gap.

The node-degree algorithm owns its observed maximum, automatic minimum and applied
minimum. A degree is a non-negative safe integer; the former agent-only cap of 100
is removed. The controller publishes immutable degree-range observations and the
degree control renders the range and value together. The algorithm does not read
or command sliders. This ownership migration does not change the linear scale of
the human slider or imply that the reported older Edge screenshot is reproduced.
