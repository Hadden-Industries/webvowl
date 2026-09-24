# Canonical VOWL projection and artifact contract

An occurrence is an addressable visual projection of retained semantic records, with a deterministic semantic context and no independent copy of their meaning.

**Disposition:** Formulate.
**Status:** Proposed normative design; renderer and conformance qualification remain implementation work.
This annex completes the [design](2026-09-24-canonical-vowl-design.md) and uses the exact types and constructors in the [core contract](2026-09-24-canonical-vowl-core-contract.md).
The local [VOWL 2 specification](../owlapi-js/conformance/upstream/vowl-2/index.html) supplies visual notation and splitting rules.
Rules here that choose a deterministic option or restrict an ambiguous projection are Canonical VOWL decisions, not additional claims about what VOWL 2 itself mandates.

## B1. Occurrence grammar and identity

Each occurrence has `id:O`, `kind:Token`, and exactly the additional fields in this table.
References use the core contract's types and target constraints.

| Kind               | Additional fields                                                                                                             |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `class-node`       | `targets:Set1<C>`, `context?:Context`                                                                                         |
| `datatype-node`    | `target:R` of datatype kind, `context:PropertyContext`                                                                        |
| `property-edge`    | `properties:Set1<R>` of a single property-role kind (`object-property`, `data-property`, or `rdf-property`), `from:O`, `to:O` |
| `inverse-edge`     | `construct:K` of `inverse-properties` kind, `forward:Set1<R>` and `reverse:Set1<R>` of object-property kind, `from:O`, `to:O` |
| `subclass-edge`    | `construct:K` of `subclass` kind, `from:O`, `to:O`                                                                            |
| `disjoint-edge`    | `construct:K` of `disjoint-classes` kind, `ends:Set1<O>` with at most two members                                             |
| `operator-edge`    | `expression:X` of `class-union`, `class-intersection`, or `class-complement` kind, `from:O`, `to:O`                           |
| `restriction-edge` | `construct:K` of `subclass` kind, `from:O`, `to:O`                                                                            |
| `label`            | `edge:O`, `direction:"single"` or `"forward"` or `"reverse"`                                                                  |

`ClassContext` is `{kind:"class",targets:Set1<C>}`.
`PropertyContext` is `{kind:"property",properties:Set1<R>,scope?:K}`.
`Context` is exactly one of those two shapes.
A property's scope is absent for its ordinary domain/range relation and is the originating subclass construct for a restriction relation.
All context arrays are sets of semantic references, not occurrence IDs or producer traversal indices.

The generation key of a node is its complete semantic target/context payload without `id`.
The generation key of an edge is its semantic target plus its endpoint node generation keys, with unordered endpoints for a disjoint edge.
The generation key of a label is its edge generation key plus direction.
Key equality compares references by their target identities, never by the arbitrary spelling of source handles; it does not require a pre-RDFC stable ordering of anonymous records.
Generate nodes, then edges, then labels; allocate source handles only after their keys are known.
The canonicalizer checks that supplied occurrences are in bijection with the generated keys and replaces references after whole-profile RDFC labelling.
It rejects missing, duplicate, additional, or incorrectly connected occurrences.

These shapes resolve two earlier ambiguities: a shared equivalence glyph refers to a set of roles, and a property relation can project a declared property even when no explicit domain/range construct exists.
An occurrence therefore need not point to exactly one role or one construct.
IRIs, annotations, characteristics, literal values, and expression operands remain in semantic records.
The necessary reference sets are structural addressing, not copied semantic attributes.

## B2. Deterministic projection algorithm

### B2.1 Class groups and drawable terms

A drawable class term is a `class`/`rdf-class` role or a `class-union`, `class-intersection`, or `class-complement` expression.
Other class expressions have no node glyph of their own.
Each operator expression retains its own node so different operators and their operand connections cannot be collapsed into an ambiguous composite symbol.

