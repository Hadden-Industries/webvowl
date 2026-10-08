# Exact node-count selector for WebVOWL

## Executive conclusion

The current WebVOWL “Degree of collapsing” control should be replaced by a **node-count view selector backed by a deterministic total ordering of drawable node occurrences**. For a fixed ontology and fixed state of every other filter, WebVOWL should compute one ordered sequence

\[
P=(v_1,v_2,\ldots,v_N)
\]

and define the graph shown at count \(k\) as the prefix

\[
S(k)=\{v_1,\ldots,v_k\}.
\]

That design is the key architectural decision. It gives the requested invariants almost by construction:

| Requirement | Consequence of a fixed prefix ordering |
|---|---|
| Exactly \(k\) nodes | \(|S(k)|=k\) for every \(0\leq k\leq N\) |
| Monotonicity | \(S(k)\subset S(k+1)\) |
| Determinism | Same eligible graph + same ranking policy → same prefix |
| Maximum means all | \(S(N)=V_{\text{eligible}}\) |
| Stable interaction | Moving from \(k\) to \(k+1\) adds one node rather than recalculating an unrelated threshold |
| Efficient repeated changes | Ranking is computed once; changing \(k\) is principally a prefix-boundary/visibility operation |

The **counting unit should be rendered/canonical VOWL node occurrences, not OWL entities**. Specifically, the count should include the canonical projection's `class-node` and `datatype-node` occurrences that survive all non-count node filters and explicit hiding. It should not count labels, edges, arrowheads or other graphical decoration. This is important because WebVOWL's projection can group semantically equivalent classes, can create nodes for drawable set expressions, and can create context-specific datatype occurrences; consequently a displayed “109 nodes” is not necessarily “109 OWL classes”. The repository's canonical projection contract already makes those distinctions explicit. [Canonical projection contract at the researched baseline](https://github.com/Hadden-Industries/webvowl/blob/2927ada73ac707165d55e702703608bff4ba5b26/docs/specs/2026-09-24-canonical-vowl-projection-contract.md)

The recommended selector is **not a slider alone**. It is a native range control for exploration, a linked exact numeric/text entry, decrement/increment controls, and an **All** action:

```text
Nodes shown

 [−]   [ 50 ]   [+]      of 109 available       [All]

 0  ─────────────●────────────────────────  109

 Drag to explore, or type a number for an exact value.
```

This follows a useful division of labour: sliders are good for rapid relative exploration, while text entry is better for an exact target. USWDS explicitly advises using a conventional text input when precise values are required rather than relying on a range control for fine-grained precision; Nielsen Norman Group likewise identifies precision and highly granular ranges as weak points of sliders. citeturn2search2turn2search3

