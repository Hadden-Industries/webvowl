# WebVOWL architecture implementation plan

> **Status:** Approved plan; revision 3 records implementation and delivery authorization on 21 October 2026; documentation checkpoint precedes source implementation.
> **Sequence:** Plan 1 of 3: architecture → performance → UI.
> **Basis:** [Architecture assessment](../reviews/20261020-architecture-assessment.md), especially sections 10, 11 and 18.
> **Method:** HISEW implementation planning, with the accepted change dossier, R2 risk classification, quality scenarios and decisions kept in this document.
> **Purpose:** Reduce the cost and regression risk of changing visualization operations while preserving document integrity, human/agent parity and the existing macro-architecture.

## 1. Authority, baseline and delivery order

The owner requested these three implementation plans on 21 October 2026 and subsequently approved the architecture plan after the decision walkthrough.
The approval covers draft revision 1, its R2 risk classification and the recommended choices in DEC-008/009.
Revision 2 records that approval without expanding the implementation scope.
Plan acceptance is complete; the subsequent owner instruction authorizes implementation and delivery under the checkpoints below.
The architecture review separately records accepted owner decisions Q1–Q5 and R4 on 20 October 2026.
Those decisions are retained below and must not be reopened implicitly.

### Authorized delivery checkpoints

On 21 October 2026, the owner authorized a new branch for all three plans, a documentation-only first commit, and implementation of architecture followed by performance.
The branch is `feat/architecture-performance-ui`; publish authorized commits to that branch on `origin`.
Commit-message selection, commits, pushes and configuration changes required by the approved architecture/performance plans are pre-authorized.
Keep unrelated configuration or scope changes outside this authority.
For each implementation plan, consolidate changes before broad review and scope follow-up reviews to the findings and changed code.
Run the full required tests, resolve their issues, and only then obtain the final external review using Claude Opus 5.5 at Max with a 60-minute limit and no additional turn, token, cost or other budget limits.
Reserve external review for the final commit candidate of each plan; retain its exact reviewed content and recheck any subsequent fixes.
Revisit UI acceptance and its open decisions with the owner only after both approved implementations are complete.

| Baseline item               | Recorded identity                                                                                                                                 |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Planning checkout           | `C:/Users/maksy/GitHub/webvowl`, branch `main`                                                                                                    |
| Planning HEAD               | `37fd52759f231d3c1b4794f15b5c599f717b0ddc`                                                                                                        |
| Review's source HEAD        | `62961414530e141f8f79ec369afee2d68b9036a6`                                                                                                        |
| Architecture review SHA-256 | `4368c2a848570154eb293229dcba20fb0e3bbf6849c8f6d5ac2ef639dcc01239`                                                                                |
| Planning lockfile SHA-256   | `6c137dc6f69bfb4f70cc5db0ef4d7997fd76a1fc3544d33605612a733c49c458`                                                                                |
| Starting working tree       | Clean before creating the three plan files                                                                                                        |
| Source reconciliation       | No differences from the review source HEAD under `src/`, `packages/`, `util/` or `docs/adr/`; `package.json` and `package-lock.json` have changed |
| HISEW inspection            | Personal workflow active; native profile inspection reports `risk-route-not-selected`                                                             |

Source comparisons and targeted reads confirm that the legacy runtime declarations, repeated lifecycle guards, copying inspection reader and search-menu state described by the review remain present.
Review line numbers describe that historical source; new module names below are predictions, never promised line numbers.

Implement in this strict order:

1. This plan: PR-A → PR-B → PR-C → PR-D → PR-E.
2. [Performance implementation plan](2026-10-21-performance-implementation-plan.md): S0 → S1 → S2 → SF → S3 → S4 → S5 → S6 → S7 → S8.
3. [UI design implementation plan](2026-10-21-ui-design-implementation-plan.md): A1 → A2 → A3 → A4 → B1 → B2 → B3 → B4 → B5 → B6.

