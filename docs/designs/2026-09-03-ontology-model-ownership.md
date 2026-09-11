# Proposal: move ontology model ownership out of the renderer

**Status:** accepted 2026-09-03 after review; recorded as ADR 0010 and
implemented by Task 10. This document is retained as the rationale and
measurement record. Written on branch `feature/webmcp-integration` at commit
`046ac03b`.
**Decision record:** `docs/adr/0010-rendered-graph-is-a-projection-not-the-store.md`
**Amends:** `docs/designs/2026-08-29-webmcp-integration.md` and
`docs/plans/2026-08-29-webmcp-integration.md` (§1.1, §1.2, §1.4, §1.7, Task 10).
**Supersedes the sequence in:** the handoff
`2026-09-03-selection-details-bypasses-the-controller.md`.
**Input treated as advisory, not authority:** an external note on MVC applied to
a web application with a UI and a graph renderer.

## 1. The question

The handoff says the sidebar reads a live renderer element and bypasses the
controller, and proposes widening `OntologyInspectionSnapshot` until the sidebar
can be moved onto it. The Tier 1 debt list says zoom, gravity, display modes and
editor mode still drive the renderer directly and need vocabulary the plan
deliberately omitted.

The external note proposes a different framing: the rendered graph is one
projection of the application's data, never the store of it. That framing is
correct, and applying it changes the handoff's answer. The handoff proposes to
widen a channel; the framing says to stop routing the semantic channel through
that channel at all.

## 2. What WebVOWL actually is, measured

Five facts about this repository, each measured rather than assumed, that
constrain any proposal.

### 2.1 The snapshot projection is already model-based, and already owned by the renderer

`projectOntologyInspectionSnapshot(vowlModel, loadGeneration)` at
`src/webvowl/js/runtime/d3RenderedGraphAdapter.js:130` is a pure function of the
VOWL model. It never reads a drawn element. That is better than the note assumes
for "an established D3 application".

But it lives inside the D3 implementation package, and the only route to a
snapshot is `renderedGraphRuntime.readOntologyInspectionSnapshot()`. The
application therefore cannot answer a semantic question until the renderer has
mounted and rendered. Exactly one production caller depends on this
(`src/app/js/controller/webVowlController.js:292`).

### 2.2 The VOWL model is not keyed by entity

VOWL JSON assigns an `id` per _drawn occurrence_, not per ontology entity. Across
the shipped models:

| Model                | Class entries | IRIs used by more than one entry | Entries with no IRI | Worst collision                      |
| -------------------- | ------------: | -------------------------------: | ------------------: | ------------------------------------ |
| `foaf.json`          |            48 |                                2 |                   0 | `rdfs:Literal` × 21, `owl:Thing` × 6 |
| `goodrelations.json` |           145 |                                7 |                  60 | `xsd:string` × 14                    |
| `sioc.json`          |            47 |                                3 |                   0 | `rdfs:Literal` × 20                  |
| `benchmark.json`     |            49 |                                0 |                   3 | —                                    |

So `{ kind: "class", iri: "…owl#Thing" }` is not an identity. It denotes six
drawn things in FOAF. The adapter already concedes this: it keys
`rendererElementIdsByOntologyElementReferenceKey` to an **array** of renderer
ids. And 60 goodrelations classes have no IRI at all, addressable only by the
contract's anonymous form `{ kind, loadGeneration, localId }`.

### 2.3 VOWL is itself a visualization serialization

`classAttribute` and `propertyAttribute` carry `pos`. The format persists layout.
It also splits every element in two and duplicates entities per usage for layout
readability. VOWL is not the ontology; it is a rendering-oriented projection of
one.

### 2.4 A canonical `OWLOntology` already exists, is discarded, and cannot be relied on

