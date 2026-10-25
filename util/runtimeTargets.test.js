import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runtimeTarget, runtimeTargets } from "./runtimeTargets.mjs";
import { pythonTarget } from "./pythonTarget.mjs";

function fixture(run) {
  const root = mkdtempSync(join(tmpdir(), "webvowl-runtime-targets-"));
  try {
    writeFileSync(join(root, ".node-version"), "25.7.2\n");
    writeFileSync(join(root, ".python-version"), "3.16.2\n");
    writeFileSync(join(root, ".uv-version"), "0.20.1\n");
    writeFileSync(
      join(root, "package.json"),
      JSON.stringify({
        devEngines: { packageManager: { name: "npm", version: ">=99.2.3" } },
      }),
    );
    run(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("each maintained declaration drives the selected runtime and Python projection", () => {
  fixture((root) => {
    expect(runtimeTargets(root)).toEqual({
      node: "25.7.2",
      npm: "99.2.3",
      python: "3.16.2",
      uv: "0.20.1",
    });
    writeFileSync(join(root, ".python-version"), "3.17.4\n");
    expect(runtimeTargets(root).python).toBe("3.17.4");
    expect(pythonTarget(root)).toEqual({ version: "3.17.4", ruff: "py317" });
  });
});

test.each([
  "latest",
  "24",
  "24.2",
  "24.2.1-rc.1",
  "024.2.1",
  "24.2.1\nnpm=1.0.0",
])("rejects floating, preview and output-injection selectors: %j", (value) => {
  fixture((root) => {
    writeFileSync(join(root, ".node-version"), value);
    expect(() => runtimeTarget("node", root)).toThrow(
      "stable major.minor.patch",
    );
  });
});

test("unknown names cannot select arbitrary filesystem paths", () => {
  fixture((root) => {
    expect(() => runtimeTarget("../other", root)).toThrow("Unknown runtime");
  });
});

test("CI output contains only the validated current declarations", () => {
  fixture((root) => {
    const output = join(root, "github-output");
    const result = spawnSync(
      process.execPath,
      ["util/runtimeTargets.mjs", "--github-output"],
      {
        env: { ...process.env, GITHUB_OUTPUT: output },
        encoding: "utf8",
        windowsHide: true,
      },
    );
    expect(result.status).toBe(0);
    const rows = readFileSync(output, "utf8").trim().split("\n");
    expect(rows).toHaveLength(4);
    expect(Object.fromEntries(rows.map((row) => row.split("=")))).toEqual(
      runtimeTargets(),
    );
  });
});
