import { createHash } from "node:crypto";
import { existsSync, lstatSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Linter } from "eslint";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const PACKAGE_JSON_PATH = path.join(ROOT, "package.json");
const PACKAGE_LOCK_PATH = path.join(ROOT, "package-lock.json");
const INSTALLED_PACKAGE_JSON_PATH = path.join(
  ROOT,
  "node_modules",
  "owlapi",
  "package.json",
);
const LOCAL_PACKAGE_SOURCE_PATH = path.join(ROOT, "src", "owlapi-js");
const INSTALLED_PACKAGE_PATH = path.join(ROOT, "node_modules", "owlapi");
const UTILITY_PATH = path.join(ROOT, "util");

const EXPECTED_PACKAGE_SPECIFIER =
  "git+https://github.com/Hadden-Industries/owlapi.git#ccace6afe201c6e2cc6a49e53b2d50bd6617916f";
const EXPECTED_RESOLUTION = EXPECTED_PACKAGE_SPECIFIER;
const EXPECTED_INTEGRITY =
  "sha512-365L3S4K3Z/kiZwl3ubDLWECRvTK+bHfwBtaekZk7myLd8kJ/RgEDmsPJODEYi5MY5rbPfwaWiFYKOaloufhzg==";
// Independently derived from git archive of the approved commit, then npm pack
// --ignore-scripts. npm skips integrity verification for Git dependencies.
// Archive SHA-256: a2a3575864489ac8a3a9000f2e70992877b2c90076894570663ec52f5d4fb346.
const EXPECTED_PAYLOAD_SHA256 =
  "848a8ea563216ea4acc91d733ec22930b5efb5358951743d09b9fd5b0d653be5";
const EXPECTED_PACKAGE_VERSION = "0.1.0-rc.1";
const EXPECTED_EXPORTS = {
  ".": "./index.js",
  "./apibinding": "./apibinding/index.js",
  "./model": "./model/index.js",
  "./io": "./io/index.js",
  "./formats": "./formats/index.js",
  "./profiles": "./profiles/index.js",
  "./util": "./util/index.js",
};
const APPROVED_IMPORT_SPECIFIERS = new Set([
  "owlapi",
  "owlapi/apibinding",
  "owlapi/model",
  "owlapi/io",
  "owlapi/formats",
  "owlapi/profiles",
]);
const OWLAPI_OWNED_ROOT_DEPENDENCIES = [
  "@rdfjs/data-model",
  "@rdfjs/dataset",
  "jsonld",
  "n3",
  "rdfxml-streaming-parser",
];
const WEBVOWL_OWNED_XML_DEPENDENCY = "0.9.12";
const PACKAGE_CONFIGURATION_KEYS = ["imports", "resolutions"];
const CONFIGURATION_PATHS = [
  path.join(ROOT, "vite.config.mjs"),
  path.join(ROOT, "eslint.config.js"),
];
const MODULE_SPECIFIER_RULE_ID = "boundary/collect-module-specifiers";
const javascriptLinter = new Linter({ cwd: ROOT });

const readJson = (filePath) => JSON.parse(readFileSync(filePath, "utf8"));

const packagePayload = (directory = INSTALLED_PACKAGE_PATH) =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    // Nested installed dependencies have their own lock identities.
    if (entry.name === "node_modules") {
      return [];
    }
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return packagePayload(filePath);
    }
    if (!entry.isFile()) {
      throw new Error(`Unexpected non-file in OwlAPI payload: ${filePath}`);
    }
    return [
      [
        path.relative(INSTALLED_PACKAGE_PATH, filePath).replaceAll("\\", "/"),
        createHash("sha256").update(readFileSync(filePath)).digest("hex"),
      ],
    ];
  });

const hasUnexpectedOwlapiReference = (manifest) => {
  const manifestWithoutCoordinate = structuredClone(manifest);
  delete manifestWithoutCoordinate.dependencies?.owlapi;
  return /\bowlapi(?:-js)?\b/iu.test(JSON.stringify(manifestWithoutCoordinate));
};

