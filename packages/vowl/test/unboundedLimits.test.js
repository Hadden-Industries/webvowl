import { jest } from "@jest/globals";
import { readFileSync } from "node:fs";
import { OWLManager } from "owlapi/apibinding";
import rdfCanonize from "rdf-canonize";
import * as vowl from "vowl";
import { fromOwl } from "vowl/owl";
import { migrate } from "vowl/migrate";
import * as errors from "../src/errors.js";
import { ResourceBudget } from "../src/resourceBudget.js";

// Qualification of docs/specs/2026-10-27-canonical-vowl-unbounded-limits-amendment.md.
const {
  canonicalize,
  checkpointModel,
  decode,
  edit,
  encode,
  openCanonical,
  profiles,
  readmitModel,
} = vowl;
const vector = (name, file) =>
  readFileSync(
    new URL(`../conformance/vectors/${name}/${file}`, import.meta.url),
  );
const fixture = (name) => JSON.parse(vector(name, "source.json"));
const empty = () => fixture("empty-structural");
const expected = new Uint8Array(vector("empty-structural", "canonical.json"));
const options = (limits) => ({ profile: profiles.structuralContent, limits });
const bytes = (text) => new TextEncoder().encode(text);
// Jest structuredClone returns foreign VM prototypes; transport into this realm.
const transport = (value) => JSON.parse(JSON.stringify(value));
const owlOptions = { documentIri: "urn:doc", mediaType: "text/owl-functional" };
const subclass = "Ontology(SubClassOf(<urn:doc#A> <urn:doc#B>))";
const legacyOptions = {
  dialect: "webvowl-legacy-354ed3af8c1e82019f6280b2594acaceac96cca0",
  profile: profiles.structuralContent,
};
const legacy = () =>
  bytes(
    JSON.stringify({
      header: { iri: "urn:legacy:ontology" },
      class: [{ id: "node", type: "owl:Class" }],
      classAttribute: [{ id: "node", iri: "urn:legacy:A" }],
    }),
  );
// A8's former upper override bounds; expanded XML formerly followed inputBytes.
const formerBounds = {
  inputBytes: 268435456,
  primaryRecords: 1000000,
  embeddedValues: 4000000,
  depth: 512,
  stringBytes: 16777216,
  totalStringBytes: 134217728,
  rdfQuads: 8000000,
  rdfDeepIterations: 1000000,
  deadlineMs: 300000,
  expandedXmlBytes: 268435456,
};
const names = Object.keys(formerBounds);
const unbounded = () =>
  Object.fromEntries(names.map((name) => [name, Infinity]));
const stackExhaustion = () =>
  new RangeError("Maximum call stack size exceeded");
const hostLimit = (resource) => ({
  code: "HOST_RESOURCE_LIMIT",
  details: { resource },
});

afterEach(() => jest.restoreAllMocks());

test("only limits with an outside basis keep a default", () => {
  expect(vowl.operationLimitDefaults).toEqual({
    inputBytes: Infinity,
    primaryRecords: Infinity,
    embeddedValues: Infinity,
    depth: 128,
    stringBytes: Infinity,
    totalStringBytes: Infinity,
    rdfQuads: Infinity,
    rdfDeepIterations: 100000,
    deadlineMs: 10000,
    expandedXmlBytes: 33554432,
  });
  expect(Object.isFrozen(vowl.operationLimitDefaults)).toBe(true);
});

test("a budget without caller limits bounds only the retained defaults", () => {
  const budget = new ResourceBudget({}, performance.now());
  try {
    budget.charge("inputBytes", 33554433, "", "INPUT_RESOURCE_LIMIT");
    budget.charge("primaryRecords", 100001);
    budget.charge("embeddedValues", 1500001);
    budget.charge("totalStringBytes", 16777217);
    budget.charge("rdfQuads", 1000001);
    budget.bound("stringBytes", 1048577);
    budget.bound("depth", 128);
    expect(() => budget.bound("depth", 129)).toThrow(
      expect.objectContaining({
        code: "MODEL_RESOURCE_LIMIT",
        details: { limit: "depth", maximum: 128, actual: 129 },
      }),
    );
  } finally {
    budget.dispose();
  }
});

