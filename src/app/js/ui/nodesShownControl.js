import { createNodesShownIntent } from "../controller/nodesShownContracts.js";
import { runVisualizationControlAction } from "./visualizationControlAction.js";

/** Native range exploration with an exact draft committed on Enter or blur. */
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
  function restore() {
    draft = false;
    controls.exact.value = String(status.shownNodeCount);
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
    Promise.resolve().then(() => {
      if (!lifecycle.signal.aborted && revision === requestRevision) {
        return runVisualizationControlAction(async () => {
          try {
            await onChange(intent);
          } catch (error) {
            if (
              lifecycle.signal.aborted ||
              revision !== requestRevision ||
              error?.name === "AbortError" ||
              error?.code === "LOAD_ABORTED"
            ) {
              return;
            }
            restore();
            throw error;
          }
        }, documentObject);
      }
    });
  }
  function commitDraft() {
    if (!draft) {
      return;
    }
    const requestedCount = controls.exact.valueAsNumber;
    if (!Number.isFinite(requestedCount)) {
      restore();
      return;
    }
    const intent = createNodesShownIntent({
      mode: "exact",
      requestedCount: Math.max(
        0,
        Math.min(Math.round(requestedCount), status.eligibleNodeCount),
      ),
    });
    draft = false;
    controls.exact.value = String(intent.requestedCount);
    submit(intent);
  }
  function rangeIntent() {
    const requestedCount = Number(controls.range.value);
    return requestedCount === status.eligibleNodeCount
      ? { mode: "all" }
      : { mode: "exact", requestedCount };
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
          "fifty",
          "markers",
          "total-value",
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
        submit(rangeIntent(), true);
      });
      listen("range", "change", () => submit(rangeIntent()));
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
      listen("fifty", "click", () => {
        if (status.eligibleNodeCount > 50) {
          restore();
          submit({ mode: "exact", requestedCount: 50 });
        }
      });
    },
    renderNodeCountStatus(next, intent) {
      if (!controls || lifecycle.signal.aborted) {
        return;
      }
      if (!next) {
        draft = false;
        requestRevision += 1;
        if (frame !== undefined) {
          cancelFrame?.(frame);
        }
        frame = undefined;
        for (const name of ["range", "exact", "minus", "plus", "fifty"]) {
          controls[name].disabled = true;
        }
        status = { eligibleNodeCount: 0, shownNodeCount: 0 };
        controls.range.max = "0";
        controls.range.value = "0";
        controls.range.removeAttribute("aria-valuetext");
        controls.exact.max = "0";
        controls["total-value"].textContent = "0";
        controls.fifty.hidden = true;
        restore();
        return;
      }
      status = next;
      controls.range.max = String(status.eligibleNodeCount);
      controls.exact.max = controls.range.max;
      controls["total-value"].textContent = controls.range.max;
      controls.range.value = String(status.shownNodeCount);
      if (!draft) {
        controls.exact.value = controls.range.value;
      }
      controls.minus.disabled = status.shownNodeCount === 0;
      controls.plus.disabled =
        status.shownNodeCount === status.eligibleNodeCount;
      controls.range.disabled = status.eligibleNodeCount === 0;
      controls.exact.disabled = false;
      controls.fifty.hidden = status.eligibleNodeCount <= 50;
      controls.fifty.disabled = controls.fifty.hidden;
      if (!controls.fifty.hidden) {
        controls.markers.style.setProperty(
          "--nodes-shown-fifty-position",
          `${(50 / status.eligibleNodeCount) * 100}%`,
        );
      }
      const shortfall =
        intent.mode === "exact" &&
        intent.requestedCount > status.eligibleNodeCount
          ? ` Target ${intent.requestedCount} will return when more nodes become available.`
          : "";
      const text =
        status.eligibleNodeCount === 0
          ? "No nodes are available with the current filters."
          : `${intent.mode === "auto" && status.shownNodeCount < status.eligibleNodeCount ? "Automatically showing" : "Showing"} ${status.shownNodeCount} of ${status.eligibleNodeCount} available nodes.${shortfall}`;
      controls.range.setAttribute("aria-valuetext", text);
    },
    dispose() {
      lifecycle.abort();
      if (frame !== undefined) {
        cancelFrame?.(frame);
      }
    },
  });
}
