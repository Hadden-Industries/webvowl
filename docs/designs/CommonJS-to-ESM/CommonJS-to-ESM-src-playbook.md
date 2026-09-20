# CommonJS → ESM across the complete WebVOWL `src/` tree

## Recommendation and evidence boundary

Treat this as a **directory-wide, semantics-preserving source migration**, informed by the WebMCP branch—not as completion of the WebMCP plan alone. Enumerate every JavaScript file under `src/`, classify its actual module contract, convert coherent dependency groups, and make the entire directory subject to an executable ESM policy. An empty WebMCP exception list is not the completion criterion.

Repository inspected: `Hadden-Industries/webvowl`, branch `feature/webmcp-integration`, revision `7fe956151e3dd77a8b7e07cdee4e65d068deebc1`, checked on 10 September 2026. The complete recursive `src` tree was retrieved with `truncated: false`. The accompanying census transcribes 236 JavaScript paths: 84 under `app`, 42 under `shared`, 74 under `webvowl`, 28 under `owl2vowl`, and eight directly under `src`. This is a **file census, not an executed 236-file AST classification or a runtime verification result**. Selected source files, architecture tests, configuration, and migration commits were inspected. Repository tests and browser acceptance were not executed for this research. [R1]

Two executable CommonJS files are directly confirmed:

| File | Evidence | Required treatment |
| --- | --- | --- |
| `src/app/js/languageSelection.test.js` | Begins with `require("@jest/globals")`; its tested language-selection/filtering functions are defined in the test itself. | Convert the import, preserve the cases, and distinguish algorithm-copy tests from tests of actual production behaviour. |
| `src/app/test/loadEsmModuleForTest.js` | Uses `require`, `createRequire`, `SourceTextModule`, `SyntheticModule`, and `module.exports`. | Prefer retiring the compatibility loader and migrating its consumers to ordinary ESM loading. Merely changing its export syntax leaves its principal complexity intact. |

These are a **verified minimum**, not a claim that only two CommonJS files remain. The first implementation gate below produces the exhaustive current classification. Do not infer that all other files are converted from their filenames, from these examples, or from the WebMCP allowlist. [R2, R3]

## 1. Define the intended end state

The target covers production source, tests, test support, standalone and dormant modules, and any further maintained JavaScript under `src/`. It includes `src/shared`, renderer element implementations, converter tests, CSS-adjacent JavaScript tests, and code outside the current application import graph.

At completion:

- All maintained JavaScript in the agreed `src/` scope is interpreted as ESM and contains no unapproved executable CommonJS implementation mechanism.
- Every file is accounted for as converted, already ESM, a format-neutral module made explicit through its package scope, or deliberately deleted with evidence.
- First-party imports preserve the intended API, identity, initialization, error, and lifecycle contracts.
- The source-wide gate covers future files automatically, including files that no production entry imports.
- Compatibility-only test loaders are removed. Deliberate module-linking tests may continue to use Node VM facilities when those facilities are the actual subject of the test.

Third-party code, generated artifacts, and deliberately negative test fixtures must be **accounted for**, not silently hidden by broad ignores. An executable third-party CommonJS file found inside `src/` needs an explicit replacement, relocation, or retention decision. Moving maintained application CommonJS outside `src/` solely to make a counter reach zero is not migration.

Root configuration and build changes are supporting work only when necessary. This task does not automatically require converting every root utility, changing D3 delivery, replacing Jest, adopting TypeScript, upgrading dependencies, or redesigning WebMCP.

### Keep four properties separate

1. **Source syntax:** declarations and actual use of CommonJS facilities.
2. **Module interpretation:** how the relevant Node, Jest, browser, or bundler context classifies the file.
3. **Dependency boundary:** whether ESM source still loads first-party CommonJS through an adapter.
4. **Behaviour:** whether the resulting application and tests preserve their contracts.

A file may parse as ESM yet retain a `createRequire` bridge. A test may have no imports or exports yet be a perfectly valid ESM module under an explicit package scope. Conversely, the presence of `import()` alone does not make a CommonJS file ESM. Node explicitly distinguishes these cases. [R12]

## 2. Lessons from the branch's actual migration

The relevant historical progression is preparation, controlled coexistence, a production cutover, and subsequent corrections. The generalized lessons are useful; the original feature boundaries are not the new scope.

