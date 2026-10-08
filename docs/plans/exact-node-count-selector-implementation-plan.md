# Exact node-count selector implementation plan

> **Status:** Draft for owner review, 8 October 2026.
> Implementation is not authorized or baselined by this document.<br>
> **Basis:** [Exact node-count research response](../reviews/webvowl-exact-node-count-research-brief-response.md), reconciled with local `main` at `2927ada73ac707165d55e702703608bff4ba5b26`.<br>
> **Source identity:** Research-response SHA-256 `579e03538b606839bca8bb9036bc58f0dc56e858431185cb997a81181aad41ec` at drafting.
> The response is a user-owned, untracked input; its recommendations are not all accepted requirements.<br>
> **Owner decision:** In the originating conversation, the user selected “Direct replacement; reject obsolete degree inputs” on 8 October 2026.
> This supersedes the response's proposed legacy `doc`/`minDegree` compatibility path.<br>
> **Method:** HISEW thin implementation planning, with a draft change dossier, R2 route, quality scenarios and traceability in this document.<br>
> **Purpose:** Let people and agents choose a predictable, exact amount of graph detail while preserving orientation and understanding what has been omitted.

## 1. Planned outcome and authority

Replace **Degree of collapsing** with **Nodes shown**.
For fixed eligible topology and ranking policy, compute one deterministic ordering of drawable node occurrences and display its first requested number of nodes.
Moving from 50 to 51 adds one occurrence without replacing the preceding 50; All displays every eligible occurrence.

The public URL option is **`nodesShown`**, replacing the existing **`doc`** option.
The research response's provisional `nodes` name is not adopted.
Examples use the application's actual fragment-options syntax:

```text
#opts=nodesShown=37;#foaf
#opts=nodesShown=all;#foaf
#opts=nodesShown=auto;#foaf
```

`doc` historically denotes a minimum degree, not a document or node count.
Reject it, including the existing `doc=-1` sentinel, with an actionable obsolete-option diagnostic.
Reject obsolete `minDegree` requests at application/API boundaries.
Do not reinterpret either value, run a legacy degree mode, silently drop it, or accept `nodes` as an alias.
Links without either old or new count options use the new default.

This task produces a reviewable plan only.
Source implementation, schema/configuration changes, dependency adoption, workflow baselining, delegation, security scans, commit, push and deployment require their applicable authority.
The user has approved the migration direction, not an implementation candidate or a release.

### 1.1 Scope and non-goals

In scope: canonical occurrence eligibility, deterministic selection, the compound control, initial loading and resets, ordinary filter interactions, selection/search/pins, view-state contracts, share links, WebMCP, restoration/export semantics, concurrency, accessibility, performance, documentation and degree-path removal.

Non-goals: changing OWL parsing or ontology meaning; ranking ontology concepts by claimed semantic importance; replacing the renderer or force engine; introducing an edge-count cap; automatically revealing whole expression bundles; unrelated URL renames; canonical-profile publication; AWS infrastructure changes; telemetry services or background automation.

### 1.2 Source reconciliation

| Research recommendation                                                    | Disposition in this draft                                                                                                                    |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Fixed deterministic ordering plus prefixes                                 | Retained as the exactness and nesting contract.                                                                                              |
| Count `class-node` and `datatype-node` occurrences                         | Retained, including grouped classes, drawable expressions and contextual datatypes.                                                          |
| `nodes=auto/all/integer`                                                   | Replaced by `nodesShown=auto/all/integer` under NAM-01.                                                                                      |
| Retain old `doc`, deprecated `minDegree`, precedence rules and legacy mode | Superseded by the explicit owner decision. Old inputs are rejected; no NSH-01 exception is requested.                                        |
| Derive stable structural keys in the viewer                                | Qualify native VOWL identity/correspondence first; do not introduce a second OWL/RDF canonicalizer.                                          |
| Version saved count intent                                                 | Requires the persistence decision in section 6. Existing canonical artifact schemas have no such field.                                      |
| Square-root component fairness                                             | Proposed first ranking policy, subject to counterexample evaluation before acceptance. It is a heuristic, not a semantic-importance measure. |
| Suggested timing and usability budgets                                     | Proposed acceptance gates, not measured performance or established product acceptance.                                                       |
| Layer-by-layer delivery phases                                             | Reorganized into observable vertical slices with explicit prerequisites.                                                                     |

## 2. HISEW route and starting checkpoint

### Risk class:

**R2 proposed for implementation.**
The observed public URL/WebMCP changes and deliberate retirement of old inputs trigger public-contract risk.
Ranking and latest-request handling introduce performance and concurrency obligations.
Drafting this plan does not establish an accepted R2 baseline.

### Decision owner:

The repository owner, acting through the originating task.
The implementation owner is accountable for integration; an independent verifier must be identified before final qualification.
No verifier or release observer has yet accepted an assignment.

### Reasoning:

Wrong membership, lost hidden-state provenance or stale commits can display a plausible but incorrect graph.
Large graphs can stall interaction.
Automatic checks can establish count invariants; they cannot alone establish comprehension, screen-reader usability or safe recovery of persisted state.

### Potential blast radius:

All canonical loads, filters, shared links, view automation and artifact restoration.
OWL semantic records and acquired source bytes are outside the intended mutation boundary.
Existing links carrying `doc` intentionally stop applying their saved degree state.

### Reversibility:

Local candidate changes can be withdrawn before release.
A qualified previous deployment can restore old runtime behavior, but it cannot interpret newly published `nodesShown` links or an unrecognized future state format.
Recovery must therefore include a tested reader-version strategy or forward fix; “revert the bundle” is not proof of lossless rollback.

