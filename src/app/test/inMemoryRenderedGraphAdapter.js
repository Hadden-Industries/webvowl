import {
  assertRenderedGraphRuntime,
  createAppliedVisualizationView,
  DEFAULT_VISUALIZATION_MODES,
  DEFAULT_VISUALIZATION_FILTERS,
  DEFAULT_FORCE_LAYOUT_DISTANCES,
  createContinuousZoomRequest,
  createForceLayoutDistancesRequest,
  createVisualizationModesRequest,
  createGraphLayoutPauseRequest,
  createGraphLayoutPauseResult,
  createGraphLayoutSnapshot,
  createRenderedGraphEvent,
  createRenderedSvgSnapshot,
  createRenderedSvgSnapshotRequest,
  createVisibleRenderedGraphSnapshot,
  createVisualizationViewApplicationRequest,
  createVisualizationViewApplicationResult,
  createVowlModelReplacementRequest,
  createVowlModelRevisionRequest,
  createVowlModelReplacementResult,
} from "../js/controller/renderedGraphRuntimeContracts.js";

const SVG_NAMESPACE_IRI = "http://www.w3.org/2000/svg";

function createAbortError(message) {
  return new DOMException(message, "AbortError");
}

function assertOperationSignal(options) {
  if (
    options === null ||
    typeof options !== "object" ||
    Array.isArray(options) ||
    Object.keys(options).length !== 1 ||
    !("signal" in options)
  ) {
    throw new TypeError("A runtime operation requires exactly one signal.");
  }
  const { signal } = options;
  if (
    signal === null ||
    typeof signal !== "object" ||
    typeof signal.aborted !== "boolean" ||
    typeof signal.addEventListener !== "function" ||
    typeof signal.removeEventListener !== "function" ||
    typeof signal.throwIfAborted !== "function"
  ) {
    throw new TypeError(
      "signal must implement the native AbortSignal interface.",
    );
  }
  signal.throwIfAborted();
  return signal;
}

function createDetachedSvgRootFixture(loadGeneration) {
  return {
    localName: "svg",
    loadGenerationMarker: loadGeneration,
    namespaceURI: SVG_NAMESPACE_IRI,
    parentNode: null,
    cloneNode(includeDescendants) {
      if (includeDescendants !== true) {
        throw new TypeError("Rendered SVG snapshots require a deep clone.");
      }
      return createDetachedSvgRootFixture(loadGeneration);
    },
  };
}

import {
  createRenderedArrangement,
  createRenderedOccurrenceSelectionRequest,
  resolveRenderedArrangementChanges,
} from "../js/controller/renderedArrangementContracts.js";

function createDefaultVisibleRenderedGraphSnapshot(loadGeneration) {
  return createVisibleRenderedGraphSnapshot({
    loadGeneration,
    visibleElementReferences: [],
    visibleRelationshipReferences: [],
    visibleGraphCounts: {
      visibleNodeCount: 0,
      visiblePropertyCount: 0,
    },
  });
}

function createDefaultGraphLayoutSnapshot(loadGeneration) {
  return createGraphLayoutSnapshot({
    forceAlpha: 1,
    hasEnded: false,
    heightPx: 600,
    isPaused: false,
    layoutElementPositions: [],
    loadGeneration,
    observedAtMs: 0,
    widthPx: 800,
  });
}

function createDefaultRenderedSvgSnapshot(loadGeneration) {
  return createRenderedSvgSnapshot({
    detachedSvgRoot: createDetachedSvgRootFixture(loadGeneration),
    heightPx: 600,
    loadGeneration,
    widthPx: 800,
  });
}

function createDefaultAppliedVisualizationView() {
  return Object.freeze({
    filters: Object.freeze({
      datatypes: "show",
      disjointness: "show",
      minDegree: 0,
      objectProperties: "show",
      setOperators: "show",
      subclasses: "show",
    }),
    focus: Object.freeze([]),
    language: "default",
    modes: DEFAULT_VISUALIZATION_MODES,
    forceDistances: DEFAULT_FORCE_LAYOUT_DISTANCES,
  });
}

