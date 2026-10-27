import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const LIST_MAX_BUFFER_BYTES = 10 * 1024 * 1024;

// A program found on PATH must behave the same in every supported shell.
// gh, git and powershell.exe each have one Windows implementation, so
// PowerShell and Git Bash run the same program. tar does not: Git Bash's GNU
// tar reads the drive letter of an absolute Windows path as a remote host,
// while PowerShell finds the Windows bsdtar. Launch Node through
// process.execPath or reuse npm's bundled libraries instead of adding a name
// that has several implementations.
const SHELL_INDEPENDENT_PROGRAMS = new Set(["gh", "git", "powershell.exe"]);

// A child_process launch whose program is a string literal. A method call
// named exec is RegExp#exec, not a process launch, so it is not matched.
const LITERAL_PROGRAM_LAUNCH =
  /(?<![\w$])(?:execFileSync|execFile|spawnSync|spawn|execSync)\(\s*["'`]([^"'`\s]+)|(?<![\w$.])exec\(\s*["'`]([^"'`\s]+)/gu;

// The repository's own sources; docs/ holds verbatim upstream site copies.
const ownedSources = () =>
  execFileSync("git", ["ls-files", "-z", "--", "*.js", "*.mjs", "*.cjs"], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: LIST_MAX_BUFFER_BYTES,
  })
    .split("\0")
    .filter(
      (filePath) =>
        filePath && !/^docs\/|(^|\/)(node_modules|fixtures)\//u.test(filePath),
    );

const shellDependentLaunches = () =>
  ownedSources().flatMap((filePath) => {
    const source = readFileSync(path.join(ROOT, filePath), "utf8");
    return [...source.matchAll(LITERAL_PROGRAM_LAUNCH)]
      .map((match) => ({
        program: match[1] ?? match[2],
        line: source.slice(0, match.index).split("\n").length,
      }))
      .filter(({ program }) => !SHELL_INDEPENDENT_PROGRAMS.has(program))
      .map(({ program, line }) => `${filePath}:${line} launches ${program}`);
  });

describe("child process programs", () => {
  test("launch only programs that behave the same in every supported shell", () => {
    expect(shellDependentLaunches()).toEqual([]);
  });
});
