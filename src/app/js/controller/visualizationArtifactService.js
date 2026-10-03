import { createSvgViewRecipe } from "./svgSerializer.js";
import { serializeRenderedDrawingAsTikz } from "./tikzSerializer.js";
import {
  normalizeVisualizationFilename,
  normalizeCanonicalVowlFilename,
  normalizeOriginalSourceFilename,
  VISUALIZATION_ARTIFACT_FORMATS,
  WebVowlOperationError,
} from "./webVowlControllerContracts.js";

const VISUALIZATION_ARTIFACT_SERVICE_DEPENDENCY_FIELD_NAMES = Object.freeze([
  "svgSerializer",
  "webCrypto",
  "BlobConstructor",
  "objectUrlApi",
  "visualizationArtifactPublicationPort",
]);
const SVG_ARTIFACT_REQUEST_FIELD_NAMES = Object.freeze([
  "renderedSvgSnapshot",
  "filename",
  "viewRecipe",
]);
const UNIDENTIFIED_SVG_VIEW_RECIPE_FIELD_NAMES = Object.freeze([
  "source",
  "loadGeneration",
  "appliedVisualizationView",
  "viewportDimensions",
  "layoutOutcome",
]);

function isPlainRecord(candidate) {
  if (
    candidate === null ||
    typeof candidate !== "object" ||
    Array.isArray(candidate)
  ) {
    return false;
  }
  const candidatePrototype = Object.getPrototypeOf(candidate);
  return (
    candidatePrototype === null ||
    Object.getPrototypeOf(candidatePrototype) === null
  );
}

function assertPlainRecord(candidate, description) {
  if (!isPlainRecord(candidate)) {
    throw new TypeError(`${description} must be a plain object.`);
  }
}

function assertExactFieldNames(record, expectedFieldNames, description) {
  assertPlainRecord(record, description);
  const actualFieldNames = Object.keys(record).sort();
  const sortedExpectedFieldNames = [...expectedFieldNames].sort();
  if (
    actualFieldNames.length !== sortedExpectedFieldNames.length ||
    actualFieldNames.some(
      (fieldName, index) => fieldName !== sortedExpectedFieldNames[index],
    )
  ) {
    throw new TypeError(`${description} has an invalid field set.`);
  }
}

function assertExactDependencyFieldNames(
  dependencies,
  expectedFieldNames,
  description,
) {
  assertPlainRecord(dependencies, description);
  const actualFieldNames = Object.keys(dependencies).sort();
  const sortedExpectedFieldNames = [...expectedFieldNames].sort();
  if (
    actualFieldNames.length !== sortedExpectedFieldNames.length ||
    actualFieldNames.some(
      (fieldName, index) => fieldName !== sortedExpectedFieldNames[index],
    )
  ) {
    throw new TypeError(`${description} has an invalid dependency field set.`);
  }
}

function assertAllowedFieldNames(record, allowedFieldNames, description) {
  assertPlainRecord(record, description);
  const unsupportedFieldName = Object.keys(record).find(
    (fieldName) => !allowedFieldNames.includes(fieldName),
  );
  if (unsupportedFieldName !== undefined) {
    throw new TypeError(
      `${description} contains unsupported field ${unsupportedFieldName}.`,
    );
  }
}

function assertArtifactServiceDependencies({
  svgSerializer,
  visualizationArtifactPublicationPort,
}) {
  if (typeof svgSerializer?.serializeRenderedSvgSnapshot !== "function") {
    throw new TypeError(
      "svgSerializer.serializeRenderedSvgSnapshot must be a function.",
    );
  }
  if (
    typeof visualizationArtifactPublicationPort?.publishPageLocalArtifact !==
    "function"
  ) {
    throw new TypeError(
      "visualizationArtifactPublicationPort.publishPageLocalArtifact must be a function.",
    );
  }
}

function assertOperationOptions(options) {
  assertAllowedFieldNames(
    options,
    ["signal"],
    "Visualization artifact options",
  );
}

