# Compatible-artifact candidate contract

## 1. Status and authority

This supplement specifies the compatible-artifact candidate at source revision `2bba8c5511e9d0b8fc665d542ce06481d3001208` independently of its implementation-owned field inventory.
It completes the portable grammar and mapping described in sections 15–16 of the [compatible-view amendment](2026-10-02-canonical-vowl-compatible-view-amendment-draft.md).
It is a candidate contract for independent derivation, not a completed interoperability freeze or a claim of independent byte agreement.
The original structural-content and artifact profiles, their evidence-pinned authorities and expected bytes are unchanged.
Implementation correspondence is checked separately; production code is not an input authority for an independent producer using this document.

The profile IRI is exactly `https://haddenindustries.com/ontology/profiles/vowl/canonical/compatible-artifact/v1`.
The schema identifier is that IRI followed by `/schema`.
This supplement governs portable artifact fields, not the amendment's section-10 inspection objects, source-locator shapes or private session checkpoint.
In particular, nullable inspection fields do not introduce nullable portable fields.

Read this document with the [core contract](2026-09-24-canonical-vowl-core-contract.md), [design](2026-09-24-canonical-vowl-design.md), [projection contract](2026-09-24-canonical-vowl-projection-contract.md), accepted [protocol clarifications](2026-09-30-canonical-vowl-protocol-clarifications.md), [camera precedence](2026-09-30-canonical-vowl-camera-error-precedence.md), [RDFC resource amendment](2026-09-30-canonical-vowl-resource-policy-amendment.md) and [embedded-work amendment](2026-10-03-canonical-vowl-embedded-work-amendment.md).
The last amendment's default is 1,500,000 embedded-work units, with the 4,000,000 maximum unchanged.
No limit or runtime behavior is changed by this transcription.

## 2. Notation and scalar rules

Objects are closed: all listed fields are required unless marked `?`; absent optional fields emit nothing.
No field permits JSON `null`.
`Set<T>` is an array of zero or more distinct members; `Set1<T>` requires at least one.
All newly introduced collections are sets, including nested reference and category collections.
There are no new sequences.

`IRI`, `Text`, `Boolean` and `Decimal` inherit A2; `Decimal` is a JSON string matching `0|[1-9][0-9]*`, not a JSON number.
`String` is a JSON string subject to the common Unicode and resource rules, without IRI, language-tag, nonempty or other lexical validation unless explicitly stated here.
`Text` and `String` have the same RDF scalar encoding, but their names distinguish their intended roles.
Quoted alternatives are exact case-sensitive token values.
IRI spelling, text, decimal spelling and residual language strings are not normalized by this profile.
Structural language fields continue to use their inherited A2 rules.

The following reference names are local to this supplement; they do not redefine A2 abbreviations such as `D`.

| Reference      | Target collection                                     | Canonical ID prefix                           |
| -------------- | ----------------------------------------------------- | --------------------------------------------- |
| `DocRef`       | `qualifications.documents`                            | `d`                                           |
| `ImportRef`    | `qualifications.imports`                              | `i`                                           |
| `EntryRef`     | `qualifications.entries`                              | `q`                                           |
| `BlankRef`     | `qualifications.sourceNodes`                          | `b`                                           |
| `StatementRef` | `qualifications.sourceStatements`                     | `v`                                           |
| `CoreRef`      | Any primary record in the five structural collections | Its existing `s`, `r`, `x`, `c` or `o` prefix |

Normalized source handles are nonempty strings and unique across all ten primary collections.
Their spelling has no RDF identity significance.
After issuance, every ID is its category prefix followed by its contiguous zero-based decimal rank, without leading zeros.
Reference fields are resolved by declared type, never guessed from string contents.

## 3. Closed portable grammar

The canonical envelope contains exactly `profile:IRI`, `structural:Structural`, `visualization:Visualization` and `qualifications:Qualifications`.
`profile` equals the IRI in section 1.
`Structural` and `Visualization` are the complete inherited artifact grammar and projection, including existing annotation, literal and state rules.
The normalized input envelope omits only `profile`; profile selection supplies it before mapping.

