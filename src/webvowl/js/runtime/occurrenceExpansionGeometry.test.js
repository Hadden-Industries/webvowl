import { expect, test } from "@jest/globals";
import {
  highestOccurrenceExpansionLevel,
  layOutOccurrenceExpansion,
  occurrenceCoverScale,
  parseSceneTransform,
  sampleCounterTransform,
} from "./occurrenceExpansionGeometry.js";

const viewport = { widthPx: 1200, heightPx: 800 };
const circle = { shape: "ellipse", widthPx: 100, heightPx: 100 };
const label = { shape: "rectangle", widthPx: 80, heightPx: 20 };

test("a circle grows in place to a readable summary size at level one", () => {
  expect(
    layOutOccurrenceExpansion({
      level: 1,
      occurrence: circle,
      anchor: { xPx: 600, yPx: 400 },
      viewport,
    }),
  ).toEqual({
    detail: "summary",
    widthPx: 280,
    heightPx: 280,
    centerXPx: 600,
    centerYPx: 400,
    followsOccurrence: true,
    fillsViewport: false,
  });
});

test("a circle already drawn large still grows by a visible margin", () => {
  const box = layOutOccurrenceExpansion({
    level: 1,
    occurrence: { shape: "ellipse", widthPx: 240, heightPx: 240 },
    anchor: { xPx: 600, yPx: 400 },
    viewport,
  });
  expect([box.widthPx, box.heightPx]).toEqual([360, 360]);
});

test("a level-one expansion slides inward instead of leaving the viewport", () => {
  const box = layOutOccurrenceExpansion({
    level: 1,
    occurrence: circle,
    anchor: { xPx: 20, yPx: 790 },
    viewport,
  });
  expect([box.centerXPx, box.centerYPx]).toEqual([152, 648]);
  expect(box.followsOccurrence).toBe(true);
});

test("a level-one expansion never exceeds a small viewport", () => {
  const box = layOutOccurrenceExpansion({
    level: 1,
    occurrence: circle,
    anchor: { xPx: 100, yPx: 100 },
    viewport: { widthPx: 260, heightPx: 500 },
  });
  expect([box.widthPx, box.heightPx]).toEqual([236, 236]);
  expect(box.centerXPx).toBe(130);
});

test("a circle at level two takes the centre of a roomy viewport", () => {
  expect(
    layOutOccurrenceExpansion({
      level: 2,
      occurrence: circle,
      anchor: { xPx: 90, yPx: 90 },
      viewport,
    }),
  ).toEqual({
    detail: "complete",
    widthPx: 720,
    heightPx: 720,
    centerXPx: 600,
    centerYPx: 400,
    followsOccurrence: false,
    fillsViewport: false,
  });
});

test.each([
  [{ widthPx: 390, heightPx: 700 }],
  [{ widthPx: 844, heightPx: 390 }],
])("a circle at level two fills a small viewport %j", (small) => {
  expect(
    layOutOccurrenceExpansion({
      level: 2,
      occurrence: circle,
      anchor: { xPx: 90, yPx: 90 },
      viewport: small,
    }),
  ).toEqual({
    detail: "complete",
    widthPx: small.widthPx,
    heightPx: small.heightPx,
    centerXPx: small.widthPx / 2,
    centerYPx: small.heightPx / 2,
    followsOccurrence: false,
    fillsViewport: true,
  });
});

test("a rectangle has one level, which already shows every attribute", () => {
  expect(highestOccurrenceExpansionLevel("rectangle")).toBe(1);
  expect(highestOccurrenceExpansionLevel("ellipse")).toBe(2);
  expect(
    layOutOccurrenceExpansion({
      level: 1,
      occurrence: label,
      anchor: { xPx: 600, yPx: 400 },
      viewport,
    }),
  ).toEqual({
    detail: "complete",
    widthPx: 360,
    heightPx: 320,
    centerXPx: 600,
    centerYPx: 400,
    followsOccurrence: true,
    fillsViewport: false,
  });
  expect(() =>
    layOutOccurrenceExpansion({
      level: 2,
      occurrence: label,
      anchor: { xPx: 600, yPx: 400 },
      viewport,
    }),
  ).toThrow(RangeError);
});

test("an expansion keeps its size until the zoomed node would outgrow it", () => {
  const box = { widthPx: 280, heightPx: 280 };
  expect(occurrenceCoverScale(box, { widthPx: 100, heightPx: 100 })).toBe(1);
  expect(occurrenceCoverScale(box, { widthPx: 240, heightPx: 240 })).toBe(1);
  // A 400px node needs a 460px shell to stay covered with a visible margin.
  expect(
    occurrenceCoverScale(box, { widthPx: 400, heightPx: 400 }),
  ).toBeCloseTo(460 / 280, 12);
  // A wide label is covered along whichever axis it outgrows first.
  expect(
    occurrenceCoverScale(
      { widthPx: 360, heightPx: 320 },
      { widthPx: 800, heightPx: 200 },
    ),
  ).toBeCloseTo(920 / 360, 12);
});

const lerp = (from, to, progress) => from + (to - from) * progress;

