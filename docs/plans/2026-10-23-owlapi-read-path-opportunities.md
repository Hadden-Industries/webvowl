# OWLAPI read-path opportunities

## Status and recommendation

This follow-up to approved [PERF-DEC-014](2026-10-23-whole-load-profile-and-optimization-proposal.md) was requested on 23 October 2026.
After the read-only audit, the owner explicitly instructed: **“Let's implement the audit’s recommendations, and that smaller, separate improvement.”**
This selects the shared snapshot read model and private comparison snapshot cleanup below.
The owner separately approved the exact OWLAPI provenance and rights-inventory metadata updates recorded in `docs/adr/0013-bounded-private-read-models.md` in the OWLAPI candidate.
The owner requested GPT-6.1 Sol on High for the investigation.
That agent inspected the source and ran small process-local counter probes; the primary agent checked the relevant implementation seams and contracts.

The strongest next investment is **one private read model attached to an immutable ontology snapshot**, serving axiom queries, signature discovery and annotation lookup.
That would consolidate repeated query rules and avoid rebuilding equivalent answers on every read.
Keep public defensive results and current import-closure resolution.
A separate, smaller improvement can remove collection round trips inside structural comparison.
Measure preserve-mode role comparison before selecting another cache.

## Inspected source and evidence boundary

- Repository: `Hadden-Industries/owlapi`, clean `main` at `e113c3f5f42eca4c8611b2b6251cea90a1cfc583`.
- Active RDF read-view candidate: separate branch `perf/bounded-rdf-read-index` in the `owlapi-whole-load` worktree, based on that revision.
- Investigation: `/root/owlapi_read_path_audit`, GPT-6.1 Sol, High; Codex thread `01a15c31-343a-72d2-ab3e-33461706b9e6`.
- No source, configuration or workflow state was changed by the audit.
  No private ontology contents were read by the delegated agent.
- Counters below describe redundant work on small synthetic fixtures.
  They are **not elapsed-time improvements, memory measurements or W6 acceptance results**.
- Reproduced baseline and candidate counters are retained in `operator/16557566c924469fb5e117f2cfbe6e03/owlapi-read-model-upstream-1.json` and `owlapi-read-model-candidate-1.json` under the HISEW evidence root; `probe-owlapi-read-model.mjs` records the executable probe.

The main query fixture has 300 named classes, 300 declaration axioms and 299 subclass axioms forming a chain.
The label fixture has the same 300 declarations plus 300 English label assertions.
Instrumentation calls the original native methods in a short-lived Node process.

## Ranked opportunities

| Priority    | Location at the inspected revision                                    | Current repeated work                                                                                                                               | Proposed ownership and expected effect                                                                                                                                        |
| ----------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1           | `model/owlOntology.js:169`, `:225`, `:259`, `:562`                    | Axiom-kind queries scan all direct axioms; position queries materialize a Set and array before another filter; containment materializes all axioms. | Lazy indexes by kind, structural position and existing structural keys, owned by the immutable snapshot. Repeated queries approach one construction pass plus result copying. |
| 2           | `model/owlOntology.js:612`, `:644`, `:685`                            | Each signature query traverses axiom and ontology-annotation structures again. Reference queries traverse every axiom for each primitive.           | One ordered signature discovery per snapshot. Build a larger primitive-to-axiom reference index only if repeated-query measurements justify its retained memory.              |
| 3           | `util/annotationValueShortFormProvider.js:72`                         | Every label lookup flattens current closures, filters all axioms for each preferred property, and sorts candidates.                                 | Reuse a snapshot-owned subject/property annotation index from priority 1, while preserving each query's current provider membership and root-group ordering.                  |
| 4           | `internal/model/ontologyStructuralIsomorphism.js:489`, `:138`, `:223` | Public defensive Sets are copied into private arrays; pure fingerprints and anonymous-presence metadata are revisited.                              | Use the existing trusted snapshot reader internally. Evaluate comparison-owned metadata reuse separately, with unchanged bijection search and limits.                         |
| Conditional | `model/owlOntologyManager.js:936`, `:982`, `:997`                     | Preserve-mode convergence repeatedly sorts/serializes role support proofs and builds comparison Sets.                                               | Cache comparison keys only within a load session for internally owned role sequences whose immutability has been established. Profile first.                                  |

### 1. Axiom indexes

Three hundred declaration lookups over 599 axioms performed 300 direct-array filters, examining **179,700 rows**, followed by **90,000 structural equality calls**.
`containsAxiom` can also avoid a fresh full Set and array by using the already-defined structural key appropriate to its annotation mode.

