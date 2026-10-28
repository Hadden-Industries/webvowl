import { WebVowlOperationError } from "./webVowlControllerContracts.js";

// ARCH-DEC-010: application lifetime/observation is deliberately outside document admission.
export const CONTROLLER_OPERATION_CLASSES = Object.freeze({
  loadOntology: "load",
  editOntologyRecord: "edit",
  editOntologyMetadata: "edit",
  setOntologyPrefix: "edit",
  removeOntologyPrefix: "edit",
  revealOntologyElements: "view",
  setVisualizationView: "view",
  setVisualizationModes: "view",
  setForceLayoutDistances: "view",
  resetVisualization: "view",
  setGraphLayoutPaused: "view",
  flushNodeCountAdjustment: "view",
  stageNodeCountAdjustment: "transient-view",
  revealOntologyNeighborhood: "transient-view",
  clearOntologyNeighborhood: "transient-view",
  setVisualizationArrangement: "transient-view",
  selectVisualizationElement: "transient-view",
  setContinuousZoom: "transient-view",
  exportVisualization: "capture",
  exportOriginalSource: "capture",
  getOntologyEditorView: "read",
  resolveOntologyEditorIri: "read",
  getOntologySummary: "read",
  getOntologyElementRevealPlan: "read",
  getOntologyNeighborhoodRevealPlan: "read",
  findOntologyElements: "read",
  describeOntologyElements: "read",
  getOntologyFacts: "read",
  getVisualizationShareLink: "read",
  getVisualizationArrangement: "read",
  getSelectedVisualizationOccurrence: "read",
  getOriginalSources: "read",
  refreshOntologySource: "read",
  applyOntologySourceUpdate: "read",
});

export const CONTROLLER_APPLICATION_MEMBERS = Object.freeze({
  getState: "observation",
  getOntologyEditorOptions: "observation",
  getVisualizationFocus: "observation",
  subscribeToState: "subscription",
  subscribeToSelectedVisualizationOccurrence: "subscription",
  resizeVisualizationViewport: "viewport",
  setRenderingDiagnosticsEnabled: "diagnostics",
  setOntologyEditorOptions: "preferences",
  setNodeCountAdjustmentVisible: "presentation-lifetime",
  dispose: "lifetime",
});

const policies = {
  load: {
    pendingLoad: null,
    supersedes: ["load", "edit", "view", "transient-view", "capture"],
    temporaryPresentation: "retire",
    currency: "load",
    transfer: "validated-source",
  },
  edit: {
    pendingLoad: "EDIT_REJECTED",
    supersedes: ["capture"],
    temporaryPresentation: "retire",
    currency: "generation",
    transfer: "validated-intent",
  },
  view: {
    pendingLoad: "LOAD_PENDING",
    supersedes: ["view", "transient-view", "capture"],
    temporaryPresentation: "retire",
    currency: "revision",
    transfer: "accepted-scene",
  },
  "transient-view": {
    pendingLoad: "LOAD_PENDING",
    supersedes: ["view", "transient-view", "capture"],
    temporaryPresentation: "explicit-transient-operation",
    currency: "revision",
    transfer: "accepted-scene",
  },
  capture: {
    pendingLoad: "LOAD_PENDING",
    supersedes: [],
    temporaryPresentation: "retain",
    currency: "revision",
    transfer: "exclusive-capture",
  },
  read: {
    pendingLoad: "LOAD_PENDING",
    supersedes: [],
    temporaryPresentation: "retain",
    currency: "revision",
    transfer: "synchronous-admission",
  },
};
export const CONTROLLER_OPERATION_POLICIES = Object.freeze(
  Object.fromEntries(
    Object.entries(policies).map(([kind, policy]) => [
      kind,
      Object.freeze({
        ...policy,
        supersedes: Object.freeze(policy.supersedes),
      }),
    ]),
  ),
);

// Two named exceptions, with independent behavior tests. Do not add per-call policy flags.
export const CONTROLLER_OPERATION_EXCEPTIONS = Object.freeze({
  setVisualizationView:
    "Focus/camera-only requests can retain a temporary neighborhood.",
  revealOntologyNeighborhood:
    "Reject while an edit is pending; other transient changes reconcile.",
});

