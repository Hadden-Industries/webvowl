import { expect, test } from "@jest/globals";
import { overlaps, placeEntityPreview } from "./previewPlacement.js";

test.each([
  [375, 752, true],
  [320, 540, true],
  [1280, 800, false],
])(
  "keeps the card in %ix%i and clear of an ordinary selected box",
  (width, height, compact) => {
    for (let x = 30; x < width; x += 47) {
      for (let y = 40; y < height; y += 59) {
        const cardWidth = compact ? width - 24 : 320;
        const anchor = { xPx: x, yPx: y, widthPx: 16, heightPx: 16 };
        const result = placeEntityPreview({
          width,
          height,
          compact,
          cardWidth,
          cardHeight: 160,
          anchor,
        });
        expect(result.x).toBeGreaterThanOrEqual(0);
        expect(result.x + cardWidth).toBeLessThanOrEqual(width);
        expect(result.y + 160).toBeLessThanOrEqual(height);
        expect(result.overlapsAnchor).toBe(false);
        expect(
          overlaps(result, { x: x - 8, y: y - 8, width: 16, height: 16 }),
        ).toBe(false);
      }
    }
  },
);

test("hysteresis retains a clear position, but rechecks a changed card extent", () => {
  const input = {
    width: 1200,
    height: 800,
    compact: false,
    cardWidth: 320,
    cardHeight: 160,
    anchor: { xPx: 200, yPx: 300, widthPx: 40, heightPx: 40 },
  };
  const first = placeEntityPreview(input);
  const next = placeEntityPreview({
    ...input,
    anchor: { ...input.anchor, xPx: 202 },
    previous: first,
  });
  expect([next.x, next.y]).toEqual([first.x, first.y]);
  const tall = placeEntityPreview({
    ...input,
    cardHeight: 600,
    previous: first,
  });
  expect(tall.y + 600).toBeLessThanOrEqual(800);
});

test("offscreen and absent anchors never request camera movement; impossible clearance is explicit", () => {
  const input = {
    width: 375,
    height: 600,
    cardWidth: 351,
    cardHeight: 180,
    compact: true,
  };
  expect(placeEntityPreview(input).offscreen).toBe(false);
  expect(
    placeEntityPreview({
      ...input,
      anchor: { xPx: -300, yPx: -300, widthPx: 30, heightPx: 30 },
    }).offscreen,
  ).toBe(true);
  expect(
    placeEntityPreview({
      ...input,
      anchor: { xPx: 180, yPx: 300, widthPx: 1000, heightPx: 1000 },
    }).overlapsAnchor,
  ).toBe(true);
});

test("visible zoom controls and external focused controls remain clear", () => {
  const input = {
    width: 1200,
    height: 800,
    cardWidth: 320,
    cardHeight: 160,
    compact: false,
    anchor: { xPx: 750, yPx: 500, widthPx: 50, heightPx: 50 },
    obstacles: [{ x: 1120, y: 340, width: 60, height: 440 }],
  };
  const first = placeEntityPreview(input);
  expect(overlaps(first, input.obstacles[0])).toBe(false);
  const next = placeEntityPreview({
    ...input,
    previous: first,
    obstacles: [...input.obstacles, { ...first }],
  });
  expect(overlaps(next, first)).toBe(false);
  const hidden = placeEntityPreview({ ...input, anchor: null });
  expect(overlaps(hidden, input.obstacles[0])).toBe(false);
});
