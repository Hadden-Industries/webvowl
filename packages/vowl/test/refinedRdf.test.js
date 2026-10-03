import rdf from "rdf-canonize";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { profiles } from "../src/profiles.js";
import { refineDataset } from "../src/refinedRdf.js";
import { mapDataset } from "../src/internalRdf.js";
import { ResourceBudget } from "../src/resourceBudget.js";

const blank = (value) => ({ termType: "BlankNode", value });
const named = (value) => ({ termType: "NamedNode", value });
const quad = (subject, predicate, object) => ({
  subject,
  predicate: named(predicate),
  object,
  graph: { termType: "DefaultGraph", value: "" },
});
async function canonical(dataset, limits = {}) {
  const budget = new ResourceBudget({ limits }, performance.now());
  try {
    const result = await refineDataset(dataset, budget);
    const blankCount = new Set(
      dataset
        .flatMap(({ subject, object }) => [subject, object])
        .filter(({ termType }) => termType === "BlankNode")
        .map(({ value }) => value),
    ).size;
    return {
      ...result,
      canonical: await rdf.canonize(result.dataset, {
        algorithm: "RDFC-1.0",
        maxDeepIterations: Math.min(
          blankCount ** 2,
          budget.limits.rdfDeepIterations,
        ),
        signal: budget.signal,
      }),
    };
  } finally {
    budget.dispose();
  }
}

test("refinement is invariant to blank labels and quad enumeration", async () => {
  const source = [
    quad(blank("a"), "urn:p", blank("b")),
    quad(blank("b"), "urn:p", named("urn:C")),
  ];
  const renamed = [
    quad(blank("y"), "urn:p", named("urn:C")),
    quad(blank("x"), "urn:p", blank("y")),
  ];
  expect((await canonical(source)).canonical).toBe(
    (await canonical(renamed)).canonical,
  );
  expect((await canonical(source)).classes).toBe(2);
});

test("independently derived four-node path partitions eliminate N-degree work", async () => {
  const path = [
    quad(blank("a"), "urn:p", blank("b")),
    quad(blank("b"), "urn:p", blank("c")),
    quad(blank("c"), "urn:p", blank("d")),
  ];
  await expect(
    rdf.canonize(path, { algorithm: "RDFC-1.0", maxDeepIterations: 0 }),
  ).rejects.toThrow("Maximum deep iterations exceeded (0)");
  const result = await canonical(path, { rdfDeepIterations: 0 });
  expect(result.rounds).toBe(3);
  expect(result.classes).toBe(4);
});

test("equal colors do not conflate two three-cycles with one six-cycle", async () => {
  const cycle = (names) =>
    names.map((name, index) =>
      quad(blank(name), "urn:p", blank(names[(index + 1) % names.length])),
    );
  const two = [...cycle(["a", "b", "c"]), ...cycle(["d", "e", "f"])];
  const one = cycle(["a", "b", "c", "d", "e", "f"]);
  const left = await canonical(two);
  const right = await canonical(one);
  for (const result of [left, right]) {
    expect(result.rounds).toBe(1);
    expect(result.classes).toBe(1);
  }
  expect(left.dataset[6].object.value).toBe(right.dataset[6].object.value);
  expect(left.canonical).not.toBe(right.canonical);
  for (const dataset of [one, two]) {
    await expect(canonical(dataset, { rdfDeepIterations: 0 })).rejects.toThrow(
      "Maximum deep iterations exceeded (0)",
    );
  }
});

test("refinement rejects its reserved namespace, non-IRI predicates and excessive string allocation", async () => {
  for (const source of [
    [
      quad(
        blank("a"),
        "https://haddenindustries.com/ontology/vowl/compatible-mapping/v1#color",
        named("urn:C"),
      ),
    ],
    [{ ...quad(blank("a"), "urn:p", blank("b")), predicate: blank("p") }],
  ]) {
    await expect(canonical(source)).rejects.toMatchObject({
      code: "DEPENDENCY_FAILURE",
    });
  }
  await expect(
    canonical(
      [
        quad(blank("a"), "urn:p", {
          termType: "Literal",
          value: '"\\'.repeat(5000),
          datatype: named("urn:datatype"),
          language: "",
        }),
      ],
      { totalStringBytes: 8192 },
    ),
  ).rejects.toMatchObject({ code: "RDF_RESOURCE_LIMIT" });
});

