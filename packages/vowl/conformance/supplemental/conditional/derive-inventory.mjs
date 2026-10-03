// SPDX-License-Identifier: AGPL-3.0-only
// Clause-level evidence inventory. A fixture is a witness, not exhaustive UI proof.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url)),
  bundle = resolve(here, "../..");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const json = (value) => JSON.stringify(value, null, 2) + "\n";
const manifests = [],
  positives = new Map();
for (const path of [
  "supplemental/amended-policy/manifest.json",
  "supplemental/conditional/manifest.json",
  "supplemental/conditional/additional-manifest.json",
  "supplemental/conditional/completion-manifest.json",
  "supplemental/conditional/scope-manifest.json",
]) {
  const bytes = await readFile(resolve(bundle, path)),
    manifest = JSON.parse(bytes);
  manifests.push({
    path,
    sha256: hash(bytes),
    positives: manifest.vectors.length,
  });
  for (const vector of manifest.vectors) {
    assert.ok(!positives.has(vector.id));
    positives.set(vector.id, { ...vector, manifest: path });
  }
}
const baseline = JSON.parse(
  await readFile(resolve(bundle, manifests[0].path), "utf8"),
);
const negativeBytes = await readFile(resolve(here, "negative-manifest.json")),
  negatives = JSON.parse(negativeBytes).vectors;
