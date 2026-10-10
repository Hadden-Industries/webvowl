// SPDX-License-Identifier: AGPL-3.0-only
import { afterEach, describe, expect, test } from "@jest/globals";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
  rmSync,
  symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import {
  captureGraph,
  nativeReach,
  repositoryRoot,
  safePath,
  git,
  sha256,
  writeBundle,
  snapshot,
} from "./dependency-graph.mjs";
import {
  admitJest,
  changeEnvelope,
  discoverTests,
  hasUnmodelledBoundary,
  planAffected,
  executePlan,
  selectFromGraphs,
} from "./affected-tests.mjs";
import {
  compareOutcomes,
  normalizeOutcomes,
  runJest,
} from "./jest-execution.mjs";

const ownedDirectories = [];
const fixture = () => {
  const root = mkdtempSync(join(tmpdir(), "webvowl-impact-fixture-"));
  ownedDirectories.push(root);
  const write = (path, text) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  };
  write(
    "package.json",
    JSON.stringify({
      name: "impact-fixture",
      type: "module",
      jest: {
        maxWorkers: 2,
        testEnvironment: "node",
        transform: {},
        testPathIgnorePatterns: ["/node_modules/"],
      },
    }),
  );
  write("package-lock.json", "{}\n");
  write(
    "packages/vowl/package.json",
    JSON.stringify({
      name: "vowl",
      type: "module",
      exports: {
        ".": "./src/index.js",
        "./owl": "./src/owl.js",
        "./migrate": "./src/migrate.js",
      },
    }),
  );
  write("packages/vowl/src/leaf.js", "export const value = 1;\n");
  write("packages/vowl/src/index.js", "export {value} from './leaf.js';\n");
  write("packages/vowl/src/owl.js", "export {value} from './leaf.js';\n");
  write("packages/vowl/src/migrate.js", "export {value} from './leaf.js';\n");
  write(
    ".dependency-cruiser.json",
    readFileSync(join(repositoryRoot, ".dependency-cruiser.json")),
  );
  const policy = {
    schemaVersion: 1,
    fullDomains: ["docs/"],
    fullFiles: [
      "package.json",
      "package-lock.json",
      "packages/vowl/package.json",
      ".dependency-cruiser.json",
      ".test-impact.json",
    ],
    boundaryFiles: [],
    relations: [],
  };
  write(".test-impact.json", JSON.stringify(policy));
  write("src/leaf.js", "export const value = 1;\n");
  write(
    "src/old.test.js",
    "import {value} from './leaf.js';test('old consumer',()=>expect(value).toBe(1));\n",
  );
  write("src/unrelated.test.js", "test('unrelated',()=>expect(2).toBe(2));\n");
  write("src/disconnected.js", "export const disconnected = 1;\n");
  git(root, ["init", "--quiet"]);
  // Fixture commits never use the user's signer, hooks, author identity or global includes.
  const commit = () => {
    git(root, ["add", "--all"]);
    git(root, [
      "-c",
      "core.hooksPath=",
      "-c",
      "user.name=Fixture",
      "-c",
      "user.email=fixture@example.invalid",
      "-c",
      "commit.gpgsign=false",
      "commit",
      "--quiet",
      "--no-verify",
      "-m",
      "Fixture source snapshot",
    ]);
    return git(root, ["rev-parse", "HEAD"]).trim();
  };
  return { root, write, policy, commit };
};
afterEach(() => {
  for (const root of ownedDirectories.splice(0)) {
    if (
      !["webvowl-impact-fixture-", "webvowl-jest-result-"].some((prefix) =>
        root.startsWith(join(tmpdir(), prefix)),
      )
    )
      throw new Error("Unsafe fixture disposition");
    rmSync(root, { recursive: true, force: true });
  }
});

