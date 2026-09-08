import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";
import { selectWorkingTreeChecks } from "./selectPullRequestChecks.mjs";

const REPOSITORY_ROOT = fileURLToPath(new URL("../", import.meta.url));
export function affectedCheckCommands(selected) {
  const commands = [];
  if (selected.sdlc) {
    commands.push(["run", "test:sdlc"], ["run", "test:setup"], ["run", "test:controls"]);
  }
  if (selected.application) {
    commands.push(["test", "--", "--runInBand"], ["run", "build"]);
  }
  return commands;
}

export function runAffectedChecks({ root = REPOSITORY_ROOT, base } = {}) {
  if (!base) {
    const active = JSON.parse(readFileSync(resolve(root, ".sdlc/runtime/active.json"), "utf8"));
    base = active.startingHead;
  }
  const selected = selectWorkingTreeChecks({ root, base });
  console.log("Affected scopes from " + base + ": " + JSON.stringify(selected));
  const commands = affectedCheckCommands(selected);
  const npmCli = process.env.npm_execpath;
  if (commands.length && !npmCli) {
    throw new Error("Run through npm run check:affected so the selected package manager owns every check");
  }
  for (const args of commands) {
    console.log("Running npm: " + JSON.stringify(args));
    const result = spawnSync(process.execPath, [npmCli, ...args], { cwd: root, stdio: "inherit", windowsHide: true });
    if (result.error) throw result.error;
    if (result.signal) throw new Error("Check terminated by " + result.signal);
    if (result.status !== 0) return result.status ?? 1;
  }
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const { values } = parseArgs({ options: { base: { type: "string" } }, allowPositionals: false });
    process.exitCode = runAffectedChecks({ base: values.base });
  } catch (error) {
    console.error("Affected verification failed: " + error.message + ". Supply --base <full commit SHA> or begin an SDLC task.");
    process.exitCode = 1;
  }
}
