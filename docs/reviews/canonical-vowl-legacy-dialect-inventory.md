# Canonical VOWL historical-dialect preparation

**Status:** Independent source inventory and proposed mapping boundaries; no migration implementation, accepted ingress schema or artifact qualification yet.

The initial A9.3 dialect is `webvowl-legacy-354ed3af8c1e82019f6280b2594acaceac96cca0`.
The independent migration protocol reviewer inspected Git blobs at exactly that commit, rather than treating the current checkout or Java reference output as the dialect authority.
The review used `git show`, `git grep` and `git ls-tree`; it made no changes and ran no migration tests.

## Export boundary

At the pin, `src/app/js/controller/visualizationArtifactService.js:412–473` clones the stored VOWL model, sorts selected arrays and object keys, and serializes it.
Other stored fields survive.
`webVowlController.js:1304–1319` first adds arrangement and visualization settings; the wrapper's acquisition `source` and `loadGeneration` are not part of those serialized model bytes.
`ontologySourceLoader.js:317–368` accepts broadly shaped VOWL objects and retains their fields.
The exporter revision and `_comment` therefore do not establish a closed ingress grammar or prove that the pinned OWL builder produced every record.
The later migration schema must enumerate its supported branches explicitly and reject ambiguous unsupported cases.

## Observed fields and proposed dispositions

All source locations below refer to the pinned commit.
`vowlBuilder.js` is under `src/owl2vowl/js`; controller files are under `src/app/js/controller`.

| Fields or distinction                                                                                          | Observed producer meaning                                                                                                                                        | Proposed migration boundary                                                                                                                                                               |
| -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Parallel class/datatype/property and attribute records                                                         | Builder lines 381–456 emit typed records and IRIs.                                                                                                               | Validate unique complete joins and references before discarding traversal IDs. Recover only unambiguous semantic kinds and full IRIs.                                                     |
| `header.iri`, `header.imports`                                                                                 | Builder lines 355–372 retain root identity/direct imports.                                                                                                       | Preserve known root identity and authored direct imports. Never substitute an acquisition URL.                                                                                            |
| `header.version`                                                                                               | Builder lines 1327–1331 store lexical `versionInfo`.                                                                                                             | Do not reinterpret it as a version IRI. Its annotation predicate/value still need an unambiguous field rule.                                                                              |
| Exact `No IRI set` root placeholder                                                                            | Builder lines 262–265 and 1621–1626 emit it for an absent ontology IRI.                                                                                          | Recognize that documented absence without creating an IRI. Distinguish this case from omitted, empty, invalid or explicitly resolved root identity.                                       |
| Generic annotation map keys, `identifier`, `predicateNs`                                                       | Builder lines 125–142 percent-decode local names; lines 167–202 serialize annotation items.                                                                      | Require an `annotation-predicate` resolution at the exact unresolved item when its original lexical IRI is not recoverable. Do not guess a namespace or resolve a whole collision bucket. |
| `{type:"label",language,value}`                                                                                | Builder lines 179–186 omit literal datatype.                                                                                                                     | A predicate resolution does not recover a lost datatype. Reject a case requiring an unknown literal branch/datatype; A9.3 authorizes no datatype resolution.                              |
| Localized labels/comments and nested annotations                                                               | Builder lines 231–260 select one value per language; lines 212–228 omit deeper annotation annotations.                                                           | Retain only represented, unambiguous values. Do not claim reconstruction of omitted assertions or nesting.                                                                                |
| Header title/author/description summaries                                                                      | Builder lines 1317–1337 derive them by local name while keeping generic items; `vowlDocument.js:293–314` can edit them independently.                            | Do not invent Dublin Core predicates, duplicate proven originals or discard contradictory edited summaries.                                                                               |
| Entity `description`                                                                                           | Builder lines 1476–1482 may retain only a localized summary.                                                                                                     | Treat missing predicate identity separately from the summary's text.                                                                                                                      |
| Property `domain`/`range`                                                                                      | Builder lines 409–442 default endpoints; lines 654–674 fill inverse-derived endpoints; explicit flags stay private.                                              | Do not claim every exported endpoint is an authored domain/range fact. Ambiguous provenance is not repaired by the three allowed resolution kinds.                                        |
| Restriction/operator records                                                                                   | Builder lines 459–540 and 931–1094 can collapse/omit operands, inverse identity or restriction scope; lines 787–798 and 1537–1570 can lose exact bounds/fillers. | Reject unrecoverable source distinctions; no invented scope, filler, inverse-expression identity or rounded cardinality is permitted.                                                     |
| `_comment`, metrics, derived base-IRI/language inventories, presentation `baseIri` and proven synthetic labels | Builder lines 1603–1646 emit presentation/derived information.                                                                                                   | Diagnose every discarded field. Treat a summary as redundant only when its retained original is established.                                                                              |
| Positions, pins and settings in structural migration                                                           | Controller arrangement/settings producers add them.                                                                                                              | A9.3 permits discarding them with deterministic field diagnostics.                                                                                                                        |
| Unknown fields                                                                                                 | The exporter can pass them through.                                                                                                                              | An explicit ingress rule must establish meaning or a safe noncanonical disposition; otherwise fail with `MIGRATION_AMBIGUOUS`.                                                            |

