import { readNodesShownOption } from "../controller/nodesShownContracts.js";

/** Native range exploration with an independent, commit-on-Enter exact draft. */
export function createNodesShownControl({
  documentObject = globalThis.document,
  onChange,
  requestFrame = globalThis.requestAnimationFrame?.bind(globalThis),
  cancelFrame = globalThis.cancelAnimationFrame?.bind(globalThis),
} = {}) {
  const lifecycle = new AbortController();
  let controls;
  let status = { eligibleNodeCount: 0, shownNodeCount: 0 };
  let draft = false;
  let frame;
  let pendingIntent;
  let requestRevision = 0;
  let announcement;
  let settledStatus = "";
  const pendingTimers = new Set();
  function restore() {
    draft = false;
    controls.exact.value = String(status.shownNodeCount);
    controls.exact.removeAttribute("aria-invalid");
    controls.error.textContent = "";
  }
  function submit(intent, coalesce = false) {
    pendingIntent = intent;
    if (coalesce && requestFrame) {
      if (frame === undefined) {
        frame = requestFrame(() => {
          frame = undefined;
          submit(pendingIntent);
        });
      }
      return;
    }
    if (frame !== undefined) {
      cancelFrame?.(frame);
      frame = undefined;
    }
    const revision = ++requestRevision;
    const timer = setTimeout(() => {
      if (!lifecycle.signal.aborted && revision === requestRevision) {
        controls.status.textContent = "Updating graph…";
      }
    }, 200);
    pendingTimers.add(timer);
    Promise.resolve()
      .then(() => {
        if (!lifecycle.signal.aborted && revision === requestRevision) {
          return onChange(intent);
        }
      })
      .catch((error) => {
        if (
          !lifecycle.signal.aborted &&
          revision === requestRevision &&
          error?.name !== "AbortError"
        ) {
          restore();
          controls.error.textContent =
            "The node count could not be updated. Try again.";
        }
      })
      .finally(() => {
        clearTimeout(timer);
        pendingTimers.delete(timer);
        if (!lifecycle.signal.aborted && revision === requestRevision) {
          clearTimeout(announcement);
          controls.status.textContent = settledStatus;
        }
      });
  }
  function commitDraft() {
    if (!draft) {
      return;
    }
    try {
      const intent = readNodesShownOption(controls.exact.value);
      if (
        intent.mode !== "exact" ||
        intent.requestedCount > status.eligibleNodeCount
      ) {
        throw new RangeError();
      }
      draft = false;
      controls.exact.removeAttribute("aria-invalid");
      controls.error.textContent = "";
      submit(intent);
    } catch {
      controls.exact.setAttribute("aria-invalid", "true");
      controls.error.textContent = `Enter a whole number from 0 to ${status.eligibleNodeCount}.`;
    }
  }
  return Object.freeze({
    setup() {
      if (controls || lifecycle.signal.aborted) {
        return;
      }
      controls = Object.fromEntries(
        [
          "range",
          "exact",
          "minus",
          "plus",
          "all",
          "auto",
          "status",
          "error",
        ].map((name) => [
          name,
          documentObject.getElementById(`nodesShown-${name}`),
        ]),
      );
      if (Object.values(controls).some((control) => !control)) {
        throw new TypeError("Nodes shown requires its complete control group.");
      }
      const listen = (name, event, handler) =>
        controls[name].addEventListener(event, handler, {
          signal: lifecycle.signal,
        });
      listen("range", "input", () => {
        restore();
        controls.exact.value = controls.range.value;
        submit(
          { mode: "exact", requestedCount: Number(controls.range.value) },
          true,
        );
      });
      listen("range", "change", () =>
        submit({ mode: "exact", requestedCount: Number(controls.range.value) }),
      );
      listen("exact", "input", () => {
        draft = true;
      });
      listen("exact", "blur", commitDraft);
      listen("exact", "keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          commitDraft();
        }
        if (event.key === "Escape") {
          event.preventDefault();
          restore();
        }
      });
      listen("minus", "click", () => {
        restore();
        submit({
          mode: "exact",
          requestedCount: Math.max(0, status.shownNodeCount - 1),
        });
      });
      listen("plus", "click", () => {
        restore();
        submit({
          mode: "exact",
          requestedCount: Math.min(
            status.eligibleNodeCount,
            status.shownNodeCount + 1,
          ),
        });
      });
      for (const mode of ["all", "auto"]) {
        listen(mode, "click", () => {
          restore();
          submit({ mode });
        });
      }
    },
    renderNodeCountStatus(next, intent) {
      if (!controls || lifecycle.signal.aborted) {
        return;
      }
      if (!next) {
        clearTimeout(announcement);
        for (const timer of pendingTimers) {
          clearTimeout(timer);
        }
        pendingTimers.clear();
        draft = false;
        requestRevision += 1;
        if (frame !== undefined) {
          cancelFrame?.(frame);
        }
        frame = undefined;
        for (const name of ["range", "exact", "minus", "plus", "all", "auto"]) {
          controls[name].disabled = true;
        }
        controls.status.textContent = "Load an ontology to choose nodes shown.";
        return;
      }
      status = next;
      controls.range.max = String(status.eligibleNodeCount);
      controls.range.value = String(status.shownNodeCount);
      if (!draft) {
        controls.exact.value = controls.range.value;
      }
      controls.minus.disabled = status.shownNodeCount === 0;
      controls.plus.disabled =
        status.shownNodeCount === status.eligibleNodeCount;
      controls.range.disabled = status.eligibleNodeCount === 0;
      controls.exact.disabled = false;
      controls.all.disabled = false;
      controls.auto.disabled = false;
      const shortfall =
        intent.mode === "exact" &&
        intent.requestedCount > status.eligibleNodeCount
          ? ` Target ${intent.requestedCount} will return when more nodes become available.`
          : "";
      const text =
        status.eligibleNodeCount === 0
          ? "No nodes are available with the current filters."
          : `Showing ${status.shownNodeCount} of ${status.eligibleNodeCount} available nodes.${shortfall}`;
      settledStatus = text;
      controls.range.setAttribute("aria-valuetext", text);
      clearTimeout(announcement);
      announcement = setTimeout(() => {
        if (!lifecycle.signal.aborted) {
          controls.status.textContent = text;
        }
      }, 100);
    },
    dispose() {
      lifecycle.abort();
      for (const timer of pendingTimers) {
        clearTimeout(timer);
      }
      pendingTimers.clear();
      clearTimeout(announcement);
      if (frame !== undefined) {
        cancelFrame?.(frame);
      }
    },
  });
}
