# Canonical VOWL core contract

Canonical VOWL is a representation of retained VOWL structure and, in the artifact profile, portable visualization state; it is not an OWL entailment-equivalence class.

**Disposition:** Formulate.
**Status:** Proposed normative design, ready to be translated into implementation tasks; implementation and independent conformance have not been completed.
This annex completes the field, normalization, RDF mapping, validation, and adapter contracts of the [design](2026-09-24-canonical-vowl-design.md).
The [projection contract](2026-09-24-canonical-vowl-projection-contract.md) completes visual topology and artifact state.
The [decision record](2026-09-24-canonical-vowl-design-decisions.md) gives the research, alternatives, and distinction between planning readiness and release qualification.

## A1. Reading the closed grammar

Every field listed in a record is required unless suffixed `?`.
No other fields are allowed.
`Set<T>` means a duplicate-free array of zero or more values of type `T`; `Set1<T>` requires at least one.
`Sequence2<T>` is an array of at least two values, preserves order, and permits repetition.
Only property-chain `members` is a sequence in v1; every other array in these annexes is a set.
Canonical set ordering is the design's complete-member RFC 8785 UTF-8 order, applied inside out after IDs are assigned.
Source set order is immaterial.

`Text` is a JSON string with the Unicode restrictions in A7; `Token` is an exact, case-sensitive ASCII discriminator or diagnostic code from these tables.
`IRI` is a string satisfying RFC 3987's `IRI` production with a scheme; fragments are allowed, as required for RDF IRIs.
It is not restricted to HTTP URLs and is not passed through WHATWG URL serialization.
IRI identity is lexical: no case folding, percent-decoding, Unicode normalization, or network lookup.
`Decimal` matches `0|[1-9][0-9]*` and represents a nonnegative integer without conversion to binary64.
`Number` is finite binary64, excluding negative zero.
`Boolean` is a JSON boolean.

References are strings, resolved in these exact categories:

| Type | Target                                                             |
| ---- | ------------------------------------------------------------------ |
| `S`  | Subject record.                                                    |
| `R`  | Role record.                                                       |
| `X`  | Expression record.                                                 |
| `K`  | Construct record.                                                  |
| `O`  | Occurrence record.                                                 |
| `C`  | A `class` or `rdf-class` role, or a class-sort expression from A3. |
| `D`  | A `datatype` role or a data-sort expression from A3.               |
| `P`  | An `object-property` role or an `object-inverse` expression.       |
| `DP` | A `data-property` role.                                            |
| `RP` | An `rdf-property` role.                                            |
| `AP` | An `annotation-property` role.                                     |
| `I`  | An `individual` role, including one over an anonymous subject.     |

Canonical reference spellings use the category prefixes and issuance rule in design section 18.2.
Source references instead use arbitrary nonempty `Text` handles, unique across all five record categories.
The same field name `id` carries a source handle before canonicalization and a canonical ID afterward.
`id` is never itself encoded as a fact in the internal RDF dataset.
An annotation's IRI value is an `IRI`, not a reference merely because its spelling equals a handle.

## A2. Envelopes, subjects, roles, and values

The source envelope is `{structural, visualization?}`.
The operation's `profile` selects structural-content or artifact; no profile default is implicit in the core.
Structural-content rejects `visualization`; artifact requires it.
The canonical document adds the exact profile IRI as `profile`.
This rule avoids silently dropping supplied visualization state.

`structural` is `{ontology, subjects:Set<Subject>, roles:Set<Role>, expressions:Set<Expression>, constructs:Set<Construct>, occurrences:Set<Occurrence>}`.

| Record                     | Closed fields                                                                                                  |
| -------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Ontology                   | `iri?:IRI`, `versionIri?:IRI`, `imports:Set<IRI>`, `annotations:Set<Annotation>`. `versionIri` requires `iri`. |
| Subject                    | `id:S`, `iri?:IRI`. Absence of `iri` means a distinct document-local anonymous subject.                        |
| Role                       | `id:R`, `kind:RoleKind`, `subject:S`.                                                                          |
| Annotation                 | `predicate:IRI`, `value:AnnotationValue`, `annotations:Set<Annotation>`.                                       |
| IRI annotation value       | `kind:"iri"`, `iri:IRI`.                                                                                       |
| Anonymous annotation value | `kind:"subject"`, `subject:S`; the target subject must be anonymous.                                           |
| Typed literal              | `kind:"typed"`, `lexical:Text`, `datatype:IRI`.                                                                |
| Language literal           | `kind:"language"`, `lexical:Text`, `language:Text`.                                                            |

`AnnotationValue` is exactly the last four branches; `Literal` is exactly the last two.
The typed-literal branch excludes `rdf:langString`.
Language literals imply that datatype without storing it twice.
Simple strings become typed `xsd:string` literals.
Language tags must satisfy RFC 5646 well-formedness, including its fixed grandfathered alternatives and constraints on repeated variants/extension singletons, and are lowercased with ASCII rules.
Registry membership, preferred-subtag replacement, likely-subtag expansion, and Unicode normalization are not performed.

