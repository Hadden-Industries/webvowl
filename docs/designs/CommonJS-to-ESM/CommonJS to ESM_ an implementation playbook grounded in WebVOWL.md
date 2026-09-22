# CommonJS → ESM: an implementation playbook grounded in WebVOWL

**The most important finding is that the next phase should not be planned as another production-source conversion.**
At the reviewed revision, `feature/webmcp-integration` already records that conversion as complete, and its production CommonJS allowlist is empty.
The remaining work is principally to **make package interpretation explicit, retire transitional test loaders, convert the remaining CommonJS tooling, and remove unnecessary build-time compatibility handling**.

I reviewed the branch at commit **`7fe956151e3dd77a8b7e07cdee4e65d068deebc1`**, including its migration-related history, implementation plan, architecture tests, representative before-and-after source, test infrastructure, build configuration and CI workflow.
The guidance below combines those observations with current Node.js, Jest, Vite and ESLint documentation.

This is a source-and-history review, **not a fresh execution of the repository’s test suite or browser acceptance tests**.
Where the repository records successful or failed verification, I distinguish that historical evidence from the checks the implementation team still needs to run.

## 1. Establish the correct starting position

Four different things can be described as “converted to ESM”, and they should be tracked separately:

| Dimension                              | Meaning                                                                                                     | Position in the reviewed branch                                                                            |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Authored module syntax**             | First-party production modules use `import`/`export`, not CommonJS constructs.                              | The September 2 cutover records completion; the production CommonJS allowlist is empty.                    |
| **Package and runtime interpretation** | Node and test tooling explicitly interpret the intended files as ESM.                                       | Root `package.json` still lacks `"type": "module"`.                                                        |
| **Test loading**                       | Tests exercise modules through the supported loader, rather than a project-maintained compatibility loader. | Some tests are already ESM but still instantiate their subjects through custom `SourceTextModule` loaders. |
| **Build and delivery**                 | Development and production builds no longer need compatibility handling for first-party CommonJS source.    | Vite still invokes `vite-plugin-commonjs`; its separate D3 delivery machinery also remains.                |

These are directly visible in the module-format gate, package manifest, controller test and Vite configuration.
**A successful source-syntax conversion does not establish completion of the other three dimensions.**

The distinction is intentional in this branch.
Its plan explicitly deferred adding `"type": "module"`, converting configuration files and removing CommonJS build handling until the production allowlist reached zero, with those changes requiring a separately approved completion phase.
The next team should treat that as a configuration-and-test-infrastructure migration, rather than silently expanding the original feature task.

One important modern correction: **absence of `"type": "module"` does not prove that every `.js` file runs as CommonJS.**
Modern Node can detect ESM syntax in otherwise ambiguous files.
Nevertheless, explicit package classification is preferable to relying on detection, and changing the root package type affects its `.js` files until a nested package boundary intervenes.

The repository pins Node **24.20.0**.
Its manifest declares Jest **`^30.4.2`** and Vite **`^8.1.5`**; those are dependency ranges, not independently verified installed versions.
The team should record the lockfile-resolved versions before making changes.

## 2. What the branch’s commits actually demonstrate

The useful pattern is **preparation, enforceable constraints, staged conversion and an atomic application cutover**—followed by corrections that show the limits of treating migration success as architectural success.

Dates below are commit dates in UTC.

