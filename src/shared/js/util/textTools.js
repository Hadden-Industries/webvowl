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
  measurementBatches.set(documentObject, cache);
  try {
    primeWidths(requests, cache, documentObject);
    return draw();
  } finally {
    measurementBatches.delete(documentObject);
    cache.clear();
  }
};

function primeWidths(requests, cache, documentObject) {
  const probes = [];
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
  }
}

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

function* truncationSteps(text, maxWidth, additionalTextSpace) {
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
    textWidth = yield truncatedText;
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
}

tools.truncate = function (
  text,
  maxWidth,
  textStyle,
  additionalTextSpace,
  documentObject = globalThis.document,
) {
  const steps = truncationSteps(text, maxWidth, additionalTextSpace);
  let step = steps.next();
  while (!step.done) {
    step = steps.next(measureTextWidth(step.value, textStyle, documentObject));
  }
  return step.value;
};

/** Run the same shortening algorithm in native-measurement rounds before SVG text writes. */
tools.truncateBatch = function (
  requests,
  documentObject = globalThis.document,
) {
  return tools.withMeasurementBatch(
    [],
    () => {
      const cache = measurementBatches.get(documentObject);
      const rows = requests.map(
        ({ text, maxWidth, textStyle, additionalTextSpace }) => {
          const steps = truncationSteps(text, maxWidth, additionalTextSpace);
          return { steps, textStyle, step: steps.next() };
        },
      );
      let pending = rows.filter(({ step }) => !step.done);
      while (pending.length) {
        primeWidths(
          pending.map(({ step, textStyle }) => ({
            text: step.value,
            textStyle,
          })),
          cache,
          documentObject,
        );
        for (const row of pending) {
          row.step = row.steps.next(
            measureTextWidth(row.step.value, row.textStyle, documentObject),
          );
        }
        pending = pending.filter(({ step }) => !step.done);
      }
      return rows.map(({ step }) => step.value);
    },
    documentObject,
  );
};

export function createTextTools() {
  return tools;
}
