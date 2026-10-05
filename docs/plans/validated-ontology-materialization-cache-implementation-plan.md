# Validated Ontology Materialization Cache Implementation Plan

> **Status:** Revised draft implementation plan, 5 October 2026; implementation and release require the acceptance gates below.<br>
> **Original proposal:** [Codex discussion: validated ontology materialization cache](codex://threads/01a034b3-1c88-7a82-8b49-3a319c8b459a).<br>
> **Revision basis:** [Deep-research assessment and recommended plan revisions](../reviews/Validated%20Ontology%20Materialisation%20Cache_%20deep-research%20assessment%20and%20recommended%20plan%20revisions.md), reconciled with WebVOWL commit `0fbf00ef51f65f1235f4d3b24cc1706cd2a5ade8`, its installed package, and the public npm registry on 5 October 2026.<br>
> **Package baseline:** `@hadden-industries/owlapi@0.1.0-rc.1`, consumed through WebVOWL's existing native npm alias `owlapi`; neither stable `0.1.0` nor an unpublished `rc.2` is a prerequisite.<br>
> **Purpose:** Let WebVOWL acquire public ontology documents and imports despite browser CORS or mixed-content restrictions, while preserving exact source bytes, parser context, managed import graphs, consumer outcomes, bounded work and the existing website's availability.<br>
> **Architecture:** Ordinary reads use CloudFront → private S3.
> Admission, retrieval, validation, refresh and publication use a bounded Lambda/DynamoDB/SQS control plane.
> Byte identity, document validation, closure qualification and consumer admission are separate contracts.<br>
> **Planning method:** HISEW thin implementation planning.
> The requirements, quality scenarios, decisions and vertical slices below are a draft revision for owner acceptance, not a record that implementation or production acceptance has occurred.<br>
> **Authority:** This revision authorizes no configuration changes, source implementation, AWS mutation, package publication, commit or push.
> The exact-change approval rules in §2.4 remain in force.

---

## 1. Decision summary

The assessment rebases the existing design onto the canonical application and public package; it does not replace the S3/DynamoDB/SQS/CloudFront architecture.
The following decision IDs identify the proposed revised baseline throughout this plan.

| Decision | Revised constraint                                                                                                                                                                                                                                    |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DEC-001  | Pin the same exact public `owlapi` coordinate and integrity in both consumers. The existing native npm alias is supported; mutable tags, private imports and local source fallbacks are not. Qualify any later RC as a coordinated dependency change. |
| DEC-002  | Integrate at canonical source/import acquisition, before worker-owned document admission. Preserve the `vowl/owl` and document-session contracts; do not recreate retired converter/controller/Turtle-writer paths.                                   |
| DEC-003  | Keep exact acquired bytes, requested IRI, effective origin retrieval IRI and parser document IRI distinct. Deduplicate only byte objects; validation evidence includes context, exact package, parser and policy.                                     |
| DEC-004  | Track acquisition, document validation, root-specific closure qualification, publication and consumer admission separately. Use public managed closure/profile APIs; never flatten the authoritative source documents.                                |
| DEC-005  | Derive syntax identities, media types, aliases and parser candidates from public `OWLDocumentFormats`. Version application preference ordering, decoding and loader policies; do not maintain a second format catalogue.                              |
| DEC-006  | Application acquisition owns all networking. Document validation has no import retrieval; closure loading uses only the injected controlled loader. Deny ambient fetch, remote JSON-LD contexts and XML external entities.                            |
| DEC-007  | Keep one existing pay-as-you-go CloudFront distribution, private dedicated artifact S3 origin and OAC-protected Function URL control plane. Route 53 remains independently managed. Hits require no Lambda/DynamoDB/SQS call.                         |
| DEC-008  | Treat durable catalog publication as the reader-visible commit point. Conditional leases, source generations, immutable checksum-verified objects and fenced publication make duplicate/reordered SQS work safe.                                      |
| DEC-009  | Preserve source validators and HTTP variation/revalidation metadata. Only representations admitted for durable republication receive the immutable lifetime. Conditional refresh never launders changed cache restrictions.                           |
| DEC-010  | Generate seed-first OASIS catalogs and source-specific resolution evidence from one committed model. A compact JSON lookup projection is optional and must be generated from that same model.                                                         |
| DEC-011  | Minimize logs, use an explicit egress/security decision, preserve source rights/takedown controls, and contain cost by disabling new work rather than the shared website or published data plane.                                                     |
| DEC-012  | Qualify direct and cached acquisition against the same installed package, logical corpus and canonical workloads. Preserve a tested direct-only bypass and known-good deployment throughout rollout.                                                  |

Public `owlapi` loading, source evidence, managed graph and profile APIs are reused as native consumer capabilities.
The residual custom work is controlled acquisition, immutable storage, contextual evidence, publication and operations.
No compatibility shim or parser implementation is proposed; the native npm alias is the package producer's documented installation contract.

### 1.1 Why the TTLs are not uniformly one day

A one-day TTL is a reasonable first intuition for stable public ontologies, but it conflates three different resources:

| Resource                                  | Mutability              | Selected browser/edge policy                                                 | Reason                                                                                                                                  |
| ----------------------------------------- | ----------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Content-addressed ontology artifact       | Immutable               | `public, max-age=31536000, immutable`                                        | The path changes when bytes change, so revalidation provides no correctness benefit.                                                    |
| Immutable seed/dynamic catalog generation | Immutable               | `public, max-age=31536000, immutable`                                        | A generation is identified by its digest and is never edited.                                                                           |
| Stable root catalog                       | Mutable pointer         | `public, max-age=300, stale-while-revalidate=300, stale-if-error=86400`      | New mappings must become discoverable promptly, but the last good root remains useful during a transient origin failure.                |
| Upstream source freshness                 | Mutable external state  | Default 30-day conditional refresh, subject to source eligibility/directives | Origin checks are separate from digest-object lifetimes; changed restrictions override ordinary last-known-good retention (§7.5/§12.3). |
| Invalid-ontology result                   | Mutable negative result | 24-hour retry suppression                                                    | Prevent repeated expensive parsing without making a rejection permanent.                                                                |
| Transient retrieval failure               | Transient               | 15-minute retry suppression                                                  | Reduce request amplification while allowing recovery.                                                                                   |

This is more liberal than a one-day object TTL where immutability permits it, and more responsive where a mutable catalog pointer requires it.

---

## 2. Mandatory starting checkpoint

The old Phase 20/stable-release gate and deferred `0.2.0` lifecycle assumptions are superseded by this checkpoint.
SLICE-001 establishes the package and semantic contracts before storage or infrastructure implementation.

### 2.1 Exact public package adoption

Read-only verification on 5 October 2026 found one published version, `0.1.0-rc.1`, with both npm `latest` and `next` pointing to it.
WebVOWL's manifest declares `"owlapi": "npm:@hadden-industries/owlapi@0.1.0-rc.1"`; its lockfile and the registry agree on:

```text
sha512-uDv9Omh2l2zxAjpVeQi4UxXEad/cRiKQUJT5RhxR3WtaAjPL3gAoOha9dPRhH6o2zlBdeg50g8EIVQgtt8RGqA==
```

The [immutable rc.1 release](https://github.com/Hadden-Industries/owlapi/releases/tag/v0.1.0-rc.1) permits independent downstream production acceptance and identifies source commit `59131be0c1dc3a634e8433b06d2949051c051c0a`.
This observation is not cache qualification and does not prove that a future Lambda runtime satisfies the package's Node patch-version requirements.

Before implementation, retain the exact coordinate, integrity, public export map, release/source identity, applicable engine versions, consumer locks, format metadata and resolved loader-policy fingerprints.
Verify the same package in an isolated installed-package Node consumer and the existing browser worker.
Do not require a moving npm tag to remain unchanged; qualification is bound to immutable package bytes.

### 2.2 Already available capabilities and later releases

Use the published public manager/source/configuration/error APIs, `OWLDocumentFormats`, manager-owned graph loading and closure queries, source/parser metadata and asynchronous `OWL2DLProfile` reports.
Storage/lifecycle APIs already available in the RC do not make reserialization part of this source cache.
Derived Functional Syntax or RDF/XML output, if later approved, has a separate namespace, digest and derivation provenance.

The assessment describes rc.2 as planning, and the registry check found no rc.2 artifact.
No slice relies on its proposed Java-parity work.
A later public version is adopted only by pinning its exact integrity in both runtimes, recomputing policy/validation identities, rerunning the same qualification matrix and revalidating retained bytes as necessary.
Existing bytes are not invalidated or redownloaded merely because their validation software changes.

A public byte-oriented `owlapi` source and a producer-owned policy fingerprint remain optional producer improvements.
Version 1 uses the existing public text source behind the strict decoding contract in §11.4 and an application-owned canonical policy fingerprint.
Do not claim a new release is required unless a concrete installed-package fixture demonstrates a missing required public capability.

### 2.3 Public package and consumer boundaries

The installed RC exports `.`, `apibinding`, `model`, `io`, `formats`, `profiles` and `util`.
Existing public specifiers include `owlapi/apibinding`, `owlapi/model`, `owlapi/io`, `owlapi/formats` and `owlapi/profiles` through the native alias.
The browser already receives exact bytes through `canonicalVowlSourceAcquisition` and passes them to `vowl/owl` in its worker.
Do not move manager construction into the UI or replace the canonical byte contract with a main-thread `StringDocumentSource` path.

Reject source-tree copies, `file:`, workspace, Git or linked runtime dependencies, private/deep imports, bundler aliases to implementation files and duplicate package versions.
The exact native npm alias to the public scoped artifact is explicitly allowed.
Use consumer-native schema/API validation rather than copying the package's parser or format grammar.

### 2.4 Configuration and external-state approval gate

This document is a proposed plan revision only.
Before changing configuration, present the exact file, setting, smallest diff and behavioural/pipeline impact for the repository owner's explicit approval.
This covers either repository's manifests/locks, `cdk.json`, `requirements.txt`, `app.py`, CDK modules, Lambda packaging, verification profiles, test/build/lint/hosting/CSP/deployment configuration and runtime endpoint configuration.

AWS resources, permissions, WAF actions, logging, budget controls, seed upload, catalog publication and production enablement require their own exact external-state approval.
Do all nonmutating preparation first so the approved proposal is concrete and reviewable.
Reuse already granted authority only for its exact scope; plan acceptance does not approve those effects.
Commits require explicit authority; pushing requires separate authority.

### 2.5 HISEW route, purpose and acceptance status

The supplied plan and assessment form the draft dossier being revised.
No retained accepted task/risk baseline was found in the current HISEW worktree state.
The IDs in §20 are therefore proposed traceability, not invented historical approvals.

The proposed implementation route is **R2**: public network and publication contracts, persistent generations, cross-system concurrency, privacy, financial controls and shared-distribution availability are material.
The repository owner accepts the baseline and assigns the infrastructure integration owner and production observer before implementation.
Required future lenses are semantic/package parity, SSRF/security/privacy, concurrency/publication, AWS operability/cost and licence/republication review; scoped native security assessment and independent assurance belong to implementation qualification.
This synthesis does not run a security scan or certify those gates.

The beneficiary remains a WebVOWL user opening public ontologies reliably.
Reassess whenever a proposed optimization changes parser meaning, source rights, consumer limits, site availability or the USD 10 operating target.
No locally faster cache result compensates for a different ontology or an unsafe outbound request.

---

## 3. Scope and non-scope

### 3.1 In scope

- Exact source-document mapping from an ontology/import IRI to a validated immutable artifact IRI.
- Curated migration of the last accepted historical WebVOWL ontology mappings and current approved `/ontology/external/` seed material.
- A browser loader that attempts catalog, direct HTTPS-capable retrieval, and then materialization in that order.
- Top-level IRI loading and transitive import loading through the same application-owned loader.
- Server-side bounded retrieval of public HTTP(S) representations that browsers cannot read because of CORS or mixed-content policy.
- Context-bound document validation, source-preservation qualification and managed closure/profile evidence through the exact public `owlapi` package, with consumer admission recorded separately.
- Content-addressed S3 storage, provenance, registry state, OASIS catalog projection, revalidation, and last-known-good behaviour.
- One existing pay-as-you-go CloudFront distribution, one new private S3 origin, and one protected Lambda Function URL control-plane origin.
- One narrowly scoped WAF rate-based rule, initially in count mode.
- Minimized access logging, operational metrics, private usage reports, cost projection, alerts, and a materialization kill switch.
- Takedown/quarantine and source-denylist operations.
- Local, installed-package, browser, CDK synthesis, integration, canary, rollout, and rollback verification.

### 3.2 Explicitly out of scope

- A general-purpose anonymous CORS proxy that returns arbitrary upstream bytes.
- HTML, images, scripts, archives, SPARQL endpoints, authenticated resources, cookies, or user-supplied request headers.
- Ontology consistency checking, satisfiability, entailment, reasoner execution or a requirement for an explicit `owl:Ontology` declaration.
  OWL 2 DL profile qualification is in scope for the route that claims it; it is not a proof of logical consistency.
- Closure collapse, `OWLOntologyMerger`, rewriting origin bytes through storer APIs, or a universal-ontology publication workflow.
  Bounded controlled import acquisition and root-specific closure qualification are in scope.
- Automatic alias creation from a parsed ontology IRI, version IRI, namespace, redirect target, `owl:sameAs`, or HTTP canonical link.
- Remote JSON-LD context retrieval or XML external-entity retrieval during validation.
- User accounts, API keys, per-user quotas, billing, or a paid service tier.
- A new CloudFront flat-rate plan, a new production distribution, or transfer of Route 53 management.
- Lambda response streaming, API Gateway, ElastiCache, RDS, OpenSearch, Kinesis, Firehose or a continuously running server.
  VPC/NAT or a controlled egress service is not assumed; §12.8 requires a costed security decision before deployment.
- A browser-to-DynamoDB lookup path or a Lambda invocation on catalog/artifact hits.
- A complete browser implementation of every OASIS catalog entry type.
  WebVOWL consumes the exact safe profile generated by this service: `uri`, `nextCatalog`, `xml:base`, and foreign-namespace metadata.
  The published files themselves remain OASIS XML Catalogs 1.1 conformant.
- Service-worker, IndexedDB, or localStorage persistence for the catalog.
  Browser HTTP caching and one in-memory resolution map are sufficient initially.
- New TypeScript source or declarations.
  Both repositories retain their accepted JavaScript/Python technology choices unless separately approved.

---

## 4. Domain language and naming registry

| Term / field                                      | Exact meaning                                                                                                                                                         |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Requested document IRI / `requestedDocumentIri`   | The exact accepted logical IRI supplied to acquisition; the source/catalog key, retained independently of transport serialization.                                    |
| Retrieval IRI / `retrievalIri`                    | The parsed HTTP(S) request target, with any browser HTTPS upgrade and fragment removal performed only for transport.                                                  |
| Effective retrieval IRI / `effectiveRetrievalIri` | The final upstream origin IRI after validated redirects, never the cache object URL.                                                                                  |
| Parser document IRI / `parserDocumentIri`         | The explicit source context passed to `owlapi` for relative-reference resolution. The direct and cached paths use the same context-selection policy.                  |
| Artifact IRI / `artifactIri`                      | The immutable CloudFront location of published representation bytes; it is not a parser base.                                                                         |
| Ontology/version IRI                              | An identifier declared by the ontology, retained as metadata and never inferred as a dynamic alias.                                                                   |
| Source key / `sourceKey`                          | Lowercase SHA-256 of the exact accepted requested IRI's UTF-8 bytes. It is not a byte digest or secret.                                                               |
| Materialization ID / `materializationId`          | Version 1's public request/status identifier, equal to `sourceKey`; source generation still fences each job.                                                          |
| Artifact digest / `artifactSha256`                | SHA-256 of the exact representation bytes after HTTP content decoding and before character decoding.                                                                  |
| Validation identity / `validationIdentity`        | Digest of the canonical tuple of bytes, parser context, public format identity, package version/integrity, loader-policy fingerprint and validation-contract version. |
| Resolution identity / `resolutionIdentity`        | Digest of an immutable source-generation binding to an artifact, parser/format context and its validation evidence.                                                   |
| Closure digest / `closureDigest`                  | Digest of a root identity, exact member validation identities, resolved direct-import edges and qualification policy; not a merged ontology digest.                   |
| Loader profile / `loaderProfileFingerprint`       | Digest of canonical, fully resolved stage-specific parser/decoder/limit/format policy. Document and closure modes are distinguished.                                  |
| Catalog generation / `catalogGenerationSha256`    | Digest of the deterministic committed mapping model, including evidence bindings; generated XML/optional JSON have their own verified object checksums.               |
| Publication                                       | Making a committed document mapping or qualification manifest discoverable. It never implies every source sharing the same bytes has passed validation.               |
| Last-known-good                                   | A previously published source binding whose retention remains allowed by the republication policy; refresh failure alone does not replace it.                         |

### 4.1 Identity and transport contract

`identifyOntologySource` validates a string of at most 4,096 UTF-8 bytes through the public IRI contract and the platform URL parser.
Reject malformed Unicode, user-info, unsupported schemes/ports, forbidden hosts and ambiguous transport forms rather than repairing them.
Preserve the accepted logical string for `requestedDocumentIri`, exact catalog lookup and `sourceKey`.
Do not use `URL.href` as the registry identity, sort query parameters, equate HTTP and HTTPS, fold path case, normalize Unicode, or infer equality from percent-encoding or a trailing slash.

Keep a separately serialized retrieval URL for WHATWG URL/IDNA processing and removal of the fragment at the HTTP boundary.
Two logical source keys may intentionally reach the same transport URL; that permits byte deduplication, not identity or validation-record merging.
Shared fixtures prove exact Node/browser identity agreement and cover IDN, Unicode, escaped/unescaped path segments, query order, default ports and fragments.
[RFC 3986](https://www.rfc-editor.org/rfc/rfc3986.html#section-6.2) distinguishes syntax normalization from broader resource equivalence; this plan chooses conservative exact identity.

### 4.2 Parser context and validation identity

The current direct remote acquisition returns the final origin `response.url` as `documentIri`.
The initial cache policy preserves that behaviour: absent a separately explicit source-context override, `parserDocumentIri` is the effective upstream origin IRI selected by the same upgrade/redirect policy.
An explicit local/caller document base is retained under its existing consumer contract.
The requested logical IRI is always retained separately.
Do not unconditionally substitute the requested IRI for an established redirect-derived base, and never use the CloudFront response URL as a base.
Authored syntax-level base declarations are still interpreted by the owning parser.

The validation identity is a domain-separated SHA-256 of a deterministic canonical record containing:

```text
artifactSha256, parserDocumentIri, formatId,
owlapiPackageName, owlapiPackageVersion, owlapiPackageIntegrity,
loaderProfileFingerprint, validationContractVersion
```

Use an unambiguous canonical JSON serialization with fixed schema, encoding and field treatment; not string concatenation with an informal delimiter.
Retain the canonical policy bytes alongside their hash.
The fingerprint includes resolved defaults, decoding, source-context selection, stage, format metadata, resource ceilings and profile mode; timestamps, signals and invocation IDs are excluded.
Same bytes under two parser bases must produce distinct validation identities and may produce different relative IRIs.

---

## 5. Current-state migration anchors

These paths were inspected at WebVOWL `0fbf00e` on 5 October 2026.
They replace the retired converter file map; recheck them at implementation start rather than recreating historical owners.

| Existing owner                                                                                                     | Responsibility and planned seam                                                                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/js/controller/canonicalVowlSourceAcquisition.js`                                                          | Owns exact bounded bytes, public format selection and root/import acquisition. Inject cache resolution here; preserve the worker's `{ bytes, documentIri, mediaType }` contract.                                                       |
| `src/app/js/controller/importResolver.js`                                                                          | Current `WebVowlImportResolver.loadBytes` performs controlled browser fetch and returns redirect context. Refactor its identity/retrieval distinction behind the acquisition owner; retire only superseded paths after consumer proof. |
| `src/app/js/controller/canonicalVowlDocumentSession.js`                                                            | Owns session cancellation, worker admission, source/export ownership and stale-result handling. Cache work participates in the same session lifecycle.                                                                                 |
| `src/app/js/controller/canonicalVowlWorkerClient.js`, `canonicalVowlWorker.js`, `canonicalVowlWorkerOperations.js` | Own worker messages and `vowl/owl` operations; preserve deadlines and model authority.                                                                                                                                                 |
| `src/app/js/canonicalApplication.js`, `src/canonical-main.js`                                                      | Current application composition and bootstrap; inject the acquisition dependency and approved bypass/configuration here.                                                                                                               |
| `src/app/js/loadingModule.js`, `ontologyLifecycle.js`                                                              | Existing UI/lifecycle consumers; change only the integration needed for canonical acquisition and status.                                                                                                                              |
| `packages/vowl/src/owl/loading.js`, `policy.js`, `compatibleLoading.js`                                            | Consumer-owned format, fatal UTF-8, managed-closure and source/profile behaviour. These are contract evidence, not permission to fork or alter the canonical mapper for the cache.                                                     |
| `packages/vowl/conformance/storage.mjs`, `packages/vowl/test/independentCorpus.js`                                 | Logical corpus/member readers and frozen pins; reuse them instead of copying the pre-consolidation fixture tree.                                                                                                                       |
| `src/shared/js/util/resolveFetchUrl.js`                                                                            | Retain unrelated retrieval behaviour; do not route canonical JSON or generic URLs into ontology materialization.                                                                                                                       |

The old `src/owl2vowl/js` converter/constants/resolver and local `src/owlapi-js` trees are retired.
There is no future task to edit or delete those absent files.
The current canonical resolver is a different, live owner and must not be deleted by a stale path/symbol checklist.

The `amazon-aws` stack, ontology rewrite function and whole-distribution cost cutoff remain historical infrastructure anchors from the original plan.
SLICE-001 must inspect their current owners, logical IDs and live settings read-only before an exact configuration proposal; this revision does not claim fresh AWS inventory.

### 5.1 Seed baseline

Recover the last accepted historical `ONTOLOGY_CATALOG` and its provenance without restoring it into production source.
Reconcile every former logical mapping, referenced `/ontology/external/` object and separately approved extra seed against a fresh read-only inventory.
Record exact requested/retrieval/parser IRIs, byte digest, rights, parser metadata, validation identity and curated aliases.
Unreferenced objects, missing sources, duplicate bytes, changed redirects and unsupported encodings require individual dispositions.
Dynamic entries cannot override seed names.
The importer distinguishes inventory, locally validated staging and approved publication; none is evidence of the next stage.

---

## 6. Target architecture

### 6.1 Observable acquisition path

```text
canonical document/import session
  → application source acquisition
      → session/catalog binding → CloudFront/private S3
      → controlled direct origin retrieval
      → materialization API → DynamoDB/SQS → controlled worker retrieval
                                                → private staging + document validation
                                                → immutable artifact/evidence + source commit
                                                → generated catalog publication
  → exact bounded bytes + origin parser context + public format metadata
  → worker-owned vowl/owl and public owlapi managed document graph
  → source/closure profile assessment and consumer admission
  → canonical model/projection under existing resource policy
```

Byte retrieval changes location; it does not change source semantics, import identity, parser policy or projection rules.
The closure qualifier reuses the same controlled acquisition interface and public manager graph; it does not become a generic proxy or an alternative ontology implementation.

### 6.2 Plane and owner boundaries

| Plane                  | Owner and invariant                                                                                                                                                |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Data                   | CloudFront/private S3 serves immutable byte objects, resolution records, validation/closure evidence and catalog generations without Lambda/DynamoDB/SQS on hits.  |
| Browser acquisition    | One session-scoped acquisition owner supplies bytes/context to root and import consumers, with cancellation and aggregate limits.                                  |
| Control                | API, registry, queues and worker own bounded admission, retrieval, validation and conditional promotion; Lambda returns small state/error/redirect responses only. |
| Semantic qualification | The installed `owlapi` owns parsing/managed closure/profile APIs; the `vowl` consumer owns canonical/compatible admission.                                         |
| Operations             | Minimized logs, metrics, reports, quarantine, refresh, cost and rollback controls operate asynchronously.                                                          |

### 6.3 Deep module seams

Use four cohesive seams: byte acquisition with explicit source context, the materialization HTTP contract, a registry that owns transitions rather than raw table operations, and a deterministic catalog/evidence projection.
Clock, DNS/connector, Fetch and AWS clients are genuine external test boundaries.
Do not mock `owlapi`, duplicate its grammar or introduce an interface for every internal helper.

### 6.4 Catalog scale

The initial OASIS profile remains capped at 25,000 entries and 8 MiB across followed catalogs.
Measure acquisition/parsing at 1,000, 10,000 and 25,000 entries; target p95 ≤100 ms and no main-thread task >250 ms on the accepted benchmark.
A compact JSON index is a conditional optimization when those measurements justify it.
It is generated from the same committed mapping model and generation, has no independent edit path, and must match OASIS resolution exactly.
Do not replace static reads with a browser-to-DynamoDB lookup.

---

## 7. End-to-end resolution semantics

### 7.1 Catalog hit

1. Retain `requestedDocumentIri` and perform exact lookup in the session map or bounded seed-first catalog.
2. Load the entry's immutable resolution record and verify its source key, artifact digest, parser context, public format identity, validation identity and policy compatibility.
3. Fetch the immutable artifact with omitted credentials, cancellation and the same byte/aggregate limits as direct acquisition; verify its SHA-256 over content-decoded bytes.
4. Return exact bytes and the recorded origin `parserDocumentIri`/media type to the canonical acquisition owner.
   Never infer syntax or base from the digest path or its `application/octet-stream` header.
5. Run ordinary worker-owned package admission.
   A server qualification is evidence, not a bypass of browser limits or semantic checks.

No control-plane call occurs on a complete catalog hit.
A corrupt, incompatible or incomplete binding is not usable cache evidence; report a sanitized cache diagnostic and follow the controlled direct path, without accepting mismatched bytes.

### 7.2 Direct success

Use the existing HTTPS-capable direct policy with `credentials: "omit"`, bounded exact bytes and the caller's signal.
Align direct and worker Accept negotiation to the same metadata-derived request policy and record its exact values; characterize the current browser's implicit Accept behaviour before changing it.
Different negotiated representations are not a semantic-equivalence pass merely because they share a requested IRI.
Preserve requested, initial retrieval and effective origin IRIs separately and select parser context as §4.2 requires.
Public format metadata selects an exact format or requests an explicit user choice before worker admission; ambiguity is not permission to guess.
Readable HTTP errors, parsing failures, unsupported encodings, security/resource limits and cancellation are typed outcomes, not materialization triggers.
Directly readable documents are not automatically mirrored in version 1.

### 7.3 Materialization fallback and first caller

Fallback is allowed only when direct browser acquisition cannot produce a readable response because of network/CORS/mixed-content restrictions.
Do not claim every Fetch rejection proves CORS.
Serialize the narrow submission once, hash its exact UTF-8 bytes for `x-amz-content-sha256`, and submit without credentials.
Pending requests return 202 with `Location` and `Retry-After`.
Poll one request at a time using cancellable recursive delays: valid `Retry-After`, otherwise 1/2/4/8 seconds with ±20% jitter and an 8-second ceiling, within a 60-second total client budget.
Limit concurrent submissions to four and coalesce identical session requests without leaking one caller's cancellation into another caller's retained work.

Once a source binding is committed, 303 redirects to its immutable artifact with `source` and `binding` digest tokens.
Fetch may follow automatically; the final service URL supplies the immutable binding identity, whose S3 resolution record supplies parser context and format.
The first caller verifies that record and the bytes before worker admission, then remembers the complete binding in its session.
It need not wait for catalog propagation.
Do not rely on reading an intermediate redirect's headers or on a mutable source-provenance document that could race a refresh.

### 7.4 Document and closure qualification

Every imported document follows the same acquisition contract and retains its own parser context.
An isolated parse can establish `DOCUMENT_VALIDATED` while imports are unresolved.
Closure qualification uses `loadOntologyGraphFromOntologyDocument`, public managed graph queries and an `OWL2DLProfile` instance's `checkOntology` method under the pinned closure policy.
Cycles, shared imports and diamonds remain a graph of separate documents.
Record requested direct-import edges and their resolved member validation identities, not just an unordered bag of byte digests.

Missing imports, unsupported source evidence, incomplete checks, profile violations and consumer resource rejection remain distinct outcomes.
Only a complete accepted report can claim `CLOSURE_VALIDATED` for its named profile.
Document mappings may be published before closure qualification; their evidence explicitly says `DOCUMENT_VALIDATED` and makes no OWL 2 DL or consumer-admission claim.
The canonical structural route requires its full source/closure checks.
The existing compatible view route may retain qualified diagnostics; this cache must neither relabel that as OWL 2 DL success nor silently tighten the direct-path admission contract.

Server closure qualification is resumable and separately budgeted: resolve missing members through ordinary quota-controlled document jobs, persist the exact member/edge manifest, and replay the manager with only pinned locally available bytes.
Do not hold a document worker while serially downloading a maximum-size closure or assume the 60-second document-job budget covers unbounded closure work.
An incomplete closure never blocks publication of an otherwise eligible document or disables its previous complete binding.

### 7.5 Refresh and last-known-good

The 30-day schedule is a default source check interval, not permission to ignore response caching/republication restrictions.
Persist validators, selected request headers, `Vary`, cache directives, status, effective URI and acquisition time.
Prefer `If-None-Match`; use `If-Modified-Since` where appropriate for the same selected representation.
A 304 is acceptable only with a matching stored source variant and durable byte object; update permitted metadata and freshness without pretending a new parse occurred.
If software, decoder, parser base, format or profile changed, revalidate retained bytes under a new identity even after a 304.

A 200 computes a new digest and validation identity; unchanged bytes may reuse evidence only when the entire validation tuple matches.
Changed `Vary`, format hints, effective parser context or restrictions require a new binding/disposition.
Never forward validators learned from an unrelated resource or across a changed redirect target without establishing representation identity.
Missing backing bytes, inconsistent validators or ambiguous 304 metadata trigger a bounded unconditional retry or typed failure, not fabricated success.

Transient retrieval/validation failures preserve an eligible last-known-good binding.
New `private`/`no-store`, loss of durable republication eligibility, quarantine or takedown removes future mappings and enters the containment process; it is not an ordinary stale fallback.
Old immutable edge/browser copies cannot be recalled by updating a catalog.
Record that limitation and obtain incident-specific invalidation/object-access action when required.

---

## 8. Public HTTP contract

### 8.1 Stable paths

| Method and path                                                                                   | Owner                                | Cache policy                     | Purpose                                        |
| ------------------------------------------------------------------------------------------------- | ------------------------------------ | -------------------------------- | ---------------------------------------------- |
| `POST /ontology/materializations`                                                                 | API Lambda                           | Disabled; `no-store`             | Submit or resume exact-source materialization. |
| `GET /ontology/materializations/{materializationId}`                                              | API Lambda                           | Disabled; `no-store`             | Observe pending/rejected/ready state.          |
| `OPTIONS /ontology/materializations` and `OPTIONS /ontology/materializations/{materializationId}` | API Lambda / response headers policy | Disabled                         | CORS preflight.                                |
| `GET\|HEAD /ontology/cache/artifacts/sha256/{artifactSha256}`                                     | Artifact S3 origin                   | One year immutable               | Fetch validated representation bytes.          |
| `GET\|HEAD /ontology/cache/provenance/sources/{sourceKey}.json`                                   | Artifact S3 origin                   | Five minutes; validators         | Inspect public source/provenance metadata.     |
| `GET\|HEAD /ontology/catalog-v001.xml`                                                            | Artifact S3 origin                   | Five minutes plus stale controls | Stable OASIS catalog root.                     |
| `GET\|HEAD /ontology/catalogs/seed/v1/catalog-v001.xml`                                           | Artifact S3 origin                   | One year immutable               | Curated seed catalog generation.               |
| `GET\|HEAD /ontology/catalogs/dynamic/sha256/{catalogGenerationSha256}/catalog-v001.xml`          | Artifact S3 origin                   | One year immutable               | Dynamic exact-source mapping generation.       |

Artifact, source, resolution, validation and closure digests are exactly 64 lowercase ASCII hexadecimal characters.
Add GET/HEAD paths under `/ontology/cache/`: `resolutions/sha256/{resolutionIdentity}.json`, `validations/sha256/{validationIdentity}.json` and `closures/sha256/{closureDigest}.json`, served by S3 with immutable policies.
The mutable source-provenance view uses a five-minute revalidated policy; it is never the parser-context authority for an older artifact.
Path decoding, extra segments, encoded slashes, dot segments, upper-case digests, or unexpected suffixes fail closed.

### 8.2 Submission request

The version 1 body is intentionally narrow:

```json
{
  "requestedDocumentIri": "http://example.org/ontology"
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
Location: https://haddenindustries.com/ontology/cache/artifacts/sha256/64-hex-characters?source=64-hex-characters&binding=64-hex-characters
```

The redirect target is built only from validated registry fields.
A caller cannot provide it.
Fetch follows the redirect to the S3/CloudFront data plane, so Lambda returns no ontology body.
The final URL retains the `binding` digest; the client fetches its immutable resolution record and validates context, format, profile and byte identity before admission.
READY means a durable document binding is available; catalog publication and closure qualification may still be pending.

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

Messages are bounded and never echo the source IRI, upstream body, response headers, parser excerpt, stack trace, IP address, or AWS identifier.
Machine clients use `code`, never message matching.
Preserve separate bounded decoding/unsupported-encoding, ambiguous-format, source-assessment, incomplete-closure, profile and consumer-resource outcomes; a consumer-limit failure must not be reported as `ONTOLOGY_DOCUMENT_INVALID`.
Only document-materialization failures appear on this API; closure/consumer results live in their own qualification/session evidence.
The document taxonomy also includes `SOURCE_ENCODING_UNSUPPORTED`, `SOURCE_DECODING_FAILED` and `ONTOLOGY_FORMAT_AMBIGUOUS` as 422 outcomes, with no automatic client retry and the same bounded 24-hour suppression as document rejection.
Retain package resource/deadline failures as limit/timeout outcomes rather than relabeling them syntax-invalid.

| HTTP status | Stable code                                                              | Meaning / retry policy                                                                                                                                              |
| ----------: | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|         400 | `REQUEST_SCHEMA_INVALID`, `SOURCE_IRI_INVALID`                           | Malformed request or IRI; no automatic retry.                                                                                                                       |
|         403 | `SOURCE_IRI_FORBIDDEN`, `MATERIALIZATION_DISABLED`, `SOURCE_QUARANTINED` | Policy/kill-switch rejection; no client retry until policy changes.                                                                                                 |
|         405 | `METHOD_NOT_ALLOWED`                                                     | CloudFront allowed the method but the API contract does not.                                                                                                        |
|         410 | `MATERIALIZATION_NOT_AVAILABLE`                                          | Well-formed status ID has no retained registry state; resubmit the source rather than polling. This avoids the distribution’s current custom-404 caching behaviour. |
|         413 | `SOURCE_REPRESENTATION_TOO_LARGE`                                        | Declared or observed representation exceeds 33,554,432 bytes; suppress retries for seven days.                                                                      |
|         422 | `ONTOLOGY_DOCUMENT_INVALID`                                              | `owlapi` rejected the representation; suppress retries for 24 hours.                                                                                                |
|         429 | `SOURCE_SUBMISSION_RATE_EXCEEDED`, `DAILY_NEW_SOURCE_QUOTA_EXCEEDED`     | Honor `Retry-After`; do not spin.                                                                                                                                   |
|         502 | `UPSTREAM_RESPONSE_REJECTED`, `UPSTREAM_NETWORK_FAILURE`                 | Upstream response could not be materialized; suppress retry for 15 minutes, or one hour for stable 4xx source responses.                                            |
|         504 | `UPSTREAM_TIMEOUT`                                                       | Retrieval/validation exceeded its finite budget; suppress retry for 15 minutes.                                                                                     |

### 8.6 CORS and response headers

All endpoints are public and credential-free.
Use two response-header policies rather than advertising methods a resource does not support:

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
  x-amz-meta-artifact-sha256
```

Context-specific validation/profile claims are available only from the immutable resolution/evidence records, not artifact response headers.
No response sends `Access-Control-Allow-Credentials`.
Browser requests always use `credentials: "omit"`.
With wildcard origin and no credentials, no origin-reflecting code or `Vary: Origin` cache fragmentation is needed.

CloudFront response-headers policies are the sole production owner of these CORS/security fields. Disable Function URL CORS configuration and do not duplicate those headers in Lambda responses; duplicated `Access-Control-Allow-Origin` values can make an otherwise valid browser response fail. The dedicated S3 bucket has the matching credential-free GET/HEAD CORS rule so an OPTIONS request reaching the origin is answered consistently.

Artifact/catalog responses also use a restrictive response CSP suitable for non-HTML data, such as `default-src 'none'; sandbox`, after real-browser verification confirms that it does not interfere with Fetch consumption.

---

## 9. Registry and state-machine contract

### 9.1 Separate records and immutable identities

Retain DynamoDB Standard on-demand capacity, point-in-time recovery, deletion protection, AWS-owned encryption and string partition key `registryKey`.
Start without a speculative GSI; bounded scans and point operations must be measured before proposing indexes.
The record families are:

| Record key                        | Owned fields and invariant                                                                                                                                                                                                                                                     |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `SOURCE#{sourceKey}`              | Exact requested IRI; retrieval/effective IRIs; generation; acquisition state; active/previous resolution identities; origin validators/cache/variation metadata; next refresh; lease/fencing token; attempts; curation; quarantine. Mutable control state, not semantic proof. |
| `VALIDATION#{validationIdentity}` | Byte digest, parser IRI, public format/parser metadata, exact package/integrity, canonical loader policy/fingerprint, validation-contract version, document result, source-preservation qualification, bounded diagnostics and validated time. Immutable contextual evidence.  |
| `RESOLUTION#{resolutionIdentity}` | Source key/generation, artifact and validation identities, parser/format context and acquisition/republication provenance. An immutable binding safe for old and new readers during refresh.                                                                                   |
| `CLOSURE#{closureDigest}`         | Root validation identity, every member identity, resolved direct-import edges, profile/policy, report digest, completion/source assessment and qualification time. Consumer admission is separately identified.                                                                |
| `CONTROL#SERVICE`                 | Materialization/refresh/closure enablement, approved quotas and monotonic policy revision.                                                                                                                                                                                     |
| `QUOTA#UTC#YYYY-MM-DD`            | Newly admitted source keys and bounded closure/revalidation work counters; polling and idempotent submissions do not increment new-source quota.                                                                                                                               |
| `CATALOG#CURRENT`                 | Desired/committed projection revision, immutable generation/model digest, object checksums and root ETag.                                                                                                                                                                      |

Large bounded closure/report bodies belong in private S3 evidence with digest references; do not assume a graph manifest fits DynamoDB's item limit.
Publish only a bounded sanitized qualification summary at the public closure path; its full retained report has a separate private digest reference when disclosure/size policy requires it.
An existing validation identity is immutable: verify the same canonical inputs and outcome before reuse, retain repeated-attempt timestamps separately, and treat contradictory results as an invariant failure rather than overwriting evidence.
Emit optional fields only when known.
Never persist raw parser excerpts or source bodies in table/log diagnostics.
`schemaVersion`, `validationContractVersion`, readable `validationProfileId` and cryptographic `loaderProfileFingerprint` have distinct roles.

### 9.2 State dimensions

These are related dimensions, not one misleading linear state enum:

| Dimension          | States and meaning                                                                                                                                                                |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Acquisition        | `PENDING → FETCHED`; refresh may be `REVALIDATING`, with typed transient/terminal failure and retry windows. `FETCHED` means bytes exist privately, not that they may be served.  |
| Document evidence  | `UNVALIDATED → DOCUMENT_VALIDATED` or a typed rejection/incomplete result for the exact validation identity. Parsing alone does not prove source preservation or imports closure. |
| Closure evidence   | `UNASSESSED / INCOMPLETE / REJECTED / CLOSURE_VALIDATED`, rooted in exact member/edge and profile identities. It cannot be promoted by a document-only job.                       |
| Publication        | `UNPUBLISHED → PUBLISHED` only after durable accepted document binding and catalog generation/root publication. A document publication need not have a closure-qualified claim.   |
| Freshness/access   | `CURRENT / REVALIDATING / STALE / QUARANTINED`; last-known-good is a separately retained active binding, never an overwritten artifact.                                           |
| Consumer admission | `NOT_EVALUATED / ADMITTED / REJECTED / INCOMPLETE` with consumer version/policy and reason, independent of ontology validity.                                                     |

The public API may use `READY` as a transport disposition once a durable eligible resolution/artifact exists, before catalog propagation.
It is not a synonym for `CLOSURE_VALIDATED` or `PUBLISHED` and is not a Boolean validity field.
Quarantine fences jobs and removes future publication eligibility for that source even if its shared bytes are valid elsewhere.
Negative results are keyed to the attempted generation/policy; no negative result overwrites a previous admissible binding.

### 9.3 Fenced leases, outbox and at-least-once work

Submission atomically admits a source generation, increments quota only when appropriate and records enqueue intent.
SQS send is outside the DynamoDB transaction; an outbox/reconciler retries unsent intent so a crash after admission cannot lose work.
Messages carry source key, generation, policy revision and work kind, never caller credentials or arbitrary parser options.

Before network work, acquire a conditional lease with unique owner and monotonic fencing token for the exact generation.
The initial document lease is 90 seconds; renew only while the invocation has safe remaining time.
Every promotion checks expected generation, token, unexpired lease, policy and non-quarantined state.
A late/reordered worker can leave an orphan object but cannot replace a newer binding.
Duplicates observe durable state or an active lease without performing another fetch; recovery does not depend on that duplicate message surviving.

Use a 60-second document worker timeout, SQS visibility at least six times that timeout, batch size one, partial batch response, reserved/event-source concurrency two and a 14-day DLQ.
Reconcile expired leases and unsent publication events; cap document attempts at three per cycle.
Closure jobs have independently bounded deadlines/attempts/concurrency and share admission, cost and kill-switch controls.
Bounded durable checkpoints preserve completed member identities across interruption; no attempt resumes a stale source generation blindly.

### 9.4 Publication commit point and recovery

The order is:

```text
admit generation + enqueue intent
  → lease → controlled retrieve → digest → immutable private staging
  → document validation → optional separately identified closure qualification
  → checksum-verified immutable public artifact + immutable evidence/binding
  → conditional source-generation commit + durable catalog-dirty intent
  → immutable complete catalog generation → compare-and-swap stable root
```

The public artifact namespace receives only document-validated bytes; staging is excluded from CloudFront permissions.
A context's invalid result cannot become valid merely because identical bytes were published under another context.
Catalog publication reads committed bindings and verifies every referenced object/record.
It records a stable desired revision before projection, rechecks that revision before root CAS, and serializes publisher ownership.
When the registry/root stores cannot change atomically, reconcile by reading both revisions and the root ETag after any interruption; never claim atomicity across DynamoDB and S3.
Quarantine racing a projection invalidates its desired revision and requires republishing; emergency access containment remains a separate incident action.

Inject failure after every boundary, including SQS send, private/final object put, evidence write, source commit, dirty intent, generation put and root update.
Recovery must expose old-complete or new-complete bindings, never a missing object, mismatched parser context or unqualified claim.
DynamoDB TTL is cleanup only, never a correctness mechanism.
Orphan cleanup is reference-aware and separately approved; retain old generations/evidence through rollback and incident retention windows.

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
- an OAC-scoped read policy restricted to published artifact/evidence/catalog prefixes for the existing distribution, excluding private staging and internal evidence.

The worker role can write its staging/artifact/evidence/provenance prefixes and read only the exact objects needed for validation and reconciliation.
The catalog publisher can read registry state and write only catalog prefixes.
Neither role can change the bucket policy, CloudFront distribution, WAF, or unrelated static assets.

### 10.2 Key layout

```text
ontology/private-staging/sha256/{artifactSha256}
ontology/cache/artifacts/sha256/{artifactSha256}
ontology/cache/resolutions/sha256/{resolutionIdentity}.json
ontology/cache/validations/sha256/{validationIdentity}.json
ontology/cache/closures/sha256/{closureDigest}.json
ontology/cache/provenance/sources/{sourceKey}.json
ontology/catalog-v001.xml
ontology/catalogs/seed/v1/catalog-v001.xml
ontology/catalogs/dynamic/sha256/{catalogGenerationSha256}/catalog-v001.xml
```

The staging prefix and unsanitized internal evidence are private to narrowly scoped worker roles and have no CloudFront read grant or behaviour.
Approved expiry of unreferenced staging follows the maximum recovery window; lifecycle cleanup cannot remove active inputs.
Public evidence is bounded, sanitized and free of viewer/request information.
No source filename is used as an object key.

### 10.3 Byte object and publication write contract

1. Retrieve once under §12, bound encoded and content-decoded streams, and hash exact content-decoded bytes before character decoding.
2. Conditionally put private staging using `If-None-Match: *` and S3 SHA-256 checksum metadata.
   Record `FETCHED` only after integrity verification.
3. Select format and decode under the pinned policy; validate the same bytes/context through public `owlapi`.
   A failed context remains unpublished even on a global byte-dedup hit.
4. Conditionally write the accepted exact bytes to the final artifact key and verify checksum/length.
   A precondition failure is deduplication, not permission to overwrite; missing or inconsistent checksum fails closed.
5. Persist immutable validation and resolution records before conditionally promoting the source generation.
   The publisher exposes only that durable state.

S3 ETag is a validator, not a content SHA-256.
Store only context-independent facts on a shared byte object: digest, length, checksum and neutral delivery metadata.
Use `application/octet-stream`, no origin `Content-Encoding` after decoding, and the immutable lifetime for the admitted public artifact.
Origin content type/encoding, format, timestamps, source IRI, validation/profile and republication policy live in per-acquisition/per-validation records, not semantic headers on the byte object.
Do not let the first source to upload shared bytes determine another source's parser selection or validation claim.

Canonical source export retains the acquired bytes.
Any separately approved derived serialization uses a distinct derived-artifact namespace, own digest and a link to exact source/validation inputs; it never replaces source bytes.

### 10.4 Source-specific resolution and provenance

An immutable resolution record contains source key/generation, requested/retrieval/effective/parser IRIs, artifact IRI/digest/length, public format identity, original content type/encoding, decoding policy, validation identity and exact loader/package/contract identity.
It also records acquisition time/status, request-variant fingerprint, validators/republication disposition, source-preservation result and optional qualified closure identity.
Its own `resolutionIdentity` binds all those fields.

The mutable source-provenance document is a short-lived discoverability view, not the authoritative context for an artifact fetched from an older catalog.
Link exact immutable resolution/validation/closure records from it, with curation, freshness, declared ontology/version identifiers and corresponding-source revision.
Every catalog entry and READY redirect identifies an immutable resolution record, so refresh cannot race the client's parser metadata.
A server qualification never authorizes skipping the local consumer's checks.

Requested/effective IRIs are intentional public provenance for eligible public sources.
Reject credential-bearing/session-dependent sources under the publication policy; never leak their query strings via rejection logs.
Known secrets, raw parser text, viewer identifiers, headers and private evidence never enter public records.

### 10.5 OASIS model and publication

Retain OASIS XML Catalogs 1.1 with exact `uri` mappings, bounded `nextCatalog`, `group` and `xml:base` usage, and seed-before-dynamic resolution.
The stable root points to immutable seed/dynamic generations.
Each mapping's target has this shape, with all parameters validated as lowercase SHA-256 digests:

```text
https://haddenindustries.com/ontology/cache/artifacts/sha256/{artifactSha256}?source={sourceKey}&binding={resolutionIdentity}
```

The query identifies resolution evidence for consumers and does not affect artifact bytes, cache keys or S3 requests.
Foreign-namespace metadata may carry the same binding/profile identifiers where OASIS permits it; ordinary resolvers still obtain the byte object.
Browser consumers require the context-bearing resolution record and do not treat XML URI mapping alone as semantic qualification.
An independent OASIS consumer validates standards conformance; browser-specific metadata never becomes a nonstandard replacement grammar.

Build one deterministic committed model sorted by exact requested IRI, with verified artifact, resolution, validation and any claimed closure identities.
Never infer names from ontology/version/redirect identifiers or let dynamic entries override curated seeds.
Use UTF-8/LF, deterministic XML serialization and escaping, no DTD and no timestamps in immutable mapping content.
If JSON is justified by measurement, emit it from this same model, with the same generation and exact lookup/precedence semantics.
Neither representation is independently editable.

Put and checksum-verify the complete immutable generation and every referenced object before a conditional stable-root update using its last observed ETag.
Conflicts cause bounded read/recompute/retry; stale projection events cannot roll the root back.
Verify root readback, XML/optional JSON parity and representative resolutions through S3 and CloudFront after propagation.
Short-lived mutable roots/provenance carry validators; immutable evidence and generation paths can use long lifetimes.

### 10.6 Browser catalog safety profile

`OasisXmlOntologyCatalog` accepts only service-owned HTTPS catalogs and enforces:

- OASIS namespace and one `catalog` document element;
- `uri`, `nextCatalog`, `group`, and `xml:base` only as needed by generated files;
- at most four `nextCatalog` levels, eight catalog files, 25,000 mappings, and 8 MiB aggregate XML;
- same-origin HTTPS `nextCatalog` targets restricted to `/ontology/catalogs/`;
- cycle detection by absolute catalog IRI;
- exact-name lookup and first-match OASIS ordering;
- a structured diagnostic for duplicate names; a conflicting duplicate fails the catalog acquisition rather than picking nondeterministically;
- no DTD, external entity, stylesheet, XInclude, script, or foreign network retrieval;
- abort propagation through every catalog fetch; and
- validated binding digests and matching immutable context evidence before browser parser admission.

Catalog failure is degradable: the loader continues to direct retrieval and materialization.
A malformed catalog must not make all ontology loading fail.

---

## 11. Ontology validation contract

### 11.1 Claims and their proof

`DOCUMENT_VALIDATED` means the admitted exact byte representation has been decoded and parsed under its context-bound document policy, with exact original bytes retained and source-preservation qualification/diagnostics recorded.
It does not claim that every original source construct was represented losslessly, that imports resolved, or that the closure is OWL 2 DL.
Keep a successful parse, source assessment `valid`/`invalid`/`unverified`, profile result and consumer admission as separate fields.
If the owning API cannot establish a requested preservation claim, record it as unverified; do not infer it from parser metadata or the ability to serialize an ontology.

`CLOSURE_VALIDATED` requires complete managed import resolution and a complete passing public profile/source report for the named qualification policy over all exact members/edges.
Unverified checks cannot be converted into a pass by dropping diagnostics.
`PUBLISHED` means the corresponding durable mapping/evidence was exposed in a catalog; it says which validation level is asserted.
No state claims consistency, satisfiability, entailment, freshness forever or publisher endorsement.

### 11.2 Versioned loader policies

Freeze canonical resolved policy JSON and a fingerprint for each stage.
Use the same exact stage policy in Node and browser parity tests; do not pretend document-only and closure jobs have identical `remoteImports` settings.

| Policy                       | Required semantics                                                                                                                                                                                                                                                                               |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `webvowl-source-document-v1` | Exact source retention and a fresh public manager/source with exact format. Use the selected public parsing mode, record it and its diagnostics, disable import retrieval and remote JSON-LD contexts, deny external XML resources. Imports remain declarations and incomplete closure evidence. |
| `webvowl-managed-closure-v1` | The selected canonical/compatible consumer mode, managed graph loading and public asynchronous source/profile report. `remoteImports: true` permits calls to the supplied document loader; no ambient fetcher is installed. Remote contexts/external entities remain denied.                     |
| Consumer admission           | The existing `vowl` package version, operation/profile and bounded work policy. Record separately from ontology qualification; changing acquisition must not tighten, relax or bypass that contract.                                                                                             |

The current canonical package uses `preserve` mode on the structural mapping route and `compatible` mode for compatible ingress.
Record those actual public values rather than inventing a `source-preserving` configuration enum.
Do not use a compatible document parse as proof that the strict structural route passed.
Cross-runtime fixtures must demonstrate the chosen document mode, source diagnostics and closure report for each supported route.

The starting hard service ceilings remain 33,554,432 representation bytes per document, 256 imports and depth 32.
Closure aggregate input/work/depth/time ceilings also apply; a count limit is not permission to acquire 256 maximum-size documents.
Read the installed `OWLOntologyLoaderConfiguration` defaults/public copy API and the actual consumer budget, record all resolved limits, and use the lower applicable ceiling.
Capture decoder/base policy, metadata-derived format inventory, parser mode, import behaviour, profile mode, retries, redirects, schema/contract version and public errors in the fingerprint.
Finite lower consumer limits remain authoritative on cache hits.

### 11.3 Exact package and runtime parity

Qualification must prove the same installed public coordinate/integrity and stage policy in both runtime bundles, with one package copy and only public exports.
The exact native npm alias is permitted.
Compare parser selection, typed outcome, ontology/import identifiers, source evidence/diagnostics and qualification report for identical bytes, parser IRI and public format metadata.
Equal version strings or matching lockfile snippets alone are not proof.

Use `OWLDocumentFormats` to enumerate public formats, media/extension aliases and candidate selection; application Accept preferences are a versioned ordering over that metadata, not a copied syntax list.
If metadata selects zero or multiple formats, retain typed ambiguity/rejection and the current explicit user-selection flow.
The anonymous service cannot ask a human during a worker deadline and must not guess or cycle through private parsers.
Parser recognition, successful parse and source/profile qualification are distinct outcomes.

### 11.4 Exact bytes and character decoding

The artifact digest covers bytes after HTTP content decoding and before character decoding.
Request `Accept-Encoding: identity`, still bound both compressed and decompressed work, and record the actual origin encoding/media type separately.
Do not hash a JavaScript string or recompressed transfer, and do not content-decode twice.

The current `vowl/owl` source boundary uses `new TextDecoder("utf-8", { fatal: true })`.
Version 1 therefore accepts only source representations compatible with that strict UTF-8 contract.
Keep exact bytes, record BOM handling and the applicable syntax/media encoding rules, and reject malformed UTF-8 or conflicting/unsupported charset/XML declarations with a typed decoding/encoding result.
Do not use replacement-character `Response.text()` semantics, silently transcode UTF-16/legacy charsets, or interpret an arbitrary server header as permission to alter bytes.

Non-UTF-8 seed/input cases receive an explicit unsupported-encoding disposition; they do not halt all cache implementation or create a dependency on an unpublished package.
Expanding encoding support requires a separate, consumer-compatible decoder policy and cross-runtime qualification, with exact original bytes retained and a new validation identity.
A public byte-source API could simplify that future work but is not a version 1 prerequisite.

### 11.5 Managed closure manifests and consumer suitability

Build the graph through the public manager; retain the root validation identity, each member's validation identity and parser IRI, and every resolved direct-import edge, including shared/cyclic structure.
Canonicalize the bounded manifest deterministically and record profile/report digests, source assessment, unresolved imports, package/policy identities and qualification time.
A successful root parse cannot fill absent member identities.
Changes to any member, parser context, edge, package or policy require a new closure qualification; byte objects may still be reused.

Run the public asynchronous OWL 2 DL report over the entire managed closure, including source constructs excluded from a particular visualization.
Keep profile violations, incomplete checks, unsupported preservation and resource exhaustion distinguishable.
The current compatible view may admit retained diagnostic content without claiming strict structural qualification.
Record `consumerAdmissionPolicy` and `consumerAdmissionResult` independently; an ontology exceeding display/work limits is not thereby a syntactically invalid source.
Bind admission evidence to the exact closure, `vowl` version, operation/profile and resource-policy identity; a server-only `owlapi` report leaves browser consumer admission `NOT_EVALUATED`.
Changing consumer limits does not rewrite historical ontology qualification or prove a new admission result.

### 11.6 Isolation and failure hygiene

Use a fresh manager per document/closure qualification job and an external no-network trap to prove parser isolation.
All closure acquisition is through the controlled loader; the package gets no caller credentials or unbounded fetch authority.
Source context always comes from the immutable resolution binding or the direct acquisition policy.
Normalize supported public errors without message matching or private imports; unexpected exceptions fail closed as internal validation failures and alarm.
Bound diagnostics and retain causes only in protected engineering evidence with redaction.
Private staging may precede validation; the final CloudFront-readable artifact prefix may not.

---

## 12. Retrieval and security architecture

### 12.1 Threat model

The primary security concern is not CORS.
CORS controls which browsers may read a response; it does not make a server-side fetch safe.
An anonymous materialization endpoint can otherwise be used to:

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
2. Permit only `http:` and `https:` and only ports 80 and 443 through default-port syntax.
   Reject an explicit alternate port.
3. Reject username/password, IP-literal hostnames, empty hostnames, malformed IDNs, backslashes that change parsing, and overlong values.
4. Check an exact operational denylist of source keys/domains before DNS.
5. Resolve every A and AAAA result using the request-scoped resolver.
6. Reject the entire hostname when **any** answer is non-public, including IPv4-mapped IPv6.
7. Block at least unspecified, loopback, private, shared-address-space, link-local, carrier-grade NAT, documentation, benchmarking, reserved, multicast, broadcast, unique-local IPv6, IPv6 link-local, IPv4-compatible/mapped bypass forms, and known cloud metadata ranges/hostnames.
   Generate the executable range table from the pinned IANA special-purpose registries and review differences during dependency updates.
8. Supply only the already validated address set to the HTTP client’s custom lookup/connection path, preserving the hostname for HTTP `Host` and TLS SNI/certificate validation.
   Do not perform a second uncontrolled DNS resolution between validation and connection.
9. Disable automatic redirects.
   For each redirect, parse, canonicalize, DNS-resolve, classify, and connect again under the same policy.
10. Permit at most three redirects and reject a redirect loop, relative location that cannot be resolved, scheme downgrade outside the explicitly allowed original-HTTP fallback, or missing/overlong `Location`.

The original cost model assumed a worker outside a VPC.
That assumption is subject to the explicit network-egress decision in §12.8; URL/DNS checks and least-privilege IAM are not evidence of independent network-layer filtering.

### 12.3 HTTP request, variation and revalidation policy

Every upstream request is a controlled GET with an Accept value generated from the pinned public format metadata and recorded application preference order, `Accept-Encoding: identity` and a stable service user agent/policy contact.
Do not embed a copied syntax/media-type list in the retriever.
Never forward Authorization, Cookie, referrer, caller headers or viewer address; no automatic retry belongs in the HTTP client.

Starting budgets are DNS 3 seconds, connection/TLS 5 seconds, headers 10 seconds, complete retrieval 30 seconds, at most three redirects, 33,554,432 decoded bytes, and one HTTPS candidate plus only the explicitly permitted original-HTTP fallback.
Bound encoded bytes, decompression expansion and CPU/time independently.
The document worker starts at 2,048 MiB ARM64 and 60 seconds, subject to measured runtime/package headroom.
Closure qualification has its own bounded resumable budget rather than multiplying this envelope without accounting.

A new representation requires a complete accepted 200 response; reject 204, 206, authentication challenges and range/session-dependent bodies.
Handle 304 only as a conditional-refresh result under §7.5.
Persist `ETag`, `Last-Modified`, relevant `Cache-Control`, `Vary`, response status, effective URI, acquisition time and the versioned selected request headers/variant fingerprint.

Version 1 admits `Vary` only over service-controlled, fixed representation-selection inputs such as Accept and Accept-Encoding, with exact values captured and compared on reuse.
Reject `Vary: *`, caller-dependent/unknown variation and credentials/session dependence.
A changed Accept preference or package metadata changes the request-policy fingerprint and requires variant reconciliation, even if source key and byte digest happen to match.
Origin validators are scoped to that source variant and target; a 304 does not bypass restriction/metadata updates or semantic requalification.

The service republishes admitted immutable source snapshots rather than claiming its digest URL is the origin's current response.
If origin directives require per-use validation or a shorter lifetime that is incompatible with public immutable republication, reject automatic publication unless a separately curated rights/policy decision permits the snapshot.
Do not override `no-cache`, `must-revalidate`, `s-maxage` or changed restrictions by applying the default 30-day refresh interval.
Conditional refresh and metadata merging follow [RFC 9111](https://www.rfc-editor.org/rfc/rfc9111.html#section-4.3.4); a source's absent cache directives are not proof of legal republication permission.

### 12.4 Republishing/admissibility policy

The worker rejects a response from automatic publication when:

- `Cache-Control` contains `no-store` or `private`;
- `Vary: *`, unsupported variation, or a response lifetime/revalidation restriction incompatible with durable republication is present;
- a successful response sets cookies, contains a credential-bearing source query, or is session/authentication dependent;
- terms/denylist/takedown policy blocks the source;
- the effective source changes to a forbidden domain/address;
- the response is too large, empty, or not accepted by `owlapi`; or
- the exact source is quarantined.

The service records `ETag`, `Last-Modified`, relevant cache directives, detected public licence annotations when available, retrieval time, effective upstream IRI, validator revision, and source-code revision.
Absence of machine-readable licence metadata is visible in provenance; it is not represented as permission or a legal conclusion.

Before production launch, publish a concise cache policy and takedown contact.
A takedown action sets `QUARANTINED`, removes the mapping from future catalogs, prevents rematerialization, retains private audit evidence, and determines whether emergency CloudFront invalidation is legally/security necessary.
This document is engineering guidance, not legal advice; the AGPL and third-party-content obligations require an appropriate review.

### 12.5 Cache-poisoning controls

- Publish only the exact `requestedDocumentIri` that was submitted or explicitly curated as a seed name.
- Store parsed ontology/version IRIs and effective redirects as metadata only.
- Do not let a dynamic source overwrite a seed source key.
- Validate and publish the same byte sequence from memory/private staging; never re-fetch between validation and final artifact write.
- Address artifacts by SHA-256 and require conditional writes.
- Build catalog entries only from registry state that references an existing verified artifact and accepted validation profile.
- Verify S3 artefact digest/length before registry promotion and during scheduled integrity sampling.
- Sign deployment/release evidence through the repositories’ accepted processes; do not claim the source ontology itself is signed by Hadden Industries.

### 12.6 Frontend security and modern browser requirements

- Run the materialization client only in a secure context because Web Crypto digest is required for CloudFront’s OAC POST payload hash.
- Feature-detect `globalThis.crypto?.subtle`, `AbortController`, `ReadableStream`, and the accepted Fetch features.
  Do not sniff user agents.
- Where available, compose cancellation with `AbortSignal.any()` and `AbortSignal.timeout()`; provide a small local fallback based on `AbortController` without a global polyfill.
- Never use `mode: "no-cors"`; an opaque response cannot be validated or safely cached by application code.
- Use `priority: "low"` only for speculative catalog prefetch after the page becomes interactive.
  A user-blocking ontology/artifact fetch or materialization poll uses normal priority.
- Do not use `setInterval`.
  Poll recursively after each completed status request so slow requests cannot overlap.
- Coalesce concurrent catalog fetches and exact-source materialization requests in one page.
- Limit client-side materialization submissions to four in flight even if a later `owlapi` version parallelizes import resolution.
- Preserve and display typed errors without telling users that every Fetch rejection “is CORS”; browsers intentionally do not expose that distinction reliably.
- Document the exact `connect-src https://haddenindustries.com` addition required by third-party WebVOWL deployments.
  Do not weaken a host’s CSP to a wildcard.

### 12.7 WAF and application quotas

Use one CloudFront-scope WebACL named `PublicWebDeliveryWebAcl` with default allow and one custom rate-based rule named `OntologyMaterializationSubmissionRateLimit`:

- aggregation: source IP;
- evaluation window: 300 seconds;
- limit: 300 matching requests;
- scope-down: method `POST` and exact URI path `/ontology/materializations`;
- initial action: `COUNT` for at least seven complete days and representative closure tests;
- production action after evidence: `BLOCK` with a small JSON 429 response; and
- CloudWatch metrics enabled, sampled requests disabled, no full WAF request logging at initial launch.

The starting threshold is intended to accommodate a 256-document import closure, but retries, shared client addresses and browser acquisition cadence require measured verification before BLOCK mode.
Poll GETs are excluded from this rule because applying the same low limit to submissions and status reads would punish legitimate closures.

The API additionally enforces:

- 500 newly admitted source keys across the service per UTC day;
- idempotent existing-source submissions without quota increment;
- `materializationEnabled` kill switch checked transactionally when admitting a new source;
- maximum request body and IRI size;
- maximum three worker attempts per materialization cycle;
- worker concurrency two; and
- bounded negative-cache windows.

WAF rate limiting is approximate availability protection, not exact accounting.
DynamoDB transitions and the daily quota remain authoritative for work admission.

---

### 12.8 Network-egress decision and security ownership

Before live deployment, the infrastructure/security owner must compare a controlled egress layer or independently enforced network destination policy with the original outside-VPC design.
Probe whether it blocks cloud metadata/private/special-purpose destinations independently of application URL checks while preserving validated DNS-to-connection pinning and TLS identity.
Retain the exact controls, residual failure modes, operational ownership and fixed/request costs.

If an independently enforced egress design is not feasible within the operating target, the owner must explicitly accept the residual risk or revise cost/topology before deployment.
The implementation plan does not silently waive this assessment, claim that IAM blocks network destinations, or automatically install VPC/NAT infrastructure.
The scoped security review covers redirects, IPv4/IPv6/rebinding, context/import recursion, staging/publication permissions, URL privacy, quotas and recovery under the selected topology.

---

## 13. CloudFront and caching configuration

### 13.1 Distribution choice

Use the existing standard pay-as-you-go distribution serving `haddenindustries.com`.
Do not enroll it in a CloudFront flat-rate plan and do not transfer Route 53 management.
The cache-specific behaviours are more specific than `ontology/*`, so they bypass the current extensionless-ontology rewrite without changing legacy URLs.

The reason to reuse the distribution is operational and architectural locality: existing hostname/certificate/DNS, one public trust boundary, one logging stream, and no additional client origin.
It is **not** a claim that CloudFront distributions have a fixed pay-twice fee.
CloudFront’s always-free allowance is account-wide, and one WAF WebACL can in principle associate with multiple CloudFront distributions.
If measured total-distribution traffic makes WAF on the shared distribution incompatible with the USD 10 target, implementation stops for a new architecture approval rather than silently creating another distribution.

### 13.2 Origins

| Origin                             | Type                                                       | Access                                                           | Purpose                                           |
| ---------------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------- |
| Existing static origin             | Current private S3 bucket/OAC                              | Existing policy unchanged                                        | Website and legacy `/ontology/*`.                 |
| `ValidatedOntologyArtifactOrigin`  | Dedicated private S3 REST origin/OAC                       | CloudFront distribution ARN only                                 | Artifacts, provenance, catalog roots/generations. |
| `OntologyMaterializationApiOrigin` | Lambda Function URL with `AWS_IAM` auth and CloudFront OAC | CloudFront service principal constrained to the distribution ARN | Small submission/status/CORS responses.           |

For the Function URL origin, use OAC signing behaviour `always`.
Browser POSTs must supply `x-amz-content-sha256`; CloudFront supplies the SigV4 authorization to Lambda.
The Function URL itself is not public.

### 13.3 Behaviour registry

| Path pattern                                                                                | Origin             | Allowed methods                                  | Cache/origin details                                                                                                                           |
| ------------------------------------------------------------------------------------------- | ------------------ | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `ontology/materializations`                                                                 | API                | All at CloudFront; API permits POST/OPTIONS only | `CachingDisabled`; forward body plus only required CORS/content hash/content type headers; no cookies/query.                                   |
| `ontology/materializations/*`                                                               | API                | All at CloudFront; API permits GET/OPTIONS only  | Same; API validates exact path/digest.                                                                                                         |
| `ontology/cache/artifacts/*`                                                                | artifact S3        | GET/HEAD/OPTIONS                                 | Custom immutable policy; no cookies, headers, or query in the cache key. Only digest tokens are used by clients; raw query logging is omitted. |
| `ontology/cache/provenance/*`                                                               | artifact S3        | GET/HEAD/OPTIONS                                 | Five-minute mutable policy, ETag-aware.                                                                                                        |
| `ontology/cache/resolutions/*`, `ontology/cache/validations/*`, `ontology/cache/closures/*` | artifact S3        | GET/HEAD/OPTIONS                                 | Immutable context/evidence, no query/cookie cache-key variation; separate ordered behaviours.                                                  |
| `ontology/catalog-v001.xml`                                                                 | artifact S3        | GET/HEAD/OPTIONS                                 | Min 0, default 300, max 86,400; honor origin stale directives.                                                                                 |
| `ontology/catalogs/*`                                                                       | artifact S3        | GET/HEAD/OPTIONS                                 | Immutable policy.                                                                                                                              |
| Existing `ontology/*`                                                                       | existing static S3 | Existing                                         | No change.                                                                                                                                     |

No cache-specific behaviour associates `RewriteOntologyURI.js`.
CloudFront’s current distribution-wide custom 404 remains for legacy paths; the API contract avoids 404 so a status miss cannot inherit its five-minute custom-error TTL.

The artifact-origin request policy forwards only `Origin`, `Access-Control-Request-Method`, and `Access-Control-Request-Headers`, solely so private S3 can evaluate preflight.
It forwards no cookies or query strings, and none of those headers enters the cache key.
That is safe only because the bucket rule accepts every origin/header for the fixed GET/HEAD method set and the CloudFront response-headers policy overrides the resulting CORS fields with the same invariant wildcard values.
Tests must issue preflights with different origins, requested methods, and header sets to prove that a cached OPTIONS response cannot grant an unsupported method or produce a false denial.
All other viewer headers stay at the edge.

### 13.4 Cache-key correctness

- Artifact identity is wholly in the path digest.
  Ignore all query strings, headers, and cookies.
- `source` and `binding` digest query tokens identify client resolution evidence only; they are omitted from cache keys, S3 requests and raw access-log fields.
  A caller can spoof them, so the client verifies the binding against its requested source and artifact digest; reports cannot infer authoritative source-level viewer counts.
- The root catalog path is stable and has no version query convention.
- Immutable generations are versioned in the path, not through invalidation or query cache busting.
- API responses are never cached, including errors and redirects.
- Set CloudFront minimum TTL to zero on mutable/API paths so origin `no-store` and revalidation directives cannot be overridden by a positive minimum.

### 13.5 Byte and context response metadata

The shared artifact response has invariant byte-oriented metadata:

```text
Content-Type: application/octet-stream
Cache-Control: public, max-age=31536000, immutable
ETag: S3-managed representation validator
x-amz-meta-artifact-sha256: 64-hex digest
```

Do not attach a source's media type, parser base, qualification status or validation-profile header to an object deduplicated by bytes alone.
The immutable resolution record supplies those contextual facts, including original representation media/encoding and decoding policy.
The browser checks the digest itself; S3 metadata/checksum validation provides an independent storage integrity check.
Verify delivery/CORS exposure on both CDN hits and misses without assuming a response-header policy can dynamically translate arbitrary S3 metadata.

---

## 14. AWS infrastructure topology and resource ownership

### 14.1 Stack dependency graph

The original infrastructure inspection found the global stack created before the regional stack, with the distribution passed into regional resources.
Reconfirm that ownership and deployed logical IDs during SLICE-001; this draft does not establish current AWS state.
A new regional origin needed by the global distribution would create a cycle if it also tried to install distribution-scoped access policies.
Use this acyclic order:

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

The data stack must not refer to the distribution.
The bindings stack depends on both and owns the distribution-specific bucket policy and the two Lambda permissions required by Function URL OAC.
This is a directed acyclic stack graph.

Do not rename deployed stack IDs, move existing constructs across scopes, or accept replacement of the distribution, certificate, hosted-zone records, or static bucket merely to make source names prettier.
Any source refactor must preserve logical IDs and prove an empty replacement diff for existing resources before cache resources are added.

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

| Logical name                             | Initial settings                               | Notes                                                                                                      |
| ---------------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `ValidatedOntologyArtifactBucket`        | private, versioned, SSE-S3, retain             | New origin; no public ACL/policy.                                                                          |
| `OntologyCacheObservabilityBucket`       | private, SSE-S3, retain                        | CloudFront logs v2, Athena results, aggregate reports; raw logs expire after 90 days.                      |
| `ValidatedOntologyRegistryTable`         | on-demand, PITR, deletion protection           | Point API reads; bounded scans for catalog/refresh/report.                                                 |
| `OntologyMaterializationQueue`           | Standard, managed encryption, 4-day retention  | Batch size one; max concurrency two.                                                                       |
| `OntologyMaterializationDeadLetterQueue` | Standard, managed encryption, 14-day retention | Alarm on first message.                                                                                    |
| `OntologyCatalogProjectionQueue`         | Standard, managed encryption                   | Coalesces registry changes; publisher concurrency one and batching window 60 seconds.                      |
| `OntologyMaterializationApiFunction`     | Node 24 ARM64, 256 MiB, 5 seconds              | Function URL uses `AWS_IAM`; small JSON only.                                                              |
| `OntologyMaterializationWorkerFunction`  | Node 24 ARM64, 2,048 MiB, 60 seconds           | Egress topology pending §12.8; exact `owlapi`; concurrency two.                                            |
| `OntologyCatalogProjectionFunction`      | Node 24 ARM64, 512 MiB, 30 seconds             | Deterministic scan/generation/root CAS; concurrency one.                                                   |
| `OntologyRevalidationSchedulerFunction`  | Node 24 ARM64, 256 MiB, 30 seconds             | Daily bounded due-source scan/enqueue.                                                                     |
| `OntologyUsageReportFunction`            | Node 24 ARM64, 256 MiB, 30 seconds             | Starts/finalizes private Athena reports asynchronously.                                                    |
| `OntologyCacheOperationalDashboard`      | One private CloudWatch dashboard               | Prefer native service metrics; no per-source dimensions.                                                   |
| `OntologyCacheCostAlertTopic`            | encrypted only if existing policy/cost permits | Reuse an existing confirmed email topic where semantically correct; do not duplicate subscribers silently. |
| `PublicWebDeliveryWebAcl`                | CloudFront scope, default allow, one rate rule | Count-first rollout; WAF cost applies to all distribution requests.                                        |

Exact physical names should normally be CloudFormation-generated to avoid global-name collisions.
Use explicit names only where a human/API contract needs stability, and include account/region when the namespace is global.

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
      identifyOntologySource.js
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
    qualification/
      qualifyOntologyClosure.js
    reporting/
      ontologyCacheUsageReport.js
    observability/
      writeStructuredOperationalEvent.js
  test/
    fixtures/
```

The application manifest is private, uses `type: "module"`, exact runtime dependencies, Node’s built-in test runner, and no install/lifecycle scripts. Bundle each handler with CDK `NodejsFunction`/esbuild in ESM mode for Node 24/ARM64, without minification or source maps, and include exact AWS SDK v3 clients rather than relying accidentally on the runtime’s mutable SDK version.
Only document-validation and closure-qualification bundles include `owlapi` and parser dependencies; both use the same exact accepted package.
The prospective closure handler is `src/qualification/qualifyOntologyClosure.js`; contextual records are owned by the registry/evidence modules, not a second ontology graph implementation.

Creating this manifest/lockfile, adding exact esbuild/AWS SDK/network dependency versions, and changing CDK bundling are configuration changes requiring the approval gate in §2.4. A dependency is accepted only after licence, maintenance, vulnerability, browser/Node compatibility where applicable, bundle content, and lockless/locked resolution review.

WebVOWL and the installed `owlapi` RC declare AGPL-3.0-only at this revision's inspection time.
A network-deployed worker bundle that incorporates `owlapi` therefore must not reach a live environment until the project owner has completed an appropriate licence review and recorded the compliant corresponding-source mechanism for the exact deployed revision.
At minimum, `THIRD_PARTY_NOTICES.md` identifies every bundled component and licence, `LICENSES/AGPL-3.0-only.txt` preserves the applicable licence text, and `CORRESPONDING_SOURCE.md` identifies the immutable WebVOWL/worker and `owlapi` source revisions, build inputs, scripts, and user-facing source-access location.
Those files are evidence outputs, not a substitute for the review, and the review decides whether further material must be included in corresponding source.
The public transparency surface links the source-access location for every live worker revision.

A separately bounded `OntologyClosureQualificationFunction` and queue consume pinned member evidence after document jobs complete.
Their initial 60-second/2,048-MiB envelope and concurrency one must be benchmarked against the accepted closure budget; timeout records incomplete evidence rather than relaxing limits.
Both work kinds share the feature kill switch, quota accounting, DLQ/reconciliation and cost envelope.
Add these resources only in an approved exact stack diff.

### 14.5 IAM policy boundaries

- API: point read/update/transaction on registry/control/quota keys and `SendMessage` to materialization queue; no S3 object write/read, catalog publication, CloudFront, WAF, or arbitrary DynamoDB table access.
- Worker: receive/delete/visibility through its queue integration; fenced registry transitions; restricted staging/artifact/evidence/provenance reads/writes; durable catalog-dirty intent; no root/distribution update or source credential access.
- Closure qualifier: read pinned member/evidence objects, request missing members only through controlled admission, write bounded closure evidence and conditionally attach it to the matching identities; no arbitrary fetcher or mutable source rewrite.
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
  acquisitionState,
  documentValidation,
  closureQualification,
  publicationState,
  consumerAdmission,
  outcomeCode,
  attempt,
  durationMs,
  byteLength,
  artifactSha256,
  validationProfileId
}
```

Fields are included only when known.
Events never include a raw source/effective/artifact IRI, request body, response body, parser excerpt, cookies, authorization, viewer address, user agent, referrer, full DNS answer list, or stack trace in the normal log line.
Unexpected exception diagnostics go to a bounded error field after source/body/header redaction; the exception object remains visible only under the log-retention/access policy required for engineering diagnosis.

Do not use `sourceKey`, artifact digest, domain, or error message as a CloudWatch metric dimension.
High-cardinality analysis belongs in Athena over logs/registry projections.

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
sc-status
time-taken
x-edge-result-type
x-edge-response-result-type
x-edge-request-id
cache-behavior-path-pattern
```

Omit `c-ip`, cookies, `User-Agent`, referrer, protocol headers, TLS fingerprint-like data, and country unless a later documented operational need and privacy review justifies one.
Disable cookie logging globally and omit `cs-uri-query`: a viewer can append an arbitrary secret to any path, even if the API ignores it.
Selecting the whole query field and filtering it later would already have retained that secret.
Any future source-attribution pipeline must extract only validated fixed-shape digest tokens before persistence, be separately privacy/cost reviewed and receive exact configuration approval.
Use text/JSON delivery initially; do not select Parquet conversion until measured Athena scan savings exceed its vended-log conversion charge and the exact configuration receives approval.

CloudFront standard logs are distribution-wide.
Every cache report filters the exact path patterns; total rows still matter for WAF and CloudFront cost because those services see the whole distribution.

### 15.3 Retention

| Data                         |                                                              Retention | Reason                                                                                 |
| ---------------------------- | ---------------------------------------------------------------------: | -------------------------------------------------------------------------------------- |
| Lambda log groups            |                                                                30 days | Operational diagnosis without indefinite request-event retention.                      |
| Raw CloudFront standard logs |                                                                90 days | Traffic/cost trend and incident window.                                                |
| Athena query results         |                                                                30 days | Reproducibility long enough for report review; avoid accumulating duplicated extracts. |
| Daily aggregate reports      |                                                               400 days | Month-over-month and annual seasonality without raw viewer data.                       |
| Monthly aggregate reports    |                                                              25 months | Budget/project trend.                                                                  |
| Artifact/source provenance   | While the source/artifact remains retained, plus incident/legal policy | Transparency and validation traceability.                                              |
| Quarantine/takedown audit    |                            According to approved legal/security policy | Must not be erased by ordinary log lifecycle.                                          |

Lifecycle rules are code/configuration and require the §2.4 approval.
Retention changes require a privacy, operational, and cost rationale.

### 15.4 CloudWatch metrics and alarms

Prefer AWS-native metrics.
The initial dashboard includes:

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
- artifact reads by digest/path, with source mappings reported separately; no precise viewer-source attribution is claimed when multiple sources share bytes;
- unique new materializations and validation outcomes;
- artifact/source/catalog counts and stored bytes;
- queue/worker latency percentiles derived from structured event timestamps;
- stale/rejected/quarantined counts;
- validation profile/package-version distribution; and
- projected month-end cost by service/driver.

Raw query logging is not selected.
The optional client `source` token is caller-controlled, so reports do not claim observed per-source viewer counts.
Use byte-object/path traffic for costs and registry/qualification events for source work; any later sanitized attribution remains explicitly non-authoritative.

`OntologyUsageReportFunction` starts a parameterized Athena query and returns; it does not poll while billed.
Athena state-change events invoke the same function in finalize mode to validate the query identity, fetch bounded aggregate rows, and write versioned JSON/CSV. Repeated events are idempotent by report date/query execution ID.

Athena EventBridge delivery is best effort, so each daily invocation first reconciles any incomplete report query IDs with `GetQueryExecution`.
It finalizes a succeeded query or records its terminal failure before starting that date's next report.
Reconciliation is a bounded state read, not an in-function polling loop, and a stale non-terminal query is surfaced for operator review rather than spawning duplicate queries indefinitely.

Reports are private by default.
A future public transparency report may publish only aggregate service health/volume and per-source counts above an approved disclosure threshold.
It must not expose viewer-level records or imply that a cached ontology is endorsed.

### 15.6 Public transparency surface

At launch, transparency consists of:

- stable OASIS catalog root;
- immutable catalog generations;
- public per-source provenance JSON;
- documented validation profile and limits;
- source-code/revision links for the worker and `owlapi`;
- cache/admissibility/takedown policy and contact;
- explicit document/closure/publication/admission meanings and source-preservation limitations, without claiming consistency or endorsement; and
- documented refresh/last-known-good semantics.

Do not expose DynamoDB records, internal failure text, source denylist rationale that would weaken security, viewer traffic logs, or cost-control credentials.

---

## 16. Cost profile and USD 10 operating target

### 16.1 Pricing baseline and accounting boundary

Prices and free allocations change.
SLICE-001 must reproduce the estimate in the official AWS Pricing Calculator for the actual account, payer, regions, existing free-tier consumption, and preceding 90 days of distribution traffic before any resource is created.

The 25 August 2026 planning baseline uses these public rates/allocations:

| Service/driver                                       | Planning baseline                                                                                                   | Important boundary                                                                                                                                                         |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CloudFront pay-as-you-go always-free                 | First 1 TB data transfer out, 10,000,000 HTTP(S) requests, and 2,000,000 CloudFront Function invocations each month | Account-wide, not a new allowance for this cache. Existing distribution traffic consumes it.                                                                               |
| CloudFront beyond allowance, US/Europe planning rate | About USD 0.0100 per 10,000 HTTPS requests and USD 0.085 per GB for the first paid data tier                        | HTTP’s planning request rate is lower, but the service requires/redirects to HTTPS. Verify geography/method tiers; the plan does not assume all viewers are in one region. |
| AWS WAF                                              | USD 5 per WebACL-month + USD 1 per custom rule-month + USD 0.60 per million requests                                | Request charge applies to the distribution’s requests, not only the rate rule’s scoped path. Managed groups and advanced body inspection add cost and are not selected.    |
| Lambda                                               | 1,000,000 requests and 400,000 GB-seconds monthly free; then request/duration rates                                 | Aggregated across the account; the 2 GiB worker can consume duration allocation faster than small functions.                                                               |
| SQS Standard                                         | First 1,000,000 requests monthly free                                                                               | A job normally uses multiple SQS operations; account-wide use matters.                                                                                                     |
| DynamoDB                                             | On-demand request/storage pricing; 25 GiB Standard storage free and provisioned-capacity free tier exists           | This design chooses on-demand for unpredictable low volume; do not incorrectly subtract provisioned RCUs/WCUs from an on-demand bill.                                      |
| S3 Standard                                          | Approximately USD 0.023 per GB-month plus PUT/GET/list request charges in the selected region                       | CloudFront origin transfer is generally not charged, but storage/log delivery/request dimensions remain. Verify eu-west-1 rates.                                           |
| CloudWatch                                           | 5 GB logs and a limited set of custom metrics/dashboards/alarms in the monthly free tier                            | Account-wide; standard-log v2 delivery can have vended-log charges even though CloudFront does not charge merely for enabling logging.                                     |
| Athena                                               | USD 5 per TB scanned, 10 MB minimum per query                                                                       | Partition pruning and selected fields keep daily aggregate queries tiny.                                                                                                   |

Always report incremental cache cost and total affected-distribution cost separately.
WAF is an incremental cache/security decision but inspects the entire shared distribution, so attributing only cache-path request fees would materially understate it.

### 16.2 Cost formula

Use this explicit monthly model, with rates replaced by the current calculator output:

```text
incremental total =
  WAF WebACL fixed charge
  + WAF custom-rule fixed charge
  + WAF request charge for all shared-distribution requests
  + CloudFront requests above remaining account allowance
  + CloudFront egress above remaining account allowance
  + S3 artifact/staging/resolution/validation/closure/catalog/log storage and requests
  + document and closure Lambda requests and GB-seconds above remaining account allowance
  + SQS requests above remaining account allowance
  + DynamoDB reads/writes/storage/backups
  + CloudFront standard-log delivery/storage
  + CloudWatch logs/metrics/alarms/API usage
  + Athena bytes scanned/results
  + SNS notification and cost-control API usage
```

Do not treat a forecast as a hard real-time circuit breaker: AWS billing/usage data is delayed, WAF fixed cost is already incurred while enabled, and CloudFront traffic continues even if materialization stops.

### 16.3 Scenario estimates

The following are historical directional planning ranges, not current quotes or approval evidence.
They predate the explicit closure/evidence and egress work in this revision; SLICE-001 must recalculate those additional storage, requests and compute/network costs.
They assume the account still has its CloudFront/Lambda/SQS/CloudWatch free allocations, average stored ontology size near 1 MiB, one WAF rule, no managed rule group, selected-field compressed logs, and low report scan volume.

| Scenario                | Shared distribution requests / transfer | New materializations / retained data | WAF estimate |                                                  Other cache services | Expected incremental total |
| ----------------------- | --------------------------------------- | ------------------------------------ | -----------: | --------------------------------------------------------------------: | -------------------------: |
| Quiet launch            | 1 million / <100 GB                     | 1,000 / ~1 GB                        |    ~USD 6.60 |                                                        ~USD 0.10–0.50 |             ~USD 6.70–7.10 |
| Healthy growth          | 3 million / <300 GB                     | 10,000 / ~10 GB                      |    ~USD 7.80 |                                                        ~USD 0.30–1.00 |             ~USD 8.10–8.80 |
| Budget edge             | 5 million / <500 GB                     | 25,000 / ~25 GB                      |    ~USD 9.00 |                                                        ~USD 0.60–1.50 |            ~USD 9.60–10.50 |
| Free-request exhaustion | 11 million / <1 TB                      | 25,000 / ~25 GB                      |   ~USD 12.60 | at least ~USD 1.00 paid CloudFront HTTPS requests plus other services |                 >USD 13.60 |

Adding a second custom WAF rule adds approximately USD 1/month before request-related changes. At the stated budget, do not add a managed ruleset, Bot Control, CAPTCHA/Challenge, full WAF logging, or additional custom rules at launch without a revised approved estimate.

The WAF fixed/request cost is likely to dominate while traffic is within CloudFront’s always-free allocation.
S3, SQS, DynamoDB, Athena, and Lambda are expected to remain cents-scale at early volumes, but that expectation must be validated against account-wide free-tier consumption and actual worker duration.

### 16.4 Cost containment design

Use layered limits rather than a single destructive switch:

1. **Admission:** 500 new source keys per UTC day; idempotent hits do not count.
2. **Edge abuse:** one WAF rule at 300 submissions per source IP per five minutes.
3. **Compute:** document-worker concurrency two, separately bounded closure concurrency one, one message per invocation, finite deadlines/attempts and quota-accounted missing-member admission.
4. **Storage:** 32 MiB artifact ceiling, deterministic deduplication, catalog entry/byte ceiling, orphan/integrity report.
5. **Query/logging:** 1 GiB Athena cutoff, bounded selected log fields, finite retention, no real-time logs.
6. **Budget warnings:** notify at USD 7 actual, USD 9 forecast, and USD 10 actual incremental monthly cost, using current AWS Budgets/Cost Explorer capabilities selected at approval time.
7. **Feature kill:** the limit action sets `CONTROL#SERVICE.materializationEnabled = false`.
   New unknown sources receive 403; refresh/closure scheduling also observes the approved stop policy so background work cannot evade containment. Published artifacts/catalogs and the rest of the distribution remain available.
8. **Operator review:** identify WAF versus traffic versus storage/compute driver, then explicitly re-enable, retune, or keep disabled.
   Never reset a counter or budget automatically merely because a Lambda retried.

The cache cost envelope comprises dedicated, tagged resource charges, the full incremental WAF charges, and the measured CloudFront/logging variance from the recorded shared-distribution baseline.
Resource tags and AWS Budgets cannot allocate shared CloudFront charges by path, so reports must not present a tag-only number as the cache's exact cost.
Attribute path-level requests and bytes from selected CloudFront logs, apply the current rate tiers conservatively, and retain both the modelled cache attribution and the authoritative whole-distribution bill.

### 16.5 Migration of the current whole-distribution cost cutoff

The historical `DisableCloudFrontOnCostLimit` path evaluated a configured CloudFront ceiling every minute and could disable the entire distribution; SLICE-001 must verify its current configuration and ownership.
Before WAF/cache production enablement:

- record its exact present behaviour, cost, alarms, and failure modes;
- ensure its threshold does not interpret the WAF’s expected fixed cost as an emergency requiring website shutdown;
- separate site-wide emergency policy from the validated-cache feature budget;
- replace cache-triggered distribution disablement with the materialization kill switch;
- reduce cost-check cadence/API usage to the minimum supported by billing-data freshness;
- keep any genuine whole-site emergency action disabled or alert-only unless separately approved with a documented recovery path; and
- test that a simulated cache budget breach leaves website, seed catalog, catalog root, and published artifact GETs healthy.

Because this changes an existing safety control, it is a distinct configuration/deployment approval checkpoint and cannot be smuggled into the cache stack diff.

---

## 17. WebVOWL integration architecture

### 17.1 Canonical acquisition seam

Extend the existing `createCanonicalVowlSourceAcquisition` composition with one session-scoped cache-aware acquisition dependency.
Root `remote()` and `createImportContext().resolveImport()` use the same policy, mapping state and operation accounting.
The external acquisition result retains exact bytes plus requested/retrieval/effective/parser IRIs, public media/format metadata, binding identity and sanitized resolution diagnostics.
The existing consumer boundary receives only its supported `{ bytes, documentIri, mediaType }` fields, where `documentIri` is the explicit parser context.
Keep additional provenance in the acquisition/session owner unless an independently approved consumer API change is needed.

The worker continues to invoke public `vowl/owl` operations, and that package continues to own `owlapi` manager construction, parsing, closure semantics and canonical mapping.
The cache does not insert parsed ontology objects into the session or maintain a parallel parser/mapper.
The current import resolver's `getDocumentIRI` and `loadBytes` must be characterized so transport remapping does not erase the logical request or turn a cache URL into the parser base.

### 17.2 Precedence, bypass and typed outcomes

Normal mode is session binding → OASIS binding → direct controlled retrieval → eligible materialization fallback → typed outcome.
The approved direct-only bypass skips catalog/session cache and materialization for both roots and imports while retaining direct URL policy, exact bytes, limits and cancellation.
It is an operator/build composition setting, not an arbitrary query-string endpoint or SSRF-policy override.

Unsupported encoding/format, readable HTTP errors, parser/profile failures, cancellation and local resource limits never cause a proxy retry.
A corrupt or stale-policy catalog entry is a cache-specific diagnostic; safe direct acquisition may still succeed.
Human format selection occurs before worker admission or through the existing explicit pending-format continuation; it cannot consume the worker parse deadline indefinitely.

### 17.3 Session, source and resource ownership

Preserve original-source byte export, retained RDF/source evidence and current semantic exports as distinct session responsibilities.
Copy/transfer byte ownership under the existing worker protocol; never round-trip bytes through text just to integrate the cache.
Every cache/catalog/poll/import operation participates in the existing cancellation and stale-result protocol.
A late response cannot replace a newer document, revive an expired worker operation or charge input bytes twice.
Conversely, cached/import-coalesced bytes cannot evade aggregate input, import-count/depth, work, heap or deadline limits.

Local file/text and canonical/legacy JSON paths retain their current entry points.
Only their ontology imports may use the shared controlled acquisition owner.
Do not send VOWL JSON, arbitrary downloads or semantic export requests to the materialization service.

### 17.4 User-facing state and diagnostics

Map bounded acquisition events to the existing accessible loading status: catalog lookup, direct retrieval, pending materialization, acquired document, incomplete imports, profile assessment and consumer limit/failure.
Show the distinction between a valid document and an incomplete/unsuitable closure without claiming that a resource-budget rejection makes the ontology invalid.
Retain typed package/service codes and expose the catalog generation and cache/bypass mode in diagnostic details.
Do not show source excerpts, raw server internals or AWS identifiers.

### 17.5 Catalog performance and configuration

Coalesce catalog fetches, reuse browser HTTP validators, parse a bounded immutable map once per session and keep speculative prefetch off the critical render path.
Use the current worker seam for expensive catalog processing if measurements require it; the optional JSON projection must satisfy §6.4 and §10.5.
No new scheduler/polyfill/storage layer is assumed.

Endpoint IRIs, bypass mode and finite limits are proposed configuration at the existing composition boundary.
Any new `ontologyLoadingConfiguration.js`, build setting, CSP `connect-src` change or browser harness/dependency change requires exact approval under §2.4.
Third-party deployments can inject approved service origins without accepting arbitrary viewer-supplied endpoints.

---

## 18. Cross-repository file map

New paths below are predictions, not instructions to create every file before a vertical slice proves a need.
Resolve ownership and exact configuration approval before edits; do not create forwarding files or restore retired owners to match a historical plan.

### 18.1 WebVOWL repository

Likely new cohesive internals under `src/ontology-loading/`:

```text
cachedOntologySourceAcquisition.js
oasisXmlOntologyCatalog.js
ontologyMaterializationClient.js
ontologyResolutionEvidence.js
ontologySourceIdentity.js
ontologyLoadingConfiguration.js
```

Reuse the current bounded byte reader where practical; extracting it requires characterization rather than a second implementation.
Place focused acquisition/catalog/identity/parity tests beside the owning modules.
Extend existing `canonicalVowlSourceAcquisition`, `importResolver`, `canonicalVowlDocumentSession`, worker and application composition tests.
Update `src/productionGraph.architecture.test.js` and `src/testRunnerScope.architecture.test.js` only for actual new ownership.
Use the existing logical conformance readers and browser resources harness; do not copy physical corpus trees.
Inspect mapper code as contract evidence and change it only for a separately accepted consumer requirement, not to make cache integration convenient.

Keep workflow evidence in the configured external HISEW task store.
User/operator documentation may live in `docs/ontology-cache/` when it has a product audience; do not write engine receipts or temporary reviews into repository documentation directories.
Existing absent converter files have no deletion task, and the live canonical resolver is removed only if all its consumers have migrated and approval/scope permits that cleanup.

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
Lambda/Applications/ValidatedOntologyCache/src/materialization/identifyOntologySource.js
Lambda/Applications/ValidatedOntologyCache/src/materialization/ontologyMaterializationRegistry.js
Lambda/Applications/ValidatedOntologyCache/src/materialization/safeOntologyRepresentationRetriever.js
Lambda/Applications/ValidatedOntologyCache/src/materialization/validateOntologyDocument.js
Lambda/Applications/ValidatedOntologyCache/src/materialization/ontologyArtifactRepository.js
Lambda/Applications/ValidatedOntologyCache/src/materialization/ontologyMaterializationWorker.js
Lambda/Applications/ValidatedOntologyCache/src/catalog/oasisXmlCatalogProjection.js
Lambda/Applications/ValidatedOntologyCache/src/catalog/publishOntologyCatalogProjection.js
Lambda/Applications/ValidatedOntologyCache/src/revalidation/scheduleOntologyRevalidations.js
Lambda/Applications/ValidatedOntologyCache/src/qualification/qualifyOntologyClosure.js
Lambda/Applications/ValidatedOntologyCache/src/reporting/ontologyCacheUsageReport.js
Lambda/Applications/ValidatedOntologyCache/src/observability/writeStructuredOperationalEvent.js
Lambda/Applications/ValidatedOntologyCache/test/**
validated-ontology-cache/contracts/ontology-materialization-request.v1.schema.json
validated-ontology-cache/contracts/ontology-materialization-error.v1.schema.json
validated-ontology-cache/contracts/ontology-artifact-provenance.v1.schema.json
validated-ontology-cache/contracts/ontology-resolution.v1.schema.json
validated-ontology-cache/contracts/ontology-validation.v1.schema.json
validated-ontology-cache/contracts/ontology-closure-qualification.v1.schema.json
validated-ontology-cache/contracts/ontology-loader-policy.v1.schema.json
validated-ontology-cache/contracts/ontology-seed-manifest.v1.schema.json
validated-ontology-cache/contracts/ontology-usage-report.v1.schema.json
validated-ontology-cache/seeds/ontology-seed-manifest.v1.json
validated-ontology-cache/reporting/cloudfront-cache-usage.sql
validated-ontology-cache/reporting/materialization-outcomes.sql
scripts/stage_validated_ontology_seed_catalog.mjs
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

### 18.3 Public `owlapi` boundary

No producer source change is required by this plan.
SLICE-001 records the exact installed coordinate/integrity, public source/configuration/format/graph/profile/error APIs, Node/browser contract proof and loader fingerprints.
Byte-source and producer-policy fingerprint improvements remain optional upstream requests, not invented current capabilities or release prerequisites.
If a required public contract fails a concrete fixture, retain that evidence and replan the affected slice with the producer owner; do not patch a copy, deep-import internals or guess a future version.

---

## 19. Test strategy and fixtures

### 19.1 Oracle ownership and external boundaries

Use characterization for preserved acquisition behaviour and a failing behavioural regression before implementing a new source/security/publication contract.
Pure relocation remains GREEN → GREEN; do not manufacture a failing test for unchanged behaviour.
Infrastructure changes use native CDK assertions/synthesis/diff and the approved configuration route.
Each slice has a falsifiable result; avoid microscopic implementation-mirroring tests.

Use the real exact installed `owlapi` and `vowl` consumers in Node and browser workers.
Independent expected bytes, identity tuples, import graphs, profile results and semantic outputs come from reviewed fixtures/specification and retained logical corpus oracles, not from the implementation under test.
Mock only genuine external seams: HTTP/DNS/connector, clock, scheduling and AWS client operations.
Local protocol servers and connection-recording adapters must not weaken production SSRF rules to admit loopback test URLs.

### 19.2 Metadata-driven matrix and adversarial cases

Enumerate every public parser/format identity and alias from `OWLDocumentFormats`, with independently expected selection, accepted/rejected examples and ambiguity cases.
This metadata-driven coverage replaces the copied syntax list; named regressions remain explicit:

- DL numeric lexical preservation; KRSS1 unsupported right-identity rejection; RDF/XML base/declaration context; denied JSON-LD remote contexts and XML external entities.
- Exact UTF-8 bytes/BOM, malformed encodings, conflicting charset/declarations, Unicode, content decoding and compressed-expansion limits.
- Same bytes under different document bases, redirects and HTTP upgrades, query/percent-encoding distinctions, declared identifiers and forbidden inferred aliases.
- Cycles, diamonds, duplicate/shared imports, transitive declarations, missing members, incomplete source/profile checks and consumer limits separate from ontology validity.
- DNS mixed answers, every prohibited IPv4/IPv6 range, rebinding, each redirect hop, unsafe downgrades, credential/session requests, timeout and cancellation with zero forbidden connections.
- 200/304, variant/validator mismatch, changed `Vary`/cache restrictions, same bytes with changed metadata/policy, origin outage and last-known-good versus quarantine.
- SQS duplicates/reordering, expired leases, stale generation/quarantine races, lost enqueue/dirty sends and crashes at every §9.4 persistence boundary.
- XML/optional JSON parity, seed precedence, catalog cycles/limits, malformed/DTD/entity input, missing evidence and stable-root CAS conflicts.
- Quotas, WAF, staging isolation, checksums, byte/validation dedup distinctions and immutable rollback.

Read logical members through `packages/vowl/conformance/storage.mjs` and the existing pinned corpus helpers.
Do not reconstruct the removed physical fixture tree or compute expected semantic answers from the same cache/parser execution being tested.
Large hostile cases are deterministically generated under finite bounds.

### 19.3 Cross-runtime and browser qualification

For identical `(bytes, parserDocumentIri, formatId, exact package, stage policy)`, compare parser identity, typed result, import declarations, source evidence and qualification status in Node/Lambda and browser workers.
Then run each qualification corpus through direct-origin and cached acquisition and compare managed graph, semantic result, retained original bytes and canonical bytes where the selected contract requires deterministic bytes.
Acquisition/provenance differences must not change model meaning.

Extend the existing canonical 2,000-class workloads in Chromium, Firefox and WebKit.
Keep the current measured consumer budgets, cancellation, stale-result rejection, memory/work ceilings and source-export ownership.
A cache hit does not authorize raising the embedded-work budget or skipping downstream admission.
Record the actual runtime versions and tested resource policies rather than treating historical qualification as a fresh pass.

Real browser evidence includes cross-origin CORS/preflight, exact POST body hash, automatic 303 follow plus immutable binding retrieval, HTTP cache/304, query exclusion, digest verification, cancellation at each acquisition stage, CSP and direct-only bypass.
Any browser harness/dependency change requires exact configuration approval.

### 19.4 Integration and production evidence boundaries

Node tests and CDK assertions establish local contracts, not live IAM/OAC/CDN behaviour.
Use approved test accounts/endpoints for live canaries only after the exact deployment diff is approved.
Verify no direct Function URL/staging access, no forbidden connection, no control-plane activity on hits, old/new catalog completeness, source-context equivalence, kill-switch isolation and report/cost reconciliation.
Do not contact unrelated ontology publishers merely to create load.

The final implementation route selects the full applicable WebVOWL/AWS suites, package-boundary tests, native formatting/lint/build, CDK synth/nag/diff, installed-bundle audit, licence/SBOM evidence, browser matrix and live canaries.
HISEW profiles `focused`, `affected` and `full` currently invoke `npm run lint`, `npm run test` and `npm run build` in this worktree; those labels do not establish AWS, browser or release coverage.
Recheck current profile applicability before execution; additions/changes to profile configuration need approval.

---

## 20. Traceable vertical delivery plan

The following IDs express the supplied assessment as a draft, falsifiable baseline.
They are not backdated approvals or claims that these tests have run.
The repository owner accepts the requirements and names an integration owner before implementation; that owner coordinates package, schema, client and AWS compatibility across repositories.

### 20.1 Requirements and acceptance criteria

| Requirement                                                                  | Acceptance criterion                                                                                                                                                                                           | Supporting decisions |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| REQ-001: Use a real exact public package without a speculative release gate. | AC-001: Registry/lock/bundle integrity, exports, public format inventory and stage-policy fingerprints agree in both runtimes; rc.1 works without stable/rc.2-only features.                                   | DEC-001, DEC-005     |
| REQ-002: Preserve exact source bytes and contextual meaning.                 | AC-002: Direct/cache fixtures preserve bytes and origin parser context; identical bytes under distinct bases have distinct validation identities; no source/format claim is attached solely to a byte digest.  | DEC-002, DEC-003     |
| REQ-003: Distinguish document, closure, publication and consumer claims.     | AC-003: Incomplete/profile-invalid/resource-exceeded fixtures cannot claim closure validity; complete managed graphs have reproducible member/edge/report evidence and separately recorded consumer admission. | DEC-004              |
| REQ-004: Bound and control every external acquisition.                       | AC-004: Adversarial DNS/redirect/encoding/import inputs cannot connect to forbidden destinations or escape byte/time/work limits; parser/context/entity network attempts are denied.                           | DEC-006, DEC-011     |
| REQ-005: Make retries and publication safe.                                  | AC-005: Duplicate/reordered/crashed jobs converge; stale generations cannot promote; catalogs never reference absent objects or evidence; private staging cannot be fetched publicly.                          | DEC-008              |
| REQ-006: Honour origin metadata and keep immutable snapshot claims precise.  | AC-006: 304/variant/restriction changes reuse only eligible bytes/evidence, conditional requests are resource-scoped, and quarantine removes future mappings without pretending old copies vanished.           | DEC-009              |
| REQ-007: Serve interoperable catalogs without control-plane hits.            | AC-007: Seed-first OASIS and optional JSON resolve identically from one committed generation; complete hit/first-caller paths obtain correct immutable context through CloudFront/S3.                          | DEC-007, DEC-010     |
| REQ-008: Preserve canonical consumer behaviour and rollback.                 | AC-008: Direct/cache corpus and 2,000-class browser workloads agree on semantics/source evidence/typed outcomes and obey unchanged budgets; direct-only bypass and prior deployment recovery pass.             | DEC-002, DEC-012     |
| REQ-009: Operate with explicit privacy, rights and cost acceptance.          | AC-009: Logs exclude raw queries/viewer secrets, source/AGPL obligations and egress controls are reviewed, budget actions preserve site/data-plane health, and observed costs/drills support launch.           | DEC-011, DEC-012     |

### 20.2 Quality scenarios

| Scenario                                     | Stimulus and observable pass condition                                                                                                                                                                             |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| QA-001: Context integrity                    | Serve the same relative-IRI bytes from two origin bases and through the cache; each direct/cache pair agrees, the two validation identities differ, and no artifact URL becomes parser context.                    |
| QA-002: Network containment                  | A public source redirects/rebinds to a prohibited IPv4/IPv6/metadata target; the connection recorder observes zero forbidden connects and the job terminates within its budget.                                    |
| QA-003: Crash consistency                    | Interrupt each §9.4 write/send boundary and replay duplicates/out-of-order generations; only old-complete/new-complete eligible bindings become visible and recovery is bounded.                                   |
| QA-004: Qualification precision              | Supply cyclic/shared imports, a missing member, a profile violation and a valid but over-budget consumer workload; only the fully qualified profile gets `CLOSURE_VALIDATED`, with independent admission outcomes. |
| QA-005: HTTP evolution                       | Refresh 200→304, changed bytes, changed base/format/`Vary`, changed restrictions and timeout; fingerprints/eligibility/freshness change correctly without reusing stale semantic proof.                            |
| QA-006: Browser performance and cancellation | Run direct/cache 2,000-class workloads across Chromium/Firefox/WebKit and cancel during fetch/poll/import/admission; accepted outputs and budgets agree, stale results cannot replace the active document.         |
| QA-007: Availability and recovery            | Disable control-plane work, fail an origin, roll catalog/deployment back and activate bypass; published reads/site remain healthy and direct-only limitations are visible.                                         |
| QA-008: Privacy and economics                | Submit sources/viewer URLs with sensitive query material and simulate quota/budget events; no normal log/public rejection leaks it, new work stops, fixed/shared costs remain explicitly accounted.                |

### 20.3 Slice traceability and proof

In this table, `REQ/AC-001–003` denotes REQ-001 through REQ-003 together with their matching AC-001 through AC-003 criteria; the same inclusive range convention applies to QA/DEC IDs.

| Slice                                                               | REQ / AC / QA / DEC links                                         | Independently demonstrable proof                                                                                                                                          | Release/cleanup implication                                                                                            |
| ------------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| SLICE-001: Pin semantics and qualify one offline source             | REQ/AC-001–003; QA-001, QA-004; DEC-001–005                       | The installed Node/browser package parses one pinned source with a reproducible context/format/policy identity; same bytes at two bases do not alias.                     | No AWS mutation; freeze accepted contract and remove obsolete release/file-map assumptions.                            |
| SLICE-002: Retrieve and validate one bounded source                 | REQ/AC-002, 004, 006; QA-001, 002, 005; DEC-003, 005, 006, 009    | Controlled source → exact bytes/private staging → typed document result, including DNS/redirect/encoding/304 failure proof.                                               | No public unvalidated bytes; egress design/rights decisions precede live use.                                          |
| SLICE-003: Materialize and publish one durable binding              | REQ/AC-002, 005, 007; QA-001, 003; DEC-007, 008, 010              | Local/admitted integration POST → queue → validated immutable artifact/evidence → source commit → catalog/303 resolution, with every crash boundary exercised.            | Introduce versioned schemas/prefixes only after approval; orphan reconciliation preserves referenced data.             |
| SLICE-004: Qualify one managed closure                              | REQ/AC-003–005; QA-002–004; DEC-004, 006, 008                     | Root/diamond/cycle/missing-import fixtures produce exact graph/report manifests through pinned document acquisition, with restart and separate consumer outcome.          | No flattened source; resumable bounded work and stale-member invalidation; publish only the claimed qualification.     |
| SLICE-005: Open the same canonical document directly and from cache | REQ/AC-001–003, 007–008; QA-001, 004, 006; DEC-002, 005, 010, 012 | Current root/import source acquisition and worker sessions produce matching source evidence, semantic result and typed failures with controlled cancellation.             | Cache/bypass composition is reversible; retire only proven redundant live paths.                                       |
| SLICE-006: Revalidate, quarantine and reconcile a published source  | REQ/AC-005–009; QA-003, 005, 007, 008; DEC-008–012                | 304/change/outage/quarantine, lost dirty event, root CAS and policy/package requalification drills preserve permitted old bindings and reject stale proof.                | Complete operations/runbook, privacy-safe reporting, staging/orphan retention and feature-only cost control.           |
| SLICE-007: Dark deploy and qualify approved seeds/canaries          | REQ/AC-001–009; QA-001–008; DEC-001–012                           | Exact CDK diff/synth/IAM/licence evidence, private OAC endpoints, staged seed parity, controlled live first-caller/hit and budget/security canaries.                      | Separate approval for resources, logging/WAF/seed publication; disable admission after canary until rollout authority. |
| SLICE-008: Roll out, observe and hand over                          | REQ/AC-007–009; QA-006–008; DEC-007, 011, 012                     | Full corpus/workload matrix, direct-only/deployment/catalog rollback, seven-day COUNT evidence, approved BLOCK and subsequent observation, report/billing reconciliation. | Retain previous deployment/generations; named observer accepts production outcome and remaining cleanup.               |

### 20.4 Dependencies and integration ownership

SLICE-001 precedes identity-dependent work.
SLICE-002 establishes the network/document contract used by SLICE-003; the latter demonstrates a full single-document publication path before closure and UI expansion.
SLICE-004 and SLICE-005 both consume the frozen document/evidence contract; coordinate their shared schema/policy decisions through one integration owner.
SLICE-006 completes refresh and operational behaviour; SLICE-007 requires those controls, exact configuration approval, cost/egress/rights evidence and seed staging.
SLICE-008 requires the dark/canary gates and explicit rollout authority.

Read-only source inventory, package evidence and account/cost inspection may be semantically independent.
Parallel write work is optional only after owners and shared contracts are frozen; this plan grants no delegation authority.
Use scoped feedback during each slice, affected regression checks at integration and the accepted R2 final verification/independent assurance before release.
Do not rerun every expensive suite after each sentence or helper change.

### 20.5 Migration, resumption and cleanup

This is a new cache schema, not permission to discard historical catalog data.
Seed migration starts from historical accepted logical mappings and a fresh approved source inventory; dry-run and local staging precede exact-account apply.
Bind apply to account/region/bucket/table, reviewed manifest digest and exact package/policy identities.
Partial apply reconciles conditional objects/records by identity before retry; it does not regenerate a manifest silently.

Package or loader-policy changes create new validation/closure/resolution identities and a parallel catalog generation over existing immutable bytes.
Keep the old consumer/generation available until both consumers pass the new contract; a mixed-version reader must reject unsupported evidence rather than reinterpret it.
No revalidation invents source-preservation proof absent from the new package report.
Schema migration, if later needed, declares readers/writers, interruption/reconciliation and rollback before changing durable records.
Do not delete old deployment, source, seed, staging or qualification evidence until reference/retention/incident obligations are resolved.

### 20.6 Unknowns, cheapest probes and re-planning triggers

| Unknown / owner                                   | Cheapest discriminating evidence                                                                                       | Required response                                                                        |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Exact runtime/package support / integration owner | Installed public-package smoke tests in the actual supported Lambda Node patch/runtime and browser worker.             | Replan runtime/bundling on mismatch; do not choose an older package silently.            |
| Context and source qualification / semantic owner | Same-bytes/two-bases, redirects, malformed encodings and incomplete-closure fixtures using current public APIs.        | Fix the acquisition contract or obtain a bounded producer decision; no private shim.     |
| Network defence / infrastructure-security owner   | Controlled connector/canary plus a costed independent-egress comparison.                                               | Owner accepts residual risk or revises topology/budget before live deployment.           |
| Durable republication / source/licence owner      | Review seed directives/rights and exact worker/AGPL corresponding-source obligations.                                  | Exclude the affected source or block deployment until cleared; no fabricated permission. |
| USD 10 feasibility / account owner                | Preceding 90 days of traffic/free-allocation use and current calculator output including WAF/shared logs/closure work. | Reopen scope/topology before resources if headroom is insufficient.                      |
| Catalog and closure scale / consumer owner        | Logical-corpus and 25,000-entry/2,000-class bounded benchmarks.                                                        | Generate an index only if justified; do not relax safety or public consumer limits.      |

Re-baseline on any new public contract, package/policy/decoder/base rule, schema, rights/egress assumption, authority boundary, unacceptable workload result or cost/topology change.
Accepting this plan is not accepting a later changed requirement or test oracle.

### 20.7 Assessment recommendation coverage

| Assessment recommendation group                                                                             | Synthesis location / disposition                                                                                                     |
| ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Exact published RC, no Phase 20/stable/rc.2 dependency; producer improvements optional                      | §2, SLICE-001. The documented native npm alias is retained.                                                                          |
| Canonical acquisition/session seam; exact source rather than reserialization; metadata-owned formats        | §§4–7, 10–11, 17–19, SLICE-001/005.                                                                                                  |
| Separate fetched/document/closure/publication states, context identity, policy/versioning, consumer budgets | §§9, 11, QA-001/004, SLICE-003/004.                                                                                                  |
| Redirect/DNS/SSRF, no ambient network, independent egress                                                   | §§7, 11–12, QA-002, SLICE-002/007. The blanket remoteImports=false wording is reconciled with the injected closure loader.           |
| Explicit decoding and parser-input digest                                                                   | §§4, 10–11. Strict UTF-8 matches the current consumer; unsupported encoding is explicit, not a global release wait.                  |
| HTTP validators/304/variation, conservative IRI identity, differentiated TTLs                               | §§1.1, 4, 7.5, 12.3, 13, QA-005, SLICE-006.                                                                                          |
| Idempotent queue/generations, durable publication, S3 checksums                                             | §§9–10, QA-003, SLICE-003/006. Private staging reconciles pre-validation persistence with the no-public-unvalidated-bytes invariant. |
| One model for OASIS and optional compact JSON                                                               | §§6.4, 10.5. JSON is conditional on benchmark evidence, not a second source of truth.                                                |
| URL redaction, cross-runtime tests, parser regressions, corpus bundling and cache-hit workloads             | §§15, 19, QA-006/008, SLICE-005/008. Raw CloudFront query logging is removed from the proposed fields.                               |
| Previous deployment and cache bypass                                                                        | §§17, 21–23, QA-007, SLICE-008. Direct-only mode retains ordinary CORS limitations and does not promise unavailable source access.   |

---

## 21. Rollout, rollback, and failure semantics

### 21.1 Rollout order

```text
exact public-package and semantic contract proof
  → bounded source → durable single-document publication → managed closure qualification
  → canonical direct/cache equivalence + operational recovery/cost/privacy controls
  → approved private regional resources and dark CloudFront behaviours
  → validated approved seed/catalog + controlled live canary
  → separately approved WebVOWL deployment with direct-only bypass available
  → observed production enablement with WAF COUNT
  → at least seven complete days and representative closure evidence
  → separately approved WAF BLOCK → additional week of observation
  → accepted runbook, budget reconciliation and cleanup disposition
```

The integration owner names a responsible production observer and measurable abort thresholds before each live window: forbidden outbound connection, unvalidated publication, context/digest mismatch, sensitive log disclosure, legitimate WAF blocking, material consumer regression or exhausted cost headroom.
Never deploy the client before stable catalogs and controlled API paths are reachable.
Retain the known-good build and approved direct-only bypass throughout observation; direct-only mode remains subject to origin CORS and cannot guarantee access to every uncached ontology.
Historical seed/catalog parity is proven without restoring the retired runtime constant.

### 21.2 Rollback layers

| Failure                           | First rollback                                                                             | Data preserved                                                        |
| --------------------------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| New-source cost/abuse             | Set `materializationEnabled=false`                                                         | Website, catalog, published artifacts, registry/queue evidence.       |
| WAF false positive                | Change rule BLOCK→COUNT                                                                    | All traffic/data; metrics retained.                                   |
| Client loader regression          | Activate approved direct-only acquisition; deploy prior WebVOWL build                      | Cache infrastructure/catalog remains dark/usable; no source deletion. |
| Bad catalog root                  | Restore prior root version or repoint to prior immutable dynamic generation                | All generations/artifacts retained.                                   |
| Bad dynamic mapping               | Quarantine source and republish generation                                                 | Artifact/provenance retained for audit; seed unchanged.               |
| Worker/parser regression          | Disable admission and event-source mapping; deploy previous worker bundle                  | Pending queue/registry and published artifacts retained.              |
| API regression                    | Disable admission/deploy previous API bundle                                               | S3 data plane remains readable.                                       |
| Distribution behaviour regression | Apply reviewed prior distribution config                                                   | Regional resources remain private; no bucket public fallback.         |
| Security/legal artifact incident  | Quarantine, republish catalog, separately authorize invalidation/object-access containment | Audit evidence retained under incident policy.                        |

Rollback never rewrites immutable artifact/evidence/catalog bytes, reuses a digest path, turns the bucket/staging public, exposes the Function URL, disables TLS checks, bypasses consumer admission or restores a retired source alias.
Read and reconcile exact remote state before retrying interrupted writes.
A package rollback restores the compatible consumer/policy/generation set; it does not reinterpret new validation records under old software.

### 21.3 Ambiguous external writes

For CDK deployment, S3 write, DynamoDB transition, WAF update, budget action, seed application, or publication whose response is interrupted:

1. Stop automatic retry.
2. Read external state using the exact resource/key/revision/digest.
3. Classify the operation as completed, absent, or inconsistent.
4. Retry only an idempotent/conditional operation whose preconditions still hold.
5. Obtain renewed approval for any materially different mutation.
6. Preserve the failed/ambiguous attempt in deployment evidence.

### 21.4 Degraded operation

- Catalog unavailable or incompatible: try controlled direct retrieval, then eligible materialization; direct-only bypass never calls materialization.
- Materialization disabled/unavailable: catalog and direct paths still work; show a specific diagnostic.
- DynamoDB/SQS/Lambda unavailable: published S3/catalog reads still work.
- Upstream unavailable: catalog hit works; unknown source receives transient failure.
- Catalog publisher delayed: first caller receives final artifact directly and session mapping; future catalog discovery waits.
- Transient revalidation fails: eligible last-known-good remains; changed restrictions/quarantine use containment instead.
- Closure qualification incomplete: keep the document mapping with its actual validation level; do not advertise a full closure pass.
- New package/policy cannot read old evidence: bypass/revalidate under the new identity; never infer compatibility.
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
19. Reconcile source/validation/resolution/closure identities, stale-member manifests and document-versus-consumer failures.
20. Recover private staging, lost enqueue/catalog intents and generation-fenced jobs; remove only proven unreferenced objects under approved retention.
21. Activate/verify direct-only acquisition and restore a matching consumer/policy/catalog generation.
22. Diagnose conditional 304, changed Vary/encoding/base restrictions, requalification and source republication eligibility.
23. Verify the chosen independent egress controls or retained owner-approved residual risk and the associated operating cost.

Every procedure names the expected account/region/resource, read command, decision criteria, mutation command/API, postcondition check, rollback, and evidence location. Examples use symbolic identifiers defined in the runbook and must require operators to resolve/confirm them before mutation; they never encourage commands against a wildcard account or broad bucket prefix.

---

## 23. Definition of done

This section defines future implementation/release acceptance, not completion of the present plan synthesis.
Every REQ/AC/QA has dated evidence bound to exact source, package, policy, configuration and catalog identities.

### 23.1 Package and consumer boundary

- Both runtimes use the same exact publicly installable package/integrity and metadata-derived format authority; the documented native npm alias is allowed.
- No retired package/converter tree, private parser path, local/Git/workspace fallback or duplicate package implementation participates.
- Direct and cached bytes reach the current canonical worker/session contracts with the same effective origin parser context and exact original-source exports.
- Root/import acquisition, cancellation, stale-result handling and unchanged resource/admission policy pass the full corpus and 2,000-class Chromium/Firefox/WebKit matrix.

### 23.2 Identity, validation and publication

- Stored SHA-256 identifies content-decoded bytes; character decoding is fatal, explicit and compatible with the consumer, with unsupported encodings reported distinctly.
- Validation identities include parser base, exact public format/package/integrity, policy and contract; byte deduplication never reuses an unrelated context's evidence.
- Document/source/closure/profile/publication/admission claims are separate; incomplete or unverified evidence cannot claim `CLOSURE_VALIDATED`.
- Root manifests preserve exact managed members/edges, cycles/shared imports and full profile/source reports without flattening source documents.
- Private staging is inaccessible through CloudFront; only validated exact bytes and durable evidence become eligible published bindings.
- Conditional generation/lease/policy checks, outbox recovery, SQS duplication/reordering and every persistence-boundary crash drill pass.

### 23.3 Security, privacy and rights

- Every actual connection/redirect is subject to proven URL/DNS/address pinning and finite limits; parser ambient fetch, remote contexts and XML external entities are denied.
- Egress topology and residual risk have explicit owner/security acceptance; IAM/OAC/function/bucket boundaries pass live forbidden-access canaries.
- New-source/closure quotas, WAF COUNT-to-BLOCK evidence, worker concurrency/deadlines, DLQ and kill-switch controls work without disabling the site/data plane.
- No credentials, viewer identifiers, source excerpts or unreviewed query strings enter routine logs or public rejection data.
- Source rights/cache directives, quarantine/takedown and exact deployed AGPL/notices/corresponding-source obligations have no unresolved launch condition.

### 23.4 HTTP and catalog integrity

- Source validators, variants, content decoding and 200/304/restriction changes are reconciled; ineligible immutable republication is rejected and package/policy changes requalify evidence.
- Catalog/artifact/evidence hits are CloudFront/S3 only; first callers obtain immutable parser-context bindings without waiting for the catalog.
- OASIS, seed precedence and optional generated JSON are deterministic and independently validated against the same committed model.
- Immutable/mutable/API cache headers and validators match their identities; query tokens cannot fragment bytes or spoof accepted source context.
- A catalog generation never points to absent objects/evidence; refresh, quarantine, root rollback and cross-store reconciliation pass with honest limits on recalling old copies.

### 23.5 Operations, budget and delivery

- Current account/region/runtime versions, 90-day traffic, WAF shared-distribution cost and the revised closure/staging/egress costs support the accepted USD 10 target with observed headroom.
- USD 7 actual/USD 9 forecast/USD 10 actual controls notify/contain new work as approved; delayed billing and continuing fixed/data-plane costs are explicit.
- Private reports reconcile source work and artifact traffic without unsupported exact viewer-source attribution; retention and query cutoffs operate.
- Known-good build, direct-only bypass, catalog/consumer-policy rollback, DLQ, refresh, quarantine, cost and incident drills are reproducible by the named observer/operator.
- Final relevant HISEW checks, independent verification, scoped security/semantic/operations/licence reviews, browser/live canaries and operator handoff have passing evidence for the accepted target.
- No required configuration, production or delivery decision is inferred.
  Commit, push, deployment and publication occur only within their separately granted authority.

---

## 24. Normative and current guidance references

### 24.1 Revision and package sources

- [Supplied deep-research assessment](../reviews/Validated%20Ontology%20Materialisation%20Cache_%20deep-research%20assessment%20and%20recommended%20plan%20revisions.md), including its 5 October 2026 research cutoff.
  Its opaque original file-citation tokens are not independently retrievable links; this plan cites the supplied file and verified sources instead of treating those tokens as evidence artifacts.
- [Public rc.1 release and downstream acceptance policy](https://github.com/Hadden-Industries/owlapi/releases/tag/v0.1.0-rc.1).
- [Tagged public API](https://github.com/Hadden-Industries/owlapi/blob/v0.1.0-rc.1/API.md) and [npm package](https://www.npmjs.com/package/@hadden-industries/owlapi); exact registry identity and local lock/installed exports checked on 5 October 2026.
- WebVOWL `0fbf00e`: `src/app/js/controller/canonicalVowlSourceAcquisition.js`, `importResolver.js`, canonical session/worker modules, `src/app/js/canonicalApplication.js` and `src/canonical-main.js`.
- Consumer contract evidence: `packages/vowl/src/owl/loading.js`, `policy.js`, `compatibleLoading.js`; logical corpus reader `packages/vowl/conformance/storage.mjs`.
- The prior [standalone package plan](https://github.com/Hadden-Industries/owlapi/blob/main/docs/implementation-plan.md) and [lifecycle plan](https://github.com/Hadden-Industries/owlapi/blob/main/docs/ontology-lifecycle-capability-implementation-plan.md) remain historical context, not gates overriding the published RC contract.
- `amazon-aws` stack/rewrite/cost-control paths in §§5/14/18 remain predictions requiring current repository and account inspection before implementation; no deployed inventory is established by this revision.

### 24.2 Web and catalog standards

- [OASIS XML Catalogs 1.1](https://www.oasis-open.org/standard/xmlcatalogs/)
- [WHATWG Fetch Standard](https://fetch.spec.whatwg.org/)
- [WHATWG DOM Standard — `AbortSignal`](https://dom.spec.whatwg.org/)
- [W3C Web Cryptography Level 2](https://www.w3.org/TR/WebCryptoAPI/)
- [RFC 3986 — URI syntax, resolution and comparison](https://www.rfc-editor.org/rfc/rfc3986.html)
- [RFC 8246 — Immutable HTTP responses](https://www.rfc-editor.org/rfc/rfc8246.html)
- [W3C OWL 2 structural specification and imports closure](https://www.w3.org/TR/owl2-syntax/)
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
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
