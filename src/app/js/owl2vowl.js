// Client-side OWL2VOWL converter in JavaScript

module.exports = function owl2vowl(xmlString) {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, "application/xml");
  
  // Check for XML parsing errors
  const parserError = xmlDoc.getElementsByTagName("parsererror")[0];
  if (parserError) {
    throw new Error("XML parsing error: " + parserError.textContent);
  }

  const RDF_NS = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
  const RDFS_NS = "http://www.w3.org/2000/01/rdf-schema#";
  const OWL_NS = "http://www.w3.org/2002/07/owl#";
  const DC_NS = "http://purl.org/dc/elements/1.1/";
  const DCTERMS_NS = "http://purl.org/dc/terms/";

  // Helper to extract attributes robustly
  function getAttr(el, name, ns) {
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

  // Resolves subject identifiers; rdf:ID is specifically flagged as a fragment NCName
  function getAbout(el) {
    const about = getAttr(el, "about", RDF_NS);
    if (about !== null && about !== "") {
      return about;
    }
    const id = getAttr(el, "ID", RDF_NS);
    if (id !== null && id !== "") {
      return id.startsWith("#") ? id : "#" + id;
    }
    return null;
  }

  function getResource(el) {
    return getAttr(el, "resource", RDF_NS);
  }

  function getIriLocalName(iri) {
    if (!iri) return "";
    const hashIdx = iri.lastIndexOf("#");
    if (hashIdx !== -1) return iri.substring(hashIdx + 1);
    const slashIdx = iri.lastIndexOf("/");
    if (slashIdx !== -1) return iri.substring(slashIdx + 1);
    return iri;
  }

  function getIriBase(iri) {
    if (!iri) return "";
    const hashIdx = iri.lastIndexOf("#");
    if (hashIdx !== -1) return iri.substring(0, hashIdx);
    const slashIdx = iri.lastIndexOf("/");
    if (slashIdx !== -1) return iri.substring(0, slashIdx);
    return iri;
  }

  // Identifies standard XML Schema datatypes or built-in RDF/RDFS/OWL datatypes
  function isDatatypeIri(iri) {
    if (!iri) return false;
    // Keep rdfs:Literal categorised specifically as its own VOWL node type
    if (iri === "http://www.w3.org/2000/01/rdf-schema#Literal") return false;
    if (iri.startsWith("http://www.w3.org/2001/XMLSchema#")) return true;
    if (iri.startsWith("http://www.w3.org/1999/02/22-rdf-syntax-ns#")) {
      const local = getIriLocalName(iri);
      return ["PlainLiteral", "XMLLiteral", "HTML", "langString"].includes(local);
    }
    if (iri.startsWith("http://www.w3.org/2002/07/owl#")) {
      const local = getIriLocalName(iri);
      return ["real", "rational"].includes(local);
    }
    return false;
  }

  // Resolve relative IRIs against the base IRI
  function resolveIri(iri) {
    if (!iri) return ontologyBaseIri;
    
    // If it's already an absolute IRI (contains scheme like http:, https:, urn:, etc.)
    const colonIdx = iri.indexOf(":");
    const slashIdx = iri.indexOf("/");
    if (colonIdx !== -1 && (slashIdx === -1 || colonIdx < slashIdx)) {
      return iri;
    }

    if (!ontologyBaseIri) return iri;
    if (iri === "") return ontologyBaseIri;

    if (iri.startsWith("#")) {
      const baseHasHash = ontologyBaseIri.endsWith("#");
      return baseHasHash ? ontologyBaseIri + iri.substring(1) : ontologyBaseIri + iri;
    }

    const baseEndsWithHashOrSlash = ontologyBaseIri.endsWith("#") || ontologyBaseIri.endsWith("/");
    if (baseEndsWithHashOrSlash) {
      return ontologyBaseIri + iri;
    } else {
      return ontologyBaseIri + "#" + iri;
    }
  }

  // Find elements by localName (ignores namespace prefix)
  function getElementsByLocalName(parent, localName) {
    const elements = [];
    function traverse(node) {
      if (node.nodeType === 1 || node.nodeType === 9) {
        if (node.nodeType === 1 && node.localName === localName) {
          elements.push(node);
        }
        for (let child = node.firstChild; child; child = child.nextSibling) {
          traverse(child);
        }
      }
    }
    traverse(parent);
    return elements;
  }

  // Resolves property IRIs within onProperty nodes by looking inline at child elements if needed
  function getPropertyIriFromOnProperty(onPropertyEl) {
    if (!onPropertyEl) return null;
    let iri = getResource(onPropertyEl) || getAbout(onPropertyEl);
    if (iri) return iri;
    for (let child = onPropertyEl.firstChild; child; child = child.nextSibling) {
      if (child.nodeType === 1) {
        const childIri = getAbout(child) || getResource(child);
        if (childIri) return childIri;
      }
    }
    return null;
  }

  const rootEl = xmlDoc.documentElement;
  // Get prefix mappings from the root element
  const prefixList = {};
  if (rootEl) {
    for (let i = 0; i < rootEl.attributes.length; i++) {
      const attr = rootEl.attributes[i];
      if (attr.name.startsWith("xmlns:")) {
        const prefix = attr.name.substring(6);
        prefixList[prefix] = attr.value;
      } else if (attr.name === "xmlns") {
        prefixList[""] = attr.value;
      }
    }
  }

  let ontologyBaseIri = "";
  if (rootEl && getAttr(rootEl, "base")) {
    ontologyBaseIri = getAttr(rootEl, "base");
  }

  let idCounter = 0;
  function nextId() {
    return String(idCounter++);
  }

  const classMap = new Map(); // IRI -> VOWL Class object
  const propertyMap = new Map(); // IRI -> VOWL Property object
  const subclassRelations = []; // Array of { subclassIri, superclassIri }
  const subpropertyRelations = []; // Array of { subpropIri, superpropIri }
  const parsedRestrictions = []; // Array of { domainIri, propertyIri, rangeIri, type }
  const parsedCardinalities = []; // Array of { propertyIri, minCardinality, maxCardinality, cardinality }

  function ensureClassExists(iri, type = "owl:Class") {
    // Dynamically coerce standard datatypes to rdfs:Datatype
    if (isDatatypeIri(iri)) {
      type = "rdfs:Datatype";
    }
    if (classMap.has(iri)) {
      const cls = classMap.get(iri);
      if (type === "owl:unionOf" && cls.type === "owl:Class") {
        cls.type = "owl:unionOf";
      }
      // If a placeholder class is resolved later to a Datatype, update the configuration
      if (type === "rdfs:Datatype" && cls.type === "owl:Class") {
        cls.type = "rdfs:Datatype";
        if (!cls.attributes.includes("datatype")) {
          cls.attributes.push("datatype");
        }
      }
      return cls;
    }
    const id = nextId();
    const localName = getIriLocalName(iri);
    const baseIri = getIriBase(iri);
    
    const isAnonymous = iri.startsWith("http://anonymous-union/") || type === "owl:unionOf";
    const attributes = [];
    if (isAnonymous) {
      attributes.push("anonymous");
    }
    if (type === "rdfs:Datatype") {
      attributes.push("datatype");
    }

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
    classMap.set(iri, cls);
    return cls;
  }

  function ensurePropertyExists(iri, type = "owl:objectProperty") {
    if (propertyMap.has(iri)) {
      return propertyMap.get(iri);
    }
    const id = nextId();
    const localName = getIriLocalName(iri);
    const baseIri = getIriBase(iri);
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
    propertyMap.set(iri, prop);
    return prop;
  }

  // Prepopulate standard classes
  ensureClassExists("http://www.w3.org/2002/07/owl#Thing", "owl:Thing");
  ensureClassExists("http://www.w3.org/2000/01/rdf-schema#Literal", "rdfs:Literal");



  // Group triples by Subject IRI
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

  // Recursive subject graph parser (traverses the XML document in subject-predicate alternation)
  function parseSubject(element) {
    const subjectIri = getAbout(element) ? resolveIri(getAbout(element)) : null;
    if (!subjectIri) return;

    const subject = getOrCreateSubject(subjectIri);

    // Parse specific types from tags
    const localName = element.localName;
    if (localName !== "Description") {
      if (localName === "Class") {
        subject.types.add(OWL_NS + "Class");
      } else if (localName === "ObjectProperty") {
        subject.types.add(OWL_NS + "ObjectProperty");
      } else if (localName === "DatatypeProperty") {
        subject.types.add(OWL_NS + "DatatypeProperty");
      } else if (localName === "AnnotationProperty") {
        subject.types.add(OWL_NS + "AnnotationProperty");
      } else if (localName === "Ontology") {
        subject.types.add(OWL_NS + "Ontology");
      } else if (localName === "NamedIndividual") {
        subject.types.add(OWL_NS + "NamedIndividual");
      } else if (element.namespaceURI) {
        subject.types.add(element.namespaceURI + localName);
      }
    }

    // Process nested predicates
    for (let pred = element.firstChild; pred; pred = pred.nextSibling) {
      if (pred.nodeType !== 1) continue;

      const predLocal = pred.localName;
      const predNs = pred.namespaceURI;
      const resource = getResource(pred) ? resolveIri(getResource(pred)) : null;

      if (predLocal === "type" && predNs === RDF_NS) {
        if (resource) subject.types.add(resource);
      } else if (predLocal === "label" && predNs === RDFS_NS) {
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
          predicateNs: RDFS_NS
        });
      } else if (
        (predLocal === "comment" && predNs === RDFS_NS) ||
        (predLocal === "description" && (predNs === DCTERMS_NS || predNs === DC_NS))
      ) {
        const lang = pred.getAttribute("xml:lang") || pred.getAttributeNS("http://www.w3.org/XML/1998/namespace", "lang") || "undefined";
        subject.comments[lang] = pred.textContent.trim();
      } else if ((predLocal === "domain" || predLocal === "range" || predLocal === "subClassOf" || predLocal === "subPropertyOf" || predLocal === "inverseOf" || predLocal === "equivalentClass" || predLocal === "disjointWith") && (predNs === RDFS_NS || predNs === OWL_NS)) {
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
            const isRestriction = nestedEl.localName === "Restriction" && (nestedEl.namespaceURI === OWL_NS || nestedEl.prefix === "owl");
            if (isRestriction && (predLocal === "subClassOf" || predLocal === "equivalentClass")) {
              const onPropertyEl = getElementsByLocalName(nestedEl, "onProperty")[0];
              const propertyIri = onPropertyEl ? getPropertyIriFromOnProperty(onPropertyEl) : null;

              if (propertyIri) {
                const resolvedPropIri = resolveIri(propertyIri);

                // Parse cardinalities
                const minCardEl = getElementsByLocalName(nestedEl, "minQualifiedCardinality")[0] || getElementsByLocalName(nestedEl, "minCardinality")[0];
                const maxCardEl = getElementsByLocalName(nestedEl, "maxQualifiedCardinality")[0] || getElementsByLocalName(nestedEl, "maxCardinality")[0];
                const cardEl = getElementsByLocalName(nestedEl, "qualifiedCardinality")[0] || getElementsByLocalName(nestedEl, "cardinality")[0];

                if (minCardEl || maxCardEl || cardEl) {
                  parsedCardinalities.push({
                    propertyIri: resolvedPropIri,
                    minCardinality: minCardEl ? minCardEl.textContent.trim() : null,
                    maxCardinality: maxCardEl ? maxCardEl.textContent.trim() : null,
                    cardinality: cardEl ? cardEl.textContent.trim() : null
                  });
                }

                // Parse someValuesFrom / allValuesFrom / hasValue
                const someValuesFromEl = getElementsByLocalName(nestedEl, "someValuesFrom")[0];
                const allValuesFromEl = getElementsByLocalName(nestedEl, "allValuesFrom")[0];
                const hasValueEl = getElementsByLocalName(nestedEl, "hasValue")[0];
                let rangeIri = null;
                let type = null;

                if (someValuesFromEl) {
                  rangeIri = getResource(someValuesFromEl) || getAbout(someValuesFromEl);
                  type = "owl:someValuesFrom";
                } else if (allValuesFromEl) {
                  rangeIri = getResource(allValuesFromEl) || getAbout(allValuesFromEl);
                  type = "owl:allValuesFrom";
                } else if (hasValueEl) {
                  rangeIri = getResource(hasValueEl) || getAbout(hasValueEl);
                  type = "owl:hasValue";
                }

                if (rangeIri) {
                  parsedRestrictions.push({
                    domainIri: subjectIri,
                    propertyIri: resolvedPropIri,
                    rangeIri: resolveIri(rangeIri),
                    type: type
                  });
                }
              }
              targetResource = null; // Do not treat as normal subclass/equivalentClass relation
            } else {
              const about = getAbout(nestedEl);
              if (about) {
                targetResource = resolveIri(about);
              } else {
                // Check if it has owl:unionOf
                const unionOfEl = getElementsByLocalName(nestedEl, "unionOf")[0];
                if (unionOfEl) {
                  const memberIris = [];
                  const allChildren = unionOfEl.getElementsByTagName ? unionOfEl.getElementsByTagName("*") : [];
                  for (let j = 0; j < allChildren.length; j++) {
                    const descAbout = getAbout(allChildren[j]) || getResource(allChildren[j]);
                    if (descAbout) {
                      memberIris.push(resolveIri(descAbout));
                    }
                  }
                  
                  if (memberIris.length > 0) {
                     const unionClassIri = "http://anonymous-union/" + nextId();
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

  // Parse RDF/XML tree recursively
  const rootChildren = rootEl ? rootEl.childNodes : [];
  for (let i = 0; i < rootChildren.length; i++) {
    if (rootChildren[i].nodeType === 1) {
      parseSubject(rootChildren[i]);
    }
  }

  // 1. Identify Ontology Header Subject
  let ontologySubject = null;
  for (const iri in subjects) {
    if (subjects[iri].types.has(OWL_NS + "Ontology")) {
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
  if (!ontologySubject) {
    // Find subject with dc/dcterms title
    for (const iri in subjects) {
      if (subjects[iri].labels["en"] || subjects[iri].annotations["title"]) {
        if (iri.endsWith("/") || iri.endsWith("#") || iri.split("/").length <= 5) {
          ontologySubject = subjects[iri];
          break;
        }
      }
    }
  }

  let ontologyIri = "http://visualdataweb.org/newOntology/";
  const header = {
    languages: ["en", "undefined"],
    baseIris: [],
    prefixList: prefixList,
    title: {},
    iri: ontologyIri,
    version: "",
    author: [],
    description: {},
    labels: {},
    comments: {},
    other: {}
  };

  if (ontologyBaseIri) {
    header.baseIris.push(ontologyBaseIri);
  }

  if (ontologySubject) {
    ontologyIri = ontologySubject.iri;
    header.iri = ontologyIri;
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
    header.iri = ontologyIri;
    header.title = { "en": "Ontology" };
  }

  // Helper to determine if an IRI is external to the loaded ontology
  function isIriExternal(iri) {
    if (!iri) return false;
    
    // Ignore anonymous union classes
    if (iri.startsWith("http://anonymous-union/") || iri.startsWith("http://owl2vowl.de#") || iri.startsWith("http://anonymous-")) {
      return false;
    }
    
    // Ontologies have standard owl/rdf/rdfs namespaces as external
    if (iri.startsWith("http://www.w3.org/2002/07/owl#") || 
        iri.startsWith("http://www.w3.org/1999/02/22-rdf-syntax-ns#") || 
        iri.startsWith("http://www.w3.org/2000/01/rdf-schema#")) {
      return true;
    }
    
    let ontologyIriVal = ontologyIri || ontologyBaseIri;
    if (!ontologyIriVal) {
      return false;
    }
    
    function removeTrailingHash(str) {
      return str.replace(/[#/]$/, "");
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

  // Build a Set of inferred classes to capture implicit classes (e.g. customized/punned meta-classes)
  const inferredClasses = new Set();

  // 1. Explicitly declared classes
  for (const iri in subjects) {
    const subject = subjects[iri];
    for (const type of subject.types) {
      if (
        type === OWL_NS + "Class" ||
        type === RDFS_NS + "Class" ||
        type === OWL_NS + "DeprecatedClass"
      ) {
        inferredClasses.add(iri);
      }
    }
  }

  // 2. Class relations (subclass, equivalence, disjointness)
  for (const iri in subjects) {
    const subject = subjects[iri];
    
    if (subject.superClasses.length > 0) {
      inferredClasses.add(iri);
      subject.superClasses.forEach(sup => {
        if (sup) inferredClasses.add(sup);
      });
    }

    if (subject.equivalentClasses.length > 0) {
      inferredClasses.add(iri);
      subject.equivalentClasses.forEach(eq => {
        if (eq) inferredClasses.add(eq);
      });
    }

    if (subject.disjointWith.length > 0) {
      inferredClasses.add(iri);
      subject.disjointWith.forEach(dj => {
        if (dj) inferredClasses.add(dj);
      });
    }
  }

  // 3. Subclass relations parsed
  subclassRelations.forEach(rel => {
    if (rel.subclassIri) inferredClasses.add(rel.subclassIri);
    if (rel.superclassIri) inferredClasses.add(rel.superclassIri);
  });

  // 4. Parsed restrictions
  parsedRestrictions.forEach(rest => {
    if (rest.domainIri) inferredClasses.add(rest.domainIri);
    if (rest.rangeIri && !isDatatypeIri(rest.rangeIri)) {
      inferredClasses.add(rest.rangeIri);
    }
  });

  // 5. Domains and ranges of properties
  for (const iri in subjects) {
    const subject = subjects[iri];
    const types = Array.from(subject.types);
    const isProperty = types.some(t =>
      t === OWL_NS + "ObjectProperty" ||
      t === OWL_NS + "DatatypeProperty" ||
      t === OWL_NS + "FunctionalProperty" ||
      t === OWL_NS + "TransitiveProperty" ||
      t === OWL_NS + "SymmetricProperty" ||
      t === RDF_NS + "Property"
    );

    if (isProperty) {
      subject.domains.forEach(dom => {
        if (dom) inferredClasses.add(dom);
      });

      const isDatatypeProp = types.some(t => t === OWL_NS + "DatatypeProperty") ||
                             subject.ranges.some(isDatatypeIri);
      if (!isDatatypeProp) {
        subject.ranges.forEach(ran => {
          if (ran && !isDatatypeIri(ran)) inferredClasses.add(ran);
        });
      }
    }
  }

  // 6. Types used in custom class assertion/typing statements 
  // Any custom URI used to instantiate an entity is categorised as a Class (signature/role inference)
  for (const iri in subjects) {
    const subject = subjects[iri];
    subject.types.forEach(t => {
      if (
        t !== OWL_NS + "NamedIndividual" &&
        t !== OWL_NS + "Ontology" &&
        t !== OWL_NS + "Class" &&
        t !== RDFS_NS + "Class" &&
        t !== OWL_NS + "DeprecatedClass" &&
        t !== OWL_NS + "ObjectProperty" &&
        t !== OWL_NS + "DatatypeProperty" &&
        t !== OWL_NS + "AnnotationProperty" &&
        t !== RDF_NS + "Property" &&
        t !== RDFS_NS + "Datatype" &&
        !isDatatypeIri(t)
      ) {
        inferredClasses.add(t);
      }
    });
  }

  // List of parsed individuals and their matching class container IRIs
  const parsedIndividuals = [];

  // 2. Map Subjects to Classes, Properties & Named Individuals
  for (const iri in subjects) {
    if (ignoredProperties.has(iri)) continue;

    const subject = subjects[iri];
    if (ontologySubject && iri === ontologySubject.iri) continue;

    const types = Array.from(subject.types);

    // Apply the signature inference check
    const isClass = inferredClasses.has(iri);

    const isDatatype = types.some(t => t === RDFS_NS + "Datatype") || isDatatypeIri(iri);

    const isAnnotationProperty = types.some(t => t === OWL_NS + "AnnotationProperty");
    const isProperty = !isAnnotationProperty && types.some(t =>
      t === OWL_NS + "ObjectProperty" ||
      t === OWL_NS + "DatatypeProperty" ||
      t === OWL_NS + "FunctionalProperty" ||
      t === OWL_NS + "TransitiveProperty" ||
      t === OWL_NS + "SymmetricProperty" ||
      t === RDF_NS + "Property"
    );

    const isExplicitNamedIndividual = types.some(t => t === OWL_NS + "NamedIndividual");
    const isIndividual = !isClass && !isDatatype && !isProperty && (
      isExplicitNamedIndividual ||
      types.some(t => inferredClasses.has(t) || t === OWL_NS + "Thing")
    );

    if (isClass && !isDatatype) {
      const cls = ensureClassExists(iri, "owl:Class");
      
      // Mirror the Java exporter's precise label priority logic:
      // If annotation properties (rdfs:label) are available, output only those.
      // Else, fall back safely to undefined: localName.
      if (Object.keys(subject.labels).length > 0) {
        cls.label = Object.assign({}, subject.labels);
      } else {
        cls.label = { "undefined": getIriLocalName(iri) };
      }

      cls.comment = subject.comments;
      cls.annotations = subject.annotations;
      cls.disjointWith = subject.disjointWith;

      if (types.some(t => t === OWL_NS + "DeprecatedClass")) {
        if (!cls.attributes.includes("deprecated")) cls.attributes.push("deprecated");
      }

      subject.superClasses.forEach(superIri => {
        subclassRelations.push({ subclassIri: iri, superclassIri: superIri });
      });
    } else if (isDatatype) {
      const cls = ensureClassExists(iri, "rdfs:Datatype");
      if (!cls.attributes.includes("datatype")) {
        cls.attributes.push("datatype");
      }
      
      if (Object.keys(subject.labels).length > 0) {
        cls.label = Object.assign({}, subject.labels);
      } else {
        cls.label = { "undefined": getIriLocalName(iri) };
      }

      cls.comment = subject.comments;
      cls.annotations = subject.annotations;
    } else if (isProperty) {
      let type = "owl:objectProperty";
      const attributes = ["object"];

      // If typed explicitly as DatatypeProperty or its range matches a built-in datatype, make it a datatypeProperty
      const isDTP = types.some(t => t === OWL_NS + "DatatypeProperty") || 
                    (subject.ranges && subject.ranges.some(isDatatypeIri));
      if (isDTP) {
        type = "owl:datatypeProperty";
        attributes[0] = "datatype";
      }

      if (types.some(t => t === OWL_NS + "FunctionalProperty")) attributes.push("functional");
      if (types.some(t => t === OWL_NS + "TransitiveProperty")) attributes.push("transitive");
      if (types.some(t => t === OWL_NS + "SymmetricProperty")) attributes.push("symmetric");

      const localName = getIriLocalName(iri);
      const baseIri = getIriBase(iri);

      let finalLabels = {};
      if (Object.keys(subject.labels).length > 0) {
        finalLabels = Object.assign({}, subject.labels);
      } else {
        finalLabels = { "undefined": localName };
      }

      const prop = {
        id: nextId(),
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
        subpropertyRelations.push({ subpropIri: iri, superpropIri: superIri });
      });

      propertyMap.set(iri, prop);
    } else if (isIndividual) {
      const individualIri = iri;
      const localName = getIriLocalName(individualIri);

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
        baseIri: getIriBase(individualIri),
        labels: finalLabels,
        comments: subject.comments || {}
      };
      if (subject.annotations && Object.keys(subject.annotations).length > 0) {
        indObj.annotations = subject.annotations;
      }

      // Collect all matched class types this individual instantiates
      let classIris = types.filter(t => 
        t !== OWL_NS + "NamedIndividual" && 
        (inferredClasses.has(t) || t === OWL_NS + "Thing")
      );

      // Default to owl:Thing if no specific custom classes are defined on the individual
      if (classIris.length === 0) {
        classIris.push("http://www.w3.org/2002/07/owl#Thing");
      }

      parsedIndividuals.push({
        individual: indObj,
        classIris: classIris
      });
    }
  }

  // --- Resolution phase ---

  // Is it a numeric ID (VOWL ID)?
  function isVowlId(str) {
    if (typeof str !== "string") return false;
    return /^\d+$/.test(str);
  }

  // Helper to defensively resolve entity class references
  function getClassId(iri, fallbackIri = "http://www.w3.org/2002/07/owl#Thing") {
    let cls = classMap.get(iri);
    if (!cls) {
      cls = classMap.get(fallbackIri);
    }
    return cls ? cls.id : "0";
  }

  const virtualDatatypes = [];

  // Helper to create individualized visual Datatype nodes per reference to match Java converter behaviour
  function createVirtualDatatype(datatypeIri) {
    const cls = classMap.get(datatypeIri);
    const virtualId = nextId();
    const virtualCls = {
      id: virtualId,
      type: "rdfs:Datatype",
      iri: datatypeIri,
      baseIri: cls ? cls.baseIri : getIriBase(datatypeIri),
      label: cls && cls.label ? JSON.parse(JSON.stringify(cls.label)) : { "undefined": getIriLocalName(datatypeIri) },
      comment: cls && cls.comment ? JSON.parse(JSON.stringify(cls.comment)) : {},
      attributes: ["datatype"],
      subClasses: [],
      superClasses: [],
      annotations: cls && cls.annotations ? cls.annotations : {}
    };
    virtualDatatypes.push(virtualCls);
    return virtualId;
  }

  // 0. Pre-register all properties referenced in restrictions to guarantee they exist in propertyMap
  parsedRestrictions.forEach(rest => {
    if (rest.propertyIri) {
      ensurePropertyExists(rest.propertyIri);
    }
  });

  // 1. Ensure all referenced classes and datatypes exist in classMap
  subclassRelations.forEach(rel => {
    ensureClassExists(rel.subclassIri);
    ensureClassExists(rel.superclassIri);
  });

  parsedRestrictions.forEach(rest => {
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
  parsedIndividuals.forEach(item => {
    item.classIris.forEach(clsIri => {
      ensureClassExists(clsIri);
    });
  });

  propertyMap.forEach(prop => {
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
  classMap.forEach(cls => {
    if (cls.unionMembers) {
      cls.unionMembers.forEach(memberIri => {
        ensureClassExists(memberIri);
      });
    }
  });

  // Map parsed individuals to their corresponding class instances arrays
  parsedIndividuals.forEach(item => {
    item.classIris.forEach(clsIri => {
      const cls = classMap.get(clsIri);
      if (cls) {
        if (!cls.individuals) {
          cls.individuals = [];
        }
        if (!cls.individuals.some(ind => ind.iri === item.individual.iri)) {
          cls.individuals.push(item.individual);
        }
      }
    });
  });

  // 2. Ensure all referenced properties exist in propertyMap
  subpropertyRelations.forEach(rel => {
    if (rel.superpropIri && ignoredProperties.has(rel.superpropIri)) return;
    if (rel.subpropIri) ensurePropertyExists(rel.subpropIri);
    if (rel.superpropIri) ensurePropertyExists(rel.superpropIri);
  });

  // Gather and create inverse properties in a safe separate list first
  const inversesToCreate = [];
  propertyMap.forEach(prop => {
    if (prop.inverse && typeof prop.inverse === "string" && !isVowlId(prop.inverse)) {
      inversesToCreate.push(prop.inverse);
    }
  });
  inversesToCreate.forEach(invIri => {
    ensurePropertyExists(invIri);
  });

  // 3. Resolve domains, ranges & inverses to IDs (modifying properties in propertyMap)
  propertyMap.forEach(prop => {
    if (prop.domain && typeof prop.domain === "string" && !isVowlId(prop.domain)) {
      prop.domain = getClassId(prop.domain, "http://www.w3.org/2002/07/owl#Thing");
    } else if (!prop.domain) {
      prop.domain = getClassId("http://www.w3.org/2002/07/owl#Thing");
    }

    if (prop.range && typeof prop.range === "string" && !isVowlId(prop.range)) {
      const cls = classMap.get(prop.range);
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
      const invProp = propertyMap.get(prop.inverse);
      if (invProp) {
        prop.inverse = invProp.id;
        invProp.inverse = prop.id;
      } else {
        prop.inverse = null;
      }
    }
  });

  // Resolve union class members to IDs
  classMap.forEach(cls => {
    if (cls.unionMembers) {
      cls.union = cls.unionMembers.map(memberIri => {
        const memberCls = classMap.get(memberIri);
        return memberCls ? memberCls.id : null;
      }).filter(id => id !== null);
      delete cls.unionMembers;
    }
  });

  // Resolve equivalent classes
  classMap.forEach(cls => {
    const subject = subjects[cls.iri];
    if (subject && subject.equivalentClasses && subject.equivalentClasses.length > 0) {
      cls.equivalent = [];
      if (!cls.attributes.includes("equivalent")) {
        cls.attributes.push("equivalent");
      }
      subject.equivalentClasses.forEach(equivIri => {
        const equivCls = classMap.get(equivIri);
        if (equivCls) {
          cls.equivalent.push(equivCls.id);
          if (!equivCls.attributes.includes("equivalent")) {
            equivCls.attributes.push("equivalent");
          }
        }
      });
    }
  });

  // 4. Create subclass properties and construct hierarchy arrays
  const subclassProperties = [];
  subclassRelations.forEach(rel => {
    if (rel.superclassIri === "http://www.w3.org/2002/07/owl#Thing") {
      return;
    }
    const subCls = classMap.get(rel.subclassIri);
    const superCls = classMap.get(rel.superclassIri);
    
    if (subCls && superCls) {
      if (!subCls.superClasses.includes(superCls.id)) {
        subCls.superClasses.push(superCls.id);
      }
      if (!superCls.subClasses.includes(subCls.id)) {
        superCls.subClasses.push(subCls.id);
      }

      const propId = nextId();
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

  // 5. Resolve subproperties
  subpropertyRelations.forEach(rel => {
    if (rel.superpropIri && ignoredProperties.has(rel.superpropIri)) return;
    const subProp = propertyMap.get(rel.subpropIri);
    const superProp = propertyMap.get(rel.superpropIri);
    if (subProp && superProp) {
      subProp.superproperty.push(superProp.id);
      superProp.subproperty.push(subProp.id);
    }
  });

  // Resolve restrictions to VOWL property objects
  const restrictionProperties = [];
  parsedRestrictions.forEach(rest => {
    const subCls = classMap.get(rest.domainIri);
    const superCls = classMap.get(rest.rangeIri);
    
    if (subCls && superCls) {
      let refProp = propertyMap.get(rest.propertyIri);
      if (!refProp) {
        refProp = ensurePropertyExists(rest.propertyIri);
      }
      
      const propId = nextId();
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
      const refPropBaseIri = refProp ? refProp.baseIri : getIriBase(rest.propertyIri);
      const refPropLabel = refProp && refProp.label ? refProp.label : { "undefined": getIriLocalName(rest.propertyIri) };
      
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

  // Resolve cardinalities onto property definitions
  parsedCardinalities.forEach(card => {
    const prop = propertyMap.get(card.propertyIri);
    if (prop) {
      if (card.minCardinality !== null) {
        prop.minCardinality = card.minCardinality;
      }
      if (card.maxCardinality !== null) {
        prop.maxCardinality = card.maxCardinality;
      }
      if (card.cardinality !== null) {
        prop.cardinality = card.cardinality;
      }
    }
  });

  // Update external attributes for all classes and properties based on fully resolved ontologyIri
  classMap.forEach(cls => {
    const isAnon = cls.iri.startsWith("http://anonymous-union/") || cls.type === "owl:unionOf";
    if (!isAnon && isIriExternal(cls.iri)) {
      if (!cls.attributes.includes("external")) {
        cls.attributes.push("external");
      }
    }
  });

  propertyMap.forEach(prop => {
    if (isIriExternal(prop.iri)) {
      if (!prop.attributes.includes("external")) {
        prop.attributes.push("external");
      }
    }
  });

  // Build JSON outputs
  const classesArray = [];
  const classAttributesArray = [];
  const disjointProperties = [];
  classMap.forEach(cls => {
    classesArray.push({ id: cls.id, type: cls.type });
    const isAnonymous = cls.iri.startsWith("http://anonymous-union/") || cls.type === "owl:unionOf";
    const attr = {
      id: cls.id
    };
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
        const targetCls = classMap.get(targetIri);
        if (targetCls) {
          const propId = nextId();
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

  // Append virtual datatypes
  virtualDatatypes.forEach(cls => {
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
  propertyMap.forEach(prop => {
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

  // Compute exact individuals metric count across all registered classes
  let totalIndividualCount = 0;
  classMap.forEach(cls => {
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
      const res = getAttr(elements[i], "resource", "http://www.w3.org/1999/02/22-rdf-syntax-ns#");
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
    mainOntologyIri = getAttr(ontologyEl, "about", "http://www.w3.org/1999/02/22-rdf-syntax-ns#") || "";
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
