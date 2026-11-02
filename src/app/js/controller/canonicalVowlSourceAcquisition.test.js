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
    cache: { enabled: false },
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
  const source = createCanonicalVowlSourceAcquisition({
    resolver,
    cache: { enabled: false },
  });
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
    cache: { enabled: false },
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

async function siblingHarness({
  strategy = "heuristic",
  hintedStrategy = "heuristic",
  rootLength = 1,
  deadlineMs,
  rootSignal,
  rootFormat,
} = {}) {
  const rootIri = "https://example.org/root";
  const iris = ["a", "b", "c"].map((name) => `https://example.org/${name}`);
  const waiting = new Map();
  const calls = [];
  let active = 0;
  let peak = 0;
  const source = createCanonicalVowlSourceAcquisition({
    cache: {
      enabled: true,
      deadlineMs,
      createClient: () => ({
        async acquire(iri, { signal, context }) {
          context.bindings ??= new Map();
          let value;
          if (iri === rootIri) {
            value = {
              bytes: new Uint8Array(rootLength),
              documentIri: rootIri,
              resolution: {
                parserDocumentIri: rootIri,
                declaredImports: { owlMappingStrategy: hintedStrategy, iris },
              },
            };
          } else {
            calls.push(iri);
            active++;
            peak = Math.max(peak, active);
            try {
              value = await new Promise((resolve, reject) => {
                const abort = () => reject(signal.reason);
                signal.addEventListener("abort", abort, { once: true });
                waiting.set(iri, {
                  resolve(bytes = new Uint8Array([1])) {
                    signal.removeEventListener("abort", abort);
                    resolve({ bytes, documentIri: iri });
                  },
                  reject(error) {
                    signal.removeEventListener("abort", abort);
                    reject(error);
                  },
                });
              });
            } finally {
              active--;
            }
          }
          context.bindings.set(iri, value);
          return value;
        },
      }),
    },
  });
  const root = await source.remote(rootIri, {
    signal: rootSignal,
    format: rootFormat,
  });
  const onFailure = jest.fn();
  const imports = source.createImportContext(root.bytes.length, {
    rootBytes: root.bytes,
    owlMappingStrategy: strategy === "none" ? undefined : strategy,
    onFailure,
  });
  const abort = new AbortController();
  const options = { importingDocumentIri: rootIri, signal: abort.signal };
  // Drain promise composition without wall-clock performance assumptions.
  const flush = async () => {
    for (let index = 0; index < 20; index++) {
      await Promise.resolve();
    }
  };
  return {
    imports,
    iris,
    calls,
    waiting,
    options,
    abort,
    flush,
    peak: () => peak,
    onFailure,
  };
}

test("one verified root hint stages bytes without admitting import evidence", async () => {
  const h = await siblingHarness();
  const preparing = h.imports.prepare({ signal: h.options.signal });
  try {
    await h.flush();
    expect(h.calls).toEqual([h.iris[0]]);
    h.waiting.get(h.iris[0]).resolve();
    await preparing;
    expect(h.imports.cacheEvidence()).toEqual([]);
    const imported = await h.imports.resolveImport(h.iris[0], h.options);
    expect(imported.documentIri).toBe(h.iris[0]);
    expect(h.calls.filter((iri) => iri === h.iris[0])).toHaveLength(1);
  } finally {
    h.abort.abort("test complete");
    await preparing.catch(() => {});
  }
});

test.each(["unambiguous", "none"])(
  "root hints do not stage imports for the %s consumer choice",
  async (strategy) => {
    const h = await siblingHarness({ strategy });
    await h.imports.prepare({ signal: h.options.signal });
    expect(h.calls).toEqual([]);
  },
);

test("an explicit root format does not trigger speculative preparation", async () => {
  const h = await siblingHarness({ rootFormat: "turtle" });
  await h.imports.prepare({ signal: h.options.signal });
  expect(h.calls).toEqual([]);
});

test("caller cancellation interrupts preparation with its original reason", async () => {
  const h = await siblingHarness();
  const preparing = h.imports.prepare({ signal: h.options.signal });
  const reason = new Error("cancelled before model admission");
  const rejected = expect(preparing).rejects.toBe(reason);
  await h.flush();
  h.abort.abort(reason);
  await rejected;
  expect(h.calls).toEqual([h.iris[0]]);
  expect(h.imports.cacheEvidence()).toEqual([]);
});

test("preparation does not renew the root acquisition deadline", async () => {
  const h = await siblingHarness({ deadlineMs: 10 });
  await new Promise((resolve) => setTimeout(resolve, 25));
  await h.imports.prepare({ signal: h.options.signal });
  expect(h.calls).toEqual([]);
});

test("expired preparation permits a separately bounded worker demand", async () => {
  const h = await siblingHarness({ deadlineMs: 10 });
  await h.imports.prepare({ signal: h.options.signal });
  await h.flush();
  expect(h.calls).toEqual([h.iris[0]]);
  const demanded = h.imports.resolveImport(h.iris[0], h.options);
  try {
    await h.flush();
    expect(h.calls.filter((iri) => iri === h.iris[0])).toHaveLength(2);
    h.waiting.get(h.iris[0]).resolve();
    expect((await demanded).documentIri).toBe(h.iris[0]);
  } finally {
    h.abort.abort("test complete");
    await demanded.catch(() => {});
  }
});

test("prepared bytes retain the aggregate byte ceiling before model admission", async () => {
  const limit = OWLOntologyLoaderConfiguration.defaults().maxInputBytes;
  const h = await siblingHarness({ rootLength: limit - 1 });
  const preparing = h.imports.prepare({ signal: h.options.signal });
  const rejected = expect(preparing).rejects.toMatchObject({
    code: "RESOURCE_LIMIT_EXCEEDED",
    resource: "maxInputBytes",
  });
  await h.flush();
  h.waiting.get(h.iris[0]).resolve(new Uint8Array([1, 2]));
  await rejected;
  expect(h.imports.cacheEvidence()).toEqual([]);
});