| Commit | Observed approach | Generalized lesson |
| --- | --- | --- |
| `a4ad2211` — 1 September | Introduced a module-format ratchet using ESLint semantic analysis and dependency-cruiser graph data. Inferred value escapes remained advisory. | Use maintained parsers and resolvers; make proven violations blocking without presenting heuristic value-flow analysis as proof. |
| `a11472c7` — 1 September | Canonical source-loading work removed a controller-facing CommonJS utility edge. | Inspect dependencies as well as the module being converted. A native-looking boundary can still hide a legacy dependency. |
| `34af8ece` — 1 September | Added runtime contracts and an in-memory adapter before production integration. | Characterize the boundary and its behaviour before switching the implementation route. |
| `ca4b6f1e` — 1 September | Converted substantially rewritten UI modules and tests; the still-CommonJS composition source used a fixed native dynamic-import boundary. | Temporary coexistence should have a small known surface and a removal condition, not generic fallback probing. |
| `2b669e6a` — 2 September | Converted renderer elements, utilities, parsing, and filters during the controller/runtime cutover; retired the old graph/options routes. | Convert a coherent dependency boundary and all necessary consumers together. Remove replaced routes in the same accepted cutover. |
| `5240e9ee` — 3 September | Moved ontology inspection projection from renderer to application ownership. | ESM syntax and architectural ownership are different acceptance questions. |
| `6cde4505` — 3 September | Moved zoom behaviour to its appropriate owner and moved focused tests with it. | Follow behaviour when moving tests; do not preserve obsolete test wiring simply because the file still exists. |
| `edb74ad5` — 9 September | Replaced a custom abort-composition helper with a platform facility and corrected recursive analysis in the architecture gate. | Migration scaffolding and safeguards also need maintenance, evidence, and eventual simplification. |

The full immutable commit references are listed below. These observations do not independently certify every historical completion claim. [R4]

**A coexistence detail worth preserving:** the six deferred imports introduced while `app.js` was CommonJS were not simply removed when it became ESM. The current architecture test still requires those six dynamic specifiers. Removing a CommonJS boundary is therefore not authority to replace every `import()` with a static import. Preserve the current loading contract unless its timing and bundle consequences are separately reviewed. [R5]

### Preserve the shrinking-exception mechanism

The architecture test retains historical evidence of 110 application-reachable authored modules: 103 CommonJS, four ESM, and three hybrid. It records a conservative maximum of 30 temporarily eligible renderer leaves and their content digests. Those are **historical figures**, not the current `src/` denominator. [R5]

The useful principle is: **an exception names an existing artifact, its allowed dependency position, and its removal condition**. It is not permission to put new files beneath an ignored `legacy/` directory. Preserve this principle for the new migration, but establish any remaining exceptions from the complete source census rather than copying the old WebMCP list.

### Correct the coverage boundary

The current required-directory list names controller, UI, WebMCP, and renderer-runtime directories, complemented by explicit paths and dependency traversal. The test is explicitly a scoped ratchet. Its production renderer exception set is empty, while the custom test loader has an explicit CommonJS exception. `languageSelection.test.js` demonstrates why this is not a directory-wide completion oracle. [R5]

Introduce an independent invariant: **every in-scope `src/` JavaScript path receives a source-format decision, whether imported or not**. Keep application reachability and WebMCP layering checks alongside it; do not use either as a substitute.

### Do not copy the size of the cutover or all its design choices

The large runtime cutover combined ESM work with ownership changes demanded by the feature. That does not establish that a utility conversion should also redesign its API, replace constructors with classes, or introduce a controller. Similarly, named exports, immutable domain snapshots, and the no-shim rule are distinct decisions. Preserve the useful export discipline for newly converted internal APIs without changing established default-export contracts merely for uniformity.

## 3. Produce a complete source inventory before estimating the work

### 3.1 Reconcile directory coverage

Start from Git's tracked source inventory, and separately record untracked work. The attached `src-files.txt` is a pinned census to compare with, not a replacement for the team's current checkout.

```powershell
git rev-parse HEAD
git status --short
git ls-files -- src
git ls-files --others --exclude-standard -- src
```

For machine processing use Git's NUL-delimited output, not newline splitting. Include `.js`, `.mjs`, and `.cjs`, and make any newly introduced JavaScript extension an explicit policy decision. At the researched revision the enumerated JavaScript paths all have `.js` suffixes. Record all nested `package.json` files as interpretation boundaries. [R1, R12]

Require set equality between the accepted source-file inventory and analyzed paths. A missing source, parse failure, unexpected symlink, unknown generated root, or unsupported extension is an unresolved item—not an ESM success.

### 3.2 Classify syntax and meaning separately

Use the already available ESLint analysis to distinguish:

| Classification | Meaning and next step |
| --- | --- |
| Executable CommonJS | References to the CommonJS loader/export contract; perform contract-aware conversion. |
| Hybrid | ESM syntax plus CommonJS facilities; identify the actual execution path and remove the unintended mixed boundary. |
| ESM with interoperability | ESM source using an explicit CommonJS bridge; determine whether it is required external interoperability or migration scaffolding. |
| Existing ESM | Preserve it unless its imports or another necessary contract must change. |
| Format-neutral JavaScript | No distinguishing syntax; establish intended ESM interpretation and check strict-mode compatibility. |
| Test/example source carried as data | Preserve the represented example or negative case; it is not the host module's format. |
| Unresolved | Parser failure or a construct the analysis cannot classify confidently; investigate before closure. |

Text searches are useful triage:

```powershell
rg -n --glob '*.js' --glob '*.mjs' --glob '*.cjs' 'require\s*\(|module\s*\.\s*exports|\bexports\b|createRequire|__dirname|__filename' src
```

