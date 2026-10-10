import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export function installSelectedNpm({
  repositoryRoot = fileURLToPath(new URL("../", import.meta.url)),
  platform = process.platform,
  run = spawnSync,
} = {}) {
  const { packageManager } = JSON.parse(
    readFileSync(resolve(repositoryRoot, "package.json"), "utf8"),
  );
  // Only an exact npm coordinate can reach the Windows command shell.
  if (
    typeof packageManager !== "string" ||
    !/^npm@\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$/u.test(packageManager)
  ) {
    throw new Error(
      "package.json.packageManager must select an exact npm version.",
    );
  }
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