| Record            | Exact fields                                                                                                                                                                                                                                                                                           |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Qualifications`  | `documents:Set1<Document>`, `imports:Set<Import>`, `entries:Set<Entry>`, `sourceNodes:Set<SourceNode>`, `sourceStatements:Set<SourceStatement>`                                                                                                                                                        |
| `Document`        | `id:DocRef`, `ontologyIri?:IRI`, `versionIri?:IRI`, `root:Boolean`, `headers:"unavailable"                                                      \| "none"         \| "one"     \| "multiple"`                                                                                                          |
| `Import`          | `id:ImportRef`, `parentDocument:DocRef`, `requestedIri:IRI`, `targetDocument?:DocRef`, `state:"acquired"                                        \| "unavailable"`                                                                                                                                      |
| `Entry`           | `id:EntryRef`, `dimension:"interpretation"                                                                                                      \| "closure"      \| "profile" \| "lexical"   \| "scope"`, `code:String`, `records:Set<CoreRef>`, `documents:Set<DocRef>`, `rule:IRI`, `detail:Detail` |
| `SourceNode`      | `id:BlankRef`, `document:DocRef`                                                                                                                                                                                                                                                                       |
| `SourceStatement` | `id:StatementRef`, `document:DocRef`, `graph:Graph`, `subject:Resource`, `predicate:IRI`, `object:Term`                                                                                                                                                                                                |

`code` must be nonempty.
Header state and selected IRIs are retained assessment claims; this grammar does not infer missing header IRIs or impose an additional header-state/IRI cardinality rule.
Exactly one document has `root:true`.
An import has `targetDocument` if and only if `state` is `acquired`.
Missing imports are represented explicitly, not repaired by inventing a document.

### 3.1 Detail branches

`Detail` is discriminated by its required `kind` field.
Every row is a separate closed branch; fields from other rows are forbidden.
`PropertyCategory` is the token union `"object"|"data"|"annotation"`.

| `kind`                | Additional fields                                                                                                                                                                                                                                                                                                                                                | Allowed entry dimensions                 |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `"scope"`             | None                                                                                                                                                                                                                                                                                                                                                             | `scope`                                  |
| `"assessment"`        | `status:"invalid"                                                                                                                                                                                                                               \| "unverified"             \| "qualified"`, `iri?:IRI`, `datatype?:IRI`, `entityKind?:String`, `count?:Decimal` | `profile`, `lexical`, `scope`, `closure` |
| `"property"`          | `iri?:IRI`, `subProperty?:IRI`, `superProperty?:IRI`, `declaredCategories?:Set<PropertyCategory>`, `existingCategories?:Set<PropertyCategory>`, `resolvedCategory?:PropertyCategory`, `requestedCategory?:PropertyCategory`, `evidence?:String`                                                                                                                  | `interpretation`                         |
| `"headers"`           | `candidates:Set1<IRI>`, `selected:IRI`                                                                                                                                                                                                                                                                                                                           | `interpretation`                         |
| `"exclusion"`         | `constructor:String`, `unsupported?:String`                                                                                                                                                                                                                                                                                                                      | `scope`                                  |
| `"import"`            | `requestedIri:IRI`                                                                                                                                                                                                                                                                                                                                               | `closure`                                |
| `"source-statements"` | `statements:Set1<StatementRef>`                                                                                                                                                                                                                                                                                                                                  | `scope`                                  |

A `property` detail requires either `iri` or both `subProperty` and `superProperty`.
Both forms may coexist; the predicate is inclusive, not exclusive.
A `headers` detail's `selected` value must occur in `candidates` with exactly the same IRI spelling.
A `scope` detail's code is exactly one of `SOURCE_ASSOCIATIONS_UNAVAILABLE`, `SOURCE_HEADER_ASSOCIATIONS_UNAVAILABLE` or `ORIGINAL_SOURCE_UNAVAILABLE`.
Other detail branches carry a nonempty owning code without a second closed parser-code catalogue in the portable decoder.
Retaining such a code does not certify that a named upstream producer actually issued it.

### 3.2 Portable rule registry and claim boundary

The rule base is exactly `https://haddenindustries.com/ontology/profiles/vowl/compatible-view/v1#`.
Append exactly one of these eight fragments:

