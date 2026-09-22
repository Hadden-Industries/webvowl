// SPDX-License-Identifier: AGPL-3.0-only
// Use Prettier's own ignore semantics instead of duplicating its rules in Python.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";
import { getFileInfo } from "prettier";

const root = resolve(process.argv[2]);
const candidates = JSON.parse(readFileSync(0, "utf8"));
const selected = [];
for (const candidate of candidates) {
  const file = resolve(root, candidate);
  const { ignored } = await getFileInfo(file, {
    ignorePath: [resolve(root, ".gitignore"), resolve(root, ".prettierignore")],
    resolveConfig: false,
  });
  if (!ignored) selected.push(file);
}
process.stdout.write(JSON.stringify(selected));
