import { spawnSync } from "node:child_process";
import { appendFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPOSITORY_ROOT = fileURLToPath(new URL("../", import.meta.url));
// Native Git pathspecs are shared by local verification and both CI gates.
// Exclusions apply to evidence, never to executable controls or test inputs.
const SHARED_INPUTS = [
  "package.json", "package-lock.json", ".node-version", ".npmrc",
  "util/selectPullRequestChecks.mjs", "util/runAffectedChecks.mjs",
  "tests/pr-check-scopes.test.mjs", "tests/affected-checks.test.mjs",
];
export const CHECK_INPUTS = {
  sdlc: [
    ...SHARED_INPUTS,
    ".sdlc", ".codex", "AGENTS.md", "REVIEW.md", "docs/sdlc",
    ":(exclude).sdlc/runtime", ":(exclude).sdlc/tmp",
    ":(exclude)docs/sdlc/baselines", ":(exclude)docs/sdlc/verification.md",
    ".python-version", "requirements-sdlc.txt", "skills-lock.json",
    ".gitignore", ".github",
    "util/_commands.py", "util/_repository.py", "util/_configuration_transaction.py", "util/_sdlc_state.py",
    "util/bootstrap_github_sdlc.py", "util/probe_dcg_hook_protocol.py",
    "util/runRepositoryPython.mjs", "util/sdlc.py", "util/sdlc_stop_gate.py",
    "util/validate_sdlc_pr.py", "util/set_up_sdlc.py", "util/set_up_agent_skills.py",
    "util/setUpDevelopmentEnvironment.mjs", "tests/sdlc",
    "tests/set-up-development-environment.test.mjs", "tests/run-repository-python.test.mjs",
    "tests/sdlc-issue-acceptance.test.mjs", "util/test_set_up_agent_skills.py",
    "util/test_sdlc_skill_activation.py", "util/test_configuration_transaction.py",
  ],
  application: [
    ...SHARED_INPUTS,
    "src", "vite.config.mjs", "eslint.config.js", ".prettierrc", ".prettierignore",
    ".stylelintrc.json", ".htmlvalidate.json", ".editorconfig", ".browserslistrc",
    ".github/workflows/webvowl-ci.yml",
    "util/zip.mjs", "util/zip.test.js", "util/upload_to_s3.py",
    "util/benchmarkEnvironment.mjs", "util/benchmarkEnvironment.test.js",
    "util/vowlBenchmarkFixtures.mjs", "util/vowlBenchmarkFixtures.test.js",
    "util/benchmark-vowl-builder.mjs", "util/rdf-dataset-isomorphism.mjs",
    "util/verify-webvowl-lazy-parser-chunks.mjs", "util/generate-owl2vowl-java-test-fixtures.py",
  ],
};
function git(root, args) {
  const result = spawnSync("git", args, {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.error) throw result.error;
  if (result.signal || result.status === null) {
    throw new Error("Git did not complete.");
  }
  return result;
}

function requireCommit(root, sha) {
  if (typeof sha !== "string" || !/^[0-9a-f]{40}$/iu.test(sha)) {
    throw new Error("Expected a complete GitHub commit SHA.");
  }
  const result = git(root, ["rev-parse", "--verify", sha + "^{commit}"]);
  if (result.status !== 0) {
    throw new Error("Required comparison commit is unavailable: " + sha);
  }
}

export function selectPullRequestChecks({
  root = REPOSITORY_ROOT,
  base,
  head,
  scopes = Object.keys(CHECK_INPUTS),
}) {
  requireCommit(root, base);
  requireCommit(root, head);
  const selected = {};
  for (const name of scopes) {
    const paths = CHECK_INPUTS[name];
    if (!paths) throw new Error("Unknown check scope: " + name);
    const result = git(root, [
      "diff",
      "--quiet",
      "--no-ext-diff",
      "--no-textconv",
      "--no-renames",
      base,
      head,
      "--",
      ...paths,
    ]);
    if (result.status !== 0 && result.status !== 1) {
      throw new Error(
        "Cannot determine " + name + " applicability: " + result.stderr.trim(),
      );
    }
    selected[name] = result.status === 1;
  }
  return selected;
}

export function selectWorkingTreeChecks({ root = REPOSITORY_ROOT, base }) {
  requireCommit(root, base);
  const selected = {};
  for (const [name, paths] of Object.entries(CHECK_INPUTS)) {
    const tracked = git(root, ["diff", "--quiet", "--no-ext-diff", "--no-textconv", "--no-renames", base, "--", ...paths]);
    if (tracked.status !== 0 && tracked.status !== 1) {
      throw new Error("Cannot determine " + name + " applicability: " + tracked.stderr.trim());
    }
    const untracked = git(root, ["ls-files", "--others", "--exclude-standard", "-z", "--", ...paths]);
    if (untracked.status !== 0) throw new Error("Cannot enumerate untracked inputs: " + untracked.stderr.trim());
    selected[name] = tracked.status === 1 || untracked.stdout.length > 0;
  }
  return selected;
}

export function runFromGitHubEnvironment(
  env = process.env,
  scopes = Object.keys(CHECK_INPUTS),
) {
  if (
    !scopes.length ||
    scopes.some((name) => !Object.hasOwn(CHECK_INPUTS, name))
  ) {
    throw new Error("At least one known check scope is required.");
  }
  let selected;
  if (env.GITHUB_EVENT_NAME === "workflow_dispatch") {
    selected = Object.fromEntries(scopes.map((name) => [name, true]));
  } else if (
    env.GITHUB_EVENT_NAME === "pull_request" ||
    (env.GITHUB_EVENT_NAME === "push" && env.GITHUB_REF === "refs/heads/main")
  ) {
    const event = JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, "utf8"));
    const checkedOut = git(REPOSITORY_ROOT, ["rev-parse", "HEAD"]);
    if (
      checkedOut.status !== 0 ||
      checkedOut.stdout.trim() !== env.GITHUB_SHA
    ) {
      throw new Error("The checkout does not match the event revision.");
    }
    selected = selectPullRequestChecks({
      base:
        env.GITHUB_EVENT_NAME === "pull_request"
          ? event.pull_request?.base?.sha
          : event.before,
      head: env.GITHUB_SHA,
      scopes,
    });
  } else {
    throw new Error(
      "PR check selection requires pull_request, a main push, or workflow_dispatch.",
    );
  }
  if (!env.GITHUB_OUTPUT) throw new Error("GITHUB_OUTPUT is required.");
  appendFileSync(
    env.GITHUB_OUTPUT,
    Object.entries(selected)
      .map(([name, needed]) => name + "=" + needed + "\n")
      .join(""),
  );
  const report = [
    "PR check selection",
    ...Object.entries(selected).map(
      ([name, needed]) =>
        "- " +
        name +
        ": " +
        (needed ? "selected" : "not applicable; inputs unchanged"),
    ),
    "",
  ].join("\n");
  console.log(report);
  if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, report);
  return selected;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    const { values } = parseArgs({
      options: { scope: { type: "string", multiple: true } },
      allowPositionals: false,
    });
    runFromGitHubEnvironment(
      process.env,
      values.scope ?? Object.keys(CHECK_INPUTS),
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
