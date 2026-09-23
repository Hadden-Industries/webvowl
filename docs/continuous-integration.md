# Proportional continuous integration

Pull requests and pushes to `main` compare the event's base commit with the checked-out revision.
Changes limited to root Markdown files and Markdown under `docs/` use the documentation path.
`AGENTS.md` is repository policy and always selects full checks.
Any other changed path, including a deleted source file or a file renamed from source into documentation, selects full checks.
Missing history, invalid event data and manual runs also select full checks.

Documentation-only changes run one Linux Markdown job with only Prettier and Snapper installed from the existing lockfiles.
Both tools check only changed documents that still exist, using the existing authored-document exclusions.
Paths are passed literally, so spaces and brackets do not become shell syntax or glob patterns.
Deleted documents require no content check.

Full checks retain application tests and builds, the Ubuntu and Windows Python tooling jobs, and checks of all tracked authored documents.
The required `WebVOWL application` status accepts skipped application and Python jobs only when scope selection succeeded and explicitly selected the documentation path.
Failures, cancellations and unexpected skipped jobs fail that status.
The `Dependency review` status remains present for documentation-only pull requests and reports that dependency analysis is not applicable.

CodeQL uses the same classification and skips analysis for documentation-only changes.
Scheduled and manual runs always analyze all three configured languages.
The required `CodeQL gate` status accepts a documentation-only skip; otherwise, it requires successful analysis and, on pull requests, the external CodeQL security verdict for the current head commit.
Analysis waits for uploaded results to finish processing before the gate reads that verdict.
Missing results, blocking alerts, failed analyses and API errors prevent the gate from passing.

Local `npm run check:docs` retains its existing full-document behavior.
`node util/checkDocumentation.mjs` uses GitHub event data in CI and checks all tracked authored documents when no usable comparison is available.
The scope selector and documentation installation helper require no new dependencies or lockfile changes.
