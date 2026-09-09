// The controls the reader already sees. This adapter is the single route from
// those controls to the controller; no menu module drives the graph directly.
export const VISUALIZATION_VIEW_CONTROL_ELEMENT_IDS = Object.freeze({
  languageSelect: "language",
  datatypesFilterCheckbox: "datatypeFilterCheckbox",
  objectPropertiesFilterCheckbox: "objectPropertyFilterCheckbox",
  subclassesFilterCheckbox: "subclassFilterCheckbox",
  disjointnessFilterCheckbox: "disjointFilterCheckbox",
  setOperatorsFilterCheckbox: "setoperatorFilterCheckbox",
  minimumDegreeRange: "nodeDegreeDistanceSlider",
  // The search dropdown is still owned by the search menu, which carries
  // keyboard navigation and highlighting this adapter does not replicate.
  // Binding here as well would render a second, poorer result list over it.
  ontologySearchInput: "visualizationOntologySearchInput",
  ontologySearchResultList: "visualizationOntologySearchResultList",
  // No relax-only control ships yet; the adapter skips absent controls.
  relaxLayoutButton: "visualizationRelaxLayoutButton",
  zoomAndCenterViewportButton: "centerGraphButton",
  graphLayoutPauseButton: "pause-button",
  graphLayoutStatusOutput: "visualizationGraphLayoutStatusOutput",
});

const VIEW_CONTROLS_DEPENDENCY_FIELD_NAMES = Object.freeze([
  "controller",
  "documentObject",
  "lifecycleSignal",
]);

const CONTROLLER_OPERATION_NAMES = Object.freeze([
  "findOntologyElements",
  "setGraphLayoutPaused",
  "setVisualizationView",
  "subscribeToState",
]);

const VISIBILITY_FILTER_CONTROL_NAMES = Object.freeze({
  datatypesFilterCheckbox: "datatypes",
  objectPropertiesFilterCheckbox: "objectProperties",
  subclassesFilterCheckbox: "subclasses",
  disjointnessFilterCheckbox: "disjointness",
  setOperatorsFilterCheckbox: "setOperators",
});

const SEARCH_RESULT_ELEMENT_NAME = "button";

function assertPlainRecord(candidate, description) {
  if (
    candidate === null ||
    typeof candidate !== "object" ||
    Array.isArray(candidate)
  ) {
    throw new TypeError(`${description} must be a plain object.`);
  }
}

function assertExactDependencyFieldNames(dependencies) {
  assertPlainRecord(dependencies, "view controls dependencies");
  const actualFieldNames = Object.keys(dependencies).sort();
  const expectedFieldNames = [...VIEW_CONTROLS_DEPENDENCY_FIELD_NAMES].sort();
  if (
    actualFieldNames.length !== expectedFieldNames.length ||
    actualFieldNames.some(
      (fieldName, index) => fieldName !== expectedFieldNames[index],
    )
  ) {
    throw new TypeError(
      "View controls dependencies have an invalid dependency field set.",
    );
  }
}

function assertControllerOperations(controller) {
  assertPlainRecord(controller, "controller");
  for (const operationName of CONTROLLER_OPERATION_NAMES) {
    if (typeof controller[operationName] !== "function") {
      throw new TypeError(`controller.${operationName} must be a function.`);
    }
  }
}

function assertDocumentObject(documentObject) {
  for (const documentMethodName of ["createElement", "getElementById"]) {
    if (typeof documentObject?.[documentMethodName] !== "function") {
      throw new TypeError(
        `documentObject.${documentMethodName} must be a function.`,
      );
    }
  }
}

function assertLifecycleSignal(lifecycleSignal) {
  if (typeof lifecycleSignal?.addEventListener !== "function") {
    throw new TypeError("lifecycleSignal must be an AbortSignal.");
  }
}