Do not count those matches as modules to convert. Scope-aware AST analysis distinguishes a local parameter called `exports`, a fixture string containing `module.exports`, and an actual CommonJS export. The branch already uses this approach. Reuse that capability rather than adding another regex parser or a bespoke JavaScript interpreter. [R5, R14]

### 3.3 Resolve the complete dependency graph

Run dependency discovery over the directory, not just `src/main.js`:

```powershell
node node_modules/dependency-cruiser/bin/dependency-cruise.mjs --no-config --output-type json --do-not-follow node_modules src
```

The repository already invokes this public CLI in its architecture tests. Save its JSON output through the team's normal evidence handling. Reconcile its module paths with the source census; investigate discrepancies, unresolved edges, and dynamic dependencies requiring additional evidence. [R5, R15]

Record importers both **inside and outside `src/`**: Node tools, tests, HTML entry points, workers, bundler configuration, and embedding routes can consume an in-scope module. Outside consumers are supporting changes, not a reason to expand the whole migration into a root-tooling programme.

An unimported file is not automatically dead. It may be an entry point, a template, dynamically selected code, or an externally consumed resource. Deletion needs evidence of intended retirement, not just a graph's orphan label.

### 3.4 Minimum per-module decision record

Record path, module interpretation, execution environment, export shape, mutable/singleton identity, evaluation side effects, synchronous/asynchronous contract, importers, cycle membership, tests/mocks, target disposition, and acceptance evidence. Group the resulting records into conversion units. The number of files is an inventory metric; dependency coupling and behavioural risk determine the work.

### 3.5 Automate only mechanically justified transformations

Use AST-based transformations for unconditional literal dependencies, agreed export declarations and corresponding importer updates. Reuse an existing codemod/fixer facility where available; ESLint exposes public analysis and fixing APIs. Do not install a new permanent application dependency for a one-off source migration. [R14]

Before broad application, exercise the transformation on representative before/after fixtures and review a dry-run diff. Require idempotence: applying the codemod twice must not introduce another change. Refuse or report conditional loads, computed specifiers, export reassignment, receiver-sensitive object splitting and cyclic initialization instead of guessing. Retain comments and notices, and keep unrelated formatting changes out of the semantic review where practical.

A codemod's successful parse is not behavioural evidence. Its output passes through the same focused tests, native import checks and review as a manual conversion. When the remaining inventory is small, a few explicit edits may be safer and cheaper than maintaining transformation machinery.

## 4. Resolve the execution model without changing unrelated tooling

The root manifest lacks `type`; `src/owl2vowl/package.json` already declares `type: module`. Root omission does not prove everything is CommonJS: modern Node supports syntax detection for ambiguous files. Explicit interpretation is nevertheless preferable to relying on it. [R6, R7, R12]

For this bounded task, evaluate three choices:

| Choice | Advantages | Costs / conditions |
| --- | --- | --- |
| Add `src/package.json` with `private: true` and `type: module` | Declares the intended source scope without reclassifying root configuration or unrelated utilities. | Coordinate actual remaining CommonJS files and test-loader consumers. Check nested scopes, package self-reference/import maps, and build/test discovery. |
| Add root `type: module` | One broad explicit default. | Also changes root `.js` tooling; requires a wider inventory and supporting changes. |
| Rename selected files to `.mjs` | Explicit per-file interpretation during mixed operation. | More path churn; references, test discovery, lint/format matching, HTML and serving rules need qualification. Renaming every file is not required. |

**Recommended decision to evaluate first: an explicit `src/` package scope.** This matches the clarified objective and avoids making root-tool conversion the main task. It is a proposal, not a pre-verified patch. Preserve the existing nested converter package until there is a separate reason to alter it. Do not fix unrelated manifest metadata as part of source-format work.

The branch's original plan reserved module/configuration changes for separate approval. The new migration should approve its exact supporting changes at design time rather than treating the old plan as authorization. [R8]

### Native-loading pilot

Record `node --version`, `npm --version`, lockfile-resolved dependency versions and `jest --showConfig`. The repository pins Node 24.20.0; manifest ranges for Jest and Vite are not installed-version evidence. [R6]

Try ordinary loading of a pure module, a constructor-sensitive group, and a mocked subject in an isolated migration checkout. Compare unchanged configuration with the proposed explicit source scope. Do not infer necessity from the custom loader's historical comment.

Jest 30.4 documents native ESM activation and, on Node 24.9+, `require(esm)` for synchronous module graphs. That makes blanket claims that CJS cannot load ESM outdated, but does not make `require` an ESM migration destination. For browser production code the Vite/browser contract must also work. [R13]

Jest's documented ESM setup requires transforms disabled or emitting ESM, and the VM-module launch flag. Inspect effective configuration: Jest supplies a default transformer even when `transform` is absent from the manifest. Qualify `transform: {}` for this plain-JavaScript codebase rather than assuming it is already effective. Retain `--experimental-vm-modules` unless the selected Jest version no longer requires it; deleting the repository's custom VM loader is a different change. [R13, R16]

