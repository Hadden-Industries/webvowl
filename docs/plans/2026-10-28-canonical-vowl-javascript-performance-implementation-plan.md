# Canonical VOWL JavaScript performance: HISEW implementation plan

## 1. Status, source and authority

| Field              | Value                                                                                                                                             |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status             | Owner-selected implementation in progress; current authority, results and limits are recorded in section 14                                       |
| Prepared           | 28 October 2026                                                                                                                                   |
| Decision owner     | Repository owner, Maksym Shostak                                                                                                                  |
| Integration owner  | To be assigned when this programme is selected                                                                                                    |
| Source document    | `C:\Users\maksy\Downloads\webvowl-vowl-javascript-performance-improvements.md`, “Evidence-Driven Performance Audit: Canonical VOWL Core (`vowl`)” |
| Source identity    | 36,026 bytes; 572 lines read; SHA-256 `aebacd026a9fe6a11eb1d85015dbaa0a28a8be3d0c8661787d9bc76c3b50b442`                                          |
| Inspected baseline | `9282ea541ada16ce9565031af760325d7a107581`, plus the current working-tree contents                                                                |
| Existing candidate | Uncommitted changes to `packages/vowl/src/projection.js` and `packages/vowl/test/liveModel.test.js`, already present before this planning task    |
| Planning procedure | HISEW `hadden-industries-plan-software-change`, installed `0.1.0-dev.29`                                                                          |
| Identifier scope   | All `REQ-###`, `AC-###`, `QA-###`, `DEC-###` and `SLICE-###` IDs are local to this document; qualify cross-plan references by filename            |

The user requested a detailed implementation plan preserving the supplied audit's relevant content.
This document retains all five findings, their classifications, causal mechanisms, measurements, proposed patches, tests, roadmap, exclusions and missing evidence.
It translates complete code examples into implementation contracts and proof obligations rather than reproducing a patch as an instruction to apply it blindly.
Historical line numbers are replaced by module/function references.
The source's opening tool transcript is provenance, not authorization to repeat those commands.

The existing working-tree candidate matches the audit's monotonic ordinal change and its appended timed 1,000-class test.
It is user-owned work.
The planning checkpoint did not authorize editing, restoring, staging, committing or claiming authorship of those changes.
Section 14 records the owner's subsequent implementation authority and qualification of that candidate.
The source calls them applied and verified; current inspection establishes their presence, not their test or release status.

Observed candidate hashes at planning inspection:

- `packages/vowl/src/projection.js`: `fdee422220d93751b9efb4324fe4484437eed4a196e4927cf15899b3d9bd51ae`.
- `packages/vowl/test/liveModel.test.js`: `f4913ee8502751645b98288232146cfde76b18d273519e46334ef129c6565c2d`.

These bind the inspected files, not a complete qualified candidate.
Recheck current source before implementation.
This planning task runs no product tests, performance benchmarks or application changes; scoped document checks are separate.

### 1.1 HISEW state and missing prerequisites

Read-only `inspect-project-applicability` returned personal applicability active.
The current session notice identifies unrelated retained execution `9149fb1d-09e6-48dd-a30c-5626ef32e7ed`, generation `7`, for “Implement accepted legacy force performance plan with measured conditional escalation; signed local commits, no pushes; final external review before full tests.”
This supersedes older session notices for planning context, without altering their history.

No new HISEW execution starts here.
Before implementation, the owner must decide how to continue/adopt or close the retained execution through supported commands, rechecking current generation and session ownership.
Its authorization to implement force work or make signed commits does not authorize this new programme.
Pending feedback continuations are outside this task.

This is a draft dossier, not an accepted risk route or selected design.
Missing prerequisites are acceptance of scope/targets, disposition of the existing candidate, risk routing, ownership resolution, named integration/review/release observers, and exact configuration approval wherever needed.
The affected implementation waits for those decisions.
Preserving the proposals in this document does not adopt them.

No code-review, security, commit or independent-verifier provider operation is selected to write this draft.
When one is required, inspect and resolve that operation against actual current tools and scoped consent.
Provider discovery alone is not completed review or verification.

### 1.2 Controlling records and overlap

- [Canonical VOWL core contract](../specs/2026-09-24-canonical-vowl-core-contract.md), [projection contract](../specs/2026-09-24-canonical-vowl-projection-contract.md) and [atomic editing amendment](../specs/2026-09-30-canonical-vowl-editing-amendment.md).
- [Unbounded-limits amendment](../specs/2026-10-27-canonical-vowl-unbounded-limits-amendment.md), including its separation of package limits and WebVOWL browser policy.
- [WebVOWL desktop model resource profile](../reviews/webvowl-model-resource-profile.md), including the 28 October counting change and pending recalibration.
- [Worker/package experiment decision](2026-10-23-worker-experiment-decision.md): private validated-state publication already exists; it is not approval for arbitrary copy removal.
- [JavaScript performance plan](2026-10-26-javascript-performance-improvements-implementation-plan.md): related controller borrowing, worker lifecycle, renderer and measurement proposals; do not duplicate its slices or treat them as approved here.
- [Legacy-force performance plan](2026-10-26-legacy-force-simulation-performance-implementation-plan.md): separate force/rendering work and execution ownership.
- [Quiescent benchmark ADR](../adr/0003-quiescent-benchmark-environment.md) and [rendered-graph ownership ADR](../adr/0010-rendered-graph-is-a-projection-not-the-store.md).

## 2. Purpose, scope and risk proposal

The intended outcome is that incremental edits remain practical on large admitted ontologies, preserve exact semantic/provenance behavior, and avoid unnecessary CPU/allocation work.
Test infrastructure should verify independent evidence efficiently without weakening that independence.
Success must include the browser worker lifecycle and realistic axiom-rich inputs, not only a fast Node chain benchmark.

The smallest candidate is the existing HOT-01 ordinal repair with stronger correctness/scaling evidence.
Differential support preservation and indexed mutation are next proposed candidates.
Snapshot ownership changes and corpus caching have separate correctness boundaries and may be rejected independently.
No broad rewrite is necessary to qualify the ordinal fix.

### 2.1 Included work

1. Establish an immutable baseline, audit evidence inventory and explicit disposition of the existing HOT-01 candidate.
2. Qualify monotonic generated-ID allocation, including collision cases, canonical equivalence, cancellation and deterministic work growth.
3. Reduce redundant support-key serialization only when semantic/provenance equivalence is established.
4. Index mutation lookup while preserving ordered atomic edit semantics and normalization.
5. Investigate avoidable snapshots/freezes without bypassing admission, ownership or the current resource-accounting contract.
6. Investigate repeated corpus decoding/hashing while retaining independent expected hashes and owned returned bytes.
7. Measure large-chain and Universal Reference Data (URD) edits through the real browser worker path; separate message transport, operation stages, main-thread work and memory.
8. Define proportionate automated regression protection, release evidence, rollback and cleanup.

### 2.2 Non-goals

