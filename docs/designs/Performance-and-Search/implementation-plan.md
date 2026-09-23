# WebVOWL performance and search implementation plan

Status: detailed draft for owner review, 23 September 2026.
Planning basis: [change-dossier.md](change-dossier.md), including its source corrections, proposed R2 route, invariants, requirements, acceptance criteria, quality scenarios and decisions.
Source design: [performance and search catalogue](<../WebVOWL Performance and Search Improvements_ Catalogue and Applicability to Hadden-Industries_webvowl.md>).

This plan covers ten independently reviewable delivery slices.
It starts with graph-construction cost, continues through parser/filter work and bounded hidden-result navigation, and ends with measured search and memory improvements.
It preserves the current application-owned ontology and renderer boundary.
No implementation, configuration change, requirement acceptance, commit or publication is performed by this document.

## Baseline and execution boundaries

The inspected target is `e70ffbab0326a709fb51228855a556147432db20`; the Legacy reference is `28e92c7220302c50aa32cebab977ab6e884d8887`.
Use the dossier's hashes for the supplied catalogue and PDF.
Refresh source evidence when execution begins; do not apply the catalogue's historical paths or assume the previous ESM migration still needs implementation.

Before code changes, satisfy GATE-001 through HISEW: accept the exact requirements/route, capture the requirement snapshot and start an execution owned by the actual task/session in its selected admitted worktree.
An implementation checkout must preserve all user-owned changes and obtain any required HISEW worktree adoption.
The existing untracked catalogue remains source material; staging or committing it requires the corresponding user authorization.

All file assignments and new module names below are predictions, not instructions to modify already-compliant files.
Existing test names are identified separately from proposed tests.
The plan uses native ESM and existing dependencies; no package, lockfile, bundler, test, CI, hosting or policy change is presumed.
If a slice needs configuration, stop that dependent change and present its exact file/setting and pipeline effect for the separate approval required by `AGENTS.md`.

Use one integration owner for the programme: the implementer assigned when execution starts, accountable to Maksy.
An independent reviewer owns checking semantic equivalence and the credibility of the evidence; assign the provider/person before R2 acceptance.
Do not treat a module stub, a copied expected output or the implementation author's assertion as that review.

## Architecture and dependencies

Occurrence indexes belong near `linkCreator.js`, renderer materialization and display filters.
They use the actual objects and arrays supplied for that invocation and are discarded when those objects are replaced.
Application indexes belong to the accepted VOWL document/inspection revision and use the existing semantic-reference and document-target contracts.
Only immutable requests/facts cross `RenderedGraphRuntime`; no live node, D3 object or renderer dictionary becomes the application's source of ontology truth.

The main sequence is SLICE-001 → SLICE-002 → SLICE-003 → SLICE-004 → SLICE-005 → SLICE-006 → SLICE-007 → SLICE-008 → SLICE-009 → SLICE-010.
This is a recommended review/release order, not a claim that every slice needs every predecessor.

| Slice     | Hard dependencies                                                                   | Work that may proceed independently after baseline acceptance                                                     |
| --------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| SLICE-001 | GATE-001; relevant baseline and target calibration                                  | Parser/filter fixture design and search-contract review are read-only independent work.                           |
| SLICE-002 | Baseline acceptance; parser oracle                                                  | Implementation can proceed independently of link indexing, but integrate and measure on one agreed base.          |
| SLICE-003 | SLICE-002 integration to avoid concurrent parser ownership; merger oracle           | Subclass fixture preparation is independent.                                                                      |
| SLICE-004 | SLICE-001 occurrence-incidence contract                                             | No shared mutation of link or runtime integration files during integration.                                       |
| SLICE-005 | SLICE-001 incidence semantics; current filter/tidy contract                         | Can be reviewed separately from subclass logic; benchmark runs remain serial.                                     |
| SLICE-006 | GATE-003; stable graph/filter base and document identity contracts                  | Search-index research/fixtures are independent; controller/runtime edits need one owner.                          |
| SLICE-007 | Established search oracle and revision ownership; reconcile SLICE-006 result fields | Query preparation can be designed earlier, but integrate lifecycle and tool schemas together.                     |
| SLICE-008 | Graph/parser/filter contracts stabilized; memory baseline                           | Pilot only, before authorizing expansion.                                                                         |
| SLICE-009 | Qualified SLICE-008 and GATE-004                                                    | Constructor families can be inventoried independently; shared inheritance/callback migrations are serialized.     |
| SLICE-010 | Accepted ownership inventory and GATE-005 for cache-policy changes                  | Retention diagnosis can start early; final evidence must include the added indexes/projection and memory cohorts. |

Parallel work is a dependency observation, not delegation authority.
Never run a benchmark alongside another benchmark, build, test suite or bulk scan; ADR 0003 requires a quiescent measurement window.

## Delivery slices

### SLICE-001 — Load and refresh an identical graph with indexed link construction

**Links:** REQ-001, REQ-008, REQ-012; AC-001, AC-008, AC-012; QA-001, QA-002, QA-006; DEC-001, DEC-009.
**Deliverable:** a complete ontology-load/filter-refresh path with the same graph metadata and lower preparation work.

**Predicted files:** modify `src/webvowl/js/parsing/linkCreator.js` and `src/webvowl/js/runtime/renderedGraphInternals.js`; consider a renderer-local `src/webvowl/js/parsing/incidentLinkIndex.js` if extraction makes the shared incidence operation directly testable.
Add proposed `linkCreator.test.js` and `incidentLinkIndex.test.js` alongside their subjects and proposed `util/benchmark-rendered-graph-preparation.mjs`; reuse `util/benchmarkEnvironment.mjs` and existing fixture-generation conventions.
Existing `src/webvowl/js/elements/links/ArrowLink.test.js`, `BoxArrowLink.test.js`, `src/webvowl/js/parser.test.js` and runtime seam tests remain regression coverage.

- [ ] Record baseline phase timings/work counts and hand-enumerated graph descriptions before replacing the algorithm.
      Record both initial load and filter refresh; the runtime rebuilds links at more than one site.
