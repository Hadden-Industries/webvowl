# Canonical VOWL conformance corpus

This corpus is tied to the governing specification hashes and the owner-approved [resource-policy amendment](../../../docs/specs/2026-09-30-canonical-vowl-resource-policy-amendment.md).
The current positive corpus contains 217 exact-byte fixtures in eight manifests:

- [Amended-policy baseline](supplemental/amended-policy/manifest.json): 95 fixtures, including 92 unchanged historical positives and three successes under the amended budget policy.
- [Conditional projection cases](supplemental/conditional/manifest.json): 62 fixtures.
- [Additional conditional cases](supplemental/conditional/additional-manifest.json): 14 fixtures.
- [Completion cases](supplemental/conditional/completion-manifest.json): five fixtures.
- [Cardinality scope case](supplemental/conditional/scope-manifest.json): one fixture.
- [Embedded assertion field cases](supplemental/field-contract/positive-manifest.json): 29 fixtures.
- [Additional field witnesses](supplemental/field-contract/additional-positive-manifest.json): nine fixtures.
- [State-only identity pair](supplemental/field-contract/state-identity-manifest.json): two fixtures.

The [conditional clause inventory](supplemental/conditional/clause-inventory.json) links exact topology bytes and records remaining cases; the [conformance report](../../../docs/reviews/canonical-vowl-conformance-report.md) distinguishes independent derivation, review status, and attributed integration evidence.
These fixtures do not establish a v1 freeze, exhaustive conditional coverage, or full application qualification.
The original seed, extended, and grammar manifests remain frozen historical evidence.
The [review-resolution supplement](supplemental/review-resolution-v1/review-resolution.json) records two resolutions from existing normative text and three questions still pending owner clarification; it preserves earlier status metadata and hashes.
The [field-contract supplement](supplemental/field-contract/README.md) binds 3,369 finite field obligations and separately inventories profile/decoder/scalar/precedence cases.
Its D18 pair audit establishes 35 of 343 retained source-field positions and explicitly leaves 308 open; grammar coverage is not exhaustive mapping evidence.
Five zoom-related expected errors remain disputed pending the owner clarification recorded in the conformance report.

Reproduce the current supplemental outputs from the repository root without write flags:

```text
node packages/vowl/conformance/supplemental/review-resolution-v1/verify-frozen-scopes.mjs
node packages/vowl/conformance/supplemental/amended-policy/prepare-producer.mjs
node packages/vowl/conformance/supplemental/amended-policy/derive.mjs
node packages/vowl/conformance/supplemental/negative/derive.mjs
node packages/vowl/conformance/supplemental/conditional/derive.mjs
node packages/vowl/conformance/supplemental/conditional/derive-additional.mjs
node packages/vowl/conformance/supplemental/conditional/derive-completion.mjs
node packages/vowl/conformance/supplemental/conditional/derive-scope.mjs
node packages/vowl/conformance/supplemental/conditional/derive-negatives.mjs
node packages/vowl/conformance/supplemental/conditional/derive-inventory.mjs
node packages/vowl/conformance/supplemental/field-contract/verify.mjs
```

The [conditional supplement README](supplemental/conditional/README.md) explains its provenance and reproduction boundaries.
The separate amended producer preserves the historical mapping, ID, and serialization code while applying the approved resource-policy expression.
The [field supplement README](supplemental/field-contract/README.md) lists all of its no-write derivation runners and immutable manifest scopes.
The versioned verifier checks each frozen index's explicit recorded entries and indexed manifest files without directory discovery or writes; `--self-check` additionally proves rejection of in-memory hash/length mismatches.
The unchanged `supplemental/derive-index.mjs` is a historical inventory authoring runner: it rediscovers later additions and cannot reproduce the old 83-entry index in the expanded tree.
Do not regenerate that index to force a pass.

Every vector has a language-neutral `source.json`, an A6 default-graph dataset in `mapped.nq`, RDFC-1.0 canonical N-Quads, the fixed-input primary/category correspondence in `ids.json`, and exact UTF-8 RFC 8785 bytes in `canonical.json`.
The canonical JSON files have no BOM or trailing newline.
All other JSON files are explanatory conformance artifacts outside canonical identity.
The manifest pins every file's SHA-256 and byte length.

`oracle/producer.mjs` independently implements A6's typed mapping and D18.2's category issuance from the four governing specifications.
It shares only the actual `rdf-canonize@5.0.0` and `canonicalize@5.1.0` standards libraries with the planned product.
Initial derivation used `canonicalize@2.1.0`; every vector file was reproduced unchanged after the package selected `5.1.0`.
It neither imports nor reads production implementation or tests.
Source occurrences were derived by hand from B2; this trusted-fixture producer does not claim complete source validation or general projection generation.

Reproduce the original historical corpus from the repository root:

```text
node packages/vowl/conformance/oracle/derive-vectors.mjs
node packages/vowl/conformance/oracle/derive-extended.mjs
node packages/vowl/conformance/oracle/derive-negatives.mjs
node packages/vowl/conformance/oracle/derive-catalogs.mjs
node packages/vowl/conformance/oracle/check-producer.mjs
```

This reproduces and compares every pinned output without writing.
`--write-new` can initialize missing files, but deliberately never replaces an existing expectation.
The two positive-corpus runners also accept `--update-provenance` for an explicitly reviewed metadata change; they first assert that every frozen vector file and count remains identical.
Any divergence requires investigation and an explicit reviewed fixture correction, not automatic regeneration.
For symmetric sources, compare complete canonical documents and bytes; `ids.json` does not promise durable handle correspondence across permutations.

The empty structural graph is hand-counted as 9 auxiliary blank nodes and 20 triples: 3 root facts, 7 structural-object facts, 3 ontology facts, and 7 collection type facts.
A named class adds 3 primary nodes and 1 set node, with 13 triples: subject 2, role 3, occurrence 3, target set 2, and category memberships 3.
Complete empty artifact state adds 8 auxiliary nodes and 23 triples, including its root field edge.
One placement adds 2 auxiliary nodes and 8 triples.

`extended-manifest.json` pins 21 further positive fixtures and a small two-data-property model that exceeded the superseded linear A8 work ceiling.
Its historical rejection remains preserved; the amended-policy manifest pins a separate positive result under the current approved policy.
`negative-manifest.json` pins 30 stable-error inputs; those expectations require production execution.
`projection-matrix.json` inventories all 63 role/expression/construct tokens plus metadata and value rows, while `display-vectors.json` holds 46 independently reasoned application expectations.
Neither inventory is a complete coverage claim.
`experiments/rdfc-budget-probe` preserves a bounded budget experiment that was explicitly nonconforming to the then-current linear policy; its successful exploratory output remains historical evidence, separate from the independently derived amended-policy positives.

License: AGPL-3.0-only; reused standards libraries retain their own BSD-3-Clause and Apache-2.0 licenses.
