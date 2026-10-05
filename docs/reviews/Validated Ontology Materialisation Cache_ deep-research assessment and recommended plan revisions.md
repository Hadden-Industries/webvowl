# Validated Ontology Materialisation Cache: deep-research assessment and recommended plan revisions

## Executive findings

The attached implementation plan has a strong architectural core: document-level rather than closure-level caching, immutable digest-addressed artefacts, an explicit source-IRI/parser-context boundary, network retrieval outside `owlapi`, OASIS XML Catalog publication, bounded retrieval, and validation before publication are all sound choices. fileciteturn0file0

However, the public repositories have moved far enough since **2026-09-25T00:00:00Z** that several parts of the plan should now be changed before implementation.

The most important conclusions are:

1. **The plan must no longer wait for a stable `owlapi` release or an old “Phase 20” gate.** Public `owlapi` `0.1.0-rc.1` was deliberately made eligible for production consumer acceptance; its release documentation says stable `0.1.0` is not a prerequisite to consumer adoption. fileciteturn5file0

2. **There is not, at the research cut-off, a publicly released `owlapi` `0.1.0-rc.2`.** The current repository package metadata still reports `0.1.0-rc.1`, and the merged rc.2 work explicitly describes itself as planning only: package APIs, versions, dependencies, executable release controls and npm tags were unchanged, with implementation and publication left to future work. fileciteturn6file0 fileciteturn7file0  
   This matters because the requirement that the plan be implementable **immediately against rc.2, without waiting for another release, cannot presently be satisfied from public evidence**. I therefore do not attribute unimplemented rc.2-plan capabilities to a released package.

3. That does **not** mean the cache work needs to wait. The materialisation design can and should be constrained to capabilities already present in the published RC baseline. In particular, the pre-rc.1 implementation added source-preserving loading, managed import closures, Functional Syntax and losslessly-verified RDF/XML storage, parser/format metadata, Java-compatible RDF import handling, DL/KRSS1 support and preservation fixes, and a public asynchronous OWL 2 DL profile-validation surface. These were integrated before the `0.1.0-rc.1` publication source commit. fileciteturn4file0

4. **WebVOWL's integration architecture has materially changed.** The old converter/controller/Turtle paths referenced by the cache plan are no longer the right integration seams. WebVOWL introduced a canonical VOWL package, moved loading/editing into worker-owned document sessions, adopted public `owlapi` format metadata, preserved exact acquired source bytes, and then completed a canonical production cutover that explicitly removed obsolete converter, controller and Turtle-writer paths. fileciteturn1file0

5. The most important architectural correction is to distinguish **byte identity, document validation and closure validation**. The same source bytes can have different meaning when parsed against different document IRIs because relative IRIs and base resolution are contextual. Consequently, S3 may safely deduplicate immutable content by byte digest, but a successful `owlapi` validation result must **not** be keyed by byte digest alone. It needs at least the parser-input digest, effective document IRI, parser/format identity, exact `owlapi` version and loader-policy fingerprint. This follows directly from RDF/OWL document semantics and is especially important now that `owlapi` deliberately preserves per-document source and import context.

6. **Do not hard-code the ontology format catalogue in the cache.** WebVOWL has already removed its copied format list in favour of public `owlapi` metadata, and the cache should do the same. That is both a direct response to repository evolution and the cleanest way to prevent Lambda and browser format support from drifting apart. fileciteturn1file0

7. The plan should retain its document-level storage model, but add a distinct **closure-qualification manifest**. `owlapi` can now maintain real managed import graphs, including cycles and shared imports, without flattening them. A root can therefore be `DOCUMENT_VALIDATED` before its entire import closure is available, and become `CLOSURE_VALIDATED` only after every resolved member has passed the same pinned policy and the full closure has passed the required profile checks. fileciteturn4file0

My resulting recommendation is to **rebase rather than redesign** the plan: retain S3/DynamoDB/SQS/CloudFront and document-addressed materialisation, but replace the release gate, integration seams, format ownership, validation identity, state model and HTTP-cache contract described below.

## Repository changes since the cut-off

For exhaustiveness, I treated “changes made since `2026-09-25T00:00:00Z`” as commits incorporated into the public default-branch history through the latest state inspected on **2026-10-05 Asia/Nicosia**. That gives **14 WebVOWL commits** and **69 owlapi commits**. Merge commits are deliberately retained in the accounting rather than silently collapsed into their source commits. The public release/tag state was checked separately because it determines what can actually be consumed.

### WebVOWL

All 14 post-cut-off commits are accounted for below. The first default-branch commit before the cut-off is from 24 September, so there is no boundary ambiguity in this repository. fileciteturn1file0

