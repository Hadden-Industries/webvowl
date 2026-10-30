# Research brief: closing WebVOWL's Chromium loading-performance gap

**Prepared:** 30 October 2026. **Priority:** Chromium.

## Your assignment and available evidence

Recommend how to bring the current ontology-loading application to the user-visible performance of original WebVOWL 1.1.7 **while preserving the current validation, source-retention, ownership and recovery guarantees**.

This is a **static research and source-review assignment**. You cannot run code. Use the measurements, architecture, current-behavior descriptions and excerpts supplied here; inspect the linked public GitHub files when useful. You do not need local checkouts, an AWS account, private repositories or knowledge of the project's earlier conversations. Do not claim to reproduce the measurements. If a conclusion requires a CPU profile or another experiment, specify the smallest measurement **our implementation team** should obtain.

The requested output is a ranked, source-grounded explanation and set of implementation proposals, with uncertainties and correctness obligations. Broad advice such as “use workers,” “cache results,” or “profile it” is insufficient: workers and several caches already exist, and the current pipeline is described below.

## 1. The problem in numbers

Three paired local runs compared the actual original application with the current implementation on the same seven documents. Lower is better.

| User-visible case                                            | Original median | Current median | Current minus original |
| ------------------------------------------------------------ | --------------: | -------------: | ---------------------: |
| Cold browser and empty materialization cache                 |      3,071.5 ms |     6,606.5 ms |            +3,535.0 ms |
| Reload in the same page                                      |      1,529.8 ms |       528.6 ms |            −1,001.2 ms |
| New browser context, materialization cache already populated |      2,290.4 ms |     3,864.5 ms |            +1,574.1 ms |

The current cold path takes approximately 2.15 times the original duration; the fresh-browser warm path takes approximately 1.69 times the original duration. The faster same-page result does **not** establish acceptable first-visit performance.

Raw repetitions, in milliseconds:

| Case               | Original samples          | Current samples           |
| ------------------ | ------------------------- | ------------------------- |
| Cold               | 3,422.5; 3,071.5; 3,070.5 | 6,606.5; 6,365.1; 6,612.0 |
| Same-page warm     | 1,527.3; 1,530.5; 1,529.8 | 561.7; 528.6; 528.6       |
| Fresh-browser warm | 2,290.4; 2,292.2; 2,209.5 | 3,996.2; 3,848.4; 3,864.5 |

**Interpretation limits:** three repetitions are descriptive evidence, not a statistical performance guarantee. These are controlled local measurements, not Internet or deployed-AWS timings. No function-level Chromium CPU/allocation trace is available. Stage durations below are elapsed spans, not exclusive CPU attribution.

## 2. What this application does

An **ontology** is a machine-readable description of classes, properties and relationships, serialized here as Turtle or RDF/XML. One ontology can declare imports of others. The **import closure** is the root document plus every transitively required document: seven documents in this workload.

**WebVOWL** displays an ontology as an interactive graph. The original application asks a Java service, **OWL2VOWL**, to load/convert the ontology and returns JSON for rendering. The current application uses a JavaScript **OwlAPI** library and a retained graph model owned by the application. JavaScript OwlAPI and the original Java library are distinct implementations.

The current system has three components:

| Component                                                           | Responsibility                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Materialization provider, running in Node.js for these measurements | Fetch and check one remote document, publish its exact decoded bytes and immutable provenance/validation records, and expose asynchronous acquisition status. It caches source documents, not a compiled VOWL graph or an entire import closure. |
| JavaScript OwlAPI inside a browser worker                           | Parse the root and imports, manage the closure, provide OWL objects and source/profile assessment.                                                                                                                                               |
| WebVOWL's `vowl` package and browser controller                     | Build and validate the retained model, retain original bytes/reports, produce a recovery checkpoint and read-only inspection data, then construct and display the graph.                                                                         |

Important terms used in the source:

