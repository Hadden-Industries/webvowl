# WebVOWL performance and search implementation plan

Status: revised draft with canonical transposition experiments for owner review, 5 October 2026.
Reconciliation interval: inclusive `2026-09-23T00:00:00Z` through original audit HEAD `0fbf00ef51f65f1235f4d3b24cc1706cd2a5ade8`, supplemented below through measured transposition baseline `5f5a5e955f3ac5ac6f3bceaf3201a79708759938` and the preserved working-tree inputs.
Planning method: HISEW thin implementation planning; this documentation maintenance is R0, while the proposed implementation programme remains R2 and requires GATE-001.

The [original dossier](change-dossier.md) supplies stable REQ/AC/QA/DEC identifiers and the [catalogue](<../WebVOWL Performance and Search Improvements_ Catalogue and Applicability to Hadden-Industries_webvowl.md>) supplies the original hypotheses.
This revision records the proposed amendments to that dossier explicitly; it does not represent owner acceptance or rewrite historical evidence.
The catalogue is now tracked, having been published with the original plan in commit `c6d3b8713018e9596134ed8021c86ae81bfafb67`.

Canonical VOWL now owns the production application, admitted semantic records, occurrence topology, scene and export path.
The old parser and display-filter entry points are bypassed, but their repeated-lookup, grouping, adjacency and degree-preparation lessons remain relevant to the replacement architecture.
The earlier blanket withdrawal of SLICE-002–005 conflated an obsolete patch target with an obsolete optimization hypothesis.
This revision corrects that inference with current caller traces, bounded differential experiments and measured prototype results.
All ten original slices retain a disposition: six remain adapted proposals, SLICE-002/003 have evidence-supported canonical targets, SLICE-004 records an already-bounded traversal with further qualification obligations, and SLICE-005 conditionally reuses explicit-degree preparation.
SLICE-011 coordinates broader canonical preparation reuse.
No production optimization or implementation acceptance is claimed; the measured prototype gains and their limits are recorded separately below.

## Baseline, authority and reasoning order

The pre-interval baseline is `e70ffbab0326a709fb51228855a556147432db20`, also the source baseline used by the original plan.
Local and remote main were reconciled at `c65770dab849279cf44da822a4501dcc34365efa` before this follow-up.
A concurrent task then committed the previously modified cache plan and supplied assessment as `5f5a5e955f3ac5ac6f3bceaf3201a79708759938` and selected its documentation branch; that is the HEAD recorded by the complete experiment.
The three commits after the original audit change only planning/research documents; the production source and dependency-lock identities used by these experiments are unchanged from `0fbf00ef51f65f1235f4d3b24cc1706cd2a5ade8`.
The Legacy reference `28e92c7220302c50aa32cebab977ab6e884d8887` and the dossier's paper/catalogue provenance remain historical algorithm references, not current correctness or timing oracles.
All current-source claims below were checked against this checkout; reports of earlier tests and deployment retain their original evidential scope.

For every proposed change, use this ordered reasoning process:

1. **First principles:** identify the observable reader outcome, semantic invariants, true owner, work performed and live memory retained; remove unnecessary work only if the same facts and recoverable state survive.
2. **Maintained modern best practice:** measure the actual production path, retain worker isolation for expensive canonical work, avoid repeated preparation and large main-thread clones, and assess whole-interaction responsiveness.
3. **Authoritative specifications and guidelines:** check exact language/platform behavior, canonical contracts, resource accounting and accessibility interactions against the sources below.
4. **Adopted practice:** apply the repository's ADRs, HISEW, tests, corpus storage and established UI/tool conventions; use Legacy/community techniques only when the higher-ranked evidence supports them.

This is the order of engineering reasoning, not permission to override mandatory interoperability rules, explicit owner decisions or configuration boundaries.
Binding constraints apply throughout.
Popularity and historical benchmark results cannot establish correctness or benefit on the current application.

