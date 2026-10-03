# Canonical VOWL experimental legacy ingress contract

Status: source-derived implementation contract for SLICE-004; not a completed migration qualification, independent-provider approval, profile freeze, or application cutover.
This supplements, and does not alter, the pinned [dialect inventory](canonical-vowl-legacy-dialect-inventory.md).

The only dialect is `webvowl-legacy-354ed3af8c1e82019f6280b2594acaceac96cca0`.
Source references below mean Git blobs at that exact commit.
`builder` means `src/owl2vowl/js/vowlBuilder.js`; `document` means `src/app/js/controller/vowlDocument.js`; `settings` means `src/app/js/controller/vowlVisualizationSettings.js`; `parser` means `src/webvowl/js/parser.js`; `runtime` means `src/webvowl/js/runtime/renderedGraphInternals.js`.
A9.3 and B3–B5 remain authoritative.

## Scope and error rules

Migration retains the unambiguous represented legacy facts; it does not reconstruct omitted OWL axioms.
A known lossy constructor cannot be presented as its complete source expression.
In particular, arbitrary property endpoints, operator operands, restriction scopes/fillers, untagged annotation datatypes, and unidentified counted members cannot be invented.

The closed grammar below includes recognized fatal branches so their rejection has a specific reason.
Unknown fields, unsupported shapes, conflicting parallel fields, dangling references, and unrecoverable distinctions fail with `MIGRATION_AMBIGUOUS` at their source pointer.
They are not ignored.
No acquisition URL supplies an ontology IRI.
No automatic dialect detection, external fetch, rendering, layout, or runtime application import is needed.

Every discarded noncanonical field receives `MIGRATION_DROPPED_FIELD`.
A dropped container may cover its wholly discarded subtree; if some children are retained, diagnose each discarded child instead.
Diagnostics use original JSON Pointers, including `~0`/`~1` escaping.
Deduplicate and sort diagnostics by each complete record's JCS bytes in unsigned UTF-8 order, following A9.2.
A diagnostic never enters canonical bytes.

Only these resolutions are admitted:

| Kind                   | Exact unresolved location                                                     | Meaning                                                                                                                                 |
| ---------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `ontology-iri`         | `/header/iri`                                                                 | Supplies absent or empty root identity. This is the designated missing-field pointer even if `header` is absent.                        |
| `annotation-predicate` | The individual annotation item, or one predicate-less localized summary value | Supplies that annotation's complete predicate IRI; it does not supply its datatype, category, value, or a collision bucket's predicate. |
| `viewport`             | `/settings/global/translation`                                                | Supplies positive finite width/height for the saved translation and zoom.                                                               |

Resolution fields are closed as in A9.3.
Duplicate `(kind,sourcePointer)`, malformed, unused, conflicting, wrong-kind, or already-resolved entries fail with `MIGRATION_RESOLUTION_INVALID`.
A successful consumed resolution emits `MIGRATION_RESOLVED_FIELD`.
No resolution overrides a valid supplied IRI or the explicit anonymous-root sentinel.

## Closed input grammar and field dispositions

All objects are ordinary JSON records.
`Text` is well-formed Unicode text; `IRI` obeys the canonical lexical IRI domain.
`ID` is a nonempty string or nonnegative safe integer, used only for operation-local joins.
Preserve ID type while joining; reject duplicate IDs and string-coercion collisions across drawable collections.
Each base record has exactly one attribute partner in its own collection, and every attribute partner has a base record.
A repeated field across partners must agree exactly; conflicting values are fatal.
Traversal IDs are discarded only after references and state correspondence have been established.

Top-level keys are exactly `_comment`, `header`, `metrics`, `namespace`, `class`, `classAttribute`, `datatype`, `datatypeAttribute`, `property`, `propertyAttribute`, and `settings`.
Absent collection pairs mean empty collections; one missing half of a nonempty pair is fatal.
Present collection fields are arrays.
`_comment` is text and is dropped; it is never producer authentication.
The exporter copies other stored fields unchanged (`visualizationArtifactService.js:412–473`), which is why unlisted top-level fields are fatal rather than accepted by an exporter version claim.

