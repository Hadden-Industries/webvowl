import jsonld from "jsonld";
import { serializeTriplesToRdfXml } from "./rdfXmlSerializer.js";
import { MAX_SNIFF_BYTES } from "./constants.js";

function mapJsonLdTerm(term) {
  if (term.termType === "NamedNode") {
    return { type: "URI", value: term.value };
  }
  if (term.termType === "BlankNode") {
    const val = term.value.startsWith("_:")
      ? term.value.substring(2)
      : term.value;
    return { type: "BNODE", value: val };
  }
  if (term.termType === "Literal") {
    const lit = { type: "LITERAL", value: term.value };
    if (term.language) {
      lit.lang = term.language;
    } else if (
      term.datatype &&
      term.datatype.value !== "http://www.w3.org/2001/XMLSchema#string" &&
      term.datatype.value !==
        "http://www.w3.org/1999/02/22-rdf-syntax-ns#langString"
    ) {
      lit.datatype = { type: "URI", value: term.datatype.value };
    }
    return lit;
  }
  return { type: "URI", value: term.value };
}

/**
 * Security-guarded detection for JSON-LD format.
 * Uses a 4-tier fast-failure strategy to prevent OOM/CPU Denial of Service on non-JSON or massive inputs.
 * @param {string} text
 * @returns {boolean}
 */
export function isJsonLdFormat(text) {
  if (!text || typeof text !== "string") {
    return false;
  }

  const snippet = text.slice(0, MAX_SNIFF_BYTES).trim();

  // Tier 1: Fast non-JSON prefix rejection
  if (
    snippet.startsWith("<") ||
    snippet.startsWith("@prefix") ||
    /^\s*(PREFIX|Ontology|Prefix:|\()/i.test(snippet)
  ) {
    return false;
  }

  // Tier 2: Must begin with JSON object '{' or array '['
  if (!snippet.startsWith("{") && !snippet.startsWith("[")) {
    return false;
  }

  // Tier 3: Must contain characteristic JSON-LD keywords in the header snippet
  if (
    !snippet.includes('"@context"') &&
    !snippet.includes('"@graph"') &&
    !snippet.includes('"@id"') &&
    !snippet.includes('"@type"')
  ) {
    return false;
  }

  // Tier 4: Safe JSON parse validation
  try {
    const obj = JSON.parse(text);
    if (Array.isArray(obj)) {
      return obj.some(
        (item) =>
          typeof item === "object" &&
          item !== null &&
          ("@id" in item || "@type" in item || "@context" in item),
      );
    }
    return (
      typeof obj === "object" &&
      obj !== null &&
      ("@context" in obj || "@graph" in obj || "@id" in obj || "@type" in obj)
    );
  } catch {
    return false;
  }
}

/**
 * Parses a JSON-LD document into valid RDF/XML.
 * @param {string|object} input
 * @returns {Promise<string>}
 */
export async function parseJsonLd(input) {
  const doc = typeof input === "string" ? JSON.parse(input) : input;
  const dataset = await jsonld.toRDF(doc);
  const triples = dataset.map((quad) => ({
    subject: mapJsonLdTerm(quad.subject),
    predicate: mapJsonLdTerm(quad.predicate),
    object: mapJsonLdTerm(quad.object),
  }));

  const prefixes = {};
  if (
    doc["@context"] &&
    typeof doc["@context"] === "object" &&
    !Array.isArray(doc["@context"])
  ) {
    for (const [key, val] of Object.entries(doc["@context"])) {
      if (typeof val === "string") {
        prefixes[key] = val;
      }
    }
  }

  return serializeTriplesToRdfXml(triples, prefixes, prefixes[""] || "");
}
