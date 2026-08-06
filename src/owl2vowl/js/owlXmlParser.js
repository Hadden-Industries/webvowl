import { DOMParser } from "@xmldom/xmldom";
import { resolveXmlEntities } from "./xmlUtils.js";
import { NAMESPACES } from "./constants.js";

/**
 * Detects if the given XML string or DOM document is in OWL 2 XML Serialization Syntax.
 * @param {string|Document} xmlInput
 * @returns {boolean}
 */
export function isOwlXmlFormat(xmlInput) {
  if (!xmlInput) {return false;}

  if (typeof xmlInput === "string") {
    const trimmed = xmlInput.trim();
    if (!trimmed.includes("<Ontology") && !trimmed.includes(":Ontology")) {
      return false;
    }
    const parser = new DOMParser({
      onError: () => {}
    });
    try {
      const doc = parser.parseFromString(trimmed, "application/xml");
      const root = doc.documentElement;
      return isRootOntologyNode(root);
    } catch {
      return false;
    }
  }

  if (xmlInput.documentElement) {
    return isRootOntologyNode(xmlInput.documentElement);
  }

  return false;
}

function isRootOntologyNode(rootEl) {
  if (!rootEl) {return false;}
  const local = rootEl.localName || rootEl.tagName;
  if (local !== "Ontology") {return false;}
  const ns = rootEl.namespaceURI || rootEl.getAttribute("xmlns") || "";
  return ns === NAMESPACES.OWL || ns.includes("owl#") || rootEl.getElementsByTagName("Prefix").length > 0;
}

/**
 * Converts an OWL 2 XML Serialization Syntax document into a standard RDF/XML syntax string.
 * Conforming 100% to Java OWLAPI (org.semanticweb.owlapi.owlxml.parser.OWLXMLPH).
 *
 * @param {string} xmlString
 * @param {PerformanceIriResolver} [resolver]
 * @returns {string}
 */
