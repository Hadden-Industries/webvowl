// SPDX-License-Identifier: AGPL-3.0-only
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { Linter } from "eslint";
import {
  captureGraph,
  git,
  limits,
  nativeReach,
  nulRecords,
  readOwned,
  repositoryRoot,
  safePath,
  sha256,
  snapshot,
  assertUnchanged,
  authoredRole,
  isJavaScript,
  sourcePaths,
  reserveOutput,
} from "./dependency-graph.mjs";
import { runJest, compareOutcomes } from "./jest-execution.mjs";

const self = fileURLToPath(import.meta.url);
const jestManifest = JSON.parse(
  readFileSync(join(repositoryRoot, "node_modules/jest/package.json")),
);
const jestBin = resolve(
  repositoryRoot,
  "node_modules/jest",
  typeof jestManifest.bin === "string"
    ? jestManifest.bin
    : jestManifest.bin.jest,
);
export const jestFlags = [
  "--experimental-vm-modules",
  "--disable-warning=ExperimentalWarning",
];

export function admitJest(root) {
  const config = JSON.parse(readOwned(root, "package.json")).jest;
  if (
    !config ||
    Object.keys(config).some(
      (key) =>
        ![
          "maxWorkers",
          "testEnvironment",
          "transform",
          "testPathIgnorePatterns",
        ].includes(key),
    ) ||
    config.maxWorkers !== 2 ||
    config.testEnvironment !== "node" ||
    !config.transform ||
    Object.keys(config.transform).length ||
    !Array.isArray(config.testPathIgnorePatterns) ||
    config.testPathIgnorePatterns.some((value) => typeof value !== "string")
  )
    throw new Error("Untrusted current Jest configuration");
  const rootPaths = nulRecords(
    git(
      root,
      ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
      true,
    ),
  );
  if (rootPaths.some((path) => /^jest\.config\./u.test(path)))
    throw new Error("Executable current Jest configuration needs disposition");
  return {
    bin: jestBin,
    config: { ...config, rootDir: resolve(root) },
    flags: jestFlags,
    version: jestManifest.version,
  };
}

/** Full discovery never consumes a changed-path filter or dependency graph. */
export function discoverTests(root, admission = admitJest(root)) {
  const started = performance.now();
  const result = spawnSync(
    process.execPath,
    [
      ...admission.flags,
      admission.bin,
      "--config",
      JSON.stringify(admission.config),
      "--listTests",
      "--json",
    ],
    {
      cwd: root,
      encoding: "utf8",
      timeout: limits.discoveryMs,
      maxBuffer: limits.graphBytes,
      windowsHide: true,
      env: { ...process.env, NODE_OPTIONS: "", NODE_PATH: "" },
    },
  );
  if (result.error || result.status !== 0)
    throw new Error(
      `Native Jest discovery failed:${result.error?.code ?? result.stderr.slice(0, 1000)}`,
    );
  const inventory = JSON.parse(result.stdout);
  if (
    !Array.isArray(inventory) ||
    !inventory.length ||
    inventory.length > limits.sources
  )
    throw new Error("Invalid full Jest inventory");
  const tests = inventory
    .map((path) => {
      if (typeof path !== "string" || !isAbsolute(path))
        throw new Error("Non-absolute Jest inventory entry");
      const local = safePath(relative(root, path).replaceAll("\\", "/"));
      if (local.split("/").includes("node_modules"))
        throw new Error("Dependency tests escaped discovery");
      readOwned(root, local);
      return local;
    })
    .sort();
  if (new Set(tests.map((path) => path.toLowerCase())).size !== tests.length)
    throw new Error("Duplicate or case-ambiguous Jest inventory");
  return {
    tests,
    digest: sha256(JSON.stringify(tests)),
    elapsedMs: performance.now() - started,
  };
}