### Principal unknowns:

Native stable ranking identity for live models; the saved-intent boundary; fairness policy; reference hardware and performance feasibility; supported assistive-technology coverage.
Each has a discriminating checkpoint in section 10.

### Required artifacts:

This draft's REQ/AC/QA/DEC register and slices; accepted exact requirement/design baseline before implementation; source-bound verification evidence; independent review; release/recovery evidence if delivery is subsequently authorized.
Reuse existing task records rather than inventing duplicate dossiers.

### Required specialist lenses:

Accessibility/usability, graph/projection semantics, performance and public-input/state integrity.
These are evidence obligations, not permission to spawn agents.
The changed URL/WebMCP inputs and bounded work require an explicit security assessment disposition; any native security scan follows its separately authorized procedure.

### Required verification:

HISEW inspection found active personal applicability and no active execution in this worktree.
The current project registration routes R2 to `full`, whose command is `npm run build`; `focused` is `npm run lint`, and `affected` is `npm run test`.
A successful build alone does not prove this feature.
Select the required `full` profile plus the relevant checks in section 9, without editing profile configuration.

### Required human approvals:

Acceptance of the exact R2 baseline and the unresolved consequential decisions; exact file-and-setting approval for any configuration change; separate commit, push and release authority when requested.
The direct replacement decision is already given and must not be requested again.

### Maximum sensible autonomy:

For this task, inspect evidence and write/validate the plan.
During authorized implementation, remain within the accepted baseline and ordinary source/test/document edits.
Stop before changing any package, lockfile, build, test, lint, CI, hosting, environment or repository-policy configuration without exact approval under [AGENTS.md](../../AGENTS.md).

### Next lifecycle step:

Resolve the bounded starting decisions below, then have the owner accept the exact requirement/design revision through HISEW before execution.
No implementation execution, baseline or acceptance is recorded by drafting this file.

## 3. Naming and domain contract

### 3.1 NAM-01 vocabulary

HISEW NAM-01 requires semantic correctness and precision at use sites, including retained names whose meaning changes.
A plural `nodes` could mean a collection, node identifiers, ontology nodes or all graph nodes.
It does not distinguish the number selected for display.
`doc` describes neither its old degree threshold nor the proposed behavior.

`nodesShown` is the public **selection setting**: how many eligible drawable occurrences the view should show, or the policy that determines that number.
It is not a collection and is not read-only evidence that a render has completed.
The typed state makes the distinction explicit:

| Concept                                     | Proposed name and meaning                                                                                           |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Visible control and documentation term      | **Nodes shown**. “Node” means a drawable canonical occurrence in this context.                                      |
| URL selection setting                       | `nodesShown`, with `auto`, `all` or a non-negative decimal integer.                                                 |
| Application and WebMCP selection intent     | `nodesShown: { mode: "auto" }`, `{ mode: "all" }`, or `{ mode: "exact", requestedCount: 37 }`.                      |
| Latent exact target                         | `nodesShown.requestedCount`; retained across temporary eligibility reductions.                                      |
| Number available before count selection     | `eligibleNodeCount`.                                                                                                |
| Number in the committed rendered membership | `shownNodeCount`; use this for observed status, not the uncommitted input value.                                    |
| Complete ordered occurrence identifiers     | `rankedNodeOccurrenceIds`; these are identifiers, not counts.                                                       |
| Hiding caused by the count boundary         | `countHiddenOccurrenceIds`, distinct from upstream explicit/restored hiding.                                        |
| Ordering semantics                          | `nodeRankingPolicyVersion`, distinct from the state-schema version and document revision.                           |
| Compound UI module/factory                  | Predicted `nodesShownControl.js` / `createNodesShownControl`; does not retain “degree” in a changed responsibility. |

These names are a coherent proposed vocabulary, not permission to rename unrelated graph-model `nodes` collections or local `doc` variables meaning DOM documents.
Review public fields, events, factories, test descriptions, DOM IDs/classes, filenames, documentation and generated-source inputs together.
Audit `degreeFilterRange`, `automaticMinimumDegree`, `useAutomaticDegree` and degree-control imports for removal or accurate replacements.
A new range/status object must describe node counts, not retain a degree-named container.
Do not maintain synonyms for the same state across UI, controller and WebMCP.

### 3.2 Membership and intent

Let `V` be eligible `class-node` and `datatype-node` occurrences after non-count node filters and explicit/restored hiding, but before count hiding.
Let `N = |V|`.
Labels, edges, arrowheads and off-screen status do not define node counts.
Grouped equivalent classes count once; distinct contextual datatype occurrences count separately.
A pin preserves placement; it does not force membership.

For one graph/filter/policy signature, let `P` be a permutation of `V` and `S(k)` its first `k` occurrences.
Require `|S(k)| = k`, `S(k)` to be a subset of `S(k + 1)`, and `S(N) = V`.
Empty input yields an empty sequence.
Changing filters or the document may change `P`; moving only the count boundary may not.

| Selection | Applied count            | Behavior when eligibility changes                                              |
| --------- | ------------------------ | ------------------------------------------------------------------------------ |
| `auto`    | `min(N, 50)`             | Recompute while automatic intent remains active.                               |
| `exact`   | `min(N, requestedCount)` | Preserve the latent request; explain a shortfall and restore it when possible. |
| `all`     | `N`                      | Follow all newly eligible nodes.                                               |

