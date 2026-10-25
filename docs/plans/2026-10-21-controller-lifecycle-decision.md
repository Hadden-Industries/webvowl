# ARCH-DEC-010: Where controller lifecycle policy should live

| Field             | Value                                                                                                            |
| ----------------- | ---------------------------------------------------------------------------------------------------------------- |
| Status            | Accepted: Option 1, 21 October 2026                                                                              |
| Date              | 21 October 2026                                                                                                  |
| Decision owner    | Maksym Shostak                                                                                                   |
| Prepared by       | Codex                                                                                                            |
| Affected work     | Architecture PR-C, with PR-D and the performance handoff depending on it                                         |
| Accepted baseline | `e30d5014f82c5da13ca494af5550b6b96f4c0b73` on `feat/architecture-performance-ui`                                 |
| Recommendation    | Option 1: retain the class table for document operations and explicitly classify application controls separately |
| Confidence        | High in the scope distinction; medium in the final table's fit until its complete behavior matrix is checked     |

## Decision in plain language

WebVOWL needs one reliable way to decide whether an operation still owns the right to change the visible result.
For example, an old export must not resume the layout of a newly loaded ontology.
The choice is how much of that coordination a shared component should own.

**Option 1 keeps the approved architecture's central policy table, scoped to operations on a document.**
Application status, subscriptions, editor preferences, viewport size, diagnostics and disposal keep explicit application-lifetime handling.
**Option 2 is the earlier proposed fallback:** share operation tickets and their currentness checks, while keeping cancellation and retirement steps explicit in each controller method.
Option 3 puts both document operations and application controls into a larger policy table.

There is no proposed change to the user's accepted cancellation outcome, document transactions, rendering model, dependency stack or UI design.
This decision clarifies the scope of PR-C's operation classification and the ownership of its coordination rules.

## Correction to the initial approval request

The initial request said PR-C had already exceeded its "more than two exceptions" threshold because several controls work without a loaded document.
**That conclusion was premature.**
Those controls establish a difference in scope; they do not, by themselves, prove that a table for document operations needs more than two exceptions.
No complete table or implementation has yet demonstrated that falsifier.

The accepted plan says: "more than two operations require class exceptions" and then requires proposing the narrower helper.
Its applicability depends on defining which operations belong to the table first.
This correction replaced the earlier rationale before the owner accepted Option 1 below.

## Evidence and limits

