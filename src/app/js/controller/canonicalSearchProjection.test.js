import { createCanonicalSearchProjection } from "./canonicalSearchProjection.js";

const ref = (iri, roleKind = "class") => ({
  kind: roleKind === "class" ? "class" : "property",
  iri,
  roleKind,
});
function graph(nodeCount, edgePairs, labelCount = edgePairs.length) {
  const references = new Map(
    Array.from({ length: nodeCount }, (_, i) => [`r${i}`, ref(`urn:${i}`)]),
  );
  references.set("property", ref("urn:p", "object-property"));
  references.set("detail", ref("urn:p", "annotation-property"));
  const occurrences = [
    ...Array.from({ length: nodeCount }, (_, i) => ({
      id: `n${i}`,
      kind: "class-node",
      targets: [`r${i}`],
    })),
    ...edgePairs.map(([from, to], i) => ({
      id: `e${i}`,
      kind: "property-edge",
      from: `n${from}`,
      to: `n${to}`,
      properties: ["property"],
    })),
    ...Array.from({ length: labelCount }, (_, i) => ({
      id: `l${i}`,
      kind: "label",
      edge: `e${i % edgePairs.length}`,
    })),
  ];
  const inspection = {
    occurrences,
    records: { constructs: [], expressions: [] },
  };
  return {
    inspection,
    index: createCanonicalSearchProjection(inspection, references, 7),
  };
}

test("depth two includes all induced edges and labels, including boundary cycles and parallel links", () => {
  const { index, inspection } = graph(6, [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 4],
    [4, 5],
    [0, 4],
    [0, 4],
    [2, 2],
  ]);
  const result = index.plan([ref("urn:2")]);
  expect(result.canReveal).toBe(true);
  expect(result.counts).toMatchObject({ nodes: 5, edges: 7, labels: 7 });
  expect(result.hidden).toEqual(["n5", "e4", "l4"]);
  expect(inspection.occurrences).toHaveLength(22);
});

test("property seeding includes every carrying edge and both directions without conflating same-IRI roles", () => {
  const { index } = graph(8, [
    [0, 1],
    [1, 2],
    [2, 3],
    [4, 5],
    [5, 6],
  ]);
  expect(index.plan([ref("urn:p", "object-property")]).counts.nodes).toBe(7);
  expect(index.plan([ref("urn:p", "annotation-property")])).toMatchObject({
    canReveal: false,
    reason: "no-drawable-neighborhood",
  });
  expect(() =>
    index.plan([{ kind: "class", loadGeneration: 6, localId: "retired" }]),
  ).toThrow();
});

test.each([499, 500, 501])(
  "node cap is atomic at %i admitted nodes",
  (size) => {
    const { index } = graph(
      size,
      Array.from({ length: size - 1 }, (_, i) => [0, i + 1]),
    );
    const result = index.plan([ref("urn:0")]);
    expect(result.canReveal).toBe(size <= 500);
    if (size > 500) {
      expect(result.reason).toBe("node-limit");
      expect(result.hidden).toBeUndefined();
    }
  },
);

test.each([999, 1000, 1001])(
  "edge cap is atomic at %i parallel edges",
  (size) => {
    const { index } = graph(
      2,
      Array.from({ length: size }, () => [0, 1]),
      0,
    );
    const result = index.plan([ref("urn:0")]);
    expect(result.canReveal).toBe(size <= 1000);
    if (size > 1000) {
      expect(result.reason).toBe("edge-limit");
    }
  },
);

test.each([1999, 2000, 2001])(
  "label cap is atomic at %i associated labels",
  (size) => {
    const { index } = graph(2, [[0, 1]], size);
    const result = index.plan([ref("urn:0")]);
    expect(result.canReveal).toBe(size <= 2000);
    if (size > 2000) {
      expect(result.reason).toBe("label-limit");
    }
  },
);

test("reference and adjacency limits refuse without a partial hidden inventory", () => {
  const { index } = graph(
    2,
    Array.from({ length: 2500 }, () => [0, 1]),
    0,
  );
  expect(
    index.plan(Array.from({ length: 26 }, () => ref("urn:0"))).reason,
  ).toBe("reference-limit");
  const result = index.plan([ref("urn:0")]);
  expect(result).toMatchObject({
    canReveal: false,
    reason: "adjacency-limit",
    counts: { adjacencyEntries: 10001 },
  });
  expect(result.hidden).toBeUndefined();
});

