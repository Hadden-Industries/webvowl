// SPDX-License-Identifier: AGPL-3.0-only
import { posix } from "node:path";
import { fileURLToPath } from "node:url";
import { Linter } from "eslint";
import { LineCounter, parseDocument } from "yaml";

const repositoryUrl = new URL("file:///webvowl-repository/");
const browserHarnesses = new Set([
  "util/compareOwl2VowlPerformance.mjs",
  "util/qualify-ontology-cache-browser.mjs",
  "util/uiPresentationFixtures.mjs",
]);
const reads = new Set([
  "readFile",
  "readFileSync",
  "createReadStream",
  "access",
  "accessSync",
  "existsSync",
  "stat",
  "statSync",
  "lstat",
  "lstatSync",
  "open",
  "openSync",
  "readdir",
  "readdirSync",
]);
const writes = new Set([
  "writeFile",
  "writeFileSync",
  "appendFile",
  "appendFileSync",
  "createWriteStream",
]);
const launches = new Set([
  "exec",
  "execFile",
  "execSync",
  "execFileSync",
  "fork",
  "spawn",
  "spawnSync",
]);
const valueOf = (node) => (node?.type === "Literal" ? node.value : undefined);
const memberName = (node) =>
  node?.computed ? valueOf(node.property) : node?.property?.name;
const property = (node, name) =>
  node?.type === "ObjectExpression"
    ? node.properties.find(
        (item) =>
          item.type === "Property" &&
          (item.computed
            ? valueOf(item.key)
            : (item.key.name ?? valueOf(item.key))) === name,
      )?.value
    : undefined;

function definition(sourceCode, node) {
  if (node?.type !== "Identifier") return undefined;
  for (let scope = sourceCode.getScope(node); scope; scope = scope.upper) {
    const binding = scope.set.get(node.name);
    if (binding) return binding.defs.length === 1 ? binding.defs[0] : undefined;
  }
}

function imported(sourceCode, node, trail = new Set()) {
  if (!node || trail.has(node) || trail.size >= 32) return undefined;
  const next = new Set([...trail, node]);
  if (
    node.type === "CallExpression" &&
    node.callee.name === "require" &&
    !definition(sourceCode, node.callee) &&
    typeof valueOf(node.arguments[0]) === "string"
  ) {
    return {
      module: valueOf(node.arguments[0]).replace(/^node:/u, ""),
      name: "*",
    };
  }
  if (node?.type === "MemberExpression") {
    const binding = imported(sourceCode, node.object, next);
    if (binding?.name === "promises" || binding?.name === "*")
      return { ...binding, name: memberName(node) };
    return undefined;
  }
  const binding = definition(sourceCode, node);
  if (binding?.type === "ImportBinding") {
    return {
      module: binding.parent.source.value.replace(/^node:/u, ""),
      name:
        binding.node.type === "ImportSpecifier"
          ? (binding.node.imported.name ?? binding.node.imported.value)
          : "*",
    };
  }
  if (binding?.type === "Variable" && binding.parent.kind === "const") {
    const source = imported(sourceCode, binding.node.init, next);
    if (!source || binding.node.id.type !== "ObjectPattern") return source;
    const member = binding.node.id.properties.find(
      (item) => item.type === "Property" && item.value.name === node.name,
    );
    if (member)
      return { ...source, name: member.key.name ?? valueOf(member.key) };
  }
}

