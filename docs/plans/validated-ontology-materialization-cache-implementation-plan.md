# Validated Ontology Materialization Cache Implementation Plan

> **Status:** Deferred architecture and implementation blueprint; no implementation begins until the predecessor Phase 20 completion gate is evidenced.<br>
> **Research baseline:** 25 August 2026.<br>
> **Predecessor:** [`docs/owlapi-js/implementation-plan.md`](../owlapi-js/implementation-plan.md), especially §17.27, “Phase 20 — qualify and publish production-recommended `owlapi@0.1.0`.”<br>
> **Related ontology-lifecycle programme:** [`docs/owlapi-js/ontology-lifecycle-capability-implementation-plan.md`](../owlapi-js/ontology-lifecycle-capability-implementation-plan.md). This cache does not absorb that programme’s imports-closure query, merger, mutation, or storage responsibilities.<br>
> **Execution rule:** Implement each cache phase in order, preserve the RED → GREEN → REFACTOR discipline for observable changes, and stop at every configuration, deployment, publication, commit, and push approval gate.<br>
> **Goal:** Allow WebVOWL to resolve an ontology document or any document in its import closure when a browser cannot retrieve the source because of CORS or mixed-content policy, while serving every subsequent successful resolution from a validated, content-addressed, transparently reported CloudFront/S3 cache.<br>
> **Architecture:** Keep ordinary reads on a CloudFront → private S3 data plane. Invoke a small CloudFront → Lambda Function URL → DynamoDB/SQS control plane only for a previously unknown or refresh-due source document. Validate the exact stored representation with the same public `owlapi` npm package and loader profile used by WebVOWL before publishing any catalog mapping.<br>
> **Technology:** Native ESM JavaScript, the public `owlapi` npm package, browser Fetch/Web Crypto/AbortSignal, OASIS XML Catalogs 1.1, AWS CDK v2 in Python, CloudFront pay-as-you-go, private S3, Lambda Function URLs protected by CloudFront origin access control, Lambda on Node.js 24, DynamoDB on-demand capacity, SQS Standard, AWS WAF, CloudFront standard logging v2, CloudWatch, Athena, and Route 53 under the existing account-owned configuration.<br>
> **Spec:** The normative architecture, contracts, and acceptance criteria are contained in this document. The two linked `owlapi` plans remain authoritative for the package boundary and release lineage.

---

## 1. Decision summary

This plan makes the following decisions deliberately and treats them as implementation constraints rather than suggestions:

1. **Start only after Phase 20.** The current in-repository `src/owlapi-js/` tree is not an implementation target. At the starting checkpoint, WebVOWL must already consume the exact accepted production registry artefact through public `owlapi` entry points only.
2. **Use the installed `owlapi` package in both runtimes.** WebVOWL uses it to parse user-requested documents and imports; the materialization worker uses the same exact package coordinate and validation profile to decide whether bytes are eligible for publication.
3. **Keep network policy outside `owlapi`.** `owlapi` remains free of ambient networking. WebVOWL supplies its application-owned document loader. The Lambda worker supplies a separately controlled, SSRF-resistant representation retriever.
4. **Materialize documents, not collapsed closures.** The service stores one validated ontology document per artifact. WebVOWL and `owlapi` continue to traverse the import graph. This service enables closure resolution but does not merge, flatten, rewrite, or publish a closure as one ontology.
5. **Use the existing CloudFront distribution.** Do not create a dedicated production distribution unless a later, separately approved cost or isolation review overturns this decision. Add more-specific cache and API behaviours ahead of the existing `ontology/*` behaviour.
6. **Remain on CloudFront pay-as-you-go.** Do not enroll the distribution in a flat-rate plan. Route 53 remains independently managed. The design relies on CloudFront’s account-wide always-free allocation before ordinary pay-as-you-go charges.
7. **Use a dedicated private artifact bucket behind the existing distribution.** Separating worker-written material from the static website bucket produces a narrower write boundary without adding a fixed monthly charge.
8. **Use immutable content-addressed artifact IRIs.** A validated representation is stored at a path derived from its SHA-256 digest and is never overwritten. It is safe to cache for one year with `immutable`.
9. **Use an OASIS XML Catalog as the public mapping projection.** DynamoDB is the authoritative control-plane registry; generated OASIS XML Catalog files are its CDN-served read model. WebVOWL does not query DynamoDB for normal resolution.
10. **Keep seed and dynamic mappings distinct.** The existing `ONTOLOGY_CATALOG` and the resources under `/ontology/external/` become a curated, immutable seed catalog. Dynamic materializations can add exact source mappings but can never override a seed entry.
11. **Validate before publishing.** A successful HTTP response, plausible media type, `.owl` suffix, or `owl:Ontology` declaration is not sufficient. Publication requires a successful parse through the public `owlapi` manager using the defined finite-resource profile.
12. **Retain the source document IRI as parser context.** The CloudFront artifact IRI is a retrieval location only. It must never become the base IRI used to resolve relative ontology content.
13. **Treat the service as an anonymous public fetch capability.** SSRF prevention, bounded work, idempotency, negative caching, application quotas, queue concurrency, WAF rate limiting, takedown, and provenance are mandatory launch requirements.
14. **Keep normal responses out of Lambda.** Lambda never streams ontology bytes to viewers. It writes validated artifacts to S3 and returns only small state/error responses or a redirect to the immutable artifact.
15. **Collect minimized operational evidence.** Use selected-field CloudFront standard logs v2, low-cardinality CloudWatch metrics, private Athena reports, and public per-artifact provenance. Do not log request bodies, raw viewer IP addresses, cookies, referrers, user agents, or raw source IRIs in application logs.
16. **Protect the budget without disabling the website.** Replace cache-related use of the current whole-distribution shutdown model with a materialization kill switch, quotas, reserved concurrency, WAF, alarms, and a USD 10 monthly feature budget. Existing cached artifacts and the website remain readable when new materialization is disabled.

### 1.1 Why the TTLs are not uniformly one day

A one-day TTL is a reasonable first intuition for stable public ontologies, but it conflates three different resources:

| Resource | Mutability | Selected browser/edge policy | Reason |
| --- | --- | --- | --- |
| Content-addressed ontology artifact | Immutable | `public, max-age=31536000, immutable` | The path changes when bytes change, so revalidation provides no correctness benefit. |
| Immutable seed/dynamic catalog generation | Immutable | `public, max-age=31536000, immutable` | A generation is identified by its digest and is never edited. |
| Stable root catalog | Mutable pointer | `public, max-age=300, stale-while-revalidate=300, stale-if-error=86400` | New mappings must become discoverable promptly, but the last good root remains useful during a transient origin failure. |
| Upstream source freshness | Mutable external state | Revalidate active sources every 30 days with conditional requests | Origin polling is a control-plane concern, not a CDN-object TTL. The last validated artifact remains available during refresh failures. |
| Invalid-ontology result | Mutable negative result | 24-hour retry suppression | Prevent repeated expensive parsing without making a rejection permanent. |
| Transient retrieval failure | Transient | 15-minute retry suppression | Reduce request amplification while allowing recovery. |

This is more liberal than a one-day object TTL where immutability permits it, and more responsive where a mutable catalog pointer requires it.

---

## 2. Mandatory starting checkpoint

Cache Phase 0 may inspect and record evidence, but no production or test implementation may begin until every item below is true.

### 2.1 Phase 20 evidence

The implementer must verify the completion evidence required by §17.27.6 of the predecessor plan:

- npm `latest` resolves to the accepted production cutover coordinate—normally `owlapi@0.1.0`, or only the exact corrective/contingency patch recorded by Phase 20;
- the registry tarball, source tag, provenance, integrity, SBOM, release evidence, and immutable GitHub release agree;
- WebVOWL declares that exact registry coordinate and resolves it through its committed lockfile;
- WebVOWL has no maintained package copy, workspace/local/Git dependency, resolver alias, or source-tree fallback;
- imports use only approved public specifiers such as `owlapi`, `owlapi/apibinding`, `owlapi/model`, `owlapi/io`, and `owlapi/formats`; and
- all Phase 20 WebVOWL tests, development build, production build, production ontology corpus, and import-aware workloads pass.

The normal coordinate is `0.1.0`, but this plan must read the recorded Phase 20 production cutover coordinate rather than assuming that the extraordinary contingency branches did not run.

### 2.2 Relationship to the expected `owlapi@0.2.0` lifecycle programme

The ontology-lifecycle capability plan normally targets `owlapi@0.2.0`, or the next available zero-minor if an intervening incompatible correction consumes that coordinate. This cache does **not** require the closure-query, merger, mutation, or storer slice in that release. Therefore:

- the cache may start after Phase 20 even if the lifecycle programme has not started;
- if WebVOWL has already accepted a later production `owlapi` release when Cache Phase 0 begins, both WebVOWL and the Lambda validator use that exact accepted coordinate;
- the Lambda deployment must never lag on a parser version that WebVOWL no longer uses; and
- if the accepted public document-loader/source contract cannot preserve the source document IRI while retrieving bytes from an artifact IRI, implementation stops. The missing general capability is proposed through the canonical `owlapi` public-surface and zero-major release process and published before WebVOWL integration. No private or deep import is an acceptable workaround.

This cache plan accepts an exact already-published `owlapi` coordinate; it does
not itself allocate or require a new package version. If it discovers a genuine
package defect or missing general capability, that work follows a separately
approved package change and the then-current zero-major version policy before
cache integration resumes.

### 2.3 Package boundary invariants

The future code must satisfy all of the following:

```javascript
// Allowed examples; the exact symbol placement is read from the accepted API.
import { OWLManager, StringDocumentSource } from "owlapi";
import { OWLOntologyLoaderConfiguration } from "owlapi/model";
import {
  ResourceLimitError,
  SecurityPolicyError,
  UnloadableImportError,
} from "owlapi/io";
```

It must contain none of the following:

```text
../../owlapi-js/
src/owlapi-js/
owlapi/internal/
an unexported syntax parser path
an owlapi repository sibling path
an npm link, workspace, file:, Git, or mutable-tag dependency
```

The package remains a deep module: the application supplies document resolution policy through the stable loader seam; the validator supplies bytes through `StringDocumentSource`; neither caller reaches parser registries, RDF translators, format detectors, or other internal engines.

### 2.4 Configuration and external-state approval gate

This document is authorization to create this plan only. It is not authorization to change configuration or external AWS state.

Before future implementation changes any of the following, the implementer must present the exact diff, settings, behavioural impact, deployment impact, and smallest viable change for explicit approval:

- either repository’s `package.json` or lockfile;
- `amazon-aws/cdk.json`, `requirements.txt`, `app.py`, CDK stack/construct files, Lambda packaging configuration, or deployment scripts;
- WebVOWL build, test, lint, browser, hosting, Content Security Policy, or deployment configuration;
- CloudFront behaviours, origins, cache/origin-request/response-header policies, logging, custom errors, or distribution association;
- S3, DynamoDB, SQS, Lambda, WAF, CloudWatch, Athena, EventBridge, SNS, IAM, Route 53, AWS Budgets, or cost-allocation resources;
- npm publication or an `owlapi` public-surface change; and
- a commit, tag, push, release, deployment, seed upload, catalog publication, or production feature enablement.

Commit steps later in this plan are proposed review checkpoints. Repository policy still requires explicit authorization before each commit and separate authorization before any push.

---

## 3. Scope and non-scope

### 3.1 In scope

- Exact source-document mapping from an ontology/import IRI to a validated immutable artifact IRI.
- Curated migration of the current WebVOWL ontology catalog and `/ontology/external/` seed material.
- A browser loader that attempts catalog, direct HTTPS-capable retrieval, and then materialization in that order.
- Top-level IRI loading and transitive import loading through the same application-owned loader.
- Server-side bounded retrieval of public HTTP(S) representations that browsers cannot read because of CORS or mixed-content policy.
- Syntax/structural acceptance through the public `owlapi` manager using the same package coordinate and compatible parsing policy as WebVOWL.
- Content-addressed S3 storage, provenance, registry state, OASIS catalog projection, revalidation, and last-known-good behaviour.
- One existing pay-as-you-go CloudFront distribution, one new private S3 origin, and one protected Lambda Function URL control-plane origin.
- One narrowly scoped WAF rate-based rule, initially in count mode.
- Minimized access logging, operational metrics, private usage reports, cost projection, alerts, and a materialization kill switch.
- Takedown/quarantine and source-denylist operations.
- Local, installed-package, browser, CDK synthesis, integration, canary, rollout, and rollback verification.

### 3.2 Explicitly out of scope

- A general-purpose anonymous CORS proxy that returns arbitrary upstream bytes.
- HTML, images, scripts, archives, SPARQL endpoints, authenticated resources, cookies, or user-supplied request headers.
- Ontology consistency checking, satisfiability, entailment, reasoner execution, OWL profile classification as an acceptance gate, or a requirement for an explicit `owl:Ontology` declaration.
- Server-side import traversal, closure collapse, `OWLOntologyMerger`, storage through the ontology-lifecycle storer APIs, or a universal-ontology publication workflow.
- Automatic alias creation from a parsed ontology IRI, version IRI, namespace, redirect target, `owl:sameAs`, or HTTP canonical link.
- Remote JSON-LD context retrieval or XML external-entity retrieval during validation.
- User accounts, API keys, per-user quotas, billing, or a paid service tier.
- A new CloudFront flat-rate plan, a new production distribution, or transfer of Route 53 management.
- Lambda response streaming, API Gateway, a NAT Gateway, a Lambda VPC attachment, ElastiCache, RDS, OpenSearch, Kinesis, Firehose, or a continuously running server.
- A browser-to-DynamoDB lookup path or a Lambda invocation on catalog/artifact hits.
- A complete browser implementation of every OASIS catalog entry type. WebVOWL consumes the exact safe profile generated by this service: `uri`, `nextCatalog`, `xml:base`, and foreign-namespace metadata. The published files themselves remain OASIS XML Catalogs 1.1 conformant.
- Service-worker, IndexedDB, or localStorage persistence for the catalog. Browser HTTP caching and one in-memory resolution map are sufficient initially.
- New TypeScript source or declarations. Both repositories retain their accepted JavaScript/Python technology choices unless separately approved.

---

## 4. Domain language and naming registry

The service crosses OWL, browser, HTTP, CDN, storage, and queue boundaries. Generic terms such as “URL,” “cache file,” “proxy request,” and “ontology ID” are too ambiguous. Production code, schemas, tests, metrics, logs, and documentation must use the following vocabulary consistently.

| Term / code name | Meaning | Must not mean |
| --- | --- | --- |
| **source document IRI** / `sourceDocumentIri` | The exact absolute HTTP(S) IRI WebVOWL or `owlapi` asked the application loader to resolve. It is the catalog lookup key and parser document context. | The S3/CloudFront artifact location or a parsed ontology IRI. |
| **browser retrieval IRI** / `browserRetrievalIri` | The concrete HTTPS-capable IRI the browser first attempts, after the existing safe HTTP→HTTPS upgrade rule. | A new logical alias. |
| **upstream retrieval IRI** / `upstreamRetrievalIri` | The concrete IRI the worker requests. It may start with the HTTPS candidate and, when permitted, fall back to the original HTTP source. | The materialized artifact IRI. |
| **effective upstream IRI** / `effectiveUpstreamIri` | The final public HTTP(S) IRI after the worker’s validated redirect chain. | An automatically published catalog alias. |
| **artifact IRI** / `artifactIri` | The immutable CloudFront IRI of validated, content-addressed representation bytes. | The base IRI passed to `owlapi`. |
| **ontology IRI** / `ontologyIri` | The logical ontology IRI declared by the parsed `OWLOntologyID`, when present. | The HTTP retrieval location merely because it was requested. |
| **version IRI** / `versionIri` | The version IRI declared by the parsed ontology, when present. | An S3 object version or application release version. |
| **source key** / `sourceKey` | Lowercase hexadecimal SHA-256 of the canonical source-document-IRI serialization. | A secret, user identity, or content digest. |
| **materialization ID** / `materializationId` | The public request/status identifier. Version 1 uses the same 64 hexadecimal characters as `sourceKey`. | An incrementing ID that can collide across regions. |
| **artifact digest** / `artifactSha256` | Lowercase hexadecimal SHA-256 of the exact representation bytes stored in S3 after HTTP content coding has been removed. | A digest of decoded JavaScript text or the source IRI. |
| **catalog generation digest** / `catalogGenerationSha256` | SHA-256 of one deterministic immutable dynamic catalog generation. | The artifact digest of any ontology. |
| **validation profile** / `validationProfileId` | Versioned identity of the exact `owlapi` coordinate, public loader configuration, byte/text decoding rule, and service limits used for acceptance. | A claim of logical consistency or full OWL conformance. |
| **artifact** | An immutable validated representation stored once by content digest. | A mutable source alias. |
| **materialization** | The bounded operation that retrieves, validates, stores, registers, and projects one source document. | Import-closure merger or format conversion. |
| **registry** | The DynamoDB control-plane state for sources, artifacts, leases, failures, and refresh. | The normal client lookup mechanism. |
| **catalog projection** | The deterministic OASIS XML read model generated from accepted registry state. | An independently maintained source of truth. |
| **seed entry** | A curated mapping migrated from the existing catalog/external corpus and published in an immutable seed generation. | Any first-seen dynamic source. |
| **dynamic entry** | An exact source mapping admitted by the materialization service. | An alias inferred from parsed content. |
| **last-known-good artifact** | The latest previously validated artifact retained when refresh fails. | An unvalidated response retained because it looked plausible. |

### 4.1 Canonicalization contract

`canonicalizeSourceDocumentIri(value)` performs only transport-safe, standards-based normalization:

1. Require a string no longer than 4,096 UTF-8 bytes.
2. Parse with the WHATWG `URL` implementation used by Node.js 24.
3. Require `http:` or `https:`.
4. Reject a username, password, non-default port, or empty hostname.
5. Remove the fragment from the retrieval component because HTTP never transmits it, while retaining the original fragment-bearing source document IRI as parser context if the accepted `owlapi` contract permits it.
6. Use the URL serializer’s lowercase scheme/host, IDNA processing, default-port removal, and percent-encoding rules.
7. Preserve path and query semantics; do not sort query parameters, remove a trailing slash, collapse distinct percent-encodings beyond the URL serializer, or equate HTTP with HTTPS.

The function returns an immutable record:

```javascript
{
  sourceDocumentIri,
  retrievalIriWithoutFragment,
  sourceKey,
}
```

The API, worker, seed importer, catalog publisher, client tests, and reporting joins use one shared set of canonicalization fixtures. The browser may have an independent implementation, but cross-runtime fixtures must prove byte-for-byte agreement for every accepted and rejected case.

---

## 5. Current-state migration anchors

The implementation starts from the post-Phase-20 tree, not today’s tree. These current files are nevertheless important migration evidence and must be reconciled during Cache Phase 0:

| Current path | Current responsibility | Planned disposition after Phase 20 and this cache plan |
| --- | --- | --- |
| `src/owl2vowl/js/constants.js` | Defines `ONTOLOGY_BASE_URL` and the static `ONTOLOGY_CATALOG`. | Export seed entries into the curated seed manifest, remove the runtime mapping object after parity evidence, and retain only semantically named stable endpoint configuration if still needed. |
| `src/owl2vowl/js/importResolver.js` | Combines static IRI mapping, browser fetch, limits, and `StringDocumentSource` creation. | Replace with the deeper `WebVowlOntologyDocumentLoader`; do not retain a second mapper/fetch path. |
| `src/owl2vowl/js/index.js` | Creates the ontology manager, injects the current resolver as both mapper and loader, and calls the internal package tree. | Use only installed `owlapi` exports and inject one application-owned loader through the accepted manager option. |
| `src/app/js/loadingModule.js` | Fetches a top-level IRI independently, then passes text into `owl2vowl.loadWithImports`. | Route top-level ontology-document retrieval through the same loader used for imports so CORS fallback and document-IRI preservation cannot diverge. JSON/VOWL-JSON loading remains separate. |
| `src/shared/js/util/resolveFetchUrl.js` | Upgrades an HTTP retrieval target to HTTPS when WebVOWL itself is on HTTPS. | Retain its behaviour for unrelated JSON paths or replace ontology use with the more precise `selectBrowserRetrievalIri` owned by the loader module. |
| `src/owlapi-js/**` | Current staging implementation. | Gone as a maintained WebVOWL package tree after Phase 20. This plan must not add, edit, import, or test against it. |
| `amazon-aws/infrastructure/stack.py` | Owns the current distribution, imported/static origin behaviour, static bucket, a whole-distribution cost cutoff, and unrelated account resources. | Preserve deployed identities; add cohesive validated-cache stacks/constructs and the narrow distribution behaviours without replacing the existing distribution, certificate, DNS records, or static bucket. |
| `amazon-aws/CloudFront/Functions/RewriteOntologyURI.js` | Rewrites extensionless requests under the broad `ontology/*` behaviour. | Leave existing behaviour unchanged. More-specific catalog/artifact/API behaviours must not associate this rewrite function. |
| `amazon-aws/Lambda/Functions/DisableCloudFrontOnCostLimit.js` | Can disable the entire distribution after the configured ceiling. | Do not use it as the cache feature kill switch. Reconcile it in the cost-control migration so a cache budget event cannot take down the website or existing ontology artifacts. |

