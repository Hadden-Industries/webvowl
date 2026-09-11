# ADR 0010: The rendered graph is a projection of the ontology, never its store

| Metadata    | Value                                                                            |
| ----------- | -------------------------------------------------------------------------------- |
| **Status**  | Accepted                                                                         |
| **Date**    | 2026-09-03                                                                       |
| **Decider** | Repository owner                                                                 |
| **Amends**  | `docs/plans/2026-08-29-webmcp-integration.md` §1.1, §1.2, §1.4, §1.7 and Task 10 |
| **Design**  | `docs/designs/2026-09-03-ontology-model-ownership.md`                            |

## Context

The owner's 2026-09-09 action-parity amendment supersedes decisions 5 and 8's
restrictions on arrangement references and agent access to viewing controls.
[ADR 0012](0012-human-and-agent-visualization-action-parity.md) records that scope
and the distinct document, ontology and rendered-occurrence identities. The
ownership and immutable-boundary rules below remain in force.

Task 9 established a `RenderedGraphRuntime` seam and a `WebVowlController` that
reduces renderer facts into frozen state. It did not settle who _owns_ the
ontology. Three consequences of leaving that unsettled surfaced together.

**The semantic channel runs through the renderer package.**
`projectOntologyInspectionSnapshot` is a pure function of the VOWL model — it
never reads a drawn element — but it lives in
`src/webvowl/js/runtime/d3RenderedGraphAdapter.js`, and the only route to a
snapshot is `renderedGraphRuntime.readOntologyInspectionSnapshot()`. The
application therefore cannot answer a semantic question until the renderer has
mounted and rendered, cannot deep-link before layout, and cannot test the
projection without standing up D3. The projection currently hard-codes nine
declared relation arrays to `[]`, and no consumer downstream of it can recover
what it dropped.

**The controller's state has no declared shape.**
`freezeWebVowlControllerState` deep-freezes whatever it is handed and asserts no
field set — the only contract in the repository that does not. `selection` and
`renderProgress` exist in published state solely because two reducer branches add
them, and neither appears in `IDLE_CONTROLLER_STATE`. Because
`publishForGeneration` spreads over the previous state and nothing clears
generation-scoped fields, a selection made in one load generation survives into
the next. An executable probe confirmed it: select an element, load a second
ontology, and `getState().selection` still names an element of the retired
generation.

**A live, mutable renderer element crosses the boundary.** The sidebar receives
the drawn element itself and calls roughly twenty-six accessors on it. Those
accessors are instance-own closures — 70 per drawn node, 78 per drawn property,
because each constructor runs `BaseElement.apply(this, arguments)` — and every
one of them is a setter when called with an argument.

Two properties of the data constrain any answer.

**VOWL is keyed by drawn occurrence, not by entity.** In `foaf.json`,
`owl:Thing` is six separate class entries and `rdfs:Literal` is twenty-one; in
`goodrelations.json`, sixty class entries carry no IRI at all. An IRI is
therefore not an identity, and `rendererElementIdsByOntologyElementReferenceKey`
already maps one reference key to an array of renderer ids.

**A canonical `OWLOntology` exists but is not universally available.** The
`owlapi` consumer cutover landed at `21003ad5`, and `src/owl2vowl/` builds a real
ontology at `src/owl2vowl/js/index.js:95` — then discards it when `build()`
returns the VOWL model. Only `ontology-document-iri` and `ontology-text` produce
one; `vowl-json-url` and `vowl-model` never do, and every shipped preset loads
through `vowl-json-url`.

## Decision

1. The rendered graph **MUST** be treated as one projection of the ontology and
   **MUST NOT** be the system of record for any fact that outlives a mount. A
   user-interface module **MUST NOT** obtain ontology facts by reading a rendered
   element, a renderer settings bag, or the live SVG.

2. `OntologyInspectionSnapshot` **MUST** be projected by an application-owned
   module, `src/app/js/controller/vowlModelInspectionProjector.js`, from the VOWL
   model the `OntologySourceLoader` already returns.
   `readOntologyInspectionSnapshot` **MUST** be removed from
   `RENDERED_GRAPH_RUNTIME_METHOD_NAMES`. `WebVowlController` holds the snapshot;
   `OntologyInspector` remains a pure function over one.

3. The snapshot **MUST** remain projectable from the VOWL model alone. It
   **MUST NOT** require an `OWLOntology`, because two of the four source kinds
   never produce one and the WebMCP tool surface cannot advertise facts that
   exist for only some sources.

4. `readVisibleRenderedGraphSnapshot` **MUST** stay on the seam. The renderer
   owns what is _visible_; the application owns what is _true_.

5. The application **MUST** address ontology entities only. Occurrence identity —
   which of six drawn `owl:Thing` nodes was clicked — **MUST NOT** cross the
   seam. A focus request naming an entity correctly marks every occurrence of it,
   and the selected halo, `pickAndPin` and drag remain renderer-local because
   none of them outlives a mount.

6. `WebVowlControllerState` **MUST** have a closed field set asserted at its
   defining contract, including `selection` and `renderProgress`, and
   generation-scoped fields **MUST** be reset when a new load generation begins.

7. Renderer-owned continuous state **MUST** reach the interface as a published
   fact, never by the interface reading the renderer. `viewport-changed`, already
   specified with payload `{ zoomScale, translationXPx, translationYPx }` and
   never published, **MUST** be published by the adapter and reduced into
   controller state.

8. Renderer tuning that carries no application meaning **MUST** still be routed
   through the controller rather than by a user-interface-to-renderer call, and
   **MUST NOT** become a WebMCP tool. This follows the `setGraphLayoutPaused`
   precedent that §1.4 already establishes.