function link(id) {
  const fixture = positives.get(id);
  assert.ok(fixture, `Unknown positive fixture ${id}`);
  return {
    id,
    manifest: fixture.manifest,
    source: fixture.files["source.json"],
    canonical: fixture.files["canonical.json"],
    canonicalDataset: fixture.files["canonical.nq"],
  };
}
const definitions = [];
function clause(id, requirement, oldFixtures = [], qualification = "topology") {
  definitions.push({ id, requirement, oldFixtures, qualification });
}
clause(
  "B1-context-semantic-references",
  "Context arrays reference semantic records, not occurrences or traversal indices.",
  ["per-property-datatype"],
);
clause(
  "B1-no-semantic-copy",
  "Occurrences retain addressing only; semantic characteristics/IRIs/annotations stay in retained records.",
  ["annotated-class"],
);
clause(
  "B21-role-drawability",
  "Class and RDFS-class roles are drawable under ordinary/generic rules.",
  ["named-class-structural"],
);
clause(
  "B21-named-singletons",
  "An ungrouped ordinary named class has exactly one context-free singleton node.",
  ["named-class-structural"],
);
clause(
  "B21-anonymous-singletons",
  "Anonymous class/RDFS-class roles remain distinct singleton nodes; symmetry does not merge identity.",
  ["symmetric-anonymous-classes"],
);
clause(
  "B21-named-components",
  "Named class and RDFS-class co-membership generates one full component target set.",
  ["equivalence-disjoint-loop-empty-key"],
);
clause(
  "B21-transitive-components",
  "Explicitly connected equivalence hyperedges form transitive visual components without added semantic constructs.",
  ["equivalence-disjoint-loop-empty-key"],
);
clause(
  "B21-grouping-exclusions",
  "Generic, anonymous and expression members are excluded; ordinary named members still group in mixed constructs.",
  ["partial-class-group-exclusions"],
);
clause(
  "B21-excluded-equivalence-details",
  "Equivalence containing only excluded members does not create a shared glyph or an extra edge.",
);
clause(
  "B21-operator-singletons",
  "Every retained union/intersection/complement keeps its own singleton node, including an operator with no drawable operands.",
  ["aggregate-anchor-outer"],
);
clause(
  "B21-undrawable-expressions",
  "Other class expressions have no standalone node.",
  [
    "class-enumeration",
    "object-all",
    "object-value",
    "object-self",
    "data-some",
    "data-all",
    "data-value",
  ],
);
clause(
  "B21-unattached-generic",
  "Unattached exact Thing/Resource roles remain details-only without decorative nodes.",
);
clause(
  "B21-unattached-datatype",
  "Unattached datatypes remain details-only without decorative nodes.",
);
clause(
  "B22-direct-endpoints-only",
  "A named property uses its own direct normalized endpoint terms.",
  ["unequal-equivalent-property-endpoints"],
);
clause(
  "B22-object-defaults",
  "Absent object domain/range uses Thing; covers each single absence and both absent.",
  ["object-exact-unqualified"],
);
clause(
  "B22-data-defaults",
  "Absent data domain/range uses Thing/Literal; covers each single absence and both absent.",
  ["per-property-datatype"],
);
clause(
  "B22-rdf-defaults",
  "Absent RDF endpoints use Resource, preserving an existing class-kind role and otherwise using rdf-class.",
  ["rdf-property-resource-class", "rdf-property-resource-rdf-class"],
);
clause(
  "B22-defaults-not-facts",
  "Projection defaults do not add domain/range constructs to retained meaning.",
  ["per-property-datatype"],
);
clause(
  "B22-needed-builtin-signature",
  "Builtin roles are required only when a projected relation needs them; explicit undrawable endpoints stay details-only.",
  ["undrawable-range-no-default-role", "undrawable-range-declared-thing"],
  "interpretation",
);
clause(
  "B22-no-endpoint-inference",
  "Equivalent and inverse assertions never propagate endpoints or manufacture an inverse glyph.",
);
clause(
  "B22-inverse-expression-endpoint-facts",
  "An inverse-expression endpoint assertion is retained but not transferred to its named operand.",
);
clause(
  "B22-undrawable-domain",
  "An explicit undrawable domain suppresses that property relation; it is never defaulted away.",
);
clause(
  "B22-undrawable-range",
  "An explicit undrawable object range suppresses that property relation; it is never defaulted away.",
  ["undrawable-range-no-default-role"],
);
clause(
  "B22-compound-data-details",
  "Compound data ranges remain details-only for data/RDF properties.",
);
clause(
  "B22-rdf-datatype-range",
  "An RDF property with a named datatype range uses a datatype endpoint, not a generic class replacement.",
);
clause(
  "B22-property-components",
  "Object, data and RDF property equivalence components are built separately.",
  [
    "equivalent-object-properties",
    "equivalent-data-properties",
    "equivalent-rdf-properties",
    "object-data-property-punning",
  ],
);
clause(
  "B22-transitive-property-components",
  "Connected equivalence constructs combine matching named properties before endpoint partitioning.",
);
clause(
  "B22-unequal-partitions",
  "One component can have several exact endpoint partitions; unequal terms remain separate.",
);
clause(
  "B22-exact-terms-not-glyphs",
  "Two distinct endpoint terms remain distinct partitions even if class grouping draws those terms at one node.",
);
clause(
  "B22-inverse-equivalence-members",
  "Inverse-expression equivalence members are retained in details and never become named labels or named-role component members.",
  ["partial-property-group-with-inverse-expression"],
);
clause(
  "B22-undrawable-equivalence-partitions",
  "An equivalence partition with an undrawable endpoint creates no property glyph; equivalence stays retained.",
);
clause(
  "B23-context-free-ordinary",
  "Ordinary class groups/operators use their context-free node.",
  ["partial-class-group-exclusions", "aggregate-anchor-outer"],
);
clause(
  "B23-datatype-per-context",
  "Every named datatype, including user datatypes, is split per full PropertyContext.",
  ["per-property-datatype", "equivalent-data-properties"],
);
clause(
  "B23-opposite-class-targets",
  "Generic class contexts contain the complete semantic targets of the opposite drawable class group.",
);
clause(
  "B23-opposite-datatype-context",
  "A generic class opposite a datatype uses PropertyContext, not ClassContext.",
);
clause(
  "B23-rdf-class-generic",
  "Exact Thing/Resource is generic independently of class versus rdf-class role kind.",
  ["rdf-property-resource-class", "rdf-property-resource-rdf-class"],
);
clause(
  "B23-reuse-keys",
  "Equal target/context payloads reuse one node, including generic self-loops.",
  ["rdf-property-resource-rdf-class"],
);
clause(
  "B23-split-contexts",
  "Different complete contexts require different nodes.",
);
clause(
  "B23-operator-context",
  "A generic operator operand uses the operator semantic target in ClassContext.",
);
clause(
  "B23-disjoint-context",
  "Generic disjoint endpoints use the opposite class semantic targets.",
);
clause(
  "B23-subclass-context",
  "Generic subclass endpoints use the opposite class semantic targets.",
);
clause(
  "B23-full-partition-context",
  "Ordinary PropertyContext includes the full equivalent-property partition.",
);
clause(
  "B23-restriction-exact-role",
  "A restriction uses only its exact property role; it never borrows global aliases.",
  ["object-exact-unqualified", "data-exact-unqualified"],
);
clause(
  "B23-restriction-scope",
  "Restriction contexts contain the originating subclass construct and remain separate across constructs.",
  ["two-restrictions-distinct-scopes"],
);
clause(
  "B24-property-domain-range",
  "One ordinary edge per drawable partition runs effective domain to range.",
  ["sub-object-property", "sub-data-property", "sub-rdf-property"],
);
clause(
  "B24-inverse-named-members",
  "Only inverse constructs whose members are named object-property roles can replace ordinary edges.",
);
clause(
  "B24-inverse-partitions",
  "An inverse glyph references the complete located property partitions, including aliases.",
);
clause(
  "B24-inverse-singleton",
  "A singleton inverse member uses the same partition twice; non-self-reversed endpoints remain ordinary.",
  ["singleton-inverse-self-loop"],
);
clause(
  "B24-inverse-drawable-both",
  "Both inverse partitions must be drawable; otherwise keep independently drawable ordinary relations.",
);
clause(
  "B24-inverse-reversed",
  "Exact reversed endpoint terms permit an inverse glyph.",
  ["matched-inverse"],
);
clause(
  "B24-inverse-not-reversed",
  "Unreversed exact terms leave the inverse assertion details-only and keep ordinary relations.",
  ["unmatched-inverse"],
);
clause(
  "B24-inverse-orientation",
  "Forward is the lesser complete JCS UTF-8 sorted subject-IRI/role-kind tuple set; canonical IDs do not choose it.",
  ["inverse-orientation-opposes-role-rank"],
);
clause(
  "B24-inverse-self-loop",
  "Equal inverse sides imply a self-loop; distinct reversed self-loop partitions are also retained.",
  ["singleton-inverse-self-loop"],
);
clause(
  "B24-inverse-endpoint-direction",
  "Existing oracle interpretation: inverse from/to uses the forward partition domain/range.",
  ["matched-inverse"],
  "interpretation",
);
clause(
  "B24-inverse-replacement",
  "Eligible inverse edges replace ordinary edges for their represented partitions.",
  ["matched-inverse"],
);
clause(
  "B24-multiple-inverse-constructs",
  "One partition may appear in multiple inverse occurrences distinguished by construct.",
  ["multiple-explicit-inverse-pairs"],
);
clause(
  "B24-subclass-drawable-both",
  "An ordinary subclass edge exists only when both terms have drawable class nodes.",
  ["asymmetric-subclass", "object-all"],
);
clause(
  "B24-disjoint-pairs",
  "Distinct drawable member terms generate all unordered pairs.",
  ["disjoint-two-distinct-ends"],
);
clause(
  "B24-disjoint-singleton",
  "A normalized singleton drawable disjoint group produces a self-loop.",
);
clause(
  "B24-disjoint-collapsed-loop",
  "A drawable term pair collapsed into one class group remains a self-loop.",
  ["equivalence-disjoint-loop-empty-key"],
);
clause(
  "B24-disjoint-pair-dedup",
  "Several term pairs landing on the same occurrence pair deduplicate within the same construct.",
);
clause(
  "B24-disjoint-one-construct",
  "Pair projection never replaces a retained n-ary assertion with pairwise semantic constructs.",
);
clause(
  "B24-disjoint-undrawable",
  "Undrawable members remain in details; zero/two drawable cases do not invent missing endpoints.",
);
clause(
  "B24-disjoint-not-false-singleton",
  "One drawable member of a non-singleton group has no pair; it is not a normalized singleton assertion.",
);
clause(
  "B24-operator-connections",
  "Each drawable operand has an operator connection; full operands remain in the expression.",
  ["class-union", "class-intersection", "class-complement"].filter((id) =>
    positives.has(id),
  ),
);
clause(
  "B24-operator-direction",
  "Existing oracle interpretation: operator-edge runs from the operator node to its operand.",
  ["class-intersection"],
  "interpretation",
);
clause(
  "B24-operator-dedup",
  "Operand connections that land on the same class group deduplicate for that expression.",
);
clause(
  "B24-operator-undrawable",
  "Partial/all-undrawable operators retain every operand and their own node without invented operand glyphs.",
  ["partial-union-projection"],
);
clause(
  "B24-operator-derived-cue",
  "The renderer indicates omitted operands and exposes the complete expression in details/accessibility summaries.",
  ["partial-union-projection"],
  "display",
);
clause(
  "B24-restriction-named-sub",
  "Restriction sub must be a named class role; anonymous/expression sub terms stay details-only.",
  ["restriction-ineligible-anonymous-subclass"],
);
clause(
  "B24-restriction-rdfs-sub",
  "A named RDFS-class role is eligible as restriction sub.",
);
clause(
  "B24-restriction-cardinality-kinds",
  "All six min/max/exact object/data cardinalities can project when other conditions hold.",
  [
    "object-min-unqualified",
    "object-max-unqualified",
    "object-exact-unqualified",
    "data-min-unqualified",
    "data-max-unqualified",
    "data-exact-unqualified",
  ],
);
clause(
  "B24-restriction-named-property",
  "The restriction property must be named; an inverse expression remains details-only.",
  ["restriction-ineligible-inverse-property"],
);
clause(
  "B24-restriction-qualified-details",
  "Nondefault fillers keep all six qualified cardinality kinds details-only.",
  ["object-qualified-details", "data-qualified-details"],
);
clause(
  "B24-restriction-subclass-context",
  "Cardinality expressions outside a qualifying subclass construct have no restriction glyph.",
);
clause(
  "B24-restriction-per-construct",
  "Each retained qualifying subclass construct keeps its own restriction occurrence; different bounds and grouped subclasses are not combined.",
  ["two-restrictions-distinct-scopes"],
);
clause(
  "B24-restriction-not-global-fact",
  "Restriction endpoints/cardinalities are never copied into global endpoint or characteristic facts.",
  ["object-exact-unqualified", "data-exact-unqualified"],
);
clause(
  "B24-restriction-cardinality-text",
  "Exact/min/max text preserves the decimal spelling as n, n..*, or 0..n.",
  ["object-exact-unqualified", "data-min-unqualified", "data-max-unqualified"],
  "display",
);
clause(
  "B24-single-labels",
  "Property, subclass and restriction edges each have one single-direction label.",
  ["asymmetric-subclass", "object-exact-unqualified"],
);
clause(
  "B24-inverse-labels",
  "Each inverse edge has exactly forward and reverse labels.",
  ["matched-inverse"],
);
clause(
  "B24-label-cardinality",
  "Label topology is complete across property/datatype, inverse and restriction artifacts.",
);
clause(
  "B24-no-operator-disjoint-labels",
  "Operator/disjoint edges have no independently positionable labels.",
  ["disjoint-two-distinct-ends", "class-intersection"],
);
clause(
  "B24-positionable",
  "All class nodes, datatype nodes and generated labels are positionable and require complete artifact placements.",
);
clause(
  "B24-no-edge-placement",
  "Edge geometry/decorations have no independent placement.",
);
clause(
  "B24-subproperty-direction",
  "Subproperty highlighting addresses ordinary/inverse occurrences and the correct inverse direction.",
  [],
  "display",
);
clause(
  "B24-subproperty-drawable-both",
  "No subproperty interaction glyph is invented when either named role has no projection.",
  [],
  "display",
);
clause(
  "B24-subproperty-inverse-expression-details",
  "Inverse-expression subproperty arguments remain details-only.",
  ["object-inverse"],
  "display",
);
clause(
  "B24-subproperty-no-extra-occurrence",
  "Subproperty interaction adds no canonical occurrence.",
  ["sub-object-property", "sub-data-property", "sub-rdf-property"],
);
clause(
  "B24-characteristic-principal",
  "Only direct characteristics on the selected named principal receive ordinary property treatment.",
  [],
  "display",
);
clause(
  "B24-characteristic-nonprincipal",
  "Nonprincipal member characteristics stay in details rather than being unioned into glyph treatment.",
  [],
  "display",
);
clause(
  "B24-characteristic-inverse-direction",
  "Each inverse direction applies its own principal characteristic treatment.",
  [],
  "display",
);
clause(
  "B24-characteristic-inverse-expression",
  "Characteristics on inverse expressions are not transferred to named operands.",
  [],
  "display",
);
clause(
  "B24-characteristic-projection-needed",
  "A characteristic on a role without a drawable property projection stays details-only.",
  [],
  "display",
);
clause(
  "B24-restriction-characteristic-separation",
  "Restriction labels retain their scoped cardinality treatment and do not acquire another global property glyph.",
  [],
  "display",
);
clause(
  "B25-object-property-details",
  "A named object property with an undrawable endpoint has no property glyph.",
);
clause(
  "B25-data-property-details",
  "A named data property with an undrawable endpoint has no property glyph.",
);
clause(
  "B25-rdf-property-details",
  "A named RDF property with an undrawable endpoint has no property glyph.",
);
clause(
  "B25-no-unknown-kind-default",
  "Unknown semantic or occurrence kinds receive no implicit projection default.",
  ["empty-structural"],
);

