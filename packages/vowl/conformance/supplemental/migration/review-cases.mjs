// SPDX-License-Identifier: AGPL-3.0-only
// Four independent protocol follow-ups; no product code or output is imported.
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { produce } from "../amended-policy/producer.mjs";
import { applyPatches, inputText } from "./compact.mjs";
import { loadCorpus as loadPreviousCorpus } from "./language-signature-erratum.mjs";
import {
  checkRun,
  verifyIndependent,
  verifyPublic as verifyPreviousPublic,
} from "./verify.mjs";
import {
  dependencies,
  hash,
  here,
  json,
  localPin,
  pin,
  readPinned,
} from "./support.mjs";

export { checkRun };
const clone = (value) => JSON.parse(JSON.stringify(value));
const predecessorPins = [
  {
    path: "supplemental/migration/manifest.json",
    sha256: "505fce8a138664b312f17aad79315fbdf7a5977e30a3e6571f7b1295a6364a90",
  },
  {
    path: "supplemental/migration/language-signature-erratum.json",
    sha256: "6708e4d76a23be3463d198efff1c2c1c8b3af9385b37d13a7b16aedf89a7734e",
  },
  {
    path: "supplemental/migration/expected-successes.json",
    sha256: "7af731ac93d6d6b30ae69ecaf221c85f42c8b03bff1080f2db44efbaa6869bf6",
  },
];
const A = "https://example.org/legacy#A";
const B = "https://example.org/legacy#B";
const C = "https://example.org/legacy#C";
const viewport = {
  kind: "viewport",
  sourcePointer: "/settings/global/translation",
  width: 640,
  height: 480,
};

function baseline(corpus, id) {
  const run = corpus.runs.find((candidate) => candidate.id === id);
  assert(run?.expected, id);
  return {
    run,
    input: applyPatches(
      corpus.manifest.seeds[run.input.seed],
      run.input.patches,
    ),
    source: clone(run.expected.source),
  };
}

function disjointInput(disjoint, saved, hidden) {
  const input = clone(disjoint.input);
  input.settings = clone(saved.input.settings);
  input.settings.filter.checkBox.find(
    (item) => item.id === "disjointFilterCheckbox",
  ).checked = hidden;
  for (const attribute of input.classAttribute) {
    assert([A, B].includes(attribute.iri));
    attribute.pos = attribute.iri === A ? [-3, 4] : [12, 18];
    attribute.pinned = attribute.iri === B;
  }
  assert.equal(input.propertyAttribute.length, 1);
  input.propertyAttribute[0].pos = [4.5, 11];
  input.propertyAttribute[0].pinned = false;
  return input;
}

function disjointSource(disjoint, saved, hidden) {
  const source = clone(disjoint.source);
  assert.equal(
    source.structural.occurrences.filter((item) => item.kind === "class-node")
      .length,
    2,
  );
  const edge = source.structural.occurrences.find(
    (item) => item.kind === "disjoint-edge",
  );
  assert(edge);
  assert(!source.structural.occurrences.some((item) => item.kind === "label"));
  source.visualization = clone(saved.source.visualization);
  source.visualization.placements = source.structural.occurrences
    .filter((item) => item.kind === "class-node")
    .map((node) => {
      assert.equal(node.targets.length, 1);
      const isA = node.targets[0] === "class-A";
      assert(isA || node.targets[0] === "class-B");
      return {
        occurrence: node.id,
        position: isA ? { x: -3, y: 4 } : { x: 12, y: 18 },
        pinned: !isA,
      };
    });
  source.visualization.hidden = hidden ? [edge.id] : [];
  assert.equal(source.visualization.placements.length, 2);
  assert(
    !source.visualization.placements.some(
      (placement) => placement.occurrence === edge.id,
    ),
  );
  return source;
}

