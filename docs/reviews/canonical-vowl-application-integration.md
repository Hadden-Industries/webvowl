# Canonical VOWL application integration

Status: SLICE-005 resumed on 3 October 2026 after explicit dependency and execution-transfer approvals; not a completed candidate or production cutover.
The owner accepted the [application boundary](canonical-vowl-application-boundary-proposal.md), including the bounded placement reconciliation refinement.
The [proposed compatibility direction](../plans/2026-10-02-canonical-vowl-compatibility-repair-plan.md#proposed-compatibility-direction) now frames the repair: preserve pre-fork loading/rendering coverage and explain defensible differences, while distinguishing visualization from the stronger guarantees of canonical export and semantic editing.
The foundations now implement live compatible ingress and an experimental qualified artifact, with qualification evidence below; production controller and renderer integration remains unfinished.
The [research resolutions](canonical-vowl-compatibility-research.md) specify compatible viewing with separate strict assessment and operation-specific guarantees, as implemented incrementally under the accepted amendment.

The [post-review synthesis](canonical-vowl-compatibility-research.md#8-post-review-synthesis-and-remaining-decisions) applies all Astra proposals: preserve save/reload and existing exports, account for material relationships, and qualify recovery before choosing worker lifetime.
It supersedes blanket capture restrictions and mandatory replay; the candidate portable schema and measured proof below do not yet establish complete application acceptance.

## Published dependency adoption on 3 October 2026

The owner approved the exact alias `npm:@hadden-industries/owlapi@0.1.0-rc.1` in both package manifests and the corresponding lockfile update, then explicitly approved execution adoption/resumption under the new HISEW installation.
Execution `2b2b2dd5-1d9d-46cb-8646-24c2dd8b31ab` is active at generation 23.
Both consumers now resolve one deduplicated installed `@hadden-industries/owlapi@0.1.0-rc.1` through the existing `owlapi` key and public import paths.
The lockfile pins `https://registry.npmjs.org/@hadden-industries/owlapi/-/owlapi-0.1.0-rc.1.tgz` with integrity `sha512-uDv9Omh2l2zxAjpVeQi4UxXEad/cRiKQUJT5RhxR3WtaAjPL3gAoOha9dPRhH6o2zlBdeg50g8EIVQgtt8RGqA==`.
No unrelated dependency resolution changed.

The first npm install retained the old Git package because its version number matched; a targeted update also retained it.
The exact registry name, tarball and integrity were therefore corrected in the approved lock entry using registry metadata, followed by installation, which changed one package.
The initial old-package test run is not evidence for the registry artifact.
Against the actual installed registry package, all 20 VOWL suites / 6,914 tests and four boundary/application-foundation suites / 68 tests passed.
The production build and both lazy-parser checks passed; the existing large-chunk warning remains.
`npm audit signatures` verified 619 registry signatures and 102 attestations across the installed dependency graph.

The broader repository run exposed an existing partial worker entry point with no named export; the existing message handler was named/exported without changing its behavior.
Full-candidate checks and broader compatible-view implementation remain separate completion obligations.
Earlier statements below that publication/configuration approval were pending describe the upstream handoff at that time, not the current adoption state.

The producer subsequently supplied the immutable GitHub prerelease verification receipt for release `402217399`, published at `2026-10-03T05:03:25Z`.
The locally inspected receipt records successful native release and four-asset verification at `2026-10-03T05:05:49.668Z`, with `draft: false`, `prerelease: true` and `immutable: true`.
The tarball SHA-256 remains `4e18d8a1d2f41af0f31f0426a24d57ddfa25316fba6be550adf2edd6202cabf8`; neither adoption nor producer runtime tests need repetition for unchanged bytes.
The release's `MAINTAINER_AUTHORIZED_RELEASE_COMPLETION` schema-version-1 record is distinct from the frozen workflow's schema-version-3 contract.
It preserves the historically failed workflow and the accepted `latest`-tag decision rather than claiming that run passed.
Evidence is `immutable-release-20261003/immutable-verification.json` under the existing external `owlapi-rc-publication-20261002` task-artifact directory.
This reported producer verification remains separate from WebVOWL application acceptance, and neither historical release-status item blocks implementation.

## Implemented foundations

### Compatible artifact and drawing preparation on 3 October 2026

The root surface now implements the experimental `compatibleArtifactProfile`, a separate identifier rather than a change to either frozen v1 profile.
The package owns a closed qualification grammar, generated schema, full-dataset mapping, refinement, canonical admission, decode, encoding authority and live reopening.
Document, import and qualification records participate in the same canonical identity graph as retained structure and the complete scene.
Portable qualifications carry selected ontology identity and typed parser/assessment facts; acquisition URLs, exact source bytes, digests and prose remain checkpoint-only evidence.
Reopening reports their absence explicitly and does not treat portable claims as original-source authentication.
The frozen structural-returning `edit` operation rejects qualified artifacts; qualified edits use `openCanonical`, `editModel` and `captureModel` instead.

The application session defaults OWL-origin and reopened qualified models to compatible artifact capture.
All six pinned source closures passed unrelated live editing, complete-scene capture, decode, live reopening and byte-identical recapture under the existing default limits.
Fresh-scene capture/decode timings were respectively 295/283 ms for FOAF, 539/548 ms for GoodRelations, 81/90 ms for MUTO, 180/171 ms for OntoViBe 2.2, 397/382 ms for Personas and 325/329 ms for SIOC.
The initial probe supplied an incomplete hidden-state fixture and correctly failed four cases; the corrected probe uses the application's incidence-closure function and passed all six.
Evidence is `qualify-compatible-artifacts-corrected.mjs` and `compatible-artifact-corrected-results.json` in the external `live-recovery-20261003-01` directory.
These timings describe that exact measured candidate, not a universal performance guarantee or a production render/export result.

The real-browser recovery harness passed fourteen checks in Chromium 154, including compatible OWL save/reload and byte-identical recapture, with no console warnings/errors in the passing run.
One stale Vite dependency-optimization response required a bounded server restart and reload; no build configuration was changed.
The additional artifact grammar, live reopening and source-evidence changes have focused implementation-worker tests; the authorized Claude mapping review covered the mapping scope recorded in its separate report, not this later entire artifact increment.
No additional independent review pass has been run.

Drawing preparation now consumes the exact admitted occurrence inventory and complete scene.
It preserves both independently positionable inverse labels, principal-member characteristic treatment, exact decimal cardinalities, hidden label placements and fixed B4/B5 display selection.
Partial operators expose their omitted operands through retained details instead of invented glyphs.
The session prepares this projection against a non-mutating preview of reconciled scene state before accepting the edit.
Focused tests cover these boundaries and preservation of the previous document when preparation fails.
The existing native D3 runtime now accepts that projection directly, bypassing the legacy parser and topology filters, restoring paused state and the canonical camera.
Inverse directions use independently placed native label primitives bound to one canonical edge, and edge decorations are not exposed as draggable scene placements.
The native runtime test covers exact topology despite a pre-existing degree filter, zero-valued label coordinates, camera restoration and a subsequent legacy mount.
The extended Chromium harness passed seventeen checks, including an actual canonical SVG mount and inverse-placement restoration, with no console warnings or errors.
The production controller has not yet switched to this runtime entry point.

The subsequent drawing-state connection captures native positions, pin state and camera into the application session with an exact load-generation/document-revision check.
It leaves hidden placements in the complete scene and rejects duplicate, stale or invalid updates before any scene mutation.
Native single-property labels now keep their independent canonical placements instead of being forced to the legacy edge midpoint; both viewer and editor redraw paths use this rule.
Canonical camera restoration also preserves saved positive finite zoom outside the interactive zoom extent.
The renderer/session/scene checks passed 22 tests, including saved camera/hidden-state capture, single-label movement and stale-update rejection.
The extended Chromium 154 harness passed eighteen checks, including native drawing-state capture into a saved artifact, with no console warnings or errors.
These checks qualify this connection, not a production-controller cutover or complete SLICE-005 acceptance.
The renderer and semantic inspector now share a kind-aware reference key: focusing a class no longer also focuses a property using the same IRI.
Anonymous reference keys include their load generation.
The focused adapter, inspector, projection and controller-contract run passed 181 tests, including the punned class/property focus regression.

The subsequent source-statement increment now retains public unparsed RDF in separate document-scoped records, with exact lexical/datatype/language/direction values and shared anonymous terms within each source document.
Capture, decode, reopening and unrelated editing preserve those records; edits depending on their unresolved meaning remain guarded after reopening.
Focused tests additionally cover local blank-label renaming, cross-document blank separation and dangling/cross-document reference rejection.
The six measured closures had empty public unparsed-statement arrays and therefore are not the evidence for this later increment.
Production rendering/edit/export integration and consolidated candidate qualification remain outstanding.

The consolidated repository run passed 154 suites and 8,930 tests before the subsequent native-runtime increment.
After that increment, the native editing suite passed eight tests and focused residual-identity/native-primitive tests passed eleven tests.
The full run is evidence for its tested snapshot, not a claim that later source changes have received another complete run.

### Live admission and recovery implementation on 3 October 2026

The owner confirmed that the upstream hosted workflow's historical `latest` policy failure and pending immutable GitHub-release verification do not block this consumer implementation.
Reuse the already qualified published dependency; neither status requires requalification of unchanged producer code.

The canonical-origin live path now implements `openCanonical`, `inspectModel`, `editModel`, `captureModel`, `checkpointModel` and `readmitModel` on the existing root surface.
It reuses the retained-model validators, atomic normalizer, occurrence projection and canonical encoder.
Live editing and checkpoint recovery do not run RDFC; encoding authority remains separate and local to the root module instance.
Checkpoints validate closed version/policy/implementation identity, revision, origin, structure, complete occurrences and one support record per retained record.
Original source coverage remains unavailable for canonical-origin models.
The checkpoint digest describes ingress and is not an authenticity certificate for transported state.

The isolated worker boundary can open canonical content into a live checkpoint, recover, edit and capture it using per-operation workers.
The client copies checkpoint requests and only transfers disposable output byte buffers; accepted recovery state is not detached.
The production controller and preserved document-session prototype have not yet been switched to this path.

Focused package/worker tests cover zero-RDF-budget recovery/editing, forged tokens, separate module instances, malformed checkpoints, cancellation, resource limits, failed edits/capture, complete artifact placements, hidden state, symmetric anonymous records, annotations, property chains and inverse projection.
The package regression run passed all 21 suites / 6,938 tests after the shared-normalizer fix.
Claude Code performed one read-only review (about 136 seconds) and one finding-only follow-up (about 108 seconds), both within their ten-minute ceilings.
It found five issues in predecessor-handle reservation, artifact scene handoff, support correspondence, revision binding and pre-clone input limits; all five were fixed with targeted regression cases, and the follow-up marked them resolved.
The follow-up also identified an unmeasured optional-field gap; the client subsequently closed its checkpoint request grammar and measured the complete allowed payload, with a specific regression.
No additional independent review cycle was run.
Raw review records are retained in the external `live-recovery-20261003-01` directory alongside the earlier operator evidence.

The reusable `packages/vowl/test/browser/live-recovery.html` harness passed five checks in isolated Chromium 154: byte-identical artifact/hidden-scene round-trip, a separate-worker edit without RDFC, native structured-clone checkpoint recovery, worker-entry stale-revision rejection and preservation of accepted state/buffers.
Two earlier injected-script attempts were interrupted by Vite dependency-optimization reloads; the statically imported harness resolved that setup issue.
Its passing run reported no console errors or warnings.
This is qualification of the isolated canonical-origin path, not evidence that the six OWL examples or production application integration have qualified.
OWL-origin evidence, compatible ingress/artifacts, ordinary-input canonicalization performance and complete application integration remain outstanding.

### Checkpoint-backed application session on 3 October 2026

The application-session prototype now retains a live inspection and checkpoint instead of canonical bytes as its editing state.
Every edit or capture readmits that checkpoint in a fresh operation worker; ordinary editing no longer needs an RDFC pass.
Scene management now accepts the package's occurrence inventory directly, with visualization passed explicitly, and owns no semantic document or admission authority.
Successful loads retire old generation-scoped targets; rejected replacement loads preserve the previous model, scene and target associations.
Edit acceptance checks worker context, the successor model revision, complete correspondence, rendering preparation and scene reconciliation before replacing accepted state.
Only one capture may be pending, and another semantic mutation cannot allocate a competing checkpoint snapshot during capture.

Six session tests qualify checkpoint editing, complete-scene capture/reload, recovery after capture failure, failed replacement/render preparation, late worker responses, cancelled merge decisions, revision mismatch and bounded capture concurrency.
Together with the existing scene and worker tests, the focused run passed 26 tests.
The extended real-browser harness passed ten checks in Chromium 154 with no console warnings/errors, adding session edit/capture/reload through real module workers and old-target retirement.
This initial run validates the session seam for canonical ingress; the subsequent OWL-origin increment is qualified below.

### OWL-origin live recovery on 3 October 2026

The existing `vowl/owl` surface now exposes `openOwl`, using compatible preparation and root-instance-specific live admission without canonicalization.
The live checkpoint owns exact acquired source bytes, digests, import edges and historical owning parser/profile evidence.
Recovery snapshots all source buffers before asynchronous digest verification and readmits the closed structural/support contracts without parsing or network acquisition.
Inspection labels generated OWL records honestly and reports unavailable exhaustive statement provenance.
Unresolved source-dependent mutations fail atomically; unrelated insertions remain available.
The worker transport bounds nested source buffers before copying them and accepts them only at the source archive byte fields.

A focused run passed 60 tests across live model, OWL live model, compatible loading and worker boundaries.
The extended Chromium 154 harness passed twelve checks with no console warnings/errors, including imported OWL loading and source-preserving recovery after editing across distinct workers.
One pinned six-closure pass admitted every example, inserted an unrelated class, and recovered identical inspection plus retained sources with RDFC work disabled.
Measured open times were 280–2,419 ms, edit times 27–188 ms and checkpoint/recovery times 26–207 ms on this host.
The external `live-recovery-20261003-01/owl-live-results.json` records each input hash, import call, record count and timing; the runnable probe is adjacent.
These measurements qualify that live path, not a general performance guarantee or completed renderer/export qualification.

Compatible portable capture remains unfinished.
An OWL-origin token currently rejects v1 capture with `CAPTURE_QUALIFICATION_UNREPRESENTABLE`, preventing qualification loss during prototype development.
This temporary boundary cannot satisfy the final save/export acceptance requirement and is not a proposed product restriction.
The new mapping remains independently gated, and production controller cutover remains outstanding.

### Compatible OWL preparation on 3 October 2026

The internal compatible preparation path now shares the existing explicit-format, resolver-only, aggregate-budget loader and retained-model builder.
It uses owlapi's `compatible` mode, retains its structured diagnostics and per-document public loader metadata, and carries the public profile/source assessment separately from typed projection.
The existing canonical `fromOwl` path continues to select `preserve` mode and apply its existing admission rules.
Neither path retries through the other.
Compatible loading without a source-structure extension maps the public typed OWL axioms; it does not manufacture source assertions or claim exhaustive source coverage.

A single bounded local pass prepared all six pinned closures using the retained exact-IRI import catalogue and verified source hashes.
FOAF, GoodRelations, MUTO, matched OntoViBe, Personas and SIOC completed in approximately 1.05, 2.30, 0.28, 0.49, 0.95 and 1.08 seconds respectively on this run.
OntoViBe and Personas each included their pinned imported document; no network fallback, missing-import exclusion or source rewrite was used.
The pass performed typed normalization/projection without canonicalization; these timings are not RDFC or browser-rendering performance evidence.
Every RDF document reported zero unparsed triples in this pass, while parser/profile qualifications remained available.
Zero unparsed triples is not a losslessness certificate.

The exact source identities, acquisition calls, counts, assessments and diagnostics are in external `live-recovery-20261003-01/compatible-closure-results.json`; its runner and three consumer implementation hashes are retained alongside it.
These original source files remain local/read-only and their redistribution rights have not been newly qualified.
This later preparation increment was not included in the completed Claude review of live recovery.
It remains internal: public OWL-origin live admission, source/qualification persistence, edit qualification, new artifact encoding, matched pre-fork operation comparison and full example acceptance are still delivery work.

### Compatible source retention on 3 October 2026

Compatible preparation now retains an immutable plain-data evidence snapshot and privately owned source bytes.
It copies public parser diagnostics, profile/source assessments, projection diagnostics and per-document RDF metadata without invoking JSON serialization hooks or retaining dependency instances.
Each document retains its exact acquisition IRI, media type, format key and SHA-256 digest; byte retrieval returns a defensive copy.
This is internal preparation, not a new public admission API or a portable source archive.

Import evidence combines public import declarations, ontology identities and observed resolver responses.
It preserves redirected acquisitions and cycles without inventing an association to a particular RDF header.
An explicit missing-import diagnostic takes precedence over an ontology with a matching identity loaded later.
When two requests resolve to an already loaded document, retention selects the first bytes actually parsed, not a later unused resolver response.
Exhaustive source coverage remains explicitly unavailable; empty unparsed-triple arrays still do not establish losslessness.

The focused suite now has thirteen passing cases, including defensive byte ownership, plain-data transfer, exact unparsed literal text, missing-import history, cyclic/redirected imports, repeated document acquisition and rejection of unexpected accessor payloads without executing them.
A single additional six-closure preparation pass passed within the unchanged default budgets, retaining the same structural counts as the earlier pass.
Its script and source-bound results are `qualify-compatible-evidence.mjs` and `compatible-evidence-results.json` in the existing external `live-recovery-20261003-01` evidence directory.
The extended browser harness passed seven checks in isolated Chromium 154, including native cloning of the source-evidence snapshot and transfer of a disposable byte copy while the original remained retrievable.
Initial page loads were interrupted by stale Vite optimized-dependency URLs; restarting with identical arguments after optimization completed resolved that setup failure without configuration changes.
The passing page had no console warnings or errors.
The full regression suite passed 147 suites and 8,864 tests; documentation formatting and the production build passed.
No independent review of this increment or integrated application, source checkpoint, compatible artifact or save/reload acceptance is claimed.

### Upstream delivery received on 2 October 2026

Owlapi [PR #27](https://github.com/Hadden-Industries/owlapi/pull/27) is merged into remote main at `19cf43d4288d20a737ecac0a39ccd1c53f9a3e77`.
Its tree is `55111092290a538a3a9eee710a75ac45ffbab951`; reviewed source head `63490d2cad24db41a92d949288337925e7d1a442` is retained in its ancestry according to the upstream delivery handoff.
The merge commit/tree and its published contract were checked locally during this documentation update.
This merged pin supersedes the earlier branch pin `e90aa883a17c38713707934f34ea2838b2529528` as the consumer integration target.

The authoritative [RDF parser metadata contract](https://github.com/Hadden-Industries/owlapi/blob/19cf43d4288d20a737ecac0a39ccd1c53f9a3e77/docs/compatibility/rdf-parser-metadata.md) delivers Java-compatible historical metadata and the two owning-parser repairs:

- `manager.getOntologyFormat(ontology)?.getOntologyLoaderMetaData()` exposes `RDFParserMetaData`; its types are public root and `/io` exports.
- Loaded RDF formats are immutable per-document copies; compare `format.key`, not registry-object identity.
- Metadata reports unique reconstructed triples, observed header state, unparsed triples and guessed roles; blank-node labels remain document-local and literal lexical text is retained.
- Compatible-mode IRI-valued imports from secondary headers and headerless statements use ordinary recursive loading, limits and cancellation.
- Inverse/characteristic propagation repairs the missed OntoViBe inverse, functional, domain and range axioms. Existing strict/preserve distinctions and range-only behavior remain.

The upstream handoff reports [PR CI 36985769536](https://github.com/Hadden-Industries/owlapi/actions/runs/36985769536) passing Node 22/24, Windows/macOS package checks, Chromium/Firefox/WebKit and isolated WebVOWL qualification.
[Main CI 36987533738](https://github.com/Hadden-Industries/owlapi/actions/runs/36987533738) passed with `REUSED` proof from that PR; [main CodeQL 36987533788](https://github.com/Hadden-Industries/owlapi/actions/runs/36987533788) passed freshly.
These are upstream reported results, not tests rerun in this checkout or acceptance of the unimplemented compatible-view consumer.
The final upstream release-tooling repair defers registry clients until live verification, retaining signature/provenance checks and changing no packaged files, according to that handoff.

Candidate-2 remains the retained local `@hadden-industries/owlapi@0.1.0-rc.1` tarball at `C:/Users/maksy/.hi/w/e/task-artifacts/owlapi-rdf-consumer-6c715658/candidate-2/hadden-industries-owlapi-0.1.0-rc.1.tgz`, SHA-256 `59744b8d3a65ee8b6c0e41b963ada4132a128f083f7612442bd4abb46da96b7a`.
Its digest was verified during the earlier handoff; it is an integration test input, not an npm publication.
The implementation evidence in that same task-artifact directory records completed security review with zero findings, retaining the original scan snapshot and explicit final-repair coverage; the earlier pending-status discrepancy was reconciled.

No npm publication or maintained consumer dependency change occurred.
Both WebVOWL dependency declarations still name Git revision `3097c6af1e7f47f97f5d90dd23915d83a5bb1489`; their exact update and corresponding lock graph remain awaiting configuration approval.
An eventual native npm alias is a separate distribution transition, not implied by approval of a Git-pin update.
One installed module identity and worker/bundler resolution must be qualified after the authorized change.

This delivery satisfies the narrowed producer requirements for beginning integration.
VOWL still owns acquired-source retention/accounting, interpretation qualification, projection, live admission/editing, checkpoint/readmission, versioned artifacts and canonicalization performance.
Metadata is historical and neither an exhaustive assertion ledger nor losslessness/admission authority.
Compatible header/category selections must remain visible as qualified interpretations; do not demand a neutral OWL model or VOWL-specific upstream accounting API.
The [amendment boundary reconciliation](../specs/2026-10-02-canonical-vowl-compatible-view-amendment-draft.md#14-upstream-contract-reconciliation) governs dependent work.
Application acceptance must identify the exact WebVOWL revision/tree and owlapi artifact; isolated upstream consumer tests do not complete SLICE-005.

### Preserved partial application implementation

The dedicated single-job worker performs byte admission, OWL ingestion, named legacy migration, editing and artifact capture through the package's public surfaces.
The client owns termination, the whole-job deadline, generation/revision context and aggregate root/import acquisition bytes.
Caller-owned import acquisition receives the exact importing document context and cancellation signal.
Transferred buffers are copies; caller source and accepted document bytes remain available after cancellation.

The application display module executes the 46 independent shared display vectors.
The complete-scene registry retains hidden placements, uses operation-local edit correspondence, rejects incomplete correspondence, stages conflicting merges without live mutation and invalidates prepared decisions after scene changes.
These modules are not yet wired into the production controller/renderer/editor path.
Their focused tests and the browser worker probe do not establish complete SLICE-005 acceptance.

## Shipped historical assets

All nine bundled JSON files were probed without mutation through the public `migrate` operation, using the sole accepted historical dialect and the structural profile with no caller resolutions.
Every probe rejected with `MIGRATION_AMBIGUOUS` at the first pointer below.
This is a compatibility probe, not a claim that the assets belong to that dialect or that resolving only the first failure would qualify them.

| Asset                | First rejected pointer                    |
| -------------------- | ----------------------------------------- |
| `benchmark.json`     | `/class/9/individuals/0/iri`              |
| `foaf.json`          | `/header/description/undefined`           |
| `goodrelations.json` | `/header/other/homepage/0`                |
| `muto.json`          | `/header/description/undefined`           |
| `new_ontology.json`  | `/header/description/en`                  |
| `ontovibe.json`      | `/header/other/backwardCompatibleWith/0`  |
| `personasonto.json`  | `/classAttribute/0/description/undefined` |
| `sioc.json`          | `/header/other/seeAlso/0`                 |
| `template.json`      | `/class/0/id`                             |

FOAF, GoodRelations, MUTO, OntoViBe, Personas and SIOC identify OWL2VOWL 0.3.7 and WebVOWL exporter 1.1.7 in their comments.
Those comments are provenance clues, not proof of a complete supported dialect.
`new_ontology.json` is an authored editor starter; `template.json` contains placeholder identifiers and is not a valid ontology input.
The WebVOWL repository contains no matching original OWL sources for those six named examples.
The owner subsequently authorized qualifying the versioned originals in `C:/Users/maksy/GitHub/universal-ontology/src/external` and regenerating examples with fresh layouts and reported content differences.
That repository was inspected read-only at HEAD `83a5d7d5306a0752f20f9abd553aeacc49ed70cb`; its unrelated `skills-lock.json` modification was preserved.

The canonical source route must not guess this older dialect from JSON shape, silently discard semantic fields, or relabel the files as canonical input.
The accepted direction is to qualify original OWL sources and explicitly regenerate the example visualizations, retaining the old files until the separately authorized legacy retirement.
Such regeneration cannot promise the exact historical graph, annotations or arrangement without matching versioned sources and correspondence evidence.
Additional migration-dialect implementation is a separate scope decision under the implementation plan.

### Original-source qualification and remaining disposition

The public OWL adapter was run on the six indicated original files with explicit formats and acquisition IRIs from their `.url` companions.
No source file, parser policy or resource ceiling was changed.
`original-owl-qualification.json` retains source SHA-256 values and outcomes.

| Source                       | Observed outcome                                                                                                                                                                                                                 |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `muto.rdf`                   | Passes the default compatibility mapping unchanged: 46 roles, no diagnostics.                                                                                                                                                    |
| `foaf.rdf`                   | Owning preserve-mode parser rejects the conflicting data/object roles of `foaf:mbox_sha1sum`; the source combines a datatype property with inverse functionality.                                                                |
| `sioc.rdf`                   | Owning preserve-mode parser rejects `sioc:delivered_at`, explicitly written as both `owl:ObjectProperty` and `owl:DatatypeProperty`.                                                                                             |
| `goodrelations.owl`          | Full-source assessment rejects `xsd:time` with `RESERVED_ENTITY_IRI`. This datatype is outside the current owning OWL 2 datatype map.                                                                                            |
| `ontovibe_cardinalities.ttl` | Owning parser rejects the source's `owl:subClassOf` predicate. Its root is the cardinalities variant, not the root of the bundled historical OntoViBe example.                                                                   |
| `personasonto.owl`           | Hits `RDFC_RESOURCE_LIMIT` at the default 100,000 iteration ceiling. One bounded probe at the existing 1,000,000 maximum also rejects, after about 18.1 seconds. No additional retry or resource-policy amendment is authorized. |

The syntax/source diagnoses were checked through the public owning manager/profile APIs and against the exact source text.
They are not a claim that every remaining assertion in those files has been qualified.
The Personas result is retained in `personas-bounded-probe.json`.
Regenerating these five examples unchanged is therefore blocked.
The proposed unavailable-example disposition was not accepted: the owner challenged the regression against the previous converter.
That proposal is withdrawn pending compatibility/performance diagnosis.
The six sources form a real acceptance baseline; source-admission failures cannot by themselves justify removing established examples.

### Confirmed regression against the previous converter

The existing `src/owl2vowl/js/index.js` converter accepted all six exact originals using explicit formats/acquisition IRIs and its production `compatible` parsing policy.
The comparison used its single-document entry point with remote imports disabled, rather than claiming equivalence of fetched import closures.
The owner subsequently required full import-closure qualification through pinned local lookup resources, following the existing differential-test approach.
The root-only comparison remains diagnostic evidence only; neither its success counts nor Personas measurements qualify normal closure loading.
The repair plan now requires both converters to consume the same pinned recursive closure, with unexpected or missing fixture imports failing the qualification harness.
`previous-converter-comparison.json` retains its outputs' class/property counts, diagnostic records and local elapsed times.
The committed Java-reference fixture inventory also includes all six names; these fixtures were located but not regenerated or newly verified here.

- FOAF: 54 classes and 75 properties, with property-category and cross-category recovery diagnostics.
- GoodRelations: 109 classes and 250 properties, without diagnostics.
- MUTO: 16 classes and 26 properties, without diagnostics.
- OntoViBe cardinalities: 57 classes and 83 properties, with `RDF_UNCONSUMED_OWL_TRIPLE`.
- Personas: 99 classes and 229 properties, with `MISSING_IMPORT`.
- SIOC: 49 classes and 125 properties, with two `RDF_PROPERTY_CATEGORY_PUNNING` diagnostics.

Old successful output is acceptance evidence, not proof that the old converter retained every source assertion without repair.
The new canonical adapter's compatibility policy is narrower than the old parser's compatibility policy: its preserve-mode parser refuses ambiguous role selection before canonical mapping, and its full-source assessment rejects reserved unsupported datatypes.
The accepted canonical contract nevertheless explicitly permits independently identified multiple roles and unverified datatype literals, so each rejection must be traced against that promised recovery scope rather than dismissed as merely non-DL input.
The Personas failure is a separate canonicalization operating-envelope deficiency, not source invalidity; increasing to the existing maximum did not resolve it.

Required follow-up is a bounded, per-case diagnosis separating owning-parser limitations, adapter over-rejection, genuine unresolved source semantics and canonicalization cost.
Retain strict-mode guarantees and exact diagnostic preservation; do not silently enable the old lossy recovery path, edit original ontology meaning, increase ceilings, or remove examples as a workaround.
Any required mapping-policy or upstream contract amendment needs its exact owner decision before implementation.

## Evidence and remaining work

On 2 October 2026 the owner explicitly paused integration for a bounded compatibility repair plan.
That pause was recorded at generation 19; the later authorized generation-23 resumption is described above, and partial integration files remain preserved and uncommitted.
The [repair plan](../plans/2026-10-02-canonical-vowl-compatibility-repair-plan.md) records the six-source acceptance baseline, bounded diagnosis, proposed increments and decisions required before repair implementation.
The owner subsequently approved that plan, including the complete local import-closure baseline.
The [bounded diagnosis](canonical-vowl-compatibility-decisions.md) now records closure comparisons, the matching OntoViBe 2.2 source, Personas' imported-header failure and resource-limit reproductions with only eight or sixteen named disjoint classes.
These supersede the earlier source-selection assumptions without changing the retained historical probe results.
The standalone Personas first-degree probe completed without altering the execution guard or repository code: 6,834 quads, 1,638 blank nodes and 1,308 nodes in 58 first-degree collision groups.
It stopped before N-degree search; these observations do not establish a performance fix or a completed root-cause diagnosis.

External evidence directory: `C:/Users/maksy/.hi/w/e/operator-reports/canonical-vowl-01a0f1b9/slice005-20261002-01/`.
`worker-browser.mjs` and `worker-browser-result.json` record eight checks in isolated Chromium 153.0.8010.12, including the real module-worker boundary; there were no page errors.
`dialog-browser.mjs` and `dialog-browser-result.json` record isolated merge-dialog checks for accessible naming, required choices, keyboard selection, explicit application, focus restoration, Escape/Cancel and mobile horizontal fit, with retained screenshots.
These are component probes, not integrated application qualification or a complete accessibility audit.
No Firefox, WebKit, performance-envelope or independent-review completion is claimed.

Remaining work includes controller source/inspection/edit integration, occurrence-driven rendering, conflict interaction, artifact delivery, consumer contracts, shipped-asset disposition and consolidated independent qualification.
