// SPDX-License-Identifier: AGPL-3.0-only
// Independent A3/A4 and B2 source recipes. Helpers express only the hand-selected
// topology below; they do not import a product projector or semantic normalizer.
import { extendedSources } from "../../oracle/extended-sources.mjs";
const ex = "https://example.org/supplement#";
const owl = "http://www.w3.org/2002/07/owl#";
const xsd = "http://www.w3.org/2001/XMLSchema#";
const rdf = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";

function model(names = ["A", "B"]) {
  const source = {
    structural: {
      ontology: { imports: [], annotations: [] },
      subjects: [],
      roles: [],
      expressions: [],
      constructs: [],
      occurrences: [],
    },
  };
  const structural = source.structural;
  const nodes = new Map();
  function role(id, kind, iri = ex + id) {
    let subject =
      iri === undefined
        ? undefined
        : structural.subjects.find((value) => value.iri === iri);
    if (!subject) {
      subject = { id: `subject-${id}`, ...(iri === null ? {} : { iri }) };
      structural.subjects.push(subject);
    }
    structural.roles.push({ id, kind, subject: subject.id });
    return id;
  }
  function node(id, targets, context) {
    structural.occurrences.push({
      id,
      kind: "class-node",
      targets,
      ...(context ? { context } : {}),
    });
    for (const target of targets) nodes.set(target, id);
    return id;
  }
  function edge(record, label = true) {
    structural.occurrences.push(record);
    if (label)
      structural.occurrences.push({
        id: `label-${record.id}`,
        kind: "label",
        edge: record.id,
        direction: "single",
      });
  }
  function property(
    id,
    kind = "object-property",
    domain = "A",
    range = "B",
    draw = true,
  ) {
    role(id, kind);
    const stem =
      kind === "object-property"
        ? "object"
        : kind === "data-property"
          ? "data"
          : "rdf";
    if (domain)
      structural.constructs.push({
        id: `domain-${id}`,
        kind: `${stem}-domain`,
        property: id,
        target: domain,
      });
    if (range)
      structural.constructs.push({
        id: `range-${id}`,
        kind: `${stem}-range`,
        property: id,
        target: range,
      });
    if (draw) {
      let target = nodes.get(range);
      if (!target) {
        target = `datatype-${id}`;
        structural.occurrences.push({
          id: target,
          kind: "datatype-node",
          target: range,
          context: { kind: "property", properties: [id] },
        });
      }
      edge({
        id: `edge-${id}`,
        kind: "property-edge",
        properties: [id],
        from: nodes.get(domain),
        to: target,
      });
    }
    return id;
  }
  function expression(record) {
    structural.expressions.push(record);
    return record.id;
  }
  function construct(record) {
    structural.constructs.push(record);
    return record.id;
  }
  function subclass(superTerm, id = "relation") {
    construct({ id, kind: "subclass", sub: "A", super: superTerm });
    if (nodes.has(superTerm))
      edge({
        id: `edge-${id}`,
        kind: "subclass-edge",
        construct: id,
        from: nodes.get("A"),
        to: nodes.get(superTerm),
      });
  }
  function operator(record) {
    expression(record);
    const from = node(`node-${record.id}`, [record.id]);
    const terms = record.members ?? [record.operand];
    const reached = new Set();
    for (const term of terms)
      if (nodes.has(term) && !reached.has(nodes.get(term))) {
        const to = nodes.get(term);
        reached.add(to);
        edge(
          {
            id: `operator-${record.id}-${reached.size}`,
            kind: "operator-edge",
            expression: record.id,
            from,
            to,
          },
          false,
        );
      }
    return record.id;
  }
  function annotation() {
    if (!structural.roles.some((value) => value.id === "note"))
      role("note", "annotation-property");
    if (!structural.roles.some((value) => value.id === "string"))
      role("string", "datatype", xsd + "string");
    return {
      predicate: ex + "note",
      value: {
        kind: "typed",
        lexical: "Exact annotation",
        datatype: xsd + "string",
      },
      annotations: [],
    };
  }
  for (const name of names) {
    role(name, "class");
    node(`node-${name}`, [name]);
  }
  return {
    source,
    structural,
    nodes,
    role,
    node,
    edge,
    property,
    expression,
    construct,
    subclass,
    operator,
    annotation,
  };
}

