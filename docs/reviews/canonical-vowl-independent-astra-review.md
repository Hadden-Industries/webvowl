# Independent Astra review of the compatible-view proposal

Date: 2 October 2026.
Reviewer: independent Codex agent `/root/astra_max_proposal_review`, explicitly requested GPT-6 Astra, Max reasoning effort, fresh context with a scoped review brief.
Scope: one bounded, read-only consolidated review.
This report preserves the returned findings and exact proposed documentation changes as reviewed.
On 2 October 2026, the owner authorized their application; the amendment and supporting documents now incorporate them, with remaining decisions recorded in research section 8.
The original review verdict and line references below describe the pre-synthesis draft, not a second review of the revision.
The initial full-history dispatch was interrupted and replaced with the explicit-model fresh-context dispatch before using any review result.
Integration remains paused.

## Verdict

The direction is sound, but do not accept this draft as the implementation contract yet.
It removes inappropriate viewing barriers, then introduces avoidable save restrictions and a recovery architecture whose identity guarantees are incomplete.
Standards support distinguishing RDF parsing, OWL structural conformance and visualization; they do not require this particular five-operation interface, persistent worker, replay ledger or first-delivery export restriction.

## Findings

Line references identify the reviewed draft before any proposed replacements.

1. **P1: Capture policy introduces a material compatibility regression without establishing necessity.**
   Amendment section 6, lines 116–135, makes several repaired examples viewable but unsaveable.
   Existing A9.2 permits a resolved subset with `MAPPING_IMPORT_UNRESOLVED`, and `packages/vowl/src/owl/index.js` returns an encodable document.
   The current controller exposes JSON, Turtle, SVG and LaTeX export.
   Qualification persistence is a sound requirement; deferring its representation while accepting broad export loss is a product scope choice.
   Prefer a bounded versioned artifact extension and itemize any unavoidable reduction for owner acceptance.
