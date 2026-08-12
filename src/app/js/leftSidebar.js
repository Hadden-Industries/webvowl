/**
 * Contains the logic for the sidebar.
 * @param graph the graph that belongs to these controls
 * @returns {{}}
 */
module.exports = function (graph) {
  const leftSidebar = {};
  const collapseButton = document.querySelector("#leftSideBarCollapseButton");
  let visibleSidebar = 0;
  let backupVisibility = 0;
  const sideBarContent = document.querySelector("#leftSideBarContent");
  const sideBarContainer = document.querySelector("#containerForLeftSideBar");
  const defaultClassSelectionContainers = [];
  const defaultDatatypeSelectionContainers = [];
  const defaultPropertySelectionContainers = [];

  leftSidebar.setup = function () {
    setupCollapsing();

    collapseButton.on("click", function () {
      graph.options().navigationMenu().hideAllMenus();
      const settingValue = parseInt(leftSidebar.getSidebarVisibility());
      backupVisibility = settingValue;
      if (settingValue === 0) {
        leftSidebar.showSidebar(1);
      } else {
        leftSidebar.showSidebar(0);
      }
    })
      .on("contextmenu", function (event){
        if ( event ) {
          event.preventDefault();
        }
      });

    setupSelectionContainers();
    d3.select("#WarningErrorMessages")
      .node()
      .addEventListener("animationend", function () {
        d3.select("#WarningErrorMessages").style(
          "-webkit-animation-name",
          "none",
        );
      });
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
    let aClassSelectionContainer;
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
      aClassSelectionContainer = classContainer.append("div");
      aClassSelectionContainer.classed("containerForDefaultSelection", true);
      aClassSelectionContainer.classed("noselect", true);
      aClassSelectionContainer.node().id =
        "selectedClass" + supportedClasses[i];
      aClassSelectionContainer.node().innerHTML = supportedClasses[i];

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

    const triggers = d3.selectAll(".accordion-trigger");

    triggers.attr("tabindex", "0").attr("role", "button");
    triggers.on("keydown", function (event){
      var evt = event || window.event;
      if ( evt && (evt.key === "Enter" || evt.key === " ") ) {
        evt.preventDefault();
        d3.select(this).node().click();
      }
    });

    triggers.on("click", function () {
      const selectedTrigger = d3.select(this);
      if (selectedTrigger.classed("accordion-trigger-active")) {
        // Collapse the active (which is also the selected) trigger
        collapseContainers(
          d3.select(selectedTrigger.node().nextElementSibling),
        );
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

  leftSidebar.isSidebarVisible = function () {
    return visibleSidebar;
  };

  leftSidebar.updateSideBarVis = function (init) {
    const vis = leftSidebar.getSidebarVisibility();
    leftSidebar.showSidebar(parseInt(vis), init);
  };

  leftSidebar.initSideBarAnimation = function () {
    sideBarContainer.node().addEventListener("animationend", function () {
      sideBarContent.classed("hidden", !visibleSidebar);
      if (visibleSidebar === true) {
        sideBarContainer.style("width", "200px");
        sideBarContent.classed("hidden", false);
        d3.select("#leftSideBarCollapseButton").style("left", "200px");
        d3.select("#leftSideBarCollapseButton").classed("hidden", false);
        d3.select("#WarningErrorMessages").style("left", "100px");
      } else {
        sideBarContainer.style("width", "0px");
        d3.select("#leftSideBarCollapseButton").style("left", "0px");
        d3.select("#WarningErrorMessages").style("left", "0px");
        d3.select("#leftSideBarCollapseButton").classed("hidden", false);
      }
      graph.updateCanvasContainerSize();
      graph.options().navigationMenu().updateScrollButtonVisibility();
    });
  };

  leftSidebar.showSidebar = function (val, init) {
    const collapseButton = document.querySelector("#leftSideBarCollapseButton");
    
    if (init === true) {
      visibleSidebar = backupVisibility === 0;
      sideBarContent.classed("hidden", !visibleSidebar);
      sideBarContainer.style("-webkit-animation-name", "none");
      d3.select("#WarningErrorMessages").style(
        "-webkit-animation-name",
        "none",
      );
      if (visibleSidebar === true) {
        sideBarContainer.style("width", "200px");
        sideBarContent.classed("hidden", false);
        d3.select("#leftSideBarCollapseButton").style("left", "200px");
        d3.select("#leftSideBarCollapseButton").classed("hidden", false);
        d3.select("#WarningErrorMessages").style("left", "100px");
        collapseButton.node().innerHTML = "<";
      } else {
        sideBarContainer.style("width", "0px");
        d3.select("#WarningErrorMessages").style("left", "0px");
        d3.select("#leftSideBarCollapseButton").style("left", "0px");
        d3.select("#leftSideBarCollapseButton").classed("hidden", false);
        collapseButton.node().innerHTML = ">";
      }

      graph.updateCanvasContainerSize();
      graph.options().navigationMenu().updateScrollButtonVisibility();
      return;
    }

    const isVisible = (val === 1);
    visibleSidebar = isVisible;
    collapseButton.innerHTML = isVisible ? "<" : ">";

    if (val === 1) {
      visibleSidebar = true;
      collapseButton.node().innerHTML = "<";
      // call expand animation;
      sideBarContainer.style("-webkit-animation-name", "l_sbExpandAnimation");
      sideBarContainer.style("-webkit-animation-duration", "0.5s");
      // prepare the animation;

    document
      .querySelector("#WarningErrorMessages")
      .classList.toggle("aligned-to-left-sidebar", isVisible);

      d3.select("#WarningErrorMessages").style(
        "-webkit-animation-name",
        "warn_ExpandLeftBarAnimation",
      );
      d3.select("#WarningErrorMessages").style(
        "-webkit-animation-duration",
        "0.5s",
      );
    }
    if (val === 0) {
      visibleSidebar = false;
      sideBarContent.classed("hidden", true);
      collapseButton.node().innerHTML = ">";
      // call collapse animation
      sideBarContainer.style("-webkit-animation-name", "l_sbCollapseAnimation");
      sideBarContainer.style("-webkit-animation-duration", "0.5s");
      d3.select("#WarningErrorMessages").style(
        "-webkit-animation-name",
        "warn_CollapseLeftBarAnimation",
      );
      d3.select("#WarningErrorMessages").style(
        "-webkit-animation-duration",
        "0.5s",
      );
      d3.select("#WarningErrorMessages").style("left", "0");
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
