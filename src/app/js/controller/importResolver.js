import { IRI } from "owlapi/model";
import { operationLimitPolicy } from "vowl";
import {
  MissingImportError,
  ResourceLimitError,
  SecurityPolicyError,
  StringDocumentSource,
  UnloadableImportError,
} from "owlapi/io";

const textBytes = (text) => new TextEncoder().encode(text).byteLength;

const baseUrlProtocol = (baseUrl) => {
  try {
    return new URL(String(baseUrl)).protocol;
  } catch {
    return baseUrl?.protocol;
  }
};

const resolveMixedContentSafeFetchUrl = (
  resourceUrl,
  baseUrl = globalThis.location,
) => {
  if (baseUrlProtocol(baseUrl) !== "https:") {
    return resourceUrl;
  }

  try {
    const parsedResourceUrl = new URL(resourceUrl);
    if (parsedResourceUrl.protocol === "http:") {
      parsedResourceUrl.protocol = "https:";
      return parsedResourceUrl.href;
    }
  } catch {
    // Relative and non-URL resource identifiers are not mixed-content URLs.
  }
  return resourceUrl;
};

const requestDeadline = (signal, timeoutMs) => {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 0) {
    return {
      cleanup: () => undefined,
      didTimeOut: () => false,
      signal,
    };
  }

  const controller = new AbortController();
  let timedOut = false;
  const abortFromCaller = () => controller.abort(signal?.reason);
  if (signal?.aborted) {
    abortFromCaller();
  } else {
    signal?.addEventListener("abort", abortFromCaller, { once: true });
  }
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  return {
    cleanup() {
      clearTimeout(timeoutId);
      signal?.removeEventListener("abort", abortFromCaller);
    },
    didTimeOut: () => timedOut,
    signal: controller.signal,
  };
};

const fileNameFromUrl = (url) => {
  const fileName = url.pathname.split("/").filter(Boolean).at(-1);
  return fileName ? decodeURIComponent(fileName) : undefined;
};