## 5. Conversion recipes and the behaviour each must preserve

### 5.1 Export a factory without executing it early

For an internal module whose value is a factory:

```js
// Before
module.exports = function createFilter(options) {
  return buildFilter(options);
};
```

```js
// After: migrate all necessary callers with the defining module.
export function createFilter(options) {
  return buildFilter(options);
}
```

Do not substitute `export const filter = buildFilter(...)`: that executes construction during module evaluation and changes lifetime. Do not require a default-to-named API change where an established external contract requires the original surface; record the chosen export contract explicitly.

### 5.2 Preserve singleton accessors and registries

The branch's `math.js` illustrates a subtle case. Its old CommonJS export was an IIFE-created function returning one shared `math` object. The conversion bound that function to `createMath` and exported it by name; it did not turn each call into allocation. [R9]

```js
expect(createMath()).toBe(createMath());
```

The current `nodeMap.js` similarly constructs its registry at module evaluation, instantiates constructors to obtain their type names, and returns the same `Map` from `createNodeMap()`. That is not a fresh-map factory despite the name. [R10]

For comparable remaining modules, preserve instance identity, construction count, registry order and initialization timing. A misleading existing name can be recorded for separate improvement; already-ESM modules should not be reconverted or redesigned merely to make the migration look more comprehensive.

### 5.3 Preserve constructor functions and prototype relationships

An existing `module.exports = Constructor` can become a named constructor export without becoming a `class`. Retain `new`, callable behaviour where supported, prototype inheritance, shared prototype state and constructor identity. Verify `instanceof` through real imports from the subject and its consumers. Mixed custom/native loaders must not produce duplicate versions of the same constructor.

This is particularly relevant to renderer nodes, properties, links, registry maps, and type-checking utilities. Convert connected constructor/registry groups together where required by their initialization graph. [R3, R10]

### 5.4 Preserve object and receiver contracts

Do not mechanically split every exported object into named functions. Callers may use object identity, property order, descriptors/getters, mutation, attached function properties, or receiver-dependent calls such as `api.read()`.

An imported function called as `read()` does not receive the original API object as `this`. Preserve an explicit exported object and its call shape, or perform a separately tested receiver-independent refactor. Similarly, rebinding the CommonJS local alias `exports` is not equivalent to replacing `module.exports`; do not accidentally turn an existing no-effect assignment into a new API.

ESM bindings are read-only to importers, but an exported object's properties are not automatically immutable. A namespace object is not a drop-in mutable replacement for a CommonJS API object; its exotic-object semantics are defined separately by ECMAScript. [R17, R27]

### 5.5 Do not replace conditional loading blindly

Static imports are evaluated before the importing module body. Moving a function-local or conditional `require` to the top can introduce earlier side effects or load a dependency on paths that previously never loaded it. A `try/catch` around `require` is also not preserved by a top-level static import. [R17]

Use static imports for genuinely unconditional dependencies. Use `import()` when deferred or conditional loading is part of the contract, with an explicit asynchronous API and failure-handling decision. Do not spread promises into formerly synchronous callers as an accidental consequence of the conversion.

Preserve WebVOWL's parser lazy-loading boundaries. Its existing `verify-webvowl-lazy-parser-chunks.mjs` checks built parser placement; source syntax alone cannot prove the initial bundle remains small. [R11]

### 5.6 Inspect cycles and early reads

A CJS cycle can observe a partially initialized export object. ESM cycles use bindings that may be uninitialized when read. Some cycles are valid; others fail with a temporal-dead-zone error. Do not treat an import cycle as either automatically broken or automatically safe. [R18, R19]

Use dependency-cruiser to identify strongly connected components. Characterize their real import-time behaviour. Prefer extracting a dependency-independent shared contract or deferring operational work to an existing initialization boundary where appropriate. Otherwise migrate the component together. Do not fix each observed cycle with a different lazy-import wrapper.

Registry construction is a special risk: reading a class or constructing an element at module evaluation can expose a cycle that remained latent under a function-local `require`.

### 5.7 Preserve resolution and environment boundaries

Relative native ESM specifiers should name the actual file, including `.js` and any `index.js`. Bare package subpaths are different: keep documented package exports such as `owlapi/formats`; do not append guessed extensions or deep-import internal paths. [R20]

For Node-side file access, use file URLs or `fileURLToPath`/`pathToFileURL`; do not use a URL's `pathname` as a Windows filesystem path. For browser modules, use the browser/bundler asset contract rather than introducing Node filesystem APIs. JSON imports, URL-based resources and generated assets require environment-specific treatment, not one global `require` replacement rule. [R20, R21]

Check top-level `this`, `arguments`, `return`, implicit globals, and strict-mode-sensitive behaviour. An ESM conversion changes the parsing/execution context, not just two keywords. Avoid unnecessary top-level `await` and do not use query-string cache busting as a routine isolation mechanism: distinct ESM URLs can create distinct module instances. [R17, R20]

### 5.8 Keep external CommonJS separate from maintained-source CommonJS

