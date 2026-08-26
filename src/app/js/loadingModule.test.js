import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import loadingModuleFactory from "./loadingModule.js";

class MockSelection {
  constructor() {
    this.textContent = "";
  }
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

global.document = {
  querySelector: jest.fn().mockReturnValue(new MockSelection()),
};
global.window = {
  history: {
    pushState: jest.fn(),
  },
};
describe("loading module create-new command", () => {
  let graph;
  let loadingModule;
  let pushedRoutes;

  beforeEach(() => {
    global.d3 = {
      select: () => new MockSelection(),
      selectAll: () => new MockSelection(),
    };
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

    graph = {
      clearAllGraphData: jest.fn(),
      editorMode: jest.fn(),
      options: () => ({}),
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
    const loadingModule = loadingModuleFactory({ options: () => ({}) });
    loadingModule.setOntologyMenu(ontologyMenu);
    global.fetch = fetchImpl;

    try {
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

      expect(fetchImpl.mock.calls.map(([url]) => url)).toEqual([
        "https://example.com/graph.json",
        "https://example.com/ontology.rdf",
        "http://example.com/local.json",
      ]);
    } finally {
      global.fetch = originalFetch;
      global.location = originalLocation;
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
    const loadingModule = loadingModuleFactory(graph);
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
      global.fetch = originalFetch;
      global.location = originalLocation;
    }
  });
});
