// SPDX-License-Identifier: AGPL-3.0-only
// Independent expectations are loaded and verified before any product import.
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import canonicalize from "canonicalize";
import { produce } from "../amended-policy/producer.mjs";
import { applyPatches, inputText } from "./compact.mjs";
import { authorities, hash, here, readPinned } from "./support.mjs";

const clone = (value) => JSON.parse(JSON.stringify(value));

function deeplyFrozen(value) {
  if (value === null || typeof value !== "object") return;
  assert(Object.isFrozen(value), "Migration result contains a mutable value");
  for (const item of Object.values(value)) deeplyFrozen(item);
}

export async function loadCorpus() {
  await authorities();
  const manifestBytes = await readFile(resolve(here, "manifest.json"));
  const manifest = JSON.parse(manifestBytes);
  assert.equal(
    manifest.format,
    "independent-canonical-vowl-migration-corpus-v1",
  );
  for (const reference of [
    ...manifest.specificationRevision,
    ...manifest.migrationAuthorities,
    ...manifest.independentDependencies,
    ...manifest.producerSources,
    ...manifest.verifierSources,
  ])
    await readPinned(reference);
  const bundle = JSON.parse(await readPinned(manifest.expectedBundle));
  assert.equal(
    bundle.format,
    "independent-canonical-vowl-migration-successes-v1",
  );
  const runs = manifest.vectors.map((vector) => {
    assert(Object.hasOwn(manifest.seeds, vector.input.seed));
    const input = applyPatches(
      manifest.seeds[vector.input.seed],
      vector.input.patches,
    );
    const bytes = Buffer.from(inputText(input), "utf8");
    assert.equal(bytes.length, vector.input.byteLength, vector.id);
    assert.equal(hash(bytes), vector.input.sha256, vector.id);
    const expected = vector.expected
      ? bundle.artifacts[vector.expected]
      : undefined;
    if (vector.outcome === "success") {
      assert(expected, vector.id);
      assert.equal(expected.canonicalBytes.encoding, "UTF-8");
      const canonicalBytes = Buffer.from(expected.canonicalBytes.text, "utf8");
      assert.equal(canonicalBytes.length, expected.canonicalBytes.byteLength);
      assert.equal(hash(canonicalBytes), expected.canonicalBytes.sha256);
    }
    return { ...vector, bytes, expected };
  });
  return { manifest, manifestSha256: hash(manifestBytes), runs };
}

export async function verifyIndependent(corpus) {
  corpus ??= await loadCorpus();
  const successful = corpus.runs.filter((run) => run.outcome === "success");
  for (const run of successful) {
    const generated = await produce(run.expected.source, run.profile);
    assert.equal(generated.mappedNQuads, run.expected.mappedDefaultGraphNQuads);
    assert.equal(generated.canonicalNQuads, run.expected.canonicalNQuads);
    assert.deepEqual(
      generated.correspondence,
      run.expected.primaryCorrespondence,
    );
    assert.equal(
      generated.bytes.toString("utf8"),
      run.expected.canonicalBytes.text,
    );
  }

  // Red-capable controls alter retained meaning and state, independently of
  // migration. The expected output comparison must distinguish those changes.
  const named = successful.find((run) => run.id === "named-class-structural");
  assert(named);
  const wrongIdentity = clone(named.expected.source);
  wrongIdentity.structural.subjects[0].iri = "urn:incorrect-migration-identity";
  assert.notEqual(
    (await produce(wrongIdentity, named.profile)).bytes.toString("utf8"),
    named.expected.canonicalBytes.text,
  );
  const artifact = successful.find((run) => run.expected.source.visualization);
  assert(artifact, "Migration qualification must include an artifact success");
  const wrongCamera = clone(artifact.expected.source);
  wrongCamera.visualization.camera.center.x += 1;
  assert.notEqual(
    (await produce(wrongCamera, artifact.profile)).bytes.toString("utf8"),
    artifact.expected.canonicalBytes.text,
  );
  return {
    vectors: corpus.runs.length,
    successes: successful.length,
    rejections: corpus.runs.length - successful.length,
    redControls: 2,
    manifestSha256: corpus.manifestSha256,
  };
}

