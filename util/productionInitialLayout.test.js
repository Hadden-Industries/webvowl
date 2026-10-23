import { initialLayoutOutcome } from "./productionInitialLayout.mjs";

const row = () => ({
  seedMs: 10,
  usableFrameMs: 100,
  nodeCount: 953,
  layoutBefore: { status: "relaxing", isPaused: false },
  layoutAfter: { status: "settled", isPaused: false },
  intervals: [16, 17, 16],
  elapsedMs: 3000,
  settlementMs: 3100,
  changedFrames: 3,
});

test("natural early settlement is an observed success rather than a five-second failure", () => {
  expect(initialLayoutOutcome(row())).toMatchObject({
    settled: true,
    naturalEarlyCompletion: true,
    observedMovement: true,
    withinSettlementTarget: true,
  });
});

test("timer frames alone do not establish moving geometry or settlement", () => {
  expect(
    initialLayoutOutcome({ ...row(), intervals: Array(40).fill(16) })
      .frameIntervals,
  ).not.toHaveProperty("acceptanceSampleCount");
  expect(
    initialLayoutOutcome({
      ...row(),
      changedFrames: 0,
      elapsedMs: 12000,
      settlementMs: 12100,
      layoutAfter: { status: "relaxing", isPaused: false },
    }),
  ).toMatchObject({
    observedMovement: false,
    settled: false,
    withinSettlementTarget: false,
  });
});

test("already settled small graphs do not fabricate frame percentiles", () => {
  expect(
    initialLayoutOutcome({
      ...row(),
      intervals: [],
      changedFrames: 0,
      layoutBefore: { status: "settled", isPaused: false },
    }),
  ).toMatchObject({
    alreadySettledAtFirstFrame: true,
    frameIntervals: null,
  });
});

test("paused or inconsistent boundaries cannot masquerade as automatic running load", () => {
  expect(() =>
    initialLayoutOutcome({
      ...row(),
      layoutBefore: { status: "paused", isPaused: true },
    }),
  ).toThrow();
  expect(() => initialLayoutOutcome({ ...row(), seedMs: 200 })).toThrow();
});
