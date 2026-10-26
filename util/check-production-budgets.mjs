import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  productionManifest,
  productionCohortSchedule,
  summarizeSamples,
  validateBoundary,
} from "./productionPerformance.mjs";

/** Decimal uncompressed byte gates; timing needs separate quiet-host evidence. */
export function assessProductionBudgets(manifest) {
  const files = new Map(manifest.files.map((file) => [file.path, file]));
  function bytes(path) {
    const file = files.get(path);
    assert(
      file && Number.isSafeInteger(file.byteLength) && file.byteLength >= 0,
      `Missing production asset: ${path}`,
    );
    return file.byteLength;
  }
  const entry = bytes(manifest.entry);
  const vendor = bytes("js/vendor-application.js");
  assert(entry <= 680000, `Production entry exceeds 680000 bytes: ${entry}`);
  assert(
    vendor <= 300000,
    `Application vendor exceeds 300000 bytes: ${vendor}`,
  );
  assert(manifest.workers.length === 1, "Expected one current worker entry");
  const worker = manifest.workers[0];
  const workerEntry = bytes(worker);
  assert(
    workerEntry <= 1250000,
    `Worker entry exceeds 1250000 bytes: ${workerEntry}`,
  );
  const closure = manifest.workerClosures?.[worker];
  assert(
    Array.isArray(closure) && closure.includes(worker),
    "Worker closure is missing",
  );
  const workerClosure = [...new Set(closure)].reduce(
    (sum, path) => sum + bytes(path),
    0,
  );
  return {
    entry,
    vendor,
    workerEntry,
    workerClosure,
    workerModules: closure.length,
  };
}

/** Compare complete, frozen quiet-host reports; a miss still needs corroboration. */
export function assessProductionLatencyComparison({
  baseline,
  candidate,
  baselineManifestSha256,
  candidateManifestSha256,
  operation,
}) {
  function samples(report, expected) {
    assert(
      /^[a-f0-9]{64}$/u.test(report.workload?.sha256) &&
        Number.isSafeInteger(report.workload?.byteLength) &&
        report.workload.byteLength > 0 &&
        typeof report.workload.name === "string" &&
        report.workload.name.length > 0,
      "Missing workload identity",
    );
    assert(
      /^[a-f0-9]{64}$/u.test(report.environment?.chromeSha256) &&
        ["node", "platform", "architecture", "release"].every(
          (key) =>
            typeof report.environment[key] === "string" &&
            report.environment[key].length > 0,
        ),
      "Missing environment identity",
    );
    assert(
      ["width", "height", "dpr"].every(
        (key) =>
          Number.isFinite(report.page?.viewport?.[key]) &&
          report.page.viewport[key] > 0,
      ) &&
        typeof report.httpCachePolicy === "string" &&
        report.httpCachePolicy.length > 0,
      "Missing viewport or cache identity",
    );
    assert(
      /^[a-f0-9]{64}$/u.test(expected) && report.manifest?.sha256 === expected,
      "Stale or mismatched production manifest",
    );
    assert(
      report.status === "completed" &&
        report.mode === "latency" &&
        report.acceptanceEligible === true &&
        report.headed === true &&
        report.quiescentProtocolSatisfied === true &&
        !report.diagnostic &&
        !report.instrumentation &&
        report.cpuAdmissionPolicy === "quiescent-10-percent-over-500-ms",
      "Report is not admitted quiet-host latency evidence",
    );
    assert(
      report.cohortRange?.start === 1 &&
        report.cohortRange?.end === 40 &&
        report.exceptions?.length === 0,
      "Incomplete or failed production cohort",
    );
    const rows = report.samples.filter((row) => row.name === operation);
    assert(
      rows.some((row) => row.warmup === true),
      "Missing discarded warmup",
    );
    const measured = rows.filter((row) => row.warmup === false);
    const schedule = productionCohortSchedule();
    assert(
      measured.length === schedule.length &&
        new Set(measured.map((row) => row.cohortIndex)).size ===
          schedule.length,
      "Need forty distinct scheduled cohort identities",
    );
    assert(
      Array.isArray(report.completedCohorts),
      "Missing cohort completion checkpoints",
    );
    for (const { label, index } of schedule) {
      const row = measured.find((item) => item.cohortIndex === index);
      const checkpoints = report.completedCohorts.filter(
        (item) => item.index === index,
      );
      assert(
        row?.cohort === label &&
          checkpoints.length === 1 &&
          checkpoints[0].label === label &&
          checkpoints[0].warmup === false &&
          checkpoints[0].correctnessAssertionsCompleted === true,
        "Cohort order or completion differs from the ABBA schedule",
      );
    }
    return measured.map((row) => {
      const duration = validateBoundary({
        ...row,
        mode: "latency",
        instrumentation: false,
      });
      assert(
        !row.foregroundLost && Math.abs(row.durationMs - duration) < 0.000001,
        "Invalid foreground or duration evidence",
      );
      return duration;
    });
  }
  const before = summarizeSamples(samples(baseline, baselineManifestSha256));
  const after = summarizeSamples(samples(candidate, candidateManifestSha256));
  assert.deepEqual(
    candidate.workload,
    baseline.workload,
    "Workload identity changed",
  );
  assert.deepEqual(
    candidate.page.viewport,
    baseline.page.viewport,
    "Viewport changed",
  );
  assert.equal(
    candidate.environment.chromeSha256,
    baseline.environment.chromeSha256,
    "Browser changed",
  );
  for (const key of ["node", "platform", "architecture", "release"]) {
    assert.equal(
      candidate.environment[key],
      baseline.environment[key],
      `Environment changed: ${key}`,
    );
  }
  assert.equal(
    candidate.httpCachePolicy,
    baseline.httpCachePolicy,
    "Cache policy changed",
  );
  const relative = (a, b) => (a === 0 ? (b === 0 ? 0 : Infinity) : b / a - 1);
  const medianChange = relative(before.medianMs, after.medianMs);
  const p95Change = relative(before.p95Ms, after.p95Ms);
  const pass =
    after.medianMs <= before.medianMs * 1.1 &&
    after.p95Ms <= before.p95Ms * 1.1;
  return {
    baseline: before,
    candidate: after,
    medianChange,
    p95Change,
    pass,
    needsCorroboration: !pass,
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const directory = process.argv[2];
  assert(
    directory,
    "Usage: node util/check-production-budgets.mjs <production-directory>",
  );
  const manifest = productionManifest(directory);
  const ownership = JSON.parse(
    readFileSync(resolve(directory, ".vite/webvowl-generated-js.json"), "utf8"),
  );
  const currentFiles = new Map(manifest.files.map((file) => [file.path, file]));
  assert(
    ownership.schemaVersion === 1 && Array.isArray(ownership.files),
    "Missing generated-asset ownership",
  );
  for (const path of ownership.files) {
    assert(
      currentFiles.get(path)?.sha256 === ownership.hashes?.[path],
      `Generated asset ownership mismatch: ${path}`,
    );
  }
  for (const path of manifest.workerClosures[manifest.workers[0]]) {
    assert(
      ownership.files.includes(path),
      `Unowned current worker module: ${path}`,
    );
  }
  process.stdout.write(
    JSON.stringify({
      ...assessProductionBudgets(manifest),
      timingEvidence: "not-assessed",
    }) + "\n",
  );
}
