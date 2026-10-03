import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import {
  createCorpusReader,
  fixtureBundle,
  storageFormat,
} from "../conformance/storage.mjs";
import { verifyCorpusStorage } from "../scripts/verify-corpus-storage.mjs";

const member =
  "supplemental/field-contract/negative/storage-control/source.json";
let directory;
beforeEach(() => {
  directory = mkdtempSync(resolve(tmpdir(), "vowl-corpus-storage-"));
});
afterEach(() => {
  // Only the test's own fresh temporary directory is eligible for removal.
  expect(
    directory.startsWith(resolve(tmpdir()) + sep + "vowl-corpus-storage-"),
  ).toBe(true);
  rmSync(directory, { recursive: true });
});

function fixture(bytes, encoding = "utf8") {
  return {
    path: member,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    byteLength: bytes.length,
    encoding,
    text: bytes.toString(encoding),
  };
}
function writeBundle(artifacts) {
  const path = resolve(directory, fixtureBundle(member));
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify({ format: storageFormat, artifacts }));
  return createCorpusReader(pathToFileURL(directory + sep));
}

test("the complete relocated corpus retains its inventory and has no loose duplicates", () => {
  expect(verifyCorpusStorage()).toEqual({
    artifacts: 7227,
    bundles: 64,
    looseCopies: 0,
  });
});

test.each([
  [
    "duplicate JSON members, whitespace and no terminal newline",
    Buffer.from('{"x":1,"x":2}\r\n\t'),
    "utf8",
  ],
  [
    "invalid UTF-8 and a byte-order mark",
    Buffer.from([239, 187, 191, 255, 0, 195]),
    "base64",
  ],
])("bundled evidence retains exact bytes: %s", (_name, bytes, encoding) => {
  const read = writeBundle([fixture(bytes, encoding)]);
  const first = read(member);
  expect(first).toEqual(bytes);
  first.fill(0);
  expect(read(member)).toEqual(bytes);
});

test("changed or duplicate bundled evidence is rejected", () => {
  const original = fixture(Buffer.from("original"));
  expect(() =>
    writeBundle([{ ...original, text: "modified" }])(member),
  ).toThrow();
  expect(() => writeBundle([original, original])(member)).toThrow(
    "Duplicate corpus member",
  );
});

test("a missing bundled member cannot fall back to a loose file", () => {
  const path = resolve(directory, member);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, "obsolete loose expectation");
  expect(() => writeBundle([])(member)).toThrow(
    "Missing bundled corpus member",
  );
});

test.each([
  "../outside",
  "/absolute",
  "C:/outside",
  "folder/../outside",
  "folder\\outside",
])("corpus reads reject escaping member paths: %s", (path) => {
  const read = createCorpusReader(pathToFileURL(directory + sep));
  expect(() => read(path)).toThrow("Invalid corpus member path");
});
