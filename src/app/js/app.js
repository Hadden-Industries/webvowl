import { createControllerStatePresenter } from "./ui/controllerStatePresenter.js";
import { createBrowserPaintObserver } from "./ui/browserPaintObserver.js";
import { createD3RenderedGraphAdapter } from "../../webvowl/js/runtime/d3RenderedGraphAdapter.js";
import { createRenderedGraphConfiguration } from "../../webvowl/js/runtime/renderedGraphConfiguration.js";
import { createGraphLayoutSettler } from "./controller/graphLayoutSettler.js";
import { createOntologyInspector } from "./controller/ontologyInspector.js";
import { createOntologySourceLoader } from "./controller/ontologySourceLoader.js";
import { vowlModelInspectionProjector } from "./controller/vowlModelInspectionProjector.js";
import { createVisualizationArtifactService } from "./controller/visualizationArtifactService.js";
import { createSvgSerializer } from "./controller/svgSerializer.js";
import { createWebVowlController } from "./controller/webVowlController.js";
import { registerWebMcpTools } from "./webmcp/webMcpAdapter.js";
import { createVisualizationArtifactDownloadAdapter } from "./ui/visualizationArtifactDownloadAdapter.js";
import { createConstants } from "../../shared/js/util/constants.js";
import { createLanguageTools } from "../../shared/js/util/languageTools.js";
import { createConfigMenu } from "./menu/configMenu.js";
import { createDebugMenu } from "./menu/debugMenu.js";
import { createExportMenu } from "./menu/exportMenu.js";
import { createDegreeFilterControl } from "./ui/degreeFilterControl.js";
import { createGravityMenu } from "./menu/gravityMenu.js";
import { createModeMenu } from "./menu/modeMenu.js";
import { createNavigationMenu } from "./menu/navigationMenu.js";
import { createOntologyMenu } from "./menu/ontologyMenu.js";
import { createPauseMenu } from "./menu/pauseMenu.js";
import { createVisualizationViewControlsAdapter } from "./ui/visualizationViewControlsAdapter.js";
import { createResetMenu } from "./menu/resetMenu.js";
import { createSearchMenu } from "./menu/searchMenu.js";
import { createZoomSlider } from "./menu/zoomSlider.js";

const nativeApplicationUiModuleNamespacesPromise = Promise.all([
  import("./directInputModule.js"),
  import("./ontologyEditorSidebar.js"),
  import("./leftSidebar.js"),
  import("./loadingModule.js"),
  import("./sidebar.js"),
  import("./warningModule.js"),
]);

