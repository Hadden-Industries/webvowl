import * as d3 from "d3";
import { createRequire } from "node:module";

globalThis.d3 = d3;

const require = createRequire(import.meta.url);
const math = require("./math")();

function quadraticEndpointTangents( path ){
  const match = path.match(
    /^M\s*([^, ]+),([^ ]+)\s*Q\s*([^, ]+),([^ ]+)\s+([^, ]+),([^ ]+)\s*Q\s*([^, ]+),([^ ]+)\s+([^, ]+),([^ ]+)$/
  );

  if ( !match ) {throw new Error("Expected a two-segment quadratic path, received: " + path);}

  const values = match.slice(1).map(Number);
  const [startX, startY, firstControlX, firstControlY, , , finalControlX, finalControlY, endX, endY] = values;

  return {
    start: {
      x: firstControlX - startX,
      y: firstControlY - startY
    },
    end: {
      x: endX - finalControlX,
      y: endY - finalControlY
    }
  };
}

describe("three-point property curves", () => {
  test("provide usable endpoint tangents for automatically oriented markers", () => {
    const path = math.calculateCurvePath([
      { x: 0, y: 0 },
      { x: 50, y: 100 },
      { x: 100, y: 0 }
    ]);
    const tangents = quadraticEndpointTangents(path);

    expect(Math.hypot(tangents.start.x, tangents.start.y)).toBeGreaterThan(1e-6);
    expect(Math.hypot(tangents.end.x, tangents.end.y)).toBeGreaterThan(1e-6);
  });

  test("avoid numerically degenerate tangents for uneven point spacing", () => {
    const path = math.calculateCurvePath([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 100, y: 0 }
    ]);
    const tangents = quadraticEndpointTangents(path);

    expect(Math.hypot(tangents.start.x, tangents.start.y)).toBeGreaterThan(1e-6);
    expect(Math.hypot(tangents.end.x, tangents.end.y)).toBeGreaterThan(1e-6);
    expect(path).not.toMatch(/e[+-]?\d/i);
  });

  test("reject non-finite curve coordinates", () => {
    expect(() => math.calculateCurvePath([
      { x: 0, y: 0 },
      { x: Number.NaN, y: 10 },
      { x: 20, y: 20 }
    ])).toThrow("finite x and y coordinates");
  });

  test("keep endpoint tangents usable across deterministic property and loop layouts", () => {
    let seed = 0x5eed1234;
    const randomCoordinate = () => {
      seed = (1664525 * seed + 1013904223) % 0x100000000;
      return (seed / 0x100000000) * 1000 - 500;
    };

    for ( const tension of [0.7, -1] ) {
      for ( let iteration = 0; iteration < 250; iteration++ ) {
        const path = math.calculateCurvePath([
          { x: randomCoordinate(), y: randomCoordinate() },
          { x: randomCoordinate(), y: randomCoordinate() },
          { x: randomCoordinate(), y: randomCoordinate() }
        ], tension);
        const tangents = quadraticEndpointTangents(path);

        expect(Math.hypot(tangents.start.x, tangents.start.y)).toBeGreaterThan(1e-6);
        expect(Math.hypot(tangents.end.x, tangents.end.y)).toBeGreaterThan(1e-6);
      }
    }
  });
});

describe("loop property curves", () => {
  test("provide endpoint tangents for automatically oriented markers", () => {
    const node = {
      x: 100,
      y: 100,
      actualRadius: () => 40
    };
    const label = {
      x: 180,
      y: 100,
      increasedLoopAngle: false
    };
    const link = {
      domain: () => node,
      label: () => label,
      loops: () => [link]
    };

    const path = math.calculateLoopPath(link);

    expect(path).toMatch(/^M[^Q]+ Q[^Q]+ Q/);
  });
});
