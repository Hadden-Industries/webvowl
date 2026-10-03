# Compatible viewing and canonical capture amendment

Status: Draft, 2 October 2026; not a frozen authority or implemented API.
Prepared under the owner's instruction to proceed from the [research resolutions](../reviews/canonical-vowl-compatibility-research.md).
The [original contracts](2026-09-24-canonical-vowl-core-contract.md) and retained conformance evidence remain unchanged.
Implementation resumed on 3 October 2026 after the exact published-dependency and execution-transfer approvals; this contract remains a draft pending qualification.
Section 14 records the subsequently delivered Java-compatible owlapi boundary and supersedes earlier proposed upstream requirements where inconsistent.

## 1. User outcome and scope

An ontology viewable in the pinned pre-fork baseline should load with its available import closure and render in WebVOWL 2.0, with material differences explained and tested.
Successful viewing does not imply OWL 2 DL conformance, complete source preservation by the canonical profile, or permission to perform every semantic edit.
One owning parse/interpretation pipeline supplies one live model and one occurrence projection.
There is no fallback converter, controller normalization, inferred legacy dialect or example-specific interpretation.

The first delivery restores viewing, inspection and arrangement while preserving the existing safe editing and export capabilities of the migration baseline.
Compatibility is assessed by operation: loading, visible relationships, inspection, arrangement, supported edits, visualization save/reload and each existing export format.
A diagnostic alone does not justify a material reduction in those capabilities.
Any proposed reduction must identify the affected inputs and operations, the concrete reason, and the smallest remedy; a material reduction requires the owner's explicit product decision before cutover.

This work does not add a general RDF editor, general reasoning or a source archive.
Canonicalization performance on ordinary supported inputs remains a release requirement even when viewing does not wait for portable identifiers.

## 2. Two admission types

### Live model

A `LiveModel` is an immutable, package-admitted value representing one interpretation revision.
It contains validated semantic records, generated occurrences, source evidence and operation qualifications.
Its handles are unique within the revision, carry no semantic or portable identity claim, and need not be invariant under independent re-import.
Normalization and correspondence are owned by the package and shared with existing canonical operations.

Source evidence consists of exact acquired bytes and their interpretation context: requested import IRI, retrieval/document IRI, effective base IRI, media type, source digest, header associations and the owning parser's structured accounting.
The root and every acquired import have distinct source-document identities; blank-node identity is scoped to that document.

Source accounting is a many-to-many relation between source assertions and retained records.
Each assertion is classified as represented, represented with qualification, excluded by the selected projection, or unrepresented.
Represented assertions identify all corresponding records; merged records retain every contributing source reference.
Generated records identify their normalization or projection rule and supporting records instead of inventing an authored source statement.

A model opened from canonical content records that origin and the admitted profile.
It does not claim access to original source bytes, original closure completeness or interpretation evidence absent from that content.
Original-source coverage is unavailable in that case, not established as complete.

Original source bytes remain immutable evidence after edits.
Successful edits identify which retained facts and source-accounting associations they supersede; original bytes are never presented as the edited ontology.
Diagnostics have stable codes, bounded explanations and valid evidence/record references.
Complete accounting remains inspectable even when an assertion has no drawable counterpart.
Malformed syntax, invalid input encodings and exhausted admission budgets remain errors; a syntactically admitted statement outside the supported interpretation is not by itself a whole-document load error.

### Canonical document

An `AdmittedDocument` retains A7's existing meaning: complete canonical validation and labelling have succeeded in this module instance.
Only such a value is accepted by `encode`.
Freezing, cloning, rendering or admitting a live model never grants canonical encoding authority.
Existing `canonicalize`, `decode`, `encode` and canonical `edit` contracts remain available to canonical-document consumers and share the same internal normalizer/validators with the live path.
The new live editing operation is not a second implementation of normalization.

## 3. Proposed public interface

Keep the three existing export surfaces.
The operation names are selected in section 13; this draft remains unfrozen pending implementation qualification.
Select the smallest interface that supports the qualified consumer paths without exposing private dependency objects or duplicating interpretation, normalization or command translation.

| Surface and operation                        | Input and output                                                                                                                                                                                                                                                                  | Guarantee                                                                                                                                                                                      |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `vowl/owl`: `openOwl(bytes, options)`        | Existing explicit document IRI, media type, resolver, signal and limits; a new explicitly identified compatible-view interpretation policy. Returns `{model}`; inspection supplies diagnostics and assessment.                                                                    | Parses the closure, accounts for source, validates/normalizes the live model and generates occurrences without RDFC. No canonical-document claim.                                              |
| `vowl`: `openCanonical(document, options)`   | A canonical document admitted by this module instance. Returns `{model, correspondence}`.                                                                                                                                                                                         | Creates a live model from the already verified retained content and maps canonical record IDs to live handles. It cannot recover source statements absent from the artifact.                   |
| `vowl`: `inspectModel(model)`                | A locally admitted live model. Returns an immutable plain inspection snapshot.                                                                                                                                                                                                    | Exposes semantic records, occurrences, source accounting, diagnostic summaries and operation qualifications. The snapshot is not an admission token.                                           |
| `vowl`: `editModel(model, changes, options)` | The five closed package operations defined by the 30 September atomic editing amendment, addressing live semantic handles; application command translation remains application-owned. Returns `{model, correspondence, created}`; inspection supplies diagnostics and assessment. | One atomic successor, package normalization/topology, source dependency checks and no RDFC. Failure leaves the predecessor unchanged.                                                          |
| `vowl`: `captureModel(model, options)`       | Explicit existing canonical profile, complete visualization for artifact capture, signal and limits. Returns `{document, correspondence}`.                                                                                                                                        | Checks representability and preservation qualifications, runs real canonicalization, returns admitted canonical content and live-to-canonical correspondence. Does not replace the live model. |

Before accepting this interface, specify each operation's exact options, required fields, return envelope, admission requirements, immutable snapshot behavior, reference domains, correspondence cardinalities, cancellation behavior and stable error precedence.
Unknown fields are errors.
The closed inspection and evidence schemas are contract inputs to implementation; schemas may be generated from the accepted definitions, but implementation must not choose their meaning.

The model revision is explicit in every handle-bearing request and result.
Inspection snapshots and retrieved source bytes cannot mutate owned state and carry no canonical encoding authority.
No warning-suppression or force option may silently remove facts or qualifications.
Selecting a documented projection scope is distinct from claiming complete source preservation.

`fromOwl` remains the strict/compatibility canonical producer governed by its existing mapping profiles; `openOwl` serves the different, broader compatible-view contract.
Both call the same owning parser, source accounting and retained-model builder with explicit policies.
They must not independently implement interpretation, retry one another on failure, or advertise identical admission guarantees.
This separation keeps existing canonical callers truthful while adding the requested viewer capability.
The new interpretation policy requires its own versioned identifier before implementation; do not reuse the narrower `/compatibility/v1` identifier for changed semantics.

