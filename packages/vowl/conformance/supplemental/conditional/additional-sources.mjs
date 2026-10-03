// SPDX-License-Identifier: AGPL-3.0-only
// Additional concrete-token conditional branches; earlier 62 fixtures stay frozen.
import { conditionalSources } from "./sources.mjs";
import { extendedSources } from "../../oracle/extended-sources.mjs";
import { grammarSources } from "../grammar/sources.mjs";
const all = [...conditionalSources, ...extendedSources, ...grammarSources];
const copy = (id) => structuredClone(all.find((item) => item.id === id).source);
const fixtures = [];
function add(id, source, clauses) {
  fixtures.push({ id, source, clauses });
}
{
  const source = copy("partial-union-projection");
  source.structural.expressions.find((e) => e.id === "union").kind =
    "class-intersection";
  add("intersection-partly-undrawable-operands", source, [
    "B24-operator-undrawable",
  ]);
}
for (const kind of ["class-intersection", "class-complement"]) {
  const source = copy("operator-no-drawable-operands"),
    s = source.structural,
    operator = s.expressions.find((e) => e.id === "union");
  operator.kind = kind;
  if (kind === "class-complement") {
    delete operator.members;
    operator.operand = "some";
    s.expressions = s.expressions.filter((e) => e.id !== "all");
  }
  add(`${kind}-no-drawable-operands`, source, [
    "B21-operator-singletons",
    "B24-operator-undrawable",
  ]);
}
{
  const source = copy("operator-generic-operand-context"),
    s = source.structural,
    operator = s.expressions.find((e) => e.id === "union");
  operator.kind = "class-complement";
  delete operator.members;
  operator.operand = "Thing";
  s.occurrences = s.occurrences.filter(
    (o) => !(o.kind === "operator-edge" && o.to === "node-A"),
  );
  add("complement-generic-operand-context", source, ["B23-operator-context"]);
}
{
  const source = copy("object-one-absent-domain"),
    s = source.structural;
  s.roles.find((r) => r.id === "Thing").kind = "rdf-class";
  s.constructs.push({
    id: "explicit-domain",
    kind: "object-domain",
    property: "p",
    target: "Thing",
  });
  add("explicit-thing-rdfs-role-generic-context", source, [
    "B23-rdf-class-generic",
  ]);
}
for (const family of ["data", "rdf"]) {
  const source = copy(`equivalent-${family}-properties`);
  source.structural.constructs.push({
    id: "alias-characteristic",
    kind: `${family}-characteristic`,
    property: "q",
    characteristic: "functional",
  });
  add(`${family}-nonprincipal-characteristic-details`, source, [
    "B24-characteristic-nonprincipal",
  ]);
}
for (const family of ["data", "rdf"]) {
  const source = copy(`${family}-compound-range-details`),
    s = source.structural;
  s.subjects.push({ id: "s-q", iri: "https://example.org/conditional#q" });
  s.roles.push({ id: "q", kind: `${family}-property`, subject: "s-q" });
  s.constructs.push(
    { id: "domain-q", kind: `${family}-domain`, property: "q", target: "A" },
    { id: "range-q", kind: `${family}-range`, property: "q", target: "D" },
    { id: "subproperty", kind: `sub-${family}-property`, sub: "p", super: "q" },
  );
  s.occurrences.push(
    {
      id: "datatype-q",
      kind: "datatype-node",
      target: "D",
      context: { kind: "property", properties: ["q"] },
    },
    {
      id: "edge-q",
      kind: "property-edge",
      properties: ["q"],
      from: "node-A",
      to: "datatype-q",
    },
    { id: "label-q", kind: "label", edge: "edge-q", direction: "single" },
  );
  add(`${family}-subproperty-missing-projection-details`, source, [
    "B24-subproperty-drawable-both",
  ]);
}
for (const family of ["data", "rdf"]) {
  const source = copy(`${family}-compound-range-details`);
  source.structural.constructs.push({
    id: "characteristic",
    kind: `${family}-characteristic`,
    property: "p",
    characteristic: "functional",
  });
  add(`${family}-characteristic-without-projection-details`, source, [
    "B24-characteristic-projection-needed",
  ]);
}
{
  const source = copy("object-exact-unqualified");
  source.structural.constructs.push({
    id: "characteristic",
    kind: "object-characteristic",
    property: "p",
    characteristic: "functional",
  });
  add("restriction-label-with-global-characteristic", source, [
    "B24-restriction-characteristic-separation",
  ]);
}
{
  const source = copy("object-inverse"),
    s = source.structural;
  s.expressions.push({
    id: "inverse-q",
    kind: "object-inverse",
    property: "q",
  });
  s.constructs.push({
    id: "inverse-only-equivalence",
    kind: "equivalent-object-properties",
    members: ["inverse-expression", "inverse-q"],
  });
  add("property-equivalence-only-inverse-members", source, [
    "B22-inverse-equivalence-members",
  ]);
}
{
  const source = copy("partial-class-group-exclusions"),
    s = source.structural;
  s.constructs.find((c) => c.id === "equivalence").members = [
    "Thing",
    "anonymous-class",
    "union",
  ];
  s.occurrences = s.occurrences.filter((o) => o.id !== "group-AB");
  s.occurrences.push(
    { id: "node-A", kind: "class-node", targets: ["A"] },
    { id: "node-B", kind: "class-node", targets: ["B"] },
  );
  add("class-equivalence-only-excluded-members", source, [
    "B21-excluded-equivalence-details",
  ]);
}
export const additionalSources = fixtures;
