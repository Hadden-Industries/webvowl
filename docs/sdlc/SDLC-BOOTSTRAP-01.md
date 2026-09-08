# WebVOWL SDLC bootstrap checkpoints

The accepted [adoption plan](../plans/2026-09-08-webvowl-sdlc-adoption.md) owns scope,
configuration approval, implementation and delivery gates. Reuse that record rather
than creating another baseline or synthetic pilot for this R1 integration.

The isolated branch starts at 28c70c2c6cab04672848521acab24dae7bff99ea. Preserve main's
pre-existing lockfile edit and other worktrees. The user approved scoped configuration
changes, signed commits, pushes and merge. No subagent, live security scan, host trust,
global tool installation or WebVOWL deployment is part of this bootstrap.

[verification.md](verification.md) records actual local checks. The bootstrap PR owns
the reviewed commit, GitHub runs, CodeQL analyses and merge result. After merge,
verify main's actual runs without overwriting the user's dirty local checkout.
[adoption.md](adoption.md) records host acceptance and first-real-PR linkage gaps.