function languageLiterals(value, found = []) {
  if (value !== null && typeof value === "object") {
    if (value.kind === "language") {
      found.push(value);
    }
    for (const child of Object.values(value)) {
      languageLiterals(child, found);
    }
  }
  return found;
}

test("a string longer than the former default is admitted without caller limits", async () => {
  const source = fixture("annotated-class");
  // An annotated assertion repeats its value, so every copy changes together.
  const literals = languageLiterals(source);
  const original = literals[0].lexical;
  for (const literal of literals.filter(
    ({ lexical }) => lexical === original,
  )) {
    literal.lexical = "a".repeat(1048577);
  }
  const document = await canonicalize(source, options(undefined));
  expect(encode(document).length).toBeGreaterThan(1048577);
});

test.each(names)(
  "%s accepts Infinity, the largest safe integer and one above its former bound",
  async (name) => {
    for (const value of [
      Infinity,
      Number.MAX_SAFE_INTEGER,
      formerBounds[name] + 1,
    ]) {
      expect(
        encode(await canonicalize(empty(), options({ [name]: value }))),
      ).toEqual(expected);
      expect(
        encode(await decode(expected, { limits: { [name]: value } })),
      ).toEqual(expected);
    }
  },
);

test.each(names)(
  "%s rejects values outside its override domain",
  async (name) => {
    const invalid = [null, 1.5, -1, NaN, -Infinity, 2 ** 53, "1"];
    if (name !== "rdfDeepIterations") {
      invalid.push(0);
    }
    for (const value of invalid) {
      await expect(
        canonicalize(empty(), options({ [name]: value })),
      ).rejects.toMatchObject({
        code: "OPTION_INVALID",
        pointer: `/limits/${name}`,
      });
    }
  },
);

test("every limit can be lifted at once in each operation", async () => {
  const limits = unbounded();
  expect(encode(await canonicalize(empty(), options(limits)))).toEqual(
    expected,
  );
  expect(encode(await decode(expected, { limits }))).toEqual(expected);
  expect(
    encode(
      (await fromOwl(bytes(subclass), { ...owlOptions, limits })).document,
    ),
  ).toEqual(encode((await fromOwl(bytes(subclass), owlOptions)).document));
  expect(
    encode((await migrate(legacy(), { ...legacyOptions, limits })).document),
  ).toEqual(encode((await migrate(legacy(), legacyOptions)).document));
});

test("an unbounded deadline arms no timer", () => {
  const timer = jest.spyOn(globalThis, "setTimeout");
  const budget = new ResourceBudget(
    { limits: { deadlineMs: Infinity } },
    performance.now(),
  );
  try {
    expect(timer).not.toHaveBeenCalled();
    budget.check();
    expect(budget.signal.aborted).toBe(false);
  } finally {
    budget.dispose();
  }
});

test("a deadline beyond the largest timer delay re-arms instead of expiring early", () => {
  const scheduled = [];
  jest
    .spyOn(globalThis, "setTimeout")
    .mockImplementation((callback, delay) =>
      scheduled.push({ callback, delay }),
    );
  jest.spyOn(globalThis, "clearTimeout").mockImplementation(() => {});
  // Twice the largest delay, so both arming steps stay far from the deadline.
  const budget = new ResourceBudget(
    { limits: { deadlineMs: 2 ** 32 } },
    performance.now(),
  );
  try {
    expect(scheduled).toHaveLength(1);
    expect(scheduled[0].delay).toBeLessThanOrEqual(2147483647);
    scheduled[0].callback();
    expect(budget.signal.aborted).toBe(false);
    expect(scheduled).toHaveLength(2);
    expect(scheduled[1].delay).toBeLessThanOrEqual(2147483647);
  } finally {
    budget.dispose();
  }
});

test("an unbounded deep-iteration allowance lifts the B * B term", async () => {
  const canonize = jest.spyOn(rdfCanonize, "canonize");
  await canonicalize(empty(), options({ rdfDeepIterations: Infinity }));
  expect(canonize.mock.calls.at(-1)[1].maxDeepIterations).toBe(Infinity);
  await canonicalize(
    empty(),
    options({ rdfDeepIterations: Number.MAX_SAFE_INTEGER }),
  );
  expect(canonize.mock.calls.at(-1)[1].maxDeepIterations).toBeLessThan(
    Number.MAX_SAFE_INTEGER,
  );
});

