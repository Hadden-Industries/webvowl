import { at } from "../src/errors.js";

test.each([
  ["", "", "/"],
  ["", "structural", "/structural"],
  ["/structural/subjects", 42, "/structural/subjects/42"],
  ["/already~1escaped", "a/b~c", "/already~1escaped/a~1b~0c"],
  ["", "~01/~1", "/~001~1~01"],
  ["", "//~~", "/~1~1~0~0"],
  ["/annotations", "é\u{1f600}", "/annotations/é\u{1f600}"],
])(
  "JSON Pointer %s + %s retains its exact escaped spelling",
  (pointer, key, expected) => {
    expect(at(pointer, key)).toBe(expected);
  },
);

test("a key is converted to a string only once", () => {
  let calls = 0;
  const key = {
    toString() {
      calls++;
      return "a/b";
    },
  };
  expect(at("", key)).toBe("/a~1b");
  expect(calls).toBe(1);
});
