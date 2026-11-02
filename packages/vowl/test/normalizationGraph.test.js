import { jest } from "@jest/globals";
import * as graph from "../src/validateGraph.js";
import { ResourceBudget } from "../src/resourceBudget.js";
import { profiles } from "../src/profiles.js";
import { validateProjection } from "../src/projection.js";

const validateGraph = jest.fn(graph.validateGraph);
jest.unstable_mockModule("../src/validateGraph.js", () => ({
  ...graph,
  validateGraph,
}));
const { normalizeDraft } = await import("../src/editing.js");

function source() {
  return {
    structural: {
      ontology: { imports: [], annotations: [] },
      subjects: [
        { id: "a", iri: "urn:A" },
        { id: "b", iri: "urn:B" },
      ],
      roles: [
        { id: "A", kind: "class", subject: "a" },
        { id: "B", kind: "class", subject: "b" },
      ],
      expressions: [],
      constructs: [{ id: "K", kind: "subclass", sub: "A", super: "B" }],
      occurrences: [],
    },
  };
}

function normalize(draft) {
  const budget = new ResourceBudget(
    { limits: { deadlineMs: Infinity } },
    performance.now(),
  );
  validateGraph.mockClear();
  try {
    const result = normalizeDraft(draft, budget);
    const calls = validateGraph.mock.calls.slice();
    const context = graph.validateMeaning(
      draft,
      graph.validateGraph(draft, profiles.structuralContent, budget, false),
      budget,
    );
    validateProjection(draft, context, budget);
    return { result, calls };
  } finally {
    budget.dispose();
  }
}

test("unchanged normalization phases reuse reference checks and retain full final validation", () => {
  const draft = source();
  const { calls } = normalize(draft);
  expect(calls.filter((call) => call[4] === true).length).toBe(1);
  expect(calls.filter((call) => call[4] !== true)).toHaveLength(1);
  expect(draft.structural.constructs).toEqual([
    { id: "K", kind: "subclass", sub: "A", super: "B" },
  ]);
  expect(draft.structural.occurrences.length).toBeGreaterThan(0);
});

test("aliases, duplicate expression members and endpoint aggregation invalidate graph facts", () => {
  const draft = source();
  draft.structural.subjects.push({ id: "duplicate-b", iri: "urn:B" });
  draft.structural.roles.push(
    { id: "duplicate-B", kind: "class", subject: "duplicate-b" },
    { id: "property", kind: "object-property", subject: "a" },
  );
  draft.structural.expressions.push({
    id: "X",
    kind: "class-intersection",
    members: ["A", "duplicate-B", "A"],
  });
  draft.structural.constructs.push(
    {
      id: "domain-a",
      kind: "object-domain",
      property: "property",
      target: "X",
    },
    {
      id: "domain-b",
      kind: "object-domain",
      property: "property",
      target: "duplicate-B",
    },
  );
  const { result, calls } = normalize(draft);
  expect(result.resolve("duplicate-b")).toBe("b");
  expect(result.resolve("duplicate-B")).toBe("B");
  expect(
    draft.structural.expressions.find(({ id }) => id === "X").members,
  ).toEqual(["A", "B"]);
  const domains = draft.structural.constructs.filter(
    ({ kind }) => kind === "object-domain",
  );
  expect(domains).toHaveLength(1);
  expect(
    draft.structural.expressions.find(({ id }) => id === domains[0].target)
      .members,
  ).toEqual(["X", "B"]);
  expect(calls.filter((call) => call[4] === true).length).toBeGreaterThan(1);
});

test("signature promotion rewrites generic roles before reachability and final meaning checks", () => {
  const draft = source();
  draft.structural.subjects.push({ id: "predicate", iri: "urn:label" });
  draft.structural.roles.push({
    id: "generic",
    kind: "rdf-property",
    subject: "predicate",
  });
  draft.structural.ontology.annotations.push({
    predicate: "urn:label",
    value: {
      kind: "typed",
      datatype: "http://www.w3.org/2001/XMLSchema#string",
      lexical: "label",
    },
    annotations: [],
  });
  const { result } = normalize(draft);
  const specific = draft.structural.roles.find(
    ({ subject, kind }) =>
      subject === "predicate" && kind === "annotation-property",
  );
  expect(specific).toBeDefined();
  expect(result.resolve("generic")).toBe(specific.id);
  expect(draft.structural.roles.some(({ id }) => id === "generic")).toBe(false);
});