An application can be entirely ESM while consuming a CommonJS dependency through a supported boundary. In Node, the CommonJS export is available as the default; synthesized named exports have limitations. Qualify the actual dependency shape under Node/Jest and Vite, and avoid `namespace.default || namespace` probing that obscures which contract is supported. [R20]

Inspect dependency conditional exports as well: replacing `require("package")` with `import` can select a different package entry. Qualify its API and identity rather than assuming an unchanged dependency version means unchanged code is selected. Avoid loading separate CJS and ESM implementations of a stateful dependency into the same application graph. [R12]

The goal is not to rewrite `node_modules`, remove every bundler-generated compatibility function, or declare all dependency code ESM. Nor should the migration add dual first-party implementations without a genuine supported-consumer requirement.

## 6. Test migration is a separate behavioural task

### 6.1 Fix the confirmed independent CommonJS test

The immediate syntactic change in `languageSelection.test.js` is:

```diff
-const { describe, test, expect } = require("@jest/globals");
+import { describe, test, expect } from "@jest/globals";
```

Its existing cases can be preserved. However, the full file defines and tests local implementations of browser-language selection and annotation filtering rather than importing the production functions. Consequently, its pass is not evidence that the actual sidebar/application behaviour survived migration. [R2]

Locate the current production owner and verify it through its real public behaviour or an appropriately extracted existing production function. Do not simply promote the copied test implementation into production. Syntax conversion and improving this test's production relevance can be separate reviewed changes; the evidence must describe their respective scope honestly.

### 6.2 Retire compatibility-only loaders by consumer group

Find every consumer of `loadEsmModuleForTest`, and every independently implemented `SourceTextModule` loader. Classify the latter by purpose before removing anything.

For ordinary tests, replace loader-populated variables with static imports when no pre-import setup is required. Use standard dynamic import after setup/mock registration where ordering is intentional. Preserve existing dependency injection rather than replacing it with more module mocking. [R3, R13]

Migrate in this order: pure utilities; factories and singleton/constructor groups; tests with dependency substitution; composition/integration cases. Preserve the test's subject and its assertions while replacing loading infrastructure. The current controller test is a concrete example of ESM test source that nevertheless constructs another module graph through custom VM loading. [R22]

The shared loader's cache is intended to preserve `instanceof` identity. Removing it must replace that guarantee with a single consistent standard-loaded graph—not remove the relevant assertions. Check for tests that import a constructor normally but load the subject's constructor through a different VM graph. [R3]

### 6.3 Use Jest's ESM mocking contract

Register an ESM mock before dynamically importing the subject that consumes it:

```js
import { expect, jest, test } from "@jest/globals";

const readSource = jest.fn().mockResolvedValue("fixture");
jest.unstable_mockModule("./sourceReader.js", () => ({ readSource }));
const { loadSource } = await import("./sourceLoader.js");

test("uses the supplied source reader", async () => {
  await loadSource();
  expect(readSource).toHaveBeenCalledTimes(1);
});
```

The names above are illustrative, not claimed repository APIs. A static import of the subject would load it before the mock-registration body executes. ESM targets and CJS targets have different Jest mocking mechanisms; use the selected version's documented APIs. [R13]

Prefer separate mock contexts or existing injectable factories when tests need different implementations. Verify isolation rather than assuming `resetModules`, unmocking, or a new import expression necessarily creates the intended fresh graph.

### 6.4 Check global setup and browser-sensitive behaviour

Some renderer tests install D3 or DOM state before loading a subject. Moving the subject to a static import can move its evaluation before that setup. Preserve intentional ordering with supported dynamic import where needed, or use an existing injection boundary. Do not redesign production dependencies just to simplify a syntax-only test edit.

Keep real-renderer/browser coverage for gestures, transitions, fonts, geometry, and export. A passing fake or module-format gate cannot establish those behaviours. The branch's later corrective work is evidence that source-format completion and product acceptance are separate. [R4]

## 7. Extend the existing ratchet, not the bespoke analyzer

The preferred implementation is another directory-wide test in the existing architecture-test owner, reusing its parser facts and traversal helpers. The following is a **proposed final-state test**, not an applied or executed patch:

```js
test("keeps executable CommonJS out of every src JavaScript file", () => {
  const violations = [];
  const modulePaths = collectAuthoredJavaScriptModulePaths(
    absoluteRepositoryPath("src"),
  );

  for (const absolutePath of modulePaths) {
    const modulePath = toRepositoryRelativePath(absolutePath);
    const source = readFileSync(absolutePath, "utf8");
    const analysis = analyzeAuthoredJavaScriptModule(source, modulePath);

    if (analysis.syntaxErrorMessage !== undefined) {
      violations.push(`${modulePath}: ${analysis.syntaxErrorMessage}`);
      continue;
    }

    if (path.extname(modulePath).toLowerCase() === ".cjs") {
      violations.push(`${modulePath}: explicit CommonJS file extension`);
    }

    for (const label of analysis.prohibitedSourcePatternLabels ?? []) {
      if (COMMONJS_PROHIBITED_SOURCE_PATTERN_LABELS.includes(label)) {
        violations.push(`${modulePath}: ${label}`);
      }
    }
  }

  expect(violations).toEqual([]);
});
```

