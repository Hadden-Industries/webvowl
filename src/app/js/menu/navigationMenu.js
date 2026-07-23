/**
 * Contains the navigation "engine"
 *
 * @param graph the associated webvowl graph
 * @returns {{}}
 */
module.exports = function ( graph ){
  var navigationMenu = {},
    scrollContainer = d3.select("#menuElementContainer").node(),
    menuContainer = d3.select("#menuContainer").node(),
    leftButton = d3.select("#scrollLeftButton"),
    rightButton = d3.select("#scrollRightButton"),
    scrolLeftValue,
    scrollMax,
    currentlyVisibleMenu,
    currentlyHoveredEntry,
    touchedElement = false,
    t_scrollLeft,
    t_scrollRight,
    c_select = [],
    m_select = [];
  
  
  function clearAllTimers(){
    cancelAnimationFrame(t_scrollLeft);
    cancelAnimationFrame(t_scrollRight);
  }
  
  function timed_scrollRight(){
    scrolLeftValue += 5;
    scrollContainer.scrollLeft = scrolLeftValue;
    navigationMenu.updateScrollButtonVisibility();
    if ( scrolLeftValue >= scrollMax ) {
      clearAllTimers();
      return;
    }
    t_scrollRight = requestAnimationFrame(timed_scrollRight);
    
  }
  
  function timed_scrollLeft(){
    scrolLeftValue -= 5;
    scrollContainer.scrollLeft = scrolLeftValue;
    navigationMenu.updateScrollButtonVisibility();
    if ( scrolLeftValue <= 0 ) {
      clearAllTimers();
      return;
    }
    t_scrollRight = requestAnimationFrame(timed_scrollLeft);
  }
  
  // collect all menu entries and stuff;
  function setupControlsAndMenus(){
    // HEURISTIC : to match the menus and their controllers we remove the first 2 letters and match
    c_select = [];
    m_select = [];
    
    var c_temp = [];
    var m_temp = [];
    var i;
    var controlElements = scrollContainer.children;
    var numEntries = controlElements.length;
    
    for ( i = 0; i < numEntries; i++ ) {
      c_temp.push(controlElements[i].id.slice(2));
    }
    
    var menuElements = menuContainer.children;
    numEntries = menuElements.length;
    for ( i = 0; i < numEntries; i++ ) {
      m_temp.push(menuElements[i].id.slice(2));
    }
    
    numEntries = controlElements.length;
    for ( i = 0; i < numEntries; i++ ) {
      c_select[i] = "c_" + c_temp[i];
      if ( m_temp.indexOf(c_temp[i]) > -1 ) {
        m_select[i] = "m_" + c_temp[i];
      } else {
        m_select[i] = undefined;
      }
      // create custom behavior for click, touch, and hover
      d3.select("#" + c_select[i]).on("mouseover", menuElementOnHovered);
      d3.select("#" + c_select[i]).on("mouseout", menuElementOutHovered);
      
      d3.select("#" + c_select[i]).on("click", menuElementClicked);
      d3.select("#" + c_select[i]).on("touchstart", menuElementTouched);
      
    }
    
    // connect to mouseWheel
    d3.select("#menuElementContainer").on("wheel", function (){
      var wheelEvent = d3.event;
      var offset;
      if ( wheelEvent.deltaY < 0 ) offset = 20;
      if ( wheelEvent.deltaY > 0 ) offset = -20;
      scrollContainer.scrollLeft += offset;
      navigationMenu.hideAllMenus();
      navigationMenu.updateScrollButtonVisibility();
    });
    
    // bind global release listeners
    d3.select(window).on("mouseup.navScroll", clearAllTimers).on("touchend.navScroll", clearAllTimers);
    d3.select(window).on("resize.navMenu", function (){
      navigationMenu.updateScrollButtonVisibility();
    });

    // connect scrollIndicator Buttons;
    d3.select("#scrollRightButton")
      .on("mousedown", function (){
        scrolLeftValue = scrollContainer.scrollLeft;
        navigationMenu.hideAllMenus();
        t_scrollRight = requestAnimationFrame(timed_scrollRight);
      })
      .on("touchstart", function (){
        scrolLeftValue = scrollContainer.scrollLeft;
        navigationMenu.hideAllMenus();
        t_scrollRight = requestAnimationFrame(timed_scrollRight);
      })
      .on("click", function (){
        scrollContainer.scrollLeft += 100;
        navigationMenu.updateScrollButtonVisibility();
      })
      .on("mouseup", clearAllTimers)
      .on("touchend", clearAllTimers)
      .on("touchcancel", clearAllTimers);
    
    d3.select("#scrollLeftButton")
      .on("mousedown", function (){
        scrolLeftValue = scrollContainer.scrollLeft;
        navigationMenu.hideAllMenus();
        t_scrollLeft = requestAnimationFrame(timed_scrollLeft);
      })
      .on("touchstart", function (){
        scrolLeftValue = scrollContainer.scrollLeft;
        navigationMenu.hideAllMenus();
        t_scrollLeft = requestAnimationFrame(timed_scrollLeft);
      })
      .on("click", function (){
        scrollContainer.scrollLeft -= 100;
        navigationMenu.updateScrollButtonVisibility();
      })
      .on("mouseup", clearAllTimers)
      .on("touchend", clearAllTimers)
      .on("touchcancel", clearAllTimers);
    
    // connect the scroll functionality;
    d3.select("#menuElementContainer").on("scroll", function (){
      navigationMenu.updateScrollButtonVisibility();
      navigationMenu.hideAllMenus();
    });
  }
  
  function menuElementOnHovered(){
    navigationMenu.hideAllMenus();
    if ( touchedElement ) {
      return;
    }
    showSingleMenu(this.id);
  }
  
  function menuElementOutHovered(){
    hoveroutedControMenu(this.id);
  }
  
  function menuElementClicked(){
    var m_element = m_select[c_select.indexOf(this.id)];
    if ( m_element ) {
      var menuElement = d3.select("#" + m_element);
      if ( menuElement ) {
        if ( menuElement.style("display") === "block" ) {
          menuElement.style("display", "none");// hide it
        } else {
          showSingleMenu(this.id);
        }
      }
    }
  }
  
  function menuElementTouched(){
    // it sets a flag that we have touched it,
    // since d3. propagates the event for touch as hover and then click, we block the hover event
    touchedElement = true;
  }
  
  
  function hoveroutedControMenu( controllerID ){
    currentlyHoveredEntry = d3.select("#" + controllerID);
    if ( controllerID !== "c_search" ) {
      var isCrosshair = currentlyHoveredEntry.select(".crosshairIcon").node();
      if ( !isCrosshair ) {
        d3.select("#" + controllerID).select("path").style("stroke-width", "0");
        d3.select("#" + controllerID).select("path").style("fill", "#fff");
      } else {
        currentlyHoveredEntry.select("use, path").style("stroke", "#ffffff");
      }
    }
  }
  
  function showSingleMenu( controllerID ){
    currentlyHoveredEntry = d3.select("#" + controllerID).node();
    // get the corresponding menu element for this controller
    var m_element = m_select[c_select.indexOf(controllerID)];
    if ( m_element ) {
      if ( controllerID !== "c_search" ) {
        var isCrosshair = d3.select("#" + controllerID).select(".crosshairIcon").node();
        if ( !isCrosshair ) {
          d3.select("#" + controllerID).select("path").style("stroke-width", "0");
          d3.select("#" + controllerID).select("path").style("fill", "#bdc3c7");
        } else {
          d3.select("#" + controllerID).select("use, path").style("stroke", "#bdc3c7");
        }
      }
      // show it if we have a menu
      currentlyVisibleMenu = d3.select("#" + m_element);
      currentlyVisibleMenu.style("display", "block");
      if ( m_element === "m_export" )
        graph.options().exportMenu().exportAsUrl();
      updateMenuPosition();
    }
  }
  
  function updateMenuPosition(){
    if ( currentlyHoveredEntry ) {
      var leftOffset = currentlyHoveredEntry.offsetLeft;
      var scrollOffset = scrollContainer.scrollLeft;
      var totalOffset = leftOffset - scrollOffset;
      var finalOffset = Math.max(0, totalOffset);
      var fullContainer_width = scrollContainer.getBoundingClientRect().width;
      var elementWidth = currentlyVisibleMenu.node().getBoundingClientRect().width;
      // make priority > first check if we are right
      if ( finalOffset + elementWidth > fullContainer_width ) {
        finalOffset = fullContainer_width - elementWidth;
      }
      // fix priority;
      finalOffset = Math.max(0, finalOffset);
      currentlyVisibleMenu.style("left", finalOffset + "px");
      
      // // check if outside the viewport
      // var menuWidth=currentlyHoveredEntry.getBoundingClientRect().width;
      // var bt_width=36;
      // if (totalOffset+menuWidth<bt_width || totalOffset+bt_width>fullContainer_width){
      //     navigationMenu.hideAllMenus();
      //     currentlyHoveredEntry=undefined;
      // }
    }
  }
  
  navigationMenu.hideAllMenus = function (){
    d3.selectAll(".toolTipMenu").style("display", "none"); // hiding all menus
  };
  
  navigationMenu.updateScrollButtonVisibility = function (){
    if ( !scrollContainer ) return;
    var scrollLeft = scrollContainer.scrollLeft;
    var maxScroll = scrollContainer.scrollWidth - scrollContainer.clientWidth;

    if ( maxScroll <= 2 ) {
      leftButton.classed("hidden", true);
      rightButton.classed("hidden", true);
      return;
    }

    leftButton.classed("hidden", scrollLeft <= 2);
    rightButton.classed("hidden", scrollLeft >= maxScroll - 2);
  };
  
  navigationMenu.setup = function (){
    setupControlsAndMenus();
    // make sure that the menu elements follow their controller and also their restrictions
    // some hovering behavior -- lets the menu disappear when hovered in graph or sidebar;
    d3.select("#graph").on("mouseover", function (){
      navigationMenu.hideAllMenus();
    });
    d3.select("#generalDetails").on("mouseover", function (){
      navigationMenu.hideAllMenus();
    });
  };
  
  return navigationMenu;
};
