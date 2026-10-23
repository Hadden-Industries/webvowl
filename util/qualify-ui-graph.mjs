import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { connectedClasses } from "./productionPerformance.mjs";

const [runtimePath, baseUrl, outputDirectory] = process.argv.slice(2);
assert(
  runtimePath && baseUrl && outputDirectory,
  "Usage: node util/qualify-ui-graph.mjs <playwright index.mjs> <dev URL> <evidence directory>",
);
const { chromium } = await import(pathToFileURL(resolve(runtimePath)).href);
const output = resolve(outputDirectory);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  reducedMotion: "reduce",
});
const receipt = {
  kind: "headless graph correctness and counters, not foreground timings",
  version: browser.version(),
  checks: [],
};
async function frames() {
  await page.evaluate(
    () =>
      new Promise((done) =>
        globalThis.requestAnimationFrame(() =>
          globalThis.requestAnimationFrame(done),
        ),
      ),
  );
}
async function capture() {
  return page.evaluate(async () => {
    const c = globalThis.uiGraphController;
    const original = globalThis.URL.createObjectURL;
    let blob;
    globalThis.URL.createObjectURL = (value) => {
      blob = value;
      return original.call(globalThis.URL, value);
    };
    try {
      await c.exportVisualization({ format: "vowl-json" });
      const canonical = await blob.text();
      await c.exportVisualization({ format: "turtle" });
      const turtle = await blob.text();
      await c.exportVisualization({ format: "svg" });
      const source = await blob.text();
      const xml = new globalThis.DOMParser().parseFromString(
        source,
        "image/svg+xml",
      );
      if (xml.querySelector("parsererror"))
        throw new Error("Invalid SVG export");
      const geometry = [
        ...xml.querySelectorAll("g.node, g.label, path.link, text, tspan"),
      ].map((element) => ({
        tag: element.tagName,
        text: element.textContent,
        attributes: [
          "transform",
          "d",
          "x",
          "y",
          "dy",
          "width",
          "height",
          "r",
        ].map((name) => [name, element.getAttribute(name)]),
      }));
      return {
        canonical,
        turtle,
        geometry,
        uiLeaked: Boolean(
          xml.querySelector("#entity-preview, #entity-full-details, dialog"),
        ),
      };
    } finally {
      globalThis.URL.createObjectURL = original;
    }
  });
}
try {
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.evaluate(async () => {
    const { application } = await import(
      [...globalThis.document.scripts].find((s) => s.src.includes("/main.js"))
        .src
    );
    globalThis.uiGraphController = application.getWebVowlController();
  });
  await page.waitForFunction(
    () => globalThis.uiGraphController.getState().status === "ready",
  );
  const repeated = await page.evaluate(async () => {
    const c = globalThis.uiGraphController;
    c.setGraphLayoutPaused({ isPaused: true });
    const all = c.getVisualizationArrangement({ limit: 100 }).occurrences;
    const candidates = all.filter((x) =>
      x.ontologyElementReferences.some(
        (r) => r.iri === "http://www.w3.org/2002/07/owl#Thing",
      ),
    );
    if (candidates.length < 2)
      throw new Error("Repeated Thing fixture unavailable");
    const observations = [];
    for (const occurrence of candidates.slice(0, 2)) {
      await c.selectVisualizationElement({ reference: occurrence.reference });
      observations.push(c.getSelectedVisualizationOccurrence());
    }
    return observations;
  });
  assert.notDeepEqual(repeated[0].reference, repeated[1].reference);
  assert(repeated.every((o) => o.occurrenceCount > 1));
  await frames();
  const before = await capture();
  await page.locator("#entity-preview-details").click();
  const opened = await capture();
  assert.deepEqual(opened, before);
  await page.keyboard.press("Escape");
  await page.waitForFunction(
    () => globalThis.document.activeElement.id === "entity-preview-details",
  );
  await page.locator("#ontology-overview-open").click();
  const overview = await capture();
  assert.deepEqual(overview, before);
  assert(!overview.uiLeaked && overview.geometry.length > 0);
  await page.keyboard.press("Escape");
  await page.waitForFunction(
    () => !globalThis.document.getElementById("ontology-overview-dialog").open,
  );
  receipt.checks.push({
    name: "repeated occurrences and exact exports",
    repeated,
    canonicalCharacters: before.canonical.length,
    turtleCharacters: before.turtle.length,
    geometryElements: before.geometry.length,
  });
  process.stdout.write(
    "Repeated selection, semantic bytes and fixed-state export geometry passed\n",
  );
  for (const count of [1000, 10000]) {
    process.stdout.write(`Loading ${count} rendered classes\n`);
    await page.evaluate(async (text) => {
      const c = globalThis.uiGraphController;
      await c.loadOntology(
        {
          source: {
            kind: "ontology-bytes",
            bytes: new TextEncoder().encode(text),
            format: "functional",
            documentIri: "urn:ui-diagnostics",
          },
        },
        {
          initialVisualization: {
            view: { layout: "pause", nodesShown: { mode: "all" } },
          },
          useAutomaticNodesShown: false,
        },
      );
    }, connectedClasses(count));
    const result = await page.evaluate(async () => {
      const c = globalThis.uiGraphController;
      const entries = c.getVisualizationArrangement({ limit: 100 }).occurrences;
      const originalBox = globalThis.SVGGraphicsElement.prototype.getBBox;
      const originalRect = globalThis.Element.prototype.getBoundingClientRect;
      let svgReads = 0;
      let renders = 0;
      globalThis.SVGGraphicsElement.prototype.getBBox = function (...args) {
        svgReads++;
        return originalBox.apply(this, args);
      };
      globalThis.Element.prototype.getBoundingClientRect = function (...args) {
        if (this instanceof globalThis.SVGElement) svgReads++;
        return originalRect.apply(this, args);
      };
      const observer = new globalThis.MutationObserver((mutations) => {
        if (mutations.some((m) => m.removedNodes.length)) renders++;
      });
      observer.observe(
        globalThis.document.getElementById("entity-preview-body"),
        { childList: true },
      );
      try {
        for (let i = 0; i < 100; i++) {
          await c.selectVisualizationElement({
            reference: entries[i % entries.length].reference,
          });
        }
        await new Promise((done) =>
          globalThis.requestAnimationFrame(() =>
            globalThis.requestAnimationFrame(done),
          ),
        );
        return {
          shown: c.getState().nodeCountStatus.shownNodeCount,
          svgReads,
          renders,
          observation: c.getSelectedVisualizationOccurrence(),
          paused: c.getState().layout.status,
        };
      } finally {
        observer.disconnect();
        globalThis.SVGGraphicsElement.prototype.getBBox = originalBox;
        globalThis.Element.prototype.getBoundingClientRect = originalRect;
      }
    });
    assert.equal(result.shown, count);
    assert.equal(result.svgReads, 0);
    assert(result.renders <= 1);
    assert.equal(result.paused, "paused");
    assert.equal(
      result.observation.loadGeneration,
      await page.evaluate(
        () => globalThis.uiGraphController.getState().loadGeneration,
      ),
    );
    receipt.checks.push({
      name: `${count} rendered nodes, 100 rapid selections`,
      ...result,
    });
    process.stdout.write(
      `${count} nodes: no SVG measurements, ${result.renders} preview render batch\n`,
    );
  }
  receipt.status = "passed";
} catch (error) {
  receipt.status = "failed";
  receipt.failure = error.stack;
  process.stderr.write(error.stack + "\n");
  process.exitCode = 1;
} finally {
  await browser.close();
  await writeFile(
    resolve(output, "receipt.json"),
    JSON.stringify(receipt, null, 2) + "\n",
  );
}
