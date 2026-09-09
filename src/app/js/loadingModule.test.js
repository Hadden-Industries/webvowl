import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createContext, SourceTextModule, SyntheticModule } from "node:vm";
import loadEsmModuleForTest from "../test/loadEsmModuleForTest.js";
import { loadWithImports as productionLoadWithImports } from "../../owl2vowl/js/index.js";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from "@jest/globals";

let createLoadingModule;
let loadingModuleContext;
// Interface modules collaborate through the application registry.
const registeredUiModulesForTest = new Map();

class LoadingControl extends EventTarget {
  constructor() {
    super();
    this.className = "";
    this.disabled = false;
    this.scrollHeight = 0;
    this.scrollTop = 0;
    this.textContent = "";
    this.classes = new Set();
    this.classList = {
      add: (...classNames) =>
        classNames.forEach((className) => this.classes.add(className)),
      contains: (className) => this.classes.has(className),
      remove: (...classNames) =>
        classNames.forEach((className) => this.classes.delete(className)),
      toggle: (className, isPresent) => {
        if (isPresent) {
          this.classes.add(className);
        } else {
          this.classes.delete(className);
        }
      },
    };
  }

  removeAttribute() {}

  setAttribute(name, value) {
    this[name] = value;
  }
}

global.document = {
  baseURI: "https://example.test/webvowl/",
  querySelector: jest.fn().mockReturnValue(new LoadingControl()),
  querySelectorAll: jest.fn().mockReturnValue([]),
};
global.window = {
  history: {
    pushState: jest.fn(),
  },
};

