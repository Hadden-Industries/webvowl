// Pure sizing rules for the selected occurrence's in-place expansion. Every
// length is in CSS pixels of the graph viewport; nothing here reads the DOM.

const VIEWPORT_MARGIN_PX = 12;
const SUMMARY_DIAMETER_PX = 280;
// A circle already drawn large must still visibly grow when it is selected.
const SUMMARY_GROWTH_FACTOR = 1.5;
// Level two leaves a ring of graph around the circle: a click there collapses it.
const COMPLETE_DIAMETER_INSET_PX = 80;
const COMPLETE_DIAMETER_LIMIT_PX = 880;
const RECTANGLE_WIDTH_PX = 360;
const RECTANGLE_HEIGHT_PX = 320;
// Below either bound the complete view replaces the graph instead of floating
// over it, because a centred circle would leave too little room to read.
const SMALL_VIEWPORT_WIDTH_PX = 640;
const SMALL_VIEWPORT_HEIGHT_PX = 480;

const NUMBER_PATTERN = "([-+]?(?:\\d+\\.?\\d*|\\.\\d+)(?:[eE][-+]?\\d+)?|NaN)";
const TRANSLATE_PATTERN = new RegExp(
  `translate\\(\\s*${NUMBER_PATTERN}(?:[\\s,]+${NUMBER_PATTERN})?\\s*\\)`,
  "u",
);
const SCALE_PATTERN = new RegExp(`scale\\(\\s*${NUMBER_PATTERN}`, "u");

// A node zoomed past its expansion is still covered, with this much to spare.
const COVER_MARGIN_FACTOR = 1.15;

/** A rectangle is small enough that one level already shows everything. */
export function highestOccurrenceExpansionLevel(shape) {
  return shape === "ellipse" ? 2 : 1;
}

/**
 * How much a laid-out expansion must be scaled to keep covering its occurrence
 * at the current zoom. It is 1 until the drawn occurrence would outgrow the
 * expansion, so zooming changes where the text is, not how large it reads.
 */
export function occurrenceCoverScale(box, occurrenceOnScreen) {
  return Math.max(
    1,
    (COVER_MARGIN_FACTOR * occurrenceOnScreen.widthPx) / box.widthPx,
    (COVER_MARGIN_FACTOR * occurrenceOnScreen.heightPx) / box.heightPx,
  );
}

function clampCenter(center, size, extent) {
  const half = size / 2;
  const least = VIEWPORT_MARGIN_PX + half;
  const greatest = extent - VIEWPORT_MARGIN_PX - half;
  return least > greatest
    ? extent / 2
    : Math.max(least, Math.min(greatest, center));
}

/**
 * Where the expanded occurrence sits and how large it is. `occurrence` is the
 * drawn size on screen, `anchor` its centre, both at the current zoom.
 */
export function layOutOccurrenceExpansion({
  level,
  occurrence,
  anchor,
  viewport,
}) {
  if (
    !Number.isInteger(level) ||
    level < 1 ||
    level > highestOccurrenceExpansionLevel(occurrence.shape)
  ) {
    throw new RangeError("The occurrence has no such expansion level.");
  }
  const widthLimitPx = Math.max(0, viewport.widthPx - 2 * VIEWPORT_MARGIN_PX);
  const heightLimitPx = Math.max(0, viewport.heightPx - 2 * VIEWPORT_MARGIN_PX);
  if (level === 2) {
    const fillsViewport =
      viewport.widthPx < SMALL_VIEWPORT_WIDTH_PX ||
      viewport.heightPx < SMALL_VIEWPORT_HEIGHT_PX;
    const diameterPx = Math.min(
      COMPLETE_DIAMETER_LIMIT_PX,
      Math.max(
        0,
        Math.min(viewport.widthPx, viewport.heightPx) -
          COMPLETE_DIAMETER_INSET_PX,
      ),
    );
    return {
      detail: "complete",
      widthPx: fillsViewport ? viewport.widthPx : diameterPx,
      heightPx: fillsViewport ? viewport.heightPx : diameterPx,
      centerXPx: viewport.widthPx / 2,
      centerYPx: viewport.heightPx / 2,
      followsOccurrence: false,
      fillsViewport,
    };
  }
  let widthPx;
  let heightPx;
  if (occurrence.shape === "ellipse") {
    const diameterPx = Math.min(
      widthLimitPx,
      heightLimitPx,
      Math.max(
        SUMMARY_DIAMETER_PX,
        SUMMARY_GROWTH_FACTOR *
          Math.max(occurrence.widthPx, occurrence.heightPx),
      ),
    );
    widthPx = diameterPx;
    heightPx = diameterPx;
  } else {
    widthPx = Math.min(widthLimitPx, RECTANGLE_WIDTH_PX);
    heightPx = Math.min(heightLimitPx, RECTANGLE_HEIGHT_PX);
  }
  return {
    detail: occurrence.shape === "ellipse" ? "summary" : "complete",
    widthPx,
    heightPx,
    centerXPx: clampCenter(anchor.xPx, widthPx, viewport.widthPx),
    centerYPx: clampCenter(anchor.yPx, heightPx, viewport.heightPx),
    followsOccurrence: true,
    fillsViewport: false,
  };
}

