/**
 * Contains a collection of mathematical functions with some additional data
 * used for WebVOWL.
 */
module.exports = (function () {
  const DEFAULT_CURVE_TENSION = 0.7;
  const TANGENT_EPSILON_SQUARED = 1e-12;
  const math = {};

  function formatCurveNumber(value) {
    const rounded = Math.round(value * 1e12) / 1e12;
    return Object.is(rounded, -0) ? 0 : rounded;
  }

  function formatCurvePoint(value) {
    return formatCurveNumber(value.x) + "," + formatCurveNumber(value.y);
  }

  function squaredDistance(first, second) {
    const dx = second.x - first.x;
    const dy = second.y - first.y;
    return dx * dx + dy * dy;
  }

  function controlsFor(middle, tangent) {
    return {
      first: {
        x: middle.x - tangent.x,
        y: middle.y - tangent.y,
      },
      final: {
        x: middle.x + tangent.x,
        y: middle.y + tangent.y,
      },
    };
  }

  function usableControls(start, end, controls) {
    return (
      squaredDistance(start, controls.first) > TANGENT_EPSILON_SQUARED &&
      squaredDistance(controls.final, end) > TANGENT_EPSILON_SQUARED
    );
  }

  function hasThreeCurvePoints(points) {
    return Array.isArray(points) && points.length === 3;
  }

  function hasFiniteCurveCoordinates(points) {
    return points.every(
      (value) => value && Number.isFinite(value.x) && Number.isFinite(value.y),
    );
  }

  function buildCurvePath(points, tension) {
    const [start, middle, end] = points;
    const tangentScale = (1 - tension) / 3;
    const tangent = {
      x: (end.x - start.x) * tangentScale,
      y: (end.y - start.y) * tangentScale,
    };
    let controls = controlsFor(middle, tangent);

    for (
      let attempt = 0;
      attempt < 8 && !usableControls(start, end, controls);
      attempt++
    ) {
      tangent.x *= 0.5;
      tangent.y *= 0.5;
      controls = controlsFor(middle, tangent);
    }

    if (!usableControls(start, end, controls)) {
      const chord = { x: end.x - start.x, y: end.y - start.y };
      const fallback =
        squaredDistance(start, end) > TANGENT_EPSILON_SQUARED
          ? { x: chord.x / 6, y: chord.y / 6 }
          : { x: 1, y: 0 };
      controls = controlsFor(middle, fallback);
    }

    return (
      "M" +
      formatCurvePoint(start) +
      " Q" +
      formatCurvePoint(controls.first) +
      " " +
      formatCurvePoint(middle) +
      " Q" +
      formatCurvePoint(controls.final) +
      " " +
      formatCurvePoint(end)
    );
  }

  math.calculateCurvePath = function (points, tension = DEFAULT_CURVE_TENSION) {
    if (!hasThreeCurvePoints(points)) {
      throw new TypeError("A three-point curve requires exactly three points");
    }
    if (!hasFiniteCurveCoordinates(points)) {
      throw new TypeError("Curve points require finite x and y coordinates");
    }
    if (!Number.isFinite(tension)) {
      throw new TypeError("Curve tension must be finite");
    }

    return buildCurvePath(points, tension);
  };

  math.tryCalculateCurvePath = function (
    points,
    tension = DEFAULT_CURVE_TENSION,
  ) {
    if (
      !hasThreeCurvePoints(points) ||
      !hasFiniteCurveCoordinates(points) ||
      !Number.isFinite(tension)
    ) {
      return undefined;
    }

    return buildCurvePath(points, tension);
  };

  /**
   * Calculates the normal vector of the path between the two nodes.
   * @param source the first node
   * @param target the second node
   * @param length the length of the calculated normal vector
   * @returns {{x: number, y: number}}
   */
  math.calculateNormalVector = function (source, target, length) {
    const dx = target.x - source.x,
      dy = target.y - source.y;

    const nx = -dy,
      ny = dx;

    const vlength = Math.sqrt(nx * nx + ny * ny);

    const ratio = vlength !== 0 ? length / vlength : 0;

    return { x: nx * ratio, y: ny * ratio };
  };

  /**
   * Calculates the path for a link, if it is a loop. Currently only working for circlular nodes.
   * @param link the link
   * @returns {*}
   */

  math.getLoopPoints = function (link) {
    const node = link.domain(),
      label = link.label();

    const fairShareLoopAngle = 360 / link.loops().length;
    const fairShareLoopAngleWithMargin = fairShareLoopAngle * 0.8;
    let loopAngle = Math.min(60, fairShareLoopAngleWithMargin);

    if (label.increasedLoopAngle === true) {
      loopAngle = 120;
    }

    const dx = label.x - node.x,
      dy = label.y - node.y,
      labelRadian = Math.atan2(dy, dx),
      labelAngle = calculateAngle(labelRadian);

    const startAngle = labelAngle - loopAngle / 2,
      endAngle = labelAngle + loopAngle / 2;

    const arcFrom = calculateRadian(startAngle),
      arcTo = calculateRadian(endAngle),
      x1 = Math.cos(arcFrom) * node.actualRadius(),
      y1 = Math.sin(arcFrom) * node.actualRadius(),
      x2 = Math.cos(arcTo) * node.actualRadius(),
      y2 = Math.sin(arcTo) * node.actualRadius(),
      fixPoint1 = { x: node.x + x1, y: node.y + y1 },
      fixPoint2 = { x: node.x + x2, y: node.y + y2 };

    return [fixPoint1, fixPoint2];
  };
  math.calculateLoopPath = function (link) {
    const node = link.domain(),
      label = link.label();

    const fairShareLoopAngle = 360 / link.loops().length;
    const fairShareLoopAngleWithMargin = fairShareLoopAngle * 0.8;
    let loopAngle = Math.min(60, fairShareLoopAngleWithMargin);

    if (label.increasedLoopAngle === true) {
      loopAngle = 120;
    }

    const dx = label.x - node.x,
      dy = label.y - node.y,
      labelRadian = Math.atan2(dy, dx),
      labelAngle = calculateAngle(labelRadian);

    const startAngle = labelAngle - loopAngle / 2,
      endAngle = labelAngle + loopAngle / 2;

    const arcFrom = calculateRadian(startAngle),
      arcTo = calculateRadian(endAngle),
      x1 = Math.cos(arcFrom) * node.actualRadius(),
      y1 = Math.sin(arcFrom) * node.actualRadius(),
      x2 = Math.cos(arcTo) * node.actualRadius(),
      y2 = Math.sin(arcTo) * node.actualRadius(),
      fixPoint1 = { x: node.x + x1, y: node.y + y1 },
      fixPoint2 = { x: node.x + x2, y: node.y + y2 };

    return math.calculateCurvePath([fixPoint1, link.label(), fixPoint2], -1);
  };

  math.calculateLoopPoints = function (link) {
    const node = link.domain(),
      label = link.label();

    const fairShareLoopAngle = 360 / link.loops().length,
      fairShareLoopAngleWithMargin = fairShareLoopAngle * 0.8,
      loopAngle = Math.min(60, fairShareLoopAngleWithMargin);

    const dx = label.x - node.x,
      dy = label.y - node.y,
      labelRadian = Math.atan2(dy, dx),
      labelAngle = calculateAngle(labelRadian);

    const startAngle = labelAngle - loopAngle / 2,
      endAngle = labelAngle + loopAngle / 2;

    const arcFrom = calculateRadian(startAngle),
      arcTo = calculateRadian(endAngle),
      x1 = Math.cos(arcFrom) * node.actualRadius(),
      y1 = Math.sin(arcFrom) * node.actualRadius(),
      x2 = Math.cos(arcTo) * node.actualRadius(),
      y2 = Math.sin(arcTo) * node.actualRadius(),
      fixPoint1 = { x: node.x + x1, y: node.y + y1 },
      fixPoint2 = { x: node.x + x2, y: node.y + y2 };

    return [fixPoint1, link.label(), fixPoint2];
  };

  /**
   * @param angle
   * @returns {number} the radian of the angle
   */
  function calculateRadian(angle) {
    angle = angle % 360;
    if (angle < 0) {
      angle = angle + 360;
    }
    return (Math.PI * angle) / 180;
  }

  /**
   * @param radian
   * @returns {number} the angle of the radian
   */
  function calculateAngle(radian) {
    return radian * (180 / Math.PI);
  }

  /**
   * Calculates the point where the link between the source and target node
   * intersects the border of the target node.
   * @param source the source node
   * @param target the target node
   * @param additionalDistance additional distance the
   * @returns {{x: number, y: number}}
   */
  math.calculateIntersection = function (source, target, additionalDistance) {
    const dx = target.x - source.x,
      dy = target.y - source.y,
      length = Math.sqrt(dx * dx + dy * dy);

    if (length === 0) {
      return { x: source.x, y: source.y };
    }

    const innerDistance = target.distanceToBorder(dx, dy);

    const ratio = (length - (innerDistance + additionalDistance)) / length,
      x = dx * ratio + source.x,
      y = dy * ratio + source.y;

    return { x: x, y: y };
  };

  /**
   * Calculates the position between the two points.
   * @param firstPoint
   * @param secondPoint
   * @returns {{x: number, y: number}}
   */
  math.calculateCenter = function (firstPoint, secondPoint) {
    return {
      x: (firstPoint.x + secondPoint.x) / 2,
      y: (firstPoint.y + secondPoint.y) / 2,
    };
  };

  return function () {
    /* Use a function here to keep a consistent style like webvowl.path.to.module()
     * despite having just a single math object. */
    return math;
  };
})();
