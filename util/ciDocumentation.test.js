import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  renameSync,
  unlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { selectChecks, selectFromEnvironment } from "./selectCiChecks.mjs";

let root;
function git(...args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
}
function put(path, text = "A document.\n") {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), text);
}
function commit() {
  git("add", ".");
  git(
    "-c",
    "user.name=CI Test",
    "-c",
    "user.email=ci@example.invalid",
    "-c",
    "commit.gpgsign=false",
    "commit",
    "-qm",
    "fixture",
  );
  return git("rev-parse", "HEAD");
}
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "webvowl-ci-"));
  git("init", "-q");
  put("README.md");
  put("src/code.js", "original\n");
});
afterEach(() => {
  if (
    dirname(resolve(root)) !== resolve(tmpdir()) ||
    !basename(root).startsWith("webvowl-ci-")
  ) {
    throw new Error("Unsafe fixture cleanup");
  }
  rmSync(root, { recursive: true, force: true });
});

test("docs-only changes select surviving literal names", () => {
  const base = commit();
  put("docs/space [literal] ü.md");
  const head = commit();
  expect(selectChecks({ root, base, head })).toEqual({
    full: false,
    documents: ["docs/space [literal] ü.md"],
  });
});
test.each([
  "src/code.js",
  "AGENTS.md",
  "package-lock.json",
  ".github/workflows/webvowl-ci.yml",
  "docs/data.json",
  "unknown.txt",
])("mixed change to %s runs full checks", (path) => {
  const base = commit();
  put("README.md", "Changed.\n");
  put(path, "changed\n");
  expect(selectChecks({ root, base, head: commit() }).full).toBe(true);
});
test("renaming source into docs cannot hide the source deletion", () => {
  const base = commit();
  mkdirSync(join(root, "docs"));
  renameSync(join(root, "src/code.js"), join(root, "docs/code.md"));
  expect(selectChecks({ root, base, head: commit() }).full).toBe(true);
});
test("deleted documents need no content check", () => {
  const base = commit();
  unlinkSync(join(root, "README.md"));
  expect(selectChecks({ root, base, head: commit() })).toEqual({
    full: false,
    documents: [],
  });
});
test("unavailable comparisons and unsupported events run full checks", () => {
  const head = commit();
  expect(selectChecks({ root, base: "0".repeat(40), head }).full).toBe(true);
  expect(
    selectFromEnvironment({ root, env: { GITHUB_EVENT_NAME: "schedule" } })
      .full,
  ).toBe(true);
  expect(
    selectFromEnvironment({
      root,
      env: { GITHUB_EVENT_NAME: "workflow_dispatch" },
    }).full,
  ).toBe(true);
  expect(
    selectFromEnvironment({
      root,
      env: {
        GITHUB_EVENT_NAME: "pull_request",
        GITHUB_EVENT_PATH: join(root, "missing"),
        GITHUB_SHA: head,
      },
    }).full,
  ).toBe(true);
});
test("a checkout that differs from the event must run full checks", () => {
  const base = commit();
  put("README.md", "Changed.\n");
  commit();
  put("event.json", JSON.stringify({ pull_request: { base: { sha: base } } }));
  expect(
    selectFromEnvironment({
      root,
      env: {
        GITHUB_EVENT_NAME: "pull_request",
        GITHUB_EVENT_PATH: join(root, "event.json"),
        GITHUB_SHA: base,
      },
    }).full,
  ).toBe(true);
});

test.each(["pull_request", "push"])(
  "%s compares the event base with the checked-out revision",
  (eventName) => {
    const base = commit();
    put("docs/guide.md");
    const head = commit();
    put(
      "event.json",
      JSON.stringify({ before: base, pull_request: { base: { sha: base } } }),
    );
    expect(
      selectFromEnvironment({
        root,
        env: {
          GITHUB_EVENT_NAME: eventName,
          GITHUB_EVENT_PATH: join(root, "event.json"),
          GITHUB_SHA: head,
        },
      }),
    ).toEqual({ full: false, documents: ["docs/guide.md"] });
  },
);
