// SPDX-License-Identifier: AGPL-3.0-only
// Hand-selected B2 branches. Helpers write the explicitly listed topology only.
import { extendedSources } from "../../oracle/extended-sources.mjs";
import { grammarSources } from "../grammar/sources.mjs";
const ex = "https://example.org/conditional#";
const owl = "http://www.w3.org/2002/07/owl#";
const rdfs = "http://www.w3.org/2000/01/rdf-schema#";
const oldSource = (id) =>
  structuredClone(
    [...extendedSources, ...grammarSources].find((value) => value.id === id)
      .source,
  );
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
  const s = source.structural;
  function role(id, kind, iri = ex + id) {
    let subject =
      iri === null
        ? undefined
        : s.subjects.find((record) => record.iri === iri);
    if (!subject) {
      subject = { id: `s-${id}`, ...(iri === null ? {} : { iri }) };
      s.subjects.push(subject);
    }
    s.roles.push({ id, kind, subject: subject.id });
    return id;
  }
  function node(id, targets, context) {
    s.occurrences.push({
      id,
      kind: "class-node",
      targets,
      ...(context ? { context } : {}),
    });
    return id;
  }
  function dataNode(id, target, properties, scope) {
    s.occurrences.push({
      id,
      kind: "datatype-node",
      target,
      context: { kind: "property", properties, ...(scope ? { scope } : {}) },
    });
    return id;
  }
  function edge(record, labels = ["single"]) {
    s.occurrences.push(record);
    for (const direction of labels)
      s.occurrences.push({
        id: `label-${record.id}-${direction}`,
        kind: "label",
        edge: record.id,
        direction,
      });
  }
  function fact(id, kind, fields) {
    s.constructs.push({ id, kind, ...fields });
    return id;
  }
  function property(id, family = "object", domain, range) {
    role(id, `${family}-property`);
    if (domain)
      fact(`domain-${id}`, `${family}-domain`, {
        property: id,
        target: domain,
      });
    if (range)
      fact(`range-${id}`, `${family}-range`, { property: id, target: range });
  }
  function pe(id, properties, from, to) {
    edge({ id, kind: "property-edge", properties, from, to });
  }
  function expression(record) {
    s.expressions.push(record);
    return record.id;
  }
  function operator(record, operandNodes) {
    expression(record);
    const from = node(`node-${record.id}`, [record.id]);
    for (const [index, to] of operandNodes.entries())
      edge(
        {
          id: `operator-${record.id}-${index}`,
          kind: "operator-edge",
          expression: record.id,
          from,
          to,
        },
        [],
      );
    return from;
  }
  for (const name of names) {
    role(name, "class");
    node(`node-${name}`, [name]);
  }
  return {
    source,
    s,
    role,
    node,
    dataNode,
    edge,
    fact,
    property,
    pe,
    expression,
    operator,
  };
}
const sources = [];
const add = (id, source, clauses, note) =>
  sources.push({
    id,
    source: source.source ?? source,
    clauses,
    ...(note ? { note } : {}),
  });

