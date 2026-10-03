# Canonical VOWL freeze and publication preparation

## Decision and candidate

**Current direction (4 October 2026): continue candidate iteration.**
The [candidate iteration amendment](../plans/2026-10-04-canonical-vowl-candidate-iteration-amendment.md) supersedes permanent-freeze and immutable-publication prerequisites for ongoing implementation and qualification.
The accepted snapshot remains a reviewed checkpoint; justified contract and canonical-byte corrections may produce new identified candidates with affected validation.
Stable-release findings below remain relevant to a later release decision, not reasons to stop candidate development.
The owner subsequently authorized Personas distribution, production cutover and final retirement; current execution is recorded in the [cutover report](canonical-vowl-production-cutover-and-retirement.md).
The earlier unapproved-cutover and unresolved-owner-disposition statements below are historical and superseded by that authorization; actual deployment still requires verified execution evidence.

**Stable profile publication remains deferred; the authorized experimental production cutover is complete.**
The cutover report binds the deployed source/build, independent review, 9,315 passing tests, live byte readback and three-engine browser results.
The owner accepted FREEZE-001, FREEZE-002 and the compatible-view registry on 4 October 2026 against the exact manifest in the [freeze/publication decision](canonical-vowl-freeze-and-publication-proposal.md).
The separate ontology-hosting implementation request is deferred.
Publication and production cutover remain separately unapproved; neither is authorized by the candidate iteration amendment.
This assessment concerns source commit `2bba8c5511e9d0b8fc665d542ce06481d3001208`, published on `feat/canonical-vowl-qualification` after the accepted SLICE-006 laboratory qualification.
It is a preparation record, not a freeze decision, release authorization or replacement for the accepted eight-slice plan.
The unrelated `skills-lock.json` modification and retained branches/worktree are outside this scope.

The [SLICE-006 report](canonical-vowl-slice006-qualification.md) establishes the measured browser targets, resource amendment and bounded review disposition.
Its statement that no commit or push occurred describes that qualification run; the subsequent source delivery is the commit above.
No production cutover occurred in either operation.

## Complete profile scope

All identifiers below have the base `https://haddenindustries.com/ontology/profiles/vowl/`.
The original two canonical profiles do not cover every format that the candidate application can save.

| Identifier suffix                  | Purpose and authority                                                                                                        | Freeze/publication boundary                                                                                                                       |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `canonical/structural-content/v1`  | Retained structure; design, core contract and accepted clarifications.                                                       | FREEZE-001 requires the exact authority, schema, mapping, corpus and qualification revisions.                                                     |
| `canonical/artifact/v1`            | Retained structure and complete portable scene; projection contract also applies.                                            | Same gate, including the display/topology evidence.                                                                                               |
| `canonical/compatible-artifact/v1` | Retained structure, scene, qualifications, import/document links and residual RDF; compatible-view amendment sections 15–16. | Additional complete-profile independent byte evidence is required by the amendment before this identifier can be frozen.                          |
| `owl-mapping/strict/v1`            | Public `fromOwl` strict policy under A9.                                                                                     | FREEZE-002 must bind the actual adapter, dependency, rules and fixtures.                                                                          |
| `owl-mapping/compatibility/v1`     | Public `fromOwl` bounded compatibility policy under A9.                                                                      | FREEZE-002 must distinguish this from the newer compatible live-model route.                                                                      |
| `compatible-view/v1`               | Rule namespace used by portable qualification entries.                                                                       | Publish the exact applicable rule/code registry with the compatible artifact; do not describe this namespace as the old A9 compatibility mapping. |
| `live/retained/v1`                 | Session checkpoint identity in `liveModel.js`.                                                                               | Session recovery is not a canonical interchange profile or independent publication claim.                                                         |

The compatible artifact is the normal capture path for compatible OWL-origin models and reopened qualified documents.
Publishing only the original two canonical profiles would therefore not satisfy the complete application's cutover gate.
References to those original profiles as “frozen” in implementation-era prose describe preserved candidate bytes; the separate owner freeze decision still has to be recorded.

## Reconciled core evidence

The [corpus guide](../../packages/vowl/conformance/README.md) records the current core runner inventory: 859 positive cases, 3,235 rejection/boundary cases and 321 mapping pairs.
The older conformance report's 35-of-343 field count and pending camera/direction questions are historical milestones.
They must not be used as current blockers without applying the later supplements.

