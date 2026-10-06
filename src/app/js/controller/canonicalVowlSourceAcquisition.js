import { OWLDocumentFormats } from "owlapi/formats";
import { OWLOntologyLoaderConfiguration } from "owlapi/model";
import { WebVowlImportResolver } from "./importResolver.js";

function formatRequired(candidates) {
  const error = new Error(
    "Choose the document's OWL syntax before loading it.",
  );
  error.code = "OWL_FORMAT_SELECTION_REQUIRED";
  error.formats = candidates.map(({ key }) => key);
  return error;
}

function resourceLimit(message, resource) {
  const error = new RangeError(message);
  error.code = "RESOURCE_LIMIT_EXCEEDED";
  error.stage = "acquisition";
  error.resource = resource;
  return error;
}

/** Choose only from the owning package's public metadata, without syntax probes. */
export function selectCanonicalOwlMediaType({
  format,
  contentType,
  fileName,
} = {}) {
  const formats = Object.values(OWLDocumentFormats);
  if (format !== undefined) {
    const selected = formats.find(({ key }) => key === format);
    if (!selected) {
      throw formatRequired(formats);
    }
    return selected.mediaTypes[0];
  }
  const mediaType = contentType?.split(";", 1)[0].trim().toLowerCase();
  const byMediaType = formats.filter(({ mediaTypes }) =>
    mediaTypes.includes(mediaType),
  );
  if (byMediaType.length === 1) {
    return mediaType;
  }
  if (byMediaType.length > 1) {
    throw formatRequired(byMediaType);
  }
  const extension = fileName?.split(".").at(-1).toLowerCase();
  const byExtension = formats.filter(({ extensions }) =>
    extensions.includes(extension),
  );
  if (byExtension.length === 1) {
    return byExtension[0].mediaTypes[0];
  }
  throw formatRequired(byExtension.length ? byExtension : formats);
}

/**
 * Application acquisition for the worker's explicit bytes/context contract.
 * The package remains responsible for parsing, closure identity and admission.
 */
