import { expect, jest, test } from "@jest/globals";
import { createSelectionPresentationScheduler } from "./selectionPresentationScheduler.js";

function setup() {
  const frames = new Map();
  let next = 0;
  const describe = jest.fn((request) => ({
    elementDescriptions: request.ontologyElementReferences,
  }));
  const render = jest.fn();
  const scheduler = createSelectionPresentationScheduler({
    describe,
    render,
    requestFrame: (callback) => {
      frames.set(++next, callback);
      return next;
    },
    cancelFrame: (id) => frames.delete(id),
  });
  return {
    scheduler,
    describe,
    render,
    frames,
    flush() {
      const callbacks = [...frames.values()];
      frames.clear();
      callbacks.forEach((fn) => fn());
    },
  };
}
const state = (name, more = {}) => ({
  status: "ready",
  loadGeneration: 1,
  documentRevision: 0,
  view: { language: "en" },
  selection: [{ kind: "class", iri: "urn:" + name }],
  ...more,
});

test("one hundred rapid selections cause one read of the final selection", () => {
  const h = setup();
  for (let i = 0; i < 100; i++) {
    h.scheduler.schedule(state(i));
  }
  expect(h.frames.size).toBe(1);
  h.flush();
  expect(h.describe).toHaveBeenCalledTimes(1);
  expect(h.render).toHaveBeenCalledWith([{ kind: "class", iri: "urn:99" }]);
});

test.each(["loading", "idle", "disposed"])(
  "%s cancels the queued generation",
  (status) => {
    const h = setup();
    h.scheduler.schedule(state("old"));
    h.scheduler.schedule(state("new", { status, selection: [] }));
    h.flush();
    expect(h.describe).not.toHaveBeenCalled();
    expect(h.render).toHaveBeenCalledWith([]);
  },
);

test("a revision changed during a read cannot apply its old result", () => {
  const h = setup();
  h.describe.mockImplementation(() => {
    h.scheduler.observe(state("new", { documentRevision: 1 }));
    return { elementDescriptions: ["stale"] };
  });
  h.scheduler.schedule(state("old"));
  h.flush();
  expect(h.render).not.toHaveBeenCalled();
});

test("an unrelated state publication with equivalent selection keeps the current read", () => {
  const h = setup();
  h.describe.mockImplementation(() => {
    h.scheduler.observe(state("same", { zoomScale: 2 }));
    return { elementDescriptions: ["current"] };
  });
  h.scheduler.schedule(state("same"));
  h.flush();
  expect(h.render).toHaveBeenCalledWith(["current"]);
});

test("LOAD_PENDING clears presentation without retrying, and disposal releases frames", () => {
  const h = setup();
  h.describe.mockImplementation(() => {
    throw Object.assign(new Error(), { code: "LOAD_PENDING" });
  });
  h.scheduler.schedule(state("one"));
  h.flush();
  expect(h.frames.size).toBe(0);
  expect(h.render).toHaveBeenCalledWith([]);
  h.scheduler.schedule(state("two"));
  h.scheduler.dispose();
  h.flush();
  expect(h.describe).toHaveBeenCalledTimes(1);
});
