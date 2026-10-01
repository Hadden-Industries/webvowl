# Canonical VOWL application identity boundary proposal

Status: preparation for the plan's SLICE-005 entry decision; no application implementation or owner acceptance is claimed.
The existing [ADR 0010](../adr/0010-rendered-graph-is-a-projection-not-the-store.md), as amended by [ADR 0012](../adr/0012-human-and-agent-visualization-action-parity.md), already permits generation-scoped occurrence references for arrangement and keeps experimental editing human-only.
This proposal applies that boundary to the [approved package editing operation](../specs/2026-09-30-canonical-vowl-editing-amendment.md).

## Existing seams

`webVowlController.js` owns the current document and its inspection projection.
Its `commitEditedDocument` updates those together after preparing a revised document, retains arrangement, and advances the document revision without changing the ontology load generation.
Deletion proposals are bound to the exact current document object and cannot be replayed after that object changes.

`renderedArrangementContracts.js` separates opaque `{loadGeneration, occurrenceId}` references from document record targets and ontology element references.
It rejects references from another generation or to an absent occurrence.
`vowlDocumentArrangement.js` currently copies observed positions and pin state into legacy record attributes; it does not create missing ontology records.
This copying algorithm will need replacement with occurrence-based state capture when SLICE-005 is approved.

`exportCurrentVisualization` currently constructs a separate snapshot for JSON export.
The exported snapshot is not assigned back to `currentVowlModel`.
`visualizationArtifactService.js` computes the artifact's SHA-256 from the serialized bytes.
These existing boundaries support treating capture as an immutable export while retaining the application document and runtime references.

## Proposed identity ownership

| Identity                        | Authority and lifetime                                                                               | Proposed canonical association                                                                                                                                                                                            |
| ------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ontology element reference      | Entity selection and inspection; named kind/IRI or an anonymous identity within one load generation. | Resolve through the application semantic index. It may select several occurrences and is not a wire category ID.                                                                                                          |
| Editable document record target | A record already present in the application-owned document, addressed by a human editing operation.  | Retain an application target whose current semantic record association is updated from package-owned edit correspondence. Equal `sN`, `rN`, `eN` or `cN` text in a later document cannot establish this association.      |
| Runtime occurrence reference    | Opaque arrangement/selection authority within one load generation.                                   | Associate it with the current document's occurrence through an application registry. Update that association from edit correspondence; retire it when correspondence is null. It never grants semantic editing authority. |
| Portable occurrence address     | One occurrence in one immutable admitted artifact, bound to its document digest and local ID.        | Resolve only against those exact bytes. A later export with an equal `oN` spelling is a different address when its digest differs.                                                                                        |

The registries hold associations, not a second normalization or occurrence-generation algorithm.
The package remains responsible for normalized semantic identity, projection and edit correspondence.
The application decides how to arrange newly created occurrences or explicitly reconcile positions when several old records merge.
It cannot infer that decision from a reused local ID.

## Operation traces to qualify

1. **Drag or pin:** resolve the generation-scoped runtime reference, change the scene position or pin state, and retain the association with the current semantic document.
   No ontology fact changes, and no canonical ID is accepted as an arrangement authority.
2. **Capture:** snapshot every required occurrence placement and the complete effective visualization state, referencing the current document's semantic/occurrence IDs as source handles.
   Canonicalize that complete source in the worker and export its admitted bytes.
   Whole-profile labelling may change the exported IDs; the export does not replace the current application document or rebind its runtime registry by those output strings.
3. **Semantic edit:** resolve the application-owned editable target to the exact current semantic record, call the package's atomic `edit`, and retain the old document until the complete result succeeds.
   Apply the returned old-to-new correspondence to semantic and occurrence registries, retire null correspondences, and explicitly arrange new occurrences.
   Rebuild semantic inspection and the renderer projection from the accepted result; do not recover semantics from renderer objects.
