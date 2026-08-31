# ADR 0007: Nest axiom annotations on the annotation they describe

| Metadata    | Value                                                          |
| ----------- | -------------------------------------------------------------- |
| **Status**  | Accepted                                                       |
| **Date**    | 2026-08-20                                                     |
| **Decider** | Repository owner                                               |
| **Amends**  | `docs/adr/0004-vowl-specification-as-correctness-authority.md` |

## Context

OWL 2 lets an axiom carry annotations, and the RDF mapping round-trips them
through an `owl:Axiom` reification whose `owl:annotatedSource`,
`owl:annotatedProperty` and `owl:annotatedTarget` identify the axiom being
annotated. `universal_reference-data_20260714` uses this heavily:

```xml
<owl:Axiom>
    <owl:annotatedSource rdf:resource=".../AcceptabilityRating"/>
    <owl:annotatedProperty rdf:resource="http://www.w3.org/2004/02/skos/core#definition"/>
    <owl:annotatedTarget xml:lang="en">Scale of quality of being satisfactory…</owl:annotatedTarget>
    <dcterms:source rdf:resource="https://dictionary.cambridge.org/dictionary/english/acceptability"/>
</owl:Axiom>
```

The `dcterms:source` records where the wording of the _definition_ came from. It
does not say the class came from Cambridge.

The pinned oracle promotes such annotations to the annotated entity's own
`annotations` map, and `VOWLBuilder` was changed to copy that behaviour on the
grounds that ADR 0004 assigns the VOWL-JSON serialization to the implementation.
The repository owner rejected the result as misleading, and it is worse than
imprecise in three separate ways:

- It **asserts what the ontology does not say.** The class acquires a source it
  never claimed.
- It **destroys the disambiguation it just performed.** `owl:annotatedTarget`
  exists precisely to say which assertion is meant when a property is asserted
  more than once, and flattening computes that match and then discards it. A
  class with two definitions from two sources yields two entity-level sources
  with no way to pair them back.
- It **double-counts.** Where the entity already states the same value directly,
  the promoted copy is indistinguishable from it and appears twice. This was
  observed on `NominalProperty`, which acquired a third `modified` value.

VOWL 2 does not object to nesting. It says annotations are not part of the graph
and belong in a sidebar or tooltip, and specifies nothing about that sidebar's
data shape, so this fills a gap the specification leaves open.

## Decision

1. **An axiom's annotations attach to the annotation item they describe**, never
   to the entity. The item carries its own `annotations` map, shaped exactly as
   an entity's:

   ```json
   "definition": [{
     "identifier": "definition", "language": "en", "type": "label",
     "value": "Scale of quality of being satisfactory…",
     "annotations": {
       "source": [{ "identifier": "source", "type": "iri", "value": "https://…" }]
     }
   }]
   ```

2. **Nested under a dedicated `annotations` key**, not spliced in beside
   `identifier`, `language`, `value`, `type` and `predicateNs`. An annotation
   property whose local name collided with one of those would otherwise
   overwrite a reserved field, and local-name collision is a known hazard here -
   it is why `predicateNs` exists. The chosen shape is also self-similar, so the
   structure nests to any depth under one rule rather than two.
3. **Undeclared annotation properties are declared in the declaration phase**,
   before any axiom is read, rather than reconstructed while sweeping up
   unconsumed triples at the end. A reification can only attach to an assertion
   that exists when reifications are indexed, so the late recovery lost every
   annotation hanging off a recovered assertion.
4. **A triple on an `owl:Axiom` or `owl:Annotation` node is an annotation by
   construction**, whatever its object, because the mapping makes every triple
   on such a node beyond the three `owl:annotated*` ones part of the annotation
   set. Without this the reification's own annotation properties are never
   declared and the nesting has nothing to carry.
5. **Nested keys and their arrays are ordered by property IRI then value**, so
   the same ontology serialised differently produces the same output.

## Rationale

ADR 0004 assigns VOWL-JSON to the OWL2VOWL implementation because no
specification defines its field shapes. That authority covers **the shape of the
output** - which keys exist, how values are spelled - and stops there. Where OWL
2 defines what a construct _means_, the meaning is not the implementation's to
redefine, and reproducing a misattribution is replicated error rather than
compatibility. This ADR records that boundary, because the original mistake was
made by reading ADR 0004 point 3 as settling questions of meaning too.

Statement-level metadata is a recognised, first-class need rather than an
exotic case: it is what RDF 1.2's quoted triples exist for. The general
principle is that metadata about a statement must not be collapsed onto the
statement's subject, because doing so changes the subject of the claim.

`schema:position` shows the cost most plainly. The document uses it to order
several `skos:scopeNote` values on one class. Promoted to the entity,
`position: 1` says nothing at all; on a particular note it says which note comes
first.

## Consequences

- 144 annotations that were previously **dropped entirely** are now present.
  157 entities in `universal_reference-data_20260714` carry a nested annotation.
- The entity level no longer holds what the oracle puts there, so `annotations`
  remains a governed difference for the affected documents. This is recorded in
  the corpus register, and it is not information loss: before decision 3 those
  annotations did not survive parsing at all.
- The comparator projects each annotation item onto
  `{value, type, language, identifier}`, so the nested key itself is invisible
  to it and adds no differences of its own.
- `src/app/js/sidebar.js` must be extended to display nested annotations. Until
  then the information is carried but not shown, which is still strictly better
  than being discarded.
- `rdfs:label`, `rdfs:comment` and a description land in their own fields rather
  than as annotation items, so an axiom annotating one of those had no item to
  nest onto. Such an assertion is therefore surfaced as an annotation item as
  well, but **only** when the axiom carries annotations that would otherwise be
  lost; a plain label keeps exactly the shape it always had. Across the three
  documents that use reification, 358 annotations now carry nested ones, six of
  them on a label.
- `owl:annotatedProperty` may name something other than an annotation property,
  where the annotated axiom is a relation rather than an annotation. Ten such
  reifications exist in the corpus - five on `rdfs:subPropertyOf`, two on
  `rdfs:range`, one on `rdfs:domain` and two on `dcat:distribution` - against
  361 that nest correctly. They have no annotation item to attach to and no
  obvious home on an edge, so they remain unplaced and are recorded here rather
  than left implicit.

## Verification obligations

- An axiom annotation **MUST** appear nested on the annotation it describes and
  **MUST NOT** appear on the entity.
- Two assertions of one property carrying different axiom annotations **MUST**
  keep them apart.
- An annotation the axiom does not describe **MUST NOT** carry an empty
  container.
- A reification **MUST** attach to an assertion whose annotation property the
  document never declared.

## Implementation map

| Change                     | Location                                                          |
| -------------------------- | ----------------------------------------------------------------- |
| Declaration-phase recovery | `src/owlapi-js/rdf/rdfToOwlTranslator.js`                         |
| Recovery tests             | `src/owlapi-js/rdf/undeclaredAnnotation.test.js`                  |
| Nesting                    | `src/owl2vowl/js/vowlBuilder.js`                                  |
| Nesting tests              | `src/owl2vowl/js/vowlBuilder.annotations.test.js`                 |
| Governed differences       | `docs/owl2vowl/compatibility/production-corpus-differences.json`  |