function checkDiagnostics(run, diagnostics) {
  assert(Array.isArray(diagnostics), run.id);
  let previous;
  for (const diagnostic of diagnostics) {
    assert.equal(diagnostic.severity, "warning", run.id);
    assert(
      ["MIGRATION_DROPPED_FIELD", "MIGRATION_RESOLVED_FIELD"].includes(
        diagnostic.code,
      ),
      run.id,
    );
    assert.equal(typeof diagnostic.sourcePointer, "string", run.id);
    const bytes = Buffer.from(canonicalize(diagnostic), "utf8");
    if (previous) assert(Buffer.compare(previous, bytes) < 0, run.id);
    previous = bytes;
  }
  const required = [
    ...run.diagnostics,
    ...run.resolutions.map((resolution) => ({
      code: "MIGRATION_RESOLVED_FIELD",
      sourcePointer: resolution.sourcePointer,
    })),
  ];
  for (const expectation of required)
    assert(
      diagnostics.some(
        (actual) =>
          actual.code === expectation.code &&
          actual.sourcePointer === expectation.sourcePointer,
      ),
      `${run.id}: missing ${expectation.code} at ${expectation.sourcePointer}`,
    );
  for (const actual of diagnostics.filter(
    (diagnostic) => diagnostic.code === "MIGRATION_RESOLVED_FIELD",
  ))
    assert(
      run.resolutions.some(
        (resolution) => resolution.sourcePointer === actual.sourcePointer,
      ),
      `${run.id}: invented resolution diagnostic`,
    );
}

export async function checkRun(run, { migrate, encode }) {
  const bytes = new Uint8Array(run.bytes);
  const originalBytes = new Uint8Array(bytes);
  const options = {
    dialect: run.dialect,
    profile: run.profile,
    resolutions: clone(run.resolutions),
  };
  const originalOptions = clone(options);
  if (run.outcome === "error") {
    await assert.rejects(
      () => migrate(bytes, options),
      (error) => error.code === run.errorCode,
      `${run.id}: expected ${run.errorCode}`,
    );
  } else {
    const actual = await migrate(bytes, options);
    assert.deepEqual(Object.keys(actual).sort(), [
      "diagnostics",
      "dialect",
      "document",
    ]);
    assert.equal(actual.dialect, run.dialect, run.id);
    assert.equal(
      Buffer.from(encode(actual.document)).toString("utf8"),
      run.expected.canonicalBytes.text,
      `${run.id}: independently expected canonical bytes`,
    );
    deeplyFrozen(actual);
    checkDiagnostics(run, actual.diagnostics);
  }
  assert.deepEqual(
    bytes,
    originalBytes,
    `${run.id}: migration changed source bytes`,
  );
  assert.deepEqual(
    options,
    originalOptions,
    `${run.id}: migration changed options`,
  );
}

export async function verifyPublic(api, corpus) {
  corpus ??= await loadCorpus();
  for (const run of corpus.runs) await checkRun(run, api);
  const named = corpus.runs.find((run) => run.id === "named-class-structural");
  const sourceBytes = new Uint8Array(named.bytes);
  const pending = api.migrate(sourceBytes, {
    dialect: named.dialect,
    profile: named.profile,
  });
  sourceBytes.fill(0);
  const result = await pending;
  assert.equal(
    Buffer.from(api.encode(result.document)).toString("utf8"),
    named.expected.canonicalBytes.text,
    "Migration must capture input bytes before its first suspension",
  );
  const resolved = corpus.runs.find(
    (run) => run.id === "resolved-iri-annotation",
  );
  const resolutions = clone(resolved.resolutions);
  const resolving = api.migrate(new Uint8Array(resolved.bytes), {
    dialect: resolved.dialect,
    profile: resolved.profile,
    resolutions,
  });
  resolutions[0].iri = "urn:mutation-after-migration-call";
  const resolvedResult = await resolving;
  assert.equal(
    Buffer.from(api.encode(resolvedResult.document)).toString("utf8"),
    resolved.expected.canonicalBytes.text,
    "Migration must capture resolution values before its first suspension",
  );
  return { publicRuns: corpus.runs.length, snapshotChecks: 2 };
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const corpus = await loadCorpus();
  const result = await verifyIndependent(corpus);
  if (process.argv.includes("--check-package")) {
    const { migrate } = await import("vowl/migrate");
    const { encode } = await import("vowl");
    Object.assign(result, await verifyPublic({ migrate, encode }, corpus));
  }
  console.log(JSON.stringify(result));
}
