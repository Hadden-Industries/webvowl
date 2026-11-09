import { runInNewContext } from "node:vm";
import { equalDataTree } from "./equalDataTree.js";

test("compares own record fields independently of their order and realm", () => {
  const copied = runInNewContext("({ nodes: ['a', 'b'], focus: undefined })");
  const original = { focus: undefined, nodes: ["a", "b"] };

  expect(equalDataTree(original, copied)).toBe(true);
  expect(equalDataTree(original, { nodes: ["a", "b"] })).toBe(false);
  expect(equalDataTree(original, { focus: undefined, nodes: ["b", "a"] })).toBe(
    false,
  );
  expect(equalDataTree({ x: undefined }, { y: undefined })).toBe(false);
});

test("compares numeric values with the same equality used by controller state", () => {
  expect(equalDataTree([-0, NaN], [0, NaN])).toBe(true);
  expect(equalDataTree([0], ["0"])).toBe(false);
});

test("compares only the visible bytes of each checkpoint view", () => {
  const view = Uint8Array.of(8, 3, 5, 9).subarray(1, 3);
  const snapshot = { source: { bytes: view } };

  expect(
    equalDataTree(snapshot, { source: { bytes: Uint8Array.of(3, 5) } }),
  ).toBe(true);
  expect(equalDataTree(view, Uint8Array.of(3, 6))).toBe(false);
  expect(equalDataTree(view, Uint8Array.of(3))).toBe(false);
  expect(equalDataTree(view, [3, 5])).toBe(false);
});

test("compares Uint8Array views across realms and distinguishes other byte views", () => {
  const bytes = Uint8Array.of(3, 5);
  const foreignView = runInNewContext(
    "Uint8Array.of(8, 3, 5, 9).subarray(1, 3)",
  );

  expect(equalDataTree(bytes, foreignView)).toBe(true);
  expect(equalDataTree(bytes, Uint8ClampedArray.of(3, 5))).toBe(false);
});
