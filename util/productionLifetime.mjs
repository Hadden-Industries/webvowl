import assert from "node:assert/strict";

/** Observe browser target teardown separately from application completion. */
export async function observeWorkerRetirement(call) {
  const start = performance.now();
  const deadlineMs = 1000;
  const observations = [];
  let targets;
  do {
    const { targetInfos } = await call("Target.getTargets", {}, null);
    targets = targetInfos.filter((target) => target.type === "worker");
    observations.push({
      elapsedMs: performance.now() - start,
      targetIds: targets.map(({ targetId }) => targetId),
    });
    if (!targets.length || performance.now() - start >= deadlineMs) break;
    await new Promise((resolve) => setTimeout(resolve, 25));
  } while (targets.length);
  return {
    workers: targets.length,
    workerRetirement: { deadlineMs, observations },
  };
}

// Capture the real session at construction without changing its methods. Restore
// native freeze immediately; all later observations use weak references only.
export function installProductionLifetimeProbe() {
  const nativeFreeze = Object.freeze;
  let session;
  let captures = 0;
  const seen = new WeakSet();
  const tracked = [];
  let retained = [];
  Object.freeze = function (value) {
    const read =
      value && typeof value === "object"
        ? Object.getOwnPropertyDescriptor(value, "readOntologyInspection")
        : undefined;
    if (
      typeof read?.value === "function" &&
      typeof Object.getOwnPropertyDescriptor(value, "snapshot")?.value ===
        "function"
    ) {
      session = value;
      captures++;
      Object.freeze = nativeFreeze;
    }
    return nativeFreeze(value);
  };
  function observe() {
    const projection = session.readOntologyInspection();
    const readModel = session.readModel();
    if (!seen.has(readModel)) {
      // Populate every private preparation before testing its retirement. These
      // are read queries; the diagnostic visibility snapshot deliberately names
      // one admitted reference and makes no foreground/focusability claim.
      const reference = projection.classRecords[0]?.ontologyElementReference;
      if (reference) {
        const request = {
          ontologyElementReferences: [reference],
          visibleRenderedGraphSnapshot: {
            loadGeneration: projection.loadGeneration,
            visibleElementReferences: [reference],
            visibleRelationshipReferences: [],
          },
        };
        readModel.describe(request);
        readModel.resolveFocusable(request);
        readModel.find({
          ...request,
          query: reference.iri ?? reference.localId,
        });
        readModel.planNeighborhood([reference]);
        const controller =
          globalThis.__webvowlMeasuredApplication.getWebVowlController();
        controller.getOntologyElementRevealPlan([reference]);
      }
    }
    for (const [kind, value] of [
      ["projection", projection],
      ["inspection", projection.retainedFacts],
      ["read-model", readModel],
    ]) {
      if (!seen.has(value)) {
        seen.add(value);
        tracked.push({
          kind,
          identity: session.identity(),
          reference: new WeakRef(value),
        });
      }
    }
    return projection;
  }
  globalThis.__webvowlLifetimeProbe = {
    qualification: () => ({
      captures,
      nativeFreezeRestored: Object.freeze === nativeFreeze,
    }),
    observe(hold = false) {
      const projection = observe();
      // Positive control deliberately retains both borrowed and unread owned
      // results. Ordinary observations must not retain either result strongly.
      if (hold)
        retained.push(projection, session.snapshot(), session.readModel());
      return {
        ...session.identity(),
        occurrences: projection.retainedFacts.occurrences.length,
      };
    },
    releaseControls() {
      retained = [];
    },
    status(disposed = false) {
      const current = disposed
        ? new Set()
        : new Set([
            observe(),
            session.readOntologyInspection().retainedFacts,
            session.readModel(),
          ]);
      const alive = tracked.flatMap(({ kind, identity, reference }) => {
        const value = reference.deref();
        return value
          ? [{ kind, ...identity, current: current.has(value) }]
          : [];
      });
      return {
        tracked: tracked.length,
        retainedResults: retained.length,
        alive,
        retiredAlive: alive.filter((value) => !value.current).length,
      };
    },
    async capture() {
      const bytes = await session.capture();
      return { byteLength: bytes.byteLength, ...session.identity() };
    },
  };
}

