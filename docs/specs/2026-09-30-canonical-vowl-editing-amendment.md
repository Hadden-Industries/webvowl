# Canonical VOWL atomic editing amendment

The owner approved bounded design and implementation of one atomic editing operation on 30 September 2026 after the [three-edit experiment](../reviews/canonical-vowl-editing-feasibility.md).
This amends D7.2's three-operation restriction and the corresponding SLICE-001 interface; it does not change either canonical profile's fields, meaning, RDF mapping, IDs or bytes.
The owner accepted the demonstrated package-owned editing path on 30 September 2026 by instructing the implementation task to proceed with the pending recommended decisions.
This accepts the interface for dependent work; complete conformance, independent review and application qualification remain required.

## Public boundary

```js
await edit(document, changes, { signal, limits });
// { document: admittedStructuralDocument, correspondence, created }
```

`document` must be admitted by this module instance, under either profile.
`changes` is a dense array of closed operations in caller order.
No operation targets an occurrence; human editing authority is a document record, while arrangement remains application-owned.
Options are exactly `signal` and `limits`, with A8's finite domains and a single aggregate operation budget/deadline.
The input document remains immutable and every change is snapshotted before asynchronous work.
Failure yields no partially edited document.

| Operation      | Closed fields and meaning                                                                                                                                                       |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `insert`       | `{kind:"insert", collection, record}`. Collection is `subjects`, `roles`, `expressions` or `constructs`; record has that collection's complete source shape and a fresh handle. |
| `replace`      | `{kind:"replace", id, record}`. Target an existing semantic record, retain its `id`, and provide its complete replacement shape in the same category.                           |
| `remove`       | `{kind:"remove", id}`. Explicitly remove one semantic record. Any remaining dependency or unsupported assertion fails; no implicit destructive cascade is authorized.           |
| `set-endpoint` | `{kind:"set-endpoint", construct, target}`. Replace the target of one exact object/data/RDF domain or range construct.                                                          |
| `set-ontology` | `{kind:"set-ontology", ontology}`. Replace the complete ontology metadata shape.                                                                                                |

References to existing records use local IDs in the supplied document.
Inserted records may reference other inserted handles in the same atomic batch.
Replacement cannot change the addressed record's handle or category.
Unknown operations, fields, collections, targets or conflicting handles fail with `EDIT_INVALID`; ordinary A7 failures retain their established codes after request validation.
The request expresses existing editor changes through typed semantic records; this does not add application editor capabilities.

## Annotation and normalization ownership

Replacing an unannotated base construct retargets assertion anchors whose embedded assertion exactly matched the old base fact, preserving their complete annotation sets.
The same rule applies to `set-endpoint`.
If an endpoint aggregate has anchors on immediate operands, replacing the aggregate without explicit corresponding anchor edits is ambiguous and fails with `EDIT_AMBIGUOUS`.
The package never guesses how an operand annotation should attach to a different aggregate.
Removing a base construct while leaving an unsupported anchor fails rather than deleting that anchor.

The package, shared with ingress adapters, owns scalar normalization, set deduplication, named-subject/role/expression/construct deduplication, endpoint aggregation, signature closure and B2 occurrence generation.
Sequences preserve order and repetition.
Unused expression artifacts are pruned after references have been checked; declared roles and unused named facts are not silently discarded.
Normalization introduces only A2/A5/B2's required facts and defaults and cannot repair an ill-typed reference or infer ontology consequences.
The normalized result re-enters the same complete core validation and labelling path as `canonicalize` under one operation budget.

## Result and correspondence

The result is deeply frozen.
Its `document` is an admitted structural-content document; complete visualization state is supplied separately through the existing artifact canonicalizer.
No layout or portable coordinates are invented.

`correspondence` is an array of `{previous,current}` pairs, one for each primary record in the input, including occurrences.
`previous` is its input local ID; `current` is the corresponding output ID or `null` when that record or occurrence generation key no longer exists.
Many previous records may map to one current record after an explicit merge; the application must resolve conflicting arrangement state explicitly.
`created` lists output IDs that have no incoming correspondence.
Neither field is serialized inside the canonical document, and neither establishes durable identity across independent operations or symmetric re-imports.

Semantic correspondence follows retained record identity and explicitly normalized aliases.
Occurrence correspondence follows complete B1 generation keys after those semantic aliases are resolved.
An edge reconnected to a different endpoint therefore gets no automatic correspondence from its old generation key.
The application owns an explicit arrangement decision for such new occurrences and must provide every required placement before artifact admission.

This operation exposes no separate validator, RDF encoder, ID issuer, public normalization stage, fourth export surface or OWL round-trip.
ADR 0010/0012's ownership and human-only editing constraints remain in force.
