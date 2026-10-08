import { jest } from "@jest/globals";
import {
  canonicalFailureDetails,
  canonicalLoadingMessage,
} from "./canonicalVowlFailure.js";

test("producer budget facts survive as safe application diagnostics", () => {
  expect(
    canonicalFailureDetails({
      details: {
        stage: "node-ranking",
        limit: "totalStringBytes",
        maximum: 16777216,
        actual: 21310464,
        source: "private source",
      },
    }),
  ).toEqual({
    stage: "node-ranking",
    resource: "totalStringBytes",
    maximum: 16777216,
    actual: 21310464,
  });
});

test("budget facts never invoke accessors or admit unknown counters and unsafe numbers", () => {
  const getter = jest.fn(() => "totalStringBytes");
  const details = { stage: "node-ranking", maximum: 32, actual: 64 };
  Object.defineProperty(details, "limit", { get: getter });
  expect(canonicalFailureDetails({ details })).toEqual({
    stage: "node-ranking",
  });
  expect(getter).not.toHaveBeenCalled();
  for (const value of [-1, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, "32"]) {
    expect(
      canonicalFailureDetails({
        details: { limit: "totalStringBytes", maximum: value, actual: value },
      }),
    ).toEqual({ resource: "totalStringBytes" });
  }
  expect(
    canonicalFailureDetails({
      details: { limit: "private text", maximum: 32, actual: 64 },
    }),
  ).toEqual({});
});

test("ranking memory failure explains the operation and measured allowance", () => {
  expect(
    canonicalLoadingMessage({
      code: "RDF_RESOURCE_LIMIT",
      details: {
        stage: "node-ranking",
        limit: "totalStringBytes",
        maximum: 16777216,
        actual: 21310464,
      },
    }),
  ).toBe(
    "Node selection exceeded its temporary string-space budget (at least 20.3 MiB requested; 16 MiB allowed). Try a smaller ontology, import closure or edit.",
  );
});

test("near-limit quantities remain distinct and do not claim a complete required budget", () => {
  expect(
    canonicalLoadingMessage({
      code: "RDF_RESOURCE_LIMIT",
      details: {
        limit: "totalStringBytes",
        maximum: 67108864,
        actual: 67108866,
      },
    }),
  ).toBe(
    "Processing the ontology exceeded its temporary string-space budget (at least 67108866 bytes requested; 67108864 bytes allowed). Try a smaller ontology, import closure or edit.",
  );
  expect(
    canonicalLoadingMessage({
      code: "MODEL_RESOURCE_LIMIT",
      details: { limit: "embeddedValues", maximum: 1500000, actual: 1500001 },
    }),
  ).toBe(
    "Processing the ontology exceeded its processing-work budget (at least 1500001 requested; 1500000 allowed). Try a smaller ontology, import closure or edit.",
  );
});

test("ranking work and model complexity failures explain distinct causes", () => {
  expect(
    canonicalLoadingMessage({
      code: "RDF_RESOURCE_LIMIT",
      details: {
        stage: "node-ranking",
        limit: "embeddedValues",
        maximum: 1500000,
        actual: 1500001,
      },
    }),
  ).toContain("processing-work budget");
  expect(
    canonicalLoadingMessage({
      code: "MODEL_RESOURCE_LIMIT",
      details: { limit: "primaryRecords", maximum: 100000, actual: 100001 },
    }),
  ).toContain("model-record budget");
  expect(
    canonicalLoadingMessage({
      code: "RDFC_RESOURCE_LIMIT",
      details: { limit: "rdfDeepIterations", maximum: 0 },
    }),
  ).toContain("canonicalization-work budget");
});

test("RDF limits without safe facts still receive an owned explanation", () => {
  expect(
    canonicalLoadingMessage({
      code: "RDF_RESOURCE_LIMIT",
      message: "rdf resource limit",
    }),
  ).toBe(
    "The ontology and its imports exceed a node-selection or RDF processing resource limit. Try a smaller ontology or import closure.",
  );
});
