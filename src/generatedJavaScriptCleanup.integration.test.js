import { execFileSync } from "node:child_process";
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
  expect(manifest).toEqual({
    schemaVersion: 1,
    files: outputNames
      .filter((fileName) => fileName !== "unknown-user-file.js")
      .map((fileName) => `js/${fileName}`)
      .sort(),
  });
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
});
