import { jest } from "@jest/globals";
import { createLoadingProgressPresenter } from "./loadingProgressPresenter.js";

function setup() {
  const doc = { activeElement: null };
  class Element extends EventTarget {
    hidden = false;
    dataset = {};
    textContent = "";
    attributes = new Map();
    classes = new Set();
    classList = {
      add: (name) => this.classes.add(name),
      remove: (name) => this.classes.delete(name),
    };
    setAttribute(name, value) {
      this.attributes.set(name, String(value));
    }
    removeAttribute(name) {
      this.attributes.delete(name);
    }
    getAttribute(name) {
      return this.attributes.get(name) ?? null;
    }
    focus() {
      doc.activeElement = this;
    }
    click() {
      if (this.disabled) {
        return;
      }
      this.focus();
      this.dispatchEvent(new Event("click"));
    }
    contains(element) {
      for (let node = element; node; node = node.parentElement) {
        if (node === this) {
          return true;
        }
      }
      return false;
    }
  }
  const ids = [
    "loading-info",
    "loading-progress",
    "loading-compact",
    "currentLoadingStep",
    "loadingErrorMessage",
    "loading-primary-action",
    "loadingIndicator_closeButton",
    "loading-show-progress",
    "loadingInfo-container",
    "show-loadingInfo-button",
    "loading-announcement",
    "loading-elapsed",
    "loading-compact-elapsed",
    "ontology-menu-open",
    "bulletPoint_container",
    "loading-source-label",
    "loading-source-detail",
    "loading-current-activity",
    "loading-current-document",
    "loading-received",
    "loading-estimate",
    "loading-compact-title",
    ...["source", "reading", "drawing"].flatMap((name) =>
      ["", "-marker", "-description", "-progress"].map(
        (suffix) => `loading-stage-${name}${suffix}`,
      ),
    ),
  ];
  const elements = new Map(ids.map((id) => [id, new Element()]));
  const get = (id) => elements.get(id);
  doc.querySelector = (selector) => get(selector.slice(1));
  for (const [id, element] of elements) {
    if (id !== "loading-info" && id !== "ontology-menu-open") {
      element.parentElement = get("loading-info");
    }
  }
  let now = 0;
  let nextTimer = 0;
  const timers = new Map();
  const onCancel = jest.fn();
  const onChooseSource = jest.fn();
  const presenter = createLoadingProgressPresenter({
    documentObject: doc,
    onCancel,
    onChooseSource,
    clock: {
      now: () => now,
      setInterval: (callback) => {
        timers.set(++nextTimer, callback);
        return nextTimer;
      },
      clearInterval: (id) => timers.delete(id),
    },
  });
  presenter.setup();
  return {
    presenter,
    get,
    doc,
    onCancel,
    onChooseSource,
    timers,
    advance(ms) {
      now += ms;
      for (const callback of timers.values()) {
        callback();
      }
    },
  };
}
const loading = (changes = {}) => ({
  status: "loading",
  loadProgress: {
    requestId: 1,
    stage: "source",
    sourceLabel: "https://example.test/ontology",
    receivedDocumentCount: 0,
    receivedByteCount: 0,
    ...changes,
  },
});

test("stages and received counts are factual; elapsed time does not imply a percentage or ETA", () => {
  const h = setup();
  h.presenter.render(loading());
  h.advance(12000);
  h.presenter.render(
    loading({
      stage: "reading",
      receivedDocumentCount: 3,
      receivedByteCount: 4096,
    }),
  );
  expect(h.get("loading-elapsed").textContent).toBe("00:12 elapsed");
  expect(h.get("loading-stage-source").dataset.state).toBe("complete");
  expect(h.get("loading-stage-reading").dataset.state).toBe("active");
  expect(h.get("loading-stage-reading-description").textContent).toBe(
    "3 source documents received · 4.1 KB",
  );
  expect(h.get("loading-estimate").textContent).toBe(
    "Time remaining is not yet known",
  );
  for (const name of ["source", "reading", "drawing"]) {
    expect(
      h.get(`loading-stage-${name}-progress`).getAttribute("value"),
    ).toBeNull();
  }
  const announced = h.get("loading-announcement").textContent;
  h.advance(1000);
  h.presenter.render(
    loading({
      stage: "reading",
      receivedDocumentCount: 4,
      receivedByteCount: 8192,
    }),
  );
  expect(h.get("loading-announcement").textContent).toBe(announced);
  h.presenter.dispose();
  expect(h.timers.size).toBe(0);
});

test("Hide survives progress updates, keeps elapsed time and returns focus through Show progress", () => {
  const h = setup();
  h.presenter.render(loading());
  h.get("loadingIndicator_closeButton").click();
  h.advance(2000);
  h.presenter.render(loading({ stage: "reading" }));
  expect(h.get("loading-progress").hidden).toBe(true);
  expect(h.get("loading-compact").hidden).toBe(false);
  expect(h.get("loading-compact-elapsed").textContent).toBe("00:02 elapsed");
  expect(h.onCancel).not.toHaveBeenCalled();
  h.get("loading-show-progress").click();
  expect(h.get("loading-progress").hidden).toBe(false);
  expect(h.doc.activeElement).toBe(h.get("loadingIndicator_closeButton"));
  h.presenter.dispose();
});

