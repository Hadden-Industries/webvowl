import { OWLOntologyLoaderConfiguration } from "owlapi/model";
import { loadWithImports as productionLoadWithImports } from "../../../owl2vowl/js/index.js";
import { WebVowlImportResolver } from "../../../owl2vowl/js/importResolver.js";
import { OWLDocumentFormats } from "owlapi/formats";
import {
  DocumentLoadError,
  OWLOntologyCreationError,
  OWLParserError,
  ResourceLimitError,
  SecurityPolicyError,
  UnparsableOntologyException,
} from "owlapi/io";

import {
  WEB_VOWL_OPERATION_LIMITS,
  WebVowlOperationError,
  truncateOntologyDerivedText,
  truncateResultCollection,
} from "./webVowlControllerContracts.js";

const ONTOLOGY_TEXT_PRIMARY_MEDIA_TYPE_BY_FORMAT_KEY = new Map(
  Object.values(OWLDocumentFormats).map((documentFormat) => [
    documentFormat.key,
    documentFormat.mediaTypes[0],
  ]),
);

const VOWL_COLLECTION_FIELD_NAMES = Object.freeze([
  "namespace",
  "class",
  "classAttribute",
  "datatype",
  "datatypeAttribute",
  "property",
  "propertyAttribute",
]);

const SOURCE_LOAD_ERROR_DEFINITIONS = Object.freeze({
  FETCH_FAILED: Object.freeze({
    isRetryable: true,
    message: "The source document could not be fetched by this browser.",
  }),
  IMPORT_FAILED: Object.freeze({
    isRetryable: true,
    message: "An ontology import prevented the source from loading.",
  }),
  LOAD_ABORTED: Object.freeze({
    isRetryable: true,
    message: "The ontology source load was aborted.",
  }),
  PARSE_FAILED: Object.freeze({
    isRetryable: false,
    message: "The ontology source could not be parsed.",
  }),
  SOURCE_REJECTED: Object.freeze({
    isRetryable: false,
    message: "The ontology source does not satisfy the loading policy.",
  }),
});

const SOURCE_SHA256_UNAVAILABLE_DIAGNOSTIC = Object.freeze({
  code: "SOURCE_SHA256_UNAVAILABLE",
  message: "A SHA-256 source fingerprint is unavailable in this browser.",
  severity: "warning",
});

class InvalidVowlModelError extends TypeError {
  constructor(message, options) {
    super(message, options);
    this.name = "InvalidVowlModelError";
  }
}

function sourceKindDetails(sourceKind) {
  return typeof sourceKind === "string" ? { sourceKind } : undefined;
}

function createSourceLoadError(code, sourceKind, cause) {
  const errorDefinition = SOURCE_LOAD_ERROR_DEFINITIONS[code];
  return new WebVowlOperationError({
    cause,
    code,
    details: sourceKindDetails(sourceKind),
    isRetryable: errorDefinition.isRetryable,
    message: errorDefinition.message,
  });
}

function rejectOntologySource(sourceKind, message, cause) {
  const rejectionCause =
    cause ?? new TypeError(message ?? "The ontology source is invalid.");
  return createSourceLoadError("SOURCE_REJECTED", sourceKind, rejectionCause);
}

function assertNonEmptyString(candidate, sourceKind, fieldName) {
  if (typeof candidate !== "string" || candidate.length === 0) {
    throw rejectOntologySource(
      sourceKind,
      `${fieldName} must be a non-empty string.`,
    );
  }
}

function validateOptionalDisplayName(displayName, sourceKind) {
  if (
    displayName !== undefined &&
    (typeof displayName !== "string" || displayName.length === 0)
  ) {
    throw rejectOntologySource(
      sourceKind,
      "displayName must be a non-empty string when provided.",
    );
  }
}

function validateRemoteSourceLocation(remoteSourceLocation, sourceKind) {
  assertNonEmptyString(
    remoteSourceLocation,
    sourceKind,
    "Remote source location",
  );
  if (
    remoteSourceLocation.length >
    WEB_VOWL_OPERATION_LIMITS.maxRemoteSourceLocationCharacters
  ) {
    throw rejectOntologySource(
      sourceKind,
      "The remote source location exceeds the character limit.",
    );
  }

  let parsedRemoteSourceLocation;
  try {
    parsedRemoteSourceLocation = new URL(remoteSourceLocation);
  } catch (cause) {
    throw rejectOntologySource(
      sourceKind,
      "The remote source location must be an absolute URL.",
      cause,
    );
  }

  if (
    parsedRemoteSourceLocation.protocol !== "http:" &&
    parsedRemoteSourceLocation.protocol !== "https:"
  ) {
    throw rejectOntologySource(
      sourceKind,
      "The remote source location must use HTTP or HTTPS.",
    );
  }
  if (
    parsedRemoteSourceLocation.username !== "" ||
    parsedRemoteSourceLocation.password !== ""
  ) {
    throw rejectOntologySource(
      sourceKind,
      "The remote source location must not contain credentials.",
    );
  }
}

