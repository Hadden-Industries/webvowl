import { PlainLink } from "./PlainLink.js";
import { ArrowLink } from "./ArrowLink.js";
import { BoxArrowLink } from "./BoxArrowLink.js";

test.each([PlainLink, ArrowLink, BoxArrowLink])(
  "%p shares methods while keeping instance state and apply inheritance isolated",
  (Constructor) => {
    const node = {
      equals(other) {
        return this === other;
      },
    };
    const property = { inverse: () => null };
    const a = new Constructor(node, node, property);
    const b = new Constructor({}, {}, { inverse: () => null });
    for (const method of [
      "domain",
      "range",
      "label",
      "layers",
      "layerIndex",
      "loops",
      "loopIndex",
      "linkParts",
      "pathObj",
    ]) {
      expect(a[method]).toBe(b[method]);
      expect(Object.hasOwn(a, method)).toBe(false);
      expect(
        Object.getOwnPropertyDescriptor(PlainLink.prototype, method),
      ).toMatchObject({ enumerable: true, configurable: true, writable: true });
    }
    for (const accessor of ["layers", "layerIndex", "loops", "loopIndex"]) {
      expect(a[accessor](undefined)).toBe(a);
      expect(a[accessor]([1, 2])).toBe(a);
      expect(b[accessor]()).toBeUndefined();
    }
    expect(a.pathObj("path")).toBeUndefined();
    expect(a.pathObj()).toBe("path");
    expect(b.pathObj()).toBeUndefined();
    expect(a.domain()).toBe(node);
    expect(a.range()).toBe(node);
    expect(a.label()).not.toBe(b.label());
    expect(a.property()).toBe(property);
    expect(a.isLoop()).toBe(true);
    expect(a.linkParts()).toEqual(a.linkParts());
    expect(a.linkParts()).not.toBe(a.linkParts());
    expect(PlainLink.prototype.domain.call(b)).toBe(b.domain());
  },
);
