// Canonical application/renderer seam. DTO validation stays with its owning
// contracts; this declaration carries no renderer or application dependency.
export const CANONICAL_RENDERED_GRAPH_RUNTIME_METHOD_NAMES = Object.freeze([
  "replaceCanonicalDrawing",
  "applyCanonicalDrawingRevision",
  "readCanonicalDrawingState",
  "clearRenderedGraph",
  "readVisualizationView",
  "readVisualizationViewport",
  "setVisualizationFocus",
  "applyVisualizationView",
  "readVisibleRenderedGraphSnapshot",
  "readGraphLayoutSnapshot",
  "readRenderedArrangement",
  "readSelectedOccurrenceObservation",
  "setRenderedArrangement",
  "selectRenderedOccurrence",
  "setGraphLayoutPaused",
  "setContinuousZoom",
  "setForceLayoutDistances",
  "setVisualizationModes",
  "resetVisualization",
  "setOntologyEditorOptions",
  "resizeVisualizationViewport",
  "setRenderingDiagnosticsEnabled",
  "createRenderedSvgSnapshot",
  "createRenderedDrawingSnapshot",
  "subscribeToRenderedGraphEvents",
  "dispose",
]);

export const CANONICAL_RENDERED_GRAPH_EVENT_CLASSES = Object.freeze({
  "rendered-element-selection-changed": "identity",
  "document-record-selection-changed": "identity",
  "render-progress-changed": "renderer-observation",
  "render-warning-raised": "renderer-observation",
  "rendering-statistics-changed": "renderer-observation",
  "selected-occurrence-geometry-changed": "renderer-observation",
  "editor-mode-changed": "renderer-observation",
  "visualization-view-changed": "renderer-observation",
  "viewport-changed": "renderer-observation",
  "graph-layout-state-changed": "renderer-observation",
  "record-deletion-requested": "editing-request",
  "semantic-creation-requested": "editing-request",
  "record-creation-requested": "editing-request",
  "record-endpoint-edit-requested": "editing-request",
  "record-label-edit-requested": "editing-request",
});

export function assertCanonicalRenderedGraphRuntime(candidate) {
  if (!candidate || !["object", "function"].includes(typeof candidate)) {
    throw new TypeError("CanonicalRenderedGraphRuntime must be an object.");
  }
  for (const name of CANONICAL_RENDERED_GRAPH_RUNTIME_METHOD_NAMES) {
    if (typeof candidate[name] !== "function") {
      throw new TypeError(`CanonicalRenderedGraphRuntime requires ${name}.`);
    }
  }
  for (const name of [
    "readOntologyInspectionSnapshot",
    "replaceVowlModel",
    "applyVowlModelRevision",
  ]) {
    if (candidate[name] !== undefined) {
      throw new TypeError(
        `CanonicalRenderedGraphRuntime must not expose the retired ${name} method.`,
      );
    }
  }
  return candidate;
}
