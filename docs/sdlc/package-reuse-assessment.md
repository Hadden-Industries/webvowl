# WebVOWL reuse and rights decisions

The accepted adoption plan selects Universal Ontology's working SDLC with ONI's
qualified portability changes. [.sdlc/UPSTREAM.json](../../.sdlc/UPSTREAM.json) records
exact source identities and transformations; upstream notices are retained.

| Requirement | Reused owner and compared alternative | Residual WebVOWL work |
|---|---|---|
| State, schema, verification and PR linkage | Tested Python controls versus a JavaScript rewrite | Preserve behavior and use checkout .venv behind npm commands |
| Transactional configuration | Existing native atomic publication versus copying the ontology installer or reimplementing transactions | Extract the dependency closure into one generic owner with race/rollback preservation tests |
| Local skills | Native layout and safe activation versus external refresh | Preserve existing external declarations and explicit Brooks policy; replace external TDD with complete local TDD |
| Check selection | Native Git pathspec/diff queries versus duplicate glob parsing or an Actions-only filter | WebVOWL path ownership and npm commands, shared locally and in CI |
| Tests/build | Existing unittest/Jest/npm/Vite owners versus a new test runner or pipeline | Add control tests and one YAML dependency; preserve application behavior and dependency pins |
| Governance | Native GitHub forms, trusted-base linkage, CODEOWNERS and Dependabot versus a new service | Origin-bound writes, real CI/analysis evidence and least-privilege defaults |

Root AGPL-3.0-only remains authoritative. The source SDLC MIT notice and adapted
TDD licence permit the retained source attribution; this adoption does not relicense
WebVOWL or publish a package. Exact dependency rights and versions are recorded in
[toolchain-selection.md](toolchain-selection.md).

DCG's retained upstream notice includes a non-standard OpenAI/Anthropic rider. It
must not be described as plain MIT or an author-issued exception. This task reuses
the already installed operator command protection without redistributing a binary
or granting a new licence/trust decision. See [adoption.md](adoption.md).

Native jsonschema, tomllib, safe YAML and Git own their respective parsing and
validation contracts; repository policy adds cross-record intent/freshness checks.
Generated configuration must also satisfy Codex's native schema. Parseability is
distinct from hook trust, model compliance, platform permission and human acceptance.