Only `annotation-predicate`, `ontology-iri` and `viewport` resolutions are authorized, each at its exact source JSON Pointer.
An ontology resolution is not a general override of an already resolved identity.
Unused, conflicting, duplicate or incorrectly typed resolutions must fail.
The migration result and diagnostics remain immutable; originals and caller resolutions remain external to canonical bytes.

## Arrangement and display evidence

Historical equivalent grouping and endpoint rerouting occur in `src/webvowl/js/parser.js:282–311,353–485,592–617`.
Builder generic splitting at lines 810–887 uses historical property-IRI/opposite-ID contexts, which do not by themselves establish canonical occurrence correspondence.
`src/webvowl/js/runtime/renderedGraphInternals.js:631–672` records one class-node target but gives both inverse property targets the label position.
Generated operator links lack original document targets (`parser.js:552–583`, `d3RenderedGraphAdapter.js:217–221,251–269`).
`vowlDocumentArrangement.js:8–26` writes positions/pins to matching original records and skips nonunique matches.
Missing saved placements and contradictory placements after canonical collapse therefore require rejection, rather than first-record selection or a synthesized layout.

`vowlVisualizationSettings.js:182–212` saves language, pause state, zoom/translation, force distances, filters and modes; it does not save viewport dimensions or a complete effective hidden set.
Legacy transform order is translation followed by scale (`renderedGraphInternals.js:352–360`).
With explicitly supplied viewport dimensions, B3's conversion is `center=((width/2-tx)/zoom,(height/2-ty)/zoom)`.
The resolution must identify the exact unresolved camera location.

Mode intent and historical rendering equivalence are different claims.
Legacy node scaling differs from B5's formula, but that difference alone does not forbid a documented mapping of the saved mode intent.
Legacy `IRI-based` selects a decoded local name while canonical `mode:"iri"` selects the complete IRI; historical fallback prefers English and can use SKOS `prefLabel` (`languageTools.js:10–36`, `BaseElement.js:209–236`).
These selectors need a defined disposition rather than an implicit equivalence.
Filter settings also do not directly encode canonical visibility: degree filtering excludes datatype links and can restore all nodes when filtering empties the graph (`nodeDegreeFilter.js:49–100`).
Broader artifact admission requires the full historical filter composition, complete effective state and proven canonical occurrence correspondence.

## First fixture and remaining work

The reviewer proposed one complete structural fixture through the actual pinned builder/controller export path: a named root, one ordinary named `owl:Class`, one unique attribute partner and full IRI, zero individuals, and only the generated `IRI-based` label.
It has no properties, annotations, operators, equivalences, memberships or imports.
Migration can preserve the root/class role, derive its canonical occurrence and diagnose discarded metadata/settings without inventing ontology facts.
This is a proposed executable fixture, not an observed migration success.

Independently expected rejection fixtures must cover percent-encoded predicate collisions, ambiguous untagged literals, default/asserted/inverse-derived endpoint distinctions, lost restriction scope/fillers, conflicting collapsed placements and missing generated placements.
The accepted ingress schema/field map must precede enabling the dialect.
Unread or incomplete source scope includes full renderer filter ordering and remaining filter modules, all notation/type implementations, complete prefix/deletion paths and arbitrary pass-through dialects.
This preparation neither broadens the one named dialect nor establishes migration, application cutover or freeze acceptance.
