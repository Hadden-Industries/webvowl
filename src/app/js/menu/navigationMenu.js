/**
 * Contains the navigation "engine"
 *
 * @param graph the associated webvowl graph
 * @returns {{}}
 */
module.exports = function (graph) {
  const navigationMenu = {};
  const scrollContainer = d3.select("#menuElementContainer").node();
  const menuContainer = d3.select("#menuContainer").node();
  const leftButton = d3.select("#scrollLeftButton");
  const rightButton = d3.select("#scrollRightButton");
  let scrolLeftValue;
  let scrollMax = 0;
  let currentlyVisibleMenu;
  let currentlyHoveredEntry;
  let t_scrollLeft;
  let t_scrollRight;
  let c_select = [];
  let m_select = [];

  function clearAllTimers() {
    cancelAnimationFrame(t_scrollLeft);
    cancelAnimationFrame(t_scrollRight);
  }

  function timed_scrollRight() {
    scrolLeftValue += 5;
    scrollContainer.scrollLeft = scrolLeftValue;
    navigationMenu.updateScrollButtonVisibility();
    if (scrolLeftValue >= scrollMax) {
      clearAllTimers();
      return;
    }
    t_scrollRight = requestAnimationFrame(timed_scrollRight);
  }

  function timed_scrollLeft() {
    scrolLeftValue -= 5;
    scrollContainer.scrollLeft = scrolLeftValue;
    navigationMenu.updateScrollButtonVisibility();
    if (scrolLeftValue <= 0) {
      clearAllTimers();
      return;
    }
    t_scrollLeft = requestAnimationFrame(timed_scrollLeft);
  }

  // collect all menu entries and stuff;
  function setupControlsAndMenus() {
    // HEURISTIC : to match the menus and their controllers we remove the first 2 letters and match
    c_select = [];
    m_select = [];

    const c_temp = [];
    const m_temp = [];
    let i;
    const controlElements = scrollContainer.children;
    let numEntries = controlElements.length;

    for (i = 0; i < numEntries; i++) {
      c_temp.push(controlElements[i].id.slice(2));
    }

    const menuElements = menuContainer.children;
    numEntries = menuElements.length;
    for (i = 0; i < numEntries; i++) {
      m_temp.push(menuElements[i].id.slice(2));
    }

    numEntries = controlElements.length;
    for (i = 0; i < numEntries; i++) {
      c_select[i] = "c_" + c_temp[i];
      if (m_temp.indexOf(c_temp[i]) > -1) {
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
    d3.select("#menuElementContainer").on("wheel", function () {
      const wheelEvent = d3.event;
      let offset;
      if (wheelEvent.deltaY < 0) {
        offset = 20;
      }
      if (wheelEvent.deltaY > 0) {
        offset = -20;
      }
      scrollContainer.scrollLeft += offset;
      navigationMenu.hideAllMenus();
      navigationMenu.updateScrollButtonVisibility();
    });

    // bind global release listeners
    d3.select(window).on("mouseup.navScroll", clearAllTimers).on("touchend.navScroll", clearAllTimers);
    d3.select(window).on("resize.navMenu", function (){
      navigationMenu.updateScrollButtonVisibility();
      updateMenuPosition();
    });

    // connect scrollIndicator Buttons;
    d3.select("#scrollRightButton")
      .on("mousedown", function () {
        scrolLeftValue = scrollContainer.scrollLeft;
        navigationMenu.hideAllMenus();
        t_scrollRight = requestAnimationFrame(timed_scrollRight);
      })
      .on("touchstart", function () {
        scrolLeftValue = scrollContainer.scrollLeft;
        navigationMenu.hideAllMenus();
        t_scrollRight = requestAnimationFrame(timed_scrollRight);
      })
      .on("contextmenu", function (event){
        if ( event ) {
          event.preventDefault();
        }
      })
      .on("mouseup", clearAllTimers)
      .on("touchend", clearAllTimers)
      .on("touchcancel", clearAllTimers);

    d3.select("#scrollLeftButton")
      .on("mousedown", function () {
        scrolLeftValue = scrollContainer.scrollLeft;
        navigationMenu.hideAllMenus();
        t_scrollLeft = requestAnimationFrame(timed_scrollLeft);
      })
      .on("touchstart", function () {
        scrolLeftValue = scrollContainer.scrollLeft;
        navigationMenu.hideAllMenus();
        t_scrollLeft = requestAnimationFrame(timed_scrollLeft);
      })
      .on("contextmenu", function (event){
        if ( event ) {
          event.preventDefault();
        }
      })
      .on("mouseup", clearAllTimers)
      .on("touchend", clearAllTimers)
      .on("touchcancel", clearAllTimers);

    d3.selectAll(".navButton").on("contextmenu", function (event){
      if ( event ) {
        event.preventDefault();
      }
    });

    // connect the scroll functionality;
    d3.select("#menuElementContainer").on("scroll", function () {
      navigationMenu.updateScrollButtonVisibility();
      navigationMenu.hideAllMenus();
    });
  }

  function menuElementOnHovered() {
    if ( !window.matchMedia("(hover: hover)").matches ) {
      return;
    }
    navigationMenu.hideAllMenus();
    if (touchedElement) {
      return;
    }
    showSingleMenu(this.id);
  }

  function menuElementOutHovered() {
    hoveroutedControMenu(this.id);
  }

  function menuElementClicked() {
    const m_element = m_select[c_select.indexOf(this.id)];
    if (m_element) {
      const menuElement = d3.select("#" + m_element);
      if (menuElement) {
        if (menuElement.style("display") === "block") {
          menuElement.style("display", "none"); // hide it
  var touchResetTimer;
        } else {
          showSingleMenu(this.id);
        }
      }
    }
    clearTimeout(touchResetTimer);
    touchResetTimer = setTimeout(function (){
      touchedElement = false;
    }, 400);
  }

  function menuElementTouched() {
    // it sets a flag that we have touched it,
    // since d3 propagates the event for touch as hover and then click, we block the hover event
    touchedElement = true;
    clearTimeout(touchResetTimer);
    touchResetTimer = setTimeout(function (){
      touchedElement = false;
    }, 500);
  }

  function hoveroutedControMenu(controllerID) {
    const entry = d3.select("#" + controllerID);
    if (controllerID !== "c_search") {
      d3.select("#" + controllerID)
        .select("path")
        .style("stroke-width", "0");
      d3.select("#" + controllerID)
        .select("path")
        .style("fill", "#fff");
    }
  }

  function showSingleMenu(controllerID) {
    currentlyHoveredEntry = d3.select("#" + controllerID).node();
    const m_element = m_select[c_select.indexOf(controllerID)];
    if (m_element) {
      if (controllerID !== "c_search") {
        d3.select("#" + controllerID)
          .select("path")
          .style("stroke-width", "0");
        d3.select("#" + controllerID)
          .select("path")
          .style("fill", "#bdc3c7");
      }
      currentlyVisibleMenu = d3.select("#" + m_element);
      try { currentlyVisibleMenu.node().showPopover(); } catch { /* ignore if open */ }
      if (m_element === "m_export") {
        graph.options().exportMenu().exportAsUrl();
      }
      updateMenuPosition();
    }
  }

  function updateMenuPosition() {
    if (currentlyHoveredEntry) {
      const leftOffset = currentlyHoveredEntry.offsetLeft;
      const scrollOffset = scrollContainer.scrollLeft;
      const totalOffset = leftOffset - scrollOffset;
      let finalOffset = Math.max(0, totalOffset);
      const fullContainer_width = scrollContainer.getBoundingClientRect().width;
      const elementWidth = currentlyVisibleMenu
        .node()
        .getBoundingClientRect().width;
      // make priority > first check if we are right
      if (finalOffset + elementWidth > fullContainer_width) {
        finalOffset = fullContainer_width - elementWidth;
      }

      finalOffset = Math.max(16, finalOffset);
      currentlyVisibleMenu.style("left", finalOffset + "px").style("transform", "none");

      // // check if outside the viewport
      // var menuWidth=currentlyHoveredEntry.getBoundingClientRect().width;
      // var bt_width=36;
      // if (totalOffset+menuWidth<bt_width || totalOffset+bt_width>fullContainer_width){
      //     navigationMenu.hideAllMenus();
      //     currentlyHoveredEntry=undefined;
      // }
    }
  }

  navigationMenu.updateMenuPosition = updateMenuPosition;

  navigationMenu.hideAllMenus = function () {
    d3.selectAll(".modern-popover").each(function (){
      try {
        if ( this.matches(":popover-open") ) {
          this.hidePopover();
        }
      } catch { /* ignore */ }
    });
  };

  navigationMenu.updateScrollButtonVisibility = function () {
    scrollMax = scrollContainer.scrollWidth - scrollContainer.clientWidth - 2;
    if (scrollContainer.scrollLeft === 0) {
      leftButton.classed("hidden", true);
      rightButton.classed("hidden", true);
      return;
    }

    if (scrollContainer.scrollLeft > scrollMax) {
      rightButton.classed("hidden", true);
    } else {
      rightButton.classed("hidden", false);
    }
  };

  navigationMenu.setup = function () {
    setupControlsAndMenus();
    // make sure that the menu elements follow their controller and also their restrictions
    // some hovering behavior -- lets the menu disappear when hovered in graph or sidebar;
    d3.select("#graph").on("mouseover", function () {
      navigationMenu.hideAllMenus();
    }).on("touchstart", function (){
      navigationMenu.hideAllMenus();
    });
    d3.select("#generalDetails").on("mouseover", function () {
      navigationMenu.hideAllMenus();
    });
    
    // Sync active-menu-item class, positioning, and export state when popovers toggle
    d3.selectAll(".modern-popover").on("toggle", function (event){
      const menuId = this.id;
      const controllerIdx = m_select.indexOf(menuId);
      const controllerId = controllerIdx > -1 ? c_select[controllerIdx] : null;

      const isOpen = (event && event.newState) ? (event.newState === "open") : this.matches(":popover-open");

      // Reset drag classes and inline transform when state changes
      d3.select(this).classed("dragging", false).classed("has-dragged", false).classed("snap-back", false).classed("sheet-dismissing", false);
      if ( this.style ) {
        if ( typeof this.style.removeProperty === "function" ) {
          this.style.removeProperty("transform");
        } else {
          this.style.transform = "";
        }
      }

      if ( isOpen ) {
        if ( controllerId && controllerId !== "c_search" ) {
          d3.select("#" + controllerId).classed("active-menu-item", true);
        }
        currentlyVisibleMenu = d3.select("#" + menuId);
        if ( controllerId ) {
          currentlyHoveredEntry = d3.select("#" + controllerId).node();
        }
        if ( menuId === "m_export" ) {
          graph.options().exportMenu().exportAsUrl();
        }
        updateMenuPosition(controllerId);
      } else {
        if ( controllerId && controllerId !== "c_search" ) {
          d3.select("#" + controllerId).classed("active-menu-item", false);
        }
      }
    });

    setupMobileSheetDragDismiss();
  };

  function setupMobileSheetDragDismiss(){
    d3.selectAll(".modern-popover").each(function (){
      const popoverNode = this;
      if ( !popoverNode.querySelectorAll ) {return;}
      const dragAreaNodes = popoverNode.querySelectorAll(".sheet-handle, .popover-header");

      let startY = 0;
      let startTime = 0;
      let currentDy = 0;
      let isDragging = false;

      function onTouchStart(event){
        if ( window.innerWidth > 768 ) {
          return;
        }
        // Don't start drag gesture if tapping close button
        if ( event.target && typeof event.target.closest === "function" && event.target.closest(".popover-close-btn") ) {
          return;
        }
        if ( event.touches && event.touches.length === 1 ) {
          startY = event.touches[0].clientY;
          startTime = Date.now();
          currentDy = 0;
          isDragging = true;
          d3.select(popoverNode).classed("dragging", true).classed("has-dragged", true).classed("snap-back", false).classed("sheet-dismissing", false);
        }
      }

      function onTouchMove(event){
        if ( !isDragging || window.innerWidth > 768 ) {
          return;
        }
        if ( event.touches && event.touches.length === 1 ) {
          const currentY = event.touches[0].clientY;
          let dy = currentY - startY;

          // Rubberband upward pull
          if ( dy < 0 ) {
            dy = dy * 0.2;
          }

          currentDy = dy;
          popoverNode.style.transform = "translateY(" + dy + "px)";

          if ( event.cancelable ) {
            event.preventDefault();
          }
        }
      }

      function onTouchEnd(){
        if ( !isDragging ) {
          return;
        }
        isDragging = false;
        const duration = Date.now() - startTime;
        const velocity = currentDy / Math.max(1, duration);

        d3.select(popoverNode).classed("dragging", false);

        const dismissThreshold = 80;
        const velocityThreshold = 0.3;

        if ( currentDy >= dismissThreshold || (currentDy > 20 && velocity > velocityThreshold) ) {
          // Slide off-screen down and hide popover
          d3.select(popoverNode).classed("sheet-dismissing", true);
          setTimeout(function (){
            try {
              if ( popoverNode.matches(":popover-open") ) {
                popoverNode.hidePopover();
              }
            } catch { /* ignore */ }
            if ( popoverNode.style && typeof popoverNode.style.removeProperty === "function" ) {
              popoverNode.style.removeProperty("transform");
            } else if ( popoverNode.style ) {
              popoverNode.style.transform = "";
            }
            d3.select(popoverNode).classed("sheet-dismissing", false);
          }, 200);
        } else {
          // Snap back into place
          d3.select(popoverNode).classed("snap-back", true);
          popoverNode.style.transform = "translateY(0)";
          setTimeout(function (){
            if ( popoverNode.style && typeof popoverNode.style.removeProperty === "function" ) {
              popoverNode.style.removeProperty("transform");
            } else if ( popoverNode.style ) {
              popoverNode.style.transform = "";
            }
            d3.select(popoverNode).classed("snap-back", false);
          }, 250);
        }
      }

      dragAreaNodes.forEach(function (node){
        if ( node && typeof node.addEventListener === "function" ) {
          node.addEventListener("touchstart", onTouchStart, { passive: true });
          node.addEventListener("touchmove", onTouchMove, { passive: false });
          node.addEventListener("touchend", onTouchEnd, { passive: true });
          node.addEventListener("touchcancel", onTouchEnd, { passive: true });
        }
      });
    });
  }

  return navigationMenu;
};
