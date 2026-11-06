# Proportional continuous integration

Pull requests and pushes to `main` compare the event's base commit with the checked-out revision.
Changes limited to root Markdown files and Markdown under `docs/` use the documentation path.
`AGENTS.md` is repository policy and always selects full checks.
Any other changed path, including a deleted source file or a file renamed from source into documentation, selects full checks.
Missing history, invalid event data and manual runs also select full checks.

For example, editing only `README.md` and `docs/webmcp.md` selects documentation checks.
Adding a change to `src/`, a dependency lockfile or a workflow selects full checks instead.
A docs-only pull request still shows successful required statuses for `WebVOWL application`, `Dependency review` and `CodeQL gate`, while application, Python tooling and CodeQL analysis jobs are skipped.

Documentation-only and mixed changes run the same Linux Markdown job against the complete authored corpus.
The job selects the managed npm version and installs the root lock with `npm ci --include=dev --ignore-scripts`, then runs `npm run check:docs` and `npm run test:markdown` in that order.
The public package command owns selection, formatting checks, GFM linting, local links, result semantics and bounded checker execution.
Tracked Markdown is reconciled through the same selector, including missing selected documents.

Full checks retain application tests and builds, the Ubuntu and Windows Python tooling jobs, and checks of all tracked authored documents.
For fresh runs, the required `WebVOWL application` status accepts skipped application and Python jobs only when scope selection succeeded and explicitly selected the documentation path.
Failures, cancellations and unexpected skipped jobs fail that status.

Normal merges to `main` can reuse an immutable, successful same-repository PR receipt when the tested tree, parents, workflow, check scope and hosted identity match.
The verifier requires the complete successful PR job inventory, including JSON quality on Ubuntu and Windows.
With verified reuse, the application, Python, Markdown and JSON jobs are skipped on the merge; the required gate checks the retained provenance and expected skips.
Missing, invalid or expired evidence falls back to fresh execution, and JSON still runs on documentation-only PRs and manual runs.
Corpus storage checks continue to execute on every route.

The `Dependency review` status remains present for documentation-only pull requests and reports that dependency analysis is not applicable.

CodeQL uses the same classification and skips analysis for documentation-only changes.
Scheduled and manual runs always analyze all three configured languages.
The required `CodeQL gate` status accepts a documentation-only skip; otherwise, it requires successful analysis and, on pull requests, the external CodeQL security verdict for the current head commit.
Analysis waits for uploaded results to finish processing before the gate reads that verdict.
Missing results, blocking alerts, failed analyses and API errors prevent the gate from passing.

Local `npm run check:docs` checks the same full authored scope using the root-installed Markdown Quality package.
The root manifest declares `@hadden-industries/markdown-quality` with the `>=3.0.0` minimum; `package-lock.json` freezes the core and matching optional platform packages.
There is one npm dependency graph for application and tooling dependencies.

Markdown Quality uses `authored-gfm@2` defaults.
`.markdown-quality.json` supplies only schema-3 ownership exclusions for preserved reference material and historical evidence.
Git and Prettier ignore files serve their own tools and have no Markdown-selection authority.
Use `npm exec -- markdown-quality inspect --root . --json` to review the current selected and omitted paths; no fixed historical corpus count defines acceptance.

`npm run format:docs` writes formatting and accepts literal paths after `-- --`, for example `npm run format:docs -- -- README.md`.
Preview with `npm exec -- markdown-quality format --dry-run --root . -- README.md`.
The write script already supplies `--write`; a preview must use the direct command so it supplies only `--dry-run`.
Both preview and selected-path checks describe their selected inputs; complete authored-scope cleanliness requires the complete `npm run check:docs` verdict.

Commands use the installed public CLI, with finite package execution defaults and the repository execution-profile override.
Three root npm consumer checks cover maintained selection, independently expected preserved records, literal bytes, read-only checks and native exit propagation.
`format:check` delegates Markdown quality to the canonical `check:docs` command.
The documentation gate checks repository content; it does not produce an archive-based trusted qualification receipt.
The retired manual archive qualification caller has no role in CI evidence reuse, which remains owned by the ordinary application workflow and its immutable PR receipt verifier.
Historical qualification records retain their original package, archive and workflow identities.
