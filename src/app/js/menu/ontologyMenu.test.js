import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import ontologyMenuFactory from "./ontologyMenu.js";

class MockSelection {
  constructor( node = {} ) {
    this.element = node;
    this.handlers = {};
    this.classes = new Set();
    this.attributes = {};
  }

  on( type, handler ) {
    if ( arguments.length === 1 ) {return this.handlers[type];}
    this.handlers[type] = handler;
    return this;
  }

  datum( value ) {
    this.element.__data__ = value;
    return this;
  }

  property( name, value ) {
    if ( arguments.length === 1 ) {return this.element[name];}
    this.element[name] = value;
    return this;
  }

  classed( name, value ) {
    if ( arguments.length === 1 ) {return this.classes.has(name);}
    if ( value ) {this.classes.add(name);}
    else {this.classes.delete(name);}
    return this;
  }

  attr( name, value ) {
    if ( arguments.length === 1 ) {return this.attributes[name] ?? null;}
    this.attributes[name] = value;
    return this;
  }

  node() {
    return this.element;
  }
}

describe("ontology menu create-new action", () => {
  let selections;
  let emptyButton;
  let createNewOntology;
  let hideAllMenus;

  beforeEach(() => {
    selections = new Map();
    const selectionFor = ( key ) => {
      if ( !selections.has(key) ) {selections.set(key, new MockSelection());}
      return selections.get(key);
    };

    global.location = { hash: "#file=foaf.rdf.json" };
    global.window = {};
    global.d3 = {
      select: selectionFor,
      selectAll: selectionFor
    };

    createNewOntology = jest.fn();
    hideAllMenus = jest.fn();
    const loadingModule = {
      createNewOntology,
      setOntologyMenu: jest.fn(),
      parseUrlAndLoadOntology: jest.fn()
    };
    const graph = {
      options: () => ({
        loadingModule: () => loadingModule,
        navigationMenu: () => ({ hideAllMenus })
      }),
      updateEditorModeDependentControls: jest.fn()
    };

    ontologyMenuFactory(graph).setup(jest.fn());
    emptyButton = selectionFor("#empty");
  });

  test("delegates an enabled create button to the explicit application command", () => {
    emptyButton.element.disabled = false;
    const event = { preventDefault: jest.fn() };

    emptyButton.handlers.click(event);

    expect(createNewOntology).toHaveBeenCalledTimes(1);
    expect(hideAllMenus).toHaveBeenCalledTimes(1);
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(global.location.hash).toBe("#file=foaf.rdf.json");
  });

  test("keeps the native disabled state authoritative", () => {
    emptyButton.element.disabled = true;

    emptyButton.handlers.click({ preventDefault: jest.fn() });

    expect(createNewOntology).not.toHaveBeenCalled();
    expect(hideAllMenus).not.toHaveBeenCalled();
  });
});