Build an undirected hypergraph over ordinary named class/RDFS-class roles using their co-membership in each retained `equivalent-classes` construct.
The special generic roles for `owl:Thing` and `rdfs:Resource`, anonymous roles, and expression references are excluded from this grouping graph.
Each connected component yields one `class-node` with exactly that component's role set in `targets`.
An ordinary class role not in any group has a singleton node; an anonymous class role also has a singleton node.
Each drawable operator expression has a singleton node.
No additional equivalence constructs or inferred memberships are produced.

Equivalence involving excluded grouping cases remains visible in details.
This restriction avoids contradicting generic-element splitting or forcing several different expression glyphs into one symbol.
A group containing multiple ordinary named roles still groups those roles even when another member is an expression.
This is a visual grouping of explicitly connected names, not OWL semantic canonicalization.

Pure generic `owl:Thing` and `rdfs:Resource` roles acquire nodes only when needed by a projected relation, using the context rule below.
Unattached generic roles and unattached datatypes remain available in details without empty decorative nodes.

### B2.2 Effective property endpoints

For each named property role, read only its own direct normalized endpoint constructs.
An object property's absent domain/range uses the class role for `owl:Thing`.
A data property's absent domain uses `owl:Thing` and absent range uses the datatype role for `rdfs:Literal`.
A generic RDF property's absent domain/range uses the existing class-kind role for `rdfs:Resource`, creating an `rdf-class` role only if no class-kind role exists.
The adapter includes these required builtin subjects/roles in its normalized source only when a projection needs them; they are part of the signature closure checked by the core.
No default endpoint construct is asserted.

Do not copy endpoints from equivalent or inverse properties.
An inverse property expression used as an endpoint-axiom subject remains a retained fact but is not silently translated into an endpoint axiom for its named operand.
If a supplied endpoint has no drawable node kind, the property relation remains details-only; do not replace a known complex range with a generic endpoint.
Named datatype ranges are drawable through datatype nodes; compound data ranges are details-only in v1.

Build equivalence components separately for object, data, and generic RDF property roles using named-role co-membership in their matching equivalent-property constructs.
Partition each component by exact normalized domain/range terms.
Each nonempty partition is one property projection, with its property-role set and endpoint pair; unequal endpoint pairs never collapse.
An ungrouped property is a singleton partition.
Inverse-expression members of an equivalence group remain in details and do not become named property labels.

### B2.3 Endpoint occurrence contexts

An ordinary class group or operator expression uses its context-free class node.
A datatype endpoint uses one `datatype-node` per `(datatype role, PropertyContext)`.
This includes named user datatypes, not only `rdfs:Literal`.

A generic class endpoint uses one `class-node` with that single target and a `ClassContext` containing the opposite drawable class node's semantic targets.
Here and throughout B2, generic class means a class-kind role over exactly `owl:Thing` or `rdfs:Resource`, independent of whether its kind is `class` or `rdf-class`.
When the opposite endpoint is a datatype, use the relation's `PropertyContext` instead, since there is no opposite class to anchor it to.
Two equal endpoint/context keys reuse one node, including a self-loop; otherwise split nodes remain distinct.
For an operator or disjoint/subclass relation, the opposite class targets give the `ClassContext`.
Ordinary property contexts use the full equivalent-property partition.
Restriction contexts use only the restriction's exact named property role and their subclass construct as `scope`; they do not borrow a global endpoint partition's aliases.
These contexts make the fallback for a missing data-property domain explicit without inventing ontology identity.

### B2.4 Edges and labels

Create one `property-edge` for each drawable property partition, subject to the inverse-pair replacement below.
`from` is its effective domain occurrence and `to` its effective range occurrence.

