import { jest } from "@jest/globals";
import { createNodeCountAdjustment } from "./nodeCountAdjustment.js";

function setup() {
  let now = 0;
  const timers = new Map();
  let nextTimer = 0;
  let accepted = {
    loadGeneration: 1,
    documentRevision: 0,
    nodesShown: { mode: "exact", requestedCount: 50 },
  };
  const release = jest.fn();
  const prepareInstallation = jest.fn();
  const holdLayout = jest.fn(() => ({ release, prepareInstallation }));
  const publish = jest.fn();
  const reportError = jest.fn();
  const apply = jest.fn(async (nodesShown) => {
    accepted = { ...accepted, nodesShown };
  });
  const adjustment = createNodeCountAdjustment({
    readAccepted: () => accepted,
    apply,
    holdLayout,
    publish,
    reportError,
    clock: {
      now: () => now,
      setTimeout: (callback, delay) => {
        const id = ++nextTimer;
        timers.set(id, { callback, due: now + delay });
        return id;
      },
      clearTimeout: (id) => timers.delete(id),
    },
  });
  return {
    adjustment,
    apply,
    release,
    prepareInstallation,
    holdLayout,
    publish,
    reportError,
    timers,
    replaceDocument: () => {
      accepted = { ...accepted, loadGeneration: 2 };
    },
    async advance(ms) {
      now += ms;
      for (const [id, entry] of [...timers]) {
        if (entry.due <= now) {
          timers.delete(id);
          entry.callback();
        }
      }
      for (let index = 0; index < 12; index++) {
        await Promise.resolve();
      }
    },
  };
}
const exact = (requestedCount) => ({ mode: "exact", requestedCount });

test("a multi-frame burst holds once and applies only the final count after its quiet period", async () => {
  const h = setup();
  h.adjustment.stage(exact(61));
  await h.advance(400);
  h.adjustment.stage(exact(73));
  await h.advance(999);
  expect(h.apply).not.toHaveBeenCalled();
  expect(h.holdLayout).toHaveBeenCalledTimes(1);
  expect(h.publish).toHaveBeenLastCalledWith({
    requestedNodesShown: exact(73),
    status: "pending",
  });
  await h.advance(1);
  expect(h.apply).toHaveBeenCalledTimes(1);
  expect(h.apply.mock.calls[0][0]).toEqual(exact(73));
  expect(h.release).toHaveBeenCalledTimes(1);
  expect(h.publish).toHaveBeenLastCalledWith(null);
  expect(h.timers.size).toBe(0);
});

test("duplicate input/change and concurrent close flushes do not duplicate installation", async () => {
  const h = setup();
  h.adjustment.stage(exact(73));
  await h.advance(600);
  h.adjustment.stage(exact(73));
  await Promise.all([h.adjustment.flush(), h.adjustment.flush()]);
  await h.advance(5000);
  expect(h.apply).toHaveBeenCalledTimes(1);
  expect(h.release).toHaveBeenCalledTimes(1);
});

test("returning to the accepted intent avoids a revision and releases the hold", async () => {
  const h = setup();
  h.adjustment.stage(exact(73));
  h.adjustment.stage(exact(50));
  await h.advance(2000);
  expect(h.apply).not.toHaveBeenCalled();
  expect(h.release).toHaveBeenCalledTimes(1);
});

test("an in-flight application retains only the latest newer count", async () => {
  const h = setup();
  let complete;
  h.apply.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        complete = resolve;
      }),
  );
  h.adjustment.stage(exact(61));
  const flush = h.adjustment.flush();
  await h.advance(0);
  h.adjustment.stage(exact(73));
  h.adjustment.stage(exact(90));
  expect(h.apply).toHaveBeenCalledTimes(1);
  complete();
  await flush;
  expect(h.apply.mock.calls.map(([intent]) => intent)).toEqual([
    exact(61),
    exact(90),
  ]);
  expect(h.release).toHaveBeenCalledTimes(1);
});

test("retirement cancels callbacks and never installs a draft into a replacement document", async () => {
  const h = setup();
  h.adjustment.stage(exact(73));
  const callback = [...h.timers.values()][0].callback;
  h.adjustment.cancel();
  h.replaceDocument();
  callback();
  await h.advance(2000);
  expect(h.apply).not.toHaveBeenCalled();
  expect(h.release).toHaveBeenCalledTimes(1);
  h.adjustment.dispose();
  expect(h.timers.size).toBe(0);
});

test("hidden-page time retains one draft without a hold or timer and rechecks on return", async () => {
  const h = setup();
  h.adjustment.stage(exact(73));
  h.adjustment.setVisible(false);
  expect(h.release).toHaveBeenCalledTimes(1);
  expect(h.timers.size).toBe(0);
  await h.advance(2000);
  expect(h.apply).not.toHaveBeenCalled();
  h.adjustment.setVisible(true);
  await h.advance(0);
  expect(h.apply).toHaveBeenCalledTimes(1);
  expect(h.holdLayout).toHaveBeenCalledTimes(2);
  expect(h.release).toHaveBeenCalledTimes(2);
});

test("a failed final application releases its hold, clears pending state and reports once", async () => {
  const h = setup();
  const failure = new Error("Installation failed");
  h.apply.mockRejectedValueOnce(failure);
  h.adjustment.stage(exact(73));
  await h.advance(1000);
  expect(h.reportError).toHaveBeenCalledWith(failure);
  expect(h.release).toHaveBeenCalledTimes(1);
  expect(h.publish).toHaveBeenLastCalledWith(null);
  expect(h.timers.size).toBe(0);
});
