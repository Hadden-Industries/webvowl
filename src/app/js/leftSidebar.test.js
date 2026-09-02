import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createContext, SourceTextModule } from "node:vm";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from "@jest/globals";

let createLeftSidebar;
let leftSidebarModuleContext;

beforeAll(async () => {
  const moduleUrl = new URL("./leftSidebar.js", import.meta.url);
  const moduleEnvironment = {
    AbortController,
    cancelAnimationFrame: undefined,
    document: undefined,
    requestAnimationFrame: undefined,
  };
  Object.defineProperty(moduleEnvironment, "window", {
    configurable: true,
    get() {
      throw new Error("ambient window.event must not be read");
    },
  });
  leftSidebarModuleContext = createContext(moduleEnvironment);
  const sourceModule = new SourceTextModule(
    readFileSync(fileURLToPath(moduleUrl), "utf8"),
    { context: leftSidebarModuleContext, identifier: moduleUrl.href },
  );
  await sourceModule.link((specifier) => {
    throw new Error(`Unexpected left-sidebar dependency: ${specifier}`);
  });
  await sourceModule.evaluate();
  ({ createLeftSidebar } = sourceModule.namespace);
});

class LeftSidebarElement extends EventTarget {
  constructor() {
    super();
    this.children = [];
    this.innerHTML = "";
    this.nextElementSibling = null;
    this.title = "";
    this.classes = new Set();
    this.classList = {
      add: (...classNames) =>
        classNames.forEach((className) => this.classes.add(className)),
      contains: (className) => this.classes.has(className),
      remove: (...classNames) =>
        classNames.forEach((className) => this.classes.delete(className)),
      toggle: (className, isPresent) => {
        if (isPresent) {
          this.classes.add(className);
        } else {
          this.classes.delete(className);
        }
      },
    };
  }

  appendChild(child) {
    this.children.push(child);
    child.parentNode = this;
    return child;
  }

  click() {
    this.dispatchEvent(new Event("click"));
  }

  setAttribute(name, value) {
    this[name] = value;
  }
}

