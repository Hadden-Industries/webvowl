import { issueIds } from "../src/internalRdf.js";
import { refineDataset } from "../src/refinedRdf.js";
import { ResourceBudget } from "../src/resourceBudget.js";
import { orderSets, jsonKey } from "../src/canonicalJson.js";

const reference = { reference: "Q" };
const record = {
  fields: {
    id: { id: "Q" },
    code: "String",
    related: { items: reference, minimum: 0 },
  },
  optional: [],
};
const descriptor = {
  fields: { profile: "IRI", qualifications: { items: record, minimum: 0 } },
  optional: [],
};
async function canonical(document) {
  const budget = new ResourceBudget({}, performance.now());
  try {
    const issued = await issueIds(document, budget, {
      contract: {
        descriptor,
        collections: [
          {
            records: document.qualifications,
            type: "Qualification",
            prefix: "q",
          },
        ],
      },
      refine: refineDataset,
    });
    orderSets(document, descriptor, budget);
    return { issued, bytes: jsonKey(document) };
  } finally {
    budget.dispose();
  }
}

test("private typed mapping contract issues qualification references independently of input labels", async () => {
  const first = {
    profile: "urn:test:qualified-artifact",
    qualifications: [
      { id: "first", code: "SELECTED", related: ["second"] },
      { id: "second", code: "UNVERIFIED", related: [] },
    ],
  };
  const second = {
    profile: first.profile,
    qualifications: [
      { id: "b", code: "UNVERIFIED", related: [] },
      { id: "a", code: "SELECTED", related: ["b"] },
    ],
  };
  const left = await canonical(first);
  const right = await canonical(second);
  expect(left.bytes).toBe(right.bytes);
  expect(first.qualifications.every(({ id }) => /^q[0-9]+$/.test(id))).toBe(
    true,
  );
  expect(left.issued.get("first")).toBe(right.issued.get("a"));
  const changed = {
    profile: first.profile,
    qualifications: [
      { id: "a", code: "SELECTED", related: [] },
      { id: "b", code: "UNVERIFIED", related: [] },
    ],
  };
  expect((await canonical(changed)).bytes).not.toBe(left.bytes);
});
