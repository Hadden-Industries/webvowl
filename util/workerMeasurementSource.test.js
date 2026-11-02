import assert from "node:assert/strict";
import vm from "node:vm";
import { createBenchmarkWorkerSource } from "./compareOwl2VowlPerformance.mjs";
import { installPaintProbe } from "./compareWebVowlEndToEnd.mjs";

async function comparisonWorkerSource(moduleUrl) {
  const blobs = [];
  const workers = [];
  class WorkerUrl extends URL {
    static createObjectURL(blob) {
      blobs.push(blob);
      return "blob:https://example.test/instrumentation";
    }
  }
  class NativeWorker {
    constructor(url, options) {
      workers.push({ url, options });
    }
    addEventListener() {}
  }
  const context = vm.createContext({
    URL: WorkerUrl,
    Blob,
    Worker: NativeWorker,
    location: { href: "https://example.test/" },
    fetch: async () => {},
    requestAnimationFrame() {},
  });
  vm.runInContext(
    "(" + installPaintProbe.toString() + ")",
    context,
  )({
    originalIris: [],
    profileWorkers: true,
  });
  const worker = new context.Worker(moduleUrl, {
    type: "module",
    name: "retained-worker-name",
    credentials: "same-origin",
  });
  assert(worker instanceof NativeWorker);
  assert.equal(workers[0].options.name, "retained-worker-name");
  assert.equal(workers[0].options.credentials, "same-origin");
  return blobs[0].text();
}

async function exerciseSource(source, expectedSpecifier, measurementType) {
  const sent = [];
  const received = [];
  let resumeImport;
  const importing = new Promise((resolve) => {
    resumeImport = resolve;
  });
  const self = { postMessage: (...args) => sent.push(args) };
  const context = vm.createContext({
    self,
    performance: {
      getEntriesByType: () => [{ name: "parse", duration: 12 }],
    },
  });
  const module = new vm.SourceTextModule(source, {
    context,
    async importModuleDynamically(specifier) {
      assert.equal(specifier, expectedSpecifier);
      await importing;
      self.onmessage = (event) => received.push(event);
      const target = new vm.SyntheticModule([], () => {}, { context });
      await target.link(() => {});
      await target.evaluate();
      return target;
    },
  });
  await module.link(() => {});
  const pending = module.evaluate();
  const first = { data: { type: "run" } };
  const second = { data: { type: "continue-ordering" } };
  self.onmessage(first);
  self.onmessage(second);
  assert.deepEqual(received, []);
  resumeImport();
  await pending;
  assert.deepEqual(received, [first, second]);
  const transfer = [new ArrayBuffer(1)];
  const result = { type: "result" };
  self.postMessage(result, transfer);
  assert.equal(sent[0][0].type, measurementType);
  assert.equal(sent[0][0].measures[0].duration, 12);
  assert.equal(sent[1][0], result);
  assert.equal(sent[1][1], transfer);
}

test("benchmark worker literals retain exact URLs without raw script delimiters or line separators", async () => {
  for (const specifier of [
    "https://example.test/worker.js",
    'https://example.test/worker.js?value=</script><script>"\\\r\n',
    "https://example.test/worker.js?value=\u2028\u2029</script></script>",
    'https://example.test/worker.js?value=%3C%2Fscript%3E";self.injected=true;//',
  ]) {
    const source = createBenchmarkWorkerSource(specifier);
    assert(!source.includes("</script>"));
    assert(!source.includes("\u2028"));
    assert(!source.includes("\u2029"));
    await exerciseSource(source, specifier, "benchmark-measures");
  }
});

test("serialized paint instrumentation preserves URL data, worker options and queued messages", async () => {
  const input =
    'https://example.test/worker.js?value=</script>"\\\u2028\u2029%3C%2Fscript%3E';
  const source = await comparisonWorkerSource(input);
  assert(!source.includes("</script>"));
  assert(!source.includes("\u2028"));
  assert(!source.includes("\u2029"));
  await exerciseSource(
    source,
    new URL(input).href,
    "comparison-worker-measures",
  );
});

test("an import failure remains a rejecting worker startup", async () => {
  const failure = new Error("Worker import failed");
  const source = createBenchmarkWorkerSource("https://example.test/worker.js");
  const module = new vm.SourceTextModule(source, {
    context: vm.createContext({ self: { postMessage() {} } }),
    importModuleDynamically() {
      throw failure;
    },
  });
  await module.link(() => {});
  await assert.rejects(module.evaluate(), (error) => error === failure);
});