The `owlapi` consumer cutover landed on this branch at `21003ad5`
(_refactor(owl2vowl): Consume standalone owlapi package_, 31 August 2026).
`ontologySourceLoader.js` imports `owlapi/model`, `owlapi/formats` and
`owlapi/io` directly, and `src/owl2vowl/` is built on `OWLManager`,
`dispatchAxiom` and `OWLDataFactory`.

So a real canonical entity model is constructed today — and thrown away. At
`src/owl2vowl/js/index.js:95`, `builder.build(loaded.ontology, …)` consumes the
`OWLOntology` and returns the VOWL model; the ontology goes out of scope
immediately. `SourceLoadRecord` carries only `vowlModel`.

It cannot simply be retained, because only two of the four source kinds ever
produce one:

| Source kind             | Path                                       | `OWLOntology`? |
| ----------------------- | ------------------------------------------ | -------------- |
| `ontology-document-iri` | `loadWithImports` → owlapi → `vowlBuilder` | yes            |
| `ontology-text`         | `loadWithImports` → owlapi → `vowlBuilder` | yes            |
| `vowl-json-url`         | `JSON.parse(remoteText)` only              | no             |
| `vowl-model`            | detached VOWL content                      | no             |

Every shipped ontology loads through the third of these:
`loadingModule.js:402-403` resolves a preset such as `#foaf` to
`{ kind: "vowl-json-url", url: "data/foaf.json" }`. An `OWLOntology`-backed
snapshot would therefore serve pasted and fetched OWL documents while leaving
`#foaf` with nothing — an asymmetry the WebMCP contract cannot advertise around.

This settles a question rather than opening one: **`OntologyInspectionSnapshot`
must stay projectable from the VOWL model alone**, because that is the only
representation every source kind has. It costs nothing, because `vowlBuilder`
already writes annotations (`vowlBuilder.js:167`), object-property
characteristics (`:689`) and cardinality (`:785`, `:999`) into the VOWL output.
Amendment E reads those fields; it does not reconstruct them.

### 2.5 Cost is dominated by element instances, not by payload

A render-only projection — identity, kind, one display label, `attributes`,
`pos`, `domain`/`range`, `equivalent` — measured against the full model:

| Model                |      Full | Render projection (one language) | Ratio | `structuredClone` of full |
| -------------------- | --------: | -------------------------------: | ----: | ------------------------: |
| `foaf.json`          |  51.5 KiB |                         15.3 KiB |   30% |                   0.36 ms |
| `goodrelations.json` | 185.4 KiB |                         71.7 KiB |   39% |                   1.01 ms |
| `sioc.json`          |  63.9 KiB |                         21.6 KiB |   34% |                   0.41 ms |
| `benchmark.json`     |  18.2 KiB |                          9.1 KiB |   50% |                   0.15 ms |
| `ontovibe.json`      |  33.0 KiB |                         15.1 KiB |   46% |                   0.20 ms |

Retaining every language instead of one gives 35–53% rather than 30–50%.

Meanwhile every drawn element allocates its accessors as instance-own closures,
because each constructor runs `BaseElement.apply(this, arguments)` and assigns
`this.<name> = function …`:

| Element                                                        | Own function properties per instance |
| -------------------------------------------------------------- | -----------------------------------: |
| Round node (`BaseElement` 26 + `BaseNode` 23 + `RoundNode` 21) |                                   70 |
| Property (`BaseElement` 26 + `BaseProperty` 52)                |                                   78 |

FOAF therefore allocates on the order of 9,000 closures; goodrelations on the
order of 43,000. Every one of those accessors is also a _setter_ when called with
an argument, so the object handed to the sidebar today is an unguarded write
channel into renderer state.

## 3. Assessment of the external note

### Where it is right, and should govern

- The three-way split of domain state, shared interaction state, and
  visualization runtime state.
- "Share identity, not mutable object references."
- The test: _does the information still meaningfully exist when the graph is not
  mounted?_ If yes, the renderer must not own it.
