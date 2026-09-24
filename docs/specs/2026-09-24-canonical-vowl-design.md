# Canonical VOWL design

> **Status:** Proposed for written review
>
> **Decision date:** 24 September 2026
>
> **Repository:** `Hadden-Industries/webvowl`
>
> **Decision owner:** Maksym Shostak
>
> **Implementation location:** `packages/vowl`
> **License:** `AGPL-3.0-only`

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

1. the Canonical VOWL profile and its closed schema for VOWL-specific meaning;
2. the [VOWL 2 specification](../owlapi-js/conformance/upstream/vowl-2/index.html) for visual mapping where this profile has not deliberately tightened or extended it;
3. the [OWL 2 Structural Specification](https://www.w3.org/TR/owl-syntax/) for OWL structures, sets, sequences, annotations, imports, and anonymous individuals;
4. [RDFC-1.0](https://www.w3.org/TR/rdf-canon/) for canonical labelling of the profile's normative internal RDF dataset;
5. [RFC 8785](https://www.rfc-editor.org/rfc/rfc8785.html) for final JSON serialization; and
6. [RFC 7493](https://www.rfc-editor.org/rfc/rfc7493.html) for the I-JSON input restrictions used by RFC 8785.

Where historical OWL2VOWL JSON, the current builder, or a Java OWL2VOWL result conflicts with this design, the historical shape is migration input rather than normative Canonical VOWL.

## 6. Identifiers, profiles, and versioning

### 6.1 Canonical profiles

The two canonical profile identifiers are:

```text
https://haddenindustries.com/ontology/profiles/vowl/canonical/structural-content/v1
https://haddenindustries.com/ontology/profiles/vowl/canonical/artifact/v1
```

The structural-content profile binds the normalized VOWL structure and visual topology.
The artifact profile binds the same semantic source plus portable static visualization state.

A change that can alter conforming bytes for an unchanged input requires a new profile identifier.
Clarifications and errata that provably do not change bytes may revise the prose and conformance suite without minting a new profile.

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

`decode` accepts only exact canonical bytes.
It performs fatal UTF-8 decoding, JSON parsing, closed-schema and semantic validation, re-encoding, and byte-for-byte comparison before returning a deeply frozen document.

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

Migration is one way:

```text
named legacy dialect -> normalized source -> Canonical VOWL
```

There is no Canonical VOWL-to-legacy output and no runtime fallback.
A migration that cannot recover a required distinction must fail or require an explicit caller-supplied resolution; it must not invent an annotation IRI, ontology identity, viewport, or semantic category.

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
2. **roles** — a subject's semantic role, such as class, datatype, object-property, data-property, annotation-property, individual, or a genuinely generic RDF property in compatibility mapping;
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

## 9. Canonical document envelope

The structural-content envelope is:

```json
{
  "profile": "https://haddenindustries.com/ontology/profiles/vowl/canonical/structural-content/v1",
  "structural": {
    "ontology": {},
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
    "ontology": {},
    "subjects": [],
    "roles": [],
    "expressions": [],
    "constructs": [],
    "occurrences": []
  },
  "visualization": {}
}
```

All top-level collections are required, including when empty.
Optional fields are permitted only where absence has a defined meaning.
`null` is not an alternative spelling for absence or an empty collection.

Instances contain no `@context`, `$schema`, producer comment, source URL, diagnostics, provenance, or internal digest.
The profile IRI selects the schema and algorithms.

## 10. Root ontology and imports

The `ontology` record binds:

- optional root ontology IRI;
- optional version IRI, legal only when the ontology IRI is present;
- the root ontology's authored direct import declarations; and
- the root ontology's own ontology annotations.

It does not bind document aliases, resolver mappings, closure traversal order, resolved-edge topology, source document IRIs, imported ontology IDs, or imported ontology annotations.

The OWL adapter receives the root ontology and manager-resolved closure rather than serializing and reparsing an `OWLOntologyMerger` result.
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
Only exact structural duplicates are deduplicated by adapters.

An omitted object filler normalizes to explicit `owl:Thing`; an omitted data filler normalizes to explicit `rdfs:Literal`.
Missing property domains or ranges use VOWL's generic endpoint.
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
- axiom annotations on every retained construct; and
- annotations on annotations recursively.

Annotations must remain attached to the exact assertion they annotate.
This creates one special rule for VOWL normalization that combines source axioms.
When several source assertions normalize to one VOWL construct, the construct contains the normalized visual meaning once, while a separate annotation anchor is retained for each annotated pre-normalization assertion.
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

Occurrences represent the VOWL projection without copying semantic fields.

- A node occurrence references one role or expression.
- An edge occurrence references one retained construct and its endpoint occurrences.
- A movable label occurrence references its edge occurrence.
- Occurrence-specific projection kind and split context are closed fields.
- Labels, annotations, characteristics, IRIs, and expression operands remain on the semantic records they belong to.

The normative projection applies VOWL's splitting rules, including one generic datatype or `rdfs:Literal` occurrence per attached property and one generic `owl:Thing` or `rdfs:Resource` occurrence per linked class.
Each split occurrence records the semantic anchor that distinguishes it.
Equivalent elements use one visual occurrence as required by the VOWL mapping.

Constructs for which v1 has no graph glyph may remain details-only and have no occurrence.
Their absence from the drawing does not remove them from structural identity.

Externality is a derived presentation classification, not provenance.
It uses the root ontology IRI, the complete subject IRI, a profile-defined base-IRI comparison, and a closed set of built-in exemptions.
If the root ontology is anonymous, no subject is classified as external.
Imported-ontology membership is not an externality test.

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

The label-selection value is a closed discriminated mode for full IRI, untagged label, or a lowercased BCP 47 language range.
Candidate selection and fallback are normative and locale independent.
Multiple candidates at the same precedence are resolved by canonical UTF-8 byte order, never collation.

The prefix map contains effective display bindings only.
Structural data uses full IRIs.
Raw prefixes from Turtle, RDF/XML, Functional Syntax, or JSON-LD do not survive merely because they occurred in a source document.

## 16. No derived duplication

A Canonical VOWL document must not contain a value wholly and normatively derivable from its other canonical fields.

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
A sequence is never sorted.
Property chains are the principal ordered example.

RFC 8785 sorts JSON object member names as unsigned UTF-16 code units and leaves array order unchanged.
Canonical VOWL's bytewise member ordering is therefore a profile rule applied before RFC 8785, not a claim about RFC 8785 itself.

`localeCompare()` and implicit locale collation are forbidden in all protocol, identity, canonicalization, fixture, hash, signature, and deterministic diagnostic ordering.

## 18. Canonicalization algorithm

For a selected profile, a conforming canonicalizer performs these steps in order:

1. **Snapshot and validate the source.**
   Accept only acyclic plain records, dense arrays, JSON primitives, and closed fields.
   Reject accessors, `toJSON`, symbol keys or values, functions, `undefined`, `BigInt`, sparse arrays, non-finite numbers, negative zero, lone surrogates, dangling references, invalid IRIs, invalid tags, wrong collection kinds, unknown fields, and conflicting records.
   The module does not claim to sandbox a hostile JavaScript `Proxy`.
2. **Normalize scalar forms.**
   Preserve Unicode and IRI spelling; lowercase valid language tags; use canonical decimal strings where specified; and apply the profile's explicit endpoint and display rules.
   Do not perform Unicode normalization, IRI percent-decoding, IRI case folding, or general semantic inference.
3. **Build the normative internal RDF dataset.**
   Map every selected profile fact injectively.
   Use repeated predicates for sets and position-bearing structures for sequences.
   Include the immutable profile IRI so labelling is domain-separated.
   The mapping is an internal algorithm; it does not make the public JSON an RDF serialization.
4. **Run RDFC-1.0.**
   Use the literal algorithm name `RDFC-1.0`, SHA-256 as its fixed internal message digest, reject the deprecated `URDNA2015` alias, pass the caller's abort signal, and apply bounded work controls.
   There is no noncanonical fallback.
5. **Issue profile-local IDs.**
   Translate the RDFC canonical identifier map to the profile's category IDs and replace every source handle.
6. **Build the closed document.**
   Emit required fields, omit forbidden derived fields, and sort every set by complete-member RFC 8785 bytes.
7. **Validate the result.**
   Recheck the closed schema, reference integrity, uniqueness, set ordering, sequence rules, numeric domain, and profile invariants.
8. **Freeze and return.**
   Deeply freeze the document.
   Encoding is a separate operation over this document.

The internal RDF mapping must be injective over all distinctions retained by the source model.
It must distinguish absent optional values, scalar types, tokens, IRIs, literals, sets, sequences, empty collections, and sequence positions.
Mapping tests must prove those distinctions before the mapping can be normative.

## 19. RFC 8785 encoding and exact decoding

`encode` delegates final serialization to a conforming RFC 8785 implementation after Canonical VOWL validation.
It emits UTF-8 without a byte-order mark or trailing newline.

The implementation wraps rather than trusts the serializer's JavaScript coercions.
In particular, Canonical VOWL validation occurs before a library can invoke `toJSON`, omit an unsupported object property, turn an unsupported array element into `null`, collapse a sparse array, or serialize negative zero.

`decode` performs:

1. resource-limit check;
2. fatal UTF-8 decode;
3. JSON parse;
4. canonical-document validation, including lone-surrogate rejection;
5. RFC 8785 re-encoding; and
6. constant-result byte comparison with the supplied bytes.

Re-encoding catches whitespace, key-order, number-spelling, escaping, set-order, and duplicate-object-name differences.
An input that parses to a valid model but is not already the exact canonical byte sequence is rejected; `decode` never repairs it.

## 20. Error and resource model

All public operations fail closed with one package error class containing:

- a stable machine code;
- a human message;
- an optional JSON Pointer into the source or document;
- safe structured details; and
- an optional cause.

Validation order is specified so the first reported error is deterministic for the same invalid value.
HTTP Problem Details is not used by the in-process interface; an HTTP adapter may map package errors separately.

Canonicalization is asynchronous because graph canonicalization must support cooperative aborts.
The implementation provides safe finite defaults for source bytes, record count, nesting depth, string size, internal quad count, and RDFC work.
It exposes bounded caller overrides and `AbortSignal` without placing operational limits in canonical bytes.

RDFC work exhaustion or abort is an error, never authority to preserve input IDs, switch algorithms, emit partial data, or continue without graph canonicalization.
This follows RDFC-1.0's requirement to defend against pathological datasets.

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

Strict mapping rejects:

- unresolved imports;
- OWL 2 DL category conflicts and global-restriction violations relevant to retained constructs;
- unconsumed or ambiguous source structures;
- invalid datatype lexical forms; and
- unsupported constructs that would otherwise require approximation.

### 21.3 Compatibility mapping

Compatibility mapping is the default because VOWL's purpose is usable visualization of real ontologies.
It applies only a closed, versioned recovery catalogue after successful syntax parsing.

It may retain multiple semantic roles for one subject, preserve successfully resolved closure content when imports are missing, and retain a syntactically valid ill-typed literal.
Every recovery is diagnosed.
It may not discard, fabricate, or guess canonical content silently.

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

Each profile publishes:

- a closed JSON Schema 2020-12 document;
- normative prose for invariants JSON Schema cannot express;
- the normative source-to-internal-RDF mapping;
- positive and negative fixtures;
- exact canonical UTF-8 outputs;
- informative SHA-256 digests of those outputs; and
- a conformance manifest.

`$schema` and `$id` belong in schema documents, not Canonical VOWL instances.
The supporting ontology describes vocabulary identity and relationships; it does not validate JSON or replace algorithm prose.

## 24. Conformance strategy

The package tests through its public interfaces.
Internal RDF and serializer tests supplement but never replace interface tests.

Required evidence includes:

1. RFC 8785 official examples and number/string/key-order vectors;
2. the W3C RDFC-1.0 test suite and canonical identifier-map checks;
3. Canonical VOWL positive fixtures with exact UTF-8 byte expectations;
4. negative fixtures for unknown fields, duplicate JSON names, duplicate set members, invalid UTF-8, lone surrogates, negative zero, non-finite numbers, unsafe JavaScript values, sparse arrays, dangling references, invalid IRIs, invalid language tags, sequence/set confusion, and resource exhaustion;
5. metamorphic permutations of object insertion order, set order, source handles, blank-node labels, OWL axiom order, import traversal order, prefix declarations, and supported source syntaxes;
6. locale and runtime matrices demonstrating independence from default locale, ICU data, timezone, Node version, and browser engine;
7. structural-versus-artifact profile fixtures;
8. strict-versus-compatibility mapping fixtures;
9. migration fixtures for every named legacy dialect and every irrecoverable ambiguity; and
10. poison-graph tests proving bounded failure without fallback output.

The language-neutral conformance corpus is a separate oracle from the JavaScript implementation.
Passing the implementation's own tests alone is not a cross-producer conformance claim.

## 25. Current exporter and `localeCompare()` audit

### 25.1 Historical limitations

The two historical exporter limitations are no longer present in the current `serializeVowlJson` path:

- the source model is cloned with `structuredClone` before collection sorting, including `namespace`; and
- exporter ordering uses locale-independent relational comparison rather than `localeCompare()`.

The focused artifact-service suite verifies representative deterministic ordering and source non-mutation.
This remains a repeatable legacy export, not Canonical VOWL: it pretty-prints JSON, preserves producer IDs, knows only selected set fields, lacks whole-graph labelling, and does not enforce the closed I-JSON/RFC 8785 domain.

The current builder ordering suite also passes.
Its comments call JavaScript relational string comparison "code-point" order, which is inaccurate for supplementary Unicode characters: JavaScript compares UTF-16 code units.
The implementation name and documentation should say exactly which order it uses.

### 25.2 Remaining call sites

Repository inspection found seven `localeCompare()` uses:

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

## 26. Migration consequences

Removing the parallel arrays is an intentional format break.
Current WebVOWL parsing, editing, inspection, export, tests, and fixtures will eventually need to consume the new occurrence model.
That consumer migration is outside the first core-package slice and must not begin while another task owns those user-facing files.

The historical migration adapter must:

- join legacy record/attribute pairs exactly once;
- reject duplicate IDs, missing partners, dangling references, and conflicting fields;
- discard traversal IDs after resolving references;
- preserve split occurrences explicitly;
- recover full annotation predicates only where the dialect contains enough information;
- reject or require explicit mappings for irreversibly collapsed local-name annotations;
- require viewport information when legacy camera translation cannot otherwise be converted to center/zoom; and
- report every dropped noncanonical session field.

Migration complexity remains at the ingress seam.
It does not weaken the core schema or create a legacy output branch.

## 27. Implementation boundary and review gates

The first implementation slice is package-local and does not modify WebVOWL's current parser, renderer, menus, export behavior, or other user-facing source.
It consists of the source model, schemas, canonicalizer, exact decoder, fixtures, and conformance tests.
The OWL and migration adapters follow through the same root interface.

Implementation requires later, explicit approval for these configuration changes:

- create `packages/vowl/package.json` with `AGPL-3.0-only`, the three export surfaces, and direct runtime dependencies;
- add the workspace entry and package test commands to the root `package.json`;
- update `package-lock.json`; and
- make only the minimum Jest, lint, formatting, or build configuration changes that prove necessary after the package-local tests exist.

No such configuration change is authorized by this design document.
No commit, push, publication, media-type registration, or user-facing cutover is implied.

## 28. Resolved design consequences

The remaining design branches are resolved without a product-value decision:

- direct class membership is the v1 ABox boundary;
- annotations remain on exact assertions even when visual structure is normalized;
- artifact state records the effective portable scene rather than WebVOWL controls or engine internals;
- artifact-only facts participate in artifact-profile graph labelling;
- the root interface is `canonicalize`/`encode`/`decode` rather than a public pipeline of validators, RDF mappers, comparators, and serializers;
- SHA-256 is fixed only for RDFC-1.0's internal labelling operation;
- application digests and signatures remain external;
- schemas are closed and versioned, while the profile prose remains normative for semantic constraints; and
- unsafe or computationally pathological input fails rather than producing an alternative byte form.

The only current gates are written review and explicit approval of the exact configuration changes needed for implementation.
