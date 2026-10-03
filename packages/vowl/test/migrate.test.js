import { migrate } from "vowl/migrate";
import { decode, encode, profiles } from "vowl";
import { readFileSync } from "node:fs";
import { legacySchema, validateLegacy } from "../src/migrate/grammar.js";
import { annotationReader } from "../src/migrate/annotations.js";
import {
  loadCorpus,
  checkRun,
  verifyPublic,
} from "../conformance/supplemental/migration/review-cases.mjs";

const dialect = "webvowl-legacy-354ed3af8c1e82019f6280b2594acaceac96cca0";
const options = { dialect, profile: profiles.structuralContent };
const bytes = (value) =>
  new TextEncoder().encode(
    typeof value === "string" ? value : JSON.stringify(value),
  );
const named = () => ({
  header: { iri: "urn:legacy:ontology" },
  class: [{ id: "node", type: "owl:Class" }],
  classAttribute: [{ id: "node", iri: "urn:legacy:A" }],
});
const corpus = await loadCorpus();

test.each(corpus.runs)("independent legacy migration: $id", async (run) => {
  await checkRun(run, { migrate, encode });
});

test("caller bytes and resolution data are captured before asynchronous work", async () => {
  // The independent verifier also checks envelope immutability and diagnostic order.
  await verifyPublic(
    { migrate, encode },
    {
      ...corpus,
      runs: corpus.runs.filter((run) =>
        ["named-class-structural", "resolved-iri-annotation"].includes(run.id),
      ),
    },
  );
});

test("published closed ingress shape matches its schema inventory", () => {
  expect(
    JSON.parse(
      readFileSync(
        new URL("../schema/legacy-354ed3af.schema.json", import.meta.url),
      ),
    ),
  ).toEqual(legacySchema);
});

test.each([
  [
    "coerced ID collision",
    (input) => {
      input.class[0].id = 1;
      input.classAttribute[0].id = 1;
      input.class.push({ id: "1", type: "owl:Class" });
      input.classAttribute.push({ id: "1", iri: "urn:other" });
    },
  ],
  [
    "cross-collection ID collision",
    (input) => {
      input.datatype = [{ id: "node", type: "rdfs:Datatype" }];
      input.datatypeAttribute = [{ id: "node", iri: "urn:datatype" }];
    },
  ],
  [
    "unknown field on a discarded metrics container",
    (input) => {
      input.metrics = { retainedFact: 1 };
    },
  ],
  [
    "invalid saved numeric string in structural profile",
    (input) => {
      input.settings = { global: { zoom: "NaN" } };
    },
  ],
  [
    "misplaced class field",
    (input) => {
      input.classAttribute[0].domain = "node";
    },
  ],
])("fails closed for %s", async (_name, change) => {
  const input = named();
  change(input);
  await expect(migrate(bytes(input), options)).rejects.toMatchObject({
    code: "MIGRATION_AMBIGUOUS",
  });
});

test("parallel records compare JSON values independent of object-member order", async () => {
  const input = named();
  input.class[0].label = { fr: "Nom", en: "Name" };
  input.classAttribute[0].label = { en: "Name", fr: "Nom" };
  const document = (await migrate(bytes(input), options)).document;
  expect(
    document.structural.constructs.filter(
      (value) => value.kind === "annotation-assertion",
    ),
  ).toHaveLength(2);
});

test("an incompatible predicate resolution cannot override retained namespace and local name", async () => {
  const run = corpus.runs.find((run) => run.id === "resolved-iri-annotation");
  await expect(
    migrate(run.bytes, {
      ...options,
      resolutions: [{ ...run.resolutions[0], iri: "urn:unrelated" }],
    }),
  ).rejects.toMatchObject({ code: "MIGRATION_RESOLUTION_INVALID" });
});

