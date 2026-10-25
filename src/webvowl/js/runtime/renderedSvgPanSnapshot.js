import { namespaces } from "vowl";
import {
  EXPORTED_VISUAL_PROPERTIES,
  clearDetachedSvgPresentationStyle,
} from "./renderedSvgExportClone.js";

const PADDING_PX = 256;
const MAX_PIXELS = 16_000_000;
const VISUAL_PROPERTIES = [
  ...EXPORTED_VISUAL_PROPERTIES,
  "stroke-dashoffset",
  "stroke-miterlimit",
  "font-stretch",
  "font-variant",
  "display",
  "letter-spacing",
  "word-spacing",
  "text-decoration",
  "paint-order",
  "vector-effect",
  "color",
];

// Cancellation settles the wait even when the browser never grants idle time.
function waitForIdle(view, signal) {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const idle = typeof view.requestIdleCallback === "function";
    const finish = () => {
      signal.removeEventListener("abort", abort);
      resolve();
    };
    const handle = idle
      ? view.requestIdleCallback(finish, { timeout: 50 })
      : view.setTimeout(finish, 16);
    function abort() {
      if (idle) {
        view.cancelIdleCallback(handle);
      } else {
        view.clearTimeout(handle);
      }
      reject(signal.reason);
    }
    signal.addEventListener("abort", abort, { once: true });
  });
}

async function paintFragment(fragment, canvas, context, view, signal) {
  const image = new view.Image();
  const url = view.URL.createObjectURL(
    new view.Blob([new view.XMLSerializer().serializeToString(fragment)], {
      type: "image/svg+xml",
    }),
  );
  let abort;
  try {
    signal.throwIfAborted();
    image.src = url;
    await new Promise((resolve, reject) => {
      abort = () => reject(signal.reason);
      signal.addEventListener("abort", abort, { once: true });
      image.decode().then(resolve, reject);
    });
    signal.throwIfAborted();
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
  } finally {
    signal.removeEventListener("abort", abort);
    image.removeAttribute("src");
    view.URL.revokeObjectURL(url);
  }
}

