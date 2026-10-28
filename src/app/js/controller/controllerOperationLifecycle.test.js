import { jest } from "@jest/globals";
import {
  CONTROLLER_APPLICATION_MEMBERS,
  CONTROLLER_OPERATION_CLASSES,
  createControllerOperationLifecycle,
} from "./controllerOperationLifecycle.js";
import { canonicalControllerHarness } from "../../test/canonicalControllerHarness.js";

function harness() {
  let identity = { loadGeneration: 1, documentRevision: 0 };
  const retirePresentation = jest.fn();
  const lifecycle = createControllerOperationLifecycle({
    readIdentity: () => identity,
    retirePresentation,
  });
  return {
    lifecycle,
    retirePresentation,
    revise() {
      identity = {
        ...identity,
        documentRevision: identity.documentRevision + 1,
      };
    },
    replace() {
      identity = {
        loadGeneration: identity.loadGeneration + 1,
        documentRevision: 0,
      };
    },
    begin(operation, options) {
      const ticket = lifecycle.prepare(operation, options);
      ticket.accept();
      return ticket;
    },
  };
}

test("every actual public member has exactly one document or application classification", async () => {
  const h = await canonicalControllerHarness();
  try {
    const document = Object.keys(CONTROLLER_OPERATION_CLASSES);
    const application = Object.keys(CONTROLLER_APPLICATION_MEMBERS);
    expect(document).toHaveLength(34);
    expect(application).toHaveLength(10);
    expect(document.filter((name) => application.includes(name))).toEqual([]);
    expect([...document, ...application].sort()).toEqual(
      Object.keys(h.controller).sort(),
    );
  } finally {
    h.controller.dispose();
  }
});

test.each(["refreshOntologySource", "applyOntologySourceUpdate"])(
  "%s retains the document read guard during a replacement",
  (operation) => {
    const h = harness();
    const ticket = h.begin("loadOntology");
    expect(() => h.lifecycle.check(operation)).toThrow(
      expect.objectContaining({ code: "LOAD_PENDING" }),
    );
    ticket.release();
  },
);

test("unaccepted scene work does not take the preceding view's ownership", () => {
  const h = harness();
  const first = h.begin("setVisualizationView");
  const candidate = h.lifecycle.prepare("resetVisualization");
  candidate.release();
  expect(first.isCurrent()).toBe(true);
  expect(first.signal.aborted).toBe(false);
  const successor = h.begin("resetVisualization");
  expect(first.isCurrent()).toBe(false);
  expect(first.signal.aborted).toBe(true);
  first.release();
  first.release();
  expect(successor.isCurrent()).toBe(true);
  successor.release();
});

test("caller cancellation stops waiting but preserves current publication ownership", () => {
  const h = harness();
  const caller = new AbortController();
  const ticket = h.begin("setVisualizationView", { signal: caller.signal });
  caller.abort();
  expect(() => ticket.assertCurrent()).toThrow();
  expect(ticket.isCurrent()).toBe(true);
  h.begin("setVisualizationModes");
  expect(ticket.isCurrent()).toBe(false);
});

test("load retirement and revision replacement prevent stale capture recovery", () => {
  const h = harness();
  const capture = h.begin("exportVisualization");
  h.revise();
  expect(capture.isCurrent()).toBe(false);
  capture.release();
  const next = h.begin("exportOriginalSource");
  const load = h.begin("loadOntology");
  expect(next.isCurrent()).toBe(false);
  expect(next.signal.aborted).toBe(true);
  h.replace();
  expect(load.isCurrent()).toBe(true);
  load.release();
  next.release();
});

test("an edit owns its committed revision, while view work belongs to its starting revision", () => {
  const h = harness();
  const edit = h.begin("editOntologyRecord");
  const view = h.begin("setVisualizationArrangement");
  expect(edit.isCurrent()).toBe(true);
  h.revise();
  expect(edit.isCurrent()).toBe(true);
  expect(view.isCurrent()).toBe(false);
  h.lifecycle.retireViews();
  expect(view.signal.aborted).toBe(true);
  h.lifecycle.dispose();
  expect(edit.isCurrent()).toBe(false);
  expect(edit.signal.aborted).toBe(true);
  expect(h.lifecycle.has("edit")).toBe(false);
});

test("pending load rejects document work with the accepted vocabulary", () => {
  const h = harness();
  const load = h.begin("loadOntology");
  for (const operation of [
    "getOntologyFacts",
    "setVisualizationView",
    "setVisualizationArrangement",
    "exportVisualization",
  ]) {
    expect(() => h.lifecycle.check(operation)).toThrow(
      expect.objectContaining({ code: "LOAD_PENDING", isRetryable: true }),
    );
  }
  expect(() => h.lifecycle.check("editOntologyRecord")).toThrow(
    expect.objectContaining({ code: "EDIT_REJECTED", isRetryable: false }),
  );
  load.release();
  expect(h.lifecycle.check("getOntologyFacts")).toEqual({
    loadGeneration: 1,
    documentRevision: 0,
  });
});

test("the two named exceptions retain explicit, different behavior", () => {
  const h = harness();
  const focus = h.lifecycle.prepare("setVisualizationView", {
    request: { focus: ["reference"] },
  });
  focus.prepareScene();
  expect(h.retirePresentation).not.toHaveBeenCalled();
  const visibility = h.lifecycle.prepare("setVisualizationView", {
    request: { nodesShown: { mode: "auto" } },
  });
  visibility.prepareScene();
  expect(h.retirePresentation).toHaveBeenCalledTimes(1);
  h.begin("editOntologyMetadata");
  expect(() => h.lifecycle.prepare("revealOntologyNeighborhood")).toThrow(
    expect.objectContaining({ code: "VIEW_REJECTED" }),
  );
  expect(() =>
    h.lifecycle.prepare("setVisualizationArrangement"),
  ).not.toThrow();
});

test("capture exclusion lasts until its retired work releases, with no stale release of a successor", () => {
  const h = harness();
  const first = h.begin("exportVisualization");
  h.lifecycle.retireCaptures();
  expect(() => h.begin("exportOriginalSource")).toThrow(
    expect.objectContaining({ code: "EXPORT_FAILED" }),
  );
  first.release();
  const second = h.begin("exportOriginalSource");
  first.release();
  expect(second.isCurrent()).toBe(true);
});