- **Admission** checks the model's closed field/schema contracts, references, cycles, identities, semantic rules and generated display projection before publishing it as application-owned state.
- **Snapshot** is a defensive, descriptor-based copy with input-safety and resource accounting. It checks prototypes, accessors, symbols, cycles, Unicode and byte/depth limits. It is more than `structuredClone`.
- **Inspection** is an immutable view for rendering and read APIs. It confers no authority to edit or encode a model.
- **Checkpoint** is a recovery representation containing model state and original source bytes. Editing/export operations readmit checkpoints through the owning package; an arbitrary deserialized object is not an admitted model.
- **Normalization** deduplicates and rewrites the producer's graph, handles endpoint aggregation and signature dependencies, and generates display occurrences. Its mutations explain why some graph indexes are rebuilt.

The measured mapping strategy is **Heuristic OWL mapping**, represented internally by OwlAPI's `compatible` RDF reconstruction token. OwlAPI's separate manager/object behavior profile is the default `normative-v1`. Changing either semantic policy is not an equivalent performance optimization. Assessment reports can contain invalid or unverified findings; preserving those reports is distinct from claiming that every input is valid OWL 2 DL or exhaustively represented in the visualization.

## 3. The two measured paths

### Original application

```text
Browser requests root ontology
  -> Java OWL2VOWL service loads root and imports and converts the closure
  -> browser receives legacy visualization JSON
  -> original WebVOWL constructs and paints its graph
```

The baseline uses the retained, unmodified WebVOWL 1.1.7 WAR and OWL2VOWL 0.3.7 HTTP conversion service. Each cold pair starts a fresh JVM and waits for HTTP readiness **before** the timed browser request. Warm cases retain the JVM. The original page's native JSON/result cache is retained for its same-page reload. The environment is Java 25 with Tomcat 8.5.16 compatibility settings, not a reconstruction of the historical Java 8 host.

### Current application

```text
Browser acquisition, for the root and each demanded import:
  1. Try an existing catalog/exact-source binding in the materialization cache.
  2. On a miss, try direct source acquisition.
  3. A genuine browser network/CORS denial permits eligible materialization.
  4. Provider retrieves and checks that single document asynchronously.
  5. Client observes completion, verifies immutable metadata and exact bytes.

Dedicated browser worker:
  parse the seven-document closure through OwlAPI
  -> source/profile assessment of the loaded closure
  -> construct and normalize retained VOWL model
  -> retain original bytes, source information and reports
  -> admit the model through full model validation
  -> create inspection and recovery checkpoint
  -> publish the accepted preview; finish node-ranking work afterward

Main thread:
  own inspection/checkpoint copies
  -> construct initial scene and drawing
  -> accept the current load generation
  -> visible graph followed by two animation-frame callbacks
```

Native parsing/adoption remains ordered. Byte acquisition alone can overlap for one matching sibling import, with at most two active acquisitions. Hints must belong to the verified parent and selected mapping strategy; hints are not recursively followed as a substitute for parsing.

### What “warm” means

- **Cold:** fresh browser context, empty provider cache, seven actual provider-origin acquisitions and seven genuine direct-browser CORS denials.
- **Same-page warm:** existing page and controller. A private completed worker result may be reused after fresh acquisition confirms the same root/import bytes, document contexts, mapping and relevant options.
- **Fresh-browser warm:** new browser context with no retained application model. Source documents are available in the provider cache, but the browser performs the full parsing, assessment, model construction and admission path again.

Both current warm cases make **zero origin acquisitions, zero materialization/control-plane calls and 36 static cache requests**. Static requests retrieve pointers, resolutions, source versions, validation/policy records and artifact bytes. Metadata identities and cross-record relationships are checked before bytes enter the parser. Original bytes are independently hashed; successful metadata-digest reuse does not replace artifact hashing.

## 4. Workload and measurement boundary

Environment: Windows x64, Node.js 26.13.0, Chromium 156.0.8078.4 using Playwright headless-shell build 1248, production-mode frontend assets, and a 1440 × 1000 viewport. The provider and controlled origins are local. Original and current applications receive identical hash-pinned bytes and logical IRIs. No CPU/network throttling is deliberately applied.