Named legacy migration remains governed by its accepted dialect.
Its admitted output can enter `openCanonical`; this amendment does not broaden legacy recovery.
If canonical work in legacy migration itself blocks an ordinary historical viewing case, record that as a separate adapter change rather than inventing a JSON-shape fallback.

## 4. Compatible projection and source meaning

Use B2 for structures that retain their established meaning.
First map every source statement that has an unambiguous supported interpretation through the owning parser and existing retained constructors.
A current unconsumed-statement diagnostic is evidence to investigate, not proof that the statement requires a new record kind or should disappear from the graph.

For an asserted RDFS relation whose OWL structural property category is genuinely non-unique, retain the exact property identity, declared roles and relation without selecting a typed OWL axiom by precedence.
Source-backed records are introduced only where existing retained constructors cannot express that meaning under A2–A5.
Their contract must specify subject/object term domains, source references, annotation ownership, deduplication, endpoint aggregation, occurrence generation and correspondence.
They must not inherit a typed property category merely from the selected glyph.

The initial inventory is determined by the minimized FOAF/SIOC cases and every material statement in the matched OntoViBe comparison, including inverse and characteristic-related statements where present.
For each case, record whether the owning parser establishes an ordinary retained construct, a qualified source-backed relation, an intentional projection exclusion or a genuinely unresolved assertion.
Do not cap the inventory at three predicate names before completing that accounting.

Multiple domain/range assertions retain their conjunctive meaning.
One source assertion may support several presentation occurrences, but inspection must not describe them as several authored axioms.
Every material graph difference from the matched pre-fork baseline needs a concrete semantic or usability justification and a regression expectation.
Retaining a statement only in diagnostic details does not by itself satisfy rendering compatibility.

The application reuses B4/B5 for labels, aliases and externality, with textual qualifications where needed.
New records require explicit retained-model and projection definitions; generic `rdf-property` reuse is not automatic because A2 currently suppresses that role when specific roles exist.

Datatype references and literal lexical text survive compatible admission independently of OWL 2 DL membership and lexical-validator availability.
Assessment distinguishes profile violation, unverified lexical validity and verified ill-typed value; none is relabelled a parser syntax error.
The owning dependency supplies these classifications without a separate VOWL datatype catalogue.

Keep every ontology header and attached annotation/import association in source evidence.
A display name can prefer a uniquely matching requested ontology/version IRI, otherwise the document name with a multiple-identities qualification.
Display selection does not collapse ontology identities or reassign their annotations.
The owning compatible loader traverses imports attached to all admitted headers under the aggregate acquisition policy and records the originating header.
Duplicate/cyclic imports do not trigger unbounded acquisition, and independent document blank nodes remain distinct.

## 5. Source accounting and semantic edits

Live editing reuses the existing package operation grammar and the accepted application-to-package command mapping.
It does not add source-statement editing, semantic editing by occurrence handle or a second interpreter for human commands.
For each existing application command, the contract records its editable target, exact affected facts, source-dependency rule and failure outcome.
A qualification disables only commands whose required target or consequence cannot be established.
Unrelated qualified content must not disable otherwise safe edits.

An edit targets retained semantic records, not raw source statements or live occurrence handles.
The package computes the affected dependency closure, including annotations, source relations and interpretation evidence.
If that closure contains an unresolved assertion whose preservation or successor meaning cannot be established, reject with `EDIT_SOURCE_DEPENDENCY_UNRESOLVED` and safe affected-record references.
Unrelated arrangement and inspection remain available.
No automatic deletion of residual statements, ontology headers or annotations is allowed.

After a successful edit, source evidence remains tagged as original input, while revision-bound edit provenance and assessment describe the successor.
Recompute affected qualifiers; never present the original source digest as the digest of an edited ontology.
An edit becomes committed only when the application accepts the successor model, inspection, correspondence and complete reconciled scene together.
Recovery state records that accepted revision; worker computation or message delivery alone is not a commit.
Cancelled requests, rejected candidates and edits rejected during scene reconciliation are absent from committed recovery state.
Existing exact annotation-loss confirmation and placement-merge rules remain in force.

## 6. Canonical capture and portable qualification

Canonical visualization capture preserves the selected retained interpretation, the complete scene and every qualification needed to understand that interpretation after reload.
It does not claim to archive all original source syntax or every statement outside the declared projection.
Source coverage, closure availability, OWL profile assessment and artifact representability remain separate qualifications.

Existing v1 readers, validation rules and successful bytes remain unchanged.
A view that v1 cannot represent must not be silently reduced to fit v1.
The preferred repair is the smallest explicitly versioned artifact contract that preserves the required selected-view records and machine-readable qualifications.
That contract need not embed a general source archive, and diagnostic prose is not a substitute for its semantic fields.

The amendment must identify the affected examples and demonstrate save/reload before treating compatibility delivery as complete.
If a bounded artifact extension cannot provide that outcome in this delivery, present the exact affected operations and inputs for an explicit owner scope decision.
A blanket first-delivery export prohibition is not an accepted consequence of the research.

Reject capture when the selected artifact contract cannot express the requested view or a required qualification.
Report the affected records and preserve the accepted model and scene.
A missing import or OWL profile violation does not itself prohibit saving a visualization when the selected artifact truthfully preserves that qualification.
A resource or deadline failure publishes no partial bytes.

Retain SVG and LaTeX drawing export independently of semantic capture where their existing contracts can still be met.
Account explicitly for the existing Turtle export path: state which current semantic content it can represent, its qualifications and any unsupported operation.
Original-source download is identified as original input and does not substitute for exporting an edited ontology.

## 7. Worker, identity and recovery

Parsing, interpretation, normalization and canonicalization remain off the main thread.
Every request and result identifies its request, load generation and exact base revision.
A result is a candidate until the application atomically accepts the model, inspection, correspondence and complete reconciled scene.
Stale, cancelled or rejected candidates never replace accepted state.

Select a bounded complete-state checkpoint readmitted through the package's live validator, using the existing per-operation worker lifecycle.
Replay is not the selected recovery mechanism: it adds historical-command retention and cross-execution target reconstruction that a complete checkpoint avoids.
Readmission uses the same interpretation invariants and normalization validator; a transported snapshot never gains admission or encoding authority merely by being cloned.
The checkpoint/readmission capability is a public closed contract, not access to an undocumented internal stage.

Recovery state survives the worker whose loss it must recover from.
It identifies the input kind and exact bytes/context for OWL, canonical and named legacy inputs; the interpretation policy and implementation version; and the last application-accepted revision and complete scene.
It never fetches newer source versions during recovery.

Qualify checkpoint reference preservation for anonymous and symmetric records, merges, inserted records and every supported input kind.
Retain the latest accepted checkpoint plus at most one pending mutation checkpoint; capture and replacement-load snapshots remain charged to the aggregate session budget.
Share immutable source storage safely and discard obsolete checkpoints after acceptance; recovery never requires an unbounded edit history.

