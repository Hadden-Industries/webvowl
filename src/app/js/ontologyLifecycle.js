export const ONTOLOGY_LIFECYCLE_STATES = Object.freeze({
  IDLE: "idle",
  LOADING: "loading",
  MODEL_READY: "model-ready",
  RENDERING: "rendering",
  READY: "ready",
  ERROR: "error",
});

const VALID_ONTOLOGY_LIFECYCLE_STATES = new Set(
  Object.values(ONTOLOGY_LIFECYCLE_STATES),
);

export function isOntologyModelAvailable(ontologyLifecycleState) {
  return (
    ontologyLifecycleState === ONTOLOGY_LIFECYCLE_STATES.MODEL_READY ||
    ontologyLifecycleState === ONTOLOGY_LIFECYCLE_STATES.RENDERING ||
    ontologyLifecycleState === ONTOLOGY_LIFECYCLE_STATES.READY
  );
}

export function ontologyLifecycleCapabilitiesFor(ontologyLifecycleState) {
  if (!VALID_ONTOLOGY_LIFECYCLE_STATES.has(ontologyLifecycleState)) {
    throw new TypeError(
      "Unknown ontology lifecycle state: " + ontologyLifecycleState,
    );
  }

  const busy =
    ontologyLifecycleState === ONTOLOGY_LIFECYCLE_STATES.LOADING ||
    ontologyLifecycleState === ONTOLOGY_LIFECYCLE_STATES.MODEL_READY ||
    ontologyLifecycleState === ONTOLOGY_LIFECYCLE_STATES.RENDERING;
  return Object.freeze({
    graphControls: ontologyLifecycleState === ONTOLOGY_LIFECYCLE_STATES.READY,
    ontologySource: !busy,
    editorMode: !busy,
    dataModes: ontologyLifecycleState === ONTOLOGY_LIFECYCLE_STATES.READY,
  });
}
