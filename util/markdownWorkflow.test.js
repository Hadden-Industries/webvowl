import { readFileSync } from "node:fs";
import { parse } from "yaml";

const load = (path) =>
  parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const workflow = load("../.github/workflows/markdown-quality.yml");
const application = load("../.github/workflows/webvowl-ci.yml");
const producer = "47febbe1b6f3282814e77db7ea13eac72b4928ed";

function assertTrustedCaller(candidate) {
  expect(Object.keys(candidate.on)).toEqual(["workflow_dispatch"]);
  expect(candidate.permissions).toEqual({});
  expect(candidate).not.toHaveProperty("env");
  expect(Object.keys(candidate.on.workflow_dispatch.inputs).sort()).toEqual([
    "candidate_repository",
    "candidate_sha",
    "trusted_sha",
  ]);
  for (const input of Object.values(candidate.on.workflow_dispatch.inputs)) {
    expect(input.required).toBe(true);
    expect(input.type).toBe("string");
  }
  expect(
    candidate.on.workflow_dispatch.inputs.candidate_repository.default,
  ).toBe("Hadden-Industries/webvowl");
  expect(Object.keys(candidate.jobs)).toEqual(["markdown"]);
  const job = candidate.jobs.markdown;
  expect(Object.keys(job).sort()).toEqual(["permissions", "uses", "with"]);
  expect(job.permissions).toEqual({ contents: "read" });
  expect(job.uses).toBe(
    `Hadden-Industries/markdown-quality/.github/workflows/markdown-quality.yml@${producer}`,
  );
  expect(job.with).toEqual({
    "trusted-repository": "Hadden-Industries/webvowl",
    "trusted-sha": "${{ inputs.trusted_sha }}",
    "candidate-repository": "${{ inputs.candidate_repository }}",
    "candidate-sha": "${{ inputs.candidate_sha }}",
    profile: ".markdown-quality-execution.json",
  });
}

test("qualification calls the immutable producer with separate accepted trust and candidate inputs", () => {
  assertTrustedCaller(workflow);
});

test.each([
  (x) => {
    x.on.pull_request_target = {};
  },
  (x) => {
    x.jobs.markdown.permissions.contents = "write";
  },
  (x) => {
    x.jobs.markdown.with["trusted-sha"] = "main";
  },
  (x) => {
    x.jobs.markdown.with["trusted-sha"] = "${{ inputs.candidate_sha }}";
  },
  (x) => {
    x.jobs.markdown.uses = x.jobs.markdown.uses.replace(producer, "main");
  },
  (x) => {
    x.jobs.markdown.with.profile = "candidate/profile.json";
  },
  (x) => {
    x.jobs.markdown.secrets = "inherit";
  },
  (x) => {
    x.jobs.markdown.if = "false";
  },
  (x) => {
    x.jobs.markdown["continue-on-error"] = true;
  },
])("unsafe consumer trust mutation is rejected (%#)", (mutate) => {
  const changed = structuredClone(workflow);
  mutate(changed);
  expect(() => assertTrustedCaller(changed)).toThrow();
});

test("ordinary CI checks the complete authored corpus through the public command", () => {
  const documentation = application.jobs.documentation;
  expect(documentation).not.toHaveProperty("if");
  const acquire = documentation.steps.findIndex((step) =>
    step.run?.includes("npm ci --prefix tooling/markdown --ignore-scripts"),
  );
  const check = documentation.steps.findIndex((step) =>
    step.run?.includes("npm run check:docs && npm run test:markdown"),
  );
  expect(acquire).toBeGreaterThan(-1);
  expect(check).toBeGreaterThan(acquire);
  expect(documentation.steps[check]).not.toHaveProperty("if");
  expect(documentation.steps[check].run).not.toMatch(
    /files-json|selected|changed/,
  );
  expect(application.jobs.application.if).toBe(
    "needs.scope.outputs.full == 'true'",
  );
  expect(application.jobs.tooling.if).toBe(
    "needs.scope.outputs.full == 'true'",
  );
  expect(application.jobs.required.needs).toEqual([
    "scope",
    "application",
    "tooling",
    "documentation",
  ]);
});
