import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const [runtimePath, baseUrl, outputDirectory, firefoxExecutable] =
  process.argv.slice(2);
assert(
  runtimePath && baseUrl && outputDirectory,
  "Usage: node util/qualify-owl-mapping.mjs <playwright index.mjs> <dev URL> <evidence directory> [Firefox executable]",
);
const playwright = await import(pathToFileURL(resolve(runtimePath)).href);
const prefix =
  "@prefix owl: <http://www.w3.org/2002/07/owl#>. @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#>. ";
const ambiguous =
  prefix +
  "<urn:p> a owl:ObjectProperty, owl:AnnotationProperty; rdfs:domain <urn:C>. <urn:C> a owl:Class.";
const valid = prefix + "<urn:Valid> a owl:Class.";
const receipt = {
  kind: "native mapping control, actual application controller and OWL worker",
  results: [],
};
await mkdir(outputDirectory, { recursive: true });
for (const engine of ["chromium", "firefox", "webkit"]) {
  const browser = await playwright[engine].launch({
    headless: true,
    ...(engine === "firefox" && firefoxExecutable
      ? { executablePath: firefoxExecutable }
      : {}),
  });
  const sources = new Map();
  const fixtureServer = createServer(async (request, response) => {
    const source = sources.get(request.url);
    if (!source) {
      response.writeHead(404).end();
      return;
    }
    response.setHeader("Access-Control-Allow-Origin", new URL(baseUrl).origin);
    response.setHeader("Content-Type", "text/turtle");
    source.entered();
    await source.gate;
    response.end(ambiguous);
  });
  await new Promise((done) => fixtureServer.listen(0, "127.0.0.1", done));
  try {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 900 },
    });
    page.setDefaultTimeout(60000);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.evaluate(async () => {
      const main = [...globalThis.document.scripts].find((script) =>
        script.src.includes("/main.js"),
      );
      globalThis.owlMappingQualification = (
        await import(main.src)
      ).application.getWebVowlController();
    });
    await page.waitForFunction(
      () => globalThis.owlMappingQualification.getState().status === "ready",
    );
    await page
      .locator('[popovertarget="m_select"]:not([popovertargetaction="hide"])')
      .click();
    const heuristic = page.getByRole("radio", {
      name: /^Heuristic OWL mapping/u,
    });
    const unambiguous = page.getByRole("radio", {
      name: /^Unambiguous OWL mapping/u,
    });
    assert(await heuristic.isChecked());
    const load = (text, documentIri, options) =>
      page.evaluate(
        async ({ text, documentIri, options }) => {
          const controller = globalThis.owlMappingQualification;
          try {
            await controller.loadOntology(
              { source: { kind: "ontology-text", text, documentIri } },
              options,
            );
            return { state: controller.getState() };
          } catch (error) {
            return {
              error: { code: error.code, message: error.message },
              state: controller.getState(),
            };
          }
        },
        { text, documentIri, options },
      );
    const first = await load(ambiguous, "urn:heuristic");
    assert.equal(first.error, undefined);
    assert.equal(first.state.source.owlMappingStrategy, "heuristic");
    await page.waitForFunction(
      () =>
        globalThis.owlMappingQualification.getState().nodeCountStatus
          ?.orderingStatus === "ready",
    );
    await page.evaluate(() =>
      globalThis.owlMappingQualification.setVisualizationView({
        nodesShown: { mode: "all" },
        filters: { datatypes: "hide" },
      }),
    );
    const retained = await page.evaluate(() =>
      globalThis.owlMappingQualification.getState(),
    );
    await heuristic.focus();
    await page.keyboard.press("ArrowRight");
    assert(await unambiguous.isChecked());
    assert.equal(
      await unambiguous.evaluate(
        (element) => element === globalThis.document.activeElement,
      ),
      true,
    );
    const failed = await load(ambiguous, "urn:rejected");
    assert.equal(failed.error?.code, "MAPPING_AMBIGUOUS");
    assert.deepEqual(failed.state.source, retained.source);
    assert.equal(failed.state.loadGeneration, retained.loadGeneration);
    assert.equal(failed.state.documentRevision, retained.documentRevision);
    assert.deepEqual(failed.state.view, retained.view);
    const unambiguousResult = await load(valid, "urn:unambiguous");
    assert.equal(unambiguousResult.error, undefined);
    assert.equal(
      unambiguousResult.state.source.owlMappingStrategy,
      "unambiguous",
    );
    const overridden = await load(ambiguous, "urn:overridden", {
      owlMappingStrategy: "heuristic",
    });
    assert.equal(overridden.error, undefined);
    assert.equal(overridden.state.source.owlMappingStrategy, "heuristic");
    assert(await unambiguous.isChecked());

    // Hold acquisition before the parser starts; changing the UI cannot alter the captured mode.
    let release;
    let entered;
    const gate = new Promise((done) => {
      release = done;
    });
    const acquisition = new Promise((done) => {
      entered = done;
    });
    const delayedUrl = `http://127.0.0.1:${fixtureServer.address().port}/mapping-wait.ttl`;
    sources.set("/mapping-wait.ttl", { entered, gate });
    await page.evaluate((url) => {
      globalThis.pendingMapping = globalThis.owlMappingQualification
        .loadOntology({
          source: { kind: "ontology-document-iri", documentIri: url },
        })
        .then(
          () => ({ status: "resolved" }),
          (error) => ({ status: "rejected", code: error.code }),
        );
    }, delayedUrl);
    await acquisition;
    await heuristic.check();
    release();
    assert.equal(
      (await page.evaluate(() => globalThis.pendingMapping)).code,
      "MAPPING_AMBIGUOUS",
    );
    assert(await heuristic.isChecked());
    assert.equal(
      (await load(ambiguous, "urn:next-heuristic")).state.source
        .owlMappingStrategy,
      "heuristic",
    );

    // A newer generation wins even when the older acquisition is released afterward.
    let releaseStale;
    let enteredStale;
    const staleGate = new Promise((done) => {
      releaseStale = done;
    });
    const staleAcquisition = new Promise((done) => {
      enteredStale = done;
    });
    const staleUrl = `http://127.0.0.1:${fixtureServer.address().port}/mapping-stale.ttl`;
    sources.set("/mapping-stale.ttl", {
      entered: enteredStale,
      gate: staleGate,
    });
    await page.evaluate((url) => {
      globalThis.supersededMapping = globalThis.owlMappingQualification
        .loadOntology({
          source: { kind: "ontology-document-iri", documentIri: url },
        })
        .then(
          () => ({ status: "resolved" }),
          (error) => ({ status: "rejected", code: error.code }),
        );
    }, staleUrl);
    await staleAcquisition;
    await unambiguous.check();
    const winner = await load(valid, "urn:winner");
    assert.equal(winner.error, undefined);
    releaseStale();
    assert.equal(
      (await page.evaluate(() => globalThis.supersededMapping)).status,
      "rejected",
    );
    const after = await page.evaluate(() =>
      globalThis.owlMappingQualification.getState(),
    );
    assert.deepEqual(after.source, winner.state.source);
    assert.equal(after.loadGeneration, winner.state.loadGeneration);
    assert.equal(after.documentRevision, winner.state.documentRevision);
    assert(await unambiguous.isChecked());

    if (engine === "chromium") {
      for (const width of [1280, 390]) {
        await page.setViewportSize({ width, height: 900 });
        await page.locator("#m_select").evaluate(async (element) => {
          await new Promise(globalThis.requestAnimationFrame);
          await Promise.all(
            element
              .getAnimations()
              .map((animation) => animation.finished.catch(() => {})),
          );
        });
        const group = page.locator(".owl-mapping-options");
        await group.scrollIntoViewIfNeeded();
        const bounds = await group.boundingBox();
        assert(
          bounds &&
            bounds.width > 0 &&
            bounds.x >= 0 &&
            bounds.x + bounds.width <= width,
        );
        for (const radio of [heuristic, unambiguous]) {
          const label = await radio.locator("..").boundingBox();
          assert(
            label &&
              label.height >= 48 &&
              label.y >= 0 &&
              label.y + label.height <= 900,
          );
        }
        await page.screenshot({
          path: resolve(outputDirectory, `mapping-${width}.png`),
        });
      }
    }
    assert.deepEqual(errors, []);
    receipt.results.push({
      engine,
      version: browser.version(),
      status: "PASS",
      checks: [
        "native default and keyboard choice",
        "ambiguity distinction and retained graph/view",
        "explicit API override leaves preference unchanged",
        "choice captured before acquisition",
        "superseded generation cannot replace winner",
      ],
    });
  } finally {
    fixtureServer.closeAllConnections();
    await new Promise((done) => fixtureServer.close(done));
    await browser.close();
  }
}
await writeFile(
  resolve(outputDirectory, "mapping-control-result.json"),
  JSON.stringify(receipt, null, 2) + "\n",
  { flag: "wx" },
);
process.stdout.write(
  "Mapping control: PASS in Chromium, Firefox and WebKit.\n",
);
