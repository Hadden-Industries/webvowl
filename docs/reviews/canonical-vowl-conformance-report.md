# Canonical VOWL conformance report

**Status:** Experimental corpus; revised original oracle reviewed with findings.
Supplemental corpus and owner-approved resource-policy revision await independent review.
**Date:** 30 September 2026.
**Oracle custodian:** Separate Codex `canonical_oracle` agent, assigned before production implementation.
**Review owner:** Parent integration task obtained a read-only native Claude `opus5.5` seed review and owns follow-up acceptance.

The oracle was derived directly from the accepted implementation plan and its four governing specifications.
No `packages/vowl/src` production code or tests were read, imported, or used to generate expectations.
The first sources and their complete occurrences were hand-derived from A2, B2, and B3.
The separate producer implements typed RDF encoding, numeric category ranks, complete-member UTF-8 set order, and final JCS serialization.
It uses `rdf-canonize@5.0.0` and `canonicalize@5.1.0` standards libraries, which the plan permits independent producers to share.
Initial derivation used the pre-existing `canonicalize@2.1.0`; after the parent selected direct dependency `5.1.0`, the oracle reproduced every existing vector file without writing or changing any expected byte.
The manifest retains the initial producer and manifest hashes as derivation history.
It is a trusted-fixture producer, not a complete alternate validator, OWL mapper, or migration adapter.

| Input        | SHA-256 of exact checked-out bytes                                 |
| ------------ | ------------------------------------------------------------------ |
| Design D     | `174535bb8cb43f317631f0799721adebfbbc4ceff4d577595be8fb91dd940fac` |
| Core A       | `711ba30c291cfb0960334328203188600f60a331996e83379267a4a77b87988d` |
| Projection B | `4c1cf6a7e187f98d40d390e6ff0b5354aca46a8ff195fba5b6badace7eb6078b` |
| Decisions C  | `f314ec3448f2cf87f73ce6ce8871f3695d4b3b26dee687383b36e36a4fc0a43e` |

The [manifest](../../packages/vowl/conformance/manifest.json) pins the exact source, mapped dataset, canonical N-Quads, category correspondence, and canonical bytes for each vector.
The [corpus instructions](../../packages/vowl/conformance/README.md) explain reproducibility and the rule against overwriting expectations.
Artifact outputs include complete supplied state before RDFC; none use an inferred layout.

| Seed                        | Blank nodes | RDF triples | Canonical bytes |
| --------------------------- | ----------: | ----------: | --------------: |
| Empty structural            |           9 |          20 |             230 |
| One named class, structural |          13 |          33 |             362 |
| Empty artifact              |          17 |          43 |             444 |
| One named class, artifact   |          23 |          64 |             638 |

Initial reproduction ran on Windows x64, Node `v24.21.0`, using actual RDFC/JCS implementations.
The minimal graphs' node and triple counts were also derived directly from the normative A6 templates.
These seeds exercise empty containers, the profile anchor, named-subject blank nodes, references, tokens, binary64 coordinates, booleans, placements, and whole-profile state.
Their empty/singleton categories do not discriminate numeric rank ordering or multi-member set ordering; they also contain no Text or Decimal fields.
Those coverage limits are explicit in the revised manifest.

The independent reviewer found no incorrect or internally inconsistent values in the four seed vectors and confirmed their hand-counted graph sizes and byte lengths.
The reviewer did not execute RDFC or hash verification; executed reproduction and hashes remain operator evidence.
The reviewed manifest was `fd76f91f855e2ee0107c9d43dab77213fa3332a40e19eb325d42e6cc7125cb2f`, with producer `0e3f988211f5e80b817d8867e6f026ebfeda38f98c88791b7913556f6f8851d3`.

The review's F1/F2 coverage findings led to the explicit seed limits above; F8 added the missing D9 and B2.1 tags.
F3–F6 led to separate construct/assertion grammars, closed source/profile checks, required fields and discriminated embedded branches, safe plain-value guards, ASCII-only language spelling normalization, exact scalar type/domain guards, and strict complete/unique canonical-label checks.
The oracle still does not establish complete RFC 3987/RFC 5646 validation, typed reference categories, semantic normal form, complete topology, or artifact-state invariants; reviewed normalized fixtures remain its input contract.
F7 led to hashes for the producer, source definitions, reproduction runner, and guard checks, plus derivation history.
The earlier producer change from `81bab1df...` to `0e3f9882...` was repository Prettier formatting, with no mapping change.
The subsequent `0.2.0` change hardens fixture admission and narrows coverage claims; it preserves every frozen source, mapped dataset, canonical dataset, ID map, and byte file.
Twelve meaningful guard rejection checks and an ASCII-case invariant pass using actual standards libraries.
The subsequent Claude follow-up reviewed the revised oracle with findings, described below; a passing guard script is not independent approval.