A request for 100 with only 73 available displays 73 and reports the retained target 100.
This is an explicit availability rule, not silent numeric coercion.
Moving a slider to its maximum or entering `N` selects `exact`; the All action selects `all`.
A fresh ontology load without explicit/restored intent starts automatic selection.
Reset restores `auto` alongside the existing reset contract; edit/undo/filter operations preserve intent and rebuild eligibility as necessary.

Interactive entry accepts a whole number in the currently available range.
URL/API restoration accepts a non-negative safe-integer target above current `N`, because availability may have changed since sharing.
Decimal fractions, signs, exponents, non-finite/unsafe values, blank committed values, ambiguous duplicates and unknown modes fail validation without changing the last committed view.
Use native URL parsing and the owning application contract validator; do not use permissive `parseInt` coercion.

### 3.3 Deterministic topology and identity

Build an undirected ranking topology from eligible endpoints and surviving visual relationships.
Unique-neighbor degree is primary; count each incident relationship once as a secondary multiplicity signal.
Self-relations create no distinct neighbor and contribute at most once to incident multiplicity.
Grouped property payloads do not invent additional relationship occurrences.
Include datatype endpoints.

Within each connected component, seed by descending unique-neighbor degree, descending relationship multiplicity, then ascending canonical ranking key.
Expand only from its frontier by descending already-selected-neighbor count, total unique-neighbor degree, relationship multiplicity, then the same stable key.
Merge component sequences by the response's proposed `sqrt(componentSize) / (1 + emittedCount)` priority, with a canonical component-key tie-break.
Define comparator precision and exact ties; prove comparator consistency.
No random, parse-order, locale-sensitive label or force-position tie-breaks.

The [VOWL public contract](../../packages/vowl/README.md) distinguishes canonical documents from live models: `openOwl` and `editModel` do not run RDFC; handles are revision-local.
The internal `occurrenceKey` helper defaults to semantic references as supplied and is not itself proof of representation-independent ranking identity.
Canonical artifact IDs can also change with artifact state.

The first experiment must use supported structural-content `captureModel` and its correspondence to establish canonical ranking keys without installing those canonical IDs as live handles.
Cache that result by structural revision.
Prove that placement, camera, label language and the count selection do not affect ranking keys.
Check blank-node relabeling, shuffled statements, grouped targets, contextual datatypes and anonymous expressions.
Symmetric cases require an explicit correspondence/isomorphism oracle, not comparison of arbitrary source handles.
If this supported route is too expensive or lacks the needed correspondence, re-plan the producer-owned identity capability; do not reproduce RDF canonicalization in the viewer or import private package helpers.

## 4. Draft requirements and acceptance criteria

These stable IDs are the draft baseline for review.
They do not imply prior acceptance of inferred details.

| Requirement                                                  | Acceptance criterion                                                                                                                                                                                                    | Evidence                                                                           |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| REQ-001: Count drawable occurrences correctly.               | AC-001: Counts include eligible class/datatype occurrences only; grouped/contextual/operator cases and `N = 0` match hand-authored fixtures.                                                                            | Projection fixtures and independently counted rendered membership.                 |
| REQ-002: Provide exact, nested selection.                    | AC-002: Every `k` in `0..N` has exactly `k` members; adjacent prefixes are nested; maximum equals all eligible nodes.                                                                                                   | Exhaustive small-graph/property tests; browser checks at 0, 1, `N - 1`, `N`.       |
| REQ-003: Make membership deterministic and topology-aware.   | AC-003: Identical eligible topology/policy yields identical order; equivalent representations agree through the qualified canonical correspondence; disconnected/datatype/parallel-edge fixtures match accepted policy. | Explicit expected orders and metamorphic representation tests.                     |
| REQ-004: Preserve selection intent.                          | AC-004: `auto`, `exact`, `all`, latent targets, resets, source changes and filter changes follow section 3.2.                                                                                                           | Controller/session tests and user-visible shortfall status.                        |
| REQ-005: Support precise, accessible interaction.            | AC-005: Range, exact entry, minus/plus and All remain synchronized; invalid drafts do not commit; wheel scrolling does not mutate count or get cancelled by the control.                                                | Native-browser, keyboard, pointer, touch and AT checks.                            |
| REQ-006: Preserve orientation and graph meaning.             | AC-006: Retained nodes are not reseeded; camera, pause state, hidden pins and logical selection survive; search reveal explicitly raises count; omitted operands remain discoverable in details.                        | Scene/controller tests and browser before/after state assertions.                  |
| REQ-007: Replace degree contracts coherently.                | AC-007: New URL/WebMCP requests round-trip intent; every obsolete degree input, including mixed old/new input and `doc=-1`, rejects before mutation; no degree alias or runtime mode remains.                           | Consumer corpus, negative boundary tests and source/contract audit.                |
| REQ-008: Restore/persist state without inventing provenance. | AC-008: The owner-selected persistence contract in section 6 restores its promised membership and/or intent; count-hidden nodes cannot become permanently upstream-hidden through recovery.                             | Save/reopen, worker-recovery, failure and version-rejection tests.                 |
| REQ-009: Commit only current work.                           | AC-009: Superseded ranking, visibility and layout results cannot update graph, status, focus or persisted state; failed work leaves the preceding coherent view.                                                        | Deliberately reordered completion, disposal, abort and document-replacement tests. |
| REQ-010: Bound interactive cost.                             | AC-010: Accepted performance gates include identity preparation, ranking, visibility and final rendering separately; count-only changes reuse ranking and bounded current work.                                         | Reproducible benchmark record; no imported timing claims.                          |
| REQ-011: Respect naming, reuse and trust boundaries.         | AC-011: NAM-01/DOC-01 review closes all changed consumers; public VOWL/native validators are reused; no unauthorized compatibility bridge, dependency or configuration edit appears.                                    | Exact-diff review and selection/adoption evidence.                                 |
| REQ-012: Deliver with a credible recovery route.             | AC-012: Independent verification and live acceptance cover the approved candidate; previous-reader behavior for new links/state is rehearsed; cleanup and observer ownership are recorded.                              | Release-readiness, deployment readback and recovery evidence if authorized.        |