A plan completes only when every slice has merged or has an evidenced terminal gate disposition: not selected, stopped by its falsifier, or deferred by an owner decision.
Elapsed time, unavailable approval or an unfinished test is not such a disposition.
Optional slices do not hold later plans indefinitely.
Reviving a closed slice requires a new plan after plan 3.

The owner also approved the performance plan and directed that UI acceptance and open decisions be revisited only after the architecture and performance plans have been implemented.
UI remains unapproved; completing the first two plans supplies the evidence for that later decision review.

Architecture PR-F is deliberately absent here.
Its semantic read model is performance slice SF, immediately after S2.
This transfer removes the only backward dependency.
A closed slice does not imply delivery of its capability: the next plan checks actual delivered contracts before starting dependent work.

## 2. Scope and HISEW route

In scope: the canonical runtime contract, lifecycle characterization and ownership, temporary-presentation publication, subscriber failure isolation, removal of the legacy renderer input path, corresponding tests and contract documentation.

Retain the canonical package → worker → transactional session → controller → adapter → renderer chain.
Retain the pure editor commands, closed changed-field state publication, three identity types, single WebMCP route table, SVG/drawing export boundary and permanent legacy ingress through `vowl/migrate`.

Non-goals: a new framework, state library, TypeScript migration, renderer replacement, simulation changes, general editor repair, semantic-index optimization, ontology schema changes, altered resource budgets or production deployment.

### Risk class:

**R2 accepted by the owner on 21 October 2026.**
Concurrency, cancellation, public error vocabulary and atomic recovery are material R2 triggers.
The plan is accepted; implementation source identity and native execution-route selection remain SLICE-000 checks.

### Decision owner:

The repository owner accepts the exact plan revision and any new consequential decisions.
The future implementation owner integrates the serial slices; an independent verifier assesses the frozen candidate.

### Reasoning:

The source shows distributed currency predicates, a declared seam that omits canonical methods, and a presentation exception capable of escaping publication.
Failure can leave stale state, misreport an agent action or damage recovery.
Likelihood and timing remain unmeasured; no numeric probability is asserted.

### Potential blast radius:

All load, edit, view, selection and export consumers, both human UI and WebMCP, plus renderer tests and browser recovery paths.

### Reversibility:

The plan requires no artifact migration.
A reviewed source rollback is possible before downstream adoption, provided no unsupported old consumer is reactivated.
After later plans consume the new contract, a coordinated forward fix or qualified rollback of the dependent set is required.

### Principal unknowns:

The complete behavior matrix, canonical equivalents of legacy-path tests, lifecycle-policy exception count, and current browser qualification remain to be established.

### Required artifacts:

This accepted revision, immutable source/candidate identities, the behavior matrix, contract conformance evidence, per-slice dispositions, final review and verification receipts, and a handoff record.
Use the existing task as authority; no new issue or execution is created merely to draft.

### Required specialist lenses:

Independent lifecycle/concurrency and runtime-contract review; browser recovery/export verification.
A security assessment is triggered if implementation changes an input, trust or privilege boundary beyond the planned vocabulary/publication work.
Use the approved native security provider when required, with actual authority and target identity.

### Required verification:

Focused tests during each slice; impacted integration tests; configured `full` evidence on the final candidate; browser lifecycle and export proof outside the Node suite; performance neutrality checks under ADR 0003.
Section 7 defines these separately.

### Required human approvals:

The plan and R2 risk classification were accepted on 21 October 2026; unchanged accepted decisions need no further approval.
Implementation, commit messages, commits, branch pushes and configuration changes required by this approved plan are authorized by the delivery instruction above.
A new shim, deployment or material scope change still requires its own decision.
Q1–Q5, R4 and DEC-008/009 are already decided; do not ask for them again.

### Maximum sensible autonomy:

Commit the validated plans first, then implement this approved plan under the authorized delivery checkpoints.
After implementation authorization, execute accepted slices and routine repairs within scope; stop only the affected work for a new material decision.
No delegation or scanner launch is authorized by this plan.

### Next lifecycle step:

After the documentation checkpoint, perform SLICE-000's baseline, execution-ownership and native route checks using this accepted plan and R2 classification.
Reopen plan acceptance only if a material change requires replanning.

## 3. Requirements, acceptance criteria and decisions

IDs are local to this document; cross-plan references use `ARCH:` as a qualifier.

| Requirement                                      | Observable acceptance criterion                                                                                                                             | Origin            |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| REQ-001 Declare the canonical runtime surface    | AC-001 Independent AST collections establish callers ⊆ declaration ⊆ implementation; negative cases fail                                                    | Review R1, PR-A   |
| REQ-002 Protect the runtime ownership boundary   | AC-002 Stale mutations reject; events carry generation and exactly one payload class; reads expose no live renderer object                                  | Review R2–R4      |
| REQ-003 Characterize lifecycle before extraction | AC-003 Every applicable operation/stimulus matrix row has explicit publication, recovery, error and capture outcomes                                        | PR-B, ADR 0011    |
| REQ-004 Give lifecycle policy one owner          | AC-004 Each public operation has one justified class; success, rollback and final publication share its currency rule; only accepted behavior changes occur | L1–L6             |
| REQ-005 Make temporary presentation observable   | AC-005 Human and agent reveals publish the same field and UI status; each retirement resets it; canonical capture and share links retain ordinary state     | T1–T4, Q5         |
| REQ-006 Isolate presentation failures            | AC-006 A throwing subscriber neither aborts a committed operation nor prevents later subscribers; a bounded warning remains observable                      | P4, Q3            |
| REQ-007 Use only canonical renderer input        | AC-007 Production reaches no retired parser/method/entry path; canonical behavior tests and real-browser exports still pass                                 | PR-E, Q4          |
| REQ-008 Preserve future integration seams        | AC-008 Handoff identifies contract R, lifecycle policy, honest double and temporary state, with exact delivered revisions and any gaps                      | Review section 18 |

| Decision     | Status and exact consequence                                                                                                                                                                                                           |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DEC-001 / Q1 | Accepted 20 October: caller cancellation keeps already-applied standing choices and publishes the applied view; only a current renderer failure rolls back                                                                             |
| DEC-002 / Q2 | Accepted 20 October: pending-load `view`, `transient-view`, `read` and `capture` reject as retryable `LOAD_PENDING`; `edit` retains `EDIT_REJECTED`                                                                                    |
| DEC-003 / Q3 | Accepted 20 October: isolate subscriber failures and surface a warning                                                                                                                                                                 |
| DEC-004 / Q4 | Accepted 20 October: no intended renderer-library surface; retire `src/webvowl/js/entry.js` in PR-E                                                                                                                                    |
| DEC-005 / Q5 | Accepted 20 October: include temporary presentation in `get_visualization_state`, preserving its 1,500-character budget                                                                                                                |
| DEC-006 / R4 | Accepted 20 October: classify every event as identity, renderer observation or editing request                                                                                                                                         |
| DEC-007      | Reconciliation constraint: move PR-F to performance SF; no semantic read-model implementation here                                                                                                                                     |
| DEC-008      | Accepted 21 October: use a separate canonical declaration while the existing legacy declaration still serves existing consumers; update consumers directly and remove obsolete declarations in PR-E, without new compatibility aliases |
| DEC-009      | Accepted 21 October: warning reporting must avoid recursively republishing the same failing subscriber; use the existing diagnostic path and prove bounded reporting                                                                   |

### 3.1 Quality scenarios