4. **Reload:** admit the captured artifact as a new load generation, create fresh application/runtime associations from that admitted document, apply its complete state, and restore with automatic layout paused.
   References issued in the old generation are invalid even when the bytes or local IDs happen to match.

The package's private admission cannot cross a worker's structured-clone boundary.
An immutable model clone used for inspection/rendering does not acquire `encode` authority in the main thread.
Byte production and subsequent package edits remain in the owning worker/module instance.
Acceptance checks the request's ownership, load generation and exact base document/revision before staging the new document, inspection and scene reconciliation together.
A same-generation result from an older revision cannot replace a later edit.
Reconciliation reads the latest arrangement so that a drag or pin made while editing is pending is retained unless the edit explicitly retires or merges that occurrence.

## Evidence still required before acceptance

The separate-export path is supported by the current controller seam and one headless public-consumer experiment, but it is not yet a qualified replacement implementation.
The experiment starts from the independent matched-inverse artifact, moves and pins class A, captures without replacing the current document, and performs one atomic annotated endpoint edit from A to B.
Applying the package's correspondence keeps A's runtime reference, position `(120, -80)` and pin state while two retained occurrence IDs change.
Three obsolete edge/label references retire and four new references are allocated; the experiment supplies explicit positions for newly positionable occurrences.
The retargeted anchor retains its annotations, the prior admitted bytes remain unchanged, complete captures decode exactly, and an incorrect load generation is rejected.
This is a public-consumer feasibility result, not browser, worker-lifecycle or complete editor qualification.

Retained external evidence is `standalone-core-04/application-boundary-probe.mjs` and `application-boundary-probe-result.json`, recorded at `2026-09-30T13:19:12.964Z` against tarball SHA-256 `e49d75ec644ac82485405428b8fdc0bf06be129020f2dc5ccc19578628a500b2`.
Its starting independent artifact has SHA-256 `7224574d67c9cf32233bd48b61e6e0089671151e64ad664717450b1f90add4de`.

The independent boundary review supports the separate-export route and found that the current renderer-key registry cannot be reused unchanged: it keys associations by record IDs across same-generation revisions.
The current inspection projector also keys named references by IRI alone, which does not distinguish punned roles.
Both require the explicit associations proposed above.
The review confirmed the retained fourth-candidate probe's scope and all 1,310 installed package files, but did not independently replay that probe because its optional inline replay was unavailable through the command guard.

A fifth-candidate public-consumer experiment now reproduces the independent two-class state pair exactly.
Changing only Alpha's x coordinate from zero to one changes its canonical role from `r0` to `r1` and occurrence from `o0` to `o1`.
The experiment keeps the live entity lookup, editable target and runtime association attached to the original admitted document, rejects a portable address with the earlier digest against the new artifact, and resolves the reloaded positions by semantic kind/IRI rather than by an old ID.
Alpha reloads at `(1, 0)` and Beta at `(10, 0)`.
References from the preceding generation are rejected.

The same bounded experiment checks explicit agreeing and conflicting many-to-one merge dispositions, retirement of the other runtime reference, atomic failure when no merge disposition is supplied, and preservation of the latest drag during an accepted edit.
Its deterministic request-acceptance model rejects an older same-generation result and a cancelled request.
Named punning uses kind/IRI; anonymous record associations use only operation-local correspondence within the existing load.
These are experiment-owned registries, not the application's implementation or a real worker lifecycle qualification.
The merge choices are explicit experiment inputs and do not select a production conflict-resolution policy.

