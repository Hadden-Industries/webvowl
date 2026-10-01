# Canonical VOWL RDFC resource-policy decision

Status: owner approved the measured bounded policy amendment on 30 September 2026.
The [accepted amendment](../specs/2026-09-30-canonical-vowl-resource-policy-amendment.md) governs the implementation and a separately versioned independent producer.

The original A8 policy passes `maxDeepIterations = min(B, rdfDeepIterations)`, where `B` is the number of allocated blank nodes.
The selected `rdf-canonize@5.0.0` keeps one global counter per operation: `RDFC10.js:119` initializes it once, and lines 274–280 check and decrement it on every `hashNDegreeQuads` call, including recursion.
Its inspected source SHA-256 is `454a1158dd18a1559f7259573ffd9748999921cd18064c3ed48ab2b135446a98`.
This resolves the independent reviewer's explicitly memory-based uncertainty about whether the budget was per node.

The independent oracle's bounded probes preserve their exact sources, datasets, producer hashes, attempts and successful-output hashes under `packages/vowl/conformance/supplemental/budget`.
All runs used Windows x64 and Node 24.21.0, a 100,000 invocation probe ceiling and a 10-second per-operation deadline.
Boundary successes/failures were repeated three times where minimum values are stated.

| Ordinary exact source                        |                     Blank nodes | Minimum successful deep-invocation budget |
| -------------------------------------------- | ------------------------------: | ----------------------------------------: |
| Original two defaulted data properties       |                              37 |                                        72 |
| Two disjoint data properties                 |                              47 |                                        50 |
| Two inverse pairs sharing a forward property |                              43 |                                        52 |
| Defaulted data-property series, counts 1–8   | 25, 37, 49, 61, 73, 85, 97, 109 |       5, 76, 111, 144, 185, 222, 259, 304 |

The second series uses different exact IRIs, so its two-property threshold is 76 rather than 72.
That difference is expected for a hash-driven algorithm and rules out treating shape alone as a work estimate.
The original policy unconditionally rejects several ordinary B2 projections; increasing the caller's absolute override cannot lift its `B` ceiling.
Claude independently identified this as a profile-freeze blocker.

## Approved bounded replacement

Amend A8 to pass `maxDeepIterations = min(B * B, rdfDeepIterations)`.
Retain the 100,000 default, 1,000,000 upper override, zero-deep-work option, 10-second default deadline, combined cancellation, all model/byte/quad limits, and rejection without an alternate algorithm.
This changes operational acceptance, not successful canonical bytes or profile identity.
It is a measured quadratic graph-size allowance capped by an absolute budget, not a guarantee that every ordinary graph is accepted.

At this approved setting all 11 measured ordinary cases succeed in 0.53–8.38 ms, with exactly the same complete JSON and canonical N-Quads as every other successful budget.
The selected formula has measured room for these cases without assuming that a small constant multiplier generalizes beyond eight properties.

Separate raw-RDF symmetric cliques with 3, 5, 8 and 12 blank nodes all hit the proposed size-dependent ceiling in 0.48–12.87 ms.
Giving them the full absolute 100,000 budget allows the two smallest, while the 8- and 12-node cases reject after 5.31 and 8.87 seconds.
A 1 ms cancellation signal stops the 5/8/12 cases in 1.65–4.97 ms.
Those graphs are outside VOWL conformance and are evidence about the selected library's operational behavior, not broad security or production-browser qualification.
The wrapper must still check an already-aborted signal before calling the library, because a tiny operation may finish or exhaust its work before the library's first poll.

## Evidence and consequence

Primary evidence: `growth-results.json`, `symmetry-results.json`, the associated raw source/dataset records and frozen producer identities.
The prior linear-policy resource-rejection fixtures remain historical, library-specific evidence and are not portable language-neutral conformance expectations.
New independently produced positive outputs are pinned separately for those inputs; previous expected artifacts are preserved rather than overwritten.
Existing positive bytes must remain identical, and the source/decoder, cancellation, browser-worker and poison cases must be rerun under the amended policy.
Browser worker termination and full application responsiveness remain later qualification obligations.

