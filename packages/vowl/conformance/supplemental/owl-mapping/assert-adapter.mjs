// SPDX-License-Identifier: AGPL-3.0-only
// Public-boundary assertions only. The caller supplies fromOwl/encode; this file
// imports neither a product module nor any product-generated expectation.
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import canonicalize from "canonicalize";
import { readPinned } from "./support.mjs";

const utf8 = (value) => Buffer.from(canonicalize(value), "utf8");
const identifier = (text, token) =>
  new RegExp(`(?:^|[^A-Za-z0-9_])${token}(?:$|[^A-Za-z0-9_])`).test(text);
const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function identifiesIri(record, iri) {
  // A9 makes subject optional; require the exact semantic IRI, not field placement.
  return (
    record.subject === iri ||
    new RegExp(`(?:^|[\\s<("'\\[])${escape(iri)}(?:$|[\\s>"'\\])},;])`).test(
      record.details,
    )
  );
}
function immutable(value, seen = new Set()) {
  if (!value || typeof value !== "object" || seen.has(value)) return;
  assert(Object.isFrozen(value), "Adapter result must be deeply immutable");
  seen.add(value);
  for (const child of Object.values(value)) immutable(child, seen);
}
function diagnostics(actual, expected) {
  assert(Array.isArray(actual));
  const allowedCodes = new Set(expected.map(({ code }) => code));
  const bytes = [];
  for (const record of actual) {
    assert(record && typeof record === "object" && !Array.isArray(record));
    for (const key of Object.keys(record))
      assert(
        ["code", "severity", "subject", "sourcePointer", "details"].includes(
          key,
        ),
        `Unknown diagnostic field: ${key}`,
      );
    assert(
      allowedCodes.has(record.code),
      `Unexpected diagnostic code: ${record.code}`,
    );
    assert.equal(record.severity, "warning");
    assert.equal(typeof record.details, "string");
    if (record.subject !== undefined)
      assert.equal(typeof record.subject, "string");
    if (record.sourcePointer !== undefined)
      assert.equal(typeof record.sourcePointer, "string");
    bytes.push(utf8(record));
  }
  for (let i = 1; i < bytes.length; i++)
    assert(
      Buffer.compare(bytes[i - 1], bytes[i]) < 0,
      "Complete diagnostics must be UTF-8 JCS ordered and deduplicated",
    );
  for (const condition of expected) {
    assert(
      actual.some(
        (record) =>
          record.code === condition.code &&
          (condition.subject === undefined ||
            identifiesIri(record, condition.subject)) &&
          (condition.sourceConstructor === undefined ||
            identifier(record.details, condition.sourceConstructor)) &&
          (condition.restrictionIdentifier === undefined ||
            identifier(record.details, condition.restrictionIdentifier)),
      ),
      `Missing diagnostic condition: ${canonicalize(condition)}`,
    );
  }
}

export async function assertAdapterRun({ fromOwl, encode }, vector, run) {
  const source = new Uint8Array(await readPinned(vector.root.bytes));
  const sourceBefore = source.slice();
  const calls = [];
  const imports = new Map(
    (vector.imports ?? []).map((entry) => [entry.importIri, entry]),
  );
  const options = {
    documentIri: vector.root.documentIri,
    mediaType: vector.root.mediaType,
    ...run.options,
  };
  if (imports.size)
    options.resolveImport = async (importIri, context) => {
      assert.equal(typeof importIri, "string");
      assert(context && typeof context.importingDocumentIri === "string");
      assert(
        context.signal &&
          typeof context.signal.aborted === "boolean" &&
          typeof context.signal.addEventListener === "function",
        "Resolver receives operation cancellation context",
      );
      calls.push({
        importIri,
        importingDocumentIri: context.importingDocumentIri,
      });
      const response = imports.get(importIri);
      assert(response, `Unexpected import acquisition: ${importIri}`);
      return {
        bytes: new Uint8Array(await readPinned(response.bytes)),
        documentIri: response.documentIri,
        mediaType: response.mediaType,
      };
    };
  const operation = Promise.resolve().then(() => fromOwl(source, options));
  if (run.outcome === "error") {
    await assert.rejects(operation, { code: run.errorCode });
  } else {
    assert.equal(run.outcome, "success");
    const result = await operation;
    assert.deepEqual(Object.keys(result).sort(), [
      "diagnostics",
      "document",
      "mappingProfile",
    ]);
    immutable(result);
    assert.equal(result.mappingProfile, run.mappingProfile);
    assert.deepEqual(
      Buffer.from(encode(result.document)),
      await readPinned(vector.expected["canonical.json"]),
      `${vector.id}/${run.id}: complete independent canonical bytes`,
    );
    diagnostics(result.diagnostics, run.diagnostics);
  }
  assert.deepEqual(source, sourceBefore, "Adapter must not mutate input bytes");
  const set = (values) =>
    [...new Set(values.map(canonicalize))].sort((a, b) =>
      Buffer.compare(Buffer.from(a), Buffer.from(b)),
    );
  assert.deepEqual(
    set(calls),
    set(vector.resolverContexts ?? []),
    `${vector.id}: authored import plus actual importing-document context`,
  );
}