| Scenario                         | Stimulus and environment                                                        | Required response and proof                                                                                                    |
| -------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| QA-001 Stale completion          | Start an operation, replace its generation/revision, then resolve deferred work | No retired publication, rollback or layout restoration; matrix inspects real session and applied runtime state                 |
| QA-002 Cancel after apply        | Apply standing choices, defer paint, abort caller                               | Applied scene and view agree; caller stops waiting; current choices remain; explicit renderer failure still exercises recovery |
| QA-003 Load-pending parity       | Invoke each agent-reachable class during a load                                 | `LOAD_PENDING` with retryability survives WebMCP projection; edit policy remains distinct                                      |
| QA-004 Subscriber isolation      | First subscriber throws after accepted load/edit                                | Remaining subscribers receive committed state, producing operation succeeds, warning is observable without recursion           |
| QA-005 Temporary view fidelity   | Reveal through human and agent paths, export, clear, then reload/edit           | Same status; ordinary canonical bytes/share-link state; no stale overlay after retirement                                      |
| QA-006 Canonical renderer parity | Revise while editing a label, handling wheel input and retaining loop positions | Canonical fixtures protect the actual behavior before legacy deletion                                                          |
| QA-007 Performance guard         | Compare PR-C/D with protected parent on existing workloads                      | No corroborated regression outside accepted prior budgets; no new benchmark claims from static counts                          |
| QA-008 Ownership and retention   | Repeat load/edit/reveal/export/dispose with retained diagnostics                | No retired generation reachable through tickets, subscriber resources or the test double                                       |

## 4. Contracts and ownership seams

Contract R covers the 25 current canonical methods grouped in architecture section 10.
The initial discrepancy is six undeclared methods: `replaceCanonicalDrawing`, `applyCanonicalDrawingRevision`, `readCanonicalDrawingState`, `readVisualizationView`, `readVisualizationViewport` and `setVisualizationFocus`.
The legacy-only `replaceVowlModel` and `applyVowlModelRevision` leave the production contract.
Recount callers at SLICE-000 rather than treating 25 as a permanent limit.

| R4 class             | Existing event kinds                                                                                                                                                                      |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Identity             | `rendered-element-selection-changed`, `document-record-selection-changed`                                                                                                                 |
| Renderer observation | `render-progress-changed`, `render-warning-raised`, `rendering-statistics-changed`, `editor-mode-changed`, `visualization-view-changed`, `viewport-changed`, `graph-layout-state-changed` |
| Editing request      | `record-deletion-requested`, `semantic-creation-requested`, `record-creation-requested`, `record-endpoint-edit-requested`, `record-label-edit-requested`                                  |

Editing requests may carry human-entered text and draft fields for controller validation.
No event carries ontology text read from the drawing as an authoritative semantic fact.
The later UI anchor belongs to renderer observation.
Entity references, document-record targets and occurrence references remain distinct; occurrence identity remains an arrangement concern.

The DRY-01 decision test applies to these materially shared rules:

| Rule and current authority      | Consumers and boundary                                                   | Implementation strategy and drift control                                                                                                       |
| ------------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Runtime contract R              | Controller, session, editor commands, drawing export, adapter, double    | Pure declaration plus independently collected AST facts and behavioral conformance; tests do not derive expected adapter keys from the new list |
| Operation currency/supersession | Public controller operations; session retains its transaction validation | One controller lifecycle owner; keep session validation at its own failure boundary; matrix protects deliberate differences                     |
| Published view composition      | Controller operations and runtime-event handler                          | One current composition function, including `nodesShown`; no consumer-side reconstruction                                                       |
| Temporary presentation          | Controller owns ordinary viewport/focus; session owns ordinary scene     | Keep storage in its domain; one retirement path and published fact; UI consumes it instead of maintaining a mirror                              |
| Semantic inspection validation  | Application inspection projector and inspector consumers                 | Move the validator to an accurately named application contract module if needed; update all imports directly                                    |
| External request validation     | WebMCP normalizers and controller validators                             | Preserve separate trust-boundary enforcement; similar checks are not automatically redundant                                                    |
| Test expectations               | Published contracts and owner decisions                                  | Share neutral fixtures only; no lifecycle-helper-derived matrix expectations                                                                    |

