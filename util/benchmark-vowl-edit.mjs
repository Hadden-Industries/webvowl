import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { cpus, platform, release, totalmem } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { assertQuiescentMachine } from "./benchmarkEnvironment.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const { values } = parseArgs({
  options: {
    baseline: { type: "string" },
    source: { type: "string", default: root },
    output: { type: "string" },
    sizes: { type: "string", default: "100,500,1000" },
    "candidate-only": { type: "string", default: "" },
    samples: { type: "string", default: "20" },
    profile: { type: "string", default: "desktop" },
    closure: { type: "string" },
  },
});
assert(
  values.baseline && values.output,
  "--baseline and a new --output file are required",
);
const sizes = (text) =>
  text
    ? text.split(",").map((value) => {
        const n = Number(value);
        assert(
          Number.isSafeInteger(n) && n > 0,
          "sizes must be positive safe integers",
        );
        return n;
      })
    : [];
const samples = Number(values.samples);
assert(Number.isSafeInteger(samples) && samples > 0);
assert(["desktop", "package"].includes(values.profile));
const limits =
  values.profile === "desktop"
    ? {
        primaryRecords: 200000,
        embeddedValues: 4000000,
        totalStringBytes: 67108864,
        deadlineMs: 60000,
      }
    : {};
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const git = (directory, args) =>
  execFileSync("git", ["-C", directory, ...args], {
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    windowsHide: true,
  });
