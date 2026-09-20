# CommonJS-to-ESM change dossier

Status: draft for owner review, revision 2, 20 September 2026. This revision incorporates the owner's direction to migrate D3 consumers and delivery to ESM, then evaluate local-reference optimization. It is not an accepted full baseline, repository policy, exact configuration approval, or completion evidence.

Planning addendum: the owner subsequently instructed continuation through delivery of the detailed plan. [The implementation plan](implementation-plan.md) now supplies eight slices, explicit decision branches and implementation gates against this draft. The readiness gaps below constrain implementation and acceptance; they do not withhold delivery of that planning artifact. Its newer planning observations supersede this dossier's statements that effective Jest configuration and dependency-graph inspection had not occurred. Full AST classification and runtime qualification remain unperformed.

Decision owner: the requesting repository owner, Maksy. Proposed execution and evidence owner: the implementing engineer; independent verification must be assigned before implementation acceptance. These roles are proposals, not evidence that anyone has accepted an assignment.

## Basis and current evidence

The task is to prepare a detailed implementation plan for this directory's proposal. The subsequent instruction to proceed authorizes preparing this draft dossier and risk route. The source-wide playbook supplies the scope; the earlier implementation playbook supplies supporting migration analysis. Where their breadth differs, this draft proposes the explicit complete `src/` boundary.

Sources:

- [Source-wide proposal](CommonJS-to-ESM-src-playbook.md), especially sections 1, 4, 6–10.
- [Earlier migration analysis](CommonJS%20to%20ESM_%20an%20implementation%20playbook%20grounded%20in%20WebVOWL.md).
- [Historical source census](src-files.txt) and [historical inventory](src-inventory.json).
- Current checkout: `10ca87172d466372756c765a6d30714836c54b1c`; working tree was clean before this dossier was added.
- Read-only inspection found 251 tracked `.js`/`.mjs`/`.cjs` paths under `src/`: app 90, shared 42, webvowl 81, owl2vowl 28, and 10 directly under src. The proposal's 236-file census is historical. Neither count is an AST classification.
- `src/app/js/languageSelection.test.js` still begins with CommonJS loading of Jest globals. `src/app/test/loadEsmModuleForTest.js` still uses CommonJS, `createRequire`, and VM modules. References to that loader span app, shared, renderer and converter tests. Search results are candidate consumers, not proof that every match executes the loader.
- Root `package.json` has no `type`; `src/owl2vowl/package.json` declares `type: module`. Root Jest configuration does not explicitly set `transform`. Effective Jest configuration has not been executed or inspected.
- Repository declarations: Node 24.20.0, npm 12.0.2, Jest range `^30.5.1`, Vite range `^8.3.0`. Ranges are not resolved or installed versions and are not a latest-version assessment.
- `vite.config.mjs` still invokes `vite-plugin-commonjs`, independently provides/distributes D3, uses fixed output names, and sets `emptyOutDir: false`.
- `.github/workflows/webvowl-ci.yml` stages the universal-ontology corpus from `b3984ffbfe9b38cca7bd4570aeb3f5bc0fa6f20e`, then runs the application suite and production build on Ubuntu. Windows coverage there is tooling coverage, not a Windows application-suite result.
- HISEW selected this repository for the supplied installation/session identity and reported personal applicability active. Selection is not assurance or completion.

No application tests, builds, browser checks, installation, exhaustive classification or dependency-graph generation were performed while preparing this draft. No existing failure is classified as an ESM regression without comparative evidence.

## Reasoning hierarchy

### 1. First principles

The desired outcome is one explicit source-module contract that maintainers can understand and test without compatibility-only first-party loaders, while users retain the same ontology and visualization behavior. Changing syntax is only useful insofar as it advances that outcome.

Four independent propositions need evidence: source syntax is ESM-compatible; each consumer interprets it as ESM; the dependency graph does not conceal first-party CommonJS; observable behavior remains correct. None implies the other three. A gate must cover disconnected files because reachability from today's entry point cannot establish a directory-wide property.

Module evaluation order, shared object identity, constructor identity, mutable state and deferred loading are behavioral contracts. Preserving them takes priority over uniform export style or reducing a CommonJS counter. Tests must observe actual production owners; copied algorithms cannot serve as the sole preservation oracle.

