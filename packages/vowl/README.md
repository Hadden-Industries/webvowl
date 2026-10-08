# Canonical VOWL (experimental)

Producer-neutral canonical VOWL for the proposed structural-content and artifact profiles.
This package is private while the [implementation plan](../../docs/plans/2026-09-24-canonical-vowl-implementation-plan.md) is being qualified.
Profile freeze, adapter qualification, browser application cutover and stable publication are separate gates.

```js
import { canonicalize, decode, edit, encode, profiles, VowlError } from "vowl";

const document = await canonicalize(source, {
  profile: profiles.structuralContent,
  signal,
  limits: { deadlineMs: 10000 },
});
const bytes = encode(document);
const verified = await decode(bytes, { signal });
```

`canonicalize` requires the complete normalized source, including every required occurrence and, for `profiles.artifact`, complete portable visualization state.
It snapshots ordinary data synchronously, validates the closed schema and graph invariants, applies RDFC-1.0 to the whole typed profile, issues category IDs and sorts sets, then admits a deeply frozen document.
It does not infer missing facts, repair invalid source, fetch imports or choose coordinates.
An ID is local to that admitted document; relabelling after a structural or artifact-state change is expected.

`decode` accepts a `Uint8Array` with exact canonical UTF-8 bytes.
It rejects duplicate decoded member names, noncanonical spelling/order/IDs, unknown fields, invalid graphs, unsafe/shared backing stores and exceeded budgets.
It never returns a repaired document.
`encode` accepts only a document admitted by this module instance and returns a fresh byte array.
Copying or freezing an object does not grant admission.

The approved [atomic editing amendment](../../docs/specs/2026-09-30-canonical-vowl-editing-amendment.md) adds `edit(document, changes, {signal, limits})` to the same root surface.
It owns normalization and occurrence regeneration and returns `{document, correspondence, created}` with an admitted structural document.
The application supplies complete artifact state after reconciling operation-local correspondence.
Commands are `insert`, `replace`, `remove`, `set-endpoint` and `set-ontology`; the amendment defines their closed shapes and annotation rules.
Removal does not implicitly cascade and an ambiguous annotated aggregate edit fails.

The compatible-view implementation now includes the canonical-origin live-model path on the root surface.
`openCanonical(document, {signal, limits})` requires local canonical admission and returns `{model, correspondence}`.
The opaque, immutable live token carries a revision; `inspectModel(model)` exposes frozen retained records, occurrences and support with original-source coverage explicitly unavailable.
It conveys neither source-preservation evidence nor canonical encoding authority.
Inspection also exposes `dependencies`, one `{record, requires}` row per semantic record, and `ontologyDependencies` for ontology annotations.
These include typed references, finite annotation/literal signature requirements, and exact declaration/direct/normalized-endpoint assertion support.
They are revision-local dependency information, not permission to cascade deletion.
Applications can prepare explicit removal batches from them, then inspect the pure `editModel` result and correspondence to describe all actual losses before accepting the candidate.
No dependency information changes frozen canonical bytes or grants encoding authority.

`editModel(model, changes, {signal, limits})` reuses the five-operation normalizer and returns `{model, correspondence, created}` without running RDFC.
`checkpointModel(model, {signal, limits})` returns a defensive session checkpoint; `readmitModel(checkpoint, {signal, limits})` validates its version, closed fields, normalized structure, complete projection and support references before returning `{model, correspondence}`.

`readModelSource(model, documentId, {signal, limits})` returns `{bytes, documentIri, mediaType, digest}` for an original acquired input identified by inspection.
The returned bytes are a disposable copy and remain the original input after edits; `SOURCE_DOCUMENT_UNKNOWN` rejects unknown IDs and `SOURCE_BYTES_UNAVAILABLE` reports portable models without an acquisition archive.

