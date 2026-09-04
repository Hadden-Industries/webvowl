import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { SourceTextModule } from "node:vm";
import {
  beforeAll,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from "@jest/globals";

let VISUALIZATION_VIEW_CONTROL_ELEMENT_IDS;
let createVisualizationViewControlsAdapter;

const ADAPTER_MODULE_URL = new URL(
  "./visualizationViewControlsAdapter.js",
  import.meta.url,
);

const PERSON_REFERENCE = Object.freeze({
  kind: "class",
  iri: "http://xmlns.com/foaf/0.1/Person",
});
const ORGANISATION_REFERENCE = Object.freeze({
  kind: "class",
  iri: "http://xmlns.com/foaf/0.1/Organization",
});

beforeAll(async () => {
  const adapterModule = new SourceTextModule(
    readFileSync(fileURLToPath(ADAPTER_MODULE_URL), "utf8"),
    { identifier: ADAPTER_MODULE_URL.href },
  );
  await adapterModule.link((specifier) => {
    throw new Error(`Unexpected view controls dependency: ${specifier}`);
  });
  await adapterModule.evaluate();

  ({
    VISUALIZATION_VIEW_CONTROL_ELEMENT_IDS,
    createVisualizationViewControlsAdapter,
  } = adapterModule.namespace);
});

class ViewControlElementFixture extends EventTarget {
  constructor(localName) {
    super();
    this.localName = localName;
    this.appendedChildren = [];
    this.checked = false;
    this.disabled = false;
    this.dispatchedEventTypes = [];
    this.focusCallCount = 0;
    this.textContent = "";
    this.value = "";
  }

  append(...childElements) {
    this.appendedChildren.push(...childElements);
  }

  appendChild(childElement) {
    this.appendedChildren.push(childElement);
    return childElement;
  }

  dispatchEvent(event) {
    this.dispatchedEventTypes.push(event.type);
    return super.dispatchEvent(event);
  }

  focus() {
    this.focusCallCount += 1;
  }

  replaceChildren(...childElements) {
    this.appendedChildren = [...childElements];
  }

  emit(eventType) {
    super.dispatchEvent(new Event(eventType));
  }
}

class ViewControlDocumentFixture {
  constructor(presentElementIds) {
    this.elementsById = new Map(
      presentElementIds.map((elementId) => [
        elementId,
        new ViewControlElementFixture("input"),
      ]),
    );
    this.createdElements = [];
  }

  createElement(localName) {
    const createdElement = new ViewControlElementFixture(localName);
    this.createdElements.push(createdElement);
    return createdElement;
  }

  getElementById(elementId) {
    return this.elementsById.get(elementId) ?? null;
  }
}

describe("native visualization view controls", () => {
  let controller;
  let controlDocument;
  let lifecycleController;

  beforeEach(() => {
    lifecycleController = new AbortController();
    controller = {
      findOntologyElements: jest.fn(() => ({
        loadGeneration: 2,
        matches: [],
        isTruncated: false,
      })),
      setGraphLayoutPaused: jest.fn(() => ({
        loadGeneration: 2,
        isPaused: true,
        layoutStatus: "paused",
      })),
      setVisualizationView: jest.fn(async () => ({ loadGeneration: 2 })),
      subscribeToState: jest.fn(() => () => undefined),
    };
    controlDocument = new ViewControlDocumentFixture(
      Object.values(VISUALIZATION_VIEW_CONTROL_ELEMENT_IDS),
    );
  });

  function connectAdapter() {
    return createVisualizationViewControlsAdapter({
      controller,
      documentObject: controlDocument,
      lifecycleSignal: lifecycleController.signal,
    });
  }

  function controlElement(controlName) {
    return controlDocument.getElementById(
      VISUALIZATION_VIEW_CONTROL_ELEMENT_IDS[controlName],
    );
  }

  test("requests exactly the chosen language", () => {
    connectAdapter();
    const languageSelect = controlElement("languageSelect");
    languageSelect.value = "de";
    languageSelect.emit("change");

    expect(controller.setVisualizationView).toHaveBeenCalledTimes(1);
    expect(controller.setVisualizationView).toHaveBeenCalledWith({
      language: "de",
    });
  });

  test.each([
    ["datatypesFilterCheckbox", "datatypes"],
    ["objectPropertiesFilterCheckbox", "objectProperties"],
    ["subclassesFilterCheckbox", "subclasses"],
    ["disjointnessFilterCheckbox", "disjointness"],
    ["setOperatorsFilterCheckbox", "setOperators"],
  ])(
    "requests exactly the %s visibility filter",
    (controlName, filterFieldName) => {
      connectAdapter();
      const filterCheckbox = controlElement(controlName);

      // These are filter-out checkboxes: checked removes the elements.
      filterCheckbox.checked = true;
      filterCheckbox.emit("change");
      expect(controller.setVisualizationView).toHaveBeenLastCalledWith({
        filters: { [filterFieldName]: "hide" },
      });

      filterCheckbox.checked = false;
      filterCheckbox.emit("change");
      expect(controller.setVisualizationView).toHaveBeenLastCalledWith({
        filters: { [filterFieldName]: "show" },
      });
    },
  );

  test("requests exactly the chosen minimum degree", () => {
    connectAdapter();
    const minimumDegreeRange = controlElement("minimumDegreeRange");
    minimumDegreeRange.value = "3";
    minimumDegreeRange.emit("change");

    expect(controller.setVisualizationView).toHaveBeenCalledWith({
      filters: { minDegree: 3 },
    });
  });

  test("requests relaxation and viewport fitting as separate view actions", () => {
    connectAdapter();
    controlElement("relaxLayoutButton").emit("click");
    controlElement("fitViewportButton").emit("click");

    expect(controller.setVisualizationView).toHaveBeenNthCalledWith(1, {
      layout: "resume",
    });
    expect(controller.setVisualizationView).toHaveBeenNthCalledWith(2, {
      viewport: "fit",
    });
  });

  test("requests the positive pause state through the pause operation", () => {
    connectAdapter();
    const pauseButton = controlElement("graphLayoutPauseButton");

    pauseButton.emit("click");
    expect(controller.setGraphLayoutPaused).toHaveBeenCalledWith({
      isPaused: true,
    });

    pauseButton.emit("click");
    expect(controller.setGraphLayoutPaused).toHaveBeenLastCalledWith({
      isPaused: false,
    });
    expect(controller.setVisualizationView).not.toHaveBeenCalled();
  });

  test("searches ontology elements from the search input", () => {
    connectAdapter();
    const searchInput = controlElement("ontologySearchInput");
    searchInput.value = "person";
    searchInput.emit("input");

    expect(controller.findOntologyElements).toHaveBeenCalledWith({
      query: "person",
    });
    expect(controller.setVisualizationView).not.toHaveBeenCalled();
  });

  test("focuses exactly the chosen search result", () => {
    controller.findOntologyElements.mockReturnValue({
      loadGeneration: 2,
      matches: [
        {
          ontologyElementReference: PERSON_REFERENCE,
          kind: "class",
          displayLabel: "Person",
          iri: PERSON_REFERENCE.iri,
          isFocusable: true,
        },
        {
          ontologyElementReference: ORGANISATION_REFERENCE,
          kind: "class",
          displayLabel: "Organisation",
          iri: ORGANISATION_REFERENCE.iri,
          isFocusable: false,
        },
      ],
      isTruncated: false,
    });
    connectAdapter();
    const searchInput = controlElement("ontologySearchInput");
    searchInput.value = "person";
    searchInput.emit("input");

    const resultList = controlElement("ontologySearchResultList");
    expect(
      resultList.appendedChildren.map(({ textContent }) => textContent),
    ).toEqual(["Person", "Organisation"]);
    expect(resultList.appendedChildren.map(({ disabled }) => disabled)).toEqual(
      [false, true],
    );

    resultList.appendedChildren[0].emit("click");
    expect(controller.setVisualizationView).toHaveBeenCalledWith({
      focus: [PERSON_REFERENCE],
    });
  });

  test("does not focus a search result the graph cannot show", () => {
    controller.findOntologyElements.mockReturnValue({
      loadGeneration: 2,
      matches: [
        {
          ontologyElementReference: ORGANISATION_REFERENCE,
          kind: "class",
          displayLabel: "Organisation",
          iri: ORGANISATION_REFERENCE.iri,
          isFocusable: false,
        },
      ],
      isTruncated: false,
    });
    connectAdapter();
    const searchInput = controlElement("ontologySearchInput");
    searchInput.value = "org";
    searchInput.emit("input");

    controlElement("ontologySearchResultList").appendedChildren[0].emit(
      "click",
    );
    expect(controller.setVisualizationView).not.toHaveBeenCalled();
  });

  test("focuses explicitly supplied references through one view request", () => {
    const viewControls = connectAdapter();
    viewControls.focusOntologyElementReferences([
      PERSON_REFERENCE,
      ORGANISATION_REFERENCE,
    ]);

    expect(controller.setVisualizationView).toHaveBeenCalledWith({
      focus: [PERSON_REFERENCE, ORGANISATION_REFERENCE],
    });
  });

  test("calls no graph, runtime, options, or filter object", () => {
    connectAdapter();
    for (const controlName of Object.keys(
      VISUALIZATION_VIEW_CONTROL_ELEMENT_IDS,
    )) {
      controlElement(controlName).emit("change");
      controlElement(controlName).emit("click");
      controlElement(controlName).emit("input");
    }

    expect(Object.keys(controller).sort()).toEqual([
      "findOntologyElements",
      "setGraphLayoutPaused",
      "setVisualizationView",
      "subscribeToState",
    ]);
  });
});

describe("controller state presentation", () => {
  let controller;
  let controlDocument;
  let lifecycleController;
  let publishControllerState;

  const READY_STATE = Object.freeze({
    status: "ready",
    loadGeneration: 2,
    view: Object.freeze({
      language: "de",
      filters: Object.freeze({
        datatypes: "show",
        objectProperties: "hide",
        subclasses: "show",
        disjointness: "hide",
        setOperators: "show",
        minDegree: 4,
      }),
    }),
    layout: Object.freeze({ status: "relaxing" }),
  });

  beforeEach(() => {
    lifecycleController = new AbortController();
    controller = {
      findOntologyElements: jest.fn(),
      setGraphLayoutPaused: jest.fn(),
      setVisualizationView: jest.fn(async () => ({ loadGeneration: 2 })),
      subscribeToState: jest.fn((onStateChange) => {
        publishControllerState = onStateChange;
        return () => undefined;
      }),
    };
    controlDocument = new ViewControlDocumentFixture(
      Object.values(VISUALIZATION_VIEW_CONTROL_ELEMENT_IDS),
    );
    createVisualizationViewControlsAdapter({
      controller,
      documentObject: controlDocument,
      lifecycleSignal: lifecycleController.signal,
    });
  });

  function controlElement(controlName) {
    return controlDocument.getElementById(
      VISUALIZATION_VIEW_CONTROL_ELEMENT_IDS[controlName],
    );
  }

  test("writes frozen controller state onto native control properties", () => {
    publishControllerState(READY_STATE);

    expect(controlElement("languageSelect").value).toBe("de");
    // "show" leaves the filter-out checkbox unchecked.
    expect(controlElement("datatypesFilterCheckbox").checked).toBe(false);
    expect(controlElement("objectPropertiesFilterCheckbox").checked).toBe(true);
    expect(controlElement("minimumDegreeRange").value).toBe("4");
    expect(controlElement("graphLayoutStatusOutput").textContent).toBe(
      "relaxing",
    );
  });

  test("dispatches no input, change, or click event while presenting state", () => {
    publishControllerState(READY_STATE);

    for (const controlName of Object.keys(
      VISUALIZATION_VIEW_CONTROL_ELEMENT_IDS,
    )) {
      expect(controlElement(controlName).dispatchedEventTypes).toEqual([]);
    }
  });

  test("re-enters no controller operation while presenting state", () => {
    publishControllerState(READY_STATE);

    expect(controller.setVisualizationView).not.toHaveBeenCalled();
    expect(controller.setGraphLayoutPaused).not.toHaveBeenCalled();
    expect(controller.findOntologyElements).not.toHaveBeenCalled();
  });

  test("leaves an unchanged control value and its focus untouched", () => {
    publishControllerState(READY_STATE);
    const languageSelect = controlElement("languageSelect");
    languageSelect.value = "en";
    publishControllerState({
      ...READY_STATE,
      view: { ...READY_STATE.view, language: "en" },
    });

    expect(languageSelect.value).toBe("en");
    expect(languageSelect.focusCallCount).toBe(0);
  });

  test("presents no view control before an ontology view exists", () => {
    publishControllerState({
      status: "idle",
      loadGeneration: 0,
      view: null,
      layout: { status: "unavailable" },
    });

    expect(controlElement("languageSelect").value).toBe("");
    expect(controlElement("graphLayoutStatusOutput").textContent).toBe(
      "unavailable",
    );
  });
});

describe("view controls lifecycle and boundary", () => {
  test("connects only the controls the page actually provides", () => {
    const lifecycleController = new AbortController();
    const partialDocument = new ViewControlDocumentFixture([
      VISUALIZATION_VIEW_CONTROL_ELEMENT_IDS.languageSelect,
      VISUALIZATION_VIEW_CONTROL_ELEMENT_IDS.relaxLayoutButton,
    ]);

    const viewControls = createVisualizationViewControlsAdapter({
      controller: {
        findOntologyElements: jest.fn(),
        setGraphLayoutPaused: jest.fn(),
        setVisualizationView: jest.fn(async () => ({ loadGeneration: 1 })),
        subscribeToState: jest.fn(() => () => undefined),
      },
      documentObject: partialDocument,
      lifecycleSignal: lifecycleController.signal,
    });

    expect(viewControls.connectedControlNames).toEqual([
      "languageSelect",
      "relaxLayoutButton",
    ]);
  });

  test("stops requesting view changes once the lifecycle signal aborts", () => {
    const lifecycleController = new AbortController();
    const controller = {
      findOntologyElements: jest.fn(),
      setGraphLayoutPaused: jest.fn(),
      setVisualizationView: jest.fn(async () => ({ loadGeneration: 1 })),
      subscribeToState: jest.fn(() => () => undefined),
    };
    const controlDocument = new ViewControlDocumentFixture(
      Object.values(VISUALIZATION_VIEW_CONTROL_ELEMENT_IDS),
    );
    createVisualizationViewControlsAdapter({
      controller,
      documentObject: controlDocument,
      lifecycleSignal: lifecycleController.signal,
    });

    lifecycleController.abort();
    controlDocument
      .getElementById(VISUALIZATION_VIEW_CONTROL_ELEMENT_IDS.relaxLayoutButton)
      .emit("click");

    expect(controller.setVisualizationView).not.toHaveBeenCalled();
  });

  test("unsubscribes from controller state once the lifecycle signal aborts", () => {
    const lifecycleController = new AbortController();
    const unsubscribeFromState = jest.fn();
    const controlDocument = new ViewControlDocumentFixture(
      Object.values(VISUALIZATION_VIEW_CONTROL_ELEMENT_IDS),
    );
    createVisualizationViewControlsAdapter({
      controller: {
        findOntologyElements: jest.fn(),
        setGraphLayoutPaused: jest.fn(),
        setVisualizationView: jest.fn(async () => ({ loadGeneration: 1 })),
        subscribeToState: jest.fn(() => unsubscribeFromState),
      },
      documentObject: controlDocument,
      lifecycleSignal: lifecycleController.signal,
    });

    lifecycleController.abort();
    expect(unsubscribeFromState).toHaveBeenCalledTimes(1);
  });

  test("rejects dependencies outside the view controls interface", () => {
    expect(() =>
      createVisualizationViewControlsAdapter({
        controller: {
          findOntologyElements: jest.fn(),
          setGraphLayoutPaused: jest.fn(),
          setVisualizationView: jest.fn(),
          subscribeToState: jest.fn(() => () => undefined),
        },
        documentObject: new ViewControlDocumentFixture([]),
        lifecycleSignal: new AbortController().signal,
        graph: { updateStyle: () => undefined },
      }),
    ).toThrow("invalid dependency field set");
  });

  test("names no D3 or ambient browser global in its source", () => {
    const adapterSource = readFileSync(
      fileURLToPath(ADAPTER_MODULE_URL),
      "utf8",
    );

    for (const forbiddenIdentifier of ["d3", "window", "globalThis"]) {
      expect(adapterSource).not.toMatch(
        new RegExp(`(?<![\\w$])${forbiddenIdentifier}(?![\\w$])`, "u"),
      );
    }
  });
});