This uses helpers already present in the inspected architecture test. It deliberately does not impose the WebMCP named-export policy on every pre-existing ESM API, or demand an import/export declaration in every format-neutral file. Interpretation, exact inventory coverage, explicit relative specifiers and dependency-boundary checks remain separate companion assertions. The team must qualify the combined gate against its current revision. [R5]

If a staged migration needs an exception list, seed it from the reviewed complete census. Require exact membership, documented reasons, no growth, removal on conversion, and a final empty set. A temporary `.cjs` rename of an existing helper remains a CommonJS artifact in the denominator; it is not a completed conversion. Prefer a small atomic final cutover where feasible rather than inventing new wrappers.

### Required controls for the broadened gate

Test that an unimported CommonJS source file, a CommonJS test outside the original required directories, a hybrid file, an explicit `.cjs` file, and a malformed source each fail for the right reason. Test that comments/strings containing CommonJS examples and shadowed local names do not fail. A format-neutral test should pass under an explicit ESM scope. A newly introduced nested CommonJS package scope should fail the interpretation gate.

Maintain parser and graph-source failures as blockers. Keep speculative alias/value-escape findings advisory unless independently confirmed. The repository already has extensive machinery; extending coverage does not justify another general-purpose language analyzer. [R5, R14]

## 8. Implementation work packages

| Package | Scope and deliverable | Exit evidence |
| --- | --- | --- |
| **M0 — Current census and baseline** | Reconcile all `src/` paths; inspect controlling package scopes; classify remaining modules and consumers; record versions, effective config, discovered tests and existing failures. | Complete path accounting, actual CommonJS/hybrid inventory, dependency graph, baseline evidence. |
| **M1 — Directory-wide policy and loading decision** | Broaden source-format coverage with negative controls; qualify ordinary imports; approve either a `src` package scope or a justified alternative and exact supporting changes. | Gate catches a disconnected CommonJS file; pilot tests exercise genuine standard loading. |
| **M2 — Independent leaves and tests** | Convert low-coupling actual CommonJS candidates wherever found, including `languageSelection.test.js`; update necessary importers without changing singleton/API semantics. | Focused tests and gate pass; production relevance of tests is explicit. |
| **M3 — Coupled source groups** | Convert residual registries, constructor/prototype groups, utilities, parser/renderer modules, or application groups identified by M0. Skip already-ESM implementations. | Real import graphs, identity/cycle/initialization tests, affected integration and browser checks. |
| **M4 — Test-support convergence** | Migrate compatibility-loader consumers and retire the helper and duplicate ordinary loaders. Retain intentional module-loader tests. | Standard-loaded graphs, correct mocking/isolation, constructor identity, no remaining bridge consumers. |
| **M5 — Explicit all-source ESM cutover** | Activate the chosen scope if not already active; eliminate temporary CommonJS exceptions and enforce all nested scopes. | Every in-scope path satisfies source and interpretation gates; test discovery preserved. |
| **M6 — Supporting build cleanup** | Remove first-party compatibility handling only when no first-party need remains; qualify dependency compatibility separately. | Cold dev startup, production/development builds, preview and lazy-parser/asset evidence. |
| **M7 — Final acceptance and closure** | Review final source and integration deltas; run broad final verification; reconcile all census dispositions; remove task-owned scratch. | Traceable final snapshot, zero unresolved classifications, required CI and browser outcomes, honest remaining product issues. |

M3 is conditional on what the complete inventory actually finds; it must not be populated with already-converted files simply to create work. It must also not be declared unnecessary based only on the WebMCP exception set. M4 and the interpretation pilot may need to precede particular M2/M3 groups. The dependency graph decides the sequence.

### Per-group implementation procedure

Select one coherent group and all required consumer edits. Add a failing format/linking test or a missing focused characterization. Make the smallest contract-preserving conversion. Update imports, mocks and setup order. Run focused behaviour and source-format checks. Inspect the graph and broaden verification according to actual impact. Remove the exact retired exception/route. Review the final delta and record its evidence.

A syntax-only change need not make existing behaviour fail first. The intended red test can be the format requirement; existing behaviour should remain green. Full-suite repetition does not replace missing focused evidence. Conversely, package interpretation, shared constructors, parser boundaries and build changes generally warrant wider integration checks.

## 9. Verification and rollback

The existing CI workflow checks out a pinned sibling `universal-ontology` corpus and stages it into the expected `dist` layout before the full application suite. Reproduce these prerequisites; a missing corpus is not an ESM defect. [R23]

Baseline and final checks include the existing commands:

```powershell
node --version
npm --version
npm ci --ignore-scripts
npm ls --depth=0
npm test -- --showConfig
npm test -- --listTests
npm test -- --runInBand
npm run build
node util/verify-webvowl-lazy-parser-chunks.mjs
npm run build:dev
```

