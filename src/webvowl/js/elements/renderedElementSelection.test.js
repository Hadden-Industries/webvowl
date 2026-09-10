import { beforeAll } from "@jest/globals";
import loadEsmModuleForTest from "../../../app/test/loadEsmModuleForTest.js";

const elementConstructors = new Map();

beforeAll(async () => {
  for (const [name, path] of [
    ["RoundNode", "./nodes/RoundNode.js"],
    ["RectangularNode", "./nodes/RectangularNode.js"],
    ["BaseProperty", "./properties/BaseProperty.js"],
  ]) {
    const module = await loadEsmModuleForTest(
      new URL(path, import.meta.url),
      import.meta.url,
    );
    elementConstructors.set(name, module[name]);
  }
});

test.each(["RoundNode", "RectangularNode", "BaseProperty"])(
  "%s selection and deselection preserve independently requested search focus",
  (name) => {
    const highlightedIds = new Set(["Publication"]);
    const selections = [];
    let hasSelectedStyle = false;
    const graph = {
      resetSearchHighlight: () => highlightedIds.clear(),
      reportRenderedElementSelection: (ids) => selections.push(ids),
    };
    const element = new (elementConstructors.get(name))(graph);
    element.id("Person");
    const shape = {
      select: () => ({
        classed: (className, value) => {
          if (className === "focused") {
            hasSelectedStyle = value;
          }
        },
      }),
    };
    if (name === "BaseProperty") {
      element.labelElement(shape);
    } else {
      element.nodeElement(shape);
    }

    element.toggleSelection();
    expect(element.focused()).toBe(true);
    expect(hasSelectedStyle).toBe(true);
    expect(selections).toEqual([["Person"]]);
    expect([...highlightedIds]).toEqual(["Publication"]);

    element.toggleSelection();
    expect(element.focused()).toBe(false);
    expect(hasSelectedStyle).toBe(false);
    expect(selections).toEqual([["Person"], []]);
    expect([...highlightedIds]).toEqual(["Publication"]);
  },
);