The [extended manifest](../../packages/vowl/conformance/extended-manifest.json) contains 21 additional successful sources plus one pinned operational rejection.
Successful cases include exact nested annotations and declaration anchors, an asymmetric subclass, anonymous symmetry, state-sensitive named classes, repeated/reversed chains, matched/unmatched inverse edges, equivalence/disjoint self-loops, an empty key, a partially drawn union, and all six unqualified cardinality kinds with qualified details-only counterparts.
Every successful case reproduces complete canonical bytes and N-Quads under simultaneous handle renaming, set reversal, and object insertion-order reversal.
The operational case also rejects its permutation under the same pinned library budget.
Three distinction checks preserve chain order, chain repetition, and exchanged named-class state; exchanging the two anonymous symmetric placements preserves complete bytes.
In the named-pair artifact, subject ordinals `c14n2` and `c14n11` discriminate numeric category ordering.
Exchanging its placements changes role and occurrence ranks while preserving semantic IRIs, demonstrating why IDs cannot join states.
The annotation and cardinality fixtures exercise exact Text and Decimal `xsd:string` boxes.

Both object and data restriction fixtures use a PropertyContext with the exact property and originating subclass scope.
Claude's review confirmed the specific B2.4 rule takes precedence over B2.3's general generic-endpoint rule; “subclass relation” in the general rule is read as a subclass-edge relation.
That is a recorded interpretation, not a normative edit; review of the expanded vector files remains pending.

The [projection matrix](../../packages/vowl/conformance/projection-matrix.json) expands all 8 role, 23 expression, and 32 construct kinds, plus 7 metadata/value rows.
It records conditions, occurrence kinds, authority, and rationale without claiming exhaustive fixture coverage.
The [display vectors](../../packages/vowl/conformance/display-vectors.json) contain 46 language-neutral expectations for labels, lookup, prefix ties and fixed whitespace, namespace externality, exact builtin exemptions, principals/aliases, membership scaling, camera conversion, cardinality spelling, and compact notation.
They await independent review and execution by the single application display module.
The [negative manifest](../../packages/vowl/conformance/negative-manifest.json) contains 30 independently derived source or raw-byte error cases; it is not a claim that production has passed them.

The two-data-property source has 16 primary records, 37 total blank nodes, and 118 quads.
Under the original 24 September A8 policy it fails with the linear ceiling of 37 deep iterations in `rdf-canonize@5.0.0`, despite its small ordinary topology.
The original manifest preserves that historical library-specific `RDFC_RESOURCE_LIMIT` expectation; the approved amendment's new positive result is stored separately.
A separately labeled [bounded standards-library probe](../../packages/vowl/conformance/experiments/rdfc-budget-probe/result.json) searched only up to 1000 iterations: 71 fails and 72 succeeds, confirmed in three repeated pairs.
Every successful exploratory result has the same canonical N-Quads hash `e9812cee595021e630842fb93323c7b753c663cdf9aab618c4021634877e91f4`.
The mapped dataset hash is `30e3e9f4cafb95ba9f323466160fdfef477a71492b89fc457a84f2e680b097cc`.
Zero work also fails, proving actual deep comparison is required.
That historical experiment changed only an in-memory copy of producer `0e3f988211f5e80b817d8867e6f026ebfeda38f98c88791b7913556f6f8851d3` and was explicitly nonconforming to the then-current A8 policy.
It did not authorize a policy change or turn the original source into a positive fixture.

**30 September follow-up and supplemental evidence.**
The native read-only Claude `opus5.5` follow-up found the revised producer conformant to A6.3/D18.2 and found no incorrect value in the positive JSON/ID outputs it hand-inspected.
It reviewed all extended source recipes and selected outputs, not all N-Quads, permutations, or raw negative inputs, and executed no commands or hashes.
Its verdict was reviewed-with-findings for experimental use, without SLICE-002 completion or freeze acceptance.
The parent integration task retains the full reviewer report at its external operator-report location.