const vectors = [];
const add = (id, builder, rules, interpretation) =>
  vectors.push({
    id,
    source: builder.source,
    rules,
    ...(interpretation ? { interpretation } : {}),
  });

for (const kind of ["class-intersection", "class-complement"]) {
  const m = model();
  m.operator({
    id: "expression",
    kind,
    ...(kind === "class-complement"
      ? { operand: "B" }
      : { members: ["A", "B"] }),
  });
  m.subclass("expression");
  add(kind, m, ["A3", "B2.1", "B2.4"]);
}
{
  const m = model();
  m.role("i", "individual");
  m.role("j", "individual", null);
  m.expression({
    id: "expression",
    kind: "class-enumeration",
    members: ["i", "j"],
  });
  m.subclass("expression");
  add("class-enumeration", m, ["A2", "A3", "B2.5"]);
}
for (const kind of ["object-all", "object-value", "object-self"]) {
  const m = model();
  m.property("p");
  const record = { id: "expression", kind, property: "p" };
  if (kind === "object-all") record.filler = "B";
  if (kind === "object-value") {
    m.role("i", "individual");
    record.value = "i";
  }
  m.expression(record);
  m.subclass("expression");
  add(kind, m, ["A3", "B2.5"]);
}
for (const kind of ["data-some", "data-all", "data-value"]) {
  const m = model();
  m.role("integer", "datatype", xsd + "integer");
  m.property("p", "data-property", "A", "integer");
  m.expression({
    id: "expression",
    kind,
    property: "p",
    ...(kind === "data-value"
      ? { value: { kind: "typed", lexical: "01", datatype: xsd + "integer" } }
      : { filler: "integer" }),
  });
  m.subclass("expression");
  add(kind, m, ["A2", "A3", "A6.3", "B2.5"]);
}
{
  const m = model();
  m.property("p");
  m.property("q", "object-property", "B", "A");
  m.expression({
    id: "inverse-expression",
    kind: "object-inverse",
    property: "p",
  });
  m.construct({
    id: "relation",
    kind: "sub-object-property",
    sub: "inverse-expression",
    super: "q",
  });
  add("object-inverse", m, ["A3", "A4", "B2.5"]);
}
for (const kind of [
  "data-intersection",
  "data-union",
  "data-complement",
  "data-enumeration",
  "datatype-restriction",
]) {
  const m = model([]);
  m.role("defined", "datatype");
  m.role("integer", "datatype", xsd + "integer");
  const expression = { id: "expression", kind };
  if (kind === "data-intersection" || kind === "data-union") {
    m.role("decimal", "datatype", xsd + "decimal");
    expression.members = ["integer", "decimal"];
  } else if (kind === "data-complement") expression.operand = "integer";
  else if (kind === "data-enumeration") {
    m.role("language", "datatype", rdf + "langString");
    expression.members = [
      { kind: "typed", lexical: "01", datatype: xsd + "integer" },
      { kind: "typed", lexical: "1", datatype: xsd + "integer" },
      { kind: "language", lexical: "colour", language: "en-gb" },
    ];
  } else {
    expression.datatype = "integer";
    expression.facets = [
      {
        facet: xsd + "minInclusive",
        value: { kind: "typed", lexical: "01", datatype: xsd + "integer" },
      },
      {
        facet: xsd + "minInclusive",
        value: { kind: "typed", lexical: "2", datatype: xsd + "integer" },
      },
    ];
  }
  m.expression(expression);
  m.construct({
    id: "definition",
    kind: "datatype-definition",
    datatype: "defined",
    target: "expression",
  });
  add(kind, m, ["A2", "A3", "A4", "A6.3", "B2.5"]);
}
{
  const m = model(["A", "B", "C"]);
  m.construct({
    id: "relation",
    kind: "disjoint-union",
    defined: "A",
    members: ["B", "C"],
  });
  add("disjoint-union", m, ["A4", "B2.5"]);
}
for (const family of ["object", "data", "rdf"]) {
  for (const relation of ["sub", "equivalent", "disjoint"]) {
    const m = model(["A", "B", "C"]);
    const kind = `${family}-property`;
    const grouped = relation === "equivalent";
    if (family === "data") {
      m.role("D", "datatype");
      if (!grouped) m.role("E", "datatype");
    }
    const pRange = family === "data" ? "D" : "B";
    const qRange = grouped ? pRange : family === "data" ? "E" : "C";
    m.property("p", kind, "A", pRange, !grouped);
    m.property("q", kind, grouped ? "A" : "B", qRange, !grouped);
    const token =
      relation === "sub"
        ? `sub-${family}-property`
        : `${relation}-${family}-properties`;
    m.construct({
      id: "relation",
      kind: token,
      ...(relation === "sub"
        ? { sub: "p", super: "q" }
        : { members: ["q", "p"] }),
    });
    if (grouped) {
      let to = m.nodes.get(pRange);
      if (family === "data") {
        to = "datatype-group";
        m.structural.occurrences.push({
          id: to,
          kind: "datatype-node",
          target: "D",
          context: { kind: "property", properties: ["p", "q"] },
        });
      }
      m.edge({
        id: "grouped-edge",
        kind: "property-edge",
        properties: ["p", "q"],
        from: "node-A",
        to,
      });
    }
    add(token, m, ["A4", "B2.2", "B2.4", "B2.5"]);
  }
}
for (const characteristic of [
  "functional",
  "inverse-functional",
  "symmetric",
  "asymmetric",
  "transitive",
  "reflexive",
  "irreflexive",
]) {
  const m = model();
  m.property("p");
  m.construct({
    id: "relation",
    kind: "object-characteristic",
    property: "p",
    characteristic,
  });
  add(`object-characteristic-${characteristic}`, m, ["A4", "B2.4", "B2.5"]);
}
for (const family of ["data", "rdf"]) {
  const m = model();
  if (family === "data") m.role("D", "datatype");
  m.property("p", `${family}-property`, "A", family === "data" ? "D" : "B");
  m.construct({
    id: "relation",
    kind: `${family}-characteristic`,
    property: "p",
    characteristic: "functional",
  });
  add(`${family}-characteristic`, m, ["A4", "B2.4", "B2.5"]);
}
for (const kind of [
  "sub-annotation-property",
  "annotation-domain",
  "annotation-range",
]) {
  const m = model([]);
  m.role("p", "annotation-property");
  if (kind === "sub-annotation-property") {
    m.role("q", "annotation-property");
    m.construct({ id: "relation", kind, sub: "p", super: "q" });
  } else
    m.construct({
      id: "relation",
      kind,
      property: "p",
      target: "urn:example:target",
    });
  add(kind, m, ["A4", "A6.3", "B2.5"]);
}
{
  const m = model();
  m.property("p");
  m.role("D", "datatype");
  m.property("q", "data-property", "A", "D");
  m.construct({
    id: "key",
    kind: "key",
    class: "A",
    objectProperties: ["p"],
    dataProperties: ["q"],
  });
  add("nonempty-key", m, ["A4", "B2.5"]);
}
{
  const m = model();
  m.role("punned", "individual", ex + "A");
  m.role("anonymous", "individual", null);
  m.construct({
    id: "direct",
    kind: "class-membership",
    class: "A",
    individual: "punned",
  });
  m.operator({ id: "union", kind: "class-union", members: ["A", "B"] });
  m.construct({
    id: "complex",
    kind: "class-membership",
    class: "union",
    individual: "anonymous",
  });
  add("class-membership-and-punning", m, ["A2", "A4", "B2.5"]);
}
{
  const m = model();
  m.property("p");
  m.role("D", "datatype");
  m.role("p-data", "data-property", ex + "p");
  m.construct({
    id: "data-domain",
    kind: "data-domain",
    property: "p-data",
    target: "A",
  });
  m.construct({
    id: "data-range",
    kind: "data-range",
    property: "p-data",
    target: "D",
  });
  m.structural.occurrences.push({
    id: "datatype-data-pun",
    kind: "datatype-node",
    target: "D",
    context: { kind: "property", properties: ["p-data"] },
  });
  m.edge({
    id: "data-pun-edge",
    kind: "property-edge",
    properties: ["p-data"],
    from: "node-A",
    to: "datatype-data-pun",
  });
  add("object-data-property-punning", m, ["A2", "B2.2"]);
}
{
  const m = model(["A"]);
  m.property("p", "object-property", "A", "A", false);
  m.construct({ id: "inverse", kind: "inverse-properties", members: ["p"] });
  m.edge(
    {
      id: "inverse-edge",
      kind: "inverse-edge",
      construct: "inverse",
      forward: ["p"],
      reverse: ["p"],
      from: "node-A",
      to: "node-A",
    },
    false,
  );
  for (const direction of ["forward", "reverse"])
    m.structural.occurrences.push({
      id: `${direction}-label`,
      kind: "label",
      edge: "inverse-edge",
      direction,
    });
  add("singleton-inverse-self-loop", m, ["A4", "B2.4"]);
}
{
  const m = model();
  m.property("p", "object-property", "A", "B", false);
  for (const reverse of ["q", "r"]) {
    m.property(reverse, "object-property", "B", "A", false);
    m.construct({
      id: `inverse-${reverse}`,
      kind: "inverse-properties",
      members: ["p", reverse],
    });
    m.edge(
      {
        id: `inverse-edge-${reverse}`,
        kind: "inverse-edge",
        construct: `inverse-${reverse}`,
        forward: ["p"],
        reverse: [reverse],
        from: "node-A",
        to: "node-B",
      },
      false,
    );
    for (const direction of ["forward", "reverse"])
      m.structural.occurrences.push({
        id: `${direction}-label-${reverse}`,
        kind: "label",
        edge: `inverse-edge-${reverse}`,
        direction,
      });
  }
  add("multiple-explicit-inverse-pairs", m, ["B2.4"]);
}
{
  const m = model(["A", "B", "C"]);
  m.property("p", "object-property", "A", "B");
  m.property("q", "object-property", "A", "C");
  m.construct({
    id: "equivalence",
    kind: "equivalent-object-properties",
    members: ["p", "q"],
  });
  add("unequal-equivalent-property-endpoints", m, ["B2.2"]);
}
{
  const m = model(["A", "B", "C"]);
  m.property("p", "object-property", "A", "B", false);
  m.property("q", "object-property", "A", "B", false);
  m.property("r", "object-property", "B", "C");
  m.expression({
    id: "inverse-expression",
    kind: "object-inverse",
    property: "r",
  });
  m.construct({
    id: "equivalence",
    kind: "equivalent-object-properties",
    members: ["p", "q", "inverse-expression"],
  });
  m.edge({
    id: "grouped-edge",
    kind: "property-edge",
    properties: ["p", "q"],
    from: "node-A",
    to: "node-B",
  });
  add("partial-property-group-with-inverse-expression", m, ["A3", "B2.2"]);
}
{
  const m = model(["A", "B", "C", "D"]);
  m.structural.occurrences = m.structural.occurrences.filter(
    (occurrence) => occurrence.id !== "node-A" && occurrence.id !== "node-B",
  );
  m.node("group-AB", ["A", "B"]);
  m.role("anonymous-class", "class", null);
  m.node("anonymous-node", ["anonymous-class"]);
  m.role("Thing", "class", owl + "Thing");
  m.operator({ id: "union", kind: "class-union", members: ["C", "D"] });
  m.construct({
    id: "equivalence",
    kind: "equivalent-classes",
    members: ["A", "B", "Thing", "anonymous-class", "union"],
  });
  add("partial-class-group-exclusions", m, ["B2.1"]);
}
for (const declaredDefault of [false, true]) {
  const m = model();
  m.property("q");
  m.expression({
    id: "range-expression",
    kind: "object-some",
    property: "q",
    filler: "B",
  });
  m.property("p", "object-property", null, "range-expression", false);
  if (declaredDefault) m.role("Thing", "class", owl + "Thing");
  add(
    declaredDefault
      ? "undrawable-range-declared-thing"
      : "undrawable-range-no-default-role",
    m,
    ["A2", "A5", "B2.1", "B2.2"],
    "Only drawable projections require absent-endpoint builtin roles; an explicit generic declaration may remain details-only. Pending protocol review.",
  );
}
for (const target of ["outer", "inner", "C"]) {
  const m = model(["A", "B", "C"]);
  m.operator({ id: "inner", kind: "class-intersection", members: ["A", "B"] });
  m.operator({
    id: "outer",
    kind: "class-intersection",
    members: ["inner", "C"],
  });
  m.property("p", "object-property", "outer", "C");
  m.construct({
    id: "anchor",
    kind: "assertion-anchor",
    assertion: { kind: "object-domain", property: "p", target },
    annotations: [m.annotation()],
  });
  add(`aggregate-anchor-${target}`, m, ["A3", "A4", "A5", "B2.4"]);
}