Internal reuse satisfies the main refactor need: existing AST seam testing, scene transactions, inspectors and native `AbortController`.
No new package is selected, and there is no new license clearance claim.
Any later new capability requires current REU-01/VER-01/LIC-01 research.
NAM-01 applies to both new names and retained names whose responsibilities change.
No NSH-01 override is recorded or requested.

## 5. Ordered vertical slices

All slices are serial.
Within a slice, documentation or independent review can be prepared separately, but concurrent writes to the controller, contracts or renderer are not planned.

### SLICE-000 — Re-anchor and admit the implementation

**Entry:** exact plan revision and R2 route accepted; implementation authority present.

Record HEAD/tree, dirty-input hashes, review hashes, lockfile, existing execution owner and accepted baseline.
Refresh current HISEW applicability and verification-profile declarations before any engine mutation.
Reuse an applicable owned execution; never adopt or close someone else's execution to prepare this work.
Verify current callers, event kinds, legacy-path consumers and the five accepted decisions against the source.

**Proof/output:** drift inventory, concrete slice scope, current verification route and owner assignment.
Expected changes introduced by earlier authorized work are reconciled explicitly.
Unexpected identity, semantic or ownership changes require rebaselining.
This checkpoint does not run performance S0.

### SLICE-001 — PR-A: declare and enforce the canonical runtime seam

**Outcome:** a production caller cannot silently depend on an undeclared or unimplemented runtime member.

**Predicted files:** new `src/app/js/controller/canonicalRenderedGraphRuntimeContract.js` and `src/canonicalRuntimeSeam.architecture.test.js`; [existing runtime contracts](../../src/app/js/controller/renderedGraphRuntimeContracts.js); [seam conformance tests](../../src/webvowl/js/runtime/renderedGraphSeamConformance.test.js); contract imports where necessary.

**Tests first:** gather runtime-receiver calls, adapter-return keys and declarations independently.
Negative fixtures remove an implementation member, introduce an undeclared call, add an unclassified event, and supply semantic drawing text as an identity fact.
Validate payload classes and generation fencing, including owned snapshot reads.

**Implementation:** declare the current canonical surface and explicit event classification.
Keep the existing legacy declaration only while actual old consumers still need it; create no re-export bridge merely to conceal stale imports.
Keep optional production assertion out of this behavior-neutral slice unless its failure semantics are explicitly reviewed.

**Accept:** AC-001/002 and QA-001 pass; current valid events remain accepted.
Name-level proof alone does not establish behavior.
**Stop:** dynamic receiver ambiguity makes the oracle unsound; explicitly enumerate legitimate receivers or reconsider the collector, never weaken inclusion checks.
**Recovery:** reverse this slice's declaration/test changes before dependent adoption if necessary; preserve the negative fixtures as review evidence.

### SLICE-002 — PR-B: characterize lifecycle with an honest runtime double

**Outcome:** lifecycle extraction has an independent observable oracle.

**Predicted files:** new `src/app/test/canonicalRenderedGraphRuntimeDouble.js`, its conformance tests, and `src/app/js/controller/canonicalWebVowlControllerLifecycle.test.js`; existing controller/session fixtures.

The double must apply canonical revisions, retain observable arrangement/layout state, permit controlled paint deferral and emit valid generation-scoped events.
Document that it does not model SVG geometry, browser painting or real worker scheduling.
Use the real document session and in-process canonical worker operations.
Mock only genuine external I/O, paint timing or failure boundaries.

Matrix operation rows: view, modes, force distances, reset, reveal, clear, arrangement, edit and each of SVG/canonical capture.
Stimuli: newer view, replacement load, pending edit, disposal, caller abort and renderer failure.
For each applicable pair, independently specify published fields, scene/runtime agreement, error and retryability, capture abortion and overlay retirement.
Document why an inapplicable pair is inapplicable; do not create meaningless tests to fill a rectangle.