The follow-up's H1 resource finding led to separately retained [growth measurements](../../packages/vowl/conformance/supplemental/budget/growth-results.json).
The exact original p/q graph was rerun using frozen producer `5097d9726c839afc7b4240dcb5527bd5089f5f847d788e9b32b6d3dd67699fd1`; it still needs parameter 72, with 71 failing and 72 succeeding in three repeated pairs, and preserves the original mapped/canonical dataset hashes.
Two additional ordinary graphs require 50 with 47 blank nodes, and 52 with 43 blank nodes.
A deterministic series of 1–8 defaulted data properties has `(blank nodes, smallest successful parameter)` values `(25,5)`, `(37,76)`, `(49,111)`, `(61,144)`, `(73,185)`, `(85,222)`, `(97,259)`, and `(109,304)`.
The second series graph uses different property IRIs from the original p/q graph, so its threshold 76 is not a contradiction of 72.
These are exact graph/library observations, not a general complexity law.

Direct inspection of `rdf-canonize@5.0.0`'s `lib/RDFC10.js`, SHA-256 `454a1158dd18a1559f7259573ffd9748999921cd18064c3ed48ab2b135446a98`, resolves the reviewer's memory-based counter question: line 119 initializes one `remainingDeepIterations` counter per operation, and lines 274–280 check/decrement it on every top-level or recursive `hashNDegreeQuads` invocation.
The minimum passing parameter is therefore a global count for the exact graph and library execution.
It is not a portable semantic property or an RDF validity threshold.

All eleven ordinary probe cases pass at `min(B*B,100000)` in 0.53–8.38 ms on this Windows x64 Node `v24.21.0` run, with identical complete bytes and N-Quads for every successful budget.
A separate [raw RDF symmetry probe](../../packages/vowl/conformance/supplemental/budget/symmetry-results.json) is explicitly outside VOWL conformance: complete directed homogeneous graphs with 3, 5, 8, and 12 blank nodes all reject the quadratic allowance in 0.48–12.87 ms.
At the 100,000 ceiling, sizes 3 and 5 succeed, while 8 and 12 reject after 5.31 and 8.87 seconds.
A 1 ms signal cancels sizes 5, 8, and 12 in 1.65–4.97 ms.
The tiny size-3 case can finish or exhaust its allowance before the library polls a signal, so the A7 operation-entry abort check remains necessary.
No failure returned alternate bytes.
These measurements do not establish browser-worker deadlines or broad hostile-input qualification.

The owner then approved the exact [resource-policy amendment](../specs/2026-09-30-canonical-vowl-resource-policy-amendment.md), SHA-256 `9f1b7d96229a06f57e29a52f92325a4256e6f826d7532e239848ef99dc0f47c1`.
The separate [amended producer](../../packages/vowl/conformance/supplemental/amended-policy/producer.mjs), SHA-256 `da7936738c98cb853de7c6d6f2ae7528cbd4d47a0c1ccb1258dae7c5f7143321`, differs from the reviewed producer in exactly one checked budget expression.
It retains default 100,000, the independent 10-second deadline, all mapping/ID/JCS code, and fail-closed behavior.
The trusted-fixture producer exercises the default; public caller override ceilings remain a production qualification obligation.

The baseline [amended-policy manifest](../../packages/vowl/conformance/supplemental/amended-policy/manifest.json), SHA-256 `90f3754316f683a76ad9eecb8341d29a738b3f77b61c13362034de07cee92156`, contains 95 positive fixtures.
Its [retained-output proof](../../packages/vowl/conformance/supplemental/amended-policy/retained-positive-proof.json) verifies all 92 previously successful complete byte outputs and canonical datasets unchanged.
The three historical rejections have new independently derived complete positive outputs, including permutation checks.
The original producer, seed/extended manifests, and historical expected errors were not rewritten.

