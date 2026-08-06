import { DOMParser } from "@xmldom/xmldom";
import { ONTOLOGY_CATALOG } from "./constants.js";
import { PerformanceIriResolver } from "./iriResolver.js";
import { VowlParserContext } from "./parserContext.js";
import { parseRdfXml } from "./rdfParser.js";
import { convertOntology } from "./ontologyConverter.js";
import { exportToJson } from "./jsonExporter.js";
import { loadWithImports as internalLoadWithImports } from "./importLoader.js";
import { isTurtleFormat, parseTurtle, serializeTriplesToRdfXml } from "./turtleParser.js";
import { isOwlXmlFormat, convertOwlXmlToRdfXml } from "./owlXmlParser.js";
import { isManchesterSyntaxFormat, convertManchesterSyntaxToRdfXml } from "./manchesterSyntaxParser.js";
import { resolveXmlEntities } from "./xmlUtils.js";

/**
 * Parses an RDF/XML, OWL/XML, Turtle, or Manchester Syntax ontology into VOWL-JSON.
 * @param {string} xmlString
 * @returns {object}
 */
export default function owl2vowl(xmlString) {
  let xmlText = resolveXmlEntities(xmlString);
  if (isTurtleFormat(xmlText)) {
    try {
      const parsed = parseTurtle(xmlText);
      xmlText = serializeTriplesToRdfXml(parsed.triples, parsed.prefixes, parsed.baseIri);
    } catch (parseErr) {
      throw new Error("Turtle parsing error: " + parseErr.message, { cause: parseErr });
    }
  } else if (isOwlXmlFormat(xmlText)) {
    try {
      xmlText = convertOwlXmlToRdfXml(xmlText);
    } catch (parseErr) {
      throw new Error("OWL/XML conversion error: " + parseErr.message, { cause: parseErr });
    }
  } else if (isManchesterSyntaxFormat(xmlText)) {
    try {
      // Use relaxed mode by default for WebVOWL to maximize rendering on syntax errors
      xmlText = convertManchesterSyntaxToRdfXml(xmlText, { strictMode: false });
    } catch (parseErr) {
      throw new Error("Manchester Syntax parsing error: " + parseErr.message, { cause: parseErr });
    }
  }

  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, "application/xml");

  const parserError = xmlDoc.getElementsByTagName("parsererror")[0];
  if (parserError) {
    throw new Error("XML parsing error: " + parserError.textContent);
  }

  const rootEl = xmlDoc.documentElement;
  if (!rootEl) {
    throw new Error("Invalid XML document");
  }

  const baseAttr = rootEl.getAttribute("xml:base") || rootEl.getAttribute("base") || "";
  const resolver = new PerformanceIriResolver(baseAttr);

  const prefixList = {};
  if (rootEl.attributes) {
    for (let i = 0; i < rootEl.attributes.length; i++) {
      const attr = rootEl.attributes[i];
      if (attr.name.startsWith("xmlns:")) {
        const prefix = attr.name.substring(6);
        prefixList[prefix] = attr.value;
      }
    }
  }

  const context = new VowlParserContext();
  const header = {
    languages: [],
    baseIris: [],
    prefixList: prefixList,
    title: {},
    iri: "",
    version: "",
    author: [],
    description: {},
    labels: {},
    comments: {},
    other: {}
  };

  // Run the parser
  const { prefixList: parsedPrefixList, subjects, languagesSet } = parseRdfXml(xmlText, resolver, context);
  Object.assign(header.prefixList, parsedPrefixList);

  // Run the conversion
  convertOntology(subjects, languagesSet, resolver, context, header);

  // Run the JSON exporter
  return exportToJson(resolver, context, header);
}

/**
 * Loads the root ontology and transitively resolves/merges imports, then parses into VOWL-JSON.
 * @param {string} initialXmlText
 * @returns {Promise<object>}
 */
export function loadWithImports(initialXmlText) {
  return internalLoadWithImports(initialXmlText, owl2vowl);
}

export const catalog = ONTOLOGY_CATALOG;

owl2vowl.loadWithImports = loadWithImports;
owl2vowl.catalog = catalog;

