import { createSvgViewRecipe } from "./svgSerializer.js";
import { serializeRenderedDrawingAsTikz } from "./tikzSerializer.js";
import {
  normalizeVisualizationFilename,
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

  return Object.freeze({
    async createVisualizationArtifact(request, options = {}) {
      const format = request?.format ?? "svg";
      if (!["svg", "vowl-json", "turtle", "latex"].includes(format)) {
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
            : format === "turtle"
              ? ["filename", "source", "turtleDocumentSnapshot"]
              : ["filename", "vowlDocument"],
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
            : format === "turtle"
              ? request.turtleDocumentSnapshot?.loadGeneration
              : request.vowlDocument?.loadGeneration;
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
      } else {
        assertExactFieldNames(
          request.vowlDocument,
          ["loadGeneration", "source", "vowlModel"],
          "VOWL visualization document",
        );
        serializedArtifactText = serializeVowlJson(
          request.vowlDocument.vowlModel,
        );
        provenance = {
          loadGeneration,
          source: Object.freeze({ ...request.vowlDocument.source }),
        };
      }
      throwIfOperationAborted(options.signal);

      const serializedArtifactBlob = createSerializedArtifactBlob(
        serializedArtifactText,
        VISUALIZATION_ARTIFACT_FORMATS[format].mediaType,
        BlobConstructor,
      );
      let serializedArtifactBytes;
      try {
        serializedArtifactBytes = await serializedArtifactBlob.arrayBuffer();
      } catch (error) {
        throw createExportFailure("blob-creation", error);
      }
      throwIfOperationAborted(options.signal);
      if (isDisposed) {
        throw createExportFailure(
          "artifact-lifecycle",
          new Error(
            "The visualization artifact service was disposed during export.",
          ),
        );
      }
      const sha256Hex = await computeSha256Hex(
        serializedArtifactBytes,
        webCrypto,
      );
      throwIfOperationAborted(options.signal);
      if (isDisposed) {
        throw createExportFailure(
          "artifact-lifecycle",
          new Error(
            "The visualization artifact service was disposed during export.",
          ),
        );
      }

      const metadata = Object.freeze({
        format,
        pageLocalArtifactId,
        filename: normalizeVisualizationFilename(request.filename, format),
        mediaType: VISUALIZATION_ARTIFACT_FORMATS[format].mediaType,
        byteLength: serializedArtifactBlob.size,
        sha256Hex,
        ...provenance,
      });
      const replacementObjectUrl = createPageLocalObjectUrl(
        serializedArtifactBlob,
        objectUrlApi,
      );

      try {
        throwIfOperationAborted(options.signal);
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

function serializeVowlJson(vowlModel) {
  assertPlainRecord(vowlModel, "VOWL document model");
  const model = structuredClone(vowlModel);
  for (const name of [
    "class",
    "classAttribute",
    "datatype",
    "datatypeAttribute",
    "property",
    "propertyAttribute",
    "namespace",
  ]) {
    if (!Array.isArray(model[name])) {
      continue;
    }
    const baseName = name.replace(/Attribute$/u, "");
    const attributesById = new Map(
      (model[`${baseName}Attribute`] ?? []).map((record) => [
        String(record.id),
        record,
      ]),
    );
    model[name].sort((left, right) => {
      const leftIri =
        left.iri ?? attributesById.get(String(left.id))?.iri ?? "";
      const rightIri =
        right.iri ?? attributesById.get(String(right.id))?.iri ?? "";
      if (name !== "namespace" && leftIri !== rightIri) {
        return leftIri < rightIri ? -1 : 1;
      }
      const leftIdentity = String(left.id ?? left.prefix ?? "");
      const rightIdentity = String(right.id ?? right.prefix ?? "");
      return leftIdentity < rightIdentity
        ? -1
        : leftIdentity > rightIdentity
          ? 1
          : 0;
    });
    for (const record of model[name]) {
      for (const field of [
        "attributes",
        "subproperty",
        "superproperty",
        "equivalent",
        "equivalents",
      ]) {
        if (
          Array.isArray(record[field]) &&
          record[field].every((value) => typeof value === "string")
        ) {
          record[field].sort();
        }
      }
    }
  }
  const propertyNames = new Set();
  JSON.stringify(model, (name, value) => {
    propertyNames.add(name);
    return value;
  });
  return JSON.stringify(model, [...propertyNames].sort(), 2);
}
