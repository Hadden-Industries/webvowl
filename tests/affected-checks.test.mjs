import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";

// Exercise native Git and the real CLI. The npm fixture is only a process
// boundary: it records requested scripts and simulates a downstream failure.
describe("affected WebVOWL verification", () => {
  let root, env, base, output, npmCli;
  function write(path, contents = "changed input\n") {
    const destination = join(root, path);
    mkdirSync(dirname(destination), { recursive: true });
    writeFileSync(destination, contents);
  }
  function git(args) {
    const result = spawnSync("git", args, { cwd: root, env, encoding: "utf8", windowsHide: true });
    if (result.error || result.status !== 0) throw new Error(result.error?.message ?? result.stderr);
    return result.stdout.trim();
  }
  function commit() {
    git(["add", "."]);
    git(["-c", "user.name=Affected fixture", "-c", "user.email=fixture@example.invalid", "-c", "commit.gpgsign=false", "commit", "-m", "Fixture"]);
    return git(["rev-parse", "HEAD"]);
  }
  function run({ comparisonBase = base, failureScript = "" } = {}) {
    return spawnSync(process.execPath, [join(root, "util/runAffectedChecks.mjs"), "--base", comparisonBase], {
      cwd: root, env: { ...env, npm_execpath: npmCli, SDLC_NPM_LOG: output, SDLC_FAIL_SCRIPT: failureScript },
      encoding: "utf8", windowsHide: true,
    });
  }
  function calls() {
    expect(existsSync(output)).toBe(true);
    return readFileSync(output, "utf8").trim().split("\n").map(JSON.parse);
  }
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "webvowl-affected-"));
    env = {
      ...Object.fromEntries(Object.entries(process.env).filter(([name]) => !/^(?:GIT|GITHUB)_/iu.test(name))),
      GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: join(root, "empty-global-config"),
    };
    write("empty-global-config", "");
    git(["init", "--initial-branch=main"]);
    write("package.json", '{"name":"no-root-module-type"}\n');
    write(".gitignore", ".sdlc/runtime/\n.sdlc/tmp/\n");
    for (const name of ["runAffectedChecks.mjs", "selectPullRequestChecks.mjs"]) {
      write(`util/${name}`, readFileSync(new URL(`../util/${name}`, import.meta.url), "utf8"));
    }
    write("src/app/main.js", "export const initial = true;\n");
    write("docs/sdlc/howto.md", "Control instructions\n");
    npmCli = join(root, "npm fixture/npm-cli.mjs");
    write("npm fixture/npm-cli.mjs", `import { appendFileSync } from "node:fs";
appendFileSync(process.env.SDLC_NPM_LOG, JSON.stringify(process.argv.slice(2)) + "\\n");
if (process.argv[3] === process.env.SDLC_FAIL_SCRIPT) process.exitCode = 31;
`);
    base = commit();
    output = join(root, ".sdlc/runtime/npm-calls.jsonl");
    mkdirSync(dirname(output), { recursive: true });
  });
  afterEach(() => {
    const target = resolve(root);
    if (dirname(target) !== resolve(tmpdir()) || !basename(target).startsWith("webvowl-affected-")) {
      throw new Error("Refusing cleanup outside the owned affected-check fixture.");
    }
    rmSync(target, { recursive: true, force: true });
  });
  test.each(["staged", "unstaged", "untracked"])("%s application inputs run the native npm test and build owners", (state) => {
    const path = state === "untracked" ? "src/new.js" : "src/app/main.js";
    write(path);
    if (state === "staged") git(["add", path]);
    const result = run();
    expect({ status: result.status, error: result.stderr }).toEqual({ status: 0, error: "" });
    expect(calls()).toEqual([["test", "--", "--runInBand"], ["run", "build"]]);
  });
  test("SDLC input executes only the three repository control owners", () => {
    write("docs/sdlc/howto.md");
    const result = run();
    expect({ status: result.status, error: result.stderr }).toEqual({ status: 0, error: "" });
    expect(calls()).toEqual([["run", "test:sdlc"], ["run", "test:setup"], ["run", "test:controls"]]);
  });
  test("shared inputs take the union and stop at the first downstream failure", () => {
    write("package.json", '{"name":"changed-fixture"}\n');
    const result = run({ failureScript: "test:setup" });
    expect(result.status).toBe(31);
    expect(calls()).toEqual([["run", "test:sdlc"], ["run", "test:setup"]]);
  });
  test("ignored runtime evidence and ordinary documentation launch no commands", () => {
    write(".sdlc/runtime/evidence.json");
    write(".sdlc/tmp/probe.json");
    write("docs/plans/next.md");
    const result = run();
    expect({ status: result.status, error: result.stderr }).toEqual({ status: 0, error: "" });
    expect(existsSync(output)).toBe(false);
  });
  test("an invalid base fails closed before any check process", () => {
    write("src/app/main.js");
    const result = run({ comparisonBase: "0".repeat(40) });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("unavailable");
    expect(existsSync(output)).toBe(false);
  });
});
