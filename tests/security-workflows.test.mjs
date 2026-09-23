import { readFileSync } from "node:fs";
import { parse } from "yaml";

const workflow = (name) => parse(readFileSync(new URL(`../.github/workflows/${name}.yml`, import.meta.url), "utf8"));

test("dependency review covers every PR and blocks high vulnerabilities in build and runtime dependencies", () => {
  const config = workflow("dependency-review");
  expect(config.on).toHaveProperty("pull_request");
  expect(config.on).not.toHaveProperty("pull_request_target");
  expect(config.on.pull_request).not.toHaveProperty("paths");
  expect(config.on.pull_request).not.toHaveProperty("paths-ignore");
  expect(config.permissions).toEqual({ contents: "read" });
  const job = config.jobs.review;
  expect(job.if).toBeUndefined();
  expect(job.name).toBe("Dependency review");
  const reviews = job.steps.filter(step => step.uses?.startsWith("actions/dependency-review-action@"));
  expect(reviews).toHaveLength(1);
  expect(reviews[0].uses).toMatch(/^actions\/dependency-review-action@[a-f0-9]{40}$/);
  expect(reviews[0].if).toBe("steps.scope.outputs.full == 'true'");
  expect(job.steps.find(step => step.id === "scope").run).toBe("node util/selectCiChecks.mjs");
  expect(reviews[0].with).toMatchObject({"fail-on-severity":"high", "fail-on-scopes":"runtime, development, unknown", "vulnerability-check":true, "warn-only":false, "comment-summary-in-pr":"never"});
});

test("CodeQL analyzes fork PRs using the unprivileged PR event and static extraction", () => {
  const config = workflow("codeql");
  expect(config.on).toHaveProperty("pull_request");
  expect(config.on).not.toHaveProperty("pull_request_target");
  const job = config.jobs.analyze;
  expect(job.if).toBe("needs.scope.outputs.full == 'true'");
  expect(config.permissions).toEqual({});
  expect(job.permissions).toEqual({contents:"read", "security-events":"write"});
  expect(job.steps.every(step => !step.run)).toBe(true);
  expect(job.steps[0].with["persist-credentials"]).toBe(false);
  expect(job.steps.find(step => step.uses.startsWith("github/codeql-action/init@")).with["build-mode"]).toBe("none");
});
