import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { installSelectedNpm } from "./installSelectedNpm.mjs";

function withManifest(packageManager, inspect) {
  const repositoryRoot = mkdtempSync(join(tmpdir(), "webvowl-npm-selector-"));
  try {
    writeFileSync(
      join(repositoryRoot, "package.json"),
      JSON.stringify({ packageManager }),
    );
    inspect(repositoryRoot);
  } finally {
    rmSync(repositoryRoot, { recursive: true, force: true });
  }
}

test.each(["win32", "linux"])(
  "%s installs the manifest selection with the existing flags",
  (platform) => {
    withManifest("npm@99.2.3", (repositoryRoot) => {
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
  "pnpm@12.2.0",
  "npm@latest",
  "npm@12.2.0 & echo injected",
])(
  "rejects a non-exact npm selector %s before starting a command",
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
      ).toThrow("exact npm version");
      expect(invoked).toBe(false);
    });
  },
);
