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
import {
  createGeneratedAssetCleanupPlugin,
  GENERATED_ASSET_MANIFEST,
  verifyGeneratedAssetManifest,
} from "./generatedAssetCleanup.mjs";

const roots = [];
const hash = (value) => createHash("sha256").update(value).digest("hex");
const empty = () => ({
  schemaVersion: 2,
  files: [],
  hashes: {},
  directories: [],
});
afterEach(() => {
  for (const root of roots.splice(0)) {
    expect(dirname(root)).toBe(resolve(tmpdir()));
    rmSync(root, { recursive: true, force: true });
  }
});

function fixture(previous = empty(), { write = true } = {}) {
  const root = mkdtempSync(join(tmpdir(), "webvowl-owned-assets-"));
  roots.push(root);
  const output = join(root, "deploy");
  for (const directory of ["assets", "js", ".vite"]) {
    mkdirSync(join(output, directory), { recursive: true });
  }
  const manifest = join(output, GENERATED_ASSET_MANIFEST);
  const original = JSON.stringify(previous);
  if (previous !== null) {
    writeFileSync(manifest, original);
  }
  const plugin = createGeneratedAssetCleanupPlugin();
  plugin.configResolved({ root, build: { outDir: output, write } });
  const warnings = [];
  const start = () => plugin.buildStart();
  start();
  const close = () =>
    plugin.closeBundle.handler.call({
      warn: (message) => warnings.push(message),
    });
  const finish = () => {
    plugin.writeBundle.handler();
    close();
  };
  function emit(
    files = ["js/index.js", "assets/current.js", "assets/shared.js"],
  ) {
    const bundle = Object.fromEntries(
      files.map((fileName, index) => [
        fileName,
        {
          fileName,
          type: index ? "asset" : "chunk",
          ...(index
            ? { source: `// generated ${index}` }
            : { code: "// generated 0" }),
        },
      ]),
    );
    plugin.generateBundle.handler({}, bundle, write);
    for (const [index, name] of files.entries()) {
      mkdirSync(dirname(join(output, name)), { recursive: true });
      writeFileSync(join(output, name), `// generated ${index}`);
    }
  }
  return {
    root,
    output,
    plugin,
    emit,
    manifest,
    original,
    warnings,
    start,
    close,
    finish,
  };
}

test("successive builds retire owned assets of every type in nested directories", () => {
  const h = fixture();
  const obsolete = [
    "assets/nested/old.css",
    "fonts/nested/old.woff2",
    "assets/nested/old.png",
    "assets/nested/old.wasm",
    "assets/nested/old.js.map",
    "nested/old.html",
  ];
  mkdirSync(join(h.output, "assets/user-empty"));
  h.emit(["js/index.js", ...obsolete]);
  h.finish();
  h.start();
  h.emit(["js/index.js", "assets/current.css"]);
  h.finish();
  for (const file of obsolete) {
    expect(existsSync(join(h.output, file))).toBe(false);
  }
  for (const directory of [
    "assets/nested",
    "fonts/nested",
    "fonts",
    "nested",
  ]) {
    expect(existsSync(join(h.output, directory))).toBe(false);
  }
  expect(existsSync(join(h.output, "assets/user-empty"))).toBe(true);
  expect(verifyGeneratedAssetManifest(h.output).files).toEqual([
    "assets/current.css",
    "js/index.js",
  ]);
});

test.each(["first bytes", "changed bytes"])(
  "case-only output renames preserve current assets and directory ownership (%s)",
  (nextBytes) => {
    const h = fixture();
    function copy(name, bytes) {
      h.plugin.api.recordCopiedAsset(name, Buffer.from(bytes));
      mkdirSync(dirname(join(h.output, name)), { recursive: true });
      writeFileSync(join(h.output, name), bytes);
    }
    copy("assets/nested/item.css", "first bytes");
    h.emit();
    h.finish();
    h.start();
    copy("assets/NESTED/Item.css", nextBytes);
    h.emit();
    h.finish();
    expect(readFileSync(join(h.output, "assets/NESTED/Item.css"), "utf8")).toBe(
      nextBytes,
    );
    expect(verifyGeneratedAssetManifest(h.output).files).toContain(
      "assets/NESTED/Item.css",
    );
    h.start();
    h.emit();
    h.finish();
    expect(existsSync(join(h.output, "assets/NESTED"))).toBe(false);
    expect(existsSync(join(h.output, "assets/nested"))).toBe(false);
  },
);

