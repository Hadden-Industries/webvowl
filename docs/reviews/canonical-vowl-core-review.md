# Canonical VOWL experimental core review

This records development review of SLICE-001 and the core conformance work in SLICE-002.
It does not approve profile freeze, application cutover, immutable publication or completion of the eight-slice plan.

## First frozen candidate

The plain review clone used base `4f1970e5b6c95655af823c495bd58f9e9993f8b8` and staged tree `2b8d966340213aa94bfd24db981eee59ed74af96`.
Its 793-path exact-file manifest has SHA-256 `57aa1150437f29153609c168ecd2741a0dbb41df25e8490a40c66b0fd83a1486`.
The snapshot and raw external-review output are retained under the session's HISEW operator-report directory as `core-review-01` and sibling records.

The installed OpenAI Review Agent skill ran through a separately delegated agent.
The reviewer read all runtime modules and supporting tests/scripts/configuration, checked all frozen hashes and generated schemas, ran the 342-test suite, and reproduced six actionable defects through the public API.
No browser execution, security clearance or freeze approval was claimed.

| Finding                                                                                                          | Correction and regression evidence                                                                                                                                                                                               |
| ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cached expression keys bypassed expansion depth; a sufficiently deep leaf-first chain reached a raw stack error. | Store expression heights and enforce complete path depth on cache reuse and construction. Both source orders now reject with the bounded model error.                                                                            |
| Inserted semantic records were counted only as embedded edit payloads.                                           | Classify insert/replace `record` values as primary records during the safe snapshot, before allocation. Two inserted primaries reject at limit one and succeed at limit two; replacements share the same aggregate budget.       |
| Nominal identity merging could leave equal expressions and constructs.                                           | Intern normalization keys using deduplicated resolved sets, including recursively equal descendants; preserve sequence order and repetition. A nested expression merge now produces exactly the retained singleton constructors. |
| Generated signature/default roles did not suppress generic roles.                                                | Apply the same explicit alias and generic-role suppression when a required specific role is generated. Projection defaults and annotation signatures have separate regression cases.                                             |
| Merged target sets lost occurrence correspondence.                                                               | Compare generation-key sets after semantic aliases resolve. The retained merged glyph now receives correspondence instead of being reported as new.                                                                              |
| Projection incompleteness could precede missing normalized defaults.                                             | Resolve required property defaults before generating ordinary nodes. Missing-default normalization errors now precede projection errors regardless of supplied node count.                                                       |

The nine regression cases first produced seven behavioral failures and two passing comparison cases, then all passed after correction.
The complete focused suite subsequently passed 351 tests in ten suites, and the authored package JavaScript passed ESLint.
These repairs have not been silently applied to the first frozen review copy.

The bounded second review checked staged tree `52cceb2659f1949b834779420c7ccaf839af07fa`, verified all 795 manifest hashes and reran the 351 tests.
It confirmed five original fixes and the bounded Ajv envelope allocation, but found a remaining default-role ordering case: an explicit generic `owl:Thing` domain became stale when the missing range generated its specific class role.
The corresponding explicit-range case succeeded, demonstrating order dependence.
Two additional public regressions captured both directions; the domain case first failed with `REFERENCE_DANGLING`.
The correction completes required defaults before class groups or endpoint partitions capture identities, using the same drawability/default policy as ordinary projection.
Moving that normalization earlier also exposed shared generated target/context arrays during ID rewriting.
Each generated edit occurrence now takes an owned, budgeted value snapshot before admission; both endpoint cases pass exact encode/decode round trips.
The corrected focused suite passes 353 tests in ten suites, and ESLint passes.

The final bounded ordinary review used tree `28d82fad6b0d3dacb5f0193cd8bd306203a96a7b` and manifest SHA-256 `720177521b5060a5cf973013d0fb0e1c802db6a3f861f1e0f1a5ad959041af34`.
It verified all 795 frozen file hashes and passed 118 affected tests.
Independent public probes confirmed both explicit endpoint directions, identical bytes across two-property insertion orders, no shared result containers, a generated-record primary boundary of 7 and an embedded-value boundary of 24.
The reviewer returned no findings and closed the remaining ordinary-review defect, without claiming browser, security or freeze acceptance.

