import { expect, jest, test } from "@jest/globals";
import { createSelectedOccurrenceExpansion } from "./selectedOccurrenceExpansion.js";

// A real EventTarget keeps listener, signal and dispatch behaviour honest; only
// the tree, attribute and animation surface this module touches is modelled.
class FakeElement extends EventTarget {
  constructor(part) {
    super();
    this.hidden = false;
    this.inert = false;
    this.dataset = part ? { occurrenceExpansionPart: part } : {};
    this.attributes = new Map();
    this.children = [];
    this.parentElement = null;
    this.following = [];
    this.removed = false;
    this.animations = [];
    this.textContent = "";
    // Layout as the browser reports it: unmoved by any transform.
    this.offsetParent = null;
    this.offsetLeft = 0;
    this.offsetTop = 0;
    this.offsetWidth = 0;
    this.offsetHeight = 0;
    this.clientLeft = 0;
    this.clientTop = 0;
    // The repository admits one inline route: literal CSS custom properties.
    this.style = {
      properties: new Map(),
      setProperty(name, value) {
        this.properties.set(name, value);
      },
    };
    this.animate = jest.fn((keyframes, options) => {
      const animation = {
        keyframes,
        options,
        cancel: jest.fn(),
        finish: () => animation.settle(),
      };
      animation.finished = new Promise((resolve) => {
        animation.settle = resolve;
      });
      this.animations.push(animation);
      return animation;
    });
  }
  append(...children) {
    for (const child of children) {
      child.parentElement = this;
      this.children.push(child);
    }
  }
  after(sibling) {
    this.following.push(sibling);
  }
  remove() {
    this.removed = true;
  }
  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }
  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }
  removeAttribute(name) {
    this.attributes.delete(name);
  }
  descendants() {
    return this.children.flatMap((child) => [child, ...child.descendants()]);
  }
  querySelector(selector) {
    const part = /data-occurrence-expansion-part="([a-z-]+)"/u.exec(selector);
    return (
      this.descendants().find(
        (element) => element.dataset.occurrenceExpansionPart === part?.[1],
      ) ?? null
    );
  }
  querySelectorAll(selector) {
    expect(selector).toBe("[id]");
    return this.descendants().filter((element) => element.attributes.has("id"));
  }
  cloneNode(deep) {
    const clone = new FakeElement();
    clone.dataset = { ...this.dataset };
    clone.attributes = new Map(this.attributes);
    clone.style.properties = new Map(this.style.properties);
    clone.textContent = this.textContent;
    if (deep) {
      clone.append(...this.children.map((child) => child.cloneNode(true)));
    }
    return clone;
  }
}

// The graph container's own corner in the window; every client position the
// module is given has to be read against it.
const CONTAINER_CLIENT_ORIGIN = Object.freeze({ left: 30, top: 60 });
const SHELL_BORDER_PX = 2;
const NAME_FONT_SIZE_PX = 16;
const NAME_SIZE = Object.freeze({ widthPx: 96, heightPx: 20 });

