import { beforeAll, describe, expect, test } from "@jest/globals";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { SourceTextModule } from "node:vm";

let ONTOLOGY_LIFECYCLE_STATES;
let isOntologyModelAvailable;
let ontologyLifecycleCapabilitiesFor;

beforeAll(async () => {
  const moduleUrl = new URL("./ontologyLifecycle.js", import.meta.url);
  const sourceModule = new SourceTextModule(
    readFileSync(fileURLToPath(moduleUrl), "utf8"),
    { identifier: moduleUrl.href },
  );
  await sourceModule.link((specifier) => {
    throw new Error(`Unexpected ontology-lifecycle dependency: ${specifier}`);
  });
  await sourceModule.evaluate();
  ({
    ONTOLOGY_LIFECYCLE_STATES,
    isOntologyModelAvailable,
    ontologyLifecycleCapabilitiesFor,
  } = sourceModule.namespace);
});

describe("ontology lifecycle capabilities", () => {
  test.each(["IDLE", "LOADING", "MODEL_READY", "RENDERING", "ERROR"])(
    "keeps graph controls disabled in %s",
    (stateName) => {
      const state = ONTOLOGY_LIFECYCLE_STATES[stateName];
      expect(ontologyLifecycleCapabilitiesFor(state).graphControls).toBe(false);
    },
  );

  test("enables graph controls only after rendering is ready", () => {
    expect(
      ontologyLifecycleCapabilitiesFor(ONTOLOGY_LIFECYCLE_STATES.READY)
        .graphControls,
    ).toBe(true);
  });

  test.each(["LOADING", "MODEL_READY", "RENDERING"])(
    "prevents overlapping ontology loads and mode changes in %s",
    (stateName) => {
      const state = ONTOLOGY_LIFECYCLE_STATES[stateName];
      const capabilities = ontologyLifecycleCapabilitiesFor(state);
      expect(capabilities.ontologySource).toBe(false);
      expect(capabilities.editorMode).toBe(false);
    },
  );

  test.each(["IDLE", "ERROR", "READY"])(
    "allows choosing an ontology source in %s",
    (stateName) => {
      const state = ONTOLOGY_LIFECYCLE_STATES[stateName];
      expect(ontologyLifecycleCapabilitiesFor(state).ontologySource).toBe(true);
    },
  );

  test.each(["MODEL_READY", "RENDERING", "READY"])(
    "reports a parsed model as available in %s",
    (stateName) => {
      const state = ONTOLOGY_LIFECYCLE_STATES[stateName];
      expect(isOntologyModelAvailable(state)).toBe(true);
    },
  );

  test("rejects unknown states", () => {
    expect(() => ontologyLifecycleCapabilitiesFor("almost-ready")).toThrow(
      "Unknown ontology lifecycle state: almost-ready",
    );
  });
});