test("a worker-requested import overlaps one verified sibling, coalesces demand and bounds concurrency", async () => {
  const h = await siblingHarness();
  const first = h.imports.resolveImport(h.iris[0], h.options);
  await h.flush();
  expect(h.calls).toEqual(h.iris.slice(0, 2));
  const second = h.imports.resolveImport(h.iris[1], h.options);
  const third = h.imports.resolveImport(h.iris[2], h.options);
  await h.flush();
  expect(h.calls).toHaveLength(2);
  h.waiting.get(h.iris[0]).resolve();
  await first;
  await h.flush();
  expect(h.calls).toEqual(h.iris);
  h.waiting.get(h.iris[1]).resolve();
  h.waiting.get(h.iris[2]).resolve();
  await Promise.all([second, third]);
  expect(h.peak()).toBe(2);
});

test.each(["unambiguous", "none"])(
  "mismatched or absent consumer mapping %s never speculates",
  async (strategy) => {
    const h = await siblingHarness({ strategy });
    const first = h.imports.resolveImport(h.iris[0], h.options);
    await h.flush();
    expect(h.calls).toEqual([h.iris[0]]);
    h.waiting.get(h.iris[0]).resolve();
    await first;
  },
);

test("speculation requires a matching actual parent declaration and never recursively follows hints", async () => {
  const h = await siblingHarness();
  const first = h.imports.resolveImport(h.iris[2], {
    ...h.options,
    importingDocumentIri: h.iris[0],
  });
  await h.flush();
  expect(h.calls).toEqual([h.iris[2]]);
  h.waiting.get(h.iris[2]).resolve();
  await first;
});

test.each([undefined, null])(
  "cancellation reason %s settles active and queued imports without starting queued transport",
  async (reason) => {
    const h = await siblingHarness();
    const first = h.imports.resolveImport(h.iris[0], h.options);
    const third = h.imports.resolveImport(h.iris[2], h.options);
    const settled = Promise.allSettled([first, third]);
    await h.flush();
    h.abort.abort(reason);
    expect(
      (await settled).every((result) => result.status === "rejected"),
    ).toBe(true);
    expect(h.calls).toEqual(h.iris.slice(0, 2));
  },
);

test("speculative failures remain coalesced and only surface when that import is demanded", async () => {
  const h = await siblingHarness();
  const first = h.imports.resolveImport(h.iris[0], h.options);
  await h.flush();
  h.waiting.get(h.iris[1]).reject(new Error("missing sibling"));
  h.waiting.get(h.iris[0]).resolve();
  await first;
  await expect(h.imports.resolveImport(h.iris[1], h.options)).rejects.toThrow(
    "missing sibling",
  );
  expect(h.calls.filter((iri) => iri === h.iris[1])).toHaveLength(1);
  h.abort.abort();
});

test("speculative bytes count towards the aggregate bound and report resource failure", async () => {
  const h = await siblingHarness({
    rootLength: OWLOntologyLoaderConfiguration.defaults().maxInputBytes - 1,
  });
  const first = h.imports.resolveImport(h.iris[0], h.options);
  await h.flush();
  h.waiting.get(h.iris[0]).resolve();
  await first;
  h.waiting.get(h.iris[1]).resolve(new Uint8Array([1, 2]));
  await h.flush();
  expect(h.onFailure).toHaveBeenCalledWith(
    expect.objectContaining({
      code: "RESOURCE_LIMIT_EXCEEDED",
      resource: "maxInputBytes",
    }),
  );
});

test("speculative siblings consume the same finite import-count allowance as demand", async () => {
  const defaults = OWLOntologyLoaderConfiguration.defaults();
  const scoped = jest
    .spyOn(OWLOntologyLoaderConfiguration, "defaults")
    .mockReturnValue({ ...defaults, maxImportCount: 2 });
  let h;
  try {
    h = await siblingHarness();
  } finally {
    scoped.mockRestore();
  }
  const first = h.imports.resolveImport(h.iris[0], h.options);
  await h.flush();
  await expect(
    h.imports.resolveImport(h.iris[2], h.options),
  ).rejects.toMatchObject({
    code: "RESOURCE_LIMIT_EXCEEDED",
    resource: "maxImportCount",
  });
  expect(h.calls).toEqual(h.iris.slice(0, 2));
  h.waiting.get(h.iris[0]).resolve();
  h.waiting.get(h.iris[1]).resolve();
  await first;
});

test("disabled cache never speculates even when a transport supplies import metadata", async () => {
  const root = "https://example.org/root",
    child = "https://example.org/child";
  const resolver = {
    getDocumentIRI: (iri) => ({ value: iri }),
    loadBytes: jest.fn(async (documentIri) => ({
      documentIri,
      bytes: new Uint8Array([1]),
      resolution: {
        parserDocumentIri: documentIri,
        declaredImports: {
          owlMappingStrategy: "heuristic",
          iris: [child, "https://example.org/sibling"],
        },
      },
    })),
  };
  const source = createCanonicalVowlSourceAcquisition({
    resolver,
    cache: { enabled: false },
  });
  const request = await source.remote(root);
  const imports = source.createImportContext(1, {
    rootBytes: request.bytes,
    owlMappingStrategy: "heuristic",
  });
  await imports.resolveImport(child, { importingDocumentIri: root });
  expect(resolver.loadBytes.mock.calls.map(([iri]) => iri)).toEqual([
    root,
    child,
  ]);
});
