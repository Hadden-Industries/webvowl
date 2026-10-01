import { build, preview } from "vite";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import process from "node:process";
import { writeFile } from "node:fs/promises";
import { browserVectors } from "./browser-vectors.mjs";

// Explicit external output keeps qualification bundles out of both product and package.
if (!process.argv[2]) {
  throw new Error("An explicit output directory is required.");
}
const root = fileURLToPath(new URL("../test/browser/", import.meta.url));
const outDir = resolve(process.argv[2]);
await build({
  configFile: false,
  root,
  logLevel: "warn",
  build: { outDir, emptyOutDir: false, minify: false },
  worker: { format: "es" },
});
await writeFile(
  resolve(outDir, "qualification-vectors.json"),
  JSON.stringify(await browserVectors()),
);
if (!process.argv.includes("--build-only")) {
  const server = await preview({
    configFile: false,
    root,
    build: { outDir },
    preview: { host: "127.0.0.1", port: 4186, strictPort: true },
  });
  server.printUrls();
}
