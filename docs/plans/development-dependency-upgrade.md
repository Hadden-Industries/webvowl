# Development dependency upgrade

## Accepted basis and outcome

The owner requested this plan and its implementation on 9 October 2026, including a plan-first commit, signed commits, pushes, and the configuration changes specified here.
Consolidate implementation before broad review, use narrow follow-up reviews, and reserve external reviews for the final implementation commit.
The outcome is a current, reproducible developer toolchain whose registry development declarations allow deliberate future upgrades through floating minimums.

The inspected checkout is clean on local `main`, matching remote `main` at `1d669a6261bbc2e124dfc1fcbc7fb735faf872ca`.
Implement in this checkout; publish its exact signed commits through the protected branch's normal PR route.
Normal merge requires the owner's separate authorization and successful required checks.

Precedents are the implementations in Codex chats `01a11a9c-1875-7981-8df1-d30176c1b69b` (Universal Ontology), `01a11c30-e213-7fb3-b983-cb9b24fd8d23` (Chrome), and `01a11c48-c8bd-7fd1-9786-3598157e972f` (Steam Community BBCode), plus OwlAPI's `docs/plans/development-dependency-upgrade.md`.
Their reusable decisions are stable `>=` floors, independently refreshed registry identities, frozen installs, exact CI npm bootstrap before project commands, preservation of archive graphs, and final consolidated review.
Their runtime promotions, browser exceptions, workflow-action upgrades, and release machinery do not become WebVOWL requirements.

## Risk route

Risk class: R1.

Decision owner: The requesting repository owner.

Reasoning: This is bounded development-tool and setup maintenance; observed direct upgrades remain within existing majors.
The npm eligibility policy changes an internal setup contract, with native validation and straightforward recovery.
No public runtime support, persistent data, authentication, sensitive inputs, concurrency, or deployment boundary changes are proposed.
These are observations and a risk inference; a production graph change or broader compatibility problem triggers reassessment.

Potential blast radius: Developer installs, lint/test/build outputs, and existing CI installation steps.

Reversibility: Restore the prior coherent manifest, lock, npm policy, and setup consumers through a new reviewed commit; reinstall with scripts disabled.
Do not rewrite history or discard unrelated work.

Principal unknowns: Transitive resolution, new diagnostics, native optional binaries, and hosted Linux/Windows behavior.

Required artifacts: This accepted brief, retained registry/graph evidence, HISEW execution and verification receipts, and final review dispositions.

Required specialist lenses: Ordinary OpenAI Review Agent coverage and scoped dependency license, lifecycle-script, and advisory assessment.
A native security scan is required only if inspection reveals a material security boundary change requiring a reroute; dependency auditing is not represented as a source security scan.

Required verification: Registered affected profile (`npm test`), plus focused lint and full checked build because the upgraded tools own those consumers; supplemental Python, Markdown integration, install, and graph checks.
HISEW profiles have no declared path coverage; passing commands do not establish exhaustive coverage.

Required human approvals: Plan, commit messages, commits, pushes, and listed configuration changes are preauthorized by the originating request.
Normal PR merge is a distinct effect whose authorization must be recorded before execution.

Maximum sensible autonomy: Complete the listed changes, coherent signed commits, final review, and permitted PR publication without repeated approval prompts; preserve failed evidence and stop dependent delivery on a blocking failure.

Next lifecycle step: Validate and commit this plan, then run the accepted implementation slices through the installed HISEW procedure.

## Exact configuration scope and selected versions

Registry metadata was independently inspected on 9 October 2026.
Every root registry `devDependencies` value becomes `>=` followed by the selected stable version below.
Only three direct floors advance relative to the current manifest: Rollup replace, HTML Validate, and Vite.

