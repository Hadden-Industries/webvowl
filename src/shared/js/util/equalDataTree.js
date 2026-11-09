const objectTag = Object.prototype.toString;

/**
 * Compare acyclic data made of primitives, arrays, plain records and Uint8Array
 * views. Records compare own enumerable string fields regardless of key order.
 * Arrays and byte views compare in order. Primitive equality treats both zeros
 * as equal and NaN as equal to itself.
 */
export function equalDataTree(left, right) {
  if (left === right || (Number.isNaN(left) && Number.isNaN(right))) {
    return true;
  }
  if (
    left === null ||
    right === null ||
    typeof left !== "object" ||
    typeof right !== "object"
  ) {
    return false;
  }

  // Recognize arrays across realms without tagging either operand.
  const leftArray = Array.isArray(left);
  const rightArray = Array.isArray(right);
  if (leftArray || rightArray) {
    if (!leftArray || !rightArray || left.length !== right.length) {
      return false;
    }
    for (let index = 0; index < left.length; index++) {
      if (!equalDataTree(left[index], right[index])) {
        return false;
      }
    }
    return true;
  }

  // Preserve the distinction between byte views and other object types.
  const tag = objectTag.call(left);
  if (tag !== objectTag.call(right)) {
    return false;
  }
  if (tag === "[object Uint8Array]") {
    const length = left.length;
    if (length !== right.length) {
      return false;
    }
    for (let index = 0; index < length; index++) {
      if (left[index] !== right[index]) {
        return false;
      }
    }
    return true;
  }
  if (tag !== "[object Object]") {
    return false;
  }

  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) {
    return false;
  }
  for (let index = 0; index < leftKeys.length; index++) {
    const key = leftKeys[index];
    if (!Object.hasOwn(right, key)) {
      return false;
    }
    const leftValue = left[key];
    const rightValue = right[key];
    if (leftValue !== rightValue && !equalDataTree(leftValue, rightValue)) {
      return false;
    }
  }
  return true;
}
