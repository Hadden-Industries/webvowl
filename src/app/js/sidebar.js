const NAVIGABLE_IRI_SCHEMES = new Set(["http:", "https:", "urn:"]);

function navigableIri( value ){
  if ( typeof value !== "string" ) {return undefined;}
  const iri = value.trim();
  if ( !iri ) {return undefined;}

  try {
    const parsedIri = new URL(iri);
    return NAVIGABLE_IRI_SCHEMES.has(parsedIri.protocol.toLowerCase()) ? iri : undefined;
  } catch {
    return undefined;
  }
}

function appendIriLabel( element, name, iri ){
  const href = navigableIri(iri);
  const tag = document.createElement(href ? "a" : "span");
  element.appendChild(tag);

  if ( href ) {
    tag.attr("href", href)
      .attr("title", href)
      .attr("target", "_blank");
  }
  tag.textContent = name;
}

function renderOntologyIri( element, iri ){
  element.textContent = "";
  const label = typeof iri === "string" && iri.trim() ? iri.trim() : "not given";
  appendIriLabel(element, label, iri);
}

/**
 * Contains the logic for the sidebar.
 * @param graph the graph that belongs to these controls
 * @returns {{}}
 */
module.exports = function (graph) {
  const sidebar = {};
  const languageTools = webvowl.util.languageTools();
  const elementTools = webvowl.util.elementTools();
  // Required for reloading when the language changes
  let ontologyInfo;
  let visibleSidebar = 1;
  let lastSelectedElement;
  const detailArea = d3.select("#detailsArea");
  const graphArea = d3.select("#canvasArea");
  const menuArea = d3.select("#swipeBarContainer");
  const collapseButton = d3.select("#sidebarExpandButton");

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
    d3.select("#title").text("No title available");
    d3.select("#about")
      .attr("href", "#")
      .attr("target", "_blank")
      .text("not given");
    d3.select("#version").text("--");
    d3.select("#authors").text("--");
    d3.select("#description").text("No description available.");
    const container = d3.select("#ontology-metadata");
    container.selectAll("*").remove();
    d3.select("#classCount").text("0");
    d3.select("#objectPropertyCount").text("0");
    d3.select("#datatypePropertyCount").text("0");
    d3.select("#individualCount").text("0");
    d3.select("#nodeCount").text("0");
    d3.select("#edgeCount").text("0");

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

    setLanguages(ontologyInfo.languages);
  };

  function setLanguages(languages) {
  function getBrowserLanguages(){
    var nav = typeof navigator !== "undefined" ? navigator : {};
    var browserLangs = [];
    if ( Array.isArray(nav.languages) ) {
      for ( var i = 0; i < nav.languages.length; i++ ) {
        var l = nav.languages[i];
        if ( l && typeof l === "string" && browserLangs.indexOf(l) === -1 ) {
          browserLangs.push(l);
        }
      }
    }
    if ( nav.language && typeof nav.language === "string" && browserLangs.indexOf(nav.language) === -1 ) {
      browserLangs.push(nav.language);
    }
    if ( nav.userLanguage && typeof nav.userLanguage === "string" && browserLangs.indexOf(nav.userLanguage) === -1 ) {
      browserLangs.push(nav.userLanguage);
    }
    return browserLangs;
  }

  function findBestMatchingLanguage( languages ){
    if ( !languages || languages.length === 0 ) {
      return null;
    }

    var browserLangs = getBrowserLanguages();

    // 1. Try exact matches with browser languages (case-insensitive)
    for ( var i = 0; i < browserLangs.length; i++ ) {
      var bLang = browserLangs[i].toLowerCase();
      for ( var j = 0; j < languages.length; j++ ) {
        if ( typeof languages[j] === "string" && languages[j].toLowerCase() === bLang ) {
          return languages[j];
        }
      }
    }

    // 2. Try primary language tag matches (e.g., "de-DE" matches "de", or "de" matches "de-DE")
    for ( var k = 0; k < browserLangs.length; k++ ) {
      if ( typeof browserLangs[k] !== "string" ) continue;
      var primaryBLang = browserLangs[k].split("-")[0].toLowerCase();
      for ( var m = 0; m < languages.length; m++ ) {
        if ( typeof languages[m] !== "string" ) continue;
        var langLower = languages[m].toLowerCase();
        var primaryLang = langLower.split("-")[0];
        if ( langLower === primaryBLang || primaryLang === primaryBLang ) {
          return languages[m];
        }
      }
    }

    // 3. Fallback: English ("en" or "en-*")
    for ( var n = 0; n < languages.length; n++ ) {
      if ( typeof languages[n] === "string" ) {
        var lLower = languages[n].toLowerCase();
        if ( lLower === "en" || lLower.split("-")[0] === "en" ) {
          return languages[n];
        }
      }
    }

    // 4. Fallback: LANG_UNDEFINED ("undefined")
    var langUndefined = webvowl.util.constants().LANG_UNDEFINED;
    if ( languages.indexOf(langUndefined) >= 0 ) {
      return langUndefined;
    }

    // 5. Fallback: LANG_IRIBASED ("id")
    var langIri = webvowl.util.constants().LANG_IRIBASED;
    if ( languages.indexOf(langIri) >= 0 ) {
      return langIri;
    }

    // 6. Fallback: First language in list
    return languages[0];
  }

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

    const languageSelection = d3.select("#language").on("change", function () {
      graph.language(d3.event.target.value);
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

    if (!trySelectDefaultLanguage(languageSelection, languages, "en")) {
      if (
        !trySelectDefaultLanguage(
          languageSelection,
          languages,
          webvowl.util.constants().LANG_UNDEFINED,
        )
      ) {
        trySelectDefaultLanguage(
          languageSelection,
          languages,
          webvowl.util.constants().LANG_IRIBASED,
        );
      }
      if ( languageSelection.node() ) {
        languageSelection.node().value = selectedLanguage;
      }
      graph.language(selectedLanguage);
    }
  }

  function trySelectDefaultLanguage(selection, languages, language) {
    const langIndex = languages.indexOf(language);
    if (langIndex >= 0) {
      selection.property("selectedIndex", langIndex);
      graph.language(language);
      return true;
    }

    return false;
  }

  function updateGraphInformation() {
    const title = languageTools.textInLanguage(
      ontologyInfo.title,
      graph.language(),
    );
    d3.select("#title").text(title || "No title available");
    d3.select("#about")
      .attr("href", ontologyInfo.iri)
      .attr("target", "_blank")
      .text(ontologyInfo.iri);
    d3.select("#version").text(ontologyInfo.version || "--");
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

  function listAnnotations(container, annotationObject) {
    annotationObject = annotationObject || {}; //todo

  var RANK_MAP = {
    "name": 1,
    "skos:definition": 2,
    "definition": 2,
    "type": 3,
    "inverse": 4,
    "domain": 5,
    "range": 6,
    "subprop": 7,
    "superprop": 8,
    "equiv": 9,
    "disjoint": 10,
    "cardinality": 11,
    "charac": 12,
    "individuals": 13,
    "description": 14,
    "comment": 15,
    "dcterms:identifier": 16,
    "identifier": 16,
    "dcterms:creator": 17,
    "creator": 17,
    "dcterms:created": 18,
    "created": 18,
    "dcterms:modified": 19,
    "modified": 19,
    "rdfs:label": 20,
    "label": 20,
    "skos:altLabel": 21,
    "altLabel": 21,
    "skos:hiddenLabel": 22,
    "hiddenLabel": 22,
    "skos:scopeNote": 23,
    "scopeNote": 23,
    "skos:example": 24,
    "example": 24,
    "dcterms:source": 25,
    "source": 25,
    "skos:changeNote": 26,
    "changeNote": 26,
    "skos:editorialNote": 27,
    "editorialNote": 27,
    "skos:historyNote": 28,
    "historyNote": 28,
    "skos:note": 29,
    "note": 29,
    "dcterms:references": 30,
    "references": 30,
    "rdfs:seeAlso": 31,
    "seeAlso": 31,
    "rdfs:comment": 32
  };

  function getParagraphIdentifier( pNode ){
    var dataId = pNode.getAttribute("data-identifier");
    if ( dataId ) return dataId;
    
    var span = pNode.querySelector("span");
    if ( span && span.id ) {
      var id = span.id;
      if ( id === "propname" ) return "name";
      if ( id === "typeProp" || id === "typeNode" ) return "type";
      if ( id === "classEquivUri" || id === "propEquivUri" ) return "equiv";
      if ( id === "disjointNodes" ) return "disjoint";
      if ( id === "classAttributes" || id === "propAttributes" ) return "charac";
      if ( id === "individuals" ) return "individuals";
      if ( id === "nodeDescription" || id === "propDescription" ) return "description";
      if ( id === "nodeComment" || id === "propComment" ) return "comment";
      if ( id === "subproperties" ) return "subprop";
      if ( id === "superproperties" ) return "superprop";
      if ( id === "infoCardinality" || id === "minCardinality" || id === "maxCardinality" ) return "cardinality";
      if ( id === "inverse" ) return "inverse";
      if ( id === "domain" ) return "domain";
      if ( id === "range" ) return "range";
      return id;
    }
    
    var text = pNode.textContent || pNode.innerText || "";
    var parts = text.split(":");
    if ( parts.length > 0 ) {
      return parts[0].trim();
    }
    return "";
  }

  function compareParagraphs( a, b ) {
    var idA = getParagraphIdentifier(a);
    var idB = getParagraphIdentifier(b);
    
    var rankA = RANK_MAP[idA] !== undefined ? RANK_MAP[idA] : 100;
    var rankB = RANK_MAP[idB] !== undefined ? RANK_MAP[idB] : 100;
    
    if ( rankA !== rankB ) {
      return rankA - rankB;
    }
    
    var labelA = String(idA).toLowerCase();
    var labelB = String(idB).toLowerCase();
    if ( labelA < labelB ) return -1;
    if ( labelA > labelB ) return 1;
    
    var textA = String(a.textContent || a.innerText || "").toLowerCase();
    var textB = String(b.textContent || b.innerText || "").toLowerCase();
    if ( textA < textB ) return -1;
    if ( textA > textB ) return 1;
    
    return 0;
  }

  function sortDetailsPane( containerSelector ) {
    var parent = document.querySelector(containerSelector);
    if ( !parent ) return;
    
    var paragraphs = Array.prototype.slice.call(parent.children).filter(function ( el ) {
      return el.tagName.toLowerCase() === "p";
    });
    
    paragraphs.sort(compareParagraphs);
    
    paragraphs.forEach(function ( pNode ) {
      parent.appendChild(pNode);
    });
  }

  function isLanguageMatch( entryLang, preferredLang ){
    if ( !entryLang || !preferredLang ) {
      return false;
    }
    const e = String(entryLang).toLowerCase().trim();
    const p = String(preferredLang).toLowerCase().trim();
    if ( e === p ) {
      return true;
    }
    const eBase = e.split("-")[0];
    const pBase = p.split("-")[0];
    return eBase.length > 0 && eBase === pBase;
  }

  function filterAnnotationItems( items, preferredLanguage ){
    if ( !items || items.length === 0 ) {
      return [];
    }

    const universalEntries = [];
    const languageEntries = [];

    const langUndefined = webvowl.util.constants().LANG_UNDEFINED;
    const langIri = webvowl.util.constants().LANG_IRIBASED;

    for ( let i = 0; i < items.length; i++ ) {
      const item = items[i];
      const lang = item.language;
      if ( item.type === "iri" || !lang || lang === "undefined" || lang === "id" || lang === langUndefined || lang === langIri ) {
        universalEntries.push(item);
      } else {
        languageEntries.push(item);
      }
    }

    if ( languageEntries.length === 0 ) {
      return universalEntries;
    }

    if ( preferredLanguage ) {
      const preferredMatches = languageEntries.filter(function ( item ){
        return isLanguageMatch(item.language, preferredLanguage);
      });
      if ( preferredMatches.length > 0 ) {
        return universalEntries.concat(preferredMatches);
      }
    }

    // Fallback to English ("en") if preferred language didn't match
    const englishMatches = languageEntries.filter(function ( item ){
      return isLanguageMatch(item.language, "en");
    });
    if ( englishMatches.length > 0 ) {
      return universalEntries.concat(englishMatches);
    }

    // Final fallback: return all universal entries + language entries
    return universalEntries.concat(languageEntries);
  }

    const preferredLanguage = graph && graph.language ? graph.language() : null;
    const annotations = [];
    for (const annotation in annotationObject) {
      if (Object.prototype.hasOwnProperty.call(annotationObject, annotation)) {
        var items = annotationObject[annotation];
        if ( items && items.length > 0 ) {
          var sortedItems = items.slice(0).sort(function ( a, b ) {
            var valA = String(a.value);
            var valB = String(b.value);
            if ( valA < valB ) return -1;
            if ( valA > valB ) return 1;
            return 0;
          });
          sortedItems.forEach(function ( item ) {
            annotations.push(item);
          });
        }
      }
    }

    container.selectAll(".annotation").remove();
    container
      .selectAll(".annotation")
      .data(annotations)
      .enter()
      .append("p")
      .classed("annotation", true)
      .classed("statisticDetails", true)
      .attr("data-identifier", function ( d ){
        return d.identifier;
      })
      .text(function (d) {
        return d.identifier + ":";
      })
      .append("span")
      .each(function (d) {
        appendIriLabel(
          d3.select(this),
          d.value,
          d.type === "iri" ? d.value : undefined,
        );
      });
    
    // Build the annotation property name as a hyperlink if a predicate IRI is available
    paragraphs.each(function ( d ) {
      var p = d3.select(this);
      // Determine the full IRI for the annotation property
      var predicateIri = null;
      var localName = null;
      if ( d.predicateNs ) {
        // local name is everything after the last # or /
        var rawLocal = d.identifier.replace(/^[^:]+:/, ""); // strip any CURIE prefix (e.g. "rdfs:" from "rdfs:label")
        predicateIri = d.predicateNs + rawLocal;
        localName = rawLocal;
      } else if ( d.identifier && d.identifier.indexOf(":") !== -1 ) {
        var WELL_KNOWN = {
          "rdf":     "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
          "rdfs":    "http://www.w3.org/2000/01/rdf-schema#",
          "owl":     "http://www.w3.org/2002/07/owl#",
          "xsd":     "http://www.w3.org/2001/XMLSchema#",
          "skos":    "http://www.w3.org/2004/02/skos/core#",
          "dcterms": "http://purl.org/dc/terms/",
          "dc":      "http://purl.org/dc/elements/1.1/"
        };
        var parts = d.identifier.split(":");
        var prefix = parts[0];
        localName = parts.slice(1).join(":");
        if ( WELL_KNOWN[prefix] ) {
          predicateIri = WELL_KNOWN[prefix] + localName;
        }
      }
      
      if ( predicateIri && localName ) {
        appendIriLabel(p, localName, predicateIri);
        p.appendChild(document.createTextNode(": "));
      } else {
        p.appendChild(document.createTextNode(d.identifier + ": "));
      }
      

      var valueSpan = p.append("span");
      if ( d.type === "iri" ) {
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
  sidebar.updateSelectionInformation = function (selectedElement) {
    lastSelectedElement = selectedElement;

    // Click event was prevented when dragging
    if (d3.event && d3.event.defaultPrevented) {
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

    listAnnotations(
      document.querySelector("#propertySelectionInformation"),
      property.annotations(),
    );
    
    // Surface rdfs:label values that differ from the preferred display name
    var prefName = property.labelForCurrentLanguage();
    var allRdfsLabels = (annotations && annotations["label"]) ? annotations["label"] : [];
    var rdfsLabels = allRdfsLabels.filter(function(entry) {
      return entry.value !== prefName;
    }).map(function(entry) {
      return { identifier: "rdfs:label", value: entry.value, type: "label", predicateNs: "http://www.w3.org/2000/01/rdf-schema#", language: entry.language };
    });
    if ( rdfsLabels.length > 0 ) {
      filteredAnnotations["rdfs:label"] = rdfsLabels;
    }
    
    listAnnotations(d3.select("#propertySelectionInformation"), filteredAnnotations);
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

  function appendIriLabel(element, name, iri) {
    let tag;

    if (iri) {
      tag = element
        .append("a")
        .attr("href", iri)
        .attr("title", iri)
        .attr("target", "_blank");
    } else {
      tag = element.append("span");
    }
    tag.text(name);
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

    listAnnotations(
      document.querySelector("#classSelectionInformation"),
      node.annotations(),
    );
    
    // Surface rdfs:label values that differ from the preferred display name
    var prefName = node.labelForCurrentLanguage();
    var allRdfsLabels = (annotations && annotations["label"]) ? annotations["label"] : [];
    var rdfsLabels = allRdfsLabels.filter(function(entry) {
      return entry.value !== prefName;
    }).map(function(entry) {
      return { identifier: "rdfs:label", value: entry.value, type: "label", predicateNs: "http://www.w3.org/2000/01/rdf-schema#", language: entry.language };
    });
    if ( rdfsLabels.length > 0 ) {
      filteredAnnotations["rdfs:label"] = rdfsLabels;
    }
    
    listAnnotations(d3.select("#classSelectionInformation"), filteredAnnotations);
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

  sidebar.showSidebar = function (val, init) {
  function updateZoomSliderPosition(){
    var isHidden = detailArea.classed("hidden");
    var zoomSlider = d3.select("#zoomSlider");
    const collapseButton = d3.select("#sidebarExpandButton");

    if ( isHidden ) {
      zoomSlider.style("left", "auto").style("right", DOCKED_CONTROL_OFFSET + "px");
      collapseButton.style("left", "auto").style("right", DOCKED_CONTROL_OFFSET + "px");
    } else {
      var sidebarRect = detailArea.node().getBoundingClientRect();
      var sidebarLeft = sidebarRect.left;

      var sliderWidth = zoomSlider.node() ? (zoomSlider.node().getBoundingClientRect().width || 32) : 32;
      var btnWidth = collapseButton.node() ? (collapseButton.node().getBoundingClientRect().width || 36) : 36;

      var sliderTargetLeft = sidebarLeft - sliderWidth - DOCKED_CONTROL_OFFSET;
      var btnTargetLeft = sidebarLeft - btnWidth - DOCKED_CONTROL_OFFSET;

      zoomSlider.style("right", "auto").style("left", sliderTargetLeft + "px");
      collapseButton.style("right", "auto").style("left", btnTargetLeft + "px");
    }
  };

  function updateNavMenuScrollButtons(){
    if ( graph.options().navigationMenu && graph.options().navigationMenu() ) {
      graph.options().navigationMenu().updateScrollButtonVisibility();
    }
  }

  function hideNavMenus(){
    if ( graph.options().navigationMenu && graph.options().navigationMenu() ) {
      graph.options().navigationMenu().hideAllMenus();
    }
  }

    var isMobileOrTablet = window.innerWidth <= 1024;

    if ( init === true ) {
      document.querySelector("body").classList.add("no-transition");
    }

    if (val === 1) {
      visibleSidebar = true;
      collapseButton.node().innerHTML = ">";
      detailArea.classed("hidden", true);
      if (init === true) {
        detailArea.classed("hidden", !visibleSidebar);
        graphArea.style("width", "78%");
        graphArea.style("-webkit-animation-name", "none");

        menuArea.style("width", "78%");
        menuArea.style("-webkit-animation-name", "none");

        d3.select("#WarningErrorMessagesContainer").style("width", "78%");
        d3.select("#WarningErrorMessagesContainer").style(
          "-webkit-animation-name",
          "none",
        );
        graph.options().width(window.innerWidth);
      } else {
        graphArea.style("width", "78%");
        graphArea.style("-webkit-animation-name", "sbCollapseAnimation");
        graphArea.style("-webkit-animation-duration", "0.5s");

        menuArea.style("width", "78%");
        menuArea.style("-webkit-animation-name", "sbCollapseAnimation");
        menuArea.style("-webkit-animation-duration", "0.5s");

        d3.select("#WarningErrorMessagesContainer").style("width", "78%");
        d3.select("#WarningErrorMessagesContainer").style(
          "-webkit-animation-name",
          "warn_ExpandRightBarAnimation",
        );
        d3.select("#WarningErrorMessagesContainer").style(
          "-webkit-animation-duration",
          "0.5s",
        );
      }
      graph.options().width(window.innerWidth - window.innerWidth * 0.22);
      graph.options().navigationMenu().updateScrollButtonVisibility();
    }
    if (val === 0) {
      visibleSidebar = false;
      detailArea.classed("hidden", true);

      collapseButton.node().innerHTML = "<";
      // adjust the layout
      if (init === true) {
        graphArea.style("width", "100%");
        graphArea.style("-webkit-animation-name", "none");


        d3.select("#WarningErrorMessagesContainer").style("width", "100%");
        d3.select("#WarningErrorMessagesContainer").style(
          "-webkit-animation-name",
          "none",
        );
      } else {
        graphArea.style("width", "100%");
        graphArea.style("-webkit-animation-name", "sbExpandAnimation");
        graphArea.style("-webkit-animation-duration", "0.5s");

        menuArea.style("width", "100%");
        menuArea.style("-webkit-animation-name", "sbExpandAnimation");
        menuArea.style("-webkit-animation-duration", "0.5s");

        d3.select("#WarningErrorMessagesContainer").style("width", "100%");
        d3.select("#WarningErrorMessagesContainer").style(
          "-webkit-animation-name",
          "warn_CollapseRightBarAnimation",
        );
        d3.select("#WarningErrorMessagesContainer").style(
          "-webkit-animation-duration",
          "0.5s",
        );
      }
      sidebar.updateDockedControlsPosition();
      graph.updateCanvasContainerSize();
      updateNavMenuScrollButtons();
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
    graphArea.node().addEventListener("animationend", function () {
      detailArea.classList.toggle("hidden", !visibleSidebar);
      graph.updateCanvasContainerSize();
      updateNavMenuScrollButtons();
    });
  };

  sidebar.setup = function () {
    setupCollapsing();
    sidebar.initSideBarAnimation();

    collapseButton.on("click", function () {
      hideNavMenus();
      const settingValue = parseInt(sidebar.getSidebarVisibility());
      if (settingValue === 1) {
        sidebar.showSidebar(0);
      } else {
        sidebar.showSidebar(1);
      }
    })
      .on("contextmenu", function (event){
        if ( event ) {
          event.preventDefault();
        }
      });
      
    collapseButton.addEventListener("contextmenu", function (event) {
      if (event) {
        event.preventDefault();
      }
    });

    if ( window.innerWidth <= 1024 ) {
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
      d3.select("#about").node().innerHTML = generalMetaObj.iri;
    }
    if (Object.prototype.hasOwnProperty.call(generalMetaObj, "iri")) {
      d3.select("#about").node().href = generalMetaObj.iri;
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