For each `inverse-properties` construct whose members are named object-property roles, locate their property partitions.
For a singleton member set, use that same member on both sides of the pair.
It has an inverse glyph only when both partitions are drawable and their endpoint terms are exactly reversed.
Orient the pair by comparing the RFC 8785 UTF-8 serialization of each partition's sorted `(subject IRI,role kind)` tuple set; the smaller side is `forward`.
For equal sides the endpoint pair is necessarily a self-loop.
Create one `inverse-edge` per such construct and omit the ordinary property edges of the represented partitions.
A partition involved in more than one explicit inverse pair can have multiple inverse occurrences; their construct references distinguish them.
If an inverse assertion cannot satisfy these conditions, retain it in details and keep any independently drawable ordinary property relation.
No endpoint inference is performed to manufacture an inverse glyph.

For each `subclass` whose two terms are drawable, create a directed `subclass-edge`.
For each `disjoint-classes` group, enumerate unordered pairs of distinct drawable member terms, create their endpoint occurrences using each other as context, and create one `disjoint-edge` per resulting endpoint pair.
A singleton normalized disjointness group or a pair collapsed to one occurrence produces a self-loop, preserving the retained assertion rather than deleting it as inconvenient.
Deduplicate identical endpoint pairs within that construct; never expand the semantic construct into separate pairwise constructs.
Undrawable members remain in details, and the drawing does not claim to display their part of the assertion.

For each drawable class operator, connect its node to the node for each drawable operand using an `operator-edge`.
Deduplicate connections landing on the same class group for the same expression.
Keep every operand in the expression record, including an undrawable operand; details and accessible summaries must expose the complete expression.
A drawing with omitted operands must indicate that its expression details contain additional operands, using a derived cue rather than a new canonical field or invented operand glyph.

A subclass restriction gets a `restriction-edge` only when all these conditions hold:

1. `sub` is a named class/RDFS-class role;
2. `super` is an object/data minimum, maximum, or exact cardinality expression;
3. its property is a named object/data property role, not an inverse expression; and
4. its normalized filler is exactly `owl:Thing` for an object restriction or `rdfs:Literal` for a data restriction.

The edge starts at the subclass's class occurrence and ends at the generic filler occurrence in that scoped property context.
It denotes only that subclass restriction; it is never added to a property's global domain/range or characteristic facts.
Keep one occurrence per retained restriction construct, without combining different bounds.
Display an exact cardinality as `n`, a minimum as `n..*`, and a maximum as `0..n`, using the stored decimal string exactly.
Qualified restrictions and restrictions in other contexts remain details-only.

Create one `label` with direction `single` for each property, subclass, and restriction edge.
Create two labels for an inverse edge, one `forward` and one `reverse`.
Operator and disjoint edges have no independently positionable label.
All class nodes, datatype nodes, and these labels are positionable.
Edge geometry, arrowheads, and disjoint/operator decorations are derived by the renderer and have no independent placements.

Subproperty interaction highlights the ordinary/inverse property occurrences containing the explicitly related named roles, using the appropriate direction on an inverse edge.
Both sides must have such occurrences; inverse-expression arguments or absent projections remain details-only.
Characteristic treatment uses only direct characteristic constructs on the selected named principal of an ordinary property edge or inverse direction.
Characteristics asserted on an inverse expression are not transferred to its operand, and characteristics of nonprincipal members remain in details.
Restriction labels retain their scoped cardinality treatment rather than gaining a second global property glyph.

### B2.5 Exhaustive projection matrix

Each concrete token in these rows has the stated classification.
Every visual classification is conditional on its referenced generation or display rule succeeding; an instance without qualifying treatment is details-only.
There is no implicit default for an unknown kind.
The implementation's machine-readable matrix expands grouped tokens into individual rows without choosing new behavior.