function mixedTriangle(seed, kind) {
  const input = clone(seed);
  const identities = [
    ["A-owl", A, "owl:Class"],
    ["B-owl", B, "owl:Class"],
    ["C-owl", C, "owl:Class"],
    ["B-rdf", B, "rdfs:Class"],
    ["C-rdf", C, "rdfs:Class"],
  ];
  const pairs = [
    ["A-owl", "B-owl"],
    ["A-owl", "C-owl"],
    ["B-rdf", "C-rdf"],
  ];
  input.class = identities.map(([id, , type]) => ({ id, type }));
  input.classAttribute = identities.map(([id, iri, type]) => ({
    id,
    iri,
    baseIri: "https://example.org/legacy",
    label: { "IRI-based": iri.slice(iri.lastIndexOf("#") + 1) },
    instances: 0,
    ...(type === "rdfs:Class" ? { attributes: ["rdf"] } : {}),
  }));
  input.property = [];
  input.propertyAttribute = [];
  if (kind === "equivalence") {
    for (const [first, second] of pairs) {
      for (const [from, to] of [
        [first, second],
        [second, first],
      ]) {
        const attribute = input.classAttribute.find((item) => item.id === from);
        attribute.equivalent ??= [];
        attribute.equivalent.push(to);
      }
    }
  } else {
    assert.equal(kind, "disjointness");
    for (const [index, [domain, range]] of pairs.entries()) {
      const id = `relation-${index}`;
      input.property.push({ id, type: "owl:disjointWith" });
      input.propertyAttribute.push({
        id,
        domain,
        range,
        attributes: ["anonymous", "object"],
      });
    }
  }
  input.metrics.classCount = 5;
  input.metrics.nodeCount = 5;
  input.metrics.propertyCount = input.property.length;
  const byId = new Map(
    identities.map(([id, iri, type]) => [id, { iri, type }]),
  );
  for (const [first, second] of pairs)
    assert.equal(byId.get(first).type, byId.get(second).type);
  const rawDegree = new Map();
  for (const [first, second] of pairs) {
    rawDegree.set(first, (rawDegree.get(first) ?? 0) + 1);
    rawDegree.set(second, (rawDegree.get(second) ?? 0) + 1);
  }
  assert.equal(
    [...rawDegree.values()].filter((degree) => degree === 2).length,
    1,
  );
  const namedPairs = pairs.map((pair) =>
    pair.map((id) => byId.get(id).iri).sort(),
  );
  assert.deepEqual(
    namedPairs.map((pair) => pair.join("\n")).sort(),
    [
      [A, B],
      [A, C],
      [B, C],
    ]
      .map((pair) => pair.join("\n"))
      .sort(),
  );
  return {
    input,
    proof: {
      rawVertices: 5,
      rawEdges: 3,
      everyRawEdgeCategoryHomogeneous: true,
      rawGraphHasTriangle: false,
      resolvedNamedVertices: [A, B, C],
      resolvedNamedPairs: namedPairs,
    },
  };
}

