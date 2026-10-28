import { jest } from "@jest/globals";
import { createCanonicalVowlSourceAcquisition } from "../app/js/controller/canonicalVowlSourceAcquisition.js";

test("disabled cache never initializes its provider and preserves direct root/import bytes", async () => {
  const bytes = new TextEncoder().encode("<> a <urn:Ontology> .");
  const createClient = jest.fn(() => {
    throw new Error("provider absent");
  });
  const resolver = {
    getDocumentIRI: (iri) => ({ value: iri }),
    loadBytes: jest.fn(async (iri) => ({ bytes, documentIri: iri })),
  };
  const acquisition = createCanonicalVowlSourceAcquisition({
    resolver,
    cache: { enabled: false, createClient },
  });
  expect((await acquisition.remote("https://origin.test/root")).bytes).toEqual(
    bytes,
  );
  expect(
    (
      await acquisition
        .createImportContext(bytes.length)
        .resolveImport("https://origin.test/child")
    ).bytes,
  ).toEqual(bytes);
  expect(createClient).not.toHaveBeenCalled();
  expect(resolver.loadBytes).toHaveBeenCalledTimes(2);
});

test("enabled roots and imports preserve logical identity before transport remapping", async () => {
  const bytes = new Uint8Array([1, 2]);
  const acquire = jest.fn(async (iri) => ({ bytes, documentIri: iri }));
  const resolver = {
    getDocumentIRI: () => ({ value: "https://transport.test/rewritten" }),
    loadBytes: jest.fn(async () => ({
      bytes,
      documentIri: "https://transport.test/rewritten",
    })),
  };
  const acquisition = createCanonicalVowlSourceAcquisition({
    resolver,
    cache: { enabled: true, createClient: async () => ({ acquire }) },
  });
  await acquisition.remote("http://source.test/root#one");
  await acquisition
    .createImportContext(2)
    .resolveImport("http://source.test/child#two");
  expect(acquire.mock.calls.map(([iri]) => iri)).toEqual([
    "http://source.test/root#one",
    "http://source.test/child#two",
  ]);
  expect(resolver.loadBytes).not.toHaveBeenCalled();
});

test("cancellation during a lazy cache-client wait completes promptly and rejects late admission", async () => {
  let finish;
  const acquire = jest.fn();
  const acquisition = createCanonicalVowlSourceAcquisition({
    resolver: {},
    cache: {
      enabled: true,
      createClient: () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    },
  });
  const abort = new AbortController();
  const pending = acquisition.remote("https://origin.test/root", {
    signal: abort.signal,
  });
  abort.abort();
  await expect(pending).rejects.toHaveProperty("name", "AbortError");
  finish({ acquire });
  await Promise.resolve();
  expect(acquire).not.toHaveBeenCalled();
});

test("an unsupported explicit format never initializes acquisition or materialization", async () => {
  const acquire = jest.fn(async () => ({
    bytes: Uint8Array.of(42),
    documentIri: "https://origin.test/root",
  }));
  const createClient = jest.fn(async () => ({ acquire }));
  const acquisition = createCanonicalVowlSourceAcquisition({
    resolver: {},
    cache: { enabled: true, createClient },
  });
  await expect(
    acquisition.remote("https://origin.test/root", {
      format: "unknown-syntax",
    }),
  ).rejects.toHaveProperty("code", "OWL_FORMAT_SELECTION_REQUIRED");
  expect(createClient).not.toHaveBeenCalled();
  expect(acquire).not.toHaveBeenCalled();
});
