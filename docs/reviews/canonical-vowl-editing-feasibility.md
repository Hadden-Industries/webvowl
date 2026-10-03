# Canonical VOWL editing feasibility

Status: the owner approved the bounded [atomic editing amendment](../specs/2026-09-30-canonical-vowl-editing-amendment.md) and subsequently accepted the demonstrated package-owned editing path on 30 September 2026 by instructing the task to proceed with the pending recommended decisions.
The package implements insertion, deletion and annotated endpoint editing through that public operation.
The independent ordinary reviewer closed its editing findings on the third frozen candidate; full conformance and later application qualification remain required.

The implementation plan's SLICE-001 requires insertion, deletion and an annotated endpoint edit through the public boundary, without private imports, controller-owned duplicate normalization, a new public stage or an OWL serialization round-trip.
It expressly requires an owner decision before this interface is accepted for dependent slices if no viable path exists.
No application source was changed for this experiment.

## Observed results

`npm test -- --runInBand packages/vowl/test/editing-feasibility.test.js` passed three experiments on 30 September 2026.
They import only the public `vowl` interface and use actual validation, projection, RDFC and JCS.
The fixture starts with three named classes and an object property whose domain has an annotated assertion anchor.

| Edit                                | Semantic change alone                                                           | Additional hand-authored repair required for successful admission                                               |
| ----------------------------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Insert a named class                | `PROJECTION_INVALID`                                                            | Add its class-node occurrence.                                                                                  |
| Delete an unused class              | `REFERENCE_DANGLING`                                                            | Remove the retired class occurrence.                                                                            |
| Change an annotated property domain | `ASSERTION_UNSUPPORTED`, then `PROJECTION_INVALID` after updating the assertion | Change the supported anchor target and reconnect the property occurrence. The exact annotation remains present. |

These finite repairs demonstrate what a caller must supply; they are not an application normalization algorithm or a general editor.
The endpoint experiment resolves the resulting occurrence through its role and subject to verify that it denotes the new domain.
It does not assume that a prior canonical local ID keeps its meaning after relabelling.
The core correctly rejects each incomplete source instead of repairing it.

## Ownership gap

The only root operations in D7.2 are `canonicalize`, `encode` and `decode`.
None takes editing intent, normalizes changed semantic records, regenerates occurrences or returns occurrence correspondence.
The OWL and historical adapters accept their own ingress formats, not edits to an admitted canonical document.
Calling a private projection helper from the controller, implementing B2 again in the application, or serializing edits through OWL would violate the explicit experiment constraints.

The current human editor already uses application-owned changes through `vowlDocument.js` and `webVowlController.js`.
ADR 0012 requires retaining those edits, including selection of the particular document record when names are shared.
An opaque runtime occurrence reference cannot become editing authority.
Thus accepting these three finite experiments as a completed editing path would conceal a real interface gap.

## Minimum proposed decision

Permit one additional indivisible operation on the existing `vowl` surface, provisionally `edit(document, changes, {signal, limits})`, before finalizing its closed request/result schema.
This is an explicit amendment to D7.2, not a fourth package export surface and not a public normalization pipeline.
The package would own the semantic normalization and B2 regeneration shared by its ingress adapters and this edit operation.
It would preserve assertion annotations, reject unsupported or ambiguous edits, and return an admitted structural document plus operation-local correspondence for retained records and occurrences.
The application would continue owning human intent, deletion confirmation, selection and arrangement; it would supply complete portable state to the existing artifact canonicalizer after reconciling the returned correspondence.
The edit operation would neither invent positions nor expose RDF, validation or ID-issuance stages.

The exact supported changes must be inventoried from the existing editor before accepting a closed schema; this proposal authorizes that bounded design/implementation work, not new editor capabilities.
Removal semantics and ambiguous correspondence must fail explicitly rather than silently discarding assertions, annotations or arrangement.
An independently reviewed amendment and executable insertion/deletion/annotated-endpoint tests remain required before SLICE-001 editing acceptance or SLICE-005 application changes.

Alternative: retain D7.2 unchanged and leave the dependent editing/integration slices blocked until another conforming ownership path is demonstrated.

## Approved implementation evidence

The public `edit` operation now owns normalization, exact occurrence regeneration and operation-local correspondence.
The executable tests cover the three required edits, preservation of annotations, explicit failure for annotated aggregate ambiguity, duplicate semantic identities, signature closure, property defaults, repeated property-chain members, source snapshotting, cancellation and bounded rejection.
An empty edit preserves the complete independently derived canonical bytes of all 166 structural fixtures under the approved resource policy, including the conditional topology expansion.
Artifact editing returns structural content and correspondence without inventing arrangement.
These package-local checks do not establish existing-editor integration or authorize SLICE-005 by themselves.
The [core review record](canonical-vowl-core-review.md) identifies the exact reviewed candidate, six original repairs and the final default-role/ownership correction.
The reviewer independently confirmed endpoint-order byte equality, result-container ownership, and primary/embedded budget boundaries; its final affected run passed 118 tests with no findings.
The integrated core suite now passes 545 tests, and the repaired public edit operation also passed in an isolated installed third-candidate tarball and an actual Chrome worker.
The expanded worker run includes both endpoint-promotion regressions; subsequent structural-uniqueness checks remain subject to bounded review.
The owner accepted this concrete package-owned editing path for dependent interface work; broader profile freeze, application ownership, cutover and publication retain their separate gates.
