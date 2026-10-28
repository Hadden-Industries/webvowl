import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  createWriteStream,
  existsSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { parseArgs } from "node:util";
import { assertQuiescentMachine } from "./benchmarkEnvironment.mjs";

const { values } = parseArgs({
  options: {
    chrome: { type: "string" },
    profile: { type: "string" },
    output: { type: "string" },
    closure: { type: "string" },
    trace: { type: "boolean", default: false },
    functional: { type: "boolean", default: false },
    "render-only": { type: "boolean", default: false },
    capture: { type: "boolean", default: false },
    case: { type: "string", default: "all" },
  },
});
assert(
  values.chrome && values.profile && values.output && values.closure,
  "--chrome, a new --profile, existing private --output directory and --closure JSON are required",
);
assert(!existsSync(values.profile), "Use a fresh owned browser profile");
assert(["all", "chain", "urd"].includes(values.case));
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const receipt = {
  status: "running",
  startedAt: new Date().toISOString(),
  mode: values.functional
    ? "functional only; wall clocks are not admitted performance samples"
    : values.trace
      ? "instrumented diagnostic"
      : "uninstrumented functional/timing observation",
  source:
    "Native production module Worker; unchanged finite desktop policy; local private closure",
  exceptions: [],
  phases: {
    renderOnly: values["render-only"],
    capture: values.capture,
    case: values.case,
  },
};
assert(
  !(values.functional && values.trace),
  "Keep functional-only and admitted diagnostic trace modes separate",
);
const processes = [],
  pending = new Map();
let socket,
  server,
  sequence = 0;
