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

### Post-checkpoint presentation and editing increment on 3 October 2026

Commit `d77183ffa4c4dc52048df39b6c40f8b1562c0257` records the compatible-artifact and application-foundation checkpoint and was pushed to `origin/feat/canonical-vowl`.
The following increment remains separate from production-controller cutover.

The drawing adapter now accepts explicit canonical replacement and revision requests, with exact load-generation/base-revision checks and owned copies of drawing data.
An in-place revision preserves the mounted SVG and paused state.
If native drawing fails after mutation begins, the renderer reinstalls the previous primitives, placements, pins, camera and display settings before reporting failure.
A recovery failure retires the accepted drawing context and is reported distinctly; it does not masquerade as a successful revision.

Session edits can now include synchronous native presentation before accepting the successor model, scene and editable-target registry.
Scene mutations and replacement/disposal reentry cannot interleave with that acceptance boundary.
Session loads with a renderer wait for presentation before acceptance and serialize presentation with recovery, so an obsolete load cannot restore its drawing over a newer accepted load.
Failed replacement preserves the semantic checkpoint and attempts one restoration of the previous drawing with its observed pause state.
Failed restoration reports both errors rather than retrying indefinitely.
Headless session use remains available for package/worker qualification.

Explicit legacy ingress uses the existing public migration operation with a caller-selected dialect, profile and resolutions, then opens the admitted result in the same live session.
The existing independent artifact vector verifies exact saved bytes, preserved migration diagnostics and subsequent editing; no duplicate migration corpus was added.
The first human editor mapper implements the accepted endpoint policy: explain unannotated inverse detachment, preserve the inverse partner's endpoints, retain supported endpoint annotations, reject annotated inverse removal without separate exact deletion, and assert only an explicitly chosen default endpoint.
The mapper prepares a proposal; the human explanation/confirmation interface and remaining editor mappings are not yet connected.

The Chromium 154 harness passed 23 checks with no console warnings or errors, including real worker edits, in-place native presentation, injected post-mutation revision/load failures, restoration and subsequent successful retry/reload.
The scope is the candidate session/runtime boundary, not full application acceptance, semantic selection/sidebar integration or export parity.
These checks do not extend the scope of the previously authorized Claude mapping review, and no additional independent review was run.

The subsequent semantic connection adds exact role-qualified entity references, retained details-only inspection and session-owned drawing bindings.
A coarse property reference resolves only when one semantic role matches; ambiguity is explicit.
Inspection and drawing use the same B4 label selector, while complete typed facts, assertion annotations, source qualifications and exact cardinalities remain available separately from the bounded relationship summary.
Glyph counts are separate from semantic-reference counts because an equivalence glyph can represent several entities and a subclass edge is not a property entity.
The extended Chromium harness passed 25 checks, including an application-command IRI edit, role-qualified native selection and arrangement references resolved by the accepted session.