## 5. Quality scenarios and independent oracles

| Scenario                        | Stimulus/environment                                                                                                          | Required response and measure                                                                                                                                                                             |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| QA-001: Membership              | Enumerate all simple small eligible graphs and selected semantic projection fixtures.                                         | Independently count `S(k)`, verify permutation/no duplicates, exactness, nesting and maximum for every `k`; do not derive expected membership with production ranking code.                               |
| QA-002: Representation          | Reload equivalent documents with reordered statements, renamed source blank nodes and reordered set operands.                 | Match full order through native canonical correspondence; compare structural identity independently of camera and layout.                                                                                 |
| QA-003: Eligibility             | Toggle every node/relationship filter and explicit hiding, including a datatype-heavy graph.                                  | Node filters change `N`; relationship-only filters can change rank but never remove otherwise eligible endpoints. Undoing count hiding restores eligibility correctly.                                    |
| QA-004: Input and accessibility | Enter 37 of 109, add one, choose All, return to 37, enter invalid text, scroll over the control and operate without dragging. | Exact results, retained editing/focus, associated validation/status, no wheel-driven count change; keyboard and selected AT/device evidence recorded.                                                     |
| QA-005: Spatial continuity      | Change count while paused, pinned, running, reduced-motion enabled and with a hidden selected/search result.                  | Paused coordinates and camera remain unchanged; running layout starts from retained positions without reseeding; hidden pins survive. Reveal changes intent explicitly and only after eligibility checks. |
| QA-006: Supersession            | Rapid count/filter updates overlap ranking, an edit, recovery or a new load.                                                  | Only the current document/view revision commits. No late status announcement, invisible state overwrite, leaked listener or orphaned ranking job.                                                         |
| QA-007: Public boundary         | Supply old/mixed/duplicate options, invalid numbers and malformed WebMCP state.                                               | Reject before expensive work or view mutation; diagnostics identify the unsupported field and new setting without translating degree to count.                                                            |
| QA-008: Persistence             | Save, reopen, recover or interrupt capture at zero, exact shortfall and All.                                                  | Observe the explicitly selected state contract; preserve the original artifact on failure; no guessed distinction between explicit and derived hiding.                                                    |
| QA-009: Scale                   | Cold/warm runs on small, medium, large, dense, isolate-heavy and expression-heavy fixtures.                                   | Meet accepted latency/bounded-work budgets; correctness always holds even if timing fails.                                                                                                                |
| QA-010: Recovery                | Reject a candidate, abort an update and rehearse deployment recovery after generating new links/state.                        | Last committed view survives local failure; release recovery has an honest old-reader/new-state disposition rather than a claimed transparent downgrade.                                                  |

The implementation owner maintains fixture provenance and expected outcomes.
The independent verifier owns final oracle review.
Use actual VOWL projection/admission and scene/runtime code in integration tests.
Mock only genuine external boundaries such as network acquisition, worker scheduling and browser timing where a focused test needs control; real-browser and real-worker evidence must cover those mocked boundaries separately.
Do not mock the selector into returning the expected set or compute expected order with the selector under test.

## 6. Persistence, migration and contract decisions

### 6.1 Accepted retirement policy

Remove obsolete degree inputs across the current consumer path as one coordinated change.
Rejection is ordinary boundary error handling, not an alias.
For URLs containing both `doc` and `nodesShown`, reject the obsolete option instead of applying precedence.
For WebMCP, reject `minDegree` even when a valid `nodesShown` is present.
A rejected request preserves the active document/view; an initial invalid link shows recovery guidance and requires an explicit corrected request.

The replacement diagnostic must explain that degree and node count are different quantities, so an old value cannot be copied mechanically.
Re-sharing a new view emits only `nodesShown` and the existing unrelated view options.
No backfill can infer an equivalent exact subset from a degree value alone.
Historical research and migration documentation may mention old names; executable acceptance and ordinary current examples must not advertise them as supported options.

### 6.2 Persistence decision required before implementation acceptance

The current canonical `Visualization` grammar stores placements, camera, `hidden`, label selection, prefixes and display settings.
It has no `minDegree`, count-intent or ranking-policy field.
The response's assumption about old artifacts containing `minDegree` is therefore not an established current canonical contract.
Inventory any other actual saved-state consumers before claiming one exists.

Two supported outcomes must be distinguished:

1. **Canonical snapshot, existing format:** Save the resulting membership through the existing complete hidden set.
   Reopen those hidden entries as restored upstream state and initialize Nodes shown to All of the restored eligible set, preserving the snapshot.
   This round-trips appearance, not the latent target, automatic policy or count-hidden provenance; the control's All means all eligible nodes after restored hiding.
   Documentation must say so explicitly.
2. **Count-intent round-trip:** Preserve `nodesShown`, ranking-policy version and upstream hidden state separately in an actual versioned application-state contract or an explicitly approved new artifact-profile contract.
   The owning producer must validate it.
   Existing closed VOWL profiles must not accept ad hoc fields or reinterpret old hidden arrays.
   A new format requires its own consumer inventory, version/rejection behavior, recovery proof and exact schema/configuration approvals where applicable.

