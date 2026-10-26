import { expect, test } from "@jest/globals";
import { createLocalInteractionTiming } from "./productionInteractionTiming.mjs";

function observerFixture(types = ["event", "long-animation-frame"]) {
  const observers = [];
  class Observer {
    static supportedEntryTypes = types;
    constructor(callback) {
      this.callback = callback;
      this.pending = [];
      observers.push(this);
    }
    observe(options) {
      this.options = options;
    }
    disconnect() {
      this.disconnected = true;
    }
    takeRecords() {
      return this.pending.splice(0);
    }
    deliver(entries) {
      this.callback({ getEntries: () => entries });
    }
  }
  return { Observer, observers };
}

test("optional timing APIs can be absent without changing browser behavior", () => {
  const timing = createLocalInteractionTiming({
    PerformanceObserverClass: undefined,
  });
  timing.reset();
  expect(timing.snapshot()).toMatchObject({
    supported: { event: false, loaf: false },
    events: [],
    loaf: [],
  });
  timing.dispose();
});

test("local event timing is bounded, split into delay phases and stripped of ontology content", () => {
  const { Observer, observers } = observerFixture();
  const timing = createLocalInteractionTiming({
    PerformanceObserverClass: Observer,
    maxEntries: 2,
    now: () => 100,
  });
  timing.reset();
  const event = {
    name: "click",
    startTime: 110,
    duration: 40,
    processingStart: 115,
    processingEnd: 125,
    interactionId: 7,
    target: "urn:private-ontology",
  };
  observers[0].deliver([
    event,
    { ...event, startTime: 111 },
    { ...event, startTime: 112 },
  ]);
  const snapshot = timing.snapshot();
  expect(snapshot.events).toHaveLength(2);
  expect(snapshot.events[0]).toMatchObject({
    inputDelay: 5,
    processingDuration: 10,
    presentationDelayEstimate: 25,
  });
  expect(snapshot.dropped.events).toBe(1);
  expect(JSON.stringify(snapshot)).not.toContain("urn:private-ontology");
  timing.reset();
  observers[0].pending.push({ ...event, startTime: 90 });
  expect(timing.snapshot().events).toHaveLength(0);
  timing.dispose();
  expect(observers.every((observer) => observer.disconnected)).toBe(true);
});

test("LoAF attribution retains only bounded numeric facts and no source URLs", () => {
  const { Observer, observers } = observerFixture();
  const timing = createLocalInteractionTiming({
    PerformanceObserverClass: Observer,
    maxEntries: 1,
    now: () => 0,
  });
  timing.reset();
  observers[1].deliver([
    {
      startTime: 5,
      duration: 80,
      blockingDuration: 30,
      scripts: Array.from({ length: 20 }, () => ({
        duration: 9,
        forcedStyleAndLayoutDuration: 2,
        sourceURL: "urn:private-source",
        invoker: "private label",
      })),
    },
  ]);
  const snapshot = timing.snapshot();
  expect(snapshot.loaf[0].scripts).toHaveLength(16);
  expect(snapshot.loaf[0].droppedScripts).toBe(4);
  expect(JSON.stringify(snapshot)).not.toMatch(/private/u);
  timing.dispose();
  observers[1].deliver([{ startTime: 20, duration: 100, scripts: [] }]);
  expect(timing.snapshot().loaf).toHaveLength(0);
});

test("a long frame overlapping reset is retained while completed earlier frames are excluded", () => {
  const { Observer, observers } = observerFixture();
  const timing = createLocalInteractionTiming({
    PerformanceObserverClass: Observer,
    now: () => 100,
  });
  timing.reset();
  observers[1].deliver([
    { startTime: 80, duration: 20, scripts: [] },
    { startTime: 90, duration: 40, scripts: [] },
  ]);
  expect(timing.snapshot().loaf).toEqual([
    expect.objectContaining({
      startTime: 90,
      duration: 40,
      overlapsObservationStart: true,
    }),
  ]);
  timing.dispose();
});
