// SPDX-License-Identifier: AGPL-3.0-only
// Raw RDF graph experiment, deliberately NOT a Canonical VOWL input or vector.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import process from "node:process";
import { fileURLToPath } from "node:url";
import rdfCanonize from "rdf-canonize";
const here = dirname(fileURLToPath(import.meta.url));
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
function clique(size) {
  const lines = [];
  for (let from = 0; from < size; from++)
    for (let to = 0; to < size; to++)
      if (from !== to)
        lines.push(`_:b${from} <urn:example:connected> _:b${to} .\n`);
  return lines.join("");
}
const results = [];
for (const size of [3, 5, 8, 12]) {
  const nq = clique(size),
    target = resolve(here, "raw-symmetry", `clique-${size}`);
  await mkdir(target, { recursive: true });
  await writeFile(resolve(target, "input.nq"), nq);
  const attempts = [],
    successfulHashes = new Set();
  async function attempt(label, budget, signal = AbortSignal.timeout(10000)) {
    const start = performance.now();
    try {
      const output = await rdfCanonize.canonize(nq, {
        inputFormat: "application/n-quads",
        algorithm: "RDFC-1.0",
        messageDigestAlgorithm: "sha256",
        rejectURDNA2015: true,
        canonicalIdMap: new Map(),
        maxDeepIterations: budget,
        signal,
      });
      const hash = sha256(output);
      successfulHashes.add(hash);
      await writeFile(resolve(target, "canonical.nq"), output);
      attempts.push({
        label,
        budget,
        outcome: "success",
        canonicalNQuadsSha256: hash,
        elapsedMs: Number((performance.now() - start).toFixed(3)),
      });
    } catch (error) {
      attempts.push({
        label,
        budget,
        outcome: /^Maximum deep iterations exceeded/.test(error.message)
          ? "resource-limit"
          : signal.aborted
            ? "aborted"
            : "unexpected-error",
        name: error.name,
        rawMessage: error.message,
        elapsedMs: Number((performance.now() - start).toFixed(3)),
        alternateBytesReturned: false,
      });
    }
  }
  await attempt("current-linear", size);
  await attempt("proposed-quadratic", Math.min(size * size, 100000));
  await attempt("absolute-ceiling", 100000);
  await attempt(
    "already-aborted",
    Math.min(size * size, 100000),
    AbortSignal.abort(),
  );
  await attempt("timed-cancellation-1ms", 100000, AbortSignal.timeout(1));
  assert.ok(
    successfulHashes.size <= 1,
    "All successful budgets produce one exact graph result",
  );
  assert.ok(attempts.every((item) => item.outcome !== "unexpected-error"));
  results.push({
    size,
    graphKind: "complete-directed-irreflexive-homogeneous-RDF-graph",
    blankNodes: size,
    quads: size * (size - 1),
    sourceSha256: sha256(nq),
    successfulBytesIdentical: true,
    attempts,
  });
  console.log(JSON.stringify(results.at(-1)));
}
await writeFile(
  resolve(here, "symmetry-results.json"),
  JSON.stringify(
    {
      status: "experimental-raw-RDF-not-VOWL-conformance",
      normativePolicyChanged: false,
      command:
        "node packages/vowl/conformance/supplemental/budget/probe-symmetry.mjs",
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      library: "rdf-canonize@5.0.0",
      perCallDeadlineMs: 10000,
      probeSourceSha256: sha256(await readFile(fileURLToPath(import.meta.url))),
      limitations:
        "Raw RDF stress evidence only. Does not establish hostile Canonical VOWL safety, browser worker deadlines, a uniform wall-clock bound, or approval of the proposed policy.",
      cases: results,
    },
    null,
    2,
  ) + "\n",
);