Cancellation invalidates the request immediately.
Cooperative cancellation, the existing hard deadline and termination grace remain explicit.
Hard termination invalidates worker-local admission and all outstanding requests for that worker.
Before accepting further semantic operations, recover and validate the exact committed revision and its scene; otherwise preserve inspection of the last view and explain the unavailable operations.
No recovery procedure may guess scene targets from equal handle strings.

Capture uses an immutable model revision and complete scene snapshot.
Its result does not replace live state or retarget selections.
An expensive failed capture must not irrecoverably destroy the accepted editable document.
Qualify this failure path together with replacement-load failure, cancellation, stale results and crash timing around the application commit point.

## 8. Exact authority impact

| Authority                     | Required amendment                                                                                                                                                   | Preserved guarantee                                                                                   |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| A2/A4/A5 retained model       | Define the live source-evidence/relation inventory and shared normalization; keep it distinguishable from canonical v1 grammar.                                      | Typed references, annotation ownership, explicit scope and complete topology validation.              |
| A6 RDF mapping                | Preserve v1 mapping and bytes; a separately accepted profile may carry an explicitly reviewed mapping with measured performance and identity evidence.               | Existing successful canonical bytes and complete-profile labelling.                                   |
| A7 public admission           | Add the live admission/inspection/edit/capture operations and stable operation errors.                                                                               | `encode` accepts only locally admitted canonical documents; `decode` remains exact and defensive.     |
| A8 resources                  | Apply aggregate bounds to live admission, evidence, edits, capture and recovery; distinguish cancellation from worker destruction.                                   | Finite counters/deadlines, cooperative cancellation and hard termination. No larger ceiling.          |
| A9 adapters                   | Add an explicitly versioned compatible-view contract with public owning source accounting.                                                                           | Explicit syntax/resolver selection; strict and existing canonical profiles retain their truthfulness. |
| B1/B2 and B4/B5               | Specify qualified live source-relation occurrences and reuse the single display module.                                                                              | Existing canonical topology and label rules unchanged for their covered records.                      |
| B3 artifact                   | Specify the smallest versioned artifact representation required for compatible save/reload, or obtain explicit acceptance of itemized capability reductions.         | Complete placements and portable state; no silently partial artifact.                                 |
| Atomic editing amendment      | Add live atomic editing and defer canonical IDs; retain canonical editing for canonical consumers.                                                                   | Shared package normalization, annotation protection, correspondence and atomic failure.               |
| Accepted application boundary | Qualify live admission and worker handoffs without preselecting persistent ownership or replay; preserve the accepted command mapping and atomic application commit. | Distinct semantic/edit/runtime/portable identities; snapshot capture never replaces live state.       |

## 9. Evidence and acceptance

Implement the live-model/inspection contract against the delivered public metadata boundary in section 14; no controller-side OWL interpreter may fill an evidence gap.
Detailed upstream implementation plans remain solely in `owlapi`.
Any required package/configuration changes need their exact approval separately.

Use the same pinned root/import bytes and availability policy for the candidate and matched pre-fork oracle.
An unexpected lookup, absent fixture, digest mismatch or unaccounted import fails full-closure qualification.
Compare material entities, relations, supported details and user operations; counts and nonthrowing results are insufficient.
Extend the claim beyond the six examples only through the existing representative corpus.

Qualify loading, inspection, arrangement, supported edits, visualization capture/reload and the existing export formats for each example.
Record every material departure and its accepted disposition.
Include qualified property relations, datatype references and literals, all header/import associations, duplicate source support, canonical-only origin, and safe versus unresolved-dependency edits.

The eight-class and sixteen-class disjointness reproductions and the full Personas closure must satisfy the selected ordinary-input canonicalization envelope on recorded environments.
Deferring canonical work during viewing does not satisfy this gate.
Retain finite resource/cancellation controls and poison-input checks.

Unchanged v1 vectors retain exact bytes.
If a new artifact or internal RDF profile is selected, qualify its exact grammar, identity participation, reader behavior, migration and affected independent conformance evidence under a new identifier.
Do not require new-profile bytes to equal v1 bytes or silently change the meaning of an existing identifier.

This remains a draft, not an implementation-ready closed grammar or performance proof.
The selected design rules are recorded in section 13 and research section 9; their evidence obligations remain release gates.
The independent Astra review's proposed replacements have been synthesized here; that review is not approval of this revised text or implementation evidence.
The bounded implementation review must assess the consolidated contract and implementation evidence, reusing valid prior findings without repeating broad historical reviews.
Integration and frozen authorities remain unchanged.

## 10. Candidate inspection and evidence contract

This section specifies the common inspection vocabulary for contract review.
It does not declare the relation-constructor inventory or artifact encoding qualified; the upstream API is the separately delivered contract in section 14.
Existing A2–A5 record shapes and B1 occurrence shapes are reused where applicable; their extension is a separately enumerated union, never an arbitrary object payload.
Detailed upstream API implementation remains an `owlapi` repository concern.

All records below are closed: every listed field is required, nullable fields use explicit `null`, arrays are dense, and unknown fields fail validation.
Strings obey the existing scalar validity and resource rules; IRIs use the existing IRI domain.
Local references are opaque nonempty strings, unique in their named collection, with no cross-load meaning.
References cannot point outside their declared collection and revision; a dangling reference is an admission error.
Arrays representing sets contain no duplicates; import edges and source assertions remain distinct when their provenance differs.
Diagnostics and source inventories count toward the aggregate operation limits rather than receiving an unbounded side channel.