test("runtime limits are recognised by resource without invoking accessors", () => {
  const { hostLimitResource } = errors;
  const recurse = () => recurse();
  let overflow;
  try {
    recurse();
  } catch (error) {
    overflow = error;
  }
  let oversized;
  try {
    "x".repeat(2 ** 30);
  } catch (error) {
    oversized = error;
  }
  expect(hostLimitResource(overflow)).toBe("callStack");
  expect(hostLimitResource(oversized)).toBe("allocation");
  for (const message of [
    "Invalid array length",
    "Invalid typed array length: 9007199254740991",
    "Array buffer allocation failed",
    "Out of memory",
  ]) {
    expect(hostLimitResource(new RangeError(message))).toBe("allocation");
  }
  // SpiderMonkey reports these limits with its nonstandard InternalError.
  globalThis.InternalError = class InternalError extends Error {};
  try {
    expect(
      hostLimitResource(new globalThis.InternalError("too much recursion")),
    ).toBe("callStack");
    expect(
      hostLimitResource(
        new globalThis.InternalError("allocation size overflow"),
      ),
    ).toBe("allocation");
  } finally {
    delete globalThis.InternalError;
  }
  expect(
    hostLimitResource(new RangeError("maxInputBytes must be a safe integer")),
  ).toBeUndefined();
  expect(
    hostLimitResource(new TypeError("Maximum call stack size exceeded")),
  ).toBeUndefined();
  expect(
    hostLimitResource({
      name: "RangeError",
      message: "Maximum call stack size exceeded",
    }),
  ).toBeUndefined();
  const accessor = jest.fn(() => "Maximum call stack size exceeded");
  const imitation = new RangeError();
  Object.defineProperty(imitation, "message", { get: accessor });
  expect(hostLimitResource(imitation)).toBeUndefined();
  expect(accessor).not.toHaveBeenCalled();
});

function nestedAnnotations(levels) {
  let annotations = [];
  for (let level = 0; level < levels; level++) {
    annotations = [
      {
        predicate: "https://example.org/o#note",
        value: { kind: "iri", iri: "https://example.org/x" },
        annotations,
      },
    ];
  }
  return annotations;
}

test("deep in-memory nesting reaches the host stack only when depth is lifted", async () => {
  const source = empty();
  source.structural.ontology.annotations = nestedAnnotations(30000);
  await expect(canonicalize(source, options(undefined))).rejects.toMatchObject({
    code: "MODEL_RESOURCE_LIMIT",
    details: { limit: "depth", maximum: 128 },
  });
  await expect(
    canonicalize(source, options({ depth: Infinity })),
  ).rejects.toMatchObject(hostLimit("callStack"));
});

test("deep encoded nesting reaches the host stack only when depth is lifted", async () => {
  const levels = 30000;
  const nested =
    '{"annotations":['.repeat(levels) +
    '],"predicate":"https://example.org/o#note","value":{"iri":"https://example.org/x","kind":"iri"}}'.repeat(
      levels,
    );
  const input = bytes(
    new TextDecoder()
      .decode(expected)
      .replace('"annotations":[]', `"annotations":[${nested}]`),
  );
  await expect(decode(input)).rejects.toMatchObject({
    code: "MODEL_RESOURCE_LIMIT",
    details: { limit: "depth", maximum: 128 },
  });
  await expect(
    decode(input, { limits: { depth: Infinity } }),
  ).rejects.toMatchObject(hostLimit("callStack"));
});

const operations = {
  canonicalize: async () => () => canonicalize(empty(), options(undefined)),
  decode: async () => () => decode(expected),
  edit: async () => {
    const document = await canonicalize(empty(), options(undefined));
    return () => edit(document, []);
  },
  openCanonical: async () => {
    const document = await canonicalize(empty(), options(undefined));
    return () => openCanonical(document);
  },
  checkpointModel: async () => {
    const document = await canonicalize(empty(), options(undefined));
    const { model } = await openCanonical(document);
    return () => checkpointModel(model);
  },
  readmitModel: async () => {
    const document = await canonicalize(empty(), options(undefined));
    const { model } = await openCanonical(document);
    const checkpoint = transport(await checkpointModel(model));
    return () => readmitModel(checkpoint);
  },
  fromOwl: async () => () => fromOwl(bytes(subclass), owlOptions),
  migrate: async () => () => migrate(legacy(), legacyOptions),
};