**Accept:** current behavior is characterized, with Q1/Q2 rows explicitly marked for change in PR-C.
Do not encode today's mixed cancellation outcome as the desired contract.
The double itself passes PR-A conformance and deliberate stale/failure cases.
**Recovery:** test-only changes can be reversed; keep matrix evidence for subsequent implementation.
**Handoff:** freeze the expectation table before writing the lifecycle helper.

### SLICE-003 — PR-C: centralize operation lifecycle and implement Q1/Q2

**Outcome:** adding an action does not require inventing another supersession predicate.

**Predicted files:** new `src/app/js/controller/controllerOperationLifecycle.js` and focused tests; [controller](../../src/app/js/controller/canonicalWebVowlController.js); [WebMCP contracts](../../src/app/js/webmcp/webMcpToolContracts.js) and related tests; [WebMCP documentation](../webmcp.md).

Define classes `load`, `edit`, `view`, `transient-view`, `capture`, `read`.
The policy table states superseded work, rejection conditions/code, temporary-view retirement, active-capture effects and ownership transfer point.
A ticket owns combined signal, currentness assertion and idempotent release.
Publication, rollback and final publication use its same currency decision.
Session commit/recovery guards remain intact.

Migrate one complete operation path at a time inside this slice, using PR-B after each change.
Centralize published view composition.
Implement Q1 with applied choices retained after caller cancellation; implement Q2 in controller and WebMCP projection together.
Do not normalize unrelated error codes or add tool/schema aliases.

**Accept:** PR-B changes only the approved Q1/Q2 rows; every public operation maps to one class; stale capture cannot restore a newer layout; human and agent errors agree.
Run recovery/search browser paths and existing performance comparisons.
**Falsifier:** more than two operations require class exceptions.
Stop and propose the review's narrower shared-currentness helper with linear operations; do not grow flags silently.
**Recovery:** before dependent adoption, reverse the cohesive slice; after adoption, qualify a coordinated correction against the unchanged matrix.

### SLICE-004 — PR-D: publish temporary presentation and isolate subscribers

**Outcome:** human readers see agent-initiated temporary views, and presentation failures cannot undo committed operations.

**Predicted files:** [controller state contracts](../../src/app/js/controller/webVowlControllerContracts.js), controller, [search menu](../../src/app/js/menu/searchMenu.js), [state presenter](../../src/app/js/ui/controllerStatePresenter.js), [composition root](../../src/app/js/app.js), WebMCP contracts/tests and state documentation.

Introduce a closed `temporaryPresentation` field, null or a neighborhood descriptor with node/edge/label counts.
Bind it to the accepted generation/revision without storing ordinary viewport/focus in the canonical session.
Route retirement through `clearNeighborhood()`, including revision acceptance after the session has already retired its half.
Remove the menu's `hasTemporaryNeighborhood` and `neighborhoodSequence`.
Fold related field routing into the existing presenter only where it avoids duplicated authority.

Test retirement on clear, filters, node count, language, layout, modes, distances, reset, edit acceptance, load and disposal.
Test failed/superseded reveal, human/agent parity and generation replacement.
Keep caps of 25 references, 500 nodes, 1,000 edges, 2,000 labels and 10,000 adjacency entries.

Notify each subscriber independently; report a failure without recursively re-entering the failing notification path.
Test two failing subscribers, later successful delivery and warning-path failure as bounded diagnostic cases.
Include the field in `get_visualization_state` inside the existing 1,500-character budget.

**Accept:** AC-005/006; ordinary canonical export and share-link semantics survive reveal/clear cycles.
**Recovery:** retain pre-candidate export fixtures and use the lifecycle policy to repair a missed retirement trigger; do not restore a UI mirror.

### SLICE-005 — PR-E: retire the legacy renderer input mode

**Outcome:** behavior tests exercise the canonical path production uses.

