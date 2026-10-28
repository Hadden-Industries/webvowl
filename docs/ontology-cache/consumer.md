# Ontology cache consumer

The WebVOWL consumer defaults to **disabled**.
Ordinary root/import acquisition, local inputs and original-source export continue to use the existing worker and document session.
A disabled consumer creates no cache requests, refresh timers or update controls.
The provider may be absent.

This delivery implements the consumer checkpoint of cache SLICE-005 and its offline SLICE-001/004/006 contracts.
It does not implement or qualify the AWS provider, deploy infrastructure, publish seeds, activate production caching or establish source republication rights.
Those acceptance gates remain in the [implementation plan](../plans/validated-ontology-materialization-cache-implementation-plan.md).

## Provider contract

The immutable provider authority is [amazon-aws commit 646e018d](https://github.com/Hadden-Industries/amazon-aws/tree/646e018dbe440735284990e08ca629e1d8bd2c43/validated-ontology-cache/contracts), bundle `1.0.0-draft.2`, digest `871239081809f846d8c0b3ef12f0f0e82cdc3681958e7024c5c57fed87babd75`.
The draft label is retained from the published contract; it is not a deployed service version.

The acquired schemas, protocol examples and identity vectors in `src/ontology-loading/contracts/` are provider-owned data.
Their exact bytes and deliberate Unicode spelling use the JSON quality tool's preserved-byte producer contract; structural and safety checks remain active.
Do not edit them independently.
To deliberately reacquire this exact revision from a provider Git repository:

```powershell
node util/acquireOntologyCacheContract.mjs C:\path\to\amazon-aws
node util/generateOntologyCacheValidators.mjs
```

Acquisition reads immutable Git blobs and checks the provider manifest.
Builds and tests need no sibling checkout or network schema acquisition.
Native Ajv standalone validators are generated ahead of time; browser validation needs no runtime schema compiler or remote schema fetch.
The focused contract test checks bundle/file integrity, provider fixtures and deterministic validator regeneration.

## Explicit composition

`createCanonicalWebVowlApplication({ ontologyLoadingConfiguration })` is the deployment-owned injection point.
Its default is the frozen `ONTOLOGY_CACHE_CONFIGURATION` with `enabled: false`.
Endpoint discovery never enables it.
There is no URL-query or user-input endpoint override.

An enabled test/approved deployment supplies `enabled: true`, one HTTPS `serviceOrigin`, and exact `approvedPolicyFingerprints`. An optional `catalogIri` selects the curated OASIS catalog; no dynamic archive is enumerated. An empty policy list admits no cached evidence. Approval of a policy fingerprint requires the exact provider/package/runtime and loader-policy qualification in the plan.
Fixture fingerprints are synthetic and must never be enabled in production.
`deadlineMs` may shorten the finite 60-second acquisition allowance.

Configuration, CSP, endpoint and production activation changes retain their normal approval gates.
A production activation requires the actual provider/CDN/browser matrix and a tested compatible rollback pair.
Returning to the default disabled composition restores direct-only acquisition and its ordinary browser CORS limitations.

## Acquisition and admission

Enabled precedence is per-load acquired/explicitly selected binding, optional curated catalog, exact source pointer, direct acquisition, then one eligible materialization submission. Per-load catalogs, bytes and policy evidence are reused. A fresh open gets a new context. Canonical/legacy JSON downloads never enter materialization; their ontology imports may use the same controlled acquisition owner.

Only a browser network/CORS failure reported by the direct resolver's native `MissingImportError` with a `TypeError` cause permits materialization. Readable HTTP failures, cancellation, parser/profile failures and resource/host limits do not.
Pending work follows only its bounded, source-specific status location and Retry-After; status observation never resubmits work.

Each cached read checks closed provider schemas, exact logical source identity, resolution/version/validation/policy identities, approved policy, origin parser context and artifact length/SHA-256.
Metadata links are constructed against the configured service origin.
Logical IRI spelling and fragments remain distinct identities; CDN artifact paths never become parser bases.
Service parser hints do not force an automatic browser syntax choice.
The real `vowl/owl` worker still owns parsing, managed imports, source evidence, model admission and resource checks.

Malformed/incompatible discovery can degrade to direct acquisition with bounded diagnostic codes. Observed withdrawal/quarantine tombstones prohibit stale or direct fallback.
Catalogs enforce the restricted OASIS namespace/elements, same-origin paths, duplicate handling, cycle/depth/file/byte/work bounds, cancellation and rejection of DTD/external-resource constructs.

## Source checks and updates

An archived graph shows acquisition and successful-check dates.
A due pointer may initiate one background `if-due` observation after admission; fresh entries create no source-check work.
“Check source” requests the same bounded `check-now` operation.
There is no origin scheduler.
Closing/replacing a document cancels its observation, not a shared backend attempt.

A committed different source version offers an update without replacing the graph.
A 304 or evidence-only requalification updates check information without an update offer.
Failed checks preserve the graph and previous successful-check date.
Applying an offer first confirms the exact candidate through the uncached source-status endpoint, then seeds ordinary root/import readmission with those verified bytes and bindings.
Stale discovery cannot replace that explicit selection.
Superseded, withdrawn or unconfirmed candidates preserve the current graph.

Offers belong to one load generation and semantic revision.
Editing invalidates replacement; reopen the source to apply updates after editing.
Original-source exports remain tied to the bytes actually admitted; semantic exports remain tied to the edited model.

## Verification

`npm run check` includes the consumer's protocol/identity/schema, catalog, acquisition, refresh, controller, worker and diagnostic regressions.
The exact-source metadata fixtures are synthetic provider examples, not server parser or AWS evidence.

The controlled browser check uses an already installed Playwright runtime and its browsers.
It creates and removes its own short-lived HTTPS fixture key/certificate. The browser context trusts that test certificate while retaining real cross-origin Fetch/CORS behavior:

```powershell
node util/qualify-ontology-cache-browser.mjs C:\path\to\playwright\index.mjs chromium http://127.0.0.1:5178/ C:\outside\repo\evidence C:\path\to\openssl.exe
```

Repeat for `firefox` and `webkit`.
It checks the default-disabled production composition, cold root/relative import materialization through native preflight/303, real-worker admission, warm reads, refresh notice and explicit application despite stale static discovery.
It is consumer qualification against controlled external protocol boundaries, not real-provider, CloudFront, source-rights, capacity or live activation acceptance.

The separate `util/qualify-production-ontology-worker.mjs` check serves the current `deploy/` output, rejects production startup errors or disabled cache traffic, and exercises the built worker with exact root/import bytes and parser contexts in all three engines. Run it after building, supplying the installed Playwright module, development-server URL and an external evidence directory; an optional fourth argument selects an installed Firefox executable. This retains the production chunk-ordering regression check alongside the consumer protocol harness. The self-signed protocol fixture records observed HTTP 304 responses separately; actual deployed CDN/browser cache and 304 qualification remains an activation gate.