`RoleKind` is exactly `class`, `rdf-class`, `datatype`, `object-property`, `data-property`, `annotation-property`, `rdf-property`, or `individual`.
`rdf-class` retains genuinely RDFS-only class notation; it is not inferred from a missing declaration in an otherwise typed OWL position.
When a subject has a specific `class` role, the generic `rdf-class` role is omitted.
When it has any specific property role, its generic `rdf-property` role is omitted.
Other explicit multiple roles are representable in the core; the strict OWL adapter applies OWL 2 DL's additional constraints.
Property and datatype roles require a named subject.
Anonymous class, RDFS class, and individual roles are permitted where the selected mapper can identify that category without guessing.

Named subjects are unique by exact IRI; roles are unique by `(subject,kind)`.
Anonymous subjects are not merged because their remaining facts happen to be isomorphic.
Every subject must be used by a role, an annotation assertion, or an anonymous annotation value.
An otherwise unreferenced role may represent a declaration.
Annotation predicate use creates an annotation-property role, and literal datatype use creates a datatype role; the language branch uses `rdf:langString` for this signature closure.
An IRI used only as an annotation value, import, or ontology identifier does not by itself create a subject or role.

## A3. Expression grammar

Every expression has `id:X` and `kind:Token`, plus exactly the additional fields below.
The `Sort` column defines legal reference positions and is not a serialized field.

| Kind                                                                           | Sort            | Additional fields                                                   |
| ------------------------------------------------------------------------------ | --------------- | ------------------------------------------------------------------- |
| `class-intersection`, `class-union`                                            | class           | `members:Set1<C>`                                                   |
| `class-complement`                                                             | class           | `operand:C`                                                         |
| `class-enumeration`                                                            | class           | `members:Set1<I>`                                                   |
| `object-some`, `object-all`                                                    | class           | `property:P`, `filler:C`                                            |
| `object-value`                                                                 | class           | `property:P`, `value:I`                                             |
| `object-self`                                                                  | class           | `property:P`                                                        |
| `object-min-cardinality`, `object-max-cardinality`, `object-exact-cardinality` | class           | `property:P`, `cardinality:Decimal`, `filler:C`                     |
| `data-some`, `data-all`                                                        | class           | `property:DP`, `filler:D`                                           |
| `data-value`                                                                   | class           | `property:DP`, `value:Literal`                                      |
| `data-min-cardinality`, `data-max-cardinality`, `data-exact-cardinality`       | class           | `property:DP`, `cardinality:Decimal`, `filler:D`                    |
| `object-inverse`                                                               | object property | `property:R`, restricted to an `object-property` role               |
| `data-intersection`, `data-union`                                              | data            | `members:Set1<D>`                                                   |
| `data-complement`                                                              | data            | `operand:D`                                                         |
| `data-enumeration`                                                             | data            | `members:Set1<Literal>`                                             |
| `datatype-restriction`                                                         | data            | `datatype:R`, restricted to a `datatype` role; `facets:Set1<Facet>` |

`Facet` is `{facet:IRI,value:Literal}`.
The core preserves distinct values using the same facet and makes no satisfiability judgment.
The OWL adapter checks applicable datatype/facet rules under its mapping profile.
Only unary data ranges are retained in v1; multi-property data quantification is outside this grammar and receives the adapter treatment in A9.

Expression-reference dependencies must be acyclic.
References through roles, constructs, and occurrences are not mistaken for recursive expression expansion.
Structurally identical expressions share one record: compare their complete typed payloads recursively, treating role/subject identity as a reference identity and ignoring expression handle spelling.
The source canonicalizer rejects duplicate normalized expressions; adapters perform deduplication before calling it.
Expressions must be reachable from constructs, assertion anchors, or other reachable expressions.

The source adapter first validates the OWL constructor's original arity, then deduplicates set operands.
A resulting singleton set retains its constructor, including a singleton disjointness group; it is not replaced by its member.
Empty source constructors are not repaired into valid ones.
Nested intersections/unions are not flattened.
An omitted cardinality filler becomes the role for `owl:Thing` or `rdfs:Literal`; explicit use of that same filler has the same normalized form.
Inverse nesting is not part of the OWL object-property-expression grammar and is not invented by the core.

## A4. Construct and assertion grammar

Every construct has `id:K`, `kind:Token`, and exactly the additional fields below.
Base constructs contain normalized retained meaning once.
All source-axiom annotations use the uniform assertion-anchor rule following the table, rather than sometimes being copied onto an aggregate and sometimes being stored separately.