The new selector should **not reuse the old degree value or the existing `doc` URL parameter**. At the researched baseline, `doc` serialises `filters.minDegree`; changing its meaning would silently alter old share links. [Current share-link implementation](https://github.com/Hadden-Industries/webvowl/blob/2927ada73ac707165d55e702703608bff4ba5b26/src/app/js/controller/visualizationShareLink.js) A new parameter such as `nodes=50`, `nodes=all`, or `nodes=auto` should be introduced, while `doc` remains a legacy degree-filter representation.

The public repository's `main` branch was at the brief's baseline commit, `2927ada73ac707165d55e702703608bff4ba5b26`, when researched on 8 October 2026. That commit specifically restored canonical initial-placement, graph-control and automatic degree-filter behaviour, and its commit validation reports 9,421 tests across 145 suites plus browser checks including GoodRelations degree filtering. [Baseline commit](https://github.com/Hadden-Industries/webvowl/commit/2927ada73ac707165d55e702703608bff4ba5b26) I could not independently prove that every byte of the externally deployed WebVOWL instance is identical to that commit, so the recommendations below treat the supplied baseline SHA and public repository as the implementation authority rather than assuming deployment parity.

**Recommended decision set**

| Question from the brief | Recommendation |
|---|---|
| What is a node? | A visible canonical `class-node` or `datatype-node` occurrence |
| Are labels nodes? | No |
| Are anonymous/set-expression nodes counted? | Yes, when projected as `class-node` occurrences |
| Are off-screen nodes counted? | Yes; camera position is irrelevant |
| Do relationship filters change \(N\)? | Normally no, because they hide edges rather than endpoint nodes |
| Can relationship filters change ranking? | Yes; ranking should use the surviving relationship topology |
| Exact count algorithm | Fixed deterministic priority ordering + prefix |
| Primary ranking principle | Coherent connected expansion using local topology |
| Disconnected graphs | Deterministic sublinear weighted fair merge of component sequences |
| Default | Automatic initial target of `min(N, 50)` until the user expresses another intent |
| Minimum | Support 0 as a legitimate exact count |
| Maximum | Exactly all eligible nodes |
| Precision UI | Exact text entry plus range slider and ± controls |
| Trackpad/wheel | Scroll the filter panel; never intentionally mutate node count |
| Layout | Preserve positions/camera/pins; do not rebuild or re-seed retained nodes |
| Old `doc` links | Preserve as legacy `minDegree`; never reinterpret |
| New share representation | `nodes=auto`, `nodes=all`, or `nodes=<integer>` |
| OwlAPI change | None expected; this belongs after canonical projection, in WebVOWL view state |

## Baseline behaviour and the semantic contract

The present implementation explains why an apparently simple relabelling of “Degree of collapsing” cannot meet the brief.

The current UI control lives in [`src/app/js/ui/degreeFilterControl.js`](https://github.com/Hadden-Industries/webvowl/blob/2927ada73ac707165d55e702703608bff4ba5b26/src/app/js/ui/degreeFilterControl.js). It mirrors the range value into a badge and has an explicit wheel handler: wheel movement changes the degree, clamps it to the range, dispatches `input` and `change`, and calls `preventDefault()`. Its tests explicitly assert that wheel increment and prevention behaviour. [Current degree-filter tests](https://github.com/Hadden-Industries/webvowl/blob/2927ada73ac707165d55e702703608bff4ba5b26/src/app/js/ui/degreeFilterControl.test.js)

That wheel behaviour should be deliberately retired. A user moving the pointer over the control while scrolling a narrow filters panel should not accidentally change graph semantics or be trapped because the panel's scrolling has been cancelled. “No keyboard trap”, usable mobile interaction and clear keyboard manipulation are also part of current USWDS accessibility testing guidance for range controls. citeturn2search1

More importantly, the underlying algorithm is threshold-based rather than count-based. [`canonicalVowlViewControls.js`](https://github.com/Hadden-Industries/webvowl/blob/2927ada73ac707165d55e702703608bff4ba5b26/src/app/js/controller/canonicalVowlViewControls.js) currently:

* computes a degree for node occurrences;
* explicitly excludes edge incidence when either endpoint is a datatype node;
* groups nodes by degree;
* chooses an automatic minimum-degree threshold intended to reduce an initially large graph towards roughly 50 nodes; and
* hides all nodes below that threshold.

Because many nodes can have the same degree, changing a threshold can remove an entire bucket at once. There is therefore no way for the present mechanism to promise “show exactly 51”, then “exactly 52”, while also guaranteeing that the 51 are a subset of the 52. The target of approximately 50 is a useful migration/default-density clue, but **degree threshold is the wrong state variable for the new feature**.

There is another important weakness in carrying the old degree concept forward: the current degree calculation omits datatype-node incidence. A class heavily connected through datatype properties can therefore look less connected to the current collapsing algorithm than it appears visually. The new ranking graph should count topology among every eligible counted node type, including class↔datatype incidence.

**The counting contract should be defined at the canonical occurrence layer.** The existing canonical projection specification distinguishes node and edge occurrence kinds and describes cases where semantic ontology constructs do not map one-to-one to drawing nodes. [Canonical projection contract](https://github.com/Hadden-Industries/webvowl/blob/2927ada73ac707165d55e702703608bff4ba5b26/docs/specs/2026-09-24-canonical-vowl-projection-contract.md) Therefore:

\[
N =
|\{v \mid
v.kind\in\{\texttt{class-node},\texttt{datatype-node}\}
\land v\text{ is eligible before node-count filtering}\}|.
\]

“Eligible before node-count filtering” means after:

1. ontology parsing and canonical projection;
2. node-affecting filters such as datatype-node or set-operator visibility;
3. explicit/restored hidden-node state that is intended to be upstream of the selector;

but before the count selector's own hiding.

Relationship-only filters such as subclass, object-property and disjointness visibility should continue to hide relationships without automatically deleting endpoint nodes. This matches the current visibility closure in [`canonicalVowlScene.js`](https://github.com/Hadden-Industries/webvowl/blob/2927ada73ac707165d55e702703608bff4ba5b26/src/app/js/controller/canonicalVowlScene.js): a hidden node forces touching edges to be hidden and a hidden relationship can in turn suppress its label, but an otherwise eligible node is not deleted merely because a relationship has been filtered away.

That yields several useful, testable definitions:

| Case | Counts towards \(N\)? | Rationale |
|---|---:|---|
| Named class node occurrence | Yes | Drawable node |
| Grouped equivalent-class node | Once | One projected node occurrence |
| Anonymous drawable expression projected as `class-node` | Yes | It occupies a node in the graph |
| Union/intersection/complement operator node | Yes, when projected as `class-node` | It is a drawable occurrence |
| Datatype node occurrence | Yes | Visually a graph node |
| Same datatype represented in two projection contexts | Twice | Two drawable occurrences |
| Property/subclass/disjoint/operator/restriction edge | No | Relationship, not node |
| Property/edge label | No | Annotation/positionable label, not graph node |
| Hidden-by-other-filter node | No | Not eligible for this selector |
| Visible node outside the viewport | Yes | Camera does not alter graph membership |
| Pinned but count-hidden node | No while hidden | Pin is placement state, not mandatory membership |

This meaning should appear in user documentation as something like **“Nodes shown counts the nodes in the visualisation, not the number of OWL entities in the ontology.”**

The canonical scene also already contains a useful foundation for stable interaction: class/datatype occurrences receive deterministic initial phyllotaxis placements and existing placements can be retained instead of being regenerated. [Canonical scene implementation](https://github.com/Hadden-Industries/webvowl/blob/2927ada73ac707165d55e702703608bff4ba5b26/src/app/js/controller/canonicalVowlScene.js) That foundation should be preserved rather than coupling the new count control to reprojection or reinitialisation.

## Deterministic exact-selection architecture

A single total priority ordering is substantially safer than attempting to “pick the best \(k\) nodes” independently for every value of \(k\). Independent optimisation may choose a theoretically better set at each \(k\), but it immediately creates a nesting problem: the optimum 50-node set need not be contained in the optimum 51-node set. A prefix ordering reverses the responsibility: WebVOWL decides once what the **next node** should be.

### The eligible topology

For a fixed view state, construct an undirected ranking graph

\[
G=(V,E)
\]

where \(V\) contains eligible counted node occurrences.

For ranking purposes, form one neighbour relationship between two nodes whenever at least one currently surviving visual relationship connects them. Parallel visual relationships should be collapsed for the primary **unique-neighbour degree**, while their multiplicity can remain as a secondary signal. Thus an ontology with thirty property relationships between the same two visual nodes does not pretend that either endpoint has thirty independent neighbours.

The ranking topology should include datatype endpoints rather than inherit the existing degree filter's datatype exclusion. Edge filters may legitimately alter \(E\), and consequently may reorder nodes, but moving the node-count slider itself must never recompute this topology.

### The component-local sequence

For each connected component \(C\), generate a complete deterministic sequence \(Q_C\).

Choose its seed using the lexicographic priority:

\[
(\text{unique neighbour degree},
 \text{surviving incident relationship count},
 -\text{canonical key})
\]

where the first two quantities are maximised and the canonical key is used as the final stable tie-break.

After the seed, repeatedly choose a node from the unselected frontier, prioritising:

1. the number of its neighbours already selected in that component;
2. its total unique-neighbour degree;
3. its surviving incident-relationship multiplicity;
4. its stable canonical key.

Because a component is connected, the frontier remains non-empty until the component has been exhausted. Its prefix therefore tends to grow a coherent region rather than scatter equally ranked degree nodes around the graph.

This is especially valuable for chains and regular graphs. A pure degree sort gives almost every internal chain node the same score, so the display can jump between unrelated positions according to an arbitrary tie-break. Connected expansion instead chooses a deterministic seed and grows from the visible structure.

### The disconnected-graph merge

A single component must not permanently monopolise the first \(k\) positions when an ontology contains several meaningful regions. Conversely, strict round-robin across components can grossly overrepresent isolated singleton components.

I recommend computing every component-local sequence and merging them with a **deterministic weighted fair scheduler using a sublinear component-size weight**. One concrete first implementation is:

\[
w_C=\sqrt{|C|}
\]

and, when choosing the component from which to emit the next node,

\[
score(C)=\frac{w_C}{1+s_C},
\]

where \(s_C\) is the number of nodes already emitted from that component. Choose the maximum score and break exact ties by a stable component key, such as the minimum canonical node key in the component.

The square-root weighting is deliberately a **WebVOWL product heuristic, not a theorem or claimed graph-visualisation optimum**. It gives large connected regions more representation without giving their raw size complete control. It should be compared with equal weighting and logarithmic/proportional alternatives in the proposed usability fixtures before being frozen as public behaviour.

Semantic-zoom research supports the broader principle of providing persistent, progressively richer graph representations rather than presenting unrelated structures at adjacent zoom/detail levels. Work specifically on ontology graph semantic zooming has also treated preserving context and the viewer's mental map as central design objectives. citeturn3academia36turn4search14 Experimental graph-visualisation research has found mental-map preservation beneficial for orientation tasks, although later reviews caution that benefits depend on the task rather than being universal. citeturn3search7turn3search9

### The final order and its guarantees

The component merge produces one sequence \(P\) of all \(N\) eligible nodes. Node-count visibility is then only:

\[
S(k)=P[0:k].
\]

This gives a clean proof obligation rather than a collection of behavioural expectations:

**Exactness**

\[
|S(k)|=k.
\]

**Nesting**

\[
S(k)\subset S(k+1).
\]

**Maximum**

\[
S(N)=V.
\]

**Determinism**

Provided topology, filters, projection semantics and stable-key construction are equal, every ranking comparison has a total deterministic tie-break and therefore generates the same \(P\).

The difficult part of “deterministic” is therefore not the prefix operation; it is the **canonical tie-break key**. Runtime array index, DOM order, RDF parse order and blank-node identifiers are unsuitable.

For named occurrences, the key can be derived from the canonical semantic target and projection context. For anonymous expressions it should come from a canonical structural descriptor: operator type plus recursively canonicalised operands, sorting operand descriptors for commutative constructs such as union/intersection. Grouped equivalent targets should likewise be represented as sorted canonical sets. Context-sensitive datatype occurrences must include their projection context. A collision-safe full descriptor or secondary canonical serialisation should resolve equal hashes.

This gives the implementation a stronger test than “reload the same JSON and get the same answer”: serialisation order, RDF statement order and generated blank-node identifiers can be varied while expected rank remains unchanged where the canonical projection is semantically equivalent.

### Why not a more sophisticated centrality measure?

| Candidate | Strength | Why it should not be the default |
|---|---|---|
| Degree + stable ID | Very cheap and explainable | Hub-biased; ties can scatter; weak disconnected-component treatment |
| Connected expansion | Coherent incremental reveal; local explanation is straightforward | Needs an explicit component policy |
| PageRank/eigenvector-like rank | Captures recursively important neighbours | Iterative parameters; less transparent; still measures topology rather than ontology semantics |
| Closeness | Centre-oriented | Awkward across disconnected graphs and sensitive to graph changes |
| Betweenness | Finds structural bridges | Considerably more expensive and often unstable under small topology changes |
| Semantic type/name priority | Potentially task-specific | Encodes domain assumptions into a general ontology viewer |
| Force-layout geometry | Might preserve apparent visual locality | Makes semantic visibility dependent on transient simulation state |
| Mandatory semantic bundles | Strong local meaning | Can make exact \(k\) mathematically impossible |

Brandes' exact betweenness algorithm, for example, has \(O(nm)\) time for an unweighted graph rather than the essentially linear graph scan needed to establish ordinary degree/neighbourhood information, which is an unattractive trade for a control expected to respond interactively. citeturn5search0

The proposed topology-based policy should therefore be **deliberately modest**: it provides connected context and component fairness, not an unsupported claim to know which ontology concepts are semantically “most important”.

Several pathological fixtures should become first-class regression tests:

| Fixture | Expected behaviour |
|---|---|
| Star | Hub appears first; leaves have a stable deterministic order |
| Chain | One deterministic central/high-degree seed, then locally connected growth |
| Cycle/regular graph | Stable key resolves otherwise symmetrical choices; result is deterministic but acknowledged as semantically arbitrary |
| Two large components | Both receive representation according to the fair scheduler |
| Large component + small meaningful component | Small region becomes visible without having to exhaust the large one |
| Many isolates | Stable component keys create a repeatable singleton sequence |
| Datatype-heavy ontology | Datatype connectivity contributes normally |
| Set-expression-heavy ontology | Operator occurrences participate as ordinary projected nodes |
| Many parallel properties | Unique-neighbour degree is not inflated by multiplicity |
| Equivalent RDF serialisations | Identical canonical priority sequence |

For an operator expression, exact-count semantics should take precedence over forcing a whole expression neighbourhood into the set: automatically adding “all operands” would cause jumps of several nodes and violate exactness. Where count filtering hides an operand, WebVOWL should extend the canonical projection's existing concept of communicating omitted operands through a derived cue/details representation rather than inventing uncounted visible nodes. [Projection contract](https://github.com/Hadden-Industries/webvowl/blob/2927ada73ac707165d55e702703608bff4ba5b26/docs/specs/2026-09-24-canonical-vowl-projection-contract.md)

## Interaction, precision and accessibility

The best control is a **compound control**, because “rapid exploration” and “set exactly 537” are fundamentally different interaction tasks.

A recommended expanded design is:

```text
Nodes shown

┌────┐ ┌─────────┐ ┌────┐                    ┌────────┐
│ −  │ │   50    │ │ +  │   of 109 available │  All   │
└────┘ └─────────┘ └────┘                    └────────┘

0  ─────────────────●─────────────────────────────── 109

Drag to explore, or enter an exact number.
```

For a large graph:

```text
Nodes shown

 [−] [ 1250 ] [+]    of 24,731 available     [All]

 0  ─────────●──────────────────────────── 24,731
```

The slider remains linear and `step=1`. A pointer cannot physically address all 24,732 positions on a 300-pixel track, and it does not need to: the slider is the coarse exploration mechanism; the input and step buttons are the exact mechanisms. That is preferable to inventing a non-linear scale whose numerical meaning becomes harder to predict and harder for assistive technology to communicate. USWDS specifically characterises range input as useful for relative/approximate choices and recommends a regular input where precise values matter. citeturn2search2

The range should use ordinary slider keyboard conventions: arrow keys change by one step, Home and End move to endpoints, and Page Up/Page Down may provide a documented larger increment. WAI-ARIA's slider pattern defines these keyboard expectations and the `aria-valuemin`, `aria-valuemax`, `aria-valuenow` and labelling semantics. citeturn0search0 A native HTML range control is preferable wherever it can satisfy the visual requirement; custom slider semantics create extra assistive-technology obligations.

For precise entry, a text field with numeric input hints is preferable to relying blindly on `<input type="number">`. GOV.UK's design guidance recommends `type="text"` with `inputmode="numeric"` for whole-number entry in many cases, in part because number inputs have historically produced problematic browser and assistive-technology interactions and unintended increment behaviours. citeturn2search4turn2search0 For WebVOWL, this also gives the application explicit parsing and validation control.

**Commit semantics should differ by input type.** Slider movement and ± controls always generate valid counts and can update immediately/coalesced. In the exact input, temporary states such as blank text must be permitted while editing; the graph should retain the last valid count until Enter or blur commits a valid whole number. Escape should restore the previous committed value. Invalid values should not be silently rounded or clamped, because “500” becoming “109” undermines the promise that this is an exact selector.

An invalid entry should therefore look conceptually like:

```text
Nodes shown

 [−] [ 500 ] [+]   of 109 available      [All]
       └─ Enter a whole number from 0 to 109.

Graph remains at the last valid value.
```

The app should permit **zero**. This is mathematically clean, supports automation and testing, and makes `0…N` a complete interval. At zero, the visualisation should show an intentional empty-state message rather than looking broken, for example “0 nodes shown. Increase Nodes shown or choose All.”

At \(N=0\), controls can be disabled with “No nodes are available with the current filters.”

### Accessibility behaviour

WCAG 2.2's Dragging Movements criterion requires functionality that uses dragging to have a non-dragging single-pointer alternative unless an exception applies. The visible decrement/increment buttons give the node-count slider exactly that alternative; exact text entry provides another non-drag workflow. citeturn1search0

Custom interactive targets should be at least the WCAG 2.2 AA minimum of 24×24 CSS pixels or satisfy its spacing exception. I would use roughly 44×44 CSS pixels for the −, + and All buttons where the side panel permits it, matching the stronger enhanced target-size guidance and making touch interaction substantially easier. citeturn1search1turn1search3

The control group should have a visible **“Nodes shown”** label and accessible names whose visible wording is retained. The range exposes current/min/max values; the exact field is announced as the exact node value rather than as an unrelated generic number field. Current USWDS testing guidance also calls for visible focus, keyboard operability, mobile orientation checks, zoom/reflow testing and screen-reader communication of a range's purpose and current/limit values. citeturn2search1

A status region should report **settled semantic changes**, not every individual thumb movement. For example:

```text
Showing 50 of 109 available nodes.
```

or, while an expensive change is pending:

```text
Updating graph…
```

WCAG guidance for status messages supports programmatically exposing important updates without forcing focus to move to them. citeturn1search6 Continuous `aria-live` announcements for every drag frame would instead create noise, so announcement should be coalesced.

The control must also remain usable at 400% zoom and in a narrow side panel. The input/buttons can wrap above the range, endpoints should remain visible, and long translations must wrap rather than be clipped. USWDS's current accessibility test guidance includes high zoom/reflow and mobile checks for range controls. citeturn2search1

Large graph updates can produce substantial motion even if the HTML control itself does not animate. WebVOWL should honour `prefers-reduced-motion`: count changes should avoid camera animation and, where practical, minimise layout transitions/reheating for users requesting reduced motion. W3C specifically documents `prefers-reduced-motion` as a technique for reducing interaction-triggered motion. citeturn10search3

Most importantly, the present explicit wheel-to-degree interaction should disappear. **Wheel/trackpad motion over the range must remain available to scroll the filters panel and must not be intentionally bound to changing \(k\).** The existing `preventDefault()` wheel behaviour in the degree control is therefore a migration item, not behaviour to preserve. [Current control](https://github.com/Hadden-Industries/webvowl/blob/2927ada73ac707165d55e702703608bff4ba5b26/src/app/js/ui/degreeFilterControl.js)

### Selection, pinning and search

Selected, pinned or searched nodes should not silently become “mandatory nodes”. Suppose \(S(50)\) does not contain a searched node of rank 87. Forcing that node into the first 50 means either showing 51 nodes or evicting one of the former 50, and the latter can destroy the prefix/nesting contract.

Instead:

* a hidden selected node may remain selected in logical/details state and be marked “hidden by node count”;
* a pin should remain stored even while the node is hidden, so the node returns to the same position;
* hidden search results should be identifiable as hidden;
* activating **Reveal in graph** should explicitly raise the node-count target to at least that node's rank.

That makes the semantic change attributable to the user's action rather than creating an undocumented exception to “exactly \(k\)”.

### Count intent

The internal model should distinguish the number currently applied from why it was chosen:

```text
mode: auto | exact | all
requestedCount: integer when exact
eligibleCount: N
appliedCount: k
```

`auto` is useful only as the untouched initial/default state. It should produce exactly `min(N, 50)`, retaining the baseline's approximate initial density goal without retaining its degree-bucket inaccuracies. Once the user types, drags or uses ±, the state becomes `exact`. All selects `all`, which follows \(N\) when other filters change.

For an exact target that becomes temporarily impossible because another filter reduces \(N\), I recommend retaining its latent target. If the user chose 100 and another filter leaves only 73 eligible nodes, the graph shows 73 and the UI can say:

```text
73 of 73 available
Target 100 will be restored if more nodes become available.
```

Re-enabling the filter can then restore 100. A deliberate edit to 73 replaces the old target. This preserves user intent while keeping the displayed graph count truthful.

## State, compatibility and repository integration

This change belongs in WebVOWL's **view/controller layer**, not in OWL parsing. The ontology should still be parsed and canonically projected once; the selector ranks and hides already-projected drawable occurrences. Nothing in the proposed policy requires an OwlAPI parser/model change.

The main integration surface at baseline is:

| File | Present responsibility | Required node-count change |
|---|---|---|
| [`ui/degreeFilterControl.js`](https://github.com/Hadden-Industries/webvowl/blob/2927ada73ac707165d55e702703608bff4ba5b26/src/app/js/ui/degreeFilterControl.js) | Degree range, badge, wheel behaviour | Replace/rename with compound node-count control; delete custom wheel mutation |
| [`controller/canonicalVowlViewControls.js`](https://github.com/Hadden-Industries/webvowl/blob/2927ada73ac707165d55e702703608bff4ba5b26/src/app/js/controller/canonicalVowlViewControls.js) | Filter eligibility, degree calculation, auto degree threshold | Define eligible counted nodes; compute/cache deterministic priority sequence |
| [`controller/canonicalWebVowlController.js`](https://github.com/Hadden-Industries/webvowl/blob/2927ada73ac707165d55e702703608bff4ba5b26/src/app/js/controller/canonicalWebVowlController.js) | View state, rendering orchestration, stale-load protection | Own `auto/exact/all`, requested/applied count, revisions and cached ranking |
| [`controller/canonicalVowlScene.js`](https://github.com/Hadden-Industries/webvowl/blob/2927ada73ac707165d55e702703608bff4ba5b26/src/app/js/controller/canonicalVowlScene.js) | Placement, hidden closure, camera/display | Reuse placement; visibility diffs only; support omission cue where needed |
| [`controller/renderedGraphRuntimeContracts.js`](https://github.com/Hadden-Industries/webvowl/blob/2927ada73ac707165d55e702703608bff4ba5b26/src/app/js/controller/renderedGraphRuntimeContracts.js) | Runtime view/filter contracts and events | Add count-intent contract; deprecate degree-range event |
| [`controller/visualizationShareLink.js`](https://github.com/Hadden-Industries/webvowl/blob/2927ada73ac707165d55e702703608bff4ba5b26/src/app/js/controller/visualizationShareLink.js) | Share URL serialisation/deserialisation | Add `nodes`; preserve legacy `doc` interpretation |
| [`webmcp/webMcpToolContracts.js`](https://github.com/Hadden-Industries/webvowl/blob/2927ada73ac707165d55e702703608bff4ba5b26/src/app/js/webmcp/webMcpToolContracts.js) | Agent-visible view/filter schema | Expose node intent and returned eligible/applied counts |
| [`ui/degreeFilterControl.test.js`](https://github.com/Hadden-Industries/webvowl/blob/2927ada73ac707165d55e702703608bff4ba5b26/src/app/js/ui/degreeFilterControl.test.js) | Current control regressions | Replace wheel assumptions; add exact input/slider/a11y synchronisation tests |
| [`canonical-vowl-projection-contract.md`](https://github.com/Hadden-Industries/webvowl/blob/2927ada73ac707165d55e702703608bff4ba5b26/docs/specs/2026-09-24-canonical-vowl-projection-contract.md) | Projection semantics | Document which occurrences count and ranking-key requirements |

The existing runtime contract models `filters.minDegree` as a non-negative integer, and the WebMCP view contract exposes it as “hide elements with fewer connections”. [Runtime contract](https://github.com/Hadden-Industries/webvowl/blob/2927ada73ac707165d55e702703608bff4ba5b26/src/app/js/controller/renderedGraphRuntimeContracts.js) [WebMCP contract](https://github.com/Hadden-Industries/webvowl/blob/2927ada73ac707165d55e702703608bff4ba5b26/src/app/js/webmcp/webMcpToolContracts.js) The new feature should not simply redefine that field as a count: existing automation would silently change semantics.

A suitable new contract is conceptually:

```text
nodes:
  mode: "auto" | "all" | "exact"
  count: integer              # required only for exact

read-only response metadata:
  eligibleNodeCount: N
  appliedNodeCount: k
```

`minDegree` can remain accepted through a documented deprecated compatibility path.

### Share links

The existing share-link code reads/writes the short parameter `doc` as `filters.minDegree`. [Share-link implementation](https://github.com/Hadden-Industries/webvowl/blob/2927ada73ac707165d55e702703608bff4ba5b26/src/app/js/controller/visualizationShareLink.js) The brief is correct to insist that it **must not be reinterpreted as node count**.

Recommended URL semantics are:

```text
nodes=auto
nodes=all
nodes=50
```

Legacy URLs continue to mean:

```text
doc=<legacy minimum degree>
```

The compatibility rules should be:

| Input state | Behaviour |
|---|---|
| Only `nodes` | Apply new exact selector |
| Only legacy `doc` | Reproduce legacy degree visibility |
| Neither | New default `auto` |
| Both | `nodes` governs the replacement selector; ignore legacy `doc` with a diagnostic |
| User changes node count after loading `doc` | Exit legacy degree state and enter new node-count state |
| Untouched legacy view re-shared | Preserve `doc` so the historical subset can be recreated |
| New/count-modified view re-shared | Emit `nodes`, not `doc` |

In a legacy `doc` state, the UI can still report the observed result—for example “47 of 109 nodes”—but should not imply that 47 was the saved control intent. A small “Legacy degree filter applied” indication until the first node-count change is less misleading.

For a strict programmatic API/WebMCP request, specifying both `minDegree` and new `nodes` should preferably be rejected as ambiguous rather than applying two competing node filters. URLs need more forgiving forward/backward compatibility than an API call.

Saved state should receive the same treatment: old artefacts containing `minDegree` remain readable; new artefacts serialise a versioned node-count intent. The two fields should never be aliases.

The current controller also already has a useful pattern for stale asynchronous work: load operations have sequencing and cancellation logic so an older operation cannot simply overwrite newer state. [Canonical controller](https://github.com/Hadden-Industries/webvowl/blob/2927ada73ac707165d55e702703608bff4ba5b26/src/app/js/controller/canonicalWebVowlController.js) Count updates should adopt the same latest-request-wins principle.

## Spatial stability and performance

Changing the requested count should be treated as a **visibility delta within one canonical scene**, not as a fresh graph.

If a user moves from 50 to 51, the already-visible 50 nodes should keep their positions. The 51st node should be revealed at its retained or deterministic initial placement. Moving back to 50 should hide it without destroying that stored placement. A future reveal should therefore return it to the same known starting position.

The existing canonical scene's deterministic initial placement and retained-placement handling make this feasible. [Scene implementation](https://github.com/Hadden-Industries/webvowl/blob/2927ada73ac707165d55e702703608bff4ba5b26/src/app/js/controller/canonicalVowlScene.js) This is also consonant with graph-visualisation evidence that preserving spatial continuity can help users retain orientation during graph changes, although benefits are task-dependent. citeturn3search7turn3search9

The behavioural rules should be:

| State | Count change behaviour |
|---|---|
| Existing visible node | Never re-seed |
| Previously hidden/revealed node | Reuse stored placement |
| Pinned node | Preserve its pin and coordinates while hidden |
| Camera | Do not automatically pan/zoom |
| Paused layout | Remain paused |
| Active force layout | Introduce latest visibility delta with limited/reasonable reheating |
| Rapid slider movement | Coalesce work; do not run a full layout on every pointer event |
| Reduced-motion preference | Minimise simulation/transition motion and never animate the camera merely because \(k\) changed |

This separation is critical: **node-count selection determines membership; layout determines placement; viewport determines what part of the selected graph is currently on screen.** None should secretly redefine the other.

### Ranking cache

The priority sequence should be cached under a signature such as:

```text
document/canonical-projection revision
+ node-affecting filter state
+ relationship-filter state used for ranking
+ explicit upstream-hidden state
+ ranking-policy version
```

A change only to \(k\) does **not** invalidate this cache.

For a component-expansion implementation using priority queues, an \(O((N+E)\log N)\) preprocessing envelope is a reasonable design target, while ordinary topology construction is \(O(N+E)\). Once the priority sequence exists, choosing \(S(k)\) should not rerun centrality: the principal work is identifying the changed prefix interval and updating visibility. The current visibility closure may still require an edge scan, so dense-edge cases must be benchmarked separately.

That matters because `k` limits nodes but **does not automatically limit relationships or labels**. A graph of 300 selected nodes can still be expensive if the selected induced graph is extremely dense.

For pointer dragging, the UI should echo its thumb/value synchronously but graph mutations can be coalesced to an animation frame or a short debounce in the order of tens of milliseconds. Every update should carry a monotonically increasing revision so stale ranking, visibility or layout work cannot commit after a newer request.

The following are proposed engineering gates, **not measurements I obtained from the current build and not external standards**:

| Metric | Proposed gate |
|---|---:|
| Control/value visual echo | ≤100 ms p95 |
| Cached prefix/hidden-set update on reference large fixture | ≤50 ms p95 |
| Initial ranking of ~10k nodes / ~50k relationships on agreed reference laptop | ≤250 ms p95 |
| Pending indicator | Show if semantic update exceeds about 200 ms |
| Final count after rapid drag/release | ≤150 ms p95 excluding force-layout settling |
| Typical force layout with ≤500 shown nodes | Aim for ≤1 s p95 to settle; record separately rather than blocking exact-count correctness |

The benchmark manifest should record browser build, operating system, CPU, RAM, device-pixel ratio, WebVOWL commit, ontology checksum and warm/cold-cache status. “Fast on my machine” should not become the acceptance criterion.

The performance matrix should combine topology shapes as well as sizes:

| Class | Example scale | Why |
|---|---:|---|
| Small | 50 nodes / 100 edges | Baseline overhead |
| Medium | 500 / 2,000 | Typical interactive graph |
| Large | 5,000 / 20,000 | Ranking/cache behaviour |
| Stress | 20,000 / 100,000 | Degradation and cancellation |
| Dense | Hundreds of nodes, unusually high edge count | Node cap does not cap rendering cost |
| Isolate-heavy | Thousands of singleton components | Component scheduler |
| Expression-heavy | Many set-expression nodes | Projection/count semantics |
| Datatype-heavy | High class↔datatype incidence | Regression against old degree exclusion |

No exact performance figure should be put into release documentation until these measurements have actually been run on a reproducible benchmark environment.

## Validation and phased implementation

This feature lends itself unusually well to **property-based testing** because its core promises are mathematical rather than screenshot-dependent.

For every generated eligible graph and for every \(k\in[0,N]\), the test suite should assert:

\[
|S(k)|=k
\]

\[
S(k)\subseteq S(k+1)
\]

\[
S(N)=V
\]

and that the same canonical graph/filter signature generates the same complete sequence on repeated runs.

Equivalent-representation tests should then permute RDF statement order and any other non-semantic input ordering available in the fixture infrastructure. Where canonical projection is equivalent, the count sequence must remain equivalent. This is where a bad runtime-index or blank-node-ID tie-break will be exposed.

A more complete acceptance matrix is:

| Area | Required test |
|---|---|
| Exactness | Every \(k\), including 0, 1, \(N-1\), \(N\) |
| Nesting | Prefix set inclusion for every adjacent pair |
| Determinism | Reload/re-run and shuffled representation |
| Other filters | Change each existing filter and recompute \(N\) without stale state |
| Edge-only filters | Verify node availability does not accidentally fall merely because edges were hidden |
| Datatypes | Verify datatype incidence participates in rank |
| Expressions | Verify operator nodes count; omission remains intelligible |
| Components | Star, chain, cycle, unequal components, isolates |
| Layout | Existing nodes retain coordinates; pin and paused state survive |
| Camera | No automatic pan/zoom on \(k\) |
| Rapid requests | Only latest requested state commits |
| Exact input | Valid, invalid, blank during edit, Enter, blur, Escape |
| Slider | Arrow/Home/End; exact synchronisation with input |
| Wheel | Panel scrolls; count does not intentionally change |
| Touch | ±/All provide non-drag pointer path |
| Share URL | New round-trip plus old `doc` regression snapshots |
| Saved state | Old min-degree state readable; new state versioned |
| WebMCP/API | New intent round-trip; ambiguous old+new rejected |
| Zero | Purposeful empty state, not an error |
| All | Exactly \(N\) nodes after every upstream filter combination |

The old degree control's wheel test should specifically be replaced by its inverse regression: a wheel event must not be an application-defined node-count increment and must not be cancelled just to protect the selector.

Accessibility verification should combine automated checks with manual interaction; an automated checker cannot prove that a slider is understandable with NVDA, VoiceOver or TalkBack. WAI-ARIA itself warns that touch-based assistive technologies do not necessarily synthesise all slider key commands reliably, another reason the exact text/± alternatives are important and should be tested on real devices. citeturn0search0

A practical manual matrix is keyboard-only; mouse; precision trackpad/high-resolution wheel; touch; 200% and 400% zoom; Windows forced-colours/high contrast; reduced-motion; NVDA with a supported Firefox/Chromium configuration; JAWS/Chromium where available; VoiceOver on Safari macOS/iOS; and TalkBack/Chrome Android. The acceptance goal is that all semantic operations have a path that does not require dragging and that focus never disappears or jumps merely because the graph updates. WCAG 2.2's dragging and minimum-target criteria provide the normative baseline. citeturn1search0turn1search1

For formative usability, the following are useful concrete tasks rather than “does the user like the slider?”:

> Set this graph to exactly 37 of 109 nodes; add one node; show everything; return to 37; scroll the Filters panel while the pointer is over the control; reveal a search result currently hidden by the count; disable a filter so that fewer than 37 nodes are available and explain what happened.

A suggested product gate—not a WCAG requirement—is at least 90% unassisted completion of the exact-count and All tasks in a study large enough to make that percentage meaningful, zero accidental count changes in the explicit wheel-scroll task, and successful current/max-value identification for every recruited screen-reader participant. Median time to enter a supplied exact target should be tracked as a comparative metric rather than treated as a universal human-performance standard.

### Delivery sequence

| Phase | Deliverable | Exit criterion |
|---|---|---|
| Contract | Written definition of counted occurrence, upstream eligibility, zero/all semantics, stable key and compatibility rules | Reviewed projection/runtime contract |
| Headless ranking | Eligible-graph builder, canonical ranking key, component sequences and deterministic merge | Property/counterexample suite green without UI |
| View state | `auto/exact/all`, eligible/applied counts, cache and revision semantics | Controller tests green; stale-work tests green |
| User interface | Compound range + exact field + ± + All; remove wheel capture | Keyboard/pointer/touch behaviour and synchronisation green |
| Persistence and agents | `nodes` share URL, old `doc` compatibility, saved-state and WebMCP changes | Old/new round-trip corpus green |
| Stability/performance | Placement preservation, coalescing, layout behaviour, benchmark harness | Agreed benchmark gates met |
| Accessibility/usability | AT matrix and task-based formative evaluation | No blocking WCAG failures; core tasks satisfy product gate |
| Rollout | New control default; legacy parser retained | Telemetry/feedback shows no migration regressions before degree path removal is considered |

The degree implementation should not be deleted at the beginning of this sequence. It is needed as a compatibility oracle for old `doc` links and regression snapshots until legacy-state support has been demonstrated.

## Source register and open limitations

The implementation findings in this report were anchored to the exact SHA supplied in the brief rather than inferred from an older upstream WebVOWL release.

| Source | Role in the recommendation |
|---|---|
| [WebVOWL baseline commit `2927ada…`](https://github.com/Hadden-Industries/webvowl/commit/2927ada73ac707165d55e702703608bff4ba5b26) | Exact researched implementation baseline; reports restoration of canonical loading/control behaviour and baseline test validation |
| [`degreeFilterControl.js`](https://github.com/Hadden-Industries/webvowl/blob/2927ada73ac707165d55e702703608bff4ba5b26/src/app/js/ui/degreeFilterControl.js) | Current slider, badge and wheel/`preventDefault` behaviour |
| [`degreeFilterControl.test.js`](https://github.com/Hadden-Industries/webvowl/blob/2927ada73ac707165d55e702703608bff4ba5b26/src/app/js/ui/degreeFilterControl.test.js) | Existing behavioural expectations, including wheel behaviour |
| [`canonicalVowlViewControls.js`](https://github.com/Hadden-Industries/webvowl/blob/2927ada73ac707165d55e702703608bff4ba5b26/src/app/js/controller/canonicalVowlViewControls.js) | Current degree calculation, ~50-node automatic threshold and filter/visibility preparation |
| [`canonicalVowlScene.js`](https://github.com/Hadden-Industries/webvowl/blob/2927ada73ac707165d55e702703608bff4ba5b26/src/app/js/controller/canonicalVowlScene.js) | Positionable occurrence types, placement retention and hidden-state closure |
| [`canonicalWebVowlController.js`](https://github.com/Hadden-Industries/webvowl/blob/2927ada73ac707165d55e702703608bff4ba5b26/src/app/js/controller/canonicalWebVowlController.js) | View/controller state, asynchronous sequencing and graph-event orchestration |
| [`renderedGraphRuntimeContracts.js`](https://github.com/Hadden-Industries/webvowl/blob/2927ada73ac707165d55e702703608bff4ba5b26/src/app/js/controller/renderedGraphRuntimeContracts.js) | Existing `minDegree` view contract and degree-range event |
| [`visualizationShareLink.js`](https://github.com/Hadden-Industries/webvowl/blob/2927ada73ac707165d55e702703608bff4ba5b26/src/app/js/controller/visualizationShareLink.js) | Evidence that `doc` is presently the legacy minimum-degree URL field |
| [`webMcpToolContracts.js`](https://github.com/Hadden-Industries/webvowl/blob/2927ada73ac707165d55e702703608bff4ba5b26/src/app/js/webmcp/webMcpToolContracts.js) | Agent/API-facing filter semantics |
| [Canonical VOWL projection contract](https://github.com/Hadden-Industries/webvowl/blob/2927ada73ac707165d55e702703608bff4ba5b26/docs/specs/2026-09-24-canonical-vowl-projection-contract.md) | Authoritative distinction between class/datatype nodes, expressions, labels and relationship occurrences |
| [WebVOWL repository README](https://github.com/Hadden-Industries/webvowl/blob/2927ada73ac707165d55e702703608bff4ba5b26/README.md) | Current application architecture and client-side/WebMCP context |
| WAI-ARIA Authoring Practices, Slider Pattern | Keyboard model and slider accessible-value semantics. citeturn0search0 |
| WCAG 2.2 Understanding 2.5.7, Dragging Movements | Requirement for non-drag single-pointer alternatives. citeturn1search0 |
| WCAG 2.2 Understanding 2.5.8, Target Size (Minimum) | 24×24 CSS-pixel minimum/spacing framework. citeturn1search1 |
| WCAG guidance on status messages | Non-focus-moving announcement of application status. citeturn1search6 |
| USWDS Range Slider guidance/testing | Range versus precision-input guidance and modern manual accessibility test expectations. citeturn2search1turn2search2 |
| GOV.UK text/number-input guidance | Rationale for controlled whole-number text entry with numeric input hints. citeturn2search4turn2search0 |
| W3C reduced-motion technique | `prefers-reduced-motion` treatment for interaction motion. citeturn10search3 |
| Wiens, Lohmann & Auer, *Semantic Zooming for Ontology Graph Visualizations*, K-CAP 2017 | Ontology-specific motivation for progressive detail and preserved context. citeturn4search14 |
| De Luca et al., multi-level interactive graph visualisation | Persistence/nested-detail principle for graph levels. citeturn3academia36 |
| Archambault/Purchase mental-map research and review literature | Evidence, with caveats, for retaining graph spatial continuity. citeturn3search7turn3search9 |
| Brandes, *A Faster Algorithm for Betweenness Centrality* | Complexity evidence against recomputing expensive global centrality for an interactive count control. citeturn5search0 |
| [OWLAPI project](https://github.com/owlcs/owlapi) | Parser/model-layer reference; no change is expected for the proposed post-projection selector |
| [Gene Ontology ontology downloads](https://geneontology.org/docs/download-ontology/) | Recommended independently sourced large public ontology for implementation-stage benchmarking |
| [EDM Council FIBO](https://github.com/edmcouncil/fibo) | Recommended modular/import-rich public OWL corpus for implementation-stage benchmarking |

Two categories remain deliberately unresolved rather than being disguised as settled research.

First, **the exact component-fairness weighting is a product-policy hypothesis**. Connected expansion itself has clear behavioural advantages for a progressive exact selector, but \(\sqrt{|C|}\), logarithmic weighting and equal-component fairness embody different judgements about how rapidly small disconnected regions ought to appear. The implementation should put this policy behind a deterministic ranking-policy version and settle it with the proposed counterexample corpus plus usability evaluation. Changing it later changes shared count-to-node membership, so once count-based share links are public, ranking-policy versioning becomes worth considering.

Second, the proposed performance budgets are **acceptance targets, not benchmark results**. No claim is made here that the current renderer can rank 20,000 nodes or settle a 500-node force layout inside those thresholds. Those figures are meant to turn “must be fast” into an executable benchmark programme.

The central recommendation does not depend on either open issue: **WebVOWL should move from “choose a degree threshold and accept however many nodes remain” to “compute one deterministic, topology-aware ordering and let the user choose exactly how many nodes of that ordering are visible.”** That directly satisfies the brief's exactness, nested-subset, determinism and all-at-maximum requirements while fitting the current canonical projection, visibility, placement and controller architecture rather than fighting it.