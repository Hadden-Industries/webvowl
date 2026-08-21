import { execFile } from "node:child_process";
import { createWriteStream } from "node:fs";
import { stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import { ZipArchive } from "archiver";

const execFileAsync = promisify(execFile);

export const buildArchiveName = (branch, shortSha) => {
  const sanitizedBranch = branch.replaceAll(/[\\/]/gu, "-");
  return `webvowl-${sanitizedBranch}-${shortSha}.zip`;
};

export const createZipArchive = async ({ outputPath, sourceDirectory }) => {
  let source;
  try {
    source = await stat(sourceDirectory);
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new Error(`Deploy directory not found at ${sourceDirectory}`, {
        cause: error,
      });
    }
    throw error;
  }

  if (!source.isDirectory()) {
    throw new Error(`Deploy directory not found at ${sourceDirectory}`);
  }

  const output = createWriteStream(outputPath);
  const archive = new ZipArchive({ zlib: { level: 9 } });
  const completed = new Promise((resolve, reject) => {
    output.once("close", resolve);
    output.once("error", reject);
    archive.once("error", reject);
    archive.on("warning", (error) => {
      if (error.code === "ENOENT") {
        console.warn("Warning:", error);
      } else {
        reject(error);
      }
    });
  });

  archive.pipe(output);
  archive.directory(sourceDirectory, "webvowl");

  try {
    await Promise.all([archive.finalize(), completed]);
  } catch (error) {
    archive.abort();
    output.destroy();
    throw error;
  }

  return archive.pointer();
};

export const readGitMetadata = async (repository) => {
  const options = { cwd: repository, encoding: "utf8" };
  const [branchResult, shortShaResult] = await Promise.all([
    execFileAsync("git", ["rev-parse", "--abbrev-ref", "HEAD"], options),
    execFileAsync("git", ["rev-parse", "--short", "HEAD"], options),
  ]);

  return {
    branch: branchResult.stdout.trim(),
    shortSha: shortShaResult.stdout.trim(),
  };
};

export const createProjectArchive = async (repository) => {
  const { branch, shortSha } = await readGitMetadata(repository);
  const archiveName = buildArchiveName(branch, shortSha);
  const outputPath = join(repository, archiveName);
  const sourceDirectory = join(repository, "deploy");
  const byteCount = await createZipArchive({ outputPath, sourceDirectory });

  return { archiveName, byteCount, outputPath };
};

const scriptPath = fileURLToPath(import.meta.url);

if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
  const repository = resolve(dirname(scriptPath), "..");

  createProjectArchive(repository)
    .then(({ archiveName, byteCount }) => {
      console.log(
        `Archive created successfully: ${archiveName} (${byteCount} total bytes)`,
      );
    })
    .catch((error) => {
      console.error("Error creating zip archive:", error.message);
      process.exitCode = 1;
    });
}
