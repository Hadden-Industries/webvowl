import { afterEach, expect, jest, test } from "@jest/globals";
import { execFileSync, spawnSync } from "node:child_process";
import {
  closeSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import {
  admitHost,
  reserveReport,
  sourceIdentity,
  spawnLoggedProcess,
  stopOwnedProcess,
  writeReport,
} from "./vowlQualification.mjs";

const repository = fileURLToPath(new URL("../", import.meta.url));
const directories = [],
  processes = [];
function temporary() {
  const path = mkdtempSync(resolve(tmpdir(), "webvowl-qualification-"));
  directories.push(path);
  return path;
}
afterEach(async () => {
  jest.restoreAllMocks();
  for (const record of processes.splice(0)) {
    await stopOwnedProcess(record);
  }
  for (const path of directories.splice(0)) {
    // Only this test's native mkdtemp siblings may be removed recursively.
    expect(dirname(resolve(path))).toBe(resolve(tmpdir()));
    expect(basename(path).startsWith("webvowl-qualification-")).toBe(true);
    rmSync(path, { recursive: true, force: true });
  }
});

test("report reservation rejects an existing file without changing its evidence", () => {
  const path = resolve(temporary(), "result.json");
  writeFileSync(path, "original evidence");
  expect(() => reserveReport(path)).toThrow(
    expect.objectContaining({ code: "EEXIST" }),
  );
  expect(readFileSync(path, "utf8")).toBe("original evidence");
});

test("late report-write failure preserves the complete partial receipt on stdout", () => {
  const descriptor = reserveReport(resolve(temporary(), "result.json"));
  closeSync(descriptor);
  const log = jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
  const receipt = { status: "failed", rawMs: [12, 14], failure: "retained" };
  expect(writeReport(descriptor, receipt)).toBe(false);
  expect(JSON.parse(log.mock.calls[0][0])).toEqual(receipt);
});

test("an unavailable producer settles its native error without an unhandled event", async () => {
  const root = temporary();
  const record = spawnLoggedProcess(
    resolve(root, "absent-executable"),
    [],
    resolve(root, "producer.log"),
  );
  processes.push(record);
  const ended = await record.ended;
  expect(ended.error.code).toBe("ENOENT");
  expect(existsSync(resolve(root, "producer.log"))).toBe(true);
});

test("owned producers use native log descriptors and close within bounded teardown", async () => {
  const path = resolve(temporary(), "producer.log");
  const record = spawnLoggedProcess(
    process.execPath,
    ["-e", "console.log('owned');setInterval(()=>{},1000)"],
    path,
  );
  processes.push(record);
  await new Promise((done) => record.owned.once("spawn", done));
  for (
    let attempt = 0;
    attempt < 100 && !readFileSync(path, "utf8").includes("owned");
    attempt++
  ) {
    await delay(10);
  }
  expect(readFileSync(path, "utf8")).toContain("owned");
  const ended = await stopOwnedProcess(record);
  expect(ended.error).toBeUndefined();
  expect(
    record.owned.exitCode !== null || record.owned.signalCode !== null,
  ).toBe(true);
});

test("source identities cover staged changes and changed untracked bytes", () => {
  const root = temporary();
  const git = (args) =>
    execFileSync("git", ["-C", root, ...args], {
      encoding: "utf8",
      windowsHide: true,
    });
  git(["init", "--quiet"]);
  git(["config", "core.autocrlf", "false"]);
  writeFileSync(resolve(root, "source.txt"), "before\n");
  git(["add", "source.txt"]);
  // This synthetic repository is test data, never a delivery/publication commit.
  git([
    "-c",
    "user.name=Fixture",
    "-c",
    "user.email=fixture@example.invalid",
    "-c",
    "commit.gpgsign=false",
    "-c",
    "core.hooksPath=.no-hooks",
    "commit",
    "--quiet",
    "-m",
    "Fixture baseline",
  ]);
  const before = sourceIdentity(root);
  writeFileSync(resolve(root, "source.txt"), "after\n");
  git(["add", "source.txt"]);
  const staged = sourceIdentity(root);
  expect(staged.head).toBe(before.head);
  expect(staged.diffSha256).not.toBe(before.diffSha256);
  writeFileSync(resolve(root, "candidate.txt"), "first");
  const first = sourceIdentity(root);
  writeFileSync(resolve(root, "candidate.txt"), "second");
  const second = sourceIdentity(root);
  expect(first.untracked).toHaveLength(1);
  expect(first.untracked[0].path).toBe("candidate.txt");
  expect(second.untracked[0].sha256).not.toBe(first.untracked[0].sha256);
});

const cpu = (user, idle) => [
  { times: { user, idle, nice: 0, sys: 0, irq: 0 } },
];
test("host admission records the actual two CPU samples and retains a refusal", async () => {
  const admissions = [];
  let snapshots = [cpu(0, 0), cpu(1, 9)];
  await admitHost(admissions, {
    sampleMs: 1,
    readCpus: () => snapshots.shift(),
  });
  expect(admissions[0]).toMatchObject({
    status: "admitted",
    busyFraction: 0.1,
  });
  snapshots = [cpu(0, 0), cpu(2, 8)];
  await expect(
    admitHost(admissions, { sampleMs: 1, readCpus: () => snapshots.shift() }),
  ).rejects.toThrow("not idle");
  expect(admissions[1]).toMatchObject({ status: "refused", busyFraction: 0.2 });
});

test("benchmark CLI reserves its report before loading either measured implementation", () => {
  const root = temporary(),
    output = resolve(root, "existing.json");
  writeFileSync(output, "preserved");
  const baseline = resolve(root, "baseline"),
    marker = resolve(root, "baseline-loaded");
  mkdirSync(resolve(baseline, "packages/vowl/src"), { recursive: true });
  writeFileSync(resolve(baseline, "package.json"), '{"type":"module"}');
  // Encode this controlled path as a JavaScript string literal, never a shell command.
  writeFileSync(
    resolve(baseline, "packages/vowl/src/index.js"),
    `import {writeFileSync} from "node:fs";writeFileSync(${JSON.stringify(marker)},"loaded");`,
  );
  const invocation = spawnSync(
    process.execPath,
    [
      resolve(repository, "util/benchmark-vowl-edit.mjs"),
      "--baseline",
      baseline,
      "--output",
      output,
    ],
    { cwd: repository, encoding: "utf8", windowsHide: true },
  );
  expect(invocation.status).toBe(1);
  expect(invocation.stderr).toContain("EEXIST");
  expect(invocation.stderr).not.toContain("ERR_MODULE_NOT_FOUND");
  expect(readFileSync(output, "utf8")).toBe("preserved");
  expect(existsSync(marker)).toBe(false);
});

test("browser CLI refuses stale logs before spawning or building anything", () => {
  const root = temporary();
  writeFileSync(resolve(root, "vite.log"), "preserved");
  const invocation = spawnSync(
    process.execPath,
    [
      resolve(repository, "util/qualify-vowl-edit.mjs"),
      "--chrome",
      process.execPath,
      "--profile",
      resolve(root, "profile"),
      "--output",
      root,
      "--limits-only",
      "--functional",
    ],
    { cwd: repository, encoding: "utf8", windowsHide: true },
  );
  expect(invocation.status).toBe(1);
  expect(invocation.stderr).toContain("Output already exists: vite.log");
  expect(existsSync(resolve(root, "production"))).toBe(false);
  expect(existsSync(resolve(root, "qualification.json"))).toBe(false);
  expect(readFileSync(resolve(root, "vite.log"), "utf8")).toBe("preserved");
});

test("browser CLI records an invalid executable failure before starting any producer", () => {
  const root = temporary();
  const invocation = spawnSync(
    process.execPath,
    [
      resolve(repository, "util/qualify-vowl-edit.mjs"),
      "--chrome",
      resolve(root, "missing-chrome"),
      "--profile",
      resolve(root, "profile"),
      "--output",
      root,
      "--limits-only",
      "--functional",
    ],
    { cwd: repository, encoding: "utf8", windowsHide: true },
  );
  expect(invocation.status).toBe(1);
  const receipt = JSON.parse(readFileSync(resolve(root, "qualification.json")));
  expect(receipt.status).toBe("failed");
  expect(receipt.error.message).toContain("Chrome executable does not exist");
  expect(existsSync(resolve(root, "build.log"))).toBe(false);
  expect(existsSync(resolve(root, "vite.log"))).toBe(false);
});