The updated annotated endpoint probe also resolves class A by its semantic IRI after decoding each capture and confirms position `(120, -80)` and pin state.
Its inverse assertion remains present, which differs from the existing editor's inverse-link removal and requires the command-mapping decision below.
Both fifth-candidate experiments use installed tarball SHA-256 `2bc20e2372dff7daf092b1c7b93fdb335ffc65b72a9f425fee0624e56e6589b9`.
Their scripts and exclusive result files are retained as `standalone-core-05/identity-boundary-probe.mjs`, `identity-boundary-probe-result.json`, `annotated-endpoint-boundary-probe.mjs` and `annotated-endpoint-boundary-probe-result.json`.
The independent state-pair byte digests are `c6b16befd66ca5c0eed4f05b4827a250b66f7e32fbedc0e69e6c2e4e9d781ac2` and `1bacb6ec0cb1bd5b8adfbc709b952cb4611e0d5ba8d98754be7e6275e841c9b9`.

The existing drawn-node snapshot is not a complete canonical scene: hidden placements, complete hidden incidence, camera, prefix and label/display choices need a full application-owned registry.
The probes use fixed display templates and do not qualify dynamic display capture.
The new bounded traces require independent review and later application/worker execution.
No new editor capabilities are proposed.

## Concrete command mapping proposed for owner acceptance

The bounded independent consumer review reproduced the existing endpoint command and confirmed that it removes inverse links while preserving the partner's endpoints.
The following proposal retains that behavior and the current editor's scope.
It adds no general axiom editor and requires no change to ADR 0010 or 0012.
Unsupported or ambiguous transformations leave the accepted document and scene unchanged and explain the affected relationship through the existing editor error surface.

| Existing command                  | Proposed canonical mapping and failure boundary                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Property endpoint edit            | Use `set-endpoint` for the selected asserted domain/range. If the displayed endpoint is only a projection default, insert the appropriate typed domain/range construct from the selected property and explicit human target; do not assert other defaults. In the same atomic batch explicitly remove inverse-property constructs involving that selected property, leaving the inverse partner's endpoints intact. Preserve the endpoint's supported anchors through the package operation. If a removed inverse has annotation anchors, reject this ordinary edit; those facts require a separate exact confirmed deletion first. No annotation is silently removed or reassigned. The inverse-preserving package probe remains a primitive test, and a separate application test must prove this detach behavior. |
| Subclass, disjoint, some/all rows | Address the exact subclass/disjoint construct or the selected some/all expression and its supporting subclass. Replace the selected relation's endpoints, preserving other uses; shared expressions require an explicitly constructed replacement for the selected assertion. Use package insertion/replacement/removal and normalization. Reject a row that cannot be uniquely associated with its asserted facts.                                                                                                                                                                                                                                                                                                                                                                                                  |
| Type dropdown                     | Preserve the existing class choices (`owl:Thing`, ordinary class, deprecated class) and exact property-row availability: a datatype property exposes only its current type, and other property rows exclude datatype properties. The six-value internal vocabulary does not authorize object/data conversion through the human dropdown. Class deprecation is an `owl:deprecated` annotation, not a new role kind. Available subclass/disjoint/restriction choices replace their exact selected assertion representation. Preserve fixed builtin IRIs and the existing attached-restriction guard. Reject shared or anchored conversions when a one-to-one assertion/annotation mapping is unavailable; do not drop dependent facts or invent a property for an undrawable restriction.                              |
| IRI change                        | Rename the selected semantic subject when its affected roles and assertion attachments have one unambiguous editor target. If other distinct editable roles share that subject, reject the rename rather than changing those roles or guessing annotation ownership. Retain the existing fixed-builtin and duplicate-editable-IRI restrictions.                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Datatype choice                   | Retarget the selected datatype range/context to the chosen named datatype role; preserve other contexts of the previous datatype. For a standalone selected datatype declaration, use the same shared-subject guard as IRI change.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Labels                            | Edit the exact `rdfs:label` assertion selected by subject and current language. Preserve other languages and its supported assertion annotations. Multiple distinct labels in the same selected language are ambiguous and require no guessed first value. An absent label can be inserted using the existing text field's language.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Characteristics                   | Address exact direct characteristic constructs, and `owl:deprecated` annotation assertions where applicable. Preserve unrelated characteristics. Removing an annotated fact requires its exact confirmed deletion; ordinary checkbox changes cannot discard its anchors.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Insertion and selection           | Resolve against the complete accepted result using the command's typed intent and operation-local correspondence. An inserted meaning may normalize to an existing record, so `created` alone is insufficient. Select its unique semantic target even if it has no drawable occurrence; reject an ambiguous result atomically. Never infer anonymous correspondence or choose the first returned ID.                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Confirmed deletion                | Prepare an exact dependency scope containing every removed/replaced semantic fact and its assertion anchors, describe the annotation losses, and bind confirmation to the exact base document/revision. Submit only that confirmed atomic batch. Core removal grants no implicit cascade; a changed base invalidates the proposal.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Metadata and prefixes             | Replace complete ontology metadata with the package operation while preserving untouched fields. Prefix changes affect display bindings. Textual version information remains an annotation, separate from an ontology version IRI.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |

