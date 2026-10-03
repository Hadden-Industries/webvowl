# Independent conditional projection witnesses

[clause-inventory.json](clause-inventory.json) maps 98 B1/B2 clauses and 127 branches in 76 concrete B2.5 rows to exact complete source/model/dataset bytes.
It combines the preserved 95-case baseline with 82 new positives in `manifest.json` (62), `additional-manifest.json` (14), `completion-manifest.json` (5), and `scope-manifest.json` (1).
[negative-manifest.json](negative-manifest.json) adds 30 independently chosen error cases.

Every positive has its full normalized source, a simultaneous handle/set/key permutation, mapped RDF, canonical N-Quads, informative ID derivation, and exact canonical document bytes.
Compare private mapped RDF up to dataset isomorphism; compare complete canonical N-Quads and JSON as exact bytes.
Symmetric handle correspondences are informative only.
The separate amended producer and owner-approved resource amendment remain unchanged.

These are clause witnesses, not every combination of constructor parameters.
Eleven clauses still require independent renderer/interaction evidence.
The frozen catalogs recorded three B2 interpretations and the B5 anonymous-root wording question; the subsequent [review-resolution supplement](../review-resolution-v1/review-resolution.json) resolves the unused-default and anonymous-root questions from existing normative text.
Inverse/operator direction and A7/D19 Unicode precedence remain pending owner clarification.
[display-questions.json](display-questions.json) preserves the historical questions and separates them from missing fixture premises.
The inventory does not turn topology bytes into a claim about accessibility, highlighted directions, characteristic treatment, or complete details.

Run from the repository root without write flags:

```text
node packages/vowl/conformance/supplemental/conditional/derive.mjs
node packages/vowl/conformance/supplemental/conditional/derive-additional.mjs
node packages/vowl/conformance/supplemental/conditional/derive-completion.mjs
node packages/vowl/conformance/supplemental/conditional/derive-scope.mjs
node packages/vowl/conformance/supplemental/conditional/derive-negatives.mjs
node packages/vowl/conformance/supplemental/conditional/derive-inventory.mjs
```

The small additional/completion/scope runners adapt only this independent frozen derivation runner to separate filenames.
They do not read production code.
`--write-new` creates missing files and refuses to overwrite existing expectations.
`--update-provenance` is an explicit metadata-only authoring operation: it first checks every expected file and then requires all fixture entries and all other semantic metadata unchanged.
`derive-inventory.mjs --update-new-metadata` refreshes only this new directory's three review catalogs during an explicitly reviewed scope update; it never changes previous corpus indexes or vector files.

[provenance.json](provenance.json) records this scope and pins every derivation script and manifest, the prior untouched provenance identity, and the unchanged producer/amendment.
The [versioned verifier](../review-resolution-v1/verify-frozen-scopes.mjs) checks recorded entries without discovering later files or rewriting either frozen index.
Parent execution reports and the response to the completed independent corpus review are recorded separately in the [conformance report](../../../../../docs/reviews/canonical-vowl-conformance-report.md); pending clarification and application qualification remain distinct from corpus review.
