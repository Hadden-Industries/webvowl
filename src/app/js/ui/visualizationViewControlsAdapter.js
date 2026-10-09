import { runVisualizationControlAction } from "./visualizationControlAction.js";

// The controls the reader already sees. Present their shared view choices and
// connect language, filtering, pause and framing actions to the controller.
export const VISUALIZATION_VIEW_CONTROL_ELEMENT_IDS = Object.freeze({
  languageSelect: "language",
  datatypesFilterCheckbox: "datatypeFilterCheckbox",
  objectPropertiesFilterCheckbox: "objectPropertyFilterCheckbox",
  subclassesFilterCheckbox: "subclassFilterCheckbox",
  disjointnessFilterCheckbox: "disjointFilterCheckbox",
  setOperatorsFilterCheckbox: "setoperatorFilterCheckbox",
  filterMenuButton: "filter-button",
  nodesShownContainer: "nodesShownControl",
  compactNotationCheckbox: "compactnotationModuleCheckbox",
  nodeScalingCheckbox: "nodescalingModuleCheckbox",
  colorExternalsCheckbox: "colorexternalsModuleCheckbox",
  pickAndPinCheckbox: "pickandpinModuleCheckbox",
  dynamicLabelWidthCheckbox: "labelWidthModuleCheckbox",
  maximumLabelWidthRange: "maxLabelWidthSlider",
  maximumLabelWidthValue: "maxLabelWidthSliderValue",
  maximumLabelWidthDescription: "maxLabelWidthDescriptionLabel",
  classDistanceRange: "classDistanceSlider",
  classDistanceValue: "classDistanceSliderValue",
  datatypeDistanceRange: "datatypeDistanceSlider",
  datatypeDistanceValue: "datatypeDistanceSliderValue",
  externalColorModeButton: "externalColorModeButton",
  zoomAndCenterViewportButton: "centerGraphButton",
  graphLayoutPauseButton: "pause-button",
});

const VIEW_CONTROLS_DEPENDENCY_FIELD_NAMES = Object.freeze([
  "controller",
  "documentObject",
  "lifecycleSignal",
]);

const CONTROLLER_OPERATION_NAMES = Object.freeze([
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
    void runVisualizationControlAction(
      () => controller.setVisualizationView(visualizationViewRequest),
      documentObject,
    );
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

  function onControllerStateChanged(
    controllerState,
    changedFieldNames = Object.keys(controllerState),
  ) {
    isPresentingControllerState = true;
    try {
      isGraphLayoutPaused = controllerState.layout.status === "paused";
      if (
        changedFieldNames.some((name) =>
          ["status", "view", "nodeCountStatus", "loadGeneration"].includes(
            name,
          ),
        )
      ) {
        // Highlight the applied effect, including automatic limits on first load.
        // The menu stays active for other filters when the count returns to All.
        const count = controllerState.nodeCountStatus;
        const hasModel =
          count !== null &&
          count !== undefined &&
          !["idle", "loading"].includes(controllerState.status);
        const countLimited =
          hasModel && count.shownNodeCount < count.eligibleNodeCount;
        const otherFiltersActive =
          hasModel &&
          Object.values(VISIBILITY_FILTER_CONTROL_NAMES).some(
            (name) => controllerState.view?.filters?.[name] === "hide",
          );
        const filterButton = connectedControlElements.get("filterMenuButton");
        filterButton?.classList.toggle(
          "highlighted",
          countLimited || otherFiltersActive,
        );
        connectedControlElements
          .get("nodesShownContainer")
          ?.classList.toggle("highlighted", countLimited);
        filterButton?.setAttribute(
          "aria-label",
          countLimited
            ? `Filters (${controllerState.view?.nodesShown?.mode === "auto" ? "automatically " : ""}showing ${count.shownNodeCount} of ${count.eligibleNodeCount} available nodes)`
            : otherFiltersActive
              ? "Filters (active)"
              : "Filters",
        );
      }
      if (!changedFieldNames.includes("view")) {
        return;
      }
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
      const { modes, forceDistances } = visualizationView;
      if (modes) {
        for (const mode of [
          "compactNotation",
          "nodeScaling",
          "colorExternals",
          "pickAndPin",
          "dynamicLabelWidth",
        ]) {
          presentControlChecked(`${mode}Checkbox`, modes[mode]);
        }
        presentControlValue(
          "maximumLabelWidthRange",
          String(modes.maxLabelWidthPx),
        );
        presentControlText(
          "maximumLabelWidthValue",
          String(modes.maxLabelWidthPx),
        );
        const widthSlider = connectedControlElements.get(
          "maximumLabelWidthRange",
        );
        if (widthSlider) {
          widthSlider.disabled = !modes.dynamicLabelWidth;
        }
        for (const name of [
          "maximumLabelWidthValue",
          "maximumLabelWidthDescription",
        ]) {
          connectedControlElements
            .get(name)
            ?.classList.toggle(
              "disabledLabelForSlider",
              !modes.dynamicLabelWidth,
            );
        }
        const gradient = modes.colorExternalsMode === "gradient";
        connectedControlElements
          .get("externalColorModeButton")
          ?.classList.toggle("active", gradient);
        presentControlText(
          "externalColorModeButton",
          gradient ? "Gradient" : "Same color",
        );
      }
      if (forceDistances) {
        for (const kind of ["class", "datatype"]) {
          presentControlValue(
            `${kind}DistanceRange`,
            String(forceDistances[`${kind}DistancePx`]),
          );
          presentControlText(
            `${kind}DistanceValue`,
            String(forceDistances[`${kind}DistancePx`]),
          );
        }
      }
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
