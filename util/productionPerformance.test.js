import { describe, expect, test } from "@jest/globals";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import {
  applicationEntryBinding,
  buildCohortOrder,
  connectedClasses,
  completedProductionCohort,
  observeTwoAnimationFrames,
  productionManifest,
  productionCohortSchedule,
  summarizeSamples,
  validateBoundary,
} from "./productionPerformance.mjs";

describe("production measurement admission", () => {
  test("binds the actual module-scoped application at its load callback", () => {
    const source =
      'const app = make();\nwindow.addEventListener("load", () => { app.initialize(); });';
    expect(applicationEntryBinding(source)).toEqual({
      identifier: "app",
      lineNumber: 1,
      columnNumber: 40,
    });
  });

  test("rejects ambiguous or changed composition instead of guessing a handle", () => {
    const callback = 'window.addEventListener("load",()=>{app.initialize()});';
    expect(() => applicationEntryBinding(callback + callback)).toThrow(
      /exactly one/u,
    );
    expect(() => applicationEntryBinding("const app = make();")).toThrow(
      /exactly one/u,
    );
    expect(() => applicationEntryBinding("invalid syntax !")).toThrow(/parse/u);
  });

  test("binds the nested bundled worker URL instead of an unrelated retained asset", () => {
    const root = mkdtempSync(join(tmpdir(), "webvowl-manifest-"));
    try {
      mkdirSync(join(root, "js"));
      mkdirSync(join(root, "assets"));
      writeFileSync(
        join(root, "index.html"),
        '<script type="module" src="./js/index.js"></script>',
      );
      writeFileSync(
        join(root, "js/index.js"),
        "new Worker(new URL(new URL(`../assets/current.js`,import.meta.url).href,``+import.meta.url),{type:`module`});window.addEventListener(`load`,()=>app.initialize());",
      );
      writeFileSync(join(root, "assets/current.js"), "// actual worker");
      writeFileSync(join(root, "assets/stale.js"), "// retained output");
      const manifest = productionManifest(root);
      expect(manifest.entry).toBe("js/index.js");
      expect(manifest.workers).toEqual(["assets/current.js"]);
      expect(manifest.files).toHaveLength(4);
      expect(
        manifest.files.find((file) => file.path === "assets/current.js").sha256,
      ).toBe(createHash("sha256").update("// actual worker").digest("hex"));
      rmSync(join(root, "assets/current.js"));
      expect(() => productionManifest(root)).toThrow(
        /Referenced worker asset is missing/u,
      );
    } finally {
      expect(dirname(resolve(root))).toBe(resolve(tmpdir()));
      rmSync(root, { recursive: true });
    }
  });

  test("walks a production-sized token stream without spreading tokens onto the call stack", () => {
    const source =
      "const data=[" +
      "0,".repeat(70000) +
      "];window.addEventListener(`load`,()=>app.initialize());";
    expect(applicationEntryBinding(source).identifier).toBe("app");
  });

  test("binds every static and dynamic worker dependency, rejecting missing chunks", () => {
    const root = mkdtempSync(join(tmpdir(), "webvowl-worker-closure-"));
    try {
      mkdirSync(join(root, "js"));
      mkdirSync(join(root, "assets"));
      writeFileSync(
        join(root, "index.html"),
        '<script type="module" src="./js/index.js"></script>',
      );
      writeFileSync(
        join(root, "js/index.js"),
        'new Worker(new URL("../assets/worker.js",import.meta.url),{type:"module"});window.addEventListener("load",()=>app.initialize());',
      );
      writeFileSync(
        join(root, "assets/worker.js"),
        'import "./core.js";import("./parser.js");',
      );
      writeFileSync(
        join(root, "assets/core.js"),
        'export { value } from "./shared.js";',
      );
      writeFileSync(join(root, "assets/parser.js"), 'import "./shared.js";');
      writeFileSync(join(root, "assets/shared.js"), "export const value=1;");
      expect(
        productionManifest(root).workerClosures["assets/worker.js"],
      ).toEqual([
        "assets/core.js",
        "assets/parser.js",
        "assets/shared.js",
        "assets/worker.js",
      ]);
      rmSync(join(root, "assets/parser.js"));
      expect(() => productionManifest(root)).toThrow(/Missing worker module/u);
    } finally {
      expect(dirname(resolve(root))).toBe(resolve(tmpdir()));
      rmSync(root, { recursive: true });
    }
  });

  test("uses ABBA with at least twenty independent observations per version", () => {
    const order = buildCohortOrder(20);
    expect(order.slice(0, 8)).toEqual(["A", "B", "B", "A", "A", "B", "B", "A"]);
    expect(order.filter((item) => item === "A")).toHaveLength(20);
    expect(order.filter((item) => item === "B")).toHaveLength(20);
    expect(() => buildCohortOrder(19)).toThrow(/even.*20/u);
  });

  test("reports nearest-rank p95 and does not turn diagnostic samples into acceptance", () => {
    expect(
      summarizeSamples(Array.from({ length: 20 }, (_, index) => index + 1)),
    ).toEqual({
      count: 20,
      medianMs: 10.5,
      p95Ms: 19,
      acceptanceSampleCount: true,
    });
    expect(summarizeSamples([1, 2]).acceptanceSampleCount).toBe(false);
    expect(() => summarizeSamples([1, Number.NaN])).toThrow(/finite/u);
  });

  test("resumes the original ABBA positions and refuses partial cohort checkpoints", () => {
    expect(productionCohortSchedule(13, 40)).toEqual(
      productionCohortSchedule().slice(12),
    );
    expect(productionCohortSchedule(13, 16).map((row) => row.label)).toEqual([
      "A",
      "B",
      "B",
      "A",
    ]);
    expect(() => productionCohortSchedule(0, 40)).toThrow(/range/u);
    expect(() => productionCohortSchedule(14, 13)).toThrow(/range/u);
    const names = [
      "B2-load",
      "B3-count",
      "B3-filter",
      "B3-slider-0",
      "B3-slider-1",
      "B3-slider-2",
      "B3-slider-3",
      "B4-click",
      "B5-search",
      "B6-edit-0",
      "B6-edit-1",
      "B6-edit-2",
      "B6-edit-3",
      "B6-edit-4",
      "B6-edit-5",
      "B6-edit-6",
      "B6-edit-7",
      "B6-edit-8",
      "B6-edit-9",
    ];
    const rows = names.map((name) => ({ name, cohort: "A", warmup: false }));
    const identity = { index: 13, label: "A", warmup: false, startSample: 19 };
    expect(completedProductionCohort(rows, identity)).toEqual({
      ...identity,
      sampleCount: 19,
      correctnessAssertionsCompleted: true,
    });
    expect(() =>
      completedProductionCohort(rows.slice(0, -1), identity),
    ).toThrow(/complete ordered/u);
    expect(() =>
      completedProductionCohort(
        [...rows.slice(0, -1), { ...rows.at(-1), cohort: "B" }],
        identity,
      ),
    ).toThrow(/mix labels/u);
  });

  test("requires ordered controller completion and two distinct animation frames", () => {
    const valid = {
      mode: "latency",
      start: 10,
      completed: 12,
      frame1: 16,
      frame2: 32,
      instrumentation: false,
    };
    expect(validateBoundary(valid)).toBe(22);
    expect(() => validateBoundary({ ...valid, completed: 17 })).toThrow(
      /order/u,
    );
    expect(() => validateBoundary({ ...valid, frame2: 16 })).toThrow(
      /distinct/u,
    );
    expect(() => validateBoundary({ ...valid, instrumentation: true })).toThrow(
      /instrumented/u,
    );
  });

  test("recovers W4 from the qualification constructor with independently pinned identities", () => {
    expect(connectedClasses(2, true)).toBe(
      "Ontology(<urn:resource> Declaration(Class(<urn:C0>)) Declaration(Class(<urn:C1>)) SubClassOf(<urn:C0> <urn:C1>))",
    );
    const hash = (value) => createHash("sha256").update(value).digest("hex");
    expect(hash(connectedClasses(2000, true))).toBe(
      "dc51747c38fa565c1c7f349f57c90078c4f5419711467b26abd117b18d397590",
    );
    expect(hash(connectedClasses(2000, false))).toBe(
      "3bdd05a53ac5f964d0d6644071e4fe7fe0a1120de6c3c605fce5b383609033a9",
    );
  });

  test("uses native frame identity when callback-entry clocks round to the same value", async () => {
    const frames = [16.6, 16.6, 20.8];
    const observation = await observeTwoAnimationFrames(
      (done) => done(frames.shift()),
      () => 21,
    );
    expect(observation.skippedDuplicateFrames).toBe(1);
    expect(
      validateBoundary({
        mode: "latency",
        start: 10,
        completed: 20,
        instrumentation: false,
        ...observation,
      }),
    ).toBe(11);
    expect(() =>
      validateBoundary({
        mode: "latency",
        start: 10,
        completed: 20,
        instrumentation: false,
        ...observation,
        animationFrame2: 16.6,
      }),
    ).toThrow(/distinct/u);
    await expect(
      observeTwoAnimationFrames(
        (done) => done(16.6),
        () => 21,
      ),
    ).rejects.toThrow(/did not advance/u);
  });
});