| Object / field                        | Shape                                             | Disposition                                                                                                                                                                                                   |
| ------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `header.iri`                          | IRI, `""`, or exact `"No IRI set"`; may be absent | Retain valid IRI. Empty/absent requires the root resolution. Exact sentinel means an anonymous ontology, with no invented IRI. Other invalid text is fatal. Builder finalizes the sentinel at 1621–1626.      |
| `header.imports`                      | Array of IRIs                                     | Retain direct imports as a set; do not load them. Absent means none represented.                                                                                                                              |
| `header.labels`, `header.comments`    | Localized text maps                               | Retain represented recoverable `rdfs:label` / `rdfs:comment` values by the annotation rules below. Empty maps drop.                                                                                           |
| `header.other`                        | Annotation map                                    | Retain ontology annotations, not entity assertions. Nested annotations retain their attachment.                                                                                                               |
| `header.title`, `header.description`  | Localized text map, or legacy edited string       | Compare against retained generic items first; drop only proven redundant summaries. A remaining language-tagged value may use an exact predicate resolution. Untagged values with unknown datatype are fatal. |
| `header.author`                       | Array of text, or edited text                     | Drop empty or proven redundant summary values; other nonempty values lack both exact predicate and literal datatype and are fatal. Do not split an edited string into guessed authors.                        |
| `header.version`                      | Text                                              | Empty/proven redundant summary drops. Otherwise fatal: neither its predicate nor datatype is established. It is never `versionIri`.                                                                           |
| `header.baseIris`, `header.languages` | Arrays of text                                    | Derived inventories; drop. They do not establish semantic or display identities.                                                                                                                              |
| `header.prefixList`                   | Map from text name to IRI                         | Structural profile: drop. Artifact profile: use the effective-prefix rule below.                                                                                                                              |
| `namespace`                           | Array of exactly `{name:Text,iri:IRI}`            | Structural profile: drop. Artifact profile: use the effective-prefix rule below.                                                                                                                              |
| `metrics`                             | Closed record of nonnegative safe integers        | Drop. Keys: `classCount`, `datatypeCount`, `datatypePropertyCount`, `individualCount`, `nodeCount`, `objectPropertyCount`, `propertyCount`. Metrics never create roles or memberships.                        |

The header has no keys beyond those in this table.
Builder 355–372 establishes its initial shape; 1295–1337 shows the annotation/summary split.
Document 293–314 permits metadata summaries to be edited independently, so matching field names do not justify invented Dublin Core IRIs or discarding contradictory text.

Base and attribute records use only the following combined keys: `id`, `type`, `iri`, `baseIri`, `label`, `comment`, `description`, `annotations`, `attributes`, `instances`, `individuals`, `equivalent`, `union`, `intersection`, `complement`, `disjointUnion`, `domain`, `range`, `inverse`, `subproperty`, `superproperty`, `cardinality`, `minCardinality`, `maxCardinality`, `pos`, and `pinned`.
The base requires `id` and `type:Text`; the attribute partner requires `id`.
Kind-specific restrictions follow; the union of keys is not permission to put property fields on a class.

