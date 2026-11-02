import { readFileSync, readdirSync } from "node:fs";
import { envelope } from "../src/modelContract.js";
import { profiles } from "../src/profiles.js";
import { ResourceBudget } from "../src/resourceBudget.js";
import { walkTyped, validateFields } from "../src/typedValues.js";
import { walkTypedSelected } from "../src/selectedTraversal.js";

const directory = new URL("../conformance/vectors/", import.meta.url);
const vectors = readdirSync(directory, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map(({ name }) => name)
  .sort();
const selections = ["references", "handles", "references-and-sets"];
const wanted = (shape, selection) =>
  Boolean(
    shape?.reference ||
    (selection === "handles" && shape?.id) ||
    (selection === "references-and-sets" && shape?.items && !shape.sequence),
  );

function compare(value, descriptor, budget) {
  validateFields(value, descriptor, budget);
  for (const selection of selections) {
    const expected = [];
    walkTyped(value, descriptor, (value, shape, pointer, parent, key) => {
      if (wanted(shape, selection)) {
        expected.push({ value, shape, pointer, parent, key });
      }
    });
    const actual = [];
    walkTypedSelected(
      value,
      descriptor,
      (value, shape, pointer, parent, key) => {
        actual.push({ value, shape, pointer, parent, key });
      },
      budget,
      selection,
    );
    expect(actual).toEqual(expected);
  }
}

test.each(vectors)(
  "selected traversal preserves exact typed positions and order in %s",
  (name) => {
    const source = JSON.parse(
      readFileSync(new URL(`${name}/source.json`, directory)),
    );
    const budget = new ResourceBudget({}, performance.now());
    try {
      compare(
        source,
        envelope(
          source.visualization ? profiles.artifact : profiles.structuralContent,
        ),
        budget,
      );
    } finally {
      budget.dispose();
    }
  },
);

test("recursive annotations retain nested references while literal handle spellings stay unchanged", () => {
  const schema = { fields: {}, optional: [] };
  schema.fields = {
    annotations: { items: schema, minimum: 0 },
    literal: "String",
    subject: { reference: "S" },
  };
  const source = {
    annotations: [{ annotations: [], literal: "S", subject: "S" }],
    literal: "S",
    subject: "S",
  };
  const budget = new ResourceBudget({}, performance.now());
  try {
    compare(source, schema, budget);
    walkTypedSelected(
      source,
      schema,
      (value, _shape, _pointer, parent, key) => {
        parent[key] = `next:${value}`;
      },
      budget,
    );
    expect(source.subject).toBe("next:S");
    expect(source.annotations[0].subject).toBe("next:S");
    expect(source.literal).toBe("S");
    expect(source.annotations[0].literal).toBe("S");
  } finally {
    budget.dispose();
  }
});

test("selected traversal observes cancellation within the same finite visit bound", () => {
  const controller = new AbortController();
  const budget = new ResourceBudget(
    { signal: controller.signal },
    performance.now(),
  );
  const source = Array.from({ length: 4096 }, (_, index) => `S${index}`);
  let visits = 0;
  try {
    expect(() =>
      walkTypedSelected(
        source,
        { items: { reference: "S" }, minimum: 0 },
        () => {
          visits++;
          controller.abort();
        },
        budget,
      ),
    ).toThrow(expect.objectContaining({ code: "ABORTED" }));
    expect(visits).toBeGreaterThan(0);
    expect(visits).toBeLessThanOrEqual(1024);
  } finally {
    budget.dispose();
  }
});
