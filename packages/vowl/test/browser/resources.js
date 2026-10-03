import { createCanonicalVowlWorkerClient } from "../../../../src/app/js/controller/canonicalVowlWorkerClient.js";
import { createCanonicalVowlScene } from "../../../../src/app/js/controller/canonicalVowlScene.js";
import { compatibleArtifactProfile } from "vowl";
import { mapDataset } from "../../src/internalRdf.js";
import { compatibleMappingContract } from "../../src/compatibleContract.js";

const encoder = new TextEncoder();
const runs = [];
const checks = [];
function progress(stage) {
  document.getElementById("result").textContent = JSON.stringify({
    status: "running",
    stage,
    runs,
    checks,
  });
}
function check(value, name) {
  if (!value) {
    throw new Error(name);
  }
  checks.push(name);
}
function ontology(count, connected = false) {
  return `Ontology(<urn:resource> ${Array.from(
    { length: count },
    (_, i) =>
      `Declaration(Class(<urn:C${i}>))${connected && i > 0 ? ` SubClassOf(<urn:C${i - 1}> <urn:C${i}>)` : ""}`,
  ).join(" ")})`;
}
async function measure(name, text, limits) {
  progress(`${name}:open`);
  const client = createCanonicalVowlWorkerClient();
  const started = performance.now();
  let lastTick = started;
  let maxTickGapMs = 0;
  let ticks = 0;
  const heartbeat = setInterval(() => {
    const now = performance.now();
    maxTickGapMs = Math.max(maxTickGapMs, now - lastTick);
    lastTick = now;
    ticks++;
  }, 10);
  const bytes = encoder.encode(text);
  const run = {
    name,
    inputBytes: bytes.length,
    limits: limits ?? "defaults",
    internalQuadCount: null,
    peakMemoryBytes: null,
  };
  let capturedBytes;
  try {
    const context = { loadGeneration: 1, baseRevision: 0 };
    const opened = await client.run(
      {
        operation: "open-owl-model",
        bytes,
        documentIri: "urn:resource",
        mediaType: "text/owl-functional",
        limits,
      },
      context,
    );
    run.openMs = performance.now() - started;
    run.primaryRecords = [
      "subjects",
      "roles",
      "expressions",
      "constructs",
    ].reduce((sum, key) => sum + opened.inspection.records[key].length, 0);
    run.occurrences = opened.inspection.occurrences.length;
    progress(`${name}:scene`);
    const visualization = createCanonicalVowlScene(
      opened.inspection.occurrences,
      {
        loadGeneration: 1,
      },
    ).snapshot();
    progress(`${name}:capture`);
    const captured = await client.run(
      {
        operation: "capture-model",
        profile: compatibleArtifactProfile,
        checkpoint: opened.checkpoint,
        visualization,
        ...(limits === undefined ? {} : { limits }),
      },
      context,
    );
    run.outputBytes = captured.bytes.length;
    capturedBytes = captured.bytes;
    run.status = "accepted";
  } catch (error) {
    run.status = "rejected";
    run.code = error.code ?? error.message;
  } finally {
    run.elapsedMs = performance.now() - started;
    run.maxTickGapMs = Math.max(maxTickGapMs, performance.now() - lastTick);
    run.heartbeatTicks = ticks;
    clearInterval(heartbeat);
    client.dispose();
    runs.push(run);
  }
  // Inspect the exact accepted artifact after the timed production-worker path.
  // This private test mapping is not an application API or a substitute worker.
  if (capturedBytes) {
    const document = JSON.parse(new TextDecoder().decode(capturedBytes));
    const counts = {};
    const budget = {
      check() {},
      charge(key, amount = 1) {
        counts[key] = (counts[key] ?? 0) + amount;
      },
    };
    const mapped = mapDataset(
      document,
      budget,
      compatibleMappingContract(document),
    );
    run.baseQuadCount = counts.rdfQuads;
    // The compatible mapping adds exactly one refinement quad per blank node.
    run.internalQuadCount = counts.rdfQuads + mapped.blankCount;
  }
}
async function faultyPeer(mode, cancel) {
  progress(`peer:${mode}:${cancel}`);
  let ready;
  const started = new Promise((resolve) => {
    ready = resolve;
  });
  let terminatedAt;
  let terminationCount = 0;
  const client = createCanonicalVowlWorkerClient({
    createWorker() {
      const worker = new Worker(
        new URL("./nonresponsive-worker.js", import.meta.url),
        { type: "module", name: mode },
      );
      worker.addEventListener("message", ({ data }) => {
        if (data.type === "probe-ready") {
          ready();
        }
      });
      const terminate = worker.terminate.bind(worker);
      worker.terminate = () => {
        terminatedAt = performance.now();
        terminationCount++;
        terminate();
      };
      return worker;
    },
  });
  const abort = new AbortController();
  const began = performance.now();
  const pending = client
    .run(
      {
        operation: "decode",
        bytes: encoder.encode("{}"),
        limits: { deadlineMs: cancel ? 5000 : mode === "stale" ? 5000 : 250 },
      },
      { loadGeneration: 7, baseRevision: 0, signal: abort.signal },
    )
    .then(
      (value) => ({ value }),
      (error) => ({ code: error.code }),
    );
  let abortAt;
  if (cancel) {
    await Promise.race([
      started,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("probe-start-timeout")), 5000),
      ),
    ]);
    abortAt = performance.now();
    abort.abort();
  }
  const result = await pending;
  const elapsedMs = performance.now() - began;
  client.dispose();
  const run = {
    name: cancel
      ? "nonresponsive-cancellation"
      : mode === "stale"
        ? "stale-peer"
        : "nonresponsive-deadline",
    ...result,
    elapsedMs,
    terminationCount,
    ...(abortAt === undefined
      ? {}
      : { cancellationMs: terminatedAt - abortAt }),
  };
  runs.push(run);
  check(terminationCount === 1, `${run.name}-terminated-once`);
  if (cancel) {
    check(
      result.code === "LOAD_ABORTED" && run.cancellationMs <= 250,
      "blocked-worker-cancelled-within-250ms",
    );
  } else if (mode === "stale") {
    check(
      result.value?.marker === "current",
      "stale-generation-result-never-accepted",
    );
  } else {
    check(
      result.code === "RESOURCE_LIMIT_EXCEEDED",
      "blocked-worker-deadline-enforced",
    );
  }
}
try {
  await measure("ordinary-connected-100", ontology(100, true));
  await measure("large-connected-2000", ontology(2000, true));
  await measure("disconnected-2000", ontology(2000));
  await measure(
    "symmetric-disjoint-16",
    `Ontology(<urn:resource> DisjointClasses(${Array.from({ length: 16 }, (_, i) => `<urn:C${i}>`).join(" ")}))`,
  );
  await measure(
    "deep-160",
    `Ontology(<urn:resource> SubClassOf(<urn:A> ${"ObjectSomeValuesFrom(<urn:p> ".repeat(160)}<urn:B>${")".repeat(160)}))`,
  );
  await measure("poison-record-budget", ontology(1000), {
    primaryRecords: 100,
  });
  await faultyPeer("hang", true);
  await faultyPeer("hang", false);
  await faultyPeer("stale", false);
  document.getElementById("result").textContent = JSON.stringify({
    status: "measured",
    userAgent: navigator.userAgent,
    runs,
    checks,
    limitations: [
      "Single local run; no accepted latency or memory service objective.",
      "Quad counts cover accepted artifacts; rejected operations expose no partial mapping.",
      "Peak process memory requires the external browser-process sampler.",
    ],
  });
} catch (error) {
  document.getElementById("result").textContent = JSON.stringify({
    status: "failed",
    code: error.code ?? error.message,
    runs,
    checks,
  });
}
