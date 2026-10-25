// SPDX-License-Identifier: AGPL-3.0-only
// JSON-only inventory projection; complete storage integrity has a separate gate.
import assert from "node:assert/strict";
import { fixtureBundle } from "../conformance/storage.mjs";

const prefix = "packages/vowl/conformance/";
const inventoryPath = prefix + "storage-inventory.json";

async function scalar(access, source, pointer, representation, maximum) {
  const value = await access.select(source, pointer);
  const range = await access.read(value, representation, "0", maximum);
  assert.equal(
    range.totalByteLength,
    String(range.bytes.length),
    "Oversized inventory scalar",
  );
  return new TextDecoder("utf-8", { fatal: true }).decode(range.bytes);
}

/** Validate one finite locator record. Independent storage pins remain the
 * authority; native linked-source admission verifies each selected JSON payload.
 */
function admitMember(entry) {
  assert.ok(entry && typeof entry === "object" && !Array.isArray(entry));
  assert.ok(typeof entry.path === "string" && entry.path.length <= 4096);
  assert.equal(fixtureBundle(entry.path), entry.bundle, "Wrong member bucket");
  assert.match(entry.sha256, /^[a-f0-9]{64}$/u);
  assert.ok(Number.isSafeInteger(entry.byteLength) && entry.byteLength >= 0);
  if (entry.path.endsWith(".json")) {
    assert.ok(
      entry.json &&
        typeof entry.json === "object" &&
        !Array.isArray(entry.json),
    );
    assert.match(entry.json.pointer, /^\/artifacts\/(?:0|[1-9][0-9]*)\/text$/u);
    assert.ok(entry.json.pointer.length <= 64);
    assert.ok(["utf8", "base64"].includes(entry.json.encoding));
  } else {
    assert.ok(entry.path.endsWith(".nq"), "Unclassified member dialect");
    assert.equal(entry.json, undefined);
  }
  return true;
}

/** Stream JSON locators from the checked immutable inventory, one explicitly
 * reserved metadata record at a time. No bundle/body object, growing path map,
 * storage rehash, N-Quads decoding or ordering requirement is introduced here.
 */
export async function* capturedCorpusJson(access) {
  const inventory = await access.capturedSource(inventoryPath);
  assert.equal(
    await scalar(access, inventory, "/format", "decoded-utf8", "128"),
    "canonical-vowl-corpus-storage-inventory/2",
  );
  const rawCount = await scalar(
    access,
    inventory,
    "/artifactCount",
    "number-lexeme",
    "32",
  );
  assert.match(rawCount, /^(?:0|[1-9][0-9]*)$/u);
  const count = BigInt(rawCount);
  assert.ok(
    count <= BigInt(inventory.byteLength),
    "Impossible inventory count",
  );
  assert.equal(
    (await access.select(inventory, "/artifacts")).valueKind,
    "array",
  );
  for (let index = 0n; index < count; index++) {
    access.signal?.throwIfAborted();
    const lease = await access.materializeControl(
      await access.select(inventory, `/artifacts/${index}`),
      "16384",
      admitMember,
    );
    try {
      const entry = lease.value;
      if (entry.json)
        yield {
          path: prefix + entry.path,
          containerPath: prefix + entry.bundle,
          pointer: entry.json.pointer,
          encoding: entry.json.encoding,
          sha256: entry.sha256,
          byteLength: String(entry.byteLength),
        };
    } finally {
      await lease.release();
    }
  }
  await assert.rejects(
    access.select(inventory, `/artifacts/${count}`),
    /pointer-not-found/u,
  );
}
