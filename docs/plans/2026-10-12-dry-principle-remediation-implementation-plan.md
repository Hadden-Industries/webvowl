# WebVOWL DRY remediation implementation plan

Date: 2026-10-12.
Status: **SLICE-001 through SLICE-006 implemented and reviewed; final qualification is reported by the signed-candidate HISEW handoff**.

## 1. Outcome and recommended approach

Give each materially shared rule one authoritative owner, so that a maintainer can change that rule without finding and synchronizing several implementations.
Start with the three opportunities identified at the end of thread `01a127c8-99dd-7d12-ba19-5aa9b666244a`, titled **owlapi: Implement DRY plan**: namespace declarations, drag-handle presentation, and numeric range controls.
Its final WebVOWL assessment was directional and explicitly limited; it was not a complete repository audit or implementation approval.
This plan validates those directions against the current WebVOWL checkout and turns them into bounded implementation slices.

The recommended design is to reuse VOWL's existing namespace export, extract renderer-local drag-handle presentation, and share native range-control binding between the gravity and configuration menus.
Keep ontology meaning in the canonical model and controller, geometry in the individual draggers, and controller-state presentation in its existing adapter.
Use current dependencies and native browser behavior rather than adding a utility library or a new framework.

DRY concerns repeated knowledge and reasons for change, not a target percentage of matching lines.
Text that looks alike can represent different rules; independent expected test results must remain independent.
This interpretation follows the authors' [DRY discussion](https://media.pragprog.com/titles/tpp20/dry.pdf).
Explicit contextual meanings also matter: a shared spelling does not require a universal model, as explained in [Bounded Context](https://martinfowler.com/bliki/BoundedContext.html).

Success is measurable:

- The audited standard namespace identities come from one existing authority, with explicit, tested contextual derivations.
- All three draggers use one implementation of the agreed SVG construction and visibility rules.
- Both menus use one implementation of numeric range initialization, input validation and wheel handling.
- Existing rendering, editing, reset, export and human/agent action contracts remain intact, except for the specifically proposed wheel corrections in DEC-005.
- No new dependency cycle, package dependency, compatibility shim, configuration requirement or shared mutable ontology state is introduced.

This is a maintainability improvement.
No startup, rendering-speed, bundle-size or exhaustive repository-wide DRY improvement is claimed before measurement.

## 2. Authority, baseline and implementation entry conditions

### 2.1 Planning authority

The authorized work is source inspection and creation of this plan in `docs/plans`.
REQ, AC, QA, DEC and SLICE identifiers below are draft proposals for owner acceptance; they are not an accepted HISEW requirement baseline.
The proposed implementation risk route is **R2**, because shared vocabulary, editor presentation and browser input behavior have multiple consumers and observable failure modes.
Creating this document is a documentation-only action, distinct from executing that implementation route.

[Repository instructions](../../AGENTS.md) require exact approval for configuration changes and separate authority for commits and pushes.
The implementation described here requires **no configuration changes as its starting design**.
The referenced OwlAPI thread's commit, push and configuration approvals belong to that task and do not transfer to WebVOWL.
This document neither changes configuration nor starts an execution, adopts another task's work, commits, publishes or deploys anything.

HISEW inspection on 2026-10-12 reported active personal applicability and an admitted worktree.
The installed planning procedure was selected for this draft.
`focused`, `affected` and `full` verification profiles were visible, but their command-input ordering was reported as unknown; their names are not coverage evidence.
No native execution or verification receipt is claimed.
Before implementation, accept or revise the draft requirements, route and consequential decisions below, then inspect the current profile commands and bind the appropriate execution to the actual session.
Use the installed capability resolver for any subsequently authorized code review, security review or commit operation; discovery alone does not authorize one.

### 2.2 Source baseline

| Observation                         | Value at inspection                                                                        |
| ----------------------------------- | ------------------------------------------------------------------------------------------ |
| Checkout                            | `C:/Users/maksy/GitHub/webvowl`                                                            |
| Branch                              | `main`                                                                                     |
| HEAD                                | `81083b510344141f35d2f8551132a0266ad70103`                                                 |
| Committed tree                      | `92198a02bc1f55f8c2d8f1c10a627b4fac11a2a9`                                                 |
| Index                               | No staged paths                                                                            |
| Source format                       | Native ESM; root and VOWL package manifests declare `type: module`                         |
| Existing tools                      | D3, Jest, dependency-cruiser, Markdown Quality, and the repository's affected-test tooling |
| Test environment                    | Jest uses Node and defaults to two workers                                                 |
| Browser policy                      | Root manifest selects Baseline Widely Available                                            |
| Verification performed for planning | Source, contract, test and tooling inspection; no product suite or browser qualification   |

The working-tree contents, including pre-existing edits, are the authoritative planning input; HEAD alone is not the inspected source snapshot.
Seven paths were already modified:

- `src/app/css/toolstyle.css`
- `src/app/js/controller/canonicalWebVowlController.js`
- `src/app/js/controller/canonicalWebVowlController.test.js`
- `src/app/js/menu/searchMenu.js`
- `src/app/js/menu/searchMenu.test.js`
- `src/app/js/ui/nodesShownControl.js`
- `src/app/js/ui/nodesShownControl.test.js`

Preserve these changes and recheck their current owners and contents at implementation kickoff.
Do not stage, restore, reset, stash, move or absorb them merely to obtain a clean baseline.
If an implementation slice needs one of these files, agree its exact interaction with the existing work before editing it.
Recheck HEAD, tree, index, remote state when relevant to delivery, and concurrent work before selecting the implementation baseline; this document makes no claim about live remote alignment.

### 2.3 Existing decisions that constrain the design

- [ADR 0010](../adr/0010-rendered-graph-is-a-projection-not-the-store.md): ontology facts belong to the application/model; a rendered graph is a projection.
- [ADR 0011](../adr/0011-a-test-double-must-behave-like-its-subject.md): a test double must reproduce the behavior relied upon or identify its limitation and obtain behavioral evidence elsewhere.
- [ADR 0012](../adr/0012-human-and-agent-visualization-action-parity.md): human and agent visualization actions use the same controller contract; reset is one operation, with menus presenting its resulting state.

Use current source and these accepted ownership rules when older planning documents describe retired modules.
The earlier CommonJS-to-ESM plan is historical context, not a migration to repeat: this checkout already uses ESM.

## 3. Scope and exclusions

The bounded inventory covers authored runtime consumers of the three identified rule families, their direct integration seams, and the tests needed to prove those seams.
Follow each affected rule to its latest consumers, including cross-package and renderer consumers, before concluding that consolidation is complete.
Any further duplication discovered is recorded with its owner and impact; it joins this plan only when it is the same affected rule, not simply nearby code.

Included work:

- Consolidate standard namespace bases in sidebar, editor/controller and renderer code through the existing `vowl` export; preserve contextual prefix selection and spellings.
- Extract SVG group/line/path/accuracy-target construction and guarded visibility shared by domain, range and class draggers.
- Extract the numeric range-control behavior shared by two force-distance controls and the maximum-label-width control.
- Add focused contract/regression tests where coverage is missing, update dependent test linkers, and remove obsolete in-scope copies after all consumers migrate.
- Document the resulting ownership and deliberate separations in this plan or the nearest existing maintained developer documentation.

Excluded work:

- Repository-wide clone elimination, speculative base classes, a general UI framework, or a new duplication scanner/CI threshold.
- Replacing the model, widening WebMCP editing, changing canonical bytes or identifiers, or redesigning editor validation.
- Unifying domain/range/class geometry, property-edit rules, user namespace resolution, arbitrary IRI parsing, or every numeric control.
- Refactoring search, node-count controls, zoom, animation, worker budgets, serializers or unrelated tooling merely because some syntax resembles these candidates.
- Regenerating schemas, historical reports, conformance fixtures, reference outputs, presets, dependency locks or generated bundles as a deduplication exercise.
- Dependency upgrades, package-export changes, build/lint/test/CI policy changes, deployment and external publication.

## 4. Current evidence and shared-rule ownership

The following source references name current files and symbols, not predicted future line numbers.
The owner roles are responsibilities for implementation and review; no person or separate agent has been assigned by this draft.

| Rule or observation                                   | Current evidence and consumers                                                                                                                                                                                                                                                                                                    | Recommended owner and treatment                                                                                                                                                        |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Standard namespace bases                              | `packages/vowl/src/profiles.js` exports frozen `namespaces`; `packages/vowl/src/index.js` already exposes it through `vowl`. `sidebar.js` repeats seven annotation prefixes.                                                                                                                                                      | VOWL vocabulary owner. Reuse that export; add `skos` and `dcterms` there as source declarations, retaining sidebar's explicit supported-prefix subset.                                 |
| Standard full term IRIs                               | `OwlThing.js`, `OwlNothing.js`, `RdfsLiteral.js`, `RdfsSubClassOf.js`, `canonicalRenderElements.js`, `renderedGraphInternals.js`, `canonicalVowlEditorCommands.js`, `canonicalVowlEditorView.js`, `canonicalVowlRenderProjection.js`, `canonicalCreationDialog.js`, and `canonicalInputSelection.js` contain applicable literals. | Derive namespace bases from `namespaces`; retain local semantic term selection. Do not create a catalogue of every OWL term just to replace short concatenations.                      |
| Editor default prefixes                               | `src/shared/js/ontologyEditorVocabulary.js` already derives defaults from `namespaces`. Its `dc` value deliberately appends `#`. `packages/vowl/src/migrate/artifact.js` retains the legacy `dc` spelling and a literal XML namespace.                                                                                            | Editor and migration owners retain their different contracts. Derive unchanged bytes locally from package-owned bases where appropriate; do not import application defaults into VOWL. |
| Sidebar fallback versus supplied annotation namespace | `sidebar.js:listAnnotations` gives `predicateNs` precedence, otherwise expands only known prefixes and keeps unknown identifiers as text.                                                                                                                                                                                         | Sidebar presentation owns precedence and supported prefixes. Vocabulary owns the namespace strings. Keep these responsibilities separate.                                              |
| Dragger construction and visibility                   | `domainDragger.js`, `rangeDragger.js`, `classDragger.js`: `svgRoot`, `svgPathLayer`, `drawNode`, `hideDragger`.                                                                                                                                                                                                                   | Renderer owner; one renderer-local presentation module. Shape data and interaction-specific choices remain with each dragger.                                                          |
| Dragger geometry and edits                            | Endpoint intersection/orientation, loop offsets, `updateDomain`, `updateRange`, `setParentNode`, and `setPosition` differ.                                                                                                                                                                                                        | Individual draggers and existing controller edit path; intentional separation.                                                                                                         |
| Dragger integration                                   | `runtime/renderedGraphInternals.js` initializes and uses the draggers, reads their selection fields, installs some handlers, and calls `updateDraggerElements`.                                                                                                                                                                   | Renderer runtime remains the composition owner. Inventory field access and listener replacement before changing the shared view.                                                       |
| Numeric input mechanics                               | `gravityMenu.js:addDistanceSlider` and `configMenu.js:addLabelWidthSlider` repeat initialization, finite-positive input checks, labels, and wheel steps.                                                                                                                                                                          | Application UI owner; a small native range-control module used by both menus.                                                                                                          |
| Command meaning and UI feedback                       | Menus call `setForceLayoutDistances` or `setVisualizationModes` through `runVisualizationControlAction`.                                                                                                                                                                                                                          | Menus retain command mapping; the existing action module retains cancellation/error feedback.                                                                                          |
| Authoritative presentation and reset                  | `visualizationViewControlsAdapter.js` observes controller state, updates range values/labels/disabled state; `resetMenu.js` calls `resetVisualization`.                                                                                                                                                                           | Existing controller and state adapter. The new binder must not become a second state store or reset engine.                                                                            |
| Existing successful consolidation                     | `visualizationDefaults.js`, `ontologyEditorVocabulary.js`, VOWL canonical JSON and resource budgets, and worker-operation policy are already shared.                                                                                                                                                                              | Reuse their current authorities; do not extract parallel alternatives.                                                                                                                 |

### 4.1 Namespace distinctions that must survive

The standard DC elements base is `http://purl.org/dc/elements/1.1/`.
The editor/migration default currently uses `http://purl.org/dc/elements/1.1/#`.
DC Terms is `http://purl.org/dc/terms/`.
These are different exact IRIs; the migration's legacy spelling is not an invitation to normalize data.
Tests must preserve all three independently expected strings.

Keep sidebar prefix membership explicit: importing the namespace catalogue must not automatically make `svg`, `xml`, `mapping` or every future entry an annotation-prefix fallback.
Keep explicit `predicateNs` precedence, unknown-prefix behavior, case sensitivity and local names containing additional colons unchanged.
Do not reuse `prefixRepresentationModule` or `parser.js:replaceNamespace` indiscriminately: they handle other input contracts and user-supplied mappings.

### 4.2 Dragger differences that must survive

- Each dragger has a different SVG path.
  Domain and range accuracy targets are conditional on `useAccuracyHelper`; class currently creates a circle unconditionally and configures it conditionally.
- Domain and range use different endpoint geometry and offsets; range also has loop-specific adjustments.
  Class placement depends on its parent node's shape/radius.
- Domain/range `mouseUp` clear the hover class; class `mouseUp` currently does not.
  Extracting a common mouse state machine would therefore be a behavior change.
- Runtime code accesses `nodeElement`, `draggerObject`, `rootNodeLayer` and other fields, and can replace mouse handlers.
  These are real consumers, even if renderer-internal.
- `svgRoot` can be called before drawing and again in class-hover handling.
  Capturing an old root or changing event-installation order can break reparenting and hover behavior.
- Guarded `hideDragger` coexists with older unguarded `hide_dragger`/`hideClass_dragger` methods.
  Remove the latter only after current executable consumer discovery proves they are unused.

The first extraction therefore shares presentation primitives, not endpoint calculations, edit validation or the entire interaction state machine.
Characterize accuracy-helper-disabled behavior before redesigning optional selections; existing unguarded consumers may reveal a pre-existing defect.
Do not silently broaden this refactor into a repair of all experimental editor behavior.

### 4.3 Range-control behavior and current gaps

Current markup uses native range inputs:

| Control             | Minimum | Maximum | Step | Runtime initial value source                           | Command                                           |
| ------------------- | ------- | ------- | ---- | ------------------------------------------------------ | ------------------------------------------------- |
| Class distance      | 10      | 600     | 10   | `classDistancePx`, ultimately shared force defaults    | `setForceLayoutDistances({ classDistancePx })`    |
| Datatype distance   | 10      | 600     | 10   | `datatypeDistancePx`, ultimately shared force defaults | `setForceLayoutDistances({ datatypeDistancePx })` |
| Maximum label width | 20      | 600     | 10   | `maxLabelWidthPx`, ultimately shared mode defaults     | `setVisualizationModes({ maxLabelWidthPx })`      |

The width markup starts at 80, while the current shared runtime default is 120.
The binder must preserve initialization from the passed runtime value; do not turn the HTML fallback into a competing runtime default or rewrite markup as incidental cleanup.

Gravity initializes the wheel offset to zero and rejects a non-number result.
The width handler leaves the offset undefined for a zero-delta event, then can assign an invalid computed value and emit `input`.
Only width explicitly ignores disabled controls.
Both handlers calculate a proposed change before the browser normalizes it, so a wheel event at an endpoint can still dispatch a request although the effective value did not change.
These are static findings; no browser reproduction was performed while writing this plan.

There are existing tests for modes, controller-state presentation, reset and visualization-action feedback, but the search found no dedicated `gravityMenu.test.js`, `configMenu.test.js` or dragger contract tests.
`sidebar.test.js` uses a strict VM module linker that currently rejects a new namespace import until updated.
Those are concrete implementation tasks, not evidence that existing tests already cover the refactor.

## 5. Requirements and acceptance criteria

| Requirement                                                               | Acceptance criterion                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| REQ-001: Consolidate shared knowledge according to meaning and ownership. | AC-001: Every in-scope rule has the authority, consumers, strategy and retained exceptions recorded in section 4; completion reports zero unexplained current copies within that inventory.                                           |
| REQ-002: Reuse namespace identities without changing ontology meaning.    | AC-002: All enumerated runtime consumers use the agreed authority; sidebar, editor and migration expected IRIs remain exact; canonical/export regression oracles remain unchanged.                                                    |
| REQ-003: Consolidate common drag-handle presentation.                     | AC-003: All three draggers use the shared construction/visibility implementation; integration demonstrates unchanged shape, geometry, hover, visibility, endpoint edits and selection ownership.                                      |
| REQ-004: Consolidate range-control mechanics with explicit edge behavior. | AC-004: Three inputs use one binder; command mapping, state feedback, default values and native keyboard behavior remain correct; DEC-005's accepted edge decisions pass real-browser checks.                                         |
| REQ-005: Preserve architectural and lifecycle contracts.                  | AC-005: Existing architecture checks pass; there is no renderer-to-application import inversion, extra model store, feedback request during state presentation, duplicate listener or post-disposal callback in supported lifecycles. |
| REQ-006: Preserve meaningful independent evidence.                        | AC-006: Expectations are not computed from the new implementation; current package/conformance and relevant UI/runtime regressions pass; mocked limitations have explicit browser coverage.                                           |
| REQ-007: Keep scope, authority and delivery proportionate.                | AC-007: Unrelated files remain preserved; no unapproved configuration/publication action occurs; final evidence distinguishes source checks, native receipts, browser results and any later hosted/deployment evidence.               |

## 6. Design decisions and seams

All decisions in this section are proposed for acceptance with implementation scope.
New filenames and interface details are predictions; preserve the responsibilities if local inspection supports a better precise name.

### DEC-001: Keep namespace ownership inside the existing VOWL package

Use the already supported `import { namespaces } from "vowl"` route for application and renderer consumers; VOWL internals continue using relative imports inside their own package.
Add the two missing standard bases, `skos` and `dcterms`, to the frozen declaration in `profiles.js`.
Keep `profiles` and its public re-export structure otherwise intact.
Derive local full IRIs from those bases where the term is a local domain choice.
Only introduce a named shared full-term declaration if the consumer inventory demonstrates one additional shared semantic rule, not merely repeated string concatenation.

Do not place package authority under `src/shared` and make VOWL depend on its application.
Do not deep-import unexported package files from application code or create a new barrel/export subpath merely for convenience.
The package root currently performs model-registration work; existing consumers already use it, but changed import timing and bundle closure still need verification.
If evidence shows a new import causes unacceptable eager loading, re-plan that seam before adding an export/configuration change.

### DEC-002: Keep prefix policy contextual

The sidebar owns a named, immutable seven-prefix fallback table whose values are selected from `namespaces`.
Editor defaults remain in `ontologyEditorVocabulary.js`; protected-prefix rules remain with `ontologyEditorPrefixes.js`.
Migration retains its pinned-dialect contract and derives exact legacy strings locally where appropriate.
Do not share a mutable prefix map or make all these consumers use the same prefix membership.

### DEC-003: Share a renderer-local drag-handle view through composition

Proposed module: `src/webvowl/js/dragHandleView.js`.
Its interface accepts renderer selections, the caller's path data and explicit accuracy-target construction choices, and provides the created selections plus the common guarded visibility operation.
It owns shared SVG classes, the line's initial attributes and the agreed accuracy-target presentation.
It has no ontology, controller, menu, network or application-registry dependency.

Keep the existing dragger factories and their runtime-facing interfaces.
Populate existing selection fields from the shared view's actual selections; do not maintain a second independently mutable representation.
Preserve current group lifetime and ordering, including calls that occur before drawing or after a root changes.
Pass drawing choices explicitly instead of switching on a broad `domain`/`range`/`class` mode inside a universal dragger class.
Do not move mathematical geometry or edit checks into the new module.

Leave the mouse state transitions and externally overridden handlers in their current owners for this implementation.
D3 replaces a listener registered for the same event typename; adding namespaced listeners can change that replacement behavior, so it is not automatically a neutral cleanup.
[D3 event documentation](https://d3js.org/d3-selection/events).
Any later event extraction must demonstrate equivalent handler ownership, not merely similar callback text.

### DEC-004: Share a native range-control binder, not visualization state

Proposed module: `src/app/js/ui/numericRangeControl.js`.
The interface accepts the existing input and value-label elements, the passed initial value, and a callback for a valid requested number.
Use the smallest cleanup handle needed by the actual menu lifecycle; no global registry or independently subscribed state store.
If an existing lifecycle signal can be supplied coherently, use it; otherwise retain and invoke the returned listener disposer before rebinding.
Do not add an unused disposal API without a caller.

The binder owns initialization, the local value label, input normalization/validation and wheel mechanics.
Menus own element lookup and the mapping to their existing controller commands.
`runVisualizationControlAction` remains the single existing owner for asynchronous error/cancellation feedback.
`visualizationViewControlsAdapter` remains responsible for displaying authoritative controller state, including reset, agent actions, loaded views and disabled width state.

Keep native `<input type="range">`, labels, focus and keyboard semantics.
Read the browser-normalized value and use native stepping rather than maintaining another clamp/step algorithm; the HTML specification defines range normalization and stepping. [HTML input standard](<https://html.spec.whatwg.org/multipage/input.html#range-state-(type=range)>).
Current `min`, `max` and `step` remain in the markup, while business validation still executes at the controller/model seam for every caller.
Sharing UI validation must not remove controller validation or impose browser-only limits on WebMCP callers.

### DEC-005: Resolve wheel differences explicitly

The recommended accepted contract is below.
The changes from current edge behavior are part of the proposed implementation decision, not something to slip into a supposedly exact refactor.

| Stimulus                                           | Proposed result                                                                                                          |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Ordinary valid `input`                             | Present the current numeric value and make one existing menu-specific request.                                           |
| Invalid/non-finite/non-positive observed input     | Make no controller request; retain the existing finite-positive contract.                                                |
| Negative vertical wheel delta on an enabled input  | Increase by one native step; request once only if the effective value changes.                                           |
| Positive vertical wheel delta on an enabled input  | Decrease by one native step; request once only if the effective value changes.                                           |
| Disabled input                                     | Ignore wheel interaction and do not cancel page scrolling.                                                               |
| Zero, horizontal-only or non-finite vertical delta | Do not alter the value or issue a request; do not cancel the event.                                                      |
| Enabled vertical wheel at a bound                  | Keep the effective value and issue no redundant request; retain wheel capture while interacting with the enabled slider. |
| Controller-state presentation                      | Update controls through the existing adapter without emitting input events or requests back to the controller.           |
| Application reset                                  | One `resetVisualization` operation; resulting state updates the controls.                                                |

Use an explicitly non-passive wheel listener where cancellation is required and test cancelable and non-cancelable events; wheel-event cancellation has browser constraints.
[MDN wheel-event documentation](https://developer.mozilla.org/en-US/docs/Web/API/Element/wheel_event).
Preserve current wheel direction, normal step size and command semantics; do not add unrelated modifier-key, scrolling or zoom policies.
Inventory existing input listeners before choosing whether a wheel change invokes a shared handler or dispatches the existing synthetic input event; prove one effective request either way.

The existing `gravityMenu.reset` helper dispatches synthetic inputs, but current `resetMenu.js` uses the controller reset and source search found no call to that gravity helper.
Confirm reachability before removing the unused helper; do not reconnect it as an alternative application reset path.

### DEC-006: Keep contextual duplication and independent oracles

Retain separate drag geometry, prefix selection, controller business validation and test expectations.
Share neutral fixture setup only when it does not calculate the expected answer.
Do not rewrite historical/conformance expected data to import the same namespace constants as production.
Keep the original accepted bytes so a wrong shared namespace or term remains detectable.

### DEC-007: Reuse the current module/test/tooling system

Stay on native ESM, the current D3/Jest stack and existing graph/affected-test tools.
Do not install jsdom, a clone detector, a mutation-testing framework, a new UI package or another test runner for this work.
Use the current DOM-capable test facilities for what they can prove and visible browser checks for native range semantics, SVG hit-testing and rendered interactions.
This is internal reuse for a refactor; no new external software selection is proposed.

### DEC-008: Complete one candidate before broad review

Use focused checks while developing each slice, then consolidate the bounded change for broad review.
Follow up on findings with narrow reviews of the affected changes; reserve any authorized external review for the final candidate.
Run the selected final verification once on that candidate and repeat only when changed inputs, a failure or a concrete unresolved concern requires it.
Do not infer permission for delegation, scans, commits or publication from this review cadence.

## 7. Implementation slices

One implementer owns integration across the slices by default.
The namespace, drag-view and range-control seams are technically independent after the baseline, but this draft grants no delegation authority.
Keep domain/range and class work ordered because they share the same new view.
Each slice includes its own consumer migration and proof; do not defer all tests to the final slice.

### SLICE-001: Establish the accepted rule inventory and behavioral baseline

**Purpose:** make the intended preserved behavior and edge corrections falsifiable before extracting anything.

1. Accept or revise the draft route, requirements and DEC-005; record the selected source snapshot and the disposition of existing edits.
2. Refresh the current source/test consumer inventory for `namespaces`, the three dragger factories and selection fields, and the three slider IDs.
   Separate executable consumers from comments, examples, generated artifacts and expected fixtures.
3. Use existing dependency-cruiser tooling to inspect dependency direction and the package-root closure.
   Capture baseline checks appropriate to the affected areas; do not assume old plans or a profile named `full` prove coverage.
4. Add characterization tests through existing menu, sidebar, dragger and controller interfaces where the current suite has gaps.
   Add one real-browser observation for wheel edge behavior and one representative editor interaction before choosing test-double behavior.
5. Classify pre-existing failures.
   A demonstrated old failure is not silently relabeled a new contract; a failure that prevents equivalence proof needs a specific disposition before the affected extraction proceeds.

**Likely files:** new `gravityMenu.test.js`, `configMenu.test.js`, dragger tests, and targeted additions to `sidebar.test.js`; no production/configuration edits are required for characterization alone.

**Proof:** named baseline cases fail when the relevant observable contract is violated; the selected baseline and independent expected strings/geometry are recorded.
**Exit:** no unresolved meaning or test-oracle question prevents SLICE-002, SLICE-003 or SLICE-005.
**Recovery:** retain the evidence and reverse only task-owned test edits if the approach is abandoned.

### SLICE-002: Consolidate namespace identity from annotation display through editing and rendering

**Purpose:** a namespace identity change has one current declaration while contextual behaviors retain their owners.

1. Add `skos`/`dcterms` to the existing frozen namespace declaration; retain the existing public export and import direction.
2. Replace sidebar's literal values with the explicit seven-prefix selection.
   Preserve supplied namespace precedence and unknown-prefix rendering.
3. Migrate the inventoried standard-base literals in editor/controller, creation/input UI, renderer built-ins and canonical render projection.
   Reuse existing local constants where present instead of adding a competing vocabulary module.
4. Where the inventory reaches `migrate/artifact.js` or `refinedRdf.js`, derive the same exact base/term from the package-local authority.
   Preserve migration `dc` bytes and all published profile identifiers.
5. Update the sidebar VM linker and any affected fixtures to load actual changed dependencies.
   Keep expected IRIs literal and independent; do not mock an empty namespace module just to satisfy linking.
6. Remove the obsolete in-scope runtime declarations and classify every remaining relevant literal as local semantic choice, independent oracle, immutable artifact or justified separate context.

**Likely files:** `packages/vowl/src/profiles.js`; the current consumers in section 4; their tests.
No package manifest or lockfile change is planned.

**Proof:** AC-001/002; annotations expand identically, metadata edits use the same predicate/datatype IRIs, rendered built-ins retain their types and export/conformance bytes stay unchanged.
Check dependency direction and production bundle linking after the new imports.
**Exit:** no unexplained duplicate standard base remains in the agreed runtime inventory; all preserved spelling exceptions have tests.
**Recovery:** revert the complete task-owned producer/consumer slice together if necessary; never activate mismatched declarations and consumers.

### SLICE-003: Share domain/range drag-handle construction and visibility

**Purpose:** prove the shared view with two closely related real consumers before adapting class dragging.

1. Characterize mount order, SVG structure/classes, hidden states, the accuracy circle, selection identities and group reordering for domain and range handles.
2. Introduce `dragHandleView.js` and migrate construction/visibility in both draggers together.
   Retain the existing path data, endpoint checks, geometry and interaction callbacks in their current files.
3. Trace runtime accesses to returned selections.
   Preserve the runtime-facing fields from the actual view objects rather than copying values into another state model.
4. Preserve no-op/guard behavior before drawing and repeated visibility calls.
   Investigate accuracy-helper-disabled failures separately rather than adding fabricated selections to hide them.
5. Remove construction/visibility copies only once both consumers use the new owner.

**Likely files:** new view and its tests, `domainDragger.js`, `rangeDragger.js`, dedicated contract tests, and minimal `renderedGraphInternals.js` adaptations if current consumers require them.

**Proof:** AC-003/005; both property endpoints can be dragged, hidden and shown, while validation rejection, duplicate prevention, inverse properties, loops and edit requests match their characterized behavior.
**Exit:** domain/range share presentation without a role-dependent geometry algorithm or new application dependency.
**Recovery:** remove the shared view only after reversing its task-owned consumer migrations; preserve the model and unrelated editor work.

### SLICE-004: Integrate class dragging and complete renderer presentation ownership

**Purpose:** qualify the third, less uniform consumer without over-generalizing the view.

1. Preserve class-specific path data, unconditional circle creation, mouse-up behavior, parent-radius placement and the existing class-hover root sequence.
2. Route only its shared construction/visibility through the view; retain class-specific geometry and event handlers.
3. Exercise runtime-installed handlers and accuracy-object updates with all three draggers present.
   Verify one shared implementation does not make their transient state shared.
4. Confirm old unguarded visibility methods and no-op helpers have no executable consumers before removing any.
   Do not keep replacement aliases or rename runtime methods solely for style.
5. Inspect current comments and names touched by the extraction; remove obsolete copied implementation commentary and keep the new responsibility precise.

**Likely files:** `classDragger.js`, its tests, shared-view tests and narrowly affected runtime tests.

**Proof:** all three handle shapes and selection lifetimes are correct; hover/z-order, mouse/touch selection, edit completion and failed edits remain independent; ordinary ontology rendering still works.
**Exit:** AC-003 is satisfied for all three consumers, with no second common construction/visibility recipe.
**Recovery:** reverse the class slice without disturbing a separately verified domain/range slice if their shared interface has remained compatible; otherwise reverse the coherent renderer change as a unit.

### SLICE-005: Share numeric range controls and retain controller-owned state

**Purpose:** one implementation handles the three native inputs while each menu preserves its domain request.

1. Add the proposed binder with actual DOM elements and callback injection.
   Use existing passed defaults, native value/step behavior and a supported listener lifetime.
2. Migrate both gravity sliders and the width slider in the same slice, applying the accepted DEC-005 contract.
   Do not leave one menu on the old wheel policy.
3. Keep command mapping in each menu and feedback in `runVisualizationControlAction`.
   Do not bypass these paths or calculate force charge/label transitions in the binder.
4. Verify `modeMenu` and `visualizationViewControlsAdapter` still control width enablement/presentation coherently.
   Do not remove the immediate mode feedback without evidence that its timing is redundant.
5. Prove controller-originated updates and reset update controls without emitting another request.
   Confirm and remove the unused gravity reset helper only if the consumer inventory supports doing so.
6. Ensure re-binding in the supported menu lifecycle disposes the previous binding; do not introduce a global application-lifecycle redesign.

**Likely files:** new binder/test, `gravityMenu.js`/test, `configMenu.js`/test; targeted existing mode/state-adapter/reset tests.
`app.js` changes are limited to any genuinely needed lifecycle plumbing.
`src/index.html` is a behavior reference; its numeric bounds and fallback defaults are not changed by this design.

**Proof:** AC-004/005; user input and wheel changes reach the correct controller method exactly once; rejected/aborted actions retain existing feedback; agent/state/reset updates do not loop back; keyboard, focus, disabled handling and actual browser range normalization are checked.
**Exit:** one binder implementation serves all three inputs and the agreed wheel differences are recorded as deliberate changes.
**Recovery:** reverse the binder and both menu migrations together to avoid mixed input policies.

### SLICE-006: Verify the integrated candidate and finish the ownership handoff

**Purpose:** demonstrate that the extractions reduce maintenance duplication without breaking the application or its contracts.

1. Repeat the scoped consumer search and dependency comparison; classify residual duplicates and confirm no dead copies, aliases or second state owners remain.
2. Run the impacted regression inventory, selected final HISEW verification profile, production bundle/lazy-chunk checks and the browser matrix below on the identified candidate.
3. Review the consolidated change against requirements, exact IRIs, interface depth, dependency direction, test independence and byte-sensitive artifacts.
   Address findings with focused rechecks.
4. Update this plan's evidence/status and the nearest existing developer reference with final owner paths and intentional separations.
   Do not rewrite accepted ADRs or repository policy as incidental documentation cleanup.
5. If commit/publication is later authorized, include only approved task paths, follow the required signed-commit procedure, and distinguish hosted checks from local evidence.
   No deployment is required to finish this source refactor.

**Proof:** all acceptance criteria have evidence or an explicitly unresolved status; no result is inferred from discovery, old runs, a profile name or unobserved hosted/deployed behavior.
**Exit:** source delivery is ready for the separately authorized publication/release decision.
**Cleanup:** remove only task-owned temporary probes and outputs after recording necessary evidence; keep historical fixtures, user changes and unrelated worktrees.

### Slice traceability and dependency order

| Slice     | Requirements / acceptance       | Quality / decisions             | Proof                                                              | Release and cleanup implication                                   |
| --------- | ------------------------------- | ------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------- |
| SLICE-001 | REQ-001/006/007; AC-001/006/007 | QA-001–008; DEC-006/007         | Accepted inventory, current baseline, independent characterization | No activation; preserve evidence and unrelated edits              |
| SLICE-002 | REQ-001/002/005; AC-001/002/005 | QA-001/002/007; DEC-001/002/006 | Exact IRIs, contextual prefixes, package/export regressions        | Namespace owner and all migrated consumers move together          |
| SLICE-003 | REQ-003/005/006; AC-003/005/006 | QA-003/004/007; DEC-003/006     | Domain/range structure, lifecycle and endpoint behavior            | Keep geometry local; remove only migrated copies                  |
| SLICE-004 | REQ-003/005/006; AC-003/005/006 | QA-003/004/007; DEC-003/006     | Three-consumer renderer integration and class exceptions           | Depends on SLICE-003; no common old/new view pair remains         |
| SLICE-005 | REQ-004/005/006; AC-004/005/006 | QA-005/006/007; DEC-004/005/007 | Native controls, one request, authoritative feedback and reset     | Both menus cut over together; remove unused reset only with proof |
| SLICE-006 | REQ-001–007; AC-001–007         | QA-001–008; DEC-008             | Final regression, architecture, browser and ownership review       | Record evidence, then use separately authorized delivery          |

Order: SLICE-001 precedes implementation; SLICE-003 precedes SLICE-004; SLICE-002, SLICE-004 and SLICE-005 precede SLICE-006.
Use vertical behavior paths within each slice, not separate repository-wide batches of constants, helpers, consumers and tests.

## 8. Quality scenarios and test-oracle ownership

| Scenario                          | Stimulus and observable acceptance                                                                                                                                                                        | Oracle / verification owner                                                                                                                   |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| QA-001: Namespace fidelity        | Display annotations with explicit namespaces, all seven known prefixes, unknown/mixed-case prefixes and multi-colon local names; exact labels/links and fallback behavior match the accepted baseline.    | Sidebar tests with independent literal expected strings; visible browser link check.                                                          |
| QA-002: Semantic/export stability | Create/edit representative OWL classes, literals, metadata and deprecation values, then inspect/export; term IRIs, accepted canonical bytes and migration fixtures remain unchanged.                      | Existing canonical editor, VOWL package/conformance and export oracles; no expected-output regeneration.                                      |
| QA-003: Handle presentation       | Construct each kind, hide/show it, hover/select it and redraw/reparent in actual supported order; correct SVG shape/classes and z-order remain, without duplicate nodes.                                  | Dragger/shared-view tests using actual D3 selection behavior where feasible; renderer/browser check for painting and hit-testing.             |
| QA-004: Edit isolation            | Drag a domain, a range and a class handle, including inverse/loop and rejected edits; correct existing commands and local geometry remain; one handle never changes another's pressed/hover/parent state. | Independent expected endpoint/command records, existing canonical editor/runtime tests and browser completion.                                |
| QA-005: Native range interaction  | Exercise each slider with keyboard, normal wheel, zero/non-finite delta, bounds and width disabled; observe DEC-005's value, request count and scrolling decisions.                                       | Browser-native controls are the normalization oracle; Node tests cover binding/dispatch, not invented browser mechanics.                      |
| QA-006: State and lifecycle       | Controller/agent changes, reset, abort/error feedback and supported rebind/disposal update UI once without feedback requests or stale listeners.                                                          | Existing state adapter, reset and action tests; controller contract and browser observation.                                                  |
| QA-007: Architecture and cost     | Build/import all changed consumers; no cycle or renderer/application inversion appears, no parser-loading boundary changes, and per-event/per-handle work stays bounded.                                  | Existing architecture tests, graph comparison, production linking/lazy-chunk check; measured browser/size comparison if a difference appears. |
| QA-008: Scope integrity           | Compare starting and final source changes; all pre-existing unrelated work remains and only approved task paths enter delivery.                                                                           | Implementation owner and final reviewer; Git diff plus recorded starting fingerprints.                                                        |

The implementation owner prepares characterization and migration evidence; the repository owner accepts semantic/edge-behavior decisions; the final reviewer assesses whether the evidence proves them.
Tests may share event/DOM fixture construction, but expected namespaces, endpoint roles, geometry examples and controller requests remain independent of the production helper.
For each extracted family, demonstrate at least one meaningful negative assertion: a wrong namespace, missing/wrong handle element, or duplicate/wrong slider request must fail the corresponding test.
Do not add a mutation framework or a broad scanner to achieve that check.

Mock only a genuine external seam or browser facility unavailable in the selected test environment.
Keep real code between a menu and its shared binder and between a dragger and its shared view.
`@xmldom/xmldom` and simplified EventTarget fixtures do not establish HTML range normalization, layout or pointer hit-testing; name that limitation where used.
Follow ADR 0011 instead of implementing a second browser range algorithm inside the test fixture.

## 9. Verification commands and evidence sequence

Commands below are known repository entry points, not statements that they ran during planning.
Run from the repository root, under the accepted implementation execution where native receipts are required.
Resolve the current external HISEW evidence destination before writing supplemental reports; do not assume historical `.sdlc/runtime` or `.sdlc/tmp` paths.

### Focused iteration

Use `npm test -- --runInBand --runTestsByPath` with the actual tests affected by the current slice.
The following existing files are the starting regression inventory; add the new menu/binder/dragger tests when those files exist:

- `src/app/js/sidebar.test.js`
- `src/shared/js/ontologyEditingState.test.js`
- `src/app/js/controller/canonicalVowlEditorCommands.test.js`
- `src/app/js/controller/canonicalVowlEditorView.test.js`
- `src/app/js/controller/canonicalVowlRenderProjection.test.js`
- `src/webvowl/js/parsing/canonicalRenderElements.test.js`
- `src/webvowl/js/runtime/d3RenderedGraphAdapter.test.js`
- `src/app/js/ui/visualizationViewControlsAdapter.test.js`
- `src/app/js/ui/visualizationControlAction.test.js`
- `src/app/js/menu/modeMenu.test.js`
- `src/app/js/menu/resetMenu.test.js`

Existing `npm run check:affected -- --list` can explain additional impacted tests.
Use `--base <accepted-full-commit-id>` and explicit `--path <repository-relative-path>` when needed by its supported interface, including newly created files.
Inspect the selection and its conservative fallbacks; it supplements rather than replaces the explicit architectural, browser and final checks.
`npm run graph:dependencies -- --output <new-external-directory>` produces the existing dependency views; use a newly allocated approved evidence path.
Do not create a new selection or graph implementation.

### Final integrated checks

1. Run the accepted HISEW final profile after inspecting its actual commands.
   Its evidence must cover the checks below, or identify precisely which required checks are supplemental/uncovered.
2. Run the repository's existing `npm run check` when selected by that profile: it includes lint, formatting, setup/Markdown probes, full Jest and the production bundle build. Do not immediately repeat its included full suite/build without changed inputs or a specific reason.
3. Ensure namespace changes receive VOWL package/conformance coverage (`npm run test:vowl` is the standalone entry point when that coverage has not already run in the full suite).
4. Include `src/productionGraph.architecture.test.js`, `src/renderedGraphDecoupling.architecture.test.js`, `src/owlapiConsumerBoundary.architecture.test.js`, `src/productionModuleFormat.architecture.test.js` and `src/productionBundle.integration.test.js` in the final evidence inventory.
5. Run `node util/verify-webvowl-lazy-parser-chunks.mjs` immediately after the final production build.
   `vite.config.mjs` retains output (`emptyOutDir: false`); do not use output timestamps alone to claim a fresh artifact or overwrite production evidence with a development build first.
6. Perform the visible-browser checks below and examine relevant console failures, request counts, rendered results and preserved exports.
7. Check the changed document with the installed Markdown Quality tool, and review `git diff --check` plus the final exact path set.

If a required profile is insufficient, name the exact coverage gap and propose the smallest specific configuration change for approval; do not silently modify the profile or call raw-command output a native verification receipt.
A pre-existing unrelated failure must be reported with its scope and effect on the requested acceptance, not repaired through an unauthorized configuration change.

### Visible-browser acceptance

Use a visible local browser against the identified built candidate and existing shipped/accepted fixtures.
Keep the graph visible while measuring interactions so hidden-tab scheduling does not invalidate observations.

- Load a representative preset, inspect built-in classes/literals and annotation links, and confirm no new loading/import error.
- Change each distance and label width with pointer, keyboard and wheel; cover both bounds, zero delta and disabled width, and compare displayed values to controller state.
- Change visualization state through the existing controller/agent seam, then reset; assert one reset operation and no feedback loop from presented values.
- Enter the existing editor flow; show/hide and drag class/domain/range handles, including a self-loop, inverse property and an invalid endpoint edit. Verify the accepted edit appears in inspection/export.
- Cover accuracy-helper enabled/disabled behavior according to the accepted baseline/disposition; verify hit areas and hidden objects through rendered interaction, not only DOM shape.
- Exercise repeat setup/redraw or remount only where the application actually supports it; verify no duplicate listeners, duplicated SVG handles or stale selections.

Run the normal interaction path in the available primary browser, then native range/wheel edge cases in available additional supported browser engines.
Record exact browser versions and any unavailable cross-engine coverage; one engine is not proof of all Baseline browsers.
Install or change browser/test tooling only with any required exact approval.

## 10. Deliberate separation and prevention of future drift

| Retained separation                                       | Reason and responsible owner                                                   | Proportionate drift control / revisit trigger                                                                                     |
| --------------------------------------------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| Sidebar, editor and migration prefix membership           | Different accepted context and dialect; their respective owners                | Exact-string/precedence tests; revisit only when the corresponding contract changes                                               |
| Domain/range/class geometry and edit rules                | Different endpoints, node shapes and state transitions; renderer/editor owners | Independent scenario tests; reconsider a smaller shared mathematical operation only if its contract is proven identical           |
| UI parsing versus controller/model validation             | Different trust and entry seams; UI and controller owners                      | Invalid requests remain rejected at every existing controller entry; sharing presentation does not remove enforcement             |
| Controller-state presentation versus user request binding | Read and write directions of one authoritative state; application owner        | No synthetic request during state updates/reset; verify agent and human paths                                                     |
| Expected fixtures versus production declarations          | Independent correctness evidence; test/conformance owner                       | Expected bytes stay fixed; a changed production rule must still fail old expectations until a separately accepted contract change |
| Historical/generated artifacts                            | Reproducibility and provenance; artifact owner                                 | Update through their accepted producer only when explicitly required, not by search/replace                                       |

Use existing architecture tests for material import/ownership constraints.
Do not impose a repository-wide literal ban, line-count target or clone percentage: those would penalize independent evidence and legitimate contextual code.
At final review, use the small rule inventory to show that one supported rule change no longer requires editing multiple implementations.
If a new helper starts acquiring unrelated mode switches, dependency inversions or a larger interface than the behavior it hides, reconsider its seam instead of adding more options.

## 11. Compatibility, migration, security and performance

This is an in-process source refactor with no intended persisted-data migration, backfill, canonical profile change or externally versioned interface change.
Do not add compatibility aliases, polyfills, version detection or old/new dual implementations.
Existing supported factory/method contracts are retained where consumers still need them; unused members are removed only with current reachability evidence.
At interruption, record the completed slice, exact source state, remaining consumers and last valid evidence before resuming.

Do not relax sidebar IRI navigation safety, text rendering, worker validation, cancellation or resource-budget enforcement.
A shared namespace table is data, not authority to treat untrusted identifiers as safe links or to render annotation text as HTML.
Keep existing validation at every reachable effectful entry point, even where a shared pure declaration is reused.
No new network service, telemetry channel or data collection is introduced.
Any review required by the accepted route must identify the actual review owner/provider and consent before running; a security scan is not implicitly part of this plan.

No performance gain is assumed.
Check for new eager imports and graph-size changes after namespace reuse, and avoid allocating fresh shared lookup tables per annotation or per event.
The drag view must keep work bounded by its small element set, and the binder must avoid unnecessary controller/render requests.
If bundle closure, event count, frame behavior or allocation visibly changes, measure against the same fixture/build/browser baseline and disposition the regression before release.
Choose an explicit performance acceptance bound before claiming a speed or size improvement; no arbitrary target is invented here.

## 12. Rollout, recovery and evidence handoff

There is no deployment action in the present task.
Each completed source slice can be reviewed locally; the integrated candidate is the default publication unit unless the owner explicitly selects separately verified slices.
Before any later release, the release owner names the observer, artifact identity, checks and recovery mechanism for the actual hosting environment.

Before activation, a failed slice is repaired or its task-owned patch is reversed coherently with its consumers.
Do not use Git restoration commands to discard current work; reverse only the precise task edits while preserving user-owned changes.
After activation, use the accepted release process for a forward fix or a previously verified artifact if that route is actually supported and authorized.
Do not claim that deployment rollback is available merely because this refactor has no data migration.

Abort activation for incorrect IRIs/export bytes, broken endpoint edits, missing/duplicated handles, feedback-loop requests, namespace import regressions or unmet required verification.
The implementation owner records the failing scenario and affected slice; the repository/release owner decides any material scope or activation change.
No unsupported fallback consumer is introduced to bypass the failure.

Final handoff records:

- Candidate commit/tree when available, or exact uncommitted source identity; retained unrelated paths and evidence applicability.
- Completed slice/REQ/AC/QA decisions and final owner paths.
- Exact checks, test inventories/results, browser versions and observed limitations.
- Any required native receipt and its source binding, separately from supplemental output or hosted CI.
- Residual deliberate duplication, deferred unrelated findings and the reason they remain separate.
- Actual commit/publication/deployment status, without treating one evidence class as another.

## 13. Unknowns, cheapest experiments and re-planning triggers

| Question                                                                | Cheapest discriminating experiment                                                                              | Decision and owner                                                                                                                         |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Do added namespace imports change startup/model-registration timing?    | Compare dependency closure and run production linking plus one actual startup before/after the namespace slice. | Prefer the existing public route; if it causes a material regression, repository owner accepts a revised seam and any exact export change. |
| Are all dragger selection fields and old visibility methods understood? | Search executable references, then trace one runtime mount/hover/edit and observe actual SVG identities.        | Renderer implementer narrows the extraction; unknown consumers block deleting/changing the affected field.                                 |
| Does accuracy-helper-disabled mode already fail?                        | Exercise each current dragger through its real update path with the option off before extraction.               | Repository owner dispositions a confirmed old defect separately; do not silently redefine behavior.                                        |
| Which wheel differences are approved corrections?                       | Reproduce zero-delta, disabled and endpoint behavior in a native input; compare with DEC-005.                   | Owner accepts DEC-005 with implementation scope or revises it before the slider slice.                                                     |
| Is the gravity reset helper unused in every supported entry path?       | Current import/call search plus app/reset/state-adapter integration tests.                                      | Application implementer removes only proved-unused code; controller reset remains authoritative.                                           |
| Do existing doubles express the needed browser behavior?                | Drive one real browser case and compare the double's contract, without adding a second clamp algorithm.         | Test owner narrows mock claims and assigns explicit browser checks.                                                                        |
| Do current final profiles cover all required evidence?                  | Inspect actual commands and map them to section 9 once at kickoff.                                              | Workflow owner accepts a sufficient existing profile/supplemental route or approves an exact necessary change.                             |

Re-plan the affected slice when concurrent edits change its contracts, a shared rule proves to have different meanings, a new mutable cross-layer dependency is required, a package-export/configuration change becomes necessary, expected canonical bytes change, unsupported compatibility becomes necessary, or equivalence cannot be proved with the available oracle.
Continue independent authorized work when one slice has a bounded unresolved issue; do not claim that blocked acceptance passed.
Reassess the higher-level outcome if maintaining an abstraction costs more than keeping the contextual implementations separate.

## 14. Completion criteria

- Draft requirements, R2 route and consequential decisions accepted for implementation.
- Current baseline and pre-existing change ownership recorded.
- Each of the three rule families has one agreed implementation/declaration owner and a complete current consumer inventory.
- Contextual prefixes, distinct geometry, controller validation and independent fixtures remain intact.
- Focused and final required verification passes on the identified candidate; browser limitations are explicit.
- No unapproved configuration change, new dependency, shim, duplicate state store or publication action.
- Consolidated review complete, findings resolved, and final ownership/evidence handoff recorded.

These criteria are evaluated in the final HISEW handoff and its operator evidence, after the signed source and this implementation record are settled. This document does not itself attest to a later verification receipt or hosted result.

## 15. Implementation record

The owner's 2026-10-13 instruction accepts this plan, its R2 route and DEC-005, authorizes task commits/messages/pushes and configuration changes required by the plan, and selects available local review agents. No configuration change is currently required.

HISEW execution: `e106f977-41cc-467b-a8d7-595718bb9eb8`; accepted snapshot: `f42ba088-d108-445f-9c1e-16a3ecdf0bf3`.
Implementation starts from `79ae9c33c7ce9600ab1f4931e91de164d07a0fbe`.
The seven previously modified paths in section 2.2 are now committed through PR #77; only this plan was untracked at kickoff. There are no unrelated working changes to absorb.

The first checkpoint includes the plan and characterization tests. Before extraction, 85 existing sidebar/editor-command/reset/state-adapter tests and 32 new dragger/menu cases passed. Native dependency capture found 565 modules and zero findings.
Chrome 155 on Windows reproduced the wheel differences in DEC-005: a zero-delta width event changes 200 to 310, bound events emit redundant requests, and disabled gravity inputs still change and cancel scrolling.

Actual D3 selections confirmed the three paths, selection identity and accuracy-target construction. With accuracy helpers disabled, existing domain/range update paths throw when dereferencing the absent circle; class updates pass. This pre-existing experimental-mode defect remains deferred outside the presentation extraction, with its original behavior preserved and its coverage limitation explicit. No fabricated circle or geometry repair is included.

The configured `full` profile runs `npm run check`: lint, formatting, Python/setup and Markdown probes, all Jest tests and production bundling. Dependency capture, lazy-chunk validation and native-browser cases supplement it. Final canonical verification follows authorized commits so HEAD/index changes do not require redundant full runs.

Operator evidence is retained under `C:/Users/maksy/.hi/w/e/operator/4c440b1b4b4b49e0b6f5828ce3013710`. HISEW capability discovery did not bind its ordinary reviewer to this active session; the owner's explicit local-review instruction supplies the task-scoped review route. The maintained committing-to-git procedure is loaded and used directly.

The first signed commit is `3de9605e30af571898bb6a8ac93b2d90c38c92e2`, containing this plan and baseline tests.

### Consolidated ownership and evidence

- `packages/vowl/src/profiles.js` owns all inventoried standard namespace bases, including SKOS and DC Terms. Application and renderer consumers use the existing public export; migration/refined RDF use package-local imports. Sidebar retains its seven-prefix subset, and editor/migration retain the exact legacy DC hash spelling. The strict sidebar VM linker supplies the actual package namespace export.
- `src/webvowl/js/dragHandleView.js` owns group/line/path/accuracy-target construction and guarded visibility. Three factories retain their path data, geometry, mouse transitions, selection fields and runtime listener replacement. Reachability searches found no callers of old unguarded visibility methods or copied no-op helpers; those definitions are removed.
- `src/app/js/ui/numericRangeControl.js` owns native initialization, finite-positive input handling, stepping, wheel capture and listener disposal. Both menus retain command mapping and action feedback. Rebinding consumes the disposer; configuration checkbox listeners also follow the same setup lifetime. The unused gravity reset copy is removed; controller reset and the state adapter remain authoritative.
- Authored runtime standard-base literals remain only in the vocabulary declaration. Historical ontology inputs, independent test expectations, generated artifacts, profile/mapping identities and user-prefix parsing remain separate.

Focused evidence includes 7,761 namespace/package cases, 83 menu/controller/state cases and 49 dragger/range mechanics cases; these inventories overlap and are not summed. Additional sidebar/vocabulary tests cover all seven fallback prefixes, explicit precedence, unknown/case-sensitive prefixes, multi-colon names, and independent DC spellings.

Chrome 155 native controls pass positive/negative wheel steps, zero/horizontal input, both bounds and disabled handling across all three inputs. Actual keyboard ArrowRight changes class distance 200→210, datatype distance 120→130 and label width 120→130 with matching labels. The real Reset control restores 200/120/120. Visible metadata links preserve DC title/description IRIs, and the FOAF graph renders without console warnings/errors after a clean reload.

The final dependency capture reports 571 modules and zero native findings, including the newly added helpers/tests. No package, lockfile, markup bounds, build policy or other configuration was changed. Canonical expected fixtures were not regenerated. Geometry and prototype-based test doubles remain bounded; real D3/native browser observations provide the separate browser evidence. No performance improvement or deployment is claimed.

### Final review and native interaction boundaries

The consolidated local OpenAI Review Agent inspected `90551cb6b99a36a3b55ca2f7d513157576eff2fc` against the starting revision and found no introduced actionable defect. Its narrowly scoped follow-up ran five suites with 97 passing tests in a clean, independent plain clone of that revision, then independently selected 12 passing mechanical probes for initialization, non-cancelable wheel handling, rebinding/disposal and actual D3 SVG construction. The final documentation-only checkpoint does not change that executable source. Reports retain the exact commands, revisions and mock limitations.

The owner's explicit local-review route is used for this task. Cross-vendor execution was attempted separately: Claude Code 2.1.296 returned API 429 `usage_limit_reached` before any tools; Antigravity read the frozen helper but denied the test command in sandboxed headless mode. No permission setting was changed or bypassed. Local independent execution is same-vendor evidence, not a successful cross-vendor run.

In Chrome 155, real DOM mouse events through actual D3 handlers in an isolated legacy renderer completed class creation and domain/range endpoint requests with the expected independent coordinates. A replay of the accepted range request at the data owner rendered the changed endpoint. An inverse-loop fixture retained endpoint selection and completed a range request; a forbidden subclass loop emitted `SUBCLASS_LOOP_REJECTED` without an edit. A noncentral class-loop drop emitted finite records accepted by the existing insertion-record converter. The native application accepted a metadata title edit, and its JSON export contained the new title and exact DC title IRI.

Two additional pre-existing boundaries were observed and retained outside this refactor: canonical rendering's unchanged positionable-binding filter rejects editor-handle gestures before their handlers, and dropping a class loop at the exact center yields nonfinite placement in unchanged geometry. The legacy-renderer interaction evidence does not claim successful canonical editor gestures. No hit-testing repair, geometry change or scope expansion is included. Browser checks cover Chrome only; other engines are not observed. These limitations and the earlier accuracy-helper-disabled defect remain explicit in the handoff.

Final qualification uses the configured native `full` profile on the settled signed revision, with lazy-chunk validation immediately after production bundling. Native receipts and actual publication/hosted results are retained separately in the HISEW handoff and evidence index; they are not anticipated by this pre-verification commit.
