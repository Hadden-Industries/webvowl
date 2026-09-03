import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from "@jest/globals";
import loadEsmModuleForTest from "../../test/loadEsmModuleForTest.js";

const exportMenuFactory = {};

beforeAll(async () => {
  Object.assign(
    exportMenuFactory,
    await loadEsmModuleForTest(
      new URL("./exportMenu.js", import.meta.url),
      import.meta.url,
    ),
  );
});

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
      global.document,
      global.URL,
      global.setTimeout,
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

  test("gives every repeated successful copy distinct visible feedback", () => {
    const firstCopy = exportMenuFactory.nextCopyFeedback(true, 0);
    const secondCopy = exportMenuFactory.nextCopyFeedback(
      true,
      firstCopy.successfulCopyCount,
    );
    const thirdCopy = exportMenuFactory.nextCopyFeedback(
      true,
      secondCopy.successfulCopyCount,
    );

    expect([firstCopy.text, secondCopy.text, thirdCopy.text]).toEqual([
      "Copied!",
      "Copied ×2",
      "Copied ×3",
    ]);
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
            { checkbox: { checked: true, id: "chk2" } },
            { checkbox: { checked: false, id: "chk1" } },
          ],
          getDegreeSliderValue: () => 0,
        }),
        modeMenu: () => ({
          getCheckBoxContainer: () => [
            { element: { checked: true }, id: "mode2" },
            { element: { checked: false }, id: "mode1" },
          ],
          colorModeState: () => false,
        }),
        classDistance: () => 10,
        datatypeDistance: () => 10,
      }),
      ontologyEditingState: () => ({
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
            { checkbox: { checked: true, id: "chk2" } },
            { checkbox: { checked: false, id: "chk1" } },
          ],
          getDegreeSliderValue: () => 0,
        }),
        modeMenu: () => ({
          getCheckBoxContainer: () => [
            { element: { checked: true }, id: "mode2" },
            { element: { checked: false }, id: "mode1" },
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

    const menu1 = exportMenuFactory.createExportMenu(graph1, {
      documentObject: global.document,
      windowObject: global.window,
      locationObject: global.location,
    });
    const menu2 = exportMenuFactory.createExportMenu(graph2, {
      documentObject: global.document,
      windowObject: global.window,
      locationObject: global.location,
    });

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

  test("exports JSON with native DOM checkbox objects from filterMenu and modeMenu", () => {
    const nodeA = createMockNode("id1", "http://A");
    const propA = createMockProperty("p1", "http://propA");

    const graph = {
      options: () => ({
        data: () => ({
          _comment: "Test",
          header: {},
          namespace: [],
          metrics: {},
        }),
        getGeneralMetaObject: () => ({}),
        filterMenu: () => ({
          getCheckBoxContainer: () => [
            { checkbox: { id: "datatypeFilterCheckbox", checked: true } },
            { checkbox: { id: "subclassFilterCheckbox", checked: false } },
          ],
          getDegreeSliderValue: () => 2,
        }),
        modeMenu: () => ({
          getCheckBoxContainer: () => [
            {
              id: "nodescalingModuleCheckbox",
              element: { id: "nodescalingModuleCheckbox", checked: true },
            },
            {
              id: "compactnotationModuleCheckbox",
              element: { id: "compactnotationModuleCheckbox", checked: false },
            },
          ],
          colorModeState: () => false,
        }),
        classDistance: () => 10,
        datatypeDistance: () => 10,
      }),
      ontologyEditingState: () => ({
        data: () => ({
          _comment: "Test",
          header: {},
          namespace: [],
          metrics: {},
        }),
        getGeneralMetaObject: () => ({}),
        filterMenu: () => ({
          getCheckBoxContainer: () => [
            { checkbox: { id: "datatypeFilterCheckbox", checked: true } },
            { checkbox: { id: "subclassFilterCheckbox", checked: false } },
          ],
          getDegreeSliderValue: () => 2,
        }),
        modeMenu: () => ({
          getCheckBoxContainer: () => [
            {
              id: "nodescalingModuleCheckbox",
              element: { id: "nodescalingModuleCheckbox", checked: true },
            },
            {
              id: "compactnotationModuleCheckbox",
              element: { id: "compactnotationModuleCheckbox", checked: false },
            },
          ],
          colorModeState: () => false,
        }),
        classDistance: () => 10,
        datatypeDistance: () => 10,
      }),
      getUnfilteredData: () => ({ nodes: [nodeA], properties: [propA] }),
      graphNodeElements: () => ({ each: () => {} }),
      graphLabelElements: () => [],
      scaleFactor: () => 1,
      paused: () => false,
      translation: () => [0, 0],
    };

    const menu = exportMenuFactory.createExportMenu(graph, {
      documentObject: global.document,
      windowObject: global.window,
      locationObject: global.location,
    });
    const exportObj = menu.createJSON_exportObject();

    expect(exportObj.settings.filter.checkBox).toEqual([
      { checked: true, id: "datatypeFilterCheckbox" },
      { checked: false, id: "subclassFilterCheckbox" },
    ]);
    expect(exportObj.settings.filter.degreeSliderValue).toBe(2);
    expect(exportObj.settings.modes.checkBox).toEqual([
      { checked: false, id: "compactnotationModuleCheckbox" },
      { checked: true, id: "nodescalingModuleCheckbox" },
    ]);
  });

  test("exported settings can be round-tripped into filterMenu and modeMenu setCheckBoxValue targets", () => {
    const nodeA = createMockNode("id1", "http://A");
    const propA = createMockProperty("p1", "http://propA");

    const sourceGraph = {
      options: () => ({
        data: () => ({
          _comment: "Test",
          header: {},
          namespace: [],
          metrics: {},
        }),
        getGeneralMetaObject: () => ({}),
        filterMenu: () => ({
          getCheckBoxContainer: () => [
            { checkbox: { checked: true, id: "datatypeFilterCheckbox" } },
            { checkbox: { checked: false, id: "subclassFilterCheckbox" } },
            { checkbox: { checked: true, id: "disjointFilterCheckbox" } },
          ],
          getDegreeSliderValue: () => 3,
        }),
        modeMenu: () => ({
          getCheckBoxContainer: () => [
            {
              element: { checked: true },
              id: "nodescalingModuleCheckbox",
            },
            {
              element: { checked: false },
              id: "compactnotationModuleCheckbox",
            },
            {
              element: { checked: true },
              id: "pickandpinModuleCheckbox",
            },
          ],
          colorModeState: () => true,
        }),
        classDistance: () => 200,
        datatypeDistance: () => 120,
      }),
      ontologyEditingState: () => ({
        data: () => ({
          _comment: "Test",
          header: {},
          namespace: [],
          metrics: {},
        }),
        getGeneralMetaObject: () => ({}),
        filterMenu: () => ({
          getCheckBoxContainer: () => [
            { checkbox: { checked: true, id: "datatypeFilterCheckbox" } },
            { checkbox: { checked: false, id: "subclassFilterCheckbox" } },
            { checkbox: { checked: true, id: "disjointFilterCheckbox" } },
          ],
          getDegreeSliderValue: () => 3,
        }),
        modeMenu: () => ({
          getCheckBoxContainer: () => [
            {
              element: { checked: true },
              id: "nodescalingModuleCheckbox",
            },
            {
              element: { checked: false },
              id: "compactnotationModuleCheckbox",
            },
            {
              element: { checked: true },
              id: "pickandpinModuleCheckbox",
            },
          ],
          colorModeState: () => true,
        }),
        classDistance: () => 200,
        datatypeDistance: () => 120,
      }),
      getUnfilteredData: () => ({ nodes: [nodeA], properties: [propA] }),
      graphNodeElements: () => ({ each: () => {} }),
      graphLabelElements: () => [],
      scaleFactor: () => 1.5,
      paused: () => true,
      translation: () => [100, 200],
    };

    const menu = exportMenuFactory.createExportMenu(sourceGraph, {
      documentObject: global.document,
      windowObject: global.window,
      locationObject: global.location,
    });
    const exportedJson = menu.createJSON_exportObject();

    // Target state receivers
    const targetFilterState = {};
    const targetModeState = {};

    exportedJson.settings.filter.checkBox.forEach((item) => {
      targetFilterState[item.id] = item.checked;
    });
    exportedJson.settings.modes.checkBox.forEach((item) => {
      targetModeState[item.id] = item.checked;
    });

    expect(targetFilterState).toEqual({
      datatypeFilterCheckbox: true,
      disjointFilterCheckbox: true,
      subclassFilterCheckbox: false,
    });
    expect(targetModeState).toEqual({
      compactnotationModuleCheckbox: false,
      nodescalingModuleCheckbox: true,
      pickandpinModuleCheckbox: true,
    });
    expect(exportedJson.settings.gravity.classDistance).toBe(200);
    expect(exportedJson.settings.gravity.datatypeDistance).toBe(120);
    expect(exportedJson.settings.global.zoom).toBe(1.5);
    expect(exportedJson.settings.global.paused).toBe(true);
  });
});

async function flushPendingWork() {
  for (let round = 0; round < 20; round += 1) {
    await Promise.resolve();
  }
}

describe("export menu SVG artifact route", () => {
  let originalDocument;
  let controls;
  let exportMenu;
  let exportRequests;
  let hideAllMenus;

  function controlFor(selector) {
    if (!controls.has(selector)) {
      const control = {
        addEventListener(eventName, listener) {
          this.listeners = this.listeners ?? {};
          this.listeners[eventName] = listener;
        },
        listeners: {},
        defaultActionCount: 0,
        clickCount: 0,
        getAttribute: (name) => controls.get(selector)[name] ?? null,
      };
      // Dispatches to its own listener the way a real element does, so a
      // handler that clicks the element it is bound to re-enters itself here
      // as it would in a browser.
      control.click = jest.fn(function performClick() {
        control.clickCount += 1;
        let isDefaultPrevented = false;
        const clickEvent = {
          preventDefault() {
            isDefaultPrevented = true;
          },
        };
        control.listeners?.click?.(clickEvent);
        if (!isDefaultPrevented) {
          // What a browser would do: follow the link and save the file.
          control.defaultActionCount += 1;
        }
      });
      controls.set(selector, control);
    }
    return controls.get(selector);
  }

  beforeEach(() => {
    originalDocument = global.document;
    controls = new Map();
    global.document = {
      querySelector: controlFor,
      querySelectorAll: () => [],
      getElementById: (id) => controlFor("#" + id),
    };
    exportRequests = [];
    hideAllMenus = jest.fn();
    exportMenu = exportMenuFactory.createExportMenu(
      {
        options: () => ({ navigationMenu: () => ({ hideAllMenus }) }),
        ontologyEditingState: () => ({ getHideDebugFeatures: () => true }),
      },
      {
        documentObject: global.document,
        locationObject: { href: "https://example.test/" },
        webVowlController: {
          exportVisualization: jest.fn((exportRequest) => {
            exportRequests.push(exportRequest);
            return Promise.resolve({
              artifactMetadata: { filename: "graph.svg", byteLength: 12 },
            });
          }),
        },
        windowObject: global.window,
      },
    );
  });

  afterEach(() => {
    global.document = originalDocument;
  });

  test("asks the controller for the artifact instead of serializing inline", async () => {
    const exportEvent = { preventDefault: jest.fn() };

    await exportMenu.exportSvgArtifact(exportEvent);

    // The link must not navigate before the artifact URL is published.
    expect(exportEvent.preventDefault).toHaveBeenCalledTimes(1);
    expect(exportRequests).toEqual([{}]);
    expect(hideAllMenus).toHaveBeenCalledTimes(1);
  });

  test("triggers exactly one programmatic download once the link is published", async () => {
    const downloadLink = controlFor("#exportSvg");
    downloadLink.href = "blob:webvowl-artifact";

    await exportMenu.exportSvgArtifact({ preventDefault: jest.fn() });

    expect(downloadLink.click).toHaveBeenCalledTimes(1);
  });

  test("downloads once for a reader's click without re-entering itself", async () => {
    const downloadLink = controlFor("#exportSvg");
    downloadLink.href = "blob:webvowl-artifact";
    exportMenu.setup();

    // What a reader does: one click on the export entry.
    downloadLink.click();
    await flushPendingWork();

    // One export, one saved file, and the menus hidden once. Clicking the very
    // element the handler is bound to previously re-entered it without end,
    // which prevented every download and hid the menus on every pass.
    expect(exportRequests).toHaveLength(1);
    expect(downloadLink.defaultActionCount).toBe(1);
    expect(hideAllMenus).toHaveBeenCalledTimes(1);
  });

  test("does not click the link when the export fails", async () => {
    const downloadLink = controlFor("#exportSvg");
    exportMenu = exportMenuFactory.createExportMenu(
      {
        options: () => ({ navigationMenu: () => ({ hideAllMenus }) }),
        ontologyEditingState: () => ({ getHideDebugFeatures: () => true }),
      },
      {
        documentObject: global.document,
        locationObject: { href: "https://example.test/" },
        webVowlController: {
          exportVisualization: () =>
            Promise.reject(
              Object.assign(new Error("no ontology"), { code: "NO_ONTOLOGY" }),
            ),
        },
        windowObject: global.window,
      },
    );

    await exportMenu.exportSvgArtifact({ preventDefault: jest.fn() });

    expect(downloadLink.click).not.toHaveBeenCalled();
  });
});