test.each(Object.keys(operations))(
  "%s reports a runtime limit at any budget observation as HOST_RESOURCE_LIMIT",
  async (name) => {
    const run = await operations[name]();
    jest.spyOn(ResourceBudget.prototype, "poll").mockImplementationOnce(() => {
      throw stackExhaustion();
    });
    await expect(run()).rejects.toMatchObject(hostLimit("callStack"));
  },
);

test("cancellation takes precedence over a runtime limit", async () => {
  const controller = new AbortController();
  jest.spyOn(ResourceBudget.prototype, "poll").mockImplementationOnce(() => {
    controller.abort();
    throw stackExhaustion();
  });
  await expect(
    canonicalize(empty(), {
      profile: profiles.structuralContent,
      signal: controller.signal,
    }),
  ).rejects.toMatchObject({ code: "ABORTED" });
});

test("a runtime limit during the UTF-8 check is not an encoding error", async () => {
  const check = ResourceBudget.prototype.check;
  let calls = 0;
  // The constructor's observation is the first; the UTF-8 check's is the next.
  jest.spyOn(ResourceBudget.prototype, "check").mockImplementation(function () {
    if (++calls === 2) {
      throw stackExhaustion();
    }
    return check.call(this);
  });
  await expect(decode(expected)).rejects.toMatchObject(hostLimit("callStack"));
});

test("runtime exhaustion inside the OWL parser is not a syntax error", async () => {
  const manager = OWLManager.createOWLOntologyManager();
  jest
    .spyOn(
      Object.getPrototypeOf(manager),
      "loadOntologyGraphFromOntologyDocument",
    )
    .mockRejectedValueOnce(
      new Error("parse failed", { cause: stackExhaustion() }),
    );
  await expect(fromOwl(bytes(subclass), owlOptions)).rejects.toMatchObject(
    hostLimit("callStack"),
  );
});

test("runtime exhaustion inside RDFC-1.0 is not a dependency failure", async () => {
  jest.spyOn(rdfCanonize, "canonize").mockRejectedValueOnce(stackExhaustion());
  await expect(canonicalize(empty(), options(undefined))).rejects.toMatchObject(
    hostLimit("callStack"),
  );
});

test("encode reports a failed byte copy as a runtime limit", async () => {
  const document = await canonicalize(empty(), options(undefined));
  const native = globalThis.Uint8Array;
  let thrown;
  globalThis.Uint8Array = function Uint8Array() {
    throw new RangeError("Array buffer allocation failed");
  };
  try {
    encode(document);
  } catch (error) {
    thrown = error;
  } finally {
    globalThis.Uint8Array = native;
  }
  expect(thrown).toMatchObject(hostLimit("allocation"));
});

const rdf = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
const owl = "http://www.w3.org/2002/07/owl#";
const rdfXml = (declarations, body) =>
  bytes(
    `<?xml version="1.0"?>\n<!DOCTYPE rdf:RDF [\n${declarations}\n]>\n<rdf:RDF xmlns:rdf="${rdf}" xmlns:owl="${owl}">${body}</rdf:RDF>`,
  );
const xmlOptions = { documentIri: "urn:doc", mediaType: "application/rdf+xml" };

test("expanded XML has its own bound, separate from the input size", async () => {
  const input = rdfXml(
    `<!ENTITY base "urn:doc#${"A".repeat(200)}">`,
    Array.from(
      { length: 20 },
      (_, index) => `<owl:Class rdf:about="&base;${index}"/>`,
    ).join(""),
  );
  expect(input.length).toBeLessThan(2000);
  const admitted = await fromOwl(input, {
    ...xmlOptions,
    limits: { inputBytes: 2000 },
  });
  expect(encode(admitted.document).length).toBeGreaterThan(4000);
  await expect(
    fromOwl(input, { ...xmlOptions, limits: { expandedXmlBytes: 2000 } }),
  ).rejects.toMatchObject({
    code: "MODEL_RESOURCE_LIMIT",
    details: { stage: "owl-loading", resource: "maxExpandedXmlBytes" },
  });
});

