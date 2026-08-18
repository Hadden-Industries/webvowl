import { DOMParser } from "@xmldom/xmldom";

import { ONTOLOGY_CATALOG } from "../js/constants.js";
import { PerformanceIriResolver } from "../js/iriResolver.js";
import { VowlParserContext } from "../js/parserContext.js";
import { parseRdfXml } from "../js/rdfParser.js";
import { convertOntology } from "../js/ontologyConverter.js";
import { exportToJson } from "../js/jsonExporter.js";
import {
  loadWithImports as internalLoadWithImports,
  convertToRdfXmlFallback,
} from "../js/importLoader.js";
import { resolveXmlEntities } from "../js/xmlUtils.js";

// The retained legacy conversion pipeline, composed exactly as
// `src/owl2vowl/js/index.js` composed it before the Phase 8 cutover. Section
// 17.15 keeps the legacy modules in place for characterization and reference
// only, so this composition lives in test code: it is the oracle that the new
// structural path is compared against, and it must never become reachable from
// production. Keeping it here also stops the legacy-parity comparisons from
// silently becoming new-against-new tautologies once the production entry is
// rewired.
export async function legacyOwl2Vowl(xmlString) {
  let xmlText = resolveXmlEntities(xmlString);
  xmlText = await convertToRdfXmlFallback(xmlText);

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

  const baseAttr =
    rootEl.getAttribute("xml:base") || rootEl.getAttribute("base") || "";
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
    other: {},
  };

  const {
    prefixList: parsedPrefixList,
    subjects,
    languagesSet,
  } = parseRdfXml(xmlText, resolver, context);
  Object.assign(header.prefixList, parsedPrefixList);

  convertOntology(subjects, languagesSet, resolver, context, header);

  return exportToJson(resolver, context, header);
}

export function loadWithImports(initialXmlText) {
  return internalLoadWithImports(initialXmlText, legacyOwl2Vowl);
}

export const catalog = ONTOLOGY_CATALOG;
