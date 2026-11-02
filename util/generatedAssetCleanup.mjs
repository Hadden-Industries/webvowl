import { createHash, randomUUID } from "node:crypto";
import {
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmdirSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve, win32 } from "node:path";

export const GENERATED_ASSET_MANIFEST = ".vite/webvowl-generated-assets.json";
const legacyManifestName = ".vite/webvowl-generated-js.json";
const legacyJavaScript = /^(?:js|assets)\/[A-Za-z0-9._~-]+\.js$/u;
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const validHash = (value) =>
  typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);

function outputPath(name) {
  if (
    typeof name !== "string" ||
    !name ||
    win32.isAbsolute(name) ||
    /[\\:]/u.test(name) ||
    [...name].some(
      (character) =>
        character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
    ) ||
    name
      .split("/")
      .some(
        (part) => !part || part === "." || part === ".." || /[. ]$/u.test(part),
      )
  )
    throw new Error(`Unsafe generated asset path: ${JSON.stringify(name)}`);
  return name;
}

function info(path) {
  try {
    return lstatSync(path);
  } catch (error) {
    if (error.code === "ENOENT") return undefined;
    throw error;
  }
}

/** Inspect every component, including dangling links; never follow redirected output. */
function inspect(outputDirectory, name, kind = "file") {
  outputPath(name);
  let path = outputDirectory;
  let current = info(path);
  if (!current) return undefined;
  if (current.isSymbolicLink() || !current.isDirectory())
    throw new Error("Generated asset output is not a regular directory");
  const parts = name.split("/");
  for (let index = 0; index < parts.length; index++) {
    path = join(path, parts[index]);
    current = info(path);
    if (!current) return undefined;
    if (current.isSymbolicLink())
      throw new Error(`Redirected generated asset path: ${name}`);
    if (index < parts.length - 1 || kind === "directory") {
      if (!current.isDirectory())
        throw new Error(`Generated asset parent is not a directory: ${name}`);
    } else if (!current.isFile()) {
      throw new Error(`Generated asset is not a regular file: ${name}`);
    }
  }
  return path;
}

function parents(name) {
  const parts = name.split("/");
  return parts
    .slice(0, -1)
    .map((_part, index) => parts.slice(0, index + 1).join("/"));
}

function control(outputDirectory, name) {
  const path = inspect(outputDirectory, name);
  return path ? readFileSync(path) : undefined;
}

// Probe existing entries read-only: filesystem case rules need not match the OS.
function pathIdentity(outputDirectory) {
  let directory = outputDirectory;
  for (;;) {
    const current = info(directory);
    if (current?.isDirectory() && !current.isSymbolicLink()) {
      for (const name of readdirSync(directory)) {
        const alternative = name.replace(/[a-z]/iu, (letter) =>
          letter === letter.toUpperCase()
            ? letter.toLowerCase()
            : letter.toUpperCase(),
        );
        if (alternative === name) continue;
        const original = info(join(directory, name));
        const alternate = info(join(directory, alternative));
        if (!original || original.isSymbolicLink()) continue;
        const insensitive =
          alternate?.dev === original.dev && alternate?.ino === original.ino;
        return insensitive ? (name) => name.toLowerCase() : (name) => name;
      }
    }
    const parent = dirname(directory);
    if (parent === directory) return (name) => name;
    directory = parent;
  }
}

function parseManifest(bytes, identity) {
  const manifest = JSON.parse(bytes);
  if (
    manifest?.schemaVersion !== 2 ||
    !Array.isArray(manifest.files) ||
    !Array.isArray(manifest.directories) ||
    !manifest.hashes ||
    typeof manifest.hashes !== "object" ||
    Array.isArray(manifest.hashes)
  )
    throw new Error("Invalid generated asset manifest");
  for (const name of [...manifest.files, ...manifest.directories])
    outputPath(name);
  if (
    new Set([...manifest.files, ...manifest.directories].map(identity)).size !==
      manifest.files.length + manifest.directories.length ||
    manifest.files.some(
      (name) =>
        !Object.hasOwn(manifest.hashes, name) ||
        !validHash(manifest.hashes[name]),
    ) ||
    Object.keys(manifest.hashes).length !== manifest.files.length
  )
    throw new Error("Invalid generated asset ownership entries");
  return manifest;
}