## Conditional topology expansion

The independent producer subsequently added 82 positive topology cases and 30 negative cases without changing the prior 95 positive expectations.
Two new negatives exposed duplicate occurrence generation keys being rejected as `PROJECTION_INVALID` instead of A7's earlier structural-uniqueness error, `RECORD_DUPLICATE`.
The core now checks valid occurrence generation keys at the structural-uniqueness stage.
Malformed occurrence topology remains deferred to projection validation, preserving precedence of missing signature/default normalization checks.
The expanded public suite passes 545 tests in ten suites, including both independently authored regressions and malformed edge/label precedence controls; ESLint passes.
This correction postdates the third frozen review candidate and was assessed by the bounded review below.

The bounded fourth ordinary review used staged tree `998264bd10db23cd9149bd74fc8430feeb77998c` and manifest SHA-256 `bd20ee99e10d83717c9a084c7136d85532b1b11765159750d3a320dede90dcea`.
All 1,336 frozen file hashes matched, and 486 affected tests passed across conformance, editing and review-regression suites.
Independent public probes confirmed duplicate node/edge/label keys, equivalent endpoint-key duplicates, resource-limit precedence and a cycle of 2,000 malformed labels without recursive failure.
The worker message handler also passed 181 checks when invoked under Node; that reviewer did not claim browser execution.
The reviewer returned no findings for the production and runner delta.
The oracle's final README/report wording landed after its first writer-stop signal and differs from the fourth clone; the frozen clone was preserved, and this documentation delta is not silently included in that review verdict.
All runtime, test, manifest and expected-fixture bytes remained unchanged by that final wording update.

The first aggregate repository check found one architecture-test conflict: its blanket workspace prohibition rejected the approved `packages/vowl` workspace, while the other 2,401 tests passed.
The corrected assertion permits exactly that workspace, verifies its package name is `vowl`, and retains the pinned external OWLAPI dependency, lock, installed identity/export, import and resolver guards.
The independent ordinary reviewer checked exact delta SHA-256 `f7b3448a9d5508a7dfbb75a7275ec85c09dedb440405e960b1c5f784ba1bece5`, confirmed the source hash and passed all 22 affected tests with no findings.
This changes an architecture test, not application behavior.
The subsequent complete `npm run check` passed: 132 Jest suites / 2,402 tests, Python setup tests (30, one skipped), 16 prose tests, repository lint/format checks and the production application bundle.
The additional governed `full` profile remains a separate required receipt; it runs `npm run build` with its configured prerequisites.

## Independent verifier and security status

Claude Code 2.1.285, using its configured Claude Opus 5.5 provider, was assigned the complete frozen candidate in the plain clone with read-only tools and bounded test-command permission.
That run reached the account session limit before returning a review report (`is_error:true`, 40 turns, 403951 ms).
Its result is unavailable verification, not a clean review or independent execution receipt.
Two command-permission denials are retained in the raw result; no permissions were bypassed.

Native Codex Security scan `2db3179d-e798-4749-af8f-579c1fd06b50` recorded snapshot `codex-security-snapshot/v1:sha256:c57a7ffcebb0ad039ee179cfe075c7cf62df98c7af9325483f3e733933beba7f`.
Its capability preflight passed three checks without settings changes.
The independent agent accounted for all 793 changed files and completed detailed runtime-source inspection, but a cybersecurity content check interrupted validation.
The preserved scan initially contained three discovery candidates and no validated findings or final report.
The two resource-counter candidates overlap the independently reproduced ordinary-review defects above.
The third candidate identified repeated allocation of root schema descriptors retained by Ajv's strong compilation cache; the implementation now reuses the four fixed profile/source envelope descriptors.
This cache correction is based on the recorded source trace; no runtime memory measurement was produced by the interrupted scan.
Subsequent assessment must retain these limitations and distinguish the original candidate from the corrected source.
The authorized static-only continuation sealed the report at `2026-09-30T11:27:11.458430Z`, with zero promoted findings and three deferred candidates.
Coverage remains partial: no runtime cache measurement or material host-availability consequence was established, and this scan did not verify the subsequent live repairs.
The sealed `coverage.json` has SHA-256 `618ddd8eb0808f9ce921e1bf02a97410b3f19ef3e3e5b97338eb7150141c9807`.
This is a retained partial security assessment, not a clean security verdict.
The same security reviewer subsequently performed a bounded static-only assessment of the corrected third candidate.
It found the three recorded source-level causes addressed and confirmed the generated occurrence snapshot's ownership and budget path in source.
It did not execute target code, validate runtime impact or replace the sealed scan's original deferrals.