| Semantic kinds                                                                                                                                           | Presentation and occurrence rule                                                                 |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `class`, `rdf-class` roles                                                                                                                               | `visual`: class grouping, generic splitting, and singleton rules in B2.1/B2.3.                   |
| `datatype` roles                                                                                                                                         | `visual` only as an endpoint in a datatype node; otherwise `details-only`.                       |
| `object-property`, `data-property`, `rdf-property` roles                                                                                                 | `visual` through drawable property/inverse partitions; otherwise `details-only`.                 |
| `annotation-property`, `individual` roles                                                                                                                | `details-only`; no ABox/property-metadata glyph.                                                 |
| `class-union`, `class-intersection`, `class-complement`                                                                                                  | `visual`: operator node and operand edges.                                                       |
| `class-enumeration`, `object-some`, `object-all`, `object-value`, `object-self`, `data-some`, `data-all`, `data-value`, `object-inverse`                 | `details-only`; no standalone expression node.                                                   |
| `object-min-cardinality`, `object-max-cardinality`, `object-exact-cardinality`, `data-min-cardinality`, `data-max-cardinality`, `data-exact-cardinality` | `visual` only through an eligible subclass restriction edge; otherwise `details-only`.           |
| `data-intersection`, `data-union`, `data-complement`, `data-enumeration`, `datatype-restriction`                                                         | `details-only`.                                                                                  |
| `subclass`                                                                                                                                               | `visual` as subclass/restriction edge under B2.4, otherwise `details-only`.                      |
| `equivalent-classes`                                                                                                                                     | `visual` through the named-role grouping only; other equivalence facts are `details-only`.       |
| `disjoint-classes`                                                                                                                                       | `visual` for drawable member pairs/self-loops; undrawable members remain in details.             |
| `equivalent-object-properties`, `equivalent-data-properties`, `equivalent-rdf-properties`                                                                | `visual` through property partitions; no extra equivalence edge.                                 |
| `inverse-properties`                                                                                                                                     | `visual` only under the exact reversed-endpoint rule, otherwise `details-only`.                  |
| `object-domain`, `object-range`, `data-domain`, `data-range`, `rdf-domain`, `rdf-range`                                                                  | `visual` through effective property endpoints when drawable; no extra semantic copies.           |
| `sub-object-property`, `sub-data-property`, `sub-rdf-property`                                                                                           | `visual` as VOWL 2's property interaction highlighting, with no additional canonical occurrence. |
| `object-characteristic` with functional/inverse-functional/symmetric/transitive value; `data-characteristic`; `rdf-characteristic`                       | `visual` as VOWL 2 property treatment, no separate occurrence.                                   |
| `object-characteristic` with reflexive/irreflexive/asymmetric value                                                                                      | `details-only`.                                                                                  |
| `disjoint-union`, `disjoint-object-properties`, `disjoint-data-properties`, `disjoint-rdf-properties`, `property-chain`, `datatype-definition`, `key`    | `details-only`.                                                                                  |
| `sub-annotation-property`, `annotation-domain`, `annotation-range`, `annotation-assertion`, `assertion-anchor`, `class-membership`                       | `details-only`, including direct individual listings.                                            |
| Root ontology metadata, imports, all annotations and literal branches                                                                                    | `details-only` or derived label/header text; no independent graph occurrence.                    |

The matrix reserves classification `extension` for a separately specified future notation profile; v1 contains no extension glyph rows.
Retaining a structure beyond VOWL 2's visual vocabulary does not itself create an extension glyph.
Published matrix rows include their exact token, condition, occurrence kind or `none`, generation-rule reference, and VOWL 2 authority or Canonical VOWL restriction rationale.

## B3. Artifact grammar

The artifact's required `visualization` is exactly:

```text
{
  placements: Set<Placement>,
  camera: Camera,
  hidden: Set<O>,
  labelSelection: LabelSelection,
  prefixes: Set<PrefixBinding>,
  display: Display
}
```

| Record             | Closed fields                                                                                           |
| ------------------ | ------------------------------------------------------------------------------------------------------- |
| Placement          | `occurrence:O`, `position:Point`, `pinned:Boolean`                                                      |
| Point              | `x:Number`, `y:Number`                                                                                  |
| Camera             | `center:Point`, `zoom:Number` greater than zero                                                         |
| IRI selection      | `mode:"iri"`                                                                                            |
| Untagged selection | `mode:"untagged"`                                                                                       |
| Language selection | `mode:"language"`, `range:Text`                                                                         |
| PrefixBinding      | `prefix:Text`, `iri:IRI`                                                                                |
| Display            | `compactNotation:Boolean`, `nodeScaling:"uniform"` or `"direct-membership"`, `externalColoring:Boolean` |

