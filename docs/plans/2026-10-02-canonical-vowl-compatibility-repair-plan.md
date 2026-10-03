# Canonical VOWL example compatibility repair plan

Status: Owner-approved bounded repair baseline, with a proposed compatibility-direction revision recorded on 2 October 2026.
The owner approved implementation and qualification after the design synthesis, then approved the exact npm alias update and execution adoption/resumption on 3 October 2026.
Proceed with COMPAT-01 and bounded diagnosis; semantic/performance contract decisions explicitly reserved below remain separate gates before dependent implementation.
HISEW execution `2b2b2dd5-1d9d-46cb-8646-24c2dd8b31ab` is active at generation 23 after adoption at generation 22; the generation-21 dependency approval pause is resolved.
The initial bounded diagnosis and requested decisions are recorded in the [compatibility decision packet](../reviews/canonical-vowl-compatibility-decisions.md).
The owner requested documentation of the proposed direction below; that request does not approve R1–R4 or amend the frozen canonical contracts.
The owner subsequently delegated research-based resolution of open decisions.
The [research resolutions](../reviews/canonical-vowl-compatibility-research.md) now select the technical direction and narrow remaining work to concrete contract design and empirical qualification; they do not resume implementation or change frozen authorities.
The [compatible-view amendment draft](../specs/2026-10-02-canonical-vowl-compatible-view-amendment-draft.md) records candidate public capabilities and the required interpretation, persistence and recovery guarantees.
Exact interfaces and worker lifecycle remain subject to the consolidated contract and evidence; no first-delivery export restriction has been accepted merely by documenting it.
The owner's subsequent instruction to decide open engineering issues selects the designs in amendment section 13 and research section 9: checkpoint/readmission with per-operation workers, a versioned compatible artifact, typed-first source retention and unchanged RDFC resource controls.
These replace earlier candidate alternatives; remaining schema transcription and qualification are delivery work, not repeated owner design questions.

