# Independent historical migration witnesses

This corpus qualifies bounded rules of the single dialect `webvowl-legacy-354ed3af8c1e82019f6280b2594acaceac96cca0` against A9.3 and the source-derived [ingress contract](../../../../../docs/reviews/canonical-vowl-legacy-ingress-contract.md).
It is experimental slice evidence, not profile freeze, application cutover, or proof that all documents passed through the historical exporter are recoverable.

## Independence and provenance

The three files `support.mjs`, `historical.mjs`, and `cases.mjs` were preserved at the September 30 pause as unfinished drafts, without generated expected outputs.
This continuation completed those drafts with targeted edits.
In particular, the draft annotation assertion used an unsupported nested `annotation` member; A4 and the independent producer exposed the error before any expected output was frozen.
It now uses the required `subject`, `predicate`, and `value` fields.
No earlier frozen corpus or expected output was replaced.

`historical.mjs` reads exact Git blobs from the pinned historical revision and executes the pinned builder and serializer to produce **input only**.
It resolves the builder's sole model import to the installed public `owlapi/model` API.
The manifest records the historical Git object IDs, hashes, exact execution scope, and installed constructor dependency.
It does not claim a historical dependency rebuild or full browser/controller execution. Saved arrangement/settings and malformed variants are explicitly described as independently authored mutations.

`cases.mjs` and `artifact-cases.mjs` manually transcribe retained source and state from A2–A4/B2–B5 and the ingress field rules. They do not import, read, execute, or derive expectations from the product migration implementation. The previously reviewed independent typed-RDF producer supplies RDFC/canonical outputs from those expected models.
The migration producer and verifier source hashes are pinned alongside its dependencies and authorities.

Two actual historical collisions are checked during authoring: one three-member equivalence axiom versus its three binary pairs, and the analogous disjointness forms.
Their full legacy bytes are identical even though their retained assertion groupings differ.
Both are rejection witnesses.
A triangle-free equivalence chain is a positive witness preserving two separate assertions.

## Compact storage

`manifest.json` stores shared historical JSON seeds and small add/remove/replace patch lists.
It specifies pointer escaping, byte reconstruction, profile, resolutions, expected result/error, provenance, and rationale for each case.
No separate input file is created for each mutation.

`expected-successes.json` bundles exact expected source, mapped default-graph N-Quads, canonical N-Quads, primary/category correspondence, and canonical JSON bytes.
Canonical bytes have explicit UTF-8 encoding, byte length, SHA-256, and exact text.
A JSON parser recovers that text before UTF-8 encoding; the bundle's outer formatting is not part of the canonical document.
Cases with identical expected source and profile share one artifact entry.

Coverage includes root absence versus known anonymity, lexical predicate resolutions, language/IRI/anonymous annotation values, assertion anchors, unidentified counts versus named membership, binary relations and grouping loss, irreversible endpoints/restrictions/operators, duplicate and incomplete joins, edited summaries, state completeness, effective prefixes, selector intent, active and inapplicable filters, degree all-empty restoration, equivalent-node collapse, hidden label placements, and viewport conversion.

## Verification

From the repository root:

```powershell
node packages/vowl/conformance/supplemental/migration/derive.mjs
node packages/vowl/conformance/supplemental/migration/verify.mjs
node packages/vowl/conformance/supplemental/migration/verify.mjs --check-package
```

The first command rederives and compares frozen artifacts without writing.
Only the explicit `--write-new` authoring mode creates missing files, using exclusive creation; it never replaces an existing expected artifact.
The second reconstructs input bytes, validates hashes and independently reproduces every successful byte pipeline.
Red controls change a retained identity and a camera coordinate and require output disagreement.
Only the third imports public `vowl/migrate` and `vowl`.
It compares complete canonical bytes and stable error codes, checks immutable results and deterministic diagnostics, preserves input/options, and checks immediate byte/resolution snapshots.
It does not import product internals.

`loadCorpus`, `checkRun`, and `verifyPublic` are also exported for the package test runner.
Diagnostic matching requires declared codes and exact source pointers; it does not freeze English messages or invent an unspecified warning count.
Migration diagnostics are outside canonical bytes.

Standards/core lexical and resource suites remain separate existing evidence; this supplement does not duplicate their thousands of generic mutations.
