// Client-side OWL2VOWL converter in JavaScript
// Optimized for performance, modular maintainability, and clean separation of concerns.

const NAMESPACES = Object.freeze({
  RDF: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
  RDFS: "http://www.w3.org/2000/01/rdf-schema#",
  OWL: "http://www.w3.org/2002/07/owl#",
  DC: "http://purl.org/dc/elements/1.1/",
  DCTERMS: "http://purl.org/dc/terms/"
});

const turtleParser = require("./turtleParser");

/**
 * Manages unique VOWL ID allocation, entity mapping structures,
 * and tracks subclass/subproperty and visual virtualization relations.
 */
class VowlParserContext {
  constructor() {
    this.idCounter = 0;
    this.classMap = new Map();     // IRI -> VOWL Class Node Object
    this.propertyMap = new Map();  // IRI -> VOWL Property Edge Object
    this.subclassRelations = [];   // Array of { subclassIri, superclassIri }
    this.subpropertyRelations = []; // Array of { subpropIri, superpropIri }
    this.parsedRestrictions = [];  // Array of { domainIri, propertyIri, rangeIri, type }
    this.parsedCardinalities = []; // Array of { propertyIri, minCardinality, maxCardinality, cardinality }
    this.virtualDatatypes = [];    // Visual-individualized Datatype representations
    this.parsedIndividuals = [];   // List of parsed NamedIndividual models
  }

  /**
   * Generates a unique numeric VOWL ID identifier.
   * @returns {string}
   */
  nextId() {
    return String(this.idCounter++);
  }
}

/**
 * Highly performant IRI resolver utilizing internal Map caching to bypass
 * repetitive string-slicing and indexing operations on high-volume ontologies.
 */
class PerformanceIriResolver {
  constructor(ontologyBaseIri) {
    this.ontologyBaseIri = ontologyBaseIri;
    this.resolvedCache = new Map();
    this.localNameCache = new Map();
    this.baseIriCache = new Map();
  }

  /**
   * Resolves raw schema fragments and relative IRIs into absolute IRIs.
   * @param {string} iri 
   * @returns {string}
   */
  resolve(iri, baseIri) {
    const activeBase = baseIri || this.ontologyBaseIri;
    if (!iri) return activeBase;
    
    const cacheKey = baseIri ? baseIri + "|" + iri : iri;
    if (this.resolvedCache.has(cacheKey)) {
      return this.resolvedCache.get(cacheKey);
    }
 
    const colonIdx = iri.indexOf(":");
    const slashIdx = iri.indexOf("/");
    let resolved = iri;
 
    // Is absolute IRI?
    if (!(colonIdx !== -1 && (slashIdx === -1 || colonIdx < slashIdx))) {
      if (activeBase) {
        if (iri === "") {
          resolved = activeBase;
        } else if (iri.startsWith("#")) {
          const baseHasHash = activeBase.endsWith("#");
          resolved = baseHasHash ? activeBase + iri.substring(1) : activeBase + iri;
        } else {
          const baseEndsWithHashOrSlash = activeBase.endsWith("#") || activeBase.endsWith("/");
          resolved = baseEndsWithHashOrSlash ? activeBase + iri : activeBase + "#" + iri;
        }
      }
    }
 
    this.resolvedCache.set(cacheKey, resolved);
    return resolved;
  }

  /**
   * Splits and extracts the local name segment of an IRI.
   * @param {string} iri 
   * @returns {string}
   */
  getLocalName(iri) {
    if (!iri) return "";
    if (this.localNameCache.has(iri)) {
      return this.localNameCache.get(iri);
    }
    const hashIdx = iri.lastIndexOf("#");
    let local = iri;
    if (hashIdx !== -1) {
      local = iri.substring(hashIdx + 1);
    } else {
      const slashIdx = iri.lastIndexOf("/");
      if (slashIdx !== -1) {
        local = iri.substring(slashIdx + 1);
      }
    }
    this.localNameCache.set(iri, local);
    return local;
  }

  /**
   * Splits and extracts the base namespace segment of an IRI.
   * @param {string} iri 
   * @returns {string}
   */
  getBaseIri(iri) {
    if (!iri) return "";
    if (this.baseIriCache.has(iri)) {
      return this.baseIriCache.get(iri);
    }
    const hashIdx = iri.lastIndexOf("#");
    let base = iri;
    if (hashIdx !== -1) {
      base = iri.substring(0, hashIdx);
    } else {
      const slashIdx = iri.lastIndexOf("/");
      if (slashIdx !== -1) {
        base = iri.substring(0, slashIdx);
      }
    }
    this.baseIriCache.set(iri, base);
    return base;
  }
}

/**
 * Collection of fast, localized utility functions for DOM Node traversing and namespace scanning.
 */
class DomParserUtils {
  /**
   * Extracts an attribute robustly across multiple RDF formats and prefixes.
   */
  static getAttr(el, name, ns) {
    if (ns) {
      const val = el.getAttributeNS(ns, name);
      if (val !== null && val !== "") return val;
    }
    const val = el.getAttribute(name) || el.getAttribute("rdf:" + name) || el.getAttribute("owl:" + name);
    if (val !== null && val !== "") return val;
    
    // Fallback: check all attributes for local name match
    for (let i = 0; i < el.attributes.length; i++) {
      const attr = el.attributes[i];
      if (attr.localName === name) {
        return attr.value;
      }
    }
    return null;
  }

  /**
   * Safely matches subject identifier references.
   */
  static getAbout(el) {
    const about = DomParserUtils.getAttr(el, "about", NAMESPACES.RDF);
    if (about !== null && about !== "") return about;
    const id = DomParserUtils.getAttr(el, "ID", NAMESPACES.RDF);
    if (id !== null && id !== "") {
      return id.startsWith("#") ? id : "#" + id;
    }
    return null;
  }

  /**
   * Extracts immediate child elements by localName in an efficient $O(d)$ linear search,
   * avoiding slow deep recursive DOM scans.
   */
  static findImmediateChildren(parent, localName) {
    const matched = [];
    for (let child = parent.firstChild; child; child = child.nextSibling) {
      if (child.nodeType === 1 && child.localName === localName) {
        matched.push(child);
      }
    }
    return matched;
  }

  /**
   * Fast XML tree-traversal matching specific localName tokens recursively.
   */
  static getElementsByLocalName(parent, localName) {
    const matched = [];
    function traverse(node) {
      if (node.nodeType === 1 || node.nodeType === 9) {
        if (node.nodeType === 1 && node.localName === localName) {
          matched.push(node);
        }
        for (let child = node.firstChild; child; child = child.nextSibling) {
          traverse(child);
        }
      }
    }
    traverse(parent);
    return matched;
  }
}

