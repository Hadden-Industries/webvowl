// SPDX-License-Identifier: AGPL-3.0-only
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const file = fileURLToPath(import.meta.url);
const root = resolve(dirname(file), "..");
export const graphPackages = Object.freeze([
  "dependency-cruiser",
  "eslint",
  "html-validate",
  "ignore",
  "jest",
  "vite",
  "vite-plugin-static-copy",
  "yaml",
]);

async function metadata(url) {
  const response = await fetch(url, {
    redirect: "error",
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok || !response.body)
    throw new Error("Registry HTTP " + response.status);
  const chunks = [];
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.byteLength;
    if (size > 4 * 1024 * 1024)
      throw new Error("Version metadata exceeds its read budget");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks));
}

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));

async function installedVersion(path) {
  try {
    return (await readJson(path)).version ?? null;
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

function stablePackage(name, value) {
  if (
    value.name !== name ||
    !/^\d+\.\d+\.\d+$/u.test(value.version) ||
    typeof value.dist?.integrity !== "string" ||
    value.deprecated
  )
    throw new Error("The registry did not return an identified stable release");
  return {
    version: value.version,
    integrity: value.dist.integrity,
    engines: value.engines,
    license: value.license,
    dependencies: value.dependencies,
  };
}

/** Discover public stable identities and local drift before approving an npm lock refresh. */
export async function inspectGraphToolchain() {
  const [manifest, lock, nodePin] = await Promise.all([
    readJson(join(root, "package.json")),
    readJson(join(root, "package-lock.json")),
    readFile(join(root, ".node-version"), "utf8"),
  ]);
  const result = await Promise.all(
    graphPackages.map(async (name) => {
      const locked = lock.packages["node_modules/" + name]?.version ?? null;
      const installed = await installedVersion(
        join(root, "node_modules", name, "package.json"),
      );
      const identity = {
        name,
        declared: manifest.devDependencies[name] ?? null,
        locked,
        installed,
        installDrift: installed !== locked,
      };
      try {
        const stable = stablePackage(
          name,
          await metadata("https://registry.npmjs.org/" + name + "/latest"),
        );
        return { ...identity, stable, lockDiffers: stable.version !== locked };
      } catch (error) {
        return { ...identity, stable: null, error: error.message };
      }
    }),
  );
  const node = {
    pinned: nodePin.trim(),
    installed: process.versions.node,
    latestLts: null,
  };
  node.installDrift = node.pinned !== node.installed;
  try {
    const releases = await metadata("https://nodejs.org/dist/index.json");
    const release = releases.find(
      (item) =>
        typeof item.lts === "string" && /^v\d+\.\d+\.\d+$/u.test(item.version),
    );
    if (!release)
      throw new Error("Node did not publish an identified LTS release");
    node.latestLts = release.version.slice(1);
  } catch (error) {
    node.error = error.message;
  }
  return { schemaVersion: 1, packages: result, node };
}

if (process.argv[1] && resolve(process.argv[1]) === file) {
  try {
    if (process.argv.length !== 2)
      throw new Error("Usage: node util/graph-toolchain-versions.mjs");
    const result = await inspectGraphToolchain();
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
    if (!result.node.latestLts || result.packages.some((item) => !item.stable))
      process.exitCode = 1;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 2;
  }
}
