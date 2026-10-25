import { expect, test } from "@jest/globals";
import {
  countAdjustmentTimings,
  activeLayoutSummary,
} from "./productionCountAdjustment.mjs";

test("separates deliberate quiet time from apply and paint work", () => {
  const row = {
    start: 10,
    inputs: [{ at: 10 }, { at: 30 }, { at: 50 }],
    applicationStartedAt: 1050,
    applicationDurationMs: 80,
    completed: 1130,
    frame2: 1160,
  };
  expect(countAdjustmentTimings(row)).toEqual({
    inputToPaintMs: 1150,
    lastInputToApplicationMs: 1000,
    applicationMs: 80,
    applicationToPaintMs: 110,
  });
  expect(() => countAdjustmentTimings({ ...row, inputs: [] })).toThrow(
    /boundaries/u,
  );
  expect(() =>
    countAdjustmentTimings({ ...row, applicationStartedAt: 20 }),
  ).toThrow(/boundaries/u);
  expect(() => countAdjustmentTimings({ ...row, frame2: 1120 })).toThrow(
    /boundaries/u,
  );
});

test("a resumed but settled graph cannot qualify active-layout frames", () => {
  const row = {
    foregroundLost: false,
    elapsedMs: 5001,
    changedFrames: 9,
    nodeCount: 8,
    layoutBefore: { status: "relaxing" },
    layoutAfter: { status: "relaxing" },
    intervals: [16, 18, 50],
  };
  expect(activeLayoutSummary(row).p95Ms).toBe(50);
  for (const override of [
    { changedFrames: 0 },
    { foregroundLost: true },
    { elapsedMs: 4999 },
    { layoutAfter: { status: "paused" } },
  ]) {
    expect(() => activeLayoutSummary({ ...row, ...override })).toThrow(
      /movement/u,
    );
  }
});
