import {
  appendDragHandleGroup,
  drawDragHandle,
  hideDragHandle,
} from "./dragHandleView.js";

export function createClassDragger(graph) {
  /** variable defs **/
  const Class_dragger = {};
  Class_dragger.nodeId = 10001;
  Class_dragger.parent = undefined;
  Class_dragger.x = 0;
  Class_dragger.y = 0;
  Class_dragger.rootElement = undefined;
  Class_dragger.rootNodeLayer = undefined;
  Class_dragger.pathLayer = undefined;
  Class_dragger.mouseEnteredVar = false;
  Class_dragger.mouseButtonPressed = false;
  Class_dragger.nodeElement = undefined;
  Class_dragger.draggerObject = undefined;
  Class_dragger.pathElement = undefined;
  Class_dragger.typus = "Class_dragger";

  Class_dragger.type = function () {
    return Class_dragger.typus;
  };

  Class_dragger.parentNode = function () {
    return Class_dragger.parent;
  };

  Class_dragger.setParentNode = function (parentNode) {
    Class_dragger.parent = parentNode;

    if (Class_dragger.mouseButtonPressed === false) {
      if (
        Class_dragger.parent.actualRadius &&
        Class_dragger.parent.actualRadius()
      ) {
        Class_dragger.x =
          Class_dragger.parent.x + 10 + Class_dragger.parent.actualRadius();
        Class_dragger.y =
          Class_dragger.parent.y + 10 + Class_dragger.parent.actualRadius();
      } else {
        Class_dragger.x = Class_dragger.parent.x + 60;
        Class_dragger.y = Class_dragger.parent.y + 60;
      }
    }
    Class_dragger.updateElement();
  };

  Class_dragger.hideDragger = function (val) {
    hideDragHandle(Class_dragger, val);
  };
  /** BASE HANDLING FUNCTIONS ------------------------------------------------- **/
  Class_dragger.id = function (index) {
    if (!arguments.length) {
      return Class_dragger.nodeId;
    }
    Class_dragger.nodeId = index;
  };

  Class_dragger.svgPathLayer = function (layer) {
    Class_dragger.pathLayer = appendDragHandleGroup(layer);
  };

  Class_dragger.svgRoot = function (root) {
    if (!arguments.length) {
      return Class_dragger.rootElement;
    }
    Class_dragger.rootElement = root;
    Class_dragger.rootNodeLayer = appendDragHandleGroup(
      Class_dragger.rootElement,
    );
    Class_dragger.addMouseEvents();
  };

  /** DRAWING FUNCTIONS ------------------------------------------------- **/
  Class_dragger.drawNode = function () {
    Object.assign(
      Class_dragger,
      drawDragHandle({
        pathLayer: Class_dragger.pathLayer,
        rootNodeLayer: Class_dragger.rootNodeLayer,
        pathData: "M 20,40 C 0,15 0,-15 20,-40 L -40,0 Z",
        useAccuracyHelper: graph.options().useAccuracyHelper(),
        createAccuracyTarget: true,
        showDraggerObject: graph.options().showDraggerObject(),
      }),
    );
  };

  Class_dragger.updateElement = function () {
    // Class_dragger.pathLayer.attr("transform", "translate(" + Class_dragger.x + "," + Class_dragger.y + ")");
    // Class_dragger.rootElement.attr("transform", "translate(" + Class_dragger.x + "," + Class_dragger.y + ")");
    if (Class_dragger.pathElement) {
      // compute start point ;

      const sX = Class_dragger.parent.x,
        sY = Class_dragger.parent.y,
        eX = Class_dragger.x,
        eY = Class_dragger.y;

      // this is used only when you dont have a proper layout ordering;
      const dirX = eX - sX;
      const dirY = eY - sY;
      const len = Math.sqrt(dirX * dirX + dirY * dirY);

      const nX = dirX / len;
      const nY = dirY / len;

      const ppX = sX + nX * Class_dragger.parent.actualRadius();
      const ppY = sY + nY * Class_dragger.parent.actualRadius();

      const ncx = nX * 15;
      const ncy = nY * 15;
      Class_dragger.draggerObject.attr("cx", ncx).attr("cy", ncy);

      Class_dragger.pathElement
        .attr("x1", ppX)
        .attr("y1", ppY)
        .attr("x2", eX)
        .attr("y2", eY);
    }
    const angle =
      (Math.atan2(
        Class_dragger.parent.y - Class_dragger.y,
        Class_dragger.parent.x - Class_dragger.x,
      ) *
        180) /
      Math.PI;

    Class_dragger.nodeElement.attr(
      "transform",
      "translate(" +
        Class_dragger.x +
        "," +
        Class_dragger.y +
        ")" +
        "rotate(" +
        angle +
        ")",
    );
    Class_dragger.draggerObject.attr(
      "transform",
      "translate(" + Class_dragger.x + "," + Class_dragger.y + ")",
    );
    // console.warn("update Elmenent root element"+Class_dragger.x + "," + Class_dragger.y );
    //
    // Class_dragger.nodeElement.attr("transform", function (d) {
    //     return "rotate(" + angle + ")";
    // });
  };

  /** MOUSE HANDLING FUNCTIONS ------------------------------------------------- **/

  Class_dragger.addMouseEvents = function () {
    // console.warn("adding mouse events");
    Class_dragger.rootNodeLayer
      .selectAll("*")
      .on("mouseover", Class_dragger.onMouseOver)
      .on("mouseout", Class_dragger.onMouseOut)
      .on("click", function () {})
      .on("dblclick", function () {})
      .on("mousedown", Class_dragger.mouseDown)
      .on("mouseup", Class_dragger.mouseUp);
  };

  Class_dragger.mouseDown = function () {
    Class_dragger.nodeElement.classed("is-dragging", true);
    Class_dragger.nodeElement.classed("classDraggerNodeHovered", true);
    Class_dragger.mouseButtonPressed = true;
    console.warn("Mouse DOWN from Dragger");
  };

  Class_dragger.mouseUp = function () {
    Class_dragger.nodeElement.classed("is-dragging", false);
    Class_dragger.mouseButtonPressed = false;
    console.warn("Mouse UP from Dragger");
  };

  Class_dragger.mouseEntered = function (p) {
    if (!arguments.length) {
      return Class_dragger.mouseEnteredVar;
    }
    Class_dragger.mouseEnteredVar = p;
    return Class_dragger;
  };

  Class_dragger.selectedViaTouch = function (val) {
    Class_dragger.nodeElement.classed("classDraggerNode", !val);
    Class_dragger.nodeElement.classed("classDraggerNodeHovered", val);
  };

  Class_dragger.onMouseOver = function () {
    if (Class_dragger.mouseEntered()) {
      return;
    }
    Class_dragger.nodeElement.classed("classDraggerNode", false);
    Class_dragger.nodeElement.classed("classDraggerNodeHovered", true);
    const selectedNode = Class_dragger.rootElement.node(),
      nodeContainer = selectedNode.parentNode;
    nodeContainer.appendChild(selectedNode);

    Class_dragger.mouseEntered(true);
  };
  Class_dragger.onMouseOut = function () {
    if (Class_dragger.mouseButtonPressed === true) {
      return;
    }
    Class_dragger.nodeElement.classed("classDraggerNodeHovered", false);
    Class_dragger.nodeElement.classed("classDraggerNode", true);
    Class_dragger.mouseEntered(false);
  };

  Class_dragger.setPosition = function (x, y) {
    Class_dragger.x = x;
    Class_dragger.y = y;
    Class_dragger.updateElement();
  };

  return Class_dragger;
}
