// Client-side OWL2VOWL converter in JavaScript
// Optimized for performance, modular maintainability, and clean separation of concerns.

const NAMESPACES = Object.freeze({
  RDF: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
  RDFS: "http://www.w3.org/2000/01/rdf-schema#",
  OWL: "http://www.w3.org/2002/07/owl#",
  DC: "http://purl.org/dc/elements/1.1/",
  DCTERMS: "http://purl.org/dc/terms/"
});

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
  resolve(iri) {
    if (!iri) return this.ontologyBaseIri;
    if (this.resolvedCache.has(iri)) {
      return this.resolvedCache.get(iri);
    }

    const colonIdx = iri.indexOf(":");
    const slashIdx = iri.indexOf("/");
    let resolved = iri;

    // Is absolute IRI?
    if (!(colonIdx !== -1 && (slashIdx === -1 || colonIdx < slashIdx))) {
      if (this.ontologyBaseIri) {
        if (iri === "") {
          resolved = this.ontologyBaseIri;
        } else if (iri.startsWith("#")) {
          const baseHasHash = this.ontologyBaseIri.endsWith("#");
          resolved = baseHasHash ? this.ontologyBaseIri + iri.substring(1) : this.ontologyBaseIri + iri;
        } else {
          const baseEndsWithHashOrSlash = this.ontologyBaseIri.endsWith("#") || this.ontologyBaseIri.endsWith("/");
          resolved = baseEndsWithHashOrSlash ? this.ontologyBaseIri + iri : this.ontologyBaseIri + "#" + iri;
        }
      }
    }

    this.resolvedCache.set(iri, resolved);
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
    const subjectIri = rawAbout ? resolver.resolve(rawAbout) : null;
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
      const resource = DomParserUtils.getAttr(pred, "resource", NAMESPACES.RDF) ? resolver.resolve(DomParserUtils.getAttr(pred, "resource", NAMESPACES.RDF)) : null;

      if (predLocal === "type" && predNs === NAMESPACES.RDF) {
        if (resource) subject.types.add(resource);
      } else if (predLocal === "label" && predNs === NAMESPACES.RDFS) {
        const lang = pred.getAttribute("xml:lang") || pred.getAttributeNS("http://www.w3.org/XML/1998/namespace", "lang") || "undefined";
        const labelVal = pred.textContent.trim();
        subject.labels[lang] = labelVal;
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
        (predLocal === "description" && (predNs === NAMESPACES.DCTERMS || predNs === NAMESPACES.DC))
      ) {
        const lang = pred.getAttribute("xml:lang") || pred.getAttributeNS("http://www.w3.org/XML/1998/namespace", "lang") || "undefined";
        subject.comments[lang] = pred.textContent.trim();
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
                const resolvedPropIri = resolver.resolve(propertyIri);

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
                    rangeIri: resolver.resolve(rangeIri),
                    type: type
                  });
                }
              }
              targetResource = null; // Do not treat as normal subclass/equivalentClass relation
            } else {
              const about = DomParserUtils.getAbout(nestedEl);
              if (about) {
                targetResource = resolver.resolve(about);
              } else {
                // Check if it has owl:unionOf
                const unionOfEl = DomParserUtils.findImmediateChildren(nestedEl, "unionOf")[0];
                if (unionOfEl) {
                  const memberIris = [];
                  const allChildren = unionOfEl.getElementsByTagName ? unionOfEl.getElementsByTagName("*") : [];
                  for (let j = 0; j < allChildren.length; j++) {
                    const descAbout = DomParserUtils.getAbout(allChildren[j]) || DomParserUtils.getAttr(allChildren[j], "resource", NAMESPACES.RDF);
                    if (descAbout) {
                      memberIris.push(resolver.resolve(descAbout));
                    }
                  }
                  
                  if (memberIris.length > 0) {
                    const unionClassIri = "http://anonymous-union/" + context.nextId();
                    const unionCls = ensureClassExists(unionClassIri, "owl:unionOf");
                    unionCls.attributes.push("union");
                    unionCls.unionMembers = memberIris;
                    targetResource = unionClassIri;
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
        const lang = pred.getAttribute("xml:lang") || pred.getAttributeNS("http://www.w3.org/XML/1998/namespace", "lang") || "undefined";
        const key = predLocal;
        if (!subject.annotations[key]) subject.annotations[key] = [];
        subject.annotations[key].push({
          value: resource || pred.textContent.trim(),
          type: resource ? "iri" : "label",
          language: lang,
          identifier: key,
          predicateNs: predNs || ""
        });
      }

      // Recurse into predicate object elements (Level 3 / Level 5) to locate inline declarations
      for (let objectEl = pred.firstChild; objectEl; objectEl = objectEl.nextSibling) {
        if (objectEl.nodeType === 1) {
          parseSubject(objectEl);
        }
      }
    }
  }

  // Init recursive parser
  for (let i = 0; i < rootChildren.length; i++) {
    if (rootChildren[i].nodeType === 1) {
      parseSubject(rootChildren[i]);
    }
  }

  const inferredClasses = new Set();

  // Populate inferred classes from explicit declarations
  for (const iri in subjects) {
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
  for (const iri in subjects) {
    const subject = subjects[iri];
    if (subject.superClasses.length > 0) {
      inferredClasses.add(iri);
      subject.superClasses.forEach(sup => { if (sup) inferredClasses.add(sup); });
    }
    if (subject.equivalentClasses.length > 0) {
      inferredClasses.add(iri);
      subject.equivalentClasses.forEach(eq => { if (eq) inferredClasses.add(eq); });
    }
    if (subject.disjointWith.length > 0) {
      inferredClasses.add(iri);
      subject.disjointWith.forEach(dj => { if (dj) inferredClasses.add(dj); });
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
  for (const iri in subjects) {
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
      subject.domains.forEach(dom => { if (dom) inferredClasses.add(dom); });
      const isDatatypeProp = types.some(t => t === NAMESPACES.OWL + "DatatypeProperty") ||
                             subject.ranges.some(isDatatypeIri);
      if (!isDatatypeProp) {
        subject.ranges.forEach(ran => {
          if (ran && !isDatatypeIri(ran)) inferredClasses.add(ran);
        });
      }
    }
  }

  // Custom typing / Metaclass inference
  // Any custom URI used to instantiate an entity is categorised as a Class (signature/role inference)
  for (const iri in subjects) {
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
    if (context.classMap.has(iri)) {
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
    const localName = resolver.getLocalName(iri);
    const baseIri = resolver.getBaseIri(iri);
    
    const isAnonymous = iri.startsWith("http://anonymous-union/") || type === "owl:unionOf";
    const attributes = [];
    if (isAnonymous) attributes.push("anonymous");
    if (type === "rdfs:Datatype") attributes.push("datatype");

    const cls = {
      id: id,
      type: type === "owl:unionOf" ? "owl:unionOf" : type,
      iri: iri,
      baseIri: baseIri,
      label: { "undefined": localName },
      comment: {},
      attributes: attributes,
      subClasses: [],
      superClasses: [],
      individuals: []
    };
    context.classMap.set(iri, cls);
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
  if (!ontologySubject && ontologyBaseIri) {
    if (subjects[ontologyBaseIri]) {
      ontologySubject = subjects[ontologyBaseIri];
    } else {
      const normalizedBase = ontologyBaseIri.endsWith("/") || ontologyBaseIri.endsWith("#") ? ontologyBaseIri : ontologyBaseIri + "/";
      for (const iri in subjects) {
        if (iri === ontologyBaseIri || iri === normalizedBase) {
          ontologySubject = subjects[iri];
          break;
        }
      }
    }
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

      const localName = resolver.getLocalName(iri);
      const baseIri = resolver.getBaseIri(iri);

      let finalLabels = {};
      if (Object.keys(subject.labels).length > 0) {
        finalLabels = Object.assign({}, subject.labels);
      } else {
        finalLabels = { "undefined": localName };
      }

      const prop = {
        id: context.nextId(),
        type: type,
        iri: iri,
        baseIri: baseIri,
        label: finalLabels,
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

  for (const iri in subjects) {
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

  function createVirtualDatatype(datatypeIri) {
    const cls = context.classMap.get(datatypeIri);
    const virtualId = context.nextId();
    const virtualCls = {
      id: virtualId,
      type: "rdfs:Datatype",
      iri: datatypeIri,
      baseIri: cls ? cls.baseIri : resolver.getBaseIri(datatypeIri),
      label: cls && cls.label ? JSON.parse(JSON.stringify(cls.label)) : { "undefined": resolver.getLocalName(datatypeIri) },
      comment: cls && cls.comment ? JSON.parse(JSON.stringify(cls.comment)) : {},
      attributes: ["datatype"],
      subClasses: [],
      superClasses: [],
      annotations: cls && cls.annotations ? cls.annotations : {}
    };
    context.virtualDatatypes.push(virtualCls);
    return virtualId;
  }

  // Step 3: Resolve domains, ranges & inverses to numeric IDs
  context.propertyMap.forEach(prop => {
    if (prop.domain && typeof prop.domain === "string" && !isVowlId(prop.domain)) {
      prop.domain = getClassId(prop.domain, "http://www.w3.org/2002/07/owl#Thing");
    } else if (!prop.domain) {
      prop.domain = getClassId("http://www.w3.org/2002/07/owl#Thing");
    }

    if (prop.range && typeof prop.range === "string" && !isVowlId(prop.range)) {
      const cls = context.classMap.get(prop.range);
      if (cls && cls.type === "rdfs:Datatype" && prop.range !== "http://www.w3.org/2000/01/rdf-schema#Literal") {
        prop.range = createVirtualDatatype(prop.range);
      } else {
        prop.range = getClassId(prop.range, "http://www.w3.org/2002/07/owl#Thing");
      }
    } else if (!prop.range) {
      if (prop.type === "owl:datatypeProperty") {
        prop.range = getClassId("http://www.w3.org/2000/01/rdf-schema#Literal");
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
      if (superCls.type === "rdfs:Datatype" && rest.rangeIri !== "http://www.w3.org/2000/01/rdf-schema#Literal") {
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
    const isAnon = cls.iri.startsWith("http://anonymous-union/") || cls.type === "owl:unionOf";
    if (!isAnon && isIriExternal(cls.iri)) {
      if (!cls.attributes.includes("external")) cls.attributes.push("external");
    }
  });

  context.propertyMap.forEach(prop => {
    if (isIriExternal(prop.iri)) {
      if (!prop.attributes.includes("external")) prop.attributes.push("external");
    }
  });

  // Build JSON outputs
  const classesArray = [];
  const classAttributesArray = [];
  const disjointProperties = [];

  context.classMap.forEach(cls => {
    classesArray.push({ id: cls.id, type: cls.type });
    const isAnonymous = cls.iri.startsWith("http://anonymous-union/") || cls.type === "owl:unionOf";
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

module.exports.loadWithImports = function (initialXmlText) {
  const parser = new DOMParser();
  let mainDoc;
  try {
    mainDoc = parser.parseFromString(initialXmlText, "application/xml");
  } catch (e) {
    return Promise.reject(e);
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
      
      const menu = (typeof window !== "undefined" && window.WebVOWL && window.WebVOWL.ontologyMenu) ? window.WebVOWL.ontologyMenu : null;
      if (menu && menu.append_bulletPoint) {
        menu.append_bulletPoint("Importing external ontology: " + url + " ...");
      }
      
      promises.push(
        fetch(url)
          .then(response => {
            if (!response.ok) throw new Error("HTTP error " + response.status);
            return response.text();
          })
          .then(xmlText => {
            const importedDoc = parser.parseFromString(xmlText, "application/xml");
            const importedRoot = importedDoc.documentElement;
            if (!importedRoot) return;
            
            // Merge namespace attributes
            if (importedRoot.attributes) {
              for (let i = 0; i < importedRoot.attributes.length; i++) {
                const attr = importedRoot.attributes[i];
                if (attr.name.startsWith("xmlns:") && !rootEl.hasAttribute(attr.name)) {
                  rootEl.setAttribute(attr.name, attr.value);
                }
              }
            }
            
            // Merge children
            const children = importedRoot.childNodes;
            for (let i = 0; i < children.length; i++) {
              const child = children[i];
              if (child.nodeType === 1) {
                if (child.localName === "Ontology") {
                  continue;
                }
                const importedNode = mainDoc.importNode(child, true);
                rootEl.appendChild(importedNode);
              }
            }
            
            if (menu && menu.append_message_toLastBulletPoint) {
              menu.append_message_toLastBulletPoint("done");
            }
            
            return fetchAndMerge(importedDoc);
          })
          .catch(err => {
            console.warn("Failed to load imported ontology " + url + ": ", err);
            if (menu && menu.append_message_toLastBulletPoint) {
              menu.append_message_toLastBulletPoint("<span style='color:orange;'>failed (skipped)</span>");
            }
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