Antigravity CLI 1.2.14 was also selected as the independent verifier while Claude remained quota-limited.
An initial attempt could not read its assignment outside the bound clone; a bounded native read inside the clone succeeded.
A subsequent full assignment encountered a native `read_file` permission denial and returned no report.
These attempts are unavailable verification; native permissions were retained, and no persistent permission settings were changed.

A later static-only continuation returned a report for the third candidate, identifying its provider as Gemini 3.8 Flash (High).
It lists all 14 runtime modules as read, partially reads five test suites, and explicitly reports no command or test execution.
Its statement that snapshots prevent Proxy side effects is incorrect: A7 expressly excludes hostile Proxy sandboxing, and JavaScript reflection can invoke Proxy traps.
Its claim of conformance to all four specifications is also unsupported by its own read inventory, which contains the plan and amendments but not those four normative texts.
The original report is preserved as external input; those overclaims are rejected, and it does not satisfy the independent verification gate.

A fresh static-only Antigravity run assessed candidate four and correctly described the hostile-Proxy limitation.
Its report is also retained as external input rather than verification evidence: it labels a nonexistent `validateMeaning.js` file (the linked function is in `validateGraph.js`), attributes 76 rows to the original 70-row projection matrix, and claims that the inspected editing test proves state-dependent RDFC relabeling although that test checks unchanged structural editing and artifact correspondence.
Its own inventory describes incomplete specification/test reads, so the broad line-by-line and acceptance-criterion conformance claims are not adopted.
No commands or tests were executed by that verifier.

The report's malformed-occurrence duplicate concern received a separate bounded ordinary protocol review and six public-API probes in the unchanged fourth candidate.
An edge generation key requires endpoint node generation keys under A5/B1; malformed non-node endpoints supply none, so two such payloads with distinct IDs do not establish a Stage 5 generation-key duplicate.
The matched valid-endpoint case returns `RECORD_DUPLICATE`; the malformed case returns `PROJECTION_INVALID` as expected.
Adding a syntactic fallback would introduce an occurrence-identity rule absent from the contract, so no code change is justified.
The other external observations concern already planned adapter exports, the explicit Proxy boundary and hypothetical future changes to the exactly pinned RDFC dependency's error message.
They do not establish another current core defect or justify broadening the dependency-error match.
The independent verifier gate remains incomplete; the unavailable and rejected runs are not a clean review.

## Standalone qualification

The first candidate packed as `vowl-0.0.0-experimental.tgz`, 331125 bytes, SHA-1 `f76e5e1549b9c015c83a0721a11e7db70ee1b8ae`, containing 769 files.
A consumer installed that exact tarball with lifecycle scripts disabled and passed all 95 independent positive source/decoder checks, atomic editing, private-path rejection, absence of unimplemented adapter exports, and schema/license/notice presence.
Its explicit consumer prefix is the retained `standalone-core` directory, outside the product checkout.
An initial probe lacked its own package manifest and npm selected the home-directory prefix; the added `vowl` dependency and its 15 installed packages were removed, the newly created empty dependency directory was removed, and the existing home manifests were preserved with no dependency entries.
Only the subsequently bounded consumer run counts as standalone evidence.
The packed candidate predates the review repairs and must be replaced for final qualification.

