import { expect, jest, test } from "@jest/globals";
import { createSelectedOccurrencePreview } from "./selectedOccurrencePreview.js";

function setup() {
  const frames = new Map();
  let nextFrame = 0;
  let observer;
  let current = {
    status: "ready",
    loadGeneration: 1,
    documentRevision: 0,
    selection: [{}],
  };
  let observation;
  const rectangle = { left: 0, top: 0, width: 1200, height: 800 };
  const measure = jest.fn(() => rectangle);
  const style = { setProperty: jest.fn() };
  const cancelled = jest.fn();
  const preview = {
    hidden: false,
    offsetWidth: 320,
    offsetHeight: 160,
    dataset: {},
    style,
    contains: () => false,
    animate: jest.fn(() => ({ cancel: cancelled })),
  };
  const note = { textContent: "" };
  const doc = Object.assign(new EventTarget(), {
    hidden: false,
    activeElement: null,
    getElementById: (id) =>
      ({
        "entity-preview": preview,
        graph: { getBoundingClientRect: measure },
        canvasArea: { getBoundingClientRect: measure },
        "entity-preview-visibility": note,
      })[id],
  });
  const reduced = Object.assign(new EventTarget(), { matches: false });
  const disconnected = jest.fn();
  const win = Object.assign(new EventTarget(), {
    innerWidth: 1200,
    matchMedia: () => reduced,
    getComputedStyle: () => ({ transform: "matrix(1, 0, 0, 1, 100, 200)" }),
    requestAnimationFrame: (callback) => {
      frames.set(++nextFrame, callback);
      return nextFrame;
    },
    cancelAnimationFrame: (id) => frames.delete(id),
    ResizeObserver: class {
      observe() {}
      disconnect() {
        disconnected();
      }
    },
  });
  const unsubscribe = jest.fn();
  const controller = {
    getState: () => current,
    getSelectedVisualizationOccurrence: jest.fn(() => observation),
    subscribeToSelectedVisualizationOccurrence: (callback) => {
      observer = callback;
      return unsubscribe;
    },
  };
  const presenter = createSelectedOccurrencePreview({
    controller,
    documentObject: doc,
    windowObject: win,
  });
  return {
    presenter,
    frames,
    doc,
    win,
    note,
    preview,
    reduced,
    measure,
    cancelled,
    disconnected,
    unsubscribe,
    controller,
    state(value) {
      current = { ...current, ...value };
    },
    emit(value) {
      observation = value;
      observer(value);
    },
    flush() {
      const pending = [...frames.values()];
      frames.clear();
      pending.forEach((callback) => callback());
    },
  };
}
const anchor = (xPx, extra = {}) => ({
  loadGeneration: 1,
  documentRevision: 0,
  reference: { loadGeneration: 1, occurrenceId: "selected" },
  coordinateSpace: "graph-viewport-css-pixels",
  xPx,
  yPx: 400,
  widthPx: 40,
  heightPx: 40,
  shape: "rectangle",
  occurrenceCount: 1,
  ...extra,
});

test.each([1000, 10000])(
  "%i observations queue one placement and no repeated box reads",
  (count) => {
    const h = setup();
    h.emit(anchor(200));
    h.flush();
    h.measure.mockClear();
    h.preview.style.setProperty.mockClear();
    for (let i = 0; i < count; i++) {
      h.emit(anchor(1000 + (i % 10)));
    }
    expect(h.frames.size).toBe(1);
    h.flush();
    expect(h.measure).not.toHaveBeenCalled();
    expect(
      h.controller.getSelectedVisualizationOccurrence,
    ).not.toHaveBeenCalled();
    expect(h.preview.style.setProperty).toHaveBeenCalledTimes(1);
    const target = h.preview.style.setProperty.mock.calls[0][1];
    expect(target).toBe("translate(649px, 320px)");
    expect(h.cancelled).toHaveBeenCalledTimes(1);
    h.presenter.dispose();
  },
);

test("hidden tabs cancel frames and resume from one fresh observation", () => {
  const h = setup();
  h.emit(anchor(200));
  h.doc.hidden = true;
  h.doc.dispatchEvent(new Event("visibilitychange"));
  expect(h.frames.size).toBe(0);
  h.emit(anchor(950));
  expect(h.frames.size).toBe(0);
  h.doc.hidden = false;
  h.doc.dispatchEvent(new Event("visibilitychange"));
  expect(h.controller.getSelectedVisualizationOccurrence).toHaveBeenCalledTimes(
    1,
  );
  h.flush();
  expect(h.preview.style.setProperty).toHaveBeenCalledTimes(1);
  h.presenter.dispose();
});

test("new presentation content is placed in its current frame before paint", () => {
  const h = setup();
  h.emit(anchor(200));
  h.flush();
  h.measure.mockClear();
  h.preview.style.setProperty.mockClear();
  h.emit(anchor(1000));
  h.preview.offsetHeight = 240;
  expect(h.frames.size).toBe(1);
  h.presenter.refresh({ immediate: true });
  expect(h.frames.size).toBe(0);
  expect(h.preview.style.setProperty).toHaveBeenCalledWith(
    "--entity-preview-transform",
    "translate(640px, 280px)",
  );
  expect(h.measure).toHaveBeenCalledTimes(2);
  h.presenter.dispose();
});

test("a hidden preview cancels pending work and does not read geometry until shown", () => {
  const h = setup();
  h.emit(anchor(200));
  h.flush();
  h.emit(anchor(300));
  h.preview.hidden = true;
  h.presenter.refresh();
  expect(h.frames.size).toBe(0);
  expect(h.cancelled).toHaveBeenCalledTimes(1);
  for (let i = 0; i < 10000; i++) {
    h.emit(anchor(i));
  }
  expect(h.frames.size).toBe(0);
  expect(
    h.controller.getSelectedVisualizationOccurrence,
  ).not.toHaveBeenCalled();
  h.preview.hidden = false;
  h.presenter.refresh();
  expect(h.controller.getSelectedVisualizationOccurrence).toHaveBeenCalledTimes(
    1,
  );
  expect(h.frames.size).toBe(1);
  h.presenter.dispose();
});

test.each([null, anchor(-200), anchor(200, { documentRevision: 9 })])(
  "missing, offscreen and stale anchors use an immediate fallback",
  (observation) => {
    const h = setup();
    h.emit(anchor(200));
    h.flush();
    h.preview.animate.mockClear();
    h.emit(observation);
    h.flush();
    expect(h.preview.animate).not.toHaveBeenCalled();
    expect(h.cancelled).toHaveBeenCalled();
    h.presenter.dispose();
  },
);

test("stale revisions lose their anchor, reduced motion is immediate, disposal releases work", () => {
  const h = setup();
  h.reduced.matches = true;
  h.emit(anchor(200));
  h.flush();
  expect(h.preview.animate).not.toHaveBeenCalled();
  h.state({ documentRevision: 1 });
  h.emit(anchor(250));
  h.flush();
  expect(h.note.textContent).toBe("Not shown in the current view");
  h.emit(anchor(800, { documentRevision: 1 }));
  expect(h.frames.size).toBe(1);
  h.presenter.dispose();
  expect(h.frames.size).toBe(0);
  expect(h.unsubscribe).toHaveBeenCalledTimes(1);
  expect(h.disconnected).toHaveBeenCalledTimes(1);
  h.doc.dispatchEvent(new Event("visibilitychange"));
  expect(h.frames.size).toBe(0);
});
