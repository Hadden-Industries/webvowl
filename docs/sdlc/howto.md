# WebVOWL repository SDLC

Use the accepted task and smallest justified R0/R1/R2/R3 route. Read the
[engineering principles](engineering-principles.md) for material work,
[REVIEW.md](../../REVIEW.md) for review, and [adoption.md](adoption.md) for local
activation evidence. SDLC 1.0.0 remains pre-release.

The six complete local skills are available on demand. The repository-adapted TDD
skill is the sole implementation procedure. Use preservation checks for already
working controls and test-first checks for changed executable behavior. Optional
role files never override the user's limits on delegation.

## Set up this checkout

The version files and packageManager field select the runtime versions. To invoke
the selected npm without changing the operator's global installation:

```text
npm exec --yes --package=npm@12.0.2 -- npm run setup:development
npm run check:sdlc
```

Setup validates the selected Node/npm/Python, installs the npm lock with lifecycle
scripts disabled, creates or preserves this checkout's .venv, installs the exact
direct Python requirements, and activates local Codex policy and six SDLC skills.
The native transaction in util/_configuration_transaction.py preserves unrelated
configuration and refuses unowned policy conflicts or changed destinations.

Existing external skill declarations are retained except the superseded external
TDD entry. setup:skills is local-only. An external refresh remains a separately
reviewed operation with its immutable source and pinned CLI prerequisites; an old
floating declaration is not permission to refresh it. The existing WebVOWL MCP
installer remains independent of SDLC setup.

Generated hooks need native exact-definition trust and an applicable trusted
project layer before execution. setup:development and check:sdlc create no desktop
approval request. Preserve the operator's DCG and trust settings. The documented
native `/hooks` interface belongs to a CLI launched in the target checkout; do not
assume the PATH CLI is the same version as the desktop host.

## Start and verify actual work

R0/R1 can use an accepted task/PR brief. Ordinary R2/R3 work needs a previously
accepted baseline. Use the CLI help for the current record and handoff fields:

```text
npm run sdlc -- --help
npm run sdlc -- begin clarify-guide --risk R0 --intent-reference accepted-task-reference --purpose "Describe existing behavior accurately" --no-new-functionality
npm run sdlc -- verify
npm run sdlc -- handoff --help
```

New functionality uses --new-functionality and a completed
--software-selection-reference. Reference presence alone is not research or approval.
Focused verification checks whitespace and generated configuration. Affected/full
verification runs the automatic obligations of components changed since the task's
startingHead, including staged, unstaged and non-ignored untracked inputs. Git owns
path matching locally and in CI; invalid or unavailable bases fail closed.

| Changed input owner | Automatic checks |
|---|---|
| SDLC controls, setup or governance | Python SDLC/setup suites and JavaScript control tests |
| WebVOWL application, Vite/lint inputs or application utilities | Existing npm test and production build, including formatting/lint prechecks |
| Shared package/runtime/check-routing inputs | Union of both owners |
| Ordinary plans and documentation alone | Focused floor and content review |

Use `npm run check:affected -- --base <full-commit-SHA>` outside an active task.
Run through npm so nested commands inherit its selected CLI and Jest environment.
The R1 and elevated routes share the automatic affected-component floor; R2/R3
also need their baseline, independent review and relevant manual/specialist evidence.

## Keep outcome boundaries explicit

WebVOWL retains its root AGPL-3.0-only licence, application module format and owlapi
dependency owner. Existing npm test/build/deploy scripts remain authoritative.
Automated checks do not establish browser interaction, rendering/export semantics,
accessibility, cloud deployment or release acceptance. Carry actual scenarios and
artifacts for changes affecting those behaviors. No deployment runs during setup.

Source/config changes invalidate verification. Use explicit pause/resume and
handoff; retain failed runs under .sdlc/runtime. Follow the
[temporary artefact policy](temporary-artefacts.md) instead of clearing lifecycle
state to manufacture completion. GitHub label setup is the separately authorized
`npm run setup:sdlc:github`; see [GitHub governance](github-governance.md).