Existing autogenerated editor IRIs remain explicit application creation intent; they are never substituted for missing OWL ontology identity or invented by migration.
Builtin-to-ordinary conversion must use that same existing creation intent and collision check.

## Concrete identity, scene and concurrency policies

- Semantic indexes key named roles by exact canonical role kind and IRI.
  Candidate inspection/selection contracts expose the specific property role where needed.
  An existing coarse `property` request is accepted only when it selects one semantic role; otherwise it reports ambiguity.
  Human editing always uses the separately selected editable record target.
  Anonymous targets use application tokens within the load, updated only by exact operation correspondence.
- Apply correspondence step by step to its exact predecessor and successor.
  Never compose a join from matching wire ID strings.
  Capture remains a separate immutable export and does not rebind the live registries.
  Reload creates a new load generation even when the bytes match.
- Permit one pending semantic mutation.
  Disable conflicting editor submissions while it runs; a programmatic competing submission fails as busy.
  Drag, pin and display observations remain usable.
  Commit checks request ownership, cancellation, generation and exact base revision, then reconciles against the latest scene before atomically replacing document, inspection and registries.
- For an agreeing many-to-one occurrence merge, retain the oldest application runtime token and retire the other tokens.
  Agreement requires identical current coordinates, pin and visibility state.
  A conflicting merge fails atomically; the user can reconcile the scene with existing arrangement actions before repeating the edit.
  No arbitrary predecessor wins a conflicting placement.
- Every new positionable occurrence first honors an unambiguously associated command-supplied position, including endpoint gestures' explicit label position.
  Otherwise newly created ordinary nodes use the current viewport center, operator nodes use the center of their positioned operand nodes; new positionable labels use the midpoint of their endpoint nodes.
  If no referenced node is positioned, use the viewport center.
  These are explicit application scene initialization rules, never package normalization or migration defaults.
  New placements are unpinned; normal live layout can move them only when layout is running.
  Paused state is preserved.
  Non-finite placement results fail the candidate.
- Keep complete placements, including hidden occurrences, and enforce complete visibility incidence before export.
  Capture includes effective camera, prefixes, label/display choices and every required placement.
  A missing placement causes capture to fail; neither canonicalization nor migration invokes layout.

Acceptance authorizes this candidate application implementation and the existing human-only editor command migration.
It does not approve browser cutover, profile freeze, package/hosting publication or deletion of legacy implementation paths.
Application tests and real-browser qualification must still prove these policies.

If application requirements instead require installing each captured artifact as the live document within the same generation, the current `canonicalize` result does not expose a source-handle-to-issued-ID map.
That alternative needs separate feasibility evidence and an exact interface decision; it must not be implemented by matching equal local IDs or by guessing anonymous correspondence.
The proposal currently retains the existing separate-export behavior and does not request that additional API.

The plan's explicit owner acceptance of this boundary mapping and SLICE-005 implementation scope remains required before affected application source changes.
