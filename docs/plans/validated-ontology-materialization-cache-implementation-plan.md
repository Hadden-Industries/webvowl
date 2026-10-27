# Validated Ontology Materialization Cache Implementation Plan

> **Status:** Revised draft implementation plan, 27 October 2026; implementation and release require the acceptance gates below.<br>
> **Original proposal:** [Codex discussion: validated ontology materialization cache](codex://threads/01a034b3-1c88-7a82-8b49-3a319c8b459a).<br>
> **Revision basis:** The [deep-research assessment](../reviews/Validated%20Ontology%20Materialisation%20Cache_%20deep-research%20assessment%20and%20recommended%20plan%20revisions.md), the AWS stack-separation plan's historical revision 6 dated 15 October 2026 and coordinated revision 9 draft contract dated 27 October 2026, current WebVOWL source/dependency contracts including the uncommitted 27 October limits amendment and implementation, and the owner's subsequent decisions on admission, permanent version history, discovery, refresh, reusable service ownership, contract-first delivery and the Universal Ontology trial corpus.
> Exact evidence boundaries are recorded in §2.6.<br>
> **Package baseline:** WebVOWL selects the immutable OwlAPI Git commit `36e28374447d94d9734960aaed6d3ab4be52ca17` through the native dependency name `owlapi`; its package version is `0.1.0-rc.2`.
> Source selection, installed payload, dependency closure and Node/browser qualification remain distinct evidence (§2).<br>
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

The assessment's byte-preserving S3/DynamoDB/SQS/CloudFront design remains the baseline.
This revision reconciles its dependency and consumer contracts with current WebVOWL and adopts the AWS plan's lifecycle, policy-writer and shared-delivery boundaries.
The owner accepted broad eligible public-source admission, a permanent archive with one record per distinct version per URI, exact-source dynamic discovery, request-triggered background refresh and deferred general server closure precomputation.
No scheduled source checking, population-wide entry ceiling or automatic replacement of an open graph is proposed.
Agree the provider-owned contract first, deliver WebVOWL with all cache integration disabled, then qualify the actual AWS integration before enabling it.
Parallel implementation is optional; WebVOWL is the first consumer of a reusable ontology-document cache.
The following decision IDs identify the proposed revised baseline throughout this plan.

| Decision | Revised constraint                                                                                                                                                                                                                                                                                                                |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DEC-001  | Qualify the same exact selected OwlAPI artifact in both runtimes. Use WebVOWL's single native npm selector, supporting an exact registry alias or full immutable Git commit; verify payload and dependency identities, not version strings alone.                                                                                 |
| DEC-002  | Integrate at canonical source/import acquisition, before worker-owned document admission. Preserve the `vowl/owl` and document-session contracts; do not recreate retired converter/controller/Turtle-writer paths.                                                                                                               |
| DEC-003  | Keep exact acquired bytes, requested IRI, effective origin retrieval IRI and parser document IRI distinct. Deduplicate only byte objects; validation evidence includes context, exact package, parser and policy.                                                                                                                 |
| DEC-004  | Separate acquisition, document validation, closure qualification, publication and consumer admission. First release retains existing browser closure checks and parity fixtures; general server-side closure precomputation is deferred. Never flatten authoritative source documents.                                            |
| DEC-005  | Derive syntax identities, media types, aliases and parser candidates from public `OWLDocumentFormats`. Version application preference ordering, decoding and loader policies; do not maintain a second format catalogue.                                                                                                          |
| DEC-006  | Application acquisition owns all networking. Document validation has no import retrieval; closure loading uses only the injected controlled loader. Deny ambient fetch, remote JSON-LD contexts and XML external entities.                                                                                                        |
| DEC-007  | Keep the existing pay-as-you-go CloudFront distribution, dedicated private S3 origin and OAC-protected Function URL. Foreground cache reads depend only on CloudFront/S3; optional asynchronous refresh has a separate bounded control-plane path. Route 53 stays independently managed.                                          |
| DEC-008  | Use immutable checksum-verified objects, conditional leases, source generations and fenced publication. READY follows durable source commit; static per-source pointer or curated catalog publication is the later discoverability commit.                                                                                        |
| DEC-009  | Preserve source validators and HTTP variation/revalidation metadata. Only representations admitted for durable republication receive the immutable lifetime. Conditional refresh never launders changed cache restrictions.                                                                                                       |
| DEC-010  | Publish curated OASIS seed catalogs and exact-key dynamic source pointers from committed state. Dynamic sources have no global browsable listing; neither ordinary lookup nor publication of one source scans the archive.                                                                                                        |
| DEC-011  | Minimize logs, use an explicit egress/security decision, preserve source rights/takedown controls, and contain cost by disabling new work rather than the shared website or published data plane.                                                                                                                                 |
| DEC-012  | Qualify direct and cached acquisition against the same installed package, logical corpus and canonical workloads. Preserve a tested direct-only bypass and known-good deployment throughout rollout.                                                                                                                              |
| DEC-013  | Separate retained materialization storage, replaceable service and late access bindings; the actual shared delivery owner composes the distribution, WebACL, behaviours, response policies and logging.                                                                                                                           |
| DEC-014  | Freeze one shared contract/fixture authority and qualify an exact AWS/WebVOWL candidate pair; provider readiness precedes consumer enablement and rollback preserves a compatible pair.                                                                                                                                           |
| DEC-015  | Preserve browser automatic/explicit syntax and worker/session lifecycle. Adopt the amended `operationLimitDefaults` package contract, separate application-owned defaults and actual acquisition/adapter limits. Service validation retains its own finite policy; direct/cache admission and policy evidence must agree (§11.2). |
| DEC-016  | Retain one permanent record per exact URI and one immutable source-version record per distinct bytes/context combination for that URI. Deduplicate bytes globally; attempts and validation revisions are separate history. No global entry or version-count ceiling.                                                              |
| DEC-017  | Serve eligible archived bytes immediately. On explicit use, revalidate conditionally in the background when due; provide the same secured per-entry refresh operation to users and automation. No scheduled origin checks; no graph replacement without explicit user action.                                                     |
| DEC-018  | Automatically admit public HTTP(S) sources that pass acquisition, parsing and publication/security controls. No publisher allowlist or individual approval workflow. Withdrawal and confirmed content incidents override ordinary archival retention/access.                                                                      |
| DEC-019  | Keep the reusable cache's versioned public contract and shared conformance fixtures in `amazon-aws/validated-ontology-cache/contracts/`. Deliver the WebVOWL consumer with caching disabled before AWS implementation is complete; real-provider/browser proof precedes activation.                                               |
| DEC-020  | Use non-GitHub source, ontology and import IRIs evidenced in the pinned Universal Ontology external collection as trial candidates. Separate deterministic offline qualification from bounded live trials; corpus inclusion is neither a publication allowlist nor evidence that a source currently works.                        |

Public `owlapi` loading, source evidence, managed graph and profile APIs are reused as native consumer capabilities.
The residual custom work is controlled acquisition, immutable storage, contextual evidence, publication and operations.
No compatibility shim or parser implementation is proposed.
The existing local import name `owlapi` and native npm selector/override are retained (§2.3).

### 1.1 Retention, freshness and HTTP lifetimes

These are independent policies; a long-lived archive is not a claim that its contents are still the origin's latest version.

| Resource                                                      | Mutability                    | Selected policy                                                                                                     | Meaning                                                                                                                                                   |
| ------------------------------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Content-addressed artifact and source-version/evidence record | Immutable                     | `public, max-age=31536000, immutable` when eligible for public delivery                                             | Changed bytes/context receive new identities; unchanged checks reuse existing versions.                                                                   |
| Curated seed catalog generation                               | Immutable                     | `public, max-age=31536000, immutable`                                                                               | A new curated mapping set receives a new generation path.                                                                                                 |
| Stable seed catalog root and exact-source current pointer     | Mutable                       | `public, max-age=300, stale-while-revalidate=60, stale-if-error=86400`                                              | Short-lived discovery of a committed immutable binding; this edge lifetime does not check the external ontology origin.                                   |
| Upstream source freshness                                     | Mutable external state        | Conditional, use-triggered check when due; explicit refresh can request an earlier check subject to cooldown/quotas | Honor applicable origin freshness/revalidation metadata; freeze and justify a finite fallback in SLICE-001 where metadata is absent. No scheduled checks. |
| Accepted URI and distinct version history                     | Permanent application archive | No age-based expiry or global entry/version ceiling; safety/rights exceptions still apply                           | Preserve every distinct eligible version, with one version record per URI/version and shared byte objects (§9.1/§15.3).                                   |
| Invalid-ontology result                                       | Mutable negative result       | 24-hour retry suppression                                                                                           | Prevent repeated expensive parsing without permanently rejecting a URI.                                                                                   |
| Transient retrieval failure                                   | Transient                     | 15-minute retry suppression                                                                                         | Reduce amplification while allowing later use or explicit retry.                                                                                          |

A fresh HTTP response normally needs no origin request; HTTP stale-while-revalidate permits bounded nonblocking revalidation after expiry.
Our deliberate application archive can show an eligible older snapshot with acquisition/last-successful-check dates, rather than claiming a fresh origin response.
A source's storage/republication restrictions remain authoritative.
See [RFC 9111 §§4/6](https://www.rfc-editor.org/rfc/rfc9111.html#section-4), [RFC 5861 §3](https://www.rfc-editor.org/rfc/rfc5861.html#section-3) and [CloudFront stale-content guidance](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/Expiration.html#stale-content).
CloudFront revalidates against S3 in this design; the application refresh service owns checking third-party sources.

---

## 2. Mandatory starting checkpoint

The old Phase 20/stable-release gate and deferred `0.2.0` lifecycle assumptions are superseded by this checkpoint.
SLICE-001 establishes the package and semantic contracts before storage or infrastructure implementation.

### 2.1 Exact selected package adoption

On 27 October 2026, WebVOWL's root manifest and lock select:

```text
owlapi = git+https://github.com/Hadden-Industries/owlapi.git#36e28374447d94d9734960aaed6d3ab4be52ca17
package name/version = @hadden-industries/owlapi / 0.1.0-rc.2
lock integrity = sha512-4nQ2GrshB2+e8aMGIwIT9dSMHU4kcGiu13nyHjDXMe5q/CFBtZ+6m3ESGWRPhnEOeTDvqY/i3b05BtxnJICE5Q==
```

Installed metadata reports that name/version and `node >=22.0.0`.
These are source/lock/metadata observations, not fresh payload, runtime, browser or Lambda qualification.
The October 5 registry `rc.1` result and the AWS plan's October 15 registry `rc.2` observation remain historical evidence; neither qualifies these newer same-version Git bytes.
No new registry publication or speculative stable release is a prerequisite.

Before implementation, freeze the exact selector, source revision, acquired archive integrity, installed file manifest, complete dependency lock, public export map, engine/runtime identities, format inventory and resolved stage policies in both repositories.
Follow the existing [OwlAPI dependency selection contract](../owlapi-git-adoption.md) and `src/owlapiConsumerBoundary.architecture.test.js`: verify the selected archive and every installed package file independently of the installed payload being tested, with one package copy.
A generated lock integrity alone is insufficient for Git acquisition; retain the source-to-archive verification and the consumer's archive-to-installed-payload checks.
Then qualify the isolated installed Node consumer and actual production browser worker; bind deployed bundles to that evidence.
Record the AWS runtime selector separately until the exact artifact is deliberately adopted and qualified there.

### 2.2 Existing capabilities and conditional reuse

Reuse supported public manager/source/configuration/error APIs, `OWLDocumentFormats`, managed graph loading/closure queries, source/parser metadata and asynchronous `OWL2DLProfile` reports.
Storage/lifecycle support does not make reserialization part of this source cache.
Derived syntax output, if later approved, keeps a separate namespace, digest and derivation provenance.

Preserve the existing consumer's effective `normative-v1` behavior, including where selected by the public default; inspect and fingerprint the selected artifact's actual APIs/defaults.
`java-owlapi-5.5.1` is an optional alternative requiring a separate accepted consumer change, not an unresolved first-release choice.
These are loader behaviors, not OWL 2 DL conformance.
Bind each selected profile to its context/decoder/import/error/limit policy and independent fixtures.
Do not inherit permissive or unbounded defaults merely to match a producer profile.
The optional Node transport exported at `owlapi/io/node` is a reuse candidate, not a browser transport or proof of SSRF containment.
Its redirect/base, import and secondary-fetch behavior must pass §4.2 and §12 before adoption.
Keep the current browser's strict UTF-8 text-source boundary unless a separately accepted consumer change qualifies an alternative.

The observed installed production dependencies include `lzma-native@8.0.6` and `iconv-lite@0.7.3`.
Reconcile the entire exact production dependency closure even when XZ/legacy decoding or Java mode is unused.
Before deploying the worker, prove install-script policy compatibility, Linux Lambda ARM64 native loading where applicable, browser bundle inclusion/exclusion, cold-start/memory/work bounds, security disposition and licence/notice obligations.
Do not infer current clearance from producer merge status or the AWS plan's dated release/security observations.

A later artifact change requires exact adoption in both runtimes, new policy/validation identities, the same parity matrix and requalification of retained bytes as needed.
Existing byte objects need no redownload solely because validation software changes.
Producer byte-source or fingerprint improvements remain optional; only a concrete required public-contract failure creates a producer workstream.

### 2.3 Public API and consumer boundaries

The observed exports are `.`, `apibinding`, `model`, `io`, `io/node`, `formats`, `profiles`, `util`, `model/parameters`, `search`, `manchestersyntax/renderer` and `modularity/locality`.
Record the selected artifact's actual export map; this list is an observation, not permission to use every export in the browser.
The root `dependencies.owlapi` selector is the application's single authority.
Its native `owlapi: "$owlapi"` override makes the private workspace use the same package, while public import specifiers remain `owlapi/...`.

An exact registry alias or the approved full-commit Git selector is supported.
Reject mutable tags/branches, source-tree copies, `file:`/linked runtime fallbacks, private/deep imports, bundler aliases to implementation files and duplicate package implementations.
The private `vowl` workspace is an existing consumer boundary, not a source fallback for OwlAPI.
Any selector/lock/runtime change still needs exact configuration approval.

The browser receives exact bytes through `canonicalVowlSourceAcquisition` and passes them to worker-owned `vowl/owl`.
Do not move manager construction into the UI or replace this with a main-thread `StringDocumentSource` path.
Use consumer-native API/schema validation rather than copying the parser, format grammar or package-selection rules.

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
This is a planning-only revision using HISEW's planning framework; no cache execution, implementation acceptance or release baseline is claimed.
The IDs in §20 are proposed traceability, not invented historical approvals.

The proposed implementation route is **R2**: public network and publication contracts, persistent generations, cross-system concurrency, privacy, financial controls and shared-distribution availability are material.
Maksym Shostak retains accountable integration/acceptance ownership as recorded in the AWS plan; delegated infrastructure/security operators and the production observer must be named before their operations.
Required future lenses are semantic/package parity, SSRF/security/privacy, concurrency/publication, AWS operability/cost and licence/republication review; scoped native security assessment and independent assurance belong to implementation qualification.
This synthesis does not run a security scan or certify those gates.

The beneficiary remains a WebVOWL user opening public ontologies reliably.
Reassess whenever a proposed optimization changes parser meaning, source rights, consumer limits, site availability or the USD 10 operating target.
No locally faster cache result compensates for a different ontology or an unsafe outbound request.

---

### 2.6 Reconciliation evidence and limits

- WebVOWL committed baseline inspected: `7a298176a9cb7fff31c89069a63d6746bf9bf23a`.
  The selected OwlAPI source/lock identity is refreshed in §2.1. Scoped comparison with the prior `0f6aa8bc25ff1a89424b690c01a4da825ddb50d6` baseline found no committed changes to the inspected acquisition/session/worker/loading/resource-budget owners; dependency changes are still material to qualification.
  Source/lock observations are not installed-payload, browser, deployment or release acceptance.
- The [AWS stack-separation plan](https://github.com/Hadden-Industries/amazon-aws/blob/main/docs/plans/2026-09-30-hadden-industries-aws-stack-separation.md) was read as local revision 6, dated 15 October, based on committed revision 5 at `87418ae0a90aee52e7e4b67d21aef8830cdbea42`.
  The revision-6 input SHA-256 is `4b24134650bca749ed23ed2b7562afeec5a36e5fd8614a140c9799cb6be6edc4`, now read from AWS checkout `50a797dad47893b73588a905ea8f8305756a8c7d`.
  The coordinated local revision 7 carries this delivery/contract/corpus reconciliation; remote links may still show revision 6.
- AWS §§4.4–4.6, 9.4–9.6 and SLICE-011–014 govern infrastructure ownership, deployment sequencing, shared contracts and operating gates.
  This plan supplies the consumer/cache requirements and eight cache slices.
  §20.4 joins their evidence.
- The original assessment remains historical input.
  Current source/lock contracts supersede its retired paths, registry-only restriction and mandatory pre-load format-selection assumptions.
- The owner explicitly requested synthesis of the uncommitted limits implementation.
  The 27 October unbounded-limits amendment (`docs/specs/2026-10-27-canonical-vowl-unbounded-limits-amendment.md`, an uncommitted authoring input) and its current working-tree implementation are therefore the planning baseline for §11.2, even before a commit exists.
  The inspected public export is `operationLimitDefaults`; WebVOWL owns `APPLICATION_LIMIT_POLICY`, `APPLICATION_LIMITS` and `MODEL_OPERATION_LIMITS` separately.
  The OWL adapter now derives import/profile bounds, separates expanded XML from input bytes and reports caught host-resource exhaustion.
  The unchanged acquisition layer retains its independent byte/import gates; it does not restore every removed adapter cap.
  These source observations supersede the former limit assumptions in this plan.
  They are not a claim that the amendment, tests, browser builds or cache integration have passed qualification.
  Reuse the implementer's changes and fixtures rather than reimplementing them.
  Bind the relevant working-tree hashes and later commit identities to implementation evidence; unrelated lexical, UI and performance edits remain outside this planning revision's authority.
- The Universal Ontology trial input is `src/external` at `e34ced0935e2ac384a679476e186d68817a29021`, with no changes in that directory when inspected.
  Its 40 ontology/source-sidecar pairs include 24 non-GitHub source URLs and 16 GitHub source URLs; embedded ontology/import IRIs form a separately classified candidate set (§19.2.1).
- This reconciliation is local document/source inspection, not fresh AWS inventory, price verification, installed-payload testing or live browser qualification.
  Refresh those facts at their named gates.

---

## 3. Scope and non-scope

### 3.1 In scope

- Exact source-document mapping from an ontology/import IRI to a validated immutable artifact IRI.
- Curated migration of the last accepted historical WebVOWL ontology mappings and current approved `/ontology/external/` seed material.
- A browser loader that attempts per-load bindings, curated seed catalog, exact-key dynamic lookup, direct HTTPS-capable retrieval and eligible materialization in that order.
- Top-level IRI loading and transitive import loading through the same application-owned loader.
- Server-side bounded retrieval of public HTTP(S) representations that browsers cannot read because of CORS or mixed-content policy.
- Context-bound server document validation and browser managed closure/profile parity through the exact public `owlapi` package, with source assessment and consumer admission recorded separately.
- Permanent distinct-version history with content-addressed S3 deduplication, exact-source provenance/current pointers, curated OASIS catalogs, use-triggered/manual refresh and dated attempt history.
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
  Preserve existing browser managed-import/profile checks and qualify their parity.
  General server-side closure precomputation, its queues and handlers are deferred beyond first release.
- Automatic alias creation from a parsed ontology IRI, version IRI, namespace, redirect target, `owl:sameAs`, or HTTP canonical link.
- Remote JSON-LD context retrieval or XML external-entity retrieval during validation.
- User accounts, API keys, per-user quotas, billing, or a paid service tier.
- A new CloudFront flat-rate plan, a new production distribution, or transfer of Route 53 management.
- Lambda response streaming, API Gateway, ElastiCache, RDS, OpenSearch, Kinesis, Firehose or a continuously running server.
  VPC/NAT or a controlled egress service is not assumed; §12.8 requires a costed security decision before deployment.
- A browser-to-DynamoDB lookup path or a foreground cache-read dependency on Lambda.
  Use-triggered asynchronous refresh is separately admitted and may invoke the control plane.
- A complete browser implementation of every OASIS catalog entry type.
  WebVOWL consumes the exact safe profile generated by this service: `uri`, `nextCatalog`, `xml:base`, and foreign-namespace metadata.
  The published files themselves remain OASIS XML Catalogs 1.1 conformant.
- Service-worker, IndexedDB, or localStorage persistence for the catalog.
  Browser HTTP caching and one in-memory resolution map are sufficient initially.
- New TypeScript source or declarations.
  Both repositories retain their accepted JavaScript/Python technology choices unless separately approved.

---

## 4. Domain language and naming registry

| Term / field                                      | Exact meaning                                                                                                                                                                      |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Requested document IRI / `requestedDocumentIri`   | The exact accepted logical IRI supplied to acquisition; the source/catalog key, retained independently of transport serialization.                                                 |
| Retrieval IRI / `retrievalIri`                    | The parsed HTTP(S) request target, with any browser HTTPS upgrade and fragment removal performed only for transport.                                                               |
| Effective retrieval IRI / `effectiveRetrievalIri` | The final upstream origin IRI after validated redirects, never the cache object URL.                                                                                               |
| Parser document IRI / `parserDocumentIri`         | The explicit source context passed to `owlapi` for relative-reference resolution. The direct and cached paths use the same context-selection policy.                               |
| Artifact IRI / `artifactIri`                      | The immutable CloudFront location of published representation bytes; it is not a parser base.                                                                                      |
| Ontology/version IRI                              | An identifier declared by the ontology, retained as metadata and never inferred as a dynamic alias.                                                                                |
| Source key / `sourceKey`                          | Lowercase SHA-256 of the exact accepted requested IRI's UTF-8 bytes. It is not a byte digest or secret.                                                                            |
| Materialization ID / `materializationId`          | Version 1's public request/status identifier, equal to `sourceKey`; source generation still fences each job.                                                                       |
| Artifact digest / `artifactSha256`                | SHA-256 of the exact representation bytes after HTTP content decoding and before character decoding.                                                                               |
| Validation identity / `validationIdentity`        | Digest of bytes, parser context, automatic/explicit and observed format, exact artifact identity, loader-policy fingerprint and validation-contract version.                       |
| Resolution identity / `resolutionIdentity`        | Digest of an immutable source-generation binding to an artifact, parser/format context and its validation evidence.                                                                |
| Closure digest / `closureDigest`                  | Digest of a root identity, exact member validation identities, resolved direct-import edges and qualification policy; not a merged ontology digest.                                |
| Loader profile / `loaderProfileFingerprint`       | Digest of canonical, fully resolved stage-specific parser/decoder/limit/format policy. Document and closure modes are distinguished.                                               |
| Catalog generation / `catalogGenerationSha256`    | Digest of the deterministic committed mapping model, including evidence bindings; generated XML/optional JSON have their own verified object checksums.                            |
| Publication                                       | Making a durable eligible binding discoverable through its exact-source pointer or a curated catalog, with an explicit validation level. READY may precede this static projection. |
| Last-known-good                                   | A previously published source binding whose access remains allowed by publication policy; refresh failure does not replace it or reset successful-check time.                      |
| Source version / `sourceVersionIdentity`          | Immutable identity of one source key, byte digest and origin/parser context. Repeated observation, software revalidation or return to an earlier version does not duplicate it.    |
| Refresh attempt / `refreshAttemptId`              | One admitted origin-check operation, with independent start/end times and outcome; coalesced requests/polls are not new attempts or source versions.                               |

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

This is the current WebVOWL policy, not a universal rule for every optional Node loader/profile.
Characterize original-request versus final-response parser bases for each selected transport and behavior profile, including separate JSON-LD document/context redirect fixtures where applicable.
The AWS plan records normative final-base and Java-compatible original-base behavior as candidates to qualify against the exact artifact.
A JSON-LD context's final context URL has its own resolution semantics; it must not be conflated with the ontology document base.
Version and qualify any differing service policy rather than silently changing the browser's meaning; remote context retrieval remains denied by this plan.

The validation identity is a domain-separated SHA-256 of a deterministic canonical record containing:

```text
artifactSha256, parserDocumentIri, formatSelectionMode, explicitFormatId,
observedFormatId, owlapiArtifactIdentity,
loaderProfileFingerprint, validationContractVersion
```

Use an unambiguous canonical JSON serialization with fixed schema, encoding and field treatment; not string concatenation with an informal delimiter.
Retain the canonical policy bytes alongside their hash.
The artifact identity includes the exact selector/source/archive and installed-payload identity, with the dependency closure bound in the candidate evidence; a version string is insufficient.
The fingerprint includes resolved defaults, behavior profile, decoder and secondary-context rules, source-context selection, automatic/explicit syntax selection, stage, format metadata, resource policy and qualification mode; timestamps, signals and invocation IDs are excluded.
The versioned policy schema represents a logical unbounded limit as `{"kind":"unbounded"}` and a finite limit as its exact safe integer, including zero only where the owning contract permits it.
Encode these values explicitly before canonical serialization; never serialize raw `Infinity` into JSON or use `null` as a generic unbounded/default marker.
Retain the resolved package/application policy and dependency translation rules separately, so logical `Infinity` and `Number.MAX_SAFE_INTEGER` cannot alias merely because the dependency receives the same numeric bound.
Fingerprint the configured whole-operation allowance and its derivation rules, not changing elapsed/remaining time or counters; those observations belong to attempt evidence.
This encoding belongs to policy evidence, not the public JavaScript options contract or an anonymous HTTP limit-override capability.
Same bytes under two parser bases must produce distinct validation identities and may produce different relative IRIs.

---

## 5. Current-state migration anchors

These owners were rechecked against the 27 October source baseline in §2.6.
The acquisition seam remains valid, but its format policy and downstream worker/session contracts have evolved since October 5.
Recheck them at implementation start.

| Existing owner                                                                                                                                                                | Responsibility and planned seam                                                                                                                                                                                                                        |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/app/js/controller/canonicalVowlSourceAcquisition.js`                                                                                                                     | Owns exact bounded root/import bytes and optional explicit syntax selection. Inject cache resolution here; preserve `{ bytes, documentIri, mediaType? }`, leaving mediaType absent for automatic compatible ingress.                                   |
| `src/app/js/controller/importResolver.js`                                                                                                                                     | Current `WebVowlImportResolver.loadBytes` performs controlled browser fetch and returns redirect context. Refactor its identity/retrieval distinction behind the acquisition owner; retire only superseded paths after consumer proof.                 |
| `src/app/js/controller/canonicalVowlDocumentSession.js`                                                                                                                       | Owns session cancellation, worker admission, source/export ownership and stale-result handling. Cache work participates in the same session lifecycle.                                                                                                 |
| `src/app/js/controller/canonicalVowlWorkerClient.js`, `canonicalVowlWorker.js`, `canonicalVowlWorkerOperations.js`, `canonicalVowlWorkerPolicy.js`, `canonicalVowlFailure.js` | Own lazy modules, application limit selection, transport checks, whole-job deadlines, safe resource outcomes, preview/final ordering and model authority. Preserve their distinct boundaries and close the diagnostic gap identified in §11.6.         |
| `src/app/js/canonicalApplication.js`, `src/canonical-main.js`                                                                                                                 | Current application composition and bootstrap; inject the acquisition dependency and approved bypass/configuration here.                                                                                                                               |
| `src/app/js/loadingModule.js`, `ontologyLifecycle.js`                                                                                                                         | Existing UI/lifecycle consumers; change only the integration needed for canonical acquisition and status.                                                                                                                                              |
| `packages/vowl/src/resourceBudget.js`, `errors.js`, `owl/loading.js`, `owl/policy.js`, `owl/compatibleLoading.js`                                                             | Own the amended package defaults/override domain, host-limit taxonomy and derived parser/profile bounds, plus format, fatal UTF-8 and closure behavior. Reuse this uncommitted contract as evidence; cache work does not fork its validator or mapper. |
| `packages/vowl/conformance/storage.mjs`, `packages/vowl/test/independentCorpus.js`                                                                                            | Logical corpus/member readers and frozen pins; reuse them instead of copying the pre-consolidation fixture tree.                                                                                                                                       |
| `src/shared/js/util/resolveFetchUrl.js`                                                                                                                                       | Retain unrelated retrieval behaviour; do not route canonical JSON or generic URLs into ontology materialization.                                                                                                                                       |

The old `src/owl2vowl/js` converter/constants/resolver and local `src/owlapi-js` trees are retired.
There is no future task to edit or delete those absent files.
The current canonical resolver is a different, live owner and must not be deleted by a stale path/symbol checklist.

The AWS plan is the authority for the current/proposed stack, shared delivery, publication/query namespaces and whole-distribution cost cutoff; §§14 and 20.4 reconcile the cache integration with it.
SLICE-001 must inspect actual owners, logical IDs and live settings before an exact configuration proposal; this revision does not claim fresh AWS inventory.

Relevant consumer changes include October 6 automatic syntax loading, the October 8 desktop resource profile, subsequent controller/search state work, October 21 lifecycle centralization, and October 23–26 preview ordering and lazy worker/copy improvements.
Keep those accepted semantics in the parity oracle; renderer/layout optimizations alone do not require cache protocol changes.
The uncommitted limits changes are incorporated here as current contract input, not deferred until they are committed.
Root acquisition is unchanged, while package defaults, browser policy ownership and downstream import/profile/XML admission have changed; §11.2 records the effective boundaries and §19 requires direct/cache parity against them.
Other in-progress lexical/performance changes are recheck triggers only where they affect that candidate; no unrelated source changes are adopted or qualified by this revision.

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
  → exact bounded bytes + origin parser context + preserved automatic/explicit format policy
  → worker-owned vowl/owl and public owlapi managed document graph
  → source/closure profile assessment and consumer admission
  → canonical model/projection under existing resource policy
```

Byte retrieval changes location; it does not change source semantics, import identity, parser policy or projection rules.
The browser keeps its public managed graph and independent import acquisition.
A future separately approved server closure qualifier would reuse the controlled acquisition interface, not create a generic proxy or another ontology implementation.

### 6.2 Plane and owner boundaries

| Plane                  | Owner and invariant                                                                                                                                                                                              |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Data                   | Foreground CloudFront/private S3 reads serve immutable bytes/version/evidence and static source pointers/curated catalogs. Optional refresh uses the separate control plane and cannot become a read dependency. |
| Browser acquisition    | One session-scoped acquisition owner supplies bytes/context to root and import consumers, with cancellation and aggregate limits.                                                                                |
| Control                | API, registry, queues and worker own bounded admission, retrieval, validation and conditional promotion; Lambda returns small state/error/redirect responses only.                                               |
| Semantic qualification | The installed `owlapi` owns parsing/managed closure/profile APIs; the `vowl` consumer owns canonical/compatible admission.                                                                                       |
| Operations             | Minimized logs, metrics, reports, quarantine, refresh, cost and rollback controls operate asynchronously.                                                                                                        |

### 6.3 Deep module seams

Use four cohesive seams: byte acquisition with explicit source context, the materialization HTTP contract, a registry that owns transitions rather than raw table operations, and a deterministic catalog/evidence projection.
Clock, DNS/connector, Fetch and AWS clients are genuine external test boundaries.
Do not mock `owlapi`, duplicate its grammar or introduce an interface for every internal helper.

Apply HISEW DRY-01 at each deployment boundary: OwlAPI owns syntax/public loader semantics; `vowl` owns admission/mapping; canonical acquisition/session owns browser transport and lifecycle; AWS owns service state/network/publication; shared delivery owns edge policies.
The jointly reviewed schema/fixture set in §20.4 owns cross-repository meaning. Browser and Node adapters may be separate implementations because their transport/failure boundaries differ; bind them to the same versioned fixtures instead of copying parser rules or forcing a shared runtime library.

### 6.4 Discovery and archive scale

Curated seeds remain publicly enumerable through a bounded OASIS catalog.
Dynamic entries are looked up by the exact source key through the static source-provenance/current-pointer object; no global dynamic catalog, source list or full-archive browser index is published.
Hash-based lookup limits enumeration features, not access: the key is not a secret and anyone knowing a public source URI can derive it.

Remove the proposed 25,000-entry ceiling.
Archive population and distinct version history have no fixed count limit; per-document, per-request, per-session and admitted-work safety bounds remain finite.
Source lookup and publishing one source must remain independent of total archive size.
History queries use bounded source-key pagination rather than a scan; reporting/reconciliation scan only bounded pages/checkpoints.
Benchmark a small and substantially larger registry (including more than 25,000 entries) to prove identical lookup work, plus bounded curated-catalog byte/parsing workloads.
The curated XML profile keeps its 8 MiB aggregate and structural limits (§10.6); exceeding them requires curated publication/partition changes, not refusing unrelated dynamic entries.
An optional compact seed JSON projection is justified only by measurement and generated from the same curated model.

---

### 6.5 Reusable provider contract and consumer profiles

The service is a reusable public ontology-document materialization/archive capability owned by `amazon-aws`; WebVOWL is its first supported consumer.
Keep protocol schemas, source/version/binding identities, fixed document-validation policy, HTTP behavior, independently reviewed fixtures and compatibility rules under `amazon-aws/validated-ontology-cache/contracts/`.
The provider owner maintains that authority with review by affected consumers.

The provider-owned draft contract 1.0.0-draft.2 in [amazon-aws](https://github.com/Hadden-Industries/amazon-aws), at `validated-ontology-cache/contracts/README.md`, now supplies the proposed protocol, OpenAPI 3.2.1 description, Draft 2020-12 schemas, identity vectors, lifecycle examples, conformance matrix and pinned trial inventory.
Its adjacent `decisions.v1.md` uses the HISEW evidence ladder and distinguishes inherited constraints from proposed gap resolutions; Gate A agreement/publication remains open.
The concrete additions include permanent major-1 path semantics, versioned response envelopes, immutable policy evidence, finite freshness/cooldown/queue/parser candidates and 404 for unknown status versus 410 for known retired status.
These resolve the earlier wire placeholders for review; the protocol, schema and HTTP matrix must agree before they become an implementation baseline.
These paths identify the local unpublished review artifact; a consumer/CI acquisition mechanism still requires the accepted immutable publication pin.
WebVOWL contributes consumer interaction tests and owns its adapter, worker/model limits, session lifecycle and user experience.

The version-1 boundary returns exact bytes plus explicit provenance, parser context and qualification evidence; it does not return WebVOWL models or certify every consumer's admission policy.
Name the initial service document profile `ontology-source-document-v1`; retain `webvowl-managed-closure-v1` as the separate browser qualification profile.
Neither service implementation nor the public schema depends on `vowl`, DOM/session types, graph controls or WebVOWL's application-limit exports.
The initial fixed parser/encoding/security policy stays explicit: reuse does not add caller-selected parsers, arbitrary headers, unbounded limits, tenant administration or a general URL proxy.

Before implementation, jointly review the HTTP operations/statuses/headers and static catalog/pointer/artifact/evidence formats, identity/base/fragment rules, refresh/history/withdrawal semantics, resource-error taxonomy, supported versions and rollback compatibility.
Pin one released contract revision/content digest in each consumer; a sibling checkout and mutable branch are not the CI authority.
Use an ordinary HTTP consumer conformance probe with no WebVOWL imports to verify portable bytes, checksums and evidence interpretation, alongside the real WebVOWL client tests.
This demonstrates a reusable boundary without starting another production consumer or a new SDK/platform project.
Future consumers choose their own admission checks and add compatibility evidence for the service versions they actually use.

### 6.6 Expert soundness review and revised contract gates

The provider's draft 2 `review-disposition.v1.md`, protocol §§6.1/7/8/9 and CDEC-014–020 reconcile the supplied soundness assessment and the subsequent qualifications.
This plan and AWS revision 9 use that one authority; their existing REQ/AC/QA/SLICE IDs remain in force.
The provider bundle includes exact raw pre-revision-2 plan snapshots and the supplied assessment, so reviewers can recover the uncommitted rc.2/limits context.
Those snapshots are dated evidence, not competing current plans.

- **Gate A / SLICE-001:** Require a successful final-bundle run of the provider-owned `verify_contract.py`: official current OpenAPI schema-base, OAS dialect for inline schemas, explicit Draft 2020-12 standalone schemas, native OpenAPI validation, effective negative controls, examples, identity vectors and manifest integrity.
  Pin the approved published bundle after review; the prepared draft and verifier do not constitute acceptance.
  The verifier's exact dependency file and AWS-local installation were separately approved on 27 October; CI wiring and other configuration remain separately controlled.
  Both validation paths currently share python-jsonschema, so do not call them independent-engine evidence.
- **Abuse controls / SLICE-005:** Retain exact logical `sourceKey` and contextual semantic identities.
  The provider adds private normalized transport/origin/validated-destination accounting, transport cooldown across spelling variants and proposed one-active/two-unstarted cycles per origin within global concurrency two/queue 20, with fair eligible-origin rotation.
  Redirects, fallback and aliases cannot evade connection/destination controls.
  An accounting match never authorizes another source's parsed result; this adds no consumer-visible identity normalization.
- **Containment / SLICE-006/008:** Observed tombstones prohibit fallback.
  Before observation, stale discovery may survive origin/API failure; immutable browser/proxy copies can outlive edge invalidation and downloaded copies cannot be recalled.
  Source-association withdrawal fences/denies its associations while preserving legitimately shared bytes; a content incident denies digest delivery at origin and every alias before verified edge invalidation, preventing refill.
  Containment remains pending until required effects are verified; failures hold affected delivery/publication and escalate.
  Gate C requires a named owner and accepted measured containment objective, including warm/cold multi-edge, direct artifact URLs, outages and invalidation failure.
- **HTTP and rights / SLICE-005/006:** Conservative automatic archive rejection of no-cache/must-revalidate/proxy-revalidate/s-maxage is a service policy, distinct from RFC 9111 reuse semantics and rights.
  The common mutable header is `public, max-age=300, stale-while-revalidate=60, stale-if-error=86400`.
  Fresh, revalidation and stale-if-error allowances are distinct; 86,400 seconds is stale time after freshness, not a guaranteed freshness or recall bound.
  The advertised 86,400-second CORS preflight allowance may be shortened/evicted by the browser; repeat preflights must work.
- **Capacity / SLICE-005/008:** The 500 new plus 500 refresh cycles/day are admission ceilings, not a same-day completion SLA.
  Three 60-second attempts for 1,000 cycles demand 180,000 worker-seconds versus at most 172,800 at concurrency two before overhead.
  Existing queued reservations/backpressure, retry limits, proposed origin fairness and reservations retained across midnight bound work.
  Activation needs measured attempt durations/retries, queue age, fairness, throttling, recovery and cost evidence; revise numeric proposals where necessary.
- **Corpus / SLICE-001/002/007:** The 80-file author-local hash result was not reproducible from the original ZIP alone.
  The provider inventory now has a read-only verifier path for exact Git blobs at the pinned Universal Ontology commit in an authorized clone.
  Bundle-only verification, corpus acquisition/hashes, unknown historical parser context, fixture redistribution rights and live-origin outcomes are separate claims.

CTV-023–027 and declarative ST-023–028 extend the existing acceptance evidence under REQ/AC-003/004/006/007/009–014/017 and QA-002/005/007–010/013–016; they are not executed runtime tests.
Gate B still delivers the real WebVOWL integration disabled with zero cache-specific traffic.
Gate C still verifies the real provider, CloudFront and supported browsers before separate activation approval.

## 7. End-to-end resolution semantics

### 7.1 Archived-source hit

1. Retain `requestedDocumentIri`; check the per-load binding, curated seed catalog and then the exact dynamic source pointer.
2. Load the immutable resolution record and verify source/version/artifact identities, parser context, service validation policy and contract compatibility.
3. Fetch immutable bytes with omitted credentials, cancellation and the same byte/aggregate limits as direct acquisition; verify SHA-256 over content-decoded bytes.
4. Return exact bytes and origin `parserDocumentIri`.
   Preserve the browser caller's automatic/explicit syntax choice; recorded service parser/media metadata does not force `mediaType` into an automatic load.
5. Run normal worker-owned consumer admission.
   Server document evidence never bypasses browser limits or semantic checks.
6. For a fresh explicit open, consult the pointer's last successful check/due metadata and request a background `if-due` refresh when indicated. Coalesce per-source work; a server-side freshness check is authoritative. This request is outside the foreground acquisition/admission dependency.

Foreground hits use CloudFront/S3 and continue to work when refresh is unavailable or disabled.
A recently checked source needs no control-plane request; archived age alone does not prevent showing an otherwise eligible saved snapshot, with its dates visible.
A corrupt, incompatible or incomplete binding is unusable evidence: report a sanitized diagnostic and follow controlled direct acquisition.
An updated binding is offered to the current user, not installed automatically (§17.4).

### 7.2 Direct success

Use the existing HTTPS-capable direct policy with `credentials: "omit"`, bounded exact bytes and the caller's signal.
Align direct and worker Accept negotiation to the same metadata-derived request policy and record its exact values; characterize the current browser's implicit Accept behaviour before changing it.
Different negotiated representations are not a semantic-equivalence pass merely because they share a requested IRI.
Preserve requested, initial retrieval and effective origin IRIs separately and select parser context as §4.2 requires.
With no explicit format, compatible ingress leaves `mediaType` absent and the owning loader selects syntax from the exact bytes.
Missing/misleading MIME types, filenames and extensionless imports must behave identically through direct and cache paths.
With an explicit format, resolve it through public `OWLDocumentFormats`; strict structural ingress retains its explicit-format contract.
Cache response headers or recorded parser results must not turn an automatic request into a forced-parser request.
Readable HTTP errors, parsing failures, unsupported encodings, security/resource limits and cancellation are typed outcomes, not materialization triggers.
Directly readable documents are not automatically mirrored in version 1.

### 7.3 Materialization fallback and first caller

Fallback is allowed only when direct browser acquisition cannot produce a readable response because of network/CORS/mixed-content restrictions.
Do not claim every Fetch rejection proves CORS.
Serialize the narrow submission once, hash its exact UTF-8 bytes for `x-amz-content-sha256`, and submit without credentials.
Pending requests return 202 with `Location` and `Retry-After`.
Poll one request at a time using cancellable recursive delays: valid `Retry-After`, otherwise 1/2/4/8 seconds with ±20% jitter and an 8-second ceiling, within a 60-second client ceiling and the current operation's remaining deadline, whichever is lower.
Import polling consumes the existing whole-worker deadline; it does not restart a new 60-second allowance.
Limit concurrent submissions to four and coalesce identical session requests without leaking one caller's cancellation into another caller's retained work.

Once a source binding is committed, 303 redirects to its immutable artifact with `source` and `binding` digest tokens.
Fetch may follow automatically; the final service URL supplies the immutable binding identity, whose S3 resolution record supplies parser context and format.
The first caller verifies that record and the bytes before worker admission, then remembers the complete binding in its session.
It need not wait for catalog propagation.
Do not rely on reading an intermediate redirect's headers or on a mutable source-provenance document that could race a refresh.

### 7.4 Document and closure qualification

Every imported document follows the same acquisition contract and retains its own context.
The first release performs isolated server document validation and preserves the browser's existing independent root/import acquisition and managed-closure/admission behavior.
It does not precompute a general server import closure or promise a frozen, atomically replayed set of imports.
Cycles, shared imports, missing members, profile violations and consumer limits retain their existing typed outcomes.
Document mappings may be published as `DOCUMENT_VALIDATED` without a closure or OWL 2 DL claim.
The structural route retains its required source/closure checks; the compatible route may retain diagnostics without being relabelled strict success.

The closure identity/manifest contracts in §§4/9/11 remain qualification vocabulary and parity-fixture requirements.
Any later server closure service needs its own approved scope, budgets and resources.
Its evidence could be reused only when the browser's actual member validation identities, parser contexts, resolved edges and policies all match the recorded manifest; a root match alone is insufficient.
An incomplete closure never blocks publication of an otherwise eligible document.

### 7.5 Use-triggered refresh and last-known-good

There is no scheduled scan, crawler or periodic origin refresh.
An explicit WebVOWL open may request a background check when the source is due; an unused entry causes no origin work.
A separate per-entry manual/automatable operation can request a check now (§8.7), still subject to security controls, coalescing, cooldown, backoff, daily work allowance and the feature stop.
Ordinary idempotent materialization submissions and status reads do not secretly initiate refreshes.

Derive due time from applicable origin freshness metadata, the last successful source check and a versioned fallback when metadata is absent.
SLICE-001 must freeze that finite fallback and its workload/cost rationale before implementation; there is no universal best-practice interval and no retained 30-day scheduling assumption.
Do not check on every hit irrespective of freshness or let a client-supplied age bypass server policy.
Show acquisition, last-successful-check and failed-attempt dates separately.
An eligible archived snapshot may be displayed beyond HTTP freshness as an explicit application archive feature; it is not labelled latest or served by pretending the origin granted indefinite HTTP freshness.

Persist validators, fixed request-variant metadata, `Vary`, directives, status and effective URI.
Use conditional GET with `If-None-Match` and applicable `If-Modified-Since`.
A matching 304 updates successful-check/HTTP metadata, not acquisition date, source-version count or a fabricated parse result.
Record validator strength: a 304 is the origin's validation result, not an independent measurement of its current byte digest.
Changed software/policy still requires new validation evidence over retained bytes, independently of source version identity.

For 200, compute the byte digest and reconcile bytes/context with the URI's version records.
Identical bytes/context reuse the existing version; changed bytes or parser context create one distinct version. Returning from A to B to A reuses A and records that transition in attempt/binding history.
Changed validators, check timestamps or validation software alone do not duplicate source versions.
Versioned source identities, contextual validation and publication bindings remain separate (§9.1).
Never reuse validators across unrelated source variants/redirect targets; inconsistent 304 metadata or missing bytes causes a bounded unconditional retry or typed failure.

Only a successfully validated, currently eligible refresh can promote the global current binding.
Publication does not wait for one viewer's approval; applying it to that viewer's open graph does.
Failed/unfinished refresh leaves the existing eligible binding and graph intact and records a dated typed outcome.
New restrictions, quarantine or takedown invoke containment rather than an ordinary stale fallback (§12.4).
Retained history does not override access/rights decisions, and downloaded/browser copies cannot be recalled.

---

## 8. Public HTTP contract

### 8.1 Stable paths

| Method and path                                                                       | Owner                         | Cache policy                     | Purpose                                                                 |
| ------------------------------------------------------------------------------------- | ----------------------------- | -------------------------------- | ----------------------------------------------------------------------- |
| `POST /ontology/materializations`                                                     | API Lambda                    | Disabled; `no-store`             | Submit/resume materialization; does not refresh a ready source.         |
| `GET /ontology/materializations/{materializationId}`                                  | API Lambda                    | Disabled; `no-store`             | Observe pending/rejected/ready materialization state.                   |
| `POST /ontology/materializations/{sourceKey}/refreshes`                               | API Lambda                    | Disabled; `no-store`             | Explicit per-source `if-due` or `check-now` operation.                  |
| `GET /ontology/materializations/{sourceKey}/refreshes/{refreshAttemptId}`             | API Lambda                    | Disabled; `no-store`             | Observe the exact admitted/coalesced refresh attempt.                   |
| `OPTIONS` on the API paths above                                                      | API / response-headers policy | Disabled                         | Credential-free CORS preflight.                                         |
| `GET\|HEAD /ontology/cache/artifacts/sha256/{artifactSha256}`                         | Artifact S3                   | One year immutable               | Validated exact bytes shared across source versions.                    |
| `GET\|HEAD /ontology/cache/provenance/sources/{sourceKey}.json`                       | Artifact S3                   | Five minutes plus stale controls | Exact-source current binding and sanitized freshness/attempt summary.   |
| `GET\|HEAD /ontology/cache/versions/sha256/{sourceVersionIdentity}.json`              | Artifact S3                   | One year immutable               | One immutable source-version record per URI and bytes/context identity. |
| `GET\|HEAD /ontology/catalog-v001.xml`                                                | Artifact S3                   | Five minutes plus stale controls | Curated OASIS catalog root; no dynamic archive enumeration.             |
| `GET\|HEAD /ontology/catalogs/seed/sha256/{catalogGenerationSha256}/catalog-v001.xml` | Artifact S3                   | One year immutable               | Curated seed generation.                                                |

Artifact, source, version, resolution, validation and closure digests are exactly 64 lowercase ASCII hexadecimal characters.
Refresh attempt IDs are independent opaque 32-character lowercase hexadecimal tokens, bound server-side to a source key and generation.
GET/HEAD paths under `/ontology/cache/` also serve `resolutions/sha256/{resolutionIdentity}.json`, `validations/sha256/{validationIdentity}.json` and the draft `policies/sha256/{loaderProfileFingerprint}.json` evidence route with immutable cache policies.
The `closures/sha256/{closureDigest}.json` contract is reserved for separately qualified evidence; no first-release server closure producer or route is required.
The mutable source pointer is not parser-context authority for an older artifact.
Unexpected segments, decoding tricks, upper-case digests or suffixes fail closed.

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
The IRI-only request selects one fixed, versioned service document-validation policy.
It cannot certify every browser caller's explicit parser selection; the browser independently applies its own automatic/explicit selection to the same bytes/context.
Observed service parser metadata is evidence, not a substitute for caller intent.
A concrete unsupported case must receive a typed outcome or a separately accepted variant contract, never a hidden parser flag.

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
  "schemaVersion": 1,
  "kind": "materialization-status",
  "materializationId": "64-hex-characters",
  "state": "PENDING",
  "generation": 1,
  "admittedAt": "2026-10-27T00:00:00.000Z",
  "statusIri": "https://haddenindustries.com/ontology/materializations/64-hex-characters",
  "workState": "QUEUED"
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
READY means a durable eligible document binding is available; per-source/curated static projection may still be pending.
It makes no server closure qualification claim.

### 8.5 Error response

```json
{
  "schemaVersion": 1,
  "kind": "error",
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
Document-materialization and refresh-attempt outcomes appear on this API; closure/consumer results remain in their own qualification/session evidence.
The document taxonomy also includes `SOURCE_ENCODING_UNSUPPORTED`, `SOURCE_DECODING_FAILED` and `ONTOLOGY_FORMAT_AMBIGUOUS` as 422 outcomes, with no automatic client retry and the same bounded 24-hour suppression as document rejection.
Retain package resource/deadline failures as limit/timeout outcomes rather than relabeling them syntax-invalid.
Caught `HOST_RESOURCE_LIMIT` and worker/process resource loss are operational failures, not proof of invalid ontology content. Preserve safe stage/resource categories in private attempt evidence (§11.6); public responses expose only the bounded service outcome.
Resource-failed or interrupted attempts cannot become completed semantic validation evidence or displace the last-known-good binding.

| HTTP status | Stable code                                                                                                                                          | Meaning / retry policy                                                                                                                                                                              |
| ----------: | ---------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|         400 | `REQUEST_SCHEMA_INVALID`, `SOURCE_IRI_INVALID`                                                                                                       | Malformed request or IRI; no automatic retry.                                                                                                                                                       |
|         403 | `SOURCE_IRI_FORBIDDEN`, `MATERIALIZATION_DISABLED`, `SOURCE_QUARANTINED`                                                                             | Policy/kill-switch rejection; no client retry until policy changes.                                                                                                                                 |
|         405 | `METHOD_NOT_ALLOWED`                                                                                                                                 | CloudFront allowed the method but the API contract does not.                                                                                                                                        |
|         404 | `MATERIALIZATION_NOT_AVAILABLE`, `REFRESH_ATTEMPT_NOT_AVAILABLE`                                                                                     | Unknown public status; no automatic resubmission or origin work. Isolate API errors from legacy custom HTML/negative caching.                                                                       |
|         410 | `MATERIALIZATION_STATUS_RETIRED`, `REFRESH_STATUS_RETIRED`                                                                                           | Known public status deliberately retired; no automatic restart. This replaces the earlier 410-for-unknown workaround (draft CDEC-008).                                                              |
|         406 | `RESPONSE_MEDIA_TYPE_UNSUPPORTED`                                                                                                                    | Incompatible response Accept request; no automatic retry.                                                                                                                                           |
|         413 | `REQUEST_BODY_TOO_LARGE`, `SOURCE_REPRESENTATION_TOO_LARGE`                                                                                          | Distinguish the 8,192-byte API body from the 33,554,432-byte source representation. Oversized source attempts have seven-day suppression.                                                           |
|         415 | `REQUEST_MEDIA_TYPE_UNSUPPORTED`                                                                                                                     | Unsupported API request media/content encoding; no work admitted.                                                                                                                                   |
|         422 | `ONTOLOGY_DOCUMENT_INVALID`                                                                                                                          | `owlapi` rejected the representation; suppress retries for 24 hours.                                                                                                                                |
|         422 | `ONTOLOGY_VALIDATION_RESOURCE_LIMIT`                                                                                                                 | A finite document-validation policy bound was exceeded; record a resource outcome, not invalid ontology syntax. Suppress repeat work under the same policy for 24 hours; no automatic client retry. |
|         429 | `SOURCE_SUBMISSION_RATE_EXCEEDED`, `DAILY_NEW_SOURCE_QUOTA_EXCEEDED`, `DAILY_REFRESH_QUOTA_EXCEEDED`, `SOURCE_REFRESH_COOLDOWN`, `API_RATE_EXCEEDED` | Honor Retry-After; no automatic spin or bypass through another operation.                                                                                                                           |
|         502 | `UPSTREAM_RESPONSE_REJECTED`, `UPSTREAM_NETWORK_FAILURE`                                                                                             | Upstream response could not be materialized; suppress retry for 15 minutes, or one hour for stable 4xx source responses.                                                                            |
|         500 | `INTERNAL_ERROR`                                                                                                                                     | Controlled internal failure with a bounded safe error; no implicit work replay.                                                                                                                     |
|         503 | `VALIDATION_RESOURCE_UNAVAILABLE`, `MATERIALIZATION_CAPACITY_UNAVAILABLE`                                                                            | Operational host failure or finite admission capacity; distinct backoff/Retry-After rules in the provider error catalog.                                                                            |
|         504 | `UPSTREAM_TIMEOUT`                                                                                                                                   | Retrieval/validation exceeded its finite budget; suppress retry for 15 minutes.                                                                                                                     |

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

### 8.7 Per-entry refresh contract

The refresh operation is a distinct first-release contract, not a new meaning silently assigned to the materialization POST.
Its body has exactly `requestedDocumentIri` and `mode`, with `mode` equal to `if-due` or `check-now`; the source hash must match the path.
Apply the same 8,192-byte body, 4,096-byte IRI, exact body-hash, credential-free and unknown-member rules.
Only an existing admitted source may refresh; an unknown source returns 404.
Ordinary materialization admission requires a separate explicit intent.
Both anonymous WebVOWL users and automation may use this operation.
There is no public privileged force flag.

- `if-due`: return `200 SKIPPED_FRESH` with current binding/check metadata when a check is unnecessary; otherwise admit or join one refresh.
- `check-now`: request an earlier check without bypassing minimum cooldown, negative backoff, quotas, feature stop or any security/publication validation.
- Admitted/coalesced work returns 202 with the attempt ID, baseline binding, `Location` and `Retry-After`. Repeated requests for the active source generation join that attempt rather than incrementing work/version counts.
- Attempt GET returns 202 while pending and 200 with `UNCHANGED`, `CHANGED`, `FAILED` or `SUPERSEDED` once terminal, with sanitized code/timestamps and exact resulting version/resolution identities where available.
  `CHANGED` is terminal at the durable eligible source/version/binding commit, not at eventual static-pointer propagation.
  All immutable objects already exist; report static discovery separately as pending or published.
- A check-now cooldown or exhausted work allowance returns 429 and `Retry-After`; disabled/quarantined work returns the existing 403 policy codes.
  An unknown public attempt status returns 404; a known deliberately retired status returns 410.
  Neither instructs the client to restart work automatically.

Clients observe a bounded attempt, not a mutable source-wide status that could describe someone else's later refresh.
Background notification polling is cancellable, non-overlapping and bounded to 60 seconds at most; expiry ends that page's observation, not the retained backend attempt.
It does not extend document admission, keep a closed session alive or silently reload a graph.
Manual tooling may later inspect the retained exact attempt; network uncertainty alone is not permission to submit another check.
Review the provider draft request/result schemas and proposed finite cooldown/fallback/backoff parameters with the joint fixtures in SLICE-001; do not treat the draft values as measured service capacity.

---

## 9. Registry and state-machine contract

### 9.1 Separate records and immutable identities

Retain DynamoDB Standard on-demand capacity, point-in-time recovery, deletion protection and AWS-owned encryption.
The proposed new table uses string partition key `registryKey` and sort key `recordKey` so native bounded Query can retrieve one source's versions/attempts without a full-table scan.
This is an explicit correction to the earlier single-key draft, not an instruction to mutate a deployed table.
No speculative GSI is needed; partition/item pressure must be measured before approval.

| Partition / sort key                                                | Owned fields and invariant                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SOURCE#{sourceKey} / CURRENT`                                      | Permanent exact URI record; current/previous version and resolution identities, generation, validators/variation, eligibility, lastAttemptedAt, lastSuccessfullyCheckedAt, lastChangedAt, freshUntil, nextCheckAllowedAt, lease/fence and quarantine. History is not embedded in this bounded item. |
| `SOURCE#{sourceKey} / VERSION#{sourceVersionIdentity}`              | Exactly one immutable record per distinct URI/bytes/context version; artifact digest/length, effective retrieval and parser IRIs, first accepted acquisition and provenance reference. Conditional create verifies an existing match rather than duplicating it.                                    |
| `SOURCE#{sourceKey} / ATTEMPT#{refreshAttemptId}`                   | Directly addressable canonical attempt: trigger/generation, admission/start/end times, typed outcome, HTTP status and resulting version/validation/binding. Terminal history is immutable; pending transitions are fenced.                                                                          |
| `SOURCE#{sourceKey} / ATTEMPT_TIME#{admittedAt}#{refreshAttemptId}` | Thin immutable chronological reference to the canonical attempt, created in the admission transaction. Native bounded Query supports per-source/date history without duplicating payload or outcomes.                                                                                               |
| `VALIDATION#{validationIdentity} / METADATA`                        | Exact byte/context/package/decoder/stage-policy identity, document/source result and bounded diagnostics; independent of source version lifetime.                                                                                                                                                   |
| `RESOLUTION#{resolutionIdentity} / METADATA`                        | Immutable serving binding of source generation, source version, artifact, validation and acquisition/publication evidence. A generation or validation revision may create a new binding without creating a source version.                                                                          |
| `CLOSURE#{closureDigest} / METADATA`                                | Reserved qualified graph/member/edge/report identity; server production deferred in first release.                                                                                                                                                                                                  |
| `CONTROL#SERVICE / CURRENT`                                         | Work enablement, quotas, freshness/cooldown policy and monotonic policy revision.                                                                                                                                                                                                                   |
| `QUOTA#UTC#YYYY-MM-DD / COUNTERS`                                   | Separate admitted new-source and refresh-work counters. Polls/coalesced requests do not count as new attempts; retries remain bounded and accounted.                                                                                                                                                |
| `CATALOG#CURRENT / METADATA`                                        | Curated projection revision/generation/root ETag only; per-source projection intents live with each source generation.                                                                                                                                                                              |

For version 1, `sourceVersionIdentity` hashes the domain-separated canonical tuple `(sourceKey, artifactSha256, effectiveRetrievalIri, parserDocumentIri)`.
This distinguishes identical relative-IRI bytes under different origin/parser contexts.
Timestamps, origin ETags, polling, source generation and validation software are excluded.
A future extra interpretation input requires an explicit identity-schema revision.
A 304, identical 200 or A→B→A return adds attempt history/reuses a version; it does not add duplicate payload/version records.
Different URIs retain separate version records but share the same verified byte object when digests agree.
Validation-policy upgrades add contextual evidence and, where needed, serving bindings, rather than inventing new origin versions.
Never use an ontology's declared `versionIRI` or an HTTP ETag as a unique content identity.

Refresh status GET derives its exact partition/sort key from sourceKey and refreshAttemptId; it never scans history.
Use native paginated source-key/time-prefix queries with strict page/byte limits for operational history; see [DynamoDB key-condition queries](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Query.KeyConditionExpressions.html).
Keep completed compact attempt/version records with the permanent source archive; bulky diagnostic logs follow their own bounded retention.
No browser or one source item loads the complete history.
A full report/manifest that exceeds an item limit belongs in private S3 evidence with digest references.
Commit an immutable validation record only for a completed semantic stage and its actual result.
A timeout, cancellation, infrastructure failure or resource-exhausted attempt does not permanently occupy that result identity.
Keep incomplete execution outcomes in attempt history with the intended validation identity; a later completed attempt may succeed over identical inputs without contradicting an earlier interruption.
Conflicting completed semantic results for identical canonical inputs are an invariant failure.
The same distinction applies to any separately qualified closure report.
Never persist raw parser excerpts, secrets or source bodies in table/log diagnostics.
`schemaVersion`, `validationContractVersion`, readable `validationProfileId` and `loaderProfileFingerprint` have distinct roles.

### 9.2 State dimensions

These are related dimensions, not one misleading linear state enum:

| Dimension          | States and meaning                                                                                                                                                                                                                                                               |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Acquisition        | `PENDING → FETCHED`; refresh may be `REVALIDATING`, with typed transient/terminal failure and retry windows. `FETCHED` means bytes exist privately, not that they may be served.                                                                                                 |
| Document evidence  | UNVALIDATED becomes DOCUMENT_VALIDATED or a completed semantic rejection for its exact identity. Incomplete/resource/interrupted execution stays in attempt history and cannot occupy immutable completed evidence. Parsing alone does not prove preservation or import closure. |
| Closure evidence   | `UNASSESSED / INCOMPLETE / REJECTED / CLOSURE_VALIDATED`, rooted in exact member/edge and profile identities. It cannot be promoted by a document-only job.                                                                                                                      |
| Publication        | `UNPUBLISHED → PUBLISHED` requires the relevant exact-source pointer commit for a dynamic source or applicable curated generation/root commit for a seed. Durable READY may precede discovery; neither means closure qualification.                                              |
| Freshness/access   | `CURRENT / REVALIDATING / STALE / QUARANTINED`; last-known-good is a separately retained active binding, never an overwritten artifact.                                                                                                                                          |
| Consumer admission | `NOT_EVALUATED / ADMITTED / REJECTED / INCOMPLETE` with consumer version/policy and reason, independent of ontology validity.                                                                                                                                                    |

The public API may use `READY` as a transport disposition once a durable eligible resolution/artifact exists, before catalog propagation.
It is not a synonym for `CLOSURE_VALIDATED` or completed static publication and is not a Boolean validity field.
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
Refresh uses the same bounded document-worker path and independent admission accounting; it never resets attempt ceilings through another public POST.
No first-release closure jobs are created.
Future closure work requires separate scope and finite budgets.
Reconciliation retries already admitted intent/leases; it must not become a scheduled source-check mechanism.

### 9.4 Publication commit point and recovery

The order is:

```text
admit generation + enqueue intent
  → lease → controlled retrieve + publication eligibility → digest → private staging
  → document validation
  → checksum-verified immutable artifact + validation + version projection + resolution
  → fenced transaction: create/reuse unique accepted version + source-generation commit
      + terminal attempt/result + durable per-source projection intent (READY)
  → generation-fenced exact-source current pointer
  → for curated mappings only: immutable seed generation → compare-and-swap stable root
```

The public artifact namespace receives only document-validated bytes; staging is excluded from CloudFront permissions.
An accepted permanent version is registered only after all referenced artifact/validation/version-projection/resolution objects are durable and verified.
The fenced commit checks current eligibility/policy and completes the attempt with the resulting binding.
Pre-commit staged objects are not accepted history and remain subject to safe orphan reconciliation.
The immutable version projection contains stable source/bytes/context facts; first-accepted timestamps and attempt references live in its canonical version/attempt records, avoiding competing first-writer timestamps in deduplicated object content.
A context's invalid result cannot become valid merely because identical bytes were published under another context.
Per-source and curated-catalog publication read only committed eligible bindings and verify every referenced object/record.
One source update projects only its own pointer; a dynamic source does not dirty or rebuild a global catalog.
The source publisher serializes per-key ownership and uses object ETag/generation checks; stale writers cannot overwrite a newer pointer.
It records a stable desired revision before projection, rechecks that revision before root CAS, and serializes publisher ownership.
When the registry/root stores cannot change atomically, reconcile by reading both revisions and the root ETag after any interruption; never claim atomicity across DynamoDB and S3.
Quarantine racing a projection invalidates its desired revision and requires republishing; emergency access containment remains a separate incident action.

Inject failure after every boundary, including SQS send, private/final object put, evidence write, source commit, dirty intent, generation put and root update.
Recovery must expose old-complete or new-complete bindings, never a missing object, mismatched parser context or unqualified claim.
DynamoDB TTL is cleanup only, never a correctness mechanism.
Orphan cleanup is reference-aware and separately approved.
Every accepted historical source version remains a retention root, even after it ceases to be current.
Permanent version history is not orphan data; only never-accepted/unreferenced staging or redundant recovery material can expire under its approved policy.

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
- no automatic expiry of accepted artifact, source-version, validation, resolution or immutable curated-generation history; routine lifecycle never retires an old accepted source version;
- 90-day expiry for noncurrent versions of mutable pointer/provenance objects after rollback evidence exists; and
- an OAC-scoped read policy restricted to published artifact/evidence/catalog prefixes for the existing distribution, excluding private staging and internal evidence.

The worker role can write only immutable staging/artifact/version/evidence prefixes and read the exact inputs needed for validation/reconciliation.
The projection publisher is the sole writer of mutable source pointers and curated catalog/root prefixes; it reads committed registry/projection state.
Neither role can change the bucket policy, CloudFront distribution, WAF, or unrelated static assets.

### 10.2 Key layout

```text
ontology/private-staging/sha256/{artifactSha256}
ontology/cache/artifacts/sha256/{artifactSha256}
ontology/cache/resolutions/sha256/{resolutionIdentity}.json
ontology/cache/validations/sha256/{validationIdentity}.json
ontology/cache/closures/sha256/{closureDigest}.json
ontology/cache/provenance/sources/{sourceKey}.json
ontology/cache/versions/sha256/{sourceVersionIdentity}.json
ontology/catalog-v001.xml
ontology/catalogs/seed/sha256/{catalogGenerationSha256}/catalog-v001.xml
```

The staging prefix and unsanitized internal evidence are private to narrowly scoped worker roles and have no CloudFront read grant or behaviour.
Approved expiry of unreferenced staging follows the maximum recovery window; lifecycle cleanup cannot remove active inputs.
Public evidence is bounded, sanitized and free of viewer/request information.
No source filename is used as an object key.

### 10.3 Byte object and publication write contract

1. Retrieve once under §12, reject storage/publication restrictions before durable staging, bound encoded and content-decoded streams, and hash exact content-decoded bytes before character decoding.
   A private S3 ACL does not make this service a private HTTP cache or permit storing a `no-store`/`private` response.
2. Conditionally put private staging using `If-None-Match: *` and S3 SHA-256 checksum metadata.
   Record `FETCHED` only after integrity verification.
3. Select format and decode under the pinned policy; validate the same bytes/context through public `owlapi`.
   A failed context remains unpublished even on a global byte-dedup hit.
4. Conditionally write the accepted exact bytes to the final artifact key and verify checksum/length.
   A precondition failure is deduplication, not permission to overwrite; missing or inconsistent checksum fails closed.
5. Persist and verify immutable validation evidence, stable source-version projection and resolution objects, all pointing to existing verified bytes.
6. Under the source generation/lease/eligibility fence, atomically create or verify the unique accepted version record, commit the current binding/terminal attempt and record projection intent.
   Only changed bytes/context create a source version; checks and policy requalification cannot multiply versions.
   No accepted permanent record may reference a missing artifact/evidence object; publication exposes only committed state.

S3 ETag is a validator, not a content SHA-256.
Store only context-independent facts on a shared byte object: digest, length, checksum and neutral delivery metadata.
Use `application/octet-stream`, no origin `Content-Encoding` after decoding, and the immutable lifetime for the admitted public artifact.
Origin content type/encoding, format, timestamps, source IRI, validation/profile and republication policy live in per-acquisition/per-validation records, not semantic headers on the byte object.
Do not let the first source to upload shared bytes determine another source's parser selection or validation claim.

Canonical source export retains the acquired bytes.
Any separately approved derived serialization uses a distinct derived-artifact namespace, own digest and a link to exact source/validation inputs; it never replaces source bytes.

### 10.4 Source-specific resolution and provenance

An immutable resolution record contains source key/generation and sourceVersionIdentity, requested/retrieval/effective/parser IRIs, artifact IRI/digest/length, service validation selection and observed format identity, original content type/encoding, decoding policy, validation identity and exact loader/package/contract identity.
Its service selection never overwrites a browser caller's automatic/explicit choice.
It also records acquisition time/status, request-variant fingerprint, validators/republication disposition, source-preservation result and optional qualified closure identity.
Its own `resolutionIdentity` binds all those fields.

The mutable source-provenance document is the bounded exact-key discoverability pointer, not authoritative context for an artifact fetched from an older binding.
Link its current source-version/resolution/validation records, plus curation, acquisition/check/change times, next eligible check and sanitized latest-attempt status.
Never inline the full version/attempt history.
Declared ontology/version identifiers and corresponding-source revision are metadata, not archive identities.
Every catalog entry and READY redirect identifies an immutable resolution record, so refresh cannot race the client's parser metadata.
A server qualification never authorizes skipping the local consumer's checks.

Requested/effective IRIs are intentional public provenance for eligible public sources.
Reject credential-bearing/session-dependent sources under the publication policy; never leak their query strings via rejection logs.
Known secrets, raw parser text, viewer identifiers, headers and private evidence never enter public records.

### 10.5 Curated OASIS and exact-source publication

Retain OASIS XML Catalogs 1.1 for curated seeds with exact `uri` mappings, bounded `nextCatalog`, `group` and `xml:base`.
The stable root points only to immutable curated seed generations; dynamic sources have static per-source JSON pointers, not a public global catalog.
Both projections derive from the same committed source/binding contract, with curated membership/aliases explicitly owned.

Each OASIS mapping target has this shape, with digest tokens validated:

```text
https://haddenindustries.com/ontology/cache/artifacts/sha256/{artifactSha256}?source={sourceKey}&binding={resolutionIdentity}
```

The query identifies immutable evidence and does not alter bytes, cache keys or S3 requests.
Foreign-namespace metadata may carry binding/profile identities where OASIS permits it; ordinary resolvers still retrieve bytes.
Browser consumers fetch and verify context evidence; an XML mapping is not qualification.
An independent OASIS consumer proves curated catalog conformance.
The dynamic JSON pointer is an explicit service contract, not a claim to implement additional OASIS entry types.

Serialize curated mappings deterministically in exact-IRI order with verified references, UTF-8/LF, escaping, no DTD and no timestamps in immutable mapping content.
Dynamic entries cannot override curated names; an optional compact seed JSON view uses the same model with no independent editing.
Checksum-verify generation objects before a conditional root update; serialize publication and reconcile conflicts/readback.
Publish a dynamic pointer by exact source key with its committed generation and conditional write; source-level rollback re-points to a retained compatible binding without rewriting history.
Never rebuild, enumerate or download the permanent archive merely to update or resolve one URI.

### 10.6 Browser catalog safety profile

`OasisXmlOntologyCatalog` accepts only service-owned HTTPS catalogs and enforces:

- OASIS namespace and one `catalog` document element;
- `uri`, `nextCatalog`, `group`, and `xml:base` only as needed by generated files;
- at most four `nextCatalog` levels, eight catalog files and 8 MiB aggregate curated XML, with finite parser-work/time limits; no population-wide source/version count ceiling;
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
`PUBLISHED` means the durable binding/evidence was exposed in the exact-source pointer or curated catalog; it identifies the validation level asserted.
No state claims consistency, satisfiability, entailment, freshness forever or publisher endorsement.

### 11.2 Versioned loader policies

Freeze canonical resolved policy JSON and a fingerprint for each stage using §4.2's explicit unbounded-value encoding.
Use the same exact stage policy in Node/browser parity fixtures; document-only service validation and browser closure loading intentionally have different import and resource policies.

| Policy                        | Required semantics                                                                                                                                                                                                                                                                                                                                                         |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ontology-source-document-v1` | Exact source retention and a fresh public manager/source with explicit automatic-or-selected format policy. Use the selected public parsing mode, record it and its diagnostics, disable import retrieval and remote JSON-LD contexts, deny external XML resources and supply explicit finite service limits. Imports remain declarations and incomplete closure evidence. |
| `webvowl-managed-closure-v1`  | The selected canonical/compatible consumer mode, managed graph loading and public asynchronous source/profile report. `remoteImports: true` permits calls to the supplied document loader; no ambient fetcher is installed. Apply the actual package, application, acquisition and adapter limits below; remote contexts/external entities remain denied.                  |
| Consumer admission            | The exact `vowl` artifact, operation/profile and resolved limits, separately recorded from ontology qualification. Cache acquisition preserves the amended consumer contract; it neither restores retired package caps nor removes active application/service protections.                                                                                                 |

The canonical package uses `preserve` mode on the structural mapping route and `compatible` mode for compatible ingress.
Record those public values rather than inventing a `source-preserving` configuration enum.
Do not use a compatible document parse as proof that the strict structural route passed.
Cross-runtime fixtures must demonstrate the chosen document mode, source diagnostics and closure report for each supported route.

#### 11.2.1 Package defaults and override domain

The inspected uncommitted implementation exports the frozen `operationLimitDefaults` record from `vowl`.
Consumers must use `operationLimitDefaults` directly and must not recreate a compatibility shim for the retired export.
The amended package no longer imposes the former finite upper override bounds.
Its defaults and WebVOWL's independently selected defaults are:

| Limit               | Package default | WebVOWL ordinary operation default |    WebVOWL model operation default |
| ------------------- | --------------: | ---------------------------------: | ---------------------------------: |
| `inputBytes`        |      `Infinity` |                         33,554,432 |                         33,554,432 |
| `primaryRecords`    |      `Infinity` |                            100,000 |                            200,000 |
| `embeddedValues`    |      `Infinity` |                          1,500,000 |                          4,000,000 |
| `depth`             |             128 |                                128 |                                128 |
| `stringBytes`       |      `Infinity` |                          1,048,576 |                          1,048,576 |
| `totalStringBytes`  |      `Infinity` |                         16,777,216 |                         67,108,864 |
| `rdfQuads`          |      `Infinity` |                          1,000,000 |                          1,000,000 |
| `rdfDeepIterations` |         100,000 |                            100,000 |                            100,000 |
| `deadlineMs`        |          10,000 |                             10,000 |                             60,000 |
| `expandedXmlBytes`  |      33,554,432 | 33,554,432, inherited from package | 33,554,432, inherited from package |

All named package limits accept a positive safe integer or `Infinity`; `rdfDeepIterations` additionally accepts zero.
An override above a former package ceiling is valid if it satisfies this domain.
Reject `null`, fractions, negative values, `NaN`, negative infinity, unsafe integers, unknown names and malformed limit records as `OPTION_INVALID`, preserving the owning validator's pointer and validation order.
Do not normalize accessors, symbols, disallowed prototypes or non-enumerable fields into an apparently valid record.

`Infinity` lifts only its named limit.
An infinite package deadline arms no timer but preserves explicit cancellation and budget observations; a finite deadline beyond the timer's maximum delay is re-armed rather than expiring immediately.
An infinite `rdfDeepIterations` also lifts the RDF canonicalizer's implicit blank-node-count-squared work bound.
The amendment changes resource admission, not canonical bytes, semantic profiles or successful-operation outputs.

#### 11.2.2 Application, transport and acquisition boundaries

`canonicalVowlWorkerPolicy.js` owns `APPLICATION_LIMIT_POLICY` as default/upper-value pairs and derives `APPLICATION_LIMITS`; these are application exports, not exports from `vowl`.
`canonicalVowlWorkerOperations.js` applies those defaults, overlays `MODEL_OPERATION_LIMITS` for the lifecycle operations named by `MODEL_OPERATION_NAMES`, then overlays explicit caller descriptors.
The model profile applies to opening, recovery, editing, capture, source reads and RDF export.
The inspected policy records the owner-approved 10,000-class hierarchy rationale; the numbers above are existing choices, not fresh cache measurements.

The retained upper values in the application record are not proof that every field is checked against them.
The inspected worker client enforces finite `inputBytes` up to 268,435,456 and `deadlineMs` up to 300,000; checkpoint transport additionally enforces finite `depth` up to 512.
Other explicit overrides reach the package validator under its amended domain; ordinary OWL loading must not acquire an invented universal depth-512 or former package ceiling through this integration.
Preserve the actual rejection/acceptance boundaries and explicit-override precedence rather than silently making every recorded application upper value mandatory.

Acquisition remains independently finite.
`importResolver.js` obtains its input fallback from the local `APPLICATION_LIMIT_POLICY`, while the normal acquisition owner supplies an `OWLOntologyLoaderConfiguration`.
In the inspected selected dependency, its acquisition defaults bound each document and the root-plus-import byte total to 33,554,432 bytes, and the acquisition map admits at most 256 distinct imported document keys per load.
Repeated imports use that map; cached bytes must follow the same per-document and aggregate accounting as direct bytes.
The acquisition owner does not enforce a separate depth-32 graph cap merely because the dependency's default configuration contains that number.
Import depth is supplied by the OWL adapter below.
A larger package/input override does not automatically enlarge these acquisition gates.

The worker's finite whole-job deadline includes import waits, lazy module loading and downstream model work.
Preserve cancellation and stale-result handling across batched package polling; do not let a cache hit, callback, format continuation or package-level infinite deadline disable the active worker boundary.

#### 11.2.3 Derived OWL limits and finite service policy

The uncommitted `owl/loading.js` and shared `profileCheckLimits` in `owl/policy.js` derive dependency limits from the resolved operation policy.
Both strict and compatible ingress use that profile helper.
The material changes from the prior adapter are:

| Dependency boundary           | Adopted mapping and consequence                                                                                                                                                                                                                                                             |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Loader input and expanded XML | `maxInputBytes ← inputBytes`; `maxExpandedXmlBytes ← expandedXmlBytes`. XML expansion no longer follows the source-byte allowance.                                                                                                                                                          |
| Loader imports                | `maxImportCount ← primaryRecords`; `maxImportDepth ← depth`. The former independent caps of 256 and 32 have been removed from this adapter; the acquisition count gate remains separate.                                                                                                    |
| Loader structure/work         | Axioms and blank nodes follow `primaryRecords`; token count and RDF-list length follow `embeddedValues`; token length follows `stringBytes`; quads follow `rdfQuads`; annotation, expression and XML nesting follow `depth`.                                                                |
| Profile checking              | Depth follows `depth`; literal length and numeric digits follow `stringBytes`; work follows twice `embeddedValues`. The old 65,536-digit and 1,000,000-work fixed caps are removed.                                                                                                         |
| Dependency representation     | Numeric bounds are clamped to `Number.MAX_SAFE_INTEGER` by `owlapiLimit`; an infinite profile-check timeout uses the dependency's `null` sentinel. These translations do not make `null` valid in public `vowl` limits.                                                                     |
| XML entity work               | Explicit `expandedXmlBytes: Infinity` also lifts the dependency's internal entity declaration, expansion-depth and replacement-length controls through its accepted numeric representation. Finite expanded XML retains those dependency defaults; external resource access remains denied. |

Thus the default browser model operation now derives import depth 128, an adapter import-count bound of 200,000, a numeric-digit bound of 1,048,576 and profile work of 8,000,000.
The 256-import acquisition gate still applies, and other input/work/deadline checks can reject earlier.
These derived values describe current source behavior, not permission to acquire that many documents or a claim that every such workload succeeds.
Identical application defaults therefore do not imply identical pre-amendment loader admission.

The public materialization service owns a separate, explicitly finite resource policy.
Retain the planned 33,554,432-byte per-document service ceiling; document validation disables import retrieval.
The previous 256-import/depth-32 service-closure ceilings apply only if that deferred server closure capability is separately activated; they are not new browser or package restrictions.
Resolve and fingerprint finite service parser nesting, string/record/quad/work, expanded-XML/entity, memory and time bounds from the selected public dependency and service stage before qualification.
Never let omitted service settings inherit unbounded package defaults, accept caller-controlled service limit overrides or lift entity controls merely because the package permits it.

Record each gate's owner, unit, scope, resolved value and dependency translation.
Where multiple active gates constrain the same quantity and scope, the stricter applicable gate wins; do not compute a meaningless minimum across per-document bytes, aggregate closure bytes, nesting, counts and work units.
Include decoder/base policy, format inventory, parser/profile mode, imports, retries, redirects, XML/entity policy, contract version and public errors in the stage fingerprint.
Qualification must prove finite service containment and direct/cache consumer parity under this amended baseline.

### 11.3 Exact package and runtime parity

Qualification must prove the same selected artifact, installed payload/dependency closure and stage policy in both runtime bundles, with one package copy and only public exports.
Use the native exact registry or immutable Git selector described in §2; record source, installed, bundled and deployed identities separately.
Compare parser selection, typed outcome, ontology/import identifiers, source evidence/diagnostics and qualification report for identical bytes, parser IRI and public format metadata.
Equal version strings or matching lockfile snippets alone are not proof.

Use `OWLDocumentFormats` to enumerate public formats, media/extension aliases and candidate selection; application Accept preferences are a versioned ordering over that metadata, not a copied syntax list.
Compatible ingress with no explicit selection must exercise the public loader's byte-based syntax detection; headers/extensions are observations, not a forced parser choice.
Explicit selections and strict structural ingress retain their public metadata validation and typed ambiguity/rejection.
Record service validation selection and observed successful parser separately from the browser caller's selection mode and explicit input.
An IRI-only service binding certifies its fixed service policy; the acquisition owner preserves and the browser evaluates the caller's actual choice.
The anonymous service cannot ask a human during a worker deadline and must not implement its own sniffing or private-parser retry loop.
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
Before using any server closure report, compare it with the actual browser-acquired member identities, contexts, resolved edges and policy tuple.
Any mismatch leaves that report inapplicable; run ordinary browser checks.
First release uses these manifests in qualification fixtures and browser evidence, not a general server precomputation service.

### 11.6 Isolation and failure hygiene

Use a fresh manager per document/closure qualification job and an external no-network trap to prove parser isolation.
All closure acquisition is through the controlled loader; the package gets no caller credentials or unbounded fetch authority.
Exercise imports, JSON-LD contexts, XML resources and internal transport/cache paths at actual use: every secondary fetch is denied or goes through the same explicit authorization and bounded acquisition policy.
A warm internal cache must not bypass current source eligibility, destination or policy checks.
Source context always comes from the immutable resolution binding or the direct acquisition policy.
Normalize supported public errors without consumer-side message matching or private imports; unexpected exceptions fail closed as internal validation failures and alarm.
The amended package distinguishes caught runtime stack/allocation exhaustion as `HOST_RESOURCE_LIMIT`, with owned `details.resource` values `callStack` or `allocation`; an already observed caller abort or expired deadline takes precedence.
Keep finite resource rejection, host exhaustion, `ABORTED`, `DEADLINE_EXCEEDED`, syntax/profile failure and unexpected internal failure distinct through adapter, worker, session and service-attempt boundaries.
A process- or worker-killing out-of-memory failure may produce no package exception; supervision/deadline recovery must record the observed interruption without claiming a caught error or a completed semantic verdict.
No resource/host failure enables proxy fallback, an automatic higher-limit retry or new publication.

The inspected application sanitizer `canonicalVowlFailure.js` does not yet admit `expandedXmlBytes`, `callStack` and `allocation` as resource labels or provide a specific `HOST_RESOURCE_LIMIT` explanation.
SLICE-005 must reconcile those bounded diagnostic labels and user-facing handling with the amended package contract, or reuse the implementer's completed fix if it arrives first; source inspection alone is not evidence that the new details survive the worker seam.
Do not copy the package's engine-message recognition into the cache client.
Bound diagnostics and retain causes only in protected engineering evidence with redaction.
Private staging may precede parsing only after storage/publication eligibility checks; the final CloudFront-readable prefix requires accepted document validation.

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
Browser closure loading remains within its existing aggregate budget; any future server closure service needs its own bounded resumable envelope.

A new representation requires a complete accepted 200 response; reject 204, 206, authentication challenges and range/session-dependent bodies.
Handle 304 only as a conditional-refresh result under §7.5.
Persist `ETag`, `Last-Modified`, relevant `Cache-Control`, `Vary`, response status, effective URI, acquisition time and the versioned selected request headers/variant fingerprint.

Version 1 admits `Vary` only over service-controlled, fixed representation-selection inputs such as Accept and Accept-Encoding, with exact values captured and compared on reuse.
Reject `Vary: *`, caller-dependent/unknown variation and credentials/session dependence.
A changed Accept preference or package metadata changes the request-policy fingerprint and requires variant reconciliation, even if source key and byte digest happen to match.
Origin validators are scoped to that source variant and target; a 304 does not bypass restriction/metadata updates or semantic requalification.

The service republishes admitted immutable source snapshots rather than claiming its digest URL is the origin's current response.
Ordinary freshness expiry determines when a check is due; it does not by itself expire an explicitly archived snapshot.
If stronger origin storage/reuse restrictions are incompatible with this deliberate public archive, reject automatic publication unless a separately curated rights/policy decision permits the snapshot.
The automatic archive rejects `no-cache`, `must-revalidate`, `proxy-revalidate` and `s-maxage` as a deliberately conservative service admission policy; RFC 9111 does not turn all of those directives into storage or legal republication prohibitions.
Applicable HTTP reuse rules still apply, and any curated archive exception requires a separate rights/policy disposition.
Conditional refresh and metadata merging follow [RFC 9111](https://www.rfc-editor.org/rfc/rfc9111.html#section-4.3.4); a source's absent cache directives are not proof of legal republication permission.

### 12.4 Republishing/admissibility policy

Broad automatic admission needs no publisher allowlist or per-source approval: a publicly fetchable HTTP(S) source must pass the same parsing, security and publication controls.
Public accessibility/successful parsing alone do not bypass the exclusions below.
Reject known storage restrictions before durable staging, and complete content/validation checks before public promotion.
The worker rejects a response when:

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
Distinguish two incident scopes:

- Source withdrawal fences that source, removes future seed/current-pointer discovery and prevents rematerialization.
  Review access to its source-specific historical associations; retain only permitted private audit evidence.
  Do not automatically block shared byte objects still legitimately used by other sources.
- A confirmed content incident fences the affected digest and all relevant source/version bindings, blocks new origin delivery of those bytes under our control and invalidates affected CloudFront paths.
  Invalidation alone is insufficient because S3 could refill the edge; both actions and their propagation must be verified.

Permanent history is subject to these explicit safety/rights dispositions; any actual deletion is a separately approved incident action, not routine eviction.
Distinguish detection time, approval/actuation and measured containment delay. Previously downloaded/browser copies cannot be recalled.
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

### 12.7 WAF, request controls and work quotas

Use the shared `PublicWebDeliveryWebAcl` and an initial rate rule `OntologyMaterializationSubmissionRateLimit` in COUNT before approved BLOCK.
Its proposal aggregates by source IP over 300 seconds with a starting limit of 300, covering materialization POST and the exact per-source refresh POST paths.
Refresh must not bypass the submission rule.
Measure shared addresses, root/import bursts, retries and check-now/if-due traffic before BLOCK; WAF is approximate availability protection, not exact work accounting.
Keep sampled/full request logging disabled initially.

Status GETs and repeated/coalesced POSTs consume API resources even when they create no job.
Use an explicitly finite API reserved-concurrency proposal (initially four), native Function URL throttling, bounded five-second handlers/body/path parsing, non-overlapping client polling and measured read-versus-write admission controls.
Do not claim the new-source quota or POST-only WAF rule bounds all API charges.
An additional edge rule or different threshold requires current cost/traffic evidence and exact configuration approval.
The operational stop can set the dedicated API's reserved concurrency to zero when necessary; static S3 reads remain independent.
WAF/shared-edge charges are still outside this work bound.

The registry transaction enforces:

- 500 newly admitted source keys per UTC day initially;
- a separate initial ceiling of 500 admitted refresh cycles per UTC day, to be tightened/revised from actual cost evidence before enablement;
- one active attempt per source generation; repeated calls/polls join or observe it without another work/version record;
- a finite per-source cooldown and failure backoff, honored by both modes and automation;
- feature enablement, quarantine and global queued-work headroom before enqueue;
- at most three worker attempts per admitted cycle, worker concurrency two and finite per-attempt resource/time limits.

These work limits do not cap permanent archive population or version count.
Freeze cooldown/backoff and queued-work headroom with the accepted cost model and adversarial/legitimate workload fixtures in SLICE-001.
Feature stop rejects new admission, holds unstarted queued work, lets only bounded already-active work settle, and preserves intent/attempt evidence for explicit reviewed resumption.
A reconciler may settle already admitted work but cannot create a new origin-check cycle merely because time passed.

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

| Path pattern                                                                                | Origin             | Allowed methods                                                                                   | Cache/origin details                                                                                                                           |
| ------------------------------------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `ontology/materializations`                                                                 | API                | All at CloudFront; API permits POST/OPTIONS only                                                  | `CachingDisabled`; forward body plus only required CORS/content hash/content type headers; no cookies/query.                                   |
| `ontology/materializations/*`                                                               | API                | All at CloudFront; API dispatch permits GET/OPTIONS and POST only on the exact refresh collection | CachingDisabled; strict source/attempt grammar; same narrow header/body policy.                                                                |
| `ontology/cache/artifacts/*`                                                                | artifact S3        | GET/HEAD/OPTIONS                                                                                  | Custom immutable policy; no cookies, headers, or query in the cache key. Only digest tokens are used by clients; raw query logging is omitted. |
| `ontology/cache/provenance/*`                                                               | artifact S3        | GET/HEAD/OPTIONS                                                                                  | Five-minute mutable policy with the §1.1 stale controls and ETag; exact-source current pointer.                                                |
| `ontology/cache/versions/*`, `ontology/cache/resolutions/*`, `ontology/cache/validations/*` | artifact S3        | GET/HEAD/OPTIONS                                                                                  | Immutable source version/context/evidence; no query/cookie variation. Deferred closure paths need their own approved route.                    |
| `ontology/catalog-v001.xml`                                                                 | artifact S3        | GET/HEAD/OPTIONS                                                                                  | Min 0, default 300, max 86,400; honor origin stale directives.                                                                                 |
| `ontology/catalogs/*`                                                                       | artifact S3        | GET/HEAD/OPTIONS                                                                                  | Immutable policy.                                                                                                                              |
| Existing `ontology/*`                                                                       | existing static S3 | Existing                                                                                          | No change.                                                                                                                                     |

No cache-specific behaviour associates `RewriteOntologyURI.js`.
Legacy custom 404 behavior may remain on existing website paths, but the cache API returns 404 for unknown status and 410 for known deliberate retirement.
Gate C must prove those API responses retain JSON/no-store semantics without legacy HTML remapping or negative-cache TTL inheritance; deployment must select an accepted isolation mechanism before activation.

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

### 14.1 Stack dependencies and deployment order

Use the AWS plan's §§4.4–4.6 ownership contract, binding to the existing distribution's actual owner.
Full estate separation, unrelated resource moves and physical stack renaming are not cache prerequisites.
The planned dependencies are:

```text
Materialization storage (eu-west-1) → Materialization service (eu-west-1)
          │ artifact origin                    │ API origin
          └───────────────────┬────────────────┘
                              ▼
                 Shared public delivery (us-east-1)
                              │ existing distribution identity
Storage + service identities ─┴─→ Materialization access bindings (eu-west-1)
```

Neither storage nor service may reference delivery or access bindings.
Access bindings consume the required identities and own each complete affected resource policy.
Inspect synthesized grants and OAC helpers: no second artifact-bucket policy writer and no distribution-dependent permission created implicitly in the service stack.
Use supported constructs with explicit ownership, or native policy/permission resources where needed, and prove the resulting graph.

Dependency direction alone does not establish safe deployment order.
After the payer-approved containment gate in §16.5, deploy approved storage/service resources with admission disabled and public routes absent.
Next install and read back access bindings against the already verified distribution ARN.
Only then attach approved origins, OAC and behaviours, followed by edge-access and direct-origin-denial probes.
Enforce this through deployment gates without creating a reverse delivery-to-bindings CloudFormation reference.
No temporary public bucket or anonymous Function URL is permitted.

The existing publication bucket's complete policy remains with its actual storage owner.
Moving that policy into a separate publication-binding stack is an optional, separately proved AWS migration; materialization bindings do not take it over.
Keep existing cross-region reference helpers during structural moves.
For new integrations, prefer the AWS plan's versioned deployment artifact: environment/account/Region, producer/source revision, exact resource identities, generation, policy/schema version, digest and trusted producer.
Verify its origin and actual service identities; a hash alone does not authenticate a producer.
Reuse the trusted deployment channel rather than inventing a signing service or cross-region framework.

Do not rename deployed stack IDs, move existing constructs, or replace the distribution, certificate, DNS records or publication bucket to match this diagram.
Any existing-resource refactor must preserve identity and establish its own equivalence/recovery evidence separately from new-service creation.

### 14.2 Predicted CDK owners and modules

Reconcile the earlier `regional_data_stack.py` and cache-owned global-delivery proposal with these AWS-owned seams:

| Owner                                                        | Predicted module                                                   | Responsibility                                                                                                                                                                                                   |
| ------------------------------------------------------------ | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `HaddenIndustriesOntologyMaterializationStorageStack`        | `infrastructure/ontology_materialization/storage_stack.py`         | Retained artifact/provenance/catalog and observability/report storage, durable registry/control/quota state, lifecycle/backup settings.                                                                          |
| `HaddenIndustriesOntologyMaterializationServiceStack`        | `infrastructure/ontology_materialization/service_stack.py`         | API/Function URL, workers, queues/DLQs, per-source/curated projection, request-driven refresh, reporting schedules, service IAM/logs/alarms and admission control; no retained-storage or shared-edge ownership. |
| `HaddenIndustriesOntologyMaterializationAccessBindingsStack` | `infrastructure/ontology_materialization/access_bindings_stack.py` | Complete new artifact-bucket policy, applicable distribution-conditioned destination policies and both Lambda invocation permissions.                                                                            |
| Actual shared public-delivery owner                          | `infrastructure/ontology_materialization/delivery_binding.py`      | Compose the cache origins/routes with the existing distribution, behaviour order, shared WebACL/association, response policies and logging.                                                                      |
| Service monitoring owner                                     | `infrastructure/ontology_materialization/monitoring.py`            | Feature metrics, alarms, dashboard, notifications and feature-only cost containment integrated with shared delivery telemetry.                                                                                   |

These are semantic ownership boundaries, not scaffolding to deploy before a slice needs them.
The single artifact-bucket policy includes transport-deny and OAC statements; unrelated publication policies remain outside its scope.
Ordinary regional storage policies stay with storage unless an explicitly identified distribution-conditioned policy requires late binding.
Queues belong to service deployment but contain real pending work: replacement/deletion requires admission stop, drain/reconciliation, retention and recovery evidence.
Prove a service-only release leaves retained state and unrelated delivery unchanged.

Keep the detailed Lambda application/domain names in §18; no forwarding classes or compatibility aliases are needed for names that have never been implemented.
Avoid generic `utils.py`, `helpers.py` or `resources.py` owners.

### 14.3 New logical resources

| Logical name                             | Initial settings                               | Notes                                                                                                            |
| ---------------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `ValidatedOntologyArtifactBucket`        | private, versioned, SSE-S3, retain             | New origin; no public ACL/policy.                                                                                |
| `OntologyCacheObservabilityBucket`       | private, SSE-S3, retain                        | CloudFront logs v2, Athena results, aggregate reports; raw logs expire after 90 days.                            |
| `ValidatedOntologyRegistryTable`         | on-demand, PITR, deletion protection           | Point/partition-query source history; bounded curated projection/report reconciliation, no due-source scan.      |
| `OntologyMaterializationQueue`           | Standard, managed encryption, 4-day retention  | Batch size one; max concurrency two.                                                                             |
| `OntologyMaterializationDeadLetterQueue` | Standard, managed encryption, 14-day retention | Alarm on first message.                                                                                          |
| `OntologyCatalogProjectionQueue`         | Standard, managed encryption                   | Coalesces per-source and curated projection intents; concurrency one, bounded batches; no whole-archive rebuild. |
| `OntologyMaterializationApiFunction`     | Node 24 ARM64, 256 MiB, 5 seconds              | Function URL uses `AWS_IAM`; small JSON only; initial reserved concurrency four.                                 |
| `OntologyMaterializationWorkerFunction`  | Node 24 ARM64, 2,048 MiB, 60 seconds           | Egress topology pending §12.8; exact `owlapi`; concurrency two.                                                  |
| `OntologyCatalogProjectionFunction`      | Node 24 ARM64, 512 MiB, 30 seconds             | Fenced per-source pointers and curated generation/root CAS; concurrency one.                                     |
| `OntologyUsageReportFunction`            | Node 24 ARM64, 256 MiB, 30 seconds             | Starts/finalizes private Athena reports asynchronously.                                                          |
| `OntologyCacheOperationalDashboard`      | One private CloudWatch dashboard               | Prefer native service metrics; no per-source dimensions.                                                         |
| `OntologyCacheCostAlertTopic`            | encrypted only if existing policy/cost permits | Reuse an existing confirmed email topic where semantically correct; do not duplicate subscribers silently.       |
| `PublicWebDeliveryWebAcl`                | CloudFront scope, default allow, one rate rule | Count-first rollout; WAF cost applies to all distribution requests.                                              |

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
      requestOntologyRevalidation.js
    reporting/
      ontologyCacheUsageReport.js
    observability/
      writeStructuredOperationalEvent.js
  test/
    fixtures/
```

The application manifest is private, uses `type: "module"`, exact runtime dependencies, Node’s built-in test runner, and no install/lifecycle scripts. Bundle each handler with CDK `NodejsFunction`/esbuild in ESM mode for Node 24/ARM64, without minification or source maps, and include exact AWS SDK v3 clients rather than relying accidentally on the runtime’s mutable SDK version.
Only the document-validation bundle needs `owlapi` and parser dependencies in first release, using the exact accepted package.
No general server closure handler is created; contextual document/version records remain with the registry/evidence owners.
The Node 24/ARM64 and no-install-script packaging choices are qualification targets, not a demonstrated compatible build for the newly selected dependency closure.
Prove the exact native dependency artifacts, loader paths and bundle inclusion/exclusion; do not assume an ESM bundle supplies a usable native module or silently enable lifecycle scripts. A failing ARM64/install-policy probe requires a concrete packaging/runtime decision and exact approval before deployment.

Creating this manifest/lockfile, adding exact esbuild/AWS SDK/network dependency versions, and changing CDK bundling are configuration changes requiring the approval gate in §2.4. A dependency is accepted only after licence, maintenance, vulnerability, browser/Node compatibility where applicable, bundle content, and lockless/locked resolution review.

WebVOWL and the installed `owlapi` RC declare AGPL-3.0-only at this revision's inspection time.
A network-deployed worker bundle that incorporates `owlapi` therefore must not reach a live environment until the project owner has completed an appropriate licence review and recorded the compliant corresponding-source mechanism for the exact deployed revision.
At minimum, `THIRD_PARTY_NOTICES.md` identifies every bundled component and licence, `LICENSES/AGPL-3.0-only.txt` preserves the applicable licence text, and `CORRESPONDING_SOURCE.md` identifies the immutable WebVOWL/worker and `owlapi` source revisions, build inputs, scripts, and user-facing source-access location.
Those files are evidence outputs, not a substitute for the review, and the review decides whether further material must be included in corresponding source.
The public transparency surface links the source-access location for every live worker revision.

General server closure precomputation and its function/queue are deferred.
A later proposal must justify the consumer benefit and exact manifest matching, with independently bounded budgets, recovery and costs.
Do not create unused handlers/resources merely because the reserved closure contract exists.

### 14.5 IAM policy boundaries

- API: point read/update/transaction on registry/control/quota keys and `SendMessage` to materialization queue; no S3 object write/read, catalog publication, CloudFront, WAF, or arbitrary DynamoDB table access.
- Worker: receive/delete/visibility through its queue integration; fenced registry transitions; restricted immutable staging/artifact/version/evidence reads/writes; durable per-source/curated projection intent; no root/distribution update or source credential access.
- Projection publisher: point reads for changed source generations, bounded curated membership reads and conditional pointer/catalog writes; update only its projection state.
  No upstream fetching or global dynamic scan.
- Report function/Athena workgroup: read selected log/report prefixes and a projection of registry metadata; write report/query-result prefixes; no artifact mutation.
- Bindings stack policies: CloudFront service principal constrained by exact distribution ARN and account; S3 read only; Lambda `InvokeFunctionUrl` and `InvokeFunction` only for the API function.

No role receives `s3:*`, `dynamodb:*`, `lambda:*`, `cloudfront:*`, or `*` resource scope except an action that demonstrably lacks resource-level authorization, with a precise cdk-nag acknowledgement.

### 14.6 Reliability configuration

- SQS absorbs origin/parser bursts and isolates the API latency from materialization duration.
- Standard-queue at-least-once delivery is safe because registry leases and content-addressed conditional writes are idempotent.
- Reserved concurrency prevents the worker from consuming account concurrency or spawning unbounded outbound requests.
- API throttling/quotas reject work before enqueue where possible.
- Per-source/curated publication is fenced and deterministic; duplicate dirty intents converge without rebuilding the dynamic archive.
- S3 and DynamoDB durable state precede acknowledgement.
- Reporting/recovery schedules have bounded retries and DLQs.
  No schedule initiates source freshness checks.
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
  refreshAttemptId,
  triggerKind,
  requestedAt,
  startedAt,
  completedAt,
  sourceVersionIdentity,
  failureStage,
  failureResource,
  durationMs,
  byteLength,
  artifactSha256,
  validationProfileId
}
```

Fields are included only when known.
Durable attempt records, rather than expiring log lines, retain operational history: request/admission/start/completion times, trigger mode, generation, HTTP/typed failure stage/code, unchanged/changed/failed/superseded outcome and resulting version/validation/binding.
Separate last attempted, last successfully checked and last changed times; a failure updates only the appropriate attempt/failure fields.
For limit failures retain the resolved policy fingerprint, owned stage/resource category and finite safe counters when available; never invent a measured allocation size or encode `Infinity` as a numeric log value.
Host exhaustion and supervised interruption remain failed attempts rather than durable claims that an ontology is invalid.
A 304 advances successful-check time without claiming new acquisition, bytes or parsing.
Requests rejected before admission and coalesced polls do not become phantom origin attempts.
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

| Data                                                             | Retention                                                                         | Reason                                                                                                                                |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Exact URI record and distinct accepted source versions           | Permanent, except approved safety/rights disposition                              | One source record per URI and one immutable version record per distinct bytes/context tuple; no age, entry or version-count eviction. |
| Accepted byte objects and version/validation/resolution evidence | Permanent while supporting any accepted historical version                        | Global byte deduplication; old accepted versions remain reference roots even when no longer current.                                  |
| Compact admitted attempt/transition history                      | Permanent with the source archive, except applicable incident/privacy disposition | Explain when checks ran, errors, requalification and A→B→A recurrence without duplicating versions.                                   |
| Lambda diagnostic logs                                           | 30 days                                                                           | Detailed diagnosis has a shorter lifetime than the durable sanitized attempt ledger.                                                  |
| Raw CloudFront logs                                              | 90 days                                                                           | Traffic/cost/incident evidence without indefinite viewer-event retention.                                                             |
| Athena results / daily reports / monthly reports                 | 30 days / 400 days / 25 months                                                    | Bounded operational extracts and aggregate trends.                                                                                    |
| Noncurrent mutable-pointer object versions                       | 90 days after rollback evidence exists                                            | Recovery copies are separate from permanent application-level source-version records.                                                 |
| Unaccepted/unreferenced private staging                          | Approved finite recovery window                                                   | It is not part of the accepted archive; never expire active inputs.                                                                   |
| Quarantine/takedown audit                                        | Approved legal/security policy                                                    | Ordinary lifecycle cannot erase required incident evidence.                                                                           |

There is no fixed 25,000-entry or historical-version ceiling.
The archive covers accepted versions actually observed; it cannot capture every intermediate origin change between uses when no source checking occurs.
Storage cost grows with unique content and evidence, not every repeated refresh body; report that growth and revise the operating budget before changing retention.
An origin version label, ETag or timestamp is not sufficient for deduplication.
S3 Versioning creates versions on overwrite and is useful for pointer recovery; application conditional writes/content identities provide the required unique-version contract.
This is consistent with identifiable past-resource snapshots in [Memento](https://www.rfc-editor.org/rfc/rfc7089.html); no Memento protocol implementation is required.
Permanent retention is the owner's product decision, not an HTTP requirement.
See [S3 Versioning](https://docs.aws.amazon.com/AmazonS3/latest/userguide/Versioning.html).
Lifecycle changes still require exact configuration approval; safety/rights incidents can override ordinary archival access/retention under §12.4.

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
- unique new materializations, distinct versions, validation outcomes and admitted/coalesced/skipped/failed refresh activity;
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
- documented permanent version history, use-triggered/manual refresh, last-known-good dates and user-controlled update application.

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
  + S3 artifact/version/staging/resolution/validation/curated-catalog/log storage and requests
  + retained object versions, recovery copies and backup/restore tests
  + document/refresh/API/projection Lambda requests and GB-seconds above remaining account allowance
  + native-dependency packaging/cold-start/memory and decompression work
  + selected independent egress/filtering/NAT fixed and data-processing charges
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
They predate permanent version/attempt history, exact-source projection, refresh API/request controls and the selected egress design; SLICE-001 must recalculate those costs.
General server closure compute is deferred from first release.
They assume the account still has its CloudFront/Lambda/SQS/CloudWatch free allocations, average stored ontology size near 1 MiB, one WAF rule, no managed rule group, selected-field compressed logs, and low report scan volume.

| Scenario                | Shared distribution requests / transfer | New materializations / retained data | WAF estimate |                                                  Other cache services | Expected incremental total |
| ----------------------- | --------------------------------------- | ------------------------------------ | -----------: | --------------------------------------------------------------------: | -------------------------: |
| Quiet launch            | 1 million / <100 GB                     | 1,000 / ~1 GB                        |    ~USD 6.60 |                                                        ~USD 0.10–0.50 |             ~USD 6.70–7.10 |
| Healthy growth          | 3 million / <300 GB                     | 10,000 / ~10 GB                      |    ~USD 7.80 |                                                        ~USD 0.30–1.00 |             ~USD 8.10–8.80 |
| Budget edge             | 5 million / <500 GB                     | 25,000 / ~25 GB                      |    ~USD 9.00 |                                                        ~USD 0.60–1.50 |            ~USD 9.60–10.50 |
| Free-request exhaustion | 11 million / <1 TB                      | 25,000 / ~25 GB                      |   ~USD 12.60 | at least ~USD 1.00 paid CloudFront HTTPS requests plus other services |                 >USD 13.60 |

Adding a second custom WAF rule adds approximately USD 1/month before request-related changes. At the stated budget, do not add a managed ruleset, Bot Control, CAPTCHA/Challenge, full WAF logging, or additional custom rules at launch without a revised approved estimate.

The historical scenarios do not establish that USD 10 is feasible with the selected egress and dependency closure.
For example, the AWS plan's dated October 5 NAT illustration was USD 0.048/hour (USD 35.04 for 730 hours) before data processing and other services; it is not a current quote.
Refresh official pricing and actual workload evidence before selecting topology or enabling chargeable resources.
USD 10 is a revisable operating target.
Revise it or the proposed topology with the payer if security, permanent history or compute requirements exceed it; do not weaken controls or silently evict versions.

### 16.4 Cost containment design

Use layered limits rather than a single destructive switch:

1. **Admission:** initially 500 new source keys and separately 500 refresh cycles per UTC day; coalesced calls/polls do not admit new work.
   Bound queued headroom and per-source cooldown.
2. **API/edge abuse:** submission/refresh POST WAF coverage, finite API concurrency/native throttling and measured status/repeated-request controls (§12.7).
3. **Compute:** worker concurrency two, one message per invocation and finite deadlines/attempts.
   General server closure compute is deferred.
4. **Storage:** 32 MiB artifact ceiling, deterministic byte/version deduplication and bounded lookup/catalog responses; permanent archive growth is measured, not stopped by a global entry ceiling.
   Never evict history automatically to meet the budget.
5. **Query/logging:** 1 GiB Athena cutoff, bounded selected log fields, finite retention, no real-time logs.
6. **Budget warnings:** notify at USD 7 actual, USD 9 forecast, and USD 10 actual incremental monthly cost, using current AWS Budgets/Cost Explorer capabilities selected at approval time.
7. **Feature kill:** the limit action sets `CONTROL#SERVICE.materializationEnabled = false`.
   New acquisitions and refresh admission receive 403; hold queued unstarted work and bound already-active attempts.
   No scheduled source check may evade the stop.
   An approved API-concurrency stop contains abusive status traffic while static reads/site remain available.
8. **Operator review:** identify WAF versus traffic versus storage/compute driver, then explicitly re-enable, retune, or keep disabled.
   Never reset a counter or budget automatically merely because a Lambda retried.

The cache cost envelope comprises dedicated, tagged resource charges, the full incremental WAF charges, and the measured CloudFront/logging variance from the recorded shared-distribution baseline.
Resource tags and AWS Budgets cannot allocate shared CloudFront charges by path, so reports must not present a tag-only number as the cache's exact cost.
Attribute path-level requests and bytes from selected CloudFront logs, apply the current rate tiers conservatively, and retain both the modelled cache attribution and the authoritative whole-distribution bill.

### 16.5 Migration of the current whole-distribution cost cutoff

The historical `DisableCloudFrontOnCostLimit` path evaluated a configured CloudFront ceiling every minute and could disable the entire distribution; SLICE-001 must verify its current configuration and ownership.
Preserve the existing control during an identity-preserving structural move; do not change its behavior inside that refactor.
Before any chargeable cache/WAF enablement or cold-path canary, obtain the payer's exact approved transition:

- record its exact present behaviour, cost, alarms, and failure modes;
- ensure its threshold does not interpret the WAF’s expected fixed cost as an emergency requiring website shutdown;
- separate site-wide emergency policy from the validated-cache feature budget;
- replace cache-triggered distribution disablement with the materialization kill switch;
- reduce cost-check cadence/API usage to the minimum supported by billing-data freshness;
- keep any genuine whole-site emergency action disabled or alert-only unless separately approved with a documented recovery path; and
- test that a simulated cache budget breach leaves website, UO query, seed catalog, catalog root, and READY artifact GETs healthy.

Because this changes an existing safety control, it is a distinct configuration/deployment approval checkpoint and cannot be smuggled into the cache stack diff.
Bound and measure queued/in-flight work and refresh overshoot after a feature stop, including missing-telemetry behavior.
Delayed billing cannot guarantee a hard real-time cap.
Returning from a canary or failed release does not authorize clearing queues or setting the shared distribution to `Enabled=true`; read actual state and follow the accepted recovery policy.

---

## 17. WebVOWL integration architecture

### 17.1 Canonical acquisition seam

Extend the existing `createCanonicalVowlSourceAcquisition` composition with one session-scoped cache-aware acquisition dependency.
Root `remote()` and `createImportContext().resolveImport()` use the same policy, mapping state and operation accounting.
The external acquisition result retains exact bytes plus requested/retrieval/effective/parser IRIs, observed media/format metadata, selection mode, binding identity and sanitized resolution diagnostics.
The existing consumer boundary receives `{ bytes, documentIri, mediaType? }`, where `documentIri` is the explicit parser context and `mediaType` is omitted for automatic compatible loading.
The CDN's `Content-Type` and validation's observed parser result are evidence, not instructions to force that parser on the browser.
Keep additional provenance in the acquisition/session owner unless an independently approved consumer API change is needed.

The worker continues to invoke public `vowl/owl` operations, and that package continues to own `owlapi` manager construction, parsing, closure semantics and canonical mapping.
The cache does not insert parsed ontology objects into the session or maintain a parallel parser/mapper.
The current import resolver's `getDocumentIRI` and `loadBytes` must be characterized so transport remapping does not erase the logical request or turn a cache URL into the parser base.

### 17.2 Precedence, bypass and typed outcomes

When the cache integration is explicitly enabled, normal mode is per-load binding → curated OASIS seed binding → exact-key dynamic source pointer → direct controlled retrieval → eligible materialization fallback → typed outcome.
A fresh explicit open creates a new import context; the current import map only deduplicates within that load/format continuation, not across all later opens.
Successful archived acquisition may independently request background refresh under §7.5; the foreground read and loaded graph never depend on its completion.
The approved direct-only path is also the initial cache-disabled default.
It skips service catalog/pointer/artifact resolution, materialization, status polling and use-triggered/manual refresh for roots and imports while retaining ordinary acquisition, per-load import coalescing, direct URL policy, exact bytes, limits and cancellation.
It is an operator/build composition setting, not an arbitrary query-string endpoint or SSRF-policy override.

Unsupported encoding/format, readable HTTP errors, parser/profile failures, cancellation and local resource or host limits never cause a proxy retry.
A corrupt or stale-policy catalog entry is a cache-specific diagnostic; safe direct acquisition may still succeed.
Retain explicit format-selection/error continuations where the caller actually selected a format or the strict route requires one. Missing MIME/filename hints in automatic compatible loading do not prompt the user.
No user interaction or import wait may silently extend the whole-job deadline.

### 17.3 Session, source and resource ownership

Preserve original-source byte export, retained RDF/source evidence and current semantic exports as distinct session responsibilities.
Copy/transfer byte ownership under the existing worker protocol; never round-trip bytes through text just to integrate the cache.
Every foreground cache/catalog/poll/import operation participates in the existing cancellation and stale-result protocol.
Background refresh observation has its own bounded cancellable lifetime tied to the interested session.
Closing/replacing the document stops observation without falsely claiming that a coalesced backend attempt was cancelled.
A late response cannot replace a newer document, revive an expired worker operation or charge input bytes twice.
Conversely, cached/import-coalesced bytes cannot evade the applicable §11.2 per-document/aggregate acquisition, import-count, adapter depth, work or worker deadline gates.
Resolve limits from `APPLICATION_LIMITS` plus the selected `MODEL_OPERATION_LIMITS` and explicit caller overrides, with package defaults for remaining fields; do not source browser policy from the retired package export or silently reinstate its old upper bounds.
Preserve malformed-option rejection and the diagnostic obligations in §11.6.
A cache hit neither opts the browser into unbounded work nor cancels a valid caller override that the direct path accepts.

Retain generation/revision identity, immutable model reads and the existing owned-byte/copy boundaries; do not reintroduce whole-model cloning on hot read paths.
Opening may publish a preview after `openOwl` admission and before display ordering completes; preview does not skip ontology loading or its checks.
Late ordering, fetch/import responses and failed/cancelled replacement must preserve the correct current document, scene and selection/filter state.
Keep `vowl/owl`, migration and semantic export work behind their current lazy worker boundaries.
Prove cancellation during chunk/import waits, missing-chunk recovery and no stale preview/final result publication.
Cache integration must preserve first-render/startup behavior and production bundle budgets as well as semantic parity.

Local file/text and canonical/legacy JSON paths retain their current entry points.
Only their ontology imports may use the shared controlled acquisition owner.
Do not send VOWL JSON, arbitrary downloads or semantic export requests to the materialization service.

### 17.4 User-facing state and diagnostics

Map bounded acquisition events to the existing accessible loading status: catalog lookup, direct retrieval, pending materialization, acquired document, incomplete imports, profile assessment and consumer limit/failure.
Show the distinction between a valid document and an incomplete/unsuitable closure without claiming that a resource-budget rejection makes the ontology invalid.
Retain typed package/service codes and expose the catalog generation and cache/bypass mode in diagnostic details.
Do not show source excerpts, raw server internals or AWS identifiers.
Preserve `nodesShown`, filter/range controls, semantic equality, accessible search availability and disabled-result behavior through loading, cancellation and late results.
This is a regression obligation, not a cache-driven UI redesign.

Offer a nonblocking update notice only when a durably committed eligible source version/context relevant to the current document changes; a 304 or evidence-only requalification is not newer origin content.
The attempt result supplies the exact immutable candidate even while static pointer/catalog propagation is pending.
Show archived acquisition/last-check time, checking/failed-check state and a manual refresh action without blocking the graph.
Use “updated source available” rather than inferring a monotonic publisher version from ETag, timestamp or `versionIRI`.
Applying the offer explicitly reloads the root through existing admission, seeding that load's binding map with the verified exact offered root/import bindings; all other imports resolve normally.
Reconfirm candidate eligibility/current source version through the uncached source-status contract before apply. If it was withdrawn or superseded, report/re-offer the current result rather than silently loading something else; failed confirmation preserves the active graph.
A stale five-minute seed/source pointer cannot override the user-selected candidate.
This selected subset is not a frozen full closure, a per-import hot-swap or permission to replace source-export bytes without readmission.
Bind the offer to load generation, semantic revision and old/new source identities.
Recheck on apply; an intervening edit or different load invalidates or requires renewed confirmation of replacement.
The inspected UI has no general unsaved-document replacement guard, so protecting edits for this action is part of SLICE-005/006, not an existing capability to assume.
Keep original-source export tied to the bytes actually admitted; semantic RDF export remains tied to the current edited model.

### 17.5 Catalog performance and configuration

Coalesce curated catalog fetches and exact-source pointer reads, reuse HTTP validators, parse only bounded per-load maps and keep speculative prefetch off the critical render path.
Never enumerate the permanent dynamic archive or load a URI's full history to open it.
Use the current worker seam for expensive catalog processing if measurements require it; the optional JSON projection must satisfy §6.4 and §10.5.
No new scheduler/polyfill/storage layer is assumed.

Endpoint IRIs, bypass mode and finite limits are proposed configuration at the existing composition boundary.
Any new `ontologyLoadingConfiguration.js`, build setting, CSP `connect-src` change or browser harness/dependency change requires exact approval under §2.4.
Third-party deployments can inject approved service origins without accepting arbitrary viewer-supplied endpoints.

### 17.6 Delivery before activation

Keep the WebVOWL cache-activation control separate from the service's new-source/refresh admission control.
The first consumer delivery defaults to caching disabled, even if endpoint values exist or the backend is already reachable; backend discovery never activates it automatically.
Prove zero cache-specific network requests, polling/refresh timers and misleading cache/update controls while disabled, with ordinary root/import loading, source exports, limits, cancellation and startup/bundle budgets preserved.
The backend may be absent, return errors or be unreachable without delaying this disabled path.
Existing per-load import deduplication and ordinary browser HTTP caching remain normal acquisition behavior.

Consumer implementation and tests against controlled HTTP/static-artifact fixtures may complete and be delivered before the provider exists.
Use the real package/worker/session; simulate only the external protocol.
Keep the cache-specific modules lazy or otherwise prove the accepted startup budget.
That milestone is **consumer delivered with caching disabled; provider integration pending**, not end-to-end cache acceptance.
No dormant backend dependency or unpublished schema acquisition may prevent a clean consumer build.

Test enabled cache behavior only in explicitly selected test/canary environments until the actual provider passes §20.4/21.1.
A service with admission disabled may still serve qualified seeded/static bindings to that test client; this is distinct from a production WebVOWL client with caching disabled.
Enabling the production client requires the qualified contract/provider revision and live integration evidence.
Returning it to disabled mode aborts observation and rejects late results without claiming cancellation of already admitted shared server work.
Any activation setting or build/CSP/endpoint change follows §2.4's exact configuration approval; this planning revision changes none.

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
Reuse the uncommitted `resourceBudget.js`/`operationLimitDefaults` and application-policy implementation; cache work must not recreate the removed export, duplicate its validator or overwrite the implementer's limits changes.
Track the bounded `canonicalVowlFailure.js` diagnostic integration in SLICE-005 and qualify it with the real worker/client.
Update `src/productionGraph.architecture.test.js` and `src/testRunnerScope.architecture.test.js` only for actual new ownership.
Use the existing logical conformance readers and browser resources harness; do not copy physical corpus trees.
Inspect mapper code as contract evidence and change it only for a separately accepted consumer requirement, not to make cache integration convenient.

Keep workflow evidence in the configured external HISEW task store.
User/operator documentation may live in `docs/ontology-cache/` when it has a product audience; do not write engine receipts or temporary reviews into repository documentation directories.
Existing absent converter files have no deletion task, and the live canonical resolver is removed only if all its consumers have migrated and approval/scope permits that cleanup.

### 18.2 `amazon-aws` repository

**Create:**

```text
infrastructure/ontology_materialization/__init__.py
infrastructure/ontology_materialization/storage_stack.py
infrastructure/ontology_materialization/service_stack.py
infrastructure/ontology_materialization/access_bindings_stack.py
infrastructure/ontology_materialization/delivery_binding.py
infrastructure/ontology_materialization/monitoring.py
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
Lambda/Applications/ValidatedOntologyCache/src/revalidation/requestOntologyRevalidation.js
Lambda/Applications/ValidatedOntologyCache/src/reporting/ontologyCacheUsageReport.js
Lambda/Applications/ValidatedOntologyCache/src/observability/writeStructuredOperationalEvent.js
Lambda/Applications/ValidatedOntologyCache/test/**
validated-ontology-cache/contracts/ontology-materialization-request.v1.schema.json
validated-ontology-cache/contracts/ontology-materialization-error.v1.schema.json
validated-ontology-cache/contracts/ontology-refresh-request.v1.schema.json
validated-ontology-cache/contracts/ontology-refresh-result.v1.schema.json
validated-ontology-cache/contracts/ontology-source-version.v1.schema.json
validated-ontology-cache/contracts/ontology-source-pointer.v1.schema.json
validated-ontology-cache/contracts/ontology-artifact-provenance.v1.schema.json
validated-ontology-cache/contracts/ontology-resolution.v1.schema.json
validated-ontology-cache/contracts/ontology-validation.v1.schema.json
validated-ontology-cache/contracts/ontology-loader-policy.v1.schema.json
validated-ontology-cache/contracts/ontology-seed-manifest.v1.schema.json
validated-ontology-cache/contracts/ontology-usage-report.v1.schema.json
validated-ontology-cache/contracts/trials/universal-ontology-external.v1.json
validated-ontology-cache/seeds/ontology-seed-manifest.v1.json
validated-ontology-cache/reporting/cloudfront-cache-usage.sql
validated-ontology-cache/reporting/materialization-outcomes.sql
scripts/stage_validated_ontology_seed_catalog.mjs
docs/validated-ontology-cache/operations-runbook.md
docs/validated-ontology-cache/cache-and-takedown-policy.md
```

The draft bundle inventory in §6.5 records the contract documents actually authored.
This file map still predicts later runtime and operational work: the usage-report and artifact-provenance schema names above are not new public endpoints or completed artifacts.
The first public document contract obtains contextual provenance through the immutable resolution/version/validation/policy records.

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
SLICE-001 records the exact selected source/archive/installed payload and dependency closure, public source/configuration/format/graph/profile/error APIs, Node/browser contract proof and loader fingerprints.
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
- Permanent history: duplicate deliveries/checks, identical 200, A→B→A recurrence, two URIs sharing bytes, same bytes with different parser bases and policy-only requalification; exactly the expected distinct version records and shared byte objects remain.
- Use-triggered freshness, manual/automatable refresh, no idle origin checks, cooldown/backoff/coalescing, exact attempt lookup, finite observation and failure timestamps; no refresh can change a graph/export without explicit revision-checked reload.
- Refresh commit before pointer propagation, stale seed/current pointers, source supersession/withdrawal during apply and intervening edits: an accepted apply loads the exact offered bindings or preserves the existing graph with a clear outcome.
- SQS duplicates/reordering, expired leases, stale generation/quarantine races, lost enqueue/dirty sends and crashes at every §9.4 persistence boundary.
- Curated XML/optional seed JSON parity, exact dynamic pointer lookup, no global dynamic listing, more than 25,000 retained sources, paginated per-source history, bounded XML, missing evidence and generation/ETag conflicts.
- New-source/refresh quotas, status/repeated-POST throttling, feature-stop queue/active-work bounds, WAF, pre-staging no-store/private rejection, checksums, digest-wide containment and immutable rollback.

Read logical members through `packages/vowl/conformance/storage.mjs` and the existing pinned corpus helpers.
Do not reconstruct the removed physical fixture tree or compute expected semantic answers from the same cache/parser execution being tested.
Large hostile cases are deterministically generated under finite bounds.

Reuse the amendment's current evidence owners: `packages/vowl/test/unboundedLimits.test.js`, `resourceBudget.test.js`, `src/app/js/controller/canonicalVowlWorker.test.js` and `packages/vowl/conformance/supplemental/unbounded-limits-v1/manifest.json` through `independentCorpus.js`/`conformance.test.js`.
The overlay replaces exactly the nine matching historical above-ceiling expectations and adds its own vectors; retain the frozen predecessor bytes/pins and all unaffected expectations.
JSON fixture files do not encode `Infinity` or `NaN`; exercise those JavaScript values in the owning runtime tests rather than inventing JSON numeric literals.
Their presence in the uncommitted working tree is reusable input, not a passing test claim.

The limits matrix must distinguish package-only calls, browser ordinary/model operations, checkpoint transport, source acquisition, derived parser/profile bounds and finite service validation:

- Defaults, explicit finite overrides, values above former package ceilings, each individual `Infinity`, zero deep-work allowance, malformed/unknown overrides and exact precedence produce the owning boundary's expected result.
  Successful admitted results retain independently pinned canonical bytes.
- Direct/cache document and aggregate byte boundaries, the 256 imported-key acquisition gate and a bounded import chain deeper than 32 demonstrate the actual owners.
  The chain must remain within the resolved adapter depth and all other active limits; do not introduce an obsolete depth-32 rejection.
- Input bytes and expanded XML vary independently.
  Internal entity controls, parser import bounds, numeric-digit/profile-work mappings and strict/compatible helper parity match §11.2; external entity/context networking remains denied even with lifted package limits.
- Logical unbounded values, finite safe-integer maxima and dependency sentinel translations yield distinct, round-trippable policy evidence.
  Changing any active policy invalidates prior qualification identity; no raw `Infinity` becomes JSON `null`.
- Finite service defaults cannot become unbounded through omission, request data, refresh, duplicate work or cache hits.
  Test bounded hostile XML, work/deadline exhaustion and rejection before publication.
- Caught host exhaustion retains safe resource labels, cancellation/deadline precedence and last-known-good state across worker/client/API boundaries.
  Use bounded injected engine failures and controlled worker interruption; do not exhaust host memory deliberately.
- Infinite package deadlines arm no timer and retain cancellation; very long finite deadlines re-arm correctly.
  Browser worker deadlines and service timeouts remain independently finite, including import and lazy-module waits.

#### 19.2.1 Universal Ontology trial corpus

Use the ontology documents and `.url` source sidecars in [Universal Ontology's pinned external collection](https://github.com/Hadden-Industries/universal-ontology/tree/e34ced0935e2ac384a679476e186d68817a29021/src/external).
The 27 October local inventory contains 40 pairs: 24 sidecars target non-GitHub hosts and 16 target GitHub.
This is an inventory, not a live availability, parsing, rights or closure-completeness result.
The coordinated AWS plan §9.7 and draft `contracts/trials/universal-ontology-external.v1.json` pin the 40 document/sidecar pairs, classify 24 non-GitHub source candidates and 14 additional reviewed ontology/import IRIs, and retain unknown live/rights/historical-base outcomes explicitly.
The provider owns this inventory; it performs no live fetch or seed publication.

Classify retrieval URLs, declared ontology/version IRIs, `owl:imports`, parser bases and incidental namespace/annotation links separately.
A GitHub source sidecar does not exclude a non-GitHub ontology/import IRI declared inside that file; SOSA, SSN and Gregorian time provide such cases.
Resolve relative IRIs and Turtle prefixes with the selected public parser and the recorded original context, not a local filename or an invented alias.
Arbitrary vocabulary terms and documentation links are not automatic fetch targets.
Preserve hash IRIs as logical identities while removing fragments only at HTTP retrieval (§4.1); ontology identity and document access are distinct in [OWL 2 §§3.2–3.4](https://www.w3.org/TR/owl2-syntax/#Ontology_Documents).

| Trial family                        | Observed local evidence and intended case                                                                                                                                                                      |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Wine / food                         | Both documents import the other via the non-GitHub W3C guide IRIs: bounded cyclic closure and HTTP/HTTPS context handling.                                                                                     |
| DCAT / PROV / Dublin Core / SKOS    | DCAT declares SKOS, PROV-O and DC Terms imports; PROV contains several ontology declarations and fragment/relative import forms. Exercise exact members, shared imports and context, not guessed aliases.      |
| BIBO / GoodRelations / SIOC         | Download URL versus declared ontology IRI, PURL indirection and hash identity; live redirects/content negotiation require observation.                                                                         |
| SOSA / SSN / Gregorian time         | Non-GitHub W3C ontology/import IRIs inside GitHub-sourced Turtle snapshots; expand prefixed imports and preserve syntax/base distinctions.                                                                     |
| GeoNames / spatial / MarineTLO      | Cross-domain imports and older endpoints. The spatial sidecar points to a dated Web Archive capture; archive response/base behavior is a separate case, not a transparent replacement for the original origin. |
| Schema.org and smaller vocabularies | Larger and smaller local byte/work profiles; record parse/profile/consumer outcomes independently rather than requiring every document to be OWL 2 DL.                                                         |

Maintain two evidence tracks.
Offline tests use permitted, hash-pinned local bytes and explicit recorded contexts/import graphs served through a controlled fixture boundary; they do not depend on public-site availability or silently replace failed live imports with sibling files.
Live trials use a reviewed bounded subset of candidate IRIs, record each redirect/effective URL, HTTP/encoding/validator outcome, exact acquired digest/context, import coverage and typed rejection, and compare direct/cache semantics on the same captured representation.
A changing origin is not an oracle for byte equality between independent fetches.
Do not predeclare every candidate a success: HTML landing pages, unavailable/withdrawn sources, profile failures and policy rejection are useful classified outcomes.
Any missing coverage is filled by independent synthetic hostile/edge fixtures, including SSRF, malformed encoding, expansion limits, races and cancellation.

For the non-GitHub live cohort, exclude GitHub-controlled acquisition hosts (`github.com` and subdomains, `githubusercontent.com` and subdomains, and `github.io` and subdomains), and reclassify a candidate if its redirect chain reaches them.
That test filter changes neither general service admission nor local fixture provenance.
The manifest records source repository revision/path/digest, exact candidate IRI and role, origin/context evidence, rights disposition, expected outcome or explicit unknown, and offline/live eligibility.
Select a small cold-root/import then warm-read/refresh canary at the existing live gate; listing a URI is not authority to publish it as a seed or permission to load-test its publisher.
This revision performs local inventory only.

### 19.3 Cross-runtime and browser qualification

For identical `(bytes, parserDocumentIri, automatic/explicit format input, exact artifact, stage policy)`, compare parser identity, typed result, import declarations, source evidence and qualification status in Node/Lambda and browser workers.
Then run each qualification corpus through direct-origin and cached acquisition and compare managed graph, semantic result, retained original bytes and canonical bytes where the selected contract requires deterministic bytes.
Acquisition/provenance differences must not change model meaning.

Retain the existing canonical 2,000-class regressions and add the accepted desktop 10,000-class hierarchy workload/profile in Chromium, Firefox and WebKit.
The source comment records the existing profile's rationale, not a fresh timing measurement or a pass for the cache candidate.
Measure cold/warm acquisition, worker chunk/startup cost, parse/import/admission, preview/final ordering, retained model reads, main-thread responsiveness and peak memory against the same current direct-only build.
Keep the resolved amended consumer policies in §11.2, cancellation, stale-result rejection, active finite work/memory protections and source-export ownership.
Compare direct and cached acquisition against the same amended candidate, not the superseded package ceilings; record package behavior separately from application/acquisition containment.
A cache hit does not authorize raising the embedded-work budget or skipping downstream admission.
Record the actual runtime versions and tested resource policies rather than treating historical qualification as a fresh pass.

Real browser evidence includes cross-origin CORS/preflight, exact POST body hash, automatic 303 follow plus immutable binding retrieval, HTTP cache/304, query exclusion, digest verification, cancellation at each acquisition stage, CSP and direct-only bypass.
Any browser harness/dependency change requires exact configuration approval.

### 19.4 Integration and production evidence boundaries

Node tests and CDK assertions establish local contracts, not live IAM/OAC/CDN behaviour.
Use approved test accounts/endpoints for live canaries only after the exact deployment diff is approved.
Verify no direct Function URL/staging access, no forbidden connection, no foreground control-plane dependency on hits and separately bounded optional refresh, old/new pointer/catalog completeness, source-context equivalence, kill-switch isolation and report/cost reconciliation.
Do not contact unrelated ontology publishers merely to create load.

The final implementation route selects the full applicable WebVOWL/AWS suites, package-boundary tests, native formatting/lint/build, CDK synth/nag/diff, installed-bundle audit, licence/SBOM evidence, browser matrix and live canaries.
On 27 October, the original WebVOWL checkout's HISEW profiles `focused`, `affected` and `full` resolve to `npm run lint`, `npm run test` and `npm run check`; those labels do not establish AWS, browser or release coverage.
The current documentation owner is `tooling/markdown`/`markdown-quality`; use its file-scoped format/check for this planning document.
Native JSON/artifact validators own their respective data; generic formatting must not rewrite retained ontology, fixture or signed/published bytes.
Recheck current profile applicability before execution; additions/changes to profile configuration need approval.

---

## 20. Traceable vertical delivery plan

The following IDs express the supplied assessment as a draft, falsifiable baseline.
They are not backdated approvals or claims that these tests have run.
Maksym Shostak retains the AWS plan's accountable integration/acceptance role; delegated operators and the production observer are named before their operations.
That owner coordinates package, schema, client and AWS compatibility across repositories.

### 20.1 Requirements and acceptance criteria

| Requirement                                                                                   | Acceptance criterion                                                                                                                                                                                                                                                                                                                   | Supporting decisions               |
| --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| REQ-001: Use an exact selected artifact and public APIs without a speculative release gate.   | AC-001: Selector/source/archive/installed payload, dependency closure, exports, runtime bundles and stage policies agree in both consumers; same-version Git and registry artifacts cannot be confused.                                                                                                                                | DEC-001, DEC-005                   |
| REQ-002: Preserve exact source bytes and contextual meaning.                                  | AC-002: Direct/cache fixtures preserve bytes and origin parser context; identical bytes under distinct bases have distinct validation identities; no source/format claim is attached solely to a byte digest.                                                                                                                          | DEC-002, DEC-003                   |
| REQ-003: Distinguish document, closure, publication and consumer claims.                      | AC-003: Browser managed-graph/parity fixtures retain independent document acquisition, exact member/context/edge evidence and separate consumer outcomes. First release has no general server closure producer or frozen-replay claim.                                                                                                 | DEC-004                            |
| REQ-004: Bound and control every external acquisition.                                        | AC-004: Adversarial DNS/redirect/encoding/import inputs cannot connect to forbidden destinations or escape byte/time/work limits; parser/context/entity network attempts are denied.                                                                                                                                                   | DEC-006, DEC-011                   |
| REQ-005: Make retries and publication safe.                                                   | AC-005: Duplicate/reordered/crashed jobs converge; stale generations cannot promote; catalogs never reference absent objects or evidence; private staging cannot be fetched publicly.                                                                                                                                                  | DEC-008                            |
| REQ-006: Honour origin metadata and keep immutable snapshot claims precise.                   | AC-006: 304/variant/restriction changes reuse only eligible bytes/evidence, conditional requests are resource-scoped, and quarantine removes future mappings without pretending old copies vanished.                                                                                                                                   | DEC-009                            |
| REQ-007: Resolve curated and dynamic sources without foreground control-plane dependency.     | AC-007: Curated OASIS and optional seed JSON agree; dynamic source lookup is exact-key static delivery. First-caller and warm paths verify immutable context, with optional refresh independently bounded.                                                                                                                             | DEC-007, DEC-010, DEC-017          |
| REQ-008: Preserve canonical consumer behaviour and rollback.                                  | AC-008: Direct/cache corpus plus 2,000-class and desktop 10,000-class workloads preserve automatic/explicit format policy, semantics, typed outcomes, the amended §11.2 limits and lazy worker/session behavior; bypass and prior compatible deployment recovery pass.                                                                 | DEC-002, DEC-012, DEC-015          |
| REQ-009: Operate with explicit privacy, rights and cost acceptance.                           | AC-009: Logs exclude raw queries/viewer secrets, source/AGPL obligations and egress controls are reviewed, budget actions preserve site/data-plane health, and observed costs/drills support launch.                                                                                                                                   | DEC-011, DEC-012                   |
| REQ-010: Give durable state, service releases and shared delivery separate single writers.    | AC-010: Acyclic synthesis and service-only diffs preserve retained state; complete policies have one owner, permissions precede routes, direct origins remain denied and unrelated public paths stay healthy.                                                                                                                          | DEC-007, DEC-013                   |
| REQ-011: Release a compatible provider/client pair with one contract authority.               | AC-011: Both repositories exercise the same frozen schema/fixture hashes against the real provider/client, reject unsupported versions, and demonstrate provider-first enablement and compatible rollback.                                                                                                                             | DEC-001, DEC-012, DEC-014, DEC-015 |
| REQ-012: Preserve permanent deduplicated version history.                                     | AC-012: Repeated 304/identical-200/A→B→A checks create no duplicate URI-version record or payload; distinct context versions remain distinguishable and all accepted versions remain retrievable under access policy.                                                                                                                  | DEC-003, DEC-016                   |
| REQ-013: Refresh on use or explicit request with honest operational history.                  | AC-013: Idle sources cause no origin checks; due/open/manual cases coalesce and obey quotas. Failures retain eligible snapshots and dated diagnostics; updates reach the graph only through explicit generation/revision-checked reload.                                                                                               | DEC-009, DEC-015, DEC-017          |
| REQ-014: Admit eligible public sources without global archive enumeration.                    | AC-014: Safe unlisted public sources can be admitted; credentials/directives/SSRF/quarantine fail closed. An archive beyond 25,000 entries still uses bounded exact lookup; source withdrawal and content incidents have distinct tested containment.                                                                                  | DEC-006, DEC-010, DEC-011, DEC-018 |
| REQ-015: Preserve distinct package, application, acquisition and service limit authority.     | AC-015: The new public defaults/override domain, browser precedence, actual acquisition gates and derived XML/import/profile bounds match §11.2. Explicit finite service limits, non-aliasing policy fingerprints and typed host/resource/abort outcomes pass independent boundary fixtures without changing admitted canonical bytes. | DEC-003, DEC-005, DEC-006, DEC-015 |
| REQ-016: Deliver a reusable provider contract and independently releasable disabled consumer. | AC-016: Both repositories pin one provider-owned contract; a consumer without WebVOWL dependencies verifies portable results. WebVOWL's disabled build makes zero cache-specific requests and preserves ordinary loading; activation waits for real provider/CDN/browser evidence.                                                     | DEC-014, DEC-019                   |
| REQ-017: Use an attributable, classified real-world trial corpus.                             | AC-017: The pinned UO inventory distinguishes download URLs, ontology/import IRIs and GitHub exclusions. Offline results reproduce from exact bytes/context; bounded live outcomes are separately recorded, with failures and missing coverage explicit.                                                                               | DEC-002, DEC-012, DEC-020          |

### 20.2 Quality scenarios

| Scenario                                        | Stimulus and observable pass condition                                                                                                                                                                                                                                                                                                                  |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| QA-001: Context integrity                       | Serve the same relative-IRI bytes from two origin bases and through the cache; each direct/cache pair agrees, the two validation identities differ, and no artifact URL becomes parser context.                                                                                                                                                         |
| QA-002: Network containment                     | A public source redirects/rebinds to a prohibited IPv4/IPv6/metadata target; the connection recorder observes zero forbidden connects and the job terminates within its budget.                                                                                                                                                                         |
| QA-003: Crash consistency                       | Interrupt each §9.4 write/send boundary and replay duplicates/out-of-order generations; only old-complete/new-complete eligible bindings become visible and recovery is bounded.                                                                                                                                                                        |
| QA-004: Qualification precision                 | Supply cyclic/shared imports, a missing member, a profile violation and a valid but over-budget consumer workload; only the fully qualified profile gets `CLOSURE_VALIDATED`, with independent admission outcomes.                                                                                                                                      |
| QA-005: HTTP evolution                          | Refresh 200→304, changed bytes, changed base/format/`Vary`, changed restrictions and timeout; fingerprints/eligibility/freshness change correctly without reusing stale semantic proof.                                                                                                                                                                 |
| QA-006: Browser performance and cancellation    | Run direct/cache 2,000-class and desktop 10,000-class workloads across Chromium/Firefox/WebKit; cancel during fetch/poll/chunk/import/admission and preview ordering. Current budgets/outputs agree; late results cannot replace the active document or regress its controls.                                                                           |
| QA-007: Availability and recovery               | Disable control-plane work, fail an origin, roll catalog/deployment back and activate bypass; published reads/site remain healthy and direct-only limitations are visible.                                                                                                                                                                              |
| QA-008: Privacy and economics                   | Submit sources/viewer URLs with sensitive query material and simulate quota/budget events; no normal log/public rejection leaks it, new work stops, fixed/shared costs remain explicitly accounted.                                                                                                                                                     |
| QA-009: Deployment and policy ownership         | Change only the materialization service; synth/diff preserves durable storage and unrelated edge controls. Stage bindings before routes, then prove private-origin denial and website/UO/cache access under feature stop.                                                                                                                               |
| QA-010: Artifact and protocol evolution         | Pair the proposed provider with the released client and the proposed client with the real provider; exercise automatic/explicit format, wrong-version/policy and same-version-different-artifact fixtures. Unsupported combinations fail explicitly; the retained compatible pair recovers.                                                             |
| QA-011: Version history and recurrence          | Submit unchanged responses, A→B→A, shared bytes across URIs, parser-base changes and policy-only requalification; count distinct versions/byte objects independently and recover every permitted historical version with bounded queries.                                                                                                               |
| QA-012: Nonblocking refresh and edit safety     | Open fresh/due archives, race manual checks, fail the origin, close/edit/replace the document and complete a late refresh. Foreground graph remains usable; history timestamps are accurate and only explicit revision-checked reload changes it.                                                                                                       |
| QA-013: Population and work isolation           | Grow beyond 25,000 URI records and deep per-URI history; exact lookup/publication remains bounded, no global list appears, and GET/POST abuse or work stops cannot bypass quotas or disable static site/artifact reads.                                                                                                                                 |
| QA-014: Limit ownership and exhaustion          | Exercise amended package defaults/Infinity and former-ceiling overrides, finite browser/service gates, a bounded import chain deeper than 32, independent XML expansion and caught host failure. Direct/cache outcomes and safe labels agree at each owner; unbounded policy evidence cannot alias a finite bound, and failed attempts publish nothing. |
| QA-015: Disabled delivery and reusable contract | Deliver the consumer with no backend, invalid endpoint and failing provider fixtures: zero cache-specific traffic/timers and no loader/startup regression. A WebVOWL-independent HTTP probe reads the same protocol; unsupported versions block activation and disabling rejects late results.                                                          |
| QA-016: Corpus reproducibility and live drift   | Replay hash-pinned UO source/import fixtures, then observe a changed/unavailable/GitHub-redirected live candidate. Deterministic parity stays reproducible; live status, eligibility and gaps remain separate, and no unreviewed alias or seed is introduced.                                                                                           |

### 20.3 Slice traceability and proof

In this table, `REQ/AC-001–003` denotes REQ-001 through REQ-003 together with their matching AC-001 through AC-003 criteria; the same inclusive range convention applies to QA/DEC IDs.

| Slice                                                                          | REQ / AC / QA / DEC links                                                                                                 | Independently demonstrable proof                                                                                                                                                                                                                                                 | Release/cleanup implication                                                                                                                         |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| SLICE-001: Agree the reusable contract and qualify one offline source          | REQ/AC-001–003, 011, 015–017; QA-001, 004, 010, 014–016; DEC-001–005, 014–015, 019–020                                    | Provider/consumer owners agree one versioned AWS-owned contract and fixture revision. Qualify bytes/context/format/limits offline, classify UO trial candidates and prove a portable HTTP consumer boundary.                                                                     | Contracts-only AWS work may precede provider implementation; no cloud mutation or automatic seed publication.                                       |
| SLICE-002: Retrieve and validate one bounded source                            | REQ/AC-002, 004, 006, 015; QA-001, 002, 005, 014; DEC-003, 005, 006, 009, 015                                             | Controlled source → exact bytes/private staging → typed document result, including DNS/redirect/encoding/304 and finite parser/XML/work/time containment. Host/resource failures remain unsuccessful attempts.                                                                   | No public unvalidated bytes; explicit service bounds, egress design and rights decisions precede live use.                                          |
| SLICE-003: Materialize and publish one durable version/binding                 | REQ/AC-002, 005, 007, 012, 014; QA-001, 003, 011, 013; DEC-003, 007, 008, 010, 016, 018                                   | POST → queued validation → unique URI-version/shared byte object → source commit → exact static pointer/303; crash/replay and duplicate-version fixtures pass.                                                                                                                   | Approve the composite-key new-table/schema and prefixes; permanent accepted history is never classified as an orphan.                               |
| SLICE-004: Preserve managed import and qualification semantics                 | REQ/AC-003–005, 008, 015; QA-001, 002, 004, 014; DEC-004, 006, 015                                                        | Browser/direct/cache diamond/cycle/missing-import fixtures preserve members, contexts, edges and typed outcomes under the amended adapter and independent acquisition gates, including bounded depth above 32. Stored closure evidence never substitutes for mismatching checks. | No general server closure function/queue or frozen replay; do not reinstate removed package import/profile caps.                                    |
| SLICE-005: Deliver the disabled consumer, then verify its provider integration | REQ/AC-001–003, 007–008, 011, 013, 015–017; QA-001, 004, 006, 010, 012, 014–016; DEC-002, 005, 010, 012, 014–017, 019–020 | Consumer checkpoint: real loader/worker with controlled protocol fixtures, zero cache traffic when disabled, current limits/diagnostics and edit-safe refresh UI. Integration checkpoint: the same cases pass against the actual provider and CDN/browser path.                  | The consumer checkpoint can be delivered before AWS implementation; the slice's provider proof and production activation remain open.               |
| SLICE-006: Refresh, retain history and contain incidents                       | REQ/AC-005–009, 012–014; QA-003, 005, 007, 008, 011–013; DEC-008–012, 016–018                                             | Use-triggered/manual 304/change/return/outage checks coalesce; attempt history, version deduplication, pointer fencing, source withdrawal, digest-wide containment and queue/API stops pass.                                                                                     | No source-refresh scheduler; complete source-history/runbook/reporting and bounded-work/cost recovery before live use.                              |
| SLICE-007: Dark deploy and qualify approved seeds/canaries                     | REQ/AC-001–017; QA-001–016; DEC-001–020                                                                                   | Payer containment gate precedes resources; synth/diff proves private origins, single policy writers and permissions-before-routes; disabled seed path then cold root/import and new-session warm/refresh probes.                                                                 | Exact configuration/external approval for resources, seeds, WAF/logging; restore admission off after bounded canary.                                |
| SLICE-008: Roll out, observe and hand over                                     | REQ/AC-007–017; QA-006–016; DEC-007, 011–020                                                                              | Exact compatible repo pair, full browser corpus/workloads, permanent-history growth, refresh/incident/rollback drills, seven-day COUNT then approved BLOCK and observed billing.                                                                                                 | Named observer accepts outcomes; preserve all accepted historical versions and compatible release evidence, with explicit safety/rights exceptions. |

### 20.4 Cross-repository dependencies and integration ownership

This is one coordinated change with two independently deliverable repository implementations and separately gated activation.
The agreed order is shared contract → WebVOWL consumer delivered with caching disabled → actual AWS/provider integration verified → explicit production activation; parallel implementation is optional.
Unqualified `SLICE-###`, `REQ-###`, `AC-###`, `QA-###` and `DEC-###` IDs in this document belong to the cache plan; AWS-prefixed IDs belong to the stack-separation plan.
The two number spaces are not interchangeable.

| Owner                        | Delivery and proof responsibility                                                                                                                                                                                                                                   |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `amazon-aws`                 | Reusable public contract and shared conformance/corpus authority, service runtime, controlled document retrieval/validation, version/attempt registry, queues, publication/refresh, retained state, CDK and operations. General server closure compute is deferred. |
| `webvowl`                    | Root/import acquisition, catalog/client/evidence interpretation, worker/session admission and cancellation, typed outcomes, accessible control state, bypass and browser performance.                                                                               |
| Shared public-delivery owner | Distribution behaviour order, shared WebACL/association, response policies/logging and website/UO/cache regressions; serialize changes to those controls.                                                                                                           |
| Integration owner            | Shared meaning/oracles, exact dependency and policy identities, compatibility matrix, candidate evidence, release order and accepted rollback combination.                                                                                                          |
| OwlAPI producer              | Public APIs and artifact evidence; producer work starts only for a demonstrated required contract gap. UO retains its own dependency identity for query regressions.                                                                                                |

Keep one authoritative schema/fixture/corpus-manifest set at `amazon-aws/validated-ontology-cache/contracts/`, maintained by the provider and reviewed with affected consumers (§6.5).
A contracts-only AWS change can establish the boundary before service implementation.
WebVOWL keeps its consumer adapter/tests and pins the shared revision; it does not acquire service-schema ownership by delivering first.
Both repositories consume the same exact revision/content hashes through a documented CI acquisition mechanism; no sibling checkout assumption or separately edited schema copies.
The coordinated AWS revision 9 links the provider-owned draft and incorporates this delivery order and reusable contract ownership, plus permanent distinct-version history, composite source history keys, exact dynamic lookup, request-triggered refresh and deferred server closure compute.
Its review reconciliation in §4.5.1 aligns with this plan's §6.6 and the provider's CDEC-014–020.
It also records the adopted uncommitted limits amendment: finite service policy remains distinct from WebVOWL package/application/acquisition policies, with explicit unbounded-value evidence encoding and changed import/XML/profile boundaries.
Both plans remain implementation proposals.
This contract-authoring follow-up adds review-only protocol/schema/fixture documents; it creates no runtime, infrastructure, production setting or HISEW execution.
The bundle remains unpublished and unapproved until Gate A.
Specifications and independent fixtures own expected bytes/context/graph/outcomes.
Consumer protocol fixtures enable the disabled WebVOWL delivery before provider implementation, or optional parallel work after contract agreement.
The provider must later pass those same interactions and the independent semantics/security cases.
Schema validity, simulated responses and independently green suites cannot close the provider-integration milestone.
Adopt a new shared package/test platform only if evidence justifies it and the exact configuration is approved.

Freeze each integration candidate as AWS commit/tree + WebVOWL commit/tree + contract/schema/fixture hashes + selected parser source/archive/payload/dependency identity + loader/behavior/decoder and consumer-policy fingerprints.
Until commits are authorized, record working-tree hashes without claiming a committed candidate.
The current uncommitted limits implementation is an admitted planning input; do not wait for a commit to incorporate its contracts, or treat a commit alone as proof of their behavior.
Test the proposed provider with the currently released client, and the proposed client with the actual proposed backend; explicitly reject unsupported versions.
Provider qualification precedes consumer enablement, not delivery of disabled client code.
Retain and prove the supported prior client/provider/catalog combinations; new consumers add their own compatibility rows without depending on WebVOWL internals.

| Joint milestone                                     | Cache slices and proof                                                                                                                                           | AWS checkpoint                                                                                       |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Agreed reusable contract and one offline source     | SLICE-001: provider-owned schema/fixture revision, context/format/limits, portable HTTP probe and classified UO corpus                                           | AWS SLICE-011 contract checkpoint                                                                    |
| WebVOWL consumer delivered with caching disabled    | Consumer checkpoint of SLICE-005 and fixture-based SLICE-004 coverage; real loader/worker, zero cache-specific traffic, direct-path/startup/cancellation proof   | AWS SLICE-011 contract agreement only; service/runtime and live-origin acceptance may remain pending |
| First actual provider/client path locally           | SLICE-002/003 plus the SLICE-005 integration checkpoint: one cold source then a warm read using the real service/client and controlled infrastructure boundaries | Inputs to AWS SLICE-012; deployed AWS/CDN proof remains separate                                     |
| Imports, refresh and recovery                       | SLICE-004/006 plus remaining SLICE-005 integration proof, offline UO corpus and separately recorded bounded live outcomes                                        | Inputs to AWS SLICE-012/013                                                                          |
| Live seed-to-browser path, service admission off    | SLICE-007 after SLICE-001–006; cache-enabled test client, staged private-origin/edge access and real browser parity; production client remains disabled          | AWS SLICE-012                                                                                        |
| Bounded cold root/import, then new-session warm hit | Remainder of SLICE-007; exact canary bounds and feature-stop/read-survival proof; return admission off afterwards unless release is approved                     | AWS SLICE-013                                                                                        |
| Observed production release                         | SLICE-008: qualified pair, seven-day WAF COUNT, approved BLOCK, subsequent observation, recovery and operator acceptance                                         | AWS SLICE-014                                                                                        |

AWS SLICE-001's relevant live baseline and SLICE-002's scoped-deployment safeguards precede infrastructure writes.
Unrelated estate moves, full stack renaming and query-contract modernization are not prerequisites for the new cache.
Shared delivery changes must still regress the existing website and UO query/publication paths.

Within the cache, SLICE-001 agrees semantics before dependent implementations.
The SLICE-005 consumer checkpoint and fixture-based SLICE-004 work depend on that contract, not completion of service SLICE-002/003.
Deliver the disabled consumer once its scoped proof passes; merging or deploying it does not close the full SLICE-005 integration acceptance.
Service SLICE-002 establishes bounded acquisition for SLICE-003's publication.
As soon as that local provider path exists, verify one cold materialization and warm read with the real client, then expand import/refresh/recovery coverage.
Controlled infrastructure boundaries establish local integration only; actual AWS/CDN/browser behavior remains a later gate.
Implementations may overlap after agreement, but neither simultaneous coding nor an atomic two-repository deployment is required.
SLICE-006 completes operational controls before the live SLICE-007 gates.
SLICE-008 requires the joint canary evidence and explicit release authority.

Serialize shared schema/policy and `app.py`/distribution writes.
Semantically independent internals may be parallelized only after their contracts and owners are fixed; this plan grants no agent-delegation authority.
Use scoped slice checks, affected integration regressions and the accepted R2 final assurance before release; no broad rerun is required for every prose change.

### 20.5 Migration, resumption and cleanup

This is a new cache schema, not permission to discard historical catalog data.
Seed migration starts from historical accepted logical mappings and a fresh approved source inventory; dry-run and local staging precede exact-account apply.
Bind apply to account/region/bucket/table, reviewed manifest digest and exact package/policy identities.
Partial apply reconciles conditional objects/records by identity before retry; it does not regenerate a manifest silently.

Package or loader-policy changes create new validation/resolution identities and an updated source pointer or curated generation over retained immutable bytes; they do not create new source versions unless origin bytes/context changed.
Any separately qualified closure evidence has its own exact policy/member identity.
Keep the old consumer/generation available until both consumers pass the new contract; a mixed-version reader must reject unsupported evidence rather than reinterpret it.
No revalidation invents source-preservation proof absent from the new package report.
Schema migration, if later needed, declares readers/writers, interruption/reconciliation and rollback before changing durable records.
Do not delete old deployment, source, seed, staging or qualification evidence until reference/retention/incident obligations are resolved.

### 20.6 Unknowns, cheapest probes and re-planning triggers

| Unknown / owner                                                   | Cheapest discriminating evidence                                                                                                                                                | Required response                                                                                         |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Exact runtime/package support / integration owner                 | Exact artifact/dependency and native ARM64 install/bundle checks, then the actual Lambda runtime and browser worker.                                                            | Replan runtime/bundling on mismatch; do not choose an older package silently.                             |
| Context and source qualification / semantic owner                 | Same-bytes/two-bases, redirects, malformed encodings and incomplete-closure fixtures using current public APIs.                                                                 | Fix the acquisition contract or obtain a bounded producer decision; no private shim.                      |
| Network defence / infrastructure-security owner                   | Controlled connector/canary plus a costed independent-egress comparison.                                                                                                        | Owner accepts residual risk or revises topology/budget before live deployment.                            |
| Durable republication / source/licence owner                      | Review seed directives/rights and exact worker/AGPL corresponding-source obligations.                                                                                           | Exclude the affected source or block deployment until cleared; no fabricated permission.                  |
| USD 10 feasibility / account owner                                | Preceding 90 days of traffic/free-allocation use and current calculator output including WAF/shared logs/closure work.                                                          | Reopen scope/topology before resources if headroom is insufficient.                                       |
| Archive lookup/history and browser closure scale / consumer owner | Exact lookups beyond 25,000 sources, bounded source-history pagination, curated XML byte limits and 2,000-/10,000-class workloads.                                              | Retain permanent history and bounded work; change projection/index design only from measured evidence.    |
| Freshness fallback and refresh headroom / integration owner       | Origin-header corpus, source-change/usage observations and conditional-check/304 cost scenarios; freeze finite fallback, cooldown, backoff and queued-work bounds in SLICE-001. | No default scheduler or every-hit fetch; explicit bounded parameters and fixtures precede implementation. |

Resolve technical choices in order: first principles and falsifiable constraints; current best practice; authoritative specifications/vendor guidance; then established community practice.
Reuse the AWS plan's dated research only after checking for material changes.
Retain sources, rejected alternatives and the cheapest discriminating experiment.
Use the `grilling` skill for the owner's advice only after those avenues are exhausted and a consequential choice remains.
Research cannot supply owner-only rights, spending, configuration or release consent; present those exact proposals at the existing approval gates.

Re-baseline on any new public contract, package/policy/decoder/base rule, schema, rights/egress assumption, authority boundary, unacceptable workload result or cost/topology change.
Accepting this plan is not accepting a later changed requirement or test oracle.

### 20.7 Assessment recommendation coverage

| Assessment recommendation group                                                                             | Synthesis location / disposition                                                                                                                                           |
| ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Exact published RC, no Phase 20/stable/rc.2 dependency; producer improvements optional                      | §2, SLICE-001. The no-speculative-release principle is retained; the historical rc.1/registry-only restriction is superseded by the current exact-selector contract.       |
| Canonical acquisition/session seam; exact source rather than reserialization; metadata-owned formats        | §§4–7, 10–11, 17–19, SLICE-001/005.                                                                                                                                        |
| Separate fetched/document/closure/publication states, context identity, policy/versioning, consumer budgets | §§9, 11, QA-001/004, SLICE-003/004.                                                                                                                                        |
| Redirect/DNS/SSRF, no ambient network, independent egress                                                   | §§7, 11–12, QA-002, SLICE-002/007. The blanket remoteImports=false wording is reconciled with the injected closure loader.                                                 |
| Explicit decoding and parser-input digest                                                                   | §§4, 10–11. Strict UTF-8 matches the current consumer; unsupported encoding is explicit, not a global release wait.                                                        |
| HTTP validators/304/variation, conservative IRI identity, differentiated TTLs                               | §§1.1, 4, 7.5, 12.3, 13, QA-005, SLICE-006.                                                                                                                                |
| Idempotent queue/generations, durable publication, S3 checksums                                             | §§9–10, QA-003, SLICE-003/006. Private staging reconciles pre-validation persistence with the no-public-unvalidated-bytes invariant.                                       |
| Curated OASIS and exact-source dynamic discovery                                                            | §§6.4, 10.5. Owner choice replaces global dynamic catalog enumeration with exact-key static pointers. Optional compact seed JSON remains generated and measurement-driven. |
| URL redaction, cross-runtime tests, parser regressions, corpus bundling and cache-hit workloads             | §§15, 19, QA-006/008, SLICE-005/008. Raw CloudFront query logging is removed from the proposed fields.                                                                     |
| Previous deployment and cache bypass                                                                        | §§17, 21–23, QA-007, SLICE-008. Direct-only mode retains ordinary CORS limitations and does not promise unavailable source access.                                         |

---

## 21. Rollout, rollback, and failure semantics

### 21.1 Rollout order

```text
agreed AWS-owned reusable contract + exact-artifact/offline semantic proof
  → WebVOWL consumer delivered with cache integration disabled
  → bounded provider source/publication + early real-client cold/warm path
  → managed-import + refresh/history/recovery/security/cost qualification
  → payer-approved containment transition before chargeable resources
  → approved storage/service, admission off and public routes absent
  → verified distribution-bound access policies → approved edge routes
  → validated seed/catalog + cache-enabled test client, service admission off
  → bounded approved UO-corpus cold-root/import and warm/refresh canary
  → admission off after canary unless separately approved for release
  → actual provider/CDN/browser acceptance for the exact consumer candidate
  → separately approved production cache activation with WAF COUNT
  → at least seven complete days and representative closure evidence
  → separately approved WAF BLOCK → additional week of observation
  → accepted runbook, budget reconciliation and cleanup disposition
```

The integration owner names a responsible production observer and measurable abort thresholds before each live window: forbidden outbound connection, unvalidated publication, context/digest mismatch, sensitive log disclosure, legitimate WAF blocking, material consumer regression or exhausted cost headroom.
Delivering the disabled WebVOWL build may precede all AWS resource creation; its proof is §17.6's zero-cache-traffic/direct-path acceptance.
Never activate its cache integration before the actual curated catalog, exact-source pointer and materialization/refresh paths, required service controls and live browser cases are qualified.
Service admission and client activation remain separate controls; the cache-enabled seed/canary client is confined to its approved test environment.
Retain the known-good build and approved direct-only bypass throughout observation; direct-only mode remains subject to origin CORS and cannot guarantee access to every uncached ontology.
Historical seed/catalog parity is proven without restoring the retired runtime constant.

### 21.2 Rollback layers

| Failure                           | First rollback                                                                             | Data preserved                                                                                      |
| --------------------------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| New-source cost/abuse             | Set `materializationEnabled=false`                                                         | Website, catalog, published artifacts, registry/queue evidence.                                     |
| WAF false positive                | Change rule BLOCK→COUNT                                                                    | All traffic/data; metrics retained.                                                                 |
| Client loader regression          | Activate approved direct-only acquisition; deploy prior WebVOWL build                      | Cache infrastructure/catalog remains dark/usable; no source deletion.                               |
| Bad curated catalog root          | Repoint to the prior compatible immutable seed generation after current eligibility review | Permanent accepted versions, artifacts and evidence retained.                                       |
| Bad dynamic mapping               | Fence/quarantine the source and withdraw or repoint its exact current pointer              | Historical versions/evidence retained subject to incident policy; unrelated sources stay available. |
| Worker/parser regression          | Disable admission and event-source mapping; deploy previous worker bundle                  | Pending queue/registry and published artifacts retained.                                            |
| API regression                    | Disable admission/deploy previous API bundle                                               | S3 data plane remains readable.                                                                     |
| Distribution behaviour regression | Apply reviewed prior distribution config                                                   | Regional resources remain private; no bucket public fallback.                                       |
| Security/legal artifact incident  | Quarantine, republish catalog, separately authorize invalidation/object-access containment | Audit evidence retained under incident policy.                                                      |

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
- Source/curated publisher delayed: first caller receives the immutable binding directly and retains it in that load; later static discovery awaits the relevant pointer/root update.
- Transient refresh fails: the eligible archived version and graph remain, successful-check time stays unchanged and dated failure history is retained.
  Changed restrictions/quarantine invoke containment.
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
8. Use the per-source refresh operation manually or from automation, distinguish if-due/check-now, join an active attempt and inspect its dated outcome without bypassing cooldown/security/quotas.
9. Quarantine/withdraw the affected source pointer and any curated membership; apply digest-wide origin/edge containment only for the confirmed content scope.
10. Restore a previous root catalog version/generation.
11. Verify an artifact digest/headers through S3 and CloudFront.
12. Diagnose bounded curated-catalog parsing or exact-source projection/history-query failures without imposing an archive population ceiling.
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
24. Retrieve a source's paginated distinct-version and attempt history, reconstruct A→B→A transitions, verify shared byte references and requalify an old version before deliberate recovery.
25. Diagnose fresh/due/cooldown/failed-check states, stop pending observation, and apply an update only to the expected active document revision.

Every procedure names the expected account/region/resource, read command, decision criteria, mutation command/API, postcondition check, rollback, and evidence location. Examples use symbolic identifiers defined in the runbook and must require operators to resolve/confirm them before mutation; they never encourage commands against a wildcard account or broad bucket prefix.

---

## 23. Definition of done

This section defines future implementation/release acceptance, not completion of the present plan synthesis.
Every REQ/AC/QA has dated evidence bound to exact source, package, policy, configuration and catalog identities.

### 23.1 Package and consumer boundary

The disabled WebVOWL delivery milestone is complete only with a pinned provider-owned contract, passing consumer/offline corpus tests and zero-cache-traffic ordinary-loader/startup proof.
Its release evidence explicitly says provider integration and production cache activation remain pending; the remaining definition of done closes the complete feature.

- Both runtimes qualify the same exact selected source/archive/payload and dependency closure through public APIs, with current runtime, native ARM64 and browser-bundle evidence where applicable.
- No retired package/converter tree, private parser path, mutable/local source fallback or duplicate package implementation participates; the approved full-commit Git selector is supported.
- Direct and cached bytes reach the current canonical worker/session contracts with the same effective origin parser context and exact original-source exports.
- Root/import acquisition, automatic/explicit format policy, cancellation, lazy chunks, preview ordering, controls and the amended §11.2 limit resolution pass the full corpus and 2,000-/10,000-class Chromium/Firefox/WebKit matrix.
- Consumers use `operationLimitDefaults` and application-owned policy exports at their actual boundaries; no retired-export shim or obsolete package cap participates.
  Bounded XML/host-resource diagnostics survive the real worker/client, with abort/deadline precedence and no resource-failure proxy retry.

### 23.2 Identity, validation and publication

- Stored SHA-256 identifies content-decoded bytes; character decoding is fatal, explicit and compatible with the consumer, with unsupported encodings reported distinctly.
- Validation identities include parser base, automatic/explicit and observed format, exact artifact identity, behavior/decoder/stage policy and contract; byte deduplication never reuses an unrelated context's evidence.
- Resolved package/application/acquisition/adapter/service limits and dependency translations are explicit.
  Logical unbounded policy values cannot alias finite values or JSON null, service work remains finite, and unsuccessful resource/host attempts create no completed validation verdict or published version.
- Document/source/closure/profile/publication/admission claims are separate; incomplete or unverified evidence cannot claim `CLOSURE_VALIDATED`.
- Browser/qualification manifests preserve actual members/edges, cycles/shared imports and profile/source evidence without flattening or frozen-replay claims; general server closure precomputation is deferred.
- Permanent URI/version history deduplicates repeated 304/identical-200/A→B→A observations; bytes are shared by digest, and attempt/software-validation history cannot multiply source versions.
- Private staging is inaccessible through CloudFront; only validated exact bytes and durable evidence become eligible published bindings.
- Conditional generation/lease/policy checks, outbox recovery, SQS duplication/reordering and every persistence-boundary crash drill pass.

### 23.3 Security, privacy and rights

- Every actual connection/redirect is subject to proven URL/DNS/address pinning and finite limits; parser ambient fetch, remote contexts and XML external entities are denied.
- Egress topology and residual risk have explicit owner/security acceptance; IAM/OAC/function/bucket boundaries pass live forbidden-access canaries.
- New-source/refresh quotas, GET/repeated-POST controls, WAF COUNT-to-BLOCK evidence, concurrency/deadlines, DLQ and queued/active-work stops preserve the site/static data plane.
- No credentials, viewer identifiers, source excerpts or unreviewed query strings enter routine logs or public rejection data.
- Source rights/cache directives, quarantine/takedown and exact deployed AGPL/notices/corresponding-source obligations have no unresolved launch condition.

### 23.4 HTTP and catalog integrity

- Source validators, variants, content decoding and 200/304/restriction changes are reconciled; ineligible immutable republication is rejected and package/policy changes requalify evidence.
- Foreground catalog/pointer/artifact/evidence reads are CloudFront/S3 only; optional background refresh is separately bounded and cannot delay them.
  First callers obtain immutable context without waiting for static projection.
- There is no scheduled origin-check resource; fresh/on-use/manual/coalesced refreshes and failure timestamps match the accepted contract, with no automatic graph/export replacement.
- Curated OASIS/optional seed JSON and exact dynamic pointers derive from committed state; dynamic population is not enumerated, and bounded lookup/history proofs include archives larger than the removed ceiling.
- Immutable/mutable/API cache headers and validators match their identities; query tokens cannot fragment bytes or spoof accepted source context.
- No accepted version, current pointer or curated generation references absent objects/evidence; refresh, scoped quarantine, pointer/root rollback and cross-store reconciliation pass with honest limits on recalling old copies.

### 23.5 Operations, budget and delivery

- Current account/region/runtime versions, 90-day traffic, WAF shared-distribution cost and permanent-history/refresh/staging/egress costs support the accepted USD 10 target or an explicitly revised payer-approved budget with observed headroom.
- USD 7 actual/USD 9 forecast/USD 10 actual controls notify/contain new work as approved; the payer-approved whole-site-to-feature transition precedes chargeable enablement, and delayed billing, bounded queued/in-flight overshoot and continuing fixed/data-plane costs are explicit.
- Private reports reconcile source work and artifact traffic without unsupported exact viewer-source attribution; retention and query cutoffs operate.
- Known-good build, direct-only bypass, catalog/consumer-policy rollback, DLQ, refresh, quarantine, cost and incident drills are reproducible by the named observer/operator.
- Final relevant HISEW checks, independent verification, scoped security/semantic/operations/licence reviews, browser/live canaries and operator handoff have passing evidence for the accepted target.
- Acyclic storage/service/bindings ownership, sole complete policy writers and permission-before-route deployment are proved against the actual shared delivery owner; service rollback preserves durable state and pending-work evidence.
- Both repositories consume the same provider-owned contract/fixture revision, and a WebVOWL-independent HTTP probe verifies the reusable boundary. Disabled consumer delivery is recorded separately; full AWS SLICE-011–014/cache SLICE-001–008 acceptance requires the real provider/client matrix and approved activation.
- The non-GitHub UO trial inventory, byte/context pins, expected outcomes/unknowns and rights/eligibility dispositions are retained.
  Offline qualification and bounded live trial results are distinct; neither a dead origin nor an omitted adversarial case is hidden by a fabricated success or alias.
- No required configuration, production or delivery decision is inferred.
  Commit, push, deployment and publication occur only within their separately granted authority.

---

## 24. Normative and current guidance references

### 24.1 Revision and package sources

- [Supplied deep-research assessment](../reviews/Validated%20Ontology%20Materialisation%20Cache_%20deep-research%20assessment%20and%20recommended%20plan%20revisions.md), including its 5 October 2026 research cutoff.
  Its opaque original file-citation tokens are not independently retrievable links; this plan cites the supplied file and verified sources instead of treating those tokens as evidence artifacts.
- [Current WebVOWL native dependency-selection contract](../owlapi-git-adoption.md) and `src/owlapiConsumerBoundary.architecture.test.js`; current selector/lock/export metadata inspected on 27 October 2026, with installed-payload and runtime qualification still required for the cache candidate.
- [AWS stack-separation plan](https://github.com/Hadden-Industries/amazon-aws/blob/main/docs/plans/2026-09-30-hadden-industries-aws-stack-separation.md), especially §§4.4–4.6, 9.4–9.7 and SLICE-011–014; §2.6 records the exact revision-6 input and this coordinated local revision-7 update.
  A branch link does not establish publication of the edited draft.
- [Historical public rc.1 release and downstream acceptance policy](https://github.com/Hadden-Industries/owlapi/releases/tag/v0.1.0-rc.1); historical evidence, not the selected artifact.
- [Historical rc.1 public API](https://github.com/Hadden-Industries/owlapi/blob/v0.1.0-rc.1/API.md) and [npm package](https://www.npmjs.com/package/@hadden-industries/owlapi); the October 5 registry check is historical.
  Use the exact selected artifact's current API/export evidence for implementation.
- WebVOWL `7a298176a9cb7fff31c89069a63d6746bf9bf23a` (committed baseline; adopted uncommitted limits work is separately identified in §2.6): `src/app/js/controller/canonicalVowlSourceAcquisition.js`, `importResolver.js`, canonical session/worker modules, `src/app/js/canonicalApplication.js` and `src/canonical-main.js`.
- Owner-approved 27 October unbounded-limits amendment (uncommitted source path `docs/specs/2026-10-27-canonical-vowl-unbounded-limits-amendment.md`) and inspected uncommitted implementation: `packages/vowl/src/index.js`, `resourceBudget.js`, `errors.js`, `internalRdf.js`, `owl/loading.js`, `owl/policy.js`, `owl/compatibleLoading.js`; application `canonicalVowlWorkerPolicy.js`, `canonicalVowlWorkerOperations.js`, `canonicalVowlWorkerClient.js` and `importResolver.js`.
  §11.2 adopts those source contracts; §19 identifies existing unbounded-limit tests and the independent supplemental overlay for later qualification.
  This revision neither rewrites the historical core specification nor claims those tests passed.
- Consumer diagnostic/acquisition evidence: `canonicalVowlFailure.js`, `canonicalVowlSourceAcquisition.js`; logical corpus reader `packages/vowl/conformance/storage.mjs`.
- The prior [standalone package plan](https://github.com/Hadden-Industries/owlapi/blob/main/docs/implementation-plan.md) and [lifecycle plan](https://github.com/Hadden-Industries/owlapi/blob/main/docs/ontology-lifecycle-capability-implementation-plan.md) remain historical context, not gates overriding the published RC contract.
- `amazon-aws` stack/rewrite/cost-control paths in §§5/14/18 remain predictions requiring current repository and account inspection before implementation; no deployed inventory is established by this revision.

- [Universal Ontology external corpus at the inspected commit](https://github.com/Hadden-Industries/universal-ontology/tree/e34ced0935e2ac384a679476e186d68817a29021/src/external): local source-sidecar and ontology/import observations, not remote reachability or publication approval.
- [Microsoft contract-first API design](https://learn.microsoft.com/en-us/azure/architecture/microservices/design/api-design), [Pact consumer/provider verification](https://docs.pact.io/implementation_guides/javascript/docs/provider), and [AWS prepare/activate deployment guidance](https://aws.amazon.com/builders-library/ensuring-rollback-safety-during-deployments/): basis for agreed interfaces, separate component proof and gated activation; these references do not mandate adoption of a new test platform.

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
- [RFC 7089 — Memento resource-state archives](https://www.rfc-editor.org/rfc/rfc7089.html), informational architecture guidance; no new protocol implementation is selected.
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
- [S3 Versioning](https://docs.aws.amazon.com/AmazonS3/latest/userguide/Versioning.html), pointer-recovery mechanism distinct from application version deduplication.
- [Lambda Function URL throttling](https://docs.aws.amazon.com/lambda/latest/dg/urls-configuration.html#urls-throttling), API concurrency controls; no account-wide hard cost-cap claim.
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
