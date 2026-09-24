# Canonical VOWL design

> **Status:** Design decisions resolved for implementation planning; proposed specification; v1 wire contracts are not frozen
>
> **Decision date:** 24 September 2026
>
> **Repository:** `Hadden-Industries/webvowl`
>
> **Decision owner:** Maksym Shostak
>
> **Implementation location:** `packages/vowl`
> **License:** `AGPL-3.0-only`

This revision incorporates the [Deep Research Assessment of the Proposed Canonical VOWL Representation](../reviews/Deep%20Research%20Assessment%20of%20the%20Proposed%20Canonical%20VOWL%20Representation.md).
The assessment reviewed repository commit `354ed3af8c1e82019f6280b2594acaceac96cca0` on 24 September 2026 and recommended retaining the architecture with blocking specification changes.
Its repository and CI observations were static review evidence, not executed Canonical VOWL qualification.
The subsequent research closes the remaining design decisions using first principles, modern engineering practice, authoritative specifications, and adopted community practice, in that order.
Sections 27 and 28 distinguish readiness to write an implementation plan from the executable artifacts and evidence required before a v1 freeze.

This document and two normative annexes form the design:

- [Core contract](2026-09-24-canonical-vowl-core-contract.md): complete field grammar, normalization, internal RDF templates, validation, errors, limits, and adapter policies.
- [Projection and artifact contract](2026-09-24-canonical-vowl-projection-contract.md): exact occurrence generation, visual/details-only classification, artifact fields, labels, externality, and display modes.
- [Research and decision record](2026-09-24-canonical-vowl-design-decisions.md): evidence hierarchy, alternatives, resolved decision tree, and planning versus qualification boundaries.

The annexes specify the detailed rules summarized here; they are part of the proposal, not optional implementation suggestions.

## 1. Definition

**Canonical VOWL** is a versioned, producer-neutral JSON representation of a normalized VOWL visual ontology model whose retained structural information and, for the artifact profile, portable visualization state are mapped to one closed data model and encoded as RFC 8785 bytes, so conforming producers of the same normalized VOWL model emit identical bytes.

Canonical VOWL identifies a VOWL representation.
It does not identify the source document bytes, the complete OWL axiom inventory, or all OWL ontologies with the same entailments.

**Disposition: Formulate.**
No inspected VOWL specification defines a canonical byte representation, and neither RFC 8785 nor RDFC-1.0 defines VOWL's semantic normalization.
This design therefore formulates a Canonical VOWL profile while reusing those standards for the jobs they actually specify.

**Status:** Proposed.
The profile does not become an adopted standard merely because this repository implements it.
Adoption by OWL2VOWL or another body is a separate governance event.

Boundary tests:

- **Positive instance:** Turtle and RDF/XML sources that resolve to the same retained closure and normalized VOWL model produce identical structural profile bytes.
- **Negative instance:** Two OWL ontologies that have the same entailments but different retained asserted VOWL structures need not produce identical bytes.
- **Near miss:** Pretty-printed JSON with sorted object keys and selected arrays is repeatable output, but it is not Canonical VOWL unless it also satisfies the closed model, graph labelling, set/sequence, validation, and exact RFC 8785 rules in this design.

## 2. Context

The reconstructed JavaScript VOWL exporter now makes repeat exports more stable, but deterministic-looking JSON is not a canonical semantic format.
RFC 8785 deliberately preserves array order and cannot remove arbitrary producer IDs, normalize a graph, distinguish sets from sequences, or decide which OWL information belongs in VOWL.
RDFC-1.0 can canonicalize anonymous RDF graph structure, but VOWL JSON is not itself asserted to be RDF and first needs an injective normative mapping.

Canonical VOWL must therefore compose three distinct operations:

1. normalize a producer-neutral VOWL source model;
2. assign deterministic document-local identities to anonymous graph objects;
3. encode the resulting closed JSON document as RFC 8785 UTF-8 bytes.

These operations share one implementation.
The structural-content and artifact profiles are projections of the same source model, not separate formats maintained by separate builders.

## 3. Goals

The design must:

1. produce byte-identical output for the same normalized VOWL model across conforming producers, locales, runtimes, and supported source syntaxes;
2. provide exact bytes suitable for external digests and detached signatures;
3. retain the VOWL-relevant distinctions that the historical parallel-array representation loses;
4. separate ontology identity, semantic roles, VOWL constructs, and visual occurrences;
5. support anonymous and symmetric structures without retaining producer IDs;
6. preserve full annotation predicates, values, lexical forms, and nesting;
7. distinguish unordered sets from ordered, repetition-permitting sequences;
8. preserve one source of truth for every canonical fact;
9. keep strict and compatibility OWL mapping behind one Canonical VOWL core;
10. provide an explicit one-way migration route for named historical dialects;
11. reject ambiguous, unsupported, or noncanonical input instead of guessing;
12. protect graph canonicalization from pathological resource consumption; and
13. remain usable as the input to a VOWL visualization, rather than becoming a second general-purpose OWL serialization.

## 4. Non-goals

Canonical VOWL does not:

- define OWL semantic or entailment canonicalization;
- preserve every OWL axiom or ABox assertion;
- preserve source syntax, prefixes, whitespace, comments, document URLs, redirects, cache locations, or retrieval history;
- claim that VOWL JSON is JSON-LD or an RDF concrete syntax;
- embed a digest, signature, key, proof, producer, mapper, migration record, diagnostic, or acquisition provenance;
- retain historical OWL2VOWL output as an alternative output mode;
- provide automatic historical-dialect detection;
- provide durable identifiers for anonymous expressions or visual occurrences;
- reproduce a layout engine's future trajectory;
- reproduce CSS, themes, fonts, DOM state, viewport pixels, device-pixel ratio, hover, selection, search, or open sidebars;
- register a new media type; or
- implement cryptographic signing or digest algorithms.

## 5. Authority and interpretation

The normative dependency order is:

