import { readVisualizationShareLink } from "./controller/visualizationShareLink.js";
import {
  ONTOLOGY_LIFECYCLE_STATES,
  isOntologyModelAvailable,
  ontologyLifecycleCapabilitiesFor,
} from "./ontologyLifecycle.js";

export function createLoadingModule({
  webVowlController,
  ontologyMenu,
  hideNavigationMenus,
  onGraphControlAvailabilityChanged,
  onShareLinkPresentation,
} = {}) {
  /** some constants **/
  const PROGRESS_BAR_ERROR = 0;
  const PROGRESS_BAR_BUSY = 1;
  const PROGRESS_BAR_PERCENT = 2;
  let progressBarMode = 1;

  let applicationState = ONTOLOGY_LIFECYCLE_STATES.IDLE;
  let missingImportsWarning = false;
  let showLoadingDetails = false;
  let visibilityStatus = true;

  /** variable defs **/
  const loadingModule = {};
  const menuContainer =
    typeof document !== "undefined"
      ? document.querySelector("#loading-info")
      : null;
  const loadingInfoContainer =
    typeof document !== "undefined"
      ? document.querySelector("#loadingInfo-container")
      : null;
  const detailsButton =
    typeof document !== "undefined"
      ? document.querySelector("#show-loadingInfo-button")
      : null;
  const closeButton =
    typeof document !== "undefined"
      ? document.querySelector("#loadingIndicator_closeButton")
      : null;
  let newOntologyCounter = 1;
  const lifecycleAbortController = new AbortController();
  let isSetup = false;
  let fileReadSequence = 0;

  /** functon defs **/
  loadingModule.checkForScreenSize = function ({ width: w, height: h }) {
    if (w < 270) {
      document.querySelector("#loading-info").classList.add("hidden");
    } else {
      // check if it should be visible
      if (visibilityStatus === true) {
        document.querySelector("#loading-info").classList.remove("hidden");
      } else {
        document.querySelector("#loading-info").classList.add("hidden");
      }
    }
    if (h < 150) {
      document.querySelector("#loadingInfo_msgBox").classList.add("hidden");
    } else {
      document.querySelector("#loadingInfo_msgBox").classList.remove("hidden");
    }
    if (h < 80) {
      document.querySelector("#progressBarContext").classList.add("hidden");
      document
        .querySelector("#layoutLoadingProgressBarContainer")
        .classList.add("compact");
    } else {
      document.querySelector("#progressBarContext").classList.remove("hidden");
      document
        .querySelector("#layoutLoadingProgressBarContainer")
        .classList.remove("compact");
    }
  };

  loadingModule.getMessageVisibilityStatus = function () {
    return visibilityStatus;
  };

  loadingModule.getProgressBarMode = function () {
    return progressBarMode;
  };

  loadingModule.successfullyLoadedOntology = function () {
    return isOntologyModelAvailable(applicationState);
  };

  loadingModule.state = function () {
    return applicationState;
  };

  function setDisabled(selector, disabled) {
    document.querySelectorAll(selector).forEach(function (el) {
      el.disabled = disabled;
    });
  }

  function applyControlAvailability() {
    const capabilities = ontologyLifecycleCapabilitiesFor(applicationState);
    const graphControlsDisabled = !capabilities.graphControls;

    setDisabled(
      "#c_export > button, #c_filter > button, #c_config > button, #c_debug > button",
      graphControlsDisabled,
    );
    setDisabled("#c_select > button", !capabilities.ontologySource);
    setDisabled("#c_modes > button", !capabilities.editorMode);

    onGraphControlAvailabilityChanged?.(capabilities.graphControls);

    setDisabled("#m_modes input, #m_modes button", !capabilities.dataModes);
    setDisabled("#editorModeModuleCheckbox", !capabilities.editorMode);
  }

  loadingModule.setState = function (state) {
    ontologyLifecycleCapabilitiesFor(state);
    applicationState = state;
    applyControlAvailability();
  };

  loadingModule.refreshControlAvailability = applyControlAvailability;
  loadingModule.markLoading = function () {
    loadingModule.setState(ONTOLOGY_LIFECYCLE_STATES.LOADING);
  };
  loadingModule.markModelReady = function () {
    loadingModule.setState(ONTOLOGY_LIFECYCLE_STATES.MODEL_READY);
  };
  loadingModule.markRendering = function () {
    loadingModule.setState(ONTOLOGY_LIFECYCLE_STATES.RENDERING);
  };
  loadingModule.markReady = function () {
    loadingModule.setState(ONTOLOGY_LIFECYCLE_STATES.READY);
  };
  loadingModule.markError = function () {
    loadingModule.setState(ONTOLOGY_LIFECYCLE_STATES.ERROR);
  };

  loadingModule.missingImportsWarning = function () {
    return missingImportsWarning;
  };

  loadingModule.showErrorDetailsMessage = function () {
    loadingModule.showLoadingIndicator();
    loadingModule.expandDetails();
    document
      .querySelector("#loadingIndicator_closeButton")
      .classList.add("hidden");
    loadingModule.scrollDownDetails();
  };

  loadingModule.showWarningDetailsMessage = function () {
    document.querySelector("#currentLoadingStep").className = "step-warning";
    loadingModule.showLoadingIndicator();
    loadingModule.expandDetails();
    document
      .querySelector("#loadingIndicator_closeButton")
      .classList.remove("hidden");
    loadingModule.scrollDownDetails();
  };

  loadingModule.scrollDownDetails = function () {
    const scrollingElement = document.querySelector("#loadingInfo-container");
    scrollingElement.scrollTop = scrollingElement.scrollHeight;
  };

  loadingModule.hideLoadingIndicator = function () {
    document.querySelector("#loading-info").classList.add("hidden");
    visibilityStatus = false;
  };

  loadingModule.showLoadingIndicator = function () {
    document.querySelector("#loading-info").classList.remove("hidden");
    visibilityStatus = true;
  };

  /** -- SETUP -- **/
  loadingModule.setup = function () {
    if (isSetup || lifecycleAbortController.signal.aborted) {
      return;
    }
    isSetup = true;
    // create connections for close and details button;
    loadingInfoContainer.classList.toggle("hidden", !showLoadingDetails);
    detailsButton.addEventListener(
      "click",
      function () {
        showLoadingDetails = !showLoadingDetails;
        loadingInfoContainer.classList.toggle("hidden", !showLoadingDetails);
        detailsButton.classList.toggle(
          "accordion-trigger-active",
          showLoadingDetails,
        );
      },
      { signal: lifecycleAbortController.signal },
    );

    closeButton.addEventListener(
      "click",
      function () {
        menuContainer.classList.add("hidden");
      },
      { signal: lifecycleAbortController.signal },
    );
    loadingModule.setBusyMode();
    loadingModule.setState(ONTOLOGY_LIFECYCLE_STATES.IDLE);
  };

  loadingModule.dispose = function () {
    lifecycleAbortController.abort();
  };

  loadingModule.updateSize = function () {
    showLoadingDetails = !loadingInfoContainer.classList.contains("hidden");
    loadingInfoContainer.classList.toggle("hidden", !showLoadingDetails);
    detailsButton.classList.toggle(
      "accordion-trigger-active",
      showLoadingDetails,
    );
  };

  loadingModule.getDetailsState = function () {
    return showLoadingDetails;
  };

  loadingModule.expandDetails = function () {
    showLoadingDetails = true;
    loadingInfoContainer.classList.toggle("hidden", !showLoadingDetails);
    detailsButton.classList.toggle(
      "accordion-trigger-active",
      showLoadingDetails,
    );
  };

  loadingModule.collapseDetails = function () {
    showLoadingDetails = false;
    loadingInfoContainer.classList.toggle("hidden", !showLoadingDetails);
    detailsButton.classList.toggle(
      "accordion-trigger-active",
      showLoadingDetails,
    );
  };

  function presentLoadingError(message = "") {
    const errorMessage = document.querySelector("#loadingErrorMessage");
    errorMessage.textContent = message;
    errorMessage.hidden = message.length === 0;
  }

  loadingModule.setBusyMode = function () {
    presentLoadingError();
    document.querySelector("#currentLoadingStep").className = "step-busy";
    document.querySelector("#currentLoadingStep").textContent =
      "Loading ontology";
    document.querySelector("#progressBarValue").removeAttribute("value");
    document.querySelector("#progressBarLabel").textContent = "";
    progressBarMode = PROGRESS_BAR_BUSY;
  };

  loadingModule.setSuccessful = function () {
    presentLoadingError();
    document.querySelector("#currentLoadingStep").className = "step-success";
  };

  loadingModule.setErrorMode = function () {
    document.querySelector("#currentLoadingStep").className = "step-error";
    document.querySelector("#currentLoadingStep").textContent =
      "Loading failed";
    document.querySelector("#progressBarValue").setAttribute("value", 0);
    document.querySelector("#progressBarLabel").textContent = "";
    progressBarMode = PROGRESS_BAR_ERROR;
  };

  loadingModule.setPercentMode = function () {
    document.querySelector("#currentLoadingStep").className = "step-busy";
    document.querySelector("#currentLoadingStep").textContent =
      "Layout optimization";
    document.querySelector("#progressBarValue").setAttribute("value", 0);
    document.querySelector("#progressBarLabel").textContent = "0%";
    progressBarMode = PROGRESS_BAR_PERCENT;
  };

  loadingModule.setPercentValue = function (val) {
    const numericValue = Number.parseFloat(val);
    const percent = Number.isFinite(numericValue)
      ? Math.max(0, Math.min(100, numericValue))
      : 0;
    document.querySelector("#progressBarValue").setAttribute("value", percent);
    document.querySelector("#progressBarLabel").textContent =
      Math.round(percent) + "%";
  };

  // Ontology document extensions the browser can name confidently. Anything
  // else reaches the controller with a display name and no asserted format.
  const ONTOLOGY_TEXT_FORMAT_BY_FILE_EXTENSION = new Map([
    ["ttl", "turtle"],
    ["turtle", "turtle"],
    ["rdf", "rdfxml"],
    ["owl", "rdfxml"],
    ["xml", "rdfxml"],
    ["owx", "owlxml"],
    ["nt", "ntriples"],
    ["nq", "nquads"],
    ["trig", "trig"],
    ["jsonld", "jsonld"],
    ["omn", "manchester"],
    ["ofn", "functional"],
  ]);

  function fileExtensionOf(displayName) {
    const extensionSeparatorIndex = String(displayName).lastIndexOf(".");
    return extensionSeparatorIndex === -1
      ? ""
      : String(displayName)
          .slice(extensionSeparatorIndex + 1)
          .toLowerCase();
  }

  // A location names a source. Validated models and their original provenance
  // are retained by the controller, shared with every other input adapter.
  function ontologySourceForIdentifier(ontologyIdentifier) {
    if (ontologyIdentifier.startsWith("url=")) {
      return {
        kind: "vowl-json-url",
        url: decodeURIComponent(ontologyIdentifier.slice(4)),
      };
    }
    if (ontologyIdentifier.startsWith("iri=")) {
      return {
        kind: "ontology-document-iri",
        documentIri: decodeURIComponent(ontologyIdentifier.slice(4)),
      };
    }
    const presetIdentifier = ontologyIdentifier.startsWith("file=")
      ? ontologyIdentifier.slice("file=".length)
      : ontologyIdentifier;
    return {
      kind: "vowl-json-url",
      url: new URL("data/" + presetIdentifier + ".json", document.baseURI).href,
    };
  }

  loadingModule.ontologyLoadRequestFromLocation = function () {
    const { ontologyIdentifier, initialVisualization, presentation } =
      readVisualizationShareLink(String(location));
    return {
      source: ontologySourceForIdentifier(ontologyIdentifier),
      ...(Object.keys(initialVisualization).length === 0
        ? {}
        : { initialVisualization }),
      ...(Object.keys(presentation).length === 0 ? {} : { presentation }),
    };
  };

  loadingModule.loadOntologyFromLocation = async function ({
    reuseCachedOntology = true,
  } = {}) {
    let request;
    try {
      request = loadingModule.ontologyLoadRequestFromLocation();
    } catch {
      loadingModule.renderControllerState({
        ...webVowlController.getState(),
        status: "error",
        error: {
          message:
            "The visualization link contains invalid options or an invalid ontology address.",
        },
      });
      return undefined;
    }
    return loadingModule.loadRemoteSource({ ...request, reuseCachedOntology });
  };

  function prepareLoadingPresentation() {
    loadingModule.markLoading();
    hideNavigationMenus?.();
    ontologyMenu?.clearDetailInformation();
    loadingModule.setBusyMode();
    loadingModule.showLoadingIndicator();
    loadingModule.collapseDetails();
    missingImportsWarning = false;
    document
      .querySelector("#loadingIndicator_closeButton")
      .classList.add("hidden");
  }

  async function loadOntologyThroughController(
    source,
    initialVisualization,
    reuseCachedOntology,
  ) {
    try {
      return await webVowlController.loadOntology(
        {
          source,
          ...(reuseCachedOntology === undefined ? {} : { reuseCachedOntology }),
        },
        ...(initialVisualization === undefined
          ? []
          : [{ initialVisualization }]),
      );
    } catch {
      loadingModule.renderControllerState(webVowlController.getState());
      return undefined;
    }
  }

  // The one route for every location-driven ontology source.
  loadingModule.loadRemoteSource = async function ({
    source,
    initialVisualization,
    presentation,
    reuseCachedOntology = true,
  }) {
    fileReadSequence += 1;
    prepareLoadingPresentation();
    document.querySelector("#progressBarLabel").textContent = "";
    const state = await loadOntologyThroughController(
      source,
      initialVisualization,
      reuseCachedOntology,
    );
    if (state && presentation !== undefined) {
      onShareLinkPresentation?.(presentation);
    }
    return state;
  };

  // The one route for a file the reader dropped or selected.
  loadingModule.loadDroppedFile = async function (file) {
    const currentFileRead = ++fileReadSequence;
    const isCurrentFileRead = () =>
      currentFileRead === fileReadSequence &&
      !lifecycleAbortController.signal.aborted;
    prepareLoadingPresentation();
    let fileContent;
    try {
      fileContent = await file.text();
    } catch {
      if (!isCurrentFileRead()) {
        return undefined;
      }
      loadingModule.renderControllerState({
        ...webVowlController.getState(),
        status: "error",
        error: { message: "The selected file could not be read." },
      });
      return undefined;
    }
    if (!isCurrentFileRead()) {
      return undefined;
    }

    if (fileExtensionOf(file.name) === "json") {
      return loadOntologyThroughController({
        kind: "vowl-json-text",
        text: fileContent,
        displayName: file.name,
      });
    }

    const ontologyTextFormat = ONTOLOGY_TEXT_FORMAT_BY_FILE_EXTENSION.get(
      fileExtensionOf(file.name),
    );
    return loadOntologyThroughController({
      kind: "ontology-text",
      text: fileContent,
      displayName: file.name,
      ...(ontologyTextFormat === undefined
        ? {}
        : { format: ontologyTextFormat }),
    });
  };

  // The controller owns the load lifecycle; this module renders its state.
  loadingModule.renderControllerState = function (controllerState) {
    if (controllerState === null || typeof controllerState !== "object") {
      return;
    }
    if (controllerState.status === "loading") {
      // Every controller load, including an agent input, supersedes a file
      // that is still being read by this input adapter.
      fileReadSequence += 1;
    }
    if (
      controllerState.status === "ready" ||
      controllerState.status === "relaxing"
    ) {
      loadingModule.markReady();
      loadingModule.setSuccessful();
      loadingModule.hideLoadingIndicator();
      return;
    }
    if (controllerState.status === "error") {
      if (
        controllerState.source &&
        controllerState.loadGeneration > 0 &&
        controllerState.layout?.status !== "unavailable"
      ) {
        loadingModule.markReady();
      } else {
        loadingModule.markError();
      }
      loadingModule.setErrorMode();
      loadingModule.showLoadingIndicator();
      if (controllerState.error) {
        presentLoadingError(controllerState.error.message);
        ontologyMenu?.append_message_toLastBulletPoint(
          controllerState.error.message,
          { tone: "error", breakBefore: true },
        );
      }
      return;
    }
    // Background layout begins after the graph is drawn and can be controlled.
    const IN_FLIGHT_CONTROLLER_STATUSES = new Set([
      "loading",
      "parsing",
      "rendering",
    ]);
    if (!IN_FLIGHT_CONTROLLER_STATUSES.has(controllerState.status)) {
      return;
    }

    loadingModule.showLoadingIndicator();
    const renderProgress = controllerState.renderProgress;
    if (!renderProgress) {
      loadingModule.markLoading();
      loadingModule.setBusyMode();
      return;
    }
    loadingModule.markRendering();
    if (progressBarMode !== PROGRESS_BAR_PERCENT) {
      loadingModule.setPercentMode();
    }
    const completedCount = renderProgress.completedRenderedElementCount;
    const totalCount = renderProgress.totalRenderedElementCount;
    loadingModule.setPercentValue(
      totalCount > 0 ? (100 * completedCount) / totalCount : 0,
    );
  };

  /** ------------------ URL Interpreter -------------- **/
  function nextNewOntologyIdentifier() {
    const routeMatch = String(location.hash).match(/#new_ontology(\d+)/);
    if (routeMatch) {
      newOntologyCounter = Math.max(
        newOntologyCounter,
        Number(routeMatch[1]) + 1,
      );
    }
    return "new_ontology" + newOntologyCounter++;
  }

  loadingModule.createNewOntology = function () {
    const ontologyIdentifier = nextNewOntologyIdentifier();
    const route = "#opts=editorMode=true;#" + ontologyIdentifier;

    onShareLinkPresentation?.({ editorMode: true });
    window.history.pushState(null, "", route);
    // A new ontology is the empty preset document, loaded like any other.
    loadingModule.loadRemoteSource({
      source: {
        kind: "vowl-json-url",
        url: new URL("data/new_ontology.json", document.baseURI).href,
      },
      reuseCachedOntology: false,
    });
    return ontologyIdentifier;
  };

  return loadingModule;
}