// Straight segments stand in for a path that is a ratio of two linear terms.
// This many keep a name within a pixel of it even where a label's shell starts
// at a sixteenth of its height.
const COUNTER_TRANSFORM_SEGMENT_COUNT = 24;

const lerp = (from, to, progress) => from + (to - from) * progress;

/**
 * The transforms that carry a part straight across the screen while the shell
 * containing it is itself being transformed.
 *
 * Every placement is in the shell's laid-out pixels, measured from the shell's
 * centre, which is also the origin of its transform. `shell.from` and
 * `shell.to` are the shell's own transform at either end, as
 * `{ xPx, yPx, scaleX, scaleY }`. `part.from` and `part.to` are where the part
 * should appear at either end, as its centre and one uniform `scale` relative
 * to its laid-out size. `restingCenter` is where layout alone puts the part.
 *
 * The part's transform has to undo the shell's at every instant, and that is
 * not linear in progress, so two keyframes cannot express it: a part given
 * only its end states would swell and drift in between. The result is sampled
 * instead, as `{ offset, xPx, yPx, scaleX, scaleY }` for a transform applied
 * about the part's own centre. Both animations must share one easing so that
 * equal offsets mean equal instants.
 */
export function sampleCounterTransform({ restingCenter, shell, part }) {
  return Array.from(
    { length: COUNTER_TRANSFORM_SEGMENT_COUNT + 1 },
    (_, index) => {
      const offset = index / COUNTER_TRANSFORM_SEGMENT_COUNT;
      const shellScaleX = lerp(shell.from.scaleX, shell.to.scaleX, offset);
      const shellScaleY = lerp(shell.from.scaleY, shell.to.scaleY, offset);
      const scale = lerp(part.from.scale, part.to.scale, offset);
      return {
        offset,
        xPx:
          (lerp(part.from.xPx, part.to.xPx, offset) -
            lerp(shell.from.xPx, shell.to.xPx, offset)) /
            shellScaleX -
          restingCenter.xPx,
        yPx:
          (lerp(part.from.yPx, part.to.yPx, offset) -
            lerp(shell.from.yPx, shell.to.yPx, offset)) /
            shellScaleY -
          restingCenter.yPx,
        scaleX: scale / shellScaleX,
        scaleY: scale / shellScaleY,
      };
    },
  );
}

/**
 * Reads the scene group's own `translate(x,y)scale(k)` attribute, including the
 * intermediate values a running viewport transition writes. Returns null for a
 * transform this form cannot represent, so a caller never mirrors a guess.
 */
export function parseSceneTransform(attributeText) {
  if (!attributeText) {
    return { xPx: 0, yPx: 0, scale: 1 };
  }
  const translate = TRANSLATE_PATTERN.exec(attributeText);
  const scale = SCALE_PATTERN.exec(attributeText);
  if (!translate) {
    return null;
  }
  const transform = {
    xPx: Number(translate[1]),
    yPx: translate[2] === undefined ? 0 : Number(translate[2]),
    scale: scale ? Number(scale[1]) : 1,
  };
  return Number.isFinite(transform.xPx) &&
    Number.isFinite(transform.yPx) &&
    Number.isFinite(transform.scale) &&
    transform.scale > 0
    ? transform
    : null;
}
