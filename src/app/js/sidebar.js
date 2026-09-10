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
}) {
  const sidebar = {};
  const lifecycleAbortController = new AbortController();
  let activeOntologySummaryLanguage = null;
  // Required for reloading when the language changes
  let isSidebarVisible = true;
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

  function toggleOntologyDetailsAccordionTrigger(selectedTrigger) {
    const ontologyDetailsSection = document.querySelector("#generalDetails");
    const activeTriggers = ontologyDetailsSection.querySelectorAll(
      ".accordion-trigger-active",
    );

    if (selectedTrigger.classList.contains("accordion-trigger-active")) {
      if (selectedTrigger.nextElementSibling) {
        selectedTrigger.nextElementSibling.classList.add("hidden");
      }
      selectedTrigger.classList.remove("accordion-trigger-active");
      return;
    }

    ontologyDetailsSection
      .querySelectorAll(".accordion-trigger-active + div")
      .forEach(function (element) {
        element.classList.add("hidden");
      });
    activeTriggers.forEach(function (activeTrigger) {
      activeTrigger.classList.remove("accordion-trigger-active");
    });
    if (selectedTrigger.nextElementSibling) {
      selectedTrigger.nextElementSibling.classList.remove("hidden");
    }
    selectedTrigger.classList.add("accordion-trigger-active");
  }

  function setupCollapsing() {
    // adapted version of this example: http://www.normansblog.de/simple-jquery-accordion/
    const ontologyDetailsSection = document.querySelector("#generalDetails");
    const triggers =
      ontologyDetailsSection.querySelectorAll(".accordion-trigger");

    // Collapse all inactive triggers on startup
    ontologyDetailsSection
      .querySelectorAll(
        ".accordion-trigger:not(.accordion-trigger-active) + div",
      )
      .forEach(function (el) {
        el.classList.add("hidden");
      });

    triggers.forEach(function (trigger) {
      trigger.setAttribute("tabindex", "0");
      trigger.setAttribute("role", "button");
      trigger.addEventListener(
        "keydown",
        function (event) {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            toggleOntologyDetailsAccordionTrigger(event.currentTarget);
          }
        },
        { signal: lifecycleAbortController.signal },
      );

      trigger.addEventListener(
        "click",
        function (event) {
          toggleOntologyDetailsAccordionTrigger(event.currentTarget);
        },
        { signal: lifecycleAbortController.signal },
      );
    });
  }

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

    // clear selectedNode info
    const isTriggerActive = document
      .querySelector("#selection-details-trigger")
      .classList.contains("accordion-trigger-active");
    if (isTriggerActive) {
      toggleOntologyDetailsAccordionTrigger(
        document.querySelector("#selection-details-trigger"),
      );
    }
    showSelectionAdvice();
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
      webVowlController?.setVisualizationView({ language: selectedLanguage });
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

  const RANK_MAP = {
    name: 1,
    "skos:definition": 2,
    definition: 2,
    type: 3,
    inverse: 4,
    domain: 5,
    range: 6,
    subprop: 7,
    superprop: 8,
    equiv: 9,
    disjoint: 10,
    cardinality: 11,
    charac: 12,
    individuals: 13,
    description: 14,
    comment: 15,
    "dcterms:identifier": 16,
    identifier: 16,
    "dcterms:creator": 17,
    creator: 17,
    "dcterms:created": 18,
    created: 18,
    "dcterms:modified": 19,
    modified: 19,
    "rdfs:label": 20,
    label: 20,
    "skos:altLabel": 21,
    altLabel: 21,
    "skos:hiddenLabel": 22,
    hiddenLabel: 22,
    "skos:scopeNote": 23,
    scopeNote: 23,
    "skos:example": 24,
    example: 24,
    "dcterms:source": 25,
    source: 25,
    "skos:changeNote": 26,
    changeNote: 26,
    "skos:editorialNote": 27,
    editorialNote: 27,
    "skos:historyNote": 28,
    historyNote: 28,
    "skos:note": 29,
    note: 29,
    "dcterms:references": 30,
    references: 30,
    "rdfs:seeAlso": 31,
    seeAlso: 31,
    "rdfs:comment": 32,
  };

  function getParagraphIdentifier(pNode) {
    const dataId = pNode.getAttribute("data-identifier");
    if (dataId) {
      return dataId;
    }

    const span = pNode.querySelector("span");
    if (span && span.id) {
      const id = span.id;
      if (id === "propname") {
        return "name";
      }
      if (id === "typeProp" || id === "typeNode") {
        return "type";
      }
      if (id === "classEquivUri" || id === "propEquivUri") {
        return "equiv";
      }
      if (id === "disjointNodes") {
        return "disjoint";
      }
      if (id === "classAttributes" || id === "propAttributes") {
        return "charac";
      }
      if (id === "individuals") {
        return "individuals";
      }
      if (id === "nodeDescription" || id === "propDescription") {
        return "description";
      }
      if (id === "nodeComment" || id === "propComment") {
        return "comment";
      }
      if (id === "subproperties") {
        return "subprop";
      }
      if (id === "superproperties") {
        return "superprop";
      }
      if (
        id === "infoCardinality" ||
        id === "minCardinality" ||
        id === "maxCardinality"
      ) {
        return "cardinality";
      }
      if (id === "inverse") {
        return "inverse";
      }
      if (id === "domain") {
        return "domain";
      }
      if (id === "range") {
        return "range";
      }
      return id;
    }

    const text = pNode.textContent || pNode.innerText || "";
    const parts = text.split(":");
    if (parts.length > 0) {
      return parts[0].trim();
    }
    return "";
  }

  function compareParagraphs(a, b) {
    const idA = getParagraphIdentifier(a);
    const idB = getParagraphIdentifier(b);

    const rankA = RANK_MAP[idA] !== undefined ? RANK_MAP[idA] : 100;
    const rankB = RANK_MAP[idB] !== undefined ? RANK_MAP[idB] : 100;

    if (rankA !== rankB) {
      return rankA - rankB;
    }

    const labelA = String(idA).toLowerCase();
    const labelB = String(idB).toLowerCase();
    if (labelA < labelB) {
      return -1;
    }
    if (labelA > labelB) {
      return 1;
    }

    const textA = String(a.textContent || a.innerText || "").toLowerCase();
    const textB = String(b.textContent || b.innerText || "").toLowerCase();
    if (textA < textB) {
      return -1;
    }
    if (textA > textB) {
      return 1;
    }

    return 0;
  }

  function sortDetailsPane(containerSelector) {
    const parent = document.querySelector(containerSelector);
    if (!parent) {
      return;
    }

    const paragraphs = Array.prototype.slice
      .call(parent.children)
      .filter(function (el) {
        return el.tagName.toLowerCase() === "p";
      });

    paragraphs.sort(compareParagraphs);

    paragraphs.forEach(function (pNode) {
      parent.appendChild(pNode);
    });
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
        const WELL_KNOWN = {
          rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
          rdfs: "http://www.w3.org/2000/01/rdf-schema#",
          owl: "http://www.w3.org/2002/07/owl#",
          xsd: "http://www.w3.org/2001/XMLSchema#",
          skos: "http://www.w3.org/2004/02/skos/core#",
          dcterms: "http://purl.org/dc/terms/",
          dc: "http://purl.org/dc/elements/1.1/",
        };
        const parts = d.identifier.split(":");
        const prefix = parts[0];
        localName = parts.slice(1).join(":");
        if (WELL_KNOWN[prefix]) {
          predicateIri = WELL_KNOWN[prefix] + localName;
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

  /**
   * Update the information of the selected node.
   * @param selectedElement the selection or null if nothing is selected
   */
  // Presentation only: the controller decides what is selected, this renders
  // the description it published. Nothing here reads a drawn element.
  // Presentation only. Selection is cleared by the controller when a load
  // begins, so nothing here clears it as a side effect of summarising.
  sidebar.renderSelectedOntologyElementDetails = function (
    elementDescriptions,
  ) {
    const [elementDescription] = elementDescriptions ?? [];

    const isTriggerActive = document
      .querySelector("#selection-details-trigger")
      .classList.contains("accordion-trigger-active");
    if (elementDescription && !isTriggerActive) {
      toggleOntologyDetailsAccordionTrigger(
        document.querySelector("#selection-details-trigger"),
      );
    } else if (!elementDescription && isTriggerActive) {
      showSelectionAdvice();
      return;
    }
    if (!elementDescription) {
      return;
    }

    if (elementDescription.kind === "property") {
      displayPropertyInformation(elementDescription);
    } else {
      displayNodeInformation(elementDescription);
    }
  };

  function showSelectionAdvice() {
    setSelectionInformationVisibility(false, false, true);
  }

  function setSelectionInformationVisibility(
    showClasses,
    showProperties,
    showAdvice,
  ) {
    document
      .querySelector("#classSelectionInformation")
      .classList.toggle("hidden", !showClasses);
    document
      .querySelector("#propertySelectionInformation")
      .classList.toggle("hidden", !showProperties);
    document
      .querySelector("#noSelectionInformation")
      .classList.toggle("hidden", !showAdvice);
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

  function displayElementAttributes(elementDescription, textSpan) {
    // Both lists describe the element; VOWL's own type markers add nothing a
    // reader can act on and were already suppressed before this migration.
    displayAttributes(
      [
        ...elementDescription.characteristicNames,
        ...elementDescription.unclassifiedAttributeNames,
      ],
      textSpan,
    );
  }

  function displayPropertyInformation(propertyDescription) {
    showPropertyInformations();

    setIriLabel(
      document.querySelector("#propname"),
      propertyDescription.displayLabel,
      propertyDescription.iri,
    );

    document.querySelector("#typeProp").textContent =
      propertyDescription.elementTypeName ?? "";

    const [inverseElement] = propertyDescription.inversePropertyElements;
    if (inverseElement !== undefined) {
      document.querySelector("#inverse").classList.remove("hidden");
      setIriLabel(
        document.querySelector("#inverse span"),
        inverseElement.displayLabel,
        inverseElement.iri,
      );
    } else {
      document.querySelector("#inverse").classList.add("hidden");
    }

    listNodeArray(
      document.querySelector("#propEquivUri"),
      propertyDescription.equivalentPropertyElements,
    );
    listNodeArray(
      document.querySelector("#subproperties"),
      propertyDescription.subpropertyElements,
    );
    listNodeArray(
      document.querySelector("#superproperties"),
      propertyDescription.superpropertyElements,
    );

    const { exact, minimum, maximum } = propertyDescription.cardinalityRecord;
    if (minimum !== null) {
      document.querySelector("#infoCardinality").classList.add("hidden");
      document.querySelector("#minCardinality").classList.remove("hidden");
      document.querySelector("#minCardinality span").textContent = minimum;
      document.querySelector("#maxCardinality").classList.remove("hidden");
      // An absent upper bound is unbounded, which VOWL and the reader both
      // write as an asterisk.
      document.querySelector("#maxCardinality span").textContent =
        maximum === null ? "*" : maximum;
    } else if (exact !== null) {
      document.querySelector("#minCardinality").classList.add("hidden");
      document.querySelector("#maxCardinality").classList.add("hidden");
      document.querySelector("#infoCardinality").classList.remove("hidden");
      document.querySelector("#infoCardinality span").textContent = exact;
    } else {
      document.querySelector("#infoCardinality").classList.add("hidden");
      document.querySelector("#minCardinality").classList.add("hidden");
      document.querySelector("#maxCardinality").classList.add("hidden");
    }

    const [domainElement] = propertyDescription.domainElements;
    const [rangeElement] = propertyDescription.rangeElements;
    setIriLabel(
      document.querySelector("#domain"),
      domainElement?.displayLabel,
      domainElement?.iri,
    );
    setIriLabel(
      document.querySelector("#range"),
      rangeElement?.displayLabel,
      rangeElement?.iri,
    );

    displayElementAttributes(
      propertyDescription,
      document.querySelector("#propAttributes"),
    );

    setTextAndVisibility(
      document.querySelector("#propDescription"),
      propertyDescription.descriptionText,
    );
    setTextAndVisibility(
      document.querySelector("#propComment"),
      propertyDescription.commentText,
    );

    listAnnotations(
      document.querySelector("#propertySelectionInformation"),
      annotationGroupsFromRecords(
        propertyDescription.annotationRecords,
        propertyDescription.displayLabel,
      ),
    );
    sortDetailsPane("#propertySelectionInformation");
  }

  function showPropertyInformations() {
    setSelectionInformationVisibility(false, true, false);
  }

  function setIriLabel(element, name, iri) {
    const parent = element.parentNode;

    if (name) {
      element.innerHTML = "";
      appendIriLabel(element, name, iri);
      parent.classList.remove("hidden");
    } else {
      parent.classList.add("hidden");
    }
  }

  function displayAttributes(attributes, textSpan) {
    const spanParent = textSpan.parentNode;

    if (attributes && attributes.length > 0) {
      // Remove redundant redundant attributes for sidebar
      removeElementFromArray("object", attributes);
      removeElementFromArray("datatype", attributes);
      removeElementFromArray("rdf", attributes);
    }

    if (attributes && attributes.length > 0) {
      textSpan.textContent = attributes.join(", ");

      spanParent.classList.remove("hidden");
    } else {
      spanParent.classList.add("hidden");
    }
  }

  function removeElementFromArray(element, array) {
    const index = array.indexOf(element);
    if (index > -1) {
      array.splice(index, 1);
    }
  }

  function displayNodeInformation(classDescription) {
    showClassInformations();

    setIriLabel(
      document.querySelector("#name"),
      classDescription.displayLabel,
      classDescription.iri,
    );

    listNodeArray(
      document.querySelector("#classEquivUri"),
      classDescription.equivalentClassElements,
    );

    document.querySelector("#typeNode").textContent =
      classDescription.elementTypeName ?? "";
    listNodeArray(
      document.querySelector("#individuals"),
      classDescription.individualElements,
    );

    const disjointNodes = document.querySelector("#disjointNodes");
    const disjointNodesParent = disjointNodes.parentNode;
    if (classDescription.disjointClassElements.length > 0) {
      disjointNodes.innerHTML = "";
      classDescription.disjointClassElements.forEach(
        function (disjointElement, elementIndex) {
          if (elementIndex > 0) {
            const separator = document.createElement("span");
            separator.textContent = ", ";
            disjointNodes.appendChild(separator);
          }
          appendIriLabel(
            disjointNodes,
            disjointElement.displayLabel,
            disjointElement.iri,
          );
        },
      );
      disjointNodesParent.classList.remove("hidden");
    } else {
      disjointNodesParent.classList.add("hidden");
    }

    displayElementAttributes(
      classDescription,
      document.querySelector("#classAttributes"),
    );

    setTextAndVisibility(
      document.querySelector("#nodeDescription"),
      classDescription.descriptionText,
    );
    setTextAndVisibility(
      document.querySelector("#nodeComment"),
      classDescription.commentText,
    );

    listAnnotations(
      document.querySelector("#classSelectionInformation"),
      annotationGroupsFromRecords(
        classDescription.annotationRecords,
        classDescription.displayLabel,
      ),
    );
    sortDetailsPane("#classSelectionInformation");
  }

  function showClassInformations() {
    setSelectionInformationVisibility(true, false, false);
  }

  function listNodeArray(textSpan, nodes) {
    const spanParent = textSpan.parentNode;

    if (nodes && nodes.length) {
      textSpan.innerHTML = "";
      nodes.forEach(function (element, index) {
        if (index > 0) {
          const s = document.createElement("span");
          s.textContent = ", ";
          textSpan.appendChild(s);
        }
        appendIriLabel(textSpan, element.displayLabel, element.iri);
      });

      spanParent.classList.remove("hidden");
    } else {
      spanParent.classList.add("hidden");
    }
  }

  function setTextAndVisibility(label, value) {
    const parentNode = label.parentNode;
    const hasValue = !!value;
    if (value) {
      label.textContent = value;
    }
    parentNode.classList.toggle("hidden", !hasValue);
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

    if (requestedVisibilityValue === 1) {
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
    setupCollapsing();
    sidebar.initSideBarAnimation();

    sidebarToggleButton.addEventListener(
      "click",
      function () {
        hideNavMenus();
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

    sidebar.showSidebar(
      window.innerWidth <= 1024 ? 0 : Number(sidebar.getSidebarVisibility()),
      true,
    );
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
