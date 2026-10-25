import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { installSelectedNpm } from "./installSelectedNpm.mjs";

function withManifest(packageManager, inspect) {
  const repositoryRoot = mkdtempSync(join(tmpdir(), "webvowl-npm-selector-"));
  try {
    writeFileSync(
      join(repositoryRoot, "package.json"),
      JSON.stringify({ devEngines: { packageManager } }),
    );
    inspect(repositoryRoot);
  } finally {
    rmSync(repositoryRoot, { recursive: true, force: true });
  }
}

test.each(["win32", "linux"])(
  "%s installs the manifest selection with the existing flags",
  (platform) => {
    withManifest({ name: "npm", version: ">=99.2.3" }, (repositoryRoot) => {
      let invocation;
      const status = installSelectedNpm({
        repositoryRoot,
        platform,
        run: (...args) => {
          invocation = args;
          return { status: 17 };
        },
      });
      expect(invocation).toEqual([
        platform === "win32" ? "npm.cmd" : "npm",
        ["install", "--global", "--no-audit", "--no-fund", "npm@99.2.3"],
        {
          cwd: repositoryRoot,
          stdio: "inherit",
          shell: platform === "win32",
          windowsHide: true,
        },
      ]);
      expect(status).toBe(17);
    });
  },
);

test.each([
  undefined,
  { name: "pnpm", version: ">=99.2.3" },
  { name: "npm", version: "latest" },
  { name: "npm", version: ">=99.2.3 & echo injected" },
  { name: "npm", version: ">=99.2.3 <100" },
  { name: "npm", version: ">=99.2.3-beta.1" },
])(
  "rejects an invalid npm minimum %j before starting a command",
  (selection) => {
    withManifest(selection, (repositoryRoot) => {
      let invoked = false;
      expect(() =>
        installSelectedNpm({
          repositoryRoot,
          run: () => {
            invoked = true;
          },
        }),
      ).toThrow("package.json.devEngines.packageManager");
      expect(invoked).toBe(false);
    });
  },
);
