import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

import { expect, test } from "@jest/globals";

const VITE_CONFIGURATION_FILE_PATH = fileURLToPath(
  new URL("../vite.config.mjs", import.meta.url),
);

test("bundles D3 through the application ESM graph without a classic asset", () => {
  // Rolldown's native binding needs the normal Node realm, as in the real CLI.
  const verificationSource = `
    import { build } from "vite";
    import createConfiguration from ${JSON.stringify(pathToFileURL(VITE_CONFIGURATION_FILE_PATH).href)};

    const configuration = createConfiguration({
      command: "build", mode: "production", isPreview: false, isSsrBuild: false,
    });
    const plugins = configuration.plugins.map((plugin) => {
      if (!plugin?.name || !["mtime-preserve", "webvowl-build"].includes(plugin.name)) {
        return plugin;
      }
      const buildOnlyPlugin = { ...plugin };
      delete buildOnlyPlugin.closeBundle;
      if (plugin.name === "mtime-preserve") delete buildOnlyPlugin.buildStart;
      return buildOnlyPlugin;
    });
    const buildResult = await build({
      ...configuration,
      build: { ...configuration.build, write: false },
      configFile: false,
      logLevel: "silent",
      plugins,
    });
    const outputs = [buildResult].flat().flatMap((result) => result.output);
    const chunks = outputs.filter((output) => output.type === "chunk");
    const html = outputs.find((output) => output.fileName === "index.html");
    const d3ModuleCount = chunks.flatMap((chunk) => Object.keys(chunk.modules))
      .filter((moduleId) => /node_modules[\\\\/]d3(?:[\\\\/]|$)/u.test(moduleId)).length;
    console.log(JSON.stringify({
      d3ModuleCount,
      hasClassicD3Asset: outputs.some((output) => output.fileName.endsWith("d3.min.js")),
      htmlHasClassicD3Script: html.source.includes("d3.min.js"),
    }));
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
  const result = JSON.parse(output.trim().split("\n").at(-1));

  expect(result.d3ModuleCount).toBeGreaterThan(0);
  expect(result.hasClassicD3Asset).toBe(false);
  expect(result.htmlHasClassicD3Script).toBe(false);
});
