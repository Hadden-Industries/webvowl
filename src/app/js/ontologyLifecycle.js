const STATES = Object.freeze({
  IDLE: "idle",
  LOADING: "loading",
  MODEL_READY: "model-ready",
  RENDERING: "rendering",
  READY: "ready",
  ERROR: "error"
});

const VALID_STATES = new Set(Object.values(STATES));

function isModelAvailable( state ){
  return state === STATES.MODEL_READY || state === STATES.RENDERING || state === STATES.READY;
}

function capabilitiesFor( state ){
  if ( !VALID_STATES.has(state) ) {
    throw new TypeError("Unknown ontology lifecycle state: " + state);
  }

  const busy = state === STATES.LOADING || state === STATES.MODEL_READY || state === STATES.RENDERING;
  return Object.freeze({
    graphControls: state === STATES.READY,
    ontologySource: !busy,
    editorMode: !busy,
    dataModes: state === STATES.READY
  });
}

module.exports = {
  STATES,
  capabilitiesFor,
  isModelAvailable
};