- Sibling projections that never query each other.
- Incremental boundary introduction rather than rewrite.

### Where it does not fit WebVOWL

**It assumes a canonical entity model is available to the application.** One is
built — `owlapi` produces a real `OWLOntology` — but only for two of the four
source kinds, and it is discarded at the converter boundary (§2.4). The
application's `entitiesById` cannot be that ontology without stranding every
preset ontology, and cannot be synthesised from VOWL without either discarding
occurrences or asserting an entity layer VOWL never asserted. The honest
canonical model available at the application layer is the VOWL model _as
authored_, with its occurrence multiplicity intact.

**`NodeSelected(nodeId)` is not sufficient.** The note collapses semantic
identity and occurrence identity into one identifier. §2.2 shows they differ by a
factor of 21 in shipped data. Focus wants the semantic reference — highlight
every occurrence of this entity. Selection wants the occurrence — the reader
clicked _this_ circle, pin _this_ one.

**"Positions belong to D3" is too strong.** `pos` is in the document. The correct
rule is that _authored_ positions are input and _simulated_ positions are
renderer-local. The note's own table gestures at this under "pinned node
position"; the distinction needs to be explicit here because VOWL always carries
`pos`.

## 4. The three defects this framing exposes

### Defect 1 — the semantic channel runs through the renderer package

Everything the application knows about the ontology is capped by what one
function inside `src/webvowl/js/runtime/` chose to retain. Today that function
hard-codes nine relation arrays to `[]` (`superclassReferences`,
`equivalentClassReferences`, `disjointClassReferences`, `domainReferences`,
`rangeReferences`, `superpropertyReferences`, `inversePropertyReferences`,
`individualRecords`, `importRecords`) even though `classAttribute` and
`propertyAttribute` carry `equivalent`, `domain`, `range`, `subproperty`,
`superproperty`, `inverse`, `individuals`, `annotations`, `attributes`,
`cardinality`, `minCardinality`, `maxCardinality` and `description` in the
shipped models.

This is a data-processing inequality: no consumer downstream of that projection
can recover what it dropped. The handoff proposes widening it. Widening keeps the
renderer package upstream of every semantic question, which is what blocks
deep-linking before layout and forces every projection test to stand up a
renderer.

### Defect 2 — `WebVowlControllerState` has no closed shape, and selection leaks across loads

`freezeWebVowlControllerState` (`webVowlControllerContracts.js:406`) deep-freezes
whatever it is given. It asserts no field set — the only contract in the codebase
that does not. `selection` and `renderProgress` exist in published state solely
because two reducer branches add them; neither appears in
`IDLE_CONTROLLER_STATE`.

`publishForGeneration` spreads over the previous state, and nothing clears
generation-scoped fields on a new load. **Verified by executable probe on
2026-09-03:** select an element in load generation 1, then load a second
ontology; `controller.getState().selection` still contains
`{ kind: "class", iri: "…/first#Person" }`, a reference into a retired
generation. Published state keys after that sequence were
`error, layout, loadGeneration, selection, source, status, view, warnings`.

This is invisible today because only the search box renders `selection`, and the
reset menu happens to clear it. It becomes a visible defect the moment the
sidebar renders from state — which is precisely what the handoff proposes.

### Defect 3 — the boundary object is a mutation channel

Covered in §2.5. Not merely a coupling problem.

## 5. Proposed amendments

### A. The ontology projection moves to the application

New application module:

```text
src/app/js/controller/vowlModelInspectionProjector.js
  projectOntologyInspectionSnapshot(vowlModel, loadGeneration)
    -> OntologyInspectionSnapshot
```

Moved verbatim from the adapter, then extended (amendment E). It becomes testable
against the shipped models with no renderer, no DOM and no D3.

`WebVowlController` projects the snapshot from the `vowlModel` it already
receives from `OntologySourceLoader`, before it calls the runtime. Semantic
questions become answerable during `status: "loading"`.