function createValidatedOntologySourceLoadInput(source) {
  switch (source.kind) {
    case "ontology-document-iri":
      return Object.freeze({
        sourceVariantSnapshot: Object.freeze({
          documentIri: source.documentIri,
          kind: source.kind,
        }),
      });
    case "vowl-json-url":
      return Object.freeze({
        sourceVariantSnapshot: Object.freeze({
          kind: source.kind,
          url: source.url,
        }),
      });
    case "ontology-text":
      return Object.freeze({
        sourceVariantSnapshot: Object.freeze({
          displayName: source.displayName,
          format: source.format,
          kind: source.kind,
          text: source.text,
        }),
      });
    case "vowl-model":
      return Object.freeze({
        detachedVowlModelContent: cloneVowlModel(source.model),
        sourceVariantSnapshot: Object.freeze({
          displayName: source.displayName,
          kind: source.kind,
        }),
      });
    default:
      throw new TypeError("Cannot snapshot an unsupported ontology source.");
  }
}

function validateOntologySourceRequest(request, textEncoder) {
  if (
    request === null ||
    typeof request !== "object" ||
    Array.isArray(request) ||
    request.source === null ||
    typeof request.source !== "object" ||
    Array.isArray(request.source)
  ) {
    throw rejectOntologySource(
      undefined,
      "An ontology source request requires a source object.",
    );
  }

  const source = request.source;
  const sourceKind = source.kind;
  switch (sourceKind) {
    case "ontology-document-iri":
      validateRemoteSourceLocation(source.documentIri, sourceKind);
      break;
    case "vowl-json-url":
      validateRemoteSourceLocation(source.url, sourceKind);
      break;
    case "ontology-text": {
      if (typeof source.text !== "string") {
        throw rejectOntologySource(
          sourceKind,
          "Ontology text must be a string.",
        );
      }
      validateOptionalDisplayName(source.displayName, sourceKind);
      if (source.format === undefined && source.displayName === undefined) {
        throw rejectOntologySource(
          sourceKind,
          "Ontology text requires a format or displayName.",
        );
      }
      if (
        source.format !== undefined &&
        !ONTOLOGY_TEXT_PRIMARY_MEDIA_TYPE_BY_FORMAT_KEY.has(source.format)
      ) {
        throw rejectOntologySource(
          sourceKind,
          "The ontology-text format is not supported.",
        );
      }
      if (
        textEncoder.encode(source.text).byteLength >
        WEB_VOWL_OPERATION_LIMITS.maxInlineOntologyBytes
      ) {
        throw rejectOntologySource(
          sourceKind,
          "The inline ontology source exceeds the UTF-8 byte limit.",
        );
      }
      break;
    }
    case "vowl-model":
      validateOptionalDisplayName(source.displayName, sourceKind);
      if (
        source.model === null ||
        typeof source.model !== "object" ||
        Array.isArray(source.model)
      ) {
        throw rejectOntologySource(
          sourceKind,
          "A parsed VOWL source requires a model object.",
        );
      }
      break;
    default:
      throw rejectOntologySource(
        typeof sourceKind === "string" ? sourceKind : undefined,
        "The ontology source kind is not supported.",
      );
  }

  return createValidatedOntologySourceLoadInput(source);
}

function throwWhenLoadAborted(signal) {
  if (signal.aborted) {
    throw signal.reason;
  }
}

function reportLoadPhase(onPhaseChange, phase, signal) {
  throwWhenLoadAborted(signal);
  onPhaseChange?.(phase);
  throwWhenLoadAborted(signal);
}

