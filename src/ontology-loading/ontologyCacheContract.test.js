import { readFileSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import canonicalize from "canonicalize";
import Ajv2020 from "ajv/dist/2020.js";
import { validateOntologyCacheRecord } from "./ontologyResolutionEvidence.js";

const directory = new URL("./contracts/", import.meta.url);
const read = (name) => readFileSync(new URL(name, directory));
const manifest = JSON.parse(read("contract-manifest.v1.json"));

test("acquired provider data agrees with the exact published contract bundle", () => {
  const { contractId, version, files } = manifest;
  const digest = createHash("sha256")
    .update(
      "hadden-ontology-cache/contract-bundle/v1\n" +
        canonicalize({ contractId, version, files }),
    )
    .digest("hex");
  expect(digest).toBe(
    "871239081809f846d8c0b3ef12f0f0e82cdc3681958e7024c5c57fed87babd75",
  );
  for (const entry of files.filter(
    ({ path }) =>
      path.endsWith(".schema.json") ||
      [
        "error-codes.v1.json",
        "fixtures/identity-vectors.v1.json",
        "fixtures/protocol-cases.v1.json",
      ].includes(path),
  )) {
    const bytes = read(entry.path);
    expect(bytes.length).toBe(entry.byteLength);
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(entry.sha256);
  }
});

test("generated browser validators reproduce their authoritative source schemas", () => {
  execFileSync(
    process.execPath,
    ["util/generateOntologyCacheValidators.mjs", "--check"],
    { cwd: new URL("../../", import.meta.url), timeout: 30000, stdio: "pipe" },
  );
});

test("native schemas and generated browser validators retain the provider's positive and negative fixtures", () => {
  const ajv = new Ajv2020({ strict: true, validateFormats: false });
  for (const name of readdirSync(directory).filter((name) =>
    name.endsWith(".schema.json"),
  )) {
    ajv.addSchema(JSON.parse(read(name)));
  }
  const kinds = {
    "ontology-resolution": "resolution",
    "ontology-source-pointer": "pointer",
    "ontology-source-version": "version",
    "ontology-validation": "validation",
    "ontology-loader-policy": "policy",
    "ontology-materialization-status": "materialization",
    "ontology-refresh-result": "refresh",
    "ontology-materialization-error": "error",
  };
  for (const example of JSON.parse(read("fixtures/protocol-cases.v1.json"))
    .schemaExamples) {
    const validate = ajv.getSchema(
      `https://haddenindustries.com/ontology/contracts/v1/${example.schema}`,
    );
    expect(Boolean(validate(example.value))).toBe(example.expectedSchemaValid);
    const kind = kinds[example.schema.replace(".v1.schema.json", "")];
    if (kind) {
      if (example.expectedSchemaValid) {
        expect(() =>
          validateOntologyCacheRecord(kind, example.value),
        ).not.toThrow();
      } else {
        expect(() =>
          validateOntologyCacheRecord(kind, example.value),
        ).toThrow();
      }
    }
  }
});