const boundedDiagnostics = (violations) => ({
  count: violations.length,
  sample: violations.slice(0, 20),
});

const relative = (filePath) =>
  path.relative(ROOT, filePath).replaceAll("\\", "/");

const sourceFiles = (directory) =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      // Vite's root is src/, so its generated dependency cache can live here.
      // Inspect authored consumers, not dependency output changing under Vite.
      return entry.name === "node_modules" ? [] : sourceFiles(absolutePath);
    }
    return /\.(?:js|mjs)$/u.test(entry.name) ? [absolutePath] : [];
  });

const isWithin = (parentPath, childPath) => {
  const relativePath = path.relative(parentPath, childPath);
  return (
    relativePath === "" ||
    (!relativePath.startsWith("..") && !path.isAbsolute(relativePath))
  );
};

const literalModuleSpecifier = (node) => {
  if (node?.type === "Literal" && typeof node.value === "string") {
    return node.value;
  }
  if (
    node?.type === "TemplateLiteral" &&
    node.expressions.length === 0 &&
    node.quasis.length === 1
  ) {
    return node.quasis[0].value.cooked ?? node.quasis[0].value.raw;
  }
  return undefined;
};

const moduleSpecifierCollectorRule = (specifiers) => ({
  meta: {
    schema: [],
    type: "problem",
  },
  create: () => {
    const collect = (node) => {
      const specifier = literalModuleSpecifier(node);
      if (specifier !== undefined) {
        specifiers.push(specifier);
      }
    };

    return {
      CallExpression(node) {
        if (
          node.callee.type === "Identifier" &&
          node.callee.name === "require"
        ) {
          collect(node.arguments[0]);
        }
      },
      ExportAllDeclaration(node) {
        collect(node.source);
      },
      ExportNamedDeclaration(node) {
        collect(node.source);
      },
      ImportDeclaration(node) {
        collect(node.source);
      },
      ImportExpression(node) {
        collect(node.source);
      },
    };
  },
});

const importedSpecifiersFromSource = (
  source,
  sourceName = "<provided source>",
) => {
  const specifiers = [];
  const messages = javascriptLinter.verify(
    source,
    [
      {
        languageOptions: {
          ecmaVersion: "latest",
          sourceType: "module",
        },
        plugins: {
          boundary: {
            rules: {
              "collect-module-specifiers":
                moduleSpecifierCollectorRule(specifiers),
            },
          },
        },
        rules: {
          [MODULE_SPECIFIER_RULE_ID]: "error",
        },
      },
    ],
    {
      allowInlineConfig: false,
    },
  );
  if (messages.length > 0) {
    const diagnostics = messages.map(
      ({ column, line, message }) => `${line}:${column} ${message}`,
    );
    throw new SyntaxError(
      `Cannot inspect module references in ${sourceName}:\n${diagnostics.join("\n")}`,
    );
  }
  return specifiers;
};

const importedSpecifiers = (filePath) =>
  importedSpecifiersFromSource(
    readFileSync(filePath, "utf8"),
    relative(filePath),
  );

const importBoundaryViolations = () => {
  const violations = [];
  for (const sourceRoot of [
    path.join(ROOT, "src"),
    UTILITY_PATH,
    path.join(ROOT, "packages", "vowl", "src"),
  ]) {
    for (const filePath of sourceFiles(sourceRoot)) {
      for (const specifier of importedSpecifiers(filePath)) {
        if (
          (specifier === "owlapi" || specifier.startsWith("owlapi/")) &&
          !APPROVED_IMPORT_SPECIFIERS.has(specifier)
        ) {
          violations.push(`${relative(filePath)} -> ${specifier}`);
          continue;
        }

        if (
          specifier.includes("owlapi-js") ||
          specifier.includes("node_modules/owlapi")
        ) {
          violations.push(`${relative(filePath)} -> ${specifier}`);
          continue;
        }

        if (!specifier.startsWith(".")) {
          continue;
        }

        const resolved = path.resolve(path.dirname(filePath), specifier);
        if (
          isWithin(LOCAL_PACKAGE_SOURCE_PATH, resolved) ||
          isWithin(INSTALLED_PACKAGE_PATH, resolved)
        ) {
          violations.push(`${relative(filePath)} -> ${specifier}`);
        }
      }
    }
  }
  return violations.sort();
};

