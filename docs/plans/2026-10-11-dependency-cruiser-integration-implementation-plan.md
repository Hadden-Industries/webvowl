# WebVOWL dependency graphs and affected Jest tests

Date: 2026-10-11.
Status: **reviewable draft; implementation, configuration changes, commits and publication are not authorized by this document**.

## Recommendation and intended outcome

Bring WebVOWL's developer tooling to the capabilities delivered in Markdown Quality: reproducible dependency views, explainable affected-test selection, and optional execution of complete selected test files after conservative selection has been proved.
Retain WebVOWL's existing dependency-cruiser 18.5.0 and Jest 30.5.2 installations, native ESM execution, two-worker default, and specialized architecture assertions.
Use supported dependency-cruiser and Jest interfaces; add only the WebVOWL-specific coordination, declared non-import relationships, safety checks and evidence needed between them.

The beneficiary is a maintainer investigating a dependency or checking a bounded change.
Success means a useful dependency view and trustworthy, potentially faster local feedback without losing failures that the independent full suite would find.
A smaller selected set is not itself a benefit: measure selection plus execution time, maintenance cost and missed-failure detection.
Shared modules, architecture checks, browser resources and uncertain dependencies may legitimately require most or all tests.

Deliver graph generation and list-only selection first.
Develop execution behind an admission gate, prove adversarial fixtures and full shadow comparisons, then enable the explicitly invoked affected command.
Keep ordinary `npm test`, full checks and hosted checks independent.
Correct the currently incomplete HISEW `full` profile through the precise draft proposal below; a profile called `full` currently runs only the build.
HISEW affected-input support remains external future work, tracked in [HISEW issue 150](https://github.com/Hadden-Industries/software-engineering-workflow/issues/150).

## 1. Authority, baseline and evidence status

The accepted task is to prepare and save this plan.
Its REQ, AC, QA, DEC and SLICE identifiers, selected design, risk route and configuration proposals are **draft representations awaiting owner acceptance**.
No accepted requirement snapshot, implementation execution, native verification receipt, independent review or release approval is claimed.

[Repository instructions](../../AGENTS.md) require explicit approval for exact configuration changes, separate authority for commits and pushes, and preservation of all existing work.
This planning task authorizes source and primary-source research, read-only HISEW inspections and this maintained document.
It does not authorize installing dependencies, editing configuration or source, adopting another task's execution, changing the shared session target, creating an issue, committing, pushing, merging or deploying.

A later acceptance can authorize this exact implementation and configuration proposal, including conditional local activation after the stated proof, in one decision.
The lifecycle owner should then proceed through those authorized slices without repeated phase prompts.
Commit, push, merge and deployment authority must be included explicitly when intended; Markdown Quality's earlier approvals do not transfer to WebVOWL.
Changed scope, materially different configuration or an unmet safety condition requires a new decision for the affected work.

### Target inspected on 2026-10-11

| Observation                            | Inspected value                                                                              |
| -------------------------------------- | -------------------------------------------------------------------------------------------- |
| Checkout                               | `C:/Users/maksy/GitHub/webvowl`                                                              |
| Current branch                         | `refactor/dry-shared-declarations`; its configured upstream is gone                          |
| HEAD                                   | `ddd0d52823a9de77e26cada4729b599bd6f55189`, shared-declarations refactor                     |
| HEAD parent / local main               | `39297b17f0801722c4921b802602ac3881970773`                                                   |
| Local origin/main and live remote main | `5305ba93b4e80f64f36b7fef72e1541f56dd467f`, merge of PR 74                                   |
| HEAD and origin/main tree              | Both `8623be01a46a9b5f82119d4919445dbaaf1b800c`; no content diff                             |
| Working tree before this document      | Clean; the requested plan path did not exist                                                 |
| Tracked inventory                      | 2,514 paths; 513 JS/MJS/CJS paths, described below                                           |
| Repository runtime selections          | `.node-version` is `24.21.0`; `.python-version` is `3.15.0`; package manager is `npm@12.2.0` |
| Locally queried tool versions          | Node `v24.21.0`, npm `12.2.0`; this is not suite qualification                               |

These are observations, not a selected future implementation branch or baseline.
An earlier comparison saw many uncommitted changes; the current branch contains the shared-declarations commit and is merged in origin/main.
Treat current contents as authoritative and do not restore the earlier dirty state or assume absent content was lost.
Before implementation, recheck live remote main, local ancestry, HEAD/tree, index, untracked paths and task/worktree ownership, and agree a settled comparison baseline and disposition for concurrent work.
Preserve everything not created by this task.
Do not switch, restore, reset, stash, clean or retire the current branch merely to prepare this work.
Stage only explicitly authorized paths if later commit authority is granted.

### Reference implementation

The reference is Markdown Quality at immutable commit `0fac1db72856c7579625562c4a145f0801b2fb80`, observed on clean local main.
The implementation commit is `d315bb76014312ebe2887865070d54e11c1c9d10`; `e81502332d99485423d6e7ea952cea225c221848` normalized its accepted plan; `0fac1db72856c7579625562c4a145f0801b2fb80` changed cancellation fixtures to pass paths as data.
The original plan commit is `6265310881d28745cbc051c228a61cb97a99c74a` and its pre-feature source baseline was `12768981722c5c85e11f9090e7aafbdf8fa404fb`.

Read the [reference maintainer contract](https://github.com/Hadden-Industries/markdown-quality/blob/0fac1db72856c7579625562c4a145f0801b2fb80/docs/dependency-graph-and-tests.md), [accepted implementation basis](https://github.com/Hadden-Industries/markdown-quality/blob/0fac1db72856c7579625562c4a145f0801b2fb80/docs/plans/2026-10-10-markdown-quality-dependency-cruiser-implementation-plan.md), [graph adapter](https://github.com/Hadden-Industries/markdown-quality/blob/0fac1db72856c7579625562c4a145f0801b2fb80/scripts/dependency-graph.js), [affected coordinator](https://github.com/Hadden-Industries/markdown-quality/blob/0fac1db72856c7579625562c4a145f0801b2fb80/scripts/affected-tests.js), and [regression corpus](https://github.com/Hadden-Industries/markdown-quality/blob/0fac1db72856c7579625562c4a145f0801b2fb80/test/affected-tests.test.js).
The reference reporter is `scripts/test-outcomes.js`, which consumes Node test-runner events and is not a Jest reporter.
Its contracts and fixtures are useful; its runner, root inventory, package rules and process assumptions are not drop-in WebVOWL implementations.

### Native HISEW observations

Installed method and engine: `0.1.0-dev.18` / `0.1.0.dev18`.
`inspect-project-applicability` reported `personal`, `active: true` for WebVOWL.
`inspect-verification-profiles` reported worktree `4200f543-f93d-41d8-902c-971a9ce530f9`, legacy-inherited declarations, shared-project policy and `risk-route-not-selected`.
Command resolution was observed; environments and coverage were not probed or verified.

| Profile    | Registered command | Deadline    | Actual source-inspected scope                                                             |
| ---------- | ------------------ | ----------- | ----------------------------------------------------------------------------------------- |
| `focused`  | `npm run lint`     | 600 seconds | App lint, Python lint and Markdown checks                                                 |
| `affected` | `npm run test`     | 600 seconds | Default full Jest invocation with no baseline or path arguments                           |
| `full`     | `npm run build`    | 600 seconds | Prebuild app formatting/lint and Vite bundle; no Jest, Python or documentation test proof |

All three have undeclared coverage and input ordering.
The word `full` cannot substantiate full product assurance from that build command.
The draft correction is to select the existing `check` npm script for this worktree's `full` profile, preserving a measured finite deadline and the other profiles; see section 8.

`inspect-environment` confirmed available configuration root `C:/Users/maksy/.hi/w/c` and evidence root `C:/Users/maksy/.hi/w/e`, with operator namespace `C:/Users/maksy/.hi/w/e/operator`.
There is no configured shared temporary root and no fallback.
No resource group, snapshot or execution was allocated for planning.
The engine's own Python 3.14.8 is distinct from WebVOWL's selected Python 3.15.0 and supplies no repository Python proof.

## 2. Proposed risk route

**Risk class:** R2, proposed for the eventual combined implementation.

**Decision owner:** Repository owner for intent, configuration, accepted baseline and activation; implementing lifecycle owner for traceable delivery; independent verifier for the required assurance opinion.

**Reasoning:** Selection can omit execution and produce misleading green feedback; baseline materialization crosses Git/filesystem boundaries; subprocess cancellation must handle Jest workers and nested Vite/native children without affecting unrelated processes.
Concurrency, process ownership, input parsing, filesystem containment and cross-tool evidence are material R2 triggers.
The local opt-in scope and retained full commands reduce blast radius but do not remove these triggers.
There is no observed safety-critical or legally controlled R3 use; evidence retention required by R2 is not by itself an R3 claim.

**Potential blast radius:** Maintainers' confidence, local test resources, source and evidence integrity, and assurance configuration for the selected worktree.
There is no proposed production runtime, public VOWL contract or deployment change.

**Reversibility:** Stop using the affected command and resume the independent full route immediately.
Later remove only this change's tooling/configuration through an authorized ordinary change, preserving diagnostics and other work.
Process cleanup that cannot be proved remains an unresolved recovery item, not an asserted rollback.

**Principal unknowns:** Workspace resolution fidelity; non-import consumer inventory; faithful native Jest reporting/discovery; Windows descendant ownership; real graph/full-run costs and timeout feasibility.

**Required artifacts:** This accepted revision and its native snapshot once authorized, exact route/decision record, source/tests/policy, bounded verification and review evidence, and resource disposition.
Use the existing task record; no additional issue or separate dossier is required solely for ceremony.

**Required specialist lenses:** Independent verification of completeness/oracles and final native security assessment of source materialization, configuration admission, path/process handling and result integrity.
Ordinary review must also assess semantic names, native reuse and preserved architecture assertions.
These are proposed R2 obligations under the inspected HISEW methods, not completed assessments or authority to scan now.

**Required verification:** Focused contracts during implementation, relevant integration regressions, the corrected native full obligation on the settled candidate, independent shadow/negative-control proof, and supported Windows/Linux process evidence.
Hosted and local results remain distinct.

**Required human approvals:** Accept the exact draft baseline, selected design and section 8 configuration proposal; include implementation and conditional local activation authority.
Commit/push/merge/deployment require their applicable separate authorization.
No no-shim exception is proposed.

**Maximum sensible autonomy:** Now, research and this plan only.
After acceptance, implement and repair within the approved boundaries, continuing through conditional gates without repeated phase prompts.
Do not weaken assertions, invent baseline inputs, expand configuration or claim missing assurance.

**Next lifecycle step:** Owner reviews this concrete draft.
After acceptance, refresh checkout/tool/storage facts, capture the exact accepted bytes through HISEW and start a new scoped execution with current ownership.
Do not adopt retained shared-declarations or Markdown Quality execution state.

## 3. Current architecture and parity gaps

The existing [production-module-format test](../../src/productionModuleFormat.architecture.test.js) already follows dependency-cruiser's public `bin.depcruise` mapping and invokes it through Node with `--no-config`, JSON output, a 16 MiB buffer and `node_modules` traversal excluded.
It combines authoritative graph records with ESLint scope-aware authored-source facts.
It checks unresolved, outside-source, missing and duplicate records, production-to-test-support edges, CommonJS leakage, prohibited Node module API access and the native-ESM ratchet.
Its inferred value-flow findings remain advisory.
Required ESM directories include application controllers, UI, WebMCP and `src/webvowl/js/runtime`.
Preserve the complete assertion set and its policy self-tests.

| Capability              | Markdown Quality reference                       | WebVOWL as inspected                                                    | Planned adaptation                                                                                                          |
| ----------------------- | ------------------------------------------------ | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Analyzer adoption       | Dev-only dependency-cruiser 18.5.0               | Already `>=18.5.0`, locked and installed at 18.5.0                      | Retain dependency and public interface discipline; no install or lock churn required by parity                              |
| Complete graph input    | Authored `src`, `scripts`, `test` roots          | Architecture-specific entry inventories                                 | Admit all first-party authored roots, including disconnected modules and package conformance code, before display filtering |
| Routine graph bundles   | Native JSON/Mermaid plus provenance              | No dedicated bundle command found                                       | New opt-in external bundle command                                                                                          |
| Architecture policy     | Generic native graph rules                       | Strong specialized source and graph assertions                          | Add appropriate graph rules; retain specialized assertions as independent authorities                                       |
| Test discovery/runner   | Native Node test files                           | Jest 30.5.2, ESM VM modules, two workers                                | Native Jest discovery, exact-file invocation and JSON results                                                               |
| Baseline/current union  | Source-only historical graph and current graph   | No dedicated selector                                                   | Explicit immutable baseline, complete change envelope and native reverse reachability on both snapshots                     |
| Workspace identity      | Single reference package                         | Bare `vowl` imports and npm workspace link                              | Resolve each snapshot's first-party package from its own source; never traverse the current workspace link for a baseline   |
| Non-import dependencies | Reviewed worker/process/generated/copy relations | Workers, Vite, resource reads, conformance inputs, source-reading tests | WebVOWL-specific declared relationships and conservative full domains                                                       |
| Shadow/cancellation     | Node outcomes and bounded process handling       | Jest workers and nested Vite/native children                            | Native Jest outcomes; independently prove platform containment rather than transplanting assumptions                        |
| CI/HISEW scope          | Full CI preserved; no-arg affected stays full    | HISEW affected already full Jest; full is build-only                    | Keep CI scope; propose full-profile correction; no fabricated typed affected inputs                                         |

[Production graph](../../src/productionGraph.architecture.test.js), [OwlAPI consumer boundary](../../src/owlapiConsumerBoundary.architecture.test.js), [rendered graph decoupling](../../src/renderedGraphDecoupling.architecture.test.js) and [test runner scope](../../src/testRunnerScope.architecture.test.js) have separate contracts.
Some existing tests own regular-expression traversal or read source files instead of importing them.
Their wholesale migration is outside scope; preserve them and include their source-consumption relationships in selection.
Do not replace them with a weaker generic cycle/import check or duplicate their semantic analyzer in the new coordinator.

The current [application workflow](../../.github/workflows/webvowl-ci.yml) runs application Jest serially on Ubuntu 24.04, and Python tooling on Ubuntu and Windows.
The Windows Python matrix is **not Windows Jest evidence**.
Documentation has a separate full authored-corpus check and Markdown integration tests.
Existing CI selection and authenticated PR-evidence reuse remain independent; new local hashes cannot satisfy those contracts.

## 4. Source-backed software selection

Research was refreshed on 2026-10-11 using the exact installed/locked manifests and licence files, registry metadata, tagged maintainer source and current official documentation.
The questions were whether existing native capabilities already cover graph extraction, historical topology, workspace exports, Jest discovery/execution/results and descendant cancellation.
No package was installed and no product tests or analyzer experiments were run for this research.

| Candidate or native facility                               | Fit and limitation                                                                                                                                                                                      | Draft decision                                                                                             |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| dependency-cruiser 18.5.0 public `cruise()` and `format()` | Owns parsing, module resolution, graph validation, reverse `reaches` and native reports; explicit resolver/transpiler arguments avoid executable config discovery                                       | Reuse; implement no general import resolver, graph traversal or Mermaid renderer                           |
| dependency-cruiser CLI `--affected`                        | Useful Git-based exploration, but its current-graph/extension policy is not the accepted old/current, arbitrary-resource and dirty-input completeness contract                                          | Keep as an assessed native alternative, not authoritative selection here                                   |
| Jest 30.5.2 `--findRelatedTests` and `--changedSince`      | Native related tests and Git convenience; installed inverse resolution builds from current HasteFS and seeds existing paths, so deleted edges/source and external resources require additional evidence | Preserve for ordinary developer use; do not substitute them for the conservative union contract            |
| Jest `--listTests`, `--runTestsByPath`, `--json`           | Supplies native whole-file discovery, exact path execution and outcomes under the actual runner                                                                                                         | Selected; no duplicate test-match grammar or replacement test runner                                       |
| Jest `--runInBand`                                         | Existing deliberate serial mode; does not by itself prove process cleanup or faster feedback                                                                                                            | Preserve explicit serial uses; do not change the two-worker default                                        |
| Nx affected tasks                                          | Maintained project/task orchestration, with a broader project graph and adoption model than this bounded file-selection gap                                                                             | No adoption in this plan; reconsider only if project-level scheduling becomes the accepted need            |
| Node child-process APIs and platform process facilities    | Supported direct argv, deadlines/signals and platform termination; killing one child does not establish descendant quiescence                                                                           | Reuse for the residual runner boundary, subject to platform proof; do not presume a new general supervisor |

Primary contracts: [dependency-cruiser API](https://github.com/sverweij/dependency-cruiser/blob/v18.5.0/doc/api.md), [CLI](https://github.com/sverweij/dependency-cruiser/blob/v18.5.0/doc/cli.md), [resolver options](https://github.com/sverweij/dependency-cruiser/blob/v18.5.0/types/resolve-options.d.mts), [native workspace classification](https://github.com/sverweij/dependency-cruiser/blob/v18.5.0/src/extract/resolve/module-classifiers.mjs), [Jest CLI](https://jestjs.io/docs/cli), [Jest ESM](https://jestjs.io/docs/ecmascript-modules), [Jest result configuration](https://jestjs.io/docs/configuration#testresultsprocessor-string), [Nx affected tasks](https://nx.dev/docs/features/ci-features/affected), and [Node child processes](https://nodejs.org/download/release/v24.21.0/docs/api/child_process.html).

### Version, rights and consumer validation

Registry `latest` matched the current dependency-cruiser 18.5.0 and Jest 30.5.2 locks.
The analyzer requires Node `^22 || ^24 || >=26`; Jest admits Node 24.
Node's release index identifies 24.21.0 as the latest patch of the newest current LTS line, while 26.11.1 is Current.
Retain WebVOWL's Node 24.21.0 and npm 12.2.0 selections; do not import Markdown Quality's broader runtime support matrix or upgrade runtimes merely for this plan.
Recheck versions and supported contracts before incorporation; a material new release requires an explicit selection/rebaseline decision, not a floating install during verification.
Sources: [analyzer registry](https://registry.npmjs.org/dependency-cruiser/18.5.0), [Jest registry](https://registry.npmjs.org/jest/30.5.2), [Node release index](https://nodejs.org/dist/index.json), [Node release policy](https://nodejs.org/en/about/previous-releases).

The installed analyzer licence is MIT, copyright Sander Verweij; Jest's is MIT, copyright Meta and contributors.
Both require retention of their notices when applicable copies are distributed.
WebVOWL, its `vowl` workspace and the reference adapter source are AGPL-3.0-only.
The proposed use remains internal development analysis with no new runtime dependency, remote service, telemetry or distribution of analyzer/runner code in browser output.
Direct terms inspection is complete; existing organizational approval, applicable transitive notice treatment and the final distribution check must be recorded rather than inferred from SPDX alone.
Any reused reference code must retain its provenance and applicable licence obligations.
No actual organizational legal clearance is claimed by this draft.
Exact texts: [analyzer licence](https://github.com/sverweij/dependency-cruiser/blob/v18.5.0/LICENSE), [Jest licence](https://github.com/jestjs/jest/blob/v30.5.2/LICENSE), [WebVOWL licence](../../LICENSE).

Let native consumers validate their own contracts: dependency-cruiser validates rules/options and graph input; Jest validates the admitted current configuration and CLI options.
Use the public resolver argument for native `modules`, exports and containment settings, not private implementation imports.
The repository owns only its residual impact-policy/report fields and their bounded validation.
Do not create a shadow implementation of upstream option enums, package exports, Jest matching or schema dialects.
Current installed source inspection is evidence about fit; Windows/Linux integration remains unverified.

## 5. Draft requirements, acceptance criteria and decisions

| Requirement                                             | Proposed acceptance criterion                                                                                                                                                                                      |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| REQ-001: preserve application and architecture behavior | AC-001: full existing ESM, CommonJS, consumer-boundary, graph-decoupling and scope assertions remain effective, with unchanged runner/runtime defaults and no product export/dependency change                     |
| REQ-002: reproducible complete authored graph           | AC-002: disconnected roots and workspace/conformance/tooling sources appear before display filtering; native JSON and all views bind one admitted snapshot and labelled resolution context                         |
| REQ-003: safe graph/configuration boundary              | AC-003: data-only admission, native validation and finite resources; executable-config, outside-source, link, encoding and injection sentinels cannot execute or escape                                            |
| REQ-004: faithful historical and current topology       | AC-004: explicit full baseline identity and complete committed/staged/unstaged/untracked change union select old and current consumers, including workspace changes; no historical code/config/install runs        |
| REQ-005: preserve non-import consumers                  | AC-005: each admitted worker, process, generated-program, source-reader or resource relation has source evidence and an independently expected fixture; unknowns widen to full or block                            |
| REQ-006: native Jest discovery and execution            | AC-006: native current full inventory is independent of the selector; selected execution runs whole exact files with native ESM semantics, scope, worker setting and outcome fidelity                              |
| REQ-007: conservative failure/fallback                  | AC-007: no baseline, incompatible controls, unresolved/unknown analysis, removed tests, no changes or zero selection never yields an empty green subset; unsafe full admission and drift fail nonzero              |
| REQ-008: falsifiable shadow safety                      | AC-008: independently discovered full shadow execution detects an intentionally omitted failing test; selected/full failures and skip/outcome disagreements remain nonzero                                         |
| REQ-009: owned bounded process lifecycle                | AC-009: cancellation, deadlines and output excess account for owned Jest/nested descendants with identity safeguards; uncertain cleanup returns bounded incomplete evidence and blocks activation                  |
| REQ-010: attributable evidence and cost                 | AC-010: identities, actual scope, selected paths/reasons, raw outcomes and selection/execution/total timings are retained; no unsupported speedup or authenticated-CI claim                                        |
| REQ-011: independent complete assurance                 | AC-011: ordinary full Jest/CI remains available; corrected HISEW full coverage is approved and demonstrated; browser, Python, documentation and relevant packaging/native obligations remain distinct              |
| REQ-012: preserve work and recover safely               | AC-012: only approved files/settings change; plan-first commit ordering respects later authority; task resources have ownership/retention and recovery returns to full execution without discarding unrelated work |

| Decision | Selected draft and acceptance owner                                                                                                                 |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| DEC-001  | Owner: reuse the existing analyzer/Jest/current LTS selections and public APIs; no runner migration or new dependency presumed                      |
| DEC-002  | Owner/verifier: retain all specialized architecture assertions; graph-policy exceptions are narrow, explicit and tested                             |
| DEC-003  | Owner/verifier: explicit immutable comparison, authoritative change envelope, source-only baseline and old/current native reachability union        |
| DEC-004  | Owner/verifier: first-party workspace resolution uses each snapshot's package sources; unproved resolver/export-condition fidelity forces full      |
| DEC-005  | Owner/verifier: Node/import graph context with declared browser/resource boundaries; no claim to reproduce Vite's bundle graph                      |
| DEC-006  | Owner: graph/list first, then opt-in execution only after shadow/adversarial proof; no default full-test or CI narrowing                            |
| DEC-007  | Owner: native Jest discovery/results and exact-file execution; keep maxWorkers 2, ESM flags and existing serial commands                            |
| DEC-008  | Owner/lifecycle owner: apply section 8's native full-profile correction after approval; affected remains the existing no-argument full Jest command |
| DEC-009  | Owner/lifecycle owner: bounded external product bundles, native operator-evidence storage, no new persistent graph cache or automatic publication   |
| DEC-010  | Owner: accept this combined R2 revision and conditional activation basis; no compatibility shim, broad refactor or delivery authority implied       |

## 6. Design and architectural seams

### 6.1 Authored inventory and graph context

Use an authoritative repository inventory plus current admitted regular files, not a traversal started only at `src/main.js`.
The observed tracked JS/MJS/CJS inventory is 284 under `src`, 190 under `packages/vowl`, 29 under `util`, four under `tests`, four under `docs`, and root `eslint.config.js` and `vite.config.mjs`.
The package's 190 files include 37 source, 40 test, five script and 108 conformance modules.
These are source counts, **not Jest-discovered test counts or execution proof**.

Admit `src/`, `util/`, `tests/`, all authored JS/MJS/CJS in `packages/vowl/`, and any first-party authored JavaScript introduced under `tooling/`.
Parse root executable configuration files only as source/control inputs; never load them as configuration during graph extraction.
The four observed docs JavaScript files are retained upstream VOWL/D3 assets under `docs/owlapi-js/conformance/upstream/vowl-2/data/`, not first-party application code; classify them explicitly as vendored/resource inputs and force full on changes.
Do not silently discard an unfamiliar authored root: admit it with a reviewed role or return an incomplete-graph/full reason.

Exclude installed dependencies, generated `deploy/` output, caches, environments, historical workflow storage and vendored material from authored traversal by explicit classification.
Retain third-party dependency edges as native external leaves without following vendor internals.
Apply overview/runtime/tests display filters only after complete extraction; view filtering never defines the impact graph or test inventory.
Keep standalone worker, CLI, conformance and disconnected test roots even when no importer exists.

The selected graph context is native Node/import resolution for static Jest impact.
Label it in JSON provenance and human views.
For current first-party browser use, prove that `vowl`'s unconditional exports select the same source under the applicable Node and Vite conditions.
Do not claim that this graph models Vite transformations, emitted chunks, arbitrary browser loads or coverage.
Vite-specific URL/query/glob behavior and future condition-dependent first-party exports require independently proved supplemental coverage or full fallback.
A future multi-context graph is a replan option if that conservative boundary prevents useful selection; it is not part of this implementation.

### 6.2 Workspace-safe native resolution

[The workspace manifest](../../packages/vowl/package.json) names package `vowl` and exports `.`, `./owl` and `./migrate` to source files.
Production modules and tests use bare `vowl` imports.
The installed `node_modules/vowl` link points into the current checkout; following it while constructing a historical graph would contaminate the baseline with current source.
Nor may an npm-type do-not-follow filter turn this first-party workspace into an opaque vendor leaf.

Use the public third `cruise()` argument and supported native resolver `modules` search locations, with the selected snapshot's `packages` directory before the admitted installed vendor directory.
Resolve `vowl` through that snapshot's own package metadata and exports using the upstream resolver.
Keep workspace paths classified as first-party and traversable, regardless of a bare import's package-like spelling.
The current package name and directory align; a new workspace layout, scoped name or conditional export is a compatibility change requiring revalidation rather than a hand-written alias fallback.
See [native resolver search paths](https://webpack.js.org/configuration/resolve/#resolvemodules).

Reject a first-party record resolved into current source during baseline analysis, outside the selected source root, through an unapproved redirect, or into an unproved package condition.
Express source/vendor containment as an upstream-supported union restriction, not intersecting independent restrictions that accidentally make every resolution fail.
No source links, package installation, baseline scripts or current-workspace alias shim are needed for the selected approach.
Use identical admitted installed vendor bytes only when all relevant package metadata and lock identities match between snapshots.

Before omission is enabled, fixtures must change a leaf behind a `vowl` barrel, remove an old import, exercise all three exported entry points, and make the current installed workspace link point at a sentinel with different topology.
Expected old/current consumers are independently specified.
Changed package exports/manifests force full even if the resolver can parse both versions.
Source inspection suggests the native option fits; no successful resolver experiment is claimed here.

### 6.3 Extraction, views and existing architecture policy

Run analyzer extraction in a separate bounded Node process with explicit data-only rules, resolver settings, parser admission and built-in reporter choices.
Supply no Babel/Webpack/TypeScript config discovery, executable dependency-cruiser config, plugins, custom resolver code or arbitrary reporter paths.
Historical text may be parsed, never evaluated.
Use upstream configuration/graph validation and preserve its diagnostics.
Where a CLI is necessary, resolve its executable from the package's public bin mapping rather than a guessed private path.

Publish a newly created external bundle atomically after its snapshot and native outputs are consistent.
It contains native graph JSON, native overview/runtime/tests Mermaid views, a separately labelled declared-relation report, policy findings and a versioned provenance manifest.
All views cite the same graph digest; incomplete capture cannot be presented as a complete bundle.
A valid completed diagnostic graph with policy errors may be retained, but the command returns nonzero.
Reject existing output paths, paths inside or linked back into the checkout, unsafe parents and overwrite races.
No Graphviz install, web upload, Git-tracked generated graph or persistent graph cache is proposed.

Proposed native rule severities are unresolved dependencies = error, production-to-test/tooling = error, inappropriate production-to-dev-package = error, and cycles = warning.
Classify colocated Jest files and support modules before applying production rules; `src/` alone is not a production-only prefix.
The existing imports of `@oddbird/popover-polyfill` in `src/main.js` and `src/canonical-main.js` are a narrow, evidence-backed browser-build exception to a blanket devDependency rule.
Allow only those observed importer/package pairs, preserve their behavior and prove that another production importer or different development package is rejected.
Do not move dependency categories or grant a repository-wide dev-package exemption as an incidental fix.

Keep the current ESM architecture graph invocation and semantic diagnostics independent in the initial integration.
The new adapter does not become their assertion oracle.
Do not refactor the large analyzer or other architecture traversals merely to share a few lines of launching code.
A later extraction/unification requires a separate demonstrated contract need and equivalence proof.

### 6.4 Baseline, change envelope and selection

Require a full immutable Git commit object ID for selective comparison.
Validate object type, repository/object format and availability; do not guess main, the previous commit, a merge base or a HISEW start head.
Intermediate commits must not shrink the accepted comparison scope.
Record the chosen baseline and why it represents the intended change.

Build the seed set from the union of committed baseline-to-HEAD changes, index/staged changes, unstaged changes and untracked paths.
Retain additions, deletions, renames and both rename endpoints, including a staged change later reverted in the working file; a net content diff alone is insufficient.
Repeated `--path` values are additional literal seeds and can only widen the authoritative set.
Treat spaces, Unicode and regular-expression punctuation as data; validate before constructing anchored escaped native reachability filters.
Reject option-like, escaping, linked, ambiguous-case and invalidly encoded paths rather than normalizing them into different files.

Materialize only admitted regular baseline source blobs and the manifest/control/resource bytes actually required for analysis into an owned disposable snapshot.
Use Git object reads; do not check out a historical worktree, install historical dependencies, run hooks, import old code or load old executable config.
Preserve the independent full change envelope even though materialization is source-bounded.
Missing historical objects, incompatible root/workspace manifests, lockfiles, graph settings, impact policy, relevant runtime/configuration controls or unsupported layouts force full current testing.
A baseline predating this new policy normally cannot select; that honest initial full fallback is expected.

Use public `format(..., { reaches })` on both baseline and current graphs.
Union reachable paths with changed current tests and activated declared relations, then intersect with the independently discovered **current** Jest whole-file inventory.
The baseline graph retains consumers of removed imports and deleted source; removed test files are tombstones requiring full discovery and coverage review, not runnable paths.
Supplemental relation activation may repeat over the finite rule inventory, but every import traversal remains upstream-owned and each relation activates at most once.
Cycle handling must terminate without dropping consumers or imposing an arbitrary traversal depth.

### 6.5 WebVOWL's non-import dependency registry

Each relation records a stable ID, dependency path or explicitly bounded group, consumer, semantic kind, source evidence and independent regression fixture.
The table below is the required starting inventory, not a claim that an exhaustive registry has already been proved.
Complete it in SLICE-002 before omission is available.

| Boundary and source evidence                                                                                                 | Required disposition and representative proof                                                                                                                                |
| ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `canonicalVowlWorkerClient.js` constructs `new Worker(new URL('./canonicalVowlWorker.js', import.meta.url))`                 | Declare worker-entry-to-client relation; a changed imported worker leaf reaches client consumers and catches a seeded worker failure                                         |
| Worker tests read `packages/vowl/conformance/vectors/named-class-artifact/source.json`                                       | Resource changes force full initially; prove the expected worker suite participates, without claiming an import edge                                                         |
| Architecture tests read/traverse authored source                                                                             | Explicit source-group-to-architecture-test relations, including the five named architecture suites; a prohibited change with no test import still selects its enforcing test |
| `productionBundle.integration.test.js` generates a Node/Vite verification program; D3 build/dev-server tests spawn Vite work | Declare source/control consumers and retain Vite configuration as a full trigger; embedded programs are not parser-discovered imports                                        |
| `vite.config.mjs` copies data/fonts/favicon/licence and transforms entry HTML                                                | Source/asset-copy/build relationships remain declared; asset/HTML/CSS/configuration changes select full and preserve build obligations                                       |
| Package conformance storage/catalog/producer modules and JSON/schema/fixture bytes                                           | Include authored modules in the graph, retain corpus/source identities and force full on conformance/resource changes until narrower coverage is independently established   |
| `util/runRepositoryPython.mjs`, setup/install helpers and their Jest tests                                                   | Spawned Python/CLI boundaries select full; Python setup/lint/unit evidence remains separate from Jest                                                                        |
| Markdown integration probes under `util/` use Node's test runner                                                             | Keep `test:markdown` independently required; do not relabel these probes as Jest tests or omit them because the graph selects no Jest consumer                               |
| OwlAPI/UO reference data and installed consumer contracts                                                                    | Bind actual input source/lock/content identities; missing or changing external inputs prevent relevant qualification, rather than becoming graph passes                      |
| Computed imports, dynamic resource paths, filesystem/process/worker APIs, future Vite glob/query loads                       | Reviewed boundary rule or full fallback; absence of a parser edge is never a completeness claim                                                                              |

Use an already approved parser, preferably the existing ESLint syntax/scope facilities where sufficient, to recognize unmodelled loading/resource boundaries; do not build an import regex resolver.
If a direct new parser dependency is actually needed, research it and propose the exact manifest/lock change before incorporation.
No implicit reliance on an unrelated hoisted transitive parser is part of the current proposal.
Unknown sources/resources, stale or missing endpoints, duplicate/conflicting rule IDs and changed boundary modules conservatively widen selection.
Native graph edges and declared relationships remain visibly distinct in reports and cycle findings.

### 6.6 Native Jest admission, outcomes and process ownership

Obtain the full current inventory with Jest's supported `--listTests --json` and the admitted current package configuration, independent of dependency-cruiser output and without change/path filters.
Use native validation and prove equivalence with ordinary discovery; do not recreate Jest's `testMatch`, ignore, workspace or ESM rules with a filename glob.
Reject escaping, duplicate, unsafe or unsupported discovered files and a corrupt/empty inventory instead of reporting a successful fallback.
Keep `src/testRunnerScope.architecture.test.js` effective and explicitly cover top-level `tests/*.test.mjs` and package tests.

Current Jest settings are data in `package.json`: `maxWorkers: 2`, `testEnvironment: node`, `transform: {}`, and the existing node_modules/historical-runtime ignore rules.
Prefer explicit admission of that data through Jest's supported JSON configuration input with a bound root, preserving native defaults and CLI precedence; demonstrate equivalent effective configuration/discovery before use.
Do not load historical Jest config.
A new current executable config, resolver, transformer, environment, setup hook or reporter requires a trusted-current-runner disposition; graph extraction never gains permission to evaluate it.
`executed: false` means no tests ran, not that Jest's trusted runner or configuration machinery executed no code.
Do not use `--collectTests` as a code-free discovery substitute, because it loads test modules.

Invoke the admitted Jest public CLI through Node and direct argv with `--runTestsByPath` for selected complete files.
Retain the existing experimental VM-module and warning flags and the two-worker default; use explicit serial mode only where the existing command/approved experiment requires it.
Any child-local environment adjustment must reproduce the admitted launch contract and be recorded; do not mutate global/user environment or silently tune concurrency.
Do not accept arbitrary forwarded Jest flags that can narrow names/files, update snapshots, force successful empty runs, watch indefinitely or execute new hooks.
No `testNamePattern`, custom test scheduler or runner migration is needed.

Consume Jest's built-in JSON results with bounded stdout/stderr and a native output file when necessary.
Retain suite outcomes, assertion identity, statuses, skip/todo state, failure messages, load/hook errors, signals, native exit status and reported counts.
Preserve multiplicity of repeated/parameterized test names using available file/title/location information; ambiguous identity or missing suite results cannot silently collapse into agreement.
Keep durations as observations, not equality assertions.
The reference Node event reporter is not copied; a custom Jest reporter is deferred unless a demonstrated gap in the supported JSON contract requires one.
Truncated, absent or malformed results after a crash/cancellation are incomplete failure evidence, never reconstructed success.

Shadow mode independently discovers and runs the full current inventory, then compares selected-file outcomes and the full result.
The full runner must not accept the selector's list as its definition of all tests.
A selected failure remains failure even if the full run passes; any full failure or unexplained disagreement is nonzero.
An intentionally defective selector omitting a failing file must be detected.
When selection has already widened to the entire independently validated inventory, one full execution may be reported as full fallback; do not fabricate a two-run shadow agreement or launch an identical run solely because two labels exist.

Use bounded cancellation/timeout/output handling for the complete owned Jest process family, including nested Vite/native processes and detached fixtures.
Capture native identity/parentage at ownership time and recheck it before targeted termination; never kill by image name, broad PID ranges or an assumed reused PID.
Node abort signals and a child `close` event alone do not prove descendant completion.
Microsoft's [`taskkill /T`](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/taskkill) is an available targeted termination primitive, not birth-identity or quiescence evidence by itself.

The reference POSIX helper captures birth identities; the inspected Windows reference calls `taskkill /PID /T /F` without populating that birth field.
Do not claim that copying it proves WebVOWL's Windows ownership contract.
Qualify supported native facilities and bounded ownership observation against Jest/Vite's actual children.
If ownership or quiescence cannot be established, return a bounded nonzero incomplete result, retain diagnostics/workspace and block subset activation on that platform.
Do not copy HISEW internals or invent a general process supervisor to conceal the gap.
Keep cancellation fixture programs static and pass runtime marker paths through JSON/argv, including quote/Unicode/punctuation cases from the final reference correction.

## 7. Fallback, evidence and resource bounds

| Condition                                                                                                                    | Required behavior                                                                                      |
| ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Missing/invalid/unavailable baseline; shallow or missing objects; incompatible package/lock/config/policy/runtime identity   | Explain and use independently discovered full current Jest, if current execution admission is safe     |
| Unresolved/unsupported graph, unknown resource or boundary, unsupported authored root, unproved workspace/browser resolution | Explain full fallback; keep separate domain obligations visible                                        |
| Added current test                                                                                                           | Select itself as a whole file, plus its proved consumers                                               |
| Deleted/renamed test or removed test-discovery scope                                                                         | Full discovery and explicit tombstone/coverage-review reason; never invoke a deleted file              |
| No changes or empty reachable test intersection                                                                              | Full discovery, never successful no-op selection                                                       |
| Unsafe full inventory, path/encoding/link ambiguity, wrong root, tampered result or drift                                    | Fail nonzero; do not relabel unsafe execution as successful fallback                                   |
| Selected/full test failure, shadow disagreement, deadline, cancellation, output excess or incomplete cleanup                 | Preserve failure/incomplete status and raw evidence; do not retry into a green summary                 |
| Browser/build/Python/docs/native/packaging input changed                                                                     | Full Jest where safe plus the independently applicable checks; full Jest is not full product assurance |

Bind report schema/version and requested/actual mode, `executed`, fallback reasons, authoritative change records, additional seeds, selection/rule IDs and filtered native reachability evidence.
Bind repository/worktree, baseline commit/tree, candidate HEAD/tree, index, tracked/staged/unstaged/untracked contents, authored inventory, full Jest inventory, package/workspace manifests, lock, graph/policy, actual runner configuration, analyzer/runner versions and relevant tool/runtime/platform identities.
Record relevant corpus/resource/external-input identities and limitations rather than pretending a local Git hash covers sibling data or installed native binaries.
Hash stable contents, not timestamps alone, and retain the referenced bytes where evidence requires them.

Revalidate before and after capture, selection, discovery, execution and shadow comparison.
Any input drift invalidates the affected result; a later run is fresh work on a new candidate.
Separate source inputs from declared test/build outputs so normal owned output does not become an ignored unexplained mutation.
Baseline identity, graph identity and raw result identity must agree across the report.
These hashes are operator provenance, not authenticated GitHub proof, HISEW receipts or accepted coverage declarations.

Proposed initial bounds, to validate against measured inventory and negative fixtures in SLICE-001/003:

| Resource                              | Proposed finite bound and meaning                                                                                                                              |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authored analysis entries             | 4,096, above the current roughly 509 first-party source/control candidates; count all admitted roots                                                           |
| Authoritative repository path records | 8,192, above 2,514 currently tracked paths; preserve untracked/deletion accounting and fail when exceeded                                                      |
| Analyzer source inputs                | 8 MiB per source and 64 MiB aggregate materialized source; unrelated corpus archives are not copied into the baseline merely to analyze imports                |
| Graph output                          | 16 MiB per native capture, with no truncation treated as valid JSON                                                                                            |
| Extraction worker                     | 30-second deadline and 256 MiB Node old-space limit; the latter is a V8 heap bound, not a claimed total native RSS limit                                       |
| Jest discovery                        | 120-second ceiling and 16 MiB inventory output; validate actual native discovery cost                                                                          |
| Test execution                        | 600 seconds per selected/full run initially; existing configured outer deadlines still apply                                                                   |
| Test result capture                   | 64 MiB combined raw result/output allowance per run, proposed for the larger WebVOWL corpus; bound and measure actual allocation rather than silently truncate |
| Cleanup                               | Finite five-second attempt budget with explicit incomplete status if identity/termination evidence is insufficient                                             |

These are proposed admission budgets, not measured capacity or authority to increase HISEW's deadline.
Measure snapshot/resource hashing cost as well as analyzer cost.
If a safe complete inventory cannot fit, narrow the admitted capability or obtain a justified budget/configuration change; never drop inputs or disable checks to fit.
Do not introduce a persistent selector cache.
Existing native Jest cache behavior remains under Jest's contract; record warm/cold conditions, avoid clearing shared caches, and do not treat cache entries as retained proof.

## 8. Exact draft configuration proposal

This table is the concrete approval boundary under `AGENTS.md`.
It proposes new opt-in commands and their policy, plus one correction to full assurance.
It does not authorize application now.

| File or native configuration target                                                                                                                    | Exact proposed setting/behavior                                                                                                                                                                                   | Default and pipeline impact                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `package.json` / `scripts.graph:dependencies`                                                                                                          | Add `node util/dependency-graph.mjs`; require `--output` naming a new external bundle directory                                                                                                                   | Opt-in developer output only; ordinary tests/build/CI unchanged                                                                                               |
| `package.json` / `scripts.check:affected`                                                                                                              | Add `node util/affected-tests.mjs`; support `--base <full-commit-id>`, additive repeated `--path`, `--list` and `--shadow`; no arbitrary Jest option forwarding                                                   | Missing base runs full Jest; list runs no tests; omission becomes available only after the activation proof                                                   |
| `.dependency-cruiser.json` (new)                                                                                                                       | Data-only native rules/options; ES6/CJS extraction; real-path containment; third-party do-not-follow with first-party workspace traversal preserved; section 6.3 severities and exact polyfill importer exception | Used only by the new graph/selection adapter; existing specialized architecture invocation remains independent                                                |
| `.test-impact.json` (new)                                                                                                                              | Versioned repository impact policy with `schemaVersion`, `fullDomains`, `fullFiles`, `boundaryFiles` and evidence-backed `relations`; initial domains and rule contracts below                                    | A reviewable completeness boundary; unknown or incompatible policy falls back full; changing it invalidates selective baseline compatibility                  |
| Selected WebVOWL HISEW verification registration under `C:/Users/maksy/.hi/w/c`, current worktree `4200f543-f93d-41d8-902c-971a9ce530f9`               | Through supported native proposal/apply, change the `full` command's invocation to `{ kind: npm-script, script: check, arguments: [] }`; retain `timeoutSeconds: 600` initially                                   | Full admission now includes app/Python/docs checks, setup/Markdown tests, complete serial Jest and bundle; preserve focused=lint and affected=test            |
| Native full-profile deadline                                                                                                                           | No initial increase proposed; measure the complete `check` command and native overhead against 600 seconds                                                                                                        | If insufficient, obtain an exact measured timeout proposal or supported complete segmented obligation design before final assurance; no silent timeout bypass |
| `package.json` runner/runtime/dependencies, `package-lock.json`, `packages/vowl/package.json`, `src/package.json`                                      | No change proposed beyond the two root scripts above; analyzer/Jest already present                                                                                                                               | Preserve ESM, maxWorkers 2, ignore/transform settings, workspace exports, dependency categories and runtime policy                                            |
| `vite.config.mjs`, `eslint.config.js`, `.github/workflows/webvowl-ci.yml`, CI evidence policy, Markdown/Python settings, ignore files and agent policy | No edits proposed                                                                                                                                                                                                 | Keep existing browser transformations, publication/check gates and independent evidence contracts                                                             |

The HISEW target is the exact logical worktree registration/profile, not permission to edit native numbered generations by hand.
Resolve its current native proposal and generation again at implementation; preserve sibling-worktree declarations and shared policy.
The observed `legacy-inherited` state is not authority to mutate every worktree.
Do not invent profile fields for typed baseline/context/report inputs.

Initial impact full domains are `.github/`, `docs/`, `tooling/`, `util/`, `tests/`, `packages/vowl/scripts/`, `packages/vowl/schema/`, `packages/vowl/conformance/`, `packages/vowl/test/browser/`, `src/app/data/`, `src/canonical-examples/` and `test/fixtures/`.
All changed non-JavaScript resources remain full by default even outside these prefixes.
The explicit control-file set includes root/package/workspace manifests and locks, `.dependency-cruiser.json`, `.test-impact.json`, `.node-version`, `.python-version`, `.gitignore`, `.gitattributes`, `vite.config.mjs`, `eslint.config.js`, Markdown execution/policy files and Python requirement/configuration files where present.
Deleting or adding such controls also forces full.

`boundaryFiles` covers the evidenced worker/client, generated-program, filesystem/resource and process-entry modules whose behavior is not fully represented by static imports.
Changing a boundary's implementation requires full until its disposition/fixture is current.
The first registry revision must concretely enumerate those source-inspected paths and relation endpoints; do not accept an unexplained catch-all exception or fabricate a complete inventory from this starting table.
Its reviewer verifies the actual policy diff against sections 6.5 and 10 before omission is admitted.

The existing root `check` script runs lint (including Python and docs), app formatting check, Python formatting check, setup tests, Markdown integration tests, complete serial Jest and `build:bundle`.
It does not install dependencies, deploy, qualify every browser/device, run every package maintenance script or authenticate hosted proof.
Its Python/Markdown/corpus prerequisites must be ready, and its build writes declared generated output.
The selected correction uses supported existing invocation fields; it is not a claim that profile execution has already passed.

If implementation discovers any necessary additional configuration file/setting, different exclusion, larger limit or dependency change, present its exact behavior and impact before applying it.
Approval of the finite proposal does not cover unrelated cleanup or runner/CI redesign.

## 9. Predicted files and vertical slices

Predicted maintained files are `util/dependency-graph.mjs`, `util/affected-tests.mjs`, focused Jest tests under `util/`, a small static fixture/support module if needed, `.dependency-cruiser.json`, `.test-impact.json`, root `package.json` scripts, and `docs/dependency-graph-and-tests.md` with an appropriate existing contributor-doc link.
Keep test implementation support from being mistaken for a discovered Jest suite.
Reuse current naming conventions where appropriate; names must distinguish a graph view, a selection plan, actual execution and full product assurance.
Avoid misleading commands or statuses such as an affected report labelled full verification.
Exact file decomposition is a prediction, not permission to create an abstraction for every table row.

One integration owner owns baseline identity, policy meaning, runner admission and the final acceptance record.
Slices are ordered because their proof depends on earlier contracts.
Independent source research or fixture review may be parallelized only with later explicit delegation authority and no conflicting writes; this planning task delegates no further work.

### SLICE-001: Produce an honest dependency bundle

Deliver one end-to-end command from admitted authored inventory through supported extraction/validation to a new external JSON/Mermaid/provenance bundle.
Include disconnected roots, current `vowl` exports, package conformance source, vendor leaves, colocated tests and exact graph-policy exceptions.
Resolve the snapshot-owned workspace experiment and configuration-execution sentinels before presenting a graph as complete.

Proof: independent expected edges/roots, native invalid-config/graph behavior, workspace/current-link sentinel, all required views sharing one digest, error findings remaining nonzero, and output overwrite/containment/drift failures.
Run existing architecture regressions as consumer checks without changing their assertions.
This slice is useful on its own and can be withdrawn by removing its opt-in invocation; it authorizes no test omission.

### SLICE-002: Explain a conservative list without running tests

Deliver explicit-baseline selection from the authoritative change union, two native graphs, declared relations and independently discovered current Jest inventory.
Complete the first WebVOWL relation and full-domain policy with source evidence and independently expected cases.
Emit selected/full/blocked mode, reasons and `executed: false`.
The user can inspect a selection before any optional omitted execution is available.

Proof: baseline/current topology, workspace fidelity, all change states, removed tests, native discovery equivalence, scope sentinels, full/blocked matrix and no test-execution markers in list mode.
Use source-only fixture histories; do not execute historical configuration.
Reversibility is to use ordinary full Jest; retain failed selection explanations as evidence.

### SLICE-003: Prove native execution, shadow comparison and cleanup

Deliver the bounded native Jest adapter and full shadow path behind activation admission.
Exercise it in owned fixtures and a settled representative candidate with the current ESM/worker contract, native JSON outcomes and finite resource bounds.
Verify static child fixtures, nested workers, Vite/native descendants, platform ownership, timeout/output limits and incomplete-result handling.

Proof: actual exact-file launch markers; full inventory independent of selection; skip/todo/parameterized/duplicate names; suite-load and hook failures; a selected failure followed by passing full still failing overall; intentionally missing failing test detected by shadow; drift and cleanup negative cases.
Qualify Windows and Linux separately.
Unsupported cleanup blocks activation for that platform and retains diagnostics; it does not justify a green reduced capability claim.

### SLICE-004: Enable opt-in use and demonstrate complete assurance

After the accepted conditional gates pass, expose affected execution for an explicitly supplied compatible baseline and document no-base/full fallback behavior.
Apply only the approved native full-profile correction, re-read its exact declarations and resolve any measured deadline/prerequisite gap before final verification.
Measure total cost for representative isolated, shared and forced-full changes; retain both beneficial and non-beneficial cases.

Consolidate source/tests/docs/policy and all intended formatting, staging and authorized commits into the final candidate.
Run missing/stale route-selected full and independent obligations through the correct capture route, then final ordinary review, independent verification and triggered security assessment on the frozen target.
Deliver supported-scope guidance, evidence limitations, retention and recovery instructions.
Ordinary full CI and deployment behavior stay independent.

### Slice traceability

| Slice     | Requirements / acceptance      | Quality scenarios / decisions                           | Falsifiable proof                                                                                | Release and cleanup implication                                            |
| --------- | ------------------------------ | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| SLICE-001 | REQ/AC-001, 002, 003, 010, 012 | QA-001, 002, 007, 008, 012; DEC-001, 002, 004, 005, 009 | Native graph/roots/workspace/config/atomic-bundle fixtures and preserved architecture tests      | Graph/list tooling only; keep accepted bundle, dispose of released scratch |
| SLICE-002 | REQ/AC-004, 005, 006, 007, 010 | QA-002 through 008, 012; DEC-003 through 007            | Independently expected changed-path/old-new selection, native Jest inventory and fallback matrix | No omitted execution; failed reasoning retained                            |
| SLICE-003 | REQ/AC-006 through 010, 012    | QA-006 through 012, 014; DEC-006, 007, 009              | Native outcome/launch/negative-shadow and real platform cancellation evidence                    | Subset remains gated until proved; retain unresolved producers/resources   |
| SLICE-004 | REQ/AC-001, 008, 010, 011, 012 | QA-009, 010, 012, 013, 014; DEC-006, 008, 009, 010      | Measured end-to-end comparisons, complete native obligations and final independent dispositions  | Local opt-in activation only; handoff and scoped resource disposition      |

## 10. Quality scenarios and oracle ownership

| Scenario | Stimulus                                                                                                                              | Required observable result and oracle                                                                                                         |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| QA-001   | Disconnected CLI/worker/test root, barrel, diamond or cycle                                                                           | Native graph includes all admitted source roots; independently named reachable consumers; finite selection with no display-driven omission    |
| QA-002   | Old import removed or source renamed/deleted behind `vowl`; current workspace link points elsewhere                                   | Baseline-owned old consumers plus current consumers are selected, or explicit full; sentinel topology cannot contaminate the baseline         |
| QA-003   | Simultaneous committed, staged, unstaged and untracked edits; added literal path                                                      | Selection contains their union, including both rename sides; additive paths never remove real changes                                         |
| QA-004   | Worker leaf, spawned CLI, generated verification program or copied source changes                                                     | Independently expected consumer executes and catches an intentional regression, or documented full fallback                                   |
| QA-005   | Fixture/schema/CSS/HTML/asset/corpus/Python/docs/control change                                                                       | Full Jest and separately named applicable obligations; zero reachable imports cannot become a pass                                            |
| QA-006   | Colocated JS tests, top-level MJS tests, package tests, support modules and ignored dependency suites                                 | Actual native Jest discovery agrees with ordinary full scope; support files are not invented tests and real tests are not dropped             |
| QA-007   | Missing baseline, lock/config difference, unknown load, invalid graph/policy, no changes or empty selection                           | Deterministic explained full fallback where safe; unsafe full inventory fails nonzero                                                         |
| QA-008   | Windows/Linux spaces, Unicode, regex punctuation, quotes, option prefixes, case collision, invalid encoding, links and escape imports | Literal supported paths work; unsafe ambiguity is rejected before use; config/path markers remain unexecuted                                  |
| QA-009   | Input changes during capture, selection, discovery or execution                                                                       | No mixed-snapshot success; retain the changed identity and incomplete/failed attempt                                                          |
| QA-010   | Selector deliberately omits a failing file; selected failure but full passes; skips/load errors differ                                | Independent full negative control or outcome comparison returns nonzero and retains both results                                              |
| QA-011   | Hanging test, output flood, detached descendant, PID reuse/identity loss or cleanup failure                                           | Bounded nonzero result; only owned identities targeted; quiescence claimed only with evidence; unresolved resources retained                  |
| QA-012   | Existing bundle path, redirect into checkout, malformed result, missing/duplicate suite or mismatched digest                          | Refuse overwrite/untrusted success; complete graph/report identities remain attributable                                                      |
| QA-013   | Isolated leaf/test edit versus shared barrel/controller edit versus forced-full control edit                                          | Measure selection/discovery/execution/total cost and outcomes against independent full; do not infer benefit from test count                  |
| QA-014   | Full-profile call, local Windows execution and existing hosted Ubuntu application checks                                              | Report each actual obligation/platform/snapshot separately; build-only or Windows Python evidence cannot stand in for full Jest/product proof |

The implementing tests do not compute expected selected paths by invoking the selector under test or use the same graph walk as both result and oracle.
Small fixture repositories specify their files, intended edges, change histories and expected tests independently.
Fixture child processes write externally owned execution markers, with fixed program source and runtime paths as data.
Use real installed dependency-cruiser and Jest at the integration boundary; isolate genuine external filesystem/process/network failures with documented test seams.
Do not mock the analyzer/runner into the behavior being claimed.

Source-reading architecture fixtures must demonstrate an actual missing-edge risk: a source violation causes the enforcing architecture suite to fail even though that test does not import the changed module.
Worker/resource/generated-program fixtures must likewise seed a real consumer failure, not merely assert that a policy ID appeared.
At least one whole-file omission in a safe unrelated fixture is necessary to demonstrate that selection is real; at least one intentionally unsafe omission must be caught by the full negative control.
Keep browser/device and external-corpus limitations explicit.

## 11. Verification and review cadence

No implementation or broad suite is run for this plan.
During authorized implementation, use focused native Jest contract files first, then affected consumer regressions at integration points.
Keep the existing ESM/native policy self-tests, five architecture suites, worker/client tests, Vite build/dev-server tests and native scope tests relevant to this change.
Do not create tests for the document's formatting or assertions that merely repeat configuration text without checking behavior.

Settle the real environment first: selected Node/npm, locked root/workspace dependencies, Python 3.15 environment and requirements, isolated Markdown tool, required corpus bytes and native bindings.
`npm run check` is the proposed full source obligation, not an environment installer.
Unavailable inputs are gaps requiring their owning setup authority; do not run an older interpreter or reduce coverage and call it equivalent.
Current full checks do not automatically run every conformance generator, browser probe, performance study or packaging script; retain the accepted change-specific obligations and avoid regenerating independent oracles.

When future commit authority is granted, commit the accepted plan at the first commit point using the required signed-commit procedure, with exact path staging.
Resolve staging/commit order before expensive final checks because both affect candidate identity.
Do not manufacture a plan-only commit now, amend unrelated history or blanket-stage the checkout.

Before final assurance, consolidate the candidate, finish authorized formatting/lint corrections, inspect the diff and freeze source/test/config/policy/untracked input identities.
Run the required commands through HISEW when native receipts are needed, instead of running an equivalent manual full suite immediately beforehand solely to repeat it for a receipt.
The native full-profile correction requires fresh admission/readback; prior build receipts cannot be relabelled as `check` evidence.
Reuse existing evidence only for its exact admissible input scope, candidate and obligation; report FRESH or REUSED explicitly when applicable.

Perform broad ordinary review only on the consolidated candidate.
Use narrow follow-ups for accepted repairs and preserve unchanged coverage with its actual identity.
Reserve external independent verification and the triggered native security workflow for the final frozen candidate under the accepted R2 route.
Review naming, exception precision, workspace contamination, injection/config execution, unsafe fallback, outcome integrity and descendant ownership.
No scan, reviewer fan-out or provider installation is authorized by this plan-writing task.
Unavailable required assurance needs an accountable alternative or remains a gap.

For the proposed supported Windows/Linux capability, retain a separately captured actual Windows Jest/process run and Linux evidence on an authorized supported environment.
Existing hosted Ubuntu application checks can supply their real scope when naturally triggered by later authorized delivery; they are not evidence until observed at the actual candidate.
No new Windows hosted application lane or manual remote workflow dispatch is proposed.
If hosted Windows proof becomes an acceptance requirement, return with a precise workflow/policy proposal rather than inferring it from the Python matrix.

## 12. Observability and cost assessment

Answer four questions from each run: what exact candidate and comparison were used; why each file or full mode was selected; what actually executed and failed/skipped; and what the complete operation cost.
Record inventory sizes, native graph digest/findings, activated relation IDs, selected/full file counts, failure/fallback category, environment/platform, discovery/capture/selection/execution/cleanup/total elapsed time, and output/limit observations.
Avoid secrets and whole environment dumps; local absolute paths and source identities require inspection before sharing.

Measure at least a bounded isolated source/test change, a shared `vowl` or controller/barrel change, and an intentionally full-domain/resource change.
Use a settled admitted candidate with a compatible explicit baseline, equivalent installed dependencies and known warm/cold cache conditions.
Record launch counts and whole-file outcomes, plus an independent full result; preserve failed or slower cases.
The initial feature baseline may lack the new policy, so performance qualification uses controlled compatible fixture histories or an explicitly accepted later baseline rather than bypassing admission.

Markdown Quality's recorded Windows example selected 1/41 files in 13.0 seconds total, including 9.9 seconds of selection, versus 90.6 seconds for full JavaScript; another shared-module inspection selected 25/41.
These are historical reference observations, not WebVOWL timings, current benchmark reproduction, a target or general speedup evidence.
WebVOWL has source-reading architecture checks and a larger corpus, so graph/snapshot/discovery overhead may dominate some edits.
If there is no useful end-to-end benefit for representative safe cases, retain the graph/list capability and reassess activation/complexity with the owner.
Do not weaken completeness or split product architecture merely to produce better selection statistics.

## 13. Storage, interruption and recovery

This plan, maintained documentation, policy, production tooling and regression fixtures are durable assets.
Runtime graph bundles are consumer-owned product output at a requested new external location.
Accepted proof, failed attempts, required reproductions and review/security results are retained evidence, with native records written only by their owning engine.
Historical allocations from Markdown Quality or other WebVOWL work are read-only context, not reusable scratch ownership.

Before creating supplemental workflow artifacts during implementation, repeat native `inspect-environment`.
Allocate the needed operator-evidence group with the appropriate supported purpose, finite byte budget, typed obligation and actual decision reference; use an identified tool-managed disposable workspace for working material.
No repository-local `.sdlc` fallback, hand-written receipt, unregistered scratch group or invented shared temporary root is permitted.
Keep raw capture/reproduction inputs and the interpretation of them distinct.
Do not copy an entire installed dependency environment into evidence when exact identities and the required raw records suffice.

For each surviving group, record owner, origin/execution, candidate identity, consumers, evidence destination/readback, byte budget, next actor and a concrete removal/reassessment trigger.
Preserve failures, security counterevidence and unresolved producers until their consumers release them.
Cleanup must inspect exact contained paths and use the owning tool's supported disposal; do not recursively delete a shared root, follow redirects or infer disposability from ignore rules.
Removing detached scratch need not repeat unaffected tests, but any change to verified inputs requires the appropriate fresh proof.

An interruption invalidates any unfinished claim of graph/report completion.
On resumption, inspect execution ownership/generation, live processes, candidate drift, incomplete bundle publication and current resource reservations before continuing.
Restart analysis on changed inputs; do not splice an old graph into a new test result.
An existing bundle is immutable for this command; a retry gets a new destination after inspecting and retaining useful partial diagnostics.
Baseline snapshots can be released after all analysis consumers and processes finish and required evidence is preserved.

Abort activation on a missed failure, unresolved shadow disagreement, unsafe inventory, workspace contamination, unproved containment, material budget failure or unaccepted configuration change.
Operational recovery is ordinary full Jest plus the applicable full-product obligations.
Preserve the failed selection/capture, fix the cause, add an independent regression and repeat the invalidated proof before re-enabling the affected scope.
Source rollback or forward-fix touches only this change under normal authority and retains the native configuration/evidence history.
The corrected full assurance profile should not be silently reverted to build-only merely because optional selection is disabled.
No data migration, production deployment, public package release or backfill is proposed.

## 14. Remaining experiments and replan triggers

| Unknown                                                              | Cheapest discriminating proof after implementation authority                                                                                           | Failure disposition / owner                                                                      |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| Native workspace resolution and Node/browser first-party equivalence | Small source-only baseline/current fixture with all `vowl` exports and hostile current-link sentinel; inspect native resolved paths and source digests | Full fallback; integration owner revises native configuration with owner approval if needed      |
| Actual Jest scope under admitted JSON configuration                  | Native effective-config/list comparison with ordinary discovery, including MJS/package/support/ignored fixtures                                        | Block subset; preserve default runner and resolve the actual native contract                     |
| Completeness of source-reading/generated/resource consumers          | Focused source inventory plus independently seeded architecture, worker, Vite and corpus failures                                                      | Keep unproved domain full; verifier rejects unsupported completeness claims                      |
| Windows and Linux descendant ownership                               | Real bounded hanging/flooding/detached/nested child fixtures, identity-loss/PID-reuse negative cases and independent liveness readback                 | Nonzero incomplete; affected platform activation blocked pending supported proof                 |
| Graph/snapshot/result budgets and full-profile deadline              | Measure complete representative captures/runs and limit failures in the authorized environment                                                         | Exact budget/deadline proposal or smaller admitted scope; no silent truncation or weakened check |
| External corpus/native inputs and generated-output drift             | Bind actual read inputs and declared outputs for representative full/browser/source-reader tests                                                       | Missing identities remain assurance gaps; domain owner supplies qualification inputs             |
| Net benefit                                                          | Equivalent isolated/shared/full-domain comparisons including every setup/analysis cost                                                                 | Retain graph/list and re-evaluate selective execution value with owner                           |

Rebaseline if concurrent work changes the settled target; runtime/tool versions or native contracts change materially; a new workspace/conditional export appears; the policy cannot explain a resource/load boundary; graph cost erases the intended benefit; cancellation cannot be safely bounded; a public/runtime change emerges; or CI narrowing/hosted artifact publication becomes necessary.
Replan if the residual adapter becomes a replacement resolver, runner, bundler or process-safety engine.
Do not silently expand this task to rewrite existing architecture analyzers, repair unrelated CI/profile policy, adopt HISEW issue 150 or redesign browser loading.

HISEW issue 150 was observed open during planning.
Its typed comparison/context inputs, validated affected-result scope and native evidence consumption are future capabilities, not fields available for this plan to use.
Keep local opt-in selection separate from route-selected final assurance until that external capability is actually delivered and independently adopted through its own exact configuration decision.

## 15. Acceptance and planning handoff

Before implementation, the owner can accept this revision with the following explicit scope:

- The R2 draft dossier, selected design, finite configuration proposal and preserved full verification boundaries are accepted.
- Implementation may add the described developer commands/policy/tests/docs and apply the exact selected-worktree full-profile correction through HISEW.
- Local omitted execution is conditionally authorized only after the native discovery, workspace/resource, shadow, security and process gates pass for the supported platform.
- The implementation baseline and disposition of concurrent work are explicit; another task's checkout, commits, execution or artifacts are not adopted implicitly.
- Commit, push, merge and deployment decisions are separately stated if desired; silence grants none of them.

Completion evidence must show AC-001 through AC-012, the independently expected QA corpus and negative shadow control, preserved ESM/Jest behavior, bounded platform cleanup, exact configuration readback, complete route-selected assurance and measured cost/limitations.
Report source inspection, actual local execution, native receipts, independent review, hosted evidence and any delivery boundary separately.

Planning performed read-only repository/remote/registry/method inspection and authored only this document.
The plan path was checked absent before creation.
Document formatting/link/consistency verification is a planning check; no product tests, native verification profiles, scans, dependency installations or implementation lifecycle operations were run.
The handoff must report the actual document-check result and final working-tree preservation readback without presenting either as implementation proof.

Method basis: HISEW `hadden-industries-plan-software-change` and routing guidance, with `engine-invocation.md`, `engineering-principles.md`, `risk-routes.md`, `workflow-progression.md`, `verification-procedures.md`, `software-selection.md` and `resource-retention.md` from installed `0.1.0-dev.18`.
The applicable principles include semantic naming, source-backed native reuse, actual consumer validation, precise rights/version status, no unapproved shim, outcome reassessment, final scoped security assessment and accountable resource retention.