| UTC date | Commit | Change and consequence for the cache plan |
|---|---|---|
| 2026-10-01 | `4cac26e` | **Canonical VOWL core, OWL mapping and legacy migration.** Added `packages/vowl`, canonical encode/decode/edit surfaces, OWL-closure mapping, bounded admission/resource policies and independent conformance artefacts. The cache is now upstream of a package-owned canonical model rather than merely the historical `owl2vowl` converter. |
| 2026-10-01 | `3c06af7` | **Conformance-corpus consolidation.** Reduced physical fixtures from 8,876 to 1,717 while preserving every logical case, original byte sequence and expected result. Cache tests should reuse logical corpus readers rather than copying thousands of physical files. |
| 2026-10-01 | `13e33a1` | **Format selection delegated to `owlapi` metadata.** Added DL/KRSS1 admission, exact parser ownership and full-closure structural validation; removed WebVOWL's copied format list. This directly invalidates hard-coded cache format tables. |
| 2026-10-03 | `d77183f` | **Compatible artefacts/application foundations.** Adopted the approved public scoped `owlapi` release with exact lock integrity; import acquisition began carrying **bounded exact bytes**, redirects, cancellation and parser metadata into the canonical path. This is the natural cache integration boundary. |
| 2026-10-03 | `ef4926b` | **Candidate application integration.** Loading and editing became worker-owned; original source bytes, retained RDF and current semantic exports received explicit ownership. Cache delivery must preserve this original-source channel. |
| 2026-10-03 | `62fc931` | **Bounded namespace splitting.** Replaced a backtracking expression with linear delimiter scans. Cache/IRI code should follow the same hostile-input principle rather than introduce new unbounded URI regexes. |
| 2026-10-03 | `1d91eb3` | Merge of the canonical candidate through SLICE-005. No independent cache requirement, but it records the integration boundary containing the preceding canonical work. |
| 2026-10-03 | `2bba8c5` | **Bounded workload qualification.** Qualified 2,000-class workloads in Chromium, Firefox and WebKit; raised embedded-work default to 1,500,000 while retaining a 4,000,000 maximum and cancellation safeguards. Cache acceptance tests must demonstrate that cache hits do not evade downstream resource budgets. |
| 2026-10-03 | `9e69b1c` | **Canonical production cutover and legacy retirement.** Removed obsolete converter/controller/Turtle-writer paths, made canonical composition production, retained rollback deployment, and qualified 9,315 tests. This is the largest direct incompatibility with the attached file map. |
| 2026-10-03 | `4aa7cb2` | Merge of canonical qualification and production cutover. Records mainline adoption of `9e69b1c`. |
| 2026-10-04 | `d291c38` | **Dependency/security consolidation.** Patched the reported dependency vulnerabilities, updated CodeQL, Vite, Prettier, dependency-cruiser and Python tooling, and strengthened notice handling for npm aliases. Cache-related repository work should build on these current dependency/tooling baselines. |
| 2026-10-04 | `56a9913` | Merge of the consolidated dependency/security work. |
| 2026-10-04 | `17a235d` | `html-validate` development dependency 11.16.0 → 11.16.1. No runtime cache impact. |
| 2026-10-04 | `0fbf00e` | Merge of the `html-validate` patch. No runtime cache impact. |

The resulting architectural fact is more important than any individual path rename: **cache acquisition belongs at the source/import acquisition seam that feeds the canonical worker/document session, not inside a retired converter layer**. WebVOWL's own changes already establish exact-byte acquisition, parser-metadata ownership, cancellation and canonical package boundaries that the cache should preserve rather than bypass. fileciteturn1file0

### owlapi

The 69 incorporated commits fall naturally into nine contiguous change sets. Every post-cut-off SHA is included here; merge and documentation-only commits are retained because they affect release/qualification assumptions even where they do not change runtime code. fileciteturn4file0

