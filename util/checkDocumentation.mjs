import { execFileSync, spawnSync } from "node:child_process";
import { lstatSync, readFileSync } from "node:fs";
import { resolve, relative, isAbsolute } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { check, getFileInfo, resolveConfig } from "prettier";
import { isDocumentation, selectFromEnvironment } from "./selectCiChecks.mjs";

const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));

export async function checkPrettierDocuments({ root = repositoryRoot, paths }) {
  const documents = [];
  let passed = true;
  for (const path of paths) {
    const absolute = resolve(root, path);
    const inside = relative(root, absolute);
    if (
      !isDocumentation(path) ||
      inside.startsWith("..") ||
      isAbsolute(inside)
    ) {
      throw new Error(`Not an authored document: ${path}`);
    }
    if (!lstatSync(absolute).isFile() || lstatSync(absolute).isSymbolicLink())
      continue;
    const { ignored } = await getFileInfo(absolute, {
      ignorePath: [
        resolve(root, ".gitignore"),
        resolve(root, ".prettierignore"),
      ],
      resolveConfig: false,
    });
    if (ignored) continue;
    documents.push(path);
    if (
      !(await check(readFileSync(absolute, "utf8"), {
        ...(await resolveConfig(absolute)),
        filepath: absolute,
      }))
    ) {
      process.stderr.write(`Prettier would reformat: ${path}\n`);
      passed = false;
    }
  }
  return { passed, documents };
}

async function main() {
  const selection = selectFromEnvironment();
  const paths =
    selection.documents ??
    execFileSync("git", ["ls-files", "-z"], {
      cwd: repositoryRoot,
      encoding: "utf8",
      windowsHide: true,
      maxBuffer: 16 * 1024 * 1024,
    })
      .split("\0")
      .filter(isDocumentation);
  const { passed, documents } = await checkPrettierDocuments({ paths });
  if (!passed) return 1;
  if (!documents.length) {
    process.stdout.write("No changed authored Markdown documents to check.\n");
    return 0;
  }
  // JSON on stdin preserves literal filenames and does not expose paths to a
  // shell, glob parser, command-line option parser or GitHub output protocol.
  const result = spawnSync(
    process.execPath,
    [
      "util/runRepositoryPython.mjs",
      "tooling/prose/format_docs.py",
      "--check",
      "--files-from-stdin",
    ],
    {
      cwd: repositoryRoot,
      input: JSON.stringify(documents),
      encoding: "utf8",
      stdio: ["pipe", "inherit", "inherit"],
      windowsHide: true,
    },
  );
  if (result.error) throw result.error;
  return result.status ?? 1;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    process.exitCode = await main();
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