2. **P1: A successful load with diagnostics can still materially reduce the graph.**
   Section 4, lines 79–89, prematurely limits source-backed relations to three predicates.
   The matched OntoViBe evidence includes inverse and characteristic-related facts whose ordinary structural representability has not been established.
   A currently unconsumed statement is not necessarily inherently unrepresentable.
   RDFS domain relations have meaning without selecting an OWL property category, but existing generic `rdf-property` reuse would itself need an A2 amendment because specific roles currently suppress the generic role.
   See [RDF Schema domain semantics](https://www.w3.org/TR/rdf-schema/#ch_domain).
3. **P1: Replay recovery lacks complete input coverage and identity guarantees.**
   Section 7, lines 140–156, specifies root/import replay but `openCanonical` has no original sources.
   It does not define where recovery state survives worker loss, how old handles map to a fresh execution, how history is bounded, or when a candidate edit becomes committed after scene reconciliation.
   Worker termination destroys its execution and queued tasks; it is not isolated cancellation of a job.
   Compare bounded snapshot readmission and replay before prescribing a persistent worker architecture.
   See the [HTML worker termination model](https://html.spec.whatwg.org/multipage/workers.html#terminate-a-worker).
4. **P1: The editing interface conflates application commands with package operations.**
   Section 3, line 58, describes an existing human-editor command vocabulary, but the package grammar has five lower-level operations: `insert`, `replace`, `remove`, `set-endpoint`, `set-ontology`.
   The accepted application boundary translates human commands to those operations.
   Reuse that exact grammar and command mapping; do not duplicate interpretation or broaden editor authority.
5. **P2: Provenance and inspection are underdefined, including provenance that cannot exist.**
   Section 2, lines 28–38, requires source statements for every record, but defaults, generated records and canonical-only inputs may have none.
   Normalization also merges several assertions into one record.
   Define many-to-many accounting and distinct origins before freezing the interface, rather than deferring the inspection schema to implementation.
   RDF/JS supplies terms/quads, not provenance or admission contracts.
   See the [RDF/JS Data Model](https://rdf.js.org/data-model-spec/).
6. **P2: Acceptance lacks explicit save/performance gates and version-specific byte promises.**
   Section 9, lines 181–187, emphasizes viewing and rejected capture, without successful save/reload for repaired cases or the eight-class canonicalization regression.
   COMPAT-04/05 already require an ordinary-input envelope and source-to-artifact paths.
   Keep existing v1 bytes unchanged, while permitting a separately identified encoding if measurement supports it.
   RDFC's bounded failure does not make the ordinary eight-class failure acceptable product behavior; vectors alone also do not prove complete conformance.
   See [RDFC conformance](https://www.w3.org/TR/rdf-canon/#conformance).

## Exact proposed edits to the amendment

Target: [compatible-view amendment draft](../specs/2026-10-02-canonical-vowl-compatible-view-amendment-draft.md).
The blocks below preserve the replacement text returned by the independent reviewer.
They have been incorporated into the revised draft but do not amend frozen normative authorities.

### A. Replace section 1's final paragraph

```markdown
The first delivery restores viewing, inspection and arrangement while preserving the existing safe editing and export capabilities of the migration baseline.
Compatibility is assessed by operation: loading, visible relationships, inspection, arrangement, supported edits, visualization save/reload and each existing export format.
A diagnostic alone does not justify a material reduction in those capabilities.
Any proposed reduction must identify the affected inputs and operations, the concrete reason, and the smallest remedy; a material reduction requires the owner's explicit product decision before cutover.

This work does not add a general RDF editor, general reasoning or a source archive.
Canonicalization performance on ordinary supported inputs remains a release requirement even when viewing does not wait for portable identifiers.
```

### B. Replace the source-evidence block in section 2

```markdown
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
```

### C. Revise section 3's interface status and edit grammar

Replace the opening two sentences with:

```markdown
Keep the three existing export surfaces.
The operations below identify required capabilities and candidate names; their exact public signatures are not frozen by this draft.
Select the smallest interface that supports the qualified consumer paths without exposing private dependency objects or duplicating interpretation, normalization or command translation.
```

Replace the `editModel` input description with:

```markdown
The five closed package operations defined by the 30 September atomic editing amendment, addressing live semantic handles; application command translation remains application-owned.
```

Replace the options and deferred inspection-schema block with:

```markdown
Before accepting this interface, specify each operation's exact options, required fields, return envelope, admission requirements, immutable snapshot behavior, reference domains, correspondence cardinalities, cancellation behavior and stable error precedence.
Unknown fields are errors.
The closed inspection and evidence schemas are contract inputs to implementation; schemas may be generated from the accepted definitions, but implementation must not choose their meaning.

The model revision is explicit in every handle-bearing request and result.
Inspection snapshots and retrieved source bytes cannot mutate owned state and carry no canonical encoding authority.
No warning-suppression or force option may silently remove facts or qualifications.
Selecting a documented projection scope is distinct from claiming complete source preservation.
```

### D. Replace section 4's opening source-relation block

```markdown
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
```

### E. Add editing ownership and commit-point requirements to section 5

Insert at the beginning:

```markdown
Live editing reuses the existing package operation grammar and the accepted application-to-package command mapping.
It does not add source-statement editing, semantic editing by occurrence handle or a second interpreter for human commands.
For each existing application command, the contract records its editable target, exact affected facts, source-dependency rule and failure outcome.
A qualification disables only commands whose required target or consequence cannot be established.
Unrelated qualified content must not disable otherwise safe edits.
```

Replace the committed-ledger sentence with:

```markdown
An edit becomes committed only when the application accepts the successor model, inspection, correspondence and complete reconciled scene together.
Recovery state records that accepted revision; worker computation or message delivery alone is not a commit.
Cancelled requests, rejected candidates and edits rejected during scene reconciliation are absent from committed recovery state.
```

### F. Replace section 6

```markdown
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
```

This recommends capability preservation; it does not authorize a schema/configuration change or mint a new profile identifier.

### G. Replace section 7

```markdown
Parsing, interpretation, normalization and canonicalization remain off the main thread.
Every request and result identifies its request, load generation and exact base revision.
A result is a candidate until the application atomically accepts the model, inspection, correspondence and complete reconciled scene.
Stale, cancelled or rejected candidates never replace accepted state.

Do not mandate a persistent worker or event-replay architecture before qualifying recovery.
Compare a bounded complete-state checkpoint readmitted through the package's live validator with bounded replay from an immutable input seed.
Both must use the same interpretation and normalization implementation; a transported snapshot never gains admission or encoding authority merely by being cloned.
Select the smaller qualified implementation.
A public checkpoint/readmission capability, if required, must have its own closed contract rather than expose an undocumented internal stage.

Recovery state survives the worker whose loss it must recover from.
It identifies the input kind and exact bytes/context for OWL, canonical and named legacy inputs; the interpretation policy and implementation version; and the last application-accepted revision and complete scene.
It never fetches newer source versions during recovery.

If replay is selected, define how original execution handles map to reconstructed handles before replaying a command.
Correspondence within the original execution alone does not establish that mapping.
Qualify anonymous and symmetric records, merges, inserted records and every supported input kind.
Bound retained history, recovery work and memory, and define checkpoint/compaction behavior so recovery cost does not grow without limit after successful edits.

Cancellation invalidates the request immediately.
Cooperative cancellation, the existing hard deadline and termination grace remain explicit.
Hard termination invalidates worker-local admission and all outstanding requests for that worker.
Before accepting further semantic operations, recover and validate the exact committed revision and its scene; otherwise preserve inspection of the last view and explain the unavailable operations.
No recovery procedure may guess scene targets from equal handle strings.

Capture uses an immutable model revision and complete scene snapshot.
Its result does not replace live state or retarget selections.
An expensive failed capture must not irrecoverably destroy the accepted editable document.
Qualify this failure path together with replacement-load failure, cancellation, stale results and crash timing around the application commit point.
```

### H. Replace the acceptance paths in section 9

```markdown
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
```

In section 8, revise the A6 row to preserve existing v1 mapping/bytes while allowing a separately accepted profile to carry an explicitly reviewed mapping.
Replace the B3 row's required amendment with:

```markdown
Specify the smallest versioned artifact representation required for compatible save/reload, or obtain explicit acceptance of itemized capability reductions.
```

## Supporting-document synchronization

In [research section 6](canonical-vowl-compatibility-research.md), replace the selected export-policy paragraph with:

```markdown
Selected design: saved visualizations state their retained scope and preserve material qualifications needed after reload.
This establishes a persistence requirement, not a blanket export prohibition or a decision to defer the required artifact representation.
Prefer a bounded versioned representation of the selected view and its qualifications.
Any remaining material save/export reduction requires an explicit owner scope decision.
Original-source recovery remains a separate capability and does not replace saving an edited visualization.
```

In the [repair plan](../plans/2026-10-02-canonical-vowl-compatibility-repair-plan.md), replace the amendment description with:

```markdown
The compatible-view amendment draft records candidate public capabilities and the required interpretation, persistence and recovery guarantees.
Exact interfaces and worker lifecycle remain subject to the consolidated contract and evidence; no first-delivery export restriction has been accepted merely by documenting it.
```

Add after its accepted-boundary statement:

```markdown
The draft's proposed changes to live admission and worker ownership do not supersede the accepted application boundary until their exact contract is accepted.
Preserve its command mapping, human-only editing authority, complete-scene invariant and atomic application acceptance rules.
```

## Decisions and verification limits

Engineering evidence can settle mapping coverage, minimal interface shape, checkpoint versus replay feasibility and the viable canonicalization encoding.
The owner decision is whether to accept any specific, demonstrated reduction in user capabilities if the bounded implementation cannot preserve them.
The user need not choose parser internals or worker machinery.

The reviewer inspected the proposal, supporting contracts, current package/worker/controller code and retained diagnostic results, and checked primary standards.
It did not rerun converters, benchmarks, browser qualification or independent conformance production.
Recorded diagnostic results were reviewed, not newly reproduced.
The reviewer changed no files, configuration, Git or workflow state.
At review completion, the parent agent saved and formatted this separate report without changing the proposal.
The subsequent owner-authorized documentation synthesis applied the replacements; no implementation or renewed independent qualification is claimed.