function cloneVowlModel(vowlModel) {
  if (
    vowlModel === null ||
    typeof vowlModel !== "object" ||
    Array.isArray(vowlModel)
  ) {
    throw new InvalidVowlModelError("A VOWL model must be a non-array object.");
  }

  let clonedVowlModel;
  try {
    clonedVowlModel = structuredClone(vowlModel);
  } catch (cause) {
    throw new InvalidVowlModelError(
      "The VOWL model must contain structured-cloneable data.",
      { cause },
    );
  }

  if (
    clonedVowlModel.header === null ||
    typeof clonedVowlModel.header !== "object" ||
    Array.isArray(clonedVowlModel.header)
  ) {
    throw new InvalidVowlModelError(
      "A VOWL model requires an object-valued header.",
    );
  }
  for (const collectionFieldName of VOWL_COLLECTION_FIELD_NAMES) {
    if (
      clonedVowlModel[collectionFieldName] !== undefined &&
      !Array.isArray(clonedVowlModel[collectionFieldName])
    ) {
      throw new InvalidVowlModelError(
        `VOWL model ${collectionFieldName} must be an array when provided.`,
      );
    }
  }
  if (
    clonedVowlModel.diagnostics !== undefined &&
    !Array.isArray(clonedVowlModel.diagnostics)
  ) {
    throw new InvalidVowlModelError(
      "VOWL model diagnostics must be an array when provided.",
    );
  }

  const sourceDiagnostics = clonedVowlModel.diagnostics ?? [];
  delete clonedVowlModel.diagnostics;
  return { sourceDiagnostics, vowlModel: clonedVowlModel };
}

function boundedDiagnosticText(candidate, fallbackText) {
  const diagnosticText =
    typeof candidate === "string" && candidate.length > 0
      ? candidate
      : fallbackText;
  return truncateOntologyDerivedText(diagnosticText).ontologyDerivedText;
}

function diagnosticDocumentIri(sourceDiagnostic) {
  const documentIriCandidate =
    sourceDiagnostic.documentIri ?? sourceDiagnostic.documentIRI;
  if (typeof documentIriCandidate === "string") {
    return documentIriCandidate;
  }
  if (
    documentIriCandidate !== null &&
    typeof documentIriCandidate === "object" &&
    typeof documentIriCandidate.value === "string"
  ) {
    return documentIriCandidate.value;
  }
  return undefined;
}

function normalizeSourceDiagnostic(sourceDiagnostic) {
  const diagnosticRecord =
    sourceDiagnostic !== null && typeof sourceDiagnostic === "object"
      ? sourceDiagnostic
      : {};
  const normalizedDiagnostic = {
    code: boundedDiagnosticText(
      diagnosticRecord.code,
      "ONTOLOGY_LOAD_DIAGNOSTIC",
    ),
    message: boundedDiagnosticText(
      diagnosticRecord.message,
      "The ontology loader reported a diagnostic.",
    ),
    severity: diagnosticRecord.severity === "error" ? "error" : "warning",
  };
  const documentIri = diagnosticDocumentIri(diagnosticRecord);
  if (documentIri !== undefined) {
    normalizedDiagnostic.documentIri =
      truncateOntologyDerivedText(documentIri).ontologyDerivedText;
  }
  return Object.freeze(normalizedDiagnostic);
}

function createBoundedDiagnostics(
  sourceDiagnostics,
  sourceFingerprintDiagnostic,
) {
  const fingerprintDiagnosticCount =
    sourceFingerprintDiagnostic === undefined ? 0 : 1;
  const parserDiagnosticLimit =
    WEB_VOWL_OPERATION_LIMITS.maxWarnings - fingerprintDiagnosticCount;
  const { retainedEntries } = truncateResultCollection(
    sourceDiagnostics,
    parserDiagnosticLimit,
  );
  const boundedDiagnostics = retainedEntries.map(normalizeSourceDiagnostic);
  if (sourceFingerprintDiagnostic !== undefined) {
    boundedDiagnostics.push(sourceFingerprintDiagnostic);
  }
  return Object.freeze(boundedDiagnostics);
}

function nonNegativeCount(metricCount, fallbackCount = 0) {
  if (Number.isSafeInteger(metricCount) && metricCount >= 0) {
    return metricCount;
  }
  return Number.isSafeInteger(fallbackCount) && fallbackCount >= 0
    ? fallbackCount
    : 0;
}

function countVowlBaseRecordType(baseRecords, recordType) {
  return Array.isArray(baseRecords)
    ? baseRecords.filter((baseRecord) => baseRecord?.type === recordType).length
    : 0;
}

function countUniqueIndividualIris(classAttributes) {
  if (!Array.isArray(classAttributes)) {
    return 0;
  }

  const individualIris = new Set();
  for (const classAttribute of classAttributes) {
    if (!Array.isArray(classAttribute?.individuals)) {
      continue;
    }
    for (const individual of classAttribute.individuals) {
      if (typeof individual?.iri === "string") {
        individualIris.add(individual.iri);
      }
    }
  }
  return individualIris.size;
}