| Observation                                                                                                                     | Current-source evidence                                                                                                                                               | Decision implication                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `getState()` returns the current state without document admission                                                               | [Controller, line 504](../../src/app/js/controller/canonicalWebVowlController.js#L504)                                                                                | Loading status must remain observable                                                                                                           |
| Every WebMCP call reads `getState()` before dispatch; the state tool routes directly to it                                      | [Tool dispatch](../../src/app/js/webmcp/webMcpToolContracts.js#L2052), [state route](../../src/app/js/webmcp/webMcpToolContracts.js#L1881)                            | Making `getState()` reject during loading would also disrupt unrelated tool dispatch; this is a real dependency, not a hypothetical convenience |
| Resizing checks disposal, updates viewport dimensions and aborts capture; it does not require an accepted document              | [Controller resize](../../src/app/js/controller/canonicalWebVowlController.js#L1384), [application sizing](../../src/app/js/app.js#L602)                              | Application controls still have lifecycle obligations, even when they sit outside document admission                                            |
| Diagnostics and editor preferences have distinct application behavior                                                           | [Diagnostics](../../src/app/js/controller/canonicalWebVowlController.js#L1397), [editor preferences](../../src/app/js/controller/canonicalWebVowlController.js#L1426) | They should not acquire artificial document prerequisites                                                                                       |
| Neighborhood reveal rejects a pending edit, while standing view and arrangement changes can participate in later reconciliation | [Reveal guard](../../src/app/js/controller/canonicalWebVowlController.js#L875), [characterization tests](../../src/app/js/controller/controllerLifecycle.test.js)     | This is a genuine difference among document operations that the proposed table must account for explicitly                                      |
| Current view code repeats currency checks in success, rollback and final publication                                            | [View completion and recovery](../../src/app/js/controller/canonicalWebVowlController.js#L1225)                                                                       | Both viable designs must remove divergence among these checks                                                                                   |

An independent AST inventory finds 37 public controller members: the proposed split below assigns 29 to document operations and 8 to application controls/observations.
This inventory defines the accepted scope; it does not by itself prove that every class policy is correct.

PR-A's declaration and AST checks and PR-B's real-session test harness have been added locally.
The characterization suite records the accepted Q1/Q2 changes as expected failures against the unchanged controller.
The latest focused run passed six suites with 151 test results, including 12 expected-failure cases for those approved changes; this must not be read as implementation of Q1/Q2.
It also records an existing uncoded-renderer-error wrapping defect separately; that defect does not determine this architectural choice.
These are focused Node results, not final full verification, browser evidence, performance neutrality or an external review.
No lifecycle helper has been implemented and neither option has measured performance or maintenance-cost results.

## Constraints already decided

1. **Currentness:** success, recovery and final publication use the same operation-ownership decision.
   Retired work cannot change a successor's state.
2. **Cancellation:** Q1 keeps already-applied standing choices when the caller stops waiting.
   A current renderer failure can recover the prior scene.
   The helper must distinguish cancellation of waiting from loss of ownership; treating every aborted caller as an obsolete owner would suppress the required final publication.
3. **Load admission:** Q2 returns retryable `LOAD_PENDING` for document view, transient-view, content-read and capture operations during loading.
   Editing retains `EDIT_REJECTED`.
   This proposal explicitly preserves `getState()` as application observation, including `get_visualization_state`, so the loading condition can be inspected.
4. **Ownership transfer:** a rejected candidate scene must not cancel a preceding valid view.
   View ownership transfers after scene acceptance.
5. **Transaction boundaries:** the document session retains its own commit, revision and recovery guards.
6. **Temporary presentation:** PR-D retains one published source of temporary-neighborhood state and its retirement path.
7. **Verification and order:** consolidate architecture changes, finish full tests and repairs, then run the authorized final external review.
   Performance follows architecture completion; UI acceptance remains deferred.

## Options and trade-offs

| Consideration                | 1. Scoped class table — recommended                                                 | 2. Narrow tickets — earlier fallback                                                                              | 3. Broader table with more classes                                                               |
| ---------------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Shared component owns        | Tickets, currentness and common document-operation coordination rules               | Tickets, currentness, combined signals and idempotent release                                                     | Tickets and policy for document operations, observation, configuration and lifetime              |
| Controller owns              | Validation, scene work, explicit application controls and class invocation          | Validation, scene work, and the explicit order of aborting captures, retiring overlays and superseding operations | Validation and work routed through the expanded class system                                     |
| Main benefit                 | Keeps the approved plan's central source for cancellation/supersession policy       | Makes each method's sequence easy to follow locally                                                               | Provides one exhaustive policy vocabulary                                                        |
| Main cost                    | Requires a precise boundary and a table that genuinely fits the document operations | Shared policy can be repeated across methods; each new action must remember all coordination steps                | More categories and interactions to explain, review and maintain                                 |
| Main failure risk            | Incorrect classification or hidden exceptions make the table misleading             | A new action uses a ticket correctly but forgets to cancel an export or retire a temporary view                   | Ordinary controls become coupled to document policy, or the table turns into a general framework |
| Enforcement                  | Exhaustive member inventory, class-row tests and independent behavior tests         | Exhaustive member inventory and independent behavior tests; review of explicit sequencing remains necessary       | Tests for both document rows and the additional application rows                                 |
| Change to accepted direction | Clarifies scope while retaining the intended architecture                           | Uses the documented fallback and gives up central executable coordination policy                                  | Expands the planned abstraction beyond its six document classes                                  |
| Best reason to choose it     | Document behaviors fit a small, explicit table                                      | Actual document behaviors require repeated class exceptions or the table obscures their ordering                  | Several distinct consumers demonstrably need a common application-lifecycle policy               |

**Recommendation: Option 1.**
It preserves the accepted objective of giving shared coordination rules one owner, while recognizing the source's existing application/document boundary.
The evidence presently supports that boundary more strongly than it supports abandoning the table.
Option 2 remains a reasonable fallback if the completed document-policy design actually exceeds the accepted exception threshold.
There is currently no demonstrated need for Option 3's broader framework.

## Accepted scope for Option 1

Every public member appears exactly once in the classification inventory.
An application-control entry has explicit obligations; it is not an escape hatch from ownership or disposal handling.

| Family                            | Members                                                                                                                                                                                                                                                                                                  |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Document `load`                   | `loadOntology`                                                                                                                                                                                                                                                                                           |
| Document `edit`                   | `editOntologyRecord`, `editOntologyMetadata`, `setOntologyPrefix`, `removeOntologyPrefix`                                                                                                                                                                                                                |
| Document `view`                   | `revealOntologyElements`, `setVisualizationView`, `setVisualizationModes`, `setForceLayoutDistances`, `resetVisualization`, `setGraphLayoutPaused`                                                                                                                                                       |
| Document `transient-view`         | `revealOntologyNeighborhood`, `clearOntologyNeighborhood`, `setVisualizationArrangement`, `selectVisualizationElement`, `setContinuousZoom`                                                                                                                                                              |
| Document `capture`                | `exportVisualization`, `exportOriginalSource`                                                                                                                                                                                                                                                            |
| Document `read`                   | `getOntologyEditorView`, `resolveOntologyEditorIri`, `getOntologySummary`, `getOntologyElementRevealPlan`, `getOntologyNeighborhoodRevealPlan`, `findOntologyElements`, `describeOntologyElements`, `getOntologyFacts`, `getVisualizationShareLink`, `getVisualizationArrangement`, `getOriginalSources` |
| Application observation           | `getState`, `getOntologyEditorOptions`, `getVisualizationFocus`                                                                                                                                                                                                                                          |
| Application controls and lifetime | `subscribeToState`, `resizeVisualizationViewport`, `setRenderingDiagnosticsEnabled`, `setOntologyEditorOptions`, `dispose`                                                                                                                                                                               |

`getVisualizationFocus()` currently returns an empty focus during loading and is used by the application; it is not a WebMCP tool route.
The proposal retains that observation behavior.
Overlapping view requests and the special pending-edit rule for neighborhood reveal still need explicit treatment when writing the document policy.
They must not be hidden behind unnamed per-operation switches.

The accepted exception threshold applies to contradictions of a document class's admission, supersession, retirement or ownership-transfer row.
Application controls named above are outside that table by definition, and their distinct behavior remains tested.
The session's independent transaction validation remains at its existing boundary.

## Concrete scenarios for the decision

| Scenario                                                                          | Required observable result under either viable option                                                    | What differs internally                                                                                                                |
| --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| A new ontology is loading; the user resizes the window and an agent checks status | Resize works and status says `loading`; a request for ontology content receives retryable `LOAD_PENDING` | Option 1 separates application observation from the document `read` row; Option 2 handles the distinction explicitly in methods        |
| Node visibility has already changed; the caller cancels before paint finishes     | The caller stops waiting, applied visibility remains and published state agrees with the drawing         | Option 1 centralizes the standing-view ownership rule; Option 2 calls the same currency helper from explicit completion/recovery paths |
| A newer view is invalid or its scene cannot be accepted                           | The preceding valid operation keeps ownership                                                            | Option 1 encodes the transfer point; Option 2 must retain the correct ordering in each relevant method                                 |
| An SVG capture is waiting; a replacement load starts                              | No stale artifact publication or layout restoration into the replacement document                        | Option 1's load row supersedes capture; Option 2's load path explicitly cancels capture                                                |
| A later UI action forgets to cancel an incompatible capture                       | The omission must fail review or a behavior test before release                                          | Option 1 also applies common class policy automatically; Option 2 relies more heavily on explicit sequencing and its tests             |
| Neighborhood reveal and arrangement are requested during a pending edit           | Reveal is refused; accepted arrangement survives reconciliation                                          | Option 1 must expose this distinction and count any genuine class exception; Option 2 expresses the difference directly                |

These examples do not demonstrate a runtime speed advantage for either option.
Performance claims require the later approved measurement work.

## Implementation, acceptance and reversibility

For Option 1, first finalize the classification inventory and exact document-policy rows, including the known pending-edit distinction.
Then migrate one complete operation path at a time and check its independent behavior matrix.
Convert the Q1/Q2 expected-failure tests to normal passing tests as their approved behavior is implemented.
Assert that every public member belongs to exactly one document class or named application category.
Keep application resizing, status, preferences, diagnostics and disposal tests alongside the document-operation tests.

For Option 2, retain the same inventory and acceptance matrix, remove the executable class-policy requirement, and require explicit abort/retirement/transfer steps in each relevant method.
The helper must still own currentness; it must not become a bag of per-operation flags.
Neither option moves the session's transactions into the controller or changes the accepted runtime seam.

Acceptance still requires focused and integration tests, full configured verification, real-browser lifecycle/export evidence, the architecture performance guard and the final authorized external review.
No new configuration, package, deployment or public API is required by choosing between these implementations.
The already accepted `LOAD_PENDING` vocabulary and temporary-presentation state remain part of the architecture plan.

Before performance adoption, reversing the lifecycle extraction is a coordinated source correction against the retained matrix and protected documentation baseline.
After dependent adoption, the correction must qualify affected consumers together; no automatic restoration or destructive Git operation is proposed.

Reopen this decision if the document-policy design needs more than two genuine operation exceptions, requires a growing set of flags, prevents accepted application-control behavior, or fails the ownership/cancellation tests.
The narrower fallback is proposed at that point with the specific counterexamples, rather than inferred from unrelated controls.

## Owner disposition

**Accepted 21 October 2026.**
The owner's response was: "Option 1: scoped class table (recommended)".
This authorizes the six document classes and the explicit application inventory above, preserving loading-state observation and the existing exception threshold.
Option 2 remains a fallback only if concrete document-operation counterexamples establish that threshold; Option 3 is not selected.
The earlier request for the narrower fallback was not approved, and the correction above remains part of this record.

## Related records and decision-record practice

- [Accepted architecture plan](2026-10-21-architecture-implementation-plan.md), particularly PR-B, PR-C and Q1/Q2.
- [Architecture assessment](../reviews/20261020-architecture-assessment.md), Contract L and section 14.1.
- [ADR 0011: a test double must behave like its subject](../adr/0011-a-test-double-must-behave-like-its-subject.md).
- [Microsoft: maintain an architecture decision record](https://learn.microsoft.com/en-us/azure/well-architected/architect-role/architecture-decision-record) supports recording context, alternatives, consequences, confidence and explicit status.
  This record follows those presentation principles; that guidance does not decide which WebVOWL design is correct.
- [AWS: ADR best practices](https://docs.aws.amazon.com/prescriptive-guidance/latest/architectural-decision-records/best-practices.html) supports visible ownership, repository storage and preservation of decision history.
  The initial proposal and its correction remain visible alongside the subsequent owner disposition.