function throwIfOperationAborted(signal) {
  if (signal === undefined) {
    return;
  }
  if (typeof signal?.throwIfAborted !== "function") {
    throw new TypeError("signal must be an AbortSignal when provided.");
  }
  signal.throwIfAborted();
}

function createExportFailure(exportStage, cause) {
  return new WebVowlOperationError({
    cause,
    code: "EXPORT_FAILED",
    details: { exportStage },
    message: "The visualization artifact could not be created in this browser.",
  });
}

function createSerializedArtifactBlob(
  serializedArtifactText,
  mediaType,
  BlobConstructor,
) {
  if (typeof BlobConstructor !== "function") {
    throw createExportFailure(
      "blob-creation",
      new TypeError("The Blob constructor is unavailable."),
    );
  }
  try {
    const serializedArtifactBlob = new BlobConstructor(
      [serializedArtifactText],
      {
        type: mediaType,
      },
    );
    if (typeof serializedArtifactBlob.arrayBuffer !== "function") {
      throw new TypeError("The created Blob does not expose arrayBuffer().");
    }
    return serializedArtifactBlob;
  } catch (error) {
    if (error instanceof WebVowlOperationError) {
      throw error;
    }
    throw createExportFailure("blob-creation", error);
  }
}

async function computeSha256Hex(serializedArtifactBytes, webCrypto) {
  if (typeof webCrypto?.subtle?.digest !== "function") {
    throw createExportFailure(
      "sha256",
      new TypeError("Web Crypto SHA-256 is unavailable."),
    );
  }
  try {
    const digestBytes = new Uint8Array(
      await webCrypto.subtle.digest("SHA-256", serializedArtifactBytes),
    );
    if (digestBytes.byteLength !== 32) {
      throw new TypeError("Web Crypto returned an invalid SHA-256 digest.");
    }
    return Array.from(digestBytes, (digestByte) =>
      digestByte.toString(16).padStart(2, "0"),
    ).join("");
  } catch (error) {
    if (error instanceof WebVowlOperationError) {
      throw error;
    }
    throw createExportFailure("sha256", error);
  }
}

function createPageLocalObjectUrl(serializedArtifactBlob, objectUrlApi) {
  if (typeof objectUrlApi?.createObjectURL !== "function") {
    throw createExportFailure(
      "object-url-creation",
      new TypeError("URL.createObjectURL is unavailable."),
    );
  }
  try {
    return objectUrlApi.createObjectURL(serializedArtifactBlob);
  } catch (error) {
    throw createExportFailure("object-url-creation", error);
  }
}

function revokePageLocalObjectUrl(objectUrlApi, objectUrl) {
  if (typeof objectUrlApi?.revokeObjectURL === "function") {
    objectUrlApi.revokeObjectURL(objectUrl);
  }
}