Run the lazy-parser verifier immediately after the production build, before a development build can overwrite the default `deploy/js` output that it inspects. Use fresh or explicitly inventoried output for each build. Run setup/install in the designated isolated checkout, not an unrelated active worktree. For machine-readable Jest discovery, invoke its binary directly so npm wrapper output cannot contaminate captured JSON:

```powershell
node --experimental-vm-modules node_modules/jest/bin/jest.js --listTests --json
```

Focused examples, using existing paths:

```powershell
npm test -- --runInBand --runTestsByPath src/app/js/languageSelection.test.js src/productionModuleFormat.architecture.test.js
npm test -- --runInBand --runTestsByPath src/productionGraph.architecture.test.js src/testRunnerScope.architecture.test.js
```

These are proposed commands, not research-session pass results. Do not deploy or upload merely to qualify a build. Retain exact exit statuses and failure logs; shell pipelines must not conceal the status of the command being evaluated. [R6, R11, R23]

| Verification layer | Required evidence |
| --- | --- |
| Source census | Every accepted path analyzed; every parse failure and exception accounted for; new disconnected files covered. |
| Native module linking | Representative actual graphs load with correct exports and resolution; no hybrid-runtime or initialization failure. |
| Contract preservation | Singleton and constructor identity, object receiver semantics, conditional loading, side effects, sync/async boundaries and failure propagation preserved. |
| Test credibility | Same intended suites/cases discovered; mocks target the right graph; isolation and pre-import setup correct; copied algorithms not misrepresented as production tests. |
| Converter integrity | Existing supported-format, corpus and semantic-differential checks preserved; no mass expected-output regeneration to hide changes. |
| Browser integration | Real ontology load, search/language/filter controls, pan/zoom/drag, pause/resume, lifecycle cancellation and relevant exports work. |
| Delivery | Cold development, fresh output, production/development builds and preview work; lazy parsers and assets remain correct. |
| Platform coverage | Pinned supported runtime; Windows paths and case-sensitive CI resolution verified. |

`node --check` proves parsing, not import resolution, export matching or application behaviour. Similarly, a Node test pass cannot prove browser-global setup, D3 transitions, network delivery or SVG appearance.

### Keep D3 delivery separate

The current Vite configuration includes `vite-plugin-commonjs` and separate D3 provision, script injection and distribution handling. First-party ESM completion can justify testing removal of the former; it does not automatically justify deleting the latter. Vite's third-party dependency compatibility also remains a separate responsibility. [R24, R25]

Use a fresh/inventoried output directory: the configuration uses `emptyOutDir: false`, so stale files can conceal a delivery defect. Preserve the existing fixed deployment contract and qualify cold startup rather than relying on a previously warmed dev server. Vite 8's toolchain differs from older recipes; do not apply historical Rollup/esbuild-specific cleanup instructions mechanically. [R24, R26]

Do not set `sideEffects: false` merely because the code is ESM. Registry initialization, registrations, CSS and bootstrap work need explicit consideration. Measure bundle boundaries and startup cost; there is no automatic runtime-speed improvement when the actual algorithms remain unchanged.

### Roll back coherent changes, not isolated declarations

A rollback must restore module declarations, necessary importer changes, package interpretation, test setup, configuration and lockfile changes together when they form one dependency contract. Prefer ordinary reviewed commits/reverts or complete known-good artifacts. Do not undo concurrent user changes or broadly delete generated state. Keep module-migration acceptance distinct from pre-existing product defects and the wider WebMCP feature's acceptance.

## 10. Final acceptance ledger

Report the final source-file total and dispositions: already ESM; newly converted; format-neutral under explicit ESM interpretation; deliberately retired; and unresolved. The counts must reconcile with the final file inventory, including additions and deletions during implementation.

Required closure conditions:

1. No unreviewed file, syntax error, CommonJS implementation or temporary first-party interoperability exception remains in scope.
2. All intended source scopes explicitly select ESM; naming and exports preserve the approved contracts.
3. Tests use standard loading except where module-loader behaviour itself is deliberately under test.
4. Exact inventory, dependency, module-format and interpretation gates cover future `src/` files automatically.
5. Required unit, integration, corpus, build, platform and browser checks qualify the actual final snapshot.
6. Historical WebMCP evidence, fresh migration verification and unresolved product acceptance are reported separately.

**The finish line is not “the WebMCP migration list is empty”. It is “every JavaScript artifact in the complete `src/` scope is accounted for, runs under the intended ESM contract, and retains verified behaviour.”**

## References

**Repository references are pinned to the researched revision unless an immutable historical commit is explicitly given.**

[R1] Complete recursive source tree: https://api.github.com/repos/Hadden-Industries/webvowl/git/trees/0486697a33a06033168102d885b0c37c80c00169?recursive=1 ; revision: https://github.com/Hadden-Industries/webvowl/commit/7fe956151e3dd77a8b7e07cdee4e65d068deebc1

[R2] Language selection test: https://github.com/Hadden-Industries/webvowl/blob/7fe956151e3dd77a8b7e07cdee4e65d068deebc1/src/app/js/languageSelection.test.js

