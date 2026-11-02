import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { afterEach, expect, test } from "@jest/globals";

const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));
const viteConfigurationUrl = pathToFileURL(
  fileURLToPath(new URL("../vite.config.mjs", import.meta.url)),
).href;

const temporaryDirectories = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

test("successive Vite builds retire nested generated assets and copies while preserving foreign files", async () => {
  const temporaryDirectory = await mkdtemp(
    join(tmpdir(), "webvowl-worker-rollover-"),
  );
  temporaryDirectories.push(temporaryDirectory);
  const verificationSource = `
    import assert from "node:assert/strict";
    import { createHash } from "node:crypto";
    import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
    import { join } from "node:path";
    import { build } from "vite";
    import { viteStaticCopy } from "vite-plugin-static-copy";
    import { createGeneratedAssetCleanupPlugin } from "./util/generatedAssetCleanup.mjs";

    const root = process.env.WEBVOWL_WORKER_ROLLOVER_ROOT;
    const output = join(root, "deploy");
    const manifestPath = join(output, ".vite/webvowl-generated-assets.json");
    writeFileSync(join(root, "index.html"), '<link rel="stylesheet" href="/main.css"><script type="module" src="/main.js"></script>');
    writeFileSync(join(root, "main.js"), 'import wasm from "./fixture.wasm?url"; globalThis.wasm = wasm; globalThis.worker = new Worker(new URL("./canonicalVowlWorker.js", import.meta.url), { type: "module" });');
    writeFileSync(join(root, "canonicalVowlWorker.js"), 'self.onmessage = async () => self.postMessage((await import("./worker-dependency.js")).value);');
    const dependency = join(root, "worker-dependency.js");
    const readManifest = () => JSON.parse(readFileSync(manifestPath, "utf8"));
    let includeCopy = true;
    let sourceMaps = true;
    const buildFixture = () => {
      const cleanup = createGeneratedAssetCleanupPlugin();
      return build({
        root, configFile: false, publicDir: false, logLevel: "silent",
        worker: { format: "es", rolldownOptions: { output: {
          entryFileNames: "assets/workers/[name]-[hash].js",
          chunkFileNames: "assets/workers/[name]-[hash].js",
        } } },
        build: { outDir: output, emptyOutDir: false, sourcemap: sourceMaps, assetsInlineLimit: 0,
          rolldownOptions: { output: {
            entryFileNames: "js/entries/[name]-[hash].js",
            assetFileNames: "assets/nested/[name]-[hash][extname]",
          } },
        },
        plugins: [...viteStaticCopy({ targets: includeCopy ? [{
          src: "copy.bin", dest: "static/deep",
          transform: { encoding: "buffer", handler: (bytes) => cleanup.api.recordCopiedAsset("static/deep/copy.bin", bytes) },
        }] : [], silent: true }), cleanup],
      });
    };
    function inputs(revision) {
      writeFileSync(join(root, "main.css"), '@font-face { font-family: fixture; src: url("./fixture.woff2"); } body { color: ' + (revision === 1 ? "red" : "blue") + '; background-image: url("./pixel.svg"); }');
      writeFileSync(join(root, "fixture.woff2"), Buffer.from([0, 255, revision]));
      writeFileSync(join(root, "fixture.wasm"), Buffer.from([0,97,115,109,1,0,0,0,0,2,1,64+revision]));
      writeFileSync(join(root, "pixel.svg"), '<svg xmlns="http://www.w3.org/2000/svg"><text>' + revision + '</text></svg>');
      writeFileSync(join(root, "copy.bin"), Buffer.from([0, 255, revision]));
    }
    inputs(1);
    writeFileSync(dependency, 'export const value = "first build";');
    await buildFixture();
    const first = readManifest();
    const firstWorkers = first.files.filter((file) => /^assets\\/workers\\/canonicalVowlWorker-[^/]+\\.js$/u.test(file));
    assert.equal(firstWorkers.length, 1, "First build must record the actual worker entry");
    const firstLazy = first.files.filter((file) => /^assets\\/workers\\/worker-dependency-[^/]+\\.js$/u.test(file));
    assert.equal(firstLazy.length, 1, "First build must record the lazy worker chunk");
    const foreign = join(output, "assets/canonicalVowlWorker-foreign.js");
    const foreignMap = join(output, "assets/user-owned.map");
    const data = join(output, "data/user.json");
    mkdirSync(join(output, "data"));
    writeFileSync(foreign, "user-owned JavaScript");
    writeFileSync(foreignMap, "user-owned source map");
    writeFileSync(data, "user-owned data");

    inputs(2);
    writeFileSync(dependency, 'export const value = "second build";');
    await buildFixture();
    const second = readManifest();
    const obsolete = first.files.filter((file) => !second.files.includes(file));
    assert(obsolete.includes(firstWorkers[0]), "Changing a worker dependency must change the worker entry hash");
    assert(obsolete.includes(firstLazy[0]), "Changing lazy worker bytes must change its chunk hash");
    for (const extension of [".css", ".woff2", ".svg", ".wasm", ".map"]) {
      assert(obsolete.some((file) => file.endsWith(extension)), "Missing real asset rollover for " + extension);
      assert(second.files.some((file) => file.endsWith(extension)), "Current asset not owned: " + extension);
    }
    for (const file of obsolete) assert(!existsSync(join(output, file)), "Old generated JavaScript survived: " + file);
    for (const file of second.files) {
      assert.equal(createHash("sha256").update(readFileSync(join(output, file))).digest("hex"), second.hashes[file]);
    }
    assert.equal(readFileSync(foreign, "utf8"), "user-owned JavaScript");
    assert.equal(readFileSync(data, "utf8"), "user-owned data");
    function physicalFiles(directory = "") {
      return readdirSync(join(output, directory), { withFileTypes: true }).flatMap((entry) => {
        const name = directory ? directory + "/" + entry.name : entry.name;
        return entry.isDirectory() ? physicalFiles(name) : [name];
      });
    }
    const expectedFiles = [...second.files, ".vite/webvowl-generated-assets.json", "assets/canonicalVowlWorker-foreign.js", "assets/user-owned.map", "data/user.json"].sort();
    assert.deepEqual(physicalFiles().sort(), expectedFiles, "Every generated physical file must have explicit ownership");
    includeCopy = false;
    sourceMaps = false;
    await buildFixture();
    const third = readManifest();
    assert(!third.files.includes("static/deep/copy.bin"));
    assert(!third.files.some((name) => name.endsWith(".map")));
    for (const name of second.files.filter((name) => name.endsWith(".map"))) assert(!existsSync(join(output, name)), "Owned source map survived a map-free build: " + name);
    assert(!existsSync(join(output, "static")), "Removed copies must retire empty build-owned parents");
    assert.equal(readFileSync(foreign, "utf8"), "user-owned JavaScript");
    assert.equal(readFileSync(foreignMap, "utf8"), "user-owned source map");
    assert.equal(readFileSync(data, "utf8"), "user-owned data");
  `;
  execFileSync(
    process.execPath,
    ["--input-type=module", "--eval", verificationSource],
    {
      cwd: repositoryRoot,
      encoding: "utf8",
      env: { ...process.env, WEBVOWL_WORKER_ROLLOVER_ROOT: temporaryDirectory },
      timeout: 15_000,
      windowsHide: true,
    },
  );
});