/** Diagnostic lifetime qualification; heap totals never become paint timings. */
export async function measureProductionLifetime({
  call,
  evaluate,
  measure,
  report,
}) {
  const qualification = await evaluate(
    "__webvowlLifetimeProbe.qualification()",
  );
  assert.deepEqual(qualification, { captures: 1, nativeFreezeRestored: true });
  report.lifetime = {
    qualification,
    scope:
      "Two retained-result positive-control generations, then ten equal-live-size load/edit/capture/retirement cycles and final controller disposal",
    limitation:
      "Forced-GC heap and weak-owner diagnostics; replacement retires each previous document within one live application; not foreground latency",
    cycles: [],
  };
  async function collect(disposed = false) {
    // End the dereference job before collecting; otherwise WeakRef keeps that
    // job's observed targets alive by design.
    await evaluate("new Promise(resolve => setTimeout(resolve, 0))");
    await call("HeapProfiler.collectGarbage");
    await call("HeapProfiler.collectGarbage");
    const heap = await call("Runtime.getHeapUsage");
    const dom = await call("Memory.getDOMCounters");
    // terminate() precedes the result promise in the worker client; Chrome's
    // target inventory is a separate asynchronous teardown observation. Retain
    // its first state and bounded convergence rather than hiding a retry.
    const retirement = await observeWorkerRetirement(call);
    const ownership = await evaluate(
      `__webvowlLifetimeProbe.status(${disposed})`,
    );
    return { heap, dom, ...retirement, ownership };
  }
  for (let index = 0; index < 2; index++) {
    report.activeCohort = {
      index,
      label: `retained-control-${index}`,
      warmup: true,
    };
    await measure(
      "B2-load",
      "__webvowlMeasurement.load()",
      `retained-control-${index}`,
      true,
    );
    await evaluate("__webvowlMeasurement.waitForNodeOrdering()");
    await evaluate("__webvowlLifetimeProbe.observe(true)");
  }
  report.lifetime.positiveControl = await collect();
  assert(
    report.lifetime.positiveControl.ownership.retiredAlive >= 3 &&
      report.lifetime.positiveControl.ownership.alive.some(
        (row) => row.kind === "read-model" && !row.current,
      ),
    "Retained-result positive control must detect old projection, inspection and read model",
  );
  await evaluate("__webvowlLifetimeProbe.releaseControls()");
  report.lifetime.releasedControl = await collect();
  assert.equal(
    report.lifetime.releasedControl.ownership.retiredAlive,
    0,
    "Released positive controls must be collectible",
  );
  let expectedOccurrences;
  for (let cycle = 1; cycle <= 10; cycle++) {
    const cohort = `lifetime-${cycle}`;
    report.activeCohort = { index: cycle, label: cohort, warmup: false };
    await measure("B2-load", "__webvowlMeasurement.load()", cohort);
    await evaluate("__webvowlMeasurement.waitForNodeOrdering()");
    await evaluate("__webvowlLifetimeProbe.observe()");
    await evaluate("__webvowlMeasurement.prepareEdits()");
    await measure("B6-edit", "__webvowlMeasurement.edit(0)", cohort);
    const identity = await evaluate("__webvowlLifetimeProbe.observe()");
    assert.equal(identity.documentRevision, 1);
    expectedOccurrences ??= identity.occurrences;
    assert.equal(
      identity.occurrences,
      expectedOccurrences,
      "Equal live document size is required",
    );
    report.activeOperation = { name: "B7-capture", cohort, warmup: false };
    const capture = await evaluate("__webvowlLifetimeProbe.capture()");
    assert.equal(capture.documentRevision, 1);
    assert(capture.byteLength > 0, "Capture must produce a complete artifact");
    const observation = { cycle, identity, capture, ...(await collect()) };
    report.lifetime.cycles.push(observation);
    console.log(
      JSON.stringify({
        lifetimeCycle: cycle,
        usedSize: observation.heap.usedSize,
        retiredAlive: observation.ownership.retiredAlive,
        workers: observation.workers,
      }),
    );
    assert.equal(
      observation.ownership.retiredAlive,
      0,
      "A retired inspection/projection/read model still has an owner",
    );
    assert.equal(
      observation.workers,
      0,
      "Single-use workers must retire after capture",
    );
  }
  await evaluate(
    "__webvowlMeasuredApplication.getWebVowlController().dispose()",
  );
  report.lifetime.disposed = await collect(true);
  assert.equal(
    report.lifetime.disposed.ownership.alive.length,
    0,
    "Disposed session must release every tracked inspection/projection/read model",
  );
  assert.equal(report.lifetime.disposed.workers, 0);
  delete report.activeCohort;
  delete report.activeOperation;
}
