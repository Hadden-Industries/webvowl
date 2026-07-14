import { NAMESPACES } from "./constants.js";

/**
 * Tokenizes Turtle syntax.
 * @param {string} ttl
 * @returns {object[]}
 */
export function tokenizeTurtle(ttl) {
  const tokens = [];
  let i = 0;
  const len = ttl.length;
  
  while (i < len) {
    const c = ttl[i];
    
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    
    if (c === "#") {
      while (i < len && ttl[i] !== "\n" && ttl[i] !== "\r") {
        i++;
      }
      continue;
    }
    
    if (c === "<") {
      let start = i + 1;
      i++;
      while (i < len && ttl[i] !== ">") {
        i++;
      }
      tokens.push({ type: "URI", value: ttl.substring(start, i) });
      i++;
      continue;
    }
    
    if (c === "\"" || c === "'") {
      const quote = c;
      let start = i;
      if (ttl.substring(i, i + 3) === quote + quote + quote) {
        i += 3;
        while (i < len && ttl.substring(i, i + 3) !== quote + quote + quote) {
          if (ttl[i] === "\\") i++;
          i++;
        }
        tokens.push({ type: "LITERAL", value: ttl.substring(start + 3, i) });
        i += 3;
      } else {
        i++;
        while (i < len && ttl[i] !== quote) {
          if (ttl[i] === "\\") i++;
          i++;
        }
        tokens.push({ type: "LITERAL", value: ttl.substring(start + 1, i) });
        i++;
      }
      
      if (i < len && ttl[i] === "@") {
        let langStart = i + 1;
        i++;
        while (i < len && /[a-zA-Z0-9-]/.test(ttl[i])) {
          i++;
        }
        tokens[tokens.length - 1].lang = ttl.substring(langStart, i);
      } else if (i < len && ttl.substring(i, i + 2) === "^^") {
        i += 2;
        if (ttl[i] === "<") {
          let dtStart = i + 1;
          i++;
          while (i < len && ttl[i] !== ">") {
            i++;
          }
          tokens[tokens.length - 1].datatype = { type: "URI", value: ttl.substring(dtStart, i) };
          i++;
        } else {
          let dtStart = i;
          while (i < len && !/[\s;.,\]]/.test(ttl[i])) {
            i++;
          }
          tokens[tokens.length - 1].datatype = { type: "QNAME", value: ttl.substring(dtStart, i) };
        }
      }
      continue;
    }
    
    if (c === "." || c === ";" || c === "," || c === "[" || c === "]" || c === "(" || c === ")") {
      tokens.push({ type: "PUNCT", value: c });
      i++;
      continue;
    }
    
    let start = i;
    while (i < len && !/[\s;.,[\]()<>"'#]/.test(ttl[i])) {
      i++;
    }
    if (start === i) {
      i++;
      continue;
    }
    const val = ttl.substring(start, i);
    if (val === "a") {
      tokens.push({ type: "KEYWORD", value: "a" });
    } else if (val.toLowerCase() === "@prefix" || val.toUpperCase() === "PREFIX") {
      tokens.push({ type: "DIRECTIVE", value: "PREFIX" });
    } else if (val.toLowerCase() === "@base" || val.toUpperCase() === "BASE") {
      tokens.push({ type: "DIRECTIVE", value: "BASE" });
    } else if (val.indexOf(":") !== -1) {
      tokens.push({ type: "QNAME", value: val });
    } else {
      tokens.push({ type: "NAME", value: val });
    }
  }
  return tokens;
}

/**
 * Parses Turtle tokens into triples, prefixes, and baseIri.
 * @param {object[]} tokens
 * @returns {object}
 */
