// Serial public-source observations through the actual production chooser.
// Latest aliases are mutable: these timings are observations, not comparisons.
export async function measureProductionUiSources({ evaluate, idle, report }) {
  report.uiSources = [];
  for (const id of ["H1", "H2", "H3", "H4"]) {
    await idle(id);
    const result = await evaluate(
      `(${observeSource.toString()})(${JSON.stringify(id)})`,
    );
    report.uiSources.push({ id, ...result });
    process.stdout.write(JSON.stringify({ id, ...result }) + "\n");
    assert(result.terminal && result.status === "ready", `${id} must load`);
    assert.equal(result.source.identity, result.url, `${id} source identity`);
    assert.equal(result.error, null, `${id} must not finish with an error`);
    assert.equal(result.foregroundLost, false, `${id} must remain foreground`);
    assert(result.settled, `${id} must settle within the observation window`);
  }
}

async function observeSource(id) {
  const { document, performance } = globalThis;
  const c = globalThis.__webvowlMeasuredApplication.getWebVowlController();
  const generation = c.getState().loadGeneration;
  document.querySelector("#c_select > button").click();
  document.getElementById("ontology-source-clear").click();
  document.getElementById("ontology-suggestion-" + id).click();
  const url = document.getElementById("iri-converter-input").value;
  if (c.getState().loadGeneration !== generation)
    throw new Error("Suggestion commitment unexpectedly loaded");
  let unsubscribe;
  let timeout;
  const start = performance.now();
  let foregroundLost =
    document.visibilityState !== "visible" || !document.hasFocus();
  const visibility = () => {
    foregroundLost ||=
      document.visibilityState !== "visible" || !document.hasFocus();
  };
  document.addEventListener("visibilitychange", visibility);
  globalThis.addEventListener("blur", visibility);
  try {
    const ready = new Promise((done) => {
      unsubscribe = c.subscribeToState((state) => {
        if (
          state.loadGeneration > generation &&
          ["ready", "relaxing", "error"].includes(state.status)
        ) {
          done({ state, terminal: true });
        }
      });
      timeout = globalThis.setTimeout(
        () => done({ state: c.getState(), terminal: false }),
        120000,
      );
    });
    document.getElementById("iri-converter-button").click();
    const result = await ready;
    const readyMs = performance.now() - start;
    let settled = ["settled", "paused"].includes(result.state.layout.status);
    const deadline = performance.now() + 15000;
    while (
      result.terminal &&
      result.state.status !== "error" &&
      !settled &&
      performance.now() < deadline
    ) {
      await new Promise((done) => globalThis.setTimeout(done, 100));
      visibility();
      settled = ["settled", "paused"].includes(c.getState().layout.status);
    }
    const state = c.getState();
    return {
      url,
      readyMs,
      observedMs: performance.now() - start,
      terminal: result.terminal,
      status: state.status,
      source: state.source,
      nodeCount: state.nodeCountStatus,
      layout: state.layout,
      settled,
      foregroundLost,
      error: state.error,
      warnings: state.warnings,
      title: document.getElementById("ontology-title-chip").textContent,
      limitation:
        "Mutable public alias and network path; no immutable-source or repeated-cohort performance claim.",
    };
  } finally {
    unsubscribe?.();
    globalThis.clearTimeout(timeout);
    document.removeEventListener("visibilitychange", visibility);
    globalThis.removeEventListener("blur", visibility);
  }
}
import assert from "node:assert/strict";
