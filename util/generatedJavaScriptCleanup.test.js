import { afterEach, expect, test } from "@jest/globals";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  rmdirSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { createGeneratedJavaScriptCleanupPlugin } from "./generatedJavaScriptCleanup.mjs";

const roots = [];
const hash = (value) => createHash("sha256").update(value).digest("hex");
afterEach(() => {
  for (const root of roots.splice(0)) {
    expect(dirname(root)).toBe(resolve(tmpdir()));
    rmSync(root, { recursive: true, force: true });
  }
});

function fixture(previous = { schemaVersion: 1, files: [] }) {
  const root = mkdtempSync(join(tmpdir(), "webvowl-owned-assets-"));
  roots.push(root);
  const output = join(root, "deploy");
  for (const directory of ["assets", "js", ".vite"]) {
    mkdirSync(join(output, directory), { recursive: true });
  }
  const manifest = join(output, ".vite/generated.json");
  const original = JSON.stringify(previous);
  writeFileSync(manifest, original);
  const plugin = createGeneratedJavaScriptCleanupPlugin({
    manifestName: ".vite/generated.json",
    legacyFiles: [],
  });
  plugin.configResolved({ build: { outDir: output } });
  plugin.buildStart();
  function emit(
    files = ["js/index.js", "assets/current.js", "assets/shared.js"],
  ) {
    const bundle = {};
    files.forEach((fileName, index) => {
      writeFileSync(join(output, fileName), `// generated ${index}`);
      bundle[fileName] = { fileName, type: index ? "asset" : "chunk" };
    });
    plugin.generateBundle({}, bundle, true);
  }
  return { root, output, plugin, emit, manifest, original };
}

test("prunes only unchanged previously emitted assets and retains every current chunk", () => {
  const h = fixture({
    schemaVersion: 1,
    files: ["assets/obsolete.js"],
    hashes: { "assets/obsolete.js": hash("obsolete") },
  });
  writeFileSync(join(h.output, "assets/obsolete.js"), "obsolete");
  writeFileSync(
    join(h.output, "assets/canonicalVowlWorker-foreign.js"),
    "foreign",
  );
  h.emit();
  h.plugin.writeBundle.handler();
  h.plugin.closeBundle();
  expect(existsSync(join(h.output, "assets/obsolete.js"))).toBe(false);
  expect(
    readFileSync(
      join(h.output, "assets/canonicalVowlWorker-foreign.js"),
      "utf8",
    ),
  ).toBe("foreign");
  const manifest = JSON.parse(readFileSync(h.manifest, "utf8"));
  expect(manifest.files).toEqual([
    "assets/current.js",
    "assets/shared.js",
    "js/index.js",
  ]);
  for (const file of manifest.files) {
    expect(manifest.hashes[file]).toBe(
      hash(readFileSync(join(h.output, file))),
    );
  }
});

test("an interrupted old temporary manifest cannot block a later successful build", () => {
  const h = fixture();
  writeFileSync(`${h.manifest}.next`, "interrupted legacy attempt");
  h.emit();
  h.plugin.writeBundle.handler();
  h.plugin.closeBundle();
  expect(JSON.parse(readFileSync(h.manifest, "utf8")).files).toContain(
    "assets/current.js",
  );
  expect(readFileSync(`${h.manifest}.next`, "utf8")).toBe(
    "interrupted legacy attempt",
  );
});

test("edited files, escaped paths and unmanifested workers stay intact", () => {
  const h = fixture({
    schemaVersion: 1,
    files: [
      "../outside.js",
      "assets/../../outside.js",
      "assets/edited.js",
      "assets/unproven.js",
    ],
    hashes: { "assets/edited.js": hash("original") },
  });
  writeFileSync(join(h.root, "outside.js"), "outside");
  writeFileSync(join(h.output, "assets/edited.js"), "user edit");
  writeFileSync(join(h.output, "assets/unproven.js"), "unknown origin");
  h.emit();
  h.plugin.writeBundle.handler();
  h.plugin.closeBundle();
  expect(readFileSync(join(h.root, "outside.js"), "utf8")).toBe("outside");
  expect(readFileSync(join(h.output, "assets/edited.js"), "utf8")).toBe(
    "user edit",
  );
  expect(readFileSync(join(h.output, "assets/unproven.js"), "utf8")).toBe(
    "unknown origin",
  );
});

test.each(["no write", "failed render"])(
  "%s leaves prior assets and manifest untouched",
  (failure) => {
    const h = fixture({ schemaVersion: 1, files: ["js/old.js"] });
    writeFileSync(join(h.output, "js/old.js"), "retained");
    h.emit();
    if (failure === "failed render") {
      h.plugin.writeBundle.handler();
      h.plugin.renderError(new Error("failed render"));
    }
    h.plugin.closeBundle();
    expect(readFileSync(join(h.output, "js/old.js"), "utf8")).toBe("retained");
    expect(readFileSync(h.manifest, "utf8")).toBe(h.original);
  },
);

test("redirected asset directories cannot make cleanup delete outside the output", () => {
  const h = fixture({
    schemaVersion: 1,
    files: ["assets/old.js"],
    hashes: { "assets/old.js": hash("retained") },
  });
  const foreign = join(h.root, "foreign");
  mkdirSync(foreign);
  writeFileSync(join(foreign, "old.js"), "retained");
  rmdirSync(join(h.output, "assets"));
  symlinkSync(foreign, join(h.output, "assets"), "junction");
  h.emit(["js/index.js"]);
  h.plugin.writeBundle.handler();
  h.plugin.closeBundle();
  expect(readFileSync(join(foreign, "old.js"), "utf8")).toBe("retained");
});
