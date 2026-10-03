# Research resolutions for WebVOWL compatibility

Date: 2 October 2026.
Status: Design decisions selected under the owner's instruction to resolve open questions through research.
This document supersedes the candidate remedies R1–R4 where indicated; it does not claim implemented behavior or amend frozen protocol bytes.
Integration resumed at execution generation 23 on 3 October 2026 after explicit dependency and execution-transfer approvals.

## Direction and evidence method

Preserve pre-fork loading and rendering coverage through one explained compatibility path, while assessing stronger export and editing guarantees separately.
A viewer presents information; it does not need to establish every condition required for a sound OWL 2 DL entailment checker before showing that information.
Conversely, a successful picture cannot certify complete source preservation, safe semantic editing or canonical serialization.
This separation follows from the distinct functions of these operations, rather than from a preference for permissive parsing.

Use normative specifications to determine meaning and conformance requirements, authoritative implementation guidance to identify established practice, and explicit engineering reasoning for product choices that neither prescribes.
Older Recommendations remain relevant when they are the applicable standards; a newer draft or tool is not automatically the correct authority.
The community sources below establish concrete precedent, not a survey proving universal consensus.
No third-party implementation was installed or selected as a replacement dependency.

## 1. Admission and validation: resolved

OWL 2 RDF-Based Semantics applies to RDF graphs, whereas reconstructing the restricted structural model used by OWL 2 DL imposes additional conditions.
Failure of the latter is not by itself failure of RDF syntax or a reason a visualization cannot exist.
This does not claim that arbitrary RDF is consistent or that WebVOWL implements a complete OWL Full reasoner. [OWL 2 RDF-Based Semantics, section 2](https://www.w3.org/TR/owl2-rdf-based-semantics/#Ontologies)

The OWL conformance specification distinguishes document conformance and semantic-tool behavior, including explicit error/unknown outcomes for entailment checking.
Do not advertise entailment or strict-conformance results that a compatibility viewer has not established. [OWL 2 Conformance, section 2](https://www.w3.org/TR/owl2-conformance/#Conformance)

**Selected design:** make compatible visualization the ordinary WebVOWL path, with strict source assessment available as a separate result.
Keep syntax admission, source assessment, interpretation completeness and operation availability as separate states.
Malformed syntax that prevents a reliable parse remains a load error; a well-parsed statement outside the supported structural projection is retained as source evidence and diagnosed.
Resource violations remain bounded failures, preserving the previous accepted scene.
Do not implement a failed-strict-parse retry through a second converter: the owning parser must provide the compatible result and its assessment in one documented path.

This is supported as an architectural precedent by Jena's RDF-backed ontology model and explicit compatibility controls; its documentation also warns that inference suitable for reasoning can be unsuitable for a GUI. [Apache Jena Ontology API](https://jena.apache.org/documentation/ontology/)
Those controls are evidence for deliberate compatibility policies, not permission to copy every recovery or claim all existing parser warnings are adequate.

## 2. Conflicting property roles: R1 resolved in direction

RDFS gives `P rdfs:domain C` a property-level meaning: subjects using P belong to C.
It does not ask the author to select an OWL structural property category for that RDF statement.
Multiple domain assertions mean all stated classes, not a union or a user choice. [RDF Schema 1.1, section 3.2](https://www.w3.org/TR/rdf-schema/#ch_domain)

**Selected design:** retain the source property identity, every declared role and the asserted domain/range relation.
Expose that relation in the compatibility projection with a category-conflict qualification when it cannot be assigned uniquely to the current typed model.
Do not arbitrarily choose object versus data property, invent two authored OWL axioms, or require a manual resolution simply to display the relation.
Role-specific glyphs may be qualified, but the source declaration and relationship must remain inspectable.
This is an application projection of asserted RDF facts, not a claim that the conflicting declaration is OWL 2 DL or a new entailment.

Retire the proposal to design a bespoke unresolved-RDF language as a prerequisite for rendering.
The owning parser should expose immutable source terms/statements and structured interpretation evidence using the established RDF/JS term/quad vocabulary where applicable; VOWL owns their display projection.
Preserve per-document blank-node scope and source associations; a source quad is evidence, not an extra invented OWL axiom.
The RDF/JS specification defines interoperable term/quad interfaces, but does not provide provenance, persistence or a complete package contract for us. [RDF/JS Data Model](https://rdf.js.org/data-model-spec/)

An edit is enabled only where its exact affected statements/records and consequences are known.
Qualifying one relation must not disable unrelated navigation, arrangement or safe edits.
When dependency analysis cannot prove that a semantic edit leaves unresolved evidence valid, refuse that edit with a specific explanation; never merely carry stale evidence forward.
This resolves the policy while leaving the public response schema and dependency tracking as concrete design work.

## 3. Unsupported datatypes: R2 resolved

RDF permits unrecognized datatype IRIs; processors should not reject such RDF merely because the datatype is unknown.
Syntactically valid ill-typed literals must also be accepted by an RDF parser, although their value interpretation is invalid.
These rules do not require a stricter OWL profile or reasoner to accept the same input. [RDF 1.1 Concepts, sections 3.3 and 5.4](https://www.w3.org/TR/rdf11-concepts/)

`xsd:time` is a defined XSD datatype. [XSD 1.1 Datatypes, time](https://www.w3.org/TR/xmlschema11-2/#time)
It is absent from the OWL 2 datatype map, and OWL 2 DL restricts reserved datatype IRIs to its permitted vocabulary.
Thus the observed DL assessment is not evidence that the IRI is malformed; it is a different conformance question. [OWL 2 Structural Specification, sections 4 and 5.2](https://www.w3.org/TR/owl2-syntax/#Datatypes)

**Selected design:** compatibility preserves datatype IRIs, declarations/references and exact literal lexical text without coercion, including unknown custom datatypes.
Report three distinct facts where applicable: outside the selected OWL profile, lexical validation unavailable, and lexical validation performed with an invalid result.
Do not call a known XSD datatype unknown merely because its use is outside OWL 2 DL; do not claim its literals validated unless they actually were.
The validator and capability metadata remain owned by `owlapi`.
Avoid both a VOWL-specific datatype allowlist and a blanket exemption from malformed syntax or reserved-vocabulary misuse.
Strict checks keep their existing truthfulness; the compatibility adapter must stop promoting a profile violation into a universal source-admission failure.

## 4. Multiple headers and import closure: R3 resolved in direction

The normative reverse mapping requires an ontology-header pattern to match uniquely.
This supports strict rejection of ambiguous structural ontology identity; it does not make deleting extra header triples a valid repair. [OWL 2 RDF Mapping, section 3.1.2](https://www.w3.org/TR/owl2-mapping-to-rdf/#Parsing_of_the_Ontology_Header_and_Declarations)
Jena documents an explicit multiple-header compatibility strategy, and Java OWLAPI exposes loader policies for strictness and missing imports.
These are established precedents for separating compatibility policy from strict admission, not a normative header-selection algorithm. [Jena compatibility controls](https://jena.apache.org/documentation/ontology/), [Java OWLAPI loader configuration](https://owlcs.github.io/owlapi/apidocs_5/org/semanticweb/owlapi/model/OWLOntologyLoaderConfiguration.html)

**Selected design:** a document with several headers can be viewed without selecting one as its sole semantic ontology identity.
Retain all header subjects and their attached metadata/import declarations with document provenance.
For presentation, prefer a uniquely matching requested ontology/version IRI; otherwise use the document's display name with an explicit multiple-identities indication.
That title is not an assertion that the document IRI and ontology IRI are equivalent.
Preserve requested import IRI, retrieval/document IRI, declared base and source digest separately.
Visit declared imports associated with the document's headers under the same bounded acquisition policy, recording their source header; do not discard imports merely because a display title was chosen.
This traversal is an explicitly documented compatibility policy and must be tested for cycles, repeats and aggregate limits.

Retire mandatory digest-bound header selection for ordinary viewing.
An operation that must produce a single structural ontology identity may still need explicit resolution, but must account for other headers and their metadata before claiming preservation.
In particular, Personas should show an imported-header qualification rather than fail before rendering its otherwise supported content.

Keep deterministic tests offline using pinned, exact-IRI local closure manifests.
In normal compatible loading, an unavailable import produces an incomplete-closure status and the supported available visualization; strict validation/export requiring full closure remains unavailable.
In a full-closure qualification test, a missing fixture is a failed test, not a successful partial-closure recovery.
Live availability, CORS and redirect behavior require their own browser evidence.

## 5. Canonical identity and performance: R4 narrowed

RDFC specifies canonical dataset output and normative algorithm steps; passing its finite test suite is not a complete equivalence proof.
Its specification explicitly recognizes difficult datasets and bounded termination. [RDF Dataset Canonicalization, sections 2 and 7.1](https://www.w3.org/TR/rdf-canon/)
The installed library's upstream guidance documents complexity controls and periodic cancellation; it does not promise inexpensive handling of every connected blank-node structure. [rdf-canonize limits](https://github.com/digitalbazaar/rdf-canonize#limits)

**Selected design:** live document/edit/occurrence identity is operation-local and does not depend on completing portable canonical labelling.
Reuse the accepted separation of runtime references from portable addresses.
Run package-owned admission, interpretation, normalization and scene validation before rendering; defer portable canonical bytes/addresses to operations that require them.
This is one normalized model and one renderer, not a fallback or duplicate normalizer.
Rendering success never admits an object to `encode`; canonical export still uses the actual canonicalization and byte-validation contract.

This requires a deliberate revision of the current API, which returns canonicalized documents from OWL ingestion, and of worker/controller handoffs.
Do not expose a hidden internal stage or bypass package admission as an implementation shortcut.
Canonical artifact input must still be verified as canonical input; delayed output work is not permission to trust malformed files.
Portable canonical-address requests should report their unavailable/pending status until valid addresses exist.

Separately repair canonical export performance: the eight-class reproduction remains a defect even if viewing no longer waits for it.
Prefer optimizing the existing representation without changing output if correctness and the workload envelope can be demonstrated.
If representation-induced anonymous-node work cannot be removed that way, evaluate an explicitly versioned encoding that exposes already-known semantic identity.
Do not enlarge the work ceiling as the default fix, invent an unverified canonical algorithm, drop pairwise semantics, or canonicalize disconnected-looking fragments without proving independence.
The W3C explainer specifically notes that shared blank nodes require dataset-wide context. [RDFC explainer](https://www.w3.org/TR/rch-explainer/)

**Unresolved empirical question:** which bounded implementation or encoding meets the required envelope while satisfying identity and field-distinction proofs.
No standard or popularity claim settles it; the previously proposed experiment budget is not silently reopened by this literature review.
A final design must include exact byte/profile impact and affected conformance evidence before implementation.

## 6. Export, persistence and diagnostics: resolved policy

Retain source snapshots and interpretation evidence alongside the live normalized view, with clear ownership and revision binding.
This does not create a second editable truth: sources are immutable evidence, while edits create a successor whose interpretation/evidence must be reconciled.
Do not equate saving a canonical visualization with archiving every source statement.
Provenance, quality information, version history and preservation are established publication concerns. [W3C Data on the Web Best Practices](https://www.w3.org/TR/dwbp/)

Selected design: saved visualizations state their retained scope and preserve material qualifications needed after reload.
This establishes a persistence requirement, not a blanket export prohibition or a decision to defer the required artifact representation.
Prefer a bounded versioned representation of the selected view and its qualifications.
Any remaining material save/export reduction requires an explicit owner scope decision.
Original-source recovery remains a separate capability and does not replace saving an edited visualization.

For ordinary warnings, use a persistent concise summary and inspectable details without a forced modal or stolen focus.
Announce status changes through accessible semantics; reserve interruptive interaction for a decision required to complete an operation.
Use text and source context, not color alone, and explain the practical consequence before technical details.
This follows WAI guidance on status messages and noninterrupting alerts. [WCAG 2.2 status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html), [WAI alert pattern](https://www.w3.org/WAI/ARIA/apg/patterns/alert/)

## 7. Compatibility oracle and remaining work

Use a pinned pre-fork WebVOWL/OWL2VOWL pair, matched root bytes and matched closure availability to establish the migration baseline.
The upstream converter documents its WebVOWL conversion role; it does not promise a lossless serialization of all OWL constructs. [OWL2VOWL project](https://github.com/VisualDataWeb/OWL2VOWL)
Retain the current fork comparison as diagnostic evidence, not a substitute for that historical oracle.
Compare entities, relations, supported details, recoveries and user operations; exact pixels and arbitrary generated IDs are not the compatibility target.
Do not preserve demonstrated old mistakes merely to make snapshots equal: record the reason, visible consequence and regression evidence for every material departure.

The policies above resolve R1/R2/R3 and the sequencing/guardrails of R4 without asking the owner to choose parser internals.
The remaining work is concrete engineering evidence: a reviewed public API/contract amendment, portable qualification metadata, the measured canonicalization solution, fixture redistribution clearance and matched pre-fork results.
These are not established by this research and must not be marked complete.

Next, draft one coherent contract amendment with exact affected clauses in A6/A7/A9, projection retention, worker operations and the accepted application boundary.
Keep detailed `owlapi` implementation planning in its own repository.
Reuse the existing review budget after consolidating the concrete design and evidence; no new reviewers, retries, benchmarks, code, dependencies or configuration changes were authorized or performed by this research pass.
Research settles the recommended design direction; it does not overwrite frozen contracts or resume integration.
The subsequent [amendment draft](../specs/2026-10-02-canonical-vowl-compatible-view-amendment-draft.md) records the concrete proposed interface and exact authority impact, including successful qualified save/reload and bounded recovery requirements.
The independent Astra review supersedes the earlier blanket export restriction and mandatory replay proposal; section 8 records the synthesis.

## 8. Post-review synthesis and remaining decisions

The owner requested all proposed changes from the [independent Astra review](canonical-vowl-independent-astra-review.md), followed by resolution of open issues using the established ladder.
The replacement blocks are incorporated into the amendment; this section distinguishes selected policy from evidence still required.
The ladder is first-principles reasoning about the user's outcome and invariants, then applicable authoritative specifications and guidelines, then established community practice where those leave a choice.
Neither popularity nor a standards citation establishes an unmeasured performance or recovery claim.

### Selected policy

1. Preserve operations, not merely successful loading.
   The compatibility baseline includes material relationships, details, arrangement, supported edits, visualization save/reload and each existing export format.
   Prefer a minimal versioned selected-view artifact where v1 cannot express required records or qualifications; do not introduce a general source archive.
   Machine-readable interpretation, closure and retained-scope qualifications travel with the saved view.
   Original source bytes, acquisition credentials and transient diagnostic logs are not required portable payload.
   This is a product and data-minimization decision, informed by the provenance and versioning guidance in [Data on the Web Best Practices](https://www.w3.org/TR/dwbp/), not a W3C-prescribed artifact schema.
2. Determine coverage from source accounting before fixing a new constructor inventory.
   Reuse existing constructors for unambiguous statements; add qualified source-backed representation only for demonstrated gaps.
   Do not invent property categories, discard inverse/characteristic relations, or treat a diagnostic as a substitute for a previously visible relationship.
   Property-level domain meaning is established by [RDF Schema](https://www.w3.org/TR/rdf-schema/#ch_domain); the exact projection remains our design obligation.
3. Keep ownership and identity explicit.
   The package owns interpretation, normalization and the five accepted edit operations; the application owns human-command translation and atomic acceptance of model plus complete scene.
   Inspection records distinguish source-supported, generated and canonical-origin content, with many-to-many provenance and explicit unavailable coverage.
   Request and result schemas must close reference domains, revision binding, error precedence and correspondence before implementation.
   Candidate method names are not additional architectural commitments.
4. Prefer bounded complete-state checkpoint/readmission as the first recovery candidate to qualify.
   A checkpoint containing the complete accepted state avoids replay history growth and reconstruction of old command targets; it must preserve revision-local references explicitly and pass the same live validator on readmission.
   Keep it outside the worker that may be terminated, and accept a replacement checkpoint only with the application transaction.
   This is an engineering preference, not a selected implementation: compare its state completeness, validation cost, memory and identity guarantees with bounded replay before choosing.
   Replay is justified only if that comparison establishes a smaller qualified solution; it must then prove cross-execution correspondence and bounded compaction.
   The [HTML worker termination model](https://html.spec.whatwg.org/multipage/workers.html#terminate-a-worker) explains why worker-local state cannot itself be the recovery guarantee; it prescribes neither alternative.
5. Keep artifact integrity separate from ontology identity.
   Selected semantic records participate in the applicable semantic identity contract; the complete artifact's integrity must cover its scene and material qualifications as well.
   Diagnostic wording, timing and credentials must not determine ontology identity.
   Specify each new field's identity participation before freezing its grammar; preserve all existing v1 definitions and bytes.
   This design rule does not yet select a new profile identifier or hash layout.
6. Repair ordinary-input canonicalization within finite controls.
   First qualify a byte-preserving solution; select a new explicitly versioned mapping only if the measured evidence establishes that need and its correctness.
   The eight-class, sixteen-class and full Personas closure cases must pass the existing default work/deadline envelope on a recorded reference environment, with elapsed time and peak memory reported.
   Poison-input and cancellation bounds remain separate acceptance obligations.
   [RDFC conformance](https://www.w3.org/TR/rdf-canon/#conformance) governs canonicalization claims; it does not make these ordinary product failures acceptable or prove an alternative mapping correct.

### Evidence gates that research cannot close

| Remaining question                                               | Minimum discriminating evidence and decision rule                                                                                                                                                                                                               | Owner and boundary                                                                                                                                           |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Exact retained/inspection/artifact schemas and public signatures | Complete minimized-case and matched OntoViBe statement accounting, then the smallest closed grammar supporting the operation matrix; specify identity participation, limits, reader behavior and migration together.                                            | VOWL contract owner; upstream public evidence details and implementation plans stay in `owlapi`. No implementation-defined schema.                           |
| Checkpoint versus replay and worker lifetime                     | Compare both designs against all input kinds, anonymous/symmetric records, merges/inserts, complete scene restoration, resource bounds and crash timing around application acceptance. Prefer checkpoint/readmission if it satisfies these with less machinery. | Integration owner; no persistent-worker mandate or reliance on equal handle strings.                                                                         |
| Canonicalization optimization or new encoding                    | A measured candidate, unchanged-profile byte checks, identity/field-distinction proof and affected independent oracle evidence. Passing finite vectors alone is insufficient.                                                                                   | Canonical core owner; the exhausted diagnostic allocation is not reopened by this synthesis. Any further experiment must have its own bounded authorization. |
| Portable full-closure fixtures and historical oracle             | Pin the pre-fork converter, exact roots/imports, availability ledger and redistribution rights; compare operations and material content.                                                                                                                        | Integration owner; local diagnosis does not establish redistributable release evidence.                                                                      |
| Any unavoidable capability reduction                             | Identify exact affected inputs/operations, alternatives tried and the smallest remedy.                                                                                                                                                                          | Owner product decision only if the bounded repair demonstrably cannot preserve the capability; no reduction is accepted now.                                 |

No additional review, benchmark, dependency/configuration change, contract freeze or integration resumption follows from these documentation decisions.
The next contract revision should close the finite schemas and operation matrix using existing evidence before requesting any new bounded experiment.

The subsequent documentation revision supplies the candidate common inspection/evidence vocabulary, operation matrix and recovery comparison in amendment sections 10–13.
It resolves current-versus-original source association and the application commit boundary, while retaining the constructor, registry, artifact and measured-proof gates.
These candidates have not undergone a new independent review and are not a frozen interface.

## 9. Decisions selected after owner clarification

The owner clarified that open engineering choices should be resolved using the ladder, not repeatedly deferred as approval questions.
The [amendment's decision register](../specs/2026-10-02-canonical-vowl-compatible-view-amendment-draft.md#13-resolved-engineering-decisions) now selects the designs below and supersedes candidate language in section 8.
Unperformed validation remains unperformed; it does not make the selected design an unanswered question.

| Topic                 | Selected decision                                                                                                                                                                      | Ladder basis                                                                                                                       | Remaining delivery evidence                                                                               |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Retained relations    | Existing typed constructors first; exact source-statement records for genuinely non-unique mappings, with finite structural projection including inverse and characteristic relations. | Preserve asserted meaning and visible relationships; RDF/RDFS meaning before converter heuristics.                                 | Statement accounting and projection regressions against matched closures.                                 |
| Saving                | New versioned compatible artifact containing selected semantic records, complete scene and material qualifications; retain v1 readers/bytes and reject lossy downgrade.                | A saved visualization must reopen truthfully; provenance/versioning guidance supports explicit qualifications, not export removal. | Field tables, reader/migration tests, identity distinctions and successful six-example save/reload.       |
| Recovery              | Complete checkpoints outside the worker; package readmission; existing per-operation workers. Do not implement event replay.                                                           | Recover the exact accepted state with minimal new machinery; structured cloning is transport, not validation or admission.         | Reference preservation, bounded copy/validation cost, crash and cancellation cases.                       |
| Public interface      | Five live operations plus checkpoint/readmission on existing package surfaces; one inspection response owns diagnostics and assessment.                                                | Deep package ownership, no controller normalization and no duplicated result truth.                                                | Mechanical closed signatures/schema tables and consumer tests.                                            |
| Errors and identities | Reuse existing errors; six explicit new failure codes; semantic identity excludes diagnostic prose, while artifact identity includes persisted qualifications and scene.               | Distinguish user-meaningful failure and preserve every claimed artifact field without conflating source identity and presentation. | Error precedence and per-field canonical distinction tests.                                               |
| Performance           | Standard RDFC, current limits, byte-preserving optimization first; measured versioned-mapping correction if the ordinary-input gate fails.                                             | Preserve established correctness before altering representation; standards cannot supply a performance measurement.                | Eight-/sixteen-class and full Personas success, poison bounds and affected independent identity evidence. |
| Baseline and fixtures | Pinned pre-fork oracle and offline complete closures, source rights verified before redistribution.                                                                                    | Reproducible comparison and native reuse before additional fixtures.                                                               | Exact manifests, rights and operation-level comparison.                                                   |

No further owner choice is needed for these engineering alternatives.
Return to the owner only for a demonstrated material capability reduction, expanded product scope, exact configuration mutation or additional work beyond an exhausted explicitly bounded experiment/review allocation.
The previous table's remaining-question wording now denotes delivery tasks under these decisions, not a request to select parser or worker internals.
No benchmark, implementation review or integration resumption was performed in making these decisions.

## 10. Delivered upstream boundary

Subsequent coordination settled the producer boundary around Java OWLAPI-compatible `RDFParserMetaData`, not a VOWL-specific source ledger or neutral ontology model.
The [merged delivery record](canonical-vowl-application-integration.md#upstream-delivery-received-on-2-october-2026) identifies owlapi revision `19cf43d4288d20a737ecac0a39ccd1c53f9a3e77`, its contract and upstream qualification.
The [amendment reconciliation](../specs/2026-10-02-canonical-vowl-compatible-view-amendment-draft.md#14-upstream-contract-reconciliation) supersedes earlier text that assigns exhaustive source accounting or a new interpretation mode to owlapi.
Compatible header/property selections remain documented upstream interpretations with diagnostics; VOWL must distinguish them from explicit authored declarations and qualify affected operations.
An empty unparsed-triple set does not establish full source coverage; missing provenance must not be fabricated from loader metadata.
The producer repair is delivered, while maintained dependency adoption, consumer implementation and exact application acceptance remain outstanding.