- [ ] Keep current native Set membership by property ID and inverse assignment.
      Group links by unordered endpoint-object pairs with nested maps or an equivalent collision-free identity structure.
      Preserve link order and one shared ordered `layers()` array per group; assign `layerIndex()` in that order.
- [ ] Group true self-loops using the existing endpoint-reference predicate and assign `loops()`/`loopIndex()` by iteration position.
      Preserve undefined loop metadata on non-loops.
      Do not introduce a per-loop `findIndex`, numeric `layers`, concatenated-ID key or ID-based endpoint merge.
- [ ] Initialize adjacency only for the supplied node objects, walk links once and append in input order.
      Append a self-loop once, replace old arrays on refresh, and do not mutate endpoints outside the supplied node collection.
      Update both `filterFunction` and `refreshLinksAndLabels` through the owning operation.
- [ ] Verify empty/disconnected graphs, every link sharing a pair, all loops on one node, reversed endpoints, inverse pairs, duplicate IDs on distinct objects, IDs containing delimiters, repeated IRIs, mixed link kinds and repeated load/refresh.

**Oracle/proof:** normalize object identity by fixture occurrence ordinal, not IRI; compare metadata and array-sharing assertions as well as serialized values.
Check the underlying endpoint predicate directly: `PlainLink.isLoop()` uses `equals`, whereas current metadata grouping uses reference equality; do not conflate them.
Expected work is a bounded number of node/link passes plus group annotation, with O(V + E) auxiliary references under ordinary Map behavior.
Deterministic work counts are the complexity gate; paired browser/Node timings substantiate benefit rather than replacing semantic tests.

**Release/recovery:** release independently after its full relevant checks and browser load/refresh/export smoke.
No saved schema changes; recovery is the previous qualified artifact plus reload after preserving edits.
Discard temporary maps after preparation; do not retain duplicate global indexes merely because construction was centralized.

### SLICE-002 — Materialize the same parser result without repeated attribute scans

**Links:** REQ-002, REQ-008; AC-002, AC-008; QA-001, QA-002; DEC-002.
**Deliverable:** current source kinds produce the same parsed graph while avoiding per-record attribute scans and unused equal-property lookup.

**Predicted files:** `src/webvowl/js/parser.js`, existing `parser.test.js`, proposed `src/webvowl/js/parser.indexing.test.js`, and the graph-preparation benchmark from SLICE-001.
Use existing `src/owl2vowl/test/vowlBuilder.webvowl.test.js` for the converter/parser boundary.

- [ ] Build each class/datatype/property attribute map once for its collection.
      Preserve strict-equality ID behavior for admitted input, first matching duplicate, absent attributes and base-field precedence; do not normalize IDs or overwrite an earlier entry.
- [ ] Retain separate class/property construction where their responsibilities differ.
      Share only the indexed attribute lookup if useful; a consolidation is not itself an acceptance goal.
- [ ] Evaluate `getOtherEqualProperty` only when `propertyWasRerouted` is true, after the existing endpoint guards.
      Preserve matching by IRI, or type/default label when IRIs are absent, and first-match order.
- [ ] Cover missing/duplicate attributes, existing base values, class/datatype/property differences, equal labels with distinct IRIs, inverse restriction types, equivalent-node rerouting and no-rerouting graphs.
      Preserve input-mutation behavior until its owner separately changes that contract.

**Oracle/proof:** explicit small fixtures establish first-match precedence and rerouting suppression; baseline differential corpus checks compare complete parser output.
Assert one attribute-index build per collection and zero equal-property scans when no property was rerouted.
Attribute association becomes expected O(B + A); equal-property lookup remains potentially quadratic when many properties reroute.
Do not claim the entire parser is linear.

**Release/recovery:** independent parser release after converter, runtime and corpus regressions.
Indexes are parse-local; no persistent migration, new dependency or retained snapshot is needed.

### SLICE-003 — Preserve equivalent-range merging with dynamic endpoint counts

**Links:** REQ-003; AC-003; QA-001, QA-002; DEC-002.
**Deliverable:** equivalent-property merging preserves its current graph while eliminating the repeated endpoint-use scan identified during planning.

**Predicted files:** `src/webvowl/js/parsing/equivalentPropertyMerger.js`, proposed colocated `equivalentPropertyMerger.test.js`, parser integration tests and the preparation benchmark.
This slice intentionally corrects the catalogue's recommendation to exclude the merger.

- [ ] Characterize the current sequence of range changes and hide decisions on small equivalent groups, shared domains/ranges, unresolved references, repeated equivalents and generated default ranges.
- [ ] Build endpoint-use counts from the current raw properties.
      After each actual range mutation, update the old/new contributions before answering whether that old endpoint is still used.
      Count domain and range contributions consistently, including a property using the same endpoint twice.
- [ ] Preserve processed-property behavior, mutation order, undefined guards, generated IDs and the existing cumulative hidden-node decision.
      Do not replace sequential checks with one final-state sweep or copy Legacy's static endpoint sets.
- [ ] Demonstrate that the indexed state equals a fresh endpoint scan after each step in adversarial test sequences and that output nodes/properties match the oracle.

**Oracle/proof:** use a simple test-only scan of the live property list as the independent reference-count oracle, plus hand-checked expected merges.
Measure work against property count and the number of actual equivalent visits; report those dimensions separately instead of promising a universal O(V + E) merger.
Keep this slice separate from changes to the meaning of equivalence.

**Release/recovery:** independent release after parser/converter/equivalence regressions; all state is local to the merge call.
Unexpected changed hide decisions stop the slice for semantic review rather than being reclassified as an optimization.

### SLICE-004 — Apply solitary-subclass filtering through occurrence adjacency

**Links:** REQ-004, REQ-008; AC-004, AC-008; QA-002, QA-003; DEC-003.
**Deliverable:** toggling the existing solitary-subclass filter returns the same ordered graph with less relationship discovery work.

**Predicted files:** `src/shared/js/modules/subclassFilter.js`, its existing `subclassFilter.test.js`, and benchmark/filter integration coverage.
The current filter remains a display operation over supplied occurrences.

- [ ] Index the supplied properties by endpoint object once per invocation.
      Preserve property order and the existing direction of descendant traversal through `rdfs:subClassOf`.
