import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

// Serialized diagnostic code. It observes actual production DOM/primitives and
// native measurement ports; it never changes the renderer's reuse decision.
function installReuseProbe() {
  const {
    document,
    Element,
    HTMLElement,
    SVGGraphicsElement,
    getComputedStyle,
  } = globalThis;
  let previous = new Map();
  let retainedControl;
  const tracked = [];
  const seen = new WeakSet();
  const counts = { created: 0, widths: 0, boxes: 0 };
  const create = document.createElementNS;
  const width = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    "offsetWidth",
  );
  const box = SVGGraphicsElement.prototype.getBBox;
  document.createElementNS = function (...args) {
    counts.created++;
    return create.apply(this, args);
  };
  Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
    ...width,
    get() {
      if (this.classList.contains("text-measurement-probe")) counts.widths++;
      return width.get.call(this);
    },
  });
  SVGGraphicsElement.prototype.getBBox = function (...args) {
    counts.boxes++;
    return box.apply(this, args);
  };
  function current() {
    return new Map(
      [
        ...document.querySelectorAll(
          "#graph .nodeContainer > g.node, #graph .labelContainer > g.labelGroup, #graph .linkContainer > g.link",
        ),
      ].map((dom) => {
        const data = dom.__data__;
        const primitive =
          typeof data.property === "function" ? data.property() : data;
        return [
          JSON.stringify([
            dom.getAttribute("class"),
            primitive.type(),
            primitive.id(),
          ]),
          { dom, data },
        ];
      }),
    );
  }
  function sample() {
    const next = current();
    let retained = 0;
    let replaced = 0;
    for (const [key, value] of next) {
      if (
        previous.get(key)?.dom === value.dom &&
        previous.get(key)?.data === value.data
      )
        retained++;
      else if (previous.has(key)) replaced++;
      for (const [kind, target] of [
        ["dom", value.dom],
        ["primitive", value.data],
      ]) {
        if (!seen.has(target)) {
          seen.add(target);
          tracked.push({ key, kind, ref: new WeakRef(target) });
        }
      }
    }
    previous = next;
    const result = { ...counts, retained, replaced, live: next.size };
    Object.assign(counts, { created: 0, widths: 0, boxes: 0 });
    return result;
  }
  globalThis.__webvowlReuseProbe = {
    sample,
    retainControl() {
      retainedControl = [...current().values()][0];
    },
    releaseControl() {
      retainedControl = undefined;
    },
    status() {
      const live = new Set(
        [...current().values()].flatMap(({ dom, data }) => [dom, data]),
      );
      let retiredAlive = 0,
        alive = 0;
      for (const { ref } of tracked) {
        const value = ref.deref();
        if (value) {
          alive++;
          if (!live.has(value)) retiredAlive++;
        }
      }
      return {
        tracked: tracked.length,
        alive,
        retiredAlive,
        live: live.size,
        retainedControl: Boolean(retainedControl),
      };
    },
    dropReferences() {
      previous.clear();
      retainedControl = undefined;
    },
    restore() {
      document.createElementNS = create;
      Object.defineProperty(HTMLElement.prototype, "offsetWidth", width);
      SVGGraphicsElement.prototype.getBBox = box;
    },
    geometry() {
      // Calling native originals keeps measurement accounting independent.
      return [
        ...document.querySelectorAll(
          "#graph .nodeContainer, #graph .labelContainer, #graph .cardinalityContainer, #graph .linkContainer",
        ),
      ]
        .slice(0, 4)
        .map((root) => ({
          kind: root.getAttribute("class"),
          elements: [
            ...root.querySelectorAll(
              "g, text, tspan, path, rect, circle, marker",
            ),
          ].map((node) => ({
            tag: node.tagName,
            text: ["text", "tspan"].includes(node.tagName)
              ? node.textContent
              : undefined,
            attributes: Object.fromEntries(
              [...node.attributes].map(({ name, value }) => [name, value]),
            ),
            box:
              node instanceof SVGGraphicsElement
                ? (() => {
                    const b = box.call(node);
                    return { x: b.x, y: b.y, width: b.width, height: b.height };
                  })()
                : undefined,
            font:
              node instanceof Element &&
              ["text", "tspan"].includes(node.tagName)
                ? getComputedStyle(node).font
                : undefined,
          })),
        }));
    },
  };
  sample();
}

