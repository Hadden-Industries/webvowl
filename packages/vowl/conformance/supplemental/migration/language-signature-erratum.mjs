// SPDX-License-Identifier: AGPL-3.0-only
// A2-only correction of two independent expectations; no product code is read.
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { produce } from "../amended-policy/producer.mjs";
import {
  checkRun,
  loadCorpus as loadOriginalCorpus,
  verifyIndependent,
  verifyPublic,
} from "./verify.mjs";
import { hash, here, json, localPin, pin, readPinned } from "./support.mjs";

export { checkRun, verifyPublic };
const affected = [
  "resolved-language-annotation",
  "resolved-language-title-summary",
];
const langString = "http://www.w3.org/1999/02/22-rdf-syntax-ns#langString";
const originalManifest = {
  path: "supplemental/migration/manifest.json",
  sha256: "505fce8a138664b312f17aad79315fbdf7a5977e30a3e6571f7b1295a6364a90",
};
const originalExpected = {
  path: "supplemental/migration/expected-successes.json",
  sha256: "7af731ac93d6d6b30ae69ecaf221c85f42c8b03bff1080f2db44efbaa6869bf6",
};

async function derive() {
  await readPinned(originalManifest);
  await readPinned(originalExpected);
  const original = await loadOriginalCorpus();
  const corrections = {};
  for (const id of affected) {
    const run = original.runs.find((candidate) => candidate.id === id);
    assert(run && run.outcome === "success");
    const source = JSON.parse(JSON.stringify(run.expected.source));
    assert(
      !source.structural.subjects.some((subject) => subject.iri === langString),
    );
    assert(
      !source.structural.subjects.some(
        (subject) => subject.id === "s:rdf-langString",
      ),
    );
    assert(
      !source.structural.roles.some((role) => role.id === "rdf-langString"),
    );
    assert(
      id === "resolved-language-annotation"
        ? source.structural.constructs.some(
            (construct) => construct.value?.kind === "language",
          )
        : source.structural.ontology.annotations.some(
            (annotation) => annotation.value.kind === "language",
          ),
    );
    source.structural.subjects.push({
      id: "s:rdf-langString",
      iri: langString,
    });
    source.structural.roles.push({
      id: "rdf-langString",
      kind: "datatype",
      subject: "s:rdf-langString",
    });
    // Removing precisely the two mandated records must recover the original
    // expected model; no literal, assertion, occurrence or state is rewritten.
    const check = JSON.parse(JSON.stringify(source));
    check.structural.subjects.pop();
    check.structural.roles.pop();
    assert.deepEqual(check, run.expected.source);
    const output = await produce(source, run.profile);
    assert.notEqual(
      output.bytes.toString("utf8"),
      run.expected.canonicalBytes.text,
    );
    corrections[id] = {
      supersedesExpectedArtifact: run.expected ? id : undefined,
      originalCanonicalSha256: run.expected.canonicalBytes.sha256,
      expected: {
        source,
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
      },
    };
  }
  return {
    original,
    erratum: {
      format:
        "independent-canonical-vowl-migration-language-signature-erratum-v1",
      reason:
        "The original independent models for two language-literal successes omitted mandatory datatype signature closure. A2 lines74-75 state the language branch implies rdf:langString; line92 explicitly requires its datatype role. Add exactly its named subject and datatype role. B2.5 keeps this unattached datatype details-only, so no occurrence is added. This is an oracle correction from the specification, not an adaptation from product output.",
      originalManifest,
      originalExpected,
      affected,
      unchangedVectors: original.runs.length - affected.length,
      invariant:
        "All input bytes, profiles, resolutions, diagnostics, rejection expectations and other success artifacts are unchanged. The original frozen files and producer/verifier sources remain byte-identical.",
      specification: original.manifest.specificationRevision.filter(
        (reference) =>
          reference.path.endsWith("canonical-vowl-core-contract.md") ||
          reference.path.endsWith("canonical-vowl-projection-contract.md"),
      ),
      producer: await localPin("language-signature-erratum.mjs"),
      corrections,
    },
  };
}

export async function loadCorpus() {
  const { original, erratum: derived } = await derive();
  const bytes = await readFile(
    resolve(here, "language-signature-erratum.json"),
  );
  const recorded = JSON.parse(bytes);
  assert.deepEqual(
    recorded,
    derived,
    "Language signature erratum differs from independent derivation",
  );
  for (const correction of Object.values(recorded.corrections)) {
    const expected = correction.expected.canonicalBytes;
    const canonicalBytes = Buffer.from(expected.text, "utf8");
    assert.equal(canonicalBytes.length, expected.byteLength);
    assert.equal(hash(canonicalBytes), expected.sha256);
  }
  return {
    ...original,
    erratumSha256: hash(bytes),
    runs: original.runs.map((run) =>
      Object.hasOwn(recorded.corrections, run.id)
        ? { ...run, expected: recorded.corrections[run.id].expected }
        : run,
    ),
  };
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  if (process.argv.includes("--write-new")) {
    const { erratum } = await derive();
    await pin("language-signature-erratum.json", json(erratum));
  }
  const corpus = await loadCorpus();
  const report = {
    ...(await verifyIndependent(corpus)),
    correctedExpectations: affected.length,
    unchangedVectors: corpus.runs.length - affected.length,
    erratumSha256: corpus.erratumSha256,
  };
  if (process.argv.includes("--check-package")) {
    const { migrate } = await import("vowl/migrate");
    const { encode } = await import("vowl");
    Object.assign(report, await verifyPublic({ migrate, encode }, corpus));
  }
  console.log(JSON.stringify(report));
}
