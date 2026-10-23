import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { runtimeTarget } from "./runtimeTargets.mjs";

export function installSelectedNpm({
  repositoryRoot = fileURLToPath(new URL("../", import.meta.url)),
  platform = process.platform,
  run = spawnSync,
} = {}) {
  // The validated native minimum supplies the exact reproducible CI reference.
  const packageManager = `npm@${runtimeTarget("npm", repositoryRoot)}`;
  const result = run(
    platform === "win32" ? "npm.cmd" : "npm",
    ["install", "--global", "--no-audit", "--no-fund", packageManager],
    {
      cwd: repositoryRoot,
      stdio: "inherit",
      shell: platform === "win32",
      windowsHide: true,
    },
  );
  if (result.error) throw result.error;
  if (result.signal)
    throw new Error(`npm installation was terminated by ${result.signal}.`);
  return result.status ?? 1;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    process.exitCode = installSelectedNpm();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