The [supplemental grammar manifest](../../packages/vowl/conformance/supplemental/grammar/manifest.json) adds 67 positives and preserves two original-policy rejection observations.
It covers remaining A3/A4 tokens; literal values and repeated facet names; explicit core punning; partial class/property groups and unequal endpoints; singleton self-inverse and multiple inverse pairs; distinct disjoint endpoints; two separately scoped restrictions and additional restriction exclusions; generic RDF Resource paths; complete artifact node/label placements and each hidden-closure direction; IRI label mode; grandfathered/complex language tags; lexical `01` versus `1`; and a semantic IRI whose spelling equals a source handle.
An inverse orientation discriminator has the smaller IRI on role `r2` and the larger IRI on role `r0`, so sorting by canonical IDs gives the wrong forward direction.
Every positive's complete bytes and canonical dataset reproduce under simultaneous handle, set, and object-key permutations.

The [supplemental negative/boundary manifest](../../packages/vowl/conformance/supplemental/negative/manifest.json) pins 62 cases: 59 rejection expectations and three exact successful input-byte, primary-record, and RDF-quad boundaries.
It includes immediate versus nested-descendant endpoint anchor support, signature closure, prohibited generic/specific role overlap, duplicate semantic payloads, incomplete hidden closure and placements, IRI/tag scalar errors, and all finite option maxima/zero domains.
Its isolated duplicate-ID input uses a different IRI.
Its isolated surrogate occurs in a literal within an otherwise valid canonical envelope.
Original overlapping negatives remain unchanged: A7/D19 precedence between malformed Unicode and an invalid envelope remains an explicit specification question; passing the current production decoder is evidence of behavior, not a normative resolution.

The new [coverage matrix](../../packages/vowl/conformance/supplemental/coverage-matrix.json) links all 8 role, 23 expression, and 32 construct tokens to positive bytes.
It separates all seven object-characteristic enum values: functional, inverse-functional, symmetric, and transitive can receive principal-property visual treatment; reflexive, irreflexive, and asymmetric remain details-only.
Its 76 rows establish token/value presence, not every conditional projection branch or renderer behavior.
The [exact guard checks](../../packages/vowl/conformance/supplemental/check-producer-reasons.mjs) match all twelve intended oracle error messages and confirm no getter invocation.

The [review corrections](../../packages/vowl/conformance/supplemental/review-corrections.json) explicitly record inverse direction, operator-to-operand direction, anonymous-root locality, details-only absent-default interpretation, scoped-context rule tags, and the two overlapping negative-case questions.
Inverse/operator/anonymous-root choices are not silently promoted into new normative wording.
`mapped.nq` is compared up to RDF dataset isomorphism: producer-private labels and line order are irrelevant.
`ids.json` is derivation evidence, and symmetric handle-to-ID assignments are informative even for a fixed source input; the canonical complete output remains the conformance target.
The [provenance index](../../packages/vowl/conformance/supplemental/provenance-index.json) pins all 83 derivation scripts, catalogs, manifests, source/graph probe artifacts, and current review metadata without rewriting frozen reviewed files.

The parent integration task reports that all 95 amended positives, the original 30 negatives, and all 62 supplemental error/boundary cases now pass production operations.
The independent `en-x` case exposed an actual language-parser acceptance bug; the parent reports fixing it by verifying the ASCII-case-only parse/stringify round trip.
The parent additionally reports 342 focused tests, including 87 no-op edit exact-byte checks, and a browser-worker run of all 95 positives plus editing and in-flight cancellation (97/97 in 451.8 ms, without warnings or errors).
These are integration-owner execution reports, not tests executed by this independent oracle agent.
This task did not read production source or tests or select expected outcomes from production execution.
Independent review and full qualification remain separate acceptance steps.

Outstanding evidence includes independent review of the supplements and amended oracle; complete conditional topology/display and operational qualification; additional runtimes/locales; and full application/browser qualification.
No full SLICE-002 completion, frozen profile, interoperability release, or accessibility claim follows from this corpus alone.

**Clause-level conditional follow-up.**
The new [conditional inventory](../../packages/vowl/conformance/supplemental/conditional/clause-inventory.json) replaces a token-presence claim with 98 explicit clause witnesses and 127 branches across 76 concrete B2.5 rows.
Every row links exact source, complete canonical document bytes, and canonical dataset files.
Eighty-four clauses have complete topology witnesses; eleven also require independent evidence of renderer treatment, and three retain explicit B2 protocol-interpretation obligations.
This is a clause-witness inventory, not every Cartesian combination of constructors, a security proof, or full application qualification.

