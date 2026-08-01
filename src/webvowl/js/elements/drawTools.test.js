const drawTools = require("./drawTools")();

function createSelection(){
  const classes = {};
  const properties = {};
  const node = {
    style: {
      setProperty: (name, value) => { properties[name] = value; },
      removeProperty: (name) => { delete properties[name]; }
    }
  };
  return {
    classes,
    properties,
    node: () => node,
    classed: function (name, value){
      classes[name] = value;
      return this;
    }
  };
}

describe("drawTools custom fills", () => {
  test("passes arbitrary runtime colors through a CSS custom property", () => {
    const selection = createSelection();

    drawTools.setBackgroundColor(selection, "#36c");

    expect(selection.classes["has-custom-fill"]).toBe(true);
    expect(selection.properties["--vowl-fill"]).toBe("#36c");
  });

  test("removes stale runtime colors and their state class", () => {
    const selection = createSelection();
    drawTools.setBackgroundColor(selection, "#36c");

    drawTools.setBackgroundColor(selection, undefined);

    expect(selection.classes["has-custom-fill"]).toBe(false);
    expect(selection.properties["--vowl-fill"]).toBeUndefined();
  });
});
