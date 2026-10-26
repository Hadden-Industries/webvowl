import { expect, test } from "@jest/globals";
import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  readFileSync,
  rmdirSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const run = (extra) =>
  spawnSync(process.execPath, ["util/benchmark-legacy-force.mjs", ...extra], {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
    timeout: 30000,
    maxBuffer: 1024 * 1024,
  });
const comparison = [
  "--baseline-ref",
  "HEAD",
  "--fixture",
  "wvowl-medium-sparse",
  "--runs",
  "1",
  "--warmups",
  "0",
  "--diagnostic",
];

test("benchmark requires an explicit historical comparator", () => {
  const result = run([]);
  expect(result.status).toBe(1);
  expect(result.stderr).toContain("Supply an immutable baseline-ref");
});

test("an existing result is preserved and rejected before measuring", () => {
  const directory = mkdtempSync(join(tmpdir(), "webvowl-force-output-"));
  const output = join(directory, "retained.json");
  const original = "original failed evidence\n";
  writeFileSync(output, original);
  try {
    const result = run([...comparison, "--output", output]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("EEXIST");
    expect(result.stderr).not.toContain("1/1:");
    expect(readFileSync(output, "utf8")).toBe(original);
  } finally {
    unlinkSync(output);
    rmdirSync(directory);
  }
});

test("A/A replays exactly and a changed force parameter is a visible negative control", () => {
  const control = run([...comparison, "--aa"]);
  expect(control.status).toBe(0);
  const same = JSON.parse(control.stdout);
  expect(same.complete).toBe(true);
  expect(same.diagnostic).toBe(true);
  expect(same.fixtures[0].samples[0].exactState).toBe(true);
  expect(same.fixtures[0].samples[0].rawRmsDisplacement).toBe(0);
  expect(same.fixtures[0].samples[0].candidate.movingSteps).toBe(298);
  expect(same.fixtures[0].samples[0].candidate.terminationCalls).toBe(1);

  const changed = run([...comparison, "--theta", "1.2"]);
  expect(changed.status).toBe(0);
  const different = JSON.parse(changed.stdout);
  expect(different.complete).toBe(true);
  expect(different.fixtures[0].samples[0].exactState).toBe(false);
  expect(different.fixtures[0].samples[0].rawRmsDisplacement).toBeGreaterThan(
    0,
  );
  expect(different.fixtures[0].summary.candidate.acceptanceSampleCount).toBe(
    false,
  );
}, 30000);
