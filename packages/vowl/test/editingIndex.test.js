import { applyChanges } from "../src/editing.js";
import { ResourceBudget } from "../src/resourceBudget.js";

const source = (size = 5) => ({
  structural: {
    ontology: { imports: [], annotations: [] },
    subjects: Array.from({ length: size }, (_, i) => ({
      id: `s${i}`,
      iri: `urn:${i}`,
    })),
    roles: [],
    expressions: [],
    constructs: [],
    occurrences: [],
  },
});

test("ordered removals, replacement and insertion keep later handles and collection order", () => {
  const budget = new ResourceBudget({}, performance.now());
  try {
    const draft = source();
    applyChanges(
      draft,
      [
        { kind: "remove", id: "s0" },
        { kind: "remove", id: "s2" },
        {
          kind: "replace",
          id: "s4",
          record: { id: "s4", iri: "urn:replaced" },
        },
        {
          kind: "insert",
          collection: "subjects",
          record: { id: "new", iri: "urn:new" },
        },
        {
          kind: "replace",
          id: "new",
          record: { id: "new", iri: "urn:changed" },
        },
        { kind: "remove", id: "s3" },
      ],
      budget,
    );
    expect(draft.structural.subjects).toEqual([
      { id: "s1", iri: "urn:1" },
      { id: "s4", iri: "urn:replaced" },
      { id: "new", iri: "urn:changed" },
    ]);
  } finally {
    budget.dispose();
  }
});

test.each(["s0", "occurrence"])(
  "removed or occurrence handle %s remains reserved",
  (id) => {
    const budget = new ResourceBudget({}, performance.now());
    try {
      const draft = source();
      draft.structural.occurrences.push({ id: "occurrence" });
      const changes = id === "s0" ? [{ kind: "remove", id }] : [];
      changes.push({
        kind: "insert",
        collection: "subjects",
        record: { id, iri: "urn:reuse" },
      });
      expect(() => applyChanges(draft, changes, budget)).toThrow(
        expect.objectContaining({
          code: "EDIT_INVALID",
          pointer: `/changes/${changes.length - 1}`,
        }),
      );
    } finally {
      budget.dispose();
    }
  },
);

test("a removed target is unavailable to later operations at their exact request pointer", () => {
  const budget = new ResourceBudget({}, performance.now());
  try {
    expect(() =>
      applyChanges(
        source(),
        [
          { kind: "remove", id: "s0" },
          { kind: "remove", id: "s0" },
        ],
        budget,
      ),
    ).toThrow(
      expect.objectContaining({ code: "EDIT_INVALID", pointer: "/changes/1" }),
    );
  } finally {
    budget.dispose();
  }
});

test("direct replacement lookup work grows with records plus requests", () => {
  const budget = new ResourceBudget({}, performance.now());
  const poll = budget.poll.bind(budget);
  let visits = 0;
  budget.poll = () => {
    visits++;
    poll();
  };
  try {
    const draft = source(1000);
    const changes = Array.from({ length: 400 }, (_, i) => ({
      kind: "replace",
      id: `s${999 - i}`,
      record: { id: `s${999 - i}`, iri: `urn:replacement:${i}` },
    }));
    applyChanges(draft, changes, budget);
    expect(draft.structural.subjects[999].iri).toBe("urn:replacement:0");
    expect(draft.structural.subjects).toHaveLength(1000);
    expect(visits).toBeLessThan(20 * (1000 + changes.length));
  } finally {
    budget.dispose();
  }
});

test("removal tombstones do not interrupt ordered assertion-anchor retargeting", () => {
  const budget = new ResourceBudget({}, performance.now());
  try {
    const draft = source();
    const assertion = { kind: "subclass", sub: "a", super: "b" };
    draft.structural.constructs = [
      { id: "removed", kind: "assertion-anchor", assertion, annotations: [] },
      { id: "fact", ...assertion },
      {
        id: "retained",
        kind: "assertion-anchor",
        assertion: { ...assertion },
        annotations: [],
      },
    ];
    applyChanges(
      draft,
      [
        { kind: "remove", id: "removed" },
        {
          kind: "replace",
          id: "fact",
          record: { id: "fact", kind: "subclass", sub: "a", super: "c" },
        },
      ],
      budget,
    );
    expect(draft.structural.constructs.map(({ id }) => id)).toEqual([
      "fact",
      "retained",
    ]);
    expect(draft.structural.constructs[1].assertion).toEqual({
      kind: "subclass",
      sub: "a",
      super: "c",
    });
  } finally {
    budget.dispose();
  }
});
