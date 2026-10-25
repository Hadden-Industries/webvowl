import { AbstractTextElement } from "./AbstractTextElement.js";
import {
  positionAbsoluteTextLine,
  truncateTextLine,
} from "./textLayoutBatch.js";

export { AbsoluteTextElement };
function AbsoluteTextElement(container, backgroundColor) {
  AbstractTextElement.apply(this, arguments);
}

AbsoluteTextElement.prototype = Object.create(AbstractTextElement.prototype);
AbsoluteTextElement.prototype.constructor = AbsoluteTextElement;

AbsoluteTextElement.prototype.addText = function (
  text,
  yShift,
  prefix,
  suffix,
) {
  if (text) {
    this.addTextline(text, this.CSS_CLASSES.default, yShift, prefix, suffix);
  }
};

AbsoluteTextElement.prototype.addSubText = function (text, yShift) {
  if (text) {
    this.addTextline(text, this.CSS_CLASSES.subtext, yShift, "(", ")");
  }
};

AbsoluteTextElement.prototype.addEquivalents = function (text, yShift) {
  if (text) {
    this.addTextline(text, this.CSS_CLASSES.default, yShift);
  }
};

AbsoluteTextElement.prototype.addInstanceCount = function (
  instanceCount,
  yShift,
) {
  if (instanceCount) {
    this.addTextline(
      instanceCount.toString(),
      this.CSS_CLASSES.instanceCount,
      yShift,
    );
  }
};

AbsoluteTextElement.prototype.addTextline = function (
  text,
  style,
  yShift,
  prefix,
  postfix,
) {
  const maxWidth = this._textBlock().datum().textWidth(yShift);

  const tspan = this._appendTextSpan(style);
  truncateTextLine(
    tspan.node(),
    { text, maxWidth, textStyle: style },
    (value) => tspan.text(this._applyPreAndPostFix(value, prefix, postfix)),
  );
  this._repositionTextLine(tspan, yShift);
};

AbsoluteTextElement.prototype._repositionTextLine = function (tspan, yShift) {
  /* BBox height is not supported in Firefox for tspans and dominant-baseline doesn't work in some SVG editors */
  positionAbsoluteTextLine(tspan.node(), yShift || 0);
};
