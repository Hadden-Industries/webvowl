/**
 * Contains the logic for the sidebar.
 * @param graph the graph that belongs to these controls
 * @returns {{}}
 */
module.exports = function (graph) {
  const leftSidebar = {};
  const collapseButton = document.querySelector("#leftSideBarCollapseButton");
  let visibleSidebar = 0;
  const sideBarContent = document.querySelector("#leftSideBarContent");
  const sideBarContainer = document.querySelector("#containerForLeftSideBar");
  const defaultClassSelectionContainers = [];
  const defaultDatatypeSelectionContainers = [];
  const defaultPropertySelectionContainers = [];

  leftSidebar.setup = function () {
    setupCollapsing();

    collapseButton.addEventListener("click", function () {
      graph.options().navigationMenu().hideAllMenus();
      const settingValue = parseInt(leftSidebar.getSidebarVisibility());
      if (settingValue === 0) {
        leftSidebar.showSidebar(1);
      } else {
        leftSidebar.showSidebar(0);
      }
    });

    collapseButton.addEventListener("contextmenu", function (event) {
      if (event) {
        event.preventDefault();
      }
    });

    setupSelectionContainers();
  };

  leftSidebar.hideCollapseButton = function (val) {
    sideBarContainer.classList.toggle("hidden", val);
    collapseButton.classList.toggle("hidden", val);
  };

  function unselectAllElements(container) {
    for (let i = 0; i < container.length; i++) {
      container[i].classList.remove("defaultSelected");
    }
  }

  function selectThisDefaultElement(element) {
    element.classList.add("defaultSelected");
  }

  function updateDefaultNameInAccordion(element, identifier) {
    let elementDescription = "";
    if (identifier === "defaultClass") {
      elementDescription = "Class: ";
    }
    if (identifier === "defaultDatatype") {
      elementDescription = "Datatype: ";
    }
    if (identifier === "defaultProperty") {
      elementDescription = "Property: ";
    }

    document.querySelector("#" + identifier).innerHTML =
      elementDescription + element.innerHTML;
    document.querySelector("#" + identifier).title = element.innerHTML;
  }

  function classSelectorFunction() {
    unselectAllElements(defaultClassSelectionContainers);
    selectThisDefaultElement(this);
    updateDefaultNameInAccordion(this, "defaultClass");
  }

  function datatypeSelectorFunction() {
    unselectAllElements(defaultDatatypeSelectionContainers);
    selectThisDefaultElement(this);
    updateDefaultNameInAccordion(this, "defaultDatatype");
  }

  function propertySelectorFunction() {
    unselectAllElements(defaultPropertySelectionContainers);
    selectThisDefaultElement(this);
    updateDefaultNameInAccordion(this, "defaultProperty");
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
    let i;

    for (i = 0; i < supportedClasses.length; i++) {
      const aClassSelectionContainer = document.createElement("div");
      classContainer.appendChild(aClassSelectionContainer);
      aClassSelectionContainer.classList.add("containerForDefaultSelection");
      aClassSelectionContainer.classList.add("noselect");
      aClassSelectionContainer.id = "selectedClass" + supportedClasses[i];
      aClassSelectionContainer.innerHTML = supportedClasses[i];

      if (supportedClasses[i] === defaultClass) {
        selectThisDefaultElement(aClassSelectionContainer);
      }
      aClassSelectionContainer.addEventListener("click", classSelectorFunction);
      defaultClassSelectionContainers.push(aClassSelectionContainer);
    }

    for (i = 0; i < supportedDatatypes.length; i++) {
      const aDTSelectionContainer = document.createElement("div");
      datatypeContainer.appendChild(aDTSelectionContainer);
      aDTSelectionContainer.classList.add("containerForDefaultSelection");
      aDTSelectionContainer.classList.add("noselect");
      aDTSelectionContainer.id = "selectedDatatype" + supportedDatatypes[i];
      aDTSelectionContainer.innerHTML = supportedDatatypes[i];

      if (supportedDatatypes[i] === defaultDatatype) {
        selectThisDefaultElement(aDTSelectionContainer);
      }
      aDTSelectionContainer.addEventListener("click", datatypeSelectorFunction);
      defaultDatatypeSelectionContainers.push(aDTSelectionContainer);
    }
    for (i = 0; i < supportedProperties.length; i++) {
      const aPropSelectionContainer = document.createElement("div");
      propertyContainer.appendChild(aPropSelectionContainer);
      aPropSelectionContainer.classList.add("containerForDefaultSelection");
      aPropSelectionContainer.classList.add("noselect");
      aPropSelectionContainer.id = "selectedClass" + supportedProperties[i];
      aPropSelectionContainer.innerHTML = supportedProperties[i];
      aPropSelectionContainer.addEventListener(
        "click",
        propertySelectorFunction,
      );
      if (supportedProperties[i] === defaultProperty) {
        selectThisDefaultElement(aPropSelectionContainer);
      }
      defaultPropertySelectionContainers.push(aPropSelectionContainer);
    }
  }

  function setupCollapsing() {
    const triggers = document.querySelectorAll(".accordion-trigger");

    triggers.forEach(function (trigger) {
      trigger.setAttribute("tabindex", "0");
      trigger.setAttribute("role", "button");
      trigger.addEventListener("keydown", function (event) {
        const evt = event || window.event;
        if (evt && (evt.key === "Enter" || evt.key === " ")) {
          evt.preventDefault();
          this.click();
        }
      });

      trigger.addEventListener("click", function () {
        if (this.classList.contains("accordion-trigger-active")) {
          // Collapse the active
          this.nextElementSibling.classList.add("hidden");
          this.classList.remove("accordion-trigger-active");
        } else {
          // expand the selected one
          this.nextElementSibling.classList.remove("hidden");
          this.classList.add("accordion-trigger-active");
        }
      });
    });
  }

  leftSidebar.isSidebarVisible = function () {
    return visibleSidebar;
  };

  leftSidebar.updateSideBarVis = function (init) {
    const vis = leftSidebar.getSidebarVisibility();
    leftSidebar.showSidebar(parseInt(vis), init);
  };

  leftSidebar.showSidebar = function (val, init) {
    const collapseButton = document.querySelector("#leftSideBarCollapseButton");

    if (init === true) {
      document.body.classList.add("no-transition");
    }

    const isVisible = val === 1;
    visibleSidebar = isVisible;
    collapseButton.innerHTML = isVisible ? "<" : ">";

    sideBarContent.classList.toggle("hidden", !isVisible);
    sideBarContainer.classList.toggle("sidebar-visible", isVisible);
    collapseButton.classList.toggle("aligned-to-left-sidebar", isVisible);
    collapseButton.classList.toggle(
      "hidden",
      sideBarContainer.classList.contains("hidden"),
    );

    document
      .querySelector("#WarningErrorMessages")
      .classList.toggle("aligned-to-left-sidebar", isVisible);

    graph.updateCanvasContainerSize();
    graph.options().navigationMenu().updateScrollButtonVisibility();

    if (init === true) {
      requestAnimationFrame(function () {
        document.body.classList.remove("no-transition");
      });
    }
  };

  leftSidebar.getSidebarVisibility = function () {
    const isHidden = sideBarContent.classList.contains("hidden");
    if (isHidden === false) {
      return String(1);
    }
    if (isHidden === true) {
      return String(0);
    }
  };

  return leftSidebar;
};
