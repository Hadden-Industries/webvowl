// SPDX-License-Identifier: AGPL-3.0-only
// Consumer probes exercise the installed public contracts with WebVOWL's policy.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const tooling = join(root, "tooling/markdown");
const requireMarkdown = createRequire(join(tooling, "package.json"));
const entry = requireMarkdown.resolve("@hadden-industries/markdown-quality");
const installedRoot = resolve(dirname(entry), "..");
const {
  executeQuality,
  inspectSelection,
  readExecutionProfile,
  stageCandidate,
  validateQualityResult,
} = await import(pathToFileURL(entry).href);
const json = (path) => JSON.parse(readFileSync(path, "utf8"));
const sourceSha = "47febbe1b6f3282814e77db7ea13eac72b4928ed";

test("installed public contracts bind WebVOWL's retained source and resource policy", () => {
  const identity = json(join(installedRoot, "assets/source-identity.json"));
  assert.equal(identity.head, sourceSha);
  assert.equal(identity.clean, true);
  const workflow = readFileSync(
    join(root, ".github/workflows/markdown-quality.yml"),
    "utf8",
  );
  assert.ok(workflow.includes(`markdown-quality.yml@${identity.head}`));
  const profile = readExecutionProfile({ root });
  assert.equal(profile.samples, 6);
  assert.equal(profile.checkerMs, 30000);
  assert.equal(profile.windowMs, 180000);
  assert.equal(profile.memoryBytes, 536870912);
  assert.equal(profile.nodeOldSpaceMb, 128);
  assert.equal(profile.limits.workerHeapMb, 128);
  assert.equal(profile.runtimes.node, process.versions.node);
  const lock = json(join(root, profile.toolchain.lockFile));
  const manifest = json(join(tooling, "package.json"));
  const name = "@hadden-industries/markdown-quality";
  assert.equal(
    manifest.devDependencies[name],
    lock.packages[""].devDependencies[name],
  );
  assert.equal(
    lock.packages[`node_modules/${name}`].resolved,
    manifest.devDependencies[name],
  );
  // The immutable core digest is the independently qualified source47 archive.
  assert.equal(
    createHash("sha256")
      .update(readFileSync(join(root, profile.toolchain.coreArchive)))
      .digest("hex"),
    "ad51a2ccb721a2b14a05e8c1a61d9a1b7b3276d55a90beadb4c9f33d49702127",
  );
  assert.ok(requireMarkdown.resolve(`${name}/result-schema`));
  assert.ok(requireMarkdown.resolve(`${name}/execution-schema`));
});

test("the root policy selects authored anchors and accounts for retained archives", async () => {
  const report = await inspectSelection({ root });
  validateQualityResult(report);
  assert.equal(report.exitCode, 0);
  for (const path of [
    "AGENTS.md",
    "README.md",
    "SECURITY.md",
    "docs/continuous-integration.md",
    "packages/vowl/README.md",
    "packages/vowl/conformance/README.md",
  ]) {
    assert.ok(report.selection.files.includes(path), path);
  }
  for (const path of [
    "docs/reviews/fixture.md",
    "docs/sdlc/fixture.md",
    "docs/evaluations/fixture.md",
    "docs/owlapi-js/fixture.md",
  ]) {
    const explicit = await inspectSelection({ root, files: [path] });
    validateQualityResult(explicit);
    assert.equal(explicit.exitCode, 0);
    assert.deepEqual(explicit.selection.files, []);
    assert.equal(explicit.selection.exclusions[0].reason, "excluded");
  }
  assert.equal(
    json(join(root, ".markdown-quality.json")).ignoreFiles,
    undefined,
  );
});

test("WebVOWL's trusted policy rejects a real missing link despite candidate controls", async () => {
  // This tool-managed fixture remains available for failed-run diagnosis.
  const fixture = mkdtempSync(join(tmpdir(), "webvowl-markdown-consumer-"));
  const sourceRoot = join(fixture, "candidate");
  const outputRoot = join(fixture, "staged");
  mkdirSync(sourceRoot);
  const content = "# Candidate\n\n[Missing target](missing-target.md)\n";
  writeFileSync(join(sourceRoot, "README.md"), content);
  writeFileSync(
    join(sourceRoot, ".markdown-quality.json"),
    JSON.stringify({
      schemaVersion: 2,
      preset: "authored-gfm@1",
      include: ["**/*.md"],
      exclude: ["**"],
    }),
  );
  writeFileSync(join(sourceRoot, ".prettierignore"), "**/*.md\n");
  writeFileSync(
    join(sourceRoot, "package.json"),
    JSON.stringify({ scripts: { preinstall: "node marker.mjs" } }),
  );
  writeFileSync(
    join(sourceRoot, "marker.mjs"),
    'import { writeFileSync } from "node:fs"; writeFileSync("executed", "unsafe");\n',
  );
  const staged = stageCandidate({ sourceRoot, trustedRoot: root, outputRoot });
  const profile = readExecutionProfile({ root });
  const report = await executeQuality(
    {
      root: outputRoot,
      mode: "check",
      config: staged.configPath,
      limits: profile.limits,
    },
    {
      checkerMs: profile.checkerMs,
      requestBytes: profile.requestBytes,
      reportBytes: profile.reportBytes,
      nodeOldSpaceMb: profile.nodeOldSpaceMb,
    },
  );
  validateQualityResult(report);
  assert.equal(report.exitCode, 1);
  assert.deepEqual(report.selection.files, ["README.md"]);
  assert.ok(
    report.diagnostics.some(
      (item) =>
        item.source === "links" &&
        item.rule === "local-target" &&
        item.path === "README.md" &&
        item.line === 3,
    ),
    JSON.stringify(report.diagnostics),
  );
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.written, []);
  assert.equal(readFileSync(join(outputRoot, "README.md"), "utf8"), content);
  assert.equal(existsSync(join(outputRoot, "executed")), false);
  assert.equal(existsSync(join(sourceRoot, "executed")), false);
});
