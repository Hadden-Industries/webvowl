import { beforeAll, describe, expect, test } from "@jest/globals";
import loadEsmModuleForTest from "../../../app/test/loadEsmModuleForTest.js";

let createNodeDegreeFilter;

beforeAll(async () => {
  ({ createNodeDegreeFilter } = await loadEsmModuleForTest(
    new URL("./nodeDegreeFilter.js", import.meta.url),
    import.meta.url,
  ));
});

function createNodeFixture(nodeId, linkCount) {
  const links = Array.from({ length: linkCount }, () => ({
    domain: () => ({ id: () => nodeId + "-domain" }),
    range: () => ({ id: () => nodeId + "-range" }),
    property: () => ({ id: () => nodeId + "-property" }),
  }));
  return {
    id: () => nodeId,
    links: () => links,
    type: () => "owl:Class",
  };
}

describe("node degree filter minimum degree", () => {
  test("filters by a minimum degree supplied without a user interface getter", () => {
    // The runtime sets the degree directly; no slider is connected here.
    const filter = createNodeDegreeFilter();
    const nodes = [
      createNodeFixture("isolated", 0),
      createNodeFixture("connected", 3),
    ];

    filter.minDegree(2);
    filter.filter(nodes, []);

    expect(filter.filteredNodes().map((node) => node.id())).toEqual([
      "connected",
    ]);
  });

  test("treats a zero minimum degree as no degree filtering", () => {
    const filter = createNodeDegreeFilter();
    const nodes = [
      createNodeFixture("isolated", 0),
      createNodeFixture("connected", 3),
    ];

    filter.minDegree(0);
    filter.filter(nodes, []);

    expect(filter.filteredNodes().map((node) => node.id())).toEqual([
      "isolated",
      "connected",
    ]);
  });

  test("reports the minimum degree it is holding", () => {
    const filter = createNodeDegreeFilter();

    filter.minDegree(4);

    expect(filter.minDegree()).toBe(4);
  });

  test("reports the degree supplied by its connected control before an explicit choice", () => {
    const filter = createNodeDegreeFilter();
    filter.setDegreeGetter(() => "4");
    expect(filter.minDegree()).toBe(4);
  });

  test("reports the zero degree actually used when the empty-result fallback restores the graph", () => {
    const filter = createNodeDegreeFilter();
    let displayedDegree;
    filter.setDegreeSetter((value) => {
      displayedDegree = value;
    });
    const nodes = [
      createNodeFixture("isolated", 0),
      createNodeFixture("connected", 1),
    ];
    filter.minDegree(5);
    filter.filter(nodes, []);
    expect(filter.filteredNodes()).toEqual(nodes);
    expect(displayedDegree).toBe(0);
    expect(filter.minDegree()).toBe(0);
  });
});