function literalValue(sourceCode, moduleUrl, node, trail = new Set()) {
  if (!node || trail.has(node) || trail.size >= 32) return undefined;
  const next = new Set([...trail, node]);
  const evaluate = (child) => literalValue(sourceCode, moduleUrl, child, next);
  if (node.type === "Literal" && typeof node.value === "string")
    return node.value;
  if (node.type === "TemplateLiteral" && node.expressions.length === 0)
    return node.quasis[0].value.cooked;
  if (node.type === "Identifier") {
    const binding = definition(sourceCode, node);
    if (binding?.type === "Variable" && binding.parent.kind === "const")
      return evaluate(binding.node.init);
  }
  if (
    node.type === "MemberExpression" &&
    memberName(node) === "url" &&
    node.object.type === "MetaProperty" &&
    node.object.meta.name === "import"
  )
    return moduleUrl;
  if (node.type === "BinaryExpression" && node.operator === "+") {
    const left = evaluate(node.left),
      right = evaluate(node.right);
    if (typeof left === "string" && typeof right === "string")
      return left + right;
  }
  if (
    node.type === "NewExpression" &&
    node.callee.type === "Identifier" &&
    node.callee.name === "URL" &&
    !definition(sourceCode, node.callee)
  ) {
    const name = evaluate(node.arguments[0]);
    const base = evaluate(node.arguments[1]);
    if (
      typeof name !== "string" ||
      (node.arguments.length > 1 && base === undefined)
    )
      return undefined;
    try {
      return new URL(name, base);
    } catch {
      return undefined;
    }
  }
  if (node.type === "CallExpression") {
    const call = imported(sourceCode, node.callee);
    const args = node.arguments.map(evaluate);
    if (
      call?.module === "url" &&
      call.name === "fileURLToPath" &&
      args[0] instanceof URL
    ) {
      try {
        return fileURLToPath(args[0], { windows: false });
      } catch {
        return undefined;
      }
    }
    if (
      ["path", "path/posix"].includes(call?.module) &&
      args.length &&
      args.every((arg) => typeof arg === "string")
    ) {
      if (call.name === "join") return posix.join(...args);
      if (call.name === "resolve")
        return posix.resolve(repositoryUrl.pathname, ...args);
      if (call.name === "dirname" && args.length === 1)
        return posix.dirname(args[0]);
    }
  }
}

function localPath(value, validatePath) {
  try {
    if (value instanceof URL) {
      if (value.host || value.search || value.hash) return undefined;
      value = fileURLToPath(value, { windows: false });
    }
    if (
      typeof value !== "string" ||
      !value ||
      value.includes("\\") ||
      value.includes(":")
    )
      return undefined;
    const relative = posix.normalize(value);
    if (relative === ".." || relative.startsWith("../")) return undefined;
    const path = value.startsWith("/")
      ? relative
      : posix.join(repositoryUrl.pathname, relative);
    if (path.startsWith(repositoryUrl.pathname))
      return validatePath(
        path.slice(repositoryUrl.pathname.length).replace(/\/$/u, ""),
      );
  } catch {
    // The path vocabulary or native URL consumer refused this expression.
  }
}

function inBrowserEvaluation(sourceCode, source, node) {
  for (let child = node; child.parent; child = child.parent) {
    const call = child.parent;
    if (
      ["ArrowFunctionExpression", "FunctionExpression"].includes(child.type) &&
      call.type === "CallExpression" &&
      call.arguments[0] === child &&
      call.callee.type === "MemberExpression" &&
      memberName(call.callee) === "evaluate" &&
      call.callee.object.type === "Identifier" &&
      call.callee.object.name === "page"
    ) {
      const binding = definition(sourceCode, call.callee.object);
      if (source === "util/uiPresentationFixtures.mjs") {
        // qualify-ui-browser supplies the Page to this exported fixture.
        return (
          binding?.type === "Parameter" &&
          binding.node.id?.name === "qualifyPresentationFixtures"
        );
      }
      const init = binding?.node?.init;
      return (
        binding?.parent?.kind === "const" &&
        init?.type === "AwaitExpression" &&
        init.argument.type === "CallExpression" &&
        memberName(init.argument.callee) === "newPage"
      );
    }
  }
  return false;
}

