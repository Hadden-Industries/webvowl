/** Exercise npm's own eligibility gate and the development setup consumer. */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse } from "yaml";

const repositoryManifest = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);
const workflow = parse(
  readFileSync(
    new URL("../.github/workflows/webvowl-ci.yml", import.meta.url),
    "utf8",
  ),
);
const npmCliPath = process.env.npm_execpath;

/** Use a disposable project so native npm enforcement cannot mutate the checkout. */
function withNpmProject(manifest, action) {
  const directory = mkdtempSync(join(tmpdir(), "webvowl-npm-policy-"));
  try {
    writeFileSync(join(directory, "package.json"), JSON.stringify(manifest));
    return action(directory);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function runNpm(directory, script) {
  return spawnSync(
    process.execPath,
    [npmCliPath, "run", script, "--loglevel", "error"],
    {
      cwd: directory,
      encoding: "utf8",
      windowsHide: true,
    },
  );
}

test("native npm admits the declared minimum and rejects an unsatisfied floor before execution", () => {
  expect(npmCliPath).toBeTruthy();
  expect(repositoryManifest.devEngines?.packageManager).toEqual({
    name: "npm",
    version: ">=12.2.0",
    onFail: "error",
  });
  const fixture = {
    private: true,
    devEngines: repositoryManifest.devEngines,
    scripts: { probe: "node -e \"console.log('NPM_POLICY_EXECUTED')\"" },
  };
  const accepted = withNpmProject(fixture, (directory) =>
    runNpm(directory, "probe"),
  );
  expect(accepted.error).toBeUndefined();
  expect(accepted.status).toBe(0);
  expect(accepted.stdout).toContain("NPM_POLICY_EXECUTED");

  const rejected = withNpmProject(
    {
      ...fixture,
      devEngines: {
        packageManager: { name: "npm", version: ">=999.0.0", onFail: "error" },
      },
    },
    (directory) => runNpm(directory, "probe"),
  );
  expect(rejected.error).toBeUndefined();
  expect(rejected.status).not.toBe(0);
  expect(rejected.stderr).toContain("EBADDEVENGINES");
  expect(rejected.stdout).not.toContain("NPM_POLICY_EXECUTED");
});

test("setup accepts npm admitted by devEngines even when its exact reference differs", () => {
  const setupUrl = new URL("./setUpDevelopmentEnvironment.mjs", import.meta.url)
    .href;
  const result = withNpmProject(
    {
      private: true,
      packageManager: "npm@12.0.2",
      devEngines: repositoryManifest.devEngines,
      scripts: { probe: "node runner.mjs" },
    },
    (directory) => {
      for (const filename of [
        "package-lock.json",
        "requirements-dev.txt",
        "requirements.lock.txt",
      ]) {
        writeFileSync(join(directory, filename), "");
      }
      writeFileSync(join(directory, ".node-version"), process.versions.node);
      // Stop at Python validation, before installation; npm eligibility is already proved.
      writeFileSync(join(directory, ".python-version"), "0.0.0");
      writeFileSync(
        join(directory, "runner.mjs"),
        `import { setUpDevelopmentEnvironment } from ${JSON.stringify(setupUrl)};\nsetUpDevelopmentEnvironment({ repositoryRoot: ${JSON.stringify(directory)} });\n`,
      );
      return runNpm(directory, "probe");
    },
  );
  expect(result.error).toBeUndefined();
  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain("Development setup requires Python 0.0.0");
  expect(result.stderr).not.toContain("Use npm@");
});

test.each(["tooling", "application"])(
  "%s bootstraps the exact npm reference before root installation without premature caching",
  (jobName) => {
    const steps = workflow.jobs[jobName].steps;
    const setupIndex = steps.findIndex((step) =>
      step.uses?.startsWith("actions/setup-node@"),
    );
    const installIndex = steps.findIndex((step) =>
      step.run?.includes("npm ci --ignore-scripts"),
    );
    expect(setupIndex).toBeGreaterThanOrEqual(0);
    expect(installIndex).toBeGreaterThan(setupIndex);
    expect(steps[setupIndex].with["package-manager-cache"]).toBe(false);
    expect(steps[setupIndex].with.cache).toBeUndefined();
    const commands = steps[installIndex].run.trim().split("\n");
    expect(commands).toEqual([
      "npm install --global --no-audit --no-fund npm@12.2.0",
      "npm ci --ignore-scripts",
    ]);
    expect(repositoryManifest.packageManager).toBe("npm@12.2.0");
  },
);

test("documentation selects npm before invoking the root devEngines policy", () => {
  const steps = workflow.jobs.documentation.steps;
  const bootstrapIndex = steps.findIndex(
    (step) =>
      step.run === "npm install --global --no-audit --no-fund npm@12.2.0",
  );
  const rootCommandIndex = steps.findIndex((step) =>
    step.run?.includes("npm run check:docs"),
  );
  expect(bootstrapIndex).toBeGreaterThanOrEqual(0);
  expect(rootCommandIndex).toBeGreaterThan(bootstrapIndex);
  const setup = steps.find((step) =>
    step.uses?.startsWith("actions/setup-node@"),
  );
  expect(setup.with["package-manager-cache"]).toBe(false);
  expect(setup.with.cache).toBeUndefined();
});