### B. The seam narrows, and the renderer receives only what it draws

Remove `readOntologyInspectionSnapshot` from
`RENDERED_GRAPH_RUNTIME_METHOD_NAMES`. One production caller changes.

`readVisibleRenderedGraphSnapshot` **stays**: visibility after filtering is
genuinely renderer-owned. This is the split in miniature — the renderer owns what
is _visible_, the application owns what is _true_.

`replaceVowlModel` becomes `replaceRenderableGraph`, carrying a
`RenderableGraphProjection` instead of the full model: identity, kind, display
labels, `attributes`, `pos`, `domain`/`range`, and `equivalent`.

Evidence that this is sufficient: outside `elements/` and `parser.js`, the
renderer reads **none** of `annotations`, `comment`, `description`,
`individuals`, `disjointWith`, `superproperties` or `subproperties`. It reads
`equivalents` in exactly four places — `equivalentPropertyMerger.js:29` and
`renderedGraphInternals.js:1925,2588,2589` — all label and merge rendering, so
`equivalent` stays in the projection.

`indexRendererElementIdsByOntologyElement` moves to the application with the
projector, since the application now builds both sides of the mapping.

### C. `WebVowlControllerState` gets a closed shape

Add `createWebVowlControllerState` with exact field names, alongside the existing
`freeze…` behaviour. Declare `selection` and `renderProgress` in
`IDLE_CONTROLLER_STATE`. Reset generation-scoped fields on each load.

This is a proven defect fix and a hard precondition for anything that renders
selection. It is small and independent of everything else here.

### D. Selection gains occurrence identity

Add a second reference type rather than overloading the first:

```js
// semantic — exists today, correctly many-to-one against occurrences
{ kind: "class", iri: "http://www.w3.org/2002/07/owl#Thing" }

// occurrence — new
{ loadGeneration: 4, occurrenceKey: "17" }
```

```js
selection: {
  ontologyElementReferences: [ /* … */ ],
  ontologyElementOccurrenceReferences: [ /* … */ ],
}
```

`focus` in the view request keeps taking semantic references and keeps lighting
every occurrence. Selection, pinning and the selected halo take occurrence
references. Without this, applying selection _from_ state highlights all 21
`rdfs:Literal` nodes when the reader clicked one.

### E. `OntologyInspectionSnapshot` is completed

Populate the nine declared relation arrays, and extend the contract with what the
sidebar actually reads and the shipped models actually carry:

| Addition                                            | VOWL source                                       | Sidebar consumer          |
| --------------------------------------------------- | ------------------------------------------------- | ------------------------- |
| `annotationRecords`                                 | `annotations`                                     | `sidebar.js:896`, `:1036` |
| `elementAttributeNames`                             | `attributes`                                      | `sidebar.js:883`, `:1023` |
| `cardinalityRecord` (`exact`, `minimum`, `maximum`) | `cardinality`, `minCardinality`, `maxCardinality` | `sidebar.js:846-868`      |
| `descriptionRecords`                                | `description`                                     | `sidebar.js:1029`         |

Both amendments E and A are prerequisites for the equivalents-search regression
recorded in the handoff: `findOntologyElements` can only rank an equivalent's
label once `equivalentClassReferences` is populated.

### F. Tier 1 resolves by following the pause precedent, not by widening the tool surface

§1.4 already establishes the pattern: `setGraphLayoutPaused` is a
controller-domain request that is deliberately **not** a WebMCP tool. Tier 1
needs three more of the same shape, and two new viewport directives — not a
general-purpose escape hatch.

