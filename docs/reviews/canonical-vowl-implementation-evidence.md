# Canonical VOWL implementation evidence

## Accepted scope and ownership

On 30 September 2026, Maksym Shostak requested implementation of the [eight-slice plan](../plans/2026-09-24-canonical-vowl-implementation-plan.md), including its required configuration changes, commits, and pushes.
The plan is the accepted R2 implementation route; its separate freeze, release and production-cutover decisions remain separate decisions.
The owner subsequently authorized the required upstream `owlapi` implementation and validation/commit/push delivery after reviewing the public-capability evidence.
When instructed to proceed with the pending recommended decisions, the task recorded acceptance of the demonstrated atomic editing path, the lexical/edge direction clarifications, the Stage 4 nonpositive-camera error rule, and the temporary HISEW pause/resume needed to perform the approved upstream work.
The exact plan SHA-256 is `15caf9bb9d87051a66a599e7c0d63649a8f775fb8ea4e72c02f7b6c1d6bfd740`.
HISEW captured it as requirement snapshot `3f588cfc-e748-41aa-bd61-53da210501d4` for session `01a0f1b9-d71e-7ba0-9aff-5161e6115503`.
The starting commit is `4f1970e5b6c95655af823c495bd58f9e9993f8b8`; the pre-existing `skills-lock.json` modification is excluded.

The main Codex agent owns core implementation and integration.
The separately assigned `canonical_oracle` agent owns independent fixture derivation and the independent producer, without access to the implementation under test.
The `owl_capability_review` agent inventories the public parser/validation boundary.
The owner explicitly authorized separate agents for the required independent oracle and protocol, security, and accessibility reviews, and identified Claude as available for independent review.
Native discovery confirms Claude Code `2.1.285` is installed; its first independent seed review completed using the configured Claude Opus 5.5 provider.
The review found no incorrect expected seed values and identified producer guards, provenance and coverage-claim issues; the oracle custodian addressed those without changing the frozen expected bytes.
Follow-up review of the revised independent producer and expanded corpus completed in a separate plain clone, with findings retained in the independent conformance report.
Claude is the intended independent protocol/verifier provider; Codex Security owns the native security assessment.
Browser accessibility review and the rollout observer are assigned at their later qualification gates; no rollout has started.

The first deliverable is SLICE-001 plus the early SLICE-002 seeds: package-local source-to-bytes-to-document behavior for both profiles, preserving the existing application.
REQ/AC-001–006, 009, 011 and QA-001–004, 008–009 define its tests.
The route is test-first for executable behavior, with public-boundary checks and independently derived expectations.
Focused feedback uses `npm test -- --runInBand packages/vowl`; affected regression includes the existing converter and artifact service.
Final assurance includes the selected HISEW full profile, repository aggregate checks, standalone packaging, independent review, and the applicable conformance evidence.

## Software selection refresh, 30 September 2026

The [accepted research](../specs/2026-09-24-canonical-vowl-design-decisions.md) already selected RDFC-1.0 and RFC 8785 rather than a custom serializer or graph-labeling algorithm.
Registry metadata and the exact npm tarballs were inspected before adoption.
Downloaded tarballs, original license texts, and inspection evidence are retained under the session's external HISEW operator-report directory.