function setup({
  viewport = { widthPx: 1200, heightPx: 800 },
  reducedMotion = false,
  slotNamesTheOccurrence = true,
} = {}) {
  const observers = [];
  const svgRoot = new FakeElement();
  const sceneElement = new FakeElement();
  sceneElement.ownerSVGElement = svgRoot;
  sceneElement.setAttribute("transform", "translate(100,50)scale(2)");
  const expansionElement = new FakeElement();
  expansionElement.hidden = true;
  const shell = new FakeElement("shell");
  const content = new FakeElement();
  content.setAttribute("id", "app-owned-content");
  const levelToggle = new FakeElement("level-toggle");
  const heading = new FakeElement();
  const name = new FakeElement("name");
  heading.append(name);
  shell.append(
    ...(slotNamesTheOccurrence ? [heading] : []),
    content,
    levelToggle,
  );
  expansionElement.append(shell);
  const lengthOf = (propertyName) =>
    Number.parseFloat(
      expansionElement.style.properties.get(
        "--occurrence-expansion-" + propertyName,
      ),
    );
  // A point: its client position is the container's corner plus the
  // translation the module wrote, and nothing at all while it is hidden.
  expansionElement.getBoundingClientRect = () =>
    expansionElement.hidden
      ? { left: 0, top: 0 }
      : {
          left: CONTAINER_CLIENT_ORIGIN.left + lengthOf("x"),
          top: CONTAINER_CLIENT_ORIGIN.top + lengthOf("y"),
        };
  // The stylesheet's part, reduced to what the module measures: the shell is
  // as large as it was told to be, and the name sits centred near its top.
  Object.defineProperties(shell, {
    offsetWidth: { get: () => lengthOf("width") },
    offsetHeight: { get: () => lengthOf("height") },
    clientLeft: { value: SHELL_BORDER_PX },
    clientTop: { value: SHELL_BORDER_PX },
  });
  Object.defineProperties(name, {
    offsetParent: { get: () => (expansionElement.hidden ? null : shell) },
    offsetWidth: { value: NAME_SIZE.widthPx },
    offsetHeight: { value: NAME_SIZE.heightPx },
    offsetLeft: {
      get: () => (lengthOf("width") - NAME_SIZE.widthPx) / 2 - SHELL_BORDER_PX,
    },
    offsetTop: { get: () => 0.15 * lengthOf("width") - SHELL_BORDER_PX },
  });
  class FakeWheelEvent extends Event {
    constructor(type, init) {
      super(type, init);
      Object.assign(this, { deltaY: init.deltaY, clientX: init.clientX });
    }
  }
  expansionElement.ownerDocument = {
    defaultView: {
      WheelEvent: FakeWheelEvent,
      MutationObserver: class {
        constructor(callback) {
          this.callback = callback;
          this.observed = [];
          observers.push(this);
        }
        observe(target, options) {
          this.observed.push({ target, options });
        }
        disconnect() {
          this.observed = [];
        }
      },
      matchMedia: (query) => {
        expect(query).toBe("(prefers-reduced-motion: reduce)");
        return { matches: reducedMotion };
      },
      getComputedStyle: (element) => {
        expect(element).toBe(name);
        return { fontSize: NAME_FONT_SIZE_PX + "px" };
      },
    },
  };
  const center = { x: 150, y: 125 };
  const circle = {
    shape: "ellipse",
    widthPx: 50,
    heightPx: 50,
    readCenter: () => center,
    name: {
      text: "Organization",
      // Drawn 2px below the node's centre, which is (400,300) in the
      // container, at 12 graph units: 24px on screen at this zoom.
      readDrawn: () => ({
        clientXPx: CONTAINER_CLIENT_ORIGIN.left + 400,
        clientYPx: CONTAINER_CLIENT_ORIGIN.top + 302,
        fontSize: 12,
      }),
    },
    restingAppearance: {
      fill: "rgb(170, 204, 255)",
      stroke: "rgb(0, 0, 0)",
      strokeWidth: "2px",
      isDashed: false,
      ink: "rgb(0, 0, 0)",
      fontFamily: "Helvetica, Arial, sans-serif",
      fontWeight: "400",
    },
  };
  const expansion = createSelectedOccurrenceExpansion({
    expansionElement,
    sceneElement,
    readViewportSize: () => viewport,
  });
  return {
    expansion,
    expansionElement,
    shell,
    content,
    levelToggle,
    heading,
    name,
    sceneElement,
    svgRoot,
    center,
    circle,
    writeSceneTransform(value) {
      sceneElement.setAttribute("transform", value);
      for (const observer of observers) {
        if (observer.observed.some(({ target }) => target === sceneElement)) {
          observer.callback([]);
        }
      }
    },
    observedTargets: () =>
      observers.flatMap((observer) =>
        observer.observed.map(({ target, options }) => [target, options]),
      ),
  };
}

const property = (element, name) =>
  element.style.properties.get("--occurrence-expansion-" + name);
const translateOf = (element) =>
  `${property(element, "x")} ${property(element, "y")}`;
const zoomOf = (element) => property(element, "zoom");
const firstTransform = (element) =>
  element.animations.at(-1).keyframes[0].transform;
const lastTransform = (element) =>
  element.animations.at(-1).keyframes.at(-1).transform;

const TRANSFORM_PATTERN =
  /^translate\((\S+)px, (\S+)px\) scale\((\S+), (\S+)\)$/u;