`LabelSelection` has exactly the three selection branches above.
All display values are explicit; no omitted value takes its meaning from a WebVOWL preference, device locale, or future application default.
Structural documents contain none of these fields.
Converting a structural document to an artifact requires caller-supplied complete visualization state, not a canonicalizer-chosen layout.

There is exactly one placement for every positionable occurrence, including hidden ones, and no placement for any edge.
No coordinates are inferred, quantized, or filled with zero.
Placements are a set keyed by occurrence reference, not an ordered node list.
The hidden set may contain any occurrence; it must be closed under incidence: hiding a node hides its incident edges, and hiding an edge hides its labels.
Hiding a label does not hide its edge.
The state adapter computes this effective closure before calling the core; the core rejects an incomplete closure.
This is the final hidden set, not filter controls or a second stored visibility result.

The scene restores paused.
Camera center is in canvas units; for viewport center `(w/2,h/2)` a point projects to `(w/2 + zoom*(x-center.x), h/2 + zoom*(y-center.y))` before renderer-specific styling.
Viewport dimensions are inputs to rendering, not canonical state.
Legacy translation `(tx,ty)` at scale `z` converts to `center=((w/2-tx)/z,(h/2-ty)/z)` only when the corresponding viewport is known.

## B4. Label, prefix, and language selection

Candidate labels are values of retained `rdfs:label` annotation assertions on the target subject, restricted to language literals and typed `xsd:string` literals.
Axiom-annotation labels and labels on unrelated occurrences are not candidates.
Lexically equal candidates deduplicate for selection only; the canonical assertion/anchor records are preserved.

For a grouped class/property glyph, select its principal named member by local-before-external classification from B5, then by unsigned UTF-8 order of its complete IRI, then by role-kind token.
This choice is independent of local IDs, artifact coordinates, and whether external coloring is enabled.
Display remaining equivalent names as a canonically ordered alias list; truncation for available pixels is renderer state and must not change underlying labels or bytes.
Order aliases by their full subject IRIs in unsigned UTF-8 order, then role kind, rather than by the selected human-language text.
The principal member also determines the grouped glyph's class/property kind and characteristic treatment; each remaining member's exact characteristics stay available in details.
An inverse edge applies that rule separately in its two directions; no union of different members' characteristics is asserted.
An anonymous class has its own annotation candidates; an operator has its fixed `union`, `intersection`, or `complement` meaning and corresponding VOWL symbol.

`mode:"iri"` selects the full IRI for a named target, bypassing labels and prefixes.
For a target with no IRI it selects the applicable fixed kind name (`anonymous class`, `union`, `intersection`, or `complement`), never the producer handle.

`mode:"untagged"` selects the least candidate typed `xsd:string` value by its complete RFC 8785 UTF-8 bytes.
If absent, use the IRI-derived fallback below.

`mode:"language"` uses a single lowercased RFC 4647 basic language range, including `*` but excluding embedded wildcards and quality weights.
Perform exact tag lookup at each RFC 4647 lookup truncation step, removing a trailing singleton together with its extension/private-use subtag as specified there.
Do not expand a less-specific request into an arbitrary more-specific tag.
At the first matching tag choose the least complete literal by RFC 8785 UTF-8 bytes.
The `*` range goes directly to the default.
The default is the untagged selection and then the IRI-derived fallback; English is not an implicit preferred language.
For example, `zh-hant-tw` tries that tag, `zh-hant`, then `zh`; `en` does not arbitrarily choose between only `en-gb` and `en-us`.

The IRI-derived fallback is deterministic:

1. Use fixed builtin names `Thing`, `Nothing`, `Resource`, and `Literal` for those exact IRIs.
2. Otherwise, among effective prefix bindings that are exact lexical prefixes of the IRI and leave a nonempty suffix without `:`, `/`, `#`, or whitespace, choose the longest IRI prefix measured in Unicode scalar values, breaking ties by unsigned UTF-8 order of `prefix`; display `prefix:suffix`.
3. Otherwise use the nonempty lexical suffix after the last `#`, `/`, or `:`; do not percent-decode it.
4. If that suffix is empty, use the full IRI; for an unnamed target use its fixed kind name.

Prefix names are either empty or match `[A-Za-z][A-Za-z0-9_-]*`; names are unique and case-sensitive.
An empty prefix displays `:suffix`.
Different prefixes may bind the same IRI; the tie-break above resolves display without deleting active bindings.
The map stores effective display bindings supplied by the state adapter, not a copy of all source-syntax namespace declarations.
Text shortening never changes semantic IRIs.
For this rule whitespace is the fixed set U+0009–U+000D, U+0020, U+0085, U+00A0, U+1680, U+2000–U+200A, U+2028, U+2029, U+202F, U+205F, and U+3000; a runtime's changing Unicode/regular-expression tables do not define it.

Subclass labels use the fixed phrase `Subclass of`; operator symbols and cardinality spellings follow B2.
Property and inverse-direction labels use their selected property member names.
Restriction labels use their exact property's selected name and the cardinality spelling in B2.4.
Annotation labels and aliases are not serialized again into occurrences.

## B5. Externality and display modes

Externality is a lexical presentation classification, not ownership, imports membership, or retrieval provenance.
An anonymous root ontology or unnamed subject is never classified as external.
A subject whose full IRI equals the root ontology IRI is local.

Parse scheme, authority, path, query, and fragment boundaries using the IRI grammar without rewriting any component.
Define `trimPath` to remove exactly one final `/` or `:` from a path, if present; it never trims the scheme delimiter, authority, or query.
The root namespace key is its original scheme/authority prefix, `trimPath(path)`, and its original query including `?` if present; omit the fragment including `#`.
For a subject with a fragment, form its key by that same rule.
For a subject without a fragment, locate the last `/` in its path; if there is none and no authority, locate the last `:` in its path instead.
If a separator exists, discard that separator and the following path text, including an empty final segment; otherwise keep the full path.
Then apply `trimPath` to the remaining path and concatenate the unchanged scheme/authority prefix and query.
Compare keys as exact strings, with query text retained and no URL normalization.
This gives `https://example.org/o#A` and `https://example.org/o/A` the key `https://example.org/o`, while `https://example.org/o/sub/A` has a different key.
For a root `urn:example:ontology`, the subject `urn:example:ontology:Class` has the root's key.
These are namespace heuristics fixed by the profile, not assertions of Web-resource equivalence.

| Root ontology IRI             | Subject IRI                     | External before builtin exemptions?                                         |
| ----------------------------- | ------------------------------- | --------------------------------------------------------------------------- |
| `https://example.org/o/`      | `https://example.org/o/#A`      | No. Both keys are `https://example.org/o`.                                  |
| `https://example.org/o?rev=1` | `https://example.org/o/A?rev=1` | No. Both keys retain `?rev=1`.                                              |
| `https://example.org/o?rev=1` | `https://example.org/o/A?rev=2` | Yes. Query spelling differs.                                                |
| `https://EXAMPLE.org/o`       | `https://example.org/o#A`       | Yes. Authority case is not folded.                                          |
| `https://example.org/o`       | `https://example.org/o/A/`      | Yes. Removing the empty final segment leaves key `https://example.org/o/A`. |

The following exact builtins are classified as local and exempt from external coloring, regardless of their namespace key.
Prefixes in this table are notation for full standard IRIs, not compact values in instances.

