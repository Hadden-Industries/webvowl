// SPDX-License-Identifier: AGPL-3.0-only
// These normalized sources and complete B2 occurrences are independently authored.
import { profiles } from "./producer.mjs";

const ns = "https://example.org/o#";
const owl = "http://www.w3.org/2002/07/owl#";
const rdfs = "http://www.w3.org/2000/01/rdf-schema#";
const xsd = "http://www.w3.org/2001/XMLSchema#";
const rdf = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
const empty = () => ({
  structural: {
    ontology: { imports: [], annotations: [] },
    subjects: [],
    roles: [],
    expressions: [],
    constructs: [],
    occurrences: [],
  },
});
function addRole(source, id, kind, iri) {
  source.structural.subjects.push({
    id: `s-${id}`,
    ...(iri === undefined ? {} : { iri }),
  });
  source.structural.roles.push({ id, kind, subject: `s-${id}` });
  return id;
}
function classNode(source, id, targets, context) {
  source.structural.occurrences.push({
    id,
    kind: "class-node",
    targets,
    ...(context ? { context } : {}),
  });
}
function edgeWithLabel(source, edge) {
  source.structural.occurrences.push(edge, {
    id: `label-${edge.id}`,
    kind: "label",
    edge: edge.id,
    direction: "single",
  });
}
function classes({ anonymous = false, subclass = false } = {}) {
  const source = empty();
  for (const name of ["A", "B"]) {
    addRole(source, name, "class", anonymous ? undefined : ns + name);
    classNode(source, `node-${name}`, [name]);
  }
  if (subclass) {
    source.structural.constructs.push({
      id: "subclass",
      kind: "subclass",
      sub: "A",
      super: "B",
    });
    edgeWithLabel(source, {
      id: "subclass-edge",
      kind: "subclass-edge",
      construct: "subclass",
      from: "node-A",
      to: "node-B",
    });
  }
  return source;
}
function withState(source, positions, hidden = []) {
  source.visualization = {
    placements: positions.map(([occurrence, x, y, pinned]) => ({
      occurrence,
      position: { x, y },
      pinned,
    })),
    camera: { center: { x: 3, y: -2 }, zoom: 1.25 },
    hidden,
    labelSelection: { mode: "language", range: "en-gb" },
    prefixes: [
      { prefix: "ex", iri: ns },
      { prefix: "", iri: ns },
    ],
    display: {
      compactNotation: true,
      nodeScaling: "direct-membership",
      externalColoring: false,
    },
  };
  return source;
}
function annotations() {
  const source = empty();
  addRole(source, "A", "class", ns + "A");
  addRole(source, "label", "annotation-property", rdfs + "label");
  addRole(source, "note", "annotation-property", ns + "note");
  addRole(source, "text", "datatype", xsd + "string");
  addRole(source, "language", "datatype", rdf + "langString");
  source.structural.subjects.push({ id: "anonymous-value" });
  classNode(source, "node-A", ["A"]);
  source.structural.ontology = {
    iri: "https://example.org/o",
    versionIri: "https://example.org/o/version/1",
    imports: ["urn:example:import:one", "urn:example:import:two"],
    annotations: [
      {
        predicate: ns + "note",
        value: { kind: "iri", iri: "https://example.org/outside" },
        annotations: [],
      },
    ],
  };
  const label = {
    kind: "annotation-assertion",
    subject: "s-A",
    predicate: rdfs + "label",
    value: { kind: "language", lexical: "Colour", language: "en-gb" },
  };
  source.structural.constructs.push(
    { id: "label-assertion", ...label },
    {
      id: "label-anchor",
      kind: "assertion-anchor",
      assertion: label,
      annotations: [
        {
          predicate: ns + "note",
          value: {
            kind: "typed",
            lexical: "Exact\nlexeme",
            datatype: xsd + "string",
          },
          annotations: [
            {
              predicate: ns + "note",
              value: { kind: "subject", subject: "anonymous-value" },
              annotations: [],
            },
          ],
        },
      ],
    },
    {
      id: "declaration-anchor",
      kind: "assertion-anchor",
      assertion: { kind: "declaration", role: "A" },
      annotations: [
        {
          predicate: ns + "note",
          value: { kind: "typed", lexical: "", datatype: xsd + "string" },
          annotations: [],
        },
      ],
    },
  );
  return source;
}
function chain(members) {
  const source = empty();
  addRole(source, "Thing", "class", owl + "Thing");
  classNode(source, "generic-loop", ["Thing"], {
    kind: "class",
    targets: ["Thing"],
  });
  for (const property of ["p", "q"]) {
    addRole(source, property, "object-property", ns + property);
    edgeWithLabel(source, {
      id: `edge-${property}`,
      kind: "property-edge",
      properties: [property],
      from: "generic-loop",
      to: "generic-loop",
    });
  }
  source.structural.constructs.push({
    id: "chain",
    kind: "property-chain",
    members,
    super: "p",
  });
  return source;
}
function datatypeSplits() {
  const source = empty();
  addRole(source, "Thing", "class", owl + "Thing");
  addRole(source, "Literal", "datatype", rdfs + "Literal");
  for (const property of ["p", "q"]) {
    addRole(source, property, "data-property", ns + property);
    const context = { kind: "property", properties: [property] };
    classNode(source, `generic-${property}`, ["Thing"], context);
    source.structural.occurrences.push({
      id: `datatype-${property}`,
      kind: "datatype-node",
      target: "Literal",
      context,
    });
    edgeWithLabel(source, {
      id: `edge-${property}`,
      kind: "property-edge",
      properties: [property],
      from: `generic-${property}`,
      to: `datatype-${property}`,
    });
  }
  return source;
}
function inverse(matched) {
  const source = classes();
  for (const property of ["p", "q"])
    addRole(source, property, "object-property", ns + property);
  for (const [property, domain, range] of [
    ["p", "A", "B"],
    ["q", matched ? "B" : "A", matched ? "A" : "B"],
  ]) {
    source.structural.constructs.push(
      {
        id: `domain-${property}`,
        kind: "object-domain",
        property,
        target: domain,
      },
      {
        id: `range-${property}`,
        kind: "object-range",
        property,
        target: range,
      },
    );
  }
  source.structural.constructs.push({
    id: "inverse",
    kind: "inverse-properties",
    members: ["q", "p"],
  });
  if (matched)
    source.structural.occurrences.push(
      {
        id: "inverse-edge",
        kind: "inverse-edge",
        construct: "inverse",
        forward: ["p"],
        reverse: ["q"],
        from: "node-A",
        to: "node-B",
      },
      {
        id: "forward-label",
        kind: "label",
        edge: "inverse-edge",
        direction: "forward",
      },
      {
        id: "reverse-label",
        kind: "label",
        edge: "inverse-edge",
        direction: "reverse",
      },
    );
  else
    for (const property of ["p", "q"])
      edgeWithLabel(source, {
        id: `edge-${property}`,
        kind: "property-edge",
        properties: [property],
        from: "node-A",
        to: "node-B",
      });
  return source;
}
function equivalence() {
  const source = empty();
  for (const name of ["A", "B", "C"]) addRole(source, name, "class", ns + name);
  source.structural.constructs.push(
    { id: "eq-AB", kind: "equivalent-classes", members: ["A", "B"] },
    { id: "eq-BC", kind: "equivalent-classes", members: ["B", "C"] },
    { id: "disjoint", kind: "disjoint-classes", members: ["A", "B", "C"] },
    {
      id: "empty-key",
      kind: "key",
      class: "A",
      objectProperties: [],
      dataProperties: [],
    },
  );
  classNode(source, "group", ["A", "B", "C"]);
  source.structural.occurrences.push({
    id: "disjoint-loop",
    kind: "disjoint-edge",
    construct: "disjoint",
    ends: ["group"],
  });
  return source;
}
function partialOperator() {
  const source = classes();
  addRole(source, "Thing", "class", owl + "Thing");
  addRole(source, "p", "object-property", ns + "p");
  classNode(source, "generic-loop", ["Thing"], {
    kind: "class",
    targets: ["Thing"],
  });
  edgeWithLabel(source, {
    id: "p-edge",
    kind: "property-edge",
    properties: ["p"],
    from: "generic-loop",
    to: "generic-loop",
  });
  source.structural.expressions.push(
    { id: "some", kind: "object-some", property: "p", filler: "A" },
    { id: "union", kind: "class-union", members: ["A", "some"] },
  );
  source.structural.constructs.push({
    id: "subclass",
    kind: "subclass",
    sub: "B",
    super: "union",
  });
  classNode(source, "union-node", ["union"]);
  source.structural.occurrences.push({
    id: "union-edge",
    kind: "operator-edge",
    expression: "union",
    from: "union-node",
    to: "node-A",
  });
  edgeWithLabel(source, {
    id: "subclass-edge",
    kind: "subclass-edge",
    construct: "subclass",
    from: "node-B",
    to: "union-node",
  });
  return source;
}
function restricted(kind = "object-exact-cardinality", eligible = true) {
  const source = empty();
  const data = kind.startsWith("data-");
  addRole(source, "A", "class", ns + "A");
  classNode(source, "node-A", ["A"]);
  addRole(source, "Thing", "class", owl + "Thing");
  addRole(source, "p", data ? "data-property" : "object-property", ns + "p");
  if (data) addRole(source, "Literal", "datatype", rdfs + "Literal");
  if (!eligible)
    addRole(source, "Filler", data ? "datatype" : "class", ns + "Filler");
  const globalContext = data
    ? { kind: "property", properties: ["p"] }
    : { kind: "class", targets: ["Thing"] };
  classNode(source, "global-domain", ["Thing"], globalContext);
  if (data)
    source.structural.occurrences.push({
      id: "global-range",
      kind: "datatype-node",
      target: "Literal",
      context: globalContext,
    });
  edgeWithLabel(source, {
    id: "global-edge",
    kind: "property-edge",
    properties: ["p"],
    from: "global-domain",
    to: data ? "global-range" : "global-domain",
  });
  const filler = eligible ? (data ? "Literal" : "Thing") : "Filler";
  source.structural.expressions.push({
    id: "restriction",
    kind,
    property: "p",
    cardinality: "90071992547409931234567890",
    filler,
  });
  source.structural.constructs.push({
    id: "restriction-assertion",
    kind: "subclass",
    sub: "A",
    super: "restriction",
  });
  if (eligible) {
    const context = {
      kind: "property",
      properties: ["p"],
      scope: "restriction-assertion",
    };
    if (data)
      source.structural.occurrences.push({
        id: "restriction-target",
        kind: "datatype-node",
        target: "Literal",
        context,
      });
    else classNode(source, "restriction-target", ["Thing"], context);
    edgeWithLabel(source, {
      id: "restriction-edge",
      kind: "restriction-edge",
      construct: "restriction-assertion",
      from: "node-A",
      to: "restriction-target",
    });
  } else if (!data) classNode(source, "node-Filler", ["Filler"]);
  return source;
}

