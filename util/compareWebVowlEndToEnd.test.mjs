import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import {
  installPaintProbe,
  observeLegacyConversion,
  finishConversionObservation,
  assertOriginalParity,
  originalBrowserMilliseconds,
} from "./compareWebVowlEndToEnd.mjs";

test("parity requires every measured loading boundary, including fresh browser warmth", () => {
  const samples = Object.entries(originalBrowserMilliseconds).map(
    ([temperature, milliseconds]) => ({
      path: "current",
      temperature,
      milliseconds,
    }),
  );
  assert.doesNotThrow(() => assertOriginalParity(samples));
  for (const sample of samples) {
    assert.throws(
      () =>
        assertOriginalParity(
          samples.map((entry) =>
            entry === sample
              ? { ...entry, milliseconds: entry.milliseconds + 1 }
              : entry,
          ),
        ),
      /Original WebVOWL end-to-end parity failed/,
    );
  }
  assert.throws(() => assertOriginalParity([]), /Missing candidate cold/);
});

test("a faster matched original run tightens the gate and a slower one cannot relax the historical target", () => {
  const warm = {
    path: "current",
    temperature: "same-session-warm",
    milliseconds: 1000,
  };
  assert.throws(
    () =>
      assertOriginalParity([
        warm,
        { path: "legacy", temperature: "cold", milliseconds: 2000 },
        { path: "current", temperature: "cold", milliseconds: 2100 },
      ]),
    /cold: 2100ms > original 2000ms/,
  );
  assert.throws(
    () =>
      assertOriginalParity([
        warm,
        { path: "legacy", temperature: "cold", milliseconds: 5000 },
        { path: "current", temperature: "cold", milliseconds: 3400 },
      ]),
    /cold: 3400ms > original 3340ms/,
  );
});

function fixture({ current = false } = {}) {
  let time = 0,
    opacity = "0";
  const rootIri = "https://example.test/root";
  const frames = [],
    requests = [];
  let nodes = [node()];
  let state = { status: "ready", loadGeneration: 1 };
  function node() {
    return {
      parentElement: null,
      getBoundingClientRect: () => ({
        left: 10,
        top: 10,
        right: 20,
        bottom: 20,
        width: 10,
        height: 10,
      }),
      getCTM: () => ({ e: 10, f: 20 }),
    };
  }
  const sandbox = vm.createContext({
    URL,
    Set,
    performance: { now: () => time },
    innerWidth: 100,
    innerHeight: 100,
    fetch: async (input) => {
      requests.push(input);
    },
    requestAnimationFrame: (callback) => frames.push(callback),
    document: { querySelectorAll: () => nodes, querySelector: () => nodes[0] },
    getComputedStyle: () => ({
      display: "block",
      visibility: "visible",
      opacity,
    }),
    webvowl: {
      gr: {
        options: () => ({
          loadingModule: () => ({ successfullyLoadedOntology: () => true }),
        }),
      },
    },
    ...(current
      ? {
          comparisonApp: {
            getWebVowlController: () => ({
              getState: () => state,
              getOriginalSources: () => [{ documentIri: rootIri }],
            }),
          },
        }
      : {}),
  });
  vm.runInContext(
    "(" +
      installPaintProbe.toString() +
      ")(" +
      JSON.stringify({
        originalIris: [rootIri],
        fixtureOrigin: "https://localhost:1234",
        rootIri,
      }) +
      ")",
    sandbox,
  );
  return {
    sandbox,
    requests,
    visible() {
      opacity = "1";
    },
    replace() {
      nodes = [node()];
    },
    generation(value) {
      state = { ...state, loadGeneration: value };
    },
    tick(count = 1) {
      for (let i = 0; i < count; i++) {
        time += 16;
        const pending = frames.splice(0);
        pending.forEach((callback) => callback(time));
      }
    },
  };
}

test("a response failure is handled immediately and retained while the paint sink waits", async () => {
  const error = new Error("Original response stream failed");
  const conversions = [];
  const job = observeLegacyConversion(
    {
      text: async () => {
        throw error;
      },
    },
    conversions,
  );
  await new Promise(setImmediate);
  const [outcome] = await job;
  assert.equal(outcome.status, "rejected");
  assert.equal(outcome.reason, error);
  assert.deepEqual(conversions, []);
});

test("a converted entity-count failure remains a rejecting result", async () => {
  const conversions = [];
  const job = observeLegacyConversion(
    {
      text: async () =>
        JSON.stringify({ classAttribute: [], propertyAttribute: [] }),
    },
    conversions,
  );
  await new Promise(setImmediate);
  const [outcome] = await job;
  assert.equal(outcome.status, "rejected");
  assert.equal(outcome.reason.code, "ERR_ASSERTION");
  assert.deepEqual(conversions, []);
});

test("a never-ending response body cannot prevent cleanup after the paint deadline", async () => {
  const paintFailure = new Error("Paint deadline exceeded");
  await assert.rejects(
    finishConversionObservation([new Promise(() => {})], paintFailure, 1),
    (error) => {
      assert(error instanceof AggregateError);
      assert.equal(error.errors[0], paintFailure);
      assert.equal(
        error.errors[1].message,
        "CONVERSION_RESPONSE_DRAIN_TIMEOUT",
      );
      return true;
    },
  );
});
test("SVG DOM presence while the original scene is transparent cannot qualify first paint", () => {
  const h = fixture();
  h.tick(20);
  assert.equal(h.sandbox.comparisonPaint.paintedAt, null);
  h.visible();
  h.tick(2);
  assert.equal(
    h.sandbox.comparisonPaint.paintedAt,
    null,
    "A visible mutation still needs the paint boundary",
  );
  h.tick();
  assert.equal(h.sandbox.comparisonPaint.paintedAt, 368);
  h.tick(9);
  assert.equal(h.sandbox.comparisonPaint.settlementStatus, "stable");
});
test("a warm replacement cannot qualify using the previous accepted drawing or generation", () => {
  const h = fixture({ current: true });
  h.visible();
  h.tick(3);
  h.sandbox.armComparisonPaint();
  h.tick(5);
  assert.equal(h.sandbox.comparisonPaint.paintedAt, null);
  h.replace();
  h.tick(5);
  assert.equal(
    h.sandbox.comparisonPaint.paintedAt,
    null,
    "A new DOM node alone does not prove a new accepted model",
  );
  h.generation(2);
  h.tick(3);
  assert.notEqual(h.sandbox.comparisonPaint.paintedAt, null);
});
test("only the frozen source requests are routed to the real CORS-denying origin", async () => {
  const h = fixture();
  await h.sandbox.fetch("https://example.test/root");
  await h.sandbox.fetch("https://provider.test/ontology/materializations");
  assert.deepEqual(h.requests, [
    "https://localhost:1234/source?iri=https%3A%2F%2Fexample.test%2Froot",
    "https://provider.test/ontology/materializations",
  ]);
});
