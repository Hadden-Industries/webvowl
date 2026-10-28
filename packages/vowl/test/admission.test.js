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
    // The unbounded-limits amendment admits Infinity but no unsafe integer.
    "unsafe integer limit",
    empty(),
    { ...options, limits: { deadlineMs: 2 ** 53 } },
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

test("snapshot checks Unicode and numbers before closed fields and types", async () => {
  const unknownFirst = empty();
  unknownFirst.structural.aaa = 1;
  unknownFirst.structural.subjects.push({ id: "s", iri: "urn:x\ud800" });
  await expectCode(canonicalize(unknownFirst, options), "UNICODE_INVALID");
  const mistypedFirst = empty();
  mistypedFirst.structural.constructs = 1;
  mistypedFirst.structural.zzz = -0;
  await expectCode(canonicalize(mistypedFirst, options), "NUMBER_INVALID");
  const invalidName = empty();
  invalidName.structural["\ud800"] = 1;
  await expectCode(canonicalize(invalidName, options), "UNICODE_INVALID");
});

const letters = (count) => "a".repeat(count);
test.each([
  [
    "a misplaced string before its lone surrogate",
    '[1 "\\ud800"]',
    {},
    "JSON_SYNTAX",
  ],
  ["a misplaced number before its value", "[1 -0]", {}, "JSON_SYNTAX"],
  ["grammar tying with the byte after a number", "[-0x]", {}, "JSON_SYNTAX"],
  ["a misplaced bracket after a number", "[-0[", {}, "JSON_SYNTAX"],
  ["truncation tying with a final number", "[-0", {}, "JSON_SYNTAX"],
  [
    "a lone surrogate before an invalid escape",
    '{"a":"\\ud800\\x"}',
    {},
    "UNICODE_INVALID",
  ],
  [
    "a noncharacter before a raw tab",
    '{"a":"\\uffff\t"}',
    {},
    "UNICODE_INVALID",
  ],
  [
    "a lone surrogate before truncation",
    '{"a":"\\ud800',
    {},
    "UNICODE_INVALID",
  ],
  [
    "a misplaced bracket over the depth limit",
    "[1 [",
    { depth: 1 },
    "JSON_SYNTAX",
  ],
  [
    "a string limit before a lone surrogate",
    `{"a":"${letters(40)}\\ud800"}`,
    { stringBytes: 16 },
    "MODEL_RESOURCE_LIMIT",
  ],
  [
    "a string limit before a lone surrogate in one block",
    `{"a":"${letters(1500)}\\ud800${letters(600)}"}`,
    { stringBytes: 1400 },
    "MODEL_RESOURCE_LIMIT",
  ],
  [
    "a raw noncharacter before a raw tab",
    `{"a":"${String.fromCodePoint(0xffff)}\t"}`,
    {},
    "UNICODE_INVALID",
  ],
  [
    "a raw supplementary noncharacter before a raw tab",
    `{"a":"${String.fromCodePoint(0x1ffff)}\t"}`,
    {},
    "UNICODE_INVALID",
  ],
  [
    "an escaped pair for a noncharacter before an invalid escape",
    '{"a":"\\ud83f\\udfff\\x"}',
    {},
    "UNICODE_INVALID",
  ],
  [
    "a string limit in two-byte text before an invalid escape",
    `{"a":"${String.fromCodePoint(0xe9).repeat(20)}\\x"}`,
    { stringBytes: 16 },
    "MODEL_RESOURCE_LIMIT",
  ],
  // Controls whose first failure already comes first.
  [
    "an escaped valid pair before an invalid escape",
    '{"a":"\\ud83d\\ude00\\x"}',
    {},
    "JSON_SYNTAX",
  ],
  ["a final number", "-0", {}, "NUMBER_INVALID"],
  ["a number before its closing bracket", "[-0]", {}, "NUMBER_INVALID"],
  ["a number before whitespace and a bad byte", "[-0 x]", {}, "NUMBER_INVALID"],
  ["a raw tab before a noncharacter", '{"a":"\t\\uffff"}', {}, "JSON_SYNTAX"],
  [
    "a duplicate name before a missing colon",
    '{"a":1,"a" 2}',
    {},
    "JSON_DUPLICATE_MEMBER",
  ],
  [
    "a lone surrogate before a string limit",
    `{"a":"\\ud800${letters(40)}"}`,
    { stringBytes: 16 },
    "UNICODE_INVALID",
  ],
  [
    "a total string limit inside a duplicate name",
    '{"abcdef":1,"abcdef":2}',
    { totalStringBytes: 9 },
    "MODEL_RESOURCE_LIMIT",
  ],
  [
    "a lone surrogate before the envelope checks",
    '{"profile":"\\ud800"}',
    {},
    "UNICODE_INVALID",
  ],
])(
  "reports the stage-3 failure at the smallest position: %s",
  async (_name, text, limits, code) => {
    await expectCode(decode(bytes(text), { limits }), code);
  },
);

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
