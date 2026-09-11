import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageDocument = JSON.parse(
  readFileSync(join(repositoryRoot, "package.json"), "utf8"),
);
const jestExecutable = join(
  repositoryRoot,
  "node_modules",
  "jest",
  "bin",
  "jest.js",
);

test("product discovery includes source tests and excludes retained SDLC evidence", () => {
  const temporaryRoot = realpathSync.native(tmpdir());
  const fixture = realpathSync.native(
    mkdtempSync(join(temporaryRoot, "webvowl-discovery-")),
  );
  const productPaths = [
    "src/product.test.js",
    "tests/control.test.js",
    "src/runtime/product.test.js",
    ".sdlc/runtime-not-evidence/control.test.js",
  ];
  const evidencePaths = [
    ".sdlc/runtime/review/source.test.js",
    ".sdlc/tmp/diagnostic.test.js",
  ];
  let passed = false;
  try {
    for (const path of [...productPaths, ...evidencePaths]) {
      const destination = join(fixture, path);
      mkdirSync(dirname(destination), { recursive: true });
      writeFileSync(
        destination,
        "throw new Error('Discovery must not execute this file');\n",
      );
    }
    writeFileSync(
      join(fixture, "package.json"),
      JSON.stringify({
        name: "discovery-fixture",
        private: true,
        jest: packageDocument.jest,
      }),
    );
    const result = spawnSync(
      process.execPath,
      [jestExecutable, "--listTests", "--runInBand", "--json", "--no-cache"],
      {
        cwd: fixture,
        encoding: "utf8",
        timeout: 30000,
        windowsHide: true,
      },
    );
    expect(result.error).toBeUndefined();
    expect({ status: result.status, stderr: result.stderr }).toEqual({
      status: 0,
      stderr: "",
    });
    const selected = JSON.parse(result.stdout)
      .map((path) => relative(fixture, path).split("\\").join("/"))
      .sort();
    expect(selected).toEqual([...productPaths].sort());
    for (const path of evidencePaths) {
      expect(readFileSync(join(fixture, path), "utf8")).toBe(
        "throw new Error('Discovery must not execute this file');\n",
      );
    }
    const diagnostic = spawnSync(
      process.execPath,
      [
        jestExecutable,
        "--listTests",
        "--runInBand",
        "--json",
        "--no-cache",
        "--runTestsByPath",
        evidencePaths[1],
        "--testPathIgnorePatterns=/node_modules/",
      ],
      { cwd: fixture, encoding: "utf8", timeout: 30000, windowsHide: true },
    );
    expect(diagnostic.error).toBeUndefined();
    expect({ status: diagnostic.status, stderr: diagnostic.stderr }).toEqual({
      status: 0,
      stderr: "",
    });
    expect(JSON.parse(diagnostic.stdout)).toEqual([
      join(fixture, evidencePaths[1]),
    ]);
    passed = true;
  } finally {
    if (passed && dirname(resolve(fixture)) === temporaryRoot)
      rmSync(fixture, { recursive: true });
    else console.error(`Discovery fixture retained: ${fixture}`);
  }
}, 40000);