{
  const m = model(["A"]);
  m.role("D", "datatype");
  m.property("p", "data-property", "A", "D");
  m.construct({
    id: "relation",
    kind: "disjoint-data-properties",
    members: ["p"],
  });
  add("singleton-disjoint-data-properties", m, ["A3", "A4", "B2.5"]);
}
for (const [id, ceiling] of [
  ["disjoint-data-properties", 47],
  ["multiple-explicit-inverse-pairs", 43],
]) {
  const vector = vectors.find((value) => value.id === id);
  vector.expectedError = "RDFC_RESOURCE_LIMIT";
  vector.expectedDeepIterations = ceiling;
}

for (const roleKind of ["class", "rdf-class"]) {
  const m = model([]);
  m.role("Resource", roleKind, "http://www.w3.org/2000/01/rdf-schema#Resource");
  m.role("p", "rdf-property");
  m.node("generic-resource", ["Resource"], {
    kind: "class",
    targets: ["Resource"],
  });
  m.edge({
    id: "resource-edge",
    kind: "property-edge",
    properties: ["p"],
    from: "generic-resource",
    to: "generic-resource",
  });
  add(`rdf-property-resource-${roleKind}`, m, ["A2", "B1", "B2.2", "B2.3"]);
}
{
  const m = model();
  m.construct({
    id: "disjoint",
    kind: "disjoint-classes",
    members: ["A", "B"],
  });
  m.edge(
    {
      id: "disjoint-edge",
      kind: "disjoint-edge",
      construct: "disjoint",
      ends: ["node-A", "node-B"],
    },
    false,
  );
  add("disjoint-two-distinct-ends", m, ["A4", "B1", "B2.4"]);
}
for (const condition of ["anonymous-subclass", "inverse-property"]) {
  const source = structuredClone(
    extendedSources.find((value) => value.id === "object-exact-unqualified")
      .source,
  );
  source.structural.occurrences = source.structural.occurrences.filter(
    (occurrence) =>
      ![
        "restriction-target",
        "restriction-edge",
        "label-restriction-edge",
      ].includes(occurrence.id),
  );
  if (condition === "anonymous-subclass")
    delete source.structural.subjects.find((subject) => subject.id === "s-A")
      .iri;
  else {
    source.structural.expressions.push({
      id: "inverse-expression",
      kind: "object-inverse",
      property: "p",
    });
    source.structural.expressions.find(
      (expression) => expression.id === "restriction",
    ).property = "inverse-expression";
  }
  add(`restriction-ineligible-${condition}`, { source }, ["A3", "B1", "B2.4"]);
}
{
  const m = model(["A"]);
  m.role("Thing", "class", owl + "Thing");
  m.role("p", "object-property");
  m.node("generic-global", ["Thing"], { kind: "class", targets: ["Thing"] });
  m.edge({
    id: "global-edge",
    kind: "property-edge",
    properties: ["p"],
    from: "generic-global",
    to: "generic-global",
  });
  for (const [bound, cardinality] of [
    ["min", "0"],
    ["max", "2"],
  ]) {
    m.expression({
      id: `restriction-${bound}`,
      kind: `object-${bound}-cardinality`,
      property: "p",
      filler: "Thing",
      cardinality,
    });
    m.construct({
      id: `assertion-${bound}`,
      kind: "subclass",
      sub: "A",
      super: `restriction-${bound}`,
    });
    m.node(`scoped-${bound}`, ["Thing"], {
      kind: "property",
      properties: ["p"],
      scope: `assertion-${bound}`,
    });
    m.edge({
      id: `edge-${bound}`,
      kind: "restriction-edge",
      construct: `assertion-${bound}`,
      from: "node-A",
      to: `scoped-${bound}`,
    });
  }
  add("two-restrictions-distinct-scopes", m, ["A3", "B1", "B2.3", "B2.4"]);
}
for (const hidden of ["node", "edge", "label"]) {
  const source = structuredClone(
    extendedSources.find((value) => value.id === "asymmetric-subclass").source,
  );
  source.visualization = {
    placements: [
      { occurrence: "node-A", position: { x: 0, y: 0 }, pinned: true },
      { occurrence: "node-B", position: { x: 100, y: 50 }, pinned: false },
      {
        occurrence: "label-subclass-edge",
        position: { x: 50, y: 25 },
        pinned: true,
      },
    ],
    camera: { center: { x: 50, y: 25 }, zoom: 2 },
    hidden: [
      ...(hidden === "node" ? ["node-A"] : []),
      ...(hidden === "node" || hidden === "edge" ? ["subclass-edge"] : []),
      "label-subclass-edge",
    ],
    labelSelection: { mode: "iri" },
    prefixes: [],
    display: {
      compactNotation: false,
      nodeScaling: "uniform",
      externalColoring: true,
    },
  };
  add(`artifact-hidden-${hidden}-closure`, { source }, ["B1", "B3", "B4"]);
}
for (const tag of [
  "i-klingon",
  "en-GB-oed",
  "sgn-BE-FR",
  "zh-min-nan",
  "de-Latn-DE-1901-a-aaa-x-private",
]) {
  const m = model(["A"]);
  m.role("note", "annotation-property");
  m.role("language", "datatype", rdf + "langString");
  m.construct({
    id: "annotation",
    kind: "annotation-assertion",
    subject: "subject-A",
    predicate: ex + "note",
    value: { kind: "language", lexical: "Exact label", language: tag },
  });
  add(`language-${tag.toLowerCase()}`, m, ["A2", "A6.3", "A7"]);
}
for (const lexical of ["01", "1"]) {
  const m = model(["A"]);
  m.role("note", "annotation-property");
  m.role("integer", "datatype", xsd + "integer");
  m.construct({
    id: "annotation",
    kind: "annotation-assertion",
    subject: "subject-A",
    predicate: ex + "note",
    value: { kind: "typed", lexical, datatype: xsd + "integer" },
  });
  add(`typed-integer-lexical-${lexical}`, m, ["A2", "A6.3"]);
}
{
  const m = model(["A"]);
  m.role("note", "annotation-property");
  m.structural.subjects.find((subject) => subject.id === "subject-A").id =
    "urn:example:source-handle";
  m.structural.roles.find((role) => role.id === "A").subject =
    "urn:example:source-handle";
  m.construct({
    id: "annotation",
    kind: "annotation-assertion",
    subject: "urn:example:source-handle",
    predicate: ex + "note",
    value: { kind: "iri", iri: "urn:example:source-handle" },
  });
  add("iri-value-equals-source-handle", m, ["A1", "A2", "A6.3"]);
}

{
  const source = structuredClone(
    extendedSources.find((value) => value.id === "matched-inverse").source,
  );
  source.structural.subjects.find((subject) => subject.id === "s-p").iri =
    "https://example.org/orientation/0#a";
  source.structural.subjects.find((subject) => subject.id === "s-q").iri =
    "https://example.org/orientation/0#z";
  add(
    "inverse-orientation-opposes-role-rank",
    { source },
    ["A4", "B1", "B2.4"],
    "Forward uses the smaller representative semantic IRI even when its canonical role ID is larger. Inverse from/to use the forward partition domain/range.",
  );
}

export const grammarSources = vectors;
