import { describe, expect, jest, test } from "@jest/globals";
import { createOntologyChooser } from "./ontologyChooser.js";
import { createOntologySuggestions } from "./ontologySuggestions.js";

class Element extends EventTarget {
  children = [];
  attributes = new Map();
  value = "";
  hidden = false;
  classList = { toggle: jest.fn() };
  setAttribute(name, value) {
    this.attributes.set(name, value);
  }
  getAttribute(name) {
    return this.attributes.get(name);
  }
  removeAttribute(name) {
    this.attributes.delete(name);
  }
  appendChild(child) {
    this.children.push(child);
    child.parent = this;
  }
  replaceChildren() {
    this.children = [];
  }
  contains(child) {
    return (
      child === this || this.children.some((entry) => entry.contains(child))
    );
  }
  closest() {
    return this.attributes.has("data-suggestion-id")
      ? this
      : this.parent?.closest();
  }
}
function setup() {
  const elements = new Map();
  const documentObject = {
    activeElement: null,
    getElementById(id) {
      if (!elements.has(id)) {
        const element = new Element();
        element.focus = () => {
          documentObject.activeElement = element;
        };
        elements.set(id, element);
      }
      return elements.get(id);
    },
    createElement: () => new Element(),
  };
  const timers = new Map();
  let timer = 0;
  const windowObject = {
    setTimeout: (fn) => {
      timers.set(++timer, fn);
      return timer;
    },
    clearTimeout: (id) => timers.delete(id),
  };
  const catalogue = createOntologySuggestions((key) => ({
    url: `http://localhost:5173/${key}.json`,
  }));
  const submitSource = jest.fn();
  const chooser = createOntologyChooser({
    documentObject,
    windowObject,
    catalogue,
    submitSource,
  });
  const input = elements.get("iri-converter-input");
  const list = elements.get("ontology-suggestions");
  const fire = (element, type, properties = {}) => {
    const event = Object.assign(
      new Event(type, { cancelable: true }),
      properties,
    );
    element.dispatchEvent(event);
    return event;
  };
  const type = (value) => {
    input.value = value;
    fire(input, "input");
  };
  const key = (key, properties) =>
    fire(input, "keydown", { key, ...properties });
  const submit = () => fire(elements.get("iri-converter-form"), "submit");
  return {
    chooser,
    input,
    list,
    elements,
    documentObject,
    catalogue,
    submitSource,
    fire,
    type,
    key,
    submit,
    timers,
  };
}