function readTransform(text) {
  if (text === "none") {
    return { xPx: 0, yPx: 0, scaleX: 1, scaleY: 1 };
  }
  const [xPx, yPx, scaleX, scaleY] = TRANSFORM_PATTERN.exec(text)
    .slice(1)
    .map(Number);
  return { xPx, yPx, scaleX, scaleY };
}
const transformAt = (element, end) =>
  readTransform(element.animations.at(-1).keyframes.at(end).transform);
/**
 * Where the name is drawn at one end of the latest animations, measured from
 * the laid-out shell's centre: its own transform inside the shell's.
 */
function nameSeenAt(end, { shell, name, restingCenter }) {
  const shellNow = transformAt(shell, end);
  const nameNow = transformAt(name, end);
  return {
    xPx: shellNow.xPx + shellNow.scaleX * (restingCenter.xPx + nameNow.xPx),
    yPx: shellNow.yPx + shellNow.scaleY * (restingCenter.yPx + nameNow.yPx),
    scaleX: shellNow.scaleX * nameNow.scaleX,
    scaleY: shellNow.scaleY * nameNow.scaleY,
  };
}
function expectSeen(seen, { xPx, yPx, scale }) {
  expect(seen.xPx).toBeCloseTo(xPx);
  expect(seen.yPx).toBeCloseTo(yPx);
  expect(seen.scaleX).toBeCloseTo(scale);
  expect(seen.scaleY).toBeCloseTo(scale);
}
// The fake layout centres the name 0.15 widths below the shell's top edge.
const nameAtRestIn = (shellWidthPx) => ({
  xPx: 0,
  yPx: 0.15 * shellWidthPx + NAME_SIZE.heightPx / 2 - shellWidthPx / 2,
});
const opacities = (element) =>
  element.animations.at(-1).keyframes.map((keyframe) => keyframe.opacity);

test("expanding shows the node's own shape and colours, growing out of the node", () => {
  const { expansion, expansionElement, shell, circle } = setup();
  expansion.expand(circle);
  expect(expansionElement.hidden).toBe(false);
  expect(expansionElement.dataset).toEqual({
    shape: "ellipse",
    detail: "summary",
    fillsViewport: "false",
    dashed: "false",
  });
  // Scene translate(100,50)scale(2) places graph point (150,125) at (400,300).
  expect(translateOf(expansionElement)).toBe("400px 300px");
  expect(zoomOf(expansionElement)).toBe("1");
  expect(Object.fromEntries(expansionElement.style.properties)).toEqual({
    "--occurrence-expansion-x": "400px",
    "--occurrence-expansion-y": "300px",
    "--occurrence-expansion-zoom": "1",
    "--occurrence-expansion-width": "280px",
    "--occurrence-expansion-height": "280px",
    "--occurrence-expansion-fill": "rgb(170, 204, 255)",
    "--occurrence-expansion-stroke": "rgb(0, 0, 0)",
    "--occurrence-expansion-stroke-width": "2px",
    "--occurrence-expansion-ink": "rgb(0, 0, 0)",
    // The name is the node's label grown larger, so it keeps the label's face.
    "--occurrence-expansion-font-family": "Helvetica, Arial, sans-serif",
    "--occurrence-expansion-font-weight": "400",
  });
  // The node is 50 graph units wide, so 100px on screen inside a 280px shell.
  const scale = 100 / 280;
  expect(firstTransform(shell)).toBe(
    `translate(0px, 0px) scale(${scale}, ${scale})`,
  );
  expect(lastTransform(shell)).toBe("none");
  expect(shell.animations.at(-1).options.duration).toBeGreaterThan(0);
});

