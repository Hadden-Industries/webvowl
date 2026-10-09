import { test, expect } from "@jest/globals";
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceX,
  forceY,
} from "d3";
import { Label } from "../elements/links/Label.js";
import { OwlObjectProperty } from "../elements/properties/implementations/owlObjectProperty.js";

test("real labels follow the numeric D3 trajectory through initialization, pinning and release", () => {
  const properties = Array.from({ length: 17 }, (_, index) =>
    new OwlObjectProperty({ language: () => "en" }).id(`property-${index}`),
  );
  const labels = properties.map((property) => new Label(property, null));
  const inverse = new OwlObjectProperty({ language: () => "en" });
  properties[0].inverse(inverse);
  inverse.inverse(properties[0]);
  inverse.fixed = true;
  const numeric = labels.map(() => ({}));
  for (const points of [labels, numeric]) {
    points.forEach((point, index) => {
      point.x = index === 0 ? 0 : index * 13;
      point.y = index === 0 ? 0 : -index * 7;
      point.fx = null;
      point.fy = null;
      point.px = point.x;
      point.py = point.y;
      point.fixed = false;
    });
  }
  numeric[0].fixed = true;
  function simulate(points) {
    const links = points
      .slice(1)
      .map((point, index) => ({ source: points[index], target: point }));
    return forceSimulation(points)
      .stop()
      .force("link", forceLink(links).distance(150).strength(1))
      .force("charge", forceManyBody().strength(-400))
      .force("center", forceCenter(400, 300))
      .force("x", forceX(400).strength(0.025))
      .force("y", forceY(300).strength(0.025));
  }
  const labelSimulation = simulate(labels),
    numericSimulation = simulate(numeric);
  const fields = [
    "index",
    "x",
    "y",
    "px",
    "py",
    "vx",
    "vy",
    "fixed",
    "fx",
    "fy",
  ];
  try {
    for (let tick = 0; tick <= 300; tick++) {
      if ([0, 1, 30, 120, 300].includes(tick)) {
        expect(
          labels.map((point) => fields.map((field) => point[field])),
        ).toEqual(numeric.map((point) => fields.map((field) => point[field])));
        expect(labelSimulation.alpha()).toBe(numericSimulation.alpha());
        for (const point of [...labels, ...numeric]) {
          for (const field of ["x", "y", "vx", "vy"]) {
            expect(Number.isFinite(point[field])).toBe(true);
          }
        }
      }
      if (tick === 30) {
        properties[0].pinned(true);
        numeric[0].fx = numeric[0].x;
        numeric[0].fy = numeric[0].y;
        expect(labels[0].pinned()).toBe(true);
      }
      if (tick === 120) {
        properties[0].pinned(false);
        numeric[0].fx = null;
        numeric[0].fy = null;
      }
      labelSimulation.tick();
      numericSimulation.tick();
    }
  } finally {
    labelSimulation.stop();
    numericSimulation.stop();
  }
});
