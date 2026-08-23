import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const GOOGLE_FONT_ORIGIN = /https:\/\/fonts\.(?:googleapis|gstatic)\.com/;
const TEXT_ASSET_EXTENSION = /\.(?:css|html|js)$/;
const projectDirectory = fileURLToPath(new URL("../../..", import.meta.url));

function collectFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? collectFiles(entryPath) : [entryPath];
  });
}

describe("production font delivery", () => {
  let outputDirectory;
  let outputFiles;

  beforeAll(async () => {
    outputDirectory = fs.mkdtempSync(
      path.join(os.tmpdir(), "webvowl-font-build-"),
    );

    execFileSync(
      process.execPath,
      [
        path.join(projectDirectory, "node_modules", "vite", "bin", "vite.js"),
        "build",
        "--mode",
        "production",
        "--outDir",
        outputDirectory,
        "--emptyOutDir",
        "--logLevel",
        "silent",
      ],
      { cwd: projectDirectory, stdio: "pipe" },
    );

    outputFiles = collectFiles(outputDirectory);
  }, 120_000);

  afterAll(() => {
    fs.rmSync(outputDirectory, { force: true, recursive: true });
  });

  test("ships Open Sans as licensed same-origin WOFF2 assets", () => {
    const textAssets = outputFiles
      .filter((filePath) => TEXT_ASSET_EXTENSION.test(filePath))
      .map((filePath) => fs.readFileSync(filePath, "utf8"));

    expect(textAssets.join("\n")).not.toMatch(GOOGLE_FONT_ORIGIN);

    const cssFiles = outputFiles.filter((filePath) =>
      filePath.endsWith(".css"),
    );
    const openSansCssFile = cssFiles.find((filePath) =>
      fs.readFileSync(filePath, "utf8").includes("Open Sans"),
    );

    expect(openSansCssFile).toBeDefined();

    const stylesheet = fs.readFileSync(openSansCssFile, "utf8");
    const fontReferences = [
      ...stylesheet.matchAll(/url\(["']?([^"')]+\.woff2)["']?\)/g),
    ].map((match) => match[1]);
    const openSansRules = [
      ...stylesheet.matchAll(
        /@font-face\{[^}]*font-family:(?:["']Open Sans["']|Open Sans)[^}]*\}/g,
      ),
    ].map((match) => match[0]);

    expect(stylesheet).toMatch(/font-display:\s*swap/);
    expect(fontReferences.length).toBeGreaterThan(0);
    expect(fontReferences).toHaveLength(openSansRules.length);
    expect(openSansRules.join("\n")).not.toContain("url(data:");

    fontReferences.forEach((fontReference) => {
      const fontPath = path.resolve(
        path.dirname(openSansCssFile),
        decodeURIComponent(fontReference),
      );
      const font = fs.readFileSync(fontPath);

      expect(font.subarray(0, 4).toString("ascii")).toBe("wOF2");
    });

    const licensePath = path.join(
      outputDirectory,
      "licenses",
      "open-sans",
      "OFL.txt",
    );
    const relativeOutputFiles = outputFiles.map((filePath) =>
      path.relative(outputDirectory, filePath),
    );

    expect(relativeOutputFiles).toContain(
      path.join("licenses", "open-sans", "OFL.txt"),
    );

    const license = fs.readFileSync(licensePath, "utf8");

    expect(license).toContain("SIL OPEN FONT LICENSE Version 1.1");
  });
});