export function createVisualizationViewControlsAdapter(dependencies) {
  assertExactDependencyFieldNames(dependencies);
  const { controller, documentObject, lifecycleSignal } = dependencies;
  assertControllerOperations(controller);
  assertDocumentObject(documentObject);
  assertLifecycleSignal(lifecycleSignal);

  const connectedControlElements = new Map();
  for (const [controlName, elementId] of Object.entries(
    VISUALIZATION_VIEW_CONTROL_ELEMENT_IDS,
  )) {
    const controlElement = documentObject.getElementById(elementId);
    if (controlElement !== null && controlElement !== undefined) {
      connectedControlElements.set(controlName, controlElement);
    }
  }

  let isPresentingControllerState = false;
  let isGraphLayoutPaused = false;

  function listenOnControl(controlName, eventType, onControlEvent) {
    const controlElement = connectedControlElements.get(controlName);
    if (controlElement === undefined) {
      return;
    }
    controlElement.addEventListener(eventType, onControlEvent, {
      signal: lifecycleSignal,
    });
  }

  function requestVisualizationView(visualizationViewRequest) {
    if (lifecycleSignal.aborted || isPresentingControllerState) {
      return;
    }
    controller.setVisualizationView(visualizationViewRequest);
  }

  function renderSearchResults(ontologySearchResult) {
    const resultListElement = connectedControlElements.get(
      "ontologySearchResultList",
    );
    if (resultListElement === undefined) {
      return;
    }
    const resultElements = ontologySearchResult.matches.map(
      (ontologyElementMatch) => {
        const resultElement = documentObject.createElement(
          SEARCH_RESULT_ELEMENT_NAME,
        );
        resultElement.textContent = ontologyElementMatch.displayLabel;
        resultElement.disabled = !ontologyElementMatch.isFocusable;
        resultElement.addEventListener(
          "click",
          () => {
            if (!ontologyElementMatch.isFocusable) {
              return;
            }
            requestVisualizationView({
              focus: [ontologyElementMatch.ontologyElementReference],
            });
          },
          { signal: lifecycleSignal },
        );
        return resultElement;
      },
    );
    resultListElement.replaceChildren(...resultElements);
  }

  listenOnControl("languageSelect", "change", (changeEvent) => {
    requestVisualizationView({ language: changeEvent.target.value });
  });

  for (const [controlName, filterFieldName] of Object.entries(
    VISIBILITY_FILTER_CONTROL_NAMES,
  )) {
    listenOnControl(controlName, "change", (changeEvent) => {
      requestVisualizationView({
        filters: {
          // A checked filter control removes those elements from the graph.
          [filterFieldName]: changeEvent.target.checked ? "hide" : "show",
        },
      });
    });
  }

  listenOnControl("minimumDegreeRange", "change", (changeEvent) => {
    requestVisualizationView({
      filters: { minDegree: Number.parseInt(changeEvent.target.value, 10) },
    });
  });

  listenOnControl("relaxLayoutButton", "click", () => {
    requestVisualizationView({ layout: "resume" });
  });

  listenOnControl("zoomAndCenterViewportButton", "click", () => {
    requestVisualizationView({ viewport: "zoom-and-center" });
  });

  listenOnControl("graphLayoutPauseButton", "click", () => {
    if (lifecycleSignal.aborted) {
      return;
    }
    isGraphLayoutPaused = !isGraphLayoutPaused;
    controller.setGraphLayoutPaused({ isPaused: isGraphLayoutPaused });
  });

  listenOnControl("ontologySearchInput", "input", (inputEvent) => {
    if (lifecycleSignal.aborted) {
      return;
    }
    renderSearchResults(
      controller.findOntologyElements({ query: inputEvent.target.value }),
    );
  });

  function presentControlValue(controlName, controlValue) {
    const controlElement = connectedControlElements.get(controlName);
    if (controlElement === undefined || controlElement.value === controlValue) {
      return;
    }
    controlElement.value = controlValue;
  }

  function presentControlChecked(controlName, isChecked) {
    const controlElement = connectedControlElements.get(controlName);
    if (controlElement === undefined || controlElement.checked === isChecked) {
      return;
    }
    controlElement.checked = isChecked;
  }

  function presentControlText(controlName, controlText) {
    const controlElement = connectedControlElements.get(controlName);
    if (
      controlElement === undefined ||
      controlElement.textContent === controlText
    ) {
      return;
    }
    controlElement.textContent = controlText;
  }

  function onControllerStateChanged(controllerState) {
    isPresentingControllerState = true;
    try {
      isGraphLayoutPaused = controllerState.layout.status === "paused";
      presentControlText(
        "graphLayoutStatusOutput",
        controllerState.layout.status,
      );
      const visualizationView = controllerState.view;
      if (visualizationView === null || visualizationView === undefined) {
        return;
      }
      presentControlValue("languageSelect", visualizationView.language);
      for (const [controlName, filterFieldName] of Object.entries(
        VISIBILITY_FILTER_CONTROL_NAMES,
      )) {
        presentControlChecked(
          controlName,
          visualizationView.filters[filterFieldName] === "hide",
        );
      }
      presentControlValue(
        "minimumDegreeRange",
        String(visualizationView.filters.minDegree),
      );
    } finally {
      isPresentingControllerState = false;
    }
  }

  const unsubscribeFromControllerState = controller.subscribeToState(
    onControllerStateChanged,
  );
  lifecycleSignal.addEventListener(
    "abort",
    () => {
      unsubscribeFromControllerState();
    },
    { once: true },
  );

  return Object.freeze({
    connectedControlNames: Object.freeze([...connectedControlElements.keys()]),

    focusOntologyElementReferences(ontologyElementReferences) {
      if (!Array.isArray(ontologyElementReferences)) {
        throw new TypeError(
          "Ontology-element references must be supplied as an array.",
        );
      }
      requestVisualizationView({ focus: [...ontologyElementReferences] });
    },
  });
}