test.each([24, 25, 26])("reference cap at %i exact references", (size) => {
  const { index } = graph(1, [], 0);
  expect(
    index.plan(Array.from({ length: size }, () => ref("urn:0"))).canReveal,
  ).toBe(size <= 25);
});

test.each([9999, 10000, 10001])(
  "adjacency accounting at %i entries",
  (size) => {
    const edges = size === 9999 ? 999 : 1000;
    const labels = size === 9999 ? 9 : size - 10000;
    const { index } = graph(
      2,
      Array.from({ length: edges }, () => [0, 1]),
      labels,
    );
    const result = index.plan(
      Array.from({ length: 5 }, () => ref("urn:p", "object-property")),
    );
    expect(result.counts.adjacencyEntries).toBe(size);
    expect(result.canReveal).toBe(size <= 10000);
    if (size > 10000) {
      expect(result.hidden).toBeUndefined();
    }
  },
);

test("an independent adjacency-matrix oracle agrees on induced depth-two subgraphs", () => {
  let seed = 283;
  const random = () => (seed = (seed * 16807) % 2147483647);
  for (let round = 0; round < 30; round++) {
    const pairs = Array.from({ length: 45 }, () => [
      random() % 24,
      random() % 24,
    ]);
    const start = random() % 24;
    const { index, inspection } = graph(24, pairs);
    const matrix = Array.from({ length: 24 }, () => Array(24).fill(false));
    for (const [a, b] of pairs) {
      matrix[a][b] = matrix[b][a] = true;
    }
    const expectedNodes = new Set([start]);
    for (let a = 0; a < 24; a++) {
      if (matrix[start][a]) {
        expectedNodes.add(a);
        for (let b = 0; b < 24; b++) {
          if (matrix[a][b]) {
            expectedNodes.add(b);
          }
        }
      }
    }
    const visible = new Set([...expectedNodes].map((i) => `n${i}`));
    pairs.forEach(([a, b], i) => {
      if (expectedNodes.has(a) && expectedNodes.has(b)) {
        visible.add(`e${i}`);
        visible.add(`l${i}`);
      }
    });
    expect(index.plan([ref(`urn:${start}`)]).hidden).toEqual(
      inspection.occurrences
        .filter((row) => !visible.has(row.id))
        .map((row) => row.id),
    );
  }
});

test("inverse, n-ary and restriction properties seed their exact canonical occurrences", () => {
  const references = new Map([
    ["p", ref("urn:p", "object-property")],
    ["q", ref("urn:q", "object-property")],
    ...Array.from({ length: 4 }, (_, i) => [`r${i}`, ref(`urn:${i}`)]),
  ]);
  const inspection = {
    records: {
      constructs: [{ id: "c", super: "restriction" }],
      expressions: [{ id: "restriction", property: "p" }],
    },
    occurrences: [
      ...Array.from({ length: 4 }, (_, i) => ({
        id: `n${i}`,
        kind: "class-node",
        target: `r${i}`,
      })),
      {
        id: "inverse",
        kind: "inverse-edge",
        from: "n0",
        to: "n1",
        forward: ["p"],
        reverse: ["q"],
      },
      {
        id: "nary",
        kind: "relation-edge",
        ends: ["n1", "n2", "n3"],
        properties: ["p", "q"],
      },
      {
        id: "restriction-edge",
        kind: "restriction-edge",
        from: "n0",
        to: "n3",
        construct: "c",
      },
      { id: "inverse-label", kind: "label", edge: "inverse" },
      { id: "nary-label", kind: "label", edge: "nary" },
    ],
  };
  const index = createCanonicalSearchProjection(inspection, references, 7);
  for (const iri of ["urn:p", "urn:q"]) {
    expect(index.plan([ref(iri, "object-property")])).toMatchObject({
      canReveal: true,
      hidden: [],
      counts: { nodes: 4, edges: 3, labels: 2 },
    });
  }
});