beforeAll(async () => {
  const { readVisualizationShareLink } = await loadEsmModuleForTest(
    new URL("./controller/visualizationShareLink.js", import.meta.url),
    import.meta.url,
  );
  const loadingModuleUrl = new URL("./loadingModule.js", import.meta.url);
  const lifecycleModuleUrl = new URL("./ontologyLifecycle.js", import.meta.url);
  const resolveFetchUrlModuleUrl = new URL(
    "../../shared/js/util/resolveFetchUrl.js",
    import.meta.url,
  );
  loadingModuleContext = createContext({
    AbortController,
    URL,
    console,
    document: global.document,
    fetch: undefined,
    location: undefined,
    window: global.window,
  });
  const createSourceTextModule = (moduleUrl) =>
    new SourceTextModule(readFileSync(fileURLToPath(moduleUrl), "utf8"), {
      context: loadingModuleContext,
      identifier: moduleUrl.href,
    });
  const loadingModuleSource = createSourceTextModule(loadingModuleUrl);
  const lifecycleModuleSource = createSourceTextModule(lifecycleModuleUrl);
  const resolveFetchUrlModuleSource = createSourceTextModule(
    resolveFetchUrlModuleUrl,
  );
  const owl2VowlModule = new SyntheticModule(
    ["loadWithImports"],
    function initializeOwl2VowlModule() {
      this.setExport("loadWithImports", productionLoadWithImports);
    },
    { context: loadingModuleContext, identifier: "test:owl2vowl" },
  );
  await loadingModuleSource.link((specifier) => {
    if (specifier === "./controller/visualizationShareLink.js") {
      return new SyntheticModule(
        ["readVisualizationShareLink"],
        function provideShareLinkConsumer() {
          this.setExport(
            "readVisualizationShareLink",
            readVisualizationShareLink,
          );
        },
        { context: loadingModuleContext, identifier: specifier },
      );
    }
    if (specifier === "../../owl2vowl/js/index.js") {
      return owl2VowlModule;
    }
    if (specifier === "../../shared/js/util/resolveFetchUrl.js") {
      return resolveFetchUrlModuleSource;
    }
    if (specifier === "./ontologyLifecycle.js") {
      return lifecycleModuleSource;
    }
    if (specifier.endsWith("applicationUiRegistry.js")) {
      return new SyntheticModule(
        ["applicationUiModule", "registerApplicationUiModule"],
        function provideApplicationUiRegistry() {
          this.setExport("applicationUiModule", (moduleName) =>
            registeredUiModulesForTest.get(moduleName),
          );
          this.setExport(
            "registerApplicationUiModule",
            (moduleName, uiModule) =>
              registeredUiModulesForTest.set(moduleName, uiModule),
          );
        },
        { context: loadingModuleContext, identifier: specifier },
      );
    }
    throw new Error(`Unexpected loading-module dependency: ${specifier}`);
  });
  await loadingModuleSource.evaluate();
  ({ createLoadingModule } = loadingModuleSource.namespace);
});
describe("loading module create-new command", () => {
  let graph;
  let loadingModule;
  let pushedRoutes;
  let requestedLoads;

  beforeEach(() => {
    global.location = { hash: "#file=foaf.rdf.json" };
    pushedRoutes = [];
    global.window = {
      history: {
        pushState: (_state, _title, route) => {
          pushedRoutes.push(route);
          global.location.hash = route;
        },
      },
    };
    loadingModuleContext.document = global.document;
    loadingModuleContext.location = global.location;
    loadingModuleContext.window = global.window;

    graph = {
      clearAllGraphData: jest.fn(),
      editorMode: jest.fn(),
      options: () => ({}),
    };
    requestedLoads = [];
    loadingModule = createLoadingModule(graph, {
      webVowlController: {
        loadOntology(loadRequest) {
          requestedLoads.push(loadRequest);
          return Promise.resolve({ status: "ready" });
        },
      },
    });
  });

  afterEach(() => {
    loadingModule?.dispose();
    loadingModuleContext.location = undefined;
  });

  test("loads each new ontology directly and records a unique shareable route", () => {
    expect(loadingModule.createNewOntology()).toBe("new_ontology1");
    expect(loadingModule.createNewOntology()).toBe("new_ontology2");

    expect(pushedRoutes).toEqual([
      "#opts=editorMode=true;#new_ontology1",
      "#opts=editorMode=true;#new_ontology2",
    ]);
    expect(graph.editorMode).toHaveBeenCalledTimes(2);
    expect(graph.editorMode).toHaveBeenNthCalledWith(1, true);
    // The empty preset document reaches the controller like any other source.
    expect(requestedLoads).toEqual([
      {
        source: {
          kind: "vowl-json-url",
          url: "https://example.test/webvowl/data/new_ontology.json",
        },
      },
      {
        source: {
          kind: "vowl-json-url",
          url: "https://example.test/webvowl/data/new_ontology.json",
        },
      },
    ]);
  });

  test("continues numbering after a new-ontology route loaded from elsewhere", () => {
    global.location.hash = "#opts=editorMode=true;#new_ontology12";

    expect(loadingModule.createNewOntology()).toBe("new_ontology13");
  });
});

describe("loading module remote source derivation", () => {
  let loadingModule;
  let requestedLoads;

  function createLoadingModuleForLocation(locationHref) {
    global.location = {
      hash: locationHref.slice(locationHref.indexOf("#")),
      href: locationHref,
      protocol: new URL(locationHref).protocol,
      toString: () => locationHref,
    };
    loadingModuleContext.location = global.location;
    return createLoadingModule(
      { options: () => ({}), clearAllGraphData() {}, clearGraphData() {} },
      {
        webVowlController: {
          loadOntology(loadRequest) {
            requestedLoads.push(loadRequest);
            return Promise.resolve({ status: "ready" });
          },
        },
      },
    );
  }

  beforeEach(() => {
    requestedLoads = [];
  });

  afterEach(() => {
    loadingModule?.dispose();
    loadingModuleContext.location = undefined;
  });

  test("records the requested location rather than a rewritten one", () => {
    // The retrieval layer upgrades mixed content; the source keeps the
    // identity the reader asked for.
    loadingModule = createLoadingModuleForLocation(
      "https://webvowl.example/#url=" +
        encodeURIComponent("http://example.com/graph.json"),
    );

    expect(loadingModule.ontologyLoadRequestFromLocation().source).toEqual({
      kind: "vowl-json-url",
      url: "http://example.com/graph.json",
    });
  });

  test("keeps an ontology document IRI exactly as supplied", () => {
    loadingModule = createLoadingModuleForLocation(
      "https://webvowl.example/#iri=" +
        encodeURIComponent("http://example.com/ontology.rdf"),
    );

    expect(loadingModule.ontologyLoadRequestFromLocation().source).toEqual({
      kind: "ontology-document-iri",
      documentIri: "http://example.com/ontology.rdf",
    });
  });
});