The seven input documents total **3,023,334 decoded bytes**, approximately 2.88 MiB:

| Document                    | Logical document IRI                                                      | Syntax  |     Bytes |
| --------------------------- | ------------------------------------------------------------------------- | ------- | --------: |
| Universal Ontology extended | `https://haddenindustries.com/ontology/universal/extended/latest`         | Turtle  |   730,907 |
| Universal Ontology core     | `https://haddenindustries.com/ontology/universal/core/20260912`           | Turtle  |   376,694 |
| Reference data              | `https://haddenindustries.com/ontology/universal/reference-data/20260912` | Turtle  | 1,139,625 |
| ISO/IEC 11179-3             | `https://haddenindustries.com/ontology/iso-iec/11179/-3/ed-4/20260912`    | Turtle  |   602,693 |
| Gregorian time              | `http://www.w3.org/ns/time/gregorian`                                     | Turtle  |     7,414 |
| OWL-Time                    | `http://www.w3.org/2006/time`                                             | RDF/XML |   136,737 |
| SKOS                        | `http://www.w3.org/2004/02/skos/core`                                     | RDF/XML |    29,264 |

Retrieval can use HTTPS while preserving the logical HTTP import IRI and the verified effective parser-document context. These logical identities are not interchangeable normalization opportunities. The measurements use frozen documents; the contents currently served by a `latest` URL need not match them.

Timing starts at navigation or native reload and ends when the **accepted current generation** has a visible graph followed by two animation frames. Both paths use the ordinary initial display of roughly 50 nodes. An old drawing, transparent SVG, partial import closure or graph awaiting model acceptance cannot qualify. Deterministic node-ranking work already runs after the accepted preview and must not be counted again as an available first-paint saving.

All seven documents resolve. The current model retains all checked legacy named entities: **806 class/datatype IRIs and 763 object/data-property IRIs**. It can retain additional records and provenance. This is named-entity coverage evidence, not full axiom equivalence or identical internal work. Complete annotation/expression counts and allocation/GC breakdowns have not been measured.

### Representative fresh-browser current sample

These spans come from the **3,996.2 ms** Chromium repetition, not from the median or from WebKit:

| Stage                                         | Elapsed time | Interpretation                                                                                                                     |
| --------------------------------------------- | -----------: | ---------------------------------------------------------------------------------------------------------------------------------- |
| OwlAPI worker loading                         |   1,047.9 ms | Includes approximately 50 ms of measured import acquisition waits. Remaining elapsed time is not automatically exclusive CPU time. |
| Closure source/profile assessment             |     283.0 ms | Assessment follows native closure loading.                                                                                         |
| Retained-model construction and normalization |     723.5 ms | Includes 139.5 ms construction and 583.9 ms normalization.                                                                         |
| Original source/evidence retention            |       7.4 ms | Separate from the preceding model-construction span.                                                                               |
| Live-model admission                          |     731.8 ms | Includes ownership work, model validation and publication/inspection preparation.                                                  |
| Inspection/checkpoint stage                   |     281.8 ms | Worker-side result preparation.                                                                                                    |
| Initial usable drawing                        |     298.2 ms | Main-thread scene/drawing span.                                                                                                    |

**Do not sum nested spans or treat this table as a complete critical-path decomposition.** Worker/module bootstrap, transport, main-thread copies, scheduling and GC are not fully attributed. Separate Chromium timings for the individual admission copies or cache-capture copy are unavailable. Eliminating an entire stage would bound its possible saving; it is not a credible forecast that all its work can be removed.

## 5. Source access and version differences

The measured application revision is local commit `d7947145509b7b4ea545f3eae2b452b7ece77fa9`. Its later comparison harness adds browser selection without changing the measured production algorithms. Those local commits are **not public GitHub references**.

For source reading, the links below use the verified public WebVOWL snapshot **`6b73599888ad5ce38cd11f258caca56286516d62`**. It predates several measured changes. The table states where the relevant implementation matches and where the supplied description supersedes the public snapshot. **Do not attribute the reported timings to a checkout of that public revision.**

