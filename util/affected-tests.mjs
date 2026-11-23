// SPDX-License-Identifier: AGPL-3.0-only
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  writeFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { Linter } from "eslint";
import { isDeepStrictEqual } from "node:util";
import {
  captureGraph,
  captureDependencyView,
  dependencyViewBytes,
  git,
  installedGraphVersions,
  isGraphMetadata,
  limits,
  nulRecords,
  readImpactPolicy,
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
import { selectDependencyTests, viewContains } from "./dependency-view.mjs";
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
      env: {
        ...process.env,
        NODE_OPTIONS: admission.flags.join(" "),
        NODE_PATH: "",
      },
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
  // Jest reports canonical long paths; a Windows 8.3 short root such as RUNNER~1
  // would otherwise make every entry appear to escape the root.
  const canonicalRoot = realpathSync.native(root);
  const tests = inventory
    .map((path) => {
      if (typeof path !== "string" || !isAbsolute(path))
        throw new Error("Non-absolute Jest inventory entry");
      const local = safePath(
        relative(canonicalRoot, path).replaceAll("\\", "/"),
      );
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
    git(root, ["ls-tree", "-r", "-l", "-z", "--full-tree", base], true),
  );
  if (entries.length > limits.entries)
    throw new Error("Historical inventory budget exceeded");
  const records = entries.map((entry) => {
    const tab = entry.indexOf("\t");
    const [mode, type, oid, size] = entry.slice(0, tab).trim().split(/\s+/u);
    return {
      path: safePath(entry.slice(tab + 1)),
      mode,
      type,
      oid,
      size: Number(size),
    };
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
  const wanted = [];
  const leaves = [];
  for (const entry of records) {
    if (authoredRole(entry.path) === "unknown")
      throw new Error(`Unknown historical authored root:${entry.path}`);
    if (
      (["authored", "control"].includes(authoredRole(entry.path)) &&
        isJavaScript(entry.path)) ||
      /(?:^|\/)package\.json$/u.test(entry.path) ||
      isGraphMetadata(entry.path)
    ) {
      bytes += entry.size;
      if (
        !Number.isSafeInteger(entry.size) ||
        entry.size < 0 ||
        entry.size > limits.fileBytes ||
        bytes > limits.sourceBytes ||
        wanted.length >= limits.sources
      )
        throw new Error("Historical source budget exceeded");
      wanted.push(entry);
    } else if (authoredRole(entry.path) === "authored") {
      // Native resolution needs resource existence, never historical resource execution.
      leaves.push({ path: entry.path, content: Buffer.alloc(0) });
    }
  }
  const batch = git(root, ["cat-file", "--batch"], true, {
    input: wanted.map((entry) => entry.oid).join("\n") + "\n",
    maxBuffer: limits.sourceBytes + limits.sources * 128,
  });
  let offset = 0;
  const blobs = wanted.map((entry) => {
    const end = batch.indexOf(10, offset);
    if (
      end < offset ||
      end - offset > 128 ||
      batch.subarray(offset, end).toString("ascii") !==
        `${entry.oid} blob ${entry.size}`
    )
      throw new Error("Invalid native Git batch header");
    offset = end + 1;
    const content = batch.subarray(offset, offset + entry.size);
    offset += entry.size;
    if (content.length !== entry.size || batch[offset++] !== 10)
      throw new Error("Incomplete native Git batch content");
    return { path: entry.path, content };
  });
  if (offset !== batch.length)
    throw new Error("Unexpected native Git batch output");
  blobs.push(...leaves);
  return {
    blobs,
    paths: new Set(records.map((entry) => entry.path)),
    identity: {
      commit: base,
      tree: git(root, ["rev-parse", `${base}^{tree}`]).trim(),
    },
  };
}

// Admit only witnessed test-fixture formats. Controls and broad asset/corpus
// domains still fall back before analysis according to the existing policy.
const isFixtureResource = (path) =>
  path.includes("/test/fixtures/") &&
  /\.(?:jsonl?|rdf|ttl|owl|xml|nt|nq|trig)$/u.test(path);

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
    schemaVersion: 2,
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
    const policy = readImpactPolicy(root);
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
    const staged = new Set(
      report.changes
        .filter((entry) => entry.state === "staged")
        .map((entry) => entry.path),
    );
    if (
      report.changes.some(
        (entry) => entry.state === "unstaged" && staged.has(entry.path),
      )
    )
      return full("unobserved-intermediate-index-state");
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
        (!isJavaScript(path) && !isFixtureResource(path)) ||
        policy.fullFiles.includes(path) ||
        policy.boundaryFiles.includes(path) ||
        policy.fullDomains.some((prefix) => path.startsWith(prefix))
      )
        return full(`control-or-resource:${path}`);
      if (
        isJavaScript(path) &&
        existsSync(join(root, path)) &&
        hasUnmodelledBoundary(readOwned(root, path), path)
      )
        return full(`unmodelled-boundary:${path}`);
    }
    report.toolVersions = installedGraphVersions();
    const lock = JSON.parse(readOwned(root, "package-lock.json"));
    for (const [name, installed] of Object.entries(report.toolVersions)) {
      const pinned = lock.packages?.["node_modules/" + name]?.version;
      if (pinned && pinned !== installed)
        return full("toolchain-lock-drift:" + name);
    }
    temporary = mkdtempSync(join(tmpdir(), "webvowl-source-snapshot-"));
    for (const { path, content } of baseline.blobs) {
      mkdirSync(dirname(join(temporary, path)), { recursive: true });
      writeFileSync(join(temporary, path), content, { flag: "wx" });
    }
    const native = [captureGraph(temporary, root), captureGraph(root)];
    const graphs = [
      [
        "base",
        captureDependencyView(temporary, {
          native: native[0],
          paths: [...baseline.paths],
          policy,
        }),
      ],
      [
        "candidate",
        captureDependencyView(root, {
          native: native[1],
          paths: before.files
            .filter((file) => file.sha256)
            .map((file) => file.path),
          policy,
        }),
      ],
    ];
    report.graphDigests = Object.fromEntries(
      graphs.map(([name, graph]) => [name, sha256(dependencyViewBytes(graph))]),
    );
    report.resourceDiagnostics = Object.fromEntries(
      graphs.map(([name, graph]) => [name, graph.resourceDiagnostics]),
    );
    report.blockingFindings = Object.fromEntries(
      graphs.map(([name, graph]) => [name, graph.blockingFindings]),
    );
    if (graphs.some(([, graph]) => graph.blockingFindings.length))
      return full("native-policy-error");
    if (
      changed.some(
        (path) => !graphs.some(([, graph]) => viewContains(graph, path)),
      )
    )
      return full("unknown-graph-seed");
    for (const [, graph] of graphs) {
      const stale = graph.resourceDiagnostics.find(
        (item) => item.kind === "stale-relation",
      );
      if (stale) return full("stale-relation:" + stale.relationId);
      if (graph.resourceDiagnostics.some((item) => item.kind === "parse"))
        return full("unmodelled-source");
    }
    // Known API imports still demand full even when a changed binding is aliased.
    if (
      native.some((graph) =>
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
    const selection = selectDependencyTests(
      graphs,
      changed,
      inventory.tests,
      changed.filter((path) => !isJavaScript(path)),
    );
    if (selection.unseenResources.length)
      return full("unproved-file-input:" + selection.unseenResources[0]);
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
    try {
      assertUnchanged(root, before);
    } finally {
      report.timings.planningMs = performance.now() - started;
      report.timings.selectionMs =
        report.timings.planningMs - inventory.elapsedMs;
      if (temporary) rmSync(temporary, { recursive: true, force: true });
    }
  }
}

export async function executePlan(report, { shadow = false, output } = {}) {
  const root = report.root;
  const destination = output
    ? reserveOutput(root, output)
    : mkdtempSync(join(tmpdir(), "webvowl-jest-result-"));
  const started = performance.now();
  const timings = {
    ...report.timings,
    rediscoveryMs: 0,
    selectedDiscoveryMs: 0,
    fullDiscoveryMs: 0,
    selectedExecutionMs: 0,
    fullExecutionMs: 0,
  };
  let selected = null,
    full = null,
    agreement = null,
    incomplete = null;
  const assertInputs = () => {
    assertUnchanged(root, report.candidate);
    if (
      report.mode === "selected" &&
      !isDeepStrictEqual(report.toolVersions, installedGraphVersions())
    )
      throw new Error("Installed graph toolchain drift");
  };
  try {
    assertInputs();
    const admission = admitJest(root);
    const fresh = discoverTests(root, admission);
    timings.rediscoveryMs += fresh.elapsedMs;
    timings.selectedDiscoveryMs = fresh.elapsedMs;
    if (fresh.digest !== report.inventoryDigest)
      throw new Error("Jest inventory drift");
    let executionStarted = performance.now();
    selected = await runJest(
      root,
      admission,
      report.selected,
      join(destination, "selected"),
    );
    timings.selectedExecutionMs = performance.now() - executionStarted;
    assertInputs();
    if (shadow && report.mode === "selected") {
      const independent = discoverTests(root, admission);
      timings.rediscoveryMs += independent.elapsedMs;
      timings.fullDiscoveryMs = independent.elapsedMs;
      if (independent.digest !== report.inventoryDigest)
        throw new Error("Shadow inventory drift");
      executionStarted = performance.now();
      full = await runJest(
        root,
        admission,
        independent.tests,
        join(destination, "full"),
      );
      timings.fullExecutionMs = performance.now() - executionStarted;
      assertInputs();
      agreement = compareOutcomes(selected, full);
    }
  } catch (error) {
    incomplete = error.message;
  }
  timings.executionMs = performance.now() - started;
  timings.totalMs = (timings.planningMs ?? 0) + timings.executionMs;
  const result = {
    ...report,
    executed: selected !== null,
    requestedMode: shadow ? "shadow" : "execute",
    actualMode: full
      ? "shadow"
      : report.mode === "selected"
        ? "selected"
        : "full-fallback",
    selectedRun: selected,
    fullRun: full,
    agreement,
    incomplete,
    evidenceDirectory: destination,
    success:
      !incomplete &&
      selected?.success === true &&
      (!full || (full.success && agreement.equal)),
    timings,
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
    let output;
    const args = process.argv.slice(2);
    for (let index = 0; index < args.length; index++) {
      const arg = args[index];
      if (arg === "--list" && !list) list = true;
      else if (arg === "--shadow" && !shadow) shadow = true;
      else if (
        ["--base", "--path", "--output"].includes(arg) &&
        args[index + 1] &&
        !args[index + 1].startsWith("--")
      ) {
        const value = args[++index];
        if (arg === "--path") options.paths.push(value);
        else if (arg === "--output" && !output) {
          if (!isAbsolute(value))
            throw new Error("Result directory must be absolute");
          output = value;
        } else if (arg === "--base" && !options.base) options.base = value;
        else throw new Error("Duplicate argument: " + arg);
      } else
        throw new Error(
          "Usage: check:affected -- [--base <full commit>] [--path <literal>] [--list | --shadow] [--output <new external directory>]",
        );
    }
    if (list && shadow) throw new Error("List and shadow modes are exclusive");
    if (list && output)
      throw new Error("List mode does not write execution results");
    const plan = await planAffected(options);
    const result = list ? plan : await executePlan(plan, { shadow, output });
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
    if (!list && !result.success) process.exitCode = 1;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 2;
  }
}