const packageDevelopmentMaterial = () => {
  const present = [];
  for (const directory of [
    LOCAL_PACKAGE_SOURCE_PATH,
    path.join(UTILITY_PATH, "owlapi-reference"),
  ]) {
    if (existsSync(directory)) {
      present.push(relative(directory));
    }
  }

  const packageUtilityPattern =
    /^(?:benchmark-owlapi-.*\.mjs|generate-w3c-.*\.mjs|measure-owlapi-.*\.mjs|audit-w3c-rdf-to-owl-fixtures\.mjs|verify-owlapi-rdfxml-corpus\.mjs|generate-owlapi-benchmark-fixtures\.js)$/u;
  present.push(
    ...readdirSync(UTILITY_PATH, { withFileTypes: true })
      .filter(
        (entry) => entry.isFile() && packageUtilityPattern.test(entry.name),
      )
      .map((entry) => `util/${entry.name}`),
  );
  return present.sort();
};

describe("installed owlapi consumer boundary", () => {
  test("collects supported static, dynamic, and CommonJS module references", () => {
    const source = [
      'import model from "owlapi/model";',
      'export { StringDocumentSource } from "owlapi/io";',
      'export * from "owlapi/formats";',
      'void import("../node_modules/owlapi/internal/dynamic.js", { with: {} });',
      "void import(`owlapi/apibinding`);",
      'require("owlapi");',
    ].join("\n");

    expect(importedSpecifiersFromSource(source)).toEqual([
      "owlapi/model",
      "owlapi/io",
      "owlapi/formats",
      "../node_modules/owlapi/internal/dynamic.js",
      "owlapi/apibinding",
      "owlapi",
    ]);
  });

  test("does not treat comments or strings as module references", () => {
    const source = [
      "const prose = 'import(\"owlapi/internal/in-a-string.js\")';",
      "/*",
      'export * from "owlapi/internal/in-a-comment.js";',
      "*/",
      '// require("owlapi/internal/in-a-line-comment.js");',
    ].join("\n");

    expect(importedSpecifiersFromSource(source)).toEqual([]);
  });

  test("fails closed when a source file cannot be parsed", () => {
    expect(() => importedSpecifiersFromSource("import(")).toThrow(
      "Cannot inspect module references in <provided source>:\n1:8 Parsing error: Unexpected token",
    );
  });

  test("declares the immutable package coordinate and only inventory-proven WebVOWL dependencies", () => {
    const manifest = readJson(PACKAGE_JSON_PATH);

    expect(manifest.dependencies?.owlapi).toBe(EXPECTED_PACKAGE_SPECIFIER);
    expect(manifest.devDependencies?.owlapi).toBeUndefined();
    expect(manifest.dependencies?.["@xmldom/xmldom"]).toBe(
      WEBVOWL_OWNED_XML_DEPENDENCY,
    );
    expect(
      OWLAPI_OWNED_ROOT_DEPENDENCIES.filter(
        (name) =>
          Object.hasOwn(manifest.dependencies ?? {}, name) ||
          Object.hasOwn(manifest.devDependencies ?? {}, name),
      ),
    ).toEqual([]);
  });

  test("locks the approved Git source and archive integrity for both consumers", () => {
    const lockfile = readJson(PACKAGE_LOCK_PATH);
    const rootPackage = lockfile.packages?.[""];
    const installedPackage = lockfile.packages?.["node_modules/owlapi"];

    expect(lockfile.lockfileVersion).toBe(3);
    expect(rootPackage?.dependencies?.owlapi).toBe(EXPECTED_PACKAGE_SPECIFIER);
    expect(installedPackage?.resolved).toBe(EXPECTED_RESOLUTION);
    expect(installedPackage?.integrity).toBe(EXPECTED_INTEGRITY);
    expect(installedPackage?.name).toBe("@hadden-industries/owlapi");
    expect(lockfile.packages?.["packages/vowl"]?.dependencies?.owlapi).toBe(
      EXPECTED_PACKAGE_SPECIFIER,
    );
    expect(
      Object.keys(lockfile.packages).filter((key) =>
        key.endsWith("node_modules/owlapi"),
      ),
    ).toEqual(["node_modules/owlapi"]);
    expect(installedPackage?.version).toBe(EXPECTED_PACKAGE_VERSION);
    expect(installedPackage?.link).toBeUndefined();
  });

  test("installed Git payload matches the independently packed producer commit", () => {
    expect(lstatSync(INSTALLED_PACKAGE_PATH).isSymbolicLink()).toBe(false);
    const inventory = packagePayload().sort(([left], [right]) =>
      left < right ? -1 : left > right ? 1 : 0,
    );
    expect(inventory).toHaveLength(114);
    expect(
      createHash("sha256").update(JSON.stringify(inventory)).digest("hex"),
    ).toBe(EXPECTED_PAYLOAD_SHA256);
  });

  test("observes the approved installed identity and public exports", () => {
    expect(existsSync(INSTALLED_PACKAGE_JSON_PATH)).toBe(true);
    const installedManifest = readJson(INSTALLED_PACKAGE_JSON_PATH);

    expect(installedManifest.name).toBe("@hadden-industries/owlapi");
    expect(installedManifest.version).toBe(EXPECTED_PACKAGE_VERSION);
    expect(installedManifest.exports).toEqual(EXPECTED_EXPORTS);
  });

  test("imports owlapi only through approved public package specifiers", () => {
    expect(boundedDiagnostics(importBoundaryViolations())).toEqual({
      count: 0,
      sample: [],
    });
  });

  test("contains no maintained package source or package-development utilities", () => {
    expect(boundedDiagnostics(packageDevelopmentMaterial())).toEqual({
      count: 0,
      sample: [],
    });
  });

  test("permits only the VOWL workspace and no OWLAPI resolver overrides", () => {
    const manifest = readJson(PACKAGE_JSON_PATH);
    const forbiddenKeys = PACKAGE_CONFIGURATION_KEYS.filter((key) =>
      Object.hasOwn(manifest, key),
    );
    const configurationMentions = CONFIGURATION_PATHS.filter((filePath) =>
      /\bowlapi(?:-js)?\b/iu.test(readFileSync(filePath, "utf8")),
    ).map(relative);

    expect(manifest.workspaces).toEqual(["packages/vowl"]);
    expect(
      readJson(path.join(ROOT, "packages", "vowl", "package.json")).name,
    ).toBe("vowl");
    expect(forbiddenKeys).toEqual([]);
    expect(hasUnexpectedOwlapiReference(manifest)).toBe(false);
    expect(configurationMentions).toEqual([]);
  });

  test("permits unrelated dependency overrides beside the approved OWLAPI coordinate", () => {
    expect(
      hasUnexpectedOwlapiReference({
        dependencies: { owlapi: EXPECTED_PACKAGE_SPECIFIER },
        overrides: { "development-tool": { "yaml-parser": "4.0.0" } },
      }),
    ).toBe(false);
  });

  test.each([
    ["direct", { owlapi: "file:../owlapi" }],
    ["scoped", { "@hadden-industries/owlapi": "1.0.0" }],
    ["version-qualified", { "owlapi@0.1.0-rc.1": "1.0.0" }],
    ["nested", { consumer: { owlapi: "file:../owlapi" } }],
    ["alias", { replacement: "npm:@hadden-industries/owlapi@1.0.0" }],
  ])("detects %s OWLAPI overrides", (_kind, overrides) => {
    expect(
      hasUnexpectedOwlapiReference({
        dependencies: { owlapi: EXPECTED_PACKAGE_SPECIFIER },
        overrides,
      }),
    ).toBe(true);
  });
});
