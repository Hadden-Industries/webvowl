const BaseNode = require("./BaseNode");
const CenteringTextElement = require("../../util/CenteringTextElement");
const textTools = require("../../util/textTools")();
const drawTools = require("../drawTools")();
const rectangularElementTools = require("../rectangularElementTools")();

module.exports = (function () {
  const o = function (graph) {
    BaseNode.apply(this, arguments);

    const that = this;
    let height = 20;
    let width = 60;
    let pinGroupElement;
    let haloGroupElement;
    let labelWidth = 80;
    let myWidth = 80;
    const defaultWidth = 80;
    let shapeElement;
    let textBlock;
    const smallestRadius = height / 2;

    that.renderType("rect");
    // Properties
    this.height = function (p) {
      if (!arguments.length) {
        return height;
      }
      height = p;
      return this;
    };

    this.width = function (p) {
      if (!arguments.length) {
        return width;
      }
      width = p;
      return this;
    };

    this.getHalos = function () {
      return haloGroupElement;
    };

    // Functions
    // for compatibility reasons // TODO resolve
    this.actualRadius = function () {
      return smallestRadius;
    };

    this.distanceToBorder = function (dx, dy) {
      return rectangularElementTools.distanceToBorder(that, dx, dy);
    };

    this.setHoverHighlighting = function (enable) {
      that.nodeElement().selectAll("rect").classed("hovered", enable);

      const haloGroup = that.getHalos();
      if (haloGroup) {
        const test = haloGroup.selectAll(".searchResultA");
        test.classed("searchResultA", false);
        test.classed("searchResultB", true);
      }
    };

    // overwrite the labelWith;

    this.textWidth = function () {
      return labelWidth;
    };
    this.width = function () {
      return labelWidth;
    };

    this.getMyWidth = function () {
      // use a simple heuristic
      const text = that.labelForCurrentLanguage();
      myWidth = textTools.measureTextWidth(text, "text") + 20;

      // check for sub names;
      const indicatorText = that.indicationString();
      const indicatorWidth =
        textTools.measureTextWidth(indicatorText, "subtext") + 20;
      if (indicatorWidth > myWidth) {
        myWidth = indicatorWidth;
      }

      return myWidth;
    };

    this.textWidth = function () {
      return that.width();
    };
    this.toggleFocus = function () {
      that.focused(!that.focused());
      that.nodeElement().select("rect").classed("focused", that.focused());
      graph.resetSearchHighlight();
      graph.dispatchEvent(new CustomEvent("searchcleared"));
    };

    /**
     * Draws the rectangular node.
     * @param parentElement the element to which this node will be appended
     * @param [additionalCssClasses] additional css classes
     */
    this.draw = function (parentElement, additionalCssClasses) {
      let cssClasses = that.collectCssClasses();

      that.nodeElement(parentElement);

      if (additionalCssClasses instanceof Array) {
        cssClasses = cssClasses.concat(additionalCssClasses);
      }

      // set the value for that.width()
      // update labelWidth Value;
      if (graph.options().dynamicLabelWidth() === true) {
        labelWidth = Math.min(
          that.getMyWidth(),
          graph.options().maxLabelWidth(),
        );
      } else {
        labelWidth = defaultWidth;
      }

      width = labelWidth;
      shapeElement = drawTools.appendRectangularClass(
        parentElement,
        that.width(),
        that.height(),
        cssClasses,
        that.labelForCurrentLanguage(),
        that.backgroundColor(),
      );

      textBlock = new CenteringTextElement(
        parentElement,
        that.backgroundColor(),
      );
      textBlock.addText(that.labelForCurrentLanguage());

      that.addMouseListeners();

      if (that.pinned()) {
        that.drawPin();
      }
      if (that.halo()) {
        that.drawHalo(false);
      }
    };

    this.drawPin = function () {
      that.pinned(true);
      // if (graph.options().dynamicLabelWidth()===true) labelWidth=that.getMyWidth();
      // else                							labelWidth=defaultWidth;
      // width=labelWidth;
      // console.log("this element label Width is "+labelWidth);
      const dx = -0.5 * labelWidth + 5,
        dy = -1.1 * height;

      pinGroupElement = drawTools.drawPin(
        that.nodeElement(),
        dx,
        dy,
        this.removePin,
        graph.options().showDraggerObject,
        graph.options().useAccuracyHelper(),
      );
    };

    this.removePin = function () {
      that.pinned(false);
      if (pinGroupElement) {
        pinGroupElement.remove();
      }
      graph.updateStyle();
    };

    this.removeHalo = function () {
      that.halo(false);
      if (haloGroupElement) {
        haloGroupElement.remove();
        haloGroupElement = null;
      }
    };

    this.drawHalo = function (pulseAnimation) {
      that.halo(true);

      const offset = 0;
      haloGroupElement = drawTools.drawRectHalo(
        that,
        this.width(),
        this.height(),
        offset,
      );

      if (pulseAnimation === false) {
        const pulseItem = haloGroupElement.selectAll(".searchResultA");
        pulseItem.classed("searchResultA", false);
        pulseItem.classed("searchResultB", true);
        pulseItem.attr("animationRunning", false);
      }

      if (that.pinned()) {
        const selectedNode = pinGroupElement.node();
        const nodeContainer = selectedNode.parentNode;
        nodeContainer.appendChild(selectedNode);
      }
    };

    this.updateTextElement = function () {
      textBlock.updateAllTextElements();
    };

    this.textBlock = function () {
      return textBlock;
    };

    this.redrawLabelText = function () {
      textBlock.remove();
      textBlock = new CenteringTextElement(
        that.nodeElement(),
        that.backgroundColor(),
      );
      textBlock.addText(that.labelForCurrentLanguage());
      that.animateDynamicLabelWidth(graph.options().dynamicLabelWidth());
      shapeElement.select("title").text(that.labelForCurrentLanguage());
    };

    this.animateDynamicLabelWidth = function (dynamic) {
      that.removeHalo();
      const height = that.height();
      if (dynamic === true) {
        labelWidth = Math.min(
          that.getMyWidth(),
          graph.options().maxLabelWidth(),
        );
        shapeElement
          .transition()
          .tween("attr", function () {})
          .ease(d3.easeLinear)
          .duration(100)
          .attr({
            x: -labelWidth / 2,
            y: -height / 2,
            width: labelWidth,
            height: height,
          })
          .on("end", function () {
            that.updateTextElement();
          });
      } else {
        labelWidth = defaultWidth;
        that.updateTextElement();
        shapeElement
          .transition()
          .tween("attr", function () {})
          .ease(d3.easeLinear)
          .duration(100)
          .attr({
            x: -labelWidth / 2,
            y: -height / 2,
            width: labelWidth,
            height: height,
          });
      }

      // for the pin we dont need to differ between different widths -- they are already set
      if (that.pinned() === true && pinGroupElement) {
        const dx = 0.5 * labelWidth - 10,
          dy = -1.1 * height;

        pinGroupElement
          .transition()
          .tween("attr.translate", function () {})
          .attr("transform", "translate(" + dx + "," + dy + ")")
          .ease(d3.easeLinear)
          .duration(100);
      }
    };

    this.addTextLabelElement = function () {
      const parentElement = that.nodeElement();
      textBlock = new CenteringTextElement(
        parentElement,
        this.backgroundColor(),
      );
      textBlock.addText(that.labelForCurrentLanguage());
    };
  };
  o.prototype = Object.create(BaseNode.prototype);
  o.prototype.constructor = o;

  return o;
})();