| Package                        | Selected floor |
| ------------------------------ | -------------- |
| `@eslint/js`                   | `>=10.0.1`     |
| `@oddbird/popover-polyfill`    | `>=0.7.3`      |
| `@rollup/plugin-replace`       | `>=6.0.3`      |
| `archiver`                     | `>=8.0.0`      |
| `cross-env`                    | `>=10.1.0`     |
| `dependency-cruiser`           | `>=18.5.0`     |
| `eslint`                       | `>=10.12.0`    |
| `eslint-config-prettier`       | `>=10.1.8`     |
| `eslint-plugin-compat`         | `>=7.0.2`      |
| `globals`                      | `>=17.13.0`    |
| `html-validate`                | `>=11.16.2`    |
| `jest`                         | `>=30.5.2`     |
| `prettier`                     | `>=3.9.9`      |
| `stylelint`                    | `>=17.16.0`    |
| `stylelint-config-clean-order` | `>=10.0.0`     |
| `stylelint-config-standard`    | `>=40.0.0`     |
| `stylelint-order`              | `>=8.1.1`      |
| `terser`                       | `>=5.51.2`     |
| `vite`                         | `>=8.3.4`      |
| `vite-plugin-eslint2`          | `>=5.3.0`      |
| `vite-plugin-static-copy`      | `>=4.1.1`      |
| `vite-plugin-stylelint`        | `>=6.3.0`      |
| `yaml`                         | `>=2.9.1`      |