### 5.1 Seed baseline

The seed baseline is the union of:

- every exact key/value mapping exported by the last accepted `ONTOLOGY_CATALOG` before removal;
- every object actually referenced under `https://haddenindustries.com/ontology/external/`;
- the externally hosted mapping currently represented by the catalog, such as a pinned W3C namespace resource, after the same validation and provenance process; and
- any additional `/ontology/external/` object explicitly approved as a seed despite not being referenced by the JavaScript catalog.

Unreferenced S3 objects are inventory findings, not automatic public mappings. Missing objects, redirects, duplicate content, invalid documents, and mappings whose logical/source IRI differs from their current retrieval IRI must be resolved explicitly in the seed evidence.

---

## 6. Target architecture

### 6.1 Request/data flow

```text
WebVOWL UI / owl2vowl composition root
                    │
                    ▼
       WebVowlOntologyDocumentLoader
                    │
        ┌───────────┼─────────────────────┐
        │           │                     │
        ▼           ▼                     ▼
 OASIS catalog   direct fetch     materialization client
 CloudFront/S3   source HTTPS     POST/GET through CloudFront
        │           │                     │
        │           │                     ▼
        │           │       OAC-protected Lambda Function URL
        │           │                     │
        │           │              DynamoDB registry
        │           │                     │
        │           │                    SQS
        │           │                     │
        │           │                     ▼
        │           │       ontology materialization worker
        │           │       ┌─────────────┴─────────────┐
        │           │       ▼                           ▼
        │           │  SSRF-safe fetch        public npm `owlapi`
        │           │       │                 validation profile
        │           │       └─────────────┬─────────────┘
        │           │                     ▼
        │           │       content-addressed private S3
        │           │                     │
        │           │           catalog projection queue
        │           │                     │
        │           │                     ▼
        │           │       immutable OASIS generation + root
        └───────────┴─────────────────────┘
                    │
                    ▼
 StringDocumentSource(text, {
   documentIRI: original source document IRI,
   contentType,
   fileName,
 })
                    │
                    ▼
       public `owlapi` manager → VOWLBuilder
```

### 6.2 Data plane versus control plane

| Plane | Components | Invoked when | Design constraint |
| --- | --- | --- | --- |
| Data plane | Existing CloudFront distribution, dedicated private artifact S3 origin, immutable artifact/catalog objects | Every catalog or artifact read | No Lambda, DynamoDB, or SQS dependency on a hit. |
| Browser direct path | User agent → source origin | No catalog entry exists and browser policy permits the source response | `credentials: "omit"`; never use `mode: "no-cors"`; returned response must be readable. |
| Control plane | CloudFront API behaviour, Lambda Function URL, API Lambda, DynamoDB, SQS, worker Lambda, catalog publisher | New source, retryable rejected source, refresh, administrative action | Finite work, idempotent state, no ontology bytes returned by Lambda. |
| Operations plane | CloudFront logs v2, CloudWatch metrics/alarms/dashboard, Athena, SNS, cost controls | Asynchronously | No high-cardinality CloudWatch dimensions or sensitive request fields. |

### 6.3 Deep module boundaries

The architecture uses four intentional seams:

1. **`owlapi` document-loader interface** — accepted public package seam. WebVOWL supplies one object implementing `load(documentIRI, { config, signal })`. The cache policy is hidden behind that small interface.
2. **Materialization HTTP contract** — browser/control-plane seam. It exposes only submission/status/error/redirect semantics, not DynamoDB state or worker internals.
3. **Registry interface** — API/worker/catalog seam. Conditional state transitions, leases, negative-cache rules, and catalog eligibility are implemented in one cohesive module.
4. **Catalog projection contract** — control-plane/data-plane seam. DynamoDB state becomes immutable OASIS generations and one short-lived stable root.

Production modules may accept a clock, random source, fetch implementation, DNS resolver, or AWS client through construction for deterministic tests, but the project must not create an interface for every internal function. A seam is justified only where there is a real platform boundary or a production and test implementation.

### 6.4 Why DynamoDB is not the browser catalog

A browser-to-key/value lookup would add an API/Lambda/DynamoDB request, latency, abuse surface, and regional dependency to every import. The mapping set is public and read-heavy, so a generated static catalog is the deeper and cheaper interface:

```text
DynamoDB registry (authoritative mutable control state)
                 │ deterministic projection
                 ▼
OASIS XML Catalog generation (immutable public read model)
                 │ CloudFront/S3
                 ▼
WebVOWL in-memory exact-Iri Map
```

The initial catalog profile is capped at 25,000 entries and 8 MiB across the root plus followed catalogs. If measured catalog acquisition/parsing exceeds 100 ms p95 in the accepted browser benchmark or the cap is approached, a separately approved generated index/sharding design is required. The response is not to put DynamoDB on the normal read path.

---

## 7. End-to-end resolution semantics

### 7.1 Catalog hit

1. `owlapi` calls `WebVowlOntologyDocumentLoader.load(documentIRI, { config, signal })`.
2. The loader normalizes the input through the accepted public `IRI` contract and retains it as `sourceDocumentIri`.
3. The loader coalesces catalog acquisition with any in-progress acquisition for the page.
4. The catalog resolver performs an exact source-document-IRI lookup. It does not perform prefix rewriting, trailing-slash guessing, scheme aliasing, ontology-ID inference, or case folding.
5. On a hit, the loader fetches the artifact IRI with `credentials: "omit"`, the caller’s abort signal, the finite byte limit, and no cache-busting query.
6. The catalog-supplied `source` query token is preserved for access-log attribution but ignored by the CloudFront cache key and S3 origin request.
7. The loader returns a public `StringDocumentSource` whose `documentIRI` is the original `sourceDocumentIri`, never `response.url` and never the artifact IRI.

No control-plane call occurs.

### 7.2 Catalog miss followed by direct success

1. The loader selects `browserRetrievalIri`. When WebVOWL runs in an HTTPS secure context and the source uses HTTP, it attempts the equivalent HTTPS IRI first; it never deliberately causes active mixed content.
2. The loader performs one readable CORS fetch with `credentials: "omit"` and the caller’s signal.
3. It checks `Response.ok`, `Content-Length` when present, then enforces the 33,554,432-byte limit while consuming the body.
4. A readable HTTP error is an upstream result, not evidence of CORS. The loader returns a typed load failure and does not hide it behind proxy fallback.
5. A successful response becomes a `StringDocumentSource` using `sourceDocumentIri` as document context and the source path’s last segment as `fileName` hint.
6. `owlapi` performs the actual syntax/ontology parse. A directly readable document is not written to the shared cache in version 1 because the stated use case is CORS/mixed-content fallback, not indiscriminate mirroring.

### 7.3 Catalog miss followed by materialization

The loader invokes materialization only when direct retrieval cannot produce a readable response because:

- Fetch rejects with its network/CORS failure class after the request was actually attempted;
- the source is HTTP while the application is HTTPS and the HTTPS-upgraded candidate cannot be read; or
- browser policy prevents the attempt before a readable response exists.

Abort, caller cancellation, a local resource limit, a readable 4xx/5xx response, an unsupported scheme, or a programming error never triggers materialization fallback.

The sequence is:

1. Serialize the exact JSON request body once.
2. Compute SHA-256 over those UTF-8 bytes with `crypto.subtle.digest`.
3. Send `POST /ontology/materializations` with `Content-Type: application/json`, `x-amz-content-sha256`, `credentials: "omit"`, and the caller’s signal.
4. A new/idempotent pending request returns `202 Accepted`, `Location` of its status resource, and `Retry-After`.
5. Poll with a cancellable recursive timeout, not `setInterval`. Honor a valid server `Retry-After`; otherwise use 1, 2, 4, then 8 seconds with ±20% jitter and an 8-second ceiling.
6. A ready status returns `303 See Other` to the immutable artifact. Browser Fetch follows the redirect; the client verifies that the final response IRI is an HTTPS IRI under `/ontology/cache/artifacts/sha256/` on the configured service origin.
7. The loader consumes the bounded artifact response, records an in-memory exact mapping for the rest of the page session, and returns a `StringDocumentSource` with the original `sourceDocumentIri`.
8. The asynchronous catalog publisher makes the mapping available to future sessions. The first caller does not wait for the stable catalog root’s edge TTL.

The materialization wait budget is 60 seconds. A pending operation beyond that budget produces a retryable `UnloadableImportError`; it is not polled indefinitely in the background.

### 7.4 Import-closure behaviour

The application creates the public `owlapi` manager with this loader and the accepted immutable configuration. WebVOWL’s import-aware path explicitly sets `remoteImports: true` because the caller—not package capability detection—authorizes document resolution. The package continues to own:

- import declaration interpretation;
- direct/transitive traversal;
- duplicate and cycle handling;
- maximum import count and depth;
- missing-import `throw` versus structured-diagnostic behaviour; and
- the returned structural ontologies/import graph.

The application loader owns only how one requested document is resolved. The cache worker validates only that one document and does not fetch its imports.

### 7.5 Refresh and last-known-good behaviour

1. A daily scheduler selects registry entries whose `nextRevalidationAt` is due, capped at 100 sources per UTC day.
2. It conditionally changes `READY` or `STALE` to `REVALIDATING` while leaving the active artifact/catalog mapping readable.
3. The worker sends `If-None-Match` and/or `If-Modified-Since` when trustworthy source validators were recorded.
4. `304 Not Modified` updates freshness/provenance and returns to `READY` without a new artifact or catalog generation.
5. New valid bytes produce a new artifact digest, atomically promote the registry pointer, retain the prior artifact, and enqueue one catalog-projection event.
6. A transient retrieval or validation failure changes the control state to `STALE` and schedules bounded retry, but the last-known-good artifact stays mapped.
7. Automatic refresh never deletes a previously accepted mapping merely because a source is temporarily offline or changed to invalid bytes.
8. Only an explicit quarantine/takedown action removes a mapping from new catalog generations. Previously cached edge/browser copies expire under their immutable URL contract; emergency CloudFront invalidation is separately authorized and reserved for security/legal incidents.

---

## 8. Public HTTP contract

### 8.1 Stable paths

| Method and path | Owner | Cache policy | Purpose |
| --- | --- | --- | --- |
| `POST /ontology/materializations` | API Lambda | Disabled; `no-store` | Submit or resume exact-source materialization. |
| `GET /ontology/materializations/{materializationId}` | API Lambda | Disabled; `no-store` | Observe pending/rejected/ready state. |
| `OPTIONS /ontology/materializations` and `OPTIONS /ontology/materializations/{materializationId}` | API Lambda / response headers policy | Disabled | CORS preflight. |
| `GET|HEAD /ontology/cache/artifacts/sha256/{artifactSha256}` | Artifact S3 origin | One year immutable | Fetch validated representation bytes. |
| `GET|HEAD /ontology/cache/provenance/sources/{sourceKey}.json` | Artifact S3 origin | Generation-aware; one day | Inspect public source/provenance metadata. |
| `GET|HEAD /ontology/catalog-v001.xml` | Artifact S3 origin | Five minutes plus stale controls | Stable OASIS catalog root. |
| `GET|HEAD /ontology/catalogs/seed/v1/catalog-v001.xml` | Artifact S3 origin | One year immutable | Curated seed catalog generation. |
| `GET|HEAD /ontology/catalogs/dynamic/sha256/{catalogGenerationSha256}/catalog-v001.xml` | Artifact S3 origin | One year immutable | Dynamic exact-source mapping generation. |

Both hexadecimal path parameters are exactly 64 lowercase ASCII hexadecimal characters. Path decoding, extra segments, encoded slashes, dot segments, upper-case digests, or unexpected suffixes fail closed.

### 8.2 Submission request

The version 1 body is intentionally narrow:

```json
{
  "sourceDocumentIri": "http://example.org/ontology"
}
```

Contract:

- UTF-8 JSON object, maximum request body 8,192 bytes;
- exactly one known member in version 1;
- absolute HTTP(S) IRI, maximum 4,096 UTF-8 bytes after extraction;
- no caller-provided headers, method, credentials, content type, redirect policy, parser choice, validation mode, destination key, alias, or refresh flag; and
- `x-amz-content-sha256` is the 64-character lowercase SHA-256 of the exact body bytes sent to CloudFront.

Unknown members fail with `400 REQUEST_SCHEMA_INVALID`; they are not silently ignored because that would make version skew and security-sensitive client mistakes invisible.

### 8.3 Pending response

```http
HTTP/1.1 202 Accepted
Content-Type: application/json
Cache-Control: no-store
Location: https://haddenindustries.com/ontology/materializations/64-hex-characters
Retry-After: 2
```

```json
{
  "materializationId": "64-hex-characters",
  "state": "PENDING",
  "statusIri": "https://haddenindustries.com/ontology/materializations/64-hex-characters"
}
```

The examples use descriptive values; production schemas require the exact digest grammar above.

### 8.4 Ready response

```http
HTTP/1.1 303 See Other
Cache-Control: no-store
Location: https://haddenindustries.com/ontology/cache/artifacts/sha256/64-hex-characters?source=64-hex-characters
```

The redirect target is built only from validated registry fields. A caller cannot provide it. Fetch follows the redirect to the S3/CloudFront data plane, so Lambda returns no ontology body and incurs no response-streaming charge.

### 8.5 Error response

```json
{
  "error": {
    "code": "ONTOLOGY_DOCUMENT_INVALID",
    "message": "The retrieved representation was not accepted by the ontology validation profile.",
    "retryable": false
  },
  "materializationId": "64-hex-characters",
  "requestId": "opaque-request-id"
}
```

Messages are bounded and never echo the source IRI, upstream body, response headers, parser excerpt, stack trace, IP address, or AWS identifier. Machine clients use `code`, never message matching.

| HTTP status | Stable code | Meaning / retry policy |
| ---: | --- | --- |
| 400 | `REQUEST_SCHEMA_INVALID`, `SOURCE_IRI_INVALID` | Malformed request or IRI; no automatic retry. |
| 403 | `SOURCE_IRI_FORBIDDEN`, `MATERIALIZATION_DISABLED`, `SOURCE_QUARANTINED` | Policy/kill-switch rejection; no client retry until policy changes. |
| 405 | `METHOD_NOT_ALLOWED` | CloudFront allowed the method but the API contract does not. |
| 410 | `MATERIALIZATION_NOT_AVAILABLE` | Well-formed status ID has no retained registry state; resubmit the source rather than polling. This avoids the distribution’s current custom-404 caching behaviour. |
| 413 | `SOURCE_REPRESENTATION_TOO_LARGE` | Declared or observed representation exceeds 33,554,432 bytes; suppress retries for seven days. |
| 422 | `ONTOLOGY_DOCUMENT_INVALID` | `owlapi` rejected the representation; suppress retries for 24 hours. |
| 429 | `SOURCE_SUBMISSION_RATE_EXCEEDED`, `DAILY_NEW_SOURCE_QUOTA_EXCEEDED` | Honor `Retry-After`; do not spin. |
| 502 | `UPSTREAM_RESPONSE_REJECTED`, `UPSTREAM_NETWORK_FAILURE` | Upstream response could not be materialized; suppress retry for 15 minutes, or one hour for stable 4xx source responses. |
| 504 | `UPSTREAM_TIMEOUT` | Retrieval/validation exceeded its finite budget; suppress retry for 15 minutes. |

### 8.6 CORS and response headers

All endpoints are public and credential-free. Use two response-header policies rather than advertising methods a resource does not support:

```text
Access-Control-Allow-Origin: *
Access-Control-Max-Age: 86400
Cross-Origin-Resource-Policy: cross-origin
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer
```

The API policy adds:

```text
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: content-type, x-amz-content-sha256
Access-Control-Expose-Headers: content-type, location, retry-after
```

The artifact/catalog/provenance policy adds:

```text
Access-Control-Allow-Methods: GET, HEAD, OPTIONS
Access-Control-Allow-Headers: *
Access-Control-Expose-Headers: content-type, etag,
  x-ontology-artifact-sha256, x-ontology-validation-profile
```

No response sends `Access-Control-Allow-Credentials`. Browser requests always use `credentials: "omit"`. With wildcard origin and no credentials, no origin-reflecting code or `Vary: Origin` cache fragmentation is needed.

CloudFront response-headers policies are the sole production owner of these CORS/security fields. Disable Function URL CORS configuration and do not duplicate those headers in Lambda responses; duplicated `Access-Control-Allow-Origin` values can make an otherwise valid browser response fail. The dedicated S3 bucket has the matching credential-free GET/HEAD CORS rule so an OPTIONS request reaching the origin is answered consistently.

Artifact/catalog responses also use a restrictive response CSP suitable for non-HTML data, such as `default-src 'none'; sandbox`, after real-browser verification confirms that it does not interfere with Fetch consumption.

---

## 9. Registry and state-machine contract

### 9.1 DynamoDB table

The `ValidatedOntologyRegistryTable` uses DynamoDB Standard, on-demand capacity, point-in-time recovery, deletion protection, AWS-owned encryption, and a string partition key named `registryKey`. It deliberately starts without a GSI; the expected mapping set is small, API operations are point reads, and bounded scheduled scans are cheaper and simpler than speculative indexes. Add an index only after measured scan cost/latency justifies a separately approved schema change.

Source records use `registryKey = SOURCE#{sourceKey}` and contain only fields with a defined owner:

```javascript
{
  registryKey: "SOURCE#…",
  schemaVersion: 1,
  sourceKey,
  sourceDocumentIri,
  retrievalIriWithoutFragment,
  materializationState,
  curation: "SEED" | "DYNAMIC",
  activeArtifactSha256,
  previousArtifactSha256,
  artifactByteLength,
  artifactContentType,
  artifactStoredAt,
  ontologyIri,
  versionIri,
  effectiveUpstreamIri,
  upstreamEtag,
  upstreamLastModified,
  upstreamRetrievedAt,
  validatedAt,
  validationProfileId,
  validationDiagnosticCodes,
  nextRevalidationAt,
  lastFailureCode,
  lastFailureAt,
  retryAfter,
  leaseOwner,
  leaseExpiresAt,
  attemptCount,
  catalogEligible,
  quarantinedAt,
  quarantineReasonCode,
  createdAt,
  updatedAt
}
```

Absent optional fields are omitted; they are not represented by empty strings, zero timestamps, or invented sentinel IRIs. Raw parser messages and upstream bodies never enter DynamoDB.

Control records share the table only where transactional coupling is valuable:

```text
CONTROL#SERVICE
QUOTA#UTC#YYYY-MM-DD
CATALOG#CURRENT
```

- `CONTROL#SERVICE` contains `materializationEnabled`, the approved daily quota, and a monotonic policy revision.
- `QUOTA#UTC#YYYY-MM-DD` counts only newly admitted source keys, not idempotent submissions or polls.
- `CATALOG#CURRENT` records the last projected registry revision, generation digest, entry count, and root ETag.

### 9.2 State machine

