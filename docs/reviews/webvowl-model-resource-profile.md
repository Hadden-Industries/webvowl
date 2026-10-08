# WebVOWL desktop model resource profile

The owner approved this profile on 8 October 2026 after the exact-node-count selector made the Universal Reference Data ontology fail during ranking.
It replaces the preliminary ranking-only 32 MiB proposal.

## Meaning and scope

These are finite acceptance and work counters, not a total JavaScript heap limit and not a maximum ontology file size.
The native structural RDF mapping introduces auxiliary records and incidence edges; imports, relationships, annotations and refinement rounds affect cost.
A file-size or class-count threshold alone cannot describe what the application accepts.

| Counter | Desktop default | Meaning |
| --- | ---: | --- |
| `totalStringBytes` | 67,108,864 (64 MiB) | Aggregate string accounting and conservative temporary signature-space bounds. |
| `primaryRecords` | 200,000 | Record work charged by the native operation, including repeated stages; not a unique-class allowance. |
| `embeddedValues` | 4,000,000 | Native embedded-value and refinement work charges. |
| `deadlineMs` | 60,000 | Whole model operation, including import waits and all worker stages. |

Apply the same profile to opening OWL, canonical and legacy models, recovery, editing, capture, source reading and RDF export.
Explicit caller limits override the defaults, including tighter limits.
Other artifact operations and the package's defaults remain unchanged.
Input bytes, RDF statement limits, RDFC deep-work limits, cancellation and the existing input-validation domains remain unchanged.
No fallback ranking, omitted import or partial accepted model is introduced.

## Measurements

Measurements used the actual native OWL admission and ranking operations on the existing Windows desktop (Intel i9-12900K, 32 GiB RAM, Node 24.21.0).
The diagnostic harness recorded producer counter charges and process maximum RSS.
RSS covers module initialization, admission and successive allowance probes; it is not isolated ranking memory, browser heap, or a mobile measurement.
Timings are individual diagnostic observations, not percentiles or an SLA.

| Input | Observation |
| --- | --- |
| Universal Reference Data, its ISO/IEC 11179 import and SKOS import | The 1,139,625-byte primary document failed in ranking with a 21,310,464-byte scratch estimate against 16 MiB. A 32 MiB diagnostic allowance loaded the full closure in 28.3 seconds. |
| 10,000 independent named classes | Native admission took 12.1 seconds. Ranking rejected 16 MiB, then passed 32 MiB in 2.6 seconds; estimated scratch 20,485,120 bytes, embedded-value charges 1,150,172. Process peak 526 MiB. |
| 5,000-class subclass chain | Native admission took 14.8 seconds. Ranking needed a 30,721,024-byte scratch estimate and 1,545,024 work charges. Increasing only string space still rejected at the old 1,500,000 work cap. With the diagnostic work allowance, ranking passed in 2.8 seconds; process peak 550 MiB. |
| 6,000 and 7,000-class subclass chains | The old 100,000 record-work allowance rejected during admission, before ranking. Raising only ranking memory cannot admit these cases. |
| 10,000-class subclass chain | With the measured admission/work profile, native admission took 29.2 seconds. Ranking rejected 32 MiB, then passed 64 MiB in 5.8 seconds; estimated scratch 61,441,024 bytes, embedded-value charges 3,090,024. Process peak 954 MiB across successive probes. |
| 2,000 classes with 480-character comments | The 1,227,805-byte source admitted in 6.9 seconds and ranked under the old 16 MiB allowance in 0.85 seconds. Process peak 287 MiB. |

The 64 MiB/200,000/4,000,000 profile is a measured desktop allowance with headroom for the demonstrated hierarchy, not a promise to accept every reasonable ontology.
It preserves finite rejection for larger, denser, more symmetric or deeply nested inputs.
An ontology of similar byte size can have substantially different internal cost.
Physical mobile devices, assistive technology, constrained-memory browsers, broad public ontology corpora and end-to-end latency percentiles remain unqualified.
Larger-scale support requires measuring the entire model lifecycle and reducing structural-copy/refinement costs, rather than repeatedly raising one counter.

## Error behavior

The reported URL was also opened with the repaired application in local Chrome.
Its import closure loaded, the native control reported "Showing 50 of 469 available nodes", and the browser console had no errors.
This is local application evidence, not a post-deployment website test.

Preserve only allowlisted stage/counter names and non-negative safe integer quantities across the worker boundary.
Normalize the producer's `limit` field to the application's `resource` field without reading accessors or forwarding exception prose/source content.
Ranking failures identify node selection; parsing/admission and canonicalization failures explain their distinct resource category.
The public message includes safe lower-bound requested/allowed quantities when available and a smaller ontology, import closure or edit recovery action.
Near-limit byte counts stay distinct even when rounded MiB values would be equal, and non-ranking operations use operation-neutral wording.
The previous generic `rdf resource limit` message is replaced by an application-owned explanation even when numeric details are absent.