async function readBoundedBytes(response, limit, signal) {
  if (response.body === null) {
    return new Uint8Array();
  }
  const reader = response.body.getReader();
  const chunks = [];
  let length = 0;
  const cancel = (reason) => {
    void reader.cancel(reason).catch(() => {});
  };
  const abort = () => cancel(signal.reason);
  signal?.addEventListener("abort", abort, { once: true });
  try {
    while (true) {
      signal?.throwIfAborted();
      const { done, value } = await reader.read();
      signal?.throwIfAborted();
      if (done) {
        break;
      }
      length += value.byteLength;
      if (length > limit) {
        throw new ResourceLimitError(
          "The remote ontology document byte limit was exceeded",
          {
            limit,
            observed: length,
            resource: "maxRemoteDocumentBytes",
          },
        );
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return bytes;
  } catch (error) {
    cancel(error);
    throw error;
  } finally {
    signal?.removeEventListener("abort", abort);
    reader.releaseLock();
  }
}

export class WebVowlImportResolver {
  #baseUrl;
  #catalog;
  #fetch;

  constructor({
    baseUrl = globalThis.location?.href,
    catalog = {},
    fetchImpl = globalThis.fetch,
  } = {}) {
    if (!catalog || typeof catalog !== "object" || Array.isArray(catalog)) {
      throw new TypeError("catalog must be an IRI mapping object");
    }
    if (typeof fetchImpl !== "function") {
      throw new TypeError("fetchImpl must be a function");
    }
    this.#baseUrl = baseUrl;
    this.#catalog = Object.freeze({ ...catalog });
    this.#fetch = fetchImpl;
  }

  getDocumentIRI(importIri) {
    const normalized = IRI.create(importIri);
    const mapped = this.#catalog[normalized.value] || normalized.value;
    return IRI.create(resolveMixedContentSafeFetchUrl(mapped, this.#baseUrl));
  }

  async load(documentIri, { config = {}, signal } = {}) {
    return this.#acquire(documentIri, config, signal, false);
  }

  /** Exact bounded source bytes for the canonical worker; no text round-trip. */
  async loadBytes(documentIri, { config = {}, signal } = {}) {
    return this.#acquire(documentIri, config, signal, true);
  }

  async #acquire(documentIri, config, signal, preserveBytes) {
    const normalized = IRI.create(documentIri);
    const requestUrl = resolveMixedContentSafeFetchUrl(
      normalized.value,
      this.#baseUrl,
    );
    const requestIri =
      requestUrl === normalized.value ? normalized : IRI.create(requestUrl);
    let url;
    try {
      url = new URL(requestIri.value);
    } catch (cause) {
      throw new SecurityPolicyError("Import IRI is not an absolute URL", {
        cause,
        documentIRI: requestIri,
      });
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new SecurityPolicyError(
        "WebVOWL import loading permits only HTTP and HTTPS URLs",
        { documentIRI: requestIri },
      );
    }

    const deadline = requestDeadline(signal, config.timeoutMs);
    try {
      // Called detached from `this`, deliberately. `fetch` is a method of the
      // global object and browsers brand-check its receiver: WebIDL substitutes
      // the global for an undefined receiver, which is what a bare call gives,
      // but rejects anything else with "Failed to execute 'fetch' on 'Window':
      // Illegal invocation". `this.#fetch(...)` would hand it the resolver.
      //
      // Node's `fetch` performs no such check, so this failed in every browser
      // while the whole suite stayed green.
      const fetchImpl = this.#fetch;
      let response;
      try {
        response = await fetchImpl(requestIri.value, {
          credentials: "omit",
          redirect: config.maxRedirects === 0 ? "error" : "follow",
          signal: deadline.signal,
        });
      } catch (cause) {
        if (deadline.signal?.aborted || !(cause instanceof TypeError)) {
          throw cause;
        }
        throw new MissingImportError(
          "The imported ontology could not be fetched",
          { cause, documentIRI: requestIri },
        );
      }
      if (!response?.ok) {
        const ErrorType =
          response?.status === 404 ? MissingImportError : UnloadableImportError;
        throw new ErrorType("The imported ontology request failed", {
          documentIRI: requestIri,
          status: response?.status,
          statusText: response?.statusText,
        });
      }

      const declaredLength = Number(response.headers?.get?.("content-length"));
      const limit =
        config.maxRemoteDocumentBytes ?? operationLimitPolicy.inputBytes[0];
      if (preserveBytes && (!Number.isSafeInteger(limit) || limit < 0)) {
        throw new TypeError(
          "The source byte limit must be a finite nonnegative integer.",
        );
      }
      if (Number.isFinite(declaredLength) && declaredLength > limit) {
        if (preserveBytes && response.body) {
          void response.body.cancel().catch(() => {});
        }
        throw new ResourceLimitError(
          "The remote ontology document byte limit was exceeded",
          {
            limit,
            observed: declaredLength,
            resource: "maxRemoteDocumentBytes",
          },
        );
      }
      let text;
      let bytes;
      try {
        if (preserveBytes) {
          bytes = await readBoundedBytes(response, limit, deadline.signal);
        } else {
          text = await response.text();
        }
      } catch (cause) {
        if (deadline.signal?.aborted || !(cause instanceof TypeError)) {
          throw cause;
        }
        throw new MissingImportError(
          "The imported ontology response body could not be read",
          { cause, documentIRI: requestIri },
        );
      }
      const observed = preserveBytes ? bytes.byteLength : textBytes(text);
      if (observed > limit) {
        throw new ResourceLimitError(
          "The remote ontology document byte limit was exceeded",
          { limit, observed, resource: "maxRemoteDocumentBytes" },
        );
      }

      if (preserveBytes) {
        return {
          bytes,
          documentIri: response.url || requestIri.value,
          contentType: response.headers?.get?.("content-type") || undefined,
          fileName: fileNameFromUrl(new URL(response.url || requestIri.value)),
        };
      }
      return new StringDocumentSource(text, {
        contentType: response.headers?.get?.("content-type") || undefined,
        documentIRI: requestIri,
        fileName: fileNameFromUrl(url),
      });
    } catch (cause) {
      if (deadline.didTimeOut() && !signal?.aborted) {
        throw new ResourceLimitError(
          "The remote ontology request time limit was exceeded",
          {
            cause,
            limit: config.timeoutMs,
            resource: "timeoutMs",
          },
        );
      }
      throw cause;
    } finally {
      deadline.cleanup();
    }
  }
}
