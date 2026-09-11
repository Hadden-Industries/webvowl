import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

import { expect, test } from "@jest/globals";

const VITE_CONFIGURATION_FILE_PATH = fileURLToPath(
  new URL("../vite.config.mjs", import.meta.url),
);

test("the production bundle links without a browser package resolver", () => {
  // Rolldown's native binding needs the normal Node realm, as in the real CLI.
  const verificationSource = `
  import assert from "node:assert/strict";
  import { SourceTextModule } from "node:vm";
  import { build } from "vite";
  import createConfiguration from ${JSON.stringify(pathToFileURL(VITE_CONFIGURATION_FILE_PATH).href)};

  const configuration = createConfiguration({
    command: "build", mode: "production", isPreview: false, isSsrBuild: false,
  });
  // File timestamp preservation and post-build deletion are outside this
  // module-link contract. write:false alone still invokes closeBundle. Omit
  // only those filesystem hooks; retain all HTML and module transformations.
  const plugins = configuration.plugins.map((plugin) => {
    if (!["mtime-preserve", "webvowl-build"].includes(plugin.name)) {
      return plugin;
    }
    assert.equal(typeof plugin.closeBundle, "function");
    const moduleGenerationPlugin = { ...plugin };
    delete moduleGenerationPlugin.closeBundle;
    if (plugin.name === "mtime-preserve") {
      delete moduleGenerationPlugin.buildStart;
    }
    return moduleGenerationPlugin;
  });
  plugins.push({
    name: "assert-production-environment",
    configResolved(resolvedConfiguration) {
      assert.equal(resolvedConfiguration.mode, "production");
      assert.equal(resolvedConfiguration.isProduction, true);
    },
  });
  const buildResult = await build({
    ...configuration,
    configFile: false,
    plugins,
    logLevel: "silent",
    build: { ...configuration.build, write: false },
  });
  const chunks = [buildResult]
    .flat()
    .flatMap((result) => result.output)
    .filter((output) => output.type === "chunk");

  assert(chunks.some((chunk) => chunk.isEntry), "Missing application entry");
  assert(chunks.length > 1, "Expected the actual split application graph");

  const modules = new Map(
    chunks.map((chunk) => {
      const identifier = new URL(
        chunk.fileName,
        "https://example.test/webvowl/",
      ).href;
      return [identifier, new SourceTextModule(chunk.code, { identifier })];
    }),
  );

  // Native ES-module linking checks actual emitted imports and exports. Every
  // application chunk, including lazy entries, must resolve to a shipped chunk;
  // Node's package resolution must not conceal an unresolved browser import.
  for (const module of modules.values()) {
    if (module.status !== "unlinked") {
      continue;
    }
    await module.link((specifier, referencingModule) => {
      const dependency = modules.get(
        new URL(specifier, referencingModule.identifier).href,
      );
      if (!dependency) {
        throw new Error(
          "Unshipped module " + JSON.stringify(specifier) +
          " imported by " + referencingModule.identifier,
        );
      }
      return dependency;
    });
  }

  assert([...modules.values()].every((module) => module.status === "linked"));
  console.log(JSON.stringify({ linkedChunkCount: modules.size }));
  `;
  const output = execFileSync(
    process.execPath,
    ["--input-type=module", "--eval", verificationSource],
    {
      cwd: fileURLToPath(new URL("../", import.meta.url)),
      encoding: "utf8",
      env: { ...process.env, NODE_ENV: "production" },
      timeout: 40_000,
      windowsHide: true,
    },
  );

  expect(
    JSON.parse(output.trim().split("\n").at(-1)).linkedChunkCount,
  ).toBeGreaterThan(1);
}, 45_000);