| Kind                                                         | Additional fields                                                                    |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| `subclass`                                                   | `sub:C`, `super:C`                                                                   |
| `equivalent-classes`, `disjoint-classes`                     | `members:Set1<C>`                                                                    |
| `disjoint-union`                                             | `defined:R` of class kind, `members:Set1<C>`                                         |
| `sub-object-property`                                        | `sub:P`, `super:P`                                                                   |
| `equivalent-object-properties`, `disjoint-object-properties` | `members:Set1<P>`                                                                    |
| `inverse-properties`                                         | `members:Set1<P>` with at most two members                                           |
| `property-chain`                                             | `members:Sequence2<P>`, `super:P`                                                    |
| `object-domain`, `object-range`                              | `property:P`, `target:C`                                                             |
| `object-characteristic`                                      | `property:P`, `characteristic:ObjectCharacteristic`                                  |
| `sub-data-property`                                          | `sub:DP`, `super:DP`                                                                 |
| `equivalent-data-properties`, `disjoint-data-properties`     | `members:Set1<DP>`                                                                   |
| `data-domain`                                                | `property:DP`, `target:C`                                                            |
| `data-range`                                                 | `property:DP`, `target:D`                                                            |
| `data-characteristic`                                        | `property:DP`, `characteristic:"functional"`                                         |
| `sub-rdf-property`                                           | `sub:RP`, `super:RP`                                                                 |
| `equivalent-rdf-properties`, `disjoint-rdf-properties`       | `members:Set1<RP>`                                                                   |
| `rdf-domain`                                                 | `property:RP`, `target:C`                                                            |
| `rdf-range`                                                  | `property:RP`, `target:C` or `target:D`, as identified by the resolved target record |
| `rdf-characteristic`                                         | `property:RP`, `characteristic:"functional"`                                         |
| `sub-annotation-property`                                    | `sub:AP`, `super:AP`                                                                 |
| `annotation-domain`, `annotation-range`                      | `property:AP`, `target:IRI`                                                          |
| `datatype-definition`                                        | `datatype:R` of datatype kind, `target:D`                                            |
| `key`                                                        | `class:C`, `objectProperties:Set<P>`, `dataProperties:Set<DP>`                       |
| `class-membership`                                           | `class:C`, `individual:I`                                                            |
| `annotation-assertion`                                       | `subject:S`, `predicate:IRI`, `value:AnnotationValue`                                |
| `assertion-anchor`                                           | `assertion:Assertion`, `annotations:Set1<Annotation>`                                |

`ObjectCharacteristic` is exactly `functional`, `inverse-functional`, `symmetric`, `asymmetric`, `transitive`, `reflexive`, or `irreflexive`.
An inverse pair may have one member after exact duplicate elimination; self-inverse assertions are retained, not discarded.
Both key-member sets may be empty: that is different from a missing key construct.

`Assertion` is an embedded copy of any base-construct shape above with its `id` removed, excluding `assertion-anchor`, or `{kind:"declaration",role:R}`.
An assertion anchor retains the pre-aggregation assertion after scalar and expression normalization, with the exact set of source-axiom annotations on that assertion.
Anchors never contain other anchors; nested annotations use `Annotation` recursively.
Different annotation sets produce different anchors, while repeated identical anchors deduplicate.
An anchor must be supported by the corresponding base fact, declaration role, or endpoint aggregate; it cannot introduce an unrelated assertion whose normalized meaning is absent.
For an endpoint anchor, its target must be the aggregate target itself or one immediate operand of the aggregate intersection.
The core does not claim to reconstruct discarded, unannotated source axioms.

For example, domains `A` and `B` normalize to one domain construct targeting `class-intersection(A,B)`.
An annotation on the original domain `A` is carried by an anchor whose embedded assertion still targets `A`.
The same anchor rule applies to an annotated subclass, declaration, characteristic, or annotation assertion even when no aggregation occurred.
This uniform rule preserves attachment while keeping a single semantic fact and a single source for each annotation.

## A5. Normalization and uniqueness

Normalization is a finite structural procedure, not inference:

1. Resolve the selected closure and standardize anonymous subjects apart by source ontology before erasing acquisition provenance.
2. Establish named subjects, typed roles, and the finite annotation/datatype signature closure in A2.
3. Normalize literals, explicit default cardinality fillers, and typed expressions; preserve lexical values and constructor nesting.
4. Build each unannotated base-construct payload, deduplicate exactly equal payloads, and separately build anchors for annotated source assertions.
5. For each exact `(property, endpoint-kind)`, deduplicate endpoint targets.
   One target is used as-is; two or more become one immediate intersection, without flattening nested expressions.
   Generic RDF ranges containing both class and data targets are ambiguous and fail rather than selecting a category.
6. Generate and validate the complete occurrence projection in annex B.
7. For an artifact, attach complete explicit state to those occurrence handles before whole-profile labelling.

No inverse-endpoint propagation, equivalent-property domain inference, reasoner closure, property-characteristic expansion, algebraic simplification, or numeric lexical canonicalization occurs.
Missing endpoints are projection defaults, not asserted domain/range constructs.
Rendering equivalence groups in annex B does not add inferred equivalence constructs.
Declarations add roles; annotated declarations add anchors; redundant unannotated declarations add nothing.

Primary-record uniqueness is semantic within each category, not equality of raw JSON containing different `id` values.
Subjects and roles use A2's keys; expressions use A3's structural key; constructs use their full typed payload except `id`; occurrences use annex B's generation key.
Anonymous subjects remain distinct nominal subjects in these comparisons, even when a whole-graph automorphism can exchange them.
Exact source-set duplicates are rejected after scalar normalization so differently cased language tags cannot evade uniqueness.

