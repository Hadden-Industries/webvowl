import { namespaces } from "vowl";
import { runVisualizationControlAction } from "./ui/visualizationControlAction.js";

const ANNOTATION_FALLBACK_NAMESPACES = Object.freeze({
  rdf: namespaces.rdf,
  rdfs: namespaces.rdfs,
  owl: namespaces.owl,
  xsd: namespaces.xsd,
  skos: namespaces.skos,
  dcterms: namespaces.dcterms,
  dc: namespaces.dc,
});

const NAVIGABLE_IRI_SCHEMES = new Set(["http:", "https:", "urn:"]);

export function navigableOntologyIri(value) {
  if (typeof value !== "string") {
    return undefined;
  }
  const iri = value.trim();
  if (!iri) {
    return undefined;
  }

  try {
    const parsedIri = new URL(iri);
    return NAVIGABLE_IRI_SCHEMES.has(parsedIri.protocol.toLowerCase())
      ? iri
      : undefined;
  } catch {
    return undefined;
  }
}

function appendIriLabel(element, name, iri) {
  const href = navigableOntologyIri(iri);
  const tag = document.createElement(href ? "a" : "span");
  element.appendChild(tag);

  if (href) {
    tag.setAttribute("href", href);
    tag.setAttribute("title", href);
    tag.setAttribute("target", "_blank");
  }
  tag.textContent = name;
}

export function renderOntologyIri(element, iri) {
  element.textContent = "";
  const label =
    typeof iri === "string" && iri.trim() ? iri.trim() : "not given";
  appendIriLabel(element, label, iri);
}

/**
 * Contains the logic for the sidebar.
 * @returns {{}}
 */
