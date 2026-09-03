import { registerApplicationUiModule } from "./ui/applicationUiRegistry.js";
import { createD3RenderedGraphAdapter } from "../../webvowl/js/runtime/d3RenderedGraphAdapter.js";
import { createRenderedGraphConfiguration } from "../../webvowl/js/runtime/renderedGraphConfiguration.js";
import { createGraphLayoutSettler } from "./controller/graphLayoutSettler.js";
import { createOntologyInspector } from "./controller/ontologyInspector.js";
import { createOntologySourceLoader } from "./controller/ontologySourceLoader.js";
import { vowlModelInspectionProjector } from "./controller/vowlModelInspectionProjector.js";
import { createSvgArtifactService } from "./controller/svgArtifactService.js";
import { createSvgSerializer } from "./controller/svgSerializer.js";
import { createWebVowlController } from "./controller/webVowlController.js";
import { createSvgArtifactDownloadAdapter } from "./ui/svgArtifactDownloadAdapter.js";
import { createColorExternalsSwitch } from "../../webvowl/js/runtime/colorExternalsSwitch.js";
import { createCompactNotationSwitch } from "../../shared/js/modules/compactNotationSwitch.js";
import { createConstants } from "../../shared/js/util/constants.js";
import { createDatatypeFilter } from "../../shared/js/modules/datatypeFilter.js";
import { createDisjointFilter } from "../../shared/js/modules/disjointFilter.js";
import { createElementTools } from "../../shared/js/util/elementTools.js";
import { createEmptyLiteralFilter } from "../../shared/js/modules/emptyLiteralFilter.js";
import { createFocuser } from "../../shared/js/modules/focuser.js";
import { createLanguageTools } from "../../shared/js/util/languageTools.js";
import { createNodeDegreeFilter } from "../../shared/js/modules/nodeDegreeFilter.js";
import { createNodeScalingSwitch } from "../../shared/js/modules/nodeScalingSwitch.js";
import { createObjectPropertyFilter } from "../../shared/js/modules/objectPropertyFilter.js";
import { createPickAndPin } from "../../shared/js/modules/pickAndPin.js";
import { createPrefixRepresentationModule } from "../../shared/js/util/prefixRepresentationModule.js";
import { createSelectionDetailsDisplayer } from "../../shared/js/modules/selectionDetailsDisplayer.js";
import { createSetOperatorFilter } from "../../shared/js/modules/setOperatorFilter.js";
import { createStatistics } from "../../shared/js/modules/statistics.js";
import { createSubclassFilter } from "../../shared/js/modules/subclassFilter.js";
import { createConfigMenu } from "./menu/configMenu.js";
import { createDebugMenu } from "./menu/debugMenu.js";
import { createExportMenu } from "./menu/exportMenu.js";
import { createFilterMenu } from "./menu/filterMenu.js";
import { createGravityMenu } from "./menu/gravityMenu.js";
import { createModeMenu } from "./menu/modeMenu.js";
import { createNavigationMenu } from "./menu/navigationMenu.js";
import { createOntologyMenu } from "./menu/ontologyMenu.js";
import { createPauseMenu } from "./menu/pauseMenu.js";
import { createVisualizationViewControlsAdapter } from "./ui/visualizationViewControlsAdapter.js";
import { createRenderedGraphInternals } from "../../webvowl/js/runtime/renderedGraphInternals.js";
import { createResetMenu } from "./menu/resetMenu.js";
import { createSearchMenu } from "./menu/searchMenu.js";
import { createZoomSlider } from "./menu/zoomSlider.js";

const nativeApplicationUiModuleNamespacesPromise = Promise.all([
  import("./directInputModule.js"),
  import("./editSidebar.js"),
  import("./leftSidebar.js"),
  import("./loadingModule.js"),
  import("./sidebar.js"),
  import("./warningModule.js"),
]);