test.each(["writeBundle", "closeBundle"])(
  "a failed %s writer cannot prune the previously accepted output",
  async (failureHook) => {
    const temporaryDirectory = await mkdtemp(
      join(tmpdir(), "webvowl-failed-asset-write-"),
    );
    temporaryDirectories.push(temporaryDirectory);
    const verificationSource = `
      import assert from "node:assert/strict";
      import { existsSync, readFileSync, writeFileSync } from "node:fs";
      import { join } from "node:path";
      import { build } from "vite";
      import { createGeneratedAssetCleanupPlugin } from "./util/generatedAssetCleanup.mjs";
      const root = process.env.WEBVOWL_FAILED_ASSET_ROOT;
      const hook = process.env.WEBVOWL_FAILED_ASSET_HOOK;
      const output = join(root, "deploy");
      writeFileSync(join(root, "index.html"), '<script type="module" src="/main.js"></script>');
      writeFileSync(join(root, "main.js"), 'globalThis.fixture = true;');
      const buildFixture = (version, fail) => build({
        root, configFile: false, publicDir: false, logLevel: "silent",
        build: { outDir: output, emptyOutDir: false },
        plugins: [{ name: "fixture-asset-producer", buildStart() {
          this.emitFile({ type: "asset", fileName: "assets/" + version + ".css", source: version });
        } }, ...(fail ? [{ name: "fixture-failed-writer", [hook]() { throw new Error("deliberate writer failure"); } }] : []), createGeneratedAssetCleanupPlugin()],
      });
      await buildFixture("old", false);
      const manifestPath = join(output, ".vite/webvowl-generated-assets.json");
      const before = readFileSync(manifestPath);
      await assert.rejects(buildFixture("new", true), /deliberate writer failure/);
      assert(readFileSync(manifestPath).equals(before), "Failed writer published new ownership");
      assert(existsSync(join(output, "assets/old.css")), "Failed writer pruned previous output");
    `;
    execFileSync(
      process.execPath,
      ["--input-type=module", "--eval", verificationSource],
      {
        cwd: repositoryRoot,
        encoding: "utf8",
        timeout: 15_000,
        windowsHide: true,
        env: {
          ...process.env,
          WEBVOWL_FAILED_ASSET_ROOT: temporaryDirectory,
          WEBVOWL_FAILED_ASSET_HOOK: failureHook,
        },
      },
    );
  },
);

