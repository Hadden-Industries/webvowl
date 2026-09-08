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
