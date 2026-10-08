import { rankCanonicalNodeOccurrences } from "./canonicalNodeOrdering.js";
import {
  createCanonicalNodeSelector,
  CANONICAL_VISIBLE_FILTERS,
} from "./canonicalVowlViewControls.js";
import { closeVowlVisibility } from "./canonicalVowlScene.js";

function graph(ids, edges) {
  const occurrences = [
    ...ids.map((id) => ({ id, kind: "class-node", targets: [] })),
    ...edges.map(([from, to], i) => ({
      id: `edge${i}`,
      kind: "subclass-edge",
      from,
      to,
    })),
  ];
  const identity = {
    correspondence: occurrences.map(({ id }) => ({
      previous: id,
      current: id,
    })),
  };
  return { occurrences, identity };
}
test("hand-authored star, chain and disconnected fairness counterexamples", () => {
  const star = graph(
    ["a", "b", "c", "d"],
    [
      ["d", "a"],
      ["d", "b"],
      ["d", "c"],
    ],
  );
  expect(
    rankCanonicalNodeOccurrences(star.occurrences, [], star.identity),
  ).toEqual(["d", "a", "b", "c"]);
  const chain = graph(
    ["a", "b", "c", "d"],
    [
      ["a", "b"],
      ["b", "c"],
      ["c", "d"],
    ],
  );
  expect(
    rankCanonicalNodeOccurrences(chain.occurrences, [], chain.identity),
  ).toEqual(["b", "c", "a", "d"]);
  const disconnected = graph(
    ["a", "b", "c", "d", "e"],
    [
      ["a", "b"],
      ["b", "c"],
      ["c", "d"],
    ],
  );
  expect(
    rankCanonicalNodeOccurrences(
      disconnected.occurrences,
      [],
      disconnected.identity,
    ),
  ).toEqual(["b", "c", "e", "a", "d"]);
  // sqrt(4):sqrt(1) first gives two large-component nodes then the isolate.
  // Equal weights give the isolate second; proportional weights give it fifth.
});
test("enumerate every simple four-node graph and every prefix without production oracles", () => {
  const ids = ["a", "b", "c", "d"];
  const pairs = ids.flatMap((a, i) => ids.slice(i + 1).map((b) => [a, b]));
  for (let mask = 0; mask < 64; mask++) {
    const fixture = graph(
      ids,
      pairs.filter((_, i) => Math.floor(mask / 2 ** i) % 2 === 1),
    );
    const inspection = {
      occurrences: fixture.occurrences,
      records: { roles: [], expressions: [], constructs: [] },
    };
    const select = createCanonicalNodeSelector(inspection, fixture.identity);
    let previous = [];
    let order;
    for (let count = 0; count <= 4; count++) {
      const result = select(CANONICAL_VISIBLE_FILTERS, {
        mode: "exact",
        requestedCount: count,
      });
      const shown = ids.filter((id) => !result.hidden.includes(id));
      expect(shown).toHaveLength(count);
      expect(previous.every((id) => shown.includes(id))).toBe(true);
      expect(new Set(result.rankedNodeOccurrenceIds)).toEqual(new Set(ids));
      if (order) {
        expect(result.rankedNodeOccurrenceIds).toBe(order);
      }
      order = result.rankedNodeOccurrenceIds;
      previous = shown;
    }
    for (const count of [3, 1, 4, 0, 2, 4, 1]) {
      const result = select(CANONICAL_VISIBLE_FILTERS, {
        mode: "exact",
        requestedCount: count,
      });
      expect(new Set(result.hidden)).toEqual(
        new Set(closeVowlVisibility(fixture.occurrences, order.slice(count))),
      );
    }
    expect(
      rankCanonicalNodeOccurrences(
        [...fixture.occurrences].reverse(),
        [],
        fixture.identity,
      ),
    ).toEqual(order);
  }
});
test("datatype endpoints, distinct-neighbor degree, parallel relationships and self loops", () => {
  const fixture = graph(
    ["a", "b", "c"],
    [
      ["a", "b"],
      ["a", "b"],
      ["a", "a"],
      ["b", "c"],
    ],
  );
  fixture.occurrences[2].kind = "datatype-node";
  expect(
    rankCanonicalNodeOccurrences(fixture.occurrences, [], fixture.identity),
  ).toEqual(["b", "a", "c"]);
});
test("empty graphs, all, shortfall intent and relationship-only filters", () => {
  const fixture = graph(
    ["a", "b", "c"],
    [
      ["a", "b"],
      ["b", "c"],
    ],
  );
  const inspection = {
    occurrences: fixture.occurrences,
    records: { roles: [], expressions: [], constructs: [] },
  };
  const select = createCanonicalNodeSelector(inspection, fixture.identity);
  const all = select(CANONICAL_VISIBLE_FILTERS, { mode: "all" });
  expect(all.hidden).toEqual([]);
  expect(
    select(
      { ...CANONICAL_VISIBLE_FILTERS, subclasses: "hide" },
      { mode: "exact", requestedCount: 100 },
    ).nodeCountStatus,
  ).toMatchObject({ eligibleNodeCount: 3, shownNodeCount: 3 });
  expect(
    select(CANONICAL_VISIBLE_FILTERS, { mode: "all" }, ["a"]).nodeCountStatus
      .eligibleNodeCount,
  ).toBe(2);
  expect(rankCanonicalNodeOccurrences([], [], { correspondence: [] })).toEqual(
    [],
  );
});