export function createCanonicalVowlSourceAcquisition({
  resolver = new WebVowlImportResolver(),
  requestFormat,
} = {}) {
  function options(signal) {
    return { signal, config: new OWLOntologyLoaderConfiguration({ signal }) };
  }
  function ownedBytes(bytes) {
    if (!(bytes instanceof Uint8Array)) {
      throw new TypeError("Document acquisition requires bytes.");
    }
    if (
      bytes.byteLength > OWLOntologyLoaderConfiguration.defaults().maxInputBytes
    ) {
      throw resourceLimit(
        "The document exceeds the owning parser's input byte limit.",
        "maxInputBytes",
      );
    }
    return bytes.slice();
  }
  async function acquireBytes(documentIri, signal) {
    signal?.throwIfAborted();
    const acquired = await resolver.loadBytes(documentIri, options(signal));
    signal?.throwIfAborted();
    return { ...acquired, bytes: ownedBytes(acquired.bytes) };
  }
  async function acquire(documentIri, signal, format) {
    const acquired = await acquireBytes(documentIri, signal);
    if (format === undefined) {
      // Server/filename hints do not force a parser. Native loading selects
      // syntax from these bytes once, including extensionless imports.
      return { bytes: acquired.bytes, documentIri: acquired.documentIri };
    }
    const mediaType = selectCanonicalOwlMediaType({ format });
    return {
      bytes: acquired.bytes,
      documentIri: acquired.documentIri,
      mediaType,
    };
  }
  async function resolveImport(importIri, { signal } = {}) {
    const documentIri = resolver.getDocumentIRI(importIri).value;
    return acquire(documentIri, signal);
  }
  return Object.freeze({
    resolveImport,
    createImportContext(rootByteLength, { onFormatRequired, onFailure } = {}) {
      const limits = OWLOntologyLoaderConfiguration.defaults();
      const cache = new Map();
      const pending = new Set();
      let totalBytes = rootByteLength;
      if (
        !Number.isSafeInteger(totalBytes) ||
        totalBytes < 0 ||
        totalBytes > limits.maxInputBytes
      ) {
        throw new RangeError("Invalid import acquisition byte budget.");
      }
      return Object.freeze({
        async resolveImport(importIri, { signal } = {}) {
          const documentIri = resolver.getDocumentIRI(importIri).value;
          if (!cache.has(documentIri)) {
            if (cache.size >= limits.maxImportCount) {
              const error = resourceLimit(
                "The import count limit was exceeded.",
                "maxImportCount",
              );
              onFailure?.(error);
              throw error;
            }
            const acquisition = acquireBytes(documentIri, signal).then(
              (acquired) => {
                totalBytes += acquired.bytes.byteLength;
                if (totalBytes > limits.maxInputBytes) {
                  throw resourceLimit(
                    "The aggregate import byte limit was exceeded.",
                    "maxInputBytes",
                  );
                }
                return acquired;
              },
            );
            cache.set(documentIri, acquisition);
            acquisition.catch((error) => {
              if (cache.get(documentIri) === acquisition) {
                cache.delete(documentIri);
              }
              if (error.code === "RESOURCE_LIMIT_EXCEEDED") {
                onFailure?.(error);
              }
            });
          }
          const acquired = await cache.get(documentIri);
          signal?.throwIfAborted();
          if (acquired.format !== undefined && !acquired.selectedMediaType) {
            try {
              acquired.selectedMediaType = selectCanonicalOwlMediaType({
                format: acquired.format,
              });
            } catch (error) {
              if (
                requestFormat &&
                error.code === "OWL_FORMAT_SELECTION_REQUIRED"
              ) {
                acquired.formats = error.formats;
                pending.add(acquired);
                onFormatRequired?.();
              }
              // Stop this worker admission promptly; never wait for a person
              // while its aggregate parse/import deadline is running.
              throw error;
            }
          }
          return {
            bytes: acquired.bytes.slice(),
            documentIri: acquired.documentIri,
            mediaType: acquired.selectedMediaType,
          };
        },
        async choosePendingFormats({ signal } = {}) {
          let selected = false;
          for (const acquired of pending) {
            signal?.throwIfAborted();
            const format = await requestFormat(
              { documentIri: acquired.documentIri, formats: acquired.formats },
              { signal },
            );
            signal?.throwIfAborted();
            if (format === null) {
              throw new DOMException(
                "Format selection was cancelled.",
                "AbortError",
              );
            }
            acquired.selectedMediaType = selectCanonicalOwlMediaType({
              format,
            });
            pending.delete(acquired);
            selected = true;
          }
          // Each continuation follows a new explicit choice for a distinct
          // cached document. Other failures never trigger an automatic retry.
          return selected;
        },
      });
    },
    async canonicalRemote(documentIri, { signal } = {}) {
      const acquired = await acquireBytes(documentIri, signal);
      return { operation: "open-canonical-model", bytes: acquired.bytes };
    },
    canonicalLocal(bytes) {
      return { operation: "open-canonical-model", bytes: ownedBytes(bytes) };
    },
    legacyLocal(bytes, { dialect, profile, resolutions } = {}) {
      if (
        typeof dialect !== "string" ||
        !dialect ||
        typeof profile !== "string" ||
        !profile
      ) {
        throw new TypeError(
          "Legacy input requires an explicit dialect and target profile.",
        );
      }
      return {
        operation: "open-legacy-model",
        bytes: ownedBytes(bytes),
        dialect,
        profile,
        ...(resolutions === undefined
          ? {}
          : { resolutions: structuredClone(resolutions) }),
      };
    },
    async remote(documentIri, { signal, format } = {}) {
      // Human input precedes worker admission; it cannot consume its parse deadline.
      const acquired = await acquire(documentIri, signal, format);
      return { operation: "open-owl-model", ...acquired };
    },
    local(bytes, { documentIri, format } = {}) {
      const snapshot = ownedBytes(bytes);
      if (typeof documentIri !== "string" || !documentIri) {
        throw new TypeError(
          "A local document requires its explicit parsing base IRI.",
        );
      }
      const mediaType =
        format === undefined
          ? undefined
          : selectCanonicalOwlMediaType({ format });
      return {
        operation: "open-owl-model",
        bytes: snapshot,
        documentIri,
        mediaType,
      };
    },
  });
}