{
  const m = model([]);
  m.role("named", "rdf-class");
  m.role("anonymous", "rdf-class", null);
  m.node("node-named", ["named"]);
  m.node("node-anonymous", ["anonymous"]);
  add("rdfs-named-and-anonymous-singletons", m, [
    "B21-role-drawability",
    "B21-anonymous-singletons",
  ]);
}
{
  const m = model([]);
  m.role("A", "class");
  m.role("B", "rdf-class");
  m.fact("eq", "equivalent-classes", { members: ["A", "B"] });
  m.node("group", ["A", "B"]);
  add("mixed-class-rdfs-equivalence-group", m, ["B21-named-components"]);
}
{
  const m = model([]);
  m.role("Thing", "class", owl + "Thing");
  m.role("Resource", "rdf-class", rdfs + "Resource");
  m.role("D", "datatype");
  add("unattached-generics-and-datatype", m, [
    "B21-unattached-generic",
    "B21-unattached-datatype",
  ]);
}
for (const mode of ["grouped", "shared", "split"]) {
  const m = model(mode === "shared" ? ["A"] : ["A", "B"]);
  m.role("Thing", "class", owl + "Thing");
  if (mode === "grouped") {
    m.s.occurrences = [];
    m.node("group", ["A", "B"]);
    m.fact("eq-classes", "equivalent-classes", { members: ["A", "B"] });
    m.fact("eq-properties", "equivalent-object-properties", {
      members: ["p", "q"],
    });
  }
  m.property("p", "object", "Thing", "A");
  m.property("q", "object", "Thing", mode === "shared" ? "A" : "B");
  if (mode === "grouped") {
    m.node("generic", ["Thing"], { kind: "class", targets: ["A", "B"] });
    m.pe("edge-p", ["p"], "generic", "group");
    m.pe("edge-q", ["q"], "generic", "group");
  } else if (mode === "shared") {
    m.node("generic", ["Thing"], { kind: "class", targets: ["A"] });
    m.pe("edge-p", ["p"], "generic", "node-A");
    m.pe("edge-q", ["q"], "generic", "node-A");
  } else {
    for (const [property, target] of [
      ["p", "A"],
      ["q", "B"],
    ]) {
      m.node(`generic-${target}`, ["Thing"], {
        kind: "class",
        targets: [target],
      });
      m.pe(
        `edge-${property}`,
        [property],
        `generic-${target}`,
        `node-${target}`,
      );
    }
  }
  add(`generic-context-${mode}`, m, [
    "B23-opposite-class-targets",
    mode === "split" ? "B23-split-contexts" : "B23-reuse-keys",
    ...(mode === "grouped" ? ["B22-exact-terms-not-glyphs"] : []),
  ]);
}
for (const family of ["object", "data", "rdf"])
  for (const missing of ["domain", "range"]) {
    const m = model(["A"]);
    const generic = family === "rdf" ? "Resource" : "Thing";
    if (missing === "domain" || family !== "data")
      m.role(
        generic,
        family === "rdf" ? "rdf-class" : "class",
        family === "rdf" ? rdfs + "Resource" : owl + "Thing",
      );
    if (family === "data")
      m.role(
        missing === "domain" ? "D" : "Literal",
        "datatype",
        missing === "domain" ? ex + "D" : rdfs + "Literal",
      );
    m.property(
      "p",
      family,
      missing === "domain" ? undefined : "A",
      missing === "range" ? undefined : family === "data" ? "D" : "A",
    );
    if (family === "data") {
      const to = m.dataNode(
        "datatype",
        missing === "domain" ? "D" : "Literal",
        ["p"],
      );
      const from =
        missing === "domain"
          ? m.node("generic", [generic], {
              kind: "property",
              properties: ["p"],
            })
          : "node-A";
      m.pe("edge", ["p"], from, to);
    } else {
      m.node("generic", [generic], { kind: "class", targets: ["A"] });
      m.pe(
        "edge",
        ["p"],
        missing === "domain" ? "generic" : "node-A",
        missing === "range" ? "generic" : "node-A",
      );
    }
    add(`${family}-one-absent-${missing}`, m, [
      `B22-${family}-defaults`,
      "B22-defaults-not-facts",
      family === "data"
        ? "B23-opposite-datatype-context"
        : "B23-opposite-class-targets",
    ]);
  }
{
  const m = model([]);
  m.role("Resource", "rdf-class", rdfs + "Resource");
  m.role("D", "datatype");
  m.property("p", "rdf", undefined, "D");
  m.node("generic", ["Resource"], { kind: "property", properties: ["p"] });
  m.dataNode("datatype", "D", ["p"]);
  m.pe("edge", ["p"], "generic", "datatype");
  add("rdf-named-datatype-range", m, [
    "B22-rdf-datatype-range",
    "B23-opposite-datatype-context",
  ]);
}
for (const family of ["data", "rdf"]) {
  const m = model(["A"]);
  m.role("D", "datatype");
  m.role("E", "datatype");
  m.expression({ id: "range", kind: "data-intersection", members: ["D", "E"] });
  m.property("p", family, "A", "range");
  add(`${family}-compound-range-details`, m, [
    "B22-compound-data-details",
    `B25-${family}-property-details`,
  ]);
}
for (const family of ["object", "data", "rdf"]) {
  const m = model();
  m.property("q", "object", "A", "B");
  m.pe("edge-q", ["q"], "node-A", "node-B");
  m.expression({
    id: "complex",
    kind: "object-some",
    property: "q",
    filler: "B",
  });
  if (family === "data") m.role("D", "datatype");
  m.property("p", family, "complex", family === "data" ? "D" : "B");
  add(`${family}-undrawable-domain-details`, m, [
    "B22-undrawable-domain",
    `B25-${family}-property-details`,
  ]);
}
{
  const m = model();
  m.role("Thing", "class", owl + "Thing");
  m.property("p");
  m.expression({ id: "inverse", kind: "object-inverse", property: "p" });
  m.fact("inverse-domain", "object-domain", {
    property: "inverse",
    target: "A",
  });
  m.fact("inverse-range", "object-range", { property: "inverse", target: "B" });
  m.node("generic", ["Thing"], { kind: "class", targets: ["Thing"] });
  m.pe("edge-p", ["p"], "generic", "generic");
  add("inverse-endpoints-not-propagated", m, [
    "B22-inverse-expression-endpoint-facts",
  ]);
}
for (const relation of ["equivalent", "inverse"]) {
  const m = model();
  m.role("Thing", "class", owl + "Thing");
  m.property("p", "object", "A", "B");
  m.property("q");
  m.fact(
    "relation",
    relation === "equivalent"
      ? "equivalent-object-properties"
      : "inverse-properties",
    { members: ["p", "q"] },
  );
  m.node("generic", ["Thing"], { kind: "class", targets: ["Thing"] });
  m.pe("edge-p", ["p"], "node-A", "node-B");
  m.pe("edge-q", ["q"], "generic", "generic");
  add(
    relation === "inverse"
      ? "inverse-pair-endpoints-not-propagated"
      : "equivalent-endpoints-not-propagated",
    m,
    [
      "B22-no-endpoint-inference",
      ...(relation === "inverse"
        ? ["B24-inverse-not-reversed"]
        : ["B22-unequal-partitions"]),
    ],
  );
}
for (const family of ["object", "data", "rdf"])
  for (const variant of ["transitive", "partitioned"]) {
    const m = model(["A", "B", "C"]);
    if (family === "data") {
      m.role("D", "datatype");
      m.role("E", "datatype");
    }
    const common = family === "data" ? "D" : "B",
      other = family === "data" ? "E" : "C";
    for (const property of ["p", "q", "r"])
      m.property(
        property,
        family,
        "A",
        variant === "partitioned" && property === "r" ? other : common,
      );
    if (variant === "transitive") {
      m.fact("eq-pq", `equivalent-${family}-properties`, {
        members: ["p", "q"],
      });
      m.fact("eq-qr", `equivalent-${family}-properties`, {
        members: ["q", "r"],
      });
    } else
      m.fact("eq", `equivalent-${family}-properties`, {
        members: ["p", "q", "r"],
      });
    const partition = variant === "transitive" ? ["p", "q", "r"] : ["p", "q"];
    const to =
      family === "data"
        ? m.dataNode("datatype-main", common, partition)
        : `node-${common}`;
    m.pe("edge-main", partition, "node-A", to);
    if (variant === "partitioned") {
      const toOther =
        family === "data"
          ? m.dataNode("datatype-other", other, ["r"])
          : `node-${other}`;
      m.pe("edge-r", ["r"], "node-A", toOther);
    }
    add(`${family}-equivalence-${variant}`, m, [
      "B22-property-components",
      variant === "transitive"
        ? "B22-transitive-property-components"
        : "B22-unequal-partitions",
      ...(family === "data" ? ["B23-full-partition-context"] : []),
    ]);
  }
