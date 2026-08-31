import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from "@jest/globals";
import OwlClass from "../../webvowl/js/elements/nodes/implementations/OwlClass.js";
import RdfsDatatype from "../../webvowl/js/elements/nodes/implementations/RdfsDatatype.js";
import prefixRepresentationModule from "../../shared/js/util/prefixRepresentationModule.js";
import editSidebarFactory from "./editSidebar.js";

const CUSTOM_DATATYPE_IRI =
  "https://haddenindustries.com/ontology/iso-iec/11179/-3/ed-4/textDatatype";

class MockElement {
  constructor() {
    this.attributes = {};
    this.children = [];
    this.disabled = false;
    this.innerHTML = "";
    this.listeners = new Map();
    this.title = "";
    this.value = "";
    this._classes = new Set();
  }

  get firstChild() {
    return this.children[0];
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) || [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  appendChild(child) {
    child.parentNode = this;
    this.children.push(child);
  }

  dispatch(type) {
    for (const listener of this.listeners.get(type) || []) {
      listener.call(this, {
        key: undefined,
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
      });
    }
  }

  get classList() {
    return {
      add: (...classes) => classes.forEach((name) => this._classes.add(name)),
      contains: (name) => this._classes.has(name),
      remove: (...classes) =>
        classes.forEach((name) => this._classes.delete(name)),
    };
  }

  removeChild(child) {
    const index = this.children.indexOf(child);
    if (index !== -1) {
      this.children.splice(index, 1);
    }
  }

  setAttribute(name, value) {
    this.attributes[name] = value;
  }
}

function createControls() {
  const selectors = [
    "#element_iriEditor",
    "#element_labelEditor",
    "#typeEditForm_class",
    "#typeEditor_class",
    "#typeEditForm_datatype",
    "#typeEditor",
    "#typeEditor_datatype",
    "#class_characteristics_Container",
    "#property_characteristics_Container",
    "#property_characteristics_Selection",
    "#class_characteristics_Selection",
    "#selectedElementProperties",
    "#selectedElementPropertiesEmptyHint",
    "#direct-edit-clearURL-button",
    "#direct-edit-addURL-button",
    "#direct-edit-defaultURL-button",
    "#element_iriEditor_delete",
    "#element_iriEditor_reset",
    "#element_iriEditor_apply",
    "#edit_characteristics_property",
    "#left",
    "#containerForAutoResizing",
    "#customLabel_y_position",
    "#customLabel_x_position",
    "#class_deleteButton",
    "#property_deleteButton",
    "#datatype_deleteButton",
  ];

  return new Map(selectors.map((selector) => [selector, new MockElement()]));
}

describe("datatype editing", () => {
  let controls;
  let datatype;
  let editSidebar;
  let graph;

  beforeEach(() => {
    controls = createControls();
    global.document = {
      createElement: () => new MockElement(),
      querySelector: (selector) => controls.get(selector) || new MockElement(),
    };

    graph = {
      language: () => "en",
      options: () => ({
        getGeneralMetaObject: () => ({
          iri: "https://example.com/ontology",
        }),
        getGeneralMetaObjectProperty: () => "https://example.com/ontology",
        prefixList: () => ({}),
      }),
    };
    datatype = new RdfsDatatype(graph)
      .baseIri("https://haddenindustries.com/ontology/iso-iec/11179/-3/ed-4/")
      .iri(CUSTOM_DATATYPE_IRI)
      .label({ en: "Text" });
    datatype.redrawLabelText = jest.fn();
    editSidebar = editSidebarFactory(graph);
  });

  afterEach(() => {
    delete global.document;
  });

  test("preserves a custom datatype IRI while refreshing editor controls", () => {
    editSidebar.updateSelectionInformation(datatype);

    expect(datatype.iri()).toBe(CUSTOM_DATATYPE_IRI);
    expect(controls.get("#element_iriEditor")).toMatchObject({
      title: CUSTOM_DATATYPE_IRI,
      value: CUSTOM_DATATYPE_IRI,
    });
  });

  test("keeps custom datatype labels editable without enabling IRI edits", () => {
    editSidebar.updateSelectionInformation(datatype);

    expect(controls.get("#element_iriEditor").disabled).toBe(true);
    expect(controls.get("#element_labelEditor").disabled).toBe(false);
    expect(
      controls.get("#typeEditForm_datatype").classList.contains("hidden"),
    ).toBe(false);
  });

  test("changes the datatype identity after an explicit built-in selection", () => {
    editSidebar.updateSelectionInformation(datatype);
    const datatypeSelector = controls.get("#typeEditor_datatype");

    datatypeSelector.value = "xsd:string";
    expect(() => datatypeSelector.dispatch("change")).not.toThrow();

    expect(datatype.dType()).toBe("xsd:string");
    expect(datatype.label()).toBe("string");
    expect(datatype.baseIri()).toBe("http://www.w3.org/2001/XMLSchema#");
    expect(datatype.iri()).toBe("http://www.w3.org/2001/XMLSchema#string");
    expect(controls.get("#element_iriEditor")).toMatchObject({
      disabled: true,
      title: "http://www.w3.org/2001/XMLSchema#string",
      value: "http://www.w3.org/2001/XMLSchema#string",
    });
    expect(controls.get("#element_labelEditor")).toMatchObject({
      disabled: true,
      value: "string",
    });
  });
});

describe("element IRI editing with modern URLs and prefixes", () => {
  let controls;
  let node;
  let editSidebar;
  let graph;
  let mockWarningModule;
  let prefixList;

  beforeEach(() => {
    controls = createControls();
    global.document = {
      createElement: () => new MockElement(),
      querySelector: (selector) => controls.get(selector) || new MockElement(),
    };

    mockWarningModule = {
      showWarning: jest.fn(),
    };

    prefixList = {
      foaf: "http://xmlns.com/foaf/0.1/",
      owl: "http://www.w3.org/2002/07/owl#",
    };

    const optionsObj = {
      getGeneralMetaObject: () => ({
        iri: "http://example.org/ontology#",
      }),
      getGeneralMetaObjectProperty: (prop) =>
        prop === "iri" ? "http://example.org/ontology#" : undefined,
      prefixList: () => prefixList,
      warningModule: () => mockWarningModule,
      prefixModule: () => prefixRepresentationModule(graph),
      editSidebar: () => editSidebar,
    };

    graph = {
      language: () => "en",
      options: () => optionsObj,
      checkIfIriClassAlreadyExist: jest.fn(() => false),
      checkIfIriPropertyAlreadyExist: jest.fn(() => false),
      dispatchEvent: jest.fn(),
    };

    node = new OwlClass(graph)
      .baseIri("http://example.org/ontology#")
      .iri("http://example.org/ontology#InitialClass")
      .label({ en: "InitialClass" });
    node.redrawLabelText = jest.fn();
    node.redrawElement = jest.fn();

    editSidebar = editSidebarFactory(graph);
  });

  afterEach(() => {
    delete global.document;
  });

  test("accepts modern gTLD absolute URL in IRI editor", () => {
    editSidebar.updateSelectionInformation(node);
    const iriEditor = controls.get("#element_iriEditor");

    iriEditor.value = "https://example.tech/ontology#Item";
    iriEditor.dispatch("change");

    expect(node.iri()).toBe("https://example.tech/ontology#Item");
    expect(mockWarningModule.showWarning).not.toHaveBeenCalled();
  });

  test("expands prefixed name using defined prefix", () => {
    editSidebar.updateSelectionInformation(node);
    const iriEditor = controls.get("#element_iriEditor");

    iriEditor.value = "foaf:Person";
    iriEditor.dispatch("change");

    expect(node.iri()).toBe("http://xmlns.com/foaf/0.1/Person");
    expect(mockWarningModule.showWarning).not.toHaveBeenCalled();
  });

  test("expands colon-prefixed name using base ontology IRI", () => {
    editSidebar.updateSelectionInformation(node);
    const iriEditor = controls.get("#element_iriEditor");

    iriEditor.value = ":NewClass";
    iriEditor.dispatch("change");

    expect(node.iri()).toBe("http://example.org/ontology#NewClass");
    expect(mockWarningModule.showWarning).not.toHaveBeenCalled();
  });

  test("shows warning when using an undefined prefix", () => {
    editSidebar.updateSelectionInformation(node);
    const iriEditor = controls.get("#element_iriEditor");

    iriEditor.value = "unknown:Class";
    iriEditor.dispatch("change");

    expect(mockWarningModule.showWarning).toHaveBeenCalled();
    // Reverts to original IRI
    expect(iriEditor.value).toBe("http://example.org/ontology#InitialClass");
  });
});
