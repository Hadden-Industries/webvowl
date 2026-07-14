import { DOMParser } from "@xmldom/xmldom";
import { NAMESPACES } from "./constants.js";
import { getAttr, getAbout, findImmediateChildren } from "./domUtils.js";

/**
 * Parses an RDF/XML string into standard subject/annotations structure,
 * and tracks class mappings, cardinalities, and restrictions.
 * @param {string} xmlString
 * @param {PerformanceIriResolver} resolver
 * @param {VowlParserContext} context
 * @returns {object}
 */
export function parseRdfXml(xmlString, resolver, context) {
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

  const ontologyBaseIri = rootEl ? (getAttr(rootEl, "base") || "") : "";
  const subjects = {};
  const languagesSet = new Set();

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

  function registerLanguage(rawLang) {
    const clean = (rawLang || "").trim().toLowerCase();
    if (!clean || clean === "undefined") {
      languagesSet.add("undefined");
      return "undefined";
    }
    languagesSet.add(clean);
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
        equivalentProperties: [],
        disjointWith: [],
        annotations: {}
      };
    }
    return subjects[iri];
  }

  function isDatatypeIri(iri) {
    if (!iri) return false;
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

  function getPropertyIriFromOnProperty(onPropertyEl) {
    if (!onPropertyEl) return null;
    let iri = getAttr(onPropertyEl, "resource", NAMESPACES.RDF) || getAbout(onPropertyEl);
    if (iri) return iri;
    for (let child = onPropertyEl.firstChild; child; child = child.nextSibling) {
      if (child.nodeType === 1) {
        const childIri = getAbout(child) || getAttr(child, "resource", NAMESPACES.RDF);
        if (childIri) return childIri;
      }
    }
    return null;
  }

  function parseSubject(element) {
    const rawAbout = getAbout(element);
    const activeBase = getActiveBaseUri(element);
    const subjectIri = rawAbout ? resolver.resolve(rawAbout, activeBase) : null;
    if (!subjectIri) return;

    const subject = getOrCreateSubject(subjectIri);
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

    for (let pred = element.firstChild; pred; pred = pred.nextSibling) {
      if (pred.nodeType !== 1) continue;

      const predLocal = pred.localName;
      const predNs = pred.namespaceURI;
      const activeBasePred = getActiveBaseUri(pred);
      const resource = getAttr(pred, "resource", NAMESPACES.RDF) ? resolver.resolve(getAttr(pred, "resource", NAMESPACES.RDF), activeBasePred) : null;

      if (predLocal === "type" && predNs === NAMESPACES.RDF) {
        if (resource) subject.types.add(resource);
      } else if (predLocal === "label" && predNs === NAMESPACES.RDFS) {
        const rawLang = pred.getAttribute("xml:lang") || pred.getAttributeNS("http://www.w3.org/XML/1998/namespace", "lang") || "undefined";
        const lang = registerLanguage(rawLang);
        const labelVal = pred.textContent.trim();
        
        subject.labels[lang] = labelVal;
        if (lang.includes("-")) {
          const baseLang = lang.split("-")[0];
          if (!subject.labels[baseLang]) {
            subject.labels[baseLang] = labelVal;
          }
        }

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
         predLocal === "equivalentClass" || predLocal === "equivalentProperty" || predLocal === "disjointWith") && 
        (predNs === NAMESPACES.RDFS || predNs === NAMESPACES.OWL)
      ) {
        let targetResource = resource;
        if (!targetResource) {
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
                  rangeIri = getAttr(someValuesFromEl, "resource", NAMESPACES.RDF) || getAbout(someValuesFromEl);
                  type = "owl:someValuesFrom";
                } else if (allValuesFromEl) {
                  rangeIri = getAttr(allValuesFromEl, "resource", NAMESPACES.RDF) || getAbout(allValuesFromEl);
                  type = "owl:allValuesFrom";
                } else if (hasValueEl) {
                  rangeIri = getAttr(hasValueEl, "resource", NAMESPACES.RDF) || getAbout(hasValueEl);
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
              targetResource = null;
            } else {
              const activeBaseNested = getActiveBaseUri(nestedEl);
              const about = getAbout(nestedEl);
              if (about) {
                targetResource = resolver.resolve(about, activeBaseNested);
              } else {
                const unionOfEl = findImmediateChildren(nestedEl, "unionOf")[0];
                if (unionOfEl) {
                  const memberIris = [];
                  const allChildren = unionOfEl.getElementsByTagName ? unionOfEl.getElementsByTagName("*") : [];
                  for (let j = 0; j < allChildren.length; j++) {
                    const descAbout = getAbout(allChildren[j]) || getAttr(allChildren[j], "resource", NAMESPACES.RDF);
                    if (descAbout) {
                      const activeBaseChild = getActiveBaseUri(allChildren[j]);
                      memberIris.push(resolver.resolve(descAbout, activeBaseChild));
                    }
                  }
                  
                  if (memberIris.length > 0) {
                    const unionCls = ensureClassExists(null, "owl:unionOf");
                    unionCls.attributes.push("union");
                    unionCls.unionMembers = memberIris;
                    targetResource = unionCls.id;
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
          } else if (predLocal === "equivalentProperty") {
            subject.equivalentProperties.push(targetResource);
          } else if (predLocal === "disjointWith") {
            subject.disjointWith.push(targetResource);
          }
        }
      } else {
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

      for (let objectEl = pred.firstChild; objectEl; objectEl = objectEl.nextSibling) {
        if (objectEl.nodeType === 1) {
          parseSubject(objectEl);
        }
      }
    }
  }

  const rootChildren = rootEl ? rootEl.childNodes : [];
  for (let i = 0; i < rootChildren.length; i++) {
    if (rootChildren[i].nodeType === 1) {
      parseSubject(rootChildren[i]);
    }
  }

  return { prefixList, ontologyBaseIri, subjects, languagesSet };
}