```text
virtual MISSING
      │ conditional submit + daily quota transaction
      ▼
   PENDING ───────────────► REJECTED
      │ worker lease           │ retryAfter reached
      ▼                        └──────────────► PENDING
    READY ───── scheduled refresh ─────► REVALIDATING
      ▲                                      │
      │ valid/304                            ├── valid new/same bytes ─► READY
      │                                      └── transient/invalid ───► STALE
      │                                                                   │
      └──────────────── successful retry/revalidation ────────────────────┘

READY | REVALIDATING | STALE | REJECTED
      └── explicit administrative action ──► QUARANTINED
```

State invariants:

- `PENDING` has a finite lease and no catalog-eligible artifact unless it is a refresh represented as `REVALIDATING`.
- `READY` has one active artifact, successful validation evidence, and `catalogEligible: true`.
- `REVALIDATING` and `STALE` retain the last-known-good active artifact and remain catalog eligible unless quarantined.
- `REJECTED` has no newly published artifact. A prior ready source uses `STALE`, not `REJECTED`.
- `QUARANTINED` is never catalog eligible, regardless of any retained S3 object.
- A dynamic record cannot overwrite a seed record’s exact source key.
- State changes use conditional expressions on expected state/revision/lease. At-least-once SQS delivery must have the same effect as one delivery.
- DynamoDB TTL may clean expired negative/control ephemera, but correctness never depends on prompt TTL deletion.

### 9.3 Leases and concurrency

- A submission transaction creates `PENDING`, increments the daily counter only for a new source key, and sends one SQS message after the durable state exists.
- The worker conditionally acquires a 90-second lease using a unique invocation ID.
- Another worker that sees an unexpired lease acknowledges its duplicate message without retrieval.
- A worker may renew once before expiry only while the Lambda still has at least 15 seconds remaining.
- The SQS visibility timeout is six times the worker Lambda timeout; batch size is one; partial batch response is enabled; maximum event-source concurrency is two.
- A DLQ retains failed messages for 14 days and alarms on the first visible message.
- A reconciliation schedule finds expired `PENDING`/`REVALIDATING` leases and re-enqueues them with an attempt ceiling of three before a sanitized transient failure state is recorded.

---

## 10. S3 object and catalog contracts

### 10.1 Dedicated bucket

`ValidatedOntologyArtifactBucket` is private and has:

- S3 Block Public Access in full;
- bucket-owner-enforced object ownership;
- TLS-only access;
- SSE-S3 rather than a customer-managed KMS key with fixed/request charges;
- versioning for recoverable mutable-root updates;
- `RETAIN` removal policy and deletion protection at the stack/process level;
- a credential-free CORS rule allowing only GET/HEAD from any origin, the required preflight headers, and a one-day preflight age;
- no automatic deletion of current artifact or immutable catalog-generation objects;
- 90-day expiry for noncurrent versions of mutable pointer/provenance objects after rollback evidence exists; and
- an OAC-scoped read policy for the existing CloudFront distribution only.

The worker role can write artifact/provenance prefixes and read only what it must reconcile. The catalog publisher can read registry state and write only catalog prefixes. Neither role can change the bucket policy, CloudFront distribution, WAF, or unrelated static assets.

### 10.2 Key layout

```text
ontology/cache/artifacts/sha256/{artifactSha256}
ontology/cache/provenance/sources/{sourceKey}.json
ontology/catalog-v001.xml
ontology/catalogs/seed/v1/catalog-v001.xml
ontology/catalogs/dynamic/sha256/{catalogGenerationSha256}/catalog-v001.xml
```

No extension is appended to an artifact digest. `.owl`, `.rdf`, `.ttl`, and `.jsonld` are syntax hints, not stable truth, and the accepted public `owlapi` manager may accept content despite an absent or misleading source suffix.

### 10.3 Artifact write contract

1. Retrieve representation bytes after HTTP transfer/content-coding removal and before JavaScript text decoding.
2. Enforce 33,554,432 bytes while streaming; cancel the upstream body immediately on overflow.
3. Compute SHA-256 over those exact stored bytes.
4. Decode for `StringDocumentSource` with the same UTF-8 semantics used by the WebVOWL response reader.
5. Validate through public `owlapi`.
6. `PutObject` with `If-None-Match: *` and S3’s SHA-256 checksum field at the digest key. A precondition failure is a deduplication hit, not an overwrite instruction.
7. On a deduplication hit, `HeadObject` with checksum retrieval enabled and reconcile size plus SHA-256 checksum. Do not treat the S3 ETag as a cryptographic content digest. Any impossible mismatch fails closed and emits a security alarm.
8. Store a conservative recognized ontology/RDF media type only when trustworthy; otherwise use `application/octet-stream` and let `owlapi` sniff from bytes/text. Never preserve `text/html` merely because a server supplied it.
9. Set the immutable cache headers and the validation profile response metadata.
10. Promote the registry only after the S3 write/read-after-write verification succeeds.

The bucket policy enforces conditional writes on the artifact prefix. Catalog pointer writes use their separate `If-Match` contract and are not blocked by the artifact-prefix policy.

### 10.4 Public provenance

Each source key has a bounded JSON provenance document containing:

```javascript
{
  schemaVersion: 1,
  sourceKey,
  sourceDocumentIri,
  effectiveUpstreamIri,
  artifactIri,
  artifactSha256,
  artifactByteLength,
  contentType,
  ontologyIri,
  versionIri,
  retrievedAt,
  validatedAt,
  validationProfileId,
  validationDiagnosticCodes,
  curation: "SEED" | "DYNAMIC",
  freshness: "CURRENT" | "STALE",
  sourceValidators: {
    etag,
    lastModified
  },
  sourceCode: {
    repository,
    revision,
    owlapiVersion
  }
}
```

Only actually known optional fields are emitted. The provenance document contains no viewer/request data. Because the service is intended to be transparent, source and effective retrieval IRIs are public metadata; application and access logs still use `sourceKey` to minimize routine disclosure.

### 10.5 OASIS XML Catalog profile

The stable root uses the OASIS namespace and `nextCatalog` in seed-before-dynamic order:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<catalog xmlns="urn:oasis:names:tc:entity:xmlns:xml:catalog"
         xml:base="https://haddenindustries.com/ontology/">
  <nextCatalog catalog="catalogs/seed/v1/catalog-v001.xml"/>
  <nextCatalog catalog="catalogs/dynamic/sha256/CATALOG_DIGEST/catalog-v001.xml"/>
</catalog>
```

`CATALOG_DIGEST` denotes the formally defined 64-character `catalogGenerationSha256`; generation code writes its actual value and no literal marker remains in a produced file.

Each mapping is an exact `uri` entry:

```xml
<uri name="http://example.org/ontology"
     uri="https://haddenindustries.com/ontology/cache/artifacts/sha256/ARTIFACT_DIGEST?source=SOURCE_KEY"/>
