import { readFileSync } from "node:fs";
import { parse } from "yaml";

const load = (path) =>
  parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const workflow = load("../.github/workflows/markdown-quality.yml");
const application = load("../.github/workflows/webvowl-ci.yml");
const observerPython = "3.14.7";
const nodeVersion = "24.21.0";

function assertTrustedWindow(candidate) {
  expect(Object.keys(candidate.on)).toEqual(["workflow_dispatch"]);
  expect(candidate.permissions).toEqual({});
  expect(candidate).not.toHaveProperty("env");
  expect(Object.keys(candidate.on.workflow_dispatch.inputs).sort()).toEqual([
    "candidate_repository",
    "candidate_sha",
  ]);
  expect(
    candidate.on.workflow_dispatch.inputs.candidate_repository,
  ).toMatchObject({
    required: true,
    type: "string",
    default: "Hadden-Industries/webvowl",
  });
  expect(candidate.on.workflow_dispatch.inputs.candidate_sha).toMatchObject({
    required: true,
    type: "string",
  });
  expect(Object.keys(candidate.jobs).sort()).toEqual([
    "markdown_linux",
    "markdown_windows",
  ]);
  for (const [id, job] of Object.entries(candidate.jobs)) {
    expect(job).not.toHaveProperty("if");
    expect(job).not.toHaveProperty("env");
    expect(job).not.toHaveProperty("continue-on-error");
    expect(job.permissions).toEqual({ contents: "read" });
    expect(job["timeout-minutes"]).toBe(15);
    expect(job.steps).toHaveLength(8);
    const [trusted, node, python, acquire, data, probes, observe, retain] =
      job.steps;
    const checkout =
      "actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1";
    expect(trusted.uses).toBe(checkout);
    expect(data.uses).toBe(checkout);
    expect(node.uses).toBe(
      "actions/setup-node@820762786026740c76f36085b0efc47a31fe5020",
    );
    expect(python.uses).toBe(
      "actions/setup-python@5fda3b95a4ea91299a34e894583c3862153e4b97",
    );
    expect(retain.uses).toBe(
      "actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a",
    );
    for (const step of job.steps.slice(0, 7)) {
      expect(step).not.toHaveProperty("if");
      expect(step).not.toHaveProperty("continue-on-error");
      expect(step).not.toHaveProperty("shell");
    }
    expect(job.defaults.run.shell).toBe(
      id === "markdown_linux" ? "bash" : "pwsh",
    );
    expect(trusted.with).toMatchObject({
      ref: "${{ github.workflow_sha }}",
      path: "trusted",
      "persist-credentials": false,
    });
    expect(node.with).toMatchObject({
      "node-version": nodeVersion,
      "check-latest": false,
      "package-manager-cache": false,
      cache: "",
    });
    expect(python).toMatchObject({
      id: "markdown_python",
      with: {
        "python-version": observerPython,
        "update-environment": false,
        architecture: "x64",
        "check-latest": false,
        cache: "",
      },
    });
    expect(acquire.run).toContain(
      "npm ci --ignore-scripts --no-audit --no-fund",
    );
    expect(acquire.run).toContain("--userconfig=");
    expect(acquire.run).toContain("--globalconfig=");
    expect(acquire.run).toContain("--registry=https://registry.npmjs.org/");
    expect(acquire.run).toContain("--cache=");
    expect(acquire["working-directory"]).toBe("trusted/tooling/markdown");
    expect(acquire.env).toEqual({
      NODE_AUTH_TOKEN: "",
      NPM_TOKEN: "",
      GH_TOKEN: "",
      GITHUB_TOKEN: "",
      NODE_OPTIONS: "",
      NODE_PATH: "",
    });
    expect(data.with).toMatchObject({
      repository: "${{ inputs.candidate_repository }}",
      ref: "${{ inputs.candidate_sha }}",
      path: "candidate",
      "persist-credentials": false,
    });
    expect(probes.run).toBe(
      "node --test trusted/util/check-markdown-candidate.probes.mjs",
    );
    expect(observe.run).toBe("node trusted/util/run-markdown-window.mjs");
    expect(observe).not.toHaveProperty("if");
    expect(observe).not.toHaveProperty("continue-on-error");
    expect(observe.env).toMatchObject({
      MARKDOWN_OBSERVER_PYTHON:
        "${{ steps.markdown_python.outputs.python-path }}",
      MARKDOWN_CANDIDATE_SHA: "${{ inputs.candidate_sha }}",
      MARKDOWN_CANDIDATE_REPOSITORY: "${{ inputs.candidate_repository }}",
      MARKDOWN_TRUSTED_SHA: "${{ github.workflow_sha }}",
    });
    expect(retain.if).toBe("${{ !cancelled() }}");
    expect(retain.with["if-no-files-found"]).toBe("error");
    expect(retain.with["include-hidden-files"]).toBe(false);
    expect(retain.with["retention-days"]).toBe(90);
    expect(retain.with.path).toContain("markdown-window/window.json");
    expect(retain.with.path).toContain("trusted-markdown-run.json");
    expect(retain.with.path).not.toContain("/candidate");
    expect(job["runs-on"]).toBe(
      id === "markdown_linux" ? "ubuntu-24.04" : "windows-2025",
    );
  }
}