export function parseTurtleTokens(tokens) {
  const prefixes = {};
  let baseIri = "";
  const triples = [];
  let bnodeCounter = 0;
  
  function nextBnode() {
    return "_:b" + (bnodeCounter++);
  }
  
  let i = 0;
  const len = tokens.length;
  
  function peek() {
    return tokens[i];
  }
  
  function consume() {
    return tokens[i++];
  }
  
  while (i < len) {
    const tok = peek();
    if (!tok) break;
    
    if (tok.type === "DIRECTIVE") {
      consume();
      if (tok.value === "PREFIX") {
        const nameTok = consume();
        const uriTok = consume();
        if (nameTok && uriTok) {
          let name = nameTok.value;
          if (name.endsWith(":")) name = name.slice(0, -1);
          prefixes[name] = uriTok.value;
        }
      } else if (tok.value === "BASE") {
        const uriTok = consume();
        if (uriTok) baseIri = uriTok.value;
      }
      if (peek() && peek().type === "PUNCT" && peek().value === ".") {
        consume();
      }
      continue;
    }
    
    parseStatement();
  }
  
  function parseStatement() {
    const subj = parseTerm();
    if (!subj) {
      consume();
      return;
    }
    
    parsePredicateObjectList(subj);
    
    if (peek() && peek().type === "PUNCT" && peek().value === ".") {
      consume();
    }
  }
  
  function parseTerm() {
    const tok = peek();
    if (!tok) return null;
    
    if (tok.type === "URI" || tok.type === "QNAME" || tok.type === "LITERAL" || tok.type === "KEYWORD" || tok.type === "NAME") {
      return consume();
    }
    
    if (tok.type === "PUNCT" && tok.value === "[") {
      consume();
      const bnode = { type: "BNODE", value: nextBnode() };
      
      if (peek() && peek().type === "PUNCT" && peek().value === "]") {
        consume();
        return bnode;
      }
      
      parsePredicateObjectList(bnode);
      
      if (peek() && peek().type === "PUNCT" && peek().value === "]") {
        consume();
      }
      return bnode;
    }
    
    if (tok.type === "PUNCT" && tok.value === "(") {
      consume();
      const listNodes = [];
      while (peek() && !(peek().type === "PUNCT" && peek().value === ")")) {
        const term = parseTerm();
        if (term) {
          listNodes.push(term);
        } else {
          consume();
        }
      }
      if (peek() && peek().type === "PUNCT" && peek().value === ")") {
        consume();
      }
      
      if (listNodes.length === 0) {
        return { type: "URI", value: NAMESPACES.RDF + "nil" };
      }
      
      let current = { type: "BNODE", value: nextBnode() };
      const head = current;
      for (let j = 0; j < listNodes.length; j++) {
        triples.push({
          subject: current,
          predicate: { type: "URI", value: NAMESPACES.RDF + "first" },
          object: listNodes[j]
        });
        
        let next;
        if (j === listNodes.length - 1) {
          next = { type: "URI", value: NAMESPACES.RDF + "nil" };
        } else {
          next = { type: "BNODE", value: nextBnode() };
        }
        triples.push({
          subject: current,
          predicate: { type: "URI", value: NAMESPACES.RDF + "rest" },
          object: next
        });
        current = next;
      }
      return head;
    }
    
    return null;
  }
  
  function parsePredicateObjectList(subj) {
    while (true) {
      const pred = parseTerm();
      if (!pred) break;
      
      parseObjectList(subj, pred);
      
      if (peek() && peek().type === "PUNCT" && peek().value === ";") {
        consume();
        if (peek() && (peek().type === "PUNCT" && (peek().value === "." || peek().value === "]"))) {
          break;
        }
      } else {
        break;
      }
    }
  }
  
  function parseObjectList(subj, pred) {
    while (true) {
      const obj = parseTerm();
      if (!obj) break;
      
      triples.push({ subject: subj, predicate: pred, object: obj });
      
      if (peek() && peek().type === "PUNCT" && peek().value === ",") {
        consume();
      } else {
        break;
      }
    }
  }
  
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
    const cleanP = p.replace(/[^a-zA-Z0-9-]/g, "");
    cleanPrefixes[cleanP] = ns;
  }
  
  let xml = "<?xml version=\"1.0\" encoding=\"utf-8\"?>\n";
  xml += "<rdf:RDF";
  if (baseIri) {
    xml += ` xml:base="${baseIri}"`;
  }
  for (const [p, ns] of Object.entries(cleanPrefixes)) {
    if (p === "") {
      xml += ` xmlns="${ns}"`;
    } else {
      xml += ` xmlns:${p}="${ns}"`;
    }
  }
  xml += ">\n";
  
  function getIri(term) {
    if (term.type === "URI") {
      return term.value;
    }
    if (term.type === "QNAME") {
      const idx = term.value.indexOf(":");
      const prefix = term.value.substring(0, idx);
      const local = term.value.substring(idx + 1);
      const ns = cleanPrefixes[prefix];
      if (ns) return ns + local;
      return term.value;
    }
    if (term.type === "KEYWORD" && term.value === "a") {
      return NAMESPACES.RDF + "type";
    }
    return term.value;
  }

  function escapeXml(unsafe) {
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
          qname = `${p}:${pIri.substring(ns.length)}`;
          break;
        }
      }
      if (!qname) {
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
