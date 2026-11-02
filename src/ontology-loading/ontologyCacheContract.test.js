import { readFileSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { relative, join } from "node:path";
import { fileURLToPath } from "node:url";
import canonicalize from "canonicalize";
import Ajv2020 from "ajv/dist/2020.js";
import { validateOntologyCacheRecord } from "./ontologyResolutionEvidence.js";
import {
  PROVIDER_BUNDLE,
  acquiredContractMembers,
  readOntologyCacheContract,
} from "../../util/acquireOntologyCacheContract.mjs";

const directory = new URL("./contracts/", import.meta.url);
const read = (name) => readFileSync(new URL(name, directory));
const manifest = JSON.parse(read("contract-manifest.v1.json"));

test("acquired provider data agrees with the exact immutable contract bundle", () => {
  const { contractId, version, files } = manifest;
  const digest = createHash("sha256")
    .update(
      "hadden-ontology-cache/contract-bundle/v1\n" +
        canonicalize({ contractId, version, files }),
    )
    .digest("hex");
  expect(digest).toBe(PROVIDER_BUNDLE);
  expect(manifest.bundleSha256).toBe(PROVIDER_BUNDLE);
  const selected = acquiredContractMembers(manifest);
  const actual = readdirSync(directory, {
    recursive: true,
    withFileTypes: true,
  })
    .filter((entry) => entry.isFile())
    .map((entry) =>
      relative(
        fileURLToPath(directory),
        join(entry.parentPath, entry.name),
      ).replaceAll("\\", "/"),
    );
  const expected = [
    "contract-manifest.v1.json",
    ...selected.map((entry) => entry.path),
  ];
  expect(actual.sort()).toEqual(expected.sort());
  for (const entry of selected) {
    const bytes = read(entry.path);
    expect(bytes.length).toBe(entry.byteLength);
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(entry.sha256);
  }
});

test("contract acquisition rejects a stale bundle, tampered member and incomplete read before delivery", () => {
  expect(readOntologyCacheContract(read).size).toBe(
    acquiredContractMembers(manifest).length + 1,
  );
  expect(() =>
    readOntologyCacheContract((name) =>
      name === "contract-manifest.v1.json"
        ? Buffer.from(
            JSON.stringify({ ...manifest, bundleSha256: "0".repeat(64) }),
          )
        : read(name),
    ),
  ).toThrow("bundle identity changed");
  expect(() =>
    readOntologyCacheContract((name) =>
      name.endsWith("ontology-archive-capture.v1.schema.json")
        ? Buffer.concat([read(name), Buffer.from(" ")])
        : read(name),
    ),
  ).toThrow("Provider manifest mismatch");
  expect(() =>
    readOntologyCacheContract((name) => {
      if (name.endsWith("ontology-archive-capture.v1.schema.json")) {
        throw new Error("Missing pinned member");
      }
      return read(name);
    }),
  ).toThrow("Missing pinned member");
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
  ajv.addKeyword({ keyword: "$anchor", schemaType: "string" });
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