- [ ] Use the adjacency lists for usefulness checks and native sets for removal membership while retaining input-order output arrays.
      Keep per-start visited state correct on diamonds/cycles; any memoization needs its own proof of independence from traversal state.
- [ ] Use a bounded-stack or iterative traversal for long chains only after demonstrating the same traversal semantics.
      Include chains, branching, multiple inheritance, cycles, `owl:Thing`, disjoint/set-operator relations and a descendant with a non-subclass property.
- [ ] Run combinations with earlier visibility filters so the index is built from the graph supplied at that point, not a stale full-ontology cache.

**Oracle/proof:** hand-built expected retained graphs plus current-filter differential results; record adjacency discovery and subsequent traversal work separately.
Indexing removes repeated whole-property scans, but repeated per-root reachability can still be superlinear.
Do not copy the paper's worst-case formula without deriving it for the implemented traversal.

**Release/recovery:** independently releasable filter behavior; discard invocation indexes and restore the previous artifact if qualified semantics change.

### SLICE-005 — Choose the existing automatic degree with fewer trials

**Links:** REQ-005, REQ-008; AC-005, AC-008; QA-002, QA-003; DEC-003.
**Deliverable:** initial automatic collapse and subsequent explicit degree changes preserve the current policy while avoiding repeated degree calculation.

**Predicted files:** `src/shared/js/modules/nodeDegreeFilter.js`, existing `nodeDegreeFilter.test.js`, existing `src/shared/js/util/filterTools.js` as a read/verification dependency, and runtime/controller setting tests.
Changing the tidy policy is outside this slice.

- [ ] Cache datatype-excluding link degrees for one initialization/threshold calculation and for each later filter invocation as appropriate.
      Rebuild when the supplied occurrence adjacency changes; an initialization cache cannot silently serve a changed graph.
- [ ] Prove that the retained-node count from the actual `filterNodesAndTidy` operation is non-increasing over the candidate interval.
      Compare all thresholds on exhaustive small fixtures, including literal ranges retained by another surviving property.
- [ ] If the proof holds, use monotone search for the first satisfying integer threshold in `[0, maximumDegree)`, keeping the current zero fallback when none exists.
      Avoid re-materializing candidate graphs where an exactly equivalent counting operation is established; otherwise reuse the real predicate with logarithmically fewer calls.
- [ ] Preserve the limit of 50, ties, maximum equal to zero/one, explicit zero, requested-value clamping, disabled filtering, new-document automatic selection and the empty-output fallback.
      A result at `maximumDegree` must not silently become a new candidate.

**Oracle/proof:** compare automatic/minimum/maximum values and final ordered outputs to the sequential baseline for every generated small case.
Assert bounded threshold-predicate calls after the monotonicity proof, and report complexity as degree preparation plus O(log D) predicate evaluations; include the actual tidy cost instead of assuming it is linear.
If monotonicity fails for admitted inputs, stop the threshold replacement and replan; degree-count reuse can still be assessed on its own merits.

**Release/recovery:** no slider limit, saved-setting meaning or configuration change.
Current controller tests must show menus and WebMCP report the degree actually applied.

### SLICE-006 — Reveal and clear a bounded hidden-result neighbourhood

**Links:** REQ-006, REQ-008, REQ-011, REQ-012; AC-006, AC-008, AC-011, AC-012; QA-004, QA-006, QA-008, QA-009; DEC-004, DEC-009.
**Deliverable:** a reader or agent selects a hidden representable class/property, sees its complete bounded depth-two neighbourhood, and returns to the ordinary view without losing filter choices.
GATE-003 applies to the behavior and caps below.

**Predicted files:** proposed `src/app/js/controller/searchProjection.js` and `searchProjection.test.js`; existing `webVowlController.js`, `webVowlControllerContracts.js`, `renderedGraphRuntimeContracts.js`, `ontologyInspector.js` and their tests; `src/webvowl/js/runtime/d3RenderedGraphAdapter.js`, `renderedGraphInternals.js` and runtime tests; `src/app/js/menu/searchMenu.js` and its tests; `src/app/js/webmcp/webMcpToolContracts.js`, `webMcpAdapter.js` and corresponding tests; `src/index.html` only for a needed explicit clear/status control; `docs/webmcp.md` and relevant help text.
Update `src/app/test/inMemoryRenderedGraphAdapter.js` and `renderedGraphRuntimeContract.js` with the same legitimate seam contract, not a separate semantic implementation.

**Proposed application contract:** `showSearchNeighborhood` accepts existing ontology-element references and an abort signal; `clearSearchProjection` removes only the temporary projection.
Proposed tools `show_search_neighborhood` and `clear_search_projection` call these controller operations.
A frozen `searchProjection` state fact identifies the load generation, document revision, requested references, depth and observed counts; `null` denotes the ordinary view.
Do not repurpose `view.focus`, `isFocusable` or `resetVisualization` to mean projection selection.
If a new result capability flag is needed, its name must denote eligibility for reveal rather than present visibility, and it must not promise success before budget validation.

- [ ] Build canonical adjacency from the accepted VOWL document records, resolving endpoints and equivalent occurrence mappings with existing application contracts.
      Use record identity for graph traversal and semantic references for the user's request; never merge all equal-IRI occurrences into one graph node.
- [ ] For a class, seed all relevant record occurrences; for a property, seed both endpoint occurrences and retain the requested property.
      Traverse both directions to depth two with visited sets and a queue head index.
      Include every eligible property whose two endpoints are in the selected occurrence set, including parallel edges, self-loops and edges between depth-two boundary nodes.
      Preserve source ordering.
- [ ] Prototype the mapping into the renderer's existing materialized occurrence/representative model before widening the feature. Distinguish a filtered-out drawable record from an unsupported/non-renderable semantic entity.
      Missing endpoints, unresolved occurrence mappings or changes to equivalence/set-operator drawing semantics require a reviewed decision; they cannot be hidden by a partial projection.
- [ ] Enforce the accepted node/property/adjacency-visit/reference caps during construction and before runtime mutation.
      Stop with a useful refusal if any cap is exceeded, including all occurrences of an oversized seed.
      Do not silently truncate, ignore a seed or report a partial neighbourhood as complete.