| Period | Commits accounted for | Material change |
|---|---|---|
| 25 Sep | `8153c42`, `1e58803`, `d7e4f49`, `a8686af`, `6bdda23`, `fb7fd41`, `c4b448c`, `b888f1f` | Built the import-closure acceptance oracle; authorised pre-release lifecycle development; separated implementation from acceptance; added `StringDocumentTarget` and storage errors; added manager-owned atomic `saveOntology`; introduced verified immutable evidence reuse; added lossless Functional Syntax storage; added deterministic RDF/XML graph writing. |
| 27 Sep | `234af64`, `e46f85a`, `3aeffe3`, `bad59c5`, `887d179`, `0ca59a9` | Completed losslessly verified RDF/XML publication; qualified public closure/storage consumers; planned and then implemented fresh source-closure parity; fixed RDF reconstruction so declarations in transitive imports are available while sibling/unrelated declarations remain isolated; reconciled all four July ontology families and named-datatype compatibility behaviour. |
| 28 Sep | `7909862`, `392fec9`, `0d0019b`, `4ca8f64`, `013e3fe`, `e761c1e`, `d64e5c4`, `fc8c053`, `054ad81` | Moved format/workflow checks to authoritative native tools; rebased lifecycle work into the first `0.1.0` line as an `rc.1` candidate; added/qualified pinned Java parity infrastructure; fixed RDF ontology-header handling for ordinary annotations; merged the lifecycle branch; retained historical npm-namespace evidence. Runtime-relevant result: the lifecycle features were now part of the first-release candidate rather than deferred to 0.2.0. |
| 29 Sep | `38ad0c6`, `110df16`, `6de6ed0`, `9142f9e`, `08f231a`, `b7926c7`, `b203c00`, `f5a160c` | Bounded XML-prefix detection and refreshed dependencies/security evidence; introduced safe reuse of identical PR qualification on main; updated that mechanism to current GitHub API semantics; added Python/Markdown quality tooling. Runtime semantics were largely unchanged except for the bounded XML-prefix/security repair. |
| 30 Sep | `d4d29bb`, `71d90c3`, `e769bfc`, `fc74a55`, `3d1933c` | Planned scoped npm RC production use and aligned governance; most importantly, added and merged **source-preserving asynchronous OWL 2 DL profile validation across managed import closures**, preserving exact cardinalities, original constructor arity, per-document formats/import context and source-trust qualifications. |
| 1 Oct | `9f91e33`, `fdfdb16`, `1e27077`, `1dbeb93`, `6d2cbc7`, `3097c6a` | Preserved DL numeric-literal lexical forms; made unsupported KRSS1 right-identity clauses reject rather than silently lose source information; qualified both through public APIs and WebVOWL. WebVOWL then pinned this corrected revision before moving to the public release. |
| 2 Oct | `e90aa88`, `63490d2`, `19cf43d`, `c45f077`, `fb1e3f6`, `c241309`, `36f0cb5`, `59131be` | Added Java-compatible RDF parser metadata, import discovery/property reconstruction and scoped-RC publication machinery; fixed verifier loading; tied qualification/publication to the exact parity checkpoint and consumer evidence; authorised and merged the exact `0.1.0-rc.1` publication controls. |
| 3 Oct | `2ac4686`, `f0ee5d4`, `92db027`, `044b057`, `fc87d1e`, `dee7928`, `7635012`, `45dd845`, `044fc25`, `979f526`, `1121ae3`, `4cf278d`, `a9bbd00`, `2769f1c`, `096f25b`, `8cc78e6` | Reconciled the already-published RC on both `next` and `latest`; changed only release documentation around those tags; developed increasingly explicit Java/WebVOWL CI qualification and local Java-reference bundles; finally added the **rc.2 Java-parity plan**, explicitly as future implementation rather than a package/API change. |
| 4 Oct | `de2937b`, `43d5780`, `1cdc5a3` | Added and fixed gated reuse of native Java-reference qualification evidence. Shared reuse remained disabled pending further acceptance. These are CI/qualification changes, not a new package release or new cache-facing runtime API. |

That accounting leads to a useful distinction. The substantial ontology-lifecycle and parser/profile work needed by this cache was not merely proposed after the cut-off: it was implemented and rolled into the rc.1 release line. By contrast, the public **rc.2** work currently visible is a planning/qualification programme. The rc.2 planning PR itself says that it changes documentation only and that “package APIs, versions, dependencies, executable release controls and npm tags are unchanged”. fileciteturn7file0

## What can actually be used from owlapi now

### Release reality

The latest publicly evidenced release inspected is **`v0.1.0-rc.1`**, published from source commit `59131be0c1dc3a634e8433b06d2949051c051c0a`. The release is a prerelease, but its own release policy explicitly allows downstream applications to accept that exact RC independently and says stable `0.1.0` is not required for that adoption. fileciteturn5file0

The public default branch still declares package version **`0.1.0-rc.1`**. fileciteturn6file0

The merged rc.2 plan, meanwhile, says implementation and executable release controls remain future work. fileciteturn7file0

Accordingly:

> **The implementation plan should not claim “requires owlapi 0.1.0-rc.2” today. There is no public versioned rc.2 artefact against which that claim can be verified or installed.**

The safe planning rule is instead:

> **Use only the API/capability subset already present in the published RC; pin an exact published package. When rc.2 is actually published, substitute it only after proving that the same cache contract passes against that exact package. Do not make any cache milestone contingent on an rc.2-only planned feature.**

This meets the substantive “do not wait for another release” objective: no proposed cache capability below requires stable `0.1.0` or a hypothetical post-rc.2 feature.

### Immediate capability baseline relevant to this plan

The published candidate incorporates the following capabilities before its publication-source commit. fileciteturn4file0

| Capability available in the published release line | Consequence for the materialisation plan |
|---|---|
| Manager-owned ontology loading with retained document/import identity and transactional publication | Lambda and browser can use the same ontology-manager semantics without the cache needing its own ontology graph model. |
| Deterministic managed import-closure queries, including cycles, diamonds and already-managed imports | A cache can remain **document-addressed** while closure qualification is represented separately. Do not flatten imports simply to make caching easier. |
| Atomic ontology changes and manager-owned lifecycle state | Useful for qualification/tests, but the cache should cache source representations, not mutable ontology objects. |
| `StringDocumentTarget` plus stable storage-error hierarchy | Available immediately where derived serialisations are genuinely required. |
| `saveOntology` with exact format selection and atomic publication | Can produce derived artefacts without exposing half-written output. It should **not** replace exact source bytes in the source cache. |
| Lossless Functional Syntax storage | Useful for optional derived/debug artefacts. Not a reason to canonicalise origin documents on ingestion. |
| RDF/XML storage guarded by a strict reconstruct-and-compare losslessness check | Strong assurance for an optional derived RDF/XML representation; again, preserve origin bytes separately. |
| Java-compatible RDF parsing/reconstruction with import-aware declaration context | Cache-served imports can be parsed with the same semantics as directly acquired imports, provided the original document context is retained. |
| Public parser/format metadata | Make this the **single format catalogue** for browser and materialiser. |
| DL support with exact numeric lexical preservation | Add DL to the cache qualification matrix without a special cache-specific parser list. |
| KRSS1 support with fail-closed rejection of unsupported right-identity clauses | Do not treat “parser recognised this syntax” as “all content was represented”; retain typed rejection. |
| Source-preserving loading | Validation can retain original syntactic evidence rather than equating a projected model with the source. |
| Public asynchronous OWL 2 DL profile validation across the managed import closure | Use this for the closure-qualified state required before canonical VOWL projection where OWL 2 DL conformance is part of the consumer contract. |
| Node, browser/bundler, native import-map and DedicatedWorker qualification | Supports the plan's aim of using the **same exact package** in Lambda and WebVOWL rather than maintaining a server fork. |
| Scoped public npm release with exact downstream acceptance | Replace Git-revision/Phase-20 assumptions with an exact package version and lockfile integrity. |

