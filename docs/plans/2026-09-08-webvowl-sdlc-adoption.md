# WebVOWL SDLC Adoption Implementation Plan

Status: user approved the listed configuration changes, signed commits, pushes and merge for WebVOWL SDLC only on 2026-09-08.
Date: 2026-09-08.

## Objective and design

Incorporate SDLC 1.0.0 pre-release into WebVOWL as one proportionate repository adoption. Reuse the verified Universal Ontology controls and the ONI portability fixes. Keep WebVOWL's package identity, AGPL-3.0-only licence, existing application module format, Vite build, npm test harness, owlapi consumer boundary and deployment ownership.

This is the existing SDLC architecture adapted to a new consumer. It does not require a new process framework or synthetic pilot. The accepted task supplies the bootstrap brief; use the justified R1 route and report actual independent-review and native-hook limitations honestly.

## Verified baseline

- Worktree: C:/Users/maksy/GitHub/webvowl-worktrees/sdlc.
- Branch: chore/webvowl-sdlc-bootstrap.
- Base and remote main: 28c70c2c6cab04672848521acab24dae7bff99ea.
- Destination: Hadden-Industries/webvowl, never VisualDataWeb/WebVOWL.
- Main has the user's separate fast-uri 3.1.5 to 3.1.7 lockfile edit. Preserve its bytes and leave it in main.
- The WebMCP worktree and the separate detached Codex worktree remain independently owned.
- No tracked .github directory/workflows, no open PRs, and main is not protected.
- Existing tag ruleset "Protect Phase 19A provenance landmarks" remains authoritative.
- CodeQL default setup is not-configured. No CodeQL setting transition is needed.
- Actions default token permission is write; approving PR reviews is allowed.
- Primary source: Universal Ontology b32d7cff65e57a4d4ea68334350e27b8ef5038ef. The inspected SDLC subtree has no delta from the ONI source pin b3984ffbfe9b38cca7bd4570aeb3f5bc0fa6f20e.
- ONI portability/delivery reference: merged PR https://github.com/MaksymShostak/oxygen-not-included/pull/2, merge 1d352b9040005e144a9fc4a1ac7dd628241e7284.

## Exact configuration scope for approval