test("a production build removes obsolete owned JavaScript without deleting unknown files", async () => {
  const temporaryDirectory = await mkdtemp(
    join(tmpdir(), "webvowl-generated-javascript-"),
  );
  temporaryDirectories.push(temporaryDirectory);
  const outputDirectory = join(temporaryDirectory, "deploy");
  const javascriptDirectory = join(outputDirectory, "js");
  const metadataDirectory = join(outputDirectory, ".vite");
  await mkdir(javascriptDirectory, { recursive: true });
  await mkdir(metadataDirectory, { recursive: true });

  const obsoleteOwnedPath = join(javascriptDirectory, "obsolete-owned.js");
  const unknownPath = join(javascriptDirectory, "unknown-user-file.js");
  const legacyPaths = [
    "d3.min.js",
    "jsonld.esm.js",
    "vendor~jsonld.esm.js",
    "n3.min.js",
    "vendor~n3.min.js",
  ].map((fileName) => join(javascriptDirectory, fileName));
  await Promise.all([
    writeFile(obsoleteOwnedPath, "obsolete", "utf8"),
    writeFile(unknownPath, "preserve", "utf8"),
    ...legacyPaths.map((filePath) => writeFile(filePath, "legacy", "utf8")),
    writeFile(
      join(metadataDirectory, "webvowl-generated-js.json"),
      JSON.stringify({
        schemaVersion: 1,
        files: [
          "js/obsolete-owned.js",
          ...legacyPaths.map((path) => `js/${path.split(/[\\/]/u).at(-1)}`),
        ],
        hashes: Object.fromEntries([
          [
            "js/obsolete-owned.js",
            createHash("sha256").update("obsolete").digest("hex"),
          ],
          ...legacyPaths.map((path) => [
            `js/${path.split(/[\\/]/u).at(-1)}`,
            createHash("sha256").update("legacy").digest("hex"),
          ]),
        ]),
      }),
      "utf8",
    ),
  ]);

  const verificationSource = `
    import assert from "node:assert/strict";
    import { build } from "vite";
    import createConfiguration from ${JSON.stringify(viteConfigurationUrl)};

    const configuration = createConfiguration({
      command: "build", mode: "production", isPreview: false, isSsrBuild: false,
    });
    assert(
      configuration.plugins.some(
        (plugin) => plugin.name === "webvowl-generated-asset-cleanup",
      ),
      "Missing generated JavaScript cleanup plugin",
    );
    const plugins = configuration.plugins.map((plugin) => {
      if (!["mtime-preserve", "webvowl-build"].includes(plugin.name)) {
        return plugin;
      }
      const isolatedOutputPlugin = { ...plugin };
      delete isolatedOutputPlugin.closeBundle;
      if (plugin.name === "mtime-preserve") delete isolatedOutputPlugin.buildStart;
      return isolatedOutputPlugin;
    });
    await build({
      ...configuration,
      build: {
        ...configuration.build,
        outDir: ${JSON.stringify(outputDirectory)},
      },
      configFile: false,
      logLevel: "silent",
      plugins,
    });
  `;
  execFileSync(
    process.execPath,
    ["--input-type=module", "--eval", verificationSource],
    {
      cwd: repositoryRoot,
      encoding: "utf8",
      env: { ...process.env, NODE_ENV: "production" },
      timeout: 40_000,
      windowsHide: true,
    },
  );

  const outputNames = await readdir(javascriptDirectory);
  expect(outputNames).not.toContain("obsolete-owned.js");
  expect(outputNames).not.toContain("d3.min.js");
  expect(outputNames).not.toContain("jsonld.esm.js");
  expect(outputNames).not.toContain("vendor~jsonld.esm.js");
  expect(outputNames).not.toContain("n3.min.js");
  expect(outputNames).not.toContain("vendor~n3.min.js");
  expect(await readFile(unknownPath, "utf8")).toBe("preserve");

  const manifest = JSON.parse(
    await readFile(
      join(metadataDirectory, "webvowl-generated-assets.json"),
      "utf8",
    ),
  );
  expect(manifest.schemaVersion).toBe(2);
  expect(manifest.files.filter((file) => file.startsWith("js/"))).toEqual(
    outputNames
      .filter((fileName) => fileName !== "unknown-user-file.js")
      .map((fileName) => `js/${fileName}`)
      .sort(),
  );
  const workerFiles = (await readdir(join(outputDirectory, "assets")))
    .filter((file) => file.endsWith(".js"))
    .map((file) => `assets/${file}`);
  expect(workerFiles.length).toBeGreaterThan(0);
  expect(manifest.files.filter((file) => file.startsWith("assets/"))).toEqual(
    workerFiles.sort(),
  );
  for (const file of manifest.files) {
    expect(manifest.hashes[file]).toBe(
      createHash("sha256")
        .update(await readFile(join(outputDirectory, file)))
        .digest("hex"),
    );
  }
});