test("an unbounded expanded-XML limit also lifts the parser's entity controls", async () => {
  const declarations = [`<!ENTITY e0 "A">`];
  for (let level = 1; level <= 20; level++) {
    declarations.push(`<!ENTITY e${level} "&e${level - 1};">`);
  }
  const input = rdfXml(
    declarations.join("\n"),
    `<owl:Class rdf:about="urn:doc#&e20;"/>`,
  );
  await expect(fromOwl(input, xmlOptions)).rejects.toMatchObject({
    code: "MODEL_RESOURCE_LIMIT",
    details: { stage: "owl-loading", resource: "maxEntityExpansionDepth" },
  });
  const admitted = await fromOwl(input, {
    ...xmlOptions,
    limits: { expandedXmlBytes: Infinity },
  });
  expect(new TextDecoder().decode(encode(admitted.document))).toContain(
    "urn:doc#A",
  );
});

test("an import chain deeper than the former fixed cap follows the depth limit", async () => {
  const chain = 40;
  const ontology = (index) =>
    index < chain
      ? `Ontology(<urn:doc:${index}> Import(<urn:doc:${index + 1}>) Declaration(Class(<urn:doc:${index}#C>)))`
      : `Ontology(<urn:doc:${index}> Declaration(Class(<urn:doc:${index}#C>)))`;
  const resolveImport = async (iri) => ({
    bytes: bytes(ontology(Number(iri.slice("urn:doc:".length)))),
    documentIri: iri,
    mediaType: "text/owl-functional",
  });
  const chained = {
    documentIri: "urn:doc:0",
    mediaType: "text/owl-functional",
    resolveImport,
  };
  await expect(fromOwl(bytes(ontology(0)), chained)).resolves.toBeDefined();
  await expect(
    fromOwl(bytes(ontology(0)), { ...chained, limits: { depth: 10 } }),
  ).rejects.toMatchObject({
    code: "MODEL_RESOURCE_LIMIT",
    details: { resource: "maxImportDepth" },
  });
});

test("a parser bound fails with the code of the limit it derives from", async () => {
  const triples = Array.from(
    { length: 10 },
    (_, index) =>
      `<urn:doc#C${index}> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <${owl}Class> .`,
  ).join("\n");
  await expect(
    fromOwl(bytes(triples), {
      documentIri: "urn:doc",
      mediaType: "text/turtle",
      limits: { rdfQuads: 3 },
    }),
  ).rejects.toMatchObject({
    code: "RDF_RESOURCE_LIMIT",
    details: { stage: "owl-loading", resource: "maxQuads", limit: "rdfQuads" },
  });
});

test("every owlapi resource bound reports the caller limit it derives from", async () => {
  const { dependencyLimitFailure, loaderLimits } =
    await import("../src/owl/loading.js");
  const derived = {
    maxInputBytes: ["inputBytes", "INPUT_RESOURCE_LIMIT"],
    maxExpandedXmlBytes: ["expandedXmlBytes", "MODEL_RESOURCE_LIMIT"],
    maxEntityDeclarations: ["expandedXmlBytes", "MODEL_RESOURCE_LIMIT"],
    maxEntityExpansionDepth: ["expandedXmlBytes", "MODEL_RESOURCE_LIMIT"],
    maxEntityReplacementLength: ["expandedXmlBytes", "MODEL_RESOURCE_LIMIT"],
    maxAxioms: ["primaryRecords", "MODEL_RESOURCE_LIMIT"],
    maxBlankNodes: ["primaryRecords", "MODEL_RESOURCE_LIMIT"],
    maxImportCount: ["primaryRecords", "MODEL_RESOURCE_LIMIT"],
    maxTokenCount: ["embeddedValues", "MODEL_RESOURCE_LIMIT"],
    maxRdfListLength: ["embeddedValues", "MODEL_RESOURCE_LIMIT"],
    profileWork: ["embeddedValues", "MODEL_RESOURCE_LIMIT"],
    maxTokenLength: ["stringBytes", "MODEL_RESOURCE_LIMIT"],
    profileLiteralLength: ["stringBytes", "MODEL_RESOURCE_LIMIT"],
    profileNumericDigits: ["stringBytes", "MODEL_RESOURCE_LIMIT"],
    maxQuads: ["rdfQuads", "RDF_RESOURCE_LIMIT"],
    maxAnnotationDepth: ["depth", "MODEL_RESOURCE_LIMIT"],
    maxExpressionDepth: ["depth", "MODEL_RESOURCE_LIMIT"],
    maxXmlNestingDepth: ["depth", "MODEL_RESOURCE_LIMIT"],
    maxImportDepth: ["depth", "MODEL_RESOURCE_LIMIT"],
    expressionDepth: ["depth", "MODEL_RESOURCE_LIMIT"],
    profileDepth: ["depth", "MODEL_RESOURCE_LIMIT"],
    profilePatternDepth: ["depth", "MODEL_RESOURCE_LIMIT"],
  };
  for (const [resource, [limit, code]] of Object.entries(derived)) {
    expect(() => dependencyLimitFailure(resource, "owl-loading")).toThrow(
      expect.objectContaining({
        code,
        details: { stage: "owl-loading", resource, limit },
      }),
    );
  }
  for (const resource of ["timeoutMs", "profileTimeoutMs"]) {
    expect(() => dependencyLimitFailure(resource, "owl-validation")).toThrow(
      expect.objectContaining({ code: "DEADLINE_EXCEEDED" }),
    );
  }
  // A bound that owlapi fixes itself names its resource and no caller limit.
  expect(() => dependencyLimitFailure("cardinality", "owl-loading")).toThrow(
    expect.objectContaining({
      code: "MODEL_RESOURCE_LIMIT",
      details: { stage: "owl-loading", resource: "cardinality" },
    }),
  );
  // Every bound the adapter derives is covered.
  const lifted = new ResourceBudget({ limits: unbounded() }, performance.now());
  try {
    for (const resource of Object.keys(loaderLimits(lifted))) {
      expect([...Object.keys(derived), "timeoutMs"]).toContain(resource);
    }
  } finally {
    lifted.dispose();
  }
});