1. this Canonical VOWL design and its normative annexes for VOWL-specific meaning, with executable schemas implementing their closed grammar;
2. the [VOWL 2 specification](../owlapi-js/conformance/upstream/vowl-2/index.html) for visual mapping where this profile has not deliberately tightened or extended it;
3. the [OWL 2 Structural Specification](https://www.w3.org/TR/owl-syntax/) for OWL structures, sets, sequences, annotations, imports, and anonymous individuals;
4. [RDFC-1.0](https://www.w3.org/TR/rdf-canon/) for canonical labelling of the profile's normative internal RDF dataset;
5. [RFC 8785](https://www.rfc-editor.org/rfc/rfc8785.html) for final JSON serialization; and
6. [RFC 7493](https://www.rfc-editor.org/rfc/rfc7493.html) for the I-JSON input restrictions used by RFC 8785.

Where historical OWL2VOWL JSON, the current builder, or a Java OWL2VOWL result conflicts with this design, the historical shape is migration input rather than normative Canonical VOWL.

VOWL 2 defines a visual notation, concentrates primarily on the TBox, and does not define a glyph for every OWL 2 structure.
Retaining an OWL structure and drawing it with standard VOWL notation are separate claims.
The projection matrix in annex B identifies conditional visual treatment and details-only retention; v1 introduces no extension glyphs.
A historical WebVOWL glyph is not sufficient authority to call an extension standard VOWL 2.

## 6. Identifiers, profiles, and versioning

### 6.1 Canonical profiles

The two proposed canonical profile identifiers are:

```text
https://haddenindustries.com/ontology/profiles/vowl/canonical/structural-content/v1
https://haddenindustries.com/ontology/profiles/vowl/canonical/artifact/v1
```

The structural-content profile binds the normalized VOWL structure and visual topology.
The artifact profile binds the same semantic source plus portable static visualization state.

The `/v1` suffix does not imply that the wire contract is already frozen.
Until the freeze gate in section 27 passes, these IRIs name proposed profiles and experimental outputs must be identified as such outside canonical bytes.
Draft changes must remain traceable to a specification revision; consumers must not treat draft artifacts as a stable interoperability contract.

After freeze, a change that can alter conforming bytes for an unchanged input requires a new profile identifier.
Clarifications and errata that provably do not change bytes may revise the prose and conformance suite without minting a new profile.
The byte-affecting contract includes the internal RDF vocabulary and encoding, category-ID issuance, projection rules, semantic validation, and set ordering, even when their implementation modules are private.

Before publication, each profile IRI must resolve directly, or through a stable registry, to an immutable specification bundle containing the exact schema, RDF mapping, ID rule, projection matrix, and conformance manifest for that profile.
Descriptive landing pages may evolve, but their normative bundle references must remain pinned and retrievable.
Core validation uses the selected bundled contract; it does not dereference profile IRIs or acquire schemas over the network.

### 6.2 Supporting ontology

The supporting vocabulary uses the persistent ontology base:

```text
https://haddenindustries.com/ontology/vowl
```

Published ontology versions use date-based version IRIs.
Profile identifiers use monotonic numeric versions because they are wire contracts, not dated snapshots.
The supporting ontology describes profile concepts; it is not a substitute for the JSON Schema or canonicalization algorithm.

### 6.3 OWL mapping profiles

`vowl/owl` publishes separately versioned strict and compatibility mapping profile identifiers.
Their exact IRIs and recovery catalogue are fixed in core contract A9.
Compatibility is the documented default.
The selected mapping profile and diagnostics are outside Canonical VOWL bytes.

Changing a recovery rule requires a new mapping-profile identifier even when the Canonical VOWL schema version does not change.

## 7. Package architecture

### 7.1 Ownership

The private `src/owl2vowl` implementation evolves into the workspace package at `packages/vowl`.
It remains in this repository; it does not move into `owlapi` or an independent repository.

The package owns:

- the producer-neutral normalized source model;
- structural and artifact profile validation;
- the normative internal RDF mapping;
- RDFC-1.0 labelling;
- set ordering and RFC 8785 serialization;
- exact canonical decoding;
- OWL-to-VOWL mapping through the `vowl/owl` subpath;
- named historical migrations through `vowl/migrate`;
- schemas, fixtures, conformance tests, and profile documentation.

`owlapi` owns OWL parsing, ontology objects, imports-closure lifecycle, and OWL structural behavior.
WebVOWL owns application state and rendering.
Neither may duplicate Canonical VOWL normalization.

### 7.2 Public surfaces

The package has three public surfaces:

```text
vowl
vowl/owl
vowl/migrate
```

The root is the deep producer-neutral module.
Its interface is limited to:

```js
await canonicalize(source, { profile, signal, limits }); // canonical document
encode(document);                                        // Uint8Array
await decode(bytes, { signal, limits });                 // canonical document
```

The root also exposes immutable profile constants and one error class with stable codes.
It does not expose the RDF mapping, RDFC library, JCS library, comparators, graph indexes, validators, or identifier issuers.

`canonicalize` accepts the normalized source model, validates and snapshots it, labels the complete selected profile, constructs the closed canonical document, and deeply freezes that document.

`encode` accepts only a valid canonical document.
It does not repair or relabel.
It returns a new caller-owned byte array containing RFC 8785 UTF-8 bytes.
The synchronous operation accepts immutable documents whose full canonical validation was established by `canonicalize` or `decode` in this module instance.
An arbitrary parsed or copied object must enter through one of those operations; being frozen or matching the schema alone does not prove its RDFC-derived IDs.
Any internal validation marker is runtime state and never a canonical field.

`decode` accepts only exact canonical bytes.
It performs fatal UTF-8 decoding, duplicate-member-safe lexical JSON validation before object construction, closed-schema and semantic validation including canonical graph identity, re-encoding, and byte-for-byte comparison before returning a deeply frozen document.

There is deliberately no separate public `validate`, `isCanonical`, RDF, digest, or signature function.
Those would expose shallow stages or duplicate the guarantees of the three operations.

### 7.3 OWL adapter

`vowl/owl` exposes one conversion operation:

```js
await fromOwl(source, {
  documentIri,
  mediaType,
  mappingProfile,
  resolveImport,
  signal,
  limits,
});
```

`source` is a byte-array snapshot; `documentIri` and `mediaType` are explicit parser inputs.
Core contract A9.1 fixes the import resolver's request/result shape, mapping default, and errors.

It returns the previously accepted immutable envelope:

```js
{
  document,
  mappingProfile,
  diagnostics,
}
```

`document` is a valid canonical structural-content document.
`mappingProfile` is the exact selected profile identifier.
`diagnostics` is a deterministically ordered, noncanonical collection.
`VOWLBuilder` constructs the shared normalized source internally and invokes the root canonicalizer; it does not expose a legacy result or a second serializer.

Import resolution is a real seam because production and tests require distinct adapters.
The caller controls it.
The canonical core performs no network I/O.

### 7.4 Migration adapter

`vowl/migrate` exposes one migration operation requiring an explicit, versioned dialect identifier.
It never infers a dialect from shape.
Core contract A9.3 fixes `migrate(bytes,{dialect,profile,resolutions?,signal?,limits?})`, its immutable result, the initial dialect identifier, and typed caller resolutions.

Migration is one way:

```text
named legacy dialect -> normalized source -> Canonical VOWL
```

There is no Canonical VOWL-to-legacy output and no runtime fallback.
A migration that cannot recover a required distinction must fail or require an explicit caller-supplied resolution; it must not invent an annotation IRI, ontology identity, viewport, or semantic category.

### 7.5 Optional interoperability projection

A future companion RDF or JSON-LD view may support linked-data consumers without changing Canonical VOWL identity.
It is informative, noncanonical output with separately documented semantics; the private labelling dataset is not automatically an appropriate public ontology graph.
Optional SHACL shapes over such a view cannot replace JSON Schema and Canonical VOWL semantic validation.
This is follow-up work, not a fourth v1 public surface, a new `@context` field, or a prerequisite for the canonical core.

## 8. One source model, two profile projections

### 8.1 Source handles

The normalized source is plain, acyclic structured data.
Producers use local string handles only to express references among source records.
Handles must be unique within the input, but their spelling and encounter order do not participate in canonical identity and never appear in output.

JavaScript object identity is not a source reference mechanism.
Requiring explicit handles keeps the model language-neutral and testable by independent producers.

### 8.2 Canonical record categories

The structural model has five nonoverlapping categories:

1. **subjects** — annotation-capable identity bearers, named by an absolute IRI or anonymous within the resolved closure;
2. **roles** — a subject's semantic role: class, RDFS-only class, datatype, object-property, data-property, annotation-property, individual, or genuinely generic RDF property;
3. **expressions** — typed class, object-property, or data-range expressions;
4. **constructs** — normalized relationships, groups, assertions, and other VOWL-relevant statements; and
5. **occurrences** — visual nodes, edges, and movable labels that project roles, expressions, or constructs.

This replaces the legacy parallel `class`/`classAttribute` and `property`/`propertyAttribute` arrays.
It removes hidden joins, copied attributes, traversal IDs, and the need to mutate one half while reconciling the other.

### 8.3 Canonical local IDs

Every referenceable record receives a category-specific opaque identifier such as `s0`, `r0`, `x0`, `c0`, or `o0`.
These identifiers are:

- issued from the RDFC-1.0 canonical identifier map;
- local to one document and profile;
- recomputed after a material edit;
- permitted to differ between structural and artifact projections;
- never copied from an OWL blank-node label or legacy OWL2VOWL ID; and
- forbidden as standalone external or durable identity.

Named semantic identity remains the subject's absolute IRI.
An external reference to an occurrence must bind both the immutable document digest and the occurrence's local ID.

The structural semantic source is shared across profiles.
The serialized `structural` subobject is not promised to be byte-identical between profiles, because artifact-only facts must participate in whole-profile labelling to prevent coordinates from being associated with the wrong member of an anonymous symmetry class.
Consumers must not join profiles, revisions, or artifacts by comparing local ID strings.
Section 18.2 specifies the category partition and ordinal assignment; encounter order is never an ID issuance rule.

## 9. Canonical document envelope

The structural-content envelope is:

```json
{
  "profile": "https://haddenindustries.com/ontology/profiles/vowl/canonical/structural-content/v1",
  "structural": {
    "ontology": {"imports": [], "annotations": []},
    "subjects": [],
    "roles": [],
    "expressions": [],
    "constructs": [],
    "occurrences": []
  }
}
```

The artifact envelope is:

```json
{
  "profile": "https://haddenindustries.com/ontology/profiles/vowl/canonical/artifact/v1",
  "structural": {
    "ontology": {"imports": [], "annotations": []},
    "subjects": [],
    "roles": [],
    "expressions": [],
    "constructs": [],
    "occurrences": []
  },
  "visualization": {
    "placements": [],
    "camera": {"center": {"x": 0, "y": 0}, "zoom": 1},
    "hidden": [],
    "labelSelection": {"mode": "untagged"},
    "prefixes": [],
    "display": {
      "compactNotation": false,
      "nodeScaling": "uniform",
      "externalColoring": true
    }
  }
}
```

All top-level collections are required, including when empty.
These are valid empty-model envelope examples, not implicit artifact defaults; actual state is always supplied explicitly.
Optional fields are permitted only where absence has a defined meaning.
`null` is not an alternative spelling for absence or an empty collection.
Core contract A2 defines the source envelope and every semantic field; annex B defines occurrence and artifact fields.
The core requires an explicit profile option and rejects supplied visualization state when structural-content is selected.

Instances contain no `@context`, `$schema`, producer comment, source URL, diagnostics, provenance, or internal digest.
The profile IRI selects the schema and algorithms.

## 10. Root ontology and imports

The `ontology` record binds:

- optional root ontology IRI;
- optional version IRI, legal only when the ontology IRI is present;
- the root ontology's authored direct import declarations; and
- the root ontology's own ontology annotations.

It does not bind document aliases, resolver mappings, closure traversal order, resolved-edge topology, source document IRIs, imported ontology IDs, or imported ontology annotations.

The OWL adapter's private builder receives the parsed root ontology and manager-resolved closure rather than serializing and reparsing an `OWLOntologyMerger` result.
It maps closure membership as a set and standardizes anonymous individuals apart by source ontology before canonical labelling, as OWL requires.

Strict mapping fails without a complete resolved closure.
Compatibility mapping retains every authored root import declaration, maps the successfully resolved subset, and reports each missing import outside canonical bytes.

## 11. Semantic model rules

### 11.1 Closed vocabulary

Canonical VOWL uses closed, case-sensitive ASCII tokens for its own role, expression, construct, occurrence, and mode kinds.
It uses absolute IRIs for ontology entities, annotation properties, datatypes, facets, imports, and other semantic resources.

Compact names such as `owl:Class` are forbidden in canonical fields.
The JSON is not JSON-LD, and VOWL visual concepts are not assigned invented OWL IRIs.

### 11.2 Roles and punning

A role is uniquely identified in the normalized source by `(subject, role-kind)`.

- Class/individual punning produces two roles over one subject.
- Compatibility mapping may retain object-, data-, and annotation-property roles over one subject.
- Strict mapping rejects category combinations forbidden by OWL 2 DL.
- A generic `rdf-property` role is used only when the source genuinely provides no more specific category; it never conceals an explicit conflict.
- An `rdf-class` role retains an explicitly RDFS-only class; a specific `class` role supersedes it for the same subject.
- A declaration creates a role only when the role would otherwise be absent.
  Redundant unannotated declarations do not change Canonical VOWL.

The generic legacy `attributes` bag is eliminated.
Role kinds, positive property characteristics, expressions, constructs, and annotation assertions carry their own meaning.
`anonymous`, `deprecated`, `external`, `inferred`, and `key` are not free-form characteristics.

### 11.3 Class expressions and restrictions

Restrictions are first-class typed expressions, not decorations copied onto a property edge.
The retained recursive expression closure includes:

- intersection, union, complement, and enumeration;
- object and data `someValuesFrom` and `allValuesFrom`;
- object and data `hasValue`;
- object `hasSelf`;
- minimum, maximum, and exact qualified or unqualified cardinalities;
- inverse object-property expressions; and
- referenced data-range expressions.

Each cardinality is a decimal string matching `0|[1-9][0-9]*`.
It never passes through JavaScript `Number`.
Structurally different restrictions remain different.
Adapters deduplicate exact typed structures under core contract A3; they validate source arity before deduplicating set operands and retain a resulting singleton constructor.

An omitted object filler normalizes to explicit `owl:Thing`; an omitted data filler normalizes to explicit `rdfs:Literal`.
Missing property domains or ranges use annex B's generic endpoint without adding an asserted endpoint construct.
Multiple domain or range axioms normalize to an intersection expression, so a directly asserted intersection and the equivalent collection of separate unannotated endpoint axioms yield the same VOWL result.

Canonicalization performs no algebraic simplification, satisfiability check, reasoner inference, transitive closure, or weakest-bound selection.

### 11.4 Property constructs

The model retains each property construct once:

- directed subproperty relationship;
- unordered equivalent-property group per retained source relationship;
- unordered disjoint-property group per retained source relationship;
- unordered inverse-property pair over object-property expressions;
- ordered, repetition-permitting property chain with one superproperty;
- directed object/data property domain and range;
- positive property characteristic; and
- class-scoped key with separate object- and data-property sets.

Core contract A4 also fixes generic RDF property and annotation-property relationships, their target categories, and the exact characteristic vocabulary.

There are no reciprocal `subproperty`/`superproperty` arrays, inverse aliases, pairwise expansions of n-ary groups, or computed equivalence closure.

### 11.5 Datatypes, data ranges, and literals

A named datatype is a subject with a datatype role.
A datatype definition is a directed construct from that role to a data-range expression; it does not replace the role.

Data-range expressions include intersection, union, complement, enumeration, and datatype restriction.
Intersection, union, and enumeration operands are sets.
A datatype restriction contains one named base datatype and a set of `{facet, value}` pairs.
Different pairs using the same facet remain distinct.
Nested unions or intersections are not flattened.

All literal-bearing fields reuse one value model:

```json
{"kind":"typed","lexical":"01","datatype":"http://www.w3.org/2001/XMLSchema#integer"}
```

or:

```json
{"kind":"language","lexical":"colour","language":"en-gb"}
```

The language form implies `rdf:langString`; that datatype cannot also appear in the typed branch.
An untagged simple string normalizes to typed `xsd:string`.
Language tags are well-formed BCP 47 and lowercase.
Lowercasing is an ASCII spelling rule applied after well-formedness validation, not full BCP 47 canonicalization.
It does not substitute preferred subtags, expand likely subtags, rewrite deprecated tags, or reorder extensions using a changing language registry.
For example, `EN-gb` normalizes to `en-gb`; lowercasing does not equate `iw` with `he`.
Artifact language ranges use the separate RFC 4647 grammar in annex B4 and the same ASCII-only lowercasing policy.
RDF 1.2 directional strings are outside v1.

Literal lexical forms are preserved exactly.
Canonical VOWL does not convert them to XSD canonical lexical forms, Unicode-normalize them, or materialize them as JavaScript numbers or dates.
Strict mapping rejects an invalid lexical form; compatibility mapping may retain a syntactically valid ill-typed RDF literal with an external diagnostic.

### 11.6 Groups

Logical groups are stored once:

- union and intersection expressions contain member sets;
- complement has one operand;
- equivalent and disjoint constructs retain their member group;
- disjoint union retains its defined class and member set; and
- keys retain their scoped class expression and two property sets.

Renderer-created pairwise lines are occurrences or derived runtime state, not duplicated semantic constructs.

## 12. Annotations and normalized assertion anchors

Every retained annotation records:

- the complete annotation-property IRI;
- a discriminated IRI, anonymous-subject, typed-literal, or language-literal value; and
- its own unordered nested-annotation set.

Annotation records are never grouped by local name.
`rdfs:label`, `rdfs:comment`, descriptions, deprecation, and other application views are derived from the one annotation representation.

The structural model retains:

- root ontology annotations on the root ontology record;
- every retained annotation assertion axiom in the resolved closure, including assertions whose subject has no visual occurrence;
- assertion anchors carrying axiom annotations on every retained construct or declaration; and
- annotations on annotations recursively.

Annotations must remain attached to the exact assertion they annotate.
Every annotated source assertion uses the same `assertion-anchor` shape in core contract A4, whether or not aggregation occurs.
The base construct contains normalized meaning once, while each anchor retains its pre-aggregation typed assertion and exact annotation set.
Anchors must be supported by the corresponding base fact, declaration, or aggregate and never introduce unrelated facts.
Unannotated source assertions are not inventoried merely to preserve their spelling.

For example, two unannotated property-domain axioms for `A` and `B` normalize to the same endpoint as one domain axiom for `A intersection B`.
If either original axiom is annotated, its typed domain assertion is retained as an annotation anchor so the annotation is not falsely attached to the combined intersection.
The same rule applies to annotated characteristics, declarations, and other constructs whose unannotated form normalizes into a role or aggregate.

This is not a complete source-axiom inventory.
It is the minimum information needed to preserve retained first-class OWL annotations without duplicating unannotated source structure.

## 13. ABox boundary

Canonical VOWL v1 retains the ABox information required by VOWL's class-associated individual presentation, but it does not become a general individual graph format.

It retains:

- explicit individual roles created by retained declarations or use;
- directly asserted class memberships, including a complex class expression;
- individuals referenced by retained enumerations and value restrictions; and
- annotations on retained individual subjects and class-membership constructs.

It excludes:

- inferred class memberships;
- subclass-derived or reasoner-derived individual counts;
- positive and negative object-property assertions;
- positive and negative data-property assertions; and
- same- and different-individual axioms.

Excluded well-formed constructs produce deterministic mapping diagnostics.
They are not approximated.
A future profile may add an ABox graph, but it must use a new identifier and cannot appear as a flag that changes v1 bytes.

Legacy `instances`, `individuals`, and per-class count fields are not canonical truth.
A renderer derives direct unique membership counts from retained class memberships.
It performs no `sameAs` quotient or inference.
An IRI with both class and individual roles remains two roles; an individual equality statement is never promoted to class equivalence.

## 14. Visual occurrences

### 14.1 Occurrence identity and topology

Occurrences represent the VOWL projection without copying semantic fields.

- A class node references one expression/role or an explicitly grouped set of named class roles; a datatype node references one datatype role.
- A property edge references its property-role partition and endpoint occurrences; other edges reference their originating construct or operator expression.
- A movable label occurrence references its edge occurrence.
- Occurrence-specific projection kind and split context are closed fields.
- Labels, annotations, characteristics, IRIs, and expression operands remain on the semantic records they belong to.

The normative projection in annex B applies per-property datatype splitting and per-linked-class generic `owl:Thing`/`rdfs:Resource` splitting, with an explicit property context when the opposite endpoint is a datatype.
Each split occurrence records the exact semantic context that distinguishes it.
Named class equivalence components share a glyph; generic classes, anonymous classes, and expression glyphs retain the distinct treatment fixed in B2.1.
Equivalent properties share a projection only when their own normalized endpoint terms match; inverse pairs share an inverse glyph only for exactly reversed drawable endpoints.
The core checks an exact bijection between supplied occurrences and the topology generated by annex B.

Constructs for which the v1 projection matrix defines no graph glyph are details-only and have no occurrence of their own.
Their absence from the drawing does not remove them from structural identity.

### 14.2 VOWL projection matrix

Each retained role, expression, and construct kind must have exactly one entry in a versioned, machine-readable projection matrix published with the profile.
Each entry specifies retention, `presentation` (`visual`, `details-only`, or `extension`), the permitted occurrence kind or `none`, endpoint and split-context rules, any qualifying conditions, and its VOWL 2 authority or explicit extension rationale.
The matrix must distinguish direct glyphs from interaction-only treatment and non-graph details.
No implementation may infer missing rows from a legacy builder or choose a new glyph at runtime.

Annex B2.5 enumerates every retained semantic kind; B1–B2.4 fix the occurrence grammar, generation keys, and all qualifying conditions.
The following table summarizes those rules:

| Retained structure                                                                                          | v1 presentation and occurrence policy                                                                                                                         |
| ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Classes, `owl:Thing`, `rdfs:Resource`, named datatypes, and `rdfs:Literal`                                  | `visual`: VOWL 2 nodes and the specified generic-element splitting rules.                                                                                     |
| Object, data, and genuinely generic RDF properties with domain/range                                        | `visual`: VOWL 2 property representation with typed endpoints; aggregated endpoint expressions retain their semantic structure.                               |
| Subclass relations, equivalent classes, disjoint classes, equivalent properties, and inverse-property pairs | `visual` where VOWL 2 defines the notation; shared or pairwise drawing never duplicates the underlying semantic group.                                        |
| Subproperty relations                                                                                       | `visual` through VOWL 2's interaction treatment; no invented permanent hierarchy edge.                                                                        |
| Functional, inverse-functional, symmetric, and transitive characteristics                                   | `visual` through their VOWL 2 property treatment, without copying characteristics into occurrence records.                                                    |
| Reflexive, irreflexive, and asymmetric characteristics                                                      | `details-only`; preserved OWL 2 facts do not create a purported VOWL 2 glyph.                                                                                 |
| Class union, intersection, and complement                                                                   | `visual`: VOWL 2 operator notation and operand connections.                                                                                                   |
| Class enumerations and individual references                                                                | `details-only` in v1; retain the expression and members without inventing an individual graph.                                                                |
| Unqualified minimum, maximum, and exact cardinalities                                                       | `visual` only where a scoped VOWL 2 cardinality label preserves the retained restriction's meaning; otherwise `details-only`. No weakest-bound approximation. |
| Qualified cardinalities                                                                                     | `details-only` in v1; the qualifier and scoped restriction remain first-class structure.                                                                      |
| Object/data `someValuesFrom`, `allValuesFrom`, and `hasValue`, plus object `hasSelf`                        | `details-only`; no quantified-restriction edge is inherited from current WebVOWL extensions.                                                                  |
| Inverse object-property expressions                                                                         | Retained operands of constructs; no standalone expression glyph is invented. An inverse-property relation uses its separate VOWL 2 projection rule.           |
| Data-range operators, facet restrictions, and datatype definitions                                          | `details-only` beyond named-datatype notation; no class-operator glyph is repurposed with a different meaning.                                                |
| Disjoint-property groups, disjoint union, property chains, and keys                                         | `details-only` in v1; ordered chains and key-member sets remain in structural identity.                                                                       |
| Annotation-property roles, annotation assertions, nested annotations, and assertion anchors                 | `details-only`; applications derive labels and text views from the retained assertions.                                                                       |
| Root ontology metadata and direct imports                                                                   | `details-only` header information.                                                                                                                            |
| Individuals and direct class memberships                                                                    | `details-only` class-associated listings and derived direct membership counts, not a general ABox graph.                                                      |

The normative matrix and safe-cardinality conditions are complete in annex B.
Producing the equivalent machine-readable matrix and executable fixtures is implementation work; it must not introduce new projection choices.
Implementation fixtures must likewise cover the completed base-IRI, builtin-exemption, label-selection, fallback, and display-mode rules in annex B.
These rules affect canonical content and cannot be left to an implementation's UI defaults.

No v1 row uses `extension`; a future extension entry must identify its additional notation explicitly.
The retained OWL 2 structures marked details-only above do not authorize extension glyphs in v1.
Adding such glyphs after freeze requires a new canonical profile when occurrence topology or canonical display state changes; a renderer flag cannot silently change v1 bytes.

### 14.3 Derived externality

Externality is a derived presentation classification, not provenance.
It uses the root ontology IRI, the complete subject IRI, a profile-defined base-IRI comparison, and a closed set of built-in exemptions.
Annex B5 fixes the lexical algorithm, exact exemption list, grouped-glyph behavior, and examples.
If the root ontology is anonymous, no subject is classified as external.
Imported-ontology membership is not an externality test.

### 14.4 Renderer accessibility obligations

The model retains labels, language information, roles, relationships, and details-only constructs so consumers can provide equivalent text exploration.
Application cutover must qualify keyboard navigation, accessible names and relationship summaries, alternatives to color-only meaning, and access to retained facts with no glyph.
Canonical-byte conformance does not establish application accessibility conformance.
ARIA strings, focus, DOM state, and theme state remain renderer concerns and are not added to canonical bytes.

## 15. Artifact profile

### 15.1 Static snapshot

The artifact is a portable static visualization.
It restores paused and binds:

- one position for every positionable node and movable-label occurrence, including currently hidden occurrences;
- an explicit pin boolean for every placement;
- camera center and zoom;
- the effective hidden-occurrence set;
- the effective label-selection mode;
- the effective display-prefix map; and
- standardized VOWL display modes that change notation or semantic visual encoding, including compact notation, node scaling, and external coloring.

It excludes force velocities, force parameters, alpha/convergence state, random state, timers, running/paused session state, DOM/SVG details, viewport dimensions, device-pixel ratio, CSS, themes, fonts, hover, focus, selection, search, editor mode, and open-panel state.

Force parameters are excluded even if a current application persists them.
Once exact positions are present, they are instructions for a possible future layout run rather than facts required to reproduce the static artifact.

### 15.2 Coordinates and camera

Positions and camera center use one dimensionless VOWL canvas coordinate system:

```json
{"x":0,"y":0}
```

Camera state is:

```json
{"center":{"x":0,"y":0},"zoom":1}
```

All values are finite IEEE 754 binary64 numbers.
`zoom` is greater than zero.
Canonical input rejects negative zero; an adapter may normalize a computed negative zero to positive zero before constructing the source.

Coordinates are not quantized.
RFC 8785 controls their number serialization.

### 15.3 Effective visibility and display state

The artifact stores the effective hidden-occurrence set rather than implementation-specific filter controls.
This prevents a filter setting and its derived visibility result from becoming two sources of truth and allows a different renderer to reproduce the same selected scene.

The label-selection value is a closed discriminated mode for full IRI, untagged label, or a lowercased language range with its grammar and matching rule fixed by the profile.
Language-range validation is distinct from language-tag validation; both use the spelling-only lowercasing policy in section 11.5.
Candidate selection and fallback are normative and locale independent.
Multiple candidates at the same precedence are resolved by canonical UTF-8 byte order, never collation.

The prefix map contains effective display bindings only.
Structural data uses full IRIs.
Raw prefixes from Turtle, RDF/XML, Functional Syntax, or JSON-LD do not survive merely because they occurred in a source document.

Annex B3–B5 fixes the closed state grammar, incidence-closed hidden set, camera transform, exact language lookup/default, prefix ties, compact notation, and direct-membership scaling formula.
There is no automatic English fallback or application-preference default.

## 16. No derived duplication

Semantic and presentation attributes have one source of truth.
The deliberate exception is the validated occurrence topology and its semantic reference sets: these address visual objects, support portable state, and are required in both profiles.
That structural addressing does not permit copying semantic attributes onto occurrences.

Excluded examples include:

- class, property, datatype, node, language, namespace, and individual counts;
- language and base-IRI inventories;
- per-record base IRIs;
- reverse subproperty lists;
- copied labels, comments, characteristics, or annotations on occurrences;
- `anonymous`, `deprecated`, `external`, `inferred`, and other derived flags;
- both filter controls and their effective visibility result; and
- internal section digests.

An aggregate is primary rather than redundant only when its underlying detail is deliberately outside the profile. v1 does not currently require such an aggregate.

## 17. Collection semantics

Every array field is normatively one of:

- a **set**: unordered and duplicate-free; or
- a **sequence**: ordered and repetition-permitting when its construct permits repetition.

Adapters normalize source sets and may report eliminated source duplicates.
The public canonicalizer rejects duplicate members in a supposedly normalized source.

After canonical IDs have been issued, each set array is sorted by unsigned lexicographic comparison of the RFC 8785 UTF-8 serialization of each complete member.
Nested sets are ordered from the inside out before computing the containing member's serialization.
A sequence is never sorted.
Property-chain `members` is the only sequence field in v1; all other arrays in the normative annexes are sets.

RFC 8785 sorts JSON object member names as unsigned UTF-16 code units and leaves array order unchanged.
Canonical VOWL's bytewise member ordering is therefore a profile rule applied before RFC 8785, not a claim about RFC 8785 itself.

`localeCompare()` and implicit locale collation are forbidden in all protocol, identity, canonicalization, fixture, hash, signature, and deterministic diagnostic ordering.

## 18. Canonicalization algorithm

The RDF mapping and ID issuance are protocol rules even though they are private package operations.
RFC 8785 cannot compensate for a difference in either stage.

For a selected profile, a conforming canonicalizer performs these steps in order:

1. **Snapshot and validate the source.**
   Accept only acyclic plain records, dense arrays, JSON primitives, and closed fields.
   Reject accessors, `toJSON`, symbol keys or values, functions, `undefined`, `BigInt`, sparse arrays, non-finite numbers, negative zero, lone surrogates, I-JSON-prohibited noncharacters, dangling references, invalid IRIs, invalid tags, wrong collection kinds, unknown fields, and conflicting records.
   The module does not claim to sandbox a hostile JavaScript `Proxy`.
2. **Normalize scalar forms.**
   Preserve Unicode and IRI spelling; lowercase valid language tags/ranges and require canonical decimal strings where specified.
   Validate the adapter's normalized endpoints, signature closure, and occurrence generation against core contract A5 and annex B; do not silently repair an unnormalized structural graph.
   Do not perform Unicode normalization, IRI percent-decoding, IRI case folding, or general semantic inference.
3. **Build the normative internal RDF dataset.**
   Map every selected profile fact injectively.
   Use repeated predicates for sets and position-bearing structures for sequences.
   Include the immutable profile IRI so labelling is domain-separated.
   Follow the complete field mapping required by section 18.1, including primary record nodes, auxiliary nodes, empty collections, and artifact facts.
   The mapping is an internal algorithm; it does not make the public JSON an RDF serialization.
4. **Run RDFC-1.0.**
   Use the literal algorithm name `RDFC-1.0`, SHA-256 as its fixed internal message digest, reject the deprecated `URDNA2015` alias, pass the caller's abort signal, and apply bounded work controls.
   There is no noncanonical fallback.
5. **Issue profile-local IDs.**
   Apply section 18.2 to the RDFC canonical identifier map and replace every source handle.
6. **Build the closed document.**
   Emit required fields, omit forbidden derived fields, and sort every set by complete-member RFC 8785 bytes.
7. **Validate the result.**
   Recheck the closed schema, reference integrity, uniqueness, set ordering, sequence rules, numeric domain, and profile invariants.
8. **Freeze and return.**
   Deeply freeze the document.
   Encoding is a separate operation over this document.

### 18.1 Normative internal RDF mapping contract

Core contract A6 specifies the complete mapping using the closed field grammar in A2–A4 and annex B.
It uses the proposed vocabulary `https://haddenindustries.com/ontology/vowl/canonical-mapping/v1#`, a fixed named root, the default graph, typed record/collection nodes, and exact recursive field templates.
It must be injective up to source-handle renaming, set permutation, and RDF blank-node isomorphism over the already normalized selected-profile model.
Distinctions explicitly eliminated by VOWL normalization are outside that claim; retained distinctions must be recoverable from the mapped dataset.
The inverse-interpretation argument in A6.4 explains how field predicates, declared types, containers, and references recover the normalized model; independent counterexample fixtures must qualify its implementation.

Every referenceable subject, role, expression, construct, and occurrence maps to exactly one distinct primary RDF blank node, including subjects that also carry a named IRI.
The semantic IRI is a fact about the subject; it does not replace the primary record node used for ID issuance.
Primary nodes carry an unambiguous category discriminator.
Auxiliary nodes for literals, nested values, annotations, collection containers, sequence slots, ontology metadata, or artifact state do not receive public category IDs.
Their facts still participate in whole-profile RDFC labelling.

The mapping closes each of these surfaces; the implementation must supply the corresponding evidence:

| Mapping surface                    | Required normative decisions and evidence                                                                                                                                                                                                                |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dataset framing and vocabulary     | Exact versioned predicate, type, and datatype IRIs; graph placement; root/profile anchoring; primary-node categories; auxiliary-node allocation and sharing rules. The supporting ontology alone is insufficient.                                        |
| Every field and discriminated kind | Its RDF subject, predicate, object, and graph templates; source type; reference target category; required/optional status; and rejection rule for an unsupported case.                                                                                   |
| Scalars                            | Distinct encodings for tokens, strings, semantic IRIs, booleans, decimal cardinality strings, and finite binary64 artifact numbers, with exact datatype and lexical spelling. Preserve literal lexical values and normalized language tags.              |
| Absence and emptiness              | Absent optional fields, present empty objects, empty strings, and empty sets/sequences remain distinguishable where the schema permits them. A collection's presence/type must survive even when it has no membership triples; `null` remains forbidden. |
| Sets                               | Typed membership using repeated predicates, with no encounter-order data; duplicate normalized members are rejected before RDF set semantics could erase them.                                                                                           |
| Sequences                          | Typed containers and position-bearing slots with exact zero-based index encoding; order, length, repeated values, and empty sequences survive the mapping. RDF triple order is not sequence order.                                                       |
| Semantic references                | Subject/role relationships, punning, recursive expression references, construct arguments, generic split anchors, occurrence endpoints, and annotation-assertion anchors remain distinguishable.                                                         |
| Annotations and literals           | Full predicate IRIs, value discriminators, exact lexical/datatype/language content, nested annotation sets, and attachment to the correct pre-aggregation assertion.                                                                                     |
| Profile-specific facts             | Structural topology in both profiles; positions, pins, camera, visibility, prefix bindings, label selection, and display modes in artifact labelling. Excluded provenance and runtime state never enter the dataset.                                     |

For each retained field, a paired fixture must show when changing it changes the dataset and canonical result; source-handle and set-order variants must instead remain isomorphic.
Required pairs include absent versus empty, token versus IRI versus string, literal lexical variants, set versus sequence, repeated sequence entries, annotated aggregate inputs, punned roles, and symmetric occurrences with different placements.

The vocabulary and per-field templates are specified in A6 rather than inferred from JavaScript behavior.
Executable mapping, independently reviewed vectors, and cross-implementation agreement remain freeze requirements.

### 18.2 Category-local ID issuance

The [RDFC-1.0 identifier issuer](https://www.w3.org/TR/rdf-canon/#issue-identifier-algorithm) produces canonical blank-node identifiers with prefix `c14n` and a zero-based counter.
Canonical VOWL applies the following additional rule to the completed identifier map:

1. Locate the primary blank node for each referenceable record using the mapping in section 18.1.
2. Read that node's canonical identifier `c14nN` and interpret `N` as an unsigned decimal integer.
   The N-Quads `_:` marker is syntax, not part of `N`; library-specific map wrappers must not affect interpretation.
3. Partition only primary record nodes into the five categories below.
   Never partition by a producer's ID spelling or by an RDF library's iteration order.
4. Sort each category by increasing numeric `N`, not lexicographically by `c14nN`.
   Compare integers exactly, without floating-point rounding.
5. Assign the category prefix followed by its zero-based rank, in plain decimal without leading zeros.
   Restart the rank at zero for each category and leave no gaps.
6. Replace all references consistently, including occurrence anchors and artifact placements.
   Then order set arrays using section 17, which is a separate rule from ID issuance.

| Primary record category | Public ID prefix |
| ----------------------- | ---------------- |
| subjects                | `s`              |
| roles                   | `r`              |
| expressions             | `x`              |
| constructs              | `c`              |
| occurrences             | `o`              |

For example, roles labelled `c14n2` and `c14n10` receive `r0` and `r1`, even if the map yields `c14n10` first.
Auxiliary nodes may occupy intervening RDFC ordinals but receive no public IDs and create no gaps in category ranks.
An absent label, a multiply assigned primary node, or a conflicting category is an error, not a tie to break using input order.
Under graph symmetry, a source handle's assigned ID is not a durable identity; conformance concerns the complete canonical document after all references are replaced.

Fixtures must cover interleaved categories, empty categories, more than ten RDFC labels, auxiliary nodes, map-order permutations, disconnected and symmetric records, and artifact-induced changes in structural IDs.

## 19. RFC 8785 encoding and exact decoding

`encode` delegates final serialization to a conforming RFC 8785 implementation after Canonical VOWL validation.
It emits UTF-8 without a byte-order mark or trailing newline.

The implementation wraps rather than trusts the serializer's JavaScript coercions.
In particular, Canonical VOWL validation occurs before a library can invoke `toJSON`, omit an unsupported object property, turn an unsupported array element into `null`, collapse a sparse array, or serialize negative zero.

`decode` performs:

1. check the byte-size limit before allocating the decoded text;
2. decode UTF-8 fatally and reject a byte-order mark;
3. tokenize and validate JSON while enforcing nesting, string, and collection limits, rejecting duplicate object member names before either binding can be overwritten;
4. construct the JSON value only from the validated token stream, rejecting lone surrogates, I-JSON-prohibited noncharacters, and values outside the permitted numeric domain;
5. select the exact known profile and validate the closed schema and semantic constraints, including references, duplicate-free sorted sets, sequences, scalar spelling, and profile-specific invariants;
6. reconstruct the selected normalized source using document IDs only as temporary handles, rerun the normative RDF mapping, RDFC labelling, and category-ID rule, and compare the resulting canonical document with the supplied value;
7. RFC 8785 re-encode that verified canonical document and compare the exact bytes with the original input; and
8. return the deeply frozen document only after every check succeeds.

The lexical stage maintains a member-name set for each object.
It compares decoded names after JSON escape processing, with no case folding or Unicode normalization: `"profile"` and `"\u0070rofile"` are duplicates in the same object.
The same name in different objects is allowed.
Both equal-valued and conflicting duplicates fail with `JSON_DUPLICATE_MEMBER`, including duplicates inside nested annotations or artifact state.
A tokenizing parser may combine lexical validation and safe construction, but ordinary `JSON.parse` followed by a reviver or schema validation is not a duplicate detector.
This enforces the duplicate-name input restriction in [RFC 8785 section 3.1](https://www.rfc-editor.org/rfc/rfc8785.html#section-3.1) before information is lost.

Strict byte comparison would also reject duplicate-containing source text after an ordinary parser collapsed it, but only as a generic serialization mismatch.
It does not supply the required duplicate-specific validation and error location.
Conversely, duplicate-safe parsing and JCS serialization alone do not prove that a document uses the required graph IDs: the semantic reconstruction check is necessary even for already compact, correctly key-sorted JSON.

Semantic validation rejects incorrectly ordered sets; RFC 8785 itself never sorts arrays.
The final byte comparison rejects noncanonical whitespace, object-key order, number spellings, escaping, or trailing bytes.
Reconstruction is a verification step, not a repair path: a mismatch fails with `NON_CANONICAL_BYTES` and never returns a corrected value.

## 20. Error and resource model

All public operations fail closed with one package error class containing:

- a stable machine code;
- a human message;
- an optional JSON Pointer into the source or document;
- safe structured details; and
- an optional cause.

Content validation follows the stage order in sections 18 and 19; lexical errors use input token order, and object-field checks use unsigned UTF-16 name order rather than a dependency's traversal order.
Core contract A7 fixes precedence within each stage, the complete error catalogue, and safe dependency-error translation.
Abort and resource-exhaustion outcomes depend on the caller's limits and execution, not solely on input content.
HTTP Problem Details is not used by the in-process interface; an HTTP adapter may map package errors separately.

The stable error catalogue includes:

| Code                          | Boundary                                                                                          |
| ----------------------------- | ------------------------------------------------------------------------------------------------- |
| `JSON_INVALID_UTF8`           | Input bytes cannot be decoded as valid UTF-8.                                                     |
| `JSON_DUPLICATE_MEMBER`       | A decoded member name repeats in the same JSON object.                                            |
| `DOCUMENT_UNKNOWN_FIELD`      | A schema-disallowed member is present.                                                            |
| `SOURCE_DUPLICATE_SET_MEMBER` | The normalized source contains duplicate set members.                                             |
| `REFERENCE_DANGLING`          | A required reference has no target.                                                               |
| `IRI_INVALID`                 | A semantic IRI fails the specified absolute-IRI rules.                                            |
| `LANGUAGE_TAG_INVALID`        | A language tag fails the specified well-formedness rules.                                         |
| `RDFC_RESOURCE_LIMIT`         | Graph labelling exceeds its work budget.                                                          |
| `NON_CANONICAL_BYTES`         | Otherwise interpretable input differs from the required canonical document or byte serialization. |

The full catalogue in A7 additionally defines syntax, profile, scalar-domain, admission, other resource-limit, and cancellation failures; A9 defines adapter and migration codes.
Messages and safe causes may provide context, but consumers depend on package codes and locations, not Ajv, RDFC, JCS, or runtime-specific error text.
Locations use JSON Pointers where a value exists; lexical failures may additionally report a byte offset without echoing unbounded input.

Canonicalization is asynchronous because graph canonicalization must support cooperative aborts.
Core contract A8 fixes finite defaults and upper override bounds for source bytes, record count, nesting depth, string size, internal quad count, and RDFC work.
It exposes bounded caller overrides and `AbortSignal` without placing operational limits in canonical bytes.

RDFC work exhaustion or abort is an error, never authority to preserve input IDs, switch algorithms, emit partial data, or continue without graph canonicalization.
This follows RDFC-1.0's requirement to defend against pathological datasets.

Every limit has a unit, finite default, allowed override range, enforcement point, and stable error in A7–A8.
Qualification must cover input bytes, primary and auxiliary record growth, JSON and annotation nesting, per-string and aggregate string storage, internal quads, and graph-labelling work; limits must apply during construction rather than only after the oversized representation exists.
The implementation must use A8's explicit `maxDeepIterations` ceiling and combined cancellation/deadline policy and prove cancellation at expensive stages, including `decode`'s graph verification.
Operational limits may affect success versus bounded failure but may never select different successful bytes.

Browser integration must run CPU-intensive canonicalization and graph-verifying decoding in a worker, away from the rendering event loop.
An `async` function on the main thread is not sufficient isolation.
The worker boundary must preserve cancellation and error codes, reject stale results, and enforce the termination and deadline behavior in A8.
The worker encodes its validated document before transferring bytes; a document cloned for rendering does not carry the module-local validation admission required by `encode`.
Worker placement and runtime limits remain implementation concerns outside canonical bytes and do not expand the three-operation core interface.

Before browser cutover, benchmark ordinary, large, highly symmetric, disconnected, deeply nested, and deliberately pathological inputs.
Record the runtime/browser and hardware, source and internal-quad sizes, elapsed time, peak memory, main-thread responsiveness, cancellation latency, and limit reached.
Use those results to confirm or revise the proposed operational defaults and establish application acceptance thresholds; neither performance nor responsiveness is established by the present design review.

## 21. OWL mapping profiles

### 21.1 Shared requirements

Both OWL mapping profiles:

- require well-formed source syntax;
- use owlapi's structural model and resolved closure;
- construct the same normalized Canonical VOWL source model;
- preserve full IRIs and literal lexical forms;
- apply no reasoner;
- return deterministic diagnostics outside canonical bytes; and
- call the one root canonicalizer.

Malformed XML, Turtle, JSON-LD, Functional Syntax, Manchester Syntax, or other grammar is not repaired by compatibility mapping.
A separately specified preprocessing migration is required if malformed bytes must be recovered.

### 21.2 Strict mapping

Strict mapping performs an OWL 2 DL structural conformance check over the complete resolved closure before applying the v1 retention boundary.
This includes reserved vocabulary, category separation, and global restrictions; it is not a consistency or entailment check.
Missing validation capability in `owlapi` is implementation work, not permission to call a partial check strict.
Strict mapping rejects:

- unresolved imports;
- OWL 2 DL category conflicts and global-restriction violations;
- unconsumed or ambiguous source structures;
- invalid datatype lexical forms; and
- unsupported constructs that would otherwise require approximation.

Known, well-formed ABox exclusions in section 13 are diagnosed after structural checking; they are intentional projection exclusions, not parsing failures.
Core contract A9 fixes unsupported datatype/extension behavior and the exact diagnostic catalogue.

### 21.3 Compatibility mapping

Compatibility mapping is the default because VOWL's purpose is usable visualization of real ontologies.
It applies only the closed, versioned recovery catalogue in core contract A9 after successful syntax parsing.

It may retain multiple semantic roles for one subject, preserve successfully resolved closure content when imports are missing, and retain a syntactically valid ill-typed literal.
Every recovery is diagnosed.
It may not discard, fabricate, or guess canonical content silently.
RDFS-only roles, unverifiable datatype values, and unambiguous global-restriction violations have explicit diagnostics; malformed lists, cyclic expressions, unknown constructors, and ambiguous category assignment fail.

## 22. Dependencies and cryptographic separation

The package reuses maintained standards implementations rather than reimplementing them:

- `canonicalize` for RFC 8785 serialization; and
- `rdf-canonize` for RDFC-1.0.

Both become direct runtime dependencies of `packages/vowl`; the package must not rely on the copies currently present only as transitive dependencies of `owlapi`/`jsonld`.
The current installed versions are `canonicalize@2.1.0` (Apache-2.0) and `rdf-canonize@5.0.0` (BSD-3-Clause), both compatible with the package's `AGPL-3.0-only` distribution.

The format pins the algorithms and options, not one implementation build.
Repository and consumer lockfiles record concrete dependency versions in the ordinary way, while conformance vectors prevent a dependency update from silently changing canonical bytes.

Canonical VOWL exposes bytes; it does not implement a digest or signature scheme.
A digest or detached signature algorithm is selected by the consuming security protocol.
The canonical profile IRI inside the bytes supplies format domain separation, while algorithm IDs, keys, proofs, timestamps, and verification policy remain in that protocol's envelope.

Until a media type is registered, Canonical VOWL uses `application/json`, a `.vowl.json` filename convention, and its in-document profile IRI.
The project does not invent an unregistered `application/vowl+json` media type.

## 23. Schemas and specification artifacts

### 23.1 Closed schemas and semantic validation

Each profile publishes:

- a closed JSON Schema 2020-12 document;
- normative prose for invariants JSON Schema cannot express;
- the normative source-to-internal-RDF mapping;
- the category-ID issuance rule and exhaustive VOWL projection matrix;
- positive and negative fixtures;
- exact canonical UTF-8 outputs;
- informative SHA-256 digests of those outputs; and
- a conformance manifest.

`$schema` and `$id` belong in schema documents, not Canonical VOWL instances.
The supporting ontology describes vocabulary identity and relationships; it does not validate JSON or replace algorithm prose.

Core contract A1–A4 and annex B1/B3 enumerate every object branch, allowed discriminant, field type, required/optional status, and set/sequence classification.
The executable schemas translate these tables; creating them does not authorize new wire fields or inferred defaults.
Use `additionalProperties: false` for self-contained object definitions and, where composition requires it, `unevaluatedProperties: false` at the boundary that must be closed.
Qualify the selected validator against the [JSON Schema 2020-12 evaluation rules](https://json-schema.org/draft/2020-12/json-schema-core#section-11.3), including unknown fields behind `$ref`, `oneOf`, and other composed branches.
Validation must not coerce values, insert defaults, or strip unknown properties to make an invalid document pass.

The semantic invariant catalogue in core contract A2–A7 and annex B supplements schema shape checks with reference integrity and target category, role uniqueness, duplicate members by normalized identity, set order, sequence rules, annotation attachment, canonical IDs, numeric domains, and occurrence/placement completeness.
Absolute-IRI and language-tag/range rules require explicit validators and fixtures; implementation-specific JSON Schema `format` defaults are not normative validation.
Passing a schema alone is not Canonical VOWL conformance.

### 23.2 Conformance bundle and manifest

The language-neutral manifest identifies the profile and specification revision and references the exact schemas, RDF mapping vocabulary/templates, ID rule, projection matrix, and semantic invariant catalogue.
It records `RDFC-1.0` with internal SHA-256 and RFC 8785 separately and names the positive, negative, metamorphic, and exact-byte vector collections.
Each vector includes its source or input bytes, selected profile, expected document or stable error, and exact canonical UTF-8 output where applicable.
Mapping vectors also provide expected internal datasets and canonical N-Quads, with primary-node/category correspondence sufficient to independently check ID issuance.
Identifier-map expectations for a fixed labelled fixture must not be confused with durable correspondence between symmetric source handles under permutation.

The manifest and optional output digests are external conformance artifacts, never instance fields.
Publication must preserve immutable bundle references as required by section 6.1; a mutable link to the latest implementation is not a conformance oracle.

## 24. Conformance strategy

The package tests through its public interfaces.
Internal RDF and serializer tests supplement but never replace interface tests.

Required evidence includes:

1. RFC 8785 official examples and number/string/key-order vectors;
2. the W3C RDFC-1.0 test suite and canonical identifier-map checks;
3. Canonical VOWL positive fixtures with exact UTF-8 byte expectations;
4. negative fixtures for unknown fields, duplicate JSON names (including escaped-equivalent names and nested equal-valued duplicates), duplicate set members, invalid UTF-8, lone surrogates, prohibited Unicode noncharacters, negative zero, non-finite numbers, unsafe JavaScript values, sparse arrays, dangling references, invalid IRIs, invalid language tags/ranges, sequence/set confusion, valid-looking but noncanonical graph IDs, and resource exhaustion;
5. metamorphic permutations of object insertion order, set order, source handles, blank-node labels, OWL axiom order, import traversal order, prefix declarations, and supported source syntaxes;
6. locale and runtime matrices demonstrating independence from default locale, ICU data, timezone, Node version, and browser engine;
7. structural-versus-artifact profile fixtures;
8. strict-versus-compatibility mapping fixtures;
9. migration fixtures for every named legacy dialect and every irrecoverable ambiguity;
10. poison-graph tests proving bounded failure without fallback output;
11. mapping distinction and category-ID vectors from sections 18.1 and 18.2, including auxiliary nodes, numeric ordinal ordering, and symmetric artifact placements;
12. exhaustive projection-matrix coverage proving that details-only retained constructs survive without invented glyphs and that visual cases satisfy their exact topology rules;
13. schema-composition negatives and semantic negatives that pass JSON Schema but violate graph invariants; and
14. browser worker, cancellation, and performance qualification at the application integration boundary.

The language-neutral conformance corpus is a separate oracle from the JavaScript implementation.
Passing the implementation's own tests alone is not a cross-producer conformance claim.
Before freeze, independently derive and review the expected datasets, IDs, ordering, and bytes, and reproduce the exact-byte corpus with a separately implemented producer/canonicalization pipeline.
A wrapper around the same Canonical VOWL mapper is not independent evidence; reusing standards-compliant RDFC and JCS libraries is permitted.
Record producer versions, source revisions, runtime/locale, and divergences in the conformance report.
Golden files generated solely by the implementation under test cannot satisfy this gate.

Property chains must include order reversals and repeated members; sets must include permutations and duplicate rejection.
The corpus must also exercise cross-ontology anonymous-individual standardization, punning, annotated domain aggregation, absent versus empty values, exact lexical literals, missing-import policy, and cross-profile ID differences.
Artifact tests compare portable state and canonical bytes, not CSS- or font-dependent pixel identity.

## 25. Current exporter and `localeCompare()` audit

### 25.1 Historical limitations

The original design's inspection recorded that two historical exporter limitations were no longer present in the inspected `serializeVowlJson` path:

- the source model is cloned with `structuredClone` before collection sorting, including `namespace`; and
- exporter ordering uses locale-independent relational comparison rather than `localeCompare()`.

The original design recorded passing focused artifact-service checks for representative deterministic ordering and source non-mutation; those checks were not rerun for this documentation revision.
This remains a repeatable legacy export, not Canonical VOWL: it pretty-prints JSON, preserves producer IDs, knows only selected set fields, lacks whole-graph labelling, and does not enforce the closed I-JSON/RFC 8785 domain.

The original design also recorded a passing builder ordering suite.
Its comments call JavaScript relational string comparison "code-point" order, which is inaccurate for supplementary Unicode characters: JavaScript compares UTF-16 code units.
The implementation name and documentation should say exactly which order it uses.

### 25.2 Remaining call sites

The inspection recorded for the original 24 September design found seven `localeCompare()` uses:

1. `src/app/js/sidebar.js` — language-tag option ordering;
2. `src/app/js/controller/ontologyInspector.js` — identity tie-break used by stable search ranking and pagination;
3. two sites in `src/productionModuleFormat.architecture.test.js` — module and diagnostic identity ordering;
4. `src/app/js/controller/ontologySourceLoader.test.js` — format-case ordering;
5. `src/app/js/controller/svgSerializer.test.js` — fake DOM attribute ordering;
6. `src/owl2vowl/js/vowlBuilder.ordering.test.js` — intentional locale-versus- binary regression guard.

The final use is legitimate test evidence and remains.
The other six use locale collation for identifiers or deterministic test material and should use an accurately named unsigned UTF-16 code-unit comparator.
The inspector use is the most consequential because it can affect stable page boundaries.
The sidebar values are language tags, not localized display names, so linguistic collation adds variability without improving the interface.

Human-language label sorting is a separate concern.
Where deliberately needed, it must use `Intl.Collator` with an explicit locale and options and must never feed an identity, protocol, digest, fixture, or pagination contract.

The Canonical VOWL core uses neither of those string orders for set members; it uses complete-member RFC 8785 UTF-8 bytes as specified in section 17.
Recheck these call sites before an implementation task changes them.
Their retirement is a separate deterministic-application-ordering slice; the core-package work does not silently expand into inspector, sidebar, or fixture changes owned elsewhere.

## 26. Migration consequences

Removing the parallel arrays is an intentional format break.
Current WebVOWL parsing, editing, inspection, export, tests, and fixtures will eventually need to consume the new occurrence model.
That consumer migration is outside the first core-package slice and must not begin while another task owns those user-facing files.

The historical migration adapter must:

- join legacy record/attribute pairs exactly once;
- reject duplicate IDs, missing partners, dangling references, and conflicting fields;
- discard traversal IDs after resolving references;
- reconstruct canonical split contexts and correlate legacy state only where occurrence correspondence is unambiguous;
- recover full annotation predicates only where the dialect contains enough information;
- reject or require explicit mappings for irreversibly collapsed local-name annotations;
- require viewport information when legacy camera translation cannot otherwise be converted to center/zoom; and
- report every dropped noncanonical session field.

Migration complexity remains at the ingress seam.
It does not weaken the core schema or create a legacy output branch.
Core contract A9 fixes the initial dialect target to the reviewed repository export at commit `354ed3af8c1e82019f6280b2594acaceac96cca0`, the resolution/error policy, and the complete-state requirement for artifact migration.
Inventorying that fixed ingress format and implementing its mapping are later adapter tasks; accepting additional dialects requires separate named contracts.

Delivery proceeds in independently reviewable slices:

1. **Canonical core:** normalized source, complete mapping, ID rule, schemas and semantic validator, set ordering, encoding, duplicate-safe exact decoding, and an independent conformance corpus.
   Hand-authored fixtures establish behavior without using the application exporter as the oracle.
2. **OWL adapter:** move `VOWLBuilder` to producing the normalized source and calling the core, preserving the `owlapi` parser/import boundary and proving both mapping profiles.
3. **Historical ingress:** implement each named dialect and prove loss/ambiguity diagnostics, explicit resolutions, split occurrence recovery, and camera migration.
4. **Application cutover:** migrate inspection, editing, rendering, and export to the semantic records and occurrence projection, with worker, accessibility, and artifact-state qualification.
   The renderer remains a projection as required by [ADR 0010](../adr/0010-rendered-graph-is-a-projection-not-the-store.md).
5. **Legacy export retirement:** retire the historical internal interchange and export path only after all consumers have migrated.
   Existing files remain supported through named ingress migrations; no second canonical mode or hidden fallback is introduced.

The optional RDF/JSON-LD companion and unrelated deterministic-ordering repairs can be planned separately.
The assessment's effort estimates are planning context, not delivery commitments or evidence that any slice is complete.

## 27. Planning readiness, implementation boundary, and freeze gates

The design is ready to translate into an implementation plan.
Its field vocabulary, normalization, RDF templates, category-ID rule, decoder/error behavior, projection, display state, operational limits, and adapter policies are specified here and in the normative annexes.
The [decision record](2026-09-24-canonical-vowl-design-decisions.md) records the researched alternatives and has no unresolved design question requiring user advice.
This is design readiness, not a claim of implementation, interoperability, measured performance, or release acceptance.

The plan should translate each normative rule into bounded work and acceptance evidence, preserving the dependencies and ownership boundaries below.
Executable schemas, golden-byte fixtures, an independent producer, and benchmarks are outputs of that work; requiring them before writing a plan would conflate design with implementation.

The first implementation slice is package-local and does not modify WebVOWL's current parser, renderer, menus, export behavior, or other user-facing source.
It consists of the source model, complete internal mapping and ID issuance, closed schemas and semantic validator, canonicalizer, duplicate-safe exact decoder, fixtures, and conformance tests.
The OWL and migration adapters follow through the same root interface.

### 27.1 v1 interoperability freeze

The architecture is retained, but the following evidence is required before structural-content or artifact v1 is frozen or published as an interoperability contract:

| Gate                                                  | Required result                                                                                                                                                                                                | Status after this design revision                                                                                             |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| P0: complete internal RDF mapping                     | Exact vocabulary and per-field templates for both profiles, primary/auxiliary-node rules, inverse-interpretation argument, and distinction fixtures.                                                           | Normative mapping complete in core contract A6; executable mapping and distinction fixtures remain outstanding.               |
| P0: category-local ID rule                            | Numeric RDFC ordinal partitioning and issuance, verified with interleaved categories, auxiliaries, symmetry, and more than ten labels.                                                                         | Algorithm specified in section 18.2; implementation and vectors remain outstanding.                                           |
| P0: duplicate-safe exact decoding                     | Lexical duplicate rejection, bounded parsing, canonical graph verification, and exact-byte comparison with stable errors.                                                                                      | Algorithm corrected in section 19; implementation and negative tests remain outstanding.                                      |
| P0: closed schemas and semantic validator             | Complete 2020-12 schemas, explicit IRI/tag validators, composed-object closure, and all graph invariants.                                                                                                      | Closed grammar and invariants complete in the annexes; executable schemas and validator remain outstanding.                   |
| P0: independent exact-byte corpus                     | Separately derived expected datasets/IDs/bytes and agreement from an independent Canonical VOWL implementation.                                                                                                | Acceptance evidence specified in section 24; corpus and independent results remain outstanding.                               |
| P1 promoted to freeze prerequisite: projection matrix | Every retained kind and conditional topology rule enumerated; exact externality, label-fallback, and display-mode behavior fixed; standard VOWL notation distinguished from details-only facts and extensions. | Normative matrix, topology, and display rules complete in annex B; machine-readable artifact and fixtures remain outstanding. |

Writing these requirements does not close their gates.
Package extraction and successful existing WebVOWL tests alone cannot establish canonical interoperability.
Approval of this revised design permits only the separately authorized next phase; freeze requires review of the completed artifacts and recorded conformance evidence.

### 27.2 Integration and publication gates

Browser cutover additionally requires worker isolation, measured finite limits, cancellation and poison-graph qualification, portable snapshot restoration, and application accessibility evidence.
Adapter delivery requires strict/compatibility fixtures and every supported legacy dialect's migration/ambiguity evidence.
Stable publication requires the immutable profile-resolution bundle in sections 6 and 23.
The optional RDF/JSON-LD companion is deferred and does not block v1; it must not expand canonical identity.

### 27.3 Configuration and delivery authority

Implementation requires later, explicit approval for these configuration changes:

- create `packages/vowl/package.json` with `AGPL-3.0-only`, the three export surfaces, and direct runtime dependencies;
- add the workspace entry and package test commands to the root `package.json`;
- update `package-lock.json`; and
- make only the minimum Jest, lint, formatting, or build configuration changes that prove necessary after the package-local tests exist.

No such configuration change is authorized by this design document.
No commit, push, publication, media-type registration, or user-facing cutover is implied.

## 28. Review synthesis and design closure

The assessment supports retaining these architectural decisions:

- direct class membership is the v1 ABox boundary;
- annotations remain on exact assertions even when visual structure is normalized;
- artifact state records the effective portable scene rather than WebVOWL controls or engine internals;
- artifact-only facts participate in artifact-profile graph labelling;
- the root interface is `canonicalize`/`encode`/`decode` rather than a public pipeline of validators, RDF mappers, comparators, and serializers;
- SHA-256 is fixed only for RDFC-1.0's internal labelling operation;
- application digests and signatures remain external;
- schemas are closed and versioned, while the profile prose remains normative for semantic constraints; and
- unsafe or computationally pathological input fails rather than producing an alternative byte form.

The review is incorporated as follows:

| Review recommendation                                | Design disposition                                                                                                                                                |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Complete normative RDF mapping                       | Resolved by core contract A6's exact vocabulary/templates and recovery argument; implementation evidence remains a freeze gate.                                   |
| Exact RDFC-to-category ID issuance                   | Resolved in prose by section 18.2; vectors and implementation remain required.                                                                                    |
| Detect duplicate names before object materialization | Accepted in sections 7 and 19, including escaped-name equality and stable errors. Byte comparison remains a final canonicality check, not the duplicate detector. |
| Closed schemas plus semantic validation              | Strengthened in section 23; schema closure, explicit format validators, and graph checks have separate responsibilities.                                          |
| Independent conformance vectors                      | Strengthened in section 24 and made a freeze gate.                                                                                                                |
| Normative visual/details-only/extension matrix       | Resolved in annex B, including all conditional topology, label, externality, and display rules; machine-readable coverage is required before freeze.              |
| Core extraction and one-way migration                | Retained and staged in sections 7, 26, and 27, with later consumer cutover and legacy retirement.                                                                 |
| Worker isolation and pathological-graph benchmarks   | Required for browser integration by section 20; asynchronous syntax is not responsiveness evidence.                                                               |
| Resolvable immutable profile metadata                | Required before publication by sections 6 and 23.                                                                                                                 |
| RDF/JSON-LD companion and optional SHACL             | Deferred as additive, informative interoperability work in section 7.5.                                                                                           |
| Accessibility qualification                          | Assigned to application cutover in sections 14.4 and 27.2 without duplicating DOM or ARIA state.                                                                  |
| BCP 47 lowercasing clarification                     | Resolved in section 11.5 as spelling normalization only.                                                                                                          |
| Remaining deterministic `localeCompare()` uses       | Retained as a separately scoped follow-up in section 25.                                                                                                          |

The ordered research and resulting detailed decisions are recorded in the companion decision record.
The proposal is complete enough for implementation planning; executable artifacts and measured qualification remain future work under the gates above.
Review of this proposal, implementation planning, v1 freeze, configuration approval, application cutover, and publication are distinct milestones.