test("a selected node near the edge grows from the node into the viewport", () => {
  const { expansion, expansionElement, shell, circle, center } = setup();
  center.x = -40;
  center.y = 125;
  expansion.expand(circle);
  // The node sits at x=20; the 280px shell is clamped to centre x=152.
  expect(translateOf(expansionElement)).toBe("152px 300px");
  expect(firstTransform(shell)).toMatch(/^translate\(-132px, 0px\) scale\(/u);
});

test("the expansion mirrors every scene transform a viewport transition writes", () => {
  const { expansion, expansionElement, circle, writeSceneTransform } = setup();
  expansion.expand(circle);
  writeSceneTransform("translate(130,20)scale(2)");
  expect(translateOf(expansionElement)).toBe("430px 270px");
  expect(zoomOf(expansionElement)).toBe("1");
  // Zooming in leaves the text at its readable size...
  writeSceneTransform("translate(0,0)scale(3)");
  expect(translateOf(expansionElement)).toBe("450px 375px");
  expect(zoomOf(expansionElement)).toBe("1");
  // ...until the node itself (50 units, now 400px) would outgrow the shell.
  writeSceneTransform("translate(0,0)scale(8)");
  expect(translateOf(expansionElement)).toBe("1200px 1000px");
  expect(Number(zoomOf(expansionElement))).toBeCloseTo(460 / 280, 12);
  // Zooming out never shrinks it.
  writeSceneTransform("translate(0,0)scale(0.5)");
  expect(translateOf(expansionElement)).toBe("75px 63px");
  expect(zoomOf(expansionElement)).toBe("1");
});

test("the expansion follows the occurrence when the layout moves it", () => {
  const { expansion, expansionElement, circle, center } = setup();
  expansion.expand(circle);
  center.x = 200;
  center.y = 100;
  expansion.follow();
  expect(translateOf(expansionElement)).toBe("500px 250px");
});

test("only the scene's transform attribute is observed, and only while expanded", () => {
  const { expansion, circle, sceneElement, observedTargets } = setup();
  expect(observedTargets()).toEqual([]);
  expansion.expand(circle);
  expect(observedTargets()).toEqual([
    [sceneElement, { attributes: true, attributeFilter: ["transform"] }],
  ]);
  expansion.collapse();
  expect(observedTargets()).toEqual([]);
});

test("an appearance the next occurrence lacks falls back instead of lingering", () => {
  const { expansion, expansionElement, circle } = setup();
  expansion.expand(circle);
  expansion.expand({
    ...circle,
    restingAppearance: { isDashed: false },
  });
  for (const name of [
    "fill",
    "stroke",
    "stroke-width",
    "ink",
    "font-family",
    "font-weight",
  ]) {
    // An empty value removes the declaration, so the stylesheet default shows.
    expect(property(expansionElement, name)).toBe("");
  }
});

test("the level toggle grows a circle to the complete view and back", () => {
  const { expansion, expansionElement, shell, levelToggle, circle } = setup();
  expansion.expand(circle);
  expect(levelToggle.hidden).toBe(false);
  expect(levelToggle.getAttribute("aria-expanded")).toBe("false");
  levelToggle.dispatchEvent(new Event("click"));
  expect(expansionElement.dataset.detail).toBe("complete");
  expect(expansionElement.dataset.fillsViewport).toBe("false");
  expect(levelToggle.getAttribute("aria-expanded")).toBe("true");
  expect(translateOf(expansionElement)).toBe("600px 400px");
  expect(
    expansionElement.style.properties.get("--occurrence-expansion-width"),
  ).toBe("720px");
  // It grows from where the summary was: 280px at (400,300) into 720px at
  // the viewport centre (600,400).
  const scale = 280 / 720;
  expect(firstTransform(shell)).toBe(
    `translate(-200px, -100px) scale(${scale}, ${scale})`,
  );
  levelToggle.dispatchEvent(new Event("click"));
  expect(expansionElement.dataset.detail).toBe("summary");
  expect(levelToggle.getAttribute("aria-expanded")).toBe("false");
  expect(translateOf(expansionElement)).toBe("400px 300px");
  expect(firstTransform(shell)).toBe(
    `translate(200px, 100px) scale(${720 / 280}, ${720 / 280})`,
  );
});

test("the complete view stays put while the graph moves beneath it", () => {
  const { expansion, expansionElement, levelToggle, circle, center } = setup();
  expansion.expand(circle);
  levelToggle.dispatchEvent(new Event("click"));
  center.x = 0;
  expansion.follow();
  expect(translateOf(expansionElement)).toBe("600px 400px");
  expect(zoomOf(expansionElement)).toBe("1");
});

test("on a small viewport the complete view fills the graph area", () => {
  const { expansion, expansionElement, levelToggle, circle } = setup({
    viewport: { widthPx: 375, heightPx: 700 },
  });
  expansion.expand(circle);
  levelToggle.dispatchEvent(new Event("click"));
  expect(expansionElement.dataset.fillsViewport).toBe("true");
  // The exact centre, unrounded: a half pixel would leave a sliver of graph.
  expect(translateOf(expansionElement)).toBe("187.5px 350px");
  expect(
    expansionElement.style.properties.get("--occurrence-expansion-height"),
  ).toBe("700px");
});

test("a rectangle expands once and offers no further level", () => {
  const { expansion, expansionElement, shell, levelToggle, circle } = setup();
  expansion.expand({
    ...circle,
    shape: "rectangle",
    widthPx: 40,
    heightPx: 10,
    restingAppearance: { ...circle.restingAppearance, isDashed: true },
  });
  expect(expansionElement.dataset).toEqual({
    shape: "rectangle",
    detail: "complete",
    fillsViewport: "false",
    dashed: "true",
  });
  expect(levelToggle.hidden).toBe(true);
  expect(firstTransform(shell)).toBe(
    `translate(0px, 0px) scale(${80 / 360}, ${20 / 320})`,
  );
  const animations = shell.animations.length;
  levelToggle.dispatchEvent(new Event("click"));
  expect(shell.animations).toHaveLength(animations);
  expect(expansionElement.dataset.detail).toBe("complete");
});

test("collapsing hides the live expansion at once and leaves a shrinking copy", async () => {
  const { expansion, expansionElement, circle } = setup();
  expansion.expand(circle);
  expansion.collapse();
  expect(expansionElement.hidden).toBe(true);
  const [ghost] = expansionElement.following;
  expect(ghost.inert).toBe(true);
  expect(ghost.getAttribute("aria-hidden")).toBe("true");
  expect(translateOf(ghost)).toBe("400px 300px");
  // A copy must never answer for the application's own identifiers.
  expect(ghost.querySelectorAll("[id]")).toEqual([]);
  const ghostShell = ghost.children[0];
  const scale = 100 / 280;
  expect(lastTransform(ghostShell)).toBe(
    `translate(0px, 0px) scale(${scale}, ${scale})`,
  );
  expect(ghost.removed).toBe(false);
  ghostShell.animations.at(-1).finish();
  await ghostShell.animations.at(-1).finished;
  await Promise.resolve();
  expect(ghost.removed).toBe(true);
});

test("selecting another node shrinks the old expansion while the new one grows", () => {
  const { expansion, expansionElement, shell, circle } = setup();
  expansion.expand(circle);
  const other = { ...circle, readCenter: () => ({ x: 300, y: 200 }) };
  expansion.collapse();
  expansion.expand(other);
  expect(expansionElement.hidden).toBe(false);
  expect(translateOf(expansionElement)).toBe("700px 450px");
  expect(expansionElement.following).toHaveLength(1);
  expect(shell.animations.at(-1).cancel).not.toHaveBeenCalled();
});

test("reduced motion shows and hides without transform animation or a copy", () => {
  const { expansion, expansionElement, shell, levelToggle, circle } = setup({
    reducedMotion: true,
  });
  expansion.expand(circle);
  levelToggle.dispatchEvent(new Event("click"));
  expansion.collapse();
  expect(shell.animate).not.toHaveBeenCalled();
  expect(expansionElement.following).toEqual([]);
  expect(expansionElement.hidden).toBe(true);
});

test("the wheel zooms the graph over a summary and scrolls a complete view", () => {
  const { expansion, expansionElement, svgRoot, levelToggle, circle } = setup();
  const forwarded = [];
  svgRoot.addEventListener("wheel", (event) => forwarded.push(event));
  expansion.expand(circle);
  const wheel = Object.assign(new Event("wheel", { cancelable: true }), {
    deltaY: -120,
    clientX: 410,
  });
  expansionElement.dispatchEvent(wheel);
  expect(forwarded).toHaveLength(1);
  expect(forwarded[0]).toMatchObject({ deltaY: -120, clientX: 410 });
  expect(wheel.defaultPrevented).toBe(true);
  levelToggle.dispatchEvent(new Event("click"));
  const scroll = new Event("wheel", { cancelable: true });
  expansionElement.dispatchEvent(scroll);
  expect(forwarded).toHaveLength(1);
  expect(scroll.defaultPrevented).toBe(false);
});

test("an occurrence that cannot be placed is not expanded", () => {
  const { expansion, expansionElement, circle, writeSceneTransform } = setup();
  expansion.expand({ ...circle, readCenter: () => null });
  expect(expansionElement.hidden).toBe(true);
  expansion.expand(circle);
  expect(expansionElement.hidden).toBe(false);
  // A transform this layer cannot mirror hides it rather than drawing a guess.
  writeSceneTransform("matrix(1 0 0 1 0 0)");
  expect(expansionElement.hidden).toBe(true);
  writeSceneTransform("translate(100,50)scale(2)");
  expect(expansionElement.hidden).toBe(false);
  expect(translateOf(expansionElement)).toBe("400px 300px");
});

test("a resized viewport lays the current level out again without animating", () => {
  const viewport = { widthPx: 1200, heightPx: 800 };
  const { expansion, expansionElement, shell, levelToggle, circle } = setup({
    viewport,
  });
  expansion.expand(circle);
  levelToggle.dispatchEvent(new Event("click"));
  const animations = shell.animations.length;
  viewport.widthPx = 500;
  viewport.heightPx = 700;
  expansion.viewportResized();
  expect(expansionElement.dataset.fillsViewport).toBe("true");
  expect(translateOf(expansionElement)).toBe("250px 350px");
  expect(shell.animations).toHaveLength(animations);
});

test("disposal hides the expansion and stops answering the page", () => {
  const { expansion, expansionElement, shell, levelToggle, circle, svgRoot } =
    setup();
  const forwarded = jest.fn();
  svgRoot.addEventListener("wheel", forwarded);
  expansion.expand(circle);
  const running = shell.animations.at(-1);
  expansion.dispose();
  expect(expansionElement.hidden).toBe(true);
  expect(running.cancel).toHaveBeenCalled();
  expect(expansionElement.following).toEqual([]);
  levelToggle.dispatchEvent(new Event("click"));
  expansionElement.dispatchEvent(new Event("wheel", { cancelable: true }));
  expect(forwarded).not.toHaveBeenCalled();
  expect(expansionElement.dataset.detail).toBe("summary");
  expansion.expand(circle);
  expect(expansionElement.hidden).toBe(true);
});

test("the name travels from the node's own label to its place in the shell", () => {
  const { expansion, shell, heading, name, content, levelToggle, circle } =
    setup();
  expansion.expand(circle);
  // The first frame already reads as the node: its name, where it is drawn.
  expect(name.textContent).toBe("Organization");
  const travel = { shell, name, restingCenter: nameAtRestIn(280) };
  // A 12-unit label at zoom 2 is 24px on screen; the name is laid out at 16px.
  expectSeen(nameSeenAt(0, travel), { xPx: 0, yPx: 2, scale: 24 / 16 });
  expectSeen(nameSeenAt(-1, travel), { ...nameAtRestIn(280), scale: 1 });
  // One clock for both, or the name would slide about inside the shell.
  expect(name.animations.at(-1).options).toEqual(
    shell.animations.at(-1).options,
  );
  // Fading anything that contains the name would fade the name with it.
  expect(heading.animate).not.toHaveBeenCalled();
  expect(opacities(content)).toEqual([0, 1]);
  expect(opacities(levelToggle)).toEqual([0, 1]);
});

test("the name travels with the shell between the summary and the complete view", () => {
  const { expansion, shell, name, levelToggle, circle } = setup();
  expansion.expand(circle);
  levelToggle.dispatchEvent(new Event("click"));
  // The summary is centred on (400,300), the complete view on (600,400).
  const summaryName = nameAtRestIn(280);
  const travel = { shell, name, restingCenter: nameAtRestIn(720) };
  expectSeen(nameSeenAt(0, travel), {
    xPx: 400 - 600 + summaryName.xPx,
    yPx: 300 - 400 + summaryName.yPx,
    scale: 1,
  });
  expectSeen(nameSeenAt(-1, travel), { ...nameAtRestIn(720), scale: 1 });
});

test("collapsing carries the name back onto the node's own label", () => {
  const { expansion, expansionElement, circle } = setup();
  expansion.expand(circle);
  expansion.collapse();
  const [ghost] = expansionElement.following;
  const [ghostShell] = ghost.children;
  const [ghostHeading, ghostContent, ghostToggle] = ghostShell.children;
  const [ghostName] = ghostHeading.children;
  const travel = {
    shell: ghostShell,
    name: ghostName,
    restingCenter: nameAtRestIn(280),
  };
  expectSeen(nameSeenAt(0, travel), { ...nameAtRestIn(280), scale: 1 });
  expectSeen(nameSeenAt(-1, travel), { xPx: 0, yPx: 2, scale: 24 / 16 });
  expect(ghostName.animations.at(-1).options).toEqual(
    ghostShell.animations.at(-1).options,
  );
  // Everything but the name is gone before the shell is node-sized again.
  expect(ghostHeading.animate).not.toHaveBeenCalled();
  for (const faded of [ghostContent, ghostToggle]) {
    expect(opacities(faded)).toEqual([1, 0]);
    expect(faded.animations.at(-1).options.fill).toBe("forwards");
    expect(faded.animations.at(-1).options.duration).toBeLessThan(
      ghostShell.animations.at(-1).options.duration,
    );
  }
});

test("the shrinking copy stays solid until it is all but the node again", () => {
  const { expansion, expansionElement, circle } = setup();
  expansion.expand(circle);
  expansion.collapse();
  const [ghostShell] = expansionElement.following[0].children;
  const [fade, shrink] = ghostShell.animations;
  // What fades at the end is a node-sized, node-coloured, node-named shell
  // over the node itself, so nothing is seen to disappear.
  expect(fade.keyframes.map((keyframe) => keyframe.opacity)).toEqual([1, 1, 0]);
  expect(fade.keyframes[1].offset).toBeGreaterThanOrEqual(0.6);
  // Linear, so that offset is a share of the time: the eased shrink is nearly
  // over by then, where the same share of its progress comes far too early.
  expect(fade.options).toEqual({ ...shrink.options, easing: "linear" });
  for (const keyframe of shrink.keyframes) {
    expect(keyframe.opacity).toBeUndefined();
  }
});

test("an occurrence whose name cannot be measured fades in whole", () => {
  const { expansion, heading, name, content, circle } = setup();
  expansion.expand({
    ...circle,
    name: { text: "Organization", readDrawn: () => null },
  });
  expect(name.textContent).toBe("Organization");
  expect(name.animate).not.toHaveBeenCalled();
  expect(opacities(heading)).toEqual([0, 1]);
  expect(opacities(content)).toEqual([0, 1]);
});

test("a slot that names nothing still grows and shrinks", () => {
  const { expansion, expansionElement, shell, content, circle } = setup({
    slotNamesTheOccurrence: false,
  });
  expansion.expand(circle);
  expect(opacities(content)).toEqual([0, 1]);
  expansion.collapse();
  const [ghostShell] = expansionElement.following[0].children;
  expect(ghostShell.animate).toHaveBeenCalled();
  // With no name to keep, all of the content is gone early in the shrink.
  for (const child of ghostShell.children) {
    expect(opacities(child)).toEqual([1, 0]);
  }
  expect(shell.animations).toHaveLength(1);
});

test("the next occurrence's name replaces the last one's at once", () => {
  const { expansion, name, circle } = setup({ reducedMotion: true });
  expansion.expand(circle);
  expansion.expand({ ...circle, name: { text: "", readDrawn: () => null } });
  // Even an unnamed occurrence must not answer to the previous name.
  expect(name.textContent).toBe("");
  expect(name.animate).not.toHaveBeenCalled();
});

test("a label zoomed past its expansion still grows out of the label", () => {
  const { expansion, expansionElement, shell, sceneElement, circle } = setup();
  sceneElement.setAttribute("transform", "translate(0,0)scale(8)");
  expansion.expand({
    ...circle,
    shape: "rectangle",
    widthPx: 40,
    heightPx: 10,
    readCenter: () => ({ x: 75, y: 50 }),
  });
  // The label is 320px wide on screen, so its 360px layout is drawn at 1.15 x
  // 320 = 368px to keep it covered. Growing starts at the label's own size as
  // a share of what is drawn, not of the layout.
  const coverScale = 368 / 360;
  expect(Number(zoomOf(expansionElement))).toBeCloseTo(coverScale, 12);
  const { scaleX, scaleY } = transformAt(shell, 0);
  expect(scaleX).toBeCloseTo(320 / 368, 10);
  expect(scaleY).toBeCloseTo(80 / (320 * coverScale), 10);
});