- [ ] Extend the legitimate runtime seam to apply/clear an immutable record selection while retaining the full source model as the renderer's input.
      Reuse the graph's preparation path.
      The controller must not pass a subset back through the ordinary ontology-load operation, because doing so would replace canonical state and identity generation.
- [ ] Stage a candidate projection and commit its state only after runtime success for the same generation/revision and current operation sequence.
      Retain the previous accepted view for failure recovery; suppress stale results on load, edit, clear, newer reveal or disposal.
- [ ] Route visible-result selection through current focus behavior and hidden-result selection through reveal, preserving grouping of equal display labels.
      An oversized group receives explicit refusal, not an arbitrary first entity.
      Provide keyboard-operable clear/status feedback and keep text-node label rendering.
- [ ] Implement the same operations and outcomes in WebMCP with existing schema validation, exact references, cancellation and result-budget handling.
      Report actual accepted counts and completion, not only that a request was queued.

**Lifecycle decisions to implement together:**

| Event                                                              | Required behavior                                                                                                                                                                                                                                                                     |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reveal another result                                              | Replace the temporary selection; retain the original ordinary-view restoration state rather than stacking projections.                                                                                                                                                                |
| Clear search projection                                            | Restore ordinary filtering and the captured ordinary view/arrangement through supported runtime operations; preserve the document and edits. Never promise identical resumed simulation coordinates after time has advanced.                                                          |
| Change ordinary filters, language, modes or layout while projected | Exit the temporary view successfully, then apply the ordinary request through its current controller path. This draft chooses an explicit exit rather than an implicit mixed filtering policy.                                                                                        |
| Existing global Reset                                              | Clear the temporary projection, then perform the accepted ADR 0012 reset: visualization defaults, cleared focus/selection, resumed layout, retained ontology/language.                                                                                                                |
| New load, revision or disposal                                     | Retire the projection and its indexes; no references or captured restoration state cross the new generation/revision. Before an accepted human edit, clear the projection and route the edit through the full document owner.                                                         |
| Abort or render failure                                            | Keep or restore the last accepted graph and ordinary state; surface the operation error. A stale completion cannot reapply the view.                                                                                                                                                  |
| Export or share                                                    | Drawing/SVG export represents the current visible projection; semantic VOWL/Turtle export still represents the full accepted document including edits. Transient neighbourhoods are not silently serialized as saved ordinary filters or share-link settings; document that omission. |

**Oracle/proof:** independently enumerate expected vertex and induced-edge sets for chains, cycles, hubs, disconnected components, multiple occurrences per IRI, anonymous records, inverse/equivalent properties, datatype and set-operator fixtures.
Test every limit at below/equal/above boundaries and ensure refusals change neither state nor rendered graph.
Use real controller/runtime contract integration for generation/revision races; mocked D3 output cannot prove projection correctness.
Exercise UI and tools in a real production browser, including hidden property reveal, clear, reset, cancellation, edited-document export and stale-reference refusal.

**Release/recovery:** ship UI, controller, runtime, schemas, help and action-parity tests together.
No persistent schema change or temporary compatibility alias is selected.
Before publication, rehearse failure/clear and previous-artifact restore with a recoverable edited document.

### SLICE-007 — Reuse semantic search preparation without changing matching

**Links:** REQ-007, REQ-008, REQ-011; AC-007, AC-008, AC-011; QA-005, QA-006, QA-008; DEC-005, DEC-006.
**Deliverable:** repeated searches avoid rebuilding the same merged records and label indexes, while every established query returns the same ordered semantic answer.

**Predicted files:** proposed `src/app/js/controller/ontologySearchIndex.js` and its tests; existing `ontologyInspector.js`, `webVowlController.js` and their tests; `searchMenu.js` only if its result adapter needs revision; `src/app/js/webmcp/ontologySearchPager.js` and `webMcpSearchPagination.test.js`; proposed `util/benchmark-ontology-search.mjs` using the existing environment guard.

- [ ] Freeze an oracle covering all searchable kinds, all labels regardless of display language, repeated-identity aliases, equivalent-class labels, exact/prefix/infix matches, IRI matches, no matches, whitespace, Unicode and short queries.
      Anonymous local IDs are not newly searchable just because they are identity keys.
- [ ] Materialize existing semantic-record merging, normalized searchable text and equivalent-label/reference indexes once per accepted document revision.
      Preserve `query.trim().toLowerCase()`, the current five ranks, kind rank and identity `localeCompare` ordering; add no tokenization, fuzzy matching, accent folding or Unicode normalization.
- [ ] Bind index ownership to the accepted snapshot/generation/revision.
      Reuse immutable semantic data across visibility-only changes, but compute `isFocusable` from current visible facts and presentation labels from the current language.
      Rebuild or retire on accepted edits, replacement, failure recovery and disposal as appropriate.
- [ ] Keep exact total counts and offset behavior.
      UI continues grouping all references for each display label before presenting six groups.
      WebMCP retains request limits, exact-identity envelope behavior, eight retained continuation records and stale generation/revision/language checks.
      Do not cache ontology-sized result arrays per continuation.
- [ ] Benchmark index construction plus first query, warmed query distributions, common/one-character queries and retained heap. Compare complete ordered answers to the frozen oracle, including language/filter changes between queries and pages.

**Oracle/proof:** the current inspector supplies differential evidence; hand-enumerated ranking cases independently establish why it is correct.
The selected first step indexes semantic preparation, not a new prefix-only lookup algorithm.
Candidate scanning and large-result ranking can remain proportional to the corpus/result size; disclose that bound.
If the accepted latency target remains unmet, GATE-006 requires a current supported-component comparison and explicit selection before additional substring indexing.
An optional n-gram candidate filter must prove completeness with the existing substring predicate, account for short queries and Unicode code-unit behavior, and earn its retained-memory cost; it is not pre-approved by this plan.

**Release/recovery:** the unchanged search contract allows independent rollout after integration with any new reveal capability field.
Indexes remain transient; invalidation drops references and regenerates from the current document.
No serialized trie, dependency addition or versioned search-storage format is selected.

