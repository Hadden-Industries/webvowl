# WebVOWL security baseline and Code Quality assessment

Accepted task: implement the security recommendations from the 2026-09-11
comparison with Hadden-Industries/owlapi. Base: `512eb30f2781c1ad19d659ccedc649da526e8395`.
R1 configuration verification route: validate policy invariants locally, then
verify effective GitHub settings and hosted workflows. No product functionality.

## Implementation and verification scope

- Enable Dependabot vulnerability alerts, automatic security-update PRs and secret
  push protection. Read back each setting after saving. Private vulnerability
  reporting, dependency graph and secret scanning are already enabled.
- Add root SECURITY.md with reporting, support boundaries, ownership and closure.
- Add `.github/workflows/dependency-review.yml`, required check `Dependency review`:
  all PRs targeting main, high/critical severity, runtime/development/unknown scopes,
  read-only contents permission, no checkout or package execution. Use the native
  MIT-licensed actions/dependency-review-action v5.0.0, pinned to
  `a1d282b36b6f3519aa1f3fc636f609c47dddb294`. The latest stable release was verified
  on 2026-09-11. No custom vulnerability engine or licence classifier is needed.
- Remove the same-repository job restriction from `.github/workflows/codeql.yml`.
  Preserve pull_request, static build-mode none, pinned actions and existing
  permissions. Do not execute fork code under pull_request_target or pass secrets.
- Retain tests for parsed workflow security invariants in
  `tests/security-workflows.test.mjs`; use repository npm test commands. Initial
  checks confirmed the missing workflow and fork restriction. These are
  configuration evidence, not an executed malicious-dependency or fork-PR trial.
- Verify PR checks and main scans; add the successful dependency check to existing
  main branch protection. Preserve all existing required checks.

Dependency review concerns introduced vulnerabilities, while Dependabot alerts
cover the existing dependency inventory. Neither guarantees advisory coverage for
an exact Git dependency such as owlapi; its upstream and consumer checks remain
necessary. Enabling a control does not certify alert triage or production deployment.

## Code Quality assessment

Both repositories had the separate GitHub Code Quality product disabled. WebVOWL's
settings offer enrollment, an initial default-branch scan, PR analysis and an
AI-generated coverage workflow proposed as a PR. That generated workflow requires
review against the existing test and corpus setup before adoption.

Current GitHub documentation describes active-committer licences, Actions usage
and shared AI credits. In-PR autofix usage cannot be disabled independently; AI
findings on main are separately optional. The repository UI mentions Actions
minutes but does not establish the organization's full entitlement or cost.

Recommendation: retain the existing lint/test/CodeQL gates and leave Code Quality
disabled until the owner approves its billing scope and a bounded pilot. Start
without a blocking quality/coverage ruleset, record incremental actionable findings
and duplicate/noisy findings, review actual usage, then decide whether to retain it.
No Code Quality subscription, AI budget, coverage workflow or gate was enabled by
this assessment.

## Local evidence and limits

The three changed GitHub security toggles were saved and read back as enabled
through signed-in Chrome. The policy resolver identifies root SECURITY.md as
applicable to src. `npm run test:controls` passed 80 tests; `npm run test:sdlc`
passed; `npm run test:setup` passed 30 tests with one skip. `git diff --check`
passed. The two new workflow tests first exposed the absent dependency workflow
and fork exclusion, then passed after the approved changes.

`npm run check:sdlc` failed because this new temporary worktree does not contain
the generated local Codex configuration. No host configuration or trust was
changed to turn that into a pass. Hosted checks remain separate evidence.

The installed Codex Security 0.1.24 inventory helper returned zero in-scope files
for this local patch, omitting all five changed files. The repository's documented
R1 inventory-omission alternative therefore applies: a direct independent scoped
security review, with deterministic checks retained. This is not a completed
native security scan. Actual fork-PR upload and rejection of a deliberately
vulnerable dependency delta were not exercised locally.

## Primary sources

- [Dependency Review Action](https://github.com/actions/dependency-review-action)
- [Latest stable release](https://github.com/actions/dependency-review-action/releases/tag/v5.0.0)
- [MIT licence](https://github.com/actions/dependency-review-action/blob/a1d282b36b6f3519aa1f3fc636f609c47dddb294/LICENSE)
- [Code scanning PR upload permissions](https://docs.github.com/en/code-security/reference/code-scanning/troubleshoot-analysis-errors/resource-not-accessible)
- [Code Quality billing](https://docs.github.com/en/billing/concepts/product-billing/github-code-quality)
- [Code Quality cost controls](https://docs.github.com/en/code-security/how-tos/maintain-quality-code/view-and-manage-cost)
