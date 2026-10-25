import { afterEach, beforeEach, expect, jest, test } from "@jest/globals";
import { createRenderedGraphPanCache } from "./renderedGraphPanCache.js";
import { buildRenderedSvgPanSnapshot } from "./renderedSvgPanSnapshot.js";

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

test.each([true, false])(
  "snapshot cancellation settles an idle wait and releases its scheduled callback (idle API: %s)",
  async (idle) => {
    const controller = new AbortController();
    const cancel = jest.fn((handle) => clearTimeout(handle));
    const view = { setTimeout, clearTimeout: cancel };
    if (idle) {
      view.requestIdleCallback = (callback) => setTimeout(callback, 5000);
      view.cancelIdleCallback = cancel;
    }
    const svg = {
      ownerDocument: { defaultView: view },
      querySelector: () => null,
    };
    const result = buildRenderedSvgPanSnapshot({
      svg,
      viewport: { width: 800, height: 600, dpr: 1 },
      signal: controller.signal,
    });
    controller.abort();
    await expect(result).rejects.toHaveProperty("name", "AbortError");
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  },
);

test("oversized snapshots fail before cloning or allocating image memory", async () => {
  const svg = { ownerDocument: { defaultView: {} }, querySelector: jest.fn() };
  await expect(
    buildRenderedSvgPanSnapshot({
      svg,
      viewport: { width: 4000, height: 3000, dpr: 3 },
      signal: new AbortController().signal,
    }),
  ).rejects.toThrow("pixel budget");
  expect(svg.querySelector).not.toHaveBeenCalled();
});

// The browser delivers mutation records asynchronously. Keeping that delivery
// separate is essential: an input can request the cache before the callback.
function harness() {
  const observers = [];
  function mutation(record) {
    for (const observer of observers) {
      if (
        observer.targets.some(
          ({ target, options }) =>
            (target === record.target ||
              (options.subtree && target.contains(record.target))) &&
            options[record.type],
        )
      ) {
        observer.records.push(record);
      }
    }
  }
  function element(name) {
    const node = new EventTarget();
    const attributes = new Map();
    const properties = new Map();
    Object.assign(node, {
      localName: name,
      children: [],
      scrollLeft: 0,
      scrollTop: 0,
      clientLeft: 0,
      clientTop: 0,
      getBoundingClientRect: () => ({
        left: 0,
        top: 0,
        width: 800,
        height: 600,
      }),
      isConnected: true,
      getAttribute: (key) => attributes.get(key) ?? null,
      setAttribute(key, value) {
        const oldValue = node.getAttribute(key);
        attributes.set(key, String(value));
        mutation({
          target: node,
          type: "attributes",
          attributeName: key,
          oldValue,
        });
      },
      contains(other) {
        return (
          node === other || node.children.some((child) => child.contains(other))
        );
      },
      append(child) {
        node.children.push(child);
        child.parentElement = node;
        mutation({ target: node, type: "childList" });
      },
      remove() {
        if (!node.parentElement) {
          return;
        }
        node.parentElement.children = node.parentElement.children.filter(
          (child) => child !== node,
        );
        mutation({ target: node.parentElement, type: "childList" });
        node.parentElement = undefined;
      },
      getAnimations: () => [],
      classList: {
        contains(value) {
          return (node.getAttribute("class") ?? "")
            .split(/\s+/)
            .includes(value);
        },
        add(value) {
          node.setAttribute(
            "class",
            [
              ...new Set([
                ...(node.getAttribute("class") ?? "")
                  .split(/\s+/)
                  .filter(Boolean),
                value,
              ]),
            ].join(" "),
          );
        },
        remove(value) {
          node.setAttribute(
            "class",
            (node.getAttribute("class") ?? "")
              .split(/\s+/)
              .filter((item) => item !== value)
              .join(" "),
          );
        },
      },
      style: {
        getPropertyValue: (key) => properties.get(key)?.value ?? "",
        getPropertyPriority: (key) => properties.get(key)?.priority ?? "",
        setProperty(key, value, priority = "") {
          properties.set(key, { value, priority });
          node.setAttribute(
            "style",
            [...properties].map(([k, v]) => `${k}:${v.value}`).join(";"),
          );
        },
        removeProperty(key) {
          properties.delete(key);
          node.setAttribute(
            "style",
            [...properties].map(([k, v]) => `${k}:${v.value}`).join(";"),
          );
        },
      },
    });
    return node;
  }
  const view = new EventTarget();
  const media = [];
  Object.assign(view, {
    setTimeout,
    clearTimeout,
    AbortController,
    CSS: { supports: () => true },
    devicePixelRatio: 1,
    Image: class {
      decode() {}
    },
    URL: { createObjectURL() {} },
    getComputedStyle: () => ({ position: "static" }),
    MutationObserver: class {
      constructor(callback) {
        this.callback = callback;
        this.targets = [];
        this.records = [];
        observers.push(this);
      }
      observe(target, options) {
        this.targets.push({ target, options });
      }
      takeRecords() {
        return this.records.splice(0);
      }
      disconnect() {
        this.targets = [];
        this.records = [];
      }
    },
    matchMedia(query) {
      const target = new EventTarget();
      target.query = query;
      media.push(target);
      return target;
    },
  });
  const document = new EventTarget();
  Object.assign(document, {
    defaultView: view,
    visibilityState: "visible",
    fonts: new EventTarget(),
    head: element("head"),
  });
  document.fonts.status = "loaded";
  const parent = element("div"),
    svg = element("svg"),
    scene = element("g"),
    node = element("circle");
  svg.ownerDocument = document;
  parent.append(svg);
  svg.append(scene);
  scene.append(node);
  svg.setAttribute("width", "800");
  svg.setAttribute("height", "600");
  let stable = true;
  const camera = { x: 0, y: 0, k: 1 };
  const jobs = [];
  const buildSnapshot = jest.fn(
    ({ signal, viewport }) =>
      new Promise((resolve, reject) => {
        const canvas = element("canvas");
        canvas.width = 1312;
        canvas.height = 1112;
        const snapshot = {
          canvas,
          viewport,
          padding: 256,
          dispose: jest.fn(() => {
            canvas.remove();
            canvas.width = canvas.height = 0;
          }),
        };
        jobs.push({
          signal,
          resolve: () => resolve(snapshot),
          reject,
          snapshot,
        });
      }),
  );
  const cache = createRenderedGraphPanCache({
    svg,
    scene,
    isStable: () => stable,
    readViewport: () => ({ ...camera }),
    buildSnapshot,
  });
  return {
    cache,
    svg,
    scene,
    node,
    parent,
    view,
    document,
    media,
    jobs,
    camera,
    buildSnapshot,
    stable(value) {
      stable = value;
      cache.refresh();
    },
    deliver() {
      for (const observer of observers) {
        const records = observer.takeRecords();
        if (records.length) {
          observer.callback(records);
        }
      }
    },
    async start() {
      await jest.advanceTimersByTimeAsync(201);
    },
    async ready() {
      await this.start();
      jobs.at(-1).resolve();
      await Promise.resolve();
      await Promise.resolve();
      return jobs.at(-1).snapshot;
    },
  };
}

