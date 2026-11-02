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

test("successive Vite builds retire changed worker entries and lazy chunks while preserving foreign files", async () => {
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
    import { createGeneratedJavaScriptCleanupPlugin } from "./util/generatedJavaScriptCleanup.mjs";

    const root = process.env.WEBVOWL_WORKER_ROLLOVER_ROOT;
    const output = join(root, "deploy");
    const manifestPath = join(output, ".vite/webvowl-generated-js.json");
    writeFileSync(join(root, "index.html"), '<script type="module" src="/main.js"></script>');
    writeFileSync(join(root, "main.js"), 'globalThis.worker = new Worker(new URL("./canonicalVowlWorker.js", import.meta.url), { type: "module" });');
    writeFileSync(join(root, "canonicalVowlWorker.js"), 'self.onmessage = async () => self.postMessage((await import("./worker-dependency.js")).value);');
    const dependency = join(root, "worker-dependency.js");
    const readManifest = () => JSON.parse(readFileSync(manifestPath, "utf8"));
    const buildFixture = () => build({
      root,
      configFile: false,
      publicDir: false,
      logLevel: "silent",
      worker: { format: "es" },
      build: { outDir: output, emptyOutDir: false },
      plugins: [createGeneratedJavaScriptCleanupPlugin({
        manifestName: ".vite/webvowl-generated-js.json", legacyFiles: [],
      })],
    });
    writeFileSync(dependency, 'export const value = "first build";');
    await buildFixture();
    const first = readManifest();
    const firstWorkers = first.files.filter((file) => /^assets\\/canonicalVowlWorker-[^/]+\\.js$/u.test(file));
    assert.equal(firstWorkers.length, 1, "First build must record the actual worker entry");
    const firstLazy = first.files.filter((file) => /^assets\\/worker-dependency-[^/]+\\.js$/u.test(file));
    assert.equal(firstLazy.length, 1, "First build must record the lazy worker chunk");
    const foreign = join(output, "assets/canonicalVowlWorker-foreign.js");
    const data = join(output, "data/user.json");
    mkdirSync(join(output, "data"));
    writeFileSync(foreign, "user-owned JavaScript");
    writeFileSync(data, "user-owned data");

    writeFileSync(dependency, 'export const value = "second build";');
    await buildFixture();
    const second = readManifest();
    const obsolete = first.files.filter((file) => !second.files.includes(file));
    assert(obsolete.includes(firstWorkers[0]), "Changing a worker dependency must change the worker entry hash");
    assert(obsolete.includes(firstLazy[0]), "Changing lazy worker bytes must change its chunk hash");
    for (const file of obsolete) assert(!existsSync(join(output, file)), "Old generated JavaScript survived: " + file);
    for (const file of second.files) {
      assert.equal(createHash("sha256").update(readFileSync(join(output, file))).digest("hex"), second.hashes[file]);
    }
    assert.equal(readFileSync(foreign, "utf8"), "user-owned JavaScript");
    assert.equal(readFileSync(data, "utf8"), "user-owned data");
    const actualWorkers = readdirSync(join(output, "assets")).filter((file) => /^canonicalVowlWorker-.*\\.js$/u.test(file));
    assert.equal(actualWorkers.length, 2, "Only the current worker and unrelated foreign file may remain");
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
      JSON.stringify({ schemaVersion: 1, files: ["js/obsolete-owned.js"] }),
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
        (plugin) => plugin.name === "webvowl-generated-javascript-cleanup",
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
      join(metadataDirectory, "webvowl-generated-js.json"),
      "utf8",
    ),
  );
  expect(manifest.schemaVersion).toBe(1);
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
  const manifestPath = join(metadataDirectory, "webvowl-generated-js.json");
  // json-identity-contract: bytes; owner: Vite generated-manifest regression; reason: Retain the exact serialized manifest preimage to detect forbidden source-file writes.
  const manifestText = `${JSON.stringify({
    schemaVersion: 1,
    files: ["js/owned.js"],
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