| Record information                                                                                         | Disposition                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Named `owl:Class` / `owl:equivalentClass` with full IRI                                                    | Retain a class subject/role. An equivalent type requires represented equivalent references; it is not an extra assertion by itself.                                                                                                                                                                                                                                                                                                                                                                  |
| Named `rdfs:Class`                                                                                         | Retain an `rdf-class` role; do not convert its category to OWL class. The pinned node implementation declares `rdfs:Class` and the `rdf` style.                                                                                                                                                                                                                                                                                                                                                      |
| Exact `owl:Thing`, `owl:Nothing`, `rdfs:Resource`, `rdfs:Literal`                                          | Require their exact standard IRI and retain the applicable class, RDF-class, or datatype role. They are not arbitrary names.                                                                                                                                                                                                                                                                                                                                                                         |
| `rdfs:Datatype` with full IRI                                                                              | Retain datatype role; no datatype definition is inferred.                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `equivalent:Array<ID>` on named class records                                                              | Recover only unambiguous binary assertions, not an invented n-ary group or transitive closure. All targets must have the same class category; no missing target or guessed anonymous member. A complete triangle is fatal because a single n-ary axiom and three binary axioms have the same legacy pair representation. A triangle-free graph can retain each represented binary pair separately. Projection may subsequently group its connected component; the assertion records remain distinct. |
| `rdfs:subClassOf` / pinned `rdfs:SubClassOf` property record                                               | Require named class domain/range; retain subclass assertion. Its standard IRI, optional fixed `Subclass of` label, and `transitive` marker are structural/presentation redundancy, not an object-property declaration.                                                                                                                                                                                                                                                                               |
| `owl:disjointWith` property record                                                                         | Require named class domain/range and an unambiguous binary-pair graph; a complete triangle is fatal for the same lost n-ary grouping reason. Retain each binary disjoint pair separately. Its `anonymous`/`object` markers do not make the endpoint classes anonymous or create an object-property role.                                                                                                                                                                                             |
| Ordinary object/data/RDF property with `domain`/`range`, inverse-derived endpoints, or restriction markers | Fatal: authored/default/inverse-derived provenance is not encoded (builder 409–442, 654–674). Do not translate every line into domain/range assertions.                                                                                                                                                                                                                                                                                                                                              |
| Operator types or nonempty `union`, `intersection`, `complement`, `disjointUnion`                          | Fatal: builder 511–540 can omit/collapse operands, and 1118–1145 can replace an operand with a generic fallback. The exported list does not attest a complete source expression.                                                                                                                                                                                                                                                                                                                     |
| `owl:someValuesFrom`, `owl:allValuesFrom`, or any cardinality field                                        | Fatal: restriction scope, property-expression direction, filler, or exact bound may have been lost (builder 931–1094, 1537–1570). A parseable decimal does not repair lost scope.                                                                                                                                                                                                                                                                                                                    |
| `inverse`, `subproperty`, `superproperty` or property `equivalent`                                         | Recognized, but fatal when their owning property branch cannot establish its required semantic record without endpoint/provenance guessing. No half-migrated record is returned.                                                                                                                                                                                                                                                                                                                     |
| `iri` on named records                                                                                     | Full lexical IRI required; do not expand a possible CURIE or normalize percent escapes. `baseIri` is presentation and drops.                                                                                                                                                                                                                                                                                                                                                                         |
| Class `individuals`                                                                                        | Array of closed `{iri,baseIri?,labels?,comment?,description?,annotations?}` objects. Retain each exact named individual role and direct membership in the owning named class; use the annotation rules on its metadata. Deduplicate identical named membership, not distinct individual IRIs.                                                                                                                                                                                                        |
| `instances`                                                                                                | Nonnegative safe integer. Zero drops. Positive is fatal: it counts punned class/individual members without their identities, not the length of `individuals` (builder 727–754).                                                                                                                                                                                                                                                                                                                      |
| `attributes:Array<Text>`                                                                                   | Drop proven type/style markers (`external`, `rdf`, `datatype`, class `equivalent`, subclass `transitive`, disjoint `anonymous`/`object`) only in their matching branches. Unknown or misplaced markers are fatal.                                                                                                                                                                                                                                                                                    |
| `deprecated` marker / `owl:DeprecatedClass`                                                                | Fatal unless an independently retained exact annotation establishes the same deprecation fact; no guessed `xsd:boolean` literal. Builder 1457–1471 erases the literal branch/datatype, and document 760–785 can toggle the marker independently. Proven redundant marker drops.                                                                                                                                                                                                                      |
| Class/entity `label`, `comment`, `description`, `annotations`; individual `labels`                         | Apply the annotation rules below.                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `pos` and `pinned`                                                                                         | `pos` is exactly two finite numbers; `pinned` is Boolean. Structural profile drops these. Artifact profile retains only through total, unambiguous occurrence correspondence.                                                                                                                                                                                                                                                                                                                        |

Relation-label metadata is admitted only when empty or proven fixed presentation, such as `Subclass of`.
Other nonempty relation labels, comments, descriptions, or annotation maps fail: a legacy line does not establish whether they describe that relationship assertion or the standard property IRI.
They must not become invented annotation assertions on `rdfs:subClassOf` or `owl:disjointWith`.

Accept the ASCII case variants of the listed legacy type tokens that the pinned parser handles case-insensitively; this is not arbitrary type-IRI expansion.
No anonymous class category is inferred merely from a missing IRI or an `anonymous` style marker.
Recognized nonsemantic empty arrays/objects drop; an empty semantic constructor or missing required endpoint still fails.

