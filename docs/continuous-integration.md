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
The job acquires the isolated locked Markdown Quality graph with lifecycle scripts disabled, then runs `npm run check:docs` and the consumer integration probes.
The public package command owns selection, formatting checks, GFM linting, local links, result semantics and bounded checker execution.
Tracked Markdown is reconciled through the same selector, including missing selected documents.

Full checks retain application tests and builds, the Ubuntu and Windows Python tooling jobs, and checks of all tracked authored documents.
The required `WebVOWL application` status accepts skipped application and Python jobs only when scope selection succeeded and explicitly selected the documentation path.
Failures, cancellations and unexpected skipped jobs fail that status.
The `Dependency review` status remains present for documentation-only pull requests and reports that dependency analysis is not applicable.

CodeQL uses the same classification and skips analysis for documentation-only changes.
Scheduled and manual runs always analyze all three configured languages.
The required `CodeQL gate` status accepts a documentation-only skip; otherwise, it requires successful analysis and, on pull requests, the external CodeQL security verdict for the current head commit.
Analysis waits for uploaded results to finish processing before the gate reads that verdict.
Missing results, blocking alerts, failed analyses and API errors prevent the gate from passing.

Local `npm run check:docs` checks the same full authored scope.
`.markdown-quality.json` is the only Markdown policy authority: its schema 2 exclusions explicitly preserve the former omissions of the `docs/owlapi-js/`, `docs/sdlc/`, `docs/reviews/` and `docs/evaluations/` archives.
Git and Prettier ignore files continue serving their own tools and have no Markdown-selection authority.
The migration retained all 69 previously selected document paths and includes `AGENTS.md` at the owner's request, bringing the corpus to 70 documents.

The isolated graph in `tooling/markdown/` installs committed core and Windows/Linux archives from producer source [`47febbe1b6f3282814e77db7ea13eac72b4928ed`](https://github.com/Hadden-Industries/markdown-quality/tree/47febbe1b6f3282814e77db7ea13eac72b4928ed).
The lockfile records their exact integrities; the core archive carries its clean source/tree/producer-lock identity and the AGPL source and notices.
Package version `1.0.3` alone does not identify this source adoption.
Commands use the supported public package bins and API/schema exports rather than private implementation entry points.

`.markdown-quality-execution.json` supplies finite local and hosted bounds: six samples, 30 seconds per checker, a 180 second window, a 1024 MiB memory limit, 128 MiB Node/worker heaps and exact runtime declarations.
Windows observes cumulative Job peak committed bytes; Linux samples process-group RSS, so their resource measurements have different boundaries.
Six passing samples describe the observed window and do not guarantee future tail performance.

The manually dispatched trusted qualification caller uses the reusable producer workflow pinned to that same full source SHA.
It accepts distinct full trusted and candidate commits and processes candidate content as data through the installed producer-owned staging and observer contracts.
The owner must first accept the exact reviewed trusted policy/profile/lock/archive tuple, then accept the attributable positive and adversarial hosted results before normal integration.
An ordinary green CI status is not that trust decision.
No consumer checker, staging implementation, observer or compatibility fallback is retained.