- [Field accounting](../../packages/vowl/conformance/supplemental/mapping-counterexamples/field-accounting.json) covers 343 retained field positions through 219 isolated owning-field pairs and 124 coupled pairs.
  Coupled evidence is not an isolated proof for each component.
- The [revision-2 auditor](../../packages/vowl/conformance/supplemental/mapping-counterexamples/auditor-v2/README.md) checks 859 positive graphs and 104,723 triples, with twelve negative checker controls.
  It is a trusted-corpus auditor, not a general independent validator.
- The [accepted protocol supplement](../../packages/vowl/conformance/supplemental/accepted-protocol-v1/README.md) resolves the camera, lexical and edge-direction questions.
  The [revision-2 camera overlay](../../packages/vowl/conformance/supplemental/accepted-protocol-v2/README.md) supplies active metadata without rewriting the historical expectations.
- SLICE-006's existing passing source and browser checks remain applicable to their recorded inputs.
  They do not independently derive the compatible-artifact mapping or its expected bytes.

## Package inventory

External preparation evidence is retained under `C:/Users/maksy/.hi/w/e/operator-reports/canonical-vowl-01a0f1b9/release-preparation-20261003-01/`.
`release-inventory.json` pins 1,772 tracked authority/source/schema/corpus/package/notice files at the source commit above.
Its ordered inventory SHA-256 is `186aaada358bcdcb47b7f6957891dce73c36a4ee4fab73623a2469841ee44103`.
It is an input inventory, not an immutable public release bundle.

The scripts-disabled `npm pack` dry run reports 1,763 package entries, 5,617,217 compressed bytes and 73,828,008 unpacked bytes.
The existing package remains private `vowl@0.0.0-experimental`.
Its file selection includes source, schemas and consolidated conformance evidence but not the normative documents under `docs/specs/`.
The package README and corpus references to those authorities therefore require a separately retrievable, version-bound specification bundle; the package inventory alone is insufficient.
The dry run does not establish fresh external installation, runtime import success, registry publication, licence clearance or IRI resolution.
No package, lockfile, hosting or pipeline setting was changed for this inspection.

