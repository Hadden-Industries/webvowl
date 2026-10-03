# Active camera expectation metadata, revision 2

The [current overlay](camera-corrections-manifest.json) retains the same five vector IDs, operations, profiles, exact input identities, and `NUMBER_INVALID` expectations as [revision 1](../accepted-protocol-v1/camera-corrections-manifest.json).
It repairs metadata that revision 1 had copied from the superseded stage-7 interpretation.

Top-level `expectedError`, `rules`, `reason`, and `activeValidationStage` are authoritative for this overlay.
They consistently state the [accepted camera clarification](../../../../../docs/specs/2026-09-30-canonical-vowl-camera-error-precedence.md): finite nonpositive camera zoom fails the numeric scalar domain at **A7 stage 4**, before stage-5 IDs/references and stage-6 projection.
Stable vector IDs retain their historical wording to preserve identity.

The entire previous record is preserved under `historical.predecessorRecord`, with its exact record and manifest hashes.
Historical rules and explanations must not be merged into active fields.
The two original disputed manifests and the revision-1 overlay remain unchanged.
This is a metadata repair, not a new expected error, changed source input, or authority amendment.

```text
node packages/vowl/conformance/supplemental/accepted-protocol-v2/derive.mjs
```

Default execution verifies without writes.
The [new auditor scope index](../mapping-counterexamples/auditor-v2/provenance-index.json) pins this supplement and its authority.
No production code or runtime output was used to choose these expectations.
