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

The `schema` directory contains two canonical profile schemas and the closed legacy ingress shape, all mechanically generated JSON Schema 2020-12 artifacts.
Scalar domains, reference kinds, recursive identity, projection, artifact completeness and exact canonicality additionally require the semantic validator.
Schema validation alone does not grant encoding admission.

Run the focused public-boundary suite with `npm run test:vowl` from the repository root.
Run `node packages/vowl/scripts/generate-schemas.mjs` to regenerate the schema artifacts after an approved inventory change.
The independently authored `conformance` corpus pins expected bytes and intermediate evidence; its README explains reproduction and experimental coverage limits.
Never format or regenerate canonical expected bytes to hide a mismatch.

License: AGPL-3.0-only.
Reused standards libraries and their notices are listed in `THIRD-PARTY-NOTICES.md`.
