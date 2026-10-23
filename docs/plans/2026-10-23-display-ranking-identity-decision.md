# Cheaper keys for display ordering

| Field          | Value                                                                                                                                                                                        |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Decision       | PERF-DEC-015, bounded experiment with conditional adoption approved on 23 October 2026                                                                                                       |
| Date / owner   | 23 October 2026 / Maksym Shostak                                                                                                                                                             |
| Authority      | PERF-DEC-014: “A plus a separate design for cheaper display-ranking identity”                                                                                                                |
| Problem        | An ordinary source load computes full structural canonical identity before it can choose and show nodes.                                                                                     |
| Recommendation | Qualify ordering keys derived from a smaller display graph, using existing canonicalization machinery. Preserve semantic handles and artifact identity.                                      |
| Related work   | [Whole-load profile and exact-semantics optimizations](2026-10-23-whole-load-profile-and-optimization-proposal.md); [OWLAPI read improvements](2026-10-23-owlapi-read-path-opportunities.md) |

## Decision requested

The owner approved the recommended bounded experiment with conditional adoption on 23 October 2026.
Implement the experiment and integrate a separate display-key operation only if its correctness and performance gates pass.
Its keys would be derived from the complete display graph and named semantic anchors, rather than from every structural record in the document.
This changes deterministic tie-breaking: the initial automatic selection, component order and later count prefixes can differ where structural priorities tie.
It can also make display ordering insensitive to annotations or other source details that do not affect the drawing.
That behavior change requires approval beyond Option A's exact-identity envelope.

The experiment must retain source-order invariance of the encoded display graph, connected growth, component fairness and count-prefix monotonicity.
It must preserve public semantic identity, saved-view references, renderer join identity and canonical export bytes.
If bounded anonymous/symmetric cases cannot meet those conditions, return for a revised design instead of silently falling back to unstable source-order keys.

## Why another identity boundary is justified

The original W6 browser trace attributed 6.27 seconds to ranking preparation, but only about 9 ms to choosing the complete node order.
Most work creates canonical structural IDs used as tie-break keys.
The source's 953 counted display nodes lead to a 209,716-quad identity mapping with 46,162 blank nodes and seven refinement rounds.
Refinement produces 298,453 SHA-256 requests and about 319 MiB of digest input before the remaining canonicalization work.
Those costs overlap; they must not be summed as independent intervals.

Option A keeps these inputs and IDs exact.
Its private-query and allocation improvements cannot remove the basic cost of canonicalizing that larger representation.
The initial source comparison still spends about five seconds in ranking on Node; Node uses a different crypto backend and is not a browser latency oracle.

The application currently uses the returned correspondence only to give each visual occurrence a stable ordering key.
`canonicalNodeOrdering.js` then prioritizes selected neighbors, distinct neighbors and incident edges, followed by a lexical tie-break.
It distributes selection among components using the existing square-root fairness rule.
Count, camera and placement are already excluded from ordering inputs.

## Options

| Option                                          | Benefit                                                                                            | Cost or loss                                                                                       | Disposition                            |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | -------------------------------------- |
| Keep full structural identity                   | Exact existing ties; no new identity rule.                                                         | Retains work over unrelated structural detail on every admitted revision.                          | Baseline and current shipped behavior. |
| Canonical keys from a bounded display graph     | Much smaller candidate input; one explicit display-ordering purpose; reuse of existing algorithms. | Ties can change; smaller input needs independent equivalence and adversarial proof.                | Recommended experiment.                |
| Named IRI plus local handle for anonymous cases | Very cheap common path.                                                                            | Local handles can depend on source enumeration, undermining reload/source-order stability.         | Not recommended.                       |
| New approximate hashing or a new crypto backend | Potential additional throughput.                                                                   | Collision policy, symmetry rules, new maintenance and possibly dependency/configuration decisions. | Outside this design.                   |

No speedup is promised before the smaller mapping is measured.
Using a smaller representation is a hypothesis about work avoided, not a reason to relax canonicalization limits.

## Proposed rule and ownership

The worker would derive a purpose-specific representation from the already validated full occurrence projection and its semantic anchors.
The proposed mapping includes:

