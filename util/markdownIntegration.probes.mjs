import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const repository = fileURLToPath(new URL("../", import.meta.url));
const npmCli = process.env.npm_execpath;
assert.ok(npmCli, "Run this scope test through npm.");

test("Markdown selection includes maintained documents and excludes preserved records", () => {
  const git = spawnSync("git", ["ls-files", "-z", "--", "*.md"], {
    cwd: repository,
    encoding: "utf8",
    windowsHide: true,
  });
  assert.ifError(git.error);
  assert.equal(git.status, 0, git.stderr);
  const tracked = git.stdout.split("\0").filter(Boolean);
  const preserved = tracked.filter(
    (path) =>
      /^docs\/(?:owlapi-js|sdlc|reviews|evaluations|plans|specs)\//u.test(
        path,
      ) || path.startsWith("docs/designs/CommonJS-to-ESM/"),
  );
  assert.ok(
    preserved.length > 0,
    "The ownership assertion needs real preserved records.",
  );
  const child = spawnSync(
    process.execPath,
    [
      npmCli,
      "--silent",
      "exec",
      "--call",
      "markdown-quality inspect --root . --json",
    ],
    {
      cwd: repository,
      encoding: "utf8",
      timeout: 60000,
      maxBuffer: 8 * 1024 * 1024,
      windowsHide: true,
    },
  );
  assert.ifError(child.error);
  assert.equal(child.signal, null, child.stderr);
  assert.equal(child.status, 0, child.stderr);
  const selection = JSON.parse(child.stdout).selection;
  for (const path of ["README.md", "AGENTS.md", "packages/vowl/README.md"]) {
    assert.ok(selection.files.includes(path), path);
  }
  for (const path of preserved) {
    assert.ok(!selection.files.includes(path), path);
    assert.ok(
      selection.omissions.some(
        (item) => item.path === path && item.reason === "excluded",
      ),
      path,
    );
  }
});