Two cautions follow from that capability set.

First, **parsing is not equivalent to OWL 2 DL conformance**. The new `profiles` surface is a separate capability for good reason. The cache state machine should preserve that distinction.

Second, **storage is not source preservation**. The fact that `owlapi` can write deterministic Functional Syntax or verified RDF/XML does not make those outputs interchangeable with the retrieved representation. Relative IRIs, lexical forms, format-specific source evidence, signatures/checksums and provenance all argue for keeping the acquired bytes as the primary immutable cache object.

### Capabilities I would request from owlapi, but not block this plan on

No additional `owlapi` release should be a prerequisite. There are nevertheless two producer improvements worth filing against the rc.2 programme:

**A byte-oriented public document source.** The cache is naturally byte-preserving and WebVOWL's canonical acquisition path now explicitly acquires bounded exact bytes. If the public parsing boundary still requires `StringDocumentSource`, the materialiser has to own decoding policy. A public source that accepts `Uint8Array`/`ArrayBuffer` plus document IRI and media/charset metadata would make source-byte preservation and non-UTF-8 handling much cleaner. This is an improvement request, not a reason to postpone the cache.

**A stable public loader-policy/capability fingerprint.** The cache can calculate its own canonical fingerprint over the exact package version, loader options and relevant format/profile catalogue. A producer-supplied policy identity would make this less application-specific. Again, the cache can implement the fingerprint itself now.

## Recommended changes to the implementation plan

The recommendations below deliberately follow the requested evidence ordering: **first principles first**, then current engineering practice, then authoritative specifications/guidelines, and finally the already-adopted practice visible in these repositories.

