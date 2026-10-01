import rdf from "rdf-canonize";
import { canonicalize, encode } from "vowl";
import { mapDataset } from "../src/internalRdf.js";
import { ResourceBudget } from "../src/resourceBudget.js";
import { auditTemplates } from "../conformance/supplemental/mapping-counterexamples/auditor-v2/template-audit.mjs";
import {
  fieldAccounting,
  mappingPairs,
  positiveById,
  positives,
  readJson,
  readPinned,
} from "./independentCorpus.js";

// Plan section 7 permits test-only private mapping artifacts. No package export
// exposes the mapper, and every inspected model first passes public admission.
const observations = new Map();
function observed(vector) {
  if (observations.has(vector.id)) {
    return observations.get(vector.id);
  }
  const operation = (async () => {
    const source = readJson(vector.files["source.json"]);
    const document = await canonicalize(source, { profile: vector.profile });
    const budget = new ResourceBudget({}, performance.now());
    try {
      const { dataset, primaryNodes, blankCount } = mapDataset(
        document,
        budget,
      );
      expect(dataset).toHaveLength(vector.counts.quads);
      expect(primaryNodes.size).toBe(vector.counts.primary);
      expect(blankCount).toBe(vector.counts.blankNodes);
      const nquads = await rdf.canonize(dataset, {
        algorithm: "RDFC-1.0",
        messageDigestAlgorithm: "sha256",
        rejectURDNA2015: true,
        signal: budget.signal,
        maxDeepIterations: Math.min(
          blankCount * blankCount,
          budget.limits.rdfDeepIterations,
        ),
      });
      expect(nquads).toBe(
        readPinned(vector.files["canonical.nq"]).toString("utf8"),
      );
      const bytes = encode(document);
      expect(bytes).toEqual(
        new Uint8Array(readPinned(vector.files["canonical.json"])),
      );
      const audit = auditTemplates(
        source,
        vector.profile,
        readJson(vector.files["ids.json"]),
        nquads,
      );
      return { nquads, bytes, audit };
    } finally {
      budget.dispose();
    }
  })();
  observations.set(vector.id, operation);
  return operation;
}

test.each(positives)(
  "production A6 dataset matches the independent complete RDF oracle: $id",
  async (vector) => {
    await observed(vector);
  },
);

test.each(mappingPairs)(
  "complete retained-field pair remains distinct: $id",
  async (pair) => {
    const before = await observed(pair.before),
      after = await observed(pair.after);
    expect(before.nquads).not.toBe(after.nquads);
    expect(before.bytes).not.toEqual(after.bytes);
  },
);

test.each(fieldAccounting.entries)(
  "retained-field evidence: $id ($status)",
  async (entry) => {
    // Coupled projection/branch/state changes remain coupled evidence. These
    // assertions do not relabel them as isolated necessity or mathematical proof.
    const selected = entry.selected;
    readPinned(selected.inventory);
    const results = [];
    for (const side of [selected.sides.before, selected.sides.after]) {
      const vector = positiveById.get(side.fixture);
      expect(vector).toBeDefined();
      expect(vector.files["source.json"]).toEqual(side.source);
      expect(vector.files["canonical.nq"]).toEqual(side.canonicalNQuads);
      expect(vector.files["canonical.json"]).toEqual(side.canonicalBytes);
      const result = await observed(vector);
      const record = result.audit.records.find(
        ({ pointer }) => pointer === side.owner.pointer,
      );
      expect(record).toBeDefined();
      expect(record.descriptor).toBe(side.owner.descriptor);
      expect(record.node).toBe(side.owner.rdfNode);
      expect(record.typeTriples).toEqual(side.owner.typeTriples);
      const field = record.fields[entry.field];
      // Optional omissions have an explicit absent-field trace; a different
      // closed branch has no descriptor entry for that field at all.
      expect(field?.present ?? false).toBe(side.field.present);
      expect(field?.triples ?? []).toEqual(side.field.triples);
      if (side.field.objectTypeTriples) {
        expect(field.objectTypeTriples).toEqual(side.field.objectTypeTriples);
      }
      const predicateFacts = result.nquads
        .split("\n")
        .filter((line) =>
          line.startsWith(`${side.owner.rdfNode} ${side.field.predicate} `),
        );
      expect(predicateFacts.sort()).toEqual([...side.field.triples].sort());
      results.push(result);
    }
    expect(results[0].nquads).not.toBe(results[1].nquads);
    expect(results[0].bytes).not.toEqual(results[1].bytes);
  },
);
