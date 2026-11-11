# Continuous integration

## Select the runtimes

Routine CI and qualification use the exact Node reference in [`.node-version`](../.node-version).
The npm minimum in [`devEngines.packageManager`](../package.json) also supplies the exact npm reference through [the runtime selector](../util/runtimeTargets.mjs).
CI installs and verifies that npm selection before project commands; update the owning declaration once rather than copying a pin into workflows.

For local work, choose a stable Node release supported by the installed npm and locked dependencies, and an npm meeting the manifest's minimum.
Setup checks those requirements without requiring Node to equal the CI reference.
Python keeps its separate minimum/reference in [`.python-version`](../.python-version).

## Determine which checks apply

For pull requests and pushes to `main`, the [scope selector](../util/selectCiChecks.mjs) compares the event's base commit with the checked-out revision.
Changes limited to root Markdown and Markdown under `docs/` use the documentation path.
A change to `AGENTS.md`, any other changed path, a manual run, or an unavailable comparison triggers full checks.
A source file renamed into documentation still counts as a source change.

| Check                      | Fresh documentation-only run | Fresh full run     |
| -------------------------- | ---------------------------- | ------------------ |
| Markdown                   | Ubuntu                       | Ubuntu             |
| JSON quality               | Ubuntu and Windows           | Ubuntu and Windows |
| Corpus storage             | Ubuntu                       | Ubuntu             |
| Python tooling             | Skipped                      | Ubuntu and Windows |
| Application build and Jest | Skipped                      | Ubuntu             |

The application job waits for corpus storage, builds with the normal formatting and lint checks, runs Jest, and checks the production bundle budgets.
The required `WebVOWL application` status accepts skipped application and Python jobs when scope selection explicitly chooses the documentation path.
Failures, cancellations, and unexpected skips fail the gate.
`Dependency review` reports that analysis is inapplicable on the documentation path.

## Check Markdown

| Task                                | Command                                                               |
| ----------------------------------- | --------------------------------------------------------------------- |
| Check all authored Markdown         | `npm run check:docs`                                                  |
| Inspect selected and excluded paths | `npm exec -- markdown-quality inspect --root . --json`                |
| Check one path and emit JSON        | `npm run --silent check:docs -- --json -- README.md`                  |
| Preview formatting for one path     | `npm exec -- markdown-quality format --dry-run --root . -- README.md` |
| Write formatting for one path       | `npm run format:docs -- -- README.md`                                 |

The root npm lock installs Markdown Quality 3.0.1 and its matching native package alongside the other development dependencies.
The Linux job installs the root lock with `npm ci --include=dev --ignore-scripts`, runs `check:docs`, then runs `test:markdown`.
The scope probe checks that maintained paths are selected and tracked preserved records are explicitly excluded.

The checker uses `authored-gfm@2` defaults for formatting, GFM diagnostics, and local link and fragment checks.
[The Markdown policy](../.markdown-quality.json) uses schema 3 to exclude preserved reference material and historical evidence.
Git and Prettier ignore files govern their own tools.
For a result covering the whole authored scope, run `npm run check:docs`.

The write script already supplies `--write`.
Use the direct `--dry-run` command to preview.
From outside the checkout, run `npm --prefix <absolute-repository-root> run check:docs`.

## Check JSON and corpus storage

| Task                                  | Command                         |
| ------------------------------------- | ------------------------------- |
| Check the complete owned JSON scope   | `npm run check:json`            |
| Stream version-5 NDJSON events        | `npm run --silent inspect:json` |
| Run the focused WebVOWL policy probes | `npm run test:json`             |
| Verify corpus bytes and locators      | `npm run check:corpus-storage`  |

The JSON job runs on Ubuntu 24.04 and Windows 2025.
It runs the focused probes, builds with `npm run build:bundle`, then invokes [the post-build verifier](../util/verifyGeneratedRepositoryJson.mjs).
Run those steps from the repository root to reproduce the JSON job locally.

