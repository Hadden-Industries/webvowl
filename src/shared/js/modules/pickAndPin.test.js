const pickAndPinFactory = require("./pickAndPin");

describe("Pick and Pin Module Unit Tests", () => {
  let pap;
  let mockNode;
  let mockProperty;

  beforeEach(() => {
    pap = pickAndPinFactory();

    let nodePinned = false;
    mockNode = {
      pinned: (v) => {
        if (v !== undefined) {
          nodePinned = v;
        }
        return nodePinned;
      },
      drawPin: jest.fn(() => {
        nodePinned = true;
      }),
      removePin: jest.fn(() => {
        nodePinned = false;
      }),
    };

    let propPinned = false;
    mockProperty = {
      pinned: (v) => {
        if (v !== undefined) {
          propPinned = v;
        }
        return propPinned;
      },
      inverse: () => null,
      domain: () => ({ links: () => [1, 2] }),
      range: () => ({ links: () => [1, 2] }),
      drawPin: jest.fn(() => {
        propPinned = true;
      }),
      removePin: jest.fn(() => {
        propPinned = false;
      }),
    };
  });

  test("does not pin when pickAndPin module is disabled", () => {
    pap.enabled(false);
    pap.handle({ defaultPrevented: false }, mockNode, true);
    expect(mockNode.drawPin).not.toHaveBeenCalled();
  });

  test("ignores simple click when forced is false", () => {
    pap.enabled(true);
    pap.handle({ defaultPrevented: false }, mockNode, false);
    expect(mockNode.drawPin).not.toHaveBeenCalled();
  });

  test("pins node when forced is true on dragend", () => {
    pap.enabled(true);
    pap.handle({}, mockNode, true);
    expect(mockNode.drawPin).toHaveBeenCalledTimes(1);
    expect(mockNode.pinned()).toBe(true);
  });

  test("pins property when forced is true on dragend", () => {
    pap.enabled(true);
    pap.handle({}, mockProperty, true);
    expect(mockProperty.drawPin).toHaveBeenCalledTimes(1);
    expect(mockProperty.pinned()).toBe(true);
  });

  test("resets all pinned elements on pap.reset()", () => {
    pap.enabled(true);
    pap.handle({}, mockNode, true);
    pap.handle({}, mockProperty, true);

    expect(mockNode.pinned()).toBe(true);
    expect(mockProperty.pinned()).toBe(true);

    pap.reset();

    expect(mockNode.removePin).toHaveBeenCalledTimes(1);
    expect(mockProperty.removePin).toHaveBeenCalledTimes(1);
  });
});