- `original-assessment`
- `owning-header-selection`
- `import-acquisition`
- `owning-compatible-interpretation`
- `original-profile-assessment`
- `original-source-assessment`
- `retained-projection`
- `canonical-source`

Rule membership and the detail/dimension table are separate admission checks.
The candidate does not impose a further rule-fragment/detail/dimension cross-product restriction.
The amendment's general phrase “allowed rule/dimension combinations” is made precise by these two checks for portable admission; it does not establish an unlisted matrix.
The section-10 inspection model's nullable rule and selected policy's finite diagnostic registry remain separate from this portable claim container.
Any future proposal to reject additional combinations or owning codes is an admission-policy change, not a wording-only transcription.
Reopening an artifact preserves its claims without granting source authenticity or asserting a fresh OWL profile assessment.

### 3.3 Residual RDF terms

| Shape              | Closed fields                                                                        |
| ------------------ | ------------------------------------------------------------------------------------ |
| IRI resource       | `kind:"iri"`, `iri:IRI`                                                              |
| Anonymous resource | `kind:"blank"`, `node:BlankRef`                                                      |
| Literal term       | `kind:"literal"`, `value:ResidualLiteral`                                            |
| Default graph      | `kind:"default"`                                                                     |
| Unavailable graph  | `kind:"unavailable"`                                                                 |
| `ResidualLiteral`  | `lexical:Text`, `datatype:IRI`, `language:String`, `direction?:"" \| "ltr" \| "rtl"` |

`Resource` is the union of IRI and anonymous resources.
`Term` is `Resource` or literal term.
`Graph` is `Resource`, default graph or unavailable graph.
The unavailable branch is not equivalent to the default branch.
`predicate` is an IRI string, not a boxed resource.
Residual language is a required string, including the empty string; it is not `LanguageTag` and is not converted to lowercase.
Residual datatype/language consistency or lexical datatype validity is not asserted by retention.
Absent `direction` and present empty `direction` are distinct values with distinct field mappings.
Do not convert either to `null`, insert defaults or normalize source spelling.

Every anonymous term in a source statement's subject, object or graph refers to a source node owned by that statement's document.
Every source node must be used by at least one such term.
Document-local source labels choose the same node within one document and different nodes across documents; those source labels are not portable fields.
Residual named or anonymous graph context is boxed data mapped into the internal default graph, not an instruction to place mapping triples in that named graph.

Acquisition may deduplicate exact repeated statements within their source document before constructing normalized input.
Equality includes the owning document, exact graph variant, exact predicate, exact term variants and all present literal fields.
No literal value normalization, cross-document merging or substitution of a different anonymous node is permitted by that deduplication.
Normalized input and portable decoding reject duplicate payloads rather than silently repairing them.

## 4. Qualification invariants

After closed-field checks and the inherited structural/visualization checks, validate qualifications as follows.
This ordered candidate schedule is separate from the original profiles' A7 schedule; do not move its checks into guessed A7 stages.
Within each qualification collection, use complete-member JCS UTF-8 order after recursively sorting its sets with the currently supplied handles.
This preparation is not public ID issuance and does not authorize canonical-byte repair.

1. Index the five existing structural primary collections and then `documents`, `imports`, `entries`, `sourceNodes`, `sourceStatements`.
   Reject empty or globally duplicate qualification IDs with `IDENTIFIER_INVALID`.
   During decoding also require the correct qualification prefix and canonical decimal spelling; rank agreement follows from final recanonicalization.
