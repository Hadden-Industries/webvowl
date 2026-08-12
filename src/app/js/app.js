String.prototype.replaceAll = function (search, replacement) {
  const target = this;
  return target.split(search).join(replacement);
};
module.exports = function () {
  const app = {},
    graph = require("../../webvowl/js/graph")(),
    options = graph.graphOptions(),
    languageTools = require("../../shared/js/util/languageTools")(),
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
    colorExternalsSwitch =
      require("../../shared/js/modules/colorExternalsSwitch")(graph),
    compactNotationSwitch =
      require("../../shared/js/modules/compactNotationSwitch")(graph),
    datatypeFilter = require("../../shared/js/modules/datatypeFilter")(),
    disjointFilter = require("../../shared/js/modules/disjointFilter")(),
    focuser = require("../../shared/js/modules/focuser")(graph),
    emptyLiteralFilter =
      require("../../shared/js/modules/emptyLiteralFilter")(),
    nodeDegreeFilter = require("../../shared/js/modules/nodeDegreeFilter")(
      filterMenu,
    ),
    nodeScalingSwitch = require("../../shared/js/modules/nodeScalingSwitch")(
      graph,
    ),
    objectPropertyFilter =
      require("../../shared/js/modules/objectPropertyFilter")(),
    pickAndPin = require("../../shared/js/modules/pickAndPin")(),
    selectionDetailDisplayer =
      require("../../shared/js/modules/selectionDetailsDisplayer")(
        sidebar.updateSelectionInformation,
      ),
    statistics = require("../../shared/js/modules/statistics")(),
    subclassFilter = require("../../shared/js/modules/subclassFilter")(),
    setOperatorFilter = require("../../shared/js/modules/setOperatorFilter")();

  app.getOptions = function () {
    return options;
  };
  app.getGraph = function () {
    return graph;
  };
  // app.afterInitializationCallback=undefined;

  let executeFileDrop = false;
  let wasMessageToShow = false;
  let firstTime = false;

  function addFileDropEvents(selector) {
  let resizeAnimationFrame;
  let graphResizeObserver;
    const node = document.querySelector(selector);

    node.ondragover = function (e) {
  var initialTouchZoomHandled = false;
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
              loadingModule.fromFileDrop(file.name, file);
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
    if ( !graphResizeObserver && graphHost && typeof ResizeObserver !== "undefined" ) {
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
        graph.options().setHideDebugFeatures(settingFlag);
        if (graph.options().getHideDebugFeatures() === false) {
          graph.options().executeHiddenDebugFeatures();
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
    const agentVersion = getInternetExplorerVersion();
    if (agentVersion > 0 && agentVersion <= 11) {
      console.warn("Agent version " + agentVersion);
      console.warn("This agent is not supported");
      d3.select("#browserCheck").classed("hidden", false);
      d3.select("#killWarning").classed("hidden", true);
      d3.select("#optionsArea").classed("hidden", true);
      d3.select("#logo").classed("hidden", true);
    } else {
      d3.select("#logo").classed("hidden", false);
      if (agentVersion === 12) {
        // allow Mircosoft Edge Browser but with warning
        d3.select("#browserCheck").classed("hidden", false);
        d3.select("#killWarning").classed("hidden", false);
      } else {
        d3.select("#browserCheck").classed("hidden", true);
      }

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
      options.searchMenu(searchMenu);
      options.ontologyMenu(ontologyMenu);
      options.navigationMenu(navigationMenu);
      options.sidebar(sidebar);
      options.leftSidebar(leftSidebar);
      options.editSidebar(editSidebar);
      options.exportMenu(exportMenu);
      options.graphObject(graph);
      options.zoomSlider(zoomSlider);
      options.warningModule(warningModule);
      options.directInputModule(directInputMod);
      options.datatypeFilter(datatypeFilter);
      options.objectPropertyFilter(objectPropertyFilter);
      options.subclassFilter(subclassFilter);
      options.setOperatorFilter(setOperatorFilter);
      options.disjointPropertyFilter(disjointFilter);
      options.focuserModule(focuser);
      options.colorExternalsModule(colorExternalsSwitch);
      options.compactNotationModule(compactNotationSwitch);
      options.nodeScalingModule(nodeScalingSwitch);

      ontologyMenu.setup(loadOntologyFromText);
      configMenu.setup();
      loadingModule.refreshControlAvailability();

      leftSidebar.showSidebar(0);
      leftSidebar.hideCollapseButton(true);

      graph.start();

      const modeOp = d3.select("#modeOfOperationString");
      modeOp.style("font-size", "0.6em");
      modeOp.style("font-style", "italic");

      adjustSize();

      const w = graph.options().width();
      const h = graph.options().height();
      const defZoom = Math.min(w, h) / 1000;

      const hideDebugOptions = true;
      if (hideDebugOptions === false) {
        graph.setForceTickFunctionWithFPS();
      }

      graph.setDefaultZoom(defZoom);
      d3.selectAll(".debugOption").classed("hidden", hideDebugOptions);

      // prevent backspace reloading event
      const htmlBody = d3.select("body");
      d3.select(document).on("keydown", function (e) {
        if (d3.event.keyCode === 8 && d3.event.target === htmlBody.node()) {
          // we could add here an alert
          event.preventDefault();
        }
        // using ctrl+Shift+d as debug option
        if (d3.event.ctrlKey && d3.event.shiftKey && d3.event.keyCode === 68) {
          graph.options().executeHiddenDebugFeatuers();
          event.preventDefault();
        }
      });
      if (d3.select("#maxLabelWidthSliderOption")) {
        const setValue = !graph.options().dynamicLabelWidth();
        d3.select("#maxLabelWidthSlider").node().disabled = setValue;
        d3.select("#maxLabelWidthvalueLabel").classed(
          "disabledLabelForSlider",
          setValue,
        );
        d3.select("#maxLabelWidthDescriptionLabel").classed(
          "disabledLabelForSlider",
          setValue,
        );
      }

      d3.select("#blockGraphInteractions")
        .style("position", "absolute")
        .style("top", "0")
        .style("background-color", "#bdbdbd")
        .style("opacity", "0.5")
        .style("pointer-events", "auto")
        .style("width", graph.options().width() + "px")
        .style("height", graph.options().height() + "px")
        .on("click", function () {
          d3.event.preventDefault();
          d3.event.stopPropagation();
        })
        .on("dblclick", function () {
          d3.event.preventDefault();
          d3.event.stopPropagation();
        });

      d3.select("#direct-text-input").on("click", function () {
        directInputMod.setDirectInputMode();
      });
      blockGraphInteractions.addEventListener("dblclick", function (event) {
        event.preventDefault();
        event.stopPropagation();
      });
      blockGraphInteractions.draggable = false;
    }
      d3.select("#blockGraphInteractions").node().draggable = false;
      options.prefixModule(webvowl.util.prefixTools(graph));
      adjustSize();
      sidebar.updateOntologyInformation(undefined, statistics);
      loadingModule.parseUrlAndLoadOntology(); // loads automatically the ontology provided by the parameters
      options.debugMenu(debugMenu);
      debugMenu.updateSettings();

      // connect the reloadCachedVersionButton
      d3.select("#reloadSvgIcon").on("click", function () {
        if (d3.select("#reloadSvgIcon").node().disabled === true) {
          ontologyMenu.clearCachedVersion();
          return;
        }
        d3.select("#reloadCachedOntology").classed("hidden", true);
        ontologyMenu.reloadCachedOntology();
      });
      // add the initialized objects
      webvowl.opts = options;
      webvowl.gr = graph;
    }
  };

  function loadOntologyFromText(jsonText, filename, alternativeFilename) {
    const reloadCachedOntologyBtn = document.getElementById("reloadCachedOntology");
    if ( reloadCachedOntologyBtn ) {
      reloadCachedOntologyBtn.classList.add("hidden");
    }
    pauseMenu.reset();
    navigationMenu.hideAllMenus();

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
      newOntologyCounter++;
      d3.select("#empty").node().href =
        "#opts=editorMode=true;#new_ontology" + newOntologyCounter;
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
      loadingModule.setPercentMode();
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

  function adjustSize() {
    const graphContainer = d3.select(GRAPH_SELECTOR);
    const svg = graphContainer.select("svg");
    let height = window.innerHeight - 40;
    let width = window.innerWidth - window.innerWidth * 0.22;

    if (sidebar.getSidebarVisibility() === "0") {
    var isMobileOrTablet = window.innerWidth <= 1024;
      height = window.innerHeight - 40;
      width = window.innerWidth;
    }

  function scheduleSizeAdjustment(){
    if ( resizeAnimationFrame !== undefined ) {
      cancelAnimationFrame(resizeAnimationFrame);
    }
    resizeAnimationFrame = requestAnimationFrame(function (){
      resizeAnimationFrame = undefined;
      adjustSize();
    });
  }

    directInputMod.updateLayout();
    d3.select("#blockGraphInteractions").style(
      "width",
      window.innerWidth + "px",
    );
    d3.select("#blockGraphInteractions").style(
      "height",
      window.innerHeight + "px",
    );

    d3.select("#WarningErrorMessagesContainer").style("width", width + "px");
    d3.select("#WarningErrorMessagesContainer").style("height", height + "px");

    d3.select("#WarningErrorMessages").style("max-height", height - 12 + "px");

    graphContainer.style("height", height + "px");
    svg.attr("width", width).attr("height", height);

    options.width(width).height(height);

    graph.updateStyle();

    if (isTouchDevice() === true) {
      if (graph.isEditorMode() === true) {
        document.querySelector("#modeOfOperationString").innerHTML =
          "touch able device detected";
      }
      graph.setTouchDevice(true);
      if ( !initialTouchZoomHandled && isMultiTouchZoomDevice() ) {
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

    d3.select("#loadingInfo-container").style(
      "height",
      0.5 * (height - 80) + "px",
    );
    loadingModule.checkForScreenSize();

    adjustSliderSize(viewport.height);
    // update also the padding options of loading and the logo positions;
    const warningDiv = d3.select("#browserCheck");
    if (warningDiv.classed("hidden") === false) {
      const offset = 10 + warningDiv.node().getBoundingClientRect().height;
      d3.select("#logo").style("padding", offset + "px 10px");
    } else {
      // remove the dynamic padding from the logo element;
      d3.select("#logo").style("padding", "10px");
    }

    // scrollbar tests;
    const element = d3.select("#menuElementContainer").node();
    const maxScrollLeft = element.scrollWidth - element.clientWidth;
    const leftButton = d3.select("#scrollLeftButton");
    const rightButton = d3.select("#scrollRightButton");
    if (maxScrollLeft > 0) {
      // show both and then check how far is bar;
      rightButton.classed("hidden", false);
      leftButton.classed("hidden", false);
      navigationMenu.updateScrollButtonVisibility();
    } else {
      // hide both;
      rightButton.classed("hidden", true);
      leftButton.classed("hidden", true);
    }

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

  function adjustSliderSize() {
    // TODO: refactor and put this into the slider it self
    const height = window.innerHeight - 40;
    const fullHeight = height;
    const zoomOutPos = height - 30;
    const sliderHeight = 150;

    // assuming DOM elements are generated in the index.html
    // todo: refactor for independent usage of graph and app
    if (fullHeight < 150) {
      document.querySelector("#zoomSlider").classList.add("hidden");
    } else {
      document.querySelector("#zoomSlider").classList.remove("hidden");
    }
    d3.select("#zoomSliderParagraph").classed("hidden", false);
    d3.select("#zoomOutButton").classed("hidden", false);
    d3.select("#zoomInButton").classed("hidden", false);
    d3.select("#centerGraphButton").classed("hidden", false);

    let zoomInPos = zoomOutPos - 20;
    let centerPos = zoomInPos - 20;
    if (fullHeight < 280) {
      // hide the slider button;
      d3.select("#zoomSliderParagraph").classed("hidden", true); //var sliderPos=zoomOutPos-sliderHeight;
      d3.select("#zoomOutButton").style("top", zoomOutPos + "px");
      d3.select("#zoomInButton").style("top", zoomInPos + "px");
      d3.select("#centerGraphButton").style("top", centerPos + "px");
      return;
    }

    const sliderPos = zoomOutPos - sliderHeight;
    zoomInPos = sliderPos - 20;
    centerPos = zoomInPos - 20;
    d3.select("#zoomSliderParagraph").classed("hidden", false);
    d3.select("#zoomOutButton").style("top", zoomOutPos + "px");
    d3.select("#zoomInButton").style("top", zoomInPos + "px");
    d3.select("#centerGraphButton").style("top", centerPos + "px");
    d3.select("#zoomSliderParagraph").style("top", sliderPos + "px");
  }

  function isTouchDevice() {
    try {
      return ('ontouchstart' in window) || 
             (navigator.maxTouchPoints && navigator.maxTouchPoints > 0) || 
             (navigator.msMaxTouchPoints && navigator.msMaxTouchPoints > 0);
    } catch (_e) {
      return false;
    }
  }

  function getInternetExplorerVersion() {
    let ua,
      re,
      rv = -1;

    // check for edge
    const isEdge =
      /(?:\b(MS)?IE\s+|\bTrident\/7\.0;.*\s+rv:|\bEdge\/)(\d+)/.test(
        navigator.userAgent,
      );
    if (isEdge) {
      rv = parseInt("12");
      return rv;
    }

    const isIE11 = /Trident.*rv[ :]*11\./.test(navigator.userAgent);
    if (isIE11) {
      rv = parseInt("11");
      return rv;
    }
    if (navigator.appName === "Microsoft Internet Explorer") {
      ua = navigator.userAgent;
      re = new RegExp("MSIE ([0-9]{1,}[\\.0-9]{0,})");
      if (re.exec(ua) !== null) {
        rv = parseFloat(RegExp.$1);
      }
    } else if (navigator.appName === "Netscape") {
      ua = navigator.userAgent;
      re = new RegExp("Trident/.*rv:([0-9]{1,}[\\.0-9]{0,})");
      if (re.exec(ua) !== null) {
        rv = parseFloat(RegExp.$1);
      }
    }
    return rv;
  }

  return app;
};
