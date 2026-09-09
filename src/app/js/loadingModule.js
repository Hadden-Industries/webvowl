import { applicationUiModule } from "./ui/applicationUiRegistry.js";
import {
  ONTOLOGY_LIFECYCLE_STATES,
  isOntologyModelAvailable,
  ontologyLifecycleCapabilitiesFor,
} from "./ontologyLifecycle.js";

export function createLoadingModule(graph, { webVowlController } = {}) {
  /** some constants **/
  const PROGRESS_BAR_ERROR = 0;
  const PROGRESS_BAR_BUSY = 1;
  const PROGRESS_BAR_PERCENT = 2;
  let progressBarMode = 1;

  let applicationState = ONTOLOGY_LIFECYCLE_STATES.IDLE;
  let missingImportsWarning = false;
  let showLoadingDetails = false;
  let visibilityStatus = true;

  const DEFAULT_JSON_NAME = "foaf"; // This file is loaded by default
  let conversion_sessionId;

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
  let ontologyMenu;
  let ontologyIdentifierFromURL;
  let newOntologyCounter = 1;
  const lifecycleAbortController = new AbortController();
  let isSetup = false;
  let fileReadSequence = 0;

  /** functon defs **/
  loadingModule.checkForScreenSize = function () {
    // checks for window size and adjusts the loading indicator
    const w = graph.options().width(),
      h = graph.options().height();

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

  // Interface modules live in the application registry. The renderer settings
  // object still carries a few, so it remains the fallback until they move.
  function optionModule(name) {
    const registeredUiModule = applicationUiModule(name);
    if (registeredUiModule !== undefined) {
      return registeredUiModule;
    }
    const graphOptions = graph.options && graph.options();
    if (!graphOptions || typeof graphOptions[name] !== "function") {
      return undefined;
    }
    return graphOptions[name]();
  }

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

    const resetMenu = optionModule("resetMenu");
    if (resetMenu && resetMenu.setMenuMode) {
      resetMenu.setMenuMode(capabilities.graphControls);
    }
    const pausedMenu = optionModule("pausedMenu");
    if (pausedMenu && pausedMenu.setMenuMode) {
      pausedMenu.setMenuMode(capabilities.graphControls);
    }
    const zoomSlider = optionModule("zoomSlider");
    if (zoomSlider && zoomSlider.setMenuMode) {
      zoomSlider.setMenuMode(capabilities.graphControls);
    }
    const searchMenu = optionModule("searchMenu");
    if (searchMenu && searchMenu.setMenuMode) {
      searchMenu.setMenuMode(capabilities.graphControls);
    }

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

  loadingModule.setOntologyMenu = function (m) {
    ontologyMenu = m;
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

  loadingModule.setBusyMode = function () {
    document.querySelector("#currentLoadingStep").className = "step-busy";
    document.querySelector("#progressBarValue").removeAttribute("value");
    document.querySelector("#progressBarLabel").textContent = "";
    progressBarMode = PROGRESS_BAR_BUSY;
  };

  loadingModule.setSuccessful = function () {
    document.querySelector("#currentLoadingStep").className = "step-success";
  };

  loadingModule.setErrorMode = function () {
    document.querySelector("#currentLoadingStep").className = "step-error";
    document.querySelector("#progressBarValue").setAttribute("value", 0);
    document.querySelector("#progressBarLabel").textContent = "";
    progressBarMode = PROGRESS_BAR_ERROR;
  };

  loadingModule.setPercentMode = function () {
    document.querySelector("#currentLoadingStep").className = "step-busy";
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

  function ontologyIdentifierFromLocation() {
    const locationParameters = identifyParameter(String(location)).filter(
      (locationParameter) => !locationParameter.startsWith("opts="),
    );
    return locationParameters.length > 0
      ? locationParameters[locationParameters.length - 1]
      : DEFAULT_JSON_NAME;
  }

  function cachedVowlModelSourceFor(ontologyIdentifier) {
    const cachedOntologyContent =
      ontologyMenu?.cachedOntology(ontologyIdentifier);
    if (!cachedOntologyContent) {
      return null;
    }
    return {
      kind: "vowl-model",
      model:
        typeof cachedOntologyContent === "string"
          ? JSON.parse(cachedOntologyContent)
          : cachedOntologyContent,
      displayName: ontologyIdentifier,
    };
  }

  // The location is the application's shareable route; it names one canonical
  // controller source rather than a loading branch.
  loadingModule.ontologySourceFromLocation = function () {
    const ontologyIdentifier = ontologyIdentifierFromLocation();
    if (typeof graph.dispatchEvent === "function") {
      loadGraphOptions(identifyParameter(String(location)));
    }

    if (ontologyIdentifier.startsWith("url=")) {
      const requestedUrl = decodeURIComponent(ontologyIdentifier.slice(4));
      ontologyIdentifierFromURL = requestedUrl;
      return (
        cachedVowlModelSourceFor(requestedUrl) ?? {
          kind: "vowl-json-url",
          url: requestedUrl,
        }
      );
    }
    if (ontologyIdentifier.startsWith("iri=")) {
      const requestedIri = decodeURIComponent(ontologyIdentifier.slice(4));
      ontologyIdentifierFromURL = requestedIri;
      return (
        cachedVowlModelSourceFor(requestedIri) ?? {
          kind: "ontology-document-iri",
          documentIri: requestedIri,
        }
      );
    }

    const presetIdentifier = ontologyIdentifier.startsWith("file=")
      ? ontologyIdentifier.slice("file=".length)
      : ontologyIdentifier;
    ontologyIdentifierFromURL = presetIdentifier;
    return (
      cachedVowlModelSourceFor(presetIdentifier) ?? {
        kind: "vowl-json-url",
        url: new URL("data/" + presetIdentifier + ".json", document.baseURI)
          .href,
      }
    );
  };

  function prepareLoadingPresentation(shouldCache) {
    loadingModule.markLoading();
    optionModule("navigationMenu")?.hideAllMenus?.();
    const cachedVowlJson = graph.getCachedJsonObj?.() ?? null;
    if (shouldCache === true && cachedVowlJson !== null) {
      ontologyMenu?.setCachedOntology(
        ontologyIdentifierFromURL,
        JSON.stringify(cachedVowlJson),
      );
    }
    conversion_sessionId = -10000;
    ontologyMenu?.setConversionID(conversion_sessionId);
    ontologyMenu?.stopLoadingTimer();
    ontologyMenu?.clearDetailInformation();
    loadingModule.setBusyMode();
    loadingModule.showLoadingIndicator();
    loadingModule.collapseDetails();
    missingImportsWarning = false;
    document
      .querySelector("#loadingIndicator_closeButton")
      .classList.add("hidden");
  }

  async function loadOntologyThroughController(source) {
    try {
      return await webVowlController.loadOntology({ source });
    } catch {
      loadingModule.renderControllerState(webVowlController.getState());
      return undefined;
    }
  }

  // The one route for every location-driven ontology source.
  loadingModule.loadRemoteSource = function ({ source, shouldCache = true }) {
    fileReadSequence += 1;
    prepareLoadingPresentation(shouldCache);
    document.querySelector("#progressBarLabel").textContent = "";
    return loadOntologyThroughController(source);
  };

  // The one route for a file the reader dropped or selected.
  loadingModule.loadDroppedFile = async function (file) {
    const currentFileRead = ++fileReadSequence;
    const isCurrentFileRead = () =>
      currentFileRead === fileReadSequence &&
      !lifecycleAbortController.signal.aborted;
    prepareLoadingPresentation(false);
    ontologyIdentifierFromURL = file.name;
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

  loadingModule.emptyGraphContentError = function () {
    graph.clearGraphData();
    ontologyMenu.append_message_toLastBulletPoint("failed", { tone: "error" });
    ontologyMenu.append_message_toLastBulletPoint(
      "Error: Received empty graph",
      { tone: "error", breakBefore: true },
    );
    graph.handleOnLoadingError();
    loadingModule.setErrorMode();
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

    graph.editorMode(true);
    ontologyIdentifierFromURL = ontologyIdentifier;
    window.history.pushState(null, "", route);
    // A new ontology is the empty preset document, loaded like any other.
    loadingModule.loadRemoteSource({
      source: {
        kind: "vowl-json-url",
        url: new URL("data/new_ontology.json", document.baseURI).href,
      },
      shouldCache: true,
    });
    return ontologyIdentifier;
  };

  /** ------------------- LOADING --------------------- **/
  // the loading module splits into 3 branches
  // 1] PresetOntology Loading
  // 2] File Upload
  // 3] Load From URL / IRI

  /** -- PARSE JSON CONTENT -- **/
  loadingModule.notValidJsonFile = function () {
    graph.clearGraphData();
    ontologyMenu.append_message_toLastBulletPoint(" failed", { tone: "error" });
    ontologyMenu.append_message_toLastBulletPoint(
      "Error: Received empty graph",
      { tone: "error", breakBefore: true },
    );
    graph.handleOnLoadingError();
  };

  loadingModule.validJsonFile = function () {
    ontologyMenu.append_message_toLastBulletPoint("done");
    loadingModule.markModelReady();
  };

  /** --- HELPER FUNCTIONS **/

  function identifyParameter(url) {
    const numParameters = (url.match(/#/g) || []).length;
    // create parameters array
    const paramArray = [];
    if (numParameters > 0) {
      const tokens = url.split("#");
      // skip the first token since it is the address of the server
      for (let i = 1; i < tokens.length; i++) {
        if (tokens[i].length === 0) {
          // this token belongs actually to the last paramArray
          paramArray[paramArray.length - 1] =
            paramArray[paramArray.length - 1] + "#";
        } else {
          paramArray.push(tokens[i]);
        }
      }
    }
    return paramArray;
  }

  function loadGraphOptions(parameterArray) {
    const optString = "opts=";

    function loadDefaultConfig() {
      graph.dispatchEvent(
        new CustomEvent("urloptions", {
          detail: {
            opts: graph.ontologyEditingState().initialConfig(),
            changeEditFlag: false,
          },
        }),
      );
    }

    function loadCustomConfig(opts) {
      let changeEditingFlag = false;
      const defObj = graph.ontologyEditingState().initialConfig();
      for (let i = 0; i < opts.length; i++) {
        const keyVal = opts[i].split("=");
        if (keyVal[0] === "editorMode") {
          changeEditingFlag = true;
        }
        defObj[keyVal[0]] = keyVal[1];
      }
      graph.dispatchEvent(
        new CustomEvent("urloptions", {
          detail: { opts: defObj, changeEditFlag: changeEditingFlag },
        }),
      );
    }

    function identifyOptions(paramArray) {
      if (paramArray[0].indexOf(optString) >= 0) {
        // parse the parameters;
        const parameterLength = paramArray[0].length;
        const givenOptionsStr = paramArray[0].substr(5, parameterLength - 6);
        const optionsArray = givenOptionsStr.split(";");
        loadCustomConfig(optionsArray);
      } else {
        ontologyIdentifierFromURL = paramArray[0];
        loadDefaultConfig();
      }
    }

    function identifyOptionsAndOntology(paramArray) {
      if (paramArray[0].indexOf(optString) >= 0) {
        // parse the parameters;
        const parameterLength = paramArray[0].length;
        const givenOptionsStr = paramArray[0].substr(5, parameterLength - 6);
        const optionsArray = givenOptionsStr.split(";");
        loadCustomConfig(optionsArray);
      } else {
        loadDefaultConfig();
      }
      ontologyIdentifierFromURL = paramArray[1];
    }

    switch (parameterArray.length) {
      case 0:
        loadDefaultConfig();
        break;
      case 1:
        identifyOptions(parameterArray);
        break;
      case 2:
        identifyOptionsAndOntology(parameterArray);
        break;
      default:
        console.warn("To many input parameters , loading default config");
        loadDefaultConfig();
        ontologyIdentifierFromURL = "ERROR_TO_MANY_INPUT_PARAMETERS";
    }
  }

  return loadingModule;
}
