import { execFileSync } from "node:child_process";
import { appendFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));
const fullChecks = () => ({ full: true, documents: null });

export function isDocumentation(path) {
  return path !== "AGENTS.md" && /^(?:[^/]+|docs\/.+)\.md$/u.test(path);
}

function git(root, args) {
  return execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 16 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

export function selectChecks({ root = repositoryRoot, base, head }) {
  try {
    for (const revision of [base, head]) {
      if (!/^[a-f0-9]{40}$/u.test(revision ?? "")) {
        throw new Error("Expected complete commit SHA");
      }
      git(root, ["rev-parse", "--verify", `${revision}^{commit}`]);
    }
    const diff = [
      "diff",
      "--name-only",
      "-z",
      "--no-ext-diff",
      "--no-textconv",
      "--no-renames",
    ];
    const changed = git(root, [...diff, base, head, "--"])
      .split("\0")
      .filter(Boolean);
    if (!changed.every(isDocumentation)) return fullChecks();
    const documents = git(root, [
      ...diff,
      "--diff-filter=ACMT",
      base,
      head,
      "--",
    ])
      .split("\0")
      .filter(Boolean);
    return { full: false, documents };
  } catch {
    // A shallow checkout, new branch, bad event or failed Git command must
    // never turn a missing comparison into permission to skip checks.
    return fullChecks();
  }
}

export function selectFromEnvironment({
  root = repositoryRoot,
  env = process.env,
} = {}) {
  try {
    if (!["pull_request", "push"].includes(env.GITHUB_EVENT_NAME))
      return fullChecks();
    if (git(root, ["rev-parse", "HEAD"]).trim() !== env.GITHUB_SHA)
      return fullChecks();
    const event = JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, "utf8"));
    return selectChecks({
      root,
      base:
        env.GITHUB_EVENT_NAME === "pull_request"
          ? event.pull_request?.base?.sha
          : event.before,
      head: env.GITHUB_SHA,
    });
  } catch {
    return fullChecks();
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const selected = selectFromEnvironment();
  if (!process.env.GITHUB_OUTPUT) throw new Error("GITHUB_OUTPUT is required");
  appendFileSync(process.env.GITHUB_OUTPUT, `full=${selected.full}\n`);
  process.stdout.write(
    selected.full ? "Full checks selected.\n" : "Only documentation changed.\n",
  );
}
