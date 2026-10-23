import { createNodesShownIntent } from "../controller/nodesShownContracts.js";
import { runVisualizationControlAction } from "./visualizationControlAction.js";

/** Presents requested and accepted counts; the controller owns timed application. */
export function createNodesShownControl({
  documentObject = globalThis.document,
  onChange,
  onAdjust,
  onFlush,
  onVisibility,
} = {}) {
  const lifecycle = new AbortController();
  let controls;
  let status = { eligibleNodeCount: 0, shownNodeCount: 0 };
  let draft = false;
  let requestedIntent;
  let requestRevision = 0;
  function restore() {
    draft = false;
    controls.exact.value = String(requestedCount());
  }
  function requestedCount() {
    return requestedIntent?.mode === "all"
      ? status.eligibleNodeCount
      : requestedIntent?.mode === "exact"
        ? Math.min(requestedIntent.requestedCount, status.eligibleNodeCount)
        : status.shownNodeCount;
  }
  function renderTotal(count) {
    controls["total-value"].textContent = String(count);
    controls["total-value"].setAttribute(
      "aria-label",
      `Show all ${count} available nodes`,
    );
    controls["total-description"].textContent = `Available nodes: ${count}.`;
  }
  function submit(intent, coalesce = false) {
    if (["preparing", "failed"].includes(status.orderingStatus)) {
      return;
    }
    requestedIntent = intent;
    const revision = ++requestRevision;
    Promise.resolve().then(() => {
      if (!lifecycle.signal.aborted && revision === requestRevision) {
        return runVisualizationControlAction(async () => {
          try {
            await (coalesce ? onAdjust(intent) : onChange(intent));
          } catch (error) {
            if (
              lifecycle.signal.aborted ||
              revision !== requestRevision ||
              error?.name === "AbortError" ||
              error?.code === "LOAD_ABORTED"
            ) {
              return;
            }
            requestedIntent = undefined;
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
          "total-description",
          "status",
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
      listen("range", "change", () => submit(rangeIntent(), true));
      documentObject.getElementById("m_filter").addEventListener(
        "toggle",
        (event) => {
          if (event.newState === "closed") {
            // Event handlers schedule draft submission as a microtask. Flush after
            // it, including an exact field's blur during native light dismissal.
            void Promise.resolve().then(() => {
              if (!lifecycle.signal.aborted) {
                return runVisualizationControlAction(onFlush, documentObject);
              }
            });
          }
        },
        { signal: lifecycle.signal },
      );
      documentObject.addEventListener(
        "visibilitychange",
        () => {
          onVisibility(documentObject.visibilityState !== "hidden");
        },
        { signal: lifecycle.signal },
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
        submit(
          {
            mode: "exact",
            requestedCount: Math.max(0, requestedCount() - 1),
          },
          true,
        );
        restore();
      });
      listen("plus", "click", () => {
        restore();
        submit(
          {
            mode: "exact",
            requestedCount: Math.min(
              status.eligibleNodeCount,
              requestedCount() + 1,
            ),
          },
          true,
        );
        restore();
      });
      listen("fifty", "click", () => {
        if (status.eligibleNodeCount > 50 && requestedCount() !== 50) {
          restore();
          submit({ mode: "exact", requestedCount: 50 });
        }
      });
      listen("total-value", "click", () => {
        if (
          status.eligibleNodeCount > 0 &&
          requestedCount() !== status.eligibleNodeCount
        ) {
          restore();
          submit({ mode: "all" });
        }
      });
    },
    renderNodeCountStatus(next, intent, adjustment = null) {
      if (!controls || lifecycle.signal.aborted) {
        return;
      }
      if (!next) {
        draft = false;
        requestRevision += 1;
        requestedIntent = undefined;
        for (const name of [
          "range",
          "exact",
          "minus",
          "plus",
          "fifty",
          "total-value",
        ]) {
          controls[name].disabled = true;
        }
        status = { eligibleNodeCount: 0, shownNodeCount: 0 };
        controls.range.max = "0";
        controls.range.value = "0";
        controls.range.removeAttribute("aria-valuetext");
        controls.exact.max = "0";
        renderTotal(0);
        controls.fifty.hidden = true;
        controls.status.hidden = true;
        restore();
        return;
      }
      status = next;
      const orderingUnavailable = ["preparing", "failed"].includes(
        status.orderingStatus,
      );
      if (orderingUnavailable) {
        draft = false;
        requestRevision += 1;
      }
      requestedIntent = adjustment?.requestedNodesShown;
      controls.range.max = String(status.eligibleNodeCount);
      controls.exact.max = controls.range.max;
      renderTotal(status.eligibleNodeCount);
      controls["total-value"].disabled =
        status.eligibleNodeCount === 0 ||
        requestedCount() === status.eligibleNodeCount;
      controls.range.value = String(requestedCount());
      if (!draft) {
        controls.exact.value = controls.range.value;
      }
      controls.minus.disabled = requestedCount() === 0;
      controls.plus.disabled = requestedCount() === status.eligibleNodeCount;
      controls.range.disabled = status.eligibleNodeCount === 0;
      controls.exact.disabled = false;
      controls.fifty.hidden = status.eligibleNodeCount <= 50;
      controls.fifty.disabled =
        controls.fifty.hidden || requestedCount() === 50;
      if (orderingUnavailable) {
        for (const name of [
          "range",
          "exact",
          "minus",
          "plus",
          "fifty",
          "total-value",
        ]) {
          controls[name].disabled = true;
        }
      }
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
      controls.status.hidden = adjustment === null && !orderingUnavailable;
      if (orderingUnavailable) {
        const message =
          status.orderingStatus === "preparing"
            ? "Preparing node count controls…"
            : "Node count controls are unavailable. Reload the ontology to retry.";
        if (controls.status.textContent !== message) {
          controls.status.textContent = message;
        }
      } else if (adjustment) {
        const message =
          adjustment.status === "applying"
            ? "Applying node count…"
            : "Node count will update when adjustment stops.";
        if (controls.status.textContent !== message) {
          controls.status.textContent = message;
        }
        controls.range.setAttribute(
          "aria-valuetext",
          `Requested ${requestedCount()}; currently showing ${status.shownNodeCount} of ${status.eligibleNodeCount} available nodes.`,
        );
      }
    },
    dispose() {
      lifecycle.abort();
    },
  });
}