**Positive instance:** an unannotated pair of domain assertions for `A` and `B`, and a single domain assertion for the direct intersection of `A` and `B`, have the same normalized endpoint.
**Negative instance:** attaching an annotation to `A`'s assertion changes the retained anchor and therefore the canonical model.
**Near miss:** replacing a repeated property chain `[p,q,p]` with `[p,q]` changes an ordered construct and must change the result.

## A6. Complete internal RDF encoding

### A6.1 Vocabulary and graph framing

The proposed private algorithm vocabulary is the exact base:

```text
https://haddenindustries.com/ontology/vowl/canonical-mapping/v1#
```

`m:` below abbreviates that string for specification notation only.
It is a newly formulated algorithm vocabulary, not a claim that these IRIs are already deployed or an OWL ontology has adopted them.
It is published with the frozen profile bundle; implementations never dereference it while canonicalizing.
Changing this base or any template after freeze requires a new canonical profile.

The complete vocabulary is `m:root`, `m:Object`, `m:Subject`, `m:Role`, `m:Expression`, `m:Construct`, `m:Occurrence`, `m:Set`, `m:Sequence`, `m:Slot`, `m:member`, `m:slot`, `m:index`, `m:value`, `m:token`, `m:binary64`, and the predicate family `m:field/NAME` for the exact canonical field names in A2–A4 and B1/B3, including envelope fields `profile`, `structural`, and `visualization` and excluding primary `id`.
API options, limits, errors, diagnostics, and migration resolutions do not define canonical field predicates.
`rdf:type`, `xsd:string`, `xsd:boolean`, and `xsd:nonNegativeInteger` use their standard namespace IRIs.
All triples are in the default graph; the named-graph set is empty.
The document root is the fixed named node `m:root`.
The root has type `m:Object` and its ordinary `profile` field points to the selected canonical profile IRI.

### A6.2 Allocation

Allocate one blank node for every primary record, with type `m:Subject`, `m:Role`, `m:Expression`, `m:Construct`, or `m:Occurrence` according to its containing collection.
Every embedded object and collection occurrence receives a fresh auxiliary blank node; a sequence item additionally receives a fresh slot node.
Do not share auxiliary nodes between equal embedded values or according to JavaScript object identity.
Do not create nodes for absent optional fields.
Blank-node labels used during construction are arbitrary handles and have no semantic significance.
All allocated nodes must be reachable from `m:root` through field, member, slot, or reference edges; unused allocation artifacts are not part of the dataset.

### A6.3 Exhaustive templates

These templates apply recursively to every field in A2–A4 and annex B.
The declared field type selects the template; property names or string contents are never heuristically interpreted as references.

| Typed input at field `NAME` of node `n`                                    | Exact triple/object rule                                                                                                                                                                                                                   |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Any present field except primary `id`                                      | Emit `(n, m:field/NAME, E(value))`. Field name case is preserved.                                                                                                                                                                          |
| Absent optional field                                                      | Emit nothing for that field.                                                                                                                                                                                                               |
| Primary `id`                                                               | Emit no triple; use its handle only to resolve references to the already allocated primary node.                                                                                                                                           |
| `S`, `R`, `X`, `K`, `O`, `C`, `D`, `P`, `DP`, `RP`, `AP`, or `I` reference | `E` is the target primary blank node.                                                                                                                                                                                                      |
| `IRI`                                                                      | `E` is a named node with exactly that IRI spelling.                                                                                                                                                                                        |
| `Token`, including finite mode/characteristic choices                      | `E` is a literal whose lexical form is the token and datatype is `m:token`.                                                                                                                                                                |
| `Text` or `Decimal`                                                        | `E` is a literal with the exact string and datatype `xsd:string`; field typing and enclosing discriminants distinguish their domains.                                                                                                      |
| `Boolean`                                                                  | `E` is an `xsd:boolean` literal with lexical form `true` or `false`.                                                                                                                                                                       |
| `Number`                                                                   | `E` is a literal with datatype `m:binary64` and lexical form equal to RFC 8785's number serialization.                                                                                                                                     |
| Embedded object                                                            | `E` is its fresh node, typed `m:Object`; recursively emit each present field. The literal's `lexical`, `datatype`, and `language` fields are ordinary boxed fields, not a coercible RDF literal carrying the OWL value directly.           |
| `Set<T>` or `Set1<T>`                                                      | `E` is a fresh node typed `m:Set`; emit `(E, m:member, E(item))` for each member. No order, index, length, or input handle is stored.                                                                                                      |
| `Sequence2<T>`                                                             | `E` is a fresh node typed `m:Sequence`; for each zero-based position `i`, emit `(E,m:slot,b)`, `(b,rdf:type,m:Slot)`, `(b,m:index,i^^xsd:nonNegativeInteger)`, and `(b,m:value,E(item))`. Indices use plain decimal with no leading zeros. |
| A primary record inside its category set                                   | `E` is its allocated primary node; recursively encode its fields except `id`, exactly once.                                                                                                                                                |

There is no `null` template because `null` is outside the grammar.
Collection nodes exist even for empty sets, preserving present-empty versus absent.
The same templates would encode an empty sequence distinctly from an empty set, although v1's only sequence field requires at least two members.
Sequence positions preserve repeated scalar and reference values without relying on RDF triple order.
Nested set-member object values get independent auxiliary nodes; normalized duplicates are rejected before RDF set semantics can erase them.

