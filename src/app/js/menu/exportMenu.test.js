import { afterEach, beforeEach, describe, expect, test } from "@jest/globals";
import exportMenuFactory from "./exportMenu.js";

describe("export menu json deterministic export", () => {
  let originalD3;
  let originalWebVowl;

  beforeEach(() => {
    originalD3 = global.d3;
    originalWebVowl = global.webvowl;
    // Factory construction configures legacy TeX line generators even when
    // this suite exercises only the independent JSON-export path.
    const lineGenerator = {};
    lineGenerator.x = () => lineGenerator;
    lineGenerator.y = () => lineGenerator;
    lineGenerator.interpolate = () => lineGenerator;
    lineGenerator.tension = () => lineGenerator;
    global.d3 = { svg: { line: () => lineGenerator } };
    global.webvowl = {
      util: { prefixTools: () => ({ updatePrefixModel: () => {} }) },
      version: "2.0.0",
    };
  });

  afterEach(() => {
    global.d3 = originalD3;
    global.webvowl = originalWebVowl;
  });

  function createMockNode(id, iri, type = "owl:Class") {
    return {
      id: () => id,
      iri: () => iri,
      baseIri: () => iri,
      type: () => type,
      label: () => "Label",
      attributes: () => ["deprecated", "abstract"],
      comment: () => "comment",
      annotations: () => ({ b: ["val2"], a: ["val1"] }),
      description: () => "desc",
      individuals: () => [],
      equivalents: () => [],
    };
  }

  function createMockProperty(id, iri) {
    return {
      id: () => id,
      iri: () => iri,
      baseIri: () => iri,
      type: () => "owl:ObjectProperty",
      label: () => "PropLabel",
      attributes: () => [],
      comment: () => "",
      annotations: () => undefined,
      maxCardinality: () => undefined,
      minCardinality: () => undefined,
      cardinality: () => undefined,
      description: () => undefined,
      domain: () => ({ id: () => "domainId" }),
      range: () => ({ id: () => "rangeId" }),
      subproperties: () => [{ id: () => "sub2" }, { id: () => "sub1" }],
      superproperties: () => [{ id: () => "sup2" }, { id: () => "sup1" }],
      inverse: () => undefined,
    };
  }

  function createMockGraph(nodes, properties) {
    return {
      options: () => ({
        data: () => ({
          _comment: "Test",
          header: {},
          namespace: [
            { prefix: "b", iri: "http://b" },
            { prefix: "a", iri: "http://a" },
          ],
          metrics: {},
        }),
        getGeneralMetaObject: () => ({}),
        filterMenu: () => ({
          getCheckBoxContainer: () => [
            { checkbox: { attr: () => "chk2", property: () => true } },
            { checkbox: { attr: () => "chk1", property: () => false } },
          ],
          getDegreeSliderValue: () => 0,
        }),
        modeMenu: () => ({
          getCheckBoxContainer: () => [
            { attr: () => "mode2", property: () => true },
            { attr: () => "mode1", property: () => false },
          ],
          colorModeState: () => false,
        }),
        classDistance: () => 10,
        datatypeDistance: () => 10,
      }),
      getUnfilteredData: () => ({ nodes, properties }),
      graphNodeElements: () => ({ each: () => {} }),
      graphLabelElements: () => [],
      scaleFactor: () => 1,
      paused: () => false,
      translation: () => [0, 0],
    };
  }

  test("produces deterministic JSON regardless of array order", () => {
    const nodeA = createMockNode("id3", "http://A");
    const nodeB = createMockNode("id1", "http://B");
    const nodeC = createMockNode("id2", undefined); // No IRI
    const nodeD = createMockNode("id4", undefined);

    const propA = createMockProperty("p3", "http://propA");
    const propB = createMockProperty("p1", "http://propB");

    // Two graphs with elements in different orders
    const graph1 = createMockGraph(
      [nodeB, nodeA, nodeD, nodeC],
      [propB, propA],
    );
    const graph2 = createMockGraph(
      [nodeD, nodeC, nodeA, nodeB],
      [propA, propB],
    );

    const menu1 = exportMenuFactory(graph1);
    const menu2 = exportMenuFactory(graph2);

    const json1 = JSON.stringify(menu1.createJSON_exportObject());
    const json2 = JSON.stringify(menu2.createJSON_exportObject());

    expect(json1).toEqual(json2);

    const obj = JSON.parse(json1);

    // Verify sorting rules were applied
    // Namespaces sorted by prefix
    expect(obj.namespace[0].prefix).toBe("a");
    // Classes sorted by IRI then ID
    // empty IRI (undefined) comes before populated IRI
    expect(obj.class[0].id).toBe("id2"); // undefined IRI, id2
    expect(obj.class[1].id).toBe("id4"); // undefined IRI, id4
    expect(obj.class[2].id).toBe("id3"); // http://A
    expect(obj.class[3].id).toBe("id1"); // http://B
    // Attributes sorted
    expect(obj.classAttribute[0].attributes).toEqual([
      "abstract",
      "deprecated",
    ]);
    // Subproperties sorted
    expect(obj.propertyAttribute[0].subproperty).toEqual(["sub1", "sub2"]);
    // Filter settings sorted
    expect(obj.settings.filter.checkBox[0].id).toBe("chk1");
  });
});