| File or explicit source set | Setting and effect |
|---|---|
| package.json | Add packageManager npm@12.0.2 and npm entry points setup:development, setup:sdlc, setup:skills, setup:sdlc:github, sdlc, check:sdlc, check:affected, test:sdlc, test:setup and test:controls. Add development-only yaml 2.9.0. Preserve the existing test command, package type, all application dependencies, owlapi pin, build/deploy scripts and version/licence. |
| package-lock.json in this isolated worktree | Resolve only the added yaml development dependency and corresponding root declaration using npm. Preserve unrelated dependency resolutions; do not copy, alter or commit the main checkout's fast-uri edit. |
| .node-version; .python-version | Select Node 24.20.0 and Python 3.14.7 for reproducible control setup and CI. Do not install or replace global runtimes. |
| requirements-sdlc.txt | Add jsonschema==4.26.0, PyYAML==6.0.3, rfc3339-validator==0.1.4 and rfc3986-validator==0.1.1, the verified current stable direct requirements. Use this checkout's .venv. Record exact resolved transitive evidence and do not claim a transitive hash lock. |
| skills-lock.json | Remove only skills.test-driven-development, currently the floating obra/superpowers declaration, so the complete repository-adapted TDD skill is the sole owner. Preserve all other declarations and hashes. |
| .sdlc/skills/ | Add the complete six source skills: sdlc-route, motivation-to-evidence, quality-attribute-scenarios, thin-implementation-plan, test-driven-development and release-readiness, including references, metadata and retained licences. Adapt repository paths to util and WebVOWL commands. |
| .sdlc/skill-policies.json | Default local skills to explicit invocation; preserve existing unrelated installed skills and native metadata. |
| .sdlc/pipeline-policy.json; .sdlc/verification.json | Retain R0/R1/R2/R3 obligations; route actual WebVOWL and SDLC changes through their npm command owners. Full and affected profiles run the complete automatic floor for changed components; neither manufactures human acceptance. |
| .sdlc/schemas/accepted-baseline.schema.json; .sdlc/schemas/pipeline-policy.schema.json; .sdlc/schemas/verification-config.schema.json | Reuse the source JSON Schemas with native jsonschema validation. |
| .sdlc/codex/config.toml | Source policy: on-request approvals, workspace-write sandbox, available roles and maximum four concurrent slots. These settings do not grant delegation or override managed host restrictions. |
| .sdlc/codex/hooks.json | Source the evidence-bound Stop hook using this checkout's util entry points, including the verified Windows command form. Generation does not grant trust. |
| .sdlc/codex/agents/{principles_reviewer,repo_explorer,researcher,review_maintainability,review_operability,security_requirements_reviewer,test_oracle_reviewer,verifier}.toml | Import the eight optional native roles, adapted to WebVOWL. Standing no-subagents constraint remains. |
| .sdlc/codex/rules/default.rules | Retain the source command protections and explicit no-bypass policy. |
| .sdlc/dcg/{UPSTREAM.json,codex-hook.example.json,hook-probe-cases.json,operator-config.example.toml,git-reset-hard.yaml} | Retain provenance and inert examples/probes. Preserve the already installed operator DCG; no binary installation, global trust/ACL edit or new operator activation. |
| .sdlc/{PACKAGE_STATUS.json,SOURCE_PACKAGE.json,UPSTREAM.json,UPSTREAM-LICENSE} | Record exact source hashes, adaptations, licences and honest WebVOWL qualification. Keep version 1.0.0 pre-release and deployed false until actual owner-confirmed deployment. |
| .gitignore | Ignore generated .codex hooks/agents/rules, local skill activation, .sdlc/runtime and exact credential-capable configuration transaction scratch. Preserve existing ignores. |
| AGENTS.md; REVIEW.md | Add the proportional SDLC entry points, native-owner and no-shims principles, sole repository TDD, provenance and verification boundaries, bounded review/recovery and existing authorization rules. Preserve current user-safety and GitHub MCP guidance. |
| .github/ISSUE_TEMPLATE/{sdlc-change.yml,sdlc-bug.yml,config.yml} | Add native acceptance-oriented change/bug forms and project-specific guidance. |
| .github/pull_request_template.md | Add a single seven-field SDLC template with WebVOWL validation and browser/deployment evidence boundaries. |
| .github/CODEOWNERS | Route SDLC and workflow changes to @MaksymShostak without claiming this establishes an independent approval. |
| .github/dependabot.yml | Weekly grouped npm, pip and GitHub Actions updates; no automatic merge. |
| .github/workflows/sdlc-control-tests.yml | Linux/Windows control/setup tests and a stable aggregate gate with least-privilege permissions and commit-pinned Actions. |
| .github/workflows/webvowl-ci.yml | Native npm test and build checks for affected application/tooling inputs, with a stable aggregate gate and no deployment. |
| .github/workflows/sdlc-pr.yml | Trusted-base metadata and baseline linkage only: never execute PR-head code under pull_request_target. Qualify after bootstrap on a real PR before making required. |
| .github/workflows/sdlc-issue-acceptance.yml | Invalidate stale accepted-baseline labels when the owning issue changes. |
| .github/workflows/codeql.yml | Advanced CodeQL for Actions, JavaScript/TypeScript and Python; ordinary/Dependabot PRs, main pushes and scheduled analysis, least privilege and exact action SHAs. Verify actual processed analyses. |
| GitHub actions/permissions/workflow | Set default_workflow_permissions from write to read and can_approve_pull_request_reviews from true to false. Individual jobs retain only their required capabilities. |
| GitHub SDLC labels | Idempotently create the source's native SDLC labels through the origin-bound repository setup command; preserve unrelated labels. |
| Generated local .codex and .agents/skills files | Activate only the approved source in this SDLC worktree, preserving unrelated configuration and refusing ownership conflicts. Native hook trust remains separate. |

No change is proposed to the existing tag ruleset, branch protection, global Git configuration, operator DCG configuration, npm registry publication or WebVOWL cloud deployment.

## Implementation units and verification

### 1. Preserve WebVOWL's owners and establish the baseline

- [x] Ran npm ci with install scripts disabled in the isolated checkout: 604 packages installed; existing Git-dependency integrity and transitive deprecation warnings retained.
- [x] Baseline npm tests passed: 64 suites, 585 tests. Production npm run build passed, including existing formatting and lint prechecks.
- [x] Verified source/base identities and existing application scripts/licence/owlapi coordinate. Main's separate uncommitted lockfile SHA256 is e178cc2e8b5e6ac26a7f60e90a272155466144f2f358a18b689677478cae1ffa; that lockfile edit remains outside this isolated adoption worktree.

