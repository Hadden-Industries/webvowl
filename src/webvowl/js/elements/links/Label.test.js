import { beforeAll } from "@jest/globals";

let Label;

beforeAll(async () => {
  ({ Label } = await import("./Label.js"));
});

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

  test.each(["x", "y", "px", "py", "vx", "vy", "fx", "fy"])(
    "%s forwards uncoerced values and observes direct primary mutations independently",
    (field) => {
      const otherProperty = { inverse: () => undefined };
      const otherLabel = new Label(otherProperty, null);
      const originalInverse = inverseProperty[field];
      for (const value of [0, -12.5, undefined, null]) {
        label[field] = value;
        expect(primaryProperty[field]).toBe(value);
        expect(label[field]).toBe(value);
        expect(inverseProperty[field]).toBe(originalInverse);
        expect(otherLabel[field]).toBeUndefined();
      }
      primaryProperty[field] = 37;
      otherLabel[field] = 88;
      expect(label[field]).toBe(37);
      expect(otherProperty[field]).toBe(88);
    },
  );

  test("fixed reads the current inverse without coercion and writes only the primary", () => {
    inverseProperty.fixed = "inverse pin";
    expect(label.fixed).toBe("inverse pin");
    label.fixed = "primary pin";
    expect(label.fixed).toBe("primary pin");
    expect(inverseProperty.fixed).toBe("inverse pin");
    primaryProperty.fixed = 0;
    inverseProperty = { fixed: 42 };
    expect(label.fixed).toBe(42);
    inverseProperty = undefined;
    expect(label.fixed).toBe(false);
  });

  test("retains nine hidden own accessors in their existing order with shared functions", () => {
    const other = new Label({ inverse: () => undefined }, null);
    const fields = ["x", "y", "px", "py", "vx", "vy", "fixed", "fx", "fy"];
    expect(
      Object.getOwnPropertyNames(label).filter((key) => fields.includes(key)),
    ).toEqual(fields);
    for (const field of fields) {
      const descriptor = Object.getOwnPropertyDescriptor(label, field);
      const otherDescriptor = Object.getOwnPropertyDescriptor(other, field);
      expect(descriptor).toEqual({
        get: expect.any(Function),
        set: expect.any(Function),
        enumerable: false,
        configurable: false,
      });
      expect(otherDescriptor.get).toBe(descriptor.get);
      expect(otherDescriptor.set).toBe(descriptor.set);
      expect(Object.keys(label)).not.toContain(field);
    }
  });

  test("preserves property/link identity, callbacks and prototype delegation", () => {
    const link = {};
    const calls = [];
    primaryProperty.actualRadius = () => 19;
    primaryProperty.draw = (container) => {
      calls.push(container);
      return "drawn";
    };
    primaryProperty.equals = (other) => other === primaryProperty;
    inverseProperty.equals = (other) => other === inverseProperty;
    for (const name of ["frozen", "locked", "pinned"]) {
      primaryProperty[name] = function () {
        return this;
      };
    }
    const subject = new Label(primaryProperty, link);
    expect(subject).toBeInstanceOf(Label);
    expect(subject.property()).toBe(primaryProperty);
    expect(subject.link()).toBe(link);
    expect(subject.actualRadius()).toBe(19);
    expect(subject.draw(link)).toBe("drawn");
    expect(calls).toEqual([link]);
    expect(subject.inverse()).toBe(inverseProperty);
    expect(subject.equals(label)).toBe(true);
    expect(subject.equals(null)).toBe(false);
    for (const name of ["frozen", "locked", "pinned"]) {
      expect(subject[name]).toBe(primaryProperty[name]);
      expect(subject[name]()).toBe(subject);
    }
  });
});
