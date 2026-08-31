# WebVOWL Pre-Registry `owlapi` Consumer Cutover Implementation Plan

> **Status:** Ready after the standalone-package prerequisites below pass.<br>
> **Execution:** Implement inline and test-first, without subagents. Stop for exact configuration approval, the formal `/review` gate, commit approval, and separate push approval.<br>
> **Design:** [`docs/specs/2026-08-31-pre-registry-owlapi-webvowl-decoupling-design.md`](../specs/2026-08-31-pre-registry-owlapi-webvowl-decoupling-design.md).<br>
> **Goal:** Make WebVOWL an ordinary installed-package consumer of the accepted `owlapi@0.1.0-alpha.0` source before npm namespace access is resolved, so the repositories can evolve independently without a source copy, sibling checkout, alias, or fallback.

## Fixed constraints

- Commit exactly `git+https://github.com/Hadden-Industries/owlapi.git#caabb1197ffdab91c1e10d596d177b5142aea5c1`. Reject branches, tags, abbreviated commits, Git SemVer selectors, alternate transports, `file:`, links, workspaces, aliases, environment switches, and sibling paths.
- Import only `owlapi`, `owlapi/apibinding`, `owlapi/model`, `owlapi/io`, and `owlapi/formats`.
- Fix package behavior only in [`Hadden-Industries/owlapi`](https://github.com/Hadden-Industries/owlapi), then deliberately advance WebVOWL to a newly accepted full commit.
- Preserve VOWL behavior except for changing the generated comment from the historical staging name `owlapi-js` to the installed package name `owlapi`.
- Preserve historical migration and reconstruction records, but mark them archival and redirect active work to the standalone repository. Do not rewrite historical paths or digests.
- Remove package-development source, tests, and utilities. First relocate the small WebVOWL-owned fixture, policy, and benchmark subset.
- Prove installation from a clean clone with no sibling `owlapi` checkout and no ancestor `node_modules`.
- Add comments only where the temporary transport or ownership boundary is not evident from the code.
- Add no Vite, Jest, or ESLint resolver alias. Stop if configuration beyond the approved manifest and lockfile changes proves necessary.

## Starting evidence

- [ ] The public `owlapi` repository resolves the full commit and its signed `v0.1.0-alpha.0` tag targets that commit.
- [ ] Its manifest has no `workspaces` and no Git-build trigger named `build`, `prepare`, `prepack`, `preinstall`, `install`, or `postinstall`.
- [ ] Standalone qualification proves the exact Git-installed tree equals the retained qualified tarball in path, regular-file mode, and bytes, and passes package identity, exports, public imports, and production-graph checks.
- [ ] The canonical standalone plan records Phase 19D1/19D2 and its regenerated gate digests verify without requirement/checkpoint topology movement.
- [ ] The WebVOWL review records the exact standalone plan/evidence commit and equivalence-report digest.

## Exact configuration approval gate

Before changing configuration, present this one batch:

1. `package.json`: add exact production dependency `owlapi` at the Git specifier above; remove direct `@rdfjs/data-model`, `@rdfjs/dataset`, `@xmldom/xmldom`, `jsonld`, `n3`, and `rdfxml-streaming-parser` only after Task 2 proves no retained WebVOWL owner; add no script, alias, workspace, override, or fallback.
2. `package-lock.json`: regenerate with Node `v24.19.0` and npm `12.0.2`; require the root dependency and `node_modules/owlapi.resolved` to identify the exact URL and full commit; retain the six libraries only as transitive package dependencies; claim no registry SRI or provenance for the Git root.

This replaces a repository-local library with one immutable installed coordinate. Ordinary `npm ci`, Jest, and Vite then exercise the public boundary used by external consumers.

## File map

**Create**

- `src/owlapiConsumerBoundary.architecture.test.js`
- `src/owl2vowl/test/fixtures/ontology-syntax/phase5-structural.{ofn,omn,owx,rdf}`
- `docs/owl2vowl/compatibility/production-corpus-differences.json`
- `util/vowlBenchmarkFixtures.mjs`
- `util/vowlBenchmarkFixtures.test.js`

**Modify**

- `src/owl2vowl/js/index.js`, `importResolver.js`, and `vowlBuilder.js`
- every `src/owl2vowl/js/*.test.js` currently importing `../../owlapi-js/**`
- `src/owl2vowl/test/vowlBuilder.differential.test.js`
- `src/owl2vowl/test/vowlBuilder.webvowl.test.js`
- `src/owl2vowl/test/vowlSemanticSnapshot.test.js`
- `src/owl2vowl/test/productionDifferential.test.js`
- `src/testRunnerScope.architecture.test.js`
- `util/benchmark-vowl-builder.mjs`
- `docs/owlapi-js/README.md` and `docs/owlapi-js/implementation-plan.md`
- `docs/adr/0007-axiom-annotations-nest-on-the-annotation.md`
- `docs/plans/validated-ontology-materialization-cache-implementation-plan.md`
- approved `package.json` and `package-lock.json`

**Remove after relocation**

- `src/owlapi-js/**`
- `util/owlapi-reference/**`
- `util/benchmark-owlapi-*.mjs`
- `util/generate-w3c-*.mjs`
- `util/audit-w3c-rdf-to-owl-fixtures.mjs`
- `util/measure-owlapi-*.mjs`
- `util/verify-owlapi-rdfxml-corpus.mjs`
- `util/generate-owlapi-benchmark-fixtures.js`

Keep the historical `docs/owlapi-js/**` archive. Its handoff notices revoke active authority while preserving migration, review, and reconstruction provenance.

## Task 1: Add the failing maintained boundary contract

Create `src/owlapiConsumerBoundary.architecture.test.js` with immutable expected values for the Git specifier, `0.1.0-alpha.0`, and the exact five-entry exports map.

- [ ] Scan static imports, re-exports, literal dynamic imports, and literal CommonJS requires under retained `src/` and `util/` JavaScript.
- [ ] Reject `owlapi-js`, unapproved `owlapi/*` paths, and relative access to package source.
- [ ] Require the exact root manifest/lock values, no dev duplicate, installed identity/exports, and no six package-owned root declarations.
- [ ] Require `src/owlapi-js` and enumerated package-development utilities to be absent.
- [ ] Check `package.json`, `vite.config.mjs`, and `eslint.config.js` for aliases/fallbacks.
- [ ] Run `npm test -- src/owlapiConsumerBoundary.architecture.test.js --runInBand` and retain the expected RED result against the current tree.

## Task 2: Prove ownership before deletion

Use the reviewed standalone dependency-inventory logic against the current WebVOWL commit.

- [ ] Scan production, tests, utilities, configuration, HTML, literal dynamic imports, CommonJS, and copied-asset paths for the six removal candidates.
- [ ] Treat an application-owned occurrence as a blocker until rewritten or the dependency is retained.
- [ ] Classify the four phase-5 syntax inputs, the production VOWL difference ledger, `benchmark-vowl-builder.mjs`, and `benchmarkEnvironment.*` as WebVOWL-owned.
- [ ] Classify the broad Java reference harness, syntax benchmarks/generators, W3C generators, and package browser-cost tools as transferred package material.

## Task 3: Install the Git package and remove direct dependencies

After exact configuration approval:

- [ ] Apply the approved `package.json` edit with one reviewed patch, then run one npm installation to regenerate the lock; do not experiment one dependency at a time.
- [ ] Inspect the manifest and lock before tests.
- [ ] Require `node_modules/owlapi/package.json` to match the expected identity/exports.
- [ ] Require `npm ls owlapi --json` and `npm ls --all --json` to have no extraneous or invalid nodes.
- [ ] Keep the boundary test RED because source-tree imports/material still exist, but require its package/lock/identity assertions to pass.

## Task 4: Cut source and tests to public package roots

- [ ] Map manager imports to `owlapi/apibinding`, model imports to `owlapi/model`, and documents/errors to `owlapi/io`.
- [ ] Import `OWLOntologyLoaderConfiguration` from model and `StringDocumentSource` from I/O.
- [ ] Split the former root test import so `IRI` comes from model and resource/security errors from I/O.
- [ ] Replace private `createOntologyID(...)` calls with public `factory.getOWLOntologyID(...)`.
- [ ] Keep `VOWLBuilder` dependent only on structural public bindings.
- [ ] Change `_comment` and exact expectations to `Created with owlapi VOWLBuilder`.
- [ ] Run `npm test -- src/owl2vowl/js src/owl2vowl/test/vowlBuilder.webvowl.test.js --runInBand` and require GREEN through the installed package.
- [ ] Confirm the six libraries are reached only through `owlapi`, never through a retained WebVOWL import.

## Task 5: Relocate WebVOWL-owned evidence and benchmark support

- [ ] Copy the four syntax fixtures byte-for-byte into `src/owl2vowl/test/fixtures/ontology-syntax/`; update test paths and governed-difference scope strings.
- [ ] Move the production VOWL difference ledger to `docs/owl2vowl/compatibility/`; update code, diagnostics, and the live ADR reference.
- [ ] Remove `vowlBuilder.differential.test.js`'s package-wide expected-differences dependency. Use an explicit empty VOWL rule set so any new difference still fails closed.
- [ ] Write RED tests for valid Functional Syntax/RDF/XML counts and invalid count rejection.
- [ ] Implement only those two generators in `util/vowlBenchmarkFixtures.mjs`; update the retained benchmark to public package roots and WebVOWL-owned identifiers.
- [ ] Run `npm test -- util/vowlBenchmarkFixtures.test.js src/owl2vowl/test/vowlBuilder.differential.test.js src/owl2vowl/test/vowlBuilder.webvowl.test.js src/owl2vowl/test/vowlSemanticSnapshot.test.js src/owl2vowl/test/productionDifferential.test.js --runInBand`.

## Task 6: Remove the package-development tree

- [ ] Resolve and verify `C:\Users\maksy\GitHub\webvowl\src\owlapi-js` and `C:\Users\maksy\GitHub\webvowl\util\owlapi-reference` are the intended strict repository descendants.
- [ ] Record their tracked path inventories in review evidence; Git and Phase 19A provenance remain recovery mechanisms.
- [ ] Delete only the enumerated paths. Preserve `docs/owlapi-js/**`, `benchmarkEnvironment.*`, relocated files, and unrelated user changes.
- [ ] Remove package-owned differential suites from `src/testRunnerScope.architecture.test.js`; retain the OWL2VOWL differential and `node_modules` exclusion assertions.
- [ ] Re-run the maintained boundary and default-scope tests.

## Task 7: Mark the historical handoff

- [ ] Put an archival notice at the top of `docs/owlapi-js/README.md` and `implementation-plan.md`, linking active package work to the standalone plan and active consumer work to this plan.
- [ ] Do not alter historical commits, paths, reviews, lessons, schemas, or digest-bound reconstruction records.
- [ ] Point the deferred materialization plan's active package/lifecycle links to the standalone repository without changing its Phase-20 start gate.
- [ ] Correct live claims outside the archive that WebVOWL maintains or imports `src/owlapi-js`.

## Task 8: Verify maintained and clean-clone consumers

```powershell
npm run format
npm test -- src/owlapiConsumerBoundary.architecture.test.js src/testRunnerScope.architecture.test.js src/owl2vowl/js src/owl2vowl/test/vowlBuilder.differential.test.js src/owl2vowl/test/vowlBuilder.webvowl.test.js src/owl2vowl/test/productionCorpus.test.js --runInBand
npm test -- --runInBand
npm run build:dev
npm run build
```

- [ ] Inspect `git diff --name-only` after formatting so unrelated paths are not changed.
- [ ] Inspect the production static-import closure for installed `owlapi` and no local/fallback path.
- [ ] In a clean clone with no sibling/ancestor dependency tree, run `npm ci`, full Jest, and both builds.
- [ ] From the standalone repository's pinned Playwright harness, run the built-WebVOWL RDF/XML fixture in local Chromium, Firefox, and WebKit. Do not add Playwright or a sibling dependency to WebVOWL for this coordinate qualification.
- [ ] Re-review WebVOWL deployment-scope notices if emitted dependencies change.
- [ ] Retain commands, runtimes, lock hash, and PASS results as review/CI evidence.

## Task 9: Review and checkpoint atomically

- [ ] Confirm the diff contains only the approved package/lock changes, import rewrites, WebVOWL-owned relocations, exact package-development removals, boundary test, and archival handoff.
- [ ] State `Implementation complete; /review pending` and request built-in `/review` of all changes since design commit `1da5a5646779eb414ee58f79ffc9cad38ff32244`, focusing on lock integrity, public API placement, accidental fixture loss, and clean-clone reproducibility.
- [ ] Resolve or explicitly defer all confirmed P0–P2 findings.
- [ ] Only after explicit authorization, use `committing-to-git` for one signed atomic Phase 19D1 WebVOWL checkpoint. Exclude the pre-existing `AGENTS.md`, `data/.gitkeep`, and `skills-lock.json` changes unless separately requested.
- [ ] Push only after separate authorization, then record the WebVOWL commit in standalone Phase 19 evidence without declaring Phase 19 complete.

## Later Phase 19D2 normalization

After the exact public alpha passes registry verification, separately approve replacing the Git dependency with exact `0.1.0-alpha.0`, regenerating the lock with registry URL/SRI, and changing the boundary test to reject all Git inputs. Rerun the same clean clone, Jest, build, bundle, and three-browser checks. Retain no dual transport or fallback.
