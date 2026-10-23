import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { createServer } from "node:http";
import {
  createWriteStream,
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { arch, release, platform, cpus } from "node:os";
import { extname, resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import {
  assertQuiescentMachine,
  cpuBusyFraction,
} from "./benchmarkEnvironment.mjs";
import {
  completedProductionCohort,
  connectedClasses,
  observeTwoAnimationFrames,
  productionManifest,
  productionCohortSchedule,
  sha256,
  summarizeSamples,
  validateBoundary,
} from "./productionPerformance.mjs";
import { createProductionTrace } from "./productionTrace.mjs";
import { measureProductionNavigation } from "./productionNavigation.mjs";
import {
  measureProductionTextLayout,
  qualifyProductionTextLayoutControls,
} from "./productionTextLayout.mjs";
import {
  installProductionLifetimeProbe,
  measureProductionLifetime,
} from "./productionLifetime.mjs";
import {
  installProductionCueProbe,
  measureProductionSearchCues,
} from "./productionSearchCues.mjs";
import { measureProductionRendererReuse } from "./productionRendererReuse.mjs";

// A companion to qualify-canonical-browser.mjs: actual production HTML/CSS,
// headed isolated Chrome, and separately labelled latency/diagnostic passes.
const [chromePath, buildPath, manifestPath, outputPath, ...options] =
  process.argv.slice(2);
assert(
  chromePath && buildPath && manifestPath && outputPath,
  "Usage: node util/measure-production-performance.mjs <chrome> <production-directory> <manifest> <new-evidence-directory> [--mode=latency|counters|trace|cues|lifetime|layout|reuse|functional|navigation] [--fixture=W1] [--diagnostic] [--private-fixture=path] [--allow-busy-host --admission-reference=path] [--headless-diagnostics --diagnostic-admission-reference=path] [--cohort-start=1 --cohort-end=40] [--renderer-reuse-reference]",
);
const option = (name, fallback) =>
  options
    .find((value) => value.startsWith(`--${name}=`))
    ?.slice(name.length + 3) ?? fallback;
const mode = option("mode", "latency");
const nativeTextControl = options.includes("--native-text-control");
assert(
  !nativeTextControl || mode === "layout",
  "Text controls require layout diagnostic mode",
);
assert(
  [
    "latency",
    "counters",
    "trace",
    "cues",
    "lifetime",
    "layout",
    "reuse",
    "functional",
    "navigation",
  ].includes(mode),
);
const functional = mode === "functional";
const headlessDiagnostics = options.includes("--headless-diagnostics");
const diagnosticAdmissionReference = option(
  "diagnostic-admission-reference",
  undefined,
);
assert(
  !headlessDiagnostics ||
    (["counters", "trace", "cues", "lifetime", "layout", "reuse"].includes(
      mode,
    ) &&
      diagnosticAdmissionReference &&
      existsSync(diagnosticAdmissionReference)),
  "Headless diagnostics require counters/trace/cues/lifetime/layout mode and their owner decision; they cannot supply foreground latency",
);
assert(
  !["cues", "lifetime", "layout", "reuse"].includes(mode) ||
    headlessDiagnostics,
  "Cue, lifetime and layout probes are headless diagnostics only",
);
const requireForeground = !functional && !headlessDiagnostics;
const allowBusyHost = options.includes("--allow-busy-host");
const admissionReference = option("admission-reference", undefined);
assert(
  !allowBusyHost || (admissionReference && existsSync(admissionReference)),
  "Busy-host measurement requires its explicit owner decision reference",
);
const diagnostic = headlessDiagnostics || options.includes("--diagnostic");
const cohortStart = Number(option("cohort-start", "1"));
const cohortEnd = Number(option("cohort-end", "40"));
const requestedCohorts = productionCohortSchedule(cohortStart, cohortEnd);
assert(
  (cohortStart === 1 && cohortEnd === 40) ||
    (mode === "latency" && !diagnostic),
  "Cohort segments apply only to full latency collection",
);
const fixtureName = option("fixture", "W1");
assert(
  mode !== "navigation" || fixtureName === "W1",
  "Navigation loads the production default FOAF fixture",
);
const allNodes = fixtureName.startsWith("W4") || fixtureName.endsWith("all");
assert(
  [
    "W1",
    "W2",
    "W3",
    "W4-connected",
    "W4-disconnected",
    "W5-auto",
    "W5-all",
  ].includes(fixtureName),
  "Unknown benchmark workload",
);
const output = resolve(outputPath);
assert(!existsSync(output), "Each run needs a fresh evidence directory");
mkdirSync(output);
for (const name of [
  "samples.jsonl",
  "preflights.jsonl",
  "rejected-samples.jsonl",
  "cohorts.jsonl",
])
  writeFileSync(resolve(output, name), "", { flag: "wx" });
const appendRecord = (name, value) =>
  appendFileSync(resolve(output, name), JSON.stringify(value) + "\n");
const writeJson = (name, value) =>
  writeFileSync(resolve(output, name), JSON.stringify(value, null, 2) + "\n", {
    flag: "wx",
  });
const report = {
  schemaVersion: 4,
  status: "running",
  mode,
  headed: requireForeground,
  measurementClass: functional
    ? "functional-only"
    : headlessDiagnostics
      ? "headless-diagnostic-only"
      : diagnostic || ["counters", "trace"].includes(mode)
        ? "foreground-diagnostic"
        : "foreground-latency",
  ...(headlessDiagnostics
    ? {
        diagnosticAdmissionDecision: {
          path: resolve(diagnosticAdmissionReference),
          sha256: sha256(readFileSync(diagnosticAdmissionReference)),
        },
      }
    : {}),
  cpuAdmissionPolicy: allowBusyHost
    ? "owner-authorized-observe-only"
    : "quiescent-10-percent-over-500-ms",
  ...(allowBusyHost
    ? {
        cpuAdmissionDecision: {
          path: resolve(admissionReference),
          sha256: sha256(readFileSync(admissionReference)),
        },
      }
    : {}),
  acceptanceEligible: ["latency", "navigation"].includes(mode) && !diagnostic,
  diagnostic,
  startedAt: new Date().toISOString(),
  fixture: fixtureName,
  instrumentation: ["counters", "trace", "cues", "lifetime", "layout"].includes(
    mode,
  ),
  samples: [],
  cohortRange: { start: cohortStart, end: cohortEnd },
  completedCohorts: [],
  rejectedPreflights: [],
  cpuPreflights: [],
  exceptions: [],
  limitations: [
    "Two animation frames observe a paint opportunity after completion; they are not field INP or compositor presentation timestamps.",
    "Worker ready/phase markers are unavailable in the current single-result protocol; CPU attribution is separate from acceptance timing.",
    ...(headlessDiagnostics
      ? [
          "Owner deferred foreground timing. Headless traces and counters establish diagnostic work only, not foreground paint latency, p95 budget acceptance, or a measured user-facing speedup.",
        ]
      : []),
  ],
};
const events = new Map();
const pending = new Map();
let socket, browser, browserEnded, server, session;
let sequence = 0;
let browserClosed = false;
function call(method, params = {}, sessionId = session) {
  assert(
    sessionId === undefined ||
      sessionId === null ||
      typeof sessionId === "string",
    "CDP target session must be an observed session ID or null for the browser",
  );
  const id = ++sequence;
  return new Promise((done, fail) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      fail(new Error(`CDP deadline: ${method}`));
    }, 180000);
    pending.set(id, { done, fail, timer });
    socket.send(
      JSON.stringify({
        id,
        method,
        params,
        ...(sessionId ? { sessionId } : {}),
      }),
    );
  });
}
async function evaluate(expression) {
  const result = await call("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  assert(!result.exceptionDetails, JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
async function waitFor(action, description, attempts = 240) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    const value = await action();
    if (value) return value;
    await delay(250);
  }
  throw new Error(`Deadline: ${description}`);
}
async function withDeadline(operation, milliseconds, description) {
  let timer;
  try {
    return await Promise.race([
      operation,
      new Promise((_done, fail) => {
        timer = setTimeout(() => fail(new Error(description)), milliseconds);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
async function idle(label) {
  const deadline = performance.now() + 900000;
  for (;;) {
    try {
      if (requireForeground) await call("Page.bringToFront");
      if (
        requireForeground &&
        !(await evaluate(
          "document.visibilityState === 'visible' && document.hasFocus()",
        ))
      ) {
        const activation = observeWindowsBrowser(browser.pid, {
          collectEnvironment: false,
        });
        report.foregroundAttempts ??= [];
        report.foregroundAttempts.push({
          label,
          at: new Date().toISOString(),
          ...activation,
        });
        await delay(1000);
      }
      if (requireForeground)
        assert(
          await evaluate(
            "document.visibilityState === 'visible' && document.hasFocus()",
          ),
          "Measurement page must remain visible and focused",
        );
      const snapshots = [];
      try {
        await assertQuiescentMachine({
          readCpus: () => {
            const snapshot = cpus();
            snapshots.push(snapshot);
            return snapshot;
          },
        });
      } catch (error) {
        if (
          !allowBusyHost ||
          !error.message.startsWith("The machine is not idle:")
        )
          throw error;
        report.rejectedPreflights.push({
          label,
          at: new Date().toISOString(),
          message: error.message,
          ownerOverride: true,
        });
      } finally {
        if (snapshots.length === 2) {
          const reading = {
            label,
            at: new Date().toISOString(),
            busyFraction: cpuBusyFraction(snapshots[0], snapshots[1]),
            threshold: 0.1,
            sampleMs: 500,
          };
          report.cpuPreflights.push(reading);
          appendRecord("preflights.jsonl", {
            kind: "cpu",
            ...reading,
            observeOnly: allowBusyHost,
          });
        }
      }
      if (requireForeground)
        assert(
          await evaluate(
            "document.visibilityState === 'visible' && document.hasFocus()",
          ),
          "Measurement page lost foreground during preflight",
        );
      break;
    } catch (error) {
      const rejected = {
        label,
        at: new Date().toISOString(),
        message: error.message,
      };
      report.rejectedPreflights.push(rejected);
      appendRecord("preflights.jsonl", { kind: "rejected", ...rejected });
      console.error(JSON.stringify(rejected));
      if (
        !error.message.startsWith("The machine is not idle:") &&
        !error.message.includes("Measurement page")
      )
        throw error;
      if (performance.now() >= deadline) throw error;
      await delay(15000);
    }
  }
  if (requireForeground)
    assert(
      await evaluate(
        "document.visibilityState === 'visible' && document.hasFocus()",
      ),
      "Measurement page must remain visible and focused",
    );
}
const mime = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

// Only the browser process created by this run is eligible for activation.
// Failure is an environment admission gap; do not emulate page visibility.
function observeWindowsBrowser(
  pid,
  { collectEnvironment = true, activate = true } = {},
) {
  if (platform() !== "win32") return { supported: false };
  assert(Number.isSafeInteger(pid) && pid > 0);
  const script = `
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class WebVowlBenchmarkWindow {
 [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
 [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr hWnd, int command);
 [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);
 [DllImport("kernel32.dll")] public static extern bool GetSystemPowerStatus(out PowerStatus status);
 [StructLayout(LayoutKind.Sequential)] public struct PowerStatus { public byte ACLineStatus; public byte BatteryFlag; public byte BatteryLifePercent; public byte SystemStatusFlag; public uint BatteryLifeTime; public uint BatteryFullLifeTime; }
}
'@
$shown = $false
$activated = $false
${
  activate
    ? `$ownedBrowser = Get-Process -Id ${pid} -ErrorAction Stop
$ownedBrowser.Refresh()
if ($ownedBrowser.MainWindowHandle -eq 0) { throw 'Owned Chrome has no window' }
$shown = [WebVowlBenchmarkWindow]::ShowWindowAsync($ownedBrowser.MainWindowHandle, 9)
$activated = [WebVowlBenchmarkWindow]::SetForegroundWindow($ownedBrowser.MainWindowHandle)`
    : ""
}
[uint32]$foregroundProcess = 0
$foreground = [WebVowlBenchmarkWindow]::GetForegroundWindow()
$null = [WebVowlBenchmarkWindow]::GetWindowThreadProcessId($foreground, [ref]$foregroundProcess)
${
  collectEnvironment
    ? `$power = New-Object WebVowlBenchmarkWindow+PowerStatus
$powerAvailable = [WebVowlBenchmarkWindow]::GetSystemPowerStatus([ref]$power)
[pscustomobject]@{ requestedPid=${pid}; foregroundPid=$foregroundProcess; activationRequested=$${activate}; shown=$shown; activated=$activated; powerAvailable=$powerAvailable; acLineStatus=$power.ACLineStatus; powerPlan=(powercfg /getactivescheme | Out-String).Trim(); displays=@(Get-CimInstance Win32_VideoController | Select-Object CurrentHorizontalResolution,CurrentVerticalResolution,CurrentRefreshRate) } | ConvertTo-Json -Depth 4`
    : `[pscustomobject]@{ requestedPid=${pid}; foregroundPid=$foregroundProcess; shown=$shown; activated=$activated } | ConvertTo-Json`
}
`;
  return JSON.parse(
    execFileSync(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", script],
      { encoding: "utf8", windowsHide: true, timeout: 30000 },
    ),
  );
}

// This function is serialized into the page; it has no module captures.
function installMeasurement(
  { instrumented, traced, requireForeground, fixture, all, documentIri },
  twoFrames,
) {
  const {
    document,
    Document,
    Element,
    SVGGraphicsElement,
    SVGTextContentElement,
    innerWidth,
    innerHeight,
    devicePixelRatio,
  } = globalThis;
  const controller =
    globalThis.__webvowlMeasuredApplication.getWebVowlController();
  const counters = {};
  const workerEvents = [];
  let nextWorker = 0;
  const originals = [];
  let counting = false;
  let foregroundLost = false;
  const checkForeground = () => {
    if (
      counting &&
      (document.visibilityState !== "visible" || !document.hasFocus())
    )
      foregroundLost = true;
  };
  document.addEventListener("visibilitychange", checkForeground);
  globalThis.addEventListener("blur", checkForeground);
  const increment = (name, amount = 1) => {
    if (counting) counters[name] = (counters[name] ?? 0) + amount;
  };
  const replace = (owner, name, create) => {
    const original = owner[name];
    originals.push(() => {
      owner[name] = original;
    });
    owner[name] = create(original);
  };
  if (instrumented) {
    // The reference-key function serializes a 2–4-string tuple headed by one
    // of these kinds. Count that work, not "resolved references": a linear
    // resolver can serialize many candidate keys for a single lookup.
    replace(
      JSON,
      "stringify",
      (original) =>
        function (value, ...rest) {
          if (
            counting &&
            Array.isArray(value) &&
            value.length >= 2 &&
            value.length <= 4 &&
            ["class", "datatype", "property", "individual"].includes(
              value[0],
            ) &&
            value.every((item) => typeof item === "string")
          )
            increment("referenceShapedKeySerializations");
          return Reflect.apply(original, this, [value, ...rest]);
        },
    );
    const countInspectionInputs = (value) => {
      const pending = [value];
      const seen = new Set();
      while (pending.length) {
        const item = pending.pop();
        if (
          !item ||
          typeof item !== "object" ||
          seen.has(item) ||
          ArrayBuffer.isView(item) ||
          item instanceof ArrayBuffer
        )
          continue;
        seen.add(item);
        if (item.records?.ontology && Array.isArray(item.occurrences)) {
          increment("canonicalInspectionClones");
        } else if (
          Array.isArray(item.classRecords) &&
          Array.isArray(item.propertyRecords)
        ) {
          increment("projectedInspectionClones");
        } else {
          for (const child of Object.values(item)) pending.push(child);
        }
      }
    };
    replace(
      globalThis,
      "structuredClone",
      (original) =>
        function (value, ...rest) {
          increment("cloneCalls");
          if (counting) {
            const start = performance.now();
            try {
              increment(
                "cloneApproxSerializedBytes",
                new TextEncoder().encode(JSON.stringify(value)).byteLength,
              );
              countInspectionInputs(value);
            } catch {
              increment("unserializableCloneInputs");
            }
            increment("estimatorMs", performance.now() - start);
          }
          const start = performance.now();
          const result = Reflect.apply(original, this, [value, ...rest]);
          increment("cloneMs", performance.now() - start);
          return result;
        },
    );
    replace(
      Object,
      "freeze",
      (original) =>
        function (value) {
          increment("freezeCalls");
          return original(value);
        },
    );
    for (const name of ["createElement", "createElementNS"])
      replace(
        Document.prototype,
        name,
        (original) =>
          function (...args) {
            increment("domConstructions");
            return Reflect.apply(original, this, args);
          },
      );
    for (const [owner, name] of [
      [Element.prototype, "getBoundingClientRect"],
      [SVGGraphicsElement.prototype, "getBBox"],
      [SVGTextContentElement.prototype, "getComputedTextLength"],
    ]) {
      replace(
        owner,
        name,
        (original) =>
          function (...args) {
            increment(`${name}Calls`);
            const start = performance.now();
            const value = Reflect.apply(original, this, args);
            increment("layoutReadMs", performance.now() - start);
            return value;
          },
      );
    }
    replace(
      globalThis,
      "Worker",
      (Original) =>
        class extends Original {
          measurementId;
          constructor(...args) {
            super(...args);
            this.measurementId = ++nextWorker;
            increment("workerSpawns");
            if (counting)
              workerEvents.push({
                worker: this.measurementId,
                event: "created",
                at: performance.now(),
              });
            this.addEventListener("message", ({ data }) => {
              if (counting)
                workerEvents.push({
                  worker: this.measurementId,
                  event: `received-${data?.type}`,
                  at: performance.now(),
                });
            });
          }
          postMessage(...args) {
            const start = performance.now();
            if (counting)
              workerEvents.push({
                worker: this.measurementId,
                event: `send-${args[0]?.type}`,
                at: start,
              });
            const result = super.postMessage(...args);
            increment("workerPostMessageMs", performance.now() - start);
            return result;
          }
          terminate() {
            if (counting)
              workerEvents.push({
                worker: this.measurementId,
                event: "terminated",
                at: performance.now(),
              });
            increment("workerTerminations");
            return super.terminate();
          }
        },
    );
  }
  const loaf = [];
  let observer;
  if (
    (instrumented || traced) &&
    PerformanceObserver.supportedEntryTypes.includes("long-animation-frame")
  ) {
    observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) loaf.push(entry.toJSON());
    });
    observer.observe({ type: "long-animation-frame", buffered: false });
  }
  let bytes;
  let editTarget;
  const reset = () => {
    for (const key of Object.keys(counters)) delete counters[key];
    loaf.length = 0;
    workerEvents.length = 0;
    foregroundLost = false;
    performance.clearMeasures();
    performance.clearMarks();
  };
  const traceMark = (name) => {
    if (traced) performance.mark(`webvowl.s0.${name}`);
  };
  const observations = () => ({
    counters: { ...counters },
    workerEvents: [...workerEvents],
    loaf: [...loaf],
    measures: performance
      .getEntriesByType("measure")
      .map((entry) => entry.toJSON()),
    state: stateSummary(),
  });
  const stateSummary = () => {
    const state = controller.getState();
    return {
      status: state.status,
      loadGeneration: state.loadGeneration,
      documentRevision: state.documentRevision,
      nodeCountStatus: state.nodeCountStatus,
      selection: state.selection,
      selectedDocumentRecord: state.selectedDocumentRecord,
    };
  };
  const run = async (action) => {
    reset();
    counting = true;
    const start = performance.now();
    traceMark("start");
    try {
      await action();
      const completed = performance.now();
      traceMark("completed");
      const frames = await twoFrames();
      traceMark("paint-opportunity");
      counting = false;
      if (
        requireForeground &&
        (foregroundLost ||
          document.visibilityState !== "visible" ||
          !document.hasFocus())
      )
        throw new Error("Foreground changed during measured operation");
      if (observer)
        loaf.push(...observer.takeRecords().map((entry) => entry.toJSON()));
      return {
        start,
        completed,
        ...frames,
        ...observations(),
      };
    } finally {
      counting = false;
    }
  };
  let interaction;
  const arm = (selector, eventType) => {
    reset();
    const element = document.querySelector(selector);
    if (!element) throw new Error(`Missing interaction target ${selector}`);
    const rect = element.getBoundingClientRect();
    let pointerStart;
    if (eventType === "click")
      element.addEventListener(
        "pointerdown",
        (event) => {
          pointerStart = event.timeStamp;
          counting = true;
          traceMark("start");
        },
        { capture: true, once: true },
      );
    interaction = new Promise((done) => {
      element.addEventListener(
        eventType,
        (event) => {
          counting = true;
          const start = pointerStart ?? event.timeStamp;
          if (pointerStart === undefined) traceMark("start");
          // The production click/input handlers are synchronous. Queue after their
          // dispatch and verify the required DOM/state outcome before two frames.
          setTimeout(async () => {
            const completed = performance.now();
            traceMark("completed");
            const frames = await twoFrames();
            traceMark("paint-opportunity");
            counting = false;
            if (observer)
              loaf.push(
                ...observer.takeRecords().map((entry) => entry.toJSON()),
              );
            done({
              start,
              completed,
              ...frames,
              ...observations(),
              results: document.querySelectorAll(
                "#search-results-listbox .search-option",
              ).length,
              detailsText:
                document.querySelector(
                  "#classSelectionInformation:not(.hidden), #propertySelectionInformation:not(.hidden)",
                )?.textContent.length ?? 0,
              foregroundLost:
                foregroundLost ||
                document.visibilityState !== "visible" ||
                !document.hasFocus(),
            });
          });
        },
        { capture: true, once: true },
      );
    });
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  };
  globalThis.__webvowlMeasurement = {
    async prepare() {
      bytes = new Uint8Array(
        await (await fetch("/__measurement-fixture")).arrayBuffer(),
      );
      await document.fonts.ready;
      return {
        visibility: document.visibilityState,
        focus: document.hasFocus(),
        viewport: {
          width: innerWidth,
          height: innerHeight,
          dpr: devicePixelRatio,
        },
        fonts: [...document.fonts].map((font) => ({
          family: font.family,
          style: font.style,
          weight: font.weight,
          status: font.status,
        })),
        loafSupported: PerformanceObserver.supportedEntryTypes.includes(
          "long-animation-frame",
        ),
        nativeWrapperCount: originals.length,
      };
    },
    load() {
      editTarget = undefined;
      const source =
        fixture.startsWith("W4") || fixture.startsWith("W5")
          ? {
              kind: "ontology-bytes",
              bytes,
              documentIri,
              ...(fixture.startsWith("W4") ? { format: "functional" } : {}),
              displayName: fixture.startsWith("W4")
                ? "benchmark.ofn"
                : "benchmark.owl",
            }
          : { kind: "vowl-json-bytes", bytes };
      return run(() =>
        controller.loadOntology(
          { source },
          {
            initialVisualization: {
              view: {
                layout: "pause",
                nodesShown: { mode: all ? "all" : "auto" },
              },
            },
            useAutomaticNodesShown: !all,
          },
        ),
      );
    },
    state: stateSummary,
    editor: () =>
      controller.getOntologyEditorView(
        editTarget ?? controller.getState().selectedDocumentRecord,
      ),
    async prepareEdits() {
      let offset = 0;
      do {
        const page = controller.getVisualizationArrangement({
          offset,
          limit: 100,
        });
        for (const occurrence of page.occurrences) {
          for (const target of occurrence.recordTargets) {
            const editor = controller.getOntologyEditorView(target);
            if (
              !editor.selectedRecord?.labelEditable ||
              !["owl:Class", "owl:DeprecatedClass", "rdfs:Class"].includes(
                editor.selectedRecord.type,
              )
            )
              continue;
            editTarget = target;
            await controller.selectVisualizationElement({
              reference: occurrence.reference,
            });
            await twoFrames();
            return {
              target,
              occurrence: occurrence.reference,
              type: editor.selectedRecord.type,
              iri: editor.selectedRecord.iri,
            };
          }
        }
        offset = page.nextOffset;
      } while (offset !== null);
      throw new Error("No visible named class accepts label edits");
    },
    async prepareSlider() {
      const menu = document.querySelector("#m_filter");
      menu.showPopover();
      const range = document.querySelector("#nodesShown-range");
      range.focus();
      await Promise.allSettled(
        document.getAnimations().map((animation) => animation.finished),
      );
      await twoFrames();
      if (
        document.activeElement !== range ||
        range.disabled ||
        range.getBoundingClientRect().width === 0
      )
        throw new Error(
          "Native nodes-shown slider must be visible, enabled and focused",
        );
      return Number(range.value);
    },
    armSlider(requestedCount) {
      reset();
      const range = document.querySelector("#nodesShown-range");
      let start;
      range.addEventListener(
        "input",
        (event) => {
          counting = true;
          start = event.timeStamp;
          traceMark("start");
        },
        { capture: true, once: true },
      );
      interaction = new Promise((done) => {
        const completion = new PerformanceObserver(async (list) => {
          const entry = list
            .getEntries()
            .find(
              (item) =>
                item.name === "webvowl.node-count-interaction" &&
                item.detail?.nodeCountStatus?.shownNodeCount === requestedCount,
            );
          if (!entry || start === undefined) return;
          completion.disconnect();
          const completed = entry.startTime + entry.duration;
          traceMark("completed");
          const frames = await twoFrames();
          traceMark("paint-opportunity");
          counting = false;
          if (observer)
            loaf.push(...observer.takeRecords().map((item) => item.toJSON()));
          done({
            start,
            completed,
            ...frames,
            ...observations(),
            inputValue: Number(range.value),
            foregroundLost:
              foregroundLost ||
              document.visibilityState !== "visible" ||
              !document.hasFocus(),
          });
        });
        completion.observe({ type: "measure", buffered: false });
      });
    },
    async closeSlider() {
      document.querySelector("#m_filter").hidePopover();
      await twoFrames();
    },
    view: (view) => run(() => controller.setVisualizationView(view)),
    async center() {
      await controller.setVisualizationView({ viewport: "zoom-and-center" });
      await twoFrames();
    },
    armClick() {
      const nodes = [...document.querySelectorAll("#graph .node")];
      const node = nodes.find((candidate) => {
        const rect = candidate.getBoundingClientRect();
        const hit = document.elementFromPoint(
          rect.x + rect.width / 2,
          rect.y + rect.height / 2,
        );
        return rect.width > 5 && candidate.contains(hit);
      });
      if (!node) throw new Error("No visible hit-testable ontology node");
      node.dataset.measurementTarget = "true";
      return arm('[data-measurement-target="true"]', "click");
    },
    clearSearch() {
      const input = document.getElementById("search-input-text");
      input.value = "";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.focus();
    },
    armSearch: () => arm("#search-input-text", "input"),
    interaction: () => interaction,
    edit(index) {
      const state = controller.getState();
      return run(() =>
        controller.editOntologyRecord({
          loadGeneration: state.loadGeneration,
          recordTarget: editTarget,
          changes: {
            label: {
              text: `S0 label ${String(index).padStart(2, "0")}`,
              language: "en",
            },
          },
        }),
      );
    },
    restore() {
      observer?.disconnect();
      document.removeEventListener("visibilitychange", checkForeground);
      globalThis.removeEventListener("blur", checkForeground);
      for (const restore of originals.reverse()) restore();
    },
  };
}

try {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const actual = productionManifest(buildPath);
  assert.deepEqual(
    actual.files,
    manifest.files,
    "Production bytes changed after manifest capture",
  );
  assert.deepEqual(actual.application, manifest.application);
  report.manifest = {
    path: resolve(manifestPath),
    sha256: sha256(readFileSync(manifestPath)),
    source: manifest.source,
    entry: manifest.entry,
    workers: manifest.workers,
  };
  report.comparison = {
    kind: "A/A calibration: both cohort labels use the same production bytes",
    A: report.manifest.sha256,
    B: report.manifest.sha256,
  };
  report.harness = [
    fileURLToPath(import.meta.url),
    resolve(
      dirname(fileURLToPath(import.meta.url)),
      "productionPerformance.mjs",
    ),
    resolve("util/benchmarkEnvironment.mjs"),
    resolve("util/productionTrace.mjs"),
    resolve("util/productionLifetime.mjs"),
    resolve("util/productionTextLayout.mjs"),
    resolve("util/productionNavigation.mjs"),
    resolve("util/productionSearchCues.mjs"),
    resolve("util/productionRendererReuse.mjs"),
  ].map((path) => ({ path, sha256: sha256(readFileSync(path)) }));
  report.environment = {
    platform: platform(),
    release: release(),
    architecture: arch(),
    node: process.version,
    chrome: resolve(chromePath),
    chromeSha256: sha256(readFileSync(chromePath)),
    sourceHead: execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
    }).trim(),
  };
  const fixtureFile = { W1: "foaf", W2: "benchmark", W3: "goodrelations" }[
    fixtureName
  ];
  const fixtureBytes = fixtureFile
    ? readFileSync(resolve(`src/canonical-examples/${fixtureFile}.json`))
    : fixtureName.startsWith("W4")
      ? Buffer.from(connectedClasses(2000, fixtureName === "W4-connected"))
      : readFileSync(resolve(option("private-fixture", "")));
  report.workload = {
    name: fixtureName,
    byteLength: fixtureBytes.length,
    sha256: sha256(fixtureBytes),
    private: fixtureName.startsWith("W5"),
    initialNodesShown: allNodes ? "all" : "auto",
    documentIri: fixtureName.startsWith("W4")
      ? "urn:resource"
      : fixtureName.startsWith("W5")
        ? pathToFileURL(resolve(option("private-fixture", ""))).href
        : undefined,
  };
  if (fixtureName.startsWith("W5"))
    assert.equal(
      report.workload.sha256,
      "85214ddc93194fccf5c0fc4bbbc8f34ab54e54f4abb352f0543411fd56b1c3f6",
      "Private workload must match the approved W5 bytes",
    );
  const assetBytes = new Map(
    manifest.files.map((file) => [
      `/${file.path}`,
      readFileSync(resolve(buildPath, file.path)),
    ]),
  );
  report.httpCachePolicy =
    "Public max-age=3600 for immutable per-run production bytes; fixture endpoint is no-store";
  server = createServer((request, response) => {
    const pathname = new URL(request.url, "http://127.0.0.1").pathname;
    const path = pathname === "/" ? "/index.html" : pathname;
    const bytes =
      path === "/__measurement-fixture" ? fixtureBytes : assetBytes.get(path);
    if (!bytes) {
      response.writeHead(404);
      response.end();
      return;
    }
    response.writeHead(200, {
      "Content-Type": mime[extname(path)] ?? "application/octet-stream",
      "Cache-Control":
        path === "/__measurement-fixture" ? "no-store" : "public, max-age=3600",
    });
    response.end(bytes);
  });
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const profile = resolve(output, "chrome-profile");
  browser = spawn(
    chromePath,
    [
      ...(!requireForeground ? ["--headless=new"] : []),
      "--disable-extensions",
      "--disable-component-extensions-with-background-pages",
      "--no-first-run",
      "--no-default-browser-check",
      "--remote-debugging-address=127.0.0.1",
      "--remote-debugging-port=0",
      `--user-data-dir=${profile}`,
      "--window-size=1440,1000",
      "about:blank",
    ],
    { windowsHide: !requireForeground, stdio: ["ignore", "pipe", "pipe"] },
  );
  const log = createWriteStream(resolve(output, "chrome.log"), { flags: "wx" });
  browser.stdout.pipe(log, { end: false });
  browser.stderr.pipe(log, { end: false });
  browserEnded = new Promise((done) =>
    browser.once("close", (code, signal) => {
      log.end();
      browserClosed = true;
      done({ code, signal });
    }),
  );
  browser.on("error", (error) => {
    report.browserError = error.message;
  });
  const portFile = resolve(profile, "DevToolsActivePort");
  await waitFor(() => existsSync(portFile), "owned Chrome endpoint");
  const [port, endpoint] = readFileSync(portFile, "utf8")
    .trim()
    .split(/\r?\n/u);
  socket = new WebSocket(`ws://127.0.0.1:${port}${endpoint}`);
  await new Promise((done, fail) => {
    socket.addEventListener("open", done, { once: true });
    socket.addEventListener("error", fail, { once: true });
  });
  socket.addEventListener("message", ({ data }) => {
    const message = JSON.parse(data);
    if (message.id) {
      const item = pending.get(message.id);
      if (!item) return;
      clearTimeout(item.timer);
      pending.delete(message.id);
      if (message.error) item.fail(new Error(JSON.stringify(message.error)));
      else item.done(message.result);
    } else events.get(message.method)?.(message.params, message.sessionId);
  });
  report.browser = await call("Browser.getVersion", {}, undefined);
  const { targetInfos } = await call("Target.getTargets", {}, undefined);
  const targets = targetInfos.filter((target) => target.type === "page");
  assert.equal(targets.length, 1, "Dedicated browser must have one page");
  ({ sessionId: session } = await call(
    "Target.attachToTarget",
    { targetId: targets[0].targetId, flatten: true },
    undefined,
  ));
  await call("Runtime.enable");
  await call("Page.enable");
  events.set("Runtime.exceptionThrown", (params) =>
    report.exceptions.push(params.exceptionDetails),
  );
  await call("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await call("Page.bringToFront");
  if (mode === "navigation") {
    report.windowsEnvironment = observeWindowsBrowser(browser.pid);
    await waitFor(
      () =>
        evaluate(
          "document.visibilityState === 'visible' && document.hasFocus()",
        ),
      "navigation browser foreground admission",
      60,
    );
    if (platform() === "win32")
      assert(
        report.windowsEnvironment.powerAvailable &&
          report.windowsEnvironment.acLineStatus === 1,
        "Navigation requires confirmed AC power",
      );
    await delay(30000);
    writeJson("admission.json", report);
    await measureProductionNavigation({
      call,
      evaluate,
      waitFor,
      idle,
      origin,
      diagnostic,
      report,
      onSample(row) {
        appendRecord("samples.jsonl", row);
        writeFileSync(
          resolve(output, "progress.json"),
          JSON.stringify({
            completed: report.samples.length,
            latest: {
              name: row.name,
              cohort: row.cohort,
              durationMs: row.durationMs,
            },
          }),
        );
        console.log(
          JSON.stringify({
            name: row.name,
            cohort: row.cohort,
            warmup: row.warmup,
            durationMs: row.durationMs,
          }),
        );
      },
    });
  } else {
    if (mode === "cues")
      await call("Page.addScriptToEvaluateOnNewDocument", {
        source: `(${installProductionCueProbe.toString()})()`,
      });
    if (mode === "lifetime")
      await call("Page.addScriptToEvaluateOnNewDocument", {
        source: `(${installProductionLifetimeProbe.toString()})()`,
      });
    await call("Debugger.enable");
    let pause;
    const paused = new Promise((done) => {
      pause = done;
    });
    events.set("Debugger.paused", pause);
    await call("Debugger.setBreakpointByUrl", {
      url: `${origin}/${manifest.entry}`,
      lineNumber: manifest.application.lineNumber,
      columnNumber: manifest.application.columnNumber,
    });
    await call("Page.navigate", { url: origin });
    const interruption = await withDeadline(
      paused,
      60000,
      "Production application setup breakpoint not reached",
    );
    const handle = await call("Debugger.evaluateOnCallFrame", {
      callFrameId: interruption.callFrames[0].callFrameId,
      expression: `globalThis.__webvowlMeasuredApplication = ${manifest.application.identifier}; true`,
      returnByValue: true,
    });
    assert(!handle.exceptionDetails, JSON.stringify(handle.exceptionDetails));
    await call("Debugger.resume");
    await call("Debugger.disable");
    events.delete("Debugger.paused");
    await call("Target.activateTarget", { targetId: targets[0].targetId });
    await call("Page.bringToFront");
    if (!functional) {
      report.windowsEnvironment = observeWindowsBrowser(browser.pid, {
        activate: requireForeground,
      });
    }
    if (requireForeground) {
      await waitFor(
        () =>
          evaluate(
            "document.visibilityState === 'visible' && document.hasFocus()",
          ),
        "headed Chrome foreground admission",
        60,
      );
    }
    report.setupVisibility = await evaluate(
      "({visibility:document.visibilityState,focus:document.hasFocus()})",
    );
    console.log(JSON.stringify({ setupVisibility: report.setupVisibility }));
    if (requireForeground)
      assert.equal(
        report.setupVisibility.visibility,
        "visible",
        "Owned headed browser must be visible before measurement setup",
      );
    if (!functional && platform() === "win32")
      assert(
        report.windowsEnvironment.powerAvailable &&
          report.windowsEnvironment.acLineStatus === 1,
        "Production measurement requires confirmed AC power",
      );
    await waitFor(async () => {
      const state = await evaluate(
        "globalThis.__webvowlMeasuredApplication?.getWebVowlController()?.getState()",
      );
      if (state?.status === "error")
        throw new Error(
          `Default ontology failed: ${JSON.stringify(state.error)}`,
        );
      return state?.status === "ready";
    }, "default ontology ready");
    await evaluate(
      `(${installMeasurement.toString()})(${JSON.stringify({ instrumented: mode === "counters", traced: ["trace", "layout"].includes(mode), requireForeground, fixture: fixtureName, all: allNodes, documentIri: report.workload.documentIri })}, ${observeTwoAnimationFrames.toString()})`,
    );
    report.page = await evaluate("__webvowlMeasurement.prepare()");
    if (mode !== "counters")
      assert.equal(
        report.page.nativeWrapperCount,
        0,
        "Latency and trace passes must not install counter wrappers",
      );
    if (!functional && !nativeTextControl) await delay(30000);
    writeJson("admission.json", report);
    const trace = ["trace", "layout"].includes(mode)
      ? createProductionTrace({ call, events, output })
      : undefined;
    async function measure(name, expression, cohort, warmup = false) {
      report.activeOperation = { name, cohort, warmup };
      if (!functional) await idle(`${cohort}:${name}`);
      if (trace) {
        await trace.start();
        await call("Profiler.enable");
        await call("Profiler.start");
      }
      const row =
        typeof expression === "function"
          ? await expression()
          : await evaluate(expression);
      if (requireForeground)
        assert(
          !row.foregroundLost,
          "Foreground changed during measured interaction",
        );
      if (trace) {
        const { profile: cpuProfile } = await call("Profiler.stop");
        const profileName = `cpu-${report.samples.length}-${name}.json`;
        writeJson(profileName, cpuProfile);
        row.cpuProfile = profileName;
        await call("Profiler.disable");
        row.trace = await trace.stop(
          `trace-${report.samples.length}-${name}.json.gz`,
        );
        if (row.trace.dataLossOccurred)
          appendRecord("rejected-samples.jsonl", {
            name,
            cohort,
            warmup,
            ...row,
            error: "Diagnostic trace buffer lost data",
          });
        assert(
          !row.trace.dataLossOccurred,
          "Diagnostic trace buffer lost data",
        );
      }
      let durationMs;
      try {
        durationMs = validateBoundary({
          ...row,
          mode,
          instrumentation: mode !== "latency",
        });
      } catch (error) {
        appendRecord("rejected-samples.jsonl", {
          name,
          cohort,
          warmup,
          ...row,
          error: error.message,
        });
        throw error;
      }
      if (functional) {
        for (const key of [
          "start",
          "completed",
          "frame1",
          "frame2",
          "animationFrame1",
          "animationFrame2",
        ])
          delete row[key];
        delete row.measures;
        row.boundaryOrderVerified = true;
      } else row.durationMs = durationMs;
      row.name = name;
      row.cohort = cohort;
      row.warmup = warmup;
      row.cohortIndex = report.activeCohort.index;
      report.samples.push(row);
      appendRecord("samples.jsonl", row);
      writeFileSync(
        resolve(output, "progress.json"),
        JSON.stringify({
          fixture: fixtureName,
          completed: report.samples.length,
          latest: { name, cohort, durationMs: row.durationMs },
        }),
      );
      console.log(
        JSON.stringify({ name, cohort, warmup, durationMs: row.durationMs }),
      );
      return row;
    }
    if (nativeTextControl) {
      await qualifyProductionTextLayoutControls({ evaluate, report });
    } else if (mode === "reuse") {
      await measureProductionRendererReuse({
        call,
        evaluate,
        report,
        output,
        reference: options.includes("--renderer-reuse-reference"),
      });
    } else if (mode === "layout") {
      await measureProductionTextLayout({ evaluate, measure, report });
    } else if (mode === "lifetime") {
      await measureProductionLifetime({ call, evaluate, measure, report });
    } else if (mode === "cues") {
      await measureProductionSearchCues({
        call,
        evaluate,
        measure,
        report,
        fixtureName,
      });
    } else {
      const schedule = functional
        ? [{ label: "functional", index: 0, warmup: false }]
        : [
            { label: "warmup", index: 0, warmup: true },
            ...(diagnostic || mode !== "latency"
              ? [{ label: "A", index: 1, warmup: false }]
              : requestedCohorts),
          ];
      for (const { index, label: cohort, warmup } of schedule) {
        const startSample = report.samples.length;
        report.activeCohort = { index, label: cohort, warmup };
        await measure("B2-load", "__webvowlMeasurement.load()", cohort, warmup);
        const before = await evaluate("__webvowlMeasurement.state()");
        const count = before.nodeCountStatus.shownNodeCount;
        await measure(
          "B3-count",
          `__webvowlMeasurement.view({nodesShown:{mode:'exact',requestedCount:${Math.max(1, count - 1)}}})`,
          cohort,
          warmup,
        );
        await measure(
          "B3-filter",
          "__webvowlMeasurement.view({filters:{datatypes:'hide'}})",
          cohort,
          warmup,
        );
        await evaluate(
          "__webvowlMeasurement.view({filters:{datatypes:'show'}})",
        );
        assert.equal(
          await evaluate("__webvowlMeasurement.prepareSlider()"),
          count - 1,
        );
        for (const [step, requestedCount] of [
          Math.max(1, count - 2),
          Math.max(1, count - 3),
          Math.max(1, count - 2),
          Math.max(1, count - 1),
        ].entries()) {
          await evaluate(`__webvowlMeasurement.armSlider(${requestedCount})`);
          const revision = await measure(
            `B3-slider-${step}`,
            async () => {
              const key = step < 2 ? "ArrowLeft" : "ArrowRight";
              const virtualKey = step < 2 ? 37 : 39;
              await call("Input.dispatchKeyEvent", {
                type: "keyDown",
                key,
                code: key,
                windowsVirtualKeyCode: virtualKey,
                nativeVirtualKeyCode: virtualKey,
              });
              await call("Input.dispatchKeyEvent", {
                type: "keyUp",
                key,
                code: key,
                windowsVirtualKeyCode: virtualKey,
                nativeVirtualKeyCode: virtualKey,
              });
              return evaluate("__webvowlMeasurement.interaction()");
            },
            cohort,
            warmup,
          );
          assert.equal(
            revision.state.nodeCountStatus.shownNodeCount,
            requestedCount,
            "Controlled slider intent must publish the requested node count",
          );
          assert.equal(
            revision.inputValue,
            requestedCount,
            "Native slider must display its accepted count",
          );
        }
        await evaluate("__webvowlMeasurement.closeSlider()");
        await evaluate(
          `__webvowlMeasurement.view({nodesShown:{mode:${JSON.stringify(allNodes ? "all" : "auto")}},filters:{datatypes:'show'}})`,
        );
        await evaluate("__webvowlMeasurement.center()");
        const point = await evaluate("__webvowlMeasurement.armClick()");
        const click = await measure(
          "B4-click",
          async () => {
            await call("Input.dispatchMouseEvent", {
              type: "mouseMoved",
              ...point,
            });
            await call("Input.dispatchMouseEvent", {
              type: "mousePressed",
              ...point,
              button: "left",
              buttons: 1,
              clickCount: 1,
            });
            await call("Input.dispatchMouseEvent", {
              type: "mouseReleased",
              ...point,
              button: "left",
              buttons: 0,
              clickCount: 1,
            });
            return evaluate("__webvowlMeasurement.interaction()");
          },
          cohort,
          warmup,
        );
        assert(
          click.state.selectedDocumentRecord,
          "Click must select a real document record",
        );
        assert(
          click.detailsText > 0 && click.state.selection.length > 0,
          "Click must populate ontology details",
        );
        await evaluate("__webvowlMeasurement.clearSearch()");
        await evaluate("__webvowlMeasurement.armSearch()");
        const search = await measure(
          "B5-search",
          async () => {
            await call("Input.insertText", {
              text: fixtureName.startsWith("W4") ? "C1" : "a",
            });
            return evaluate("__webvowlMeasurement.interaction()");
          },
          cohort,
          warmup,
        );
        assert(search.results > 0, "Search must render the actual result list");
        await evaluate("__webvowlMeasurement.clearSearch()");
        const editTarget = await evaluate(
          "__webvowlMeasurement.prepareEdits()",
        );
        report.editTargets ??= [];
        report.editTargets.push({ cohort, warmup, ...editTarget });
        for (let edit = 0; edit < 10; edit++) {
          const edited = await measure(
            `B6-edit-${edit}`,
            `__webvowlMeasurement.edit(${edit})`,
            cohort,
            warmup,
          );
          assert.equal(
            edited.state.documentRevision,
            edit + 1,
            "Label edit must accept a successor revision",
          );
          const editor = await evaluate("__webvowlMeasurement.editor()");
          assert.equal(
            editor.selectedRecord.label.en,
            `S0 label ${String(edit).padStart(2, "0")}`,
            "Accepted editor state must contain the requested label",
          );
        }
        const checkpoint = completedProductionCohort(
          report.samples.slice(startSample),
          { index, label: cohort, warmup, startSample },
        );
        report.completedCohorts.push(checkpoint);
        appendRecord("cohorts.jsonl", checkpoint);
        delete report.activeCohort;
        delete report.activeOperation;
        console.log(
          JSON.stringify({ cohortCompleted: index, label: cohort, warmup }),
        );
      }
    }
    const groups = new Map();
    for (const row of report.samples.filter(
      (row) => !functional && !row.warmup,
    )) {
      const key = `${row.cohort}:${row.name}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row.durationMs);
    }
    report.summaries = Object.fromEntries(
      [...groups].map(([key, values]) => [key, summarizeSamples(values)]),
    );
  }
  report.quiescentProtocolSatisfied =
    requireForeground &&
    !report.rejectedPreflights.some((item) => item.ownerOverride);
  if (!report.quiescentProtocolSatisfied) report.acceptanceEligible = false;
  if (cohortStart !== 1 || cohortEnd !== 40) report.acceptanceEligible = false;
  report.status = "completed";
} catch (error) {
  if (session && socket?.readyState === WebSocket.OPEN) {
    try {
      report.failurePage = await evaluate(
        "({state:globalThis.__webvowlMeasuredApplication?.getWebVowlController()?.getState(),body:document.body.innerText.slice(0,3000),url:location.href,visibility:document.visibilityState,focus:document.hasFocus()})",
      );
    } catch {
      /* Preserve the originating error if the page is gone. */
    }
  }
  report.status = "failed";
  report.error = { message: error.message, stack: error.stack };
  process.exitCode = 1;
} finally {
  if (socket?.readyState === WebSocket.OPEN) {
    try {
      await call("Browser.close", {}, null);
    } catch (error) {
      report.closeError = error.message;
    }
    socket.close();
  }
  for (const item of pending.values()) {
    clearTimeout(item.timer);
    item.fail(new Error("Browser closed"));
  }
  if (browserEnded) {
    const ended = await withDeadline(
      browserEnded,
      10000,
      "Owned Chrome exit deadline",
    ).catch(() => null);
    if (ended) report.browserExit = ended;
    else {
      report.browserExit = { quiescent: browserClosed, ownedPid: browser.pid };
      process.exitCode = 1;
    }
  }
  if (server) {
    server.closeAllConnections();
    await new Promise((done) => server.close(done));
  }
  report.completedAt = new Date().toISOString();
  writeJson("result.json", report);
  console.log(
    JSON.stringify({
      status: report.status,
      output,
      error: report.error?.message,
    }),
  );
}
