import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from "@jest/globals";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createContext, SourceTextModule, SyntheticModule } from "node:vm";

import { loadWithImports as productionLoadWithImports } from "../../owl2vowl/js/index.js";

let createLoadingModule;
let loadingModuleContext;

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
  querySelector: jest.fn().mockReturnValue(new LoadingControl()),
  querySelectorAll: jest.fn().mockReturnValue([]),
};
global.window = {
  history: {
    pushState: jest.fn(),
  },
};

beforeAll(async () => {
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
    if (specifier === "../../owl2vowl/js/index.js") {
      return owl2VowlModule;
    }
    if (specifier === "../../shared/js/util/resolveFetchUrl.js") {
      return resolveFetchUrlModuleSource;
    }
    if (specifier === "./ontologyLifecycle.js") {
      return lifecycleModuleSource;
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
    loadingModule = createLoadingModule(graph);
    loadingModule.initializeLoader = jest.fn();
    loadingModule.from_presetOntology = jest.fn();
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
    expect(graph.clearAllGraphData).toHaveBeenCalledTimes(2);
    expect(loadingModule.initializeLoader).toHaveBeenCalledTimes(2);
    expect(loadingModule.from_presetOntology).toHaveBeenNthCalledWith(
      1,
      "new_ontology1",
    );
    expect(loadingModule.from_presetOntology).toHaveBeenNthCalledWith(
      2,
      "new_ontology2",
    );
  });

  test("continues numbering after a new-ontology route loaded from elsewhere", () => {
    global.location.hash = "#opts=editorMode=true;#new_ontology12";

    expect(loadingModule.createNewOntology()).toBe("new_ontology13");
  });
});

describe("loading module remote fetch URLs", () => {
  test("derives direct HTTP resource fetch schemes from the WebVOWL base", () => {
    const originalFetch = global.fetch;
    const originalLocation = global.location;
    const pendingResponse = new Promise(() => undefined);
    const fetchImpl = jest.fn(() => pendingResponse);
    const ontologyMenu = {
      append_bulletPoint: jest.fn(),
      append_message: jest.fn(),
      cachedOntology: jest.fn(() => undefined),
    };
    const loadingModule = createLoadingModule({ options: () => ({}) });
    loadingModule.setOntologyMenu(ontologyMenu);
    global.fetch = fetchImpl;
    loadingModuleContext.fetch = fetchImpl;

    try {
      global.location = {
        href: "https://webvowl.example/viewer",
        protocol: "https:",
      };
      loadingModuleContext.location = global.location;
      loadingModule.from_JSON_URL(
        "url=" + encodeURIComponent("http://example.com/graph.json"),
      );
      loadingModule.from_IRI_URL(
        "iri=" + encodeURIComponent("http://example.com/ontology.rdf"),
      );

      global.location = {
        href: "http://webvowl.example/viewer",
        protocol: "http:",
      };
      loadingModuleContext.location = global.location;
      loadingModule.from_JSON_URL(
        "url=" + encodeURIComponent("http://example.com/local.json"),
      );

      expect(fetchImpl.mock.calls.map(([url]) => url)).toEqual([
        "https://example.com/graph.json",
        "https://example.com/ontology.rdf",
        "http://example.com/local.json",
      ]);
    } finally {
      loadingModule.dispose();
      global.fetch = originalFetch;
      global.location = originalLocation;
      loadingModuleContext.fetch = originalFetch;
      loadingModuleContext.location = originalLocation;
    }
  });

  test("resolves relative ontology IRIs against the upgraded retrieval URL", async () => {
    const originalFetch = global.fetch;
    const originalLocation = global.location;
    const ontologyDocument = `
      <rdf:RDF
        xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
        xmlns:owl="http://www.w3.org/2002/07/owl#">
        <owl:Ontology rdf:about=""/>
        <owl:Class rdf:about="#Person"/>
      </rdf:RDF>
    `;
    let finishLoading;
    const loadedOntology = new Promise((resolve) => {
      finishLoading = resolve;
    });
    const ontologyMenu = {
      append_bulletPoint: jest.fn(),
      append_message_toLastBulletPoint: jest.fn(),
      cachedOntology: jest.fn(() => undefined),
      getLoadingFunction: () => (content) => {
        finishLoading(JSON.parse(content));
      },
    };
    const graph = {
      handleOnLoadingError: jest.fn(),
      options: () => ({}),
    };
    const loadingModule = createLoadingModule(graph);
    loadingModule.setOntologyMenu(ontologyMenu);
    global.location = {
      href: "https://webvowl.example/viewer",
      protocol: "https:",
    };
    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () => ontologyDocument,
    }));
    loadingModuleContext.location = global.location;
    loadingModuleContext.fetch = global.fetch;

    try {
      loadingModule.from_IRI_URL(
        "iri=" + encodeURIComponent("http://example.com/ontology.rdf"),
      );
      const result = await loadedOntology;

      expect(result.header.iri).toBe("https://example.com/ontology.rdf");
      expect(result.classAttribute).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            iri: "https://example.com/ontology.rdf#Person",
          }),
        ]),
      );
    } finally {
      loadingModule.dispose();
      global.fetch = originalFetch;
      global.location = originalLocation;
      loadingModuleContext.fetch = originalFetch;
      loadingModuleContext.location = originalLocation;
    }
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
