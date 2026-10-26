import { expect, test } from "@jest/globals";
import {
  assessProductionBudgets,
  assessProductionLatencyComparison,
} from "./check-production-budgets.mjs";

function manifest() {
  return {
    entry: "js/index.js",
    workers: ["assets/worker.js"],
    workerClosures: {
      "assets/worker.js": ["assets/worker.js", "assets/parser.js"],
    },
    files: [
      { path: "js/index.js", byteLength: 680000 },
      { path: "js/vendor-application.js", byteLength: 300000 },
      { path: "assets/worker.js", byteLength: 1250000 },
      { path: "assets/parser.js", byteLength: 200000 },
    ],
  };
}

test("decimal entry gates report the entire worker closure separately", () => {
  expect(assessProductionBudgets(manifest())).toEqual({
    entry: 680000,
    vendor: 300000,
    workerEntry: 1250000,
    workerClosure: 1450000,
    workerModules: 2,
  });
});

test.each([0, 1, 2])("one byte above budget fails asset %i", (index) => {
  const input = manifest();
  input.files[index].byteLength++;
  expect(() => assessProductionBudgets(input)).toThrow(/exceeds/u);
});

test("a missing dynamically imported parser cannot produce a passing budget", () => {
  const input = manifest();
  input.files.pop();
  expect(() => assessProductionBudgets(input)).toThrow(
    /Missing production asset/u,
  );
});

function report(durationMs = 100) {
  const row = (cohort, index, warmup = false) => ({
    name: "edit",
    cohort,
    cohortIndex: index,
    warmup,
    start: 0,
    completed: durationMs - 2,
    frame1: durationMs - 1,
    frame2: durationMs,
    durationMs,
  });
  return {
    manifest: { sha256: "a".repeat(64) },
    status: "completed",
    mode: "latency",
    acceptanceEligible: true,
    headed: true,
    quiescentProtocolSatisfied: true,
    diagnostic: false,
    instrumentation: false,
    cpuAdmissionPolicy: "quiescent-10-percent-over-500-ms",
    cohortRange: { start: 1, end: 40 },
    exceptions: [],
    workload: { name: "W1", byteLength: 130997, sha256: "b".repeat(64) },
    page: { viewport: { width: 1440, height: 900, dpr: 1 } },
    environment: {
      chromeSha256: "c".repeat(64),
      node: "v24.22.1",
      platform: "win32",
      architecture: "x64",
      release: "10.0.26300",
    },
    httpCachePolicy: "cold",
    samples: [
      row("warmup", 0, true),
      ...Array.from({ length: 40 }, (_, i) =>
        row(["A", "B", "B", "A"][i % 4], i + 1),
      ),
    ],
    completedCohorts: Array.from({ length: 40 }, (_, i) => ({
      index: i + 1,
      label: ["A", "B", "B", "A"][i % 4],
      warmup: false,
      correctnessAssertionsCompleted: true,
    })),
  };
}

const compare = (candidate, baseline = report()) =>
  assessProductionLatencyComparison({
    baseline,
    candidate,
    baselineManifestSha256: "a".repeat(64),
    candidateManifestSha256: "a".repeat(64),
    operation: "edit",
  });

test("a corroboration-required regression is reported above the accepted ten percent gate", () => {
  expect(compare(report(109)).pass).toBe(true);
  expect(compare(report(110)).pass).toBe(true);
  expect(compare(report(111))).toMatchObject({
    pass: false,
    needsCorroboration: true,
  });
});

test.each(["busy", "stale", "instrumented", "partial", "wrong fixture"])(
  "%s evidence cannot pass a latency comparison",
  (failure) => {
    const candidate = report();
    if (failure === "busy") {
      candidate.quiescentProtocolSatisfied = false;
    }
    if (failure === "stale") {
      candidate.manifest.sha256 = "d".repeat(64);
    }
    if (failure === "instrumented") {
      candidate.instrumentation = true;
    }
    if (failure === "partial") {
      candidate.samples.pop();
    }
    if (failure === "wrong fixture") {
      candidate.workload.sha256 = "d".repeat(64);
    }
    expect(() => compare(candidate)).toThrow();
  },
);

test.each(["workload", "viewport", "browser", "cache"])(
  "two missing %s identities cannot compare equal and pass",
  (field) => {
    const baseline = report();
    const candidate = report();
    for (const input of [baseline, candidate]) {
      if (field === "workload") {
        delete input.workload;
      }
      if (field === "viewport") {
        delete input.page.viewport.width;
      }
      if (field === "browser") {
        delete input.environment.chromeSha256;
      }
      if (field === "cache") {
        delete input.httpCachePolicy;
      }
    }
    expect(() => compare(candidate, baseline)).toThrow(/Missing/u);
  },
);

test("cohort identities must be globally unique and obey the existing ABBA schedule", () => {
  const candidate = report();
  const counts = { A: 0, B: 0 };
  for (const row of candidate.samples.filter((row) => !row.warmup)) {
    row.cohortIndex = ++counts[row.cohort];
  }
  expect(() => compare(candidate)).toThrow(/distinct/u);
  const wrongOrder = report();
  [wrongOrder.samples[1].cohort, wrongOrder.samples[2].cohort] = [
    wrongOrder.samples[2].cohort,
    wrongOrder.samples[1].cohort,
  ];
  expect(() => compare(wrongOrder)).toThrow(/ABBA/u);
  const incomplete = report();
  incomplete.completedCohorts.pop();
  expect(() => compare(incomplete)).toThrow(/completion/u);
});
