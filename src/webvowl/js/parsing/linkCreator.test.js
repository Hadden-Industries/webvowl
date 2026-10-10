import { expect, jest, test } from "@jest/globals";
import { ArrowLink } from "../elements/links/ArrowLink.js";
import { PlainLink } from "../elements/links/PlainLink.js";
import { BoxArrowLink } from "../elements/links/BoxArrowLink.js";
import { OwlDisjointWith } from "../elements/properties/implementations/OwlDisjointWith.js";
import { SetOperatorProperty } from "../elements/properties/implementations/SetOperatorProperty.js";

let endpointReads = 0;
jest.unstable_mockModule("../elements/links/ArrowLink.js", () => ({
  ArrowLink: function (...args) {
    const link = new ArrowLink(...args);
    for (const name of ["domain", "range"]) {
      const readEndpoint = link[name];
      link[name] = () => {
        endpointReads++;
        return readEndpoint.call(link);
      };
    }
    return link;
  },
}));
const { createLinkCreator } = await import("./linkCreator.js");

test("empty and mixed-kind revisions replace metadata without merging endpoint IDs", () => {
  const creator = createLinkCreator();
  expect(creator.createLinks([])).toEqual([]);
  const a = { id: () => "same" },
    b = { id: () => "same" };
  const owner = { language: () => "en" };
  const disjoint = new OwlDisjointWith(owner).id("disjoint").domain(a).range(b);
  const set = new SetOperatorProperty(owner).id("set").domain(b).range(a);
  const properties = [
    property("arrow", a, b),
    disjoint,
    set,
    property("self", b, b),
  ];
  const first = creator.createLinks(properties);
  const second = creator.createLinks(properties);
  expect(first[0]).toBeInstanceOf(ArrowLink);
  expect(first[1].constructor).toBe(PlainLink);
  expect(first[2]).toBeInstanceOf(BoxArrowLink);
  expect(first[0].layers()).toEqual(first.slice(0, 3));
  expect(first[3].layers()).toEqual([first[3]]);
  expect(first[3].loops()).toEqual([first[3]]);
  expect(second[0].layers()).not.toBe(first[0].layers());
  expect(second[0].layers()).toEqual(second.slice(0, 3));
  expect(properties[0].link()).toBe(second[0]);
});

function property(id, domain, range) {
  let link, inverse;
  return {
    id: () => id,
    domain: () => domain,
    range: () => range,
    inverse: () => inverse,
    setInverse: (value) => {
      inverse = value;
    },
    link(value) {
      if (!arguments.length) {
        return link;
      }
      link = value;
    },
  };
}

test("indexed layers and loops preserve reference identity, order, inverse and ID deduplication", () => {
  const equalA = {},
    b = {};
  const a = { equals: (other) => other === a || other === equalA };
  const p = property("p", a, b),
    inverse = property("inverse", b, a);
  p.setInverse(inverse);
  inverse.setInverse(p);
  const properties = [
    p,
    property("l1", a, a),
    inverse,
    property("back", b, a),
    property("l2", a, a),
    property("equal", a, equalA),
    property("p", b, b),
  ];
  const links = createLinkCreator().createLinks(properties);
  expect(links.map((link) => link.property().id())).toEqual([
    "p",
    "l1",
    "back",
    "l2",
    "equal",
  ]);
  expect(inverse.link()).toBe(p.link());
  expect(links[0].layers()).toEqual([links[0], links[2]]);
  expect(links[0].layers()).toBe(links[2].layers());
  expect(links[1].layers()).toEqual([links[1], links[3]]);
  expect(links[1].loops()).toBe(links[3].loops());
  expect(links[1].loops()).toEqual([links[1], links[3]]);
  expect(links.map((link) => link.layerIndex())).toEqual([0, 0, 1, 1, 0]);
  expect(links.map((link) => link.loopIndex())).toEqual([
    undefined,
    0,
    undefined,
    1,
    undefined,
  ]);
  // Semantic equals does not redefine the reference-based metadata grouping.
  expect(links[4].isLoop()).toBe(true);
  expect(links[4].loops()).toBeUndefined();
  expect(links[4].layers()).toEqual([links[4]]);
});

test("metadata grouping uses a bounded number of endpoint reads on distinct pairs", () => {
  endpointReads = 0;
  const properties = Array.from({ length: 1000 }, (_, i) =>
    property(`p-${i}`, {}, {}),
  );
  const links = createLinkCreator().createLinks(properties);
  expect(endpointReads).toBe(2 * properties.length);
  // Property endpoints are read once during construction, independent of E.
  const counted = properties.map((p, i) => ({
    ...p,
    id: () => `c-${i}`,
    domain: jest.fn(p.domain),
    range: jest.fn(p.range),
  }));
  const next = createLinkCreator().createLinks(counted);
  expect(next).toHaveLength(links.length);
  expect(
    counted.reduce(
      (sum, p) => sum + p.domain.mock.calls.length + p.range.mock.calls.length,
      0,
    ),
  ).toBe(2000);
  expect(
    next.every(
      (link) =>
        link.layers().length === 1 &&
        link.layerIndex() === 0 &&
        link.loops() === undefined,
    ),
  ).toBe(true);
});