`exportModelRdf(model, {signal, limits})` on `vowl/owl` returns `{bytes, scope}` for the current retained semantic revision as UTF-8 Turtle.
The closed scope report contains `revision`, `kind: "flattened-retained-closure"`, `mediaType: "text/turtle"` and `qualified`.
This is an edited ontology export, not original-source recovery or a portable qualification artifact.
The package owns the OWL/RDF mapping and preserves expressible retained RDF without choosing a new property category.
Unrepresentable graph scope, directed literals or unresolved residual-to-structural blank-node identity fail with `RDF_EXPORT_UNREPRESENTABLE` before any publication.
The existing finite budgets and cancellation apply to both operations; neither changes canonical profile bytes.
Readmission performs no network acquisition or canonicalization.
The application must preserve and reconcile the complete scene alongside the checkpoint.

`captureModel(model, {profile, visualization, signal, limits})` validates and canonicalizes a snapshot, returning `{document, correspondence}` without replacing live handles.
`readModelRankingIdentity(model, {signal, limits})` returns `{revision, correspondence}` for occurrence handles and their structural canonical keys, including OWL-origin models.
It uses the producer's structural RDF mapping, compatible-mapping partition refinement and bounded RDFC issuance, without visualization, qualifications or source-archive metadata.
Ranking keys are not a promise of canonical v1 artifact IDs; the operation does not grant artifact authority, replace live handles or weaken capture qualification checks.
Cache keys by structural revision and handle failed/cancelled identity work without replacing the previous view.
Symmetric representations compare through the canonical isomorphism, not arbitrary source handles.
The visualization field is required for artifact capture and forbidden for structural-content capture.
Failed editing, recovery or capture leaves the previous model usable.
`openOwl(bytes, {documentIri, mediaType, resolveImport, signal, limits})` on `vowl/owl` now admits a compatible live model and returns `{model, correspondence}` without RDFC.
For live opening, `mediaType` is optional: omission delegates format recognition to the public OwlAPI loader, once, using the acquired bytes.
An explicit media type still selects exactly one owning parser; document/base identity remains required independently of format.
Live import responses likewise allow `{bytes, documentIri}` without a media type.
Retained evidence records the owning loader's actual format and its public primary media type when selection was automatic.
The source-preserving `fromOwl` contract still requires explicit media types for roots and imports.
It retains the acquired closure bytes and historical parser/profile reports in a defensive checkpoint, with digests verified on recovery.
Inspection exposes qualified interpretation and original assessment separately from current typed records; exhaustive statement-to-record provenance remains unavailable.
Edits depending on unresolved source interpretation fail atomically while unrelated edits remain available.
The root surface also exports the experimental `compatibleArtifactProfile` identifier, separately from the frozen v1 `profiles` inventory.
`captureModel(model, {profile: compatibleArtifactProfile, visualization})` captures retained structure, complete scene and portable interpretation qualifications together.
`decode`, `encode` and `openCanonical` support this profile; reopened artifacts remain editable through `editModel` and can be captured again.
The frozen `edit(document, ...)` operation still returns structural content and therefore rejects qualified artifacts; use the live-model editing operations to retain qualifications.
Explicit v1 capture of an OWL-origin or qualified model fails with `CAPTURE_QUALIFICATION_UNREPRESENTABLE` rather than discarding qualifications.
Portable qualifications retain selected ontology identity, document/import relationships and typed assessment details, but omit acquired bytes, retrieval locations, digests and diagnostic prose.
Reopened artifacts report original bytes and statement associations as unavailable; their claimed qualifications do not establish original-source authenticity.
Public unparsed RDF statements are retained separately from typed OWL, including document-scoped anonymous identity, exact literal lexical text, datatype, language and any reported direction.
They survive compatible capture and live reopening without acquiring an invented OWL interpretation or cross-document blank-node identity.
Edits whose dependencies touch these unresolved statements remain guarded after reopening; unrelated edits remain available.
This is not application cutover or completed compatibility qualification.

The experimental OWL adapter is available on the second public surface:

```js
import { fromOwl } from "vowl/owl";

const result = await fromOwl(owlBytes, {
  documentIri: "https://example.org/source.owl",
  mediaType: "text/owl-functional",
  resolveImport: async (importIri, { importingDocumentIri, signal }) => {
    // Apply your acquisition policy and return the exact bytes and format.
    return acquire(importIri, importingDocumentIri, signal);
  },
});
const canonicalBytes = encode(result.document);
```

