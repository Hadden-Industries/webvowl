import { isIri } from "@hyperjump/uri";
import { OWLManager } from "owlapi/apibinding";
import { IRI, OWLOntologyLoaderConfiguration } from "owlapi/model";
import { StringDocumentSource, UnloadableImportError } from "owlapi/io";
import { OWLDocumentFormats } from "owlapi/formats";
import { fail, VowlError } from "../errors.js";
import { optionRecord } from "../resourceBudget.js";
import { checkString, snapshotBytes } from "../snapshot.js";

const domExceptionName = Object.getOwnPropertyDescriptor(
  DOMException.prototype,
  "name",
).get;

function errorName(value) {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  try {
    // Native AbortError names are inherited accessors. Validate the receiver
    // without invoking any caller-owned name getter.
    return domExceptionName.call(value);
  } catch {
    return Object.getOwnPropertyDescriptor(value, "name")?.value;
  }
}

const ambiguousReasons = new Set([
  "RDF_AMBIGUOUS_PROPERTY_ROLE",
  "RDF_AMBIGUOUS_RANGE_ROLE",
  "RDF_AMBIGUOUS_CLASS_ROLE",
  "RDF_INCOMPATIBLE_PROPERTY_ROLES",
]);

export function validateDocumentIri(documentIri, pointer = "") {
  if (typeof documentIri !== "string" || !isIri(documentIri)) {
    fail("OPTION_INVALID", `${pointer}/documentIri`);
  }
}

/** Select one owning format by its exact public media type, without sniffing. */
export function resolveDocumentFormat(mediaType, pointer = "") {
  if (typeof mediaType !== "string") {
    fail("OPTION_INVALID", `${pointer}/mediaType`);
  }
  const matches = Object.values(OWLDocumentFormats).filter((format) =>
    format.mediaTypes.includes(mediaType),
  );
  // A shared media type cannot select an exact parser. Do not choose by order.
  if (matches.length !== 1) {
    fail("MAPPING_MEDIA_TYPE_UNSUPPORTED", `${pointer}/mediaType`);
  }
  return matches[0];
}

export function documentContext(documentIri, mediaType, budget, pointer = "") {
  validateDocumentIri(documentIri, pointer);
  checkString(documentIri, `${pointer}/documentIri`, budget);
  return {
    documentIRI: IRI.create(documentIri),
    contentType: mediaType,
    format: resolveDocumentFormat(mediaType, pointer),
  };
}

function sourceFor(bytes, context) {
  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    fail("MAPPING_SYNTAX_INVALID");
  }
  return new StringDocumentSource(text, context);
}

/** A late resolver/loader result is observed but cannot resume an expired operation. */
export function waitForResult(result, budget) {
  budget.check();
  return new Promise((resolve, reject) => {
    const abort = () => {
      try {
        budget.check();
        fail("DEADLINE_EXCEEDED");
      } catch (error) {
        reject(error);
      }
    };
    budget.signal.addEventListener("abort", abort, { once: true });
    if (budget.signal.aborted) {
      abort();
    }
    Promise.resolve(result).then(
      (value) => {
        budget.signal.removeEventListener("abort", abort);
        try {
          budget.check();
          resolve(value);
        } catch (error) {
          reject(error);
        }
      },
      (error) => {
        budget.signal.removeEventListener("abort", abort);
        reject(error);
      },
    );
  });
}

/** Translate only owning errors; source text, callback errors and raw stacks never escape. */
function loadingFailure(error, budget) {
  budget.check();
  if (error instanceof VowlError) {
    throw error;
  }
  const pending = [error];
  const seen = new Set();
  const failures = [];
  while (pending.length) {
    const item = pending.pop();
    if (!item || typeof item !== "object" || seen.has(item)) {
      continue;
    }
    seen.add(item);
    failures.push(item);
    if (Array.isArray(item.errors)) {
      pending.push(...item.errors);
    }
    if (item.cause) {
      pending.push(item.cause);
    }
  }
  const limited = failures.find(
    (item) => item.code === "RESOURCE_LIMIT_EXCEEDED",
  );
  if (limited) {
    fail("MODEL_RESOURCE_LIMIT", undefined, {
      stage: "owl-loading",
      resource: limited.resource,
    });
  }
  if (failures.some((item) => item.code === "MISSING_IMPORT")) {
    fail("MAPPING_IMPORT_UNRESOLVED");
  }
  if (
    failures.some(
      (item) =>
        ambiguousReasons.has(item.reason) ||
        item.code === "AMBIGUOUS_RDF_DATASET",
    )
  ) {
    fail("MAPPING_AMBIGUOUS");
  }
  if (failures.some((item) => item.code === "UNSUPPORTED_CONSTRUCT")) {
    fail("MAPPING_UNSUPPORTED_CONSTRUCT");
  }
  fail("MAPPING_SYNTAX_INVALID");
}

