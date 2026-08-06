import { Parser } from "n3";
import { NAMESPACES } from "./constants.js";

function mapTerm(term) {
  if (term.termType === "NamedNode") {
    return { type: "URI", value: term.value };
  }
  if (term.termType === "BlankNode") {
    // Strip leading '_:' if present so blank node IDs conform to XML NCName (e.g. 'b1')
    const val = term.value.startsWith("_:") ? term.value.substring(2) : term.value;
    return { type: "BNODE", value: val };
  }
  if (term.termType === "Literal") {
    const mapped = { type: "LITERAL", value: term.value };
    if (term.language) {
      mapped.lang = term.language;
    } else if (term.datatype && 
               term.datatype.value !== "http://www.w3.org/2001/XMLSchema#string" && 
               term.datatype.value !== "http://www.w3.org/1999/02/22-rdf-syntax-ns#langString") {
      mapped.datatype = { type: "URI", value: term.datatype.value };
    }
    return mapped;
  }
  return { type: "URI", value: term.value };
}

/**
 * Parses Turtle string into triples, prefixes, and baseIri using N3.js.
 * Conforming to W3C Turtle and Java OWLAPI (org.semanticweb.owlapi.rdf.turtle).
 * @param {string} ttlString
 * @returns {object}
 */
export function parseTurtle(ttlString) {
  const parser = new Parser();
  const triples = [];

  const quads = parser.parse(ttlString);
  quads.forEach(quad => {
    const subj = mapTerm(quad.subject);
    const pred = mapTerm(quad.predicate);
    const obj = mapTerm(quad.object);
    triples.push({ subject: subj, predicate: pred, object: obj });
  });

  const prefixes = {};
  if (parser._prefixes) {
    for (const [prefix, val] of Object.entries(parser._prefixes)) {
      prefixes[prefix] = typeof val === "string" ? val : (val.value || "");
    }
  }

  const baseIri = parser._base || "";

  return { triples, prefixes, baseIri };
}

/**
 * Serializes Turtle triples into valid RDF/XML string structure.
 * @param {object[]} triples
 * @param {object} prefixes
 * @param {string} baseIri
 * @returns {string}
 */
export function serializeTriplesToRdfXml(triples, prefixes, baseIri) {
  const subjectGroups = new Map();
  
  function getTermKey(term) {
    return term.value;
  }
  
  triples.forEach(t => {
    const sKey = getTermKey(t.subject);
    if (!subjectGroups.has(sKey)) {
      subjectGroups.set(sKey, { subject: t.subject, triples: [] });
    }
    subjectGroups.get(sKey).triples.push(t);
  });
  
  const allPrefixes = Object.assign({
    rdf: NAMESPACES.RDF,
    rdfs: NAMESPACES.RDFS,
    owl: NAMESPACES.OWL,
    dc: NAMESPACES.DC,
    dcterms: NAMESPACES.DCTERMS
  }, prefixes);
  
  const cleanPrefixes = {};
  for (const [p, ns] of Object.entries(allPrefixes)) {
    let cleanP = p.replace(/[^a-zA-Z0-9-]/g, "");
    if (p === ":" || p === "") {
      cleanP = "";
    }
    cleanPrefixes[cleanP] = ns;
  }

  function getIri(term) {
    if (term.type === "URI") {
      return term.value;
    }
    if (term.type === "QNAME") {
      const idx = term.value.indexOf(":");
      const prefix = term.value.substring(0, idx);
      const local = term.value.substring(idx + 1);
      const ns = cleanPrefixes[prefix];
      if (ns) {return ns + local;}
      return term.value;
    }
    if (term.type === "KEYWORD" && term.value === "a") {
      return NAMESPACES.RDF + "type";
    }
    return term.value;
  }

  // Pre-scan all predicate IRIs to ensure every namespace has a declared prefix mapping
  let autoNsCount = 0;
  for (const group of subjectGroups.values()) {
    for (const t of group.triples) {
      const pIri = getIri(t.predicate);
      let matched = false;
      for (const ns of Object.values(cleanPrefixes)) {
        if (pIri.startsWith(ns)) {
          matched = true;
          break;
        }
      }
      if (!matched) {
        // Extract namespace (up to '#' or last '/')
        let splitIdx = pIri.lastIndexOf("#");
        if (splitIdx === -1) {
          splitIdx = pIri.lastIndexOf("/");
        }
        if (splitIdx !== -1) {
          const autoNs = pIri.substring(0, splitIdx + 1);
          const autoPfx = "ns" + (autoNsCount++);
          cleanPrefixes[autoPfx] = autoNs;
        }
      }
    }
  }
  
  let xml = "<?xml version=\"1.0\" encoding=\"utf-8\"?>\n";
  xml += "<rdf:RDF";
  if (baseIri) {
    xml += ` xml:base="${escapeXml(baseIri)}"`;
  }
  for (const [p, ns] of Object.entries(cleanPrefixes)) {
    if (p === "") {
      xml += ` xmlns="${escapeXml(ns)}"`;
    } else {
      xml += ` xmlns:${p}="${escapeXml(ns)}"`;
    }
  }
  xml += ">\n";

  function escapeXml(unsafe) {
    if (!unsafe) {return "";}
    return unsafe.replace(/[<>&'"]/g, function (c) {
      switch (c) {
        case "<": return "&lt;";
        case ">": return "&gt;";
        case "&": return "&amp;";
        case "'": return "&apos;";
        case "\"": return "&quot;";
      }
      return c;
    });
  }

  for (const group of subjectGroups.values()) {
    const subj = group.subject;
    const sVal = getIri(subj);
    
    if (subj.type === "BNODE") {
      xml += `  <rdf:Description rdf:nodeID="${escapeXml(sVal)}">\n`;
    } else {
      xml += `  <rdf:Description rdf:about="${escapeXml(sVal)}">\n`;
    }
    
    group.triples.forEach(t => {
      const pIri = getIri(t.predicate);
      
      let qname = null;
      for (const [p, ns] of Object.entries(cleanPrefixes)) {
        if (pIri.startsWith(ns)) {
          const local = pIri.substring(ns.length);
          if (local) {
            qname = p ? `${p}:${local}` : local;
            break;
          }
        }
      }

      if (!qname) {
        // Fallback QName if no split was possible
        qname = "rdf:Description";
      }
      
      const obj = t.object;
      if (obj.type === "LITERAL") {
        xml += `    <${qname}`;
        if (obj.lang) {
          xml += ` xml:lang="${escapeXml(obj.lang)}"`;
        }
        if (obj.datatype) {
          const dtIri = getIri(obj.datatype);
          xml += ` rdf:datatype="${escapeXml(dtIri)}"`;
        }
        xml += `>${escapeXml(obj.value)}</${qname}>\n`;
      } else {
        const oVal = getIri(obj);
        if (obj.type === "BNODE") {
          xml += `    <${qname} rdf:nodeID="${escapeXml(oVal)}" />\n`;
        } else {
          xml += `    <${qname} rdf:resource="${escapeXml(oVal)}" />\n`;
        }
      }
    });
    
    xml += "  </rdf:Description>\n";
  }
  
  xml += "</rdf:RDF>\n";
  return xml;
}

/**
 * Checks if a string represents Turtle format.
 * @param {string} text
 * @returns {boolean}
 */
export function isTurtleFormat(text) {
  const trimmed = text.trim();
  if (trimmed.startsWith("<") || trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return false;
  }
  return /^\s*(@prefix|@base|PREFIX|BASE|#)/i.test(trimmed) || 
         /;\s*$/m.test(trimmed) || 
         /\.\s*$/m.test(trimmed);
}
