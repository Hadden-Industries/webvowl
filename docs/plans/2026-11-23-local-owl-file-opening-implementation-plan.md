# Direct opening of local OWL files

**Status** Draft HISEW implementation plan, 23 November 2026.
The owner confirmed the local opening, base recovery and dependency request decisions below.

**Delivery decision** Selecting or dropping a local OWL file starts the load and authorizes dependency requests permitted by the existing resolver policy.
The selected file's bytes stay in the browser.
When the parser reports that a required relative reference in the selected file needs a base, keep any current graph visible and offer **Open with a base IRI**.
Base entry is available only through this recovery action.
Use the same file bytes on retry and publish the new graph after a successful retry passes the existing admission checks.

## Decision and scope

Restore the one-step local opening interaction of pre-fork WebVOWL v1.1.7.
The outcome is a correct, inspectable graph with the original bytes and import evidence.
The ISO 21511 terms file and the Universal Ontology reference data file are the first two end-to-end acceptance cases.

The initial scope is browser file selection and drop through the existing local file loader.
Implement in the existing WebVOWL checkout, including `packages/vowl`.
Consume the published OwlAPI package through its public interface.
Keep the explicit reader choice for a JSON file where canonical VOWL, supported legacy VOWL and JSON-LD require different admission paths.
Use the owning reader's format selection and recovery for OWL.
Preserve the contracts for pasted OWL, remote URLs, presets, share links, new ontologies and WebMCP callers.
The shared file and paste selector needs regression coverage.

An explicitly incomplete preview would require a separate decision about the meaning and completeness of its display, editing and exports.
Local opening follows the confirmed admission and recovery policy in DEC-001 and DEC-005, with dependency acquisition governed by DEC-004.

**Proposed HISEW route** R2, consistent with the earlier loading repair's risk assessment.
The change affects ontology meaning, import acquisition, retained source evidence and user-visible availability in WebVOWL and VOWL.
Retain an accepted exact requirements baseline, change-specific tests, independent verification and scoped parser/import security assurance.
Confirm the route and sensitive scopes before execution.
Reassess if delivery requires weakening a trust boundary, a breaking or irreversible data migration, or a change to the release authority.
This document supplies the intent and proof for review.

## Historical and current baselines

### Pre-fork behavior