2. Require exactly one root document; otherwise report `DOCUMENT_TYPE`.
3. In order, check `imports`, `entries` and `sourceStatements` for equal complete payloads after removing only primary `id`.
   Compare nested sets after sorting; reject a repeated payload with `NORMALIZATION_INVALID`.
4. Visit source statements and, within each, subject, object and graph.
   A blank reference missing from `sourceNodes` or owned by another document reports `REFERENCE_INVALID`.
   Then reject unused source nodes with `NORMALIZATION_INVALID`.
5. Check import state/target presence equivalence; report `DOCUMENT_TYPE` on failure.
6. Check entries for nonempty code, rule membership, detail/dimension compatibility and the branch-specific scope-code, property and header conditions from section 3.
   Failures report `DOCUMENT_TYPE`.
7. Traverse qualification fields by UTF-16 field-name order and collection indices, visiting parents before children.
   Resolve every typed reference to the required target category; report `REFERENCE_INVALID` on a missing or wrong-category target.
   At each set reject equal complete JCS member values with `NORMALIZATION_INVALID`.

Distinct source nodes are not collapsed merely because their `document` fields are equal.
Their identity is carried by their complete graph associations.
Distinct document records are likewise not merged solely because their header fields match.
Duplicate checks in step 3 apply only to its three named collections.
There is no additional closed-graph reachability rule requiring every document to be connected through an import from the root.
Such stronger constraints would need a separately stated acceptance change.

## 5. Complete base RDF mapping

Use A6's exact base `m: = https://haddenindustries.com/ontology/vowl/canonical-mapping/v1#`, root, allocation rules and recursive templates.
The compatible profile extends the typed vocabulary only for its own complete document; it does not change the two original profiles.

| Primary collection                | RDF type local name  | Public prefix |
| --------------------------------- | -------------------- | ------------- |
| `structural.subjects`             | `Subject`            | `s`           |
| `structural.roles`                | `Role`               | `r`           |
| `structural.expressions`          | `Expression`         | `x`           |
| `structural.constructs`           | `Construct`          | `c`           |
| `structural.occurrences`          | `Occurrence`         | `o`           |
| `qualifications.documents`        | `CompatibleDocument` | `d`           |
| `qualifications.imports`          | `CompatibleImport`   | `i`           |
| `qualifications.entries`          | `Qualification`      | `q`           |
| `qualifications.sourceNodes`      | `SourceBlankNode`    | `b`           |
| `qualifications.sourceStatements` | `SourceStatement`    | `v`           |

Allocate one distinct blank node for each primary record before encoding references.
Each receives exactly its listed primary RDF type, not an additional `m:Object` type.
Use the fixed named `m:root` for the envelope, typed `m:Object`.
All embedded objects and set containers get fresh blank nodes per owning position, typed `m:Object` and `m:Set` respectively.
Every present field except primary `id` emits `(owner, m:field/NAME, E(value))`; `NAME` is the exact spelling from sections 2–3 or the inherited structural/visualization grammar.
This includes `qualifications`, all five qualification collection names, all branch fields, `kind`, `value` and the selected `profile` IRI.
Omitted optional fields emit no field edge; empty sets still allocate a typed container.
Primary records encode their fields exactly once and their set-membership edges refer to those allocated nodes.

| Declared value type                   | `E(value)`                                                               |
| ------------------------------------- | ------------------------------------------------------------------------ |
| A reference from section 2            | The allocated target primary blank node                                  |
| `IRI`, including `profile` and `rule` | Named node with the exact IRI                                            |
| Any quoted finite token alternative   | Exact token lexical string typed `m:token`                               |
| `String`, `Text`, `Decimal`           | Exact lexical string typed `xsd:string`                                  |
| `Boolean`                             | `true` or `false` typed `xsd:boolean`                                    |
| Inherited binary64 number             | RFC 8785 number spelling typed `m:binary64`                              |
| Embedded object                       | Its fresh typed object node and recursively encoded fields               |
| Set                                   | Its fresh typed set node with an `m:member` edge for each encoded member |

