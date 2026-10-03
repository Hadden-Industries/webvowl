import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import rdf from "rdf-canonize";
import { canonicalize, compatibleArtifactProfile, decode, encode } from "vowl";
import { compatibleMappingContract } from "../src/compatibleContract.js";
import { mapDataset } from "../src/internalRdf.js";
import { refineDataset } from "../src/refinedRdf.js";
import { ResourceBudget } from "../src/resourceBudget.js";
import { produce } from "../conformance/supplemental/compatible-artifact-v1/producer.mjs";
import {
  normalize,
  refine,
} from "../conformance/supplemental/compatible-artifact-v2/independent-overlay.mjs";

const root = new URL(
  "../conformance/supplemental/compatible-artifact-v2/",
  import.meta.url,
);
const read = (name) => readFileSync(new URL(name, root));
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const archive = read("vectors.jsonl");
const vectors = archive.toString().trimEnd().split("\n").map(JSON.parse);
const checksBytes = read("checks.json");
const checks = JSON.parse(checksBytes);
const byId = new Map(vectors.map((row) => [row.id, row]));
const utf8 = (bytes) => Buffer.from(bytes).toString("utf8");
const bytes = (text) => new Uint8Array(Buffer.from(text, "utf8"));
const canon = (dataset, signal) =>
  rdf.canonize(dataset, {
    algorithm: "RDFC-1.0",
    messageDigestAlgorithm: "sha256",
    rejectURDNA2015: true,
    maxDeepIterations: 100000,
    signal,
  });

test("independent gap corpus retains sealed expectations and transport overlay", () => {
  expect(sha(archive)).toBe(
    "a72b1d35d89f4acf6d53176c2e87421bf0ff413c650db100cc3311f484d91e2c",
  );
  expect(sha(checksBytes)).toBe(
    "d77ecf2a344a2bd1204aaf4b054d210cda5aa32e807260b179b37c592fa5ee99",
  );
  expect(sha(read("independent-overlay.mjs"))).toBe(checks.overlaySha256);
  expect(byId.size).toBe(229);
  expect(checks.pairs).toHaveLength(108);
  expect(checks.negatives).toHaveLength(69);
});

describe.each(vectors)("independent compatible gap: $id", (row) => {
  test("independent producer reproduces source, permutation and mapped bytes", async () => {
    expect(sha(row.expectedUtf8)).toBe(row.expectedSha256);
    for (const source of [row.source, row.permuted]) {
      // Jest's native structuredClone returns host-realm objects. Transport these
      // trusted JSON fixtures back into the producer's realm before admission.
      const result = await produce(
        JSON.parse(JSON.stringify(normalize(source))),
      );
      expect(utf8(result.bytes)).toBe(row.expectedUtf8);
      expect(result.canonicalNQuads).toBe(row.canonicalNQuads);
      if (source === row.source) {
        expect(result.baseNQuads).toBe(row.baseNQuads);
        expect(result.ids).toEqual(row.ids);
      }
    }
  });

  test("public operations and complete augmented graph agree", async () => {
    for (const source of [row.source, row.permuted]) {
      expect(
        utf8(
          encode(
            await canonicalize(source, { profile: compatibleArtifactProfile }),
          ),
        ),
      ).toBe(row.expectedUtf8);
    }
    expect(utf8(encode(await decode(bytes(row.expectedUtf8))))).toBe(
      row.expectedUtf8,
    );
    const document = {
      profile: compatibleArtifactProfile,
      ...JSON.parse(row.expectedUtf8),
    };
    const budget = new ResourceBudget({}, performance.now());
    try {
      const mapped = mapDataset(
        document,
        budget,
        compatibleMappingContract(document),
      );
      const refined = await refineDataset(mapped.dataset, budget);
      expect(await canon(refined.dataset, budget.signal)).toBe(
        row.canonicalNQuads,
      );
    } finally {
      budget.dispose();
    }
  });
});

test.each(checks.pairs)(
  "independent retained-field distinction: $id",
  (pair) => {
    const a = byId.get(pair.a);
    const b = byId.get(pair.b);
    expect(a.expectedUtf8).not.toBe(b.expectedUtf8);
    expect(a.canonicalNQuads).not.toBe(b.canonicalNQuads);
  },
);

test.each(checks.negatives)("independent rejection: $id", async (row) => {
  const operation =
    row.operation === "byte decode"
      ? decode(bytes(row.inputUtf8))
      : canonicalize(row.source, { profile: compatibleArtifactProfile });
  await expect(operation).rejects.toMatchObject({ code: row.expectedCode });
});

test.each(checks.refinement)("independent refinement: $id", async (row) => {
  const source = byId.get(row.sourceCase);
  const dataset = rdf.NQuads.parse(row.baseNQuads ?? source.baseNQuads);
  // N-Quads omits absent language metadata; the private mapping contract uses "".
  for (const quad of dataset) {
    for (const term of [quad.subject, quad.predicate, quad.object]) {
      if (term.termType === "Literal") {
        term.language ??= "";
      }
    }
  }
  const independent = refine(dataset);
  expect(independent.rounds).toBe(row.rounds);
  expect(independent.history).toEqual(row.history);
  expect(await canon(independent.augmented, AbortSignal.timeout(20000))).toBe(
    row.canonicalNQuads,
  );
  const budget = new ResourceBudget({}, performance.now());
  try {
    const actual = await refineDataset(dataset, budget);
    expect(await canon(actual.dataset, budget.signal)).toBe(
      row.canonicalNQuads,
    );
  } finally {
    budget.dispose();
  }
  for (const key of [
    "nestedArrayAlternativeSha256",
    "previousStoppingColorAlternativeSha256",
    "doubleCountingAlternativeSha256",
  ]) {
    if (row[key]) {
      expect(row[key]).not.toBe(sha(row.canonicalNQuads));
    }
  }
});

test("structural language normalization does not erase residual spelling", () => {
  for (const assertion of checks.languageAssertions) {
    expect(
      byId.get(assertion.a).expectedUtf8 === byId.get(assertion.b).expectedUtf8,
    ).toBe(assertion.expected === "equal");
  }
  for (const assertion of checks.languageOwnerAssertions) {
    expect(byId.get(assertion.a).expectedUtf8).toBe(
      byId.get(assertion.b).expectedUtf8,
    );
    expect(byId.get(assertion.a).canonicalNQuads).toBe(
      byId.get(assertion.b).canonicalNQuads,
    );
  }
});

test("category issuance follows numeric c14n ordinals beyond nine", () => {
  const witness = checks.numericIssuance;
  expect(witness.numerical).not.toEqual(witness.lexical);
  const row = byId.get(witness.sourceCase);
  const ids = Object.values(row.ids).filter(
    (item) => item.category === "documents",
  );
  const numeric = [...ids].sort(
    (a, b) =>
      Number(a.canonicalBlank.slice(4)) - Number(b.canonicalBlank.slice(4)),
  );
  expect(numeric.map((item) => item.handle)).toEqual(witness.numerical);
  expect(numeric.map((item) => item.id)).toEqual(
    numeric.map((_, index) => `d${index}`),
  );
});
