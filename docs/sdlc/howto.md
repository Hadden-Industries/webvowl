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

On Windows, Codex launches command hooks through cmd.exe; the generated Stop
command explicitly selects PowerShell before running its existing body. Qualify
through the native host, since directly invoking the body in PowerShell misses
that integration boundary. In a linked worktree, native discovery may select the
normal checkout's hook file. Inspect the actual source/hash in each context; the
command resolves the session's Git root and uses that checkout's evidence.

The [local adoption record](adoption.md#operational-activation) identifies the
qualified host and checkouts. Hooks still require review after their definition
changes. An empty inventory, installed files or a trusted hash alone is not evidence
that the Stop gate executed.

## Inspect the runtime before native hook qualification

After installing/updating Codex, and before qualifying hooks in a selected host,
run the read-only runtime check through the existing npm entry point:

```text
npm run check:sdlc -- --runtime
npm run check:sdlc -- --runtime --codex-executable "<absolute Codex executable path>"
```

The first command selects the PATH CLI; the second inspects the named launcher or
binary. Use the running host's actual executable when qualifying that host, and
resolve it again after application updates. A CLI pass does not describe a different
desktop process. Do not persist an application bundle's version-specific path as a
general PATH entry.

The report includes the launcher, native executable/version/install method, stable
enabled hooks, native update advice and scoped failures. Native doctor owns
installation/configuration/update diagnostics; native features list owns capability
recognition and effective state. No repository version comparator or release pin
forces independently updated frontends to match.

Exit zero means the selected runtime prerequisites passed. The native doctor's
overall status and other finding IDs remain visible, including a noninteractive
terminal failure. Update warnings require maintenance through the reported installer;
the prerequisite result is not a freshness or whole-host-health certification.
Hook acceptance stays not-assessed: inspect the exact definitions and project trust
through the target host's native interface.

This opt-in check invokes native diagnostic commands with a 30-second limit each.
Codex doctor can read local state and probe provider/update endpoints; it submits no
model task here. The repository check installs nothing, changes no trust/configuration
and writes no report file. Capture its output in ignored task evidence if needed.
Ordinary check:sdlc and CI remain independent of a logged-in Codex installation.

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

## Application corpus prerequisite

The existing corpus suites resolve ../universal-ontology/dist from the WebVOWL
checkout. CI checks out Universal Ontology at immutable commit
b3984ffbfe9b38cca7bd4570aeb3f5bc0fa6f20e beside WebVOWL and stages its external,
iso, iso-iec and universal source directories into that dist layout. These are the
static bytes copied by the source's native website inventory; no source code is
executed, generated oracle output changed, network fallback added or test skipped.
The referenced repository retains its licence and per-ontology source notices.
Local full corpus verification likewise requires this sibling corpus. A clean
checkout without it must report the missing input rather than a reduced pass.

## Accepted baseline representations

R0/R1 need no artificial Issue or separate baseline. For normal R2/R3 work, use a
previously accepted baseline supported by the actual trusted policy consumer.
The Issue-snapshot route retains its native capture, schema, prior-baseline and
live Issue linkage requirements. The committed-plan route uses the unchanged
accepted UTF-8 Markdown file under `docs/plans/`, already present as a regular
file in the PR's trusted base, with an inspectable owner decision bound to that
exact content. It does not require inventing an Issue for previously accepted
work. A plan file, quoted approval or matching checksum does not authenticate
acceptance. Preserve the selected risk class and required verification profile.
The owner-approved bootstrap remains separately authorised; neither route creates
an approval for its own implementation.

## Independent executions and integration

Use a separate physical Git worktree for each independent implementation.
One checkout has one active execution, including while that execution is paused.
Separate logical files within a shared checkout do not isolate its Git index,
active task or verification records. Coordinated work within one execution is
still one execution; this does not prohibit ordinary subordinate test processes.

In the existing task or PR record, identify the implementation owner, accepted
intent/baseline, actual worktree, branch or detached HEAD, current candidate and
owned change scope. For a dirty candidate, retain the relevant input identity as
well as HEAD. Use native Git path resolution; do not infer per-worktree paths
from a directory name. Keep sensitive locators in the approved restricted record.
No new task database or active-state metadata migration is required.

Before relying on another execution, record material shared contracts, dependencies,
shared mutable resources and the integration owner. Prefer native isolation for
mutable environments, outputs and endpoints. Separate worktrees do not isolate
ordinary Git refs/configuration or every external resource. Coordinate the actual
shared mutations; do not pause unrelated work merely because another task is active.

At integration, record the actual input revisions and combined target, resolve
semantic overlap as well as textual conflicts, and run the affected consumer
checks and required final profile on that target. Preserve prior evidence with its
original branch-local scope. A clean merge is not an integration verdict.
Changed controls or accepted requirements require their actual owner decision;
do not edit old digests or refresh a baseline merely to restore passing status.

A source-only change within unchanged scope normally needs fresh verification,
not a new task. Ordinary pause/resume preserves scope while re-establishing work
against explicitly accepted current controls. For an accepted scope change, pause
the execution and use `resume --amend-scope` with `--decision-reference`, `--risk`,
`--intent-reference`, `--purpose`, an explicit functionality declaration, and the
applicable `--baseline` and `--software-selection-reference`. For example,
`--no-new-functionality` declares a correction; it must not conceal a new capability.
R2/R3 still require a previously accepted committed baseline. The native consumer
checks references and baseline identity; it does not authenticate owner acceptance.

Amended resume retains the original starting revision, archives the previous
record and proposed replacement, records predecessor lineage and allocates a new
task ID. Old verification stays historical and cannot satisfy the new route.
Validation failures leave existing state untouched. A `resume-prepared` history
record may survive a failed final publication; inspect active state before retrying
and do not treat preparation alone as a completed transition. No direct runtime
rewrite, invented completion or risk downgrade substitutes for an owner decision.

A pause must identify an unmet dependency, required unavailable capability, decision
or separate authorization. Retain consumers and resource-disposition references
in the existing handoff; initial task creation or implementation handoff does not
authorize worktree removal, merge, deployment or publication.

## Verification receipt and text contracts

The repository launcher selects Python UTF-8 mode while preserving an explicit
caller `PYTHONIOENCODING`. Human diagnostics escape unsupported console glyphs;
Issue JSON and command evidence are decoded strictly as UTF-8. Snapshot capture
preserves the Issue body's Unicode and line endings without repairing old text.

Each verification attempt first replaces its current profile receipt with a
non-passing pending record. Version 3 receipts live at
`.sdlc/runtime/runs/<taskId>/<runId>.json`, with an identical current copy at
`.sdlc/runtime/verification/<profile>.json`. Command bytes are retained alongside
the run in `<runId>/commands/0001.output.bin` and subsequent ordinal files.
Results and raw bytes are checkpointed before decoding or console presentation.
The gate requires matching receipts, current inputs, the exact configured checks,
and complete captured, decoded and presented successful results. Historical
version 2 receipts remain historical evidence; run fresh verification to qualify.

Use one coordinated verifier per checkout. After an interrupted attempt, confirm
that its producers have stopped before retrying; the next attempt gets a new ID.
`--keep-going` continues ordinary check failures, not broken recording or reporting.
A timeout stops the direct child; it does not prove every descendant has stopped.
If the first pending receipt cannot be written, no check runs, but an older receipt
may remain on disk. Retain that recording blocker and run a fresh attempt after
restoring storage; do not use the old receipt to claim that attempt passed.
Local atomic replacement is not a power-loss backup or an authenticated ledger.

### Competing or interrupted task starts

Initial task publication is exclusive within the physical checkout. An occupied
or paused task is not overwritten. Inspect the reported established task before
continuing; independent work belongs in its own authorized worktree. A command's
nonzero exit does not prove that no task was created: publication can succeed
before a later output or private-temporary-name cleanup failure.

The complete active record is the ownership marker. A preparation file that was
never published is not an active lease. Preserve relevant failed-start material
and inspect the actual state; do not automatically publish an old candidate,
retry a collision, or take over using elapsed time or a process identifier.
Existing empty, malformed or unsupported active state requires an explicit
state decision and must not be treated as idle or cleared to bypass verification.

The implementation's private staging name may temporarily refer to the same file
as the published active record. It is not an independent backup and must never
be edited. If its supported cleanup is blocked, retain its exact location and
escalate under the temporary-artifact policy; do not remove active ownership.
An unsupported publication capability remains an explicit setup/design decision,
not permission to substitute a weaker copy or replacement operation.

## Resource disposition after implementation handoff

Use [the temporary-artefact procedure](temporary-artefacts-howto.md) when task-owned
resources survive a handoff. The coordinator records the owner or explicit hold,
remaining consumers, preserved evidence, next actor and reassessment event in the
existing task/handoff channel. The actual preservation copy must outlive the
resource being considered. Routine scratch removed in its creating task requires
no additional resource record.

The metadata-only command is
`npm run sdlc -- record-resource-disposition --input <contained-json-file>`.
It writes a new disposition record under the coordinator's existing handoff
store; it does not begin a new implementation, modify the active pointer, change
verification evidence, approve disposal or execute a recorded command. Its input
and stored format use `.sdlc/schemas/resource-disposition.schema.json`.

`npm run sdlc -- status` returns the documented versioned JSON envelope with the
active task and retained resource obligations, including when no active task
exists. This replaces the earlier flat active-task output; consumers must use
the `active` field and explicit read state. Machine consumers use the silent npm
form or direct existing Node entry so launcher messages are not mistaken for
JSON. A complete status read can still show
retention or operator work. A partial read is not evidence of an empty resource
set, and a successful status command is not a verification or release verdict.

Keep the native `handoff` evidence reference linked to the actual retained task
summary and resource decisions. Do not remove active state manually to suppress a
hook, and do not keep it artificially active merely to remember a cleanup
obligation. Existing verification freshness and bounded Stop behavior are
unchanged. A recorded eligibility assessment is not permission to delete;
follow the existing native Git/operator procedure after fresh inspection.

## Check the next execution boundary

Before expensive qualification, use the existing task/PR record to establish
only the prerequisites the next step needs: actual acceptance and baseline
compatibility in the trusted consumer; required runtimes; native security
inventory and artifact-writer coverage when applicable; and the dependency gate's
actual threshold, scopes and unresolved dispositions. Reuse still-current native
evidence. Record `ready for the stated next step`, `blocked`, `unknown/unavailable`
or `not applicable with reason`, with a next actor for gaps. This is not a new
universal dossier, scanner, installer or product-approval gate. Continue independent
authorised work that does not depend on a blocked boundary.

A local preflight may invoke the existing validator from an independently trusted
policy checkout using a retained native PR input snapshot and its existing
read-only API interface. Label that input as local preflight, not a delivered
GitHub event. Before a PR exists, prospective fixtures establish compatibility
only. No candidate policy runs with the trusted workflow's credentials.

At push/PR handoff, read the actual PR base/head and the relevant workflow event,
run, attempt and every applicable job. Distinguish the policy revision executed
from the candidate revision and any synthetic merge tested. Read a failing job's
native result, not only an aggregate or old PR description. Required skipped work,
missing logs and inaccessible enforcement settings remain explicit gaps.

Landing new trusted policy requires a new qualifying event whose actual policy
checkout is verified. Re-running an older workflow retains that event's original
SHA/ref; it does not automatically adopt current default-branch policy. Do not
create meaningless commits, false events or a candidate-policy fallback to turn
an old check green. Baseline linkage, product verification, human acceptance and
release/publication authority remain separate conclusions.

## Plan the next useful checkpoint

Apply [execution cadence and evidence placement](proportional-workflow.md#execution-cadence-and-evidence-placement)
in the existing task. `verify --profile focused` is narrower evidence, not a risk
amendment or a substitute for the required final profile. Inspect what the actual
configured commands execute; the focused profile does not automatically contain
every behavioral test, and a profile named full does not imply every release job.
Use the supported direct test runner for a slice where needed and retain its real
output without fabricating a native profile receipt.

Complete intended tracked summaries, tests and approved configuration before the
final freeze. Record ensuing results outside those inputs. A tracked edit or a
commit after verification still changes the applicable identity; follow the
current freshness gate and permitted Git sequence rather than refreshing digests.
Operational progress cannot rewrite accepted requirements, active state or native
receipts. When a current task needs an unsupported scope/risk transition, retain
its state and obtain an explicit supported decision; do not fake completion.
