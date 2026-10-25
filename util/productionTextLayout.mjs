import assert from "node:assert/strict";

/** Native control for SVG bbox rounding; no product measurement code is used. */
async function nativeTextPrecisionControl() {
  const { document, getComputedStyle, XMLSerializer, URL, Image, Blob } =
    globalThis;
  const ns = "http://www.w3.org/2000/svg";
  const templates = [...document.querySelectorAll("#graph svg text")].filter(
    (text) =>
      text.querySelectorAll("tspan").length > 1 && text.getBBox().width > 0,
  );
  const cases = [];
  const style = document.createElement("style");
  document.head.append(style);
  async function raster(text, template) {
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("width", "512");
    svg.setAttribute("height", "256");
    const group = document.createElementNS(ns, "g");
    group.setAttribute(
      "transform",
      `translate(256,128) scale(${template.getScreenCTM().a})`,
    );
    const clone = text.cloneNode(true);
    clone.style.font = getComputedStyle(template).font;
    clone.style.fill = getComputedStyle(template).fill;
    [...clone.querySelectorAll("tspan")].forEach((span, index) => {
      span.style.font = getComputedStyle(template.children[index]).font;
      span.style.fill = getComputedStyle(template.children[index]).fill;
    });
    group.append(clone);
    svg.append(group);
    const url = URL.createObjectURL(
      new Blob([new XMLSerializer().serializeToString(svg)], {
        type: "image/svg+xml",
      }),
    );
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = 512;
      canvas.height = 256;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      context.drawImage(image, 0, 0);
      return context.getImageData(0, 0, 512, 256).data;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  function draw(template, incremental) {
    const clone = template.cloneNode(false);
    clone.removeAttribute("y");
    template.parentNode.append(clone);
    for (const [index, source] of [...template.children].entries()) {
      const span = source.cloneNode(true);
      clone.append(span);
      span.setAttribute(
        "dy",
        parseFloat(getComputedStyle(span).fontSize) +
          (index > 0 ? 1 : 0) +
          "px",
      );
      if (incremental)
        clone.setAttribute("y", -clone.getBBox().height * 0.5 + "px");
    }
    if (!incremental)
      clone.setAttribute("y", -clone.getBBox().height * 0.5 + "px");
    return clone;
  }
  try {
    for (const changedStyle of [false, true]) {
      style.textContent = changedStyle
        ? "#graph .text {font-size:17px;font-family:monospace;}"
        : "";
      for (const template of templates.slice(0, 12)) {
        const legacy = draw(template, true);
        const batched = draw(template, false);
        try {
          const legacyY = parseFloat(legacy.getAttribute("y"));
          const batchedY = parseFloat(batched.getAttribute("y"));
          const first = await raster(legacy, template);
          const second = await raster(batched, template);
          // Graph zoom can make one SVG unit much smaller than a raster pixel.
          // Move one output pixel so the positive control remains discriminating.
          const screenScale = Math.abs(template.getScreenCTM().a);
          batched.setAttribute("y", batchedY + 1 / screenScale + "px");
          const moved = await raster(batched, template);
          let differences = 0,
            controlDifferences = 0,
            ink = 0;
          for (let index = 0; index < first.length; index++) {
            differences += first[index] !== second[index] ? 1 : 0;
            controlDifferences += first[index] !== moved[index] ? 1 : 0;
            if (index % 4 === 3 && first[index] > 0) ink++;
          }
          cases.push({
            changedStyle,
            legacyY,
            batchedY,
            delta: Math.abs(legacyY - batchedY),
            differences,
            controlDifferences,
            ink,
            screenScale,
          });
        } finally {
          legacy.remove();
          batched.remove();
        }
      }
    }
  } finally {
    style.remove();
  }
  return { userAgent: globalThis.navigator.userAgent, cases };
}

/** Standalone functional control, outside all diagnostic timing windows. */
export async function qualifyProductionTextLayoutControls({
  evaluate,
  report,
}) {
  assert.equal(
    report.fixture,
    "W1",
    "Native precision controls use the public FOAF workload",
  );
  await evaluate("__webvowlMeasurement.load()");
  await evaluate("__webvowlMeasurement.waitForNodeOrdering()");
  await evaluate("__webvowlMeasurement.view({nodesShown:{mode:'all'}})");
  const precision = await evaluate(
    `(${nativeTextPrecisionControl.toString()})()`,
  );
  report.textLayoutControls = { precision };
  assert(precision.cases.length >= 2);
  assert(
    precision.cases.some((row) => row.delta > 0),
    "Native bbox rounding must be demonstrated independently",
  );
  for (const row of precision.cases) {
    assert(row.ink > 0, "Raster must contain visible glyphs");
    assert(
      row.controlDifferences > 0,
      "One-pixel positive control must differ",
    );
    assert.equal(
      row.differences,
      0,
      "Native rounding must preserve rasterized glyphs",
    );
  }
  await evaluate(
    "__webvowlMeasuredApplication.getWebVowlController().dispose()",
  );
}

/** Read local SVG geometry, independent of paused force-layout translation. */
function readGeometry() {
  const { document, getComputedStyle } = globalThis;
  const root = document.querySelector("#graph svg");
  if (!root) throw new Error("Production SVG is missing");
  const text = [...root.querySelectorAll("text")].map((node) => {
    const box = node.getBBox();
    return {
      text: node.textContent,
      class: node.getAttribute("class"),
      x: node.getAttribute("x"),
      y: node.getAttribute("y"),
      box: { x: box.x, y: box.y, width: box.width, height: box.height },
      lines: [...node.querySelectorAll("tspan")].map((span) => ({
        text: span.textContent,
        x: span.getAttribute("x"),
        y: span.getAttribute("y"),
        dy: span.getAttribute("dy"),
        font: getComputedStyle(span).font,
      })),
    };
  });
  return {
    text,
    rectangles: [...root.querySelectorAll("rect")].map((node) =>
      Object.fromEntries(
        ["x", "y", "width", "height", "class"].map((key) => [
          key,
          node.getAttribute(key),
        ]),
      ),
    ),
    probes: document.querySelectorAll(".text-measurement-probe").length,
  };
}

/** Narrow S6 diagnostic: one warmup and two count revisions, then W1 geometry. */
export async function measureProductionTextLayout({
  evaluate,
  measure,
  report,
}) {
  const controller = "__webvowlMeasuredApplication.getWebVowlController()";
  report.textLayout = {
    geometry: [],
    scope: "Local text/rectangle geometry; force translations excluded",
  };
  async function geometry(name) {
    const result = await evaluate(`(${readGeometry.toString()})()`);
    assert(
      result.text.length > 0,
      "Geometry probe must observe actual SVG text",
    );
    assert.equal(
      result.probes,
      0,
      "Measurement probes must not survive drawing",
    );
    report.textLayout.geometry.push({ name, ...result });
  }
  report.activeCohort = { index: 0, label: "warmup", warmup: true };
  await measure("B2-load", "__webvowlMeasurement.load()", "warmup", true);
  await evaluate("__webvowlMeasurement.waitForNodeOrdering()");
  const before = await evaluate("__webvowlMeasurement.state()");
  const count = before.nodeCountStatus.shownNodeCount;
  assert(count > 3);
  await measure(
    "B3-count",
    `__webvowlMeasurement.view({nodesShown:{mode:'exact',requestedCount:${count - 1}}})`,
    "warmup",
    true,
  );
  for (let step = 0; step < 2; step++) {
    report.activeCohort = {
      index: step + 1,
      label: `layout-${step}`,
      warmup: false,
    };
    await measure(
      "B3-count",
      `__webvowlMeasurement.view({nodesShown:{mode:'exact',requestedCount:${count - 2 + step}}})`,
      `layout-${step}`,
    );
  }
  await geometry("count-revision");
  if (report.fixture === "W1") {
    await evaluate("__webvowlMeasurement.view({nodesShown:{mode:'all'}})");
    await geometry("all-nodes");
    for (const [name, changes] of [
      ["fixed-width", { dynamicLabelWidth: false }],
      ["dynamic-narrow", { dynamicLabelWidth: true, maxLabelWidthPx: 60 }],
      ["dynamic-wide", { maxLabelWidthPx: 160 }],
      ["expanded-notation", { compactNotation: false }],
    ]) {
      await evaluate(
        `${controller}.setVisualizationModes(${JSON.stringify(changes)})`,
      );
      await geometry(name);
    }
    await evaluate("__webvowlMeasurement.view({language:'de'})");
    await geometry("language-de");
    await evaluate("__webvowlMeasurement.prepareEdits()");
    await evaluate("__webvowlMeasurement.edit(0)");
    await geometry("edited-label");
    await evaluate(`(() => {
      const style = document.createElement('style');
      style.id = 'measurement-font-style';
      style.textContent = '#graph .text {font-size:17px; font-family:monospace;} .text-measurement-probe {font-size:17px; font-family:monospace; letter-spacing:1px;}';
      document.head.append(style);
    })()`);
    await evaluate("__webvowlMeasurement.view({language:'en'})");
    await geometry("stylesheet-changed");
    await evaluate(`(async () => {
      const face = new FontFace('WebVowlLayoutProbe', 'local("Arial")');
      document.fonts.add(face);
      document.getElementById('measurement-font-style').textContent = '#graph .text, .text-measurement-probe {font-size:17px; font-family:WebVowlLayoutProbe, monospace;}';
      await face.load();
      await document.fonts.ready;
      if (face.status !== 'loaded') throw new Error('Local font load did not complete');
    })()`);
    await evaluate("__webvowlMeasurement.view({language:'de'})");
    await geometry("font-loaded");
    const capture = await evaluate(`(async () => {
      const create = URL.createObjectURL;
      let blob;
      URL.createObjectURL = value => { blob = value; return create.call(URL,value); };
      try {
        const result = await ${controller}.exportVisualization({format:'svg'});
        const xml = new DOMParser().parseFromString(await blob.text(), 'image/svg+xml');
        if (xml.querySelector('parsererror')) throw new Error('Invalid captured SVG');
        const svg = xml.documentElement;
        return {format:result.format, width:svg.getAttribute('width'), height:svg.getAttribute('height'),
          lines:[...svg.querySelectorAll('tspan')].map(node=>({text:node.textContent,x:node.getAttribute('x'),y:node.getAttribute('y'),dy:node.getAttribute('dy')}))};
      } finally { URL.createObjectURL = create; }
    })()`);
    assert.equal(capture.format, "svg");
    assert(capture.lines.length > 0);
    report.textLayout.capture = capture;
    await evaluate(
      "document.getElementById('measurement-font-style').remove()",
    );
    await evaluate("__webvowlMeasurement.load()");
    await geometry("replacement-document");
  }
  await evaluate(`${controller}.dispose()`);
  delete report.activeCohort;
  delete report.activeOperation;
}