test("prepares before panning, preserves the live input tree, and restores it on release", async () => {
  const h = harness();
  expect(h.buildSnapshot).not.toHaveBeenCalled();
  const snapshot = await h.ready();
  expect(snapshot.canvas.hidden).toBe(true);
  expect(snapshot.canvas.style.getPropertyValue("--vowl-pan-left")).toBe(
    "-256px",
  );
  expect(snapshot.canvas.style.getPropertyValue("--vowl-pan-top")).toBe(
    "-256px",
  );
  h.cache.beginPan();
  h.camera.x = 40;
  h.cache.viewportChanged();
  expect(snapshot.canvas.hidden).toBe(false);
  expect(snapshot.canvas.style.getPropertyValue("--vowl-pan-x")).toBe("40px");
  expect(h.scene.classList.contains("vowl-pan-cache-active")).toBe(true);
  expect(h.scene.getAttribute("aria-hidden")).toBeNull();
  expect(snapshot.canvas.getAttribute("aria-hidden")).toBe("true");
  expect(snapshot.canvas.classList.contains("vowl-pan-cache")).toBe(true);
  h.cache.endPan();
  expect(h.scene.style.getPropertyValue("opacity")).toBe("");
  expect(snapshot.canvas.hidden).toBe(true);
  await h.start();
  expect(h.buildSnapshot).toHaveBeenCalledTimes(1);
  h.cache.dispose();
});

test("a browser without viewport-relative clipping keeps the ordinary SVG renderer", async () => {
  const h = harness();
  h.cache.dispose();
  h.view.CSS.supports = () => false;
  const cache = createRenderedGraphPanCache({
    svg: h.svg,
    scene: h.scene,
    isStable: () => true,
    readViewport: () => h.camera,
    buildSnapshot: h.buildSnapshot,
  });
  cache.refresh();
  await h.start();
  cache.beginPan();
  cache.viewportChanged();
  expect(h.buildSnapshot).not.toHaveBeenCalled();
  expect(h.scene.classList.contains("vowl-pan-cache-active")).toBe(false);
  expect(cache.withLiveDrawing(() => "live")).toBe("live");
  cache.dispose();
});