const receipt = {
  schemaVersion: 1,
  status: "running",
  profile: values.profile,
  limits,
  startedAt: new Date().toISOString(),
  samplesPerCandidate: samples,
  sampling:
    "One discarded warmup; balanced AB/BA pairs from the same admitted revision; setup, checkpoint and inspection outside edit timing",
  environment: {
    node: process.version,
    v8: process.versions.v8,
    platform: platform(),
    os: release(),
    cpu: cpus()[0]?.model,
    ramBytes: totalmem(),
  },
  harnessSha256: hash(readFileSync(fileURLToPath(import.meta.url))),
  cohorts: [],
  admissions: [],
};
async function load(directory) {
  directory = resolve(directory);
  const api = await import(
    pathToFileURL(resolve(directory, "packages/vowl/src/index.js"))
  );
  const { jsonKey } = await import(
    pathToFileURL(resolve(directory, "packages/vowl/src/canonicalJson.js"))
  );
  const input = JSON.parse(
    readFileSync(
      resolve(
        directory,
        "packages/vowl/conformance/vectors/empty-structural/source.json",
      ),
    ),
  );
  return {
    api,
    jsonKey,
    input,
    source: {
      directory,
      head: git(directory, ["rev-parse", "HEAD"]).trim(),
      packageDiffSha256: hash(
        git(directory, ["diff", "--binary", "--", "packages/vowl"]),
      ),
      implementation: Object.fromEntries(
        [
          "projection.js",
          "editing.js",
          "liveModel.js",
          "supportPreservation.js",
        ].flatMap((name) => {
          try {
            return [
              [
                name,
                hash(
                  readFileSync(resolve(directory, "packages/vowl/src", name)),
                ),
              ],
            ];
          } catch (error) {
            if (error.code === "ENOENT") return [];
            throw error;
          }
        }),
      ),
    },
  };
}
function changes(n) {
  const result = [];
  for (let i = 0; i < n; i++)
    result.push(
      {
        kind: "insert",
        collection: "subjects",
        record: { id: `s${i}`, iri: `urn:chain:${i}` },
      },
      {
        kind: "insert",
        collection: "roles",
        record: { id: `r${i}`, kind: "class", subject: `s${i}` },
      },
    );
  for (let i = 0; i < n - 1; i++)
    result.push({
      kind: "insert",
      collection: "constructs",
      record: {
        id: `k${i}`,
        kind: "subclass",
        sub: `r${i}`,
        super: `r${i + 1}`,
      },
    });
  return result;
}
const insert = [
  {
    kind: "insert",
    collection: "subjects",
    record: { id: "extra:s", iri: "urn:chain:extra" },
  },
  {
    kind: "insert",
    collection: "roles",
    record: { id: "extra:r", kind: "class", subject: "extra:s" },
  },
  {
    kind: "insert",
    collection: "constructs",
    record: { id: "extra:k", kind: "subclass", sub: "extra:r", super: "r0" },
  },
];
async function prepare(target, n) {
  const { api } = target;
  const start = performance.now();
  let loaded;
  if (n === "closure") {
    const { openOwl } = await import(
      pathToFileURL(
        resolve(target.source.directory, "packages/vowl/src/owl/index.js"),
      )
    );
    const { documents } = JSON.parse(readFileSync(values.closure));
    const read = (entry) => {
      assert(entry, "Unbound private import");
      const bytes = Uint8Array.from(readFileSync(entry.path));
      assert.equal(hash(bytes), entry.sha256, "Private input identity changed");
      if (entry.byteLength !== undefined)
        assert.equal(bytes.length, entry.byteLength);
      return {
        bytes,
        documentIri: entry.documentIri,
        mediaType: entry.mediaType,
      };
    };
    const root = read(documents[0]);
    loaded = await openOwl(root.bytes, {
      documentIri: root.documentIri,
      mediaType: root.mediaType,
      limits,
      resolveImport: async (iri) =>
        read(documents.find((entry) => entry.documentIri === iri)),
    });
    receipt.privateInputIdentities ??= documents.map(
      ({ documentIri, mediaType, byteLength, sha256 }) => ({
        documentIri,
        mediaType,
        byteLength,
        sha256,
      }),
    );
  } else {
    const canonical = await api.canonicalize(target.input, {
      profile: api.profiles.structuralContent,
      limits,
    });
    const { model } = await api.openCanonical(canonical, { limits });
    loaded = await api.editModel(model, changes(n), { limits });
  }
  const records = api.inspectModel(loaded.model).records;
  const parent = records.roles.find(({ kind }) => kind === "class");
  assert(parent, "Class-bearing benchmark model required");
  return {
    ...target,
    model: loaded.model,
    setupMs: performance.now() - start,
    counts: Object.fromEntries(
      Object.entries(records).map(([key, value]) => [key, value.length]),
    ),
    raw: [],
    changes: insert.map((change) =>
      change.collection === "constructs"
        ? { ...change, record: { ...change.record, super: parent.id } }
        : change,
    ),
  };
}
async function edit(target, retain) {
  const start = performance.now();
  const edited = await target.api.editModel(target.model, target.changes, {
    limits,
  });
  const editMs = performance.now() - start;
  assert.equal(edited.model.revision, target.model.revision + 1);
  assert.equal(edited.created.length, 6);
  if (retain) target.raw.push(editMs);
  return edited;
}
function stats(raw) {
  const ordered = [...raw].sort((a, b) => a - b);
  return {
    medianMs: ordered[Math.ceil(ordered.length / 2) - 1],
    p95Ms: ordered[Math.ceil(ordered.length * 0.95) - 1],
    maximumMs: ordered.at(-1),
    rawMs: raw,
  };
}
async function cohort(n, targets) {
  const retained = { classes: n, status: "running", candidates: [] };
  receipt.cohorts.push(retained);
  receipt.admissions.push(await assertQuiescentMachine());
  const active = [];
  for (const target of targets) {
    const entry = { source: target.source, rawMs: [] };
    retained.candidates.push(entry);
    const prepared = await prepare(target, n);
    prepared.raw = entry.rawMs;
    Object.assign(entry, {
      setupMs: prepared.setupMs,
      counts: prepared.counts,
    });
    active.push(prepared);
  }
  for (const target of active) await edit(target, false);
  let last;
  for (let i = 0; i < samples; i++) {
    receipt.admissions.push(await assertQuiescentMachine());
    for (const target of i % 2 ? [...active].reverse() : active) {
      last = await edit(target, true);
      target.lastModel = last.model;
    }
    if ((i + 1) % 5 === 0) {
      console.log(
        JSON.stringify({ classes: n, completedSamples: i + 1, samples }),
      );
    }
  }
  const checksums = [];
  for (const target of active) {
    const checkpoint = await target.api.checkpointModel(target.lastModel, {
      limits,
    });
    checksums.push(hash(target.jsonKey(checkpoint)));
  }
  assert(
    checksums.every((value) => value === checksums[0]),
    "baseline/candidate checkpoints differ",
  );
  retained.checkpointSha256 = checksums[0];
  active.forEach((target, index) =>
    Object.assign(retained.candidates[index], stats(target.raw)),
  );
  receipt.admissions.push(await assertQuiescentMachine());
  retained.status = "passed";
}
try {
  const pairedSizes = sizes(values.sizes);
  const baseline =
    pairedSizes.length || values.closure
      ? await load(values.baseline)
      : undefined;
  const candidate = await load(values.source);
  for (const n of pairedSizes) await cohort(n, [baseline, candidate]);
  for (const n of sizes(values["candidate-only"])) await cohort(n, [candidate]);
  if (values.closure) await cohort("closure", [baseline, candidate]);
  receipt.status = "passed";
} catch (error) {
  receipt.status = "failed";
  receipt.failure = {
    name: error.name,
    code: error.code,
    message: error.message,
  };
  process.exitCode = 1;
} finally {
  for (const cohort of receipt.cohorts) {
    if (cohort.status === "running") cohort.status = "incomplete";
  }
  receipt.finishedAt = new Date().toISOString();
  if (values.output === "-") {
    console.log(JSON.stringify(receipt));
  } else {
    writeFileSync(
      resolve(values.output),
      JSON.stringify(receipt, null, 2) + "\n",
      { flag: "wx" },
    );
    console.log(
      JSON.stringify({
        status: receipt.status,
        cohorts: receipt.cohorts.map(({ classes, candidates }) => ({
          classes,
          candidates: candidates.map(({ setupMs, medianMs, p95Ms }) => ({
            setupMs,
            medianMs,
            p95Ms,
          })),
        })),
        failure: receipt.failure,
      }),
    );
  }
}
