import {
  beforeAll,
  beforeEach,
  afterEach,
  expect,
  jest,
  test,
} from "@jest/globals";
import { runInThisContext } from "node:vm";
import loadEsmModuleForTest from "../../../app/test/loadEsmModuleForTest.js";

let BaseNode, BaseProperty;
const moduleGlobals = runInThisContext("globalThis");
let previousDocument;
beforeAll(async () => {
  ({ BaseNode } = await loadEsmModuleForTest(
    new URL("./nodes/BaseNode.js", import.meta.url),
    import.meta.url,
  ));
  ({ BaseProperty } = await loadEsmModuleForTest(
    new URL("./properties/BaseProperty.js", import.meta.url),
    import.meta.url,
  ));
});
beforeEach(() => {
  previousDocument = moduleGlobals.document;
  moduleGlobals.document = { querySelectorAll: () => [] };
});
afterEach(() => {
  if (previousDocument === undefined) {
    delete moduleGlobals.document;
  } else {
    moduleGlobals.document = previousDocument;
  }
});

function createLabelContainer() {
  const inputs = [];
  function selection() {
    const handlers = new Map();
    const node = {
      value: "",
      focus() {},
      select() {},
      blur() {
        handlers.get("blur")?.call(node, new Event("blur"));
      },
    };
    const selected = {
      node: () => node,
      append(name) {
        const child = selection();
        if (name === "xhtml:input") {
          inputs.push(child);
        }
        return child;
      },
      attr() {
        return selected;
      },
      classed() {
        return selected;
      },
      style() {
        return selected;
      },
      selectAll() {
        return selected;
      },
      remove() {
        return selected;
      },
      on(name, handler) {
        handlers.set(name, handler);
        return selected;
      },
      enterText(text) {
        node.value = text;
        handlers
          .get("keydown")
          .call(node, { key: "Enter", stopPropagation() {} });
      },
    };
    return selected;
  }
  return { container: selection(), inputs };
}

test.each(["node", "property"])(
  "native %s label submission requests a document edit without mutating ontology facts",
  (kind) => {
    const request = jest.fn();
    const graph = {
      options: () => ({
        dynamicLabelWidth: () => false,
        maxLabelWidth: () => 120,
      }),
      language: () => "en",
      paused: () => true,
      isTouchDevice: () => false,
      dispatchEvent() {},
      killDelayedTimer() {},
      ignoreOtherHoverEvents: () => false,
      isADraggerActive: () => false,
      showHoverElementsAfterAnimation() {},
      removeEditElements() {},
      updatePropertyDraggerElements() {},
      activateHoverElementsForProperties() {},
      currentRenderInteractionEpoch: () => 7,
      requestRecordLabelEdit: request,
    };
    const element =
      kind === "node" ? new BaseNode(graph) : new BaseProperty(graph);
    element
      .id("a")
      .type(kind === "node" ? "owl:Class" : "owl:ObjectProperty")
      .label({ en: "Original", de: "Original DE" })
      .iri("https://example.test/a")
      .baseIri("https://example.test/");
    element.textWidth = () => 100;
    element.redrawLabelText = jest.fn();
    const { container, inputs } = createLabelContainer();
    if (kind === "node") {
      element.nodeElement(container);
    } else {
      element.labelElement(container);
      element.domain({ frozen() {}, locked() {} });
      element.range({ frozen() {}, locked() {} });
    }
    element.raiseDoubleClickEdit(false);
    expect(inputs).toHaveLength(1);
    expect(inputs[0].node().value).toBe("Original");
    inputs[0].enterText("Submitted");
    expect(element.label()).toEqual({ en: "Original", de: "Original DE" });
    expect(element.iri()).toBe("https://example.test/a");
    expect(request).toHaveBeenCalledWith("a", "Submitted", false, 7);
    expect(request).toHaveBeenCalledTimes(1);
  },
);
