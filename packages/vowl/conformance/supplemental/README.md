# Supplemental independent conformance corpus

The baseline [amended-policy/manifest.json](amended-policy/manifest.json) contains 95 exact-byte fixtures under the owner-approved [resource amendment](../../../../docs/specs/2026-09-30-canonical-vowl-resource-policy-amendment.md); the [corpus entry README](../README.md) lists all five current positive manifests and 177 fixtures.
Original reviewed files remain frozen historical evidence.
The amended manifest reuses 92 unchanged positive outputs and pins three new successes that previously hit the linear work ceiling.

The [negative/boundary manifest](negative/manifest.json) adds 59 rejection expectations and three successful exact counter boundaries.
Pass its `options` to the named operation and, for `canonicalize`, its separately recorded `profile`.
`expectedError:null` means compare the complete result with `expectedCanonical`.
It is additive to the original 30-case negative manifest.

The [coverage matrix](coverage-matrix.json) links every role, expression, and construct token and every object-characteristic enum value to positive bytes.
Presence is not complete conditional, display, or browser qualification.
The [review corrections](review-corrections.json) record interpretation/precedence questions and metadata corrections; [provenance-index.json](provenance-index.json) pins scripts, catalogs, and probe evidence.

Compare `canonical.json` and `canonical.nq` as exact complete bytes.
Compare `mapped.nq` as RDF dataset isomorphism.
Private blank-node labels and line order are not contractual.
Treat `ids.json` as derivation evidence; automorphic source-handle correspondences are not fixed even for the same input.
Every `canonical.json` file deliberately omits a trailing newline.

Reproduce without writes:

```text
node packages/vowl/conformance/supplemental/grammar/derive.mjs
node packages/vowl/conformance/supplemental/negative/derive.mjs
node packages/vowl/conformance/supplemental/amended-policy/prepare-producer.mjs
node packages/vowl/conformance/supplemental/amended-policy/derive.mjs
node packages/vowl/conformance/supplemental/check-producer-reasons.mjs
node packages/vowl/conformance/supplemental/review-resolution-v1/verify-frozen-scopes.mjs
```

`--write-new` creates missing expected files only and then compares them.
It never overwrites existing expectations.
The original grammar manifest intentionally retains pre-amendment operational rejections; use the amended manifest for current positive execution.

The versioned verifier has no write mode.
It checks the unchanged 83-entry baseline and 17-entry conditional indexes and their recorded manifest files.
The original `derive-index.mjs` remains a historical inventory authoring runner whose recursive discovery includes later additions; it cannot reproduce the old index in the expanded tree.
Do not regenerate the frozen index to make that historical runner pass.

The scripts in `budget/` are exploratory standards-library measurements.
Running them explicitly refreshes their own experimental raw timing reports; it does not regenerate normative expectations.
Recorded results are pinned by the provenance index and require an explicit reviewed provenance revision after rerunning.
`probe-growth.mjs` measures exact graph thresholds and the proposed quadratic allowance.
`probe-symmetry.mjs` uses raw RDF clique graphs that are not Canonical VOWL inputs.
The historical timing reports predate policy approval and remain labeled experimental.

The independent producer is a trusted-fixture mapper, not a second complete semantic validator.
It shares only the permitted standards libraries with production.
No production mapping, normalization, projection, ID code, or tests were read or reused to author this corpus.
The [review-resolution supplement](review-resolution-v1/review-resolution.json) responds to the completed independent corpus review, resolves two questions using existing normative text, and retains three questions pending owner clarification.
Earlier review-status metadata remains frozen history; profile acceptance is separate.
