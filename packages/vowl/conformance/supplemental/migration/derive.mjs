// SPDX-License-Identifier: AGPL-3.0-only
// Independent producer: imports no product migration or core implementation.
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import process from "node:process";
import { produce } from "../amended-policy/producer.mjs";
import { migrationCases } from "./cases.mjs";
import { compactInput, inputText } from "./compact.mjs";
import { describeBlob, historicalPaths } from "./historical.mjs";
import {
  authorities,
  dependencies,
  dialect,
  hash,
  json,
  localPin,
  migrationAuthorities,
  pin,
  specificationRevision,
} from "./support.mjs";

await authorities();
const authored = await migrationCases();
const seeds = Object.fromEntries(
  Object.entries(authored.exports).map(([id, value]) => [
    id,
    JSON.parse(inputText(value)),
  ]),
);
const expected = {};
const expectedBySource = new Map();
const vectors = [];
for (const fixture of authored.cases) {
  const input = JSON.parse(fixture.inputText);
  assert.equal(inputText(input), fixture.inputText, fixture.id);
  const vector = {
    id: fixture.id,
    input: {
      ...compactInput(input, seeds),
      encoding: "UTF-8",
      byteLength: Buffer.byteLength(fixture.inputText),
      sha256: hash(fixture.inputText),
    },
    dialect: fixture.dialect ?? dialect,
    profile: fixture.profile,
    resolutions: fixture.resolutions,
    outcome: fixture.outcome,
    rules: fixture.rules,
    rationale: fixture.rationale,
    origin: fixture.origin,
  };
  if (fixture.outcome === "success") {
    const sourceKey = hash(
      `${fixture.profile}\n${json(fixture.expectedSource)}`,
    );
    const existing = expectedBySource.get(sourceKey);
    if (existing) {
      vector.expected = existing;
      vector.diagnostics = fixture.diagnostics ?? [];
      vectors.push(vector);
      continue;
    }
    const output = await produce(fixture.expectedSource, fixture.profile);
    expected[fixture.id] = {
      source: fixture.expectedSource,
      mappedDefaultGraphNQuads: output.mappedNQuads,
      canonicalNQuads: output.canonicalNQuads,
      primaryCorrespondence: output.correspondence,
      canonicalBytes: {
        encoding: "UTF-8",
        text: output.bytes.toString("utf8"),
        byteLength: output.bytes.length,
        sha256: hash(output.bytes),
      },
      counts: {
        primary: output.correspondence.length,
        blankNodes: output.blankNodeCount,
        quads: output.quadCount,
      },
    };
    vector.expected = fixture.id;
    expectedBySource.set(sourceKey, fixture.id);
    vector.diagnostics = fixture.diagnostics ?? [];
  } else {
    assert.equal(fixture.outcome, "error");
    vector.errorCode = fixture.errorCode;
  }
  vectors.push(vector);
}
assert.equal(new Set(vectors.map((vector) => vector.id)).size, vectors.length);
const expectedBundle = await pin(
  "expected-successes.json",
  json({
    format: "independent-canonical-vowl-migration-successes-v1",
    artifacts: expected,
  }),
);
const manifest = {
  format: "independent-canonical-vowl-migration-corpus-v1",
  scope:
    "Bounded independently transcribed A9.3 witnesses for one pinned historical dialect; no claim to reconstruct facts the historical exporter omitted or to qualify every possible pass-through document.",
  specificationRevision,
  migrationAuthorities,
  independentDependencies: dependencies,
  historicalEvidence: authored.evidence,
  historicalSources: historicalPaths.map(describeBlob),
  producerSources: await Promise.all(
    [
      "support.mjs",
      "historical.mjs",
      "cases.mjs",
      "artifact-cases.mjs",
      "compact.mjs",
      "derive.mjs",
    ].map(localPin),
  ),
  verifierSources: [await localPin("verify.mjs")],
  inputRepresentation: {
    kind: "shared-json-seed-and-patches",
    patchOperations: ["add", "remove", "replace"],
    pointerEscaping: "RFC 6901",
    serialization:
      "Preserve stored array order, recursively sort object field names in unsigned UTF-16 order, then JSON.stringify(value,null,2), without a trailing newline. Derivation checks byte equality with the pinned historical serializer for every vector.",
  },
  diagnosticPolicy:
    "Require each independently listed code and exact source location, plus a resolved-field diagnostic for every supplied resolution. English prose and unspecified diagnostic cardinality are not goldens. The entire returned envelope must be deeply frozen.",
  seeds,
  expectedBundle,
  vectors,
};
const receipt = await pin("manifest.json", json(manifest));
console.log(
  JSON.stringify({
    vectors: vectors.length,
    successes: vectors.filter((vector) => vector.outcome === "success").length,
    uniqueExpectedArtifacts: Object.keys(expected).length,
    rejections: vectors.filter((vector) => vector.outcome === "error").length,
    sharedSeeds: Object.keys(seeds).length,
    manifest: receipt,
    writes: process.argv.includes("--write-new") ? "new-only" : "none",
  }),
);