## Installed-core measurements

The expanded experimental tarball with SHA-256 `e49d75ec644ac82485405428b8fdc0bf06be129020f2dc5ccc19578628a500b2` was subsequently measured through its public `canonicalize`/`encode` API on Windows x64, Node 24.21.0, locale `en-GB`, timezone `Europe/Bucharest`.
Each case ran in a fresh process with unchanged default limits and the approved bounded quadratic policy.
Successful cases checked subject/role/construct/occurrence counts; hashes identify the observed input/output, rather than creating new independent canonical goldens.

| Source shape                                       | Primary records | Observed result                      | Elapsed time | Process RSS after operation |
| -------------------------------------------------- | --------------: | ------------------------------------ | -----------: | --------------------------: |
| 100 distinct named classes                         |             300 | Success                              |     56.16 ms |            83,795,968 bytes |
| 1,000 distinct named classes                       |           3,000 | Success                              |    162.50 ms |           114,397,184 bytes |
| 5,000 distinct named classes                       |          15,000 | Success                              |    643.02 ms |           292,524,032 bytes |
| Two disconnected anonymous classes                 |               6 | Success                              |     29.83 ms |            71,618,560 bytes |
| Twenty disconnected anonymous classes              |              60 | Success                              |     33.46 ms |            73,183,232 bytes |
| Three anonymous classes in one disjointness clique |              13 | Success                              |     34.26 ms |            72,167,424 bytes |
| Six anonymous classes in one disjointness clique   |              34 | `RDFC_RESOURCE_LIMIT`, ceiling 4,225 |     95.09 ms |            80,515,072 bytes |
| Eight anonymous classes in one disjointness clique |              53 | `RDFC_RESOURCE_LIMIT`, ceiling 9,801 |    176.88 ms |            83,001,344 bytes |

These are single-run timing and instantaneous process-memory observations, including normal runtime/JIT/garbage-collection effects; they are not peak-memory, leak, security-impact or browser measurements.
The larger named case succeeds under the current defaults, while the highly symmetric valid source shapes exhaust the bounded graph work without returning output.
The harness's separate 15-second child-process watchdog was not reached.
The first draft clique recipes incorrectly supplied an `annotations` field on base constructs and failed closed-schema validation; those exploratory results are retained but do not count as graph-work evidence.
The table uses the corrected A4 recipes and a fresh final run.

Retained evidence under the session's `standalone-core-04` directory: `measure-resources.mjs`, SHA-256 `9eba42cc0d8693039e851678790dd19fefdfba668a327c965b939ec6c0f59284`, and `resource-measurements-final.json`, SHA-256 `8414cc8b3dfb9b3248b983563d18c26bdfa60108dc117c9aa88ee260c38d4d37`.

## Public override boundary qualification

Two additional public tests preserve independently pinned empty-document bytes when all nine A8 overrides equal their published upper bounds, and when the deep-work allowance is zero for a fixture requiring no deep comparisons.
The focused resource suite passes all twelve tests.
These are qualification tests for existing behavior, not a claimed test-first implementation cycle or a substitute for all A8 and worker boundaries.

A separate negative control ran the same inclusive-boundary contract against the installed candidate and a fresh copy of its fourteen runtime modules.
Changing only the upper-bound comparison from `>` to `>=` made the mutant reject with `OPTION_INVALID` at `/limits/inputBytes`; the unchanged candidate passed both canonicalization and decoding with the exact independent bytes.
The installed package, working-tree runtime and frozen review snapshot were not changed.
The retained harness and result are `standalone-core-04/resource-boundary-control.mjs` and `resource-boundary-control-result.json`, recorded at `2026-09-30T13:02:52.136Z`.
