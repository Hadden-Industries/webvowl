import {
  OWLOntologyLoaderConfiguration,
  StringDocumentSource,
} from "../../owlapi-js/io/index.js";
import { OWLManager } from "../../owlapi-js/manager/index.js";
import { IRI } from "../../owlapi-js/model/index.js";

import { ONTOLOGY_CATALOG } from "./constants.js";
import { WebVowlImportResolver } from "./importResolver.js";
import { VOWLBuilder } from "./vowlBuilder.js";

const loaderConfiguration = (configuration) => {
  if (configuration instanceof OWLOntologyLoaderConfiguration) {
    return configuration;
  }
  return new OWLOntologyLoaderConfiguration({
    remoteImports: true,
    ...configuration,
  });
};

const sourceDocumentIri = (documentIRI) =>
  documentIRI === undefined ? undefined : IRI.create(documentIRI);

export async function loadWithOwlapi(
  text,
  {
    builder = new VOWLBuilder(),
    catalog = ONTOLOGY_CATALOG,
    configuration,
    contentType,
    documentIRI,
    fetchImpl = globalThis.fetch,
    fileName,
  } = {},
) {
  const importResolver = new WebVowlImportResolver({ catalog, fetchImpl });
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
  return result;
}