export async function derive() {
  for (const reference of [...predecessorPins, ...dependencies])
    await readPinned(reference);
  const previous = await loadPreviousCorpus();
  assert.equal(previous.runs.length, 67);
  const disjoint = baseline(previous, "named-disjoint-structural");
  const saved = baseline(previous, "subclass-label-placement-artifact");
  const vectors = [];
  for (const hidden of [false, true]) {
    const source = disjointSource(disjoint, saved, hidden);
    const output = await produce(source, saved.run.profile);
    const text = inputText(disjointInput(disjoint, saved, hidden));
    vectors.push({
      id: hidden
        ? "binary-disjoint-artifact-filter-on"
        : "binary-disjoint-artifact-filter-off",
      dialect: saved.run.dialect,
      profile: saved.run.profile,
      input: {
        encoding: "UTF-8",
        text,
        sha256: hash(text),
        byteLength: Buffer.byteLength(text),
      },
      resolutions: [viewport],
      outcome: "success",
      rules: ["A9.3", "B2.4", "B3"],
      diagnostics: [
        {
          code: "MIGRATION_DROPPED_FIELD",
          severity: "warning",
          sourcePointer: "/propertyAttribute/0/pos",
        },
        {
          code: "MIGRATION_DROPPED_FIELD",
          severity: "warning",
          sourcePointer: "/propertyAttribute/0/pinned",
        },
        {
          code: "MIGRATION_RESOLVED_FIELD",
          severity: "warning",
          sourcePointer: "/settings/global/translation",
        },
      ],
      rationale:
        "B2 disjoint edges have no label and B3 forbids edge placements. Explicit legacy property position/pin fields therefore drop with exact field diagnostics. Both node placements and explicit pin values remain required. Disjoint filtering hides only the edge; no label or replacement coordinate is created.",
      expected: {
        source,
        mappedDefaultGraphNQuads: output.mappedNQuads,
        canonicalNQuads: output.canonicalNQuads,
        primaryCorrespondence: output.correspondence,
        canonicalBytes: {
          encoding: "UTF-8",
          text: output.bytes.toString("utf8"),
          sha256: hash(output.bytes),
          byteLength: output.bytes.length,
        },
      },
    });
  }
  assert.notEqual(
    vectors[0].expected.canonicalBytes.sha256,
    vectors[1].expected.canonicalBytes.sha256,
  );
  for (const kind of ["equivalence", "disjointness"]) {
    const { input, proof } = mixedTriangle(previous.manifest.seeds.named, kind);
    const text = inputText(input);
    vectors.push({
      id: `mixed-class-categories-${kind}-named-triangle`,
      dialect: disjoint.run.dialect,
      profile: disjoint.run.profile,
      input: {
        encoding: "UTF-8",
        text,
        sha256: hash(text),
        byteLength: Buffer.byteLength(text),
      },
      resolutions: [],
      outcome: "error",
      errorCode: "MIGRATION_AMBIGUOUS",
      rules: ["A2", "A9.3", "legacy ingress named-identity triangle rule"],
      proof,
      rationale:
        "The OWL graph contains A-B and A-C, while the RDF-class graph contains B'-C'. B' and C' have the exact IRIs of B and C. A2 removes generic rdf-class roles where class roles exist; named identity resolution therefore exposes A-B-C's complete triangle. Historical n-ary grouping is not recoverable merely because raw IDs or pre-promotion class categories partition its edges.",
    });
  }
  assert.equal(vectors.length, 4);
  return {
    previous,
    supplement: {
      format: "independent-canonical-vowl-migration-review-cases-v1",
      scope:
        "Exactly two disjoint artifact successes and two mixed-category named-identity triangle rejections; no product code or output used. All preceding inputs, outputs and case dispositions remain unchanged.",
      predecessorPins,
      authorities: [
        ...previous.manifest.specificationRevision,
        ...previous.manifest.migrationAuthorities,
      ],
      independentDependencies: dependencies,
      producerSources: await Promise.all(
        [
          "review-cases.mjs",
          "language-signature-erratum.mjs",
          "compact.mjs",
          "verify.mjs",
          "support.mjs",
        ].map(localPin),
      ),
      independentDraft: {
        sha256:
          "9c0aa2c9135d8d3897a0e4a4095338415848e4be49304287a0ddf206febd6279",
        scope:
          "The four inputs and expected models were drafted in external task evidence before the disjoint contract wording and formatting pins settled. No expected bytes came from product output.",
      },
      diagnosticMatching:
        "Require each listed code, warning severity and exact sourcePointer. Other independently justified dropped-field diagnostics may also occur; unspecified prose and warning count are not frozen. Error fixtures require MIGRATION_AMBIGUOUS and return no document.",
      vectors,
    },
  };
}

export async function loadCorpus() {
  const { previous, supplement: derived } = await derive();
  const bytes = await readFile(resolve(here, "review-cases.json"));
  const recorded = JSON.parse(bytes);
  assert.deepEqual(
    recorded,
    derived,
    "Review cases differ from independent derivation",
  );
  for (const reference of [
    ...recorded.authorities,
    ...recorded.independentDependencies,
    ...recorded.producerSources,
  ])
    await readPinned(reference);
  const runs = recorded.vectors.map((vector) => {
    const inputBytes = Buffer.from(vector.input.text, "utf8");
    assert.equal(inputBytes.length, vector.input.byteLength);
    assert.equal(hash(inputBytes), vector.input.sha256);
    return { ...vector, bytes: inputBytes };
  });
  assert.equal(
    new Set([...previous.runs, ...runs].map((run) => run.id)).size,
    71,
  );
  return {
    ...previous,
    reviewCasesSha256: hash(bytes),
    runs: [...previous.runs, ...runs],
  };
}

export async function verifyPublic(api, corpus) {
  return verifyPreviousPublic(api, corpus ?? (await loadCorpus()));
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  if (process.argv.includes("--write-new")) {
    const { supplement } = await derive();
    await pin("review-cases.json", json(supplement));
  }
  const corpus = await loadCorpus();
  console.log(
    JSON.stringify({
      ...(await verifyIndependent(corpus)),
      supplementalVectors: 4,
      precedingVectors: 67,
      reviewCasesSha256: corpus.reviewCasesSha256,
      writes: process.argv.includes("--write-new") ? "new-only" : "none",
    }),
  );
}
