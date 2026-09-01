/**
 * Contains the logic for the sidebar.
 * @param graph the graph that belongs to these controls
 * @returns {{}}
 */
export function createLeftSidebar(graph) {
  const leftSidebar = {};
  const lifecycleAbortController = new AbortController();
  const sidebarCollapseButton = document.querySelector(
    "#leftSideBarCollapseButton",
  );
  let isSetup = false;
  let removeNoTransitionClassAnimationFrame;
  let ownsNoTransitionClass = false;
  let isSidebarVisible = false;
  const sidebarContent = document.querySelector("#leftSideBarContent");
  const sidebarContainer = document.querySelector("#containerForLeftSideBar");
  const defaultClassSelectionControls = [];
  const defaultDatatypeSelectionControls = [];
  const defaultPropertySelectionControls = [];

  leftSidebar.setup = function () {
    if (isSetup || lifecycleAbortController.signal.aborted) {
      return;
    }
    isSetup = true;
    setupCollapsing();

    sidebarCollapseButton.addEventListener(
      "click",
      function () {
        graph.options().navigationMenu().hideAllMenus();
        const currentVisibilityValue = Number.parseInt(
          leftSidebar.getSidebarVisibility(),
          10,
        );
        if (currentVisibilityValue === 0) {
          leftSidebar.showSidebar(1);
        } else {
          leftSidebar.showSidebar(0);
        }
      },
      { signal: lifecycleAbortController.signal },
    );

    sidebarCollapseButton.addEventListener(
      "contextmenu",
      function (event) {
        event.preventDefault();
      },
      { signal: lifecycleAbortController.signal },
    );

    setupSelectionContainers();
  };

  leftSidebar.hideCollapseButton = function (shouldHide) {
    sidebarContainer.classList.toggle("hidden", shouldHide);
    sidebarCollapseButton.classList.toggle("hidden", shouldHide);
  };

  function unselectAllElements(selectionControls) {
    for (const selectionControl of selectionControls) {
      selectionControl.classList.remove("defaultSelected");
    }
  }

  function selectThisDefaultElement(element) {
    element.classList.add("defaultSelected");
  }

  function updateDefaultNameInAccordion(selectedControl, defaultOptionName) {
    let elementDescription = "";
    if (defaultOptionName === "defaultClass") {
      elementDescription = "Class: ";
      graph.options().defaultClass(selectedControl.textContent);
    }
    if (defaultOptionName === "defaultDatatype") {
      elementDescription = "Datatype: ";
      graph.options().defaultDatatype(selectedControl.textContent);
    }
    if (defaultOptionName === "defaultProperty") {
      elementDescription = "Property: ";
      graph.options().defaultProperty(selectedControl.textContent);
    }

    const defaultOptionHeading = document.querySelector(
      "#" + defaultOptionName,
    );
    defaultOptionHeading.textContent =
      elementDescription + selectedControl.textContent;
    defaultOptionHeading.title = selectedControl.textContent;
  }

  function handleClassSelection(event) {
    const selectedClassControl = event.currentTarget;
    unselectAllElements(defaultClassSelectionControls);
    selectThisDefaultElement(selectedClassControl);
    updateDefaultNameInAccordion(selectedClassControl, "defaultClass");
  }

  function handleDatatypeSelection(event) {
    const selectedDatatypeControl = event.currentTarget;
    unselectAllElements(defaultDatatypeSelectionControls);
    selectThisDefaultElement(selectedDatatypeControl);
    updateDefaultNameInAccordion(selectedDatatypeControl, "defaultDatatype");
  }

  function handlePropertySelection(event) {
    const selectedPropertyControl = event.currentTarget;
    unselectAllElements(defaultPropertySelectionControls);
    selectThisDefaultElement(selectedPropertyControl);
    updateDefaultNameInAccordion(selectedPropertyControl, "defaultProperty");
  }

  function setupSelectionContainers() {
    const classContainer = document.querySelector("#classContainer");
    const datatypeContainer = document.querySelector("#datatypeContainer");
    const propertyContainer = document.querySelector("#propertyContainer");
    // create the supported elements

    const defaultClass = "owl:Class";
    const defaultDatatype = "rdfs:Literal";
    const defaultProperty = "owl:objectProperty";

    const supportedClasses = graph.options().supportedClasses();
    const supportedDatatypes = graph.options().supportedDatatypes();
    const supportedProperties = graph.options().supportedProperties();
    for (const supportedClass of supportedClasses) {
      const classSelectionControl = document.createElement("div");
      classContainer.appendChild(classSelectionControl);
      classSelectionControl.classList.add("containerForDefaultSelection");
      classSelectionControl.classList.add("noselect");
      classSelectionControl.id = "selectedClass" + supportedClass;
      classSelectionControl.textContent = supportedClass;

      if (supportedClass === defaultClass) {
        selectThisDefaultElement(classSelectionControl);
      }
      classSelectionControl.addEventListener("click", handleClassSelection, {
        signal: lifecycleAbortController.signal,
      });
      defaultClassSelectionControls.push(classSelectionControl);
    }

    for (const supportedDatatype of supportedDatatypes) {
      const datatypeSelectionControl = document.createElement("div");
      datatypeContainer.appendChild(datatypeSelectionControl);
      datatypeSelectionControl.classList.add("containerForDefaultSelection");
      datatypeSelectionControl.classList.add("noselect");
      datatypeSelectionControl.id = "selectedDatatype" + supportedDatatype;
      datatypeSelectionControl.textContent = supportedDatatype;

      if (supportedDatatype === defaultDatatype) {
        selectThisDefaultElement(datatypeSelectionControl);
      }
      datatypeSelectionControl.addEventListener(
        "click",
        handleDatatypeSelection,
        { signal: lifecycleAbortController.signal },
      );
      defaultDatatypeSelectionControls.push(datatypeSelectionControl);
    }
    for (const supportedProperty of supportedProperties) {
      const propertySelectionControl = document.createElement("div");
      propertyContainer.appendChild(propertySelectionControl);
      propertySelectionControl.classList.add("containerForDefaultSelection");
      propertySelectionControl.classList.add("noselect");
      propertySelectionControl.id = "selectedClass" + supportedProperty;
      propertySelectionControl.textContent = supportedProperty;
      propertySelectionControl.addEventListener(
        "click",
        handlePropertySelection,
        { signal: lifecycleAbortController.signal },
      );
      if (supportedProperty === defaultProperty) {
        selectThisDefaultElement(propertySelectionControl);
      }
      defaultPropertySelectionControls.push(propertySelectionControl);
    }
  }

  function setupCollapsing() {
    const leftSidebarRoot = document.querySelector("#leftSideBar");
    const triggers = leftSidebarRoot.querySelectorAll(".accordion-trigger");

    triggers.forEach(function (trigger) {
      trigger.setAttribute("tabindex", "0");
      trigger.setAttribute("role", "button");
      trigger.addEventListener(
        "keydown",
        function (event) {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            toggleLeftSidebarAccordionTrigger(event.currentTarget);
          }
        },
        { signal: lifecycleAbortController.signal },
      );

      trigger.addEventListener(
        "click",
        function (event) {
          toggleLeftSidebarAccordionTrigger(event.currentTarget);
        },
        { signal: lifecycleAbortController.signal },
      );
    });
  }

  function toggleLeftSidebarAccordionTrigger(activatedTrigger) {
    if (activatedTrigger.classList.contains("accordion-trigger-active")) {
      activatedTrigger.nextElementSibling.classList.add("hidden");
      activatedTrigger.classList.remove("accordion-trigger-active");
      return;
    }
    activatedTrigger.nextElementSibling.classList.remove("hidden");
    activatedTrigger.classList.add("accordion-trigger-active");
  }

  function cancelPendingNoTransitionClassRemoval() {
    if (
      removeNoTransitionClassAnimationFrame !== undefined &&
      typeof cancelAnimationFrame === "function"
    ) {
      cancelAnimationFrame(removeNoTransitionClassAnimationFrame);
    }
    removeNoTransitionClassAnimationFrame = undefined;
  }

  function removeOwnedNoTransitionClass() {
    if (!ownsNoTransitionClass) {
      return;
    }
    document.body.classList.remove("no-transition");
    ownsNoTransitionClass = false;
  }

  leftSidebar.isSidebarVisible = function () {
    return isSidebarVisible;
  };

  leftSidebar.updateSideBarVis = function (shouldSuppressInitialTransition) {
    const storedVisibilityValue = leftSidebar.getSidebarVisibility();
    leftSidebar.showSidebar(
      Number.parseInt(storedVisibilityValue, 10),
      shouldSuppressInitialTransition,
    );
  };

  leftSidebar.showSidebar = function (
    requestedVisibilityValue,
    shouldSuppressInitialTransition,
  ) {
    if (shouldSuppressInitialTransition === true) {
      cancelPendingNoTransitionClassRemoval();
      document.body.classList.add("no-transition");
      ownsNoTransitionClass = true;
    }

    const isVisible = requestedVisibilityValue === 1;
    isSidebarVisible = isVisible;
    sidebarCollapseButton.textContent = isVisible ? "<" : ">";

    sidebarContent.classList.toggle("hidden", !isVisible);
    sidebarContainer.classList.toggle("sidebar-visible", isVisible);
    sidebarCollapseButton.classList.toggle(
      "aligned-to-left-sidebar",
      isVisible,
    );
    sidebarCollapseButton.classList.toggle(
      "hidden",
      sidebarContainer.classList.contains("hidden"),
    );

    document
      .querySelector("#WarningErrorMessages")
      .classList.toggle("aligned-to-left-sidebar", isVisible);

    graph.updateCanvasContainerSize();
    graph.options().navigationMenu().updateScrollButtonVisibility();

    if (shouldSuppressInitialTransition === true) {
      removeNoTransitionClassAnimationFrame = requestAnimationFrame(
        function () {
          removeNoTransitionClassAnimationFrame = undefined;
          removeOwnedNoTransitionClass();
        },
      );
    }
  };

  leftSidebar.getSidebarVisibility = function () {
    return sidebarContent.classList.contains("hidden") ? "0" : "1";
  };

  leftSidebar.dispose = function () {
    lifecycleAbortController.abort();
    cancelPendingNoTransitionClassRemoval();
    removeOwnedNoTransitionClass();
  };

  return leftSidebar;
}
