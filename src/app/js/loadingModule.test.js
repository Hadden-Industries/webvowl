import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from "@jest/globals";
import loadingModuleFactory from "./loadingModule.js";

class MockSelection {
  classed() {
    return this;
  }

  attr() {
    return this;
  }

  property() {
    return this;
  }

  append() {
    return new MockSelection();
  }

  text() {
    return this;
  }

  style() {
    return this;
  }

  on() {
    return this;
  }

  remove() {}

  node() {
    return { innerHTML: "", scrollHeight: 0, scrollTop: 0 };
  }
}

describe("loading module remote fetch URLs", () => {
  let originalD3;
  let originalLocation;

  beforeEach(() => {
    originalD3 = global.d3;
    originalLocation = global.location;
    // Reconstructed main still uses the legacy D3 transport boundary. The
    // URL policy under test is independent of that transport implementation.
    global.d3 = {
      select: () => new MockSelection(),
      selectAll: () => new MockSelection(),
      xhr: jest.fn(),
    };
  });

  afterEach(() => {
    global.d3 = originalD3;
    global.location = originalLocation;
  });

  function createOntologyMenu(onLoad = () => undefined) {
    return {
      append_bulletPoint: jest.fn(),
      append_message: jest.fn(),
      append_message_toLastBulletPoint: jest.fn(),
      cachedOntology: jest.fn(() => undefined),
      getLoadingFunction: () => onLoad,
    };
  }

  function createLoadingModule(ontologyMenu) {
    const graph = {
      handleOnLoadingError: jest.fn(),
      options: () => ({}),
    };
    const loadingModule = loadingModuleFactory(graph);
    loadingModule.setOntologyMenu(ontologyMenu);
    return loadingModule;
  }

  test("derives direct HTTP resource fetch schemes from the WebVOWL base", () => {
    const loadingModule = createLoadingModule(createOntologyMenu());

    global.location = {
      href: "https://webvowl.example/viewer",
      protocol: "https:",
    };
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
    loadingModule.from_JSON_URL(
      "url=" + encodeURIComponent("http://example.com/local.json"),
    );

    expect(global.d3.xhr.mock.calls.map(([url]) => url)).toEqual([
      "https://example.com/graph.json",
      "https://example.com/ontology.rdf",
      "http://example.com/local.json",
    ]);
  });

  test("resolves relative ontology IRIs against the upgraded retrieval URL", async () => {
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
    const ontologyMenu = createOntologyMenu((content) => {
      finishLoading(JSON.parse(content));
    });
    const loadingModule = createLoadingModule(ontologyMenu);
    global.location = {
      href: "https://webvowl.example/viewer",
      protocol: "https:",
    };
    global.d3.xhr = jest.fn((url, mimeTypeOrCallback, callback) => {
      const onResponse =
        typeof mimeTypeOrCallback === "function"
          ? mimeTypeOrCallback
          : callback;
      onResponse(null, { responseText: ontologyDocument });
    });

    loadingModule.from_IRI_URL(
      "iri=" + encodeURIComponent("http://example.com/ontology.rdf"),
    );
    const result = await loadedOntology;

    expect(global.d3.xhr.mock.calls[0][0]).toBe(
      "https://example.com/ontology.rdf",
    );
    expect(result.header.iri).toBe("https://example.com/ontology.rdf");
    expect(result.classAttribute).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          iri: "https://example.com/ontology.rdf#Person",
        }),
      ]),
    );
  });
});

describe("loading module create-new command", () => {
  let graph;
  let loadingModule;
  let pushedRoutes;

  beforeEach(() => {
    global.d3 = {
      select: () => new MockSelection(),
      selectAll: () => new MockSelection()
    };
    global.location = { hash: "#file=foaf.rdf.json" };
    pushedRoutes = [];
    global.window = {
      history: {
        pushState: ( _state, _title, route ) => {
          pushedRoutes.push(route);
          global.location.hash = route;
        }
      }
    };

    graph = {
      clearAllGraphData: jest.fn(),
      editorMode: jest.fn(),
      options: () => ({})
    };
    loadingModule = loadingModuleFactory(graph);
    loadingModule.initializeLoader = jest.fn();
    loadingModule.from_presetOntology = jest.fn();
  });

  test("loads each new ontology directly and records a unique shareable route", () => {
    expect(loadingModule.createNewOntology()).toBe("new_ontology1");
    expect(loadingModule.createNewOntology()).toBe("new_ontology2");

    expect(pushedRoutes).toEqual([
      "#opts=editorMode=true;#new_ontology1",
      "#opts=editorMode=true;#new_ontology2"
    ]);
    expect(graph.editorMode).toHaveBeenCalledTimes(2);
    expect(graph.editorMode).toHaveBeenNthCalledWith(1, true);
    expect(graph.clearAllGraphData).toHaveBeenCalledTimes(2);
    expect(loadingModule.initializeLoader).toHaveBeenCalledTimes(2);
    expect(loadingModule.from_presetOntology).toHaveBeenNthCalledWith(1, "new_ontology1");
    expect(loadingModule.from_presetOntology).toHaveBeenNthCalledWith(2, "new_ontology2");
  });

  test("continues numbering after a new-ontology route loaded from elsewhere", () => {
    global.location.hash = "#opts=editorMode=true;#new_ontology12";

    expect(loadingModule.createNewOntology()).toBe("new_ontology13");
  });
});
