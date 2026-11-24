const stages = ["source", "reading", "drawing"];
const descriptions = [
  "Retrieving the ontology document",
  "Reading the ontology and following its imports",
  "Preparing the first visible graph",
];

function elapsedTime(milliseconds) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

/** Owns one loading presentation; counts and stages come only from the controller. */
export function createLoadingProgressPresenter({
  documentObject: doc = document,
  onCancel,
  onChooseSource,
  onChooseFile = onChooseSource,
  clock = {
    now: () => performance.now(),
    setInterval: (callback) => setInterval(callback, 1000),
    clearInterval: (timer) => clearInterval(timer),
  },
}) {
  const get = (id) => doc.querySelector(`#${id}`);
  const root = get("loading-info");
  const panel = get("loading-progress");
  const compact = get("loading-compact");
  const title = get("currentLoadingStep");
  const error = get("loadingErrorMessage");
  const action = get("loading-primary-action");
  const hide = get("loadingIndicator_closeButton");
  const show = get("loading-show-progress");
  const details = get("loadingInfo-container");
  const disclosure = get("show-loadingInfo-button");
  const announcement = get("loading-announcement");
  const lifecycle = new AbortController();
  let timer;
  let startedAt;
  let requestId;
  let collapsed = false;
  let visible = false;
  let busy = false;
  let setup = false;
  let cancelling = false;
  let lastStage;
  let failureIdentity;
  let dismissedFailure;
  let inputRecovery;
  // A local file named by the URL cannot be reopened after a reload. Nothing
  // was attempted, so this is a request to choose the file, not a failure.
  let reopenFileName;

  function stopTimer() {
    if (timer !== undefined) {
      clock.clearInterval(timer);
    }
    timer = undefined;
  }
  function tick() {
    const elapsed = `${elapsedTime(clock.now() - startedAt)} elapsed`;
    get("loading-elapsed").textContent = elapsed;
    get("loading-compact-elapsed").textContent = elapsed;
  }
  function focusOutside() {
    if (doc.activeElement && root.contains(doc.activeElement)) {
      get("ontology-menu-open").focus();
    }
  }
  function showPanel() {
    visible = true;
    root.classList.remove("hidden");
    panel.hidden = collapsed;
    compact.hidden = !collapsed;
  }
  function dismiss() {
    focusOutside();
    visible = false;
    root.classList.add("hidden");
  }
  function setDetails(expanded) {
    details.hidden = !expanded;
    disclosure.setAttribute("aria-expanded", String(expanded));
  }
  return Object.freeze({
    setup() {
      if (setup || lifecycle.signal.aborted) {
        return;
      }
      setup = true;
      const listen = (element, listener) =>
        element.addEventListener("click", listener, {
          signal: lifecycle.signal,
        });
      listen(disclosure, () => setDetails(details.hidden));
      listen(hide, () => {
        if (!busy) {
          dismissedFailure = failureIdentity;
          inputRecovery?.dismiss();
          return dismiss();
        }
        collapsed = true;
        showPanel();
        show.focus();
      });
      listen(show, () => {
        collapsed = false;
        showPanel();
        hide.focus();
      });
      listen(action, () => {
        if (!busy) {
          if (reopenFileName !== undefined) {
            return onChooseFile();
          }
          return inputRecovery ? inputRecovery.retry() : onChooseSource();
        }
        cancelling = true;
        action.disabled = true;
        title.textContent = "Cancelling loading…";
        onCancel();
      });
      setDetails(false);
    },
    isVisible: () => visible,
    clearInputRecovery() {
      if (inputRecovery) {
        inputRecovery = undefined;
        action.textContent = "Choose ontology";
      }
    },
    isDetailsExpanded: () => !details.hidden,
    scrollDetails() {
      details.scrollTop = details.scrollHeight;
    },
    begin() {
      if (lifecycle.signal.aborted) {
        return;
      }
      collapsed = false;
      cancelling = false;
      lastStage = undefined;
      dismissedFailure = undefined;
      requestId = undefined;
      startedAt = clock.now();
      tick();
      get("bulletPoint_container").textContent = "";
      setDetails(false);
    },
    render(state, context = {}) {
      if (lifecycle.signal.aborted) {
        return;
      }
      const nextBusy = ["loading", "parsing", "rendering"].includes(
        state.status,
      );
      const progress = state.loadProgress;
      if (
        nextBusy &&
        (!busy || (progress && progress.requestId !== requestId))
      ) {
        this.begin();
        requestId = progress?.requestId;
      }
      busy = nextBusy;
      inputRecovery =
        state.status === "error" ? context.inputRecovery : undefined;
      reopenFileName =
        state.status === "error" ? context.localFileName : undefined;
      panel.dataset.mode = reopenFileName === undefined ? "progress" : "reopen";
      error.textContent = state.error?.message ?? "";
      error.hidden = !error.textContent;
      if (!busy && (state.status !== "error" || cancelling)) {
        stopTimer();
        if (visible) {
          announcement.textContent = cancelling
            ? "Loading cancelled."
            : "The ontology is ready.";
        }
        dismiss();
        cancelling = false;
        return;
      }
      failureIdentity = [
        progress?.requestId,
        context.sourceLabel ?? progress?.sourceLabel,
        state.error?.code,
        error.textContent,
      ];
      if (
        !busy &&
        dismissedFailure?.every(
          (value, index) => value === failureIdentity[index],
        )
      ) {
        stopTimer();
        return;
      }
      showPanel();
      action.disabled = cancelling;
      const reopening = reopenFileName !== undefined;
      const failureTitle = reopening
        ? `Reopen “${reopenFileName}”`
        : "Loading failed";
      action.textContent = busy
        ? "Cancel loading"
        : reopening
          ? "Choose file…"
          : (inputRecovery?.label ?? "Choose ontology");
      hide.textContent = busy
        ? "Hide progress"
        : reopening
          ? "Not now"
          : "Close";
      title.className = busy
        ? "step-busy"
        : reopening
          ? "step-reopen"
          : "step-error";
      title.textContent = busy ? "Opening ontology" : failureTitle;
      get("loading-source-label").textContent =
        context.sourceLabel ?? progress?.sourceLabel ?? "Ontology source";
      get("loading-source-detail").textContent =
        context.sourceLabel ??
        progress?.sourceLabel ??
        "No source is available";
      const active = Math.max(0, stages.indexOf(progress?.stage ?? "source"));
      const count = progress?.receivedDocumentCount ?? 0;
      const bytes = progress?.receivedByteCount ?? 0;
      const received = count
        ? `${count.toLocaleString()} source ${count === 1 ? "document" : "documents"} received · ${(bytes / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })} KB`
        : "Waiting for the source document";
      const activity =
        progress?.stage === "drawing" && progress.drawingNodeCount !== undefined
          ? `Drawing ${progress.drawingNodeCount.toLocaleString()} nodes and ${progress.drawingRelationshipCount.toLocaleString()} connections`
          : descriptions[active];
      for (const [index, name] of stages.entries()) {
        const step = get(`loading-stage-${name}`);
        step.dataset.state =
          !busy && index === active
            ? "failed"
            : index < active
              ? "complete"
              : index === active
                ? "active"
                : "waiting";
        if (index === active) {
          step.setAttribute("aria-current", "step");
        } else {
          step.removeAttribute("aria-current");
        }
        get(`loading-stage-${name}-marker`).textContent =
          index < active ? "✓" : String(index + 1);
        get(`loading-stage-${name}-description`).textContent =
          index < active
            ? index === 0
              ? "Ontology source received"
              : received
            : index === active
              ? name === "reading"
                ? received
                : activity
              : "Waiting for the previous step";
        get(`loading-stage-${name}-progress`).hidden =
          !busy || index !== active;
      }
      // Each stage has its own native indeterminate bar. No known total exists
      // for parsing/import discovery or first paint, so none receives a value.
      get("loading-current-activity").textContent = activity;
      get("loading-current-document").textContent =
        progress?.currentDocumentIri ?? "No import is being retrieved";
      get("loading-received").textContent = received;
      get("loading-estimate").textContent = busy
        ? "Time remaining is not yet known"
        : "Choose another source or try loading it again";
      get("loading-compact-title").textContent = busy ? activity : failureTitle;
      show.textContent = busy ? "Show progress" : "View error";
      const announcementKey = busy
        ? active
        : `error:${failureTitle}:${error.textContent}`;
      if (lastStage !== announcementKey) {
        announcement.textContent = busy
          ? descriptions[active]
          : `${failureTitle}. ${error.textContent}`;
        lastStage = announcementKey;
      }
      if (busy) {
        tick();
        if (timer === undefined) {
          timer = clock.setInterval(tick);
        }
      } else {
        stopTimer();
      }
    },
    dispose() {
      lifecycle.abort();
      stopTimer();
    },
  });
}
