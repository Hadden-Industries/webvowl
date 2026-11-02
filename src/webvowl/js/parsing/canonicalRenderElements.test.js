import { createCanonicalRenderElements } from "./canonicalRenderElements.js";
import { createLinkCreator } from "./linkCreator.js";

function drawing() {
  const principal = (record, kind) => ({
    record,
    kind,
    name: record,
    iri: `urn:${record}`,
    externalStyle: false,
  });
  return {
    nodes: ["a", "b"].map((id, index) => ({
      occurrence: id,
      targets: [id + ":role"],
      principal: principal(id + ":role", "class"),
      aliases: [],
      hidden: false,
      position: { x: index * 100, y: index * 50 },
      pinned: index === 0,
      radiusFactor: index === 0 ? 1.25 : 0.6,
    })),
    edges: [
      {
        occurrence: "inverse",
        kind: "inverse-edge",
        from: "a",
        to: "b",
        hidden: false,
        records: ["inverse:construct", "p", "q"],
      },
    ],
    labels: [
      {
        occurrence: "forward",
        edge: "inverse",
        direction: "forward",
        principal: principal("p", "object-property"),
        name: "p",
        records: ["p"],
        aliases: [],
        characteristics: ["functional"],
        position: { x: 10, y: 20 },
        pinned: true,
        hidden: false,
      },
      {
        occurrence: "reverse",
        edge: "inverse",
        direction: "reverse",
        principal: principal("q", "object-property"),
        name: "q",
        records: ["q"],
        aliases: [],
        characteristics: ["transitive"],
        position: { x: 30, y: 40 },
        pinned: false,
        hidden: false,
      },
    ],
  };
}
const graph = { options: () => ({ scaleNodesByIndividuals: () => true }) };

test("native glyph preparation pairs inverse labels while preserving both semantic bindings", () => {
  const input = drawing();
  const before = structuredClone(input);
  const result = createCanonicalRenderElements(graph, input);
  expect(result.nodes.map((node) => node.actualRadius())).toEqual([62.5, 30]);
  expect(result.nodes[0]).toMatchObject({ x: 0, y: 0, fx: 0, fy: 0 });
  const links = createLinkCreator().createLinks(result.properties);
  expect(links).toHaveLength(1);
  expect(links.map((link) => [link.label().x, link.label().y])).toEqual([
    [10, 20],
  ]);
  expect(links.map((link) => [link.domain().id(), link.range().id()])).toEqual([
    ["a", "b"],
  ]);
  expect(links[0].inverse()).toBe(result.properties[1]);
  expect(result.properties[1]).toMatchObject({ x: 30, y: 40 });
  expect(result.bindings.get("forward")).toMatchObject({
    occurrence: "inverse",
    label: "forward",
    records: ["p"],
    positionable: true,
  });
  expect(result.bindings.get("reverse")).toMatchObject({
    occurrence: "inverse",
    label: "reverse",
    records: ["q"],
    positionable: true,
  });
  expect(input).toEqual(before);
});

test.each([false, true])(
  "preparation retains a coherent inverse pair without mutating its live placements (reverse first=%s)",
  (reverseFirst) => {
    const input = drawing();
    if (reverseFirst) {
      input.labels.reverse();
    }
    const previous = createCanonicalRenderElements(graph, input);
    const next = structuredClone(input);
    next.labels.forEach((row) => {
      row.position = { x: 900, y: 800 };
    });
    const prepared = createCanonicalRenderElements(graph, next, previous);
    expect(prepared.properties).toEqual(previous.properties);
    prepared.properties.forEach((property, index) => {
      expect(property).toBe(previous.properties[index]);
      expect(property.x).toBe(input.labels[index].position.x);
      expect(property.y).toBe(input.labels[index].position.y);
    });
    expect(createLinkCreator().createLinks(prepared.properties)).toHaveLength(
      1,
    );
    next.labels[1].principal.kind = "rdf-property";
    const replaced = createCanonicalRenderElements(graph, next, previous);
    replaced.properties.forEach((property, index) =>
      expect(property).not.toBe(previous.properties[index]),
    );
    expect(previous.properties[0].inverse()).toBe(previous.properties[1]);
    expect(previous.properties[1].inverse()).toBe(previous.properties[0]);
    expect(replaced.properties[0].inverse()).toBe(replaced.properties[1]);
    expect(replaced.properties[1].inverse()).toBe(replaced.properties[0]);
  },
);

test("hidden labels preserve their edge, while hidden edges create no drawing primitives", () => {
  const input = drawing();
  input.labels[0].hidden = true;
  const result = createCanonicalRenderElements(graph, input);
  expect(result.properties).toHaveLength(2);
  expect(result.properties[0].labelVisible()).toBe(false);
  expect(result.properties[1].labelVisible()).toBe(true);
  input.edges[0].hidden = true;
  expect(createCanonicalRenderElements(graph, input).properties).toHaveLength(
    0,
  );
});

test("edge decorations retain derived geometry without becoming positionable occurrences", () => {
  const input = drawing();
  input.edges = [
    {
      occurrence: "disjoint",
      kind: "disjoint-edge",
      from: "a",
      to: "a",
      hidden: false,
      records: ["disjoint:construct"],
    },
  ];
  input.labels = [];
  const result = createCanonicalRenderElements(graph, input);
  expect(result.properties).toHaveLength(1);
  expect(result.bindings.get("disjoint")).toEqual({
    occurrence: "disjoint",
    records: ["disjoint:construct"],
    positionable: false,
  });
  expect(result.properties[0]).toMatchObject({ x: 0, y: 0 });
  expect(createLinkCreator().createLinks(result.properties)).toHaveLength(1);
});