The separate fixture author compared paired inputs through the pinned builder and serializer: `EquivalentClasses(A B C)` and its three binary pairs produce identical complete 1,771-byte outputs; the analogous disjoint inputs produce identical 2,027-byte outputs.
Triangle rejection therefore follows an observed collision, not a hypothetical preference.
Each n-ary set of three or more distinct retained named terms contributes a complete triangle; in a triangle-free pair graph only binary assertions can supply those represented links.
Detect triangles after resolving semantic named identities, not by counting traversal IDs.
A connected component of three nodes is not by itself ambiguous when it is only a chain.

## Annotation and summary interpretation

An annotation map is a record whose values are arrays of closed items.
Item fields are `identifier:Text`, optional `predicateNs:Text`, `type:"iri"|"label"`, `value:Text`, `language:Text` only for `label`, and optional recursively shaped `annotations`.
The bucket key and `identifier` must agree.
A predicate resolution belongs to the item pointer, never to the map or array.

`builder:125–142,167–202` percent-decodes local names.
Consequently `predicateNs + identifier` does not prove the original lexical predicate IRI, even when the identifier happens to contain ordinary ASCII: `%61` and `a` can collide.
Require explicit predicate resolution unless the represented empty-namespace/full-IRI fallback is exact (`predicateNs:""`, key and identifier equal the complete IRI, and its final local part is empty).
Validate supplied full predicate identity; do not silently reconstruct lost escaping.
Resolution does not excuse inconsistent field types.

| Value                                                                              | Retained meaning                                                                                                                                                                                                                                                                             |
| ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `type:"iri"`, absolute IRI value                                                   | Exact IRI annotation value. Merely appearing here does not create an entity role.                                                                                                                                                                                                            |
| `type:"iri"`, nonempty `_:token`                                                   | Anonymous annotation subject. Equal exact tokens within this legacy input use the same operation-local anonymous subject; different tokens remain distinct. They are not named IRIs or automatically individual roles. No correspondence to a separately loaded source document is asserted. |
| `type:"label"`, valid nonempty language tag other than `undefined`                 | Language literal with exact lexical text and canonical language-tag normalization.                                                                                                                                                                                                           |
| `type:"label"`, `language:"undefined"`, absent/empty language, or invalid language | Fatal: the datatype/branch was not preserved, and A9.3 offers no datatype resolution.                                                                                                                                                                                                        |

For dedicated entity/header label and comment maps, predicate identity is fixed (`rdfs:label` / `rdfs:comment`), but language/datatype rules still apply.
Strings and `undefined` entries are not automatically `xsd:string`.
A generated `IRI-based` entry drops only if it exactly equals the builder's decoded local-name result for the retained IRI.
The exact builtin label shapes at builder 271–281 are likewise proven presentation.
A different `IRI-based` string is a possibly edited label with no retained literal branch and fails; do not discard it as generated.

A nonempty language-tagged `description` or title summary whose predicate is otherwise missing can consume an `annotation-predicate` resolution at that specific localized value.
A summary already matching a retained generic literal of the appropriate local-name family is redundant and drops; an attempted resolution there is unused.
Comparisons include value branch, lexical text and language where the summary represents language.
`title`, `description`, `author`/`creator`, and `versionInfo` are local-name families, not authority to choose a namespace. Known label/comment generic duplicates deduplicate with their dedicated assertions, retaining any assertion anchor.

Entity item `annotations` annotate that exact annotation assertion and create its assertion anchor; they never become annotations of the containing entity.
Ontology annotation nesting remains annotation nesting.
Retain every represented nesting level; do not invent levels omitted by builder 212–228.
Recursive input is bounded by the shared operation limits.

## Complete artifact state

Structural migration does not depend on recoverable display state and diagnoses discarded `settings`, positions/pins and prefix fields. Artifact migration requires state sufficient to construct every B3 field explicitly. It never fills missing coordinates or pins from parser/runtime defaults.

`settings` has only `global`, `gravity`, `filter`, `modes`:

| Settings object | Closed fields and mapping                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `global`        | `language:Text`, `zoom:Number` (finite, positive), `translation:[Number,Number]` (finite) required for artifact; optional `paused:Boolean` drops because canonical restoration is paused.                                                                                                                                                                                                                                                                                                                 |
| `gravity`       | Optional finite `classDistance`, `datatypeDistance`; both drop as force parameters.                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `filter`        | Artifact requires nonnegative safe-integer `degreeSliderValue` and complete `checkBox` array. Each entry is exactly `{id,checked:Boolean}`. Exactly one each of `datatypeFilterCheckbox`, `objectPropertyFilterCheckbox`, `subclassFilterCheckbox`, `disjointFilterCheckbox`, `setoperatorFilterCheckbox`; duplicate/unknown IDs fail. Checked means hide.                                                                                                                                                |
| `modes`         | `checkBox` entries have the same closed shape. Artifact requires exactly one each of `nodescalingModuleCheckbox`, `compactnotationModuleCheckbox`, `colorexternalsModuleCheckbox`; they map respectively to `direct-membership`/`uniform`, `compactNotation`, `externalColoring`. Optional `pickandpinModuleCheckbox`, `labelWidthModuleCheckbox` drop as interaction/style choices. Optional Boolean `colorSwitchState` and finite `maxLabelWidth` drop as renderer styling. Duplicate/unknown IDs fail. |

Historical numeric strings are accepted only at saved numeric settings locations, because settings 35–44 deliberately decodes them.
Require nonempty, finite numeric value and the applicable scalar domain; conversion must not silently round an out-of-safe-range degree.
Record positions and canonical numbers are not generalized string-coercion sites.

The three canonical modes preserve explicitly saved mode intent.
B5 supplies the canonical externality and radius formulas; this is not a claim that the old radius, gradient, fonts, or pixels are preserved.
Missing canonical mode choices are fatal, even if a historical default could be guessed.

### Label selection and prefixes

Map saved `IRI-based` to `{mode:"iri"}`, `undefined` to `{mode:"untagged"}`, and a valid language tag to `{mode:"language",range:<lowercase tag>}`.
`IRI-based` now uses B4's complete IRI.
Language selection now follows B4's lookup/default rules; the old implicit English and SKOS fallback are not a second canonical selection algorithm.
These are explicitly documented migrations of saved selector intent, not claims of identical selected strings.

The saved `default` token is fatal for artifact migration: its pinned behavior is English, then untagged, then IRI (`languageTools.js:10–36`), whereas the generic word does not identify a canonical mode.
Mapping it to either `untagged` or a caller preference for English would invent a policy choice.
The implementation owner explicitly selected rejection for this unresolved selector; A9.3 offers no selector-resolution kind.
Other unrecognized selectors are fatal; omission is incomplete state.
Structural migration can still discard these settings with diagnostics.

Effective document prefix bindings are the six constants in document 45–52, overlaid in array order by `namespace`, then overlaid by `header.prefixList` (document 317–326).
That precedence is explicit historical document behavior, not canonicalizer defaults.
Duplicate namespace names therefore retain their last value; superseded bindings drop with diagnostics.
Prefix editing/removal updates both stores after expanding prior abbreviated record IRIs (document 328–350,367–419).
Use the resulting effective bindings, including fixed defaults, as B4 prefixes; reject invalid B4 prefix names rather than deleting active bindings.

This recovers the document-owned prefix map.
It does not claim to recover arbitrary stale renderer-local prefixes from another earlier mount: runtime 2633–2669 overlays its private map and that entire historical session is not in saved bytes.
The canonical artifact's label fallback uses the recovered explicit document map and B4.

### Effective hidden set

Replay the pinned filter composition on the admitted historical structural graph after its equivalent-node grouping and endpoint rerouting: empty Literal/Thing removal, degree, datatype, object-property, subclass, disjoint, set-operator, then mode modules (runtime 218–228,2700–2742).
A checked filter with no applicable records is a known no-op, not a reason to reject an otherwise complete artifact.

- Empty-literal filtering removes unused `rdfs:Literal` and `owl:Thing` nodes based on represented property endpoints (`emptyLiteralFilter.js:20–76`).
- Degree filtering counts incident rendered links excluding datatype-property links, removes nodes below the saved threshold and dangling properties, and restores the prior graph if it would leave zero nodes (`nodeDegreeFilter.js:49–100`).
  It is not a recursive graph-core calculation.
  A threshold of zero is disabled (`d3RenderedGraphAdapter.js:550–559`).
  Recompute links at each filter stage; inverse pairs share one historical link (`parsing/linkCreator.js:37–63`).