const ids = new Set(definitions.map((item) => item.id));
assert.equal(ids.size, definitions.length);
for (const fixture of [...positives.values(), ...negatives])
  for (const id of fixture.clauses ?? [])
    assert.ok(ids.has(id), `Uninventoried referenced clause ${id}`);
const qualification = {
  topology: "complete-topology-bytes-pinned-pending-independent-review",
  display:
    "complete-topology-bytes-pinned-renderer-treatment-still-needs-independent-evidence",
  interpretation:
    "complete-topology-bytes-pinned-existing-interpretation-needs-protocol-acceptance",
};
const clauses = definitions.map(({ oldFixtures, ...definition }) => {
  const fixtureIds = [
    ...new Set([
      ...oldFixtures,
      ...[...positives.values()]
        .filter((item) => item.clauses?.includes(definition.id))
        .map((item) => item.id),
    ]),
  ];
  assert.ok(
    fixtureIds.length,
    `No complete-topology witness for ${definition.id}`,
  );
  return {
    ...definition,
    rule: definition.id.startsWith("B1-")
      ? "B1/A5/A7"
      : `B2.${definition.id[2]}`,
    status: qualification[definition.qualification],
    fixtures: fixtureIds.map(link),
    negatives: negatives
      .filter((item) => item.clauses.includes(definition.id))
      .map(({ id, expectedError, input }) => ({ id, expectedError, input })),
    ...(definition.qualification === "display"
      ? {
          unclosedCase:
            "Execute the linked complete model in the display/interaction layer and independently verify the stated derived treatment; canonical topology bytes alone cannot prove it.",
        }
      : definition.qualification === "interpretation"
        ? {
            unclosedCase:
              "Independent protocol review or owner clarification must accept the recorded interpretation before normative freeze; no new meaning is selected here.",
          }
        : {}),
  };
});
const matrix = JSON.parse(
  await readFile(resolve(bundle, "supplemental/coverage-matrix.json"), "utf8"),
).rows;
function branch(name, condition, fixtures, evidence = "topology") {
  return {
    name,
    condition,
    status:
      evidence === "display" ? qualification.display : qualification.topology,
    fixtures: fixtures.map(link),
    ...(evidence === "display"
      ? {
          unclosedCase:
            "Independent display/interaction execution must establish visual/details-only treatment; bytes establish the full model and absence of extra canonical occurrences.",
        }
      : {}),
  };
}
function branches(row) {
  const kind = row.kind;
  if (row.category === "role") {
    if (kind === "class" || kind === "rdf-class")
      return [
        branch(
          "ordinary-and-anonymous",
          "Ordinary ungrouped/grouped and anonymous roles are drawable.",
          kind === "class"
            ? [
                "named-class-structural",
                "symmetric-anonymous-classes",
                "equivalence-disjoint-loop-empty-key",
              ]
            : [
                "rdfs-named-and-anonymous-singletons",
                "mixed-class-rdfs-equivalence-group",
              ],
        ),
        branch(
          "generic-needed",
          "Exact builtin generic roles draw only where a relation supplies context.",
          kind === "class"
            ? ["object-one-absent-domain", "generic-context-grouped"]
            : [
                "rdf-one-absent-domain",
                "explicit-thing-rdfs-role-generic-context",
              ],
        ),
        branch(
          "generic-unattached",
          "Unattached generic role remains details-only.",
          ["unattached-generics-and-datatype"],
        ),
      ];
    if (kind === "datatype")
      return [
        branch(
          "drawable-endpoint",
          "Named datatype endpoint split by property context.",
          ["per-property-datatype", "data-equivalence-transitive"],
        ),
        branch(
          "unattached-or-compound-details",
          "No standalone glyph for unused datatype or compound data range.",
          ["unattached-generics-and-datatype", "data-compound-range-details"],
        ),
      ];
    if (["object-property", "data-property", "rdf-property"].includes(kind)) {
      const family = kind.split("-")[0];
      return [
        branch(
          "drawable-partition",
          "Exact drawable endpoints form property partitions.",
          [`${family}-equivalence-partitioned`],
        ),
        ...(family === "object"
          ? [
              branch(
                "eligible-inverse",
                "Named exactly reversed drawable partitions use inverse glyphs.",
                ["matched-inverse", "inverse-full-property-partitions"],
              ),
            ]
          : []),
        branch(
          "undrawable-details",
          "Known undrawable endpoint keeps this role details-only.",
          [
            `${family}-undrawable-domain-details`,
            ...(family === "object"
              ? ["undrawable-range-no-default-role"]
              : [`${family}-compound-range-details`]),
          ],
        ),
      ];
    }
    return [
      branch(
        "always-details",
        "No independent ABox or property-metadata glyph.",
        kind === "individual"
          ? ["class-membership-and-punning"]
          : ["annotated-class", "annotation-domain"],
      ),
    ];
  }
  if (row.category === "expression") {
    if (
      ["class-union", "class-intersection", "class-complement"].includes(kind)
    ) {
      const examples =
        kind === "class-union"
          ? [
              "operator-grouped-operand-dedup",
              "partial-union-projection",
              "operator-no-drawable-operands",
            ]
          : kind === "class-intersection"
            ? [
                "class-intersection",
                "intersection-partly-undrawable-operands",
                "class-intersection-no-drawable-operands",
              ]
            : [
                "class-complement",
                "class-complement-no-drawable-operands",
                "complement-generic-operand-context",
              ];
      return [
        branch(
          "operator-node-and-qualifying-connections",
          "Keep own node and only drawable operand connections, including the zero-connection case.",
          examples,
        ),
        branch(
          "omitted-operand-cue",
          "An omitted operand requires a derived cue and complete details/accessibility summary.",
          examples.slice(1),
          "display",
        ),
      ];
    }
    if (kind.endsWith("-cardinality")) {
      const [family, bound] = kind.split("-");
      return [
        branch(
          "eligible-subclass-restriction",
          "All four B2.4 conditions hold.",
          [`${family}-${bound}-unqualified`],
        ),
        branch(
          "qualified-filler-details",
          "Filler is not exact Thing/Literal.",
          [
            bound === "exact"
              ? `${family}-qualified-details`
              : `${family}-${bound}-qualified-details`,
          ],
        ),
        branch(
          "other-context-or-ineligible-sub",
          "Only subclass contexts with named sub/property qualify; object inverse-property cases are details-only.",
          [
            "all-six-cardinalities-outside-subclass-context",
            "restriction-expression-sub",
            ...(family === "object"
              ? [
                  "restriction-ineligible-inverse-property",
                  "restriction-ineligible-anonymous-subclass",
                ]
              : []),
          ],
        ),
      ];
    }
    return [
      branch(
        "always-details",
        "This expression token has no standalone node.",
        [kind === "object-some" ? "partial-union-projection" : kind],
      ),
    ];
  }
  if (row.category === "construct") {
    if (kind === "subclass")
      return [
        branch("ordinary-drawable", "Both class terms draw.", [
          "asymmetric-subclass",
          "subclass-generic-context-reuse-and-split",
        ]),
        branch(
          "eligible-restriction",
          "Super is an eligible scoped cardinality restriction.",
          [
            "object-exact-unqualified",
            "data-exact-unqualified",
            "restriction-rdf-class",
          ],
        ),
        branch(
          "details-only",
          "A term is undrawable and no qualifying restriction exception exists.",
          [
            "subclass-either-term-undrawable",
            "restriction-expression-sub",
            "object-qualified-details",
          ],
        ),
      ];
    if (kind === "equivalent-classes")
      return [
        branch(
          "named-component",
          "Named-role component still groups when excluded members coexist.",
          [
            "equivalence-disjoint-loop-empty-key",
            "partial-class-group-exclusions",
          ],
        ),
        branch(
          "excluded-members-details",
          "Only excluded members produce no equivalence glyph.",
          ["class-equivalence-only-excluded-members"],
        ),
      ];
    if (kind === "disjoint-classes")
      return [
        branch(
          "pairs",
          "All drawable unordered pairs, deduplicated by endpoint key.",
          ["disjoint-triad", "disjoint-aliases"],
        ),
        branch(
          "self-loop",
          "A normalized singleton or collapsed drawable pair preserves an edge.",
          ["disjoint-singleton", "equivalence-disjoint-loop-empty-key"],
        ),
        branch(
          "partial-or-details",
          "Undrawable members do not create phantom endpoints or a false singleton.",
          [
            "disjoint-0-drawable-members",
            "disjoint-1-drawable-members",
            "disjoint-2-drawable-members",
          ],
        ),
      ];
    if (/^equivalent-(object|data|rdf)-properties$/.test(kind)) {
      const family = kind.split("-")[1];
      return [
        branch(
          "drawable-partitions",
          "Transitive components split only by exact endpoint terms.",
          [
            `${family}-equivalence-transitive`,
            `${family}-equivalence-partitioned`,
          ],
        ),
        branch(
          "undrawable-partition-details",
          "No extra equivalence occurrence and no glyph for undrawable partitions.",
          [`${family}-equivalence-undrawable-partition`],
        ),
        ...(family === "object"
          ? [
              branch(
                "inverse-members-details",
                "Inverse members stay out of named-role partitions.",
                [
                  "partial-property-group-with-inverse-expression",
                  "property-equivalence-only-inverse-members",
                ],
              ),
            ]
          : []),
      ];
    }
    if (kind === "inverse-properties")
      return [
        branch(
          "eligible",
          "Named drawable exactly reversed partitions, including singleton/self-loop and multiple explicit constructs.",
          [
            "matched-inverse",
            "singleton-inverse-self-loop",
            "multiple-explicit-inverse-pairs",
          ],
        ),
        branch(
          "ineligible",
          "Inverse-expression members, undrawable partitions or nonreversed terms retain independently drawable ordinary edges.",
          [
            "inverse-expression-member-details",
            "inverse-one-undrawable-partition",
            "singleton-inverse-nonloop-details",
            "unmatched-inverse",
          ],
        ),
      ];
    if (/^(object|data|rdf)-(domain|range)$/.test(kind)) {
      const [family, endpoint] = kind.split("-");
      return [
        branch(
          "effective-drawable-endpoint",
          "Direct endpoint facts determine drawable relation endpoints.",
          [`${family}-equivalence-partitioned`],
        ),
        branch(
          "undrawable-endpoint-details",
          "The direct fact remains retained but produces no relation when its endpoint is undrawable.",
          [
            endpoint === "domain"
              ? `${family}-undrawable-domain-details`
              : family === "object"
                ? "undrawable-range-no-default-role"
                : `${family}-compound-range-details`,
          ],
        ),
        ...(family === "object"
          ? [
              branch(
                "inverse-expression-subject-details",
                "Endpoint facts on inverse expressions do not propagate.",
                ["inverse-endpoints-not-propagated"],
              ),
            ]
          : []),
      ];
    }
    if (/^sub-(object|data|rdf)-property$/.test(kind)) {
      const family = kind.split("-")[1];
      return [
        branch(
          "named-projected-interaction",
          "Both named roles have occurrences; highlight existing relation/direction without extra occurrences.",
          [
            kind,
            ...(family === "object" ? ["subproperty-inverse-directions"] : []),
          ],
          "display",
        ),
        branch(
          "details-only-without-projection",
          "A missing projection or object inverse-expression argument prevents highlighting.",
          [
            family === "object"
              ? "subproperty-missing-projection-details"
              : `${family}-subproperty-missing-projection-details`,
            ...(family === "object" ? ["object-inverse"] : []),
          ],
          "display",
        ),
      ];
    }
    if (kind.endsWith("-characteristic")) {
      const family = kind.split("-")[0],
        characteristic = row.characteristic ?? "functional";
      if (
        family === "object" &&
        ["reflexive", "irreflexive", "asymmetric"].includes(characteristic)
      )
        return [
          branch(
            "always-details",
            "This exact characteristic value is details-only even for a projected principal.",
            [`object-characteristic-${characteristic}`],
            "display",
          ),
        ];
      return [
        branch(
          "direct-selected-principal",
          "Visual treatment only on the direct selected named principal of a projected ordinary/inverse direction.",
          [
            family === "object"
              ? `object-characteristic-${characteristic}`
              : `${family}-characteristic`,
            ...(family === "object"
              ? ["characteristics-inverse-directions"]
              : []),
          ],
          "display",
        ),
        branch(
          "nonprincipal-or-no-projection",
          "A nonprincipal or unprojected role remains details-only.",
          family === "object"
            ? [
                "all-visual-characteristics-nonprincipal-or-inverse",
                "all-visual-characteristics-undrawable-property",
              ]
            : [
                `${family}-nonprincipal-characteristic-details`,
                `${family}-characteristic-without-projection-details`,
              ],
          "display",
        ),
      ];
    }
    const examples = {
      "property-chain": "repeated-chain",
      key: "nonempty-key",
      "datatype-definition": "datatype-restriction",
      "annotation-assertion": "annotated-class",
      "assertion-anchor": "aggregate-anchor-inner",
      "class-membership": "class-membership-and-punning",
    };
    return [
      branch(
        "always-details",
        "This retained construct has no independent canonical occurrence.",
        [examples[kind] ?? kind],
      ),
    ];
  }
  return [
    branch(
      "metadata-or-derived-text",
      "No independent occurrence; labels/header/details are derived from retained metadata/value.",
      ["annotated-class"],
      "display",
    ),
  ];
}
const matrixRows = matrix.map((row) => ({
  category: row.category,
  kind: row.kind,
  ...(row.characteristic ? { characteristic: row.characteristic } : {}),
  rule: "B2.5",
  branches: branches(row),
}));
async function pinned(name, value) {
  const bytes = json(value),
    target = resolve(here, name);
  if (process.argv.includes("--update-new-metadata")) {
    assert.ok(
      [
        "display-questions.json",
        "clause-inventory.json",
        "provenance.json",
      ].includes(name),
    );
    await writeFile(target, bytes);
  }
  if (process.argv.includes("--write-new")) {
    try {
      await writeFile(target, bytes, { flag: "wx" });
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
    }
  }
  assert.equal(
    await readFile(target, "utf8"),
    bytes,
    `${name}: no reviewed metadata overwrite`,
  );
}
const displayQuestions = {
  status: "independent-questions-and-premise-audit-pending-protocol-review",
  originalDisplayVectorsUnchanged: true,
  normativeAmbiguities: [
    {
      id: "DQ-ANONYMOUS-ROOT",
      rules: ["B5"],
      fixture: "display-vectors.json#anonymous-root-local",
      wording:
        "An anonymous root ontology or unnamed subject is never classified as external.",
      question:
        "Does absence of a root ontology IRI make every named subject local, or only state that the anonymous ontology itself is not external?",
      existingExpectation:
        "Every subject is local; the original vector expects false for a named unrelated subject.",
      decision:
        "Unresolved reviewer wording question. No new externality semantics are selected here.",
    },
    {
      id: "DQ-INVERSE-DIRECTION",
      rules: ["B1", "B2.4"],
      fixtures: ["matched-inverse", "inverse-full-property-partitions"],
      question:
        "Confirm inverse from/to uses the selected forward partition domain/range; the inverse paragraph fixes side ordering but does not restate endpoints.",
      existingExpectation:
        "Forward domain to forward range, recorded in the previous review corrections.",
      decision:
        "Existing interpretation retained; explicit protocol acceptance remains necessary.",
    },
    {
      id: "DQ-OPERATOR-DIRECTION",
      rules: ["B1", "B2.4"],
      fixtures: ["class-intersection", "operator-no-drawable-operands"],
      question:
        "Confirm operator-edge from is the operator node and to is the operand.",
      existingExpectation:
        "Operator to operand, as recorded in the previous review corrections.",
      decision:
        "Existing interpretation retained; no fresh direction choice is made.",
    },
  ],
  fixturePremisesNotSpecificationAmbiguities: [
    {
      id: "DP-COMPACT-GLYPH",
      fixture: "display-vectors.json#compact-notation-preserves-meaning",
      issue:
        "The expected empty Subclass of phrase requires the standard glyph to express that meaning; the conceptual input does not explicitly say that this premise holds.",
      requiredReviewAction:
        "Confirm/document the glyph-present premise when binding this conceptual vector to the application. B5 itself provides the condition; do not generalize unconditional phrase removal.",
    },
    {
      id: "DP-CANDIDATE-FILTER",
      fixtures: "display-vectors.json select-label family",
      issue:
        "Candidate sets are already filtered by the catalog premise. These vectors do not test that axiom/ontology annotations and ineligible literal kinds are excluded upstream.",
      requiredReviewAction:
        "Use retained full-model annotation fixtures in an application-level selection test; do not infer candidate-construction coverage from scalar lookup results.",
    },
    {
      id: "DP-DERIVED-TREATMENT",
      fixtures: "B2 clause rows marked renderer-treatment",
      issue:
        "Complete topology proves no extra occurrence, but cannot prove highlights, selected characteristic words/symbols, partial-expression cues, exact text, accessible summaries, or complete details.",
      requiredReviewAction:
        "Bind each display clause to an independently reviewed application/browser result before freeze.",
    },
  ],
  priorInterpretationRequiringAcceptance: {
    id: "DQ-UNNEEDED-DEFAULT",
    rules: ["A2", "A5", "B2.2"],
    fixtures: [
      "undrawable-range-no-default-role",
      "undrawable-range-declared-thing",
    ],
    statement:
      "Builtin absent-endpoint roles are required only if a projection needs them; known undrawable opposite endpoints do not force an otherwise-unused builtin role.",
    status:
      "Earlier independent reading was supplied to integration and matches current fixtures; protocol acceptance remains explicitly tracked.",
  },
};
await pinned("display-questions.json", displayQuestions);
await pinned("clause-inventory.json", {
  status: "independent-clause-witness-inventory-pending-review",
  specificationRevision: baseline.specificationRevision,
  amendment: baseline.amendment,
  manifests,
  positiveCount: positives.size,
  negativeManifest: {
    path: "supplemental/conditional/negative-manifest.json",
    sha256: hash(negativeBytes),
    cases: negatives.length,
  },
  evidenceMeaning:
    "Every row links exact complete-topology bytes and states its remaining non-topology obligation. Witness coverage is not all cartesian combinations, production correctness, exhaustive hostile-input coverage or accessibility qualification.",
  allRowsHaveExplicitDisposition: true,
  exhaustiveQualification: false,
  counts: {
    clauseRows: clauses.length,
    topologyWitnessRows: clauses.filter(
      (item) => item.qualification === "topology",
    ).length,
    displayEvidenceOpenRows: clauses.filter(
      (item) => item.qualification === "display",
    ).length,
    interpretationOpenRows: clauses.filter(
      (item) => item.qualification === "interpretation",
    ).length,
    b25ConcreteRows: matrixRows.length,
    b25Branches: matrixRows.reduce(
      (count, item) => count + item.branches.length,
      0,
    ),
  },
  clauses,
  b25Matrix: matrixRows,
});
const pins = [];
for (const filename of (await readdir(here))
  .filter(
    (name) =>
      name.endsWith(".mjs") ||
      [
        "manifest.json",
        "additional-manifest.json",
        "completion-manifest.json",
        "scope-manifest.json",
        "negative-manifest.json",
        "clause-inventory.json",
        "display-questions.json",
      ].includes(name),
  )
  .sort()) {
  const bytes = await readFile(resolve(here, filename));
  pins.push({
    path: `supplemental/conditional/${filename}`,
    sha256: hash(bytes),
    byteLength: bytes.length,
  });
}
const priorIndexPath = "supplemental/provenance-index.json";
await pinned("provenance.json", {
  status: "new-conditional-scope-provenance-pending-review",
  scope:
    "Only this new conditional directory and the conformance report were authored in this follow-up.",
  preservedPriorProvenance: {
    path: priorIndexPath,
    sha256: hash(await readFile(resolve(bundle, priorIndexPath))),
    modified: false,
  },
  specificationRevision: baseline.specificationRevision,
  amendment: baseline.amendment,
  producer: {
    path: "supplemental/amended-policy/producer.mjs",
    sha256: hash(
      await readFile(
        resolve(bundle, "supplemental/amended-policy/producer.mjs"),
      ),
    ),
  },
  manifests,
  artifacts: pins,
});
console.log(
  JSON.stringify({
    clauseRows: clauses.length,
    b25Rows: matrixRows.length,
    b25Branches: matrixRows.reduce(
      (count, item) => count + item.branches.length,
      0,
    ),
    positiveWitnesses: positives.size,
    displayOpen: clauses.filter((c) => c.qualification === "display").length,
    interpretationsOpen: clauses.filter(
      (c) => c.qualification === "interpretation",
    ).length,
    result:
      "every clause/branch links exact complete topology; non-topology obligations remain explicit",
  }),
);