### 2. Adopt and adapt the consolidated controls

- [x] Import the source schemas, state engine, six complete skills, optional roles and generic guidance with provenance.
- [x] Place control scripts under util; new ESM helpers use .mjs so the root module format is unchanged.
- [x] Extract the already tested, repository-neutral configuration transaction functions into util/_configuration_transaction.py. Both SDLC configuration and skill activation consume that owner. Preserve util/set_up_mcp_servers.py and its current GitHub installer; do not import ontology installer code.
- [x] Adapt the source skill installer to util/set_up_agent_skills.py with preservation semantics and local-only activation; carry forward relevant source tests and existing Brooks explicit-invocation tests. Floating external refresh remains a separate reviewed operation and must fail before mutation when its immutable/pinned prerequisites are missing.
- [x] Add util/set_up_sdlc.py, util/sdlc.py, util/_sdlc_state.py, util/sdlc_stop_gate.py, util/validate_sdlc_pr.py, util/bootstrap_github_sdlc.py and native npm wrappers.
- [x] Add native Git change selection for SDLC, application and shared tooling; use the same path ownership locally and in CI. Include staged, unstaged and untracked inputs and fail closed on invalid bases.
- [x] Establish failing tests for changed behavior before implementation: CommonJS application preservation, util/.mjs execution, local skills vs external declarations, configuration ownership conflicts, partial-publication rollback, correct destination, ignored runtime evidence and affected checks. Reuse unchanged control preservation tests.
- [ ] Generate and validate configuration with its native parsers, then run the setup/control suites and appropriate WebVOWL tests/build. Record actual commands and failures.

### 3. Deliver and qualify the repository integration

- [ ] Review the exact diff against this accepted scope and engineering principles. Do not claim same-session review is independent or run an unauthorized native scan.
- [ ] Use the committing-to-git skill for signed commits only after explicit authorization, verify exact tree/message/signature, and push only to Hadden-Industries/webvowl after separate push authorization.
- [ ] Open the PR, apply only approved repository settings/labels, verify all actual CI and CodeQL processed-analysis results, and merge only with explicit merge authority and actual protections satisfied.
- [ ] Verify post-merge main checks. Preserve the user's dirty main checkout; do not fast-forward it across its lockfile edit without resolving ownership.
- [ ] Record hook-trust and first-real-PR linkage gaps separately from successful repository integration.

## Lessons to apply

The ONI PR records the earlier Universal Ontology tasks and concrete mistakes. Reuse it; do not restart the long investigation. Check CodeQL mode before activation, distinguish generation from hook trust, use native schemas/parsers and actual processed scanner records, retain failure evidence, use the selected npm owner environment, use literal Windows commands, and limit recovery to one attempt per distinct failure. Small specialist reviews have a ten-minute initial budget and at most two minutes of troubleshooting.

## Primary references checked for this proposal

- GitHub secure workflow guidance: https://docs.github.com/en/actions/reference/security/secure-use
- CodeQL setup types: https://docs.github.com/en/code-security/concepts/code-scanning/setup-types
- Native npm clean-install contract: https://docs.npmjs.com/cli/commands/npm-ci/
- Jest ESM contract: https://jestjs.io/docs/ecmascript-modules
- Node runtime selection: https://nodejs.org/en/download
- Exact npm and PyPI registry metadata checked 2026-09-08: npm 12.0.2 (Artistic-2.0), yaml 2.9.0 (ISC), jsonschema 4.26.0 (MIT), PyYAML 6.0.3 (MIT), rfc3339-validator 0.1.4 (MIT), rfc3986-validator 0.1.1 (MIT).

Baseline logs are retained in C:/Users/maksy/GitHub/oxygen-not-included-worktrees/sdlc-bootstrap/.sdlc/runtime/bootstrap/webvowl-baseline-tests.log and webvowl-baseline-build.log. The PATH Codex CLI reports 0.149.1; validate against the actual target host's schema during activation instead of reusing ONI's 0.153.4 qualification.


Implementation note: changed routing used test-first evidence; reused controls and
configuration transactions used preservation checks. The initial transaction fixture
needed adaptation to the extracted public document boundary; that setup failure is
not reported as behavioral RED. Local setup and native schema validation completed.
Exact final verification, signed commit, CI and merge outcomes are owned by the
bootstrap PR and retained runtime record, rather than predicted in this input tree.
