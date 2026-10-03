# Independent retained-field mapping evidence

This additive supplement derives 642 positive models in 321 pairs from the frozen contracts.
It preserves the earlier 217 positive models, every historical expected output, and the amended producer's semantics.
Its source, projection recipes, and separate RDF template auditor do not import or inspect production code or tests.
Reuse is limited to the earlier independent corpus and the actual RDFC/JCS standards libraries.

| Manifest                                                     | Positive models | Evidence                                                                                                                                                   |
| ------------------------------------------------------------ | --------------: | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Core](core-manifest.json)                                   |             298 | 149 A3/A4 field pairs; 148 isolate their owning field, one includes a required datatype-node projection change.                                            |
| [Values and state](value-state-manifest.json)                |              68 | 34 metadata, annotation, literal, and artifact pairs; the placement-reference pair preserves the required placement bijection.                             |
| [Derived fields](derived-manifest.json)                      |              84 | 42 complete projection/state reassociations. Their structural-only bytes remain invariant; their artifact associations and complete artifact bytes differ. |
| [Closed branches](branch-manifest.json)                      |             188 | 94 discriminator/value branch pairs. Required payload, reference-sort, reachability-owner, and projection companions are recorded.                         |
| [Set and sequence](distinction-manifest.json)                |               2 | The same references in a set and an ordered chain, with their mandatory construct and projection companions.                                               |
| [Narrowed context binding](binding-correction-manifest.json) |               2 | Additive correction of one descriptor-specific coverage claim; all earlier valid outputs remain unchanged.                                                 |

[Field accounting](field-accounting.json) accounts for all **343 retained source-field positions**, separately from the 66 excluded primary-handle positions and five serialized-envelope mirror positions.
It selects **219 isolated owning-field pairs and 124 coupled pairs**.
Every selected pair links complete sources, canonical N-Quads, canonical JSON bytes, and exact owning-field RDF facts.
Additional ancestor-field bindings apply only to that owning field; they never imply coverage of every child field.

The distinction matters: a field fixed by a closed branch cannot vary within that branch; a generated B1 field cannot violate the required projection; a placement reference cannot break the placement bijection.
Coupled pairs show complete distinct valid results and the precise template facts, but are **not isolated proofs of the necessity of each component field**.
These counts are finite conformance evidence, not a mathematical injectivity proof or a profile-freeze claim.
Independent review and comparison against actual implementation datasets remain separate requirements.

The derived inventory's `fixedFields: 0` is its historical count of entries without a selected candidate, **not** a claim that no discriminants have fixed domains.
The newer field accounting records `fixedWithinThisClosedDescriptor`, the descriptors actually observed on both sides, and any removed branch field.
It also rejects the original `Context:property.scope` binding: that pair starts with an absent field in `Context:property` and ends with a present field in the separately narrowed `PropertyContext`.
The new binding pair exercises an actual present `Context:property.scope` instead.

[The separate A6 audit](template-audit-evidence.json) checks every triple in all 859 expected graphs, using a newly written inverse/template traversal.
It checks field predicates, scalar datatypes and spelling, primary references, omitted optional fields, fresh auxiliary ownership, set containers, sequence indices and repeated values, and absence of unexplained facts.
It is a trusted-corpus auditor, not a complete input validator.
The original source handles resolve through frozen `ids.json` correspondences; mapped construction labels are arbitrary, and symmetric handle-to-ID associations are informative rather than durable identities.

Profile framing is separately witnessed by the existing empty structural/artifact pair with identical structural content.
Selecting artifact necessarily adds complete state, so this is explicitly coupled with the root profile IRI.
All producer runs retain the approved capped quadratic work policy and no fallback behavior.
This supplement does not alter the resource-policy authority file.

Reproduce without writes from the repository root:

```text
node packages/vowl/conformance/supplemental/mapping-counterexamples/verify.mjs
node packages/vowl/conformance/supplemental/mapping-counterexamples/check-projection-fixtures.mjs
node packages/vowl/conformance/supplemental/mapping-counterexamples/derive-core.mjs
node packages/vowl/conformance/supplemental/mapping-counterexamples/derive-values-state.mjs
node packages/vowl/conformance/supplemental/mapping-counterexamples/derive-derived.mjs
node packages/vowl/conformance/supplemental/mapping-counterexamples/derive-branches.mjs
node packages/vowl/conformance/supplemental/mapping-counterexamples/derive-distinction.mjs
node packages/vowl/conformance/supplemental/mapping-counterexamples/derive-binding-correction.mjs
node packages/vowl/conformance/supplemental/mapping-counterexamples/audit-corpus-templates.mjs
node packages/vowl/conformance/supplemental/mapping-counterexamples/derive-field-accounting.mjs
node packages/vowl/conformance/supplemental/mapping-counterexamples/source-pin-cleanup.mjs
node packages/vowl/conformance/supplemental/mapping-counterexamples/derive-provenance.mjs
```

Every derivation runner defaults to comparison only.
`--write-new` creates missing supplement files with exclusive creation and refuses to replace existing bytes.
The verifier checks explicit recorded paths; it never recursively inventories future additions.
`inspect-core-pairs.mjs`, `inspect-remaining.mjs`, and `analyze-pair-coverage.mjs` are bounded historical working checkpoints; their partial counts are superseded by `field-accounting.json`.

The [pre-handoff source-pin receipt](source-pin-cleanup-v1.json) preserves exact initial identities and copies for a parent-approved unused-import cleanup.
Its verifier proves that only the unused import and the new inventory's corresponding source hash changed; no expectation changed.

The separate [accepted camera correction](../accepted-protocol-v1/camera-corrections-manifest.json) supplies five authoritative error overlays without rewriting the disputed originals.
Its [prefix supplement](../accepted-protocol-v1/prefix-negative-manifest.json) adds `:` and `1bad` lexical rejections with the explicit B4/A7 rationale. The [editing supplement](../editing-v1/manifest.json) derives three complete insertion/deletion/annotated-endpoint results with operation-local correspondence and three fresh/conflicting-handle rejections.
These additive scopes have their own expectations; production comparisons are owned by the parent integration task.
