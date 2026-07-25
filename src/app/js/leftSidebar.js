/**
 * Contains the logic for the sidebar.
 * @param graph the graph that belongs to these controls
 * @returns {{}}
 */
module.exports = function ( graph ){
  
  const leftSidebar = {};
  const collapseButton = d3.select("#leftSideBarCollapseButton");
  let visibleSidebar = 0;
  let backupVisibility = 0;
  const sideBarContent = d3.select("#leftSideBarContent");
  const sideBarContainer = d3.select("#containerForLeftSideBar");
  const defaultClassSelectionContainers = [];
  const defaultDatatypeSelectionContainers = [];
  const defaultPropertySelectionContainers = [];
  
  leftSidebar.setup = function (){
    setupCollapsing();
    
    collapseButton.on("click", function (){
      graph.options().navigationMenu().hideAllMenus();
      const settingValue = parseInt(leftSidebar.getSidebarVisibility());
      if ( settingValue === 0 ) {leftSidebar.showSidebar(1);}
      else                  {leftSidebar.showSidebar(0);}
      backupVisibility = settingValue;
    });
    
    setupSelectionContainers();
  };
  
  leftSidebar.hideCollapseButton = function ( val ){
    sideBarContainer.classed("hidden", val);
    collapseButton.classed("hidden", val);
  };
  
  
  function unselectAllElements( container ){
    for ( let i = 0; i < container.length; i++ )
      {container[i].classed("defaultSelected", false);}
  }
  
  function selectThisDefaultElement( element ){
    d3.select(element).classed("defaultSelected", true);
  }
  
  function updateDefaultNameInAccordion( element, identifier ){
    let elementDescription = "";
    if ( identifier === "defaultClass" ) {elementDescription = "Class: ";}
    if ( identifier === "defaultDatatype" ) {elementDescription = "Datatype: ";}
    if ( identifier === "defaultProperty" ) {elementDescription = "Property: ";}
    
    d3.select("#" + identifier).node().innerHTML = elementDescription + element.innerHTML;
    d3.select("#" + identifier).node().title = element.innerHTML;
  }
  
  function classSelectorFunction(){
    unselectAllElements(defaultClassSelectionContainers);
    selectThisDefaultElement(this);
    updateDefaultNameInAccordion(this, "defaultClass");
  }
  
  function datatypeSelectorFunction(){
    unselectAllElements(defaultDatatypeSelectionContainers);
    selectThisDefaultElement(this);
    updateDefaultNameInAccordion(this, "defaultDatatype");
  }
  
  function propertySelectorFunction(){
    unselectAllElements(defaultPropertySelectionContainers);
    selectThisDefaultElement(this);
    updateDefaultNameInAccordion(this, "defaultProperty");
  }
  
  
  function setupSelectionContainers(){
    const classContainer = d3.select("#classContainer");
    const datatypeContainer = d3.select("#datatypeContainer");
    const propertyContainer = d3.select("#propertyContainer");
    // create the supported elements
    
    const defaultClass = "owl:Class";
    const defaultDatatype = "rdfs:Literal";
    const defaultProperty = "owl:objectProperty";
    
    const supportedClasses = graph.options().supportedClasses();
    const supportedDatatypes = graph.options().supportedDatatypes();
    const supportedProperties = graph.options().supportedProperties();
    let i;
    
    for ( i = 0; i < supportedClasses.length; i++ ) {
      const aClassSelectionContainer = classContainer.append("div");
      aClassSelectionContainer.classed("containerForDefaultSelection", true);
      aClassSelectionContainer.classed("noselect", true);
      aClassSelectionContainer.node().id = "selectedClass" + supportedClasses[i];
      aClassSelectionContainer.node().innerHTML = supportedClasses[i];
      
      if ( supportedClasses[i] === defaultClass ) {
        selectThisDefaultElement(aClassSelectionContainer.node());
      }
      aClassSelectionContainer.on("click", classSelectorFunction);
      defaultClassSelectionContainers.push(aClassSelectionContainer);
    }
    
    for ( i = 0; i < supportedDatatypes.length; i++ ) {
      const aDTSelectionContainer = datatypeContainer.append("div");
      aDTSelectionContainer.classed("containerForDefaultSelection", true);
      aDTSelectionContainer.classed("noselect", true);
      aDTSelectionContainer.node().id = "selectedDatatype" + supportedDatatypes[i];
      aDTSelectionContainer.node().innerHTML = supportedDatatypes[i];
      
      if ( supportedDatatypes[i] === defaultDatatype ) {
        selectThisDefaultElement(aDTSelectionContainer.node());
      }
      aDTSelectionContainer.on("click", datatypeSelectorFunction);
      defaultDatatypeSelectionContainers.push(aDTSelectionContainer);
    }
    for ( i = 0; i < supportedProperties.length; i++ ) {
      const aPropSelectionContainer = propertyContainer.append("div");
      aPropSelectionContainer.classed("containerForDefaultSelection", true);
      aPropSelectionContainer.classed("noselect", true);
      aPropSelectionContainer.node().id = "selectedClass" + supportedProperties[i];
      aPropSelectionContainer.node().innerHTML = supportedProperties[i];
      aPropSelectionContainer.on("click", propertySelectorFunction);
      if ( supportedProperties[i] === defaultProperty ) {
        selectThisDefaultElement(aPropSelectionContainer.node());
      }
      defaultPropertySelectionContainers.push(aPropSelectionContainer);
    }
  }
  
  function setupCollapsing(){
    // adapted version of this example: http://www.normansblog.de/simple-jquery-accordion/
    function collapseContainers( containers ){
      containers.classed("hidden", true);
    }
    
    function expandContainers( containers ){
      containers.classed("hidden", false);
    }
    
    const triggers = d3.selectAll(".accordion-trigger");
    
    triggers.attr("tabindex", "0").attr("role", "button");
    triggers.on("keydown", function (event){
      const evt = event || window.event;
      if ( evt && (evt.key === "Enter" || evt.key === " ") ) {
        evt.preventDefault();
        d3.select(this).node().click();
      }
    });
    
    triggers.on("click", function (){
      const selectedTrigger = d3.select(this);
      if ( selectedTrigger.classed("accordion-trigger-active") ) {
        // Collapse the active (which is also the selected) trigger
        collapseContainers(d3.select(selectedTrigger.node().nextElementSibling));
        selectedTrigger.classed("accordion-trigger-active", false);
      } else {
        // Collapse the other trigger ...
        // collapseContainers(d3.selectAll(".accordion-trigger-active + div"));
        // activeTriggers.classed("accordion-trigger-active", false);
        // ... and expand the selected one
        expandContainers(d3.select(selectedTrigger.node().nextElementSibling));
        selectedTrigger.classed("accordion-trigger-active", true);
      }
    });
  }
  
  
  leftSidebar.isSidebarVisible = function (){
    return visibleSidebar;
  };
  
  leftSidebar.updateSideBarVis = function ( init ){
    const vis = leftSidebar.getSidebarVisibility();
    leftSidebar.showSidebar(parseInt(vis), init);
  };
  

  leftSidebar.showSidebar = function ( val, init ){
    const collapseButton = d3.select("#leftSideBarCollapseButton");
    
    if ( init === true ) {
      d3.select("body").classed("no-transition", true);
    }
    
    const isVisible = (val === 1);
    visibleSidebar = isVisible;
    collapseButton.node().innerHTML = isVisible ? "<" : ">";
    
    sideBarContent.classed("hidden", !isVisible);
    sideBarContainer.classed("sidebar-visible", isVisible);
    collapseButton.classed("aligned-to-left-sidebar", isVisible);
    collapseButton.classed("hidden", !isVisible || sideBarContainer.classed("hidden"));
    d3.select("#WarningErrorMessages").classed("aligned-to-left-sidebar", isVisible);

    graph.updateCanvasContainerSize();
    graph.options().navigationMenu().updateScrollButtonVisibility();

    if ( init === true ) {
      requestAnimationFrame(function (){
        d3.select("body").classed("no-transition", false);
      });
    }
  };
  
  leftSidebar.getSidebarVisibility = function (){
    const isHidden = sideBarContent.classed("hidden");
    if ( isHidden === false ) {return String(1);}
    if ( isHidden === true ) {return String(0);}
  };
  
  return leftSidebar;
};