| Priority | Suggested plan change | Rationale and source basis |
|---|---|---|
| **Must** | **Replace the “Phase 20/stable owlapi start gate” with an exact-public-package adoption gate.** State that implementation uses no API newer than the current published RC capability baseline. Pin the exact scoped package version and lockfile integrity in both Lambda and WebVOWL. When rc.2 exists, changing to it is an independently qualified dependency update, not a prerequisite for starting. | **First principles:** depend on an installable artefact, not a roadmap state. **Modern practice:** reproducible builds require exact package identity. **Repository evidence:** rc.1 is explicitly eligible for independent downstream production acceptance and stable 0.1.0 is not required; rc.2 is presently planning only. fileciteturn5file0 fileciteturn7file0 |
| **Must** | **Rewrite the WebVOWL integration section around the canonical source/import acquisition boundary and canonical worker/document session. Delete old implementation references to the retired `owl2vowl` converter/controller/Turtle-writer path.** | **First principles:** a cache is an acquisition concern and should not invade representation/projection layers. **Best practice:** one dependency inversion point is easier to test and roll back. **Adopted repository practice:** WebVOWL now acquires bounded exact bytes, attaches redirect/cancellation/parser metadata, uses worker-owned canonical sessions and has retired the legacy converter/controller/Turtle paths. fileciteturn1file0 |
| **Must** | **Make `owlapi` public format metadata the sole syntax/media-format authority. Generate cache Accept preferences, parser candidates and fixture enumeration from it; keep ordering/policy as application configuration, not a copied format catalogue.** | **First principles:** one fact should have one owner. **Best practice:** capability discovery eliminates version drift. **Repository practice:** WebVOWL already removed its copied format list and derives selection from `owlapi` metadata, including DL and KRSS1. fileciteturn1file0 |
| **Must** | **Split cache state into at least `FETCHED`, `DOCUMENT_VALIDATED`, `CLOSURE_VALIDATED` and `PUBLISHED`; retain typed terminal/transient failure states separately.** A document may be published as a reusable document cache object without falsely claiming that an unavailable transitive import closure has passed profile qualification. | **First principles:** evidence must prove exactly the proposition represented by the state. A parsed document does not prove the transitive closure. **OWL:** OWL 2 imports semantics operate over an imports closure. **Repository practice:** `owlapi` now explicitly separates managed-document loading from full-closure profile reports. fileciteturn4file0 |
| **Must** | **Keep S3 byte objects content-addressed, but key validation evidence by context, not digest alone.** Define a validation identity such as `SHA-256(parser-input bytes) + effectiveDocumentIRI + parserFormatId + owlapiExactVersion + loaderProfileFingerprint + validationContractVersion`. | **First principles:** equal octets do not imply equal parsed meaning when relative identifiers are resolved against different bases. **Authoritative specifications:** RFC 3986 base-URI resolution; RDF 1.1 Concepts/Turtle base resolution; XML Base/RDF/XML; JSON-LD 1.1 base/context processing. **Repository practice:** `owlapi` now preserves per-document format/import/source context. fileciteturn4file0 |
| **Must** | **Preserve acquired bytes as the primary immutable artefact. Never replace them with a Functional Syntax or RDF/XML reserialisation.** Any generated representation goes under a distinct derived-artifact namespace with its own digest and provenance. | **First principles:** caching is supposed to preserve the fetched representation. Re-serialisation can change lexical information and removes the exact origin representation even if the ontology structure is equivalent. **Repository practice:** both projects have explicitly invested in source preservation and exact-byte evidence; WebVOWL's canonical source export distinguishes original bytes from current semantic exports. fileciteturn1file0 fileciteturn4file0 |
| **Must** | **Strengthen the existing “preserve source document IRI” rule into three separate fields:** `requestedDocumentIRI`, `effectiveRetrievalIRI` after redirects, and `parserDocumentIRI`/base supplied to `owlapi`. Do not derive the parser base from the S3 or CloudFront cache URL. | **First principles:** storage location is not ontology-document identity. **Specs:** RFC 3986 relative-reference resolution, RDF/XML/XML Base and JSON-LD base handling all make context semantically significant. **Repository practice:** current WebVOWL import acquisition carries redirect context and parser metadata explicitly. fileciteturn1file0 |
| **Must** | **Define the digest over the exact bytes delivered to the parser after HTTP content decoding, and record transfer metadata separately.** Record at least original `Content-Encoding`, `Content-Type`, byte length, origin validators and effective URI. | **First principles:** the digest used for parser/cache identity must identify what was actually parsed; gzip transfer octets are not the ontology representation presented to the parser. **HTTP specifications:** RFC 9110 distinguishes representation/content codings from message framing. This removes an otherwise subtle mismatch between origin transfer encoding and cache identity. |
| **Must** | **Turn the current non-UTF-8 “pause clause” into an explicit decoding contract rather than leaving it as an implementation uncertainty.** Keep exact bytes regardless; where a text-only `owlapi` source is required, decode using syntax/media rules and reject unsupported/ambiguous encodings before validation. Do not silently substitute U+FFFD. | **First principles:** a lossy decoder can make a digest-valid source parse as different text. **Specs:** syntax-specific encoding rules and HTTP `Content-Type` charset semantics should determine the boundary. **Producer improvement:** request a byte-oriented public `owlapi` source, but do not block implementation on it. |
| **Must** | **Make loader/profile versioning first-class.** Store `owlapiPackageVersion`, a canonical loader configuration, its SHA-256 fingerprint, profile-validation mode and cache schema version with each validation result and catalogue entry. A package/config change invalidates validation evidence, not the underlying immutable bytes. | **First principles:** validation is a function of bytes **and policy/software**, not bytes alone. **Best practice:** separate immutable data from reproducible processing provenance. This lets an rc.1→rc.2 change revalidate existing objects without redownloading them. |
| **Must** | **Use the same exact public loader configuration in Lambda and WebVOWL, but keep transport policy outside `owlapi`.** In particular, `remoteImports`/remote JSON-LD contexts should remain disabled inside the parser; all external acquisition goes through the controlled materialiser/resolver. | This is one of the strongest choices in the original plan and should be made more explicit rather than changed. fileciteturn0file0 **First principles:** only one component should possess network authority. **Security best practice:** centralise SSRF enforcement. **Repository evidence:** `owlapi` qualification itself uses denied-network/offline closure checks, and WebVOWL has a separate acquisition owner. fileciteturn4file0 |
| **Must** | **Validate every redirect hop, not just the initial URL.** Reject user-info credentials; permit only HTTP(S); cap hops; resolve each destination and reject loopback, link-local, private, multicast, metadata-service and otherwise prohibited address ranges; re-check after each redirect and protect against DNS rebinding. | **First principles:** the security property is about every network destination actually contacted. **Authoritative/community guidance:** OWASP SSRF Prevention Cheat Sheet; RFC 3986 URI parsing rules. The attached plan already has SSRF controls, but redirect/DNS enforcement should be made a testable invariant rather than a general statement. fileciteturn0file0 |
| **Should** | **Add network-level egress defence in depth rather than relying exclusively on URL validation.** Route the retrieval worker through an explicitly controlled egress layer where feasible and block cloud instance/metadata endpoints independently of application checks. | **First principles:** a defect in the URL validator must not automatically become unrestricted network access. **Modern cloud practice:** layered controls at application and network boundaries. This is especially valuable because ontology imports are attacker-influenced network targets. |
| **Must** | **Implement proper HTTP revalidation semantics.** Persist `ETag`, `Last-Modified`, relevant `Cache-Control`, `Vary`, response status, effective URI and acquisition time. Prefer conditional requests (`If-None-Match`/`If-Modified-Since`) when refreshing an existing source. Define explicit behaviour for `no-store` and responses varying on request headers. | **First principles:** the cache should not download/revalidate unchanged representations unnecessarily and must not assume that an HTTP URI is immutable. **Authoritative spec:** RFC 9111 HTTP Caching and RFC 9110 conditional-request semantics. The current digest model remains useful after a `200`; a `304` can retain the previous immutable object. |
| **Must** | **Do not over-normalise source IRIs for the DynamoDB identity.** Preserve the caller's logical IRI and an independently parsed retrieval URI. Remove a fragment only at the HTTP request boundary where appropriate; do not conflate percent-encoded or otherwise merely “similar looking” URIs without a specification-backed equivalence rule. | **First principles:** the cache must not cause two potentially different resources to alias. **Specification:** RFC 3986 explicitly distinguishes syntax normalisation from general resource equivalence. |
| **Must** | **Use `owlapi` closure loading/profile validation to create a root-level closure-qualification manifest rather than materialising a flattened ontology.** The manifest should record root identity, exact member validation identities, resolved direct-import edges, qualification profile and completion time. | **First principles:** preserve source/document boundaries. **OWL 2:** imports closure is a graph-semantic concept, not a mandate to merge source files. **Repository practice:** current `owlapi` retains real managed ontology instances/edges, handles cycles and provides deterministic closure queries; its own qualification uses closure composition without making flattened source the authoritative representation. fileciteturn4file0 |
| **Must** | **Define explicitly whether “validated” means parse-valid, source-preserving, OWL 2 DL, or WebVOWL-consumer-admissible.** For the canonical WebVOWL publication route, I recommend requiring source-preserving load + complete import resolution + the public full-closure OWL 2 DL profile report where the canonical VOWL contract requires it. Preserve a lower `DOCUMENT_VALIDATED` state for correctly parsed documents that cannot yet prove the closure. | **First principles:** avoid a Boolean whose meaning changes between components. **Repository evidence:** `owlapi` introduced profile failures, source qualifications and incomplete checks as separate concepts precisely to prevent this conflation. fileciteturn4file0 |
| **Should** | **Keep validation and WebVOWL admission budgets separate but jointly visible.** A source may be a valid ontology yet exceed WebVOWL canonical mapping/display resource limits. Record `ontologyValidation` and `consumerAdmission` independently rather than calling the source invalid. | **First principles:** resource suitability is not semantic invalidity. **Repository practice:** WebVOWL now carries explicit bounded-work policies and qualified its 2,000-class workloads across Chromium, Firefox and WebKit. fileciteturn1file0 |
| **Must** | **Make queue processing formally idempotent.** Treat SQS delivery as at-least-once; acquire a DynamoDB conditional lease/version before doing network work; write immutable S3 data first; conditionally commit validation/catalogue state only if the source generation is still current; make retries safe after every intermediate failure. | **First principles:** duplicated or reordered work must not publish stale content. **AWS authoritative guidance:** Amazon SQS provides at-least-once delivery for standard queues; DynamoDB conditional expressions/transactions are the normal compare-and-swap mechanism. This strengthens the original plan's existing state/conditional-write ideas. fileciteturn0file0 |
| **Must** | **Make catalogue publication a commit point.** The order should be: retrieve → digest → immutable S3 put with checksum → document validation → optional closure qualification → durable DynamoDB generation commit → publish/update catalogue pointer. A catalogue must never point to an object or qualification record that is not fully durable. | **First principles:** readers should observe either old-complete or new-complete state, never a partially published generation. **Best practice:** immutable data + conditional mutable pointer is substantially easier to recover than in-place replacement. |
| **Should** | **Use S3's explicit SHA-256 checksum facilities in addition to putting the digest in the key. Do not treat an S3 ETag as a content SHA-256.** | **First principles:** independent integrity metadata detects corruption/mis-publication. **AWS authoritative guidance:** S3 object ETags are not a universal SHA-256 identity and multipart/encrypted objects in particular make them unsuitable for that role; S3 supports explicit checksum algorithms. |
| **Should** | **Publish two catalogue representations from one transactionally generated model:** retain OASIS XML Catalog as the standards-facing artefact, and optionally publish a compact JSON lookup index for WebVOWL. Neither is independently edited. | **Specification:** OASIS XML Catalogs 1.1 is appropriate for URI-to-local-resource mapping and should remain. **Best practice:** a derived browser-oriented index avoids forcing a large XML parse into every WebVOWL lookup while preserving one authoritative catalogue model. |
| **Should** | **Use differentiated caching headers:** digest-addressed immutable objects can receive a long immutable lifetime; mutable catalogue/pointer objects should have short or explicitly revalidated lifetimes and validators. | **First principles:** a SHA-256-addressed URL cannot change without changing its identity, whereas “latest” can. **HTTP guidance:** RFC 9111 plus RFC 8246 `immutable` semantics support treating these classes differently. |
| **Must** | **Redact sensitive URL material in logs/metrics.** Record a stable source hash and safe host/path classification; never put URI user-info, authorization headers or unreviewed query strings into normal logs. | **First principles:** observability should not become a credential-exfiltration channel. **Community guidance:** OWASP Logging Cheat Sheet. This is especially important for a retriever accepting arbitrary URLs. |
| **Must** | **Add cross-runtime contract tests using the exact installed package, not mocks of `owlapi`.** Given identical `(bytes, parserDocumentIRI, format metadata, loader profile)`, Lambda and the WebVOWL worker must produce the same parser selection, typed outcome, import declarations and qualification status. | **First principles:** “same dependency” is not sufficient if integration layers alter its inputs. **Repository practice:** both projects now emphasise installed-package, worker/browser and consumer qualification, and WebVOWL explicitly adopted a public scoped package rather than an internal copy. fileciteturn1file0 fileciteturn4file0 |
| **Must** | **Replace cache-specific format fixtures with a metadata-driven qualification matrix plus independent edge cases.** Include every public parser identity and alias; specifically retain DL numeric-lexical preservation, unsupported KRSS1 right-identity rejection, RDF/XML bases, redirects, cyclic imports, duplicate imports, imported declarations, Unicode and denied JSON-LD remote context cases. | This directly carries the parser fixes and regressions incorporated since the cut-off into the cache acceptance suite instead of assuming old parser behaviour. fileciteturn4file0 |
| **Should** | **Adopt WebVOWL's current corpus-bundling mechanism rather than copying its physical fixture tree.** Cache tests should refer to logical test cases and exact byte members through the corpus reader. | WebVOWL has already reduced its physical corpus by more than 7,000 files while preserving every original byte sequence and logical case. Re-copying the pre-consolidation corpus would immediately recreate maintenance debt that the repository just removed. fileciteturn1file0 |
| **Must** | **Add cache-hit qualification to the existing canonical workload suite.** The same 2,000-class inputs should pass from direct acquisition and from materialisation-cache hits in Chromium, Firefox and WebKit, including cancellation, stale-result rejection and memory/work ceilings. | A cache is only successful if its faster acquisition path preserves the same consumer behaviour. WebVOWL's post-cut-off workload qualification supplies the already-adopted benchmark boundary. fileciteturn1file0 |
| **Should** | **Retain a previous deployment and a bypass mode through cutover.** The browser resolver should be able to bypass the catalogue/cache and follow direct controlled acquisition during rollback; catalogue version must be observable in diagnostics. | **First principles:** a performance optimisation must not become a single irreversible availability dependency. **Repository practice:** WebVOWL's canonical production cutover explicitly retained its previous deployment for rollback. fileciteturn1file0 |

