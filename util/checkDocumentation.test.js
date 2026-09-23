import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { checkPrettierDocuments } from "./checkDocumentation.mjs";

let root;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "webvowl-documents-"));
  mkdirSync(join(root, "docs"));
  writeFileSync(
    join(root, "docs", "selected [1].md"),
    "# Selected\n\nA sentence.\n",
  );
  writeFileSync(
    join(root, "docs", "broken.md"),
    "#Missing space\n\n|a|b|\n|-|-|\n|1|2|\n",
  );
  writeFileSync(join(root, ".prettierignore"), "docs/ignored.md\n");
  writeFileSync(join(root, "docs", "ignored.md"), "#Bad\n");
});
afterEach(() => {
  if (
    dirname(resolve(root)) !== resolve(tmpdir()) ||
    !basename(root).startsWith("webvowl-documents-")
  ) {
    throw new Error("Unsafe fixture cleanup");
  }
  rmSync(root, { recursive: true, force: true });
});
test("literal selected documents are checked without unrelated malformed files", async () => {
  expect(
    await checkPrettierDocuments({ root, paths: ["docs/selected [1].md"] }),
  ).toEqual({ passed: true, documents: ["docs/selected [1].md"] });
  expect(
    (await checkPrettierDocuments({ root, paths: ["docs/broken.md"] })).passed,
  ).toBe(false);
});
test("ignored documents and empty selections do not expand to all documents", async () => {
  expect(await checkPrettierDocuments({ root, paths: [] })).toEqual({
    passed: true,
    documents: [],
  });
  expect(
    await checkPrettierDocuments({ root, paths: ["docs/ignored.md"] }),
  ).toEqual({ passed: true, documents: [] });
});
test("selected paths outside authored documentation are rejected", async () => {
  await expect(
    checkPrettierDocuments({ root, paths: ["../outside.md"] }),
  ).rejects.toThrow();
  await expect(
    checkPrettierDocuments({ root, paths: ["src/code.js"] }),
  ).rejects.toThrow();
});