function assertSnapshotOverrides(snapshotOverrides) {
  if (
    snapshotOverrides === null ||
    typeof snapshotOverrides !== "object" ||
    Array.isArray(snapshotOverrides)
  ) {
    throw new TypeError("Snapshot overrides must be a plain object.");
  }
  const allowedFieldNames = [
    "visibleRenderedGraphSnapshot",
    "graphLayoutSnapshot",
    "renderedSvgSnapshot",
    "renderedArrangement",
  ];
  const unexpectedFieldName = Object.keys(snapshotOverrides).find(
    (fieldName) => !allowedFieldNames.includes(fieldName),
  );
  if (unexpectedFieldName !== undefined) {
    throw new TypeError(
      `Unsupported snapshot override field: ${unexpectedFieldName}`,
    );
  }
}

function assertActiveGeneration(requestedLoadGeneration, activeLoadGeneration) {
  if (requestedLoadGeneration !== activeLoadGeneration) {
    throw new RangeError(
      `loadGeneration ${requestedLoadGeneration} is not the active rendered generation.`,
    );
  }
}

function createPendingOperation(signal, onAbort) {
  let resolveOperation;
  let rejectOperation;
  const promise = new Promise((resolve, reject) => {
    resolveOperation = resolve;
    rejectOperation = reject;
  });
  const abortListener = () => onAbort(signal.reason);
  signal.addEventListener("abort", abortListener, { once: true });
  return {
    promise,
    reject: rejectOperation,
    resolve: resolveOperation,
    removeAbortListener() {
      signal.removeEventListener("abort", abortListener);
    },
  };
}

function settlePendingOperation(pendingOperation, settlement, value) {
  pendingOperation.removeAbortListener();
  pendingOperation[settlement](value);
}