test("panning during preparation aborts work; its late completion cannot cover the graph", async () => {
  const h = harness();
  await h.start();
  const old = h.jobs[0];
  h.cache.beginPan();
  expect(old.signal.aborted).toBe(true);
  old.resolve();
  await Promise.resolve();
  expect(old.snapshot.dispose).toHaveBeenCalled();
  expect(h.parent.children).toEqual([h.svg]);
  h.cache.endPan();
  await h.ready();
  expect(h.buildSnapshot).toHaveBeenCalledTimes(2);
  h.cache.dispose();
});

test("focusing the viewport on press retains its cache; focus inside the drawing invalidates it", async () => {
  const h = harness();
  const snapshot = await h.ready();
  h.svg.dispatchEvent(new Event("focusin"));
  h.cache.beginPan();
  h.cache.viewportChanged();
  expect(snapshot.canvas.hidden).toBe(false);
  const event = new Event("focusin");
  Object.defineProperty(event, "target", { value: h.node });
  h.svg.dispatchEvent(event);
  expect(snapshot.dispose).toHaveBeenCalled();
  expect(h.scene.classList.contains("vowl-pan-cache-active")).toBe(false);
  h.cache.dispose();
});

test("entering the empty viewport retains preparation; entering drawing content invalidates it", async () => {
  const h = harness();
  const snapshot = await h.ready();
  h.svg.dispatchEvent(new Event("pointerover"));
  h.svg.dispatchEvent(new Event("pointerout"));
  expect(snapshot.dispose).not.toHaveBeenCalled();
  const event = new Event("pointerover");
  Object.defineProperty(event, "target", { value: h.node });
  h.svg.dispatchEvent(event);
  expect(snapshot.dispose).toHaveBeenCalled();
  h.cache.dispose();
});

test("a decoder that never completes times out without retrying or publishing later", async () => {
  const h = harness();
  await h.start();
  await jest.advanceTimersByTimeAsync(10_000);
  expect(h.jobs[0].signal.aborted).toBe(true);
  h.jobs[0].resolve();
  await Promise.resolve();
  expect(h.jobs[0].snapshot.dispose).toHaveBeenCalled();
  h.cache.refresh();
  await h.start();
  expect(h.buildSnapshot).toHaveBeenCalledTimes(1);
  h.cache.dispose();
});

test("an invalidated decode completing after its replacement cannot replace or dispose that replacement", async () => {
  const h = harness();
  await h.start();
  const old = h.jobs[0];
  h.cache.invalidate();
  const current = await h.ready();
  old.resolve();
  await Promise.resolve();
  h.cache.beginPan();
  h.cache.viewportChanged();
  expect(old.signal.aborted).toBe(true);
  expect(old.snapshot.dispose).toHaveBeenCalled();
  expect(current.dispose).not.toHaveBeenCalled();
  expect(current.canvas.hidden).toBe(false);
  h.cache.dispose();
});

test("flushes pending selection/style mutations before displaying a ready image", async () => {
  const h = harness();
  const snapshot = await h.ready();
  h.node.setAttribute("class", "focused");
  h.cache.beginPan();
  h.cache.viewportChanged();
  expect(snapshot.dispose).toHaveBeenCalled();
  expect(h.scene.style.getPropertyValue("opacity")).toBe("");
  h.cache.dispose();
});

test("a pending theme change cannot be missed by a completed build", async () => {
  const h = harness();
  await h.start();
  h.parent.setAttribute("class", "contrast");
  h.jobs[0].resolve();
  await Promise.resolve();
  expect(h.jobs[0].snapshot.dispose).toHaveBeenCalled();
  expect(h.parent.children).toEqual([h.svg]);
  h.cache.dispose();
});

test.each([
  "node",
  "font",
  "resize",
  "theme",
  "resolution",
  "hidden",
  "animation",
])(
  "%s invalidation restores a displayed cache and cancels stale work",
  async (kind) => {
    const h = harness();
    const snapshot = await h.ready();
    h.cache.beginPan();
    h.cache.viewportChanged();
    if (kind === "node") {
      h.node.setAttribute("cx", "8");
      h.deliver();
    }
    if (kind === "font") {
      h.document.fonts.dispatchEvent(new Event("loadingdone"));
    }
    if (kind === "resize") {
      h.view.dispatchEvent(new Event("resize"));
    }
    if (kind === "theme") {
      h.media[0].dispatchEvent(new Event("change"));
    }
    if (kind === "resolution") {
      h.view.devicePixelRatio = 2;
      h.media.at(-1).dispatchEvent(new Event("change"));
    }
    if (kind === "hidden") {
      h.document.visibilityState = "hidden";
      h.document.dispatchEvent(new Event("visibilitychange"));
    }
    if (kind === "animation") {
      h.svg.dispatchEvent(new Event("animationstart"));
    }
    expect(snapshot.dispose).toHaveBeenCalled();
    expect(h.scene.style.getPropertyValue("opacity")).toBe("");
    h.cache.dispose();
  },
);