function child(executable, args, name) {
  const owned = spawn(executable, args, {
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const stream = createWriteStream(resolve(values.output, name), {
    flags: "wx",
  });
  owned.stdout.pipe(stream, { end: false });
  owned.stderr.pipe(stream, { end: false });
  const ended = new Promise((done) =>
    owned.once("close", (code, signal) => {
      stream.end();
      done({ code, signal });
    }),
  );
  processes.push({ owned, ended });
  return owned;
}
async function waitFor(action, label, attempts = 120) {
  for (let i = 0; i < attempts; i++) {
    const value = await action();
    if (value) return value;
    await delay(250);
  }
  throw new Error(`Deadline: ${label}`);
}
function call(method, params = {}, sessionId) {
  const id = ++sequence;
  return new Promise((done, fail) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      fail(new Error(`CDP deadline: ${method}`));
    }, 180000);
    pending.set(id, { done, fail, timer });
    socket.send(
      JSON.stringify({
        id,
        method,
        params,
        ...(sessionId ? { sessionId } : {}),
      }),
    );
  });
}
async function evaluate(sessionId, expression) {
  const response = await call(
    "Runtime.evaluate",
    { expression, returnByValue: true },
    sessionId,
  );
  assert(!response.exceptionDetails, JSON.stringify(response.exceptionDetails));
  return response.result.value;
}
try {
  const manifest = JSON.parse(
    readFileSync("deploy/.vite/webvowl-generated-js.json"),
  );
  const workers = manifest.files.filter((path) =>
    /^assets\/canonicalVowlWorker-[^/]+\.js$/u.test(path),
  );
  assert.equal(
    workers.length,
    1,
    "Exactly one manifest-owned production worker",
  );
  const assets = new Map(
    manifest.files.map((path) => {
      assert(!path.split("/").includes("..") && !path.includes("\\"));
      const bytes = readFileSync(resolve("deploy", path));
      assert.equal(hash(bytes), manifest.hashes[path], path);
      return [`/production/${path}`, bytes];
    }),
  );
  receipt.production = {
    worker: workers[0],
    manifestSha256: hash(
      readFileSync("deploy/.vite/webvowl-generated-js.json"),
    ),
    hashes: manifest.hashes,
  };
  const closure = JSON.parse(readFileSync(values.closure));
  assert(Array.isArray(closure.documents) && closure.documents.length >= 1);
  const documents = closure.documents.map((document, index) => {
    const bytes = readFileSync(document.path);
    assert.equal(hash(bytes), document.sha256, "Private closure input changed");
    if (document.byteLength !== undefined)
      assert.equal(bytes.length, document.byteLength);
    assets.set(`/input/${index}`, bytes);
    return {
      url: `/input/${index}`,
      documentIri: document.documentIri,
      mediaType: document.mediaType,
      sha256: hash(bytes),
      byteLength: bytes.length,
    };
  });
  receipt.inputs = documents;
  const fixture = resolve(
    "packages/vowl/test/browser/performance-edit.js",
  ).replaceAll("\\", "/");
  // json-identity-contract: bytes; owner: local browser qualification; reason: These bytes form the private HTTP JSON response, not an equality key.
  const configuration = JSON.stringify({
    worker: `/production/${workers[0]}`,
    documents,
    renderOnly: values["render-only"],
    capture: values.capture,
    case: values.case,
  });
  const html = `<!doctype html><html lang="en"><meta charset="utf-8"><title>Private VOWL edit qualification</title><script type="module" src="http://127.0.0.1:5178/@fs/${fixture}"></script></html>`;
  assets.set(
    "/empty.json",
    readFileSync(
      "packages/vowl/conformance/vectors/empty-structural/source.json",
    ),
  );
  server = createServer((request, response) => {
    const path = new URL(request.url, "http://127.0.0.1").pathname;
    const bytes =
      path === "/"
        ? html
        : path === "/configuration.json"
          ? configuration
          : assets.get(path);
    response.setHeader("Cache-Control", "no-store");
    response.setHeader(
      "Content-Type",
      path === "/"
        ? "text/html"
        : path.endsWith(".js")
          ? "text/javascript"
          : "application/json",
    );
    response.writeHead(bytes === undefined ? 404 : 200);
    response.end(bytes);
  });
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  const port = server.address().port;
  const vite = child(
    process.execPath,
    [
      resolve("node_modules/vite/bin/vite.js"),
      "--host",
      "127.0.0.1",
      "--port",
      "5178",
      "--strictPort",
    ],
    "vite.log",
  );
  let ready = false;
  vite.stdout.on("data", (chunk) => {
    ready ||= chunk.toString().includes("127.0.0.1:5178");
  });
  await waitFor(() => {
    assert.equal(vite.exitCode, null, "Owned Vite exited");
    return ready;
  }, "owned Vite");
  receipt.hostAdmissionRefusals = [];
  for (let attempt = 0; ; attempt++) {
    try {
      await assertQuiescentMachine();
      break;
    } catch (error) {
      receipt.hostAdmissionRefusals.push({
        at: new Date().toISOString(),
        message: error.message,
      });
      if (values.functional) break;
      if (attempt === 3) throw error;
      await delay(5000);
    }
  }
  child(
    values.chrome,
    [
      "--headless=new",
      "--disable-extensions",
      "--no-first-run",
      "--no-default-browser-check",
      "--remote-debugging-address=127.0.0.1",
      "--remote-debugging-port=0",
      `--user-data-dir=${resolve(values.profile)}`,
      "about:blank",
    ],
    "chrome.log",
  );
  const portFile = resolve(values.profile, "DevToolsActivePort");
  await waitFor(() => existsSync(portFile), "owned Chrome");
  const [debugPort, endpoint] = readFileSync(portFile, "utf8")
    .trim()
    .split(/\r?\n/u);
  socket = new WebSocket(`ws://127.0.0.1:${debugPort}${endpoint}`);
  await new Promise((done, fail) => {
    socket.addEventListener("open", done, { once: true });
    socket.addEventListener("error", fail, { once: true });
  });
  let traceComplete;
  const traced = new Promise((done) => {
    traceComplete = done;
  });
  socket.addEventListener("message", ({ data }) => {
    const message = JSON.parse(data),
      item = pending.get(message.id);
    if (item) {
      clearTimeout(item.timer);
      pending.delete(message.id);
      if (message.error) item.fail(new Error(JSON.stringify(message.error)));
      else item.done(message.result);
    } else if (message.method === "Runtime.exceptionThrown")
      receipt.exceptions.push(message.params.exceptionDetails);
    else if (message.method === "Tracing.tracingComplete")
      traceComplete(message.params);
  });
  receipt.browser = await call("Browser.getVersion");
  if (values.trace)
    await call("Tracing.start", {
      categories:
        "blink.user_timing,devtools.timeline,v8,disabled-by-default-v8.cpu_profiler",
      transferMode: "ReturnAsStream",
    });
  const { targetId } = await call("Target.createTarget", {
    url: "about:blank",
  });
  const { sessionId } = await call("Target.attachToTarget", {
    targetId,
    flatten: true,
  });
  await call("Runtime.enable", {}, sessionId);
  await call("Page.enable", {}, sessionId);
  await call("Page.navigate", { url: `http://127.0.0.1:${port}/` }, sessionId);
  await waitFor(
    () =>
      evaluate(sessionId, "globalThis.canonicalEditQualification?.finishedAt"),
    "native production worker cohort",
    2000,
  );
  receipt.functional = await evaluate(
    sessionId,
    "(()=>{const {retired,...value}=canonicalEditQualification;return value})()",
  );
  await call("HeapProfiler.collectGarbage", {}, sessionId);
  await delay(50);
  await call("HeapProfiler.collectGarbage", {}, sessionId);
  receipt.retiredReachable = await evaluate(
    sessionId,
    "canonicalEditQualification.retired.filter(ref=>ref.deref()).length",
  );
  receipt.mainHeap = await call("Runtime.getHeapUsage", {}, sessionId);
  receipt.workerTargets = (await call("Target.getTargets")).targetInfos
    .filter(({ type }) => type === "worker")
    .map(({ type, url }) => ({ type, url }));
  if (values.trace) {
    await call("Tracing.end");
    const { stream } = await Promise.race([
      traced,
      delay(30000, undefined, { ref: false }).then(() => {
        throw new Error("Trace completion deadline");
      }),
    ]);
    const chunks = [];
    for (;;) {
      const part = await call("IO.read", { handle: stream });
      chunks.push(
        part.base64Encoded
          ? Buffer.from(part.data, "base64")
          : Buffer.from(part.data),
      );
      if (part.eof) break;
    }
    await call("IO.close", { handle: stream });
    const bytes = Buffer.concat(chunks);
    writeFileSync(resolve(values.output, "private-trace.json"), bytes, {
      flag: "wx",
    });
    receipt.trace = {
      file: "private-trace.json",
      byteLength: bytes.length,
      sha256: hash(bytes),
    };
  }
  assert.notEqual(
    receipt.functional.status,
    "failed",
    JSON.stringify(receipt.functional.error),
  );
  assert.equal(receipt.exceptions.length, 0);
  assert.equal(receipt.workerTargets.length, 0);
  assert.equal(
    receipt.retiredReachable,
    0,
    "Retired checkpoints/sessions/workers remain reachable after native GC",
  );
  receipt.status = receipt.functional.status;
  if (receipt.status !== "passed") process.exitCode = 1;
} catch (error) {
  receipt.status = "failed";
  receipt.error = { message: error.message, stack: error.stack };
  process.exitCode = 1;
} finally {
  if (socket?.readyState === WebSocket.OPEN) {
    await call("Browser.close").catch(() => {});
    socket.close();
  }
  for (const { owned, ended } of processes.reverse()) {
    if (owned.exitCode === null && owned.signalCode === null) owned.kill();
    await ended;
  }
  if (server) await new Promise((done) => server.close(done));
  receipt.finishedAt = new Date().toISOString();
  writeFileSync(
    resolve(values.output, "qualification.json"),
    JSON.stringify(receipt, null, 2) + "\n",
    { flag: "wx" },
  );
  console.log(
    JSON.stringify({
      status: receipt.status,
      error: receipt.error,
      operations: receipt.functional?.operations,
      retiredReachable: receipt.retiredReachable,
    }),
  );
}
