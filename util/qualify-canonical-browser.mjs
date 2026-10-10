import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  closeSync,
  createWriteStream,
  existsSync,
  openSync,
  readFileSync,
  writeFileSync,
  writeSync,
} from "node:fs";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { stripVTControlCharacters } from "node:util";
import { analyzeCanonicalHeap } from "./analyze-canonical-heap.mjs";
import { assertQuiescentMachine } from "./benchmarkEnvironment.mjs";

const [chromePath, profile, output] = process.argv.slice(2);
const latency = process.argv.includes("--latency");
assert(
  chromePath && profile && output,
  "Usage: node util/qualify-canonical-browser.mjs <chrome> <isolated-profile> <evidence-directory>",
);
const processes = [];
const socketPending = new Map();
const events = new Map();
let socket;
let sequence = 0;
const receipt = {
  status: "running",
  startedAt: new Date().toISOString(),
  source: "native isolated Chrome CDP; dedicated task profile",
  exceptions: [],
};
function child(executable, args, log) {
  const process = spawn(executable, args, {
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const stream = createWriteStream(resolve(output, log), { flags: "wx" });
  process.stdout.pipe(stream, { end: false });
  process.stderr.pipe(stream, { end: false });
  const ended = new Promise((done) =>
    process.once("close", (code, signal) => {
      stream.end();
      done({ code, signal });
    }),
  );
  processes.push({ process, ended });
  return process;
}
async function waitFor(operation, label, count = 120) {
  for (let index = 0; index < count; index++) {
    const result = await operation();
    if (result) return result;
    await delay(250);
  }
  throw new Error(`Deadline: ${label}`);
}
function call(method, params = {}, sessionId) {
  const id = ++sequence;
  return new Promise((done, fail) => {
    const timer = setTimeout(() => {
      socketPending.delete(id);
      fail(new Error(`CDP deadline: ${method}`));
    }, 180000);
    socketPending.set(id, { done, fail, timer });
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
async function evaluate(session, expression) {
  const response = await call(
    "Runtime.evaluate",
    { expression, returnByValue: true },
    session,
  );
  assert(!response.exceptionDetails, JSON.stringify(response.exceptionDetails));
  return response.result.value;
}
async function snapshot(session, name) {
  const path = resolve(output, name);
  const descriptor = openSync(path, "wx");
  const onChunk = (params, sender) => {
    if (sender === session) writeSync(descriptor, params.chunk);
  };
  events.set("HeapProfiler.addHeapSnapshotChunk", onChunk);
  try {
    await call(
      "HeapProfiler.takeHeapSnapshot",
      { reportProgress: false },
      session,
    );
  } finally {
    events.delete("HeapProfiler.addHeapSnapshotChunk");
    closeSync(descriptor);
  }
  return {
    path,
    sha256: createHash("sha256").update(readFileSync(path)).digest("hex"),
  };
}
try {
  receipt.sourceDirectory = process.cwd();
  receipt.sourceFiles = Object.fromEntries(
    [
      "package-lock.json",
      "src/app/js/controller/canonicalVowlScene.js",
      "src/app/js/controller/ontologyInspector.js",
      "src/webvowl/js/elements/links/PlainLink.js",
      "packages/vowl/test/browser/performance-latency.js",
      "packages/vowl/test/browser/performance-latency.html",
    ].map((path) => [
      path,
      createHash("sha256")
        .update(readFileSync(resolve(path)))
        .digest("hex"),
    ]),
  );
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
  let viteOutput = "";
  let viteReady = false;
  vite.stdout.on("data", (chunk) => {
    viteOutput = (viteOutput + chunk.toString()).slice(-8192);
    viteReady ||= /Local:\s+http:\/\/127\.0\.0\.1:5178\//u.test(
      stripVTControlCharacters(viteOutput),
    );
  });
  function assertOwnedServerRunning() {
    assert.equal(vite.exitCode, null, "Owned Vite server exited unexpectedly");
    assert.equal(vite.signalCode, null, "Owned Vite server was terminated");
  }
  await waitFor(async () => {
    assertOwnedServerRunning();
    if (!viteReady) return false;
    try {
      const ready = (await fetch("http://127.0.0.1:5178/")).ok;
      assertOwnedServerRunning();
      return ready;
    } catch {
      return false;
    }
  }, "owned local Vite server");
  child(
    chromePath,
    [
      "--headless=new",
      "--disable-extensions",
      "--disable-component-extensions-with-background-pages",
      "--no-first-run",
      "--no-default-browser-check",
      "--remote-debugging-address=127.0.0.1",
      "--remote-debugging-port=0",
      `--user-data-dir=${profile}`,
      "about:blank",
    ],
    "chrome.log",
  );
  const portFile = resolve(profile, "DevToolsActivePort");
  await waitFor(
    () => existsSync(portFile),
    "dedicated Chrome debugging endpoint",
  );
  const [port, endpoint] = readFileSync(portFile, "utf8")
    .trim()
    .split(/\r?\n/u);
  socket = new WebSocket(`ws://127.0.0.1:${port}${endpoint}`);
  await new Promise((done, fail) => {
    socket.addEventListener("open", done, { once: true });
    socket.addEventListener("error", fail, { once: true });
  });
  socket.addEventListener("message", ({ data }) => {
    const message = JSON.parse(data);
    if (message.id) {
      const pending = socketPending.get(message.id);
      if (!pending) return;
      clearTimeout(pending.timer);
      socketPending.delete(message.id);
      if (message.error) pending.fail(new Error(JSON.stringify(message.error)));
      else pending.done(message.result);
    } else if (events.has(message.method)) {
      const handler = events.get(message.method);
      if (typeof handler === "function") {
        handler(message.params, message.sessionId);
      }
    }
  });
  receipt.browser = await call("Browser.getVersion");
  const { targetId } = await call("Target.createTarget", {
    url: "about:blank",
  });
  const { sessionId } = await call("Target.attachToTarget", {
    targetId,
    flatten: true,
  });
  await call("Runtime.enable", {}, sessionId);
  await call("Page.enable", {}, sessionId);
  await call("HeapProfiler.enable", {}, sessionId);
  events.set("Runtime.exceptionThrown", (params) =>
    receipt.exceptions.push(params.exceptionDetails),
  );
  const fixture = latency
    ? "performance-latency.html"
    : "performance-search.html?heap";
  await call(
    "Page.navigate",
    {
      url:
        "http://127.0.0.1:5178/@fs/" +
        resolve(`packages/vowl/test/browser/${fixture}`).replaceAll("\\", "/"),
    },
    sessionId,
  );
  await call("Page.bringToFront", {}, sessionId);
  if (latency) {
    await waitFor(
      () =>
        evaluate(
          sessionId,
          "globalThis.canonicalLatencyQualification?.status === 'ready'",
        ),
      "latency fixture ready",
      240,
    );
    receipt.rejectedPreflights = [];
    await delay(30000);
    const idleDeadline = performance.now() + 900000;
    for (;;) {
      try {
        await assertQuiescentMachine();
        break;
      } catch (error) {
        const rejected = {
          at: new Date().toISOString(),
          message: error.message,
        };
        receipt.rejectedPreflights.push(rejected);
        console.error(JSON.stringify(rejected));
        if (performance.now() > idleDeadline) throw error;
        await delay(15000);
      }
    }
    const rect = JSON.parse(
      await evaluate(
        sessionId,
        "JSON.stringify((()=>{const r=document.getElementById('run-cohort').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})())",
      ),
    );
    await call(
      "Input.dispatchMouseEvent",
      { type: "mousePressed", button: "left", clickCount: 1, ...rect },
      sessionId,
    );
    await call(
      "Input.dispatchMouseEvent",
      { type: "mouseReleased", button: "left", clickCount: 1, ...rect },
      sessionId,
    );
    await waitFor(
      () =>
        evaluate(
          sessionId,
          "['passed','failed'].includes(globalThis.canonicalLatencyQualification?.status)",
        ),
      "latency cohort",
      1200,
    );
    receipt.latency = JSON.parse(
      await evaluate(
        sessionId,
        "JSON.stringify(globalThis.canonicalLatencyQualification)",
      ),
    );
    assert.equal(
      receipt.latency.status,
      "passed",
      JSON.stringify(receipt.latency.error),
    );
    assert.equal(receipt.exceptions.length, 0);
    receipt.status = "passed";
  } else {
    await waitFor(
      async () => {
        const state = await evaluate(
          sessionId,
          "({status:globalThis.performanceSearchQualification?.status,error:globalThis.performanceSearchQualification?.error,visibility:document.visibilityState})",
        );
        receipt.lastCheckpointState = state;
        if (state.status === "failed")
          throw new Error(JSON.stringify(state.error));
        return state.status === "live-heap-checkpoint";
      },
      "live checkpoint",
      240,
    );
    receipt.liveTargets = (await call("Target.getTargets")).targetInfos.map(
      ({ type, url }) => ({ type, url }),
    );
    receipt.liveSnapshot = await snapshot(sessionId, "heap-live.heapsnapshot");
    const rect = await evaluate(
      sessionId,
      "JSON.stringify((()=>{const r=document.getElementById('release-heap-checkpoint').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})())",
    );
    const coordinates = JSON.parse(rect);
    await call(
      "Input.dispatchMouseEvent",
      { type: "mousePressed", button: "left", clickCount: 1, ...coordinates },
      sessionId,
    );
    await call(
      "Input.dispatchMouseEvent",
      { type: "mouseReleased", button: "left", clickCount: 1, ...coordinates },
      sessionId,
    );
    await waitFor(
      () =>
        evaluate(
          sessionId,
          "['passed','failed'].includes(globalThis.performanceSearchQualification?.status)",
        ),
      "ten lifecycle cycles",
      1200,
    );
    receipt.retiredSnapshot = await snapshot(
      sessionId,
      "heap-retired.heapsnapshot",
    );
    receipt.lifecycle = await evaluate(
      sessionId,
      "JSON.stringify({status:performanceSearchQualification.status,cycles:performanceSearchQualification.cycles,error:performanceSearchQualification.error,retiredCount:performanceSearchQualification.retired.length,remaining:performanceSearchQualification.retired.filter(row=>row.reference.deref()).map(({kind,cycle})=>({kind,cycle}))})",
    );
    receipt.lifecycle = JSON.parse(receipt.lifecycle);
    receipt.retiredTargets = (await call("Target.getTargets")).targetInfos.map(
      ({ type, url }) => ({ type, url }),
    );
    receipt.heap = analyzeCanonicalHeap(
      receipt.liveSnapshot.path,
      receipt.retiredSnapshot.path,
    );
    assert.equal(receipt.lifecycle.status, "passed");
    assert.equal(receipt.lifecycle.cycles.length, 10);
    assert.equal(receipt.lifecycle.remaining.length, 0);
    assert.equal(receipt.heap.status, "passed");
    assert.equal(
      receipt.retiredTargets.filter(({ type }) => type === "worker").length,
      0,
    );
    assert.equal(receipt.exceptions.length, 0);
    receipt.status = "passed";
  }
  assertOwnedServerRunning();
} catch (error) {
  receipt.status = "failed";
  receipt.error = { message: error.message, stack: error.stack };
  process.exitCode = 1;
} finally {
  if (socket?.readyState === WebSocket.OPEN) {
    await call("Browser.close").catch(() => {});
    socket.close();
  }
  for (const { process: owned, ended } of processes.reverse()) {
    if (owned.exitCode === null && owned.signalCode === null) owned.kill();
    await ended;
  }
  receipt.finishedAt = new Date().toISOString();
  writeFileSync(
    resolve(output, "browser-qualification.json"),
    JSON.stringify(receipt, null, 2) + "\n",
    { flag: "wx" },
  );
  console.log(
    JSON.stringify({
      status: receipt.status,
      error: receipt.error,
      liveNodes: receipt.heap?.liveNodes,
      retiredNodes: receipt.heap?.retiredNodes,
      owners: receipt.heap?.owners.map(({ kind, id }) => ({ kind, id })),
      liveCensus: receipt.heap?.liveCensus,
      remaining: receipt.lifecycle?.remaining,
    }),
  );
}
