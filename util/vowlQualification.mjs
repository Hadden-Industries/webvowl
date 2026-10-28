import { execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  closeSync,
  lstatSync,
  openSync,
  readFileSync,
  readlinkSync,
  writeFileSync,
} from "node:fs";
import { cpus } from "node:os";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import {
  assertQuiescentMachine,
  cpuBusyFraction,
} from "./benchmarkEnvironment.mjs";

const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const git = (directory, args) =>
  execFileSync("git", ["-C", directory, ...args], {
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 32 * 1024 * 1024,
  });

/** Include staged changes and untracked bytes, without following untracked links. */
export function sourceIdentity(directory, paths = []) {
  return {
    head: git(directory, ["rev-parse", "HEAD"]).trim(),
    diffSha256: hash(
      git(directory, ["diff", "HEAD", "--binary", "--", ...paths]),
    ),
    untracked: git(directory, [
      "ls-files",
      "--others",
      "--exclude-standard",
      "-z",
      "--",
      ...paths,
    ])
      .split("\0")
      .filter(Boolean)
      .sort()
      .map((path) => {
        const absolute = resolve(directory, path);
        const symbolicLink = lstatSync(absolute).isSymbolicLink();
        return {
          path,
          symbolicLink,
          sha256: hash(
            symbolicLink ? readlinkSync(absolute) : readFileSync(absolute),
          ),
        };
      }),
  };
}

/** Reserve before starting producers; an existing report is never overwritten. */
export function reserveReport(path) {
  return openSync(path, "wx");
}

/** A late filesystem failure must not discard raw observations. */
export function writeReport(descriptor, value) {
  const text = JSON.stringify(value, null, 2) + "\n";
  try {
    writeFileSync(descriptor, text);
    return true;
  } catch (error) {
    console.error(
      `Report write failed: ${error.message}; complete result follows on stdout`,
    );
    console.log(text);
    return false;
  } finally {
    try {
      closeSync(descriptor);
    } catch {
      /* A failed descriptor may already be closed. */
    }
  }
}

/** Native file descriptors avoid asynchronous log-stream errors and inherited pipes. */
export function spawnLoggedProcess(executable, args, path, options = {}) {
  const descriptor = openSync(path, "wx");
  let owned;
  try {
    owned = spawn(executable, args, {
      ...options,
      windowsHide: true,
      stdio: ["ignore", descriptor, descriptor],
    });
  } finally {
    closeSync(descriptor);
  }
  const record = { owned, error: undefined };
  record.ended = new Promise((done) => {
    owned.once("error", (error) => {
      record.error = { code: error.code, message: error.message };
    });
    owned.once("close", (code, signal) =>
      done({
        pid: owned.pid,
        code,
        signal,
        ...(record.error ? { error: record.error } : {}),
      }),
    );
  });
  return record;
}

/** Stop only an owned producer, with bounded teardown even after a broken peer. */
export async function stopOwnedProcess(record, timeoutMs = 5000) {
  const timedOut = Symbol("teardown deadline");
  const wait = () =>
    Promise.race([record.ended, delay(timeoutMs, timedOut, { ref: false })]);
  if (record.owned.exitCode === null && record.owned.signalCode === null) {
    record.owned.kill();
  }
  let ended = await wait();
  if (ended !== timedOut) return ended;
  // Use the retained ChildProcess handle, never a separately looked-up PID/tree.
  if (record.owned.exitCode === null && record.owned.signalCode === null)
    record.owned.kill("SIGKILL");
  ended = await wait();
  return ended === timedOut
    ? {
        pid: record.owned.pid,
        error: { message: "Owned process teardown did not complete" },
      }
    : ended;
}

/** A later diagnostic failure must not relabel a completed functional cohort. */
export async function retainFunctionalResult(receipt, readSnapshot) {
  if (receipt.functional) return;
  const snapshot = await readSnapshot();
  if (snapshot)
    receipt.functional = { ...snapshot, partial: !snapshot.finishedAt };
}

/** Observe the same native admission samples, including refusals, without rereading CPUs. */
export async function admitHost(
  admissions,
  { readCpus = cpus, sampleMs = 500, maxBusyFraction = 0.1 } = {},
) {
  const snapshots = [];
  const entry = {
    at: new Date().toISOString(),
    sampleMs,
    maxBusyFraction,
    status: "checking",
  };
  admissions.push(entry);
  try {
    await assertQuiescentMachine({
      sampleMs,
      maxBusyFraction,
      readCpus: () => {
        const value = readCpus();
        snapshots.push(value);
        return value;
      },
    });
    entry.status = "admitted";
  } catch (error) {
    entry.status = "refused";
    entry.error = error.message;
    throw error;
  } finally {
    if (snapshots.length === 2)
      entry.busyFraction = cpuBusyFraction(snapshots[0], snapshots[1]);
  }
  return entry;
}