/** Observe only supported source expressions. Evidence describes syntax and context, never a file operation performed by the analyzer. */
export function observeFileDependencies(
  sources,
  readSource,
  ownedPaths,
  { validatePath, indexHtml },
) {
  const linter = new Linter();
  const edges = [],
    diagnostics = [],
    browserResolutions = new Set();
  const paths = new Set(ownedPaths);
  let viteRoot;
  const assetTargets = [];
  const orderedSources = [...sources].sort(
    (a, b) =>
      Number(b === "vite.config.mjs") - Number(a === "vite.config.mjs") ||
      a.localeCompare(b),
  );
  for (const source of orderedSources) {
    const rootImports = new Map();
    const moduleUrl = new URL(
      source.split("/").map(encodeURIComponent).join("/"),
      repositoryUrl,
    );
    const evidence = (node, context) => ({
      source,
      line: node?.loc.start.line ?? 1,
      column: (node?.loc.start.column ?? 0) + 1,
      context,
      origin: "source",
    });
    const diagnostic = (node, kind, reason, target) =>
      diagnostics.push({
        ...evidence(node, "source"),
        kind,
        reason,
        ...(target ? { target } : {}),
      });
    const edge = (node, from, to, kind, context) =>
      edges.push({ from, to, kind, evidence: [evidence(node, context)] });
    const messages = linter.verify(
      readSource(source),
      {
        languageOptions: {
          ecmaVersion: "latest",
          sourceType: source.endsWith(".cjs") ? "commonjs" : "module",
        },
        plugins: {
          observation: {
            rules: {
              files: {
                create({ sourceCode }) {
                  const evaluate = (node) =>
                    literalValue(sourceCode, moduleUrl, node);
                  const targetPath = (node) =>
                    localPath(evaluate(node), validatePath);
                  const observeRead = (call, argument) => {
                    const target = targetPath(argument);
                    if (paths.has(target))
                      edge(call, source, target, "reads-file", "node");
                    else if (target?.startsWith("deploy/"))
                      edge(
                        call,
                        source,
                        "artifact:repository:" + target,
                        "reads-file",
                        "node",
                      );
                    else
                      diagnostic(
                        call,
                        "file-read",
                        "unresolved local file input",
                        target,
                      );
                  };
                  const observeWrite = (call, argument) => {
                    const target = targetPath(argument);
                    if (paths.has(target))
                      edge(call, target, source, "generated-by", "node");
                    else if (target?.startsWith("deploy/"))
                      edge(
                        call,
                        "artifact:repository:" + target,
                        source,
                        "generated-by",
                        "node",
                      );
                    else
                      diagnostic(
                        call,
                        "file-write",
                        "unresolved output",
                        target,
                      );
                  };
                  const observeRootSpecifier = (node, name) => {
                    if (
                      !browserHarnesses.has(source) ||
                      typeof name !== "string" ||
                      !name.startsWith("/")
                    )
                      return;
                    const target =
                      viteRoot &&
                      node.parent.type === "ImportExpression" &&
                      node.parent.source === node &&
                      inBrowserEvaluation(sourceCode, source, node)
                        ? localPath(viteRoot + name, validatePath)
                        : undefined;
                    const observed = Boolean(
                      target?.startsWith(viteRoot + "/") && paths.has(target),
                    );
                    rootImports.set(
                      name,
                      (rootImports.get(name) ?? true) && observed,
                    );
                    if (observed)
                      edge(
                        node,
                        source,
                        target,
                        "browser-import",
                        "vite-client",
                      );
                  };
                  return {
                    Literal(node) {
                      observeRootSpecifier(node, valueOf(node));
                    },
                    TemplateLiteral(node) {
                      if (node.expressions.length === 0)
                        observeRootSpecifier(node, node.quasis[0].value.cooked);
                    },
                    ImportExpression(node) {
                      if (typeof valueOf(node.source) !== "string")
                        diagnostic(
                          node,
                          "dynamic-import",
                          "computed module input",
                        );
                    },
                    CallExpression(node) {
                      const call = imported(sourceCode, node.callee);
                      const [first, second] = node.arguments;
                      if (
                        call?.module === "fs" ||
                        call?.module === "fs/promises"
                      ) {
                        if (!call.name || call.name === "*")
                          diagnostic(
                            node,
                            "file-read",
                            "computed filesystem operation",
                          );
                        if (reads.has(call.name)) observeRead(node, first);
                        if (writes.has(call.name)) observeWrite(node, first);
                        if (["copyFile", "copyFileSync"].includes(call.name)) {
                          observeRead(node, first);
                          observeWrite(node, second);
                        }
                      }
                      if (
                        call?.module === "child_process" &&
                        launches.has(call.name)
                      ) {
                        const entry =
                          call.name === "fork"
                            ? first
                            : first?.type === "MemberExpression" &&
                                first.object.name === "process" &&
                                memberName(first) === "execPath" &&
                                second?.type === "ArrayExpression"
                              ? second.elements[0]
                              : undefined;
                        const target = targetPath(entry);
                        if (paths.has(target))
                          edge(node, source, target, "process-entry", "node");
                        else
                          diagnostic(
                            node,
                            "process",
                            "opaque subprocess arguments",
                          );
                      }
                      if (
                        node.callee.type === "Identifier" &&
                        node.callee.name === "require" &&
                        !definition(sourceCode, node.callee)
                      ) {
                        if (typeof valueOf(first) !== "string")
                          diagnostic(
                            node,
                            "dynamic-import",
                            "computed CommonJS input",
                          );
                      }
                      if (source === "vite.config.mjs") {
                        if (
                          call?.module === "vite" &&
                          call.name === "defineConfig" &&
                          first?.body?.type === "BlockStatement"
                        ) {
                          const roots = first.body.body
                            .filter(
                              (statement) =>
                                statement.type === "ReturnStatement",
                            )
                            .map((statement) =>
                              valueOf(property(statement.argument, "root")),
                            );
                          if (
                            roots.length === 1 &&
                            typeof roots[0] === "string"
                          )
                            viteRoot = localPath(roots[0], validatePath);
                        }
                        if (
                          call?.module === "vite-plugin-static-copy" &&
                          call.name === "viteStaticCopy"
                        ) {
                          const targets = property(first, "targets");
                          if (targets?.type === "ArrayExpression")
                            for (const target of targets.elements)
                              assetTargets.push({
                                source: valueOf(property(target, "src")),
                                dest: valueOf(property(target, "dest")),
                                name: valueOf(
                                  property(property(target, "rename"), "name"),
                                ),
                                evidence: evidence(target, "vite-build"),
                              });
                        }
                      }
                    },
                    NewExpression(node) {
                      const call = imported(sourceCode, node.callee);
                      const browser =
                        ["Worker", "SharedWorker"].includes(node.callee.name) &&
                        !definition(sourceCode, node.callee);
                      if (
                        !browser &&
                        !(
                          call?.module === "worker_threads" &&
                          call.name === "Worker"
                        )
                      )
                        return;
                      const target = targetPath(node.arguments[0]);
                      if (paths.has(target))
                        edge(
                          node,
                          source,
                          target,
                          "worker-entry",
                          browser ? "vite-client" : "node",
                        );
                      else
                        diagnostic(
                          node,
                          "worker",
                          "computed worker entry",
                          target,
                        );
                    },
                  };
                },
              },
            },
          },
        },
        rules: { "observation/files": "error" },
      },
      { filename: source },
    );
    for (const message of messages.filter((item) => item.fatal))
      diagnostics.push({
        source,
        line: message.line,
        column: message.column,
        context: "source",
        origin: "source",
        kind: "parse",
        reason: "source could not be inspected",
      });
    for (const [name, resolved] of rootImports) {
      if (!resolved) continue;
      // json-identity-contract: ordered-tuple; owner: Browser import resolution; reason: The pair is an ordered source and specifier with no record key ordering.
      const identity = JSON.stringify([source, name]);
      browserResolutions.add(identity);
    }
  }
  if (viteRoot)
    appendBuildRelationships(
      viteRoot,
      assetTargets,
      paths,
      edges,
      diagnostics,
      validatePath,
      indexHtml,
    );
  return { edges, diagnostics, browserResolutions };
}

