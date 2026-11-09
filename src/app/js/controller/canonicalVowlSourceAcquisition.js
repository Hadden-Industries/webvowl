import { OWLDocumentFormats } from "owlapi/formats";
import { OWLOntologyLoaderConfiguration } from "owlapi/model";
import { WebVowlImportResolver } from "./importResolver.js";
import { ONTOLOGY_CACHE_CONFIGURATION } from "../../../ontology-loading/ontologyLoadingConfiguration.js";
import { waitForOntologyAcquisition } from "../../../ontology-loading/boundedSourceBytes.js";

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
  cache: cacheConfiguration = ONTOLOGY_CACHE_CONFIGURATION,
} = {}) {
  let client;
  const sourceEvidence = new WeakMap();
  const loadContexts = new WeakMap();
  async function cachedClient() {
    client ??= (async () => {
      if (cacheConfiguration.createClient) {
        return cacheConfiguration.createClient();
      }
      const { createCachedOntologySourceAcquisition } =
        await import("../../../ontology-loading/cachedOntologySourceAcquisition.js");
      return createCachedOntologySourceAcquisition({
        ...cacheConfiguration,
        resolver,
      });
    })();
    return client;
  }
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
  function acquisitionSignal(signal) {
    return cacheConfiguration.enabled === true
      ? AbortSignal.any([
          ...(signal ? [signal] : []),
          AbortSignal.timeout(cacheConfiguration.deadlineMs ?? 60000),
        ])
      : signal;
  }
  async function acquireBytes(
    documentIri,
    signal,
    useCache = true,
    selectedBindings,
    context,
  ) {
    signal = useCache ? acquisitionSignal(signal) : signal;
    signal?.throwIfAborted();
    const acquired =
      useCache && cacheConfiguration.enabled === true
        ? await (
            await waitForOntologyAcquisition(cachedClient(), signal)
          ).acquire(documentIri, {
            ...options(signal),
            selectedBindings,
            context,
          })
        : await resolver.loadBytes(documentIri, options(signal));
    signal?.throwIfAborted();
    const result = { ...acquired, bytes: ownedBytes(acquired.bytes) };
    if (acquired.resolution) {
      sourceEvidence.set(result.bytes, {
        requestedDocumentIri: documentIri,
        resolution: acquired.resolution,
        pointer: acquired.pointer,
      });
    }
    return result;
  }
  async function acquire(
    documentIri,
    signal,
    format,
    selectedBindings,
    context,
  ) {
    // Reject an unsupported explicit choice before acquisition can admit proxy work.
    const mediaType =
      format === undefined
        ? undefined
        : selectCanonicalOwlMediaType({ format });
    const acquired = await acquireBytes(
      documentIri,
      signal,
      true,
      selectedBindings,
      context,
    );
    if (format === undefined) {
      // Server/filename hints do not force a parser. Native loading selects
      // syntax from these bytes once, including extensionless imports.
      return { bytes: acquired.bytes, documentIri: acquired.documentIri };
    }
    return {
      bytes: acquired.bytes,
      documentIri: acquired.documentIri,
      mediaType,
    };
  }
  async function resolveImport(importIri, { signal } = {}) {
    const documentIri =
      cacheConfiguration.enabled === true
        ? importIri
        : resolver.getDocumentIRI(importIri).value;
    return acquire(documentIri, signal);
  }
  return Object.freeze({
    resolveImport,
    async observeCache(rootBytes, imports, options) {
      if (cacheConfiguration.enabled !== true) {
        return undefined;
      }
      const sources = new Map(
        (imports?.cacheEvidence?.() ?? []).map((entry) => [
          entry.requestedDocumentIri,
          { ...entry, role: "import" },
        ]),
      );
      const root = sourceEvidence.get(rootBytes);
      if (root) {
        sources.set(root.requestedDocumentIri, { ...root, role: "ontology" });
      }
      if (sources.size === 0) {
        return undefined;
      }
      const { createOntologyRefreshObservation } =
        await import("../../../ontology-loading/ontologyRefreshObservation.js");
      return createOntologyRefreshObservation({
        ...options,
        sources: [...sources.values()],
        client: await cachedClient(),
      });
    },
    createImportContext(
      rootByteLength,
      {
        onFormatRequired,
        onFailure,
        selectedBindings,
        rootBytes,
        owlMappingStrategy,
      } = {},
    ) {
      const limits = OWLOntologyLoaderConfiguration.defaults();
      const cache = new Map();
      const pending = new Set();
      const evidence = new Map();
      const parents = new Map();
      const rootEvidence = sourceEvidence.get(rootBytes);
      if (rootEvidence) {
        parents.set(
          rootEvidence.resolution.parserDocumentIri,
          rootEvidence.resolution,
        );
      }
      const context = loadContexts.get(rootBytes) ?? {};
      // An exact logical root requested again by a cycle is already accounted.
      const initialBindings = context.bindings?.size ?? 0;
      for (const [iri, acquired] of context.bindings ?? []) {
        cache.set(iri, Promise.resolve(acquired));
      }
      let totalBytes = rootByteLength;
      if (
        !Number.isSafeInteger(totalBytes) ||
        totalBytes < 0 ||
        totalBytes > limits.maxInputBytes
      ) {
        throw new RangeError("Invalid import acquisition byte budget.");
      }
      // Only byte acquisition overlaps. The worker still requests/parses/adopts
      // documents in its native order, with at most one speculative sibling.
      let active = 0;
      let speculating = false;
      const queue = [];
      function dispatch() {
        while (active < 2 && queue.length) {
          const job = queue.shift();
          active++;
          (async () => {
            try {
              job.signal?.throwIfAborted();
              const acquired = await waitForOntologyAcquisition(
                acquireBytes(
                  job.documentIri,
                  job.signal,
                  true,
                  selectedBindings,
                  context,
                ),
                job.signal,
              );
              totalBytes += acquired.bytes.byteLength;
              if (totalBytes > limits.maxInputBytes) {
                throw resourceLimit(
                  "The aggregate import byte limit was exceeded.",
                  "maxInputBytes",
                );
              }
              const entry = sourceEvidence.get(acquired.bytes);
              if (entry) {
                parents.set(acquired.documentIri, entry.resolution);
              }
              job.resolve(acquired);
            } catch (error) {
              job.reject(error);
            } finally {
              active--;
              dispatch();
            }
          })();
        }
      }
      function importBytes(documentIri, signal) {
        if (!cache.has(documentIri)) {
          if (cache.size - initialBindings >= limits.maxImportCount) {
            const error = resourceLimit(
              "The import count limit was exceeded.",
              "maxImportCount",
            );
            onFailure?.(error);
            throw error;
          }
          const acquisition = new Promise((resolve, reject) => {
            const job = { documentIri, signal, resolve, reject };
            queue.push(job);
            // A queued demand must settle on cancellation even if both active
            // transports are still waiting. Running work owns its own signal.
            const abort = () => {
              const index = queue.indexOf(job);
              if (index !== -1) {
                queue.splice(index, 1);
                reject(signal.reason);
              }
            };
            signal?.addEventListener("abort", abort, { once: true });
            const removeListener = () =>
              signal?.removeEventListener("abort", abort);
            job.resolve = (value) => {
              removeListener();
              resolve(value);
            };
            job.reject = (error) => {
              removeListener();
              reject(error);
            };
          });
          cache.set(documentIri, acquisition);
          acquisition.catch((error) => {
            // Keep ordinary failures coalesced, including speculative failures.
            // Cancelled work may be retried by an explicit format continuation.
            if (signal?.aborted && cache.get(documentIri) === acquisition) {
              cache.delete(documentIri);
            }
            if (error?.code === "RESOURCE_LIMIT_EXCEEDED") {
              onFailure?.(error);
            }
          });
          dispatch();
        }
        return cache.get(documentIri);
      }
      function prefetchSibling(importIri, importingDocumentIri, signal) {
        const hints = parents.get(importingDocumentIri)?.declaredImports;
        if (
          cacheConfiguration.enabled !== true ||
          !owlMappingStrategy ||
          hints?.owlMappingStrategy !== owlMappingStrategy ||
          !hints.iris.includes(importIri) ||
          speculating ||
          active >= 2 ||
          queue.length ||
          cache.size - initialBindings >= limits.maxImportCount ||
          signal?.aborted
        ) {
          return;
        }
        const sibling = hints.iris.find(
          (iri) => !cache.has(iri) && /^https?:\/\//iu.test(iri),
        );
        if (!sibling) {
          return;
        }
        speculating = true;
        const settled = () => {
          speculating = false;
        };
        importBytes(sibling, signal).then(settled, settled);
      }
      return Object.freeze({
        async prepare({ signal } = {}) {
          const hints = rootEvidence?.resolution.declaredImports;
          if (
            cacheConfiguration.enabled !== true ||
            !context.prepareHint ||
            !owlMappingStrategy ||
            hints?.owlMappingStrategy !== owlMappingStrategy
          ) {
            return;
          }
          const first = hints.iris.find((iri) => /^https?:\/\//iu.test(iri));
          if (!first) {
            return;
          }
          const preparingSignal = AbortSignal.any([
            context.acquisitionSignal,
            ...(signal ? [signal] : []),
          ]);
          try {
            // One hint stages bytes only. The native worker still determines
            // imports and validates the complete model independently.
            await waitForOntologyAcquisition(
              importBytes(first, preparingSignal),
              preparingSignal,
            );
          } catch (error) {
            signal?.throwIfAborted();
            if (error?.code === "RESOURCE_LIMIT_EXCEEDED") {
              throw error;
            }
            // Ordinary failures remain demand-owned. An expired acquisition
            // phase leaves the worker its existing separate finite allowance.
          }
        },
        cacheEvidence: () => [...evidence.values()],
        async resolveImport(importIri, { signal, importingDocumentIri } = {}) {
          signal?.throwIfAborted();
          const documentIri =
            cacheConfiguration.enabled === true
              ? importIri
              : resolver.getDocumentIRI(importIri).value;
          const acquisition = importBytes(documentIri, signal);
          prefetchSibling(importIri, importingDocumentIri, signal);
          const acquired = await acquisition;
          signal?.throwIfAborted();
          const entry = sourceEvidence.get(acquired.bytes);
          if (entry) {
            evidence.set(documentIri, entry);
          }
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
      const acquired = await acquireBytes(documentIri, signal, false);
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
    async remote(documentIri, { signal, format, selectedBindings } = {}) {
      // Human input precedes worker admission; it cannot consume its parse deadline.
      const context = {
        acquisitionSignal: acquisitionSignal(signal),
        prepareHint: format === undefined,
      };
      const acquired = await acquire(
        documentIri,
        context.acquisitionSignal,
        format,
        selectedBindings,
        context,
      );
      loadContexts.set(acquired.bytes, context);
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