**DEC-007 is open:** the repository owner must choose whether this feature's release requires the second outcome or accepts the first outcome with URL/API intent round-tripping.
The implementation owner supplies a concrete public format proposal if the second is required.
The present draft recommends retaining canonical snapshot semantics for existing formats and keeping count intent in the application boundary; it does not invent an existing persistence envelope or silently drop the response's intent requirement.

Within a live session and worker recovery, always keep explicit/restored hiding separate from count-derived hiding.
Reconcile occurrence correspondence after edits/undo before recomputing rank.
If provenance is unavailable, reject the unsupported restoration rather than guessing or permanently hiding the previous count suffix.
Do not add automatic rewriting of user files, a background migration or a legacy reader without a new owner decision.

### 6.3 Decision register

| Decision                               | Status and owner                                                          | Constraint                                                                                                               |
| -------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| DEC-001: Public naming                 | Draft, derived from the user's naming correction; owner accepts baseline. | `nodesShown` is selection intent; observed values use `shownNodeCount` / `eligibleNodeCount`.                            |
| DEC-002: Degree retirement             | Accepted by the user in this task.                                        | Direct replacement; obsolete degree inputs reject. No legacy bridge or NSH-01 override.                                  |
| DEC-003: Counting and eligibility      | Draft from the response.                                                  | Occurrences, upstream node eligibility, edge-only topology effects, zero and All as defined above.                       |
| DEC-004: Ranking policy                | Draft product policy for owner review.                                    | Connected expansion plus square-root weighted merge; freeze tie rules before public use.                                 |
| DEC-005: Stable identity               | Native route proposed; proof pending.                                     | Reuse structural canonical capture/correspondence; no viewer-owned canonicalizer or assumption that live IDs are stable. |
| DEC-006: Intent and revision semantics | Draft.                                                                    | Separate requested/applied values and fence asynchronous work by document and view revision.                             |
| DEC-007: Persisted intent              | Open owner decision.                                                      | Select snapshot-only versus versioned intent restoration before baselining affected slices.                              |
| DEC-008: UI behavior                   | Draft from response and native-platform guidance.                         | Native range plus exact entry, minus/plus and All; no wheel capture.                                                     |
| DEC-009: Budgets and validation matrix | Open acceptance details.                                                  | Name reference devices/browsers, AT coverage and measurement method before qualification.                                |
| DEC-010: Release/recovery              | Proposed, requires release authority.                                     | Coherent consumer cutover; no implicit deployment or untested rollback claim.                                            |

For share links, this draft guarantees intent and deterministic membership only for unchanged source content, eligible topology and accepted ranking policy.
A URL alone does not pin mutable ontology bytes.
If links must reproduce membership across future ranking-policy changes, accept an explicit versioned link contract before the first release.
An internal version used only as a cache key cannot provide that guarantee.

## 7. Reuse and predicted architectural seams

### 7.1 Reuse assessment

Research refreshed on 8 October 2026 against the local baseline and primary documentation.
The supplied response analyzes ranking approaches, but does not complete package selection, exact license review or live-identity qualification.
Do not label those gates passed.