| Input                           | Representation rule                                                                                                                                                    |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Class/datatype node occurrences | One distinct occurrence vertex, its kind, and its named role/IRI anchors where present.                                                                                |
| Class equivalence groups        | Preserve the full group of named anchors with typed membership.                                                                                                        |
| Contextual datatype occurrences | Preserve their property/context connections; a shared datatype IRI alone does not identify every displayed occurrence.                                                 |
| Edges and hyperedges            | Preserve kind, directed endpoint roles and named property anchors; encode repeated contextual occurrences distinctly.                                                  |
| Anonymous display structure     | Encode the topology and typed incidence present in the complete drawing. Never include an input blank label, local handle or enumeration ordinal as a semantic anchor. |
| Excluded inputs                 | Camera, layout coordinates, count choice, temporary pause state, localized labels, cosmetic appearance and source annotations absent from the display structure.       |

The implementation must publish the exact finite mapping table and independent fixtures before replacing the existing operation.
The table may not expand opportunistically to the entire source graph: if an omitted distinction is necessary for the approved display contract, revise the design and measure the cost explicitly.

### B1 finite experiment mapping

The experiment returns keys only for counted class/datatype node occurrences, the actual consumers of the ordering operation.
Every node and edge occurrence has a distinct temporary RDF vertex; label occurrences have no ordering vertex because they are derived from their edge and direction and are never ranked.
Renderer and saved-view handles for all occurrences, including labels, remain unchanged.

| Display input                     | Exact experiment encoding                                                                                                                                                          |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Every class/datatype node or edge | One blank vertex and its exact occurrence kind. Local handles identify vertices only inside the input mapping; they are never ground values or ordering keys.                      |
| Named role anchor                 | A typed literal containing the ordered pair of role kind and complete subject IRI. Punned roles remain distinct; no localized label is used.                                       |
| Anonymous role anchor             | A separate blank role vertex, its role kind and a link to the shared anonymous subject vertex. This retains shared subject identity without leaking blank labels.                  |
| Operator target anchor            | A separate blank anchor with the operator expression kind. Operator incidence comes from the admitted display edges; unrendered operands are outside the display-order purpose.    |
| Class-node group                  | Unordered target-anchor links, including every named member of an equivalence group.                                                                                               |
| Node context                      | Explicit context kind; unordered class-target or property-anchor links. A restriction scope links to its actual displayed restriction edge.                                        |
| Property/inverse edge             | Directed from/to links; unordered properties or separately typed forward/reverse anchor links.                                                                                     |
| Subclass edge                     | Directed from/to links and the exact subclass-edge kind.                                                                                                                           |
| Restriction edge                  | Directed from/to links, property anchor, exact restriction kind and cardinality spelling. Source construct identity is represented by the edge's occurrence and scoped-node links. |
| Disjoint edge                     | Unordered endpoint links, retaining self incidence and a separate vertex for every displayed pair. Distinct parallel occurrences are not collapsed.                                |
| Operator edge                     | Directed from/to links and the operator kind.                                                                                                                                      |

No ontology annotations, assertions absent from the display graph, source serialization, label choices, camera, coordinates, count, visibility or rendering style enter this mapping.
Independent expected-graph fixtures must distinguish punning, direction, group membership, inverse orientation, scoped cardinality, shared anonymous subjects and repeated parallel edges before adoption.

