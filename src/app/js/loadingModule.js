import { createLoadingProgressPresenter } from "./ui/loadingProgressPresenter.js";
import { readVisualizationShareLink } from "./controller/visualizationShareLink.js";
import {
  ONTOLOGY_LIFECYCLE_STATES,
  isOntologyModelAvailable,
  ontologyLifecycleCapabilitiesFor,
} from "./ontologyLifecycle.js";

class LocalOntologyFileUnavailableError extends Error {
  constructor(fileName) {
    super(
      `Select ${JSON.stringify(fileName)} again in the Ontology menu, or drop it onto the page. Local files are not retained after a page reload.`,
    );
    this.sourceLabel = fileName;
  }
}

export function createLoadingModule({
  webVowlController,
  ontologyMenu,
  hideNavigationMenus,
  onGraphControlAvailabilityChanged,
  onShareLinkPresentation,
  selectLocalSource,
  requestBaseIri,
  requestLocalFormat,
  createOntologySource,
  resolvePresetSource,
} = {}) {
  let applicationState = ONTOLOGY_LIFECYCLE_STATES.IDLE;
  let missingImportsWarning = false;
  const loadingModule = {};
  let newOntologyCounter = 1;
  const lifecycleAbortController = new AbortController();
  let isSetup = false;
  let fileReadSequence = 0;
  let pendingInput;
  let inputRecovery;
  let dispatchingLocalFile = false;
  let localAdmission;
  let lastErrorDetails = null;
  let observedLoading = false;
  let observedRequestId;
  const presentation = createLoadingProgressPresenter({
    documentObject: document,
    onCancel: () => webVowlController.cancelOntologyLoad(),
    onChooseSource: () => document.querySelector("#ontology-menu-open").click(),
  });

  function supersedeInput() {
    fileReadSequence += 1;
    inputRecovery = undefined;
    localAdmission = undefined;
    presentation.clearInputRecovery();
    pendingInput?.abort();
    pendingInput = undefined;
    return fileReadSequence;
  }
  function beginInput() {
    const sequence = supersedeInput();
    pendingInput = new AbortController();
    if (lifecycleAbortController.signal.aborted) {
      pendingInput.abort();
    }
    return { sequence, signal: pendingInput.signal };
  }
  function setDisabled(selector, disabled) {
    document.querySelectorAll(selector).forEach((element) => {
      element.disabled = disabled;
    });
  }
  function applyControlAvailability() {
    const capabilities = ontologyLifecycleCapabilitiesFor(applicationState);
    setDisabled(
      "#c_export > button, #c_filter > button, #c_config > button, #c_debug > button",
      !capabilities.graphControls,
    );
    setDisabled("#c_select > button", !capabilities.ontologySource);
    setDisabled("#c_modes > button", !capabilities.editorMode);
    onGraphControlAvailabilityChanged?.(capabilities.graphControls);
    setDisabled("#m_modes input, #m_modes button", !capabilities.dataModes);
    setDisabled("#editorModeModuleCheckbox", !capabilities.editorMode);
  }
  loadingModule.setState = (state) => {
    ontologyLifecycleCapabilitiesFor(state);
    applicationState = state;
    applyControlAvailability();
  };
  loadingModule.state = () => applicationState;
  loadingModule.successfullyLoadedOntology = () =>
    isOntologyModelAvailable(applicationState);
  loadingModule.missingImportsWarning = () => missingImportsWarning;
  loadingModule.refreshControlAvailability = applyControlAvailability;
  loadingModule.getMessageVisibilityStatus = presentation.isVisible;
  loadingModule.getDetailsState = presentation.isDetailsExpanded;
  loadingModule.scrollDownDetails = presentation.scrollDetails;
  loadingModule.setup = () => {
    if (isSetup || lifecycleAbortController.signal.aborted) {
      return;
    }
    isSetup = true;
    presentation.setup();
    applyControlAvailability();
  };
  loadingModule.dispose = () => {
    lifecycleAbortController.abort();
    supersedeInput();
    presentation.dispose();
  };

  function renderInputError(message, sourceLabel) {
    presentation.begin();
    loadingModule.renderControllerState(
      {
        ...webVowlController.getState(),
        status: "error",
        loadProgress: null,
        error: { message },
      },
      { sourceLabel: String(sourceLabel).slice(0, 2048) },
    );
  }

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
    if (createOntologySource && /^new_ontology\d+$/.test(ontologyIdentifier)) {
      throw new Error(
        "This new ontology was not saved in the URL. Open its exported file or create a new ontology.",
      );
    }
    if (ontologyIdentifier.startsWith("file=")) {
      const fileName = decodeURIComponent(ontologyIdentifier.slice(5));
      if (fileName.length === 0) {
        throw new TypeError("A local file route requires a file name.");
      }
      throw new LocalOntologyFileUnavailableError(fileName);
    }
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
    const preset = resolvePresetSource?.(ontologyIdentifier);
    if (preset !== undefined) {
      return preset;
    }
    return {
      kind: "vowl-json-url",
      url: new URL("data/" + ontologyIdentifier + ".json", document.baseURI)
        .href,
    };
  }

  loadingModule.ontologyLoadRequestFromLocation = function () {
    const { ontologyIdentifier, initialVisualization, presentation } =
      readVisualizationShareLink(String(location));
    const source = ontologySourceForIdentifier(ontologyIdentifier);
    // Presets are interactive ontology examples even though their packaged
    // canonical artifacts include saved placements. Explicit route choices win.
    const initial = /^(?:url|iri|file)=/.test(ontologyIdentifier)
      ? initialVisualization
      : {
          ...initialVisualization,
          view: { layout: "resume", ...initialVisualization.view },
        };
    return {
      source,
      ...(/^(?:url|iri|file)=/.test(ontologyIdentifier)
        ? {}
        : { useAutomaticNodesShown: true }),
      ...(Object.keys(initial).length === 0
        ? {}
        : { initialVisualization: initial }),
      ...(Object.keys(presentation).length === 0 ? {} : { presentation }),
    };
  };

  loadingModule.loadOntologyFromLocation = async function ({
    reuseCachedOntology = true,
  } = {}) {
    // A newer navigation supersedes a file read even when its route cannot load.
    supersedeInput();
    let request;
    try {
      request = loadingModule.ontologyLoadRequestFromLocation();
    } catch (error) {
      renderInputError(
        error instanceof LocalOntologyFileUnavailableError
          ? error.message
          : error.message + " Correct the link options and load it again.",
        error.sourceLabel ?? String(location),
      );
      return undefined;
    }
    return loadingModule.loadRemoteSource({ ...request, reuseCachedOntology });
  };

  function prepareLoadingPresentation() {
    loadingModule.setState(ONTOLOGY_LIFECYCLE_STATES.LOADING);
    hideNavigationMenus?.();
    presentation.begin();
    presentation.render({ status: "loading" });
    missingImportsWarning = false;
  }

  async function loadOntologyThroughController(
    source,
    initialVisualization,
    reuseCachedOntology,
    useAutomaticNodesShown,
  ) {
    try {
      return await webVowlController.loadOntology(
        {
          source,
          ...(reuseCachedOntology === undefined ? {} : { reuseCachedOntology }),
        },
        ...(initialVisualization === undefined &&
        useAutomaticNodesShown === undefined
          ? []
          : [
              {
                ...(initialVisualization === undefined
                  ? {}
                  : { initialVisualization }),
                ...(useAutomaticNodesShown === undefined
                  ? {}
                  : { useAutomaticNodesShown }),
              },
            ]),
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
    useAutomaticNodesShown,
  }) {
    supersedeInput();
    prepareLoadingPresentation();
    const state = await loadOntologyThroughController(
      source,
      initialVisualization,
      reuseCachedOntology,
      useAutomaticNodesShown,
    );
    if (state && presentation !== undefined) {
      onShareLinkPresentation?.(presentation);
    }
    return state;
  };

  // The one route for a file the reader dropped or selected.
  loadingModule.selectPastedSource = async function ({ text, signal }) {
    const input = beginInput();
    const controller = pendingInput;
    const abort = () => controller.abort();
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) {
      abort();
    }
    try {
      const source = await selectLocalSource({ text, signal: input.signal });
      return input.signal.aborted || input.sequence !== fileReadSequence
        ? null
        : source;
    } catch (error) {
      if (input.signal.aborted) {
        return null;
      }
      throw error;
    } finally {
      signal?.removeEventListener("abort", abort);
    }
  };

  loadingModule.loadLocalFile = async function (file) {
    const { sequence: currentFileRead, signal } = beginInput();
    const isCurrentFileRead = () =>
      currentFileRead === fileReadSequence &&
      !signal.aborted &&
      !lifecycleAbortController.signal.aborted;
    if (selectLocalSource) {
      async function openSelectedSource(source) {
        inputRecovery = undefined;
        prepareLoadingPresentation();
        const previousGeneration =
          webVowlController.getState()?.loadGeneration ?? 0;
        function recordAdmission(state) {
          if (
            localAdmission === recordAdmission &&
            isCurrentFileRead() &&
            state.loadGeneration > previousGeneration
          ) {
            localAdmission = undefined;
            window.history.pushState(
              null,
              "",
              "#file=" + encodeURIComponent(file.name),
            );
          }
        }
        localAdmission = recordAdmission;
        try {
          let pending;
          dispatchingLocalFile = true;
          try {
            pending = webVowlController.loadOntology({ source }, { signal });
          } finally {
            dispatchingLocalFile = false;
          }
          const state = await pending;
          if (
            isCurrentFileRead() &&
            ["ready", "relaxing"].includes(state?.status)
          ) {
            recordAdmission(state);
            return state;
          }
        } catch (error) {
          if (!isCurrentFileRead()) {
            return undefined;
          }
          const state = webVowlController.getState();
          const needsBase =
            requestBaseIri && error.code === "MAPPING_BASE_REQUIRED";
          const needsFormat =
            requestLocalFormat &&
            error.code === "MAPPING_SYNTAX_INVALID" &&
            source.format === undefined &&
            source.fallbackBaseIri === undefined;
          if (source.localSource && (needsBase || needsFormat)) {
            let requesting = false;
            inputRecovery = {
              requestId: state.loadProgress?.requestId,
              reason: error.code,
              label: needsBase
                ? "Open with a base IRI"
                : "Choose document format",
              dismiss() {
                if (isCurrentFileRead()) {
                  supersedeInput();
                }
              },
              async retry() {
                if (requesting || !isCurrentFileRead()) {
                  return;
                }
                requesting = true;
                try {
                  const choose = needsBase
                    ? requestBaseIri
                    : requestLocalFormat;
                  const value = await choose({
                    displayName: file.name,
                    signal,
                  });
                  if (value !== null && isCurrentFileRead()) {
                    await openSelectedSource({
                      ...source,
                      ...(needsBase
                        ? { fallbackBaseIri: value }
                        : { format: value }),
                    });
                  }
                } catch (reason) {
                  if (isCurrentFileRead()) {
                    renderInputError(reason.message, file.name);
                  }
                } finally {
                  requesting = false;
                }
              },
            };
          }
          loadingModule.renderControllerState(state);
        } finally {
          if (localAdmission === recordAdmission) {
            localAdmission = undefined;
          }
        }
        return undefined;
      }
      try {
        const source = await selectLocalSource({
          file,
          signal,
        });
        if (source === null || !isCurrentFileRead()) {
          return undefined;
        }
        return await openSelectedSource(source);
      } catch (error) {
        if (isCurrentFileRead()) {
          renderInputError(error.message, file.name);
        }
        return undefined;
      }
    }
    prepareLoadingPresentation();
    let fileContent;
    try {
      fileContent = await file.text();
    } catch {
      if (!isCurrentFileRead()) {
        return undefined;
      }
      renderInputError("The selected file could not be read.", file.name);
      return undefined;
    }
    if (!isCurrentFileRead()) {
      return undefined;
    }

    // Both file selection and dropping identify a local source. Recording the
    // route with pushState avoids a hashchange that would supersede this load.
    window.history.pushState(
      null,
      "",
      "#file=" + encodeURIComponent(file.name),
    );
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

  // The controller owns every load, including loads initiated through WebMCP.
  loadingModule.renderControllerState = (state, context) => {
    if (
      state === null ||
      typeof state !== "object" ||
      lifecycleAbortController.signal.aborted
    ) {
      return;
    }
    const loading = ["loading", "parsing", "rendering"].includes(state.status);
    if (
      loading &&
      (!observedLoading || state.loadProgress?.requestId !== observedRequestId)
    ) {
      // The controller publishes the initial loading state synchronously.
      // An externally initiated load supersedes our file and its retry.
      if (!dispatchingLocalFile) {
        supersedeInput();
      }
      lastErrorDetails = null;
    }
    observedLoading = loading;
    observedRequestId = state.loadProgress?.requestId;
    if (loading) {
      loadingModule.setState(
        state.loadProgress?.stage === "drawing"
          ? ONTOLOGY_LIFECYCLE_STATES.RENDERING
          : ONTOLOGY_LIFECYCLE_STATES.LOADING,
      );
    } else if (["ready", "relaxing"].includes(state.status)) {
      localAdmission?.(state);
      loadingModule.setState(ONTOLOGY_LIFECYCLE_STATES.READY);
    } else if (state.status === "error") {
      loadingModule.setState(
        state.source &&
          state.loadGeneration > 0 &&
          state.layout?.status !== "unavailable"
          ? ONTOLOGY_LIFECYCLE_STATES.READY
          : ONTOLOGY_LIFECYCLE_STATES.ERROR,
      );
    } else if (state.status === "idle") {
      loadingModule.setState(ONTOLOGY_LIFECYCLE_STATES.IDLE);
    } else {
      return;
    }
    presentation.render(state, {
      ...context,
      inputRecovery:
        state.status === "error" &&
        inputRecovery &&
        state.error?.details?.reason === inputRecovery.reason &&
        inputRecovery.requestId === state.loadProgress?.requestId
          ? inputRecovery
          : undefined,
    });
    if (state.status === "error" && state.error) {
      const error = state.error;
      const detailMessages = [
        ...new Set([
          error.code === "LOAD_FAILED" ? undefined : error.code,
          error.details?.reason,
        ]),
      ].filter(
        (message) =>
          typeof message === "string" &&
          message.trim().length > 0 &&
          message !== error.message,
      );
      document.querySelector("#loadingInfo_msgBox").hidden =
        detailMessages.length === 0 && !state.loadProgress;
      // json-identity-contract: ordered-tuple; owner: Load-error presentation; reason: Load generation, message text and the ordered detail-message strings identify one rendered error presentation.
      const identity = JSON.stringify([
        state.loadGeneration,
        error.message,
        detailMessages,
      ]);
      for (const message of lastErrorDetails === identity
        ? []
        : detailMessages) {
        ontologyMenu?.append_message(message, { tone: "error", block: true });
      }
      lastErrorDetails = identity;
    } else {
      document.querySelector("#loadingInfo_msgBox").hidden = false;
    }
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
    if (createOntologySource) {
      const { sequence, signal } = beginInput();
      return (async () => {
        try {
          const source = await createOntologySource({
            signal,
          });
          if (
            source === null ||
            sequence !== fileReadSequence ||
            lifecycleAbortController.signal.aborted
          ) {
            return undefined;
          }
          const ontologyIdentifier = nextNewOntologyIdentifier();
          onShareLinkPresentation?.({ editorMode: true });
          window.history.pushState(
            null,
            "",
            "#opts=editorMode=true;#" + ontologyIdentifier,
          );
          await loadingModule.loadRemoteSource({
            source,
            reuseCachedOntology: false,
            initialVisualization: { view: { layout: "pause" } },
          });
          return ontologyIdentifier;
        } catch (error) {
          if (
            sequence === fileReadSequence &&
            !lifecycleAbortController.signal.aborted
          ) {
            renderInputError(error.message, "New ontology");
          }
          return undefined;
        }
      })();
    }
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