export function createSidebar({
  languageConstants,
  languageTools,
  webVowlController,
  onViewportGeometryChanged = () => {},
  hideNavigationMenus = () => {},
  updateNavigationOverflow = () => {},
  onToggleDetailsPanel,
}) {
  const sidebar = {};
  const lifecycleAbortController = new AbortController();
  let activeOntologySummaryLanguage = null;
  // Required for reloading when the language changes
  let isSidebarVisible = false;
  // The last editor mode the renderer reported, kept here so no presentation
  // asks the renderer which mode it is in.
  let isEditorMode = false;
  let isSetup = false;
  let isSidebarAnimationInitialized = false;
  let removeNoTransitionClassAnimationFrame;
  let ownsNoTransitionClass = false;

  const detailsSidebar = document.querySelector("#detailsArea");
  const documentBody = document.querySelector("body");
  const graphCanvasArea = document.querySelector("#canvasArea");
  const sidebarToggleButton = document.querySelector("#sidebarExpandButton");

  /**
   * Setup the menu bar.
   */

  sidebar.clearOntologyInformation = function () {
    document.querySelector("#title").textContent = "No title available";
    renderOntologyIri(document.querySelector("#about"));
    document.querySelector("#version").textContent = "--";
    document.querySelector("#authors").textContent = "--";
    document.querySelector("#description").textContent =
      "No description available.";
    const container = document.querySelector("#ontology-metadata");
    container.innerHTML = "";
    document.querySelector("#classCount").textContent = "0";
    document.querySelector("#objectPropertyCount").textContent = "0";
    document.querySelector("#datatypePropertyCount").textContent = "0";
    document.querySelector("#individualCount").textContent = "0";
    document.querySelector("#nodeCount").textContent = "0";
    document.querySelector("#edgeCount").textContent = "0";
  };

  /**
   * Updates the information of the passed ontology.
   * @param data the graph data
   * @param statistics the statistics module
   */
  // Controller state, not renderer internals, drives the ontology panel.
  sidebar.renderOntologySummary = function (ontologySummary) {
    // Presenting a summary is what makes the ontology details readable; the
    // section ships hidden and nothing else reveals it.
    revealDetailsSectionForCurrentMode();
    const ontologyHeader = ontologySummary.ontologyHeader;
    const elementCounts = ontologySummary.elementCounts;

    document.querySelector("#title").textContent =
      ontologyHeader.title || "No title available";
    renderOntologyIri(
      document.querySelector("#about"),
      ontologyHeader.ontologyIri,
    );
    document.querySelector("#version").textContent =
      ontologyHeader.versionInformationText || "--";
    document.querySelector("#authors").textContent =
      ontologyHeader.authorNames.length > 0
        ? ontologyHeader.authorNames.join(", ")
        : "--";
    document.querySelector("#description").textContent =
      ontologyHeader.description || "No description available.";

    displayMetadata(
      annotationGroupsFromRecords(
        ontologyHeader.annotationRecords ?? [],
        undefined,
        false,
      ),
    );

    activeOntologySummaryLanguage = ontologySummary.selectedLanguage ?? null;
    setLanguages(ontologySummary.availableLabelLanguages);

    const visibleGraphCounts = ontologySummary.visibleGraphCounts ?? {
      visibleNodeCount: 0,
      visiblePropertyCount: 0,
    };
    document.querySelector("#classCount").textContent =
      elementCounts.classCount;
    document.querySelector("#objectPropertyCount").textContent =
      elementCounts.objectPropertyCount;
    document.querySelector("#datatypePropertyCount").textContent =
      elementCounts.datatypePropertyCount;
    document.querySelector("#individualCount").textContent =
      elementCounts.individualCount;
    document.querySelector("#nodeCount").textContent =
      visibleGraphCounts.visibleNodeCount;
    document.querySelector("#edgeCount").textContent =
      visibleGraphCounts.visiblePropertyCount;
  };

  function getBrowserLanguages() {
    const nav = typeof navigator !== "undefined" ? navigator : {};
    const browserLangs = [];
    if (Array.isArray(nav.languages)) {
      for (let i = 0; i < nav.languages.length; i++) {
        const l = nav.languages[i];
        if (l && typeof l === "string" && browserLangs.indexOf(l) === -1) {
          browserLangs.push(l);
        }
      }
    }
    if (
      nav.language &&
      typeof nav.language === "string" &&
      browserLangs.indexOf(nav.language) === -1
    ) {
      browserLangs.push(nav.language);
    }
    if (
      nav.userLanguage &&
      typeof nav.userLanguage === "string" &&
      browserLangs.indexOf(nav.userLanguage) === -1
    ) {
      browserLangs.push(nav.userLanguage);
    }
    return browserLangs;
  }

  function findBestMatchingLanguage(languages) {
    if (!languages || languages.length === 0) {
      return null;
    }

    const browserLangs = getBrowserLanguages();

    // 1. Try exact matches with browser languages (case-insensitive)
    for (let i = 0; i < browserLangs.length; i++) {
      const bLang = browserLangs[i].toLowerCase();
      for (let j = 0; j < languages.length; j++) {
        if (
          typeof languages[j] === "string" &&
          languages[j].toLowerCase() === bLang
        ) {
          return languages[j];
        }
      }
    }

    // 2. Try primary language tag matches (e.g., "de-DE" matches "de", or "de" matches "de-DE")
    for (let k = 0; k < browserLangs.length; k++) {
      if (typeof browserLangs[k] !== "string") {
        continue;
      }
      const primaryBLang = browserLangs[k].split("-")[0].toLowerCase();
      for (let m = 0; m < languages.length; m++) {
        if (typeof languages[m] !== "string") {
          continue;
        }
        const langLower = languages[m].toLowerCase();
        const primaryLang = langLower.split("-")[0];
        if (langLower === primaryBLang || primaryLang === primaryBLang) {
          return languages[m];
        }
      }
    }

    // 3. Fallback: English ("en" or "en-*")
    for (let n = 0; n < languages.length; n++) {
      if (typeof languages[n] === "string") {
        const lLower = languages[n].toLowerCase();
        if (lLower === "en" || lLower.split("-")[0] === "en") {
          return languages[n];
        }
      }
    }

    // 4. Fallback: LANG_UNDEFINED ("undefined")
    const langUndefined = languageConstants.undefinedLanguage;
    if (languages.indexOf(langUndefined) >= 0) {
      return langUndefined;
    }

    // 5. Fallback: LANG_IRIBASED ("id")
    const langIri = languageConstants.iriBasedLanguage;
    if (languages.indexOf(langIri) >= 0) {
      return langIri;
    }

    // 6. Fallback: First language in list
    return languages[0];
  }

  function setLanguages(languages) {
    const availableLanguages = Array.isArray(languages) ? [...languages] : [];
    if (!availableLanguages.includes("default")) {
      availableLanguages.push("default");
    }

    // Put the default and unset label on top of the selection labels
    availableLanguages.sort(function (a, b) {
      if (a === languageConstants.iriBasedLanguage) {
        return -1;
      } else if (b === languageConstants.iriBasedLanguage) {
        return 1;
      }
      if (a === languageConstants.undefinedLanguage) {
        return -1;
      } else if (b === languageConstants.undefinedLanguage) {
        return 1;
      }
      return a.localeCompare(b);
    });

    const languageSelect = document.querySelector("#language");
    const languageOptions = availableLanguages.map(function (language) {
      const option = document.createElement("option");
      option.value = language;
      option.textContent = language;
      return option;
    });
    languageSelect.replaceChildren(...languageOptions);

    // The controller's own language wins; the sidebar only proposes the
    // reader's preferred one when the controller is not holding a choice.
    if (typeof activeOntologySummaryLanguage === "string") {
      const activeIndex = availableLanguages.indexOf(
        activeOntologySummaryLanguage,
      );
      if (activeIndex >= 0) {
        languageSelect.selectedIndex = activeIndex;
      }
      languageSelect.value = activeOntologySummaryLanguage;
      return;
    }

    const selectedLanguage = findBestMatchingLanguage(availableLanguages);
    if (selectedLanguage) {
      const langIndex = availableLanguages.indexOf(selectedLanguage);
      if (langIndex >= 0) {
        languageSelect.selectedIndex = langIndex;
      }
      languageSelect.value = selectedLanguage;
      // A fact for the controller: this is the language the reader prefers.
      runVisualizationControlAction(
        () =>
          webVowlController?.setVisualizationView({
            language: selectedLanguage,
          }),
        document,
      );
    }
  }

  function displayMetadata(metadata) {
    const container = document.querySelector("#ontology-metadata");
    container.innerHTML = "";

    listAnnotations(container, metadata);

    if (container.querySelectorAll(".annotation").length <= 0) {
      const p = document.createElement("p");
      p.textContent = "No annotations available.";
      container.appendChild(p);
    }
  }

  function isLanguageMatch(entryLang, preferredLang) {
    if (!entryLang || !preferredLang) {
      return false;
    }
    const e = String(entryLang).toLowerCase().trim();
    const p = String(preferredLang).toLowerCase().trim();
    if (e === p) {
      return true;
    }
    const eBase = e.split("-")[0];
    const pBase = p.split("-")[0];
    return eBase.length > 0 && eBase === pBase;
  }

  function filterAnnotationItems(items, preferredLanguage) {
    if (!items || items.length === 0) {
      return [];
    }

    const universalEntries = [];
    const languageEntries = [];

    const langUndefined = languageConstants.undefinedLanguage;
    const langIri = languageConstants.iriBasedLanguage;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const lang = item.language;
      if (
        item.type === "iri" ||
        !lang ||
        lang === "undefined" ||
        lang === "id" ||
        lang === langUndefined ||
        lang === langIri
      ) {
        universalEntries.push(item);
      } else {
        languageEntries.push(item);
      }
    }

    if (languageEntries.length === 0) {
      return universalEntries;
    }

    if (preferredLanguage) {
      const preferredMatches = languageEntries.filter(function (item) {
        return isLanguageMatch(item.language, preferredLanguage);
      });
      if (preferredMatches.length > 0) {
        return universalEntries.concat(preferredMatches);
      }
    }

    // Fallback to English ("en") if preferred language didn't match
    const englishMatches = languageEntries.filter(function (item) {
      return isLanguageMatch(item.language, "en");
    });
    if (englishMatches.length > 0) {
      return universalEntries.concat(englishMatches);
    }

    // Final fallback: return all universal entries + language entries
    return universalEntries.concat(languageEntries);
  }

  function listAnnotations(container, annotationObject) {
    annotationObject = annotationObject || {};
    const preferredLanguage = webVowlController?.getState().view?.language;

    const annotations = [];
    for (const annotation in annotationObject) {
      if (Object.prototype.hasOwnProperty.call(annotationObject, annotation)) {
        const rawItems = annotationObject[annotation];
        const items = filterAnnotationItems(rawItems, preferredLanguage);
        if (items && items.length > 0) {
          const sortedItems = items.slice(0).sort(function (a, b) {
            const valA = String(a.value);
            const valB = String(b.value);
            if (valA < valB) {
              return -1;
            }
            if (valA > valB) {
              return 1;
            }
            return 0;
          });
          sortedItems.forEach(function (item) {
            annotations.push(item);
          });
        }
      }
    }

    container.querySelectorAll(".annotation").forEach(function (el) {
      el.remove();
    });

    annotations.forEach(function (d) {
      const p = document.createElement("p");
      p.classList.add("annotation", "statisticDetails");
      p.setAttribute("data-identifier", d.identifier);
      container.appendChild(p);

      let predicateIri = null;
      let localName = null;
      if (d.predicateNs) {
        const rawLocal = d.identifier.replace(/^[^:]+:/, "");
        predicateIri = d.predicateNs + rawLocal;
        localName = rawLocal;
      } else if (d.identifier && d.identifier.indexOf(":") !== -1) {
        const parts = d.identifier.split(":");
        const prefix = parts[0];
        localName = parts.slice(1).join(":");
        if (ANNOTATION_FALLBACK_NAMESPACES[prefix]) {
          predicateIri = ANNOTATION_FALLBACK_NAMESPACES[prefix] + localName;
        }
      }

      if (predicateIri && localName) {
        appendIriLabel(p, localName, predicateIri);
        p.appendChild(document.createTextNode(": "));
      } else {
        p.appendChild(document.createTextNode(d.identifier + ": "));
      }

      const valueSpan = document.createElement("span");
      p.appendChild(valueSpan);
      if (d.type === "iri") {
        appendIriLabel(valueSpan, d.value, d.value);
      } else {
        valueSpan.textContent = d.value;
      }
    });
  }

  // VOWL groups annotations under a bare local name and the DOM helper below
  // still consumes that shape, so a description's flat annotation list is
  // regrouped here rather than duplicating the helper.
  function annotationGroupsFromRecords(
    annotationRecords,
    displayLabel,
    omitDisplayedLabel = true,
  ) {
    const annotationGroups = Object.create(null);
    for (const annotationRecord of annotationRecords) {
      const { localName, propertyIri, languageTag, text } = annotationRecord;
      // The preferred name is shown as Name, and a label equal to it adds
      // nothing; a differing rdfs:label is surfaced under its own heading.
      if (omitDisplayedLabel && localName === "prefLabel") {
        continue;
      }
      const groupName = localName === "label" ? "rdfs:label" : localName;
      if (
        omitDisplayedLabel &&
        localName === "label" &&
        text === displayLabel
      ) {
        continue;
      }
      annotationGroups[groupName] ||= [];
      annotationGroups[groupName].push({
        identifier: groupName,
        value: text,
        type: annotationRecord.valueKind === "iri" ? "iri" : "label",
        language: languageTag ?? "undefined",
        predicateNs:
          propertyIri === null
            ? undefined
            : propertyIri.slice(0, propertyIri.length - localName.length),
      });
    }
    return annotationGroups;
  }

  /** Collapsible Sidebar functions; **/

  sidebar.updateDockedControlsPosition = function () {
    const isHidden = detailsSidebar.classList.contains("hidden");
    const zoomSlider = document.querySelector("#zoomSlider");

    zoomSlider.classList.toggle("aligned-to-sidebar", !isHidden);
    sidebarToggleButton.classList.toggle("aligned-to-sidebar", !isHidden);
  };

  function updateNavMenuScrollButtons() {
    updateNavigationOverflow();
  }

  function hideNavMenus() {
    hideNavigationMenus();
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
    documentBody.classList.remove("no-transition");
    ownsNoTransitionClass = false;
  }

  sidebar.showSidebar = function (
    requestedVisibilityValue,
    shouldSuppressInitialTransition,
  ) {
    if (shouldSuppressInitialTransition === true) {
      cancelPendingNoTransitionClassRemoval();
      documentBody.classList.add("no-transition");
      ownsNoTransitionClass = true;
    }

    if (requestedVisibilityValue === 1 && window.innerWidth > 1024) {
      isSidebarVisible = true;
      sidebarToggleButton.textContent = ">";
      detailsSidebar.classList.remove("hidden");
      graphCanvasArea.classList.add("sidebar-visible");
      document
        .querySelector("#WarningErrorMessagesContainer")
        .classList.add("sidebar-visible");
    } else {
      isSidebarVisible = false;
      sidebarToggleButton.textContent = "<";
      detailsSidebar.classList.add("hidden");
      graphCanvasArea.classList.remove("sidebar-visible");
      document
        .querySelector("#WarningErrorMessagesContainer")
        .classList.remove("sidebar-visible");
    }

    detailsSidebar.inert = !isSidebarVisible;
    sidebarToggleButton.setAttribute("aria-expanded", String(isSidebarVisible));
    sidebarToggleButton.setAttribute(
      "aria-label",
      isSidebarVisible ? "Hide details panel" : "Show details panel",
    );

    sidebar.updateDockedControlsPosition();
    onViewportGeometryChanged();
    updateNavMenuScrollButtons();

    if (shouldSuppressInitialTransition === true) {
      removeNoTransitionClassAnimationFrame = requestAnimationFrame(
        function () {
          removeNoTransitionClassAnimationFrame = undefined;
          removeOwnedNoTransitionClass();
        },
      );
    }
  };

  sidebar.isSidebarVisible = function () {
    return isSidebarVisible;
  };

  sidebar.updateSideBarVis = function (shouldSuppressInitialTransition) {
    const storedVisibilityValue = sidebar.getSidebarVisibility();
    sidebar.showSidebar(
      Number.parseInt(storedVisibilityValue, 10),
      shouldSuppressInitialTransition,
    );
  };

  sidebar.getSidebarVisibility = function () {
    return detailsSidebar.classList.contains("hidden") ? "0" : "1";
  };

  sidebar.initSideBarAnimation = function () {
    if (isSidebarAnimationInitialized) {
      return;
    }
    isSidebarAnimationInitialized = true;
    graphCanvasArea.addEventListener(
      "transitionend",
      function (event) {
        if (event.propertyName !== "width") {
          return;
        }
        detailsSidebar.classList.toggle("hidden", !isSidebarVisible);
        onViewportGeometryChanged();
        updateNavMenuScrollButtons();
      },
      { signal: lifecycleAbortController.signal },
    );
  };

  sidebar.setup = function () {
    if (isSetup) {
      return;
    }
    isSetup = true;
    sidebar.initSideBarAnimation();

    sidebarToggleButton.addEventListener(
      "click",
      function () {
        hideNavMenus();
        if (onToggleDetailsPanel) {
          onToggleDetailsPanel();
          return;
        }
        const currentVisibilityValue = Number.parseInt(
          sidebar.getSidebarVisibility(),
          10,
        );
        if (currentVisibilityValue === 1) {
          sidebar.showSidebar(0);
        } else {
          sidebar.showSidebar(1);
        }
      },
      { signal: lifecycleAbortController.signal },
    );

    sidebarToggleButton.addEventListener(
      "contextmenu",
      function (event) {
        event.preventDefault();
      },
      { signal: lifecycleAbortController.signal },
    );

    sidebar.showSidebar(0, true);
  };

  sidebar.dispose = function () {
    lifecycleAbortController.abort();
    cancelPendingNoTransitionClassRemoval();
    removeOwnedNoTransitionClass();
  };

  function revealDetailsSectionForCurrentMode() {
    document
      .querySelector("#generalDetails")
      .classList.toggle("hidden", isEditorMode);
    document
      .querySelector("#generalDetailsEdit")
      .classList.toggle("hidden", !isEditorMode);
  }

  // The renderer publishes which mode it is in; this module keeps its own copy
  // of the last reported mode rather than asking the renderer for it.
  sidebar.renderEditorMode = function (nextIsEditorMode) {
    isEditorMode = nextIsEditorMode === true;
    revealDetailsSectionForCurrentMode();
  };

  return sidebar;
}