| Commit                                                 | Change and approach                                                                                                                                                                                                                                          | Practice worth carrying forward                                                                                                                              |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **`a4ad2211` — September 1**                           | Added the native-ESM ratchet using ESLint semantic analysis and dependency-cruiser’s resolved graph. Inferred value escapes remained advisory.                                                                                                               | Introduce enforceable migration constraints before expansion. Distinguish proven violations from heuristic findings.                                         |
| **`a11472c7` — September 1**                           | Added canonical ontology loading and removed a controller-facing CommonJS utility edge from `importResolver.js`.                                                                                                                                             | Migrating a boundary includes its dependencies; a new ESM module should not conceal an uncontrolled CommonJS dependency behind it.                           |
| **`34af8ece` — September 1**                           | Defined the rendered-graph contract, immutable snapshots, an in-memory adapter and reusable conformance tests.                                                                                                                                               | Establish the contract and its tests before replacing the concrete implementation’s integration route.                                                       |
| **`ca4b6f1e` — September 1**                           | Converted substantially rewritten UI modules to named ESM, native DOM events and explicit lifecycle ownership. The still-CommonJS application temporarily loaded six migrated modules through a fixed native `import()` boundary.                            | A temporary boundary can be legitimate when it is narrow, explicit and scheduled for deletion—not a growing collection of wrappers and `.default` fallbacks. |
| **`41998296`, `a6dbc5b5`, `72ca75a9` — September 1–2** | Added export services, snapshot consumers, view controls and controller orchestration before connecting them to production. The existing production route remained the only live route.                                                                      | Prepare and test replacement components independently, then switch ownership once. Avoid two competing production implementations.                           |
| **`2b669e6a` — September 2**                           | Performed the major controller/runtime cutover. `graph.js` became private `renderedGraphInternals.js`; `options.js` was split by ownership. Renderer elements, parsing, utilities and filters moved to ESM, leaving the production CommonJS allowlist empty. | Convert a coherent dependency boundary and its importers together. Delete replaced routes in the same cutover.                                               |
| **`5240e9ee` — September 3**                           | Moved ontology inspection projection out of the renderer and into application ownership; removed the retired runtime reader.                                                                                                                                 | ESM syntax alone does not fix dependency direction or data ownership. Check those independently.                                                             |
| **`6cde4505` — September 3**                           | Removed renderer calls from the zoom control, published viewport state and extracted testable zoom-ramp arithmetic.                                                                                                                                          | Preserve behaviour while moving responsibilities to their correct owners; move tests with the behaviour, not merely with filenames.                          |
| **`edb74ad5` — September 9**                           | Extended shared controls, replaced an authored cancellation helper with native `AbortSignal.any`, and corrected recursive analysis in the module-format gate with accompanying controls.                                                                     | Migration infrastructure itself needs tests and retirement criteria. A safeguard or compatibility helper is not automatically worth retaining indefinitely.  |

### The strongest reusable mechanism: a shrinking, content-aware exception set

The module-format test preserves a historical inventory of **110 production JavaScript modules: 103 CommonJS, four ESM and three hybrid**, alongside a historical list of **30 private renderer leaves** eligible for temporary CommonJS treatment.
These are baseline records, not today’s remaining-file counts.
The exception mechanism records file digests, preventing a materially changed file from quietly remaining an “untouched legacy leaf”.

That is substantially stronger than:

```text
Ignore CommonJS under src/legacy/**
```

My recommendation is to preserve the principle:

> **An exception identifies a particular existing dependency, its permitted location and its exit condition—not a directory into which new legacy code may accumulate.**

For the remaining work, the production exception set should stay empty.
Any temporary test-infrastructure exception needs its own explicit scope and removal condition.

### What should not be copied uncritically

The large September 2 commit combined source-format conversion with controller integration and ownership restructuring.
That was coherent with the feature’s intended cutover, but **it is not a general reason to combine every ESM conversion with a broad redesign**.
Later projection and zoom changes, and the plan’s subsequent audit of incomplete cutovers, demonstrate why those outcomes must be assessed separately.

For the remaining conversion, I would separate:

**module-format changes → test-loader changes → build simplification → unrelated architectural improvements.**

Combine them only where preserving a working dependency boundary genuinely requires an atomic change.

## 3. The general migration method

### 3.1 Inventory the repository and the execution graph separately

A production-entry traversal answers “what can the application load?”
It does not answer “what authored JavaScript remains elsewhere in the repository?”

Create two inventories:

**The authored-file inventory** should cover production source, tests, test support, root configuration, utilities, maintenance scripts and nested package scopes.
Exclude dependencies and generated output from the first-party conversion count, but record their interoperability requirements.

**The execution-graph inventory** should follow application entry points, test entry points and Node CLI entry points.
Record static imports, dynamic imports, CommonJS edges, unresolved dependencies and cycles.

For each remaining candidate, record:

```text
Path
Execution environment and entry point
Controlling package.json
Current syntax and actual loading mechanism
Export contract: function / constructor / singleton / object / side effect
Importers and dependency cycle membership
Mocking or cache assumptions
Target treatment: convert / delete / explicitly retain
Verification required
```

Use text searches for discovery, not as the final classification authority.
The branch already has the better foundation: scope-aware ESLint analysis and dependency-cruiser graph discovery.
Conversely, `productionGraph.architecture.test.js` still contains historical mixed-module commentary and regex-based traversal that should not become the sole repository-wide ESM gate.

### 3.2 Choose migration units by dependency, not by file count