The measured JavaScript parser is the public package **`@hadden-industries/owlapi@0.1.0-rc.3`**, qualified against source **`17cdb60b3a2920b7cb4da0000e87b374dedb578a`**. OwlAPI source links use that exact revision.

| Research area and useful source                                                                                                                                                                                                                                                                                                                                    | Relationship to the measured implementation                                                                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Fresh admission, inspection, checkpoint and readmission — `liveModel.js`](https://github.com/Hadden-Industries/webvowl/blob/6b73599888ad5ce38cd11f258caca56286516d62/packages/vowl/src/liveModel.js#L54)                                                                                                                                                          | The file matches the measured implementation. `admit` starts at line 97, `openOwlState` at 209, checkpoint creation at 467 and readmission at 495.                                                                  |
| [Defensive copying and resource accounting — `snapshot.js`](https://github.com/Hadden-Industries/webvowl/blob/6b73599888ad5ce38cd11f258caca56286516d62/packages/vowl/src/snapshot.js)                                                                                                                                                                              | Matches the measured implementation.                                                                                                                                                                                |
| [Normalization and graph rebuilds — `editing.js`](https://github.com/Hadden-Industries/webvowl/blob/6b73599888ad5ce38cd11f258caca56286516d62/packages/vowl/src/editing.js#L180)                                                                                                                                                                                    | Matches. `normalizeDraft` spans deduplication, reference rewriting, endpoint aggregation, signature work and projection generation.                                                                                 |
| [Graph/meaning validation — `validateGraph.js`](https://github.com/Hadden-Industries/webvowl/blob/6b73599888ad5ce38cd11f258caca56286516d62/packages/vowl/src/validateGraph.js) and [display projection — `projection.js`](https://github.com/Hadden-Industries/webvowl/blob/6b73599888ad5ce38cd11f258caca56286516d62/packages/vowl/src/projection.js)              | Both match. These are correctness work as well as potential allocation/indexing costs.                                                                                                                              |
| [Schema compilation and typed traversal — `typedValues.js`](https://github.com/Hadden-Industries/webvowl/blob/6b73599888ad5ce38cd11f258caca56286516d62/packages/vowl/src/typedValues.js#L113)                                                                                                                                                                      | Compilation/traversal mechanisms match. The measured version additionally has the exact-IRI reuse and conservative ASCII proof described in section 7.                                                              |
| [Model producer — `owl/modelBuilder.js`](https://github.com/Hadden-Industries/webvowl/blob/6b73599888ad5ce38cd11f258caca56286516d62/packages/vowl/src/owl/modelBuilder.js#L201)                                                                                                                                                                                    | Algorithm matches; the measured version adds construction/normalization timers.                                                                                                                                     |
| [Worker operation order — `canonicalVowlWorkerOperations.js`](https://github.com/Hadden-Industries/webvowl/blob/6b73599888ad5ce38cd11f258caca56286516d62/src/app/js/controller/canonicalVowlWorkerOperations.js#L94)                                                                                                                                               | Relevant order matches; the measured version additionally passes the selected mapping strategy into `openOwl`.                                                                                                      |
| [Browser OWL adapter — `owl/loading.js`](https://github.com/Hadden-Industries/webvowl/blob/6b73599888ad5ce38cd11f258caca56286516d62/packages/vowl/src/owl/loading.js) and [closure assessment — `owl/compatibleLoading.js`](https://github.com/Hadden-Industries/webvowl/blob/6b73599888ad5ce38cd11f258caca56286516d62/packages/vowl/src/owl/compatibleLoading.js) | Public implementations illustrate the parser/assessment seam. The measured version makes strategy/automatic-format selection explicit and adds stage timers; the measured heuristic mode uses `compatible` parsing. |
| [Browser acquisition client — `ontologyMaterializationClient.js`](https://github.com/Hadden-Industries/webvowl/blob/6b73599888ad5ce38cd11f258caca56286516d62/src/ontology-loading/ontologyMaterializationClient.js)                                                                                                                                                | Public version is older. Use sections 3, 6 and 7 for the measured polling, overlap, cancellation and warm-cache behavior.                                                                                           |
| [Exact parser manager — `owlOntologyManager.js`](https://github.com/Hadden-Industries/owlapi/blob/17cdb60b3a2920b7cb4da0000e87b374dedb578a/model/owlOntologyManager.js)                                                                                                                                                                                            | Exact qualified parser source, including RDF preparation/reconstruction and import management.                                                                                                                      |

Historical background: [original WebVOWL source tag `v1.1.7`](https://github.com/VisualDataWeb/WebVOWL/tree/v1.1.7) and [OWL2VOWL source tag `0.3.7`](https://github.com/VisualDataWeb/OWL2VOWL/tree/0.3.7). The measured binaries are identified in section 10; a matching version label alone is not proof of a byte-identical rebuild.

## 6. Relevant implementation supplied directly

### A. Why fresh admission may repeat ownership work

This is an extract of the measured implementation, with metadata construction shortened for readability. The linked public `liveModel.js` contains the complete matching functions.

```js
function admit(state, budget, archive) {
  state = snapshotSource(state, budget);
  const assertionSupport = validateStructure(state.structural, budget);
  return publishValidatedState(state, budget, archive, assertionSupport);
}

export function openOwlState(source, archive, documentIri, budget) {
  const owned = snapshotSource({ structural: source.structural }, budget);
  const replacements = relabel(owned.structural, budget);
  // Find the root in the already-owned source archive; reject if absent.
  const state = {
    revision: 0,
    origin: /* constructed origin metadata */ {},
    structural: owned.structural,
    supports: /* generated support records */ [],
  };
  const model = admit(state, budget, archive);
  return deepFreeze({ model, correspondence: /* replacement map */ [] });
}
```

There is a structural copy before relabeling and another inside `admit`. This is a **source-observed candidate**, not a measured allocation saving. The second snapshot also validates and accounts for values and generated state; removing it requires a proof about private ownership, all modified IDs/references, metadata, resource counts and error behavior. Full `validateStructure` and publication checks must still execute. Caller input, checkpoint recovery and cross-owner paths must remain independently checked.

### B. Provider behavior, without requiring its non-public repository

The measured local provider processes one source document per acquisition:

```text
eligible request -> admitted/coalesced generation -> bounded retrieval
  -> isolated parser-worker job -> accepted document publication
  -> immutable bytes + version/validation/policy/resolution records
  -> current source pointer becomes readable
```

Local acquisition capacity is two. There are at most two parser workers. Each worker can serve at most eight successful jobs before retirement, retires after 30 seconds idle, and gets a fresh OwlAPI manager/configuration for every document. Errors, cancellation and deadlines terminate the affected heap before its capacity is released. Reuse preserves initialization, not parsed document state. Effective old-generation heap is capped at 1,536 MiB per worker; additional young-generation/stack bounds remain set. Service document limits include 32 MiB decoded input and a 20-second parse deadline.

The parser worker rejects unsupported/non-UTF-8 decoding, has no permitted secondary fetch capability, disables remote imports and JSON-LD contexts, and retains authored import declarations as bounded hints. **It does not validate the whole import closure or establish an OWL 2 DL/source-preservation result.** Its report explicitly marks source assessment unverified. Browser closure processing therefore serves a distinct purpose; deleting it as “already validated by the server” is not an equivalent change.

Pending materialization returns HTTP 202; the client later obtains the artifact/binding through the completion path. Each observation loop has a 60-second deadline and at most 20 status requests. The current delay calculation is:

```js
const pollingDelay = Math.max(
  serverRetryAfterMilliseconds,
  Math.min(4000, 100 * 2 ** count + Math.random() * 50),
);
```

The provider can give a zero-second hint; the old fixed two-second floor has already been removed. The client still sleeps approximately 100–150 ms initially and backs off. A state transition does not reset its request allowance. Waiting between producer completion and the next observation is a plausible cold-path cost; **its isolated contribution has not been measured in Chromium**. Warm foreground reads use no such status loop.

### C. Current private warm-result cache

The measured worker client keeps at most one private completed result, with a **32 MiB accounted-payload ceiling**. This bounds the retention accounting, not the actual JavaScript heap footprint. Before any preview escapes, it measures and independently copies the preview. On same-page reload, it reacquires and verifies every required source, compares exact bytes and document/media-type contexts, and checks mapping/options before reusing that private result. Explicit limits and requests for a fresh load force native processing. Cached inspection data are not encoder/edit authority; later operations still readmit checkpoints through the owning package.

This cache explains part of the same-page advantage. It cannot provide a model to a new browser context. Initial cache capture and subsequent UI ownership copies may have costs, but **no separate Chromium timings for those copies are supplied**.

## 7. Optimizations already present in the measured candidate

These describe current behavior, not isolated Chromium speedup claims:

| Area                         | Already implemented                                                                                                                                                                                                                                                    |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Import acquisition           | One verified sibling's byte fetch can overlap native demand; parsing/adoption order and aggregate limits remain unchanged.                                                                                                                                             |
| Immutable metadata           | Version, validation and policy reads overlap after verified resolution/path/policy checks. Their checks still precede parser consumption.                                                                                                                              |
| Shared policy reads          | Per-load coalescing, independent caller cancellation and failed-read eviction; cancellation of the transport owner permits the other caller's bounded independent read.                                                                                                |
| Textual metadata identities  | Bounded memoization of successful exact SHA-256 preimages; artifact-byte hashes remain independent.                                                                                                                                                                    |
| IRI lexical validation       | Successful exact strings can be reused within one operation, capped at 4,096 entries. A conservative ASCII HTTP(S) proof applies to strings no longer than 1,024 characters; other strings use the full grammar. Field, graph, semantic and resource checks still run. |
| Equality keys                | Each typed equality subtree is serialized once. JCS still owns scalar/reference encoding; unordered sets retain sorting/deduplication and property-chain sequences retain order/repetition.                                                                            |
| Runtime validators           | Grammar/scalar validators are cached within a module/worker instance. Whether fresh-worker compilation is material in Chromium remains unmeasured.                                                                                                                     |
| Worker/node-ordering startup | OWL parser imports are lazy within the operation, and deterministic node-ranking work is deferred until after accepted preview.                                                                                                                                        |
| Provider                     | Bounded parser initialization reuse described above.                                                                                                                                                                                                                   |
| Same-page model reuse        | Private, byte/context/options-checked result cache described above.                                                                                                                                                                                                    |

Earlier exploratory long-ASCII, metadata-hash-overlap and pointer-free-walk experiments were removed after weak/no measured gains or unresolved test concerns. Those performance experiments were primarily WebKit measurements; **they do not rule out a Chromium-specific improvement**. Likewise, an earlier old-WebKit IRI-regex penalty does not explain the Chromium gap in this brief.

## 8. Research questions, ranked by relevance

1. **Explain the shared cold/fresh-session gap.** Distinguish useful parsing/assessment/model work from initialization, serialization, repeated traversals, scheduling and provider completion observation. Identify which source facts support the explanation and which require owner-side measurement.
2. **Evaluate the duplicate admission snapshot.** Can one private ownership construction preserve all safety/resource/error guarantees? Describe the exact safe seam and the caller/recovery paths that must remain unchanged. The 731.8 ms admission span is a ceiling for that whole stage, not a predicted saving from this copy.
3. **Analyze normalization graph/index lifetimes.** The linked `normalizeDraft` rebuilds graphs around deduplication, endpoint aggregation and signature mutations. Identify concrete mutations that invalidate each index and any branches where reuse could be proved safe. Final independent admission validation remains required.
4. **Assess fresh-worker costs and parser work.** Examine module initialization, schema compilation, OwlAPI RDF preparation/reconstruction and metadata/structural copying. Distinguish caches that survive one operation from ones destroyed with a fresh worker. Do not infer that the small measured import-wait span makes the remaining loader elapsed time pure CPU.
5. **Explain cold-specific acquisition overhead.** Assess the supplied bounded status/prefetch/provider design. Propose proportionate ways to reduce avoidable waiting without unbounded requests, enlarged failure domains or new paid infrastructure. Label any proposal that would change the source-only service contract.
6. **Assess the architecture's attainable parity.** The new implementation retains more structure, evidence and recovery functionality than the legacy JSON flow. Identify unavoidable costs, avoidable duplication, and any proposed requirement/authority change separately. Keep the original user-visible target intact when explaining trade-offs.

## 9. Required constraints and report format

Preserve exact decoded bytes and logical/parser contexts, complete imports, metadata relationships/digests, source/profile assessment, schema/graph/meaning/projection validation, retained diagnostics, supported model records, caller isolation, private ownership, checkpoint readmission, cancellation and finite resource limits. Preserve validation/error ordering where it is contractual. A caller-supplied marker, cached Boolean or shallow-frozen object cannot confer model authority.

Production WebVOWL's cache-consumer path remains disabled by default; the benchmark explicitly enables an isolated local composition. This assignment does not authorize deployment, activation, publishing code, package/configuration changes, additional paid services, or a new public protocol. You may propose such a change as a clearly separated design alternative with its consequences.

Please deliver:

1. A concise causal model of the likely Chromium gap, separating **supplied observations**, **source-demonstrable facts** and **hypotheses**.
2. Up to five ranked proposals. For each: specific functions/phase, mechanism, relevant source citations, cache/ownership lifetime, likely critical-path impact or defensible upper bound, correctness/resource risks, and a small implementation outline or pseudocode.
3. The minimal owner-run measurements that would confirm or falsify each proposal. Specify counters/spans or trace questions; **you are not expected to execute anything**. Mark conclusions that cannot be established without those measurements.
4. Any evidence that parity conflicts with a retained requirement, with the precise trade-off exposed rather than an altered timing boundary or silent loss of validation.

The team can subsequently capture Chromium CPU/allocation/timeline traces and run targeted experiments. The [Chrome DevTools Performance reference](https://developer.chrome.com/docs/devtools/performance/reference) documents bottom-up self time, request timing and memory views. No such trace is attached to this brief, and no dominant-function or GC claim should be treated as established yet.

## 10. Evidence identities

These identify supplied measurements, not extra files the researcher must obtain:

- Measured WebVOWL application: `d7947145509b7b4ea545f3eae2b452b7ece77fa9`, local/unpublished.
- Measured provider: `396bd0cce6878ccdf8d3463dddda7f47a6fe5b04`, local source identity; its required behavior is supplied in section 6.
- Exact JavaScript OwlAPI source: `17cdb60b3a2920b7cb4da0000e87b374dedb578a`, public `0.1.0-rc.3` artifact.
- Original WebVOWL ZIP SHA-256: `fb0642091929c82933f7d96932174ecf37a996dc38d19bdd364f6ac6d86ae48b`.
- Original `ROOT.war` SHA-256: `3e75194a35ac68e6a85d1524fdfcc2399c5d71d18a9aa41d6a4924328d5ebea6`.

The frozen input SHA-256 values, in the order used by the workload table, are:

```text
extended       92ad97ccb1acf4f2413dc3f1100433adbaa965ce98821f863de9df22eced7f24
core           214f21e9116c0515bd52e5e8e893c83fcf93eb4ce586a49dbd8afc8a05e2c190
reference-data 1354d260a8bf33d0e67b6145b45438be719203f71e0280d61fc498b697860260
ISO-IEC-11179  b621c3d545343cbfab9e8c41cf296046df32722204b8ff76251b7b5a6f3a2e74
Gregorian      e7a5e5f6ba555bf2086169ed05bdde9901f146ffc25f3d0aa62798170b2b5880
OWL-Time       8ce934e406401e0e6cb9b6d4407bb69103d62c94107e2a1a30b4a31cc2772e58
SKOS           378fe72e82a529a3338e00c1fb157112d9941c94ac5c8bc7e88a8463ea879e96
```