The human-command boundary now prepares endpoint, IRI, label, insertion, deletion, metadata and characteristic changes against exact document revisions and semantic target tokens.
Pending inverse-detachment and deletion confirmations cannot authorize a replacement document.
Insertion selects its exact typed meaning after normalization, even when no new record is created, and explicitly supplied positions enter complete-scene initialization.
Deletion uses package-owned typed/signature dependencies and shared assertion-support rules, then confirms the actual pure edit result and annotation losses before acceptance; the application does not normalize a duplicate graph.
Metadata version text remains an annotation and preserves an existing version IRI.
Ordinary characteristic removal cannot discard assertion anchors.
The next increment qualifies exact subclass/disjoint/restriction row edits, copying shared restrictions for the selected assertion and preserving its annotations.
Restriction creation requires an explicit property choice; a disjoint fact does not acquire an inferred direction.
Compound label/IRI submissions execute as one package transaction.
Presentation-only language, display and hidden-occurrence changes now prepare both inspection and drawing before acceptance, preserve hidden placements and runtime identities, and do not increment the semantic revision.
The Chromium harness passes 27 scenarios, including native hide/unhide with retained arrangement.
Canonical save now uses the shared artifact service with exact worker bytes, `application/json` and `.vowl.json`; a session-to-service export/reload test verifies byte identity, and replacement cancellation remains active through hashing/publication.
The package dependency qualification passed 27 suites / 7,001 tests before the additional literal-ID dependency regression, which subsequently passed its focused suite.
These increments have focused tests and scoped lint evidence; earlier full-profile receipts do not cover these later changes.
Contextual datatype choices now retarget only the selected range or supporting cardinality assertion, preserving other uses, range annotations and exact large cardinalities.
Class deprecation remains an annotation; the existing attached-value-restriction guard and fixed-builtin restrictions remain explicit.
The owner approved adding the already installed `@hyperjump/uri` version `1.3.6` as a direct root dependency, with only the matching root manifest/lock entries changed and no dependency resolution changes.
Prefix add/rename/remove commands now change complete scene bindings atomically and preserve lexical IRI identity through the shared validator; they do not rewrite semantic records or require canonicalization during interaction.
The extended Chromium harness passes 29 scenarios, including native prefix validation and save through the real byte artifact service.
The application/runtime regression run passed 58 suites / 1,148 tests before the final prefix/sidebar extensions; those extensions have separate focused tests and all changed JavaScript passes scoped lint.
The subsequent Chromium harness passes 30 scenarios, including LaTeX export from the canonical drawing with the accepted compact-notation setting.
Property conversion now handles isolated object-property domain/range pairs and rejects conversions that would lose annotations or shared uses.
Post-edit selection follows operation-local correspondence, including normalization into an existing assertion; positioned commands use that same correspondence.
Inspection retains n-ary relation groups once and expands them only for requested details or bounded neighborhoods.
An inline 1,000-class equivalence fixture verifies linear relationship storage, alias search, bounded neighborhoods and complete single-element details without adding corpus files.
The consolidated focused run passed five suites / 140 tests covering inspection, runtime contracts, document sessions and editor commands.
Human menu/controller wiring, source/Turtle export integration and complete candidate qualification remain in progress.

The existing human editor sidebar now consumes controller-owned `getOntologyEditorView(recordTarget)` and `resolveOntologyEditorIri(input)` queries instead of reading or interpreting a `vowlModel`.
The editor view contains metadata, prefix bindings, the selected display row, property-row classification and any explicit generated-IRI base; it is presentation data and never admission or serialization input.
The canonical session projects that view directly from semantic records and disables ambiguous text annotations rather than silently choosing one for replacement.
These human-editor queries are not WebMCP tools; experimental ontology editing remains outside the agent tool surface.
Existing sidebar behavior and controller tests pass against the changed presentation boundary.

The separate candidate controller now owns explicit source acquisition, accepted-session loading, semantic inspection/editor queries, prefix edits and all five export paths: canonical JSON, current Turtle, original input, SVG and LaTeX.
It is not yet the production composition root or a complete replacement for every existing menu interaction.
Replacement acquisition cancels pending edits and publication immediately; a failed overlapping load restores the last accepted controller state rather than an intermediate loading state.
Native label, deletion and endpoint intents carry exact semantic targets and the originating document revision.
The label-plus-derived-IRI interaction prepares one atomic semantic batch using the explicit ontology/prefix context.
Retired selected targets are cleared after acceptance.
Drawing exports use the shared layout settler, wait for fonts and paint, and restore a temporary pause only while their document and explicit pause ownership remain current.
The browser controller probe exposed a shared settlement defect: a paused graph could retain a high force alpha and never satisfy the running-layout condition.
Paused layouts now qualify through the same eight stable geometry frames without requiring their inactive simulation to cool; running layouts retain both force and displacement conditions.
Focused regression tests cover this distinction, interrupted font readiness, publication cancellation and layout restoration.
Canonical native view readback now reports the accepted scene's label selection rather than stale legacy renderer language.
The extended Chromium 154 harness passes 45 checks with no console warnings or errors, including all five controller export paths through real workers and the native drawing, view controls, exact-loss confirmation and explicit local input selection.
Evidence is `controller-input-browser-result.json` in the existing external `live-recovery-20261003-01` directory; complete menu integration and broader application acceptance remain outstanding.
The preceding 42-check controls receipt also records manual confirmation-dialog inspection, expansion, Escape cancellation and focus restoration.

