import assert from "node:assert/strict";

// Serialized before application construction in a dedicated diagnostic browser.
// Freeze is restored as soon as the controller is found. Only the cue method
// stays wrapped; no native counter wrappers or CPU profiler run in this mode.
export function installProductionCueProbe() {
  const originalFreeze = Object.freeze;
  let wrappers = 0;
  let active = false;
  let calls = [];
  Object.freeze = function (value) {
    const descriptor =
      value && typeof value === "object"
        ? Object.getOwnPropertyDescriptor(
            value,
            "getOntologyNeighborhoodRevealPlan",
          )
        : undefined;
    if (typeof descriptor?.value === "function" && descriptor.writable) {
      const original = descriptor.value;
      Object.freeze = originalFreeze;
      value.getOntologyNeighborhoodRevealPlan = function (...args) {
        if (!active) return Reflect.apply(original, this, args);
        const start = performance.now();
        try {
          const result = Reflect.apply(original, this, args);
          const durationMs = performance.now() - start;
          calls.push({
            durationMs,
            requestedReferences: args[0]?.length,
            canReveal: result.canReveal,
            reason: result.reason ?? null,
            counts: { ...result.counts },
          });
          return result;
        } catch (error) {
          calls.push({
            durationMs: performance.now() - start,
            errorCode: error.code ?? null,
          });
          throw error;
        }
      };
      wrappers++;
    }
    return originalFreeze(value);
  };
  globalThis.__webvowlCueProbe = {
    qualification: () => ({
      wrappers,
      nativeFreezeRestored: Object.freeze === originalFreeze,
    }),
    begin() {
      calls = [];
      active = true;
    },
    end() {
      active = false;
      return {
        calls,
        totalMs: calls.reduce((sum, call) => sum + call.durationMs, 0),
      };
    },
  };
}

export async function measureProductionSearchCues({
  call,
  evaluate,
  measure,
  report,
  fixtureName,
}) {
  const qualification = await evaluate("__webvowlCueProbe.qualification()");
  assert.deepEqual(qualification, { wrappers: 1, nativeFreezeRestored: true });
  report.cueProbe = {
    ...qualification,
    scope:
      "Five load generations, each with one cold cue search and twenty repeated searches; first generation is warmup",
    limitation:
      "Diagnostic synchronous cue-method time only; not foreground search latency or an A/B comparison",
  };
  let expected;
  for (let generation = 0; generation < 5; generation++) {
    const cohort = `cue-generation-${generation}`;
    const warmup = generation === 0;
    report.activeCohort = { index: generation, label: cohort, warmup };
    await measure("B2-load", "__webvowlMeasurement.load()", cohort, warmup);
    if (fixtureName.startsWith("W4")) {
      await evaluate("__webvowlMeasurement.view({nodesShown:{mode:'auto'}})");
      report.cueProbe.view =
        "auto; hidden-result diagnostic distinct from the W4 all-node baseline";
    } else report.cueProbe.view = "workload default";
    for (let repetition = 0; repetition <= 20; repetition++) {
      await evaluate("__webvowlMeasurement.clearSearch()");
      await evaluate("__webvowlMeasurement.armSearch()");
      const row = await measure(
        repetition === 0 ? "B5-cues-cold" : "B5-cues-repeated",
        async () => {
          await evaluate("__webvowlCueProbe.begin()");
          await call("Input.insertText", {
            text: fixtureName.startsWith("W4") ? "C199" : "a",
          });
          const observation = await evaluate(
            "__webvowlMeasurement.interaction()",
          );
          observation.cuePhase = await evaluate("__webvowlCueProbe.end()");
          return observation;
        },
        cohort,
        warmup,
      );
      assert(row.results > 0, "Real UI search must render results");
      assert(
        row.cuePhase.calls.length > 0,
        "The cue probe must exercise hidden-result planning",
      );
      const answers = row.cuePhase.calls.map(({ durationMs, ...answer }) => {
        assert(Number.isFinite(durationMs) && durationMs >= 0);
        assert(
          !Object.hasOwn(answer, "errorCode"),
          "Cue planning must succeed",
        );
        return answer;
      });
      expected ??= answers;
      assert.deepEqual(
        answers,
        expected,
        "Repeated cue answers must be stable",
      );
    }
  }
  report.cueProbe.completedSearches = 105;
  report.cueProbe.completedLoadGenerations = 5;
  report.cueProbe.warmupLoadGenerations = 1;
  report.cueProbe.correctnessAssertionsCompleted = true;
  delete report.activeCohort;
  delete report.activeOperation;
}