test("the adapter's derived bounds follow the caller's limits without fixed caps", async () => {
  const { loaderLimits } = await import("../src/owl/loading.js");
  const { profileCheckLimits } = await import("../src/owl/policy.js");
  const finite = new ResourceBudget(
    {
      limits: {
        primaryRecords: 300,
        depth: 40,
        stringBytes: 70000,
        embeddedValues: 600000,
      },
    },
    performance.now(),
  );
  try {
    const loader = loaderLimits(finite);
    expect(loader).toMatchObject({
      maxAnnotationDepth: 40,
      maxAxioms: 300,
      maxBlankNodes: 300,
      maxExpandedXmlBytes: 33554432,
      maxExpressionDepth: 40,
      maxImportCount: 300,
      maxImportDepth: 40,
      maxInputBytes: Number.MAX_SAFE_INTEGER,
      maxQuads: Number.MAX_SAFE_INTEGER,
      maxRdfListLength: 600000,
      maxTokenCount: 600000,
      maxTokenLength: 70000,
      maxXmlNestingDepth: 40,
    });
    expect(loader).not.toHaveProperty("maxEntityDeclarations");
    expect(loader.timeoutMs).toBeLessThanOrEqual(10000);
    expect(profileCheckLimits(finite)).toMatchObject({
      maxDepth: 40,
      maxLiteralLength: 70000,
      maxNumericDigits: 70000,
      maxWork: 1200000,
    });
  } finally {
    finite.dispose();
  }
  const lifted = new ResourceBudget({ limits: unbounded() }, performance.now());
  try {
    const most = Number.MAX_SAFE_INTEGER;
    expect(loaderLimits(lifted)).toEqual({
      maxAnnotationDepth: most,
      maxAxioms: most,
      maxBlankNodes: most,
      maxEntityDeclarations: most,
      maxEntityExpansionDepth: most,
      maxEntityReplacementLength: most,
      maxExpandedXmlBytes: most,
      maxExpressionDepth: most,
      maxImportCount: most,
      maxImportDepth: most,
      maxInputBytes: most,
      maxQuads: most,
      maxRdfListLength: most,
      maxTokenCount: most,
      maxTokenLength: most,
      maxXmlNestingDepth: most,
      timeoutMs: most,
    });
    expect(profileCheckLimits(lifted)).toEqual({
      maxDepth: most,
      maxLiteralLength: most,
      maxNumericDigits: most,
      maxWork: most,
      timeoutMs: null,
    });
  } finally {
    lifted.dispose();
  }
});