[R3] Transitional module loader: https://github.com/Hadden-Industries/webvowl/blob/7fe956151e3dd77a8b7e07cdee4e65d068deebc1/src/app/test/loadEsmModuleForTest.js

[R4] Migration commits:
- https://github.com/Hadden-Industries/webvowl/commit/a4ad2211be2a73cc546eb297973f45c9c41f02bd
- https://github.com/Hadden-Industries/webvowl/commit/a11472c7118b6da62e0615a975f4a46d2f1931c7
- https://github.com/Hadden-Industries/webvowl/commit/34af8ece09ad5131bda07336d6e9827f2836d6f6
- https://github.com/Hadden-Industries/webvowl/commit/ca4b6f1ee76cc67fa3ab0990fb80933d7c0549aa
- https://github.com/Hadden-Industries/webvowl/commit/2b669e6ac5d6bdb894d33955a58ee7ee30392967
- https://github.com/Hadden-Industries/webvowl/commit/5240e9ee498a81a51780d4773ead9882b508b17a
- https://github.com/Hadden-Industries/webvowl/commit/6cde450586868e85dc2f6314e1087a8db263bdfe
- https://github.com/Hadden-Industries/webvowl/commit/edb74ad5e5facf9bd8fba608849a3579dae18957

[R5] Architecture gate: https://github.com/Hadden-Industries/webvowl/blob/7fe956151e3dd77a8b7e07cdee4e65d068deebc1/src/productionModuleFormat.architecture.test.js

[R6] Manifest and Node pin: https://github.com/Hadden-Industries/webvowl/blob/7fe956151e3dd77a8b7e07cdee4e65d068deebc1/package.json ; https://github.com/Hadden-Industries/webvowl/blob/7fe956151e3dd77a8b7e07cdee4e65d068deebc1/.node-version

[R7] Existing converter module scope: https://github.com/Hadden-Industries/webvowl/blob/7fe956151e3dd77a8b7e07cdee4e65d068deebc1/src/owl2vowl/package.json

[R8] Original WebMCP implementation plan: https://github.com/Hadden-Industries/webvowl/blob/7fe956151e3dd77a8b7e07cdee4e65d068deebc1/docs/plans/2026-08-29-webmcp-integration.md

[R9] Math accessor before and after conversion: https://github.com/Hadden-Industries/webvowl/blob/72ca75a9bb208c75bc5acfbf062f212d54074b33/src/shared/js/util/math.js ; https://github.com/Hadden-Industries/webvowl/blob/2b669e6ac5d6bdb894d33955a58ee7ee30392967/src/shared/js/util/math.js

[R10] Registry implementation: https://github.com/Hadden-Industries/webvowl/blob/7fe956151e3dd77a8b7e07cdee4e65d068deebc1/src/webvowl/js/elements/nodes/nodeMap.js

[R11] Lazy parser verifier: https://github.com/Hadden-Industries/webvowl/blob/7fe956151e3dd77a8b7e07cdee4e65d068deebc1/util/verify-webvowl-lazy-parser-chunks.mjs

[R12] Node package/module interpretation: https://nodejs.org/api/packages.html

[R13] Jest 30.4 ESM guidance: https://jestjs.io/docs/30.4/ecmascript-modules

[R14] ESLint public analysis APIs: https://eslint.org/docs/latest/integrate/nodejs-api ; https://eslint.org/docs/latest/extend/custom-rules

[R15] Dependency-cruiser public CLI: https://github.com/sverweij/dependency-cruiser/blob/main/doc/cli.md

[R16] Jest transformer configuration: https://jestjs.io/docs/30.4/configuration

[R17] Module import semantics: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/import

[R18] Node CommonJS cycles: https://nodejs.org/api/modules.html#cycles

[R19] ESM cycles: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules#cyclic_imports

[R20] Node ESM resolution and interoperability: https://nodejs.org/api/esm.html

[R21] Node URL/file conversions: https://nodejs.org/api/url.html

[R22] Controller tests using custom loading: https://github.com/Hadden-Industries/webvowl/blob/7fe956151e3dd77a8b7e07cdee4e65d068deebc1/src/app/js/controller/webVowlController.test.js

[R23] Application CI and corpus prerequisites: https://github.com/Hadden-Industries/webvowl/blob/7fe956151e3dd77a8b7e07cdee4e65d068deebc1/.github/workflows/webvowl-ci.yml

[R24] Vite configuration: https://github.com/Hadden-Industries/webvowl/blob/7fe956151e3dd77a8b7e07cdee4e65d068deebc1/vite.config.mjs

[R25] Vite dependency pre-bundling: https://vite.dev/guide/dep-pre-bundling

[R26] Vite 8 migration guidance: https://vite.dev/guide/migration

[R27] ECMAScript 2026 module namespace exotic objects: https://tc39.es/ecma262/2026/multipage/ordinary-and-exotic-objects-behaviours.html#sec-module-namespace-exotic-objects
