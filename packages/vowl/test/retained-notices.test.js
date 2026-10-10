import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const generator = fileURLToPath(
  new URL("../scripts/retain-notices.mjs", import.meta.url),
);
let root;
let packageRoot;

function write(relativePath, contents) {
  const destination = join(root, relativePath);
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, contents);
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "vowl-retained-notices-"));
  packageRoot = join(root, "packages/vowl");
  write("LICENSE", "Authored package license\n");
  write("packages/vowl/scripts/retain-notices.mjs", "");
  copyFileSync(generator, join(packageRoot, "scripts/retain-notices.mjs"));
  write("node_modules/local-alias/index.js", "module.exports = {};\n");
  write("node_modules/local-alias/LICENSE", "Owning package grant\n");
  write(
    "node_modules/leaf/package.json",
    JSON.stringify({ name: "leaf", version: "2.0.0" }),
  );
  write("node_modules/leaf/index.js", "module.exports = {};\n");
  write("node_modules/leaf/LICENSE", "Transitive package grant\n");
});

afterEach(() => rmSync(root, { recursive: true, force: true }));

test.each(["1.0.0", undefined])(
  "retains scoped alias ownership and transitive grants with version %s",
  (version) => {
    write(
      "packages/vowl/package.json",
      JSON.stringify({
        dependencies: {
          "local-alias": `npm:@example/owner${version ? `@${version}` : ""}`,
        },
      }),
    );
    // The export hides package.json, so collection must walk from the entry.
    write(
      "node_modules/local-alias/package.json",
      JSON.stringify({
        name: "@example/owner",
        version: "1.0.0",
        exports: "./index.js",
        dependencies: { leaf: "2.0.0" },
      }),
    );
    const result = spawnSync(
      process.execPath,
      [join(packageRoot, "scripts/retain-notices.mjs")],
      { encoding: "utf8" },
    );
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    const notices = readFileSync(
      join(packageRoot, "THIRD-PARTY-NOTICES.md"),
      "utf8",
    );
    expect(notices).toContain("## @example/owner@1.0.0");
    expect(notices).toContain("Owning package grant");
    expect(notices).toContain("## leaf@2.0.0");
    expect(notices).toContain("Transitive package grant");
    expect(notices).not.toContain("## local-alias@");
    expect(readFileSync(join(packageRoot, "LICENSE"), "utf8")).toBe(
      "Authored package license\n",
    );
  },
);

test("does not accept a manifest whose owner differs from the declared alias", () => {
  write(
    "packages/vowl/package.json",
    JSON.stringify({
      dependencies: { "local-alias": "npm:@example/owner@1.0.0" },
    }),
  );
  write(
    "node_modules/local-alias/package.json",
    JSON.stringify({ name: "@example/other", version: "1.0.0" }),
  );
  const result = spawnSync(
    process.execPath,
    [join(packageRoot, "scripts/retain-notices.mjs")],
    { encoding: "utf8" },
  );
  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain(
    "Could not resolve the package root for local-alias",
  );
  expect(existsSync(join(packageRoot, "THIRD-PARTY-NOTICES.md"))).toBe(false);
});

function inheritedOwlapiFixture(selector) {
  write(
    "package.json",
    JSON.stringify({
      dependencies: { owlapi: selector },
      overrides: { owlapi: "$owlapi" },
    }),
  );
  write(
    "package-lock.json",
    JSON.stringify({
      packages: {
        "": { dependencies: { owlapi: selector } },
        "node_modules/owlapi": { name: "@example/owner", version: "1.0.0" },
      },
    }),
  );
  write(
    "packages/vowl/package.json",
    JSON.stringify({ dependencies: { owlapi: "*" } }),
  );
  write("node_modules/owlapi/index.js", "module.exports = {};\n");
  write("node_modules/owlapi/LICENSE", "Owning package grant\n");
  write(
    "node_modules/owlapi/package.json",
    JSON.stringify({
      name: "@example/owner",
      version: "1.0.0",
      exports: "./index.js",
      dependencies: { leaf: "2.0.0" },
    }),
  );
}

function generateFixtureNotices() {
  return spawnSync(
    process.execPath,
    [join(packageRoot, "scripts/retain-notices.mjs")],
    { encoding: "utf8" },
  );
}

test.each([
  "npm:@example/owner@1.0.0",
  `git+https://github.com/example/owner.git#${"a".repeat(40)}`,
])("retains inherited workspace OwlAPI notices for %s", (selector) => {
  inheritedOwlapiFixture(selector);
  // Run the copied generator against only the fixture, not the real checkout.
  const fixtureResult = spawnSync(
    process.execPath,
    [join(packageRoot, "scripts/retain-notices.mjs")],
    { encoding: "utf8" },
  );
  expect(fixtureResult.stderr).toBe("");
  expect(fixtureResult.status).toBe(0);
  const notices = readFileSync(
    join(packageRoot, "THIRD-PARTY-NOTICES.md"),
    "utf8",
  );
  expect(notices).toContain(selector);
  expect(notices).toContain("## @example/owner@1.0.0");
  expect(notices).toContain("Owning package grant");
  expect(notices).toContain("Transitive package grant");
});

test("refuses a Git selector whose native lock describes a different selection", () => {
  inheritedOwlapiFixture(
    `git+https://github.com/example/owner.git#${"a".repeat(40)}`,
  );
  write(
    "package-lock.json",
    JSON.stringify({
      packages: {
        "": { dependencies: { owlapi: "npm:@example/owner@1.0.0" } },
      },
    }),
  );
  const result = generateFixtureNotices();
  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain(
    "The root OwlAPI selector and lockfile disagree.",
  );
  expect(existsSync(join(packageRoot, "THIRD-PARTY-NOTICES.md"))).toBe(false);
});

test("refuses a Git package whose installed owner differs from its native lock", () => {
  inheritedOwlapiFixture(
    `git+https://github.com/example/owner.git#${"a".repeat(40)}`,
  );
  write(
    "node_modules/owlapi/package.json",
    JSON.stringify({ name: "owlapi", version: "1.0.0" }),
  );
  const result = generateFixtureNotices();
  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain(
    "Could not resolve the package root for owlapi",
  );
  expect(existsSync(join(packageRoot, "THIRD-PARTY-NOTICES.md"))).toBe(false);
});
