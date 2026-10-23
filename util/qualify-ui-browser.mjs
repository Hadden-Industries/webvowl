import assert from "node:assert/strict";
import { writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { qualifyPresentationFixtures } from "./uiPresentationFixtures.mjs";

// Uses a caller-selected Playwright runtime; no project dependency or browser
// policy is changed. These are functional checks, never foreground timings.
const [runtimePath, engine, baseUrl, outputDirectory, executablePath] =
  process.argv.slice(2);
assert(
  runtimePath &&
    ["chromium", "firefox", "webkit"].includes(engine) &&
    baseUrl &&
    outputDirectory,
  "Usage: node util/qualify-ui-browser.mjs <playwright index.mjs> <engine> <dev URL> <evidence directory>",
);
const playwright = await import(pathToFileURL(resolve(runtimePath)).href);
const output = resolve(outputDirectory);
await mkdir(output, { recursive: true });
const receipt = {
  engine,
  kind: "headless functional and accessibility structure; not screen-reader or paint qualification",
  startedAt: new Date().toISOString(),
  checks: [],
  errors: [],
};
let browser;
let page;
async function check(name, action) {
  const evidence = await action();
  receipt.checks.push({ name, status: "passed", evidence });
  process.stdout.write(`${engine}: ${name} passed\n`);
}
async function state() {
  return page.evaluate(() =>
    globalThis.window.uiQualification.controller.getState(),
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
async function selectPerson() {
  await page.evaluate(async () => {
    const controller = globalThis.window.uiQualification.controller;
    const person = controller
      .getVisualizationArrangement({ limit: 100 })
      .occurrences.find((entry) =>
        entry.ontologyElementReferences.some(
          (reference) => reference.iri === "http://xmlns.com/foaf/0.1/Person",
        ),
      );
    if (!person)
      throw new Error("Independent FOAF Person fixture is not drawn");
    await controller.selectVisualizationElement({
      reference: person.reference,
    });
  });
  await frame();
  assert(await page.locator("#entity-preview").isVisible());
}
try {
  browser = await playwright[engine].launch({
    headless: true,
    ...(executablePath ? { executablePath } : {}),
  });
  receipt.executablePath =
    executablePath ?? playwright[engine].executablePath();
  receipt.version = browser.version();
  page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
  });
  page.setDefaultTimeout(30000);
  page.on("pageerror", (error) => receipt.errors.push(error.message));
  await check(
    "independent complete-description, hidden-relation and lifetime fixtures",
    () => qualifyPresentationFixtures(page, baseUrl),
  );
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.evaluate(async () => {
    const { application } = await import(
      [...globalThis.document.scripts].find((script) =>
        script.src.includes("/main.js"),
      ).src
    );
    globalThis.window.uiQualification = {
      application,
      controller: application.getWebVowlController(),
      inputEvents: [],
    };
    for (const type of [
      "keydown",
      "keyup",
      "input",
      "change",
      "compositionstart",
      "compositionend",
    ]) {
      globalThis.document
        .getElementById("iri-converter-input")
        .addEventListener(type, (event) => {
          globalThis.window.uiQualification.inputEvents.push({
            type,
            key: event.key,
            composing: event.isComposing,
            value: event.target.value,
            active: event.target.getAttribute("aria-activedescendant"),
            prevented: event.defaultPrevented,
          });
        });
    }
  });
  await page.waitForFunction(
    () =>
      globalThis.window.uiQualification.controller.getState().status ===
      "ready",
  );

  await check(
    "chooser catalogue, keyboard commit without load, and native URL sanitization",
    async () => {
      const before = await state();
      await page.getByRole("button", { name: "Ontology", exact: true }).click();
      await page.locator("#ontology-source-clear").click();
      assert.equal(
        await page.locator("#ontology-suggestions [role=option]").count(),
        10,
      );
      const names = await page.locator("#ontology-suggestions").ariaSnapshot();
      assert(names.includes("Hadden Industries") && names.includes("Others"));
      await page.locator("#iri-converter-input").fill("hadden metadata");
      await page.locator("#iri-converter-input").press("Enter");
      assert.equal(
        await page.locator("#iri-converter-input").inputValue(),
        "https://haddenindustries.com/ontology/iso-iec/11179/-3/ed-4/latest",
      );
      assert.equal((await state()).loadGeneration, before.loadGeneration);
      assert(!(await page.locator("#iri-converter-button").isDisabled()));
      await page
        .locator("#iri-converter-input")
        .fill("no such catalogue words");
      assert(!(await page.locator("#ontology-suggestions").isVisible()));
      assert(
        (await page.locator("#iri-converter-hint").innerText()).includes(
          "No suggestions match",
        ),
      );
      const sanitized = await page
        .locator("#iri-converter-input")
        .evaluate((input) => {
          input.value = " \nhttps://example.test/\r\nontology ";
          input.dispatchEvent(new Event("input", { bubbles: true }));
          return input.value;
        });
      assert.equal(sanitized, "https://example.test/ontology");
      await page.locator("#iri-converter-input").fill("FOAF");
      await page.locator("#iri-converter-input").press("Enter");
      assert.equal((await state()).loadGeneration, before.loadGeneration);
      await page.locator("#iri-converter-input").press("Enter");
      await page.waitForFunction((generation) => {
        const current = globalThis.window.uiQualification.controller.getState();
        return (
          current.status === "ready" && current.loadGeneration > generation
        );
      }, before.loadGeneration);
      return { catalogue: names, sanitized, source: (await state()).source };
    },
  );

  await check(
    "overview retains metadata, facts, native dialog focus and source identity",
    async () => {
      const before = await state();
      await page.locator("#ontology-overview-open").click();
      const fields = await page.evaluate(() =>
        Object.fromEntries(
          [
            "title",
            "about",
            "version",
            "authors",
            "description",
            "ontology-metadata",
            "classCount",
            "objectPropertyCount",
            "datatypePropertyCount",
            "individualCount",
            "nodeCount",
            "edgeCount",
          ].map((id) => {
            const element = globalThis.document.getElementById(id);
            if (
              !globalThis.document
                .getElementById("ontology-overview-dialog")
                .contains(element)
            )
              throw new Error(`Missing overview field ${id}`);
            return [id, element.textContent];
          }),
        ),
      );
      assert(fields.title.includes("Friend of a Friend"));
      assert(
        (
          await page.locator("#ontology-source-provenance").innerText()
        ).includes(before.source.identity),
      );
      assert(!(await page.locator("#ontology-overview-facts").isDisabled()));
      await page.locator("#ontology-overview-facts").click();
      assert.equal(await page.locator("dialog[open]").count(), 2);
      await frame();
      await page.keyboard.press("Escape");
      await page.waitForFunction(
        () =>
          globalThis.document.querySelectorAll("dialog[open]").length === 1 &&
          globalThis.document.activeElement.id === "ontology-overview-facts",
      );
      await page.keyboard.press("Escape");
      await page.waitForFunction(
        () =>
          !globalThis.document.getElementById("ontology-overview-dialog")
            .open &&
          globalThis.document.activeElement.id === "ontology-overview-open",
      );
      assert.equal(
        await page.evaluate(() => globalThis.document.activeElement.id),
        "ontology-overview-open",
      );
      assert.deepEqual((await state()).selection, before.selection);
      return fields;
    },
  );

  await check(
    "complete related-entity reading preserves graph selection and return focus",
    async () => {
      await selectPerson();
      const selection = (await state()).selection;
      const roleNames = await page
        .locator(".entity-role-switcher button")
        .allTextContents();
      assert.equal(new Set(roleNames).size, roleNames.length);
      await page.locator("#entity-preview-details").click();
      const initial = await page.locator("#entity-full-details").innerText();
      assert(
        initial.includes("Annotations") &&
          initial.includes("Superclasses") &&
          initial.includes("Ontology facts"),
      );
      assert.equal(
        await page.locator("#entity-full-details h3").count(),
        selection.length,
      );
      await page.locator("#entity-full-details dd button").first().click();
      await frame();
      assert(
        (await page.locator("#entity-full-details").innerText()).includes(
          "Related entity details",
        ),
      );
      assert.deepEqual((await state()).selection, selection);
      assert.equal(
        await page.evaluate(() => globalThis.document.activeElement.tagName),
        "H3",
      );
      await page.getByRole("button", { name: /^Back to selected/ }).click();
      assert.equal(
        await page.locator("#entity-full-details").innerText(),
        initial,
      );
      await page.screenshot({ path: resolve(output, "details-wide.png") });
      const accessibility = await page
        .locator("#entity-details-dialog")
        .ariaSnapshot();
      await page.keyboard.press("Escape");
      await page.waitForFunction(
        () => globalThis.document.activeElement.id === "entity-preview-details",
      );
      assert.equal(
        await page.evaluate(() => globalThis.document.activeElement.id),
        "entity-preview-details",
      );
      return { roleNames, selection, accessibility };
    },
  );

  await check(
    "wide pin, resize focus, 320px reflow and text spacing",
    async () => {
      await page.locator("#entity-preview-details").click();
      await page.locator("#entity-details-pin").click();
      assert(!(await page.locator("#entity-details-dialog").isVisible()));
      const copy = page.locator("#entity-full-details button").first();
      await copy.focus();
      await page.setViewportSize({ width: 1100, height: 800 });
      assert.equal(
        await page.evaluate(
          () => globalThis.document.activeElement.textContent,
        ),
        "Copy full IRI",
      );
      await page.setViewportSize({ width: 320, height: 700 });
      await page.waitForFunction(
        () => globalThis.document.getElementById("entity-details-dialog").open,
      );
      assert.equal(
        await page.evaluate(
          () => globalThis.document.activeElement.textContent,
        ),
        "Copy full IRI",
      );
      const spacing = await page.addStyleTag({
        content:
          ".ontology-dialog * { line-height: 1.5 !important; letter-spacing: .12em !important; word-spacing: .16em !important; } .ontology-dialog p { margin-bottom: 2em !important; }",
      });
      const box = await page
        .locator("#entity-details-dialog")
        .evaluate((element) => ({
          width: element.getBoundingClientRect().width,
          scroll: element.scrollWidth,
          client: element.clientWidth,
          body: globalThis.document.body.scrollWidth,
          viewport: globalThis.innerWidth,
        }));
      assert(
        box.width <= 320 &&
          box.scroll <= box.client + 1 &&
          box.body <= box.viewport,
      );
      await page.screenshot({
        path: resolve(output, "details-320-text-spacing.png"),
      });
      await spacing.evaluate((element) => element.remove());
      await page.keyboard.press("Escape");
      assert.equal(
        await page
          .locator("#graph")
          .evaluate((element) => element.getBoundingClientRect().width),
        320,
      );
      return box;
    },
  );

  await check(
    "compact editor preserves controls, DOM identity and focus across wide transition",
    async () => {
      await page
        .locator("#editorModeModuleCheckbox")
        .evaluate((element) => element.click());
      await page.waitForFunction(
        () => globalThis.document.getElementById("ontology-editor-dialog").open,
      );
      await page.locator("#titleEditor").focus();
      await page.evaluate(() => {
        globalThis.window.uiQualification.titleInput =
          globalThis.document.getElementById("titleEditor");
      });
      const compact = await page
        .locator("#ontology-editor-dialog")
        .evaluate((element) => ({
          width: element.getBoundingClientRect().width,
          scroll: element.scrollWidth,
          client: element.clientWidth,
        }));
      assert(compact.width <= 320 && compact.scroll <= compact.client + 1);
      assert.equal(
        await page
          .locator("#containerForLeftSideBar")
          .evaluate((element) => element.parentElement.id),
        "ontology-editor-body",
      );
      await page.screenshot({ path: resolve(output, "editor-320.png") });
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.waitForFunction(
        () =>
          !globalThis.document.getElementById("ontology-editor-dialog").open,
      );
      assert(
        await page.evaluate(
          () =>
            globalThis.document.activeElement ===
              globalThis.window.uiQualification.titleInput &&
            globalThis.document.getElementById("titleEditor") ===
              globalThis.window.uiQualification.titleInput,
        ),
      );
      await page.locator("#sidebarExpandButton").click();
      assert(
        await page.locator("#detailsArea").evaluate((element) => element.inert),
      );
      await page.locator("#sidebarExpandButton").click();
      assert(
        !(await page
          .locator("#detailsArea")
          .evaluate((element) => element.inert)),
      );
      await page
        .locator("#editorModeModuleCheckbox")
        .evaluate((element) => element.click());
      assert.equal((await state()).editorMode.isEditorMode, false);
      return compact;
    },
  );

  await check(
    "held zoom publishes current selected-occurrence geometry while layout is paused",
    async () => {
      await selectPerson();
      const evidence = await page.evaluate(async () => {
        const c = globalThis.window.uiQualification.controller;
        c.setGraphLayoutPaused({ isPaused: true });
        const before = c.getSelectedVisualizationOccurrence();
        const zoomBefore = c.getState().zoomScale;
        const observations = [];
        const unsubscribe = c.subscribeToSelectedVisualizationOccurrence(
          (value) => observations.push(value),
        );
        try {
          c.setContinuousZoom({
            zoomDirection: zoomBefore < 2 ? "in" : "out",
          });
          for (let i = 0; i < 20; i++) {
            await new Promise((done) => globalThis.requestAnimationFrame(done));
          }
        } finally {
          c.setContinuousZoom({ zoomDirection: "none" });
          unsubscribe();
        }
        return {
          before,
          after: c.getSelectedVisualizationOccurrence(),
          zoomBefore,
          zoomAfter: c.getState().zoomScale,
          observations,
        };
      });
      assert.notEqual(evidence.zoomAfter, evidence.zoomBefore);
      assert.notEqual(evidence.after.widthPx, evidence.before.widthPx);
      assert(
        evidence.observations.length > 0,
        "Real held zoom must publish selected-occurrence observations",
      );
      assert.deepEqual(evidence.observations.at(-1), evidence.after);
      assert.equal(
        evidence.after.reference.occurrenceId,
        evidence.before.reference.occurrenceId,
      );
      return evidence;
    },
  );

  await check(
    "background pan preserves selection, click clears it, and reduced motion has no animation",
    async () => {
      await selectPerson();
      const selection = (await state()).selection;
      assert.equal(
        await page
          .locator("#entity-preview")
          .evaluate((element) => element.getAnimations().length),
        0,
      );
      const point = await page.evaluate(() => {
        const graph = globalThis.document
          .getElementById("graph")
          .getBoundingClientRect();
        for (let y = 90; y < graph.height - 80; y += 60) {
          const target = globalThis.document.elementFromPoint(5, y);
          if (target?.tagName.toLowerCase() === "svg") return { x: 5, y };
        }
        throw new Error("No independent blank canvas point");
      });
      await page.mouse.move(point.x, point.y);
      await page.mouse.down();
      await page.mouse.move(point.x + 30, point.y + 30, { steps: 5 });
      await page.mouse.up();
      assert.deepEqual((await state()).selection, selection);
      // D3 intentionally suppresses the drag-ending click for one event-loop
      // turn. A subsequent user action starts after that gesture has settled.
      await frame();
      await page.mouse.click(point.x, point.y);
      await page.waitForFunction(
        () =>
          globalThis.window.uiQualification.controller.getState().selection
            .length === 0,
      );
      assert(!(await page.locator("#entity-preview").isVisible()));
      return { point, cleared: true };
    },
  );

  await check(
    "application disposal closes surfaces and releases UI listeners",
    async () => {
      await page.evaluate(() =>
        globalThis.window.uiQualification.application.dispose(),
      );
      await page.evaluate(() => {
        globalThis.window.dispatchEvent(new Event("resize"));
        globalThis.document.getElementById("ontology-overview-open").click();
      });
      assert.equal(await page.locator("dialog[open]").count(), 0);
      assert.equal(receipt.errors.length, 0, receipt.errors.join("\n"));
      return { pageErrors: receipt.errors };
    },
  );
  receipt.status = "passed";
} catch (error) {
  receipt.status = "failed";
  receipt.failure = error.stack;
  if (page) {
    receipt.failureState = await page
      .evaluate(() => ({
        inputEvents: globalThis.window.uiQualification?.inputEvents,
        selection:
          globalThis.window.uiQualification?.controller.getState().selection,
        focused: globalThis.document.activeElement?.id,
      }))
      .catch(() => null);
  }
  if (page)
    await page
      .screenshot({ path: resolve(output, "failure.png") })
      .catch(() => {});
  process.stderr.write(`${engine}: ${error.stack}\n`);
  process.exitCode = 1;
} finally {
  await browser?.close();
  receipt.finishedAt = new Date().toISOString();
  await writeFile(
    resolve(output, "receipt.json"),
    JSON.stringify(receipt, null, 2) + "\n",
  );
}