All emitted mapping literals have an empty RDF language string.
The RDF encoding of a residual literal is its boxed object and scalar fields, not a literal coerced to the residual datatype.
For example, the residual datatype is a named-node field value, and its residual language is an `xsd:string` field value, even when empty.
All mapping quads use the default graph.
Input handle spellings, source labels and record/set iteration order do not enter RDF terms.
No deduplication of embedded objects by matching payload is performed during allocation.
Apply inherited sequence-slot mapping only to inherited sequence fields, preserving their order and repetition.

## 6. Exact refinement and category issuance

Let `J(x)` be ECMAScript well-formed `JSON.stringify(x)` without whitespace, `U` UTF-8 encoding and `H` SHA-256 rendered as exactly 64 lowercase hexadecimal characters.
`J` is used for refinement array framing; final document serialization uses RFC 8785.
The private base dataset must contain only default-graph quads and named predicates, with no predicate in `https://haddenindustries.com/ontology/vowl/compatible-mapping/v1#`.
A violation is `DEPENDENCY_FAILURE`, not a caller-selected alternate mapping.

1. For each distinct ground term key prepare `G = ["term", H(U(J(key)))]`.
   Named-node keys are exactly `["iri", iri]`.
   Literal keys are exactly `["literal", lexical, datatypeIRI, languageString]`.
   In this base mapping `languageString` is always `""`; it is neither absent nor `null`.
   Do not substitute the inspection representation's nullable language into this framing.
2. Collect each blank node's incident base quads; a quad mentioning that same node twice contributes once to that node's list.
   A quad connecting two distinct blank nodes contributes once to each list.
   Initialize every color to `""`; the initial distinct-color count is one for a nonempty blank-node set, otherwise zero.
3. With respect to node `b`, a term key is `["self"]` for `b`, `["blank", previousColor]` for another blank node, or its ground key `G`.
   For each incident quad form the **string** `J([subjectKey, predicateKey, objectKey])`.
   Sort those strings by unsigned UTF-16 code-unit lexicographic comparison, shorter prefix first.
4. The next color for `b` is `H(U(J([previousColorOfB, sortedIncidentStrings])))`.
   The second member is an array of strings, not an array of nested quad arrays.
   JSON escapes the quotation marks and backslashes inside those strings again.
   Every node in the round reads only the preceding round; batching or digest reuse cannot change this boundary.
5. Adopt all newly computed colors, then count their distinct values.
   Stop when that count is less than or equal to the previous count; otherwise begin another round.
   The stopping round's newly computed colors are the final colors.
   With no blank nodes, execute zero rounds and add no color triples.
6. Preserve every base quad and append one default-graph triple per blank node with predicate `https://haddenindustries.com/ontology/vowl/compatible-mapping/v1#color`.
   Its object is that node's exact lowercase color string typed `http://www.w3.org/2001/XMLSchema#hexBinary`, with empty language.
   Do not rewrite the lexical value to uppercase.

Base RDF is a dataset, not an arbitrary bag of repeated quad entries.
The normalized mapping allocates fresh auxiliary objects, rejects duplicate set members and emits each primary once, so it does not introduce repeated identical base quads.
Any oracle accepting an external quad-list representation must interpret it as a dataset before applying this algorithm; injecting repeated list entries is not a second permitted profile mapping.

Run RDFC-1.0 with SHA-256 on the complete augmented dataset.
Use the resulting canonical identifier map to partition primary nodes by the ten categories in section 5.
Within each category sort by the numeric ordinal `N` of `c14nN`, not the label's lexical order; issue the listed prefix and contiguous decimal rank starting at zero.
Auxiliary labels participate in whole-dataset RDFC but receive no public IDs.
Replace every declared primary ID and reference with its issued spelling, including qualification-to-core references.
Preserve all ordinary string fields even if they happen to resemble an ID.
Sort all declared sets inside-out by unsigned lexicographic comparison of complete-member RFC 8785 UTF-8 bytes, retaining inherited sequence order.
Serialize the complete document as RFC 8785 UTF-8 without BOM or trailing newline.

