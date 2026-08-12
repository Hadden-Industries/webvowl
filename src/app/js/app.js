String.prototype.replaceAll = function (search, replacement) {
  const target = this;
  return target.split(search).join(replacement);
};
module.exports = function () {
  const app = {},
    graph = webvowl.graph(),
    options = graph.graphOptions(),
    languageTools = webvowl.util.languageTools(),
    GRAPH_SELECTOR = "#graph",
    // Modules for the webvowl app
    exportMenu = require("./menu/exportMenu")(graph),
    filterMenu = require("./menu/filterMenu")(graph),
    gravityMenu = require("./menu/gravityMenu")(graph),
    modeMenu = require("./menu/modeMenu")(graph),
    debugMenu = require("./menu/debugMenu")(graph),
    ontologyMenu = require("./menu/ontologyMenu")(graph),
    pauseMenu = require("./menu/pauseMenu")(graph),
    resetMenu = require("./menu/resetMenu")(graph),
    searchMenu = require("./menu/searchMenu")(graph),
    navigationMenu = require("./menu/navigationMenu")(graph),
    zoomSlider = require("./menu/zoomSlider")(graph),
    sidebar = require("./sidebar")(graph),
    leftSidebar = require("./leftSidebar")(graph),
    editSidebar = require("./editSidebar")(graph),
    configMenu = require("./menu/configMenu")(graph),
    loadingModule = require("./loadingModule")(graph),
    warningModule = require("./warningModule")(graph),
    directInputMod = require("./directInputModule")(graph),
    // Graph modules
    colorExternalsSwitch = webvowl.modules.colorExternalsSwitch(graph),
    compactNotationSwitch = webvowl.modules.compactNotationSwitch(graph),
    datatypeFilter = webvowl.modules.datatypeFilter(),
    disjointFilter = webvowl.modules.disjointFilter(),
    focuser = webvowl.modules.focuser(graph),
    emptyLiteralFilter = webvowl.modules.emptyLiteralFilter(),
    nodeDegreeFilter = webvowl.modules.nodeDegreeFilter(filterMenu),
    nodeScalingSwitch = webvowl.modules.nodeScalingSwitch(graph),
    objectPropertyFilter = webvowl.modules.objectPropertyFilter(),
    pickAndPin = webvowl.modules.pickAndPin(),
    selectionDetailDisplayer = webvowl.modules.selectionDetailsDisplayer(
      sidebar.updateSelectionInformation,
    ),
    statistics = webvowl.modules.statistics(),
    subclassFilter = webvowl.modules.subclassFilter(),
    setOperatorFilter = webvowl.modules.setOperatorFilter();

  app.getOptions = function () {
    return webvowl.opts;
  };
  app.getGraph = function () {
    return webvowl.gr;
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
        // d3.select("#drag_svg").transition()
        //   .duration(100)
        //   // .attr("-webkit-transform", "rotate(90)")
        //   // .attr("-moz-transform",    "rotate(90)")
        //   // .attr("-o-transform",      "rotate(90)")
        //   .attr("transform",         "rotate(90)");

        document.querySelector("#drag_icon").classList.add("hidden");
        document.querySelector("#drag_icon_drop").classList.remove("hidden");
      } else {
        document.querySelector("#drag_msg_text").innerHTML =
          "Drag ontology file here.";
        document.querySelector("#drag_msg").classList.remove("drag-over");
        executeFileDrop = false;

        document.querySelector("#drag_icon").classList.remove("hidden");
        document.querySelector("#drag_icon_drop").classList.add("hidden");

        // d3.select("#drag_svg").transition()
        //   .duration(100)
        //   // .attr("-webkit-transform", "rotate(0)")
        //   // .attr("-moz-transform",    "rotate(0)")
        //   // .attr("-o-transform",      "rotate(0)")
        //   .attr("transform",         "rotate(0)");
        //
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
              graph.options().loadingModule().fromFileDrop(file.name, file);
            }
          } else {
            //  >> WARNING not multiple file uploaded;
            graph.options().warningModule().showMultiFileUploadWarning();
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

  app.initialize = function () {
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

    options.graphContainerSelector(GRAPH_SELECTOR);
    options.selectionModules().push(focuser);
    options.selectionModules().push(selectionDetailDisplayer);
    options.selectionModules().push(pickAndPin);

    options.filterModules().push(emptyLiteralFilter);
    options.filterModules().push(statistics);

    options.filterModules().push(nodeDegreeFilter);
    options.filterModules().push(datatypeFilter);
    options.filterModules().push(objectPropertyFilter);
    options.filterModules().push(subclassFilter);
    options.filterModules().push(disjointFilter);
    options.filterModules().push(setOperatorFilter);
    options.filterModules().push(nodeScalingSwitch);
    options.filterModules().push(compactNotationSwitch);
    options.filterModules().push(colorExternalsSwitch);

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
    graph.addEventListener("searchcleared", () => searchMenu.clearText());
    graph.addEventListener("updatelocatebutton", (e) =>
      searchMenu.updateLocateButtonVisibility(e.detail.visible),
    );
    graph.addEventListener("elementfocused", (e) =>
      focuser.handle(e.detail.element),
    );
    graph.addEventListener("editorchange", (e) =>
      modeMenu.syncEditorState(e.detail.value),
    );
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

    options.searchMenu(searchMenu);
    options.focuserModule(focuser);
    options.zoomSlider(zoomSlider);
    options.pausedMenu(pauseMenu);
    options.resetMenu(resetMenu);

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
    pauseMenu.setup();
    sidebar.setup();
    loadingModule.setup();
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
      pauseMenu,
    ]);
    searchMenu.setup();
    navigationMenu.setup();
    zoomSlider.setup();

    // give the options the pointer to the some menus for import and export
    options.literalFilter(emptyLiteralFilter);
    options.nodeDegreeFilter(nodeDegreeFilter);
    options.loadingModule(loadingModule);
    options.filterMenu(filterMenu);
    options.modeMenu(modeMenu);
    options.gravityMenu(gravityMenu);
    options.pausedMenu(pauseMenu);
    options.pickAndPinModule(pickAndPin);
    options.resetMenu(resetMenu);

    options.ontologyMenu(ontologyMenu);
    options.navigationMenu(navigationMenu);
    options.sidebar(sidebar);
    options.leftSidebar(leftSidebar);
    options.editSidebar(editSidebar);
    options.exportMenu(exportMenu);
    options.graphObject(graph);

    options.warningModule(warningModule);
    options.directInputModule(directInputMod);
    options.datatypeFilter(datatypeFilter);
    options.objectPropertyFilter(objectPropertyFilter);
    options.subclassFilter(subclassFilter);
    options.setOperatorFilter(setOperatorFilter);
    options.disjointPropertyFilter(disjointFilter);

    options.colorExternalsModule(colorExternalsSwitch);
    options.compactNotationModule(compactNotationSwitch);
    options.nodeScalingModule(nodeScalingSwitch);

    ontologyMenu.setup(loadOntologyFromText);
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
        graph.options().executeHiddenDebugFeatuers();
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
        directInputMod.setDirectInputMode();
      });
    }
    options.prefixModule(webvowl.util.prefixTools(graph));
    adjustSize();
    sidebar.updateOntologyInformation(undefined, statistics);
    loadingModule.parseUrlAndLoadOntology(); // loads automatically the ontology provided by the parameters
    options.debugMenu(debugMenu);
    debugMenu.updateSettings();

    // connect the reloadCachedVersionButton
    const reloadCachedOntologyBtn = document.getElementById(
      "reloadCachedOntology",
    );
    if (reloadCachedOntologyBtn) {
      reloadCachedOntologyBtn.addEventListener("click", function () {
        if (reloadCachedOntologyBtn.disabled) {
          graph.options().ontologyMenu().clearCachedVersion();
          return;
        }
        reloadCachedOntologyBtn.classList.add("hidden");
        graph.options().ontologyMenu().reloadCachedOntology();
      });
    }
    // add the initialized objects
    webvowl.opts = options;
    webvowl.gr = graph;
  };

  function loadOntologyFromText(jsonText, filename, alternativeFilename) {
    const reloadCachedOntologyBtn = document.getElementById(
      "reloadCachedOntology",
    );
    if (reloadCachedOntologyBtn) {
      reloadCachedOntologyBtn.classList.add("hidden");
    }
    pauseMenu.reset();
    graph.options().navigationMenu().hideAllMenus();

    if (
      (jsonText === undefined && filename === undefined) ||
      jsonText.length === 0
    ) {
      loadingModule.notValidJsonFile();
      return;
    }
    let data;
    if (jsonText) {
      // validate JSON FILE
      let validJSON;
      try {
        data = JSON.parse(jsonText);
        validJSON = true;
      } catch (_e) {
        validJSON = false;
      }
      if (validJSON === false) {
        // the server output is not a valid json file
        loadingModule.notValidJsonFile();
        return;
      }

      if (!filename) {
        // First look if an ontology title exists, otherwise take the alternative filename
        const ontologyNames = data.header ? data.header.title : undefined;
        const ontologyName = languageTools.textInLanguage(ontologyNames);

        if (ontologyName) {
          filename = ontologyName;
        } else {
          filename = alternativeFilename;
        }
      }
    }

    // check if we have graph data
    let classCount = 0;
    if (data.class !== undefined) {
      classCount = data.class.length;
    }

    let loadEmptyOntologyForEditing = false;
    if (location.hash.indexOf("#new_ontology") !== -1) {
      loadEmptyOntologyForEditing = true;
    }
    if (
      classCount === 0 &&
      graph.editorMode() === false &&
      loadEmptyOntologyForEditing === false
    ) {
      // generate message for the user;
      loadingModule.emptyGraphContentError();
    } else {
      ontologyMenu.setCachedOntology(filename, jsonText);
      exportMenu.setJsonText(jsonText);
      options.data(data);
      loadingModule.validJsonFile();
      graph.options().loadingModule().setPercentMode();
      if (loadEmptyOntologyForEditing === true) {
        graph.editorMode(true);
      }
      graph.load();
      sidebar.updateOntologyInformation(data, statistics);
      exportMenu.setFilename(filename);
      graph.updateZoomSliderValueFromOutside();
      adjustSize();

      const flagOfCheckBox = document.querySelector(
        "#editorModeModuleCheckbox",
      ).checked;
      graph.editorMode(flagOfCheckBox); // update gui
    }
  }

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
    directInputMod.updateLayout();
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
};
