import { jest } from "@jest/globals";

import {
  IRI,
  ResourceLimitError,
  SecurityPolicyError,
} from "../../owlapi-js/index.js";

import { WebVowlImportResolver } from "./importResolver.js";

describe("WebVowlImportResolver", () => {
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
});