The field inventory and these templates jointly constitute the complete per-field mapping; there is no additional handwritten OWL-to-RDF translation inside the canonical core.
In particular, this is not OWL's standard RDF serialization and no RDF entailment or datatype-value normalization is applied to it.
Both profiles use these templates; artifact fields are present in the artifact dataset before RDFC runs.

### A6.4 Recovery argument and labelling

Starting at `m:root`, field predicates recover object members and their declared types.
Node types distinguish records, embedded objects, sets, sequences, and slots.
Absent edges and present empty containers differ; slot indices recover order and repetition; boxed literal fields preserve lexical and datatype distinctions.
References recover a graph of distinct primary nodes, not their producer handle spellings.
Fresh auxiliary allocation gives each embedded value a single ownership position, so JavaScript sharing cannot introduce additional graph facts.
By structural induction over embedded values and the finite expression graph, the inverse recovers the normalized model up to primary-handle renaming and set permutation.
That establishes the design-level injectivity argument; implementation tests must check the templates and counterexamples independently.

Run RDFC-1.0 with SHA-256, then apply design section 18.2's numeric `c14nN` category-rank rule.
Do not use the order of canonical N-Quads lines as an ID issuance order.
Serialize all set members after replacement of references.
The private RDF dataset and its auxiliary IDs are conformance artifacts, not fields in the canonical document.

## A7. Validation contract and deterministic errors

Unicode validation rejects lone surrogates and the Unicode noncharacters prohibited by I-JSON: U+FDD0–U+FDEF and code points ending in FFFE or FFFF through U+10FFFF.
Escaped valid surrogate pairs are decoded as their scalar value.
Literal lexical values otherwise retain every character, including normalization distinctions and permitted control characters represented by JSON escapes.
The extra noncharacter rule closes a gap in the earlier design's lone-surrogate-only wording.

JSON decoding validates syntax and duplicate decoded member names before materialization.
It then validates the grammar, references, semantic keys, projection, and artifact completeness; reconstructs and recanonicalizes the source; and compares both the canonical document and exact RFC 8785 bytes.
It never defaults, repairs, coerces, strips unknown fields, or returns a repaired result.
Synchronous `encode` accepts only a deeply frozen document admitted by this module instance's successful `canonicalize` or `decode` and returns newly allocated bytes.
Unadmitted objects fail even if their shape is plausible; internal admission uses nonserialized state.

Programmatic input accepts only records with `Object.prototype` or a null prototype and ordinary dense arrays, containing own enumerable data properties.
Inspect property descriptors without invoking getters; reject accessors, symbol keys, extra array properties, and nonenumerable record fields rather than silently ignoring them.
The array `length` descriptor is the sole structural exception.
Snapshot every occurrence of a shared acyclic embedded value by value; JavaScript sharing is not semantic identity.
The snapshot is complete before the first asynchronous suspension.
These checks do not claim to sandbox a hostile JavaScript `Proxy`.

Validation precedence is fixed:

1. operation/options and already-aborted signal;
2. input kind and input-byte limit;
3. fatal UTF-8, byte-order mark, JSON grammar, decoded member names, and lexical limits in token encounter order;
4. plain-value snapshot safety for programmatic input; the canonical envelope's required/type/known-profile checks when decoding; then closed field sets and scalar domains;
5. primary IDs, reference existence, reference target categories, expression cycles, and structural uniqueness;
6. assertion support, normalized endpoints/signature closure, and exact occurrence projection;
7. artifact placement/visibility completeness and camera/placement invariants;
8. RDFC work/cancellation, ID issuance, canonical set ordering, document comparison, and exact byte comparison.

Within an object use unsigned UTF-16 field-name order; within a source array use its supplied index order for error locations.
At the same location check required fields, forbidden fields, JSON types, scalar domains, references, then semantic constraints in the order above.
This defines the same first error for the same input value, not the same JSON Pointer for every permutation of an invalid set.
An observed abort/deadline ends processing before the next content check; timing outcomes are not canonical content.

