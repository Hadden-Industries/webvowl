export { AbstractTextElement };

function AbstractTextElement(container, backgroundColor) {
  const textColor = this._getTextColor(backgroundColor);
  let classes = "text";
  if (textColor === AbstractTextElement.prototype.LIGHT_TEXT_COLOR) {
    classes += " text-on-dark";
  }
  if (textColor === AbstractTextElement.prototype.DARK_TEXT_COLOR) {
    classes += " text-on-light";
  }
  const textBlock = container
    .append("text")
    .attr("class", classes)
    .attr("text-anchor", "middle");

  this._textBlock = function () {
    return textBlock;
  };
}

AbstractTextElement.prototype.LINE_DISTANCE = 1;
AbstractTextElement.prototype.CSS_CLASSES = {
  default: "text",
  subtext: "subtext",
  instanceCount: "instance-count",
};
AbstractTextElement.prototype.DARK_TEXT_COLOR = "#000";
AbstractTextElement.prototype.LIGHT_TEXT_COLOR = "#fff";

// Fresh spans have no classes to preserve; publish their classes in one write.
AbstractTextElement.prototype._appendTextSpan = function (style) {
  const defaultStyle = this.CSS_CLASSES.default;
  return this._textBlock()
    .append("tspan")
    .attr("class", style === defaultStyle ? style : defaultStyle + " " + style)
    .attr("x", 0);
};

AbstractTextElement.prototype.translation = function (x, y) {
  this._textBlock().attr("transform", "translate(" + x + ", " + y + ")");
  return this;
};

AbstractTextElement.prototype.remove = function () {
  this._textBlock().remove();
  return this;
};

AbstractTextElement.prototype._applyPreAndPostFix = function (
  text,
  prefix,
  postfix,
) {
  if (prefix) {
    text = prefix + text;
  }
  if (postfix) {
    text += postfix;
  }
  return text;
};

AbstractTextElement.prototype._getTextColor = function (rawBackgroundColor) {
  if (!rawBackgroundColor) {
    return AbstractTextElement.prototype.DARK_TEXT_COLOR;
  }

  const backgroundColor = parseCssColorChannels(rawBackgroundColor);
  if (backgroundColor === null) {
    return AbstractTextElement.prototype.DARK_TEXT_COLOR;
  }
  if (calculateLuminance(backgroundColor) > 0.5) {
    return AbstractTextElement.prototype.DARK_TEXT_COLOR;
  } else {
    return AbstractTextElement.prototype.LIGHT_TEXT_COLOR;
  }
};

// Parses a background colour for the single purpose of choosing dark or
// light label text.
// Accepts the forms WebVOWL actually supplies: a colour object carrying r, g
// and b channels, hexadecimal notation, or rgb()/rgba() notation. Anything
// else falls back to dark text, matching the existing absent-colour case.
function parseCssColorChannels(rawColor) {
  if (
    rawColor !== null &&
    typeof rawColor === "object" &&
    Number.isFinite(rawColor.r) &&
    Number.isFinite(rawColor.g) &&
    Number.isFinite(rawColor.b)
  ) {
    return { r: rawColor.r, g: rawColor.g, b: rawColor.b };
  }
  if (typeof rawColor !== "string" || rawColor.trim().length === 0) {
    return null;
  }
  const color = rawColor.trim();

  const shortHexMatch = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(color);
  if (shortHexMatch) {
    return {
      r: Number.parseInt(shortHexMatch[1].repeat(2), 16),
      g: Number.parseInt(shortHexMatch[2].repeat(2), 16),
      b: Number.parseInt(shortHexMatch[3].repeat(2), 16),
    };
  }

  const longHexMatch = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(
    color,
  );
  if (longHexMatch) {
    return {
      r: Number.parseInt(longHexMatch[1], 16),
      g: Number.parseInt(longHexMatch[2], 16),
      b: Number.parseInt(longHexMatch[3], 16),
    };
  }

  const functionalMatch =
    /^rgba?\(\s*([0-9.]+)\s*[, ]\s*([0-9.]+)\s*[, ]\s*([0-9.]+)/i.exec(color);
  if (functionalMatch) {
    return {
      r: Number(functionalMatch[1]),
      g: Number(functionalMatch[2]),
      b: Number(functionalMatch[3]),
    };
  }

  return null;
}

function calculateLuminance(color) {
  return (
    0.3 * (color.r / 255) + 0.59 * (color.g / 255) + 0.11 * (color.b / 255)
  );
}