const vectors = new URL("../conformance/vectors/", import.meta.url);
test.each(
  readdirSync(vectors).filter(
    (name) => !existsSync(new URL(`${name}/expected-error.json`, vectors)),
  ),
)(
  "candidate mapping preserves the RDF graph and blank-renaming identity for %s",
  async (name) => {
    const canonicalFile = new URL(`${name}/canonical.json`, vectors);
    const source = JSON.parse(
      readFileSync(
        existsSync(canonicalFile)
          ? canonicalFile
          : new URL(`${name}/source.json`, vectors),
      ),
    );
    const document = {
      profile: source.visualization
        ? profiles.artifact
        : profiles.structuralContent,
      ...source,
    };
    const budget = new ResourceBudget({}, performance.now());
    try {
      const { dataset } = mapDataset(document, budget);
      const labels = [
        ...new Set(
          dataset
            .flatMap(({ subject, object }) => [subject, object])
            .filter(({ termType }) => termType === "BlankNode")
            .map(({ value }) => value),
        ),
      ];
      const names = new Map(
        labels.map((id, index) => [id, `permuted${labels.length - index}`]),
      );
      const rename = (term) =>
        term.termType === "BlankNode"
          ? { ...term, value: names.get(term.value) }
          : term;
      const renamed = dataset
        .map((entry) => ({
          ...entry,
          subject: rename(entry.subject),
          object: rename(entry.object),
        }))
        .reverse();
      const original = await canonical(dataset);
      expect(original.dataset.slice(0, dataset.length)).toEqual(dataset);
      const permuted = await canonical(renamed);
      expect(permuted.canonical).toBe(original.canonical);
      expect(permuted.rounds).toBe(original.rounds);
      expect(permuted.classes).toBe(original.classes);
      const colors = new Map(
        permuted.dataset
          .slice(dataset.length)
          .map(({ subject, object }) => [subject.value, object.value]),
      );
      for (const { subject, object } of original.dataset.slice(
        dataset.length,
      )) {
        expect(colors.get(names.get(subject.value))).toBe(object.value);
      }
    } finally {
      budget.dispose();
    }
  },
);

test("unresolved symmetry still consumes the existing RDFC work allowance", async () => {
  const source = [
    quad(blank("a"), "urn:p", blank("b")),
    quad(blank("b"), "urn:p", blank("a")),
  ];
  await expect(canonical(source, { rdfDeepIterations: 0 })).rejects.toThrow(
    "Maximum deep iterations exceeded (0)",
  );
});

test("retained base edges preserve direction, predicates and literal lexical forms", async () => {
  const source = [quad(blank("a"), "urn:p", named("urn:C"))];
  const result = await canonical(source);
  expect(result.dataset[0]).toBe(source[0]);
  for (const other of [
    [quad(named("urn:C"), "urn:p", blank("a"))],
    [quad(blank("a"), "urn:q", named("urn:C"))],
    [quad(blank("a"), "urn:p", named("urn:D"))],
  ]) {
    expect((await canonical(other)).canonical).not.toBe(result.canonical);
  }
  const literal = (value) => ({
    termType: "Literal",
    value,
    language: "",
    datatype: named("http://www.w3.org/2001/XMLSchema#integer"),
  });
  expect(
    (await canonical([quad(blank("a"), "urn:p", literal("01"))])).canonical,
  ).not.toBe(
    (await canonical([quad(blank("a"), "urn:p", literal("1"))])).canonical,
  );
});

test("symmetric nodes receive identical colors rather than invented input-order identities", async () => {
  const source = [
    quad(blank("a"), "urn:p", blank("b")),
    quad(blank("b"), "urn:p", blank("a")),
  ];
  const result = await canonical(source);
  expect(result.classes).toBe(1);
  expect(result.rounds).toBe(1);
  expect(result.dataset.slice(2).map(({ object }) => object.value)[0]).toBe(
    result.dataset[3].object.value,
  );
});

test("refinement obeys the existing work and quad limits", async () => {
  const source = [quad(blank("a"), "urn:p", blank("b"))];
  await expect(canonical(source, { embeddedValues: 1 })).rejects.toMatchObject({
    code: "RDF_RESOURCE_LIMIT",
  });
  await expect(canonical(source, { rdfQuads: 1 })).rejects.toMatchObject({
    code: "RDF_RESOURCE_LIMIT",
  });
  const abort = new AbortController();
  const budget = new ResourceBudget(
    { signal: abort.signal },
    performance.now(),
  );
  abort.abort();
  try {
    await expect(refineDataset(source, budget)).rejects.toMatchObject({
      code: "ABORTED",
    });
  } finally {
    budget.dispose();
  }
});

test("batched refinement preserves the exact incident-work boundary", async () => {
  // 64 single-incidence vertices: 64 index visits plus two rounds of 64.
  // This also fails with outstanding hashes in the final batch at 191 units.
  const source = Array.from({ length: 64 }, (_, index) =>
    quad(blank(`b${index}`), "urn:p", named(`urn:C${index}`)),
  );
  await expect(
    canonical(source, { embeddedValues: 191 }),
  ).rejects.toMatchObject({
    code: "RDF_RESOURCE_LIMIT",
    details: { limit: "embeddedValues", maximum: 191, actual: 192 },
  });
  const result = await canonical(source, { embeddedValues: 192 });
  expect(result.rounds).toBe(2);
  expect(result.classes).toBe(64);
});