The follow-up adds 82 independently authored positive sources in four separate manifests: 62 primary conditional cases, 14 concrete-token refinements, five details-only partition/characteristic cases, and one complete model retaining all six cardinality tokens outside subclass scope.
Together with the preserved 95-case baseline, the inventory references 177 positives.
Every new source includes complete occurrence topology; every expected output was derived with the separate amended producer and reproduced under handle/set/key permutations.
No production source, tests, or outputs were used to choose the sources, projection, IDs, or bytes.

The cases distinguish direct/default/undrawable endpoints for all three property families; exact endpoint terms even when class grouping gives the same glyph; transitive and partial property partitions; shared and split generic contexts; full-partition datatype contexts; exact-role restriction contexts; inverse eligibility/orientation/replacement; disjoint pair deduplication and the distinction between a normalized singleton and one remaining drawable term; zero/partial/grouped operator operands; separate restriction scopes; principal versus nonprincipal/inverse-expression characteristics; absent subproperty projections; and complete datatype/inverse/restriction artifact placements.
B2.5 links explicit details-only instances instead of inferring that token presence exercises conditional exclusion.

The [30 conditional negative cases](../../packages/vowl/conformance/supplemental/conditional/negative-manifest.json) are also independently derived and remain frozen.
Two exact-payload occurrence duplicates initially exposed a production error-code divergence.
A5 defines semantic primary-record uniqueness for occurrences using generation keys, and A7 places structural uniqueness before exact projection; the oracle therefore retained `RECORD_DUPLICATE`.
The parent reports correcting that stage boundary without changing these expectations.
This evidence is narrower than every possible normalization-equivalent generation-key collision.

The [display questions](../../packages/vowl/conformance/supplemental/conditional/display-questions.json) keep anonymous-root locality, inverse endpoint direction, and operator direction explicit for protocol review, together with the earlier details-only/default-signature interpretation.
They distinguish genuine wording questions from fixture premises: the compact-notation vector needs the standard-glyph-present premise before omitting `Subclass of`, and prefiltered label-candidate vectors do not prove upstream annotation-candidate selection.
Complete canonical bytes do not establish highlights, characteristic symbols, omitted-operand cues, exact derived text, accessible summaries, or details completeness; the eleven corresponding clause rows state that specific remaining obligation.

The parent integration task reports all 545 focused tests passing, including 177 positive models and 166 structural no-op edit comparisons.
Its actual Chrome worker run passed 181/181 operations in 505.4 ms, with `en-US` and `Europe/Bucharest` reported and no console warnings or errors; the parent previously reported Node `en-GB`.
These are attributed integration-owner executions, not independent oracle executions or general cross-runtime qualification.
The final conditional corpus still requires independent review before freeze.

All six new no-write reproduction commands, ESLint, and Prettier pass.
During authoring an unused local constant was removed; guarded source-provenance updates checked that every fixture entry and expected file remained unchanged.
Only new conditional metadata was refreshed.
The previous provenance index remains `8079159ae4fb579a000b109349120320e00781c5c03fa1bfa6eab75c6e394fa7`, and the resource amendment remains `9f1b7d96229a06f57e29a52f92325a4256e6f826d7532e239848ef99dc0f47c1`.

The [corpus entry README](../../packages/vowl/conformance/README.md) now links all five current positive manifests and their no-write supplemental runners.
It labels the original linear-budget rejection and probe as historical evidence under the superseded policy; no frozen expectation changed.

| Conditional artifact                      | SHA-256                                                            |
| ----------------------------------------- | ------------------------------------------------------------------ |
| `manifest.json` (62 positives)            | `8ad1e7d52d040e27334e847f1366baff4cf9f16d36a5f960302d852e8fca87bb` |
| `additional-manifest.json` (14 positives) | `cc10d2372c9f28e4b8202ecfa74b4e49235fecd9d7c2ac89779dcfc8c7d0fe1e` |
| `completion-manifest.json` (5 positives)  | `37c8d01cb3888e499cd647862ebdaf13ddfbd6baf57fd96032533575ed5d67da` |
| `scope-manifest.json` (1 positive)        | `869ec2b79220eb31a4419f80aa4491f40fbfc7c6859252a2ff99567a17e9b478` |
| `negative-manifest.json` (30 errors)      | `d79e3ad7cc5574ed09fd484435717688b4115119c660d3f166e9ae86a080d1d0` |
| `clause-inventory.json`                   | `0071fdda5f0faf47918d8fcb27e09bc377c33aa075836ee4c2a97980b6822dcf` |
| `provenance.json`                         | `627672609828c58b6a5b2bdc3674cf243bde4fea062fb1b9ffe84f04a57e89f8` |
| `display-questions.json`                  | `0c9a1bac1cfeb8807163214bb991803714ef07567bc7340848a1e0d760ef19bc` |