describe("loading presentation listener ownership", () => {
  let controls;
  let loadingModule;

  beforeEach(() => {
    controls = new Map();
    global.document = {
      querySelector: (selector) => {
        if (!controls.has(selector)) {
          controls.set(selector, new LoadingControl());
        }
        return controls.get(selector);
      },
      querySelectorAll: () => [],
    };
    loadingModuleContext.document = global.document;
    loadingModule = createLoadingModule({ options: () => ({}) });
  });

  afterEach(() => {
    loadingModule?.dispose();
    loadingModuleContext.document = undefined;
  });

  test("setup registers one details toggle and disposal removes it", () => {
    loadingModule.setup();
    loadingModule.setup();
    const detailsButton = controls.get("#show-loadingInfo-button");

    detailsButton.dispatchEvent(new Event("click"));
    expect(loadingModule.getDetailsState()).toBe(true);

    loadingModule.dispose();
    loadingModule.dispose();
    detailsButton.dispatchEvent(new Event("click"));
    expect(loadingModule.getDetailsState()).toBe(true);
  });
});

describe("loading module controller state presentation", () => {
  let controls;
  let loadingModule;

  beforeEach(() => {
    controls = new Map();
    global.document = {
      querySelector: (selector) => {
        if (!controls.has(selector)) {
          controls.set(selector, new LoadingControl());
        }
        return controls.get(selector);
      },
      querySelectorAll: () => [],
    };
    loadingModuleContext.document = global.document;
    loadingModule = createLoadingModule({ options: () => ({}) });
  });

  afterEach(() => {
    loadingModule?.dispose();
    loadingModuleContext.document = undefined;
  });

  test("shows layout progress while the controller reports a load", () => {
    loadingModule.renderControllerState({
      status: "loading",
      loadGeneration: 1,
      renderProgress: {
        completedRenderedElementCount: 40,
        totalRenderedElementCount: 100,
      },
    });

    expect(loadingModule.getMessageVisibilityStatus()).toBe(true);
    expect(controls.get("#progressBarLabel").textContent).toBe("40%");
    expect(loadingModule.state()).toBe("rendering");
  });

  test("keeps the indicator busy through every in-flight controller status", () => {
    for (const inFlightStatus of ["loading", "parsing", "rendering"]) {
      loadingModule.renderControllerState({
        status: inFlightStatus,
        loadGeneration: 1,
      });

      expect(loadingModule.getMessageVisibilityStatus()).toBe(true);
      expect(controls.get("#currentLoadingStep").className).toBe("step-busy");
    }
  });

  test("enables human graph actions once drawing is available during layout", () => {
    const actionAvailability = [];
    loadingModule.dispose();
    loadingModule = createLoadingModule({
      options: () => ({
        resetMenu: () => ({
          setMenuMode: (enabled) => actionAvailability.push(enabled),
        }),
      }),
    });
    loadingModule.renderControllerState({
      status: "rendering",
      loadGeneration: 1,
    });
    expect(actionAvailability.at(-1)).toBe(false);
    loadingModule.renderControllerState({
      status: "relaxing",
      loadGeneration: 1,
      renderProgress: {
        completedRenderedElementCount: 80,
        totalRenderedElementCount: 100,
      },
    });

    expect(loadingModule.state()).toBe("ready");
    expect(actionAvailability.at(-1)).toBe(true);
    expect(loadingModule.getMessageVisibilityStatus()).toBe(false);
  });

  test("hides the indicator once the controller reports the graph is ready", () => {
    loadingModule.renderControllerState({
      status: "loading",
      loadGeneration: 1,
    });
    loadingModule.renderControllerState({ status: "ready", loadGeneration: 1 });

    expect(loadingModule.getMessageVisibilityStatus()).toBe(false);
    expect(loadingModule.state()).toBe("ready");
  });

  test("keeps the indicator visible and reports a controller error", () => {
    loadingModule.renderControllerState({
      status: "error",
      loadGeneration: 1,
      error: { code: "LOAD_FAILED", message: "The ontology could not load." },
    });

    expect(loadingModule.getMessageVisibilityStatus()).toBe(true);
    expect(controls.get("#currentLoadingStep").className).toBe("step-error");
    expect(loadingModule.state()).toBe("error");
  });

  test("reports a rejected replacement while keeping the retained graph usable", () => {
    loadingModule.renderControllerState({
      status: "error",
      loadGeneration: 1,
      source: {
        kind: "vowl-json-url",
        identity: "https://example.test/accepted.json",
      },
      layout: { status: "paused" },
      error: { code: "PARSE_FAILED", message: "The new source is invalid." },
    });
    expect(loadingModule.state()).toBe("ready");
    expect(loadingModule.getMessageVisibilityStatus()).toBe(true);
    expect(controls.get("#currentLoadingStep").className).toBe("step-error");
  });
});