for (const family of ["object", "data"]) {
  const source = oldSource(`${family}-exact-unqualified`),
    s = source.structural;
  s.subjects.push({ id: "s-q", iri: "https://example.org/o#q" });
  s.roles.push({ id: "q", kind: `${family}-property`, subject: "s-q" });
  s.constructs.push({
    id: "eq",
    kind: `equivalent-${family}-properties`,
    members: ["p", "q"],
  });
  s.occurrences.find((o) => o.id === "global-edge").properties = ["p", "q"];
  if (family === "data")
    for (const o of s.occurrences)
      if (o.context?.kind === "property" && !o.context.scope)
        o.context.properties = ["p", "q"];
  add(`${family}-restriction-excludes-global-alias`, source, [
    "B23-restriction-exact-role",
    "B23-full-partition-context",
  ]);
}
{
  const m = model();
  for (const property of ["p", "p2"]) m.property(property, "object", "A", "B");
  for (const property of ["q", "q2"]) m.property(property, "object", "B", "A");
  m.fact("eq-p", "equivalent-object-properties", { members: ["p", "p2"] });
  m.fact("eq-q", "equivalent-object-properties", { members: ["q", "q2"] });
  m.fact("inverse", "inverse-properties", { members: ["p", "q"] });
  m.edge(
    {
      id: "inverse-edge",
      kind: "inverse-edge",
      construct: "inverse",
      forward: ["p", "p2"],
      reverse: ["q", "q2"],
      from: "node-A",
      to: "node-B",
    },
    ["forward", "reverse"],
  );
  add("inverse-full-property-partitions", m, [
    "B24-inverse-partitions",
    "B24-inverse-orientation",
    "B24-inverse-replacement",
  ]);
}
{
  const m = model(["A"]);
  m.property("p", "object", "A", "A");
  m.property("q", "object", "A", "A");
  m.fact("inverse", "inverse-properties", { members: ["p", "q"] });
  m.edge(
    {
      id: "inverse-edge",
      kind: "inverse-edge",
      construct: "inverse",
      forward: ["p"],
      reverse: ["q"],
      from: "node-A",
      to: "node-A",
    },
    ["forward", "reverse"],
  );
  add("inverse-two-distinct-partitions-self-loop", m, [
    "B24-inverse-reversed",
    "B24-inverse-self-loop",
  ]);
}
{
  const m = model();
  m.property("p", "object", "A", "B");
  m.property("q", "object", "B", "A");
  m.expression({ id: "inverse-q", kind: "object-inverse", property: "q" });
  m.fact("inverse", "inverse-properties", { members: ["p", "inverse-q"] });
  m.pe("edge-p", ["p"], "node-A", "node-B");
  m.pe("edge-q", ["q"], "node-B", "node-A");
  add("inverse-expression-member-details", m, ["B24-inverse-named-members"]);
}
{
  const m = model();
  m.property("q", "object", "B", "A");
  m.pe("edge-q", ["q"], "node-B", "node-A");
  m.expression({
    id: "complex",
    kind: "object-all",
    property: "q",
    filler: "A",
  });
  m.property("p", "object", "A", "complex");
  m.fact("inverse", "inverse-properties", { members: ["p", "q"] });
  add("inverse-one-undrawable-partition", m, [
    "B24-inverse-drawable-both",
    "B22-undrawable-range",
  ]);
}
{
  const m = model();
  m.property("p", "object", "A", "B");
  m.pe("edge-p", ["p"], "node-A", "node-B");
  m.fact("inverse", "inverse-properties", { members: ["p"] });
  add("singleton-inverse-nonloop-details", m, [
    "B24-inverse-singleton",
    "B24-inverse-not-reversed",
  ]);
}
for (const mode of ["triad", "aliases", "singleton"]) {
  const m = model(mode === "singleton" ? ["A"] : ["A", "B", "C"]);
  if (mode === "aliases") {
    m.s.occurrences = m.s.occurrences.filter(
      (o) => !["node-A", "node-B"].includes(o.id),
    );
    m.node("group", ["A", "B"]);
    m.fact("eq", "equivalent-classes", { members: ["A", "B"] });
  }
  m.fact("disjoint", "disjoint-classes", {
    members: mode === "singleton" ? ["A"] : ["A", "B", "C"],
  });
  const pairs =
    mode === "singleton"
      ? [["node-A"]]
      : mode === "aliases"
        ? [["group"], ["group", "node-C"]]
        : [
            ["node-A", "node-B"],
            ["node-A", "node-C"],
            ["node-B", "node-C"],
          ];
  for (const [index, ends] of pairs.entries())
    m.edge(
      {
        id: `disjoint-${index}`,
        kind: "disjoint-edge",
        construct: "disjoint",
        ends,
      },
      [],
    );
  add(`disjoint-${mode}`, m, [
    "B24-disjoint-pairs",
    mode === "aliases"
      ? "B24-disjoint-pair-dedup"
      : mode === "singleton"
        ? "B24-disjoint-singleton"
        : "B24-disjoint-one-construct",
  ]);
}
for (const count of [0, 1, 2]) {
  const m = model();
  m.property("p", "object", "A", "B");
  m.pe("edge-p", ["p"], "node-A", "node-B");
  m.expression({ id: "some", kind: "object-some", property: "p", filler: "A" });
  if (count === 0)
    m.expression({ id: "all", kind: "object-all", property: "p", filler: "B" });
  m.fact("disjoint", "disjoint-classes", {
    members:
      count === 0
        ? ["some", "all"]
        : count === 1
          ? ["A", "some"]
          : ["A", "B", "some"],
  });
  if (count === 2)
    m.edge(
      {
        id: "disjoint-edge",
        kind: "disjoint-edge",
        construct: "disjoint",
        ends: ["node-A", "node-B"],
      },
      [],
    );
  add(`disjoint-${count}-drawable-members`, m, [
    "B24-disjoint-undrawable",
    ...(count === 1 ? ["B24-disjoint-not-false-singleton"] : []),
  ]);
}
{
  const m = model(["A", "B", "C"]);
  m.s.occurrences = m.s.occurrences.filter(
    (o) => !["node-A", "node-B"].includes(o.id),
  );
  m.node("group", ["A", "B"]);
  m.fact("eq", "equivalent-classes", { members: ["A", "B"] });
  m.operator({ id: "union", kind: "class-union", members: ["A", "B"] }, [
    "group",
  ]);
  m.fact("subclass", "subclass", { sub: "C", super: "union" });
  m.edge({
    id: "subclass-edge",
    kind: "subclass-edge",
    construct: "subclass",
    from: "node-C",
    to: "node-union",
  });
  add("operator-grouped-operand-dedup", m, ["B24-operator-dedup"]);
}
{
  const m = model();
  m.property("p", "object", "A", "B");
  m.pe("edge-p", ["p"], "node-A", "node-B");
  m.expression({ id: "some", kind: "object-some", property: "p", filler: "A" });
  m.expression({ id: "all", kind: "object-all", property: "p", filler: "B" });
  m.operator(
    { id: "union", kind: "class-union", members: ["some", "all"] },
    [],
  );
  m.fact("subclass", "subclass", { sub: "A", super: "union" });
  m.edge({
    id: "subclass-edge",
    kind: "subclass-edge",
    construct: "subclass",
    from: "node-A",
    to: "node-union",
  });
  add("operator-no-drawable-operands", m, [
    "B24-operator-undrawable",
    "B24-operator-derived-cue",
  ]);
}
{
  const m = model(["A"]);
  m.role("Thing", "class", owl + "Thing");
  m.node("generic", ["Thing"], { kind: "class", targets: ["union"] });
  m.operator({ id: "union", kind: "class-union", members: ["A", "Thing"] }, [
    "node-A",
    "generic",
  ]);
  m.fact("subclass", "subclass", { sub: "A", super: "union" });
  m.edge({
    id: "subclass-edge",
    kind: "subclass-edge",
    construct: "subclass",
    from: "node-A",
    to: "node-union",
  });
  add("operator-generic-operand-context", m, ["B23-operator-context"]);
}
{
  const m = model();
  m.role("Thing", "class", owl + "Thing");
  for (const cls of ["A", "B"]) {
    m.node(`generic-${cls}`, ["Thing"], { kind: "class", targets: [cls] });
    m.fact(`sub-${cls}`, "subclass", { sub: cls, super: "Thing" });
    m.edge({
      id: `edge-${cls}`,
      kind: "subclass-edge",
      construct: `sub-${cls}`,
      from: `node-${cls}`,
      to: `generic-${cls}`,
    });
  }
  m.fact("reverse", "subclass", { sub: "Thing", super: "A" });
  m.edge({
    id: "reverse-edge",
    kind: "subclass-edge",
    construct: "reverse",
    from: "generic-A",
    to: "node-A",
  });
  add("subclass-generic-context-reuse-and-split", m, [
    "B23-subclass-context",
    "B23-reuse-keys",
    "B23-split-contexts",
  ]);
}
{
  const m = model(["A"]);
  m.role("Resource", "rdf-class", rdfs + "Resource");
  m.node("generic", ["Resource"], { kind: "class", targets: ["A"] });
  m.fact("disjoint", "disjoint-classes", { members: ["A", "Resource"] });
  m.edge(
    {
      id: "disjoint-edge",
      kind: "disjoint-edge",
      construct: "disjoint",
      ends: ["node-A", "generic"],
    },
    [],
  );
  add("disjoint-generic-context", m, [
    "B23-disjoint-context",
    "B23-rdf-class-generic",
  ]);
}
{
  const m = model();
  m.property("p", "object", "A", "B");
  m.pe("edge-p", ["p"], "node-A", "node-B");
  m.expression({ id: "some", kind: "object-some", property: "p", filler: "B" });
  m.fact("left-undrawable", "subclass", { sub: "some", super: "B" });
  m.fact("right-undrawable", "subclass", { sub: "A", super: "some" });
  add("subclass-either-term-undrawable", m, ["B24-subclass-drawable-both"]);
}
for (const family of ["object", "data"])
  for (const bound of ["min", "max"]) {
    const source = oldSource(`${family}-qualified-details`);
    source.structural.expressions.find((e) => e.id === "restriction").kind =
      `${family}-${bound}-cardinality`;
    add(`${family}-${bound}-qualified-details`, source, [
      "B24-restriction-qualified-details",
    ]);
  }
