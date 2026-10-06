# Ontology loading regression repair: WebVOWL

**Status:** Draft HISEW implementation plan, updated and split on 5 October 2026.
**Decision owner:** Maksym Shostak.
**Scope:** Part 1, implemented entirely in this repository, including its owned `packages/vowl` adapter.
**Companion:** [Deferred OwlAPI performance and default-behavior repair](https://github.com/Hadden-Industries/owlapi/blob/main/docs/plans/2026-10-05-profile-performance-and-default-behavior-repair-plan.md).
The companion is saved locally in `C:\Users\maksy\GitHub\owlapi\docs\plans`; its GitHub link is a publication destination, not evidence that this draft has been published.

The owner requested restoration of ontology loading after the Canonical VOWL crossover, then selected a split that permits WebVOWL repair before OwlAPI repair.
This document replaces the combined loading-regression proposal discussed in this chat.
It supplements the [existing example compatibility repair plan](2026-10-02-canonical-vowl-compatibility-repair-plan.md), preserving that plan's historical scope, decisions and evidence budgets.
Documentation authority does not authorize implementation, configuration edits, workflow execution adoption, commits, publication or deployment.

## Purpose, route and ownership

Restore successful loading and automatic syntax recognition for ordinary ontologies previously viewable in WebVOWL, with truthful failures, responsive cancellation and atomic scene installation.
WebVOWL owns acquisition, user interaction, operation budgets and rendering; its VOWL adapter owns admission, source retention and operation-specific guarantees.
The installed OwlAPI owns parsing, format detection and profile assessment through its existing public APIs.
There is no dependency on completing or adopting Part 2.

Reuse the existing R2 Canonical VOWL corrective route: format/base identity, worker resource controls and retained source evidence affect accepted ontology meaning and application state.
HISEW inspection on 5 October confirmed active personal applicability for both repositories.
This planning update creates no execution and does not adopt or resume a historical execution recorded in another document.
At implementation admission, recheck the selected worktree, current route, exact source and dependency identities, and existing review obligations.
Workflow runs and reviews use the configured external evidence root `C:\Users\maksy\.hi\w\e`, resolved again before the first execution artifact; these plans are product-owned documentation.

## Inspected baseline and evidence limits

| Item                       | Observed identity or result                                                                    | Meaning                                                                                     |
| -------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| WebVOWL source             | `f7372f9b8b93a2bf337fe0125fec8fd7e3454143`                                                     | Planning checkout; preserve unrelated `skills-lock.json` changes.                           |
| Installed dependency       | `owlapi` is the native npm alias for `@hadden-industries/owlapi@0.1.0-rc.1`.                   | Leave the dependency declarations, lock graph and installed package unchanged.              |
| Reproduction               | `C:\Users\maksy\GitHub\universal-ontology\dist\universal\core\20260912-full`, 1,918,821 bytes  | Extensionless RDF/XML, with no `xml:base` or `owl:imports`; local source remains read-only. |
| Reproduction SHA-256       | `79f794425b79d59d6ff162404c818034ae8de88efd3b6fd800a48d0e7add9f9d`                             | Check before reuse; bind evidence to these exact bytes.                                     |
| Actual browser failure     | Approximately 10.66 seconds; repeated `LOAD_FAILED` / `RESOURCE_LIMIT_EXCEEDED`                | Reproduces the current default worker deadline failure.                                     |
| Native automatic detection | Public loader with no format or content type selected `rdfxml` in 2.42 seconds in Node.        | Existing API suffices; no new OwlAPI detector export is required.                           |
| Larger-budget diagnostic   | Full opening operation completed in approximately 30 seconds in Node under a 60-second budget. | Feasibility evidence only; browser acceptance and a production budget remain unqualified.   |

The native detection probe used the original absolute document IRI `https://haddenindustries.com/ontology/universal/core/20260912` and compatible parsing.
This result does not establish automatic discovery of a document's original IRI, full browser performance, or general Java behavioral parity.
The costly assessment remains a library defect deferred to Part 2; a larger WebVOWL opening budget restores availability without claiming to repair that cost.

## Scope and invariants

The repair covers local extensionless OWL input, the shared acquisition/adapter path, opening budget propagation, useful failure presentation and directly affected regressions.
Remote roots and imports exercise the same public format-selection boundary where applicable.
Preserve explicit format overrides, cancellation, the current compatible interpretation, source bytes, parser metadata, profile/source assessment, retained-model qualification, canonical identity and operation-specific editing/export rules.
Failure, cancellation and superseded requests must leave the last accepted document and scene intact.

Do not patch `node_modules`, vendor an OwlAPI fork, import package internals, replace global timers, reproduce OWL syntax detection, skip assessment, or add a fallback converter.
Do not globally weaken parsing, import/network policy, size/depth/work limits, canonicalization limits or poison-input controls.
No new dependency, package declaration, lockfile, test/CI configuration or repository-policy edit is included.
Any exact configuration edit discovered during implementation needs the owner's separate approval before mutation.

## Requirements and measurable acceptance

The following draft identifiers are local to this supplement; references to the parent use its unchanged REQ/AC/QA identifiers.
They describe planned evidence and are not an accepted engine requirement snapshot.

| Requirement                                    | Acceptance criterion                                                                                                                                                                                                                         | Parent relationship |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| WV-REQ-001: Native syntax selection            | WV-AC-001: The exact extensionless reproduction opens without a format-selection interaction, and the selected owning format is `rdfxml`. An explicit user override remains effective.                                                       | REQ/AC-007, 009     |
| WV-REQ-002: Adequate opening budget            | WV-AC-002: On a recorded supported reference browser/device, five consecutive foreground cold-worker loads complete and install complete scenes within the selected finite opening budget. Record each elapsed time and the stage breakdown. | REQ/AC-006, 007     |
| WV-REQ-003: Meaning and evidence preservation  | WV-AC-003: Explicit-format and automatic-format paths retain equivalent ontologies, source bytes, metadata, material qualifications and supported operation results under identical import availability and budget.                          | REQ/AC-009, 011     |
| WV-REQ-004: Actionable failure                 | WV-AC-004: Each failure produces one primary user-facing outcome with a useful reason; deadline, size/depth exhaustion, invalid syntax and cancellation are distinguished internally and where useful to the user.                           | REQ/AC-006, 011     |
| WV-REQ-005: Cancellation and atomic acceptance | WV-AC-005: User cancellation and hard expiry terminate the worker within one second in the foreground reference browser. Late/superseded results install no document or partial scene.                                                       | REQ/AC-006, 007     |
| WV-REQ-006: Independent delivery               | WV-AC-006: All repair acceptance passes against the unchanged installed RC.1 identity, with no dependency patch, private import or required Part 2 artifact.                                                                                 | REQ/AC-007, 009     |

WV-QA-001: A user opens the pinned ordinary ontology in the reference browser; the full scene is accepted within the measured opening budget and the UI remains usable for cancellation.
WV-QA-002: While assessment is pending, a user cancels or opens another file; the abandoned worker terminates within WV-AC-005 and cannot replace the accepted scene.
WV-QA-003: A malformed or resource-exhausting input reaches the owning boundary; it fails within the explicit budget with one useful outcome and unchanged application state.

WV-DEC-001 selects the current public OwlAPI loader for automatic detection, with the resulting format read through `manager.getOntologyFormat(ontology)`.
WV-DEC-002 selects an opening-specific finite application budget passed consistently to the worker and VOWL/OwlAPI operations.
Use 60,000 ms as the first measurement candidate, within the existing 300,000 ms ceiling; this is a hypothesis, not an approved production setting or promise that 60 seconds is sufficient.
Keep unrelated operation defaults unchanged.
If measured runs do not fit with documented headroom, return a decision packet rather than repeatedly increasing the limit to its ceiling.
WV-DEC-003 retains all assessment and source-evidence obligations.

## Vertical slices, dependencies and proof

Likely files below are architectural predictions, not a closed implementation manifest.

| Slice        | Complete observable outcome and likely seam                                                                                                                                                                                                                            | Traceability and falsifiable proof                                                                                                                                                                  | Delivery and recovery                                                                                                                                                                                                                  |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| WV-SLICE-001 | The explicit-format reproduction loads through the existing worker with a measured opening budget. Likely seams: `canonicalVowlWorkerClient.js`, `canonicalVowlWorkerOperations.js`, `packages/vowl/src/resourceBudget.js` and the OWL loading/assessment adapters.    | WV-REQ/AC-002, 005, 006; WV-QA-001, 002; WV-DEC-002, 003. Verify outer-watchdog and inner-budget agreement, stage timings, real browser completion, cancellation and forced expiry.                 | First restore availability without requiring format changes. Prefer existing per-request limit overrides; stop at any required public-contract amendment.                                                                              |
| WV-SLICE-002 | The same bytes open without a format prompt, using native parsing once and retaining its actual format. Likely seams: `canonicalInputSelection.js`, `canonicalVowlSourceAcquisition.js`, worker input and `packages/vowl/src/owl/loading.js` / `compatibleLoading.js`. | WV-REQ/AC-001, 003, 006; WV-DEC-001, 003. Compare explicit and automatic paths, extensionless/misleading-extension cases, cancellation, invalid syntax, native format metadata and source evidence. | Depends on the baseline and budget proof from slice 1. Optional/automatic format context must be propagated through every affected WebVOWL/VOWL boundary; update the exact owned contract before changing a required media-type field. |
| WV-SLICE-003 | Expiry or malformed input produces one useful primary failure while the existing scene remains accepted. Likely seams: worker error translation and controller/UI failure presentation.                                                                                | WV-REQ/AC-004, 005; WV-QA-002, 003. Inject distinct failures at acquisition, parsing, assessment and transport boundaries; assert one outcome, useful classification and no stale/partial state.    | Integrates slices 1 and 2. Preserve detailed causes for inspection; source text and raw stacks are not required in user-facing errors.                                                                                                 |
| WV-SLICE-004 | A consolidated unchanged-RC.1 candidate passes the exact reproduction and affected input/operation regressions in browsers.                                                                                                                                            | All WV criteria; parent REQ/AC-006, 007, 009, 011. Record exact candidate/dependency bytes, browser/device, times, scenes, diagnostics and relevant export/edit/reload results.                     | Independent completion boundary for Part 1; Part 2 is non-blocking. Commit, publication and application cutover remain separately authorized.                                                                                          |

The native loader must perform syntax interpretation and import traversal.
Read acquired bytes before demanding syntax selection; use existing public validators for canonical/legacy JSON routing and preserve the supported legacy dialect boundary.
An automatic OWL route must not accidentally reinterpret JSON as an ontology or silently relax canonical/legacy validation.
Keep a manual format choice for genuinely unresolved selection; malformed syntax must retain its owning syntax error rather than trigger an endless selection loop.
Use the existing parsed closure and format metadata for retention/admission; a detect-by-full-parse followed by a second full parse is not the selected design.

Format recognition and document identity are separate.
Preserve the original supplied document IRI, declared base, relative-name resolution and import context.
Do not infer an original document address from the ontology's name, filename, local fixture path or arbitrary ontology IRI.
Where document context is still required, explain that need separately from format selection; this plan does not promise that every local file needs no interaction.

## Test ownership and verification

WebVOWL owns browser behavior, worker expiry, acquisition, complete scenes and error presentation; VOWL owns its ingress contract, retention and admission tests.
OwlAPI remains the semantic oracle for native detection/parsing through its public API.
Compare automatic and explicit parsing against independently specified expected source/model facts, not an implementation-derived detector table.
The live TIB WebVOWL result is useful corroboration, not an immutable offline oracle; pin a legacy implementation and matched source/import identity before claiming general legacy equivalence.

Mock only external acquisition and controlled failure boundaries.
Use the real installed parser/profile implementation for the reproduction and consumer acceptance.
Reuse existing worker, acquisition, adapter and representative ontology suites, including canonical/legacy JSON, explicit formats, remote metadata, imported relative IRIs, malformed and bounded poison inputs.
Preserve the six-example repair corpus as an affected regression baseline; this supplement does not restart its completed work or expand its claims automatically.
Do not copy the local UO file into fixtures until provenance and redistribution rights are established; local exact-byte diagnosis remains permissible.

Focused candidates include the existing worker, source-acquisition, local input-selection and `packages/vowl` suites, run with the repository's current `npm test -- --runInBand` path selection.
After consolidation run affected adapter/conformance suites, then the route-selected final checks, including the current HISEW `full` profile and real browser acceptance.
Resolve the actual profile commands at execution admission; a profile name is not evidence of corpus/browser coverage.
For this documentation task, run scoped Markdown formatting/checks and link validation only; do not claim runtime acceptance.
Carry forward existing bounded diagnostic/review obligations and remaining allowance; this split replenishes none and authorizes no new delegation or scan.

## Integration, observability and recovery

No canonical artifact schema, byte identity, source migration or backfill is selected.
The optional-format ingress design must inventory callers, import responses, worker envelopes and retained source contexts before changing their owned contracts.
Old explicit-format calls and saved artifacts must remain readable and semantically equivalent.
Resumption binds new evidence to the current candidate and reproduction digest; stale results and prior execution receipts cannot establish new acceptance.

Record acquisition, parse, assessment, retention/checkpoint and scene-install times separately, selected format, effective budgets, the exhausted resource and cancellation outcome.
No external telemetry or source upload is required; exercise actual hostile-input controls rather than substituting logging for them.
Native parser validation retains responsibility for document content; WebVOWL retains worker/process isolation and application acceptance.

An unaccepted in-memory candidate can be discarded without replacing the last accepted document.
Releasing a corrective source change follows the existing separately authorized delivery route; keep the prior build/artifact and its exact identity available.
After publication, recovery may use the retained compatible build or a forward fix, subject to verified artifact compatibility and owner authorization; never overwrite evidence or source files.
The implementation handoff must name the person accepting the browser measurements and cutover outcome; no release observer is assigned by this planning edit.

## Unknowns and replanning triggers

The cheapest discriminating experiment is the exact explicit-format browser load under the candidate budget, followed by native automatic loading of the same bytes through the adapter.
Remaining unknowns are supported-browser timings, checkpoint/retention overhead, misleading metadata behavior and the precise owned ingress contract amendment.
Return to the owner if a public OwlAPI change is necessary, native loading cannot supply usable format metadata, reliable completion requires a budget beyond the accepted envelope, assessment must be skipped, source/base semantics change, or canonical bytes/schema/operation guarantees change.
Any proposal to restore fast assessment through a dependency patch belongs to Part 2 and must not silently make this consumer repair depend on it.

After a separately qualified future OwlAPI adoption, remeasure the opening path and review whether the larger application budget is still appropriate.
That reassessment is a consumer decision, not an OwlAPI release prerequisite.