describe("native graph and source boundary", () => {
  test("rejects malformed source encoding before native analysis", () => {
    const { root, write } = fixture();
    write("src/broken.js", Buffer.from([0xc3, 0x28]));
    expect(() => captureGraph(root)).toThrow();
  });
  test("rejects redirected source and detects content drift", () => {
    const { root, write, commit } = fixture();
    const target = mkdtempSync(
      join(tmpdir(), "webvowl-impact-fixture-target-"),
    );
    ownedDirectories.push(target);
    commit();
    const before = snapshot(root);
    write("src/leaf.js", "export const value = 3;\n");
    expect(snapshot(root).digest).not.toBe(before.digest);
    symlinkSync(
      target,
      join(root, "src/redirect"),
      process.platform === "win32" ? "junction" : "dir",
    );
    expect(() => captureGraph(root)).toThrow("Linked source");
  });
  test("includes disconnected roots and resolves all workspace exports without the current link", async () => {
    const { root, write } = fixture();
    write(
      "src/workspace.js",
      "import {value} from 'vowl';import 'vowl/owl';import 'vowl/migrate';export {value};\n",
    );
    write(
      "packages/vowl/conformance/producer.mjs",
      "export const producer = true;\n",
    );
    write("util/disconnected.mjs", "export const utility = true;\n");
    // A hostile installed-link alternative has different topology. The native snapshot package wins.
    write(
      "node_modules/vowl/package.json",
      JSON.stringify({
        name: "vowl",
        type: "module",
        exports: "./sentinel.js",
      }),
    );
    write(
      "node_modules/vowl/sentinel.js",
      "throw new Error('CURRENT_LINK_EXECUTED');\n",
    );
    const graph = captureGraph(root);
    expect(graph.summary.violations).toEqual([]);
    const consumer = graph.modules.find(
      (module) => module.source === "src/workspace.js",
    );
    expect(
      consumer.dependencies.map((dependency) => dependency.resolved).sort(),
    ).toEqual([
      "packages/vowl/src/index.js",
      "packages/vowl/src/migrate.js",
      "packages/vowl/src/owl.js",
    ]);
    expect(graph.modules.map((module) => module.source)).toEqual(
      expect.arrayContaining([
        "src/disconnected.js",
        "packages/vowl/conformance/producer.mjs",
        "util/disconnected.mjs",
        "packages/vowl/src/leaf.js",
      ]),
    );
    const reached = await nativeReach(graph, ["packages/vowl/src/leaf.js"]);
    expect(reached.modules.map((module) => module.source)).toContain(
      "src/workspace.js",
    );
  });

  test("does not execute candidate config and lets native validation reject invalid rules", () => {
    const { root, write } = fixture();
    write(".dependency-cruiser.cjs", "throw new Error('EXECUTED');\n");
    write("eslint.config.js", "throw new Error('EXECUTED');\n");
    expect(captureGraph(root).modules.map((module) => module.source)).toContain(
      "eslint.config.js",
    );
    write(
      ".dependency-cruiser.json",
      JSON.stringify({
        forbidden: [],
        options: {},
        extends: "./.dependency-cruiser.cjs",
      }),
    );
    expect(() => captureGraph(root)).toThrow("unsupported graph configuration");
    write(
      ".dependency-cruiser.json",
      JSON.stringify({
        forbidden: [{ name: "invalid", severity: "not-native" }],
        options: {},
      }),
    );
    expect(() => captureGraph(root)).toThrow("Graph capture failed");
  });

  test("retains unresolved, production-to-test and development-package errors as diagnostics", () => {
    const { root, write } = fixture();
    write(
      "src/leak.js",
      "import './old.test.js';import './absent.js';import 'eslint';\n",
    );
    const findings = captureGraph(root).summary.violations.map(
      (finding) => finding.rule.name,
    );
    expect(findings).toContain("unresolved");
    expect(findings).toContain("production-to-test-or-tooling");
    // This fixture does not declare eslint as a devDependency; native classification stays npm-unknown.
  });

  test("publishes views of one graph, rejects overwrite and checkout output", async () => {
    const { root, commit } = fixture();
    commit();
    const container = mkdtempSync(
      join(tmpdir(), "webvowl-impact-fixture-output-"),
    );
    ownedDirectories.push(container);
    const output = join(container, "bundle");
    await writeBundle(root, output);
    const published = join(output, "bundle");
    const manifest = JSON.parse(
      readFileSync(join(published, "provenance.json")),
    );
    expect(manifest.complete).toBe(true);
    expect(sha256(readFileSync(join(published, "graph.json")))).toBe(
      manifest.graphDigest,
    );
    for (const view of ["overview", "runtime", "tests"])
      expect(readFileSync(join(published, `${view}.mmd`), "utf8")).toContain(
        manifest.graphDigest,
      );
    await expect(writeBundle(root, output)).rejects.toThrow();
    await expect(writeBundle(root, join(root, "bundle"))).rejects.toThrow(
      "external",
    );
  });

  test.each([
    "../escape.js",
    "-argument.js",
    "a\\b.js",
    "A:stream",
    "nul.js",
    "trailing.",
    "bad\ud800.js",
  ])("rejects unsafe literal %s", (path) =>
    expect(() => safePath(path)).toThrow(),
  );

  test("retains Unicode, spaces and regex punctuation as literal native seeds", async () => {
    const { root, write } = fixture();
    write("src/leaf (ș)+.js", "export const value = 2;\n");
    write(
      "src/unicode.test.js",
      "import './leaf (ș)+.js';test('unicode',()=>{});\n",
    );
    const reached = await nativeReach(captureGraph(root), ["src/leaf (ș)+.js"]);
    expect(reached.modules.map((module) => module.source)).toContain(
      "src/unicode.test.js",
    );
  });
});

