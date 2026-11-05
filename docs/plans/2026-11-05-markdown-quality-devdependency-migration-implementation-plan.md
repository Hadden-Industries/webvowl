# Markdown Quality root development dependency migration

Date: 2026-11-05.
Status: implementation proposal; no migration has been executed.
Repository baseline: feat/ontology-loading-progress at 734a43f5357773d2d28805bb8d9585d1b0d0f76e.
The inspected baseline was clean; preserve this product feature branch and its work.

## Intended result and planning limits

Use one normal root npm graph with exactly `"@hadden-industries/markdown-quality": ">=3.0.0"` in `devDependencies`.
The root lock freezes installation; npm selects the matching optional Windows/Linux native packages.
Assume the registry core/native 3.0 packages are available.
There is no release, publication-approval, availability or adoption gate.
Do not use ^3.0.0, a 2.x bridge, Git dependency, persisted tarball fallback or native compiler bootstrap.

The tested JSON Quality 3.0 precedent is `../json-quality/docs/markdown-quality.md` and local signed commit 9c038b10e01da9ae2ff93d5a009205c92e7eb775.
Reuse its normal root dependency, explicit roots and explicit `--write` command shape.
Native npm authored its lock with lifecycle scripts disabled, retaining core and both matching optional native 3.0 packages.
Its local Windows proof covered 43 Markdown files, check exit 0 with 12 preserved historical advisory warnings, absent configuration and effective authored-gfm@2 defaults.
A real disposable file proved missing repair mode exit 2, zero-write preview with unchanged raw hash, one write matching predicted hash/byte count, then zero-write second format and check exit 0.
External-cwd `npm --prefix` inspection selected the intended repository root.
This is command-route proof, not Linux or WebVOWL acceptance.
The earlier b54b426b60cf9db1a8248b8e57f68ffb13ae998f archive-removal precedent remains historical.
Do not copy unrelated script renames or apply JSON Quality's no-config choice over WebVOWL's real ownership exceptions.
Keep WebVOWL's current script names, application feature work and normal pipeline authority.
Use no Markdown configuration unless actual repository owners require narrow exceptions.

This task authorizes only this new plan.
Do not edit configuration, package/lock files, AGENTS, product code, historical plans or evidence.
No install, build, product test, branch switch, commit or push occurs during planning.
Root `AGENTS.md` requires explicit approval for exact configuration changes.
The tables and script declarations below make later implementation reviewable.
Before future configuration edits, obtain that required approval for the exact files/settings and behavioral/pipeline effects; planning approval does not authorize those edits.
They do not alter configuration now or add a new permission question to this completed planning task.
Future commits require the user's actual per-file message review approval.

