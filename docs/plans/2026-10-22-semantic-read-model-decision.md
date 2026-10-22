# PERF-DEC-010: Whether to adopt a revision-owned semantic read model

| Field              | Value                                                                                                                          |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| Status             | Accepted and implemented: bounded SF for ownership and maintainability; focused proof complete, final qualification pending    |
| Date               | 22 October 2026                                                                                                                |
| Decision owner     | Maksym Shostak                                                                                                                 |
| Affected work      | Performance SF, followed by S3–S8; later UI handoff                                                                            |
| Accepted authority | Performance plan DEC-007 and SLICE-003; architecture contract S                                                                |
| Original candidate | Architecture commit `16e67c902e3438543f3ab520a40b45b2d9e2910a` plus S2; the 23 October implementation also preserves S3–S7     |
| Recommendation     | Original: close SF. Revised proposal: bounded adoption for ownership and maintainability; see the dated reassessment below     |
| Confidence         | High in copy elimination and existing ownership; moderate in residual-work materiality because foreground timings are deferred |

## Decision in plain language

The sections through "Evidence locators" preserve the accepted 22 October decision and its evidence.
The [23 October reassessment](#23-october-architectural-reassessment) and the owner's subsequent approval supersede the earlier no-selection disposition.
The earlier evidence and decision remain historical records.

**Accepted decision: keep S2's small, tested change and move to S3.**
The owner approved "Close SF as not selected (recommended)" on 22 October 2026.
Contract S is not adopted; the UI handoff must use the actual S2 ownership contract.
S2 lets internal readers use the session's existing frozen inspection without copying the entire document on each click.
SF would go further: a new session-owned semantic read model would prepare and coordinate description, focus, search, neighborhood and reveal-rank data across their different lifetimes.

The remaining measured description work is small in absolute terms.
The session already owns the prepared-search and neighborhood caches; SF's additional benefit would mainly be consolidating their ownership with describe/focus preparation and the controller's reveal-rank cache.
That can be a valid architectural purpose, but it has not yet been accepted as sufficient to justify this extra component and its invalidation rules.

This decision is required because the [approved performance plan](2026-10-21-performance-implementation-plan.md#slice-003--sf-optional-revision-owned-semantic-read-model) expressly leaves SF adoption or closure to the owner after S0 and S2.
Your approval of the overall plan accepted that selection policy; it did not preselect SF.

## Evidence and uncertainty

| Observation                                                                     | Evidence                                                                                                                                                                                                            | Implication                                                                                                               |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| The expensive whole-inspection click copy is gone                               | W5 all: projected-inspection clones fall from 1 to 0; total cloned input falls from 12,518,764 to 142,858 approximate serialized bytes                                                                              | S2 delivers its deterministic read-copy target without introducing a cache                                                |
| Copy isolation remains explicit                                                 | Eight new tests cover summary, description, focus, focus application, filtered arrangement, nested retained facts, mutable public copies and retirement; 208 affected tests and 223 downstream UI/WebMCP tests pass | A broader model is not needed to establish S2's ownership contract                                                        |
| Residual description preparation is not established as a material click hotspot | Candidate W5 all: inspector-inclusive sampled intervals total 2.280 ms in a 38.582 ms trace window, about 5.9%                                                                                                      | Below the plan's 15% operation-share selection threshold on this observed click                                           |
| Linear work remains                                                             | The click still performs 4,790 reference-shaped key serializations; describe and focus still prepare lookup collections from the inspection                                                                         | No claim that these reads are constant-time; the counter is not an exact count of description lookups                     |
| Existing caches already have owners                                             | Session owns prepared search and neighborhood projection; controller owns reveal ranks with a visibility signature                                                                                                  | Consolidation is an architectural option, not repair of a demonstrated stale-result defect                                |
| Environment limits remain                                                       | One measured trace cohort after warmup, headless and on a contended host; no native counter wrappers in this trace; all operation checks complete with no trace data loss                                           | Sampling and wait intervals limit precision; this is neither a p95 result nor proof that every ontology has the same cost |

The 2.280 ms figure includes inspector descendants; it must not be added to their separate self/inclusive totals.
The trace window includes 30.180 ms attributed to idle or program intervals and 1.277 ms unmapped.
The share of active sampled work would therefore be larger than the share of the complete operation.
The accepted gate uses the operation, and the small absolute cost matters when weighing another cache owner.
No end-user latency reduction or passed foreground budget is claimed.

The owner-directed foreground deferral remains in effect.
The [S0 evidence report](2026-10-22-performance-s0-evidence.md) preserves calibration, rejected runs, counter methods and selection limitations.
Private ontology contents and raw traces remain outside Git and external review inputs.

## Options and consequences

| Criterion         | Option 1: close SF as not selected — recommended                                                       | Option 2: adopt SF for an explicit ownership purpose                                            | Option 3: defer the decision for additional measurements                                       |
| ----------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Immediate result  | Retain S2 and continue the approved sequence at S3                                                     | Implement contract S before S3                                                                  | Keep the SF decision open and hold S3                                                          |
| Main benefit      | Focus implementation on the larger measured copy, rendering and worker costs                           | Give semantic preparation and invalidation one explicit owner                                   | Reduce uncertainty about residual description cost on additional queries/workloads             |
| Main cost         | Repeated describe/focus lookup preparation remains; reveal ranks retain their current controller owner | Add a component, migration work, corpus differential tests and ten-cycle lifetime qualification | Delay downstream work; headless sampling still cannot settle foreground latency budgets        |
| Main risk         | A later consumer may make repeated preparation material                                                | Wrong revision, language, prefix or visibility invalidation can return stale semantic answers   | More diagnostics may not change the choice because the observed absolute work is already small |
| Performance claim | None for SF; preserve S2's measured work-count result                                                  | No speedup claim from consolidation alone                                                       | No claim until comparable evidence exists                                                      |
| UI consequence    | UI uses the actual frozen reader/owned-result contract from S2; it cannot assume contract S exists     | UI may depend on the accepted model only after its equivalence/lifetime proof                   | UI review remains deferred with the performance sequence                                       |

**Recommendation: Option 1.**
The observed residual work does not currently justify SF as a performance optimization, and a separate consolidation purpose has not been accepted.
S3–S6 have stronger measured targets involving whole-document copies and repeated forced layout.
Closing an optional slice is an explicit terminal disposition; it does not report its proposed implementation as delivered.

Option 2 is reasonable if you value a single invalidation owner enough to accept the implementation and proof burden independently of a measured speedup.
That approval must name the ownership purpose rather than reinterpret the diagnostic trace as a passed performance gate.

## Concrete behavior across the options

| Scenario                          | Option 1                                                                              | Required behavior if Option 2 is chosen                                                                                |
| --------------------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Repeated click on one document    | Read the same frozen inspection; rebuild the existing description lookup              | Reuse semantic preparation; return equivalent owned or deeply frozen values                                            |
| Pan or selection change           | Existing presentation/lifecycle rules apply                                           | Reuse visibility-independent preparation; do not rebuild it merely for pan or selection                                |
| Language or prefix change         | Session replaces the inspection projection and refreshes prepared-search presentation | Refresh every affected label/presentation answer without retaining stale language or prefixes                          |
| Node-count/filter change          | Read current visible graph; current reveal-rank signature controls its cache          | Refresh visibility-dependent answers without corrupting semantic identity or unnecessarily rebuilding semantic indexes |
| Accepted edit or replacement load | Current session ownership replaces the accepted revision/generation                   | Retire the whole prior model with that accepted identity; no prior-generation result may become current                |
| External caller mutates a result  | Public inspection copies remain owned; shared internal values remain deeply frozen    | Preserve the same explicit ownership guarantee; internal indexes never escape                                          |

S1 remains not selected under its accepted cue-cost policy.
Option 2 would not silently authorize S1's proposed lightweight cue API, new cue resolver, or changed reveal policy.
Any such change needs its own recorded basis.

## Acceptance, recovery and reopen conditions

Option 1 is accepted: SF is not selected in the performance plan; retain the S2 reader contract and this decision, then start S3's result-consumer audit.
The UI handoff must explicitly state that contract S was not adopted.

If Option 2 is accepted, implement the full justified contract S coherently: lazy revision/presentation ownership, equivalent results on FOAF/GoodRelations/benchmark, correct visibility and language/prefix refresh, no leaked indexes and ten-cycle equal-live-size retirement checks with positive controls.
Stop for answer drift or unclear invalidation ownership.
Reverse only the cohesive task changes if the candidate fails; preserve unrelated work and all failed evidence.

Reopen SF when isolated measurements establish material residual describe/focus preparation, when a new consumer materially increases repeated semantic reads, or when a concrete invalidation defect or owner-accepted consolidation purpose changes its value.
Reopening does not retrospectively qualify deferred foreground budgets.

## Evidence locators

Relative to the configured HISEW evidence root, `operator/6bd24cfbcf20426997d1cdc23b0f08d0` contains the S2 source snapshot, product patch, production manifest, build log, focused red/green logs, affected-test log, `W5-all-counters`, `W5-all-trace` and `s2-attribution.json`.
The earlier W5 all baseline is retained in `operator/ff117630943c442a83c7bd9be3d695d1`.
Operator evidence and native verification receipts are separate claims.
Final full verification and the final AGY review remain scheduled after the consolidated performance implementation.

## 23 October architectural reassessment

**Revised recommendation: adopt a bounded SF for ownership and maintainability, independently of a measurable speedup.**
The owner requested this reassessment after accepting the analogous architectural purpose for S7.
The owner subsequently answered **"Approve bounded SF now (recommended)"** on 23 October 2026.
This accepts the exact purpose, scope and proof obligations below and supersedes the earlier no-selection disposition.
Completed S3–S7 work is preserved; SF is integrated before S8 and consolidated final qualification.
Acceptance does not establish implementation correctness or a speedup.

The earlier recommendation acknowledged an ownership benefit but weighted it primarily against measured query cost and new cache complexity.
That was too narrow for this architectural objective.
The stronger case is to encapsulate how a query obtains the right semantic preparation for an accepted revision, without making each caller understand its location and retirement rules.
Neither the small measured click cost nor the absence of a known stale-result bug disproves that maintainability benefit.

### Research and its application

| Primary source                                                                                                                    | Relevant guidance                                                                                                                                         | Application and limitation                                                                                                                                     |
| --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Ousterhout, Stanford: Managing Complexity](https://web.stanford.edu/~ouster/cgi-bin/cs190-spring15/lecture.php?topic=complexity) | Hide design decisions behind a useful, small interface; an extra forwarding layer does not create that value.                                             | SF earns its place only if query preparation and retirement knowledge leave its callers. File count and cache count are not success criteria.                  |
| [Redux: Deriving Data with Selectors](https://redux.js.org/usage/deriving-data-selectors)                                         | Derived queries encapsulate state shape; keeping authoritative state minimal reduces synchronization work. Memoization is a separate optimization choice. | Apply the encapsulation principle to the existing plain JavaScript modules. This proposes no Redux dependency, new authoritative store or blanket memoization. |
| [Fowler: CQRS](https://martinfowler.com/bliki/CQRS.html)                                                                          | Separate read models can help a suitable domain, but also add complexity and consistency obligations.                                                     | SF is a synchronous, in-process derived query interface. Distributed read stores, events and eventual consistency have no justification here.                  |

These are design principles, not a standard mandating SF.
The following recommendation is an inference from the current source and its actual consumers.

### Current source and the ownership benefit

The reassessment uses the current S2–S7 candidate, rather than assuming the original architecture-review findings still apply unchanged.
In particular, S2 removed the whole-inspection copy, S3 made returned materialization belong to its originating result, and S5 established frozen producer ownership.
SF must preserve those delivered contracts.

| Current responsibility                    | Current authority and consumers                                                                                                                                 | Proposed change                                                                                             |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Prepared search                           | `canonicalVowlDocumentSession.findOntologyElements` owns `accepted.search`; `ontologyInspector.prepareOntologySearch` owns preparation and presentation updates | The read model owns this preparation; the session owns the read model's lifetime                            |
| Neighborhood preparation                  | Session's `accepted.neighborhood` uses the native search projection and semantic-reference helpers                                                              | Move its ownership into the same read model; retain the existing semantic rules                             |
| Description and focus                     | `ontologyInspector` reconstructs record/reference collections for each call; the controller supplies inspection and visible snapshots                           | Encapsulate shared preparation and current inputs behind the read interface                                 |
| Reveal-rank preparation                   | Controller's `revealCache` owns a signature, ranking lookup and occurrence-to-reference aggregation                                                             | Move derived preparation to the read model; keep view mutation and reveal policy with their existing owners |
| Reference resolution and projection rules | Existing controller-contract, semantic-reference, visibility and projection modules                                                                             | Reuse these rules; consolidation does not justify replacing their semantics                                 |

This is dispersed ownership of preparation, not seven independent implementations of the same semantic rule.
The existing inspector already shares query logic, and the session already retires its own search/neighborhood state.
The new value is that a maintainer adding a semantic query should not have to choose another cache owner or add retirement handling in the controller.

The current code is not demonstrated to be incorrect.
A fresh recheck passed **147 tests across five suites**, covering inspector queries, frozen-read ownership, session revisions, search projection and controller integration.
The consolidated S2–S7 production candidate also completed ten W5 load/edit/capture cycles: the retention control detected two deliberately retained old owners, released controls returned to zero, every measured cycle had zero retired owners/workers, and disposal released all 44 tracked owners.
These are current-behavior and lifetime checks, not proof of an unimplemented SF.

### Bounded proposal and exact effects

Create one `canonicalVowlSemanticReadModel.js` module with a small interface for the existing describe, focus resolution, find, neighborhood and reveal-rank queries.
The accepted session owns it and creates it lazily.
It is derived entirely from the existing admitted inspection and presentation; it cannot become a second semantic authority.
Its public object and retained inputs are immutable; private lazy preparation may remain internal.
The controller obtains it for the current operation and keeps lifecycle checks, view mutations and renderer access.

Do not introduce a universal query registry, per-query framework, global cache, new dependency, worker state or background synchronization.
Moving method names into a wrapper while leaving `accepted.search`, `accepted.neighborhood` and controller `revealCache` independently owned does not satisfy this proposal.
Retain distinct internal algorithms where their meanings differ.

| Input transition                                 | Required behavior                                                                                               |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| Accepted load or edit                            | Replace the revision owner; old references cannot become current, and retained old results never change meaning |
| Language, prefix or label-presentation change    | Publish the corresponding presentation-bound read interface; retained earlier results do not mutate             |
| Visibility/filter change                         | Supply complete current visibility inputs; update only visibility-dependent preparation/results                 |
| Pan, selection or viewport-only change           | Preserve semantic preparation unless an actual query dependency changed                                         |
| Failed preparation, rejected edit or stale reply | Keep the previously accepted read model and answers authoritative                                               |
| Dispose                                          | Release the owner and every private index/cache reachable only through it                                       |

Each cache must declare its actual inputs; placing everything under one owner does not make their invalidation rules identical.
Use immutable revision/presentation identity for semantic preparation and explicit current visibility inputs for focusability and reveal ranks.
Do not infer revision validity from a matching object identity or a partial key alone.

Predicted source scope is the new module plus `canonicalVowlDocumentSession.js`, `canonicalWebVowlController.js` and `ontologyInspector.js`, with their affected tests and documentation.
Reuse `canonicalSearchProjection`, semantic-reference, visibility and projection helpers directly.
Any extraction of existing result-bound projection belongs at the existing public controller/WebMCP interface; preserve its current limits, ordering, pagination and truncation flags.
Contract S's internal queries remain untruncated.
Changes to semantic rules, public result shapes, S1 cue/reveal policy, package validation, configuration or dependencies are excluded.
If those become necessary, return with the exact proposed change.

### Acceptance independent of speed

The architectural acceptance criteria are concrete:

1. The session owns one revision/presentation read model; independent controller reveal-cache ownership and session search/neighborhood attachments are retired coherently.
2. Callers request answers without building semantic lookup collections or managing their retirement; the model uses existing rule authorities.
3. Existing and independent corpus expectations agree for description, ordering, ambiguity/refusal, focusability, neighborhood and reveal results.
   Preserve the pre-change differential oracle through acceptance.
4. Test every transition above, including a rejected edit, language/prefix changes during a pending operation, and old-generation rejection.
   The query interface must not expose mutable indexes.
5. Retain S2/S3/S5 ownership guarantees and all public protocol limits.
   Ten-cycle lifetime checks with positive controls must show that the new owner is collectible.
6. Record actual work/timing changes and any regression honestly.
   No material speedup is required for the accepted maintainability purpose; no numeric foreground budget is thereby waived.

The main cost is a coordinated refactor across query preparation and its consumers, plus preservation/lifetime proof.
The main risk is answering from the wrong revision, presentation or visibility state.
If the design merely adds another owner, cannot preserve current behavior, or needs a broader change, stop this candidate and retain the current implementation and failed evidence.

### New owner choice

| Choice                                                                   | Consequence                                                                                                                                                  |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **A. Reopen and implement bounded SF for maintainability — recommended** | Accept the exact purpose/scope above. Complete this consolidation before final performance qualification and the UI review, preserving completed S3–S7 work. |
| B. Keep SF closed                                                        | Retain the current working design and its dispersed preparation ownership; proceed to S8 and final performance qualification.                                |
| C. Defer SF to the UI planning discussion                                | Keep it unselected in this performance delivery and make the architectural trade-off an explicit UI-plan input. No SF code is authorized now.                |

The owner may also request a different scope.
Choosing A explicitly amends the earlier order because S3–S7 are already implemented: completed work is preserved, then SF is integrated and the consolidated candidate is qualified once.

### Implementation verification route

The owner selected A in `call_2ad7de1f2de94dc0bb5fc5066e8d7d5e` on 23 October.
The implementation uses HISEW's preservation route: existing public semantics are already satisfied, so no artificial failure is introduced.
The pre-change recheck passed 147 tests in five suites.
The independent reference is the retained S2–S7 inspector/controller source and shipped FOAF, GoodRelations and benchmark artifacts, supplemented by explicit small-ontology expectations.

The affected boundary comprises internal read ownership, public query responses and revision/presentation publication. Focused checks cover description, search ordering/pagination/truncation, exact/coarse references, neighborhood refusal, reveal eligibility, failed edits, pending-operation presentation changes and stale generations.
Full repository verification, the scoped admission security assessment, final AGY review and foreground acceptance remain separate programme gates.
Production lifetime qualification must populate every preparation and positively detect a deliberately retained old read model before proving retirement.
All final tests and fixes still precede the final AGY review.
The required new choice comes from performance plan DEC-007/SLICE-003 and §4.4's separate-purpose rule; the old no-selection approval cannot be treated as adoption approval.

### Implemented result and focused evidence, 23 October

`canonicalVowlSemanticReadModel.js` owns lazy description, focus, search, neighborhood and reveal-rank preparation for an accepted revision/presentation.
The session publishes this owner lazily and retires it only after a successful semantic or presentation change; controller-owned reveal preparation and separate session search/neighborhood attachments are removed.
Existing semantic-reference, search-projection, visibility and neighborhood helpers retain rule authority.
The controller applies existing public pagination, text and relation bounds; internal queries retain complete answers subject to the existing atomic neighborhood safety refusal.
Visibility inputs govern focus/reveal answers, while count-only prefix changes, camera motion and selection preserve valid preparation.
Old read models keep their original meaning and cannot manufacture current-generation references.

The affected run passed **229 tests in nine suites**, including explicit transition, ownership and complete-internal/bounded-public expectations.
An independent differential runner compared **9,084 public results** from the retained pre-SF inspector/session/controller against the new implementation: FOAF 1,372, GoodRelations 2,944 and the shipped benchmark 4,768.
It covers descriptions, multilingual search ordering and pagination, focus, visibility filters, reveal, counts and neighborhoods.
This is semantic preservation evidence, not browser geometry or foreground latency evidence.

The source-bound production build passed with 50 assets totalling 12,636,919 bytes.
The W5 headless lifetime diagnostic populated all five query paths and detected three deliberately retained retired owners, including the read model.
Releasing the control retired all three.
All ten subsequent equal-live-size load/edit/capture cycles had **zero retired owners alive and zero workers**.
After disposal, **all 66 tracked owners were collectible**; used heap was 7,163,356 bytes, compared with 36,123,988 bytes at cycle ten.
The populated live candidate used about 1.81 MiB more heap than the preceding S7 diagnostic at cycle ten; disposed heap differed by about 150 KiB.
These single-run observations do not establish a latency regression, a heap distribution or a speedup.
DOM and listener counts matched the preceding S7 diagnostic: one document, 4,046 nodes and 1,253 listeners at cycle ten; 1,139 listeners after disposal.

Evidence is retained under operator root `1aa50dbf88f44b05a24d9989246e6ada`: `sf-affected.log`, `sf-preservation-result.json`, `sf-preservation-v2.mjs`, `sf-manifest.json`, `sf-build.log` and `W5-auto-lifetime-sf/result.json`.
The manifest binds source and build hashes; the differential report identifies reference modules and corpus inputs.
Initial test-fixture corrections and the first differential runner's disposal-service error remain in their original logs; corrected passing runs are separate artifacts.
CPU-admission and headless-diagnostic exceptions remain explicit, and foreground acceptance remains deferred.
The owner-requested intermediate commit uses this evidence without claiming the outstanding full suite, admission security assessment or final AGY review has passed.