The third frozen candidate was subsequently packed and installed into a new explicitly bounded consumer with its own manifest before installation.
Its tarball is 331963 bytes with SHA-256 `090e69eab95b0c6eb75268155181ddddcd6b66a0957b2fb5f842822fbe8f0b89`, containing 769 files.
The 95 independent source/decoder vectors, ordinary editing, both repaired endpoint directions, export-boundary rejection and schema/notice checks passed on Node 24.21.0 and the available supplemental Node 24.19.0 runtime, each under UTC, Europe/Bucharest and America/Los_Angeles.
The six runs observed `en-GB` in every case: Windows Node ignored the requested `LANG`/`LC_ALL` locales, so these runs establish runtime/timezone variation, not locale variation.
The initial extra endpoint assertion incorrectly compared JavaScript object prototypes; replacing it with the protocol's exact encoded-byte comparison corrected the probe without changing package code.
Actual Chrome 154 on Windows also passed all 95 corpus cases, atomic editing and in-flight cancellation (97/97, 265.8 ms), with no observed console warnings or errors after rebuilding the third candidate.

After the conditional expansion and structural-uniqueness correction, the rebuilt actual Chrome worker passed 181 checks: 177 positive vectors, atomic editing, two endpoint-promotion regressions and in-flight cancellation.
The observed run took 505.4 ms, reported `en-US` and `Europe/Bucharest`, and produced no console warnings or errors.
Chrome's observed `en-US` and Node's observed `en-GB` establish actual default-locale variation across those runtime environments.
This does not establish a second browser engine, Linux qualification or application responsiveness.
The third-candidate tarball remains evidence only for that earlier revision; final standalone qualification must use the expanded candidate.

The current expanded package was packed from the live task-owned source after oracle writers stopped, with runtime and fixture bytes matching candidate four and the final corpus README included.
The tarball contains 1,310 files, is 566,555 bytes, and has SHA-256 `e49d75ec644ac82485405428b8fdc0bf06be129020f2dc5ccc19578628a500b2`.
A fresh consumer with its own manifest was created before installation; the explicit npm prefix was verified as the retained `standalone-core-04` directory.
All 177 exact source/decoder vectors, 166 structural no-op edits, atomic insertion, both endpoint regressions, private/undelivered export rejection and schema/license/notice checks passed on Node 24.21.0 and 24.19.0 under UTC, Europe/Bucharest and America/Los_Angeles.
All six runs reported actual locale `en-GB`; their JSON records are retained with the installed probe and pack metadata.

Final governed verification, independent verifier completion, security disposition of the corrected candidate and owner acceptance remain pending.

## Fifth-candidate admission and editing corrections

The subsequent bounded review identified two further defects, corrected on the live experimental candidate after preserving the fifth review snapshot.

- Insert freshness previously inspected only currently present semantic records.
  Removing and reinserting a handle, changing its category, or reusing an occurrence handle could evade the edit boundary.
  The operation now reserves every handle in the five original collections and every inserted handle for the complete atomic batch, even after removal.
  The independent frozen editing cases first demonstrated two incorrectly accepted requests and one wrong error stage; all now reject with `EDIT_INVALID` while their positive byte and correspondence controls pass.
- A prototype imitation passed `instanceof AbortSignal` and leaked a native `TypeError`; real signals could also supply own getters or listener methods that the operation executed.
  Admission now validates the receiver through the native `aborted` getter and subscribes through the captured native EventTarget methods.
  This uses the platform's [signal state](https://dom.spec.whatwg.org/#interface-abortsignal) and [interface receiver checks](https://webidl.spec.whatwg.org/#es-attributes), without evaluating caller-owned members.
  Six public regressions failed before correction and all 18 resource tests passed afterward, including in-flight cancellation and already-aborted controls.
  The explicit hostile-Proxy non-sandbox guarantee remains unchanged.

The first combined focused check passed 252 tests in five suites, including the independent editing corpus, ordinary editing, three-edit feasibility, prior review regressions and resource admission.
Expanded corpus integration and a fresh independent assessment remain separate work; these focused results do not declare profile freeze, complete security qualification or application adoption.

The independent v2 corpus runner integration then exercised all 859 complete byte and RDF vectors, 321 distinct pairs, 343 field bindings, 3,235 active rejection/boundary cases, 734 structural no-op edits and the frozen edit/auditor controls.
It preserves the distinction between 219 isolated and 124 coupled field bindings; this is not a mathematical injectivity proof.
The two invalid prefix-name vectors exposed a closed-grammar error reported as `NORMALIZATION_INVALID`.
Prefix leaves now use their existing generated JSON Schema pattern and report `DOCUMENT_TYPE`, as the unchanged independent vectors require.
The four expanded suites passed all 6,375 cases after that correction and verified all 8,010 frozen pins.
No expected bytes or errors were rewritten.

