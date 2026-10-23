import { at, fail } from "./errors.js";
import { categories } from "./profiles.js";

/** Validate I-JSON's Unicode domain and count exact UTF-8 bytes without allocating an encoding. */
export function checkString(value, pointer, budget, charge = true) {
  let bytes = 0;
  let nextCheck = 1024;
  for (let index = 0; index < value.length; index++) {
    if (index >= nextCheck) {
      budget.check();
      nextCheck = index + 1024;
    }
    const scalar = value.codePointAt(index);
    if (
      (scalar >= 0xd800 && scalar <= 0xdfff) ||
      (scalar >= 0xfdd0 && scalar <= 0xfdef) ||
      scalar % 65536 >= 65534
    ) {
      fail("UNICODE_INVALID", pointer);
    }
    bytes += scalar < 0x80 ? 1 : scalar < 0x800 ? 2 : scalar < 0x10000 ? 3 : 4;
    if (scalar > 0xffff) {
      index++;
    }
    if (index % 1024 === 0) {
      budget.bound("stringBytes", bytes, pointer);
    }
  }
  budget.bound("stringBytes", bytes, pointer);
  if (charge) {
    budget.charge("totalStringBytes", bytes, pointer);
  }
  return bytes;
}

/** Copy all values synchronously using descriptors; sharing is copied by value, cycles rejected. */
export function snapshotSource(source, budget, primaryAt = () => false) {
  budget.check();
  if (source === null || typeof source !== "object" || Array.isArray(source)) {
    fail("INPUT_TYPE", "");
  }
  const ancestors = new Set();
  function copy(value, pointer, depth, primary = false) {
    budget.poll();
    if (typeof value === "string") {
      checkString(value, pointer, budget);
      return value;
    }
    if (typeof value === "number") {
      if (!Number.isFinite(value) || Object.is(value, -0)) {
        fail("NUMBER_INVALID", pointer);
      }
      return value;
    }
    if (typeof value === "boolean" || value === null) {
      return value;
    }
    if (typeof value !== "object" || ancestors.has(value)) {
      fail("SOURCE_UNSAFE_VALUE", pointer);
    }
    budget.bound("depth", depth, pointer);
    const array = Array.isArray(value);
    const prototype = Object.getPrototypeOf(value);
    if (
      array
        ? prototype !== Array.prototype
        : prototype !== Object.prototype && prototype !== null
    ) {
      fail("SOURCE_UNSAFE_VALUE", pointer);
    }
    budget.charge(
      primary || primaryAt(pointer) ? "primaryRecords" : "embeddedValues",
      1,
      pointer,
    );
    const keys = Reflect.ownKeys(value);
    if (keys.some((key) => typeof key !== "string")) {
      fail("SOURCE_UNSAFE_VALUE", pointer);
    }
    const descriptors = Object.create(null);
    for (const key of keys) {
      descriptors[key] = Object.getOwnPropertyDescriptor(value, key);
    }
    if (array) {
      const length = descriptors.length.value;
      if (
        keys.length !== length + 1 ||
        keys.some(
          (key) =>
            key !== "length" &&
            (!/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= length),
        )
      ) {
        fail("SOURCE_UNSAFE_VALUE", pointer);
      }
    }
    ancestors.add(value);
    const result = array ? [] : Object.create(null);
    const ordered = array
      ? keys
          .filter((key) => key !== "length")
          .sort((a, b) => Number(a) - Number(b))
      : keys.sort();
    const primaryChild =
      array &&
      Object.keys(categories).some(
        (category) => pointer === `/structural/${category}`,
      );
    for (const key of ordered) {
      const descriptor = descriptors[key];
      const childPointer = at(pointer, key);
      if (!("value" in descriptor) || !descriptor.enumerable) {
        fail("SOURCE_UNSAFE_VALUE", childPointer);
      }
      if (!array) {
        checkString(key, childPointer, budget);
      }
      result[key] = copy(
        descriptor.value,
        childPointer,
        depth + 1,
        primaryChild,
      );
    }
    ancestors.delete(value);
    return result;
  }
  const result = copy(source, "", 1);
  budget.check();
  return result;
}

/** Own the byte input before any asynchronous suspension; shared/detached buffers are unsafe. */
export function snapshotBytes(value, budget) {
  if (!(value instanceof Uint8Array)) {
    fail("INPUT_TYPE", "");
  }
  try {
    const buffer = Object.getOwnPropertyDescriptor(
      Object.getPrototypeOf(Uint8Array.prototype),
      "buffer",
    ).get.call(value);
    if (
      typeof SharedArrayBuffer !== "undefined" &&
      buffer instanceof SharedArrayBuffer
    ) {
      fail("INPUT_TYPE", "");
    }
    const length = Object.getOwnPropertyDescriptor(
      Object.getPrototypeOf(Uint8Array.prototype),
      "byteLength",
    ).get.call(value);
    budget.charge("inputBytes", length, "", "INPUT_RESOURCE_LIMIT");
    return new Uint8Array(value);
  } catch (error) {
    if (error?.code) {
      throw error;
    }
    fail("INPUT_TYPE", "");
  }
}

/** Admission owns an immutable tree; none of its containers can later change encoded bytes. */
export function deepFreeze(value) {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) {
      deepFreeze(child);
    }
    Object.freeze(value);
  }
  return value;
}