export function readPolicy(root) {
  const policy = JSON.parse(readOwned(root, ".test-impact.json"));
  const fields = [
    "schemaVersion",
    "fullDomains",
    "fullFiles",
    "boundaryFiles",
    "relations",
  ];
  if (
    policy.schemaVersion !== 1 ||
    Object.keys(policy).length !== fields.length ||
    fields.some((key) => !Object.hasOwn(policy, key))
  )
    throw new Error("Invalid impact policy fields");
  for (const key of ["fullDomains", "fullFiles", "boundaryFiles"]) {
    if (
      !Array.isArray(policy[key]) ||
      policy[key].length > 128 ||
      new Set(policy[key]).size !== policy[key].length
    )
      throw new Error(`Invalid policy:${key}`);
    for (const path of policy[key])
      safePath(key === "fullDomains" ? path.replace(/\/$/u, "") : path);
  }
  if (
    !Array.isArray(policy.relations) ||
    policy.relations.length > 128 ||
    new Set(policy.relations.map((rule) => rule.id)).size !==
      policy.relations.length
  )
    throw new Error("Invalid relation inventory");
  const relationKeys = [
    "id",
    "dependency",
    "consumer",
    "kind",
    "evidence",
    "fixture",
  ];
  for (const rule of policy.relations) {
    if (
      Object.keys(rule).length !== relationKeys.length ||
      relationKeys.some(
        (key) =>
          typeof rule[key] !== "string" ||
          !rule[key].trim() ||
          rule[key].length > 1024,
      )
    )
      throw new Error("Invalid declared relation");
    safePath(rule.dependency.replace(/\/$/u, ""));
    safePath(rule.consumer);
    readOwned(root, rule.consumer);
  }
  return policy;
}

/** ESLint supplies parsing and scope. This guard resolves no imports and computes no graph. */
export function hasUnmodelledBoundary(bytes, path = "source.js") {
  let unsafe = false;
  const denied = new Set([
    "eval",
    "Function",
    "require",
    "Worker",
    "SharedWorker",
    "fetch",
    "XMLHttpRequest",
    "WebSocket",
    "importScripts",
    "process",
    "globalThis",
    "global",
    "window",
    "self",
    "document",
    "navigator",
    "URL",
  ]);
  const messages = new Linter().verify(
    bytes.toString("utf8"),
    {
      languageOptions: {
        ecmaVersion: "latest",
        sourceType: path.endsWith(".cjs") ? "commonjs" : "module",
      },
      plugins: {
        boundary: {
          rules: {
            inspect: {
              create(context) {
                return {
                  ImportExpression(node) {
                    if (node.source.type !== "Literal") unsafe = true;
                  },
                  Identifier(node) {
                    if (!denied.has(node.name)) return;
                    let scope = context.sourceCode.getScope(node);
                    while (scope && !scope.set.has(node.name))
                      scope = scope.upper;
                    if (!scope || !scope.set.get(node.name).defs.length)
                      unsafe = true;
                  },
                  MetaProperty() {
                    unsafe = true;
                  },
                };
              },
            },
          },
        },
      },
      rules: { "boundary/inspect": "error" },
    },
    { filename: path },
  );
  return unsafe || messages.some((message) => message.fatal);
}

export async function selectFromGraphs(graphs, changed, tests, relations) {
  const seeds = new Set(changed),
    reached = new Set(changed),
    applied = new Set();
  for (let round = 0; round <= relations.length; round++) {
    const subgraphs = await Promise.all(
      graphs.map((graph) => nativeReach(graph, [...seeds].sort())),
    );
    for (const graph of subgraphs)
      for (const module of graph.modules) reached.add(module.source);
    let grew = false;
    for (const rule of relations)
      if (
        !applied.has(rule.id) &&
        (rule.dependency.endsWith("/")
          ? [...reached].some((path) => path.startsWith(rule.dependency))
          : reached.has(rule.dependency))
      ) {
        applied.add(rule.id);
        seeds.add(rule.consumer);
        grew = true;
      }
    if (!grew) {
      const selected = tests.filter((path) => reached.has(path)).sort();
      return {
        selected,
        appliedRules: [...applied].sort(),
        subgraphs,
        reasons: Object.fromEntries(
          selected.map((path) => [
            path,
            {
              kind: changed.includes(path) ? "direct-change" : "native-reach",
              seeds: [...seeds].sort(),
              relations: [...applied].sort(),
            },
          ]),
        ),
      };
    }
  }
  throw new Error("Relation closure exceeded finite inventory");
}