The primary identities are available from the [npm registry](https://registry.npmjs.org/) at each package's `/latest` endpoint; retain the exact version, engines, peers, integrity, source, deprecation, and license metadata outside the repository.
Declared licenses are MIT, BSD-2-Clause, BSD-3-Clause, or ISC; inspect distributed terms for changed artifacts before adopting them.
The selected engine ranges admit the unchanged Node 24.21.0 pin; npm remains the peer-resolution oracle.

The smallest authorized configuration changes are:

- `package.json`: change the 23 development declarations; change `packageManager` from `npm@12.0.2` to exact `npm@12.2.0`; add native `devEngines.packageManager` with `name: npm`, `version: >=12.2.0`, and `onFail: error`.
  The exact package-manager field supplies a reproducible reference; native devEngines owns local eligibility and admits newer stable npm versions.
- `package-lock.json`: refresh the root graph with npm 12.2.0, retaining exact resolutions and integrity.
  Preserve production dependency declarations and reject unexplained production graph changes.
- `.github/workflows/webvowl-ci.yml`: change the two existing global npm bootstraps to exact npm 12.2.0 and add that same bootstrap to the documentation job before its root npm commands.
  Keep `package-manager-cache: false`, script-disabled installation, job coverage, and gate behavior unchanged.

`util/setUpDevelopmentEnvironment.mjs` must delegate npm eligibility to native devEngines instead of requiring equality with `packageManager` after npm has admitted the command.
Update README setup guidance and add meaningful native npm/CI regression tests.
These source and documentation changes are predicted seams, not permission for unrelated refactoring.

Preserve all production declarations, the `packages/vowl` workspace, source package metadata, the isolated Markdown `file:` archives and lock, security overrides, runtime pins, Python requirements, formatting policies, and deployment settings.
There is no Node 26 promotion, Python dependency upgrade, browser dependency addition, workflow-action upgrade, package release, or deployment in this task.
Do not introduce compatibility shims, a replacement semver parser, force resolution, legacy peer resolution, or relaxed gates.
Material naming stays precise: packageManager denotes the exact reference, devEngines denotes admissibility, and setup continues to describe installing the declared development environment.

## Requirements and quality scenarios

| IDs              | Requirement and falsifiable acceptance                                                                                                                                                                                                   |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| REQ-001 / AC-001 | All 23 registry development entries use the selected stable `>=` floors; native resolution has no invalid peers; production and archive boundaries remain intact.                                                                        |
| REQ-002 / AC-002 | Clean script-disabled `npm ci` reproduces the committed lock without rewriting it; a disposable inconsistent manifest/lock pair fails with npm's mismatch diagnostic.                                                                    |
| REQ-003 / AC-003 | Native npm policy admits the selected npm 12.2.0, rejects an available older npm, and expresses future eligibility without pretending an unpublished future CLI was executed. Setup no longer rejects an admitted npm by exact equality. |
| REQ-004 / AC-004 | Existing independent ontology, Canonical VOWL, lint, Markdown, Python, archive, and checked-build oracles pass without weaker assertions or altered semantics.                                                                           |
| REQ-005 / AC-005 | Final ordinary review covers the consolidated candidate; narrow repairs retain prior coverage; signed source commits are published only after blocking local checks and reviews pass.                                                    |
| QA-001           | A clean install on Node 24.21.0/npm 12.2.0 preserves lock identity and rejects a deliberately mismatched fixture.                                                                                                                        |
| QA-002           | An older real npm encounters native eligibility rejection before the fixture command executes; a too-high floor fixture proves native fail-closed enforcement using the available selected CLI.                                          |
| QA-003           | Existing CI steps bootstrap exact npm before root install, disable premature caching, and preserve required successful jobs and failed/skipped rejection.                                                                                |
| QA-004           | Interruption or a failed tool/build leaves a coherent retained candidate and failed evidence; delivery stops until the cause is resolved.                                                                                                |

## Implementation slices and commit points

| Slice                                            | Traceability                    | Proof                                                                                                                                                                                                            | Release and cleanup implication                                                                                                                                                  |
| ------------------------------------------------ | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SLICE-000: Commit the accepted plan              | REQ-005, QA-004                 | Check applicability, clean matching main tips, storage, registry selection, route, literal Markdown formatting/links, and plan-only diff.                                                                        | First signed commit contains this plan alone, before implementation changes. Keep it local until consolidated delivery.                                                          |
| SLICE-001: Reproduce the upgraded install        | REQ-001/002, AC-001/002, QA-001 | Refresh with scripts disabled; inspect exact graph, engines, peers, terms, scripts, and advisories; run clean ci, npm ls, and a mismatch negative control.                                                       | Keep the root manifest/lock as one recovery unit; retain raw selection and graph deltas externally.                                                                              |
| SLICE-002: Admit the npm minimum at setup and CI | REQ-003, AC-003, QA-002/003     | Test native npm policy and CI bootstrap/cache order; remove setup equality rejection; update setup docs; run focused tests and format changed files.                                                             | Preserve exact CI reference and runtime pins. Commit the consolidated implementation after focused proof; no external review of intermediate slices.                             |
| SLICE-003: Qualify, review, and deliver          | REQ-004/005, AC-004/005, QA-004 | Freeze the final commit; run HISEW focused, affected, and full profiles plus missing Python/Markdown checks. Run final ordinary review and scoped dependency assessment; repair findings with narrow follow-ups. | Publish exact signed source commits to the proposed PR branch; wait for automatic required CI; normally merge only when authorized. Retain canonical receipts and task evidence. |

The main agent owns integration and all mutations.
No parallel write tasks or general agent fan-out are needed.
The selected Review Agent owns its final read-only review; a material R2 trigger requires a revised baseline and independent assurance before dependent work.

Use HISEW's actual external evidence root for notes/logs/reviews, native operations for receipts, and identified tool-managed temporary directories for disposable fixtures.
Stage and settle all input writers before final expensive checks.
Use the final verification route's supported handoff; do not rerun successful suites merely to attach optional commit-helper receipts.

## Oracles, recovery, and observation

Native npm owns range enforcement, frozen install, and peer validation; independent literal fixture commands prove whether execution occurred.
Existing tests own ontology/export behavior and the workflow's Bash gate tests own failed/skipped-job rejection.
Build and lint tools own actual diagnostics and outputs; generated outputs are rebuilt through their existing producer, not edited to satisfy tests.
Mocks may represent external failure boundaries but never replace a positive installation, build, or native npm result.

There is no application data or schema migration, backfill, new telemetry, or production rollout.
Observe manifest/lock identities, graph deltas, npm/Node versions, denied scripts, advisories, tool diagnostics, candidate commit, review findings, and real hosted check states.
The owner accepts delivery; source integration is distinct from deployment or live runtime acceptance.

Abort publication for failed blocking local evidence, unresolved review, unexpected graph changes, or candidate drift.
Replan if the current registry identity changes materially, a new engine or peer requirement excludes the pinned runtime, a production dependency changes, rights or security prevent adoption, or correction requires broader configuration or semantic changes.
Retain the smallest discriminating failure; never call pending/skipped hosted work a pass.

After all fixture consumers finish, remove only task-owned disposable fixtures; retain failed receipts, immutable review evidence, and recoverable source history.
Any retained temporary installation must have an owner, purpose, and removal trigger recorded in external task evidence.