The earlier [producer-source inspection](codex://threads/01a1aad3-14cf-78f2-8a37-ced8c85759fb) remains historical context.
This refresh checks the installed 3.0.0 public package in JSON Quality's root node_modules: package exports, CLI admission, SDK and consumer/migration guides.
Use that installed contract as the implementation reference; do not execute or modify the mutable producer checkout.
The recorded baseline revision and isolated-tooling observations remain current; only this proposed plan is untracked in WebVOWL.

## Current repository ownership map

| Path                                                                               | Existing role                                                                        | Planned action                                                                                                        |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| `package.json`                                                                     | Root docs scripts delegate to isolated npm prefix                                    | Add exact >=3.0.0 devDependency; use direct installed public commands                                                 |
| `package-lock.json`                                                                | Root application/tooling/workspace graph                                             | Update deliberately once; preserve unrelated graph and overrides                                                      |
| `tooling/markdown/package.json`                                                    | File core/native dependencies, KaTeX override, cd and hardcoded .bin paths           | Remove after active reader migration                                                                                  |
| `tooling/markdown/package-lock.json`                                               | Separate dependency authority                                                        | Remove                                                                                                                |
| `tooling/markdown/archives/hadden-industries-markdown-quality-1.0.3.tgz`           | Core archive                                                                         | Remove                                                                                                                |
| `tooling/markdown/archives/hadden-industries-markdown-quality-win32-x64-1.0.3.tgz` | Windows archive                                                                      | Remove                                                                                                                |
| `tooling/markdown/archives/hadden-industries-markdown-quality-linux-x64-1.0.3.tgz` | Linux archive                                                                        | Remove                                                                                                                |
| `.markdown-quality.json`                                                           | Schema 2 include list and broad retained-document exclusions                         | Replace only justified scope exceptions with sparse schema 3                                                          |
| `.markdown-quality-execution.json`                                                 | Schema 1 resources/runtimes and archived toolchain paths                             | Keep only needed finite ordinary limits; retire obsolete qualification metadata                                       |
| `util/installRepositoryQualityTools.mjs`                                           | Isolated Markdown npm installer with JSON-named capacity controls                    | Remove current Markdown-only acquisition after verifying every import/caller                                          |
| `util/setUpDevelopmentEnvironment.mjs`                                             | Root npm ci then isolated Markdown install loop                                      | Remove duplicate Markdown install loop; retain root and Python setup                                                  |
| `tests/set-up-development-environment.test.mjs`                                    | Expects install:markdown command                                                     | Update expected call sequence and Windows process behavior                                                            |
| `util/markdownIntegration.probes.mjs`                                              | Imports isolated SDK, fixed workflow pin, archive hash, trusted stage/check behavior | Retain semantic scope/link/trust probes; replace archive ceremony and SDK spellings                                   |
| `util/markdownWorkflow.test.js`                                                    | Trusted caller mutation guards and complete documentation CI checks                  | Retain meaningful full-check/reuse/required-context tests; retire archive-only caller assertions if caller is retired |
| `.github/workflows/webvowl-ci.yml`                                                 | Documentation lane installs isolated Markdown graph                                  | Use normal root installation; preserve required job context and scope reuse                                           |
| `.github/workflows/markdown-quality.yml`                                           | Manual caller pinned at fa1188a867b29bddd0b972a080b7fcd0261bdec3                     | Trace receipt consumers; recommend retire archive-only ceremony if repository checking is its sole purpose            |
| `.test-impact.json`                                                                | Full-impact roots include tooling/util/docs and stale policy filename                | Track actual retained configuration/profile paths; preserve conservative full domains                                 |
| `util/dependency-graph.mjs`                                                        | Native dependency-cruiser composition and contained source capture                   | Verify root-hoisted package edges; retain containment and original source attribution                                 |
| `util/dependency-tooling.test.mjs`                                                 | Graph/affected-test behavior                                                         | Keep semantic tests and add only actual changed ownership cases                                                       |
| `util/affected-tests.mjs`, `.dependency-cruiser.json`                              | Affected verification and production/tooling boundaries                              | Keep authority; adjust only demonstrated resolution/ownership needs                                                   |
| `README.md`, `docs/continuous-integration.md`                                      | Setup, commands and pinned trusted-route narrative                                   | Describe current normal installation, scope and actual evidence claims                                                |
| `packages/vowl/conformance/**`, `docs/owlapi-js/**`                                | Canonical/reference/generated material                                               | Preserve byte ownership and exact corpus checks                                                                       |
| `docs/plans/**`, `docs/reviews/**`, `docs/evaluations/**`, `docs/sdlc/**`          | Planning/review/evaluation history                                                   | No broad historical rewrite; decide formatting scope narrowly from actual evidence status                             |

The inspected Markdown directory contains only its manifest, lock and three archives.
There is no additional copied source or release manifest there.
No custom registryUpgradeTarget was found in the inspected manifests.
Remove such metadata only if final live-reference search actually discovers it.
Do not remove `tooling/vendor/deepmerge`, workspace packages, ontology fixtures or unrelated vendor material.

The installer is named generically and exports JSON-named capacity helpers.
Its current executable branch accepts only markdown, and no external imports were found in the targeted caller search.
Verify the full caller map before deleting it.
If another quality kind or JSON consumer appears during implementation, preserve that branch and its behavior.
Never remove JSON Quality root dependency, `runRepositoryJsonQuality.mjs`, JSON providers or their capacity policy.

## Exact package scripts and CLI behavior

Proposed root scripts preserve existing names:

```json
{
  "format:docs": "markdown-quality format --write --root . --diagnostic-display-level warning",
  "format:docs:check": "markdown-quality check --root . --diagnostic-display-level warning",
  "check:docs": "markdown-quality check --root . --diagnostic-display-level warning"
}
```

Remove `install:markdown`; ordinary root `npm ci --ignore-scripts` supplies Markdown.
Document inspection as `npm exec -- markdown-quality inspect --root . --json` from the repository root, without adding a wrapper.
Add a root inspect alias only if a real current reader needs one.
Keep `test:markdown` as the semantic installed integration probe entry.
Keep existing lint/format/check composites and the application prebuild boundary.

Use npm's root script PATH.
Do not change directory to `../..`, hardcode `.bin` paths or use `npx` with network fallback.
For probes, resolve the root installed SDK and package bin and spawn that public executable.
Keep SDK imports in Node-only probes/build tooling: the root export rejects browser and unmatched resolver conditions; never add it to WebVOWL/VOWL browser bundles.
Warning display filtering is optional presentation, not policy or strictness.
For parseable JSON and literal operands, use `npm run --silent check:docs -- --json -- README.md`; the second `--` belongs to Markdown Quality.
Preview directly with `npm exec -- markdown-quality format --dry-run --root . -- README.md`; do not append `--dry-run` to the `--write` wrapper.
External-cwd callers use `npm --prefix <absolute-repository-root> run ...`; explicit root must remain WebVOWL.
Capture native child-process status directly; a PowerShell wrapper must use `exit $LASTEXITCODE` to preserve exit 2 rather than mapping nonzero statuses to 1.
No package-private implementation imports or copied native wrapper are needed.

| Existing/old interface                               | Current 3.0 interface or behavior                                                          |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| format, normalize physical repair                    | Requires exactly one --write or --dry-run                                                  |
| --diagnostic-level warning                           | --diagnostic-display-level warning, only if intentional presentation filtering is retained |
| --inventory                                          | --reconcile-inventory git                                                                  |
| executeQuality                                       | executeQualityRequest                                                                      |
| stageCandidate                                       | stageCandidateData                                                                         |
| processDocument                                      | processLogicalDocument                                                                     |
| compareQualityReports                                | compareCheckReports                                                                        |
| qualifyCandidate                                     | qualifyGitMarkdown                                                                         |
| limits SDK field                                     | analyzerLimits                                                                             |
| inventory SDK field                                  | reconciliationInventory                                                                    |
| gitExecutable SDK field                              | gitExecutablePath                                                                          |
| checkerMs, requestBytes, reportBytes, nodeOldSpaceMb | executionTimeoutMs, maxRequestBytes, maxOutputBytes, maxNodeOldGenerationMiB               |
| configuration/effective configuration                | Schema 3, authored-gfm@2                                                                   |
| result/execution/comparison                          | Schema 5 / 2 / 3                                                                           |
| outcome and written                                  | operationStatus/qualityStatus/qualityBasis and writtenPaths/documentResults                |
| selection.inventory/exclusions                       | selection.reconciliationDecisions/omissions                                                |

The old tooling manifest's inspect and qualify scripts are not root commands and need no replacement ceremony.
`markdown-quality-qualify-git` accepts explicit immutable flags, with no consumer positional token.
If a real downstream receipt consumer needs it, map the complete contract rather than rename an old command.
Its flags include profile, candidate-root, trusted-root, candidate-commit-id, trusted-commit-id, producer-commit-id, core-archive-sha256, native-archive-sha256, workflow-commit-id, git-executable-path, python-executable-path and output-root.
Do not manufacture archive SHA-256 values from installed files or npm SRI strings.

Keep `inspectSelection`, `readExecutionProfile`, `validateQualityResult` and `runQuality` where needed.
SDK physical repairs retain their API semantics; do not invent a write option copied from CLI admission.
`executeQualityRequest` refuses physical repair; logical processing remains no-write.
Migrate embedded argv/options, schema expectations and report readers in the same slice.

Schema-5 candidates identify exact input/output hashes, byte counts and changed.
Check candidate fields independently; validate writtenPaths against actual confirmed writes.
The existing probe's `written` assertion must become a real no-write assertion over the new contract.
Inspection returns not-checked; preview prepares real candidates without writes.
A successful selected check, preview or repair is never complete-repository clean evidence.
Require complete check operationStatus/qualityStatus and intended scope.

Human findings/summaries use stderr.
--json produces one complete stdout result; quiet affects only presentation.
Strict warnings, failures and refused repairs must remain visible and blocking as specified.
Help/version must not load policy, analyze content or run native tooling.
Preserve canonical literal paths after -- and intentional --files-json [].
Test root discovery from Git, package and cwd contexts, including nested cwd.
Explicit paths bypass include but retain exclusions and refuse unsupported variants.
Raw --stdin requires --stdin-filepath; raw transforms output source and reject JSON/write/dry-run flags.
JSON/base64 --stdin-request remains available and never writes checkout files.

## Minimal scope and resource policy

Start with trusted absence of .markdown-quality.json.
Inspect actual selected/omitted/reconciled paths before deciding the final sparse policy.
Defaults already cover `**/*.md`, local targets, fragments, NFC/style checks, LF and two-space layout.
Do not copy old lint switches, empty lint objects or schema-2 preset names.

| Current choice                                               | Recommendation                                                                                              |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `*.md`, `docs/**/*.md`, `packages/vowl/**/*.md` include list | Use default `**/*.md` unless an owner demonstrates a narrower authored domain                               |
| `docs/owlapi-js/**`                                          | Preserve imported/reference ownership; identify which files are upstream or generated before excluding      |
| `docs/sdlc/**`                                               | Preserve recorded evidence bytes; do not blanket-exclude newly authored guidance merely by directory name   |
| `docs/reviews/**` and `docs/evaluations/**`                  | Retain genuine historical oracle/evidence boundaries with narrow documented ownership                       |
| `packages/vowl/conformance/**`                               | Preserve canonical and supplemental fixture bytes; select editable README material only where owner permits |
| Build outputs, dependencies, caches                          | Verify native operational defaults; add no duplicate exclusion without need                                 |
| root-relative reject and localFiles true                     | Use defaults; schema-3 spelling is checkLocalTargets if explicitly needed                                   |
| Long lines/style/link failures in editable prose             | Record and repair actual defects in a coherent follow-up; do not disable rules to get green                 |
| Limits or warning display                                    | Keep finite capacity and honest presentation; never redefine quality through quiet or diagnostic filtering  |

If genuine exceptions remain, keep a sparse schema-3 file with only justified exclusions.
Do not add blanket `docs/**`, default-rule disabling, ignore-file authority or unlimited limits.
Current historical docs remain untouched by this planning task.
Future broad Markdown cleanup is separate from package replacement.

The current profile uses six samples, 30-second execution, 180-second sample window, 1 GiB observation memory, 128 MiB Node/worker heaps, 8 MiB request/output, 160 MiB staging and 100000 staged entries.
These are observations/ceilings, not proof that every new capacity field should be authored.
For ordinary checks, prefer a sparse profile with only demonstrated execution/analyzer overrides.
Finite package defaults supply everything else.

If an existing finite profile remains necessary, use schema 2.
Map samples to requiredConsecutiveSamples, checkerMs to executionTimeoutMs, windowMs to sampleTimeoutMs, memoryBytes to maxObservedMemoryBytes, nodeOldSpaceMb to maxNodeOldGenerationMiB, requestBytes/reportBytes to maxRequestBytes/maxOutputBytes, stagingBytes/stagingEntries to maxStagedDataBytes/maxStagedEntries.
Map limits.documentDiagnostics/workerHeapMb to actual supported analyzer controls, not guessed renamed fields.
Ordinary operations need no runtimes, sample count or archive toolchain block.
Do not keep dead tooling/markdown paths just to satisfy a removed qualification assertion.
For any retained resource test, use adequate finite outer quotas so it reaches the intended sink.
Keep cleanup, output integrity, freshness and runtime-cache isolation assertions.

Keep the repository's managed Node/npm setup and Windows process handling.
The package tooling floor is Node >=22.13.0; do not silently change product/browser compatibility.
No product SemVer bump follows automatically from a development-only dependency change.

## Implementation slices

### Slice 1: map active readers and freeze semantic scope

Capture scripts, lock identity, actual Markdown inventory and archive references.
Separate ordinary CI checking from the manually dispatched trusted workflow.
Trace any real receipt reader and required-check context before deciding whether to retain that manual route.
The inspected active ordinary gate is documentation in webvowl-ci.yml.
It runs check:docs plus test:markdown and participates in the required job.
The manual caller and its assertions alone do not prove a downstream receipt requirement.
Recommend ordinary root installed checking for repository Markdown; retire obsolete archive ceremony.
Do not label ordinary check evidence as the old trusted qualification receipt.
Acceptance: scope exceptions and exact retain/edit/remove decisions are reviewable.

### Slice 2: root dependency and normal setup

Add exact >=3.0.0 root declaration and direct scripts.
Create one deliberate root lock update with the managed npm.
Author it with native npm and `--ignore-scripts`, retaining core 3.0 and both matching optional native platform entries.
Preserve application dependencies, workspace aliases, deepmerge and unrelated overrides.
Remove isolated KaTeX override rather than promoting it automatically into root policy.
Install once from the frozen root lock with lifecycle scripts disabled.
Immediately preflight the installed public SDK exports, CLI admission and repair modes before expensive semantic or full-scope checks.
Keep dependency/config/consumer updates in one coherent batch with one installation and no acquisition-only ceremony.
Remove the isolated setup loop and install:markdown; keep root npm ci --include=dev --ignore-scripts.
Preserve Python setup and Windows hidden child-process handling.
Verify setup expectations in tests/set-up-development-environment.test.mjs.
Acceptance: a normal fresh root install loads the actual public CLI and matching native package without custom acquisition.

### Slice 3: installed semantic probes and graph ownership

Resolve Markdown from the root graph.
Replace fixed archive/source assertions with lock/installed identity where that is their actual purpose.
Retain authored anchors, conformance README scope and real missing-link refusal.
For a retained candidate-as-data probe, use stageCandidateData and executeQualityRequest with current options.
Candidate configuration and ignore files must not suppress the trusted policy, and lifecycle markers must not execute.
If the manual qualification capability is retired, keep only trust semantics that still protect an actual reader.
Do not retain a synthetic qualifier solely to preserve its old test.

Assert schema 5 independently in real installed CLI proof as well as installed validator acceptance.
Rewrite field names and candidate/write states rather than accepting arbitrary schemas.
Exercise actual root-hoisted dependency-cruiser resolution.
Bare package edges such as `../../ajv` from a hoisted dependency must not be treated as contained local source inputs.
Fix classification/resolution at its owner; never weaken readOwned containment or unresolved-edge policy.
Update .test-impact.json's stale .markdown-quality-policy.json to the actual retained configuration ownership.
Retain conservative docs/tooling/util/fullFiles selection and all unrelated product source-reader edges.
Acceptance: affected verification owns every changed command/config/SDK reader.

### Slice 4: CI and obsolete qualification cleanup

Replace the documentation lane's prefix installation with root frozen-lock acquisition.
Keep its reuse condition, complete authored check and semantic probe ordering.
Preserve required dependencies scope/application/tooling/documentation/corpus/json and existing required context.
Do not turn full documentation checks into changed-file checks to make them fast.
Update markdownWorkflow.test.js assertions and meaningful negative mutations accordingly.

If no receipt reader remains, retire the manual archive-specific caller and its obsolete pin assertions.
If a concrete reader exists, document it and preserve trust/credentials/input identity while adapting only that contract.
The independently pinned shared workflow code is executable trust, not a vendored dependency.
The installed public qualifier uses trusted-commit-id/candidate-commit-id rather than caller trusted-sha/candidate-sha.
A retained pin change requires compatible caller/profile/guards in one slice.
Current qualifier still requires actual archive bytes plus lock integrity under trustedRoot.
Prefer an already existing producer-owned frozen tuple/material route where actual readers need it.
Do not persist consumer archives, fake hashes or create a generic registry adapter.
No local check may impersonate a trusted hosted receipt.
Any manual workflow created only on this feature branch needs default-branch registration before dispatch.
Prefer an existing registered entry if hosted verification is truly required.
Acceptance: ordinary root checks remain authoritative and no obsolete acquisition dependency survives.

### Slice 5: remove retired files and explain usage

Delete the isolated manifest/lock/three archives after active readers are migrated.
Delete installRepositoryQualityTools.mjs only after verifying no JSON/shared consumers remain.
Remove archive-only wrappers/assertions rather than creating replacement boilerplate.
Update README and continuous-integration docs with normal npm ci, check, explicit write and dry-run semantics.
Keep historical plans, reviews, evaluations and conformance oracles unchanged.
Do not rewrite historical pinned-workflow evidence to describe the new installation.
Run one consolidated Review Agent, then only narrow repaired questions.
Use minimal HISEW/evidence bookkeeping; no duplicate reports or broad campaigns.
Acceptance: live-reference search is clean for deleted paths outside intentionally historical documents.

## Verification and acceptance selectors

These are future implementation checks; none ran during planning.

- `npm run test:markdown`: retained installed semantic probes.
- `npm test -- --runInBand --runTestsByPath util/markdownWorkflow.test.js`: retained CI/context/scope guards.
- `npm test -- --runInBand --runTestsByPath tests/set-up-development-environment.test.mjs util/dependency-tooling.test.mjs`: Jest-owned setup, Windows behavior and graph/affected ownership.
- `npm run graph:dependencies` and `npm run check:affected -- --base <full-baseline-commit> --list`: actual changed ownership without expanding to product execution.
- `npm run check:docs`: complete intended Markdown check after selection is reviewed.
- `npm run test:json`: only if installer/shared provider or JSON ownership actually changes.
- Current setup Python checks only if those owners are edited; no application build or browser campaign for a docs-tool-only patch.

Installed public CLI fixture proof covers check, real dry-run zero writes, explicit write and subsequent check.
Cover missing/both repair modes, invalid UTF-8/path/input, missing target, strict refusal and empty selections.
Hash fixture trees around read-only/refused operations.
Assert separate streams, whole stdout JSON, quiet failures and inert help/version.
Exercise literal bracket/space/option-like names, root discovery, explicit [] and nested cwd.
Test JSON/base64 logical processing; test raw stdin only through its actual public contract.
Exercise both Windows x64 and Linux x64 native loading from the same frozen lock graph.
Source-only schema validation, mocks or producer checkout passes cannot replace installed native acceptance.
Record unrelated full-corpus defects honestly and keep coherent content cleanup separate.
A successful repair or preview is never the final check verdict.

## Bounded open decisions and recovery

1. Policy scope: recommend no config unless proven imported/generated/frozen evidence exceptions require a sparse schema-3 file.
   Review exact paths rather than preserving broad historical exclusions automatically.
2. Manual qualification: recommend retire archive-only ceremony when ordinary repository Markdown checking is the sole consumer; retain existing required CI contexts.
   If an actual receipt consumer is found, name its exact producer/readers and bounded contract work before changing it.
3. Execution profile: recommend package finite defaults plus only measured ordinary overrides after manual qualification retirement.
   Keep genuine observation requirements only with an actual qualification owner.
4. Installer: targeted search found no external imports and a Markdown-only executable branch.
   Recommend removal after full caller audit, preserving any newly discovered JSON/shared branch.
5. Product version: recommend no independent WebVOWL SemVer bump.
   A changed published product interface would be a separate compatibility decision.

None of these decisions concerns 3.0 publication or availability, which is assumed.
Complete the plan without questions to the unavailable user.

Rollback is a coherent reversal of the migration patch and root lock, preserving unrelated feature work.
Do not reset, restore or switch away from user changes.
Do not retain a permanent fallback archive installation.
Old receipts keep old identities; new graph evidence never overwrites historical evidence.
Completion requires minimal scope, one root graph, real installed/native behavior, scoped checks and consolidated review.
This plan establishes implementation direction and installed-contract findings, with separately attributed JSON Quality proof; it makes no claim of passing WebVOWL migration evidence.
