import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { verifyCorpusPreservation } from "../scripts/verify-corpus-storage.mjs";

const source = "supplemental/field-contract/support.mjs";
const producer = "supplemental/accepted-protocol-v1/derive.mjs";
const accounting = "supplemental/mapping-counterexamples/field-accounting.json";
const archive =
  "supplemental/mapping-counterexamples/history/field-accounting.pre-storage.json";
const cleanup =
  "supplemental/mapping-counterexamples/source-pin-cleanup-v1.json";
const camera =
  "supplemental/accepted-protocol-v2/camera-corrections-manifest.json";
const fixture = "supplemental/field-contract/negative/control/source.json";
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const json = (value) => Buffer.from(JSON.stringify(value, null, 2) + "\n");
const pin = (path, bytes) => ({
  path,
  sha256: hash(bytes),
  byteLength: bytes.length,
});

function sample() {
  const before = new Map(),
    after = new Map();
  const oldSource = Buffer.from("old reader"),
    newSource = Buffer.from("new reader");
  const oldPin = pin(source, oldSource),
    newPin = pin(source, newSource);
  const oldAccounting = json({ source: oldPin });
  const historicalPin = { path: source, sha256: "0".repeat(64) };
  function cameras(sourcePin) {
    return {
      historicalPin,
      liveAccounting: pin(
        accounting,
        sourcePin === oldPin ? oldAccounting : json({ source: newPin }),
      ),
      records: Array.from({ length: 5 }, (_, id) => {
        const predecessorRecord = { id, source: sourcePin };
        return {
          historical: { predecessorRecord },
          replaces: { recordSha256: hash(json(predecessorRecord)) },
        };
      }),
    };
  }
  before.set(source, oldSource);
  before.set(producer, Buffer.from(`const pin = "${oldPin.sha256}";\n`));
  before.set(accounting, oldAccounting);
  before.set(
    cleanup,
    json({ current: { inventory: pin(accounting, oldAccounting) } }),
  );
  before.set(camera, json(cameras(oldPin)));
  before.set(fixture, json({ source: oldPin }));
  for (const [path, bytes] of before) {
    after.set(path, bytes);
  }
  after.set(source, newSource);
  after.set(producer, Buffer.from(`const pin = "${newPin.sha256}";\n`));
  after.set(accounting, json({ source: newPin }));
  after.set(archive, oldAccounting);
  after.set(
    cleanup,
    json({ current: { inventory: pin(archive, oldAccounting) } }),
  );
  after.set(camera, json(cameras(newPin)));
  const inventory = [...before].map(([path, bytes]) => pin(path, bytes));
  inventory.sort((a, b) => (a.path < b.path ? -1 : 1));
  const scope = {
    baselineCommit: "immutable-test-baseline",
    baselineCorpusFiles: before.size,
    baselineInventorySha256: hash(JSON.stringify(inventory)),
    artifacts: [{ path: fixture }],
  };
  return { before, after, scope, read: (path) => after.get(path) };
}

test("known pin updates preserve historical pins and all five camera records", () => {
  expect(verifyCorpusPreservation(sample())).toMatchObject({
    originalFiles: 6,
    byteIdenticalArtifacts: 1,
    checksumOnlyMetadata: 3,
  });
});

test("an arbitrary digest substitution in a producer is rejected", () => {
  const state = sample();
  state.after.set(producer, Buffer.from(`const pin = "${"f".repeat(64)}";\n`));
  expect(() => verifyCorpusPreservation(state)).toThrow(
    "Unexpected oracle code change",
  );
});

test("a fixture containing otherwise valid metadata pins cannot be refreshed", () => {
  const state = sample();
  state.after.set(fixture, json({ source: pin(source, state.read(source)) }));
  expect(() => verifyCorpusPreservation(state)).toThrow("Changed fixture");
});

test("live evidence cannot be redirected to the historical archive", () => {
  const state = sample(),
    value = JSON.parse(state.read(camera));
  value.liveAccounting = pin(archive, state.read(archive));
  state.after.set(camera, json(value));
  expect(() => verifyCorpusPreservation(state)).toThrow(
    "Non-checksum metadata change",
  );
});

test("the inventory must contain exactly the baseline fixture set", () => {
  const state = sample();
  state.scope.artifacts = [];
  expect(() => verifyCorpusPreservation(state)).toThrow(
    "Bundled inventory must match",
  );
});

test("a historical source pin cannot be refreshed to the current source", () => {
  const state = sample(),
    value = JSON.parse(state.read(camera));
  value.historicalPin.sha256 = hash(state.read(source));
  state.after.set(camera, json(value));
  expect(() => verifyCorpusPreservation(state)).toThrow(
    "Non-checksum metadata change",
  );
});

test("a camera record digest cannot change independently of its predecessor", () => {
  const state = sample(),
    value = JSON.parse(state.read(camera));
  value.records[0].replaces.recordSha256 = "f".repeat(64);
  state.after.set(camera, json(value));
  expect(() => verifyCorpusPreservation(state)).toThrow(
    "Non-checksum metadata change",
  );
});
