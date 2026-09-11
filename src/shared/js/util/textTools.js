const ADDITIONAL_TEXT_SPACE = 4;

const tools = {};

function measureTextWidth(
  text,
  textStyle,
  documentObject = globalThis.document,
) {
  // Set a default value
  if (!textStyle) {
    textStyle = "text";
  }
  const measurementProbe = documentObject.createElement("div");
  measurementProbe.setAttribute("class", textStyle + " text-measurement-probe");
  measurementProbe.textContent = text;
  documentObject.body.appendChild(measurementProbe);
  const measuredWidth = measurementProbe.offsetWidth;
  measurementProbe.remove();
  return measuredWidth;
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
