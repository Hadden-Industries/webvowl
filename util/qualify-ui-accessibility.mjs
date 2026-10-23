import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

// Caller-supplied runtime and audited axe source: no dependency or policy edits.
const [runtimePath, axePath, baseUrl, outputDirectory] = process.argv.slice(2);
assert(
  runtimePath && axePath && baseUrl && outputDirectory,
  "Usage: node util/qualify-ui-accessibility.mjs <playwright index.mjs> <axe.min.js> <dev URL> <evidence directory>",
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
  kind: "automated accessibility rules and structure, not AT qualification",
  version: browser.version(),
  audits: [],
  checks: [],
};
async function audit(name, selector) {
  const result = await page.evaluate(async (selector) => {
    const result = await globalThis.axe.run(
      selector ? { include: [selector] } : globalThis.document,
      {
        runOnly: {
          type: "tag",
          values: [
            "wcag2a",
            "wcag2aa",
            "wcag21aa",
            "wcag22aa",
            "best-practice",
          ],
        },
      },
    );
    return {
      testEngine: result.testEngine,
      violations: result.violations,
      incomplete: result.incomplete,
      passedRules: result.passes.map((rule) => rule.id),
    };
  }, selector);
  receipt.audits.push({ name, ...result });
  process.stdout.write(
    `${name}: ${result.violations.map((v) => v.id).join(", ") || "no violations"}\n`,
  );
}
async function frame() {
  await page.evaluate(
    () =>
      new Promise((done) =>
        globalThis.requestAnimationFrame(() =>
          globalThis.requestAnimationFrame(done),
        ),
      ),
  );
}
async function checkDialogFits(id) {
  const box = await page.locator(id).evaluate((element) => {
    const b = element.getBoundingClientRect();
    return {
      left: b.left,
      top: b.top,
      right: b.right,
      bottom: b.bottom,
      width: globalThis.innerWidth,
      height: globalThis.innerHeight,
      scroll: element.scrollWidth,
      client: element.clientWidth,
    };
  });
  assert(
    box.left >= 0 &&
      box.top >= 0 &&
      box.right <= box.width + 1 &&
      box.bottom <= box.height + 1 &&
      box.scroll <= box.client + 1,
    JSON.stringify(box),
  );
  receipt.checks.push({ name: `${id} fits ${box.width}x${box.height}`, box });
}
try {
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.addScriptTag({ path: resolve(axePath) });
  await page.evaluate(async () => {
    const { application } = await import(
      [...globalThis.document.scripts].find((s) => s.src.includes("/main.js"))
        .src
    );
    globalThis.uiAccessibilityController = application.getWebVowlController();
  });
  await page.waitForFunction(
    () => globalThis.uiAccessibilityController.getState().status === "ready",
  );
  await audit("initial page");
  await page.getByRole("button", { name: "Ontology", exact: true }).click();
  await page.locator("#ontology-source-clear").click();
  await audit("chooser");
  // The input owns active-descendant focus: prove keyboard scrolling rather
  // than adding a redundant Tab stop to satisfy a generic scroll-region rule.
  for (let i = 0; i < 10; i++) {
    await page.locator("#iri-converter-input").press("ArrowDown");
  }
  const scroll = await page.evaluate(() => {
    const input = globalThis.document.getElementById("iri-converter-input");
    const option = globalThis.document.getElementById(
      input.getAttribute("aria-activedescendant"),
    );
    const list = globalThis.document.getElementById("ontology-suggestions");
    const a = option.getBoundingClientRect();
    const b = list.getBoundingClientRect();
    return {
      inputFocused: globalThis.document.activeElement === input,
      scrollTop: list.scrollTop,
      visible: a.top >= b.top && a.bottom <= b.bottom,
      active: option.id,
    };
  });
  assert(scroll.inputFocused && scroll.scrollTop > 0 && scroll.visible);
  receipt.checks.push({ name: "input-owned keyboard scrolling", ...scroll });
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await page.locator("#ontology-overview-open").click();
  await audit("overview");
  await page.locator("#ontology-overview-facts").click();
  await audit("nested facts");
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await page.evaluate(async () => {
    const c = globalThis.uiAccessibilityController;
    c.setGraphLayoutPaused({ isPaused: true });
    const occurrence = c
      .getVisualizationArrangement({ limit: 100 })
      .occurrences.find((entry) =>
        entry.ontologyElementReferences.some(
          (r) => r.iri === "http://xmlns.com/foaf/0.1/Person",
        ),
      );
    await c.selectVisualizationElement({ reference: occurrence.reference });
  });
  await page.locator("#entity-preview").waitFor({ state: "visible" });
  await frame();
  await audit("preview", "#entity-preview");
  await page.locator("#entity-preview-details").click();
  await audit("details");
  for (const viewport of [
    { width: 320, height: 700 },
    { width: 568, height: 320 },
  ]) {
    await page.setViewportSize(viewport);
    await frame();
    await checkDialogFits("#entity-details-dialog");
    await audit(`details ${viewport.width}x${viewport.height}`);
  }
  await page.emulateMedia({ forcedColors: "active", reducedMotion: "reduce" });
  await audit("forced colors details");
  await page.screenshot({ path: resolve(output, "forced-colors-details.png") });
  await page.keyboard.press("Escape");
  await page
    .locator("#editorModeModuleCheckbox")
    .evaluate((element) => element.click());
  await page.locator("#ontology-editor-dialog").waitFor({ state: "visible" });
  await checkDialogFits("#ontology-editor-dialog");
  await audit("compact editor");
  receipt.dispositions = [
    {
      rule: "meta-viewport",
      target: 'meta[name="viewport"]',
      status:
        "known pre-existing limitation; out of UI scope, manual release disposition required",
    },
    {
      rule: "scrollable-region-focusable",
      target: "#ontology-suggestions",
      status:
        "input-owned active-descendant navigation; keyboard scrolling proved separately; spoken AT coverage pending",
    },
  ];
  const unexpected = receipt.audits.flatMap((a) =>
    a.violations.flatMap((v) =>
      v.nodes
        .filter(
          (n) =>
            !receipt.dispositions.some(
              (d) =>
                d.rule === v.id &&
                n.target.length === 1 &&
                n.target[0] === d.target,
            ),
        )
        .map((n) => ({ audit: a.name, rule: v.id, target: n.target })),
    ),
  );
  assert.deepEqual(unexpected, []);
  receipt.status = "completed with recorded limitations";
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