test("non-writing Vite lifecycles preserve existing generated JavaScript", async () => {
  const temporaryDirectory = await mkdtemp(
    join(tmpdir(), "webvowl-generated-javascript-read-only-"),
  );
  temporaryDirectories.push(temporaryDirectory);
  const outputDirectory = join(temporaryDirectory, "deploy");
  const javascriptDirectory = join(outputDirectory, "js");
  const metadataDirectory = join(outputDirectory, ".vite");
  await mkdir(javascriptDirectory, { recursive: true });
  await mkdir(metadataDirectory, { recursive: true });

  const ownedPath = join(javascriptDirectory, "owned.js");
  const manifestPath = join(metadataDirectory, "webvowl-generated-assets.json");
  // json-identity-contract: bytes; owner: Vite generated-manifest regression; reason: Retain the exact serialized manifest preimage to detect forbidden source-file writes.
  const manifestText = `${JSON.stringify({
    schemaVersion: 2,
    files: ["js/owned.js"],
    hashes: {
      "js/owned.js": createHash("sha256").update("owned").digest("hex"),
    },
    directories: [],
  })}\n`;
  await Promise.all([
    writeFile(ownedPath, "owned", "utf8"),
    writeFile(manifestPath, manifestText, "utf8"),
  ]);

  const verificationSource = `
    import { build, createServer } from "vite";
    import createConfiguration from ${JSON.stringify(viteConfigurationUrl)};

    const buildConfiguration = createConfiguration({
      command: "build", mode: "production", isPreview: false, isSsrBuild: false,
    });
    const buildPlugins = buildConfiguration.plugins.map((plugin) => {
      if (!["mtime-preserve", "webvowl-build"].includes(plugin.name)) {
        return plugin;
      }
      const isolatedOutputPlugin = { ...plugin };
      delete isolatedOutputPlugin.closeBundle;
      if (plugin.name === "mtime-preserve") delete isolatedOutputPlugin.buildStart;
      return isolatedOutputPlugin;
    });
    await build({
      ...buildConfiguration,
      build: {
        ...buildConfiguration.build,
        outDir: ${JSON.stringify(outputDirectory)},
        write: false,
      },
      configFile: false,
      logLevel: "silent",
      plugins: buildPlugins,
    });

    const serveConfiguration = createConfiguration({
      command: "serve", mode: "development", isPreview: false, isSsrBuild: false,
    });
    const server = await createServer({
      ...serveConfiguration,
      build: {
        ...serveConfiguration.build,
        outDir: ${JSON.stringify(outputDirectory)},
      },
      configFile: false,
      logLevel: "silent",
      server: { middlewareMode: true },
    });
    await server.close();
  `;
  execFileSync(
    process.execPath,
    ["--input-type=module", "--eval", verificationSource],
    {
      cwd: repositoryRoot,
      encoding: "utf8",
      timeout: 40_000,
      windowsHide: true,
    },
  );

  expect(await readFile(ownedPath, "utf8")).toBe("owned");
  expect(await readFile(manifestPath, "utf8")).toBe(manifestText);
}, 30_000);
