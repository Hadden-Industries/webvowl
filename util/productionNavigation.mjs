import assert from "node:assert/strict";
import {
  buildCohortOrder,
  observeTwoAnimationFrames,
  summarizeSamples,
  validateBoundary,
} from "./productionPerformance.mjs";

// Installed before navigation in a separate run, without Debugger or native API
// wrappers. DOM observation plus two frames is an explicit paint opportunity
// proxy; it does not claim to observe compositor presentation.
export function installNavigationObservation(twoFrames) {
  const { document, MutationObserver } = globalThis;
  let foregroundLost = false;
  let observed = false;
  const checkForeground = () => {
    if (document.visibilityState !== "visible" || !document.hasFocus())
      foregroundLost = true;
  };
  document.addEventListener("visibilitychange", checkForeground);
  globalThis.addEventListener("blur", checkForeground);
  const observer = new MutationObserver(async () => {
    if (observed || !document.querySelector("#graph .node")) return;
    observed = true;
    observer.disconnect();
    const completed = performance.now();
    const frames = await twoFrames();
    document.removeEventListener("visibilitychange", checkForeground);
    globalThis.removeEventListener("blur", checkForeground);
    globalThis.__webvowlNavigationObservation = {
      start: 0,
      completed,
      ...frames,
      foregroundLost:
        foregroundLost ||
        document.visibilityState !== "visible" ||
        !document.hasFocus(),
      nodes: document.querySelectorAll("#graph .node").length,
      nativeWrapperCount: 0,
    };
  });
  observer.observe(document, { subtree: true, childList: true });
}

export async function measureProductionNavigation({
  call,
  evaluate,
  waitFor,
  idle,
  origin,
  diagnostic,
  report,
  onSample,
}) {
  report.boundary = "first graph DOM plus two observed frames";
  report.cacheProtocol =
    "Cold HTTP cache (cleared before each cold navigation) and immediate warm-cache navigation in the same isolated Chrome process; this is not a cold OS/process launch.";
  await call("Network.enable");
  await call("Network.setCacheDisabled", { cacheDisabled: false });
  await call("Page.addScriptToEvaluateOnNewDocument", {
    source: `(${installNavigationObservation.toString()})(${observeTwoAnimationFrames.toString()})`,
  });
  const order = diagnostic ? ["A"] : buildCohortOrder(20);
  for (const [index, cohort] of ["warmup", ...order].entries()) {
    for (const cache of ["cold", "warm"]) {
      await call("Page.navigate", { url: "about:blank" });
      await waitFor(
        () => evaluate("location.href === 'about:blank'"),
        "blank navigation between samples",
      );
      await idle(`${cohort}:B1-${cache}`);
      if (cache === "cold") await call("Network.clearBrowserCache");
      await call("Page.navigate", { url: origin });
      const sample = await waitFor(
        () => evaluate("globalThis.__webvowlNavigationObservation"),
        "first ontology graph paint opportunity",
      );
      assert(!sample.foregroundLost, "Navigation lost foreground");
      assert(sample.nodes > 0, "Navigation must display ontology nodes");
      assert.equal(sample.nativeWrapperCount, 0);
      await waitFor(
        () =>
          evaluate(
            "document.querySelector('#graph .node') && document.querySelector('#loading-info')?.classList.contains('hidden') && document.querySelector('#c_filter > button')?.disabled === false",
          ),
        "production ready controls after navigation",
      );
      const details = await evaluate(`(async () => {
        await document.fonts.ready;
        return {
          navigation: performance.getEntriesByType('navigation')[0]?.toJSON(),
          resources: performance.getEntriesByType('resource').map(entry => entry.toJSON()),
          fonts: [...document.fonts].map(font => ({family:font.family,weight:font.weight,style:font.style,status:font.status})),
          visibility: document.visibilityState,
          focus: document.hasFocus()
        };
      })()`);
      assert.equal(details.visibility, "visible");
      assert(details.focus);
      assert(details.navigation?.loadEventEnd > 0);
      const row = {
        ...sample,
        ...details,
        name: `B1-${cache}`,
        cohort,
        warmup: index === 0,
        durationMs: validateBoundary({
          ...sample,
          mode: "latency",
          instrumentation: false,
        }),
        loadEventToGraphPaintMs:
          sample.frame2 - details.navigation.loadEventEnd,
      };
      report.samples.push(row);
      onSample(row);
    }
  }
  const groups = new Map();
  for (const row of report.samples.filter((row) => !row.warmup)) {
    const key = `${row.cohort}:${row.name}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row.durationMs);
  }
  report.summaries = Object.fromEntries(
    [...groups].map(([key, values]) => [key, summarizeSamples(values)]),
  );
}
