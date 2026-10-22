# PERF-DEC-011: S7 worker/package experiment selection

| Field               | Value                                                                                                                             |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Status              | Approved and implemented; affected and production lifetime checks passed; final programme verification and review remain pending  |
| Date                | 23 October 2026                                                                                                                   |
| Decision owner      | Maksym Shostak                                                                                                                    |
| Authority           | Performance plan DEC-005, DEC-006, DEC-009, SLICE-008 and §4.4's explicit ownership/correctness purpose                           |
| Predecessor         | S6 diagnostic disposition and geometry evidence complete; final programme gates remain pending                                    |
| Recommendation      | Select one narrow checkpoint-admission refactor for maintainability, independently of a promised speedup                          |
| Exact product scope | `packages/vowl/src/liveModel.js`; affected public admission/resource/conformance tests and declaration documentation              |
| Excluded scope      | Worker warming/pooling, parser splitting, ranking/digest changes, copy removal, resource-policy changes and configuration changes |
| Confidence          | High in repeated validation and its private ownership path; candidate correctness and performance remain to be proved             |

## Decision in plain language

**Yes: a narrow part of S7 would improve the design even if it produced little measurable speedup.**
Checkpoint recovery currently validates an owned structure, then passes it to a general admission function that snapshots and validates the same structure again.
Separating validation from publication inside the existing module would make the established invariant explicit and avoid repeating the same proof.

This is not a reason to implement every S7 option.
Pre-warming, larger caches and lazy imports each have separate costs and need their own justification.
I recommend only the checkpoint-admission refactor described below.

The first proposal recommended closing S7 because the obvious ranking-cache extension lacked a credible 25% phase improvement.
The owner then requested deeper research into architectural value independent of speed.
That research changes the recommendation for checkpoint admission.
It does not change the ranking measurements or establish a performance win.
Proposal 1 remains preserved outside Git as `PERF-DEC-011-proposal-1.md`.