/** A fresh manager owns one closure; the caller callback is the only acquisition capability. */
export async function loadClosure(bytes, context, options, budget, policy) {
  let boundaryFailure;
  policy.observeSource?.(bytes, context);
  const manager = OWLManager.createOWLOntologyManager({
    documentLoader: {
      async load(_retrievalIri, request) {
        try {
          budget.check();
          if (!options.resolveImport) {
            return undefined;
          }
          let result;
          try {
            result = await waitForResult(
              options.resolveImport(
                request.importIRI.value,
                Object.freeze({
                  importingDocumentIri: request.importingDocumentIRI.value,
                  signal: budget.signal,
                }),
              ),
              budget,
            );
          } catch (error) {
            // Callback failure is acquisition failure. Cancellation/deadline takes precedence.
            budget.check();
            const code =
              error && typeof error === "object"
                ? Object.getOwnPropertyDescriptor(error, "code")?.value
                : undefined;
            if (
              [
                "ABORTED",
                "DEADLINE_EXCEEDED",
                "INPUT_RESOURCE_LIMIT",
                "MODEL_RESOURCE_LIMIT",
                "RESOURCE_LIMIT_EXCEEDED",
              ].includes(code)
            ) {
              fail(
                code === "RESOURCE_LIMIT_EXCEEDED"
                  ? "MODEL_RESOURCE_LIMIT"
                  : code,
              );
            }
            if (errorName(error) === "AbortError") {
              fail("ABORTED");
            }
            return undefined;
          }
          budget.check();
          if (result === undefined || result === null) {
            return undefined;
          }
          const response = optionRecord(
            result,
            ["bytes", "documentIri", "mediaType"],
            "/resolveImport",
          );
          const snapshot = snapshotBytes(response.bytes, budget);
          const importedContext = documentContext(
            response.documentIri,
            response.mediaType,
            budget,
            "/resolveImport",
          );
          policy.observeSource?.(snapshot, importedContext, {
            requestedIri: request.importIRI.value,
            parentDocumentIri: request.importingDocumentIRI.value,
          });
          return sourceFor(snapshot, importedContext);
        } catch (error) {
          boundaryFailure = error;
          // Prevent missing-import recovery of malformed resolver responses/resources.
          throw new UnloadableImportError(
            "The bounded import response was rejected",
          );
        }
      },
    },
  });
  const limits = budget.limits;
  const configuration = new OWLOntologyLoaderConfiguration({
    parsingMode: policy.parsingMode ?? "preserve",
    loadAnnotationAxioms: true,
    collectWarnings: true,
    // Owning HTTP gating precedes the custom loader. No built-in fetcher is installed.
    remoteImports: true,
    remoteJsonLdContexts: false,
    missingImportHandling: policy.strict ? "throw" : "diagnostic",
    signal: budget.signal,
    timeoutMs: Math.max(1, Math.ceil(budget.deadline - performance.now())),
    maxInputBytes: limits.inputBytes,
    maxExpandedXmlBytes: limits.inputBytes,
    maxAxioms: limits.primaryRecords,
    maxBlankNodes: limits.primaryRecords,
    maxTokenCount: limits.embeddedValues,
    maxTokenLength: limits.stringBytes,
    maxQuads: limits.rdfQuads,
    maxRdfListLength: limits.embeddedValues,
    maxAnnotationDepth: limits.depth,
    maxExpressionDepth: limits.depth,
    maxXmlNestingDepth: limits.depth,
    maxImportCount: Math.min(256, limits.primaryRecords),
    maxImportDepth: Math.min(32, limits.depth),
  });
  try {
    const loaded = await waitForResult(
      manager.loadOntologyGraphFromOntologyDocument(
        sourceFor(bytes, context),
        configuration,
      ),
      budget,
    );
    if (boundaryFailure) {
      throw boundaryFailure;
    }
    for (const { context: loadedContext } of loaded.documents) {
      budget.check();
      for (const diagnostic of loadedContext.diagnostics) {
        if (policy.parsingMode === "compatible") {
          policy.observeDiagnostic(diagnostic, loadedContext);
        } else if (diagnostic.code === "MISSING_IMPORT") {
          policy.recover(
            "MAPPING_IMPORT_UNRESOLVED",
            "An authored import could not be resolved.",
            diagnostic.importIRI.value,
          );
        } else {
          // Preserve mode must not silently apply an unreviewed parser recovery.
          fail("MAPPING_AMBIGUOUS", undefined, {
            stage: "owl-loading",
            restriction: diagnostic.code,
          });
        }
      }
    }
    return { ...loaded, manager };
  } catch (error) {
    if (boundaryFailure) {
      throw boundaryFailure;
    }
    loadingFailure(error, budget);
  }
}
