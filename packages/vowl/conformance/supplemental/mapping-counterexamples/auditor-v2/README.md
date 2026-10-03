# Independent template auditor, revision 2

This additive revision repairs two independently reproduced gaps in the frozen [first auditor](../template-audit.mjs).
No production code or tests were read, no producer semantics changed, and no source fixture, canonical JSON, canonical N-Quads, ID file, historical auditor, evidence file, or prior provenance index was overwritten.

The first gap allowed an auxiliary blank node to be replaced everywhere by a named IRI.
The second allowed a source subject to be misclassified as a role when its producer correspondence category and RDF type were changed together.
These were weaknesses in the checker: review did not find incorrect allocation kinds or primary types in the existing golden graphs.

The corrected [auditor](template-audit.mjs) applies [A6.1–A6.2](../../../../../../docs/specs/2026-09-24-canonical-vowl-core-contract.md#a62-allocation):

- The expected primary category comes from the actual `subjects`, `roles`, `expressions`, `constructs`, or `occurrences` source collection.
  `ids.json` supplies handle-to-canonical-node lookup, and its category metadata is independently checked against that source collection.
- Correspondence entries cover exactly the source primary handles and assign a unique canonical blank node to each.
- The fixed named `m:root` is the only named allocated node.
  Every other owned record, object, collection, and sequence slot must be blank.

[The evidence](template-audit-evidence.json) rechecks all **859 existing positive graphs and 104,723 triples**.
Every successful complete template trace remains equal to the first auditor's result.
[Twelve controls](controls-manifest.json) check named objects, sets and slots, category/type collusion for each of the five primary collections, and missing, extra, duplicate or shared correspondence entries.
**Nine controls passed the first auditor; all twelve are rejected by revision 2 for the stated checker invariant.**
The two exact review reproductions are retained in this set.

These mutations are private proof-checker controls.
Their `ERR_ASSERTION` messages are not public Canonical VOWL error codes; the mutated files named `canonical.nq` are deliberately invalid copies of the original expected graphs, not new positive golden results.
The checker still audits trusted corpus data; it is not a complete public validator or an independent implementation of RDFC.

Reproduce without writes:

```text
node packages/vowl/conformance/supplemental/mapping-counterexamples/auditor-v2/verify.mjs
node packages/vowl/conformance/supplemental/mapping-counterexamples/auditor-v2/derive.mjs
node packages/vowl/conformance/supplemental/mapping-counterexamples/auditor-v2/derive-provenance.mjs
node packages/vowl/conformance/supplemental/accepted-protocol-v2/derive.mjs
```

Writers create missing revision-2 files only with explicit `--write-new` and exclusive creation; default execution compares frozen bytes.
The new bounded index also pins the [active camera metadata correction](../../accepted-protocol-v2/camera-corrections-manifest.json).
Both additions preserve their predecessors and do not amend the governing specifications.
Independent review and product comparison remain separate evidence.
