/** Native GitHub Actions adapter; unavailable proof selects ordinary execution. */
import { execFileSync } from "node:child_process";
import {
  appendFileSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  CI_REPOSITORY,
  CI_WORKFLOW,
  RECEIPT_LIMIT,
  createReceipt,
  requireChecks,
  selectProof,
  verifyProof,
} from "./ciEvidence.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
function git(...arguments_) {
  return execFileSync("git", arguments_, {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
    timeout: 2000,
    maxBuffer: 1024 * 1024,
  }).trim();
}
/** Raw commit headers retain both parents even in the workflow's shallow checkout. */
export function captureSnapshot() {
  const commit = git("rev-parse", "HEAD");
  return {
    commit,
    tree: git("rev-parse", "HEAD^{tree}"),
    parents: git("cat-file", "-p", "HEAD")
      .split("\n\n", 1)[0]
      .split("\n")
      .filter((line) => /^parent [a-f0-9]{40}$/u.test(line))
      .map((line) => line.slice(7)),
    workflow: git("rev-parse", `HEAD:${CI_WORKFLOW}`),
  };
}
function captureContext(env) {
  return {
    repository: {
      id: Number(env.GITHUB_REPOSITORY_ID),
      full_name: env.GITHUB_REPOSITORY,
    },
    eventName: env.GITHUB_EVENT_NAME,
    event: JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, "utf8")),
    ref: env.GITHUB_REF,
    sha: env.GITHUB_SHA,
    runId: Number(env.GITHUB_RUN_ID),
    runAttempt: Number(env.GITHUB_RUN_ATTEMPT),
    snapshot: captureSnapshot(),
    host: {
      os: env.RUNNER_OS,
      architecture: env.RUNNER_ARCH,
      image: env.ImageOS,
      imageVersion: env.ImageVersion,
      node: process.version,
    },
  };
}
function readGithub(path) {
  // Paths are constructed by the evidence module, never taken from response URLs.
  return JSON.parse(
    execFileSync(
      "gh",
      ["api", "--hostname", "github.com", `repos/${CI_REPOSITORY}${path}`],
      {
        encoding: "utf8",
        windowsHide: true,
        timeout: 8000,
        maxBuffer: 2 * 1024 * 1024,
        stdio: ["ignore", "pipe", "pipe"],
      },
    ),
  );
}
function emit(env, outputs, summary) {
  for (const [name, value] of Object.entries(outputs)) {
    if (!/^[a-z_]+$/u.test(name) || /[\r\n]/u.test(value))
      throw new Error("Invalid workflow output");
    appendFileSync(env.GITHUB_OUTPUT, `${name}=${value}\n`);
  }
  if (env.GITHUB_STEP_SUMMARY)
    appendFileSync(env.GITHUB_STEP_SUMMARY, `${summary}\n`);
  process.stdout.write(`${summary}\n`);
}
/** Download actions verify the archive digest; this enforces its closed local payload. */
export function readDownloadedReceipt(directory) {
  if (
    lstatSync(directory).isSymbolicLink() ||
    !lstatSync(directory).isDirectory()
  )
    throw new Error("Invalid download directory");
  // Pinned download-artifact v8 extracts a single selected artifact at this root.
  const files = readdirSync(directory);
  if (files.length !== 1 || files[0] !== "verification.json")
    throw new Error("Unexpected receipt payload");
  const path = join(directory, "verification.json");
  const info = lstatSync(path);
  if (
    !info.isFile() ||
    info.isSymbolicLink() ||
    info.size <= 0 ||
    info.size > RECEIPT_LIMIT
  )
    throw new Error("Invalid receipt file");
  return JSON.parse(readFileSync(path, "utf8"));
}

/** Run one Actions operation; capture/read adapters bind external Git and GitHub inputs. */
export async function runCommand(
  mode,
  env = process.env,
  { capture = captureContext, read = readGithub } = {},
) {
  if (!["select", "verify", "gate", "record"].includes(mode))
    throw new Error("Expected select, verify, gate or record");
  if (mode === "gate") {
    const result = requireChecks(JSON.parse(env.CI_JOB_RESULTS));
    process.stdout.write(
      result.reused
        ? "Required checks accepted verified PR evidence.\n"
        : "Required checks executed successfully.\n",
    );
    return;
  }
  try {
    if (mode === "select" && env.GITHUB_EVENT_NAME !== "push") {
      emit(env, { available: "false" }, "This event requires fresh checks.");
      return;
    }
    const directory = join(env.RUNNER_TEMP, "webvowl-ci");
    mkdirSync(directory, { recursive: true });
    const selectionPath = join(directory, "selection.json");
    if (mode === "verify" && env.PROOF_DOWNLOAD_OUTCOME !== "success")
      throw new Error("No downloaded proof");
    const context = capture(env);
    if (mode === "record") {
      const receipt = createReceipt({
        context,
        needs: JSON.parse(env.CI_JOB_RESULTS),
      });
      const path = join(directory, "verification.json");
      writeFileSync(path, `${JSON.stringify(receipt)}\n`);
      emit(
        env,
        { recorded: "true", path },
        "Recorded executed PR check evidence.",
      );
    } else if (mode === "select") {
      const selection = await selectProof({ context, read });
      writeFileSync(selectionPath, JSON.stringify(selection));
      emit(
        env,
        {
          available: "true",
          run_id: String(selection.run.id),
          artifact_id: String(selection.artifact.id),
        },
        "A PR receipt is available; equivalence still requires verification.",
      );
    } else {
      if (!["true", "false"].includes(env.CI_FULL_CHECKS))
        throw new Error("Invalid current scope");
      const selection = JSON.parse(readFileSync(selectionPath, "utf8"));
      const receipt = readDownloadedReceipt(join(directory, "download"));
      const outputs = await verifyProof({
        context,
        selection,
        receipt,
        read,
        full: env.CI_FULL_CHECKS === "true",
      });
      emit(
        env,
        outputs,
        `REUSED: [original PR run ${outputs.source_run_id}, attempt ${outputs.source_run_attempt}](https://github.com/${CI_REPOSITORY}/actions/runs/${outputs.source_run_id}/attempts/${outputs.source_run_attempt}). Receipt ${outputs.source_receipt_id}, ${outputs.source_receipt_digest}. Tests were not executed again.`,
      );
    }
  } catch {
    // Do not stream API/process errors: they may contain workflow commands or credentials.
    emit(
      env,
      mode === "record"
        ? { recorded: "false" }
        : mode === "select"
          ? { available: "false" }
          : { reuse: "false" },
      mode === "record"
        ? "No reusable receipt retained; existing check results are unchanged."
        : "Equivalent PR evidence is unavailable; ordinary checks will execute.",
    );
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  await runCommand(process.argv[2]);
}
