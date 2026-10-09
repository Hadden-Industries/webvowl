# Canonical benchmark demo

`#benchmark` resolves to `src/canonical-examples/benchmark.json` through the same canonical preset registry as the ontology examples.
The historical `src/app/data/benchmark.json` remains unchanged as reference material.
It is not valid canonical VOWL and cannot be admitted by the supported legacy migration operation either.

Regenerate the replacement from the repository root with `node util/generateCanonicalBenchmark.mjs`.
An optional output filename writes a separate candidate for comparison.
The tool authors this specific demo through VOWL's public `canonicalize`, `edit` and `encode` operations.
The producer owns signature normalization, complete drawing occurrence generation and canonical serialization.
It does not add a production legacy fallback or change the VOWL contracts.

The replacement retains the demo's multilinks, inverse pairs, self-loops, disjointness, equivalent classes/properties, subclass relationships, property characteristics, key, anonymous class, external entities, URI example, English/German labels, comments and direct individual counts.
Its artifact selects English labels and direct-membership node scaling, with fresh deterministic scene positions.
The ordinary preset node-count policy still applies.

The following are deliberate authoring changes, not claims of lossless migration:

- Missing entity IRIs become explicit demo IRIs under `https://haddenindustries.com/webvowl/benchmark#`.
  Anonymous class identity stays unnamed.
  External examples use a separate example namespace; `rdf:Group` expands to its absolute RDF IRI.
- Unidentifiable `{a: b}` individual placeholders become distinct named demo individuals, retaining their counts.
- Contradictory property style flags become coherent property roles and deprecation annotations.
  Datatype-property endpoints become datatypes, including the old class-shaped `DatatypePropertyTest` placeholder.
- Intersection, union and complement pseudo-nodes become reachable class expressions.
  The old disjoint-union pseudo-node becomes a named class with a disjoint-union assertion; the current renderer has no separate disjoint-union operator glyph.
- Existential and universal restrictions are retained as structural facts alongside their ordinary named-property links.
  The current renderer does not draw these restriction expressions separately; they remain inspectable in Facts.
- Cardinality values `1`, `5`, `8888`, `77` and `13` appear on supported unqualified restrictions to `owl:Thing`.
  The original named-class links remain.
  The old combined minimum/maximum label becomes two scoped restriction edges.
- Legacy `unset` and `undefined` label entries become untagged strings; `iriBased` entries give way to the actual authored entity IRIs.

This source repair does not qualify browser appearance or all legacy visual cases as equivalent.
Runtime and regression verification remain pending while the user reviews the iteration.