The candidate composition now supplies its controller, local-input selector and semantic confirmations to the shared human menus.
The owner approved the separate `canonical` build mode in `vite.config.mjs`.
It selects `src/canonical-main.js` before HTML processing, writes to the ignored `node_modules/.cache/webvowl-canonical` directory and preserves timestamps using Vite's resolved output directory.
The candidate build passes; production entry selection and deployment commands remain unchanged.
The selector lists OWL syntaxes from owlapi's public metadata and requires an explicit original document IRI for local OWL parsing, without inspecting JSON shape or inventing a base from the application URL.
It distinguishes canonical data from the one supported historical migration dialect.
Local files enter as owned bytes, preserving original line endings and encoding evidence; direct input enters as caller-supplied text.
The browser probe validates the syntax choices, rejects a relative document identity and opens a real local byte source before exporting its original bytes.
Cancellation before selection avoids reading the file, and cancellation during reading prevents source publication.
These routes do not yet qualify every bundled example or complete application initialization.

The native canvas now emits semantic creation intents with exact document revision and endpoint targets before changing the model.
Class and property creation collects explicit IRIs; datatype creation uses the full IRI of the chosen built-in datatype independently of source prefix declarations.
Restriction creation requires an explicit object property, while subclass/disjoint creation uses the exact selected endpoints.
Package normalization runs once, and selection resolves the resulting meaning through operation-local correspondence.
Existing normalized assertions retain their prior placement; new positionable occurrences receive the gesture position.
The current projection retains existential/universal restrictions as details-only facts and gives disjoint edges no independent label placement; the session tests distinguish these cases rather than manufacturing occurrences.
The candidate Ontology menu now exposes an Ontology facts dialog for these details, along with annotations, qualifications, diagnostics, coverage and source evidence.
The session pages admitted records directly without cloning source checkpoint bytes or using renderer data.
The dialog displays 25 records per page and expands nested fields on demand; all supplied text uses text nodes, including literal strings and IRIs.
Document replacement, revision changes and disposal retire the open view rather than presenting stale facts.
Chromium 154 qualification verified qualification expansion, both pages of the existing 40-assertion evaluation ontology, Escape cancellation and focus restoration to the Ontology button, with no console warnings or errors.
The exact-field viewer provides inspection access; usability of cross-record identifiers and the broader accessibility matrix remain qualification work.

Real candidate mounting exposed two first-paint defects: the default native renderability guard still required legacy data, and an unpaused canonical load hid complete geometry while waiting for force ticks.
The guard now recognizes canonical elements, and canonical drawings become paint-ready from their complete placements while an unpaused simulation continues.
This removes the dependency on background-throttled force ticks without increasing timeouts or changing the requested pause state.
Regression tests cover fresh and previously mounted graphs, both paused and running.
After these repairs, Chromium 154 passes all 47 live recovery checks with no console warnings or errors, including native datatype creation as one revision and unchanged original-source export afterward.
The receipt is `controller-creation-browser-result.json` in the existing external `live-recovery-20261003-01` directory.
Temporary diagnostic logging was removed.

The direct full repository run passed 164 suites / 9,076 tests before these final first-paint and creation regressions.
The affected session/native-renderer run then passed 44 tests, and the candidate build passed again.
These are direct checks, not refreshed governed full-verification receipts or an independent review of this increment.

