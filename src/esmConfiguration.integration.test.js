import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

import { expect, test } from "@jest/globals";

const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));
const packagePath = fileURLToPath(new URL("../package.json", import.meta.url));
const eslintConfigurationUrl = pathToFileURL(
  fileURLToPath(new URL("../eslint.config.js", import.meta.url)),
).href;

test("the repository and ESLint configuration load as explicit ES modules", () => {
  const verificationSource = `
    import assert from "node:assert/strict";
    import { readFile } from "node:fs/promises";

    const packageMetadata = JSON.parse(
      await readFile(${JSON.stringify(packagePath)}, "utf8"),
    );
    assert.equal(packageMetadata.type, "module");

    const configurationModule = await import(
      ${JSON.stringify(eslintConfigurationUrl)}
    );
    assert(Array.isArray(configurationModule.default));
    assert(configurationModule.default.length > 0);
  `;

  const output = execFileSync(
    process.execPath,
    ["--input-type=module", "--eval", verificationSource],
    {
      cwd: repositoryRoot,
      encoding: "utf8",
      windowsHide: true,
    },
  );

  expect(output).toBe("");
});