for (const mode of ["rdf-class", "expression-sub", "other-context"]) {
  const source = oldSource("object-exact-unqualified"),
    s = source.structural;
  if (mode === "rdf-class")
    s.roles.find((role) => role.id === "A").kind = "rdf-class";
  else {
    s.occurrences = s.occurrences.filter(
      (o) =>
        ![
          "restriction-target",
          "restriction-edge",
          "label-restriction-edge",
        ].includes(o.id),
    );
    const assertion = s.constructs.find(
      (c) => c.id === "restriction-assertion",
    );
    if (mode === "other-context")
      s.constructs[s.constructs.indexOf(assertion)] = {
        id: assertion.id,
        kind: "equivalent-classes",
        members: ["A", "restriction"],
      };
    else {
      s.expressions.push({
        id: "operator",
        kind: "class-complement",
        operand: "A",
      });
      assertion.sub = "operator";
      s.occurrences.push(
        { id: "operator-node", kind: "class-node", targets: ["operator"] },
        {
          id: "operator-edge",
          kind: "operator-edge",
          expression: "operator",
          from: "operator-node",
          to: "node-A",
        },
      );
    }
  }
  add(`restriction-${mode}`, source, [
    mode === "rdf-class"
      ? "B24-restriction-rdfs-sub"
      : mode === "expression-sub"
        ? "B24-restriction-named-sub"
        : "B24-restriction-subclass-context",
  ]);
}
{
  const source = oldSource("object-exact-unqualified"),
    s = source.structural;
  s.subjects.push({ id: "s-B", iri: "https://example.org/o#B" });
  s.roles.push({ id: "B", kind: "class", subject: "s-B" });
  s.constructs.push(
    { id: "eq", kind: "equivalent-classes", members: ["A", "B"] },
    {
      id: "second-assertion",
      kind: "subclass",
      sub: "B",
      super: "restriction",
    },
  );
  s.occurrences.find((o) => o.id === "node-A").targets = ["A", "B"];
  s.occurrences.push(
    {
      id: "second-target",
      kind: "class-node",
      targets: ["Thing"],
      context: {
        kind: "property",
        properties: ["p"],
        scope: "second-assertion",
      },
    },
    {
      id: "second-edge",
      kind: "restriction-edge",
      construct: "second-assertion",
      from: "node-A",
      to: "second-target",
    },
    {
      id: "second-label",
      kind: "label",
      edge: "second-edge",
      direction: "single",
    },
  );
  add("restrictions-grouped-subclasses-separate-scopes", source, [
    "B24-restriction-per-construct",
    "B23-restriction-scope",
  ]);
}
{
  const source = oldSource("matched-inverse"),
    s = source.structural;
  s.subjects.push({ id: "s-r", iri: "https://example.org/o#r" });
  s.roles.push({ id: "r", kind: "object-property", subject: "s-r" });
  s.constructs.push(
    { id: "domain-r", kind: "object-domain", property: "r", target: "A" },
    { id: "range-r", kind: "object-range", property: "r", target: "B" },
    { id: "sub-forward", kind: "sub-object-property", sub: "r", super: "p" },
    { id: "sub-reverse", kind: "sub-object-property", sub: "r", super: "q" },
  );
  s.occurrences.push(
    {
      id: "edge-r",
      kind: "property-edge",
      properties: ["r"],
      from: "node-A",
      to: "node-B",
    },
    { id: "label-r", kind: "label", edge: "edge-r", direction: "single" },
  );
  add("subproperty-inverse-directions", source, [
    "B24-subproperty-direction",
    "B24-subproperty-no-extra-occurrence",
  ]);
}
{
  const source = structuredClone(
    sources.find((item) => item.id === "object-undrawable-domain-details")
      .source,
  );
  source.structural.constructs.push({
    id: "subproperty",
    kind: "sub-object-property",
    sub: "p",
    super: "q",
  });
  add("subproperty-missing-projection-details", source, [
    "B24-subproperty-drawable-both",
  ]);
}
{
  const source = oldSource("equivalent-object-properties");
  source.structural.constructs.push(
    {
      id: "principal-characteristic",
      kind: "object-characteristic",
      property: "p",
      characteristic: "symmetric",
    },
    {
      id: "nonprincipal-characteristic",
      kind: "object-characteristic",
      property: "q",
      characteristic: "functional",
    },
  );
  add("characteristics-principal-and-alias", source, [
    "B24-characteristic-principal",
    "B24-characteristic-nonprincipal",
  ]);
}
{
  const source = oldSource("matched-inverse");
  source.structural.constructs.push(
    {
      id: "forward-characteristic",
      kind: "object-characteristic",
      property: "p",
      characteristic: "functional",
    },
    {
      id: "reverse-characteristic",
      kind: "object-characteristic",
      property: "q",
      characteristic: "transitive",
    },
  );
  add("characteristics-inverse-directions", source, [
    "B24-characteristic-inverse-direction",
  ]);
}
{
  const source = oldSource("object-inverse");
  source.structural.constructs.push({
    id: "inverse-characteristic",
    kind: "object-characteristic",
    property: "inverse-expression",
    characteristic: "symmetric",
  });
  add("characteristic-inverse-expression-details", source, [
    "B24-characteristic-inverse-expression",
  ]);
}
for (const base of [
  "per-property-datatype",
  "matched-inverse",
  "object-exact-unqualified",
]) {
  const source = oldSource(base);
  const positionable = source.structural.occurrences.filter((o) =>
    ["class-node", "datatype-node", "label"].includes(o.kind),
  );
  source.visualization = {
    placements: positionable.map((o, index) => ({
      occurrence: o.id,
      position: { x: index * 100, y: index * 25 },
      pinned: index % 2 === 0,
    })),
    camera: { center: { x: 100, y: 25 }, zoom: 1 },
    hidden: [],
    labelSelection: { mode: "iri" },
    prefixes: [],
    display: {
      compactNotation: false,
      nodeScaling: "uniform",
      externalColoring: true,
    },
  };
  add(`artifact-all-positionable-${base}`, source, [
    "B24-positionable",
    "B24-label-cardinality",
    "B24-no-edge-placement",
  ]);
}
export const conditionalSources = sources;