My recommended unit is **the smallest coherent dependency change that remains executable and reviewable**.

For an acyclic utility, that may be the utility plus its importers.
For a group of mutually dependent constructors, it may be the entire strongly connected component—the modules participating in the cycle.
For an application composition root, it may include the entry chain and initialization sequence.

A useful default is to convert dependencies before consumers, but “leaf-first” is not an absolute rule.
When a cycle or public interface makes that impractical, first extract a dependency-independent contract or convert the necessary group atomically.

The branch provides both forms: independently testable controller contracts were introduced before integration, while the entry/runtime cutover was performed as one connected change.

### 3.3 Preserve behaviour before improving design

Before editing a module, establish what callers actually rely on: value identity, initialization timing, mutation, synchronous return values, exception timing, side effects and cleanup.

For a **syntax-only migration**, existing behavioural tests should generally remain green throughout.
The newly failing test can be the module-format requirement or a real-import integration test.
There is no benefit in manufacturing a behavioural failure when no behaviour is intended to change.

The branch’s practice of adding modules to the required-ESM set before conversion is useful here: it makes the migration obligation executable without conflating it with new functionality.

### 3.4 Use codemods for mechanical work, not semantic decisions

An AST-based codemod is appropriate for known patterns: replacing an unconditional literal `require`, introducing an agreed named export, updating importers and adding relative extensions.

Require manual review for conditional or computed `require`, `try/catch` around loading, `module.exports` reassignment, callable exports with attached properties, cyclic initialization, export mutation, cache manipulation and tests that replace modules.

The important review question is not simply “is there any `require` left?”
It is:

> **Does the new module expose the same intended contract, at the same point in the application lifecycle, through the correct loading mechanism?**

## 4. Semantic hazards the conversion must address

### 4.1 Preserve the exported value’s meaning and identity

The branch’s `math.js` conversion is instructive.
Before the cutover, an immediately invoked function produced a callable accessor returning a shared `math` object.
Afterwards, that callable was bound to `createMath` and exported by name; the shared-object behaviour remained.

The behaviour is structurally:

```js
const createMath = (() => {
  const math = {};

  // The actual module populates its mathematical operations here.

  return function () {
    return math;
  };
})();

export { createMath };
```

A relevant characterization assertion is therefore:

```js
expect(createMath()).toBe(createMath());
```

**Do not accidentally turn a singleton accessor into a fresh-instance factory.**
Also, `createMath` suggests allocation more strongly than its implementation warrants.
That is a naming issue to record, not permission to change identity semantics during the conversion.

Likewise, do not replace constructor functions with classes, flatten closure-backed state or remove immediately invoked functions merely because ESM makes another style possible.
Those are separate design decisions.

### 4.2 Distinguish live bindings from mutable objects

ESM imports are read-only bindings to exported values.
They are not equivalent to an arbitrary writable CommonJS namespace, and exporting an object does not make that object immutable.
Static imports are also processed before the importing module’s body executes.

Consequently, inspect code that:

- Replaces properties on an imported module to install mocks.
- Destructures a changing CommonJS export and expects a snapshot.
- Reassigns the exported object after initial loading.

Choose explicitly between preserving a shared object, exposing live state through an intentional contract, or injecting a dependency.
Do not let the choice emerge accidentally from the codemod.

### 4.3 Preserve initialization and cycle behaviour

An import placed textually below an initialization statement does not make the dependency load after that statement.
ESM’s dependency evaluation and cyclic bindings can expose initialization-order problems, particularly where modules read one another’s values at top level.
Modules also execute in strict mode.

For each affected cycle, test the real import graph and construction path.
Prefer moving operational initialization into an explicit factory or startup operation where that matches ownership; do not “fix” cycles by scattering asynchronous imports throughout otherwise synchronous APIs.

Also check top-level `this`, detached method calls and implicit globals.
A module-format migration is not justification for silently changing callback binding.

### 4.4 Keep genuinely lazy dependencies lazy

Replacing a function-local `require` with a top-level import can change when a dependency loads.
Replacing it with `await import()` instead changes the calling operation’s asynchronous contract.
Neither is universally correct.

For WebVOWL, parser loading deserves explicit protection: the repository contains `util/verify-webvowl-lazy-parser-chunks.mjs`, which inspects the built entry graph and parser implementation placement.
Retain that verification when changing imports or build compatibility handling.

Do not assume that “ESM enables tree-shaking” guarantees a smaller initial download.
Measure the built graph and retain the intended lazy-loading boundaries.

