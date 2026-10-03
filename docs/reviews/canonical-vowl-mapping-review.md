# Compatible mapping review, 3 October 2026

The owner authorized one additional Claude mapping review, capped at ten minutes with no automatic follow-up.
The read-only Claude Code pass completed in 209.2 seconds, using Read, Grep and Glob only.
It reviewed `refinedRdf.js`, its tests and section 15 of the compatible-view amendment, consulting directly relevant mapping/budget code.
The three scoped files had identical hashes before and after the review.
No second review, delegation or provider substitution ran.

The reviewer supported the static identity argument for the admitted base-mapping domain: equivariant colors, retention of all base quads and a reserved color predicate preserve graph isomorphism even if colors collide.
It did not execute tests or provide an independent conformance implementation.
Its resource approval covered work, cancellation and deadlines, but explicitly withheld byte/allocation approval for the original implementation.

| Finding | Implementation response | Validation |
| --- | --- | --- |
| Tests overstated their evidence and included a rejected vector. | Exclude expected-error vectors, assert colors/rounds/classes under permutation, match production RDFC work bounds, and distinguish retention from color discrimination. | Twenty-five admitted vectors and the reviewer's independently derived path/cycle expectations pass. |
| Long ground terms were re-serialized in every round without byte accounting. | Prehash ground keys, cache their digests, charge ground-key serialization before allocation and bound fixed-key scratch storage before each node's round. | Escaping-heavy input rejects the byte limit; all six pinned closures pass existing defaults. |
| A hash collision could reduce the class count without triggering the equality stopping test. | Stop whenever the count does not increase. | Code now has an unconditional blank-count round bound; identity remains independent of color injectivity. |
| The reserved-predicate premise was only assumed. | Reject non-IRI predicates and the entire reserved refinement predicate namespace. | Both negative cases reject explicitly. |
| Shared refinement work and its error attribution were understated. | Use `RDF_RESOURCE_LIMIT` and document the cumulative incident-work cost and additional allocation bounds. | Existing work/quad negatives and new allocation negatives pass. |

The corrected candidate passes 33 focused tests.
One six-closure qualification completed within default limits: FOAF 1.31 s, GoodRelations 2.85 s, MUTO 0.31 s, OntoViBe 0.60 s, Personas 1.22 s and SIOC 1.38 s on this host.
The prehash changes this private candidate's color bytes; frozen v1 mapping and expected bytes remain unchanged.
These are local repair validations, not a second independent review or completed compatible-artifact qualification.
Complete qualification fields, visualization state and production integration remain outside this review.

External evidence is retained under `C:/Users/maksy/.hi/w/e/operator-reports/canonical-vowl-01a0f1b9/live-recovery-20261003-01/`:

- `claude-mapping-review.json`: exact reviewer output.
- `claude-mapping-review-run.json`: elapsed time, scope, cap and before/after hashes.
- `mapping-review.py`: bounded invocation with no retry.
- `refined-mapping-reviewed-results.json` and its adjacent qualification script: corrected candidate source hashes and six-closure outcomes.

The reviewer also noted that duplicate RDF quads and document-level source permutations need explicit treatment in complete-profile qualification.
Lowercase hexadecimal is intentional lexical data in the internal mapping and must not be normalized by a serializer.
No stronger release, capture, source-preservation or production acceptance claim follows from this review.
