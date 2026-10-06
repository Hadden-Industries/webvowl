import { jest } from "@jest/globals";
import { OWLDocumentFormats } from "owlapi/formats";
import { OWLOntologyLoaderConfiguration } from "owlapi/model";
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

test("remote roots and imports defer missing or misleading format hints to native loading", async () => {
  const bytes = new Uint8Array([1, 2, 3]);
  const resolver = {
    loadBytes: jest.fn(async () => ({
      bytes,
      documentIri: "https://example.org/final.owl",
      fileName: "final.owl",
      contentType: "application/octet-stream",
    })),
    getDocumentIRI: () => ({ value: "https://example.org/import.owl" }),
  };
  const requestFormat = jest.fn(async () => "owlxml");
  const acquisition = createCanonicalVowlSourceAcquisition({
    resolver,
    requestFormat,
  });
  const result = await acquisition.remote("https://example.org/root.owl");
  expect(result).toEqual({
    operation: "open-owl-model",
    bytes,
    documentIri: "https://example.org/final.owl",
  });
  expect(resolver.loadBytes).toHaveBeenCalledTimes(1);
  expect(
    (await acquisition.resolveImport("urn:import")).mediaType,
  ).toBeUndefined();
  expect(requestFormat).not.toHaveBeenCalled();
  expect(
    (
      await acquisition.remote("https://example.org/root.owl", {
        format: "owlxml",
      })
    ).mediaType,
  ).toBe("application/owl+xml");
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
  });
  expect(
    await source.resolveImport("urn:import", {
      signal,
      importingDocumentIri: "https://example.org/root?final",
    }),
  ).toEqual({
    bytes,
    documentIri: "https://example.org/import.ttl?final",
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

test("automatic import context retains bounded cached bytes without asking for a format", async () => {
  const requestFormat = jest.fn(async () => "rdfxml");
  const resolver = {
    getDocumentIRI: () => ({ value: "https://example.org/import.owl" }),
    loadBytes: jest.fn(async () => ({
      bytes: new Uint8Array([1, 2, 3]),
      documentIri: "https://example.org/import.owl",
      fileName: "import.owl",
    })),
  };
  const acquisition = createCanonicalVowlSourceAcquisition({
    resolver,
    requestFormat,
  });
  const context = acquisition.createImportContext(10);
  await context.resolveImport("urn:import");
  expect(requestFormat).not.toHaveBeenCalled();
  const first = await context.resolveImport("urn:import");
  expect(first.mediaType).toBeUndefined();
  first.bytes.fill(0);
  expect((await context.resolveImport("urn:import")).bytes).toEqual(
    new Uint8Array([1, 2, 3]),
  );
  expect(resolver.loadBytes).toHaveBeenCalledTimes(1);
  expect(requestFormat).not.toHaveBeenCalled();
  const onFailure = jest.fn();
  const exhausted = acquisition.createImportContext(
    OWLOntologyLoaderConfiguration.defaults().maxInputBytes - 2,
    { onFailure },
  );
  await expect(exhausted.resolveImport("urn:import")).rejects.toThrow(
    "aggregate import byte limit",
  );
  expect(onFailure).toHaveBeenCalledWith(
    expect.objectContaining({ code: "RESOURCE_LIMIT_EXCEEDED" }),
  );
});

test("canonical and named legacy acquisition never infer JSON dialects", async () => {
  const bytes = new TextEncoder().encode('{"not":"admitted"}');
  const source = createCanonicalVowlSourceAcquisition({
    resolver: {
      async loadBytes() {
        return {
          bytes,
          documentIri: "https://example.org/final.json",
          contentType: "application/json",
        };
      },
    },
  });
  const canonical = source.canonicalLocal(bytes);
  const remote = await source.canonicalRemote(
    "https://example.org/source.json",
  );
  const resolutions = { context: ["original"] };
  const legacy = source.legacyLocal(bytes, {
    dialect: "explicit-exporter",
    profile: "explicit-profile",
    resolutions,
  });
  resolutions.context.push("mutated");
  bytes.fill(0);
  expect(canonical.operation).toBe("open-canonical-model");
  expect(remote.bytes).toEqual(canonical.bytes);
  expect(legacy.bytes).toEqual(canonical.bytes);
  expect(legacy.resolutions.context).toEqual(["original"]);
  expect(() => source.legacyLocal(bytes)).toThrow("explicit dialect");
});