### SLICE-008 — Qualify shared methods through a link-constructor pilot

**Links:** REQ-009, REQ-012; AC-009, AC-012; QA-001, QA-007; DEC-007.
**Deliverable:** one complete link creation/drawing/update/export path uses shared behavior with demonstrated allocation savings.

**Predicted files:** `src/webvowl/js/elements/links/PlainLink.js`, its direct `ArrowLink.js`/`BoxArrowLink.js` consumers only as required, proposed `PlainLink.test.js`, existing link tests and proposed `util/benchmark-rendered-occurrence-memory.mjs`.
Select the exact pilot method cohort after the inventory; do not convert all constructors to classes by text substitution.

- [ ] Inventory prototype and own methods, enumerable fields, getter/setter return behavior, detached callbacks, receiver assumptions, constructor `.apply` calls and consumers that reflect or clone the pilot object.
- [ ] Share eligible method implementations through the existing native prototype chain, with instance state stored privately through an appropriate native mechanism such as a module-owned WeakMap.
      Retain callable accessors and the existing inheritance contract.
      Class syntax is not needed if it would break `.apply` consumers.
- [ ] Preserve legitimate per-instance event handlers or receiver capture only where the consumer requires them.
      Do not call `.bind` on every method, add duplicate old/new APIs, or invent a compatibility wrapper merely to make a mechanical conversion pass.
- [ ] Exercise ordinary, inverse, loop, parallel and specialized links through creation, property updates, geometry, selection, drawing and export.
      Prove isolation between two instances and shared identity for every method intentionally moved.
- [ ] Measure function-object counts and retained allocation at 1k/10k/100k comparable instances and the integrated rendered workload, including any WeakMap/state overhead.
      Record the method cohort and unmet callback contracts.

**Oracle/proof:** descriptor/receiver tests plus actual inherited constructors and browser drawing; function identity alone is insufficient.
Heap evidence uses equal live graph sizes and the same measurement conditions, with no fixed-time GC assertion.
GATE-004 requires independent review and owner acceptance of actual benefit before expanding the technique.

**Release/recovery:** keep the pilot small enough to revert as one coherent constructor/consumer change; do not mix it with search or parser algorithms.
Delete experimental variants when the accepted implementation is chosen, retaining measurements as evidence.

### SLICE-009 — Extend qualified method sharing across coherent occurrence families

**Links:** REQ-009, REQ-008, REQ-012; AC-009, AC-008, AC-012; QA-001, QA-006, QA-007; DEC-007.
**Deliverable:** the selected node/property/label families consume less memory while rendering, editing and exporting the same document.

**Predicted files:** `src/webvowl/js/elements/BaseElement.js`, `nodes/BaseNode.js`, `properties/BaseProperty.js`, `links/Label.js`, `links/linkPart.js`, `forceLayoutNodeFunctions.js` and only the implementation subclasses actually affected by the inventory.
Add focused contract tests beside each changed family; extend runtime editing/configuration/export and controller document tests.

- [ ] Reconcile the pilot method/state inventory against the complete inheritance and callback graph.
      Distinguish semantic document data from occurrence state and retain renderer ownership.
- [ ] Deliver coherent construct/draw/interact/export cohorts: first the shared base with all affected consumers, then node-specific behavior, then property/label/link-part behavior.
      Each cohort has its own candidate checks and allocation comparison; do not leave a partially incompatible inheritance chain between commits.
- [ ] Preserve private mutable arrays, optional-argument getter/setter semantics, fluent returns, overridden methods, dynamic `this`, event listener removal identity, D3 force-node fields and supported object introspection.
- [ ] Exercise drag, hover, selection, pinning, inverse/property setters, all filters, editing, supported exports, language changes, abort/reload and disposal in the actual runtime.
      Do not broaden experimental editor capabilities.
- [ ] Remove only obsolete scaffolding created by the migration; audit retired listeners, closures, prototype duplicates and temporary factories.
      Re-measure the complete graph to verify that savings were not replaced with a larger retained state index.

**Oracle/proof:** all accepted renderer/controller/API contracts plus per-cohort state-isolation and allocation evidence.
Passing tests after weakening their receiver or identity assertions is not equivalence evidence.
If a shared-method change requires an obsolete-contract bridge, stop for a specific NSH-01 owner decision or redesign the owning code and consumers coherently.

**Release/recovery:** each coherent cohort is releasable only after full relevant regression/browser evidence; retain the preceding qualified artifact.
No saved-document ABI change is intended.
A required change to stored/exported fields reopens the baseline and migration design.

### SLICE-010 — Retire disposable sources and indexes while preserving recovery

**Links:** REQ-008, REQ-010, REQ-012; AC-008, AC-010, AC-012; QA-006, QA-007, QA-009; DEC-008.
**Deliverable:** repeated load/navigation/reveal/edit/dispose cycles retain only state with an explicit live owner; any selected cache-policy change is measured and recoverable.

**Predicted files:** `src/app/js/controller/webVowlController.js`, `ontologySourceLoader.js`, `vowlDocument.js`, the new search/projection indexes and their tests; `src/webvowl/js/runtime/renderedGraphInternals.js`/`d3RenderedGraphAdapter.js` only where a demonstrated retired reference remains; the memory benchmark.

- [ ] Capture a retention inventory for source text/buffers, accepted document, prior-load recovery document, four-entry URL-navigation cache, inspection/search indexes, projection restoration state, renderer clones, listeners and pending operations.
      Identify each owner and release event from actual heap paths.
- [ ] Remove demonstrably redundant references at successful completion, supersession, replacement, clear or disposal.
      Retain the accepted document and failure-recovery state until their real owner no longer needs them.
      Guard asynchronous completion against resurrecting retired caches.
- [ ] If the four-entry cache dominates memory, propose a specific admission/eviction policy with a byte-estimation method, bound, reload semantics and treatment of edited snapshots.
      Obtain GATE-005 acceptance before changing behavior.
      Do not use repeated whole-document serialization or an unmeasured 50 MB string cutoff as the solution.
