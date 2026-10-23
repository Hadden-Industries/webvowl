import { createTextTools } from "./textTools.js";

const activeBatches = new WeakMap();
const textTools = createTextTools();

/**
 * Complete one synchronous SVG draw before publishing it. Font reads precede
 * line writes, then block reads precede centering writes. No metric or element
 * survives this call, so later fonts/styles and replacement documents are read
 * afresh. Draw callbacks must not consume intermediate text coordinates.
 */
export function withTextLayoutBatch(documentObject, draw) {
  if (activeBatches.has(documentObject)) {
    return draw();
  }
  const batch = { texts: [], lines: new Map(), blocks: new Set() };
  activeBatches.set(documentObject, batch);
  try {
    const result = draw();
    const texts = textTools.truncateBatch(
      batch.texts.map(({ request }) => request),
      documentObject,
    );
    batch.texts.forEach(({ apply }, index) => apply(texts[index]));
    const lines = Array.from(batch.lines, ([span, placement]) => ({
      span,
      attribute: placement.attribute,
      value: placement.factor * fontSize(span) + placement.offset + "px",
    }));
    for (const { span, attribute, value } of lines) {
      span.setAttribute(attribute, value);
    }
    const blocks = Array.from(batch.blocks, (block) => ({
      block,
      y: -block.getBBox().height * 0.5 + "px",
    }));
    for (const { block, y } of blocks) {
      block.setAttribute("y", y);
    }
    return result;
  } finally {
    // A rejected preparation must not keep detached elements or leak work into
    // the recovery draw. No queued placement is published if draw() throws.
    activeBatches.delete(documentObject);
    batch.texts.length = 0;
    batch.lines.clear();
    batch.blocks.clear();
  }
}

/** Defer shortening only inside a synchronous draw; ordinary edits remain immediate. */
export function truncateTextLine(span, request, apply) {
  const batch = activeBatches.get(span.ownerDocument);
  if (batch) {
    batch.texts.push({ request, apply });
  } else {
    apply(
      textTools.truncate(
        request.text,
        request.maxWidth,
        request.textStyle,
        request.additionalTextSpace,
        span.ownerDocument,
      ),
    );
  }
}

function fontSize(node) {
  return parseFloat(
    node.ownerDocument.defaultView
      .getComputedStyle(node)
      .getPropertyValue("font-size"),
  );
}

/** Place a centered block's line using its actual computed font size. */
export function positionCenteredTextLine(span, lineDistance) {
  positionLine(span, "dy", 1, lineDistance);
}

/** Keep the existing one-third-font-size baseline approximation. */
export function positionAbsoluteTextLine(span, yShift) {
  positionLine(span, "y", 1 / 3, yShift);
}

function positionLine(span, attribute, factor, offset) {
  const batch = activeBatches.get(span.ownerDocument);
  if (batch) {
    batch.lines.set(span, { attribute, factor, offset });
  } else {
    span.setAttribute(attribute, factor * fontSize(span) + offset + "px");
  }
}

/** Center a completed SVG text block using the browser's own geometry. */
export function centerTextBlock(block) {
  const batch = activeBatches.get(block.ownerDocument);
  if (batch) {
    batch.blocks.add(block);
  } else {
    block.setAttribute("y", -block.getBBox().height * 0.5 + "px");
  }
}