Choose the smallest interpretation boundary matching the intended scope. A source-local package scope is therefore the leading hypothesis. Its effects on nested packages, test discovery and dependency resolution still require a pilot. Removing the custom loader must not create a second disguised compatibility layer.

### 2. Authoritative specifications and maintainer guidance

Sources below were opened on 20 September 2026. Their authority and limits are separate from local runtime qualification.

| Source | Consequence for this change | Limit |
| --- | --- | --- |
| [ECMAScript 2026 scripts and modules](https://tc39.es/ecma262/2026/multipage/ecmascript-language-scripts-and-modules.html) | Linking and evaluation are semantic operations; preserve initialization dependencies and test cycles rather than doing textual substitution alone. | Language semantics do not specify Node package selection or Jest's harness. Use the dated edition; the unversioned specification currently identifies itself as 2027. |
| [Node package interpretation](https://nodejs.org/api/packages.html) | Inspect controlling package scopes and explicit extensions; do not equate missing root `type` with an exhaustive CommonJS classification. | The live page identifies Node 26.9.0. Version-24 documentation retrieval failed during this research, so exact pinned-runtime compatibility remains an explicit pilot obligation. |
| [Node ESM](https://nodejs.org/api/esm.html) | Qualify relative specifiers, URL-based identity and CommonJS dependency interoperation with the actual consumer. | Current documentation is not evidence that every API exists in Node 24.20.0. No runtime upgrade is selected here. |
| [Jest ESM guidance](https://jestjs.io/docs/ecmascript-modules) | Use transforms disabled or emitting ESM; retain the documented VM-module activation until exact-version evidence supports a change. Register ESM mocks before importing their consuming graph. | ESM support and mock APIs have qualifications; removing the custom loader does not imply removing Jest's VM flag. Check resolved-version guidance during the pilot. |
| [Vite dependency pre-bundling](https://vite.dev/guide/dep-pre-bundling) | Treat third-party CommonJS interoperability as a separate concern from first-party source conversion. | Development dependency handling is not proof of production build or D3 delivery correctness. |

Existing parser and resolver facilities should be reused: the architecture test already owns module analysis. Exact adoption of any additional component requires current version, native consumer, licence and integration evidence under HISEW REU-01/VER-01/LIC-01. No new component is selected by this dossier.

### 3. Community practice and local experience

[The ESM move, maintained author discussion](https://github.com/sindresorhus/meta/discussions/15), is a primary account of one maintainer's migration practice. It supports considering a single native module format and coordinated consumer migration; it is neither a language specification nor proof of community consensus. Its package-publishing assumptions do not automatically apply to this private application.

The proposal's immutable migration history gives stronger project-specific evidence for coherent dependency-group changes and shrinking exceptions. Those practices remain subordinate to the contracts above. Do not import a blanket named-export rule, root package conversion, dependency upgrade, D3 rewrite or generic codemod merely because another migration used one.

## Motivation and outcomes

All statements below apply to this draft and must be rechecked if its scope or checkout changes. Maksy is the accountable interpreter of proposed outcome targets. Confidence is qualitative; no measured productivity or performance benefit is claimed.

| ID | Statement and status | Evidence, confidence and contrary evidence | Risk, dependencies and review |
| --- | --- | --- | --- |
| MOT-001 | Maintainers need a complete, explicit source-module contract. Stakeholder intent normalized from the requested proposal. | Source-wide playbook; high confidence about intended scope, pending acceptance of this normalization. Existing ESM files already satisfy part of it. | A reachability-only gate would leave silent gaps. Depends on census and scope acceptance; review before baseline. |
| MOT-002 | Compatibility-only test loading creates avoidable divergence from ordinary loading. Engineering hypothesis. | Existing VM/CommonJS loader and many consumers; moderate confidence in reduced complexity, not measured maintenance savings. Intentional module-linking tests may legitimately retain VM use. | Over-removal could invalidate mocks or identity tests. Depends on consumer classification; reassess after pilot. |
| OUT-001 | Maintainers can account for every maintained source artifact under an explicit ESM contract. Proposed outcome. | Baseline: 251 tracked paths, classification unknown. Target: zero unresolved classifications and zero temporary first-party CommonJS exceptions at final acceptance. | Measure inventory/AST/scope/graph evidence on baseline and final revision. Implementer collects; owner accepts. Added files change the denominator. |
| OUT-002 | Users retain supported ontology loading, editing, visualization and export behavior. Preservation constraint derived from proposal. | Baseline runtime evidence is missing; target is no unexplained behavioral difference on the accepted corpus and interaction scenarios. | Measure focused contracts, full suite, semantic differential and browser evidence per affected slice and final revision. Timing/layout nondeterminism needs appropriate oracles. |
| OUT-003 | Test owners exercise ordinary module loading without losing test discovery, isolation or identity coverage. Proposed outcome. | Baseline loader is present; target is zero ordinary compatibility-loader consumers, with intentional VM tests documented. | Compare suite/case discovery and inspect representative actual graphs after pilot and cutover. Deleting tests to lower counts fails this outcome. |

Beneficiaries: application maintainers, test maintainers and users. Potential disbeneficiaries: contributors affected by changed test interpretation and operators affected by changed delivery. Trade-off: migration/review cost now for a simpler maintained loading model; no promised runtime speedup.

Do-nothing option: retain existing source and test infrastructure. It avoids immediate migration risk but preserves the incomplete directory-wide guarantee and multiple loading routes. Reconsider it if the pilot reveals a required supported consumer that cannot use the proposed source contract without disproportionate scope expansion.

## Scope, vocabulary and invariants

In scope: all maintained JavaScript under `src/`, including tests, test support, dormant/disconnected modules, nested converter source and future source files. Account separately for generated/vendor artifacts and deliberate negative fixtures. Their disposition needs evidence; moving maintained CommonJS outside `src/` to evade the gate is not a conversion.

Supporting scope: only necessary package interpretation, test, lint/build and dependency removal changes. Non-goals: root-tool ESM conversion as an end in itself; replacing Jest or D3; TypeScript; unrelated ontology or WebMCP redesign; opportunistic dependency upgrades; deployment.

"Native loading" here means the consumer's supported ESM loading path without the repository's compatibility-only VM loader. It does not mean Jest stops using VM facilities. "Complete" means accounted source, interpretation, dependency and behavioral evidence together. "Preserved" does not mean reproducing a demonstrated product bug without documenting it.

Preserve exported value shape, receiver behavior, singleton identity, constructor/prototype identity, initialization order, lazy boundaries, errors and synchronous/asynchronous contracts. Keep existing default exports where contractual. Apply semantic naming review when responsibilities change; do not disguise a singleton accessor as a fresh-object factory. Preserve notices/licences, ontology persistence and deployment paths. No data backfill or schema change is intended; discovering one requires rerouting.

## Proposed requirements and acceptance criteria

Each row is a draft requirement, owned by Maksy, derived from the cited proposal sections and outcomes. Confidence in traceability is high; satisfaction is unverified. IDs remain stable across revisions. All criteria below are proposed acceptance gates, not passed checks.

| Requirement | Linked outcome and source | Acceptance criterion and independent oracle | Risk if omitted |
| --- | --- | --- | --- |
| REQ-001: Account for the entire source scope, independent of reachability. | OUT-001; proposal §§1,3,10. | AC-001: reconcile tracked and relevant untracked `.js/.mjs/.cjs` paths, scopes, classifications and dispositions; zero unresolved paths at final revision. Compare Git census with actual recursive gate coverage. | Unimported or newly added files escape policy. |
| REQ-002: Every maintained source path uses explicit ESM interpretation and has no unapproved executable CommonJS. | OUT-001; §§1,4,7. | AC-002: AST, explicit-extension and package-scope checks pass for every path; malformed input fails closed; temporary first-party exception set is empty. | Syntax-only success conceals CommonJS execution. |
| REQ-003: Preserve module and application contracts across each changed graph. | OUT-002; §5. | AC-003: existing behavior assertions plus missing identity/order/cycle/laziness characterizations pass against real production exports; any divergence is explained and dispositioned before acceptance. | Silent initialization, state or receiver regressions. |
| REQ-004: Retire compatibility-only loaders without reducing test meaning. | OUT-003; §6. | AC-004: no ordinary loader consumer remains; intentional VM tests have a stated subject; discovery comparison accounts for every removed/renamed test; actual production behavior has coverage where copied algorithms exist. | Green tests examine a different graph or copied behavior. |
| REQ-005: Make future source violations detectable. | OUT-001; §7. | AC-005: isolated negative controls reject disconnected CJS, test CJS, hybrids, `.cjs`, malformed source and nested CJS scope; comments, strings, shadowed identifiers and format-neutral ESM pass. | Gate either misses regressions or blocks valid code. |
| REQ-006: Preserve required build and delivery behavior while migrating D3's delivery mechanism. | OUT-002; §9, amended by owner direction. | AC-006: fresh production/development builds, cold dev and preview serve required assets; lazy-parser verifier passes immediately after production build; ESM D3 resolves correctly and supported relative hosting paths work. Classic D3 asset paths/bytes are intentionally superseded by REQ-009. | Warm caches or stale output hide broken delivery. |
| REQ-007: Preserve supported ontology and browser behavior. | OUT-002; §9. | AC-007: full relevant suite with pinned corpus, unchanged semantic differential or justified deltas, and real-browser load/search/language/filter/gesture/lifecycle/export evidence qualify the final revision. | Unit-only evidence misses user-visible failures. |
| REQ-008: Make recovery and evidence reproducible. | All outcomes; §§9,10 and repository safety rules. | AC-008: record exact revision, environment, commands and outcomes; document coherent source/configuration recovery, rehearsal result and residual defects; never discard unrelated work. | Failed migration cannot be diagnosed or safely reversed. |
| REQ-009: Migrate production D3 consumers and delivery to ESM before deciding further binding optimization. | OUT-001,002; explicit subsequent owner direction. | AC-009: real consumers import D3 through the supported package graph without classic script/global injection; renderer, transitions, identity and exports pass; repeated comparable startup/rendering measurements are recorded against the previous route, followed by a documented decision on whether further binding optimization merits an experiment. | Mixed implementations, initialization regressions or unsupported performance assumptions. |

## Proposed quality scenarios

All rows are proposed hard preservation/completeness constraints, priority high. Owner of thresholds and results: Maksy; implementer records verification. Production observations use existing browser/network diagnostics and ordinary defect reports, not a new telemetry service. Runtime baselines remain unmeasured.

| ID / links | Source, stimulus, artifact, environment | Required response and measure | Verification / production signal | Rationale and failure risk |
| --- | --- | --- | --- | --- |
| QA-001 / REQ-001,002,005 / AC-001,002,005 / DEC-001,003 | Contributor adds a disconnected CommonJS file or nested CJS scope during development. | Gate rejects every prescribed negative control and accepts every prescribed valid control; all source paths accounted. | Isolated gate fixtures and census comparison / future CI rejection. | Reachability is insufficient; false negatives permit recurrence. |
| QA-002 / REQ-003,004 / AC-003,004 / DEC-002 | Two consumers import a shared constructor or registry under ordinary test loading. | Same required constructor/object identity and evaluation count; existing `instanceof` and state-sharing expectations hold. | Real graph tests with independently specified identity expectations / identity-related interaction failures absent in acceptance session. | Separate VM/URL graphs can duplicate state; ordinary import alone is insufficient proof. |
| QA-003 / REQ-003,006 / AC-003,006 / DEC-004 | User loads the app, then invokes a parser in cold development and fresh production preview. | No required deferred parser becomes eagerly loaded; required chunks and D3 resolve; no missing asset or startup exception. | Bundle verifier plus captured network/console behavior / same signals during owner-observed release smoke. | Bundler success can conceal deployment/lazy-loading regression. |
| QA-004 / REQ-004 / AC-004 / DEC-002 | A test installs D3/DOM state or mocks before importing its subject. | Setup precedes evaluation and substitutions affect the actual consuming graph; subsequent cases do not inherit unintended state. | Representative setup/mock/isolation tests and test-discovery comparison / CI regressions. | Static import hoisting can invalidate existing setup. |
| QA-005 / REQ-007 / AC-007 / DEC-004 | User loads, edits, filters and exports accepted ontology fixtures, including cancellation and repeated loading. | Existing accepted semantic results and lifecycle outcomes preserved; relevant gestures and exported artifacts remain usable. | Corpus/differential tests and real browser inspection / owner acceptance record and defect reports. | Renderer fakes cannot prove layout, transitions or export appearance. No new latency SLO is invented. |
| QA-006 / REQ-008 / AC-008 / DEC-005 | Maintainer aborts a cutover or observes a delivery regression. | A coherent known-good source/build state can be restored without losing unrelated changes or altering persisted ontology data. | Disposable recovery rehearsal before release / restoration smoke evidence. | Rollback is only a hypothesis until rehearsed; no recovery-time guarantee is asserted. |
| QA-007 / REQ-009 / AC-009 / DEC-006 | User loads representative graphs and runs simulation, drag and zoom on the ESM D3 build. | Preserve correctness; record repeated cold/warm startup, tick and frame-time results, variability and transfer cost against the same fixtures/environment before migration; disposition material regression before release. | Browser/network/profiler measurements after ESM cutover; evaluate added local bindings only if profiling supports it. | No benchmark yet demonstrates a global-injection advantage. Owner accepts any material performance trade-off; no invented numeric SLO. |

Conflicts: broad scope interpretation can simplify declaration while increasing tooling impact; loader removal can simplify infrastructure while disrupting setup/identity; build-plugin removal can simplify first-party delivery while breaking third-party compatibility. Resolve through the pilot and focused evidence rather than relaxing preservation criteria.

## Proposed decisions and configuration boundary

| ID | Proposed decision, alternatives and status | Discriminating evidence / owner |
| --- | --- | --- |
| DEC-001 | Prefer a source-local ESM scope. Smallest candidate configuration change: create `src/package.json` with exactly `private: true` and `type: module`. Keep `src/owl2vowl/package.json` unchanged. Alternatives are root `type: module` with wider tooling impact, or widespread `.mjs` renames with path/discovery churn. Not approved. | Pilot must verify Node/Jest interpretation, converter nested scope, test discovery, package resolution and Vite delivery. Maksy accepts the choice and exact file creation. |
| DEC-002 | Use standard static imports where evaluation order permits; supported dynamic imports after setup/mocking where required. Preserve genuine injection and deliberate VM-linking tests. No new first-party compatibility shim is proposed. | Pilot a pure utility, constructor-sensitive group and mocked/setup-sensitive subject. If `package.json` requires `jest.transform: {}`, propose that exact setting with effective-config evidence before editing; it disables transformation and must be qualified across all tests. |
| DEC-003 | Reuse the existing module-analysis owner for source-wide coverage, keeping existing architecture/layering checks. Temporary exceptions, if unavoidable, need exact path, reason, digest and removal point. | Complete AST/graph census and positive/negative controls. Do not extend the custom value-flow analyzer speculatively. Any policy/configuration edit requires separately scoped approval. |
| DEC-004 | Preserve lazy parser loading and required hosting behavior. D3 classic delivery is superseded by DEC-006. Evaluate removal of `vite-plugin-commonjs` only after proving its first-party need is gone and dependency behavior remains supported. | Exact CommonJS plugin/dependency/lock changes remain subject to approval and verification. D3-specific configuration changes are listed separately as CFG-005 in the implementation plan. |
| DEC-005 | Use coherent reviewed reversals or a previously qualified complete artifact if migration/release fails; do not undo isolated module declarations. | Document coupling and rehearse recovery with owned disposable material. Deployment topology and release observer must be established before claiming artifact rollback works. |
| DEC-006 | Owner-selected direction: migrate D3 consumers/delivery to ESM first; subsequently assess additional local-reference optimization. Use direct package imports, retire classic delivery and injected global aliases together, retain the selected D3 version. | SLICE-007 qualifies real behavior and compares performance before considering renewed optimization. CFG-005 names the exact configuration candidates; direction approval does not bypass exact-change approval. |

These are reviewable proposals, not instructions that authorize configuration edits. Lockfile, CI, lint, runtime pin and repository-policy changes remain subject to the user's exact-change approval rule. This document does not grant a no-shim exception or delegate agents.

## Risk route

### Risk class:

Proposed **R2**, for the migration, not because this dossier is Markdown. Inference: interpretation, custom-loader retirement and delivery changes have material application-availability and shared-state consequences. No evidence establishes an R3 safety/regulatory consequence.

### Decision owner:

Maksy, as requesting repository owner. Acceptance of the R2 route and baseline is not yet recorded.

### Reasoning:

Observed: loader references cross app, shared, renderer and converter boundaries; supporting package/build changes are contemplated. Inference: startup failure is broadly visible but initialization/identity errors may escape syntax checks. Likelihood is unquantified; impact ranges from localized test failures to inability to load or export an ontology. Data migration is not intended. R1 would be appropriate only if evidence materially narrows the accepted change so the elevated triggers no longer apply; a small remaining CJS count is not sufficient.

### Potential blast radius:

Application users, maintainers, test harness, browser delivery and nested converter package. Root tooling only if the chosen interpretation boundary extends to it. Third-party package format and persisted data are preservation boundaries.

### Reversibility:

Source changes can in principle be coherently reversed; actual deployment restoration and cache behavior remain unqualified. No guaranteed recovery time or tested rollback claim.

### Principal unknowns:

Current exhaustive module classification and dependency groups; effective/resolved test toolchain; native-loading pilot; remaining intentional VM tests; exact configuration necessity; representative baseline browser/corpus results; deployment recovery mechanics and responsible observer.

### Required artifacts:

Accepted exact dossier baseline and risk decision before R2 implementation; current census/graph and baseline evidence; consequential decision record; slice/evidence implementation plan; independent verification and relevant review results; recovery evidence and final disposition ledger. Reuse existing documents/evidence rather than duplicating them. No mandatory new GitHub issue or PR is inferred.

### Required specialist lenses:

Module semantics and dependency identity; test-oracle/isolation review; browser and build delivery; converter semantic preservation. Proposed scoped security review if changed loading/resolution/build boundaries affect executable input or dependencies, following the designated provider and repository authority. Neither a scan nor reviewer assignment has occurred.

### Required verification:

Next useful work: census/graph classification and a native-loading pilot after exact configuration approval. Final assurance: all AC/QA criteria, full relevant suite with pinned corpus, architecture gates, both builds, lazy-parser verification, cold browser delivery and interactions, Windows path behavior and case-sensitive resolution, independent verification, recovery rehearsal. Resolve current engine verification profile identities from supported inspection before execution; no profile name or historical pass is invented here.

### Required human approvals:

Accept exact R2 requirements baseline and material decisions; approve each exact configuration patch before effects; accept any changed consumer contract or shim exception if discovered. Commit, push, merge and deployment remain separately authorized actions. Approval of this dossier alone authorizes none of those effects.

### Maximum sensible autonomy:

Research, read-only inventory, drafting and revising the dossier/plan within the user's request. No configuration mutation, application implementation, waiver, baseline acceptance, remote lifecycle mutation or release is authorized by this draft.

### Next lifecycle step:

Owner reviews this concrete draft scope, REQ/AC/QA set and R2 proposal alongside the detailed implementation plan. The plan uses this identified draft baseline and makes census completion and the loading pilot its first execution slices, with explicit failure and replanning branches. Implementation acceptance still depends on their results. No migration completion is established by delivery of the plan.

## Planning readiness and resumption evidence

| Blocker | Consequence | Owner and minimum resumption evidence |
| --- | --- | --- |
| Draft scope, R2 route and requirements are not accepted. | Cannot label the dossier an accepted R2 baseline or start governed implementation. | Maksy accepts a specific revision or supplies corrections. |
| Source-wide classification and native-loading outcome are absent. | Cannot responsibly fix dependency-group membership, cutover ordering or exact loader-retirement effort. | Implementer supplies path-complete AST/scope/graph evidence and representative pilot results; exact configuration changes need prior Maksy approval. |
| DEC-001 interpretation boundary is proposed, not qualified. | A plan choosing root scope or source scope unconditionally would conceal a material design assumption. | Owner selects the candidate for a bounded pilot; qualification covers the listed consumers before final design acceptance. |
| Recovery deployment mechanics and final verification profile identities remain unverified. | No release/rollback or final-assurance completeness claim. | Inspect current supported controls and deployment contract; assign observer and demonstrate recovery before release acceptance. |

No estimates in hours or file-conversion totals are justified by the historical census. Replan if classification reveals maintained vendor CJS, a necessary compatibility shim, additional supported external consumers, unavoidable dependency changes, schema/persistence effects, a required eager load, or inability to preserve test identity/setup through the native consumer.

Draft-review check: source-wide scope, loader retirement, semantic invariants, source/interpretation distinction, future gate coverage, test credibility, corpus/browser/build/platform evidence, configuration authority and coherent recovery all have explicit requirement or decision owners above. Remaining unknowns are visible; no completion is established.