[VisualDataWeb/WebVOWL v1.1.7](https://github.com/VisualDataWeb/WebVOWL/tree/v1.1.7) at `28e7dd9540622e8cb723dc000824b5eef5ae775f` sent the selected OWL file and session ID to `POST /convert`.
OWL2VOWL 0.3.7 passed an input stream to Java OWLAPI 5.1.1.
OWLAPI detected the syntax and generated an internal `inputstream:ontology…` document identifier.
For RDF/XML, the parser applied the in-scope `xml:base`. In a controlled test, the relative class IRI `#Thing` became `https://example.org/base/#Thing` with a declared base and stayed `#Thing` without one. The historical interaction is the usability comparator. Use syntax specifications and independent expected IRIs to judge semantic correctness. [Browser upload](https://github.com/VisualDataWeb/WebVOWL/blob/v1.1.7/src/app/js/menu/ontologyMenu.js#L545-L562) · [Stream conversion](https://github.com/VisualDataWeb/OWL2VOWL/blob/0.3.7/src/main/java/de/uni_stuttgart/vis/vowl/owl2vowl/converter/InputStreamConverter.java#L60-L67) · [Java stream source](https://github.com/owlcs/owlapi/blob/owlapi-parent-5.1.1/api/src/main/java/org/semanticweb/owlapi/io/StreamDocumentSource.java) · [Java RDF/XML resolution](https://github.com/owlcs/owlapi/blob/owlapi-parent-5.1.1/parsers/src/main/java/org/semanticweb/owlapi/rdf/rdfxml/parser/RDFParser.java#L275-L309)

### Current path

The inspected WebVOWL checkout is `fix/ci` at `b012139a8ce5613e560fec2057c6e208ad8f1ee8`.
The application locks and loads `@hadden-industries/owlapi@0.1.0-rc.3` through the `owlapi` alias.
The separate OwlAPI checkout was `zero-one-zero` at `ca0951a923b5628ee2c9c91413c68eac8a20f5d2` with concurrent work.
Use the installed package for the consumer baseline and record the exact publisher artifact used for a candidate.
[Dependency declaration](../../package.json) · [Lockfile](../../package-lock.json)

1. The picker and file drop delegate to `loadLocalFile`.
   The selector takes owned bytes from the file, applies its JSON reader hint and opens the dialog.
   The OWL selection requires a valid absolute **Original document IRI** before the parser runs.
   `File.name` is a display name.
   The browser provides no original download location through this path.
   [Picker](../../src/app/js/menu/ontologyMenu.js) · [Loading module](../../src/app/js/loadingModule.js) · [Input selector](../../src/app/js/ui/canonicalInputSelection.js) · [File API §4.2](https://www.w3.org/TR/FileAPI/#attributes)
2. The controller passes the IRI through local acquisition and the worker to `vowl/owl`.
   Acquisition requires it, and a direct probe of `openOwl` with the option omitted returned `OPTION_INVALID` at `/documentIri`.
   VOWL supplies this value as the OwlAPI `StringDocumentSource` document IRI.
   [Controller](../../src/app/js/controller/canonicalWebVowlController.js) · [Acquisition](../../src/app/js/controller/canonicalVowlSourceAcquisition.js) · [Worker entry](../../src/app/js/controller/canonicalVowlWorkerOperations.js) · [VOWL loading](../../packages/vowl/src/owl/loading.js)
3. The same value correlates sources and diagnostics in the compatible loading archive and locates the root for live model admission.
   The private worker cache includes it in its request signature and reads back original source bytes and import evidence before reuse.
   The import callback carries the importing document and resolved import target.
   The controller's provenance projection can also record the supplied value as source identity.
   [Compatible loading](../../packages/vowl/src/owl/compatibleLoading.js) · [Source evidence](../../packages/vowl/src/owl/sourceEvidence.js) · [Live model admission](../../packages/vowl/src/liveModel.js) · [Worker result cache](../../src/app/js/controller/validatedOwlResultCache.js)

Direct probes of the installed OwlAPI readers skipped the VOWL admission guard.
Absolute RDF/XML loaded, and RDF/XML and Turtle with declarations resolved fragments to the expected absolute IRIs.
Removing the declaration made the RDF/XML reader return `OWL_SYNTAX_ERROR`.
The Turtle reader returned a class with the relative IRI `#Term`.
A JSON-LD probe with an unbased `@id` returned successfully with no class record.
A successful library parse alone therefore cannot establish that a local document's IRIs were resolved.
VOWL needs reliable public reader evidence before offering base recovery or admitting a local document.

### Reported files and observed results

| Root                                    | Relevant document contents                                                                                                                                                                                                                | Observed results                                                                                                                                                                                                                                                                                  |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ISO 21511:2018 terms RDF/XML            | Ontology IRI `https://haddenindustries.com/ontology/iso/21511/ed-1/`. Absolute IRIs throughout. The file has no `xml:base` or OWL imports.                                                                                                | The Java stream loader detected RDF/XML and loaded one document. Current `openOwl` produced equal inspected ontology records and statement occurrences using the ontology IRI and the unrelated test address `https://example.invalid/different/source.rdf` as separately supplied document IRIs. |
| Universal Ontology `reference-data.owl` | The root declares `xml:base="https://haddenindustries.com/ontology/universal/reference-data/"`. The version IRI ends in `/reference-data/20260912`. The root imports ISO/IEC 11179-3 by absolute IRI, which imports SKOS by absolute IRI. | The Java stream loader loaded all three documents using local copies of both imports. Current `openOwl` returned equal inspected ontology records and statement occurrences with the declared base and the version IRI as separately supplied document IRIs, using the same local imports.        |

These probes establish parser and closure behavior.
Browser rendering and the proposed no-prompt entry still need acceptance evidence.
Preserve exact root and import bytes across comparisons.
The local Java probe used a built OWL2VOWL 0.3.7 shaded JAR containing OWLAPI 5.1.1, SHA-256 `4bd16f5b953fa27bd7bded24da329d574b8c9114732e9c56379ee2eb905800de`.
Identify that binary as a local build when using it for baseline evidence.

The following are the local inputs and their observed SHA-256 values on 23 November 2026.
Retain them under the execution's evidence and fixture rights rules.
Use small, independently authored fixtures for shared tests.
Keep the real inputs local unless their redistribution rights are established.

| Input                                                                  | Local location under `C:/Users/maksy/`                                                                                  | SHA-256                                                            |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| ISO 21511 root                                                         | `Downloads/ISO 21511_2018 Work breakdown structures for project and programme management - 3 Terms and definitions.rdf` | `ced215d02c5292cb76ef0598d5c732c5893f21f51df90a2d04aa3f344f754d94` |
| Reference data root                                                    | `GitHub/universal-ontology/reference-data/reference-data.owl`                                                           | `1354d260a8bf33d0e67b6145b45438be719203f71e0280d61fc498b697860260` |
| `https://haddenindustries.com/ontology/iso-iec/11179/-3/ed-4/20260912` | `GitHub/universal-ontology/src/iso-iec/11179/-3/ed-4/20260912`                                                          | `b621c3d545343cbfab9e8c41cf296046df32722204b8ff76251b7b5a6f3a2e74` |
| `http://www.w3.org/2004/02/skos/core`                                  | `GitHub/universal-ontology/src/external/skos.rdf`                                                                       | `378fe72e82a529a3338e00c1fb157112d9941c94ac5c8bc7e88a8463ea879e96` |

## Implementation decisions and authority

### DEC-001 · One file-opening route with optional recovery

For a local file, acquisition owns the byte snapshot, display name and operation lifetime.
Use native format detection through the existing worker pipeline.
Retain explicit reader choice for ambiguous input and for a user who chooses a format.
Local OWL selection and reader choice both start with absent external base context.
Offer base entry only after the typed missing-base outcome in DEC-002, including for users who already know the base.
Keep the owning reader's diagnostic if the selected syntax is malformed, unsupported or ambiguous.

| Result from the owning boundary                                                               | File-opening outcome                                                                                                                                                                                                                                                  |
| --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| All relevant names are absolute, or each relative reference resolves under the reader's rules | Continue through the existing closure, qualification and rendering path.                                                                                                                                                                                              |
| A required relative reference in the selected file needs an external base                     | Keep any previously admitted graph and source visible. Show the reason and location or reference when safely available. Offer **Open with a base IRI**.                                                                                                               |
| The user chooses retry                                                                        | Validate the explicit absolute fallback with the existing IRI validator. Submit the same bytes and selected reader policy through the normal load pipeline under a fresh operation. Publish the new graph once the retry resolves the reference and passes admission. |
| The user cancels, dismisses recovery or picks another source                                  | Release the pending retry and its bytes when ownership ends. A stale completion cannot publish state or revive the offer.                                                                                                                                             |
| Syntax, import, resource or transport failure                                                 | Report the owning error through existing failure presentation. An absolute import that is unavailable remains an import outcome.                                                                                                                                      |

Only a current accepted operation can publish a new graph, source, share affordances or session data.
Keep file input sequence, worker generation, import subscription and retry ownership coherent.
Reuse the existing cancellation and settlement paths.
The recovery affordance names the failed file.
The previously admitted scene remains the subject of inspection and export while recovery is pending.
Verify the accepted source label, reload target and history after a failed attempt.
The current file loader sets the `#file=` history entry before controller admission, so couple its accepted-source effect to the outcome or reconcile it on failure under the same operation guard.
Record a supplied base as parsing context.
A retry uses the retained local bytes, and resolver calls arise from qualified dependencies in those bytes.

### DEC-002 · The reader owns IRI resolution

Use OwlAPI's public source, format and load APIs and the existing format-specific readers.
Carry an optional external fallback to the owning resolution boundary.
Each supported reader needs to distinguish a valid reference that lacks required base context from malformed syntax, grammar that requires an absolute IRI, and a normally resolved reference.
The diagnostic must survive auto-detection, wrapping and worker transport with its category, a bounded safe reference if available, and any source location the reader already supports.
One typed outcome should suffice for recovery.
UI code selects the action from that outcome.

Exercise empty and fragment references, `rdf:ID`, resource and datatype references, nested and relative `xml:base`, prefix expansion and relative import declarations.
An absolute-scheme declaration by itself may still fail to resolve a particular reference.
Turtle or TriG directives, OWL/XML and JSON-LD contexts follow their owning rules. Where a grammar demands absolute IRIs, including N-Triples and N-Quads, a relative IRI is a grammar error with or without a supplied base. Literals and blank node identifiers retain their own semantics. Qualify the actual available readers from the pinned runtime. The registry of format identities alone does not establish parser availability. [RDF/XML §5.3](https://www.w3.org/TR/rdf11-xml/#section-Resolving-IRIs) · [XML Base §4](https://www.w3.org/TR/xmlbase/#resolving) · [Turtle §6.3](https://www.w3.org/TR/turtle/#sec-iri) · [JSON-LD base](https://www.w3.org/TR/json-ld11/#base-iri) · [OWL/XML](https://www.w3.org/TR/owl2-xml-serialization/) · [N-Triples grammar](https://www.w3.org/TR/n-triples/#sec-grammar) · [N-Quads grammar](https://www.w3.org/TR/n-quads/#sec-grammar)

#### Reuse and selection

| Approach                                                         | Fit and trade-off                                                                                                                                                                                                                                                                                                                                                                                                              |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Generate a fallback base or take it from an ontology/version IRI | Small UI change with a material semantic cost. The same relative token can denote a different entity or import target. A generated stream identifier can identify a load. Treating it as a base changes the resolution contract. OWL distinguishes ontology identity and document location.                                                                                                                                    |
| Inspect an XML header or use browser `DOMParser` to find a base  | Can handle the root declaration in `reference-data.owl`. The ISO 21511 file has no base to find. Scope, other syntax rules and exact refusal behavior still belong to the parser. Browser `File` and `URL` supply bytes and URL operations, while the reader decides what to resolve and when.                                                                                                                                 |
| Use the owning parser through its public interface               | Selected strategy. The installed OwlAPI already owns reader selection, scoped RDF/XML parsing, the OWL model and closure orchestration. Its RDF integrations include rdfxml-streaming-parser 3.3.0, N3 2.13.12 and the jsonld 9.0.0 provider. Those libraries offer syntax-level capabilities. Calling them independently from the UI would duplicate the OWL and admission pipeline, with distinct error and import behavior. |
| Route local opening through Java OWL2VOWL again                  | Useful as a historical comparison. Product adoption would move local bytes across a network boundary and return the historical projection instead of live VOWL's model and retained evidence.                                                                                                                                                                                                                                  |

Reuse research checked the installed package source, manifests, licences and notices, and the [N3](https://github.com/rdfjs/N3.js), [RDF/XML](https://github.com/rdfjs/rdfxml-streaming-parser.js) and [JSON-LD](https://github.com/digitalbazaar/jsonld.js) owners' published interfaces.
On 23 November 2026 the [npm registry](https://www.npmjs.com/package/@hadden-industries/owlapi) reported both `latest` and `next` as `0.1.0-rc.3`.
That prerelease is the inspected existing pin.
A version in the developer checkout is a source observation.
Before bringing in a changed artifact, select the current eligible release, verify exact version, API, integrity, supported browser and Node consumers, and review the shipped licence and notice inventory in the consuming bundle.
Existing OwlAPI and WebVOWL licensing and retained transitive notices govern reuse.
A new prerelease selection requires the owner's explicit version decision.

The residual functionality is the distinction between document identity, resolution context and a missing-base diagnostic at the supported reader boundary.
SLICE-001 tests the pinned public API through VOWL and establishes which outcomes the WebVOWL-side adapter can prove.
Reject a UI parser, silent synthetic base, diagnostic-text inference or a version-detection shim.
Use one authority for IRI resolution and propagate its result to the consumers.
Preserve the existing explicit-document context contract where a supported current caller relies on it.
[OWL 2 §3.2](https://www.w3.org/TR/owl2-syntax/#Ontology_Documents) · [RFC 3986 §5](https://www.rfc-editor.org/rfc/rfc3986#section-5)

### DEC-003 · Separate the meanings of document metadata

| Meaning                   | Owning boundary and use                                                                                                                                                                                                                                                                    |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Local source identifier   | The acquisition and source archive need a stable way to correlate the root, bytes, diagnostics and import relationships within their scope. This identifier is internal and has no base-resolution or network effect. Preserve deterministic identity where serialized output requires it. |
| Acquisition address       | The resolver owns actual requested and retrieved locations, including redirect and catalogue evidence. A local file can have unknown acquisition origin. A user-supplied fallback base is recorded with its actual role.                                                                   |
| Resolution context        | A reader uses the supplied fallback if applicable and honors syntactic base and prefix scopes. Evidence sufficient for replay records the inputs and decisions needed to reproduce that resolution. It may include multiple effective bases.                                               |
| Ontology and version IRIs | The parsed OWL model owns these identifiers when present. They can differ from the address or base and keep their existing roles in semantic and import-identity logic.                                                                                                                    |

Trace the field currently named `documentIri` through VOWL loading, model admission, checkpoint serialization and readmission, worker transport, controller provenance, imports and caches.
Follow the remote and source-preserving `fromOwl` siblings before changing shared semantics.
An archive field can carry a locally assigned identifier only if its documented meaning admits that use and its consumers keep it out of base resolution, retrieval and origin display.
If the existing field asserts actual acquisition context, choose a versioned owner change with old-record read compatibility.
Use names that express the actual role.
Document any change to public contracts at the owner.

### DEC-004 · Resolve imports before acquisition and qualify result reuse

Selection or drop is the user's request to open the file and acquire its permitted dependencies.
Start those requests as the reader needs them under the existing policy, without a separate **Open** confirmation.
Pass resolved absolute import targets to the existing catalogues, resolver bindings and acquisition policy.
Use the actual importing source identity for correlation and the appropriate document context for child parsing.
Preserve current redirect, trust, cancellation, retry and missing-import behavior.
Apply the JSON-LD provider's existing document loader and remote context policy on its own boundary.
A local source identifier, ontology header or base declaration alone does not authorize a fetch.
Keep the root bytes in the browser and expose no local path or invented URL in provenance or share links.

Start the new path with the worker's conservative cache miss when it cannot establish key equivalence.
Reuse a result only when owned root bytes, selected reader or auto-detection policy, external fallback presence and value, parser/mapping strategy, applicable limits, provenance and fresh import evidence support that result.
Bind the current request to its own operation and source identity.
A local result reused under a different fallback or changed child binding is a correctness failure even if the file bytes match.
Preserve validated remote materialization and the existing explicit-IRI cache behavior.

### DEC-005 · Admission and saved data

Use the existing VOWL qualification, editing and export authorities.
A genuinely unresolved name that affects interpretation blocks admission.
Sources with resolved names and missing imports continue to receive the current qualified outcome and its evidence.
Preserve exact original bytes, including encoding and line endings, for eligible source export.
Import status, document identity and diagnostic ownership must correspond to the admitted root and revision.

`sourceArchive.js` emits version 1 and currently admits only version 1.
Its evidence validator expects a unique nonempty `documentIri` per document and matches diagnostics to it.
Live admission locates the root by this value.
Qualify an existing checkpoint and a new local-origin checkpoint through the real reader, writer and editor/export gates. Pass an independently altered digest or mismatched diagnostic/document association through the same readmission boundary and verify refusal.
A changed serialized meaning or shape needs an explicit version and compatibility decision before writes can be enabled.
[Archive and readmission](../../packages/vowl/src/sourceArchive.js) · [Model admission](../../packages/vowl/src/liveModel.js) · [Compatible artifact contract](../specs/2026-10-04-canonical-vowl-compatible-artifact-contract.md)

## Requirements and acceptance criteria

| Requirement                                    | Acceptance proof                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Decision and quality scenario              |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| REQ-001 · One-step local opening               | AC-001 · Select both pinned roots through the real browser file input and exercise the shared drop route with a small equivalent fixture. The applicable reader opens the graph with zero mandatory IRI interactions. Check named entities, visible relationships and import closure against matched controls.                                                                                                                                                                            | DEC-001, DEC-002 · QA-001                  |
| REQ-002 · Correct syntax-specific resolution   | AC-002 · Compare exact expected absolute IRIs for self-contained and explicit-base cases. A legal unresolved relative reference yields the typed missing-base outcome. An invalid absolute-only syntax remains invalid with either context.                                                                                                                                                                                                                                               | DEC-002 · QA-002                           |
| REQ-003 · Optional and recoverable retry       | AC-003 · Verify that base entry appears exclusively as an accessible, cancellable action after a genuine missing-base diagnosis. The current graph stays visible until a successful retry admits the same bytes with the expected resolution. An invalid entry, dismissal, failed retry or supersession cannot publish another graph or change the previously admitted source, reload target or accepted history.                                                                         | DEC-001, DEC-002 · QA-002, QA-003          |
| REQ-004 · Correct and authorized closure       | AC-004 · Verify that selection and drop start permitted dependency requests when the reader needs them, without another **Open** action. With the same pinned bytes, compare root and child identities, statements, resolver targets and closure status. Exercise absolute and relative imports, child context, missing and denied imports and cancellation. Verify that root bytes stay in the browser and that metadata alone never triggers a root fetch or unresolved import request. | DEC-003, DEC-004 · QA-004                  |
| REQ-005 · Accurate source evidence and replay  | AC-005 · Old checkpoints read through their supported path. New eligible local checkpoints round trip with original root/import bytes and honest context. Cross-check diagnostics, export and editing eligibility. A controlled corrupted archive remains refused.                                                                                                                                                                                                                        | DEC-003, DEC-005 · QA-005                  |
| REQ-006 · Cache isolation and source ownership | AC-006 · Open identical dependent bytes under two different bases, then change a child binding under the same root bytes. Verify exact results and absence of stale reuse. When the owning cache accepts reuse, verify equivalent evidence and owned results. Exercise cancellation during byte read, import wait and admission.                                                                                                                                                          | DEC-001, DEC-004 · QA-003, QA-006          |
| REQ-007 · Entry-point compatibility            | AC-007 · Exercise remote URL and explicit-context loads, pasted input, new ontology creation, canonical and supported legacy JSON, JSON-LD reader selection and actual format recovery. Observe their existing acceptance or refusal and the correct source labels.                                                                                                                                                                                                                       | DEC-001, DEC-003, DEC-005 · QA-002, QA-005 |
| REQ-008 · Bounded opening and operable rollout | AC-008 · A direct attempt uses the existing bounded worker and one owning load pipeline. Compare matched parse, closure, render and memory observations for the two roots and a larger ordinary case. Verify existing oversized-input, timeout and cancellation outcomes. Qualify release and recovery against the exact final candidate.                                                                                                                                                 | DEC-001, DEC-004, DEC-005 · QA-003, QA-006 |

### Quality scenarios

- **QA-001 · Usability and compatibility.**
  In a reference browser, a user selects each pinned file with the matched local import closure available through the test resolver.
  Count required IRI interactions and compare the admitted graph and source evidence.
  The expected count is zero and every intentional visibility or warning difference from the baselines has an owner-reviewed explanation.
- **QA-002 · Semantic correctness and error classification.**
  In the actual reader and worker, vary a valid relative reference's scope and fallback, and include malformed syntax and a reader that forbids relative names.
  Compare exact independently expected IRIs and failure codes.
  Missing-base recovery appears only for the declared outcome.
- **QA-003 · Reliability and accessibility.**
  With a graph already open, select a file whose parser reports a missing base.
  Check that the action appears only after the diagnosis and that the current graph remains visible until a retry succeeds.
  Check keyboard reachability and focus recovery.
  Cancel a byte read or retry, or select another file while imports load.
  Only the current operation may settle visibly or publish.
- **QA-004 · Privacy and trust boundary.**
  With controlled dependency destinations and policy denials, select or drop a local file containing declared bases, ontology identifiers and imports.
  Observe which requests start on that action and verify the exact destinations against the existing resolver policy.
  Only actual permitted dependencies use the acquisition route.
  The selected file's bytes stay in the browser.
- **QA-005 · Recoverability and interoperability.**
  In the real checkpoint and export consumers, reopen an earlier version-1 artifact and a candidate local-origin artifact, and pass an independently corrupted control.
  Compare retained bytes, provenance, identity and eligible operations.
  A bad record cannot become an admitted model.
- **QA-006 · Resource and cache behavior.**
  On the same recorded toolchain and representative files, compare explicit-IRI and direct paths for cold admission, repeat, changed binding and failure.
  Observe time to first graph, parser and import work, peak memory and retained retry/cache state.
  Existing limits classify boundary cases correctly.
  Establish the acceptable measured range before rollout with the resource owner.

## Vertical slices and proof

The WebVOWL maintainer owns integration and the browser outcome.
The OwlAPI maintainer owns the reader and public source contract.
The VOWL package maintainer owns admission, evidence and serialization.
The resolver/cache owner confirms acquisition and reuse effects.
Use those ownership boundaries to settle changes before their consumers depend on them.
Fixture preparation and the risk review can proceed independently of the reader contract.
Keep parser and consumer edits together where their semantics are still coupled.

### SLICE-001 · Reproduce the browser baseline and settle parser feasibility

**Trace** REQ/AC-001–004, 007 · DEC-001–003 · QA-001, QA-002, QA-004.

In an authorized qualification environment, pin the example bytes and dependencies and capture the existing file-picker prompt, explicit-context graph and import ledger.
Compare the historical stream/graph path on the same admitted inputs as far as the baseline supports. Add a small RDF/XML control with an absolute ontology header and a scoped relative class or import.
Exercise the supported OwlAPI source API through VOWL and one actual browser entry, with a declared base, a supplied base and missing context.
Include a malformed XML input that the owning parser already refuses.
Its original bytes must reach the same parser and still fail.

If the public API supplies independent identity, resolution and diagnostic evidence, reuse it directly.
If the public interface cannot distinguish genuine missing context from invalid syntax or dropped references, establish whether VOWL can derive the required result through supported public reader evidence.
If neither can be demonstrated, hold the release change at that boundary.
Record the exact failing case and continue independent corpus and compatibility work.
This slice yields the qualified comparison and the evidence for the following slices.

### SLICE-002 · Open both RDF/XML files through the normal app path

**Trace** REQ/AC-001, 002, 004, 005 · DEC-001–005 · QA-001, QA-004, QA-005.

Deliver a complete RDF/XML path from the real browser picker, through worker admission and import resolution, to the rendered graph and original-source export when eligible.
Use a local source identifier and give the reader the established context contract.
The reference-data run checks all three documents.
The ISO 21511 run checks its root-only closure.
Compare visible semantics, inspected records and original bytes with the matched explicit-context and legacy baselines.
Use the picker and an equivalent drop fixture to verify that permitted imports start from that interaction.
Check that ontology metadata and internal source identity alone never cause a network request.
Exercise a denied or missing import and verify the current admission and warning contract.

Predicted seams are `canonicalInputSelection.js`, `loadingModule.js`, the local source branch in `canonicalVowlSourceAcquisition.js`, the worker load path, and `packages/vowl/src/owl`.
Qualify genuine missing-context refusal and the existing archive validator before exposing this increment.
Keep this reader-limited route in controlled qualification until recovery and supported format coverage are ready.

### SLICE-003 · Recover from a missing base in the file picker

**Trace** REQ/AC-002, 003, 006–008 · DEC-001–004 · QA-002, QA-003, QA-006.

Carry the typed reader outcome through existing worker error transport and the loading UI.
From a previously loaded graph, select a file with `#Thing` and no applicable base.
Verify that the picker exposes base entry only after the missing-base result, that the optional action names the file, and that the previously loaded graph stays visible until the retry succeeds.
Compare exact IRIs for two supplied bases.
Preserve the source and graph when validation fails, the action is dismissed, the user cancels, or another file wins the operation.
Confirm keyboard use and one current error or success outcome.
Use the actual byte snapshot and generation checks so late results or amended disk bytes cannot silently substitute for the request.

Predicted seams are `canonicalVowlFailure.js`, worker error translation, `loadingModule.js`, `canonicalInputSelection.js` and the controller operation lifecycle.
Reuse their supported validation, focus, cancellation and state-publication paths.
The slice settles the local retry lifetime and leaves no retry state after dismissal or supersession.

### SLICE-004 · Qualify supported readers and sibling entry points

**Trace** REQ/AC-001–004, 007 · DEC-001–005 · QA-001–QA-005.

Extend the same behavior to each reader the deployment actually supports.
Include the relevant declarations and scoping for Turtle/TriG, OWL/XML and JSON-LD, an absolute-only N-Triples/N-Quads control, and existing prefix handling for supported OWL text readers.
Verify detection on extensionless and ambiguous inputs, the explicit JSON reader decision, and malformed syntax that remains refused.
Check remote URL, paste, preset, new ontology, source-preserving API and explicit-context consumers where shared code changes.
Before enabling a reader in the release, establish both its positive and adverse end-to-end cases and document any material compatibility difference.

Keep test cases with each owning reader and add one browser-to-worker test for each distinct user path.
Qualify each reader against the published package pin used by WebVOWL.
A dependency capability gap requires a revised decision for the affected reader.
Any later pin or lock change goes through the repository's exact configuration-change approval.
Measure browser parity against the package artifact in the actual candidate.

### SLICE-005 · Qualify replay, caches and release recovery

**Trace** REQ/AC-004–008 · DEC-003–005 · QA-003–QA-006.

Prove honest evidence and deterministic readmission with a saved version-1 source archive, a new local archive and a bad control.
Verify that root and child source bytes round trip, the right document owns each diagnostic, and editing and export use the real qualified state.
Exercise cold and repeat opens, different fallback bases on identical bytes, changed imports, and cancellation during a cache or import wait.
Accept new cache reuse only after this comparison establishes source/context and freshness equivalence.
Compare representative resource use against the explicit-IRI control.
Keep a conservative miss when reuse remains unqualified.

Predicted seams are `sourceEvidence.js`, `sourceArchive.js`, the live model checkpoint path, `validatedOwlResultCache.js`, and the resolver's import-evidence consumers.
Rehearse restoring the previous supported opening path against both old and candidate data before claiming that rollout is reversible.
The finalized candidate supplies the handoff evidence and the release-readiness input.

## Verification and evidence ownership

Use specifications and hand-derived fixture expectations for new parsing and import rules.
For example, a local RDF/XML class with `rdf:about="#Thing"` under `xml:base="https://example.org/base/"` denotes `https://example.org/base/#Thing`.
A relative child import under that scope should produce the corresponding absolute target according to that reader.
Include a class or version IRI with a different namespace to catch unintended fallback.
Compare observable VOWL entities and relationships with the pinned legacy service on a matched closure, and the existing explicit-context path against the candidate for source-preserving behavior.
Current producer output alone cannot justify a changed accepted IRI or a newly admitted invalid input.

Run the real parser, model admission, worker, import policy and file-input/controller paths for the claims they own.
Substitute only actual external boundaries, such as a controlled fetch or import byte provider, with recorded destinations and pinned bytes.
Use a real browser with an isolated profile for final file-picker and focus proof.
Record matched toolchain and fixture identities, actual checks and verdicts, and any omitted wider proof.
Browser rendering claims need a browser result.
Retain independent expected IRIs, import ledgers and adverse-case evidence with the implementation.

| Proof area                                  | Maintained routes to extend or run                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OwlAPI readers and source handling          | Use its existing Jest entry `npm test -- --runInBand` with owning paths. Start with `internal/parsing/rdfxml/rdfXmlSyntaxAdapter.test.js`, `internal/parsing/rdfxml/rdfXml.conformance.test.js`, `model/owlOntologyManager.test.js` and `model/rdfConsumerCompatibility.test.js`. Add the relevant format, browser consumer or import suites as coverage expands.                               |
| WebVOWL input, worker, import and lifecycle | Use `npm test -- --runInBand` with `canonicalInputSelection.test.js`, `canonicalVowlSourceAcquisition.test.js`, `canonicalVowlWorker.test.js`, `canonicalVowlWorkerCache.test.js`, `canonicalVowlFailure.test.js`, `controllerOperationLifecycle.test.js` and the affected controller/resolver tests at their checked-in paths.                                                                 |
| VOWL and retained compatibility             | Run the affected package tests, starting with `packages/vowl/test/compatibleLoading.test.js` and the checkpoint or artifact tests identified from the admitted changes. `npm run test:vowl` is the maintained package/corpus check. For candidate-sensitive integration use the repository's `npm run check` or its independently admitted components according to the verification decision.   |
| Browser and acquisition                     | Reuse `util/qualify-canonical-browser.mjs` with its existing Chrome, isolated-profile and evidence-directory arguments, and the acquisition assertions in `util/qualify-ontology-cache-browser.mjs`. A file-input scenario is new coverage. Verify that it drives `#file-converter-input` or the drop path, and uses pinned dependency responses. Record the exact qualified build and command. |

List the affected checks against the accepted comparison using `npm run check:affected -- --base <full-commit> --list` and inspect the selected tests and their assertions.
Native HISEW admission owns the execution obligations.
Reconcile `verify-change-execution --selection affected --list-only` with the reviewed proof and add named tests through the supported native route where required.
Use the broader admitted selection when the dependency or reader scope is uncertain.
A repository selection result and a native receipt have different authority.
Run final assurance against the frozen candidate and reuse only eligible evidence for unchanged obligations.
[Affected testing guide](../dependency-graph-and-tests.md) · [Verification runner](../../package.json) · [Browser harness](../../util/qualify-canonical-browser.mjs)

The independent reviewer checks each accepted condition against its named oracle and looks for false acceptance at the parser, cache, import and checkpoint boundaries.
The scoped security assessment checks the finalized input and resolution changes, including destination policy, untrusted diagnostics, privacy, bounded processing and cancellation.
Use the bundled Review Agent skill for internal code reviews.
If external review applies and disclosure is authorized, use `agy` with Gemini 4 Hydrogen at Extra effort.
Run one Codex Security assessment against the final commit.
Delivery consists of signed local commits with per-file detailed messages.
Use the active HISEW implementation and supported review procedures after execution authorization.
Choose reviewers and evidence access under the applicable disclosure authority.
Keep owner secrets in the native private input channel and retain private fixture evidence in the approved Work/Evidence destination.

On 23 November 2026 read-only native checks reported personal applicability and active executions for both WebVOWL and OwlAPI.
The Dev.34 setup inspection reported `repair-required` for an unexpected managed runtime member, `env/Lib/site-packages/win32/lib/__pycache__`.
Read-only launcher status succeeded.
The dependency-guided testing execution `bb45b0e3-4352-4e19-a8ea-7ae1e2f493ba` was closed administratively.
The installed HISEW launcher subsequently reported no active execution in the WebVOWL checkout.
The previous closure established lease release.
Verification of that earlier change and of this implementation require their own evidence.
Before implementation, recheck the selected setup, exact directories, active owners and candidate state.
Resolve runtime readiness through the applicable HISEW management procedure, and coordinate with the owners of existing executions before binding or reserving new work.
For an authorized R2 start, retain the approved UTF-8 requirements bytes and SHA-256 or admitted snapshot ID, the route record and the current owner binding.
Use the native behavior-acceptance undertaking where selected, with named test files and independent oracle paths.
At handoff, settle the native intent, review, resources and completion assessments against admitted evidence for the final candidate.
Release readiness consumes that handoff and the product rollout and recovery proof.

## Data compatibility, rollout and recovery

- **Saved state.**
  Validate read compatibility before any new persistent write.
  Preserve earlier artifacts and source bytes.
  If a new version is necessary, deploy compatible readers before emitting it and rehearse both supported replay and the result an older reader returns.
  Keep historical payloads usable where their existing contract permits.
  Determine whether any data migration is needed from the actual persistence inventory.
  Cache entries are disposable within their owning scope.
  Revalidate or bypass incompatible entries instead of reinterpreting them.
- **Resource trade-off.**
  The file already enters as owned bytes.
  Preserve the input cap and worker/dependency limits. Avoid full XML/JSON parsing on the main thread and a second full scan to guess base independence.
  Keep pending retry bytes under the existing admitted input and operation lifetime.
  Measure root size, closure count and bytes, parse/mapping cost, time to first graph, peak memory and retained state on matched cold and warm runs.
  Account for the cost of conservative cache misses.
  Retain actual measurements and current limits instead of committing to an unmeasured target.
- **Observability.**
  The release observer should distinguish direct open, format recovery, missing-base recovery, other parse failures, import warnings, cancellation and first graph time.
  Use existing approved aggregate observation or local qualification evidence.
  Keep filenames, IRIs, local paths, hashes and source bytes out of product telemetry.
  Decide measured performance and adoption ranges before the rollout decision, based on the candidate and its control.
- **Rollout.**
  Qualify RDF/XML first in a controlled build, then the supported reader set.
  The WebVOWL release owner confirms the exact parser artifact, backward reads, native assurance and browser proof.
  Use an existing authorized scoped rollout or release control if it can isolate this path.
  Record the previous known-good build and validate that it can be restored with the supported data.
  Pause promotion on wrong entity IRIs, unexpected fetches, closure mismatches, replay failures or measured resource regressions outside the accepted range.
- **Recovery and cleanup.**
  Restore the previous supported path only after demonstrating compatibility with the affected saved state.
  If a version change makes downgrade unsafe, hold rollout until a compatible read or forward repair has been proved.
  Avoid rewriting user data to force downgrade.
  Preserve the failing candidate and fixture ledger for diagnosis.
  Retire task-owned transient app profiles, pending byte snapshots and stale non-authoritative cache entries through their existing ownership rules.
  Retain the execution receipts and required evidence.

## Replanning triggers

| Observation                                                                                                                  | Decision and response                                                                                                                                                                                                                             |
| ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The native reader or a third-party adapter discards the relative token or confuses invalid syntax with missing base          | Revisit DEC-002 with the smallest fixture through the public consumer. Adopt an eligible owning extension if it can distinguish the cases. Hold that reader's rollout until it can. Continue independent fixture and replay work.                 |
| Both example files parse, but the browser graph, visible relationships or closure differ under identical bytes               | Recheck which stage and intent explain the difference before changing AC-001 or AC-004. A valid oracle with a failing candidate calls for repair. A real conflict between legacy behavior and the selected semantics calls for an owner decision. |
| Existing archive fields require an actual acquisition address, or older readers cannot consume a new proposed representation | Revisit DEC-003 and DEC-005 with a real saved-record readback. Select a permitted representation or a versioned introduction and tested recovery before new writes.                                                                               |
| The worker cannot distinguish parser context, import freshness or operation identity on repeat or retry                      | Keep the conservative miss. Reopen DEC-004 only with code and browser evidence that a reused result is equivalent and remains owned by the current request.                                                                                       |
| A required package artifact, pin approval, fixture right, managed setup or execution ownership is unavailable                | Identify the exact dependency and owner. Hold the affected native transition or integration. Continue independent analysis and approved evidence work.                                                                                            |
| The owner wants a graph for genuinely unresolved IRIs                                                                        | Reopen the display policy and baseline. Define a separately identifiable incomplete result with accountable omissions and restricted operations before planning delivery.                                                                         |

A release decision requires AC-001 through AC-008 on the same qualified candidate, the relevant independent assurance and a tested recovery route.
The common path should remove the form and its recurring user effort.
The only added interaction is the optional recovery where its context can change the resulting graph.
