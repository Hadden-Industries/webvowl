const BaseProperty = require("./BaseProperty");

describe("BaseProperty Unit Tests", () => {
  let graphMock;
  let primaryProperty;
  let inverseProperty;

  beforeEach(() => {
    graphMock = {
      options: () => ({
        dynamicLabelWidth: () => false,
        maxLabelWidth: () => 100,
        showDraggerObject: false,
        useAccuracyHelper: () => false,
      }),
      ignoreOtherHoverEvents: () => false,
      isTouchDevice: () => false,
      editorMode: () => false,
      activateHoverElementsForProperties: jest.fn(),
      updateStyle: jest.fn(),
    };

    primaryProperty = new BaseProperty(graphMock);
    inverseProperty = new BaseProperty(graphMock);

    primaryProperty.id("prop-1");
    inverseProperty.id("prop-2");

    primaryProperty.inverse(inverseProperty);
    inverseProperty.inverse(primaryProperty);

    // Mock link groups
    const createMockGroup = () => ({
      selectAll: () => ({ classed: jest.fn() }),
      node: () => ({ parentNode: { appendChild: jest.fn() } }),
    });

    primaryProperty.linkGroup(createMockGroup());
    inverseProperty.linkGroup(createMockGroup());
  });

  test("hovering inverse property targets the inverse instance rather than primary property", () => {
    const primaryLabelG = {};
    const inverseLabelG = {};

    const createD3MockSelection = (nodeElem) => {
      const selection = {
        datum: function () { return selection; },
        classed: function () { return selection; },
        attr: function () { return selection; },
        on: function (evt, handler) {
          if (evt === "mouseover") { nodeElem._mouseover = handler; }
          return selection;
        },
        node: function () { return nodeElem; },
        append: function () { return selection; },
        selectAll: function () { return selection; },
        select: function () { return selection; },
      };
      return selection;
    };

    const labelGroup = {
      append: jest.fn()
        .mockReturnValueOnce(createD3MockSelection(primaryLabelG))
        .mockReturnValueOnce(createD3MockSelection(inverseLabelG)),
    };

    primaryProperty.drawLabel = jest.fn();
    inverseProperty.drawLabel = jest.fn();

    primaryProperty.draw(labelGroup);

    expect(inverseLabelG._mouseover).toBeDefined();

    // Trigger mouseover on inverse property
    inverseLabelG._mouseover({});

    expect(inverseProperty.mouseEntered()).toBe(true);
    expect(primaryProperty.mouseEntered()).toBe(false);
  });

  test("synchronizes pinning and unpinning on inverse property pairs in drawPin and removePin", () => {
    const createPinMockSelection = () => {
      const sel = {
        append: function () { return sel; },
        classed: function () { return sel; },
        attr: function () { return sel; },
        on: function () { return sel; },
        node: function () { return {}; },
        remove: jest.fn(),
      };
      return sel;
    };

    const mockLabelElem = {
      attr: () => "translate(0,-15)",
      node: () => ({}),
      append: () => createPinMockSelection(),
    };

    primaryProperty.labelElement(mockLabelElem);
    inverseProperty.labelElement(mockLabelElem);

    primaryProperty.drawPin();

    expect(primaryProperty.pinned()).toBe(true);
    expect(inverseProperty.pinned()).toBe(true);

    primaryProperty.removePin();

    expect(primaryProperty.pinned()).toBe(false);
    expect(inverseProperty.pinned()).toBe(false);
  });

  test("maintains deterministic top and bottom vertical transforms for primary vs inverse property labels", () => {
    let primaryTransform = "";
    let inverseTransform = "";

    const primaryLabelSel = {
      attr: jest.fn().mockImplementation((name, val) => {
        if (name === "transform") { primaryTransform = val; }
        return primaryLabelSel;
      }),
      datum: function () { return primaryLabelSel; },
      classed: function () { return primaryLabelSel; },
      on: function () { return primaryLabelSel; },
      node: function () { return {}; },
      append: function () { return primaryLabelSel; },
      selectAll: function () { return primaryLabelSel; },
      select: function () { return primaryLabelSel; },
    };

    const inverseLabelSel = {
      attr: jest.fn().mockImplementation((name, val) => {
        if (name === "transform") { inverseTransform = val; }
        return inverseLabelSel;
      }),
      datum: function () { return inverseLabelSel; },
      classed: function () { return inverseLabelSel; },
      on: function () { return inverseLabelSel; },
      node: function () { return {}; },
      append: function () { return inverseLabelSel; },
      selectAll: function () { return inverseLabelSel; },
      select: function () { return inverseLabelSel; },
    };

    const linkMock = { property: () => primaryProperty };
    primaryProperty.link(linkMock);
    inverseProperty.link(linkMock);

    primaryProperty.labelElement(primaryLabelSel);
    inverseProperty.labelElement(inverseLabelSel);

    const labelGroup = {
      append: jest.fn().mockImplementation(() => ({
        datum: jest.fn().mockImplementation((prop) => {
          if (prop === primaryProperty) { return primaryLabelSel; }
          return inverseLabelSel;
        }),
        classed: function () { return this; },
        attr: function () { return this; },
      })),
    };

    primaryProperty.drawLabel = jest.fn();
    inverseProperty.drawLabel = jest.fn();

    // Draw from primary property perspective
    primaryProperty.draw(labelGroup);
    expect(primaryTransform).toBe("translate(0,-15)");
    expect(inverseTransform).toBe("translate(0,15)");

    // Draw from inverse property perspective (e.g. during hover/animation tick on inverse element)
    inverseProperty.draw(labelGroup);
    expect(primaryTransform).toBe("translate(0,-15)");
    expect(inverseTransform).toBe("translate(0,15)");
  });
});
