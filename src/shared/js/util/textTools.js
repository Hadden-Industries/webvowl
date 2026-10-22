const ADDITIONAL_TEXT_SPACE = 4;

const tools = {};
const measurementBatches = new WeakMap();

/**
 * Prime native widths before SVG writes, then reuse exact text/style inputs in
 * this document's synchronous draw epoch. Requests are hints: a missing label
 * still uses the native probe. The draw may change SVG contents, but must not
 * change the probe's body/inherited styles, fonts or viewport, or yield.
 * Every epoch is discarded on return/throw, including all unique label text;
 * later font/stylesheet changes need no observer or persistent cache key.
 */
tools.withMeasurementBatch = function (
  requests,
  draw,
  documentObject = globalThis.document,
) {
  if (measurementBatches.has(documentObject)) {
    return draw();
  }
  const cache = new Map();
  const probes = [];
  measurementBatches.set(documentObject, cache);
  try {
    try {
      for (const request of requests) {
        const text = String(request.text ?? "");
        const textStyle = request.textStyle || "text";
        let widths = cache.get(textStyle);
        if (!widths) {
          widths = new Map();
          cache.set(textStyle, widths);
        }
        if (widths.has(text)) {
          continue;
        }
        widths.set(text, undefined);
        const probe = createMeasurementProbe(text, textStyle, documentObject);
        probes.push({ probe, widths, text });
        documentObject.body.appendChild(probe);
      }
      // No writes between these reads: one native layout can serve the batch.
      for (const { probe, widths, text } of probes) {
        widths.set(text, probe.offsetWidth);
      }
    } finally {
      for (const { probe } of probes) {
        probe.remove();
      }
      probes.length = 0;
    }
    return draw();
  } finally {
    measurementBatches.delete(documentObject);
    cache.clear();
  }
};

function createMeasurementProbe(text, textStyle, documentObject) {
  const probe = documentObject.createElement("div");
  probe.setAttribute("class", textStyle + " text-measurement-probe");
  probe.textContent = text;
  return probe;
}

function measureTextWidth(
  text,
  textStyle,
  documentObject = globalThis.document,
) {
  text = String(text ?? "");
  textStyle = textStyle || "text";
  const cache = measurementBatches.get(documentObject);
  let widths = cache?.get(textStyle);
  if (widths?.has(text)) {
    return widths.get(text);
  }
  const measurementProbe = createMeasurementProbe(
    text,
    textStyle,
    documentObject,
  );
  documentObject.body.appendChild(measurementProbe);
  try {
    const measuredWidth = measurementProbe.offsetWidth;
    if (cache) {
      if (!widths) {
        widths = new Map();
        cache.set(textStyle, widths);
      }
      widths.set(text, measuredWidth);
    }
    return measuredWidth;
  } finally {
    measurementProbe.remove();
  }
}

tools.measureTextWidth = measureTextWidth;

tools.truncate = function (
  text,
  maxWidth,
  textStyle,
  additionalTextSpace,
  documentObject = globalThis.document,
) {
  maxWidth -= isNaN(additionalTextSpace)
    ? ADDITIONAL_TEXT_SPACE
    : additionalTextSpace;
  if (isNaN(maxWidth) || maxWidth <= 0) {
    return text;
  }

  let truncatedText = text,
    newTruncatedTextLength,
    textWidth,
    ratio;

  while (true) {
    textWidth = measureTextWidth(truncatedText, textStyle, documentObject);
    if (textWidth <= maxWidth) {
      break;
    }

    ratio = textWidth / maxWidth;
    newTruncatedTextLength = Math.floor(truncatedText.length / ratio);

    // detect if nothing changes
    if (truncatedText.length === newTruncatedTextLength) {
      break;
    }

    truncatedText = truncatedText.substring(0, newTruncatedTextLength);
  }

  if (text.length > truncatedText.length) {
    return text.substring(0, truncatedText.length - 3) + "...";
  }
  return text;
};

export function createTextTools() {
  return tools;
}
