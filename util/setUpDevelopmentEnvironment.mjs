import { spawnSync } from "node:child_process";
import { lstatSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPOSITORY_ROOT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
);

/** Install the locked toolchains after native npm devEngines admission via npm run. */
export function setUpDevelopmentEnvironment({
  repositoryRoot = REPOSITORY_ROOT_PATH,
} = {}) {
  // npm supplies its CLI path, allowing invocation without a platform shell.
  const npmCliPath = process.env.npm_execpath;
  if (!npmCliPath) {
    throw new Error(
      "Run npm run setup:development to start development setup.",
    );
  }

  for (const filename of [
    "package.json",
    "package-lock.json",
    "requirements-dev.txt",
    "requirements.lock.txt",
    ".node-version",
    ".python-version",
  ]) {
    const filePath = join(repositoryRoot, filename);
    if (!statSync(filePath, { throwIfNoEntry: false })?.isFile()) {
      throw new Error(
        `Required development setup file is missing: ${filePath}`,
      );
    }
  }

  const selectedNodeVersion = readFileSync(
    join(repositoryRoot, ".node-version"),
    "utf8",
  ).trim();
  if (process.versions.node !== selectedNodeVersion) {
    throw new Error(
      `Development setup requires Node.js ${selectedNodeVersion}; found ${process.versions.node}.`,
    );
  }
  const selectedPythonVersion = readFileSync(
    join(repositoryRoot, ".python-version"),
    "utf8",
  ).trim();

  function runRequiredCommand(
    description,
    executable,
    commandArguments,
    { captureOutput = false } = {},
  ) {
    const result = spawnSync(executable, commandArguments, {
      cwd: repositoryRoot,
      stdio: captureOutput ? ["ignore", "pipe", "pipe"] : "inherit",
      encoding: "utf8",
      windowsHide: true,
    });
    if (result.error) {
      throw new Error(
        `${description} could not start: ${result.error.message}`,
        {
          cause: result.error,
        },
      );
    }
    if (result.signal) {
      throw new Error(`${description} was terminated by ${result.signal}.`);
    }
    if (result.status !== 0) {
      const diagnostic = result.stderr?.trim();
      throw new Error(
        `${description} failed with exit code ${result.status}.${diagnostic ? `\n${diagnostic}` : ""}`,
      );
    }
    return result.stdout?.trim() ?? "";
  }

  // npm run enforces devEngines; packageManager names the reproducible reference,
  // so requiring exact equality here would reject eligible newer npm versions.

  const pythonVirtualEnvironmentPath = join(repositoryRoot, ".venv");
  const virtualEnvironmentPythonExecutablePath = join(
    pythonVirtualEnvironmentPath,
    ...(process.platform === "win32"
      ? ["Scripts", "python.exe"]
      : ["bin", "python"]),
  );
  const pythonVirtualEnvironmentStats = lstatSync(
    pythonVirtualEnvironmentPath,
    {
      throwIfNoEntry: false,
    },
  );
  if (
    pythonVirtualEnvironmentStats &&
    (!pythonVirtualEnvironmentStats.isDirectory() ||
      !statSync(virtualEnvironmentPythonExecutablePath, {
        throwIfNoEntry: false,
      })?.isFile())
  ) {
    throw new Error(
      `The existing .venv is unusable: ${pythonVirtualEnvironmentPath}. Repair it before rerunning setup; it has been preserved.`,
    );
  }

  const systemPythonExecutableName =
    process.platform === "win32" ? "python" : "python3";
  const pythonExecutable = pythonVirtualEnvironmentStats
    ? virtualEnvironmentPythonExecutablePath
    : systemPythonExecutableName;
  const pythonVersionOutput = runRequiredCommand(
    `Python version check (${pythonExecutable})`,
    pythonExecutable,
    ["--version"],
    { captureOutput: true },
  );
  const pythonVersion = /^Python (\d+)\.(\d+)\.(\d+)$/u
    .exec(pythonVersionOutput)
    ?.slice(1)
    .map(Number);
  if (!/^\d+\.\d+\.\d+$/u.test(selectedPythonVersion)) {
    throw new Error(
      ".python-version must contain a stable major.minor.patch version.",
    );
  }
  const minimumPythonVersion = selectedPythonVersion.split(".").map(Number);
  const firstDifference = pythonVersion?.findIndex(
    (part, index) => part !== minimumPythonVersion[index],
  );
  if (
    !pythonVersion ||
    (firstDifference !== -1 &&
      pythonVersion[firstDifference] < minimumPythonVersion[firstDifference])
  ) {
    throw new Error(
      `Development setup requires Python >=${selectedPythonVersion}; found ${pythonVersionOutput}.`,
    );
  }

  console.log("Installing npm dependencies from package-lock.json...");
  runRequiredCommand("npm dependency installation", process.execPath, [
    npmCliPath,
    "ci",
    "--include=dev",
    "--ignore-scripts",
  ]);

  if (!pythonVirtualEnvironmentStats) {
    console.log(
      `Creating Python virtual environment: ${pythonVirtualEnvironmentPath}`,
    );
    runRequiredCommand(
      "Python virtual environment creation",
      systemPythonExecutableName,
      ["-m", "venv", pythonVirtualEnvironmentPath],
    );
  }

  console.log("Installing Python dependencies in .venv...");
  runRequiredCommand(
    "Python development dependency installation",
    virtualEnvironmentPythonExecutablePath,
    [
      "-m",
      "pip",
      "install",
      "--require-hashes",
      "--only-binary=:all:",
      "--no-binary=PyYAML",
      "-r",
      join(repositoryRoot, "requirements.lock.txt"),
    ],
  );
  runRequiredCommand(
    "Python dependency consistency",
    virtualEnvironmentPythonExecutablePath,
    ["-m", "pip", "check"],
  );

  console.log("Development dependencies are installed.");
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    setUpDevelopmentEnvironment();
  } catch (error) {
    console.error(`Development setup failed: ${error.message}`);
    process.exitCode = 1;
  }
}