export function createWebVowlApplication() {
  const app = {};
  const GRAPH_SELECTOR = "#graph";
  const languageTools = createLanguageTools();
  const webVowlConstants = createConstants();
  const languageConstants = {
    iriBasedLanguage: webVowlConstants.LANG_IRIBASED,
    undefinedLanguage: webVowlConstants.LANG_UNDEFINED,
  };
  const degreeFilterControl = createDegreeFilterControl();
  const pauseMenu = createPauseMenu({ documentObject: document });

  let directInputModule;
  let ontologyEditorSidebar;
  let leftSidebar;
  let loadingModule;
  let sidebar;
  let warningModule;

  // Agent-neutral controller. Embedding hosts and WebMCP reach WebVOWL through
  // this interface rather than through the renderer.
  const visualizationArtifactDownloadAdapter =
    createVisualizationArtifactDownloadAdapter({
      documentObject: document,
    });
  // One production rendering path: the adapter owns the renderer implementation
  const renderedGraphConfiguration = createRenderedGraphConfiguration();
  const waitForBrowserPaint = createBrowserPaintObserver({
    requestAnimationFrame: globalThis.requestAnimationFrame.bind(globalThis),
    cancelAnimationFrame: globalThis.cancelAnimationFrame.bind(globalThis),
  });
  // and publishes it as the RenderedGraphRuntime the controller consumes.
  const { renderedGraphRuntime } = createD3RenderedGraphAdapter({
    graphContainerElement: document.querySelector(GRAPH_SELECTOR),
    observeNextPaint: (_loadGeneration, options) =>
      waitForBrowserPaint(options),
    renderedGraphConfiguration,
  });

  let unsubscribeFromControllerState;
  const webVowlController = createWebVowlController({
    requestOntologyDeletionConfirmation: (proposal, options) =>
      warningModule.confirmOntologyDeletion(proposal, options),
    applicationUrl: globalThis.location.href,
    ontologySourceLoader: createOntologySourceLoader(),
    vowlModelInspectionProjector,
    renderedGraphRuntime,
    ontologyInspector: createOntologyInspector(),
    graphLayoutSettler: createGraphLayoutSettler({
      requestAnimationFrame: (frameCallback) =>
        globalThis.requestAnimationFrame(frameCallback),
      cancelAnimationFrame: (frameHandle) =>
        globalThis.cancelAnimationFrame(frameHandle),
      nowMs: () => globalThis.performance.now(),
    }),
    visualizationArtifactService: createVisualizationArtifactService({
      svgSerializer: createSvgSerializer({
        XMLSerializerConstructor: globalThis.XMLSerializer,
        documentObject: document,
        webVowlVersion: webVowlConstants.WEBVOWL_VERSION,
      }),
      webCrypto: globalThis.crypto,
      BlobConstructor: globalThis.Blob,
      objectUrlApi: globalThis.URL,
      visualizationArtifactPublicationPort:
        visualizationArtifactDownloadAdapter,
    }),
    waitForDocumentFonts: () => document.fonts?.ready ?? Promise.resolve(),
    waitForBrowserPaint,
  });

  // Menus that command the controller are constructed once it exists.
  const debugMenu = createDebugMenu({ webVowlController });
  const modeMenu = createModeMenu({ webVowlController });
  const configMenu = createConfigMenu({
    webVowlController,
    maxLabelWidthPx: renderedGraphConfiguration.maxLabelWidth,
  });
  const gravityMenu = createGravityMenu({
    webVowlController,
    classDistancePx: renderedGraphConfiguration.classDistance,
    datatypeDistancePx: renderedGraphConfiguration.datatypeDistance,
  });
  const exportMenu = createExportMenu({
    webVowlController,
    visualizationArtifactDownloadAdapter,
    readShareLinkPresentation: () => ({
      sidebar: Number(sidebar.getSidebarVisibility()),
      editorMode:
        webVowlController.getState().editorMode?.isEditorMode === true,
      debugFeatures: debugMenu.isVisible(),
    }),
  });
  const navigationMenu = createNavigationMenu({
    onExportMenuOpened: () => exportMenu.exportAsUrl(),
  });
  const zoomSlider = createZoomSlider({
    webVowlController,
    hideNavigationMenus: () => navigationMenu.hideAllMenus(),
    onControlsVisibilityChanged: () => sidebar?.updateDockedControlsPosition(),
    minimumMagnification: renderedGraphConfiguration.minMagnification,
    maximumMagnification: renderedGraphConfiguration.maxMagnification,
    graphWidthPx: renderedGraphConfiguration.widthPx,
    graphHeightPx: renderedGraphConfiguration.heightPx,
  });
  const ontologyMenu = createOntologyMenu({
    webVowlController,
    loadOntologyFromLocation: (options) =>
      loadingModule.loadOntologyFromLocation(options),
    loadDroppedFile: (file) => loadingModule.loadDroppedFile(file),
    createNewOntology: () => loadingModule.createNewOntology(),
    scrollLoadingDetails: () => loadingModule.scrollDownDetails(),
    hideNavigationMenus: () => navigationMenu.hideAllMenus(),
  });
  const searchMenu = createSearchMenu({
    webVowlController,
    onOntologyIriEntered: (iri) => ontologyMenu.setIriText(iri),
  });
  const resetMenu = createResetMenu({
    webVowlController,
    clearSearchPresentation: () => searchMenu.clearText(),
  });
  const viewControlsLifecycleController = new AbortController();
  createVisualizationViewControlsAdapter({
    controller: webVowlController,
    documentObject: document,
    lifecycleSignal: viewControlsLifecycleController.signal,
  });

  // The agent surface is registered once the controller exists, because every
  // tool is an operation on it. A page that cannot offer tools carries on as an
  // ordinary WebVOWL page.
  const webMcpRegistration = registerWebMcpTools({
    controller: webVowlController,
    documentObject: document,
    windowObject: window,
  });

  app.getWebVowlController = function () {
    return webVowlController;
  };

  app.getWebMcpRegistration = function () {
    return webMcpRegistration;
  };

  let resizeAnimationFrame;
  let graphResizeObserver;

  app.dispose = function () {
    // Withdraw the tools before the controller they call goes away, so no
    // registration can outlive what answers it.
    webMcpRegistration.dispose();
    viewControlsLifecycleController.abort();
    degreeFilterControl.dispose();
    ontologyEditorSidebar?.dispose();
    debugMenu.dispose();
    graphResizeObserver?.disconnect();
    graphResizeObserver = undefined;
    if (resizeAnimationFrame !== undefined) {
      cancelAnimationFrame(resizeAnimationFrame);
      resizeAnimationFrame = undefined;
    }
    unsubscribeFromControllerState?.();
    unsubscribeFromControllerState = undefined;
    webVowlController.dispose();
    visualizationArtifactDownloadAdapter.dispose();
  };
  // app.afterInitializationCallback=undefined;

  let executeFileDrop = false;
  let wasMessageToShow = false;
  let firstTime = false;
  let initialTouchZoomHandled = false;

  function addFileDropEvents(selector) {
    const node = document.querySelector(selector);

    node.ondragover = function (e) {
      e.preventDefault();

      document.querySelector("#dragDropContainer").classList.remove("hidden");
      // get svg size
      const w = document
        .querySelector(GRAPH_SELECTOR)
        .getBoundingClientRect().width;
      const h = document
        .querySelector(GRAPH_SELECTOR)
        .getBoundingClientRect().height;

      // get event position; (using clientX and clientY);
      const cx = e.clientX;
      const cy = e.clientY;

      if (firstTime === false) {
        const loadingInfo = document.querySelector("#loading-info");
        const state = loadingInfo.classList.contains("hidden");
        wasMessageToShow = !state;
        firstTime = true;
        loadingInfo.classList.add("hidden"); // hide it so it does not conflict with drop event
        const bb = document.querySelector("#drag_msg").getBoundingClientRect();
        const hs = bb.height;
        const ws = bb.width;

        let icon_scale = Math.min(hs, ws);
        icon_scale /= 100;

        document
          .querySelector("#drag_icon_group")
          .setAttribute(
            "transform",
            "translate ( " + 0.25 * ws + " " + 0.25 * hs + ")",
          );
        document
          .querySelector("#drag_icon")
          .setAttribute(
            "transform",
            "matrix (" + icon_scale + ",0,0," + icon_scale + ",0,0)",
          );
        document
          .querySelector("#drag_icon_drop")
          .setAttribute(
            "transform",
            "matrix (" + icon_scale + ",0,0," + icon_scale + ",0,0)",
          );
      }

      if (cx > 0.25 * w && cx < 0.75 * w && cy > 0.25 * h && cy < 0.75 * h) {
        document.querySelector("#drag_msg_text").innerHTML = "Drop it here.";
        document.querySelector("#drag_msg").classList.add("drag-over");
        executeFileDrop = true;

        document.querySelector("#drag_icon").classList.add("hidden");
        document.querySelector("#drag_icon_drop").classList.remove("hidden");
      } else {
        document.querySelector("#drag_msg_text").innerHTML =
          "Drag ontology file here.";
        document.querySelector("#drag_msg").classList.remove("drag-over");
        executeFileDrop = false;

        document.querySelector("#drag_icon").classList.remove("hidden");
        document.querySelector("#drag_icon_drop").classList.add("hidden");
      }
    };
    node.ondrop = function (ev) {
      ev.preventDefault();
      firstTime = false;
      if (executeFileDrop) {
        if (ev.dataTransfer.items) {
          if (ev.dataTransfer.items.length === 1) {
            if (ev.dataTransfer.items[0].kind === "file") {
              const file = ev.dataTransfer.items[0].getAsFile();
              loadingModule.loadDroppedFile(file);
            }
          } else {
            //  >> WARNING not multiple file uploaded;
            warningModule.showMultiFileUploadWarning();
          }
        }
      }
      document.querySelector("#dragDropContainer").classList.add("hidden");
    };

    node.ondragleave = function (e) {
      const w = document
        .querySelector(GRAPH_SELECTOR)
        .getBoundingClientRect().width;
      const h = document
        .querySelector(GRAPH_SELECTOR)
        .getBoundingClientRect().height;

      // get event position; (using clientX and clientY);
      const cx = e.clientX;
      const cy = e.clientY;

      let hidden = false;
      firstTime = false;

      if (cx < 0.1 * w || cx > 0.9 * w) {
        hidden = true;
      }
      if (cy < 0.1 * h || cy > 0.9 * h) {
        hidden = true;
      }
      document
        .querySelector("#dragDropContainer")
        .classList.toggle("hidden", hidden);

      document
        .querySelector("#loading-info")
        .classList.toggle("hidden", !wasMessageToShow); // show it again
      // check if it should be visible
      const should_show = loadingModule.getMessageVisibilityStatus();
      if (should_show === false) {
        document.querySelector("#loading-info").classList.add("hidden"); // hide it
      }
    };
  }

  function applyShareLinkPresentation({
    sidebar: sidebarVisibility,
    editorMode,
    debugFeatures,
  }) {
    if (sidebarVisibility !== undefined) {
      sidebar.showSidebar(sidebarVisibility, true);
    }
    if (editorMode !== undefined) {
      webVowlController.setOntologyEditorOptions({ isEditorMode: editorMode });
    }
    if (debugFeatures !== undefined) {
      debugMenu.setVisible(debugFeatures);
    }
  }

  async function initializeNativeApplicationUiModules() {
    const [
      { createDirectInputModule },
      { createOntologyEditorSidebar },
      { createLeftSidebar },
      { createLoadingModule },
      { createSidebar },
      { createWarningModule },
    ] = await nativeApplicationUiModuleNamespacesPromise;

    directInputModule = createDirectInputModule({
      webVowlController,
    });
    ontologyEditorSidebar = createOntologyEditorSidebar({
      webVowlController,
      documentObject: document,
      showWarning: (message) =>
        warningModule.showWarning(
          "Editing could not be completed",
          message,
          "Check the entered value and try again.",
          1,
        ),
    });
    leftSidebar = createLeftSidebar({
      webVowlController,
      hideNavigationMenus: () => navigationMenu.hideAllMenus(),
      onViewportGeometryChanged: scheduleSizeAdjustment,
      updateNavigationOverflow: () =>
        navigationMenu.updateScrollButtonVisibility(),
    });
    loadingModule = createLoadingModule({
      webVowlController,
      ontologyMenu,
      hideNavigationMenus: () => navigationMenu.hideAllMenus(),
      onGraphControlAvailabilityChanged: (enabled) => {
        for (const control of [resetMenu, pauseMenu, zoomSlider, searchMenu]) {
          control.setMenuMode(enabled);
        }
      },
      onShareLinkPresentation: applyShareLinkPresentation,
    });
    sidebar = createSidebar({
      languageConstants,
      languageTools,
      webVowlController,
      onViewportGeometryChanged: scheduleSizeAdjustment,
      hideNavigationMenus: () => navigationMenu.hideAllMenus(),
      updateNavigationOverflow: () =>
        navigationMenu.updateScrollButtonVisibility(),
    });
    warningModule = createWarningModule({ webVowlController });
  }

  app.initialize = async function () {
    await initializeNativeApplicationUiModules();
    addFileDropEvents(GRAPH_SELECTOR);

    window.addEventListener("resize", scheduleSizeAdjustment, {
      signal: viewControlsLifecycleController.signal,
    });

    const graphHost = document.querySelector(GRAPH_SELECTOR);
    if (
      !graphResizeObserver &&
      graphHost &&
      typeof ResizeObserver !== "undefined"
    ) {
      graphResizeObserver = new ResizeObserver(scheduleSizeAdjustment);
      graphResizeObserver.observe(graphHost);
    }

    exportMenu.setup();
    gravityMenu.setup();
    degreeFilterControl.setup();
    modeMenu.setup();
    pauseMenu.setup();
    sidebar.setup();
    loadingModule.setup();
    // Presentation modules render controller state rather than being called
    // from inside the renderer, and each runs only when its own slice changed.
    const controllerStatePresenter = createControllerStatePresenter({
      renderLoadState: (controllerState) => {
        loadingModule.renderControllerState(controllerState);
        ontologyMenu.renderOntologySource(controllerState.source);
      },
      renderGraphLayoutPaused: (isPaused) =>
        pauseMenu.renderGraphLayoutPaused(isPaused),
      // Details are described from the ontology the controller holds, so the
      // sidebar never reads a drawn element for a semantic fact.
      renderSelectedOntologyElementDetails: (elementDescriptions) =>
        sidebar.renderSelectedOntologyElementDetails(elementDescriptions),
      renderOntologySummary: (ontologySummary) =>
        sidebar.renderOntologySummary(ontologySummary),
      renderViewport: (zoomScale) => zoomSlider.renderViewport(zoomScale),
      renderEditorMode: (isEditorMode) => {
        sidebar.renderEditorMode(isEditorMode);
        ontologyMenu.renderEditorMode(isEditorMode);
        modeMenu.syncEditorState(isEditorMode);
        leftSidebar.hideCollapseButton(!isEditorMode);
        leftSidebar.showSidebar(isEditorMode ? 1 : 0);
      },
      describeOntologyElements: (descriptionRequest) =>
        webVowlController.describeOntologyElements(descriptionRequest),
      readOntologySummary: () => webVowlController.getOntologySummary(),
    });
    unsubscribeFromControllerState = webVowlController.subscribeToState(
      (controllerState, changedFieldNames) => {
        controllerStatePresenter.present(controllerState, changedFieldNames);
        if (changedFieldNames.includes("loadGeneration")) {
          searchMenu.clearText();
        }
        if (
          changedFieldNames.some((fieldName) =>
            ["status", "loadGeneration", "view"].includes(fieldName),
          )
        ) {
          searchMenu.renderVisualizationFocus(
            webVowlController.getVisualizationFocus(),
          );
        }
        if (
          changedFieldNames.includes("degreeFilterRange") ||
          changedFieldNames.includes("view")
        ) {
          degreeFilterControl.renderDegreeFilterRange(
            controllerState.degreeFilterRange,
            controllerState.view?.filters.minDegree ?? 0,
          );
        }
      },
    );
    leftSidebar.setup();
    ontologyEditorSidebar.setup();
    debugMenu.setup();
    document.querySelector("#logo").classList.remove("hidden");
    // Reset uses the controller's visualization defaults and focus state.
    resetMenu.setup();
    searchMenu.setup();
    navigationMenu.setup();
    zoomSlider.setup();

    ontologyMenu.setup();
    configMenu.setup(zoomSlider);
    loadingModule.refreshControlAvailability();

    leftSidebar.showSidebar(0);
    leftSidebar.hideCollapseButton(true);

    adjustSize();

    // prevent backspace reloading event
    const htmlBody = document.querySelector("body");
    document.addEventListener("keydown", function (event) {
      if (event.key === "Backspace" && event.target === htmlBody) {
        // we could add here an alert
        event.preventDefault();
      }
      // using ctrl+Shift+d as debug option
      if (
        event.ctrlKey &&
        event.shiftKey &&
        event.key &&
        event.key.toLowerCase() === "d"
      ) {
        debugMenu.setVisible(!debugMenu.isVisible());
        event.preventDefault();
      }
    });
    const blockGraphInteractions = document.querySelector(
      "#blockGraphInteractions",
    );
    if (blockGraphInteractions) {
      blockGraphInteractions.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
      });
      blockGraphInteractions.addEventListener("dblclick", function (event) {
        event.preventDefault();
        event.stopPropagation();
      });
      blockGraphInteractions.draggable = false;
    }

    const directTextInput = document.querySelector("#direct-text-input");
    if (directTextInput) {
      directTextInput.addEventListener("click", function () {
        directInputModule.setDirectInputMode();
      });
    }
    adjustSize();
    // The location names the ontology to show; the controller loads it.
    loadingModule.loadOntologyFromLocation();

    // add the initialized objects
  };

  function scheduleSizeAdjustment() {
    if (viewControlsLifecycleController.signal.aborted) {
      return;
    }
    if (resizeAnimationFrame !== undefined) {
      cancelAnimationFrame(resizeAnimationFrame);
    }
    resizeAnimationFrame = requestAnimationFrame(function () {
      resizeAnimationFrame = undefined;
      adjustSize();
    });
  }

  function adjustSize() {
    directInputModule.updateLayout();
    const bounds = document
      .querySelector(GRAPH_SELECTOR)
      .getBoundingClientRect();
    const viewport = { width: bounds.width, height: bounds.height };
    const isTouch = Boolean(isTouchDevice());
    const occludedLeftWidthPx = leftSidebar.isSidebarVisible()
      ? Math.min(
          bounds.width,
          document
            .querySelector("#containerForLeftSideBar")
            .getBoundingClientRect().width,
        )
      : 0;
    webVowlController.resizeVisualizationViewport({
      widthPx: bounds.width,
      heightPx: bounds.height,
      occludedLeftWidthPx,
      isTouchDevice: isTouch,
    });
    debugMenu.renderInputModality(isTouch);
    if (isTouch && !initialTouchZoomHandled && isMultiTouchZoomDevice()) {
      initialTouchZoomHandled = true;
      configMenu.setCheckBoxValue("showZoomSliderConfigCheckbox", false);
    }

    loadingModule.checkForScreenSize(viewport);

    adjustSliderSize(viewport.height);

    navigationMenu.updateScrollButtonVisibility();

    const dragMsg = document.querySelector("#drag_msg");
    if (dragMsg) {
      const hs = dragMsg.getBoundingClientRect().height;
      const ws = dragMsg.getBoundingClientRect().width;
      document
        .querySelector("#drag_icon_group")
        .setAttribute(
          "transform",
          "translate ( " + 0.25 * ws + " " + 0.25 * hs + ")",
        );
    }
  }

  function adjustSliderSize(fullHeight) {
    const isSliderAllowed = zoomSlider.showSlider();
    if (fullHeight < 150 || !isSliderAllowed) {
      document.querySelector("#zoomSlider").classList.add("hidden");
    } else {
      document.querySelector("#zoomSlider").classList.remove("hidden");
    }
  }

  function isTouchDevice() {
    try {
      return (
        "ontouchstart" in window ||
        (navigator.maxTouchPoints && navigator.maxTouchPoints > 0) ||
        (navigator.msMaxTouchPoints && navigator.msMaxTouchPoints > 0)
      );
    } catch (_err) {
      return false;
    }
  }

  function isMultiTouchZoomDevice() {
    try {
      return (
        "ontouchstart" in window ||
        (navigator.maxTouchPoints && navigator.maxTouchPoints >= 2) ||
        (navigator.msMaxTouchPoints && navigator.msMaxTouchPoints >= 2)
      );
    } catch (_err) {
      return false;
    }
  }

  return app;
}