- Datatype and set-operator filters remove the matching nodes and tidy incident properties (`datatypeFilter.js`, `setOperatorFilter.js`, `filterTools.js:16–64`).
- Object-property filtering removes object-property records and then floating `owl:Thing` nodes (`objectPropertyFilter.js:34–66`).
- Subclass filtering removes subclass nodes only when their relevant recursively collected incoming-subclass neighborhood has exclusively subclass edges and at most one outgoing edge for that node (`subclassFilter.js:33–167`).
  Multiple inheritance and an attached non-subclass relation can keep a node visible.
- Disjoint filtering removes disjoint edges only (`disjointFilter.js:34–48`).
  Compact notation may suppress fixed label wording but does not hide the canonical occurrence or remove its placement.

For the recoverable named-class/subclass/disjoint/equivalence branch, these filters are fully determined.
Faithful subclass replay can revisit incoming neighborhoods and take quadratic work on long chains.
Every node and edge visit checks the shared operation budget; exhaustion rejects the migration without a partial artifact or altered filter semantics.
The A8 limits bound execution rather than guaranteeing acceptance of every graph below the record ceiling.
Unsupported semantic branches fail earlier; their absence does not prevent evaluating the applicable filters.
Transfer the resulting visibility through operation-local correspondence and close hidden nodes over incident edges and labels as B3 requires.
Filter controls then drop with field diagnostics; only the final effective hidden set is canonical.
No `hidden:[]` is assumed merely because no saved explicit hidden array exists.

### Occurrence correspondence, positions and camera

Each admitted named class/group corresponds to the canonical occurrence over the same retained target roles; each admitted subclass/disjoint relation corresponds to its canonical edge.
Subclass edges also have positionable labels.
Legacy property `pos` is label position, never an edge placement.
A canonical disjoint edge has no positionable label under B2.4, so its legacy property `pos` and `pinned` fields produce explicit dropped-field diagnostics and do not create a placement.
Equivalent legacy records can collapse only when every supplied position/pin claim for the resulting occurrence agrees.
A stale or conflicting secondary record is not resolved by picking the first parser representative.

Require a recoverable finite position and explicit Boolean pin for every canonical positionable occurrence, including hidden occurrences.
One saved representative can establish a group's placement when the other group records have no saved placement claim; any conflicting claim fails.
If multiple source records contribute one canonical occurrence, all supplied claims must agree.
Reject unmatched saved placements and missing new placements; generated historical operator links and changed generic splits never justify synthesizing coordinates.
The correspondence is operation-local and is not stored as durable legacy IDs.

`runtime:631–672` captures one representative class node and property-label position; inverse property targets share that label position.
`vowlDocumentArrangement.js:8–26` writes only matched original record targets and skips nonunique matches.
Thus missing placements on hidden or newly split occurrences are real migration errors, while an equivalent alias lacking its own saved coordinates does not necessarily make a placed group unrecoverable.

Consume the viewport resolution at `/settings/global/translation` and calculate `center.x=(width/2-tx)/zoom`, `center.y=(height/2-ty)/zoom`.
Reject nonfinite results.
Retain positive zoom, drop dimensions after conversion, and never interpret translation as center.
Runtime 352–360 establishes translation-then-scale; B3 fixes the canonical formula.

## Bounded qualification obligations

There are honest positive structural and artifact branches: a named class, an unambiguous binary named class-equivalence pair with nonconflicting placement, and named subclass/binary-disjoint relations with complete state for their canonical positionable nodes and subclass labels.
Their positive tests must use actual pinned producer shapes, not a made-up dialect claiming that revision.
A complete equivalence/disjoint triangle must not be used as a positive until source-axiom grouping is recoverable; the pinned pair-expansion loses that distinction (builder 1148–1173,1191–1203).

Focused cases must distinguish absent/empty/sentinel root identities; wrong/unused resolution pointers; predicate-encoding collisions; retained language/IRI/anonymous values; untagged datatype loss; edited versus redundant summaries; named memberships versus unidentified positive `instances`; named relations versus lossy operators/restrictions; every saved selector; prefix precedence; active/no-op filters; degree all-empty restoration; conflicting collapse; missing hidden/new label placement; and viewport conversion.
Compact parameter tables are adequate for scalar/closed-field mutations.
Exact independent canonical outputs remain necessary for the substantive positive fixtures; this document does not claim those tests have run.