// Where a part drawn with `sample` ends up once the shell's own transform at
// the same instant is applied on top of it.
function placeOnScreen({ restingCenter, shell, sample }) {
  const shellNow = {
    xPx: lerp(shell.from.xPx, shell.to.xPx, sample.offset),
    yPx: lerp(shell.from.yPx, shell.to.yPx, sample.offset),
    scaleX: lerp(shell.from.scaleX, shell.to.scaleX, sample.offset),
    scaleY: lerp(shell.from.scaleY, shell.to.scaleY, sample.offset),
  };
  return {
    xPx: shellNow.xPx + shellNow.scaleX * (restingCenter.xPx + sample.xPx),
    yPx: shellNow.yPx + shellNow.scaleY * (restingCenter.yPx + sample.yPx),
    scaleX: shellNow.scaleX * sample.scaleX,
    scaleY: shellNow.scaleY * sample.scaleY,
  };
}

test.each([
  [
    "a circle growing out of its node",
    {
      restingCenter: { xPx: 0, yPx: -89 },
      shell: {
        from: { xPx: -132, yPx: 40, scaleX: 100 / 280, scaleY: 100 / 280 },
        to: { xPx: 0, yPx: 0, scaleX: 1, scaleY: 1 },
      },
      part: {
        from: { xPx: -132, yPx: 42, scale: 1.5 },
        to: { xPx: 0, yPx: -89, scale: 1 },
      },
    },
  ],
  [
    "a rectangle shrinking back, squashed more along one axis",
    {
      restingCenter: { xPx: -120, yPx: -130 },
      shell: {
        from: { xPx: 0, yPx: 0, scaleX: 1, scaleY: 1 },
        to: { xPx: 20, yPx: -8, scaleX: 80 / 360, scaleY: 20 / 320 },
      },
      part: {
        from: { xPx: -120, yPx: -130, scale: 1 },
        to: { xPx: 20, yPx: -8, scale: 0.75 },
      },
    },
  ],
])(
  "a part crosses a transforming shell in a straight line on screen: %s",
  (_, travel) => {
    const samples = sampleCounterTransform(travel);
    expect(samples.length).toBeGreaterThan(8);
    expect(samples[0].offset).toBe(0);
    expect(samples.at(-1).offset).toBe(1);
    for (const [index, sample] of samples.entries()) {
      if (index > 0) {
        expect(sample.offset).toBeGreaterThan(samples[index - 1].offset);
      }
      const onScreen = placeOnScreen({ ...travel, sample });
      const { from, to } = travel.part;
      expect(onScreen.xPx).toBeCloseTo(lerp(from.xPx, to.xPx, sample.offset));
      expect(onScreen.yPx).toBeCloseTo(lerp(from.yPx, to.yPx, sample.offset));
      // The part is never stretched, however unevenly the shell is.
      const scale = lerp(from.scale, to.scale, sample.offset);
      expect(onScreen.scaleX).toBeCloseTo(scale);
      expect(onScreen.scaleY).toBeCloseTo(scale);
    }
  },
);

test("a part at rest in a shell at rest needs no transform", () => {
  const atRest = { xPx: 0, yPx: 0, scaleX: 1, scaleY: 1 };
  const samples = sampleCounterTransform({
    restingCenter: { xPx: 10, yPx: 20 },
    shell: { from: atRest, to: atRest },
    part: {
      from: { xPx: 10, yPx: 20, scale: 1 },
      to: { xPx: 10, yPx: 20, scale: 1 },
    },
  });
  for (const sample of samples) {
    expect(sample.xPx).toBeCloseTo(0);
    expect(sample.yPx).toBeCloseTo(0);
    expect(sample.scaleX).toBeCloseTo(1);
    expect(sample.scaleY).toBeCloseTo(1);
  }
});

test.each([
  // The second form is what a running D3 viewport transition writes.
  [
    "translate(526.3541870117188, 400.10028076171875) scale(0.3252546489238739,0.3252546489238739)",
    {
      xPx: 526.3541870117188,
      yPx: 400.10028076171875,
      scale: 0.3252546489238739,
    },
  ],
  ["translate(12,-34.5)scale(0.75)", { xPx: 12, yPx: -34.5, scale: 0.75 }],
  ["translate(12 -34.5) scale(2)", { xPx: 12, yPx: -34.5, scale: 2 }],
  ["translate(1e2, 5)", { xPx: 100, yPx: 5, scale: 1 }],
  ["translate(7)", { xPx: 7, yPx: 0, scale: 1 }],
  [null, { xPx: 0, yPx: 0, scale: 1 }],
  ["", { xPx: 0, yPx: 0, scale: 1 }],
])("the scene transform %j is read as %j", (attribute, expected) => {
  expect(parseSceneTransform(attribute)).toEqual(expected);
});

test("a scene transform this layer cannot mirror is refused, not guessed", () => {
  expect(parseSceneTransform("matrix(1 0 0 1 5 5)")).toBeNull();
  expect(parseSceneTransform("translate(NaN,3)scale(1)")).toBeNull();
  expect(parseSceneTransform("translate(1,2)scale(0)")).toBeNull();
});