test.each(["zoom", "width", "height", "dpr", "coverage"])(
  "%s change rejects the old snapshot",
  async (kind) => {
    const h = harness();
    const snapshot = await h.ready();
    h.cache.beginPan();
    if (kind === "zoom") {
      h.camera.k = 2;
    }
    if (kind === "width") {
      h.svg.setAttribute("width", "900");
    }
    if (kind === "height") {
      h.svg.setAttribute("height", "700");
    }
    if (kind === "dpr") {
      h.view.devicePixelRatio = 2;
    }
    if (kind === "coverage") {
      h.camera.x = 257;
    }
    h.cache.viewportChanged();
    expect(snapshot.dispose).toHaveBeenCalled();
    expect(h.scene.style.getPropertyValue("opacity")).toBe("");
    h.cache.dispose();
  },
);

test("running layout never prepares a snapshot and resuming layout retires a ready one", async () => {
  const h = harness();
  h.stable(false);
  await h.start();
  expect(h.buildSnapshot).not.toHaveBeenCalled();
  h.stable(true);
  const snapshot = await h.ready();
  h.cache.beginPan();
  h.cache.viewportChanged();
  h.stable(false);
  expect(snapshot.dispose).toHaveBeenCalled();
  expect(h.scene.style.getPropertyValue("opacity")).toBe("");
  h.cache.dispose();
});

test("a silent device-density change is rejected on press before any cached paint", async () => {
  const h = harness();
  const snapshot = await h.ready();
  h.view.devicePixelRatio = 2;
  h.cache.beginPan();
  expect(snapshot.dispose).toHaveBeenCalled();
  expect(h.scene.classList.contains("vowl-pan-cache-active")).toBe(false);
  h.cache.endPan();
  await h.ready();
  expect(h.jobs.at(-1).snapshot.viewport.dpr).toBe(2);
  h.cache.dispose();
});

test("a failed high-density attempt can recover after a silent resolution change", async () => {
  const h = harness();
  h.view.devicePixelRatio = 3;
  await h.start();
  h.jobs[0].reject(new Error("pixel budget"));
  await Promise.resolve();
  h.view.devicePixelRatio = 1;
  h.cache.beginPan();
  h.cache.endPan();
  await h.ready();
  expect(h.buildSnapshot).toHaveBeenCalledTimes(2);
  expect(h.jobs[1].snapshot.viewport.dpr).toBe(1);
  h.cache.dispose();
});

test("export sees live opacity, preserves unrelated styles, and restores even after an exception", async () => {
  const h = harness();
  h.scene.style.setProperty("opacity", ".8", "important");
  const snapshot = await h.ready();
  h.cache.beginPan();
  h.cache.viewportChanged();
  expect(() =>
    h.cache.withLiveDrawing(() => {
      expect(h.scene.style.getPropertyValue("opacity")).toBe(".8");
      expect(h.scene.style.getPropertyPriority("opacity")).toBe("important");
      expect(snapshot.canvas.hidden).toBe(true);
      throw new Error("export failed");
    }),
  ).toThrow("export failed");
  expect(snapshot.canvas.hidden).toBe(false);
  h.scene.style.setProperty("color", "blue");
  h.deliver();
  expect(h.scene.style.getPropertyValue("color")).toBe("blue");
  expect(h.scene.style.getPropertyValue("opacity")).toBe(".8");
  h.cache.dispose();
});

test("failure falls back without an automatic retry loop; a changed scene can retry", async () => {
  const h = harness();
  await h.start();
  h.jobs[0].reject(new Error("decode failed"));
  await Promise.resolve();
  h.cache.refresh();
  await h.start();
  expect(h.buildSnapshot).toHaveBeenCalledTimes(1);
  expect(h.parent.children).toEqual([h.svg]);
  h.cache.invalidate();
  await h.ready();
  expect(h.buildSnapshot).toHaveBeenCalledTimes(2);
  h.cache.dispose();
});

test("disposal aborts in-flight work and removes owned resources and subscriptions", async () => {
  const h = harness();
  await h.start();
  h.cache.dispose();
  h.cache.dispose();
  expect(h.jobs[0].signal.aborted).toBe(true);
  h.jobs[0].resolve();
  await Promise.resolve();
  expect(h.jobs[0].snapshot.dispose).toHaveBeenCalled();
  expect(h.parent.children).toEqual([h.svg]);
  expect(h.parent.style.getPropertyValue("position")).toBe("");
  h.document.fonts.dispatchEvent(new Event("loadingdone"));
  h.view.dispatchEvent(new Event("resize"));
  h.cache.refresh();
  await h.start();
  expect(h.buildSnapshot).toHaveBeenCalledTimes(1);
  expect(jest.getTimerCount()).toBe(0);
});