### Revised data model

The plan's DynamoDB/S3 model should therefore evolve approximately as follows.

The immutable byte object remains simple:

```text
objects/sha256/<digest>
```

Its metadata should identify only facts about the materialised representation: parser-input byte digest, byte length, media type, content encoding/decoding record, acquisition timestamp and integrity checksum.

The source record should identify retrieval state:

```text
SourceRecord {
  requestedDocumentIRI,
  retrievalIRI,
  effectiveRetrievalIRI,
  currentByteDigest,
  etag,
  lastModified,
  cacheControl,
  vary,
  generation,
  fetchStatus,
  fetchedAt
}
```

A **separate** validation record should bind semantics to context:

```text
ValidationRecord {
  byteDigest,
  parserDocumentIRI,
  formatId,
  owlapiVersion,
  loaderProfileFingerprint,
  validationContractVersion,

  documentValidation,
  sourcePreservationQualification,
  diagnostics,

  validatedAt
}
```

Finally, closure evidence should be root-specific:

```text
ClosureQualification {
  rootValidationIdentity,
  memberValidationIdentities[],
  directImportEdges[],
  closureDigest,
  profile,                 // e.g. OWL2_DL
  profileReportDigest,
  consumerAdmissionPolicy,
  consumerAdmissionResult,
  qualifiedAt
}
```