test("cancel requests cancellation once and stops the timer when the controller restores its graph", () => {
  const h = setup();
  h.presenter.render(loading());
  h.get("loading-primary-action").click();
  h.get("loading-primary-action").click();
  expect(h.onCancel).toHaveBeenCalledTimes(1);
  expect(h.get("loading-primary-action").disabled).toBe(true);
  h.presenter.render({ status: "ready" });
  expect(h.presenter.isVisible()).toBe(false);
  expect(h.get("loading-announcement").textContent).toBe("Loading cancelled.");
  expect(h.doc.activeElement).toBe(h.get("ontology-menu-open"));
  expect(h.timers.size).toBe(0);
  h.presenter.dispose();
});

test("a collapsed failure clearly stops loading and offers its error and recovery", () => {
  const h = setup();
  h.presenter.render(loading());
  h.get("loadingIndicator_closeButton").click();
  h.presenter.render({
    ...loading(),
    status: "error",
    error: { message: "Source unavailable." },
  });
  expect(h.get("loading-progress").hidden).toBe(true);
  expect(h.get("loading-compact-title").textContent).toBe("Loading failed");
  expect(h.get("loading-show-progress").textContent).toBe("View error");
  expect(h.timers.size).toBe(0);
  h.get("loading-show-progress").click();
  expect(h.get("loading-progress").hidden).toBe(false);
  h.get("loading-primary-action").click();
  expect(h.onChooseSource).toHaveBeenCalledTimes(1);
  h.presenter.dispose();
});

test("Close survives unrelated error-state publications but a changed error or new attempt is shown", () => {
  const h = setup();
  const failed = {
    ...loading(),
    status: "error",
    error: { message: "Source unavailable." },
  };
  h.presenter.render(failed);
  h.get("loadingIndicator_closeButton").click();
  h.presenter.render({
    ...failed,
    warnings: ["Changed"],
    source: { identity: "accepted.owl" },
  });
  expect(h.presenter.isVisible()).toBe(false);
  h.presenter.render({ ...failed, error: { message: "Different failure." } });
  expect(h.presenter.isVisible()).toBe(true);
  h.get("loadingIndicator_closeButton").click();
  h.presenter.render(loading({ requestId: 2 }));
  expect(h.presenter.isVisible()).toBe(true);
  h.presenter.dispose();
});

test("errors without failed-request progress never name the previously accepted source", () => {
  const h = setup();
  h.presenter.render({
    status: "error",
    source: { identity: "accepted.owl" },
    error: { message: "Invalid link." },
  });
  expect(h.get("loading-source-detail").textContent).toBe(
    "No source is available",
  );
  h.presenter.dispose();
});

test("cancelling an attempt made after an earlier error dismisses progress without stranding recovery", () => {
  const h = setup();
  const error = {
    status: "error",
    error: { message: "Earlier source failed." },
  };
  h.presenter.render(error);
  h.presenter.render(loading());
  h.get("loading-primary-action").click();
  h.presenter.render(error);
  expect(h.presenter.isVisible()).toBe(false);
  expect(h.get("loading-announcement").textContent).toBe("Loading cancelled.");
  h.presenter.render({
    status: "error",
    error: { message: "Another source failed." },
  });
  expect(h.get("loading-primary-action").disabled).toBe(false);
  expect(h.get("loading-announcement").textContent).toContain(
    "Another source failed.",
  );
  h.presenter.dispose();
});

test("new requests reset collapsed state and elapsed time; errors keep their failed source and allow recovery", () => {
  const h = setup();
  h.presenter.render(loading());
  h.advance(65000);
  h.get("loadingIndicator_closeButton").click();
  h.presenter.render(loading({ requestId: 2, sourceLabel: "second.owl" }));
  expect(h.get("loading-elapsed").textContent).toBe("00:00 elapsed");
  expect(h.get("loading-progress").hidden).toBe(false);
  h.presenter.render({
    ...loading({ requestId: 2, sourceLabel: "second.owl", stage: "reading" }),
    status: "error",
    error: { message: "The document could not be read." },
    source: { identity: "old.owl" },
  });
  expect(h.get("loading-source-detail").textContent).toBe("second.owl");
  expect(h.get("loading-stage-reading").dataset.state).toBe("failed");
  expect(h.get("loading-stage-reading-progress").hidden).toBe(true);
  expect(h.get("loadingErrorMessage").textContent).toBe(
    "The document could not be read.",
  );
  h.get("loading-primary-action").click();
  expect(h.onChooseSource).toHaveBeenCalledTimes(1);
  h.get("loadingIndicator_closeButton").click();
  expect(h.presenter.isVisible()).toBe(false);
  h.presenter.dispose();
  h.presenter.render(loading({ requestId: 3 }));
  expect(h.timers.size).toBe(0);
});