/** Owns document operation admission and retirement, not session transactions or scene work. */
export function createControllerOperationLifecycle({
  readIdentity,
  retirePresentation,
}) {
  let disposed = false;
  let epoch = 0;
  const active = new Set();
  const has = (kind) =>
    [...active].some((entry) => entry.kind === kind && !entry.retired);

  function policyFor(operation) {
    const kind = CONTROLLER_OPERATION_CLASSES[operation];
    if (!kind) {
      throw new TypeError(`Not a document operation: ${operation}`);
    }
    return { kind, policy: CONTROLLER_OPERATION_POLICIES[kind] };
  }
  function check(operation) {
    const { kind, policy } = policyFor(operation);
    if (disposed) {
      throw new WebVowlOperationError({
        code: "LOAD_ABORTED",
        message: "The application has been disposed.",
      });
    }
    if (policy.pendingLoad && has("load")) {
      throw new WebVowlOperationError({
        code: policy.pendingLoad,
        message: "Wait for the current document load to finish.",
        isRetryable: policy.pendingLoad === "LOAD_PENDING",
      });
    }
    if (
      kind === "capture" &&
      [...active].some((entry) => entry.kind === "capture")
    ) {
      throw new WebVowlOperationError({
        code: "EXPORT_FAILED",
        message: "An export is already in progress.",
      });
    }
    if (operation === "revealOntologyNeighborhood" && has("edit")) {
      throw new WebVowlOperationError({
        code: "VIEW_REJECTED",
        message: "Wait for the current edit before revealing a neighbourhood.",
      });
    }
    return kind === "load" ? undefined : readIdentity();
  }
  function retire(kinds) {
    for (const entry of active) {
      if (kinds.includes(entry.kind) && !entry.retired) {
        entry.retired = true;
        entry.owner.abort();
      }
    }
  }

  return Object.freeze({
    check,
    has,
    // Error observation has document lifetime, without taking operation ownership.
    checkpoint() {
      const capturedEpoch = epoch;
      return () => !disposed && epoch === capturedEpoch && !has("load");
    },
    prepare(operation, { signal, request } = {}) {
      const identity = check(operation);
      signal?.throwIfAborted();
      const { kind, policy } = policyFor(operation);
      const owner = new AbortController();
      const combined = signal
        ? AbortSignal.any([signal, owner.signal])
        : owner.signal;
      const entry = { kind, owner, retired: false };
      let accepted = false;
      let released = false;
      let capturedEpoch = epoch;
      function isCurrent() {
        if (
          !accepted ||
          released ||
          disposed ||
          entry.retired ||
          capturedEpoch !== epoch
        ) {
          return false;
        }
        if (policy.currency === "load") {
          return true;
        }
        const now = readIdentity();
        return (
          now.loadGeneration === identity.loadGeneration &&
          (policy.currency !== "revision" ||
            now.documentRevision === identity.documentRevision)
        );
      }
      return Object.freeze({
        identity,
        signal: combined,
        isCurrent,
        assertCurrent() {
          if (!isCurrent()) {
            throw new DOMException(
              "The operation was superseded.",
              "AbortError",
            );
          }
          combined.throwIfAborted();
        },
        prepareScene() {
          // Capture must release its session guard before scene preparation; view
          // ownership still transfers only after that scene has been accepted.
          if (policy.supersedes.includes("capture")) {
            retire(["capture"]);
          }
          if (policy.temporaryPresentation !== "retire") {
            return undefined;
          }
          if (
            operation === "setVisualizationView" &&
            request?.filters === undefined &&
            request?.nodesShown === undefined &&
            request?.language === undefined &&
            request?.layout === undefined &&
            request?.focus?.length !== 0
          ) {
            return undefined;
          }
          return retirePresentation();
        },
        accept() {
          if (accepted || released) {
            throw new Error("An operation ticket can be accepted only once.");
          }
          check(operation);
          combined.throwIfAborted();
          retire(policy.supersedes);
          if (kind === "load") {
            epoch += 1;
          }
          capturedEpoch = epoch;
          accepted = true;
          active.add(entry);
        },
        release() {
          released = true;
          active.delete(entry);
        },
      });
    },
    retireViews() {
      retire(["view", "transient-view"]);
    },
    retireCaptures() {
      retire(["capture"]);
    },
    dispose() {
      disposed = true;
      retire(Object.keys(CONTROLLER_OPERATION_POLICIES));
      active.clear();
    },
  });
}