function createStructuralCounts(vowlModel) {
  const metrics =
    vowlModel.metrics !== null && typeof vowlModel.metrics === "object"
      ? vowlModel.metrics
      : {};
  const classAttributes = vowlModel.classAttribute;
  return Object.freeze({
    classes: nonNegativeCount(
      metrics.classCount,
      countVowlBaseRecordType(vowlModel.class, "owl:Class"),
    ),
    datatypes: nonNegativeCount(
      metrics.datatypeCount,
      countVowlBaseRecordType(vowlModel.class, "rdfs:Datatype") +
        countVowlBaseRecordType(vowlModel.datatype, "rdfs:Datatype"),
    ),
    individuals: nonNegativeCount(
      metrics.individualCount,
      countUniqueIndividualIris(classAttributes),
    ),
    properties: nonNegativeCount(
      metrics.propertyCount,
      Array.isArray(vowlModel.property) ? vowlModel.property.length : 0,
    ),
  });
}

function sourceProvenanceWithoutFingerprint(source, remoteIdentity) {
  const sourceProvenance = { kind: source.kind };
  if (remoteIdentity !== undefined) {
    sourceProvenance.identity = remoteIdentity;
  }
  if (source.displayName !== undefined) {
    sourceProvenance.displayName = source.displayName;
  }
  return sourceProvenance;
}

async function computeSha256HexWithWebCrypto(sourceBytes) {
  const subtleCrypto = globalThis.crypto?.subtle;
  if (typeof subtleCrypto?.digest !== "function") {
    throw new TypeError("Web Crypto SHA-256 is unavailable.");
  }
  const digestBytes = new Uint8Array(
    await subtleCrypto.digest("SHA-256", sourceBytes),
  );
  return Array.from(digestBytes, (digestByte) =>
    digestByte.toString(16).padStart(2, "0"),
  ).join("");
}

function mapExpectedSourceLoadError(error, { loadPhase, signal, sourceKind }) {
  if (error instanceof WebVowlOperationError) {
    return error;
  }
  if (signal.aborted) {
    return createSourceLoadError("LOAD_ABORTED", sourceKind, signal.reason);
  }
  if (
    error instanceof SecurityPolicyError ||
    error instanceof ResourceLimitError
  ) {
    return createSourceLoadError("SOURCE_REJECTED", sourceKind, error);
  }
  if (loadPhase === "loading" && error instanceof DocumentLoadError) {
    return createSourceLoadError("FETCH_FAILED", sourceKind, error);
  }
  if (
    error instanceof InvalidVowlModelError ||
    error instanceof OWLOntologyCreationError ||
    error instanceof OWLParserError ||
    error instanceof UnparsableOntologyException ||
    (sourceKind === "vowl-json-url" && error instanceof SyntaxError)
  ) {
    return createSourceLoadError("PARSE_FAILED", sourceKind, error);
  }
  if (error instanceof DocumentLoadError) {
    return createSourceLoadError("IMPORT_FAILED", sourceKind, error);
  }
  return error;
}

function createParserConfiguration(rootLoaderConfiguration) {
  return Object.freeze({
    maxImportCount: rootLoaderConfiguration.maxImportCount,
    maxImportDepth: rootLoaderConfiguration.maxImportDepth,
    signal: rootLoaderConfiguration.signal,
  });
}

function parserOptionsFromRemoteDocument(remoteDocument, parserConfiguration) {
  return {
    configuration: parserConfiguration,
    contentType: remoteDocument.getContentType(),
    documentIRI: remoteDocument.getDocumentIRI()?.value,
    fileName: remoteDocument.getFileName(),
  };
}