function appendBuildRelationships(
  root,
  targets,
  paths,
  edges,
  diagnostics,
  validatePath,
  indexHtml,
) {
  const producer = "check:npm:build:bundle";
  const entry = root + "/index.html";
  if (paths.has(entry)) {
    edges.push({
      from: producer,
      to: entry,
      kind: "build-input",
      evidence: [
        { source: "vite.config.mjs", context: "vite-build", origin: "source" },
      ],
    });
    for (const link of indexHtml?.(entry) ?? []) {
      if (
        typeof link.path !== "string" ||
        /^(?:[a-z][a-z\d+.-]*:|\/\/)/iu.test(link.path)
      )
        continue;
      const target = localPath(
        link.path.startsWith("/") ? root + link.path : root + "/" + link.path,
        validatePath,
      );
      if (paths.has(target))
        edges.push({
          from: entry,
          to: target,
          kind: "html-asset",
          evidence: [
            {
              source: entry,
              line: link.line,
              context: "vite-client",
              origin: "source",
            },
          ],
        });
    }
  }
  for (const target of targets) {
    const glob =
      typeof target.source === "string" && target.source.endsWith("/*");
    const pattern =
      typeof target.source === "string" &&
      localPath(
        root + "/" + (glob ? target.source.slice(0, -2) : target.source),
        validatePath,
      );
    if (!pattern || typeof target.dest !== "string") {
      diagnostics.push({
        ...target.evidence,
        kind: "vite-copy",
        reason: "computed copy source or destination",
      });
      continue;
    }
    for (const path of paths) {
      if (glob ? posix.dirname(path) !== pattern : path !== pattern) continue;
      const output = localPath(
        posix.join("deploy", target.dest, target.name ?? posix.basename(path)),
        validatePath,
      );
      if (!output?.startsWith("deploy/")) continue;
      const artifact = "artifact:vite:production:" + output;
      const evidence = [{ ...target.evidence, origin: "declared" }];
      edges.push({ from: artifact, to: path, kind: "copy-input", evidence });
      edges.push({
        from: artifact,
        to: producer,
        kind: "generated-by",
        evidence,
      });
      edges.push({ from: producer, to: path, kind: "build-input", evidence });
      if (
        output.startsWith("deploy/data/") &&
        output.endsWith(".json") &&
        paths.has("util/verifyGeneratedRepositoryJson.mjs")
      ) {
        const consumer = "util/verifyGeneratedRepositoryJson.mjs";
        edges.push({
          from: consumer,
          to: artifact,
          kind: "reads-file",
          evidence: [
            {
              source: "util/runRepositoryJsonQuality.mjs",
              context: "post-build-json",
              origin: "declared",
            },
          ],
        });
        edges.push({
          from: "check:node:" + consumer,
          to: consumer,
          kind: "process-entry",
          evidence: [
            {
              source: "package.json",
              context: "repository-check",
              origin: "declared",
            },
          ],
        });
      }
    }
  }
}

