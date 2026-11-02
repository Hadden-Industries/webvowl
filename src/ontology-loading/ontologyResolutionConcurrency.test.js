import { readFileSync } from "node:fs";
import {
  verifyOntologyResolution,
  ontologyCachePaths,
} from "./ontologyResolutionEvidence.js";

const fixtures = JSON.parse(
  readFileSync(
    new URL("./contracts/fixtures/protocol-cases.v1.json", import.meta.url),
    "utf8",
  ),
);
const example = (id) =>
  structuredClone(
    [...fixtures.schemaExamples, ...fixtures.semanticExamples].find(
      (entry) => entry.id === id,
    ).value,
  );
const resolution = example("A-resolution");
const paths = ontologyCachePaths(fixtures.serviceOrigin);
const records = new Map([
  [paths.resolution(resolution.resolutionIdentity), resolution],
  [paths.version(resolution.sourceVersionIdentity), example("A-version")],
  [resolution.validationIri, example("A-validation")],
  [resolution.loaderPolicyIri, example("loader-policy")],
]);
function verify(readJson) {
  return verifyOntologyResolution({
    requestedDocumentIri: resolution.requestedDocumentIri,
    resolutionIdentity: resolution.resolutionIdentity,
    paths,
    approvedPolicyFingerprints: [resolution.loaderProfileFingerprint],
    readJson,
  });
}
test("all independent evidence reads start before the first completes, but all remain required", async () => {
  const waiting = new Map();
  let finished = false;
  let draining = false;
  let started;
  const firstMetadataRead = new Promise((resolve) => {
    started = resolve;
  });
  const result = verify(async (url) => {
    if (url === paths.resolution(resolution.resolutionIdentity) || draining) {
      return structuredClone(records.get(url));
    }
    return new Promise((resolve) => {
      waiting.set(url, resolve);
      started();
    });
  });
  const observed = result.then(() => {
    finished = true;
  });
  await firstMetadataRead;
  try {
    expect([...waiting.keys()].sort()).toEqual(
      [...records.keys()]
        .filter(
          (url) => url !== paths.resolution(resolution.resolutionIdentity),
        )
        .sort(),
    );
    for (const [url, resolve] of waiting) {
      expect(finished).toBe(false);
      resolve(structuredClone(records.get(url)));
      await new Promise(setImmediate);
    }
    await observed;
    expect(finished).toBe(true);
  } finally {
    draining = true;
    for (const [url, resolve] of waiting) {
      resolve(structuredClone(records.get(url)));
    }
    await observed;
  }
});
test("a version failure preserves its error when another concurrent read also rejects", async () => {
  const first = new Error("version failure");
  const second = new Error("policy failure");
  await expect(
    verify(async (url) => {
      if (url === paths.version(resolution.sourceVersionIdentity)) {
        await new Promise(setImmediate);
        throw first;
      }
      if (url === resolution.loaderPolicyIri) {
        throw second;
      }
      return structuredClone(records.get(url));
    }),
  ).rejects.toBe(first);
  await new Promise(setImmediate);
});
test("an unsupported resolution policy cannot start the independent reads", async () => {
  const calls = [];
  await expect(
    verifyOntologyResolution({
      requestedDocumentIri: resolution.requestedDocumentIri,
      resolutionIdentity: resolution.resolutionIdentity,
      paths,
      approvedPolicyFingerprints: [],
      readJson: async (url) => {
        calls.push(url);
        return structuredClone(records.get(url));
      },
    }),
  ).rejects.toMatchObject({ code: "CACHE_POLICY_UNSUPPORTED" });
  expect(calls).toEqual([paths.resolution(resolution.resolutionIdentity)]);
});
