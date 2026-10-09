import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { parse } from "yaml";

const workflow = parse(
  readFileSync(
    new URL("../.github/workflows/webvowl-ci.yml", import.meta.url),
    "utf8",
  ),
);
const gate = workflow.jobs.required.steps.find((step) =>
  step.run?.endsWith(" gate"),
);

test("reuse wiring authenticates a bounded immutable receipt and preserves required gate", () => {
  expect(workflow.jobs.scope.permissions).toEqual({
    contents: "read",
    actions: "read",
    "pull-requests": "read",
  });
  expect(workflow.jobs.scope.outputs.reuse).toBe(
    "${{ steps.verify.outputs.reuse }}",
  );
  const download = workflow.jobs.scope.steps.find(
    (step) => step.id === "proof",
  );
  expect(download.with).toMatchObject({
    "artifact-ids": "${{ steps.select.outputs.artifact_id }}",
    "run-id": "${{ steps.select.outputs.run_id }}",
    repository: "Hadden-Industries/webvowl",
    "digest-mismatch": "error",
    "merge-multiple": false,
  });
  expect(download["continue-on-error"]).toBe(true);
  expect(download.with.path).toBe("${{ runner.temp }}/webvowl-ci/download");
  const verifier = workflow.jobs.scope.steps.find(
    (step) => step.id === "verify",
  );
  expect(verifier.env.PROOF_DOWNLOAD_OUTCOME).toBe(
    "${{ steps.proof.outcome }}",
  );
  expect(verifier.env.CI_FULL_CHECKS).toBe("${{ steps.scope.outputs.full }}");
  expect(workflow.jobs.scope.name).toBe("Select relevant checks");
  expect(workflow.jobs.documentation.name).toBe("Markdown checks");
  expect(workflow.jobs.required.name).toBe("WebVOWL application");
  expect(workflow.jobs.tooling.name).toBe("Python tooling (${{ matrix.os }})");
  expect(workflow.jobs.tooling.strategy.matrix.os).toEqual([
    "ubuntu-24.04",
    "windows-latest",
  ]);
  for (const job of ["application", "tooling", "documentation"]) {
    expect(workflow.jobs[job].if).toContain(
      "needs.scope.outputs.reuse != 'true'",
    );
  }
  expect(workflow.jobs.required.if).toBe("always()");
  expect(gate.env.CI_JOB_RESULTS).toBe("${{ toJSON(needs) }}");
  const upload = workflow.jobs.required.steps.find((step) =>
    step.uses?.startsWith("actions/upload-artifact@"),
  );
  expect(upload.with["retention-days"]).toBe(14);
  expect(upload.with.name).toBe(
    "webvowl-ci-${{ github.run_id }}-${{ github.run_attempt }}",
  );
  const record = workflow.jobs.required.steps.find(
    (step) => step.id === "receipt",
  );
  expect(record.if).toBe("github.event_name == 'pull_request'");
  expect(upload.with.overwrite).toBe(false);
  expect(upload["continue-on-error"]).toBe(true);
});
const bash =
  process.platform === "win32" ? "C:/Program Files/Git/bin/bash.exe" : "bash";
function runGate(overrides = {}, command = gate.run) {
  if (command === gate.run) {
    return spawnSync(process.execPath, ["util/ciEvidenceCommand.mjs", "gate"], {
      env: {
        ...process.env,
        CI_JOB_RESULTS: JSON.stringify({
          scope: {
            result: overrides.SCOPE_RESULT ?? "success",
            outputs: { full: overrides.FULL_CHECKS ?? "false", reuse: "false" },
          },
          application: { result: overrides.APPLICATION_RESULT ?? "skipped" },
          tooling: { result: overrides.TOOLING_RESULT ?? "skipped" },
          documentation: {
            result: overrides.DOCUMENTATION_RESULT ?? "success",
          },
        }),
      },
      encoding: "utf8",
      windowsHide: true,
    }).status;
  }
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
