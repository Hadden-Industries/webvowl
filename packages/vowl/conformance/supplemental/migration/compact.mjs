// SPDX-License-Identifier: AGPL-3.0-only
// Language-neutral seed/patch representation; not migration or product logic.
import assert from "node:assert/strict";

const clone = (value) => JSON.parse(JSON.stringify(value));
const token = (value) => value.replaceAll("~", "~0").replaceAll("/", "~1");
const decode = (value) => value.replaceAll("~1", "/").replaceAll("~0", "~");

// The manifest stores arrays in their observed historical serializer order.
// Object key sorting here only reconstructs those fixture bytes after patches.
export function inputText(value) {
  function ordered(item) {
    if (Array.isArray(item)) return item.map(ordered);
    if (item === null || typeof item !== "object") return item;
    return Object.fromEntries(
      Object.keys(item)
        .sort()
        .map((key) => [key, ordered(item[key])]),
    );
  }
  return JSON.stringify(ordered(value), null, 2);
}

export function difference(before, after, path = "") {
  if (JSON.stringify(before) === JSON.stringify(after)) return [];
  if (
    before === null ||
    after === null ||
    typeof before !== "object" ||
    typeof after !== "object" ||
    Array.isArray(before) !== Array.isArray(after) ||
    (Array.isArray(before) && before.length !== after.length)
  )
    return [{ op: "replace", path, value: clone(after) }];
  const patches = [];
  for (const key of Object.keys(before).sort()) {
    if (!Object.hasOwn(after, key))
      patches.push({ op: "remove", path: `${path}/${token(key)}` });
  }
  for (const key of Object.keys(after).sort()) {
    const childPath = `${path}/${token(key)}`;
    if (!Object.hasOwn(before, key))
      patches.push({ op: "add", path: childPath, value: clone(after[key]) });
    else patches.push(...difference(before[key], after[key], childPath));
  }
  return patches;
}

export function applyPatches(seed, patches) {
  let result = clone(seed);
  for (const patch of patches) {
    assert(["add", "remove", "replace"].includes(patch.op));
    if (patch.path === "") {
      assert.equal(patch.op, "replace");
      result = clone(patch.value);
      continue;
    }
    assert(patch.path.startsWith("/"));
    const parts = patch.path.slice(1).split("/").map(decode);
    const key = parts.pop();
    let parent = result;
    for (const part of parts) {
      assert(Object.hasOwn(parent, part), `Missing patch parent ${patch.path}`);
      parent = parent[part];
    }
    if (patch.op === "remove") {
      assert(Object.hasOwn(parent, key));
      assert(!Array.isArray(parent), "Array removal is encoded as replacement");
      delete parent[key];
    } else {
      if (patch.op === "replace") assert(Object.hasOwn(parent, key));
      if (patch.op === "add") assert(!Object.hasOwn(parent, key));
      Object.defineProperty(parent, key, {
        value: clone(patch.value),
        enumerable: true,
        writable: true,
        configurable: true,
      });
    }
  }
  return result;
}

export function compactInput(input, seeds) {
  const candidates = Object.entries(seeds).map(([seed, value]) => {
    const patches = difference(value, input);
    return { seed, patches };
  });
  candidates.sort((left, right) => {
    const byLength = JSON.stringify(left).length - JSON.stringify(right).length;
    if (byLength !== 0) return byLength;
    return left.seed < right.seed ? -1 : left.seed > right.seed ? 1 : 0;
  });
  const selected = candidates[0];
  assert(selected, "At least one source seed is required");
  assert.deepEqual(applyPatches(seeds[selected.seed], selected.patches), input);
  return selected;
}
