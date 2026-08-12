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
  let currentlyVisibleMenu;
  let currentlyHoveredEntry;
  let t_scrollLeft;
  let t_scrollRight;
  let c_select = [];
  let m_select = [];

  function setPopoverInlineStart(node, value) {
    if (!node || !node.style || typeof node.style.setProperty !== "function") {
      return;
    }
    node.style.setProperty("--popover-inline-start", value);
  }

  function clearPopoverInlineStart(node) {
    if (
      !node ||
      !node.style ||
      typeof node.style.removeProperty !== "function"
    ) {
      return;
    }
    node.style.removeProperty("--popover-inline-start");
  }

  function setSheetDragY(node, value) {
    if (!node || !node.style || typeof node.style.setProperty !== "function") {
      return;
    }
    node.style.setProperty("--sheet-drag-y", value);
  }

  function clearSheetDragY(node) {
    if (
      !node ||
      !node.style ||
      typeof node.style.removeProperty !== "function"
    ) {
      return;
    }
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
    if (scrollContainer.scrollLeft >= maxScroll) {
      clearAllTimers();
      return;
    }
    t_scrollRight = requestAnimationFrame(timed_scrollRight);
  }

  function timed_scrollLeft() {
    scrollContainer.scrollLeft -= 5;
    navigationMenu.updateScrollButtonVisibility();
    if (scrollContainer.scrollLeft <= 0) {
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
      // Popover API buttons handle toggling natively via popovertarget attribute
    }

    // connect to mouseWheel
    scrollContainer.addEventListener("wheel", function (event) {
      const wheelEvent = event;
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
    window.addEventListener("mouseup", clearAllTimers);
    window.addEventListener("touchend", clearAllTimers);
    window.addEventListener("resize", function () {
      navigationMenu.updateScrollButtonVisibility();
      updateMenuPosition();
    });

    // connect scrollIndicator Buttons;
    rightButton.addEventListener("mousedown", function () {
      navigationMenu.hideAllMenus();
      t_scrollRight = requestAnimationFrame(timed_scrollRight);
    });
    rightButton.addEventListener(
      "touchstart",
      function (event) {
        if (event && event.cancelable) {
          event.preventDefault();
        }
        navigationMenu.hideAllMenus();
        t_scrollRight = requestAnimationFrame(timed_scrollRight);
      },
      { passive: false },
    );
    rightButton.addEventListener("contextmenu", function (event) {
      if (event) {
        event.preventDefault();
      }
    });
    rightButton.addEventListener("click", function () {
      scrollContainer.scrollLeft += 100;
      navigationMenu.updateScrollButtonVisibility();
    });
    rightButton.addEventListener("mouseup", clearAllTimers);
    rightButton.addEventListener("touchend", clearAllTimers);
    rightButton.addEventListener("touchcancel", clearAllTimers);

    leftButton.addEventListener("mousedown", function () {
      navigationMenu.hideAllMenus();
      t_scrollLeft = requestAnimationFrame(timed_scrollLeft);
    });
    leftButton.addEventListener(
      "touchstart",
      function (event) {
        if (event && event.cancelable) {
          event.preventDefault();
        }
        navigationMenu.hideAllMenus();
        t_scrollLeft = requestAnimationFrame(timed_scrollLeft);
      },
      { passive: false },
    );
    leftButton.addEventListener("contextmenu", function (event) {
      if (event) {
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

  function updateMenuPosition(controllerID) {
    if (controllerID) {
      currentlyHoveredEntry = document.querySelector("#" + controllerID);
    }
    if (!currentlyVisibleMenu) {
      return;
    }

    const menuNode = currentlyVisibleMenu;

    // On mobile screen widths, clear desktop positioning so bottom-sheet rules govern.
    if (window.innerWidth <= 768) {
      clearPopoverInlineStart(menuNode);
      return;
    }

    const targetNode = currentlyHoveredEntry;

    if (targetNode && typeof targetNode.getBoundingClientRect === "function") {
      const buttonRect = targetNode.getBoundingClientRect();
      let finalOffset = buttonRect.left;

      let maxRightBoundary = window.innerWidth - 16;
      const detailArea = document.querySelector("#detailsArea");
      if (detailArea && !detailArea.classList.contains("hidden")) {
        const sidebarLeft = detailArea.getBoundingClientRect().left;
        if (sidebarLeft > 0) {
          maxRightBoundary = Math.min(maxRightBoundary, sidebarLeft - 16);
        }
      }

      const elementWidth = currentlyVisibleMenu.getBoundingClientRect().width;
      if (finalOffset + elementWidth > maxRightBoundary) {
        finalOffset = maxRightBoundary - elementWidth;
      }

      finalOffset = Math.max(16, finalOffset);
      setPopoverInlineStart(menuNode, finalOffset + "px");
    }
  }

  navigationMenu.updateMenuPosition = updateMenuPosition;

  navigationMenu.hideAllMenus = function () {
    document.querySelectorAll(".modern-popover").forEach(function (popover) {
      try {
        if (popover.matches(":popover-open")) {
          popover.hidePopover();
        }
      } catch {
        /* ignore */
      }
    });
  };

  navigationMenu.updateScrollButtonVisibility = function () {
    if (!scrollContainer) {
      return;
    }
    const scrollLeft = scrollContainer.scrollLeft;
    const maxScroll = scrollContainer.scrollWidth - scrollContainer.clientWidth;

    if (maxScroll <= 2) {
      leftButton.classList.add("hidden");
      rightButton.classList.add("hidden");
      return;
    }

    leftButton.classList.toggle("hidden", scrollLeft <= 2);
    rightButton.classList.toggle("hidden", scrollLeft >= maxScroll - 2);
  };

  navigationMenu.setup = function () {
    setupControlsAndMenus();
    // Allow popover light-dismiss natively on click; avoid closing on hover across graph gap
    const graphElement = document.querySelector("#graph");
    if (graphElement) {
      graphElement.addEventListener(
        "touchstart",
        function () {
          navigationMenu.hideAllMenus();
        },
        { passive: true },
      );
    }
    const generalDetails = document.querySelector("#generalDetails");
    if (generalDetails) {
      generalDetails.addEventListener(
        "touchstart",
        function () {
          navigationMenu.hideAllMenus();
        },
        { passive: true },
      );
    }

    // Sync active-menu-item class, positioning, and export state when popovers toggle
    document.querySelectorAll(".modern-popover").forEach(function (popover) {
      popover.addEventListener("toggle", function (event) {
        const menuId = this.id;
        const controllerIdx = m_select.indexOf(menuId);
        const controllerId =
          controllerIdx > -1 ? c_select[controllerIdx] : null;

        const isOpen =
          event && event.newState
            ? event.newState === "open"
            : this.matches(":popover-open");

        // Reset drag classes and runtime positioning data when state changes.
        this.classList.remove(
          "dragging",
          "has-dragged",
          "snap-back",
          "sheet-dismissing",
        );
        clearSheetDragY(this);

        if (isOpen) {
          if (controllerId && controllerId !== "c_search") {
            const ctrlEl = document.querySelector("#" + controllerId);
            if (ctrlEl) {
              ctrlEl.classList.add("active-menu-item");
            }
          }
          currentlyVisibleMenu = document.querySelector("#" + menuId);
          if (controllerId) {
            currentlyHoveredEntry = document.querySelector("#" + controllerId);
          }
          if (menuId === "m_export") {
            graph.options().exportMenu().exportAsUrl();
          }
          updateMenuPosition(controllerId);
        } else {
          if (controllerId && controllerId !== "c_search") {
            const ctrlEl = document.querySelector("#" + controllerId);
            if (ctrlEl) {
              ctrlEl.classList.remove("active-menu-item");
            }
          }
        }
      });
    });

    // Contain user interactions inside popovers so they don't propagate to background graph canvas
    const popoverElements =
      typeof document !== "undefined" &&
      typeof document.querySelectorAll === "function"
        ? document.querySelectorAll(".modern-popover")
        : [];
    const interactionEvents = [
      "click",
      "mousedown",
      "mouseup",
      "pointerdown",
      "pointerup",
      "touchstart",
      "touchend",
      "wheel",
    ];
    popoverElements.forEach(function (popover) {
      if (!popover || typeof popover.addEventListener !== "function") {
        return;
      }
      interactionEvents.forEach(function (eventType) {
        popover.addEventListener(eventType, function (event) {
          if (event && typeof event.stopPropagation === "function") {
            event.stopPropagation();
          }
        });
      });
    });

    setupMobileSheetDragDismiss();
  };

  function setupMobileSheetDragDismiss() {
    document
      .querySelectorAll(".modern-popover")
      .forEach(function (popoverNode) {
        if (!popoverNode.querySelectorAll) {
          return;
        }
        const dragAreaNodes = popoverNode.querySelectorAll(
          ".sheet-handle, .popover-header",
        );

        let startY = 0;
        let startTime = 0;
        let currentDy = 0;
        let isDragging = false;

        function onTouchStart(event) {
          if (window.innerWidth > 768) {
            return;
          }
          // Don't start drag gesture if tapping close button
          if (
            event.target &&
            typeof event.target.closest === "function" &&
            event.target.closest(".popover-close-btn")
          ) {
            return;
          }
          if (event.touches && event.touches.length === 1) {
            startY = event.touches[0].clientY;
            startTime = Date.now();
            currentDy = 0;
            isDragging = true;
            popoverNode.classList.add("dragging", "has-dragged");
            popoverNode.classList.remove("snap-back", "sheet-dismissing");
          }
        }

        function onTouchMove(event) {
          if (!isDragging || window.innerWidth > 768) {
            return;
          }
          if (event.touches && event.touches.length === 1) {
            const currentY = event.touches[0].clientY;
            let dy = currentY - startY;

            // Clamp upward drag so full-width bottom sheet cannot be torn away from bottom of screen
            if (dy < 0) {
              dy = 0;
            }

            currentDy = dy;
            setSheetDragY(popoverNode, dy + "px");

            if (event.cancelable) {
              event.preventDefault();
            }
          }
        }

        function onTouchEnd() {
          if (!isDragging) {
            return;
          }
          isDragging = false;
          const duration = Date.now() - startTime;
          const velocity = currentDy / Math.max(1, duration);

          popoverNode.classList.remove("dragging");

          const dismissThreshold = 80;
          const velocityThreshold = 0.3;

          if (
            currentDy >= dismissThreshold ||
            (currentDy > 20 && velocity > velocityThreshold)
          ) {
            // Slide off-screen down and hide popover
            popoverNode.classList.add("sheet-dismissing");
            setTimeout(function () {
              try {
                if (popoverNode.matches(":popover-open")) {
                  popoverNode.hidePopover();
                }
              } catch {
                /* ignore */
              }
              clearSheetDragY(popoverNode);
              popoverNode.classList.remove("sheet-dismissing");
            }, 200);
          } else {
            // Snap back into place
            popoverNode.classList.add("snap-back");
            setSheetDragY(popoverNode, "0px");
            setTimeout(function () {
              clearSheetDragY(popoverNode);
              popoverNode.classList.remove("snap-back");
            }, 250);
          }
        }

        dragAreaNodes.forEach(function (node) {
          if (node && typeof node.addEventListener === "function") {
            node.addEventListener("touchstart", onTouchStart, {
              passive: true,
            });
            node.addEventListener("touchmove", onTouchMove, { passive: false });
            node.addEventListener("touchend", onTouchEnd, { passive: true });
            node.addEventListener("touchcancel", onTouchEnd, { passive: true });
          }
        });
      });
  }

  return navigationMenu;
};
