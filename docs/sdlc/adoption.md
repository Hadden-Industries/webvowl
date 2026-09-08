# WebVOWL SDLC adoption

Authority: [the approved adoption plan](../plans/2026-09-08-webvowl-sdlc-adoption.md)
and the owner's explicit approval of its configuration changes, signed commits,
pushes and merge for WebVOWL SDLC only. This is repository integration, not a
WebVOWL product release or an SDLC version/status promotion.

## Source and adaptation

The target is Universal Ontology's consolidated SDLC, reusing the portability work
from merged [ONI PR 2](https://github.com/MaksymShostak/oxygen-not-included/pull/2).
Exact donor files and hashes are in [.sdlc/UPSTREAM.json](../../.sdlc/UPSTREAM.json).
The source MIT notice and the adapted TDD skill's licence/provenance are retained.
SOURCE_PACKAGE.json records historical source identity, not WebVOWL deployment.
The root AGPL-3.0-only licence and application dependency pins remain unchanged.

Preserved: state engine, schemas, Stop protocol, six full skills, eight optional
roles and tested configuration transactions. WebVOWL adaptations:

- New JavaScript controls use util/*.mjs; no root module-type change or new test runner.
- Existing npm test/build owners and locked application dependencies are retained;
  yaml is the only added npm development dependency.
- The generic transaction is extracted into util/_configuration_transaction.py,
  shared by SDLC configuration and skill activation. The existing GitHub/MCP installer
  remains unchanged; ontology-specific installers are not imported.
- Local-only skill activation preserves the external lock and Brooks invocation
  policy, removing only the external TDD declaration superseded by the complete local skill.
- Native Git routes SDLC/application/shared inputs to their real npm owners both
  locally and in CI. Runtime evidence is ignored; invalid bases fail closed.
- Native GitHub forms, one PR template, least-privilege workflows, weekly grouped
  Dependabot updates and advanced Actions/JavaScript/Python CodeQL replace no application owner.

## Verification and review

[verification.md](verification.md) records the observed local results. The bootstrap
PR and GitHub run/analysis records own publication evidence. Main's pre-existing
lockfile edit and other worktrees are outside this task's ownership.

The owner retained the no-subagents limit. Review is a same-session diff, principles
and workflow-boundary review plus deterministic checks and GitHub CI. It is not
independent human/model review or a live Codex Security scan. The explicit bootstrap
merge authority applies only to this adoption.

## Lessons carried forward

Universal Ontology PRs [18](https://github.com/Hadden-Industries/universal-ontology/pull/18)
and [19](https://github.com/Hadden-Industries/universal-ontology/pull/19) establish
the prior activation/recovery lessons: check CodeQL mode before rollout, verify
processed analyses and post-merge runs, preflight native scanner inventory/artifact
access before scans, and bound initial small specialist reviews to ten minutes with
at most two minutes total troubleshooting and one recovery per distinct failure.
Prior scan IDs and host approvals are historical evidence, not authority for new scans.

Keep native command protections. This task observed a DCG rejection of a complex
PowerShell filesystem command and recovered using simple literal commands without
changing DCG or trust. That observation is not proof of every command surface.
The copied DCG assets retain their upstream licence, including its non-standard
OpenAI/Anthropic rider; no binary or new operator configuration is installed here.

## Activation boundaries

The running desktop executable reports Codex 0.153.4; PATH resolves a separate
0.149.1 CLI. Validate configuration against the native schema and report host loading
separately. Setup does not create a pending desktop hook approval. Native Stop-hook
loading/trust for this WebVOWL worktree remains unverified; user-level trust is not
changed. Direct npm verification remains usable. See the
[native hook documentation](https://learn.chatgpt.com/docs/hooks).

GitHub default CodeQL was not configured at preflight, so no default/advanced mode
transition is required. Main was unprotected; the existing Phase 19A tag ruleset is
preserved. Trusted-base PR linkage needs this bootstrap on main and qualification
on subsequent real work before it can be required. No synthetic pilot is created.
PACKAGE_STATUS.json remains 1.0.0 pre-release with deployed=false while host acceptance
is unverified. Successful repository integration does not erase that distinction.
