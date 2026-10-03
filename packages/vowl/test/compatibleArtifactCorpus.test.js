import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import rdf from "rdf-canonize";
import { canonicalize, compatibleArtifactProfile, decode, encode } from "vowl";
import { compatibleMappingContract } from "../src/compatibleContract.js";
import { mapDataset } from "../src/internalRdf.js";
import { refineDataset } from "../src/refinedRdf.js";
import { ResourceBudget } from "../src/resourceBudget.js";
import {
  cases,
  permute,
  produce,
} from "../conformance/supplemental/compatible-artifact-v1/producer.mjs";

const corpus = new URL(
  "../conformance/supplemental/compatible-artifact-v1/",
  import.meta.url,
);
const archive = readFileSync(new URL("vectors.jsonl", corpus));
const vectors = archive.toString("utf8").trimEnd().split("\n").map(JSON.parse);
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

test("independent compatible seed archive retains its recorded identity", () => {
  expect(sha256(archive)).toBe(
    "dfa2fe36ce32458973a6f92b9dd66c650f0f1b9f9b1455eb9230b7e5aef4319c",
  );
  expect(sha256(readFileSync(new URL("producer.mjs", corpus)))).toBe(
    "ec4ff887ca52aeec0fea962fe22198b7c58a02c72ba29e72b5bf8062362cbd30",
  );
  expect(cases.map(({ id }) => id)).toEqual(vectors.map(({ id }) => id));
});

describe.each(vectors)("independent compatible seed: $id", (vector) => {
  test("independent producer reproduces retained bytes and permutation", async () => {
    const seed = cases.find(({ id }) => id === vector.id);
    expect(seed.source).toEqual(vector.source);
    expect(permute(seed.source)).toEqual(vector.permutedSource);
    for (const source of [vector.source, vector.permutedSource]) {
      const result = await produce(source);
      expect(Buffer.from(result.bytes).toString("utf8")).toBe(
        vector.canonicalUtf8,
      );
      expect(result.canonicalNQuads).toBe(vector.canonicalNQuads);
      if (source === vector.source) {
        expect(result.baseNQuads).toBe(vector.baseNQuads);
        expect(result.ids).toEqual(vector.ids);
      }
    }
  });

  test("production matches complete mapped graph, source bytes and decoder", async () => {
    const expected = new Uint8Array(Buffer.from(vector.canonicalUtf8, "utf8"));
    expect(sha256(expected)).toBe(vector.canonicalSha256);
    for (const source of [vector.source, vector.permutedSource]) {
      const document = await canonicalize(source, {
        profile: compatibleArtifactProfile,
      });
      expect(encode(document)).toEqual(expected);
    }
    expect(encode(await decode(expected))).toEqual(expected);

    const sourceDocument = {
      profile: compatibleArtifactProfile,
      ...structuredClone(vector.source),
    };
    const budget = new ResourceBudget({}, performance.now());
    try {
      const mapped = mapDataset(
        sourceDocument,
        budget,
        compatibleMappingContract(sourceDocument),
      );
      const refined = await refineDataset(mapped.dataset, budget);
      expect(
        await rdf.canonize(refined.dataset, {
          algorithm: "RDFC-1.0",
          messageDigestAlgorithm: "sha256",
          rejectURDNA2015: true,
          maxDeepIterations: Math.min(mapped.blankCount ** 2, 100000),
          signal: budget.signal,
        }),
      ).toBe(vector.canonicalNQuads);
    } finally {
      budget.dispose();
    }
  });
});
