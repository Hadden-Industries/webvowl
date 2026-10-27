import { expect, jest, test } from "@jest/globals";
import { projectLegacyLabelPosition } from "./legacyForceProjection.js";
import { createMath } from "../../../shared/js/util/math.js";
import { OwlClass } from "../elements/nodes/implementations/OwlClass.js";
import { RdfsDatatype } from "../elements/nodes/implementations/RdfsDatatype.js";

const math = createMath();

test("current circular and rectangular geometry agrees with the existing renderer mathematics", () => {
  let scale = false;
  const owner = { options: () => ({ scaleNodesByIndividuals: () => scale }) };
  const domain = new OwlClass(owner).radius(31);
  const range = new RdfsDatatype(owner).height(29);
  domain.individuals([{}, {}, {}]);
  for (const scaled of [false, true]) {
    scale = scaled;
    for (const [x, y] of [
      [0, 0],
      [83, 29],
      [-83, 29],
      [0, 97],
      [79, 0],
      [1e6, -1e6],
    ]) {
      domain.x = 0;
      domain.y = 0;
      range.x = x;
      range.y = y;
      const a = math.calculateIntersection(range, domain, 0);
      const b = math.calculateIntersection(domain, range, 0);
      expect(projectLegacyLabelPosition(domain, range)).toEqual({
        position: math.calculateCenter(a, b),
        domainIntersection: a,
        rangeIntersection: b,
      });
    }
  }
  range.x = 200;
  range.y = 100;
  const before = projectLegacyLabelPosition(domain, range);
  range.height(151);
  domain.radius(47);
  expect(projectLegacyLabelPosition(domain, range)).not.toEqual(before);
});

test("invalid endpoints and borders do not publish a partial projection", () => {
  const border = jest.fn(() => 10);
  const domain = { x: 0, y: 0, distanceToBorder: border };
  const range = { x: NaN, y: 20, distanceToBorder: border };
  expect(projectLegacyLabelPosition(domain, range)).toBeUndefined();
  expect(border).not.toHaveBeenCalled();
  expect(projectLegacyLabelPosition(null, range)).toBeUndefined();
  range.x = 20;
  range.distanceToBorder = () => NaN;
  expect(projectLegacyLabelPosition(domain, range)).toBeUndefined();
  expect(domain).toMatchObject({ x: 0, y: 0 });
  expect(range).toMatchObject({ x: 20, y: 20 });
});

test("a coincident pair uses its position without evaluating border geometry", () => {
  const distanceToBorder = jest.fn(() => {
    throw new Error("unused geometry");
  });
  const domain = { x: -21, y: 43, distanceToBorder };
  expect(projectLegacyLabelPosition(domain, { ...domain })).toEqual({
    position: { x: -21, y: 43 },
    domainIntersection: { x: -21, y: 43 },
    rangeIntersection: { x: -21, y: 43 },
  });
  expect(distanceToBorder).not.toHaveBeenCalled();
});
