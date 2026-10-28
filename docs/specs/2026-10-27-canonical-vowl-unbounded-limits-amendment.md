# Canonical VOWL unbounded-limits amendment

Status: owner approved on 27 October 2026.
Corrected the same day at the owner's request: each bound the OWL adapter derives from a limit fails with that limit's code, and operations that read no XML still validate `expandedXmlBytes`.

This amendment supersedes the finite-limit policy of A8 in the [core contract](2026-09-24-canonical-vowl-core-contract.md): its finite defaults, its finite upper override bounds, its override domain and its rule that no operation exposes an unbounded option.
It also supersedes the corresponding statements in section 20 of the [design](2026-09-24-canonical-vowl-design.md), the `rdfDeepIterations` maximum restated by the [resource-policy amendment](2026-09-30-canonical-vowl-resource-policy-amendment.md), the default set by the [embedded-work amendment](2026-10-03-canonical-vowl-embedded-work-amendment.md) and the limits table of the [implementation plan](../plans/2026-09-24-canonical-vowl-implementation-plan.md).
The original documents retain their evidence-pinned bytes, and section C8 of the [decision record](2026-09-24-canonical-vowl-design-decisions.md) remains the historical rationale.

## Reason

A8 described its limits as engineering policy, and C8 found no primary specification that supplies a byte or millisecond budget.
The package therefore keeps a default only where an outside authority asks for a bound.
The caller decides every other bound and may lift any bound, including those with a default.

## Defaults

| Limit               |  Default | Outside basis                                                                                                                                                                                                                                                                                       |
| ------------------- | -------: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `depth`             |      128 | [CWE-674](https://cwe.mitre.org/data/definitions/674.html), uncontrolled recursion: each canonical profile's schema defines `Annotation` recursively, so a valid document can nest without a structural bound, and processing recurses.                                                             |
| `rdfDeepIterations` |   100000 | [RDFC-1.0 section 4.4.3](https://www.w3.org/TR/2024/REC-rdf-canon-20240521/#canon-algo-algo) requires a defence against denial of service, and [section 7.1](https://www.w3.org/TR/2024/REC-rdf-canon-20240521/#dataset-poisoning) suggests a configurable iteration limit that applies by default. |
| `deadlineMs`        |    10000 | RDFC-1.0 section 7.1 suggests a configurable timeout with a default value; the package applies one deadline to each whole operation, including its RDFC-1.0 work.                                                                                                                                   |
| `expandedXmlBytes`  | 33554432 | [CWE-776](https://cwe.mitre.org/data/definitions/776.html), XML entity expansion.                                                                                                                                                                                                                   |

`inputBytes`, `primaryRecords`, `embeddedValues`, `stringBytes`, `totalStringBytes` and `rdfQuads` have no default: without a caller limit, the package imposes none.
[RFC 8259 section 9](https://www.rfc-editor.org/rfc/rfc8259#section-9) permits limits on text size and string length but gives no reason to impose them, and the memory these limits bound grows only linearly with the input.
The retained default values are A8's engineering choices, not measurements.

## Overrides

Each limit accepts a positive safe integer or `Infinity`, and `rdfDeepIterations` also accepts zero.
There is no upper override bound.
Any other value, including `null`, a fraction, a negative number, `NaN` and an integer above `Number.MAX_SAFE_INTEGER`, fails with `OPTION_INVALID` at `/limits/<name>`, and an unknown limit name still fails.
`Infinity` removes the package's bound for that limit only; it does not lift another limit.

A finite `rdfDeepIterations` keeps the resource-policy amendment's allowance, `min(B * B, rdfDeepIterations)`.
`rdfDeepIterations: Infinity` passes no deep-iteration bound to RDFC-1.0, so it also lifts the `B * B` term.
`deadlineMs: Infinity` sets no deadline, and cancellation through the caller's signal still applies.
A finite deadline longer than the host's largest timer delay expires at its actual time, never earlier.

## OWL adapter

`expandedXmlBytes` counts the UTF-8 bytes of RDF/XML or OWL/XML text after internal entity expansion while `fromOwl` parses it.
Operations that read no XML validate the limit like any other and otherwise ignore it.
Crossing it fails with `MODEL_RESOURCE_LIMIT`, the code of `expandedXmlBytes`; each other bound that the adapter derives from a limit fails with the code of that limit.
While it is finite, the parser's own internal-entity controls also apply; `Infinity` lifts them as well.

The adapter's fixed caps now follow the caller's limits:

| Parser or profile-check bound | Before                             | Now                  |
| ----------------------------- | ---------------------------------- | -------------------- |
| Numeric literal digits        | `min(65536, stringBytes)`          | `stringBytes`        |
| Profile-check work            | `min(1000000, 2 * embeddedValues)` | `2 * embeddedValues` |
| Import count                  | `min(256, primaryRecords)`         | `primaryRecords`     |
| Import depth                  | `min(32, depth)`                   | `depth`              |

Where a caller limit is `Infinity`, the adapter passes its dependency's representation of no bound.
Where the dependency accepts only finite values, it passes a bound that no input can reach.

## Host limits

An unbounded limit hands the bound to the host runtime.
An operation that reaches a limit of the runtime rather than a configured one, such as its call stack or the largest string, array or buffer it can allocate, fails with the new code `HOST_RESOURCE_LIMIT`.
Its `details.resource` names the exhausted resource, `callStack` or `allocation`.
Cancellation and an expired deadline take precedence, as they do for configured limits.
Raising a configured limit cannot avoid a host limit.
Memory exhaustion that ends the worker or process cannot be reported and lies outside the failing-closed guarantee.

## Applications

WebVOWL keeps A8's former defaults as its own browser policy, and its client still checks requested deadlines, input sizes and depths against A8's former upper bounds, so its users see no change.
The model-operation allowances approved for it still take precedence over those defaults.

## Former values

| Limit               | Former default | Former upper override bound |
| ------------------- | -------------: | --------------------------: |
| `inputBytes`        |       33554432 |                   268435456 |
| `primaryRecords`    |         100000 |                     1000000 |
| `embeddedValues`    |        1500000 |                     4000000 |
| `depth`             |            128 |                         512 |
| `stringBytes`       |        1048576 |                    16777216 |
| `totalStringBytes`  |       16777216 |                   134217728 |
| `rdfQuads`          |        1000000 |                     8000000 |
| `rdfDeepIterations` |         100000 |                     1000000 |
| `deadlineMs`        |          10000 |                      300000 |

The `embeddedValues` default was 500000 before the embedded-work amendment.
`fromOwl` previously bounded expanded XML by `inputBytes`.

## Evidence and qualification

The nine `option-<limit>-above-ceiling` vectors of the [negative supplement](../../packages/vowl/conformance/supplemental/negative/manifest.json) remain frozen historical evidence of the superseded bounds.
A versioned overlay, derived from this amendment without production code, supplies their current expectations.
Qualification covers each limit at `Infinity`, at `Number.MAX_SAFE_INTEGER` and one above its former bound; rejection of the values listed under overrides; the four retained defaults; deadline timing; the deep-iteration bound; `expandedXmlBytes`; the adapter's derived bounds; stack exhaustion; and the application's retained policy.

This amendment changes admission only.
No profile, field, canonical byte, cancellation rule or no-fallback rule changes.