| Stable code                                                                                         | Meaning                                                                                            |
| --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `OPTION_INVALID`                                                                                    | Unknown option, invalid profile option, or limit outside its allowed domain.                       |
| `INPUT_TYPE`                                                                                        | Incorrect public-operation input kind or unsafe byte backing store.                                |
| `SOURCE_UNSAFE_VALUE`                                                                               | Accessor, custom prototype/serialization, symbol, sparse array, cycle, or non-JSON value.          |
| `JSON_INVALID_UTF8`, `JSON_BOM`, `JSON_SYNTAX`, `JSON_DUPLICATE_MEMBER`                             | Lexical decoding boundaries in that order of encounter.                                            |
| `UNICODE_INVALID`, `NUMBER_INVALID`, `DECIMAL_INVALID`                                              | Invalid scalar domain.                                                                             |
| `PROFILE_UNKNOWN`, `DOCUMENT_REQUIRED_FIELD`, `DOCUMENT_UNKNOWN_FIELD`, `DOCUMENT_TYPE`             | Closed grammar/profile failure.                                                                    |
| `IRI_INVALID`, `LANGUAGE_TAG_INVALID`, `LANGUAGE_RANGE_INVALID`                                     | Explicit scalar validators fail.                                                                   |
| `ID_INVALID`, `ID_DUPLICATE`, `REFERENCE_DANGLING`, `REFERENCE_KIND`, `EXPRESSION_CYCLE`            | Record/reference graph failure.                                                                    |
| `SOURCE_DUPLICATE_SET_MEMBER`, `RECORD_DUPLICATE`, `NORMALIZATION_INVALID`, `ASSERTION_UNSUPPORTED` | The purported normalized source violates A2–A5.                                                    |
| `PROJECTION_INVALID`, `ARTIFACT_INCOMPLETE`                                                         | Occurrence or artifact-state invariant failure.                                                    |
| `INPUT_RESOURCE_LIMIT`, `MODEL_RESOURCE_LIMIT`, `RDF_RESOURCE_LIMIT`, `RDFC_RESOURCE_LIMIT`         | A counted resource budget is exceeded.                                                             |
| `ABORTED`, `DEADLINE_EXCEEDED`                                                                      | Caller cancellation or elapsed-time budget.                                                        |
| `DOCUMENT_NOT_ADMITTED`                                                                             | A document passed directly to `encode` lacks full-validation admission.                            |
| `NON_CANONICAL_BYTES`                                                                               | Validly interpretable input has noncanonical graph IDs, scalar spelling, set order, or JSON bytes. |
| `DEPENDENCY_FAILURE`                                                                                | An unexpected standards-library failure after input validation; never a fallback result.           |

Canonical IDs must match their category prefix followed by `0` or a nonzero-leading decimal integer and form contiguous ranks within each category.
Malformed spelling fails with `ID_INVALID`; duplicate IDs fail with `ID_DUPLICATE`.
Validly shaped but incorrect ranks or assignments, unsorted otherwise valid sets, and noncanonical scalar spellings fail with `NON_CANONICAL_BYTES` when decoding.
The source canonicalizer accepts arbitrary unique handles and source set order; those are not decoding errors on source input.

Use one package error class with `code`, `message`, optional `pointer`, optional `details`, and optional `cause`.
`details` may contain `byteOffset`, `limit`, `maximum`, `actual`, or a safe stage token; it must not copy unbounded source values or stacks into serialized diagnostics.
Map dependency errors at the wrapper, not by exposing their English message as the package contract.

JSON Schema 2020-12 artifacts are a mechanical translation of the closed tables: discriminated `oneOf` branches, exact required fields, closed composed objects, explicit array item types and cardinalities.
The semantic validator implements the ordered invariants above.
Neither generic `uniqueItems` nor implementation-dependent `format` handling substitutes for typed record identity, IRI/tag validation, or graph verification.

## A8. Resource and worker policy

These initial operating limits are engineering policy, not RDF/OWL validity rules, benchmark results, or canonical fields.
The defaults are finite and the upper override bounds are finite; raising one limit does not waive another.
Each integer override must be between one and its upper bound, except `rdfDeepIterations`, which may be zero.

| Option              | Unit and enforcement                                                             |  Default | Upper override bound |
| ------------------- | -------------------------------------------------------------------------------- | -------: | -------------------: |
| `inputBytes`        | Raw decoder/adapter bytes, checked before decoding.                              | 33554432 |            268435456 |
| `primaryRecords`    | Sum of five primary record collections, checked while snapshotting.              |   100000 |              1000000 |
| `embeddedValues`    | Embedded objects, arrays, and sequence slots, counted before allocation.         |   500000 |              4000000 |
| `depth`             | Embedded JSON containers or expression expansion depth, counted independently.   |      128 |                  512 |
| `stringBytes`       | UTF-8 bytes in any string, including names, handles, and literal lexical values. |  1048576 |             16777216 |
| `totalStringBytes`  | Sum over string occurrences in the snapshot, including repeated values.          | 16777216 |            134217728 |
| `rdfQuads`          | Emitted internal triples, checked before insertion.                              |  1000000 |              8000000 |
| `rdfDeepIterations` | RDFC deep-comparison invocations, bounded as described below.                    |   100000 |              1000000 |
| `deadlineMs`        | Monotonic elapsed time from operation entry through successful return.           |    10000 |               300000 |

These controls apply to `canonicalize` and `decode`; OWL/migration adapters share one operation deadline and aggregate counters with their core call rather than resetting budgets at every stage.
Source objects have no raw-byte count; snapshot counters apply instead.
The byte decoder accepts `Uint8Array`, snapshots it before asynchronous work, and rejects shared-memory backing stores; detached or otherwise unreadable buffers fail.
No operation exposes an unbounded/Infinity option.