### 4.5 Make resolution explicit without rewriting package contracts

Relative ESM imports should name the actual file, including its extension and any `index.js` component.
Bare package specifiers are different: an exported package subpath such as `owlapi/formats` should not receive a speculative `.js` suffix.
Node resolves those through the dependency’s package contract.

For Node-side file access, use file URLs or convert them correctly with `fileURLToPath`; do not derive Windows paths from `new URL(...).pathname`.
The latter is not a portable filesystem-path conversion.

The existing Vite configuration already uses `import.meta.url` and reads its JSON metadata explicitly.
There is no reason to rewrite those working ESM mechanisms just for stylistic uniformity.

### 4.6 Separate internal export policy from external interoperability

The branch’s named-export policy is sensible for its internal application contracts, but **named exports are not an ESM language requirement**.

ESLint and Vite configuration legitimately use default exports.
At a CommonJS dependency boundary, Node provides the CommonJS `module.exports` value as the default export; inferred named exports are not a universal substitute.
The appropriate import form follows the dependency’s contract, not an internal application naming preference.

Avoid internal `namespace.default || namespace` probing and dual-export wrappers.
Do not, however, treat a documented third-party default import as evidence that first-party conversion failed.

## 5. The verified remaining targets in this repository

This is a **verified target list**, not a claim that every tracked JavaScript file has been exhaustively classified.

| Target                                                                                                   | Observed state                                                                                                          | Recommended treatment                                                                                                                                                       |
| -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`eslint.config.js`**                                                                                   | Uses `require` and `module.exports`.                                                                                    | Convert mechanically to `eslint.config.mjs`, preserving the configuration array and rule behaviour initially. Its default export is a tooling contract.                     |
| **`src/app/test/loadEsmModuleForTest.js`**                                                               | CommonJS helper using `SourceTextModule`, `SyntheticModule`, `createRequire`, source-text detection and a module cache. | Prefer deletion after migrating consumers to supported ESM loading. Converting its own syntax would leave the main complexity intact.                                       |
| **`src/app/js/controller/webVowlController.test.js`**, and similarly structured tests found by inventory | Already ESM, but contains another custom repository-module loader and also imports the shared bridge.                   | Replace compatibility-only loading with direct imports and existing dependency injection. Preserve any genuinely intentional loader-boundary tests separately.              |
| **Root `package.json`**                                                                                  | No explicit package type; Jest uses the Node environment and VM-module launch flag.                                     | Add explicit ESM interpretation through a coordinated configuration change after identifying every affected `.js` file. Qualify the effective Jest transform configuration. |
| **`vite.config.mjs` / `vite-plugin-commonjs`**                                                           | Configuration is already ESM, but `commonjs()` remains active.                                                          | Remove first-party compatibility handling in a separately verified change. Keep third-party interoperability and D3 delivery concerns distinct.                             |
| **Architecture gates, lint/format scope and check selection**                                            | Production-focused gates exist; `lint:js` and formatting scripts primarily cover `src`.                                 | Extend coverage to relevant authored tooling and test infrastructure. Ensure configuration renames trigger CI. Preserve negative fixtures and historical records.           |

Do not indiscriminately schedule the utilities for conversion.
For example, `util/zip.test.js` already imports its `.mjs` implementation through ESM, and the utility tree contains numerous existing `.mjs` tools.

## 6. Recommended implementation sequence

### Change set 1 — Baseline, scope and migration gates

Record the exact revision, runtime versions, resolved dependencies, effective Jest configuration, discovered tests and existing failures.
Build the authored-file and execution-graph inventories described above.

Use the original plan’s separately approved completion mechanism for package, configuration and build changes.
Do not mix dependency upgrades into the migration unless a demonstrated incompatibility requires one.

The completion ledger should distinguish:

**CommonJS files remaining**, **tests still using compatibility loaders**, **package scopes lacking explicit interpretation**, and **remaining compatibility mechanisms**.

Those are more informative than a single “percentage ESM” figure.

**Exit condition:** every remaining candidate has an owner, intended treatment and verification requirement; the team has a reproducible baseline.

### Change set 2 — Prepare tooling and qualify standard ESM test loading

Convert `eslint.config.js` to `eslint.config.mjs`, preserving the existing array, plugin configuration and rule values.
ESLint supports this filename directly.
Update references and change-selection rules as necessary.