export function createOntologySourceLoader({
  computeSha256Hex = computeSha256HexWithWebCrypto,
  createImportResolver = () => new WebVowlImportResolver(),
  loadWithImports = productionLoadWithImports,
} = {}) {
  if (typeof computeSha256Hex !== "function") {
    throw new TypeError("computeSha256Hex must be a function.");
  }
  if (typeof createImportResolver !== "function") {
    throw new TypeError("createImportResolver must be a function.");
  }
  if (typeof loadWithImports !== "function") {
    throw new TypeError("loadWithImports must be a function.");
  }

  const textEncoder = new TextEncoder();

  return Object.freeze({
    async loadOntologySource(request, { onPhaseChange, signal } = {}) {
      if (onPhaseChange !== undefined && typeof onPhaseChange !== "function") {
        throw new TypeError("onPhaseChange must be a function when provided.");
      }

      const cancellationSignal = AbortSignal.any(
        signal === undefined ? [] : [signal],
      );
      let loadPhase = "validating";
      const requestedSourceKind =
        typeof request?.source?.kind === "string"
          ? request.source.kind
          : undefined;
      let source;

      try {
        throwWhenLoadAborted(cancellationSignal);

        const ontologySourceLoadInput = validateOntologySourceRequest(
          request,
          textEncoder,
        );
        source = ontologySourceLoadInput.sourceVariantSnapshot;

        let remoteIdentity;
        let sourceBytes;
        let sourceDiagnostics;
        let vowlModel;

        if (
          source.kind === "ontology-document-iri" ||
          source.kind === "vowl-json-url"
        ) {
          loadPhase = "loading";
          reportLoadPhase(onPhaseChange, loadPhase, cancellationSignal);
          const rootLoaderConfiguration = new OWLOntologyLoaderConfiguration({
            signal: cancellationSignal,
          });
          const remoteDocument = await createImportResolver().load(
            source.kind === "ontology-document-iri"
              ? source.documentIri
              : source.url,
            {
              config: rootLoaderConfiguration,
              signal: cancellationSignal,
            },
          );
          throwWhenLoadAborted(cancellationSignal);

          const remoteText = remoteDocument.getText();
          sourceBytes = textEncoder.encode(remoteText);
          remoteIdentity = remoteDocument.getDocumentIRI()?.value;
          loadPhase = "parsing";
          reportLoadPhase(onPhaseChange, loadPhase, cancellationSignal);

          if (source.kind === "ontology-document-iri") {
            const parsedVowlModel = await loadWithImports(
              remoteText,
              parserOptionsFromRemoteDocument(
                remoteDocument,
                createParserConfiguration(rootLoaderConfiguration),
              ),
            );
            ({ sourceDiagnostics, vowlModel } =
              cloneVowlModel(parsedVowlModel));
          } else {
            ({ sourceDiagnostics, vowlModel } = cloneVowlModel(
              JSON.parse(remoteText),
            ));
          }
        } else if (source.kind === "ontology-text") {
          sourceBytes = textEncoder.encode(source.text);
          const rootLoaderConfiguration = new OWLOntologyLoaderConfiguration({
            signal: cancellationSignal,
          });
          loadPhase = "parsing";
          reportLoadPhase(onPhaseChange, loadPhase, cancellationSignal);
          const parsedVowlModel = await loadWithImports(source.text, {
            configuration: createParserConfiguration(rootLoaderConfiguration),
            contentType:
              source.format === undefined
                ? undefined
                : ONTOLOGY_TEXT_PRIMARY_MEDIA_TYPE_BY_FORMAT_KEY.get(
                    source.format,
                  ),
            fileName: source.displayName,
          });
          ({ sourceDiagnostics, vowlModel } = cloneVowlModel(parsedVowlModel));
        } else {
          loadPhase = "parsing";
          reportLoadPhase(onPhaseChange, loadPhase, cancellationSignal);
          ({ sourceDiagnostics, vowlModel } =
            ontologySourceLoadInput.detachedVowlModelContent);
        }

        throwWhenLoadAborted(cancellationSignal);
        const sourceProvenance = sourceProvenanceWithoutFingerprint(
          source,
          remoteIdentity,
        );
        let sourceFingerprintDiagnostic;
        if (sourceBytes !== undefined) {
          try {
            sourceProvenance.sha256Hex = await computeSha256Hex(sourceBytes);
          } catch {
            throwWhenLoadAborted(cancellationSignal);
            sourceFingerprintDiagnostic = SOURCE_SHA256_UNAVAILABLE_DIAGNOSTIC;
          }
        }
        throwWhenLoadAborted(cancellationSignal);

        return Object.freeze({
          vowlModel,
          diagnostics: createBoundedDiagnostics(
            sourceDiagnostics,
            sourceFingerprintDiagnostic,
          ),
          sourceProvenance: Object.freeze(sourceProvenance),
          structuralCounts: createStructuralCounts(vowlModel),
        });
      } catch (error) {
        throw mapExpectedSourceLoadError(error, {
          loadPhase,
          signal: cancellationSignal,
          sourceKind: source?.kind ?? requestedSourceKind,
        });
      }
    },
  });
}