/** The current manifest is authoritative for every generated type, not just JavaScript. */
export function verifyGeneratedAssetManifest(outputDirectory) {
  const bytes = control(outputDirectory, GENERATED_ASSET_MANIFEST);
  if (!bytes) throw new Error("Missing generated asset ownership");
  const manifest = parseManifest(bytes, pathIdentity(outputDirectory));
  for (const name of manifest.files) {
    const path = inspect(outputDirectory, name);
    if (!path || sha256(readFileSync(path)) !== manifest.hashes[name])
      throw new Error(`Generated asset ownership mismatch: ${name}`);
  }
  return manifest;
}

/**
 * Own only bundler emissions and explicitly recorded copy writes. Prune unchanged
 * obsolete files after writers succeed; never discover ownership by scanning output.
 */
export function createGeneratedAssetCleanupPlugin({
  manifestName = GENERATED_ASSET_MANIFEST,
} = {}) {
  outputPath(manifestName);
  let outputDirectory;
  let enabled = false;
  let active = false;
  let wroteBundle = false;
  let previous;
  let previousBytes;
  let legacyBytes;
  let identity;
  const previousHashes = new Map();
  const emitted = new Map();
  const emittedIdentities = new Set();
  const createdDirectories = new Set();

  function reserved(name) {
    const candidate = name.toLowerCase();
    return [manifestName, legacyManifestName].some(
      (metadata) =>
        candidate === metadata.toLowerCase() ||
        candidate.startsWith(metadata.toLowerCase() + "."),
    );
  }

  function record(name, bytes) {
    outputPath(name);
    if (reserved(name))
      throw new Error(
        `Generated asset collides with ownership metadata: ${name}`,
      );
    const expected = sha256(bytes);
    const candidate = identity(name);
    for (const [other, value] of emitted) {
      const otherIdentity = identity(other);
      if (
        candidate.startsWith(otherIdentity + "/") ||
        otherIdentity.startsWith(candidate + "/")
      )
        throw new Error(`Generated file/directory collision: ${name}`);
      if (other !== name && otherIdentity === candidate)
        throw new Error(`Generated asset path collision: ${name}`);
      if (other === name && value !== expected)
        throw new Error(`Generated asset writers disagree: ${name}`);
    }
    for (const parent of parents(name)) {
      if (!inspect(outputDirectory, parent, "directory"))
        createdDirectories.add(parent);
    }
    const existing = inspect(outputDirectory, name);
    if (existing) {
      const actual = sha256(readFileSync(existing));
      if (actual !== expected && actual !== previousHashes.get(candidate))
        throw new Error(
          `Refusing to overwrite unrelated or modified output: ${name}`,
        );
    }
    emitted.set(name, expected);
    emittedIdentities.add(candidate);
  }

  return {
    name: "webvowl-generated-asset-cleanup",
    apply: "build",
    api: {
      /** Call from the copy producer's buffer transform, before its write. */
      recordCopiedAsset(name, bytes) {
        if (active && enabled) record(name, bytes);
        return bytes;
      },
    },
    configResolved(configuration) {
      outputDirectory = resolve(
        configuration.root ?? process.cwd(),
        configuration.build.outDir,
      );
      enabled = configuration.build.write !== false;
    },
    buildStart() {
      active = true;
      wroteBundle = false;
      emitted.clear();
      emittedIdentities.clear();
      previousHashes.clear();
      createdDirectories.clear();
      previous = { schemaVersion: 2, files: [], hashes: {}, directories: [] };
      previousBytes = undefined;
      legacyBytes = undefined;
      if (!enabled) return;
      identity = pathIdentity(outputDirectory);
      previousBytes = control(outputDirectory, manifestName);
      if (previousBytes) {
        previous = parseManifest(previousBytes, identity);
      } else if (manifestName !== legacyManifestName) {
        legacyBytes = control(outputDirectory, legacyManifestName);
        if (!legacyBytes) return;
        const legacy = JSON.parse(legacyBytes);
        if (legacy?.schemaVersion !== 1 || !Array.isArray(legacy.files))
          throw new Error("Invalid legacy generated JavaScript manifest");
        // Only hash-proven, formerly supported JavaScript paths gain ownership.
        for (const name of legacy.files) {
          if (
            typeof name === "string" &&
            legacyJavaScript.test(name) &&
            validHash(legacy.hashes?.[name])
          ) {
            previous.files.push(name);
            previous.hashes[name] = legacy.hashes[name];
          }
        }
      }
      for (const name of previous.files)
        previousHashes.set(identity(name), previous.hashes[name]);
    },
    generateBundle: {
      order: "post",
      sequential: true,
      handler(_options, bundle, isWrite) {
        if (!enabled || !isWrite) return;
        for (const output of Object.values(bundle)) {
          const name = output.fileName;
          record(name, output.type === "chunk" ? output.code : output.source);
        }
      },
    },
    writeBundle: {
      order: "post",
      sequential: true,
      handler() {
        wroteBundle = enabled;
      },
    },
    renderError() {
      wroteBundle = false;
    },
    closeBundle: {
      order: "post",
      sequential: true,
      handler() {
        active = false;
        if (!outputDirectory || !wroteBundle) return;
        const current = control(outputDirectory, manifestName);
        if (
          (current === undefined) !== (previousBytes === undefined) ||
          (current && !current.equals(previousBytes))
        )
          throw new Error("Generated asset ownership changed during the build");
        const hashes = {};
        for (const name of [...emitted.keys()].sort()) {
          const expected = emitted.get(name);
          const path = inspect(outputDirectory, name);
          if (!path || sha256(readFileSync(path)) !== expected)
            throw new Error(`Missing or changed generated asset: ${name}`);
          Object.defineProperty(hashes, name, {
            value: expected,
            enumerable: true,
          });
        }
        const neededDirectories = new Map(
          [...emitted.keys()]
            .flatMap(parents)
            .map((name) => [identity(name), name]),
        );
        const ownedDirectories = new Map(
          [...previous.directories, ...createdDirectories].map((name) => [
            identity(name),
            name,
          ]),
        );
        const directories = [...neededDirectories]
          .filter(([key]) => ownedDirectories.has(key))
          .map(([, name]) => name)
          .sort();
        const manifest = {
          schemaVersion: 2,
          files: [...emitted.keys()].sort(),
          hashes,
          directories,
        };
        const temporaryName = `${manifestName}.${randomUUID()}.tmp`;
        for (const parent of parents(manifestName)) {
          if (!inspect(outputDirectory, parent, "directory"))
            mkdirSync(join(outputDirectory, parent));
        }
        const temporaryPath = join(outputDirectory, temporaryName);
        writeFileSync(temporaryPath, JSON.stringify(manifest, null, 2) + "\n", {
          encoding: "utf8",
          flag: "wx",
        });
        const warn = (message) => this.warn?.(message);
        try {
          for (const name of previous.files) {
            if (emittedIdentities.has(identity(name))) continue;
            let path;
            try {
              path = inspect(outputDirectory, name);
            } catch {
              warn(`Preserved redirected generated asset: ${name}`);
              continue;
            }
            if (!path) continue;
            if (sha256(readFileSync(path)) !== previous.hashes[name]) {
              warn(`Preserved modified generated asset: ${name}`);
              continue;
            }
            // Recheck all components at the destructive boundary.
            unlinkSync(inspect(outputDirectory, name));
          }
          for (const name of [...ownedDirectories]
            .filter(([key]) => !neededDirectories.has(key))
            .map(([, name]) => name)
            .sort((a, b) => b.split("/").length - a.split("/").length)) {
            let path;
            try {
              path = inspect(outputDirectory, name, "directory");
            } catch {
              warn(`Preserved redirected generated directory: ${name}`);
              continue;
            }
            if (!path) continue;
            try {
              rmdirSync(path);
            } catch (error) {
              if (!["ENOENT", "ENOTEMPTY", "EEXIST"].includes(error.code))
                throw error;
            }
          }
          renameSync(temporaryPath, join(outputDirectory, manifestName));
        } catch (error) {
          if (inspect(outputDirectory, temporaryName))
            unlinkSync(temporaryPath);
          throw error;
        }
        if (legacyBytes) {
          try {
            const legacy = control(outputDirectory, legacyManifestName);
            if (legacy?.equals(legacyBytes))
              unlinkSync(join(outputDirectory, legacyManifestName));
            else warn("Preserved changed legacy generated JavaScript manifest");
          } catch {
            warn("Preserved redirected legacy generated JavaScript manifest");
          }
        }
      },
    },
  };
}