This is more data than a single “VALID” flag, but it solves several otherwise difficult problems at once: deduplication of byte-identical documents, correct relative-IRI semantics, revalidation after an `owlapi` upgrade, correct treatment of incomplete imports, reproducible debugging, and safe rc.1→rc.2 migration.

### Revised WebVOWL flow

The attached plan currently conceives a browser `load(documentIRI, {config, signal})` seam, which remains a useful interface idea. fileciteturn0file0 The implementation beneath it should now be aligned to the canonical runtime:

```text
canonical document/import session
            |
            v
    source acquisition owner
        /             \
       /               \
catalogue lookup     controlled origin fetch
   |                       |
CloudFront/S3          existing resolver
   |                       |
   +----------+------------+
              |
      exact bounded bytes
              |
       parser metadata
              |
      public owlapi API
              |
 source-preserving ontology
              |
 closure/profile qualification
              |
      canonical VOWL mapping
```

The cache should therefore be invisible to canonical model semantics: a cache hit changes **where the exact source bytes came from**, not the loader's document IRI, parser policy, import graph, profile rules or canonical projection.

That is preferable to inserting the cache after parsing, because a parsed-object cache would couple the stored representation to an `owlapi` implementation version and would discard exactly the lexical/source evidence both repositories have recently worked to preserve.

## Proposed delivery sequence and acceptance gates

The existing phased plan should be reordered slightly so that correctness invariants are established before AWS optimisation.

**Start with package and semantic contracts.** Pin the exact presently public RC; record its package integrity; generate the format catalogue from its public metadata; freeze the loader-profile JSON and digest; define byte-digest, URI, decoding and validation identities. Do not write S3/DynamoDB code before these identities are testable. The current public RC is explicitly consumable independently of stable 0.1.0. fileciteturn5file0

