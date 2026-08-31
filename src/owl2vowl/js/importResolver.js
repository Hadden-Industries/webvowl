import {
  MissingImportError,
  ResourceLimitError,
  SecurityPolicyError,
  StringDocumentSource,
  UnloadableImportError,
} from "owlapi/io";
import { IRI } from "owlapi/model";
import resolveFetchUrl from "../../shared/js/util/resolveFetchUrl.js";

const textBytes = (text) => new TextEncoder().encode(text).byteLength;

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
    return IRI.create(resolveFetchUrl(mapped, this.#baseUrl));
  }

  async load(documentIri, { config = {}, signal } = {}) {
    const normalized = IRI.create(documentIri);
    const requestUrl = resolveFetchUrl(normalized.value, this.#baseUrl);
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
      const limit = config.maxRemoteDocumentBytes ?? 33554432;
      if (Number.isFinite(declaredLength) && declaredLength > limit) {
        throw new ResourceLimitError(
          "The remote ontology document byte limit was exceeded",
          {
            limit,
            observed: declaredLength,
            resource: "maxRemoteDocumentBytes",
          },
        );
      }
      const text = await response.text();
      const observed = textBytes(text);
      if (observed > limit) {
        throw new ResourceLimitError(
          "The remote ontology document byte limit was exceeded",
          { limit, observed, resource: "maxRemoteDocumentBytes" },
        );
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