Next, run a small native-loading pilot covering a pure utility, a constructor/identity case and a controller test.
Inspect Jest’s effective configuration rather than assuming that the absence of an explicit `transform` entry means no transformation: Jest has a default transformer.
For this plain-JavaScript target, an explicit `transform: {}` is a reasonable configuration to qualify; any retained transformer must preserve ESM.

Coordinate `"type": "module"` with the remaining actual CommonJS files.
Prefer converting or deleting them before the switch.
Where a staged transition genuinely requires the existing test bridge, an explicit temporary `.cjs` rename can keep its interpretation unambiguous—but it remains an exception, not completed conversion.

Do not add a new compatibility layer just to avoid completing this work.

**Exit condition:** the standard test loader successfully traverses representative real production graphs, with explicit package interpretation or a precisely documented staged transition.

### Change set 3 — Retire the custom test loaders

This is the most substantive remaining cleanup.

The shared loader exists partly to preserve module identity: its comment explicitly explains that separate caches would make `instanceof` checks fail across loads.
It also supplies dependency stubs through synthetic modules because ordinary Jest mocking cannot intercept files it reads itself.
Those are real contracts to preserve during removal.

For `webVowlController.test.js`, the intended direction is to replace loader-populated bindings with ordinary imports such as:

```js
import { createWebVowlController } from "./webVowlController.js";
import { createOntologyInspector } from "./ontologyInspector.js";
import { vowlModelInspectionProjector } from "./vowlModelInspectionProjector.js";
import {
  createInMemoryRenderedGraphAdapter,
} from "../../test/inMemoryRenderedGraphAdapter.js";
```

These correspond to actual modules currently loaded by that test.
This illustrates the target structure; it is not a verified drop-in patch for the complete suite.

Migrate consumers in coherent groups: uncomplicated imports first, identity-sensitive constructors next, then tests with substituted dependencies and integration/composition cases.

Where existing factories accept collaborators, retain that dependency injection.
Where a test genuinely requires ESM module substitution, use Jest’s supported ESM mechanism: register `jest.unstable_mockModule` before dynamically importing the subject and its consuming graph.
A statically imported subject has already been loaded before that mock-registration code runs.

Test explicitly that the same constructor is shared throughout one graph, mock choices do not leak between tests, lifecycle state is isolated where intended, and import failures remain visible rather than being normalized away.

Do not delete every `SourceTextModule` occurrence by search-and-replace.
A test intentionally checking module linking or prohibited imports may legitimately use it; a loader used only to work around the transitional package configuration should be retired.

**Exit condition:** compatibility-only loaders and their caches are deleted; ordinary tests exercise the real module graph; identity and isolation coverage remains intact.

### Change set 4 — Remove redundant build compatibility, preserving delivery behaviour

Remove the `vite-plugin-commonjs` import, its plugin invocation and its development dependency in one controlled change, then qualify both development and production behaviour.

Vite’s dependency pre-bundling addresses dependency compatibility separately from first-party source syntax.
Vite 8 also changed its underlying build tooling to Rolldown/Oxc, so older recipes that assume a Rollup/esbuild arrangement should not be applied mechanically.

**Do not remove the D3 pipeline incidentally.**
The reviewed configuration separately provides D3 to source modules, injects its browser script and serves/copies the distribution.
The repository also tests development delivery of the exact D3 bytes.
Those functions are not equivalent to converting authored CommonJS modules.

If the team later elects to replace that arrangement with direct ESM D3 imports, treat it as another migration with its own bundle, startup and browser tests.

**Exit condition:** cold development startup, production build, preview, parser lazy loading and D3 delivery work without the removed compatibility plugin.

### Change set 5 — Seal the repository-wide policy

Extend the existing ratchet beyond the production graph to the intended first-party tests, support code and utilities.
Keep policy scopes distinct: an application module and an ESLint configuration do not necessarily have the same permitted export shape.

Tighten lint environments separately from the mechanical configuration conversion.
The current configuration combines browser, Node and Jest globals broadly; that can make a browser file’s accidental Node-specific references less obvious.
Scope globals to actual execution environments and cover relevant `.mjs` files and root tooling, not only `src/**/*.js`.

Retain positive and negative controls for the gate itself.
Preserve strings, fixtures and historical records that intentionally demonstrate forbidden CommonJS syntax.

**Exit condition:** no active first-party CommonJS remains within the agreed conversion scope, no compatibility-only loader survives, and CI prevents either from returning unnoticed.