`resolveImport` returns `{bytes, documentIri, mediaType}` or reports acquisition failure.
There is no implicit fetcher or syntax sniffing.
Compatibility is the default mapping profile; the explicit strict identifier is `https://haddenindustries.com/ontology/profiles/vowl/owl-mapping/strict/v1`.
Both profiles validate the complete loaded closure before excluding unsupported content and return deeply frozen `{document, mappingProfile, diagnostics}`.
The document is structural content; the adapter does not choose artifact state.
Source document IRIs provide parsing context and do not fill missing ontology identity.

Accepted media types come from the pinned dependency's public `OWLDocumentFormats` metadata in `owlapi/formats`.
Each root or imported document must select exactly one format by an exact published media type; unknown or ambiguous types fail before parsing.
VOWL maintains no separate format allowlist.
The owning parser runs in `preserve` mode, and the adapter checks its source assessment over the complete closure before projecting structural OWL.
Parser errors remain fatal: for example, KRSS1 `:right-identity` is explicitly unsupported.
The [format admission evidence](../../docs/reviews/canonical-vowl-owl-format-admission.md) records the dependency revision, parser regressions and verification status.
The [original adapter evidence](../../docs/reviews/canonical-vowl-owl-adapter-review.md) records the earlier qualification.

The third experimental surface is explicit, one-way historical ingress:

```js
import { migrate } from "vowl/migrate";

const result = await migrate(legacyBytes, {
  dialect: "webvowl-legacy-354ed3af8c1e82019f6280b2594acaceac96cca0",
  profile: profiles.structuralContent,
  resolutions: [],
  signal,
});
```

Migration returns deeply frozen `{document, dialect, diagnostics}` and preserves the caller's bytes and options.
The [closed ingress contract](../../docs/reviews/canonical-vowl-legacy-ingress-contract.md) defines accepted fields, exact resolution pointers, and loss-of-information rejections.
Named class facts and recoverable binary relations can migrate; ambiguous property endpoints, lost literal datatypes, restrictions, operators, and n-ary grouping fail.
There is no heuristic source detection or partial success.
Only `ontology-iri`, `annotation-predicate`, and `viewport` resolutions exist.

Structural migration diagnoses discarded visualization fields.
Artifact migration requires complete recoverable positions, pins, modes, selector, effective visibility and camera.
Its viewport resolution belongs to `/settings/global/translation`.
Canonical B4/B5 rules govern migrated selector/display intent; old renderer pixels and fallback conventions are not preserved.
No layout or missing-state defaults are generated.
Legacy IDs are used only for operation-local correspondence.

All asynchronous operations use finite counters and a monotonic deadline shared across their stages.
Limits affect acceptance, never successful bytes; cancellation and resource exhaustion yield a `VowlError` with a stable `code` and bounded diagnostic metadata.
Unexpected standards-library failures are not replaced by another algorithm.
The approved [A8 resource-policy amendment](../../docs/specs/2026-09-30-canonical-vowl-resource-policy-amendment.md) uses `min(B * B, rdfDeepIterations)` for RDFC work, retaining finite absolute limits and the same successful canonical bytes.

The `schema` directory contains the two frozen canonical profile schemas, the experimental compatible-artifact schema and the closed legacy ingress shape, all mechanically generated JSON Schema 2020-12 artifacts.
Scalar domains, reference kinds, recursive identity, projection, artifact completeness and exact canonicality additionally require the semantic validator.
Schema validation alone does not grant encoding admission.

Run the focused public-boundary suite with `npm run test:vowl` from the repository root.
Run `node packages/vowl/scripts/generate-schemas.mjs` to regenerate the schema artifacts after an approved inventory change.
The independently authored `conformance` corpus pins expected bytes and intermediate evidence; its README explains reproduction and experimental coverage limits.
Never format or regenerate canonical expected bytes to hide a mismatch.

License: AGPL-3.0-only.
Reused standards libraries and their notices are listed in `THIRD-PARTY-NOTICES.md`.
