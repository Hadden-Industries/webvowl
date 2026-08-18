import {
  OWLOntologyLoaderConfiguration,
  StringDocumentSource,
} from "../../owlapi-js/io/index.js";
import { OWLManager } from "../../owlapi-js/manager/index.js";
import { IRI } from "../../owlapi-js/model/index.js";

import { ONTOLOGY_CATALOG } from "./constants.js";
import { WebVowlImportResolver } from "./importResolver.js";
import { VOWLBuilder } from "./vowlBuilder.js";

// The production ingestion path: owlapi-js parses the document into a
// structural OWLOntology, and VOWLBuilder converts that model into the
// VOWL-JSON structures the application renders. Section 17.15 forbids a runtime
// legacy fallback, so a syntax this path does not implement fails with the
// canonical unsupported-format diagnostics rather than being routed to the
// retained legacy parsers. Those modules remain on disk for characterization
// only and must stay unreachable from here.

const loaderConfiguration = (configuration) =>
  configuration instanceof OWLOntologyLoaderConfiguration
    ? configuration
    : new OWLOntologyLoaderConfiguration(configuration);

// RFC 3986 section 5.1 establishes a base URI from content (xml:base), then
// from the retrieval IRI, and only then from an application-defined default.
// A pasted or uploaded document has no retrieval IRI, so a document containing
// relative references such as rdf:about="" would otherwise fail to parse
// entirely. Section 5.1.4 makes that default the caller's responsibility, so
// this is a last resort rather than a normal path, and it is reported.
//
// The authority uses the .invalid TLD that RFC 2606 reserves for "online
// construction of domain names that are sure to be invalid and which it is
// obvious at a glance are invalid". It is hierarchical, so path-relative
// references resolve as siblings the way a file-based base would; it is
// deterministic, so the same document yields the same IRIs in a browser and in
// Node; and it is short, because the resolved IRIs are stored in full on every
// affected entity rather than collapsed into a namespace prefix.
const SYNTHETIC_BASE_IRI = "https://webvowl.invalid/";

const sourceDocumentIri = (documentIRI) =>
  IRI.create(documentIRI === undefined ? SYNTHETIC_BASE_IRI : documentIRI);

const resolvedAgainstSyntheticBase = (iri) =>
  typeof iri === "string" && iri.startsWith(SYNTHETIC_BASE_IRI);

const usesSyntheticBase = (result) =>
  resolvedAgainstSyntheticBase(result.header?.iri) ||
  (result.classAttribute || []).some(
    ({ individuals, iri }) =>
      resolvedAgainstSyntheticBase(iri) ||
      (individuals || []).some((individual) =>
        resolvedAgainstSyntheticBase(individual.iri),
      ),
  ) ||
  (result.propertyAttribute || []).some(({ iri }) =>
    resolvedAgainstSyntheticBase(iri),
  );

// Upstream WebVOWL does not parse ontologies at all; it delegates to the
// OWL2VOWL service, so that service defines what the application is expected to
// accept. The pinned OWL2VOWL oracle converts real-world OWL Full documents
// such as DOAP, FOAF and Schema.org, and its outputs are committed under
// `src/owl2vowl/test/fixtures/java-reference-outputs/`. Strict parsing rejects
// those documents outright, so the production default is `compatible`, which
// section 2.8 permits because every recovery remains observable as a diagnostic
// on the result rather than being silently discarded.
const PRODUCTION_PARSING_MODE = "compatible";

const build = async (
  text,
  {
    builder = new VOWLBuilder(),
    catalog: catalogMapping = ONTOLOGY_CATALOG,
    configuration,
    contentType,
    documentIRI,
    fetchImpl = globalThis.fetch,
    fileName,
  } = {},
) => {
  const importResolver = new WebVowlImportResolver({
    catalog: catalogMapping,
    fetchImpl,
  });
  const manager = OWLManager.createOWLOntologyManager({
    documentLoader: importResolver,
    iriMappers: [importResolver],
  });
  const source = new StringDocumentSource(text, {
    contentType,
    documentIRI: sourceDocumentIri(documentIRI),
    fileName,
  });
  const loaded = await manager.loadOntologyGraphFromOntologyDocument(
    source,
    loaderConfiguration(configuration),
  );
  const result = builder.build(loaded.ontology, {
    importsClosure: loaded.importsClosure,
  });
  result.diagnostics = loaded.documents.flatMap(({ context }) =>
    context.diagnostics.map((diagnostic) => ({
      ...diagnostic,
      documentIRI: diagnostic.documentIRI || context.documentIRI,
    })),
  );
  // Most documents use absolute IRIs throughout and never consult the base, so
  // reporting the substitution on every anonymous load would be noise rather
  // than a recovery notice. It is reported only when the synthetic base
  // actually reached the output.
  if (documentIRI === undefined && usesSyntheticBase(result)) {
    result.diagnostics.push({
      baseIRI: SYNTHETIC_BASE_IRI,
      code: "RDF_SYNTHETIC_BASE_IRI",
      message:
        "No document IRI was supplied, so relative references were resolved against a synthetic base",
      severity: "warning",
    });
  }
  return result;
};

/**
 * Converts a single ontology document into VOWL-JSON without resolving remote
 * imports.
 * @param {string} text
 * @param {object} [options]
 * @returns {Promise<object>}
 */
export default async function owl2vowl(text, options = {}) {
  return build(text, {
    ...options,
    configuration: {
      missingImportHandling: "diagnostic",
      parsingMode: PRODUCTION_PARSING_MODE,
      remoteImports: false,
      ...options.configuration,
    },
  });
}

/**
 * Converts an ontology document into VOWL-JSON, transitively resolving its
 * import closure through the WebVOWL catalog and HTTP policy.
 * @param {string} text
 * @param {object} [options]
 * @returns {Promise<object>}
 */
export function loadWithImports(text, options = {}) {
  return build(text, {
    ...options,
    configuration: {
      parsingMode: PRODUCTION_PARSING_MODE,
      remoteImports: true,
      ...options.configuration,
    },
  });
}

export const catalog = ONTOLOGY_CATALOG;

owl2vowl.loadWithImports = loadWithImports;
owl2vowl.catalog = catalog;
