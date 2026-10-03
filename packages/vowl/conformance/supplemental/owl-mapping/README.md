# Independent OWL mapping seeds

This additive corpus contains 28 authored source inputs, 21 complete expected retained models and 66 mapping-profile runs.
It is a bounded SLICE-003 seed, not an exhaustive parser/adapter qualification or a stable profile publication. The OWL bytes and normalized models were authored independently before comparing the adapter; the previously reviewed independent A6/B2 producer supplies complete mapped RDF, canonical N-Quads, category IDs and canonical JSON bytes.
No product parser, adapter, mapper or projection code supplies expectations.

Use `catalog.mjs` to load these exact active layers:

| Layer                      | SHA-256                                                            |
| -------------------------- | ------------------------------------------------------------------ |
| `seed-manifest.json`       | `042e6ed08f4ffeb8d7d4d45b33b267d09d1b008355e523334a37a96dfc2fd579` |
| `closure-v2-manifest.json` | `934d88e9feafc220bfac37f6019d1b285501510f66491bbf519ce694e8aceac9` |
| `review-overlay-v1.json`   | `5d4b433145d9444656d801287b5329066197ac9c3c3ceca923627e9c17ce1a39` |

The overlay adds the independent OWL 11.2 datatype-definition-count diagnostic to the custom-literal case.
Its original strict error and every canonical byte remain unchanged.
The published [OWL structural rules](https://www.w3.org/TR/2012/REC-owl2-syntax-20121211/#Global_Restrictions_on_Axioms_in_OWL_2_DL), A9's explicit unverified-literal rule, and D21.3's requirement to diagnose each recovery establish that correction.

`closure-manifest.json` is an unpublished draft retained for provenance.
A single unused import was removed before review; the exact original producer files are archived under `history/`.
The active closure manifest pins the repaired sources and proves equality of every vector record with that draft.
`catalog.mjs` verifies its recorded historical source identities through those explicit archive references; it does not pretend the old source pin describes the repaired file.

## Expected behavior

The active runs cover compatibility defaulting, strict behavior, all six compatibility recovery categories, all six excluded ABox constructors, exact literal lexemes and language case, recursive annotation attachment, annotated declarations, endpoint aggregation anchors, source arity before deduplication, large cardinalities, three supported syntaxes, resolver context, root-only metadata, closure-order/alias/blank-label permutations, and separate anonymous identities per ontology.
The multi-property quantification cases omit the complete owning subclass axiom and its annotation in compatibility mode.
They do not approximate a unary restriction.
Empty OWL keys reject under OWL section 9.5 despite the core model's representational superset.

Normative derivation comes from D10–13/21, A2–5/A9, B2 and C3/C9.
Exact document hashes and the two frozen independent producer sources are pinned by every layer.
Core resource and direction amendments retain their existing hashes.
The producer is a trusted-fixture encoder, not a complete normalized-source validator or an OWL parser.

`assert-adapter.mjs` accepts only injected public `fromOwl` and `encode` functions.
It checks complete bytes, selected profile, result immutability, unchanged input bytes, the recorded resolver contexts, closed warning records and strictly increasing complete-record UTF-8 JCS order.
Expected diagnostic conditions require exact codes and constructor/restriction identifiers. Text prose and unprescribed warning multiplicity are not golden. An expected `subject` names the IRI that must be identified: A9 makes that output field optional, so an exact delimited IRI in `details` also satisfies the condition. Resolver traversal order and repeated acquisition calls are not asserted; the set of authored-import/importing-document pairs is.

`assertion-controls.json` records 67 synthetic successful checker checks and ten rejected mutants, including a constructor-substring counterexample.
These are checker controls, not executed OWL adapter evidence.
Product comparison results belong in a separate test receipt.

## Reproduction

From the repository root, each command defaults to no writes:

```text
node packages/vowl/conformance/supplemental/owl-mapping/derive-seed.mjs
node packages/vowl/conformance/supplemental/owl-mapping/derive-closure.mjs
node packages/vowl/conformance/supplemental/owl-mapping/derive-review-overlay.mjs
node packages/vowl/conformance/supplemental/owl-mapping/check-assertions.mjs
node packages/vowl/conformance/supplemental/owl-mapping/derive-open.mjs
node packages/vowl/conformance/supplemental/owl-mapping/derive-provenance.mjs
```

The explicit `--write-new` creation mode uses exclusive file creation and exact readback.
It never overwrites an expectation.
Historical seed, core and other supplemental indices are unchanged.

`open-cases.json` retains malformed-list/cyclic-expression inputs with required rejection but deliberately unselected stable dispatch. It also records absent syntax, signature-retention and security/resource evidence.
These gaps are excluded from active case counts and block a claim of complete SLICE-003 qualification.