- [ ] Test URL revisit with reuse requested, cache miss, concurrent load cancellation, failed-load restoration, accepted human edits, semantic export and index disposal.
      No cache eviction may discard the only recoverable edited document.
- [ ] Measure ten repeated load/reveal/clear/dispose cycles and retained heap paths.
      Separate expected live cache occupancy from leaked retired generations; record whether peaks arise from source parsing, snapshots, renderer occurrences or indexes.

**Oracle/proof:** behavioral recovery fixtures and native heap/allocation inspection establish both safety and benefit.
Use WeakMap/GC observations as supporting evidence; deterministic tests assert ownership release, not that GC runs within an arbitrary timeout.
If no removable retention is demonstrated, record a no-change result for that owner instead of manufacturing cleanup.

**Release/recovery:** transient-index cleanup needs no backfill.
A cache-policy change must ship with documentation and a recovery exercise; persistent storage or durable schema work is outside this baseline and requires replanning.

## Traceability and catalogue coverage

| Slice     | REQ / AC / QA / DEC                                                                                                     | Falsifiable proof                                                                                 | Release and cleanup implication                                                                     |
| --------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| SLICE-001 | REQ-001, REQ-008, REQ-012 / AC-001, AC-008, AC-012 / QA-001, QA-002, QA-006 / DEC-001, DEC-009                          | Ordered link/incidence equivalence, sharing assertions, bounded work and initial/refresh timing.  | First independent delivery; native Set grouping is retained, not reimplemented; release local maps. |
| SLICE-002 | REQ-002, REQ-008 / AC-002, AC-008 / QA-001, QA-002 / DEC-002                                                            | First-match attribute and rerouting oracle; no unused equal-property scan.                        | Parser-local maps, same element APIs.                                                               |
| SLICE-003 | REQ-003 / AC-003 / QA-001, QA-002 / DEC-002                                                                             | Sequential merge/hide equivalence and counts checked after each mutation.                         | Adds the catalogue's incorrectly excluded hotspot; no persistent index.                             |
| SLICE-004 | REQ-004, REQ-008 / AC-004, AC-008 / QA-002, QA-003 / DEC-003                                                            | Filter outputs on recursive/pathological graphs and prior-filter combinations.                    | Invocation-scoped occurrence adjacency; no canonical model migration.                               |
| SLICE-005 | REQ-005, REQ-008 / AC-005, AC-008 / QA-002, QA-003 / DEC-003                                                            | Exhaustive threshold equivalence, monotonicity proof and reduced predicate calls.                 | Preserve the 50-node policy, user settings and fallback.                                            |
| SLICE-006 | REQ-006, REQ-008, REQ-011, REQ-012 / AC-006, AC-008, AC-011, AC-012 / QA-004, QA-006, QA-008, QA-009 / DEC-004, DEC-009 | Independent neighbourhood sets; caps, atomic failure, lifecycle, UI/tool parity and export proof. | Coherent contract release; retire projection state on revision/clear/dispose.                       |
| SLICE-007 | REQ-007, REQ-008, REQ-011 / AC-007, AC-008, AC-011 / QA-005, QA-006, QA-008 / DEC-005, DEC-006                          | Exact query/ranking/pagination equivalence plus build/query/heap measurements.                    | Revision-owned preparation index; prefix trie not selected; later candidates require GATE-006.      |
| SLICE-008 | REQ-009, REQ-012 / AC-009, AC-012 / QA-001, QA-007 / DEC-007                                                            | Actual link behavior, method sharing, state isolation and heap benefit.                           | Releasable pilot; GATE-004 controls expansion.                                                      |
| SLICE-009 | REQ-009, REQ-008, REQ-012 / AC-009, AC-008, AC-012 / QA-001, QA-006, QA-007 / DEC-007                                   | Per-family contracts, rendering/editing/export and full allocation evidence.                      | Coherent inheritance cohorts; remove migration scaffolding, preserve legitimate callbacks.          |
| SLICE-010 | REQ-008, REQ-010, REQ-012 / AC-008, AC-010, AC-012 / QA-006, QA-007, QA-009 / DEC-008                                   | Retention paths, navigation/edit recovery and repeated-cycle evidence.                            | Reject an arbitrary 50 MB transplant; require accepted cache policy and preserve recovery state.    |

Every catalogue recommendation has a disposition: layers/loops/incidence are SLICE-001; existing property membership is a verified no-change item; attributes and short-circuiting are SLICE-002; equivalent merging is SLICE-003; subclass and degree work are SLICE-004/005; hidden navigation and indexing are SLICE-006/007; object allocation is SLICE-008/009; retained-source/cache work is SLICE-010.
The representation and semantics of Legacy code are not adopted merely because the algorithm is useful.

## Evidence protocol and test-oracle ownership

The implementation owner retains one evidence record per candidate/slice with source SHA and dirty-state digest, fixture hashes/generator revision, exact commands/runtime/dependency identity, outputs, raw measurements and limitations.
An independent reviewer checks expected behavior and whether the candidate actually meets the accepted criteria.
Do not rewrite a golden result solely because the new implementation produces it.
Retain a simple baseline or mathematical oracle only in test/evidence scope; it is not a shipped compatibility implementation.

Mock genuine external boundaries such as network fetch, browser scheduling, cancellation signals and the declared renderer port in controller unit tests.
Exercise real parsing, indexing, ranking, traversal and filter logic in their tests.
The in-memory runtime checks application orchestration, while the actual D3 adapter/browser checks geometry and visible results; neither substitutes for the other.

### Corpus and measurement design

Use `src/app/data/foaf.json`, `goodrelations.json`, `ontovibe.json` and `benchmark.json` as checked-in reference inputs, alongside relevant converter fixtures.
Record bytes/hashes and actual class/property/link counts at each representation; entities, document records, links and rendered occurrences are different units.
Exercise all four source kinds: `ontology-document-iri`, `ontology-text`, `vowl-json-url` and `vowl-model`.

Generate reproducible fixtures for empty/disconnected graphs, chains, dense parallel pairs, many self-loops, high-degree hubs, repeated IRIs/IDs, equivalent groups, cycles/diamonds, datatypes and set operators.
The linear-work series is 1k, 2k, 4k, 8k and 16k graph units with explicit V/E counts; memory/search workloads additionally use 1k, 10k and 100k records/occurrences as appropriate.
Generated topology and labels must have fixed seeds and documented distributions.