9. Narrowing what crosses _into_ the renderer is **deferred**. The rule is
   recorded so future work does not widen it: the renderer's input should be a
   minimal sufficient statistic for drawing.

## Rationale

The governing test is whether a fact still means something when the graph is not
mounted. Ontology labels, relations, annotations and the identity of the selected
entity all do; simulated positions, the zoom transform, the selected halo and a
pinned node do not. That test, not "data versus interface", is what places each
fact.

Three information-theoretic properties make the placement rule more than taste.
The **data-processing inequality** says a consumer downstream of a lossy stage is
permanently capped by it, which is why widening the adapter's projection is a
weaker fix than moving ownership: the renderer would remain upstream of every
semantic question. A **minimal sufficient statistic** is the precise form of
decision 9 — the renderer's input must determine every pixel and nothing else.
**Single encoding** is why labels live once in the model and reach the renderer
as a derived display value rather than as a second stored copy that can disagree.

The same reasoning rules out one tempting simplification. Collapsing FOAF's six
`owl:Thing` occurrences into a single entity would assert structure the source
never asserted. Occurrence multiplicity is meaningful even though it looks
redundant, which is why decision 5 pushes occurrence identity _down_ into the
renderer rather than resolving it away.

Decision 3 is a finding, not a preference. An `OWLOntology`-backed snapshot would
serve pasted and fetched OWL documents while leaving every preset — and therefore
`#foaf`, the first thing most readers see — with nothing.

Decision 7 was reached by discovering that the plan had already specified the
mechanism. An earlier draft proposed `viewport: "zoom-in" | "zoom-out"` step
directives, which cannot express the zoom slider at all: the slider reads
`graph.scaleFactor()` to position its thumb and writes `setSliderZoom(v)`, so it
needs a continuous value in both directions. `viewport-changed` supplies the read
direction and was already contracted and conformance-tested.

## Consequences

- Semantic questions become answerable during `status: "loading"`, before the
  renderer mounts. Deep-linking to a selected element and early
  `get_ontology_summary` become possible.
- The projection becomes testable against the shipped models with no renderer, no
  DOM and no D3.
- A writable renderer object stops crossing the boundary.
- `OntologyInspectionSnapshot` gains the nine declared relation arrays and four
  new fields — annotations, property characteristics, cardinality and localized
  descriptions — which closes the equivalents-search regression recorded in the
  2026-09-03 handoff and completes what `get_ontology_summary` and
  `find_ontology_elements` can report.
- Property characteristics are classified out of VOWL's flat `attributes` bag
  because OWL defines them unambiguously; class-expression kinds and status
  markers stay unclassified rather than risk mis-classification.
- Annotation records expose `propertyIri` as nullable. Legacy presets predate
  `vowlBuilder` and carry no `predicateNs`, so their annotation property IRIs are
  unreconstructible. Asserting one would invent structure the source never
  carried.
- Four presets — `foaf.json`, `goodrelations.json`, `muto.json` and `sioc.json` —
  are to be regenerated as separate work so their annotations gain
  `predicateNs`. The route is a full load followed by **Export JSON**, which
  writes live positions; `settings`, `metrics`, `pinned` and the appended
  `_comment` suffix are stripped afterwards. `benchmark.json`,
  `new_ontology.json` and `template.json` have no OWL source and **MUST NOT** be
  regenerated: they carry `union`, `intersection`, `complement` and top-level
  `datatype` arrays that the export deliberately does not write.
- Regeneration produces a new layout rather than restoring the current one.
- Editor mode gains a read path only: `editorMode` is published into controller
  state so `sidebar.revealDetailsSectionForCurrentMode` stops reading
  `graph.editorMode()`. No editing vocabulary is opened.
- `replaceVowlModel` continues to receive the whole VOWL model. Decision 9 means
  this is a recorded debt, not an accident.

## Verification obligations

- A selection made in one load generation **MUST** be shown absent from
  controller state after a subsequent load completes.
- `WebVowlControllerState` **MUST** reject an unknown field at its defining
  contract.
- `vowlModelInspectionProjector` **MUST** be exercised against the shipped
  `foaf.json` and `goodrelations.json` with no renderer in the test, and **MUST**
  populate every relation array those models can supply.
- Searching for the label of an equivalent class **MUST** find the element it is
  equivalent to, ranked below a direct label hit.
- `assertRenderedGraphRuntime` **MUST** reject a runtime that still exposes
  `readOntologyInspectionSnapshot`, so the seam cannot silently regain it.
- A published `viewport-changed` event **MUST** be shown to reach controller
  state, and the zoom slider **MUST** be shown to read that state rather than the
  renderer.
- An annotation originating from a legacy preset **MUST** project
  `propertyIri: null` rather than a guessed IRI.

## Implementation map

| Change                            | Location                                                         |
| --------------------------------- | ---------------------------------------------------------------- |
| Closed controller state and reset | `src/app/js/controller/webVowlControllerContracts.js`            |
| Application-owned projector       | `src/app/js/controller/vowlModelInspectionProjector.js`          |
| Seam narrowing                    | `src/app/js/controller/renderedGraphRuntimeContracts.js`         |
| Snapshot ownership                | `src/app/js/controller/webVowlController.js`                     |
| Equivalent-label ranking          | `src/app/js/controller/ontologyInspector.js`                     |
| Viewport fact publication         | `src/webvowl/js/runtime/d3RenderedGraphAdapter.js`               |
| Zoom, gravity, mode requests      | `src/app/js/menu/zoomSlider.js`, `gravityMenu.js`, `modeMenu.js` |
| Selection details from state      | `src/app/js/sidebar.js`                                          |