describe("loading module canonical controller sources", () => {
  let controls;
  let loadingModule;
  let requestedLoads;
  let requestedLoadOptions;
  let presentedRoutes;

  function createLoadingModuleForLocation(
    locationHref,
    controllerState = { status: "idle" },
  ) {
    global.location = {
      hash: locationHref.slice(locationHref.indexOf("#")),
      href: locationHref,
      toString: () => locationHref,
    };
    loadingModuleContext.location = global.location;
    return createLoadingModule(
      { options: () => ({}), clearAllGraphData() {}, clearGraphData() {} },
      {
        onShareLinkPresentation: (value) => presentedRoutes.push(value),
        webVowlController: {
          getState: () => controllerState,
          loadOntology(loadRequest, loadOptions) {
            requestedLoads.push(loadRequest);
            requestedLoadOptions.push(loadOptions);
            return Promise.resolve({ status: "ready", loadGeneration: 1 });
          },
        },
      },
    );
  }

  beforeEach(() => {
    requestedLoads = [];
    requestedLoadOptions = [];
    presentedRoutes = [];
    controls = new Map();
    global.document = {
      baseURI: "https://example.test/webvowl/",
      querySelector: (selector) => {
        if (!controls.has(selector)) {
          controls.set(selector, new LoadingControl());
        }
        return controls.get(selector);
      },
      querySelectorAll: () => [],
    };
    loadingModuleContext.document = global.document;
  });

  afterEach(() => {
    loadingModule?.dispose();
    loadingModuleContext.document = undefined;
    loadingModuleContext.location = undefined;
  });

  test("routes a VOWL JSON URL in the location to the controller", async () => {
    loadingModule = createLoadingModuleForLocation(
      "https://example.test/webvowl/#url=https%3A%2F%2Fexample.test%2Ffoaf.json",
    );

    await loadingModule.loadRemoteSource({
      ...loadingModule.ontologyLoadRequestFromLocation(),
    });

    expect(requestedLoads).toEqual([
      {
        source: {
          kind: "vowl-json-url",
          url: "https://example.test/foaf.json",
        },
      },
    ]);
  });

  test("loads explicit share-link choices through the controller before presenting route-only UI choices", async () => {
    loadingModule = createLoadingModuleForLocation(
      "https://example.test/webvowl/#opts=doc=0;mode_scaling=false;sidebar=0;#foaf",
    );
    const request = loadingModule.ontologyLoadRequestFromLocation();
    expect(request.initialVisualization).toEqual({
      view: { filters: { minDegree: 0 } },
      modes: { nodeScaling: false },
    });
    expect(presentedRoutes).toEqual([]);
    await loadingModule.loadRemoteSource(request);
    expect(requestedLoads).toEqual([
      {
        source: {
          kind: "vowl-json-url",
          url: "https://example.test/webvowl/data/foaf.json",
        },
      },
    ]);
    expect(requestedLoadOptions).toEqual([
      {
        initialVisualization: {
          view: { filters: { minDegree: 0 } },
          modes: { nodeScaling: false },
        },
      },
    ]);
    expect(presentedRoutes).toEqual([{ sidebar: 0 }]);
  });

  test.each([
    { scenario: "startup", state: { status: "idle" }, expectedState: "error" },
    {
      scenario: "hash-change",
      state: {
        status: "ready",
        loadGeneration: 1,
        source: { kind: "vowl-json-url" },
        layout: { status: "paused" },
      },
      expectedState: "ready",
    },
  ])(
    "presents malformed $scenario options without rejecting initialization or replacing the drawing",
    async ({ state, expectedState }) => {
      loadingModule = createLoadingModuleForLocation(
        "https://example.test/webvowl/#opts=doc=1.5;#foaf",
        state,
      );
      const messages = [];
      const inlineError = global.document.querySelector("#loadingErrorMessage");
      inlineError.hidden = true;
      loadingModule.setOntologyMenu({
        append_message_toLastBulletPoint: (message) => messages.push(message),
      });
      await expect(
        loadingModule.loadOntologyFromLocation(),
      ).resolves.toBeUndefined();
      expect(requestedLoads).toEqual([]);
      expect(messages).toEqual([
        "The visualization link contains invalid options or an invalid ontology address.",
      ]);
      // Standalone errors have no preceding loading-details bullet. The
      // visible status must carry the explanation independently of that list.
      expect(inlineError.textContent).toBe(messages[0]);
      expect(inlineError.hidden).toBe(false);
      expect(controls.get("#currentLoadingStep").textContent).toBe(
        "Loading failed",
      );
      expect(loadingModule.getProgressBarMode()).toBe(0);
      expect(loadingModule.state()).toBe(expectedState);
      loadingModule.renderControllerState({ status: "ready" });
      expect(inlineError.hidden).toBe(true);
      expect(inlineError.textContent).toBe("");
    },
  );

  test("routes an ontology document IRI in the location to the controller", async () => {
    loadingModule = createLoadingModuleForLocation(
      "https://example.test/webvowl/#iri=http%3A%2F%2Fxmlns.com%2Ffoaf%2F0.1%2F",
    );

    await loadingModule.loadRemoteSource({
      ...loadingModule.ontologyLoadRequestFromLocation(),
    });

    expect(requestedLoads).toEqual([
      {
        source: {
          kind: "ontology-document-iri",
          documentIri: "http://xmlns.com/foaf/0.1/",
        },
      },
    ]);
  });

  test("resolves a preset ontology against the document base URI", async () => {
    loadingModule = createLoadingModuleForLocation(
      "https://example.test/webvowl/#foaf",
    );

    await loadingModule.loadRemoteSource({
      ...loadingModule.ontologyLoadRequestFromLocation(),
    });

    expect(requestedLoads).toEqual([
      {
        source: {
          kind: "vowl-json-url",
          url: "https://example.test/webvowl/data/foaf.json",
        },
      },
    ]);
  });

  test("routes dropped JSON text to the controller for parsing", async () => {
    loadingModule = createLoadingModuleForLocation(
      "https://example.test/webvowl/#foaf",
    );
    const vowlModel = { header: { title: { undefined: "Dropped" } } };

    await loadingModule.loadDroppedFile({
      name: "dropped.json",
      text: () => Promise.resolve(JSON.stringify(vowlModel)),
    });

    expect(requestedLoads).toEqual([
      {
        source: {
          kind: "vowl-json-text",
          text: JSON.stringify(vowlModel),
          displayName: "dropped.json",
        },
      },
    ]);
  });

  test("routes a dropped ontology document as ontology text", async () => {
    loadingModule = createLoadingModuleForLocation(
      "https://example.test/webvowl/#foaf",
    );

    await loadingModule.loadDroppedFile({
      name: "dropped.ttl",
      text: () => Promise.resolve("@prefix ex: <http://example.test/> ."),
    });

    expect(requestedLoads).toEqual([
      {
        source: {
          kind: "ontology-text",
          text: "@prefix ex: <http://example.test/> .",
          displayName: "dropped.ttl",
          format: "turtle",
        },
      },
    ]);
  });

  test.each(["remote", "file"])(
    "retains drawing data when a %s source is rejected",
    async (inputKind) => {
      const drawnNodes = ["accepted-node"];
      const state = {
        status: "error",
        loadGeneration: 1,
        source: { kind: "vowl-json-url" },
        layout: { status: "paused" },
        error: { message: "Bad source" },
      };
      loadingModule = createLoadingModule(
        {
          options: () => ({}),
          clearAllGraphData: () => drawnNodes.splice(0),
        },
        {
          webVowlController: {
            getState: () => state,
            loadOntology: async () => {
              throw new Error("Bad source");
            },
          },
        },
      );
      if (inputKind === "remote") {
        await loadingModule.loadRemoteSource({
          source: {
            kind: "vowl-json-url",
            url: "https://example.test/bad.json",
          },
        });
      } else {
        await loadingModule.loadDroppedFile({
          name: "bad.json",
          text: async () => "{",
        });
      }
      expect(drawnNodes).toEqual(["accepted-node"]);
    },
  );

  test("handles a failed file read without clearing the graph or stranding controls", async () => {
    const state = {
      status: "ready",
      loadGeneration: 1,
      source: { kind: "vowl-json-url" },
      layout: { status: "paused" },
    };
    loadingModule = createLoadingModule(
      { options: () => ({}) },
      { webVowlController: { getState: () => state, loadOntology: jest.fn() } },
    );
    await expect(
      loadingModule.loadDroppedFile({
        name: "unreadable.json",
        text: async () => {
          throw new Error("read failed");
        },
      }),
    ).resolves.toBeUndefined();
    expect(loadingModule.state()).toBe("ready");
    expect(controls.get("#currentLoadingStep").className).toBe("step-error");
  });

  test("a slow earlier file cannot replace a newer selected file", async () => {
    loadingModule = createLoadingModuleForLocation(
      "https://example.test/webvowl/#foaf",
    );
    let finishEarlierRead;
    const earlier = loadingModule.loadDroppedFile({
      name: "earlier.json",
      text: () =>
        new Promise((resolve) => {
          finishEarlierRead = resolve;
        }),
    });
    await loadingModule.loadDroppedFile({
      name: "newer.json",
      text: async () => '{"header":{}}',
    });
    finishEarlierRead('{"header":{}}');
    await earlier;
    expect(requestedLoads.map((request) => request.source.displayName)).toEqual(
      ["newer.json"],
    );
  });

  test("a controller load supersedes a pending local file read", async () => {
    loadingModule = createLoadingModuleForLocation(
      "https://example.test/webvowl/#foaf",
    );
    let finishRead;
    const pending = loadingModule.loadDroppedFile({
      name: "earlier.json",
      text: () =>
        new Promise((resolve) => {
          finishRead = resolve;
        }),
    });
    loadingModule.renderControllerState({
      status: "loading",
      loadGeneration: 2,
    });
    finishRead('{"header":{}}');
    await pending;
    expect(requestedLoads).toEqual([]);
    expect(loadingModule.state()).toBe("loading");
  });
});