The [approved plan](2026-10-21-performance-implementation-plan.md#slice-008--s7-select-one-bounded-worker-experiment) reserves exact package scope to the owner.
Section 4.4 permits an explicitly accepted ownership/correctness purpose when timing alone does not justify a slice.
The owner approved option A, "Approve narrow admission refactor", on 23 October 2026.
That approval selects the maintainability purpose for this one refactor; the 25% phase reduction remains a measurement target, not a falsely passed acceptance criterion.
No other S7 option is selected.

### Implementation evidence

`admit` retains snapshotting and structural validation, then calls private `publishValidatedState`.
`readmitLiveModel` retains its first owned snapshot, full structural/support/archive checks and final charged snapshot, then uses the same private publication function.
Publication checks the deadline/cancellation boundary before qualification validation and retains freezing, inspection construction and local registration.
There is no exported trust flag or worker-lifecycle change.

The preservation route passed 38 tests before the refactor and 4,209 affected tests across seven suites afterward.
New public cases cover inclusive resource boundaries, normalized language ownership, caller mutation during native source hashing, cancellation and deadline expiry.
The native work-count control now observes 110 structural checks in the first pass and zero in a second pass, with the same 163 aggregate charge calls and final counts: 44 embedded values, 1,243 string bytes and six primary records.
These counts describe one public fixture; they are not elapsed-time measurements.

The consolidated production candidate completed ten W5 load/edit/capture cycles at 2,192 occurrences and revision one.
The positive control detected two retired owners; releasing it returned to zero.
Every cycle had zero retained retired owners and zero workers, and disposal released all 44 tracked owners.
Cycle-ten JS heap was 34,230,012 bytes and disposed heap 7,009,580 bytes, approximately 81 KiB above the corrected S5 measurements at both checkpoints.
Heap totals include code/runtime variation; this is not a claim of byte-for-byte heap equality or a statistical memory improvement.
DOM node and event-listener counts equal the corrected S5 candidate at both checkpoints.
The no-retired-owner assertions and explicit per-draw cache clearing support the lifetime conclusion.

Raw logs, source identities, production manifest and `W5-auto-lifetime/result.json` remain in the S7 evidence group below.
Full native verification, scoped native security assessment, final AGY review and deferred foreground acceptance remain outstanding.

Implementation follows the preservation route: characterize the public admission/resource boundaries, retain representative passing checks, then compare after the refactor.
The existing structural validator remains the single rule authority for open/edit and checkpoint consumers; private publication shares only the already established ownership invariant.
The conditional scoped native security assessment and corpus review remain due before final acceptance.

## What current guidance supports

| Principle and primary source                                                                                                                                                                                                  | Application here                                                                             | Limit of the claim                                                                                                                                  |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Validate syntax and semantics when data crosses a trust boundary; internal transport does not make it trustworthy. [OWASP Input Validation](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html) | Every received checkpoint still undergoes full native admission inside its receiving worker. | This does not require running the same validator twice on the same privately owned representation.                                                  |
| Preserve the knowledge established by parsing/validation in the representation consumed downstream. [Alexis King's original design essay](https://lexi-lambda.github.io/blog/2019/11/05/parse-don-t-validate/)                | A private validated-state-to-publication path makes the module's invariant explicit.         | The essay uses static types; this JavaScript implementation must establish the guarantee through private control flow and ownership.                |
| Cross-realm messages serialize and deserialize values. [WHATWG structured data](https://html.spec.whatwg.org/multipage/structured-data.html#safe-passing-of-structured-data)                                                  | A cloned checkpoint is data, not transferable proof of local model admission.                | No object-identity memo or caller-controlled “already validated” flag is acceptable.                                                                |
| Workers have material startup and per-instance memory costs and are generally expected to be long-lived. [WHATWG Workers](https://html.spec.whatwg.org/multipage/workers.html#introduction-16)                                | Repeated worker creation is a legitimate trade-off to investigate.                           | This is non-normative general guidance, not a requirement to pool workers; pre-warming a single-use worker shifts startup but does not amortize it. |
| Module workers support explicit dynamic imports. [Chrome module-worker guidance](https://web.dev/articles/module-workers)                                                                                                     | Parser loading could eventually be isolated to operations that need it.                      | The current code already uses module workers. Another asynchronous loading/failure path is not automatically a maintainability improvement.         |
| Canonicalization implementations must defend against excessive work and preserve the chosen canonicalization contract. [W3C RDFC-1.0](https://www.w3.org/TR/rdf-canon/#security-considerations)                               | Keep bounded native ranking, exact IDs/bytes and cancellation protections.                   | A cheaper hash, skipped issuance or broader cache is not a best-practice default.                                                                   |

The recommendation is my application of these principles to the inspected source, not a rule that a standard mandates this particular refactor.
The existing module already shares one validator; there are not two competing implementations of its rules.
The improvement is clearer sequencing and preservation of a proven invariant, rather than fixing policy duplication or a demonstrated security vulnerability.

## Source findings and independent checks

The relevant sequence in [liveModel.js](../../packages/vowl/src/liveModel.js) is:

1. `readmitLiveModel` snapshots the caller's checkpoint and validates closed fields, version, revision and origin.
2. It calls `validateStructure`, which checks shape, references, meaning and exact projection.
3. It validates supports and, where applicable, reads and verifies the retained source archive.
4. It calls `admit`, which snapshots the assembled state and calls `validateStructure` again.
5. Qualifications, freezing, inspection construction and model publication complete admission.

The first snapshot is private and does not escape while archive recovery awaits.
The structural checks can normalize accepted language spellings, so the eventual publication must use that validated representation or its faithful snapshot.
It must not return to the original caller-owned object.
Both validation calls currently use the same rules.

A read-only public-fixture diagnostic observed **110 native checks in each structural-validation pass**, zero aggregate `charge` calls within either pass, and 163 charge calls across the full recovery.
The final counters were 44 embedded values, 1,243 string bytes and 6 primary records.
All original methods executed and the recovered inspection equalled the original.
This is one public conformance fixture plus a source audit, not qualification of the proposed implementation.

The validator graph performs cancellation/deadline checks and expression-depth bounds.
Its projection generator's allocating snapshot branch is used for normalization, not this validation mode.
Therefore, retaining the current snapshots can preserve aggregate accounting while removing the redundant structural proof.
This corrects proposal 1's overly broad suggestion that removing this validation pass necessarily changes charged accounting.
All counters, depth enforcement, stage checks and failure behavior still require candidate verification.

## Proposed implementation

Keep the same public interface and one existing module.
Use a private publication function whose precondition is an owned state with validated structure.
It must not be exported or selectable with a public flag.

- Ordinary open/edit admission keeps its snapshot and structural validation, then calls private publication.
- Checkpoint recovery keeps its initial snapshot, structural validation, supports/archive checks and existing final state snapshot, then calls private publication without repeating structural validation.
- Private publication retains qualification validation, deep freezing, inspection construction and local model registration in their established order.
- Keep stage-boundary deadline/cancellation checks, all snapshot charges and expression-depth validation.
- Add no long-lived admission cache, worker state, new dependency or configuration.
- Do not combine this with removal of either snapshot; that would be a different ownership/accounting change.

The public result remains the same admitted model and correspondence.
Every new checkpoint received by a fresh worker is validated again; only the second identical pass within that one admission is removed.

## Comparison of the S7 alternatives

| Option                               | Architectural value independent of speed                                                                      | Cost or complication                                                                                                          | Recommendation now                             |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Narrow checkpoint-admission refactor | Makes validated state and publication responsibilities explicit; reduces a redundant transition in one module | Must prove ownership across the archive await and preserve admission/error/resource behavior                                  | Select for an explicit maintainability purpose |
| Lazy parser imports                  | Can make operation dependencies more local                                                                    | Adds asynchronous loading failures and deployment-asset obligations; the existing dispatch module already has a coherent role | Leave unselected in this one-experiment slice  |
| Pre-warmed single-use worker         | No established maintainability advantage                                                                      | Adds an idle state, expiry and disposal rules; startup still happens for each job                                             | Leave unselected                               |
| Persistent worker/model or pool      | Could amortize startup in some applications                                                                   | Changes ownership, stale-job handling, cancellation and retention; persistent model worker is excluded by the plan            | Requires a separate design                     |
| Larger ranking digest cache          | No established correctness or ownership benefit                                                               | More retained keys and budget/invalidation work                                                                               | Leave unselected                               |
| New ranking/canonicalization design  | May eventually simplify or reduce real work                                                                   | Substantial identity, bytes, hostile-input and corpus obligations                                                             | Separate design if later justified             |

Ranking remains material: retained W5-all load/first-edit marks are approximately 4.39/4.34 seconds, or 32.6%/32.0% of their traced operation windows.
However, `readModelRankingIdentity` already reuses structural admission.
The remaining exact digest repeats were 392 of 8,677 calls on W1 and 13,477 of 223,840 on W5; repeated bytes were approximately 3.35%/4.39%.
Those Node work counts do not measure browser time, and they do not support promising a 25% phase gain from a larger cache.
None of these observations establishes that P5's timing falsifier passed.

## Acceptance and recovery

The selected purpose is: **make checkpoint admission's validated-state and publication responsibilities explicit while preserving all external behavior and accounting.**
A speedup is desirable and will be measured, but is not required to invent a performance claim.

Required proof before retention:

- Every untrusted checkpoint still reaches full native structural, support, archive-digest and qualification validation; malformed and forged objects cannot reach publication.
- Validated data remains privately owned across asynchronous archive work; mutation of caller inputs cannot alter the admitted result.
- Existing valid/invalid conformance fixtures retain inspection, correspondence, canonical bytes/IDs and error behavior.
- Explicit low-limit boundary cases preserve aggregate accounting; expression depth, cancellation before/during work, and whole-job deadlines remain enforced.
- Open/edit paths still validate their changed state; the checkpoint-specific shortcut cannot bypass their proof.
- The redundant validation traversal is removed, with the public interface and worker lifecycle unchanged.
- Real browser recovery/edit/capture and worker retirement checks pass; consolidated full verification precedes the final AGY review.

The smallest implementation should remain within `liveModel.js`, public admission/resource tests, and relevant declaration/decision documentation.
Stop if correctness requires copy removal, changed quota policy, a public trust flag, additional package interfaces, or a different worker lifecycle.
Bring that exact change back for a decision rather than widening this approval.
If the refactor cannot preserve these contracts cleanly, remove only its cohesive task edits and retain all failed evidence.

## Owner choices

**Option A — select the narrow admission refactor for maintainability (recommended).**
Approve the exact scope and independent purpose above, then continue the approved sequence.
The handoff will distinguish its architectural acceptance from measured performance.

**Option B — keep current admission and close S7 as not selected.**
Accept the existing redundant pass and known worker cost, then proceed to S8 and programme verification.

You can also request a different scope.
Neither option authorizes the other worker/cache approaches.

## Evidence and source locators

Relative to the HISEW evidence root, `operator/1aa50dbf88f44b05a24d9989246e6ada` contains both proposals, the digest work-count probe/results, its initial admission rejection, and `readmission-accounting-diagnostic.mjs` / `readmission-accounting.json`.
The private W5 bytes and raw production traces remain external.
The read-only diagnostics are not native full-verification receipts.

- [Public ranking interface](../../packages/vowl/src/index.js): `readModelRankingIdentity`.
- [ID issuance](../../packages/vowl/src/internalRdf.js): `issueIds`.
- [Existing bounded refinement reuse](../../packages/vowl/src/refinedRdf.js): `refineDataset`.
- [Checkpoint admission](../../packages/vowl/src/liveModel.js): `readmitLiveModel`, `admit`, `validateStructure`.
- [Resource policy](../../packages/vowl/src/resourceBudget.js) and [A8 contract](../specs/2026-09-24-canonical-vowl-core-contract.md#a8-resource-and-worker-policy).
- [Public recovery tests](../../packages/vowl/test/liveModel.test.js).
- [Worker dispatch](../../src/app/js/controller/canonicalVowlWorkerOperations.js) and [worker ownership](../../src/app/js/controller/canonicalVowlWorkerClient.js).
- [S0 production attribution](2026-10-22-performance-s0-evidence.md) and [S6 disposition](2026-10-23-performance-layout-evidence.md).