`internal/model/ontologyState.js:484` returns the same committed snapshot; publication replaces that snapshot at line 553.
This provides an existing lifetime and invalidation authority.
A private `WeakMap` keyed by the snapshot can associate derived read data without independently keeping discarded snapshot keys alive; other strong references still determine actual lifetime.
See [MDN WeakMap](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakMap).

The index must preserve stored encounter order, annotated variants, structural equality between separately constructed objects, n-ary membership and entity kind.
For imported queries, capture the **current closure** and combine each member's current snapshot results with existing structural deduplication.
A cache keyed only by the root revision is insufficient when a dependency changes or the loaded closure changes.
Public callers must still receive independently mutable Sets.

Proof: cold/warm query counters; one-shot cost and retained heap; mutation followed by queries; import additions/removals and changed member revisions; separately constructed equal entities; public-result mutation isolation; exact ordered results.
Existing tests include `model/model.test.js`, `model/rc2Queries.test.js`, `model/rc2NativeQueries.test.js` and `search/nativeSearch.test.js`.

### 2. Shared signature discovery

The six signature-kind getters visited **14,370 structural objects** on the 599-axiom fixture, even though five requested entity kinds were absent.
The counter observes recursive `OWLStructuralObject` visits through `Object.keys()`; it does not count tuple construction, arrays or primitives.
Shared objects count again when revisited from another axiom or another query.

Derive ordered kind and IRI buckets once from both direct axioms and ontology annotations.
Preserve first encounter order, structural deduplication, punning and document-scoped anonymous individual identity.
The optional reference index needs separate treatment: `getReferencingAxioms` includes special `xsd:anyURI` literal matching at lines 702–709, which a generic structural-key index would otherwise miss.
Its memory cost grows with indexed references, so signature caching alone does not justify building it eagerly.

Proof: ordered outputs for named kinds, the complete signature and referenced anonymous individuals; punned IRIs; annotations; shared structural DAGs; literals and `anyURI`; cyclic/diamond import closures; revision changes.
Use existing model and native-query suites plus adversarial lifetime and invalidation cases.

### 3. Annotation short forms

Three hundred label lookups over 600 axioms performed **180,000 full-array filter rows**, for a single preferred property.
This is repeated query work that can share the axiom index instead of introducing a separate long-lived provider cache.

There is an ordering trap: the current implementation sorts candidate values across each supplied root's **entire closure**, then concatenates root groups.
Sorting each member independently and concatenating changes results.
IRI candidates can replace a non-first language match, and the first preferred language terminates the search.
Preserve repeated roots, provider order and live provider membership, as well as property/language priorities.

Proof: `util/shortFormProviders.test.js`, especially live revision/provider membership, plus mixed IRI/literal candidates, repeated roots and overlapping closures.
Compare exact strings and callback behavior, not only the set of available labels.

### 4. Structural comparison

The private snapshot adapter calls three public collection getters and spreads their results.
Across both operands, that creates **six temporary Sets and six arrays** before the comparison.
The internal `readOntologySnapshot()` already exposes the committed immutable sequences.
Switching this private adapter is a small, useful ownership cleanup even if its time saving is modest.

A tiny equal comparison with shared annotation objects and renamed anonymous individuals fingerprinted eight distinct structural objects through **30 structural-object visits**.
This supports a local reuse hypothesis, not a proven large-workload hotspot.
Cache only pure, context-independent metadata within the comparison.
Array fingerprints depend on their parent field's ordered/unordered semantics; array identity alone is an unsafe key.
Mapping-dependent match results must not be reused as if they were independent of the anonymous-individual bijection.

Proof: exact equality outcomes, mismatch paths and `maximumSearchStates` failures in `internal/model/ontologyStructuralIsomorphism.test.js`; shared objects and symmetric anonymous cases; unchanged RDF/XML and Turtle storage losslessness results.
Do not remove the comparison from the storage validation path.

### 5. Preserve-mode role comparison

`namedKeys()` rebuilds Sets and sorted support-proof spellings for `equalRoles()`.
The fixed-point loop compares role sequences during four stages, dependent requeues and convergence checks.
This is a plausible repeated-work site, but the audit did not measure its contribution on an import-heavy load.

First count key construction, proof sorting and repeated role-sequence identities on import chains and cycles.
Retain a cache only if the same immutable sequences recur and cost matters.
Never reuse imported-role concatenations after dependency changes; support proofs and document scope are semantic inputs.
Keep the original document timeout, cancellation and reconstruction behavior.
Existing starting points are `model/owlOntologyManager.importedDeclarations.test.js` and source-preservation/import-role tests.

## Work not selected by this investigation

