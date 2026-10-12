import { jest } from "@jest/globals";
import { createDomainDragger } from "./domainDragger.js";
import { createRangeDragger } from "./rangeDragger.js";
import { createClassDragger } from "./classDragger.js";

// Bounded SVG selection double: construction, attributes and listener replacement.
// Browser evidence covers actual D3 selection identity, DOM order and event dispatch.
class Selection {
  constructor(tag = "svg") {
    this.tag = tag;
    this.children = [];
    this.attributes = {};
    this.classes = new Set();
    this.listeners = {};
    this.element = { parentNode: { appendChild: jest.fn() } };
  }
  append(tag) {
    const child = new Selection(tag);
    this.children.push(child);
    return child;
  }
  attr(name, value) {
    if (arguments.length === 1) {
      return this.attributes[name];
    }
    this.attributes[name] = value;
    return this;
  }
  classed(name, value) {
    if (arguments.length === 1) {
      return this.classes.has(name);
    }
    if (value) {
      this.classes.add(name);
    } else {
      this.classes.delete(name);
    }
    return this;
  }
  selectAll() {
    return {
      on: (name, handler) => {
        this.children.forEach((child) => child.on(name, handler));
        return this.selectAll();
      },
    };
  }
  on(name, handler) {
    this.listeners[name] = handler;
    return this;
  }
  node() {
    return this.element;
  }
}

const cases = [
  [
    "domain",
    createDomainDragger,
    "M 10,40 C -10,15 -10,-15 10,-40 -8.8233455,-13.641384 -36.711107,-5.1228436 -50,0 -36.696429,4.9079017 -8.6403157,13.745728 10,40 Z",
  ],
  ["range", createRangeDragger, "M 61,40 C 41,15 41,-15 61,-40 L 1,0 Z"],
  ["class", createClassDragger, "M 20,40 C 0,15 0,-15 20,-40 L -40,0 Z"],
];

function mount(factory, accuracy = true) {
  const graph = {
    options: () => ({
      useAccuracyHelper: () => accuracy,
      showDraggerObject: () => false,
    }),
    genericPropertySanityCheck: jest.fn(() => true),
    propertyCheckExistenceChecker: jest.fn(() => true),
    requestPropertyEndpointEdit: jest.fn(),
  };
  const dragger = factory(graph);
  dragger.hideDragger(true);
  const root = new Selection();
  dragger.svgRoot(root);
  dragger.svgPathLayer(root);
  dragger.drawNode();
  return { dragger, root, graph };
}

describe.each(cases)("%s dragger presentation", (name, factory, path) => {
  test("preserves mount order, path, accuracy target and guarded visibility", () => {
    const { dragger, root } = mount(factory);
    expect(root.children).toEqual([dragger.rootNodeLayer, dragger.pathLayer]);
    expect(dragger.rootNodeLayer.children).toEqual([
      dragger.nodeElement,
      dragger.draggerObject,
    ]);
    expect(dragger.pathLayer.children).toEqual([dragger.pathElement]);
    expect(dragger.pathElement.attributes).toEqual({
      x1: 0,
      y1: 0,
      x2: 0,
      y2: 0,
    });
    expect(dragger.pathElement.classed("classNodeDragPath")).toBe(true);
    expect(dragger.nodeElement.attr("d")).toBe(path);
    expect(dragger.draggerObject.attributes).toEqual({ r: 40, cx: 0, cy: 0 });
    expect(dragger.draggerObject.classed("superOpacityElement")).toBe(true);
    for (const hidden of [true, false, false]) {
      dragger.hideDragger(hidden);
      for (const element of [
        dragger.pathElement,
        dragger.nodeElement,
        dragger.draggerObject,
      ]) {
        expect(element.classed("hidden")).toBe(hidden);
      }
    }
  });
  test("retains the distinct accuracy-disabled construction", () => {
    const { dragger } = mount(factory, false);
    if (name === "class") {
      expect(dragger.draggerObject.tag).toBe("circle");
      expect(dragger.draggerObject.attributes).toEqual({});
    } else {
      expect(dragger.draggerObject).toBeUndefined();
    }
    expect(() => dragger.hideDragger(true)).not.toThrow();
  });
  test("keeps mouse transitions and root replacement local", () => {
    const { dragger, root } = mount(factory);
    dragger.addMouseEvents();
    expect(dragger.nodeElement.listeners.mouseup).toBe(dragger.mouseUp);
    dragger.nodeElement.on("mouseup", () => {});
    expect(dragger.nodeElement.listeners.mouseup).not.toBe(dragger.mouseUp);
    dragger.onMouseOver();
    expect(root.element.parentNode.appendChild).toHaveBeenCalledWith(
      root.element,
    );
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    try {
      dragger.mouseDown();
      dragger.mouseUp();
      expect(dragger.mouseButtonPressed).toBe(false);
      expect(dragger.nodeElement.classed("is-dragging")).toBe(false);
      expect(dragger.nodeElement.classed("classDraggerNodeHovered")).toBe(
        name === "class",
      );
    } finally {
      warn.mockRestore();
    }
    const oldNode = dragger.nodeElement;
    const nextRoot = new Selection();
    dragger.svgRoot(nextRoot);
    expect(dragger.svgRoot()).toBe(nextRoot);
    expect(dragger.rootNodeLayer).toBe(nextRoot.children[0]);
    expect(dragger.nodeElement).toBe(oldNode);
  });
});

