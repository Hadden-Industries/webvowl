# WebVOWL bootstrap verification

WebVOWL base: 28c70c2c6cab04672848521acab24dae7bff99ea. Donor:
ONI 1d352b9040005e144a9fc4a1ac7dd628241e7284. The upstream SDLC is unchanged from
Universal Ontology b3984ffbfe9b38cca7bd4570aeb3f5bc0fa6f20e at source inspection.

Environment observed 2026-09-08: Windows, Node 24.20.0, selected npm 12.0.2 and
Python 3.14.7 in this worktree's .venv. The desktop runs Codex 0.153.4 while PATH
resolves 0.149.1. Operator global npm 11.19.0 is unchanged.

## Baseline and test chronology

- Before adoption: native npm tests passed, 64 suites/585 tests. npm run build
  passed its formatting/lint prechecks and Vite production build.
- Routing RED: the imported ONI selector rejected the WebVOWL application scope;
  23 tests failed and 14 passed. The real CLI ran in a disposable native Git fixture.
- Affected-runner RED: staged, unstaged and untracked application changes launched
  no npm owner. Two additional SDLC fixture failures were setup gaps, not behavioral RED.
- After adaptation: 78 JavaScript control tests passed in five suites, including
  native Git selection, no-root-module-type execution, ignored evidence, invalid
  bases, real npm-process routing and first-failure propagation.
- 94 imported Python SDLC preservation tests passed. The generic transaction
  fixture was adapted to its extracted document boundary rather than importing
  the old MCP renderer. One diagnostic rename mismatch was corrected separately.

## Final qualification

`npm exec --yes --package=npm@12.0.2 -- npm run setup:development` completed:
locked dependencies, this checkout's .venv, six local skills and eight optional
roles were configured. The generated root TOML passed the native published Codex
configuration schema (SHA256 692da7699367f6f4fbbd46c0021278c1311440bcebf0bcb9b836690c05e56196).
Role TOML and hook JSON parsed successfully; no native loading/trust is claimed.

Exact lock comparison confirmed yaml 2.9.0 as the only npm resolution addition.
The separate main checkout's user-owned lock SHA256 remained
e178cc2e8b5e6ac26a7f60e90a272155466144f2f358a18b689677478cae1ffa.

The final `npm run sdlc -- verify` result and exact command counts belong to its
runtime records and the bootstrap PR, which also records CI and publication.
Logs and failures are retained in the ignored .sdlc/runtime/adoption directory;
the pre-adoption logs remain in the originating ONI task's .sdlc/runtime/bootstrap
directory. The task owner retains these inputs through delivery and any follow-up
review, then reassesses them under the temporary artefact policy.

Existing Git-dependency integrity and inflight/glob deprecation warnings are retained.
No unrelated dependency override or upgrade is introduced. A Windows-only skip of
the POSIX execute-mode check is reported separately from passes.

Automated checks do not establish independent review, native security-scan completion,
browser/product acceptance, Stop-hook trust or required-check enforcement. Actual
CI/processed-analysis and publication identities belong to the bootstrap PR/merge
record, rather than a predicted commit ID in its own input tree.

## First CI qualification failures

The initial GitHub application run failed because a clean runner lacked the
existing sibling Universal Ontology corpus; 120 corpus cases were absent and
three input-presence/import assertions failed. The local baseline had used the
pre-existing sibling corpus junction. CI now stages immutable source corpus bytes
in the same layout, with the application tests and oracles unchanged. The source
website inventory copies these static inputs without transforming them.

The Windows control job exposed an existing Brooks activation comparison between
resolved long paths and the runner's RUNNER~1 temporary-directory alias. The skill
directory owner now canonicalizes the repository with Path.resolve before comparing
containment. A new real-filesystem relative-root case reproduced the same identity
bug before the fix; the existing Windows test remains the 8.3-path regression.
Neither containment validation nor test coverage was relaxed. Original failed run
logs remain in .sdlc/runtime/adoption and the PR checks.

## Operational qualification, 2026-09-09

This section supersedes the historical activation gaps above. The owner approved
normal-checkout setup, native trust and bounded acceptance, required-check
enforcement, and the subsequently identified Windows interpreter correction.
SDLC 1.0.0 remains pre-release; deployed=true describes the qualified local adoption.

The native Codex 0.153.4 Windows consumer exposed a real bootstrap defect: the
generated PowerShell body was passed to cmd.exe and exited 1 before evaluating
evidence. The old regression supplied PowerShell itself and missed that boundary.
The corrected regression failed first through cmd.exe, then passed after the
renderer explicitly selected powershell.exe with NoLogo, NoProfile and
NonInteractive. The original body, Stop protocol and 30-second timeout remain.
The test also checks a repository path containing spaces, nested cwd, forwarded
arguments/stdin and both zero and two exit statuses. The upstream consumer contract
is [Codex 0.153.4 command_runner.rs](https://github.com/openai/codex/blob/rust-v0.153.4/codex-rs/hooks/src/engine/command_runner.rs).

Actual native app-server acceptance used the installed desktop executable and
ephemeral text-only turns. No tools or subagents were requested by those turns.
Native hooks/list selects the normal checkout's project definition for both normal
and linked checkout contexts. Its qualified hash is
sha256:19d9746a7770de540be174006f2eaf895e672ee41f355b9f1e1e7888294ca2b8.
The SDLC-worktree Stop blocked missing evidence, then completed with the honest
incomplete-evidence warning; the normal-checkout Stop completed with current
evidence. Native discovery loaded all six local skills in both contexts, and their
project policy loaded without a disabled layer. Eight optional role files are
installed; role execution is not claimed under the no-delegation constraint.
Existing global DCG metadata/trust and unrelated user/project configuration were
preserved.

The normal checkout was fast-forwarded using native Git autostash. The user's
fast-uri 3.1.7 version, registry URL and integrity remain uncommitted; other lock
entries match updated main. setup:development completed through selected npm
12.0.2 with Node 24.20.0 and Python 3.14.7. After the interpreter correction,
`npm exec --yes --package=npm@12.0.2 -- npm run sdlc -- verify` passed there:
109 Python SDLC tests, 29 setup tests with one Windows-inapplicable POSIX skip,
78 JavaScript control tests, all 69 JavaScript suites/663 tests, formatting/lint,
and the production build. The affected runner selected both owners because of the
preserved lockfile edit. This is automated verification, not browser acceptance.

The required-check configuration was applied and independently read back from
GitHub: SDLC controls, WebVOWL application, validate and CodeQL, bound to their
qualified App IDs, with up-to-date and administrator enforcement. Force pushes and
deletion are disabled; mandatory approvals remain zero. The Phase 19A tag ruleset
is unchanged. Prior merge 38f727777f247a7fa9e909bd98cd592b60eb45e7 passed all three
main workflows. The final correction PR and its merge own subsequent CI identities.

Retained raw evidence is under the SDLC worktree's .sdlc/runtime/readiness:
native-stop-missing-2.json records the actual failed hook; native-stop-missing-3.json
and native-stop-current.json record passing native execution; the earlier
native-stop-missing.json is a preparatory metadata-check failure before a model
turn. stop-shell-diagnostic.json retains the minimized failing/candidate comparison.
native-corrected-trust-and-skills.json and main-branch-protection.json retain native
discovery/configuration readback. Main's full command transcript and identity are
in its .sdlc/runtime/verification/affected.json and immutable runs directory.
The task owner retains these records and lock-preservation evidence through final
delivery and follow-up review; reassess at that checkpoint under the temporary
artefact policy. The requested donor-repository diagnosis is retained separately
in donor-hook-diagnosis.json; no donor configuration was changed.
