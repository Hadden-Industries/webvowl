# Independent compatible-artifact gap corpus

This supplement extends the [historical three seeds](../compatible-artifact-v1/README.md) without changing their producer or expectations.
It qualifies the additional fields and algorithm choices in the [compatible-artifact contract](../../../../../docs/specs/2026-10-04-canonical-vowl-compatible-artifact-contract.md).
It is conformance evidence for a trusted fixture domain, not a general independent validator or an owner freeze decision.

## Independent derivation and correction

A separate Codex oracle role derived the sources and expected bytes from normative prose and the earlier independent producer.
It did not read production source, generated schemas, production tests or compatible expected vectors.
The integration role compared the sealed expectations afterward; a separate source reviewer checked the contract and producer expansion.
The first 167 cases were derived against authority SHA-256 `9199710c479a28dc01708973390fd942e4459be9599f78aba003ac9cb652c527`.
The second batch uses corrected authority `ac54a81e89237b001a78daa24c469cc2dfe27e375f287bf0c951bf9bc21d3bca`, which repairs table rendering and makes existing field-by-field validation precedence explicit.
No runtime mapping or canonical byte contract changed with those documentation repairs.

The original `projection-before-qualification` fixture removed occurrences still referenced by placements.
It therefore encounters the inherited dangling-reference check first.
The oracle independently corrected its expected code to `REFERENCE_DANGLING` and supplied `projection-before-qualification-no-dangling`, which removes only the unreferenced operator edge and expects `PROJECTION_INVALID`.
The historical expectation and correction rationale remain in `checks.json`; the original sealed negative archive remains in external evidence.
No successful byte expectation was regenerated to match production.

The source reviewer also found that the old producer did not normalize structural language tags through its discriminator descriptors.
The independent `normalize` overlay applies inherited ASCII lowercasing to structural language values and visualization language ranges, while preserving qualifications and residual language exactly.
`independent-overlay.mjs` contains the oracle's normalization and separately implemented refinement functions.
Packaging only changes dependency paths and removes top-level fixture execution; it does not edit those functions' semantic derivation.
The original module remains pinned by the historical supplement.
The overlay is not a complete RFC 5646 validator, and its rejection strings are not negative expectations.

## Compact artifacts and reproduction

`vectors.jsonl` retains complete normalized sources, handle/set permutations, independently expected UTF-8 bytes, base and augmented canonical N-Quads, and fixed-source ID correspondence.
`checks.json` retains distinctions, independently specified negative codes, refinement witnesses, numeric issuance, authority identities and hashes of the raw external inputs.
The integration test pins both artifacts and the portable overlay.
The corpus stays in a few aggregate files rather than one file per mutation.

Run from the repository root:

```text
npm test -- --runInBand packages/vowl/test/compatibleArtifactGapCorpus.test.js
```

The test reproduces each source and permutation with the independent producer, compares public canonicalization and exact decoding, and compares the complete production augmented RDF graph.
It never writes expectations.
Trusted JSON fixture transport restores same-realm plain objects after Jest's host-realm `structuredClone`; it changes neither the fixture values nor the producer's prototype admission rule.
N-Quads transport supplies the private mapping representation's empty language string for typed literals before the internal refinement comparison.
Neither transport adaptation is a runtime compatibility path.

## Coverage accounting

The integrated inventory contains 229 positive cases, 108 difference pairs, 69 negative cases and three refinement witnesses.
The 108 pairs comprise 104 one-field replacements and four explicitly coupled changes required for valid sources.
Replacing an object or set field is one field change, not an isolated proof for every nested scalar.
Language-normalization equality/distinction controls are recorded separately.
Four final sources isolate uppercase versus lowercase changes in `AnnotationValue.language`, `Literal.language` and label range separately; they exercise a reachable data enumeration through a datatype definition without inventing display occurrences for details-only constructs.
Primary source handles are tested for equivalence under renaming, not for semantic distinction.

The new grammar contains 68 branch-local field slots: five qualification collection fields; five Document fields; five Import fields; seven Entry fields; two SourceNode fields; six SourceStatement fields; 26 Detail fields; eight residual branch fields; four ResidualLiteral fields.
Shared Resource/Term branches are counted once.
IDs and discriminators are included in this grammar denominator, so it must not be reported as 68 independent semantic-field proofs.

| Obligation                    | Evidence                                                                                                                                                                                                                  |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Document identity and imports | Optional ontology/version presence and values; all header states; root ownership; parent, request and target; state/target coupling; unconnected documents.                                                               |
| Qualification entries         | All seven detail branches; all allowed dimensions and eight rules; ordinary code spelling; optional absence/empty/value cases; all property category alternatives; header selection; scope codes.                         |
| Typed references              | Every core category and all actual qualification reference fields, set membership and duplicate rejection; all ten primary categories jointly populated.                                                                  |
| Residual RDF                  | Every term and graph branch, IRI/value and branch distinctions, exact lexical/Unicode/language spelling, all direction alternatives, document ownership and reassociation of already-used blank nodes.                    |
| Admission                     | Closed fields, scalar types/domains, missing/unknown order, global IDs, all qualification prefixes, duplicate payloads/sets, semantic-stage overlaps, inherited projection/state precedence and canonical-byte rejection. |
| Refinement                    | Independently derived framing/stopping-color counterexamples, persistent symmetry, numeric versus lexical `c14n` issuance and once-per-quad self-incidence.                                                               |
| Equivalence                   | Typed handle renaming, set/document enumeration permutations and inherited structural language normalization.                                                                                                             |

Detail cross-kind comparisons replace the complete detail field within a common allowed dimension; changing only `kind` would create invalid mixed-branch data.
ImportRef and EntryRef name primary IDs but have no non-ID incoming reference fields in this grammar; inventing such field witnesses would be incorrect.
The self-incidence fixture is a synthetic private-algorithm dataset, not a claim that a boxed public residual statement directly creates a self-loop mapping quad.
Its expected complete augmented graph is compared directly with the internal refinement operation.

## Inherited evidence and limits

The core corpus's 859 positives, 3,235 rejection/boundary cases and 343-field accounting remain the evidence for inherited structural/visualization grammar, Unicode, duplicate-safe parsing and exact-byte behavior.
They are not recounted as new independently derived compatible cases.
`refinedRdf.test.js` supplies implementation qualification for embedded-work/quad/string boundaries, cancellation and retained graph distinctions; `resourceBudget.test.js` and the SLICE-006 report cover their exact accepted operational inputs.
`compatibleArtifact.test.js` covers generated compatible schema agreement, closed qualifications, live recovery and document-scoped source identity.
The new independent corpus complements those checks; operational measurements and hostile-input evidence are not claimed to have been independently rederived here.

No exhaustive arbitrary-graph injectivity proof, complete general-purpose independent parser/validator or universal workload guarantee is claimed.
Exact optional error pointers and all equal-code tie orders are outside these negative assertions.
The existing authority guarantees stable first-error codes for the same input, not permutation-invariant pointers for invalid sets.
Profile freeze, package publication and production cutover retain their separate owner decisions.

Raw authoring, sealed pre-comparison artifacts, reviewer findings, corrections and comparison receipts are retained in `C:/Users/maksy/.hi/w/e/operator-reports/canonical-vowl-01a0f1b9/compatible-gap-20261004-01/`.
The [release-readiness record](../../../../../docs/reviews/canonical-vowl-release-readiness.md) binds this evidence to the current candidate and final verification.
