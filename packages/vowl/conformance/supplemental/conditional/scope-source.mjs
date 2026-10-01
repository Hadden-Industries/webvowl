// SPDX-License-Identifier: AGPL-3.0-only
// One complete model witnesses all six cardinality tokens outside subclass scope.
import { extendedSources } from "../../oracle/extended-sources.mjs";
const source = structuredClone(
  extendedSources.find((item) => item.id === "object-exact-unqualified").source,
);
const s = source.structural;
s.subjects.push(
  { id: "s-q", iri: "https://example.org/o#q" },
  { id: "s-Literal", iri: "http://www.w3.org/2000/01/rdf-schema#Literal" },
);
s.roles.push(
  { id: "q", kind: "data-property", subject: "s-q" },
  { id: "Literal", kind: "datatype", subject: "s-Literal" },
);
s.occurrences = s.occurrences.filter(
  (o) =>
    ![
      "restriction-target",
      "restriction-edge",
      "label-restriction-edge",
    ].includes(o.id),
);
s.occurrences.push(
  {
    id: "data-domain",
    kind: "class-node",
    targets: ["Thing"],
    context: { kind: "property", properties: ["q"] },
  },
  {
    id: "data-range",
    kind: "datatype-node",
    target: "Literal",
    context: { kind: "property", properties: ["q"] },
  },
  {
    id: "data-edge",
    kind: "property-edge",
    properties: ["q"],
    from: "data-domain",
    to: "data-range",
  },
  { id: "data-label", kind: "label", edge: "data-edge", direction: "single" },
);
s.expressions = [];
for (const family of ["object", "data"])
  for (const bound of ["min", "max", "exact"])
    s.expressions.push({
      id: `${family}-${bound}`,
      kind: `${family}-${bound}-cardinality`,
      property: family === "object" ? "p" : "q",
      cardinality: "0",
      filler: family === "object" ? "Thing" : "Literal",
    });
s.constructs = [
  {
    id: "equivalence",
    kind: "equivalent-classes",
    members: ["A", ...s.expressions.map((expression) => expression.id)],
  },
];
export const scopeSources = [
  {
    id: "all-six-cardinalities-outside-subclass-context",
    source,
    clauses: [
      "B24-restriction-subclass-context",
      "B21-excluded-equivalence-details",
    ],
  },
];
