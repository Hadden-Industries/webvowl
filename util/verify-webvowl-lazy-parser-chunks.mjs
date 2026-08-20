import { readdir, readFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const javascriptDirectory = resolve(repositoryRoot, "deploy/js");
const entryPath = resolve(javascriptDirectory, "index.js");
const n3ImplementationMarker = '"./N3Lexer"';
const utf8Encoder = new TextEncoder();

const sourceByPath = new Map();

function localJavaScriptPath(importerPath, specifier) {
  if (!specifier.startsWith(".")) {
    return null;
  }

  const cleanSpecifier = specifier.replace(/[?#].*$/u, "");
  const importedPath = resolve(dirname(importerPath), cleanSpecifier);
  const relativePath = relative(javascriptDirectory, importedPath);
  if (relativePath.startsWith("..") || isAbsolute(relativePath)) {
    throw new Error(
      `Built JavaScript import escapes deploy/js: ${specifier} from ${importerPath}`,
    );
  }
  return importedPath;
}

async function sourceFor(filePath) {
  if (!sourceByPath.has(filePath)) {
    sourceByPath.set(filePath, await readFile(filePath, "utf8"));
  }
  return sourceByPath.get(filePath);
}

function staticImportSpecifiers(source) {
  const specifiers = [];
  const importPattern =
    /\bimport(?!\s*\()\s*(?:[^;"']*?\bfrom\s*)?["']([^"']+)["']/gu;
  const exportPattern = /\bexport\s+(?:[^;"']*?\bfrom\s*)["']([^"']+)["']/gu;

  for (const pattern of [importPattern, exportPattern]) {
    for (const match of source.matchAll(pattern)) {
      specifiers.push(match[1]);
    }
  }
  return specifiers;
}

function dynamicImportSpecifiers(source) {
  return [...source.matchAll(/\bimport\s*\(\s*(["'`])([^"'`]+)\1\s*\)/gu)].map(
    (match) => match[2],
  );
}

async function staticClosure(rootPaths) {
  const pending = [...rootPaths];
  const closure = new Set();

  while (pending.length > 0) {
    const filePath = pending.pop();
    if (closure.has(filePath)) {
      continue;
    }
    closure.add(filePath);

    const source = await sourceFor(filePath);
    for (const specifier of staticImportSpecifiers(source)) {
      const importedPath = localJavaScriptPath(filePath, specifier);
      if (importedPath !== null) {
        pending.push(importedPath);
      }
    }
  }

  return closure;
}

function displayPath(filePath) {
  return relative(repositoryRoot, filePath).replaceAll("\\", "/");
}

async function bundleMetrics(filePaths) {
  let gzipBytes = 0;
  let minifiedBytes = 0;

  for (const filePath of filePaths) {
    const source = await sourceFor(filePath);
    minifiedBytes += utf8Encoder.encode(source).byteLength;
    gzipBytes += gzipSync(source).byteLength;
  }

  return { gzipBytes, minifiedBytes };
}

const builtFiles = (await readdir(javascriptDirectory, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && entry.name.endsWith(".js"))
  .map((entry) => resolve(javascriptDirectory, entry.name));

const initialClosure = await staticClosure([entryPath]);
const eagerN3Files = [];
for (const filePath of initialClosure) {
  if ((await sourceFor(filePath)).includes(n3ImplementationMarker)) {
    eagerN3Files.push(displayPath(filePath));
  }
}

if (eagerN3Files.length > 0) {
  throw new Error(
    `N3.js is present in the application's initial static import closure: ${eagerN3Files.join(", ")}`,
  );
}

const dynamicRoots = new Set();
for (const filePath of initialClosure) {
  const source = await sourceFor(filePath);
  for (const specifier of dynamicImportSpecifiers(source)) {
    const importedPath = localJavaScriptPath(filePath, specifier);
    if (importedPath !== null) {
      dynamicRoots.add(importedPath);
    }
  }
}

const lazyN3Files = new Set();
const lazyN3Closure = new Set();
for (const dynamicRoot of dynamicRoots) {
  const lazyClosure = await staticClosure([dynamicRoot]);
  let containsN3 = false;
  for (const filePath of lazyClosure) {
    if ((await sourceFor(filePath)).includes(n3ImplementationMarker)) {
      lazyN3Files.add(displayPath(filePath));
      containsN3 = true;
    }
  }
  if (containsN3) {
    for (const filePath of lazyClosure) {
      lazyN3Closure.add(filePath);
    }
  }
}

if (lazyN3Files.size === 0) {
  const markerFiles = [];
  for (const filePath of builtFiles) {
    if ((await sourceFor(filePath)).includes(n3ImplementationMarker)) {
      markerFiles.push(displayPath(filePath));
    }
  }
  throw new Error(
    markerFiles.length === 0
      ? "The production build contains no recognizable N3.js implementation."
      : `N3.js is not reachable through a lazy import boundary: ${markerFiles.join(", ")}`,
  );
}

const initialMetrics = await bundleMetrics(initialClosure);
const lazyN3Metrics = await bundleMetrics(lazyN3Closure);
const initialFiles = [...initialClosure].map(displayPath).sort();
const lazyN3ClosureFiles = [...lazyN3Closure].map(displayPath).sort();

console.log(
  [
    `PASS: N3.js is absent from ${initialClosure.size} initial chunk(s) and present only behind the Turtle lazy boundary.`,
    `Initial closure: ${initialMetrics.minifiedBytes} minified bytes / ${initialMetrics.gzipBytes} gzip bytes (${initialFiles.join(", ")}).`,
    `Lazy Turtle closure: ${lazyN3Metrics.minifiedBytes} minified bytes / ${lazyN3Metrics.gzipBytes} gzip bytes (${lazyN3ClosureFiles.join(", ")}).`,
  ].join("\n"),
);
