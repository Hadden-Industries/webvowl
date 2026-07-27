/**
 * Contains the logic for the sidebar.
 * @param graph the graph that belongs to these controls
 * @returns {{}}
 */
module.exports = function ( graph ){
  
  const sidebar = {};
  const languageTools = webvowl.util.languageTools();
  const elementTools = webvowl.util.elementTools();
  // Required for reloading when the language changes
  let ontologyInfo;
  let visibleSidebar = 1;
  let lastSelectedElement;

  const detailArea = d3.select("#detailsArea");
  const graphArea = d3.select("#canvasArea");
  const collapseButton = d3.select("#sidebarExpandButton");
  
  /**
   * Setup the menu bar.
   */
  
  
  function setupCollapsing(){
    // adapted version of this example: http://www.normansblog.de/simple-jquery-accordion/
    function collapseContainers( containers ){
      containers.classed("hidden", true);
    }
    
    function expandContainers( containers ){
      containers.classed("hidden", false);
    }
    
    const triggers = d3.selectAll(".accordion-trigger");

    // Collapse all inactive triggers on startup
    collapseContainers(d3.selectAll(".accordion-trigger:not(.accordion-trigger-active) + div"));

    triggers.attr("tabindex", "0").attr("role", "button");
    triggers.on("keydown", function (event){
      const evt = event || window.event;
      if ( evt && (evt.key === "Enter" || evt.key === " ") ) {
        evt.preventDefault();
        d3.select(this).node().click();
      }
    });

    triggers.on("click", function (){
      const selectedTrigger = d3.select(this),
        activeTriggers = d3.selectAll(".accordion-trigger-active");
      
      if ( selectedTrigger.classed("accordion-trigger-active") ) {
        // Collapse the active (which is also the selected) trigger
        collapseContainers(d3.select(selectedTrigger.node().nextElementSibling));
        selectedTrigger.classed("accordion-trigger-active", false);
      } else {
        // Collapse the other trigger ...
        collapseContainers(d3.selectAll(".accordion-trigger-active + div"));
        activeTriggers.classed("accordion-trigger-active", false);
        // ... and expand the selected one
        expandContainers(d3.select(selectedTrigger.node().nextElementSibling));
        selectedTrigger.classed("accordion-trigger-active", true);
      }
    });
  }
  
  sidebar.clearOntologyInformation = function (){
    
    d3.select("#title").text("No title available");
    d3.select("#about").attr("href", "#").attr("target", "_blank").text("not given");
    d3.select("#version").text("--");
    d3.select("#authors").text("--");
    d3.select("#description").text("No description available.");
    const container = d3.select("#ontology-metadata");
    container.selectAll("*").remove();
    d3.select("#classCount")
      .text("0");
    d3.select("#objectPropertyCount")
      .text("0");
    d3.select("#datatypePropertyCount")
      .text("0");
    d3.select("#individualCount")
      .text("0");
    d3.select("#nodeCount")
      .text("0");
    d3.select("#edgeCount")
      .text("0");
    
    // clear selectedNode info
    const isTriggerActive = d3.select("#selection-details-trigger").classed("accordion-trigger-active");
    if ( isTriggerActive ) {
      // close accordion
      d3.select("#selection-details-trigger").node().click();
    }
    showSelectionAdvice();
    
  };
  
  /**
   * Updates the information of the passed ontology.
   * @param data the graph data
   * @param statistics the statistics module
   */
  sidebar.updateOntologyInformation = function ( data, statistics ){
    data = data || {};
    ontologyInfo = data.header || {};
    
    setLanguages(ontologyInfo.languages);
    updateGraphInformation();
    displayGraphStatistics(undefined, statistics);
    displayMetadata(ontologyInfo.other);
    
    // Reset the sidebar selection
    sidebar.updateSelectionInformation(undefined);
  };
  
  function getBrowserLanguages(){
    const nav = typeof navigator !== "undefined" ? navigator : {};
    const browserLangs = [];
    if ( Array.isArray(nav.languages) ) {
      for ( let i = 0; i < nav.languages.length; i++ ) {
        const l = nav.languages[i];
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

    const browserLangs = getBrowserLanguages();

    // 1. Try exact matches with browser languages (case-insensitive)
    for ( let i = 0; i < browserLangs.length; i++ ) {
      const bLang = browserLangs[i].toLowerCase();
      for ( let j = 0; j < languages.length; j++ ) {
        if ( typeof languages[j] === "string" && languages[j].toLowerCase() === bLang ) {
          return languages[j];
        }
      }
    }

    // 2. Try primary language tag matches (e.g., "de-DE" matches "de", or "de" matches "de-DE")
    for ( let k = 0; k < browserLangs.length; k++ ) {
      if ( typeof browserLangs[k] !== "string" ) {continue;}
      const primaryBLang = browserLangs[k].split("-")[0].toLowerCase();
      for ( let m = 0; m < languages.length; m++ ) {
        if ( typeof languages[m] !== "string" ) {continue;}
        const langLower = languages[m].toLowerCase();
        const primaryLang = langLower.split("-")[0];
        if ( langLower === primaryBLang || primaryLang === primaryBLang ) {
          return languages[m];
        }
      }
    }

    // 3. Fallback: English ("en" or "en-*")
    for ( let n = 0; n < languages.length; n++ ) {
      if ( typeof languages[n] === "string" ) {
        const lLower = languages[n].toLowerCase();
        if ( lLower === "en" || lLower.split("-")[0] === "en" ) {
          return languages[n];
        }
      }
    }

    // 4. Fallback: LANG_UNDEFINED ("undefined")
    const langUndefined = webvowl.util.constants().LANG_UNDEFINED;
    if ( languages.indexOf(langUndefined) >= 0 ) {
      return langUndefined;
    }

    // 5. Fallback: LANG_IRIBASED ("id")
    const langIri = webvowl.util.constants().LANG_IRIBASED;
    if ( languages.indexOf(langIri) >= 0 ) {
      return langIri;
    }

    // 6. Fallback: First language in list
    return languages[0];
  }

  function setLanguages( languages ){
    languages = languages || [];
    
    // Put the default and unset label on top of the selection labels
    languages.sort(function ( a, b ){
      if ( a === webvowl.util.constants().LANG_IRIBASED ) {
        return -1;
      } else if ( b === webvowl.util.constants().LANG_IRIBASED ) {
        return 1;
      }
      if ( a === webvowl.util.constants().LANG_UNDEFINED ) {
        return -1;
      } else if ( b === webvowl.util.constants().LANG_UNDEFINED ) {
        return 1;
      }
      return a.localeCompare(b);
    });
    
    const languageSelection = d3.select("#language")
      .on("change", function (event){
        graph.language(event.target.value);
        updateGraphInformation();
        sidebar.updateSelectionInformation(lastSelectedElement);
      });
    
    languageSelection.selectAll("option").remove();
    languageSelection.selectAll("option")
      .data(languages)
      .enter().append("option")
      .attr("value", function ( d ){
        return d;
      })
      .text(function ( d ){
        return d;
      });
    
    const selectedLanguage = findBestMatchingLanguage(languages);
    if ( selectedLanguage ) {
      const langIndex = languages.indexOf(selectedLanguage);
      if ( langIndex >= 0 ) {
        languageSelection.property("selectedIndex", langIndex);
      }
      if ( languageSelection.node() ) {
        languageSelection.node().value = selectedLanguage;
      }
      graph.language(selectedLanguage);
    }
  }
  
  function updateGraphInformation(){
    const title = languageTools.textInLanguage(ontologyInfo.title, graph.language());
    d3.select("#title").text(title || "No title available");
    d3.select("#about").attr("href", ontologyInfo.iri).attr("target", "_blank").text(ontologyInfo.iri);
    d3.select("#version").text(ontologyInfo.version || "--");
    const authors = ontologyInfo.author;
    if ( typeof authors === "string" ) {
      // Stay compatible with author info as strings after change in january 2015
      d3.select("#authors").text(authors);
    } else if ( authors instanceof Array ) {
      d3.select("#authors").text(authors.join(", "));
    } else {
      d3.select("#authors").text("--");
    }
    
    const description = languageTools.textInLanguage(ontologyInfo.description, graph.language());
    d3.select("#description").text(description || "No description available.");
  }
  
  function displayGraphStatistics( deliveredMetrics, statistics ){
    // Metrics are optional and may be undefined
    deliveredMetrics = deliveredMetrics || {};
    
    d3.select("#classCount")
      .text(deliveredMetrics.classCount || statistics.classCount());
    d3.select("#objectPropertyCount")
      .text(deliveredMetrics.objectPropertyCount || statistics.objectPropertyCount());
    d3.select("#datatypePropertyCount")
      .text(deliveredMetrics.datatypePropertyCount || statistics.datatypePropertyCount());
    d3.select("#individualCount")
      .text(deliveredMetrics.totalIndividualCount || statistics.totalIndividualCount());
    d3.select("#nodeCount")
      .text(statistics.nodeCount());
    d3.select("#edgeCount")
      .text(statistics.edgeCount());
  }
  
  function displayMetadata( metadata ){
    const container = d3.select("#ontology-metadata");
    container.selectAll("*").remove();
    
    listAnnotations(container, metadata);
    
    if ( container.selectAll(".annotation").size() <= 0 ) {
      container.append("p").text("No annotations available.");
    }
  }
  
  const RANK_MAP = {
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
    const dataId = pNode.getAttribute("data-identifier");
    if ( dataId ) {return dataId;}
    
    const span = pNode.querySelector("span");
    if ( span && span.id ) {
      const id = span.id;
      if ( id === "propname" ) {return "name";}
      if ( id === "typeProp" || id === "typeNode" ) {return "type";}
      if ( id === "classEquivUri" || id === "propEquivUri" ) {return "equiv";}
      if ( id === "disjointNodes" ) {return "disjoint";}
      if ( id === "classAttributes" || id === "propAttributes" ) {return "charac";}
      if ( id === "individuals" ) {return "individuals";}
      if ( id === "nodeDescription" || id === "propDescription" ) {return "description";}
      if ( id === "nodeComment" || id === "propComment" ) {return "comment";}
      if ( id === "subproperties" ) {return "subprop";}
      if ( id === "superproperties" ) {return "superprop";}
      if ( id === "infoCardinality" || id === "minCardinality" || id === "maxCardinality" ) {return "cardinality";}
      if ( id === "inverse" ) {return "inverse";}
      if ( id === "domain" ) {return "domain";}
      if ( id === "range" ) {return "range";}
      return id;
    }
    
    const text = pNode.textContent || pNode.innerText || "";
    const parts = text.split(":");
    if ( parts.length > 0 ) {
      return parts[0].trim();
    }
    return "";
  }

  function compareParagraphs( a, b ) {
    const idA = getParagraphIdentifier(a);
    const idB = getParagraphIdentifier(b);
    
    const rankA = RANK_MAP[idA] !== undefined ? RANK_MAP[idA] : 100;
    const rankB = RANK_MAP[idB] !== undefined ? RANK_MAP[idB] : 100;
    
    if ( rankA !== rankB ) {
      return rankA - rankB;
    }
    
    const labelA = String(idA).toLowerCase();
    const labelB = String(idB).toLowerCase();
    if ( labelA < labelB ) {return -1;}
    if ( labelA > labelB ) {return 1;}
    
    const textA = String(a.textContent || a.innerText || "").toLowerCase();
    const textB = String(b.textContent || b.innerText || "").toLowerCase();
    if ( textA < textB ) {return -1;}
    if ( textA > textB ) {return 1;}
    
    return 0;
  }

  function sortDetailsPane( containerSelector ) {
    const parent = document.querySelector(containerSelector);
    if ( !parent ) {return;}
    
    const paragraphs = Array.prototype.slice.call(parent.children).filter(function ( el ) {
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

  function listAnnotations( container, annotationObject ){
    annotationObject = annotationObject || {};
    const preferredLanguage = graph && graph.language ? graph.language() : null;
    
    const annotations = [];
    for ( const annotation in annotationObject ) {
      if ( Object.prototype.hasOwnProperty.call(annotationObject, annotation) ) {
        const rawItems = annotationObject[annotation];
        const items = filterAnnotationItems(rawItems, preferredLanguage);
        if ( items && items.length > 0 ) {
          const sortedItems = items.slice(0).sort(function ( a, b ) {
            const valA = String(a.value);
            const valB = String(b.value);
            if ( valA < valB ) {return -1;}
            if ( valA > valB ) {return 1;}
            return 0;
          });
          sortedItems.forEach(function ( item ) {
            annotations.push(item);
          });
        }
      }
    }
    
    container.selectAll(".annotation").remove();
    const paragraphs = container.selectAll(".annotation").data(annotations).enter().append("p")
      .classed("annotation", true)
      .classed("statisticDetails", true)
      .attr("data-identifier", function ( d ){
        return d.identifier;
      });
    
    // Build the annotation property name as a hyperlink if a predicate IRI is available
    paragraphs.each(function ( d ) {
      const p = d3.select(this);
      // Determine the full IRI for the annotation property
      let predicateIri = null;
      let localName = null;
      if ( d.predicateNs ) {
        // local name is everything after the last # or /
        const rawLocal = d.identifier.replace(/^[^:]+:/, ""); // strip any CURIE prefix (e.g. "rdfs:" from "rdfs:label")
        predicateIri = d.predicateNs + rawLocal;
        localName = rawLocal;
      } else if ( d.identifier && d.identifier.indexOf(":") !== -1 ) {
        // identifier is already a CURIE — resolve using well-known prefixes
        const WELL_KNOWN = {
          "rdf":     "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
          "rdfs":    "http://www.w3.org/2000/01/rdf-schema#",
          "owl":     "http://www.w3.org/2002/07/owl#",
          "xsd":     "http://www.w3.org/2001/XMLSchema#",
          "skos":    "http://www.w3.org/2004/02/skos/core#",
          "dcterms": "http://purl.org/dc/terms/",
          "dc":      "http://purl.org/dc/elements/1.1/"
        };
        const parts = d.identifier.split(":");
        const prefix = parts[0];
        localName = parts.slice(1).join(":");
        if ( WELL_KNOWN[prefix] ) {
          predicateIri = WELL_KNOWN[prefix] + localName;
        }
      }
      
      if ( predicateIri && localName ) {
        p.append("a")
          .attr("href", predicateIri)
          .attr("target", "_blank")
          .attr("title", predicateIri)
          .text(localName);
        p.node().appendChild(document.createTextNode(": "));
      } else {
        p.node().appendChild(document.createTextNode(d.identifier + ": "));
      }
      

      const valueSpan = p.append("span");
      if ( d.type === "iri" ) {
        valueSpan.append("a")
          .attr("href", d.value)
          .attr("title", d.value)
          .attr("target", "_blank")
          .text(d.value);
      } else {
        valueSpan.text(d.value);
      }
    });
  }
  
  /**
   * Update the information of the selected node.
   * @param selectedElement the selection or null if nothing is selected
   */
  sidebar.updateSelectionInformation = function ( selectedElement, event, forced ){
    lastSelectedElement = selectedElement;
    
    // Click event was prevented when dragging
    if ( event && event.defaultPrevented && !forced ) {
      return;
    }
    
    const isTriggerActive = d3.select("#selection-details-trigger").classed("accordion-trigger-active");
    if ( selectedElement && !isTriggerActive ) {
      d3.select("#selection-details-trigger").node().click();
    } else if ( !selectedElement && isTriggerActive ) {
      showSelectionAdvice();
      return;
    }
    
    if ( elementTools.isProperty(selectedElement) ) {
      displayPropertyInformation(selectedElement);
    } else if ( elementTools.isNode(selectedElement) ) {
      displayNodeInformation(selectedElement);
    }
  };
  
  function showSelectionAdvice(){
    setSelectionInformationVisibility(false, false, true);
  }
  
  function setSelectionInformationVisibility( showClasses, showProperties, showAdvice ){
    d3.select("#classSelectionInformation").classed("hidden", !showClasses);
    d3.select("#propertySelectionInformation").classed("hidden", !showProperties);
    d3.select("#noSelectionInformation").classed("hidden", !showAdvice);
  }
  
  function displayPropertyInformation( property ){
    showPropertyInformations();
    
    setIriLabel(d3.select("#propname"), property.labelForCurrentLanguage(), property.iri());
    d3.select("#typeProp").text(property.type());
    
    if ( property.inverse() !== undefined ) {
      d3.select("#inverse").classed("hidden", false);
      setIriLabel(d3.select("#inverse span"), property.inverse().labelForCurrentLanguage(), property.inverse().iri());
    } else {
      d3.select("#inverse").classed("hidden", true);
    }
    
    const equivalentIriSpan = d3.select("#propEquivUri");
    listNodeArray(equivalentIriSpan, property.equivalents());
    
    listNodeArray(d3.select("#subproperties"), property.subproperties());
    listNodeArray(d3.select("#superproperties"), property.superproperties());
    
    if ( property.minCardinality() !== undefined ) {
      d3.select("#infoCardinality").classed("hidden", true);
      d3.select("#minCardinality").classed("hidden", false);
      d3.select("#minCardinality span").text(property.minCardinality());
      d3.select("#maxCardinality").classed("hidden", false);
      
      if ( property.maxCardinality() !== undefined ) {
        d3.select("#maxCardinality span").text(property.maxCardinality());
      } else {
        d3.select("#maxCardinality span").text("*");
      }
      
    } else if ( property.cardinality() !== undefined ) {
      d3.select("#minCardinality").classed("hidden", true);
      d3.select("#maxCardinality").classed("hidden", true);
      d3.select("#infoCardinality").classed("hidden", false);
      d3.select("#infoCardinality span").text(property.cardinality());
    } else {
      d3.select("#infoCardinality").classed("hidden", true);
      d3.select("#minCardinality").classed("hidden", true);
      d3.select("#maxCardinality").classed("hidden", true);
    }
    
    setIriLabel(d3.select("#domain"), property.domain().labelForCurrentLanguage(), property.domain().iri());
    setIriLabel(d3.select("#range"), property.range().labelForCurrentLanguage(), property.range().iri());
    
    displayAttributes(property.attributes(), d3.select("#propAttributes"));
    
    setTextAndVisibility(d3.select("#propDescription"), property.descriptionForCurrentLanguage());
    setTextAndVisibility(d3.select("#propComment"), property.commentForCurrentLanguage());
    
    const annotations = property.annotations();
    const filteredAnnotations = {};
    if ( annotations ) {
      for ( const key in annotations ) {
        // Skip prefLabel (shown as Name) and raw "label" key (handled below as rdfs:label)
        if ( Object.prototype.hasOwnProperty.call(annotations, key) && key !== "prefLabel" && key !== "label" ) {
          filteredAnnotations[key] = annotations[key];
        }
      }
    }
    
    // Surface rdfs:label values that differ from the preferred display name
    const prefName = property.labelForCurrentLanguage();
    const allRdfsLabels = (annotations && annotations["label"]) ? annotations["label"] : [];
    const rdfsLabels = allRdfsLabels.filter(function(entry) {
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
  
  function showPropertyInformations(){
    setSelectionInformationVisibility(false, true, false);
  }
  
  function setIriLabel( element, name, iri ){
    const parent = d3.select(element.node().parentNode);
    
    if ( name ) {
      element.selectAll("*").remove();
      appendIriLabel(element, name, iri);
      parent.classed("hidden", false);
    } else {
      parent.classed("hidden", true);
    }
  }
  
  function appendIriLabel( element, name, iri ){
    let tag;
    
    if ( iri ) {
      tag = element.append("a")
        .attr("href", iri)
        .attr("title", iri)
        .attr("target", "_blank");
    } else {
      tag = element.append("span");
    }
    tag.text(name);
  }
  
  function displayAttributes( attributes, textSpan ){
    const spanParent = d3.select(textSpan.node().parentNode);
    
    if ( attributes && attributes.length > 0 ) {
      // Remove redundant redundant attributes for sidebar
      removeElementFromArray("object", attributes);
      removeElementFromArray("datatype", attributes);
      removeElementFromArray("rdf", attributes);
    }
    
    if ( attributes && attributes.length > 0 ) {
      textSpan.text(attributes.join(", "));
      
      spanParent.classed("hidden", false);
    } else {
      spanParent.classed("hidden", true);
    }
  }
  
  function removeElementFromArray( element, array ){
    const index = array.indexOf(element);
    if ( index > -1 ) {
      array.splice(index, 1);
    }
  }
  
  function displayNodeInformation( node ){
    showClassInformations();
    
    setIriLabel(d3.select("#name"), node.labelForCurrentLanguage(), node.iri());
    
    /* Equivalent stuff. */
    const equivalentIriSpan = d3.select("#classEquivUri");
    listNodeArray(equivalentIriSpan, node.equivalents());
    
    d3.select("#typeNode").text(node.type());
    listNodeArray(d3.select("#individuals"), node.individuals());
    
    /* Disjoint stuff. */
    const disjointNodes = d3.select("#disjointNodes");
    const disjointNodesParent = d3.select(disjointNodes.node().parentNode);
    
    if ( node.disjointWith() !== undefined ) {
      disjointNodes.selectAll("*").remove();
      
      node.disjointWith().forEach(function ( element, index ){
        if ( index > 0 ) {
          disjointNodes.append("span").text(", ");
        }
        appendIriLabel(disjointNodes, element.labelForCurrentLanguage(), element.iri());
      });
      
      disjointNodesParent.classed("hidden", false);
    } else {
      disjointNodesParent.classed("hidden", true);
    }
    
    displayAttributes(node.attributes(), d3.select("#classAttributes"));
    
    setTextAndVisibility(d3.select("#nodeDescription"), node.descriptionForCurrentLanguage());
    setTextAndVisibility(d3.select("#nodeComment"), node.commentForCurrentLanguage());
    
    const annotations = node.annotations();
    const filteredAnnotations = {};
    if ( annotations ) {
      for ( const key in annotations ) {
        // Skip prefLabel (shown as Name) and raw "label" key (handled below as rdfs:label)
        if ( Object.prototype.hasOwnProperty.call(annotations, key) && key !== "prefLabel" && key !== "label" ) {
          filteredAnnotations[key] = annotations[key];
        }
      }
    }
    
    // Surface rdfs:label values that differ from the preferred display name
    const prefName = node.labelForCurrentLanguage();
    const allRdfsLabels = (annotations && annotations["label"]) ? annotations["label"] : [];
    const rdfsLabels = allRdfsLabels.filter(function(entry) {
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
  
  function showClassInformations(){
    setSelectionInformationVisibility(true, false, false);
  }
  
  function listNodeArray( textSpan, nodes ){
    const spanParent = d3.select(textSpan.node().parentNode);
    
    if ( nodes && nodes.length ) {
      textSpan.selectAll("*").remove();
      nodes.forEach(function ( element, index ){
        if ( index > 0 ) {
          textSpan.append("span").text(", ");
        }
        appendIriLabel(textSpan, element.labelForCurrentLanguage(), element.iri());
      });
      
      spanParent.classed("hidden", false);
    } else {
      spanParent.classed("hidden", true);
    }
  }
  
  function setTextAndVisibility( label, value ){
    const parentNode = d3.select(label.node().parentNode);
    const hasValue = !!value;
    if ( value ) {
      label.text(value);
    }
    parentNode.classed("hidden", !hasValue);
  }
  
  /** Collapsible Sidebar functions; **/

  sidebar.updateDockedControlsPosition = function (){
    const isHidden = detailArea.classed("hidden");
    const zoomSlider = d3.select("#zoomSlider");
    const collapseButton = d3.select("#sidebarExpandButton");

    zoomSlider.classed("aligned-to-sidebar", !isHidden);
    collapseButton.classed("aligned-to-sidebar", !isHidden);
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

  function getRightSidebarWidth(){
    const styleVal = window.getComputedStyle(document.documentElement).getPropertyValue("--right-sidebar-width").trim();
    const parsed = parseInt(styleVal, 10);
    return isNaN(parsed) ? 280 : parsed;
  }

  sidebar.showSidebar = function ( val, init ){
    if ( init === true ) {
      d3.select("body").classed("no-transition", true);
    }

    if ( val === 1 ) {
      visibleSidebar = true;
      collapseButton.node().innerHTML = ">";
      detailArea.classed("hidden", false);
      graphArea.classed("sidebar-visible", true);
      d3.select("#WarningErrorMessagesContainer").classed("sidebar-visible", true);
      graph.options().width(window.innerWidth - getRightSidebarWidth());
    } else {
      visibleSidebar = false;
      collapseButton.node().innerHTML = "<";
      detailArea.classed("hidden", true);
      graphArea.classed("sidebar-visible", false);
      d3.select("#WarningErrorMessagesContainer").classed("sidebar-visible", false);
      graph.options().width(window.innerWidth);
    }

    sidebar.updateDockedControlsPosition();
    graph.updateCanvasContainerSize();
    updateNavMenuScrollButtons();

    if ( init === true ) {
      requestAnimationFrame(function (){
        d3.select("body").classed("no-transition", false);
      });
    }
  };
  
  sidebar.isSidebarVisible = function (){
    return visibleSidebar;
  };
  
  sidebar.updateSideBarVis = function ( init ){
    const vis = sidebar.getSidebarVisibility();
    sidebar.showSidebar(parseInt(vis), init);
  };
  
  sidebar.getSidebarVisibility = function (){
    const isHidden = detailArea.classed("hidden");
    if ( isHidden === false ) {return String(1);}
    if ( isHidden === true ) {return String(0);}
  };
  
  sidebar.initSideBarAnimation = function (){
    graphArea.node().addEventListener("animationend", function (){
      detailArea.classed("hidden", !visibleSidebar);
      graph.updateCanvasContainerSize();
      updateNavMenuScrollButtons();
    });
  };
  
  sidebar.setup = function (){
    setupCollapsing();
    sidebar.initSideBarAnimation();
    
    collapseButton.on("click", function (){
      hideNavMenus();
      const settingValue = parseInt(sidebar.getSidebarVisibility());
      if ( settingValue === 1 ) {sidebar.showSidebar(0);}
      else                  {sidebar.showSidebar(1);}
    });

    if ( window.innerWidth <= 1024 ) {
      sidebar.showSidebar(0, true);
    }
  };
  
  
  sidebar.updateShowedInformation = function (){
    const editMode = graph.editorMode();
    d3.select("#generalDetails").classed("hidden", editMode);
    d3.select("#generalDetailsEdit").classed("hidden", !editMode);
    
    // store the meta information in graph.options()
    
    // todo: update edit meta info
    graph.options().editSidebar().updateGeneralOntologyInfo();
    
    // todo: update showed meta info;
    graph.options().sidebar().updateGeneralOntologyInfo();
    
  };
  
  sidebar.updateGeneralOntologyInfo = function (){
    // get it from graph.options
    const generalMetaObj = graph.options().getGeneralMetaObject();
    const preferredLanguage = graph && graph.language ? graph.language() : null;
    if ( Object.prototype.hasOwnProperty.call(generalMetaObj, "title") ) {
      // title has language to it -.-
      if ( typeof generalMetaObj.title === "object" ) {
        d3.select("#title").node().value = languageTools.textInLanguage(generalMetaObj.title, preferredLanguage);
      } else {
        d3.select("#title").node().innerHTML = generalMetaObj.title;
      }
      
    }
    if ( Object.prototype.hasOwnProperty.call(generalMetaObj, "iri") ) {d3.select("#about").node().innerHTML = generalMetaObj.iri;}
    if ( Object.prototype.hasOwnProperty.call(generalMetaObj, "iri") ) {d3.select("#about").node().href = generalMetaObj.iri;}
    if ( Object.prototype.hasOwnProperty.call(generalMetaObj, "version") ) {d3.select("#version").node().innerHTML = generalMetaObj.version;}
    if ( Object.prototype.hasOwnProperty.call(generalMetaObj, "author") ) {d3.select("#authors").node().innerHTML = generalMetaObj.author;}
    // this could also be an object >>
    if ( Object.prototype.hasOwnProperty.call(generalMetaObj, "description") ) {
      if ( typeof generalMetaObj.description === "object" ) {
        d3.select("#description").node().innerHTML = languageTools.textInLanguage(generalMetaObj.description, preferredLanguage);
      }
      else {
        d3.select("#description").node().innerHTML = generalMetaObj.description;
      }
    }
  };
  
  
  return sidebar;
};
