// SPDX-License-Identifier: AGPL-3.0-only
// Explicit B2.5 details-only partitions and all conditional object characteristics.
import { conditionalSources } from "./sources.mjs";
import { grammarSources } from "../grammar/sources.mjs";
const sources = [];
const copy = (id) =>
  structuredClone(
    [...conditionalSources, ...grammarSources].find((item) => item.id === id)
      .source,
  );
for (const family of ["object", "data", "rdf"]) {
  const source = copy(
      family === "object"
        ? "object-undrawable-domain-details"
        : `${family}-compound-range-details`,
    ),
    s = source.structural;
  const alias = family === "object" ? "p2" : "q";
  s.subjects.push({
    id: `s-${alias}`,
    iri: `https://example.org/conditional#${alias}`,
  });
  s.roles.push({
    id: alias,
    kind: `${family}-property`,
    subject: `s-${alias}`,
  });
  s.constructs.push(
    {
      id: `domain-${alias}`,
      kind: `${family}-domain`,
      property: alias,
      target: family === "object" ? "complex" : "A",
    },
    {
      id: `range-${alias}`,
      kind: `${family}-range`,
      property: alias,
      target: family === "object" ? "B" : "range",
    },
    {
      id: "equivalence",
      kind: `equivalent-${family}-properties`,
      members: ["p", alias],
    },
  );
  sources.push({
    id: `${family}-equivalence-undrawable-partition`,
    source,
    clauses: ["B22-undrawable-equivalence-partitions"],
  });
}
{
  const source = copy("equivalent-object-properties"),
    s = source.structural;
  s.expressions.push({
    id: "inverse-p",
    kind: "object-inverse",
    property: "p",
  });
  for (const property of ["q", "inverse-p"])
    for (const characteristic of [
      "functional",
      "inverse-functional",
      "symmetric",
      "transitive",
    ])
      s.constructs.push({
        id: `${property}-${characteristic}`,
        kind: "object-characteristic",
        property,
        characteristic,
      });
  sources.push({
    id: "all-visual-characteristics-nonprincipal-or-inverse",
    source,
    clauses: [
      "B24-characteristic-nonprincipal",
      "B24-characteristic-inverse-expression",
    ],
  });
}
{
  const source = copy("object-undrawable-domain-details");
  for (const characteristic of [
    "functional",
    "inverse-functional",
    "symmetric",
    "transitive",
  ])
    source.structural.constructs.push({
      id: `characteristic-${characteristic}`,
      kind: "object-characteristic",
      property: "p",
      characteristic,
    });
  sources.push({
    id: "all-visual-characteristics-undrawable-property",
    source,
    clauses: ["B24-characteristic-projection-needed"],
  });
}
export const completionSources = sources;