describe("independently expected selection and discovery", () => {
  test("historical graphs retain imported resource leaves", async () => {
    const { root, write, commit } = fixture();
    write("src/theme.css", "body {color: black}\n");
    write("src/styled.js", "import './theme.css';export const style = 1;\n");
    const base = commit();
    write("src/leaf.js", "export const value = 2;\n");
    const report = await planAffected({ root, base });
    expect(report.mode).toBe("selected");
    expect(report.selected).toEqual(["src/old.test.js"]);
  }, 30000);
  test("unions old and current topology while really omitting an unrelated whole file", async () => {
    const { root, write, commit } = fixture();
    const base = commit();
    write(
      "src/old.test.js",
      "test('old consumer removed its import',()=>expect(1).toBe(1));\n",
    );
    write(
      "src/current.test.js",
      "import './leaf.js';test('new consumer',()=>{});\n",
    );
    write("src/leaf.js", "export const value = 2;\n");
    const report = await planAffected({ root, base });
    expect(report.mode).toBe("selected");
    expect(report.selected).toEqual(["src/current.test.js", "src/old.test.js"]);
    expect(report.executed).toBe(false);
    expect(report.fullInventory).toContain("src/unrelated.test.js");
  }, 30000);

  test("retains staged intent later reverted in the work file, committed edits, untracked and rename endpoints", () => {
    const { root, write, commit } = fixture();
    const base = commit();
    write("src/leaf.js", "export const value = 2;\n");
    commit();
    write("src/old.test.js", "test('staged intent',()=>{});\n");
    git(root, ["add", "--", "src/old.test.js"]);
    write(
      "src/old.test.js",
      "import {value} from './leaf.js';test('old consumer',()=>expect(value).toBe(1));\n",
    );
    git(root, ["mv", "src/disconnected.js", "src/renamed.js"]);
    write("src/untracked.js", "export const untracked = 1;\n");
    expect(changeEnvelope(root, base)).toEqual(
      expect.arrayContaining([
        { state: "committed", status: "M", path: "src/leaf.js" },
        { state: "staged", status: "M", path: "src/old.test.js" },
        { state: "unstaged", status: "M", path: "src/old.test.js" },
        { state: "staged", status: "D", path: "src/disconnected.js" },
        { state: "staged", status: "A", path: "src/renamed.js" },
        { state: "untracked", status: "A", path: "src/untracked.js" },
      ]),
    );
  });

  test("workspace history uses both snapshots and every exported entry point", async () => {
    const { root, write, commit } = fixture();
    write(
      "src/workspace.test.js",
      "import 'vowl';import 'vowl/owl';import 'vowl/migrate';test('workspace',()=>{});\n",
    );
    const base = commit();
    write("packages/vowl/src/leaf.js", "export const value = 2;\n");
    const report = await planAffected({ root, base });
    expect(report.mode).toBe("selected");
    expect(report.selected).toEqual(["src/workspace.test.js"]);
  }, 30000);

  test("native discovery includes MJS and workspace tests without loading modules", () => {
    const { root, write } = fixture();
    write("tests/scope.test.mjs", "throw new Error('LIST_EXECUTED');\n");
    write(
      "packages/vowl/test/scope.test.js",
      "throw new Error('LIST_EXECUTED');\n",
    );
    write(
      "src/test-support/fixture.js",
      "throw new Error('SUPPORT_EXECUTED');\n",
    );
    const actual = discoverTests(root).tests;
    expect(actual).toEqual([
      "packages/vowl/test/scope.test.js",
      "src/old.test.js",
      "src/unrelated.test.js",
      "tests/scope.test.mjs",
    ]);
    const normal = spawnSync(
      process.execPath,
      [admitJest(root).bin, "--listTests", "--json"],
      {
        cwd: root,
        encoding: "utf8",
        timeout: 120000,
        maxBuffer: 16 * 1024 * 1024,
      },
    );
    expect(normal.status).toBe(0);
    expect(
      JSON.parse(normal.stdout)
        .map((path) => path.slice(root.length + 1).replaceAll("\\", "/"))
        .sort(),
    ).toEqual(actual);
  }, 30000);

  test("source-reading architecture relation selects an enforcing test with no import edge", async () => {
    const { root, write, policy, commit } = fixture();
    write(
      "src/architecture.test.js",
      "import {readFileSync} from 'node:fs';test('architecture',()=>expect(readFileSync(new URL('./leaf.js',import.meta.url),'utf8')).not.toContain('forbidden'));\n",
    );
    policy.relations.push({
      id: "source-reader",
      dependency: "src/leaf.js",
      consumer: "src/architecture.test.js",
      kind: "source-reader",
      evidence: "src/architecture.test.js reads leaf.js",
      fixture: "architecture-source-reader",
    });
    write(".test-impact.json", JSON.stringify(policy));
    const base = commit();
    write("src/leaf.js", "export const value = 1; // forbidden\n");
    const report = await planAffected({ root, base });
    expect(report.selected).toEqual([
      "src/architecture.test.js",
      "src/old.test.js",
    ]);
    expect(report.appliedRules).toEqual(["source-reader"]);
  }, 30000);

  test("relation activation terminates in a cycle without losing independently specified consumers", async () => {
    const { root, write } = fixture();
    write("src/a.js", "import './b.js';\n");
    write("src/b.js", "import './a.js';\n");
    write("src/cycle.test.js", "import './a.js';\n");
    const graph = captureGraph(root);
    const report = await selectFromGraphs(
      [graph, graph],
      ["src/b.js"],
      ["src/cycle.test.js", "src/unrelated.test.js"],
      [],
    );
    expect(report.selected).toEqual(["src/cycle.test.js"]);
  });

  test.each([
    "no-base",
    "invalid-base",
    "no-changes",
    "resource",
    "deleted-test",
    "configuration",
    "computed-import",
    "empty-selection",
  ])(
    "widens %s to full",
    async (scenario) => {
      const { root, write, commit } = fixture();
      let base = commit();
      if (scenario === "no-base") base = undefined;
      if (scenario === "invalid-base") base = "HEAD";
      if (scenario === "resource") write("docs/data.json", "{}\n");
      if (scenario === "deleted-test") rmSync(join(root, "src/old.test.js"));
      if (scenario === "configuration")
        write("package-lock.json", '{"changed":true}\n');
      if (scenario === "computed-import")
        write("src/leaf.js", "export const load = (name) => import(name);\n");
      if (scenario === "empty-selection")
        write("src/disconnected.js", "export const disconnected = 2;\n");
      const report = await planAffected({ root, base });
      expect(report.mode).toBe("full");
      expect(report.selected).toEqual(report.fullInventory);
      expect(report.selected.length).toBeGreaterThan(0);
      expect(report.fallback).toBeTruthy();
    },
    30000,
  );

  test("blocks unsafe current configuration instead of laundered full fallback", async () => {
    const { root, write, commit } = fixture();
    commit();
    const packageJson = JSON.parse(readFileSync(join(root, "package.json")));
    packageJson.jest.setupFiles = ["./malicious.js"];
    write("package.json", JSON.stringify(packageJson));
    await expect(planAffected({ root })).rejects.toThrow(
      "Untrusted current Jest",
    );
  });

  test("scope-aware guard recognizes aliases and computed loads conservatively", () => {
    expect(
      hasUnmodelledBoundary(
        Buffer.from("export const load = (path) => import(path);"),
      ),
    ).toBe(true);
    expect(
      hasUnmodelledBoundary(Buffer.from("const load = globalThis['fetch'];")),
    ).toBe(true);
    expect(
      hasUnmodelledBoundary(Buffer.from("export const f = () => fetch('x');")),
    ).toBe(true);
    expect(
      hasUnmodelledBoundary(Buffer.from("export const fetch = (x) => x;")),
    ).toBe(false);
  });
});

