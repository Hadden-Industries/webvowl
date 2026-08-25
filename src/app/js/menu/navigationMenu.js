/**
 * Contains the navigation "engine"
 *
 * @param graph the associated webvowl graph
 * @returns {{}}
 */
module.exports = function (graph) {
  const navigationMenu = {};
  const scrollContainer = document.querySelector("#menuElementContainer");
  const menuContainer = document.querySelector("#menuContainer");
  const leftButton = document.querySelector("#scrollLeftButton");
  const rightButton = document.querySelector("#scrollRightButton");
  let scrolLeftValue;
  let scrollMax = 0;
  let currentlyVisibleMenu;
  let currentlyHoveredEntry;
  let t_scrollLeft;
  let t_scrollRight;
  let c_select = [];
  let m_select = [];

  /**
   * Installed iOS apps need a narrowly scoped exception to declarative
   * popover invocation. WebKit bug 286146 (a duplicate of 285811) documents
   * an infinite focus-navigation loop when a form control is focused inside
   * some invoker-owned popovers:
   * https://bugs.webkit.org/show_bug.cgi?id=286146
   *
   * A button with `popovertarget` becomes the popover's trigger. That trigger
   * owns a separate focus-navigation scope while the popover is showing. The
   * workaround below opens the same native popover without a trigger, avoiding
   * the faulty scope while retaining top-layer rendering and light-dismiss.
   * These variables retain the opener information that the browser would
   * otherwise own so ARIA state and safe focus restoration can be maintained.
   */
  const standalonePopoverOpeners = new Map();
  let activeStandalonePopoverOpener;

  function needsStandalonePopoverFocusWorkaround() {
    try {
      // `display-mode` limits the workaround to installed/home-screen apps;
      // the input-capability checks exclude desktop Safari and hybrid devices
      // whose primary interaction still provides hover and a fine pointer.
      return window.matchMedia(
        "(display-mode: standalone) and (hover: none) and (pointer: coarse)",
      ).matches;
    } catch {
      return false;
    }
  }

  /**
   * Restore only the focus behavior lost when `popovertarget` is removed.
   *
   * A close button, Escape, or swipe dismissal can leave focus inside the
   * closing popover (or on `body` after WebKit clears it), in which case the
   * opener is the appropriate destination. Light-dismiss can instead be
   * caused by activating another control. The queued `toggle` event may run
   * after that control receives focus, so unconditional restoration would
   * steal focus and make the newly activated control appear unresponsive.
   */
  function restoreStandalonePopoverFocus(popoverNode, openerNode) {
    if (!openerNode || activeStandalonePopoverOpener !== openerNode) {
      return;
    }

    const activeElement = document.activeElement;
    const focusStayedInPopover =
      activeElement &&
      typeof popoverNode.contains === "function" &&
      popoverNode.contains(activeElement);
    if (activeElement !== document.body && !focusStayedInPopover) {
      return;
    }

    try {
      openerNode.focus({ preventScroll: true });
    } catch {
      openerNode.focus();
    }
  }

  function setupStandalonePopoverFocusWorkaround() {
    if (!needsStandalonePopoverFocusWorkaround()) {
      return;
    }

    document
      .querySelectorAll(".navButton[popovertarget]")
      .forEach(function (openerNode) {
        const popoverId = openerNode.getAttribute("popovertarget");
        const popoverNode = document.getElementById(popoverId);
        if (!popoverId || !popoverNode) {
          return;
        }

        // Removing the attribute before activation prevents the browser from
        // installing `openerNode` as the native popover trigger. Do not replace
        // the zero-argument `showPopover()` call below with
        // `showPopover({ source: openerNode })` or an equivalent invoker API:
        // supplying a source would recreate the focus scope this code avoids.
        // Because declarative accessibility state is also removed, the toggle
        // listener below synchronizes `aria-expanded` explicitly.
        openerNode.removeAttribute("popovertarget");
        openerNode.setAttribute("aria-controls", popoverId);
        openerNode.setAttribute("aria-expanded", "false");
        openerNode.addEventListener("click", function () {
          try {
            if (popoverNode.matches(":popover-open")) {
              popoverNode.hidePopover();
              return;
            }

            navigationMenu.hideAllMenus();
            standalonePopoverOpeners.set(popoverNode, openerNode);
            activeStandalonePopoverOpener = openerNode;
            popoverNode.showPopover();
          } catch {
            // A light-dismiss or competing opener can change top-layer state
            // between click dispatch and the Popover API call. Leave the
            // button collapsed and discard stale restoration state if so.
            standalonePopoverOpeners.delete(popoverNode);
            if (activeStandalonePopoverOpener === openerNode) {
              activeStandalonePopoverOpener = undefined;
            }
          }
        });
      });
  }

  function setPopoverInlineStart( node, value ){
    if ( !node || !node.style || typeof node.style.setProperty !== "function" ) {return;}
    node.style.setProperty("--popover-inline-start", value);
  }

  function clearPopoverInlineStart( node ){
    if ( !node || !node.style || typeof node.style.removeProperty !== "function" ) {return;}
    node.style.removeProperty("--popover-inline-start");
  }

  function setSheetDragY( node, value ){
    if ( !node || !node.style || typeof node.style.setProperty !== "function" ) {return;}
    node.style.setProperty("--sheet-drag-y", value);
  }

  function clearSheetDragY( node ){
    if ( !node || !node.style || typeof node.style.removeProperty !== "function" ) {return;}
    node.style.removeProperty("--sheet-drag-y");
  }

  function clearAllTimers() {
    cancelAnimationFrame(t_scrollLeft);
    cancelAnimationFrame(t_scrollRight);
  }

  function timed_scrollRight() {
    const maxScroll = scrollContainer.scrollWidth - scrollContainer.clientWidth;
    scrollContainer.scrollLeft += 5;
    navigationMenu.updateScrollButtonVisibility();
    if (scrolLeftValue >= scrollMax) {
      clearAllTimers();
      return;
    }
    t_scrollRight = requestAnimationFrame(timed_scrollRight);
  }

  function timed_scrollLeft() {
    scrollContainer.scrollLeft -= 5;
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
        navigationMenu.hideAllMenus();
        t_scrollRight = requestAnimationFrame(timed_scrollRight);
      })
      .on("touchstart", function () {
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
        navigationMenu.hideAllMenus();
        t_scrollLeft = requestAnimationFrame(timed_scrollLeft);
      })
      .on("touchstart", function () {
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
    leftButton.addEventListener("click", function () {
      scrollContainer.scrollLeft -= 100;
      navigationMenu.updateScrollButtonVisibility();
    });
    leftButton.addEventListener("mouseup", clearAllTimers);
    leftButton.addEventListener("touchend", clearAllTimers);
    leftButton.addEventListener("touchcancel", clearAllTimers);

    document.querySelectorAll(".navButton").forEach(function (btn) {
      btn.addEventListener("contextmenu", function (event) {
        if (event) {
          event.preventDefault();
        }
      });
    });

    // connect the scroll functionality;
    scrollContainer.addEventListener("scroll", function () {
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
      const elementWidth = currentlyVisibleMenu.getBoundingClientRect().width;
      // make priority > first check if we are right
      if (finalOffset + elementWidth > fullContainer_width) {
        finalOffset = fullContainer_width - elementWidth;
      }

      finalOffset = Math.max(16, finalOffset);
      setPopoverInlineStart(menuNode, finalOffset + "px");

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
      leftButton.classList.add("hidden");
      rightButton.classList.add("hidden");
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
    setupStandalonePopoverFocusWorkaround();
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

      // Reset drag classes and runtime positioning data when state changes.
      d3.select(this).classed("dragging", false).classed("has-dragged", false).classed("snap-back", false).classed("sheet-dismissing", false);
      clearSheetDragY(this);
        const standaloneOpener = standalonePopoverOpeners.get(this);
        if (standaloneOpener) {
          // Native `popovertarget` normally exposes this relationship. The
          // standalone workaround removed that attribute, so mirror the real
          // toggle state rather than predicting it in the click handler.
          standaloneOpener.setAttribute(
            "aria-expanded",
            isOpen ? "true" : "false",
          );
        }

      if ( isOpen ) {
        if ( controllerId && controllerId !== "c_search" ) {
          d3.select("#" + controllerId).classed("active-menu-item", true);
            }
          }
          if (standaloneOpener) {
            restoreStandalonePopoverFocus(this, standaloneOpener);
            standalonePopoverOpeners.delete(this);
            if (activeStandalonePopoverOpener === standaloneOpener) {
              activeStandalonePopoverOpener = undefined;
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

    // Contain user interactions inside popovers so they don't propagate to background graph canvas
    const popoverElements = (typeof document !== "undefined" && typeof document.querySelectorAll === "function") ? document.querySelectorAll(".modern-popover") : [];
    const interactionEvents = ["click", "mousedown", "mouseup", "pointerdown", "pointerup", "touchstart", "touchend", "wheel"];
    popoverElements.forEach(function (popover){
      if ( !popover || typeof popover.addEventListener !== "function" ) {return;}
      interactionEvents.forEach(function (eventType){
        popover.addEventListener(eventType, function (event){
          if ( event && typeof event.stopPropagation === "function" ) {
            event.stopPropagation();
          }
        });
      });
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

          // Clamp upward drag so full-width bottom sheet cannot be torn away from bottom of screen
          if ( dy < 0 ) {
            dy = 0;
          }

          currentDy = dy;
          setSheetDragY(popoverNode, dy + "px");

          if ( event.cancelable ) {
            event.preventDefault();
          }
        }

      function onTouchEnd(){
        if ( !isDragging ) {
          return;
        }

        function onTouchEnd() {
          if (!isDragging) {
            return;
          }
          isDragging = false;
          const duration = Date.now() - startTime;
          const velocity = currentDy / Math.max(1, duration);

          popoverNode.classList.remove("dragging");

        if ( currentDy >= dismissThreshold || (currentDy > 20 && velocity > velocityThreshold) ) {
          // Slide off-screen down and hide popover
          d3.select(popoverNode).classed("sheet-dismissing", true);
          setTimeout(function (){
            try {
              if ( popoverNode.matches(":popover-open") ) {
                popoverNode.hidePopover();
              }
            } catch { /* ignore */ }
            clearSheetDragY(popoverNode);
            d3.select(popoverNode).classed("sheet-dismissing", false);
          }, 200);
        } else {
          // Snap back into place
          d3.select(popoverNode).classed("snap-back", true);
          setSheetDragY(popoverNode, "0px");
          setTimeout(function (){
            clearSheetDragY(popoverNode);
            d3.select(popoverNode).classed("snap-back", false);
          }, 250);
        }

      dragAreaNodes.forEach(function (node){
        if ( node && typeof node.addEventListener === "function" ) {
          node.addEventListener("touchstart", onTouchStart, { passive: true });
          node.addEventListener("touchmove", onTouchMove, { passive: false });
          node.addEventListener("touchend", onTouchEnd, { passive: true });
          node.addEventListener("touchcancel", onTouchEnd, { passive: true });
        }
      });
  }

  return navigationMenu;
};