test("prunes only unchanged previously emitted assets and retains every current chunk", () => {
  const h = fixture({
    ...empty(),
    files: ["assets/obsolete.js"],
    hashes: { "assets/obsolete.js": hash("obsolete") },
  });
  writeFileSync(join(h.output, "assets/obsolete.js"), "obsolete");
  writeFileSync(
    join(h.output, "assets/canonicalVowlWorker-foreign.js"),
    "foreign",
  );
  h.emit();
  h.finish();
  expect(existsSync(join(h.output, "assets/obsolete.js"))).toBe(false);
  expect(
    readFileSync(
      join(h.output, "assets/canonicalVowlWorker-foreign.js"),
      "utf8",
    ),
  ).toBe("foreign");
  const manifest = verifyGeneratedAssetManifest(h.output);
  expect(manifest.files).toEqual([
    "assets/current.js",
    "assets/shared.js",
    "js/index.js",
  ]);
});

test("an interrupted old temporary manifest cannot block a later successful build", () => {
  const h = fixture();
  writeFileSync(`${h.manifest}.next`, "interrupted legacy attempt");
  h.emit();
  h.finish();
  expect(verifyGeneratedAssetManifest(h.output).files).toContain(
    "assets/current.js",
  );
  expect(readFileSync(`${h.manifest}.next`, "utf8")).toBe(
    "interrupted legacy attempt",
  );
});

test("modified and unowned files stay intact, with a diagnostic for modified ownership", () => {
  const h = fixture({
    ...empty(),
    files: ["assets/edited.css"],
    hashes: { "assets/edited.css": hash("original") },
  });
  writeFileSync(join(h.output, "assets/edited.css"), "user edit");
  writeFileSync(join(h.output, "assets/unproven.png"), "unknown origin");
  h.emit();
  h.finish();
  expect(readFileSync(join(h.output, "assets/edited.css"), "utf8")).toBe(
    "user edit",
  );
  expect(readFileSync(join(h.output, "assets/unproven.png"), "utf8")).toBe(
    "unknown origin",
  );
  expect(h.warnings).toContain(
    "Preserved modified generated asset: assets/edited.css",
  );
});

test.each(["no write", "failed render"])(
  "%s leaves prior assets and manifest untouched",
  (failure) => {
    const h = fixture({
      ...empty(),
      files: ["js/old.js"],
      hashes: { "js/old.js": hash("retained") },
    });
    writeFileSync(join(h.output, "js/old.js"), "retained");
    h.emit();
    if (failure === "failed render") {
      h.plugin.writeBundle.handler();
      h.plugin.renderError(new Error("failed render"));
    }
    h.close();
    expect(readFileSync(join(h.output, "js/old.js"), "utf8")).toBe("retained");
    expect(readFileSync(h.manifest, "utf8")).toBe(h.original);
  },
);

test("explicit non-writing output cannot authorize cleanup", () => {
  const h = fixture(empty(), { write: false });
  h.plugin.generateBundle.handler(
    {},
    { "index.html": { type: "asset", fileName: "index.html", source: "new" } },
    false,
  );
  h.finish();
  expect(readFileSync(h.manifest, "utf8")).toBe(h.original);
  expect(existsSync(join(h.output, "index.html"))).toBe(false);
});

test("copy producers register actual bytes before writing, and removed copies retire", () => {
  const h = fixture();
  const bytes = Buffer.from([0, 255, 1, 2]);
  expect(h.plugin.api.recordCopiedAsset("copied/nested/image.bin", bytes)).toBe(
    bytes,
  );
  mkdirSync(join(h.output, "copied/nested"), { recursive: true });
  writeFileSync(join(h.output, "copied/nested/image.bin"), bytes);
  h.emit();
  h.finish();
  expect(
    verifyGeneratedAssetManifest(h.output).hashes["copied/nested/image.bin"],
  ).toBe(hash(bytes));
  h.start();
  h.emit();
  h.finish();
  expect(existsSync(join(h.output, "copied"))).toBe(false);
});

test.each(["assets/current.js", "assets/current.css"])(
  "a current output collision preserves an unrelated or modified %s",
  (name) => {
    const h = fixture();
    writeFileSync(join(h.output, name), "user edit");
    expect(() => h.emit([name])).toThrow("Refusing to overwrite");
    expect(readFileSync(join(h.output, name), "utf8")).toBe("user edit");
    expect(readFileSync(h.manifest, "utf8")).toBe(h.original);
  },
);

