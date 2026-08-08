import { Parser } from "n3";
import { MAX_SNIFF_BYTES } from "./constants.js";

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
 * Checks if a string represents Turtle format.
 * @param {string} text
 * @returns {boolean}
 */
export function isTurtleFormat(text) {
  if (!text || typeof text !== "string") {
    return false;
  }
  const snippet = text.slice(0, MAX_SNIFF_BYTES).trim();
  if (snippet.startsWith("<") || snippet.startsWith("{") || snippet.startsWith("[")) {
    return false;
  }
  return /^\s*(@prefix|@base|PREFIX|BASE|#)/i.test(snippet) || 
         /;\s*$/m.test(snippet) || 
         /\.\s*$/m.test(snippet);
}
