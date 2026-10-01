import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { profileSchema } from "../src/modelContract.js";
import { profiles } from "../src/profiles.js";
import { legacySchema } from "../src/migrate/grammar.js";

// These are generated schema artifacts, never expected canonical byte fixtures.
const directory = new URL("../schema/", import.meta.url);
await mkdir(directory, { recursive: true });
for (const [name, profile] of [
  ["structural-content", profiles.structuralContent],
  ["artifact", profiles.artifact],
]) {
  await writeFile(
    fileURLToPath(new URL(`${name}.schema.json`, directory)),
    JSON.stringify(profileSchema(profile), null, 2) + "\n",
  );
}
await writeFile(
  fileURLToPath(new URL("legacy-354ed3af.schema.json", directory)),
  JSON.stringify(legacySchema, null, 2) + "\n",
);