- Graph selection and source-location preparation are largely one-time linear work.
  A shared mutable DatasetCore would introduce aliasing.
  The [RDF/JS Dataset specification](https://rdf.js.org/dataset-spec/) requires `match()` to return a new dataset and leaves iteration order unspecified; preserving this implementation's observed order remains a compatibility requirement.
- The RDF/XML/Turtle storage reconstruction is a losslessness check.
  Removing it changes assurance rather than merely eliminating a redundant collection.
- `syntacticLocalityModuleExtractor.js` already creates its ordered signatures and entity index once.
  Changing its work-budget semantics is a separate decision.
- `model/structural.js` already precomputes structural keys and tuples.
  Another global key cache would duplicate existing ownership.
- `internal/model/sourceEvidence.js:34` has two avoidable public-result copies, but they are linear once per evidence construction.
  This is lower priority than repeated queries.

## Recommended follow-up boundary

Plan one bounded snapshot-read-model change covering axiom buckets, shared signature discovery and annotation candidates, with the reference index conditional on measurements.
Treat comparison snapshot cleanup as a separate small slice.
Keep preserve-mode role caching as a diagnostic candidate.
No public collection contract, import-closure semantics, parser semantics, package selection or resource policy change is implied.

## Implementation checkpoint

The OWLAPI candidate now contains one private `internal/model/ontologyReadModel.js`, consumed by the existing ontology façade and annotation provider.
It derives immutable ordered buckets lazily and keys ownership by the committed snapshot.
Public results stay defensive; current closure resolution remains outside the read model.
The comparison adapter uses `readOntologySnapshot` directly.
The reference index and comparison fingerprint caches are not selected merely from a repeated-work hypothesis; this checkpoint retains their existing behavior.

| Diagnostic on the same synthetic fixture                  | Original | Candidate |
| --------------------------------------------------------- | -------: | --------: |
| Full direct-array filter rows for 300 declaration queries |  179,700 |         0 |
| Equality calls in those position queries                  |   90,000 |         0 |
| Structural visits across six signature getters            |   14,370 |     2,395 |
| Full-array label filter rows                              |  180,000 |         0 |
| Public defensive collection reads per comparison          |        6 |         0 |

The outputs, including result order, have identical SHA-256 `8629246dc1880fd7b2f9fb7b0aef12c9faee43304a5de2eac5db13a46e475b96`.
Zero full-array filter rows does not mean zero work: the candidate constructs bounded indexes and copies returned results.
Five warm uninstrumented batches show declaration-query times of 0.085–0.126 ms versus 9.157–9.602 ms, six-signature times of 0.015–0.025 ms versus 0.897–1.101 ms, and label times of 2.114–3.165 ms versus 10.126–12.473 ms.
These tiny-fixture Node timings demonstrate the mechanism; they do not predict whole-load browser speedup.

The six new ownership/ordering tests and 1,873 existing focused tests pass.
A dedicated forced-GC Node probe (`owlapi-read-model-lifetime-1.json`) collected all 100 retired snapshots and readers; settled heap was about 5.7–5.8 MB after warmup.
This does not establish browser heap or whole-process RSS behavior.
The corrected consolidated candidate passed 16,382 tests in 278 suites, with 26 existing skips, followed by successful architecture checks and native package/installed-consumer qualification.
The private position index uses its field name directly after the final lint check rejected unnecessary JSON identity encoding; no lint exception was added.
The owner approved the six reviewed browser integrity entries, and native fixture preparation passes without changing imports, scopes or dependency URLs.
All six Chromium/WebKit bundler, import-map and DedicatedWorker checks pass.
The three local Firefox checks could not launch the installed Firefox 157 (`spawn UNKNOWN`), matching the existing host limitation; their failed receipt remains retained.
Remote PR CI subsequently passed all three browser engines and the full installed-consumer matrix.
The owner waived AGY review and additional runs solely for HISEW bookkeeping on 23 October 2026.
Signed source commit `86d02d38019013d56d11f0210b282373d29755f8` landed on remote `main` through [OWLAPI PR #85](https://github.com/Hadden-Industries/owlapi/pull/85), with normal merge commit `9648eb923809391c9fda5c9a33829d9bd2fbf6f9`.
WebVOWL then applied the separately approved exact dependency selection recorded in PERF-DEC-014; its installed-source boundary test passes.
No unavailable local check is reported as passing.

These improvements are credible maintainability opportunities because one owner would define query order, indexing and revision lifetime.
Their eventual speedup still depends on actual caller frequency and memory cost; this audit does not imply that they account for the remaining W6 ranking delay.
