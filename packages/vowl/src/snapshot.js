import { at, fail } from "./errors.js";
import { categories } from "./profiles.js";

const nonAscii = /[^\p{ASCII}]/u;
const primaryRecordArrays = Object.freeze(
  Object.keys(categories).map((category) => `/structural/${category}`),
);

/** A lone surrogate or a noncharacter that I-JSON prohibits. */
export function prohibitedScalar(scalar) {
  return (
    (scalar >= 0xd800 && scalar <= 0xdfff) ||
    (scalar >= 0xfdd0 && scalar <= 0xfdef) ||
    scalar % 65536 >= 65534
  );
}

/** The number of bytes that UTF-8 uses for one code point. */
export function utf8Length(scalar) {
  return scalar < 0x80 ? 1 : scalar < 0x800 ? 2 : scalar < 0x10000 ? 3 : 4;
}

/** Validate I-JSON's Unicode domain and count exact UTF-8 bytes without allocating an encoding. */
export function checkString(value, pointer, budget, charge = true) {
  // A bounded ASCII scan proves both the I-JSON scalar domain and UTF-8 size.
  // Longer strings retain the interruptible walk below.
  if (value.length <= 1024 && !nonAscii.test(value)) {
    budget.bound("stringBytes", value.length, pointer);
    if (charge) {
      budget.charge("totalStringBytes", value.length, pointer);
    }
    return value.length;
  }
  let bytes = 0;
  let nextCheck = 1024;
  for (let index = 0; index < value.length; index++) {
    if (index >= nextCheck) {
      budget.check();
      nextCheck = index + 1024;
    }
    // The checks of prohibitedScalar and utf8Length, inlined in this hot loop.
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

// The containers that each operation's snapshots have counted, keyed by the
// operation's budget, whether the snapshot read them or made them. A value
// counts once in an operation, however often it is copied (#limits).
const countedByOperation = new WeakMap();
// Only privately owned, safety-validated trees can populate this proof. A
// caller's shallow freeze or serialized marker never establishes membership.
const frozenOwnedTrees = new WeakSet();

/** Internal query only: a proof of immutable data safety, never model admission. */
export function isFrozenOwnedSource(value) {
  return frozenOwnedTrees.has(value);
}

/** Copy all values synchronously using descriptors; sharing is copied by value, cycles rejected. */
export function snapshotSource(source, budget, primaryAt = () => false) {
  return visitSource(source, budget, primaryAt, true);
}

/**
 * Check a privately constructed tree without allocating another ownership copy.
 * Internal callers must already own every reachable container; this does not
 * confer ownership on caller data. All safety invariants and charges still apply.
 */
export function validateOwnedSource(source, budget) {
  visitSource(source, budget, () => false, false);
}

function visitSource(source, budget, primaryAt, copying) {
  budget.check();
  if (source === null || typeof source !== "object" || Array.isArray(source)) {
    fail("INPUT_TYPE", "");
  }
  let counted = countedByOperation.get(budget);
  if (!counted) {
    counted = new WeakSet();
    countedByOperation.set(budget, counted);
  }
  const ancestors = new Set();
  const reached = new Set();
  // A container that an earlier snapshot counted is copied without counting
  // it, or its member names and strings, again. Reaching it a second time in
  // this snapshot is a further occurrence, which counts as a value of its own.
  function copy(value, pointer, depth, primary = false, uncounted = false) {
    budget.poll();
    if (typeof value === "string") {
      checkString(value, pointer, budget, !uncounted);
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
    const frozenSafe = frozenOwnedTrees.has(value);
    if (typeof value !== "object" || (!frozenSafe && ancestors.has(value))) {
      fail("SOURCE_UNSAFE_VALUE", pointer);
    }
    budget.bound("depth", depth, pointer);
    const array = Array.isArray(value);
    if (!frozenSafe) {
      const prototype = Object.getPrototypeOf(value);
      if (
        array
          ? prototype !== Array.prototype
          : prototype !== Object.prototype && prototype !== null
      ) {
        fail("SOURCE_UNSAFE_VALUE", pointer);
      }
    }
    const knownToBudget = counted.has(value);
    const recopied = knownToBudget && !reached.has(value);
    reached.add(value);
    if (!recopied) {
      budget.charge(
        primary || primaryAt(pointer) ? "primaryRecords" : "embeddedValues",
        1,
        pointer,
      );
    }
    // Published safe trees are deeply frozen and exclusively owned. Their
    // prototypes, dense layout and own data attributes cannot change. Reuse
    // only those facts; every occurrence still traverses and charges below.
    const keys = frozenSafe ? Object.keys(value) : Reflect.ownKeys(value);
    if (!frozenSafe && keys.some((key) => typeof key !== "string")) {
      fail("SOURCE_UNSAFE_VALUE", pointer);
    }
    // Keep descriptor reads tied to the captured keys, without enumerating
    // a programmatic input a second time.
    let descriptors;
    if (!frozenSafe) {
      descriptors = Object.create(null);
      for (const key of keys) {
        descriptors[key] = Object.getOwnPropertyDescriptor(value, key);
      }
    }
    if (array && !frozenSafe) {
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
    if (!frozenSafe) {
      ancestors.add(value);
    }
    const result = copying ? (array ? [] : Object.create(null)) : value;
    // The dense-array check above proves every index is present exactly once.
    // Visit those numeric positions directly, including when a caller proxy
    // reports its keys in another order. Record fields retain lexical order.
    const ordered = array ? undefined : keys.sort();
    const length = array
      ? frozenSafe
        ? value.length
        : descriptors.length.value
      : ordered.length;
    const primaryChild = array && primaryRecordArrays.includes(pointer);
    for (let index = 0; index < length; index++) {
      const key = array ? index : ordered[index];
      const descriptor = descriptors?.[key];
      const childPointer = at(pointer, key);
      if (!frozenSafe && (!("value" in descriptor) || !descriptor.enumerable)) {
        fail("SOURCE_UNSAFE_VALUE", childPointer);
      }
      if (!array) {
        checkString(key, childPointer, budget, !recopied);
      }
      const child = copy(
        frozenSafe ? value[key] : descriptor.value,
        childPointer,
        depth + 1,
        primaryChild,
        recopied,
      );
      if (copying) {
        result[key] = child;
      }
    }
    if (!frozenSafe) {
      ancestors.delete(value);
    }
    // Populate a fresh ordinary record with own data properties, then remove
    // its prototype before publication. Preserve null-prototype isolation while
    // allowing engines to retain a compact property layout for repeated reads.
    const owned =
      copying && !array ? Object.setPrototypeOf({ ...result }, null) : result;
    if (!knownToBudget) {
      counted.add(value);
    }
    if (owned !== value) {
      counted.add(owned);
    }
    return owned;
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
    budget.charge("inputBytes", length, "");
    return new Uint8Array(value);
  } catch (error) {
    if (error?.code) {
      throw error;
    }
    budget.reportHostLimit(error);
    fail("INPUT_TYPE", "");
  }
}

/** Admission owns an immutable tree; none of its containers can later change encoded bytes. */
export function deepFreeze(value) {
  return freezeTree(value, false);
}

/** Internal handoff only, after ownership and complete data-safety validation. */
export function freezeOwnedSource(value) {
  return freezeTree(value, true);
}

function freezeTree(value, rememberOwned) {
  if (value !== null && typeof value === "object") {
    if (frozenOwnedTrees.has(value)) {
      return value;
    }
    for (const child of Object.values(value)) {
      freezeTree(child, rememberOwned);
    }
    Object.freeze(value);
    if (rememberOwned) {
      frozenOwnedTrees.add(value);
    }
  }
  return value;
}
