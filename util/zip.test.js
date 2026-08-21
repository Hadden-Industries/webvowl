import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import {
  buildArchiveName,
  createProjectArchive,
  createZipArchive,
  readGitMetadata,
} from "./zip.mjs";

const execFileAsync = promisify(execFile);

describe("buildArchiveName", () => {
  it("creates a filesystem-safe name from the branch and commit", () => {
    expect(buildArchiveName("feature/topic\\windows", "a1b2c3d")).toBe(
      "webvowl-feature-topic-windows-a1b2c3d.zip",
    );
  });
});

describe("createZipArchive", () => {
  it("writes the source directory beneath the webvowl archive root", async () => {
    const temporaryDirectory = await mkdtemp(join(tmpdir(), "webvowl-zip-"));
    const sourceDirectory = join(temporaryDirectory, "deploy");
    const outputPath = join(temporaryDirectory, "output.zip");

    try {
      await mkdir(sourceDirectory);
      await writeFile(join(sourceDirectory, "example.txt"), "example content");

      const byteCount = await createZipArchive({ outputPath, sourceDirectory });
      const zip = await readFile(outputPath);

      expect(byteCount).toBe(zip.byteLength);
      expect(zip.subarray(0, 2).toString()).toBe("PK");
      expect(zip.includes(Buffer.from("webvowl/example.txt"))).toBe(true);
    } finally {
      await rm(temporaryDirectory, { force: true, recursive: true });
    }
  });

  it("rejects with the missing deploy directory path", async () => {
    const temporaryDirectory = await mkdtemp(join(tmpdir(), "webvowl-zip-"));
    const sourceDirectory = join(temporaryDirectory, "missing-deploy");

    try {
      await expect(
        createZipArchive({
          outputPath: join(temporaryDirectory, "output.zip"),
          sourceDirectory,
        }),
      ).rejects.toThrow(`Deploy directory not found at ${sourceDirectory}`);
    } finally {
      await rm(temporaryDirectory, { force: true, recursive: true });
    }
  });
});

describe("readGitMetadata", () => {
  it("reads the current branch and abbreviated commit without shell output", async () => {
    const repository = await mkdtemp(join(tmpdir(), "webvowl-git-"));

    try {
      await execFileAsync("git", ["init"], { cwd: repository });
      await writeFile(join(repository, "tracked.txt"), "tracked content");
      await execFileAsync("git", ["add", "tracked.txt"], { cwd: repository });
      await execFileAsync(
        "git",
        [
          "-c",
          "user.name=WebVOWL Test",
          "-c",
          "user.email=webvowl@example.invalid",
          "-c",
          "commit.gpgsign=false",
          "commit",
          "-m",
          "initial commit",
        ],
        { cwd: repository },
      );
      await execFileAsync("git", ["branch", "-M", "feature/test"], {
        cwd: repository,
      });

      const metadata = await readGitMetadata(repository);

      expect(metadata.branch).toBe("feature/test");
      expect(metadata.shortSha).toMatch(/^[a-f\d]{7}$/u);
    } finally {
      await rm(repository, { force: true, recursive: true });
    }
  });
});

describe("createProjectArchive", () => {
  it("creates the named deployment archive at the repository root", async () => {
    const repository = await mkdtemp(join(tmpdir(), "webvowl-project-"));

    try {
      await execFileAsync("git", ["init"], { cwd: repository });
      await mkdir(join(repository, "deploy"));
      await writeFile(join(repository, "deploy", "index.html"), "WebVOWL");
      await execFileAsync("git", ["add", "deploy/index.html"], {
        cwd: repository,
      });
      await execFileAsync(
        "git",
        [
          "-c",
          "user.name=WebVOWL Test",
          "-c",
          "user.email=webvowl@example.invalid",
          "-c",
          "commit.gpgsign=false",
          "commit",
          "-m",
          "initial commit",
        ],
        { cwd: repository },
      );
      await execFileAsync("git", ["branch", "-M", "release/test"], {
        cwd: repository,
      });

      const result = await createProjectArchive(repository);
      const zip = await readFile(result.outputPath);

      expect(result.archiveName).toMatch(
        /^webvowl-release-test-[a-f\d]{7}\.zip$/u,
      );
      expect(result.outputPath).toBe(join(repository, result.archiveName));
      expect(result.byteCount).toBe(zip.byteLength);
      expect(zip.includes(Buffer.from("webvowl/index.html"))).toBe(true);
    } finally {
      await rm(repository, { force: true, recursive: true });
    }
  });
});