Reuse the existing refinement and installed `rdf-canonize` implementation on this smaller representation, including canonical-ID mapping and resource controls.
The [W3C RDF Dataset Canonicalization specification](https://www.w3.org/TR/rdf-canon/) supplies the canonicalization algorithm; its [security considerations](https://www.w3.org/TR/rdf-canon/#security-considerations) make complexity controls part of the design.
This proposal does not introduce a new hash function, reduction in rounds or cryptographic backend.

The package would own a distinct read operation, provisionally `readModelDisplayOrderKeys`, with a versioned display purpose and revision-bound occurrence-to-key results.
That name and result schema remain implementation design details for the approved experiment, not a new public API commitment here.
Keep `readModelRankingIdentity` available while the exact-identity baseline is needed; remove obsolete application use after successful migration rather than running both computations on every production load.

The document session would validate revision/currentness exactly as it does now and pass only the display keys to the existing selector.
The selector keeps its graph priorities and fairness logic; version its policy to identify changed tie-breaking.
Renderer joins continue to use occurrence handles, not display keys.
This distinction is consistent with D3's documented [data-join key role](https://d3js.org/d3-selection/joining): join identity determines which elements are retained, a separate concern from ordering a selection.

## Stability, symmetry and user-visible consequences

Named anchors and distinct display topology should keep keys independent of source syntax, triple order and blank-node spellings.
The complete graph is encoded before filters or node-count selection, so increasing a count extends one ordering rather than recomputing identity for each prefix.
Filtering reuses revision keys but may recompute the existing eligibility-dependent order.
Structural edits invalidate the revision's derived display keys; camera, pause/resume and presentation edits do not.

Two anonymous occurrences that are indistinguishable under the encoded graph may lie in the same symmetry orbit.
Canonicalization can produce a deterministic canonical graph without giving one physically distinguishable meaning to each interchangeable input occurrence.
Do not promise exact cross-load anonymous occurrence correspondence where the representation contains no distinguishing information.
Tests must compare canonical display structure and selection up to the allowed equivalence, while requiring exact named-anchor results and unique keys within one admitted revision.
The current larger representation can distinguish some cases using details this proposal omits; losing those distinctions is part of the explicit changed tie-break contract.

Possible visible changes are which equally ranked nodes appear first at the automatic limit, which tied component begins first, and how such ties change after an edit.
Semantic inspection, selected entity identity, reveal targets, saved explicit views, exports and current-document renderer reuse must remain correct.
Human controls and agent/WebMCP operations must use the same selector and policy version.

## Resource, lifetime and failure rules

- Construct the smaller mapping with existing pre-allocation accounting, bounded work and cancellation checks; check again after asynchronous work and before publication.
- Retain at most the derived key set for the current structural revision under the existing model/session owner.
  Release it on replacement, reset, recovery retirement or disposal.
- Keep maximum canonicalization/search work and worker termination behavior.
  No process-wide graph cache or hidden expansion of resource limits is selected.
- Do not hide a slow whole-model fallback behind the small-graph fast path.
  If admissible workloads expose a correctness or complexity gap, stop adoption and report it with the baseline retained.
- Canonical file/export identity and its failure semantics remain the existing package operation.
  Display keys must never be accepted as artifact identity or as a substitute for model validation.

## Bounded slices and acceptance

| Slice | Deliverable                                                                     | Required proof                                                                                                                                                          |
| ----- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1    | Exact display mapping and purpose/version contract; isolated source experiment. | Independent expected graphs, named/contextual/anonymous cases; no private workload contents in shared evidence.                                                         |
| B2    | Smaller-key implementation using existing canonicalization.                     | Shuffled syntax/triples and renamed blanks; symmetric and hostile graphs; unique revision keys; cancellation, budgets and lifetime; unchanged canonical artifact bytes. |
| B3    | Session and selector migration behind the accepted contract.                    | Exhaustive existing ranking/prefix/fairness tests, filters, edits, hidden/revealed nodes, saved views, currentness/recovery and human/agent parity.                     |
| B4    | Consolidated qualification.                                                     | Full tests first, all findings resolved, optimized production manifest, then foreground workloads. The owner waived AGY and extra HISEW bookkeeping runs on 23 October. |

Proposed performance gate: **display-key preparation p95 at most 250 ms on W6**, measured in the worker with at least twenty admitted samples after source diagnostics and uninstrumented headless proof.
This is a proposed target, not an observed result.
The accepted whole-load target remains p95 at most five seconds for both automatic and all-node W6 views, including existing startup, preparation, publication and usable-frame costs.
Record W5 real core and W4 stress behavior to expose regressions; W4 remains a stress case rather than the primary product workload.
If source preparation outside ranking still misses the total target, report that residual separately rather than crediting this design with unmeasured savings.

Required correctness fixtures include named entities, punned roles, equivalent class groups, contextual datatypes, disconnected components, anonymous restrictions, symmetric cycles, repeated parallel/contextual edges, hidden nodes, imports, reordered input and revised documents.
Compare exact public outputs and export bytes, then compare the explicitly allowed ordering differences under the proposed policy.

## Current disposition

The bounded experiment and conditional integration are authorized.
The approved A work and OWLAPI query improvements are being qualified independently.
The owner separately required OWLAPI to land on remote `main` before the approved exact dependency adoption; WebVOWL performance work may continue while upstream CI runs.
No target achievement or final programme acceptance is claimed by this record.
Any new dependency/backend selection or configuration change remains outside this experiment's authorization.

### Experiment checkpoint

The first W6 source prototype reduced the mapping from 209,716 to 6,775 quads, with 2,165 blank vertices and five refinement rounds.
Six Node diagnostics observed 138–171 ms preparation, unique keys for all 953 counted occurrences and unchanged results when input arrays were reversed.
These are source diagnostics, not accepted browser percentiles or a whole-load speedup.

The production candidate exposes `readModelDisplayOrderKeys` with purpose `display-order-v1` and uses it in load, edit and recovery worker operations.
The session validates purpose/revision and owns an immutable copy; the selector policy is `connected-sqrt-display-v1`.
The existing `webvowl.node-ranking-identity` performance measure is retained for comparable phase attribution and now includes the display purpose in its detail.
Canonical identity remains separately callable and is not computed alongside display keys on the production load path.

Focused checks cover source permutation, anonymous symmetry, punning, grouped and contextual nodes, inverse/restriction direction, cardinality, parallel occurrences, resource exhaustion and cancellation.
They also preserve exact saved-view artifact bytes, positions/pinning/hidden references, imported source bytes, semantic inspection and capture qualifications.
The existing connected-growth, component-fairness, filter/count-prefix, currentness, recovery and controller tests pass with the candidate.
Two former large-fixture rejection expectations now succeed within the same explicit string/work budgets; the tests record this improvement and retain explicit resource-limit rejection proof.
An initial saved-view fixture used Jest's foreign-realm clone and correctly failed source admission; the fixture now models the receiving realm without relaxing admission.
The earlier combined candidate passed 10,080 tests in 189 suites and the repository's full check.
Later changes below have focused evidence and await the final consolidated check; the earlier result is not relabelled as covering them.

### Approved first-image extension and implementation

The owner subsequently requested a much cheaper first selection, drawing before final display ordering, and temporarily disabled count controls, then instructed implementation and progression through the other bounded candidates.
This explicitly extends the first-selection contract above: the final display keys remain source-order independent under their stated symmetry limits, while the cheap initial selection may break otherwise tied nodes using revision-local occurrence handles.
Those handles are display ties only, never persistent or semantic identifiers.

Fresh ontology loads now use `connected-sqrt-preview-v1`: the existing connected-growth and square-root component fairness algorithm, with cheap node-kind/named-anchor/local-handle ties.
The ordinary automatic target remains 50; initial All or explicit count requests retain their requested size.
After the first drawing is installed, the same dedicated worker continues final display-key preparation without retransmitting the inspection or checkpoint.
The ordinary canonical/saved-VOWL path remains unchanged and uses `connected-sqrt-display-v1`.

The session owns the continuation and checks its load generation, revision, purpose and complete unique key correspondence before accepting it.
Completion pins the visible prefix and orders only the remaining tail; it neither redraws nor replaces the current nodes.
Later increases extend that prefix, while a subsequent eligibility/filter change follows the existing final-key ranking rules.
The policy stays identified as the preview policy because its preserved prefix need not equal the final-key-only prefix.
Replacement, editing and disposal retire the continuation; stale completions cannot affect the next owner.

`nodeCountStatus.orderingStatus` is `preparing`, `ready` or `failed` for this path.
Human count controls show a preparation message and remain disabled until ready.
Controller and WebMCP count changes/reset reject preparation as retryable `NODE_ORDERING_PENDING`; a failed continuation leaves the graph usable and reports `NODE_ORDERING_UNAVAILABLE`, requiring a reload.
Saved views and ordinary synchronous ordering paths need no additional status field.
Read/search/selection and unrelated view controls remain available after the initial load.

The browser worker qualification used one warmup and twenty fresh-worker W6 samples: median 172.8 ms, p95 **195 ms**, meeting the 250 ms display-key phase gate.
All 953 keys were unique and stable across the 3,331-occurrence workload.
This is worker-phase evidence, not foreground whole-load acceptance.
One uninstrumented headless W6 automatic load showed its first 50 nodes at **4,071 ms** while ordering was still preparing; it later became ready with all fifty original DOM nodes retained.
The final all-node trace also retained its initial nodes through completion.

Focused worker/session/selector/controller/control checks passed 175 tests across five suites before the later public-error projection correction.
They cover the two-message protocol and acknowledgment, late failures, abort/dispose, stale generation/revision, failed presentation, malformed correspondence, visible-prefix retention and disabled/re-enabled controls.
Evidence is retained in operator group `16557566c924469fb5e117f2cfbe6e03`: `whole-load-display-worker-cohort-1`, `whole-load-preview-targeted-1.log`, `whole-load-W6-preview-auto-headless-1` and the numbered production manifests.
The final repository check passed 10,119 tests in 190 suites and the complete check pipeline, including the public-error correction.
A later narrow lazy-snapshot allocation repair passed 98 affected tests and ten native W6 lifetime cycles, with zero retired owners/workers through disposal; the full-suite and repair evidence are distinguished in the whole-load proposal.
Conditional source adoption is selected on this correctness/lifetime evidence and the successful bounded display-key experiment.
Foreground admission failed before any timing sample, so whole-load p95, source delivery and programme acceptance remain separate claims; the PR stays draft.