test.each(cases.slice(0, 2))(
  "%s endpoint edits retain validation and placement",
  (name, factory) => {
    const { dragger, graph } = mount(factory);
    const domain = { x: 10, y: 20 },
      range = { x: 110, y: 120 };
    const property = {
      domain: () => domain,
      range: () => range,
      type: () => "owl:objectProperty",
      labelElement: () => ({}),
    };
    dragger.parent = property;
    const target = { x: 210, y: 220 };
    const update = () =>
      name === "domain"
        ? dragger.updateDomain(target)
        : dragger.updateRange(target);
    update();
    expect(graph.requestPropertyEndpointEdit).toHaveBeenCalledWith(
      property,
      name,
      target,
      name === "domain"
        ? { xPx: 156.8, yPx: 166.6 }
        : { xPx: 107.8, yPx: 117.6 },
    );
    graph.requestPropertyEndpointEdit.mockClear();
    graph.propertyCheckExistenceChecker.mockReturnValue(false);
    update();
    expect(graph.requestPropertyEndpointEdit).not.toHaveBeenCalled();
  },
);

test.each(cases.slice(0, 2))(
  "%s rejects invalid endpoints before requesting edits",
  (name, factory) => {
    const { dragger, graph } = mount(factory);
    dragger.parent = {
      domain: () => ({}),
      range: () => ({}),
      type: () => "owl:objectProperty",
    };
    dragger.updateElement = jest.fn();
    graph.genericPropertySanityCheck.mockReturnValue(false);
    if (name === "domain") {dragger.updateDomain({});}
    else {dragger.updateRange({});}
    expect(graph.requestPropertyEndpointEdit).not.toHaveBeenCalled();
    expect(graph.propertyCheckExistenceChecker).not.toHaveBeenCalled();
  },
);

test.each(cases.slice(0, 2))(
  "%s keeps inverse and loop endpoint selection",
  (name, factory) => {
    const { dragger } = mount(factory);
    const endpoint = {};
    const property = {
      domain: () => endpoint,
      range: () => endpoint,
      labelElement: () => ({ attr: () => "translate(0,15)" }),
      labelObject: () => ({
        linkDomainIntersection: { x: 10, y: 20 },
        linkRangeIntersection: { x: 110, y: 120 },
      }),
    };
    dragger.updateElement = jest.fn();
    dragger.setParentProperty(property, true);
    expect(dragger.isLoopProperty).toBe(true);
    expect([dragger.x, dragger.y]).toEqual(
      name === "domain" ? [110, 120] : [10, 20],
    );
    expect(dragger.updateElement).toHaveBeenCalledTimes(1);
  },
);

test("class placement and transient state remain independent", () => {
  const first = mount(createClassDragger).dragger;
  const second = mount(createClassDragger).dragger;
  first.setParentNode({ x: 10, y: 20, actualRadius: () => 30 });
  expect([first.x, first.y]).toEqual([50, 60]);
  expect(first.pathElement.attr("x1")).toBeCloseTo(31.2132034356);
  expect(first.pathElement.attr("y1")).toBeCloseTo(41.2132034356);
  expect(first.pathElement.attr("x2")).toBe(50);
  expect(first.pathElement.attr("y2")).toBe(60);
  first.mouseButtonPressed = true;
  first.mouseEntered(true);
  first.hideDragger(true);
  expect(second.parent).toBeUndefined();
  expect(second.mouseButtonPressed).toBe(false);
  expect(second.mouseEntered()).toBe(false);
  expect(second.nodeElement.classed("hidden")).toBe(false);
});