describe("native Jest result integrity", () => {
  test("preserves duplicate titles, skips and todos and detects disagreement", () => {
    const root = resolve(tmpdir(), "outcome-fixture");
    const suite = {
      name: join(root, "src/one.test.js"),
      status: "passed",
      assertionResults: ["passed", "pending", "todo"].map((status) => ({
        fullName: "duplicate title",
        ancestorTitles: [],
        status,
        failureMessages: [],
      })),
    };
    const outcomes = normalizeOutcomes(root, ["src/one.test.js"], {
      testResults: [suite],
    });
    expect(outcomes["src/one.test.js"].assertions).toHaveLength(3);
    const changed = structuredClone(outcomes);
    changed["src/one.test.js"].assertions[1].status = "passed";
    expect(
      compareOutcomes(
        { success: true, outcomes },
        { success: true, outcomes: changed },
      ).equal,
    ).toBe(false);
    expect(() =>
      normalizeOutcomes(root, ["src/one.test.js", "src/two.test.js"], {
        testResults: [suite],
      }),
    ).toThrow("Missing");
    expect(() =>
      normalizeOutcomes(root, ["src/one.test.js", "src/two.test.js"], {
        testResults: [suite, suite],
      }),
    ).toThrow("duplicate");
    expect(
      compareOutcomes({ success: false, outcomes }, { success: true, outcomes })
        .equal,
    ).toBe(false);
  });

  const hasRepositoryPython = existsSync(
    join(
      repositoryRoot,
      ".venv",
      ...(process.platform === "win32"
        ? ["Scripts", "python.exe"]
        : ["bin", "python"]),
    ),
  );
  const nativeTest = hasRepositoryPython ? test : test.skip;
  nativeTest(
    "a real repository VM source reader detects an omitted import-edge failure",
    async () => {
      const { root, write, policy, commit } = fixture();
      const source = "src/app/js/ontologyLifecycle.js",
        consumer = "src/app/js/ontologyLifecycle.test.js";
      const original = readFileSync(join(repositoryRoot, source), "utf8");
      write(source, original);
      const testSource = readFileSync(join(repositoryRoot, consumer), "utf8");
      // The fixture uses the installed public Jest globals; no candidate config is executed.
      write(
        consumer,
        testSource.replace(/import \{[^}]+\} from "@jest\/globals";\s*/u, ""),
      );
      const registry = JSON.parse(
        readFileSync(join(repositoryRoot, ".test-impact.json")),
      );
      policy.relations = registry.relations.filter(
        (rule) => rule.dependency === source && rule.consumer === consumer,
      );
      expect(policy.relations).toHaveLength(1);
      write(".test-impact.json", JSON.stringify(policy));
      const base = commit();
      write(
        source,
        original.replace(
          "graphControls: ontologyLifecycleState === ONTOLOGY_LIFECYCLE_STATES.READY",
          "graphControls: false",
        ),
      );
      const report = await planAffected({ root, base });
      expect(report.mode).toBe("selected");
      expect(report.selected).toEqual([consumer]);
      const result = await executePlan(report, { shadow: true });
      ownedDirectories.push(result.evidenceDirectory);
      expect(result.selectedRun.outcomes[consumer].status).toBe("failed");
      expect(result.fullRun.outcomes[consumer].status).toBe("failed");
      expect(result.success).toBe(false);
    },
    30000,
  );
  nativeTest(
    "executes a real whole-file subset without shadow duplication",
    async () => {
      const { root, write, commit } = fixture();
      const base = commit();
      write(
        "src/old.test.js",
        "test('isolated edit',()=>expect(1).toBe(1));\n",
      );
      const plan = await planAffected({ root, base });
      expect(plan.selected).toEqual(["src/old.test.js"]);
      const result = await executePlan(plan);
      ownedDirectories.push(result.evidenceDirectory);
      expect(result.success).toBe(true);
      expect(result.actualMode).toBe("selected");
      expect(result.fullRun).toBeNull();
    },
    30000,
  );
  nativeTest(
    "a non-import worker relation catches an actual worker-leaf failure",
    async () => {
      const { root, write, policy, commit } = fixture();
      write("src/workerLeaf.js", "export const value = 1;\n");
      write(
        "src/worker.js",
        "import {parentPort} from 'node:worker_threads';import {value} from './workerLeaf.js';parentPort.postMessage(value);\n",
      );
      write(
        "src/client.js",
        "import {Worker} from 'node:worker_threads';export const run = () => new Promise((resolve,reject)=>{const worker=new Worker(new URL('./worker.js',import.meta.url));worker.once('message',resolve);worker.once('error',reject);});\n",
      );
      write(
        "src/worker.test.js",
        "import {run} from './client.js';test('worker contract',async()=>expect(await run()).toBe(1));\n",
      );
      policy.relations.push({
        id: "worker",
        dependency: "src/worker.js",
        consumer: "src/client.js",
        kind: "worker-entry",
        evidence: "client.js creates a Worker",
        fixture: "worker-resource",
      });
      write(".test-impact.json", JSON.stringify(policy));
      const base = commit();
      write("src/workerLeaf.js", "export const value = 2;\n");
      const report = await planAffected({ root, base });
      expect(report.mode).toBe("selected");
      expect(report.selected).toEqual(["src/worker.test.js"]);
      const result = await executePlan(report, { shadow: true });
      ownedDirectories.push(result.evidenceDirectory);
      expect(result.selectedRun.outcomes["src/worker.test.js"].status).toBe(
        "failed",
      );
      expect(result.success).toBe(false);
    },
    60000,
  );

  nativeTest(
    "shadow detects a deliberately defective selector and retains both results",
    async () => {
      const { root, write, commit } = fixture();
      write(
        "src/omitted.test.js",
        "test('missing failure',()=>expect(1).toBe(2));\n",
      );
      const base = commit();
      write("src/leaf.js", "export const value = 1; // bounded edit\n");
      const report = await planAffected({ root, base });
      report.selected = ["src/unrelated.test.js"]; // Deliberate defect; the full oracle must remain independent.
      report.mode = "selected";
      const result = await executePlan(report, { shadow: true });
      ownedDirectories.push(result.evidenceDirectory);
      expect(result.selectedRun.success).toBe(true);
      expect(result.fullRun.outcomes["src/omitted.test.js"].status).toBe(
        "failed",
      );
      expect(result.agreement.equal).toBe(false);
      expect(result.success).toBe(false);
      expect(existsSync(join(result.evidenceDirectory, "full/jest.json"))).toBe(
        true,
      );
    },
    60000,
  );

  nativeTest(
    "executes source-reading architecture assertions and native skip/todo multiplicity",
    async () => {
      const { root, write, policy, commit } = fixture();
      write(
        "src/architecture.test.js",
        "import {readFileSync} from 'node:fs';test('source constraint',()=>expect(readFileSync(new URL('./leaf.js',import.meta.url),'utf8')).not.toContain('forbidden'));\n",
      );
      write(
        "src/outcomes.test.js",
        "test('duplicate',()=>{});test('duplicate',()=>{});test.skip('skip',()=>{});test.todo('todo');\n",
      );
      policy.relations.push({
        id: "reader",
        dependency: "src/leaf.js",
        consumer: "src/architecture.test.js",
        kind: "source-reader",
        evidence: "architecture.test.js reads leaf",
        fixture: "architecture-source-reader",
      });
      write(".test-impact.json", JSON.stringify(policy));
      const base = commit();
      write("src/leaf.js", "export const value = 1; // forbidden\n");
      const report = await planAffected({ root, base });
      expect(report.selected).toEqual([
        "src/architecture.test.js",
        "src/old.test.js",
      ]);
      const result = await executePlan(report, { shadow: true });
      ownedDirectories.push(result.evidenceDirectory);
      expect(
        result.selectedRun.outcomes["src/architecture.test.js"].status,
      ).toBe("failed");
      expect(result.fullRun.incomplete).toBeNull();
      expect(
        result.fullRun.outcomes["src/outcomes.test.js"].assertions.map(
          (assertion) => assertion.status,
        ),
      ).toEqual(["passed", "passed", "pending", "todo"]);
      expect(result.success).toBe(false);
    },
    60000,
  );
  nativeTest(
    "runs whole files; the independently full negative control catches an omitted failure",
    async () => {
      const { root, write } = fixture();
      write(
        "src/omitted.test.js",
        "test('intentionally omitted failure',()=>expect(1).toBe(2));\n",
      );
      const output = mkdtempSync(
        join(tmpdir(), "webvowl-impact-fixture-result-"),
      );
      ownedDirectories.push(output);
      const admission = admitJest(root);
      const selected = await runJest(
        root,
        admission,
        ["src/unrelated.test.js"],
        join(output, "selected"),
      );
      const full = await runJest(
        root,
        admission,
        discoverTests(root).tests,
        join(output, "full"),
      );
      expect(selected.success).toBe(true);
      expect(selected.processFacts.quiescent).toBe(true);
      expect(full.success).toBe(false);
      expect(full.outcomes["src/omitted.test.js"].status).toBe("failed");
      expect(compareOutcomes(selected, full).equal).toBe(false);
    },
    60000,
  );
});
