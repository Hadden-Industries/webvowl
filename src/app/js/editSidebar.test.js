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
import { createContext, SourceTextModule } from "node:vm";

let createEditSidebar;
let editSidebarModuleContext;

beforeAll(async () => {
  const moduleUrl = new URL("./editSidebar.js", import.meta.url);
  editSidebarModuleContext = createContext({
    AbortController,
    Event,
    console,
    document: undefined,
  });
  const sourceModule = new SourceTextModule(
    readFileSync(fileURLToPath(moduleUrl), "utf8"),
    { context: editSidebarModuleContext, identifier: moduleUrl.href },
  );
  await sourceModule.link((specifier) => {
    throw new Error(`Unexpected edit-sidebar dependency: ${specifier}`);
  });
  await sourceModule.evaluate();
  ({ createEditSidebar } = sourceModule.namespace);
});

const CUSTOM_DATATYPE_IRI =
  "https://haddenindustries.com/ontology/iso-iec/11179/-3/ed-4/textDatatype";

class MockElement extends EventTarget {
  constructor() {
    super();
    this.attributes = {};
    this.children = [];
    this.disabled = false;
    this.innerHTML = "";
    this.title = "";
    this.value = "";
    this._classes = new Set();
  }

  get firstChild() {
    return this.children[0];
  }

  appendChild(child) {
    child.parentNode = this;
    this.children.push(child);
  }

  dispatch(type) {
    this.dispatchEvent(new Event(type));
  }