**Predicted files:**

- [D3 adapter](../../src/webvowl/js/runtime/d3RenderedGraphAdapter.js) and [renderer internals](../../src/webvowl/js/runtime/renderedGraphInternals.js).
- Runtime contracts and renderer editing/adapter tests.
- [Architecture tests](../../src/renderedGraphDecoupling.architecture.test.js), module-format tests and application test doubles.

Retirement candidates are `src/webvowl/js/parser.js`, `src/webvowl/js/parsing/equivalentPropertyMerger.js`, their exclusively legacy tests and `src/webvowl/js/entry.js`.

First port legacy-mount and revision behavior tests to independently authored canonical fixtures.
Cover label-submission expiry, wheel behavior after revision, loop-label placement, viewport retention, stale rejection and recovery.
If a canonical test exposes a real gap, stop deletion and raise a separate bounded defect change for owner disposition.
Do not preserve the legacy path merely to keep tests green.

Then remove legacy adapter methods/indexer, parser branches, dictionary code, unused reference indexer and validators after checking every consumer.
Replace legacy test-support contracts with canonical ones; assert production-only reachability.
Scope retired-identifier assertions to the retired renderer meanings: the generic word `parser` must not prohibit legitimate OWL parser modules.
Keep canonical constructors, `attributeParser`, `linkCreator`, force simulation, PlainLink pilot and Label property aliases.
Keep permanent `vowl/migrate` ingress and the documented canonical editor-gesture limitation.

**Accept:** ported tests, independent architecture oracles, production build and browser matrix pass; no production legacy renderer route remains.
**Recovery:** qualify source reversal only before downstream adoption; retain the prior deployable artifact for an independently authorized release rollback.

## 6. Traceability and slice dispositions

| Slice            | Requirements / acceptance / quality / decisions             | Proof                                                              | Release and cleanup implication                                  | Initial status |
| ---------------- | ----------------------------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------- | -------------- |
| SLICE-000        | REQ-008 / AC-008 / QA-008                                   | Re-anchored scope and ownership record                             | No source or lifecycle claim from planning                       | Not started    |
| SLICE-001 / PR-A | REQ-001/002 / AC-001/002 / QA-001 / DEC-006/008             | Independent AST negatives and payload conformance                  | Canonical declaration available; legacy consumers remain tracked | Not started    |
| SLICE-002 / PR-B | REQ-003 / AC-003 / QA-001/002/003 / DEC-001/002             | Frozen matrix and honest-double conformance                        | Durable oracle for all later plans                               | Not started    |
| SLICE-003 / PR-C | REQ-004 / AC-004 / QA-001/002/003/007 / DEC-001/002         | Matrix, error parity, browser recovery                             | Public error vocabulary documented; retire duplicated guards     | Not started    |
| SLICE-004 / PR-D | REQ-005/006 / AC-005/006 / QA-004/005/008 / DEC-003/005/009 | Publication failure tests, reveal/capture equivalence              | Remove UI mirror; publish actual temporary state                 | Not started    |
| SLICE-005 / PR-E | REQ-007/008 / AC-007/008 / QA-006/007 / DEC-004/007         | Canonical renderer tests, production reachability, browser exports | Remove dead renderer path; hand off to performance               | Not started    |

Each terminal row must add the accepted source/merge identity or gate decision, proof location, reviewer and remaining limitation.
Do not replace an unfinished required slice with an unexplained “deferred”.

## 7. Verification, evidence and review

Native profile inspection on 21 October reports:

| Profile    | Configured command | Practical limitation                                                 |
| ---------- | ------------------ | -------------------------------------------------------------------- |
| `focused`  | `npm run lint`     | Broad lint, not a focused behavioral test                            |
| `affected` | `npm run test`     | Whole configured Jest selection, not dependency-aware selection      |
| `full`     | `npm run check`    | Full repository command; does not itself prove real-browser behavior |

