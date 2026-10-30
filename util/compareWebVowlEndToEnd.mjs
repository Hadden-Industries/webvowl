import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawn, execFile } from "node:child_process";
import { once } from "node:events";
import { createServer as httpServer } from "node:http";
import https from "node:https";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, join, resolve, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs, promisify } from "node:util";
import { build } from "vite";
import {
  rootIri,
  readComparisonInputs,
  writeLegacySources,
  legacyNamedEntities,
} from "./compareOwl2VowlPerformance.mjs";

const run = promisify(execFile);
const checkout = fileURLToPath(new URL("../", import.meta.url));
const archiveSha256 =
  "fb0642091929c82933f7d96932174ecf37a996dc38d19bdd364f6ac6d86ae48b";
const warSha256 =
  "3e75194a35ac68e6a85d1524fdfcc2399c5d71d18a9aa41d6a4924328d5ebea6";
// The owner's existing webvowl_1.1.7.zip contains ROOT.war. Both hashes select
// that actual distribution, rather than assuming a newer legacy fork is 1.1.7.
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
// Actual original 1.1.7 browser baselines recorded in AWS plan line 1059.
// A candidate must meet each measured boundary; no slower tolerance is added.
export const originalBrowserMilliseconds = Object.freeze({
  cold: 3340,
  "same-session-warm": 1722,
  "fresh-session-warm": 2428,
});
export function assertOriginalParity(samples) {
  const failures = [];
  for (const temperature of Object.keys(originalBrowserMilliseconds)) {
    const values = samples
      .filter(
        (sample) =>
          sample.path === "current" && sample.temperature === temperature,
      )
      .map((sample) => sample.milliseconds)
      .sort((a, b) => a - b);
    if (temperature === "fresh-session-warm" && !values.length) continue;
    assert(values.length, "Missing candidate " + temperature + " samples");
    const middle = Math.floor(values.length / 2);
    const median =
      values.length % 2
        ? values[middle]
        : (values[middle - 1] + values[middle]) / 2;
    if (median > originalBrowserMilliseconds[temperature])
      failures.push(
        temperature +
          ": " +
          median +
          "ms > original " +
          originalBrowserMilliseconds[temperature] +
          "ms",
      );
  }
  assert.equal(
    failures.length,
    0,
    "Original WebVOWL end-to-end parity failed: " + failures.join("; "),
  );
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const listen = async (server) => {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return server.address().port;
};
async function closeServer(server) {
  if (!server) return;
  const closed = new Promise((resolve) => server.close(resolve));
  server.closeAllConnections();
  await closed;
}
async function stopJava(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const ended = once(child, "exit");
  child.kill();
  await ended;
}
function javaExecutable(home, name) {
  return join(home, "bin", process.platform === "win32" ? name + ".exe" : name);
}

/** Browser-side paint oracle shared by the unmodified original and current application. */
export function installPaintProbe({
  originalIris,
  fixtureOrigin,
  rootIri,
  profileWorkers = false,
}) {
  globalThis.comparisonWorkerMeasures = [];
  if (profileWorkers) {
    const NativeWorker = globalThis.Worker;
    let sequence = 0;
    globalThis.Worker = class extends NativeWorker {
      constructor(url, options) {
        const workerId = ++sequence;
        const moduleUrl = new URL(url, globalThis.location.href).href;
        const wrapper = `const send=self.postMessage.bind(self),queued=[];self.onmessage=e=>queued.push(e);self.postMessage=(message,...rest)=>{if(message.type==="preview"||message.type==="result")send({type:"comparison-worker-measures",measures:performance.getEntriesByType("measure").map(e=>({name:e.name,duration:e.duration}))});send(message,...rest)};await import(${JSON.stringify(moduleUrl)});for(const event of queued)self.onmessage(event);`;
        const blob = URL.createObjectURL(
          new Blob([wrapper], { type: "text/javascript" }),
        );
        super(blob, { ...options, type: "module" });
        this.addEventListener("message", (event) => {
          if (event.data.type === "comparison-worker-measures") {
            globalThis.comparisonWorkerMeasures.push({
              workerId,
              measures: event.data.measures,
            });
            event.stopImmediatePropagation();
          }
        });
        const revoke = () => URL.revokeObjectURL(blob);
        this.addEventListener("message", revoke, { once: true });
        this.addEventListener("error", revoke, { once: true });
      }
    };
  }
  const nativeFetch = globalThis.fetch.bind(globalThis);
  // Only direct source transport is routed to a controlled origin. It omits CORS,
  // so the real browser rejects it; materialization HTTP and browser caching remain real.
  const originals = new Set(
    originalIris.flatMap((iri) => [iri, iri.replace(/^http:/u, "https:")]),
  );
  globalThis.fetch = function (input, options) {
    const iri =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    return nativeFetch(
      originals.has(iri)
        ? fixtureOrigin + "/source?iri=" + encodeURIComponent(iri)
        : input,
      options,
    );
  };
  globalThis.comparisonPaint = {
    start: 0,
    paintedAt: null,
    armed: true,
    minimumGeneration: 1,
  };
  globalThis.armComparisonPaint = function () {
    const state = globalThis.comparisonApp?.getWebVowlController()?.getState();
    const next = {
      start: performance.now(),
      paintedAt: null,
      armed: true,
      minimumGeneration: (state?.loadGeneration ?? 0) + 1,
      oldNode: globalThis.document.querySelector("#graph .node"),
    };
    globalThis.comparisonPaint = next;
  };
  function visible(node) {
    const box = node.getBoundingClientRect();
    if (
      !box.width ||
      !box.height ||
      box.right <= 0 ||
      box.bottom <= 0 ||
      box.left >= globalThis.innerWidth ||
      box.top >= globalThis.innerHeight
    )
      return false;
    for (let parent = node; parent; parent = parent.parentElement) {
      const style = globalThis.getComputedStyle(parent);
      if (
        style.display === "none" ||
        style.visibility === "hidden" ||
        Number(style.opacity) === 0
      )
        return false;
    }
    return true;
  }
  function poll() {
    const sample = globalThis.comparisonPaint;
    if (sample.armed && sample.paintedAt === null) {
      const controller = globalThis.comparisonApp?.getWebVowlController();
      const state = controller?.getState();
      const ready = controller
        ? state.status === "ready" &&
          state.loadGeneration >= sample.minimumGeneration &&
          controller
            .getOriginalSources()
            .some((source) => source.documentIri === rootIri)
        : globalThis.webvowl?.gr
            ?.options()
            .loadingModule()
            .successfullyLoadedOntology();
      const nodes = [...globalThis.document.querySelectorAll("#graph .node")];
      if (
        ready &&
        nodes.some((node) => node !== sample.oldNode && visible(node))
      ) {
        // Two frame callbacks permit the visible DOM to be painted once.
        sample.armed = false;
        globalThis.requestAnimationFrame(() =>
          globalThis.requestAnimationFrame(() => {
            sample.paintedAt = performance.now();
            sample.displayedNodes = nodes.filter(visible).length;
            sample.totalNodeElements = nodes.length;
            sample.stableFrames = 0;
          }),
        );
      }
    }
    if (sample.paintedAt !== null && !sample.settlementStatus) {
      const positions = [
        ...globalThis.document.querySelectorAll("#graph .node"),
      ].map((node) => {
        const matrix = node.getCTM();
        return [matrix?.e, matrix?.f];
      });
      const previous = sample.previousPositions;
      const stable =
        previous?.length === positions.length &&
        positions.length > 0 &&
        positions.every((point, index) =>
          point.every(
            (value, axis) =>
              Number.isFinite(value) &&
              Math.abs(value - previous[index][axis]) <= 0.5,
          ),
        );
      sample.stableFrames = stable ? sample.stableFrames + 1 : 0;
      sample.previousPositions = positions;
      if (sample.stableFrames >= 8) {
        sample.settlementStatus = "stable";
        sample.settledAt = performance.now();
      } else if (performance.now() - sample.paintedAt > 20000) {
        sample.settlementStatus = "timeout";
      }
    }
    globalThis.requestAnimationFrame(poll);
  }
  globalThis.requestAnimationFrame(poll);
}

/** Attach rejection handling at response time, retaining the original failure for the sink. */
export function observeLegacyConversion(response, conversions) {
  return Promise.allSettled([
    (async () => {
      const document = JSON.parse(await response.text());
      const entities = legacyNamedEntities(document);
      assert.equal(entities.class.length, 806);
      assert.equal(entities.property.length, 763);
      conversions.push({
        classes: entities.class.length,
        properties: entities.property.length,
      });
    })(),
  ]);
}

/** A stuck body cannot outlive the paint deadline indefinitely and prevent cleanup. */
export async function finishConversionObservation(
  jobs,
  paintFailure,
  timeoutMs = 5000,
) {
  let timer, outcomes;
  const failures = paintFailure ? [paintFailure] : [];
  try {
    outcomes = await Promise.race([
      Promise.all(jobs),
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("CONVERSION_RESPONSE_DRAIN_TIMEOUT")),
          timeoutMs,
        );
      }),
    ]);
  } catch (error) {
    failures.push(error);
  } finally {
    clearTimeout(timer);
  }
  failures.push(
    ...(outcomes ?? [])
      .flat()
      .filter((outcome) => outcome.status === "rejected")
      .map((outcome) => outcome.reason),
  );
  if (failures.length)
    throw new AggregateError(
      failures,
      "Original conversion response or graph observation failed",
    );
}

