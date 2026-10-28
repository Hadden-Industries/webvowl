import { isIri } from "@hyperjump/uri";
import { OWLManager } from "owlapi/apibinding";
import { IRI, OWLOntologyLoaderConfiguration } from "owlapi/model";
import { StringDocumentSource, UnloadableImportError } from "owlapi/io";
import { OWLDocumentFormats } from "owlapi/formats";
import { fail, VowlError } from "../errors.js";
import { limitCode, optionRecord } from "../resourceBudget.js";
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

/** Only compatible live ingress permits the owning loader to select syntax. */
export function documentContext(
  documentIri,
  mediaType,
  budget,
  pointer = "",
  automatic = false,
) {
  validateDocumentIri(documentIri, pointer);
  checkString(documentIri, `${pointer}/documentIri`, budget);
  return {
    documentIRI: IRI.create(documentIri),
    ...(automatic && mediaType === undefined
      ? {}
      : {
          contentType: mediaType,
          format: resolveDocumentFormat(mediaType, pointer),
        }),
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

/** owlapi's normative profile accepts only safe integers, and no input reaches this one. */
export const owlapiLimit = (limit) => Math.min(limit, Number.MAX_SAFE_INTEGER);

// The caller limit behind each owlapi bound that loaderLimits and profileCheckLimits
// derive; a bound that owlapi fixes itself has none.
const derivedLimits = new Map(
  Object.entries({
    timeoutMs: "deadlineMs",
    profileTimeoutMs: "deadlineMs",
    maxInputBytes: "inputBytes",
    maxExpandedXmlBytes: "expandedXmlBytes",
    maxEntityDeclarations: "expandedXmlBytes",
    maxEntityExpansionDepth: "expandedXmlBytes",
    maxEntityReplacementLength: "expandedXmlBytes",
    maxAxioms: "primaryRecords",
    maxBlankNodes: "primaryRecords",
    maxImportCount: "primaryRecords",
    maxTokenCount: "embeddedValues",
    maxRdfListLength: "embeddedValues",
    profileWork: "embeddedValues",
    maxTokenLength: "stringBytes",
    profileLiteralLength: "stringBytes",
    profileNumericDigits: "stringBytes",
    maxQuads: "rdfQuads",
    maxAnnotationDepth: "depth",
    maxExpressionDepth: "depth",
    maxXmlNestingDepth: "depth",
    maxImportDepth: "depth",
    expressionDepth: "depth",
    profileDepth: "depth",
    profilePatternDepth: "depth",
  }),
);

/** Fail with the code of the caller limit from which an exhausted owlapi bound derives. */
export function dependencyLimitFailure(resource, stage) {
  const limit = derivedLimits.get(resource);
  if (limit === "deadlineMs") {
    fail("DEADLINE_EXCEEDED");
  }
  fail(limitCode(limit), undefined, {
    stage,
    resource,
    ...(limit === undefined ? {} : { limit }),
  });
}

/**
 * The caller's limits as owlapi loader bounds, without the former fixed import caps.
 * An unbounded expanded-XML limit also lifts owlapi's internal-entity controls.
 */
export function loaderLimits(budget) {
  const { limits } = budget;
  const entityControls =
    limits.expandedXmlBytes === Infinity
      ? {
          maxEntityDeclarations: owlapiLimit(Infinity),
          maxEntityExpansionDepth: owlapiLimit(Infinity),
          maxEntityReplacementLength: owlapiLimit(Infinity),
        }
      : {};
  return {
    timeoutMs: owlapiLimit(
      Math.max(1, Math.ceil(budget.deadline - performance.now())),
    ),
    maxInputBytes: owlapiLimit(limits.inputBytes),
    maxExpandedXmlBytes: owlapiLimit(limits.expandedXmlBytes),
    ...entityControls,
    maxAxioms: owlapiLimit(limits.primaryRecords),
    maxBlankNodes: owlapiLimit(limits.primaryRecords),
    maxTokenCount: owlapiLimit(limits.embeddedValues),
    maxTokenLength: owlapiLimit(limits.stringBytes),
    maxQuads: owlapiLimit(limits.rdfQuads),
    maxRdfListLength: owlapiLimit(limits.embeddedValues),
    maxAnnotationDepth: owlapiLimit(limits.depth),
    maxExpressionDepth: owlapiLimit(limits.depth),
    maxXmlNestingDepth: owlapiLimit(limits.depth),
    maxImportCount: owlapiLimit(limits.primaryRecords),
    maxImportDepth: owlapiLimit(limits.depth),
  };
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
  for (const item of failures) {
    budget.reportHostLimit(item);
  }
  const limited = failures.find(
    (item) => item.code === "RESOURCE_LIMIT_EXCEEDED",
  );
  if (limited) {
    dependencyLimitFailure(limited.resource, "owl-loading");
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
            policy.parsingMode === "compatible",
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
  const configuration = new OWLOntologyLoaderConfiguration({
    parsingMode: policy.parsingMode ?? "preserve",
    loadAnnotationAxioms: true,
    collectWarnings: true,
    // Owning HTTP gating precedes the custom loader. No built-in fetcher is installed.
    remoteImports: true,
    remoteJsonLdContexts: false,
    missingImportHandling: policy.strict ? "throw" : "diagnostic",
    signal: budget.signal,
    ...loaderLimits(budget),
  });
  try {
    const startedAt = performance.now();
    const loaded = await waitForResult(
      manager.loadOntologyGraphFromOntologyDocument(
        sourceFor(bytes, context),
        configuration,
      ),
      budget,
    );
    performance.measure("webvowl.owl-loading", {
      start: startedAt,
      end: performance.now(),
    });
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
