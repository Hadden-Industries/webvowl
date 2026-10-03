# Canonical VOWL compatibility decision packet

Date: 2 October 2026.
Status: Bounded diagnosis complete; earlier R1–R4 remedies superseded or narrowed by researched design resolutions.
Authority: [approved repair plan](../plans/2026-10-02-canonical-vowl-compatibility-repair-plan.md).
Application integration remains paused, with no production implementation, configuration, dependency or canonical authority changes in this pass.
The [research resolutions](canonical-vowl-compatibility-research.md) select compatible viewing with separate strict assessment, source-backed property interpretation, datatype preservation, nonblocking multiple-header handling and deferred portable identity.
R1–R4 below remain the historical candidate remedies and evidence, not unanswered questions requiring the owner to choose parser internals.
Canonicalization performance and concrete contract/schema qualification remain unproved engineering work.

The [post-review synthesis](canonical-vowl-compatibility-research.md#8-post-review-synthesis-and-remaining-decisions) applies all Astra proposals: preserve save/reload and existing exports, account for material relationships, and qualify recovery before choosing worker lifetime.
It supersedes blanket capture restrictions and mandatory replay; detailed schemas and empirical proof remain outstanding, with integration paused.

## Overall direction

The [proposed compatibility direction](../plans/2026-10-02-canonical-vowl-compatibility-repair-plan.md#proposed-compatibility-direction) leads with the migration expectation: ontologies viewable in pre-fork WebVOWL should remain viewable in WebVOWL 2.0, including import closures, with minor defensible differences and better explanations.
The earlier packet put too much emphasis on resolving preservation questions before permitting visualization.
Its findings remain valid; its proposed remedies are candidates to simplify, not accepted requirements or a prerequisite package for rendering.

Use one processing path with documented compatible interpretation and visible diagnostics.
Rendering, complete source preservation, canonical export and safe semantic editing are distinct guarantees.
An ambiguity affecting export or an edit should constrain that operation where necessary, rather than automatically prevent viewing the ontology.
The exact representation and operation contracts still require design; this direction does not authorize silent loss, arbitrary recovery, fallback conversion or changes to frozen authorities.

The current fork's converter comparisons below establish reproducible regressions, but pre-fork compatibility requires a pinned pre-fork converter and matched source/import closure evidence.
The six examples are the first acceptance cases, not a comprehensive compatibility claim.
Material departures from that baseline need evidence, user-facing explanation and regression coverage.

## Closure baseline

The offline comparison used the real old `loadWithImports` entry point and new `fromOwl` resolver boundary against identical available documents.
All six previously selected roots retained their recorded SHA-256 values.
One additional source, `BenchmarkOntology.ttl`, matches the historical OntoViBe root and version 2.2; the earlier filename search had incorrectly missed this candidate.
Matching identity/version does not establish exact historical content equality.

| Root                                      | Old closure documents, including root | Old result                                                                            | New result                                      |
| ----------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------- |
| FOAF                                      | 1                                     | 54 classes, 75 properties; category recovery diagnostics                              | `MAPPING_AMBIGUOUS`                             |
| GoodRelations                             | 1                                     | 109 classes, 250 properties; no diagnostics                                           | `MAPPING_SOURCE_INVALID`, reserved datatype IRI |
| MUTO                                      | 1                                     | 16 classes, 26 properties; no diagnostics                                             | Pass, 46 roles; no diagnostics                  |
| OntoViBe cardinalities, earlier candidate | 1                                     | 57 classes, 83 properties; unconsumed predicate diagnostic                            | `MAPPING_UNSUPPORTED_CONSTRUCT`                 |
| Personas                                  | 2                                     | 99 classes, 229 properties; multiple ontology headers diagnostic                      | `MAPPING_SYNTAX_INVALID` in imported document   |
| OntoViBe 2.2, matching candidate          | 2                                     | 56 classes, 49 properties; undeclared annotation and unconsumed statement diagnostics | `MAPPING_UNSUPPORTED_CONSTRUCT`                 |
| SIOC                                      | 1                                     | 49 classes, 125 properties; category recovery diagnostics                             | `MAPPING_AMBIGUOUS`                             |

Counts describe different output models and are not asserted equal across converters.
The new adapter fails before completing semantic admission for five named examples; serving their requested imports does not make these runs successful closure qualification.
Both engines requested the two expected imports and there were no unexpected offline lookups.
The four roots without declared imports are legitimate one-document closures, not tests with imports disabled.

Personas requests `http://protege.stanford.edu/plugins/owl/dc/protege-dc.owl`, mapped by the existing catalogue to the local copy.
OntoViBe 2.2 requests `http://ontovibe.visualdataweb.org/2.0/imported`.
The local `BenchmarkOntologyModule.ttl` explicitly declares that version IRI, so the diagnostic manifest binds that exact requested version to those bytes.
This is a diagnostic lookup entry only; no production catalogue change was made.
The local storage pathname is never used as a document/base IRI.

`compatibility-closure-diagnosis.json` contains the compact source/import manifest, hashes, acquisition ledger, old closure IDs/import declarations, diagnostics and comparison results.
Documents remain in their existing read-only source checkout; redistribution rights and portable fixture installation are not yet qualified.
Consequently COMPAT-01 has a diagnostic baseline but is not yet a completed portable acceptance suite.
Missing-file/hash enforcement, negative boundary tests and browser HTTP qualification remain implementation proof obligations.

## Minimal semantic findings

### Property roles

Two explicit declarations of one property as object and datatype property already pass the new compatibility adapter with `MAPPING_MULTIPLE_ROLES`.
A range of `rdfs:Literal` on that property also passes, retaining the distinct declarations.
Adding a named-class `rdfs:domain` causes `RDF_AMBIGUOUS_PROPERTY_ROLE`: the same domain statement can be expressed using either structural property category.
The inverse-functional datatype-property case fails at the same boundary.
This distinguishes supported multiple-role declarations from the unresolved uses affecting FOAF/SIOC.
The evidence does not support fixing the examples merely by removing a property-category whitelist.

**Decision R1: representation of unresolved RDF uses.**
Explicit source-scoped resolutions are smaller, but require per-statement author choices and would not provide a general automatic loading path for equivalent user files.
A source-statement representation could retain exact unresolved statements and their relationship to known subjects/roles, without claiming a selected typed axiom.
It requires a retained-model, inspection, editing and canonical-encoding design; a warning alone is insufficient if the statement disappears from the saved artifact.
Recommendation: authorize that bounded design before choosing a role-selection policy; do not silently copy the previous converter's preferred category or duplicate typed axioms without an accepted semantic argument.
Limit the design to the witnessed ambiguous domain/role and unsupported-statement cases, with explicit rejection outside its accepted grammar; do not infer authorization for a general RDF editor or OWL Full reasoner.
If that cannot fit a bounded grammar, return the expansion to the owner rather than implement it.

### Datatypes

Three minimal cases independently reproduce the `xsd:time` rejection: a property range, a datatype declaration and an annotation literal.
All parse in preserve mode; all are rejected by adapter policy after the owning assessment reports `RESERVED_ENTITY_IRI` and `DATATYPE_DEFINITION_COUNT`.
Thus literal compatibility also fails before the promised unverified-literal recovery can apply.

**Decision R2: compatibility datatype identity.**
Recommendation: allow the exact `xsd:time` datatype identity in compatibility mapping, including references/declarations/literals, with an explicit unverified-datatype diagnostic and no lexical-validity claim or coercion.
Keep strict OWL 2 DL assessment unchanged and do not exempt arbitrary reserved IRIs.
The owning API must expose sufficient structured evidence to distinguish this condition from malformed/reserved misuse; VOWL consumes that evidence rather than reimplementing the datatype validator.
The exact broader policy for other well-formed unsupported XSD datatypes should be defined and reviewed with this amendment, rather than accumulate an example-specific exception list.
This changes compatibility admission policy and requires explicit acceptance of the amended contract before implementation.

### Ontology identities and the matched OntoViBe source

`protege-dc.owl` declares two distinct ontology headers.
The old converter selects the Protege IRI and reports `RDF_MULTIPLE_ONTOLOGY_HEADERS`; preserve mode rejects both the real file and a two-header minimal fixture.
This is the first Personas failure with the import closure enabled; the previous root-only RDFC failure remains a separate, independently reproduced defect.

**Decision R3: imported ontology identity.**
Recommendation: design an explicit source-digest-bound ontology-header selection carried through the public acquisition/owning-parser boundary, with both the selected identity and excluded header statement accounted for.
Acquisition IRI alone must not silently decide ontology identity, and deleting a header from the fixture is forbidden.
Choosing one header does not automatically authorize dropping its annotations/imports; the design must define ownership and reject unresolved attribution.
A fully automatic multi-header representation would expand R1's model work; do not implement it implicitly.
The known fixture could use an accepted explicit resolution, while an unqualified user document would require a decision rather than arbitrary selection.

OntoViBe's matching source imports a module that parses successfully in preserve mode.
The root fails on unconsumed statements; old diagnostics name untyped or indirectly typed properties, including `untypedClassToClassProperty`, `cyclicProperty2`, `classToClassProperty2` and `functionalPropertyAsInverse`.
The last has functionality, class endpoints and an inverse link; these differ from the cardinalities variant's erroneous `owl:subClassOf` predicate.
The current pass does not establish which remaining statements admit a unique structural reconstruction.
Upstream must distinguish missed unambiguous role discovery from genuinely unresolved statements; the latter belongs to R1's decision.
No source repair or blanket ignore-unconsumed mode is proposed.

## Reduced canonicalization reproduction

Two authorized reduced probes used only declarations of distinct named classes and one n-ary `DisjointClasses` axiom.
They used normal public OWL ingestion with default limits and temporary process-local instrumentation of the installed RDFC implementation.
No source, installed package or repository implementation was modified.

| Named classes | Internal quads | Blank nodes | Allowed deep iterations | Outcome               | Local elapsed time |
| ------------- | -------------- | ----------- | ----------------------- | --------------------- | ------------------ |
| 8             | 362            | 99          | 9,801                   | `RDFC_RESOURCE_LIMIT` | about 220 ms       |
| 16            | 1,210          | 315         | 99,225                  | `RDFC_RESOURCE_LIMIT` | about 3.49 s       |

Instrumentation counted one extra attempted call when each limit was reached.
For eight classes, calls grouped as sets 4,280, class nodes 1,249, class roles 1,249 and disjoint edges 3,024.
The sixteen-class case showed the same pattern at larger counts.
This proves the default operating envelope fails on small ordinary structural input, without annotations, source ambiguity or network acquisition.
It isolates repeated recursive work in the generated relation/occurrence graph but does not prove an alternative encoding correct or a byte-preserving optimization impossible.
Both allocated reduced probes are consumed; no automatic further benchmark iteration is authorized.

**Decision R4: bounded canonicalization redesign experiment.**
Recommendation: authorize a separate design experiment comparing (a) a provably byte-preserving canonicalizer optimization with (b) an amended internal encoding that makes named semantic identity available without traversing layers of anonymous containers.
Bound this to two candidate designs, one measured pass per candidate against the two minimized inputs plus existing ordinary/poison controls, with no ceiling increase.
For option (a), equivalent canonical bytes must be proved against an independent RDFC oracle; do not label an algorithmic shortcut RDFC merely because examples agree.
For option (b), preserve complete field distinction and handle/order independence, and report all canonical-ID/byte changes.
Any changed A6 encoding needs an explicit authority/profile-version and affected-evidence migration decision before production implementation.
No extra triples, semantic hashes, skolemization or partial-graph canonicalization may be slipped in as an implementation-only optimization.

## Proposed order and remaining gates

First simplify the design around the product direction: established loading/rendering coverage, understandable interpretation diagnostics, and additional guarantees required by export/editing.
The owner delegated research-based resolution; follow the selected decisions in the research report instead of resubmitting the earlier R1–R4 package.
Present the concrete contract amendments and bounded implementation steps as one coherent design, retaining the unresolved measurement and qualification obligations.
Detailed upstream plans belong only in `owlapi`; this document records required public outcomes, not upstream implementation instructions.
R4 precedes qualification of all regenerated examples because ordinary topology can exhaust resources even after parser repairs.
Complete fixture rights/provenance and portable closure tests before claiming COMPAT-01 acceptance.

Then consolidate repairs and evidence for the already bounded Claude review; no broad review was requested during diagnosis.
No final full build or slice-completion claim is justified at this decision gate.
The application edits remain preserved and uncommitted, and execution generation 19 remains paused.

Evidence directory: `C:/Users/maksy/.hi/w/e/operator-reports/canonical-vowl-01a0f1b9/slice005-20261002-01/`.
New retained scripts/results are `compatibility-closure-diagnosis.mjs/.json`, `compatibility-minimal-diagnosis.mjs/.json` and `personas-reduced-work-probe.mjs/.json`.
Source hashes and exact minimized inputs are recorded there; these operator diagnostics are not independent conformance outputs.
