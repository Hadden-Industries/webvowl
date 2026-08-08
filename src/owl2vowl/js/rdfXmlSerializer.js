import { NAMESPACES } from "./constants.js";

/**
 * Serializes RDF triples into valid RDF/XML string structure.
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

  triples.forEach((t) => {
    const sKey = getTermKey(t.subject);
    if (!subjectGroups.has(sKey)) {
      subjectGroups.set(sKey, { subject: t.subject, triples: [] });
    }
    subjectGroups.get(sKey).triples.push(t);
  });

  const allPrefixes = Object.assign(
    {
      rdf: NAMESPACES.RDF,
      rdfs: NAMESPACES.RDFS,
      owl: NAMESPACES.OWL,
      dc: NAMESPACES.DC,
      dcterms: NAMESPACES.DCTERMS,
    },
    prefixes,
  );

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
      if (ns) {
        return ns + local;
      }
      return term.value;
    }
    if (term.type === "KEYWORD" && term.value === "a") {
      return NAMESPACES.RDF + "type";
    }
    return term.value;
  }

  function escapeXml(unsafe) {
    if (!unsafe) {
      return "";
    }
    return unsafe.replace(/[<>&'"]/g, function (c) {
      switch (c) {
        case "<":
          return "&lt;";
        case ">":
          return "&gt;";
        case "&":
          return "&amp;";
        case "'":
          return "&apos;";
        case '"':
          return "&quot;";
      }
      return c;
    });
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
          const autoPfx = "ns" + autoNsCount++;
          cleanPrefixes[autoPfx] = autoNs;
        }
      }
    }
  }

  let xml = '<?xml version="1.0" encoding="utf-8"?>\n';
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

  for (const group of subjectGroups.values()) {
    const subj = group.subject;
    const sVal = getIri(subj);

    if (subj.type === "BNODE") {
      xml += `  <rdf:Description rdf:nodeID="${escapeXml(sVal)}">\n`;
    } else {
      xml += `  <rdf:Description rdf:about="${escapeXml(sVal)}">\n`;
    }

    group.triples.forEach((t) => {
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