  getAttribute(name) {
    return this.attributes[name];
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

function createMutableOntologyElement({
  baseIri,
  datatypeName = "undefined",
  iri,
  kind,
  label,
  localIdentifier,
  renderType,
  type,
}) {
  const mutableValues = {
    attributes: [],
    backgroundColor: undefined,
    baseIri,
    datatypeName,
    focused: false,
    indications: [],
    iri,
    label,
    styleClass: undefined,
    type,
    visualAttributes: [],
  };
  const ontologyElement = {
    ontologyElementKind: kind,
    id: () => localIdentifier,
    labelForCurrentLanguage: () => {
      const currentLabel = mutableValues.label;
      return typeof currentLabel === "object" ? currentLabel.en : currentLabel;
    },
    redrawElement: jest.fn(),
    redrawLabelText: jest.fn(),
    renderType: () => renderType,
    toggleFocus: jest.fn(),
  };
  const defineMutableOperation = (operationName, valueName = operationName) => {
    ontologyElement[operationName] = function (nextValue) {
      if (arguments.length > 0) {
        mutableValues[valueName] = nextValue;
        return ontologyElement;
      }
      return mutableValues[valueName];
    };
  };
  defineMutableOperation("attributes");
  defineMutableOperation("backgroundColor");
  defineMutableOperation("baseIri");
  defineMutableOperation("dType", "datatypeName");
  defineMutableOperation("focused");
  defineMutableOperation("indications");
  defineMutableOperation("iri");
  defineMutableOperation("label");
  defineMutableOperation("styleClass");
  defineMutableOperation("type");
  defineMutableOperation("visualAttributes");
  return ontologyElement;
}

function createElementClassificationTools() {
  return {
    isDatatypeProperty: (element) =>
      element.ontologyElementKind === "datatype-property",
    isNode: (element) => element.ontologyElementKind === "node",
    isProperty: (element) =>
      element.ontologyElementKind === "datatype-property" ||
      element.ontologyElementKind === "object-property",
  };
}

function createPrefixRepresentation({ baseOntologyIri, prefixList }) {
  return {
    getPrefixRepresentationForFullURI: (fullIri) => {
      for (const [prefixName, namespaceIri] of Object.entries(prefixList)) {
        if (fullIri.startsWith(namespaceIri)) {
          return `${prefixName}:${fullIri.slice(namespaceIri.length)}`;
        }
      }
      if (fullIri.startsWith(baseOntologyIri)) {
        return `:${fullIri.slice(baseOntologyIri.length)}`;
      }
      return fullIri;
    },
    updatePrefixModel: jest.fn(),
    validURL: (candidateIri) => {
      try {
        return ["ftp:", "http:", "https:"].includes(
          new URL(candidateIri).protocol,
        );
      } catch {
        return false;
      }
    },
  };
}

describe("datatype editing", () => {
  let controls;
  let datatype;
  let editSidebar;
  let graph;
  let prefixModule;

  beforeEach(() => {
    controls = createControls();
    global.document = {
      createElement: () => new MockElement(),
      querySelector: (selector) => controls.get(selector) || new MockElement(),
    };
    editSidebarModuleContext.document = global.document;

    const prefixList = {};
    prefixModule = createPrefixRepresentation({
      baseOntologyIri: "https://example.com/ontology",
      prefixList,
    });
    graph = {
      language: () => "en",
      options: () => ({
        getGeneralMetaObject: () => ({
          iri: "https://example.com/ontology",
        }),
        getGeneralMetaObjectProperty: () => "https://example.com/ontology",
        prefixList: () => prefixList,
      }),
    };
    datatype = createMutableOntologyElement({
      baseIri: "https://haddenindustries.com/ontology/iso-iec/11179/-3/ed-4/",
      iri: CUSTOM_DATATYPE_IRI,
      kind: "node",
      label: { en: "Text" },
      localIdentifier: "textDatatype",
      renderType: "rect",
      type: "rdfs:Datatype",
    });
    editSidebar = createEditSidebar(graph, {
      elementTools: createElementClassificationTools(),
      languageTools: {},
      prefixModule,
    });
  });

  afterEach(() => {
    editSidebar?.dispose();
    editSidebarModuleContext.document = undefined;
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
  let prefixModule;

  beforeEach(() => {
    controls = createControls();
    global.document = {
      createElement: () => new MockElement(),
      querySelector: (selector) => controls.get(selector) || new MockElement(),
    };
    editSidebarModuleContext.document = global.document;

    mockWarningModule = {
      showWarning: jest.fn(),
    };

    prefixList = {
      foaf: "http://xmlns.com/foaf/0.1/",
      owl: "http://www.w3.org/2002/07/owl#",
    };
    prefixModule = createPrefixRepresentation({
      baseOntologyIri: "http://example.org/ontology#",
      prefixList,
    });

    const optionsObj = {
      getGeneralMetaObject: () => ({
        iri: "http://example.org/ontology#",
      }),
      getGeneralMetaObjectProperty: (prop) =>
        prop === "iri" ? "http://example.org/ontology#" : undefined,
      prefixList: () => prefixList,
      warningModule: () => mockWarningModule,
      prefixModule: () => prefixModule,
      editSidebar: () => editSidebar,
    };

    graph = {
      language: () => "en",
      options: () => optionsObj,
      checkIfIriClassAlreadyExist: jest.fn(() => false),
      checkIfIriPropertyAlreadyExist: jest.fn(() => false),
      dispatchEvent: jest.fn(),
    };

    node = createMutableOntologyElement({
      baseIri: "http://example.org/ontology#",
      iri: "http://example.org/ontology#InitialClass",
      kind: "node",
      label: { en: "InitialClass" },
      localIdentifier: "InitialClass",
      renderType: "round",
      type: "owl:Class",
    });

    editSidebar = createEditSidebar(graph, {
      elementTools: createElementClassificationTools(),
      languageTools: {},
      prefixModule,
    });
  });

  afterEach(() => {
    editSidebar?.dispose();
    editSidebarModuleContext.document = undefined;
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

class EditSidebarControl extends EventTarget {
  constructor(tagName = "div") {
    super();
    this.tagName = tagName;
    this.children = [];
    this.disabled = false;
    this.innerHTML = "";
    this.value = "";
    this.classes = new Set();
    this.classList = {
      add: (...classNames) =>
        classNames.forEach((className) => this.classes.add(className)),
      contains: (className) => this.classes.has(className),
      remove: (...classNames) =>
        classNames.forEach((className) => this.classes.delete(className)),
    };
  }

  appendChild(child) {
    this.children.push(child);
    child.parentNode = this;
    return child;
  }

  click() {
    this.dispatchEvent(new Event("click"));
  }

  focus() {}

  querySelectorAll() {
    return [];
  }

  replaceChildren(...children) {
    this.children = [];
    children.forEach((child) => this.appendChild(child));
  }

  setAttribute(name, value) {
    this[name] = value;
  }
}

function findDescendantById(rootElement, expectedId) {
  if (rootElement.id === expectedId) {
    return rootElement;
  }
  for (const child of rootElement.children) {
    const matchingDescendant = findDescendantById(child, expectedId);
    if (matchingDescendant) {
      return matchingDescendant;
    }
  }
  return undefined;
}

describe("edit sidebar native prefix controls", () => {
  let controls;
  let editSidebar;
  let graphOptions;
  let prefixModule;

  beforeEach(() => {
    controls = new Map();
    const controlFor = (selector) => {
      if (selector.startsWith("#")) {
        const expectedId = selector.slice(1);
        for (const rootControl of controls.values()) {
          const matchingControl = findDescendantById(rootControl, expectedId);
          if (matchingControl) {
            return matchingControl;
          }
        }
      }
      if (!controls.has(selector)) {
        controls.set(selector, new EditSidebarControl());
      }
      return controls.get(selector);
    };
    global.document = {
      createElement: (tagName) => new EditSidebarControl(tagName),
      createElementNS: (_namespaceIri, tagName) =>
        new EditSidebarControl(tagName),
      querySelector: controlFor,
      querySelectorAll: () => [],
    };
    editSidebarModuleContext.document = global.document;
    delete global.d3;
    prefixModule = { updatePrefixModel: jest.fn() };
    graphOptions = {
      addOrUpdateGeneralObjectEntry: jest.fn(),
      prefixList: () => ({}),
      removePrefix: jest.fn(),
      supportedDatatypes: () => [],
      updatePrefix: jest.fn(() => true),
    };
    const graph = {
      isEditorMode: () => false,
      options: () => graphOptions,
    };
    editSidebar = createEditSidebar(graph, {
      elementTools: {},
      languageTools: {},
      prefixModule,
    });
  });

  afterEach(() => {
    editSidebar?.dispose();
    editSidebarModuleContext.document = undefined;
    delete global.document;
  });

  test("refreshes the prefix container without a global D3 selection", () => {
    const prefixContainer = global.document.querySelector(
      "#prefixURL_Container",
    );
    prefixContainer.appendChild(new EditSidebarControl());

    expect(() => editSidebar.updatePrefixUi()).not.toThrow();

    expect(prefixContainer.children).toEqual([]);
  });

  test("owns only accordion triggers inside the editing details section", () => {
    const editingDetailsSection = new EditSidebarControl("section");
    const editingTrigger = new EditSidebarControl("h3");
    editingTrigger.nextElementSibling = new EditSidebarControl();
    const foreignDetailsTrigger = new EditSidebarControl("h3");
    foreignDetailsTrigger.nextElementSibling = new EditSidebarControl();
    editingDetailsSection.querySelectorAll = jest.fn(() => [editingTrigger]);
    controls.set("#generalDetailsEdit", editingDetailsSection);
    global.document.querySelectorAll = jest.fn(() => [
      editingTrigger,
      foreignDetailsTrigger,
    ]);

    editSidebar.setup();

    const simulatedClick = jest.spyOn(editingTrigger, "click");
    const keyboardActivationEvent = new Event("keydown", {
      cancelable: true,
    });
    Object.defineProperty(keyboardActivationEvent, "key", { value: "Enter" });
    editingTrigger.dispatchEvent(keyboardActivationEvent);

    expect(editingTrigger.role).toBe("button");
    expect(foreignDetailsTrigger.role).toBeUndefined();
    expect(keyboardActivationEvent.defaultPrevented).toBe(true);
    expect(simulatedClick).not.toHaveBeenCalled();
    expect(editingTrigger.classes).toContain("accordion-trigger-active");
  });

  test.each(["Enter", " "])(
    "activates the prefix save operation once for the %p key without synthesizing a click",
    (activationKey) => {
      editSidebar.setup();
      controls.get("#addPrefixButton").dispatchEvent(new Event("click"));
      const prefixNameInput = global.document.querySelector(
        "#prefixInputFor_emptyPrefixEntry",
      );
      const namespaceIriInput = global.document.querySelector(
        "#prefixURLFor_emptyPrefixEntry",
      );
      const prefixSaveControl = global.document.querySelector(
        "#editButtonFor_emptyPrefixEntry",
      );
      prefixNameInput.value = "example";
      namespaceIriInput.value = "https://example.com/ontology#";
      const observedClick = jest.fn();
      prefixSaveControl.addEventListener("click", observedClick);
      const keyboardActivationEvent = new Event("keydown", {
        cancelable: true,
      });
      Object.defineProperty(keyboardActivationEvent, "key", {
        value: activationKey,
      });

      prefixSaveControl.dispatchEvent(keyboardActivationEvent);

      expect(keyboardActivationEvent.defaultPrevented).toBe(true);
      expect(graphOptions.updatePrefix).toHaveBeenCalledTimes(1);
      expect(graphOptions.updatePrefix).toHaveBeenCalledWith(
        "emptyPrefixEntry",
        "example",
        "",
        "https://example.com/ontology#",
      );
      expect(observedClick).not.toHaveBeenCalled();
    },
  );

  test("setup is idempotent and disposal detaches owned editor listeners", () => {
    editSidebar.setup();
    editSidebar.setup();
    editSidebar.dispose();
    editSidebar.dispose();

    expect(() =>
      controls.get("#addPrefixButton").dispatchEvent(new Event("click")),
    ).not.toThrow();
    expect(
      global.document.querySelector("#prefixURL_Container").children,
    ).toEqual([]);
  });
});