export function createVisualizationArtifactService(dependencies) {
  assertExactDependencyFieldNames(
    dependencies,
    VISUALIZATION_ARTIFACT_SERVICE_DEPENDENCY_FIELD_NAMES,
    "Visualization artifact service dependencies",
  );
  const {
    svgSerializer,
    webCrypto,
    BlobConstructor,
    objectUrlApi,
    visualizationArtifactPublicationPort,
  } = dependencies;
  assertArtifactServiceDependencies({
    svgSerializer,
    visualizationArtifactPublicationPort,
  });

  let isDisposed = false;
  let nextPageLocalArtifactSequence = 1;
  let currentObjectUrl;

  async function publishSerializedArtifact(
    serialized,
    {
      format,
      filename,
      pageLocalArtifactId,
      provenance,
      mediaType = VISUALIZATION_ARTIFACT_FORMATS[format]?.mediaType,
    },
    options,
  ) {
    const blob = createSerializedArtifactBlob(
      serialized,
      mediaType,
      BlobConstructor,
    );
    let bytes;
    try {
      bytes = await blob.arrayBuffer();
    } catch (error) {
      throw createExportFailure("blob-creation", error);
    }
    function checkCurrent() {
      throwIfOperationAborted(options.signal);
      if (isDisposed) {
        throw createExportFailure(
          "artifact-lifecycle",
          new Error(
            "The visualization artifact service was disposed during export.",
          ),
        );
      }
    }
    checkCurrent();
    const sha256Hex = await computeSha256Hex(bytes, webCrypto);
    checkCurrent();
    const metadata = Object.freeze({
      format,
      pageLocalArtifactId,
      filename,
      mediaType,
      byteLength: blob.size,
      sha256Hex,
      ...provenance,
    });
    const replacementObjectUrl = createPageLocalObjectUrl(blob, objectUrlApi);
    try {
      checkCurrent();
      visualizationArtifactPublicationPort.publishPageLocalArtifact({
        metadata,
        objectUrl: replacementObjectUrl,
      });
    } catch (error) {
      revokePageLocalObjectUrl(objectUrlApi, replacementObjectUrl);
      throw error;
    }
    const replacedObjectUrl = currentObjectUrl;
    currentObjectUrl = replacementObjectUrl;
    if (replacedObjectUrl !== undefined) {
      revokePageLocalObjectUrl(objectUrlApi, replacedObjectUrl);
    }
    return metadata;
  }

  return Object.freeze({
    /** Preserve exact package bytes and scope without parsing or re-encoding. */
    async createSemanticSourceArtifact(request, options = {}) {
      assertExactFieldNames(
        request,
        ["bytes", "filename", "loadGeneration", "source", "scope", "format"],
        "Semantic source artifact",
      );
      assertOperationOptions(options);
      throwIfOperationAborted(options.signal);
      if (
        !(request.bytes instanceof Uint8Array) ||
        !Number.isSafeInteger(request.loadGeneration) ||
        request.loadGeneration < 1 ||
        !["original-source", "turtle"].includes(request.format)
      ) {
        throw new TypeError(
          "Semantic publication requires bytes, a supported format and a load generation.",
        );
      }
      return publishSerializedArtifact(
        request.bytes.slice(),
        {
          format: request.format,
          // Original inputs are downloads, never active content in a browser tab.
          mediaType:
            request.format === "original-source"
              ? "application/octet-stream"
              : "text/turtle",
          filename:
            request.format === "original-source"
              ? normalizeOriginalSourceFilename(request.filename)
              : normalizeVisualizationFilename(request.filename, "turtle"),
          pageLocalArtifactId: `${request.format}-artifact-${request.loadGeneration}-${nextPageLocalArtifactSequence++}`,
          provenance: {
            loadGeneration: request.loadGeneration,
            source: Object.freeze(structuredClone(request.source)),
            scope: Object.freeze(structuredClone(request.scope)),
          },
        },
        options,
      );
    },
    /** Publish bytes admitted and encoded by the worker without parsing/re-encoding. */
    async createCanonicalVowlArtifact(request, options = {}) {
      assertExactFieldNames(
        request,
        ["bytes", "filename", "loadGeneration", "source"],
        "Canonical VOWL artifact request",
      );
      assertOperationOptions(options);
      throwIfOperationAborted(options.signal);
      if (
        !(request.bytes instanceof Uint8Array) ||
        request.bytes.byteLength === 0 ||
        !Number.isSafeInteger(request.loadGeneration) ||
        request.loadGeneration < 1
      ) {
        throw new TypeError(
          "Canonical publication requires encoded bytes and a positive load generation.",
        );
      }
      if (isDisposed) {
        throw createExportFailure(
          "artifact-lifecycle",
          new Error("The visualization artifact service has been disposed."),
        );
      }
      return publishSerializedArtifact(
        request.bytes.slice(),
        {
          format: "vowl-json",
          filename: normalizeCanonicalVowlFilename(request.filename),
          pageLocalArtifactId: `vowl-json-artifact-${request.loadGeneration}-${nextPageLocalArtifactSequence++}`,
          provenance: {
            loadGeneration: request.loadGeneration,
            source: Object.freeze(structuredClone(request.source)),
          },
        },
        options,
      );
    },
    async createVisualizationArtifact(request, options = {}) {
      const format = request?.format ?? "svg";
      if (!["svg", "turtle", "latex"].includes(format)) {
        throw new TypeError("Unsupported visualization artifact format.");
      }
      const { format: requestedFormat, ...formatRequest } = request;
      void requestedFormat;
      assertExactFieldNames(
        formatRequest,
        format === "svg"
          ? SVG_ARTIFACT_REQUEST_FIELD_NAMES
          : format === "latex"
            ? ["filename", "source", "renderedDrawingSnapshot"]
            : ["filename", "source", "turtleDocumentSnapshot"],
        "Visualization artifact request",
      );
      assertOperationOptions(options);
      throwIfOperationAborted(options.signal);
      if (isDisposed) {
        throw createExportFailure(
          "artifact-lifecycle",
          new Error("The visualization artifact service has been disposed."),
        );
      }
      const pageLocalArtifactSequence = nextPageLocalArtifactSequence;
      nextPageLocalArtifactSequence += 1;
      const loadGeneration =
        format === "svg"
          ? request.viewRecipe?.loadGeneration
          : format === "latex"
            ? request.renderedDrawingSnapshot?.loadGeneration
            : request.turtleDocumentSnapshot?.loadGeneration;
      if (!Number.isSafeInteger(loadGeneration) || loadGeneration < 1) {
        throw new TypeError("An artifact requires a positive load generation.");
      }
      const pageLocalArtifactId = `${format}-artifact-${loadGeneration}-${pageLocalArtifactSequence}`;
      let serializedArtifactText;
      let provenance;
      if (format === "svg") {
        assertExactFieldNames(
          request.viewRecipe,
          UNIDENTIFIED_SVG_VIEW_RECIPE_FIELD_NAMES,
          "unidentified SVG view recipe",
        );
        const pageLocalViewRecipeId = `svg-view-recipe-${loadGeneration}-${pageLocalArtifactSequence}`;
        const viewRecipe = createSvgViewRecipe({
          ...request.viewRecipe,
          pageLocalViewRecipeId,
        });
        provenance = { pageLocalViewRecipeId, viewRecipe };
        serializedArtifactText = svgSerializer.serializeRenderedSvgSnapshot(
          { renderedSvgSnapshot: request.renderedSvgSnapshot, viewRecipe },
          { signal: options.signal },
        );
      } else if (format === "turtle") {
        assertExactFieldNames(
          request.turtleDocumentSnapshot,
          ["loadGeneration", "turtleText"],
          "Turtle document snapshot",
        );
        if (typeof request.turtleDocumentSnapshot.turtleText !== "string") {
          throw new TypeError("Turtle document text must be a string.");
        }
        serializedArtifactText = request.turtleDocumentSnapshot.turtleText;
        provenance = {
          loadGeneration,
          source: Object.freeze({ ...request.source }),
        };
      } else if (format === "latex") {
        serializedArtifactText = `% WebVOWL source: ${JSON.stringify(request.source)}\n${serializeRenderedDrawingAsTikz(request.renderedDrawingSnapshot)}`;
        provenance = {
          loadGeneration,
          source: Object.freeze({ ...request.source }),
        };
      }
      throwIfOperationAborted(options.signal);

      return publishSerializedArtifact(
        serializedArtifactText,
        {
          format,
          pageLocalArtifactId,
          filename: normalizeVisualizationFilename(request.filename, format),
          provenance,
        },
        options,
      );
    },

    dispose() {
      if (isDisposed) {
        return;
      }
      isDisposed = true;
      if (currentObjectUrl !== undefined) {
        revokePageLocalObjectUrl(objectUrlApi, currentObjectUrl);
        currentObjectUrl = undefined;
      }
    },
  });
}
