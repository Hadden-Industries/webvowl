import { jest } from "@jest/globals";
import { OWLDocumentFormats } from "owlapi/formats";
import {
  createCanonicalVowlSourceAcquisition,
  selectCanonicalOwlMediaType,
} from "./canonicalVowlSourceAcquisition.js";

test.each(Object.values(OWLDocumentFormats))(
  "$key selection consumes owning format metadata",
  (format) => {
    expect(selectCanonicalOwlMediaType({ format: format.key })).toBe(
      format.mediaTypes[0],
    );
    for (const mediaType of format.mediaTypes) {
      expect(
        selectCanonicalOwlMediaType({
          contentType: `${mediaType}; charset=utf-8`,
        }),
      ).toBe(mediaType);
    }
  },
);

test("ambiguous suffixes require a choice while a declared media type takes precedence", () => {
  expect(() => selectCanonicalOwlMediaType({ fileName: "source.owl" })).toThrow(
    expect.objectContaining({
      code: "OWL_FORMAT_SELECTION_REQUIRED",
      formats: expect.arrayContaining(["functional", "owlxml", "rdfxml"]),
    }),
  );
  expect(
    selectCanonicalOwlMediaType({
      fileName: "source.owl",
      contentType: "application/rdf+xml",
    }),
  ).toBe("application/rdf+xml");
  expect(
    selectCanonicalOwlMediaType({
      fileName: "source.ttl",
      contentType: "application/octet-stream",
    }),
  ).toBe("text/turtle");
  expect(() =>
    selectCanonicalOwlMediaType({ format: "made-up", fileName: "source.ttl" }),
  ).toThrow(expect.objectContaining({ code: "OWL_FORMAT_SELECTION_REQUIRED" }));
});

test("root and catalog imports retain final context and exact bytes with cancellation", async () => {
  const bytes = new Uint8Array([0xef, 0xbb, 0xbf, 0x61]);
  const resolver = {
    getDocumentIRI: jest.fn(() => ({
      value: "https://example.org/import.ttl",
    })),
    loadBytes: jest.fn(async (documentIri, { signal }) => {
      signal?.throwIfAborted();
      return {
        bytes,
        documentIri: `${documentIri}?final`,
        contentType: "text/turtle",
      };
    }),
  };
  const source = createCanonicalVowlSourceAcquisition({ resolver });
  const signal = new AbortController().signal;
  expect(await source.remote("https://example.org/root", { signal })).toEqual({
    operation: "open-owl-model",
    bytes,
    documentIri: "https://example.org/root?final",
    mediaType: "text/turtle",
  });
  expect(
    await source.resolveImport("urn:import", {
      signal,
      importingDocumentIri: "https://example.org/root?final",
    }),
  ).toEqual({
    bytes,
    documentIri: "https://example.org/import.ttl?final",
    mediaType: "text/turtle",
  });
  expect(resolver.getDocumentIRI).toHaveBeenCalledWith("urn:import");
  expect(
    resolver.loadBytes.mock.calls.every(
      ([, options]) => options.signal === signal,
    ),
  ).toBe(true);
  const abort = new AbortController();
  abort.abort();
  await expect(
    source.remote("https://example.org/root", { signal: abort.signal }),
  ).rejects.toMatchObject({ name: "AbortError" });
  expect(resolver.loadBytes).toHaveBeenCalledTimes(2);
});

test("local acquisition owns a byte snapshot and requires interpretation context", () => {
  const source = createCanonicalVowlSourceAcquisition({ resolver: {} });
  const bytes = new Uint8Array([1, 2, 3]);
  const request = source.local(bytes, {
    documentIri: "urn:local",
    format: "functional",
  });
  bytes.fill(0);
  expect(request.bytes).toEqual(new Uint8Array([1, 2, 3]));
  expect(() => source.local(bytes, { format: "functional" })).toThrow(
    "base IRI",
  );
});
