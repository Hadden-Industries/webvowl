import { createHash, randomUUID } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";

const generatedPath = /^(?:js|assets)\/[A-Za-z0-9._~-]+\.js$/u;
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");

/**
 * Track JavaScript actually emitted by this build, including Vite's worker
 * assets. Only unchanged, previously owned files are eligible for pruning.
 * This governs local output; retain complete release sets before deployment.
 * Schema 1 remains readable by the earlier JS-only cleanup implementation.
 */
export function createGeneratedJavaScriptCleanupPlugin({
  manifestName,
  legacyFiles,
}) {
  let outputDirectory;
  const emitted = new Set();
  let wroteBundle = false;

  function regularFile(fileName) {
    if (!generatedPath.test(fileName)) return undefined;
    const parent = resolve(outputDirectory, fileName.split("/")[0]);
    if (!existsSync(parent) || lstatSync(parent).isSymbolicLink()) return;
    const path = resolve(outputDirectory, fileName);
    if (!existsSync(path)) return;
    const info = lstatSync(path);
    return info.isFile() && !info.isSymbolicLink() ? path : undefined;
  }

  return {
    name: "webvowl-generated-javascript-cleanup",
    apply: "build",
    configResolved(configuration) {
      outputDirectory = resolve(configuration.build.outDir);
    },
    buildStart() {
      emitted.clear();
      wroteBundle = false;
    },
    generateBundle(_options, bundle) {
      for (const output of Object.values(bundle)) {
        // Vite adds nested worker chunks to the parent build as assets.
        const fileName = output.fileName.replaceAll("\\", "/");
        if (generatedPath.test(fileName)) emitted.add(fileName);
      }
    },
    writeBundle: {
      order: "post",
      sequential: true,
      handler() {
        wroteBundle = true;
      },
    },
    renderError() {
      wroteBundle = false;
    },
    closeBundle() {
      if (!outputDirectory || !wroteBundle) return;
      if (lstatSync(outputDirectory).isSymbolicLink()) {
        throw new Error(
          "Generated JavaScript cleanup refuses redirected output",
        );
      }
      const manifestPath = resolve(outputDirectory, manifestName);
      const metadataDirectory = dirname(manifestPath);
      if (
        existsSync(metadataDirectory) &&
        lstatSync(metadataDirectory).isSymbolicLink()
      ) {
        throw new Error(
          "Generated JavaScript cleanup refuses redirected metadata",
        );
      }
      if (
        existsSync(manifestPath) &&
        lstatSync(manifestPath).isSymbolicLink()
      ) {
        throw new Error(
          "Generated JavaScript cleanup refuses redirected manifest",
        );
      }
      const previous = existsSync(manifestPath)
        ? JSON.parse(readFileSync(manifestPath, "utf8"))
        : { schemaVersion: 1, files: [] };
      if (
        previous.schemaVersion !== 1 ||
        !Array.isArray(previous.files) ||
        !previous.files.every((file) => typeof file === "string") ||
        (previous.hashes !== undefined &&
          (!previous.hashes ||
            typeof previous.hashes !== "object" ||
            Array.isArray(previous.hashes)))
      ) {
        throw new Error(
          `Invalid generated JavaScript manifest: ${manifestPath}`,
        );
      }
      const hashes = Object.fromEntries(
        [...emitted].sort().map((file) => {
          const path = regularFile(file);
          if (!path) throw new Error(`Missing generated JavaScript: ${file}`);
          return [file, digest(readFileSync(path))];
        }),
      );
      const obsolete = [];
      for (const file of new Set([...legacyFiles, ...previous.files])) {
        const path = regularFile(file);
        if (!path || emitted.has(file)) continue;
        const expected = previous.hashes?.[file];
        // Pre-manifest authority covers the existing finite JS-only list and
        // legacy JS manifests. Never infer worker ownership from a filename.
        const legacy = previous.hashes === undefined && file.startsWith("js/");
        if (
          (typeof expected === "string" &&
            /^[a-f0-9]{64}$/u.test(expected) &&
            digest(readFileSync(path)) === expected) ||
          legacy
        )
          obsolete.push(path);
      }
      mkdirSync(metadataDirectory, { recursive: true });
      // Prepare complete metadata before removing anything; publish atomically.
      const temporaryManifest = `${manifestPath}.${randomUUID()}.tmp`;
      writeFileSync(
        temporaryManifest,
        JSON.stringify(
          { schemaVersion: 1, files: [...emitted].sort(), hashes },
          null,
          2,
        ) + "\n",
        { encoding: "utf8", flag: "wx" },
      );
      try {
        for (const path of obsolete) unlinkSync(path);
        renameSync(temporaryManifest, manifestPath);
      } catch (error) {
        try {
          unlinkSync(temporaryManifest);
        } catch (cleanupError) {
          if (cleanupError.code !== "ENOENT") {
            throw new AggregateError(
              [error, cleanupError],
              "Generated manifest publication and temporary cleanup failed",
              { cause: cleanupError },
            );
          }
        }
        throw error;
      }
    },
  };
}
