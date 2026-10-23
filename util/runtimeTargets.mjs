/** Project the maintained runtime declarations into setup and CI selections. */
import { appendFileSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));
const versionFiles = Object.freeze({
  node: ".node-version",
  python: ".python-version",
  uv: ".uv-version",
});
const stableVersion = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/u;

export function runtimeTarget(name, root = repositoryRoot) {
  let version;
  let owner;
  if (name === "npm") {
    owner = "package.json.devEngines.packageManager";
    const manifest = JSON.parse(
      readFileSync(join(root, "package.json"), "utf8"),
    );
    const declaration = manifest.devEngines?.packageManager;
    if (
      declaration?.name !== "npm" ||
      typeof declaration.version !== "string" ||
      !declaration.version.startsWith(">=")
    ) {
      throw new Error(`${owner} must declare npm with one stable >= minimum.`);
    }
    version = declaration.version.slice(2);
  } else if (Object.hasOwn(versionFiles, name)) {
    owner = versionFiles[name];
    version = readFileSync(join(root, owner), "utf8").trim();
  } else {
    throw new Error(`Unknown runtime target: ${name}`);
  }
  if (!stableVersion.test(version)) {
    throw new Error(
      `${owner} must contain a stable major.minor.patch version.`,
    );
  }
  return version;
}

export function runtimeTargets(root = repositoryRoot) {
  return Object.fromEntries(
    ["node", "npm", "python", "uv"].map((name) => [
      name,
      runtimeTarget(name, root),
    ]),
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length && args[0] !== "--github-output")) {
    throw new Error("Usage: node util/runtimeTargets.mjs [--github-output]");
  }
  const targets = runtimeTargets();
  if (args[0] === "--github-output") {
    if (!process.env.GITHUB_OUTPUT)
      throw new Error("GITHUB_OUTPUT is required.");
    appendFileSync(
      process.env.GITHUB_OUTPUT,
      Object.entries(targets)
        .map(([name, version]) => `${name}=${version}\n`)
        .join(""),
    );
  } else {
    console.log(JSON.stringify(targets));
  }
}
