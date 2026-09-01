import { createSvgViewRecipe } from "./svgSerializer.js";
import {
  normalizeSvgFilename,
  WebVowlOperationError,
} from "./webVowlControllerContracts.js";

const SVG_MEDIA_TYPE = "image/svg+xml";
const SVG_ARTIFACT_SERVICE_DEPENDENCY_FIELD_NAMES = Object.freeze([
  "svgSerializer",
  "webCrypto",
  "BlobConstructor",
  "objectUrlApi",
  "svgArtifactPublicationPort",
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
  svgArtifactPublicationPort,
}) {
  if (typeof svgSerializer?.serializeRenderedSvgSnapshot !== "function") {
    throw new TypeError(
      "svgSerializer.serializeRenderedSvgSnapshot must be a function.",
    );
  }
  if (
    typeof svgArtifactPublicationPort?.publishPageLocalSvgArtifact !==
    "function"
  ) {
    throw new TypeError(
      "svgArtifactPublicationPort.publishPageLocalSvgArtifact must be a function.",
    );
  }
}

function assertOperationOptions(options) {
  assertAllowedFieldNames(options, ["signal"], "SVG artifact options");
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
    message: "The SVG artifact could not be created in this browser.",
  });
}

function createSerializedSvgBlob(serializedSvgText, BlobConstructor) {
  if (typeof BlobConstructor !== "function") {
    throw createExportFailure(
      "blob-creation",
      new TypeError("The Blob constructor is unavailable."),
    );
  }
  try {
    const serializedSvgBlob = new BlobConstructor([serializedSvgText], {
      type: SVG_MEDIA_TYPE,
    });
    if (typeof serializedSvgBlob.arrayBuffer !== "function") {
      throw new TypeError("The created Blob does not expose arrayBuffer().");
    }
    return serializedSvgBlob;
  } catch (error) {
    if (error instanceof WebVowlOperationError) {
      throw error;
    }
    throw createExportFailure("blob-creation", error);
  }
}

async function computeSha256Hex(serializedSvgBytes, webCrypto) {
  if (typeof webCrypto?.subtle?.digest !== "function") {
    throw createExportFailure(
      "sha256",
      new TypeError("Web Crypto SHA-256 is unavailable."),
    );
  }
  try {
    const digestBytes = new Uint8Array(
      await webCrypto.subtle.digest("SHA-256", serializedSvgBytes),
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

function createPageLocalObjectUrl(serializedSvgBlob, objectUrlApi) {
  if (typeof objectUrlApi?.createObjectURL !== "function") {
    throw createExportFailure(
      "object-url-creation",
      new TypeError("URL.createObjectURL is unavailable."),
    );
  }
  try {
    return objectUrlApi.createObjectURL(serializedSvgBlob);
  } catch (error) {
    throw createExportFailure("object-url-creation", error);
  }
}

function revokePageLocalObjectUrl(objectUrlApi, objectUrl) {
  if (typeof objectUrlApi?.revokeObjectURL === "function") {
    objectUrlApi.revokeObjectURL(objectUrl);
  }
}

export function createSvgArtifactService(dependencies) {
  assertExactDependencyFieldNames(
    dependencies,
    SVG_ARTIFACT_SERVICE_DEPENDENCY_FIELD_NAMES,
    "SVG artifact service dependencies",
  );
  const {
    svgSerializer,
    webCrypto,
    BlobConstructor,
    objectUrlApi,
    svgArtifactPublicationPort,
  } = dependencies;
  assertArtifactServiceDependencies({
    svgSerializer,
    svgArtifactPublicationPort,
  });

  let isDisposed = false;
  let nextPageLocalArtifactSequence = 1;
  let currentObjectUrl;

  return Object.freeze({
    async createSvgArtifact(request, options = {}) {
      assertExactFieldNames(
        request,
        SVG_ARTIFACT_REQUEST_FIELD_NAMES,
        "SVG artifact request",
      );
      assertOperationOptions(options);
      throwIfOperationAborted(options.signal);
      if (isDisposed) {
        throw createExportFailure(
          "artifact-lifecycle",
          new Error("The SVG artifact service has been disposed."),
        );
      }
      assertExactFieldNames(
        request.viewRecipe,
        UNIDENTIFIED_SVG_VIEW_RECIPE_FIELD_NAMES,
        "unidentified SVG view recipe",
      );

      const pageLocalArtifactSequence = nextPageLocalArtifactSequence;
      nextPageLocalArtifactSequence += 1;
      const loadGeneration = request.viewRecipe?.loadGeneration;
      const pageLocalArtifactId = `svg-artifact-${loadGeneration}-${pageLocalArtifactSequence}`;
      const pageLocalViewRecipeId = `svg-view-recipe-${loadGeneration}-${pageLocalArtifactSequence}`;
      const identifiedViewRecipe = createSvgViewRecipe({
        ...request.viewRecipe,
        pageLocalViewRecipeId,
      });
      const serializedSvgText = svgSerializer.serializeRenderedSvgSnapshot(
        {
          renderedSvgSnapshot: request.renderedSvgSnapshot,
          viewRecipe: identifiedViewRecipe,
        },
        { signal: options.signal },
      );
      throwIfOperationAborted(options.signal);

      const serializedSvgBlob = createSerializedSvgBlob(
        serializedSvgText,
        BlobConstructor,
      );
      let serializedSvgBytes;
      try {
        serializedSvgBytes = await serializedSvgBlob.arrayBuffer();
      } catch (error) {
        throw createExportFailure("blob-creation", error);
      }
      throwIfOperationAborted(options.signal);
      if (isDisposed) {
        throw createExportFailure(
          "artifact-lifecycle",
          new Error("The SVG artifact service was disposed during export."),
        );
      }
      const sha256Hex = await computeSha256Hex(serializedSvgBytes, webCrypto);
      throwIfOperationAborted(options.signal);
      if (isDisposed) {
        throw createExportFailure(
          "artifact-lifecycle",
          new Error("The SVG artifact service was disposed during export."),
        );
      }

      const metadata = Object.freeze({
        pageLocalArtifactId,
        filename: normalizeSvgFilename(request.filename),
        mediaType: SVG_MEDIA_TYPE,
        byteLength: serializedSvgBlob.size,
        sha256Hex,
        pageLocalViewRecipeId,
        viewRecipe: identifiedViewRecipe,
      });
      const replacementObjectUrl = createPageLocalObjectUrl(
        serializedSvgBlob,
        objectUrlApi,
      );

      try {
        throwIfOperationAborted(options.signal);
        svgArtifactPublicationPort.publishPageLocalSvgArtifact({
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
