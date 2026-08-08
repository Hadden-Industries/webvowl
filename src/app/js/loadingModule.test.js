import { beforeEach, describe, expect, jest, test } from "@jest/globals";
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
  text() {
    return this;
  }
  node() {
    return { innerHTML: "", scrollHeight: 0, scrollTop: 0 };
  }
}

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
