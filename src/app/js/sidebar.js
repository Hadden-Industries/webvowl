const NAVIGABLE_IRI_SCHEMES = new Set(["http:", "https:", "urn:"]);

function navigableIri(value) {
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
  const href = navigableIri(iri);
  const tag = document.createElement(href ? "a" : "span");
  element.appendChild(tag);

  if (href) {
    tag.setAttribute("href", href);
    tag.setAttribute("title", href);
    tag.setAttribute("target", "_blank");
  }
  tag.textContent = name;
}

function renderOntologyIri(element, iri) {
  element.textContent = "";
  const label =
    typeof iri === "string" && iri.trim() ? iri.trim() : "not given";
  appendIriLabel(element, label, iri);
}

/**
 * Contains the logic for the sidebar.
 * @param graph the graph that belongs to these controls
 * @returns {{}}
 */
function createSidebar(graph) {
  const sidebar = {};
  const languageTools = webvowl.util.languageTools();
  const elementTools = webvowl.util.elementTools();
  // Required for reloading when the language changes
  let ontologyInfo;
  let visibleSidebar = 1;
  let lastSelectedElement;

  const detailArea = document.querySelector("#detailsArea");
  const graphArea = document.querySelector("#canvasArea");
  const collapseButton = document.querySelector("#sidebarExpandButton");

  /**
   * Setup the menu bar.
   */

  function setupCollapsing() {
    // adapted version of this example: http://www.normansblog.de/simple-jquery-accordion/
    const triggers = document.querySelectorAll(".accordion-trigger");

    // Collapse all inactive triggers on startup
    document
      .querySelectorAll(
        ".accordion-trigger:not(.accordion-trigger-active) + div",
      )
      .forEach(function (el) {
        el.classList.add("hidden");
      });

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
        const activeTriggers = document.querySelectorAll(
          ".accordion-trigger-active",
        );

        if (this.classList.contains("accordion-trigger-active")) {
          // Collapse the active (which is also the selected) trigger
          if (this.nextElementSibling) {
            this.nextElementSibling.classList.add("hidden");
          }
          this.classList.remove("accordion-trigger-active");
        } else {
          // Collapse the other trigger ...
          document
            .querySelectorAll(".accordion-trigger-active + div")
            .forEach(function (el) {
              el.classList.add("hidden");
            });
          activeTriggers.forEach(function (el) {
            el.classList.remove("accordion-trigger-active");
          });
          // ... and expand the selected one
          if (this.nextElementSibling) {
            this.nextElementSibling.classList.remove("hidden");
          }
          this.classList.add("accordion-trigger-active");
        }
      });
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
      // close accordion
      document.querySelector("#selection-details-trigger").click();
    }
    showSelectionAdvice();
  };

  /**
   * Updates the information of the passed ontology.
   * @param data the graph data
   * @param statistics the statistics module
   */
  sidebar.updateOntologyInformation = function (data, statistics) {
    data = data || {};
    ontologyInfo = data.header || {};

    setLanguages(ontologyInfo.languages);
    updateGraphInformation();
    displayGraphStatistics(undefined, statistics);
    displayMetadata(ontologyInfo.other);

    // Reset the sidebar selection
    sidebar.updateSelectionInformation(undefined);
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
    const langUndefined = webvowl.util.constants().LANG_UNDEFINED;
    if (languages.indexOf(langUndefined) >= 0) {
      return langUndefined;
    }

    // 5. Fallback: LANG_IRIBASED ("id")
    const langIri = webvowl.util.constants().LANG_IRIBASED;
    if (languages.indexOf(langIri) >= 0) {
      return langIri;
    }

    // 6. Fallback: First language in list
    return languages[0];
  }

  function setLanguages(languages) {
    languages = languages || [];

    // Put the default and unset label on top of the selection labels
    languages.sort(function (a, b) {
      if (a === webvowl.util.constants().LANG_IRIBASED) {
        return -1;
      } else if (b === webvowl.util.constants().LANG_IRIBASED) {
        return 1;
      }
      if (a === webvowl.util.constants().LANG_UNDEFINED) {
        return -1;
      } else if (b === webvowl.util.constants().LANG_UNDEFINED) {
        return 1;
      }
      return a.localeCompare(b);
    });

    const languageSelection = d3
      .select("#language")
      .on("change", function (event) {
        graph.language(event.target.value);
        updateGraphInformation();
        sidebar.updateSelectionInformation(lastSelectedElement);
      });

    languageSelection.selectAll("option").remove();
    languageSelection
      .selectAll("option")
      .data(languages)
      .enter()
      .append("option")
      .attr("value", function (d) {
        return d;
      })
      .text(function (d) {
        return d;
      });

    const selectedLanguage = findBestMatchingLanguage(languages);
    if (selectedLanguage) {
      const langIndex = languages.indexOf(selectedLanguage);
      if (langIndex >= 0) {
        languageSelection.property("selectedIndex", langIndex);
      }
      if (languageSelection.node()) {
        languageSelection.node().value = selectedLanguage;
      }
      graph.language(selectedLanguage);
    }
  }

  function updateGraphInformation() {
    const title = languageTools.textInLanguage(
      ontologyInfo.title,
      graph.language(),
    );
    document.querySelector("#title").textContent =
      title || "No title available";
    renderOntologyIri(document.querySelector("#about"), ontologyInfo.iri);
    document.querySelector("#version").textContent =
      ontologyInfo.version || "--";
    const authors = ontologyInfo.author;
    if (typeof authors === "string") {
      // Stay compatible with author info as strings after change in january 2015
      document.querySelector("#authors").textContent = authors;
    } else if (authors instanceof Array) {
      document.querySelector("#authors").textContent = authors.join(", ");
    } else {
      document.querySelector("#authors").textContent = "--";
    }

    const description = languageTools.textInLanguage(
      ontologyInfo.description,
      graph.language(),
    );
    document.querySelector("#description").textContent =
      description || "No description available.";
  }

  function displayGraphStatistics(deliveredMetrics, statistics) {
    // Metrics are optional and may be undefined
    deliveredMetrics = deliveredMetrics || {};

    document.querySelector("#classCount").textContent =
      deliveredMetrics.classCount || statistics.classCount();
    document.querySelector("#objectPropertyCount").textContent =
      deliveredMetrics.objectPropertyCount || statistics.objectPropertyCount();
    document.querySelector("#datatypePropertyCount").textContent =
      deliveredMetrics.datatypePropertyCount ||
      statistics.datatypePropertyCount();
    document.querySelector("#individualCount").textContent =
      deliveredMetrics.totalIndividualCount ||
      statistics.totalIndividualCount();
    document.querySelector("#nodeCount").textContent = statistics.nodeCount();
    document.querySelector("#edgeCount").textContent = statistics.edgeCount();
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

    const langUndefined = webvowl.util.constants().LANG_UNDEFINED;
    const langIri = webvowl.util.constants().LANG_IRIBASED;

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
    const preferredLanguage = graph && graph.language ? graph.language() : null;

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
  sidebar.updateSelectionInformation = function (
    selectedElement,
    event,
    forced,
  ) {
    lastSelectedElement = selectedElement;

    // Click event was prevented when dragging
    if (event && event.defaultPrevented && !forced) {
      return;
    }

    const isTriggerActive = document
      .querySelector("#selection-details-trigger")
      .classList.contains("accordion-trigger-active");
    if (selectedElement && !isTriggerActive) {
      document.querySelector("#selection-details-trigger").click();
    } else if (!selectedElement && isTriggerActive) {
      showSelectionAdvice();
      return;
    }

    if (elementTools.isProperty(selectedElement)) {
      displayPropertyInformation(selectedElement);
    } else if (elementTools.isNode(selectedElement)) {
      displayNodeInformation(selectedElement);
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

  function displayPropertyInformation(property) {
    showPropertyInformations();

    setIriLabel(
      document.querySelector("#propname"),
      property.labelForCurrentLanguage(),
      property.iri(),
    );

    document.querySelector("#typeProp").textContent = property.type();

    if (property.inverse() !== undefined) {
      document.querySelector("#inverse").classList.remove("hidden");
      setIriLabel(
        document.querySelector("#inverse span"),
        property.inverse().labelForCurrentLanguage(),
        property.inverse().iri(),
      );
    } else {
      document.querySelector("#inverse").classList.add("hidden");
    }

    const equivalentIriSpan = document.querySelector("#propEquivUri");
    listNodeArray(equivalentIriSpan, property.equivalents());

    listNodeArray(
      document.querySelector("#subproperties"),
      property.subproperties(),
    );
    listNodeArray(
      document.querySelector("#superproperties"),
      property.superproperties(),
    );

    if (property.minCardinality() !== undefined) {
      document.querySelector("#infoCardinality").classList.add("hidden");
      document.querySelector("#minCardinality").classList.remove("hidden");
      document.querySelector("#minCardinality span").textContent =
        property.minCardinality();
      document.querySelector("#maxCardinality").classList.remove("hidden");

      if (property.maxCardinality() !== undefined) {
        document.querySelector("#maxCardinality span").textContent =
          property.maxCardinality();
      } else {
        document.querySelector("#maxCardinality span").textContent = "*";
      }
    } else if (property.cardinality() !== undefined) {
      document.querySelector("#minCardinality").classList.add("hidden");
      document.querySelector("#maxCardinality").classList.add("hidden");
      document.querySelector("#infoCardinality").classList.remove("hidden");
      document.querySelector("#infoCardinality span").textContent =
        property.cardinality();
    } else {
      document.querySelector("#infoCardinality").classList.add("hidden");
      document.querySelector("#minCardinality").classList.add("hidden");
      document.querySelector("#maxCardinality").classList.add("hidden");
    }

    setIriLabel(
      document.querySelector("#domain"),
      property.domain().labelForCurrentLanguage(),
      property.domain().iri(),
    );
    setIriLabel(
      document.querySelector("#range"),
      property.range().labelForCurrentLanguage(),
      property.range().iri(),
    );

    displayAttributes(
      property.attributes(),
      document.querySelector("#propAttributes"),
    );

    setTextAndVisibility(
      document.querySelector("#propDescription"),
      property.descriptionForCurrentLanguage(),
    );
    setTextAndVisibility(
      document.querySelector("#propComment"),
      property.commentForCurrentLanguage(),
    );

    const annotations = property.annotations();
    const filteredAnnotations = {};
    if (annotations) {
      for (const key in annotations) {
        // Skip prefLabel (shown as Name) and raw "label" key (handled below as rdfs:label)
        if (
          Object.prototype.hasOwnProperty.call(annotations, key) &&
          key !== "prefLabel" &&
          key !== "label"
        ) {
          filteredAnnotations[key] = annotations[key];
        }
      }
    }

    // Surface rdfs:label values that differ from the preferred display name
    const prefName = property.labelForCurrentLanguage();
    const allRdfsLabels =
      annotations && annotations["label"] ? annotations["label"] : [];
    const rdfsLabels = allRdfsLabels
      .filter(function (entry) {
        return entry.value !== prefName;
      })
      .map(function (entry) {
        return {
          identifier: "rdfs:label",
          value: entry.value,
          type: "label",
          predicateNs: "http://www.w3.org/2000/01/rdf-schema#",
          language: entry.language,
        };
      });
    if (rdfsLabels.length > 0) {
      filteredAnnotations["rdfs:label"] = rdfsLabels;
    }

    listAnnotations(
      document.querySelector("#propertySelectionInformation"),
      filteredAnnotations,
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

  function displayNodeInformation(node) {
    showClassInformations();

    setIriLabel(
      document.querySelector("#name"),
      node.labelForCurrentLanguage(),
      node.iri(),
    );

    /* Equivalent stuff. */
    const equivalentIriSpan = document.querySelector("#classEquivUri");
    listNodeArray(equivalentIriSpan, node.equivalents());

    document.querySelector("#typeNode").textContent = node.type();
    listNodeArray(document.querySelector("#individuals"), node.individuals());

    /* Disjoint stuff. */
    const disjointNodes = document.querySelector("#disjointNodes");
    const disjointNodesParent = disjointNodes.parentNode;

    if (node.disjointWith() !== undefined) {
      disjointNodes.innerHTML = "";

      node.disjointWith().forEach(function (element, index) {
        if (index > 0) {
          const s = document.createElement("span");
          s.textContent = ", ";
          disjointNodes.appendChild(s);
        }
        appendIriLabel(
          disjointNodes,
          element.labelForCurrentLanguage(),
          element.iri(),
        );
      });

      disjointNodesParent.classList.remove("hidden");
    } else {
      disjointNodesParent.classList.add("hidden");
    }

    displayAttributes(
      node.attributes(),
      document.querySelector("#classAttributes"),
    );

    setTextAndVisibility(
      document.querySelector("#nodeDescription"),
      node.descriptionForCurrentLanguage(),
    );
    setTextAndVisibility(
      document.querySelector("#nodeComment"),
      node.commentForCurrentLanguage(),
    );

    const annotations = node.annotations();
    const filteredAnnotations = {};
    if (annotations) {
      for (const key in annotations) {
        // Skip prefLabel (shown as Name) and raw "label" key (handled below as rdfs:label)
        if (
          Object.prototype.hasOwnProperty.call(annotations, key) &&
          key !== "prefLabel" &&
          key !== "label"
        ) {
          filteredAnnotations[key] = annotations[key];
        }
      }
    }

    // Surface rdfs:label values that differ from the preferred display name
    const prefName = node.labelForCurrentLanguage();
    const allRdfsLabels =
      annotations && annotations["label"] ? annotations["label"] : [];
    const rdfsLabels = allRdfsLabels
      .filter(function (entry) {
        return entry.value !== prefName;
      })
      .map(function (entry) {
        return {
          identifier: "rdfs:label",
          value: entry.value,
          type: "label",
          predicateNs: "http://www.w3.org/2000/01/rdf-schema#",
          language: entry.language,
        };
      });
    if (rdfsLabels.length > 0) {
      filteredAnnotations["rdfs:label"] = rdfsLabels;
    }

    listAnnotations(
      document.querySelector("#classSelectionInformation"),
      filteredAnnotations,
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
        appendIriLabel(
          textSpan,
          element.labelForCurrentLanguage(),
          element.iri(),
        );
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
    const isHidden = detailArea.classList.contains("hidden");
    const zoomSlider = document.querySelector("#zoomSlider");
    const collapseButton = document.querySelector("#sidebarExpandButton");

    zoomSlider.classList.toggle("aligned-to-sidebar", !isHidden);
    collapseButton.classList.toggle("aligned-to-sidebar", !isHidden);
  };

  function updateNavMenuScrollButtons() {
    if (graph.options().navigationMenu && graph.options().navigationMenu()) {
      graph.options().navigationMenu().updateScrollButtonVisibility();
    }
  }

  function hideNavMenus() {
    if (graph.options().navigationMenu && graph.options().navigationMenu()) {
      graph.options().navigationMenu().hideAllMenus();
    }
  }

  sidebar.showSidebar = function (val, init) {
    if (init === true) {
      document.querySelector("body").classList.add("no-transition");
    }

    if (val === 1) {
      visibleSidebar = true;
      collapseButton.innerHTML = ">";
      detailArea.classList.remove("hidden");
      graphArea.classList.add("sidebar-visible");
      document
        .querySelector("#WarningErrorMessagesContainer")
        .classList.add("sidebar-visible");
    } else {
      visibleSidebar = false;
      collapseButton.innerHTML = "<";
      detailArea.classList.add("hidden");
      graphArea.classList.remove("sidebar-visible");
      document
        .querySelector("#WarningErrorMessagesContainer")
        .classList.remove("sidebar-visible");
    }

    sidebar.updateDockedControlsPosition();
    graph.updateCanvasContainerSize();
    updateNavMenuScrollButtons();

    if (init === true) {
      requestAnimationFrame(function () {
        document.querySelector("body").classList.remove("no-transition");
      });
    }
  };

  sidebar.isSidebarVisible = function () {
    return visibleSidebar;
  };

  sidebar.updateSideBarVis = function (init) {
    const vis = sidebar.getSidebarVisibility();
    sidebar.showSidebar(parseInt(vis), init);
  };

  sidebar.getSidebarVisibility = function () {
    const isHidden = detailArea.classList.contains("hidden");
    if (isHidden === false) {
      return String(1);
    }
    if (isHidden === true) {
      return String(0);
    }
  };

  sidebar.initSideBarAnimation = function () {
    graphArea.addEventListener("transitionend", function (event) {
      if (event.propertyName !== "width") {
        return;
      }
      detailArea.classList.toggle("hidden", !visibleSidebar);
      graph.updateCanvasContainerSize();
      updateNavMenuScrollButtons();
    });
  };

  sidebar.setup = function () {
    setupCollapsing();
    sidebar.initSideBarAnimation();

    collapseButton.addEventListener("click", function () {
      hideNavMenus();
      const settingValue = parseInt(sidebar.getSidebarVisibility());
      if (settingValue === 1) {
        sidebar.showSidebar(0);
      } else {
        sidebar.showSidebar(1);
      }
    });

    collapseButton.addEventListener("contextmenu", function (event) {
      if (event) {
        event.preventDefault();
      }
    });

    if (window.innerWidth <= 1024) {
      sidebar.showSidebar(0, true);
    }
  };

  sidebar.updateShowedInformation = function () {
    const editMode = graph.editorMode();
    document
      .querySelector("#generalDetails")
      .classList.toggle("hidden", editMode);
    document
      .querySelector("#generalDetailsEdit")
      .classList.toggle("hidden", !editMode);

    // store the meta information in graph.options()

    // todo: update edit meta info
    graph.options().editSidebar().updateGeneralOntologyInfo();

    // todo: update showed meta info;
    graph.options().sidebar().updateGeneralOntologyInfo();
  };

  sidebar.updateGeneralOntologyInfo = function () {
    // get it from graph.options
    const generalMetaObj = graph.options().getGeneralMetaObject();
    const preferredLanguage = graph && graph.language ? graph.language() : null;
    if (Object.prototype.hasOwnProperty.call(generalMetaObj, "title")) {
      // title has language to it -.-
      if (typeof generalMetaObj.title === "object") {
        document.querySelector("#title").value = languageTools.textInLanguage(
          generalMetaObj.title,
          preferredLanguage,
        );
      } else {
        document.querySelector("#title").innerHTML = generalMetaObj.title;
      }
    }
    if (Object.prototype.hasOwnProperty.call(generalMetaObj, "iri")) {
      renderOntologyIri(document.querySelector("#about"), generalMetaObj.iri);
    }
    if (Object.prototype.hasOwnProperty.call(generalMetaObj, "version")) {
      document.querySelector("#version").innerHTML = generalMetaObj.version;
    }
    if (Object.prototype.hasOwnProperty.call(generalMetaObj, "author")) {
      document.querySelector("#authors").innerHTML = generalMetaObj.author;
    }
    // this could also be an object >>
    if (Object.prototype.hasOwnProperty.call(generalMetaObj, "description")) {
      if (typeof generalMetaObj.description === "object") {
        document.querySelector("#description").innerHTML =
          languageTools.textInLanguage(
            generalMetaObj.description,
            preferredLanguage,
          );
      } else {
        document.querySelector("#description").innerHTML =
          generalMetaObj.description;
      }
    }
  };

  return sidebar;
}

createSidebar.navigableIri = navigableIri;
createSidebar.renderOntologyIri = renderOntologyIri;

module.exports = createSidebar;
