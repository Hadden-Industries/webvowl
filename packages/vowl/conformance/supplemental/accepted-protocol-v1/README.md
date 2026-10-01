# Accepted protocol expectation supplement

The owner accepted the camera scalar-domain and lexical/edge-direction clarifications on 30 September 2026.
This versioned [correction manifest](camera-corrections-manifest.json) changes five active camera-related expected errors to `NUMBER_INVALID` under the newly explicit A7 stage-4 rule.
Exact authority, historical manifest, historical record and unchanged input hashes are retained.
No frozen field-contract file is modified.

Apply the five records by exact vector ID together with their recorded historical manifest/input identities. All other historical expectations remain unchanged. The [resolution record](resolution.json) also resolves the three prior lexical/direction questions additively; their existing bytes and errors remain unchanged.

Reproduce without writes:

```text
node packages/vowl/conformance/supplemental/accepted-protocol-v1/derive.mjs
```

The fixture producer selects errors from accepted wording, not production behavior.
Runtime agreement and independent review are separate evidence.
