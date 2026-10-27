import { createMath } from "../../../shared/js/util/math.js";

const math = createMath();
const finitePoint = (point) =>
  Number.isFinite(point?.x) && Number.isFinite(point?.y);

/**
 * Numerical constraint shared by the renderer and packed-state experiments.
 * Endpoints supply current coordinates and distanceToBorder(dx, dy); neither
 * DOM membership nor label ownership belongs to this calculation.
 */
export function projectLegacyLabelPosition(domain, range) {
  if (!finitePoint(domain) || !finitePoint(range)) {
    return undefined;
  }
  const domainIntersection = math.calculateIntersection(range, domain, 0);
  const rangeIntersection = math.calculateIntersection(domain, range, 0);
  const position = math.calculateCenter(domainIntersection, rangeIntersection);
  if (
    !finitePoint(domainIntersection) ||
    !finitePoint(rangeIntersection) ||
    !finitePoint(position)
  ) {
    return undefined;
  }
  return { position, domainIntersection, rangeIntersection };
}