- No global custom replacement for RFC 8785 `canonicalize`; it underpins canonical bytes and conformance.
  Optimizing how often support matching invokes it is a separate decision from changing its serialization rules.
  [RFC 8785](https://www.rfc-editor.org/rfc/rfc8785).
- No parallel worker-thread graph-validation architecture.
  The audit says serialization outweighs computation below 100,000 records; retain that as an unverified generalization, not a demonstrated universal crossover.
  Existing browser worker profiling is included; creating more workers is not.
- No ontology semantics, provenance, canonical identity, saved-view format, renderer identity, force algorithm or visual notation change.
- No raised desktop resource allowance, weakened rejection, silent fallback, partial accepted model, skipped source/import validation, or revived superseded finite package defaults.
- No new dependency, persistent model cache, service, telemetry endpoint, configuration change, corpus regeneration, commit, push or release is selected by this draft.

### 2.3 Proposed risk route

Propose **R2** for the programme because support provenance, admission ownership, resource/error behavior and independent conformance evidence can change. The router may classify the narrow HOT-01 repair separately after its actual scope is frozen. Snapshot/admission or trust-boundary changes require native security assessment; a materially different public contract or broad shared cache requires rerouting rather than an assumed exception.

Relevant review lenses are semantic/canonical equivalence, ownership/currentness, provenance, resource/cancellation behavior, algorithmic scaling, corpus-oracle independence and browser lifetime. Proposed roles are integration owner, package/domain reviewer, native security assessor, benchmark operator and release observer; they remain unassigned until the owner accepts the work.
No external reviewer is contacted by this task.

## 3. Audit evidence retained

The following are **source-reported observations**, not measurements reproduced in this planning task.
`MEASURED`, `VERIFIED` and “clean pass” remain the audit's labels until exact artifacts, options and candidate identities are recovered.
Its transcript includes failed, cancelled and killed experiments; do not infer an uninterrupted successful qualification from the narrative alone.

### 3.1 Workloads and environment

| Item                 | Source definition                                                                                                                                          |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Chain workload       | Start with canonical `empty-structural`, open a live model, populate `N` named classes and `N−1` subclass constructs; `N = 100, 500, 1,000, 2,000, 10,000` |
| Measured edit        | One atomic request inserting one subject, one class role and one subclass construct referencing an existing root; setup excluded from isolated edit timing |
| Projection scale     | Approximately 30,000 occurrences for the 10,000-class chain; distinguish occurrences, structural records, classes and charged records                      |
| Conformance workload | 36 package test suites, 8,004 reported tests/assertions                                                                                                    |
| Runtime              | Node `24.22.1`, source says V8 `12.9`; Windows 11 x64, 12th-generation Intel/i9-class CPU, 32 GiB RAM                                                      |
| Tooling              | npm workspaces, source says npm `10.x`; Jest `--runInBand`, `NODE_OPTIONS="--experimental-vm-modules --disable-warning=ExperimentalWarning"`               |
| Timing/profiling     | `performance.now()` in isolated processes; V8 sampling through `node:inspector`                                                                            |
| Large-chain command  | `node --max-old-space-size=4096 scratch/bench_10000.mjs`                                                                                                   |

Current read-only runtime inspection returned Node `v24.22.1`, V8 `13.6.233.17-node.58`, `win32`/`x64`.
The source's V8 identity conflicts with that observation; recover its exact runtime receipt rather than silently correcting history. npm version, exact CPU, power mode, sample counts, warmups, quiescence and full harness hashes were not established by the audit narrative.
The 4-GiB Node heap option is a diagnostic process setting, not a browser memory allowance.

### 3.2 Timing results retained verbatim in value

| Chain classes `N` |                 Before |         After HOT-01 | Source speedup / interpretation                              |
| ----------------- | ---------------------: | -------------------: | ------------------------------------------------------------ |
| 100               |                36.4 ms |              35.7 ms | 1.02×; constant overhead dominates                           |
| 500               |               481.6 ms |             148.1 ms | 3.25×; linear transition                                     |
| 1,000             |             3,540.4 ms |             296.2 ms | 12.0×; approximately 2× candidate time for 2× scale from 500 |
| 2,000             |            14,438.4 ms |             571.5 ms | 25.3×; approximately 1.9× candidate time for 2× scale        |
| 10,000            | 204,000.0 ms / 204.0 s | 5,538.0 ms / 5.538 s | 36.8×; source describes operation below 60 seconds           |

The source calls the 500-to-1,000 before increase 7.3× and the 1,000-to-2,000 increase 4.1×.
Preserve the raw times; those two size transitions do not independently establish a complexity exponent.
The reported 204 seconds is 3.4× the desktop 60-second allowance.
The source computes 5.538 seconds as 9.2% consumed and 90.8% headroom; that arithmetic describes this isolated operation observation, not the full application worker deadline.

Other retained observations:

- Full package suite: 64.086 seconds, with about 45 seconds attributed to conformance/fixture loading.
- HOT-01 1,000-class CPU profile: `get` approximately 1,267 ms and `add` approximately 879 ms; combined detailed total 2,145.9 of 2,662.9 ms, or 80.6% self-time.
  Reported trace count: 91,203 `generated*` lookups, whose instrumentation scope needs its receipt.
- Isolated allocator at `M = 10,000`: 30,674.4 ms before and 6.08 ms after; approximately 5,045×.
  This is an allocator microbenchmark, not a whole-edit result.
- Post-HOT-01 10,000-class support-key work: `serializeString` 459.3 ms, `canonicalize` 235.8 ms and `enterValue` 209.1 ms, totaling 904.2 ms / 15.0% self-time.
- Snapshot copying: 1,510.1 ms / 25.0%; deep freezing: 286.6 ms / 4.7%; GC pauses: 394.0 ms.
  The audit attributes GC to short-lived allocations in more than one finding; do not count it twice or claim exclusive causation from sampling.

These profile percentages need their own denominator/run identity.
Do not force them to add to the 5.538-second uninstrumented result or treat profiler self-time as transferable end-to-end latency savings.

### 3.3 Hotspot register

| ID     | Audit evidence / severity / confidence | Mechanism and source proposal                                                                                                                                                                           | Forecast, effort and source risk                                                                                                                               |
| ------ | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| HOT-01 | Measured / critical / high             | `generateProjection:add` resets its allocation search for every occurrence during edit admission; keep a per-generation monotonic `nextOrdinal`                                                         | Approximately 36× large-chain gain; small effort, low risk in table; prose says no correctness risk, which still requires proof                                |
| HOT-02 | Measured / high / high                 | `editLiveModel` serializes remapped old and current records with `jsonKey` to preserve support; bypass comparison only for demonstrably unchanged records/dependencies                                  | 15–20% edit improvement, about 900 ms at 10,000 classes; medium effort/risk; top-three target removes about 60,000 calls and reduces GC pause by more than 60% |
| HOT-03 | Measured / medium / high               | Initial edit draft, remapped old graph and final admission snapshot plus per-occurrence copies and freezing; compare mapped references without the second clone and consider private ownership transfer | About 25% CPU reduction/lower RSS; large effort, medium risk                                                                                                   |
| HOT-04 | Strongly inferred / medium / high      | `applyChanges:lookup` scans collection arrays for each requested change; build a temporary ID-to-location/record index                                                                                  | Lookup cost from `O(KN)` toward `O(N+K)`; small effort, low source risk; no measured speedup supplied                                                          |
| HOT-05 | Measured / low / high                  | Bundle reads verify internal SHA-256; pinned reads verify again and reconstruct bytes; memoize verified artifact buffers                                                                                | Claimed 50% / 20–30-second suite reduction; small effort, low source risk; actual integrity and cache contracts make this conditional                          |

Forecasts are hypotheses, not accepted targets or already measured results.
HOT-02/03/05 savings overlap; do not sum them.
“Low risk” does not waive correctness or independent-oracle review.

### 3.4 Complexity and traversal claims

Use `N` for structural records, `M` for projected occurrences, `K` for requested changes, `B` for fixture accesses and `S` for fixture byte size.
Record size and dependency fan-out remain relevant; class count alone is not an allocation budget.

- **HOT-01 source model:** `M(M+1)/2` collision probes, about 450 million at `M = 30,000`; monotonic allocation at most existing occupied ordinals plus newly generated IDs, about 60,000 for the simplified 30,000/30,000 case.
  The desired improvement is quadratic to amortized linear allocation work, not a claim that all editing becomes constant-time.
- **Correction to the exact old count:** In the source's dense-prefix scenario, `generated` also retains newly emitted temporary IDs.
  On call `i`, resetting to `i` encounters the old prefix and the prior temporary IDs; rejected candidates can remain approximately `M` per call.
  Thus the triangular sum counts only part of the collisions; total rejected candidates can be `M²` (about 900 million for 30,000).
  Membership calls, string creations and loop iterations are different counters.
  This is a static derivation, not a new runtime measurement.
- **HOT-02:** approximately `2N` canonicalizations per edit and work proportional to total serialized record content, not simply record count.
  One insert can affect normalization and support beyond its three explicit records.
- **Record-count qualification:** the current support loops include subjects, roles, expressions, constructs and occurrences.
  Roughly 30,000 occurrences therefore do not imply only 30,000 total records or 60,000 canonicalizations.
  The audit's 60,000-call estimate needs a measured total across every collection; retain it as a source estimate rather than a verified count.
- **HOT-03:** repeated `O(N)` tree traversals allocate owned containers and validate strings/prototypes/depth.
  Redundant charging and redundant copying are different questions under the new counting contract.
- **HOT-04:** a prebuilt index can reduce direct lookup work toward `O(N+K)`.
  Array removal shifts positions; maintaining all shifted positions after every removal can restore `O(KN)`.
  Anchor retargeting, normalization, dependency traversal and compaction remain separate costs.
- **HOT-05:** source models hashing as `O(BS)`.
  Distinguish one bundle's first decode/validation, repeated member decoding, independent pin verification and actual filesystem reads across reader/module lifetimes.

Source-reported cyclomatic complexity is `add` 6, `generateProjection` 28, `normalizeDraft` 34 and `editLiveModel` 18.
These scores were not recomputed here.
They identify review complexity, not an instruction to refactor every branch or proof of the performance bottleneck.

### 3.5 Source verification claims and evidence gaps

The audit reports 36/36 suites and 8,004/8,004 tests passing, plus clean `npm run lint:js` and `npm run format:app:check`.
It says gapped generated handles, pre-existing user records and empty models preserve uniqueness and exact canonical bytes.
These remain source assertions until logs and fixture coverage are bound to the exact candidate; the one appended timed test does not itself cover all those cases.

The audit lacks a browser worker/message profile for roughly 30,000 occurrences under memory pressure and a URD incremental-edit flame graph covering broad domains, properties, domain/range expressions and complex disjointness axioms.
It also lacks repeat counts/percentiles, quiescence evidence, exact hardware/runtime receipts and a reproducible retained location/hash for every scratch harness/profile.
Preserve failed and interrupted runs when recovering those artifacts.

## 4. Current-source reconciliation and invariants

### 4.1 Existing HOT-01 candidate

`projection.js` currently declares `nextOrdinal` once per `generateProjection` invocation, increments through collisions, and advances after allocation.
It retains key deduplication, the exact-projection size guard and conditional snapshotting for normalization.
The candidate is present in the working tree, not HEAD.

The appended test builds a 1,000-class chain, inserts a subject/role/subclass triple, asserts elapsed time strictly below 1,000 ms and revision `2`.
It uses `noRdf` limits for `rdfQuads` and `rdfDeepIterations`; it does not select the desktop worker profile or change the package's default deadline.
Its setup time is excluded from the timed interval but still contributes to suite time.

A single fixed-size elapsed test is useful regression evidence but does not prove linear complexity or a universal CI latency.
The audit's additional “whole suite under 1.5 seconds” criterion is unsupported by a setup-bearing test and other cases in that file.
Keep it as a proposed claim to resolve, not an acceptance fact.

The collision loop currently has no `budget.poll()` of its own; the inspected `context.get` is a plain Map lookup.
Even a monotonic first scan can traverse a long occupied prefix without a cancellation/deadline observation.
Qualifying the candidate must include the existing at-most-1,024-visits polling contract, not assume that a faster algorithm alone satisfies it.
Any repair is future authorized implementation; this planning task leaves the candidate untouched.

### 4.2 Limits and counting have changed

The desktop application still selects `primaryRecords = 200,000`, `embeddedValues = 4,000,000`, `totalStringBytes = 67,108,864` and `deadlineMs = 60,000` for its model operations.
Those counters are not heap bytes, unique classes or a maximum file size.
The deadline includes worker stages and import waits.
Preserve explicit tighter limits and application-level upper-bound/error policy.

The accepted [27 October amendment](../specs/2026-10-27-canonical-vowl-unbounded-limits-amendment.md) removes many finite package defaults and allows per-limit `Infinity`.
The package still defaults depth to 128, RDF deep iterations to 100,000, deadline to 10,000 ms and expanded XML to 33,554,432 bytes.
`rdfDeepIterations` additionally permits zero.
WebVOWL's browser policy remains separately finite.
Do not replace this distinction with the audit's single “desktop defaults” description.

`snapshotSource` now tracks values already counted within an operation, using budget-owned weak membership, while still copying and validating.
The [28 October resource profile](../reviews/webvowl-model-resource-profile.md) records 59,997 primary records for opening and 89,998 for editing a 10,000-class chain, at most 340,029 embedded values and 15,449,831 string bytes (the latter in ranking), and a whole-lifecycle process peak of 1.2 GB.
Those diagnostic measurements lifted limits; they are not proof of browser memory safety or finite-profile success.
The owner kept the profile unchanged pending edit repair and URD/browser recalibration.

The audit's proposed “exactly `O(K)` primaryRecords” and delta-only post-edit heap gate do not match the current full-revision lifecycle.
Big-O is not an exact numeric charge, and retaining old/new immutable revisions can legitimately retain `O(N)` data.
Require the correct unique-value accounting, no quadratic inflation, bounded attributable overhead and reclamation of unreachable intermediates; do not impose persistent structural sharing as an unapproved prerequisite.

### 4.3 Support provenance is content-dependent

`editLiveModel` snapshots `before.structural`, applies requests, enforces source/uncertainty guards, normalizes, computes correspondence and constructs `renamedBefore`. Typed ID/reference fields are mapped through successors, with missing mappings becoming `null`.
Canonical record keys then select preserved support; when keys merge, existing code prefers support whose origin is not `edit`.
Qualification records are remapped and retained according to preserved non-edit supports.

An unchanged ID or absence from the edit request does not establish unchanged content or provenance.
Alias merges, dependency/reference changes, endpoint retargeting, deduplication, role promotion, pruning and regenerated occurrences can alter the result indirectly. A fast path must preserve this whole rule, including many-to-one/null correspondence and support precedence.
The source's final shorthand “check whether ID appeared in the batch” is insufficient by itself.

### 4.4 Mutation indexing is not a static position map

`applyChanges` reserves original handles for the entire atomic request, including occurrence handles.
It appends inserts, splices removals, replaces records in place, supports ontology/endpoint changes and retargets assertion anchors.
Removing a record does not free its handle for a different record in the same batch.
Any index must track ordered mutations, preserve forward-reference rules and retain precise errors at `/changes/<index>`.

Do not promise `O(N+K)` for the whole edit after replacing `findIndex`: anchor scans and normalization remain.
Choose an index/update representation that avoids stale array offsets and keeps output order/correspondence identical.
A bounded hybrid or final ordered compaction is a design option, not a selected implementation in this draft.

### 4.5 Corpus verification has two authorities

`createCorpusReader` already caches parsed bundle entries per reader.
The first access to a bundle checks format, routing, duplicate paths, encoding roundtrip, byte length and each embedded digest.
Every returned member is a fresh owned Buffer.
`readPinned` then checks bytes against an independently frozen manifest digest and optional length.
Those independent pins, not self-declared bundle hashes alone, authorize expected contents.

Caching decoded bytes can avoid repeated reconstruction, but returning a shared mutable Buffer would let one test corrupt another test's expectations.
Skipping the external pin after an internal bundle digest would erase an integrity boundary.
Any memoized independent verification must be bound to root/path, expected digest, optional length and immutable reader/content identity, with conflicting pins rejected.
Define behavior for changed fixtures and repeated readers before caching; preserve no-loose-file fallback for bundled members.

### 4.6 Cross-cutting invariants

- Preserve exact canonical bytes, semantic projection bijection, uniqueness, occurrence correspondence and meaningful sequence/set distinctions.
  Temporary generated IDs do not become durable identity.
- Keep original model/revision immutable, edits atomic, result correspondence/created records correct, and source archives/qualifications unchanged except by the accepted edit contract.
- Preserve cancellation/deadline ordering, inclusive finite bounds, explicit `Infinity`, host-exhaustion translation, validation/error domains and at-most-1,024-work-visit observation where required.
- No caller-supplied “already validated” flag, proxy shortcut across untrusted boundaries, or shared mutable source/corpus data.
- Evidence must distinguish source implementation, testing, benchmarking, review, release and deployment.
  Historical full-suite success cannot qualify later edits automatically.

## 5. Draft requirements, acceptance and quality scenarios

These requirements/targets are proposals derived from the audit and current contracts.
The owner must select new targets under DEC-001; existing accepted contracts remain binding.

| Requirement                                           | Acceptance criterion                                                                                                                                                                                                                                   |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| REQ-001: bounded generated-ID allocation              | AC-001: collision-candidate work grows with the occupied generated-ID range encountered plus distinct emitted occurrences; independent counting/scaling evidence rejects reset-per-call behavior; exact projection/canonical/handle behavior preserved |
| REQ-002: meaningful performance regression protection | AC-002: deterministic algorithmic guard plus separately admitted timed cohorts; resolve the source's `<1,000` versus `≤1,000` boundary and runner conditions; no claim that one elapsed assertion proves complexity                                    |
| REQ-003: equivalent differential support preservation | AC-003: same support origins/assertions/derivations, precedence, correspondence, created records, qualifications and captured output as the independent baseline; fewer canonicalizations for proven unaffected content                                |
| REQ-004: indexed atomic mutation                      | AC-004: correct lookup after every insert/remove/replace/endpoint/ontology operation, unchanged order and errors, reserved-handle protection, measured direct-lookup scaling without overstating total edit complexity                                 |
| REQ-005: less redundant copying with intact ownership | AC-005: no caller/old-revision mutation or untrusted publication; preserve descriptor/Unicode/depth/graph/qualification validation and accounting meaning; demonstrate reduced allocations and no unreachable intermediate retention                   |
| REQ-006: faster independent corpus access             | AC-006: all pin, bundle, encoding/path and tampering controls remain; returned bytes independently mutable; decoded-byte/verification caching bounded to declared ownership; cold/warm suite cost measured separately                                  |
| REQ-007: resource and cancellation compatibility      | AC-007: correct finite and unbounded options, precise charge semantics, error priority and polling/deadline behavior across old/new paths; no desktop-profile change hidden in optimization                                                            |
| REQ-008: browser and realistic-ontology relevance     | AC-008: current production worker chain and URD closure measured with transport/stage/main-thread/memory attribution; valid semantic edit, stale-result rejection, cancellation, recovery and disposal demonstrated                                    |
| REQ-009: reproducible, independent evidence           | AC-009: exact source and harness identities, fixture hashes/options, runtime/host/admission receipts, raw samples, failures and statistic definitions retained; old and new evidence not conflated                                                     |
| REQ-010: recoverable delivery                         | AC-010: accepted slice selection and exact configuration approvals, completed applicable review/security/profile checks, retained compatible baseline, assigned observer and explicit cleanup/recovery disposition                                     |

| Quality scenario                     | Stimulus / environment                                                                                                                    | Required response and evidence                                                                                                  |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| QA-001: collision scaling            | Dense `generated0…` prefix, sparse/gapped handles, user subject/role/expression collisions and duplicate occurrence keys                  | Unique deterministic temporary IDs, exact output equivalence, monotonic work bound; empty/minimal graphs unchanged              |
| QA-002: hostile/cancelled allocation | Long occupied prefix, expiry or genuine cancellation during the first collision scan                                                      | Observe the existing work-visit/deadline contract; reject without publishing a partial model                                    |
| QA-003: provenance preservation      | No-op, isolated insert, replacement, alias merge, deletion/null correspondence, endpoint change and imported/source-qualified data        | Exact support precedence and facts, no lost or invented assertions/derivations, correct remapped qualifications                 |
| QA-004: mutation order               | Remove first/middle/last then address later records; insert-then-edit; multiple removals; remove-and-reuse-handle; forward references     | Correct index lifecycle, stable collection order, expected failures, atomic rollback and unchanged input                        |
| QA-005: snapshot boundary            | Accessors, symbols, unsafe prototypes, cycles, shared children, invalid Unicode/numbers, deep input and caller mutation                   | Same safe snapshot/admission behavior and error precedence, no skipped validation through an optimized ownership path           |
| QA-006: finite/unbounded limits      | Tight inclusive counters, large safe integers, `Infinity`, zero deep-iteration allowance, expired/cancelled operation and host exhaustion | Current package/application separation and native errors preserved; no quadratic counter inflation or bypass                    |
| QA-007: corpus independence          | Tampered bytes, forged self-digest, conflicting frozen pin, duplicate entry, invalid encoding/path, modified returned Buffer              | Reject invalid evidence and isolate callers; preserve frozen expected outputs, no production-generated oracle                   |
| QA-008: worker lifecycle             | Large-chain/URD edit, replacement, late reply, import failure, cancel, capture/recovery and disposal                                      | Current generation/revision only; whole worker deadline honored; no retained retired workers/models; source contents private    |
| QA-009: performance attribution      | Paired current-baseline/candidate cohorts on admitted quiet host, profiler and uninstrumented controls                                    | Separate setup/edit/transport costs, counts, allocations, GC and memory; retain slow/failed samples and corroborate breaches    |
| QA-010: delivery recovery            | Regression after stage or package/application promotion                                                                                   | Stop promotion and restore a retained compatible candidate or execute an approved forward fix without discarding unrelated work |

## 6. Decisions, architecture and reuse

### 6.1 Decision register

| ID      | Decision / constraint                                                                                    | Owner and status                                                          |
| ------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| DEC-001 | Accept scope, risk route, baseline, performance targets and metric definitions                           | Repository owner; open                                                    |
| DEC-002 | Resolve retained execution ownership and select how to qualify the existing uncommitted HOT-01 candidate | Repository owner; open; no adoption here                                  |
| DEC-003 | Choose deterministic complexity/cancellation proof and placement of timed CI checks                      | Integration/verification owners; open                                     |
| DEC-004 | Approve an exact support-equivalence predicate and conservative fallback                                 | Domain/provenance reviewer; open; ID-only bypass rejected as insufficient |
| DEC-005 | Select mutation-index representation and ordered update/compaction semantics                             | Package/integration owner; open                                           |
| DEC-006 | Select a specific snapshot-removal seam and establish private ownership/validation proof                 | Package owner and native security assessor; open; no public trusted flag  |
| DEC-007 | Define corpus cache identity, independent pin authority, mutation isolation and lifetime                 | Corpus/oracle owner; open                                                 |
| DEC-008 | Select full-chain/URD/browser cohorts and disposition of resource-profile recalibration                  | Repository owner and benchmark observer; open; profile remains unchanged  |
| DEC-009 | Approve exact configuration/settings changes if implementation needs them                                | Repository owner; open; no file/configuration approval implied here       |
| DEC-010 | Select release artifact set, observation window, rollback conditions and retention                       | Release owner; unassigned/open                                            |

NAM-01 applies to new or behaviorally changed names.
`nextOrdinal` denotes the next generated temporary-ID candidate within one projection call, not a persistent model ID issuer.
A support fast path must name the equivalence it proves rather than call anything absent from the request “unchanged.”
A corpus cache must distinguish decoded bytes, bundle integrity and independently pinned verification.
No prior NSH-01 no-shim override is assumed; do not add public aliases or compatibility flags as shortcuts.

### 6.2 Architectural seams and DRY-01 decisions

The likely files are predictions, not approved edits.
Consolidate rules only when authority, consumers, ownership, failure and deployment boundaries match.

| Rule / current authority                                                                        | Consumers and boundary                                                                 | Reuse strategy / deliberate separation                                                                                                                                             |
| ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Projection generation and bijection in `projection.js`                                          | `normalizeDraft`, `validateProjection`, live edit/admission and package artifact paths | One allocator state per generation; retain key deduplication and validation-mode behavior; no second identity scheme                                                               |
| Provenance matching in `liveModel.js` using `jsonKey` and typed correspondence                  | Live edit, qualifications, capture/recovery/export                                     | Preserve the existing matching/precedence rule; share proven semantic equivalence rather than duplicate an ID-only approximation                                                   |
| Typed ID/reference traversal in `typedValues.js` and current descriptors                        | Normalization, successor mapping and support comparison                                | Reuse schema-aware interpretation; do not maintain a second hand-written field list that drifts on new record types                                                                |
| Mutation intent in `editing.js`                                                                 | `edit` and `editModel`, normalization/source guards                                    | One ordered transaction index owned by the draft; retain reserved-handle semantics and normalization authority                                                                     |
| Safe snapshots in `snapshot.js`, admission/publication in `liveModel.js`                        | Caller inputs, drafts, recovery, inspections and captured values                       | Remove only a proven redundant internal copy; keep independent trust/ownership boundaries; existing private `publishValidatedState` is not proof that an edited draft is validated |
| Counts/errors/deadlines in `ResourceBudget` and operation-owned snapshot tracking               | All package stages; application worker selects its own limits                          | Preserve one operation budget and current count meaning; memory measurement remains separate from acceptance counters                                                              |
| Storage integrity in `conformance/storage.mjs`; independent pins in `test/independentCorpus.js` | Corpus tests, storage verification/provenance tooling and reader instances             | Reuse native Buffer/SHA-256; cache within a documented immutable ownership scope while retaining both evidence authorities                                                         |
| Production operation lifecycle in worker client/policy/operations                               | Browser edits, imports, capture/recovery and currentness                               | Reuse current worker protocol and measuring tools; no new worker pool or source of model truth                                                                                     |

### 6.3 Native reuse, current versions and rights

Prefer the existing allocator, Map/Set, typed descriptors, canonical serializer, operation budgets, snapshot/publication functions, corpus reader and browser worker protocol.
No new package or runtime upgrade is selected.
New dependencies would require maintained-version/LTS research, consumer compatibility, actual license/terms clearance and an identified residual gap before adoption; absence of a local tool is not permission to select an obsolete alternative.

Keep current licenses and independent corpus/provenance notices. Do not replace SHA-256 or JCS to save time. Use native Node inspector CPU/heap profiling and existing production/browser tools for measurement; their outputs need exact runtime and source identity. [Node inspector documentation](https://nodejs.org/api/inspector.html).

## 7. Vertical implementation slices

The slices below are proposed.
Each ends with an observable result and evidence, including the option to reject an optimization.
No slice is authorized merely because its files are listed here.

### SLICE-001 — Bind the current candidate and recover comparable evidence

**Outcome:** A reviewer can identify exactly which source, input, limits and harness produced each claim before selecting implementation.

- Resolve DEC-001/002 and assign integration/verification owners.
  Recheck current working-tree changes and execution ownership; retain the pre-existing patch and its authorship/disposition.
- Recover source audit scripts, profiles, logs, options and interrupted-run receipts.
  Bind baseline HEAD, candidate patch/source hashes, dependency/runtime identities and fixture definitions.
  Do not regenerate an old baseline by restoring current task files.
- Identify `N`, occurrence count, total records, serialized bytes and charges separately at each chain size.
  Record setup, isolated edit, capture/recovery and whole worker boundaries.
- Establish current support serialization/copy/lookup/corpus work counts.
  Use deterministic characterization first; reserve the 204-second baseline for a bounded justified experiment, with a declared timeout and retained incomplete result if stopped.
  Do not replay slow scratch probes automatically.
- **Proof:** REQ-009, AC-009, QA-009; reproducible manifest, error-free representative correctness path and selected benchmark design.
  Source claims without recoverable artifacts stay explicitly unverified.
- **Release/cleanup:** No product change is needed to finish this slice.
  Retain baseline/candidate identity and evidence inventory; keep private URD closure contents local.

### SLICE-002 — Qualify the existing ordinal repair and its regression protection

**Outcome:** A complete single insert on an admitted chain preserves semantics and no longer repeats the generated-ID search quadratically.

- Predicted files: `packages/vowl/src/projection.js`, `packages/vowl/test/projection.test.js`, `liveModel.test.js` and resource-polling tests; an isolated benchmark harness only if retained tooling is insufficient.
  Preserve the existing candidate as the starting point.
- Establish the allocator invariant: the cursor is local to one projection, occupied IDs cannot become free during that generation, previously emitted IDs remain reserved, and duplicate semantic keys return their original ID without emitting another occurrence.
  Under this invariant, skipping already rejected ordinals must preserve the reference allocator's result.
- Cover normalizing and validating modes, dense/gapped prefixes, colliding subject/role/expression handles, empty/minimal graphs, repeated occurrence keys, edges/labels and generated endpoint references. Preserve the validation cardinality guard, actual/expected bijection and canonical bytes.
  Do not infer correctness solely from uniqueness.
- Count candidate attempts independently through the existing context boundary and a test-owned expected bound.
  Use several occupied-prefix/output sizes so the original reset-per-call strategy fails deterministically.
  Avoid a tautological assertion that merely inspects the candidate's counter variable.
- Prove cancellation/deadline responsiveness during a long collision prefix.
  The present loop lacks its own poll; any selected repair must use the current budget semantics and respect the at-most-1,024-visits contract without increasing limits.
  Retain genuine cancellation and deadline controls as separate cases.
- Qualify the existing timed test on the agreed runner.
  The source's under-one-second 1,000-class target remains an optional accepted performance gate, not a substitute for deterministic work evidence.
  Whole-file completion under 1.5 seconds is unresolved.
  Preserve functional revision, inserted content, references, correspondence, capture and recovery checks.
- **Proof:** REQ-001/002/007/009, AC-001/002/007/009, QA-001/002/005/006/009; deterministic work bound, independent baseline equivalence and admitted uninstrumented scaling cohorts.
  The reported 10,000-class 5.538-second result must be reproduced with explicit limits before crediting the candidate.
- **Release/cleanup:** This slice may be assessed/released independently of larger optimizations once applicable review, final profile and application acceptance are complete.
  Record whether the original user-owned patch is retained, minimally amended or rejected; do not overwrite it from the audit's diff.

### SLICE-003 — Preserve support provenance without unnecessary canonicalization

**Outcome:** A real edit transfers exactly the same supports/qualifications with less comparison work for proven unaffected records.

- Depends on SLICE-001 and preferably the qualified HOT-01 baseline so timing is attributable.
  Predicted files: `liveModel.js`, existing typed-reference/semantic helpers only where necessary, and live/source/provenance/capture tests.
- Define an equivalence predicate covering record content after successor mapping, all relevant typed references, aliases and dependency changes.
  Preserve source/non-edit support preference when several old records converge.
  An ID-only test or checking only explicit request membership is insufficient.
- Retain the current canonical comparison as a conservative fallback for unresolved changed/retargeted records.
  A private typed comparison or proof of unchanged mapped content may avoid serialization; do not replace JCS globally or introduce a second ad hoc serializer.
  The fallback must not duplicate all old work on every supposedly fast edit without measurement.
- Include isolated insert, no-op, same-ID content replacement, endpoint changes, deduplication, role promotion, pruning, many-to-one/null correspondence, regenerated occurrences, imported assertions, uncertainty guards and portable/source qualifications.
  Preserve origin, assertion/derivation order where significant and final capture bytes.
- Measure canonicalization calls/bytes, support-phase time, total edit time, allocated bytes and GC independently on chain and URD inputs. The source's 15–20%/about-900-ms gain, about-60,000-call removal and more-than-60% GC reduction are hypotheses; zero canonicalization for changed records is not required by the proposed safe fallback.
- **Proof:** REQ-003/007/009, AC-003/007/009, QA-003/005/006/009; independently expected supports plus differential complete outputs, malformed/source guard cases and paired measurements.
  A native security/domain reviewer owns provenance-integrity assessment.
- **Release/cleanup:** Retain only a demonstrated fast path; no cross-revision/global support cache.
  If equivalence cannot be proven, keep the current comparison and report the result.
  This slice must not require snapshot removal to claim correctness.

### SLICE-004 — Index one complete atomic mutation path

**Outcome:** Large edit batches avoid repeated direct record scans while producing the same ordered atomic result and failures.

- Predicted files: `editing.js`, `edit.test.js`, `editing-feasibility.test.js`, `editing-resource-regressions.test.js` and live-model tests.
  First measure direct lookup contribution for small and large `K`; an extra `O(N)` index may not help a single insert.
- Decide whether to maintain locations, stable record handles or another internal representation with bounded final compaction.
  Include index construction, updates, removals and materialization in cost.
  Do not retain stale positions after `splice`, use unordered swap deletion, or rebuild the full index after every request while claiming `O(N+K)`.
- Keep original/reserved handles unavailable for reuse throughout the transaction, including removed and occurrence handles.
  Inserted records must become visible according to existing request semantics; forward references, typed checks, precise request error pointers and failure ordering remain unchanged.
- Preserve retargeted assertion-anchor behavior, ambiguous aggregate endpoint rejection, ontology replacement, repeated operations on one handle and normalization output.
  Keep an unchanged old model on any failure and clear temporary index references after completion/rejection.
- **Proof:** REQ-004/007/009, AC-004/007/009, QA-004/006/009; remove-first/middle/last then replace, multiple removals, insert/replace/remove sequences, illegal reuse, dependencies and source-backed cases.
  Report direct-lookup counts and full transaction timing separately.
- **Release/cleanup:** Integrate only if the selected workloads justify index/memory cost.
  No new public edit dialect or persistent index ownership.
  Revert only candidate indexing changes if semantics or small-batch performance regress.

### SLICE-005 — Remove only proven redundant internal snapshots

**Outcome:** An edit retains exact ownership/admission semantics with less measured copying or freezing.

- Requires DEC-006 and the current counting-contract review.
  Predicted files: `liveModel.js`, `snapshot.js` only if needed, typed traversal helpers and ownership/resource/corpus tests.
  Review public package changes with the native security assessor.
- Separate two experiments: compare old records through typed successor mapping without constructing the entire `renamedBefore` tree; and transfer an already owned internal draft to validation/publication without a second ownership snapshot. Measure/adopt independently so failure attribution remains clear.
- The edited draft is owned, but mutation can invalidate it.
  Any copy-elision path must still execute required structural/meaning/projection/qualification validation before private publication.
  The existing `publishValidatedState` precondition cannot be asserted from a caller flag or inferred merely from “came from an old admitted model.”
- Avoid proxy-based views that introduce getters/traps or violate plain-data expectations. Prove no references to caller objects, request records or mutable prior trees escape. Preserve shared-by-value handling, prototype/descriptor checks, Unicode/number/depth validation and the original model's immutability even on failure.
- Preserve operation-budget scope and unique-value accounting.
  Removing a copy does not justify removing its independent validation or falsifying counts.
  Identify any intentionally removed temporary value and compare inclusive boundary/error behavior; changed accounting meaning requires a separate accepted contract decision.
- If optimizing `deepFreeze`, already-frozen membership is trustworthy only for recursively established internal ownership; a caller's shallow freeze proves nothing.
  Preserve full publication immutability and per-operation cleanup.
- **Proof:** REQ-005/007/009, AC-005/007/009, QA-005/006/008/009; alias/mutation probes, descriptor/Unicode/resource corpus, old/new model equivalence, cancellation/deadlines, capture/readmission and allocation/retainer profiles.
  Separate snapshot time, freeze time, GC, peak RSS and post-disposal reachable heap.
- **Release/cleanup:** The source's 25% CPU forecast is conditional.
  Reject any shortcut that weakens admission.
  No persisted schema migration is intended; if new state/trust markers become externally visible, stop and replan.

### SLICE-006 — Cache corpus decoding without weakening independent verification

**Outcome:** Conformance tests read the same independently verified, caller-owned fixture bytes with less repeated decoding/hashing work.

- Predicted files: `packages/vowl/conformance/storage.mjs`, `packages/vowl/test/independentCorpus.js`, corpus storage/provenance/preservation tests and native storage probes.
  First attribute cold bundle loading, per-member decode, external hashing, file I/O and module initialization across Jest environments.
- Reuse the existing per-reader bundle cache.
  A decoded-byte cache must keep its internal bytes inaccessible and return an owned copy.
  Quantify extra resident memory and bytes copied; a cache is not zero-copy if caller isolation requires a fresh Buffer.
- Any pin-verification memo must record actual immutable content identity plus expected root/path/hash/length.
  Preserve independent pin checking when references differ, reject conflicting pins and never trust only the bundle's self-declared digest.
  Do not silently memoize mutable filesystem paths across changes or across unrelated readers.
- Define one reader's content-consistency policy and cache bounds before changing behavior.
  Preserve explicit bundled storage family, missing-member rejection, duplicate/routing checks, encoding roundtrip, length, path/root containment and no fallback to a stale loose artifact.
- Keep original manifests, expected outputs, independently derived vectors and license/provenance data unchanged.
  Do not regenerate golden data from the implementation or remove integrity checks to meet a suite-time target.
  Existing caches may be instantiated once per isolated Jest environment; do not assume one process-global cache will span them safely.
- **Proof:** REQ-006/009, AC-006/009, QA-007/009; forged embedded hash with wrong external pin, wrong expected length, conflicting pins, tampered/missing member, bad encoding/path, mutation of returned buffers, separate roots/readers and cold/warm runs. Existing storage/provenance validators remain independent controls.
- **Release/cleanup:** Test-infrastructure-only change can be delivered independently.
  Retain cache lifetime/peak-memory results and actual suite speedup.
  The reported 20–30 seconds and “50%” are approximate forecasts, not interchangeable exact arithmetic against 64.086 seconds; do not move decoding outside the timed region to manufacture savings.

### SLICE-007 — Qualify the full browser edit and URD resource envelope

**Outcome:** The core improvement demonstrably helps a real browser edit without losing currentness, resource enforcement, source fidelity or recovery.

- Predicted areas: existing worker/session/production measurement utilities and package browser harnesses; product instrumentation only if selected.
  Reuse the current worker protocol.
  `postMessage` uses structured cloning (with transfer semantics where explicitly selected), so separate sender serialization, queue delay, worker work, reply transport and main-thread acceptance rather than infer them from Node time.
  [Worker messaging](https://developer.mozilla.org/en-US/docs/Web/API/Worker/postMessage).
- Measure chain load/edit at approximately 30,000 occurrences and the approved URD closure, including its ISO/IEC 11179 and SKOS imports where that is the selected fixture.
  Bind full local hashes and import versions; the older profile's 1,139,625-byte URD primary document is historical context, not sufficient closure identity.
- Include broad property/axiom-heavy, domain/range, disjointness, shared expression, dense/deep and source-backed edits; match baseline/candidate inputs and meaningful changes.
  Keep canonical output, support facts, capture/source/export and recovery comparisons.
- Report cold worker startup, checkpoint readmission, edit, ordering/projection, capture/snapshot, transport and first usable accepted frame separately.
  The application's 60,000-ms whole-operation deadline is a failure boundary; an isolated 5.538-second core edit does not certify it or constitute an interaction SLO.
- Exercise finite desktop policy, explicit tighter limits, the current package's allowed unbounded diagnostics, cancel/deadline, import failure, replacement, stale reply, teardown and ten repeated lifecycle cycles. Unbounded diagnostics cannot qualify a finite-profile run. Keep process RSS, worker/main-thread JS heap, peak allocation and retained old revisions distinct.
- **Proof:** REQ-007/008/009, AC-007/008/009, QA-006/008/009; native browser correctness/lifetime evidence and paired uninstrumented timing with separate profiles. Real constrained-memory/mobile evidence remains pending until devices/conditions are selected.
- **Release/cleanup:** Report desktop-profile recalibration evidence to the owner; do not change its settings.
  Preserve safe allowlisted counter/stage quantities and application error projection. Keep private ontology content and unsanitized heap/CPU traces out of external review.

### SLICE-008 — Consolidate regression gates and qualify a selected release

**Outcome:** The selected slices have coherent, current correctness/performance/security evidence and a usable recovery path.

- Accept numerical criteria and runner/environment conditions before wiring timing into CI. Prefer deterministic collision-work, semantic, ownership, pin-integrity and resource/cancellation checks for ordinary CI; use admitted benchmarks for absolute elapsed claims.
- Freeze the selected source and production/package artifact identities. Run focused then impacted checks and route-selected final profiles, ordinary review and applicable native security/corpus-oracle review.
  Reuse still-applicable evidence rather than repeatedly rerunning unchanged checks; new changes invalidate affected evidence.
- Resolve every reported regression and distinguish a rejected optional optimization from an unmet accepted requirement.
  A qualified HOT-01 delivery may exclude HOT-02–05 rather than wait for speculative rewrites.
- Assess release readiness: compatible APIs/checkpoints/canonical bytes, finite-policy behavior, package/application consumer binding, browser resource evidence, named observer, abort criteria and retained recovery artifacts.
  Keep implementation completion, review, package publication and application deployment separate.
- **Proof:** All selected REQs/ACs/QAs; signed-off decisions, exact candidate test/profile receipts, retained raw outcomes and documented limits.
  No count-only “all tests pass” statement substitutes for the exact final source binding.
- **Release/cleanup:** Commit/sign/push/publication/deployment require their own authorization.
  Keep baseline, accepted evidence, failed samples and necessary recovery assets; remove only task-owned scratch/caches after their retention role is settled.

### 7.1 Dependencies and traceability

| Slice     | Requirements / acceptance / quality / decisions                    | Dependencies and falsifiable proof                                            | Release / cleanup implication                                               |
| --------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| SLICE-001 | REQ-009; AC-009; QA-009; DEC-001/002                               | Current source, fixture/option/harness receipts and accepted scope            | Preserves user-owned candidate and baseline; no implementation              |
| SLICE-002 | REQ-001/002/007/009; matching ACs; QA-001/002/005/006/009; DEC-003 | 001; deterministic collision bound, poll control, exact outputs and timing    | Small candidate can release independently after applicable final gates      |
| SLICE-003 | REQ-003/007/009; matching ACs; QA-003/005/006/009; DEC-004         | 001; preferably qualified 002; provenance equivalence and serialization count | Conservative fallback retained; no cross-revision cache                     |
| SLICE-004 | REQ-004/007/009; matching ACs; QA-004/006/009; DEC-005             | 001; ordered mutation cases, index work/memory and complete output            | Transaction-owned index; clear after success/failure                        |
| SLICE-005 | REQ-005/007/009; matching ACs; QA-005/006/008/009; DEC-006         | 001/002; coordinate with 003's mapped comparison; ownership/security proof    | No weakened admission; no public trust marker                               |
| SLICE-006 | REQ-006/009; matching ACs; QA-007/009; DEC-007                     | 001; independent pin/tamper controls and cold/warm profiling                  | Separate test-infrastructure delivery; bounded private cache                |
| SLICE-007 | REQ-007/008/009; matching ACs; QA-006/008/009; DEC-008             | 002 and each selected core change; current production manifest                | Whole-operation/lifetime qualification; profile recalibration proposal only |
| SLICE-008 | All selected REQs/ACs/QAs; DEC-001/009/010                         | Selected slice proof, final review/profiles, release/recovery evidence        | Explicit publication authority and observer; retain rollback evidence       |

The audit's first two priorities (ordinal fix and regression test) are one coherent delivery in SLICE-002; support matching remains the next structural candidate.
HOT-04 can be studied independently of support comparison, and HOT-05 has a separate test-infrastructure boundary.
Support matching/snapshot elision share provenance and ownership assumptions and require one integration owner. All core changes share resource/corpus verification.
Parallel write work is not authorized by this plan; no subagents are launched.
Performance runs are sequential and quiescent, never concurrent with tests/builds or other benchmarks.

## 8. Verification and benchmark design

### 8.1 Oracle ownership

- **Semantic/canonical oracle:** existing independently pinned corpus, core/projection/editing contracts and exact captured bytes.
  Production output must not generate new expected fixtures for its own approval.
- **Provenance oracle:** independently specified support/qualification/correspondence cases, supplemented by differential comparison with the retained baseline.
  Keep non-edit support precedence and null/many-to-one mappings explicit.
- **Algorithmic oracle:** test-owned collision/lookup counters and a justified bound across input sizes, observed through real boundaries.
  Timing alone does not prove Big-O; a private implementation counter alone does not prove behavior.
- **Resource/cancellation oracle:** current accepted limits/counting rules, native `ResourceBudget`, genuine cancellation/expiry and independent finite-boundary cases.
  Distinguish allocation, counters, retained heap and RSS.
- **Corpus oracle:** external frozen pins and provenance, separate from bundle metadata.
  Tests must demonstrate that corrupted evidence fails, including when self-declared hashes match the corruption.
- **Browser oracle:** real Worker transport, native browser memory/lifecycle and current application generation/revision behavior.
  Node/Jest mocks cannot establish browser performance.

Mocks may isolate genuine external boundaries: filesystem failure, network/import delivery, clock/expiry, worker transport failure or host-resource failure.
Do not mock the validator, serializer, support comparator or corpus pin check to prove their optimization correct.
Change an oracle only with independent justification and review, never because the candidate disagrees.

### 8.2 Focused and impacted commands

The following commands reference currently present suites/scripts, run from the repository root during authorized implementation. They are not an execution record for this document. Choose relevant checks by slice and broaden when changes/failures justify it.

```powershell
# HOT-01 and public edit/projection behavior.
npm test -- --runInBand packages/vowl/test/liveModel.test.js packages/vowl/test/edit.test.js packages/vowl/test/projection.test.js

# Resource accounting, cancellation and mutation boundaries.
npm test -- --runInBand packages/vowl/test/resourcePolling.test.js packages/vowl/test/resourceBudget.test.js packages/vowl/test/unboundedLimits.test.js packages/vowl/test/editing-resource-regressions.test.js

# Provenance/normalization and real source-backed model behavior.
npm test -- --runInBand packages/vowl/test/editing-feasibility.test.js packages/vowl/test/editingCorpus.test.js packages/vowl/test/owlLiveModel.test.js packages/vowl/test/compatibleArtifact.test.js

# Corpus cache integrity and independent evidence.
npm test -- --runInBand packages/vowl/test/corpusStorage.test.js packages/vowl/test/corpusProvenance.test.js packages/vowl/test/corpusPreservation.test.js
npm run check:corpus-storage

# Final package/application checks, selected by the accepted route.
npm run test:vowl
npm run lint:js
npm run format:app:check
```

`test:vowl` already checks corpus storage before running package tests; avoid duplicating it in the same unchanged verification sequence solely because both commands are listed.
The source used `npm test -- --runInBand packages/vowl`, which does not express that extra prerequisite by itself.
Inspect the actual `focused`, `affected` and `full` HISEW commands before selecting final profiles; a configured profile name is not evidence of coverage.
Use `npm run check` when the accepted route requires the full repository pipeline, not automatically for this draft.

### 8.3 Harness retention and commands

The audit names `bench_chain.mjs`, `bench_current.mjs`, `bench_10000.mjs`, `profile_edit.mjs`, `profile_10000.mjs`, `sim_alloc.mjs` and tracing/ID inspection helpers.
Its command is retained below as historical usage, not asserted to be an installed repository command:

```powershell
node --max-old-space-size=4096 scratch/bench_10000.mjs
```

Before using it, locate and hash the actual script, inspect options/workload/timing boundaries and confirm the selected runtime and safe evidence output.
If missing, define a small maintained edit-scaling harness under a suitable package script/util location after implementation authorization. The intended CLI must identify the exact baseline/candidate, chain sizes, changes, limit profile, warmup/repeats, output directory and timeout behavior.
A proposed filename is not an existing capability.

Planning inspection confirmed that `scratch/bench_10000.mjs` is absent at that repository-relative path.
The source command cannot currently be treated as a reproducible ready-to-run check; a copy elsewhere or retained evidence may still exist.

Reuse `assertQuiescentMachine` from `util/benchmarkEnvironment.mjs` and existing evidence conventions.
The similarly named `util/benchmark-canonical-performance.mjs` currently benchmarks scene/inspection/link paths; it does not by name alone supply this package edit workload.
Do not substitute it and claim the requested chain test ran.
Native `node:inspector` CPU/heap profiles are diagnostic companions to uninstrumented latency runs, not replacements for them.

### 8.4 Measurement protocol

1. Freeze source/dependency/harness and input identities, including the existing patch; record actual Node/V8/npm, OS/CPU/RAM, browser version, power mode, worker/build manifests, viewport where relevant and all explicit limits.
   Keep package default, finite desktop, tighter custom and unbounded diagnostic modes separate.
2. Follow ADR 0003: release-gated benchmarks run in the foreground on an otherwise idle host, with the existing 10% busy-fraction/500-ms guard.
   Do not stop unrelated user work to force admission or inherit a previous busy-host exception.
3. Agree sampling before collecting: proposed one discarded warmup and at least twenty measured observations per admitted size/candidate for ordinary latency comparisons, with median/nearest-rank p95, maximum and raw samples.
   This is a proposed protocol, not a source-reported one.
   Use deterministic work evidence for the pathological old large case; obtain an explicit bounded protocol if twenty very slow baseline repeats are disproportionate.
4. Pair/balance baseline and candidate runs; each measured edit begins from the same admitted graph/revision and request.
   Separate fresh-process startup, setup/population, single edit and capture.
   Repeatedly editing the growing result changes the workload and must be labeled as lifecycle testing instead.
5. Record class/record/occurrence counts, content size and shape.
   Chain regularity does not cover URD's broad properties, disjointness, domain/range or anonymous/shared structures.
   Include small/no-op cases so an index or cache does not improve only the largest synthetic case.
6. Gather uninstrumented timing and separately instrumented call counts, allocations, CPU, GC and heap/retainer data.
   Disclose sampling overhead.
   A CPU percentage, lookup count and wall-clock duration are different signals; do not add overlap or infer cause from correlation alone.
7. Keep every failed, slow, cancelled and timed-out run.
   A threshold breach needs independent corroboration under ADR 0003.
   Exclude demonstrably invalid observations only with retained evidence and a reason; no rerunning until the target passes.
8. For memory, include initial/candidate peak, expected current and deliberately retained prior revisions, and post-release/disposal heap.
   Use positive controls to show the leak detector sees a known retained owner.
   GC timing is noisy; report distributions and ownership evidence rather than one forced-GC total.
9. For corpus work, measure cold reader/bundle/module initialization and warm accesses separately, with equivalent suite coverage.
   Include owned-copy cost and cache peak/retained bytes.
   No preloaded work omitted from totals to claim a speedup.
10. Retain profiles/manifests privately where they can include ontology labels, IRIs, source content or local paths.
    Share sanitized evidence and approved real filenames as needed; private source contents remain private.

### 8.5 Budget and gate register

| Source gate / target                              | Proposed disposition                                                                                                                                                                   |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1,000-class single insert under 1,000 ms          | Keep as a proposed absolute gate on a named admitted runner. Source prose also says `≤1,000`; select one inclusive boundary explicitly. Existing code uses `<1,000`                    |
| Whole scaling-test suite under 1.5 seconds        | Unsubstantiated; measure setup/file costs separately before accepting. Do not loosen a test timeout or delete tests to achieve it                                                      |
| 10,000-class edit under 60 seconds                | Preserve as a core diagnostic target plus separate whole-browser-operation acceptance under the existing desktop deadline. Raw 5.538-second Node result is insufficient for the latter |
| Primary-record charge `O(K)`                      | Replace unsupported delta-only claim with current unique-value accounting and demonstrated nonquadratic growth; no hidden public accounting change                                     |
| Embedded values not proportional to `N²`          | Count actual semantic/projection growth separately from avoidable repeated work; dense valid graphs can grow differently from chains                                                   |
| Post-edit heap proportional only to delta `K`     | Require bounded current/prior revision ownership and reclamation of unreachable intermediates; an immutable full revision can legitimately use `O(N)` storage                          |
| Remove about 60,000 support canonicalizations     | Measure safe fast-path coverage and changed-record fallback; treat count as workload-dependent, not universal                                                                          |
| More than 60% lower GC pause; 15–20% faster edits | Hypotheses for HOT-02, not guaranteed consequences or automatic CI criteria                                                                                                            |
| 25% lower CPU / lower RSS                         | HOT-03 experiment hypothesis; preserve all admission and ownership checks                                                                                                              |
| 20–30 seconds / about 50% faster suite            | HOT-05 hypothesis; same complete corpus verification and independent pins remain required                                                                                              |

Deterministic resource/error/collision/pin gates can run in ordinary CI once meaningful tests exist. Timing and memory gates need selected environment, baselines, tolerance/noise rules and artifact binding.
Missing or unquiet evidence is not a pass.
Do not raise limits or suppress failures to satisfy a performance gate.

## 9. Configuration and policy boundary

No configuration is changed by this document.
`AGENTS.md` requires explicit approval for the exact file and setting, including build, package/lockfile, test, CI, environment and repository policy.
Scope acceptance for an optimization does not substitute for that approval.

| Potential change                                                                            | Smallest reviewable proposal and impact                                                                                         | Required disposition                                                                                                                                    |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.github/workflows/webvowl-ci.yml`: performance/evidence job or step                        | Identify exact runner, command, admission/evidence inputs and failure behavior; preserve existing CI scope/evidence-reuse logic | DEC-009 before editing; no noisy shared-runner result represented as a reliable absolute gate                                                           |
| `package.json`: benchmark script or Jest settings; lockfiles if dependency needed           | Prefer existing commands/native runtime. Present exact script/setting/dependency and installation/test impact if unavoidable    | No timeout, concurrency or dependency change without exact approval                                                                                     |
| Any new benchmark/test configuration or baseline manifest treated as policy                 | Define metric/fixture/limits authority and ownership first                                                                      | New files are not exempt from configuration approval                                                                                                    |
| `src/app/js/controller/canonicalVowlWorkerPolicy.js`: application resource-policy constants | Current desktop profile remains unchanged; recalibration supplies evidence, not automatic new limits                            | Exact setting change requires owner decision and configuration/policy approval                                                                          |
| Frozen corpus manifests, provenance or normative limits contracts                           | No change selected; caches and optimization must preserve their evidence role                                                   | Do not regenerate/re-pin expectations to make a candidate pass; a real contract amendment requires separate approval and independently derived evidence |

Prepare a concrete minimal proposed diff and behavioral/pipeline impact before asking for a dependent configuration change.
Stop only that dependent work pending approval; other already authorized independent work may continue.
No permission request is needed merely to save this draft.

## 10. Compatibility, security, release and recovery

### 10.1 Compatibility and migration

No persisted data/schema migration, backfill or saved-view conversion is intended. Canonical bytes, public API shape, live-handle correspondence semantics, source archives and checkpoint implementation/policy remain unchanged.
The ordinal is internal per invocation; no migration of user ontology IDs is planned.
If a candidate changes any of those contracts, stop and add an explicit versioning/migration/reconciliation plan rather than labeling it a performance-only change.

Preserve separate package/application limit policies, existing finite-limit errors and permitted unbounded options.
A new cache or private owned-draft path must not change caller mutation rights, transfer behavior or supported source domains.
Corpus storage format and evidence pins should remain compatible; adding a cache does not authorize a new bundle format.

### 10.2 Security and privacy work

The native security assessor owns review of snapshot/admission/resource changes, and the domain/corpus reviewer owns support and oracle integrity. Inspect unsafe values, prototype/accessor/symbol handling, cycles, invalid Unicode/numbers, depth, cancellation/error priority, source/qualification guards and independent pin verification.
Do not export a trusted-state constructor or cache validation authority across workers.

The package's accepted unbounded options are not a reason to remove cancellation checks or finite consumer policy.
Cache identity and immutability must resist cross-reader/path/pin confusion.
The prior model must remain intact after any rejected edit.
Node profiling that binds only locally still produces potentially sensitive output; no remote profiler/debug port or external trace upload is needed by this plan.

### 10.3 Interruption and resumption

After each selected slice, record source/patch identity, decisions, completed/failed checks, raw evidence and owned resources.
On resumption, recheck current source and execution ownership.
Preserve other sessions' work and never restore a previously seen file version just because it changed.
Use current contents as the starting point and raise a material conflict rather than silently resolving it.

Caches/indexes are operation/reader-owned and must release references on completion, failure and disposal.
A cancelled browser edit cannot publish a partial revision; a resumed task must revalidate currentness rather than replay a stale request.
Reuse earlier evidence only when source/input/environment applicability still holds.

### 10.4 Rollout and production acceptance

1. Resolve prerequisites, accept selected slices and retain a baseline independent of the current working-tree patch.
   Preserve user-owned modifications and their disposition.
2. Qualify the narrow ordinal fix and its guards first.
   Review subsequent support/index/copy/cache candidates individually and in their actual selected combination.
3. Freeze the final source, run route-selected verification/review and current package/browser benchmarks, then assess release readiness separately from source completion.
4. With explicit authorization, publish the exact package/application candidate through its existing delivery process.
   No new dependency cutover or build setting is assumed.
5. Stage/test chain and URD edit, source/provenance/capture/export, cancellation, error reporting, recovery and disposal against exact assets.
   Application consumer integration must be bound to the package revision actually qualified.
6. A named observer reviews accepted latency/resource signals, worker/model retention, unexpected validation failures, canonical/support differences and corpus integrity during an owner-selected observation window.
   Define that window and stop criteria before promotion.

Abort promotion on semantic/canonical/provenance mismatch, ID collision, stale publication, input/old-model mutation, missed cancellation/deadline contract, invalid corpus acceptance, unbounded unintended cache retention or a corroborated breach of accepted performance/resource criteria.
A failed optional optimization may be removed from scope with an explicit recorded decision; an accepted requirement cannot be silently weakened.

### 10.5 Recovery and cleanup

Before claiming rollback, verify a complete previously qualified package/application source and artifact set is retained and compatible with existing checkpoints/data.
Restoring the pre-ordinal performance bug may restore the 204-second failure; operational recovery may require stopping promotion or temporarily limiting the affected operation until a forward fix is ready.
“Revert” is not by itself an adequate user-recovery plan.

Reverse only this programme's reviewed changes through a targeted patch when authorized.
Never discard user-owned changes or use Git restoration to undo current task edits.
Snapshot/provenance fixes need source-level recovery and semantic validation; cache/index changes must also release temporary references.
If an unexpected format/state change prevents a compatible rollback, block promotion until a forward-fix/reconciliation route is agreed.

Retain exact source/harness/input identities, baseline and failed results, required raw profiles, accepted decisions and final test/review/security receipts.
Remove only task-owned scratch artifacts after evidence retention is settled.
Corpus source, independent expected fixtures, manifests and user scratch files are not cleanup targets merely because they were read during profiling.
Record logical sizes separately from actual physical space reclaimed.

## 11. Unknowns, discriminating experiments and replanning

| Open question                                                      | Cheapest useful evidence                                                                  | Decision consequence                                                                   |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| What exactly produced each audit result?                           | Recover script/options/log/profile and source hashes; reconcile V8 and sample identity    | Unmatched results stay source-reported; do not claim reproduced speedup                |
| Does the existing allocator preserve outputs and polling?          | Deterministic collision/dedup/cancellation cases plus canonical/correspondence comparison | Qualify or minimally amend existing candidate under accepted scope                     |
| How many old-loop collisions actually occurred?                    | Small controlled counter experiment with dense prefix and emitted-ID collisions           | Correct the exact-count model; retain the quadratic diagnosis without invented counts  |
| What proves a record's support is unaffected?                      | Independent normalization/successor/alias/source-qualified fixtures                       | Reject ID-only fast path; select equivalent typed proof or retain canonical comparison |
| Does lookup dominate any relevant batch?                           | Direct lookup/update/compaction counts across small/large `K`                             | Avoid adding an index that merely shifts linear work or increases small-edit cost      |
| Which snapshot is safe to remove?                                  | Ownership/validation/accounting trace and adversarial mutation/error tests                | Choose one internal seam; no direct jump to publication                                |
| Is fixture loading really 45 seconds, and which component?         | Cold/warm decode/hash/I/O/module-lifetime profile with equal corpus coverage              | Select bounded caching only for measured redundant work                                |
| Does 5.538-second core time translate to acceptable browser edits? | Current worker-stage/transport and URD lifecycle profile                                  | Accept measured limits or propose further work; do not infer whole-operation headroom  |
| Should desktop budgets change after the counting/algorithm repair? | Finite-profile chain/URD admission/edit/capture and browser-memory evidence               | Owner recalibration decision; unchanged policy until explicitly approved               |
| Can final artifacts be restored safely?                            | Retained package/application asset audit and checkpoint compatibility probe               | Promotion blocked until observer and recovery route are credible                       |

Replan if current source/other-session changes invalidate the baseline; the existing candidate's intended owner/scope is unclear; new semantic equivalence cannot be proved; a mutation index changes ordering/errors; copy elision requires public trust markers or altered accounting; corpus caching weakens pin independence; current hotspots differ from the audit; new packages/configuration are needed; browser/URD behavior contradicts chain gains; or recovery requires a format migration.
Keep rejected hypotheses and their evidence visible; do not combine unrelated rewrites to rescue a forecast.

## 12. Source-to-plan preservation map

| Audit content                                                                                                                      | Preserved location and disposition                                                                                                     |
| ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| A: quadratic edit diagnosis, 204-second failure, 36.8× reported improvement and ranked hotspots                                    | Sections 2–4; current candidate identified, exact performance status qualified                                                         |
| A highest-value sequence and final top three                                                                                       | SLICE-002 combines ordinal repair/regression protection, followed by SLICE-003 support optimization and SLICE-004 mutation indexing    |
| B: chain construction, atomic triple insertion, 36 suites/8,004 assertions, runtime and desktop limits                             | Sections 3.1–3.2 and 4.2; current runtime/limit-policy differences explicit                                                            |
| C HOT-01–05: evidence, severity, confidence, effort/risk, impacts and verification                                                 | Hotspot register and SLICE-002 through SLICE-006                                                                                       |
| D: quadratic/linear probe equations, `2N` serialization, `KN` lookup, CCN 6/28/34/18                                               | Section 3.4 preserves formulas and corrects the exact collision total and whole-edit complexity claims                                 |
| E HOT-01: full edit/admit/validateProjection/add cause, lookup/self-time and microbenchmark                                        | Sections 3.2, 3.4, 4.1 and SLICE-002; separate operation-count/cancellation proof                                                      |
| E HOT-02: remapped old records, support maps, canonical string costs and GC                                                        | Sections 3.2, 4.3 and SLICE-003; preserve dependency/alias/support-precedence semantics                                                |
| E HOT-03: three full clones, per-occurrence copies, Unicode/prototype/depth and freezing                                           | Sections 3.2, 4.2 and SLICE-005; current unique-value accounting and ownership boundary retained                                       |
| F Patch 1                                                                                                                          | Existing user-owned projection diff recorded and bound by hash; SLICE-002 qualifies rather than reapplies it                           |
| F Patch 2                                                                                                                          | Existing test's setup, timed interval, revision assertion and `<1,000` threshold retained; deterministic proof and evidence gaps added |
| G: isolated-process methodology, 4-GiB command, five before/after pairs                                                            | Sections 3.1–3.2 and 8.3–8.4; no new measurement claimed                                                                               |
| H: full-suite/lint/format success and gapped/user-ID/empty cases                                                                   | Sections 3.5, 7 and 8; claims retained with source/candidate receipt requirement                                                       |
| I: time, counter and heap CI gates                                                                                                 | Sections 4.1–4.2 and 8.5; unsupported delta-only claims corrected without hiding original proposals                                    |
| J Phase 2: support/index changes; HOT-03 and HOT-05 outside abbreviated roadmap                                                    | All remain explicitly planned as separate conditional slices; none silently dropped                                                    |
| J Phase 3 and A missing evidence: browser message cost and URD complex axioms                                                      | SLICE-007, QA-008/009 and measurement protocol                                                                                         |
| J exclusions: global custom serializer and parallel validation workers                                                             | Section 2.2, with the unmeasured 100,000-record crossover marked as a source claim                                                     |
| Top-three targets: under-one-second edit, under-60-second large edit, 1.5-second suite, 60,000 fewer calls, more-than-60% lower GC | Budget register preserves all values and identifies selection/proof still required                                                     |
| Opening command transcript, failures/cancellations and scratch artifacts                                                           | Sections 1, 3.5 and 8.3 treat them as provenance/evidence-recovery inputs, not commands to execute                                     |

## 13. Implementation readiness checklist

- [ ] Owner accepts selected scope/risk/targets and resolves retained execution ownership.
- [ ] Existing HOT-01 patch disposition and exact candidate source are recorded without overwriting other work.
- [ ] Baseline/harness/options/fixtures and source-reported verification receipts are recovered or explicitly marked unavailable.
- [ ] Each selected slice has independent correctness, scaling/resource and lifecycle evidence appropriate to its boundary.
- [ ] Support/snapshot/corpus changes pass their assigned domain/native-security/oracle review.
- [ ] Any configuration or policy change has exact prior approval; resource-profile recalibration is a separate decision.
- [ ] Final selected verification profiles and browser/URD evidence bind to the final source/artifact set.
- [ ] Release observer, observation window, abort/recovery route and evidence cleanup disposition are accepted.

Unchecked items are implementation prerequisites or future proof obligations.
They do not prevent this draft from preserving the audit and making the proposed work reviewable.

## 14. Implementation record — 28 October 2026

This section records implementation decisions and reproduced results; the preceding audit remains historical evidence.
The owner authorized implementation, changes to the existing `packages/vowl` candidate and plan-required configuration, with minimal workflow administration.
The owning chat closed execution `9149fb1d-09e6-48dd-a30c-5626ef32e7ed` as superseded at generation 8.
This chat then started owned R2 execution `8a46c58f-9d0a-45b5-a910-533510a3f2c0` against `9282ea541ada16ce9565031af760325d7a107581`, where local and live remote main initially matched.
The signed first checkpoint is `4385d0eabcd44ee58e40d2dfb0b7d2e69116c886`, containing this plan alone.
The existing allocator and latency-test edits are included with the owner's authorization; no unrelated checkout changes are included.

### Selected changes and conservative exclusions

- **HOT-01:** retain the monotonic generated-handle cursor and poll inside collision scans.
  Deterministic tests cover both normalizing and validating paths, contiguous/gapped reservations, exact generated handles, collision cancellation/deadline response within 1,024 visits and the existing occurrence-cardinality guard.
  Independent baseline controls fail the new bounds: 544 lookups against an expected 48, and 4,097 collision visits against the 1,061 cancellation/deadline bound.
- **HOT-02:** compare every typed, remapped record field before preserving support.
  Object-member order is immaterial; literal strings, ordered/repeated sequence members, null mappings, aliases and non-edit precedence remain significant.
  Any unproved candidate group uses the original canonical comparison, built lazily once per operation.
  IDs or requested changes alone never establish equivalence.
- **HOT-03:** the proven support comparison avoids the old-tree snapshot/remap for unchanged groups.
  Final admission, validation, owned publication snapshots, freezing and resource-count meanings are retained.
  Broader publication-copy elision is excluded because it would cross an ownership/counting boundary without additional proof.
- **HOT-04:** build one operation-local handle index, update it for ordered changes, retain removal tombstones until final stable compaction and keep removed/occurrence handles reserved.
  Tests cover replacement after removal/insertion, exact failing request pointers and assertion-anchor retargeting across tombstones.
  The baseline replacement control consumes 322,800 visits against a bound of 28,000; the candidate passes.
  This bounds direct lookup work, not every normalization, anchor or validation phase.
- **HOT-05:** reject the attempted decoded-buffer cache in the frozen corpus reader.
  The independent pin check correctly rejected changing `conformance/storage.mjs`; the reader was restored exactly, without repinning any manifest, provenance, golden or oracle.
  Additional tests retain independent digest/length rejection, per-reader lifetime and caller-owned returned buffers.
- Worker diagnostics add data-free spans for readmission, edit, inspection, checkpoint and capture.
  They preserve the existing protocol, safe error projection and finite desktop policy.
  Maintained benchmark/browser drivers keep private inputs outside the checkout, retain failed outcomes, distinguish admitted timing from functional-only runs and select the production worker through its verified build manifest.
- Native large-chain capture exposed an existing presentation/canonical boundary mismatch: renderers and scenes permit negative zero, but canonical numeric values forbid it.
  Capture now converts only coordinate `-0` to `0` in its owned visualization copy; it preserves the scene, literal data and strict package validation.
  The regression asserts the outgoing request before the older unit transport's JSON conversion can erase negative zero; the original native repro and failing regression are retained.

### Reproduced performance and native acceptance

Core edit measurements use one discarded warmup, twenty observations, unchanged finite desktop limits and identical native checkpoint digests for paired baseline/candidate cohorts.
These measurements describe candidate `889b85f5`; later repairs do not inherit its measured timings.
The complete admitted chain cohorts from `paired-edit-desktop-03.json` are:

| Classes | Baseline median (ms) | Candidate median (ms) | Candidate p95 (ms) |
| ------- | -------------------- | --------------------- | ------------------ |
| 100     | 32.54                | 24.76                 | 33.88              |
| 500     | 432.73               | 117.11                | 129.59             |
| 1,000   | 1,678.00             | 245.45                | 264.68             |
| 2,000   | Not sampled          | 486.46                | 497.14             |

That receipt as a whole remains **failed**: background CPU admission interrupted its later 10,000-class cohort.
The separate bounded fresh-process protocol completed twenty admitted 10,000-class observations: median 2,469.07 ms, p95 2,579.90 ms, maximum 2,631.88 ms.
It reuses one valid earlier observation and retains every refused attempt separately; it is not a claim that all attempts passed.
The baseline 10,000-class pathological path was not repeated twenty times.
Core observations exclude setup, inspection and checkpoint serialization; they are not browser-interaction SLOs or proof of lower RSS/GC pauses.

The private URD closure is pinned locally by complete SHA-256 and length: URD 1,139,625 bytes, ISO/IEC 11179 602,598 bytes and W3C SKOS 28,966 bytes.
The import resolver binds the exact ISO version IRI and SKOS document IRI; no network import fallback or private content is included in review material.
Native production-worker checks cover the 30,001-occurrence edited chain and the property/axiom-heavy URD model, meaningful class/subclass insertion, complete source-byte preservation, exact checkpoint recovery and unchanged resource enforcement.
Ten small lifecycle cycles exercise capture, stale revisions, tighter limits, native cancellation and termination; native GC finds no retained retired checkpoints, sessions or workers.
Separate rendered-session checks use the real D3 adapter and accepted document session at an 800×600 viewport with automatic node selection, proving visible accepted frames and current edits for both large inputs.
Functional-only wall clocks are explicitly unadmitted when host CPU is busy; no browser percentile claim follows from those runs.
Mobile/constrained-device safety and whole-process peak memory remain unqualified; desktop limits are unchanged.
URD capture, reload and recapture preserve exact artifact bytes.
After repairing negative-zero capture, the rendered, source-backed 10,000-class chain fails closed at the unchanged **4,000,000 embedded-value limit** (`MODEL_RESOURCE_LIMIT`, actual 4,000,001).
Its visible edit and checkpoint recovery pass; full artifact capture for that workload is **not accepted** under this desktop profile.
This is resource-envelope evidence for a later owner decision, not authority to raise limits or claim complete large-chain lifecycle acceptance.
The original native capture failures remain failed records; no rerun relabels them as passes.

The original 1,000-class latency assertion remains strictly below 1,000 ms, with model counts, the intended subclass, created handles, previous-revision isolation and exact checkpoint recovery asserted.
An added full RDF capture exceeded its deadline during development; that failed outcome is retained, and no large RDF-capture speedup is inferred from the edit measurements.
The rejected cache experiment, failed controls and host-admission refusals remain in native tool records and private task evidence under `operator/8a46c58f-9d0a-45b5-a910-533510a3f2c0`.

### Final validation and delivery

The final `npm run check` completed with exit 0: 206 Jest suites / 10,614 tests, 28 Python tests, Markdown/JSON integration gates, exact corpus storage (7,227 artifacts / 64 bundles / zero loose copies), lint/format checks, production build and generated-artifact JSON validation.
The complete output is retained as `full-check-01.log`; intentional negative-corpus quality findings remain governed by their unchanged independent contracts.
No source-test failure remains from that run.
The requested Claude Opus 5.5 Max review is a subsequent gate against the signed source candidate, with a 60-minute allowance; this source record does not claim its result in advance.
Provider output and any narrowly scoped repair review remain in the native review records rather than duplicated evidence packages.
No package installation, application activation, deployment or resource-policy recalibration is authorized by this record.

### Consumer-override follow-up selected by the owner

After the initial signed implementation candidate `889b85f554a75de668784fa3602394860d7528bc`, the owner explicitly requested removing the remaining worker-transport restrictions.
Reuse this execution and its accepted risk route; the change extends consumer override support without raising any default.
The client now accepts valid larger finite limits and `Infinity`, confines non-finite option values to the top-level limits record, arms no infinite watchdog and rearms long finite deadlines within the native timer range.
The obsolete application maximum tuples are replaced with the same finite default values; import acquisition retains its existing default.
Six added regression cases fail against the previous client, then pass with the repair; the complete affected worker/import suites pass 67 tests.
Native consumer-only qualification uses built-in fixtures, separate from desktop-profile acceptance and the private URD cohort.
The earlier broad review stays bound to its frozen source candidate; final validation and a narrow review cover this follow-up and any repairs.
The updated full check completes with exit 0: 206 suites / 10,620 Jest tests and all other repository gates (`full-check-02.log`).

Claude Opus 5.5 at Max completed the broad review of `889b85f5` in approximately 18 minutes, within its 60-minute allowance, with no product-code findings.
Its five qualification-tool findings are repaired: synchronous report/log reservation and handled producer errors, bounded owned-process teardown, partial browser-result recovery before shutdown, an isolated build bound to current Git/harness identities, early benchmark output reservation, and real CPU-admission/staged/untracked-source metadata.
Nine focused tool regressions pass; they cover native producer failures and teardown, preserved evidence on write/collision failures, staged/untracked identities, actual admission observations and CLI preflight ordering.
The isolated build also fixes production cleanup to use the configured output directory instead of the checkout's default deployment directory.
These tool repairs receive scoped validation; successful unchanged product checks are reused.
The rebuilt native production-worker consumer probe passes all ten `Infinity` limit overrides, larger finite input/depth/deadline overrides, exact source-checkpoint recovery, capture, cancellation and rejection of ordinary non-finite checkpoint data.
It leaves no retired worker reachable after native GC.
A separate intentional 5-second cohort timeout retains 11 completed operations and one in-flight operation before closing Chrome and Vite without teardown errors.
That qualification remains **failed**, with `partial: true`; its retained failure is the successful negative control for result preservation, not a relabelled performance pass.

### CI and narrow-review repair

The narrow Claude Opus 5.5 Max review of `2f837e80` confirms the consumer overrides and the five original tool repairs.
Its two verified follow-up defects are corrected: conflicting modes fail before report reservation, and recovery preserves completed cohorts instead of marking them interrupted.
Owned-process teardown now uses the retained native child handle with bounded graceful termination and forced escalation; the Windows-only process-tree launcher is removed.
The existing portability assertion remains unchanged.

PR #97's first application run fails two assertions: the Windows launcher and a 1,000-class edit taking 1,150.55 ms against the unchanged strict 1,000 ms bound.
The original CI failure remains retained on GitHub.
An isolated diagnostic profile identifies snapshot traversal, pointer construction and serialization among the edit's costs; instrumentation is outside the product tree.
A bulk-descriptor experiment is discarded after little diagnostic benefit.
The selected small repair avoids re-coercing string pointer fields and uses an at-most-1,024-code-unit ASCII scan to establish exact UTF-8 length and valid scalar values.
Non-ASCII and long strings retain their original interruptible validation; all snapshots, admission checks, aggregate charging and publication freezing remain.
Scoped tests cover byte boundaries, Unicode, ownership, descriptor/proxy rejection, original error pointers and the unchanged latency assertion.
The new paired performance attempts are refused by the unchanged host CPU guard; they remain failed receipts and establish no new speedup or percentile claim.
Final full-check, native browser and narrowly scoped review outcomes remain in their actual task records.
`full-check-03.log` completes with exit 0: all 207 suites / 10,643 Jest tests, 28 Python tests and the remaining quality, corpus, production-build and generated-artifact gates.
The rebuilt native production-worker probe also passes all ten infinite overrides, larger finite overrides, capture, source recovery, strict data rejection, cancellation and teardown (`browser-consumer-overrides-02`).
This candidate retains the strict latency assertion; hosted CI and the final narrow review remain publication gates.