test("trusted qualification binds reviewed source, candidate data and both resource windows", () => {
  assertTrustedWindow(workflow);
});

test.each([
  (x) => {
    x.on.pull_request_target = {};
  },
  (x) => {
    x.jobs.markdown_linux.permissions.contents = "write";
  },
  (x) => {
    x.jobs.markdown_windows.steps[0].with.ref = "main";
  },
  (x) => {
    x.jobs.markdown_linux.steps[2].with["update-environment"] = true;
  },
  (x) => {
    x.jobs.markdown_windows.steps[6].if = "false";
  },
  (x) => {
    x.jobs.markdown_linux.steps[6]["continue-on-error"] = true;
  },
  (x) => {
    x.jobs.markdown_windows.steps[6].run = "echo passed";
  },
  (x) => {
    x.jobs.markdown_linux.steps[6].env.MARKDOWN_OBSERVER_PYTHON = "python";
  },
  (x) => {
    [x.jobs.markdown_windows.steps[3], x.jobs.markdown_windows.steps[4]] = [
      x.jobs.markdown_windows.steps[4],
      x.jobs.markdown_windows.steps[3],
    ];
  },
  (x) => {
    x.jobs.markdown_linux.if = "false";
  },
  (x) => {
    x.jobs.markdown_linux.steps[0].uses = "actions/checkout@main";
  },
  (x) => {
    x.jobs.markdown_windows.steps[1].with.cache = "npm";
  },
  (x) => {
    x.jobs.markdown_linux.steps[4].with["persist-credentials"] = true;
  },
  (x) => {
    x.jobs.markdown_windows.steps[6].shell = "cmd";
  },
  (x) => {
    x.jobs.markdown_linux.steps[3]["working-directory"] = "candidate";
  },
  (x) => {
    x.jobs.markdown_windows.steps[3].env.NODE_OPTIONS =
      "--import=candidate.mjs";
  },
  (x) => {
    x.jobs.markdown_linux.steps[6].env.MARKDOWN_TRUSTED_SHA = "main";
  },
  (x) => {
    x.jobs.markdown_windows.steps[7].with["include-hidden-files"] = true;
  },
])("unsafe trusted workflow mutation is rejected (%#)", (mutate) => {
  const changed = structuredClone(workflow);
  mutate(changed);
  expect(() => assertTrustedWindow(changed)).toThrow();
});

test("documentation-only and mixed jobs both acquire and check the complete canonical corpus", () => {
  const documentation = application.jobs.documentation;
  expect(documentation).not.toHaveProperty("if");
  const acquire = documentation.steps.findIndex((step) =>
    step.run?.includes("npm ci --prefix tooling/markdown --ignore-scripts"),
  );
  const check = documentation.steps.findIndex((step) =>
    step.run?.includes("markdown-quality/src/cli.js check"),
  );
  expect(acquire).toBeGreaterThan(-1);
  expect(check).toBeGreaterThan(acquire);
  expect(documentation.steps[check]).not.toHaveProperty("if");
  expect(documentation.steps[check].run).not.toMatch(
    /files-json|selected|changed/,
  );
  expect(
    documentation.steps.some((step) => step.run?.includes("pip install")),
  ).toBe(false);
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