```sh
npm run test:json
npm run build:bundle
node util/verifyGeneratedRepositoryJson.mjs
```

The verifier uses one JSON Quality session to check owned physical files and bundled JSON, require the generated data and Vite asset manifest under `deploy/`, and confirm that the check observes each bundled JSON path in the storage inventory exactly once.
A successful run requires a complete repository result.
The focused probes cover presentation ownership, scoped NFC exemptions, and the missing or duplicate path checks.

The independent [corpus storage check](../packages/vowl/conformance/STORAGE.md) verifies bundle and member hashes, JSON locators, and the absence of obsolete loose copies.
It also covers stored N-Quads.
This job runs even when CI reuses a verified PR receipt.

### Inspect policy and repair eligible files

The root lock selects JSON Quality 1.0.0 and its matching native package.
The [schema-4 policy](../.json-quality.json) uses `allowSourceRewrites` for write protection, `excludeUntrackedSources` for external installations and named local state, and `nfcExemptStringValues` for exact string exemptions.
Tracked files remain in scope, including `.mcp.json`.
Owned generated files are checked when present.
`npm run check:json -- --require-generated` also requires the generated outputs.

Expected-negative fixtures retain their byte identities and exact diagnostics.
Canonical JSON follows its producer's compact presentation, while protected bundles, archives, evidence, deployment outputs, and npm locks are repaired through their owners.
The two narrowly exempted NFC fixtures retain six exact strings, including five values scoped to one identified JSONL record.

`npm run format:json:check` runs the same complete read-only check as `npm run check:json`.
`npm run format:json` and `npm run normalize:json` pass `--write`.
Put literal paths after `-- --`, and supply at least one writable path for normalization.
Use `npm run check:json -- --max-source-bytes 67108864` to select a per-source admission ceiling for a check.
`--no-capacity-limits` removes admission ceilings for that invocation.
Runtime controls such as the configured check deadline still apply.

The [repository adapter](../util/runRepositoryJsonQuality.mjs) exposes `openRepositoryJsonSession()` for programmatic checks.
Consume `session.check()` through `execution-terminal` and close the session in `finally`.
Use `openJsonSourceSession()` for supplied bytes under an explicit source contract.
`formatJsonSource(text)` and `normalizeJsonSource(text)` return text for finite in-memory transformations.

The shared ESLint rule rejects raw `JSON.stringify` as a semantic identity key.
Ordered scalar tuples, exact byte contracts, and digest preimages require an attached `json-identity-contract` declaration with an owner and reason.

## Check Python tooling

The Ubuntu and Windows jobs use the SHA-pinned `actions/setup-python` v7.1.0 action with [.python-version](../.python-version).
Each job creates `.venv`, installs the [hash-locked requirements](../requirements.lock.txt), and runs `npm run check:python`.
The lock selects Ruff 0.17.4, Click 8.5.1, and pip 26.3.
The check runs Ruff formatting and lint checks, then the Python setup tests.

## Reuse evidence after merge

A merge to `main` can reuse an immutable, successful PR receipt from the same repository when the tested tree, parents, workflow, check scope, and hosted identity match.
The verifier requires the complete successful PR job inventory, including JSON quality on both platforms.

With verified reuse, the application, Python, Markdown, and JSON jobs skip execution on the merge.
The required gate checks the retained evidence and expected skips.
Missing, invalid, or expired evidence triggers fresh checks.

## Read the CodeQL result

[The CodeQL workflow](../.github/workflows/codeql.yml) pins both initialization and analysis to v4.39.3.
It uses the same scope classification, and scheduled and manual runs analyze GitHub Actions, JavaScript and TypeScript, and Python.

The required `CodeQL gate` accepts a documentation-only skip.
For analysis runs, it requires successful jobs and waits for uploaded results to finish processing.
On pull requests it also checks the external security verdict for the current head commit.
Missing results, blocking alerts, failed analyses, and API errors fail the gate.