export function changeEnvelope(root, base) {
  const records = [];
  for (const [state, args] of [
    ["committed", [base, "HEAD"]],
    ["staged", ["--cached"]],
    ["unstaged", []],
  ]) {
    const fields = nulRecords(
      git(
        root,
        [
          "diff",
          "--no-ext-diff",
          "--no-textconv",
          "--no-renames",
          "--name-status",
          "-z",
          ...args,
          "--",
        ],
        true,
      ),
    );
    if (fields.length % 2) throw new Error("Malformed Git change records");
    for (let index = 0; index < fields.length; index += 2)
      records.push({
        state,
        status: fields[index],
        path: safePath(fields[index + 1]),
      });
  }
  for (const path of nulRecords(
    git(root, ["ls-files", "--others", "--exclude-standard", "-z"], true),
  ))
    records.push({ state: "untracked", status: "A", path: safePath(path) });
  if (records.length > limits.entries)
    throw new Error("Change record budget exceeded");
  return records;
}

function historicalSources(root, base, policy) {
  const format = git(root, ["rev-parse", "--show-object-format"]).trim();
  if (
    !new RegExp(`^[a-f0-9]{${format === "sha256" ? 64 : 40}}$`, "u").test(
      base,
    ) ||
    git(root, ["cat-file", "-t", base]).trim() !== "commit"
  )
    throw new Error("Explicit full commit object required");
  if (git(root, ["rev-parse", "--is-shallow-repository"]).trim() !== "false")
    throw new Error("Shallow baseline");
  const entries = nulRecords(
    git(root, ["ls-tree", "-r", "-z", "--full-tree", base], true),
  );
  if (entries.length > limits.entries)
    throw new Error("Historical inventory budget exceeded");
  const records = entries.map((entry) => {
    const tab = entry.indexOf("\t");
    const [mode, type, oid] = entry.slice(0, tab).split(" ");
    return { path: safePath(entry.slice(tab + 1)), mode, type, oid };
  });
  if (
    new Set(records.map((entry) => entry.path.toLowerCase())).size !==
    records.length
  )
    throw new Error("Historical case collision");
  if (
    records.some(
      (entry) =>
        entry.type !== "blob" || !["100644", "100755"].includes(entry.mode),
    )
  )
    throw new Error("Historical link or submodule");
  const controlPaths = new Set([
    ...policy.fullFiles,
    ...records
      .filter((entry) =>
        /(?:^|\/)(?:package(?:-lock)?\.json|jest\.config\.[^/]+)$/u.test(
          entry.path,
        ),
      )
      .map((entry) => entry.path),
  ]);
  for (const path of controlPaths) {
    const old = records.find((entry) => entry.path === path);
    const current = existsSync(join(root, path));
    if (
      Boolean(old) !== current ||
      (old &&
        !git(root, ["cat-file", "blob", old.oid], true).equals(
          readOwned(root, path),
        ))
    )
      throw new Error(`Incompatible baseline control:${path}`);
  }
  let bytes = 0;
  const blobs = [];
  for (const entry of records) {
    if (authoredRole(entry.path) === "unknown")
      throw new Error(`Unknown historical authored root:${entry.path}`);
    if (
      ["authored", "control"].includes(authoredRole(entry.path)) ||
      /(?:^|\/)package\.json$/u.test(entry.path)
    ) {
      const content = git(root, ["cat-file", "blob", entry.oid], true);
      bytes += content.length;
      if (
        content.length > limits.fileBytes ||
        bytes > limits.sourceBytes ||
        blobs.length >= limits.sources
      )
        throw new Error("Historical source budget exceeded");
      blobs.push({ path: entry.path, content });
    }
  }
  return {
    blobs,
    paths: new Set(records.map((entry) => entry.path)),
    identity: {
      commit: base,
      tree: git(root, ["rev-parse", `${base}^{tree}`]).trim(),
    },
  };
}