Initial visualization requests now enter the candidate session's load transaction.
Language, visibility and portable display choices are prepared in the complete scene before mounting; native focus, viewport, label-width/pinning modes and force distances are applied before load acceptance.
The retained hidden set remains distinct from temporary filter choices, so revealing a filtered occurrence does not erase saved visibility state.
Failed initialization restores the previously accepted scene and native controls; it cannot publish a partially initialized successor.
The expanded Chromium harness passes 48 checks without console warnings or errors, recorded in `controller-initial-view-browser-result.json` beside the earlier receipts.
Its new check verifies initial language, compact notation, dynamic label width, force distance, zoom, translation and running-layout choice through the actual candidate controller and renderer.

The candidate's new-ontology command now collects an explicit absolute ontology IRI and optional title, then admits a small Turtle document through the existing OWL route.
It opens paused in editing mode and does not depend on the historical empty JSON preset.
Cancelling the form leaves the document and route unchanged; revisiting its unsaved route explains that the URL does not contain the ontology.
The source-admission test verifies exact identity, escaped Unicode title and empty occurrence inventory, and the loading test verifies cancellation and the paused load request.
Manual candidate UI qualification verified both the new ontology's IRI and title in the editor.
The untagged metadata presentation now uses the shared language utility's `undefined` key; a regression checks the actual language selection instead of only the intermediate object shape.
Fresh scenes now start at the known viewport center, while saved scenes retain their camera.
The regression covers an 800 by 600 viewport; the built evaluation ontology also placed all four named nodes inside the observed viewport.
Remaining canvas creation and complete export/reload interaction qualification are still required.

File, paste and new-ontology requests now share input supersession in the loading adapter.
New requests, controller loads and disposal abort pending selection dialogs, while revision-independent sequence checks prevent adapters that ignore cancellation from publishing stale input.
Closing direct input also aborts its selection without reporting cancellation as a load failure.
The focused input run passed 43 tests; the subsequent facts/session/controller/input run passed 94 tests, and the separate candidate build and scoped JavaScript, HTML and CSS checks passed.
The consolidated direct repository run then passed 165 suites / 9,099 tests in 139.94 seconds.
Its `docs/broken.md` and package README formatting messages are deliberate formatter-test fixtures, not failures in the repository documents.
These checks do not refresh governed receipts or constitute independent review.

Visibility controls operate on admitted occurrences and close dependent edges and labels; they preserve saved hidden occurrences until reset and do not invoke legacy topology filters.
Edits prepare visibility for new occurrences before committing the successor drawing.
A show-and-focus request resolves visibility after applying its view changes, and semantic selection follows stable editable targets through IRI changes.
The controller regression covers both interactions with a real package session.

### Approved bounded export interface amendment

The accepted operation matrix requires original-input download and Turtle export of current retained semantics.
Before this amendment, the public live surface provided admission, inspection, editing, capture, checkpoint and recovery, without source-byte retrieval or a semantic RDF serializer.
Inspection is not an admission token, checkpoints are recovery data, and the native drawing lacks retained facts.
Serializing the canonical protocol dataset as ontology RDF or rebuilding the legacy model would violate those ownership boundaries.
The native renderer rejects canonical Turtle snapshots; the session instead exports the complete accepted model through the package.

The owner approved the following bounded amendment on 3 October 2026:

- Add `readModelSource(model, documentId, options)` to the existing `vowl` surface.
  It accepts a locally admitted model, an exact source-document ID from inspection, and only `signal`/`limits` options.
  It returns an owned `{bytes, documentIri, mediaType, digest}` snapshot of the original acquisition, never an edited ontology.
  Unknown IDs and unavailable source bytes fail explicitly; reopening a portable artifact must not manufacture source access.
  Editing and checkpoint recovery retain original source identity and bytes.
- Add `exportModelRdf(model, options)` to the existing `vowl/owl` surface.
  It accepts a locally admitted current model and only `signal`/`limits` options, and returns owned UTF-8 Turtle bytes plus a closed output-scope report.
  The report identifies current revision, flattened retained closure scope and whether retained qualifications are present; output is not described as lossless source recovery or a portable qualification artifact.
  Package-owned mapping includes current structural assertions, annotations and expressible retained RDF statements, with collision-free source-document blank-node scopes.
  It must not select a property category to resolve an ambiguity, substitute original bytes for edited content, or emit a partial success when retained semantic content cannot be represented.
  Such content produces an explicit bounded representability failure identifying affected records before publication.
  Existing finite operation limits, cancellation, immutable input ownership and admission-first validation apply; canonical bytes and existing profiles do not change.

