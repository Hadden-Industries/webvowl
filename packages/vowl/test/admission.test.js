import { canonicalize, decode, encode, profiles } from "vowl";

const empty = () => ({
  structural: {
    ontology: { imports: [], annotations: [] },
    subjects: [],
    roles: [],
    expressions: [],
    constructs: [],
    occurrences: [],
  },
});
const options = { profile: profiles.structuralContent };
const bytes = (text) => new TextEncoder().encode(text);
const expectCode = (operation, code, pointer) =>
  expect(operation).rejects.toMatchObject({
    code,
    ...(pointer === undefined ? {} : { pointer }),
  });

test("snapshot neither invokes an accessor nor observes a later caller mutation", async () => {
  let invoked = false;
  const unsafe = empty();
  Object.defineProperty(unsafe.structural.ontology, "iri", {
    enumerable: true,
    get() {
      invoked = true;
      return "urn:test";
    },
  });
  await expectCode(canonicalize(unsafe, options), "SOURCE_UNSAFE_VALUE");
  expect(invoked).toBe(false);
  const source = empty();
  const pending = canonicalize(source, options);
  source.structural.ontology.imports.push("urn:late");
  expect((await pending).structural.ontology.imports).toEqual([]);
});

test.each([
  ["unknown option", {}, { ...options, repair: true }, "OPTION_INVALID"],
  ["unknown profile", empty(), { profile: "urn:unknown" }, "OPTION_INVALID"],
  [
    "undefined limit",
    empty(),
    { ...options, limits: { depth: undefined } },
    "OPTION_INVALID",
  ],
  [
    "infinite limit",
    empty(),
    { ...options, limits: { deadlineMs: Infinity } },
    "OPTION_INVALID",
  ],
  ["missing structural", {}, options, "DOCUMENT_REQUIRED_FIELD"],
  [
    "unknown field",
    { ...empty(), extra: true },
    options,
    "DOCUMENT_UNKNOWN_FIELD",
  ],
  [
    "structural state",
    { ...empty(), visualization: {} },
    options,
    "DOCUMENT_UNKNOWN_FIELD",
  ],
  [
    "missing artifact state",
    empty(),
    { profile: profiles.artifact },
    "DOCUMENT_REQUIRED_FIELD",
  ],
  ["null root", null, options, "INPUT_TYPE"],
  [
    "custom prototype",
    Object.create({ structural: {} }),
    options,
    "SOURCE_UNSAFE_VALUE",
  ],
])("rejects %s at its declared boundary", async (_name, source, opts, code) => {
  await expectCode(canonicalize(source, opts), code);
});

test.each([
  ['{"a":1,"\\u0061":2}', "JSON_DUPLICATE_MEMBER"],
  ['{"__proto__":1,"__proto__":2}', "JSON_DUPLICATE_MEMBER"],
  ["{}{}", "JSON_SYNTAX"],
  ['{"a":1,}', "JSON_SYNTAX"],
  ["[1,]", "JSON_SYNTAX"],
  ['{"a":-0}', "NUMBER_INVALID"],
  ['{"a":1e999}', "NUMBER_INVALID"],
  ['{"a":"\\ud800"}', "UNICODE_INVALID"],
  ['{"a":"\\uffff"}', "UNICODE_INVALID"],
  ["\ufeff{}", "JSON_BOM"],
])("lexically rejects %s before closed schema checks", async (text, code) => {
  await expectCode(decode(bytes(text)), code);
});

test("decoder snapshots bytes, rejects invalid UTF-8 and accepts no shared backing store", async () => {
  await expectCode(decode(new Uint8Array([0xc0, 0x80])), "JSON_INVALID_UTF8");
  await expectCode(
    decode(new Uint8Array(new SharedArrayBuffer(10))),
    "INPUT_TYPE",
  );
  const original = await canonicalize(empty(), options);
  const input = encode(original);
  const pending = decode(input);
  input.fill(0);
  expect(encode(await pending)).toEqual(encode(original));
});

test("decoder rejects otherwise valid whitespace and ID spelling instead of repairing", async () => {
  const doc = await canonicalize(empty(), options);
  await expectCode(
    decode(bytes(" " + new TextDecoder().decode(encode(doc)))),
    "NON_CANONICAL_BYTES",
  );
  const source = empty();
  source.structural.subjects.push({ id: "a", iri: "urn:A" });
  source.structural.roles.push({ id: "c", kind: "class", subject: "a" });
  source.structural.occurrences.push({
    id: "n",
    kind: "class-node",
    targets: ["c"],
  });
  const named = await canonicalize(source, options);
  const malformed = new TextDecoder()
    .decode(encode(named))
    .replaceAll("s0", "s00");
  await expectCode(decode(bytes(malformed)), "ID_INVALID");
});

test("limits and already-aborted signals reject before work without fallback", async () => {
  await expectCode(
    canonicalize(empty(), { ...options, signal: AbortSignal.abort() }),
    "ABORTED",
  );
  await expectCode(
    canonicalize(empty(), { ...options, limits: { embeddedValues: 1 } }),
    "MODEL_RESOURCE_LIMIT",
  );
  await expectCode(
    canonicalize(empty(), { ...options, limits: { rdfQuads: 1 } }),
    "RDF_RESOURCE_LIMIT",
  );
  await expectCode(
    decode(bytes("{}"), { limits: { inputBytes: 1 } }),
    "INPUT_RESOURCE_LIMIT",
  );
});

test("duplicate normalized imports fail even before RDF encoding", async () => {
  const source = empty();
  source.structural.ontology.imports = ["urn:duplicate", "urn:duplicate"];
  await expectCode(
    canonicalize(source, options),
    "SOURCE_DUPLICATE_SET_MEMBER",
    "/structural/ontology/imports/1",
  );
});

test("primary/reference failures precede signature and projection validation", async () => {
  const source = empty();
  source.structural.subjects.push({ id: "subject", iri: "urn:A" });
  source.structural.roles.push({
    id: "role",
    kind: "class",
    subject: "missing",
  });
  await expectCode(canonicalize(source, options), "REFERENCE_DANGLING");
  source.structural.roles[0].subject = "role";
  await expectCode(canonicalize(source, options), "REFERENCE_KIND");
  source.structural.roles[0].subject = "subject";
  await expectCode(canonicalize(source, options), "PROJECTION_INVALID");
  source.structural.roles[0].id = "subject";
  await expectCode(canonicalize(source, options), "ID_DUPLICATE");
});
