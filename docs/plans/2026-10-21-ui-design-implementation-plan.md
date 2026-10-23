# WebVOWL UI design implementation plan

> **Status:** Accepted scope, revision 11, 23 October 2026; DEC-001–022 are approved.
> A1–A4 and B1–B5 are implemented; automated checks, scoped foreground qualification and final reviews are complete.
> The consolidated manual batch remains a release requirement.
> The owner's later instruction, "Continue with the current model", supersedes the model-switch pause.
> Foreground measurements are authorized only after other diagnostic avenues are exhausted and optimized code is ready.
> **Sequence:** Plan 3 of 3, after architecture and performance.
> **Basis:** [UI design review](../reviews/20261020-ui-design-review.md), including its requirements, wireframes and section 17 reconciliation.
> **Method:** HISEW implementation planning with accepted design decisions and R2 scope, remaining evidence gates, quality scenarios and traceability.
> **Purpose:** Make choosing an ontology and inspecting its content clear on small and large screens while preserving graph interaction, semantic ownership and accessibility.

## 1. Authority, baseline and predecessors

The owner requested a detailed plan and, on 21 October 2026, approved the architecture and performance plans while deferring UI decisions until those implementations were complete.
Revisions 2–4 preserved that boundary and did not approve UI implementation.
After architecture and performance publication, the owner reviewed all 21 UI decisions, their tradeoffs and acceptance criteria, then stated on 23 October: "I accept your recommendations. Update the UI plan accordingly."
Revision 6 recorded that acceptance.
Revision 7 records the implementation candidate and subsequent decisions; it does not claim final qualification.
Revision 8 adds the owner's runtime-alignment and single-declaration instruction during final UI qualification, with the concrete scope in section 9.
Revision 9 records completed automated checks, browser-engine coverage and scoped foreground observations, including the repaired presentation-order and held-zoom notification defects.
Revision 10 records the final AGY review, its narrow evidence correction, the completed native security scan and the [source handoff](2026-10-23-ui-final-handoff.md).
Revision 11 records the owner-authorized [programme closeout](2026-10-23-programme-closeout.md): PR #85, removal of the viewport zoom restriction, focused count/active-layout observations and explicit remaining performance and actual-platform acceptance limits.
DEC-001–021 are accepted as specified in section 4, including A4 source reflection, property-label treatment, background-click clearing and the shared presentation model.
B5 anchoring and motion are selected for implementation and qualification; B6's additional decoration is not selected.