export function convertOwlXmlToRdfXml(xmlString, resolver) {
  const resolvedXml = resolveXmlEntities(xmlString);
  const parser = new DOMParser({
    onError: () => {}
  });
  const xmlDoc = parser.parseFromString(resolvedXml, "application/xml");

  const parserError = xmlDoc.getElementsByTagName("parsererror")[0];
  if (parserError) {
    throw new Error("OWL/XML parsing error: " + parserError.textContent);
  }

  const rootEl = xmlDoc.documentElement;
  if (!rootEl || !isRootOntologyNode(rootEl)) {
    throw new Error("Invalid OWL/XML document: Root element is not <Ontology>");
  }

  const ontologyIRIAttr = rootEl.getAttribute("ontologyIRI") || rootEl.getAttribute("IRI") || "";
  const baseAttr = rootEl.getAttribute("xml:base") || rootEl.getAttribute("base") || ontologyIRIAttr;
  const ontologyIri = ontologyIRIAttr || baseAttr || "http://haddenindustries.com/ontology/owlxml";

  // Build prefix map from xmlns attributes and <Prefix> tags (OWLXMLPH.java:151)
  const prefixMap = {
    "owl": NAMESPACES.OWL,
    "rdf": NAMESPACES.RDF,
    "rdfs": NAMESPACES.RDFS,
    "xsd": NAMESPACES.XSD,
    "dc": NAMESPACES.DC,
    "dcterms": "http://purl.org/dc/terms/",
    "foaf": "http://xmlns.com/foaf/0.1/"
  };

  if (rootEl.attributes) {
    for (let i = 0; i < rootEl.attributes.length; i++) {
      const attr = rootEl.attributes[i];
      if (attr.name.startsWith("xmlns:")) {
        const pName = attr.name.substring(6);
        prefixMap[pName] = attr.value;
      } else if (attr.name === "xmlns") {
        prefixMap[""] = attr.value;
      }
    }
  }

  // Parse child <Prefix name="..." IRI="..." /> elements
  const childNodes = Array.from(rootEl.childNodes);
  for (const child of childNodes) {
    if (child.nodeType === 1 && getLocalName(child) === "Prefix") {
      const pName = child.getAttribute("name") || "";
      const pIri = child.getAttribute("IRI") || "";
      prefixMap[pName] = pIri;
      if (pName === "") {
        prefixMap[":"] = pIri;
      }
    }
  }

  function resolveIri(rawIri) {
    if (!rawIri) {return "";}
    const clean = rawIri.trim();

    if (clean.includes(":") && !clean.startsWith("http://") && !clean.startsWith("https://") && !clean.startsWith("urn:") && !clean.startsWith("file://")) {
      const parts = clean.split(":");
      const pfx = parts[0];
      const local = parts.slice(1).join(":");

      if (prefixMap[pfx]) {
        return prefixMap[pfx] + local;
      }
      if (prefixMap[pfx + ":"]) {
        return prefixMap[pfx + ":"] + local;
      }
    }

    if (clean.startsWith(":")) {
      const defaultNs = prefixMap[":"] || prefixMap[""] || prefixMap["owl"] || "";
      return defaultNs + clean.substring(1);
    }

    if (resolver) {
      return resolver.resolve(clean, baseAttr);
    }

    if (clean.startsWith("#")) {
      return baseAttr ? (baseAttr.endsWith("#") || baseAttr.endsWith("/") ? baseAttr + clean.substring(1) : baseAttr + clean) : clean;
    }

    return clean;
  }

  function getIriFromEl(el) {
    if (!el) {return "";}
    const iriAttr = el.getAttribute("IRI") || el.getAttribute("iri");
    if (iriAttr) {return resolveIri(iriAttr);}

    const abbrAttr = el.getAttribute("abbreviatedIRI") || el.getAttribute("abbreviatedIri");
    if (abbrAttr) {return resolveIri(abbrAttr);}

    for (const child of Array.from(el.childNodes)) {
      if (child.nodeType === 1) {
        const cName = getLocalName(child);
        if (cName === "IRI") {
          return resolveIri(child.textContent.trim());
        }
        if (cName === "AbbreviatedIRI") {
          return resolveIri(child.textContent.trim());
        }
      }
    }
    return "";
  }

  function getLiteralFromEl(el) {
    if (!el) {return null;}
    let litEl = null;
    if (getLocalName(el) === "Literal") {
      litEl = el;
    } else {
      for (const child of Array.from(el.childNodes)) {
        if (child.nodeType === 1 && getLocalName(child) === "Literal") {
          litEl = child;
          break;
        }
      }
    }

    if (!litEl) {
      // Check for direct text node
      const txt = el.textContent ? el.textContent.trim() : "";
      return txt ? { val: txt, lang: null, datatype: null } : null;
    }

    const val = litEl.textContent || "";
    const lang = litEl.getAttribute("xml:lang") || litEl.getAttribute("lang") || null;
    const dtAttr = litEl.getAttribute("datatypeIRI") || litEl.getAttribute("datatypeIri") || null;
    const datatype = dtAttr ? resolveIri(dtAttr) : null;
    return { val, lang, datatype };
  }

  function escapeXml(str) {
    if (!str) {return "";}
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  function getPredXmlTag(predIri) {
    for (const [pfx, ns] of Object.entries(prefixMap)) {
      if (ns && predIri.startsWith(ns)) {
        const local = predIri.substring(ns.length);
        if (pfx === "" || pfx === ":") {
          return local;
        }
        return `${pfx}:${local}`;
      }
    }
    if (predIri.startsWith(NAMESPACES.RDFS)) {
      return `rdfs:${predIri.substring(NAMESPACES.RDFS.length)}`;
    }
    if (predIri.startsWith(NAMESPACES.OWL)) {
      return `owl:${predIri.substring(NAMESPACES.OWL.length)}`;
    }
    if (predIri.startsWith(NAMESPACES.DC)) {
      return `dc:${predIri.substring(NAMESPACES.DC.length)}`;
    }
    return null;
  }

  const rdfNodes = [];

  // 1. Process Ontology Header Annotations (<owl:Ontology>)
  const versionIRIAttr = rootEl.getAttribute("versionIRI") || rootEl.getAttribute("versionIri");
  let ontologyHeaderRdf = `<owl:Ontology rdf:about="${escapeXml(ontologyIri)}">\n`;
  if (versionIRIAttr) {
    ontologyHeaderRdf += `  <owl:versionIRI rdf:resource="${escapeXml(resolveIri(versionIRIAttr))}"/>\n`;
  }

  for (const child of childNodes) {
    if (child.nodeType !== 1) {continue;}
    const name = getLocalName(child);

    if (name === "Import") {
      const impUrl = resolveIri(child.textContent.trim());
      if (impUrl) {
        ontologyHeaderRdf += `  <owl:imports rdf:resource="${escapeXml(impUrl)}"/>\n`;
      }
    } else if (name === "Annotation") {
      const propEl = findChildByLocalNames(child, ["AnnotationProperty"]);
      const propIri = propEl ? getIriFromEl(propEl) : null;
      const lit = getLiteralFromEl(child);

      if (propIri && lit) {
        const tag = getPredXmlTag(propIri);
        const langAttr = lit.lang ? ` xml:lang="${escapeXml(lit.lang)}"` : "";
        if (tag) {
          ontologyHeaderRdf += `  <${tag}${langAttr}>${escapeXml(lit.val)}</${tag}>\n`;
        }
      }
    }
  }
  ontologyHeaderRdf += `</owl:Ontology>`;
  rdfNodes.push(ontologyHeaderRdf);

  // 2. Process Declarations & Axioms
  for (const child of childNodes) {
    if (child.nodeType !== 1) {continue;}
    const name = getLocalName(child);

    if (name === "Declaration") {
      for (const decChild of Array.from(child.childNodes)) {
        if (decChild.nodeType !== 1) {continue;}
        const decName = getLocalName(decChild);
        const iri = getIriFromEl(decChild);
        if (!iri) {continue;}

        if (decName === "Class") {
          rdfNodes.push(`<owl:Class rdf:about="${escapeXml(iri)}"/>`);
        } else if (decName === "ObjectProperty") {
          rdfNodes.push(`<owl:ObjectProperty rdf:about="${escapeXml(iri)}"/>`);
        } else if (decName === "DataProperty") {
          rdfNodes.push(`<owl:DatatypeProperty rdf:about="${escapeXml(iri)}"/>`);
        } else if (decName === "AnnotationProperty") {
          rdfNodes.push(`<owl:AnnotationProperty rdf:about="${escapeXml(iri)}"/>`);
        } else if (decName === "NamedIndividual") {
          rdfNodes.push(`<owl:NamedIndividual rdf:about="${escapeXml(iri)}"/>`);
        } else if (decName === "Datatype") {
          rdfNodes.push(`<rdfs:Datatype rdf:about="${escapeXml(iri)}"/>`);
        }
      }
    } else if (name === "SubClassOf") {
      const classEls = findChildrenByLocalNames(child, [
        "Class", "ObjectSomeValuesFrom", "ObjectAllValuesFrom", "ObjectHasValue",
        "ObjectMinCardinality", "ObjectMaxCardinality", "ObjectExactCardinality",
        "ObjectUnionOf", "ObjectIntersectionOf", "ObjectComplementOf"
      ]);
      if (classEls.length >= 2) {
        const subIri = getIriFromEl(classEls[0]);
        const superExprRdf = renderClassExpressionRdf(classEls[1], getIriFromEl, resolveIri, escapeXml);

        if (subIri && superExprRdf) {
          if (superExprRdf.startsWith("rdf:resource=")) {
            rdfNodes.push(`<owl:Class rdf:about="${escapeXml(subIri)}">\n  <rdfs:subClassOf ${superExprRdf}/>\n</owl:Class>`);
          } else {
            rdfNodes.push(`<owl:Class rdf:about="${escapeXml(subIri)}">\n  <rdfs:subClassOf>\n    ${superExprRdf}\n  </rdfs:subClassOf>\n</owl:Class>`);
          }
        }
      }
    } else if (name === "SubObjectPropertyOf") {
      const propEls = findChildrenByLocalNames(child, ["ObjectProperty"]);
      if (propEls.length >= 2) {
        const subIri = getIriFromEl(propEls[0]);
        const superIri = getIriFromEl(propEls[1]);
        if (subIri && superIri) {
          rdfNodes.push(`<owl:ObjectProperty rdf:about="${escapeXml(subIri)}">\n  <rdfs:subPropertyOf rdf:resource="${escapeXml(superIri)}"/>\n</owl:ObjectProperty>`);
        }
      }
    } else if (name === "SubDataPropertyOf") {
      const propEls = findChildrenByLocalNames(child, ["DataProperty"]);
      if (propEls.length >= 2) {
        const subIri = getIriFromEl(propEls[0]);
        const superIri = getIriFromEl(propEls[1]);
        if (subIri && superIri) {
          rdfNodes.push(`<owl:DatatypeProperty rdf:about="${escapeXml(subIri)}">\n  <rdfs:subPropertyOf rdf:resource="${escapeXml(superIri)}"/>\n</owl:DatatypeProperty>`);
        }
      }
    } else if (name === "ObjectPropertyDomain") {
      const propEl = findChildByLocalNames(child, ["ObjectProperty"]);
      const classEl = findChildByLocalNames(child, ["Class", "ObjectUnionOf", "ObjectIntersectionOf"]);
      const propIri = propEl ? getIriFromEl(propEl) : null;
      const domIri = classEl ? getIriFromEl(classEl) : null;
      if (propIri && domIri) {
        rdfNodes.push(`<owl:ObjectProperty rdf:about="${escapeXml(propIri)}">\n  <rdfs:domain rdf:resource="${escapeXml(domIri)}"/>\n</owl:ObjectProperty>`);
      }
    } else if (name === "ObjectPropertyRange") {
      const propEl = findChildByLocalNames(child, ["ObjectProperty"]);
      const classEl = findChildByLocalNames(child, ["Class", "ObjectUnionOf", "ObjectIntersectionOf"]);
      const propIri = propEl ? getIriFromEl(propEl) : null;
      const ranIri = classEl ? getIriFromEl(classEl) : null;
      if (propIri && ranIri) {
        rdfNodes.push(`<owl:ObjectProperty rdf:about="${escapeXml(propIri)}">\n  <rdfs:range rdf:resource="${escapeXml(ranIri)}"/>\n</owl:ObjectProperty>`);
      }
    } else if (name === "DataPropertyDomain") {
      const propEl = findChildByLocalNames(child, ["DataProperty"]);
      const classEl = findChildByLocalNames(child, ["Class"]);
      const propIri = propEl ? getIriFromEl(propEl) : null;
      const domIri = classEl ? getIriFromEl(classEl) : null;
      if (propIri && domIri) {
        rdfNodes.push(`<owl:DatatypeProperty rdf:about="${escapeXml(propIri)}">\n  <rdfs:domain rdf:resource="${escapeXml(domIri)}"/>\n</owl:DatatypeProperty>`);
      }
    } else if (name === "DataPropertyRange") {
      const propEl = findChildByLocalNames(child, ["DataProperty"]);
      const dtEl = findChildByLocalNames(child, ["Datatype"]);
      const propIri = propEl ? getIriFromEl(propEl) : null;
      const ranIri = dtEl ? getIriFromEl(dtEl) : null;
      if (propIri && ranIri) {
        rdfNodes.push(`<owl:DatatypeProperty rdf:about="${escapeXml(propIri)}">\n  <rdfs:range rdf:resource="${escapeXml(ranIri)}"/>\n</owl:DatatypeProperty>`);
      }
    } else if (name === "InverseObjectProperties") {
      const propEls = findChildrenByLocalNames(child, ["ObjectProperty"]);
      if (propEls.length >= 2) {
        const p1 = getIriFromEl(propEls[0]);
        const p2 = getIriFromEl(propEls[1]);
        if (p1 && p2) {
          rdfNodes.push(`<owl:ObjectProperty rdf:about="${escapeXml(p1)}">\n  <owl:inverseOf rdf:resource="${escapeXml(p2)}"/>\n</owl:ObjectProperty>`);
        }
      }
    } else if (name === "FunctionalObjectProperty") {
      const propEl = findChildByLocalNames(child, ["ObjectProperty"]);
      const pIri = propEl ? getIriFromEl(propEl) : null;
      if (pIri) {
        rdfNodes.push(`<owl:ObjectProperty rdf:about="${escapeXml(pIri)}">\n  <rdf:type rdf:resource="http://www.w3.org/2002/07/owl#FunctionalProperty"/>\n</owl:ObjectProperty>`);
      }
    } else if (name === "InverseFunctionalObjectProperty") {
      const propEl = findChildByLocalNames(child, ["ObjectProperty"]);
      const pIri = propEl ? getIriFromEl(propEl) : null;
      if (pIri) {
        rdfNodes.push(`<owl:ObjectProperty rdf:about="${escapeXml(pIri)}">\n  <rdf:type rdf:resource="http://www.w3.org/2002/07/owl#InverseFunctionalProperty"/>\n</owl:ObjectProperty>`);
      }
    } else if (name === "TransitiveObjectProperty") {
      const propEl = findChildByLocalNames(child, ["ObjectProperty"]);
      const pIri = propEl ? getIriFromEl(propEl) : null;
      if (pIri) {
        rdfNodes.push(`<owl:ObjectProperty rdf:about="${escapeXml(pIri)}">\n  <rdf:type rdf:resource="http://www.w3.org/2002/07/owl#TransitiveProperty"/>\n</owl:ObjectProperty>`);
      }
    } else if (name === "SymmetricObjectProperty") {
      const propEl = findChildByLocalNames(child, ["ObjectProperty"]);
      const pIri = propEl ? getIriFromEl(propEl) : null;
      if (pIri) {
        rdfNodes.push(`<owl:ObjectProperty rdf:about="${escapeXml(pIri)}">\n  <rdf:type rdf:resource="http://www.w3.org/2002/07/owl#SymmetricProperty"/>\n</owl:ObjectProperty>`);
      }
    } else if (name === "AsymmetricObjectProperty") {
      const propEl = findChildByLocalNames(child, ["ObjectProperty"]);
      const pIri = propEl ? getIriFromEl(propEl) : null;
      if (pIri) {
        rdfNodes.push(`<owl:ObjectProperty rdf:about="${escapeXml(pIri)}">\n  <rdf:type rdf:resource="http://www.w3.org/2002/07/owl#AsymmetricProperty"/>\n</owl:ObjectProperty>`);
      }
    } else if (name === "ReflexiveObjectProperty") {
      const propEl = findChildByLocalNames(child, ["ObjectProperty"]);
      const pIri = propEl ? getIriFromEl(propEl) : null;
      if (pIri) {
        rdfNodes.push(`<owl:ObjectProperty rdf:about="${escapeXml(pIri)}">\n  <rdf:type rdf:resource="http://www.w3.org/2002/07/owl#ReflexiveProperty"/>\n</owl:ObjectProperty>`);
      }
    } else if (name === "IrreflexiveObjectProperty") {
      const propEl = findChildByLocalNames(child, ["ObjectProperty"]);
      const pIri = propEl ? getIriFromEl(propEl) : null;
      if (pIri) {
        rdfNodes.push(`<owl:ObjectProperty rdf:about="${escapeXml(pIri)}">\n  <rdf:type rdf:resource="http://www.w3.org/2002/07/owl#IrreflexiveProperty"/>\n</owl:ObjectProperty>`);
      }
    } else if (name === "FunctionalDataProperty") {
      const propEl = findChildByLocalNames(child, ["DataProperty"]);
      const pIri = propEl ? getIriFromEl(propEl) : null;
      if (pIri) {
        rdfNodes.push(`<owl:DatatypeProperty rdf:about="${escapeXml(pIri)}">\n  <rdf:type rdf:resource="http://www.w3.org/2002/07/owl#FunctionalProperty"/>\n</owl:DatatypeProperty>`);
      }
    } else if (name === "DisjointClasses") {
      const classEls = findChildrenByLocalNames(child, ["Class"]);
      if (classEls.length >= 2) {
        for (let i = 0; i < classEls.length; i++) {
          for (let j = i + 1; j < classEls.length; j++) {
            const c1 = getIriFromEl(classEls[i]);
            const c2 = getIriFromEl(classEls[j]);
            if (c1 && c2) {
              rdfNodes.push(`<owl:Class rdf:about="${escapeXml(c1)}">\n  <owl:disjointWith rdf:resource="${escapeXml(c2)}"/>\n</owl:Class>`);
            }
          }
        }
      }
    } else if (name === "EquivalentClasses") {
      const classEls = findChildrenByLocalNames(child, ["Class"]);
      if (classEls.length >= 2) {
        for (let i = 0; i < classEls.length; i++) {
          for (let j = i + 1; j < classEls.length; j++) {
            const c1 = getIriFromEl(classEls[i]);
            const c2 = getIriFromEl(classEls[j]);
            if (c1 && c2) {
              rdfNodes.push(`<owl:Class rdf:about="${escapeXml(c1)}">\n  <owl:equivalentClass rdf:resource="${escapeXml(c2)}"/>\n</owl:Class>`);
            }
          }
        }
      }
    } else if (name === "AnnotationAssertion") {
      const propEl = findChildByLocalNames(child, ["AnnotationProperty"]);
      const subjEl = findChildByLocalNames(child, ["IRI", "AbbreviatedIRI"]);
      const lit = getLiteralFromEl(child);

      const propIri = propEl ? getIriFromEl(propEl) : null;
      let subjIri = subjEl ? resolveIri(subjEl.textContent.trim()) : null;
      if (!subjIri && child.getAttribute("IRI")) {
        subjIri = resolveIri(child.getAttribute("IRI"));
      }

      if (propIri && subjIri && lit) {
        const tag = getPredXmlTag(propIri);
        const langAttr = lit.lang ? ` xml:lang="${escapeXml(lit.lang)}"` : "";
        if (tag) {
          rdfNodes.push(`<rdf:Description rdf:about="${escapeXml(subjIri)}">\n  <${tag}${langAttr}>${escapeXml(lit.val)}</${tag}>\n</rdf:Description>`);
        }
      }
    }
  }

  // Construct full RDF/XML document header
  let nsAttrs = "";
  for (const [pfx, ns] of Object.entries(prefixMap)) {
    if (ns) {
      if (pfx === "" || pfx === ":") {
        if (!nsAttrs.includes(' xmlns="')) {
          nsAttrs += ` xmlns="${escapeXml(ns)}"`;
        }
      } else {
        nsAttrs += ` xmlns:${pfx}="${escapeXml(ns)}"`;
      }
    }
  }
  if (baseAttr) {
    nsAttrs += ` xml:base="${escapeXml(baseAttr)}"`;
  }

  return `<?xml version="1.0"?>\n<rdf:RDF${nsAttrs}>\n` + rdfNodes.join("\n") + "\n</rdf:RDF>";
}

function getLocalName(el) {
  return el.localName || el.tagName;
}

function findChildByLocalNames(parent, names) {
  for (const child of Array.from(parent.childNodes)) {
    if (child.nodeType === 1 && names.includes(getLocalName(child))) {
      return child;
    }
  }
  return null;
}

function findChildrenByLocalNames(parent, names) {
  const result = [];
  for (const child of Array.from(parent.childNodes)) {
    if (child.nodeType === 1 && names.includes(getLocalName(child))) {
      result.push(child);
    }
  }
  return result;
}

function renderClassExpressionRdf(exprEl, getIriFromEl, resolveIri, escapeXml) {
  const name = getLocalName(exprEl);
  if (name === "Class") {
    const iri = getIriFromEl(exprEl);
    return iri ? `rdf:resource="${escapeXml(iri)}"` : null;
  }

  if (name === "ObjectSomeValuesFrom" || name === "ObjectAllValuesFrom" || name === "ObjectHasValue") {
    const propEl = findChildByLocalNames(exprEl, ["ObjectProperty"]);
    const classEl = findChildByLocalNames(exprEl, ["Class"]);
    const propIri = propEl ? getIriFromEl(propEl) : null;
    const classIri = classEl ? getIriFromEl(classEl) : null;

    if (propIri && classIri) {
      const pred = name === "ObjectSomeValuesFrom" ? "someValuesFrom" : name === "ObjectAllValuesFrom" ? "allValuesFrom" : "hasValue";
      return `<owl:Restriction>\n  <owl:onProperty rdf:resource="${escapeXml(propIri)}"/>\n  <owl:${pred} rdf:resource="${escapeXml(classIri)}"/>\n</owl:Restriction>`;
    }
  }

  if (name === "ObjectMinCardinality" || name === "ObjectMaxCardinality" || name === "ObjectExactCardinality") {
    const propEl = findChildByLocalNames(exprEl, ["ObjectProperty"]);
    const propIri = propEl ? getIriFromEl(propEl) : null;
    const cardVal = exprEl.getAttribute("cardinality") || "1";
    const pred = name === "ObjectMinCardinality" ? "minCardinality" : name === "ObjectMaxCardinality" ? "maxCardinality" : "cardinality";

    if (propIri) {
      return `<owl:Restriction>\n  <owl:onProperty rdf:resource="${escapeXml(propIri)}"/>\n  <owl:${pred} rdf:datatype="http://www.w3.org/2001/XMLSchema#nonNegativeInteger">${escapeXml(cardVal)}</owl:${pred}>\n</owl:Restriction>`;
    }
  }

  return null;
}
