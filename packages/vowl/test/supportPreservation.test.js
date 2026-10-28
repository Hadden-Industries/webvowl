import { createPreservedSupportLookup } from "../src/supportPreservation.js";
import { ResourceBudget } from "../src/resourceBudget.js";

const state = (records, supports = []) => ({
  structural: {
    ontology: { imports: [], annotations: [] },
    subjects: [],
    roles: [],
    expressions: [],
    constructs: [],
    occurrences: [],
    ...records,
  },
  supports,
});
const support = (record, origin = "canonical", assertion = record) => ({
  record,
  origin,
  assertions: [assertion],
  derivations: [],
});

test("complete mapped content, independent of object member order, preserves support", () => {
  const budget = new ResourceBudget({}, performance.now());
  try {
    const prior = support("before");
    const lookup = createPreservedSupportLookup(
      state({ subjects: [{ id: "before", iri: "urn:A" }] }, [prior]),
      new Map([["before", "after"]]),
      budget,
    );
    expect(lookup({ iri: "urn:A", id: "after" })).toBe(prior);
    expect(lookup({ id: "after", iri: "urn:changed" })).toBeUndefined();
    expect(lookup({ id: "unrelated", iri: "urn:A" })).toBeUndefined();
  } finally {
    budget.dispose();
  }
});

test("typed references map while literal strings that look like handles retain their content", () => {
  const budget = new ResourceBudget({}, performance.now());
  try {
    const prior = support("annotation");
    const record = {
      id: "annotation",
      kind: "annotation-assertion",
      subject: "subject",
      predicate: "urn:note",
      value: {
        kind: "typed",
        datatype: "http://www.w3.org/2001/XMLSchema#string",
        lexical: "subject",
      },
    };
    const lookup = createPreservedSupportLookup(
      state(
        { subjects: [{ id: "subject", iri: "urn:A" }], constructs: [record] },
        [support("subject"), prior],
      ),
      new Map([
        ["subject", "renamed"],
        ["annotation", "new:annotation"],
      ]),
      budget,
    );
    const current = { ...record, id: "new:annotation", subject: "renamed" };
    expect(lookup(current)).toBe(prior);
    expect(
      lookup({ ...current, value: { ...record.value, lexical: "renamed" } }),
    ).toBeUndefined();
  } finally {
    budget.dispose();
  }
});

test("many-to-one correspondence preserves the last matching non-edit support", () => {
  const budget = new ResourceBudget({}, performance.now());
  try {
    const subjects = ["a", "b", "c"].map((id) => ({ id, iri: `urn:${id}` }));
    const roles = subjects.map(({ id }) => ({
      id: `r:${id}`,
      kind: "class",
      subject: id,
    }));
    const first = support("r:a", "canonical", "first");
    const edited = support("r:b", "edit", "middle");
    const last = support("r:c", "canonical", "last");
    const successors = new Map([
      ...subjects.map(({ id }) => [id, "merged:subject"]),
      ...roles.map(({ id }) => [id, "merged:role"]),
    ]);
    const lookup = createPreservedSupportLookup(
      state({ subjects, roles }, [
        ...subjects.map(({ id }) => support(id)),
        first,
        edited,
        last,
      ]),
      successors,
      budget,
    );
    expect(
      lookup({ id: "merged:role", kind: "class", subject: "merged:subject" }),
    ).toBe(last);
  } finally {
    budget.dispose();
  }
});

test("mixed equal and changed aliases use the canonical fallback's exact matching precedence", () => {
  const budget = new ResourceBudget({}, performance.now());
  try {
    const matching = support("a");
    const lookup = createPreservedSupportLookup(
      state(
        {
          subjects: [
            { id: "a", iri: "urn:A" },
            { id: "b", iri: "urn:B" },
          ],
        },
        [matching, support("b")],
      ),
      new Map([
        ["a", "merged"],
        ["b", "merged"],
      ]),
      budget,
    );
    expect(lookup({ id: "merged", iri: "urn:A" })).toBe(matching);
    expect(lookup({ id: "merged", iri: "urn:new" })).toBeUndefined();
  } finally {
    budget.dispose();
  }
});

test("deleted correspondence cannot invent preserved support", () => {
  const budget = new ResourceBudget({}, performance.now());
  try {
    const lookup = createPreservedSupportLookup(
      state({ subjects: [{ id: "before", iri: "urn:A" }] }, [
        support("before"),
      ]),
      new Map([["before", null]]),
      budget,
    );
    expect(lookup({ id: "new", iri: "urn:A" })).toBeUndefined();
  } finally {
    budget.dispose();
  }
});

test("mapped property-chain sequences retain order and repeated references", () => {
  const budget = new ResourceBudget({}, performance.now());
  try {
    const record = {
      id: "chain",
      kind: "property-chain",
      members: ["p", "q", "p"],
      super: "p",
    };
    const prior = support("chain");
    const lookup = createPreservedSupportLookup(
      state({ constructs: [record] }, [prior]),
      new Map([
        ["chain", "new:chain"],
        ["p", "new:p"],
        ["q", "new:q"],
      ]),
      budget,
    );
    expect(
      lookup({
        id: "new:chain",
        kind: "property-chain",
        members: ["new:p", "new:q", "new:p"],
        super: "new:p",
      }),
    ).toBe(prior);
    expect(
      lookup({
        id: "new:chain",
        kind: "property-chain",
        members: ["new:q", "new:p", "new:p"],
        super: "new:p",
      }),
    ).toBeUndefined();
    expect(
      lookup({
        id: "new:chain",
        kind: "property-chain",
        members: ["new:p", "new:q"],
        super: "new:p",
      }),
    ).toBeUndefined();
  } finally {
    budget.dispose();
  }
});
