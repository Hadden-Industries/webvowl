# Independent compatible-artifact seeds

This is a compact trusted-fixture producer and three positive seeds for the [compatible-artifact candidate contract](../../../../../docs/specs/2026-10-04-canonical-vowl-compatible-artifact-contract.md).
It is not a complete validator, decoder, field-distinction corpus or interoperability freeze.
The authority SHA-256 is `9199710c479a28dc01708973390fd942e4459be9599f78aba003ac9cb652c527`.
This is the historical derivation identity, before the later table-rendering and validation-order clarification.
The [gap corpus](../compatible-artifact-v2/README.md) supplies separately derived expanded evidence against the recorded authority revisions; it does not alter these three seeds or retrospectively enlarge this pass's scope.

## Derivation and execution

Antigravity CLI 1.2.15 independently authored the producer and seed sources in a single owner-approved file-read/text-output-only pass on 4 October 2026.
The pass took 186.2 seconds against base revision `2bba8c5511e9d0b8fc665d542ce06481d3001208` plus the pinned authority above.
It read the supplement, compatible-view amendment, historical independent oracle and the empty/named-class artifact source fixtures.
Production code, generated schemas, tests and compatible expected outputs were excluded from its assignment.
The provider reports no command execution or file writes; the execution and comparison below were performed separately by the integration worker.

The returned module was inspected for effects and syntax checked before execution.
It imports only Node built-ins and the selected `canonicalize` and `rdf-canonize` standards libraries; it does not import production code or read expected bytes.
The independent derivation ran in a separate process with a 512 MiB V8 heap ceiling and a two-minute wall-clock ceiling.
The producer also caps each RDFC call at `min(B²,100000)` deep iterations and twenty seconds.
All original and permuted outputs were retained before production comparison, without adjusting a fixture or expectation to match production.

The sole packaging adaptation replaces the host-specific `createRequire` resolution base with `import.meta.url`.
It changes no grammar, fixture, mapping, hash, ID or ordering logic.
The regression reproduces both original and permuted outputs using this portable module.

| Artifact                                   | SHA-256                                                            |
| ------------------------------------------ | ------------------------------------------------------------------ |
| Raw returned producer, retained externally | `04f3ec216b780516d2f4cd81f1c12e2e6c02caa1056ffec8f2f634471631533a` |
| Portable `producer.mjs`                    | `ec4ff887ca52aeec0fea962fe22198b7c58a02c72ba29e72b5bf8062362cbd30` |
| `vectors.jsonl`                            | `dfa2fe36ce32458973a6f92b9dd66c650f0f1b9f9b1455eb9230b7e5aef4319c` |

`vectors.jsonl` has three rows and 185,058 bytes.
Each row retains its normalized source, typed-handle/set permutation, expected document and canonical UTF-8 string, pre-refinement N-Quads, augmented canonical N-Quads, primary correspondence and expected byte digest.
The JSONL record terminator is archive framing, not part of canonical document bytes.
Primary correspondence is informative for that fixed source; complete bytes and canonical datasets are the permutation invariants.

## Observed coverage and limits

| Seed                              | Observed scope                                                                                                                                                                      |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `comprehensive-compatible-core`   | Seven detail kinds; acquired/unavailable imports; two documents; four graph variants; residual IRI, blank and literal terms; core subject/role references; complete nonempty scene. |
| `property-sub-super-pair`         | Property relation alternative, explicit `ltr` and unavailable header state. Despite the identifier, this is a single seed, not an isolated field-distinction pair.                  |
| `minimal-empty-core-headers-none` | Empty core, header state `none`, required root and a scope entry. It still maps to blank nodes for primary and auxiliary records.                                                   |

The provider's raw report overstated several denominators.
Eight of ten primary categories have populated witnesses; expressions and constructs remain empty in every seed.
Seven of seven detail kinds, four of four graph variants, three of three residual term variants, four of four header states and both import states occur.
Direction covers absent, empty and `ltr`, but not `rtl`: three of four allowed presence/value alternatives.
The `zero-blank-nodes` label in the third seed's retained `covers` metadata is incorrect and supplies no such evidence.
Different scoped blank nodes occur, but this alone does not establish a minimal document-scope distinction pair.

There are no independent negative expectations, exhaustive field pairs, complete decoder precedence cases, resource acceptance tests or broad OWL mapping guarantees in this scope.
Populating a field is not an isolated injectivity proof.
The producer's auxiliary admission checks are not a complete public validator and their error strings are not normative decoder expectations.
Its general structural branches are inherited helper code, not qualified by the three seeds; in particular, structural language-normalization behavior outside these sources has not been established.
Do not use the module as a general source normalizer or silently extend its evidence claims to arbitrary inputs.

## Reproduction and retained evidence

Run without write flags from the repository root:

```text
npm test -- --runInBand packages/vowl/test/compatibleArtifactCorpus.test.js
```

The test pins the archive and portable producer, reproduces the independently derived outputs, checks permutation agreement, compares production's complete augmented RDF graph and canonical bytes, and decodes the retained bytes exactly.
It never regenerates expectations on mismatch.

The raw assignment, output, process receipt, original module, derivation archive and pre-integration production comparison are retained under `C:/Users/maksy/.hi/w/e/operator-reports/canonical-vowl-01a0f1b9/release-preparation-20261003-01/`.
The [release record](../../../../../docs/reviews/canonical-vowl-release-readiness.md) distinguishes the earlier failed command-based pass, successful static review and this successful producer-authoring pass.
No further independent iteration, profile freeze or publication follows from this seed agreement.
