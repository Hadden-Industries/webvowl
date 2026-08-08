import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from "@jest/globals";
import exportMenuFactory from "./exportMenu.js";

describe("export menu downloads", () => {
  let anchor;
  let originalDocument;
  let originalUrl;

  beforeEach(() => {
    jest.useFakeTimers();
    originalDocument = global.document;
    originalUrl = global.URL;
    anchor = {
      click: jest.fn(),
      download: "",
      hidden: false,
      href: "",
      remove: jest.fn(),
    };
    global.document = {
      body: { appendChild: jest.fn() },
      createElement: jest.fn(() => anchor),
    };
    global.URL = {
      createObjectURL: jest.fn(() => "blob:webvowl-export"),
      revokeObjectURL: jest.fn(),
    };
  });

  afterEach(() => {
    jest.useRealTimers();
    global.document = originalDocument;
    global.URL = originalUrl;
  });

  test("downloads generated content through a temporary object URL", async () => {
    exportMenuFactory.downloadFile(
      "ontology content",
      "text/turtle;charset=utf-8",
      "ontology.ttl",
    );

    expect(document.createElement).toHaveBeenCalledWith("a");
    expect(document.body.appendChild).toHaveBeenCalledWith(anchor);
    expect(anchor.href).toBe("blob:webvowl-export");
    expect(anchor.download).toBe("ontology.ttl");
    expect(anchor.hidden).toBe(true);
    expect(anchor.click).toHaveBeenCalledTimes(1);
    expect(anchor.remove).toHaveBeenCalledTimes(1);

    const blob = URL.createObjectURL.mock.calls[0][0];
    expect(blob.type).toBe("text/turtle;charset=utf-8");
    await expect(blob.text()).resolves.toBe("ontology content");

    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    jest.runOnlyPendingTimers();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:webvowl-export");
  });
});

describe("export menu clipboard copying", () => {
  function createLegacyCopyFixture(execCommandResult = true) {
    const popover = { scrollTop: 12 };
    const content = { scrollTop: 34 };
    const previousFocus = { focus: jest.fn() };
    const documentNode = {
      activeElement: previousFocus,
      execCommand: jest.fn(() => execCommandResult),
    };
    const input = {
      value: "https://example.com/#ontology",
      closest: jest.fn((selector) =>
        selector === ".modern-popover" ? popover : content,
      ),
      focus: jest.fn(() => {
        popover.scrollTop = 80;
        content.scrollTop = 90;
      }),
      select: jest.fn(() => {
        popover.scrollTop = 100;
        content.scrollTop = 110;
      }),
    };

    return { content, documentNode, input, popover, previousFocus };
  }

  test("uses the Clipboard API without focusing or selecting the URL input", async () => {
    const input = {
      value: "https://example.com/#ontology",
      focus: jest.fn(),
      select: jest.fn(),
    };
    const clipboard = { writeText: jest.fn(() => Promise.resolve()) };
    const documentNode = { execCommand: jest.fn() };

    await expect(
      exportMenuFactory.copyInputValue(input, clipboard, documentNode),
    ).resolves.toBe(true);

    expect(clipboard.writeText).toHaveBeenCalledWith(input.value);
    expect(input.focus).not.toHaveBeenCalled();
    expect(input.select).not.toHaveBeenCalled();
    expect(documentNode.execCommand).not.toHaveBeenCalled();
  });

  test("falls back after Clipboard API rejection and restores focus and scroll positions", async () => {
    const fixture = createLegacyCopyFixture();
    const clipboard = {
      writeText: jest.fn(() => Promise.reject(new Error("denied"))),
    };

    await expect(
      exportMenuFactory.copyInputValue(
        fixture.input,
        clipboard,
        fixture.documentNode,
      ),
    ).resolves.toBe(true);

    expect(fixture.input.focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(fixture.input.select).toHaveBeenCalledTimes(1);
    expect(fixture.documentNode.execCommand).toHaveBeenCalledWith("copy");
    expect(fixture.previousFocus.focus).toHaveBeenCalledWith({
      preventScroll: true,
    });
    expect(fixture.popover.scrollTop).toBe(12);
    expect(fixture.content.scrollTop).toBe(34);
  });

  test("reports failure when the legacy copy command is rejected", async () => {
    const fixture = createLegacyCopyFixture(false);

    await expect(
      exportMenuFactory.copyInputValue(
        fixture.input,
        null,
        fixture.documentNode,
      ),
    ).resolves.toBe(false);

    expect(fixture.popover.scrollTop).toBe(12);
    expect(fixture.content.scrollTop).toBe(34);
  });
});

describe("export menu json deterministic export", () => {
  let originalWebVowl;

  beforeEach(() => {
    originalWebVowl = global.webvowl;
    global.webvowl = {
      util: { prefixTools: () => ({ updatePrefixModel: () => {} }) },
      version: "2.0.0",
    };
  });

  afterEach(() => {
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
