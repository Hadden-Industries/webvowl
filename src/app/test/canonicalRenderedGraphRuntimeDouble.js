import {
  createCanonicalDrawingRequest,
  createVisualizationViewApplicationRequest,
  createVisualizationModesRequest,
  createForceLayoutDistancesRequest,
  createRenderedGraphEvent,
  createVisibleRenderedGraphSnapshot,
  createGraphLayoutSnapshot,
  createVisualizationViewApplicationResult,
  createContinuousZoomRequest,
  DEFAULT_VISUALIZATION_MODES,
  DEFAULT_FORCE_LAYOUT_DISTANCES,
} from "../js/controller/renderedGraphRuntimeContracts.js";
import {
  createRenderedArrangement,
  resolveRenderedArrangementChanges,
} from "../js/controller/renderedArrangementContracts.js";
import { layoutInitialTree } from "../../webvowl/js/runtime/initialTreeLayout.js";

export function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

// Owns applied drawing data independently of the session. It deliberately does
// not simulate SVG geometry, force physics, browser paint or worker scheduling.
// A drawing export needs an explicit fixture supplied by the test.
export function createCanonicalRenderedGraphRuntimeDouble({
  svgSnapshot,
  drawingSnapshot,
  observeNextPaint,
} = {}) {
  let mounted,
    disposed = false,
    generationOwner = new AbortController(),
    viewOwner;
  let focus = [],
    modes = { ...DEFAULT_VISUALIZATION_MODES },
    distances = { ...DEFAULT_FORCE_LAYOUT_DISTANCES };
  let paused = true,
    widthPx = 800,
    heightPx = 600,
    translation = { xPx: 0, yPx: 0 };
  let editorOptions = {},
    continuousZoom = "none",
    diagnostics = false,
    selected = null;
  let filters = {
    datatypes: "show",
    disjointness: "show",
    objectProperties: "show",
    setOperators: "show",
    subclasses: "show",
  };
  const listeners = new Set(),
    paints = [],
    failures = [];
  const clone = (value) => structuredClone(value);
  function assertLive(generation) {
    if (disposed) {
      throw new Error("The canonical drawing double is disposed.");
    }
    if (generation !== undefined && generation !== mounted?.loadGeneration) {
      throw new DOMException("Retired drawing.", "AbortError");
    }
  }
  function assertMounted() {
    assertLive();
    if (!mounted) {
      throw new Error("No completed canonical drawing exists.");
    }
  }
  function beforeMutation() {
    assertLive();
    if (failures.length) {
      throw failures.shift();
    }
  }
  function emit(kind, payload) {
    if (!mounted || disposed) {
      return;
    }
    const event = createRenderedGraphEvent({
      kind,
      loadGeneration: mounted.loadGeneration,
      payload,
    });
    for (const listener of listeners) {
      listener(event);
    }
  }
  function beginView(signal) {
    signal?.throwIfAborted();
    viewOwner?.abort();
    viewOwner = new AbortController();
    return AbortSignal.any([
      generationOwner.signal,
      viewOwner.signal,
      ...(signal ? [signal] : []),
    ]);
  }
  async function paint(signal) {
    signal?.throwIfAborted();
    const work =
      paints.shift()?.promise ??
      observeNextPaint?.({ loadGeneration: mounted?.loadGeneration, signal }) ??
      Promise.resolve();
    let onAbort;
    const interrupted = new Promise((resolve, reject) => {
      void resolve;
      onAbort = () => reject(signal.reason);
      signal?.addEventListener("abort", onAbort, { once: true });
    });
    try {
      await Promise.race([work, interrupted]);
      signal?.throwIfAborted();
      assertLive();
    } finally {
      signal?.removeEventListener("abort", onAbort);
    }
  }
  function readView() {
    assertLive();
    const labels = mounted?.drawing.labelSelection;
    const display = mounted?.drawing.display;
    return clone({
      language: labels
        ? labels.mode === "iri"
          ? "IRI-based"
          : labels.mode === "untagged"
            ? "undefined"
            : labels.range
        : "default",
      focus,
      filters,
      modes: {
        ...modes,
        ...(display
          ? {
              compactNotation: display.compactNotation,
              nodeScaling: display.nodeScaling === "direct-membership",
              colorExternals: display.externalColoring,
            }
          : {}),
      },
      forceDistances: distances,
    });
  }
  function arrangement() {
    assertMounted();
    const { drawing, loadGeneration } = mounted;
    return createRenderedArrangement({
      loadGeneration,
      occurrences: [...drawing.nodes, ...drawing.labels]
        .filter((row) => !row.hidden)
        .map((row) => {
          const binding = drawing.applicationBindings.find(
            ({ occurrence }) => occurrence === row.occurrence,
          );
          return {
            reference: binding.runtimeReference,
            recordTargets: binding.recordTargets,
            ontologyElementReferences: binding.semanticReferences,
            kind: drawing.nodes.includes(row) ? "node" : "property-label",
            xPx: row.position.x,
            yPx: row.position.y,
            isPinned: row.pinned,
            canMove: true,
            canPin: true,
          };
        }),
    });
  }
  const runtime = Object.freeze({
    layoutInitialTree(root, radius) {
      assertLive();
      return layoutInitialTree(root, radius);
    },
    async replaceCanonicalDrawing(request, { signal } = {}) {
      const candidate = createCanonicalDrawingRequest(request);
      signal?.throwIfAborted();
      beforeMutation();
      generationOwner.abort();
      generationOwner = new AbortController();
      mounted = clone(candidate);
      focus = clone(candidate.initialVisualization?.view?.focus ?? []);
      modes = { ...modes, ...candidate.initialVisualization?.modes };
      distances = {
        ...distances,
        ...candidate.initialVisualization?.forceDistances,
      };
      paused = candidate.layout === "pause";
      await paint(
        AbortSignal.any([generationOwner.signal, ...(signal ? [signal] : [])]),
      );
      return {
        loadGeneration: mounted.loadGeneration,
        documentRevision: mounted.documentRevision,
      };
    },
    applyCanonicalDrawingRevision(request) {
      const candidate = createCanonicalDrawingRequest(request, {
        revision: true,
      });
      assertLive(candidate.loadGeneration);
      if (candidate.baseRevision !== mounted.documentRevision) {
        throw new DOMException("Retired revision.", "AbortError");
      }
      beforeMutation();
      mounted = { ...mounted, ...clone(candidate) };
      return {
        loadGeneration: mounted.loadGeneration,
        documentRevision: mounted.documentRevision,
      };
    },
    readCanonicalDrawingState() {
      assertMounted();
      return clone({
        loadGeneration: mounted.loadGeneration,
        documentRevision: mounted.documentRevision,
        placements: [...mounted.drawing.nodes, ...mounted.drawing.labels].map(
          ({ occurrence, position, pinned }) => ({
            occurrence,
            position,
            pinned,
          }),
        ),
        camera: mounted.drawing.camera,
      });
    },
    clearRenderedGraph() {
      assertLive();
      generationOwner.abort();
      mounted = undefined;
      focus = [];
    },
    readVisualizationView: readView,
    readVisualizationViewport() {
      assertLive();
      return clone({
        zoomScale: mounted?.drawing.camera.zoom ?? 1,
        translation,
      });
    },
    setVisualizationFocus(request) {
      const validated = createVisualizationViewApplicationRequest(request);
      assertLive(validated.loadGeneration);
      focus = clone(validated.focus);
      return readView();
    },
    async applyVisualizationView(request, { signal } = {}) {
      const validated = createVisualizationViewApplicationRequest(request);
      assertLive(validated.loadGeneration);
      beforeMutation();
      const combined = beginView(signal);
      if (validated.focus !== undefined) {
        focus = clone(validated.focus);
      }
      filters = { ...filters, ...validated.filters };
      if (validated.layout !== undefined) {
        paused = validated.layout === "pause";
      }
      await paint(combined);
      if (validated.zoomScale !== undefined) {
        mounted.drawing.camera.zoom = validated.zoomScale;
      }
      if (validated.translation !== undefined) {
        translation = clone(validated.translation);
      }
      return createVisualizationViewApplicationResult({
        loadGeneration: mounted.loadGeneration,
        appliedVisualizationView: readView(),
        visibleRenderedGraphSnapshot:
          runtime.readVisibleRenderedGraphSnapshot(),
      });
    },
    readVisibleRenderedGraphSnapshot() {
      assertMounted();
      const { nodes, labels, applicationBindings } = mounted.drawing;
      const references = (rows, property) =>
        rows
          .filter((row) => !row.hidden)
          .flatMap(
            (row) =>
              applicationBindings.find(
                ({ occurrence }) => occurrence === row.occurrence,
              )?.semanticReferences ?? [],
          )
          .filter(({ kind }) => (kind === "property") === property);
      return createVisibleRenderedGraphSnapshot({
        loadGeneration: mounted.loadGeneration,
        visibleElementReferences: references(nodes, false),
        visibleRelationshipReferences: references(labels, true),
        visibleGraphCounts: {
          visibleNodeCount: nodes.filter((row) => !row.hidden).length,
          visiblePropertyCount: labels.filter((row) => !row.hidden).length,
        },
      });
    },
    readGraphLayoutSnapshot() {
      assertMounted();
      return createGraphLayoutSnapshot({
        loadGeneration: mounted.loadGeneration,
        isPaused: paused,
        hasEnded: false,
        forceAlpha: paused ? 0 : 0.1,
        widthPx,
        heightPx,
        observedAtMs: 0,
        layoutElementPositions: [
          ...mounted.drawing.nodes,
          ...mounted.drawing.labels,
        ].map((row) => ({
          stableLayoutElementKey: `${mounted.drawing.nodes.includes(row) ? "node" : "label"}:${row.occurrence}`,
          x: row.position.x,
          y: row.position.y,
        })),
      });
    },
    readRenderedArrangement: arrangement,
    readSelectedOccurrenceObservation: () => null,
    async setRenderedArrangement(request, { signal } = {}) {
      const changes = resolveRenderedArrangementChanges(arrangement(), request);
      beforeMutation();
      const combined = beginView(signal);
      for (const change of changes) {
        const binding = mounted.drawing.applicationBindings.find(
          ({ runtimeReference }) =>
            runtimeReference?.occurrenceId === change.reference.occurrenceId,
        );
        const row = [...mounted.drawing.nodes, ...mounted.drawing.labels].find(
          ({ occurrence }) => occurrence === binding.occurrence,
        );
        if (change.xPx !== undefined) {
          row.position = { x: change.xPx, y: change.yPx };
        }
        if (change.isPinned !== undefined) {
          row.pinned = change.isPinned;
        }
      }
      await paint(combined);
      return arrangement();
    },
    selectRenderedOccurrence({ reference }) {
      assertLive(reference?.loadGeneration);
      selected = clone(reference);
      return selected;
    },
    setGraphLayoutPaused({
      loadGeneration = mounted?.loadGeneration,
      isPaused,
    }) {
      assertLive(loadGeneration);
      if (typeof isPaused !== "boolean") {
        throw new TypeError("isPaused must be a boolean.");
      }
      paused = isPaused;
      emit("graph-layout-state-changed", {
        isPaused,
        hasEnded: false,
        forceAlpha: isPaused ? 0 : 0.1,
      });
      return Object.freeze({
        loadGeneration,
        isPaused,
        layoutStatus: isPaused ? "paused" : "relaxing",
      });
    },
    setContinuousZoom(request) {
      assertLive();
      const { zoomDirection } = createContinuousZoomRequest(request);
      continuousZoom = zoomDirection;
      return zoomDirection;
    },
    setForceLayoutDistances(request) {
      beforeMutation();
      distances = {
        ...distances,
        ...createForceLayoutDistancesRequest(request),
      };
      return readView();
    },
    setVisualizationModes(request, { signal } = {}) {
      const validated = createVisualizationModesRequest(request);
      beforeMutation();
      const combined = beginView(signal);
      modes = { ...modes, ...validated };
      const generation = mounted?.loadGeneration;
      return (async () => {
        try {
          await paint(combined);
          return readView();
        } finally {
          if (!disposed && generation === mounted?.loadGeneration) {
            emit("visualization-view-changed", {
              appliedVisualizationView: readView(),
            });
          }
        }
      })();
    },
    async resetVisualization({ signal } = {}) {
      beforeMutation();
      const combined = beginView(signal);
      modes = { ...DEFAULT_VISUALIZATION_MODES };
      distances = { ...DEFAULT_FORCE_LAYOUT_DISTANCES };
      focus = [];
      paused = false;
      await paint(combined);
      return readView();
    },
    setOntologyEditorOptions(request) {
      assertLive();
      editorOptions = { ...editorOptions, ...clone(request) };
      return clone(editorOptions);
    },
    resizeVisualizationViewport(size) {
      assertLive();
      ({ widthPx, heightPx } = size);
      return { widthPx, heightPx };
    },
    setRenderingDiagnosticsEnabled(value) {
      assertLive();
      diagnostics = value;
    },
    createRenderedSvgSnapshot({ loadGeneration }) {
      assertLive(loadGeneration);
      if (!svgSnapshot) {
        throw new Error(
          "An explicit SVG fixture is required; this double does not render geometry.",
        );
      }
      return clone({ ...svgSnapshot, loadGeneration });
    },
    createRenderedDrawingSnapshot({ loadGeneration }) {
      assertLive(loadGeneration);
      if (!drawingSnapshot) {
        throw new Error("An explicit drawing fixture is required.");
      }
      return clone({ ...drawingSnapshot, loadGeneration });
    },
    subscribeToRenderedGraphEvents(listener) {
      assertLive();
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose() {
      if (disposed) {
        return;
      }
      disposed = true;
      generationOwner.abort();
      viewOwner?.abort();
      listeners.clear();
      mounted = undefined;
      focus = [];
      paints.length = 0;
      failures.length = 0;
    },
  });
  return Object.freeze({
    runtime,
    deferPaint() {
      const pending = deferred();
      paints.push(pending);
      return pending;
    },
    failNextMutation(error = new Error("Renderer mutation failed.")) {
      failures.push(error);
    },
    emit(event) {
      const validated = createRenderedGraphEvent(event);
      if (disposed || validated.loadGeneration !== mounted?.loadGeneration) {
        return false;
      }
      for (const listener of listeners) {
        listener(validated);
      }
      return true;
    },
    observe() {
      return clone({
        mounted,
        focus,
        modes,
        distances,
        paused,
        disposed,
        selected,
        continuousZoom,
        diagnostics,
        listenerCount: listeners.size,
        pendingPaintCount: paints.length,
      });
    },
  });
}
