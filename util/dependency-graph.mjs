// SPDX-License-Identifier: AGPL-3.0-only
// Native API composition informed by markdown-quality at 0fac1db72856c7579625562c4a145f0801b2fb80.
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  lstatSync,
  realpathSync,
  readFileSync,
  openSync,
  readSync,
  closeSync,
  fstatSync,
  readdirSync,
  mkdirSync,
  mkdtempSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import {
  delimiter,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from "node:path";
import { fileURLToPath } from "node:url";

const self = fileURLToPath(import.meta.url);
export const repositoryRoot = resolve(dirname(self), "..");
export const limits = Object.freeze({
  entries: 8192,
  sources: 4096,
  fileBytes: 8 * 1024 * 1024,
  sourceBytes: 64 * 1024 * 1024,
  graphBytes: 16 * 1024 * 1024,
  analysisMs: 30000,
  discoveryMs: 120000,
  testMs: 600000,
  resultBytes: 64 * 1024 * 1024,
  cleanupMs: 5000,
});
export const sha256 = (bytes) =>
  createHash("sha256").update(bytes).digest("hex");
export const escapePattern = (text) =>
  text.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
export const isJavaScript = (path) => /\.[cm]?js$/u.test(path);
export const isInside = (root, path) => {
  const value = relative(root, path);
  return !isAbsolute(value) && value !== ".." && !value.startsWith(`..${sep}`);
};
const vendorDirectories = [
  join(repositoryRoot, "packages/vowl/node_modules"),
  join(repositoryRoot, "node_modules"),
].filter(existsSync);

export function safePath(path) {
  if (
    typeof path !== "string" ||
    !path ||
    path.length > 1024 ||
    path.startsWith("-") ||
    path.includes("\\") ||
    /[\p{Cc}\p{Cs}]/u.test(path) ||
    isAbsolute(path) ||
    path
      .split("/")
      .some(
        (part) =>
          !part ||
          part === "." ||
          part === ".." ||
          /[:*?"<>|]/u.test(part) ||
          /[. ]$/u.test(part) ||
          /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu.test(part),
      )
  )
    throw new Error("Unsafe repository path");
  return path;
}

export function readOwned(root, path, maximum = limits.fileBytes) {
  safePath(path);
  let target = root;
  if (lstatSync(root).isSymbolicLink()) throw new Error("Linked root");
  for (const part of path.split("/")) {
    target = join(target, part);
    if (lstatSync(target).isSymbolicLink())
      throw new Error(`Linked input:${path}`);
  }
  const info = lstatSync(target);
  if (
    !info.isFile() ||
    info.size > maximum ||
    !isInside(realpathSync(root), realpathSync(target))
  )
    throw new Error(`Unsafe or oversized input:${path}`);
  return readFileSync(target);
}

// Non-source assets can be large. Hash them in fixed storage instead of buffering them.
function hashOwned(root, path) {
  safePath(path);
  let target = root;
  for (const part of ["", ...path.split("/")]) {
    target = join(target, part);
    if (lstatSync(target).isSymbolicLink())
      throw new Error(`Linked input:${path}`);
  }
  if (!isInside(realpathSync(root), realpathSync(target)))
    throw new Error(`Escaped input:${path}`);
  const descriptor = openSync(target, "r");
  try {
    const before = fstatSync(descriptor);
    if (!before.isFile()) throw new Error(`Non-file input:${path}`);
    const hash = createHash("sha256"),
      buffer = Buffer.alloc(65536);
    let size;
    while ((size = readSync(descriptor, buffer, 0, buffer.length, null)))
      hash.update(buffer.subarray(0, size));
    const after = fstatSync(descriptor);
    if (
      before.size !== after.size ||
      before.mtimeMs !== after.mtimeMs ||
      before.ctimeMs !== after.ctimeMs
    )
      throw new Error("Input changed during capture");
    return hash.digest("hex");
  } finally {
    closeSync(descriptor);
  }
}

const gitExecutable = (process.env.PATH ?? process.env.Path ?? "")
  .split(delimiter)
  .filter(isAbsolute)
  .map((path) => join(path, process.platform === "win32" ? "git.exe" : "git"))
  .find(
    (path) =>
      existsSync(path) &&
      lstatSync(path).isFile() &&
      !isInside(repositoryRoot, realpathSync(path)),
  );
export function git(root, args, binary = false, options = {}) {
  if (!gitExecutable) throw new Error("Host Git unavailable");
  const result = spawnSync(
    gitExecutable,
    ["--no-pager", "--no-optional-locks", ...args],
    {
      cwd: root,
      encoding: binary ? undefined : "utf8",
      timeout: 10000,
      maxBuffer: options.maxBuffer ?? limits.graphBytes,
      input: options.input,
      windowsHide: true,
      env: {
        ...Object.fromEntries(
          Object.entries(process.env).filter(
            ([key]) => !key.toUpperCase().startsWith("GIT_"),
          ),
        ),
        GIT_NO_LAZY_FETCH: "1",
        GIT_TERMINAL_PROMPT: "0",
      },
    },
  );
  if (result.error || result.status !== 0)
    throw new Error(`Git observation unavailable:${args[0]}`);
  return result.stdout;
}
export const nulRecords = (bytes) =>
  new TextDecoder("utf-8", { fatal: true })
    .decode(bytes)
    .split("\0")
    .filter(Boolean);

export function authoredRole(path) {
  if (
    path.split("/").includes("node_modules") ||
    /^(?:deploy|\.venv|\.sdlc)\//u.test(path)
  )
    return "excluded";
  if (/^\.dependency-cruiser\.[cm]?js$/u.test(path)) return "control";
  if (path === "eslint.config.js" || path === "vite.config.mjs")
    return "control";
  if (/^docs\/owlapi-js\/conformance\/upstream\/vowl-2\/data\//u.test(path))
    return "vendored-resource";
  if (/^(?:src|util|tests|tooling|packages\/vowl)\//u.test(path))
    return "authored";
  if (isJavaScript(path)) return "unknown";
  return "resource";
}

/** Git is authoritative for repository records; ignored source files are separately inventoried. */
export function sourcePaths(root) {
  const files = [];
  let entries = 0;
  const visit = (folder) => {
    if (!existsSync(join(root, folder))) return;
    if (lstatSync(join(root, folder)).isSymbolicLink())
      throw new Error("Linked source directory");
    for (const entry of readdirSync(join(root, folder), {
      withFileTypes: true,
    })) {
      if (++entries > limits.entries)
        throw new Error("Source directory budget exceeded");
      const path = safePath(`${folder}/${entry.name}`);
      if (entry.isSymbolicLink()) throw new Error(`Linked source:${path}`);
      if (entry.isDirectory()) {
        if (
          !["node_modules", ".venv", "__pycache__", ".git"].includes(entry.name)
        )
          visit(path);
      } else if (isJavaScript(path)) files.push(path);
    }
  };
  for (const folder of ["src", "util", "tests", "tooling", "packages/vowl"])
    visit(folder);
  for (const path of ["eslint.config.js", "vite.config.mjs"])
    if (existsSync(join(root, path))) files.push(path);
  if (!files.length || files.length > limits.sources)
    throw new Error("Authored source budget or empty inventory");
  return files.sort();
}

export function snapshot(root) {
  root = resolve(root);
  if (
    realpathSync(root) !==
    realpathSync(git(root, ["rev-parse", "--show-toplevel"]).trim())
  )
    throw new Error("Wrong repository root");
  const paths = [
    ...new Set([
      ...nulRecords(
        git(
          root,
          ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
          true,
        ),
      ),
      ...sourcePaths(root),
    ]),
  ].sort();
  if (paths.length > limits.entries)
    throw new Error("Repository inventory budget exceeded");
  const folded = new Set();
  const files = paths.map((path) => {
    safePath(path);
    if (folded.has(path.toLowerCase()))
      throw new Error("Case-ambiguous inventory");
    folded.add(path.toLowerCase());
    try {
      return {
        path,
        sha256: hashOwned(root, path),
      };
    } catch (error) {
      if (error.code === "ENOENT") return { path, sha256: null };
      throw error;
    }
  });
  return {
    head: git(root, ["rev-parse", "HEAD"]).trim(),
    tree: git(root, ["rev-parse", "HEAD^{tree}"]).trim(),
    index: sha256(git(root, ["ls-files", "--stage", "-z"], true)),
    files,
    digest: sha256(JSON.stringify(files)),
  };
}
export function assertUnchanged(root, before) {
  if (JSON.stringify(before) !== JSON.stringify(snapshot(root)))
    throw new Error("Candidate input drift");
}

function admittedGraphConfig(root) {
  const config = JSON.parse(readOwned(root, ".dependency-cruiser.json"));
  if (
    !config.options ||
    Object.keys(config).some(
      (key) => !["forbidden", "options"].includes(key),
    ) ||
    Object.keys(config.options).some(
      (key) =>
        !["doNotFollow", "moduleSystems", "preserveSymlinks"].includes(key),
    )
  )
    throw new Error("Executable or unsupported graph configuration");
  return config;
}

/** The worker imports only the installed analyzer, never the captured candidate. */
export function captureGraph(
  root,
  controls = root,
  vendors = vendorDirectories,
) {
  root = resolve(root);
  const roots = sourcePaths(root);
  let bytes = 0;
  for (const path of roots) {
    const content = readOwned(root, path);
    new TextDecoder("utf-8", { fatal: true }).decode(content);
    bytes += content.length;
    if (bytes > limits.sourceBytes)
      throw new Error("Aggregate source budget exceeded");
  }
  const unknown = nulRecords(
    git(
      controls,
      ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
      true,
    ),
  ).filter((path) => authoredRole(path) === "unknown");
  if (unknown.length)
    throw new Error(`Unclassified authored root:${unknown[0]}`);
  const workspace = JSON.parse(readOwned(root, "packages/vowl/package.json"));
  if (
    workspace.name !== "vowl" ||
    Object.keys(workspace.exports ?? {})
      .sort()
      .join(",") !== ".,./migrate,./owl" ||
    Object.values(workspace.exports ?? {}).some(
      (value) =>
        typeof value !== "string" ||
        !value.startsWith("./src/") ||
        (() => {
          try {
            safePath(value.slice(2));
            return false;
          } catch {
            return true;
          }
        })(),
    )
  )
    throw new Error("Unproved workspace exports");
  const child = spawnSync(
    process.execPath,
    ["--max-old-space-size=256", self, "--capture-worker"],
    {
      cwd: root,
      input: JSON.stringify({
        root,
        roots,
        config: admittedGraphConfig(controls),
        vendors,
      }),
      encoding: "utf8",
      windowsHide: true,
      timeout: limits.analysisMs,
      maxBuffer: limits.graphBytes,
      env: { ...process.env, NODE_OPTIONS: "", NODE_PATH: "" },
    },
  );
  if (child.error || child.status !== 0)
    throw new Error(
      `Graph capture failed:${child.error?.code ?? child.stderr.slice(0, 1500)}`,
    );
  const graph = JSON.parse(child.stdout);
  const records = new Set(graph.modules.map((module) => module.source));
  if (
    records.size !== graph.modules.length ||
    roots.some((path) => !records.has(path))
  )
    throw new Error("Incomplete or duplicate native graph inventory");
  for (const module of graph.modules) {
    const externalVendor = (path) =>
      vendors.some((directory) =>
        isInside(realpathSync(directory), resolve(root, path)),
      );
    if (
      !module.couldNotResolve &&
      (isAbsolute(module.source) || module.source.startsWith("../")) &&
      !externalVendor(module.source)
    )
      throw new Error(`Graph escaped snapshot:${module.source}`);
    for (const dependency of module.dependencies) {
      if (
        dependency.module?.match(/^vowl(?:\/|$)/u) &&
        !dependency.resolved.startsWith("packages/vowl/")
      )
        throw new Error("Current workspace contaminated snapshot");
      if (
        !dependency.coreModule &&
        !dependency.couldNotResolve &&
        (isAbsolute(dependency.resolved) ||
          dependency.resolved.startsWith("../")) &&
        !externalVendor(dependency.resolved)
      )
        throw new Error("Resolved dependency escaped snapshot");
    }
  }
  return graph;
}

export async function nativeReach(graph, seeds) {
  if (!seeds.length || seeds.length > limits.sources)
    throw new Error("Native reachability seed budget");
  const { format } = await import("dependency-cruiser");
  const result = await format(graph, {
    outputType: "json",
    reaches: `^(?:${seeds.map((path) => escapePattern(safePath(path))).join("|")})$`,
  });
  return JSON.parse(result.output);
}

/** Reserve the exact destination exclusively, including against competing callers. */
export function reserveOutput(root, output) {
  output = resolve(output);
  if (isInside(realpathSync(root), output))
    throw new Error("Output must be external");
  let ancestor = dirname(output);
  while (!existsSync(ancestor)) ancestor = dirname(ancestor);
  let cursor = ancestor;
  while (dirname(cursor) !== cursor) {
    if (lstatSync(cursor).isSymbolicLink())
      throw new Error("Linked output parent");
    cursor = dirname(cursor);
  }
  if (
    isInside(
      realpathSync(root),
      resolve(realpathSync(ancestor), relative(ancestor, output)),
    )
  )
    throw new Error("Output redirects into checkout");
  mkdirSync(dirname(output), { recursive: true });
  mkdirSync(output); // No overwrite, including an empty existing destination or a competing writer.
  return output;
}

export async function writeBundle(root, output) {
  const before = snapshot(root);
  const graph = captureGraph(root);
  const { format } = await import("dependency-cruiser");
  const graphBytes = JSON.stringify(graph, null, 2) + "\n";
  const graphDigest = sha256(graphBytes);
  const files = {
    "graph.json": graphBytes,
    "policy-findings.json":
      JSON.stringify(graph.summary.violations, null, 2) + "\n",
    "declared-relations.json": readOwned(root, ".test-impact.json").toString(
      "utf8",
    ),
  };
  for (const [name, filter] of Object.entries({
    overview: {},
    runtime: { includeOnly: "^(src/|packages/vowl/src/)" },
    tests: { focus: "(?:\\.(?:test|spec)\\.[cm]?js$|/test/)" },
  }))
    files[`${name}.mmd`] =
      `%% Node/import context; graph sha256 ${graphDigest}\n${(await format(graph, { outputType: "mermaid", ...filter })).output}`;
  assertUnchanged(root, before);
  output = reserveOutput(root, output);
  const staging = mkdtempSync(join(output, ".incomplete-"));
  for (const [path, content] of Object.entries(files))
    writeFileSync(join(staging, path), content, { flag: "wx" });
  assertUnchanged(root, before);
  writeFileSync(
    join(staging, "provenance.json"),
    JSON.stringify(
      {
        schemaVersion: 1,
        complete: true,
        context:
          "node/import; browser transformations and declared relations are separate",
        candidate: before,
        runtime: process.version,
        platform: process.platform,
        analyzer: JSON.parse(
          readFileSync(
            join(
              repositoryRoot,
              "node_modules/dependency-cruiser/package.json",
            ),
          ),
        ).version,
        graphDigest,
        files: Object.fromEntries(
          Object.entries(files).map(([path, content]) => [
            path,
            sha256(content),
          ]),
        ),
        configDigest: sha256(readOwned(root, ".dependency-cruiser.json")),
        lockDigest: sha256(readOwned(root, "package-lock.json")),
      },
      null,
      2,
    ) + "\n",
    { flag: "wx" },
  );
  // The exclusively owned parent keeps publication separate from destination reservation.
  // Readers see either no bundle or the whole validated directory, on the same filesystem.
  assertUnchanged(root, before);
  renameSync(staging, join(output, "bundle"));
  return graph;
}

async function captureWorker() {
  const request = JSON.parse(readFileSync(0, "utf8"));
  const { cruise, format } = await import("dependency-cruiser");
  const allowedRoots = [request.root, ...request.vendors].map((path) =>
    escapePattern(path.replaceAll("\\", "/")).replaceAll("/", "[\\\\/]"),
  );
  const result = await cruise(
    request.roots,
    {
      ...request.config.options,
      validate: true,
      ruleSet: { forbidden: request.config.forbidden },
      outputType: "json",
    },
    {
      modules: [join(request.root, "packages"), ...request.vendors],
      restrictions: [new RegExp(`^(?:${allowedRoots.join("|")})(?:[\\\\/]|$)`)],
      exportsFields: ["exports"],
      conditionNames: ["node", "import", "default"],
      extensions: [".js", ".mjs", ".cjs", ".json"],
      symlinks: true,
    },
    {},
  );
  const graph = JSON.parse(result.output);
  await format(graph, { outputType: "json" });
  process.stdout.write(JSON.stringify(graph));
}

if (process.argv[1] && resolve(process.argv[1]) === self) {
  try {
    if (process.argv[2] === "--capture-worker" && process.argv.length === 3)
      await captureWorker();
    else {
      if (process.argv.length !== 4 || process.argv[2] !== "--output")
        throw new Error(
          "Usage: graph:dependencies -- --output <new external directory>",
        );
      const graph = await writeBundle(repositoryRoot, process.argv[3]);
      process.stdout.write(
        `Captured ${graph.modules.length} modules; ${graph.summary.violations.length} native findings\n`,
      );
      if (
        graph.summary.violations.some(
          (finding) => finding.rule.severity === "error",
        )
      )
        process.exitCode = 1;
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 2;
  }
}
