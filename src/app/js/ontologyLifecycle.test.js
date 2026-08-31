const {
  capabilitiesFor,
  isModelAvailable,
  STATES,
} = require("./ontologyLifecycle");

describe("ontology lifecycle capabilities", () => {
  test.each([
    STATES.IDLE,
    STATES.LOADING,
    STATES.MODEL_READY,
    STATES.RENDERING,
    STATES.ERROR,
  ])("keeps graph controls disabled in %s", (state) => {
    expect(capabilitiesFor(state).graphControls).toBe(false);
  });

  test("enables graph controls only after rendering is ready", () => {
    expect(capabilitiesFor(STATES.READY).graphControls).toBe(true);
  });

  test.each([STATES.LOADING, STATES.MODEL_READY, STATES.RENDERING])(
    "prevents overlapping ontology loads and mode changes in %s",
    (state) => {
      const capabilities = capabilitiesFor(state);
      expect(capabilities.ontologySource).toBe(false);
      expect(capabilities.editorMode).toBe(false);
    },
  );

  test.each([STATES.IDLE, STATES.ERROR, STATES.READY])(
    "allows choosing an ontology source in %s",
    (state) => {
      expect(capabilitiesFor(state).ontologySource).toBe(true);
    },
  );

  test.each([STATES.MODEL_READY, STATES.RENDERING, STATES.READY])(
    "reports a parsed model as available in %s",
    (state) => {
      expect(isModelAvailable(state)).toBe(true);
    },
  );

  test("rejects unknown states", () => {
    expect(() => capabilitiesFor("almost-ready")).toThrow(TypeError);
  });
});
