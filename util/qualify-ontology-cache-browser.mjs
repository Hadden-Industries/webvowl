import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createServer } from "node:https";
import { mkdtemp, readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import canonicalize from "canonicalize";

// Caller-selected installed Playwright and browsers; no installation or production activation.
const [runtimePath, engine, baseUrl, outputDirectory, openssl, executablePath] =
  process.argv.slice(2);
assert(
  runtimePath &&
    ["chromium", "firefox", "webkit"].includes(engine) &&
    baseUrl &&
    outputDirectory &&
    openssl,
  "Usage: node util/qualify-ontology-cache-browser.mjs <playwright index.mjs> <engine> <dev URL> <evidence directory> <openssl>",
);
const playwright = await import(pathToFileURL(resolve(runtimePath)).href);
const fixtures = JSON.parse(
  await readFile(
    new URL(
      "../src/ontology-loading/contracts/fixtures/protocol-cases.v1.json",
      import.meta.url,
    ),
  ),
);
const example = (id) =>
  structuredClone(
    fixtures.schemaExamples.find((entry) => entry.id === id).value,
  );
const scratch = await mkdtemp(join(tmpdir(), "webvowl-cache-browser-"));
const output = resolve(outputDirectory);
await mkdir(output, { recursive: true });
const receipt = {
  engine,
  checks: [],
  errors: [],
  scope:
    "controlled HTTPS protocol with real browser CORS, Fetch and production worker; not AWS/provider qualification",
};
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const identity = (domain, value) =>
  hash(`hadden-ontology-cache/${domain}/v1\n${canonicalize(value)}`);
let browser;
let server;
let serviceOrigin;
let changed = false;
const requests = [];
const admitted = new Set();
const records = new Map();
const sources = new Map();
const documentIri = fixtures.ontologySource.parserDocumentIri;
const originalIri = example("A-resolution").requestedDocumentIri;
const childIri = fixtures.ontologySource.expectedResolvedImportIri;

function representation(
  text,
  requestedDocumentIri,
  parserDocumentIri,
  generation,
) {
  const bytes = Buffer.from(text);
  const sourceKey = hash(requestedDocumentIri);
  const artifactSha256 = hash(bytes);
  const sourceVersionIdentity = identity("source-version", {
    sourceKey,
    artifactSha256,
    effectiveRetrievalIri: parserDocumentIri,
    parserDocumentIri,
  });
  const validation = example("A-validation");
  Object.assign(validation.identityInputs, {
    artifactSha256,
    parserDocumentIri,
  });
  validation.validationIdentity = identity(
    "document-validation",
    validation.identityInputs,
  );
  const resolution = example("A-resolution");
  Object.assign(resolution, {
    sourceKey,
    generation,
    requestedDocumentIri,
    retrievalIri: parserDocumentIri,
    effectiveRetrievalIri: parserDocumentIri,
    parserDocumentIri,
    artifactSha256,
    artifactByteLength: bytes.length,
    sourceVersionIdentity,
    validationIdentity: validation.validationIdentity,
    artifactIri: `${serviceOrigin}/ontology/cache/artifacts/sha256/${artifactSha256}`,
    validationIri: `${serviceOrigin}/ontology/cache/validations/sha256/${validation.validationIdentity}.json`,
    loaderPolicyIri: `${serviceOrigin}/ontology/cache/policies/sha256/${resolution.loaderProfileFingerprint}.json`,
  });
  const projection = { ...resolution };
  delete projection.resolutionIdentity;
  resolution.resolutionIdentity = identity("resolution", projection);
  const version = {
    schemaVersion: 1,
    kind: "source-version",
    sourceVersionIdentity,
    sourceKey,
    requestedDocumentIri,
    artifactSha256,
    artifactByteLength: bytes.length,
    effectiveRetrievalIri: parserDocumentIri,
    parserDocumentIri,
  };
  const binding = {
    sourceVersionIdentity,
    resolutionIdentity: resolution.resolutionIdentity,
    validationIdentity: validation.validationIdentity,
    artifactSha256,
    artifactByteLength: bytes.length,
    artifactIri: resolution.artifactIri,
    resolutionIri: `${serviceOrigin}/ontology/cache/resolutions/sha256/${resolution.resolutionIdentity}.json`,
    versionIri: `${serviceOrigin}/ontology/cache/versions/sha256/${sourceVersionIdentity}.json`,
    validationIri: resolution.validationIri,
  };
  records.set(new URL(binding.resolutionIri).pathname, resolution);
  records.set(new URL(binding.versionIri).pathname, version);
  records.set(new URL(binding.validationIri).pathname, validation);
  records.set(
    new URL(resolution.loaderPolicyIri).pathname,
    example("loader-policy"),
  );
  records.set(new URL(binding.artifactIri).pathname, bytes);
  const pointer = {
    ...example("source-current"),
    requestedDocumentIri,
    sourceKey,
    generation,
    currentBinding: binding,
    freshUntil: "2027-10-28T00:00:00.000Z",
    nextCheckAllowedAt: "2027-10-28T00:00:00.000Z",
  };
  return { pointer, binding, resolution, bytes };
}

try {
  execFileSync(
    openssl,
    [
      "req",
      "-x509",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-days",
      "1",
      "-subj",
      "/CN=localhost",
      "-addext",
      "subjectAltName=DNS:localhost,IP:127.0.0.1",
      "-keyout",
      join(scratch, "key.pem"),
      "-out",
      join(scratch, "cert.pem"),
    ],
    { windowsHide: true, stdio: "pipe" },
  );
  server = createServer(
    {
      key: await readFile(join(scratch, "key.pem")),
      cert: await readFile(join(scratch, "cert.pem")),
    },
    async (request, response) => {
      const url = new URL(request.url, serviceOrigin);
      requests.push({ method: request.method, pathname: url.pathname });
      response.setHeader("access-control-allow-origin", "*");
      response.setHeader("access-control-allow-methods", "GET, POST, OPTIONS");
      response.setHeader(
        "access-control-allow-headers",
        "content-type, x-amz-content-sha256",
      );
      response.setHeader(
        "access-control-expose-headers",
        "location, retry-after, etag",
      );
      response.setHeader("cache-control", "no-store");
      if (request.method === "OPTIONS") {
        response.writeHead(204).end();
        return;
      }
      const json = (value, status = 200, headers = {}) => {
        response
          .writeHead(status, { "content-type": "application/json", ...headers })
          .end(JSON.stringify(value));
      };
      const redirect = (record) => {
        response
          .writeHead(303, {
            location: `${record.binding.artifactIri}?source=${record.pointer.sourceKey}&binding=${record.binding.resolutionIdentity}`,
          })
          .end();
      };
      try {
        if (request.method === "POST") {
          const chunks = [];
          for await (const chunk of request) {
            chunks.push(chunk);
          }
          const bytes = Buffer.concat(chunks);
          assert(bytes.length <= 8192);
          assert.equal(request.headers["x-amz-content-sha256"], hash(bytes));
          const body = JSON.parse(bytes);
          const entry = sources.get(hash(body.requestedDocumentIri));
          assert(entry, "Only the two fixture sources may be submitted");
          if (url.pathname.endsWith("/refreshes")) {
            const pending = {
              ...example("refresh-pending"),
              sourceKey: entry.a.pointer.sourceKey,
              mode: body.mode,
              baselineBinding: entry.a.binding,
            };
            pending.statusIri = `${serviceOrigin}/ontology/materializations/${pending.sourceKey}/refreshes/${pending.refreshAttemptId}`;
            entry.pending = pending;
            json(pending, 202, {
              location: pending.statusIri,
              "retry-after": "0",
            });
          } else {
            admitted.add(entry.a.pointer.sourceKey);
            redirect(entry.a);
          }
        } else if (url.pathname.includes("/refreshes/")) {
          const key = url.pathname.split("/")[3];
          const entry = sources.get(key);
          const b = entry.b ?? entry.refreshed ?? entry.a;
          changed = Boolean(entry.b);
          json({
            ...example(entry.b ? "refresh-changed" : "refresh-unchanged"),
            ...entry.pending,
            state: entry.b ? "CHANGED" : "UNCHANGED",
            upstreamStatus: entry.b ? 200 : 304,
            finishedAt: "2026-10-02T00:00:02.000Z",
            resultBinding: b.binding,
          });
        } else if (url.pathname.startsWith("/ontology/materializations/")) {
          const entry = sources.get(url.pathname.split("/")[3]);
          redirect(changed && entry.b ? entry.b : entry.a);
        } else if (url.pathname.includes("/provenance/sources/")) {
          const key = url.pathname.split("/").at(-1).replace(".json", "");
          const entry = sources.get(key);
          // Deliberately retain the old static pointer after refresh: explicit selection must win.
          if (!entry || !admitted.has(key)) {
            response.writeHead(404).end();
          } else {
            json(entry.a.pointer);
          }
        } else if (records.has(url.pathname)) {
          const value = records.get(url.pathname);
          const bytes = Buffer.isBuffer(value)
            ? value
            : Buffer.from(JSON.stringify(value));
          const etag = `"${hash(bytes)}"`;
          response.setHeader(
            "cache-control",
            "public, max-age=0, must-revalidate",
          );
          response.setHeader("etag", etag);
          if (request.headers["if-none-match"] === etag) {
            receipt.conditionalResponses =
              (receipt.conditionalResponses ?? 0) + 1;
            response.writeHead(304).end();
          } else {
            response
              .writeHead(200, {
                "content-type": Buffer.isBuffer(value)
                  ? "application/octet-stream"
                  : "application/json",
              })
              .end(bytes);
          }
        } else {
          response.writeHead(404).end();
        }
      } catch (error) {
        receipt.errors.push(error.message);
        response.writeHead(500).end();
      }
    },
  );
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  serviceOrigin = `https://localhost:${server.address().port}`;
  const rootA = representation(
    fixtures.ontologySource.utf8Text,
    originalIri,
    documentIri,
    1,
  );
  const rootB = representation(
    fixtures.ontologySource.utf8Text + "<#Other> a owl:Class .\n",
    originalIri,
    documentIri,
    2,
  );
  const child = representation(
    "@prefix owl: <http://www.w3.org/2002/07/owl#> .\n<> a owl:Ontology .\n<#Child> a owl:Class .\n",
    childIri,
    childIri,
    1,
  );
  const refreshedChild = representation(
    child.bytes.toString("utf8"),
    childIri,
    childIri,
    2,
  );
  sources.set(rootA.pointer.sourceKey, { a: rootA, b: rootB });
  sources.set(child.pointer.sourceKey, { a: child, refreshed: refreshedChild });
  const workloads = [2000, 10000].map((count) => {
    const iri = `https://workload.example.test/workload-${count}.ttl`;
    const declarations = Array.from(
      { length: count },
      (_, index) =>
        `<#C${index}> a owl:Class${index === 0 ? "" : ` ; <http://www.w3.org/2000/01/rdf-schema#subClassOf> <#C${Math.floor((index - 1) / 4)}>`} .`,
    ).join("\n");
    const value = representation(
      `@prefix owl: <http://www.w3.org/2002/07/owl#> .\n<> a owl:Ontology .\n${declarations}\n`,
      iri,
      iri,
      1,
    );
    sources.set(value.pointer.sourceKey, { a: value });
    admitted.add(value.pointer.sourceKey);
    return { count, iri, bytes: value.bytes };
  });
  browser = await playwright[engine].launch({
    headless: true,
    ...(executablePath ? { executablePath } : {}),
  });
  receipt.executablePath =
    executablePath ?? playwright[engine].executablePath();
  receipt.version = browser.version();
  const page = await browser.newPage({
    ignoreHTTPSErrors: true,
    viewport: { width: 1440, height: 900 },
  });
  page.setDefaultTimeout(60000);
  page.on("pageerror", (error) => receipt.errors.push(error.message));
  const startupRequests = [];
  page.on("request", (request) => startupRequests.push(request.url()));
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.evaluate(() => {
    globalThis.cacheMainUrl = [...globalThis.document.scripts].find((script) =>
      script.src.includes("/main.js"),
    ).src;
  });
  await page.waitForFunction(
    async () =>
      (await import(globalThis.cacheMainUrl)).application
        .getWebVowlController()
        .getState().status === "ready",
  );
  assert(
    !startupRequests.some((url) =>
      /ontology\/cache|ontology\/materializations|ontologyCacheValidators|ontologyMaterializationClient|cachedOntologySourceAcquisition/u.test(
        url,
      ),
    ),
  );
  assert(await page.locator("#ontologyCacheSource").isHidden());
  receipt.checks.push(
    "disabled production composition: zero cache traffic/modules/controls",
  );
  await page.evaluate(
    async ({ serviceOrigin, policy }) => {
      const { application } = await import(globalThis.cacheMainUrl);
      application.dispose();
      const { createCanonicalWebVowlApplication } =
        await import("/app/js/canonicalApplication.js");
      const next = createCanonicalWebVowlApplication({
        ontologyLoadingConfiguration: {
          enabled: true,
          serviceOrigin,
          approvedPolicyFingerprints: [policy],
        },
      });
      globalThis.cacheQualification = {
        application: next,
        controller: next.getWebVowlController(),
      };
      await next.initialize();
    },
    { serviceOrigin, policy: rootA.resolution.loaderProfileFingerprint },
  );
  const open = () =>
    page.evaluate(async (iri) => {
      const controller = globalThis.cacheQualification.controller;
      await controller.loadOntology({
        source: { kind: "ontology-document-iri", documentIri: iri },
      });
      return {
        state: controller.getState(),
        documents: controller.getOriginalSources(),
        thing: controller.findOntologyElements({ query: "Thing" }),
        child: controller.findOntologyElements({ query: "Child" }),
      };
    }, originalIri);
  const first = await open();
  assert.equal(first.documents.length, 2);
  assert.equal(first.thing.matches.length, 1);
  assert.equal(first.child.matches.length, 1);
  assert(first.documents.some((record) => record.documentIri === documentIri));
  assert(
    first.documents.every(
      (record) => !record.documentIri.startsWith(serviceOrigin),
    ),
  );
  assert(requests.some((request) => request.method === "OPTIONS"));
  assert.equal(
    requests.filter((request) => request.method === "POST").length,
    2,
  );
  receipt.checks.push(
    "cold root and relative import: native CORS preflight, exact POST hash, automatic 303, verified origin context and real worker admission",
  );
  await open();
  await open();
  assert.equal(
    requests.filter((request) => request.method === "POST").length,
    2,
  );
  assert(await page.locator("#ontologyCacheSource").isVisible());
  receipt.httpCache304 = {
    observedResponses: receipt.conditionalResponses ?? 0,
    scope:
      "Self-signed controlled HTTPS fixture. Deployed CDN/browser cache and 304 qualification remains open.",
  };
  receipt.checks.push(
    "fresh warm open: roots/imports, archive dates and no refresh request",
  );
  await page.locator("#checkOntologySourceUpdate").click();
  await page.waitForFunction(
    () =>
      globalThis.cacheQualification.controller.getState().source?.cache
        ?.status === "update-available",
  );
  const before = await page.evaluate(
    () =>
      globalThis.cacheQualification.controller.findOntologyElements({
        query: "Other",
      }).matches.length,
  );
  assert.equal(before, 0);
  await page.locator("#applyOntologySourceUpdate").click();
  await page.waitForFunction(
    () =>
      globalThis.cacheQualification.controller.getState().status === "ready" &&
      globalThis.cacheQualification.controller.findOntologyElements({
        query: "Other",
      }).matches.length === 1,
  );
  receipt.checks.push(
    "nonblocking update notice and explicit confirmed readmission override stale discovery",
  );
  await page.screenshot({ path: join(output, "cache-source.png") });
  // The external direct-origin boundary supplies the same fixed representation as
  // the cache. Fetch to the cache itself remains native, as in the CORS check above.
  await page.evaluate(
    (workloads) => {
      const nativeFetch = globalThis.fetch;
      globalThis.fetch = async (url, options) => {
        const workload = workloads.find((entry) => entry.iri === url);
        if (!workload) {
          return nativeFetch(url, options);
        }
        options?.signal?.throwIfAborted();
        const response = new Response(new Uint8Array(workload.bytes), {
          headers: { "content-type": "text/turtle" },
        });
        Object.defineProperty(response, "url", { value: workload.iri });
        return response;
      };
    },
    workloads.map(({ iri, bytes }) => ({ iri, bytes: [...bytes] })),
  );
  receipt.workloads = [];
  for (const workload of workloads) {
    const result = await page.evaluate(
      async ({ workload, serviceOrigin, policy }) => {
        const { createCanonicalWebVowlApplication } =
          await import("/app/js/canonicalApplication.js");
        const results = [];
        for (const enabled of [false, true]) {
          globalThis.cacheQualification.application.dispose();
          const application = createCanonicalWebVowlApplication({
            ontologyLoadingConfiguration: {
              enabled,
              serviceOrigin,
              approvedPolicyFingerprints: [policy],
            },
          });
          const controller = application.getWebVowlController();
          globalThis.cacheQualification = { application, controller };
          await application.initialize();
          const start = performance.now();
          await controller.loadOntology(
            {
              source: {
                kind: "ontology-document-iri",
                documentIri: workload.iri,
              },
            },
            { useAutomaticNodesShown: true },
          );
          results.push({
            enabled,
            elapsedMs: performance.now() - start,
            eligible: controller.getState().nodeCountStatus.eligibleNodeCount,
            matches: controller.findOntologyElements({
              query: `C${workload.count - 1}`,
            }).matches.length,
            parserIri: controller.getOriginalSources()[0].documentIri,
          });
        }
        return results;
      },
      {
        workload: { count: workload.count, iri: workload.iri },
        serviceOrigin,
        policy: rootA.resolution.loaderProfileFingerprint,
      },
    );
    assert.equal(result[0].eligible, workload.count);
    assert.equal(result[1].eligible, workload.count);
    assert.equal(result[0].matches, 1);
    assert.equal(result[1].matches, 1);
    assert.equal(result[0].parserIri, workload.iri);
    assert.equal(result[1].parserIri, workload.iri);
    assert(result.every(({ elapsedMs }) => elapsedMs < 60000));
    receipt.workloads.push({
      count: workload.count,
      results: result,
      qualification:
        "same semantic count/context and finite desktop deadline; functional timing, not an isolated performance benchmark",
    });
  }
  receipt.checks.push(
    "2,000/10,000-class direct/cache workloads retain counts, context and desktop deadline in real workers",
  );
  await page.evaluate(() =>
    globalThis.cacheQualification.application.dispose(),
  );
  assert.deepEqual(receipt.errors, []);
  receipt.status = "PASS";
} catch (error) {
  receipt.status = "FAIL";
  receipt.errors.push(error.stack ?? error.message);
  process.exitCode = 1;
} finally {
  await browser?.close();
  if (server) {
    server.closeAllConnections();
    await new Promise((done) => server.close(done));
  }
  // This directory is created and owned solely by this invocation; remove its short-lived key/cert.
  assert(
    resolve(scratch).startsWith(
      resolve(tmpdir()) + "\\webvowl-cache-browser-",
    ) ||
      resolve(scratch).startsWith(
        resolve(tmpdir()) + "/webvowl-cache-browser-",
      ),
  );
  await rm(scratch, { recursive: true });
  await writeFile(
    join(output, "result.json"),
    JSON.stringify(receipt, null, 2) + "\n",
  );
  process.stdout.write(
    `${engine}: ${receipt.status}; ${receipt.checks.length} cache browser checks\n`,
  );
  if (receipt.status !== "PASS") {
    process.stderr.write(receipt.errors.join("\n") + "\n");
  }
}