The owner accepted [UI-DEC-022](2026-10-23-ui-semantic-navigation-decision.md), option 1: related entities are inspected inside Details without changing graph selection.
The original selected preview remains available through Back and on closing Details.
The owner also approved two exact, local lint exceptions: `prefer-native-element` immediately before `#ontology-suggestions` in `src/index.html`, and `no-restricted-syntax` for the single IME `keyCode === 229` comparison in `src/app/js/ui/ontologyChooser.js`.
No shared lint settings are changed.
The [implementation evidence record](2026-10-23-ui-implementation-evidence.md) distinguishes completed focused proof, retained failures and remaining qualification.
An unsuccessful B5 qualification still requires an explicit owner decision on the measured fallback limitations.
Architecture's accepted decisions and performance's delivered contracts remain binding.
The branch remains `feat/architecture-performance-ui`; retain the [authorized delivery checkpoints](2026-10-21-architecture-implementation-plan.md#authorized-delivery-checkpoints) and their applicable publication authority.

On 23 October, the owner required GPT-6.1 Sol with High reasoning for the UI stage, with performance publication and its records finished before any model-switch pause.
The owner subsequently requested and completed the acceptance discussion before switching models, authorizing this documentation update.
The owner then instructed "Continue with the current model", superseding the earlier model requirement and authorizing resumption without a model switch.
The [performance handoff](2026-10-23-performance-final-handoff.md) records the delivered contracts, verification, review dispositions and retained limits.
Its earlier statement that UI decisions were open describes that publication checkpoint; this later owner acceptance governs the UI stage.

The owner also authorized resuming foreground measurements only after other diagnostic avenues are exhausted and optimized code has been produced.
Section 8.3 defines that order without retroactively treating deferred performance timings as passed.
For browser and assistive-technology coverage, use automated testing as far as practicable and collect every remaining owner-performed validation into one batch at the end, as specified in section 8.4.

| Baseline item                    | Recorded identity                                                                                                                                                                                     |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Planning checkout                | `C:/Users/maksy/GitHub/webvowl`, `main`                                                                                                                                                               |
| Planning HEAD                    | `37fd52759f231d3c1b4794f15b5c599f717b0ddc`                                                                                                                                                            |
| Review's source HEAD             | `62961414530e141f8f79ec369afee2d68b9036a6`                                                                                                                                                            |
| UI review SHA-256                | `e732d80d688847a76bed36f7cc5a7ec60df2c08ae6fac401d4abd2baf3568fb7`                                                                                                                                    |
| Planning lockfile SHA-256        | `6c137dc6f69bfb4f70cc5db0ef4d7997fd76a1fc3544d33605612a733c49c458`                                                                                                                                    |
| Original planning reconciliation | At initial planning, no changes under `src/`, `packages/`, `util/` or `docs/adr/` since review source; dependencies/lockfile had changed                                                              |
| Implementation baseline          | Published performance commit `20eb888693bae1434720b6023608c35dd3dc75f3`, following `528d8b821eb143b88fd761b4b4fa69647c983eab`; includes the [handoff record](2026-10-23-performance-final-handoff.md) |
| Acceptance readback              | HEAD `20eb888693bae1434720b6023608c35dd3dc75f3`; working tree clean before this update; review and lockfile hashes above rechecked unchanged on 23 October                                            |

The [architecture plan](2026-10-21-architecture-implementation-plan.md) and then the [performance plan](2026-10-21-performance-implementation-plan.md) have reached their recorded source-delivery checkpoints.
Their actual gate dispositions and limits remain part of this baseline: native workflow admission and resource reconciliation are distinct from passed task checks and source publication.
The performance-only execution was paused, not natively verified complete, at the handoff.
The accepted UI programme now supersedes that execution's implementation scope; reconcile its bookkeeping using the retained evidence and the owner's exception against needless retesting, preserving native verification and resource limitations.
Do not use that reconciliation to relabel historical evidence or rerun unchanged tests solely for admission.
Chooser and details work remain plan 3.

Required inherited facts:

- Contract R and its event payload classes; an anchor is a renderer observation.
- An honest runtime double and independent conformance tests.
- Lifecycle ownership, transient-view selection clearing and retryable `LOAD_PENDING`.
- Published `temporaryPresentation` and isolated subscriber failures.
- Canonical-only renderer.
- S2's frozen internal inspection reads and independent public copies; the adopted session-owned SF semantic read model; the S0 production harness and foreground budgets that remain unqualified until the newly authorized final measurement phase.
- S8's separate pending count intent, temporary layout hold preserving explicit Pause/Resume, capture flushing and bounded renderer reuse with full fallback.

If a predecessor closed a required capability without delivering it, resolve the dependent UI gate explicitly.
A completed performance plan is not proof that a deferred optimization exists.
Do not reopen an earlier accepted decision or move chooser work earlier without replanning.

The selected implementation order is A1 → A2 → A3 → A4 → B1 → B2 → B3 → B4 → B5; B6 is closed as not selected.
A terminal disposition is merge, not selected, stopped by a falsifier, or owner-deferred.
Reviving a closed slice requires a later plan.

## 2. Scope and HISEW route

In scope: curated URL suggestions, one submission seam, active/committed/edited states, keyboard/touch behavior, protected current-source reflection, on-demand overview, adaptive details surfaces, multi-role preview/full details and selected anchoring/motion subject to qualification.
Additional renderer decoration is not selected; existing selection styling remains.

Preserve upload, drag-and-drop, create gating, paste, facts, reload, existing hashes/share links, layout control, pins, arrangement, editing authority, exports and agent selection parity.
Keep the renderer a projection and semantic facts in controller/session reads.

Non-goals: UI framework adoption, redesigning editing, new ontology formats, new hash vocabulary, general URL normalization repair, agent catalogue tools, graph keyboard navigation, persistent preferences, viewport-meta changes, broader accessibility remediation, View Transitions adoption or performance-engine changes.

### Risk class:

**R2 accepted for the selected implementation scope.**
Native execution routing is a separate resumption step; this document records the owner decision, not an engine transition.
Source routing, public behavior, accessible interaction, cross-layer selection and renderer observation create material compatibility and availability risk.

### Decision owner:

The repository owner accepted the UI recommendations on 23 October; this revision records their exact scope.
The implementation owner integrates serial slices.
Independent accessibility/browser and contract reviewers verify the final candidate.

### Reasoning:

Choosing a suggestion must never load accidentally or change a packaged example's routing semantics.
Details must remain complete across roles and generations without affecting layout or saved artifacts.
A visually convincing preview can still hide semantic or accessibility failures.

### Potential blast radius:

Ontology loading, search's URL path, navigation popovers, sidebar/editor presentation, selection, renderer events, export and narrow-screen accessibility.

### Reversibility:

No saved-schema migration is proposed.
UI presentation state remains ephemeral.
Contract R additions require coordinated consumers; a previous release is a rollback option only after exact artifact and compatibility qualification.

### Principal unknowns:

Role ordering and duplicate semantic-key behavior; hidden-entity selection; reliable selected-occurrence geometry; browser/assistive-technology behavior; minimum usable canvas dimensions; mobile frame cost and H1–H4 closure latency.
These are remaining proof and calibration questions, not a reopening of accepted DEC-001–021.

### Required artifacts:

Accepted decision register, this exact baseline, requirements/QA traceability, slice proofs, interaction and accessibility matrix, renderer contract changes, performance receipts and final disposition/release record.

### Required specialist lenses:

Interaction/accessibility and real-browser review; runtime-contract and motion/performance review.
Changes to URL/input handling and untrusted semantic-text rendering trigger a scoped native security assessment under current approved authority.

### Required verification:

Test-first unit/contract flows; automated browser and accessibility checks to the practical limit of available tools; one final batch of residual manual checks; S0 foreground measurements after optimization; export equivalence; final configured `full` route and independent verification.

### Required human approvals:

UI plan/R2 acceptance and DEC-001–021 are recorded in this revision.
Further decisions are required only for material scope/contract changes, a failed B5 qualification and its proposed fallback, exact configuration/dependency/lint-policy changes or new shims, and the final disposition of required coverage that remains unavailable.
Retain existing commit-message, commit and feature-branch publication authority; this acceptance adds no merge, deployment or unrelated configuration authority.

### Maximum sensible autonomy:

Record acceptance and validate this document now.
Under the owner's current-model resumption, execute the selected slices, investigate and fix issues autonomously within scope, and batch residual owner-performed browser/AT validation at the end.
No delegation or live user study is authorized by the plan itself; specialist tools remain within the accepted scope and their applicable procedures.

### Next lifecycle step:

Reconcile the existing performance execution's bookkeeping, checkpoint this accepted plan and confirm the delivered baseline before SLICE-000.
Do not repeat the accepted UI decision review or treat resumption as proof that any implementation gate passed.

## 3. Requirements and measurable acceptance

IDs are local; cross-plan references use `UI:`.
The review's A/B requirements are retained as source references, distinct from its A/B implementation slice names.

| Requirement                                            | Acceptance criterion                                                                                                                                       | Review mapping             |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| REQ-001 One genuine editable URL field                 | AC-001 One `type=url` field, grouped suggestions, separate name/status summary and explicit Visualize action; no preset links remain                       | A1/A5                      |
| REQ-002 Preserve curated identity and provenance       | AC-002 H1–H4 exact URLs/order; six packaged examples resolve through the existing resolver; no alias rewriting or invented endpoints                       | A2/A3                      |
| REQ-003 Separate suggestion commitment from submission | AC-003 Click/tap/Enter commitment causes zero loads; repeat/IME cannot commit and submit; only deliberate submission loads                                 | A4/A6                      |
| REQ-004 Preserve route and action semantics            | AC-004 Preset resume/automatic-count behavior, explicit routes, share links and existing upload/create/paste/facts remain valid                            | A3/A5/A6                   |
| REQ-005 Keep graph use practical on compact screens    | AC-005 No side-by-side inspector reduces canvas width below the docking rule; overview and details are discoverable on demand                              | B1/B2                      |
| REQ-006 Present complete semantic information          | AC-006 All roles, description fields and a retained-facts route are reachable for every supported entity kind; preview budgets never truncate full details | B3/B6                      |
| REQ-007 Preserve ownership and latest selection        | AC-007 Controller facts only; generation-safe refresh; latest selection wins; no preview-induced layout/pin/camera/export change                           | B7, reconciliation D-19    |
| REQ-008 Provide accessible interaction                 | AC-008 Keyboard/touch/focus/AT cases in section 8 pass, with explicit untested-platform gaps                                                               | A/B accessibility criteria |
| REQ-009 Make motion optional and bounded               | AC-009 Reduced motion removes translate/scale; interruption settles target state within one frame; accepted frame/latency budgets pass                     | B4/B5, PH-1–PH-3           |
| REQ-010 Keep decoration out of artifacts               | AC-010 Applies only if B6 is later selected; no new ring is delivered in this revision. Existing surface/export equivalence remains required               | B7, AH-3                   |
| REQ-011 Preserve implementation boundaries             | AC-011 No unauthorized configuration, new transport, public aliases or human-editing capability for agents                                                 | AGENTS.md, ADR 0012        |

### 3.1 Quality scenarios

| Scenario                          | Stimulus/environment                                                                              | Required outcome                                                                                                       |
| --------------------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| QA-001 Accidental-load prevention | Type a label; Enter, hold Enter, IME commit, tap a suggestion                                     | Commitment only; second deliberate submission loads once; no native implicit-submit race                               |
| QA-002 Source compatibility       | Dev HTTP packaged URL, production base path, each hash route, percent escapes                     | Exact resolver URL; preset semantics retained; normalizer runs only for the appropriate uncommitted route              |
| QA-003 Narrow-screen usability    | 375×812, 812×375, 768×1024, keyboard open, 200% zoom and separate 320 CSS px reflow, text spacing | Usable full-width graph; controls/focus remain visible; sheets scroll without trapping non-modal preview focus         |
| QA-004 Selection lifetime         | A→B rapidly, then load replacement/edit/language/hidden state                                     | At most one describe per frame, latest current result only, no stale DOM/focus update or escaping subscriber exception |
| QA-005 Semantic completeness      | Multi-role, repeated, anonymous, literal/datatype, property and details-only entities             | Deterministic role display, all details accessible, no occurrence/record/entity identity interchange                   |
| QA-006 Motion neutrality          | Active layout, drag, pan, zoom, pause, inline edit, export                                        | No preview-induced simulation/arrangement/pin change; reduced-motion and interruption rules pass                       |
| QA-007 Agent parity               | Human versus WebMCP reveal/select/reset/load                                                      | Same published state and preview consequences; pending load shown as retryable state without automatic resubmission    |
| QA-008 Untrusted content          | Markup-like labels, hostile IRI schemes, long values and load errors                              | Text remains text, actionable URLs validated, existing acquisition limits/credentials behavior retained                |
| QA-009 Cleanup                    | Repeated open/close, load/dispose, hidden-tab transitions                                         | No leaked subscriptions, animation frames, observers, dialogs or retired occurrence references                         |

## 4. Decision register and unresolved handoffs

All DEC-001–021 below were accepted by the owner on 23 October after the post-performance walkthrough.
The implementation and evidence gates remain; acceptance of a choice is not a passed test or release qualification.

| Decision       | Accepted choice, 23 October                                                                              | Implementation gate                                                                              |
| -------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| DEC-001 / D-01 | Unedited packaged suggestion submits its preset route                                                    | A2                                                                                               |
| DEC-002 / D-02 | Derive exact commitment before HTTP→HTTPS normalization                                                  | A2                                                                                               |
| DEC-003 / D-03 | Genuine URL textbox with controlled list and expanded toggle; no unsupported combobox role               | A3                                                                                               |
| DEC-004 / D-04 | Published titles with short category badges                                                              | A1                                                                                               |
| DEC-005 / D-05 | Verbatim `latest` / `latest-unstable` badges                                                             | A1                                                                                               |
| DEC-006 / D-06 | No benchmark suggestion; preserve `#benchmark`                                                           | A1                                                                                               |
| DEC-007 / D-07 | Keep submitted/failed text; select A4 current-source reflection only while unfocused and unedited        | A2/A4; deliberately replaces the field-clearing expectation; failures and edits remain protected |
| DEC-008 / D-08 | Reject unmatched bare words with guidance                                                                | A2; define host:port/localhost distinctions explicitly                                           |
| DEC-009 / D-09 | Wide inspector closed by default, opt-in pinning; editor workflow remains available                      | B2                                                                                               |
| DEC-010 / D-10 | Shape-styled, content-sized preview with constant Details action                                         | B3                                                                                               |
| DEC-011 / D-11 | Include property-label rectangles in the visual treatment; shape never limits available information      | B3; complete property details remain reachable                                                   |
| DEC-012 / D-12 | No literal circular content card in first delivery                                                       | B3                                                                                               |
| DEC-013 / D-13 | Compact `sidebar=1` neither docks nor automatically opens a surface                                      | B2; explicit bookmark-presentation change                                                        |
| DEC-014 / D-14 | No View Transitions in first delivery                                                                    | B5                                                                                               |
| DEC-015 / D-15 | Viewport meta remains separate accessibility work                                                        | Scope boundary                                                                                   |
| DEC-016 / D-16 | No agent catalogue-listing tool                                                                          | Scope boundary                                                                                   |
| DEC-017 / D-17 | Preserve native-disabled Visualize until valid                                                           | A3                                                                                               |
| DEC-018 / D-18 | Background click/tap clears selection only when no drag/pan crossed the existing movement threshold      | B3; protect pan, drag and touch behavior                                                         |
| DEC-019 / D-19 | One pure description-to-presentation model for preview, details and docked inspector                     | B3; independent expected outputs                                                                 |
| DEC-020        | Closing full details returns to preview; closing preview clears controller selection                     | B3/B4; no hidden dismissed-selection state                                                       |
| DEC-021        | Matching rules govern contradictory examples; Core URLs do not imply Extended, and SIOC can match `core` | A1; absolute typed URLs are never automatically replaced                                         |

**DEC-020: details-close ambiguity.**
Review section 7.1 labels Close/Escape from full details as `Closed` with selection retained, while it also says a preview exists whenever selection is non-empty.
The storyboard/state diagram says the preview remains.
Accepted interpretation: details-open is an orthogonal presentation mode; closing full details returns to the selection's preview, while closing the preview clears selection through the controller.
Loads/stale references suppress both immediately.
Implement and independently test these accepted transitions in B3/B4; do not introduce an undocumented “dismissed selection” flag.

**DEC-021: matching example inconsistency.**
Review section 4.6 says a typed Core `latest` URL lists H3 and H4, but its stated substring rule and catalogue give H4 an Extended URL, not a Core URL.
Use the accepted rule-derived result, with H3 matching its URL prefix and H4 not matching unless an explicit searchable field actually matches.
Likewise the illustrative one-result `core` wireframe must not override SIOC's “Core Ontology” title.
In all cases an absolute typed URL has no automatic activation and is submitted unchanged.
The owner accepted these corrections before they become test oracles.

**Selected enhancements and retained boundaries.**
A4 reflection is selected, with no overwrite of focused/dirty text and no automatic submission.
B5 anchoring and motion are selected for implementation and qualification after B3/B4 establish complete static behavior.
B6's extra ring/halo is not selected; retain existing selection styling and add no decoration contract member.
DEC-015 keeps viewport-meta changes outside this delivery and leaves the existing zoom restriction visible as a limitation.
The owner has not preaccepted a failed B5 qualification, reduced semantic completeness or an inaccessible fallback.

### 4.1 Handoff questions and their minimum evidence

| Question                                 | Disposition / cheapest evidence                                                                                                                                                            | Consumer                                      |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------- |
| AH-1/AH-2 anchor and selected occurrence | Contract R permits a classified renderer observation; design a generation/revision-scoped arrangement fact for the actual selected occurrence, never a semantic/editing identity           | B5                                            |
| AH-3 decoration                          | B6 not selected on 23 October; retain existing selection styling and add no new renderer member                                                                                            | Closed for this delivery                      |
| AH-4 role order                          | Permute input/record order on punning fixtures; accept a stable semantic ordering and deterministic tie-break                                                                              | B3                                            |
| AH-5 duplicate semantic keys             | Verify canonical snapshot invariant and inspector differential; SF evidence may supply it, otherwise add focused proof                                                                     | B3                                            |
| AH-6 entity-scoped facts                 | Keep a section-level ontology-facts link by default; new entity read requires explicit contract and ADR 0012 parity decision                                                               | B4                                            |
| AH-7 submission owner                    | One source-submission module called directly by chooser/search; location loader retains loading authority                                                                                  | A2                                            |
| AH-8 explicit-IRI node count             | Current session chooses `auto` without saved visualization; explicit routes do not force preset overrides. Test actual H1–H4 admission and keep this rule unless a new decision changes it | A2                                            |
| AH-9 graph keyboard selection            | No new graph navigation in this scope; preserve search keyboard path. A semantic-only hidden target cannot be passed to occurrence selection                                               | B3/B4                                         |
| AH-10 agent catalogue                    | D-16 excludes a new tool; URL loading parity already exists                                                                                                                                | A1                                            |
| AH-11 viewport metrics                   | Extract one application-owned producer from search's current implementation; current chooser must work before search ever opens                                                            | A3                                            |
| PH-1/PH-2                                | Diagnose and optimize anchor/compositing work first; use S0 for real foreground cost on the consolidated optimized candidate, including available constrained devices                      | B5 final qualification                        |
| PH-3                                     | Prove rapid-selection coalescing with counters during B3; measure click→painted preview after the optimization-first gate in section 8.3                                                   | B3 implementation; final timing qualification |
| PH-4                                     | Automate H1–H4 retrieval/import/load correctness first; measure foreground load/settle only after section 8.3's gate; historical 200 responses are not current end-to-end proof            | A2/A3 implementation; final qualification     |
| PH-5                                     | Suspend unnecessary hidden-tab/idle anchor work, but continue event-driven pan/zoom/drag/resize updates while layout is paused                                                             | B5                                            |

**Additional integration gap: semantic-only selection.**
Current `selectVisualizationElement` delegates to an occurrence selection validator.
B4 relation links and B3 hidden/details-only descriptions must not invent an occurrence or conflate identity types.
Before those flows, prove a current controller route supports them.
If it does not, accept a narrow semantic-description navigation design or separately approve a public selection contract with parity tests.
The absence blocks that flow, not unrelated chooser work.

## 5. Chooser contract and native reuse

### 5.1 Catalogue

| ID  | Group / display name                                                      | Badge                             | Exact URL or existing preset key                                           |
| --- | ------------------------------------------------------------------------- | --------------------------------- | -------------------------------------------------------------------------- |
| H1  | Hadden Industries / ISO/IEC 11179-3:2023 Ontology                         | Metadata; alias `latest`          | `https://haddenindustries.com/ontology/iso-iec/11179/-3/ed-4/latest`       |
| H2  | Hadden Industries / Hadden Industries Universal Reference Data Ontology   | Reference Data; alias `latest`    | `https://haddenindustries.com/ontology/universal/reference-data/latest`    |
| H3  | Hadden Industries / Hadden Industries Universal Core Ontology             | Core; alias `latest-unstable`     | `https://haddenindustries.com/ontology/universal/core/latest-unstable`     |
| H4  | Hadden Industries / Hadden Industries Universal Extended Ontology         | Extended; alias `latest-unstable` | `https://haddenindustries.com/ontology/universal/extended/latest-unstable` |
| O1  | Others / Friend of a Friend (FOAF) vocabulary                             | Packaged example                  | `foaf`                                                                     |
| O2  | Others / GoodRelations Vocabulary for E-Commerce                          | Packaged example                  | `goodrelations`                                                            |
| O3  | Others / Modular and Unified Tagging Ontology (MUTO)                      | Packaged example                  | `muto`                                                                     |
| O4  | Others / Ontology Visualization Benchmark (OntoViBe)                      | Packaged example                  | `ontovibe`                                                                 |
| O5  | Others / Personas Ontology (PersonasOnto)                                 | Packaged example                  | `personasonto`                                                             |
| O6  | Others / SIOC (Semantically-Interlinked Online Communities) Core Ontology | Packaged example                  | `sioc`                                                                     |

Resolve O1–O6's field URLs through [`canonicalExampleSource`](../../src/app/js/canonicalExamples.js), never a hard-coded production host.
Preserve the notices' transformed-artifact meaning; these are not original OWL documents or guaranteed stable interchange files.
Source provenance is in [canonical example notices](../../src/app/data/canonical-example-notices.txt).
Refresh title/provenance/rights evidence before shipping catalogue text; do not silently replace owner-specified aliases if availability changes.

### 5.2 State, matching and routes

Keep independent UI popup/active-option state, derived exact commitment, native validation state and controller-derived submission status.
Derive commitment by equality with the actual field text after the accepted trim/sanitization rule, before normalization.
Typing, paste, undo and autofill use the same path.
No active suggestion writes the field until committed.

Normalize matching text with NFKC, the accepted case-insensitive rule and collapsed whitespace; match tokens across title/category/group/badges/URL/preset/provenance.
Keep curated ordering.
Specify case-fold behavior precisely during A1: JavaScript lowercasing is not automatically full Unicode case folding.
No locale sorting or alias rewriting is implied.
Absolute URLs have no auto-active option; label-like input may activate the first match.

| Submitted state                     | Route                                        | Preserved behavior                                                             |
| ----------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------ |
| Exact committed packaged suggestion | `#<presetKey>`                               | Resume layout and automatic count; development HTTP asset is not rewritten     |
| Exact Hadden suggestion             | Existing `#iri=` encoding                    | Native document admission and existing explicit-route defaults                 |
| Uncommitted text                    | Existing normalizer, then `#url=` or `#iri=` | Existing format-route/encoding behavior, except accepted D-08 bare-word change |

All paths reach `loadOntologyFromLocation` and the controller.
No synthetic input/submit events and no parallel direct loading transport.
Preserve percent-encoding round trips and existing `opts`, `file`, new-ontology, empty-hash and benchmark routes.
Same-hash resubmission needs an explicit test: retain established behavior or route an accepted retry through the same loader; never cause two loads.

### 5.3 Platform and reuse evidence

The [W3C ARIA-in-HTML recommendation](https://www.w3.org/TR/html-aria/#el-input-url), checked on 21 October 2026, gives a URL input without `list` textbox semantics and does not permit changing it to a combobox role.
The proposed field therefore retains its implicit role; active-descendant/autocomplete attributes must conform to textbox support, with expanded state on the separate toggle.
Validate the exact markup and actual AT behavior.
Do not use a non-conforming role merely to match the informal word “combobox”.

The [APG modal-dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/), also checked on 21 October, supports explicit initial focus, contained tab navigation and focus return.
Reuse the existing native facts-dialog/navigation infrastructure.
The preview remains non-modal.

The review already compares datalist, customizable select, a text combobox, native dialog, Web Animations, View Transitions and CSS anchors.
Retain its capability-based choices: grouped/badged editable URL suggestions need a small custom controller around native input/list semantics; native dialogs handle modal details; existing presentation/runtime modules supply the integration.
No framework, new positioning dependency, new polyfill or compatibility alias is selected.
Before implementation, refresh support for the actual `baseline widely available` target, supported validators, latest applicable dependency versions and actual license/terms.
Those research/adoption gates are not claimed complete by this plan.
Use current modern-web-guidance and browser-testing skills during implementation, within authorized scope.

## 6. Architecture, ownership and presentation rules

| Rule                    | Authority / current consumers                               | Strategy and drift control                                                                                 |
| ----------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Curated source identity | Catalogue; chooser matching and rendering                   | One immutable catalogue; URLs computed through the native example resolver; exact independent string tests |
| Source submission       | Existing location loader and normalizer; chooser/search     | One direct submission seam; preserve acquisition validation and route semantics                            |
| Visual viewport         | Application metrics producer; search/chooser/preview/sheets | Extract current owner, frame-coalesce updates and dispose once; no independent copies of viewport state    |
| Semantic presentation   | Controller descriptions; preview/details/sidebar            | DEC-019 pure model; renderers consume it, independent expected outputs check completeness                  |
| Selection truth         | Controller selection and generation                         | Latest-frame presenter; no UI mirror of temporary presentation and no hidden dismissed-selection authority |
| Anchor geometry         | Renderer arrangement facts through adapter/controller       | R4 renderer observation; UI never reads SVG to obtain facts or calls renderer directly                     |
| Decoration              | Renderer-local drawing state                                | Contract R member; excluded from captures and retired with generation                                      |
| Input validation        | Native URL/HTML checks and controller acquisition contracts | Preserve both UI feedback and trust-boundary validation; no shadow URL grammar or new permissive schemes   |

Facts, annotations, labels and descriptions render as text.
Semantic links are validated before becoming actionable URLs.
Do not derive facts from SVG labels, use `innerHTML` for ontology content, or transmit ontology text into public telemetry.

Opening/closing a preview changes no layout, camera, arrangement, pin, saved artifact or export.
An explicit “Show in graph” action may request existing controller centering/reveal behavior; ordinary opening must not.
Temporary-neighborhood retirement changes drawn availability, not semantic truth.
Read that distinction from current descriptions/arrangement and the published temporary field.

Content model:

- Overview preserves title, IRI, version, authors, language, description/metadata, semantic and explicitly labeled visible counts, provenance, warnings, source reload and facts.
- Preview has label, role/type, compact IRI and bounded summary, plus kind-specific relations/counts and a constant Details control.
- Multi-role selection exposes every role in a stable order; repeated occurrences are a count/arrangement concern.
- Full details include all available description fields, language tags, relations, annotations, characteristics, cardinality, equivalence/disjointness, individuals and retained-facts navigation.
- Hidden/details-only entities remain inspectable with “Not shown in the current view”; missing anchor is not missing semantics.
- No new field is invented when the current description contract does not supply it; resolve that content requirement explicitly.

## 7. Ordered vertical slices

### SLICE-000 — Re-anchor and accept the UI baseline

**Entry:** both predecessor source checkpoints and their limits recorded; this UI scope/R2 route and DEC-001–021 accepted; owner authorized resumption with the current model.

Bind final source, lockfile, review hashes, delivered contracts, browser target and S0 evidence.
Refresh HISEW applicability, execution ownership and profiles.
Check every open handoff in section 4.1.
Retain prior decisions and expected predecessor changes.
Record actual unavailable browser/AT/device capabilities without claiming coverage.
Carry unavailable manual-only checks forward to the single final owner validation batch; do not interrupt individual slices merely to ask the owner to exercise each platform.

**Output:** a concrete accepted decision packet and per-slice entry gates.
No app, source catalogue or workflow configuration is changed by drafting.

### SLICE-001 — A1: catalogue and matching

**Dependencies:** DEC-004/005/006/021.
**Predicted files:** new `src/app/js/ui/ontologySuggestions.js` and tests; existing canonical example resolver used directly.

Write exact H1–H4 string/order tests and all six packaged source tests.
Test group ordering, badge/provenance matching, NFKC/case behavior, empty/no-match input and absolute-URL non-activation.
Freeze expected results using accepted DEC-021.
A displayed short badge never substitutes for the actual URL.

**Demonstration:** pure catalogue/matching tests show the intended suggestions without loading anything.
**Accept:** AC-002 and semantic naming/provenance review.
**Stop/recovery:** unverifiable source identity or a requested alias substitution requires an owner decision; do not silently “repair” a URL.

### SLICE-002 — A2: one deliberate source-submission path

**Dependencies:** A1; DEC-001/002/007/008; AH-7/AH-8.
**Predicted files:** [ontology menu](../../src/app/js/menu/ontologyMenu.js), [application composition](../../src/app/js/app.js), [search menu](../../src/app/js/menu/searchMenu.js), [location loader](../../src/app/js/loadingModule.js) only as needed; new small submission module if ownership warrants it.

Separate commit from submit.
Replace `setIriText`'s synthetic events with a directly invoked submission operation shared by chooser and search.
Preserve validation-before-native-submission ordering.
Keep submitted text under accepted D-07 and associate failures with the actual submitted source.
An agent/hash load does not cause automatic resubmission.

**Tests/oracle:** all route rows, dev HTTP packaged URL, base-path deployment, native URL sanitization, existing encoded-percent tests, explicit source defaults, invalid/credential schemes, unmatched bare words versus valid host:port, same-hash retry and load supersession.
Keep share-link tests unchanged.
Deliberately update the field-clearing assertion with DEC-007, not a blanket expectation rewrite.

**Accept:** AC-003/004, one load per deliberate submit, no synthetic dispatch.
**Recovery:** reverse submission and all callers together; no compatibility alias.
Do not broaden the pre-existing JSON-suffix routing limitation.

### SLICE-003 — A3: accessible suggestions and viewport ownership

**Dependencies:** A2; DEC-003/017; AH-11.
**Predicted files:** [page markup](../../src/index.html), [application CSS](../../src/app/css/toolstyle.css), ontology menu and tests, navigation/search integration, new viewport-metrics owner/tests if needed.

Build one labeled URL field, toggle, Clear, summary, grouped inline listbox, Visualize and hint/status.
Remove obsolete preset links and their dead CSS; preserve all upload/create/paste/facts controls.
Do not create a nested popover.
Active and committed options have different visual/programmatic states.
Keep field focus on pointer commitment; touch rows target 44 CSS px and preserve visible controls above the keyboard.

Keyboard tests follow review E1–E6: IME ignored; active Enter commits with default prevented; subsequent Enter submits; absolute URL is not replaced; unmatched word errors; held-key repeat cannot submit.
Also cover arrows/Alt arrows, Escape layering, Tab without commit, Home/End editing, blur/pointer ordering, undo and autofill.

Extract visual-viewport publication from search into an application lifetime owner.
Test chooser first-open before search, resize/scroll/orientation, disposal and independent sheet consumers.
No new global policy setting is required.

**Accept:** AC-001/003/008, html validation, keyboard/touch browser checks and active-versus-selected announcements.
**Stop:** required semantics fail in target AT/browser; resolve a conforming design, not a role or lint bypass.
**Cleanup:** remove obsolete handlers/listeners and old duplicated viewport publication.

### SLICE-004 — A4: selected current-source reflection

**Dependencies:** A3 and selected DEC-007 reflection option.
**Predicted files:** chooser presenter, state presenter and tests.

When unfocused and not dirty, reflect accepted controller source into the field/summary.
Protect in-progress edits from agent/hash loads.
Define precedence for failed submitted text, current accepted source and a newly focused/dirty value.
Clear obsolete failure hints only for their owning source.
Reflection never invokes submission.

**Accept:** source reflection, dirty/focus protection, failure recovery and no-load spies.
**Selection:** accepted on 23 October; omitting reflection requires a changed scope decision.
**Recovery:** remove reflection subscription without undoing A2's accepted submission behavior.

### SLICE-005 — B1: ontology overview on demand

**Dependencies:** A4 implementation.
**Predicted files:** markup, sidebar, state presenter, CSS and a small overview presenter/dialog module.

Add a visible title/Overview control before the graph in tab order.
Reuse current summary and facts operations.
Move language control through the existing view-control path.
Label remaining sidebar controls and expose expanded state.
Do not delete metadata merely because the permanent panel is going away.

**Tests/oracle:** a field-by-field inventory of current sidebar metadata; full overview rendering, source reload/facts action, language updates, no-loaded-document state and focus return.
**Accept:** all current overview fields remain reachable and graph state is unchanged.
**Recovery:** overview and original presentation consumers remain coordinated until B2 is accepted.

### SLICE-006 — B2: adaptive details and editor surfaces

**Dependencies:** B1; DEC-009/013.
**Predicted files:** sidebar, state presenter, markup, CSS and responsive tests.

Use a compact modal sheet and opt-in wide inspector.
Start from the current >1024 px docking boundary, then accept measured minimum usable canvas width/height rather than a universal percentage.
Existing 280/320/360 px panel tokens are starting evidence, not fixed acceptance.
Keep editor content and authority intact: full-height compact sheet, existing wide docked workflow.
Do not introduce preference persistence.

**Tests/oracle:** compact portrait/landscape, tablet, wide, 200% zoom and separate 320 CSS px reflow, text spacing, on-screen keyboard, editor entry/exit and `sidebar=1`.
Apply reduced motion to existing panel transitions too.
Use native dialog focus behavior; non-modal docked region remains interactive with the graph.

**Accept:** AC-005/008 and complete access to existing editing actions.
**Stop:** inaccessible focus, inaccessible editor controls or insufficient graph space.
**Recovery:** use the accepted minimal adaptive inspector; never hide content to satisfy geometry.

### SLICE-007 — B3: selection preview without motion

**Dependencies:** B2; DEC-010/011/012/018/019/020; AH-4/AH-5/AH-9; actual performance read path.

Create one pure description-to-presentation model and a presenter that schedules at most one describe per animation frame.
The model formats the delivered SF semantic answers; it does not duplicate semantic authority or create a second semantic cache.
Check generation before reading and again before applying a queued result.
Handle `LOAD_PENDING` without retry loops or exceptions escaping publication.
Refresh language/revision changes while retaining valid focus/scroll.
Read published temporary presentation and current drawn availability; do not infer visibility from initiator.

Use an initially docked preview with no renderer decoration or morph.
A basic wide placement may use existing controller arrangement facts only if the identity is unambiguous.
Exact tapped-occurrence tracking and moving-node keep-clear guarantees belong to B5.
B3 remains a prerequisite increment for selected B5; do not claim the static fallback already proves moving-node keep-clear behavior.

Test all roles/kinds, repeated and hidden entities, rapid selection, selection removed by edit, load start, revision/language changes, WebMCP selection/reset and disposal.
Preview Close reports null selection through the controller.
Implement accepted DEC-018 background-click clearing, with existing drag threshold and pan/touch behavior protected.
Inline editing suppresses preview interaction without altering editor authority.

**Implementation accept:** AC-006/007 correctness, bounded describe counters and no runtime layout/pin/camera writes.
**Final qualification:** the inherited W5 `all` click-to-painted-details lab p95 is at most 200 ms; measure only after section 8.3's gate, and keep timing acceptance pending until then.
**Stop:** mutating read consumer, stale content or unresolved semantic-only selection contract.
**Fallback:** docked non-animated preview plus complete details, subject to actual occlusion/accessibility evidence.

### SLICE-008 — B4: complete semantic details

**Dependencies:** B3 and DEC-020; AH-6 and semantic-only navigation disposition.
**Predicted files:** shared presentation model, sidebar, full-details dialog/presenter, facts integration and tests.

Render every description role in semantic HTML with real headings and appropriately labeled disclosure buttons.
Use modal full details on compact; opt-in non-modal inspector on wide.
Relation navigation uses a proven controller operation; never coerce an entity reference into an occurrence request.
Keep ontology-level retained facts until an entity-scoped API is separately accepted.
Full details do not inherit preview truncation budgets.

Test annotation language tags, long IRIs/copy, relation navigation, empty fields, anonymous constructs, multiple roles, retained-facts availability, edit refresh and generation replacement.
Details opens on demand; closing returns according to DEC-020.
Focus returns to a surviving invoker or an explicit title/search fallback.

**Accept:** independent field-completeness fixtures, correct heading/focus semantics and export equivalence.
**Stop:** required content is unavailable in controller contracts or inaccessible behind a surface.
Resolve the contract or scope with the owner; do not read the SVG.

### SLICE-009 — B5: selected-occurrence anchor and interruptible motion

**Dependencies:** B4; AH-1/AH-2 and PH-5 design/correctness proof; accepted DEC-014.
PH-1–PH-4 foreground qualification follows optimized implementation under section 8.3; establish explicit quantitative anchor/frame budgets before those acceptance measurements.

**Predicted files:** contract R module delivered by architecture, adapter/internals, controller arrangement-observation routing, preview presenter/placement, CSS and conformance/browser tests.

Publish a narrow arrangement observation for the selected occurrence: current generation/revision, opaque occurrence identity, screen position/extent and shape facts.
Specify coordinate space and units; reject non-finite/stale facts.
Do not expose `selectedEditorOccurrence` as semantic identity or broadcast the entire arrangement into frozen controller state every tick.
Keep at most one frame-coalesced anchor update; retain real pan/zoom/drag/resize updates while paused.
Suspend hidden-tab animation work and resume from a fresh current observation.

Position using coordinates and viewport transform, not SVG layout reads during ticks.
Protect the selected box and focused controls; use hysteresis rather than following every motion.
Handle off-screen anchors without automatic camera movement.
Missing/ambiguous anchor uses the accepted non-animated presentation.

Animate HTML transform/opacity with native Web Animations/FLIP.
Cancel or reverse from the current visual state; latest target state is established within one animation frame and no transition queues.
The initial 180–240 ms motion and roughly 40% compact height are calibration proposals, not fixed product requirements.
Reduced motion uses instant or short opacity only.

**Tests/oracle:** R1–R4 independent conformance; repeated occurrence clicked versus entity meaning; generation/revision expiry; reselect during open/close; drag/zoom/resize; hidden tab; reduced motion; exported graph unchanged.
Use S0 on admitted workloads and separately labeled 1k/10k synthetic occurrence stress cases.
Diagnose work with static analysis, counters and headless traces first, then measure PH-1/PH-2 and compositing on the optimized candidate and actual available devices; transform usage alone is not GPU proof.

**Accept:** measured motion/latency budgets, no per-tick SVG measurement, stable keep-clear placement and all invariant tests.
**Falsifier/recovery:** if anchoring/compositing remains too costly or inaccessible, close B5 with evidence and owner-accept the B1–B4 fallback; do not weaken predecessor budgets.

### SLICE-010 — B6: optional renderer-local expansion decoration

**Disposition:** not selected by the owner on 23 October; do not implement this slice.
The design below is retained for traceability only; reopening it needs a later decision.

**Dependencies:** B5 accepted and owner selects decoration.
**Predicted files:** contract R, adapter/internals selection decoration and export-clone tests.

Add a generation-local ring/halo through the declared runtime seam.
It changes no force geometry, collision radius, picking target, pin or semantic content.
Exclude it explicitly from SVG clone, drawing snapshot and canonical artifact paths.
Retire it on selection/generation change and disposal.

**Tests/oracle:** equal SVG/drawing/canonical exports with decoration on/off; stale request rejection; reduced motion; pointer hit testing; runtime conformance.
**Accept:** AC-010 and no regression to B5 frame budgets.
**Close unselected:** existing selection styling remains.
**Recovery:** remove the optional member and all consumers coherently; no hidden export filter workaround.

## 8. Verification and traceability

The [implementation evidence](2026-10-23-ui-implementation-evidence.md) retains exact runs, candidate bounds, failures and repairs.
The [final review disposition](2026-10-23-ui-final-handoff.md#final-review-and-evidence-boundaries) applies across the selected slices; required manual platform coverage remains in the [single owner packet](2026-10-23-ui-manual-validation.md).
Automated completion below does not claim complete assistive-technology qualification or release approval.

| Slice          | Requirement / acceptance / quality / decisions                          | Proof                                                      | Release/cleanup implication                       | Current evidence status                                |
| -------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------ |
| A1 / SLICE-001 | REQ-002 / AC-002 / QA-002 / DEC-004/005/006/021                         | Exact catalogue and independent matching tests             | No loading side effects                           | Automated passed                                       |
| A2 / SLICE-002 | REQ-003/004 / AC-003/004 / QA-001/002/007 / DEC-001/002/007/008         | Routes, single submit, unchanged share links               | Retire synthetic submission                       | Automated and H1-H4 observations passed                |
| A3 / SLICE-003 | REQ-001/008 / AC-001/008 / QA-001/003/009 / DEC-003/017                 | Keyboard/ARIA/touch and metrics ownership                  | Remove preset links/dead handlers                 | Automated passed; manual AT open                       |
| A4 / SLICE-004 | REQ-004/007 / AC-004/007 / QA-007 / DEC-007                             | Dirty/focus/source reflection tests                        | Scoped subscription with disposal                 | Automated passed                                       |
| B1 / SLICE-005 | REQ-005/006 / AC-005/006 / QA-003                                       | Overview field inventory and focus                         | Metadata remains reachable                        | Automated passed; manual AT open                       |
| B2 / SLICE-006 | REQ-005/008 / AC-005/008 / QA-003/006 / DEC-009/013                     | Responsive/editor/reduced-motion checks                    | No preference/schema migration                    | Automated passed; manual devices open                  |
| B3 / SLICE-007 | REQ-006/007 / AC-006/007 / QA-004/005/007 / DEC-010/011/012/018/019/020 | Presentation oracle, lifetime and performance              | Remove first-role-only presentation               | Automated passed                                       |
| B4 / SLICE-008 | REQ-006/008 / AC-006/008 / QA-005/008 / DEC-020                         | Completeness, navigation and focus                         | Complete details remain available                 | Automated and scoped click budget passed               |
| B5 / SLICE-009 | REQ-007/009 / AC-007/009 / QA-004/006/009 / DEC-014                     | Contract R, optimized browser motion and final S0 evidence | Owner must accept fallback if qualification fails | Automated and anchor budget passed; manual motion open |
| B6 / SLICE-010 | REQ-010 / AC-010 / QA-006/009                                           | No new decoration implemented                              | Existing selection styling retained               | Not selected, 23 October                               |

### 8.1 Existing test boundaries

Use the existing npm Jest entry point and tests for ontology menu, loading module, share links, search/navigation, sidebar/state presenter, controller contracts, renderer references, focuser/pick-and-pin, runtime conformance, export clone/drawing export, WebMCP detail consistency and page/CSS behavior.
Add independent fixtures where those tests do not express the new contract.
The honest runtime double cannot prove actual DOM focus, geometry, paint or accessibility.

Format/lint the exact commit scope before any authorized commit.
Current HISEW profiles are `focused → npm run lint`, `affected → npm run test`, `full → npm run check`, with 600-second command timeout and no declared coverage/input order.
Reinspect before execution; final assurance uses the accepted full relevant route after stable implementation and issue resolution.
Consolidate changes before broad review and keep follow-up reviews narrowly scoped.
Reserve external review for the final implementation commit candidate, after the full required automated tests have run and their issues have been resolved.
Retain the owner's reviewer selection: AGY with Flash 3.8 on High and a 60-minute timeout, without additional turn, token or spend limits.
If that review produces fixes, verify their affected behavior and refresh broader evidence only where changed inputs or unresolved risk require it; preserve failed attempts.
Keep browser and performance proof separate.

### 8.2 Browser and accessibility matrix

| Area                 | Required checks                                                                                                                                                 |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Browser engines      | Chrome/Blink, Firefox/Gecko and Safari/WebKit; desktop and actual mobile cases where required                                                                   |
| Keyboard             | E1–E6, arrow/Alt navigation, Escape layering, Tab order, modal containment, non-modal escape and focus return                                                   |
| Assistive technology | NVDA+Firefox/Chrome, JAWS+Chrome, VoiceOver macOS/iOS Safari, TalkBack Android Chrome; active versus committed announcement, group descriptions and live status |
| Reflow               | Separate checks for 200% zoom and reflow at 320 CSS px equivalent, plus text spacing, narrow landscape, long labels/IRIs and keyboard viewport                  |
| Visibility           | Focus ring/contrast, focused-control non-obscuration, selected-anchor keep-clear when B5 is selected                                                            |
| Targets and gestures | Applicable 24-by-24 CSS px target minimum and its defined exceptions; aim for 44 px controls; no drag-only essential action                                     |
| Preferences          | Reduced motion and Windows forced colors; no hidden animation or illegible badges                                                                               |
| Graph continuity     | Drag/pan/zoom, pause/resume, pick-and-pin, inline edit, reveal/clear, reset and source replacement                                                              |
| Performance          | S0 B4 and PH-1–PH-4 on the consolidated optimized candidate after section 8.3; retain source/workload identity and avoid competing acceptance work              |
| Export               | Same semantic/canonical bytes and fixed-state geometry with surfaces/decoration open and closed                                                                 |

Record the actual engine/device/AT version and test result.
Windows Chromium or emulated WebKit does not prove real iOS VoiceOver or Safari behavior.
Maximize automated coverage first and collect unavailable or irreducibly manual coverage in the single final owner batch in section 8.4.
Unavailable required coverage still needs an accountable release disposition; batching it does not waive it or turn it into a pass.
The pre-existing `user-scalable=no` limitation remains visible in acceptance; do not claim whole-app WCAG conformance or silently change it under this task.

### 8.3 Optimization before foreground measurement

On 23 October the owner authorized foreground measurements to resume, but only after other avenues have been exhausted and optimized code has been produced.
This changes the future measurement order; historical deferred or rejected timings remain deferred or rejected.

1. Reuse the delivered architecture/performance evidence and inspect the new UI paths statically.
   Identify avoidable copies, repeated description work, layout reads, redundant subscriptions, stale callbacks and unnecessary per-frame or hidden-tab work.
   Do not collect foreground acceptance timings of an unoptimized draft.
2. Use focused tests, headless browser checks, counters and targeted traces to diagnose the actual problems.
   Implement the selected optimizations and fixes, prove semantic equivalence, lifetime and export safety, and resolve actionable findings within scope.
   Retain only baseline collection needed for a concrete comparison; do not expand baseline cohorts before fixing known waste.
3. Consolidate the optimized code and complete the relevant correctness, browser/accessibility automation and full automated checks. Record the diagnostic avenues used, issues resolved and any residual limit with its evidence and disposition. The foreground gate opens when available static/headless/counter avenues have been exhausted for the identified issues and no known actionable optimization or correctness defect remains unaddressed within scope.
   Functional headed-browser checks needed to verify focus, input or layout may run earlier; they are not acceptance timing cohorts.
4. Run foreground paint, selected-anchor/compositing and H1–H4 load/settle measurements against that optimized production candidate.
   Keep valid workload/source identities, real visibility, separate timing/trace/counter passes and the applicable S0 calibration/comparison controls.
   CPU-exception readings retain their recorded scope and contended-host labels; do not silently change shared defaults or treat noisy results as accepted improvements.

The inherited W5 `all` click-to-painted-details target remains lab p95 at most 200 ms; it is not field INP conformance.
Record actual minimum usable canvas width/height and explicit anchor/frame budgets before final acceptance runs.

Before foreground collection, the implementation selects a conservative docking minimum of 640 CSS pixels of remaining canvas width and 480 CSS pixels of height, with docking only above the existing 1024 CSS pixel boundary.
The calculation reserves the largest existing 360 CSS pixel inspector token; current measured wide layouts may use 280 or 320 pixels.
A smaller or shorter viewport uses a modal surface, preserving the full canvas when it is closed.
These are candidate usability thresholds to verify, not a claim about every device.
For B5, require at most one queued placement per animation frame, no per-tick SVG measurements or whole-arrangement copies, no hidden-tab frame work, and no queued transition after interruption.
On the optimized foreground cohort, target anchor JavaScript p95 at most 1 ms per active frame and no anchor-attributable task above 50 ms.
Keep the inherited W5 click-to-painted-details p95 at most 200 ms.
Measure overall frame intervals and compositor activity separately; a 200 ms animation duration or transform-only implementation does not prove smooth frames or GPU compositing.
Retain CPU-contention qualifications and do not reinterpret a missed budget as a pass.
The proposed 180–240 ms motion duration and roughly 40% compact height are calibration starting points, not performance pass criteria.
Reduced motion removes translation/scaling; interrupted transitions establish the latest target state within one frame without queued animations.
Do not require successful foreground timing before B3/B5 can be implemented and optimized, and do not mark their final timing acceptance passed until it is measured.
If final measurements reveal a regression, return to focused diagnosis and fixes, then repeat only the affected qualification; do not weaken budgets or silently drop B5.

### 8.4 Automated coverage and one final manual-validation batch

The owner requested: "Get as far as you can with automated testing of this, if there are others I need to validate manually, batch them all up at the end."
This is the execution policy for the browser and assistive-technology matrix, not permission to substitute simulation for an actual platform result.

Use available automation to exercise the real UI in each accessible browser engine, including keyboard submission/selection, focus and Escape behavior, modal containment/return, accessibility names/roles/states, live-status structure, responsive layout, text spacing, preferences, hit targets, stale-selection prevention and graph/export continuity.
Use native accessibility-tree inspection and existing automated accessibility checks where available, plus actual assistive-technology automation where supported.
Automated DOM/tree checks and synthesized keyboard events are partial evidence for screen-reader behavior; they do not establish spoken announcements, reading order, touch exploration or real mobile keyboard usability on an untested device.
Do not report browser emulation as actual Safari/iOS, VoiceOver, JAWS or TalkBack coverage.
Use existing tools first; a needed package, lockfile, test configuration or CI change still requires exact approval under section 9.

Maintain one coverage ledger throughout implementation with the test case, engine/OS/device/AT version, candidate identity, automation method, actual result and residual gap.
Distinguish actual-platform passes from proxy/emulated coverage, failures, unavailable cases and checks requiring human judgment.
Fix automated failures before assigning residual validation to the owner.
Unavailable manual-only coverage does not block independent implementation; a demonstrated semantic or accessibility defect still requires repair or an explicit changed disposition.

After optimized implementation, automated checks, authorized foreground qualification and final review/fixes, deliver one consolidated manual-validation packet for the exact candidate.
Include every remaining required check across the named browser/AT combinations, grouped by platform and deduplicated into short scenarios.
Each scenario must specify:

- Exact build/commit and launch location, fixture and starting state, plus required browser/device/AT and settings.
- Numbered keyboard, pointer or touch steps, including any real mobile keyboard, zoom/reflow or forced-colors behavior that automation could not establish.
- Expected visible behavior, focus destination and screen-reader announcement or reading behavior, with a concrete pass/fail condition.
- The automated evidence already obtained, why manual validation remains necessary, and a compact place to record the actual versions, result and failure evidence.

Do not send piecemeal owner-testing requests while individual slices are still changing.
Ask earlier only for a genuinely blocking product, scope or exact configuration decision, rather than asking the owner to perform a test that can wait for the final batch.
If a required platform is unavailable to both the agent and owner, retain it as an explicit release decision in that same packet; do not silently remove the requirement.
After any manual finding, fix and recheck the affected flows; request only necessary follow-up scenarios against the new candidate, with the reason for repetition stated.

## 9. Configuration, trust boundaries and release

The original UI design required no shared configuration change.
During final qualification on 23 October, the owner explicitly requested alignment with the installed Node/npm/Python/uv versions and DRY declarations, following the other local repositories.
The accepted amendment updates `.node-version` to Node 24.22.1, `.python-version` to Python 3.15.1 and npm's native minimum in `package.json` to 12.2.1, and records uv 0.13.5 in `.uv-version`.
The local npm and uv versions were confirmed against their official current releases.
The duplicate `packageManager` exact npm selector is removed: `util/installSelectedNpm.mjs` derives the exact CI reference from the native `devEngines.packageManager` minimum, as in the HISEW repository's runtime projection pattern.
The shared `util/runtimeTargets.mjs` validates the four maintained declarations and supplies CI outputs; `.github/workflows/webvowl-ci.yml` consumes its uv output, while existing Node/Python consumers retain their version-file references.
README references replace repeated runtime literals, and setup/Python projections use the shared reader.
This changes development/CI selection and admission, not the application dependency graph or browser target.
No global runtime installation, dependency upgrade, lock refresh or policy weakening is part of this amendment.
The previous full run remains valid for its recorded runtime; verify the new toolchain and preserve both identities.

The following are possibilities, not approved edits:

| Possible exact scope                                                  | Behavioral/pipeline impact                                   | Smallest planned treatment                                                                                                              |
| --------------------------------------------------------------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| `package.json`, `package-lock.json`, new browser-test config/workflow | Adds automated browser/accessibility tooling and CI cost     | Maximize existing automation first; propose exact package/settings only for a demonstrated gap; batch residual manual checks at the end |
| HTML-validation policy or a new lint-suppression directive            | Changes enforced markup rules                                | Seek a conforming implementation first; no policy relaxation is preapproved                                                             |
| `vite.config.mjs` benchmark-strip behavior                            | Build cleanup for removed benchmark link                     | Leave unchanged unless a reproduced build problem requires an exact proposal                                                            |
| `src/index.html` viewport meta                                        | Changes zoom/accessibility behavior beyond reviewed surfaces | D-15 separate scope and explicit decision                                                                                               |
| Browser support target / new polyfill                                 | Changes supported clients and shipped bytes                  | Preserve target; no new shim without scoped NSH-01 approval                                                                             |

Render hostile labels/annotations as text, constrain actionable URL protocols and preserve request credentials/import limits.
Keep raw private ontologies, browser traces and screenshots in restricted evidence storage.
A catalogue entry is not a claim that its external endpoint is always reachable.
Use the native security workflow for selected URL/rendering trust-boundary changes when approved; unavailability is a named evidence gap.

No schema migration, backfill or saved UI-state migration is planned.
After interruption, reread source, accepted decisions, execution ownership and the last slice disposition.
Dispose task-owned frames/listeners/observers and preserve review evidence.
Cleanup never discards user-owned work or shared deployment files.

## 10. Completion, rollout and recovery

Each slice records merge or terminal gate identity, evidence, reviewer and remaining limitation.
A1–A4 plus B1–B5 are selected; B6 is closed as not selected.
A1–A4 plus B1–B4 is a possible reduced delivery only if the owner explicitly accepts a failed B5 qualification and the measured remaining occlusion/motion limitations.
Unresolved semantic completeness or accessibility failures are not a successful fallback.

UI decisions are accepted, but implementation, measured acceptance, manual coverage and release remain separate states.
Finish automated and foreground work in the order above, then give the owner the single residual manual-validation packet before claiming complete required browser/AT qualification.
The selected source implementation and final reviews are now complete; the handoff records retained measurement limits and HISEW bookkeeping limitations without treating either as native completion or deployment approval.

Before an authorized rollout, the release owner qualifies the exact build on existing routes and real H1–H4 loads, completes required browser/AT/performance dispositions and retains the prior qualified artifact.
Observe loading failures, duplicate submissions, `LOAD_PENDING`, stale previews, console errors, focus loss, frame cost and export differences.
Abort rollout for accidental loads, semantic omission, identity mixing, layout mutation, inaccessible controls or a corroborated regression.
Rollback must cover contract R and its consumers together; otherwise use a qualified forward fix.
Merge, hosted CI, deployment and observed live acceptance remain distinct claims.

Replan if a required UI read/selection contract is absent, the owner chooses a different shape rule, browser/AT behavior defeats the proposed semantics, motion budgets fail, H1–H4 need changed loading policy, or a new configuration/dependency becomes necessary.
Expected architecture/performance changes are inherited facts.
The final outcome is clear source choice and complete, usable details with an interactive graph; a polished animation alone does not satisfy it.
