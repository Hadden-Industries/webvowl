// Routes each published controller state to the presentation modules whose own
// slice of it changed.
//
// The controller states which fields it wrote and narrows that set to the ones
// whose value actually differs, so nothing is compared here. A presentation
// runs when the producer says its field changed, and not otherwise.
//
// This matters to a reader rather than only to a profiler. A held zoom button
// reports a magnification on every animation frame; re-rendering the selection
// details panel that often would destroy text the reader had highlighted, move
// focus out of the panel, make a screen reader re-announce it, and reset its
// scroll position.

const CONTROLLER_STATE_PRESENTER_DEPENDENCY_FIELD_NAMES = Object.freeze([
  "renderLoadState",
  "renderGraphLayoutPaused",
  "renderSelectedOntologyElements",
  "renderSelectedOntologyElementDetails",
  "renderOntologySummary",
  "renderViewport",
  "renderEditorMode",
  "describeOntologyElements",
  "readOntologySummary",
]);

// The state fields each presentation draws. A presentation runs when the
// producer reports that one of its fields changed.
const LOAD_STATE_FIELD_NAMES = Object.freeze([
  "status",
  "loadGeneration",
  "source",
  "warnings",
  "renderProgress",
  "error",
]);

// Every field this module draws something from. Paired with the list below it
// accounts for the controller's whole closed field set, so a field added
// without a presentation fails a test rather than going quietly uncollected.
export const PRESENTED_CONTROLLER_STATE_FIELD_NAMES = Object.freeze([
  ...LOAD_STATE_FIELD_NAMES,
  "layout",
  "selection",
  "zoomScale",
  "editorMode",
]);

// The view controls present standing choices through their own subscriber.
// Translation is already drawn by the viewport and has no separate UI field.
// Both remain observable to any controller consumer.
export const SEPARATELY_PRESENTED_CONTROLLER_STATE_FIELD_NAMES = Object.freeze([
  "view",
  "translation",
]);

function assertExactDependencyFieldNames(dependencies) {
  if (
    dependencies === null ||
    typeof dependencies !== "object" ||
    Array.isArray(dependencies)
  ) {
    throw new TypeError(
      "Controller state presenter dependencies must be a plain object.",
    );
  }
  for (const fieldName of CONTROLLER_STATE_PRESENTER_DEPENDENCY_FIELD_NAMES) {
    if (typeof dependencies[fieldName] !== "function") {
      throw new TypeError(
        `Controller state presenter requires a ${fieldName} function.`,
      );
    }
  }
}

export function createControllerStatePresenter(dependencies) {
  assertExactDependencyFieldNames(dependencies);
  const {
    renderLoadState,
    renderGraphLayoutPaused,
    renderSelectedOntologyElements,
    renderSelectedOntologyElementDetails,
    renderOntologySummary,
    renderViewport,
    renderEditorMode,
    describeOntologyElements,
    readOntologySummary,
  } = dependencies;

  let hasPresentedAnyState = false;
  // The presenter's own record of what it has already drawn. This is the
  // consumer keeping its copy of what applies to it, not a diff of the
  // producer's payload.
  let summarisedLoadGeneration = 0;

  return Object.freeze({
    present(controllerState, changedFieldNames = []) {
      // The first state a presenter sees is entirely new to it, whatever the
      // producer reports as changed.
      const changedFields = new Set(
        hasPresentedAnyState ? changedFieldNames : Object.keys(controllerState),
      );
      hasPresentedAnyState = true;

      if (
        LOAD_STATE_FIELD_NAMES.some((fieldName) => changedFields.has(fieldName))
      ) {
        renderLoadState(controllerState);
      }

      if (changedFields.has("layout")) {
        renderGraphLayoutPaused(controllerState.layout?.status === "paused");
      }

      if (changedFields.has("selection")) {
        const selection = Array.isArray(controllerState.selection)
          ? controllerState.selection
          : [];
        renderSelectedOntologyElements(selection);
        // Describing an element reads the loaded ontology, so it is skipped
        // entirely before one exists.
        const hasDescribableSelection =
          selection.length > 0 && controllerState.loadGeneration > 0;
        renderSelectedOntologyElementDetails(
          hasDescribableSelection
            ? describeOntologyElements({
                ontologyElementReferences: selection,
              }).elementDescriptions
            : [],
        );
      }

      // Magnification and pan are separate state fields, so a pan does not
      // reach a zoom control at all.
      if (
        changedFields.has("zoomScale") &&
        typeof controllerState.zoomScale === "number"
      ) {
        renderViewport(controllerState.zoomScale);
      }

      // Editor mode reaches the interface as a published fact, so no
      // presentation asks the renderer which mode it is in.
      if (
        changedFields.has("editorMode") &&
        controllerState.editorMode !== null &&
        controllerState.editorMode !== undefined
      ) {
        renderEditorMode(controllerState.editorMode.isEditorMode === true);
      }

      // A load reaches ready either when it completes or later when background
      // settlement finishes, and only one of those writes the generation.
      if (
        changedFields.has("status") &&
        controllerState.status === "ready" &&
        controllerState.loadGeneration !== summarisedLoadGeneration
      ) {
        summarisedLoadGeneration = controllerState.loadGeneration;
        renderOntologySummary(readOntologySummary());
      }
    },
  });
}
