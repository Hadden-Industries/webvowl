import { jest } from "@jest/globals";
jest.unstable_mockModule("../../css/canonicalMergeDialog.css", () => ({}));
const { selectCanonicalLocalSource, createCanonicalOntologySource } =
  await import("./canonicalInputSelection.js");
const { openOwl } = await import("vowl/owl");
const { inspectModel } = await import("vowl");
const { OWLOntologyLoaderConfiguration } = await import("owlapi/model");

test("oversized local input is rejected before reading or asking for its syntax", async () => {
  const file = {
    name: "large.owl",
    size: OWLOntologyLoaderConfiguration.defaults().maxInputBytes + 1,
    arrayBuffer: jest.fn(),
  };
  const select = jest.fn();
  await expect(
    selectCanonicalLocalSource({ file, select }),
  ).rejects.toMatchObject({ code: "RESOURCE_LIMIT_EXCEEDED" });
  expect(file.arrayBuffer).not.toHaveBeenCalled();
  expect(select).not.toHaveBeenCalled();
});

test("new ontology input admits the author's exact identity and escaped title", async () => {
  const label = 'A "new" ontology\nwith Unicode: Δ';
  const source = await createCanonicalOntologySource({
    request: async ({ resolveIri }) => {
      expect(() => resolveIri("relative")).toThrow();
      return { iri: resolveIri("urn:new:ontology"), text: label };
    },
  });
  const { model } = await openOwl(new TextEncoder().encode(source.text), {
    documentIri: source.documentIri,
    mediaType: "text/turtle",
  });
  const inspection = inspectModel(model);
  expect(inspection.records.ontology.iri).toBe("urn:new:ontology");
  expect(inspection.records.ontology.annotations).toContainEqual(
    expect.objectContaining({
      predicate: "http://purl.org/dc/elements/1.1/title",
      value: expect.objectContaining({ lexical: label }),
    }),
  );
  expect(inspection.occurrences).toEqual([]);
  expect(
    await createCanonicalOntologySource({ request: async () => null }),
  ).toBeNull();
});

test("local input retains exact bytes, including a BOM, without text decoding", async () => {
  const bytes = new Uint8Array([239, 187, 191, 65, 13, 10]);
  const file = {
    name: "ontology.owl",
    arrayBuffer: jest.fn(async () => bytes.buffer),
    text: jest.fn(() => {
      throw new Error("Must not decode original bytes");
    }),
  };
  const source = await selectCanonicalLocalSource({
    file,
    select: async () => ({
      kind: "owl",
      format: "rdfxml",
      documentIri: "https://example.org/original.owl",
    }),
  });
  expect(source).toEqual({
    kind: "ontology-bytes",
    bytes,
    displayName: file.name,
    format: "rdfxml",
    documentIri: "https://example.org/original.owl",
  });
  expect(file.text).not.toHaveBeenCalled();
});

test("cancelling document context publishes no source after its bytes have been acquired", async () => {
  const file = {
    name: "cancel.owl",
    arrayBuffer: jest.fn(async () => new ArrayBuffer(0)),
  };
  expect(
    await selectCanonicalLocalSource({ file, select: async () => null }),
  ).toBeNull();
  expect(file.arrayBuffer).toHaveBeenCalledTimes(1);
});

test("extensionless input asks only for independent context and leaves syntax to the native loader", async () => {
  const bytes = new TextEncoder().encode(
    "Ontology(<urn:A> Declaration(Class(<urn:B>)))",
  );
  const file = {
    name: "extensionless",
    arrayBuffer: jest.fn(async () => bytes.buffer),
  };
  const source = await selectCanonicalLocalSource({
    file,
    select: async (context) => {
      expect(file.arrayBuffer).toHaveBeenCalledTimes(1);
      expect(context.requireReader).toBe(false);
      return { kind: "owl", documentIri: "urn:source" };
    },
  });
  expect(source.format).toBeUndefined();
  expect(source.bytes).toEqual(bytes);
});

test("JSON input retains explicit reader selection instead of being reinterpreted as OWL", async () => {
  const select = jest.fn(async () => ({ kind: "canonical" }));
  await selectCanonicalLocalSource({
    text: '{"header":{},"@context":{}}',
    select,
  });
  expect(select).toHaveBeenCalledWith(
    expect.objectContaining({ requireReader: true }),
  );
});

test("JSON reader choice precedes validation even for incomplete JSON with a byte-order mark", async () => {
  const bytes = new TextEncoder().encode('\uFEFF \n{"header":');
  const select = jest.fn(async () => null);
  await selectCanonicalLocalSource({
    file: { name: "extensionless", arrayBuffer: async () => bytes.buffer },
    select,
  });
  expect(select).toHaveBeenCalledWith(
    expect.objectContaining({ requireReader: true }),
  );
});

test.each(['"text"', "42", "-1", "true", "false", "null", "[]"])(
  "JSON scalar or array %s requires its reader before admission",
  async (text) => {
    const select = jest.fn(async () => null);
    await selectCanonicalLocalSource({ text, select });
    expect(select).toHaveBeenCalledWith(
      expect.objectContaining({ requireReader: true }),
    );
  },
);

test.each([
  "foaf:Person a owl:Class .",
  "test:Thing a owl:Class .",
  "name:Thing a owl:Class .",
])(
  "JSON reader hints do not claim a Turtle prefixed name: %s",
  async (text) => {
    const select = jest.fn(async () => null);
    await selectCanonicalLocalSource({ text, select });
    expect(select).toHaveBeenCalledWith(
      expect.objectContaining({ requireReader: false }),
    );
  },
);

test("retiring an input while it is read prevents publication of the local source", async () => {
  const abort = new AbortController();
  const file = {
    name: "cancel.owl",
    arrayBuffer: async () => {
      abort.abort();
      return new ArrayBuffer(0);
    },
  };
  await expect(
    selectCanonicalLocalSource({
      file,
      signal: abort.signal,
      select: async () => ({ kind: "canonical" }),
    }),
  ).rejects.toMatchObject({ name: "AbortError" });
});

test("pasted JSON follows the explicit reader choice, without shape guessing", async () => {
  const text = '{"header":{},"@context":{}}';
  const source = await selectCanonicalLocalSource({
    text,
    select: async () => ({
      kind: "owl",
      format: "jsonld",
      documentIri: "urn:pasted",
    }),
  });
  expect(source).toEqual({
    kind: "ontology-text",
    text,
    format: "jsonld",
    documentIri: "urn:pasted",
    displayName: "Direct input",
  });
});
