import { DOMParser } from "@xmldom/xmldom";
import { NAMESPACES } from "./constants.js";
import { getAttr, getAbout } from "./domUtils.js";

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
  let anonCount = 0;

  function getActiveBaseUri(element) {
    let current = element;
    while (current) {
      if (current.getAttribute) {
        const base = current.getAttribute("xml:base") || current.getAttribute("base");
        if (base) {return base;}
      }
      current = current.parentNode;
    }
    return ontologyBaseIri;
  }

  function getActiveLanguage(element) {
    let current = element;
    while (current) {
      if (current.getAttribute) {
        const lang = current.getAttribute("xml:lang") || current.getAttributeNS("http://www.w3.org/XML/1998/namespace", "lang") || current.getAttribute("lang");
        if (lang) {return lang;}
      }
      current = current.parentNode;
    }
    return "undefined";
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
    if (!iri) {return false;}
    if (iri === "http://www.w3.org/2000/01/rdf-schema#Literal") {return false;}
    if (iri.startsWith("http://www.w3.org/2001/XMLSchema#")) {return true;}
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
    if (isAnonymous) {attributes.push("anonymous");}
    if (type === "rdfs:Datatype") {attributes.push("datatype");}

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

  function findEquivalentClassExpression(type, data) {
    if (type === "owl:complementOf") {
      for (const [, cls] of context.classMap.entries()) {
        if (cls.type === "owl:complementOf" && cls.complementMember === data) {
          return cls;
        }
      }
      return null;
    }

    const sortedMembers = [...data].sort();
    const sortedMembersStr = JSON.stringify(sortedMembers);

    for (const [, cls] of context.classMap.entries()) {
      if (cls.type === type) {
        let clsMembers = null;
        if (type === "owl:unionOf") {clsMembers = cls.unionMembers;}
        else if (type === "owl:intersectionOf") {clsMembers = cls.intersectionMembers;}
        else if (type === "owl:disjointUnionOf") {clsMembers = cls.disjointUnionMembers;}
        else if (type === "owl:oneOf") {clsMembers = cls.oneOfMembers;}

        if (clsMembers) {
          const clsSorted = [...clsMembers].sort();
          if (JSON.stringify(clsSorted) === sortedMembersStr) {
            return cls;
          }
        }
      }
    }
    return null;
  }



  function parseSubject(element) {
    const rawAbout = getAbout(element);
    const nodeId = element.getAttribute("rdf:nodeID") || element.getAttribute("nodeID");
    
    let subjectIri;
    if (rawAbout) {
      subjectIri = resolver.resolve(rawAbout, getActiveBaseUri(element));
    } else if (nodeId) {
      subjectIri = nodeId.startsWith("_:") ? nodeId : "_:" + nodeId;
    } else {
      subjectIri = "_:anon_" + (++anonCount);
    }

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
      } else if (localName === "Restriction") {
        subject.types.add(NAMESPACES.OWL + "Restriction");
      } else if (element.namespaceURI) {
        subject.types.add(element.namespaceURI + localName);
      }
    }

    function addSubjectProperty(subj, predLocal, predNs, resource, textValue, lang, QName) {
      if (predLocal === "type" && (predNs === NAMESPACES.RDF || QName === "rdf:type" || QName === "type")) {
        if (resource) { subj.types.add(resource); }
      } else if (predLocal === "label" && (predNs === NAMESPACES.RDFS || QName === "rdfs:label" || QName === "label")) {
        const cleanLang = registerLanguage(lang);
        const labelVal = textValue;
        if (labelVal) {
          subj.labels[cleanLang] = labelVal;
          if (cleanLang.includes("-")) {
            const baseLang = cleanLang.split("-")[0];
            if (!subj.labels[baseLang]) { subj.labels[baseLang] = labelVal; }
          }
          if (!subj.annotations["label"]) { subj.annotations["label"] = []; }
          subj.annotations["label"].push({
            value: labelVal,
            type: "label",
            language: cleanLang,
            identifier: "rdfs:label",
            predicateNs: predNs || NAMESPACES.RDFS
          });
        }
      } else if (
        (predLocal === "comment" && (predNs === NAMESPACES.RDFS || predNs === NAMESPACES.OWL || QName === "rdfs:comment" || QName === "owl:comment")) ||
        (predLocal === "description" && (predNs === NAMESPACES.DCTERMS || predNs === NAMESPACES.DC || QName === "dc:description" || QName === "dcterms:description"))
      ) {
        const cleanLang = registerLanguage(lang);
        const commentVal = textValue;
        if (commentVal) {
          subj.comments[cleanLang] = commentVal;
          if (cleanLang.includes("-")) {
            const baseLang = cleanLang.split("-")[0];
            if (!subj.comments[baseLang]) { subj.comments[baseLang] = commentVal; }
          }
        }
      } else {
        const cleanLang = registerLanguage(lang);
        const key = predLocal;
        const val = resource || textValue;
        if (val) {
          if (!subj.annotations[key]) { subj.annotations[key] = []; }
          subj.annotations[key].push({
            value: val,
            type: resource || (val && (val.startsWith("http://") || val.startsWith("https://"))) ? "iri" : "label",
            language: cleanLang,
            identifier: key,
            predicateNs: predNs || ""
          });
          if (cleanLang.includes("-")) {
            const baseLang = cleanLang.split("-")[0];
            const hasBase = subj.annotations[key].some(ann => ann.language === baseLang);
            if (!hasBase) {
              subj.annotations[key].push({
                value: val,
                type: resource ? "iri" : "label",
                language: baseLang,
                identifier: key,
                predicateNs: predNs || ""
              });
            }
          }
        }
      }
    }

    // Process property attributes directly defined on the subject element
    if (element.attributes) {
      const SYSTEM_ATTRS = new Set(["about", "nodeid", "id", "parsetype", "base", "lang"]);
      for (let i = 0; i < element.attributes.length; i++) {
        const attr = element.attributes[i];
        const attrName = attr.name;
        if (attrName.startsWith("xmlns:") || attrName === "xmlns" || attrName === "xml:base" || attrName === "xml:lang") {continue;}
        
        const local = attr.localName || attrName.split(":").pop();
        if (SYSTEM_ATTRS.has(local.toLowerCase())) {continue;}

        let attrNs = attr.namespaceURI || "";
        if (!attrNs && attrName.includes(":")) {
          const prefix = attrName.split(":")[0];
          attrNs = prefixList[prefix] || "";
        }

        const attrVal = attr.value.trim();
        if (!attrVal) {continue;}

        const isResource = (local === "type" || local === "domain" || local === "range" || local === "subClassOf" || local === "subPropertyOf" || local === "inverseOf" || local === "isDefinedBy" || local === "seeAlso" || attrVal.startsWith("http://") || attrVal.startsWith("https://"));
        const activeBase = getActiveBaseUri(element);
        const resource = isResource ? (attrVal.startsWith("_:") || (!attrVal.includes(":") && !attrVal.startsWith("#")) ? (attrVal.startsWith("_:") ? attrVal : "_:" + attrVal) : resolver.resolve(attrVal, activeBase)) : null;

        addSubjectProperty(subject, local, attrNs, resource, isResource ? null : attrVal, getActiveLanguage(element), attrName);
      }
    }

    for (let pred = element.firstChild; pred; pred = pred.nextSibling) {
      if (pred.nodeType !== 1) {continue;}

      const predLocal = pred.localName;
      const predNs = pred.namespaceURI;
      const activeBasePred = getActiveBaseUri(pred);
      const rawResource = getAttr(pred, "resource", NAMESPACES.RDF) || getAttr(pred, "nodeID", NAMESPACES.RDF);
      const resource = rawResource ? (rawResource.startsWith("_:") || (!rawResource.includes(":") && !rawResource.startsWith("#")) ? (rawResource.startsWith("_:") ? rawResource : "_:" + rawResource) : resolver.resolve(rawResource, activeBasePred)) : null;
      const rawLang = getActiveLanguage(pred);
      const predText = pred.textContent.trim();

      if (predLocal === "type" && predNs === NAMESPACES.RDF) {
        addSubjectProperty(subject, predLocal, predNs, resource, predText, rawLang, predLocal);
      } else if (predLocal === "label" && predNs === NAMESPACES.RDFS) {
        addSubjectProperty(subject, predLocal, predNs, resource, predText, rawLang, predLocal);
      } else if (
        (predLocal === "comment" && predNs === NAMESPACES.RDFS) ||
        (predLocal === "comment" && predNs === NAMESPACES.OWL) ||
        (predLocal === "description" && (predNs === NAMESPACES.DCTERMS || predNs === NAMESPACES.DC))
      ) {
        addSubjectProperty(subject, predLocal, predNs, resource, predText, rawLang, predLocal);
      } else if (
        (predLocal === "domain" || predLocal === "range" || predLocal === "subClassOf" || 
         predLocal === "subPropertyOf" || predLocal === "inverseOf" || 
         predLocal === "equivalentClass" || predLocal === "equivalentProperty" || predLocal === "disjointWith") && 
        (predNs === NAMESPACES.RDFS || predNs === NAMESPACES.OWL)
      ) {
        let targetResource = resource;
        let nestedEl = null;
        for (let childNode = pred.firstChild; childNode; childNode = childNode.nextSibling) {
          if (childNode.nodeType === 1) {
            nestedEl = childNode;
            break;
          }
        }

        if (nestedEl) {
          const nestedAbout = getAbout(nestedEl);

          let logicalEl = null;
          let exprType = null;
          let attrName = null;
          let propName = null;

          const tags = [
            { tag: "unionOf", type: "owl:unionOf", attr: "union", prop: "unionMembers" },
            { tag: "intersectionOf", type: "owl:intersectionOf", attr: "intersection", prop: "intersectionMembers" },
            { tag: "disjointUnionOf", type: "owl:disjointUnionOf", attr: "disjointUnion", prop: "disjointUnionMembers" },
            { tag: "oneOf", type: "owl:oneOf", attr: "oneOf", prop: "oneOfMembers" },
            { tag: "complementOf", type: "owl:complementOf", attr: "complement", prop: "complementMember" }
          ];

          for (const item of tags) {
            const el = nestedEl.getElementsByTagName ? (nestedEl.getElementsByTagName(item.tag)[0] || nestedEl.getElementsByTagName("owl:" + item.tag)[0]) : null;
            if (el) {
              logicalEl = el;
              exprType = item.type;
              attrName = item.attr;
              propName = item.prop;
              break;
            }
          }

          if (logicalEl && !nestedAbout) {
            let dataValue = null;
            if (exprType === "owl:complementOf") {
              const rawRes = getAttr(logicalEl, "resource", NAMESPACES.RDF) || getAbout(logicalEl);
              if (rawRes) {
                dataValue = resolver.resolve(rawRes, getActiveBaseUri(logicalEl));
              } else {
                let firstChild = null;
                for (let childNode = logicalEl.firstChild; childNode; childNode = childNode.nextSibling) {
                  if (childNode.nodeType === 1) { firstChild = childNode; break; }
                }
                if (firstChild) {
                  const rawResChild = getAttr(firstChild, "resource", NAMESPACES.RDF) || getAbout(firstChild);
                  if (rawResChild) {
                    dataValue = resolver.resolve(rawResChild, getActiveBaseUri(firstChild));
                  }
                }
              }
            } else {
              const memberIris = [];
              const isCollection =
                logicalEl.getAttributeNS("http://www.w3.org/1999/02/22-rdf-syntax-ns#", "parseType") === "Collection" ||
                logicalEl.getAttribute("rdf:parseType") === "Collection";
              if (isCollection) {
                for (let child = logicalEl.firstChild; child; child = child.nextSibling) {
                  if (child.nodeType !== 1) {continue;}
                  const childAbout = getAbout(child) || getAttr(child, "resource", NAMESPACES.RDF);
                  const childNodeId = child.getAttribute("rdf:nodeID") || child.getAttribute("nodeID");
                  if (childAbout) {
                    memberIris.push(resolver.resolve(childAbout, getActiveBaseUri(child)));
                  } else if (childNodeId) {
                    memberIris.push(childNodeId.startsWith("_:") ? childNodeId : "_:" + childNodeId);
                  } else {
                    memberIris.push("_:anon_" + (anonCount + 1));
                  }
                  parseSubject(child);
                }
              } else {
                const allChildren = logicalEl.getElementsByTagName ? logicalEl.getElementsByTagName("*") : [];
                for (let j = 0; j < allChildren.length; j++) {
                  const descAbout = getAbout(allChildren[j]) || getAttr(allChildren[j], "resource", NAMESPACES.RDF);
                  if (descAbout) {
                    memberIris.push(resolver.resolve(descAbout, getActiveBaseUri(allChildren[j])));
                  }
                }
              }
              dataValue = memberIris;
            }

            if (dataValue !== null && (exprType !== "owl:complementOf" || typeof dataValue === "string")) {
              const existingExpr = findEquivalentClassExpression(exprType, dataValue);
              if (existingExpr) {
                targetResource = existingExpr.iri || existingExpr.id;
              } else {
                targetResource = parseSubject(nestedEl);
                const cls = ensureClassExists(targetResource, exprType);
                cls.attributes.push(attrName);
                cls[propName] = dataValue;
              }
            } else {
              targetResource = parseSubject(nestedEl);
            }
          } else {
            targetResource = parseSubject(nestedEl);
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
          } else {
            if (!subject.annotations[predLocal]) {
              subject.annotations[predLocal] = [];
            }
            subject.annotations[predLocal].push({
              value: targetResource,
              type: "iri",
              language: "undefined",
              identifier: predLocal,
              predicateNs: predNs || ""
            });
          }
        }
      } else if (
        (predLocal === "unionOf" || predLocal === "intersectionOf" || predLocal === "complementOf" || predLocal === "disjointUnionOf" || predLocal === "hasKey") &&
        (predNs === NAMESPACES.OWL || predNs === "http://www.w3.org/2002/07/owl#")
      ) {
        if (predLocal === "complementOf") {
          let nestedEl = null;
          for (let childNode = pred.firstChild; childNode; childNode = childNode.nextSibling) {
            if (childNode.nodeType === 1) { nestedEl = childNode; break; }
          }
          const target = resource || (nestedEl ? (getAbout(nestedEl) || getAttr(nestedEl, "resource", NAMESPACES.RDF)) : null);
          if (target) {
            subject.complementOf = resolver.resolve(target, activeBasePred);
          }
        } else if (predLocal === "hasKey") {
          const keys = [];
          const allChildren = pred.getElementsByTagName ? pred.getElementsByTagName("*") : [];
          for (let j = 0; j < allChildren.length; j++) {
            const about = getAbout(allChildren[j]) || getAttr(allChildren[j], "resource", NAMESPACES.RDF);
            if (about) {
              const activeBaseChild = getActiveBaseUri(allChildren[j]);
              keys.push(resolver.resolve(about, activeBaseChild));
            }
          }
          if (keys.length > 0) {
            subject.hasKeys = keys;
          }
        } else {
          const members = [];
          const isCollection = pred.getAttributeNS("http://www.w3.org/1999/02/22-rdf-syntax-ns#", "parseType") === "Collection" || 
                               pred.getAttribute("rdf:parseType") === "Collection";
          if (isCollection) {
            for (let child = pred.firstChild; child; child = child.nextSibling) {
              if (child.nodeType === 1) {
                const childAbout = getAbout(child) || getAttr(child, "resource", NAMESPACES.RDF);
                const childNodeId = child.getAttribute("rdf:nodeID") || child.getAttribute("nodeID");
                let memberIri;
                if (childAbout) {
                  memberIri = resolver.resolve(childAbout, getActiveBaseUri(child));
                } else if (childNodeId) {
                  memberIri = childNodeId.startsWith("_:") ? childNodeId : "_:" + childNodeId;
                } else {
                  memberIri = "_:anon_" + (anonCount + 1);
                }
                
                parseSubject(child);
                members.push(memberIri);
              }
            }
          } else {
            for (let child = pred.firstChild; child; child = child.nextSibling) {
              if (child.nodeType === 1) {
                parseSubject(child);
              }
            }
            const allChildren = pred.getElementsByTagName ? pred.getElementsByTagName("*") : [];
            for (let j = 0; j < allChildren.length; j++) {
              const about = getAbout(allChildren[j]) || getAttr(allChildren[j], "resource", NAMESPACES.RDF);
              if (about) {
                const activeBaseChild = getActiveBaseUri(allChildren[j]);
                members.push(resolver.resolve(about, activeBaseChild));
              }
            }
          }
          if (members.length > 0) {
            if (predLocal === "unionOf") {subject.unionOf = members;}
            else if (predLocal === "intersectionOf") {subject.intersectionOf = members;}
            else if (predLocal === "disjointUnionOf") {subject.disjointUnionOf = members;}
          }
        }
      } else {
        const rawLang = pred.getAttribute("xml:lang") || pred.getAttributeNS("http://www.w3.org/XML/1998/namespace", "lang") || "undefined";
        const lang = registerLanguage(rawLang);
        const key = predLocal;
        let val = resource || pred.textContent.trim();

        // If no value resolved but a nested element is present (e.g. <owl:onProperty><owl:DatatypeProperty rdf:about="..."/></owl:onProperty>)
        // resolve the nested element's IRI as the predicate value
        if (!val) {
          for (let childNode = pred.firstChild; childNode; childNode = childNode.nextSibling) {
            if (childNode.nodeType === 1) {
              const childAbout = getAbout(childNode);
              if (childAbout) {
                val = resolver.resolve(childAbout, getActiveBaseUri(childNode));
              }
              break;
            }
          }
        }
        
        if (!subject.annotations[key]) {subject.annotations[key] = [];}
        subject.annotations[key].push({
          value: val,
          type: resource || (val && val.startsWith("http")) ? "iri" : "label",
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

      const isManuallyParsed = 
        (predLocal === "domain" || predLocal === "range" || predLocal === "subClassOf" || 
         predLocal === "subPropertyOf" || predLocal === "inverseOf" || 
         predLocal === "equivalentClass" || predLocal === "equivalentProperty" || predLocal === "disjointWith" ||
         predLocal === "unionOf" || predLocal === "intersectionOf" || predLocal === "disjointUnionOf") && 
        (predNs === NAMESPACES.RDFS || predNs === NAMESPACES.OWL);

      if (!isManuallyParsed) {
        for (let objectEl = pred.firstChild; objectEl; objectEl = objectEl.nextSibling) {
          if (objectEl.nodeType === 1) {
            parseSubject(objectEl);
          }
        }
      }
    }
    return subjectIri;
  }

  const rootChildren = rootEl ? rootEl.childNodes : [];
  for (let i = 0; i < rootChildren.length; i++) {
    if (rootChildren[i].nodeType === 1) {
      parseSubject(rootChildren[i]);
    }
  }

  // Centralized post-processing of parsed subjects to extract restrictions & cardinalities
  for (const subjectIri of Object.keys(subjects)) {
    const subject = subjects[subjectIri];
    const isRestriction = subject.types.has(NAMESPACES.OWL + "Restriction") ||
      subject.annotations["onProperty"] !== undefined;

    if (isRestriction) {
      const onPropAnn = subject.annotations["onProperty"];
      const onProperty = onPropAnn && onPropAnn[0] ? onPropAnn[0].value : null;

      if (onProperty) {
        let domainIri = null;

        // Direction 1: restriction rdfs:subClassOf Class
        if (subject.superClasses && subject.superClasses.length > 0) {
          domainIri = subject.superClasses.find(c => !c.startsWith("_:"));
        }

        // Direction 2: Class rdfs:subClassOf restriction
        if (!domainIri) {
          for (const otherIri of Object.keys(subjects)) {
            const other = subjects[otherIri];
            if (other.superClasses && other.superClasses.includes(subjectIri)) {
              domainIri = otherIri;
              break;
            }
          }
        }

        // Direction 3: Class owl:equivalentClass restriction
        if (!domainIri) {
          for (const otherIri of Object.keys(subjects)) {
            const other = subjects[otherIri];
            if (other.equivalentClasses && other.equivalentClasses.includes(subjectIri)) {
              domainIri = otherIri;
              break;
            }
          }
        }

        if (domainIri) {
          // Range-based restriction extraction
          let rangeIri = null;
          let type = null;

          if (subject.annotations["someValuesFrom"]) {
            rangeIri = subject.annotations["someValuesFrom"][0].value;
            type = "owl:someValuesFrom";
          } else if (subject.annotations["allValuesFrom"]) {
            rangeIri = subject.annotations["allValuesFrom"][0].value;
            type = "owl:allValuesFrom";
          } else if (subject.annotations["hasValue"]) {
            rangeIri = subject.annotations["hasValue"][0].value;
            type = "owl:hasValue";
          }

          if (rangeIri && type) {
            context.parsedRestrictions.push({
              domainIri: domainIri,
              propertyIri: onProperty,
              rangeIri: rangeIri,
              type: type
            });
          }

          // Cardinality extraction
          let minCardVal = null;
          let maxCardVal = null;
          let cardVal = null;

          const minAnn = subject.annotations["minQualifiedCardinality"] || subject.annotations["minCardinality"];
          const maxAnn = subject.annotations["maxQualifiedCardinality"] || subject.annotations["maxCardinality"];
          const cardAnn = subject.annotations["qualifiedCardinality"] || subject.annotations["cardinality"];

          if (minAnn && minAnn[0]) {minCardVal = minAnn[0].value;}
          if (maxAnn && maxAnn[0]) {maxCardVal = maxAnn[0].value;}
          if (cardAnn && cardAnn[0]) {cardVal = cardAnn[0].value;}

          if (minCardVal || maxCardVal || cardVal) {
            context.parsedCardinalities.push({
              propertyIri: onProperty,
              minCardinality: minCardVal,
              maxCardinality: maxCardVal,
              cardinality: cardVal
            });
          }
        }
      }
    }
  }

  return { prefixList, ontologyBaseIri, subjects, languagesSet };
}