## 7. Verification: what the team should actually run and inspect

### Reproduce the real test environment

The application CI checks out a pinned sibling `universal-ontology` corpus, stages its source directories under `dist`, selects Node from `.node-version`, installs npm **12.0.2**, and runs `npm ci --ignore-scripts` before testing and building.
Missing corpus data must not be misdiagnosed as an ESM regression.

A baseline command sequence, from the correctly prepared checkout, is:

```sh
git rev-parse HEAD
node --version
npm --version

npm ci --ignore-scripts
npm ls --depth=0

npm test -- --showConfig
npm test -- --listTests

npm test -- --runInBand
npm run build
```

Record exit statuses and logs.
Repeat the effective-configuration and test-discovery checks after filename and package-scope changes: a smaller discovered suite is not a successful migration.

The repository already exposes the test/build scripts used above.
Its test command also supplies `--experimental-vm-modules`.
**Deleting the project’s custom VM loaders does not automatically justify deleting Jest’s VM-module launch flag**; that flag remains in Jest’s documented ESM setup.

### Use focused gates during each slice

For the source-format and reachability boundaries:

```sh
npm test -- --runInBand --runTestsByPath \
  src/productionModuleFormat.architecture.test.js \
  src/productionGraph.architecture.test.js
```

Run the affected behavioural tests alongside them.
After configuration and build changes, run the full suite, production build and development-mode build:

```sh
npm test -- --runInBand
npm run build
npm run build:dev
```

These tests, scripts and architecture paths exist in the reviewed revision.

The verification evidence should cover five distinct outcomes:

| Outcome                    | Required evidence                                                                                                                            |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **Module correctness**     | Intended files load through the standard mechanism; relative imports resolve; prohibited CommonJS constructs fail the architecture gate.     |
| **Behaviour preservation** | Identity, constructor use, initialization, mutation, error propagation, cleanup and asynchronous completion retain their intended contracts. |
| **Test credibility**       | Test discovery is preserved, real dependencies are exercised where intended, and mocks or caches do not hide incompatible loading.           |
| **Build integrity**        | Cold development and production builds work; lazy parser boundaries, asset delivery and relative deployment paths remain valid.              |
| **Browser behaviour**      | Ontology loading, controls, viewport interactions, layout lifecycle and exports behave correctly with the real renderer.                     |

Use a fresh or carefully inventoried build output location.
The Vite configuration has `emptyOutDir: false`, so previously generated files must not be allowed to make a broken output pipeline appear successful.

### Keep existing product failures separate from migration results

The branch’s evaluation document records an AQFO acceptance attempt that failed before drawing: an empty ontology version reached a contract expecting `null` or a non-empty value, and the resulting error was reported as `LOAD_ABORTED`.
No AQFO SVG was produced in that attempt.

That is an important caution, not an ESM-specific diagnosis:

> **Passing module-format checks, unit tests or a build does not prove that the complete user workflow works.**

The team should identify which failures already exist at its baseline, prevent migration regressions, and retain separate product-acceptance work.
Neither silently absorbing unrelated fixes into the conversion nor relabelling existing failures as successful acceptance is appropriate.

## 8. Definition of done

I would accept the conversion as complete only when the team can demonstrate all of the following:

1. **The agreed authored-code scope is ESM.**
   Production remains free of CommonJS; remaining first-party tests, support and tooling have been converted or deleted.
   Any retained exception has an external or test-specific justification—not merely a renamed `.cjs` file.
2. **Package interpretation is explicit.**
   Root and any nested package boundaries express the intended module system, and tool configuration files follow their consumers’ contracts.
3. **Tests no longer depend on compatibility-only module loaders.**
   Real imports, identity, isolation and mocking behaviour are verified.
4. **Redundant build compatibility is removed.**
   Any retained interoperability exists for a documented dependency or delivery requirement, with cold-start and production evidence.
5. **The policy is enforced across the intended repository scope.**
   Tests cannot disappear through renaming, tooling cannot escape lint coverage, and new CommonJS cannot enter an ungoverned exception directory.
6. **Migration evidence and product acceptance are reported separately.**
   Existing workflow defects remain visible, and no completion claim exceeds the verification actually performed.

**The branch’s best contribution is its enforceable, shrinking migration boundary and its contract-led cutovers. The next team should retain that discipline while removing the transitional infrastructure it made possible—not perpetuate that infrastructure merely because the source files now contain `import` and `export`.**
