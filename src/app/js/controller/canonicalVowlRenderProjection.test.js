import { createCanonicalVowlRenderProjection } from "./canonicalVowlRenderProjection.js";
import { createCanonicalVowlScene } from "./canonicalVowlScene.js";

function fixture() {
  const subjects = [
    ["sa", "https://example.org/o#A"],
    ["sz", "https://elsewhere.org/o#Z"],
    ["sp", "https://example.org/o#p"],
    ["sq", "https://example.org/o#q"],
    ["st", "http://www.w3.org/2002/07/owl#Thing"],
    ["si", "urn:individual"],
  ].map(([id, iri]) => ({ id, iri }));
  const roles = [
    ["a", "class", "sa"],
    ["z", "class", "sz"],
    ["p", "object-property", "sp"],
    ["q", "object-property", "sq"],
    ["t", "class", "st"],
    ["i", "individual", "si"],
  ].map(([id, kind, subject]) => ({ id, kind, subject }));
  const occurrences = [
    { id: "n", kind: "class-node", targets: ["z", "a"] },
    {
      id: "g",
      kind: "class-node",
      targets: ["t"],
      context: { kind: "class", targets: ["z", "a"] },
    },
    {
      id: "e",
      kind: "inverse-edge",
      construct: "inv",
      forward: ["p"],
      reverse: ["q"],
      from: "n",
      to: "g",
    },
    { id: "lf", kind: "label", edge: "e", direction: "forward" },
    { id: "lr", kind: "label", edge: "e", direction: "reverse" },
  ];
  const inspection = {
    records: {
      ontology: { iri: "https://example.org/o", imports: [], annotations: [] },
      subjects,
      roles,
      expressions: [],
      constructs: [
        { id: "eq", kind: "equivalent-classes", members: ["z", "a"] },
        { id: "inv", kind: "inverse-properties", members: ["p", "q"] },
        {
          id: "fp",
          kind: "object-characteristic",
          property: "p",
          characteristic: "functional",
        },
        {
          id: "tq",
          kind: "object-characteristic",
          property: "q",
          characteristic: "transitive",
        },
        { id: "m1", kind: "class-membership", class: "a", individual: "i" },
        { id: "m2", kind: "class-membership", class: "z", individual: "i" },
      ],
    },
    occurrences,
  };
  const scene = createCanonicalVowlScene(occurrences, { loadGeneration: 1 });
  scene.arrange([
    {
      reference: scene.reference("lf"),
      position: { x: 20, y: 30 },
      pinned: true,
    },
    { reference: scene.reference("lr"), position: { x: -20, y: -30 } },
  ]);
  const visualization = scene.snapshot();
  visualization.display.nodeScaling = "direct-membership";
  return { inspection, visualization };
}

test("renders exact occurrences, independent inverse placements and principal characteristics", () => {
  const source = fixture();
  const before = structuredClone(source);
  const drawing = createCanonicalVowlRenderProjection(
    source.inspection,
    source.visualization,
  );
  expect(drawing.nodes.map(({ occurrence }) => occurrence)).toEqual(["n", "g"]);
  expect(drawing.edges).toEqual([
    {
      occurrence: "e",
      kind: "inverse-edge",
      hidden: false,
      from: "n",
      to: "g",
      records: ["inv", "p", "q"],
    },
  ]);
  expect(drawing.labels).toEqual([
    expect.objectContaining({
      occurrence: "lf",
      direction: "forward",
      name: "p",
      position: { x: 20, y: 30 },
      pinned: true,
      characteristics: ["functional"],
    }),
    expect.objectContaining({
      occurrence: "lr",
      direction: "reverse",
      name: "q",
      position: { x: -20, y: -30 },
      pinned: false,
      characteristics: ["transitive"],
    }),
  ]);
  expect(drawing.nodes[0]).toMatchObject({
    principal: { record: "a", name: "A", external: false },
    aliases: [{ record: "z", name: "Z", external: true }],
    radiusFactor: 1.25,
  });
  expect(drawing.nodes[1].radiusFactor).toBe(0.6);
  expect(source).toEqual(before);
});

test("compact notation and hidden labels retain their placements and topology", () => {
  const { inspection, visualization } = fixture();
  visualization.hidden = ["lr"];
  visualization.display.compactNotation = true;
  visualization.display.externalColoring = false;
  const drawing = createCanonicalVowlRenderProjection(
    inspection,
    visualization,
  );
  expect(drawing.labels[1]).toMatchObject({
    hidden: true,
    name: "q",
    position: { x: -20, y: -30 },
  });
  expect(drawing.nodes[0].aliases[0]).toMatchObject({
    external: true,
    externalStyle: false,
  });
  expect(drawing.edges).toHaveLength(1);
  expect(drawing.labels).toHaveLength(2);
});

test("operator projections expose omitted operands without creating an operand glyph", () => {
  const { inspection, visualization } = fixture();
  inspection.records.expressions.push(
    { id: "some", kind: "object-some", property: "p", filler: "a" },
    { id: "union", kind: "class-union", members: ["a", "some"] },
  );
  inspection.occurrences.push(
    { id: "u", kind: "class-node", targets: ["union"] },
    {
      id: "ue",
      kind: "operator-edge",
      expression: "union",
      from: "u",
      to: "n",
    },
    { id: "de", kind: "disjoint-edge", construct: "disjoint", ends: ["n"] },
  );
  inspection.records.constructs.push({
    id: "disjoint",
    kind: "disjoint-classes",
    members: ["a"],
  });
  visualization.placements.push({
    occurrence: "u",
    position: { x: 1, y: 2 },
    pinned: false,
  });
  const drawing = createCanonicalVowlRenderProjection(
    inspection,
    visualization,
  );
  expect(drawing.nodes[2]).toMatchObject({
    operator: "union",
    principal: { name: "union" },
    additionalOperands: ["some"],
  });
  expect(drawing.edges[2]).toMatchObject({ from: "n", to: "n" });
  expect(drawing.nodes).toHaveLength(3);
  expect(drawing.labels).toHaveLength(2);
  expect(drawing.inspection.records.expressions).toEqual(
    inspection.records.expressions,
  );
});

test("scoped cardinalities stay decimal strings and do not borrow global characteristics", () => {
  const { inspection, visualization } = fixture();
  inspection.records.expressions.push({
    id: "bound",
    kind: "object-min-cardinality",
    property: "p",
    filler: "t",
    cardinality: "9007199254740993123456",
  });
  inspection.records.constructs.push({
    id: "sub",
    kind: "subclass",
    sub: "a",
    super: "bound",
  });
  inspection.occurrences.push(
    {
      id: "re",
      kind: "restriction-edge",
      construct: "sub",
      from: "n",
      to: "g",
    },
    { id: "rl", kind: "label", edge: "re", direction: "single" },
  );
  visualization.placements.push({
    occurrence: "rl",
    position: { x: 1, y: 2 },
    pinned: false,
  });
  const drawing = createCanonicalVowlRenderProjection(
    inspection,
    visualization,
  );
  expect(drawing.labels[2]).toMatchObject({
    name: "p",
    cardinality: "9007199254740993123456..*",
    characteristics: [],
  });
});

test("missing placements fail preparation before the renderer can mutate", () => {
  const { inspection, visualization } = fixture();
  visualization.placements = visualization.placements.filter(
    ({ occurrence }) => occurrence !== "lr",
  );
  expect(() =>
    createCanonicalVowlRenderProjection(inspection, visualization),
  ).toThrow("complete scene");
});