describe("left sidebar native controls", () => {
  let accordionPanel;
  let accordionTrigger;
  let controls;
  let graph;
  let leftSidebar;

  beforeEach(() => {
    controls = new Map(
      [
        "#leftSideBarCollapseButton",
        "#leftSideBar",
        "#leftSideBarContent",
        "#containerForLeftSideBar",
        "#classContainer",
        "#datatypeContainer",
        "#propertyContainer",
        "#defaultClass",
        "#defaultDatatype",
        "#defaultProperty",
        "#WarningErrorMessages",
      ].map((selector) => [selector, new LeftSidebarElement()]),
    );
    accordionTrigger = new LeftSidebarElement();
    accordionPanel = new LeftSidebarElement();
    accordionPanel.classList.add("hidden");
    accordionTrigger.nextElementSibling = accordionPanel;
    controls.get("#leftSideBar").querySelectorAll = (selector) =>
      selector === ".accordion-trigger" ? [accordionTrigger] : [];
    global.document = {
      body: new LeftSidebarElement(),
      createElement: () => new LeftSidebarElement(),
      querySelector: (selector) => controls.get(selector),
      querySelectorAll: (selector) =>
        selector === ".accordion-trigger" ? [accordionTrigger] : [],
    };
    global.requestAnimationFrame = jest.fn((callback) => callback());
    global.cancelAnimationFrame = jest.fn();
    leftSidebarModuleContext.cancelAnimationFrame = global.cancelAnimationFrame;
    leftSidebarModuleContext.document = global.document;
    leftSidebarModuleContext.requestAnimationFrame =
      global.requestAnimationFrame;
    const navigationMenu = {
      hideAllMenus: jest.fn(),
      updateScrollButtonVisibility: jest.fn(),
    };
    const graphOptions = {
      defaultClass: jest.fn(),
      defaultDatatype: jest.fn(),
      defaultProperty: jest.fn(),
      navigationMenu: () => navigationMenu,
      supportedClasses: () => ["owl:Class"],
      supportedDatatypes: () => ["rdfs:Literal"],
      supportedProperties: () => ["owl:objectProperty"],
    };
    graph = {
      options: () => graphOptions,
      ontologyEditingState: () => graphOptions,
      updateCanvasContainerSize: jest.fn(),
    };
    leftSidebar = createLeftSidebar(graph);
  });

  afterEach(() => {
    leftSidebar?.dispose();
    leftSidebarModuleContext.document = undefined;
    leftSidebarModuleContext.cancelAnimationFrame = undefined;
    leftSidebarModuleContext.requestAnimationFrame = undefined;
    delete global.cancelAnimationFrame;
    delete global.document;
    delete global.requestAnimationFrame;
  });

  test("keyboard activation and generated selection clicks use native events", () => {
    leftSidebar.setup();
    const simulatedClick = jest.spyOn(accordionTrigger, "click");
    const activationEvent = new Event("keydown", { cancelable: true });
    Object.defineProperty(activationEvent, "key", { value: "Enter" });

    accordionTrigger.dispatchEvent(activationEvent);
    controls
      .get("#classContainer")
      .children[0].dispatchEvent(new Event("click"));

    expect(activationEvent.defaultPrevented).toBe(true);
    expect(simulatedClick).not.toHaveBeenCalled();
    expect(accordionTrigger.classes).toContain("accordion-trigger-active");
    expect(accordionPanel.classes).not.toContain("hidden");
    expect(graph.ontologyEditingState().defaultClass).toHaveBeenCalledWith(
      "owl:Class",
    );
  });

  test("owns only accordion triggers inside the left sidebar", () => {
    const foreignDetailsTrigger = new LeftSidebarElement();
    foreignDetailsTrigger.nextElementSibling = new LeftSidebarElement();
    global.document.querySelectorAll = (selector) =>
      selector === ".accordion-trigger"
        ? [accordionTrigger, foreignDetailsTrigger]
        : [];

    leftSidebar.setup();

    expect(accordionTrigger.role).toBe("button");
    expect(foreignDetailsTrigger.role).toBeUndefined();
  });

  test("disposal detaches setup and generated-element listeners", () => {
    leftSidebar.setup();
    const classSelection = controls.get("#classContainer").children[0];
    leftSidebar.dispose();
    leftSidebar.dispose();

    controls
      .get("#leftSideBarCollapseButton")
      .dispatchEvent(new Event("click"));
    classSelection.dispatchEvent(new Event("click"));

    expect(graph.updateCanvasContainerSize).not.toHaveBeenCalled();
    expect(graph.ontologyEditingState().defaultClass).not.toHaveBeenCalled();
  });

  test("replaces and disposes pending transition-suppression frames", () => {
    let nextAnimationFrameId = 0;
    const pendingAnimationFrames = new Map();
    global.requestAnimationFrame = jest.fn((callback) => {
      nextAnimationFrameId += 1;
      pendingAnimationFrames.set(nextAnimationFrameId, callback);
      return nextAnimationFrameId;
    });
    global.cancelAnimationFrame = jest.fn((animationFrameId) => {
      pendingAnimationFrames.delete(animationFrameId);
    });
    leftSidebarModuleContext.requestAnimationFrame =
      global.requestAnimationFrame;
    leftSidebarModuleContext.cancelAnimationFrame = global.cancelAnimationFrame;

    leftSidebar.showSidebar(0, true);
    leftSidebar.showSidebar(1, true);

    expect(global.cancelAnimationFrame).toHaveBeenCalledWith(1);
    expect(global.document.body.classList.contains("no-transition")).toBe(true);

    leftSidebar.dispose();

    expect(global.cancelAnimationFrame).toHaveBeenCalledWith(2);
    expect(pendingAnimationFrames).toEqual(new Map());
    expect(global.document.body.classList.contains("no-transition")).toBe(
      false,
    );
  });
});