String.prototype.replaceAll = function (search, replacement) {
  const target = this;
  return target.split(search).join(replacement);
};
export function createWebVowlApplication() {
  const app = {},
    graph = createRenderedGraphInternals(),
    renderedGraphSettings = graph.graphOptions(),
    ontologyEditingState = graph.ontologyEditingState(),
    languageTools = createLanguageTools(),
    elementTools = createElementTools(),
    webVowlConstants = createConstants(),
    languageConstants = {
      iriBasedLanguage: webVowlConstants.LANG_IRIBASED,
      undefinedLanguage: webVowlConstants.LANG_UNDEFINED,
    },
    prefixModule = createPrefixRepresentationModule(graph),
    GRAPH_SELECTOR = "#graph",
    // Modules for the webvowl app
    filterMenu = createFilterMenu(graph),
    gravityMenu = createGravityMenu(graph),
    modeMenu = createModeMenu(graph),
    debugMenu = createDebugMenu(graph),
    pauseMenu = createPauseMenu({ documentObject: document }),
    navigationMenu = createNavigationMenu(graph),
    zoomSlider = createZoomSlider(graph),
    configMenu = createConfigMenu(graph),
    // Graph modules
    colorExternalsSwitch = createColorExternalsSwitch(graph),
    compactNotationSwitch = createCompactNotationSwitch(graph),
    datatypeFilter = createDatatypeFilter(),
    disjointFilter = createDisjointFilter(),
    focuser = createFocuser(graph),
    emptyLiteralFilter = createEmptyLiteralFilter(),
    nodeDegreeFilter = createNodeDegreeFilter(filterMenu),
    nodeScalingSwitch = createNodeScalingSwitch(graph),
    objectPropertyFilter = createObjectPropertyFilter(),
    pickAndPin = createPickAndPin(),
    statistics = createStatistics(),
    subclassFilter = createSubclassFilter(),
    setOperatorFilter = createSetOperatorFilter();

  let directInputModule;
  let editSidebar;
  let leftSidebar;
  let loadingModule;
  let selectionDetailDisplayer;
  let sidebar;
  let warningModule;

  app.getRenderedGraphSettings = function () {
    return renderedGraphSettings;
  };
  app.getOntologyEditingState = function () {
    return ontologyEditingState;
  };
  app.getGraph = function () {
    return graph;
  };

  // Agent-neutral controller. Embedding hosts and WebMCP reach WebVOWL through
  // this interface rather than through the renderer.
  const svgArtifactDownloadAdapter = createSvgArtifactDownloadAdapter({
    documentObject: document,
  });
  // One production rendering path: the adapter owns the renderer implementation
  // and publishes it as the RenderedGraphRuntime the controller consumes.
  const { renderedGraphRuntime } = createD3RenderedGraphAdapter({
    renderedGraphInternals: graph,
    graphContainerElement: document.querySelector(GRAPH_SELECTOR),
    observeNextPaint: () =>
      new Promise((resolveFrame) =>
        globalThis.requestAnimationFrame(() => resolveFrame()),
      ),
    renderedGraphConfiguration: createRenderedGraphConfiguration(),
  });

  let unsubscribeFromControllerState;
  const webVowlController = createWebVowlController({
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
    svgArtifactService: createSvgArtifactService({
      svgSerializer: createSvgSerializer({
        XMLSerializerConstructor: globalThis.XMLSerializer,
        documentObject: document,
        webVowlVersion: webVowlConstants.WEBVOWL_VERSION,
      }),
      webCrypto: globalThis.crypto,
      BlobConstructor: globalThis.Blob,
      objectUrlApi: globalThis.URL,
      svgArtifactPublicationPort: svgArtifactDownloadAdapter,
    }),
    waitForDocumentFonts: () => document.fonts?.ready ?? Promise.resolve(),
    waitForBrowserPaint: () =>
      new Promise((resolveFrame) =>
        globalThis.requestAnimationFrame(() => resolveFrame()),
      ),
  });

  // Menus that command the controller are constructed once it exists.
  const exportMenu = createExportMenu(graph, { webVowlController });
  const searchMenu = createSearchMenu(graph, { webVowlController });
  const resetMenu = createResetMenu(graph, { webVowlController });
  const ontologyMenu = createOntologyMenu(graph, { webVowlController });
  const viewControlsLifecycleController = new AbortController();
  createVisualizationViewControlsAdapter({
    controller: webVowlController,
    documentObject: document,
    lifecycleSignal: viewControlsLifecycleController.signal,
  });

  app.getWebVowlController = function () {
    return webVowlController;
  };

  app.dispose = function () {
    viewControlsLifecycleController.abort();
    unsubscribeFromControllerState?.();
    unsubscribeFromControllerState = undefined;
    webVowlController.dispose();
    svgArtifactDownloadAdapter.dispose();
  };
  // app.afterInitializationCallback=undefined;

  let executeFileDrop = false;
  let wasMessageToShow = false;
  let firstTime = false;
  let initialTouchZoomHandled = false;
  let resizeAnimationFrame;
  let graphResizeObserver;

  function addFileDropEvents(selector) {
    const node = document.querySelector(selector);

    node.ondragover = function (e) {
      e.preventDefault();

      document.querySelector("#dragDropContainer").classList.remove("hidden");
      // get svg size
      const w = graph.options().width();
      const h = graph.options().height();

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
      const w = graph.options().width();
      const h = graph.options().height();

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
      const should_show = graph
        .options()
        .loadingModule()
        .getMessageVisibilityStatus();
      if (should_show === false) {
        document.querySelector("#loading-info").classList.add("hidden"); // hide it
      }
    };
  }

  async function initializeNativeApplicationUiModules() {
    const [
      { createDirectInputModule },
      { createEditSidebar },
      { createLeftSidebar },
      { createLoadingModule },
      { createSidebar },
      { createWarningModule },
    ] = await nativeApplicationUiModuleNamespacesPromise;

    directInputModule = createDirectInputModule(graph, {
      webVowlController,
    });
    editSidebar = createEditSidebar(graph, {
      elementTools,
      languageTools,
      prefixModule,
    });
    leftSidebar = createLeftSidebar(graph);
    loadingModule = createLoadingModule(graph, { webVowlController });
    sidebar = createSidebar(graph, {
      elementTools,
      languageConstants,
      languageTools,
      webVowlController,
    });
    warningModule = createWarningModule(graph, { webVowlController });
    selectionDetailDisplayer = createSelectionDetailsDisplayer(
      sidebar.updateSelectionInformation,
    );
  }

  app.initialize = async function () {
    await initializeNativeApplicationUiModules();
    addFileDropEvents(GRAPH_SELECTOR);

    window.requestAnimationFrame =
      window.requestAnimationFrame ||
      window.mozRequestAnimationFrame ||
      window.webkitRequestAnimationFrame ||
      window.msRequestAnimationFrame ||
      function (f) {
        return setTimeout(f, 1000 / 60);
      }; // simulate calling code 60
    window.cancelAnimationFrame =
      window.cancelAnimationFrame ||
      window.mozCancelAnimationFrame ||
      function (requestID) {
        clearTimeout(requestID);
      }; //fall back

    renderedGraphSettings.graphContainerSelector(GRAPH_SELECTOR);
    renderedGraphSettings.selectionModules().push(focuser);
    renderedGraphSettings.selectionModules().push(selectionDetailDisplayer);
    renderedGraphSettings.selectionModules().push(pickAndPin);

    renderedGraphSettings.filterModules().push(emptyLiteralFilter);
    renderedGraphSettings.filterModules().push(statistics);

    renderedGraphSettings.filterModules().push(nodeDegreeFilter);
    renderedGraphSettings.filterModules().push(datatypeFilter);
    renderedGraphSettings.filterModules().push(objectPropertyFilter);
    renderedGraphSettings.filterModules().push(subclassFilter);
    renderedGraphSettings.filterModules().push(disjointFilter);
    renderedGraphSettings.filterModules().push(setOperatorFilter);
    renderedGraphSettings.filterModules().push(nodeScalingSwitch);
    renderedGraphSettings.filterModules().push(compactNotationSwitch);
    renderedGraphSettings.filterModules().push(colorExternalsSwitch);

    window.addEventListener("resize", scheduleSizeAdjustment);

    const graphHost = document.querySelector(GRAPH_SELECTOR);
    if (
      !graphResizeObserver &&
      graphHost &&
      typeof ResizeObserver !== "undefined"
    ) {
      graphResizeObserver = new ResizeObserver(scheduleSizeAdjustment);
      graphResizeObserver.observe(graphHost);
    }

    graph.addEventListener("zoomchange", (e) =>
      zoomSlider.updateZoomSliderValue(e.detail.value),
    );
    graph.addEventListener("dictionarychange", () =>
      searchMenu.requestDictionaryUpdate(),
    );
    graph.addEventListener("updatelocatebutton", (e) =>
      searchMenu.updateLocateButtonVisibility(e.detail.visible),
    );
    graph.addEventListener("elementfocused", (e) =>
      focuser.handle(e.detail.element),
    );
    graph.addEventListener("editorchange", (e) => {
      const isEditMode = e.detail.value;
      modeMenu.syncEditorState(isEditMode);
      if (isEditMode) {
        leftSidebar.hideCollapseButton(false);
        leftSidebar.showSidebar(1);
        editSidebar.updatePrefixUi();
        editSidebar.updateElementWidth();
      } else {
        leftSidebar.showSidebar(0);
        leftSidebar.hideCollapseButton(true);
      }
      sidebar.updateShowedInformation();
      editSidebar.updateElementWidth();
    });
    graph.addEventListener("urloptions", (e) => {
      const opts = e.detail.opts;
      const changeEditFlag = e.detail.changeEditFlag;

      if (opts.sidebar !== undefined) {
        sidebar.showSidebar(parseInt(opts.sidebar), true);
      }
      if (opts.doc) {
        const asInt = parseInt(opts.doc);
        filterMenu.setDegreeSliderValue(asInt);
        graph.options().setGlobalDOF(asInt);
      }
      let settingFlag;
      if (opts.editorMode) {
        settingFlag = opts.editorMode === "true";
        const editorCheckbox = document.querySelector(
          "#editorModeModuleCheckbox",
        );
        if (editorCheckbox) {
          editorCheckbox.checked = settingFlag;
        }
        if (changeEditFlag) {
          graph.editorMode(settingFlag);
        }
      }
      if (opts.cd) {
        graph.options().classDistance(opts.cd);
      }
      if (opts.dd) {
        graph.options().datatypeDistance(opts.dd);
      }

      if (opts.filter_datatypes) {
        settingFlag = opts.filter_datatypes === "true";
        filterMenu.setCheckBoxValue("datatypeFilterCheckbox", settingFlag);
      }
      if (opts.debugFeatures) {
        settingFlag = opts.debugFeatures === "true";
        graph.ontologyEditingState().setHideDebugFeatures(settingFlag);
        if (graph.ontologyEditingState().getHideDebugFeatures() === false) {
          graph.ontologyEditingState().executeHiddenDebugFeatures();
        }
      }

      if (opts.filter_objectProperties) {
        settingFlag = opts.filter_objectProperties === "true";
        filterMenu.setCheckBoxValue(
          "objectPropertyFilterCheckbox",
          settingFlag,
        );
      }
      if (opts.filter_sco) {
        settingFlag = opts.filter_sco === "true";
        filterMenu.setCheckBoxValue("subclassFilterCheckbox", settingFlag);
      }
      if (opts.filter_disjoint) {
        settingFlag = opts.filter_disjoint === "true";
        filterMenu.setCheckBoxValue("disjointFilterCheckbox", settingFlag);
      }
      if (opts.filter_setOperator) {
        settingFlag = opts.filter_setOperator === "true";
        filterMenu.setCheckBoxValue("setoperatorFilterCheckbox", settingFlag);
      }
      filterMenu.updateSettings();

      if (opts.mode_dynamic) {
        settingFlag = opts.mode_dynamic === "true";
        modeMenu.setDynamicLabelWidth(settingFlag);
        graph.options().dynamicLabelWidth(settingFlag);
      }
      if (opts.mode_pnp) {
        settingFlag = opts.mode_pnp === "true";
        modeMenu.setCheckBoxValue("pickandpinModuleCheckbox", settingFlag);
      }
      if (opts.mode_scaling) {
        settingFlag = opts.mode_scaling === "true";
        modeMenu.setCheckBoxValue("nodescalingModuleCheckbox", settingFlag);
      }
      if (opts.mode_compact) {
        settingFlag = opts.mode_compact === "true";
        modeMenu.setCheckBoxValue("compactnotationModuleCheckbox", settingFlag);
      }
      if (opts.mode_colorExt) {
        settingFlag = opts.mode_colorExt === "true";
        modeMenu.setCheckBoxValue("colorexternalsModuleCheckbox", settingFlag);
      }
      if (opts.mode_multiColor) {
        settingFlag = opts.mode_multiColor === "true";
        modeMenu.setColorSwitchStateUsingURL(settingFlag);
      }
      modeMenu.updateSettingsUsingURL();
      graph.options().rectangularRepresentation(opts.rect);
    });

    graph.addEventListener("fpsupdate", (e) => {
      const debugContainer = document.querySelector("#FPS_Statistics");
      if (debugContainer) {
        debugContainer.innerHTML =
          "FPS: " +
          e.detail.fps +
          "<br>" +
          "Nodes: " +
          e.detail.nodes +
          "<br>" +
          "Links: " +
          e.detail.links;
      }
    });
    graph.addEventListener("editor-element-keyup", (e) => {
      if (e.detail.syncedIRI !== null) {
        document.querySelector("#element_iriEditor").title = e.detail.syncedIRI;
        document.querySelector("#element_iriEditor").value =
          e.detail.prefixedIri || e.detail.syncedIRI;
      }
      document.querySelector("#element_labelEditor").value = e.detail.label;
    });
    renderedGraphSettings.focuserModule(focuser);
    renderedGraphSettings.pausedMenu(pauseMenu);
    renderedGraphSettings.resetMenu(resetMenu);

    exportMenu.setup();
    gravityMenu.setup();
    filterMenu.setup(
      datatypeFilter,
      objectPropertyFilter,
      subclassFilter,
      disjointFilter,
      setOperatorFilter,
      nodeDegreeFilter,
    );
    modeMenu.setup(
      pickAndPin,
      nodeScalingSwitch,
      compactNotationSwitch,
      colorExternalsSwitch,
    );
    registerApplicationUiModule("loadingModule", loadingModule);
    registerApplicationUiModule("warningModule", warningModule);
    registerApplicationUiModule("sidebar", sidebar);
    registerApplicationUiModule("ontologyMenu", ontologyMenu);
    registerApplicationUiModule("exportMenu", exportMenu);
    registerApplicationUiModule("searchMenu", searchMenu);
    registerApplicationUiModule("zoomSlider", zoomSlider);
    registerApplicationUiModule("directInputModule", directInputModule);
    pauseMenu.setup();
    sidebar.setup();
    loadingModule.setup();
    // Presentation modules render controller state rather than being called
    // from inside the renderer.
    unsubscribeFromControllerState = webVowlController.subscribeToState(
      (controllerState) => {
        loadingModule.renderControllerState(controllerState);
        pauseMenu.renderGraphLayoutPaused(
          controllerState.layout?.status === "paused",
        );
        if (Array.isArray(controllerState.selection)) {
          searchMenu.renderSelectedOntologyElements(controllerState.selection);
        }
        if (controllerState.status === "ready") {
          sidebar.renderOntologySummary(webVowlController.getOntologySummary());
        }
      },
    );
    leftSidebar.setup();
    editSidebar.setup();
    debugMenu.setup();
    document.querySelector("#logo").classList.remove("hidden");
    resetMenu.setup([
      gravityMenu,
      filterMenu,
      modeMenu,
      focuser,
      selectionDetailDisplayer,
    ]);
    searchMenu.setup();
    navigationMenu.setup();
    zoomSlider.setup();

    // give the options the pointer to the some menus for import and export
    renderedGraphSettings.literalFilter(emptyLiteralFilter);
    renderedGraphSettings.nodeDegreeFilter(nodeDegreeFilter);
    renderedGraphSettings.filterMenu(filterMenu);
    renderedGraphSettings.modeMenu(modeMenu);
    renderedGraphSettings.gravityMenu(gravityMenu);
    renderedGraphSettings.pausedMenu(pauseMenu);
    renderedGraphSettings.pickAndPinModule(pickAndPin);
    renderedGraphSettings.resetMenu(resetMenu);
    renderedGraphSettings.navigationMenu(navigationMenu);
    renderedGraphSettings.leftSidebar(leftSidebar);
    renderedGraphSettings.editSidebar(editSidebar);
    renderedGraphSettings.graphObject(graph);
    renderedGraphSettings.datatypeFilter(datatypeFilter);
    renderedGraphSettings.objectPropertyFilter(objectPropertyFilter);
    renderedGraphSettings.subclassFilter(subclassFilter);
    renderedGraphSettings.setOperatorFilter(setOperatorFilter);
    renderedGraphSettings.disjointPropertyFilter(disjointFilter);

    renderedGraphSettings.colorExternalsModule(colorExternalsSwitch);
    renderedGraphSettings.compactNotationModule(compactNotationSwitch);
    renderedGraphSettings.nodeScalingModule(nodeScalingSwitch);

    ontologyMenu.setup();
    configMenu.setup(zoomSlider);
    loadingModule.refreshControlAvailability();

    leftSidebar.showSidebar(0);
    leftSidebar.hideCollapseButton(true);

    graph.start();

    adjustSize();
    const w = graph.options().width();
    const h = graph.options().height();
    const defZoom = Math.min(w, h) / 1000;

    const hideDebugOptions = true;
    if (hideDebugOptions === false) {
      graph.setForceTickFunctionWithFPS();
    }

    graph.setDefaultZoom(defZoom);
    document
      .querySelectorAll(".debugOption")
      .forEach((el) => el.classList.toggle("hidden", hideDebugOptions));

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
        graph.ontologyEditingState().executeHiddenDebugFeatuers();
        event.preventDefault();
      }
    });
    if (document.querySelector("#maxLabelWidthSliderOption")) {
      const setValue = !graph.options().dynamicLabelWidth();
      document.querySelector("#maxLabelWidthSlider").disabled = setValue;
      document
        .querySelector("#maxLabelWidthSliderValue")
        .classList.toggle("disabledLabelForSlider", setValue);
      document
        .querySelector("#maxLabelWidthDescriptionLabel")
        .classList.toggle("disabledLabelForSlider", setValue);
    }

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
    ontologyEditingState.prefixModule(prefixModule);
    adjustSize();
    sidebar.updateOntologyInformation(undefined, statistics);
    // The location names the ontology to show; the controller loads it.
    loadingModule.loadRemoteSource({
      source: loadingModule.ontologySourceFromLocation(),
    });
    renderedGraphSettings.debugMenu(debugMenu);
    debugMenu.updateSettings();

    // connect the reloadCachedVersionButton
    const reloadCachedOntologyBtn = document.getElementById(
      "reloadCachedOntology",
    );
    if (reloadCachedOntologyBtn) {
      reloadCachedOntologyBtn.addEventListener("click", function () {
        if (reloadCachedOntologyBtn.disabled) {
          ontologyMenu.clearCachedVersion();
          return;
        }
        reloadCachedOntologyBtn.classList.add("hidden");
        ontologyMenu.reloadCachedOntology();
      });
    }
    // add the initialized objects
  };

  function scheduleSizeAdjustment() {
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
    const viewport = graph.updateCanvasContainerSize();

    graph.updateStyle();

    if (isTouchDevice() === true) {
      if (graph.isEditorMode() === true) {
        document.querySelector("#modeOfOperationString").innerHTML =
          "touch able device detected";
      }
      graph.setTouchDevice(true);

      if (!initialTouchZoomHandled && isMultiTouchZoomDevice()) {
        initialTouchZoomHandled = true;
        configMenu.setCheckBoxValue("showZoomSliderConfigCheckbox", false);
      }
    } else {
      if (graph.isEditorMode() === true) {
        document.querySelector("#modeOfOperationString").innerHTML =
          "point & click device detected";
      }
      graph.setTouchDevice(false);
    }

    loadingModule.checkForScreenSize();

    adjustSliderSize(viewport.height);

    navigationMenu.updateScrollButtonVisibility();

    // adjust height of the leftSidebar element;
    editSidebar.updateElementWidth();

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
