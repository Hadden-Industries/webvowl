const Label = require("./Label");

describe("Label Coordinate Forwarding Unit Tests", () => {
  let primaryProperty;
  let inverseProperty;
  let label;

  beforeEach(() => {
    primaryProperty = {
      x: 10,
      y: 20,
      px: 10,
      py: 20,
      fx: null,
      fy: null,
      fixed: false,
      inverse: () => inverseProperty,
    };

    inverseProperty = {
      x: 10,
      y: 20,
      px: 10,
      py: 20,
      fx: null,
      fy: null,
      fixed: false,
      inverse: () => primaryProperty,
    };

    label = new Label(primaryProperty, null);
  });

  test("forwards x, y, px, py coordinate updates to primary property without mutating inverse property", () => {
    label.x = 150;
    label.y = 250;
    label.px = 140;
    label.py = 240;

    expect(primaryProperty.x).toBe(150);
    expect(primaryProperty.y).toBe(250);
    expect(primaryProperty.px).toBe(140);
    expect(primaryProperty.py).toBe(240);

    // Verify inverse property retains its own independent coordinates (preventing label collapsing)
    expect(inverseProperty.x).toBe(10);
    expect(inverseProperty.y).toBe(20);
    expect(inverseProperty.px).toBe(10);
    expect(inverseProperty.py).toBe(20);

    expect(label.x).toBe(150);
    expect(label.y).toBe(250);
  });

  test("forwards fx, fy, and fixed updates to primary property without mutating inverse property", () => {
    label.fx = 300;
    label.fy = 400;
    label.fixed = true;

    expect(primaryProperty.fx).toBe(300);
    expect(primaryProperty.fy).toBe(400);
    expect(primaryProperty.fixed).toBe(true);

    // Verify inverse property retains its own independent fixed attributes
    expect(inverseProperty.fx).toBe(null);
    expect(inverseProperty.fy).toBe(null);
    expect(inverseProperty.fixed).toBe(false);
  });
});
