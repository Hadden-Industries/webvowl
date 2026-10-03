import serialize from "canonicalize";
import { descriptorFor } from "./typedValues.js";

const encoder = new TextEncoder();

/** Compare complete serialized members by unsigned UTF-8, never locale collation. */
export function compareBytes(left, right) {
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index++) {
    if (left[index] !== right[index]) {
      return left[index] - right[index];
    }
  }
  return left.length - right.length;
}

export function jsonBytes(value) {
  return encoder.encode(serialize(value));
}
export function jsonKey(value) {
  return serialize(value);
}

/** Sort only declared sets inside-out; property-chain sequences keep repetition and order. */
export function orderSets(value, descriptor, budget) {
  budget.check();
  const resolved = descriptorFor(value, descriptor, "");
  if (resolved?.fields) {
    for (const name of Object.keys(value)) {
      orderSets(value[name], resolved.fields[name], budget);
    }
  } else if (resolved?.items) {
    value.forEach((member) => orderSets(member, resolved.items, budget));
    if (!resolved.sequence) {
      const keyed = value.map((member) => ({
        member,
        bytes: jsonBytes(member),
      }));
      keyed.sort((a, b) => {
        budget.check();
        return compareBytes(a.bytes, b.bytes);
      });
      keyed.forEach((item, index) => {
        value[index] = item.member;
      });
    }
  }
}