export function createInMemoryRenderedGraphAdapter() {
  let isDisposed = false;
  let activeLoadGeneration = null;
  let pendingReplacement = null;
  let pendingViewApplication = null;
  let visibleRenderedGraphSnapshot = null;
  let graphLayoutSnapshot = null;
  let renderedSvgSnapshot = null;
  let renderedArrangement = null;
  let appliedVisualizationView = createDefaultAppliedVisualizationView();
  let viewportState = { zoomScale: 1, translationXPx: 0, translationYPx: 0 };
  const requestedContinuousZoomDirections = [];
  const requestedGraphLayoutPauseStates = [];
  let visualizationResetCount = 0;
  const requestedForceLayoutDistances = [];
  const requestedVisualizationModes = [];
  const renderedGraphEventSubscribers = new Set();

  function assertNotDisposed() {
    if (isDisposed) {
      throw new Error("The in-memory rendered graph runtime is disposed.");
    }
  }

  function rejectPendingReplacement(reason) {
    if (pendingReplacement === null) {
      return;
    }
    const replacementToReject = pendingReplacement;
    pendingReplacement = null;
    settlePendingOperation(replacementToReject, "reject", reason);
  }

  function rejectPendingViewApplication(reason) {
    if (pendingViewApplication === null) {
      return;
    }
    const viewApplicationToReject = pendingViewApplication;
    pendingViewApplication = null;
    settlePendingOperation(viewApplicationToReject, "reject", reason);
  }

  function readCompletedSnapshot(snapshot, createSnapshot, description) {
    assertNotDisposed();
    if (snapshot === null) {
      throw new Error(`No completed ${description} is available.`);
    }
    return createSnapshot(snapshot);
  }

  function publishRenderedGraphEvent(event) {
    if (
      isDisposed ||
      event === null ||
      typeof event !== "object" ||
      event.loadGeneration !== activeLoadGeneration
    ) {
      return false;
    }
    const renderedGraphEvent = createRenderedGraphEvent(event);
    if (renderedGraphEvent.kind === "viewport-changed") {
      viewportState = { ...renderedGraphEvent.payload };
    }
    if (
      renderedGraphEvent.kind === "graph-layout-state-changed" &&
      graphLayoutSnapshot !== null
    ) {
      graphLayoutSnapshot = createGraphLayoutSnapshot({
        ...graphLayoutSnapshot,
        ...renderedGraphEvent.payload,
      });
    }
    for (const subscriber of [...renderedGraphEventSubscribers]) {
      subscriber(renderedGraphEvent);
    }
    return true;
  }

  const renderedGraphRuntime = assertRenderedGraphRuntime(
    Object.freeze({
      setRenderingDiagnosticsEnabled() {
        assertNotDisposed();
      },
      setOntologyEditorOptions(request) {
        assertNotDisposed();
        return Object.freeze({ ...request });
      },
      resizeVisualizationViewport(request) {
        assertNotDisposed();
        return Object.freeze({ ...request });
      },
      clearRenderedGraph() {
        assertNotDisposed();
        const reason = createAbortError("The rendered graph was cleared.");
        rejectPendingReplacement(reason);
        rejectPendingViewApplication(reason);
        activeLoadGeneration = null;
        visibleRenderedGraphSnapshot = null;
        graphLayoutSnapshot = null;
        renderedSvgSnapshot = null;
        renderedArrangement = null;
        appliedVisualizationView = createAppliedVisualizationView({
          ...createDefaultAppliedVisualizationView(),
          modes: appliedVisualizationView.modes,
          forceDistances: appliedVisualizationView.forceDistances,
        });
      },

      async replaceVowlModel(request, options) {
        assertNotDisposed();
        const replacementRequest = createVowlModelReplacementRequest(request);
        const signal = assertOperationSignal(options);
        if (
          activeLoadGeneration !== null &&
          replacementRequest.loadGeneration <= activeLoadGeneration
        ) {
          throw new RangeError(
            "A replacement loadGeneration must be newer than the active generation.",
          );
        }

        const supersededReason = createAbortError(
          `Rendering was superseded by load generation ${replacementRequest.loadGeneration}.`,
        );
        rejectPendingReplacement(supersededReason);
        rejectPendingViewApplication(supersededReason);
        activeLoadGeneration = replacementRequest.loadGeneration;
        visibleRenderedGraphSnapshot = null;
        graphLayoutSnapshot = null;
        renderedSvgSnapshot = null;
        renderedArrangement = null;
        appliedVisualizationView = createAppliedVisualizationView({
          ...createDefaultAppliedVisualizationView(),
          modes: appliedVisualizationView.modes,
          forceDistances: appliedVisualizationView.forceDistances,
        });

        const pendingOperation = createPendingOperation(
          signal,
          (abortReason) => {
            if (pendingReplacement !== pendingOperation) {
              return;
            }
            pendingReplacement = null;
            settlePendingOperation(
              pendingOperation,
              "reject",
              abortReason ?? createAbortError("Rendering was aborted."),
            );
          },
        );
        pendingOperation.loadGeneration = replacementRequest.loadGeneration;
        pendingOperation.replacementRequest = replacementRequest;
        pendingReplacement = pendingOperation;
        return pendingOperation.promise;
      },

      applyVowlModelRevision(request) {
        assertNotDisposed();
        const revision = createVowlModelRevisionRequest(request);
        assertActiveGeneration(revision.loadGeneration, activeLoadGeneration);
        return createVisualizationViewApplicationResult({
          loadGeneration: activeLoadGeneration,
          appliedVisualizationView,
          visibleRenderedGraphSnapshot,
        });
      },

      async applyVisualizationView(request, options) {
        assertNotDisposed();
        const viewApplicationRequest =
          createVisualizationViewApplicationRequest(request);
        const signal = assertOperationSignal(options);
        assertActiveGeneration(
          viewApplicationRequest.loadGeneration,
          activeLoadGeneration,
        );
        if (visibleRenderedGraphSnapshot === null) {
          throw new Error(
            "A visualization view cannot be applied before initial paint.",
          );
        }

        rejectPendingViewApplication(
          createAbortError("The prior visualization view was superseded."),
        );
        const pendingOperation = createPendingOperation(
          signal,
          (abortReason) => {
            if (pendingViewApplication !== pendingOperation) {
              return;
            }
            pendingViewApplication = null;
            settlePendingOperation(
              pendingOperation,
              "reject",
              abortReason ?? createAbortError("View application was aborted."),
            );
          },
        );
        pendingOperation.loadGeneration = viewApplicationRequest.loadGeneration;
        pendingOperation.viewApplicationRequest = viewApplicationRequest;
        pendingViewApplication = pendingOperation;
        return pendingOperation.promise;
      },

      readVisibleRenderedGraphSnapshot() {
        return readCompletedSnapshot(
          visibleRenderedGraphSnapshot,
          createVisibleRenderedGraphSnapshot,
          "visible rendered graph snapshot",
        );
      },

      readRenderedArrangement() {
        return readCompletedSnapshot(
          renderedArrangement,
          createRenderedArrangement,
          "rendered arrangement",
        );
      },

      async setRenderedArrangement(request, { signal } = {}) {
        assertNotDisposed();
        signal?.throwIfAborted();
        const changes = resolveRenderedArrangementChanges(
          renderedGraphRuntime.readRenderedArrangement(),
          request,
        );
        renderedArrangement = createRenderedArrangement({
          ...renderedArrangement,
          occurrences: renderedArrangement.occurrences.map((entry) => {
            const change = changes.find(
              (candidate) =>
                candidate.reference.occurrenceId ===
                entry.reference.occurrenceId,
            );
            return change === undefined ? entry : { ...entry, ...change };
          }),
        });
        return renderedArrangement;
      },

      selectRenderedOccurrence(request) {
        assertNotDisposed();
        const selection = createRenderedOccurrenceSelectionRequest(request);
        const snapshot = renderedGraphRuntime.readRenderedArrangement();
        const occurrence =
          selection.reference === null
            ? null
            : snapshot.occurrences.find(
                (entry) =>
                  entry.reference.occurrenceId ===
                  selection.reference.occurrenceId,
              );
        if (
          selection.reference !== null &&
          (selection.reference.loadGeneration !== activeLoadGeneration ||
            occurrence === undefined)
        ) {
          throw new RangeError(
            "The selection targets an absent or retired occurrence.",
          );
        }
        publishRenderedGraphEvent({
          kind: "rendered-element-selection-changed",
          loadGeneration: activeLoadGeneration,
          payload: {
            selectedOntologyElementReferences:
              occurrence?.ontologyElementReferences ?? [],
          },
        });
        publishRenderedGraphEvent({
          kind: "document-record-selection-changed",
          loadGeneration: activeLoadGeneration,
          payload: { recordTarget: occurrence?.recordTargets[0] ?? null },
        });
        return selection.reference;
      },

      readGraphLayoutSnapshot() {
        return readCompletedSnapshot(
          graphLayoutSnapshot,
          createGraphLayoutSnapshot,
          "graph layout snapshot",
        );
      },

      setGraphLayoutPaused(request) {
        assertNotDisposed();
        const pauseRequest = createGraphLayoutPauseRequest(request);
        requestedGraphLayoutPauseStates.push(pauseRequest.isPaused);
        assertActiveGeneration(
          pauseRequest.loadGeneration,
          activeLoadGeneration,
        );
        if (graphLayoutSnapshot === null) {
          throw new Error("Graph layout is unavailable before initial paint.");
        }
        graphLayoutSnapshot = createGraphLayoutSnapshot({
          ...graphLayoutSnapshot,
          isPaused: pauseRequest.isPaused,
          ...(pauseRequest.isPaused ? {} : { forceAlpha: 1, hasEnded: false }),
        });
        const layoutStatus = pauseRequest.isPaused
          ? "paused"
          : graphLayoutSnapshot.hasEnded
            ? "settled"
            : "relaxing";
        const result = createGraphLayoutPauseResult({
          isPaused: pauseRequest.isPaused,
          layoutStatus,
          loadGeneration: pauseRequest.loadGeneration,
        });
        publishRenderedGraphEvent({
          kind: "graph-layout-state-changed",
          loadGeneration: pauseRequest.loadGeneration,
          payload: {
            forceAlpha: graphLayoutSnapshot.forceAlpha,
            hasEnded: graphLayoutSnapshot.hasEnded,
            isPaused: graphLayoutSnapshot.isPaused,
          },
        });
        return result;
      },

      setContinuousZoom(request) {
        assertNotDisposed();
        const { zoomDirection } = createContinuousZoomRequest(request);
        requestedContinuousZoomDirections.push(zoomDirection);
        return zoomDirection;
      },

      setVisualizationModes(request) {
        assertNotDisposed();
        const requestedModes = createVisualizationModesRequest(request);
        requestedVisualizationModes.push(requestedModes);
        appliedVisualizationView = createAppliedVisualizationView({
          ...appliedVisualizationView,
          modes: { ...appliedVisualizationView.modes, ...requestedModes },
        });
        return appliedVisualizationView;
      },

      setForceLayoutDistances(request) {
        assertNotDisposed();
        const requestedDistances = createForceLayoutDistancesRequest(request);
        requestedForceLayoutDistances.push(requestedDistances);
        appliedVisualizationView = createAppliedVisualizationView({
          ...appliedVisualizationView,
          forceDistances: {
            ...appliedVisualizationView.forceDistances,
            ...requestedDistances,
          },
        });
        return appliedVisualizationView;
      },

      async resetVisualization({ signal } = {}) {
        assertNotDisposed();
        signal?.throwIfAborted();
        visualizationResetCount += 1;
        appliedVisualizationView = createAppliedVisualizationView({
          ...appliedVisualizationView,
          filters: DEFAULT_VISUALIZATION_FILTERS,
          focus: [],
          modes: DEFAULT_VISUALIZATION_MODES,
          forceDistances: DEFAULT_FORCE_LAYOUT_DISTANCES,
        });
        if (activeLoadGeneration !== null) {
          graphLayoutSnapshot = createGraphLayoutSnapshot({
            ...graphLayoutSnapshot,
            forceAlpha: 1,
            hasEnded: false,
            isPaused: false,
          });
          publishRenderedGraphEvent({
            kind: "rendered-element-selection-changed",
            loadGeneration: activeLoadGeneration,
            payload: { selectedOntologyElementReferences: [] },
          });
          publishRenderedGraphEvent({
            kind: "visualization-view-changed",
            loadGeneration: activeLoadGeneration,
            payload: { appliedVisualizationView },
          });
        }
        return appliedVisualizationView;
      },

      createTurtleDocumentSnapshot(request) {
        assertNotDisposed();
        assertActiveGeneration(request.loadGeneration, activeLoadGeneration);
        return Object.freeze({
          loadGeneration: activeLoadGeneration,
          turtleText: "# In-memory test runtime Turtle document.\n",
        });
      },

      createRenderedDrawingSnapshot(request) {
        assertNotDisposed();
        assertActiveGeneration(request.loadGeneration, activeLoadGeneration);
        return Object.freeze({
          loadGeneration: activeLoadGeneration,
          bounds: Object.freeze({
            leftPx: 0,
            topPx: 0,
            rightPx: 800,
            bottomPx: 600,
          }),
          compactNotation: appliedVisualizationView.modes.compactNotation,
          nodes: Object.freeze([]),
          propertyLabels: Object.freeze([]),
          links: Object.freeze([]),
        });
      },

      createRenderedSvgSnapshot(request) {
        assertNotDisposed();
        const snapshotRequest = createRenderedSvgSnapshotRequest(request);
        assertActiveGeneration(
          snapshotRequest.loadGeneration,
          activeLoadGeneration,
        );
        return readCompletedSnapshot(
          renderedSvgSnapshot,
          createRenderedSvgSnapshot,
          "rendered SVG snapshot",
        );
      },

      subscribeToRenderedGraphEvents(subscriber) {
        assertNotDisposed();
        if (typeof subscriber !== "function") {
          throw new TypeError(
            "A rendered-graph event subscriber must be a function.",
          );
        }
        renderedGraphEventSubscribers.add(subscriber);
        let isSubscribed = true;
        return () => {
          if (!isSubscribed) {
            return;
          }
          isSubscribed = false;
          renderedGraphEventSubscribers.delete(subscriber);
        };
      },

      dispose() {
        if (isDisposed) {
          return;
        }
        isDisposed = true;
        const disposalReason = createAbortError(
          "The in-memory rendered graph runtime was disposed.",
        );
        rejectPendingReplacement(disposalReason);
        rejectPendingViewApplication(disposalReason);
        renderedGraphEventSubscribers.clear();
        activeLoadGeneration = null;
        visibleRenderedGraphSnapshot = null;
        graphLayoutSnapshot = null;
        renderedSvgSnapshot = null;
        renderedArrangement = null;
      },
    }),
  );

  const renderedGraphTestHarness = Object.freeze({
    readVisualizationResetCount() {
      return visualizationResetCount;
    },
    // Whether an operation held the layout still, and in which order, is the
    // difference between an export that disturbs a settled graph and one that
    // leaves it alone.
    readGraphLayoutPauseRequests() {
      return [...requestedGraphLayoutPauseStates];
    },

    completeInitialPaint(loadGeneration, snapshotOverrides = {}) {
      assertSnapshotOverrides(snapshotOverrides);
      if (
        isDisposed ||
        pendingReplacement === null ||
        pendingReplacement.loadGeneration !== loadGeneration ||
        activeLoadGeneration !== loadGeneration
      ) {
        return false;
      }
      const replacementToComplete = pendingReplacement;
      const initial =
        replacementToComplete.replacementRequest.initialVisualization ?? {};
      const initialView = initial.view ?? {};
      appliedVisualizationView = createAppliedVisualizationView({
        ...appliedVisualizationView,
        language: initialView.language ?? appliedVisualizationView.language,
        focus: initialView.focus ?? appliedVisualizationView.focus,
        filters: {
          ...appliedVisualizationView.filters,
          ...initialView.filters,
        },
        modes: { ...appliedVisualizationView.modes, ...initial.modes },
        forceDistances: {
          ...appliedVisualizationView.forceDistances,
          ...initial.forceDistances,
        },
      });
      const nextVisibleRenderedGraphSnapshot =
        createVisibleRenderedGraphSnapshot(
          snapshotOverrides.visibleRenderedGraphSnapshot ??
            createDefaultVisibleRenderedGraphSnapshot(loadGeneration),
        );
      const nextGraphLayoutSnapshot = createGraphLayoutSnapshot(
        snapshotOverrides.graphLayoutSnapshot ?? {
          ...createDefaultGraphLayoutSnapshot(loadGeneration),
          ...(initialView.layout === undefined
            ? {}
            : { isPaused: initialView.layout === "pause" }),
        },
      );
      const nextRenderedSvgSnapshot = createRenderedSvgSnapshot(
        snapshotOverrides.renderedSvgSnapshot ??
          createDefaultRenderedSvgSnapshot(loadGeneration),
      );
      const nextRenderedArrangement = createRenderedArrangement(
        snapshotOverrides.renderedArrangement ?? {
          loadGeneration,
          occurrences: [],
        },
      );
      for (const snapshot of [
        nextVisibleRenderedGraphSnapshot,
        nextGraphLayoutSnapshot,
        nextRenderedSvgSnapshot,
        nextRenderedArrangement,
      ]) {
        if (snapshot.loadGeneration !== loadGeneration) {
          throw new RangeError(
            "Every initial-paint snapshot must match loadGeneration.",
          );
        }
      }

      visibleRenderedGraphSnapshot = nextVisibleRenderedGraphSnapshot;
      graphLayoutSnapshot = nextGraphLayoutSnapshot;
      renderedSvgSnapshot = nextRenderedSvgSnapshot;
      renderedArrangement = nextRenderedArrangement;
      if (
        initialView.zoomScale !== undefined ||
        initialView.translation !== undefined
      ) {
        publishRenderedGraphEvent({
          kind: "viewport-changed",
          loadGeneration,
          payload: {
            zoomScale: initialView.zoomScale ?? viewportState.zoomScale,
            translationXPx:
              initialView.translation?.xPx ?? viewportState.translationXPx,
            translationYPx:
              initialView.translation?.yPx ?? viewportState.translationYPx,
          },
        });
      }
      pendingReplacement = null;
      settlePendingOperation(
        replacementToComplete,
        "resolve",
        createVowlModelReplacementResult({ loadGeneration }),
      );
      return true;
    },

    completeVisualizationViewApplication(loadGeneration, overrides = {}) {
      if (
        overrides === null ||
        typeof overrides !== "object" ||
        Array.isArray(overrides) ||
        Object.keys(overrides).some(
          (fieldName) =>
            fieldName !== "appliedVisualizationView" &&
            fieldName !== "visibleRenderedGraphSnapshot",
        )
      ) {
        throw new TypeError("View-completion overrides are invalid.");
      }
      if (
        isDisposed ||
        pendingViewApplication === null ||
        pendingViewApplication.loadGeneration !== loadGeneration ||
        activeLoadGeneration !== loadGeneration
      ) {
        return false;
      }
      const viewApplicationToComplete = pendingViewApplication;
      const { viewApplicationRequest } = viewApplicationToComplete;
      const requestedVisualizationView = Object.fromEntries(
        Object.entries(viewApplicationRequest).filter(
          ([fieldName]) => fieldName !== "loadGeneration",
        ),
      );
      const nextAppliedVisualizationView =
        overrides.appliedVisualizationView ?? {
          modes: appliedVisualizationView.modes,
          forceDistances: appliedVisualizationView.forceDistances,
          language:
            requestedVisualizationView.language ??
            appliedVisualizationView.language,
          focus:
            requestedVisualizationView.focus ?? appliedVisualizationView.focus,
          filters: {
            ...appliedVisualizationView.filters,
            ...requestedVisualizationView.filters,
          },
        };
      const nextVisibleRenderedGraphSnapshot =
        overrides.visibleRenderedGraphSnapshot ?? visibleRenderedGraphSnapshot;
      const result = createVisualizationViewApplicationResult({
        appliedVisualizationView: nextAppliedVisualizationView,
        loadGeneration,
        visibleRenderedGraphSnapshot: nextVisibleRenderedGraphSnapshot,
      });
      if (viewApplicationRequest.layout !== undefined) {
        renderedGraphRuntime.setGraphLayoutPaused({
          loadGeneration,
          isPaused: viewApplicationRequest.layout === "pause",
        });
      }
      if (viewApplicationRequest.translation !== undefined) {
        publishRenderedGraphEvent({
          kind: "viewport-changed",
          loadGeneration,
          payload: {
            ...viewportState,
            translationXPx: viewApplicationRequest.translation.xPx,
            translationYPx: viewApplicationRequest.translation.yPx,
          },
        });
      }
      appliedVisualizationView = result.appliedVisualizationView;
      visibleRenderedGraphSnapshot = result.visibleRenderedGraphSnapshot;
      pendingViewApplication = null;
      settlePendingOperation(viewApplicationToComplete, "resolve", result);
      return true;
    },

    publishRenderedGraphEvent,
  });

  return Object.freeze({
    renderedGraphRuntime,
    renderedGraphTestHarness,
  });
}
