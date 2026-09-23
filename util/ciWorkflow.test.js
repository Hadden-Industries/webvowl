import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { parse } from "yaml";

const workflow = parse(
  readFileSync(
    new URL("../.github/workflows/webvowl-ci.yml", import.meta.url),
    "utf8",
  ),
);
const gate = workflow.jobs.required.steps[0];
const bash =
  process.platform === "win32" ? "C:/Program Files/Git/bin/bash.exe" : "bash";
function runGate(overrides = {}, command = gate.run) {
  return spawnSync(bash, ["--noprofile", "--norc", "-e", "-c", command], {
    env: {
      ...process.env,
      SCOPE_RESULT: "success",
      FULL_CHECKS: "false",
      APPLICATION_RESULT: "skipped",
      TOOLING_RESULT: "skipped",
      DOCUMENTATION_RESULT: "success",
      ...overrides,
    },
    encoding: "utf8",
    windowsHide: true,
  }).status;
}
test("the required workflow gate admits successful docs-only and full checks", () => {
  expect(runGate()).toBe(0);
  expect(
    runGate({
      FULL_CHECKS: "true",
      APPLICATION_RESULT: "success",
      TOOLING_RESULT: "success",
    }),
  ).toBe(0);
});
test.each([
  { SCOPE_RESULT: "failure" },
  { FULL_CHECKS: "" },
  { DOCUMENTATION_RESULT: "failure" },
  { DOCUMENTATION_RESULT: "cancelled" },
  { FULL_CHECKS: "true" },
  { TOOLING_RESULT: "failure" },
  { APPLICATION_RESULT: "cancelled" },
])(
  "the required gate rejects failed, cancelled or unexpected missing checks: %j",
  (results) => {
    expect(runGate(results)).not.toBe(0);
  },
);

const codeql = parse(
  readFileSync(
    new URL("../.github/workflows/codeql.yml", import.meta.url),
    "utf8",
  ),
);
test.each([
  ["success", "false", "skipped", 0],
  ["success", "true", "success", 0],
  ["failure", "false", "skipped", 1],
  ["success", "true", "skipped", 1],
  ["success", "true", "failure", 1],
  ["success", "true", "cancelled", 1],
  ["success", "", "success", 1],
])(
  "CodeQL gate handles scope %s, full %s, analysis %s",
  (scope, full, analysis, expected) => {
    expect(
      runGate(
        { SCOPE_RESULT: scope, FULL_CHECKS: full, ANALYSIS_RESULT: analysis },
        codeql.jobs.required.steps[0].run,
      ),
    ).toBe(expected);
  },
);
