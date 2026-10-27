import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { lstatSync, readFileSync, readdirSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
import { Linter } from "eslint";

export const sha256 = (bytes) =>
  createHash("sha256").update(bytes).digest("hex");

function staticString(node) {
  if (node?.type === "Literal" && typeof node.value === "string")
    return node.value;
  if (node?.type === "TemplateLiteral" && node.expressions.length === 0)
    return node.quasis[0].value.cooked;
  return undefined;
}

function moduleUrl(node) {
  if (
    node?.type === "BinaryExpression" &&
    node.operator === "+" &&
    staticString(node.left) === ""
  )
    return moduleUrl(node.right);
  return (
    node?.type === "MemberExpression" &&
    node.property.name === "url" &&
    node.object.type === "MetaProperty" &&
    node.object.meta.name === "import" &&
    node.object.property.name === "meta"
  );
}

function workerRelativePath(node) {
  assert(
    node?.type === "NewExpression" &&
      node.callee.name === "URL" &&
      moduleUrl(node.arguments[1]),
    "Unknown production worker URL binding",
  );
  const input = node.arguments[0];
  if (staticString(input) !== undefined) return staticString(input);
  assert(
    input?.type === "MemberExpression" && input.property.name === "href",
    "Unknown nested production worker URL binding",
  );
  return workerRelativePath(input.object);
}

export function parseModule(source) {
  let program;
  const messages = new Linter().verify(source, {
    languageOptions: { ecmaVersion: "latest", sourceType: "module" },
    plugins: {
      measurement: {
        rules: {
          ast: {
            create() {
              return {
                Program(node) {
                  program = node;
                },
              };
            },
          },
        },
      },
    },
    rules: { "measurement/ast": "error" },
  });
  assert(
    program && !messages.some((message) => message.fatal),
    "Cannot parse production module",
  );
  return program;
}

export function visitSyntax(root, inspect) {
  const pending = [root];
  while (pending.length) {
    const node = pending.pop();
    inspect(node);
    for (const [key, value] of Object.entries(node)) {
      if (["parent", "tokens", "comments"].includes(key)) continue;
      if (Array.isArray(value))
        for (const entry of value) {
          if (entry?.type) pending.push(entry);
        }
      else if (value?.type) pending.push(value);
    }
  }
}

// The debugger is used only to obtain this existing composition handle during
// setup. It is disabled before operation timing; navigation uses a separate run.
export function applicationEntryBinding(source) {
  const bindings = [];
  visitSyntax(parseModule(source), (node) => {
    if (
      node.type !== "CallExpression" ||
      node.callee.type !== "MemberExpression" ||
      node.callee.object.name !== "window" ||
      node.callee.property.name !== "addEventListener" ||
      staticString(node.arguments[0]) !== "load"
    )
      return;
    const callback = node.arguments[1];
    if (
      !["ArrowFunctionExpression", "FunctionExpression"].includes(
        callback?.type,
      )
    )
      return;
    const expressions =
      callback.body.type === "BlockStatement"
        ? callback.body.body
            .filter((row) => row.type === "ExpressionStatement")
            .map((row) => row.expression)
        : [callback.body];
    for (const expression of expressions) {
      if (
        expression.type === "CallExpression" &&
        expression.callee.type === "MemberExpression" &&
        expression.callee.object.type === "Identifier" &&
        expression.callee.property.name === "initialize" &&
        expression.arguments.length === 0
      ) {
        bindings.push({
          identifier: expression.callee.object.name,
          lineNumber: expression.loc.start.line - 1,
          columnNumber: expression.loc.start.column,
        });
      }
    }
  });
  assert.equal(
    bindings.length,
    1,
    "Expected exactly one production application load callback",
  );
  return bindings[0];
}

export function productionManifest(directory) {
  const root = resolve(directory);
  const files = [];
  function walk(path) {
    const info = lstatSync(path);
    assert(
      !info.isSymbolicLink(),
      "Production manifest refuses redirected assets",
    );
    if (info.isDirectory()) {
      for (const name of readdirSync(path).sort()) walk(resolve(path, name));
    } else {
      assert(info.isFile(), "Production manifest requires regular files");
      const bytes = readFileSync(path);
      files.push({
        path: relative(root, path).split(sep).join("/"),
        byteLength: bytes.length,
        sha256: sha256(bytes),
      });
    }
  }
  walk(root);
  const html = readFileSync(resolve(root, "index.html"), "utf8");
  const entryPaths = [
    ...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/gu),
  ]
    .map((match) => match[1])
    .filter((path) => !/^https?:/u.test(path));
  const candidates = entryPaths.filter((path) => path.endsWith("/index.js"));
  assert.equal(candidates.length, 1, "Bind the actual production HTML entry");
  const entry = candidates[0].replace(/^\.\//u, "").replace(/^\//u, "");
  assert(
    files.some((file) => file.path === entry),
    "Production entry asset is missing",
  );
  const source = readFileSync(resolve(root, entry), "utf8");
  const workers = [];
  visitSyntax(parseModule(source), (node) => {
    if (node.type !== "NewExpression" || node.callee.name !== "Worker") return;
    const workerPath = workerRelativePath(node.arguments[0]);
    const path = relative(root, resolve(root, dirname(entry), workerPath))
      .split(sep)
      .join("/");
    assert(
      files.some((file) => file.path === path),
      "Referenced worker asset is missing",
    );
    workers.push(path);
  });
  assert(workers.length > 0, "No actual production worker binding was found");
  const workerClosures = {};
  for (const worker of new Set(workers)) {
    const reachable = new Set();
    const pending = [worker];
    while (pending.length) {
      const module = pending.pop();
      if (reachable.has(module)) continue;
      assert(
        files.some((file) => file.path === module),
        `Missing worker module: ${module}`,
      );
      reachable.add(module);
      visitSyntax(
        parseModule(readFileSync(resolve(root, module), "utf8")),
        (node) => {
          if (
            ![
              "ImportDeclaration",
              "ExportNamedDeclaration",
              "ExportAllDeclaration",
              "ImportExpression",
            ].includes(node.type) ||
            !node.source
          )
            return;
          const dependency = staticString(node.source);
          assert(
            dependency?.startsWith("./") || dependency?.startsWith("../"),
            "Worker imports must have a static local target",
          );
          const path = relative(
            root,
            resolve(root, dirname(module), dependency),
          )
            .split(sep)
            .join("/");
          assert(
            path.endsWith(".js") &&
              !path.startsWith("../") &&
              !path.startsWith("/"),
            "Worker module escapes its production output",
          );
          assert(
            path !== worker,
            `Worker dependency ${module} imports its own entry ${worker}`,
          );
          pending.push(path);
        },
      );
    }
    workerClosures[worker] = [...reachable].sort();
  }
  return {
    schemaVersion: 1,
    entry,
    workers: [...new Set(workers)].sort(),
    workerClosures,
    files,
    application: applicationEntryBinding(source),
  };
}

export function buildCohortOrder(samplesPerVersion) {
  assert(
    Number.isInteger(samplesPerVersion) &&
      samplesPerVersion >= 20 &&
      samplesPerVersion % 2 === 0,
    "ABBA requires an even sample count of at least 20",
  );
  return Array.from({ length: samplesPerVersion / 2 }, () => [
    "A",
    "B",
    "B",
    "A",
  ]).flat();
}

export function productionCohortSchedule(start = 1, end = 40) {
  assert(
    Number.isInteger(start) &&
      Number.isInteger(end) &&
      start >= 1 &&
      start <= end &&
      end <= 40,
    "Cohort range must be within the forty-cohort ABBA schedule",
  );
  return buildCohortOrder(20)
    .map((label, index) => ({ label, index: index + 1, warmup: false }))
    .slice(start - 1, end);
}

export function completedProductionCohort(
  samples,
  { index, label, warmup, startSample },
) {
  const names = [
    "B2-load",
    "B3-count",
    "B3-filter",
    ...Array.from({ length: 4 }, (_, step) => `B3-slider-${step}`),
    "B4-click",
    "B5-search",
    ...Array.from({ length: 10 }, (_, step) => `B6-edit-${step}`),
  ];
  assert.deepEqual(
    samples.map((row) => row.name),
    names,
    "Only a complete ordered operation cohort may be checkpointed",
  );
  assert(
    samples.every((row) => row.cohort === label && row.warmup === warmup),
    "A cohort checkpoint cannot mix labels or warmup samples",
  );
  return {
    index,
    label,
    warmup,
    startSample,
    sampleCount: samples.length,
    correctnessAssertionsCompleted: true,
  };
}

export function summarizeSamples(samples) {
  assert(
    samples.length > 0 &&
      samples.every((value) => Number.isFinite(value) && value >= 0),
    "Samples must be finite non-negative durations",
  );
  const ordered = [...samples].sort((a, b) => a - b);
  const middle = Math.floor(ordered.length / 2);
  return {
    count: ordered.length,
    medianMs:
      ordered.length % 2
        ? ordered[middle]
        : (ordered[middle - 1] + ordered[middle]) / 2,
    p95Ms: ordered[Math.ceil(ordered.length * 0.95) - 1],
    acceptanceSampleCount: ordered.length >= 20,
  };
}

export function validateBoundary({
  mode,
  start,
  completed,
  frame1,
  frame2,
  instrumentation,
  animationFrame1,
  animationFrame2,
}) {
  assert(
    [start, completed, frame1, frame2].every(Number.isFinite),
    "Boundary timestamps must be finite",
  );
  assert(
    start <= completed && completed <= frame1 && frame1 <= frame2,
    "Boundary phase order is invalid",
  );
  if (animationFrame1 !== undefined || animationFrame2 !== undefined)
    assert(
      Number.isFinite(animationFrame1) &&
        Number.isFinite(animationFrame2) &&
        animationFrame1 < animationFrame2,
      "Paint observation requires two distinct animation frame timestamps",
    );
  else
    assert(
      frame1 < frame2,
      "Paint observation requires two distinct animation frames",
    );
  assert(
    !(mode === "latency" && instrumentation),
    "An instrumented pass cannot provide acceptance latency",
  );
  return frame2 - start;
}

// Native frame timestamps identify rendering opportunities. Callback-entry
// readings measure completion order, but can round to the same value when a
// delayed callback is immediately followed by the next display frame.
export async function observeTwoAnimationFrames(
  requestFrame = globalThis.requestAnimationFrame.bind(globalThis),
  now = () => performance.now(),
) {
  const nextFrame = () =>
    new Promise((done) =>
      requestFrame((timestamp) => done({ timestamp, observedAt: now() })),
    );
  const first = await nextFrame();
  let second;
  let skippedDuplicateFrames = 0;
  for (; skippedDuplicateFrames < 5; skippedDuplicateFrames++) {
    second = await nextFrame();
    if (second.timestamp > first.timestamp) break;
  }
  if (skippedDuplicateFrames === 5)
    throw new Error("Animation frame timestamps did not advance");
  return {
    frame1: first.observedAt,
    frame2: second.observedAt,
    animationFrame1: first.timestamp,
    animationFrame2: second.timestamp,
    skippedDuplicateFrames,
  };
}

// Exact constructor from packages/vowl/test/browser/resources.js, also present
// at 2bba8c5511e9d0b8fc665d542ce06481d3001208. Hashes are pinned independently.
export function connectedClasses(count, connected = false) {
  return `Ontology(<urn:resource> ${Array.from(
    { length: count },
    (_, index) =>
      `Declaration(Class(<urn:C${index}>))${connected && index > 0 ? ` SubClassOf(<urn:C${index - 1}> <urn:C${index}>)` : ""}`,
  ).join(" ")})`;
}