```

The three symbolic values in the example are substituted only with validated lowercase digest values from the registry. XML escaping is applied after URI serialization.

Projection rules:

- Seed catalog generations are curated, versioned, immutable, and reviewed as deployment data.
- Dynamic generations contain every catalog-eligible dynamic source mapping, sorted by Unicode code-point comparison of `sourceDocumentIri`, then `sourceKey` as an impossible-tie guard.
- A dynamic source colliding with any seed source is excluded and raises an invariant failure.
- Multiple curated seed names may point to the same artifact; dynamic alias inference is forbidden.
- Declared ontology/version IRIs are provenance only and never become `uri` names automatically.
- The publisher serializes UTF-8 with LF line endings, exactly one XML declaration, double-quoted attributes, deterministic indentation, and no timestamp inside the immutable dynamic catalog. This makes identical mapping state produce identical bytes/digest.
- `generatedAt`, registry revision, entry count, and publisher revision belong in registry/provenance evidence, not in digest-unstable catalog content.
- The publisher writes the immutable generation with `If-None-Match: *`, verifies it, then replaces the stable root with `If-Match` against the last observed root ETag. A conflict causes bounded read/recompute/retry, never a blind overwrite.
- A root update is not considered complete until a fresh S3 read, CloudFront read after TTL/explicit canary route, XML parse, and representative seed/dynamic resolution all pass.

### 10.6 Browser catalog safety profile

`OasisXmlOntologyCatalog` accepts only service-owned HTTPS catalogs and enforces:

- OASIS namespace and one `catalog` document element;
- `uri`, `nextCatalog`, `group`, and `xml:base` only as needed by generated files;
- at most four `nextCatalog` levels, eight catalog files, 25,000 mappings, and 8 MiB aggregate XML;
- same-origin HTTPS `nextCatalog` targets restricted to `/ontology/catalogs/`;
- cycle detection by absolute catalog IRI;
- exact-name lookup and first-match OASIS ordering;
- a structured diagnostic for duplicate names; a conflicting duplicate fails the catalog acquisition rather than picking nondeterministically;
- no DTD, external entity, stylesheet, XInclude, script, or foreign network retrieval; and
- abort propagation through every catalog fetch.

Catalog failure is degradable: the loader continues to direct retrieval and materialization. A malformed catalog must not make all ontology loading fail.

---

## 11. Ontology validation contract

### 11.1 Definition of “valid” for this service

A representation is valid for publication when all of the following are true:

1. The source request and every redirect passed the retrieval security policy.
2. The bounded upstream response produced between 1 and 33,554,432 stored representation bytes.
3. Those bytes decoded according to the versioned validation profile without an unhandled decoding failure.
4. The accepted public `owlapi` manager successfully loaded the root `StringDocumentSource` under the exact configuration below.
5. The manager returned a structurally usable `OWLOntology` through a public API.
6. No resource, security, cancellation, document-load, unsupported-construct, syntax, aggregate-unparsable, or internal invariant error escaped.
7. The successful state, package coordinate, profile ID, byte digest, and bounded diagnostic-code set were recorded.

This means “accepted by the same safe parser semantics WebVOWL uses.” It does **not** mean the ontology is logically consistent, satisfiable, OWL DL, in a particular OWL profile, semantically complete, authoritative, current, or endorsed by Hadden Industries.

An explicit `owl:Ontology` declaration is not required because valid/useful RDF graphs can describe OWL entities and axioms without one. Conversely, the presence of `owl:Ontology` does not bypass parsing.

### 11.2 Validation profile version 1

The initial profile is named `webvowl-compatible-document-v1` and has these fixed service ceilings:

```javascript
{
  parsingMode: "compatible",
  remoteImports: false,
  remoteJsonLdContexts: false,
  missingImportHandling: "diagnostic",
  maxRemoteDocumentBytes: 33_554_432,
  maxImportCount: 256,
  maxImportDepth: 32,
  maxRedirects: 0,
  maxRetries: 0,
  collectWarnings: true,
  sourceLocations: false,
}
```

Additional parser resource limits are not duplicated here. They come from the accepted immutable `OWLOntologyLoaderConfiguration` defaults/public copying API for the exact installed package and are captured in the profile evidence. If Phase 20’s stable package freezes a lower ceiling, the service adopts the lower value; it never raises the published package’s safety limit to make the cache accept more.

`missingImportHandling: "diagnostic"` is necessary because validation is intentionally document-local: import declarations remain in the ontology, but their absence from this validation manager does not make the document invalid. `remoteImports: false` and `remoteJsonLdContexts: false` ensure that validation cannot recursively turn package parsing into network authority.

### 11.3 Exact package parity

At build and deployment time, `verifyOwlapiRuntimeParity` must fail unless:

- WebVOWL’s production lockfile and the Lambda application lockfile resolve the same exact root `owlapi` version;
- both resolve public npm-registry tarballs with recorded integrity;
- neither uses a local/workspace/Git/alias/deep path;
- the worker bundle contains that coordinate once;
- both runtime smoke tests report the same package version and profile ID; and
- representative accepted/rejected fixture digests produce the same outcome and accepted public error code in browser and Node.js 24.

The comparison is semantic, not an assumption that two lockfile text snippets happen to look alike.

### 11.4 Stored bytes and text decoding

The service stores representation bytes after HTTP content-coding removal. It requests `Accept-Encoding: identity`, but it still enforces the post-decoding byte limit because an upstream may ignore that request header.

The validator and browser reader both use streaming UTF-8 decoding equivalent to Fetch `Response.text()` for the supported initial contract. The worker hashes/stores bytes, not the resulting JavaScript string. This preserves content addressing and makes the browser parse the same representation it validated.

If the seed corpus demonstrates a required valid non-UTF-8 source that the accepted public `StringDocumentSource` cannot represent faithfully, the cache implementation pauses. A general byte/document-source capability must be added to `owlapi` through its public-surface and zero-major release process; the worker must not invent a private decoder path or silently transcode a source with changed semantics.

### 11.5 Parsed metadata

After successful validation, the worker may read only accepted public ontology methods to record:

- ontology IRI and version IRI, when declared;
- import-declaration count;
- axiom/entity counts useful for coarse operational validation; and
- bounded diagnostic codes.

It does not serialize the ontology, compare serialization text, expose private parser identities, or treat declared identifiers as aliases. If a desired metadata field is unavailable through the accepted public API, omit it rather than deep-importing an internal module.

### 11.6 Validation isolation and failure hygiene

- Create a fresh manager for each worker job so ontology IDs, document state, or parser diagnostics cannot leak across sources.
- Pass the original source document IRI into `StringDocumentSource`; never pass the artifact key.
- Do not include upstream bytes or long excerpts in thrown/logged errors.
- Normalize expected `owlapi` errors to the stable service failure taxonomy while retaining the original error as an in-memory `cause` only.
- Treat an unexpected exception as `INTERNAL_VALIDATION_FAILURE`, fail closed, and alarm. Do not misclassify it as an invalid ontology.
- Do not write an artifact before validation merely to simplify retry. The only exception is bounded ephemeral `/tmp` spooling inside the invocation when streaming memory evidence justifies it; that temporary representation is never public and is removed at invocation completion.

---

## 12. Retrieval and security architecture

### 12.1 Threat model

The primary security concern is not CORS. CORS controls which browsers may read a response; it does not make a server-side fetch safe. An anonymous materialization endpoint can otherwise be used to:

- request loopback, private, link-local, multicast, reserved, or cloud-metadata addresses;
- exploit DNS rebinding or redirect from a public hostname to an internal address;
- scan ports or protocols;
- send credentials/cookies to an attacker-controlled host;
- amplify bandwidth, CPU, memory, S3 object count, Lambda duration, or catalog size;
- persist active/non-ontology content under a trusted domain;
- poison a popular ontology IRI with content from a different declared ontology;
- force recursive imports or JSON-LD context requests;
- create high-cardinality logs/metrics or expose viewer data; and
- mirror material whose publisher prohibits caching or later requests removal.

Every control below is a launch requirement, not a later hardening list.

### 12.2 URL and DNS admission

`SafeOntologyRepresentationRetriever` must:

1. Parse with WHATWG `URL`; never validate complex URLs with a regex.
2. Permit only `http:` and `https:` and only ports 80 and 443 through default-port syntax. Reject an explicit alternate port.
3. Reject username/password, IP-literal hostnames, empty hostnames, malformed IDNs, backslashes that change parsing, and overlong values.
4. Check an exact operational denylist of source keys/domains before DNS.
5. Resolve every A and AAAA result using the request-scoped resolver.
6. Reject the entire hostname when **any** answer is non-public, including IPv4-mapped IPv6.
7. Block at least unspecified, loopback, private, shared-address-space, link-local, carrier-grade NAT, documentation, benchmarking, reserved, multicast, broadcast, unique-local IPv6, IPv6 link-local, IPv4-compatible/mapped bypass forms, and known cloud metadata ranges/hostnames. Generate the executable range table from the pinned IANA special-purpose registries and review differences during dependency updates.
8. Supply only the already validated address set to the HTTP client’s custom lookup/connection path, preserving the hostname for HTTP `Host` and TLS SNI/certificate validation. Do not perform a second uncontrolled DNS resolution between validation and connection.
9. Disable automatic redirects. For each redirect, parse, canonicalize, DNS-resolve, classify, and connect again under the same policy.
10. Permit at most three redirects and reject a redirect loop, relative location that cannot be resolved, scheme downgrade outside the explicitly allowed original-HTTP fallback, or missing/overlong `Location`.

The worker runs outside a VPC. A VPC plus NAT Gateway would add fixed cost without replacing application-layer SSRF controls. IAM remains narrow so successful SSRF cannot use the worker role to mutate unrelated services.

### 12.3 HTTP request policy

Every upstream request is a GET with:

```text
Accept: application/rdf+xml, text/turtle, application/ld+json,
  application/owl+xml, text/owl-functional, text/owl-manchester,
  application/n-triples, application/n-quads, application/trig,
  text/plain;q=0.8, application/octet-stream;q=0.5, */*;q=0.1
Accept-Encoding: identity
User-Agent: HaddenIndustries-ValidatedOntologyCache/1
```

The user agent includes a stable public policy/provenance IRI when the chosen HTTP library permits it. The request sends no `Authorization`, `Cookie`, referer, caller headers, forwarded viewer address, or browser user agent. It performs no automatic retry; SQS/state policy owns retries.

Budgets:

- DNS resolution: 3 seconds;
- TCP/TLS connection: 5 seconds;
- headers/first byte: 10 seconds;
- complete upstream retrieval: 30 seconds;
- representation bytes: 33,554,432;
- redirect count: 3;
- one HTTPS candidate plus, only for an original HTTP source, one explicitly policy-checked HTTP fallback;
- Lambda worker timeout: 60 seconds; and
- worker memory initial setting: 2,048 MiB on ARM64, subject to Cache Phase 2 benchmark evidence but never reduced below the package’s accepted large-document safety envelope without proof.

The response must be a complete 2xx representation. Reject 204, 206, authentication challenges, and range-dependent content. Record 301/308 targets as provenance but never publish them as aliases.

### 12.4 Republishing/admissibility policy

The worker rejects a response from automatic publication when:

- `Cache-Control` contains `no-store` or `private`;
- `Vary: *` is present;
- a successful response sets cookies or is evidently session/authentication dependent;
- terms/denylist/takedown policy blocks the source;
- the effective source changes to a forbidden domain/address;
- the response is too large, empty, or not accepted by `owlapi`; or
- the exact source is quarantined.

The service records `ETag`, `Last-Modified`, relevant cache directives, detected public licence annotations when available, retrieval time, effective upstream IRI, validator revision, and source-code revision. Absence of machine-readable licence metadata is visible in provenance; it is not represented as permission or a legal conclusion.

Before production launch, publish a concise cache policy and takedown contact. A takedown action sets `QUARANTINED`, removes the mapping from future catalogs, prevents rematerialization, retains private audit evidence, and determines whether emergency CloudFront invalidation is legally/security necessary. This document is engineering guidance, not legal advice; the AGPL and third-party-content obligations require an appropriate review.

### 12.5 Cache-poisoning controls

- Publish only the exact `sourceDocumentIri` that was submitted or explicitly curated as a seed name.
- Store parsed ontology/version IRIs and effective redirects as metadata only.
- Do not let a dynamic source overwrite a seed source key.
- Validate and store the same byte sequence; never re-fetch between validation and S3 write.
- Address artifacts by SHA-256 and require conditional writes.
- Build catalog entries only from registry state that references an existing verified artifact and accepted validation profile.
- Verify S3 artefact digest/length before registry promotion and during scheduled integrity sampling.
- Sign deployment/release evidence through the repositories’ accepted processes; do not claim the source ontology itself is signed by Hadden Industries.

### 12.6 Frontend security and modern browser requirements

- Run the materialization client only in a secure context because Web Crypto digest is required for CloudFront’s OAC POST payload hash.
- Feature-detect `globalThis.crypto?.subtle`, `AbortController`, `ReadableStream`, and the accepted Fetch features. Do not sniff user agents.
- Where available, compose cancellation with `AbortSignal.any()` and `AbortSignal.timeout()`; provide a small local fallback based on `AbortController` without a global polyfill.
- Never use `mode: "no-cors"`; an opaque response cannot be validated or safely cached by application code.
- Use `priority: "low"` only for speculative catalog prefetch after the page becomes interactive. A user-blocking ontology/artifact fetch or materialization poll uses normal priority.
- Do not use `setInterval`. Poll recursively after each completed status request so slow requests cannot overlap.
- Coalesce concurrent catalog fetches and exact-source materialization requests in one page.
- Limit client-side materialization submissions to four in flight even if a later `owlapi` version parallelizes import resolution.
- Preserve and display typed errors without telling users that every Fetch rejection “is CORS”; browsers intentionally do not expose that distinction reliably.
- Document the exact `connect-src https://haddenindustries.com` addition required by third-party WebVOWL deployments. Do not weaken a host’s CSP to a wildcard.

### 12.7 WAF and application quotas

Use one CloudFront-scope WebACL named `PublicWebDeliveryWebAcl` with default allow and one custom rate-based rule named `OntologyMaterializationSubmissionRateLimit`:

- aggregation: source IP;
- evaluation window: 300 seconds;
- limit: 300 matching requests;
- scope-down: method `POST` and exact URI path `/ontology/materializations`;
- initial action: `COUNT` for at least seven complete days and representative closure tests;
- production action after evidence: `BLOCK` with a small JSON 429 response; and
- CloudWatch metrics enabled, sampled requests disabled, no full WAF request logging at initial launch.

The threshold allows one browser to materialize a maximum-size 256-document import closure without immediately blocking itself. Poll GETs are excluded from this rule because applying the same low limit to submissions and status reads would punish legitimate closures.

The API additionally enforces:

- 500 newly admitted source keys across the service per UTC day;
- idempotent existing-source submissions without quota increment;
- `materializationEnabled` kill switch checked transactionally when admitting a new source;
- maximum request body and IRI size;
- maximum three worker attempts per materialization cycle;
- worker concurrency two; and
- bounded negative-cache windows.

WAF rate limiting is approximate availability protection, not exact accounting. DynamoDB transitions and the daily quota remain authoritative for work admission.

---

## 13. CloudFront and caching configuration

### 13.1 Distribution choice

Use the existing standard pay-as-you-go distribution serving `haddenindustries.com`. Do not enroll it in a CloudFront flat-rate plan and do not transfer Route 53 management. The cache-specific behaviours are more specific than `ontology/*`, so they bypass the current extensionless-ontology rewrite without changing legacy URLs.

The reason to reuse the distribution is operational and architectural locality: existing hostname/certificate/DNS, one public trust boundary, one logging stream, and no additional client origin. It is **not** a claim that CloudFront distributions have a fixed pay-twice fee. CloudFront’s always-free allowance is account-wide, and one WAF WebACL can in principle associate with multiple CloudFront distributions. If measured total-distribution traffic makes WAF on the shared distribution incompatible with the USD 10 target, implementation stops for a new architecture approval rather than silently creating another distribution.

### 13.2 Origins

| Origin | Type | Access | Purpose |
| --- | --- | --- | --- |
| Existing static origin | Current private S3 bucket/OAC | Existing policy unchanged | Website and legacy `/ontology/*`. |
| `ValidatedOntologyArtifactOrigin` | Dedicated private S3 REST origin/OAC | CloudFront distribution ARN only | Artifacts, provenance, catalog roots/generations. |
| `OntologyMaterializationApiOrigin` | Lambda Function URL with `AWS_IAM` auth and CloudFront OAC | CloudFront service principal constrained to the distribution ARN | Small submission/status/CORS responses. |

For the Function URL origin, use OAC signing behaviour `always`. Browser POSTs must supply `x-amz-content-sha256`; CloudFront supplies the SigV4 authorization to Lambda. The Function URL itself is not public.

### 13.3 Behaviour registry

| Path pattern | Origin | Allowed methods | Cache/origin details |
| --- | --- | --- | --- |
| `ontology/materializations` | API | All at CloudFront; API permits POST/OPTIONS only | `CachingDisabled`; forward body plus only required CORS/content hash/content type headers; no cookies/query. |
| `ontology/materializations/*` | API | All at CloudFront; API permits GET/OPTIONS only | Same; API validates exact path/digest. |
| `ontology/cache/artifacts/*` | artifact S3 | GET/HEAD/OPTIONS | Custom immutable policy; no cookies, headers, or query in the cache key. Viewer `source` query remains available to logs. |
| `ontology/cache/provenance/*` | artifact S3 | GET/HEAD/OPTIONS | One-day policy, ETag-aware. |
| `ontology/catalog-v001.xml` | artifact S3 | GET/HEAD/OPTIONS | Min 0, default 300, max 86,400; honor origin stale directives. |
| `ontology/catalogs/*` | artifact S3 | GET/HEAD/OPTIONS | Immutable policy. |
| Existing `ontology/*` | existing static S3 | Existing | No change. |

No cache-specific behaviour associates `RewriteOntologyURI.js`. CloudFront’s current distribution-wide custom 404 remains for legacy paths; the API contract avoids 404 so a status miss cannot inherit its five-minute custom-error TTL.

The artifact-origin request policy forwards only `Origin`, `Access-Control-Request-Method`, and `Access-Control-Request-Headers`, solely so private S3 can evaluate preflight. It forwards no cookies or query strings, and none of those headers enters the cache key. That is safe only because the bucket rule accepts every origin/header for the fixed GET/HEAD method set and the CloudFront response-headers policy overrides the resulting CORS fields with the same invariant wildcard values. Tests must issue preflights with different origins, requested methods, and header sets to prove that a cached OPTIONS response cannot grant an unsupported method or produce a false denial. All other viewer headers stay at the edge.

### 13.4 Cache-key correctness

- Artifact identity is wholly in the path digest. Ignore all query strings, headers, and cookies.
- The optional `source` query is observability attribution only. A caller may spoof it, so reports label source-level counts “attributed,” not authoritative.
- The root catalog path is stable and has no version query convention.
- Immutable generations are versioned in the path, not through invalidation or query cache busting.
- API responses are never cached, including errors and redirects.
- Set CloudFront minimum TTL to zero on mutable/API paths so origin `no-store` and revalidation directives cannot be overridden by a positive minimum.

### 13.5 Origin response metadata

Artifact responses include:

```text
Cache-Control: public, max-age=31536000, immutable
ETag: S3-managed representation ETag
X-Ontology-Artifact-SHA256: 64-hex digest
X-Ontology-Validation-Profile: webvowl-compatible-document-v1
```

The SHA-256 and profile may be stored as S3 object metadata and promoted through a CloudFront response-headers policy or origin response. Tests must prove headers are present on cache hits and misses and do not vary by source query.

---

## 14. AWS infrastructure topology and resource ownership

### 14.1 Stack dependency graph

The current application creates the global stack before the regional stack and passes the distribution into regional resources. A new regional origin needed by the global distribution would create a cycle if it also tried to install distribution-scoped access policies. Use this acyclic order:

```text
ValidatedOntologyCacheRegionalDataStack (eu-west-1)
             │ exports origin identities only
             ▼
AmazonGlobalStack / existing global delivery stack (us-east-1)
             │ creates/updates existing distribution
             ▼
ValidatedOntologyCacheRegionalAccessBindingsStack (eu-west-1)
             │ attaches S3 and Function URL resource policies
             └───────────────────────────────────────────────

Existing AmazonRegionalStack (eu-west-1) continues after global as required
by its current static-bucket distribution policy.
```

The data stack must not refer to the distribution. The bindings stack depends on both and owns the distribution-specific bucket policy and the two Lambda permissions required by Function URL OAC. This is a directed acyclic stack graph.

Do not rename deployed stack IDs, move existing constructs across scopes, or accept replacement of the distribution, certificate, hosted-zone records, or static bucket merely to make source names prettier. Any source refactor must preserve logical IDs and prove an empty replacement diff for existing resources before cache resources are added.

### 14.2 New CDK modules

Prospective semantically scoped Python modules in `amazon-aws`:

```text
infrastructure/
  validated_ontology_cache/
    __init__.py
    regional_data_stack.py
    regional_access_bindings_stack.py
    global_delivery_construct.py
    monitoring_construct.py
```

- `ValidatedOntologyCacheRegionalDataStack` owns regional storage, queues, table, functions, schedules, logs, and report data.
- `ValidatedOntologyCacheGlobalDelivery` is a Construct added inside the existing global stack and owns cache origins, behaviours, policies, global WAF, and CloudFront logging configuration.
- `ValidatedOntologyCacheRegionalAccessBindingsStack` owns cross-stack S3/Lambda resource policies.
- `ValidatedOntologyCacheMonitoring` owns native metrics, alarms, dashboard, SNS topic/subscription reuse, and the feature cost-control path.

Avoid names such as `utils.py`, `helpers.py`, `common.py`, `services.py`, or `resources.py`; they conceal ownership and become shallow dependency buckets.

### 14.3 New logical resources

| Logical name | Initial settings | Notes |
| --- | --- | --- |
| `ValidatedOntologyArtifactBucket` | private, versioned, SSE-S3, retain | New origin; no public ACL/policy. |
| `OntologyCacheObservabilityBucket` | private, SSE-S3, retain | CloudFront logs v2, Athena results, aggregate reports; raw logs expire after 90 days. |
| `ValidatedOntologyRegistryTable` | on-demand, PITR, deletion protection | Point API reads; bounded scans for catalog/refresh/report. |
| `OntologyMaterializationQueue` | Standard, managed encryption, 4-day retention | Batch size one; max concurrency two. |
| `OntologyMaterializationDeadLetterQueue` | Standard, managed encryption, 14-day retention | Alarm on first message. |
| `OntologyCatalogProjectionQueue` | Standard, managed encryption | Coalesces registry changes; publisher concurrency one and batching window 60 seconds. |
| `OntologyMaterializationApiFunction` | Node 24 ARM64, 256 MiB, 5 seconds | Function URL uses `AWS_IAM`; small JSON only. |
| `OntologyMaterializationWorkerFunction` | Node 24 ARM64, 2,048 MiB, 60 seconds | Outside VPC; bundles exact `owlapi`; reserved/max event concurrency two. |
| `OntologyCatalogProjectionFunction` | Node 24 ARM64, 512 MiB, 30 seconds | Deterministic scan/generation/root CAS; concurrency one. |
| `OntologyRevalidationSchedulerFunction` | Node 24 ARM64, 256 MiB, 30 seconds | Daily bounded due-source scan/enqueue. |
| `OntologyUsageReportFunction` | Node 24 ARM64, 256 MiB, 30 seconds | Starts/finalizes private Athena reports asynchronously. |
| `OntologyCacheOperationalDashboard` | One private CloudWatch dashboard | Prefer native service metrics; no per-source dimensions. |
| `OntologyCacheCostAlertTopic` | encrypted only if existing policy/cost permits | Reuse an existing confirmed email topic where semantically correct; do not duplicate subscribers silently. |
| `PublicWebDeliveryWebAcl` | CloudFront scope, default allow, one rate rule | Count-first rollout; WAF cost applies to all distribution requests. |

Exact physical names should normally be CloudFormation-generated to avoid global-name collisions. Use explicit names only where a human/API contract needs stability, and include account/region when the namespace is global.

### 14.4 Lambda application layout and packaging

Use one cohesive native-ESM application rather than dropping unrelated handlers into the current shared `Lambda/Functions` directory:

```text
Lambda/Applications/ValidatedOntologyCache/
  package.json
  package-lock.json
  THIRD_PARTY_NOTICES.md
  CORRESPONDING_SOURCE.md
  LICENSES/
    AGPL-3.0-only.txt
  src/
    api/
      ontologyMaterializationApi.js
    materialization/
      canonicalizeSourceDocumentIri.js
      ontologyMaterializationRegistry.js
      safeOntologyRepresentationRetriever.js
      validateOntologyDocument.js
      ontologyArtifactRepository.js
      ontologyMaterializationWorker.js
    catalog/
      oasisXmlCatalogProjection.js
      publishOntologyCatalogProjection.js
    revalidation/
      scheduleOntologyRevalidations.js
    reporting/
      ontologyCacheUsageReport.js
    observability/
      writeStructuredOperationalEvent.js
  test/
    fixtures/
```

The application manifest is private, uses `type: "module"`, exact runtime dependencies, Node’s built-in test runner, and no install/lifecycle scripts. Bundle each handler with CDK `NodejsFunction`/esbuild in ESM mode for Node 24/ARM64, without minification or source maps, and include exact AWS SDK v3 clients rather than relying accidentally on the runtime’s mutable SDK version. Only the worker bundle includes `owlapi` and parser dependencies.

Creating this manifest/lockfile, adding exact esbuild/AWS SDK/network dependency versions, and changing CDK bundling are configuration changes requiring the approval gate in §2.4. A dependency is accepted only after licence, maintenance, vulnerability, browser/Node compatibility where applicable, bundle content, and lockless/locked resolution review.

WebVOWL's current repository licence and the planned `owlapi` package are AGPL-3.0-only at planning time. A network-deployed worker bundle that incorporates `owlapi` therefore must not reach a live environment until the project owner has completed an appropriate licence review and recorded the compliant corresponding-source mechanism for the exact deployed revision. At minimum, `THIRD_PARTY_NOTICES.md` identifies every bundled component and licence, `LICENSES/AGPL-3.0-only.txt` preserves the applicable licence text, and `CORRESPONDING_SOURCE.md` identifies the immutable WebVOWL/worker and `owlapi` source revisions, build inputs, scripts, and user-facing source-access location. Those files are evidence outputs, not a substitute for the review, and the review decides whether further material must be included in corresponding source. The public transparency surface links the source-access location for every live worker revision.

### 14.5 IAM policy boundaries

- API: point read/update/transaction on registry/control/quota keys and `SendMessage` to materialization queue; no S3 object write/read, catalog publication, CloudFront, WAF, or arbitrary DynamoDB table access.
- Worker: receive/delete/visibility on its queue through event integration; exact registry transition access; write/read-head on artifact/provenance prefixes; send catalog-dirty messages; no catalog-root write, distribution update, or source credential access.
- Catalog publisher: bounded registry scan/read; write/head/get only catalog prefixes; update only `CATALOG#CURRENT`; no upstream networking permission beyond ordinary Lambda egress, and code performs none.
- Revalidation scheduler: read due state and enqueue existing source keys; cannot fetch or publish.
- Report function/Athena workgroup: read selected log/report prefixes and a projection of registry metadata; write report/query-result prefixes; no artifact mutation.
- Bindings stack policies: CloudFront service principal constrained by exact distribution ARN and account; S3 read only; Lambda `InvokeFunctionUrl` and `InvokeFunction` only for the API function.

No role receives `s3:*`, `dynamodb:*`, `lambda:*`, `cloudfront:*`, or `*` resource scope except an action that demonstrably lacks resource-level authorization, with a precise cdk-nag acknowledgement.

### 14.6 Reliability configuration

- SQS absorbs origin/parser bursts and isolates the API latency from materialization duration.
- Standard-queue at-least-once delivery is safe because registry leases and content-addressed conditional writes are idempotent.
- Reserved concurrency prevents the worker from consuming account concurrency or spawning unbounded outbound requests.
- API throttling/quotas reject work before enqueue where possible.
- Catalog publication is serialized and deterministic; repeated dirty events converge on the same generation.
- S3 and DynamoDB durable state precede acknowledgement.
- All schedules have DLQ/retry policies appropriate to idempotent operations.
- No single origin failure removes last-known-good mappings.
- No deployment automatically invalidates all CloudFront content.

---

## 15. Observability, reporting, privacy, and transparency

### 15.1 Structured operational events

Lambda writes one-line JSON events with a fixed schema and bounded values:

```javascript
{
  schemaVersion: 1,
  eventName,
  eventTime,
  awsRequestId,
  sourceKey,
  materializationState,
  outcomeCode,
  attempt,
  durationMs,
  byteLength,
  artifactSha256,
  validationProfileId
}
```

Fields are included only when known. Events never include a raw source/effective/artifact IRI, request body, response body, parser excerpt, cookies, authorization, viewer address, user agent, referrer, full DNS answer list, or stack trace in the normal log line. Unexpected exception diagnostics go to a bounded error field after source/body/header redaction; the exception object remains visible only under the log-retention/access policy required for engineering diagnosis.

Do not use `sourceKey`, artifact digest, domain, or error message as a CloudWatch metric dimension. High-cardinality analysis belongs in Athena over logs/registry projections.

### 15.2 CloudFront standard logging v2

Enable standard logging v2 to the private `OntologyCacheObservabilityBucket`, using hourly Hive-compatible partitions:

```text
cloudfront/distribution_id={distributionid}/year={yyyy}/month={MM}/day={dd}/hour={HH}/
```

Select only fields necessary for cost, cache, status, and path attribution:

```text
date
time
timestamp(ms)
x-edge-location
sc-bytes
cs-method
cs(Host)
cs-uri-stem
cs-uri-query
sc-status
time-taken
x-edge-result-type
x-edge-response-result-type
x-edge-request-id
cache-behavior-path-pattern
```

Omit `c-ip`, cookies, `User-Agent`, referrer, protocol headers, TLS fingerprint-like data, and country unless a later documented operational need and privacy review justifies one. Disable cookie logging globally. Use text/JSON delivery initially; do not select Parquet conversion until measured Athena scan savings exceed its vended-log conversion charge and the exact configuration receives approval.

CloudFront standard logs are distribution-wide. Every cache report filters the exact path patterns; total rows still matter for WAF and CloudFront cost because those services see the whole distribution.

### 15.3 Retention

| Data | Retention | Reason |
| --- | ---: | --- |
| Lambda log groups | 30 days | Operational diagnosis without indefinite request-event retention. |
| Raw CloudFront standard logs | 90 days | Traffic/cost trend and incident window. |
| Athena query results | 30 days | Reproducibility long enough for report review; avoid accumulating duplicated extracts. |
| Daily aggregate reports | 400 days | Month-over-month and annual seasonality without raw viewer data. |
| Monthly aggregate reports | 25 months | Budget/project trend. |
| Artifact/source provenance | While the source/artifact remains retained, plus incident/legal policy | Transparency and validation traceability. |
| Quarantine/takedown audit | According to approved legal/security policy | Must not be erased by ordinary log lifecycle. |

Lifecycle rules are code/configuration and require the §2.4 approval. Retention changes require a privacy, operational, and cost rationale.

### 15.4 CloudWatch metrics and alarms

Prefer AWS-native metrics. The initial dashboard includes:

- CloudFront requests, bytes, 4xx/5xx, cache-hit rate, and origin latency;
- WAF allowed/count/block volume for the single rule;
- API and worker Lambda invocations, errors, throttles, duration, concurrency, and iterator age where applicable;
- SQS visible/in-flight messages, oldest-message age, and DLQ depth;
- DynamoDB consumed/request units, throttles, system errors, and table size;
- S3 bucket bytes/object count from daily storage metrics; and
- Athena query bytes scanned/report completion.

Initial alarms, kept within the account’s free standard-alarm allocation where available:

1. Materialization DLQ visible messages ≥ 1.
2. Oldest materialization queue message > 300 seconds for two periods.
3. Worker errors ≥ 3 in 15 minutes.
4. API errors ≥ 5 in 5 minutes, excluding deliberate 4xx contract responses.
5. DynamoDB or SQS throttles > 0 for two periods.
6. Catalog projection has not successfully completed within 15 minutes of a dirty event.
7. WAF count volume exceeds the rollout baseline threshold.
8. Feature budget reaches warning/forecast/limit thresholds.

Do not create dozens of per-function/per-status custom metrics when structured logs and native metrics answer the question. Every added custom metric/alarm must state its monthly price and operational action.

### 15.5 Athena reporting

Create a dedicated workgroup `ValidatedOntologyCacheReporting` with:

- enforced result location;
- per-query scanned-byte cutoff of 1 GiB;
- no engine-version auto-upgrade without evidence review;
- query-result reuse where supported and semantically safe;
- named SQL under source control; and
- no public query endpoint.

Daily reports answer:

- total distribution versus cache-path requests/bytes;
- artifact hit/miss/error and CloudFront result types;
- API submission, pending poll, ready redirect, rejection, and quota volumes;
- attributed artifact reads by `sourceKey` query token;
- unique new materializations and validation outcomes;
- artifact/source/catalog counts and stored bytes;
- queue/worker latency percentiles derived from structured event timestamps;
- stale/rejected/quarantined counts;
- validation profile/package-version distribution; and
- projected month-end cost by service/driver.

The `source` token is caller-controlled and public, so attribution reports call it “viewer-attributed source,” reconcile it with valid registry keys, and group invalid/spoofed values separately.

`OntologyUsageReportFunction` starts a parameterized Athena query and returns; it does not poll while billed. Athena state-change events invoke the same function in finalize mode to validate the query identity, fetch bounded aggregate rows, and write versioned JSON/CSV. Repeated events are idempotent by report date/query execution ID.

Athena EventBridge delivery is best effort, so each daily invocation first reconciles any incomplete report query IDs with `GetQueryExecution`. It finalizes a succeeded query or records its terminal failure before starting that date's next report. Reconciliation is a bounded state read, not an in-function polling loop, and a stale non-terminal query is surfaced for operator review rather than spawning duplicate queries indefinitely.

Reports are private by default. A future public transparency report may publish only aggregate service health/volume and per-source counts above an approved disclosure threshold. It must not expose viewer-level records or imply that a cached ontology is endorsed.

### 15.6 Public transparency surface

At launch, transparency consists of:

- stable OASIS catalog root;
- immutable catalog generations;
- public per-source provenance JSON;
- documented validation profile and limits;
- source-code/revision links for the worker and `owlapi`;
- cache/admissibility/takedown policy and contact;
- explicit statement that publication means parser acceptance, not consistency or endorsement; and
- documented refresh/last-known-good semantics.

Do not expose DynamoDB records, internal failure text, source denylist rationale that would weaken security, viewer traffic logs, or cost-control credentials.

---

## 16. Cost profile and USD 10 operating target

### 16.1 Pricing baseline and accounting boundary

Prices and free allocations change. Cache Phase 0 must reproduce the estimate in the official AWS Pricing Calculator for the actual account, payer, regions, existing free-tier consumption, and preceding 90 days of distribution traffic before any resource is created.

The 25 August 2026 planning baseline uses these public rates/allocations:

| Service/driver | Planning baseline | Important boundary |
| --- | --- | --- |
| CloudFront pay-as-you-go always-free | First 1 TB data transfer out, 10,000,000 HTTP(S) requests, and 2,000,000 CloudFront Function invocations each month | Account-wide, not a new allowance for this cache. Existing distribution traffic consumes it. |
| CloudFront beyond allowance, US/Europe planning rate | About USD 0.0100 per 10,000 HTTPS requests and USD 0.085 per GB for the first paid data tier | HTTP’s planning request rate is lower, but the service requires/redirects to HTTPS. Verify geography/method tiers; the plan does not assume all viewers are in one region. |
| AWS WAF | USD 5 per WebACL-month + USD 1 per custom rule-month + USD 0.60 per million requests | Request charge applies to the distribution’s requests, not only the rate rule’s scoped path. Managed groups and advanced body inspection add cost and are not selected. |
| Lambda | 1,000,000 requests and 400,000 GB-seconds monthly free; then request/duration rates | Aggregated across the account; the 2 GiB worker can consume duration allocation faster than small functions. |
| SQS Standard | First 1,000,000 requests monthly free | A job normally uses multiple SQS operations; account-wide use matters. |
| DynamoDB | On-demand request/storage pricing; 25 GiB Standard storage free and provisioned-capacity free tier exists | This design chooses on-demand for unpredictable low volume; do not incorrectly subtract provisioned RCUs/WCUs from an on-demand bill. |
| S3 Standard | Approximately USD 0.023 per GB-month plus PUT/GET/list request charges in the selected region | CloudFront origin transfer is generally not charged, but storage/log delivery/request dimensions remain. Verify eu-west-1 rates. |
| CloudWatch | 5 GB logs and a limited set of custom metrics/dashboards/alarms in the monthly free tier | Account-wide; standard-log v2 delivery can have vended-log charges even though CloudFront does not charge merely for enabling logging. |
| Athena | USD 5 per TB scanned, 10 MB minimum per query | Partition pruning and selected fields keep daily aggregate queries tiny. |

Always report incremental cache cost and total affected-distribution cost separately. WAF is an incremental cache/security decision but inspects the entire shared distribution, so attributing only cache-path request fees would materially understate it.

### 16.2 Cost formula

Use this explicit monthly model, with rates replaced by the current calculator output:

```text
incremental total =
  WAF WebACL fixed charge
  + WAF custom-rule fixed charge
  + WAF request charge for all shared-distribution requests
  + CloudFront requests above remaining account allowance
  + CloudFront egress above remaining account allowance
  + S3 artifact/provenance/catalog/log storage and requests
  + Lambda requests and GB-seconds above remaining account allowance
  + SQS requests above remaining account allowance
  + DynamoDB reads/writes/storage/backups
  + CloudFront standard-log delivery/storage
  + CloudWatch logs/metrics/alarms/API usage
  + Athena bytes scanned/results
  + SNS notification and cost-control API usage
```

Do not treat a forecast as a hard real-time circuit breaker: AWS billing/usage data is delayed, WAF fixed cost is already incurred while enabled, and CloudFront traffic continues even if materialization stops.

### 16.3 Scenario estimates

The following are directional planning ranges, not quotes. They assume the account still has its CloudFront/Lambda/SQS/CloudWatch free allocations, average stored ontology size near 1 MiB, one WAF rule, no managed rule group, selected-field compressed logs, and low report scan volume.

| Scenario | Shared distribution requests / transfer | New materializations / retained data | WAF estimate | Other cache services | Expected incremental total |
| --- | --- | --- | ---: | ---: | ---: |
| Quiet launch | 1 million / <100 GB | 1,000 / ~1 GB | ~USD 6.60 | ~USD 0.10–0.50 | ~USD 6.70–7.10 |
| Healthy growth | 3 million / <300 GB | 10,000 / ~10 GB | ~USD 7.80 | ~USD 0.30–1.00 | ~USD 8.10–8.80 |
| Budget edge | 5 million / <500 GB | 25,000 / ~25 GB | ~USD 9.00 | ~USD 0.60–1.50 | ~USD 9.60–10.50 |
| Free-request exhaustion | 11 million / <1 TB | 25,000 / ~25 GB | ~USD 12.60 | at least ~USD 1.00 paid CloudFront HTTPS requests plus other services | >USD 13.60 |

Adding a second custom WAF rule adds approximately USD 1/month before request-related changes. At the stated budget, do not add a managed ruleset, Bot Control, CAPTCHA/Challenge, full WAF logging, or additional custom rules at launch without a revised approved estimate.

The WAF fixed/request cost is likely to dominate while traffic is within CloudFront’s always-free allocation. S3, SQS, DynamoDB, Athena, and Lambda are expected to remain cents-scale at early volumes, but that expectation must be validated against account-wide free-tier consumption and actual worker duration.

### 16.4 Cost containment design

Use layered limits rather than a single destructive switch:

1. **Admission:** 500 new source keys per UTC day; idempotent hits do not count.
2. **Edge abuse:** one WAF rule at 300 submissions per source IP per five minutes.
3. **Compute:** worker reserved/event-source concurrency two, one SQS message per invocation, 60-second timeout, three-attempt ceiling.
4. **Storage:** 32 MiB artifact ceiling, deterministic deduplication, catalog entry/byte ceiling, orphan/integrity report.
5. **Query/logging:** 1 GiB Athena cutoff, bounded selected log fields, finite retention, no real-time logs.
6. **Budget warnings:** notify at USD 7 actual, USD 9 forecast, and USD 10 actual incremental monthly cost, using current AWS Budgets/Cost Explorer capabilities selected at approval time.
7. **Feature kill:** the limit action sets `CONTROL#SERVICE.materializationEnabled = false`. New unknown sources receive 403; READY artifacts/catalogs and the rest of the distribution remain available.
8. **Operator review:** identify WAF versus traffic versus storage/compute driver, then explicitly re-enable, retune, or keep disabled. Never reset a counter or budget automatically merely because a Lambda retried.

The cache cost envelope comprises dedicated, tagged resource charges, the full incremental WAF charges, and the measured CloudFront/logging variance from the recorded shared-distribution baseline. Resource tags and AWS Budgets cannot allocate shared CloudFront charges by path, so reports must not present a tag-only number as the cache's exact cost. Attribute path-level requests and bytes from selected CloudFront logs, apply the current rate tiers conservatively, and retain both the modelled cache attribution and the authoritative whole-distribution bill.

### 16.5 Migration of the current whole-distribution cost cutoff

The current `DisableCloudFrontOnCostLimit` path evaluates a configured CloudFront ceiling every minute and can disable the entire distribution. Before WAF/cache production enablement:

- record its exact present behaviour, cost, alarms, and failure modes;
- ensure its threshold does not interpret the WAF’s expected fixed cost as an emergency requiring website shutdown;
- separate site-wide emergency policy from the validated-cache feature budget;
- replace cache-triggered distribution disablement with the materialization kill switch;
- reduce cost-check cadence/API usage to the minimum supported by billing-data freshness;
- keep any genuine whole-site emergency action disabled or alert-only unless separately approved with a documented recovery path; and
- test that a simulated cache budget breach leaves website, seed catalog, catalog root, and READY artifact GETs healthy.

Because this changes an existing safety control, it is a distinct configuration/deployment approval checkpoint and cannot be smuggled into the cache stack diff.

---

## 17. WebVOWL integration architecture

### 17.1 Application-owned deep module

Create one cohesive module rooted at:

```text
src/ontology-loading/
  webVowlOntologyDocumentLoader.js
  webVowlOntologyDocumentLoader.test.js
  oasisXmlOntologyCatalog.js
  oasisXmlOntologyCatalog.test.js
  boundedOntologyResponse.js
  boundedOntologyResponse.test.js
  ontologyMaterializationClient.js
  ontologyMaterializationClient.test.js
  ontologyLoadingConfiguration.js
```

The only production interface supplied to `owlapi` is the object returned by:

```javascript
createWebVowlOntologyDocumentLoader({
  catalogIri,
  materializationCollectionIri,
  fetchImpl,
  cryptoImpl,
  resolutionObserver,
})
```

It exposes:

```javascript
{
  async load(documentIRI, { config, signal } = {}) {
    // returns public owlapi StringDocumentSource
  }
}
```

`resolutionObserver` is an application composition hook, not part of `owlapi`. It receives bounded state events for user-visible progress without receiving response bodies or AWS state. The factory defaults to standard platform implementations; tests inject deterministic ones.

### 17.2 Loader precedence and error boundary

The implementation order is exact:

```text
in-memory mapping
  → fetched OASIS catalog exact mapping
  → direct browser retrieval / HTTPS-upgraded candidate
  → materialization submission/status/immutable artifact
  → typed failure
```

Only browser network/CORS/mixed-content inability crosses from direct retrieval to materialization. An `owlapi` parser failure occurs after the loader returns the document and therefore never triggers a second retrieval path. This preserves the package rule that only genuine `ParserMismatchError` allows syntax fallback; network fallback must not hide recognized syntax/resource/security errors.

### 17.3 Top-level document and imports use one loader

Refactor the post-Phase-20 composition so:

- `loadingModule.from_IRI_URL` asks the document loader for the top-level `StringDocumentSource` rather than calling `fetch` directly;
- the same loader instance is passed into `OWLManager.createOWLOntologyManager` for imports;
- the root source’s original document IRI and file-name/content-type hints flow into the manager unchanged;
- VOWL-JSON URL loading remains a separate JSON concern and never enters the ontology materialization service;
- file upload/direct text remains local, but imports discovered inside it may use the shared loader when `remoteImports: true`; and
- cancellation from a new load/unload action aborts direct fetch, API poll, artifact fetch, and package import traversal through one signal.

The application must not fetch the top-level document into a string and then create a second loader for imports. One resolution session should coalesce catalog state and exact-source operations.

### 17.4 `owlapi` construction

After Phase 20, the composition is conceptually:

```javascript
import {
  OWLManager,
  OWLOntologyLoaderConfiguration,
} from "owlapi";

import { createWebVowlOntologyDocumentLoader } from
  "../../ontology-loading/webVowlOntologyDocumentLoader.js";

const documentLoader = createWebVowlOntologyDocumentLoader({
  catalogIri: "https://haddenindustries.com/ontology/catalog-v001.xml",
  materializationCollectionIri:
    "https://haddenindustries.com/ontology/materializations",
});

const manager = OWLManager.createOWLOntologyManager({ documentLoader });

const configuration = OWLOntologyLoaderConfiguration.defaults()
  .withParsingMode("compatible")
  .withMissingImportHandling("diagnostic")
  .withRemoteImports(true)
  .withRemoteJsonLdContexts(false);
```

The exact import locations and copying method names come from the accepted public API. A public-registry consumer test owns this example. Do not make the loader an `OWLOntologyIRIMapper`: it must receive the original requested document IRI, consult the catalog internally, retrieve a different artifact IRI, and return a source whose `documentIRI` remains original. Mapping at the manager level would otherwise risk making the content-addressed artifact IRI the base for relative IRIs.

### 17.5 Progress and user-visible diagnostics

The loader emits these internal event names:

```text
CATALOG_LOOKUP_STARTED
CATALOG_HIT
DIRECT_RETRIEVAL_STARTED
DIRECT_RETRIEVAL_UNAVAILABLE
MATERIALIZATION_SUBMITTED
MATERIALIZATION_PENDING
MATERIALIZED_ARTIFACT_RETRIEVAL_STARTED
ONTOLOGY_DOCUMENT_RETRIEVED
ONTOLOGY_DOCUMENT_RETRIEVAL_FAILED
```

The loading UI maps them to concise accessible status text. It does not show an indeterminate spinner with no explanation for an entire materialization wait, and it does not claim the source is invalid before server validation completes. Status updates use the existing live loading region and respect reduced motion; this phase adds no decorative animation.

### 17.6 Catalog acquisition performance

- Start one low-priority catalog prefetch after WebVOWL becomes interactive when network state permits.
- If a user requests an ontology first, promote by awaiting/coalescing the same request; do not start a duplicate.
- Rely on browser HTTP cache/ETag plus CloudFront’s five-minute root policy.
- Parse once into a frozen `Map` for the resolution session.
- Do not block first contentful paint or graph interactions on catalog availability.
- Measure fetch + XML parse. If a main-thread task exceeds 250 ms or p95 exceeds the 100 ms module budget, move only catalog parsing to the application’s accepted dedicated-worker seam or initiate the separately approved generated-index design. Do not add a scheduler polyfill merely for this work.

### 17.7 Runtime configuration

`ontologyLoadingConfiguration.js` owns stable public endpoint IRIs and application limits. It does not contain source mappings. It exports immutable, semantically named values such as:

```text
ONTOLOGY_CATALOG_IRI
ONTOLOGY_MATERIALIZATION_COLLECTION_IRI
MAX_ONTOLOGY_REPRESENTATION_BYTES
MATERIALIZATION_WAIT_TIMEOUT_MS
MAX_CONCURRENT_MATERIALIZATION_SUBMISSIONS
```

Endpoint configuration must support the production hostname and a test-injected origin without reading arbitrary query-string overrides. Third-party builds can supply their own loader configuration at composition time.

---

## 18. Cross-repository file map

Paths below are prospective owners to validate against the post-Phase-20 tree. If Phase 20 legitimately relocates an owner, Cache Phase 0 records the new exact path while preserving these module names/responsibilities. It must not recreate the retired tree merely to match this list.

### 18.1 WebVOWL repository

**Create:**

```text
src/ontology-loading/webVowlOntologyDocumentLoader.js
src/ontology-loading/webVowlOntologyDocumentLoader.test.js
src/ontology-loading/oasisXmlOntologyCatalog.js
src/ontology-loading/oasisXmlOntologyCatalog.test.js
src/ontology-loading/boundedOntologyResponse.js
src/ontology-loading/boundedOntologyResponse.test.js
src/ontology-loading/ontologyMaterializationClient.js
src/ontology-loading/ontologyMaterializationClient.test.js
src/ontology-loading/ontologyLoadingConfiguration.js
src/ontology-loading/ontologyLoading.integration.test.js
src/ontology-loading/fixtures/catalog-root.xml
src/ontology-loading/fixtures/catalog-seed.xml
src/ontology-loading/fixtures/catalog-dynamic.xml
docs/ontology-cache/execution-baseline.md
docs/ontology-cache/operator-behaviour.md
```

**Modify after Phase 20:**

```text
src/owl2vowl/js/index.js
src/owl2vowl/js/index.test.js
src/owl2vowl/js/constants.js
src/owl2vowl/js/constants.test.js
src/app/js/loadingModule.js
src/app/js/loadingModule.test.js
src/app/js/ontologyLifecycle.js
src/app/js/ontologyLifecycle.test.js
src/main.js or the post-Phase-20 application composition root
src/productionGraph.architecture.test.js
src/testRunnerScope.architecture.test.js
```

**Delete only after parity gates:**

```text
src/owl2vowl/js/importResolver.js
src/owl2vowl/js/importResolver.test.js
```

`src/owlapi-js/**` is not listed: Phase 20 owns its extraction/removal. This plan never modifies it.

### 18.2 `amazon-aws` repository

**Create:**

```text
infrastructure/validated_ontology_cache/__init__.py
infrastructure/validated_ontology_cache/regional_data_stack.py
infrastructure/validated_ontology_cache/regional_access_bindings_stack.py
infrastructure/validated_ontology_cache/global_delivery_construct.py
infrastructure/validated_ontology_cache/monitoring_construct.py
tests/infrastructure/test_validated_ontology_cache_stacks.py
Lambda/Applications/ValidatedOntologyCache/package.json
Lambda/Applications/ValidatedOntologyCache/package-lock.json
Lambda/Applications/ValidatedOntologyCache/THIRD_PARTY_NOTICES.md
Lambda/Applications/ValidatedOntologyCache/CORRESPONDING_SOURCE.md
Lambda/Applications/ValidatedOntologyCache/LICENSES/AGPL-3.0-only.txt
Lambda/Applications/ValidatedOntologyCache/src/api/ontologyMaterializationApi.js
Lambda/Applications/ValidatedOntologyCache/src/materialization/canonicalizeSourceDocumentIri.js
Lambda/Applications/ValidatedOntologyCache/src/materialization/ontologyMaterializationRegistry.js
Lambda/Applications/ValidatedOntologyCache/src/materialization/safeOntologyRepresentationRetriever.js
Lambda/Applications/ValidatedOntologyCache/src/materialization/validateOntologyDocument.js
Lambda/Applications/ValidatedOntologyCache/src/materialization/ontologyArtifactRepository.js
Lambda/Applications/ValidatedOntologyCache/src/materialization/ontologyMaterializationWorker.js
Lambda/Applications/ValidatedOntologyCache/src/catalog/oasisXmlCatalogProjection.js
Lambda/Applications/ValidatedOntologyCache/src/catalog/publishOntologyCatalogProjection.js
Lambda/Applications/ValidatedOntologyCache/src/revalidation/scheduleOntologyRevalidations.js
Lambda/Applications/ValidatedOntologyCache/src/reporting/ontologyCacheUsageReport.js
Lambda/Applications/ValidatedOntologyCache/src/observability/writeStructuredOperationalEvent.js
Lambda/Applications/ValidatedOntologyCache/test/**
validated-ontology-cache/contracts/ontology-materialization-request.v1.schema.json
validated-ontology-cache/contracts/ontology-materialization-error.v1.schema.json
validated-ontology-cache/contracts/ontology-artifact-provenance.v1.schema.json
validated-ontology-cache/contracts/ontology-seed-manifest.v1.schema.json
validated-ontology-cache/contracts/ontology-usage-report.v1.schema.json
validated-ontology-cache/seeds/ontology-seed-manifest.v1.json
validated-ontology-cache/reporting/cloudfront-cache-usage.sql
validated-ontology-cache/reporting/materialization-outcomes.sql
scripts/stage_validated_ontology_seed_catalog.mjs
docs/validated-ontology-cache/execution-baseline.md
docs/validated-ontology-cache/operations-runbook.md
docs/validated-ontology-cache/cache-and-takedown-policy.md
```

**Modify with exact configuration approval:**

```text
app.py
infrastructure/stack.py
cdk.json
package.json
package-lock.json
```

`requirements.txt` changes only if the accepted CDK/assertion implementation demonstrably requires a new Python dependency; ordinary CDK modules and `unittest` should avoid that expansion.

**Reconcile, not automatically delete:**

```text
Lambda/Functions/DisableCloudFrontOnCostLimit.js
```

### 18.3 Canonical `owlapi` repository

No `owlapi` source change is expected. Cache Phase 0 records:

- exact installed coordinate and tarball integrity;
- accepted public loader/source/config/error methods used by browser and worker;
- installed-package Node/browser fixtures proving source-document-IRI preservation; and
- the validation-profile configuration.

If that proof fails, open a separately scoped capability in the canonical package repository, update its Public API Surface Registry/capability evidence, publish it under the then-current zero-major release policy, and make both consumers accept the registry artefact. This cache plan does not prescribe a speculative package version and never edits a copy inside WebVOWL.

---

## 19. Test strategy and fixtures

### 19.1 Methodology

Use the predecessor plan’s test classification:

| Change | Required sequence |
| --- | --- |
| Protect current mapping/fetch behaviour before refactor | Characterization tests, then explicit required-behaviour tests. |
| Pure file/module relocation with identical behaviour | GREEN → GREEN. |
| New materialization/catalog/security/caching behaviour | RED → GREEN → REFACTOR. |
| Defect discovered during implementation | Minimal failing regression before production change. |
| Configuration/infrastructure addition | Failing CDK assertion/synthesis policy test before construct change, then `cdk diff` review. |

Tests compare structural ontology/VOWL results, state transitions, HTTP contracts, catalog mappings, byte digests, and RDF/OWL semantics—not incidental serialized ontology text.

### 19.2 Shared contract fixture corpus

Create checked-in, licence-reviewed, small fixtures for:

- all accepted source-IRI canonicalization cases, including IDN, percent encoding, query, fragment, default port, HTTP/HTTPS distinction;
- rejected schemes, credentials, explicit alternate ports, IP literals, malformed URLs, overlong values;
- public DNS with mixed public/private answers;
- IPv4, IPv6, IPv4-mapped IPv6 special ranges;
- safe/unsafe redirect chains and loops;
- readable CORS success/error, Fetch rejection, abort, timeout, length header overflow, streamed overflow;
- valid RDF/XML, Turtle, JSON-LD with local context, OWL/XML, Functional, Manchester, N-Triples, N-Quads, TriG, DL, KRSS1, and KRSS2 documents supported by the accepted package;
- invalid syntax, parser mismatch exhaustion, resource failure, remote JSON-LD context, external entity attempt, and import declarations with remote imports disabled;
- same bytes from two curated source IRIs;
- source content changing valid→valid, valid→invalid, 304, timeout, and 404;
- OASIS `uri`, `nextCatalog`, `xml:base`, ordering, cycles, malformed XML, DTD, duplicate conflict, entry/byte/depth limits;
- SQS duplicate delivery, expired lease, worker crash after S3 write/before registry promotion, catalog publisher CAS conflict;
- seed versus dynamic collision; and
- WAF/API/daily quota boundary values.

Large/adversarial fixtures are generated deterministically at test time where storing them would bloat the repository, but generation code itself is reviewed and bounded.

### 19.3 Browser verification

Unit tests mock Fetch semantics, but completion additionally requires real current supported browsers because CORS, redirect, preflight, body hashing, HTTP cache, abort, and opaque-response behaviour are browser-owned.

Use the accepted WebVOWL development server and browser tooling to verify:

- Chromium, Firefox, and WebKit-equivalent behaviour available under the project’s post-Phase-20 supported matrix;
- cross-origin WebVOWL host against the production-like CloudFront endpoint;
- preflight and `x-amz-content-sha256` POST;
- wildcard CORS with `credentials: "omit"` and rejection with credentials included;
- automatic 303 follow to artifact;
- catalog root/generation caching and revalidation;
- source query excluded from artifact cache key;
- cancellation while direct fetching, pending, and artifact fetching;
- CSP `connect-src` documentation; and
- no main-thread catalog task over the agreed budget.

If WebVOWL lacks an already approved automated multi-browser harness after Phase 20, record reproducible DevTools network/console/performance evidence rather than adding an unapproved dependency. Automation can be proposed through the configuration gate.

### 19.4 AWS/local integration harness

The Lambda tests use Node’s built-in `node:test`, local HTTP servers bound only to loopback for client simulation, deterministic DNS/HTTP adapters, and AWS SDK client fakes at explicit seams. Tests must not weaken production SSRF code merely so a loopback fixture can be reached; the production retriever is tested with an injected connector that records the validated address.

CDK tests use `aws_cdk.assertions` and Python `unittest` from the repository `.venv`. They assert synthesized resources/policies and never contact AWS.

Live AWS canary tests occur only after explicit deployment approval. They use controlled public fixture hosts representing:

- readable CORS source;
- valid source without CORS;
- safe redirect;
- invalid ontology;
- oversized/slow bounded response; and
- a forbidden DNS/address target that must fail before connection.

No canary requests third-party ontology hosts without consent or an operational need.

---

## 20. Detailed implementation sequence

Each cache phase has one completion gate. Do not overlap production implementation across phases merely because files live in different repositories: package version, validation profile, schemas, infrastructure, seed evidence, and client behaviour form one compatibility chain.

Every “commit checkpoint” below is a suggested atomic boundary. Execute it only after the user authorizes a commit; execute a push only after separate authorization.

### Cache Phase 0 — establish the post-Phase-20 execution baseline

#### Task 0.1 — prove the predecessor gate

**Files**

- Create `docs/ontology-cache/execution-baseline.md` in WebVOWL.
- Create `docs/validated-ontology-cache/execution-baseline.md` in `amazon-aws` only after that repository’s documentation write is approved.

**Evidence interface**

Record a machine-checkable/human-readable table containing:

```text
phase20CompletionRecord
owlapiVersion
owlapiTarballIntegrity
owlapiSourceTag
owlapiSourceCommit
webvowlCommit
webvowlLockfileIntegrity
acceptedNodeVersions
acceptedBrowserMatrix
publicDocumentLoaderContract
publicStringDocumentSourceContract
publicLoaderConfigurationContract
publicErrorCodesUsed
```

**Steps**

1. Add a failing boundary assertion that detects any `src/owlapi-js`, local, alias, workspace, Git, or deep `owlapi` import in production WebVOWL.
2. Run that focused boundary test and confirm it fails only if the post-Phase-20 tree violates the prerequisite.
3. Inspect the installed package’s five public entry points and the accepted Phase 20 API evidence; record the exact symbols this plan will use.
4. Add an installed-package contract test that constructs a manager with an injected document loader, returns a `StringDocumentSource` whose document IRI differs from its retrieval location, and proves relative IRIs resolve against the source document IRI.
5. Run the focused test, full Jest suite, development build, production build, and representative import-aware corpus.
6. Record commands, versions, fixture digests, and results in the baseline; do not paste mutable registry HTML or depend on an expiring CI log.

**Verification commands**

```powershell
npm test -- --runInBand src/productionGraph.architecture.test.js
npm test -- --runInBand
npm run build:dev
npm run build
```

**Completion gate**

The exact accepted package is a real third-party-style dependency; the source/retrieval IRI test passes through public exports; all current gates are green. Otherwise this cache programme is blocked at the package seam.

**Suggested commit checkpoint:** `docs: record validated ontology cache execution baseline`

#### Task 0.2 — measure account and distribution baseline

**Files**

- Update the two execution-baseline documents only; no AWS resource change.

**Steps**

1. Read the preceding 90 complete days of CloudFront requests, bytes, geography, cache hit rate, existing CloudFront Function invocation count, Lambda/SQS/CloudWatch/DynamoDB free-tier consumption, and current monthly spend.
2. Record the current distribution ID, behaviours, origins, OACs, WAF association, logging state, custom errors, certificate, aliases, and stack logical IDs without exposing account secrets in the repository.
3. Inspect the current whole-distribution cost cutoff: cadence, metric/API source, threshold, SNS action, Lambda cost, and exact disable/recovery behaviour.
4. Recreate quiet/growth/budget-edge scenarios in the official AWS Pricing Calculator using `eu-west-1` regional and global CloudFront/WAF prices.
5. Record assumptions and exported calculator evidence. Mark WAF charges against total distribution requests.
6. Confirm quiet and observed-baseline scenarios remain below USD 10. If not, stop for architecture review before resource creation.

**Completion gate**

There is a reproducible cost baseline, enough remaining account-wide allowance is known, and the shared-distribution decision is economically valid for observed traffic.

**Suggested commit checkpoint:** `docs: baseline ontology cache traffic and cost`

#### Task 0.3 — obtain exact configuration approvals

**Files/settings requiring presentation before change**

- `amazon-aws/Lambda/Applications/ValidatedOntologyCache/package.json` and `package-lock.json`: private ESM package, exact `owlapi`, AWS SDK, HTTP/DNS/IP-classification, and esbuild/test dependencies/scripts.
- `amazon-aws/Lambda/Applications/ValidatedOntologyCache/THIRD_PARTY_NOTICES.md`, `CORRESPONDING_SOURCE.md`, and `LICENSES/AGPL-3.0-only.txt`: reviewed notices, immutable deployed-source/build mapping, and applicable licence text; deployment remains blocked until the AGPL/network-use review approves the complete source-access mechanism.
- `amazon-aws/package.json` and `package-lock.json`: only the exact root bundling/test command additions demonstrably required.
- `amazon-aws/cdk.json`: one namespaced `validated-ontology-cache` context object containing enabled state, quotas, worker concurrency, WAF threshold/action, report retention, budget thresholds, and stable public paths.
- `amazon-aws/app.py`: acyclic stack instantiation order and cross-region references.
- `amazon-aws/infrastructure/stack.py`: exact integration point into the existing distribution and removal/replacement of obsolete cdk-nag suppressions.
- New CDK/Lambda/configuration/schema/seed files listed in §18.2.
- Any WebVOWL `package.json`, lockfile, CSP, hosting, test, or browser-harness change; the preferred client design adds no runtime dependency beyond the already accepted `owlapi` package.

**Steps**

1. Present exact versions, licences, bundle sizes, transitive production graph, corresponding-source scope/access mechanism, scripts, CDK context values, CloudFormation resources, monthly estimate, and rollback impact.
2. Separate application source/schema/data approval from live AWS deployment approval.
3. Separate WAF association/action, logging, budget alert, email subscription, seed upload, and production enablement approvals.
4. Record accepted settings in the execution baselines.

**Completion gate**

Every configuration file and external-state mutation has an exact approval. If an item is rejected, revise the design before implementation rather than changing it indirectly.

No commit checkpoint exists for an approval conversation alone.

### Cache Phase 1 — freeze shared contracts and seed evidence

#### Task 1.1 — define schemas and canonicalization fixtures

**Files**

- Create the five JSON Schemas under `validated-ontology-cache/contracts/`.
- Create `Lambda/Applications/ValidatedOntologyCache/src/materialization/canonicalizeSourceDocumentIri.js`.
- Create focused Node tests/fixtures.
- Create the equivalent WebVOWL fixture test under `src/ontology-loading/` without production client code yet.

**Interfaces**

```javascript
canonicalizeSourceDocumentIri(value)
validateMaterializationRequest(value)
validateArtifactProvenance(value)
```

**Steps**

1. Write shared JSON fixtures for every §4.1 accepted/rejected case and expected `sourceDocumentIri`, `retrievalIriWithoutFragment`, and `sourceKey`.
2. Add failing Node tests for canonicalization, exact JSON members, byte limits, Unicode, and stable error codes.
3. Run the focused tests and confirm the missing implementation is the failure.
4. Implement canonicalization and schema validation with no network or AWS dependency.
5. Run Node tests to green and refactor only while fixtures remain unchanged.
6. Add a WebVOWL-side fixture consumer test using browser URL/Web Crypto-compatible primitives; confirm identical output.
7. Run focused WebVOWL tests to green.
8. Validate every example payload/provenance document in this plan against the schemas after substituting real fixture digests.

**Verification commands**

```powershell
node --test Lambda/Applications/ValidatedOntologyCache/test/canonicalizeSourceDocumentIri.test.js
npm test -- --runInBand src/ontology-loading/sourceDocumentIriContract.test.js
```

**Completion gate**

Node and browser implementations agree for the complete fixture corpus; schemas reject unknown members and unbounded strings; no source IRI is logged on failure.

**Suggested commit checkpoint:** `test: define ontology materialization contracts`

#### Task 1.2 — freeze the curated seed manifest

**Files**

- Create `validated-ontology-cache/seeds/ontology-seed-manifest.v1.json`.
- Create `scripts/stage_validated_ontology_seed_catalog.mjs` initially in read-only/dry-run mode.
- Add seed-manifest tests.

**Interfaces**

```javascript
readOntologySeedManifest(path)
inventoryOntologySeedSources({ manifest, currentCatalog, s3Inventory })
```

**Steps**

1. Export the last accepted `ONTOLOGY_CATALOG` into normalized source/retrieval pairs without editing the constant.
2. Acquire an S3 inventory/list of the existing `/ontology/external/` prefix through a read-only approved AWS call.
3. Add a failing test that reports missing references, duplicate source names, invalid IRIs, unreferenced objects, and seed/dynamic-ownership ambiguity.
4. Implement the dry-run inventory and generate the human-review table.
5. Classify every finding explicitly. Do not make unreferenced objects public by default.
6. Add expected source keys and curated alias relationships. Artifact digests remain absent until Phase 9’s validation/staging operation; the schema distinguishes `DISCOVERED` dry-run evidence from `STAGED` publication evidence without an informal null/sentinel.
7. Prove two runs over identical input produce identical manifest bytes/order.

**Completion gate**

Every current catalog key and referenced seed representation has one disposition; no dynamic mapping mechanism depends on future JavaScript source edits.

**Suggested commit checkpoint:** `data: inventory curated ontology cache seeds`

### Cache Phase 2 — implement the safe retrieval and validation core

#### Task 2.1 — implement SSRF-safe representation retrieval

**Files**

- Create `safeOntologyRepresentationRetriever.js` and focused tests/fixtures.
- Create any narrowly owned IP-range data module under `materialization/`; do not create a generic utility directory.

**Interface**

```javascript
createSafeOntologyRepresentationRetriever({
  dnsResolver,
  httpDispatcherFactory,
  clock,
  policy,
}).retrieve({
  sourceDocumentIri,
  conditionalHeaders,
  signal,
})
```

Return an immutable result discriminated as `NOT_MODIFIED` or `REPRESENTATION`; representation includes exact bytes, effective upstream IRI, bounded headers, and timing evidence.

**Steps**

1. Add failing tests for every prohibited scheme/address/port/credential form, mixed DNS answer, DNS rebinding connector, redirect hop, downgrade, timeout, status, content-coding, byte limit, abort, cookie/private/no-store/Vary rejection, and safe success.
2. Confirm tests fail because the retriever does not exist, not because fixtures accidentally contact the network.
3. Implement URL admission and generated special-range classification.
4. Implement request-scoped validated DNS lookup wired into the actual connection dispatcher.
5. Implement manual redirects and budgets.
6. Implement streaming size enforcement and bounded header normalization.
7. Run the entire adversarial set and verify forbidden cases record zero connection attempts.
8. Add property/fuzz cases for URL normalization and IP textual forms, bounded by a fixed seed/run count.
9. Run dependency audit/licence review and inspect the production bundle for unexpected networking code.

**Verification command**

```powershell
node --test Lambda/Applications/ValidatedOntologyCache/test/safeOntologyRepresentationRetriever.test.js
```

**Completion gate**

No unsafe target connects, every redirect is revalidated, every resource is bounded, and successful requests expose no caller credentials/data.

**Suggested commit checkpoint:** `feat: add bounded ontology representation retrieval`

#### Task 2.2 — implement public-`owlapi` document validation

**Files**

- Create `validateOntologyDocument.js` and focused tests.
- Add cross-runtime fixtures and package-parity test.

**Interface**

```javascript
validateOntologyDocument({
  representationBytes,
  sourceDocumentIri,
  contentType,
  fileName,
  signal,
})
```

Return immutable accepted metadata or throw a normalized typed error. It never fetches.

**Steps**

1. Write failing tests for every supported representative syntax, invalid syntax, remote import declaration, remote JSON-LD context, XML external entity, byte/resource limit, compatible diagnostic, abort, and unexpected invariant error.
2. Add a no-network trap and confirm every validation test makes zero outbound request.
3. Import only accepted public `owlapi` specifiers and implement the exact profile in §11.2.
4. Hash/record the resolved profile and package version.
5. Parse with a fresh manager and extract only public metadata.
6. Normalize public `owlapi` errors to service codes without message matching.
7. Run focused Node tests and the same semantic fixtures through WebVOWL’s installed package.
8. Compare ontology IDs/import counts/acceptance and stable error codes; never compare incidental serializer text.
9. Inspect the worker bundle to prove a single exact `owlapi` coordinate and no private path.

**Verification commands**

```powershell
node --test Lambda/Applications/ValidatedOntologyCache/test/validateOntologyDocument.test.js
npm test -- --runInBand src/ontology-loading/owlapiValidationParity.test.js
```

**Completion gate**

Browser and worker agree on accepted/rejected fixtures, validation performs no network, and source document IRI is parser context.

**Suggested commit checkpoint:** `feat: validate cache artifacts with public owlapi`

### Cache Phase 3 — implement durable state, artifact storage, and worker orchestration

#### Task 3.1 — implement registry transitions

**Files**

- Create `ontologyMaterializationRegistry.js` and state-machine tests.

**Interface**

```javascript
createOntologyMaterializationRegistry({ dynamoDocumentClient, tableName, clock })
```

Methods are named for transitions, not raw database verbs:

```text
submitSourceMaterialization
readMaterialization
acquireMaterializationLease
renewMaterializationLease
recordMaterializationRejection
promoteValidatedArtifact
beginSourceRevalidation
recordNotModified
recordStaleSource
quarantineSource
listCatalogEligibleSources
listDueRevalidations
reconcileExpiredLeases
```

**Steps**

1. Write failing tests for every state transition/invariant, idempotent duplicate, quota transaction, seed collision, lease race/expiry, last-known-good failure, quarantine, retry window, and conditional conflict.
2. Implement exact DynamoDB expressions with expected-state/revision conditions.
3. Ensure source strings are parameters/data, never interpolated into expressions or logs.
4. Return domain results; keep DynamoDB attribute maps internal.
5. Test transaction cancellation reasons and normalize them without exposing AWS internals to the API.
6. Run a concurrency test with multiple identical submissions/workers and prove one admission/active promotion.

**Verification command**

```powershell
node --test Lambda/Applications/ValidatedOntologyCache/test/ontologyMaterializationRegistry.test.js
```

**Completion gate**

The executable state machine matches §9, retries are safe, and no public handler issues ad hoc table updates.

**Suggested commit checkpoint:** `feat: add ontology materialization registry`

#### Task 3.2 — implement content-addressed artifact repository

**Files**

- Create `ontologyArtifactRepository.js` and tests.

**Interface**

```javascript
createOntologyArtifactRepository({ s3Client, bucketName, publicBaseIri })
```

Methods:

```text
storeValidatedArtifact
verifyArtifact
writeSourceProvenance
readCatalogRootVersion
```

**Steps**

1. Add failing tests for digest/key generation, exact bytes, conditional create with S3 SHA-256 checksum metadata, dedup `HeadObject` checksum/size agreement, absent or mismatched checksum failure, cache/content headers, provenance schema, and forbidden overwrite.
2. Implement local SHA-256, S3 checksum submission/retrieval, and conditional writes; never infer digest equality from an ETag.
3. Separate artifact, provenance, and catalog prefixes in the interface/policies.
4. Verify returned public IRIs use HTTPS, configured hostname, and exact path grammar.
5. Run tests and inspect that no source-provided filename/header reaches an S3 key or unsafe response header.

**Verification command**

```powershell
node --test Lambda/Applications/ValidatedOntologyCache/test/ontologyArtifactRepository.test.js
```

**Completion gate**

Validated bytes are immutable/deduplicated, provenance is source-specific, and overwrite/collision anomalies fail closed.

**Suggested commit checkpoint:** `feat: store immutable validated ontology artifacts`

#### Task 3.3 — implement materialization worker

**Files**

- Create `ontologyMaterializationWorker.js`, handler export, structured logger, and integration tests.

**Steps**

1. Write failing orchestration tests for successful new artifact, content dedup, invalid source, forbidden source, transient failure, oversized source, duplicate SQS event, crash boundary after S3 write, refresh 304, refresh new valid, refresh invalid/stale, quarantine race, and catalog-dirty emission.
2. Compose registry → safe retriever → validator → artifact repository in that order.
3. Check remaining Lambda time before retrieval, validation, and promotion; stop safely before lease loss.
4. Emit one bounded structured event for each terminal transition.
5. Use partial-batch response and acknowledge only terminal/idempotently persisted outcomes.
6. Run integration tests with fake AWS clients and no live network.
7. Benchmark small/medium/32 MiB-boundary valid and adversarial fixtures in an isolated Node 24 ARM64-equivalent environment. Record wall time and peak heap; confirm 2,048 MiB/60 seconds has headroom.

**Verification commands**

```powershell
node --test Lambda/Applications/ValidatedOntologyCache/test/ontologyMaterializationWorker.test.js
node --test Lambda/Applications/ValidatedOntologyCache/test/ontologyMaterializationWorker.resource.test.js
```

**Completion gate**

Every failure leaves a coherent retryable/terminal state, only validated bytes become READY, and at-least-once delivery is harmless.

**Suggested commit checkpoint:** `feat: orchestrate validated ontology materialization`

### Cache Phase 4 — implement the materialization API

#### Task 4.1 — implement submission/status/CORS contract

**Files**

- Create `api/ontologyMaterializationApi.js` and contract tests.

**Interfaces**

Lambda Function URL handler plus internal pure functions:

```text
routeOntologyMaterializationRequest
submitOntologyMaterialization
readOntologyMaterializationStatus
createMaterializationHttpResponse
```

**Steps**

1. Add failing table-driven tests for exact methods/paths, preflight, body encoding/hash agreement, schema errors, kill switch, quota, idempotent PENDING, READY 303, each REJECTED mapping, STALE/REVALIDATING last-good redirect, quarantine, unknown 410, headers, and log redaction.
2. Confirm malformed paths are rejected before DynamoDB access.
3. Implement body limit before JSON parse and unknown-member rejection.
4. Canonicalize and transact admission through the registry interface.
5. Enqueue only after successful new/retry admission; reconcile a send failure by marking/scheduling recovery rather than leaving invisible work.
6. Generate absolute public locations from configured trusted base IRI, never request `Host`/forwarded headers.
7. Add OPTIONS responses and wildcard credential-free CORS.
8. Run contract tests and snapshot only stable JSON/header fields, excluding AWS request IDs/timestamps.

**Verification command**

```powershell
node --test Lambda/Applications/ValidatedOntologyCache/test/ontologyMaterializationApi.test.js
```

**Completion gate**

The HTTP contract in §8 is executable, API bodies remain small/no-store, and no direct Function URL/public AWS detail leaks.

**Suggested commit checkpoint:** `feat: expose ontology materialization control API`

### Cache Phase 5 — implement deterministic catalog projection

#### Task 5.1 — implement OASIS serialization

**Files**

- Create `catalog/oasisXmlCatalogProjection.js` and tests/fixtures.

**Interface**

```javascript
createOasisXmlCatalogProjection({ seedCatalogIri, publicBaseIri })
  .projectDynamicCatalog(catalogEligibleSources)
  .projectRootCatalog(dynamicCatalogIri)
```

**Steps**

1. Add failing tests for namespace, XML escaping, deterministic ordering/bytes/digest, seed-first root, duplicate conflicts, same-artifact aliases, no timestamp, empty dynamic set, cap enforcement, and hostile Unicode/XML characters.
2. Implement a narrow XML serializer; do not construct catalog XML with unsafe string interpolation.
3. Validate produced files against the OASIS XML Catalog 1.1 schema/DTD in a non-networked test setup, while production parsing does not fetch a DTD.
4. Parse produced catalogs with WebVOWL’s planned safe catalog reader and a second independent OASIS-capable implementation when available.
5. Repeat projection with shuffled input and prove identical bytes/digest.

**Verification command**

```powershell
node --test Lambda/Applications/ValidatedOntologyCache/test/oasisXmlCatalogProjection.test.js
```

**Completion gate**

Identical registry state produces identical conformant catalog bytes; seed precedence and exact mapping are proven.

**Suggested commit checkpoint:** `feat: project OASIS ontology catalogs`

#### Task 5.2 — implement catalog publication

**Files**

- Create `publishOntologyCatalogProjection.js` and integration tests.

**Steps**

1. Add failing tests for dirty-event coalescing, unchanged no-op, immutable generation conditional write, root `If-Match`, CAS conflict retry, worker duplicate, missing artifact, seed collision, cap breach, partial failure, and current-registry record.
2. Read catalog-eligible sources through the registry interface and verify referenced artifacts.
3. Write/verify immutable generation before root.
4. Update root and `CATALOG#CURRENT` with revision/ETag conditions.
5. Ensure a failed root promotion leaves the previous root valid and the new immutable generation harmless/unreferenced.
6. Emit bounded projection outcome metrics/events.

**Verification command**

```powershell
node --test Lambda/Applications/ValidatedOntologyCache/test/publishOntologyCatalogProjection.test.js
```

**Completion gate**

Publication is deterministic, atomic at the stable-root boundary, convergent under duplicates, and rollbackable.

**Suggested commit checkpoint:** `feat: publish immutable ontology catalog generations`

### Cache Phase 6 — synthesize the AWS data/control plane

#### Task 6.1 — add regional data stack

**Files**

- Create `regional_data_stack.py` and CDK assertion tests.
- Update approved Lambda package/config files.

**Steps**

1. Write failing CDK assertions for every regional resource/settings in §14.3, retention, encryption, public-access block, concurrency, timeouts, event source, DLQs, schedules, IAM scope, log retention, PITR/deletion protection, and resource tags.
2. Run the focused unittest and confirm failure before constructs exist.
3. Implement the stack without a distribution reference.
4. Bundle handlers reproducibly from the approved lockfile and assert each bundle’s dependency inventory; only the worker includes `owlapi`.
5. Run CDK assertions, cdk-nag, and synthesis.
6. Inspect synthesized policies/templates for wildcards, public Function URL, public bucket, KMS/NAT/fixed-cost surprises, or resource replacement.

**Verification commands**

```powershell
.venv\Scripts\python.exe -m unittest tests.infrastructure.test_validated_ontology_cache_stacks.RegionalDataStackTest
npx cdk synth
```

**Completion gate**

The regional template is least-privilege, bounded, private, tagged, and acyclic before any deployment.

**Suggested commit checkpoint:** `infra: define validated ontology cache data plane`

#### Task 6.2 — add global delivery construct and regional bindings

**Files**

- Create `global_delivery_construct.py` and `regional_access_bindings_stack.py`.
- Modify `app.py` and the smallest approved integration point in `infrastructure/stack.py`.
- Extend CDK tests.

**Steps**

1. Snapshot/synthesize the pre-change stacks and retain logical-ID/template evidence.
2. Add failing assertions for exact behaviours, origins, cache policies, response headers, OACs, no rewrite association, Function URL permissions, S3 read policy, and stack dependency direction.
3. Implement the data → global → bindings ordering.
4. Preserve existing distribution/aliases/certificate/DNS/static origin and current `ontology/*` semantics.
5. Add the more-specific behaviours and response policies.
6. Synthesize and run `cdk diff` read-only. Treat replacement/removal of an existing material resource as a failure.
7. Confirm API path does not inherit custom 404 caching and artifact query is absent from cache/origin policy.
8. Confirm direct Function URL invocation lacks permission while CloudFront OAC has both required scoped Lambda actions.

**Verification commands**

```powershell
.venv\Scripts\python.exe -m unittest tests.infrastructure.test_validated_ontology_cache_stacks.GlobalDeliveryTest
.venv\Scripts\python.exe -m unittest tests.infrastructure.test_validated_ontology_cache_stacks.RegionalBindingsTest
npx cdk synth
npx cdk diff
```

**Completion gate**

The synthesized change adds only approved cache/logging/WAF/monitoring resources and in-place distribution properties; existing resources are not replaced.

**Suggested commit checkpoint:** `infra: route ontology cache through existing CloudFront`

### Cache Phase 7 — implement refresh, reporting, monitoring, and cost controls

#### Task 7.1 — implement bounded revalidation scheduling

**Files**

- Create `revalidation/scheduleOntologyRevalidations.js` and tests.

**Steps**

1. Write failing tests for due/not-due, 100/day cap, deterministic pagination, seed/dynamic eligibility, stale priority, quarantine exclusion, conditional transition, duplicate schedule invocation, and queue failure reconciliation.
2. Implement one daily bounded scan and state transition/enqueue.
3. Ensure no source IRI enters scheduler logs/messages when `sourceKey` suffices; worker reads the durable record.
4. Run focused tests and a simulated 25,000-entry cost/read-capacity estimate.

**Verification command**

```powershell
node --test Lambda/Applications/ValidatedOntologyCache/test/scheduleOntologyRevalidations.test.js
```

**Completion gate**

Refresh work is finite, idempotent, and cannot starve first-time materializations.

**Suggested commit checkpoint:** `feat: schedule bounded ontology revalidation`

#### Task 7.2 — implement reporting and minimized logging

**Files**

- Create SQL, report function, structured-event module, schemas, and tests.
- Create `monitoring_construct.py` assertions.

**Steps**

1. Add failing tests for log redaction/field allowlist, SQL partition/path filters, spoofed source tokens, daily/monthly aggregation, query byte cutoff, state-change idempotency, missing EventBridge-event reconciliation through bounded `GetQueryExecution`, result validation, and report schema.
2. Implement structured event writer and prove it truncates/rejects unknown/high-risk fields.
3. Implement Athena start/finalize flow without billed polling, including daily reconciliation of an incomplete query record before any replacement query is started.
4. Add selected-field CloudFront logging v2, private partitions, and lifecycle policies.
5. Add native-metric dashboard and eight initial alarms; assert no high-cardinality custom dimension.
6. Run sample queries over synthetic partitioned logs and reconcile counts manually.
7. Calculate delivery/storage/query cost at quiet/growth/budget-edge volumes.

**Verification commands**

```powershell
node --test Lambda/Applications/ValidatedOntologyCache/test/ontologyCacheUsageReport.test.js
.venv\Scripts\python.exe -m unittest tests.infrastructure.test_validated_ontology_cache_stacks.MonitoringTest
```

**Completion gate**

Reports answer the required usage/cost questions, selected logs omit viewer-identifying fields, and the estimated observability bill remains bounded.

**Suggested commit checkpoint:** `feat: report ontology cache usage and cost`

#### Task 7.3 — replace cache-related destructive cost enforcement

**Files**

- Modify the approved current cost-enforcement CDK/Lambda path minimally.
- Add cost-policy tests and runbook.

**Steps**

1. Characterize the current function with tests before changing it.
2. Add a failing test showing an ontology-cache budget event must disable new materialization but leave the distribution enabled.
3. Implement warning/forecast/limit notifications and the registry kill-switch update.
4. Remove cache-budget authority to call `cloudfront:UpdateDistribution`; retain any separately approved site-wide emergency policy in alert-only or explicitly scoped form.
5. Reduce evaluation cadence to match billing-data freshness and record the monitoring API’s own monthly cost.
6. Simulate USD 7/USD 9/USD 10 events and recovery; prove idempotency and no automatic re-enable.
7. Update operations runbook with explicit human re-enable checks.

**Completion gate**

A cache cost event cannot disable the website/catalog/artifact data plane; alerts and kill switch are tested and recoverable.

**Suggested commit checkpoint:** `fix: isolate ontology cache cost containment`

### Cache Phase 8 — implement the WebVOWL loader

#### Task 8.1 — implement bounded response reading

**Files**

- Create `boundedOntologyResponse.js` and tests.

**Interface**

```javascript
readBoundedOntologyResponse(response, {
  maxBytes,
  sourceDocumentIri,
  signal,
})
```

Return exact bytes/text plus safe content/file hints, or throw the public `owlapi` resource/load error appropriate to the accepted API.

**Steps**

1. Add failing tests for content length, streamed exact limit/one-byte overflow, missing body, abort, reader cancel, invalid status, content type, file-name decoding, and UTF-8 parity.
2. Implement streaming consumption with early cancel and no quadratic concatenation.
3. Ensure errors do not trigger parser fallback or materialization when the source was readable.
4. Run tests under Node’s web APIs and a real browser fixture.

**Verification command**

```powershell
npm test -- --runInBand src/ontology-loading/boundedOntologyResponse.test.js
```

**Completion gate**

The browser cannot allocate beyond the configured representation envelope without a typed failure.

**Suggested commit checkpoint:** `feat: read bounded ontology responses`

#### Task 8.2 — implement safe OASIS catalog reader

**Files**

- Create `oasisXmlOntologyCatalog.js`, fixtures, and tests.

**Interface**

```javascript
createOasisXmlOntologyCatalog({ catalogIri, fetchImpl, limits })
  .resolve(sourceDocumentIri, { signal })
```

It coalesces acquisition and also supports `remember(sourceDocumentIri, artifactIri)` for a session-local newly materialized mapping.

**Steps**

1. Add failing tests for exact mappings, seed/dynamic order, relative `nextCatalog`, XML base, cycles, same-origin path restriction, abort, file/entry/byte limits, malformed/DTD/entity input, duplicate conflict, fetch failure degradation, and session mapping.
2. Implement feature-detected DOM parsing with explicit namespace checks and no external resolution.
3. Freeze the resulting map and diagnostic set.
4. Add deterministic acquisition/parse performance tests at 1,000, 10,000, and 25,000 entries.
5. Verify generated backend catalogs resolve identically.

**Verification command**

```powershell
npm test -- --runInBand src/ontology-loading/oasisXmlOntologyCatalog.test.js
```

**Completion gate**

The reader safely consumes the generated OASIS profile, fails degradably, and meets catalog size/performance budgets.

**Suggested commit checkpoint:** `feat: resolve OASIS ontology catalog mappings`

#### Task 8.3 — implement materialization client

**Files**

- Create `ontologyMaterializationClient.js` and tests.

**Interface**

```javascript
createOntologyMaterializationClient({
  collectionIri,
  fetchImpl,
  cryptoImpl,
  clock,
  random,
  limits,
}).materialize(sourceDocumentIri, { signal, onStateChange })
```

Return a bounded final artifact response plus its verified artifact IRI.

**Steps**

1. Add failing tests for exact body bytes/hash, missing Web Crypto/secure context, preflight-relevant headers, 202/Retry-After parsing, recursive backoff/jitter, 303 automatic follow, final-origin/path verification, every error code, 410 resubmission semantics, abort, 60-second total budget, coalescing, four-submission semaphore, and no credentials.
2. Implement SHA-256 with Web Crypto and manual lowercase hex conversion compatible with the frozen browser matrix; feature-detect newer helpers rather than requiring them.
3. Implement one Fetch operation at a time and recursive delay with cancellation.
4. Accept only HTTPS service endpoints and final artifact path grammar.
5. Normalize service errors into public `owlapi` document/security/resource errors without message matching.
6. Run unit and real-browser preflight/redirect tests.

**Verification command**

```powershell
npm test -- --runInBand src/ontology-loading/ontologyMaterializationClient.test.js
```

**Completion gate**

The client satisfies the Function URL OAC body-hash contract, never spins/overlaps, and propagates cancellation/errors correctly.

**Suggested commit checkpoint:** `feat: request validated ontology materialization`

#### Task 8.4 — implement the deep document loader

**Files**

- Create `webVowlOntologyDocumentLoader.js`, configuration, tests, and integration test.

**Steps**

1. Write failing precedence tests for in-memory/catalog hit, direct success, HTTP→HTTPS, direct readable error, Fetch rejection fallback, mixed-content fallback, abort/no fallback, resource failure/no fallback, materialization success, pending timeout, source-document-IRI preservation, content hints, concurrent coalescing, and progress events.
2. Implement the sole `load` interface by composing the three internal modules.
3. Use `credentials: "omit"` everywhere and no `no-cors` request.
4. Return only public `StringDocumentSource` values from the installed package.
5. Add an architecture test prohibiting browser materialization policy inside `owlapi`, use as IRI mapper, a second ontology fetch path, or import from the retired source tree.
6. Run focused, integration, full Jest, lint/format, development, and production builds.

**Verification commands**

```powershell
npm test -- --runInBand src/ontology-loading/webVowlOntologyDocumentLoader.test.js
npm test -- --runInBand src/ontology-loading/ontologyLoading.integration.test.js
npm run lint
npm run format:check
npm run build:dev
npm run build
```

**Completion gate**

The loader is a deep application module behind the accepted public `owlapi` seam, with one deterministic precedence/error policy and no duplicate mapping/fetch logic.

**Suggested commit checkpoint:** `feat: add cache-aware ontology document loader`

### Cache Phase 9 — integrate WebVOWL top-level/import loading and retire the static runtime catalog

#### Task 9.1 — route root and imports through one loader

**Files**

- Modify the post-Phase-20 `src/owl2vowl/js/index.js`, application composition root, `loadingModule.js`, lifecycle/UI tests, and architecture tests.

**Steps**

1. Characterize current top-level IRI, static catalog import, missing import diagnostic, cancellation, and VOWL semantic outputs.
2. Add failing tests proving top-level CORS fallback and an imported CORS fallback use the same loader/session.
3. Inject one loader from the application composition root into top-level retrieval and `OWLManager`.
4. Preserve local file/direct input and VOWL-JSON loading semantics.
5. Wire bounded progress events into existing accessible loading status.
6. Abort the previous resolution session when a new ontology load begins.
7. Run all current production corpus/differential/VOWL snapshot tests and inspect changes; no output change is accepted merely because retrieval location changed.

**Verification commands**

```powershell
npm test -- --runInBand src/app/js/loadingModule.test.js
npm test -- --runInBand src/owl2vowl/js/index.test.js
npm test -- --runInBand src/owl2vowl/test/productionCorpus.test.js
npm test -- --runInBand
```

**Completion gate**

One loader owns root/import network policy; VOWL semantic outputs and non-remote workflows remain green.

**Suggested commit checkpoint:** `refactor: unify WebVOWL ontology document loading`

#### Task 9.2 — replace runtime `ONTOLOGY_CATALOG`

**Files**

- Modify `constants.js`/tests and architecture tests.
- Delete `importResolver.js`/test only at the final green step.

**Steps**

1. Add a failing architecture test that production code contains no `ONTOLOGY_CATALOG` mapping object and no export of a mutable/runtime catalog object.
2. Prove the staged seed catalog resolves every former key to a semantically equivalent validated artifact.
3. Remove `ONTOLOGY_CATALOG`, its mapping-only helpers/exports, and resolver construction.
4. Retain `ONTOLOGY_BASE_URL` only if another responsibility uses it; otherwise replace it with the exact stable endpoint names in `ontologyLoadingConfiguration.js`.
5. Delete the superseded resolver and tests.
6. Run all WebVOWL tests/builds and source scans for the old symbol/path.

**Verification commands**

```powershell
rg -n "ONTOLOGY_CATALOG|WebVowlImportResolver|src/owlapi-js|\.\./\.\./owlapi-js" src
npm test -- --runInBand
npm run build
```

**Completion gate**

No dynamic mapping requires a WebVOWL source release; all former seed behaviour is served through the catalog/data plane.

**Suggested commit checkpoint:** `refactor: replace bundled ontology mapping with OASIS catalog`

### Cache Phase 10 — validate and stage the seed catalog

#### Task 10.1 — make the seed importer executable and safe

**Files**

- Complete `stage_validated_ontology_seed_catalog.mjs`, manifest, tests, and seed catalog generation.

**Interface/commands**

The script has explicit modes:

```text
--dry-run
--stage-to-local-directory
--apply-to-approved-aws-account
```

Apply mode requires exact account/region/bucket/table confirmation, a reviewed manifest digest, and a separate live mutation approval. It does not infer target from ambient defaults alone.

**Steps**

1. Add failing tests for wrong account/region, manifest digest mismatch, invalid seed, content change, duplicate bytes, curated alias, dry-run no writes, conditional S3 write, seed registry collision, and partial failure recovery.
2. Use the same canonicalizer, safe retriever, validator, artifact repository, and OASIS projector as production; do not create a permissive seed-only path.
3. In dry-run, fetch/validate all approved sources, calculate digests/provenance, and report differences without AWS writes.
4. Review invalid/moved/licence/takedown findings individually.
5. Stage locally and run WebVOWL/independent OASIS resolution against the generated seed catalog.
6. After explicit approval, write artifacts/provenance/seed registry records conditionally, publish immutable `seed/v1`, and publish the stable root only after complete verification.
7. Update the manifest from `DISCOVERED` to `STAGED` with exact artifact digests/evidence through a reviewed source change; never regenerate silently after upload.

**Verification commands**

```powershell
node --test Lambda/Applications/ValidatedOntologyCache/test/stageValidatedOntologySeedCatalog.test.js
node scripts/stage_validated_ontology_seed_catalog.mjs --dry-run
node scripts/stage_validated_ontology_seed_catalog.mjs --stage-to-local-directory
```

**Completion gate**

Every seed mapping resolves from a conformant catalog to bytes accepted by the exact runtime profile; production apply evidence is complete and replay-safe.

**Suggested commit checkpoint:** `data: publish validated ontology seed catalog evidence`

### Cache Phase 11 — dark deploy and live canary

#### Task 11.1 — deploy infrastructure with materialization disabled

**Prerequisites**

- Explicit deployment approval for exact `cdk diff`.
- Backup/recovery evidence for affected distribution/configuration.
- `materializationEnabled = false` initial state.
- WAF rule action `COUNT`.
- No production WebVOWL build references the endpoint yet.

**Steps**

1. Deploy regional data stack.
2. Verify bucket/table/queues/functions/logs privately; direct Function URL access fails.
3. Deploy global distribution changes.
4. Wait for CloudFront propagation and verify existing website/ontology paths before adding bindings.
5. Deploy regional access bindings and verify OAC reads/invokes.
6. Verify WAF count metrics, selected CloudFront log delivery, dashboard, alarms, and no sensitive fields.
7. Apply seed catalog through its separately approved command.
8. Fetch every stable/immutable path from multiple edge locations where practical; inspect cache headers/hit transitions.
9. Run full current website smoke tests and compare CloudFormation drift/diff.

**Completion gate**

New data plane is healthy, control plane rejects new work by design, existing distribution behaviour is unchanged, and cost/log evidence matches projection.

No automatic commit or push follows a deployment.

#### Task 11.2 — enable controlled canary materialization

**Steps**

1. Explicitly enable materialization for the approved canary window.
2. Run controlled no-CORS valid source; prove 202 → pending → 303 → artifact, validation/provenance, catalog dirty event, immutable generation, and stable root update.
3. Run invalid, forbidden, oversized, timeout, redirect, duplicate, and concurrent canaries.
4. Verify source-document-IRI/relative-IRI semantics in parsed VOWL output.
5. Verify direct Function URL remains inaccessible and SSRF forbidden canary makes no connection.
6. Verify CloudFront artifact second read is a hit and invokes no API/worker/DynamoDB.
7. Verify a new browser session resolves the source from the OASIS catalog without materialization.
8. Trigger/simulate budget kill; confirm new work stops while reads/site remain.
9. Return materialization to disabled until WebVOWL rollout approval.

**Completion gate**

All live contracts and security/cost controls match local evidence; no unexpected spend, sensitive log field, or resource drift remains.

### Cache Phase 12 — WebVOWL rollout and WAF enforcement

#### Task 12.1 — release WebVOWL with the loader enabled

**Steps**

1. Build from a clean install resolving the exact accepted `owlapi` package.
2. Run full tests/build/corpus and real-browser matrix.
3. Deploy WebVOWL only after separate approval.
4. Enable materialization and observe an initial bounded rollout window.
5. Compare direct, catalog, and materialization rates; confirm no loop repeatedly submits a ready source.
6. Verify source attribution query does not fragment artifact cache.
7. Verify no material increase in LCP/INP or initial main-thread work; catalog prefetch remains non-blocking.
8. Record first-day and first-seven-day cost/usage/security evidence.

**Completion gate**

Production WebVOWL resolves representative root/import CORS failures through the cache while all local/direct/seed behaviours remain green.

**Suggested commit checkpoint (only after code review, before deployment as authorized):** `feat: enable validated ontology cache resolution`

#### Task 12.2 — tune and enforce WAF rule

**Steps**

1. Keep COUNT for at least seven full days including a 256-import closure test.
2. Report per-IP count distribution only through WAF aggregate/safe sampling evidence; do not retain viewer IPs in application reports.
3. Confirm 300/5-minute threshold does not block legitimate workloads and is low enough to limit bursts.
4. Present exact Count→Block diff and observed false-positive/cost evidence for approval.
5. Change only the rule action to BLOCK.
6. Verify 429 response/Retry-After, ordinary API use, website/static paths, and metrics.
7. Monitor for one additional complete week; roll back to COUNT if verified legitimate traffic is blocked.

**Completion gate**

The anonymous submission path has enforced edge rate protection with measured threshold evidence and no managed-rule cost expansion.

### Cache Phase 13 — operational hardening and programme completion

#### Task 13.1 — exercise refresh, quarantine, recovery, and reports

**Steps**

1. Run conditional 304, valid content change, invalid content change/last-known-good, transient failure, expired lease, DLQ redrive, and catalog CAS conflict drills.
2. Quarantine a controlled canary source; publish new catalog; prove new sessions no longer map it and submissions receive 403.
3. Roll the stable catalog root back to its previous S3 version/generation and forward again without editing immutable generations.
4. Disable/re-enable materialization through the runbook, with explicit operator checks.
5. Generate daily/monthly reports and reconcile them against CloudFront/WAF/Lambda/SQS/DynamoDB/S3 billing metrics.
6. Review raw-log lifecycle and prove no excluded sensitive fields.
7. Run S3 artifact-integrity sampling and registry/catalog referential-integrity report.
8. Recalculate projected monthly cost from observed traffic and record budget headroom.

**Completion gate**

An operator other than the implementer can execute the documented drills from durable evidence without source-code guesswork.

**Suggested commit checkpoint:** `docs: finalize ontology cache operations runbook`

#### Task 13.2 — final verification and handoff

**Steps**

1. Run every focused/full suite and build from clean dependency installs in both repositories.
2. Run CDK synth, cdk-nag, read-only diff/drift checks, bundle inventory, dependency audit, and licence/NOTICE/SBOM reconciliation.
3. Run browser and live canary matrices.
4. Search for retired source-tree imports/catalog symbols, unresolved template markers, debug logging, raw source-IRI logging, unbounded timers/retries, `no-cors`, credentials, private/deep `owlapi` imports, and permissive IAM.
5. Reconcile this document’s file/interface/resource names with implemented names and record any approved deviation.
6. Record production resource IDs, package versions/digests, catalog generation, seed manifest digest, validation profile, WebVOWL revision, cost baseline, WAF action, and rollback points.
7. Pause for final review/commit authorization. Do not mark complete while a required deployment, evidence record, or operational action remains.

**Completion gate**

Every §23 definition-of-done condition has dated evidence, the operator handoff is accepted, and no configuration/deployment/publication/commit/push approval is inferred or left unresolved.

**Suggested commit checkpoint:** `docs: close validated ontology cache implementation`

---

## 21. Rollout, rollback, and failure semantics

### 21.1 Rollout order

```text
Phase 20 production package proof
  → contracts/security/domain tests
  → private regional resources
  → dark CloudFront behaviours + WAF COUNT + logs
  → validated seed/catalog
  → controlled live materialization canary
  → WebVOWL client deployment
  → observed production enablement
  → WAF BLOCK
  → refresh/quarantine/recovery drills
```

Never deploy the client before the stable catalog and disabled/controlled API paths are reachable. Never enable WAF BLOCK before count evidence. Never delete the static catalog/resolver until seed parity and client rollback are proven.

### 21.2 Rollback layers

| Failure | First rollback | Data preserved |
| --- | --- | --- |
| New-source cost/abuse | Set `materializationEnabled=false` | Website, catalog, READY artifacts, registry/queue evidence. |
| WAF false positive | Change rule BLOCK→COUNT | All traffic/data; metrics retained. |
| Client loader regression | Deploy prior WebVOWL build | Cache infrastructure/catalog remains dark/usable; no source deletion. |
| Bad catalog root | Restore prior root version or repoint to prior immutable dynamic generation | All generations/artifacts retained. |
| Bad dynamic mapping | Quarantine source and republish generation | Artifact/provenance retained for audit; seed unchanged. |
| Worker/parser regression | Disable admission and event-source mapping; deploy previous worker bundle | Pending queue/registry and READY artifacts retained. |
| API regression | Disable admission/deploy previous API bundle | S3 data plane remains readable. |
| Distribution behaviour regression | Apply reviewed prior distribution config | Regional resources remain private; no bucket public fallback. |
| Security/legal artifact incident | Quarantine, republish catalog, separately authorize invalidation/object-access containment | Audit evidence retained under incident policy. |

Rollback never moves an immutable artifact/catalog generation to different bytes, reuses a digest path, turns the S3 bucket public, exposes the Function URL, disables TLS validation, or restores `ONTOLOGY_CATALOG` through a hidden source alias.

### 21.3 Ambiguous external writes

For CDK deployment, S3 write, DynamoDB transition, WAF update, budget action, seed application, or publication whose response is interrupted:

1. Stop automatic retry.
2. Read external state using the exact resource/key/revision/digest.
3. Classify the operation as completed, absent, or inconsistent.
4. Retry only an idempotent/conditional operation whose preconditions still hold.
5. Obtain renewed approval for any materially different mutation.
6. Preserve the failed/ambiguous attempt in deployment evidence.

### 21.4 Degraded operation

- Catalog unavailable: try direct, then materialization.
- Materialization disabled/unavailable: catalog and direct paths still work; show a specific diagnostic.
- DynamoDB/SQS/Lambda unavailable: READY S3/catalog reads still work.
- Upstream unavailable: catalog hit works; unknown source receives transient failure.
- Catalog publisher delayed: first caller receives final artifact directly and session mapping; future catalog discovery waits.
- Revalidation fails: last-known-good remains.
- Reporting unavailable: request serving continues; alarm/report backlog is operational debt and does not mutate source state.

---

## 22. Operations runbook requirements

`amazon-aws/docs/validated-ontology-cache/operations-runbook.md` must contain exact read-only diagnosis first, then approved mutation paths for:

1. Check service enablement, daily quota, queue depth/age, DLQ, function errors/throttles, catalog current revision, WAF action/count, and cost forecast.
2. Resolve a `sourceKey` to registry/provenance/artifact/catalog state without using viewer logs.
3. Explain each public error code and retry window.
4. Disable new materialization and verify data-plane health.
5. Re-enable only after cause/cost/queue review; no automatic monthly re-enable.
6. Redrive one DLQ message after state/lease reconciliation; never bulk-redrive blindly.
7. Reconcile an expired lease and worker crash boundary.
8. Force an approved source revalidation without bypassing SSRF/validation.
9. Quarantine/takedown and publish a new catalog generation.
10. Restore a previous root catalog version/generation.
11. Verify an artifact digest/headers through S3 and CloudFront.
12. Investigate a catalog cap/invariant failure.
13. Investigate a cost spike by WAF/CloudFront/logging/Lambda/S3/DynamoDB/Athena driver.
14. Change WAF COUNT/BLOCK under approval and verify propagation.
15. Rotate/deprecate a validation profile or `owlapi` package version and revalidate existing sources.
16. Recover from a failed/ambiguous CDK deployment without destructive Git or CloudFormation shortcuts.
17. Produce daily/monthly private reports and retention evidence.
18. Perform security incident containment without deleting audit evidence.

Every procedure names the expected account/region/resource, read command, decision criteria, mutation command/API, postcondition check, rollback, and evidence location. Examples use symbolic identifiers defined in the runbook and must require operators to resolve/confirm them before mutation; they never encourage commands against a wildcard account or broad bucket prefix.

---

## 23. Definition of done

This programme is complete only when all of the following are true:

### 23.1 Package and application boundary

- Phase 20 is complete and evidenced.
- Browser and Lambda use the same exact accepted public `owlapi` registry artefact and profile.
- No current/retired `src/owlapi-js` import, local/workspace/Git/alias dependency, private deep import, parser registry, or duplicate package tree participates.
- `owlapi` performs no ambient network; every outbound request belongs to an injected application/worker policy.
- Source document IRI remains parser context when bytes come from HTTPS upgrade, redirect, S3, or shared content digest.
- WebVOWL root and imports use one loader/session and retain VOWL semantic output parity.

### 23.2 Validation and integrity

- Only representations accepted by `webvowl-compatible-document-v1` are READY/catalog eligible.
- All upstream/document/parser work has tested finite byte/time/import/depth/redirect/retry limits.
- Remote imports, remote JSON-LD contexts, and XML external entities are disabled during worker validation.
- Artifacts are immutable SHA-256 paths written conditionally; registry/catalog references pass integrity checks.
- Declared ontology/version/redirect IRIs are metadata only; no unreviewed alias exists.
- Seed mappings are complete, curated, validated, immutable, and precedence-protected.
- Refresh retains last-known-good and quarantine reliably removes future mapping.

### 23.3 Security and privacy

- URL/DNS/connection/redirect SSRF controls pass the complete IPv4/IPv6/adversarial corpus and live forbidden canary without a connection.
- No credentials/cookies/caller headers flow upstream; no private/no-store/session response is published.
- WAF rate rule is measured then enforced; daily quota, worker concurrency, attempts, queue/DLQ, kill switch, and body/byte limits operate.
- Function URL is inaccessible directly and CloudFront permissions are distribution-scoped.
- Artifact bucket is private/OAC-only; IAM policies are least privilege; no NAT/KMS/managed-rule fixed-cost surprise exists.
- Logs/reports omit raw viewer IP, cookie, user agent, referrer, request body, source IRI in routine events, and high-cardinality CloudWatch dimensions.
- Cache/takedown policy, provenance, AGPL/dependency notices, and security contacts are published/reviewed.
- The approved corresponding-source mechanism resolves every deployed worker revision to complete, reproducible source/build inputs for the worker and exact bundled `owlapi`; the recorded licence review has no open deployment condition.

### 23.4 Caching and catalog

- Catalog/artifact hits are CloudFront→S3 only and invoke no Lambda/DynamoDB/SQS.
- Artifact and immutable catalog responses cache one year with immutable identity; root caches five minutes with tested stale behaviour; API never caches.
- OASIS root/seed/dynamic files are conformant, deterministic, exact, seed-first, and consumable by WebVOWL plus an independent resolver.
- First caller succeeds from the 303 artifact without waiting for catalog propagation; later session resolves from catalog.
- Viewer `source` query is absent from artifact cache/origin keys and cannot fragment content.
- Existing legacy ontology paths/rewrite behaviour and website remain unchanged.

### 23.5 Cost and operations

- Distribution stays CloudFront pay-as-you-go and Route 53 remains independently managed.
- Observed projected monthly incremental cost is below USD 10 with documented headroom; WAF total-distribution cost is included.
- CloudFront/Lambda/SQS/DynamoDB/S3/CloudWatch/Athena actual usage reconciles with private reports and AWS billing data.
- USD 7 actual, USD 9 forecast, and USD 10 actual controls notify/disable new work as designed without disabling the distribution.
- Raw/aggregate retention, alarms, dashboard, Athena byte cutoff, report idempotency, and source attribution caveat are operational.
- Rollback, refresh, DLQ, quarantine, catalog restore, kill/re-enable, cost-spike, and incident drills have dated passing evidence.
- Final clean tests/builds/CDK synth/nag/diff/browser/live canary/dependency/licence/SBOM checks pass.
- No required configuration approval, deployment, evidence record, review checkpoint, or runbook action remains outstanding.

---

## 24. Normative and current guidance references

### 24.1 Local architecture/package sources

- [`docs/owlapi-js/implementation-plan.md`](../owlapi-js/implementation-plan.md)
- [`docs/owlapi-js/ontology-lifecycle-capability-implementation-plan.md`](../owlapi-js/ontology-lifecycle-capability-implementation-plan.md)
- Current WebVOWL `src/owl2vowl/js/constants.js`, `importResolver.js`, `index.js`, `src/app/js/loadingModule.js`, and `src/shared/js/util/resolveFetchUrl.js` as migration evidence only.
- Current `amazon-aws/app.py`, `infrastructure/stack.py`, `CloudFront/Functions/RewriteOntologyURI.js`, and `Lambda/Functions/DisableCloudFrontOnCostLimit.js` as deployment evidence only.

### 24.2 Web and catalog standards

- [OASIS XML Catalogs 1.1](https://www.oasis-open.org/standard/xmlcatalogs/)
- [WHATWG Fetch Standard](https://fetch.spec.whatwg.org/)
- [WHATWG DOM Standard — `AbortSignal`](https://dom.spec.whatwg.org/)
- [W3C Web Cryptography Level 2](https://www.w3.org/TR/WebCryptoAPI/)
- [RFC 9110 — HTTP Semantics](https://www.rfc-editor.org/rfc/rfc9110.html)
- [RFC 9111 — HTTP Caching](https://www.rfc-editor.org/rfc/rfc9111.html)
- [RFC 5861 — stale HTTP cache controls](https://www.rfc-editor.org/rfc/rfc5861.html)
- [OWASP SSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)
- [OWASP SSRF Prevention in Node.js](https://owasp.org/www-community/pages/controls/SSRF_Prevention_in_Nodejs.html)
- [GNU Affero General Public License version 3](https://www.gnu.org/licenses/agpl-3.0.html)

### 24.3 AWS architecture, security, caching, logging, and pricing

- [CloudFront pay-as-you-go pricing](https://aws.amazon.com/cloudfront/pricing/)
- [CloudFront getting started / always-free allocation](https://aws.amazon.com/cloudfront/getting-started/)
- [Restrict Lambda Function URL origins with CloudFront OAC](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-lambda.html)
- [CloudFront cache expiration and stale controls](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/Expiration.html)
- [CloudFront response-headers policies](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/understanding-response-headers-policies.html)
- [CloudFront standard logging v2](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/standard-logging.html)
- [AWS WAF pricing](https://aws.amazon.com/waf/pricing/)
- [AWS WAF rate-based rule settings](https://docs.aws.amazon.com/waf/latest/developerguide/waf-rule-statement-type-rate-based-high-level-settings.html)
- [AWS WAF association model](https://docs.aws.amazon.com/waf/latest/developerguide/web-acl-associating-aws-resource.html)
- [S3 conditional writes](https://docs.aws.amazon.com/AmazonS3/latest/userguide/conditional-writes.html)
- [S3 object-integrity checksums](https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity-upload.html)
- [S3 CORS configuration](https://docs.aws.amazon.com/AmazonS3/latest/userguide/ManageCorsUsing.html)
- [S3 pricing](https://aws.amazon.com/s3/pricing/)
- [Lambda pricing](https://aws.amazon.com/lambda/pricing/)
- [DynamoDB pricing](https://aws.amazon.com/dynamodb/pricing/)
- [SQS pricing](https://aws.amazon.com/sqs/pricing/)
- [CloudWatch pricing](https://aws.amazon.com/cloudwatch/pricing/)
- [Athena pricing](https://aws.amazon.com/athena/pricing/)
- [Amazon Athena events with EventBridge](https://docs.aws.amazon.com/athena/latest/ug/athena-events.html)

Pricing links are normative inputs to the predeployment recalculation, not promises that the 25 August 2026 numeric baseline will remain unchanged.
