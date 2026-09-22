# CommonJS-to-ESM implementation plan

Status: detailed draft, 20 September 2026.
Prepared for owner review; not an accepted implementation baseline or evidence that the migration has been executed.
Configuration, commit, push and release authority remain separate.
The requested deliverable is this plan; its implementation gates are not prerequisites for writing it.

**Goal:** give every maintained JavaScript artifact under `src/` an explicit ESM contract, remove compatibility-only first-party loading, and preserve application, converter, test and delivery behavior.

**Architecture:** retain the existing application/controller/renderer/converter seams.
Prefer one explicit source-local package scope, migrate tests to the consumer's supported ESM loader, and extend the existing architecture gate to all source paths.
Include production D3 consumers and D3 delivery in the ESM graph.
Keep genuine module-linking tests, supported external dependency interoperability and existing lazy parser boundaries.
Retire classic D3 delivery and global-reference injection in a coordinated cutover, then assess optimizations against the ESM baseline.

**Owner-directed scope revision:** the subsequent request to move D3 to ESM supersedes this plan's earlier requirement to preserve classic D3 delivery and the proposals' exclusion of that work.
This selects the design direction; exact configuration mutations still require approval under repository instructions.
It does not select a D3 upgrade or assert a performance benefit.

**Baseline:** [change dossier, revision 2](change-dossier.md), especially REQ-001–009, AC-001–009, QA-001–007 and DEC-001–006; [source-wide proposal](CommonJS-to-ESM-src-playbook.md); [historical implementation analysis](CommonJS%20to%20ESM_%20an%20implementation%20playbook%20grounded%20in%20WebVOWL.md).
The source-wide proposal defines the original scope; the subsequent owner-directed D3 extension takes precedence.

**Planning snapshot:** Git `10ca87172d466372756c765a6d30714836c54b1c`.
All file assignments below are predictions to reconcile against SLICE-001, not instructions to modify already-compliant files.
No application implementation is included in this document.

## 1. Constraints and reasoning

### First principles

A source-format migration is a change to interpretation, linking and evaluation.
Preserve observable values, object identity, receiver semantics, initialization, ordering, error propagation and synchronous/asynchronous boundaries.
Count source syntax, consumer interpretation, dependency boundaries and behavior separately.
A source census and a graph census answer different questions: disconnected files belong to the former even when absent from a production graph.

The purpose is a simpler supported loading model for maintainers with preserved behavior for users.
Fewer CommonJS matches, fewer files, smaller bundles or a green architecture test are insufficient outcome proxies.
No speed improvement is assumed.
Do not refactor APIs, introduce classes, replace D3, upgrade dependencies or redesign ontology/WebMCP behavior merely to accompany the conversion.

Use the smallest package boundary that expresses the selected scope.
Prefer `src/package.json` over root `type: module`, because root interpretation would affect unrelated tooling.
Qualify that choice before activation.
If it cannot preserve the required consumers, reopen DEC-001 with evidence; do not silently choose a broader root migration.

### Authoritative specifications and guidance