The narrowed Java-compatible producer repair is now delivered through owlapi PR #27 at merged revision `19cf43d4288d20a737ecac0a39ccd1c53f9a3e77`.
Use the [delivery record](../reviews/canonical-vowl-application-integration.md#upstream-delivery-received-on-2-october-2026) and amendment section 14 for its exact public contract and evidence boundaries.
Do not implement the earlier proposed upstream `SourceAccounting` API, neutral multi-header model or new parser mode.
Remaining source-to-view accounting, profile/admission policy, qualified artifacts and performance repair are consumer work.
The subsequent published `@hadden-industries/owlapi@0.1.0-rc.1` is now adopted through the approved native npm alias in both declarations and their lock graph.
The integration report records exact registry integrity and consumer qualification; earlier Git-pin proposals are superseded.

## Proposed compatibility direction

Users moving from pre-fork WebVOWL to WebVOWL 2.0 should reasonably expect to load and render the same ontologies, including their import closures, with only minor, defensible differences and better logging and explanations.
Established rendering coverage is the product baseline; the six examples are immediate regression cases, not the complete supported-ontology inventory.
The internal design must serve this expectation rather than use stronger canonical-preservation requirements as a blanket admission test for visualization.

Follow one coherent processing path: `owlapi` owns parsing and documented compatibility interpretation; VOWL consumes the resulting model and diagnostics; WebVOWL presents the visualization and its qualifications.
Do not introduce a fallback converter, example-specific repairs or a second hidden interpretation path.
A partially understood source must have an honest, inspectable outcome rather than be presented as fully preserved.

Distinguish the guarantees required by each user operation:

| Operation        | Proposed user-facing contract                                                                                                                                                                                                                                                           |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Load and render  | Preserve established coverage. Display the supported interpretation and explain ambiguity, recovered interpretation and unrepresented content. Do not demand source repair solely to obtain a visualization that the pre-fork application could provide.                                |
| Inspect          | Make the interpretation and its limitations available in understandable terms, with source context where possible. Diagnostic details supplement the graph; they do not excuse a hidden loss or a misleading success claim.                                                             |
| Canonical export | State precisely what the artifact preserves. Rendering success does not prove complete source preservation or authorize omission under a lossless claim. If stronger guarantees cannot be met, constrain or qualify this operation according to an explicitly accepted export contract. |
| Semantic editing | Permit an edit only where its target and consequences are sufficiently defined. Explain and constrain the affected operation when ambiguity would make it unsafe, without automatically rejecting the whole visualization.                                                              |

These are proposed capability distinctions, not an implemented API or permission to weaken current encoding/editing guarantees.
The design must establish where interpretation diagnostics and unresolved source information live, how they survive relevant operations, and which operations remain available.
It need not solve every preservation ambiguity before an ontology can be viewed.
Ordinary-input performance failures, including the eight-class disjointness reproduction, are defects to repair while retaining finite resource and cancellation controls.

Pre-fork behavior is the compatibility baseline, not proof that every historical interpretation was correct.
Material changes need a reproducible before/after case, a defensible semantic or usability reason, an explanation visible to the user, and a regression test.
Rejecting previously viewable ontologies merely because they are not OWL 2 DL is not an adequate compatibility policy.
Genuinely unprocessable or resource-exhausting inputs still need bounded failure with a useful explanation; universal acceptance is not promised.

### Evidence and design consequences

Qualify a pinned pre-fork WebVOWL/converter version against the same pinned local import closures used for the candidate.
Our current fork's converter is useful diagnostic evidence but cannot alone establish pre-fork equivalence.
Existing Java outputs are usable only with verified converter identity, source versions and import availability; otherwise regenerate the affected reference under the matched closure.
Compare visible entities and relationships, retained details, diagnostics and supported operations, not just successful return codes or aggregate counts.
Extend beyond the six examples using the existing representative corpus before making a general WebVOWL 2.0 compatibility claim.

Simplify the pending design around three questions: what users can view, what the application must explain, and which additional guarantees export/editing require.
R1–R4 in the decision packet identify technical findings and earlier candidate remedies; follow the research resolutions where those remedies are superseded.
In particular, neither a general unresolved-statement model nor an ontology-header selection interface is preselected as a prerequisite for rendering.
Replace or narrow those remedies where a documented, defensible compatibility interpretation satisfies the user-facing contract.
Keep performance repair as an explicit workstream, with any canonical-byte/profile changes separately reviewed.
Before implementation, identify the exact required amendments to source admission, retained model, worker/application ownership and export/editing contracts; do not silently relax the existing authorities.

## Purpose and accepted baseline

Restore a credible replacement path for the six established examples without hiding unsupported content, guessing ontology meaning, or removing finite resource controls.
This is a bounded corrective supplement to the [eight-slice plan](2026-09-24-canonical-vowl-implementation-plan.md), not a restart or completion of SLICE-005.
The [application integration report](../reviews/canonical-vowl-application-integration.md) records the source qualification and previous-converter comparison.
The accepted application boundary remains unchanged.
The draft's proposed changes to live admission and worker ownership do not supersede the accepted application boundary until their exact contract is accepted.
Preserve its command mapping, human-only editing authority, complete-scene invariant and atomic application acceptance rules.
All existing partial integration files, historical examples and unrelated working-tree changes remain preserved.
The document session module is still unqualified; the 59 passing foundation tests do not cover that module or integrated application behavior.

The six exact source files are pinned by SHA-256 in `original-owl-qualification.json`, under the report's external evidence directory.
Their source repository is `universal-ontology` at `83a5d7d5306a0752f20f9abd553aeacc49ed70cb`.
All six pass the existing converter's single-document compatible-mode route; this comparison disabled remote imports and is not proof of full-closure or lossless equivalence.
That root-only run is diagnostic isolation evidence, not the normal WebVOWL acceptance baseline.
Qualification requires the complete recursively resolved import closure, served from pinned local resources in deterministic tests through the public acquisition boundary.
MUTO alone passes the new adapter unchanged.
The committed Java-reference outputs are additional comparison material, not a newly verified oracle.

## Scope and ownership

The scope is these six source cases, minimal reproductions of their failures, and affected shared contracts and regressions.
No general OWL Full reasoner, unrestricted RDF editor, new input-format catalogue, fallback converter, source-specific special case or bulk fixture expansion is proposed.
Source files in `universal-ontology` remain read-only.
No dependency, lockfile, test configuration or CI change is approved by this document.

`owlapi` owns RDF-to-OWL interpretation, parser preservation evidence, datatype assessment and public capability metadata.
Any detailed upstream implementation plan must be created and retained in the `owlapi` repository, with only its public delivery requirements referenced here.
VOWL owns compatibility mapping policy, its retained model, canonical RDF encoding and canonicalization budgets.
WebVOWL consumes those public interfaces and owns example acquisition/provenance, inspection, complete scene initialization and interaction.
One integration owner coordinates sequential delivery; no new delegation or parallel write work is authorized.

## Findings and proposed decisions

| Case          | Established finding                                                                                                                                                                                                        | Bounded repair direction                                                                                                                                                                                                                                                              |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FOAF and SIOC | Preserve-mode RDF translation rejects multiple property-role candidates. Both affected properties have an `rdfs:domain` statement without a unique structural property role. The old converter emits recovery diagnostics. | Trace declarations and each affected statement independently. Preserve all unambiguous roles and assertions. A recovery that chooses or duplicates a typed axiom requires an explicit semantic policy, not merely removal of a rejection.                                             |
| GoodRelations | `xsd:time` produces reserved-IRI and datatype-assessment violations; the old converter accepts it without diagnostics.                                                                                                     | Separate well-formed datatype identity, OWL 2 DL admissibility and unavailable lexical validation. Propose a narrowly specified compatibility treatment for datatype references as well as literals, while strict assessment remains truthful.                                        |
| OntoViBe      | The available cardinalities variant uses `owl:subClassOf`, has a different ontology root from the historical example, and previously converted with an unconsumed-triple diagnostic.                                       | First qualify the matching versioned original. Do not silently rewrite the predicate or claim the cardinalities variant reproduces the old example. If only this variant is usable, document exact retained/unrepresented statements and request the necessary source/model decision. |
| Personas      | Default and maximum RDFC work budgets both fail. The former converter accepts the root with a missing-import diagnostic.                                                                                                   | Diagnose generated RDF cost before considering policy changes. Prefer an optimization preserving current canonical bytes; an encoding change requires an explicit contract/version and evidence-migration decision.                                                                   |
| MUTO          | New adapter passes with no diagnostics.                                                                                                                                                                                    | Keep as an unchanged positive control across all repair steps.                                                                                                                                                                                                                        |

Preserve strict-mode guarantees; any proposed compatible parsing policy must have explicit observable interpretation and operation-specific guarantees.
Reusing documented compatible behavior is a candidate to assess under the proposed direction, not authority to globally switch parsing modes without source accounting.
For genuinely ambiguous statements, the decision packet must compare explicit source-scoped resolutions with a general representation of unresolved source statements.
The latter could preserve more source information, but changes the retained model and may exceed this bounded repair; it is not preselected or authorized here.
Choosing a role from a property's name, range heuristic or previous converter preference is not an acceptable implicit fix.
Acceptance of an example must state what is represented, what is diagnosed and what remains unresolved; a success flag alone is insufficient.

The relevant primary references are the [OWL 2 structural specification](https://www.w3.org/TR/owl2-syntax/), [RDF mapping specification](https://www.w3.org/TR/owl2-mapping-to-rdf/) and [RDF Dataset Canonicalization recommendation](https://www.w3.org/TR/rdf-canon/).
The RDF mapping tables establish structural interpretation requirements; they do not by themselves supply a recovery policy for arbitrary OWL Full graphs.
RDFC has difficult worst cases and permits defensive bounds; that does not establish that these application-generated datasets have an acceptable operating envelope.

## Bounded diagnosis before implementation

### Import-closure baseline

Reuse the exact-IRI catalogue/local-resource approach already implemented by `installLocalOntologyFetch` in `src/owl2vowl/test/vowlDifferential.js` and the production `WebVowlImportResolver` acquisition boundary.
Adapt the test acquisition response to the public VOWL `resolveImport(importIri, { importingDocumentIri, signal })` callback, returning exact bytes, document IRI and media type.
The owning OWL manager must still parse and recursively traverse imports; tests must not replace this with preassembled ontologies or a flattened graph.
Production WebVOWL supplies remote acquisition through this boundary; the package itself does not own network access.

Build one compact closure manifest for the six roots with shared documents stored once.
Record requested import IRI, applicable catalogue mapping, logical acquisition/document IRI, media type, local path, SHA-256, provenance and licence evidence.
Record parent-to-import edges separately, including cycles and repeated references.
Preserve document/base IRIs used to resolve relative references; a local fixture pathname must not become the ontology's base IRI.
Reuse existing exact mappings and qualified local documents where their bytes and identity match the intended source version; basename similarity is not evidence of equivalence.
Pin redirects or negotiated representations where relevant rather than relying on a changing live response.
Acquiring any missing source is a separate recorded fixture-refresh step; ordinary test runs are offline and must not fetch a catalogue miss from the network.

Run old and new converters against the same resolved documents and the same import availability policy.
Assert the observed acquisition ledger and imported model content, not just a nonthrowing root conversion.
An unexpected lookup, missing file, hash mismatch or unaccounted import fails the full-closure harness even if compatibility mode could otherwise report a warning and continue.
Where an import cannot be acquired or legally redistributed, record the gap and withhold full-closure qualification; an empty substitute is forbidden.
Historical Java outputs whose imports were unavailable remain partial-closure comparison evidence until regenerated against the same manifest.
Do not reuse the old harness's deliberate `unavailableImports` exclusions as the new success baseline.

Keep explicit missing-import, cancellation, cyclic/diamond import, duplicate document identity, relative-base and aggregate-byte-limit cases as separate negative/boundary tests.
Include an imported-only class or axiom and an invalid imported axiom to prove both retention and strict validation cross the root boundary.
Measure Personas again only after closure inventory is established and within the bounded diagnostic allocation below: the root-only timing and collision counts are not a closure performance result.
Qualify actual browser HTTP behavior separately, including cancellation, response media type, redirects and CORS failures; offline semantic tests do not prove live remote availability.

### Per-case diagnosis

Produce one consolidated design aligned with the researched compatibility resolutions rather than requesting a succession of small approvals.
Each failure needs a minimized case, exact owning stage, source/model accounting, proposed fix, strict/compatibility outcomes and affected contract sections.
Do not generate expected output from the implementation under test and call it independent evidence.

1. For FOAF/SIOC, reduce each first failure to declarations plus the domain/range statement; separately examine subsequent failures once the first is understood.
   Compare the old diagnostic and emitted axiom behavior with the preserve-mode statement accounting.
   Classify each case as an implementation defect, supported lossless recovery, or unresolved semantics requiring an owner decision.
2. For GoodRelations, exercise a datatype range, a datatype declaration and a literal independently.
   Determine whether the owning validator conflates unsupported validation with source invalidity, or the adapter applies an intentionally strict restriction in compatibility mode.
   Define exact diagnostics and negative cases for genuinely malformed/reserved misuse; no blanket exemption for XSD IRIs.
3. For OntoViBe, make one targeted search of the upstream versioned ontology inventory/history and compare ontology/version IRIs with the historical bundle.
   Record a pinned source or a precise unresolved provenance gap; do not expand into open-ended ontology repair.
4. For Personas, inspect first-degree collision groups, then instrument at most two evidence-driven reduced cases to identify the expensive N-degree branch.
   Stop each probe at the existing work/deadline bounds; no repeated maximum-budget runs and no ceiling increase.
   Compare annotation containers, pairwise disjointness occurrences and shared structural references without changing production semantics.

The standalone `personas-first-degree-probe.mjs` has already completed, stopping intentionally before N-degree search.
It observed 6,834 quads, 1,638 blank nodes, 330 unique first-degree groups and 58 collision groups containing 1,308 nodes.
The largest groups include 120 disjoint-edge occurrences and 120 two-member set containers.
These are hash-equivalence groups, not evidence that the complete graph has corresponding automorphisms or proof of the expensive branch.
The probe replaces a function only within its own Node process and restores it; installed modules and repository implementation are unchanged.
Its deliberate stop surfaces as `DEPENDENCY_FAILURE`, which is a probe artifact rather than an additional product defect.

Budget: one diagnostic pass per failure family, at most one corrected rerun of a failed diagnostic, and the two reduced Personas probes above.
Record an unresolved question when that budget is exhausted and obtain a new decision before expanding.
An inspectable standalone script is the preferred replacement for a shell form rejected by an execution guard; do not change the guard or allowlist.

## Proposed repair increments and proof

These supplement the original slices; they do not renumber or mark them complete.
The increments below retain the approved repair baseline and evidence obligations.
Their mechanisms follow the synthesized amendment and research section 8; remaining empirical gates do not authorize capability reductions.

| Increment                              | Complete observable outcome                                                                                                                                      | Traceability                                | Proof and dependency                                                                                                                                                                                                                    |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| COMPAT-01: Baseline and decisions      | Six pinned roots with complete local import-closure manifests, minimized failures and statement-accounting expectations form one reviewable acceptance baseline. | REQ/AC-007, 009, 012; QA-005; DEC-007, 009. | Exact root/import hashes, document/base IRIs, formats, acquisition ledger, same-closure old/new outcomes and owner-selected recovery semantics. Missing closure resources block qualification. Entry gate for subsequent increments.    |
| COMPAT-02: Datatype compatibility      | GoodRelations traverses the public owning parser/validator and VOWL adapter with exact datatype identity and qualified diagnostics.                              | REQ/AC-001, 007, 011; QA-005.               | Minimal range/declaration/literal matrix, strict rejection or unverified outcome as specified, malformed negative cases, full-source preservation and full GoodRelations regression. Upstream delivery first if required.               |
| COMPAT-03: Property-role compatibility | FOAF/SIOC retain the accepted meaning with no silently chosen property role or omitted annotation.                                                               | REQ/AC-001, 007, 009; QA-001, 005.          | Independently enumerated statement-to-record ledger, equivalent syntax cases only where the same meaning is representable, declaration/order permutations and intentional ambiguous negatives. Requires the explicit recovery decision. |
| COMPAT-04: Canonicalization envelope   | Personas completes within the existing default work/deadline limits on a recorded reference environment while poison inputs remain bounded.                      | REQ/AC-002, 006, 010; QA-001, 003.          | Exact bytes for unchanged profiles, independent oracle comparison, handle/set permutations, elapsed time and peak memory, cancellation and poison cases. New encoding/profile requires separate approval before implementation.         |
| COMPAT-05: Example regeneration        | All six have a supported source-to-artifact path and an explicit content-difference report, with original files preserved and fresh layouts.                     | REQ/AC-005, 007, 009, 012; QA-004, 005.     | Decode/re-encode, complete placements, retained details and diagnostics, ontology identity and import-closure accounting. Depends on the preceding accepted repairs and OntoViBe provenance resolution.                                 |

If Personas cannot meet the proposed default-envelope target without a contract change, stop at a measured decision packet rather than accepting the maximum ceiling as the ordinary path.
A smaller RDF encoding is a candidate to evaluate, not an approved algorithm or promise of unchanged identifiers.
Adding distinguishing triples, changing blank-node allocation or canonicalizing pieces independently can change canonical IDs and bytes; these are not transparent performance refactors.

### Post-review completion requirements

Apply the [synthesized amendment](../specs/2026-10-02-canonical-vowl-compatible-view-amendment-draft.md) and [remaining-decision register](../reviews/canonical-vowl-compatibility-research.md#8-post-review-synthesis-and-remaining-decisions) to every increment.
COMPAT-01 inventories all material matched OntoViBe statements, including inverse and characteristic-related facts, before selecting new record kinds.
COMPAT-03 establishes many-to-many source accounting, generated-record origins and qualified projection; it does not cap source relations at three predicates.
COMPAT-04 covers the eight-class and sixteen-class reproductions as well as the full Personas closure under the default envelope, with version-specific byte obligations.
COMPAT-05 qualifies successful visualization save/reload, supported edits and JSON/Turtle/SVG/LaTeX operation coverage for all six examples, with complete scenes and persisted material qualifications.
Document format-specific limits rather than claiming drawing exports preserve ontology semantics.
No blanket capture prohibition is accepted; any demonstrated material capability reduction requires an itemized owner decision.
Close recovery and inspection contracts before integration resumes, preserving the accepted application commit point and testing all supported input kinds.
The documentation synthesis does not replenish the diagnostic or independent review budgets.

## Reuse, fixtures and review limits

Reuse existing OWL parser/profile fixtures and applicable RDF canonicalization standard vectors rather than duplicating those standards' suites.
Add only minimized reproductions plus the six real-source cases, using the existing consolidated corpus convention and a compact manifest.
VOWL-specific evidence must still cover internal encoding, topology, correspondence, artifact state and diagnostic preservation: OWL/RDF syntax tests cannot establish these contracts.
Pin source provenance and rights before copying or distributing fixtures; until then local read-only inputs may support diagnosis but are not portable release evidence.

Use the current dependency and public APIs first.
If a dependency optimization/replacement is proposed, qualify its version, licence, browser support and consumer behavior before selecting it; request exact package/lockfile changes separately.
Never import dependency internals into production based on their use in a disposable diagnostic probe.

Consolidate implementation and local evidence before one scoped independent Claude Code review covering semantic preservation, canonical identity and resource safety.
Proposed review budget is one 10-minute pass and at most one 10-minute finding-only follow-up; a timeout or authentication failure has no automatic retry.
Any remaining gap returns to the owner; review availability must be demonstrated, with no substitute provider or additional spending inferred from role approval.
If an A6/profile change affects the independent conformance producer, its affected oracle evidence must also be regenerated and checked under an explicitly agreed bounded assignment.
Unchanged evidence stays valid; do not broadly repeat historical reviews.

## Verification, resumption and recovery

Run focused package and owning-parser checks after each repair, then affected conformance/adapter suites after consolidation.
Run the repository's required HISEW full profile only on the finalized candidate; retain the distinction between a passing component probe and full execution verification.
Record exact commands, dependency/source identities, diagnostics, byte digests, resource counters and reached limits.
Worker qualification must show cancellation, deadline termination and zero partial/stale installation, not merely a Node timeout.
No telemetry or external source transmission is needed for diagnosis.

Propose a separate signed commit at each complete reviewed repair boundary, subject to current commit authorization and the committing-to-git procedure; pushing remains separately authorized.
Do not commit the current partial application integration as a completed slice.
After all six are accounted for and the owner accepts the repairs, explicitly resume the paused execution and continue SLICE-005 from the preserved files.
Revalidate the document session and controller integration before relying on them.
Qualification, contract freeze, publishing, production cutover and legacy retirement remain separate gates.

Failed experiments publish no candidate artifact and change no original source.
Keep the existing application as the operational baseline while the candidate is incomplete.
If canonical bytes or profile identifiers change, inventory every affected fixture/manifest and reader before migration; do not overwrite historical authority or assume the old application can read new artifacts.
Replan if the required solution becomes a general RDF/OWL Full model, changes the canonical identity algorithm/profile, needs unbounded work, cannot preserve accepted facts, or exceeds the review/diagnostic budget.
Those outcomes require the owner to choose the expanded design; they must not be disguised as a small compatibility patch.
