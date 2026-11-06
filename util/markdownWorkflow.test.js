import { readFileSync } from "node:fs";
import { parse } from "yaml";

const load = (path) =>
  parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const application = load("../.github/workflows/webvowl-ci.yml");
function assertDocumentationGate(application) {
  const documentation = application.jobs.documentation;
  expect(documentation.if).toBe("needs.scope.outputs.reuse != 'true'");
  const acquire = documentation.steps.findIndex((step) =>
    step.run?.includes("npm ci --include=dev --ignore-scripts"),
  );
  const check = documentation.steps.findIndex((step) =>
    step.run?.includes("npm run check:docs && npm run test:markdown"),
  );
  expect(acquire).toBeGreaterThan(-1);
  expect(check).toBeGreaterThan(acquire);
  expect(documentation.steps[acquire]).not.toHaveProperty("if");
  expect(documentation.steps[acquire].run).toMatch(
    /node util\/installSelectedNpm\.mjs\s+npm ci/,
  );
  expect(documentation.steps[check]).not.toHaveProperty("if");
  expect(documentation.steps[check].run).not.toMatch(
    /files-json|selected|changed/,
  );
  expect(application.jobs.application.if).toBe(
    "needs.scope.outputs.full == 'true' && needs.scope.outputs.reuse != 'true'",
  );
  expect(application.jobs.tooling.if).toBe(
    "needs.scope.outputs.full == 'true' && needs.scope.outputs.reuse != 'true'",
  );
  expect(application.jobs.required.name).toBe("WebVOWL application");
  expect(application.jobs.required.if).toBe("always()");
  expect(application.jobs.required.needs).toEqual([
    "scope",
    "application",
    "tooling",
    "documentation",
    "corpus",
    "json",
  ]);
}

test("CI executes the complete authored corpus unless verified PR evidence is reused", () => {
  assertDocumentationGate(application);
});

test.each([
  (x) => {
    x.jobs.documentation.if = "needs.scope.outputs.full == 'true'";
  },
  (x) => {
    x.jobs.documentation.steps.find((step) =>
      step.run?.includes("npm ci"),
    ).run = "npm ci --ignore-scripts";
  },
  (x) => {
    x.jobs.documentation.steps.find((step) =>
      step.run?.includes("npm run check:docs"),
    ).if = "false";
  },
  (x) => {
    x.jobs.documentation.steps.find((step) =>
      step.run?.includes("npm run check:docs"),
    ).run += " -- --files-json '[]'";
  },
  (x) => {
    x.jobs.documentation.steps.find((step) =>
      step.run?.includes("npm run check:docs"),
    ).run = "npm run check:docs";
  },
  (x) => {
    x.jobs.required.needs = x.jobs.required.needs.filter(
      (job) => job !== "documentation",
    );
  },
  (x) => {
    x.jobs.required.name = "Markdown checks";
  },
])("CI documentation gate regression is rejected (%#)", (mutate) => {
  const changed = structuredClone(application);
  mutate(changed);
  expect(() => assertDocumentationGate(changed)).toThrow();
});