module.exports = function owl2vowl(xmlString) {
  if (turtleParser.isTurtleFormat(xmlString)) {
    const tokens = turtleParser.tokenizeTurtle(xmlString);
    const parsed = turtleParser.parseTurtleTokens(tokens);
    xmlString = turtleParser.serializeTriplesToRdfXml(parsed.triples, parsed.prefixes, parsed.baseIri);
  }

  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, "application/xml");
  
  const parserError = xmlDoc.getElementsByTagName("parsererror")[0];
  if (parserError) {
    throw new Error("XML parsing error: " + parserError.textContent);
  }

  const rootEl = xmlDoc.documentElement;
  // Get prefix mappings from the root element
  const prefixList = {};
  if (rootEl) {
    for (let i = 0; i < rootEl.attributes.length; i++) {
      const attr = rootEl.attributes[i];
      if (attr.name.startsWith("xmlns:")) {
        prefixList[attr.name.substring(6)] = attr.value;
      } else if (attr.name === "xmlns") {
        prefixList[""] = attr.value;
      }
    }
  }

  const ontologyBaseIri = rootEl ? (DomParserUtils.getAttr(rootEl, "base") || "") : "";
  const resolver = new PerformanceIriResolver(ontologyBaseIri);
  const context = new VowlParserContext();
  const subjects = {};

  function getActiveBaseUri(element) {
    let current = element;
    while (current) {
      if (current.getAttribute) {
        const base = current.getAttribute("xml:base") || current.getAttribute("base");
        if (base) return base;
      }
      current = current.parentNode;
    }
    return ontologyBaseIri;
  }

  // Setup dynamic language selection sets
  const languagesSet = new Set();

  /**
   * Dynamically tracks, cleans, and registers parsed language codes.
   * Matches ISO 639-1 base tags and regional subtags for precise visual presentation.
   */
  function registerLanguage(rawLang) {
    const clean = (rawLang || "").trim().toLowerCase();
    if (!clean || clean === "undefined") {
      languagesSet.add("undefined");
      return "undefined";
    }
    languagesSet.add(clean);
    // If it's a regional subtag (e.g. en-gb or pt-br), also register the base fallback tag
    if (clean.includes("-")) {
      const base = clean.split("-")[0];
      languagesSet.add(base);
    }
    return clean;
  }

  function getOrCreateSubject(iri) {
    if (!subjects[iri]) {
      subjects[iri] = {
        iri: iri,
        types: new Set(),
        labels: {},
        comments: {},
        domains: [],
        ranges: [],
        superClasses: [],
        subClasses: [],
        superProperties: [],
        subProperties: [],
        inverses: [],
        equivalentClasses: [],
        disjointWith: [],
        annotations: {}
      };
    }
    return subjects[iri];
  }

  /**
   * Resolves child properties within nested Restriction structures.
   */
  function getPropertyIriFromOnProperty(onPropertyEl) {
    if (!onPropertyEl) return null;
    let iri = DomParserUtils.getAttr(onPropertyEl, "resource", NAMESPACES.RDF) || DomParserUtils.getAbout(onPropertyEl);
    if (iri) return iri;
    for (let child = onPropertyEl.firstChild; child; child = child.nextSibling) {
      if (child.nodeType === 1) {
        const childIri = DomParserUtils.getAbout(child) || DomParserUtils.getAttr(child, "resource", NAMESPACES.RDF);
        if (childIri) return childIri;
      }
    }
    return null;
  }

  /**
   * Traverses XML DOM nodes to construct the initial subject-predicate-object structure map.
   */
  function parseSubject(element) {
    const rawAbout = DomParserUtils.getAbout(element);
    const activeBase = getActiveBaseUri(element);
    const subjectIri = rawAbout ? resolver.resolve(rawAbout, activeBase) : null;
    if (!subjectIri) return;

    const subject = getOrCreateSubject(subjectIri);

    // Parse specific types from tags
    const localName = element.localName;

    if (localName !== "Description") {
      if (localName === "Class") {
        subject.types.add(NAMESPACES.OWL + "Class");
      } else if (localName === "ObjectProperty") {
        subject.types.add(NAMESPACES.OWL + "ObjectProperty");
      } else if (localName === "DatatypeProperty") {
        subject.types.add(NAMESPACES.OWL + "DatatypeProperty");
      } else if (localName === "AnnotationProperty") {
        subject.types.add(NAMESPACES.OWL + "AnnotationProperty");
      } else if (localName === "Ontology") {
        subject.types.add(NAMESPACES.OWL + "Ontology");
      } else if (localName === "NamedIndividual") {
        subject.types.add(NAMESPACES.OWL + "NamedIndividual");
      } else if (element.namespaceURI) {
        subject.types.add(element.namespaceURI + localName);
      }
    }

    // Process nested predicates
    for (let pred = element.firstChild; pred; pred = pred.nextSibling) {
      if (pred.nodeType !== 1) continue;

      const predLocal = pred.localName;
      const predNs = pred.namespaceURI;
      const activeBasePred = getActiveBaseUri(pred);
      const resource = DomParserUtils.getAttr(pred, "resource", NAMESPACES.RDF) ? resolver.resolve(DomParserUtils.getAttr(pred, "resource", NAMESPACES.RDF), activeBasePred) : null;

      if (predLocal === "type" && predNs === NAMESPACES.RDF) {
        if (resource) subject.types.add(resource);
      } else if (predLocal === "label" && predNs === NAMESPACES.RDFS) {
        const rawLang = pred.getAttribute("xml:lang") || pred.getAttributeNS("http://www.w3.org/XML/1998/namespace", "lang") || "undefined";
        const lang = registerLanguage(rawLang);
        const labelVal = pred.textContent.trim();
        
        subject.labels[lang] = labelVal;
        // Language subtag propagation (e.g. en-us -> en fallback)
        if (lang.includes("-")) {
          const baseLang = lang.split("-")[0];
          if (!subject.labels[baseLang]) {
            subject.labels[baseLang] = labelVal;
          }
        }

        // Also collect in annotations so all values are preserved (labels[] only keeps one per lang)
        if (!subject.annotations["label"]) subject.annotations["label"] = [];
        subject.annotations["label"].push({
          value: labelVal,
          type: "label",
          language: lang,
          identifier: "rdfs:label",
          predicateNs: NAMESPACES.RDFS
        });
      } else if (
        (predLocal === "comment" && predNs === NAMESPACES.RDFS) ||
        (predLocal === "comment" && predNs === NAMESPACES.OWL) ||
        (predLocal === "description" && (predNs === NAMESPACES.DCTERMS || predNs === NAMESPACES.DC))
      ) {
        const rawLang = pred.getAttribute("xml:lang") || pred.getAttributeNS("http://www.w3.org/XML/1998/namespace", "lang") || "undefined";
        const lang = registerLanguage(rawLang);
        const commentVal = pred.textContent.trim();
        
        subject.comments[lang] = commentVal;
        if (lang.includes("-")) {
          const baseLang = lang.split("-")[0];
          if (!subject.comments[baseLang]) {
            subject.comments[baseLang] = commentVal;
          }
        }
      } else if (
        (predLocal === "domain" || predLocal === "range" || predLocal === "subClassOf" || 
         predLocal === "subPropertyOf" || predLocal === "inverseOf" || 
         predLocal === "equivalentClass" || predLocal === "disjointWith") && 
        (predNs === NAMESPACES.RDFS || predNs === NAMESPACES.OWL)
      ) {
        let targetResource = resource;
        if (!targetResource) {
          // Look for any child element
          let nestedEl = null;
          for (let childNode = pred.firstChild; childNode; childNode = childNode.nextSibling) {
            if (childNode.nodeType === 1) {
              nestedEl = childNode;
              break;
            }
          }
          if (nestedEl) {
            const isRestriction = nestedEl.localName === "Restriction" && (nestedEl.namespaceURI === NAMESPACES.OWL || nestedEl.prefix === "owl");
            if (isRestriction && (predLocal === "subClassOf" || predLocal === "equivalentClass")) {
              
              /* HIGH PERFORMANCE RESTRICTION EXTRACTION - $O(d)$ single pass child iterator */
              let onPropertyEl = null;
              let minCardVal = null;
              let maxCardVal = null;
              let cardVal = null;
              let someValuesFromEl = null;
              let allValuesFromEl = null;
              let hasValueEl = null;

              for (let rxChild = nestedEl.firstChild; rxChild; rxChild = rxChild.nextSibling) {
                if (rxChild.nodeType !== 1) continue;
                const rxLn = rxChild.localName;
                if (rxLn === "onProperty") {
                  onPropertyEl = rxChild;
                } else if (rxLn === "minQualifiedCardinality" || rxLn === "minCardinality") {
                  minCardVal = rxChild.textContent.trim();
                } else if (rxLn === "maxQualifiedCardinality" || rxLn === "maxCardinality") {
                  maxCardVal = rxChild.textContent.trim();
                } else if (rxLn === "qualifiedCardinality" || rxLn === "cardinality") {
                  cardVal = rxChild.textContent.trim();
                } else if (rxLn === "someValuesFrom") {
                  someValuesFromEl = rxChild;
                } else if (rxLn === "allValuesFrom") {
                  allValuesFromEl = rxChild;
                } else if (rxLn === "hasValue") {
                  hasValueEl = rxChild;
                }
              }

              const propertyIri = onPropertyEl ? getPropertyIriFromOnProperty(onPropertyEl) : null;
              if (propertyIri) {
                const activeBaseNested = getActiveBaseUri(nestedEl);
                const resolvedPropIri = resolver.resolve(propertyIri, activeBaseNested);

                if (minCardVal || maxCardVal || cardVal) {
                  context.parsedCardinalities.push({
                    propertyIri: resolvedPropIri,
                    minCardinality: minCardVal,
                    maxCardinality: maxCardVal,
                    cardinality: cardVal
                  });
                }

                let rangeIri = null;
                let type = null;

                if (someValuesFromEl) {
                  rangeIri = DomParserUtils.getAttr(someValuesFromEl, "resource", NAMESPACES.RDF) || DomParserUtils.getAbout(someValuesFromEl);
                  type = "owl:someValuesFrom";
                } else if (allValuesFromEl) {
                  rangeIri = DomParserUtils.getAttr(allValuesFromEl, "resource", NAMESPACES.RDF) || DomParserUtils.getAbout(allValuesFromEl);
                  type = "owl:allValuesFrom";
                } else if (hasValueEl) {
                  rangeIri = DomParserUtils.getAttr(hasValueEl, "resource", NAMESPACES.RDF) || DomParserUtils.getAbout(hasValueEl);
                  type = "owl:hasValue";
                }

                if (rangeIri) {
                  context.parsedRestrictions.push({
                    domainIri: subjectIri,
                    propertyIri: resolvedPropIri,
                    rangeIri: resolver.resolve(rangeIri, activeBaseNested),
                    type: type
                  });
                }
              }
              targetResource = null; // Do not treat as normal subclass/equivalentClass relation
            } else {
              const activeBaseNested = getActiveBaseUri(nestedEl);
              const about = DomParserUtils.getAbout(nestedEl);
              if (about) {
                targetResource = resolver.resolve(about, activeBaseNested);
              } else {
                // Check if it has owl:unionOf
                const unionOfEl = DomParserUtils.findImmediateChildren(nestedEl, "unionOf")[0];
                if (unionOfEl) {
                  const memberIris = [];
                  const allChildren = unionOfEl.getElementsByTagName ? unionOfEl.getElementsByTagName("*") : [];
                  for (let j = 0; j < allChildren.length; j++) {
                    const descAbout = DomParserUtils.getAbout(allChildren[j]) || DomParserUtils.getAttr(allChildren[j], "resource", NAMESPACES.RDF);
                    if (descAbout) {
                      const activeBaseChild = getActiveBaseUri(allChildren[j]);
                      memberIris.push(resolver.resolve(descAbout, activeBaseChild));
                    }
                  }
                  
                  if (memberIris.length > 0) {
                    const unionCls = ensureClassExists(null, "owl:unionOf");
                    unionCls.attributes.push("union");
                    unionCls.unionMembers = memberIris;
                    targetResource = unionCls.id; // Store ID reference directly
                  }
                }
              }
            }
          }
        }
        if (targetResource) {
          if (predLocal === "domain") {
            subject.domains.push(targetResource);
          } else if (predLocal === "range") {
            subject.ranges.push(targetResource);
          } else if (predLocal === "subClassOf") {
            subject.superClasses.push(targetResource);
          } else if (predLocal === "subPropertyOf") {
            subject.superProperties.push(targetResource);
          } else if (predLocal === "inverseOf") {
            subject.inverses.push(targetResource);
          } else if (predLocal === "equivalentClass") {
            subject.equivalentClasses.push(targetResource);
          } else if (predLocal === "disjointWith") {
            subject.disjointWith.push(targetResource);
          }
        }
      } else {
        // Collect other attributes/metadata
        const rawLang = pred.getAttribute("xml:lang") || pred.getAttributeNS("http://www.w3.org/XML/1998/namespace", "lang") || "undefined";
        const lang = registerLanguage(rawLang);
        const key = predLocal;
        const val = resource || pred.textContent.trim();
        
        if (!subject.annotations[key]) subject.annotations[key] = [];
        subject.annotations[key].push({
          value: val,
          type: resource ? "iri" : "label",
          language: lang,
          identifier: key,
          predicateNs: predNs || ""
        });

        // Multilingual fallback propagation inside raw metadata annotations
        if (lang.includes("-")) {
          const baseLang = lang.split("-")[0];
          const hasBase = subject.annotations[key].some(ann => ann.language === baseLang);
          if (!hasBase) {
            subject.annotations[key].push({
              value: val,
              type: resource ? "iri" : "label",
              language: baseLang,
              identifier: key,
              predicateNs: predNs || ""
            });
          }
        }
      }

      // Recurse into predicate object elements (Level 3 / Level 5) to locate inline declarations
      for (let objectEl = pred.firstChild; objectEl; objectEl = objectEl.nextSibling) {
        if (objectEl.nodeType === 1) {
          parseSubject(objectEl);
        }
      }
    }
  }

  const rootChildren = rootEl ? rootEl.childNodes : [];

  // Init recursive parser
  for (let i = 0; i < rootChildren.length; i++) {
    if (rootChildren[i].nodeType === 1) {
      parseSubject(rootChildren[i]);
    }
  }

  // Identifies standard XML Schema datatypes or built-in RDF/RDFS/OWL datatypes
  function isDatatypeIri(iri) {
    if (!iri) return false;
    // Keep rdfs:Literal categorised specifically as its own VOWL node type
    if (iri === "http://www.w3.org/2000/01/rdf-schema#Literal") return false;
    if (iri.startsWith("http://www.w3.org/2001/XMLSchema#")) return true;
    if (iri.startsWith("http://www.w3.org/1999/02/22-rdf-syntax-ns#")) {
      const local = resolver.getLocalName(iri);
      return ["PlainLiteral", "XMLLiteral", "HTML", "langString"].includes(local);
    }
    if (iri.startsWith("http://www.w3.org/2002/07/owl#")) {
      const local = resolver.getLocalName(iri);
      return ["real", "rational"].includes(local);
    }
    return false;
  }

  const ignoredProperties = new Set([
    "http://www.w3.org/2000/01/rdf-schema#label",
    "http://www.w3.org/2000/01/rdf-schema#comment",
    "http://www.w3.org/2000/01/rdf-schema#seeAlso",
    "http://www.w3.org/2000/01/rdf-schema#isDefinedBy",
    "http://www.w3.org/2002/07/owl#versionInfo",
    "http://www.w3.org/2002/07/owl#priorVersion",
    "http://www.w3.org/2002/07/owl#backwardCompatibleWith",
    "http://www.w3.org/2002/07/owl#incompatibleWith"
  ]);

  const inferredClasses = new Set();

  // Populate inferred classes from explicit declarations
  for (const iri of Object.keys(subjects)) {
    const subject = subjects[iri];
    for (const type of subject.types) {
      if (
        type === NAMESPACES.OWL + "Class" ||
        type === NAMESPACES.RDFS + "Class" ||
        type === NAMESPACES.OWL + "DeprecatedClass"
      ) {
        inferredClasses.add(iri);
      }
    }
  }

  // Infers class status from usage relationships
  for (const iri of Object.keys(subjects)) {
    const subject = subjects[iri];
    if (subject.superClasses.length > 0) {
      inferredClasses.add(iri);
      subject.superClasses.forEach(sup => { if (sup && !isVowlId(sup)) inferredClasses.add(sup); });
    }
    if (subject.equivalentClasses.length > 0) {
      inferredClasses.add(iri);
      subject.equivalentClasses.forEach(eq => { if (eq && !isVowlId(eq)) inferredClasses.add(eq); });
    }
    if (subject.disjointWith.length > 0) {
      inferredClasses.add(iri);
      subject.disjointWith.forEach(dj => { if (dj && !isVowlId(dj)) inferredClasses.add(dj); });
    }
  }

  context.subclassRelations.forEach(rel => {
    if (rel.subclassIri) inferredClasses.add(rel.subclassIri);
    if (rel.superclassIri) inferredClasses.add(rel.superclassIri);
  });

  context.parsedRestrictions.forEach(rest => {
    if (rest.domainIri) inferredClasses.add(rest.domainIri);
    if (rest.rangeIri && !isDatatypeIri(rest.rangeIri)) {
      inferredClasses.add(rest.rangeIri);
    }
  });

  // Domains & Ranges inference
  for (const iri of Object.keys(subjects)) {
    const subject = subjects[iri];
    const types = Array.from(subject.types);
    const isProperty = types.some(t =>
      t === NAMESPACES.OWL + "ObjectProperty" ||
      t === NAMESPACES.OWL + "DatatypeProperty" ||
      t === NAMESPACES.OWL + "FunctionalProperty" ||
      t === NAMESPACES.OWL + "TransitiveProperty" ||
      t === NAMESPACES.OWL + "SymmetricProperty" ||
      t === NAMESPACES.RDF + "Property"
    );

    if (isProperty) {
      subject.domains.forEach(dom => { if (dom && !isVowlId(dom)) inferredClasses.add(dom); });
      const isDatatypeProp = types.some(t => t === NAMESPACES.OWL + "DatatypeProperty") ||
                             subject.ranges.some(isDatatypeIri);
      if (!isDatatypeProp) {
        subject.ranges.forEach(ran => {
          if (ran && !isDatatypeIri(ran) && !isVowlId(ran)) inferredClasses.add(ran);
        });
      }
    }
  }

  // Custom typing / Metaclass inference
  // Any custom URI used to instantiate an entity is categorised as a Class (signature/role inference)
  for (const iri of Object.keys(subjects)) {
    const subject = subjects[iri];
    subject.types.forEach(t => {
      if (
        t !== NAMESPACES.OWL + "NamedIndividual" &&
        t !== NAMESPACES.OWL + "Ontology" &&
        t !== NAMESPACES.OWL + "Class" &&
        t !== NAMESPACES.RDFS + "Class" &&
        t !== NAMESPACES.OWL + "DeprecatedClass" &&
        t !== NAMESPACES.OWL + "ObjectProperty" &&
        t !== NAMESPACES.OWL + "DatatypeProperty" &&
        t !== NAMESPACES.OWL + "AnnotationProperty" &&
        t !== NAMESPACES.RDF + "Property" &&
        t !== NAMESPACES.RDFS + "Datatype" &&
        !isDatatypeIri(t)
      ) {
        inferredClasses.add(t);
      }
    });
  }

  function ensureClassExists(iri, type = "owl:Class") {
    if (isDatatypeIri(iri)) {
      type = "rdfs:Datatype";
    }
    if (iri && context.classMap.has(iri)) {
      const cls = context.classMap.get(iri);
      if (type === "owl:unionOf" && cls.type === "owl:Class") {
        cls.type = "owl:unionOf";
      }
      if (type === "rdfs:Datatype" && cls.type === "owl:Class") {
        cls.type = "rdfs:Datatype";
        if (!cls.attributes.includes("datatype")) {
          cls.attributes.push("datatype");
        }
      }
      return cls;
    }
    const id = context.nextId();
    
    const isAnonymous = type === "owl:unionOf";
    const attributes = [];
    if (isAnonymous) attributes.push("anonymous");
    if (type === "rdfs:Datatype") attributes.push("datatype");

    const cls = {
      id: id,
      type: type === "owl:unionOf" ? "owl:unionOf" : type,
      iri: iri,
      baseIri: iri ? resolver.getBaseIri(iri) : null,
      label: iri ? { "undefined": resolver.getLocalName(iri) } : {},
      comment: {},
      attributes: attributes,
      subClasses: [],
      superClasses: [],
      individuals: []
    };
    if (iri) {
        context.classMap.set(iri, cls);
    } else {
        context.classMap.set(id, cls);
    }
    return cls;
  }

  function ensurePropertyExists(iri, type = "owl:objectProperty") {
    if (context.propertyMap.has(iri)) {
      return context.propertyMap.get(iri);
    }
    const id = context.nextId();
    const localName = resolver.getLocalName(iri);
    const baseIri = resolver.getBaseIri(iri);
    const attributes = [type === "owl:datatypeProperty" ? "datatype" : "object"];
    const prop = {
      id: id,
      type: type,
      iri: iri,
      baseIri: baseIri,
      label: { "undefined": localName },
      comment: {},
      attributes: attributes,
      domain: null,
      range: null,
      superproperty: [],
      subproperty: [],
      inverse: null
    };
    context.propertyMap.set(iri, prop);
    return prop;
  }

  // Pre-seed standard configurations
  ensureClassExists("http://www.w3.org/2002/07/owl#Thing", "owl:Thing");
  ensureClassExists("http://www.w3.org/2000/01/rdf-schema#Literal", "rdfs:Literal");

  // Identify main ontology header details
  let ontologySubject = null;
  for (const iri in subjects) {
    if (subjects[iri].types.has(NAMESPACES.OWL + "Ontology")) {
      ontologySubject = subjects[iri];
      break;
    }
  }

  // Sort dyn-constructed regional languages alphabetically, keeping 'undefined' at index 0 to match Java output
  const rawLanguages = Array.from(languagesSet).filter(l => l !== "undefined");
  rawLanguages.sort();
  const finalLanguages = [];
  if (languagesSet.has("undefined") || languagesSet.size === 0) {
    finalLanguages.push("undefined");
  }
  finalLanguages.push(...rawLanguages);

  const header = {
    languages: finalLanguages,
    baseIris: [],
    prefixList: prefixList,
    title: {},
    iri: ontologySubject ? ontologySubject.iri : "https://haddenindustries.com/ontology/newOntology/",
    version: "",
    author: [],
    description: {},
    labels: {},
    comments: {},
    other: {}
  };

  if (ontologySubject) {
    header.title = ontologySubject.labels;
    header.description = ontologySubject.comments;

    // Fill titles/descriptions from annotations if empty
    if (Object.keys(header.title).length === 0) {
      const titles = ontologySubject.annotations["title"] || ontologySubject.annotations["label"] || [];
      titles.forEach(t => {
        header.title[t.language || "undefined"] = t.value;
      });
    }
    if (Object.keys(header.description).length === 0) {
      const descs = ontologySubject.annotations["description"] || ontologySubject.annotations["comment"] || [];
      descs.forEach(d => {
        header.description[d.language || "undefined"] = d.value;
      });
    }

    const versions = ontologySubject.annotations["versionInfo"] || [];
    if (versions.length > 0) {
      header.version = versions[0].value;
    }

    const creators = ontologySubject.annotations["creator"] || [];
    creators.forEach(c => {
      header.author.push(c.value);
    });

    header.other = ontologySubject.annotations;
  } else {
    header.title = { "en": "Ontology" };
  }

  // Helper to determine if an IRI is external
  function isIriExternal(iri) {
    if (!iri) return false;
    if (iri === "http://www.w3.org/2000/01/rdf-schema#Literal" || iri === "http://www.w3.org/2002/07/owl#Thing") {
      return false;
    }
    
    // Ontologies have standard owl/rdf/rdfs namespaces as external
    if (iri.startsWith("http://www.w3.org/2002/07/owl#") || 
        iri.startsWith("http://www.w3.org/1999/02/22-rdf-syntax-ns#") || 
        iri.startsWith("http://www.w3.org/2000/01/rdf-schema#")) {
      return true;
    }
    let ontologyIriVal = header.iri;
    
    if (!ontologyIriVal) return false;
    
    function removeTrailingHash(str) {
      return str.replace(/[#]$/, "");
    }
    
    const trimmedElementIri = removeTrailingHash(iri);
    const trimmedOntologyIri = removeTrailingHash(ontologyIriVal);
    
    if (trimmedElementIri === trimmedOntologyIri) {
      return false;
    }
    
    if (trimmedElementIri.includes("#")) {
      const parts = trimmedElementIri.split("#");
      if (parts[0] === trimmedOntologyIri) {
        return false;
      }
    }
    
    if (trimmedElementIri.includes("/") && !trimmedElementIri.endsWith("/")) {
      const lastSlashIndex = trimmedElementIri.lastIndexOf("/");
      const indexAfterSlash = lastSlashIndex + 1;
      const elementNamespaceWithoutLastPart = trimmedElementIri.substring(0, indexAfterSlash);
      
      if (elementNamespaceWithoutLastPart === trimmedOntologyIri) {
        return false;
      }
    }
    
    return true;
  }

  // Map Subjects to Classes, Properties & Named Individuals
  for (const iri in subjects) {
    if (ignoredProperties.has(iri)) continue;

    const subject = subjects[iri];
    if (ontologySubject && iri === ontologySubject.iri) continue;

    const types = Array.from(subject.types);

    // Apply the signature inference check
    const isClass = inferredClasses.has(iri);
    const isDatatype = types.some(t => t === NAMESPACES.RDFS + "Datatype") || isDatatypeIri(iri);

    const isAnnotationProperty = types.some(t => t === NAMESPACES.OWL + "AnnotationProperty");
    const isProperty = !isAnnotationProperty && types.some(t =>
      t === NAMESPACES.OWL + "ObjectProperty" ||
      t === NAMESPACES.OWL + "DatatypeProperty" ||
      t === NAMESPACES.OWL + "FunctionalProperty" ||
      t === NAMESPACES.OWL + "TransitiveProperty" ||
      t === NAMESPACES.OWL + "SymmetricProperty" ||
      t === NAMESPACES.RDF + "Property"
    );

    const isExplicitNamedIndividual = types.some(t => t === NAMESPACES.OWL + "NamedIndividual");
    const isIndividual = !isClass && !isDatatype && !isProperty && (
      isExplicitNamedIndividual ||
      types.some(t => inferredClasses.has(t) || t === NAMESPACES.OWL + "Thing")
    );

    if (isClass && !isDatatype) {
      const cls = ensureClassExists(iri, "owl:Class");
      
      // Mirror the Java exporter's precise label priority logic:
      // If annotation properties (rdfs:label) are available, output only those.
      // Else, fall back safely to undefined: localName.
      if (Object.keys(subject.labels).length > 0) {
        cls.label = Object.assign({}, subject.labels);
        if (!cls.label["undefined"]) {
          cls.label["undefined"] = resolver.getLocalName(iri);
        }
      } else {
        cls.label = { "undefined": resolver.getLocalName(iri) };
      }
      cls.comment = subject.comments;
      cls.annotations = subject.annotations;
      cls.disjointWith = subject.disjointWith;

      if (types.some(t => t === NAMESPACES.OWL + "DeprecatedClass")) {
        if (!cls.attributes.includes("deprecated")) cls.attributes.push("deprecated");
      }

      subject.superClasses.forEach(superIri => {
        context.subclassRelations.push({ subclassIri: iri, superclassIri: superIri });
      });
    } else if (isDatatype) {
      const cls = ensureClassExists(iri, "rdfs:Datatype");
      if (!cls.attributes.includes("datatype")) cls.attributes.push("datatype");
      if (Object.keys(subject.labels).length > 0) {
        cls.label = Object.assign({}, subject.labels);
        if (!cls.label["undefined"]) {
          cls.label["undefined"] = resolver.getLocalName(iri);
        }
      } else {
        cls.label = { "undefined": resolver.getLocalName(iri) };
      }
      cls.comment = subject.comments;
      cls.annotations = subject.annotations;
    } else if (isProperty) {
      let type = "owl:objectProperty";
      const attributes = ["object"];

      // If typed explicitly as DatatypeProperty or its range matches a built-in datatype, make it a datatypeProperty
      const isDTP = types.some(t => t === NAMESPACES.OWL + "DatatypeProperty") || 
                    (subject.ranges && subject.ranges.some(isDatatypeIri));
      if (isDTP) {
        type = "owl:datatypeProperty";
        attributes[0] = "datatype";
      }

      if (types.some(t => t === NAMESPACES.OWL + "FunctionalProperty")) attributes.push("functional");
      if (types.some(t => t === NAMESPACES.OWL + "TransitiveProperty")) attributes.push("transitive");
      if (types.some(t => t === NAMESPACES.OWL + "SymmetricProperty")) attributes.push("symmetric");
      
      const propLabel = Object.keys(subject.labels).length > 0 ? Object.assign({}, subject.labels) : { "undefined": resolver.getLocalName(iri) };
      if (!propLabel["undefined"]) {
        propLabel["undefined"] = resolver.getLocalName(iri);
      }

      const prop = {
        id: context.nextId(),
        type: type,
        iri: iri,
        baseIri: resolver.getBaseIri(iri),
        label: propLabel,
        comment: subject.comments,
        attributes: attributes,
        domain: subject.domains[0] || null,
        range: subject.ranges[0] || null,
        superproperty: [],
        subproperty: [],
        inverse: subject.inverses[0] || null,
        annotations: subject.annotations
      };

      subject.superProperties.forEach(superIri => {
        context.subpropertyRelations.push({ subpropIri: iri, superpropIri: superIri });
      });

      context.propertyMap.set(iri, prop);
    } else if (isIndividual) {
      const individualIri = iri;
      const localName = resolver.getLocalName(individualIri);

      let finalLabels = {};
      if (Object.keys(subject.labels).length > 0) {
        finalLabels = Object.assign({}, subject.labels);
        if (!finalLabels["undefined"]) {
          finalLabels["undefined"] = localName;
        }
      } else {
        finalLabels = { "undefined": localName };
      }

      // Mirror the Java implementation's schema structures: named individuals
      // inside arrays in VOWL-JSON are mapped to the plural "labels" and "comments" fields.
      const indObj = {
        iri: individualIri,
        baseIri: resolver.getBaseIri(individualIri),
        labels: finalLabels,
        comments: subject.comments || {}
      };
      if (subject.annotations && Object.keys(subject.annotations).length > 0) {
        indObj.annotations = subject.annotations;
      }

      // Collect all matched class types this individual instantiates
      let classIris = types.filter(t => 
        t !== NAMESPACES.OWL + "NamedIndividual" && 
        (inferredClasses.has(t) || t === NAMESPACES.OWL + "Thing")
      );

      // Default to owl:Thing if no specific custom classes are defined on the individual
      if (classIris.length === 0) {
        classIris.push("http://www.w3.org/2002/07/owl#Thing");
      }

      context.parsedIndividuals.push({
        individual: indObj,
        classIris: classIris
      });
    }
  }

  function isVowlId(str) {
    if (typeof str !== "string") return false;
    return /^\d+$/.test(str);
  }

  function getClassId(ref) {
    if (isVowlId(ref)) return ref;
    let cls = context.classMap.get(ref);
    if (!cls) cls = context.classMap.get("http://www.w3.org/2002/07/owl#Thing");
    return cls ? cls.id : "0";
  }

  function createVirtualDatatype(datatypeIri) {
    const cls = context.classMap.get(datatypeIri);
    const virtualId = context.nextId();
    const label = cls && cls.label ? JSON.parse(JSON.stringify(cls.label)) : { "undefined": resolver.getLocalName(datatypeIri) };
    if (!label["undefined"]) {
      label["undefined"] = resolver.getLocalName(datatypeIri);
    }
    const virtualCls = {
      id: virtualId,
      type: datatypeIri === "http://www.w3.org/2000/01/rdf-schema#Literal" ? "rdfs:Literal" : "rdfs:Datatype",
      iri: datatypeIri,
      baseIri: datatypeIri === "http://www.w3.org/2000/01/rdf-schema#Literal" ? undefined : (cls ? cls.baseIri : resolver.getBaseIri(datatypeIri)),
      label: label,
      comment: cls && cls.comment ? JSON.parse(JSON.stringify(cls.comment)) : {},
      attributes: datatypeIri === "http://www.w3.org/2000/01/rdf-schema#Literal" ? [] : ["datatype"],
      subClasses: [],
      superClasses: [],
      annotations: cls && cls.annotations ? cls.annotations : {}
    };
    context.virtualDatatypes.push(virtualCls);
    return virtualId;
  }

  // Step 0: Ensure restriction properties exist in propertyMap
  context.parsedRestrictions.forEach(rest => {
    if (rest.propertyIri) {
      ensurePropertyExists(rest.propertyIri);
    }
  });

  // Step 1: Ensure structural reference maps exist
  context.subclassRelations.forEach(rel => {
    ensureClassExists(rel.subclassIri);
    ensureClassExists(rel.superclassIri);
  });

  context.parsedRestrictions.forEach(rest => {
    ensureClassExists(rest.domainIri);
    ensureClassExists(rest.rangeIri);
  });

  for (const iri of Object.keys(subjects)) {
    const subject = subjects[iri];
    subject.equivalentClasses.forEach(equivIri => {
      ensureClassExists(equivIri);
    });
  }

  // Ensure target classes specified on parsed individuals exist in the graph
  context.parsedIndividuals.forEach(item => {
    item.classIris.forEach(clsIri => {
      ensureClassExists(clsIri);
    });
  });

  context.propertyMap.forEach(prop => {
    if (prop.domain && typeof prop.domain === "string" && !isVowlId(prop.domain)) {
      ensureClassExists(prop.domain);
    }
    if (prop.range && typeof prop.range === "string" && !isVowlId(prop.range)) {
      // Force datatypes of owl:datatypeProperty into RDFS Datatypes
      if (prop.type === "owl:datatypeProperty") {
        ensureClassExists(prop.range, "rdfs:Datatype");
      } else {
        ensureClassExists(prop.range);
      }
    }
  });

  // Ensure all union members exist in classMap
  context.classMap.forEach(cls => {
    if (cls.unionMembers) {
      cls.unionMembers.forEach(memberIri => {
        ensureClassExists(memberIri);
      });
    }
  });

  // Map parsed individuals to their corresponding class instances arrays
  context.parsedIndividuals.forEach(item => {
    item.classIris.forEach(clsIri => {
      const cls = context.classMap.get(clsIri);
      if (cls) {
        if (!cls.individuals) cls.individuals = [];
        if (!cls.individuals.some(ind => ind.iri === item.individual.iri)) {
          cls.individuals.push(item.individual);
        }
      }
    });
  });

  // Step 2: Ensure subproperties exist in mapping
  context.subpropertyRelations.forEach(rel => {
    if (rel.superpropIri && ignoredProperties.has(rel.superpropIri)) return;
    if (rel.subpropIri) ensurePropertyExists(rel.subpropIri);
    if (rel.superpropIri) ensurePropertyExists(rel.superpropIri);
  });

  // Gather and create inverse properties in a safe separate list first
  const inversesToCreate = [];
  context.propertyMap.forEach(prop => {
    if (prop.inverse && typeof prop.inverse === "string" && !isVowlId(prop.inverse)) {
      inversesToCreate.push(prop.inverse);
    }
  });
  inversesToCreate.forEach(invIri => {
    ensurePropertyExists(invIri);
  });

  // Step 3: Resolve domains, ranges & inverses to numeric IDs
  context.propertyMap.forEach(prop => {
    if (prop.domain && typeof prop.domain === "string" && !isVowlId(prop.domain)) {
      prop.domain = getClassId(prop.domain, "http://www.w3.org/2002/07/owl#Thing");
    } else if (!prop.domain) {
      prop.domain = getClassId("http://www.w3.org/2002/07/owl#Thing");
    }

    if (prop.range && typeof prop.range === "string" && !isVowlId(prop.range)) {
      const cls = context.classMap.get(prop.range);
      if (isDatatypeIri(prop.range) || (cls && cls.type === "rdfs:Datatype") || prop.range === "http://www.w3.org/2000/01/rdf-schema#Literal") {
        prop.range = createVirtualDatatype(prop.range);
      } else {
        prop.range = getClassId(prop.range, "http://www.w3.org/2002/07/owl#Thing");
      }
    } else if (!prop.range) {
      if (prop.type === "owl:datatypeProperty") {
        prop.range = createVirtualDatatype("http://www.w3.org/2000/01/rdf-schema#Literal");
      } else {
        prop.range = getClassId("http://www.w3.org/2002/07/owl#Thing");
      }
    }

    if (prop.inverse && typeof prop.inverse === "string" && !isVowlId(prop.inverse)) {
      const invProp = context.propertyMap.get(prop.inverse);
      if (invProp) {
        prop.inverse = invProp.id;
        invProp.inverse = prop.id;
      } else {
        prop.inverse = null;
      }
    }
  });

  // Resolve union members to IDs
  context.classMap.forEach(cls => {
    if (cls.unionMembers) {
      cls.union = cls.unionMembers.map(memberIri => {
        const memberCls = context.classMap.get(memberIri);
        return memberCls ? memberCls.id : null;
      }).filter(id => id !== null);
      delete cls.unionMembers;
    }
  });

  // Resolve equivalence to IDs
  context.classMap.forEach(cls => {
    const subject = subjects[cls.iri];
    if (subject && subject.equivalentClasses && subject.equivalentClasses.length > 0) {
      cls.equivalent = [];
      if (!cls.attributes.includes("equivalent")) {
        cls.attributes.push("equivalent");
      }
      subject.equivalentClasses.forEach(equivIri => {
        const equivCls = context.classMap.get(equivIri);
        if (equivCls) {
          cls.equivalent.push(equivCls.id);
          if (!equivCls.attributes.includes("equivalent")) {
            equivCls.attributes.push("equivalent");
          }
        }
      });
    }
  });

  // Step 4: Map Subclass Properties
  const subclassProperties = [];
  context.subclassRelations.forEach(rel => {
    if (rel.superclassIri === "http://www.w3.org/2002/07/owl#Thing") return;
    const subCls = context.classMap.get(rel.subclassIri);
    const superCls = context.classMap.get(rel.superclassIri);
    
    if (subCls && superCls) {
      if (!subCls.superClasses.includes(superCls.id)) {
        subCls.superClasses.push(superCls.id);
      }
      if (!superCls.subClasses.includes(subCls.id)) {
        superCls.subClasses.push(subCls.id);
      }

      const propId = context.nextId();
      subclassProperties.push({
        property: { id: propId, type: "rdfs:SubClassOf" },
        attribute: {
          id: propId,
          iri: "http://www.w3.org/2000/01/rdf-schema#subClassOf",
          baseIri: "http://www.w3.org/2000/01/rdf-schema",
          domain: subCls.id,
          range: superCls.id,
          attributes: ["transitive"]
        }
      });
    }
  });

  // Step 5: Resolve subproperties
  context.subpropertyRelations.forEach(rel => {
    if (rel.superpropIri && ignoredProperties.has(rel.superpropIri)) return;
    const subProp = context.propertyMap.get(rel.subpropIri);
    const superProp = context.propertyMap.get(rel.superpropIri);
    if (subProp && superProp) {
      subProp.superproperty.push(superProp.id);
      superProp.subproperty.push(subProp.id);
    }
  });

  // Resolve VOWL restriction edges
  const restrictionProperties = [];
  context.parsedRestrictions.forEach(rest => {
    const subCls = context.classMap.get(rest.domainIri);
    const superCls = context.classMap.get(rest.rangeIri);
    
    if (subCls && superCls) {
      let refProp = context.propertyMap.get(rest.propertyIri);
      if (!refProp) {
        refProp = ensurePropertyExists(rest.propertyIri);
      }
      
      const propId = context.nextId();
      const attributes = ["object"];
      if (rest.type === "owl:someValuesFrom" || rest.type === "owl:hasValue") {
        attributes.push("someValuesFrom");
      } else if (rest.type === "owl:allValuesFrom") {
        attributes.push("allValuesFrom");
      }
      
      if (refProp && refProp.attributes) {
        refProp.attributes.forEach(attr => {
          if (!attributes.includes(attr)) attributes.push(attr);
        });
      }

      // Safe parameter defaults to avoid 'undefined' lookup exceptions on incomplete properties
      const refPropIri = refProp ? refProp.iri : rest.propertyIri;
      const refPropBaseIri = refProp ? refProp.baseIri : resolver.getBaseIri(rest.propertyIri);
      const refPropLabel = refProp && refProp.label ? refProp.label : { "undefined": resolver.getLocalName(rest.propertyIri) };
      
      // Virtualise restriction range if it is a datatype (individual nodes per reference, matching Java behaviour)
      let resolvedRangeId = superCls.id;
      if (superCls.type === "rdfs:Datatype" || superCls.type === "rdfs:Literal" || rest.rangeIri === "http://www.w3.org/2000/01/rdf-schema#Literal") {
        resolvedRangeId = createVirtualDatatype(rest.rangeIri);
      }

      const restProp = {
        property: { id: propId, type: rest.type === "owl:hasValue" ? "owl:someValuesFrom" : rest.type },
        attribute: {
          id: propId,
          iri: refPropIri,
          baseIri: refPropBaseIri,
          label: Object.assign({}, refPropLabel),
          domain: subCls.id,
          range: resolvedRangeId,
          attributes: attributes
        }
      };
      
      if (refProp && refProp.comment && Object.keys(refProp.comment).length > 0) restProp.attribute.comment = refProp.comment;
      if (refProp && refProp.annotations && Object.keys(refProp.annotations).length > 0) restProp.attribute.annotations = refProp.annotations;
      
      restrictionProperties.push(restProp);
    }
  });

  // Resolve cardinalities onto VOWL properties
  context.parsedCardinalities.forEach(card => {
    const prop = context.propertyMap.get(card.propertyIri);
    if (prop) {
      if (card.minCardinality !== null) prop.minCardinality = card.minCardinality;
      if (card.maxCardinality !== null) prop.maxCardinality = card.maxCardinality;
      if (card.cardinality !== null) prop.cardinality = card.cardinality;
    }
  });

  // Mark external elements based on target absolute namespace
  context.classMap.forEach(cls => {
    const isAnon = cls.type === "owl:unionOf";
    if (!isAnon && isIriExternal(cls.iri)) {
      if (!cls.attributes.includes("external")) cls.attributes.push("external");
    }
  });

  context.propertyMap.forEach(prop => {
    if (isIriExternal(prop.iri)) {
      if (!prop.attributes.includes("external")) {
        prop.attributes.push("external");
      }
    }
  });

  // Identify connected datatype nodes to skip duplicate floating datatypes
  const connectedNodeIds = new Set();
  context.propertyMap.forEach(prop => {
    if (prop.domain) connectedNodeIds.add(String(prop.domain));
    if (prop.range) connectedNodeIds.add(String(prop.range));
  });
  subclassProperties.forEach(subProp => {
    if (subProp.attribute.domain) connectedNodeIds.add(String(subProp.attribute.domain));
    if (subProp.attribute.range) connectedNodeIds.add(String(subProp.attribute.range));
  });
  restrictionProperties.forEach(rp => {
    if (rp.attribute.domain) connectedNodeIds.add(String(rp.attribute.domain));
    if (rp.attribute.range) connectedNodeIds.add(String(rp.attribute.range));
  });
  context.classMap.forEach(cls => {
    if (cls.disjointWith && cls.disjointWith.length > 0) {
      cls.disjointWith.forEach(targetIri => {
        const targetCls = context.classMap.get(targetIri);
        if (targetCls) {
          connectedNodeIds.add(String(cls.id));
          connectedNodeIds.add(String(targetCls.id));
        }
      });
    }
  });

  const connectedDatatypeIris = new Set();
  context.classMap.forEach(cls => {
    if (cls.type === "rdfs:Datatype" && connectedNodeIds.has(String(cls.id))) {
      if (cls.iri) connectedDatatypeIris.add(cls.iri);
    }
  });
  context.virtualDatatypes.forEach(cls => {
    if (connectedNodeIds.has(String(cls.id))) {
      if (cls.iri) connectedDatatypeIris.add(cls.iri);
    }
  });

  function shouldSkipDatatype(cls) {
    if (cls.iri === "http://www.w3.org/2000/01/rdf-schema#Literal" && !connectedNodeIds.has(String(cls.id))) {
      return true;
    }
    if (cls.type !== "rdfs:Datatype" && cls.type !== "rdfs:Literal") return false;
    if (connectedNodeIds.has(String(cls.id))) return false;
    if (cls.iri && connectedDatatypeIris.has(cls.iri)) {
      return true;
    }
    return false;
  }

  // Build JSON outputs
  const classesArray = [];
  const classAttributesArray = [];
  const disjointProperties = [];

  context.classMap.forEach(cls => {
    if (shouldSkipDatatype(cls)) return;
    classesArray.push({ id: cls.id, type: cls.type });
    const isAnonymous = cls.type === "owl:unionOf";
    const attr = { id: cls.id };

    if (!isAnonymous) {
      attr.iri = cls.iri;
      attr.baseIri = cls.baseIri;
      attr.instances = cls.individuals ? cls.individuals.length : 0;
      attr.label = cls.label;
      if (cls.annotations && Object.keys(cls.annotations).length > 0) {
        attr.annotations = cls.annotations;
      }
      if (Object.keys(cls.comment).length > 0) attr.comment = cls.comment;
      if (cls.individuals && cls.individuals.length > 0) {
        attr.individuals = cls.individuals;
      }
    }
    // Anonymous classes (like owl:unionOf) do not get a label attribute in the VOWL-JSON, aligning perfectly with the original Java converter.
    
    if (cls.attributes.length > 0) attr.attributes = cls.attributes;
    if (cls.subClasses.length > 0) attr.subClasses = cls.subClasses;
    if (cls.superClasses.length > 0) attr.superClasses = cls.superClasses;
    if (cls.union) attr.union = cls.union;
    if (cls.equivalent && cls.equivalent.length > 0) attr.equivalent = cls.equivalent;
    classAttributesArray.push(attr);

    // Create disjointWith virtual property edges
    if (cls.disjointWith && cls.disjointWith.length > 0) {
      cls.disjointWith.forEach(targetIri => {
        const targetCls = context.classMap.get(targetIri);
        if (targetCls) {
          const propId = context.nextId();
          disjointProperties.push({
            property: { id: propId, type: "owl:disjointWith" },
            propertyAttribute: {
              id: propId,
              domain: cls.id,
              range: targetCls.id,
              attributes: ["object", "anonymous"]
            }
          });
        }
      });
    }
  });

  // Map virtualised datatypes into serialisation array
  context.virtualDatatypes.forEach(cls => {
    if (shouldSkipDatatype(cls)) return;
    if (isIriExternal(cls.iri) && !cls.attributes.includes("external")) {
      cls.attributes.push("external");
    }
    classesArray.push({ id: cls.id, type: cls.type });
    const attr = {
      id: cls.id,
      iri: cls.iri,
      baseIri: cls.baseIri,
      label: cls.label || { "undefined": "Datatype" },
      attributes: cls.attributes
    };
    if (cls.annotations && Object.keys(cls.annotations).length > 0) {
      attr.annotations = cls.annotations;
    }
    if (cls.comment && Object.keys(cls.comment).length > 0) {
      attr.comment = cls.comment;
    }
    classAttributesArray.push(attr);
  });

  const propertiesArray = [];
  const propertyAttributesArray = [];

  context.propertyMap.forEach(prop => {
    propertiesArray.push({ id: prop.id, type: prop.type });
    const attr = {
      id: prop.id,
      iri: prop.iri,
      baseIri: prop.baseIri,
      label: prop.label || { "undefined": "Property" },
      domain: prop.domain,
      range: prop.range,
      attributes: prop.attributes
    };
    if (Object.keys(prop.comment).length > 0) attr.comment = prop.comment;
    if (prop.annotations && Object.keys(prop.annotations).length > 0) attr.annotations = prop.annotations;
    if (prop.superproperty.length > 0) attr.superproperty = prop.superproperty;
    if (prop.subproperty.length > 0) attr.subproperty = prop.subproperty;
    if (prop.inverse) attr.inverse = prop.inverse;
    if (prop.minCardinality !== undefined) attr.minCardinality = prop.minCardinality;
    if (prop.maxCardinality !== undefined) attr.maxCardinality = prop.maxCardinality;
    if (prop.cardinality !== undefined) attr.cardinality = prop.cardinality;
    propertyAttributesArray.push(attr);
  });

  subclassProperties.forEach(subProp => {
    propertiesArray.push(subProp.property);
    propertyAttributesArray.push(subProp.attribute);
  });

  disjointProperties.forEach(dp => {
    propertiesArray.push(dp.property);
    propertyAttributesArray.push(dp.propertyAttribute);
  });

  restrictionProperties.forEach(rp => {
    propertiesArray.push(rp.property);
    propertyAttributesArray.push(rp.attribute);
  });

  const metrics = {
    classCount: 0,
    datatypeCount: 0,
    objectPropertyCount: 0,
    datatypePropertyCount: 0,
    propertyCount: propertiesArray.length,
    nodeCount: classesArray.length,
    individualCount: 0
  };

  classesArray.forEach(c => {
    if (c.type === "owl:Class") metrics.classCount++;
    if (c.type === "rdfs:Datatype") metrics.datatypeCount++;
  });

  propertiesArray.forEach(p => {
    if (p.type === "owl:objectProperty" || p.type === "owl:someValuesFrom" || p.type === "owl:allValuesFrom" || p.type === "owl:hasValue") metrics.objectPropertyCount++;
    if (p.type === "owl:datatypeProperty") metrics.datatypePropertyCount++;
  });

  // Calculate individuals
  let totalIndividualCount = 0;
  context.classMap.forEach(cls => {
    if (cls.individuals) {
      totalIndividualCount += cls.individuals.length;
    }
  });
  metrics.individualCount = totalIndividualCount;
  
  // Implementation of baseIris dynamic extraction
  const usedNamespaces = new Set();
  
  // 1. Add all defined class/property/datatype IRIs
  context.classMap.forEach(c => { if (c.iri) usedNamespaces.add(resolver.getBaseIri(c.iri)); });
  context.propertyMap.forEach(p => { if (p.iri) usedNamespaces.add(resolver.getBaseIri(p.iri)); });
  
  // 2. Filter, clean, and sort
  const reserved = ["http://www.w3.org/2002/07/owl", "http://www.w3.org/1999/02/22-rdf-syntax-ns", "http://www.w3.org/2000/01/rdf-schema", "http://www.w3.org/2001/XMLSchema"];
  usedNamespaces.forEach(ns => {
      if (ns && !reserved.includes(ns)) header.baseIris.push(ns);
  });
  
  header.baseIris.sort();

  return {
    _comment: "Created with client-side JS-OWL2VOWL parser",
    header: header,
    namespace: [],
    metrics: metrics,
    class: classesArray,
    classAttribute: classAttributesArray,
    property: propertiesArray,
    propertyAttribute: propertyAttributesArray
  };
};

const ONTOLOGY_CATALOG = {
  "http://purl.org/dc/elements/1.1": "../external/dc.rdf",
  "http://purl.org/dc/terms": "../external/dcterms.rdf",
  "http://purl.org/goodrelations/v1": "../external/goodrelations.owl",
  "http://purl.org/linked-data/cube": "../external/cube.rdf",
  "http://purl.org/ontology/bibo": "../external/bibo.rdf.xml",
  "http://purl.org/vocab/vann": "../external/vann-vocab-20100607.rdf",
  "http://rdfs.org/ns/void": "../external/void.ttl",
  "http://rdfs.org/sioc/ns": "../external/sioc.rdf",
  "http://schema.org": "../external/schemaorg.owl",
  "http://usefulinc.com/ns/doap": "../external/doap.rdf",
  "http://www.w3.org/2003/01/geo/wgs84_pos": "../external/wgs84_pos.rdf",
  "http://www.w3.org/2004/02/skos/core": "../external/skos.rdf",
  "http://www.w3.org/2006/time": "../external/time.rdf",
  "http://www.w3.org/ns/dcat": "../external/dcat3.rdf",
  "http://www.w3.org/ns/org": "../external/org.rdf",
  "http://www.w3.org/ns/prov": "../external/prov.owl",
  "http://www.w3.org/ns/sosa": "../external/sosa.ttl",
  "http://www.w3.org/ns/ssn": "../external/ssn.ttl",
  "http://www.w3.org/ns/time/gregorian": "../external/time-gregorian.rdf",
  "http://xmlns.com/foaf/0.1": "../external/foaf.rdf",
  "https://schema.org": "../external/schemaorg.owl"
};

/**
 * Resolves logical ontology import IRIs to dereferenceable physical URLs
 * using the OASIS catalog registries.
 */
function resolveImportUrl(importUri) {
  if (!importUri) return importUri;
  
  // Normalize lookup keys by trimming trailing separators
  const normalizedUri = importUri.replace(/[#/]$/, "");
  
  // 1. Precise match
  if (ONTOLOGY_CATALOG[importUri]) {
    return ONTOLOGY_CATALOG[importUri];
  }
  
  // 2. Normalized prefix/key match
  for (const [key, val] of Object.entries(ONTOLOGY_CATALOG)) {
    if (key.replace(/[#/]$/, "") === normalizedUri) {
      return val;
    }
  }
  
  return importUri;
}

module.exports.loadWithImports = function (initialXmlText) {
  let parsedInitialText = initialXmlText;
  if (turtleParser.isTurtleFormat(initialXmlText)) {
    try {
      const tokens = turtleParser.tokenizeTurtle(initialXmlText);
      const parsed = turtleParser.parseTurtleTokens(tokens);
      parsedInitialText = turtleParser.serializeTriplesToRdfXml(parsed.triples, parsed.prefixes, parsed.baseIri);
    } catch (parseErr) {
      return Promise.reject(new Error("Turtle parsing error: " + parseErr.message));
    }
  }

  const parser = new DOMParser();
  let mainDoc;
  try {
    mainDoc = parser.parseFromString(parsedInitialText, "application/xml");
  } catch (e) {
    return Promise.reject(e);
  }

  const parserError = mainDoc.getElementsByTagName("parsererror")[0];
  if (parserError) {
    return Promise.reject(new Error("XML parsing error: " + parserError.textContent));
  }

  const rootEl = mainDoc.documentElement;
  if (!rootEl) {
    return Promise.reject(new Error("Invalid XML document"));
  }

  const loadedUrls = new Set();
  
  function getAttr(el, name, ns) {
    if (ns) {
      const val = el.getAttributeNS(ns, name);
      if (val !== null && val !== "") return val;
    }
    return el.getAttribute(name) || el.getAttribute("rdf:" + name) || el.getAttribute("owl:" + name);
  }

  function getImports(doc) {
    const imports = [];
    const elements = doc.getElementsByTagNameNS ? doc.getElementsByTagNameNS("*", "imports") : doc.getElementsByTagName("owl:imports");
    for (let i = 0; i < elements.length; i++) {
      const res = getAttr(elements[i], "resource", NAMESPACES.RDF);
      if (res) {
        imports.push(res);
      }
    }
    return imports;
  }

  // Identify main ontology IRI to avoid self-imports
  let mainOntologyIri = "";
  const ontologyEl = (mainDoc.getElementsByTagNameNS ? mainDoc.getElementsByTagNameNS("*", "Ontology") : mainDoc.getElementsByTagName("owl:Ontology"))[0];
  if (ontologyEl) {
    mainOntologyIri = getAttr(ontologyEl, "about", NAMESPACES.RDF) || "";
    if (mainOntologyIri) loadedUrls.add(mainOntologyIri);
  }
  const baseAttr = rootEl.getAttribute("xml:base") || rootEl.getAttribute("base") || "";
  if (baseAttr) loadedUrls.add(baseAttr);

  function fetchAndMerge(doc) {
    const imports = getImports(doc);
    const promises = [];
    
    for (const url of imports) {
      if (loadedUrls.has(url)) continue;
      loadedUrls.add(url);
      
      let resolvedUrl = resolveImportUrl(url);
      const isHttpsPage = typeof window !== "undefined" && window.location && window.location.protocol === "https:";
      let wasUpgraded = false;
      if (isHttpsPage && resolvedUrl.indexOf("http://") === 0) {
        resolvedUrl = "https://" + resolvedUrl.substring(7);
        wasUpgraded = true;
      }

      const menu = (typeof window !== "undefined" && window.WebVOWL && window.WebVOWL.ontologyMenu) ? window.WebVOWL.ontologyMenu : null;
      if (menu && menu.append_bulletPoint) {
        if (wasUpgraded) {
          menu.append_bulletPoint(`Importing external ontology: ${url} (auto-upgraded HTTPS fetching: ${resolvedUrl}) ...`);
        } else {
          menu.append_bulletPoint(`Importing external ontology: ${url} (fetching: ${resolvedUrl}) ...`);
        }
      }
      
      promises.push(
        fetch(resolvedUrl, {
          headers: {
            'Accept': 'application/rdf+xml, application/xml, text/xml, application/owl+xml, */*'
          }
        })
          .then(response => {
            if (!response.ok) {
              throw new Error(`HTTP Error ${response.status}: ${response.statusText}`);
            }
            return response.text();
          })
          .then(xmlText => {
            let parsedXmlText = xmlText;
            if (turtleParser.isTurtleFormat(xmlText)) {
              try {
                const tokens = turtleParser.tokenizeTurtle(xmlText);
                const parsed = turtleParser.parseTurtleTokens(tokens);
                parsedXmlText = turtleParser.serializeTriplesToRdfXml(parsed.triples, parsed.prefixes, parsed.baseIri);
              } catch (parseErr) {
                throw new Error(`Turtle parsing error inside imported ontology "${resolvedUrl}": ${parseErr.message}`);
              }
            }
            const importedDoc = parser.parseFromString(parsedXmlText, "application/xml");
            const parserError = importedDoc.getElementsByTagName("parsererror")[0];
            if (parserError) {
              throw new Error(`XML/Turtle parsing error inside imported ontology "${resolvedUrl}": ${parserError.textContent}`);
            }
            const importedRoot = importedDoc.documentElement;
            if (!importedRoot) {
              throw new Error(`The imported ontology "${resolvedUrl}" does not possess a valid root XML element.`);
            }
            
            // Merge namespace attributes
            if (importedRoot.attributes) {
              for (let i = 0; i < importedRoot.attributes.length; i++) {
                const attr = importedRoot.attributes[i];
                if (attr.name.startsWith("xmlns:") && !rootEl.hasAttribute(attr.name)) {
                  rootEl.setAttribute(attr.name, attr.value);
                }
              }
            }
            
            // Merge children, preserving original local base URI context (e.g. rdf:ID relative resolving)
            const importedBase = importedRoot.getAttribute("xml:base") || importedRoot.getAttribute("base") || resolvedUrl;
            const children = importedRoot.childNodes;
            for (let i = 0; i < children.length; i++) {
              const child = children[i];
              if (child.nodeType === 1) {
                if (child.localName === "Ontology") {
                  continue;
                }
                const importedNode = mainDoc.importNode(child, true);
                if (importedBase && !importedNode.hasAttribute("xml:base")) {
                  importedNode.setAttribute("xml:base", importedBase);
                }
                rootEl.appendChild(importedNode);
              }
            }
            
            if (menu && menu.append_message_toLastBulletPoint) {
              menu.append_message_toLastBulletPoint("done");
            }
            
            // Transitively resolve any nested imports declared in the merged file
            return fetchAndMerge(importedDoc);
          })
          .catch(err => {
            if (err.message.indexOf("HTTP Error") === 0 || 
                err.message.indexOf("XML parsing error") === 0 || 
                err.message.indexOf("The imported ontology") === 0) {
              if (menu && menu.append_message_toLastBulletPoint) {
                menu.append_message_toLastBulletPoint("<span style='color:red;'>failed</span>");
              }
              throw err;
            }

            const isOffline = typeof navigator !== 'undefined' && navigator.onLine === false;

            let checkPromise;
            if (isOffline) {
              checkPromise = Promise.resolve("Network Connection Failure: Your browser reports that it is offline.");
            } else if (typeof fetch !== 'undefined') {
              checkPromise = fetch(resolvedUrl, { mode: 'no-cors' })
                .then(function () {
                  let corsMsg = "CORS Restriction: The remote server is online but blocks access from this origin.\n" +
                         "The server hosting '" + resolvedUrl + "' does not return the required 'Access-Control-Allow-Origin' header.\n" +
                         "To fix: Configure CORS headers on the host server, or register a local mapping: owl2vowl.catalog[\"" + url + "\"] = \"local_path\";";
                  if (wasUpgraded) {
                    corsMsg += "\nNote: The request was automatically upgraded to HTTPS ('" + resolvedUrl + "') to prevent secure context (Mixed Content) blocking, but the secure request failed with CORS.";
                  }
                  return corsMsg;
                })
                .catch(function () {
                  let unreachableMsg = "Host Unreachable / Network Error: Could not connect to the remote host at '" + resolvedUrl + "'.\n" +
                         "Please verify that the host domain is correct, the remote server is online, and there are no active firewall blocks.";
                  if (wasUpgraded) {
                    unreachableMsg += "\nNote: The request was automatically upgraded to HTTPS ('" + resolvedUrl + "') to prevent secure context (Mixed Content) blocking, but the secure host was unreachable.";
                  }
                  return unreachableMsg;
                });
            } else {
              checkPromise = Promise.resolve("Network Connection Failure / Fetch Error: " + err.message);
            }

            return checkPromise.then(function (diagnosticMsg) {
              const fullMsg = `Failed to load transitive import: "${url}" (fetching: "${resolvedUrl}").\n` + diagnosticMsg;
              if (menu && menu.append_message_toLastBulletPoint) {
                menu.append_message_toLastBulletPoint("<span style='color:red;'>failed</span>");
              }
              throw new Error(fullMsg);
            });
          })
      );
    }
    
    return Promise.all(promises).then(() => doc);
  }

  return fetchAndMerge(mainDoc).then(finalDoc => {
    const mergedXml = new XMLSerializer().serializeToString(finalDoc);
    return module.exports(mergedXml);
  });
};

// Export the catalog globally so client apps can register mappings dynamically
module.exports.catalog = ONTOLOGY_CATALOG;