**Independent corpus review response.**
The parent integration task reports completion of the independent corpus review.
Its provenance finding is valid: the historical `supplemental/derive-index.mjs` rediscovers files from the expanded tree, so its generated inventory differs from the frozen 83-artifact index.
That old runner and index remain unchanged.
The new [versioned no-write verifier](../../packages/vowl/conformance/supplemental/review-resolution-v1/verify-frozen-scopes.mjs) pins the two frozen index identities, checks their explicit entries, and checks every recorded file reference in their indexed manifests.
It performs no filesystem discovery, producer execution, or golden regeneration.
Normal and self-check runs pass: 83 baseline and 17 conditional artifact entries, 11 recorded manifests, 1,957 explicit pin checks, and 1,291 unique files.
Two in-memory digest mismatches and two length mismatches are rejected with no filesystem mutation.
This proves retained file identities, not canonicalization semantics.

The separate [review-resolution metadata](../../packages/vowl/conformance/supplemental/review-resolution-v1/review-resolution.json) retains all historical catalog/index hashes and resolves two prior questions from existing normative text.
B2.2's "only when a projection needs them" means an undrawable supplied range does not force an otherwise-unused absent-domain default role.
Design 14.3 explicitly states that when the root ontology is anonymous, no subject is classified as external, resolving the earlier B5-only reading.
Neither resolution changes a frozen input or expectation.

Inverse-edge from/to, operator-edge from/to, and A7-versus-D19 Unicode error precedence remain expressly pending owner clarification; existing implementation agreement does not resolve them.
Earlier catalog statuses and clause counts remain preserved history rather than being regenerated.
The eleven renderer-treatment obligations and the compact-glyph/candidate-filter premises remain separate outstanding qualification work.
The live corpus READMEs route readers to the versioned verifier and this status overlay without changing any prior producer, index, manifest, or expected byte file.
All nine existing supplemental reproduction commands passed again without write flags; ESLint and Prettier passed for the new verifier and metadata.

**Independent field-contract follow-up.**
The additive [field-contract inventory](../../packages/vowl/conformance/supplemental/field-contract/contract-inventory.json) transcribes A1–A5/B1/B3 into 124 record/variant descriptors and 414 field positions.
It declares 3,369 finite obligations: 698 positive bindings and 2,671 negative mutations.
The [binding inventory](../../packages/vowl/conformance/supplemental/field-contract/coverage-inventory.json) binds every declared cell to an exact independently valid source/canonical witness or a pinned isolated mutation.
The denominator includes 1,474 forbidden-field classes, 309 required-field checks, 315 JSON field-type checks, 53 collection item-type checks, 38 lower and three upper collection bounds, 18 shared invalid enum/discriminator checks, 161 dangling references, 161 wrong reference categories and 139 wrong typed target sorts.
Selector guards share a family-level check across explicitly listed variant positions; nested record variants are not multiplied across every possible parent.
These finite classes do not enumerate all JSON member spellings, all malformed values or all semantic graph combinations.

The [29 supported-anchor positives](../../packages/vowl/conformance/supplemental/field-contract/positive-manifest.json) supply the missing legal embedded Assertion alternatives with complete topology, dataset, N-Quads, IDs and canonical bytes.
The combined corpus now contains all 32 legal embedded Assertion alternatives.
[Nine further positives](../../packages/vowl/conformance/supplemental/field-contract/additional-positive-manifest.json) complete the embedded object-characteristic values and supply alternative existing typed targets for isolated reference-sort/cardinality cases.
These sources were derived from independent positive witnesses under A4; production source, schemas, helpers, tests and outputs remained unread.
The amended trusted-fixture producer and four governing specification hashes remain unchanged.