async function exerciseCountDraft() {
  const { document, requestAnimationFrame } = globalThis;
  const controller =
    globalThis.__webvowlMeasuredApplication.getWebVowlController();
  const total = controller.getState().nodeCountStatus.shownNodeCount;
  const range = document.getElementById("nodesShown-range");
  const popover = document.getElementById("m_filter");
  const frames = async () => {
    for (let i = 0; i < 2; i++) await new Promise(requestAnimationFrame);
  };
  const wait = async (predicate) => {
    const deadline = performance.now() + 15000;
    while (!predicate()) {
      if (performance.now() > deadline)
        throw new Error("Count adjustment did not complete");
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  };
  const changes = [];
  let previous = total;
  const unsubscribe = controller.subscribeToState((state) => {
    const count = state.nodeCountStatus?.shownNodeCount;
    if (count !== previous) {
      changes.push(count);
      previous = count;
    }
  });
  try {
    controller.setGraphLayoutPaused({ isPaused: false });
    popover.showPopover();
    range.value = String(total - 1);
    range.dispatchEvent(new Event("input", { bubbles: true }));
    await frames();
    range.value = String(total - 2);
    range.dispatchEvent(new Event("input", { bubbles: true }));
    range.dispatchEvent(new Event("change", { bubbles: true }));
    await frames();
    const pending = controller.getState();
    await wait(() => controller.getState().nodeCountAdjustment === null);
    const quiet = controller.getState();
    range.value = String(total - 3);
    range.dispatchEvent(new Event("input", { bubbles: true }));
    await frames();
    popover.hidePopover();
    await wait(() => controller.getState().nodeCountAdjustment === null);
    const closed = controller.getState();
    controller.setGraphLayoutPaused({ isPaused: true });
    return {
      total,
      changes,
      pending: {
        shown: pending.nodeCountStatus.shownNodeCount,
        adjustment: pending.nodeCountAdjustment,
        layout: pending.layout,
      },
      quiet: {
        shown: quiet.nodeCountStatus.shownNodeCount,
        layout: quiet.layout,
      },
      closed: {
        shown: closed.nodeCountStatus.shownNodeCount,
        layout: closed.layout,
      },
    };
  } finally {
    unsubscribe();
    if (popover.matches(":popover-open")) popover.hidePopover();
  }
}

/** Work, geometry, interaction and forced-GC diagnostics, never latency acceptance. */
export async function measureProductionRendererReuse({
  call,
  evaluate,
  report,
  output,
  reference = false,
}) {
  const c = "__webvowlMeasuredApplication.getWebVowlController()";
  const probe = "__webvowlReuseProbe";
  await evaluate("__webvowlMeasurement.load()");
  await evaluate(`${c}.setGraphLayoutPaused({isPaused:true})`);
  await evaluate(`${c}.setVisualizationView({nodesShown:{mode:'all'}})`);
  await evaluate("document.fonts.ready.then(() => true)");
  const total = await evaluate(
    `${c}.getState().nodeCountStatus.shownNodeCount`,
  );
  assert(total > 4);
  report.rendererReuse = {
    reference,
    total,
    scope:
      "Production identity, native work, geometry, interaction and forced-GC diagnostics; no foreground latency claim",
    work: [],
    geometry: [],
    cycles: [],
  };
  const evidence = report.rendererReuse;
  await evaluate(`(${installReuseProbe.toString()})()`);
  async function view(count) {
    await evaluate(
      `${c}.setVisualizationView({nodesShown:{mode:'exact',requestedCount:${count}}})`,
    );
    return evaluate(`${probe}.sample()`);
  }
  async function collect() {
    await evaluate("new Promise(resolve => setTimeout(resolve, 0))");
    await call("HeapProfiler.collectGarbage");
    await call("HeapProfiler.collectGarbage");
    return {
      ownership: await evaluate(`${probe}.status()`),
      heap: await call("Runtime.getHeapUsage"),
      dom: await call("Memory.getDOMCounters"),
    };
  }
  try {
    for (const count of [total - 1, total - 2, total]) {
      evidence.work.push({ count, ...(await view(count)) });
      evidence.geometry.push({
        count,
        value: await evaluate(`${probe}.geometry()`),
      });
    }
    if (!reference)
      assert(
        evidence.work.some(({ retained }) => retained > 0),
        "An unchanged production primitive and its DOM must actually survive",
      );
    await evaluate("document.getElementById('m_filter').showPopover()");
    const screenshot = await call("Page.captureScreenshot", { format: "png" });
    writeFileSync(
      resolve(output, "renderer-reuse.png"),
      Buffer.from(screenshot.data, "base64"),
      { flag: "wx" },
    );
    const accessibility = await call("Accessibility.getFullAXTree");
    evidence.accessibility = accessibility.nodes.filter(
      (node) =>
        node.role?.value === "slider" ||
        node.role?.value === "spinbutton" ||
        node.role?.value === "status",
    );
    await evaluate("document.getElementById('m_filter').hidePopover()");
    const exported = await evaluate(`(async () => {
      const controller = ${c}, original = URL.createObjectURL; let blob;
      URL.createObjectURL = value => { blob = value; return original.call(URL, value); };
      try {
        ${reference ? "" : `controller.stageNodeCountAdjustment({mode:'exact',requestedCount:${total - 1}});`}
        await controller.exportVisualization({format:'svg'});
        const source = await blob.text();
        const svg = new DOMParser().parseFromString(source, 'image/svg+xml');
        if (svg.querySelector('parsererror')) throw new Error('Invalid captured SVG');
        return {source, nodeCount:svg.querySelectorAll('.nodeContainer > g.node').length, pending:controller.getState().nodeCountAdjustment ?? null, layout:controller.getState().layout};
      } finally { URL.createObjectURL = original; }
    })()`);
    writeFileSync(resolve(output, "renderer-reuse.svg"), exported.source, {
      flag: "wx",
    });
    evidence.export = {
      ...exported,
      source: undefined,
      byteLength: Buffer.byteLength(exported.source),
    };
    assert.equal(exported.nodeCount, reference ? total : total - 1);
    assert.equal(exported.pending, null);
    assert.equal(exported.layout.status, "paused");
    await view(total);
    if (reference) return;
    // A changed stylesheet and a new loaded face must invalidate retained text.
    await evaluate(
      `(() => { const style = document.createElement('style'); style.id='reuse-style-control'; style.textContent='#graph .text {font-size:17px;font-family:monospace}'; document.head.append(style); })()`,
    );
    evidence.styleInvalidation = await view(total - 1);
    assert(evidence.styleInvalidation.replaced > 0);
    assert.equal(evidence.styleInvalidation.retained, 0);
    await evaluate(
      `(async () => { const face = new FontFace('ReuseNativeControl', 'local("Arial")'); document.fonts.add(face); await face.load(); document.getElementById('reuse-style-control').sheet.insertRule('#graph .text {font-family:ReuseNativeControl}', 1); await document.fonts.ready; })()`,
    );
    evidence.fontInvalidation = await view(total);
    assert(evidence.fontInvalidation.replaced > 0);
    assert.equal(evidence.fontInvalidation.retained, 0);
    await evaluate("document.getElementById('reuse-style-control').remove()");
    await view(total);
    evidence.draft = await evaluate(`(${exerciseCountDraft.toString()})()`);
    assert.equal(evidence.draft.pending.shown, total);
    assert.equal(evidence.draft.pending.layout.status, "paused");
    assert.equal(evidence.draft.pending.layout.requestedIsPaused, false);
    assert.deepEqual(evidence.draft.changes, [total - 2, total - 3]);
    assert.notEqual(evidence.draft.quiet.layout.status, "paused");
    assert.notEqual(evidence.draft.closed.layout.status, "paused");
    await view(total);
    evidence.active = await evaluate(`(async () => {
      const controller = ${c}; controller.setGraphLayoutPaused({isPaused:false});
      await controller.setVisualizationView({nodesShown:{mode:'exact',requestedCount:${total - 1}}});
      const nodes = [...document.querySelectorAll('#graph .nodeContainer > g.node')];
      const before = nodes.map(node => node.getAttribute('transform'));
      for (let i=0;i<6;i++) await new Promise(requestAnimationFrame);
      const moved = nodes.filter((node,index) => node.getAttribute('transform') !== before[index]).length;
      const layout = controller.getState().layout; controller.setGraphLayoutPaused({isPaused:true});
      return {moved,layout};
    })()`);
    assert(
      evidence.active.moved > 0,
      "Active production simulation must keep drawing after reuse",
    );
    await view(total);
    await evaluate(`${probe}.retainControl()`);
    await view(0);
    evidence.positiveControl = await collect();
    assert(
      evidence.positiveControl.ownership.retiredAlive > 0,
      "Deliberately retained owner must be detectable",
    );
    await evaluate(`${probe}.releaseControl()`);
    evidence.releasedControl = await collect();
    assert.equal(
      evidence.releasedControl.ownership.retiredAlive,
      0,
      "Released old primitives must be collectible",
    );
    let live;
    for (let cycle = 1; cycle <= 10; cycle++) {
      await view(total);
      await view(total - 1);
      await view(total);
      const observation = { cycle, ...(await collect()) };
      live ??= observation.ownership.live;
      assert.equal(observation.ownership.live, live);
      evidence.cycles.push(observation);
      console.log(
        JSON.stringify({ reuseCycle: cycle, ...observation.ownership }),
      );
      assert.equal(observation.ownership.retiredAlive, 0);
    }
    await evaluate(
      `${probe}.dropReferences(); __webvowlMeasuredApplication.dispose()`,
    );
    evidence.disposed = await collect();
    assert.equal(evidence.disposed.ownership.alive, 0);
  } finally {
    await evaluate(`${probe}.restore()`);
  }
}
