import {
  createOwnedWorkerResult,
  readOwnedWorkerResult,
} from "./canonicalVowlWorkerResultOwnership.js";

function receiverResult() {
  return {
    inspection: { revision: 0, documents: [{ documentIri: "urn:original" }] },
    checkpoint: { revision: 0, source: { bytes: new Uint8Array([1, 2, 3]) } },
  };
}

test("an unexposed receiver value is shared privately while public reads own independent mutable copies", () => {
  const received = receiverResult();
  const result = createOwnedWorkerResult(received, { loadGeneration: 4 });
  expect(readOwnedWorkerResult(result)).toBe(received);
  expect(result.loadGeneration).toBe(4);
  const inspection = result.inspection;
  expect(readOwnedWorkerResult(result)).toBeUndefined();
  inspection.documents[0].documentIri = "urn:changed";
  result.checkpoint.source.bytes.fill(0);
  expect(result.inspection).toBe(inspection);
  expect(received.inspection.documents[0].documentIri).toBe("urn:original");
  expect(Array.from(received.checkpoint.source.bytes)).toEqual([1, 2, 3]);
});

test.each(["replace", "delete", "redefine"])(
  "public %s disables private borrowing instead of ignoring the caller's change",
  (operation) => {
    const received = receiverResult();
    const result = createOwnedWorkerResult(received, {});
    const replacement = { revision: 5 };
    if (operation === "replace") {
      result.checkpoint = replacement;
    }
    if (operation === "delete") {
      delete result.checkpoint;
    }
    if (operation === "redefine") {
      Object.defineProperty(result, "checkpoint", { value: replacement });
    }
    expect(readOwnedWorkerResult(result)).toBeUndefined();
    expect(result.checkpoint).toBe(
      operation === "delete" ? undefined : replacement,
    );
    expect(received.checkpoint.revision).toBe(0);
  },
);

test("a serialized or copied marker cannot transfer private ownership", () => {
  const received = receiverResult();
  const result = createOwnedWorkerResult(received, {});
  expect(readOwnedWorkerResult({ ...result })).toBeUndefined();
  expect(readOwnedWorkerResult(structuredClone(result))).toBeUndefined();
  expect(readOwnedWorkerResult(received)).toBeUndefined();
});

test("freezing the public envelope still permits one independent nested read", () => {
  const received = receiverResult();
  const result = Object.freeze(createOwnedWorkerResult(received, {}));
  const checkpoint = result.checkpoint;
  checkpoint.source.bytes.fill(0);
  expect(result.checkpoint).toBe(checkpoint);
  expect(readOwnedWorkerResult(result)).toBeUndefined();
  expect(Array.from(received.checkpoint.source.bytes)).toEqual([1, 2, 3]);
});
