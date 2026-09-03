// Routes each published controller state to the presentation modules whose own
// slice of it changed.
//
// The controller states which fields it wrote and narrows that set to the ones
// whose value actually differs, so nothing is compared here. A presentation
// runs when the producer says its field changed, and not otherwise.
//
// This matters to a reader rather than only to a profiler. A held zoom button
// reports a viewport fact on every animation frame; re-rendering the selection
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

      // A pan and a zoom both write the viewport field, so a zoom control is
      // told about a pan. Presenting a magnification is idempotent, so the
      // redundant call costs a reader nothing.
      if (
        changedFields.has("viewport") &&
        typeof controllerState.viewport?.zoomScale === "number"
      ) {
        renderViewport(controllerState.viewport.zoomScale);
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