| Record            | Required fields and domains                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Inspection        | `revision`, `origin`, `records`, `occurrences`, `documents`, `imports`, `assertions`, `supports`, `qualifications`, `diagnostics`, `coverage`. `revision` is a nonnegative safe integer; semantic and occurrence collections contain the selected live profile's complete validated shapes.                                                                                                                                                                    |
| Origin            | `kind`: `owl`, `canonical` or `legacy`; `profile`: admitted interpretation/artifact/dialect identifier; `inputDigest`: digest of the input bytes; `sourceAccess`: `available` or `unavailable`. This describes ingress, not the digest of an edited successor.                                                                                                                                                                                                 |
| Document evidence | `id`, `documentIri`, `baseIri`, `mediaType`, `digest`, `headers`, `bytesAvailable`. Headers reference assertion IDs identifying the owning parser's header constructs; an empty array is legitimate. Source bytes are separately retrieved by document ID as defensive copies, not embedded in every inspection.                                                                                                                                               |
| Import edge       | `id`, `parentDocument`, `header`, `requestedIri`, `targetDocument`, `state`, `diagnostics`. `header` is an assertion reference or `null` when the source syntax has no separate header construct. `targetDocument` is a document reference when acquired, otherwise `null`; `state` is `acquired` or `unavailable`. Diagnostics are references. Repeated requests and cycles reference existing documents without conflating parent edges.                     |
| Source assertion  | `id`, `document`, `locator`, `disposition`, `association`, `records`, `qualifications`. `document` references document evidence. `disposition` is `represented`, `qualified`, `excluded` or `unrepresented` in the original interpretation. `association` is `current`, `superseded` or `not-retained` in the current revision. Record and qualification references are sets; excluded assertions require a qualification naming the selected projection rule. |
| Source locator    | Either `{kind:"rdf", statement}` or `{kind:"construct", reference}`. `statement` uses the closed RDF term representation below; `reference` is a nonempty document-scoped opaque construct reference supplied by the owning parser. Neither uses a guessed text span.                                                                                                                                                                                          |
| Record support    | `record`, `assertions`, `derivations`, `origin`. `record` references a semantic record or occurrence. `origin` is `source`, `generated`, `canonical` or `edit`. Assertions are source references; derivations are `{rule, records}` with a versioned rule identifier and supporting record references.                                                                                                                                                         |
| Qualification     | `id`, `dimension`, `code`, `records`, `assertions`, `documents`, `rule`. `dimension` is `interpretation`, `closure`, `profile`, `lexical` or `scope`; `code` belongs to the selected policy's finite registry; `rule` is a versioned rule identifier or `null`. Reference sets may be empty for document-wide qualifications.                                                                                                                                  |
| Diagnostic        | `id`, `code`, `severity`, `message`, `qualifications`, `records`, `assertions`, `documents`. Severity is `information`, `warning` or `error`; message is bounded explanatory text and never supplies semantics absent from the qualification. Reference sets identify only evidence actually available.                                                                                                                                                        |
| Coverage          | `basis`: `source` or `unavailable`; `represented`, `qualified`, `excluded`, `unrepresented`: nonnegative safe-integer counts or all `null` when unavailable. Source counts are derived from assertion dispositions, not independently trusted input. They do not measure full logical equivalence or imported content that was not acquired.                                                                                                                   |