| Namespace                                     | Exact exempt local names                                                                                                                                                                                                                                                                                                                                                                 |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `http://www.w3.org/2002/07/owl#`              | `Thing`, `Nothing`, `topObjectProperty`, `bottomObjectProperty`, `topDataProperty`, `bottomDataProperty`, `real`, `rational`, `versionInfo`, `priorVersion`, `backwardCompatibleWith`, `incompatibleWith`, `deprecated`                                                                                                                                                                  |
| `http://www.w3.org/2000/01/rdf-schema#`       | `Resource`, `Class`, `Datatype`, `Literal`, `label`, `comment`, `seeAlso`, `isDefinedBy`                                                                                                                                                                                                                                                                                                 |
| `http://www.w3.org/1999/02/22-rdf-syntax-ns#` | `Property`, `type`, `PlainLiteral`, `XMLLiteral`, `langString`                                                                                                                                                                                                                                                                                                                           |
| `http://www.w3.org/2001/XMLSchema#`           | `anyURI`, `base64Binary`, `boolean`, `byte`, `dateTime`, `dateTimeStamp`, `decimal`, `double`, `float`, `hexBinary`, `int`, `integer`, `language`, `long`, `Name`, `NCName`, `negativeInteger`, `NMTOKEN`, `nonNegativeInteger`, `nonPositiveInteger`, `normalizedString`, `positiveInteger`, `short`, `string`, `token`, `unsignedByte`, `unsignedInt`, `unsignedLong`, `unsignedShort` |

There is no blanket exemption for every IRI beginning with one of these namespaces.
For a grouped glyph, the principal member determines its external style; details retain every member's classification.

`externalColoring:false` suppresses that style distinction, not the classification or the label-priority rule.
`compactNotation:true` suppresses redundant generic type words and the fixed `Subclass of` phrase when the standard glyph already expresses them.
It never suppresses selected entity names, equivalent aliases as data, explicit cardinality values, or a characteristic's only visual indication.
Compact mode changes notation content, not occurrence topology or the explicit hidden set; all label placements remain required.
With compact notation off, type/characteristic words use the fixed role/characteristic tokens with hyphens displayed as spaces, ordered by unsigned UTF-8 token order.

`nodeScaling:"uniform"` uses the renderer's baseline class radius `R` for ordinary class nodes, including operator nodes.
`nodeScaling:"direct-membership"` uses radius factor `1 + min(3, log2(1+n)/4)` for an ordinary class node, where `n` is the number of distinct individual roles directly asserted as members of its exact target terms.
For an equivalence group take the union of those direct individual sets, without `sameAs`, subclass, or reasoner inference; hidden individuals/facts do not change the count.
The factor is 1 at zero, 2 at 15, 3 at 255, and capped at 4 from 4095.
Pure generic `owl:Thing`/`rdfs:Resource` nodes use fixed radius `0.6R` and are not scaled.
Datatype rectangles and movable labels are not class-count-scaled.
`R`, font metrics, colors, line routing, and pixel-level rendering remain renderer style; the artifact is not a promise of pixel-identical output.

## B6. Qualification obligations

The implementation plan must turn every generation rule and every matrix token into a fixture, including conditional details-only cases.
Required cases include named equivalence components; expression/generic exclusions from grouping; unequal equivalent-property endpoints; matched and unmatched inverse endpoints; self-loops; generic nodes shared by context and split across contexts; per-property datatypes; partial operator projections; and eligible/ineligible cardinality contexts.
Tests must compare full topology and semantic reference sets before checking local IDs.

Artifact fixtures cover complete placements, duplicate/missing placement rejection, visibility closure, camera conversion, all display values, label fallbacks, same-priority Unicode labels, escaped language tags, prefix ties, namespace keys, builtin exceptions, direct membership deduplication, and symmetric nodes with exchanged coordinates.
They must prove that changing state can relabel structural IDs while preserving the underlying semantic model.

Application qualification additionally provides keyboard access, meaningful labels and relationship summaries, full text alternatives for partial/details-only projections, and alternatives to color-only meaning.
These are renderer obligations; passing canonical conformance is not a WCAG conformance claim.
The independent conformance corpus records the topology/state decisions, while browser tests separately verify paused restoration and accessible interaction.
