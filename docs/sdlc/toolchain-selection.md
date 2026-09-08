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
| Codex desktop host | Existing 0.153.4 | Running executable inspected; PATH CLI is 0.149.1; no global upgrade |
| Host command/security tools | Existing installed capabilities | No installation, new scanner run, global configuration or trust change |

Only yaml is added to npm; root module type, Jest ownership and owlapi's exact Git
coordinate remain unchanged. Direct Python requirements are exact pins, not a
transitive hash lock. Retain the installed closure with runtime evidence. External
skills are not refreshed by local setup.

GitHub Actions retain the source's full commit pins; no moving version-only action
references are introduced. Current security guidance is recorded in
[the adoption plan](../plans/2026-09-08-webvowl-sdlc-adoption.md). Dependency selection
and static analysis do not establish browser, converter or product acceptance.
