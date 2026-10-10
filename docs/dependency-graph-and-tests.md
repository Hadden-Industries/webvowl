# Dependency graphs and affected Jest tests

These opt-in developer commands use the installed dependency-cruiser and Jest.
Ordinary `npm test`, `npm run check`, specialized architecture suites and hosted checks keep their independent scope.
A full Jest result is not full product assurance: Python, Markdown, build, browser and external corpus obligations remain separate.

```powershell
npm run graph:dependencies -- --output C:/new-external-directory/webvowl-graph
npm run check:affected -- --base <full-commit-object-id> --list
npm run check:affected -- --base <full-commit-object-id> --path src/example.js --list
npm run check:affected -- --base <full-commit-object-id> --shadow
npm run check:affected
```

Graph output requires a new external directory.
Existing destinations and linked parents are refused.
The command reserves the requested directory exclusively, prepares its contents privately, then atomically publishes the complete `bundle/` subdirectory.
That bundle contains native JSON, overview/runtime/tests Mermaid views, native policy findings, separately labelled declared relations and provenance.
All views bind the same JSON digest.
An interrupted reservation without `bundle/provenance.json` is incomplete; retain its `.incomplete-*` diagnostics.
Native policy errors retain diagnostics and return nonzero.
This is a Node/import graph; Vite transforms and browser resource loading are not represented as native import edges.

The complete graph includes disconnected authored application, utility, workspace, conformance and test modules.
Installed vendor internals are leaves.
Each source snapshot resolves `vowl` through its own package exports before installed vendor directories.
Historical source is read from Git blobs into an owned temporary directory; historical code, config, hooks and dependency installations never run.

Supply an immutable full commit ID representing the entire intended comparison.
Intermediate implementation commits do not authorize moving that comparison forward.
Selection unions committed, staged, unstaged and untracked changes; renames retain both endpoints and staged intent survives a later working-file revert.
Additional `--path` arguments only widen that envelope.
Paths are literal, including spaces, Unicode and regular-expression punctuation.

`--list` independently discovers the full current Jest inventory and runs no test modules.
The report explains selected whole files, native reachability, activated relations and full fallback.
A missing/invalid baseline, incompatible policy or controls, resources, deleted tests, uncertain loading boundary, unknown root, unresolved graph, no changes or empty reachability uses full current inventory.
Unsafe inventory, configuration, path or candidate drift fails nonzero.
A baseline predating this feature normally falls back because its policy differs.

Execution uses Jest's native JSON configuration, VM module flags, two-worker default and exact whole-file paths.
Arbitrary forwarded Jest options are not accepted.
The repository's selected Python environment supplies a small native containment adapter: Windows uses a non-breakaway job assigned before the suspended Jest process starts; Linux uses a private child subreaper and pidfds.
Unsupported or unavailable containment fails before a successful result can be reported.
This helper does not substitute for repository Python qualification.

Shadow mode discovers full inventory again independently, runs selected files, then runs the full inventory and compares outcomes for the selected files.
Any full failure, selected failure, missing result or disagreement remains nonzero.
Duplicate assertion names retain ordered multiplicity, and skips/todos remain distinct.
When the selection is already full, one full execution is honestly reported as fallback; there is no fabricated second-run agreement.

Selective execution supports Windows and Linux with the selected repository Python environment.
Platform containment probes run in the existing Python matrix, including an actual native ESM Jest run.
Use shadow mode to qualify unfamiliar changes and retain any disagreement as a failed result.
Ordinary full Jest is the immediate recovery route.

Runtime results retain raw stdout/stderr, Jest JSON, native process facts, selected paths, outcome comparison and timings in the reported external result directory.
They are operator provenance, not authenticated GitHub evidence or HISEW receipts.
Keep failed runs and incomplete cleanup evidence until their consumers release them.
Do not overwrite an earlier bundle or delete a shared temporary/evidence root.
Candidate content, index and HEAD are checked for drift around the operation; changed inputs require a fresh run.

Initial limits are 8,192 repository records, 4,096 authored modules, 8 MiB per source, 64 MiB materialized source, 16 MiB graph output, a 30-second analyzer deadline with a 256 MiB V8 old-space limit, 120-second discovery, 600-second test execution, 64 MiB combined result/stream capture, and five seconds for cleanup.
The V8 heap limit is not a native RSS limit.
Exceeding a bound never yields a truncated successful result.
Measure selection, execution and total cost against an independent full run; selected-file count alone is not a speedup claim.

The impact registry in `.test-impact.json` is a reviewed completeness boundary.
New workers, generated programs, source readers, filesystem resources or computed loads need a declared relation with source evidence and an independent regression, or conservative full disposition.
Do not add a broad exception to improve timing.
Preserve the existing specialized architecture assertions as independent oracles.

The accepted design is recorded in the [implementation plan](plans/2026-10-11-dependency-cruiser-integration-implementation-plan.md).
Native API composition was informed by Markdown Quality at `0fac1db72856c7579625562c4a145f0801b2fb80`; the maintained adapter is AGPL-3.0-only.
Jest results and flags follow its [public CLI contract](https://jestjs.io/docs/cli).
Windows ownership follows Microsoft's [job object contract](https://learn.microsoft.com/en-us/windows/win32/procthread/job-objects).