| Choice                                     | First-principles reason                                                                                          | Modern practice and authoritative evidence                                                                                                                                                           | Adopted application consequence                                                                                                                          |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Optimize reachable work                    | A bypassed call site cannot improve production latency, but the same avoidable work can recur under a new owner. | Trace the complete current operation and measure phases and [main-thread long tasks](https://web.dev/articles/optimize-long-tasks), including work surrounding a worker.                             | Retire obsolete patch targets; transpose each technique and test SLICE-002–005 before deciding whether to implement, retain existing behavior, or defer. |
| Index by the owning identity               | Distinct occurrences or semantic roles must not collapse.                                                        | Native [ECMAScript Map/Set semantics](https://tc39.es/ecma262/multipage/keyed-collections.html#sec-map-objects); contracts define equality, ordering and lifetime.                                   | Renderer indexes use object identity; semantic indexes use `ontologyElementReferenceKey`, including `roleKind`; canonical IDs are revision-bound.        |
| Retain bounded canonical operations        | Equivalent successful bytes do not justify unbounded work or loss of cancellation.                               | [RDF Dataset Canonicalization](https://www.w3.org/TR/rdf-canon/) and its poisoning considerations; [HTML worker processing](https://html.spec.whatwg.org/multipage/workers.html#terminate-a-worker). | Reuse the existing worker client, budgets, exact charge accounting and stale-result checks; no alternate canonicalizer or automatic budget increase.     |
| Preserve a complete document during reveal | A view change must not rewrite ontology meaning or occurrence identity.                                          | Current canonical core/projection/compatible-artifact contracts; APG [combobox interaction](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/).                                                     | Temporary view state overlays admitted occurrences; details-only facts remain accessible; clear and failure restore ordinary scene state.                |
| Measure memory ownership                   | Function counts and process samples do not prove retained-heap savings.                                          | [Chrome memory diagnosis](https://developer.chrome.com/docs/devtools/memory-problems), [User Timing](https://www.w3.org/TR/user-timing/) and actual retainer paths.                                  | Shared-method work stays a measured pilot; report worker/process/heap observations separately.                                                           |

These primary sources were checked on 5 October 2026.
The installed modern-web-guidance performance guide was also retrieved; its search reported a newer skill revision, which was not installed.
Its general worker/yielding advice is subordinate to the actual contracts and measurements here.
`scheduler.yield()` must be feature-detected if selected later; splitting preparation cannot introduce an asynchronous interruption inside the existing synchronous scene publication transaction.
No scheduling polyfill, new dependency or browser-policy change is selected.

HISEW applicability was inspected as personal/active and ready, using the session's actual installation and directory.
Original documentation execution `40ca9fc0-982c-4675-9445-eb4df21251f4` completed the repository reconciliation.
Follow-up R0 execution `da597b3f-8336-47b0-8c16-61ba4bc57e6f` covers this plan correction and external diagnostic experiments, without production implementation.
The configured evidence root is `C:/Users/maksy/.hi/w/e`; supporting audit material is under `operator-reports/performance-search-plan-20261005/` there.
The follow-up scripts, exact inputs, prototype source, raw paired measurements and results are in sibling `operator-reports/performance-search-canonical-transposition-20261005/`.
Historical `.sdlc/runtime` locations are not the destination for this revision.

Before implementation, GATE-001 requires the owner's accepted requirements, amendments, risk route, test oracle and exact requirement snapshot, followed by an execution owned by the implementing session.
The integration owner is the assigned implementer, accountable to Maksy; assign the independent semantic/performance/recovery reviewers before R2 acceptance.
This draft neither supplies those approvals nor transfers authorizations from earlier canonical implementation sessions.
Any required configuration change needs its exact file, setting, behavioral/pipeline impact and separate approval under `AGENTS.md`.
All predicted new modules below are proposals, not permission to alter configuration or introduce an unnecessary abstraction.

## Current architecture and material changes

The production chain is `src/main.js` → `canonicalApplication.js` → `canonicalWebVowlController.js` → source acquisition/document session → worker-owned `vowl`, `vowl/owl` or named `vowl/migrate` admission → canonical inspection/scene/render projection → rendered runtime.
`packages/vowl` is an existing private experimental workspace, and `owlapi` is already the public npm alias `@hadden-industries/owlapi@0.1.0-rc.1`.
Neither recreating the retired converter nor adding a worker is a prerequisite.

| Boundary                                       | Current owner and observed change                                                                                                                                                                         | Consequence for this programme                                                                                                                                                                                                             |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Admission, canonicalization and retained facts | `packages/vowl/src/` implements strict model/byte admission, profiles, deterministic projection, compatible qualifications, source statements, OWL mapping/export and named historical migration.         | Optimize around these contracts; retain successful bytes, graph/record counts, exact source evidence, diagnostics and rejection behavior.                                                                                                  |
| Source and imports                             | `canonicalVowlSourceAcquisition.js` and relocated `importResolver.js` preserve bounded bytes, source context, public format metadata and controlled imports.                                              | Network time is a separate measured phase; do not move it into a renderer or recreate `ontologySourceLoader.js`.                                                                                                                           |
| Accepted document and recovery                 | `canonicalVowlDocumentSession.js` owns admitted checkpoints, inspection, record tokens, scene reconciliation and transactional publication. Worker jobs copy inputs and terminate on completion/abort.    | Index lifetime includes load generation and document revision; preserve checkpoint ownership and failed-load/edit recovery. Scene synchronization and edit reconciliation still contain repeated reference/placement scans: SLICE-002/003. |
| Canonical view                                 | `canonicalVowlScene.js` and `canonicalVowlViewControls.js` operate on admitted occurrences, hidden-visibility closure and explicit degree.                                                                | Canonical automatic minimum degree is zero; the old automatic 50-node collapse and recursive solitary-subclass policy are not the production policy.                                                                                       |
| Projection and rendering                       | `canonicalVowlRenderProjection.js` supplies exact occurrence rows to `canonicalRenderElements.js`; `renderedGraphInternals.js` bypasses the legacy parser/filter pipeline for those rows.                 | Layer/loop construction and `storeLinksOnNodes` still run, so SLICE-001 remains relevant. Canonical view optimization must not generate new topology.                                                                                      |
| Search and facts                               | `canonicalVowlInspectionProjector.js` already indexes construct relationships and stores n-ary relation groups once; `ontologyInspector.js` expands requested relationships and applies current ranking.  | Reuse these indexes. Do not expand equivalence groups into quadratic pair lists or reimplement the already-completed preparation.                                                                                                          |
| Search identity                                | Shared controller and WebMCP contracts now include `roleKind` and `ELEMENT_AMBIGUOUS`; anonymous references use generation-scoped record tokens.                                                          | Same-IRI different-role results remain distinct; coarse references resolve only when unambiguous. Canonical serialization IDs are not stable external search handles.                                                                      |
| Query cost                                     | `canonicalWebVowlController.snapshots()` calls `session.inspectOntology()`, which clones the inspection including retained facts; the inspector prepares merged records and label indexes again.          | Measure and address clone plus query preparation in SLICE-007; a fast isolated index benchmark cannot hide whole-query copying cost.                                                                                                       |
| Editing/export                                 | Canonical editor commands, contextual occurrence bindings, prefix/display rules, facts dialogs and artifact services replaced the retired controller/editor/Turtle ownership.                             | Include datatype occurrence edits, merge/split choices, source restrictions, exact exports and failed replacement in regression/recovery evidence.                                                                                         |
| Existing performance repair                    | Refinement hash batches, bounded scratch allocation, checkpoint accounting, next-task result delivery, operator adjacency, indexed equivalence partitions and lexical namespace splitting already landed. | Reuse and test these techniques as the baseline. Existing indexes in one layer do not establish that every caller or scene operation avoids repeated scans.                                                                                |

The [candidate iteration amendment](../../plans/2026-10-04-canonical-vowl-candidate-iteration-amendment.md) permits experimental candidate evolution while deferring permanent profile/package publication.
The later [cutover report](../../reviews/canonical-vowl-production-cutover-and-retirement.md) records production composition, deployment observation and retirement, with 9,315 tests across 145 suites on its source candidate and a three-engine six-example browser matrix.
Those are historical reports, not checks rerun for this plan or proof of today's hosted state.
Its verified previous-build backup was not a performed live rollback; an old pre-canonical reader is not a safe recovery target for newly exported canonical-only files.

### Proposed dossier amendments and acceptance gates

The original dossier remains an intact 23 September draft.
At GATE-001, accept an explicit amendment or revise that dossier alongside this exact plan before capturing the implementation baseline.
The following table is the proposed delta; unchanged identifiers keep their original meaning.

| Original identifiers                         | Revised disposition for acceptance                                                                                                                                                                                                                                                                                                                                                          |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| REQ-001 / AC-001 / DEC-001                   | Retain ordered layer/loop/incidence equivalence and bounded passes, adding canonical drawing mount/revision coverage.                                                                                                                                                                                                                                                                       |
| REQ-002 / AC-002 / DEC-002                   | Amend the target to canonical runtime-reference and placement lookup during drawing synchronization. Preserve exact generation/token identity, ordered complete placements, camera/pin state, error precedence and atomic rejection. Original parser attribute/rerouting semantics remain historical; no current equivalent-property scan was found on the ordinary render-projection path. |
| REQ-003 / AC-003 / DEC-002                   | Amend to indexed prior-state lookup during canonical edit correspondence grouping. Preserve every conflict choice, surviving/retired token, placement and hidden state; keep canonical property/equivalence topology package-owned. Native equivalence grouping is baseline evidence, not a new deliverable.                                                                                |
| REQ-004 / AC-004 / DEC-003                   | Carry adjacency and visited-set reasoning into bounded canonical visibility/placement qualification. The existing two-pass visibility closure is retained unless a measured counterexample justifies a different traversal; the old solitary-subclass usefulness policy is not restored.                                                                                                    |
| REQ-005 / AC-005 / DEC-003                   | Retain the degree-preparation lesson for explicit canonical filters: revision-owned degree/index reuse must return identical ordered hidden occurrences and maximumDegree. The automatic 50-node selector, its fallback and any binary search remain a separate product decision because no current selector consumes them.                                                                 |
| REQ-006 / AC-006 / DEC-004                   | Revise reveal to traverse admitted canonical occurrences with a transient view overlay; distinguish node, edge and label counts and handle roles/expressions without drawable occurrences. GATE-003 must accept this revised contract.                                                                                                                                                      |
| REQ-007 / AC-007 / DEC-005–006               | Retain exact matching/ranking; update the oracle to canonical labels, role-aware identity and compressed n-ary groups. Include session cloning and first-query/index cost in acceptance.                                                                                                                                                                                                    |
| REQ-008 / AC-008                             | Bind all state to canonical session/scene ownership and revision. Presentation changes can invalidate labels without a document revision, so a revision-only cache key is insufficient.                                                                                                                                                                                                     |
| REQ-009 / AC-009 / DEC-007                   | Retain the measured shared-method pilot and expansion gate, with canonical bindings/drawing/edit/export as current consumers.                                                                                                                                                                                                                                                               |
| REQ-010 / AC-010 / DEC-008                   | Retain recovery-safe retirement of disposable state. Remove the former four-entry URL-cache assumption; the canonical implementation has no such cache owner.                                                                                                                                                                                                                               |
| REQ-011 / AC-011                             | Preserve UI/tool parity, 25-reference focus/request bounds and the 1,500-character WebMCP envelope; include exact `roleKind`, ambiguity and canonical facts.                                                                                                                                                                                                                                |
| REQ-012 / AC-012 / DEC-009                   | Retain measured/recoverable delivery; use current canonical candidate identity and a compatible recovery reader. Candidate approval is not stable publication.                                                                                                                                                                                                                              |
| QA-001–003                                   | Preserve zero unexplained semantic differences and current canonical interaction behavior. Require bounded lookup/closure counts, current filter combinations and token/recovery differentials. Original 50-node-policy acceptance remains historical; monotonicity is tested as a transferable property, not permission to restore automatic collapse.                                     |
| QA-004–009                                   | Retain bounds, responsiveness, lifecycle, memory, accessibility and recovery intent, updated to the active owners and measurement limits below. Proposed numerical targets still require GATE-002/003.                                                                                                                                                                                      |
| Proposed REQ-013 / AC-013 / QA-010 / DEC-010 | Reuse immutable canonical preparation on presentation-only changes only after measuring a material cost. Preserve complete scene/record/occurrence facts, view closure, exact labels, transaction semantics and ownership isolation; prove lower measured work without retained-memory or responsiveness regression. This is the conditional SLICE-011 extension.                           |

GATE-001 accepts this revised programme and route; GATE-002 calibrates fresh fixture/environment targets; GATE-003 accepts the revised reveal, caps and export policy; GATE-004 controls shared-method expansion; GATE-005 controls any actual retention/cache policy change; GATE-006 controls additional substring indexing/component selection.
No gate is marked satisfied by this plan.
REQ-013 and SLICE-011 require GATE-001 acceptance and GATE-002 evidence before implementation.
Current native APIs and installed package capabilities are the reuse baseline; any added component requires current REU-01/VER-01/LIC-01 research, exact rights and consumer evidence.

### Scope and ordering

The outcome remains faster usable ontology loading, exact semantic search, bounded hidden-result navigation and lower justified retained allocation.
There is no renderer rewrite, new canonical algorithm/profile, old-policy restoration, persistent search store, automatic resource-limit increase or AWS cache implementation in this programme.
The [materialization-cache plan](../../plans/validated-ontology-materialization-cache-implementation-plan.md) is a separate draft whose pre-existing revisions and supplied assessment were committed independently during this follow-up; it concerns source-byte acquisition and import context, not a local semantic-search index or a replacement for canonical admission.
Its presence is not evidence that a cache is implemented.

Recommended order: baseline/calibration and SLICE-004 applicability proof → SLICE-001/002 → SLICE-003 → SLICE-007 → SLICE-006 → SLICE-008 → SLICE-009 → SLICE-010.
Choose between SLICE-001 and SLICE-002 first using whole-operation traces; the isolated scene result below does not settle their end-to-end priority.
SLICE-005 follows evidence of repeated view queries, and SLICE-011 coordinates its immutable facts with scene/search preparation.
The slash denotes a prioritization decision, not parallel writes to coupled runtime/session code.
Retention diagnosis can begin during baseline collection and need not wait for all other slices.

| Slice     | Hard dependency                                                                     | Integration boundary                                                                                                                                    |
| --------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SLICE-001 | GATE-001/002; exact canonical occurrence/link oracle                                | Renderer link construction and both canonical/retained runtime paths.                                                                                   |
| SLICE-002 | GATE-001/002; exact scene/reference oracle                                          | One owner for scene indexes and the session drawing synchronization caller.                                                                             |
| SLICE-003 | Shared scene/index ownership with SLICE-002; current correspondence/conflict oracle | Integrate atomic edit publication and index retirement together; do not duplicate state ownership.                                                      |
| SLICE-004 | Admitted occurrence topology and current visibility semantics                       | Qualification can close with an evidenced already-efficient disposition; no rewrite is required.                                                        |
| SLICE-005 | Repeated-query evidence; immutable revision owner; GATE-001/002                     | One preparation owner with SLICE-007/011; count cold build and retained memory as well as warm queries.                                                 |
| SLICE-007 | Current inspector oracle and session ownership                                      | One owner for session/inspector contracts; integrate role-aware UI/WebMCP results together.                                                             |
| SLICE-006 | GATE-003; canonical identity/scene base; qualify against any integrated SLICE-007   | One owner for controller, scene, runtime and action contracts. It can ship independently of search indexing if its oracle and measurements stand alone. |
| SLICE-008 | Current canonical allocation baseline                                               | Isolated link-constructor pilot with real drawing consumers.                                                                                            |
| SLICE-009 | Qualified SLICE-008 plus GATE-004                                                   | Coherent inheritance/callback cohorts; no incompatible intermediate chain.                                                                              |
| SLICE-010 | Actual retention inventory; GATE-005 only for behavior changes                      | Session/checkpoint/source/renderer/index owners and the integrated workload.                                                                            |
| SLICE-011 | Proposed REQ-013 acceptance and measured hotspot                                    | Serialize shared session/projection writes with SLICE-006/007; no duplicate preparation cache.                                                          |

Independent fixture/research work is a dependency observation, not delegation authority.
Benchmark runs remain serial and quiescent under ADR 0003; no concurrent build, test suite, bulk inventory or second benchmark.

## Delivery slices

### SLICE-001 — Load and refresh an identical graph with indexed link construction

**Links:** REQ-001, REQ-008, REQ-012; AC-001, AC-008, AC-012; QA-001, QA-002, QA-006; DEC-001, DEC-009.
**Deliverable:** a complete canonical load/view-refresh path with identical admitted drawing/link metadata and lower renderer preparation work.

**Predicted files:** modify `src/webvowl/js/parsing/linkCreator.js` and `src/webvowl/js/runtime/renderedGraphInternals.js`; consider a renderer-local `src/webvowl/js/parsing/incidentLinkIndex.js` if extraction makes the shared incidence operation directly testable.
Add proposed `linkCreator.test.js` and `incidentLinkIndex.test.js` alongside their subjects and proposed `util/benchmark-rendered-graph-preparation.mjs`; reuse `util/benchmarkEnvironment.mjs` and existing fixture-generation conventions.
Existing link tests, `src/webvowl/js/parsing/canonicalRenderElements.test.js`, canonical render-projection tests and runtime seam/revision tests are the production regressions.
The retained legacy parser tests cover the shared runtime fallback only; they are not the production admission oracle.

- [ ] Record baseline phase timings/work counts and hand-enumerated graph descriptions before replacing the algorithm.
      Record canonical initial mount and drawing/view revision separately; canonical refresh still reaches `refreshLinksAndLabels`, while the legacy fallback additionally uses `filterFunction`.
- [ ] Keep current native Set membership by property ID and inverse assignment.
      Group links by unordered endpoint-object pairs with nested maps or an equivalent collision-free identity structure.
      Preserve link order and one shared ordered `layers()` array per group; assign `layerIndex()` in that order.
- [ ] Group true self-loops using the existing endpoint-reference predicate and assign `loops()`/`loopIndex()` by iteration position.
      Preserve undefined loop metadata on non-loops.
      Do not introduce a per-loop `findIndex`, numeric `layers`, concatenated-ID key or ID-based endpoint merge.
- [ ] Initialize adjacency only for the supplied node objects, walk links once and append in input order.
      Append a self-loop once, replace old arrays on refresh, and do not mutate endpoints outside the supplied node collection.
      Keep both callers correct through the owning incidence operation; measure canonical `refreshLinksAndLabels` and retain fallback regression coverage for `filterFunction`.
- [ ] Verify empty/disconnected graphs, every link sharing a pair, all loops on one node, reversed endpoints, inverse pairs, duplicate IDs on distinct objects, IDs containing delimiters, repeated IRIs, mixed link kinds and repeated load/refresh.

**Oracle/proof:** normalize object identity by fixture occurrence ordinal, not IRI; compare metadata and array-sharing assertions as well as serialized values.
Check the underlying endpoint predicate directly: `PlainLink.isLoop()` uses `equals`, whereas current metadata grouping uses reference equality; do not conflate them.
Expected work is a bounded number of node/link passes plus group annotation, with O(V + E) auxiliary references under ordinary Map behavior.
Deterministic work counts are the complexity gate; paired browser/Node timings substantiate benefit rather than replacing semantic tests.

**Release/recovery:** release independently after its full relevant checks and browser load/refresh/export smoke.
No canonical schema/byte change is intended; recovery requires the previous qualified canonical-capable artifact and preserved edits.
Discard temporary maps after preparation; do not retain duplicate global indexes merely because construction was centralized.

### SLICE-002 — Synchronize canonical drawing state with indexed references and placements

**Links:** proposed amendment to REQ/AC-002 and DEC-002; REQ/AC-008, 012; QA-001, 002, 006, 009.
**Transferred lesson:** resolve repeated exact-key lookups once per owning lifetime, and avoid work whose result no current caller needs.
The legacy parser attribute and eager equal-property patches are retired targets; their techniques remain in scope.

**Current path:** `canonicalVowlDocumentSession.updateView` synchronizes the runtime drawing, and `synchronizeDrawing` calls `canonicalVowlScene.arrange` with all placements.
For each placement, `resolve` currently materializes and searches the whole token registry, and `arrange` searches the placement array again.
These are active canonical operations, including work performed around view changes and capture/edit flows.
The render and inspection projectors already have record/label indexes; do not add redundant equivalents of those indexes.

- [ ] Introduce an exact inverse runtime-token index at the scene owner and a placement index for the candidate arrangement, or justify a cheaper measured alternative.
      Preserve the generation check, token identity, ordering, duplicate-change validation, nonpositionable rejection, pin/camera state and atomic failure behavior.
- [ ] Build/rebuild/retire indexes at scene creation and accepted correspondence replacement; a rejected or stale proposal must not publish its indexes.
      Include construction cost, single-placement edits, empty arrangements and additional retained entries in the comparison.
- [ ] Compare actual scene operations and whole `updateView`/drawing-capture paths on the six examples and accepted scale fixtures.
      The external prototype below demonstrates potential, not completed production integration.

**Oracle/proof:** exact snapshots and error/reference outcomes, failed publication and token-replacement races; counted visits/copies plus cold/warm paired timings and retained-heap observations.
**Release/recovery:** scene-local indexes only, with current successful/failed synchronization behavior preserved; GATE-001/002 and current session/runtime regressions govern implementation.

### SLICE-003 — Reconcile canonical edits with indexed prior scene state

**Links:** proposed amendment to REQ/AC-003 and DEC-002; REQ/AC-008, 012; QA-001, 002, 006, 009.
**Transferred lesson:** group by exact current identity and maintain efficient access to the state being regrouped, rather than repeatedly scanning the entire population.

`packages/vowl/src/projection.js` already uses connected-component maps, endpoint-keyed partitions and `partitionByRole`; the tested equivalent-property families do not need a second merger.
The remaining target is `canonicalVowlScene.prepareEdit`: each correspondence currently searches all previous placements and performs array membership over hidden state before grouping by current occurrence.
This work occurs after the worker result returns, so worker isolation does not eliminate it.

- [ ] Reuse or create an operation-owned placement map and hidden-membership set before grouping correspondence; share ownership with SLICE-002 without coupling their state transitions accidentally.
- [ ] Retain the exact previous/current correspondence, conflict ordering, selected merge placement, hidden policy, minimum surviving token, deleted-token expiry and new-token allocation.
      A preview, cancelled reconciliation or failed `beforeCommit` must not change accepted state.
- [ ] Preserve the package's normalized topology, default endpoint/error precedence and exact canonical bytes; do not transplant the old dynamic endpoint-merger policy into admission.
- [ ] Retain native grouping probes for overlapping equivalence groups, differing endpoint partitions, inverse/contextual occurrences, punning and output-sensitive expansion.
      Work proportional to required output is different from avoidable repeated lookup; the bounded probes below do not prove all admission is linear.

**Oracle/proof:** current scene/edit/session oracles plus merge/split/delete/create/unchanged correspondence, nonempty hidden sets, independent choices and failure races; compare full post-worker reconciliation and memory costs.
**Release/recovery:** independently demonstrable edit round trip with identical references and recoverable state; no new canonicalizer or semantic merger is introduced.

### SLICE-004 — Qualify canonical adjacency and visibility traversal

**Links:** proposed amendment to REQ/AC-004 and DEC-003; QA-001–003, QA-006.
**Transferred lesson:** build adjacency once, memoize visited work and avoid recursive rescans, while keeping the current traversal's meaning.

`closeVowlVisibility` already uses membership sets and two occurrence passes; `initializePlacements` already indexes operator targets and memoizes positions with cycle detection.
The chain probe below corroborates bounded visibility work at three sizes.
Its evidence supports retaining that algorithm, rather than closing the question solely because `subclassFilter.js` is bypassed.

- [ ] Qualify chains, diamonds/shared targets, high-fanout operators, cycles rejected at admission, disconnected nodes, inverse edges, contextual datatypes and labels against admitted topology.
      Check hidden closure, complete placements, ordering and boundary errors, including deep supported inputs.
- [ ] Measure aggregate invocation count as well as work per invocation; repeated linear closure/preparation may still dominate a complete interaction.
      Assign avoidable repeated preparation to SLICE-005/011, with one owner for shared facts.
- [ ] Retain the current algorithm when the full supported-family evidence confirms bounded work and no material traversal hotspot.
      Open a targeted optimization only for a measured residual; restoring recursive solitary-subclass usefulness remains a separate product decision.

**Oracle/proof:** deterministic visit bounds and semantic closure fixtures, plus complete view/load measurements where traversal is material.
**Disposition:** already-efficient implementation observed for the tested mechanism; qualification remains explicit, and no production rewrite is presently justified.

### SLICE-005 — Reuse canonical degree preparation for repeated explicit filtering

**Links:** proposed amendment to REQ/AC-005 and DEC-003; REQ/AC-008, 012; QA-002, 003, 006, 007.
**Transferred lesson:** separate stable graph statistics from changing filter selections, and prove any monotonicity assumption before using it.

`prepareCanonicalVisibility` rebuilds record/occurrence/construct indexes and degree counts on each call, even for unchanged admitted topology.
The external prototype separates those facts from query selection and compares complete hidden arrays and maximum degree.
It improves repeated queries in the reported families, while cold build-plus-query is slightly slower; that tradeoff is part of acceptance.

- [ ] Reuse immutable facts at the accepted load/document revision owner, invalidate on every topology/role change and release on replacement; require an explicit ownership contract rather than an unguarded object-identity cache.
- [ ] Preserve datatype-excluding edge counts, unique self-loop incidence, `ends` versus directional endpoints, all five filter controls, retained hidden occurrences, ordered closure, maximum degree and explicit zero values.
- [ ] Compare cold build, one query, rapid repeated filters, many small documents, an overlapping edit and abandoned loads.
      Account for retained maps and their overlap with SLICE-007/011; publish only if whole-operation benefit exceeds build, invalidation and memory costs.
- [ ] Retain the threshold monotonicity probes as evidence about the current predicate, with fixed topology/filter/retained-hidden inputs.
      They do not authorize a 50-node selector, establish Legacy's tidy/fallback policy, or create a consumer for binary search.
      Any future adaptive display budget needs a separate accepted product requirement and independent predicate proof.

**Oracle/proof:** current filter oracles and differential complete arrays, including threshold ties, all-hidden results, empty/disconnected graphs, self-loops and context-sensitive occurrences; cold/warm timings and edit invalidation evidence.
**Release/recovery:** conditional revision-owned preparation, coordinated with SLICE-011; retain direct computation if reuse is not worthwhile on the accepted workload.

### SLICE-006 — Reveal and clear a bounded canonical neighbourhood

**Links:** amended REQ-006, REQ-008, REQ-011, REQ-012 / AC-006, AC-008, AC-011, AC-012 / QA-004, QA-006, QA-008, QA-009 / DEC-004, DEC-009.
**Deliverable:** a reader or agent reveals a hidden representable entity's complete bounded depth-two neighbourhood, then restores the ordinary view without losing edits or saved scene state.
GATE-003 must accept the amended semantics and caps before implementation.

**Predicted seams:** proposed `src/app/js/controller/canonicalSearchProjection.js` and tests; current `canonicalWebVowlController.js`, `canonicalVowlDocumentSession.js`, `canonicalVowlScene.js`, `canonicalVowlInspectionProjector.js`, `canonicalVowlRenderProjection.js`, shared controller/runtime contracts, `searchMenu.js`, WebMCP contracts/adapter and their actual colocated tests.
Extend the supported runtime drawing transaction only where necessary; do not recreate the retired controller or document abstraction.

- [ ] Resolve exact semantic references through the current role-aware contract and session record tokens.
      A class/expression seeds all its admitted drawable node occurrences; a property seeds every admitted edge occurrence carrying that role, both endpoints and the associated labels.
      Same-IRI roles, inverse directions, equivalent groups and repeated datatype occurrences remain distinct where the canonical contract distinguishes them.
- [ ] Build one adjacency index over the full admitted occurrence inventory for the current revision, with traversal in both directions.
      Compute depth two and the induced eligible edge set; include required label/endpoint dependencies without manufacturing missing topology.
      Detail-only roles/qualifications are inspectable facts and receive an explicit no-drawable-neighbourhood result.
- [ ] Propose caps of 25 requested semantic references, 500 node occurrences, 1,000 edge occurrences, 2,000 label occurrences and 10,000 inspected adjacency entries.
      Count seeding, repeated groups, dependency expansion and final induced-edge work; bound or account for index construction separately.
      These revised units and the label cap require GATE-003 acceptance; the old term "property occurrence" is not interchangeable with a canonical edge containing multiple properties.
      Exceeding any cap refuses before publishing state; do not silently truncate a neighbourhood.
- [ ] Represent the temporary selection as session/controller-owned presentation state over the complete admitted document and ordinary scene.
      Retain full scene placements, canonical IDs, runtime occurrence tokens, hidden closure and recovery checkpoint.
      Do not canonicalize a subset, remove source/qualification facts, or make the renderer the semantic store.
- [ ] Prepare the entire candidate view and use the current synchronous commit/rollback boundary to publish it.
      Guard supersession, document revision, cancellation and disposal before effects; no awaited yield inside the publication transaction.
- [ ] Enable a hidden result only when its full grouped selection is revealable within the accepted policy.
      Preserve exact references, text-node/mark rendering, accessible names, keyboard movement, focus restoration and status announcements.
      UI and WebMCP use the same controller operation and explicit completion/refusal result.

| Event                                                              | Required amended behavior                                                                                                                                                                                                                                                                              |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Reveal another result                                              | Replace the temporary view; retain the original ordinary restoration state, without stacking snapshots.                                                                                                                                                                                                |
| Clear                                                              | Restore ordinary visibility, placement/pin/camera state through supported scene/runtime operations; preserve the accepted document. Identical coordinates after resumed simulation are not promised.                                                                                                   |
| Ordinary filter, prefix, language, display, layout or edit request | Successfully clear the transient view first, then execute the current canonical operation. Prefix/display changes matter even without a semantic revision.                                                                                                                                             |
| Global Reset                                                       | Clear the transient state, then apply the current controller reset contract and its tests; do not reinstate the retired filter policy.                                                                                                                                                                 |
| Load, semantic revision or disposal                                | Retire transient state and indexes; a failed replacement restores the last accepted scene and selected occurrence context. No cross-generation reference reuse.                                                                                                                                        |
| Abort or failed drawing publication                                | Preserve/restore the accepted ordinary view and report the error; a stale completion cannot resurrect a retired view.                                                                                                                                                                                  |
| Drawing export                                                     | SVG/LaTeX represents the currently displayed view, subject to existing format capabilities.                                                                                                                                                                                                            |
| Canonical or semantic export                                       | Proposed policy: export the complete accepted document with ordinary persistent scene state; omit the temporary reveal overlay. Preserve compatible qualifications and exact retained source assertions, and retain existing export restrictions. GATE-003 must accept this canonical-artifact policy. |
| Share                                                              | Preserve existing revision/source restrictions; do not serialize the transient view as ordinary filters or an implicit new URL format.                                                                                                                                                                 |

**Oracle/proof:** independently enumerate node/edge/label identities on chains, cycles, hubs, disconnected components, punning, inverse/equivalent groups, contextual datatypes and detail-only facts.
Test below/equal/above every cap, stale references, malformed roles, render failure, edit conflicts and a replacing load that fails.
Verify UI/tool parity and export → reopen on the production build in supported browsers; existing focus-only tests do not prove hidden reveal.
**Release/recovery:** ship controller/session/runtime/UI/tool contracts together; retire transient state on clear/revision/disposal and retain a qualified canonical-capable recovery artifact.

### SLICE-007 — Reuse canonical semantic search preparation

**Links:** amended REQ-007, REQ-008, REQ-011 / AC-007, AC-008, AC-011 / QA-005, QA-006, QA-008 / DEC-005, DEC-006.
**Deliverable:** repeated complete searches avoid redundant snapshot copying and preparation while returning the current ordered semantic answer.

**Predicted seams:** current `ontologyInspector.js`, `canonicalVowlDocumentSession.js`, `canonicalVowlInspectionProjector.js`, `canonicalWebVowlController.js`, `vowlDisplayProjector.js`, `ontologySearchPager.js` and their tests; proposed session-owned `ontologySearchIndex.js` only if a coherent reusable seam is justified; proposed `util/benchmark-ontology-search.mjs` using the existing environment guard.

- [ ] Freeze a canonical oracle for all searchable kinds and roles, punned IRIs, anonymous expressions, equivalent n-ary groups, labels in multiple languages, exact/prefix/infix/IRI matches, no matches, whitespace, short strings and Unicode.
      Keep `query.trim().toLowerCase()`, the current five ranks, kind ordering and identity tie-breaking; compare complete ordered results, including equal-rank role distinctions.
      Local IDs do not become new searchable text.
- [ ] Measure the full call through controller `snapshots()` and `session.inspectOntology()`, including its retained-facts clone, inspector record merge, normalization, group matching, sorting and final serialization.
      Establish build/first-query cost and allocations separately from warmed queries.
- [ ] Prepare immutable semantic search data once per accepted session revision at the owning boundary.
      Reuse the existing construct indexes and single-copy `relationGroups`; preserve equivalent-label semantics without materializing all pairwise relationships.
      A cache keyed only by the identity of the freshly cloned inspection is ineffective.
- [ ] Keep mutable state private and prevent consumers from changing cached semantic records.
      Return bounded owned result values; do not expose a live mutable document to avoid a clone.
      Revision/generation invalidation retires semantic preparation; prefix, language and label-selection changes refresh presentation data, and focusability is derived from current visible facts.
      Separate these lifetimes rather than making one stale global dictionary.
- [ ] Preserve UI grouping of all matching references by display label before six displayed groups, and preserve hidden-match reporting.
      Keep WebMCP's current request/result bounds, exact `roleKind`, total counts, offsets, eight continuation records and stale generation/revision/language checks.
      Broad queries remain output-sensitive; do not retain corpus-sized arrays for each continuation or silently drop identities to fit an envelope.
- [ ] Benchmark end-to-end query latency and retained heap on both admitted canonical documents and isolated synthetic inspector records.
      A 100k-record inspector fixture is not proof that a corresponding full canonical document loads/captures within default limits.

**Oracle/proof:** current canonical inspector results plus independent hand-enumerated ranking/ambiguity cases, randomized differential queries and visibility/language/prefix/edit races.
Account for relation-group visits, all snapshot copies, first query and result size.
The proposal first indexes preparation; it does not promise constant-time substring matching or select a trie, fuzzy search or Unicode normalization.
GATE-006 requires current native/reused-component research and owner selection before adding another candidate index.
**Release/recovery:** no persistent index format; drop retired references and rebuild from the admitted session.
Integrate new reveal fields only if SLICE-006 is present, without making index delivery depend on it.

### SLICE-008 — Qualify shared methods through a link-constructor pilot

**Links:** REQ-009, REQ-012; AC-009, AC-012; QA-001, QA-007; DEC-007.
**Deliverable:** one complete link creation/drawing/update/export path uses shared behavior with demonstrated allocation savings.

**Predicted files:** `src/webvowl/js/elements/links/PlainLink.js`, its direct `ArrowLink.js`/`BoxArrowLink.js` consumers only as required, proposed `PlainLink.test.js`, existing link tests and proposed `util/benchmark-rendered-occurrence-memory.mjs`.
Include canonical occurrence bindings, projected inverse directions and scene drawing/export in the real pilot path.
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
Add focused contract tests beside each changed family; extend canonical session/scene/editor/drawing-export and actual runtime tests.
Renderer objects remain drawing occurrences; canonical semantic records, contextual datatype identities and source facts stay in their current owners.

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

### SLICE-010 — Retire disposable canonical state while preserving recovery

**Links:** amended REQ-008, REQ-010, REQ-012 / AC-008, AC-010, AC-012 / QA-006, QA-007, QA-009 / DEC-008.
**Deliverable:** repeated load/query/reveal/edit/export/dispose cycles retain only explicitly owned live state.

**Predicted seams:** `canonicalVowlDocumentSession.js`, `canonicalVowlWorkerClient.js`, `canonicalVowlWorkerOperations.js`, `canonicalVowlSourceAcquisition.js`, inspection/render projectors, search/reveal indexes and current runtime teardown, each with its existing tests.
No four-entry URL cache exists in this canonical ownership path; the retained `hasReusedCachedVisualization` compatibility field is not evidence of a cache implementation.

- [ ] Inventory acquired root/import bytes, retained source statements, accepted inspection/checkpoint, previous-document recovery, per-job request copies, worker results, scene projections, exported bytes/blobs, renderer bindings/listeners and proposed indexes.
      Include `retainedFacts` and render-projection inspection clones in actual heap paths.
- [ ] Reconcile the copy/ownership proof with SLICE-007 and SLICE-011 before introducing another retained index.
      Remove demonstrably redundant retired references at completion, supersession, replacement, clear and disposal; never drop the only recoverable edited document or its exact source evidence.
- [ ] Verify terminal worker results cannot start later import acquisition; abort/deadline/disposal terminate the job and detach owned listeners.
      Preserve copied accepted checkpoints when transferable request buffers are detached.
- [ ] Test failed replacement, aborted editing/capture/export, URL reload, view changes during pending edits, selected occurrence restoration, merge/split conflict choices and exact canonical/source export.
      A retention optimization cannot relax compatible-profile restrictions or falsely claim source equivalence.
- [ ] Measure ten repeated cycles at equal admitted/live graph sizes and document expected live occupancy separately from retired generations.
      Record a no-change result where no removable retention is found.

**Oracle/proof:** deterministic ownership/recovery assertions plus actual browser allocation/retainer analysis; no fixed-time garbage-collection assertion.
GATE-005 applies if a measured case requires a new cache admission/eviction policy or different recovery lifetime.
The separate AWS materialization plan and any persistent browser store remain outside scope.
**Release/recovery:** transient cleanup needs no data backfill; preserve a compatible reader and recovery checkpoints, and test the affected export/reload route before release.

### SLICE-011 — Conditionally reuse canonical preparation for ordinary view changes

**Proposed links:** REQ-013 / AC-013 / QA-010 / DEC-010; REQ-008, REQ-012 / AC-008, AC-012 / QA-006, QA-007, QA-009.
**Deliverable:** a measured slow filter/language/prefix/display path performs less repeated canonical preparation while producing exactly the current scene, inspection and drawing.
This extension requires GATE-001/002 acceptance; if profiling finds no material cost, retain the existing implementation and record that disposition.

**Predicted seams:** `canonicalVowlDocumentSession.updateView`, canonical inspection/render projectors, `canonicalVowlViewControls.js`, `canonicalVowlScene.js`, `vowlDisplayProjector.js` and their current tests.

- [ ] Separate time and allocations for visibility/degree calculation, semantic projection, label/principal selection, full inspection copies, renderer materialization and synchronous publication.
      Existing operator adjacency, label/construct indexing and refinement batching are baseline behavior, while SLICE-002/003 address measured scene lookup costs and SLICE-005 owns the degree/index preparation hypothesis.
- [ ] Reuse only revision-stable facts at their current owner, and invalidate display-dependent values for prefix/label-selection/display changes.
      Keep the current explicit degree policy, datatype-excluding edge counts, occurrence direction/identity and hidden closure.
      Do not substitute the legacy solitary-subclass or automatic-collapse algorithms.
- [ ] Compare the entire admitted inspection, scene, drawing rows, tokens and persistent exports against the current implementation, including an edit completing after a view change.
      Preserve the session's stable document identity and synchronous before-commit/rollback behavior.
- [ ] Demonstrate that any saved work exceeds index build, extra retained memory and invalidation cost on the accepted workload.
      Share preparation with SLICE-005/007 where ownership and lifetime match, and account for SLICE-002/003 scene indexes; do not create competing caches or claim the same saved work twice.

**Oracle/proof:** complete differential canonical projection/scene fixtures, cold/warm view timings, allocations and transactional failure races.
**Release/recovery:** independently qualify the complete view-change path; no schema, budget, profile, source mapping or stored-byte change is intended.
Any such change requires re-baselining and separate compatibility evidence.

## Traceability and catalogue disposition

| Slice     | Requirement / acceptance / quality / decision                                  | Proof and release implication                                                                                                 |
| --------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| SLICE-001 | REQ/AC-001, 008, 012; QA-001, 002, 006; DEC-001, 009                           | Ordered canonical link/incidence equivalence, sharing and bounded work; renderer-local indexes retired after preparation.     |
| SLICE-002 | Proposed amendment REQ/AC-002; REQ/AC-008, 012; QA-001, 002, 006, 009; DEC-002 | Exact drawing synchronization with fewer reference/placement scans; indexes follow atomic scene/token replacement.            |
| SLICE-003 | Proposed amendment REQ/AC-003; REQ/AC-008, 012; QA-001, 002, 006, 009; DEC-002 | Identical edit correspondence/conflict/token outcomes with indexed previous state; retain already-indexed canonical grouping. |
| SLICE-004 | Proposed amendment REQ/AC-004; QA-001–003, 006; DEC-003                        | Bounded current visibility/placement traversal or a measured residual; the tested linear closure supports retaining it.       |
| SLICE-005 | Proposed amendment REQ/AC-005; REQ/AC-008, 012; QA-002, 003, 006, 007; DEC-003 | Exact explicit filtering with evidence for cold/warm preparation reuse and invalidation; no automatic policy restoration.     |
| SLICE-006 | REQ/AC-006, 008, 011, 012; QA-004, 006, 008, 009; DEC-004, 009                 | Exact bounded canonical neighbourhood, atomic refusal, UI/tool/export parity and compatible recovery.                         |
| SLICE-007 | REQ/AC-007, 008, 011; QA-005, 006, 008; DEC-005, 006                           | Complete current query oracle and clone/build/query/heap evidence; transient revision-owned preparation.                      |
| SLICE-008 | REQ/AC-009, 012; QA-001, 007; DEC-007                                          | Real canonical link behavior, shared identity and allocation benefit; GATE-004 controls expansion.                            |
| SLICE-009 | REQ/AC-009, 008, 012; QA-001, 006, 007; DEC-007                                | Per-family state/receiver/interaction/export equivalence and heap evidence; coherent consumer migration.                      |
| SLICE-010 | REQ/AC-008, 010, 012; QA-006, 007, 009; DEC-008                                | Retainer paths and failed-load/edit/source recovery; actual policy changes require GATE-005.                                  |
| SLICE-011 | Proposed REQ/AC-013; QA-010; DEC-010, plus lifecycle/release requirements      | Identical canonical view transactions with measured work savings and bounded retention, or an evidenced no-change result.     |

Every catalogue idea has a disposition: layers/loops/incidence remain SLICE-001; ID-based native Set property membership already exists; repeated attribute/reference lookup transfers to SLICE-002; grouping and state-membership lessons transfer to SLICE-003; adjacency/traversal is explicitly qualified in SLICE-004; degree preparation transfers to SLICE-005 while automatic selection remains a product-policy question.
Hidden navigation/search are revised SLICE-006/007; shared behavior remains SLICE-008/009; retention becomes canonical SLICE-010.
The old rerouted-property guard has no identified equivalent lookup on ordinary canonical rendering; its general avoid-unused-work lesson remains part of SLICE-002/011 profiling, rather than an unsupported speedup claim.
SLICE-011 addresses a newly observed canonical preparation seam conditionally.
Historical paper results and Legacy output do not replace current canonical conformance.

## Canonical transposition experiments

The earlier plan established that old call sites were bypassed but did not test whether their optimization mechanisms recurred in Canonical VOWL.
This follow-up separates obsolete code targets, already-adopted techniques, measured adaptation opportunities and unaccepted behavior changes.
First-principles elimination of repeated work comes first; measured current practice, the linked platform/canonical contracts, and historical technique reuse constrain the resulting proposals in that order.

The reproducible external experiment (`../../../../../.hi/w/e/operator-reports/performance-search-canonical-transposition-20261005/experiment.mjs`, local evidence path) imports the current repository functions and writes isolated source-derived prototypes outside the checkout.
Raw results (`../../../../../.hi/w/e/operator-reports/performance-search-canonical-transposition-20261005/results.json`, local evidence path) retain source/lock/input hashes, Node/host identity, all seven alternating-order paired samples, two warmups, counted work and unavailable timings.
No production module, dependency, configuration, fixture oracle or canonical byte artifact was changed by the experiment.

| Original lesson                                                      | Current mechanism tested or traced                                                              | Evidence and disposition                                                                                                                                      |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Group parallel links/loops and attach incidence once                 | Shared renderer link creation remains reachable from canonical drawing refresh.                 | Preserve SLICE-001; its production differential/measurement work is still required, not performed by the scene prototype.                                     |
| Replace repeated membership/attribute lookup with exact-key indexes  | Canonical scene token resolution, arrangement placement lookup and correspondence state lookup. | Positive bounded experiment; retarget SLICE-002/003. Existing property Set and semantic/label indexes remain baseline.                                        |
| Group equivalents and maintain endpoint/state access during mutation | Package connected components and endpoint partitions; scene edit grouping.                      | Native grouping visits each tested equivalent member once; optimize measured scene lookups rather than add another semantic merger.                           |
| Adjacency and visited-state traversal                                | Visibility closure and indexed operator placement.                                              | Closure counters grow linearly in the tested chain family; retain it and finish SLICE-004's broader qualification.                                            |
| Cache degree work and prove threshold monotonicity                   | Current explicit-degree predicate and revision-stable graph facts.                              | Positive warm-query result, small cold-query overhead and bounded monotonicity checks; conditional SLICE-005. Automatic 50-node search has no current caller. |
| Indexed search and bounded hidden-neighbour traversal                | Role-aware inspector/session and admitted occurrences.                                          | SLICE-006/007 remain proposed; include clone/preparation costs and exact matching/occurrence oracles. No new search/BFS timing was taken here.                |
| Shared methods and disposable state                                  | Canonical renderer allocations and session/worker/checkpoint ownership.                         | SLICE-008–010 remain measured pilots; these experiments do not establish heap savings or justify discarding recovery state.                                   |

### Positive and negative observations

The scene fixtures were admitted through `openOwl`; the six shipped examples were admitted through `decode` and `openCanonical` before use.
Twenty scene-operation comparisons and eight error/token/conflict/rollback outcome comparisons matched the current implementation.
The visibility prototype matched **7,680** full hidden-array/maximum-degree comparisons, covering 32 filter combinations, retained-hidden variants and selected threshold boundaries across 20 fixtures; the corresponding hidden-set monotonicity checks also passed.
These are bounded differential results, not an exhaustive proof over every admitted ontology.

| Operation / fixture                               | Current median | Prototype median | Scope of observation                                                                     |
| ------------------------------------------------- | -------------: | ---------------: | ---------------------------------------------------------------------------------------- |
| Arrange 250 class occurrences                     |       2.207 ms |         0.265 ms | Complete arrangement phase; scene creation outside timing.                               |
| Arrange 1,000 class occurrences                   |      24.436 ms |         0.857 ms | Complete arrangement phase; reverse-index construction at scene creation outside timing. |
| Reconcile unchanged edit, 1,000 class occurrences |      10.752 ms |         7.953 ms | Prepare, preview and commit; includes index work inside that reconciliation.             |
| GoodRelations: 20 repeated visibility queries     |       9.910 ms |         3.620 ms | Warm queries over reused facts; excludes initial preparation.                            |
| GoodRelations: cold preparation plus one query    |       0.714 ms |         0.721 ms | Includes prototype index/degree build; a small measured overhead.                        |
| 512-class chain: 20 repeated visibility queries   |      26.312 ms |        12.748 ms | Warm query batch.                                                                        |
| 512-class chain: cold preparation plus one query  |       1.629 ms |         1.662 ms | Includes prototype preparation; not a universal win.                                     |

At 2,000 isolated class occurrences, one current arrangement copied **4,000,000** registry entries and performed **2,001,000** reference tests plus **2,001,000** placement tests.
The identity edit performed **2,001,000** placement tests.
Those deterministic counts corroborate repeated-scan growth even where host contention prevented timing.
The prototype replaces those scans with owner-bound inverse lookup and operation-local indexes, at the cost of additional retained/transient entries; retained-heap qualification remains outstanding.

For 32/128/512 equivalent properties, both equal-endpoint and two-endpoint-partition families used exactly 32/128/512 member visits and partition visits and produced the expected one/two property edges.
This supports retaining the existing grouping strategy for those families; it does not bound canonicalization, component-root work, semantic key construction or required dense output in general.
Visibility closure over 94/382/1,534 chain occurrences performed 503/2,039/8,183 observed record-property reads, consistent with its existing bounded passes.

The first timing attempt stopped at the unchanged repository quiescence guard (13.1% host busy); its diagnostic output is retained and its incomplete timings are not reported.
The complete rerun recorded timing as unavailable, without retry, for 500/2,000-occurrence arrangement, 2,000-occurrence edit and both FOAF timing groups when that guard rejected the group.
Counters and semantic comparisons remain available for those cases.
No result here is browser INP, a whole-interaction speedup, a peak/retained-memory measurement, an independently reviewed R2 result or a release-gate pass.
This task ran benchmarks serially without launching concurrent tests, builds or scans; the concurrent documentation activity prevents claiming exclusive control over other sessions or the host.
Passing a short quiescence sample does not establish uninterrupted exclusivity, so the timings remain exploratory, corroborated by deterministic scaling counts.
Cold scene creation, single-placement operations, full controller publication, real-browser traces, edit invalidation and retained memory must qualify any implementation.

The current scene, view-control, document-session, render-projection and package-projection suites also passed: **53 tests across five suites**.
Those are baseline regression checks; they do not install or qualify the external prototypes as product code.

## Evidence, workloads and verification

Retain exact source HEAD/tree and dirty-input hashes, package/lockfile identities, fixture hashes, browser/runtime versions, commands, outputs, raw measurements and limitations under the configured external evidence root.
The implementation owner proposes the change; an independent reviewer checks the semantic oracle and benefit at the R2 review point.
Mock only genuine network, scheduling, worker transport and renderer-port boundaries in unit tests; package projection, admission and canonical expected bytes require real implementations and independent fixtures.

The corpus is now logical, not a list of physical loose files.
Use `readCorpusArtifact` from `packages/vowl/conformance/storage.mjs`, its manifests and [storage contract](../../../packages/vowl/conformance/STORAGE.md).
The consolidation preserved 7,227 original byte artifacts in 64 bundles; absence of a loose path is not a missing logical case.
Do not generate new golden bytes from the candidate, discard historical failing resource cases or overwrite producer evidence to obtain a pass.

### Workload and resource baseline

Measure acquisition/import wait, worker startup and input copy, admission/mapping/refinement, worker transfer/result delivery, scene/inspection/render projection, link/incidence preparation, first usable draw, query/view interaction, capture/export and recovery separately.
Measure the complete user operation as well as each optimized phase.
Keep serialized fixtures small enough to be admitted under existing limits, and label larger isolated synthetic tests explicitly.

Current defaults in `packages/vowl/src/resourceBudget.js` are 32 MiB input, 100,000 primary records, 1,500,000 embedded values, depth 128, 1 MiB per string, 16 MiB total strings, 1,000,000 RDF quads, 100,000 deep iterations and 10,000 ms per operation.
The existing RDFC bound is `min(B * B, rdfDeepIterations)`; all charge units, upper overrides, deadlines and fail-closed behavior remain constraints.
Increasing these defaults, skipping charges or caching an unchecked document is not a performance optimization under this plan.

The [canonical qualification report](../../reviews/canonical-vowl-slice006-qualification.md) includes initial failures and later approved repairs.
Its final 24-run matrix uses the approved embedded-work default; do not report the initial connected-2,000 rejection or disconnected-WebKit deadline as the final outcome.
The final connected/disconnected 2,000-class fixtures meet that report's accepted host-specific objectives: load plus capture below ten seconds, heartbeat gaps below 100 ms and sampled private browser memory below 2 GiB in Chromium, Firefox and WebKit.
Connected times were 6.170/7.775/8.565 seconds and disconnected times 2.784/3.593/4.470 seconds respectively.
These are single sampled runs per fixture/engine, not percentiles, exact heap peaks, INP, a universal 2,000-class capacity or Safari certification.

Use those two exact fixtures as retained regression cases, together with all six shipped examples, named historical migration, compatible/partial/detail-only inputs, punned roles, anonymous/high-symmetry graphs, long strings, deep rejection, dense parallel/loop shapes and interrupted operations.
The earlier paper's ENVO and memory figures remain historical; large real-input qualification still needs exact rights/provenance and admitted current artifacts.

GATE-002 must accept fresh paired measurements and targets for each selected optimization.
Retain the dossier's proposed 25% targeted median improvement, small-corpus regression tolerance of the larger of 10% or 25 ms, warmed search p95 at most 100 ms on an agreed isolated 100k-record fixture, and 20% per-occurrence retained-allocation pilot benefit only as calibration proposals.
They are not measured achievements or default-admission promises.
Deterministic visit/copy counts establish eliminated work; repeated paired timing and allocation evidence establish benefit.
GC timing, a timer sampler during synchronous work and a single heartbeat run cannot establish a peak-memory or percentile claim.

Local diagnostics retain bounded aggregate durations, counts, generation/revision and sanitized error codes, without ontology/query contents or remote telemetry.
Clear collected User Timing entries after use.
Optional performance APIs require feature detection and browser trace alternatives.
Any future yielding happens during preparatory work with cancellation/staleness checks, never halfway through synchronous publication.

### Current verification commands

Commands below are planned implementation checks, not results of this documentation revision.
Use installed tools; do not refresh locks or install runtimes implicitly.
Proposed test files become runnable only after their slice creates them.

| Scope                        | Current check / evidence                                                                                                                                                                                                                                                                                                                                                                                     |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Identity and environment     | `git status --short --branch`, `git rev-parse HEAD`, `node --version`, `npm --version`, `npm ls --depth=0`; bind dirty inputs and exact lock identity.                                                                                                                                                                                                                                                       |
| Canonical package and corpus | `npm run test:vowl`; `node packages/vowl/scripts/verify-corpus-storage.mjs`; add `--against-git` for changes affecting storage/provenance and retain its checkpoint requirement.                                                                                                                                                                                                                             |
| Load/view/recovery           | `npm test -- --runInBand --runTestsByPath src/app/js/controller/canonicalVowlDocumentSession.test.js src/app/js/controller/canonicalWebVowlController.test.js src/app/js/controller/canonicalVowlWorker.test.js src/app/js/controller/canonicalVowlSourceAcquisition.test.js src/app/js/controller/canonicalVowlScene.test.js src/app/js/controller/canonicalVowlViewControls.test.js`.                      |
| Semantic/search/display      | `npm test -- --runInBand --runTestsByPath src/app/js/controller/ontologyInspector.test.js src/app/js/controller/canonicalVowlInspectionProjector.test.js src/app/js/controller/canonicalVowlRenderProjection.test.js src/app/js/controller/vowlDisplayProjector.test.js src/app/js/controller/webVowlControllerContracts.test.js src/app/js/menu/searchMenu.test.js`.                                        |
| Renderer                     | `npm test -- --runInBand --runTestsByPath src/webvowl/js/parsing/canonicalRenderElements.test.js src/webvowl/js/runtime/d3RenderedGraphAdapter.test.js src/webvowl/js/runtime/renderedGraphSeamConformance.test.js src/webvowl/js/runtime/renderedGraphEditing.test.js src/webvowl/js/elements/links/ArrowLink.test.js src/webvowl/js/elements/links/BoxArrowLink.test.js`; add the new SLICE-001/008 tests. |
| UI and agent parity          | Existing `webMcpToolContracts.test.js`, `webMcpAdapter.test.js`, `webMcpSearchPagination.test.js`, `webMcpDetailConsistency.test.js`, sidebar/input/export and canonical editor/drawing-export suites, selected with `--runTestsByPath`. Verify roles, ambiguity, result envelopes and actual completion.                                                                                                    |
| Architecture                 | `npm test -- --runInBand --runTestsByPath src/renderedGraphDecoupling.architecture.test.js src/productionModuleFormat.architecture.test.js src/productionGraph.architecture.test.js src/owlapiConsumerBoundary.architecture.test.js src/testRunnerScope.architecture.test.js src/app/js/webmcp/webMcpArchitecture.test.js`.                                                                                  |
| Frozen candidate             | `npm test -- --runInBand`, `npm run lint`, `npm run format:check`, applicable `npm run test:setup` and `npm run test:prose`, then `npm run build` and `node util/verify-webvowl-lazy-parser-chunks.mjs`. Rebuild after tests that replace build output.                                                                                                                                                      |
| Production browser           | Serve the exact normal production artifact with `npm run preview`; qualify actual canonical load/view/search/edit/export/reopen, cancellation, clear/reset, keyboard/touch and failure recovery. The isolated `canonical` mode is additional evidence, not a substitute for production composition.                                                                                                          |
| Performance/memory           | Accepted slice benchmarks under `util/benchmarkEnvironment.mjs` discipline, production browser traces/allocation tools and the retained canonical resource cases; keep timing windows quiescent.                                                                                                                                                                                                             |
| Security and recovery        | Route-selected review of untrusted input, role/reference validation, resource limits, worker races, DOM text and exported/source facts; separately authorized hosted smoke and compatible-artifact recovery. Ordinary lint/tests do not establish those outcomes.                                                                                                                                            |

HISEW profiles were reinspected: `focused` runs `npm run lint`, `affected` runs `npm run test`, and `full` runs `npm run build`, each with a declared 600-second timeout.
Coverage/input ordering is declared unknown, not verified by the engine.
R2 still requires its governed full profile plus the relevant product evidence; a build receipt does not establish the complete tests, browser matrix, performance or recovery.

The repository now selects proportional CI checks for documentation-only changes through `util/selectCiChecks.mjs` and `util/checkDocumentation.mjs`, while preserving required application/CodeQL gates and full checks for non-documentation inputs.
This does not change local HISEW profile declarations.
The pre-existing dirty `skills-lock.json` is a non-documentation input; never claim the complete workspace would select documentation-only CI or stage it with this plan.
For this documentation task, check the edited file's formatting, links, commands, ledger coverage and diff, then run the registered focused profile and report unrelated failures accurately.

## Compatibility, observation, release and replanning

Canonical semantic records, source qualifiers, named historical ingress, role-aware references and current scene/export contracts are the compatibility baseline.
All proposed indexes are transient; no database backfill or persistent-search migration is planned.
Interruption resumes from the last qualified slice after checking actual checkout state and retained evidence; process memory is not a durable checkpoint.

Search input stays literal text, with current query/ref/result validators and resource checks.
No regular-expression query evaluation, label HTML, full-IRI truncation or stale-token reuse is permitted.
Native security assessment, independent semantic/performance review and actual keyboard/assistive-technology observations remain implementation obligations where the accepted route requires them.
Existing browser accessibility probes do not certify all WCAG interactions.

Maksy owns acceptance and release; the assigned implementation owner observes the first authorized release until another named observer accepts handoff.
Qualify each independently releasable slice with exact source/build identity, preserve the previous compatible canonical artifact and rehearse failed publication/recovery with an edited document.
Experimental candidate identification and compatibility disclosure continue under the 4 October amendment; immutable profile/package publication is a separate deferred decision.
Existing notices, source rights and distribution limitations remain attached to the six examples and any newly selected benchmark source.

Abort on unexplained canonical bytes/facts/occurrence differences, stale state, lost edits or source evidence, changed resource admission, unresolved material review findings or corroborated workload regressions.
Prefer containment/forward repair when an older artifact cannot read the affected files.
Do not claim live restoration from an unexercised backup or treat previous deployment authorization as current permission.

| Unknown                                  | Cheapest discriminating experiment                                                                                        | Decision owner / consequence                                                                                                                |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Current dominant load/interaction cost   | Phase profile one shipped example and the exact connected/disconnected 2,000-class cases, then bounded topology variants. | Implementer/Maksy: rank current transposed targets by complete-operation evidence; obsolete entry points alone do not decide applicability. |
| Search clone versus matching cost        | Compare complete controller query with inspector-only timing and counted clone/preparation work.                          | Implementer/reviewer: choose one session-owned preparation seam for SLICE-007/011.                                                          |
| Reveal representation and caps           | Hand-enumerate canonical occurrence/label dependencies for a punned entity, inverse edge, contextual datatype and hub.    | Maksy/semantic reviewer: accept GATE-003 units and export policy before implementation.                                                     |
| View-preparation reuse value             | Compare repeated prefix/language/filter/display changes at equal revision, including an overlapping edit.                 | Maksy/reviewer: accept SLICE-011 only with material evidence and a safe lifetime.                                                           |
| Shared-method benefit                    | Pilot actual canonical link cohorts and inspect allocation/retainer paths.                                                | Maksy/memory reviewer: GATE-004 decides expansion.                                                                                          |
| Retired state versus legitimate recovery | Failed replacement/edit/capture followed by heap-owner inspection and successful recovery/export.                         | Recovery reviewer: preserve necessary snapshots; GATE-005 governs behavioral retention changes.                                             |
| Representative larger documents          | Pin rights-reviewed source bytes, closure context, topology and canonical workload; retain rejection outcomes.            | Maksy: no paper-scale capacity claim without admitted current evidence.                                                                     |

Replan when canonical contracts/identities change, the adjacent cache changes acquisition context, new configuration/dependencies are needed, current hotspots disappear, index memory outweighs saved work, caps reject intended tasks, export compatibility changes, or worker/cancellation/recovery ownership must change.
Refresh the inventory if HEAD, refs, input documents or pre-existing working-tree hashes change before acceptance.
New semantics, budget increases, persistent state, additional supported dialects or a renderer rewrite require explicit re-baselining.
Planning completion means a consistent reviewable proposal and auditable reconciliation; implementation and release acceptance require their own evidence.

## Exhaustive repository change reconciliation

The original audit through `0fbf00ef51f65f1235f4d3b24cc1706cd2a5ade8` enumerates the complete retained ref/reflog history before applying the inclusive cutoff to both author and committer timestamps.
It does not rely on a first-parent log, a net diff alone or path-limited searches.
Every selected commit is compared with every parent using raw full blob identities, modes and rename old/new paths; first-parent binary patches are retained.
The pre-cutoff mainline tip, current refs, remote head observations, net diff, initial index/worktree status, all nonignored untracked inputs and their hashes are retained.

Original audit coverage: **26 commits** (23 reachable from current refs, all also ancestors of HEAD; three reflog-only pre-squash originals), **18,676 parent-relative change records**, **9,240 distinct historical paths**, and **three additional pre-existing working-tree paths**.
That original baseline-to-HEAD net diff is 2,010 records: 1,923 additions, 49 modifications, 35 deletions and three renames.
Seven original merge commits have exactly their second parent's tree, so none introduces an unaccounted merge resolution.
The three reflog originals have the same trees as their corresponding squash commits; they are recorded separately without claiming extra landed functionality.

The complete machine ledger (`../../../../../.hi/w/e/operator-reports/performance-search-plan-20261005/repository-change-ledger.json`, local evidence path), path-by-path accounting (`../../../../../.hi/w/e/operator-reports/performance-search-plan-20261005/path-accounting.md`, local evidence path) and reproduction script (`../../../../../.hi/w/e/operator-reports/performance-search-plan-20261005/inventory.mjs`, local evidence path) are retained in the configured external evidence store.
Machine-ledger SHA-256: `faf05a721791ea1760faa65a4a184402205298beea9caf42aacf36a9db066957`.
Every historical path maps to exactly one group below and to every commit/parent event that touched it; the detailed accounting lists exact paths, including all bundled-away members.
The evidence links are local to this host; preserve or transfer that evidence directory with a cross-host handoff.

“Exhaustive” here covers the repository history recoverable from every local ref and reflog and every current nonignored working change at the recorded observation.
Remote heads were checked without changing refs; the origin/upstream heads corresponding to local remote-tracking refs agree.
Ignored build/dependency caches, pruned objects and unavailable historical remote refs cannot establish source changes and are not claimed as audited history.
Uncommitted edits lack reliable change timestamps, so all three were included conservatively.
No changed source/configuration/test/evidence path in that universe is omitted as merely unrelated.

### Follow-up documentation commits

The transposition baseline adds three recovered commits after that immutable audit: `74227959e6ca88ea604b4d8b48fbb02fe10f2f60` updates this plan, `c65770dab849279cf44da822a4501dcc34365efa` merges it with an identical second-parent tree, and `5f5a5e955f3ac5ac6f3bceaf3201a79708759938` independently commits the cache plan and supplied research assessment.
The last commit makes two initially dirty inputs clean without changing their recorded bytes; the research assessment becomes one additional historical tracked path in G16, while the cache-plan path already belongs to G17.
There are no production, configuration, test or corpus changes between the original audit and the experiment baseline.
The follow-up ledger (`../../../../../.hi/w/e/operator-reports/performance-search-canonical-transposition-20261005/follow-up-ledger.json`, local evidence path) retains every parent-relative comparison and exact ref/input identities.
Together the audit and supplement account for 29 commits and 18,680 parent-relative change records over 9,241 distinct historical paths, plus the original three working-tree inputs whose bytes remain unchanged.
At this observation only `skills-lock.json` remains uncommitted among those initial inputs; no concurrent work was restored, restaged or reverted by this task.
The working correction in this document is separately reviewable and is not an implementation change.

### Commit dispositions

| Commit                  | Parent change records | Disposition                                                                                                                                          |
| ----------------------- | --------------------: | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `02464992126a` (reflog) |                     3 | Original plan/dossier/catalogue draft; reflog copy of the subsequent squash.                                                                         |
| `c6d3b8713018`          |                     3 | Publishes the initial performance/search baseline and source catalogue.                                                                              |
| `1d4df48515e9` (reflog) |                    16 | Proportional CI implementation; reflog copy of the subsequent squash.                                                                                |
| `3de1040c6069`          |                    16 | Adds CI/documentation selection, protected CodeQL verdict and tooling/tests.                                                                         |
| `af9c601fae08` (reflog) |                     1 | CI documentation diagram; reflog copy of the subsequent squash.                                                                                      |
| `4c7211e5a08f`          |                     1 | Documents proportional check selection and its boundaries.                                                                                           |
| `8b84cb21530c`          |                     1 | Introduces canonical profiles/conformance design; replaces prior future-architecture assumptions.                                                    |
| `354ed3af8c1e`          |                 1 / 0 | Integration of 8b84cb21530c; merge tree equals that parent, with no additional resolution change.                                                    |
| `d5f0d2ac2ac9`          |                     5 | Adds canonical core/projection contracts, decisions and research synthesis.                                                                          |
| `1c64045bf572`          |                 5 / 0 | Integration of d5f0d2ac2ac9; merge tree equals that parent, with no additional resolution change.                                                    |
| `244ca05bf904`          |                     1 | Adds the canonical implementation programme and acceptance sequencing.                                                                               |
| `4f1970e5b6c9`          |                 1 / 0 | Integration of 244ca05bf904; merge tree equals that parent, with no additional resolution change.                                                    |
| `4cac26e920cb`          |                 8,957 | Adds canonical core/OWL/migration, corpus, package/tooling and contract amendments; new semantic authority.                                          |
| `3c06af70f364`          |                 7,346 | Consolidates 7,227 loose artifacts into 64 bundles with byte-preserving inventory and consumer changes.                                              |
| `13e33a137a24`          |                    11 | Derives format selection from public owlapi metadata; removes duplicated format admission assumptions.                                               |
| `d77183ffa4c4`          |                    70 | Adds compatible artifact/source preservation, source/editor foundations and canonical acquisition/session seams.                                     |
| `ef4926b2de06`          |                    94 | Integrates canonical workers, scene, drawing, inspection, role-aware tools, editing/export and qualification UI.                                     |
| `62fc931c28a1`          |                     3 | Bounds lexical namespace splitting and retains regression/evidence; preserve as baseline repair.                                                     |
| `1d91eb30ba12`          |             1,921 / 0 | Integration of 62fc931c28a1; merge tree equals that parent, with no additional resolution change.                                                    |
| `2bba8c5511e9`          |                    10 | Qualifies bounded workloads; improves refinement/checkpoint/task/scene work and accepts embedded-work amendment.                                     |
| `9e69b1c75bf5`          |                    90 | Switches production to canonical, regenerates examples/notices, repairs editing/recovery/accessibility, retires obsolete owners and records cutover. |
| `4aa7cb2d5c7e`          |               100 / 0 | Integration of 9e69b1c75bf5; merge tree equals that parent, with no additional resolution change.                                                    |
| `d291c38e7026`          |                     8 | Updates dependency/security/tooling inputs and formatter edge cases; changes comparison environment.                                                 |
| `56a9913adec2`          |                 8 / 0 | Integration of d291c38e7026; merge tree equals that parent, with no additional resolution change.                                                    |
| `17a235d65982`          |                     2 | Updates html-validate manifest/lock to 11.16.1; validation environment change.                                                                       |
| `0fbf00ef51f6`          |                 2 / 0 | Integration of 17a235d65982; merge tree equals that parent, with no additional resolution change.                                                    |

### Complete path-group dispositions

The table preserves the original audit's counts through `0fbf00ef51f65f1235f4d3b24cc1706cd2a5ade8`: distinct historical paths, including retired paths, with working-tree additions counted separately.
The follow-up ledger above accounts for the later G16/G17 documentation publication without rewriting that immutable inventory.
G08 has no historical changes: the old shared filters were inspected because unchanged files can become inapplicable when callers change.

| Group                              | Historical paths / present at HEAD | Changes and plan disposition                                                                                                                                                                                                                                                                                                                                                                                              |
| ---------------------------------- | ---------------------------------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G01-conformance                    |                      8,951 / 1,724 | Logical fixtures, independent producers, manifests, supplemental protocol/editing/resource/migration/compatible cases, storage reader and provenance. Preserve all expected bytes and logical cases via the corpus reader; 7,227 loose artifacts were consolidated into 64 bundles. Retain historical counterevidence; no corpus case is treated as removed coverage. Links: All active slices: semantic/resource oracle. |
| G02-canonical-core                 |                            37 / 37 | 37 core, OWL, migration, live-model/editing, snapshot, source and resource modules. Current semantic/byte authority; preserve mapping/profile/source facts and charges. Existing batching/accounting repairs are baseline; no replacement mapper planned. Links: 001, 006–011: boundary/regression.                                                                                                                       |
| G03-canonical-tests                |                            40 / 40 | Package unit, corpus, resource and real-browser harness files. Use current conformance, compatible/source/editing and worker/recovery oracles; observed historical results are not reruns. Links: All active slices: proof.                                                                                                                                                                                               |
| G04-canonical-tools                |                              5 / 5 | Browser probes/vectors, schema generation, notices and corpus-storage verification. Reuse supported verification entry points; do not regenerate goldens or overwrite rights evidence. Links: Evidence/release.                                                                                                                                                                                                           |
| G05-package-contracts              |                              9 / 9 | Workspace manifest, schemas, licence and third-party notices, README. Existing experimental workspace/dependency boundary; exact schema/config changes need approval; preserve source rights and candidate qualification. Links: Compatibility and REU/VER/LIC gates.                                                                                                                                                     |
| G06-application-controller         |                            58 / 47 | Canonical sessions/controllers/acquisition/worker/scene/view/search/editor/export modules and tests; retired old owners and relocated resolver. Use exact current owners and role-aware contracts; retire old call-site assumptions while testing transferred lookup/grouping/adjacency/degree lessons; include clone cost and recovery. Links: 001–007, 010, 011; current transposition evidence above.                  |
| G07-renderer                       |                              8 / 6 | Canonical element materialization, adapter/internals/editing tests; removed Turtle serializer. Keep renderer a projection; link/incidence work survives. Preserve transactional revisions, occurrence context and export ownership. Links: 001, 006, 008–011.                                                                                                                                                             |
| G09-webmcp                         |                              3 / 3 | Tool schemas/tests and architecture ownership test. Preserve roleKind validation, ELEMENT_AMBIGUOUS, existing envelope/pagination and parity. Links: 006, 007.                                                                                                                                                                                                                                                            |
| G10-menus                          |                              1 / 1 | Export menu format/capability behavior. Preserve canonical artifact/semantic export capability and menu state in reveal and memory tests. Links: 006, 008–010.                                                                                                                                                                                                                                                            |
| G11-examples-and-notices           |                              3 / 3 | Experimental candidate identifier and example/source notices. Retain exact candidate, attribution and distribution limitations; no new rights inference. Links: Fixtures/release.                                                                                                                                                                                                                                         |
| G12-retired-converter              |                             28 / 4 | Old converter/constants/builder package/tests, moved import resolver, retained historical helper/catalog/differential files. Do not recreate removed production owners or run deleted tests; retain named historical migration/comparison evidence. Links: 002–003 retargeted to current scene/reference/grouping mechanisms; retired converter patches remain inapplicable.                                              |
| G13-composition-and-ui             |                            19 / 19 | Canonical composition, input/loading/sidebar/dialogs/export adapter, CSS and in-memory test adapter. Preserve source/format choices, editing confirmations/reconciliation, facts and accessible UI flows on the production composition. Links: 006–011 integration/browser proof.                                                                                                                                         |
| G14-architecture-and-entry         |                            14 / 14 | Production/isolated entrypoints, six canonical examples, HTML and five architecture tests. Benchmark production canonical path; preserve corpus, accessible toolbar names, package boundary, discovery and lazy parser/worker build coverage. Links: Baseline/all active slices.                                                                                                                                          |
| G15-canonical-specifications       |                            11 / 11 | Core/design/projection plus camera, editing, protocol, resource, compatible-view, embedded-work and compatible-artifact contracts. These supersede old ownership/identity/budget assumptions; candidate release sequencing is amended separately. Links: Dossier amendments and all semantic gates.                                                                                                                       |
| G16-review-and-qualification       |                            24 / 24 | 24 tracked review/qualification/rights/compatibility/release records, plus the pre-existing untracked cache assessment. Read reports by candidate and chronology, including failed then repaired probes; cache assessment is a separate draft input. Links: Evidence, workload, rights, recovery and adjacent scope.                                                                                                      |
| G17-adjacent-plans                 |                              3 / 3 | Canonical programme, compatibility repair and candidate-iteration plans; pre-existing modified cache plan. Canonical cutover is present, stable publication deferred; source-materialization cache remains proposed and separately owned. Links: Ordering/authority/compatibility.                                                                                                                                        |
| G18-original-planning              |                              3 / 3 | Original dossier, plan and catalogue publication. Keep provenance and stable IDs; apply this explicit draft amendment without pretending original R2 acceptance. Links: Entire plan reconciliation.                                                                                                                                                                                                                       |
| G19-ci-documentation               |                              1 / 1 | Proportional CI explanation/diagram. Docs-only selection is conditional; it does not change HISEW profiles or justify skipping product proof. Links: Verification guidance.                                                                                                                                                                                                                                               |
| G20-ci-policy-and-tests            |                              4 / 4 | Three workflows and security-workflow tests. Account for selection, fail-closed required gates, CodeQL blocking verdict and action update; preserve current pipeline with no configuration edits. Links: Verification/approval boundary.                                                                                                                                                                                  |
| G21-tooling                        |                            13 / 12 | CI/doc tool selection/checks/tests, example regeneration, formatter fixes and retired converter benchmark. Use current commands and logical corpus; avoid deleted benchmark paths and preserve Markdown literal semantics. Links: Current verification/benchmark plan.                                                                                                                                                    |
| G22-configuration-and-dependencies |                              5 / 5 | Root manifest/lock, Python requirements/lock and Vite configuration; pre-existing skills-lock edits. Freeze updated dependency/tool identities for comparisons; current canonical mode and configured outDir are baseline. No upgrade/configuration change is proposed. Links: Environment/authority/check selection.                                                                                                     |

The dependency-entry ledger (`../../../../../.hi/w/e/operator-reports/performance-search-plan-20261005/dependency-entry-ledger.json`, local evidence path) retains every changed transitive and platform package record alongside the complete patches.
Material changes include the npm owlapi alias and vowl workspace; URI/canonicalization/admission dependencies; Vite 8.3.2, dependency-cruiser 18.5.0, Prettier 3.9.9, html-validate 11.16.1, Ruff 0.16.10, Snapper 0.11.7; and CodeQL action 4.38.2.
These are repository declarations/lock observations, not claims that this task installed or proved latest/safe versions.
Vite now has an isolated canonical output/entry mode and preserves mtimes using the resolved output directory; the normal production entry also uses canonical composition.
The formatter handles quoted numbering/list boundaries without changing literal content.

### Pre-existing working-tree inputs

| Input                                                                                                                           | Initial SHA-256                                                    | Disposition                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/plans/validated-ontology-materialization-cache-implementation-plan.md` (modified)                                         | `eb23e3528b31e540557d50eb95f42a0323590a9aaed32e5dbcd36ae883ac91df` | Revised cache draft targets canonical acquisition and public owlapi, exact bytes/context, bounded managed imports and separate AWS deployment gates; coordinate future acquisition/memory work without implementing it here. |
| `docs/reviews/Validated Ontology Materialisation Cache_ deep-research assessment and recommended plan revisions.md` (untracked) | `6e3197eddb494fd06942c5eb3b7005bec7a8c5bb546adfb0e087f7f1eb5c7b1a` | Untracked deep-research cache assessment; contextual proposal, not implemented cache behavior or source authority over canonical contracts.                                                                                  |
| `skills-lock.json` (modified)                                                                                                   | `8e34791088ef5c603f06d55dd231ad779fd82d4d9781f5db696998d209a6d215` | Removes brainstorming, committing-to-git and writing-plans entries; user-owned configuration preserved, no product runtime change. It prevents a docs-only claim about the whole dirty workspace.                            |

All three inputs are preserved byte-for-byte by this task.
The update itself changes only this implementation plan; its original bytes and original dossier hashes are retained with the audit.
A changed hash or new ref/input invalidates this reconciliation snapshot and requires a bounded refresh before implementation acceptance.