FOAF/ENVO/YAGO numbers from the paper motivate the workload range.
No exact ENVO/YAGO fixture or current Hadden measurement was established by this planning task.
If those datasets become acceptance inputs, acquire the exact versions with retained provenance/rights, convert reproducibly and hash the resulting bytes before comparing candidates.
Synthetic data does not establish the paper's reported speedup or real-ontology capacity.

Use the repository-selected runtime and existing quiescent-machine guard.
Collect baseline and candidate sequentially on the same machine/browser, with one warm-up and at least five recorded timed runs per phase/input; retain every sample and report median and spread.
Use a fixed query suite with enough repetitions to make p50/p95 meaningful, documenting its exact sample count and whether indexes are cold or warm.
Do not run source scans or other tests while timing.
Corroborate a suspected breach as ADR 0003 requires; retain discarded contaminated runs and the evidence of contamination.

Record separately: source read/conversion, renderer parse, link metadata, adjacency, each filter, projection construction/application, index build, query/ranking, render-ready time and total load time.
Record visible and semantic counts beside every speed result.
Measure cold/warm startup, drag/zoom responsiveness and peak/retained heap where affected; a faster preparation phase can expose D3/SVG layout as the next bottleneck.
Budget a later renderer redesign only through a new decision, not as automatic expansion of this programme.

A timer sampler cannot observe a transient synchronous heap peak while the main thread is blocked.
Use browser allocation/heap tooling for memory claims and distinguish sampled heap, retained heap and process memory.
Neither changing `var` nor adding `class` syntax is itself memory evidence.

### Verification matrix

Commands below are planned execution checks, not results obtained while writing this plan.
Use local installed tools and the selected development runtime; record exact versions and lockfile identity without updating configuration.
New test/benchmark paths become runnable only after their slice creates them.

| Scope                        | Check                                                                                                                                                                                                                                                    | Evidence required                                                                                                                                                                                                        |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Target identity              | `git status --short --branch`; `git rev-parse HEAD`; `node --version`; `npm --version`; `npm ls --depth=0`                                                                                                                                               | Explain dirty inputs and dependency/environment mismatches before comparison.                                                                                                                                            |
| Fast graph/parser feedback   | `npm test -- --runInBand --runTestsByPath src/webvowl/js/parser.test.js src/webvowl/js/elements/links/ArrowLink.test.js src/webvowl/js/elements/links/BoxArrowLink.test.js` plus the slice's proposed tests once added                                   | Real contracts, not only source-pattern assertions.                                                                                                                                                                      |
| Filter feedback              | `npm test -- --runInBand --runTestsByPath src/shared/js/modules/subclassFilter.test.js src/shared/js/modules/nodeDegreeFilter.test.js`                                                                                                                   | Current filter policy plus newly added adversarial and threshold cases.                                                                                                                                                  |
| Semantic/controller feedback | `npm test -- --runInBand --runTestsByPath src/app/js/controller/ontologyInspector.test.js src/app/js/controller/vowlModelInspectionProjector.test.js src/app/js/controller/webVowlController.test.js src/app/js/controller/ontologySourceLoader.test.js` | Search results, ownership, edits, load/revision/cancellation and recovery.                                                                                                                                               |
| Runtime and UI               | `npm test -- --runInBand --runTestsByPath src/webvowl/js/runtime/d3RenderedGraphAdapter.test.js src/webvowl/js/runtime/renderedGraphSeamConformance.test.js src/webvowl/js/runtime/renderedGraphEditing.test.js src/app/js/menu/searchMenu.test.js`      | Actual adapter integration and menu contracts; new projection contracts included.                                                                                                                                        |
| Agent parity                 | `npm test -- --runInBand --runTestsByPath src/app/js/webmcp/webMcpToolContracts.test.js src/app/js/webmcp/webMcpAdapter.test.js src/app/js/webmcp/webMcpSearchPagination.test.js src/app/js/webmcp/webMcpDetailConsistency.test.js`                      | Input/result bounds, exact identities, stale continuations and completed effects.                                                                                                                                        |
| Architecture                 | `npm test -- --runInBand --runTestsByPath src/renderedGraphDecoupling.architecture.test.js src/productionModuleFormat.architecture.test.js src/productionGraph.architecture.test.js src/owlapiConsumerBoundary.architecture.test.js`                     | Ownership/dependency constraints still hold; no renderer semantic-store regression or ESM rollback.                                                                                                                      |
| Complete relevant suite      | `npm test -- --runInBand`                                                                                                                                                                                                                                | Run on the frozen candidate after focused checks; retain actual failures, coverage and skipped prerequisites.                                                                                                            |
| Quality/tooling              | `npm run lint`; `npm run format:check`; `npm run test:setup`; `npm run test:prose` as required by the candidate/pipeline                                                                                                                                 | Correct formatting/lint first; no broad formatter writes over user-owned files.                                                                                                                                          |
| Production build             | `npm run build`; then `node util/verify-webvowl-lazy-parser-chunks.mjs`                                                                                                                                                                                  | Production artifact and lazy parser boundaries. Inspect artifact-producing test behavior before reusing on-disk output.                                                                                                  |
| Real browser                 | Serve the production build with `npm run preview`; compare a separate cold `npm run dev` run where relevant                                                                                                                                              | Load, filter, degree, visible/hidden class/property search, clear, global reset, keyboard/touch, drag, zoom, language, editing, supported export and reload. Record browser, console/network errors and measured phases. |
| Performance and memory       | Slice benchmark entry points plus native browser performance/allocation tooling                                                                                                                                                                          | ADR 0003-compliant raw evidence and accepted QA targets; deterministic work counts where possible.                                                                                                                       |
| Native security review       | Scope the selected native reviewer to changed untrusted-input, resource-limit, DOM, controller and WebMCP boundaries                                                                                                                                     | Actual reviewed target and dispositions; no generic clean-security claim from ordinary tests.                                                                                                                            |
| Hosted acceptance            | Owner-authorized deployment of the qualified artifact and a smoke/recovery exercise                                                                                                                                                                      | Exact SHA/artifact identity, hosted behavior and restored previous artifact; CI/build do not establish these.                                                                                                            |

