import { jest } from "@jest/globals";

import {
  IRI,
  ResourceLimitError,
  SecurityPolicyError,
} from "../../owlapi-js/index.js";

import { WebVowlImportResolver } from "./importResolver.js";

describe("WebVowlImportResolver", () => {
  it("derives the HTTP import fetch scheme from the WebVOWL base", async () => {
    const response = () => ({
      headers: { get: () => null },
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () => "<rdf:RDF/>",
    });
    const secureFetch = jest.fn(async () => response());
    const insecureFetch = jest.fn(async () => response());
    const insecureDocumentIri = IRI.create("http://example.com/imported.rdf");
    const secureResolver = new WebVowlImportResolver({
      baseUrl: "https://webvowl.example/viewer",
      fetchImpl: secureFetch,
    });
    const insecureResolver = new WebVowlImportResolver({
      baseUrl: "http://webvowl.example/viewer",
      fetchImpl: insecureFetch,
    });

    expect(secureResolver.getDocumentIRI(insecureDocumentIri).value).toBe(
      "https://example.com/imported.rdf",
    );
    const secureSource = await secureResolver.load(insecureDocumentIri);
    expect(secureFetch.mock.calls[0][0]).toBe(
      "https://example.com/imported.rdf",
    );
    expect(secureSource.getDocumentIRI().value).toBe(
      "https://example.com/imported.rdf",
    );

    expect(insecureResolver.getDocumentIRI(insecureDocumentIri).value).toBe(
      "http://example.com/imported.rdf",
    );
    const insecureSource = await insecureResolver.load(insecureDocumentIri);
    expect(insecureFetch.mock.calls[0][0]).toBe(
      "http://example.com/imported.rdf",
    );
    expect(insecureSource.getDocumentIRI().value).toBe(
      "http://example.com/imported.rdf",
    );
  });

  it("maps catalog IRIs and loads bounded documents through controlled fetch", async () => {
    const fetchImpl = jest.fn(async () => ({
      headers: {
        get: (name) =>
          name.toLowerCase() === "content-type"
            ? "application/rdf+xml; charset=utf-8"
            : null,
      },
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () => "<rdf:RDF/>",
    }));
    const resolver = new WebVowlImportResolver({
      catalog: {
        "https://example.com/ontology":
          "https://static.example.com/ontology.rdf",
      },
      fetchImpl,
    });
    const importIri = IRI.create("https://example.com/ontology");
    const documentIri = resolver.getDocumentIRI(importIri);
    const signal = new AbortController().signal;

    expect(documentIri.value).toBe("https://static.example.com/ontology.rdf");
    const source = await resolver.load(documentIri, {
      config: { maxRedirects: 0, maxRemoteDocumentBytes: 1024 },
      signal,
    });

    expect(fetchImpl).toHaveBeenCalledWith(documentIri.value, {
      credentials: "omit",
      redirect: "error",
      signal,
    });
    expect(source.getText()).toBe("<rdf:RDF/>");
    expect(source.getDocumentIRI()).toBe(documentIri);
    expect(source.getContentType()).toBe("application/rdf+xml; charset=utf-8");
    expect(source.getFileName()).toBe("ontology.rdf");
  });

  it("rejects non-HTTP imports and oversized responses", async () => {
    const resolver = new WebVowlImportResolver({
      catalog: {},
      fetchImpl: async () => ({
        headers: { get: () => null },
        ok: true,
        status: 200,
        statusText: "OK",
        text: async () => "12345",
      }),
    });

    await expect(
      resolver.load(IRI.create("file:///secret.owl"), {
        config: { maxRedirects: 0, maxRemoteDocumentBytes: 1024 },
      }),
    ).rejects.toBeInstanceOf(SecurityPolicyError);
    await expect(
      resolver.load(IRI.create("https://example.com/large.owl"), {
        config: { maxRedirects: 0, maxRemoteDocumentBytes: 4 },
      }),
    ).rejects.toBeInstanceOf(ResourceLimitError);
  });

  it("aborts a remote import when its configured time budget expires", async () => {
    jest.useFakeTimers();
    try {
      const fetchImpl = jest.fn(
        async (_url, { signal }) =>
          new Promise((_resolve, reject) => {
            signal.addEventListener(
              "abort",
              () => {
                const error = new Error("aborted");
                error.name = "AbortError";
                reject(error);
              },
              { once: true },
            );
          }),
      );
      const resolver = new WebVowlImportResolver({ fetchImpl });
      const pending = resolver.load(
        IRI.create("https://example.com/slow.owl"),
        {
          config: {
            maxRedirects: 0,
            maxRemoteDocumentBytes: 1024,
            timeoutMs: 10,
          },
        },
      );
      const rejection = expect(pending).rejects.toMatchObject({
        code: "RESOURCE_LIMIT_EXCEEDED",
        limit: 10,
        resource: "timeoutMs",
      });

      await jest.advanceTimersByTimeAsync(10);
      await rejection;
    } finally {
      jest.useRealTimers();
    }
  });

  describe("fetch rejections", () => {
    const documentIri = IRI.create("https://example.com/imported.rdf");

    it("preserves a caller abort reason that is a TypeError", async () => {
      const abortReason = new TypeError("cancelled by caller");
      const controller = new AbortController();
      const resolver = new WebVowlImportResolver({
        fetchImpl: async (_url, { signal }) => {
          controller.abort(abortReason);
          throw signal.reason;
        },
      });

      await expect(
        resolver.load(documentIri, { signal: controller.signal }),
      ).rejects.toBe(abortReason);
    });

    it("preserves non-Fetch loader defects", async () => {
      const loaderDefect = new Error("fixture loader defect");
      const resolver = new WebVowlImportResolver({
        fetchImpl: async () => {
          throw loaderDefect;
        },
      });

      await expect(resolver.load(documentIri)).rejects.toBe(loaderDefect);
    });
  });

  // `fetch` is a method of the global, and browsers brand-check its receiver:
  // WebIDL replaces an undefined receiver with the global object, but rejects
  // any other object with "Failed to execute 'fetch' on 'Window': Illegal
  // invocation". Storing the function on the resolver and calling it as
  // `this.#fetch(...)` therefore passes the resolver as the receiver and fails
  // in every browser.
  //
  // Node's `fetch` performs no such check, so the whole suite passed while the
  // application could not resolve a single import. That is why the receiver is
  // asserted directly here rather than inferred from a successful call.
  describe("the receiver it calls fetch with", () => {
    const okResponse = () => ({
      headers: { get: () => null },
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () => "<rdf:RDF/>",
    });
    const documentIri = IRI.create("https://example.com/imported.rdf");

    it("is never the resolver itself", async () => {
      let receiver = "never called";
      const resolver = new WebVowlImportResolver({
        fetchImpl: function recordReceiver() {
          receiver = this;
          return okResponse();
        },
      });

      await resolver.load(documentIri);

      expect(receiver).not.toBe(resolver);
    });

    it("is accepted by a fetch that brand-checks it as a browser does", async () => {
      const browserLikeFetch = function brandCheckedFetch() {
        if (this !== undefined && this !== globalThis) {
          throw new TypeError(
            "Failed to execute 'fetch' on 'Window': Illegal invocation",
          );
        }
        return okResponse();
      };
      const resolver = new WebVowlImportResolver({
        fetchImpl: browserLikeFetch,
      });

      await expect(resolver.load(documentIri)).resolves.toBeDefined();
    });
  });
});