For the selected `rdf-canonize` implementation, pass an explicit `maxDeepIterations` equal to the smaller of total allocated blank nodes and `rdfDeepIterations`.
This gives a linear ceiling in the mapped graph size as well as an absolute ceiling, and deliberately avoids relying on a library's mutable default or sentinel spelling.
Pass `algorithm:"RDFC-1.0"`, `messageDigestAlgorithm:"sha256"`, `canonicalIdMap`, `rejectURDNA2015:true`, and the combined caller/deadline abort signal.
Check cancellation and counters at each stage and at least every 1024 visited values or emitted quads.
Another implementation may enforce an equivalent or stricter operational budget; every successful result must have the same bytes.

Browser integration executes parsing, normalization, graph verification, and encoding inside a dedicated worker.
The application transfers bytes where possible; a document cloned for rendering does not acquire `encode` admission in another module instance.
Cancellation invalidates the request immediately, sends cooperative cancellation, and terminates a nonresponsive worker after a 250 ms grace period.
Each result is bound to a request ID and load generation; stale results are discarded.
The worker is also terminated when its deadline expires, independently of the graph library's polling frequency.

Qualification must include every counter boundary, zero-deep-work rejection of a fixture requiring deep comparison, cancellation before/during RDFC, worker termination, stale-result suppression, and memory/elapsed-time observations on the named test environments.
The implementation plan must measure ordinary, large, symmetric, and poison-graph cases and propose any default adjustment with evidence.
Because limits affect acceptance rather than successful bytes, such tuning does not mint a new canonical profile.
It must not relax the finite-limit or no-fallback contract.

## A9. Adapter policies and scope

The OWL mapping identifiers are:

```text
https://haddenindustries.com/ontology/profiles/vowl/owl-mapping/strict/v1
https://haddenindustries.com/ontology/profiles/vowl/owl-mapping/compatibility/v1
```

They are proposed identifiers published with the adapter release; compatibility is the default.
Both use the retained constructor inventory in A2–A4 and emit only the structural-content profile.
They do not reconstruct an artifact from an automatic layout.
Source bytes, media type, base/document IRI, import resolution, and parser diagnostics belong to the OWL adapter/`owlapi` seam, not the canonical core.

### A9.1 Public adapter boundary

`fromOwl(source, {documentIri,mediaType,mappingProfile?,resolveImport?,signal?,limits?})` takes a `Uint8Array` snapshot.
`documentIri` is a required absolute IRI used as the parser's base, not as a substitute for a missing ontology IRI.
`mediaType` is an explicit parser media type supported by the selected `owlapi` release; unsupported values fail with `MAPPING_MEDIA_TYPE_UNSUPPORTED` rather than sniffing a different syntax.
Parser support is qualified per release and reported externally; the same successfully parsed ontology must yield the same model in every supported syntax.
Only `mappingProfile` defaults, to compatibility; there is no implicit fetcher or artifact profile option.

The caller's asynchronous `resolveImport(importIri,{importingDocumentIri,signal})` returns `{bytes:Uint8Array,documentIri:IRI,mediaType:Text}` or reports a resolution failure.
It must honor cancellation and the caller's acquisition policy.
The adapter checks aggregate byte/model limits before admitting the returned content and passes the resolver through `owlapi`'s closure lifecycle.
It snapshots each returned byte array before asynchronous parsing and applies A8's backing-store restrictions to both root and imported bytes.
Without a resolver, an authored import is unresolved; the selected strict/compatibility policy applies.
The resulting root ontology and manager-resolved closure are inputs to the package's private builder, not alternative public `fromOwl` input shapes.
The result is the deeply immutable `{document,mappingProfile,diagnostics}` envelope from design section 7.3.
Parser failures become `MAPPING_SYNTAX_INVALID`; source structure that cannot be assigned an unambiguous retained interpretation becomes `MAPPING_AMBIGUOUS`.

### A9.2 Strict and compatibility behavior

Strict mapping requires well-formed syntax, a complete closure, and an OWL 2 DL structural conformance check over that closure before retention filtering.
The check includes reserved vocabulary, category separation, property simplicity/regularity, and other global structural restrictions; it is not a reasoner consistency check.
An `owlapi` capability missing for that check is an adapter implementation task, not authority to label a partial check strict.
Strict mode rejects an unverifiable literal datatype with `MAPPING_DATATYPE_UNVERIFIED` instead of asserting lexical validity it did not establish.
Known v1 exclusions below are diagnosed after this check and are not confused with unparsed or ambiguous RDF.

The complete compatibility recovery catalogue is:

| Code                          | Allowed recovery                                                                                                                                                            |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MAPPING_IMPORT_UNRESOLVED`   | Retain root import declarations, use the resolved subset, and diagnose each failed import by its authored IRI.                                                              |
| `MAPPING_MULTIPLE_ROLES`      | Keep independently identified explicit role categories on the same subject, including combinations outside OWL 2 DL. Do not choose a role for an ambiguous use.             |
| `MAPPING_RDFS_ROLE`           | Retain explicitly RDFS-only class/property categories and their explicit relations using `rdf-class`/`rdf-property`. More specific identified roles supersede generic ones. |
| `MAPPING_ILL_TYPED_LITERAL`   | Preserve a parsed literal's exact lexical form when the datatype validator establishes that it is ill-typed.                                                                |
| `MAPPING_DATATYPE_UNVERIFIED` | Preserve a custom/unsupported datatype literal without asserting lexical validity; never coerce it to a supported datatype.                                                 |
| `MAPPING_GLOBAL_RESTRICTION`  | Preserve unambiguously parsed retained structures that violate an OWL 2 DL global structural restriction, with its stable restriction identifier in the diagnostic.         |

Well-formed source syntax and unambiguous construction of retained terms are mandatory in both profiles.
Malformed lists, conflicting endpoint categories, unknown constructor kinds, invalid IRIs/tags, cyclic expressions, and unresolved semantic ambiguity fail; compatibility is not a catch-all recovery handler.
Well-typed use in an OWL constructor establishes its role even without a redundant explicit declaration; that is structural mapping, not a speculative recovery.

Both profiles deliberately exclude positive/negative object/data property assertions and same/different-individual axioms from canonical content, reporting `MAPPING_EXCLUDED_AXIOM` with the exact source constructor kind.
They retain the declared/referenced individual roles and direct class memberships specified in the design.
Multi-property data quantification is rejected with `MAPPING_UNSUPPORTED_CONSTRUCT` in strict mode and omitted as a whole with that diagnostic in compatibility mode; it is never approximated as independent unary restrictions.
No other unknown construct is silently omitted.
Annotations on an excluded axiom remain excluded with that axiom and are diagnosed; they are not reattached to its participants.

Diagnostics are immutable records `{code:Token,severity:"warning",subject?:IRI,sourcePointer?:Text,details:Text}`.
Their array is ordered by RFC 8785 UTF-8 bytes of the complete record; identical diagnostics deduplicate.
`details` is bounded explanatory text outside canonical identity, not a replacement for a stable code.
Fatal adapter errors use the package error class with the corresponding mapping code and a safe cause.

### A9.3 Historical migration boundary

Historical migration is a separate later slice, with an explicit dialect argument and no automatic detection.
Its initial qualification target is the current repository's legacy parallel-array export dialect at reviewed commit `354ed3af8c1e82019f6280b2594acaceac96cca0`; additional Java or historical dialects require separately named contracts and fixtures.
That target's exact dialect token is `webvowl-legacy-354ed3af8c1e82019f6280b2594acaceac96cca0`.
`migrate(bytes,{dialect,profile,resolutions?,signal?,limits?})` accepts a `Uint8Array` snapshot and requires both dialect and canonical profile explicitly.
It uses duplicate-safe lexical JSON validation and returns a deeply immutable `{document,dialect,diagnostics}` envelope.
`resolutions` defaults to an empty set of `{kind,sourcePointer,...}` records, unique by `(kind,sourcePointer)`.
The only resolution kinds are `annotation-predicate` and `ontology-iri`, each adding `iri:IRI`, and `viewport`, adding positive finite `width:Number` and `height:Number`.
Pointers must identify the exact unresolved source location; unused, conflicting, or incorrectly typed resolutions fail with `MIGRATION_RESOLUTION_INVALID`.
They provide caller-supplied information explicitly and are recorded in `MIGRATION_RESOLVED_FIELD` diagnostics outside the document.
The implementation plan must inventory that exact dialect and publish its accepted ingress schema and field mapping before enabling it.
That inventory is implementation evidence against a fixed target, not discretion to invent missing semantics.
Unsupported or irreversible cases fail with `MIGRATION_AMBIGUOUS`; callers may supply explicit predicate-IRI, ontology-IRI, or viewport resolutions keyed by the failing source JSON Pointer.
Unknown dialects fail with `MIGRATION_DIALECT_UNKNOWN`.
All discarded noncanonical session fields receive `MIGRATION_DROPPED_FIELD` diagnostics.
Structural migration may discard layout with diagnostics; artifact migration requires complete recoverable positions, pins, display state, and camera, otherwise it fails rather than running a layout.
Artifact state must correlate unambiguously with the newly generated canonical occurrences.
If legacy occurrences collapse with conflicting state, or a required canonical occurrence has no recoverable placement, fail with `MIGRATION_AMBIGUOUS` rather than choosing the first legacy record or inventing a position.

## A10. Required implementation evidence

The plan must deliver two closed JSON Schema files, the invariant validator, the mapping implementation, both canonicalization operations and admitted-document encoder, and a language-neutral conformance manifest.
Positive fixtures must include exact source, mapped default-graph triples, canonical N-Quads, primary-node/category correspondence, canonical JSON, and exact bytes.
For symmetric fixtures, fixed-input identifier maps may be recorded, but permutations are compared by complete output rather than a supposed durable source-handle correspondence.

At minimum the corpus covers every grammar row; every discriminator and required/forbidden field; absent/empty distinctions; boxed literal lexical variants; anonymous multiplicity; punning; annotation anchors; nested sets; repeated/reversed chains; numeric `c14n2` versus `c14n10` issuance; invalid Unicode/UTF-8/escaped duplicate names; all projection rules; and every operational counter boundary.
Every template receives an independently reviewed inverse-interpretation counterexample or metamorphic invariant.
The actual expected byte files, executable schemas, independent implementation agreement, and measured runtime results are implementation/freeze deliverables, not claims made by this design annex.