The registered HISEW R2 requirement is profile `full`, currently `npm run build` with a 600-second declaration timeout.
Other current declarations are `focused` → `npm run lint` and `affected` → `npm run test`, also 600 seconds.
Reinspect applicability, policy, binding and verification gaps at execution time; use the selected engine's governed verification for its required profile and retain additional product evidence explicitly.
Do not relabel an ordinary test transcript as an engine receipt or change the registered profiles to make this plan easier to run.
The existing declarations do not prove that full tests, performance or browser acceptance happened.

Finish authorized formatting, inspect the complete diff including untracked new files, freeze the candidate and run final checks once.
A later edit requires a scope-based decision about which evidence is stale; repeated whole-suite runs without changed inputs add no assurance.

## Compatibility, trust, observation and release

Existing VOWL documents, saved ordinary settings, semantic references and source APIs remain the compatibility baseline.
There is no database backfill, persistent search schema or automatic data migration.
Transient maps rebuild on load/revision; an interrupted implementation resumes from its last qualified slice and retained evidence, after reconciling the actual working tree.
Runtime interruption uses operation/generation ownership and accepted-document recovery, not process memory as a durable checkpoint.

New requests reuse authoritative controller/runtime/WebMCP validators.
Reject unsupported fields, stale references and excessive work before rendering effects; never evaluate a query as a regular expression or construct label HTML.
Keep the current text-node/mark-element approach in the search menu.
Scope the security review to graph/index resource exhaustion, pathological labels/queries, stale-operation races, output bounds and any new trust-boundary behavior.
No remote telemetry, new service or browser permission is selected.

Local observations answer: which phase dominates, how many graph facts survived, whether the search index repays its build cost, whether a reveal refused because of limits, and which generation retains memory.
Use aggregate counts, durations and stable operation/error names; omit document content and query text.
Bound diagnostic buffers and clear collected User Timing entries.
Long Animation Frame evidence is optional and feature-detected; use native performance traces where it is unavailable.

Maksy accepts release; the implementation owner is the responsible first-release observer until another named owner accepts handoff.
Assign the actual human/provider before publication rather than treating this role label as completed staffing.
For each slice, qualify local production preview, retain the previous deployable artifact, obtain independent review, then use the separately authorized repository delivery and hosting path.
The first graph/parser/filter releases do not depend on shipping search or object-model changes.

Abort release on unexplained semantic differences, stale state, lost edits/recovery, missing critical browser evidence, unresolved security findings, or corroborated breaches of the accepted resource/performance budgets.
For a deployed regression, preserve/export active edits, restore the known qualified artifact through the demonstrated hosting route, and verify load/filter/search/export on that artifact.
If rollback cannot preserve an edited or newly serialized state, contain the affected action and plan a forward fix; do not claim restoration is safe until demonstrated.
No flag service, deployment-script change or force push is implied.

Cleanup covers new temporary benchmark fixtures/processes, obsolete migration-only methods, retired index references/listeners and abandoned experimental code.
Retain reviewed evidence, source/license provenance and the accepted baseline.
Deleting branches/worktrees or user-owned files requires its own lifecycle/authorization; neither planning nor successful tests supplies it.

## Unknowns, cheapest experiments and replanning

| Unknown                                          | Cheapest discriminating evidence                                                                                             | Owner / consequence                                                                                           |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Dominant current loading phase                   | Instrument one existing medium fixture and the synthetic doubling series before optimizing.                                  | Implementer; move a lower-value slice later if its hotspot is insignificant, with owner agreement.            |
| Supported pathological identity/attribute inputs | Existing schema/parser tests plus explicit duplicate/missing-ID fixtures.                                                    | Semantic reviewer; preserve admitted behavior and do not broaden/restrict input silently.                     |
| Degree predicate monotonicity                    | Exhaustively compare thresholds on small graphs with datatype tidy and shared ranges.                                        | Algorithm reviewer; failure blocks binary-search selection, not honest degree-cache measurements.             |
| Canonical record-to-renderer projection fidelity | One hidden class, one inverse/equivalent property and one repeated-IRI fixture through the real seam.                        | Architecture reviewer and Maksy; inability to preserve induced relations reopens DEC-004 before full UI work. |
| Usable neighbourhood caps                        | Construct exact depth-two results for typical selections and a hub; measure counts, refusal frequency and render/clear time. | Maksy; accept or revise GATE-003 values before implementation of that policy.                                 |
| Benefit of materialized search                   | Benchmark the existing query corpus with/without repeated preparation, including build/heap cost.                            | Implementer/reviewer; GATE-006 controls any larger indexing project.                                          |
| Viability of shared methods                      | Pilot a representative PlainLink cohort and inspect real receiver/heap evidence.                                             | Memory reviewer/Maksy; failed benefit or contract proof blocks SLICE-009 expansion.                           |
| Safe retention savings                           | Heap paths during a failed load and edited-document navigation cycle.                                                        | Recovery reviewer/Maksy; do not evict state without an accepted owner/recovery rule.                          |
| Representative large real input                  | Pin and hash a rights-reviewed ENVO/YAGO artifact or another owner-accepted large ontology.                                  | Maksy; disclose synthetic-only evidence until qualified, rather than asserting paper-scale results.           |

Replan when the target architecture changes; a new dependency/configuration is necessary; matching/ranking/filter semantics would change; occurrence identities would be collapsed; budgets reject the intended workload too often; a baseline hotspot disappears; sharing requires a shim; or recovery requires a persistent schema change.
Rebaseline requirements and route before expanding into owlapi, a renderer rewrite, workers, persistent storage or a new public protocol meaning.
If a proposed target conflicts with semantic completeness or recovery, those hard constraints prevail until the owner accepts a revised outcome.

Planning is complete when this document and dossier are consistent, source-grounded and reviewable.
Implementation acceptance requires the accepted baseline, completed slice evidence and reviews.
Release readiness additionally requires the actual delivery/observation/recovery evidence; these are separate claims.
