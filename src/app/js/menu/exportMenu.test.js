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
let decodeVowlVisualizationSettings;

beforeAll(async () => {
  ({ decodeVowlVisualizationSettings } = await loadEsmModuleForTest(
    new URL("../controller/vowlVisualizationSettings.js", import.meta.url),
    import.meta.url,
  ));
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
    // This anchor stands for one the helper creates, appends, clicks and
    // removes. It carries no listeners, so a recorded click is faithful: there
    // is nothing for a dispatch to reach. What this double does not model is
    // the browser's own save, so these tests show that a download was asked
    // for, not that a file arrived.
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

  function appliedVisualizationState() {
    return {
      source: {
        kind: "vowl-json-url",
        identity: "https://example.test/accepted.json",
      },
      view: {
        language: "de",
        focus: [],
        filters: {
          datatypes: "hide",
          objectProperties: "show",
          subclasses: "show",
          disjointness: "hide",
          setOperators: "show",
          minDegree: 2,
        },
        modes: {
          nodeScaling: false,
          compactNotation: true,
          colorExternals: true,
          pickAndPin: true,
          dynamicLabelWidth: false,
          colorExternalsMode: "gradient",
          maxLabelWidthPx: 160,
        },
        forceDistances: { classDistancePx: 300, datatypeDistancePx: 180 },
      },
      layout: { status: "paused" },
      zoomScale: 0.38125,
      translation: { xPx: 0, yPx: -20.125 },
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
      webVowlController: { getState: appliedVisualizationState },
      documentObject: global.document,
      windowObject: global.window,
      locationObject: global.location,
    });
    const menu2 = exportMenuFactory.createExportMenu(graph2, {
      webVowlController: { getState: appliedVisualizationState },
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
    expect(obj.settings.filter.checkBox[0].id).toBe("datatypeFilterCheckbox");
  });

  test("exports applied settings while stale UI and renderer settings remain unread", () => {
    const graph = createMockGraph([createMockNode("id1", "http://A")], []);
    const options = graph.options();
    const rejectStaleSettingsRead = () => {
      throw new Error("Visualization settings belong to the controller.");
    };
    graph.options = () => ({
      ...options,
      filterMenu: rejectStaleSettingsRead,
      modeMenu: rejectStaleSettingsRead,
      classDistance: rejectStaleSettingsRead,
      datatypeDistance: rejectStaleSettingsRead,
    });
    graph.scaleFactor = () => {
      throw new Error("Read the observed viewport.");
    };
    graph.paused = () => {
      throw new Error("Read the observed layout.");
    };
    graph.translation = () => {
      throw new Error("Read the observed viewport.");
    };
    const state = appliedVisualizationState();
    const menu = exportMenuFactory.createExportMenu(graph, {
      webVowlController: { getState: () => state },
    });
    const settings = menu.createJSON_exportObject().settings;
    expect(settings.global).toEqual({
      language: "de",
      paused: true,
      zoom: 0.38125,
      translation: [0, -20.125],
    });
    expect(settings.filter.degreeSliderValue).toBe(2);
    expect(settings.filter.checkBox).toEqual([
      { id: "datatypeFilterCheckbox", checked: true },
      { id: "disjointFilterCheckbox", checked: true },
      { id: "objectPropertyFilterCheckbox", checked: false },
      { id: "setoperatorFilterCheckbox", checked: false },
      { id: "subclassFilterCheckbox", checked: false },
    ]);
    expect(settings.modes.colorSwitchState).toBe(true);
    expect(settings.modes.maxLabelWidth).toBe(160);
    expect(settings.gravity).toEqual({
      classDistance: 300,
      datatypeDistance: 180,
    });
  });

  test("exported standing settings round-trip through the application's saved-file consumer", () => {
    const graph = createMockGraph([createMockNode("id1", "http://A")], []);
    const state = appliedVisualizationState();
    state.layout.status = "relaxing";
    state.view.filters.minDegree = 0;
    state.view.modes.colorExternalsMode = "same";
    const menu = exportMenuFactory.createExportMenu(graph, {
      webVowlController: { getState: () => state },
    });
    const settings = JSON.parse(
      JSON.stringify(menu.createJSON_exportObject()),
    ).settings;
    expect(decodeVowlVisualizationSettings(settings)).toEqual({
      view: {
        language: "de",
        layout: "resume",
        filters: state.view.filters,
        zoomScale: 0.38125,
        translation: { xPx: 0, yPx: -20.125 },
      },
      modes: state.view.modes,
      forceDistances: { classDistancePx: 300, datatypeDistancePx: 180 },
    });
  });

  test("publishes the accepted source link and explains when a local document cannot be shared as a URL", () => {
    const controls = new Map(
      ["#exportedUrl", "#copyBt", "#exportUrlError"].map((id) => [
        id,
        { value: "", textContent: "", classList: { toggle: jest.fn() } },
      ]),
    );
    const graph = createMockGraph([], []);
    graph.editorMode = () => false;
    const editingState = graph.ontologyEditingState();
    graph.ontologyEditingState = () => ({
      ...editingState,
      getHideDebugFeatures: () => true,
    });
    const state = appliedVisualizationState();
    const menu = exportMenuFactory.createExportMenu(graph, {
      documentObject: { querySelector: (id) => controls.get(id) },
      locationObject: "https://viewer.test/#stale",
      webVowlController: { getState: () => state },
    });
    menu.exportAsUrl();
    expect(controls.get("#exportedUrl").value).toContain(
      "#url=https%3A%2F%2Fexample.test%2Faccepted.json",
    );
    expect(controls.get("#copyBt").disabled).toBe(false);
    state.source = { kind: "vowl-json-text", displayName: "local.json" };
    expect(() => menu.exportAsUrl()).not.toThrow();
    expect(controls.get("#exportedUrl").value).toBe("");
    expect(controls.get("#copyBt").disabled).toBe(true);
    expect(controls.get("#exportUrlError").textContent).toContain(
      "Export JSON",
    );
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