**Then implement the retriever as a security boundary.** Test URL parsing, DNS/IP policy, every redirect, byte limits, content decoding, conditional HTTP requests, cancellation and exact-byte hashing using controlled local HTTP endpoints. `owlapi` remains completely network-disabled inside this component.

**Then implement immutable storage and the state machine.** S3 objects are write-once by digest; DynamoDB owns source generations, leases and validation records; SQS operations are idempotent. Exercise crashes after each persistence boundary and prove that no catalogue can expose half-published work.

**Then add `owlapi` document validation.** Use only public package entry points. Tests must compare the same exact installed package in Node/Lambda and browser-worker contexts. A successful parse produces `DOCUMENT_VALIDATED`, not closure qualification.

**Then add managed closure qualification.** Resolve each import through the same cache/acquisition abstraction, retain each imported document's own parser context, let `owlapi` build its managed graph, and run the required asynchronous profile report. Cycles, diamonds, shared imports and transitive declarations are mandatory fixtures because those are specifically behaviours hardened in the post-cut-off `owlapi` work. fileciteturn4file0

**Then publish catalogues and integrate the canonical WebVOWL acquisition seam.** Do not modify the canonical mapper merely to support the cache. Preserve the exact bytes and parser metadata expected by the current worker-owned session. WebVOWL's current architecture already demonstrates that this boundary is viable. fileciteturn1file0

**Finally perform production qualification.** Run the existing canonical corpus and 2,000-class browser workloads twice—direct origin and cache hit—and compare semantic result, parser selection, source evidence, canonical bytes where applicable, failure types and resource limits. Exercise stale catalogue data, 304 revalidation, source change, origin outage, worker cancellation, SQS duplicate delivery and rollback/bypass. WebVOWL's production cutover precedent should be copied: preserve a known-good bypass/rollback route through initial production observation. fileciteturn1file0

The release gate for the cache should therefore read approximately:

> **The materialisation cache may enter production when the exact publicly installable `owlapi` package selected by both consumers is pinned by version and integrity; all public format metadata and loader-policy fingerprints agree across Lambda and WebVOWL; direct-origin and cached-source executions are semantically equivalent on the complete qualification corpus; document and closure qualification states cannot be confused; the controlled retriever is the sole network authority; and rollback to direct controlled acquisition is verified. Stable `owlapi` 0.1.0 is not a prerequisite.**

When a public `0.1.0-rc.2` artefact appears, its adoption gate can be equally simple: install that **exact** package in both environments, recompute the policy identity, re-run the same qualification corpus, revalidate stored content under the new validation identity as needed, and move the consumer pin only if the results pass. No cache schema or network architecture should require another release merely to make that transition.

## Sources, confidence and limitation

The implementation-plan assessment is based directly on the supplied **Validated Ontology Materialization Cache Implementation Plan**, including its current Phase/start-gate assumptions, AWS architecture, security policy, use of `StringDocumentSource`, loader-profile parity, document-level materialisation and catalogue proposal. fileciteturn0file0

The repository-change accounting covers all **14 WebVOWL** and **69 owlapi** default-branch commits after `2026-09-25T00:00:00Z` in the public histories inspected for this research. fileciteturn1file0 fileciteturn4file0 The most consequential implementation changes are the canonical VOWL cutover and exact-byte acquisition on the WebVOWL side, and source-preserving closure/profile/storage/parser work on the `owlapi` side.

The public-release conclusion has particularly high confidence: the public release evidence identifies `v0.1.0-rc.1`; current package metadata remains `0.1.0-rc.1`; and the rc.2 PR explicitly states that it is documentation/planning and does not change package APIs, versions, dependencies, executable release controls or npm tags. fileciteturn5file0 fileciteturn6file0 fileciteturn7file0

For the non-repository recommendations, the principal authoritative sources are **RFC 3986** (URI syntax and reference resolution), **RFC 9110** (HTTP semantics), **RFC 9111** (HTTP caching), **RFC 8246** (`immutable` cache response directive), the **W3C OWL 2 Structural Specification and Functional-Style Syntax** and OWL 2 imports-closure model, **RDF 1.1 Concepts**, **RDF 1.1 Turtle**, **RDF/XML Syntax**, **JSON-LD 1.1**, **OASIS XML Catalogs 1.1**, the **OWASP SSRF Prevention Cheat Sheet** and **OWASP Logging Cheat Sheet**, together with AWS's official guidance for **SQS at-least-once delivery**, **DynamoDB conditional writes/transactions** and **S3 object checksums**. These specifications reinforce rather than replace the repository evidence: notably, the current repositories have already adopted many of the same principles—exact bytes, explicit source context, denied-network parser qualification, immutable evidence, bounded hostile-input work, deterministic closure handling, exact public package pinning and rollback-qualified production cutover.

The one material limitation is therefore not uncertainty about the cache architecture but the user's stated version premise: **there is no publicly released `owlapi` `0.1.0-rc.2` in the evidence available at the research cut-off.** Claiming otherwise, or claiming that rc.2 already implements the nine Java-parity slices described in its planning dossier, would turn future plans into fictitious current capabilities. The revised implementation above avoids that dependency entirely and is designed to be implementable using the already-public release line, while allowing a subsequently published rc.2 to be adopted by exact-package substitution and requalification rather than by redesign.