The complete `npm run test:vowl` run then passed all 6,667 tests in 13 suites (30.445 seconds).
Scoped lint and formatting checks passed for the corrected runtime and new runner files.
This result qualifies the local core candidate; the fresh independent review and adapter/application qualification remain open.

## Sixth-candidate independent review and live corrections

Claude Opus 5.5, through Claude Code 2.1.285, completed the frozen sixth candidate's static review with Read/Glob/Grep only.
The mechanical receipt verified complete returned coverage of all 49 required files (15,775 lines), including the nine authority documents and all 14 runtime modules.
All 8,717 snapshot file hashes remained unchanged.
Snapshot tree: `bbe40b13b31d7213b5fa8fc0d1f3562ceb1ed197`; manifest SHA-256: `a4adddf4f91e322e4c6b49ccc1cc47980d487bc200fccf92825af756d1844337`.
The native report SHA-256 is `0e638116ff60437ddfce46a2646fb3ad80df0b8afd02de92c4fa14914a28cdf2`.
This was a completed source review, not execution or a clean whole-core verdict.

The report and independent public probes led to these live corrections:

- A removed duplicate's handle could be reused by a generated endpoint intersection.
  Its retained alias then redirected the intersection to an unrelated role or subject.
  Normalization now reserves every original handle before deduplication and also excludes alias names from allocation.
  Two public regressions first reproduced rejection or silently changed meaning, then passed with the exact intended two-member intersection and control bytes.
- Generic-role and annotation/datatype signature lookup repeatedly scanned the whole collection without observing cancellation.
  Independent bounded probes confirmed 1,000,000 predicates for 1,000 roles, including 999,900 after a real abort.
  Per-subject role and subject-identity indexes now replace those scans; signature promotions rewrite the model once.
  Traversal loops check the shared operation budget, and multiple endpoint aggregates reuse their validated source graph.
  Paired public probes against frozen and live code preserve all three tested semantic byte hashes; cancellation continues for zero or two indexed visits in the repaired cases, versus 65,436 or 49,340 scan visits in the frozen controls.
- Duplicate prefix names with different namespace values now report the B4 artifact invariant as `ARTIFACT_INCOMPLETE`.
  Hidden-incidence checks precede placement completeness within Stage 7.
  Option values, including nested limit names, are validated in unsigned UTF-16 order before timer/listener allocation.
  The independent protocol reviewer resolved these from existing A7/B4 authority; no policy amendment was needed. Five new regressions first failed, then the affected conformance/resource/review suites passed all 4,131 tests.

The native report's early-timer theory remains unconfirmed: bounded Windows Node 24 probes did not reproduce `DEPENDENCY_FAILURE`, and the proposed stale libuv-time premise was not supported.
The dependency's abort-error branch was not exercised by those controls; this is an explicit coverage limit, not proof that every runtime timing path is correct.
No speculative timer repair was made.
The `__proto__` concern is closed for installed `@streamparser/json` 0.0.26: source inspection and both primitive/object public decode controls confirmed `DOCUMENT_UNKNOWN_FIELD`, with unchanged dependency/runtime hashes.

The native report, complete-read audit and bounded triage are retained under `C:/Users/maksy/.hi/w/e/operator-reports/canonical-vowl-01a0f1b9/` in `webvowl-claude-core-review-06-20260930-01` and `webvowl-claude06-triage-20260930-01`.
The latter receipt SHA-256 is `29a8e000d0235ee400fa1a2232ad5f43f69a5cfc77eae4e60d73bb497d9eefee`.
The static report's preflight `git write-tree` metadata effect is disclosed in its receipt; no source mutation is attributed to that reviewer.
These live repairs and the subsequent OWL adapter are outside the preserved sixth snapshot.
Final frozen-candidate, standalone/browser, governed full-profile and owner gate evidence remain separate requirements.