Every incident visit for indexing and every round remains charged to embedded work, including reused equal signatures.
Every appended color triple consumes RDF-quad budget.
Ground-key serialization, round scratch limits, cancellation and deadlines retain section 15's accounting rules and the accepted resource amendments.
Optimization is permitted only when it preserves these successful bytes and the documented accounting; equal colors never authorize skipping RDFC or merging nodes.

## 7. Admission and exact decoding

Reuse the existing input snapshot, resource, UTF-8 and duplicate-member rejection rules.
For byte decoding, require an object envelope, then its `profile` and `structural` fields and their string/object types before profile dispatch.
An unknown profile reports `PROFILE_UNKNOWN`.
Validate the selected complete closed envelope before semantic checks.
Normalized source admission uses the corresponding source envelope without `profile`.

Field traversal is parent-first, UTF-16 field-name order and array-index order.
At each object, first check its own object shape, required field presence and unknown field names; missing fields precede unknown fields, with ties ordered by UTF-16 field spelling.
Then validate each present field completely in UTF-16 field-name order before visiting the next field.
A field's JSON type precedes its own finite alternatives, scalar domain and collection bounds; these checks are not global passes across sibling fields.
At each array, check its array shape and collection bounds before visiting members in index order.
Consequently an invalid earlier field value can precede a later sibling's JSON-type error.
Discriminated objects require a string `kind` selecting a listed branch before checking its branch fields.
Errors use `DOCUMENT_REQUIRED_FIELD`, `DOCUMENT_UNKNOWN_FIELD` or `DOCUMENT_TYPE`, with existing named scalar errors such as `IRI_INVALID` and `DECIMAL_INVALID` after scalar JSON-type checks.
After field admission, run inherited structural graph, meaning, projection and complete visualization checks, in that order, then the exact qualification schedule in section 4.
Only then map, refine, label, replace IDs, sort sets and serialize.
Decoding compares the resulting complete bytes with the supplied bytes and reports `NON_CANONICAL_BYTES` on any difference.
It does not return the sorted or repaired candidate on failure.

This schedule intentionally exposes existing candidate precedence instead of promising the original A7 stage placement for added qualification semantics.
For example, an inherited projection failure precedes a qualification reference failure; a wrong root count precedes an import reference failure; import target-presence mismatch precedes the final general reference traversal.
Qualification ID spelling is checked before its semantic schedule, but qualification rank equality is established by the final canonical-byte comparison.
These distinctions require independent negative witnesses before freeze; source inspection alone does not qualify them.

## 8. Independent qualification handoff

An independent producer may read this supplement and its linked authorities, use the already selected RDFC/JCS standards libraries and independently implement the declared mapping/refinement.
It must not read production code, generated production schemas or runtime-produced expected bytes to select expectations.
The producer should retain a compact case collection with complete sources, base and augmented canonical datasets, category correspondences and final canonical bytes, rather than restoring one file per mutation.

Required distinctions include every new field and detail branch, absent versus empty optional fields, empty versus absent direction, exact residual lexical/language spelling, default versus unavailable/named/anonymous graph context, document-local blank-node scope, property-reference alternatives, and every newly typed reference category.
Equivalence witnesses must cover handle renaming and set/document iteration permutations.
Refinement witnesses must distinguish string framing from nested arrays and verify stopping-round colors, self-incidence and persistent symmetry.
Negative witnesses must cover the section-4 schedule and overlaps with inherited errors, plus closed-field, reference, ID, duplicate and resource failures.
Record the field/branch denominator and all unclosed obligations explicitly; passing a compact seed does not establish exhaustive qualification.

This supplement resolves documentation under-specification of the current candidate.
It does not supply independent expectations, broaden an earlier review waiver, authorize another provider run, freeze a profile or publish a package.
