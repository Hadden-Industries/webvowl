# WebVOWL SDLC toolchain selection

Checked 2026-09-08 using native registry metadata, installed identities and primary
sources. Existing WebVOWL runtime dependencies and their lock remain consumer-owned.

| Consumer | Selection | Evidence and rights |
|---|---|---|
| Node.js | 24.20.0 | [Newest applicable LTS patch](https://nodejs.org/en/download), host matches; distribution notices retained |
| npm | 12.0.2 | [Exact registry record](https://registry.npmjs.org/npm/12.0.2), Artistic-2.0; npm exec leaves operator global npm unchanged |
| Python | 3.14.7 | [CPython release](https://www.python.org/downloads/release/python-3147/), PSF terms; checkout-specific .venv |
| Jest | Existing locked 30.4.2 | Existing npm owner qualified at 64 suites/585 tests; upgrading the application test runner is outside this adoption |
| yaml | 2.9.0 | [Exact registry record](https://registry.npmjs.org/yaml/2.9.0), ISC text inspected; parses workflow tests |
| jsonschema | 4.26.0 | [PyPI](https://pypi.org/project/jsonschema/4.26.0/), MIT; Draft 2020-12 with FormatChecker |
| PyYAML | 6.0.3 | [PyPI](https://pypi.org/project/PyYAML/6.0.3/), MIT; safe metadata parsing |
| Format providers | rfc3339-validator 0.1.4; rfc3986-validator 0.1.1 | [RFC3339](https://pypi.org/project/rfc3339-validator/0.1.4/) / [RFC3986](https://pypi.org/project/rfc3986-validator/0.1.1/), MIT |
| Codex host and operator CLI | 0.153.4 | Desktop executable inspected; separate npm CLI upgraded from 0.149.1 under the owner's later host-level approval |
| Host command/security tools | Existing installed capabilities | No installation, new scanner run, global configuration or trust change |

Only yaml is added to npm; root module type, Jest ownership and owlapi's exact Git
coordinate remain unchanged. Direct Python requirements are exact pins, not a
transitive hash lock. Retain the installed closure with runtime evidence. External
skills are not refreshed by local setup.

GitHub Actions retain the source's full commit pins; no moving version-only action
references are introduced. Current security guidance is recorded in
[the adoption plan](../plans/2026-09-08-webvowl-sdlc-adoption.md). Dependency selection
and static analysis do not establish browser, converter or product acceptance.

## Runtime preflight selection (2026-09-08)

Accepted need: make the actual launcher, executable, version, required hook capability
and update owner visible before SDLC hook qualification. This bounded R1 follow-up
uses the owner's proceed instruction and existing WebVOWL publication authority.

The current npm stable tag was verified as 0.153.4, matching the separately observed
desktop binary. The exact [Codex 0.153.4 licence](https://github.com/openai/codex/blob/042fb41b7c813ac7999105e886b2b7aa715b5081/LICENSE)
was inspected (Apache-2.0, Git blob 4606e72e042564097e8780d66c1d4dcb611869bd).
This integration invokes the already approved operator installation; no Codex source
or binaries are redistributed and WebVOWL's root licence/dependency graph is unchanged.

| Candidate | Observed fit and selection |
|---|---|
| Native codex doctor --json | Selected for schema-versioned, redacted installation, runtime, config and update diagnostics. Native 0.153.4 identifies both the npm launcher destination and an explicitly selected desktop binary. It also checks broader health, local state and network endpoints, so it is opt-in and its overall result is preserved separately. |
| Native codex --version and features list | Selected for identity even when doctor is unsupported, and the supported hooks maturity/effective-state interface. Optional multi-agent capability is not required or enabled. |
| Exact-version equality or bundle-path alias | Rejected: the frontends have independent installations, equality does not establish capabilities/trust, and internal bundle paths change with releases. |
| Custom installation/updater/configuration parser or another package | Unnecessary: native diagnostics own those facts; Python 3.14 standard-library subprocess/json/path handling supplies the repository composition. |

Authoritative command and capability contracts:
[doctor, features and version commands](https://learn.chatgpt.com/docs/developer-commands?surface=cli);
[hook trust and project loading](https://learn.chatgpt.com/docs/hooks);
[native update-check setting](https://learn.chatgpt.com/docs/config-file/config-reference).

Residual custom gap: combine generated-file verification with these native reports,
bind feature inspection to the executable identified by doctor, select installation,
runtime, config and stable enabled hooks as prerequisites, expose update advice and
unrelated health statuses, and retain not-assessed hook acceptance. Only required
report fields are consumed; unknown diagnostic schemas or ambiguous capability output
fail closed. There is no fallback to guessed legacy fields, version grammar, global
installation, custom launcher, altered security settings or inferred hook trust.