| Capability                         | Reuse evidence and fit                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Residual work / disposition                                                                                                                                                                                                                                                              |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Projection, identity and admission | Existing public `vowl` operations provide normalized occurrences, canonical structural capture, correspondence and closed validation. The private workspace package is explicitly experimental, not a verified stable release.                                                                                                                                                                                                                                                                                                         | Qualify native correspondence and cost; reuse owning validation. Existing package adoption authority does not authorize changing its public profile.                                                                                                                                     |
| Visibility and placement           | `canonicalVowlScene.js` owns visibility closure and retained placements; document session/controller already support revisions and transactional preparation.                                                                                                                                                                                                                                                                                                                                                                          | Separate upstream/count hiding; commit selected membership without reparsing, reprojecting or reseeding.                                                                                                                                                                                 |
| Native inputs and URL parsing      | HTML range/text/buttons, `URL`, `URLSearchParams` and existing runtime contract constructors.                                                                                                                                                                                                                                                                                                                                                                                                                                          | Application-specific count grammar/intent and accessible synchronization. No widget or URL-parser dependency selected.                                                                                                                                                                   |
| Graph primitives                   | [Graphology components](https://graphology.github.io/standard-library/components.html) supplies connected-component operations; [Cytoscape algorithms](https://js.cytoscape.org/#collection/algorithms) supplies traversal/centrality algorithms. npm registry metadata observed [graphology 0.26.0](https://registry.npmjs.org/graphology/0.26.0), [graphology-components 1.5.4](https://registry.npmjs.org/graphology-components/1.5.4) and [cytoscape 3.34.3](https://registry.npmjs.org/cytoscape/3.34.3) as latest at inspection. | These documented primitives do not establish the complete WebVOWL eligibility, tie-break, prefix, intent and scene contract. Compare supported composition against existing primitives before writing generic components/queues. No package selected, installed or cleared for adoption. |
| Testing and measurements           | Existing Jest, source fixtures, browser checks, performance APIs and documentation tooling.                                                                                                                                                                                                                                                                                                                                                                                                                                            | Use bounded enumeration and deterministic generators within the existing harness where suitable; new property-testing, heap or benchmark dependencies require exact selection/approval.                                                                                                  |

The residual custom behavior is the domain-specific ordering policy and its integration with WebVOWL eligibility, view intent and presentation.
Generic graph algorithms or canonicalization are not automatically part of that residual.
Before choosing additional software or writing an otherwise reusable primitive, complete the remaining REU-01 comparison with maintained source/tests, exact release identity and integration measurements.
Inspect exact license text, riders/transitive obligations and distribution requirements under LIC-01; registry license labels are not clearance.
VER-01 requires a fresh stable/LTS check for actual adoption.
No dependency/configuration change is currently proposed as necessary.

### 7.2 File and ownership predictions

Paths below identify likely seams, not a fixed edit list or permission to change configuration.

| Seam                             | Current / predicted files                                                                                                                                                            | Responsibility                                                                                                       |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| Eligibility and ordering         | `src/app/js/controller/canonicalVowlViewControls.js`; predicted `canonicalNodeOrdering.js`                                                                                           | Produce eligible topology and one cached order without making UI or serialization decisions.                         |
| Initial load and native identity | `src/app/js/controller/canonicalVowlDocumentSession.js`, `canonicalVowlWorkerClient.js`, `canonicalVowlWorkerOperations.js`                                                          | Use the existing worker protocol/capture operation and correspondence; preserve document admission and cancellation. |
| Orchestration/editing            | `src/app/js/controller/canonicalWebVowlController.js`, `canonicalVowlEditorView.js`, `canonicalVowlScene.js`                                                                         | Own intent, signatures, visibility preparation and coherent commit; reconcile edits/undo and preserve scene state.   |
| Application contracts            | `renderedGraphRuntimeContracts.js`, `webVowlControllerContracts.js`, `src/app/js/ui/controllerStatePresenter.js`                                                                     | Validate selection intent and expose observed counts and pending state.                                              |
| UI                               | `src/app/js/ui/degreeFilterControl.js` replaced by `nodesShownControl.js`; `visualizationViewControlsAdapter.js`, `src/app/js/app.js`, `src/index.html`, `src/app/css/toolstyle.css` | Replace labels, DOM hooks, control lifecycle and view wiring consistently.                                           |
| Shared links and agents          | `visualizationShareLink.js`, `src/app/js/webmcp/webMcpToolContracts.js`, `webMcpAdapter.js`                                                                                          | Round-trip intent; reject removed fields; return observed counts through the owning contracts.                       |
| Search/details                   | `src/app/js/menu/searchMenu.js`, sidebar/detail presenters and scene omission cues                                                                                                   | Explain hidden results and omitted operands; explicit reveal raises the count to the selected occurrence's rank.     |
| Persistence                      | Existing document-session capture/recovery and artifact-service consumer, plus any owner-approved state contract                                                                     | Implement DEC-007 without ad hoc canonical fields or guessed provenance.                                             |
| Documentation and tests          | Corresponding current tests; application docs and affected canonical specs only if their contracts change                                                                            | Record public semantics, migration, naming and independent evidence; rebuild generated outputs from source.          |

Cache identity includes structural revision/canonical identity, node filters, relationship filters, upstream hiding and ranking-policy version.
It excludes count, camera, coordinates, language and transient selection.
Dispose cached data on document replacement.
A count-only change computes a prefix delta; downstream visibility closure may still scan edges and must be measured honestly.

## 8. Vertical slices, dependencies and traceability

One implementation owner integrates the coupled controller/session/UI/API changes.
The slice order is contractual; modules listed above are predictions.
Independent fixture-oracle review, accessibility scenario preparation and benchmark-environment definition may proceed separately after shared contracts are frozen, if delegation is explicitly authorized.
Do not assign overlapping writers to state, identity or URL semantics.

| Slice     | Observable increment                                                                                                                                                                     | REQ / AC / QA / DEC trace                                                                    | Falsifiable proof                                                                                                                                                                                                         | Release and cleanup implication                                                                                                                                                             |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SLICE-001 | A reviewed contract and reproducible native-identity/selection example, spanning an actual OWL load to eligible occurrences and a specified prefix. Resolve persistence and reuse gates. | REQ-001/003/008/011; AC-001/003/008/011; QA-002/008; DEC-001/003/004/005/007/009             | Hand-authored star/chain/disconnected/datatype/anonymous fixtures; canonical correspondence experiment; compare fairness candidates; complete package/native selection dispositions.                                      | Design checkpoint, not a production release. No blocked identity or persistence assumption carried into source implementation.                                                              |
| SLICE-002 | A user loads an ontology and chooses exact counts, zero, auto and All through the real compound control; the renderer displays the corresponding prefix.                                 | REQ-001/002/003/004/005/006; AC-001..006; QA-001/002/004/005; DEC-001/003/004/005/006/008    | Exhaustive small-graph properties plus a browser path at 0, 1, 37 and All; empty graph; default `min(N, 50)`; inverse wheel regression; unchanged paused coordinates/camera.                                              | Demonstrable locally. Not separately publishable while old public consumers still select degree semantics. Remove the old UI path in the candidate, not via a runtime compatibility toggle. |
| SLICE-003 | Filter, search, pin, edit/undo and rapid interaction preserve truthful counts, user intent and orientation on the same live document.                                                    | REQ-003/004/006/009/010; AC-003/004/006/009/010; QA-002/003/005/006/009; DEC-003/004/005/006 | Relationship-only filters preserve `N`; 100→73→100 latent target; count-hidden reveal; upstream-hidden reveal refusal/explanation; old completions deliberately arrive last; pauses/pins and edit correspondence survive. | Drop derived caches/listeners on replace/dispose; retain only current bounded work. No independent deployment before public-contract closure.                                               |
| SLICE-004 | A person shares/reopens a `nodesShown` URL and an agent sets/reads the same intent; obsolete degree requests fail clearly without mutating the view.                                     | REQ-004/007/009/011; AC-004/007/009/011; QA-006/007; DEC-001/002/006                         | Actual fragment round-trips for auto/all/zero/exact/shortfall; absent setting; malformed/duplicate/mixed inputs; `doc=-1`; strict WebMCP schemas and atomic errors.                                                       | Coordinated breaking-contract candidate. Remove obsolete factories/fields/imports/examples and degree algorithms after tests no longer rely on them as an active path.                      |
| SLICE-005 | Save/reopen and worker interruption/recovery follow the chosen persistence promise, including zero, All and latent exact targets where promised.                                         | REQ-004/006/008/009; AC-004/006/008/009; QA-005/006/008/010; DEC-005/006/007                 | Current canonical producer round-trip; native validation of any approved new state contract; preserved hidden provenance in recovery; version rejection; aborted capture leaves original bytes and live view usable.      | No automatic file migration. Preserve originals. New formats cannot ship without tested reader/version/recovery behavior and exact approvals.                                               |
| SLICE-006 | A release candidate demonstrates the user task on realistic ontologies with measured performance, accessibility evidence and a rehearsed recovery route.                                 | REQ-005/010/011/012; AC-005/010/011/012; QA-004/007/009/010; DEC-009/010                     | Full relevant verification, independent review, supported-browser/AT matrix, benchmark report, old-reader/new-link rehearsal and authorized deployment readback.                                                          | Publish only after consumer closure and release authority. Record incomplete external/AT evidence as incomplete, never as a pass.                                                           |

SLICE-001 gates all implementation.
SLICE-002 precedes SLICE-003 and SLICE-004; both feed SLICE-005 and final qualification.
DEC-007 must be settled at SLICE-001, even if its implementation arrives later.
Do not turn the slices into one commit per layer or a list of microscopic editing steps.
Tests accompany the behavior they establish.

## 9. Verification and measurement plan

### 9.1 Focused and final checks

Use existing commands and test discovery.
During each slice, run the named affected Jest suites using `npm test -- --runInBand --runTestsByPath <actual-test-paths>`; update the selection when names move.
Core obligations include view-control/session/controller/scene tests, UI adapter and presenter tests, share-link tests, WebMCP contracts and the relevant VOWL identity/projection tests.
Include actual OWL and canonical-artifact load paths, not only hand-constructed controller state.

For the accepted candidate, run the required HISEW `full` profile and the full relevant repository checks: `npm run check` currently covers lint, application/Python formatting, setup and Markdown tests, the complete Jest run, and bundle build.
Avoid repeating equivalent successful checks without changed inputs; retain exact commands, candidate identity and outcomes.
HISEW's build evidence, ordinary test evidence, browser/AT evidence, independent verification and live production acceptance are separate claims.

Check changed Markdown with the existing Markdown Quality CLI's explicit-file selection.
Do not run a broad formatter over the user-owned research response or silently repair unrelated files.
No new configuration/test harness is necessary merely to write this plan.

### 9.2 Browser and accessibility acceptance

Use a native range with `min=0`, dynamic maximum and `step=1`; exact text entry may use `inputmode="numeric"`.
Permit temporary blank/invalid editing, commit valid text on Enter/blur, and restore the last committed value on Escape.
Minus/plus operate on the applied value and make the resulting target explicit.
Disable unavailable operations at endpoints and explain `N = 0` without losing focus unexpectedly.

The [HTML range contract](<https://html.spec.whatwg.org/multipage/input.html#range-state-(type=range)>) supplies native mechanics; [USWDS guidance](https://designsystem.digital.gov/components/range-slider/) supports providing precise entry alongside a slider.
Follow the [WAI slider keyboard/value pattern](https://www.w3.org/WAI/ARIA/apg/patterns/slider/) without redundant custom widget semantics.
All functions need a non-drag pointer route under [WCAG 2.2 dragging guidance](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html).

Provide visible/accessibly associated labels, focus and errors.
Target at least 24×24 CSS pixels or a documented applicable exception, aiming for 44×44 where space permits, following [target-size guidance](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html).
Announce settled counts and pending/failed changes without moving focus; coalesce drag announcements in accordance with the purpose of [status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html).
Use the committed graph count for “Showing X of N” while separately indicating an uncommitted request.

Required matrix selection: keyboard, mouse, precision trackpad, touch, 200%/400% zoom and narrow reflow, forced colors, reduced motion, and representative supported desktop/mobile browsers.
Record actual NVDA, JAWS, VoiceOver and TalkBack combinations exercised or unavailable; agree required coverage before release.
An automated accessibility result does not establish AT usability.
Never cancel wheel events merely to protect the selector or intentionally bind them to count changes.

Formative tasks: choose exactly 37 of 109, add one, show all, return to 37, scroll over the control, reveal a count-hidden result, and explain a target made temporarily unavailable by another filter.
The response's 90% unassisted-completion goal needs an agreed study size and task definition before it becomes a gate; zero accidental changes in the explicit scrolling task is a concrete behavioral requirement.

### 9.3 Proposed timing gates

| Measure                                                    | Proposed target / treatment                                                                                                |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Control visual echo                                        | At most 100 ms p95.                                                                                                        |
| Cached prefix/hidden-set update                            | At most 50 ms p95 on the agreed large fixture.                                                                             |
| Initial ranking, about 10,000 nodes / 50,000 relationships | At most 250 ms p95, with native identity preparation measured separately and included in total time to first correct view. |
| Pending feedback                                           | Present when a semantic update exceeds approximately 200 ms.                                                               |
| Final committed count after rapid release                  | At most 150 ms p95, excluding force settling but including visible membership application.                                 |
| Running layout at up to 500 shown nodes                    | Record a 1-second p95 settling objective separately; do not weaken exactness to meet it.                                   |

These are hypotheses awaiting DEC-009, not results.
Record source checksum, candidate, ranking policy, browser/version, OS, CPU/RAM, device-pixel ratio, sample count, warm-up method and cold/warm status.
Measure identity/canonicalization, topology, ranking, closure, DOM/rendering and layout separately.
A node cap does not cap dense-edge or label cost.

Use 50/100, 500/2,000, 5,000/20,000 and 20,000/100,000 node/edge scales, plus dense, isolate-heavy, datatype-heavy and expression-heavy shapes.
Reuse checksum-bound GoodRelations/FOAF fixtures where available; select and clear an independently sourced larger ontology before redistribution.
If an identity or ranking job monopolizes the UI thread, evaluate existing worker ownership and bounded cancellation before adding another worker or changing build configuration.

## 10. Unknowns, cheapest experiments and re-planning triggers

| Question                                                      | Cheapest discriminating evidence                                                                                                                                       | Decision / stop condition                                                                                                                                    |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Can native identity meet determinism and latency?             | Capture structural identity once for equivalent small/live/edited fixtures; map correspondence; measure it separately on a large fixture.                              | Owner/implementation lead accepts the supported key contract. If incomplete or unbounded, re-plan producer ownership; no viewer canonicalization substitute. |
| Does square-root fairness reveal useful disconnected regions? | Review exact prefixes for a large component plus a small component, two unequal components, chains and many isolates against equal/logarithmic alternatives.           | Freeze one deterministic version before public links. Re-plan if it hides a required region until an unacceptable count.                                     |
| What must a saved artifact restore?                           | Demonstrate current hidden-only snapshot semantics and inventory actual state readers; present a concrete new envelope/profile only if intent restoration is required. | Owner settles DEC-007 before baseline. No speculative schema mutation.                                                                                       |
| Are the timing budgets achievable?                            | Measure native identity plus selection and rendering on agreed reference hardware with dense and isolate-heavy fixtures.                                               | Agree DEC-009. Do not report a ranking-only timing as full interaction latency or silently lower a gate.                                                     |
| Are all UI operations understandable and accessible?          | Run the task sequence with keyboard and the first required screen-reader/touch pairing.                                                                                | Fix semantic/focus failures before broader device testing; declare unavailable evidence explicitly.                                                          |
| Are public-contract consumers closed?                         | Search actual imports, schema fields, URL fixtures, examples and automation for degree semantics; test invalid old inputs.                                             | Any remaining executable degree path or unowned state reader blocks coordinated cutover.                                                                     |

Re-baseline if requirements change; a canonical profile/package API must change; saved-state loss is discovered; a new dependency/configuration change becomes necessary; the ranking/version promise changes; latency requires architectural movement; explicit hiding cannot be separated; or release recovery cannot honor the promised data contract.
A current source-baseline change requires impact review, not blind reuse of this document's filenames or observations.

## 11. Security, observability, release and cleanup

Treat URL, WebMCP and restored state as untrusted application inputs.
Validate shape, safe-integer domain, duplicates, modes and removed fields before expensive work.
Reuse VOWL's supported admission and bounded worker/cancellation controls; do not bypass limits to obtain stable identities.
Diagnostics and DOM text must use existing safe text rendering.
Changing count should not cause new ontology acquisition, alter import policy or emit ontology labels/IRIs to a new analytics service.

Use existing local diagnostics and test measurements for requested intent, eligible/shown counts, view/document revision, ranking-policy version, ranking-cache reuse, duration and rejection/supersession reason.
Keep product-facing status limited to actionable state.
No new persistent telemetry, network endpoint or logging configuration is implied.

The integration owner first produces one coherent candidate, retires degree consumers, supplies the accepted persistence behavior, and obtains independent verification.
The release owner then records approved artifact identity, delivery method, known-good recovery candidate and an accountable observer.
Do not introduce a compatibility flag or dual production mode merely to split delivery.
All externally visible consumers must move together.

Production acceptance, if deployment is later authorized, observes actual source loading, auto/exact/All, filter shortfall restoration, rejected old links, search reveal, keyboard/pointer behavior and a representative large graph on the deployed candidate.
Confirm which bytes/version are served; the research baseline and a local build do not establish deployment parity.
Observe actionable failures and user reports through existing channels, not an invented monitoring service.

Abort for count/membership disagreement, stale commits, hidden-state loss, unsupported persisted state, inaccessible required operations or exceeded accepted latency limits.
Before any downgrade, prove how new links/files are handled by the previous reader.
Preserve user files and use a forward fix when a downgrade cannot read newly written state safely; no claim of transparent reverse migration is made.

On completion, remove obsolete degree implementation and active examples, dead imports/DOM hooks, test-only probes, caches/listeners and temporary evidence according to their owners.
Preserve historical research and original user artifacts.
Rebuild generated schemas/notices/bundles only from their owning source if an approved change actually affects them.
Recheck unrelated working-tree changes, exact candidate and HISEW ownership before commit/delivery or cleanup.

The higher-level outcome remains understandable control of graph detail.
Reassess the ranking/control design if people repeatedly cannot predict what appears, hidden expression structure becomes misleading, large graphs become unusable, or a downstream contract requires reproducible membership beyond the unchanged-source/policy promise.
Correct arithmetic alone does not establish that outcome.
