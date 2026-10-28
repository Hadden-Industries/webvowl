import { generateProjection, validateProjection } from "../src/projection.js";
import { ResourceBudget } from "../src/resourceBudget.js";
import { validateGraph, validateMeaning } from "../src/validateGraph.js";
import { profiles } from "../src/profiles.js";

function source(size, occupied = []) {
  return {
    structural: {
      ontology: { imports: [], annotations: [] },
      subjects: [
        ...Array.from({ length: size }, (_, i) => ({
          id: `subject${i}`,
          iri: `urn:class:${i}`,
        })),
        ...occupied.map((i) => ({
          id: `generated${i}`,
          iri: `urn:reserved:${i}`,
        })),
      ],
      roles: [
        ...Array.from({ length: size }, (_, i) => ({
          id: `class${i}`,
          subject: `subject${i}`,
          kind: "class",
        })),
        ...occupied.map((i) => ({
          id: `reservedRole${i}`,
          subject: `generated${i}`,
          kind: "annotation-property",
        })),
      ],
      expressions: [],
      constructs: [],
      occurrences: Array.from({ length: size }, (_, i) => ({
        id: `actual${i}`,
        kind: "class-node",
        targets: [`class${i}`],
      })),
    },
  };
}

function contextFor(input, budget) {
  return validateMeaning(
    input,
    validateGraph(input, profiles.structuralContent, budget, false),
    budget,
  );
}

test.each([false, true])(
  "allocator work is bounded by the occupied prefix plus emitted nodes (normalizing=%s)",
  (normalizing) => {
    for (const [prefix, size] of [
      [0, 1],
      [16, 32],
      [256, 256],
      [1024, 512],
    ]) {
      const budget = new ResourceBudget({}, performance.now());
      try {
        const input = source(
          size,
          Array.from({ length: prefix }, (_, i) => i),
        );
        const context = contextFor(input, budget);
        const get = context.get;
        let attempts = 0;
        context.get = (id) => {
          if (/^generated[0-9]+$/.test(id)) {
            attempts++;
          }
          return get(id);
        };
        const { expected } = generateProjection(input, context, budget, {
          normalizing,
        });
        expect(expected).toHaveLength(size);
        expect(attempts).toBe(prefix + size);
        expect(expected.map(({ id }) => id)).toEqual(
          Array.from({ length: size }, (_, i) => `generated${prefix + i}`),
        );
        validateProjection(input, context, budget);
      } finally {
        budget.dispose();
      }
    }
  },
);

test("gapped occupied IDs retain the reference allocator's smallest available IDs", () => {
  const budget = new ResourceBudget({}, performance.now());
  try {
    const input = source(3, [0, 2, 4]);
    const { expected } = generateProjection(
      input,
      contextFor(input, budget),
      budget,
    );
    expect(expected).toEqual([
      { id: "generated1", kind: "class-node", targets: ["class0"] },
      { id: "generated3", kind: "class-node", targets: ["class1"] },
      { id: "generated5", kind: "class-node", targets: ["class2"] },
    ]);
  } finally {
    budget.dispose();
  }
});

test.each(["ABORTED", "DEADLINE_EXCEEDED"])(
  "a long collision prefix observes %s within 1024 allocator visits",
  (code) => {
    const controller = new AbortController();
    const budget = new ResourceBudget(
      { signal: controller.signal },
      performance.now(),
    );
    try {
      const input = source(
        1,
        Array.from({ length: 4096 }, (_, i) => i),
      );
      const context = contextFor(input, budget);
      const get = context.get;
      let attempts = 0;
      context.get = (id) => {
        if (/^generated[0-9]+$/.test(id) && ++attempts === 37) {
          if (code === "ABORTED") {
            controller.abort();
          } else {
            budget.deadline = performance.now();
          }
        }
        return get(id);
      };
      expect(() =>
        generateProjection(input, context, budget, { normalizing: true }),
      ).toThrow(expect.objectContaining({ code }));
      expect(attempts).toBeGreaterThanOrEqual(37);
      expect(attempts).toBeLessThanOrEqual(37 + 1024);
    } finally {
      budget.dispose();
    }
  },
);

test("strict projection generation retains the early cardinality guard", () => {
  const budget = new ResourceBudget({}, performance.now());
  try {
    const input = source(2);
    input.structural.occurrences.length = 1;
    expect(() =>
      generateProjection(input, contextFor(input, budget), budget),
    ).toThrow(
      expect.objectContaining({
        code: "PROJECTION_INVALID",
        pointer: "/structural/occurrences",
      }),
    );
  } finally {
    budget.dispose();
  }
});