export async function planAffected({
  root = repositoryRoot,
  base,
  paths = [],
} = {}) {
  root = resolve(root);
  for (const path of paths) {
    safePath(path);
    if (existsSync(join(root, path))) readOwned(root, path);
  }
  const started = performance.now();
  const before = snapshot(root);
  const admission = admitJest(root);
  const inventory = discoverTests(root, admission);
  assertUnchanged(root, before);
  const report = {
    schemaVersion: 1,
    root,
    candidate: before,
    base: null,
    additionalSeeds: paths,
    changes: [],
    fullInventory: inventory.tests,
    inventoryDigest: inventory.digest,
    jest: {
      version: admission.version,
      config: admission.config,
      flags: admission.flags,
    },
    runtime: process.version,
    platform: process.platform,
    mode: "full",
    fallback: null,
    selected: inventory.tests,
    reasons: {},
    executed: false,
    timings: { discoveryMs: inventory.elapsedMs },
  };
  const full = (reason) => {
    report.mode = "full";
    report.fallback = reason;
    report.selected = inventory.tests;
    report.reasons = {};
    return report;
  };
  let temporary;
  try {
    if (!base) return full("missing-explicit-base");
    const policy = readPolicy(root);
    const baseline = historicalSources(root, base, policy);
    report.base = baseline.identity;
    report.changes = changeEnvelope(root, base);
    for (const path of sourcePaths(root))
      if (
        !baseline.paths.has(path) &&
        !report.changes.some((entry) => entry.path === path)
      )
        report.changes.push({ state: "current-source", status: "A", path });
    const changed = [
      ...new Set([...report.changes.map((entry) => entry.path), ...paths]),
    ].sort();
    if (!report.changes.length) return full("no-changes");
    report.policyDigest = sha256(readOwned(root, ".test-impact.json"));
    report.graphConfigDigest = sha256(
      readOwned(root, ".dependency-cruiser.json"),
    );
    if (!changed.length) return full("no-changes");
    for (const path of changed) {
      if (
        report.changes.some(
          (entry) => entry.path === path && entry.status === "D",
        ) &&
        /\.(?:test|spec)\.[cm]?js$/u.test(path)
      )
        return full(`test-tombstone:${path}`);
      if (
        !isJavaScript(path) ||
        policy.fullFiles.includes(path) ||
        policy.boundaryFiles.includes(path) ||
        policy.fullDomains.some((prefix) => path.startsWith(prefix))
      )
        return full(`control-or-resource:${path}`);
      if (
        existsSync(join(root, path)) &&
        hasUnmodelledBoundary(readOwned(root, path), path)
      )
        return full(`unmodelled-boundary:${path}`);
    }
    temporary = mkdtempSync(join(tmpdir(), "webvowl-source-snapshot-"));
    for (const { path, content } of baseline.blobs) {
      mkdirSync(dirname(join(temporary, path)), { recursive: true });
      writeFileSync(join(temporary, path), content, { flag: "wx" });
    }
    const graphs = [captureGraph(temporary, root), captureGraph(root)];
    report.graphDigests = graphs.map((graph) => sha256(JSON.stringify(graph)));
    if (
      graphs.some((graph) =>
        graph.summary.violations.some(
          (finding) => finding.rule.severity === "error",
        ),
      )
    )
      return full("native-policy-error");
    const known = new Set(
      graphs.flatMap((graph) => graph.modules.map((module) => module.source)),
    );
    if (changed.some((path) => !known.has(path)))
      return full("unknown-graph-seed");
    for (const rule of policy.relations)
      if (
        !known.has(rule.consumer) ||
        !(rule.dependency.endsWith("/")
          ? [...known].some((path) => path.startsWith(rule.dependency))
          : known.has(rule.dependency))
      )
        return full(`stale-relation:${rule.id}`);
    // Known API imports still demand full even when a changed binding is aliased.
    if (
      graphs.some((graph) =>
        graph.modules.some(
          (module) =>
            changed.includes(module.source) &&
            module.dependencies.some((dependency) =>
              /^(?:node:)?(?:fs(?:\/promises)?|child_process|worker_threads|vm|module)$/u.test(
                dependency.resolved,
              ),
            ),
        ),
      )
    )
      return full("changed-resource-or-process-module");
    const selection = await selectFromGraphs(
      graphs,
      changed,
      inventory.tests,
      policy.relations,
    );
    if (!selection.selected.length) return full("empty-selection");
    Object.assign(report, selection, {
      mode:
        selection.selected.length === inventory.tests.length
          ? "full"
          : "selected",
      fallback:
        selection.selected.length === inventory.tests.length
          ? "all-tests-reached"
          : null,
    });
    return report;
  } catch (error) {
    return full(`analysis-unavailable:${error.message}`);
  } finally {
    assertUnchanged(root, before);
    report.timings.selectionMs = performance.now() - started;
    if (temporary) rmSync(temporary, { recursive: true, force: true });
  }
}

