import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
const [runtimePath, devBaseUrl, outputDirectory, firefoxExecutable] =
  process.argv.slice(2);
assert(
  runtimePath && devBaseUrl && outputDirectory,
  "Usage: node util/qualify-production-ontology-worker.mjs <playwright index.mjs> <dev URL> <evidence directory> [Firefox executable]",
);
const root = fileURLToPath(new URL("../", import.meta.url));
const deployment = resolve(root, "deploy");
const playwright = await import(pathToFileURL(resolve(runtimePath)).href);
const fixture = JSON.parse(
  await readFile(
    resolve(
      root,
      "src/ontology-loading/contracts/fixtures/protocol-cases.v1.json",
    ),
  ),
);
const workerFile = (await readdir(resolve(deployment, "assets"))).find((name) =>
  /^canonicalVowlWorker-.*\.js$/.test(name),
);
assert(workerFile);
const childText =
  "@prefix owl: <http://www.w3.org/2002/07/owl#> .\n<> a owl:Ontology .\n<#Child> a owl:Class .\n";
const receipt = {
  kind: "actual production worker and native OwlAPI payload; controlled acquired byte/import boundary",
  workerFile,
  results: [],
};
const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, "http://localhost");
    const path = resolve(
      deployment,
      "." +
        decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname),
    );
    if (!path.startsWith(deployment + sep)) {
      response.writeHead(403).end();
      return;
    }
    const bytes = await readFile(path);
    const type =
      {
        ".js": "application/javascript",
        ".css": "text/css",
        ".html": "text/html",
        ".json": "application/json",
        ".svg": "image/svg+xml",
      }[extname(path)] ?? "application/octet-stream";
    response.writeHead(200, { "content-type": type }).end(bytes);
  } catch {
    response.writeHead(404).end();
  }
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
const base = `http://127.0.0.1:${server.address().port}`;
try {
  for (const engine of ["chromium", "firefox", "webkit"]) {
    const browser = await playwright[engine].launch({
      headless: true,
      ...(engine === "firefox" && firefoxExecutable
        ? { executablePath: firefoxExecutable }
        : {}),
    });
    try {
      const page = await browser.newPage();
      const errors = [];
      const requests = [];
      page.on("pageerror", (e) => errors.push(e.stack ?? e.message));
      page.on("request", (r) => requests.push(r.url()));
      await page.goto(base, { waitUntil: "networkidle" });
      assert(
        !requests.some((url) =>
          /cachedOntologySourceAcquisition|ontology\/cache|ontology\/materializations/.test(
            url,
          ),
        ),
      );
      const result = await page.evaluate(
        async ({ workerUrl, fixture, childText, clientUrl }) => {
          const { createCanonicalVowlWorkerClient } = await import(clientUrl);
          const client = createCanonicalVowlWorkerClient({
            createWorker: () =>
              new globalThis.Worker(workerUrl, { type: "module" }),
          });
          const imports = [];
          try {
            const result = await client.run(
              {
                operation: "open-owl-model",
                bytes: new TextEncoder().encode(
                  fixture.ontologySource.utf8Text,
                ),
                documentIri: fixture.ontologySource.parserDocumentIri,
              },
              {
                loadGeneration: 1,
                baseRevision: 0,
                resolveImport: async (iri) => {
                  imports.push(iri);
                  return {
                    bytes: new TextEncoder().encode(childText),
                    documentIri: iri,
                  };
                },
              },
            );
            const digests = [];
            for (const source of result.checkpoint.source.sources) {
              const digest = await crypto.subtle.digest(
                "SHA-256",
                source.bytes,
              );
              digests.push(
                [...new Uint8Array(digest)]
                  .map((x) => x.toString(16).padStart(2, "0"))
                  .join(""),
              );
            }
            return {
              documents: result.inspection.documents.map((x) => x.documentIri),
              imports,
              digests,
            };
          } finally {
            client.dispose();
          }
        },
        {
          workerUrl: `${base}/assets/${workerFile}`,
          fixture,
          childText,
          clientUrl: new URL(
            "app/js/controller/canonicalVowlWorkerClient.js",
            devBaseUrl,
          ).href,
        },
      );
      assert.deepEqual(result.imports, [
        fixture.ontologySource.expectedResolvedImportIri,
      ]);
      assert.deepEqual(
        new Set(result.documents),
        new Set([
          fixture.ontologySource.parserDocumentIri,
          fixture.ontologySource.expectedResolvedImportIri,
        ]),
      );
      assert(result.digests.includes(fixture.ontologySource.artifactSha256));
      assert(
        result.digests.includes(
          createHash("sha256").update(childText).digest("hex"),
        ),
      );
      assert.deepEqual(errors, []);
      receipt.results.push({
        engine,
        version: browser.version(),
        status: "PASS",
        ...result,
      });
    } finally {
      await browser.close();
    }
  }
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(
    resolve(outputDirectory, "production-worker-result.json"),
    JSON.stringify(receipt, null, 2) + "\n",
    { flag: "wx" },
  );
  process.stdout.write(
    "Production worker: PASS in Chromium, Firefox and WebKit; exact retained root/import bytes and parser contexts.\n",
  );
} finally {
  server.closeAllConnections();
  await new Promise((done) => server.close(done));
}