| Debt                                       | Proposed resolution                                                                                                                                                 | WebMCP tool?                      |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| Zoom buttons, centre                       | Extend `viewport` to `preserve \| fit \| focus-next \| zoom-in \| zoom-out`. A step directive, not a numeric transform: the zoom level itself stays renderer-local. | Existing `set_visualization_view` |
| Gravity, class distance, datatype distance | `setForceLayoutDistances({ classDistancePx, datatypeDistancePx })`                                                                                                  | No                                |
| Display modes, editor mode                 | `setVisualizationMode({ … })`, plus `state.visualizationMode` so `revealDetailsSectionForCurrentMode` stops reading `graph.editorMode()`                            | No                                |
| Reset button                               | Already expressible as a view request plus a pause request; no new vocabulary                                                                                       | Existing                          |

This keeps §1.4's "deliberately smaller than the existing UI" intact for the
_agent_ surface while giving the human UI a complete controller vocabulary.

### G. Sequencing

1. **C** — closed state shape and generation reset. Proven defect, independent,
   precondition for everything below.
2. **A** — move the projector to the application; delete
   `readOntologyInspectionSnapshot` from the seam.
3. **E** — complete the snapshot. Closes the equivalents-search regression.
4. **D** — occurrence references.
5. Publish `rendered-element-selection-changed` from the click path; rewrite
   `sidebar.updateSelectionInformation` to render from state; delete
   `selectionModules` from the renderer settings, and reconsider `focuser` and
   `pickAndPin` in the same change.
6. **B** — narrow `replaceVowlModel` to `replaceRenderableGraph`.
7. **F** — Tier 1 vocabulary.
8. Task 10 — the five tool contracts, now projecting a complete snapshot.

Steps 1–5 are the handoff's item B, reordered so the model moves before it is
widened. Step 6 is separable and could be deferred without blocking anything.

## 6. What this actually buys, stated honestly

**The performance claim is real but second-order.** A narrower projection makes
the graph cheaper to _hold and clone_ — 30–50% of the payload, and a
`structuredClone` that was already only 0.15–1.0 ms. It does not make the graph
meaningfully cheaper to _render_: force-simulation ticks scale with node count,
SVG element count is unchanged, and the ~70–78 instance-own closures per element
are allocated per drawn element regardless of payload width. Claiming a rendering
win from this change would not survive measurement.

There is a genuine downstream render win available later — if the renderer only
ever receives what it draws, a filtered-out element need not be constructed at
all, where today filters hide elements after construction. That is a separate
change and is not proposed here.

**The first-order wins are correctness and reach:**

- Semantic questions answerable before the renderer mounts, which is what makes
  deep-linking (`?selected=class:Person`) and early `get_ontology_summary`
  possible at all.
- The projection becomes testable against `foaf.json` and `goodrelations.json`
  with no renderer, no DOM, no D3.
- One writable object stops crossing the boundary.
- Every fact has one encoding: labels live in the model, and the renderer gets a
  _derived_ display label recomputed on language change rather than a second
  stored copy that can disagree.

**On entropy, precisely.** "Maximize entropy" is not the operative principle;
three sharper ones are. _Data-processing inequality_ says a consumer downstream
of a lossy stage is permanently capped by it, which is why widening the adapter's
projection is the weaker fix. _Sufficient statistic_ is the exact form of "the
graph holds only what it needs": the render projection must retain everything
that determines pixels and nothing else. _Single encoding_ says two copies of one
fact form a channel that can emit disagreement.

And the maximum-entropy reading cuts **against** the external note on one point:
collapsing FOAF's six `owl:Thing` occurrences into one entity would assert
structure the input never asserted. The canonical model must preserve occurrence
multiplicity even though it looks redundant, because the redundancy is
meaningful.

## 7. Resolutions

Every fork below was put to the repository owner and settled on 2026-09-03. The
reasoning that produced each recommendation is preserved in the sections above;
only the outcome is recorded here.