describe("loading module control availability", () => {
  let controls;
  let loadingModule;
  let zoomSliderMenuModes;

  beforeEach(() => {
    controls = new Map();
    global.document = {
      querySelector: (selector) => {
        if (!controls.has(selector)) {
          controls.set(selector, new LoadingControl());
        }
        return controls.get(selector);
      },
      querySelectorAll: () => [],
    };
    loadingModuleContext.document = global.document;
    zoomSliderMenuModes = [];
    registeredUiModulesForTest.clear();
    registeredUiModulesForTest.set("zoomSlider", {
      setMenuMode: (enabled) => zoomSliderMenuModes.push(enabled),
    });
    loadingModule = createLoadingModule({ options: () => ({}) });
  });

  afterEach(() => {
    loadingModule?.dispose();
    loadingModuleContext.document = undefined;
    registeredUiModulesForTest.clear();
  });

  test("enables graph controls through the interface registry when ready", () => {
    loadingModule.markReady();

    // The renderer settings object no longer carries interface modules, so a
    // lookup there would silently leave the zoom controls disabled.
    expect(zoomSliderMenuModes).toEqual([true]);
  });

  test("disables graph controls again while a load is in flight", () => {
    loadingModule.markReady();
    loadingModule.markLoading();

    expect(zoomSliderMenuModes).toEqual([true, false]);
  });
});