The [full field-negative manifest](../../packages/vowl/conformance/supplemental/field-contract/negative-manifest.json) reuses 21 of the frozen 23 early negative inputs and adds 2,650 inputs; the two early precedence cases remain separately linked.
A separate [semantic inventory](../../packages/vowl/conformance/supplemental/field-contract/semantic-inventory.json) has 437 explicit obligations: 433 new decoder/profile/scalar/precedence inputs, the two early precedence cases and two exact known-profile positives.
It supplies decoder required/forbidden/type probes for every canonical closed record/variant, unknown selector guards, Literal's narrower union, exact known-profile and state-envelope coupling, scalar-domain positions and listed A7 precedence cases.
[Five additional overlaps](../../packages/vowl/conformance/supplemental/field-contract/semantic-overlap-manifest.json) isolate envelope type precedence and earlier reference/ID/projection/scalar failures combined with nonpositive zoom.
These scripts construct independent expected errors; they do not implement a complete independent validator or decoder.

The integration owner reports all 3,010 initial public conformance cases passing, comprising 215 positives, 2,671 full field negatives, the two additional early precedence cases and 122 prior negative/boundary cases.
Adding the semantic batch produced 3,440 passes and three stable-code divergences.
The missing common-envelope field plus unknown profile case exposed an A7 envelope-order question that the independent protocol reviewer agrees is a product defect.
The two nonpositive camera zoom cases exposed a genuine normative stage/code dispute: the producer reads A7's explicit stage-7 camera invariants as requiring `ARTIFACT_INCOMPLETE`, while the reviewer reads B3's positive-Number constraint as a stage-4 scalar domain requiring `NUMBER_INVALID`.
The three reference/ID/projection-plus-zero-zoom overlaps depend on the same dispute.
All five original expectations remain frozen; the [camera-precedence proposal](../specs/2026-09-30-canonical-vowl-camera-error-precedence.md) awaits an owner decision.
Neither current production behavior nor a test-count target resolves this contract choice.
These execution results are attributed parent reports, not operations performed by the independent producer.

The separate [state-only identity pair](../../packages/vowl/conformance/supplemental/field-contract/state-identity-manifest.json) explicitly closes the missing AC-005 witness.
It uses two named classes and an identical structural source.
Changing only `/visualization/placements/0/position/x` from 0 to 1 changes the complete dataset and bytes, swaps Alpha/Beta role IDs `r0`/`r1`, and swaps class-node IDs `o0`/`o1`.
[Before/after semantic associations](../../packages/vowl/conformance/supplemental/field-contract/state-identity/associations.json) make the category-rank change unambiguous without relying on anonymous automorphisms.
Both full outputs reproduce under typed handle/set/key permutations.
Current positive scope is 217 fixtures in eight manifests; this statement is corpus inventory, not all-runtimes qualification.

The [D18 mapping-pair inventory](../../packages/vowl/conformance/supplemental/field-contract/mapping-injectivity-inventory.json) deliberately separates injectivity evidence from grammar evidence.
Excluding 66 primary handle positions and separately classifying five serialized-envelope mirrors leaves 343 retained source-field positions.
An exact-one-field positive-pair audit establishes changed full canonical datasets and bytes for 35 positions and explicitly leaves 308 unclosed, plus a dedicated profile-framing pair.
All 36 selected pair witnesses were independently reproduced and permuted.
Composite owning-field substitutions count for that owning field only; they do not establish nested-field injectivity.
The audit conservatively preserves source handles and may miss pairs requiring semantic alignment or coordinated signature/projection changes.
D18 mapping qualification remains incomplete; a separately scoped counterexample supplement is authorized to continue this work.

All field-scope derivation commands default to no-write comparisons and never overwrite frozen expectations.
Its [new explicit provenance index](../../packages/vowl/conformance/supplemental/field-contract/provenance-index.json) records 3,601 files, including 3,381 new scope files and 220 prior witnesses or authorities.
Its [no-write verifier](../../packages/vowl/conformance/supplemental/field-contract/verify.mjs) checks those recorded entries and then both prior frozen scopes without filesystem discovery.
The historical index identities remain `8079159ae4fb579a000b109349120320e00781c5c03fa1bfa6eab75c6e394fa7` and `627672609828c58b6a5b2bdc3674cf243bde4fea062fb1b9ffe84f04a57e89f8`; no old producer, expected output, index or manifest was rewritten.
Independent final review, the disputed expectations, the remaining mapping pairs and renderer/application qualification remain separate acceptance obligations.