test("resolution accessors are rejected without invoking caller code", async () => {
  let invoked = false;
  const record = { kind: "ontology-iri", sourcePointer: "/header/iri" };
  Object.defineProperty(record, "iri", {
    enumerable: true,
    get() {
      invoked = true;
      return "urn:forged";
    },
  });
  await expect(
    migrate(bytes(named()), { ...options, resolutions: [record] }),
  ).rejects.toMatchObject({ code: "MIGRATION_RESOLUTION_INVALID" });
  expect(invoked).toBe(false);
});

test("shared aggregate primary-record limits include the legacy join", async () => {
  await expect(
    migrate(bytes(named()), { ...options, limits: { primaryRecords: 1 } }),
  ).rejects.toMatchObject({ code: "MODEL_RESOURCE_LIMIT" });
});

test("multiple grammar defects obey required-field-before-unknown-field precedence", async () => {
  const input = named();
  delete input.class[0].id;
  input.class[0].aaa = "unknown";
  await expect(migrate(bytes(input), options)).rejects.toMatchObject({
    code: "MIGRATION_AMBIGUOUS",
    pointer: "/class/0/id",
  });
});

test("grammar rejects the first invalid scalar without collecting errors for its suffix", () => {
  let remaining = 64;
  const budget = {
    check() {
      if (--remaining === 0) {
        throw new Error("The invalid suffix exhausted the operation budget");
      }
    },
  };
  expect(() =>
    validateLegacy({ header: { imports: Array(100000).fill(0) } }, budget),
  ).toThrow(
    expect.objectContaining({
      code: "MIGRATION_AMBIGUOUS",
      pointer: "/header/imports/0",
    }),
  );
});

test("localized annotation summaries use bounded shared redundancy lookups", () => {
  let remaining = 10000;
  const annotations = {
    description: Array.from({ length: 500 }, (_, index) => ({
      identifier: "description",
      type: "label",
      value: `value-${index}`,
      language: "en",
    })),
  };
  const description = Object.fromEntries(
    Array.from({ length: 500 }, (_, index) => [`x-${index}`, "distinct"]),
  );
  const reader = annotationReader({
    budget: {
      check() {
        if (--remaining === 0) {
          throw new Error("Repeated annotation scans exhausted the budget");
        }
      },
    },
    policy: { allow() {}, drop() {} },
  });
  expect(() =>
    reader.prepare({ annotations, description }, "", {
      target: "urn:subject",
    }),
  ).not.toThrow();
});

test("one recoverable class becomes an admitted, immutable structural document", async () => {
  const input = bytes(named());
  const original = input.slice();
  const result = await migrate(input, options);
  expect(result.document.structural.ontology.iri).toBe("urn:legacy:ontology");
  expect(result.document.structural.roles.map((role) => role.kind)).toEqual([
    "class",
  ]);
  expect(
    result.document.structural.occurrences.map((occurrence) => occurrence.kind),
  ).toEqual(["class-node"]);
  expect(encode(await decode(encode(result.document)))).toEqual(
    encode(result.document),
  );
  expect(Object.isFrozen(result)).toBe(true);
  expect(Object.isFrozen(result.diagnostics)).toBe(true);
  expect(input).toEqual(original);
});

test("explicit dialect and duplicate-safe bytes fail before semantic interpretation", async () => {
  await expect(
    migrate(bytes(named()), { ...options, dialect: "guess" }),
  ).rejects.toMatchObject({ code: "MIGRATION_DIALECT_UNKNOWN" });
  await expect(
    migrate(bytes('{"header":{"iri":"urn:a","iri":"urn:b"}}'), options),
  ).rejects.toMatchObject({ code: "JSON_DUPLICATE_MEMBER" });
});

test("abort and byte budgets cover ingress before joins", async () => {
  await expect(
    migrate(bytes(named()), { ...options, signal: AbortSignal.abort() }),
  ).rejects.toMatchObject({ code: "ABORTED" });
  await expect(
    migrate(bytes(named()), { ...options, limits: { inputBytes: 1 } }),
  ).rejects.toMatchObject({ code: "INPUT_RESOURCE_LIMIT" });
});
