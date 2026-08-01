String.prototype.replaceAll = function ( search, replacement ){
  const target = this;
  return target.split(search).join(replacement);
};
module.exports = function (){
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
    selectionDetailDisplayer = webvowl.modules.selectionDetailsDisplayer(sidebar.updateSelectionInformation),
    statistics = webvowl.modules.statistics(),
    subclassFilter = webvowl.modules.subclassFilter(),
    setOperatorFilter = webvowl.modules.setOperatorFilter();
  
  
  app.getOptions = function (){
    return webvowl.opts;
  };
  app.getGraph = function (){
    return webvowl.gr;
  };
  // app.afterInitializationCallback=undefined;
  
  
  let executeFileDrop = false;
  let wasMessageToShow = false;
  let firstTime = false;
  let initialTouchZoomHandled = false;
  let resizeAnimationFrame;
  let graphResizeObserver;
  
  function addFileDropEvents( selector ){
    const node = d3.select(selector);
    
    node.node().ondragover = function ( e ){
      e.preventDefault();

      d3.select("#dragDropContainer").classed("hidden", false);
      // get svg size
      const w = graph.options().width();
      const h = graph.options().height();
      
      // get event position; (using clientX and clientY);
      const cx = e.clientX;
      const cy = e.clientY;
      
      if ( firstTime === false ) {
        const state = d3.select("#loading-info").classed("hidden");
        wasMessageToShow = !state;
        firstTime = true;
        d3.select("#loading-info").classed("hidden", true); // hide it so it does not conflict with drop event
        const bb=d3.select("#drag_msg").node().getBoundingClientRect();
        const hs = bb.height;
        const ws = bb.width;
        
        let icon_scale=Math.min(hs,ws);
        icon_scale/=100;
        
        d3.select("#drag_icon_group").attr("transform", "translate ( " + 0.25 * ws + " " + 0.25 * hs + ")");
        d3.select("#drag_icon").attr("transform","matrix ("+icon_scale+",0,0,"+icon_scale+",0,0)");
        d3.select("#drag_icon_drop").attr("transform","matrix ("+icon_scale+",0,0,"+icon_scale+",0,0)");
      }
      
      
      if ( (cx > 0.25 * w && cx < 0.75 * w) && (cy > 0.25 * h && cy < 0.75 * h) ) {
        
        d3.select("#drag_msg_text").node().innerHTML = "Drop it here.";
        d3.select("#drag_msg").classed("drag-over", true);
        executeFileDrop = true;
        // d3.select("#drag_svg").transition()
        //   .duration(100)
        //   // .attr("-webkit-transform", "rotate(90)")
        //   // .attr("-moz-transform",    "rotate(90)")
        //   // .attr("-o-transform",      "rotate(90)")
        //   .attr("transform",         "rotate(90)");
  
        d3.select("#drag_icon").classed("hidden",true);
        d3.select("#drag_icon_drop").classed("hidden",false);
  
  
      } else {
        d3.select("#drag_msg_text").node().innerHTML = "Drag ontology file here.";
        d3.select("#drag_msg").classed("drag-over", false);
        executeFileDrop = false;
  
        d3.select("#drag_icon").classed("hidden",false);
        d3.select("#drag_icon_drop").classed("hidden",true);
        
        
        // d3.select("#drag_svg").transition()
        //   .duration(100)
        //   // .attr("-webkit-transform", "rotate(0)")
        //   // .attr("-moz-transform",    "rotate(0)")
        //   // .attr("-o-transform",      "rotate(0)")
        //   .attr("transform",         "rotate(0)");
        //
      }
      
    };
    node.node().ondrop = function ( ev ){
      ev.preventDefault();
      firstTime = false;
      if ( executeFileDrop ) {
        if ( ev.dataTransfer.items ) {
          if ( ev.dataTransfer.items.length === 1 ) {
            if ( ev.dataTransfer.items[0].kind === 'file' ) {
              const file = ev.dataTransfer.items[0].getAsFile();
              graph.options().loadingModule().fromFileDrop(file.name, file);
            }
          }
          else {
            //  >> WARNING not multiple file uploaded;
            graph.options().warningModule().showMultiFileUploadWarning();
          }
        }
      }
      d3.select("#dragDropContainer").classed("hidden", true);
    };
    
    node.node().ondragleave = function ( e ){
      const w = graph.options().width();
      const h = graph.options().height();
      
      // get event position; (using clientX and clientY);
      const cx = e.clientX;
      const cy = e.clientY;
      
      let hidden = false;
      firstTime = false;
      
      if ( cx < 0.1 * w || cx > 0.9 * w ) {hidden = true;}
      if ( cy < 0.1 * h || cy > 0.9 * h ) {hidden = true;}
      d3.select("#dragDropContainer").classed("hidden", hidden);
      
      d3.select("#loading-info").classed("hidden", !wasMessageToShow); // show it again
      // check if it should be visible
      const should_show=graph.options().loadingModule().getMessageVisibilityStatus();
      if (should_show===false){
        d3.select("#loading-info").classed("hidden", true); // hide it
      }
    };
    
  }
  
  
  app.initialize = function (){
    addFileDropEvents(GRAPH_SELECTOR);
    
    window.requestAnimationFrame = window.requestAnimationFrame || window.mozRequestAnimationFrame || window.webkitRequestAnimationFrame || window.msRequestAnimationFrame || function ( f ){
        return setTimeout(f, 1000 / 60);
      }; // simulate calling code 60
    window.cancelAnimationFrame = window.cancelAnimationFrame || window.mozCancelAnimationFrame || function ( requestID ){
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
    
    d3.select(window).on("resize", scheduleSizeAdjustment);

    const graphHost = d3.select(GRAPH_SELECTOR).node();
    if ( !graphResizeObserver && graphHost && typeof ResizeObserver !== "undefined" ) {
      graphResizeObserver = new ResizeObserver(scheduleSizeAdjustment);
      graphResizeObserver.observe(graphHost);
    }
    
    exportMenu.setup();
    gravityMenu.setup();
    filterMenu.setup(datatypeFilter, objectPropertyFilter, subclassFilter, disjointFilter, setOperatorFilter, nodeDegreeFilter);
    modeMenu.setup(pickAndPin, nodeScalingSwitch, compactNotationSwitch, colorExternalsSwitch);
    pauseMenu.setup();
    sidebar.setup();
    loadingModule.setup();
    leftSidebar.setup();
    editSidebar.setup();
    debugMenu.setup();
    const agentVersion = getInternetExplorerVersion();
    if ( agentVersion > 0 && agentVersion <= 11 ) {
      console.warn("Agent version " + agentVersion);
      console.warn("This agent is not supported");
      d3.select("#browserCheck").classed("hidden", false);
      d3.select("#killWarning").classed("hidden", true);
      d3.select("#optionsArea").classed("hidden", true);
      d3.select("#logo").classed("hidden", true);
    } else {
      d3.select("#logo").classed("hidden", false);
      if ( agentVersion === 12 ) {
        // allow Mircosoft Edge Browser but with warning
        d3.select("#browserCheck").classed("hidden", false);
        d3.select("#killWarning").classed("hidden", false);
      } else {
        d3.select("#browserCheck").classed("hidden", true);
      }
      
      resetMenu.setup([gravityMenu, filterMenu, modeMenu, focuser, selectionDetailDisplayer, pauseMenu]);
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
      
      adjustSize();
      const w = graph.options().width();
      const h = graph.options().height();
      const defZoom = Math.min(w, h) / 1000;
      
      const hideDebugOptions = true;
      if ( hideDebugOptions === false ) {
        graph.setForceTickFunctionWithFPS();
      }
      
      graph.setDefaultZoom(defZoom);
      d3.selectAll(".debugOption").classed("hidden", hideDebugOptions);
      
      // prevent backspace reloading event
      const htmlBody = d3.select("body");
      d3.select(document).on("keydown", function ( event ){
        if ( event.key === "Backspace" && event.target === htmlBody.node() ) {
          // we could add here an alert
          event.preventDefault();
        }
        // using ctrl+Shift+d as debug option
        if ( event.ctrlKey && event.shiftKey && event.key && event.key.toLowerCase() === "d" ) {
          graph.options().executeHiddenDebugFeatuers();
          event.preventDefault();
        }
      });
      if ( d3.select("#maxLabelWidthSliderOption") ) {
        const setValue = !graph.options().dynamicLabelWidth();
        d3.select("#maxLabelWidthSlider").node().disabled = setValue;
        d3.select("#maxLabelWidthvalueLabel").classed("disabledLabelForSlider", setValue);
        d3.select("#maxLabelWidthDescriptionLabel").classed("disabledLabelForSlider", setValue);
      }
      
      d3.select("#blockGraphInteractions")
        .on("click", function (event){
          event.preventDefault();
          event.stopPropagation();
        })
        .on("dblclick", function (event){
          event.preventDefault();
          event.stopPropagation();
        });
      
      d3.select("#direct-text-input").on("click", function (){
        directInputMod.setDirectInputMode();
      });
      d3.select("#blockGraphInteractions").node().draggable = false;
      options.prefixModule(webvowl.util.prefixTools(graph));
      adjustSize();
      sidebar.updateOntologyInformation(undefined, statistics);
      loadingModule.parseUrlAndLoadOntology(); // loads automatically the ontology provided by the parameters
      options.debugMenu(debugMenu);
      debugMenu.updateSettings();
      
      // connect the reloadCachedVersionButton
      d3.select("#reloadSvgIcon").on("click", function (){
        if ( d3.select("#reloadSvgIcon").node().disabled === true ) {
          graph.options().ontologyMenu().clearCachedVersion();
          return;
        }
        d3.select("#reloadCachedOntology").classed("hidden", true);
        graph.options().ontologyMenu().reloadCachedOntology();
        
      });
      // add the initialized objects
      webvowl.opts = options;
      webvowl.gr = graph;
      
    }
  };
  
  
  function loadOntologyFromText( jsonText, filename, alternativeFilename ){
    d3.select("#reloadCachedOntology").classed("hidden", true);
    pauseMenu.reset();
    graph.options().navigationMenu().hideAllMenus();
    
    if ( (jsonText === undefined && filename === undefined) || (jsonText.length === 0) ) {
      loadingModule.notValidJsonFile();
      return;
    }
    let data;
    if ( jsonText ) {
      // validate JSON FILE
      let validJSON;
      try {
        data = JSON.parse(jsonText);
        validJSON = true;
      } catch ( _e ) {
        validJSON = false;
      }
      if ( validJSON === false ) {
        // the server output is not a valid json file
        loadingModule.notValidJsonFile();
        return;
      }
      
      if ( !filename ) {
        // First look if an ontology title exists, otherwise take the alternative filename
        const ontologyNames = data.header ? data.header.title : undefined;
        const ontologyName = languageTools.textInLanguage(ontologyNames);
        
        if ( ontologyName ) {
          filename = ontologyName;
        } else {
          filename = alternativeFilename;
        }
      }
    }
    
    
    // check if we have graph data
    let classCount = 0;
    if ( data.class !== undefined ) {
      classCount = data.class.length;
    }
    
    let loadEmptyOntologyForEditing = false;
    if ( location.hash.indexOf("#new_ontology") !== -1 ) {
      loadEmptyOntologyForEditing = true;
    }
    if ( classCount === 0 && graph.editorMode() === false && loadEmptyOntologyForEditing === false ) {
      // generate message for the user;
      loadingModule.emptyGraphContentError();
    } else {
      ontologyMenu.setCachedOntology(filename, jsonText);
      exportMenu.setJsonText(jsonText);
      options.data(data);
      loadingModule.validJsonFile();
      graph.options().loadingModule().setPercentMode();
      if ( loadEmptyOntologyForEditing === true ) {
        graph.editorMode(true);
        
      }
      graph.load();
      sidebar.updateOntologyInformation(data, statistics);
      exportMenu.setFilename(filename);
      graph.updateZoomSliderValueFromOutside();
      adjustSize();
      
      const flagOfCheckBox = d3.select("#editorModeModuleCheckbox").node().checked;
      graph.editorMode(flagOfCheckBox);// update gui
      
    }
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

  function adjustSize(){
    directInputMod.updateLayout();
    const viewport = graph.updateCanvasContainerSize();
    
    graph.updateStyle();
    
    if ( isTouchDevice() === true ) {
      if ( graph.isEditorMode() === true )
        {d3.select("#modeOfOperationString").node().innerHTML = "touch able device detected";}
      graph.setTouchDevice(true);
      
      if ( !initialTouchZoomHandled && isMultiTouchZoomDevice() ) {
        initialTouchZoomHandled = true;
        configMenu.setCheckBoxValue("showZoomSliderConfigCheckbox", false);
      }
    } else {
      if ( graph.isEditorMode() === true )
        {d3.select("#modeOfOperationString").node().innerHTML = "point & click device detected";}
      graph.setTouchDevice(false);
    }
    
    loadingModule.checkForScreenSize();
    
    adjustSliderSize(viewport.height);
    // update also the padding options of loading and the logo positions;
    const warningDiv = d3.select("#browserCheck");
    d3.select("#logo").classed("has-warning", warningDiv.classed("hidden") === false);
    
    navigationMenu.updateScrollButtonVisibility();
    
    // adjust height of the leftSidebar element;
    editSidebar.updateElementWidth();
    
    
    const hs = d3.select("#drag_msg").node().getBoundingClientRect().height;
    const ws = d3.select("#drag_msg").node().getBoundingClientRect().width;
    d3.select("#drag_icon_group").attr("transform", "translate ( " + 0.25 * ws + " " + 0.25 * hs + ")");
    
  }
  
  function adjustSliderSize( fullHeight ){
    const isSliderAllowed = options.zoomSlider().showSlider();
    if ( fullHeight < 150 || !isSliderAllowed ) {
      d3.select("#zoomSlider").classed("hidden", true);
    } else {
      d3.select("#zoomSlider").classed("hidden", false);
    }
  }
  
  function isTouchDevice(){
    try {
      return ('ontouchstart' in window) || 
             (navigator.maxTouchPoints && navigator.maxTouchPoints > 0) || 
             (navigator.msMaxTouchPoints && navigator.msMaxTouchPoints > 0);
    } catch ( _err ) {
      return false;
    }
  }

  function isMultiTouchZoomDevice(){
    try {
      return ('ontouchstart' in window) || 
             (navigator.maxTouchPoints && navigator.maxTouchPoints >= 2) || 
             (navigator.msMaxTouchPoints && navigator.msMaxTouchPoints >= 2);
    } catch ( _err ) {
      return false;
    }
  }
  
  
  function getInternetExplorerVersion(){
    let ua,
      re,
      rv = -1;
    
    // check for edge
    const isEdge = /(?:\b(MS)?IE\s+|\bTrident\/7\.0;.*\s+rv:|\bEdge\/)(\d+)/.test(navigator.userAgent);
    if ( isEdge ) {
      rv = parseInt("12");
      return rv;
    }
    
    const isIE11 = /Trident.*rv[ :]*11\./.test(navigator.userAgent);
    if ( isIE11 ) {
      rv = parseInt("11");
      return rv;
    }
    if ( navigator.appName === "Microsoft Internet Explorer" ) {
      ua = navigator.userAgent;
      re = new RegExp("MSIE ([0-9]{1,}[\\.0-9]{0,})");
      if ( re.exec(ua) !== null ) {
        rv = parseFloat(RegExp.$1);
      }
    } else if ( navigator.appName === "Netscape" ) {
      ua = navigator.userAgent;
      re = new RegExp("Trident/.*rv:([0-9]{1,}[\\.0-9]{0,})");
      if ( re.exec(ua) !== null ) {
        rv = parseFloat(RegExp.$1);
      }
    }
    return rv;
  }
  
  return app;
}
;