export async function executePlan(report, { shadow = false, output } = {}) {
  const root = report.root;
  assertUnchanged(root, report.candidate);
  const admission = admitJest(root);
  const fresh = discoverTests(root, admission);
  if (fresh.digest !== report.inventoryDigest)
    throw new Error("Jest inventory drift");
  const destination = output
    ? reserveOutput(root, output)
    : mkdtempSync(join(tmpdir(), "webvowl-jest-result-"));
  const started = performance.now();
  const selected = await runJest(
    root,
    admission,
    report.selected,
    join(destination, "selected"),
  );
  assertUnchanged(root, report.candidate);
  let full = null;
  let agreement = null;
  if (shadow && report.mode === "selected") {
    const independent = discoverTests(root, admission);
    if (independent.digest !== report.inventoryDigest)
      throw new Error("Shadow inventory drift");
    full = await runJest(
      root,
      admission,
      independent.tests,
      join(destination, "full"),
    );
    assertUnchanged(root, report.candidate);
    agreement = compareOutcomes(selected, full);
  }
  const result = {
    ...report,
    executed: true,
    requestedMode: shadow ? "shadow" : "execute",
    actualMode: full
      ? "shadow"
      : report.mode === "selected"
        ? "selected"
        : "full-fallback",
    selectedRun: selected,
    fullRun: full,
    agreement,
    evidenceDirectory: destination,
    success: selected.success && (!full || (full.success && agreement.equal)),
    timings: { ...report.timings, executionMs: performance.now() - started },
  };
  writeFileSync(
    join(destination, "report.json"),
    JSON.stringify(result, null, 2) + "\n",
    { flag: "wx" },
  );
  return result;
}

if (process.argv[1] && resolve(process.argv[1]) === self) {
  try {
    const options = { paths: [] };
    let list = false,
      shadow = false;
    const args = process.argv.slice(2);
    for (let index = 0; index < args.length; index++) {
      const arg = args[index];
      if (arg === "--list" && !list) list = true;
      else if (arg === "--shadow" && !shadow) shadow = true;
      else if (
        ["--base", "--path"].includes(arg) &&
        args[index + 1] &&
        !args[index + 1].startsWith("--")
      ) {
        const value = args[++index];
        if (arg === "--path") options.paths.push(value);
        else if (!options.base) options.base = value;
        else throw new Error("Duplicate baseline");
      } else
        throw new Error(
          "Usage: check:affected -- [--base <full commit>] [--path <literal>] [--list | --shadow]",
        );
    }
    if (list && shadow) throw new Error("List and shadow modes are exclusive");
    const plan = await planAffected(options);
    const result = list ? plan : await executePlan(plan, { shadow });
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
    if (!list && !result.success) process.exitCode = 1;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 2;
  }
}