// A disposable, detached image. The caller owns admission/publication; this
// builder never hides or changes the live drawing, including on failure.
export async function buildRenderedSvgPanSnapshot({
  svg,
  scene,
  viewport,
  signal,
}) {
  const document = svg.ownerDocument;
  const view = document.defaultView;
  const width = viewport.width + PADDING_PX * 2;
  const height = viewport.height + PADDING_PX * 2;
  const pixelWidth = Math.ceil(width * viewport.dpr);
  const pixelHeight = Math.ceil(height * viewport.dpr);
  if (
    !(pixelWidth > 0 && pixelHeight > 0) ||
    pixelWidth * pixelHeight > MAX_PIXELS
  ) {
    throw new Error("Pan snapshot exceeds its pixel budget.");
  }
  // External resources and animation require different lifetime/paint contracts.
  if (
    svg.querySelector(
      "image, use, foreignObject, script, animate, animateTransform, set",
    )
  ) {
    throw new Error("Drawing requires live SVG rendering.");
  }
  await waitForIdle(view, signal);
  signal.throwIfAborted();
  const live = [svg, ...svg.querySelectorAll("*")];
  if (live.length > 50_000) {
    throw new Error("Pan snapshot exceeds its element budget.");
  }
  const clone = svg.cloneNode(true);
  const copies = [clone, ...clone.querySelectorAll("*")];
  const styles = new Map();
  let deadline = view.performance.now() + 4;
  for (let i = 0; i < live.length; i++) {
    const computed = view.getComputedStyle(live[i]);
    // Group filters/blending cannot be reconstructed by compositing fragments.
    if (
      (computed.filter && computed.filter !== "none") ||
      (computed.mixBlendMode && computed.mixBlendMode !== "normal") ||
      ((live[i] === svg || live[i] === scene || live[i].parentNode === scene) &&
        computed.opacity !== "1")
    ) {
      throw new Error("Drawing requires live compositing.");
    }
    const css = VISUAL_PROPERTIES.map(
      (name) => `${name}:${computed.getPropertyValue(name)};`,
    ).join("");
    let id = styles.get(css);
    if (id === undefined) {
      id = styles.size;
      styles.set(css, id);
    }
    clearDetachedSvgPresentationStyle(copies[i], VISUAL_PROPERTIES);
    copies[i].setAttribute("data-pan-style", id);
    if (i % 32 === 0 && view.performance.now() >= deadline) {
      await waitForIdle(view, signal);
      signal.throwIfAborted();
      deadline = view.performance.now() + 4;
    }
  }
  const sheet = document.createElementNS(namespaces.svg, "style");
  sheet.textContent = [...styles]
    .map(([css, id]) => `[data-pan-style="${id}"]{${css}}`)
    .join("\n");
  clone
    .querySelectorAll(".vowl-interaction-only")
    .forEach((node) => node.remove());
  clone.setAttribute("xmlns", namespaces.svg);
  clone.setAttribute("width", width);
  clone.setAttribute("height", height);
  clone.setAttribute(
    "viewBox",
    `${-PADDING_PX} ${-PADDING_PX} ${width} ${height}`,
  );
  const definitions = [...clone.querySelectorAll("defs")];
  const markers = new Map(
    definitions.flatMap((defs) =>
      [...defs.querySelectorAll("marker")].map((marker) => [marker.id, marker]),
    ),
  );
  const otherDefinitions = definitions
    .map((defs) => {
      const copy = defs.cloneNode(true);
      copy.querySelectorAll("marker").forEach((marker) => marker.remove());
      return copy;
    })
    .filter((defs) => defs.childElementCount > 0);
  definitions.forEach((node) => node.remove());
  const clonedScene = clone.querySelector(":scope > g");
  const canvas = document.createElement("canvas");
  canvas.width = pixelWidth;
  canvas.height = pixelHeight;
  const dispose = () => {
    canvas.remove();
    canvas.width = 0;
    canvas.height = 0;
  };
  signal.addEventListener("abort", dispose, { once: true });
  try {
    const context = canvas.getContext("2d");
    if (!context || !clonedScene) {
      throw new Error("Pan snapshot canvas is unavailable.");
    }
    for (const layer of clonedScene.children) {
      if (layer.localName !== "g") {
        throw new Error("Drawing requires live SVG layers.");
      }
      const children = [...layer.children];
      for (let offset = 0; offset < children.length; offset += 64) {
        await waitForIdle(view, signal);
        signal.throwIfAborted();
        const fragment = clone.cloneNode(false);
        const sceneCopy = clonedScene.cloneNode(false);
        const layerCopy = layer.cloneNode(false);
        fragment.append(sheet.cloneNode(true), sceneCopy);
        sceneCopy.append(layerCopy);
        layerCopy.append(...children.slice(offset, offset + 64));
        const references = new Set();
        for (const path of layerCopy.querySelectorAll(
          "[marker-start], [marker-mid], [marker-end]",
        )) {
          for (const attribute of [
            "marker-start",
            "marker-mid",
            "marker-end",
          ]) {
            const value = path.getAttribute(attribute);
            if (!value) {
              continue;
            }
            const match = /^url\(["']?#([^"')]+)["']?\)$/.exec(value);
            if (!match || !markers.has(match[1])) {
              throw new Error("Unresolved pan snapshot marker.");
            }
            references.add(match[1]);
          }
        }
        const defs = document.createElementNS(namespaces.svg, "defs");
        for (const id of references) {
          defs.append(markers.get(id).cloneNode(true));
        }
        fragment.prepend(
          defs,
          ...otherDefinitions.map((node) => node.cloneNode(true)),
        );
        await paintFragment(fragment, canvas, context, view, signal);
      }
    }
    signal.throwIfAborted();
    return { canvas, viewport, padding: PADDING_PX, dispose };
  } catch (error) {
    dispose();
    throw error;
  } finally {
    signal.removeEventListener("abort", dispose);
  }
}