| Question                                           | Resolution                                                                                                                                                                                                    |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Move the projector, or widen it where it sits?     | Move it. Amendment A accepted in full.                                                                                                                                                                        |
| Is the state-shape fix a separate commit?          | Yes, its own precursor commit ahead of everything else.                                                                                                                                                       |
| How far does the snapshot extension go?            | Relations **and** the sidebar's fields together, as one contract change with all callers migrated.                                                                                                            |
| Occurrence identity: paired type or widened union? | Neither. Amendment D withdrawn: the application addresses entities only, and occurrence identity never leaves the renderer. Pin persistence is the one thing that would reopen it.                            |
| Narrow what crosses into the renderer?             | Deferred. The sufficient-statistic rule is recorded so future work does not widen the input; the change is not spent now.                                                                                     |
| How does zoom cross the seam?                      | Wire the channel the plan already declared. `viewport-changed` is published and reduced into state; `zoomScale` joins the view request. Step directives were rejected because they cannot express the slider. |
| Gravity and display toggles?                       | `setForceLayoutDistances` and `setVisualizationMode`, following the `setGraphLayoutPaused` precedent. Neither is a WebMCP tool.                                                                               |
| Editor mode?                                       | Read path only: `editorMode` is published into state. No editing vocabulary is opened.                                                                                                                        |
| Legacy presets?                                    | Regenerate `foaf`, `goodrelations`, `muto` and `sioc` as separate work, via a full load followed by Export JSON. Until then annotations project `propertyIri: null`.                                          |
| VOWL's `attributes` bag?                           | Classify the eight OWL property characteristics only; everything else stays unclassified.                                                                                                                     |
| Who holds the snapshot?                            | `WebVowlController`. `OntologyInspector` stays a pure function over one.                                                                                                                                      |
| Projector name?                                    | `vowlModelInspectionProjector.js` — the VOWL input is load-bearing and must appear in the name.                                                                                                               |
| Where does it enter the plan?                      | A new numbered Task 10, with Tasks 10–13 renumbered to 11–14.                                                                                                                                                 |
| Where is the decision recorded?                    | ADR 0010, with the mechanics in the plan sections.                                                                                                                                                            |

### The one deliberately reopened later

Retaining the `OWLOntology` for the two source kinds that produce one is **not**
proposed. Section 2.4 shows it cannot back `OntologyInspectionSnapshot` without
stranding every preset. It remains the natural home for facts VOWL structurally
cannot express — axiom-level provenance, full class expressions, anything
reasoned — and if that capability is ever wanted, the question is whether it
arrives as a second, explicitly optional snapshot whose absence is part of its
contract, or by converting the preset catalogue to OWL documents so every source
kind produces an ontology. That is a capability decision, not a seam correction.

## 8. Verified regeneration route

The preset regeneration named above was verified before being accepted, because
an earlier draft of this proposal wrongly assumed regeneration would run through
`vowlBuilder` directly and therefore discard every curated layout.

The chain holds. An OWL source is converted by `vowlBuilder`, which emits
`predicateNs` alongside each annotation's local name; `parser.js:248` copies
`element.annotations` verbatim onto the drawn element; and Export JSON copies
`annotations()` wholesale while writing live positions from `node.x` and
`node.y` at `exportMenu.js:710`. All four target presets are in
`ONTOLOGY_CATALOG`, and every field they currently carry is inside the export
whitelist, so the round trip loses nothing.

Four additions must be stripped after export: `settings` and `metrics` at top
level, `pinned` on any element pinned during layout, and the exporter-version
suffix appended to `_comment`.

Three caveats are recorded rather than resolved. The export is lossy relative to
`vowlBuilder`: set-operator class expressions are deliberately not written
(`exportMenu.js:569-575`) and top-level `datatype` arrays are never emitted.
That is why `benchmark.json`, `new_ontology.json` and `template.json` must not
be regenerated — they have no OWL source and do carry those fields. Regeneration
produces a new layout rather than restoring the current one. And the export path
itself reads `graph.options().filterMenu()` and `modeMenu()`, coupling this
migration intends to cut, so regeneration should precede that change or update
the export first.
