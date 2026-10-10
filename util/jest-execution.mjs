// SPDX-License-Identifier: AGPL-3.0-only
import { spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import {
  limits,
  repositoryRoot,
  safePath,
  sha256,
} from "./dependency-graph.mjs";

const supervisor = fileURLToPath(new URL("./jest-process.py", import.meta.url));
export function selectedPython() {
  const python = join(
    repositoryRoot,
    ".venv",
    ...(process.platform === "win32"
      ? ["Scripts", "python.exe"]
      : ["bin", "python"]),
  );
  if (!existsSync(python))
    throw new Error(
      "Selected repository Python is required for native Jest containment; run the authorized development setup",
    );
  return python;
}

/** No shell, forwarded user flags, alternate runner or custom reporter is admitted. */
export async function runJest(
  root,
  admission,
  paths,
  destination,
  { timeoutMs = limits.testMs, byteLimit = limits.resultBytes, signal } = {},
) {
  if (
    !paths.length ||
    paths.length > limits.sources ||
    new Set(paths).size !== paths.length
  )
    throw new Error("Invalid whole-file execution inventory");
  const files = paths.map((path) => resolve(root, safePath(path)));
  const argv = [
    process.execPath,
    ...admission.flags,
    admission.bin,
    "--config",
    JSON.stringify(admission.config),
    "--runTestsByPath",
    ...files,
    "--json",
    "--outputFile",
    join(destination, "jest.json"),
  ];
  const cancelPath = `${destination}.cancel`;
  const request = { argv, root, destination, timeoutMs, byteLimit, cancelPath };
  const child = spawn(selectedPython(), ["-I", "-B", supervisor], {
    cwd: root,
    windowsHide: true,
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env, NODE_OPTIONS: "", NODE_PATH: "", PYTHONPATH: "" },
  });
  let stdout = "",
    stderr = "",
    overflow = false;
  const cancel = () => {
    if (!existsSync(cancelPath))
      writeFileSync(cancelPath, "cancel\n", { flag: "wx" });
  };
  const interrupt = () => cancel();
  process.on("SIGINT", interrupt);
  process.on("SIGTERM", interrupt);
  signal?.addEventListener("abort", cancel, { once: true });
  if (signal?.aborted) cancel();
  const watchdog = setTimeout(cancel, timeoutMs);
  const outerDeadline = setTimeout(
    () => child.kill(),
    timeoutMs + limits.cleanupMs + 5000,
  );
  child.stdout.on("data", (chunk) => {
    if (stdout.length + chunk.length > 1024 * 1024) {
      overflow = true;
      cancel();
    } else stdout += chunk;
  });
  child.stderr.on("data", (chunk) => {
    if (stderr.length + chunk.length > 1024 * 1024) {
      overflow = true;
      cancel();
    } else stderr += chunk;
  });
  child.stdin.end(JSON.stringify(request));
  let status;
  try {
    status = await new Promise((resolveStatus, reject) => {
      child.once("error", reject);
      child.once("close", (code, signalName) =>
        resolveStatus({ code, signal: signalName }),
      );
    });
  } finally {
    clearTimeout(watchdog);
    clearTimeout(outerDeadline);
    process.off("SIGINT", interrupt);
    process.off("SIGTERM", interrupt);
    signal?.removeEventListener("abort", cancel);
  }
  let processFacts;
  try {
    processFacts = JSON.parse(stdout);
  } catch {
    processFacts = {
      quiescent: false,
      reason: "malformed-native-process-result",
    };
  }
  const resultPath = join(destination, "jest.json");
  let native = null,
    outcomes = null,
    invalid = null;
  try {
    if (
      overflow ||
      status.code !== 0 ||
      !processFacts.quiescent ||
      processFacts.reason
    )
      throw new Error(processFacts.reason ?? "incomplete-process-capture");
    if (statSync(resultPath).size + processFacts.capturedBytes > byteLimit)
      throw new Error("Result capture budget exceeded");
    native = JSON.parse(readFileSync(resultPath, "utf8"));
    outcomes = normalizeOutcomes(root, paths, native);
  } catch (error) {
    invalid = error.message;
  }
  const result = {
    success:
      !invalid &&
      processFacts.exitCode === 0 &&
      native?.success === true &&
      native.numFailedTests === 0 &&
      native.numFailedTestSuites === 0,
    exitCode: processFacts.exitCode ?? null,
    processFacts,
    helperStatus: status,
    helperStderr: stderr,
    incomplete: invalid,
    paths,
    outcomes,
    nativeResultPath: resultPath,
    nativeResultDigest:
      existsSync(resultPath) && statSync(resultPath).size <= byteLimit
        ? sha256(readFileSync(resultPath))
        : null,
  };
  writeFileSync(
    join(destination, "execution.json"),
    JSON.stringify(result, null, 2) + "\n",
    { flag: "wx" },
  );
  return result;
}

export function normalizeOutcomes(root, expected, result) {
  if (
    !Array.isArray(result.testResults) ||
    result.testResults.length !== expected.length
  )
    throw new Error("Missing or extra native suite results");
  const suites = {};
  for (const suite of result.testResults) {
    const path = safePath(relative(root, suite.name).replaceAll("\\", "/"));
    if (
      !expected.includes(path) ||
      Object.hasOwn(suites, path) ||
      !Array.isArray(suite.assertionResults) ||
      !["passed", "failed", "skipped", "focused"].includes(suite.status)
    )
      throw new Error(
        `Invalid or duplicate native suite identity:${path}:${suite.status}`,
      );
    // Preserve ordered multiplicity: equal titles are never collapsed into a map.
    suites[path] = {
      status: suite.status,
      message: suite.message ?? "",
      assertions: suite.assertionResults.map((assertion) => {
        if (
          typeof assertion.fullName !== "string" ||
          ![
            "passed",
            "failed",
            "skipped",
            "pending",
            "todo",
            "disabled",
            "focused",
          ].includes(assertion.status) ||
          !Array.isArray(assertion.failureMessages)
        )
          throw new Error("Malformed assertion outcome");
        return {
          title: assertion.fullName,
          ancestors: assertion.ancestorTitles,
          location: assertion.location ?? null,
          status: assertion.status,
          failures: assertion.failureMessages,
        };
      }),
    };
  }
  return suites;
}

export function compareOutcomes(selected, full) {
  if (
    !selected.outcomes ||
    !full.outcomes ||
    !selected.success ||
    !full.success
  )
    return { equal: false, reason: "failed-or-incomplete-run" };
  const differences = Object.entries(selected.outcomes)
    .filter(
      ([path, suite]) =>
        JSON.stringify(suite) !== JSON.stringify(full.outcomes[path]),
    )
    .map(([path]) => path);
  return { equal: differences.length === 0, differences };
}