All profiles have a 600-second configured command timeout.
Coverage and input-order declarations are absent; environment resolution was inspected but not probed.
Reinspect before implementation.
The owner authorized configuration changes required by this plan; retain the required verification coverage and record the exact change and rationale before applying any necessary profile adjustment.

Use `npm test -- --runInBand --runTestsByPath <actual-test-paths>` for slice-level red/green proof.
Use `npm run check:affected -- --base <accepted-full-commit-id> --path <changed-path> --list` to inspect the impacted closure, following [the dependency/testing contract](../dependency-graph-and-tests.md); it does not substitute for the required full route.
Format and lint the exact eventual commit scope before committing, including these plans.

At the stable final candidate, run the admitted HISEW `full` route and independent review once after the final input writers.
Reuse applicable completed evidence for later commit/push bookkeeping; do not relabel closure as verification.
Separately retain:

- real-browser `performance-search` and `live-recovery` results;
- export → reopen → export byte identity and SVG/drawing geometry checks;
- canonical renderer checks in Blink, Gecko and WebKit, with unavailable engines reported as gaps;
- quiescent performance comparisons for changed PR-C/D paths under [ADR 0003](../adr/0003-quiescent-benchmark-environment.md);
- resource-retention evidence with positive controls where lifetime claims are made.

The existing `util/qualify-canonical-browser.mjs` is a development/headless harness.
Its success is functional evidence within that scope, not the production/headed performance baseline S0 will add.
Retain raw receipts outside the repository under the configured HISEW evidence root, bound to source, lockfile, fixture, browser and harness identities.
Do not run a build/test/scan concurrently with acceptance timing.

## 8. Compatibility, release and recovery

No persistent-data migration, backfill or schema revision is planned.
Existing canonical artifacts, imported legacy documents and bookmarks must retain their established meaning.
New public state/error fields require explicit contract tests and documentation; they are not permission to expose human editing through WebMCP.

Checkpoint after each merged slice.
After interruption, re-read the slice disposition, current source and execution ownership before resuming; discard stale operation objects, not retained evidence or user edits.
Never use working-tree restoration to erase unrelated changes.

Implementation completion, verification, hosted CI, merge, deployment and production acceptance are separate claims.
For an authorized deployment, the release owner retains the previous qualified artifact and verifies load/edit/reveal/capture on the exact deployed bytes.
Abort rollout on stale publication, recovery failure, export difference, unhandled subscriber failures or a corroborated performance regression.
Before later consumers adopt new contracts, a qualified previous artifact may be restored.
After adoption, assess all dependent consumers before rollback; prefer a scoped forward fix when restoring the old contract would violate current consumers.

Cleanup removes only task-owned disposable fixtures, temporary browser profiles and exhausted resources after evidence retention and process quiescence.
Production deletions in PR-E are reviewed changes, not a general cleanup license.
No configuration changes are planned.

## 9. Completion and handoff to performance

The implementation owner and independent verifier record:

1. Disposition and exact identity for PR-A through PR-E.
2. Contract R location, classified events and independent conformance suite.
3. Honest-double limitations and frozen lifecycle matrix.
4. Lifecycle classes, Q1/Q2 outcomes and documented `LOAD_PENDING`.
5. Temporary-presentation state, retirement rules, subscriber-warning behavior and agent projection budget.
6. Canonical-only renderer proof, preserved migration ingress and known editor limitation.
7. Applicable full/browser/performance evidence, unresolved failures and release status.
8. Post-plan-1 baseline for performance S0, including toolchain/lockfile drift.

The performance plan is already accepted; its implementation begins only after this completion checkpoint and with implementation authority.
Replan for unexpected canonical/identity changes, invalid oracles, unsupported consumers, a newly needed configuration/dependency change, an unsafe recovery route, or a lifecycle abstraction that fails L6.
The success criterion remains safer change and preserved behavior; fewer lines alone are not acceptance.