test("migration accepts only hash-proven legacy JavaScript and retires its metadata", () => {
  const h = fixture(null);
  const legacy = join(h.output, ".vite/webvowl-generated-js.json");
  const files = [
    "assets/old.js",
    "js/unproven.js",
    "assets/unproven.png",
    "../outside.js",
  ];
  writeFileSync(
    legacy,
    JSON.stringify({
      schemaVersion: 1,
      files,
      hashes: {
        "assets/old.js": hash("old"),
        "assets/unproven.png": hash("unproven"),
      },
    }),
  );
  writeFileSync(join(h.output, "assets/old.js"), "old");
  writeFileSync(join(h.output, "js/unproven.js"), "unproven");
  writeFileSync(join(h.output, "assets/unproven.png"), "unproven");
  writeFileSync(join(h.root, "outside.js"), "outside");
  h.start();
  h.emit();
  h.finish();
  expect(existsSync(legacy)).toBe(false);
  expect(existsSync(join(h.output, "assets/old.js"))).toBe(false);
  expect(readFileSync(join(h.output, "js/unproven.js"), "utf8")).toBe(
    "unproven",
  );
  expect(readFileSync(join(h.output, "assets/unproven.png"), "utf8")).toBe(
    "unproven",
  );
  expect(readFileSync(join(h.root, "outside.js"), "utf8")).toBe("outside");
  expect(verifyGeneratedAssetManifest(h.output).schemaVersion).toBe(2);
});

test.each([
  "../outside.css",
  "assets/../../outside.css",
  "/absolute.css",
  "C:/outside.css",
  "assets\\outside.css",
  "assets//outside.css",
  "assets/../outside.css",
  "assets/.. /outside.css",
  "assets/file:stream",
  ".vite/webvowl-generated-assets.json",
])("unsafe or reserved emitted path %s is rejected before writing", (name) => {
  const h = fixture();
  expect(() =>
    h.plugin.generateBundle.handler(
      {},
      { asset: { type: "asset", fileName: name, source: "bad" } },
      true,
    ),
  ).toThrow();
  expect(readFileSync(h.manifest, "utf8")).toBe(h.original);
});

test("escaped paths in a current ownership manifest fail closed", () => {
  const h = fixture();
  const bad = {
    ...empty(),
    files: ["../outside.css"],
    hashes: { "../outside.css": hash("outside") },
  };
  writeFileSync(h.manifest, JSON.stringify(bad));
  expect(h.start).toThrow("Unsafe generated asset path");
  expect(JSON.parse(readFileSync(h.manifest, "utf8"))).toEqual(bad);
});

test("redirected nested directories cannot make cleanup delete outside output", () => {
  const h = fixture({
    ...empty(),
    files: ["assets/nested/old.css"],
    hashes: { "assets/nested/old.css": hash("retained") },
    directories: ["assets/nested"],
  });
  const foreign = join(h.root, "foreign");
  mkdirSync(foreign);
  writeFileSync(join(foreign, "old.css"), "retained");
  symlinkSync(foreign, join(h.output, "assets/nested"), "junction");
  h.emit(["js/index.js"]);
  h.finish();
  expect(readFileSync(join(foreign, "old.css"), "utf8")).toBe("retained");
  expect(existsSync(join(h.output, "assets/nested"))).toBe(true);
});

test("redirected asset directories cannot make writers overwrite outside output", () => {
  const h = fixture();
  const foreign = join(h.root, "foreign");
  mkdirSync(foreign);
  writeFileSync(join(foreign, "current.css"), "retained");
  rmdirSync(join(h.output, "assets"));
  symlinkSync(foreign, join(h.output, "assets"), "junction");
  expect(() => h.emit(["assets/current.css"])).toThrow("Redirected");
  expect(readFileSync(join(foreign, "current.css"), "utf8")).toBe("retained");
});

test("a changed ownership manifest cannot authorize pruning during a build", () => {
  const h = fixture();
  h.emit();
  writeFileSync(
    h.manifest,
    JSON.stringify({ ...empty(), directories: ["foreign"] }),
  );
  expect(h.finish).toThrow("ownership changed");
});

test("an expected current asset missing after writing cannot publish ownership", () => {
  const h = fixture();
  h.emit();
  rmSync(join(h.output, "assets/current.js"));
  expect(h.finish).toThrow("Missing or changed generated asset");
  expect(readFileSync(h.manifest, "utf8")).toBe(h.original);
});
