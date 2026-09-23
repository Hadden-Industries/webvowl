# WebVOWL performance and search change dossier

Status: draft for owner review, 23 September 2026.
Implementation plan: [implementation-plan.md](implementation-plan.md).
Decision owner: Maksy, as repository owner.

The requested outcome is a HISEW implementation plan derived from the [performance and search catalogue](<../WebVOWL Performance and Search Improvements_ Catalogue and Applicability to Hadden-Industries_webvowl.md>).
This dossier supplies the requirements, risk route, quality scenarios and proposed decisions needed to make that plan reviewable.
Neither document is an accepted implementation baseline, an authorization to implement, nor evidence of measured performance improvement.
The catalogue's content is preserved, with Markdown formatting normalized for repository publication.
The original supplied bytes had SHA-256 `32bce13e4b8094188039f95b3f2085a777009c9677d4a7f95cdb3665c816f07c`; SRC-001 identifies the formatted repository copy.

## Evidence and applicability

The observations below were refreshed against local sources on 23 September 2026.
The catalogue's embedded conversation citation tokens are not independently resolvable; this dossier replaces reliance on them with inspectable sources.

| ID      | Evidence                                                                                                                                                                                                             | Identity and use                                                                                                                                                                                                                                                                       |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SRC-001 | The linked catalogue                                                                                                                                                                                                 | SHA-256 `bffeb2807319a5da42af07b820cf6d3820685b8eb7220478af7eab3ebbcbd13a`; programme proposal, not a verified inventory of today's implementation.                                                                                                                                    |
| SRC-002 | [Making WebVOWL Great Again: Improving Performance and Search](<G:/My Drive/Hadden Industries/WebVOWL/Making WebVOWL Great Again_ Improving Performance and Search P6.pdf>)                                          | SHA-256 `f3d1254cc249c692dedd37678cd219665ad75e94ac2af7e113ba1914f24309c9`; physical PDF pages 6-7 define neighbourhood/prefix search, 8-15 explain changes, 16-18 describe measurements and results. Tables on pages 17-18 were also inspected visually.                              |
| SRC-003 | [WebVOWL-Legacy source](https://github.com/WebVOWL/WebVOWL-Legacy/tree/28e92c7220302c50aa32cebab977ab6e884d8887)                                                                                                     | Local checkout `C:\Users\maksy\GitHub\WebVOWL-Legacy`, clean at `28e92c7220302c50aa32cebab977ab6e884d8887`. Inspect `src/main/webvowl/js/parsing/linkCreator.js`, `parser.js`, `modules/filters/`, `datastructures/trie.js` and `graph.js`; later than the paper, with different APIs. |
| SRC-004 | [Hadden WebVOWL source baseline](https://github.com/Hadden-Industries/webvowl/tree/e70ffbab0326a709fb51228855a556147432db20)                                                                                         | Local `main` at `e70ffbab0326a709fb51228855a556147432db20`. Tracked files were clean at inspection; the supplied catalogue was already untracked. Every predicted file assignment must be reconciled with the execution checkout.                                                      |
| SRC-005 | [ADR 0010](../../adr/0010-rendered-graph-is-a-projection-not-the-store.md), [ADR 0012](../../adr/0012-human-and-agent-visualization-action-parity.md), [ADR 0003](../../adr/0003-quiescent-benchmark-environment.md) | Accepted ownership, action-parity, identity and benchmark constraints. ADR 0012 amends ADR 0010's earlier restrictions on occurrence references and viewing controls.                                                                                                                  |
| SRC-006 | [Current package](../../../package.json), [previous ESM plan](../CommonJS-to-ESM/implementation-plan.md)                                                                                                             | The current package has `type: module`, native ESM Jest execution and D3 ESM imports. The older plan is context, not an outstanding migration prerequisite. Do not repeat that migration.                                                                                              |

HISEW `0.1.0-dev.12` was inspected through the installed Codex adapter and its selected isolated interpreter.
Repository selection was restored for this task, and readback returned `applicability: personal`, `active: true`, and workflow status `ready`.
Project identity is `9a11c4f6-5850-4799-85a6-af0cf3eee5a8`; worktree identity is `4200f543-f93d-41d8-902c-971a9ce530f9`.
Workflow progress showed a handed-off execution for an earlier documentation task, not an active implementation of this programme.
No requirement snapshot was accepted and no implementation execution was started for this plan.

### Corrections to the catalogue

| Catalogue item              | Observation in SRC-004                                                                                                                                                                                          | Planning consequence                                                                                                                                                      |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Link layers and loops       | `src/webvowl/js/parsing/linkCreator.js` still scans all links to form endpoint groups. Non-loop links can repeatedly trigger the loop scan without receiving loop metadata.                                     | Keep as first priority. Preserve shared layer/loop arrays, order and indexes, not Legacy's numeric `layers` representation.                                               |
| Property/inverse membership | `groupPropertiesToLinks` calls `src/shared/js/util/set.js`, which already wraps a native `Set` keyed by `element.id()`.                                                                                         | Already addressed. Preserve ID-based grouping and cover it in regressions; do not schedule an array-to-Set rewrite or switch silently to object identity.                 |
| Incident adjacency          | `storeLinksOnNodes` is in `src/webvowl/js/runtime/renderedGraphInternals.js`, used by both `filterFunction` and `refreshLinksAndLabels`. It scans all links for every node.                                     | Optimize both renderer paths. This is occurrence adjacency, not the canonical semantic index.                                                                             |
| Attribute indexing          | Renderer `parser.js` still scans class/datatype/property attributes, choosing the first matching strict-equality ID. The application inspection projector already uses a map with a different merging contract. | Index the renderer parser while preserving its contract; do not reuse the projector's last-entry/string-coercion semantics blindly.                                       |
| Eager equal-property search | `getOtherEqualProperty(rawProperties, property)` runs before the `propertyWasRerouted` condition.                                                                                                               | Guard the lookup with rerouting, not with a test for an equivalents array. Worst-case rerouting can remain quadratic.                                                     |
| Equivalent range merging    | `equivalentPropertyMerger.js` calls `isDomainOrRangeOfOtherProperty` over the full property array after each relevant range mutation.                                                                           | Reverse the catalogue's exclusion: include a measured endpoint-reference index slice. Preserve mutation-order semantics.                                                  |
| Solitary subclasses         | The active filter is `src/shared/js/modules/subclassFilter.js`. Recursive descendant inspection rescans properties; final removal uses `indexOf`.                                                               | Index the supplied occurrence graph within this display filter. Moving its semantic policy into the canonical model is unnecessary for this optimization.                 |
| Automatic degree            | `src/shared/js/modules/nodeDegreeFilter.js` tries thresholds `0 <= degree < maximumDegree`, uses datatype-aware link counts and `filterNodesAndTidy`, and falls back to zero. The auto budget is 50.            | Preserve this actual policy, including ties, the exclusive upper bound, explicit user values and empty-result fallback. A sorted degree quantile alone is not its oracle. |
| Search coverage             | `ontologyInspector.js` already searches application-owned records, merges aliases from repeated semantic identities, ranks substring matches and reports hidden matches as not focusable.                       | Add hidden-result navigation, not a second semantic search source. Preserve the meaning of `isFocusable`.                                                                 |
| Search retrieval            | Each query rebuilds semantic records and label maps and sorts matches. UI groups equal display labels and displays six groups; WebMCP already paginates.                                                        | Reuse model-revision indexes and existing ranking before selecting a new text index. Six UI groups are not equivalent to six entity matches.                              |
| Raw-source caching          | `webVowlController.js` retains at most four accepted URL-source navigation snapshots, including document/arrangement state.                                                                                     | Measure actual retained owners. A 50 MB raw-JSON cutoff would not express the current cache's behavior or protect edited documents.                                       |
| Memory representation       | Constructors in `BaseElement.js`, `BaseNode.js`, `BaseProperty.js` and link types still allocate instance methods.                                                                                              | ESM adoption does not solve closure allocation. Characterize and migrate shared behavior separately from graph indexing.                                                  |

Legacy is an algorithm reference, not a correctness oracle.
Its current link implementation joins endpoint IDs with `|`, changes layer representation and calls `findIndex` for each loop; copying those details could introduce key collisions, API changes or quadratic work on a many-loop node.
Its merger's precomputed endpoint sets are not evidence that Hadden's sequential range-replacement semantics can use a static set.

The paper reports combined ENVO loading of 631.7 seconds versus 1.23 seconds, and peak memory of 524 MB versus 227.33 MB.
Those are results for its implementation and measurement environment, not Hadden targets or an isolated effect of ES6 syntax.
Block scope does not guarantee immediate garbage collection; measure reachability and retained allocations.

## Purpose, outcomes and boundaries

The purpose anchor is to let ontology readers load and explore larger documents while preserving ontology meaning, visualization controls, accessible search, editing recovery and human/agent agreement.
Maintainers benefit from lower repeated work and explicit ownership of derived indexes.
Small-ontology users are possible disbeneficiaries if index construction or retained memory outweighs query savings.

| ID      | Statement and epistemic status                                                                                                  | Evidence, measure and reassessment                                                                                                                                              |
| ------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MOT-001 | Repeated scans plausibly dominate some large-graph operations. Observed code pattern; performance significance is a hypothesis. | SRC-002 and SRC-004. High confidence in repeated work, no current timing baseline. Reassess after isolated phase measurements.                                                  |
| MOT-002 | Hidden search matches should support bounded navigation. Proposed product outcome derived from SRC-001.                         | Canonical search exists; renderer focus is visibility-bound. Maksy accepts the new reveal/reset behavior before implementation.                                                 |
| OUT-001 | Reduce graph preparation and filter cost without losing or reordering graph facts. Proposed outcome.                            | Baseline: not measured in this task. Compare baseline/candidate phase time, work counts and ordered semantic descriptions on identical fixtures before each slice's acceptance. |
| OUT-002 | Make a hidden representable class/property navigable and return safely to ordinary filtering. Proposed outcome.                 | Baseline: hidden matches are not focusable. Target: all specified neighbourhood and lifecycle cases pass, with bounded rejection preserving prior state.                        |
| OUT-003 | Reduce repeated search preparation and per-occurrence allocation. Proposed outcome.                                             | Compare index-build cost, query p50/p95, retained heap and function counts at 1k/10k/100k entities; evaluate build/query/memory together. No claimed reduction exists yet.      |

The implementer collects these measures; Maksy accepts outcomes and trade-offs at the baseline, each release candidate and the first post-release smoke check.
Confounders include input conversion, browser/version, force-layout state, GC, source reuse, machine contention and simultaneous ESM/toolchain changes.
Doing nothing preserves current behavior and avoids index memory, but retains the observed scaling paths and unavailable hidden-result navigation.

Scope includes renderer graph preparation, parser/filter indexes, controller-owned neighbourhood projection, semantically equivalent search acceleration and staged occurrence-memory work.
Non-goals are an OWL reasoner, owlapi or Java converter changes, a renderer replacement, WebAssembly, a graph database, fuzzy/prefix-only search, new ontology editing features, an ESM/D3 migration, general cleanup and automatic publication.

## Proposed HISEW route

### Risk class:

R2 for the implementation programme; proposed, not owner-accepted.
Planning itself produces reviewable documentation and does not activate that execution.

### Decision owner:

Maksy, as repository owner, accepts scope, observable behavior, budgets and the implementation baseline.
The eventual implementation task owns integration and evidence collection.

### Reasoning:

Material performance/availability changes, public WebMCP behavior, cross-layer state, cancellation and recovery trigger R2.
Indexing can silently drop edges or merge distinct occurrences; prototype changes can break receiver binding and editing.
These are inferences from SRC-004 and the accepted ADR boundaries, not quantified incident probabilities.

### Potential blast radius:

All ontology source kinds, initial load, filter changes, rendered geometry, search UI, WebMCP, document revisions, saved navigation and exports.
No server or persistent schema migration is proposed.

### Reversibility:

Each released slice needs a previously qualified artifact and a demonstrated redeployment path.
Transient indexes/projections can be discarded and rebuilt; active user edits must be exported or recovered before a reload.
A Git revert alone does not establish safe deployed recovery.

### Principal unknowns:

Representative phase baselines, large-graph limits, constructor callback contracts, source-retention owners and the resource cost of optional text indexing.
The experiments and decision gates in the plan resolve these before dependent work.

### Required artifacts:

This dossier and plan, an owner-accepted requirement snapshot before implementation, per-slice traceability/evidence, source and fixture identities, independent review dispositions, and release/recovery evidence.
Reuse these records; an issue, new registry or extra configuration file is not required just to plan.

### Required specialist lenses:

Independent algorithm/semantic review, benchmark/test-oracle review, browser/accessibility review for search, and scoped native security review for untrusted-input, resource-budget and WebMCP changes.
Record the reviewer/provider and exact reviewed candidate; availability is not a completed review.

### Required verification:

The registered R2 route selects profile `full`, currently `npm run build`.
That profile alone does not run Jest or prove browser behavior; the plan adds focused and complete tests, semantic/complexity evidence, browser actions, heap evidence and hosted smoke checks as applicable.
Registered `focused` is `npm run lint`; registered `affected` is `npm run test`.
These declarations were read from project configuration generation 9 and must be re-resolved before execution.

### Required human approvals:

Accept the exact draft baseline and the proposed behavior/budgets before implementation.
Any configuration change requires separate approval for the exact file and setting under `AGENTS.md`.
Commit, push, merge and deployment retain separate authority; this planning request supplies none of those effects.

### Maximum sensible autonomy:

Complete source research and draft planning now.
After acceptance, implement only accepted slices, collect evidence and repair in-scope defects; escalate changed meaning, failed controls or newly required configuration.
Do not self-approve an exception, baseline or release.

### Next lifecycle step:

Review this dossier and the linked plan, resolve the listed owner decisions, then capture the exact accepted baseline through the selected installed engine.
The first implementation slice is graph construction; later budget or index choices need not block its independent preparation.

## Invariants and requirement traceability

All requirements and acceptance criteria below are proposed for this change.
Their underlying accepted constraints remain binding independently of this draft.

- INV-001: The application-owned VOWL document and inspection snapshot retain semantic authority; rendering and visibility do not delete ontology facts.
- INV-002: Semantic entity identity, VOWL document-record identity and rendered-occurrence identity stay distinct.
  Repeated IRIs do not authorize collapsing occurrences.
- INV-003: Renderer endpoint grouping uses object identity today; property membership uses IDs.
  Preserve each boundary's existing identity rule.
- INV-004: Callable getters/setters, chaining, inverse relationships, ordered layer arrays, self-loop multiplicity and geometry remain compatible unless an explicitly accepted contract change says otherwise.
- INV-005: Ordinary filtering, search focus, a temporary neighbourhood and global Reset have different meanings.
  A reveal must not silently rewrite saved filters.
- INV-006: Derived state belongs to an identified source revision and owner; a stale load, edit or cancelled operation cannot publish into a newer revision.
- INV-007: Human and agent viewing actions have the same accepted bounds and effects.
  Experimental editing remains outside WebMCP.
- INV-008: Performance evidence is invalid if graph facts were dropped, the workload changed or the machine was contended.
  ADR 0003 applies.
- INV-009: Required recovery/export state is not disposable cache.
  No diagnostic sends ontology content, labels, IRIs or query text to an external service.

| Requirement | Intended behavior                                                                             | Acceptance criterion and oracle                                                                                                                                                                                                                                                                         | Outcome |
| ----------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| REQ-001     | Build ordered link metadata and incident adjacency without nested whole-graph scans.          | AC-001: Exact link kind, order, inverse assignment, layer/loop array membership and sharing, indexes and node incidence match independent fixtures; loops occur once in incidence; repeated refresh replaces adjacency. Work-count evidence grows with supplied nodes/links.                            | OUT-001 |
| REQ-002     | Avoid repeated attribute lookup and unused equal-property lookup.                             | AC-002: First matching attribute wins, base fields retain precedence and input-order/type semantics stay unchanged; non-rerouted properties perform no equal-property search; rerouted cases preserve duplicate suppression.                                                                            | OUT-001 |
| REQ-003     | Avoid a complete property scan for each equivalent range replacement.                         | AC-003: Generated merge nodes, range replacements and hidden-node decisions match the sequential baseline, including shared endpoints, repeated equivalents and unresolved references. Reference-count updates remain correct after every mutation.                                                     | OUT-001 |
| REQ-004     | Evaluate solitary-subclass filtering through indexed occurrence adjacency.                    | AC-004: Ordered retained classes/properties match current policy on chains, diamonds, cycles, multiple inheritance and descendant non-subclass links, including interaction with earlier filters.                                                                                                       | OUT-001 |
| REQ-005     | Reuse degree counts and reduce automatic-threshold trials while retaining the 50-node policy. | AC-005: Minimum/maximum/automatic degree and final ordered filtered result agree with the current predicate across ties, zero-degree graphs, datatype tidy, explicit settings, exclusive maximum and empty fallback.                                                                                    | OUT-001 |
| REQ-006     | Reveal a representable hidden entity in an application-selected depth-two neighbourhood.      | AC-006: Classes seed their matching document occurrences; properties seed both endpoints and remain included. Both directions are traversable; all eligible internal edges are retained. Oversized or invalid results reject before changing the displayed graph. Clearing restores ordinary filtering. | OUT-002 |
| REQ-007     | Accelerate search without changing matching or ranking.                                       | AC-007: Exact ordered identities, totals, kinds, labels, equivalent-label matching, visibility flags and pagination agree with the existing inspector for every oracle query; substring matches remain. Include index construction and retained memory in performance acceptance.                       | OUT-003 |
| REQ-008     | Invalidate indexes and temporary views correctly.                                             | AC-008: Load, revision, language, filter, cancellation, failure recovery and disposal tests show no stale publication or cross-document identity reuse; index lifetime and current visible facts are tested separately.                                                                                 | All     |
| REQ-009     | Share eligible occurrence methods while preserving actual object contracts.                   | AC-009: Intended methods have shared function identity, per-instance data remains isolated, and hierarchy/receiver/callback/serialization behavior and full rendering/editing/export tests pass; qualified heap evidence confirms material benefit.                                                     | OUT-003 |
| REQ-010     | Release disposable retained state without losing edits, recovery or supported navigation.     | AC-010: Retention ownership is documented; retired owners become unreachable after relevant teardown; cache eviction reloads safely; failed loads and accepted edits remain recoverable. No arbitrary 50 MB rule is imported.                                                                           | OUT-003 |
| REQ-011     | Expose reveal and clear through the shared UI/controller/WebMCP contract.                     | AC-011: Equivalent UI/tool requests produce equivalent projections, refusals and completion; keyboard, focus and announcement behavior passes real-browser checks; existing 1,500-character WebMCP result bounds and exact identities remain intact.                                                    | OUT-002 |
| REQ-012     | Release only a measured and recoverable candidate.                                            | AC-012: Accepted baseline, exact candidate checks, independent reviews, representative browser evidence, previous artifact and demonstrated recovery are retained; no missing platform or benchmark is described as passed.                                                                             | All     |

## Quality scenarios

Maksy owns acceptance of every scenario and proposed threshold.
The implementation owner collects the evidence and observes the first release; an independent reviewer checks the oracle and interpretation.
All scenarios apply to the SRC-004 architecture until a rebaseline changes it.
Correctness, identity and recovery requirements are hard constraints; numerical optimization targets are proposals requiring baseline calibration and owner acceptance before becoming release gates.

| ID / links                                           | Source, stimulus and environment                                                                                               | Artifact and required response                                                             | Response measure, priority and failure risk                                                                                                                                                                                                                                                                 | Verification, production signal and rationale                                                                                                                                                    |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| QA-001 / REQ-001, REQ-002, REQ-003                   | Loader or filter refresh receives adversarial but supported VOWL: parallel edges, self-loops, repeated IDs, equivalent ranges. | Parser and occurrence indexes preserve ordered graph metadata and visibility.              | P0 hard constraint: zero unexplained oracle differences. Failure can silently change the diagram.                                                                                                                                                                                                           | Hand-enumerated fixtures plus baseline differential tests; observe node/property/link counts at load/refresh. SRC-004 contracts define the oracle, not Legacy.                                   |
| QA-002 / REQ-001, REQ-002, REQ-003, REQ-004, REQ-005 | Reader loads doubling synthetic graphs on a quiescent supported browser/machine.                                               | Targeted preparation phase removes its identified repeated scan.                           | P0 optimization: linear pass work for SLICE-001/002; explicitly bounded work for other slices. Proposed target: at least 25% lower targeted median on the largest tractable pathological input; small-corpus end-to-end regression no greater than the larger of 10% or 25 ms, corroborated under ADR 0003. | Deterministic visit counts plus paired timings at 1k/2k/4k/8k/16k; record phase and total duration. A failed target reopens scope rather than weakening graph correctness.                       |
| QA-003 / REQ-004, REQ-005                            | User combines filters, sets a degree, then loads another document or restores settings.                                        | Existing filter policy and explicit-value precedence survive optimization.                 | P0 hard constraint: exact retained sets/order and degree values, including false/zero and fallback. A different 50-node threshold is a behavior change.                                                                                                                                                     | Existing filter/controller tests plus exhaustive small-graph degree comparisons; observe applied degree/range and visible counts.                                                                |
| QA-004 / REQ-006, REQ-008, REQ-011                   | UI or agent selects a filtered-out class/property, including a high-degree hub.                                                | Controller constructs a bounded temporary projection, or refuses atomically.               | P0 hard constraint: depth exactly two; proposed caps of 500 node occurrences, 1,000 property occurrences, 10,000 inspected adjacency entries and 25 requested semantic references. Exceeding any cap preserves the previous graph; never silently truncate.                                                 | Independent BFS/induced-edge oracle, cap-boundary tests, browser/tool parity; local projection counts/refusal reason. Depth alone does not bound size.                                           |
| QA-005 / REQ-007                                     | Reader/agent searches all labels, equivalent labels and IRIs with exact, prefix, infix, short, Unicode and no-match queries.   | Revision-owned index supplies the established ranking and complete totals.                 | P1 correctness is hard; proposed warmed p95 at most 100 ms for the agreed 100k-record fixture, with index-build time and memory reported separately. Common/one-character queries may remain output-sensitive.                                                                                              | Golden result corpus plus differential randomized queries; local index-build/query timings and match counts, never query content.                                                                |
| QA-006 / REQ-008                                     | Load B supersedes A; a document edit, clear, failure or disposal races a reveal/query.                                         | Application discards stale work and retires generation/revision resources.                 | P0 hard constraint: zero stale publications, no orphan active view, recovery preserves the last accepted document.                                                                                                                                                                                          | Controlled abort/failure races with real controller and fake external renderer boundary; retained-reference inspection and operation-generation diagnostics.                                     |
| QA-007 / REQ-009, REQ-010                            | Reader loads, edits, navigates and disposes 1k/10k/100k-entity documents repeatedly.                                           | Shared methods reduce allocation and retired sources/indexes are released.                 | P1 optimization: proposed at least 20% lower per-occurrence retained allocation in the qualified memory cohort; zero behavioral differences. GC timing is not a deterministic assertion.                                                                                                                    | Allocation/heap profiles, method identity and per-instance isolation tests; retained-owner counts across ten load/reveal/clear/dispose cycles. Compare equal live graph sizes and GC conditions. |
| QA-008 / REQ-006, REQ-007, REQ-008,011               | Keyboard/touch reader or WebMCP caller provides untrusted labels, long queries, invalid/stale references or broad selections.  | Search stays operable; labels are text; schemas and resource checks reject before effects. | P0 hard constraint: no HTML execution, identity truncation or resource-bound bypass; no inaccessible new action. Keep current 25-result tool input limit and 1,500-character result envelope unless separately revised.                                                                                     | Contract/security cases and real-browser combobox tests; local error codes, no ontology/query telemetry. Existing safe DOM construction and native validators are reused.                        |
| QA-009 / REQ-012                                     | Observer detects a reproducible regression after staged publication.                                                           | Delivery owner can restore the previous qualified artifact after preserving active edits.  | P0 hard constraint: recovery demonstration names the artifact and succeeds; no claimed recovery time without a timed exercise.                                                                                                                                                                              | Preview and hosted smoke plus a restore rehearsal; record exact SHA/artifact, hosting behavior and recovery outcome. Passing CI alone is insufficient.                                           |

Index memory competes with load time and query latency; projection completeness competes with finite rendering budgets.
The proposed policy is to preserve semantics and refuse an oversized reveal explicitly, not silently drop facts or narrow matching.
If these trade-offs are unacceptable, Maksy must revise the corresponding requirement before dependent implementation.

## Proposed decisions and reuse assessment

These decisions are recommendations, except where they restate an accepted ADR or existing contract.
They become implementation decisions only when the owner accepts the baseline.

| ID      | Proposed decision                                                                                                                                  | Reason and consequence                                                                                                                                                                            |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DEC-001 | Optimize existing graph ownership boundaries; use native `Map`/`Set` and preserve callable element APIs.                                           | Reuses the existing renderer and avoids a second graph store. Object-keyed nested maps avoid concatenated-ID collisions.                                                                          |
| DEC-002 | Preserve renderer attribute first-match behavior and sequential equivalent-range updates.                                                          | A map is only correct if its key equality, duplicate precedence and mutation lifetime match the operation it replaces.                                                                            |
| DEC-003 | Keep display-filter semantics in the current filter modules. For automatic degree, first cache degrees and use a proved monotone threshold search. | Fewer trials can be obtained without inventing a new quantile/tie policy. Prove monotonicity against the real tidy behavior; otherwise stop that optimization for redesign.                       |
| DEC-004 | Add an explicit controller-owned temporary search projection, separate from standing filters and focus.                                            | Depth two follows the design; bounded atomic refusal, revision binding and distinct clear/reset behavior protect the application.                                                                 |
| DEC-005 | Preserve exact/prefix/substring/equivalent-label/IRI rank order and semantic identity deduplication.                                               | Prefix-only trie search, fuzzy ranking, stemming, accent folding and local-ID matching would change current behavior. None is selected.                                                           |
| DEC-006 | Materialize merged semantic search records and normalized label/reference indexes once per accepted document revision.                             | Reuse the inspector's ranking and validators. More elaborate substring candidate indexing is gated on evidence that this first step is insufficient.                                              |
| DEC-007 | Migrate shared occurrence behavior in a pilot, then coherent constructor families; preserve legitimate instance callbacks/state.                   | Native prototypes already share methods. Class syntax is optional; a field change or bound closure can erase the intended savings. No dual getter/property API or compatibility shim is selected. |
| DEC-008 | Measure retained owners before altering source-navigation caching.                                                                                 | A document/arrangement snapshot is not a raw JSON string; accepted edits and failed-load recovery remain authoritative obligations.                                                               |
| DEC-009 | Ship independently qualified slices and defer later slices if their evidence fails.                                                                | A graph-construction improvement need not wait for a high-risk object-model migration. No product feature flag or configuration change is presumed.                                               |

### Capability research, checked 23 September 2026

The research question is whether existing capabilities can supply ordered graph indexes, bounded neighbourhood traversal and the current ranked substring search without changing identities, lifecycle or browser deployment.
The first-principles constraint is that reducing repeated work must not reduce the represented graph or search result set.
Maintained native guidance and primary specifications refine the mechanism; measured local behavior supplies the compatibility oracle.

| Candidate                                                                                                                                      | Observed fit and limitation                                                                                                                                                                                                                 | Decision / residual work                                                                                                                                                                                                                                                                    |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Native `Map`, `Set`, arrays and prototypes; [ECMAScript 2026 keyed collections](https://tc39.es/ecma262/2026/multipage/keyed-collections.html) | Supports ordered native collections and identity keys. The specification requires average sublinear collection access, not a guaranteed constant-time implementation.                                                                       | Selected direction for existing algorithms; expected linear pass counts assume ordinary map performance and must be measured. No package or runtime upgrade. Residual work is binding indexes to the actual document/occurrence contract.                                                   |
| Existing inspector, controller, document targets, runtime seam and validators                                                                  | Already own semantic merging, ranking, source revision, visible facts, frozen contracts and WebMCP bounds.                                                                                                                                  | Extend these owners; reuse `createOntologyElementReference`, document-target and runtime-contract validation. Do not create a shadow schema or another semantic store.                                                                                                                      |
| Legacy at SRC-003, including its MIT license text                                                                                              | Shows graph indexing, prefix trie and renderer-owned BFS. Its APIs, prefix semantics, `collections/deque` dependency and graph ownership differ.                                                                                            | Algorithm evidence only; no wholesale copy, dependency adoption or compatibility bridge. Exact copied material, if later selected, requires provenance and retained notices.                                                                                                                |
| [MiniSearch](https://lucaong.github.io/minisearch/), registry version `7.2.0`                                                                  | Maintained in-memory text search with tokenization, field scoring, prefix/fuzzy options and update support. Those features do not by themselves establish parity with arbitrary infix matching and Hadden's five-level ranking/alias merge. | Not selected for the initial materialization step. Re-evaluate supported configuration against the oracle if the measured residual search bottleneck justifies a new search component. Registry metadata says MIT; exact adoption/license/integration qualification has not been performed. |
| Fuse.js, registry version `7.5.0`, [maintainer source](https://github.com/krisk/Fuse)                                                          | A credible text-search candidate; official options-page retrieval failed during this pass. Registry metadata says Apache-2.0.                                                                                                               | Unqualified alternative, not rejected on fabricated capability evidence. Any later search-library selection must inspect exact source/options/license and test semantic parity first.                                                                                                       |
| [Graphology traversal](https://graphology.github.io/standard-library/traversal.html), registry version `0.3.1`                                 | Provides BFS, start-node traversal and depth control on a Graphology graph. It does not resolve VOWL records, preserve occurrence multiplicity or implement application revision/restore semantics.                                         | No second graph representation is selected. Existing document arrays plus native adjacency can supply the bounded projection; its residual work is VOWL identity/lifecycle integration. Registry metadata says MIT; package adoption is not qualified.                                      |

Registry versions came from read-only `npm view` queries; metadata is not license clearance or a supported integration test.
The source-only Legacy checkout is an exact reference commit, not a claim about its latest stable package release.
For a newly selected dependency, refresh the official current stable/applicable LTS identity, inspect exact license/terms and transitive assets, obtain exact configuration approval, and qualify the real consumer before adoption.
Do not write a replacement search engine merely because a candidate's evidence is incomplete.

The local Legacy `license.txt` includes both original and 2025 contributor notices.
Hadden's root `LICENSE` and deployed license text are AGPL-3.0, and `package.json` identifies `AGPL-3.0-only`.
No source is copied from Legacy in this planning change; no new rights clearance is claimed.
Before a later source transplant, the implementation owner must retain applicable notices and obtain owner review of actual distributed material.

Use browser [User Timing](https://w3c.github.io/user-timing/) marks/measures for bounded local phase observations and clear the programme's entries after collecting them.
[Long Animation Frames](https://developer.chrome.com/docs/web-platform/long-animation-frames) can supplement supported-browser traces after feature detection; unavailable entries are unavailable evidence, not zero slow frames.
No new telemetry service is selected.
The [WAI-ARIA combobox pattern](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/) informs keyboard and active-descendant checks, alongside the existing search-menu contract.

## Decisions required before dependent execution

| Gate     | Owner and minimum evidence                                                                                                                                                                                  | Affected work                                                                                                              |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| GATE-001 | Maksy accepts an exact revision of REQ/AC/QA/DEC, the R2 route and the chosen slice scope; capture the accepted requirement snapshot through the selected engine.                                           | All implementation. Completion of this planning task does not satisfy this gate.                                           |
| GATE-002 | Owner accepts calibrated performance/memory targets after reproducible baseline fixtures and environment are recorded. Retain proposed values or explicitly revise them with rationale.                     | Performance acceptance; baseline collection belongs to the first relevant accepted slice.                                  |
| GATE-003 | Owner accepts reveal/clear/global-reset behavior, the proposed caps and refusal policy, and transient export/share semantics.                                                                               | SLICE-006; graph/parser/filter slices remain independently plannable.                                                      |
| GATE-004 | Implementer and independent reviewer demonstrate receiver/state compatibility and pilot heap benefit; owner accepts the measured trade-off.                                                                 | Expansion from SLICE-008 to SLICE-009.                                                                                     |
| GATE-005 | Profile actual retained state; owner accepts a specific cache admission/eviction change, if needed, with editing/recovery proof.                                                                            | Any behavioral cache policy in SLICE-010; ordinary release of demonstrably retired resources can be considered separately. |
| GATE-006 | If materialized search fails the accepted target, compare supported current external options and native candidate indexes against the same oracle and memory budget; owner accepts the resulting extension. | Additional substring candidate acceleration after SLICE-007. No prefix-only shortcut or assumed custom trie.               |

The smallest implementation direction is SLICE-001, followed by the independent parser/filter improvements.
No build, package, lockfile, test configuration, CI, deployment, hosting or repository-policy edit is required to write or review this plan.
If implementation later needs one, identify the exact file/setting and pipeline impact and obtain the separate approval required by `AGENTS.md`.