An RDF statement is `{subject, predicate, object, graph}`.
Term variants are `{kind:"iri", value}`, `{kind:"blank", value}`, `{kind:"literal", value, datatype, language}` and `{kind:"default-graph"}`.
Subjects admit IRI or blank terms; predicates only IRI terms; objects admit IRI, blank or literal terms; graphs admit IRI, blank or default-graph terms.
Blank labels are local to the containing document, including named graph labels; they never identify a blank node in another document.
Literal `datatype` is an IRI and `language` is a valid language tag or `null`; language-tagged literals obey RDF's datatype/language consistency rules.
This serializable inspection representation follows [RDF/JS term distinctions](https://rdf.js.org/data-model-spec/) without exposing dependency instances or expanding support to triple terms.

Every retained record has exactly one support record, combining all contributors.
Every assertion with current association has at least one corresponding record; its references agree with those records' support entries.
Superseded and not-retained assertions have no current record references.
At ingress, represented/qualified assertions are current, and excluded/unrepresented assertions are not-retained.
An edit may supersede original support without changing its original disposition; preserved contributions remain current.
Generated support names the actual normalization/projection rule, including rules with no authored premise such as a default.
Derivations record immediate support and may form a bounded graph; they are not recursively expanded proof trees.
Canonical-origin records have no invented source assertion and do not make source coverage complete.
Edited support identifies the accepted editing rule; predecessor handles never enter current-reference fields.
Removed source associations remain inspectable as original evidence and cannot be described as current support.
Source disposition describes the original interpretation; after edits, current support is authoritative for association with surviving records, and inspection must distinguish those two views.
Every `records` field references the current revision only; removed records therefore never leave dangling references.
Original facts remain available through immutable assertion locators and source bytes, not references to discarded model revisions.
Qualifications on superseded facts retain their source references and lose removed current-record references; inspection distinguishes historical source assessment from qualifications applicable to current supported records.
The rule/code registry follows the selected inventory and reuse policy in section 13; mechanical enumeration is required before freeze.

## 11. Operation and transaction matrix

The package's five edit operations and their closed fields remain those of the [atomic editing amendment](2026-09-30-canonical-vowl-editing-amendment.md).
The [accepted application mapping](../reviews/canonical-vowl-application-boundary-proposal.md#concrete-command-mapping-proposed-for-owner-acceptance) is authoritative for human commands, including annotation-loss confirmation and inverse detachment.
The matrix below adds compatibility conditions rather than a second command vocabulary.

| Operation                                    | Required input and success                                                                                                                | Qualification or failure boundary                                                                                                                                                                                                   |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OWL load                                     | Explicit parser choice and root context; bounded resolver-led closure; admitted model and inspection from one interpretation path.        | Syntax/resource failure retains the prior accepted view. Unavailable imports and profile violations are distinct assessments, not automatic visualization rejection.                                                                |
| Canonical load                               | Decode under the selected supported artifact profile, then open its admitted retained content and complete scene.                         | Invalid bytes never acquire admission. Original source coverage stays unavailable when absent; persisted qualifications remain visible.                                                                                             |
| Named legacy load                            | Existing named migration contract, then admitted canonical-to-live handoff.                                                               | No inferred dialect or shape-based fallback. Any ordinary migration performance failure remains a separately evidenced adapter issue.                                                                                               |
| Inspect and arrange                          | Current admitted inspection and complete scene; preserve hidden placements and existing arrangement behavior.                             | Semantic qualifications do not disable these operations. Arrangement changes invalidate conflicting pending scene decisions.                                                                                                        |
| Property endpoint                            | Exact asserted endpoint or explicit insertion for a projection default; accepted inverse-detachment batch and annotation rules.           | Category ambiguity or unresolved affected source dependency refuses that command only; never infer the typed role from its glyph.                                                                                                   |
| Subclass, disjoint, some/all and type choice | Exact selected assertion/context and existing dropdown choices; clone shared expression context where the accepted mapping requires it.   | Reject ambiguous anchors or dependent facts; do not broaden object/data conversion or manufacture undrawable properties.                                                                                                            |
| IRI and datatype choice                      | Accepted unique subject/context target, fixed-builtin and shared-role guards.                                                             | Refuse when other editable roles or unresolved source uses would change without an exact mapping.                                                                                                                                   |
| Labels and other existing text fields        | Existing selected assertion, language and command scope; preserve other values and supported anchors.                                     | No first-value guess for multiple labels or silent annotation loss; no new text-field capability follows from generic package operations.                                                                                           |
| Insert and select                            | Accepted typed intent resolved against the complete normalized result.                                                                    | Normalization may merge with existing meaning; `created` is not a selection oracle. Ambiguous selection rejects application acceptance.                                                                                             |
| Confirmed deletion                           | Exact semantic/dependency/annotation scope bound to the accepted base revision.                                                           | No implicit cascade. A changed base or changed confirmation scope requires fresh confirmation.                                                                                                                                      |
| Visualization save/reload                    | Immutable accepted model plus complete scene, material qualifications and explicit artifact profile; encode and validate complete output. | Unsupported required fields or bounded canonicalization failure publish no bytes and leave the live model usable. Successful qualified save/reload is a compatibility completion gate.                                              |
| SVG and LaTeX                                | Existing drawing-export contracts over a captured scene.                                                                                  | Do not claim semantic round-trip; semantic capture failure alone is not a reason to disable a valid drawing export.                                                                                                                 |
| Turtle                                       | Current retained semantics expressible as RDF with an explicit output-scope statement.                                                    | Preserve expressible qualified RDF facts without choosing an OWL category. Inventory any nonrepresentable edited content; original input download is not a substitute. Exact Turtle serializer coverage remains to be demonstrated. |

Every asynchronous application request carries `{requestId, loadGeneration, baseRevision}`; each result echoes all three.
All are nonnegative safe integers; request IDs are unique within the session, load generations advance on replacement loads, and base revisions identify the shared accepted base of concurrent requests.
Counter exhaustion requires a new session rather than wraparound.
Model revisions advance only at successful application acceptance; candidate revisions cannot independently advance the accepted revision.
The application permits at most one semantic mutation candidate per accepted base and preserves its existing arrangement reconciliation rules.
An edit result includes complete predecessor-to-successor correspondence, including occurrences, and `created` with the meanings fixed by the editing amendment.
Many-to-one merges are allowed; one predecessor never maps to multiple successors by guesswork.
Inserted or split presentation occurrences receive explicit complete scene initialization.
The application accepts model, inspection, correspondence, scene and recovery state together, after all selection and merge decisions validate.
Worker success alone never commits a revision.

Validation order is request/options shape, local model admission and base revision, change grammar/reference validity, dependency and annotation safety, normalization/topology, then operation-specific representability.
Existing errors retain their meanings; section 13 selects the finite additional error codes.
Cancellation and resource checks apply throughout and may preempt work not yet performed; error precedence does not promise to finish validating an already cancelled request.
No operation publishes a partly validated inspection, scene or byte stream.

## 12. Selected recovery design and qualification matrix

The selected design is a complete-state checkpoint, retained by the application outside the computation worker.
Its logical contents are the exact accepted model revision, selected policy/implementation identity, complete source/evidence state, and complete reconciled scene.
Immutable byte storage may be shared across revisions by ownership-safe references; transferring away the only surviving buffer is forbidden.
Checkpoint transport conveys no admission authority: readmission checks the closed model/evidence schema, normalization invariants, references, complete occurrence projection and scene incidence under bounded validation.
Readmission must not repeat network acquisition, run canonicalization merely to recover live identity, or trust claimed policy identifiers unsupported by the reader.
It preserves an explicit bijection from the checkpoint's local reference domain to the recovered model; matching unrelated handle strings is not a recovery proof.
Version-incompatible checkpoints are rejected without guessed migration.
This is session recovery, not a new disk format or persistent browser-storage feature.

| Case                                                  | Checkpoint candidate proof                                                                                                | Replay alternative proof                                                                                                   |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| OWL, canonical and named legacy ingress               | Same validator accepts complete state for all three; absent original sources are represented honestly.                    | Each input kind has its exact immutable seed and admitted policy; replay does not depend on OWL bytes for canonical input. |
| Anonymous/symmetric records and merged/inserted facts | Explicit complete reference map survives readmission and validates every scene target.                                    | Cross-execution correspondence is proved before each historical command is applied.                                        |
| Long successful editing session                       | Latest accepted checkpoint and bounded pending candidate replace obsolete revisions; retained source support is measured. | Checkpoint/compaction bounds history and work without losing command targets or semantics.                                 |
| Crash before application acceptance                   | Recover previous accepted checkpoint; discard candidate and pending decisions.                                            | Replay only accepted revisions; computed-but-rejected edits are absent.                                                    |
| Crash after application acceptance                    | Recover the jointly accepted successor model and scene, including edits and hidden placements.                            | The exact accepted prefix and reconciled scene reproduce the successor.                                                    |
| Cancelled or expensive capture                        | Immutable accepted checkpoint remains recoverable; no returned IDs rebind live references.                                | Capture cannot mutate or truncate recovery history.                                                                        |
| Failed replacement load                               | Previous accepted checkpoint remains available until replacement acceptance.                                              | Previous seed/history remain available until replacement acceptance.                                                       |

The comparison above selects checkpoint/readmission and per-operation workers because they preserve the existing lifecycle and eliminate replay-only proof obligations.
The replay column records the rejected alternative's costs, not a second implementation or an experiment to run.
Measure checkpoint copying, validation and peak resident state against the existing resource envelope during implementation.
Failure to qualify the selected design requires a concrete correction before integration, not permission to degrade successful editing into inspection-only operation during normal use.
Do not claim qualification from the existing single-job worker or scene tests.

## 13. Resolved engineering decisions

The owner delegated resolution using first principles, authoritative specifications/guidelines and then established community practice.
The decisions below close the design alternatives; implementation details and verification are work to perform, not questions to return to the owner by default.
They supersede earlier candidate language where inconsistent.
They do not claim that unrun tests passed or alter existing frozen v1 authorities.

### Retained meaning and projection

Reuse the typed A2–A5 constructors whenever the owning parser establishes an unambiguous interpretation, including inverse properties and property characteristics.
Where that mapping is genuinely non-unique, retain an asserted RDF relation with its exact terms, document scope and declared roles; do not choose a category by precedence.
Use one closed source-statement record shape `{id, statement, annotations}`, with the RDF statement grammar from section 10 and existing annotation-value grammar.
Provenance and qualifications are linked through inspection support, not folded into the authored assertion.
Deduplicate equal statements within the same source blank-node scope, merging support; never merge blank nodes from different documents.
Source-statement records do not create typed OWL axioms or bypass the existing human edit grammar.

The selected structural presentation rules cover RDFS domain/range/subproperty and OWL inverse/characteristic relations, plus existing typed B2 projection.
Use property-level domain/range facts conjunctively, preserve inverse relationships, and attach asserted characteristic details to their property without implying a selected typed OWL role.
If a relation has no unambiguous endpoint interpretation, preserve and inspect it without fabricating an edge; account for its material difference from the pre-fork baseline.
Arbitrary predicates remain source evidence rather than automatically becoming graph edges; this is a structural ontology viewer, not a general RDF graph editor.
The statement record's term shape is general so evidence preservation does not require a growing predicate allowlist; drawing behavior remains an explicit finite mapping.
For a source-backed occurrence, the generation key contains its retained statement reference, projection-rule identifier and complete endpoint references; labels never determine identity.

The existing minimized OntoViBe evidence records seven unconsumed domain/range statements and one inverse statement, including `functionalPropertyAsInverse`.
This evidence rules out the earlier three-predicate cap; it does not prove that all eight require new records rather than an owning-parser repair.
During implementation, account for them using the selected typed-first rule and retain characteristic-related source assertions as well.
Do not repeat the diagnostic merely to choose this policy.
[RDF Schema](https://www.w3.org/TR/rdf-schema/#ch_domain) establishes property-level domain meaning; [RDF Concepts](https://www.w3.org/TR/rdf11-concepts/#section-Graph-syntax) supplies the statement/term basis.
The projection choices are ours, not requirements attributed to those standards.

### Portable representation

Select a new versioned compatible artifact, preserving all v1 readers and successful bytes.
Its logical envelope is `{profile, structural, visualization, qualifications}`.
`structural` extends the existing retained inventory with the source-statement records above; `visualization` retains the complete B3 scene invariants.
`qualifications` contains the machine-readable selected interpretation, retained-scope, closure, profile and lexical assessments, with references only to retained records and compact document/header/import descriptors.
Its grammar is derived from the section 10 qualification and document association records, excluding source-byte buffers, diagnostic prose, timestamps, local paths and credentials.
Persist header identities and their own metadata/import associations; a display title must not replace them with one invented ontology identity.
Original input bytes are not necessary to reopen or inspect the saved selected view.
Reload reports original-source coverage as unavailable unless genuinely supplied, while retaining the saved interpretation/closure qualifications.

Semantic records determine semantic identity; the artifact identity covers those records, the complete scene and persisted qualifications.
Local handles, retrieval timing and message wording have no canonical identity role.
The new profile must encode every added field injectively under its versioned mapping and pass the existing identity/field-distinction proof method before freeze.
Do not wrap an unchanged v1 profile identifier around changed semantics, or treat a sidecar log as qualification persistence.
Reading v1 remains supported; exporting v1 is allowed only where the selected view and all required guarantees are representable without loss.
Use the new profile for repaired examples needing the extension; automatic lossy downgrade is prohibited.
Profile URI allocation and mechanical schema generation implement this decision; they are not reasons to reopen it.

### API and ownership

Select the names `openOwl`, `openCanonical`, `inspectModel`, `editModel` and `captureModel` on the existing three package surfaces, plus `checkpointModel` and `readmitModel` on the root surface.
No fourth surface or controller interpreter is introduced.
`openOwl` reuses the existing explicit document/media/resolver inputs with the versioned compatible-view policy; it returns `{model}`.
`openCanonical` accepts a locally admitted supported document and returns `{model, correspondence}`; named legacy input enters through its existing migration operation.
`inspectModel` returns the single section 10 snapshot; assessment/diagnostics are obtained there instead of duplicated in several result envelopes.
`editModel` takes the admitted model and existing five-operation batch and returns `{model, correspondence, created}`.
`captureModel` takes the admitted model, explicit target profile and complete scene and returns `{document, correspondence}`.
`checkpointModel` returns a defensive complete checkpoint; `readmitModel` returns `{model, correspondence}` after full live validation, never by trusting a clone's provenance.
The owner-approved export amendment of 3 October adds `readModelSource(model, documentId, options)` on `vowl` and `exportModelRdf(model, options)` on `vowl/owl`.
Both require local live admission and accept only `signal` and `limits` options.
Source retrieval returns `{bytes, documentIri, mediaType, digest}` for one exact inspection document ID; bytes remain original after edits and are unavailable after portable reopening without an acquisition archive.
RDF export returns `{bytes, scope}` containing the current retained semantics as UTF-8 Turtle, with closed scope fields `revision`, `kind: "flattened-retained-closure"`, `mediaType: "text/turtle"` and `qualified`.
The package owns structural-to-RDF mapping, anchored annotations and expressible residual RDF with document-scoped blank identities.
It must fail before publication when retained semantic content cannot be represented, including named-graph scope, directed RDF literals or unresolved identity between residual blank nodes and structural anonymous entities.
Original-source bytes and portable qualifications are not substituted for edited Turtle output; a qualified scope report does not assert original-source reconstruction.
Stable export failures are `SOURCE_DOCUMENT_UNKNOWN`, `SOURCE_BYTES_UNAVAILABLE` and `RDF_EXPORT_UNREPRESENTABLE`, with bounded affected-record/reason details for representability failures.
All asynchronous operations accept only their stated operation fields plus existing `signal` and `limits`; unknown fields fail.
Snapshot inspection and byte retrieval expose copies or immutable values and convey no encoding authority.
Checkpoint envelopes carry the selected policy/implementation identity, model revision and all state needed for readmission; the application pairs the checkpoint with the complete scene in its atomic accepted revision.
The worker protocol carries request/generation/base-revision context separately from the package's model semantics.

Reuse existing error categories and precedence wherever their meaning applies.
Add only distinct failures for unadmitted live models, unsupported checkpoint versions, invalid checkpoints, unresolved edit dependencies, unrepresentable capture/qualifications and the approved source/RDF export failures above.
The stable codes are `MODEL_NOT_ADMITTED`, `CHECKPOINT_VERSION_UNSUPPORTED`, `CHECKPOINT_INVALID`, `EDIT_SOURCE_DEPENDENCY_UNRESOLVED`, `CAPTURE_MODEL_UNREPRESENTABLE` and `CAPTURE_QUALIFICATION_UNREPRESENTABLE`.
Stale requests are rejected by the application protocol; they do not mint a parser error.
Reuse owning-parser assessment codes rather than maintaining a VOWL datatype or parser capability catalogue.
The finite projection/normalization rule registry is derived from the selected constructor rules; additions change the versioned policy, not an open-ended runtime extension mechanism.

### Canonicalization and delivery

Keep standard RDFC, the current finite limits and whole-profile canonicalization.
Implement byte-preserving optimization of the existing mapping/algorithm execution first; do not assume a replacement algorithm or new library is required.
The new compatible artifact necessarily gets a new mapping for its additional fields, but that does not authorize rewriting v1's mapping or promising unchanged IDs across profiles.
If the ordinary-input acceptance gate still fails, the next engineering action is a measured new-profile mapping correction with field-distinction and independent identity evidence, not a ceiling increase or a request for the owner to choose an algorithm.
A material scope expansion or capability reduction still belongs to the owner; ordinary implementation choices do not.
[RDFC conformance](https://www.w3.org/TR/rdf-canon/#conformance) governs canonicalization correctness, while the stated product envelope governs acceptable performance.

Use pinned offline closures and a matched pre-fork oracle; qualify rights before redistributing fixtures, keeping local diagnostic use distinct from release evidence.
Retain all six examples as required successful source-to-view-to-artifact paths and test the existing edit/export operation matrix.
Implementation must now realize these decisions, finish the mechanical field tables and prove the recovery, source-accounting and performance obligations.
Those are outstanding delivery tasks, not unresolved design alternatives or permission to accept regressions.
The exhausted experiment/review budgets and exact configuration-approval rules remain in force; this documentation decision runs no new experiment or review.

## 14. Upstream contract reconciliation

The producer-side repair is delivered in owlapi [PR #27](https://github.com/Hadden-Industries/owlapi/pull/27), merged revision `19cf43d4288d20a737ecac0a39ccd1c53f9a3e77`, tree `55111092290a538a3a9eee710a75ac45ffbab951`.
Its [version-pinned public contract](https://github.com/Hadden-Industries/owlapi/blob/19cf43d4288d20a737ecac0a39ccd1c53f9a3e77/docs/compatibility/rdf-parser-metadata.md) governs the consumer boundary.
The [integration delivery record](../reviews/canonical-vowl-application-integration.md#upstream-delivery-received-on-2-october-2026) preserves source/artifact identity, reported CI and outstanding dependency approval.

Use `manager.getOntologyFormat(ontology)?.getOntologyLoaderMetaData()` and the public `RDFParserMetaData`/`RDFOntologyHeaderStatus` exports from the root or `/io`.
Formats are immutable per-document copies: test `format.key`, not reference equality with registry constants.
Programmatically created ontologies may have no format; non-RDF formats have no RDF parser metadata.

| Public fact                 | Consumer interpretation                                                                                                                                                                                                                 |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `getTripleCount()`          | Unique triples in the selected/explicitly merged reconstruction graph; not original statement occurrences or excluded named-graph quads.                                                                                                |
| `getHeaderState()`          | Observed zero/one/multiple explicit headers. Retain header-selection diagnostics separately; observed count does not identify all source associations.                                                                                  |
| `getUnparsedTriples()`      | Immutable RDF/JS-shaped triples with exact literal lexical data and document-local blank labels. Retain source context; do not invent missing graph provenance.                                                                         |
| `getGuessedDeclarations()`  | Reconstructed role use absent explicit local/imported declarations or builtin status. These records do not assert declaration axioms.                                                                                                   |
| Header/category diagnostics | Retain `candidateOntologyIRIs`, `selectedOntologyIRI`, `observed`, and category `declaredCategories`, `resolvedCategory`, `evidence` where supplied. Treat selection as qualified interpretation, not an explicit authored declaration. |
| Source assessment           | Continue using the public OWL profile/source-assessment API for validity, unverified and stale outcomes. Parser metadata does not replace its authority.                                                                                |

Compatible mode retains its documented Java-style header/property selection.
The repaired manager loads all IRI-valued imports, including secondary-header and headerless imports, under its existing acquisition/limit/cancellation policy.
Strict/preserve ambiguity rejection remains distinct.
The repaired inverse/characteristic reconstruction supplies ordinary OWL axioms where applicable; do not replace those with neutral source records merely because the old producer missed them.
Secondary-header annotations retain their subjects under the documented JavaScript policy; malformed secondary imports and range-only behavior retain their explicit limitations.

This settles the earlier upstream alternatives:

- No upstream `SourceAccounting` ledger, neutral multi-header ontology, VOWL constructor or `compatible-view` parsing mode is required.
- The versioned compatible-view policy in this draft belongs to VOWL, consuming owlapi's existing explicit `compatible` mode and assessments.
  It must not be confused with an upstream mode or silently substituted into the frozen canonical `fromOwl` contract.
- VOWL owns acquired-source bytes/digests, source-to-view associations, retained/source-backed records, projection, edit qualification and canonical artifacts.
- Section 10 is a consumer inspection target.
  Exact source/header/statement associations must be supported by actual evidence; loader metadata cannot be expanded into an invented exhaustive ledger.
- Metadata remains historical after ontology edits and survives disabled warning collection.
  It neither proves current-revision preservation nor grants admission authority.

Where available public evidence cannot establish exhaustive accounting, report the limitation explicitly and withhold that stronger claim.
Do not introduce a second OWL interpreter, copy dependency internals or block ordinary viewing solely to obtain a losslessness certificate.
Preserving material relationships and successful qualified save/reload remains the consumer acceptance requirement.
Any resulting material capability reduction requires the existing explicit owner decision; lack of a bespoke upstream API is not itself such a reduction.

No npm publication, dependency mutation or completed WebVOWL acceptance follows from upstream delivery.
Qualification must bind the actual adopted source/artifact to the exact consumer revision and cover public-export identity, workers/bundles, complete closures, operations and retained qualifications.

## 15. Compatible mapping refinement candidate

The implementation candidate in `packages/vowl/src/refinedRdf.js` adds derived color triples to the compatible profile's complete base mapping before standard RDFC-1.0.
It does not replace RDFC, issue identifiers from input labels, or modify the frozen v1 mapping.
The owning RDFC implementation charges its deep-work counter on entry to each recursive N-degree call; speeding up hashing or allocation alone cannot make a computation requiring too many such calls pass that counter.
The candidate therefore addresses the new profile's mapping ambiguity while leaving v1 results and limits unchanged.

The exact candidate algorithm is:

1. Index every blank node's incident base quads, counting a self-referential quad once for that node.
   The base mapping uses only the default graph; reject other graphs, non-IRI predicates and predicates in the reserved `https://haddenindustries.com/ontology/vowl/compatible-mapping/v1#` namespace.
   Prepare each ground term's key once per encountered object: named nodes use `["iri", value]`; literals use `["literal", lexicalValue, datatypeIRI, language]`.
   Replace that key with `["term", lowercaseHexSHA256(UTF8(JSON.stringify(key)))]`, reusing digests for equal keys.
   Ground-term digest collisions affect discrimination, never erase retained base quads.
2. Initialize every blank-node color to the empty string.
3. For each node, encode each incident quad as a JSON array of subject, predicate and object term keys.
   A reference to the node itself is `["self"]`; another blank node is `["blank", previousColor]`.
   Ground terms use their prepared fixed-length keys, so literal and IRI text is not re-serialized in every refinement round.
   Input blank labels never enter these keys.
4. Sort the encoded incident arrays by UTF-16 code-unit order.
   The next color is lowercase hexadecimal SHA-256 of the UTF-8 encoding of `[previousColor, sortedIncidentArrays]`.
   All JSON encoding uses ECMAScript well-formed `JSON.stringify` without whitespace.
   Each round reads only the completed preceding round.
5. Stop after the first round whose number of distinct colors does not increase.
   Without hash collisions, including the previous color refines existing classes without merging them.
   The increasing-count condition bounds the number of rounds by the number of blank nodes even if collisions occur.
6. Retain every base quad and append one default-graph triple per blank node with predicate `https://haddenindustries.com/ontology/vowl/compatible-mapping/v1#color` and its final color as an `xsd:hexBinary` literal.
   Run the existing RDFC-1.0 implementation on that entire augmented graph and use its labels for public identifier assignment.

The color predicate and its namespace are reserved outside the base mapping's predicate vocabulary, and the implementation enforces that exclusion.
Removing those triples recovers the complete base graph, so refinement cannot erase a field distinction already established by the base mapping.
Conversely, renaming blank nodes or reordering base quads preserves each round's signatures and stopping point.
These are the identity arguments to review independently; equal colors do not establish graph equivalence or permission to skip RDFC.
Colors are equivariant under blank renaming and independent of quad order; identity does not rely on color injectivity or collision resistance.
Unresolved symmetric nodes retain equal colors and remain subject to the existing recursive-work limit.

Index construction and every visited incident quad consume the existing embedded-value work budget; appended triples consume the existing RDF-quad budget.
Refinement charges approximately incident-quads times rounds-plus-one to the shared work counter, so inputs near the base mapping's allowance can exhaust it during refinement.
Ground-term key serialization measures and charges its exact UTF-8 JSON length before allocating escaped strings or digest buffers.
Per-node round scratch storage is bounded before allocation by `1024 + 2048 * incidentQuadCount` against the existing total-string-byte ceiling; fixed-length term keys make that a conservative bound for entry strings, escaped signature and UTF-8 digest input.
This scratch bound is additional to the cumulative ground-key counter; neither is a claim to meter total process RSS or JavaScript object overhead.
Refinement resource failures use `RDF_RESOURCE_LIMIT`, including work and string limits.
Deadline and cancellation checks bracket every asynchronous digest.
The default and maximum limits are unchanged.
The experimental compatible-artifact entry point now calls this mapping; the production controller has not switched to it.
Complete artifact-contract and independent identity qualification remain release gates.

A single bounded implementation qualification used the same six exact offline import closures as the retained preparation evidence.
All six completed preparation, refinement and RDFC inside the existing default operation budget.
After the bounded independent review and the resulting repairs, a single corrected qualification observed approximately 1.31 seconds for FOAF, 2.85 for GoodRelations, 0.31 for MUTO, 0.60 for OntoViBe, 1.22 for Personas and 1.38 for SIOC.
Refinement took six or seven rounds and distinguished every blank node in these particular mapped datasets.
This does not predict behavior for other or genuinely symmetric graphs.
The corrected source-bound script/results are `qualify-refined-mapping-reviewed.mjs` and `refined-mapping-reviewed-results.json` in the external `live-recovery-20261003-01` evidence directory.
The original script/results remain historical evidence; the ground-term prehash changes candidate color bytes without affecting frozen v1 bytes.

Thirty-three focused tests cover twenty-five admitted vector sources, base-graph retention, explicit color/round/partition invariance under blank renaming and quad reordering, unresolved symmetry, reserved-predicate rejection and resource/cancellation behavior.
The expected-error vector is excluded from the admitted mapping domain.
The independently derived four-node path has three rounds and four classes and canonicalizes with zero N-degree work after refinement, while its unrefined form exhausts that allowance.
Two disjoint three-cycles and one six-cycle have equal colors but distinct canonical output, and both still reject zero N-degree work.
Claude derived those expectations statically in the authorized 209-second read-only review; the implementation worker subsequently executed them.
This is independent expected-behavior evidence plus local execution, not an independently implemented conformance producer or a follow-up review of the repairs.
Qualification of the complete compatible artifact must additionally cover every persisted qualification field and complete visualization, not just the structural base datasets measured here.

## 16. Implemented portable artifact candidate

This section records the experimental implementation grammar; it does not freeze a published protocol or claim complete independent conformance.
The identifier is `https://haddenindustries.com/ontology/profiles/vowl/canonical/compatible-artifact/v1`, exported separately as `compatibleArtifactProfile` on the existing root surface.
The envelope contains exactly `profile`, the existing retained `structural` grammar, the existing complete `visualization` grammar and `qualifications`.
Neither frozen v1 profile changes its fields or mapping.

`qualifications` contains five sets:

- `documents`: records with canonical `d` IDs, a required `root` Boolean and header state (`unavailable`, `none`, `one`, `multiple`), plus optional selected `ontologyIri` and `versionIri`.
  Exactly one document is the root.
- `imports`: records with canonical `i` IDs, `parentDocument`, `requestedIri`, state `acquired` or `unavailable`, and a `targetDocument` exactly when acquired.
- `entries`: records with canonical `q` IDs, a dimension, owning code, retained-record references, document references, a versioned rule IRI and one closed typed detail branch.
- `sourceNodes`: records with canonical `b` IDs and an owning document reference, representing only anonymous terms in publicly reported unparsed RDF.
- `sourceStatements`: records with canonical `v` IDs, owning document, graph context, subject, predicate IRI and object, representing that residual RDF without asserting an OWL interpretation.

Entry dimensions are `interpretation`, `closure`, `profile`, `lexical` and `scope`.
Detail branches are unavailable scope, assessment status and applicable IRI/datatype/entity/count, selected property interpretation, selected ontology header and candidates, projection exclusion, unavailable import, or references to retained residual source statements.
The executable closed field inventory is `packages/vowl/src/compatibleContract.js`; `packages/vowl/schema/compatible-artifact.schema.json` is mechanically generated from it.
The schema is necessary but insufficient: semantic admission additionally checks reference categories, one root, import state/target pairing, duplicate payloads, allowed rule/dimension combinations, scoped anonymous references, complete scene and exact canonical bytes.
Owning assessment codes are retained without creating a second parser-capability catalogue.

A source-statement resource is either an IRI or a reference to a source anonymous node.
A literal preserves its reported lexical text, datatype IRI, language string and optional direction (`ltr`, `rtl` or empty).
These are residual source terms, so retaining a language string or lexical form does not assert its OWL datatype validity.
Source blank labels never enter portable identity.
Within each document, equal source labels select the same anonymous record; across documents, equal labels remain distinct.
Unused anonymous records and cross-document anonymous references are rejected.
Exact duplicate statements within one document deduplicate as RDF statements; statements belonging to different documents retain their separate attribution.
The owning unconsumed-statement diagnostic supplies quads whose graph is retained as default, named or document-scoped anonymous.
Matching triple-only metadata does not create an additional default-graph statement.
When only triple metadata is available, the graph context is explicitly unavailable, never guessed to be default.
This retention rule does not broaden which datasets the owning parser admits; a probed non-default TriG dataset still fails the owning load with `MAPPING_AMBIGUOUS`.

Every primary collection participates in the same mapped dataset, including its document and qualification links.
The section 15 refinement and whole-dataset RDFC run precede canonical ID assignment and complete JCS serialization.
Original bytes, acquisition locations, digests, source-local handles and diagnostic prose are not portable identity fields.
They remain private session-checkpoint evidence when available.
Reopening a portable artifact reports those original-source facilities as unavailable, retains the claimed typed qualifications and residual statements, and grants no original-source authenticity authority.

`captureModel` explicitly selects this profile and requires complete visualization.
`decode`, `encode`, `openCanonical`, `editModel`, checkpoint/readmission and recapture support it through the existing public surface.
Live edits preserve historical qualifications and residual RDF; operations that depend on unresolved property choices or residual statements fail atomically, while unrelated changes remain available.
The frozen `edit(document, ...)` operation returns structural content and therefore rejects qualified artifacts rather than dropping their qualifications.
The application session selects compatible capture for OWL-origin and reopened qualified documents; explicit attempts to downgrade such models to a frozen profile fail.

Implementation-worker tests cover issued schema IDs, closed payload rejection, retained structure/scene/qualification identity, portable decode/reopen, historical property/header choices, residual lexical evidence, source blank renaming and scope, dangling references, unrelated editing and dependency guards.
These tests and the six measured empty-residual closures do not replace an independent complete-profile conformance producer or production rendering/export acceptance.
