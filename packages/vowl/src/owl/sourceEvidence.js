import { IRI } from "owlapi/model";
import { fail } from "../errors.js";
import { snapshotSource, deepFreeze, checkString } from "../snapshot.js";
import { ownSourceArchive } from "../sourceArchive.js";

/** Copy public owning evidence without invoking JSON hooks or retaining OWL objects. */
function copyEvidence(value, budget, ancestors = new Set(), depth = 1) {
  budget.check();
  budget.bound("depth", depth);
  if (value instanceof IRI) {
    return copyEvidence(
      { kind: "IRI", value: value.value },
      budget,
      ancestors,
      depth,
    );
  }
  if (typeof value === "string") {
    checkString(value, "", budget);
    return value;
  }
  if (value === null || typeof value === "boolean") {
    return value;
  }
  if (
    typeof value === "number" &&
    Number.isFinite(value) &&
    !Object.is(value, -0)
  ) {
    return value;
  }
  if (!value || typeof value !== "object" || ancestors.has(value)) {
    fail("DEPENDENCY_FAILURE", undefined, { stage: "owl-evidence" });
  }
  const array = Array.isArray(value);
  if (
    !(array
      ? Object.getPrototypeOf(value) === Array.prototype
      : [null, Object.prototype].includes(Object.getPrototypeOf(value)))
  ) {
    fail("DEPENDENCY_FAILURE", undefined, { stage: "owl-evidence" });
  }
  budget.charge("embeddedValues", 1);
  const result = array ? [] : Object.create(null);
  const keys = Reflect.ownKeys(value);
  if (array && keys.length !== value.length + 1) {
    fail("DEPENDENCY_FAILURE", undefined, { stage: "owl-evidence" });
  }
  ancestors.add(value);
  for (const key of keys) {
    if (array && key === "length") {
      continue;
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (
      typeof key !== "string" ||
      !descriptor.enumerable ||
      !("value" in descriptor) ||
      (array && (!/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= value.length))
    ) {
      fail("DEPENDENCY_FAILURE", undefined, { stage: "owl-evidence" });
    }
    checkString(key, "", budget);
    result[key] = copyEvidence(descriptor.value, budget, ancestors, depth + 1);
  }
  ancestors.delete(value);
  return result;
}

async function digest(bytes, budget) {
  budget.check();
  const result = await crypto.subtle.digest("SHA-256", bytes);
  budget.check();
  return [...new Uint8Array(result)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Historical evidence only. Empty unparsed arrays confer no losslessness claim.
 * Source bytes remain private and are returned only as defensive copies.
 */
export async function retainCompatibleEvidence(prepared, budget) {
  const retained = new Map();
  const documents = [];
  const sources = new Map();
  for (const source of prepared.sourceDocuments) {
    budget.check();
    if (!sources.has(source.documentIri)) {
      sources.set(source.documentIri, {
        mediaType: source.mediaType,
        bytes: new Uint8Array(source.bytes),
      });
    }
  }
  for (const document of prepared.documents) {
    budget.check();
    const source = sources.get(document.documentIri);
    if (!source) {
      fail("DEPENDENCY_FAILURE", undefined, { stage: "owl-evidence" });
    }
    // A later resolver response for an already loaded document is not the bytes parsed.
    const id = `document:${documents.length}`;
    const bytes = source.bytes;
    retained.set(id, bytes);
    const metadata = document.parserMetadata;
    const identity = document.ontology.getOntologyID();
    documents.push({
      id,
      documentIri: document.documentIri,
      mediaType: source.mediaType,
      digest: await digest(bytes, budget),
      formatKey: document.formatKey,
      ontologyIdentity: {
        ...(identity.ontologyIRI ? { iri: identity.ontologyIRI.value } : {}),
        ...(identity.versionIRI
          ? { versionIri: identity.versionIRI.value }
          : {}),
      },
      parserMetadata:
        metadata === null
          ? null
          : copyEvidence(
              {
                tripleCount: metadata.getTripleCount(),
                headerState: metadata.getHeaderState(),
                unparsedTriples: metadata.getUnparsedTriples(),
                guessedDeclarations: metadata.getGuessedDeclarations(),
              },
              budget,
            ),
    });
  }
  const evidence = deepFreeze(
    snapshotSource(
      {
        documents,
        imports: importEvidence(prepared, documents, budget),
        diagnostics: copyEvidence(prepared.diagnostics, budget),
        assessment: copyEvidence(prepared.assessment, budget),
        profileViolations: copyEvidence(
          prepared.report.getViolations(),
          budget,
        ),
        projectionDiagnostics: copyEvidence(
          prepared.projectionDiagnostics,
          budget,
        ),
        coverage: {
          basis: "unavailable",
          represented: null,
          qualified: null,
          excluded: null,
          unrepresented: null,
        },
      },
      budget,
    ),
  );
  return ownSourceArchive(evidence, retained, budget);
}

/** Public declarations provide edges, but do not identify their original RDF headers. */
function importEvidence(prepared, documents, budget) {
  const byDocument = new Map(
    documents.map((document) => [document.documentIri, document.id]),
  );
  const byOntology = new Map();
  for (const document of prepared.documents) {
    budget.check();
    const identity = document.ontology.getOntologyID();
    for (const iri of [identity.ontologyIRI, identity.versionIRI]) {
      if (iri) {
        byOntology.set(iri.value, byDocument.get(document.documentIri));
      }
    }
  }
  const acquired = new Map();
  for (const source of prepared.sourceDocuments) {
    budget.check();
    if (source.acquisition) {
      const key = JSON.stringify([
        source.acquisition.parentDocumentIri,
        source.acquisition.requestedIri,
      ]);
      if (!acquired.has(key)) {
        acquired.set(key, byDocument.get(source.documentIri));
      }
    }
  }
  const imports = [];
  const missing = new Set(
    prepared.diagnostics
      .filter(({ diagnostic }) => diagnostic.code === "MISSING_IMPORT")
      .map(({ documentIri, diagnostic }) =>
        JSON.stringify([documentIri, diagnostic.importIRI.value]),
      ),
  );
  for (const document of prepared.documents) {
    for (const declaration of document.ontology.getImportsDeclarations()) {
      budget.check();
      const requestedIri = declaration.iri.value;
      const key = JSON.stringify([document.documentIri, requestedIri]);
      const targetDocument = missing.has(key)
        ? null
        : (acquired.get(key) ??
          byOntology.get(requestedIri) ??
          byDocument.get(requestedIri) ??
          null);
      imports.push({
        parentDocument: byDocument.get(document.documentIri),
        requestedIri,
        targetDocument,
      });
    }
  }
  return imports;
}