The [ECMAScript 2026 module specification](https://tc39.es/ecma262/2026/multipage/ecmascript-language-scripts-and-modules.html) governs linking and evaluation.
[Node package interpretation](https://nodejs.org/api/packages.html) and [Node ESM guidance](https://nodejs.org/api/esm.html) supply host contracts.
Require explicit relative file specifiers, deliberate package scopes and stable resolved identities.
The live Node pages inspected were v26; qualify version-sensitive behavior on the repository's accepted v24 runtime before adoption.

[Jest's ESM guidance](https://jestjs.io/docs/ecmascript-modules) distinguishes ESM transforms, VM activation and pre-import mock registration.
Keep the current VM launch flag while removing the repository loader.
A module mock must be registered before its subject's graph is imported.
Verify isolation explicitly instead of assuming a repeated import creates fresh state.

[Vite's dependency guidance](https://vite.dev/guide/dep-pre-bundling) explains why dependency CommonJS handling is distinct from authored-source conversion.
Production and development delivery require their own checks.
Neither removal of first-party CommonJS nor a successful development server proves a build plugin is redundant.

### Community practice and preferences

The [maintainer discussion of moving to ESM](https://github.com/sindresorhus/meta/discussions/15) provides experience with coordinated migration, not a binding contract or universal consensus.
Apply the proposal's project-specific lessons: coherent consumer groups, exact shrinking exceptions and removal conditions.
Prefer direct reviewed edits if the verified remainder is small.
Any codemod must use maintained syntax tooling and receive the same semantic review as manual edits.

The user's evidence order governs this plan: first principles, authoritative specifications/guidelines, community practice, then individual preference.
Existing interoperability contracts and permission boundaries constrain every stage.

## 2. Evidence available and its limits

| Observation from this planning session                                                                                                                                              | Consequence                                                                                                                                                                                                                      |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 251 tracked JavaScript paths: app 90, shared 42, webvowl 81, owl2vowl 28, source-root 10.                                                                                           | Refresh the historical 236-file census; never use 236 as the final denominator.                                                                                                                                                  |
| Confirmed executable CommonJS remains in `src/app/js/languageSelection.test.js` and `src/app/test/loadEsmModuleForTest.js`.                                                         | Convert the former; retire the latter after consumer convergence. This is a verified minimum, not an exhaustive semantic classification.                                                                                         |
| Read-only dependency-cruiser invocation over `src` returned 279 module records; inspection reported no unresolved or circular source dependencies.                                  | Reuse the native graph tool. Do not equate 279 graph records with 251 authored paths or with runtime success. Repeat after changes and retain full graph evidence.                                                               |
| Loader references span shared utilities/filters, renderer, controller, UI, menus, WebMCP and converter tests.                                                                       | Treat test migration as coherent behavioral work, not one helper deletion.                                                                                                                                                       |
| `productionBundle.integration.test.js` links actual emitted chunks with `SourceTextModule`.                                                                                         | Retain this legitimate VM use and its missing-chunk/export oracle.                                                                                                                                                               |
| `ontologySourceLoader.test.js` synthesizes dependency modules; `webVowlController.test.js` has another ordinary repository-module cache/loader.                                     | Classify and retire duplicated ordinary loading, not only imports of the shared helper. Preserve the dependency/error identities their substitutes currently carry.                                                              |
| `sidebar.js` owns browser-language selection; `languageSelection.test.js` embeds its own algorithm.                                                                                 | Preserve existing cases, but use the production sidebar boundary for behavioral preservation evidence.                                                                                                                           |
| Jest `--showConfig` reports default `babel-jest` transformation, empty setup-file arrays and no module reset by default.                                                            | Disabling transforms and changing setup order require qualification; inspect resolved config after each approved change.                                                                                                         |
| Host Node is v24.21.0; repository pin is 24.20.0. Installed Jest package is 30.5.1 while config output identifies 30.5.0. Installed Vite is 8.2.2 while manifest requests `^8.3.0`. | Existing node_modules are not a reproducible qualification baseline. Reconcile lock, installed packages and accepted runtime in an isolated checkout before recording baseline passes. Do not change pins to match this machine. |
| A proposed AST inventory command was rejected by DCG because its file-writing operation was classified as unsafe.                                                                   | It did not run and produced no analysis artifact. Exhaustive AST classification remains SLICE-001 work. Do not bypass the guard or describe textual searches as that evidence.                                                   |

Research and command inspection are the evidence produced here.
No full application test run, native-loading pilot, build or browser acceptance is claimed.
The graph command was `node node_modules/dependency-cruiser/bin/dependency-cruise.mjs --no-config --output-type json --do-not-follow node_modules src`.

## 3. Configuration decisions to approve before effects

Planning these exact candidates does not authorize applying them.
The implementation owner presents the smallest actual diff and its evidence under repository AGENTS.md.

| Gate    | Exact candidate                                                                                                                                                                                                                    | Behavioral and pipeline impact                                                                                                                                                                                                  | Decision condition                                                                                                                                                                                                                           |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CFG-001 | Create `src/package.json` with `{"private": true, "type": "module"}`.                                                                                                                                                              | Reclassifies `.js` beneath src until a nested package boundary; affects Node/Jest loading and resolution. Does not change root tooling interpretation.                                                                          | Owner approves the exact creation for the pilot and cutover. Preserve existing converter package.                                                                                                                                            |
| CFG-002 | In root `package.json`, add `jest.transform: {}`.                                                                                                                                                                                  | Disables the observed default transformer for all discovered tests; must preserve every required test and syntax feature. Existing test script/VM flag remains.                                                                 | Apply only if the pilot selects this supported ESM setup; approve the exact setting first. If existing transform already emits valid ESM, retaining it is an alternative requiring evidence.                                                 |
| CFG-003 | Remove `vite-plugin-commonjs` import and `commonjs()` from `vite.config.mjs`; remove only that devDependency in `package.json`; regenerate corresponding `package-lock.json` changes with selected npm.                            | Changes dev/build handling and dependency graph. Native third-party compatibility remains; D3 delivery changes are separately specified by CFG-005.                                                                             | Only after source conversion, dependency-boundary proof and approved exact patch; reject unrelated lock churn.                                                                                                                               |
| CFG-004 | Any newly discovered lint, test-discovery, CI, toolchain or repository-policy correction.                                                                                                                                          | Depends on consumer; cannot be pre-authorized generically.                                                                                                                                                                      | Stop only the affected implementation step; identify exact file/setting and minimal impact before asking. No speculative config edits in this plan.                                                                                          |
| CFG-005 | In `vite.config.mjs`, remove `d3ProvidePlugin`, `d3InjectScriptPlugin`, `d3DistributionPlugin` and their plugin-array calls after converting their consumers. Remove imports/constants only when those removals leave them unused. | D3 resolves from the installed package through Vite's ESM graph; removes injection of the local global alias, classic script tag, custom dev asset route and distribution-file copying. Changes startup and asset expectations. | Present the exact patch for approval before effects. Do not add chunking overrides, change D3 version or delete unrelated plugins. Retain current general output naming/base-path settings unless a separately evidenced change is approved. |

No `.cjs` renaming escape hatch, new shim, broad ignore, root `type` change or `sideEffects: false` is selected.
If temporarily retaining the existing helper is necessary between slices, its existing exact exception remains until removal.
Reclassifying it under `src` while it still executes CommonJS is not an acceptable intermediate release.

## 4. Ownership, dependencies and integration

Maksy accepts requirements, risk and consequential decisions.
The implementing engineer owns the census, changes, evidence and integration.
An independent reviewer owns verification of semantics, test credibility and required R2 assurance; assign that person/provider before implementation acceptance.
This plan does not dispatch agents or authorize parallel writes.

The critical path is SLICE-001 → SLICE-002 → SLICE-003/004/005 → SLICE-006 → SLICE-007 → SLICE-008.
SLICE-002 is a disposable experiment until approved coherent changes are ready.
Source-scope activation, the remaining CJS test and helper removal meet in the atomic SLICE-006 cutover.
If earlier tests cannot migrate under unchanged interpretation, hold their changes in the same integration change as SLICE-006 rather than publishing an unexecutable intermediate state.

Independent preparatory work can include consumer classification, browser-oracle documentation and source-gate controls.
Consumer groups can be edited independently only after their import/setup contracts are fixed and files do not overlap. Package/build manifests and the architecture gate have a single integration owner.
Do not have separate workers invent competing mocking or package-scope conventions.

## 5. Implementation slices

### SLICE-001 — Reproducible baseline and complete source accounting

**Purpose:** establish what remains and the behavior that must survive.
Links: REQ-001,003,004,008; AC-001,003,004,008; QA-001,002,004; DEC-001–003.

**Predicted inputs:** Git source inventory; all nested package manifests; `src/productionModuleFormat.architecture.test.js`; `src/testRunnerScope.architecture.test.js`; root package/lock/runtime pins; `.github/workflows/webvowl-ci.yml`.
Preserve the historical census.
Record fresh evidence separately, with exact revision and local-diff identity.

- [ ] Prepare an isolated implementation checkout while preserving unrelated work.
      Inventory tracked and untracked source separately; use NUL-delimited Git output when machine-parsing paths.
      Include `.js`, `.mjs`, `.cjs`, dormant files and source-root tests.
      Unexpected extensions require an explicit scope decision.
- [ ] Establish the accepted runtime and lock-resolved environment using repository setup, without changing configuration or global tools to accommodate a mismatch.
      Record runtime, npm, lock digest and actual package versions.
      Treat dependency-install/configuration changes beyond existing approval as a separate gate.
- [ ] Reuse the existing ESLint-backed analyzer and dependency-cruiser data to classify source syntax, package interpretation, imports/exports, free CommonJS mechanisms, side effects, dynamic loading, identity and test setup. Keep inferred value-flow findings advisory. Parser/resolver failure is a blocking classification result.
- [ ] Give every path a disposition: already ESM, format-neutral under ESM scope, convert, retire with consumer evidence, or explicit vendor/generated/negative-fixture decision.
      Record unresolved cases; no broad ignored directory.
      Record each remaining CJS/hybrid dependency group and all importers.
- [ ] Enumerate shared-loader calls and independent VM loaders.
      For each, record subject, substituted dependencies, globals installed before evaluation, identity/cache expectations and whether module linking itself is the test's subject.
- [ ] Capture effective Jest configuration and machine-readable test discovery.
      Run baseline focused and full tests with the pinned corpus prerequisites; retain failing cases separately as existing failures.
      Record baseline production/development/browser outcomes using the later verification matrix.

**Output contract:** a path-complete ledger, dependency-group map, loader-consumer register and baseline evidence on one identified snapshot.
The ledger is evidence, not a new repository policy file.
Each exception has path, reason, owner, content identity and removal condition.

**Exit proof:** census and analyzed path sets reconcile; no missing parse/resolution result; every consumer group has a real behavior oracle.
The baseline may have known failures, but each affected acceptance path must have usable comparative evidence or an explicit blocker.
Never label a broken baseline green.

**Recovery:** inspection is reversible; preserve its evidence.
Remove only owned disposable outputs under normal cleanup authority.
No source/configuration rollback is required for inspection alone.

### SLICE-002 — Qualify the proposed loading boundary through real tests

**Purpose:** decide the execution model before converting dozens of tests.
Links: REQ-002–004; AC-002–004; QA-002,004; DEC-001,002; CFG-001,002.

**Predicted files:** proposed `src/package.json`; root `package.json` only if CFG-002 approved; `src/shared/js/util/continuousZoomRamp.test.js`; `src/webvowl/js/elements/links/ArrowLink.test.js`; `src/app/js/webmcp/webMcpToolContracts.test.js`; a setup-sensitive renderer-runtime test selected from SLICE-001's consumer register; a substitution-sensitive test only if that register establishes a genuine module-substitution requirement.
Record the selected paths and their setup/substitution contracts before the pilot.
These are representative pilot consumers, not the whole migration.

- [ ] Obtain exact configuration approval before creating or changing package files, including in a disposable checkout.
      Compare unchanged interpretation with the proposed source-local scope using the same test subjects and assertions.
- [ ] Replace the pure utility's compatibility load with the ordinary import of `nextContinuousZoomScale`; preserve existing 60/120 Hz and bounds cases.
      This tests actual loading without changing utility behavior.
- [ ] Qualify a constructor-sensitive renderer graph with its real constructor and real required D3 setup.
      Assert existing drawing contracts and add identity assertions only where the existing suite lacks them.
      Choose static import only when its transitive evaluation is independent of later global setup.
- [ ] Replace the WebMCP test's synthetic `owlapi/formats` namespace with the real exported `OWLDocumentFormats` when it is simply passing through the production object.
      If a true substitute is needed, register the supported Jest ESM mock before dynamically importing the subject and all affected consumers.
- [ ] Exercise the census-selected setup-sensitive renderer-runtime graph through ordinary loading, preserving its required globals/DOM setup and initialization order.
      D3 use in the ArrowLink test harness alone does not qualify runtime initialization.
      Record which dependencies require setup before evaluation versus before invocation.
- [ ] If the consumer register identifies genuine module substitution, qualify one such consumer before selecting the loading model: prove the intended replacement reaches the subject, shared dependency/error identities survive, and mock/state isolation holds individually and with related suites.
      The WebMCP pass-through namespace alone does not prove replacement.
      If ordinary imports and existing injection boundaries cover every consumer, record that evidence instead of introducing a mock solely for the pilot.
- [ ] Compare the effective transform configuration.
      Prefer the explicitly qualified no-transform setup for plain JavaScript when it passes all required consumers; do not infer its necessity from a historical loader comment.
- [ ] Verify test discovery, nested converter imports, default/named exports, errors, dependency identity and isolation.
      Record which setup requires deferred import and why.

**Exit proof:** the three named paths and the selected setup-sensitive runtime path load and exercise the same production behavior through ordinary loading, with no new wrappers or URL cache busting.
Any genuine module-substitution requirement has replacement, identity and isolation evidence, or the register establishes that none is needed.
Store a selected DEC-001/002 decision and exact configuration diff. Run the relevant interpretation/gate and converter-boundary checks as well as the pilot tests.

**Failure branch:** if a default transform, package export or import-order defect appears, diagnose that consumer and rerun only after a changed hypothesis.
If the source-local scope cannot meet a supported contract, return evidence and a minimal alternative for owner decision.
Do not pre-approve root migration, dependency upgrades or a shim.

**Release:** experiment only.
A local pilot can fail while unchanged tests still use the helper; it must not become a released half-cutover.
Preserve the experiment's results and integrate only the coherent final route.

### SLICE-003 — Native loading for utilities and independent test subjects

**Purpose:** remove compatibility loading from low-coupling behavior first.
Links: REQ-003,004; AC-003,004; QA-004; DEC-002.

**Predicted files:** tests under `src/shared/js/util/` including `continuousZoomRamp`, `prefixRepresentationModule`, `textTools`, `math`, `AbstractTextElement`; tests under `src/shared/js/modules/` including `datatypeFilter`, `nodeDegreeFilter`, `objectPropertyFilter`, `setOperatorFilter`, `subclassFilter`, `focuser`, `pickAndPin`; `src/app/js/ui/browserPaintObserver.test.js`; `src/app/test/inMemoryRenderedGraphAdapter.test.js`.
Reconcile names against the consumer register.

- [ ] For each group, import actual production exports directly where evaluation is safe.
      Retain fixture/factory creation per test at its existing lifecycle point; importing a factory must not call it early.
- [ ] For math/text/filter tests that install D3 or DOM state, trace transitive module evaluation before deciding static versus dynamic import.
      Keep setup local to the test's actual need.
- [ ] Remove now-unused loader variables and setup hooks only when no other setup depends on them.
      Preserve assertions for numeric boundaries, filtering and receiver behavior; do not rewrite expected values from the subject under test.
- [ ] Run exact changed test files plus their affected production contract tests and source-format checks.
      Confirm consumer-register entries are closed only when actual call sites are removed.

**Exit proof:** ordinary-loaded utility/filter subjects preserve results and per-test state; affected discovery is unchanged. No production API change is expected. Newly discovered real CJS production leaves use the smallest export/import conversion with their consumers in this slice, or move to SLICE-004 if coupled.

**Recovery:** reverse a complete test/import group if needed.
If source interpretation is required for its executability, hold the group for SLICE-006 rather than creating a temporary compatibility layer.

### SLICE-004 — Renderer, constructor and converter graph convergence

**Purpose:** preserve identity and renderer semantics while removing alternate module graphs.
Links: REQ-003,004,007; AC-003,004,007; QA-002,005; DEC-002,004.

**Predicted files:** `src/webvowl/js/parser.test.js`, `graphRendering.test.js`, `graphViewport.test.js`; tests beneath `elements/` and `runtime/`; `src/owl2vowl/test/vowlBuilder.webvowl.test.js`.
Production constructor registries such as `elements/nodes/nodeMap.js`, their constructor definitions and consumers are read/changed only if the census proves migration work is necessary.

- [ ] Migrate a complete constructor family and consuming parser/test graph together.
      Preserve the same constructor object across imports, `instanceof`, prototype behavior and shared registry state; do not change a singleton-returning accessor into a fresh-map factory.
- [ ] Retain D3/DOM initialization order and actual geometry/label/link/viewport assertions.
      Qualify expected error and initialization behavior for any dependency cycle discovered after baseline.
- [ ] Convert the converter-to-WebVOWL parser integration to the same ordinary-loaded parser graph.
      Run real builder/parser expectations, supported-format and semantic differential checks; never regenerate expected output en masse to hide changes.
- [ ] For each independent renderer VM loader, determine whether it exists for setup/substitution or tests module behavior.
      Replace ordinary loading; preserve genuine module-test intent with explicit ownership.
- [ ] Inspect real browser drawing, pan/zoom/drag, label transitions and relevant SVG output for renderer groups whose evaluation or setup changed.

**Exit proof:** shared identities, registry lifetime and actual renderer/converter behavior agree with the accepted baseline.
Source files already ESM remain untouched unless required for an identified import contract.
If no production source needs conversion, report that result rather than inventing a production refactor.

**Recovery:** treat constructor definitions, registry imports and consumers as one reversible group; preserve related evidence and test fixtures.

### SLICE-005 — Controller, UI and substitution-sensitive tests

**Purpose:** preserve actual lifecycle and application behavior through one supported test graph.
Links: REQ-003,004,007; AC-003,004,007; QA-004,005; DEC-002.

**Predicted files:** controller tests, particularly `webVowlController.test.js` and `ontologySourceLoader.test.js`; `src/app/js/webmcp/` tests; UI presenter/control tests; menu tests; `loadingModule.test.js`, `ontologyEditorSidebar.test.js`, `sidebar.test.js`, `directInputModule.test.js`, `leftSidebar.test.js`, `warningModule.test.js`, `ontologyLifecycle.test.js`; `src/shared/js/ontologyEditingState.test.js`; `src/shared/js/util/resolveFetchUrl.test.js`.
Include independent VM loaders even when they never reference the shared helper.

- [ ] Remove `instantiateRepositoryModule`/`loadRepositoryModule` in the controller test after moving its subjects to ordinary imports.
      Preserve the actual controller, inspector, adapter and artifact-service contracts and their shared identities.
- [ ] In source-loader tests, distinguish real pass-through `owlapi` classes and converter functions from deliberate substitutes.
      Use real modules for pass-through values; retain actual external network substitution at the existing Fetch/injection boundary.
      Where module substitution is essential, apply qualified Jest mock ordering and isolation.
- [ ] Keep unexpected-dependency assertions as explicit architectural checks where that is their real purpose; do not preserve a general VM loader merely to enforce an import list.
- [ ] Preserve cancellation, stale request handling, byte/time limits, error identity, format selection, provenance and model publication assertions. These are trust/lifecycle boundaries; syntax gates are not their oracle.
- [ ] Convert `languageSelection.test.js` to ESM without claiming its copied algorithms test production.
      Cover exact locale match, primary-tag fallback, default selection and annotation display through the real `sidebar.js` behavior in `sidebar.test.js` and browser acceptance.
      Do not promote the copied test algorithm into production.
- [ ] Migrate UI/menu tests with their actual state/control interaction assertions, mock cleanup and setup order.
      Check suites individually and combined where order dependence is plausible.

**Exit proof:** real application subjects use ordinary loading; substitutions target the intended graph; no loss of cases or silent state sharing.
Focused controller/source-loader/WebMCP suites and related integration checks pass with equivalent error and cancellation behavior.

**Security lens:** review changed resolution/mocking boundaries for loss of real error/limit checks.
If dependency/build/loading trust boundaries change, perform the scoped route-required native security assessment; a test-only syntax edit alone does not justify an unrelated repository-wide scan.

### SLICE-006 — Atomic explicit-source cutover and complete gate

**Purpose:** make the complete source invariant true and enforce it for future files.
Links: REQ-001,002,004,005; AC-001,002,004,005; QA-001,002,004; DEC-001–003.

**Predicted files:** approved `src/package.json` and root Jest setting; `src/productionModuleFormat.architecture.test.js`; `src/testRunnerScope.architecture.test.js`; remaining source candidates from the ledger; retire `src/app/test/loadEsmModuleForTest.js` after its last real consumer.
Do not modify nested converter package without a separately demonstrated need.

- [ ] Integrate all scope-dependent test/source edits, the CJS language test conversion and helper deletion with the approved interpretation change.
      Every intermediate releasable state must work under its declared format.
- [ ] Extend the architecture test's existing recursive collection and analysis to every maintained `.js/.mjs/.cjs` source path.
      Keep existing layering and scoped export constraints separate from the new directory-wide invariant; do not apply a named-export-only policy to all pre-existing ESM APIs.
- [ ] Add interpretation checks for explicit source scope and nested overrides.
      A neutral file without import/export statements is valid under the explicit ESM package scope.
      A nested CommonJS package or explicit `.cjs` source fails unless an accepted artifact-specific disposition applies.
- [ ] Add isolated negative controls for disconnected CommonJS source, CommonJS tests outside old directories, hybrids, `.cjs`, malformed syntax and a nested CommonJS scope.
      Add positive controls for comments/strings, shadowed locals and format-neutral ESM.
      Do not weaken the production rule to accommodate negative fixture text.
- [ ] Fail on missing parser/graph evidence. Keep speculative escape analysis advisory unless independently established. Reuse maintained parser/resolver interfaces rather than growing another analyzer.
- [ ] Remove the exact retired helper exception and temporary entries; retain the historical record as history.
      Reconcile path additions/deletions, default test discovery and every ledger disposition.

**Exit proof:** zero ordinary compatibility-loader consumers; zero unresolved maintained source classifications; zero temporary first-party CommonJS exceptions; all controls behave as specified; native interpretation/linking and intended tests pass on the integrated snapshot.
`productionBundle.integration.test.js` retains its intentional chunk-linking VM test.

**Recovery:** package scope, test configuration, source imports, helper retirement and exception changes form a coherent transaction.
Reversing only `type` or restoring only the helper is not a supported rollback.

### SLICE-007 — Migrate D3 delivery and qualify build simplification

**Purpose:** put D3 consumers and delivery on the native ESM graph, preserve rendering behavior, and assess performance only after obtaining that working baseline.
Links: REQ-006,007,009; AC-006,007,009; QA-003,005,007; DEC-004,006; CFG-003,005.

**Predicted files:** production D3 consumers under `src/webvowl/js/runtime/`, reconciled against the census.
Current candidates are `renderedGraphInternals.js` and `colorExternalsSwitch.js`, which use free D3 identifiers, and `captureRenderedDrawing.js`, which already imports `color` from `d3` and requires compatibility verification rather than an assumed import conversion.
Include approved `vite.config.mjs` changes and conditional `package.json`/lock removal of the CommonJS plugin.
Update `src/productionBundle.integration.test.js`, `src/d3DevelopmentAssetServing.test.js` and `src/d3DevelopmentServer.integration.test.js` to qualify the new ESM delivery contract.
Rename tests whose old asset-serving names no longer describe their purpose, updating every reference and test-discovery expectation.
Inspect `src/index.html` and documentation for obsolete classic-D3 references.
The lazy-parser verifier remains a consumer of the required parser boundary.

- [ ] Extend SLICE-001's inventory to every free D3 identifier, explicit D3 import, global assignment, classic-script reference and D3 prototype augmentation.
      Record baseline cold/warm startup and rendering measurements before changing delivery so the later comparison has a control.
- [ ] Use direct package imports in each production consumer.
      A namespace import is a conservative initial translation for existing `d3.*` calls; use named imports where their equivalence is clear.
      Do not introduce a wrapper that returns `window.d3`, a fallback namespace probe, or separate per-consumer copies.
      Preserve functions' receiver semantics and any required module side effects.
- [ ] Preserve the D3 confinement enforced by `src/renderedGraphDecoupling.architecture.test.js`: do not introduce production D3 dependencies into application modules, shared utilities or renderer elements outside `src/webvowl/js/runtime/`.
      Run that architecture suite as part of this slice; do not weaken its boundary to accommodate the migration.
- [ ] Coordinate imports with removal of `d3ProvidePlugin`: its current unconditional local `var d3` injection can conflict with an imported `d3` binding.
      Do not publish a half-cutover or add a temporary heuristic to conceal that conflict.
- [ ] Keep all selection/transition/force consumers on one resolved dependency graph.
      Check prototype augmentation, transition availability, event handling and identity across consumer boundaries; verify the production graph does not ship a second classic D3 implementation alongside ESM.
- [ ] Remove D3 global setup from tests only where the actual migrated graph no longer needs it; keep DOM setup and behavioral assertions.
      Replace classic-asset byte/path assertions with real ESM resolution, shipped-chunk linking, cold-server and rendering assertions.
      Do not delete delivery coverage merely because the old route is retired.

- [ ] Establish each remaining consumer of the CommonJS plugin.
      Distinguish source conversion from external dependency interoperability.
      If a supported consumer still requires it, retain it and record the reason; removal is conditional, not a prerequisite for declaring authored source ESM.
- [ ] After exact approval, remove D3 provision/injection/distribution together with converted production consumers under CFG-005.
      Separately remove the CommonJS plugin only if redundant under CFG-003.
      Keep D3 as the existing package dependency; no upgrade or new dependency is implied.
      Preserve general base path, output naming and lazy parser boundaries.
      Do not force a standalone D3 chunk without measured need.
- [ ] Use fresh owned build output or explicitly inventoried output because `emptyOutDir: false` permits stale artifacts.
      Do not recursively clear user-owned `deploy/` or alter this setting as a shortcut.
- [ ] Run production build and lazy-parser verifier in that order before development build can overwrite output.
      Exercise the production bundle-linking test, D3 tests, cold dev startup and production preview under the supported relative base path.
- [ ] Treat `productionBundle.integration.test.js` as generated static import/export compatibility evidence: it builds with `write: false` and links generated chunks without evaluating them.
      It does not prove on-disk asset delivery, runtime initialization, lazy loading or rendering.
      Establish those through the production artifacts, lazy-parser verifier and browser checks above.
      Inspect actual D3 chunk placement and parser boundaries after building; neither a particular vendor chunk nor unchanged lazy boundaries follows merely from adding ESM imports.
- [ ] Inspect network delivery, chunk timing, required fonts/CSS and absence of missing assets or new console errors. Confirm no emitted classic `d3.min.js` script reference or reliance on `window.d3`/`globalThis.d3` remains.
      Inventory old output to prevent stale classic assets from hiding a missing ESM import.
      Test dependency shapes on both Node/Jest and Vite paths where used.
- [ ] With the working ESM build established, compare repeated runs on the same browser, hardware, fixture identities and interaction sequence: cold/warm time to usable graph, transferred bytes, parse/evaluation cost, simulation tick cost, frame-time distribution and dropped frames during drag/zoom. Separate force computation from DOM/rendering cost.
      Report medians and tail behavior with run variability; no arbitrary improvement threshold is assumed.
- [ ] Only if profiling identifies binding/access overhead, compare an additional local binding against the ESM baseline with identical D3 version, graph and chunk layout. Imports already create local bindings. Prefer ordinary source-level bindings; consider renewed global injection only with demonstrated end-to-end benefit and a separately reviewed design/configuration decision.
      Do not restore injection based on a noisy property-lookup microbenchmark alone.

**Exit proof:** production consumers load D3 through ESM, no injected/global classic route is required, one coherent dependency graph supplies the required D3 behavior, and cold delivery plus real rendering/export checks pass.
Retain comparative performance evidence and disposition material regressions before release.
The decision on additional local-reference optimization follows this baseline; its implementation is conditional on evidence.
No blanket absence-of-CommonJS assertion is imposed on all third-party or bundler-generated code.

**Recovery:** reverse plugin wiring and dependency/lock edits coherently, or restore a complete previously qualified build under separately approved release procedures. Preserve failed output/logs as evidence.

### SLICE-008 — Final assurance, handoff and cleanup

**Purpose:** establish outcome evidence on the final immutable candidate.
Links: all requirements/criteria/scenarios; DEC-005.

- [ ] Freeze the candidate revision and relevant local changes.
      Reconcile final source inventory with SLICE-001, including additions/deletions and all intentional VM tests.
      Ensure ordinary-loader retirement and explicit nested interpretation still hold.
- [ ] Run the complete relevant verification matrix below on reproducible inputs.
      Reuse unchanged focused evidence only with an explicit input/snapshot relationship; missing or blocked checks remain gaps.
- [ ] Obtain independent R2 verification and relevant semantic, test-credibility, browser/build and scoped security review.
      Resolve findings without changing expected outputs to conceal behavior changes.
      Recheck names and comments wherever responsibility changed.
- [ ] Rehearse coherent recovery in a disposable owned environment.
      For eventual deployment, establish exact artifact identity, previous artifact, observer, invalidation/cache behavior and restoration procedure first.
      If these are unavailable, mark deployment readiness blocked without misreporting source verification.
- [ ] Prepare the handoff with REQ/AC/QA evidence links, environment/corpus identities, baseline defects, final results and residual risks. Commit/push/merge/deploy only if separately authorized.
- [ ] Remove eligible task-owned scratch through approved cleanup; preserve logs, fixtures, decision evidence and unrelated work.
      Record retained material with owner and deletion trigger.
      No broad reset/restore or destructive cleanup is authorized by this plan.

**Exit proof:** all selected acceptance obligations are evidenced on the candidate and independently assessed.
Distinguish completed implementation, source verification, product acceptance and release readiness.
A green test run cannot certify all four.

## 6. Verification commands and oracles

These commands are implementation instructions, not pass results.
Run each with its exit status retained.
Use the selected repository npm/runtime, not whatever global version happens to resolve.
Before full-suite qualification, reproduce the pinned corpus layout in an isolated workspace as described in `.github/workflows/webvowl-ci.yml`; do not repurpose another active checkout's `dist`.

| Phase                   | Command or concrete check                                                                                                                                                                                                                                                                                                            | Oracle / limitation                                                                                                                                                                                                                                                                         |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Environment             | `node --version`; `npm --version`; `npm ls --depth=0`                                                                                                                                                                                                                                                                                | Matches accepted runtime and locked dependencies; explain every mismatch.                                                                                                                                                                                                                   |
| Effective runner        | `npm test -- --showConfig`                                                                                                                                                                                                                                                                                                           | Correct ESM interpretation and selected transforms; no accidental dropped project or setup.                                                                                                                                                                                                 |
| Discovery               | `node --experimental-vm-modules node_modules/jest/bin/jest.js --listTests --json`                                                                                                                                                                                                                                                    | Compare exact normalized paths before/after; direct invocation keeps npm banner output out of JSON. Case counts come from actual runs.                                                                                                                                                      |
| Graph                   | `node node_modules/dependency-cruiser/bin/dependency-cruise.mjs --no-config --output-type json --do-not-follow node_modules src`                                                                                                                                                                                                     | Reconcile authored path set, unresolved edges and dependency types. Tool success alone is not complete classification.                                                                                                                                                                      |
| Pilot                   | `npm test -- --runInBand --runTestsByPath src/shared/js/util/continuousZoomRamp.test.js src/webvowl/js/elements/links/ArrowLink.test.js src/app/js/webmcp/webMcpToolContracts.test.js`; run the recorded census-selected runtime and any required substitution test paths with the same runner, individually and with related suites | Actual production subjects and constructor behavior; additionally prove runtime setup order and, where required, genuine replacement, shared identity and isolation. The three named tests alone do not establish all these contracts.                                                      |
| Source and scope        | `npm test -- --runInBand --runTestsByPath src/productionModuleFormat.architecture.test.js src/productionGraph.architecture.test.js src/testRunnerScope.architecture.test.js src/owlapiConsumerBoundary.architecture.test.js`                                                                                                         | Whole-source gate plus existing graph, discovery and consumer contracts.                                                                                                                                                                                                                    |
| Converter/renderer seam | `npm test -- --runInBand --runTestsByPath src/webvowl/js/parser.test.js src/owl2vowl/test/vowlBuilder.webvowl.test.js`                                                                                                                                                                                                               | Actual parser/builder integration; supplement with all affected corpus/differential suites.                                                                                                                                                                                                 |
| Controller seam         | `npm test -- --runInBand --runTestsByPath src/app/js/controller/ontologySourceLoader.test.js src/app/js/controller/webVowlController.test.js src/app/js/sidebar.test.js src/app/js/languageSelection.test.js`                                                                                                                        | Lifecycle, error identity and real sidebar behavior; copied language tests are supplementary.                                                                                                                                                                                               |
| Complete suite          | `npm test -- --runInBand`                                                                                                                                                                                                                                                                                                            | All intended tests with corpus prerequisites; record existing versus introduced failures.                                                                                                                                                                                                   |
| Production delivery     | `npm run build` then `node util/verify-webvowl-lazy-parser-chunks.mjs`                                                                                                                                                                                                                                                               | Production formatting/lint prechecks, artifacts and lazy chunks. Verifier precedes any development overwrite.                                                                                                                                                                               |
| Development delivery    | `npm run build:dev`; cold `npm run dev`; `npm run preview` against production output in a separate controlled run                                                                                                                                                                                                                    | Fresh dev/preview network/console evidence, not just build exit. Do not run preview over output replaced by build:dev.                                                                                                                                                                      |
| D3 architecture         | `npm test -- --runInBand --runTestsByPath src/renderedGraphDecoupling.architecture.test.js`                                                                                                                                                                                                                                          | Production D3 dependencies remain confined to the renderer runtime during SLICE-007 and final assurance.                                                                                                                                                                                    |
| Build integration       | `npm test -- --runInBand --runTestsByPath src/productionBundle.integration.test.js src/d3DevelopmentAssetServing.test.js src/d3DevelopmentServer.integration.test.js`                                                                                                                                                                | Bundle linking checks generated static imports/exports with `write: false`, without evaluation or verification of on-disk assets. Qualify delivery separately through the D3 tests and production/browser checks. These tests may create their own outputs; inventory their behavior first. |
| Platforms               | Relevant application checks on Windows and case-sensitive CI, plus existing required tooling checks                                                                                                                                                                                                                                  | Existing Windows tooling job alone does not establish Windows application compatibility. No CI change is inferred.                                                                                                                                                                          |

The implementing engineer owns test execution; the reviewer checks that expected results derive from accepted contracts and independently specified fixtures.
Do not calculate expected ontology outputs using the converter under test.
Use real first-party modules by default.
Mock network and browser boundaries only where the scenario calls for them; preserve a real-browser path for delivery, gestures, geometry, transitions and export.

For browser acceptance, use a known successful baseline ontology plus fixtures covering multilingual labels and import/loading behavior. Record the exact fixture identity and expected semantics before migration. Exercise load, search, language selection, filters, pan, zoom, drag, pause/resume, repeated/cancelled loading, relevant editing and SVG/Turtle/LaTeX exports where affected.
Confirm artifact content and rendering, not merely a download click.
Preserve any pre-existing failing ontology case separately; do not use it as the sole smoke oracle or relabel its failure as migration success.

No new latency threshold, telemetry service or performance promise is introduced.
Capture console errors, missing asset requests, parser request timing and relevant existing runtime-budget evidence.
If a timing regression is observed without an accepted threshold, investigate and obtain a bounded decision rather than fabricating a pass margin.

## 7. Traceability and release implications

| Slice | Requirements / criteria / scenarios / decisions                      | Falsifiable proof                                                                                                                                    | Release or cleanup implication                                                            |
| ----- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 001   | REQ-001,003,004,008; AC-001,003,004,008; QA-001,002,004; DEC-001–003 | Path and consumer accounting, reproducible baseline, genuine behavior oracles.                                                                       | Retain historical and fresh evidence separately.                                          |
| 002   | REQ-002–004; AC-002–004; QA-002,004; DEC-001,002                     | Three named ordinary-loaded graphs, a setup-sensitive runtime graph, any required substitution/identity/isolation proof and effective configuration. | Disposable pilot; exact configuration approval precedes effects.                          |
| 003   | REQ-003,004; AC-003,004; QA-004; DEC-002                             | Utility/filter behavior and setup preserved without shared loader.                                                                                   | Hold scope-dependent edits for atomic cutover.                                            |
| 004   | REQ-003,004,007; AC-003,004,007; QA-002,005; DEC-002,004             | Identity plus parser/renderer/converter and browser evidence.                                                                                        | Reverse coupled imports/constructors together.                                            |
| 005   | REQ-003,004,007; AC-003,004,007; QA-004,005; DEC-002                 | Real lifecycle, error, substitution and sidebar behavior.                                                                                            | Retire duplicate ordinary VM loaders; preserve actual module-test intent.                 |
| 006   | REQ-001,002,004,005; AC-001,002,004,005; QA-001,002,004; DEC-001–003 | Empty temporary exceptions, complete gate controls and unchanged intended discovery.                                                                 | Scope/helper/test cutover is one coherent unit.                                           |
| 007   | REQ-006,007,009; AC-006,007,009; QA-003,005,007; DEC-004,006         | Native D3 graph, cold delivery, renderer/export behavior and comparative performance; lazy parser boundaries preserved.                              | Classic D3 machinery retired coherently; further binding optimization evidence-dependent. |
| 008   | REQ/AC-001–009; QA-001–007; DEC-005,006                              | Final evidence, D3 performance disposition and independent assessment with recovery rehearsal.                                                       | Release approval, artifact restoration and cleanup remain explicit.                       |

## 8. Interruption, recovery and replanning

After each coherent group, record snapshot, dispositions, test commands/results, configuration state and remaining consumers. On resumption inspect current Git status and package/lock identities, then reuse only evidence whose inputs are unchanged.
Never assume a previous worker's absence of code is accidental or restore their edits.

No persistent data/schema migration, backfill or reconciliation is intended.
If discovered, stop that affected path and reroute before modifying data.
Failed verification is retained.
A rollback restores all coupled declarations, consumers, scope, runner and dependency changes; it must not discard concurrent work.
A forward fix is appropriate only with a demonstrated cause, preserved acceptance contract and freshly qualified affected evidence.

Reopen the plan if the full census identifies additional supported consumers, executable vendor CJS inside scope, necessary compatibility bridges, cycles with unpreservable initialization, package-conditional-export changes, missing native test capabilities, broader root-tool impact, persistent-data changes or a security/recovery consequence beyond the draft R2 basis.
Document the smallest experiment and decision owner for each; do not expand scope silently.

Before final implementation acceptance, resolve actual HISEW verification profile identities through the installed supported engine and map them to the obligations above.
No historical profile, engine selection or passing command substitutes for the product evidence.
Independent reviewers and release observers must be assigned before their respective gates, not invented by the implementer.

## 9. Handoff status

The detailed plan is prepared against a draft dossier.
The next execution activity is SLICE-001, followed by the bounded SLICE-002 pilot after its exact configuration approvals.
Full AST classification, baseline execution, pilot success, accepted R2 baseline, independent assurance and deployment recovery remain unestablished implementation evidence.
No application implementation or migration completion is claimed.

The plan deliberately provides explicit decision branches for those unknowns.
Their existence does not prevent delivering the requested planning artifact.
The owner can review scope, exact configuration candidates, proof and recovery before authorizing their effects.
