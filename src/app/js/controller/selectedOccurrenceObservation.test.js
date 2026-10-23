import { expect, test } from "@jest/globals";
import { createSelectedOccurrenceObservation } from "./selectedOccurrenceObservation.js";
import { createRenderedGraphEvent } from "./renderedGraphRuntimeContracts.js";

const value = () => ({
  loadGeneration: 2,
  documentRevision: 4,
  reference: { loadGeneration: 2, occurrenceId: "opaque-17" },
  coordinateSpace: "graph-viewport-css-pixels",
  xPx: 100,
  yPx: 50,
  widthPx: 40,
  heightPx: 20,
  shape: "rectangle",
  occurrenceCount: 3,
});

test("R observation retains exact occurrence, revision and coordinate units as frozen values", () => {
  const input = value();
  const result = createSelectedOccurrenceObservation(input);
  expect(result).toEqual(input);
  expect(Object.isFrozen(result)).toBe(true);
  expect(Object.isFrozen(result.reference)).toBe(true);
  input.reference.occurrenceId = "mutated";
  expect(result.reference.occurrenceId).toBe("opaque-17");
  expect(createSelectedOccurrenceObservation(null)).toBeNull();
});

test.each([
  { xPx: NaN },
  { yPx: Infinity },
  { widthPx: -1 },
  { heightPx: 0 },
  { coordinateSpace: "screen" },
  { documentRevision: -1 },
  { shape: "circle" },
  { occurrenceCount: 0 },
  { reference: { loadGeneration: 1, occurrenceId: "old" } },
  { semanticIdentity: "urn:must-not-be-an-anchor" },
])("rejects invalid or conflated observation %j", (change) => {
  expect(() =>
    createSelectedOccurrenceObservation({ ...value(), ...change }),
  ).toThrow();
});

test("event generation cannot disagree with its observation", () => {
  expect(() =>
    createRenderedGraphEvent({
      kind: "selected-occurrence-geometry-changed",
      loadGeneration: 3,
      payload: { observation: value() },
    }),
  ).toThrow(/generation/u);
});