/** Read literal workflow output declarations without running or interpolating a step. */
export function observeWorkflowFiles(source, text, validatePath) {
  const edges = [],
    diagnostics = [];
  const lineCounter = new LineCounter();
  const document = parseDocument(text, { lineCounter, uniqueKeys: true });
  let jobs;
  try {
    if (document.errors.length) throw new Error("invalid workflow document");
    jobs = document.toJS({ maxAliasCount: 0 })?.jobs;
  } catch {
    return {
      edges,
      diagnostics: [
        {
          source,
          kind: "workflow",
          reason: "workflow data could not be inspected",
        },
      ],
    };
  }
  for (const [job, definition] of Object.entries(jobs ?? {})) {
    for (const [index, step] of (Array.isArray(definition?.steps)
      ? definition.steps
      : []
    ).entries()) {
      if (
        typeof step?.uses !== "string" ||
        !step.uses.startsWith("actions/upload-artifact@")
      )
        continue;
      const field = document.getIn(
        ["jobs", job, "steps", index, "with", "path"],
        true,
      );
      const line = field?.range && lineCounter.linePos(field.range[0]).line;
      const evidence = {
        source,
        line,
        context: "workflow:" + job,
        origin: "declared",
      };
      const value = step.with?.path;
      if (typeof value !== "string" || /[\n\r*{}$!]/u.test(value)) {
        diagnostics.push({
          ...evidence,
          kind: "workflow-artifact",
          reason: "computed upload path",
        });
        continue;
      }
      const target = localPath(value, validatePath);
      if (!target) {
        diagnostics.push({
          ...evidence,
          kind: "workflow-artifact",
          reason: "upload path outside admitted workspace vocabulary",
        });
        continue;
      }
      const artifact = "artifact:workflow:" + source + ":" + job + ":" + target;
      edges.push({
        from: "check:workflow:" + source + ":" + job,
        to: artifact,
        kind: "uploads-artifact",
        evidence: [evidence],
      });
    }
  }
  return { edges, diagnostics };
}