`hosting-observation.json` records a read-only HTTP check at `2026-10-03T21:01:53.178Z` (4 October in the owner's timezone).
The public WebVOWL entry returned HTTP 200, while the structural-content and compatible-artifact profile IRIs returned HTTP 404.
The GitHub deployments API returned an empty list.
These observations establish neither the live application's source revision nor a complete external-deployment inventory.
The other profile identifiers have not been probed by this check.

## Initial preparation inventory

This table records the initial preparation gaps.
The final candidate and disposition below supersede its pending independent-derivation and standalone-consumer items; they do not silently accept publication or cutover.

| Work                                      | Evidence and consequence                                                                                      | Owner and completion condition                                                                                                                                                      |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Independent compatible-profile derivation | The amendment explicitly says current tests do not replace an independent complete-profile producer.          | Implementation task arranges a separately authorized bounded independent pass; retain exact inputs, independently derived outputs, comparison results and unclosed coverage.        |
| Exact freeze inventory                    | An inventory exists, but no owner decision binds all production profiles and rule revisions.                  | Implementation task prepares the final evidence bundle after remaining conformance work; Maksym Shostak accepts or rejects its exact revisions.                                     |
| Standalone consumer                       | Earlier installations qualify older candidates; this pass has only inspected package contents.                | Qualify the final packed artifact outside the workspace, with its declared dependencies and supported public imports, after approval of any required configuration creation/change. |
| Package and profile hosting               | Package identity/version, distribution scope and immutable authority resolution are not approved for release. | Prepare exact package/lockfile/hosting changes and their effects, then obtain the owner's configuration and publication decisions.                                                  |
| Example distribution                      | The application report preserves unresolved Stanford `protege-dc.owl` provenance and SIOC notice scope.       | Complete source-specific distribution evidence and notices before including the affected assets in a production release; technical rendering success is insufficient.               |
| Deployment and consumers                  | Source history is not a complete deployed-exporter ledger.                                                    | Reconcile the controlled deployment and known consumers; obtain owner disposition for any unobservable external deployment before cutover/retirement claims.                        |
| Production qualification and observer     | Existing browser evidence is for the separate candidate build.                                                | Build the approved production successor, record every change, run affected published-corpus/adapter/browser checks, assign an observer and obtain the exact cutover decision.       |

No new review loop is authorized by this table.
On 4 October 2026 the owner subsequently authorized less tightly bounded Codex reviews and up to two additional Antigravity retries when justified, then instructed implementation to continue to completion.
The later Codex conformance and release reviews below use that authority; earlier provider caps remain historical records of those individual runs.
The owner requested trying Antigravity after Claude credits became unavailable; provider capability and actual completed output must be established before counting independent evidence.
The retained isolated input clone is for that bounded attempt only and must not be mistaken for a second implementation checkout.

## Next bounded independent assignment

Derive a compact compatible-artifact corpus from the accepted normative documents without reading production code/tests or using production outputs to choose expectations.
Cover document/root/import identities, every qualification detail branch, residual IRI/literal/blank/graph forms, cross-document blank scope, duplicate-statement handling, retained structure/scene identity and the section-15 refinement algorithm.
Pin complete mapped and canonical datasets, category IDs and final bytes where the specification determines them.
Record equivalent handle/set/document permutations and distinctions between materially different inputs.
If the prose does not determine an exact result without consulting the implementation-owned field inventory, report the missing normative clause rather than inventing an expectation.
Retain uncovered obligations explicitly; a compact seed is not automatically complete-profile freeze evidence.
The pass has a thirty-minute ceiling and no automatic retry, subject to usable Antigravity access.

### Antigravity attempt and retained limit

Installed Antigravity CLI `1.2.15` was discovered through the native reviewer inspector and its current CLI help.
A bounded sandboxed capability probe read the compatible-view amendment in the isolated clone and returned its exact compatible-artifact IRI.
The substantive pass then ran once with a thirty-minute outer cap and a twenty-nine-minute native timeout.
It ended after approximately 24 seconds with no substantive output: its command tool was automatically denied because headless mode could not prompt for permission.
Exit code zero therefore does not establish a completed independent pass.
The child process exited and the clone's working tree remained unchanged.

`antigravity-assignment.txt`, `antigravity-capability.json`, `antigravity-pass.stdout.txt`, `antigravity-pass.stderr.txt` and `antigravity-pass-receipt.json` retain the exact assignment and observed outcome.
No independently derived fixture, conformance result or review acceptance was produced.
No permission rule, persistent setting or sandbox bypass was applied, and no automatic retry ran.
The owner subsequently approved a five-minute file-reading-only follow-up limited to normative gaps and proposed wording.
It completed in 121.5 seconds on 4 October 2026 in the owner's timezone, with exit code zero, substantive output and no stderr.
The reviewer reports native file reads only and no executed commands; the clone's working tree remained unchanged and the process exited.
The output is static normative analysis, not an executed independent byte corpus.

### Follow-up findings and implementer disposition

`antigravity-followup.txt`, `antigravity-followup.stdout.txt`, `antigravity-followup.stderr.txt` and `antigravity-followup-receipt.json` retain the assignment, full report and process result.
The five reported authority paths exist at the reviewed revision, and the assignment's acceptance quotations match the amendment.
The central implementation-inventory dependency is confirmed by section 16's explicit reference to `compatibleContract.js`.
However, the report contains an incorrect source attribution and several proposed values that are not established by the cited prose.
Retain the raw report as external input with these defects recorded; do not treat all proposed text as verified normative evidence or approved repairs.

| Report finding                             | Disposition after checking the cited prose and current candidate                                                                                                                                                                                                                                                                       |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Ground literal language framing         | Clarification is needed between the inspection representation and the RDF mapping term representation. The assertion that A2 defines typed-literal language as `null` is incorrect: A2's typed branch has no language field. The proposal's `null` hash input would change the candidate, which hashes the RDF term's language string. |
| 2. Incident-quad encoding                  | Accept the need to specify whether the outer signature contains encoded strings or arrays. Reject the proposed nested-array wording as a byte-preserving clarification: the candidate sorts encoded strings and embeds those strings in the outer JSON signature.                                                                      |
| 3. Stopping round and hex spelling         | Make the completed stopping round, initial class count and zero-node case explicit. Lowercase hex is already stated; do not recanonicalize it to uppercase. The candidate uses the newly computed stopping-round colors.                                                                                                               |
| 4. Additional primary mapping categories   | Accept the missing explicit vocabulary and category registration. Proposed type names are not observations: the candidate uses `CompatibleDocument`, `CompatibleImport`, `Qualification`, `SourceBlankNode` and `SourceStatement`. Do not amend the original two profiles' vocabulary or invent new names during transcription.        |
| 5. Qualification grammar and rule registry | Accept the missing self-contained normative inventory. Reject the suggested nullable portable rule, invented branch names and `ontology/vowl/rules/compatible/v1#` namespace as unsupported replacements. The candidate requires an IRI rule and uses the `ontology/profiles/vowl/compatible-view/v1` registry.                        |
| 6. Residual term shapes                    | Accept the need for exact portable shapes distinct from inspection terms. Do not adopt the proposed nullable fields, renamed graph branches or scalar normalization: those are not established by section 16 and could erase exact lexical distinctions or change candidate bytes.                                                     |
| 7. Ordering and validation precedence      | Explicit inheritance and a qualification-check precedence table would help independent implementation. Do not claim the proposed stage allocation is already entailed or qualified. Section 16 already calls all five collections sets; the missing detail is their exact integration with the extended decoder and semantic checks.   |

The next repair is a self-contained compatible-profile contract supplement that identifies every exact field, type, rule and RDF template, and explicitly frames the refinement signature.
Separate faithful transcription of the accepted candidate from genuinely new semantic choices; expose any conflict with earlier accepted prose for a decision before changing behavior.
Then an independent producer can consume specification-owned artifacts instead of learning expected bytes from production code.
No authority document, runtime implementation, expected corpus, configuration, commit or publication was changed by this follow-up.
No further independent run is authorized by its completion.

### Specification completion, 4 October 2026

The [compatible-artifact candidate contract](../specs/2026-10-04-canonical-vowl-compatible-artifact-contract.md) now supplies the portable grammar, primary mapping types, exact refinement framing, category issuance, semantic schedule and independent qualification handoff.
It leaves all evidence-pinned earlier authorities untouched and explicitly distinguishes portable fields from the nullable inspection representation.
The document transcribes the current candidate; it does not silently adopt the reviewer's new type names, nullability, language normalization or nested-array signatures.

The rule registry is enumerated, and its actual independent membership/detail-dimension checks are explicit.
Portable owning codes remain nonempty claims rather than a duplicated upstream code catalogue, except the three enumerated `scope` codes.
Stronger combinations, code rejection or authenticity guarantees would be policy changes, not already-established candidate behavior.
Qualification semantic checks retain their existing order after inherited structural/projection/state checks, without claiming a new placement in the original profiles' A7 schedule.

Validation completed for this documentation increment:

- The two focused compatible-artifact/refinement suites passed all 42 tests.
- `check-contract-framing.mjs` and `contract-framing-result.json` in the external preparation directory verify empty input, self-incidence and an empty-language literal against separately spelled signature calculations.
  Both nonempty probes take one round and two embedded-work units and distinguish encoded-string framing from nested-array framing.
  This is an implementer transcription check on toy refinement datasets, not independent whole-profile conformance evidence.
- Prettier and the authored-document semantic line check pass; the release report is checked explicitly despite the existing review-directory exclusion.

Runtime source, configuration and expected corpus bytes remain unchanged.
The earlier release input inventory describes the earlier source commit and does not yet include this new supplement.
A final freeze manifest must include the supplement's exact revision and the ensuing independent evidence.
The owner subsequently approved one twenty-minute file-read/text-output-only Antigravity producer-authoring pass, followed by separate local execution.
It completed in 186.2 seconds without command execution, file writes or a permission error.
The isolated clone's only added file was the implementer-supplied supplement; no tracked input changed.

### Independently authored compatible seeds

The returned producer passed syntax and effect inspection: Node built-ins and the two selected standards libraries only, with no production imports, process execution or network effects.
The integration worker executed it under a two-minute process limit and 512 MiB V8 heap ceiling, producing all three seeds and their typed-handle/set permutations successfully.
Expected sources, mapped data, canonical data, IDs and bytes were saved before the separate production comparison.
Production then agreed for all three originals, all three permutations and exact decoding of each expected artifact.

The compact [compatible corpus](../../packages/vowl/conformance/supplemental/compatible-artifact-v1/README.md) retains the portable producer and a three-row, 185,058-byte JSONL archive.
Only the producer's host-specific dependency-resolution base was changed for packaging; reproducing its complete outputs confirms the portable module retains these expectations.
The new regression suite passes seven tests, including producer reproduction, complete augmented RDF comparison and public canonicalization/decoding.
Raw derivation remains distinct from implementation-worker execution and production comparison.

| Seed                              | Canonical bytes | SHA-256                                                            |
| --------------------------------- | --------------: | ------------------------------------------------------------------ |
| `comprehensive-compatible-core`   |           4,726 | `3a89bb7b7a6502547a73609f93e74570da7d088a40e7a5f30326b93b813f8091` |
| `property-sub-super-pair`         |           1,313 | `1b8bd3b4fd1d8f8a97da1c436a566134ec1505e711a91a282f5fe675cfe6c5a9` |
| `minimal-empty-core-headers-none` |             827 | `c51539223347ae56585029a47a866b735e69f5cd5a48e03fa6cd5350e8759c5c` |

The provider's coverage claims were checked rather than accepted verbatim.
The seeds populate eight primary categories, not ten; expressions and constructs are empty.
They exercise all seven detail kinds and all four residual graph variants, but omit `rtl`, independent negative expectations and isolated field-distinction pairs.
The purported zero-blank-node case still has mapped primary and auxiliary blank nodes.
The corpus README preserves these corrections and limits use of the producer to the trusted seed domain.
Neither that metadata correction nor the successful seed agreement establishes complete-profile conformance or closes the freeze gate.

External evidence includes `antigravity-producer-assignment.txt`, `antigravity-producer.stdout.txt`, `antigravity-producer-receipt.json`, `independent-derivation-result.json` and `independent-production-comparison.json`.
The expected archive SHA-256 is `dfa2fe36ce32458973a6f92b9dd66c650f0f1b9f9b1455eb9230b7e5aef4319c`.
No automatic provider retry or new configuration setting was used.

### Repository verification after corpus integration

The governed `full` profile passed (`88878287-ad98-4d0d-b421-f1b1d8b2e4cc`), covering application formatting, lint and the production build.
The governed `affected` profile passed (`5768a2cc-678c-4302-a170-f2198a66230a`): all 9,126 tests in 166 suites passed.
The two formatting messages inside the test output are deliberate formatter-test fixtures, not failed repository checks.
The existing build chunk-size advisory remains; no configuration was changed to suppress it.
The selected new documents and regression test also passed their explicit formatting checks, and the authored-document semantic formatting check passed for 64 documents.
The final addition of this verification record changes only this review report; source, producer and expected-vector bytes remain those verified above.

This increment remains uncommitted and unpublished.
The owner-authorized independent pass is complete, with no further provider iteration authorized.
Resume qualification from the corpus README's explicit coverage gaps before proposing a complete-profile freeze; retain the raw producer output, derivation, comparison and verification receipts in the external evidence directory.

After the independent evidence is reconciled, prepare the exact freeze and publication proposal.
Keep production and legacy retirement unchanged until their own plan gates are met.

## Continued qualification, 4 October 2026

The owner clarified that completing an intermediate review or verification step is not a reason to stop otherwise authorized implementation.
Codex now supplies an independent gap oracle, a consolidated contract review and a release-gap audit.
The oracle does not read production source, generated schemas, tests or compatible expected vectors; its expectations are sealed before implementation comparison.
The source reviewer is a separate role and does not supply those expectations.
No further Antigravity run has been needed.

The consolidated contract review confirmed the mapping/refinement correspondence and found two documentation defects and one trusted-producer expansion defect.
Escaping union pipes restores the grammar tables' rendered columns without changing their fields.
Section 7 now explicitly describes complete field-by-field validation rather than implying global type and value passes across siblings.
The corrected authority SHA-256 is `ac54a81e89237b001a78daa24c469cc2dfe27e375f287bf0c951bf9bc21d3bca`; the earlier `9199710c479a28dc01708973390fd942e4459be9599f78aba003ac9cb652c527` remains the recorded authority for the historical Antigravity and first gap derivations.
The old producer's structural language-literal normalization branch is unreachable for the relevant discriminator descriptors.
Its three original seeds contain no such case and remain unchanged; expanded structural-language evidence requires a separately identified correction and independent witness, without changing residual language spelling.

### Standalone packed consumer

The exact experimental tarball `vowl-0.0.0-experimental.tgz`, SHA-256 `c12d43039d961a7061c231c77f65cafb8b5ac2c34103d6fc92c11f70ae93348e`, was installed outside the workspace with scripts disabled and without creating a consumer manifest or lockfile.
Node `v24.21.0` resolved all runtime imports from that fresh installation.
Its public consumer harness passed 859 positive cases, 855 source permutations, 3,235 rejection/boundary cases and the three compatible artifacts.
It also exercised compatible reopening/checkpoint readmission, OWL loading and retained Turtle export, named legacy migration, all three public entry points and rejection of an unexported private subpath.
The harness uses packaged corpus data and its storage reader for evidence; runtime operations use only the public exports.
Two harness defects were corrected before the passing run: the corpus directory was initially resolved one level too high, and the asynchronous checkpoint operation initially lacked `await`.
Neither was a package failure or an expected-output change.

Evidence is retained under `C:/Users/maksy/.hi/w/e/operator-reports/canonical-vowl-01a0f1b9/compatible-gap-20261004-01/standalone/` as the exact tarball, pack listing, install log, harness and `qualification.json`.
This qualifies that experimental artifact, not a later release version or the still-expanding corpus.
Repack and rerun affected acceptance against the final selected release artifact after its contents are fixed.

### Source identity and deployment scope

The release audit verified the Stanford publisher's `https://protege.stanford.edu/plugins/owl/dc/protege-dc.owl` response against the acquired example source: 11,430 bytes, SHA-256 `940b3992b2255d901e20839e930351b71bb10eef2f1d6550d54cefca28a67194`.
Its acquisition provenance is now established; the redistribution grant remains unestablished.
SIOC's publisher notice distinguishes documentation copyright from ontology terms and technology, so its scope must remain explicit in distribution notices.
The initial OntoViBe imported-module concern was subsequently resolved through its exact primary repository and repository-wide MIT grant, with no narrower exclusion.
The SIOC publication notice was also resolved using its explicit separation of ontology terms from accompanying documentation.
The final scoped notices and primary-source evidence supersede the earlier conservative withholding; only the Personas Stanford import retains an unestablished redistribution basis.
These are asset-specific publication conditions, not technical rendering failures or automatic blockers for a separately scoped package release.

The actual repository deployment route delegates to the sibling AWS uploader for bucket `haddenindustries-com-static-assets`, region `eu-west-1`, prefix `webvowl`, with deletion and CloudFront invalidation.
The earlier empty GitHub deployments response does not negate that controlled route.
Profile IRIs are under `/ontology/profiles/vowl`, outside that uploader's `/webvowl` scope; no application deployment or speculative hosting configuration change has been made.

### Completed compatible-extension evidence and final candidate

The [independent gap corpus](../../packages/vowl/conformance/supplemental/compatible-artifact-v2/README.md) adds 229 positives, 108 difference pairs, 69 active negative expectations and three refinement witnesses in aggregate files.
All 641 focused regression checks pass, including complete augmented-RDF and byte agreement, both structural language owners, separate label-range normalization, exact residual language, persistent symmetry, numeric issuance and synthetic self-incidence.
The source reviewer verified the independent overlay extraction, raw provenance hashes, counts, correction and evidence limits in a narrow follow-up and reported no remaining actionable finding.
The historical three-seed producer and archive are unchanged.

The one first-batch negative discrepancy was a fixture error: removing all occurrences left dangling placements, so the inherited reference check correctly preceded projection.
The independent correction preserves that original expectation and explains the corrected code, while a separate valid witness tests the intended projection precedence.
The first private-refinement comparison also needed a transport correction: N-Quads parsing omits the empty language property on typed literals, whereas the private RDF mapping contract supplies it.
After restoring that representation in the harness, all three independent refinement datasets agree.
No production behavior was altered to accommodate either issue.

The final standalone tarball SHA-256 is `b267a5fc6e3e8e436725aa779d0f5e5242e781f07e50f474be4a4f5344156176`.
Its fresh external consumer passes 859 inherited positives, 855 inherited permutations, 3,235 inherited rejection/boundary cases, 232 compatible positives and 69 added negatives, plus the public API/adapters/private-import rejection probes, in all three recorded timezone processes.
The three receipts are in `standalone-final/qualification-local.json`, `qualification-utc.json` and `qualification-los-angeles.json` under the continued evidence root.
They report actual runtime locale/timezone rather than inferring locale coverage from the requested environment alone.

The extracted-and-verified 1,826-entry freeze bundle and exact owner decision scope are in the linked proposal.
Neither its preparation nor source verification is an owner freeze, registry publication or deployment approval.
The owner's subsequent explicit freeze acceptance is recorded separately as `owner-freeze-acceptance.json`; it preserves the bundle and does not approve those later publication/deployment effects.
The final governed source checks are retained externally as `final-full.log` and `final-affected.log`; their recorded results and snapshot identities are authoritative.
This report is finalized before those runs so recording their receipts does not stale verification again.

The current changes remain uncommitted.
No configuration, runtime implementation, production deployment, existing corpus expectation, retained branch/worktree or unrelated `skills-lock.json` modification was changed.
The temporary isolated installations and archive readback directory remain retained by this implementation task for exact artifact reproduction and owner review; reassess them after freeze/publication disposition using the recoverable cleanup route.