async function benchmark(options) {
  const iterations = Number(options.iterations ?? 3);
  assert(
    Number.isSafeInteger(iterations) && iterations >= 1 && iterations <= 5,
  );
  const inputs = await readComparisonInputs(options.ontologies);
  const archiveBytes = await readFile(options.archive);
  assert.equal(
    digest(archiveBytes),
    archiveSha256,
    "Original 1.1.7 archive drift",
  );
  const home = options["java-home"];
  const providerRoot = resolve(options.provider);
  const imported = (path) =>
    import(pathToFileURL(join(providerRoot, path)).href);
  const [
    { LocalArchive },
    { createProvider },
    { createHttpHandler },
    { createRetriever },
    { limits, requestVariant, createPolicy },
    { measurePackage },
    { tlsFixture },
    { codedProvider },
  ] = await Promise.all([
    imported("src/archive.mjs"),
    imported("src/provider.mjs"),
    imported("src/http.mjs"),
    imported("src/retrieval.mjs"),
    imported("src/policy.mjs"),
    imported("src/package-evidence.mjs"),
    imported("test/tls-fixture.mjs"),
    imported("test/coded-provider.mjs"),
  ]);
  const scratch = await mkdtemp(join(tmpdir(), "webvowl-e2e-comparison-"));
  let tls, origin, service, staticServer, provider, archive, browser, java;
  let backendLog = "";
  let artifact, policy, serviceOrigin, failure;
  let failed = false;
  const cleanupErrors = [];
  const sourceCalls = [],
    providerCalls = [],
    samples = [],
    failures = [];
  try {
    const frozenArchive = join(scratch, "original-archive.zip");
    await writeFile(frozenArchive, archiveBytes);
    await run(javaExecutable(home, "jar"), ["xf", frozenArchive], {
      cwd: scratch,
      windowsHide: true,
    });
    assert.equal(digest(await readFile(join(scratch, "ROOT.war"))), warSha256);
    const war = join(scratch, "war");
    // jar creates its destination with -C only in create mode, so use native mkdir first.
    const { mkdir } = await import("node:fs/promises");
    await mkdir(war);
    await run(javaExecutable(home, "jar"), ["xf", join(scratch, "ROOT.war")], {
      cwd: war,
      windowsHide: true,
    });
    const manifest = await writeLegacySources(inputs, scratch);
    const classpath = [
      scratch,
      join(war, "WEB-INF/classes"),
      join(war, "WEB-INF/lib/*"),
      ...["core", "el", "websocket"].map((kind) =>
        join(
          options.tomcat,
          "tomcat-embed-" + kind,
          "8.5.16",
          "tomcat-embed-" + kind + "-8.5.16.jar",
        ),
      ),
    ].join(delimiter);
    await run(
      javaExecutable(home, "javac"),
      [
        "--release",
        "8",
        "-Xlint:all,-options",
        "-cp",
        classpath,
        "-d",
        scratch,
        join(checkout, "util/fixtures/LegacyOwl2VowlBenchmark.java"),
      ],
      { windowsHide: true, timeout: 30000 },
    );
    artifact = await measurePackage();
    policy = createPolicy(artifact, "compatible");
    tls = await tlsFixture();
    const sourceByIri = new Map(
      inputs.flatMap((input) => [
        [input.documentIri, input],
        [input.documentIri.replace(/^http:/u, "https:"), input],
      ]),
    );
    origin = https.createServer(tls, (request, response) => {
      const target = new URL(request.url, "https://localhost");
      const iri =
        target.searchParams.get("iri") ??
        "https://" + request.headers.host + target.pathname;
      const input = sourceByIri.get(iri);
      sourceCalls.push({ iri, browserDirect: target.pathname === "/source" });
      if (!input) {
        response.writeHead(404);
        response.end();
        return;
      }
      const bytes = Buffer.from(input.base64, "base64");
      response.writeHead(200, {
        "content-type": input.mediaType,
        "content-length": String(bytes.length),
        "cache-control": "public, max-age=86400",
      });
      response.end(bytes);
    });
    const originPort = await listen(origin);
    const fixtureOrigin = "https://127.0.0.1:" + originPort;
    const retrieve = createRetriever({
      limits,
      requestVariant,
      resolve: async () => [{ address: "93.184.216.34", family: 4 }],
      connect: async (url, _address, headers, signal) =>
        new Promise((resolve, reject) => {
          const request = https.request(
            {
              hostname: "localhost",
              port: originPort,
              path: url.pathname + url.search,
              headers: { ...headers, host: url.host },
              ca: tls.cert,
              signal,
              servername: "localhost",
              lookup: (_host, opts, done) =>
                opts.all
                  ? done(null, [{ address: "127.0.0.1", family: 4 }])
                  : done(null, "127.0.0.1", 4),
            },
            resolve,
          );
          request.once("error", reject);
          request.end();
        }),
    });
    service = https.createServer(tls, (request, response) =>
      handler(request, response),
    );
    serviceOrigin = "https://127.0.0.1:" + (await listen(service));
    let handler;
    function resetProvider() {
      archive = new LocalArchive();
      provider = createProvider({
        archive,
        origin: serviceOrigin,
        policy,
        retrieve,
        admissionEnabled: true,
        onFailure: (error) => failures.push(error.message),
      });
      handler = createHttpHandler(codedProvider(provider), {
        localCors: true,
        onRequest: (request) => providerCalls.push(request),
      });
    }
    resetProvider();
    const output = join(scratch, "production");
    await build({
      root: join(checkout, "src"),
      configFile: join(checkout, "vite.config.mjs"),
      logLevel: "error",
      plugins: [
        {
          name: "isolated-materialization-composition",
          enforce: "pre",
          transform(code, id) {
            if (id !== join(checkout, "src/main.js").replaceAll("\\", "/"))
              return;
            const original =
              "const application = createCanonicalWebVowlApplication();";
            assert(
              code.includes(original),
              "The production entry composition changed",
            );
            return (
              code.replace(
                original,
                "const application = createCanonicalWebVowlApplication({ontologyLoadingConfiguration:{enabled:true,serviceOrigin:" +
                  JSON.stringify(serviceOrigin) +
                  ",approvedPolicyFingerprints:[" +
                  JSON.stringify(policy.loaderProfileFingerprint) +
                  "]}});",
              ) + "\nglobalThis.comparisonApp = application;\n"
            );
          },
        },
      ],
      build: { outDir: output, emptyOutDir: true },
    });
    const mime = {
      ".html": "text/html",
      ".js": "text/javascript",
      ".css": "text/css",
      ".json": "application/json",
      ".woff2": "font/woff2",
      ".woff": "font/woff",
      ".svg": "image/svg+xml",
      ".ico": "image/x-icon",
    };
    staticServer = httpServer(async (request, response) => {
      try {
        const path = new URL(request.url, "http://localhost").pathname;
        const file = resolve(
          output,
          "." + (path === "/" ? "/index.html" : decodeURIComponent(path)),
        );
        assert(!relative(output, file).startsWith(".."));
        const bytes = await readFile(file),
          extension = file.slice(file.lastIndexOf("."));
        response.writeHead(200, {
          "content-type": mime[extension] ?? "application/octet-stream",
          "content-length": String(bytes.length),
          "cache-control": "public, max-age=3600",
        });
        response.end(bytes);
      } catch {
        response.writeHead(404);
        response.end();
      }
    });
    const currentOrigin = "http://127.0.0.1:" + (await listen(staticServer));
    const playwright = await import(
      pathToFileURL(resolve(options.playwright)).href
    );
    browser = await playwright.webkit.launch({
      headless: true,
      executablePath: resolve(options.executable),
    });
    async function startJava(iteration) {
      const reserve = httpServer(),
        port = await listen(reserve);
      await closeServer(reserve);
      backendLog = "";
      java = spawn(
        javaExecutable(home, "java"),
        [
          "--add-opens=java.base/java.lang=ALL-UNNAMED",
          "-Xmx1536m",
          "-XX:ActiveProcessorCount=2",
          "-cp",
          classpath,
          "LegacyOwl2VowlBenchmark",
          manifest,
          "--serve",
          "--server.address=127.0.0.1",
          "--server.port=" + port,
          "--server.tomcat.basedir=" + join(scratch, "tomcat-" + iteration),
        ],
        { cwd: scratch, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
      );
      java.stdout.on("data", (bytes) => {
        backendLog += bytes;
      });
      java.stderr.on("data", (bytes) => {
        backendLog += bytes;
      });
      java.on("error", (error) => failures.push(error.message));
      const origin = "http://127.0.0.1:" + port;
      const started = performance.now();
      while (performance.now() - started < 30000) {
        assert(
          java.exitCode === null,
          "Original Java service exited: " + backendLog.slice(-2000),
        );
        try {
          const response = await fetch(origin + "/serverTimeStamp", {
            signal: AbortSignal.timeout(500),
          });
          if (response.ok) return origin;
        } catch {
          /* Readiness only, outside timed browser jobs. */
        }
        await sleep(50);
      }
      throw new Error(
        "Original HTTP service startup timed out: " + backendLog.slice(-2000),
      );
    }
    async function runBrowser(
      path,
      origin,
      iteration,
      initialTemperature = "cold",
      reload = true,
    ) {
      const initialOrigins = sourceCalls.filter(
        (call) => !call.browserDirect,
      ).length;
      const initialProviderCalls = providerCalls.length;
      const context = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
        ignoreHTTPSErrors: true,
      });
      await context.addInitScript(installPaintProbe, {
        originalIris: inputs.map((input) => input.documentIri),
        fixtureOrigin,
        rootIri,
        profileWorkers: options["profile-workers"] === true,
      });
      const page = await context.newPage();
      const pageErrors = [];
      const corsErrors = [];
      const expectedCorsErrors = new Set(
        inputs.flatMap((input) =>
          [
            input.documentIri,
            input.documentIri.replace(/^http:/u, "https:"),
          ].map(
            (iri) =>
              "/" +
              new URL(fixtureOrigin).host +
              "/source?iri=" +
              encodeURIComponent(iri) +
              " due to access control checks.",
          ),
        ),
      );
      page.on("pageerror", (error) => {
        (expectedCorsErrors.has(error.message) ? corsErrors : pageErrors).push(
          error.message,
        );
      });
      const conversions = [];
      const responseJobs = [];
      page.on("response", (response) => {
        if (new URL(response.url()).pathname === "/convert" && response.ok()) {
          responseJobs.push(observeLegacyConversion(response, conversions));
        }
      });
      async function result(temperature) {
        let paintFailure;
        await page
          .waitForFunction(
            () => Boolean(globalThis.comparisonPaint.settlementStatus),
            undefined,
            { timeout: 120000 },
          )
          .catch((error) => {
            paintFailure = error;
          });
        await finishConversionObservation(responseJobs, paintFailure);
        const sample = await page.evaluate(
          async ({ path, temperature, iteration }) => {
            const run = globalThis.comparisonPaint;
            const controller = globalThis.comparisonApp?.getWebVowlController();
            const original = globalThis.webvowl?.gr;
            const sources = controller?.getOriginalSources();
            return {
              path,
              temperature,
              iteration,
              milliseconds: run.paintedAt - run.start,
              settledMilliseconds:
                run.settledAt === undefined ? null : run.settledAt - run.start,
              settlementStatus: run.settlementStatus,
              displayedNodes: run.displayedNodes,
              totalNodeElements: run.totalNodeElements,
              state: controller?.getState(),
              sources: sources?.map((source) => ({ iri: source.documentIri })),
              workerMeasures: globalThis.comparisonWorkerMeasures,
              network: performance
                .getEntriesByType("resource")
                .map((entry) => ({
                  name: entry.name,
                  start: entry.startTime - run.start,
                  milliseconds: entry.duration,
                })),
              legacyModel: original
                ? {
                    nodes: original.getUnfilteredData().nodes.length,
                    properties: original.getUnfilteredData().properties.length,
                  }
                : undefined,
              measures: performance
                .getEntriesByType("measure")
                .map((entry) => ({
                  name: entry.name,
                  duration: entry.duration,
                })),
            };
          },
          { path, temperature, iteration },
        );
        if (!options["profile-network"]) delete sample.network;
        if (path === "current") {
          assert.equal(
            sample.sources.length,
            inputs.length,
            "Incomplete current import closure",
          );
          assert.deepEqual(
            sample.sources.map((source) => source.iri).sort(),
            // The normal retriever prefers HTTPS. Logical HTTP import/entity
            // IRIs remain unchanged, while parser document bases use retrieval.
            inputs
              .map((input) => input.documentIri.replace(/^http:/u, "https:"))
              .sort(),
          );
          assert.equal(sample.state.source.owlMappingStrategy, "heuristic");
        }
        assert.deepEqual(pageErrors, []);
        samples.push(sample);
        console.log(
          JSON.stringify({
            kind: "webvowl-end-to-end-sample",
            ...sample,
            state: undefined,
            originAcquisitions: sourceCalls.filter(
              (call) => !call.browserDirect,
            ).length,
            browserCorsAttempts: sourceCalls.filter(
              (call) => call.browserDirect,
            ).length,
            providerRequests: providerCalls.length,
            conversions: conversions.length,
            expectedBrowserCorsErrors: corsErrors.length,
          }),
        );
      }
      try {
        await page.goto(origin + "/#iri=" + encodeURIComponent(rootIri), {
          waitUntil: "domcontentloaded",
        });
        await result(initialTemperature);
        if (!reload) {
          if (path === "current") {
            assert.equal(
              sourceCalls.filter((call) => !call.browserDirect).length,
              initialOrigins,
            );
            assert(
              !providerCalls
                .slice(initialProviderCalls)
                .some((call) =>
                  call.pathname.startsWith("/ontology/materializations"),
                ),
              "A fresh warm browser called the control plane",
            );
            assert.equal(
              corsErrors.length,
              0,
              "A fresh warm browser retried direct source acquisition",
            );
          }
          return;
        }
        const beforeOrigins = sourceCalls.length,
          beforeProvider = providerCalls.length,
          beforeConversions = conversions.length;
        await page.evaluate((rootIri) => {
          globalThis.armComparisonPaint();
          if (globalThis.comparisonApp) {
            globalThis.comparisonReloadPromise = globalThis.comparisonApp
              .getWebVowlController()
              .loadOntology({
                source: { kind: "ontology-document-iri", documentIri: rootIri },
              })
              .catch((error) => {
                globalThis.comparisonReloadError = error.message;
              });
          } else {
            globalThis.webvowl.gr
              .options()
              .loadingModule()
              .parseUrlAndLoadOntology();
          }
        }, rootIri);
        await result("same-session-warm");
        const warm = {
          path,
          iteration,
          sourceRequests: sourceCalls.length - beforeOrigins,
          providerRequests: providerCalls.length - beforeProvider,
          controlPlaneRequests: providerCalls
            .slice(beforeProvider)
            .filter((call) =>
              call.pathname.startsWith("/ontology/materializations"),
            ).length,
          conversions: conversions.length - beforeConversions,
        };
        console.log(JSON.stringify({ kind: "webvowl-warm-requests", ...warm }));
        if (path === "current")
          assert.equal(
            sourceCalls.length,
            beforeOrigins,
            "Warm load reacquired an origin",
          );
        if (path === "current")
          assert.equal(
            warm.controlPlaneRequests,
            0,
            "Warm load called the control plane",
          );
        if (path === "current") {
          const targets = await page.evaluate(async () => {
            await globalThis.comparisonReloadPromise;
            if (globalThis.comparisonReloadError)
              throw new Error(globalThis.comparisonReloadError);
            const controller = globalThis.comparisonApp.getWebVowlController();
            return [
              "http://www.w3.org/2004/02/skos/core#Concept",
              "http://www.w3.org/2006/time#Instant",
              "http://www.w3.org/ns/time/gregorian/April",
            ].map((iri) => ({
              iri,
              found:
                controller.findOntologyElements({ query: iri }).matches.length >
                0,
            }));
          });
          assert(
            targets.every((target) => target.found),
            JSON.stringify(targets),
          );
          assert.equal(
            corsErrors.length,
            inputs.length,
            "Each cold direct acquisition must fail real browser CORS before materialization",
          );
          assert.equal(
            sourceCalls.filter((call) => !call.browserDirect).length,
            inputs.length,
            "Exactly seven origins must be acquired",
          );
        }
        if (path === "legacy") {
          assert.equal(
            conversions.length,
            beforeConversions,
            "Original warm reload did not reuse the native JSON cache",
          );
          assert(
            new Set(
              backendLog
                .split(/\r?\n/u)
                .filter((line) => line.startsWith("FROZEN_SOURCE ")),
            ).size === inputs.length,
          );
        }
      } finally {
        await context.close();
      }
    }
    for (let iteration = 0; iteration < iterations; iteration++) {
      if (iteration) {
        await provider.close();
        archive.close();
        resetProvider();
      }
      sourceCalls.length = 0;
      providerCalls.length = 0;
      if (!options["current-only"]) {
        const legacyOrigin = await startJava(iteration);
        await runBrowser("legacy", legacyOrigin, iteration);
        if (options["fresh-session-warm"])
          await runBrowser(
            "legacy",
            legacyOrigin,
            iteration,
            "fresh-session-warm",
            false,
          );
        await stopJava(java);
        java = undefined;
      }
      await runBrowser("current", currentOrigin, iteration);
      if (options["fresh-session-warm"]) {
        provider.setAdmission(false);
        await runBrowser(
          "current",
          currentOrigin,
          iteration,
          "fresh-session-warm",
          false,
        );
      }
    }
    assert.deepEqual(failures, []);
    if (options["assert-parity"]) assertOriginalParity(samples);
    console.log(
      JSON.stringify({
        kind: "webvowl-end-to-end-comparison",
        browser: browser.version(),
        archiveSha256,
        warSha256,
        owlapi: artifact.sourceCommit,
        samples: samples.map(
          ({
            path,
            temperature,
            iteration,
            milliseconds,
            settledMilliseconds,
            settlementStatus,
            displayedNodes,
            totalNodeElements,
          }) => ({
            path,
            temperature,
            iteration,
            milliseconds,
            settledMilliseconds,
            settlementStatus,
            displayedNodes,
            totalNodeElements,
          }),
        ),
        scope:
          "Production-mode current frontend with isolated cache-enabled composition versus original 1.1.7 WAR and actual 0.3.7 HTTP service. Same seven hash-pinned bytes/logical IRIs, 1440x1000 WebKit, navigation or native reload to visible painted graph. Cold starts a fresh ready JVM and browser context and empty provider; warm retains the page and native application/provider caches. Controlled origin boundaries; no Internet source acquisition, AWS, deployment or activation. Java25/Tomcat8.5.16 compatibility environment, not the historical Java8 host. Rendering defaults and visible counts are reported, not assumed equivalent.",
      }),
    );
  } catch (error) {
    failed = true;
    failure = error;
  } finally {
    for (const cleanup of [
      () => stopJava(java),
      () => browser?.close(),
      () => closeServer(staticServer),
      () => closeServer(service),
      () => provider?.close(),
      () => archive?.close(),
      () => closeServer(origin),
      () => tls?.dispose(),
      () => rm(scratch, { recursive: true, force: true }),
    ]) {
      try {
        await cleanup();
      } catch (error) {
        cleanupErrors.push(error);
      }
    }
  }
  if (cleanupErrors.length)
    throw new AggregateError(
      [...(failed ? [failure] : []), ...cleanupErrors],
      "Benchmark cleanup failed",
    );
  if (failed) throw failure;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const { values } = parseArgs({
    options: {
      ...Object.fromEntries(
        [
          "archive",
          "ontologies",
          "provider",
          "playwright",
          "java-home",
          "tomcat",
          "executable",
          "iterations",
        ].map((name) => [name, { type: "string" }]),
      ),
      "fresh-session-warm": { type: "boolean" },
      "profile-workers": { type: "boolean" },
      "profile-network": { type: "boolean" },
      "current-only": { type: "boolean" },
      "assert-parity": { type: "boolean" },
    },
  });
  for (const name of [
    "archive",
    "ontologies",
    "provider",
    "playwright",
    "java-home",
    "tomcat",
    "executable",
  ])
    assert(values[name], "Missing --" + name);
  await benchmark(values);
}