Qualification must cover edited labels/endpoints, anchored annotations, n-ary facts, exact literals and large cardinalities, retained qualified RDF, blank-node scope collisions, unavailable originals after portable reopening, checkpoint recovery, byte ownership, cancellation and atomic publication.
No configuration change, additional export surface or dependency is proposed.
This resolves the additional public-stage decision reserved by SLICE-005.
The package now implements both operations, with original bytes isolated from edited output, and the application worker/session connects both to the existing publication service.
The serializer follows the [OWL 2 structural-to-RDF mapping](https://www.w3.org/TR/owl2-mapping-to-rdf/) and emits the explicit-triple subset of [RDF 1.1 Turtle](https://www.w3.org/TR/turtle/).
The installed owlapi public save path serializes its structural ontology model, while this export must also account for VOWL's retained qualified RDF statements.
Its public IO entry point does not expose a generic triple writer; the bounded explicit-triple emitter therefore lives with the complete retained model in `vowl/owl`, without a private upstream import or controller-owned semantic translation.
Initial focused tests cover 16 expression families, edited semantic round-trip with anchored annotations and exact large cardinalities, source-byte ownership/recovery, portable source unavailability and session publication of originals separately from edited Turtle.
The extended tests cover 17 annotated assertion forms with nested annotations, document-scoped residual blank identities, exact residual literal lexicals, graph-scope rejection and publication cancellation for both export operations.
The real-worker Chromium harness passes 32 scenarios, including exact original download after editing and edited Turtle download containing the imported closure, with no console warnings or errors.
All six pinned closure examples export and reopen after an unrelated edit with identical retained structural/topology identity under a canonical comparison using constant synthetic qualifications and a uniform fresh scene.
That comparison intentionally excludes historical provenance and does not claim equality of original-source qualifications.
Evidence is `semantic-export-browser-result.json`, `turtle-closure-results.json` and `turtle-structural-identity-results.json` in the existing external `live-recovery-20261003-01` directory.
The broader selected package/application run passed 65 suites / 7,915 tests before the subsequent cancellation and input-acquisition extensions; later extensions have focused tests and still require consolidated final verification.
Complete candidate UI wiring and full export acceptance remain unfinished.

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

On 3 October, `util/regenerateCanonicalExamples.mjs` generated all six compatible artifacts from the pinned recursive closure inventory, using exact source hashes and refusing unexpected imports.
Each artifact passed canonical readmission with the default resource limits.
The generator uses a fresh deterministic 400-tick force layout; it does not copy historical positions or rewrite historical files.
The candidates and full named-IRI difference report are retained outside the repository in `live-recovery-20261003-01/regenerated-examples-01/`.
Their exact bytes are now copied into `src/canonical-examples/`, and the candidate composition resolves the six existing named routes to these assets.
Only the candidate entry imports their URLs; the production static asset directory and historical files remain unchanged.
Original OWL bytes are not embedded in these portable artifacts.

| Example       | Historical named IRIs | Current named IRIs | Historical IRIs absent | Rendered nodes | Rendered labels |
| ------------- | --------------------- | ------------------ | ---------------------- | -------------- | --------------- |
| FOAF          | 84                    | 96                 | 0                      | 60             | 82              |
| GoodRelations | 143                   | 209                | 0                      | 113            | 251             |
| MUTO          | 32                    | 46                 | 0                      | 22             | 26              |
| OntoViBe      | 83                    | 109                | 0                      | 61             | 49              |
| Personas      | 125                   | 147                | 0                      | 114            | 238             |
| SIOC          | 115                   | 126                | 0                      | 64             | 127             |

The name comparison is a coverage check, not proof of relationship or annotation equivalence.
The counts above come from successful Chromium 154 loads through the built candidate's normal remote-canonical route, with no console warnings or errors.
That first browser pass used temporary copies in the ignored candidate build output; qualification of the named preset routes follows separately.
The later named-route pass also loaded all six through their unchanged `#foaf`, `#goodrelations`, `#muto`, `#ontovibe`, `#personasonto` and `#sioc` routes, with the same node/label counts and no console warnings or errors.
The [regeneration report](canonical-vowl-example-regeneration.json) records exact root/import and artifact hashes, full named-IRI additions/omissions, record counts and qualification codes.
OntoViBe first exposed a consumer defect: `data-some`, `data-all`, `data-value` and data cardinality restrictions were misclassified as datatype references by a string-prefix test.
The inspector now classifies the five actual data-range expression kinds explicitly; data-property restrictions remain class expressions.
A minimized functional-syntax regression reproduced the original superclass-reference failure and now passes for all six restriction forms while retaining data-union as a datatype.
The affected inspector/session/controller run passed 46 tests and the rebuilt OntoViBe UI passed.

Redistribution qualification is not completed by these technical checks.
The SIOC publisher's [specification source at its inspected revision](https://github.com/rdfs-org/rdfs.org/blob/d4bbbdf00eb50377f7ad334099da6d053566aeed/sioc/spec/sioc.html) links CC BY 1.0 for the specification/documentation and explicitly distinguishes ontology terms and technology from that copyright notice.
The [DCMI schema notice](https://www.dublincore.org/about/copyright/index.shtml/) supplies attribution requirements for DCMI-hosted schemas; it does not by itself establish the provenance or licence of the Stanford adaptation `protege-dc.owl`.
That import's exact redistribution evidence remains unresolved; no source substitute or inferred licence has been applied.
Keep publication of the candidate asset set gated on completing its notices and import provenance.
The local candidate implementation is not a claim of redistribution clearance.

Root-source notice inventory for completing the candidate distribution:

| Example       | Attribution and identified notice                                                                                                                                                                                                                        |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FOAF          | Dan Brickley and Libby Miller; the [FOAF specification](https://xmlns.com/foaf/spec/) applies [CC BY 1.0](https://creativecommons.org/licenses/by/1.0/) to the specification and accompanying RDF.                                                       |
| GoodRelations | Martin Hepp; the pinned root declares [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) and requests: “This work is based on the GoodRelations ontology, developed by Martin Hepp”, with a [GoodRelations link](http://purl.org/goodrelations/). |
| MUTO          | Steffen Lohmann; the pinned root declares [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/).                                                                                                                                                     |
| OntoViBe      | Florian Haag and Steffen Lohmann; contributor Stefan Negru; root version 2.2 declares [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The imported module also needs its own recorded provenance/notice assessment.                           |
| Personas      | Stefan Negru; contributor Sabin Buraga; the pinned root declares [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/). The Stanford Dublin Core import has the unresolved provenance noted above.                                             |
| SIOC          | Data Science Institute (formerly DERI), NUI Galway, copyright 2004–2018; the publisher's specification notice and its scope are identified above.                                                                                                        |

The changed representation, retained qualifications and fresh layouts must be identified in the distributed notices; none of these examples is claimed to be an unchanged original file or endorsed by its authors.
The earlier source-admission failures below are historical diagnosis, superseded by the compatible capture and browser results above.

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

### Integrated import choices and merge interaction

The candidate now asks for an explicit syntax when root or imported acquisition metadata is ambiguous, using owlapi's public format metadata.
The acquired document IRI remains read-only in that prompt.
Root selection precedes worker admission; an ambiguous import cancels its current admission attempt before the compatible loader can accept an unresolved-import qualification.
After the choice, admission resumes from owned cached bytes rather than fetching that document again.
Only this explicit format-choice continuation is retried; unrelated failures propagate.
Per-load aggregate byte and import-count limits survive the continuation, and acquisition budget failures cannot be downgraded to missing-import qualifications.
Cancellation retains the previously accepted document.

The candidate composition now connects the existing merge-choice dialog to session reconciliation.
Both predecessor and successor descriptions use the existing application display projector; named members include their full IRIs.
The preview used to describe the successor does not select or commit an arrangement.
Apply remains disabled until every conflict has a user selection; Cancel leaves the live model and complete scene unchanged.
The existing editor prohibition on renaming a subject to an already used IRI remains unchanged.
An initial browser probe through that prohibited rename correctly failed, so the merge qualification uses the session's atomic edit boundary rather than broadening editor scope.

The real Chromium 154 worker/rendering harness passed 54 checks, including ambiguous-import selection without refetch, human-readable merge predecessors, cancelled-merge preservation and a single accepted revision retaining the chosen pinned position.
No console warnings or errors were reported.
This qualifies the session/dialog integration and candidate composition wiring, not every canvas gesture or another browser engine.
The browser result was inspected inline; the browser tool refused file output, so no new saved browser receipt is claimed.
The focused acquisition, controller and session run passed 64 tests.
The export menu also now explains when original input bytes are absent from a reopened portable document instead of silently hiding that export's availability.
The rebuilt FOAF candidate was inspected with that explanation visible and the unavailable download controls hidden.

The extended browser harness subsequently passed 58 checks without console warnings or errors.
It reconstructs the existing independent `named-class-artifact` witness from the compact corpus and verifies its pinned input hash before migration.
The controller then loads the explicitly named legacy dialect, restores its paused camera and pin, edits the class IRI, exports canonical JSON, decodes the edited meaning and reopens the saved document with its pin retained.
No additional stored test corpus was generated.
The final extension passed 61 checks with no console warnings or errors: the native property-endpoint command retained an annotated domain assertion, the deletion dialog displayed the exact annotation loss before mutation, and confirmed deletion committed one revision through the controller.
Together with the existing native datatype insertion scenario, these exercise the required insertion, deletion and annotated-endpoint paths through the real worker and mounted renderer.

The consolidated direct repository run passed 165 suites and 9,106 tests in 160.123 seconds.
The later browser-only harness extension passed its scoped formatter/linter and real browser run.
Both the ordinary production build (including application formatting and HTML/CSS/JavaScript lint) and the separate candidate build passed.
Documentation checks passed across all 61 authored documents.
The production build retains its existing large-chunk warning.
These results remain distinct from governed verification, independent review and controlled cutover acceptance.

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
That historical component pass did not establish Firefox, WebKit, a performance envelope or independent-review completion.
The later cross-browser results and bounded review disposition are recorded below and in the slice checkpoint.

The candidate now has the implemented source/inspection/edit integration, occurrence-driven rendering, conflict interaction and export routes described above.
The local SLICE-005 candidate is assessed separately from redistribution: the six examples have an explicit regeneration disposition, while their publication notices and import-rights evidence remain open.
The earlier status incorrectly treated that publication obligation as preventing completion of the local candidate; the accepted SLICE-005 exit requires the candidate and an asset disposition, not publication clearance.
See the [SLICE-005 checkpoint](canonical-vowl-slice005-checkpoint.md) for the final verification boundary and authorized pause.
The owner has waived full independent coverage of this consolidated post-checkpoint increment, as recorded below; the partial Claude coverage no longer blocks this increment.
The historical developer benchmark is not a supported named-dialect input; production already removes it from its output.
The six named public examples have the regenerated candidate routes recorded above, while their historical files remain intact.
Initial browser/runtime, accessibility and resource observations have been collected without accepting SLICE-006 or changing production.
Complete operating-envelope acceptance, freeze/publication and production cutover remain later gates.

### Owner-approved bounded Claude integration review

The owner approved one read-only Claude Code integration review capped at fifteen minutes, with no automatic retry or follow-up.
The pass completed in 181.91 seconds using `claude-opus-5-5` and only Read/Grep/Glob tools.
The reviewed base was `d77183ffa4c4dc52048df39b6c40f8b1562c0257`, including the working-tree delta and listed untracked candidate modules; before/after SHA-256 inventories confirmed unchanged source throughout the pass.
The unrelated `skills-lock.json` deletion remains outside implementation and review scope.
Exact prompt, tracked patch, provider output, stderr and source inventories are retained as `claude-integration-review*` in the external `live-recovery-20261003-01` evidence directory.
No second reviewer invocation was run.

The reviewer did not recommend acceptance as-is and explicitly reported partial coverage.
Implementation-worker disposition of its five findings:

1. **Mixed-case label/title language comparison: not reproduced within admitted inputs.**
   The reviewer inspected validation but missed the lowercase value returned by `typedValues.js` for `LanguageTag` and `LanguageRange`.
   A regression submits mixed-case label and title values through package editing, verifies lowercase inspection, and replaces both using a differently cased selection without duplicate assertions.
   No editor comparison or wire contract was changed.
2. **Routine checkpoint cloning: repaired.**
   Session identity reads now return only generation/revision; semantic inspection is cloned separately only when needed, and original-source availability is projected from metadata without copying bytes.
   Controller currentness checks and repeated drawing-export guards use the cheap identity accessor.
   A regression verifies identity and source-availability queries never call `structuredClone`.
   This removes avoidable archive copies; it is not a measured performance-envelope claim.
3. **Local file read before size enforcement: repaired.**
   The selector checks `File.size` against the owning loader's current input-byte limit before opening the syntax dialog or calling `arrayBuffer`.
   The regression first reproduced the missing rejection and now verifies rejection without a file read or prompt.
4. **Unrelated failure during a format-choice continuation: narrowed.**
   A new attempt requires both the format callback and an abort-shaped failure; an unrelated parse failure propagates even if a format request was pending.
   The controller regression covers this ordering and verifies that no prompt or retry occurs for that failure.
5. **Residual literal without datatype: excluded by admission.**
   The compatible source-statement grammar requires lexical value, datatype IRI and language; only direction is optional.
   Checkpoint source literals likewise require a named-node datatype.
   The suggested missing-datatype value cannot reach the public export through an admitted model, so no fallback literal or serializer shim was added.

The focused repair run passed 78 tests and the repaired application repeated all 61 Chromium harness checks without console warnings or errors.
The first governed affected run then exposed a declaration-order lint error in the new regression test through the development-server integration test; that test declaration was moved below its fixture declaration, and scoped lint passed before rerunning verification.
The reviewer did not examine the full session load/commit/rollback implementation, renderer, scene registry, merge reconciliation, most editor commands, worker protocol, several UI consumers, WebMCP changes, build settings, example assets or test files.
Those areas are explicitly **unreviewed by this pass**, not independently accepted.
The repairs above were verified by the implementation worker and have not received a further independent pass.

### Owner waiver of full independent coverage

On 3 October 2026, after receiving the bounded Claude review outcome, repaired findings and explicit coverage limitations, the owner instructed: “Waive full independent coverage for this”.
This waives the remaining independent-coverage requirement for the current SLICE-005 post-checkpoint integration increment and its finding repairs.
The existing Claude report, unexamined areas and implementation-worker dispositions remain unchanged as evidence; this is an accepted coverage limitation, not a claim of full independent review.
No additional reviewer or follow-up pass is required for this increment on coverage grounds alone.
The waiver does not apply to future increments or waive source fidelity, functional checks, shipped-asset notices, SLICE-006 qualification, or release and production-cutover decisions.

The repaired candidate passed the governed affected profile: 165 suites and 9,109 tests, run `cb8fbb10-d740-4287-bc33-53f8c2cb14fc`.
The governed full profile passed the production build and its application formatting/lint prerequisites, run `59dcc9c9-6ae3-4cfb-b217-10da1684a3a0`.
The candidate build, documentation checks and 61 real Chromium checks also passed.
These receipts predate this documentation-only waiver entry; no product code changed when recording the decision.