describe("ontology chooser interaction", () => {
  test("active Enter commits without loading; the next deliberate submit loads once", () => {
    const h = setup();
    h.type("FOAF");
    expect(h.input.getAttribute("aria-activedescendant")).toBe(
      "ontology-suggestion-O1",
    );
    expect(h.elements.get("iri-converter-button").disabled).toBe(true);
    expect(h.key("Enter").defaultPrevented).toBe(true);
    expect(h.submitSource).not.toHaveBeenCalled();
    expect(h.input.value).toBe("http://localhost:5173/foaf.json");
    expect(h.list.hidden).toBe(true);
    expect(h.key("Enter", { repeat: true }).defaultPrevented).toBe(true);
    expect(h.key("Enter").defaultPrevented).toBe(false);
    h.submit();
    expect(h.submitSource).toHaveBeenCalledTimes(1);
    expect(h.submitSource).toHaveBeenCalledWith(
      "http://localhost:5173/foaf.json",
    );
  });
  test("IME composition cannot commit or submit, including compositionend before Enter", () => {
    const h = setup();
    h.fire(h.input, "compositionstart");
    h.type("core");
    h.key("Enter", { isComposing: true });
    h.submit();
    expect(h.submitSource).not.toHaveBeenCalled();
    h.fire(h.input, "compositionend");
    expect(h.key("Enter").defaultPrevented).toBe(true);
    h.submit();
    expect(h.input.value).toBe("core");
    expect(h.submitSource).not.toHaveBeenCalled();
    h.fire(h.input, "keyup", { key: "Enter" });
    h.key("Enter");
    expect(h.input.value).toContain("/universal/core/latest-unstable");
  });
  test("absolute URLs stay untouched; arrows explore without committing", () => {
    const h = setup();
    const url = "https://haddenindustries.com/ontology/universal/core/latest";
    h.type(url);
    expect(h.input.getAttribute("aria-activedescendant")).toBeUndefined();
    expect(h.key("Home").defaultPrevented).toBe(false);
    expect(h.key("End").defaultPrevented).toBe(false);
    h.key("ArrowDown");
    expect(h.input.getAttribute("aria-activedescendant")).toBe(
      "ontology-suggestion-H3",
    );
    h.key("Tab");
    expect(h.input.value).toBe(url);
    expect(h.list.hidden).toBe(true);
    h.submit();
    expect(h.submitSource).toHaveBeenCalledWith(url);
  });

  test("composition ending without an Enter does not consume the next ordinary Enter", () => {
    const h = setup();
    h.fire(h.input, "compositionstart");
    h.type("core");
    h.fire(h.input, "compositionend");
    h.key("Enter");
    expect(h.input.value).toContain("/universal/core/latest-unstable");
    expect(h.submitSource).not.toHaveBeenCalled();
  });

  test("the native IME marker protects compositionend before the final keydown", () => {
    const h = setup();
    h.fire(h.input, "compositionstart");
    h.type("core");
    h.fire(h.input, "compositionend");
    h.key("Enter", { keyCode: 229 });
    h.submit();
    expect(h.input.value).toBe("core");
    expect(h.submitSource).not.toHaveBeenCalled();
    h.fire(h.input, "keyup", { key: "Enter" });
    h.key("Enter");
    expect(h.input.value).toContain("/universal/core/latest-unstable");
  });
  test("Escape closes suggestions first; Alt arrows open and close without replacing text", () => {
    const h = setup();
    h.type("core");
    expect(h.key("Escape").defaultPrevented).toBe(true);
    expect(h.key("Escape").defaultPrevented).toBe(false);
    h.key("ArrowDown", { altKey: true });
    expect(h.list.hidden).toBe(false);
    h.key("ArrowUp", { altKey: true });
    expect(h.list.hidden).toBe(true);
    expect(h.input.value).toBe("core");
  });
  test("touch scrolling does not commit and blur does not hide the pending click target", () => {
    const h = setup();
    h.input.focus();
    h.type("FOAF");
    expect(
      h.fire(h.list, "pointerdown", { pointerType: "touch" }).defaultPrevented,
    ).toBe(false);
    h.documentObject.activeElement = null;
    h.fire(h.input, "blur");
    expect(h.list.hidden).toBe(false);
    expect(h.submitSource).not.toHaveBeenCalled();
    const option = h.list.children[0].children[1];
    const click = new Event("click");
    Object.defineProperty(click, "target", { value: option });
    h.list.dispatchEvent(click);
    expect(h.input.value).toBe("http://localhost:5173/foaf.json");
    expect(h.documentObject.activeElement).toBe(h.input);
    expect(h.submitSource).not.toHaveBeenCalled();
  });
  test("invalid words remain editable and have visible guidance", () => {
    const h = setup();
    h.type("unmatched");
    h.submit();
    expect(h.submitSource).not.toHaveBeenCalled();
    expect(h.input.value).toBe("unmatched");
    expect(h.input.getAttribute("aria-invalid")).toBe("true");
    expect(h.elements.get("iri-converter-hint").textContent).toContain(
      "Choose a suggestion",
    );
    h.type("https://example.org/ontology.owl");
    expect(h.input.getAttribute("aria-invalid")).toBeUndefined();
  });
  test("focus offers suggestions and clearing retains focus without submitting", () => {
    const h = setup();
    const clear = h.elements.get("ontology-source-clear");
    const hint = h.elements.get("iri-converter-hint");
    expect(clear.hidden).toBe(true);
    expect(hint.hidden).toBe(true);
    h.input.focus();
    h.fire(h.input, "focus");
    expect(h.list.hidden).toBe(false);
    expect(h.input.getAttribute("aria-expanded")).toBe("true");
    h.type("foaf");
    expect(clear.hidden).toBe(false);
    expect(hint.hidden).toBe(true);
    h.fire(clear, "click");
    expect(h.input.value).toBe("");
    expect(clear.hidden).toBe(true);
    expect(h.documentObject.activeElement).toBe(h.input);
    expect(h.submitSource).not.toHaveBeenCalled();
  });
  test("a native change before a touch click preserves the tapped suggestion", () => {
    const h = setup();
    h.input.focus();
    h.type("foaf");
    const option = h.list.children[0].children[1];
    h.fire(h.list, "pointerdown", { pointerType: "touch" });
    h.fire(h.list, "pointerup", { pointerType: "touch" });
    h.documentObject.activeElement = null;
    h.fire(h.input, "change");
    h.fire(h.input, "blur");
    expect(h.list.contains(option)).toBe(true);
    const click = new Event("click");
    Object.defineProperty(click, "target", { value: option });
    h.list.dispatchEvent(click);
    expect(h.input.value).toBe("http://localhost:5173/foaf.json");
    expect(h.elements.get("iri-converter-button").disabled).toBe(false);
    expect(h.submitSource).not.toHaveBeenCalled();
  });
  test("no-match guidance is visible without an empty list; pointer opening and hover do not commit", () => {
    const h = setup();
    h.input.focus();
    expect(h.list.hidden).toBe(true);
    h.fire(h.input, "pointerdown");
    expect(h.list.hidden).toBe(false);
    const option = h.list.children[0].children[2];
    const hover = Object.assign(new Event("pointermove"), {
      pointerType: "mouse",
    });
    Object.defineProperty(hover, "target", { value: option });
    h.list.dispatchEvent(hover);
    expect(h.input.getAttribute("aria-activedescendant")).toBe(
      "ontology-suggestion-H2",
    );
    expect(h.input.value).toBe("");
    h.type("no-such-suggestion");
    expect(h.list.hidden).toBe(true);
    expect(h.elements.get("iri-converter-hint").textContent).toContain(
      "No suggestions match",
    );
    expect(h.submitSource).not.toHaveBeenCalled();
  });
  test("failure is reported on reopening, and an accepted replacement can reflect after submission", () => {
    const h = setup();
    h.type("https://one.test/ontology");
    h.submit();
    h.chooser.renderControllerState({ status: "loading" });
    h.chooser.renderControllerState({
      status: "error",
      error: { message: "Source unavailable" },
    });
    h.fire(h.elements.get("m_select"), "toggle", { newState: "open" });
    expect(h.documentObject.activeElement).toBe(h.input);
    expect(h.elements.get("iri-converter-hint").textContent).toContain(
      "Source unavailable",
    );
    expect(h.input.value).toBe("https://one.test/ontology");
    h.chooser.renderControllerState({ status: "loading" });
    h.chooser.renderControllerState({
      status: "ready",
      source: {
        kind: "vowl-json-url",
        identity: "https://accepted.test/other.json",
      },
    });
    expect(h.input.value).toBe("https://one.test/ontology");
    h.documentObject.activeElement = null;
    h.fire(h.input, "blur");
    expect(h.input.value).toBe("https://accepted.test/other.json");
  });
  test("reflects accepted sources only when clean and unfocused; failures retain text", () => {
    const h = setup();
    const ready = (identity) => ({
      status: "ready",
      source: { kind: "ontology-document-iri", identity },
    });
    h.chooser.renderControllerState(ready("https://one.test/a"));
    expect(h.input.value).toBe("https://one.test/a");
    h.input.focus();
    h.chooser.renderControllerState(ready("https://two.test/b"));
    expect(h.input.value).toBe("https://one.test/a");
    h.documentObject.activeElement = null;
    h.fire(h.input, "blur");
    expect(h.input.value).toBe("https://two.test/b");
    h.type("https://edited.test/c");
    h.chooser.renderControllerState(ready("https://agent.test/d"));
    expect(h.input.value).toBe("https://edited.test/c");
    h.submit();
    h.chooser.renderControllerState({
      status: "error",
      source: ready("https://agent.test/d").source,
    });
    expect(h.input.value).toBe("https://edited.test/c");
    h.chooser.renderControllerState(ready("https://edited.test/c"));
    h.chooser.renderControllerState(ready("https://next.test/e"));
    expect(h.input.value).toBe("https://next.test/e");
    expect(h.submitSource).toHaveBeenCalledTimes(1);
  });
  test("disposal removes listeners and deferred announcements", () => {
    const h = setup();
    h.type("core");
    expect(h.timers.size).toBe(1);
    h.chooser.dispose();
    expect(h.timers.size).toBe(0);
    h.type("FOAF");
    h.submit();
    expect(h.list.hidden).toBe(true);
    expect(h.submitSource).not.toHaveBeenCalled();
  });
});