| Requirement                          | Selected component                 | Evidence and residual responsibility                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------ | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RFC 8785 bytes                       | `canonicalize@5.1.0`, Apache-2.0   | Current registry release; [maintainer](https://github.com/erdtman/canonicalize). The exact serializer source uses UTF-16 key ordering and rejects lone surrogates. Its coercions and `toJSON` support require prior safe-value admission; it does not sort VOWL sets.                                                                                                                         |
| RDFC-1.0                             | `rdf-canonize@5.0.0`, BSD-3-Clause | Current registry release; [maintainer](https://github.com/digitalbazaar/rdf-canonize). Public options provide the canonical identifier map, SHA-256, AbortSignal and explicit deep-iteration bounds. VOWL's typed mapping/category ranks remain custom profile rules.                                                                                                                         |
| Closed JSON Schema 2020-12           | `ajv@8.20.0`, MIT                  | Current registry release; [2020-12 documentation](https://ajv.js.org/json-schema.html). Use the 2020 entry point, bundled schemas, no network resolution, coercion, defaults or property removal. Graph invariants and deterministic error precedence remain profile-specific.                                                                                                                |
| JSON lexical tokens and construction | `@streamparser/json@0.0.26`, MIT   | Current registry release; [maintainer](https://github.com/juanjoDiaz/streamparser-json). Public Tokenizer/TokenParser callbacks permit duplicate-name rejection before value assignment and bounded chunk processing; version 0.0.26 preserves escaped lone surrogates and safely handles `__proto__`. Duplicate-name sets, profile budgets and Unicode rejection remain wrapper obligations. |
| Lexically unchanged RFC 3987 IRI     | `@hyperjump/uri@1.3.6`, MIT        | Current registry release; [maintainer](https://github.com/hyperjump-io/uri). `isIri` validates a scheme-bearing IRI including fragments. Do not call normalization/resolution functions. Native WHATWG URL and `uri-js` normalization are unsuitable as identity operations.                                                                                                                  |
| Fixed RFC 5646 well-formedness       | `bcp-47@2.1.1`, MIT                | Current registry release; [maintainer](https://github.com/wooorm/bcp-47). Use `parse` with `normalize:false` and no forgiving mode. Check duplicate variants and extension singletons from the returned structure; preserve grandfathered spelling apart from ASCII case. `Intl.Locale` would apply different registry/normalization semantics.                                               |

The selected exact licenses are standard Apache-2.0, BSD-3-Clause and MIT grants with no additional rider in the inspected artifacts.
Retain their required notices with redistribution; the package and authored specification remain AGPL-3.0-only.
No service, telemetry or runtime network dependency is introduced by these libraries.
The resolved transitive licenses and standalone/browser integration remain verification items, not inferred results.
The existing native Node runtime reports `24.21.0`, npm `12.1.0`; the repository declares npm `12.0.2`.
No runtime or package-manager pin is changed by this work.

Custom implementation is limited to the accepted VOWL field inventory, semantic invariants, projection, typed RDF mapping, category IDs, safe snapshots, finite budgets and operation admission.
The maintained libraries supply their actual parsing/schema/standards contracts; none is replaced by a second implementation for convenience.
The modern-web performance guidance was consulted: CPU-intensive graph processing belongs in a worker, and browser responsiveness must be measured at SLICE-006.

## Evidence status

The initial public API scaffold produced behavioral RED for six seed/admission tests, then 32 public admission and lexical checks.
The implemented pipeline passed those tests; the expanded independent corpus subsequently passed 25 exact-byte positives (including permutations), one pinned A8 rejection, and all 30 independently authored negative inputs.
A new details-only projection test exposed an unnecessary default-role requirement; the observed `NORMALIZATION_INVALID` failure was corrected and the focused suite reached 85 passing tests.
Three additional package-local editing experiments pass but expose the ownership gap documented in [editing feasibility](canonical-vowl-editing-feasibility.md); successful hand-authored repairs do not establish a general editing path.
These are focused development results, not the final governed full-profile verification.

The owner approved the atomic editing amendment and the measured bounded RDFC resource-policy amendment on 30 September 2026.
The amended independent corpus contains 95 positive vectors: all 92 prior successful complete canonical JSON/N-Quads outputs are unchanged, and the three original linear-policy failures now have separately pinned positive outputs.
The original producer, manifests and expected artifacts remain frozen.
There are also 30 original negative vectors and 62 supplemental error/boundary cases.
The independent `language-empty-private-use` case exposed a real wrapper defect: `bcp-47` silently consumed the empty private-use suffix in `en-x`.
The wrapper now checks ASCII-case-only parse/stringify round-trip equality in addition to parser warnings and duplicate variant/singleton rejection.

The initial expanded public-boundary suite passed 342 tests in nine suites, including exact unchanged-edit bytes for all 87 structural corpus fixtures.
The affected existing converter/artifact-service regression passes 290 tests in 22 suites.
The package's actual Vite-built dedicated worker passes all 95 amended positive vectors plus atomic editing and in-flight cancellation in Chrome 154 on Windows: 97 rows, 451.8 ms in the observed run, with no console warnings, errors or issues.
This browser result was observed through Chrome DevTools; the tool's configured workspace restriction prevented raw file capture, so it is not represented as a saved tool transcript.
The authored harness is retained under `packages/vowl/test/browser` and `packages/vowl/scripts/browser-probe.mjs`.
It is a core-worker qualification, not full application responsiveness, accessibility or production-cutover evidence.

Subsequent independent ordinary review found and verified repairs for expression-depth accounting, edit primary-record accounting, normalized semantic identity, generated role/default identity, occurrence correspondence and validation precedence.
The independently expanded corpus now contains 177 positive vectors and 122 negative/boundary cases across the retained and supplemental manifests.
Two of the newest negative cases exposed occurrence-generation duplicates being rejected at the wrong A7 stage; the corrected stage returns `RECORD_DUPLICATE` without preempting normalization checks for malformed topology.
That focused candidate passed 545 tests in ten suites; authored package JavaScript passed ESLint.
The rebuilt Chrome 154 worker passes 181 checks in the observed 505.4 ms run, with no console warnings or errors and actual locale `en-US`.
The separately installed third candidate passed its then-current 95-vector corpus on Node 24.21.0 and 24.19.0 under three timezones, observing `en-GB` throughout.
That earlier tarball is not evidence for subsequent changes.
Exact review snapshots, findings, corrections and incomplete external-verifier/security coverage are recorded in the [core review](canonical-vowl-core-review.md).

The fourth standalone candidate passes all 177 source/decoder vectors and 166 structural no-op edits on both Node runtimes across the same three timezones.
Its 566,555-byte tarball has SHA-256 `e49d75ec644ac82485405428b8fdc0bf06be129020f2dc5ccc19578628a500b2`.
The first repository aggregate check identified one architectural-test conflict with the newly authorized workspace.
The independently reviewed correction permits only the named `vowl` workspace while preserving external OWLAPI ownership checks.
The subsequent `npm run check` passed all 2,402 tests in 132 Jest suites, setup/prose checks, lint/format checks and the application bundle.
The only existing `src/` change is that architecture test; existing application behavior remains unchanged.

An independent field-level coverage audit then found that the token and projection inventories did not establish every required/forbidden field or embedded assertion branch.
The additive `field-contract` supplement addresses that separate denominator without rewriting earlier manifests or expected artifacts.
Its first 23 grammar/precedence negatives and 29 additional annotated assertion positives pass through the public API, bringing that focused conformance run to 351 cases.
The new positives include complete canonicalization, decoding and handle/set/key permutation comparisons; their independent no-write producer also reproduces all expected bytes and datasets.
All 32 embedded Assertion variants now have a positive witness; the broader field/type/reference/profile coverage expansion and its independent review remain in progress.
Separately, the twelve-test resource suite passes its added exact-upper-bound and zero-deep-work qualification, with a retained mutation control proving sensitivity to an exclusive-upper-bound regression.
The earlier aggregate, browser and standalone results do not claim execution of these later test and corpus additions.

The completed field supplement expands the fifth frozen candidate to 217 positive models and 3,953 package tests.
The initial comparison passes 3,948 tests; the five mismatches are the independently recorded nonpositive-camera precedence disagreement now resolved by the owner's accepted clarification.
Their original expectations remain preserved until the independent additive corrections are integrated.
The actual private A6 mapper also matches all 217 independent canonical N-Quads artifacts and primary/blank-node/quad counts.
This mapping comparison does not close the separate per-field inverse-interpretation obligations.
The fifth candidate's fresh standalone tarball passes all 217 source/decode vectors, 204 structural no-op edits, insertion and both endpoint-promotion regressions on Node 24.21.0.
Its SHA-256 is `2bc20e2372dff7daf092b1c7b93fdb335ffc65b72a9f425fee0624e56e6589b9`.
Its Vite-built Chrome 154 worker passes 221 checks in the observed 561.5 ms run, with no console warnings or errors, locale `en-US` and timezone `Europe/Bucharest`.
The DevTools workspace restriction again prevented saving its raw result to the external evidence directory; the observed result is retained in the tool transcript.
The [application boundary proposal](canonical-vowl-application-boundary-proposal.md) records the separate installed-consumer identity and annotated-edit experiments and their remaining application qualification limits.

Implementation and qualification are in progress.
No slice, independent review, interoperability freeze, publication or production cutover is claimed complete by this record.