export const extendedSources = [
  {
    id: "annotated-class",
    source: annotations(),
    rules: ["A2", "A4", "A6.3", "B2.1"],
  },
  {
    id: "asymmetric-subclass",
    source: classes({ subclass: true }),
    rules: ["A4", "B2.4", "D18.2"],
  },
  {
    id: "symmetric-anonymous-classes",
    source: classes({ anonymous: true }),
    rules: ["A2", "A5", "D18.2"],
  },
  {
    id: "symmetric-anonymous-artifact",
    source: withState(classes({ anonymous: true }), [
      ["node-A", -10, 20, false],
      ["node-B", 50, 30, true],
    ]),
    rules: ["B3", "D18.2"],
  },
  {
    id: "named-pair-artifact",
    source: withState(classes(), [
      ["node-A", -10, 20, false],
      ["node-B", 50, 30, true],
    ]),
    rules: ["B3", "D18.2"],
  },
  {
    id: "named-pair-exchanged-artifact",
    source: withState(classes(), [
      ["node-A", 50, 30, true],
      ["node-B", -10, 20, false],
    ]),
    rules: ["B3", "D18.2"],
  },
  {
    id: "repeated-chain",
    source: chain(["p", "q", "p", "q"]),
    rules: ["A4", "A6.3", "D17"],
  },
  {
    id: "reversed-chain",
    source: chain(["q", "p", "q", "p"]),
    rules: ["A4", "A6.3", "D17"],
  },
  {
    id: "short-chain",
    source: chain(["p", "q"]),
    rules: ["A4", "A6.3", "D17"],
  },
  {
    id: "per-property-datatype",
    source: datatypeSplits(),
    rules: ["B2.2", "B2.3", "A8"],
    expectedError: "RDFC_RESOURCE_LIMIT",
    expectedCounts: { primary: 16, blankNodes: 37, quads: 118 },
  },
  { id: "matched-inverse", source: inverse(true), rules: ["B2.4"] },
  { id: "unmatched-inverse", source: inverse(false), rules: ["B2.4"] },
  {
    id: "equivalence-disjoint-loop-empty-key",
    source: equivalence(),
    rules: ["A4", "B2.1", "B2.4"],
  },
  {
    id: "partial-union-projection",
    source: partialOperator(),
    rules: ["A3", "B2.1", "B2.4"],
  },
  ...["object", "data"].flatMap((sort) =>
    ["min", "max", "exact"].map((bound) => ({
      id: `${sort}-${bound}-unqualified`,
      source: restricted(`${sort}-${bound}-cardinality`),
      rules: ["A3", "B2.4"],
    })),
  ),
  {
    id: "object-qualified-details",
    source: restricted("object-exact-cardinality", false),
    rules: ["A3", "B2.4"],
  },
  {
    id: "data-qualified-details",
    source: restricted("data-exact-cardinality", false),
    rules: ["A3", "B2.4"],
  },
].map((vector) => ({
  ...vector,
  profile: vector.source.visualization
    ? profiles.artifact
    : profiles.structural,
}));
