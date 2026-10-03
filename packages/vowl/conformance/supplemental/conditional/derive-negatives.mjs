// SPDX-License-Identifier: AGPL-3.0-only
// Clause-targeted invalid topology derived from the normative generation rules.
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { conditionalSources } from "./sources.mjs";
import { extendedSources } from "../../oracle/extended-sources.mjs";
import { grammarSources } from "../grammar/sources.mjs";
import { profiles } from "../amended-policy/producer.mjs";
const here = dirname(fileURLToPath(import.meta.url)),
  bundle = resolve(here, "../..");
const recipes = [...conditionalSources, ...extendedSources, ...grammarSources];
const hash = (value) => createHash("sha256").update(value).digest("hex");
const json = (value) => JSON.stringify(value, null, 2) + "\n";
const cases = [];
function add(id, base, change, clauses, expectedError = "PROJECTION_INVALID") {
  const source = structuredClone(
    recipes.find((item) => item.id === base).source,
  );
  change(source);
  cases.push({ id, source, sourceFixture: base, clauses, expectedError });
}
add(
  "generic-node-missing-context",
  "generic-context-shared",
  (s) => {
    delete s.structural.occurrences.find((o) => o.id === "generic").context;
  },
  ["B23-opposite-class-targets"],
);
add(
  "generic-context-uses-occurrence-id",
  "generic-context-shared",
  (s) => {
    s.structural.occurrences.find((o) => o.id === "generic").context.targets = [
      "node-A",
    ];
  },
  ["B1-context-semantic-references"],
  "REFERENCE_KIND",
);
add(
  "ordinary-class-node-extra-context",
  "generic-context-split",
  (s) => {
    s.structural.occurrences.find((o) => o.id === "node-A").context = {
      kind: "class",
      targets: ["B"],
    };
  },
  ["B23-context-free-ordinary"],
);
add(
  "same-generic-key-split-into-two-nodes",
  "generic-context-shared",
  (s) => {
    s.structural.occurrences.push({
      ...s.structural.occurrences.find((o) => o.id === "generic"),
      id: "duplicate-generic",
    });
    s.structural.occurrences.find((o) => o.id === "edge-q").from =
      "duplicate-generic";
  },
  ["B23-reuse-keys"],
  "RECORD_DUPLICATE",
);
add(
  "different-generic-contexts-collapsed",
  "generic-context-split",
  (s) => {
    s.structural.occurrences = s.structural.occurrences.filter(
      (o) => o.id !== "generic-B",
    );
    s.structural.occurrences.find((o) => o.id === "edge-q").from = "generic-A";
  },
  ["B23-split-contexts"],
);
add(
  "partition-datatype-context-drops-alias",
  "data-equivalence-transitive",
  (s) => {
    s.structural.occurrences.find(
      (o) => o.id === "datatype-main",
    ).context.properties = ["p"];
  },
  ["B23-full-partition-context"],
);
add(
  "generic-datatype-opposite-uses-class-context",
  "data-one-absent-domain",
  (s) => {
    s.structural.occurrences.find((o) => o.id === "generic").context = {
      kind: "class",
      targets: ["A"],
    };
  },
  ["B23-opposite-datatype-context"],
);
add(
  "property-edge-reverses-effective-endpoints",
  "object-one-absent-domain",
  (s) => {
    const edge = s.structural.occurrences.find((o) => o.id === "edge");
    [edge.from, edge.to] = [edge.to, edge.from];
  },
  ["B24-property-domain-range"],
);
add(
  "equivalence-partition-merges-unequal-terms",
  "object-equivalence-partitioned",
  (s) => {
    s.structural.occurrences
      .find((o) => o.id === "edge-main")
      .properties.push("r");
  },
  ["B22-unequal-partitions"],
);
add(
  "same-class-glyphs-do-not-merge-property-terms",
  "generic-context-grouped",
  (s) => {
    s.structural.occurrences = s.structural.occurrences.filter(
      (o) => !["edge-q", "label-edge-q-single"].includes(o.id),
    );
    s.structural.occurrences.find((o) => o.id === "edge-p").properties = [
      "p",
      "q",
    ];
  },
  ["B22-exact-terms-not-glyphs"],
);
add(
  "undrawable-class-expression-invented-node",
  "subclass-either-term-undrawable",
  (s) => {
    s.structural.occurrences.push({
      id: "invented",
      kind: "class-node",
      targets: ["some"],
    });
  },
  ["B21-undrawable-expressions"],
);
add(
  "unattached-generic-invented-node",
  "unattached-generics-and-datatype",
  (s) => {
    s.structural.occurrences.push({
      id: "invented",
      kind: "class-node",
      targets: ["Thing"],
    });
  },
  ["B21-unattached-generic"],
);
add(
  "inverse-replacement-retains-ordinary-edge",
  "matched-inverse",
  (s) => {
    s.structural.occurrences.push(
      {
        id: "ordinary-p",
        kind: "property-edge",
        properties: ["p"],
        from: "node-A",
        to: "node-B",
      },
      {
        id: "ordinary-p-label",
        kind: "label",
        edge: "ordinary-p",
        direction: "single",
      },
    );
  },
  ["B24-inverse-replacement"],
);
add(
  "inverse-orientation-chosen-by-role-id",
  "inverse-orientation-opposes-role-rank",
  (s) => {
    const edge = s.structural.occurrences.find(
      (o) => o.kind === "inverse-edge",
    );
    [edge.forward, edge.reverse] = [edge.reverse, edge.forward];
    [edge.from, edge.to] = [edge.to, edge.from];
  },
  ["B24-inverse-orientation"],
);
add(
  "inverse-direction-label-missing",
  "matched-inverse",
  (s) => {
    s.structural.occurrences = s.structural.occurrences.filter(
      (o) => o.id !== "reverse-label",
    );
  },
  ["B24-inverse-labels"],
);
add(
  "one-of-multiple-inverse-constructs-omitted",
  "multiple-explicit-inverse-pairs",
  (s) => {
    s.structural.occurrences = s.structural.occurrences.filter(
      (o) =>
        !["inverse-edge-r", "forward-label-r", "reverse-label-r"].includes(
          o.id,
        ),
    );
  },
  ["B24-multiple-inverse-constructs"],
);
add(
  "disjoint-one-drawable-member-invented-loop",
  "disjoint-1-drawable-members",
  (s) => {
    s.structural.occurrences.push({
      id: "invented-loop",
      kind: "disjoint-edge",
      construct: "disjoint",
      ends: ["node-A"],
    });
  },
  ["B24-disjoint-not-false-singleton"],
);
add(
  "disjoint-triad-missing-one-pair",
  "disjoint-triad",
  (s) => {
    s.structural.occurrences = s.structural.occurrences.filter(
      (o) => o.id !== "disjoint-2",
    );
  },
  ["B24-disjoint-pairs"],
);
add(
  "disjoint-edge-invented-positionable-label",
  "disjoint-triad",
  (s) => {
    s.structural.occurrences.push({
      id: "invented-label",
      kind: "label",
      edge: "disjoint-0",
      direction: "single",
    });
  },
  ["B24-no-operator-disjoint-labels"],
);
add(
  "operator-edge-invented-positionable-label",
  "operator-grouped-operand-dedup",
  (s) => {
    s.structural.occurrences.push({
      id: "invented-label",
      kind: "label",
      edge: "operator-union-0",
      direction: "single",
    });
  },
  ["B24-no-operator-disjoint-labels"],
);
add(
  "operator-connection-duplicated-after-grouping",
  "operator-grouped-operand-dedup",
  (s) => {
    s.structural.occurrences.push({
      ...s.structural.occurrences.find((o) => o.id === "operator-union-0"),
      id: "duplicate-connection",
    });
  },
  ["B24-operator-dedup"],
  "RECORD_DUPLICATE",
);
add(
  "operator-node-missing-for-all-undrawable-operands",
  "operator-no-drawable-operands",
  (s) => {
    s.structural.occurrences = s.structural.occurrences.filter(
      (o) =>
        !["node-union", "subclass-edge", "label-subclass-edge-single"].includes(
          o.id,
        ),
    );
  },
  ["B21-operator-singletons", "B24-operator-undrawable"],
);
add(
  "restriction-context-borrows-global-alias",
  "object-restriction-excludes-global-alias",
  (s) => {
    s.structural.occurrences.find(
      (o) => o.id === "restriction-target",
    ).context.properties = ["p", "q"];
  },
  ["B23-restriction-exact-role"],
);
add(
  "restriction-context-omits-scope",
  "object-exact-unqualified",
  (s) => {
    delete s.structural.occurrences.find((o) => o.id === "restriction-target")
      .context.scope;
  },
  ["B23-restriction-scope"],
);
add(
  "restriction-context-uses-generic-class-context",
  "object-exact-unqualified",
  (s) => {
    s.structural.occurrences.find(
      (o) => o.id === "restriction-target",
    ).context = { kind: "class", targets: ["A"] };
  },
  ["B23-restriction-exact-role"],
);
add(
  "restriction-label-missing",
  "object-exact-unqualified",
  (s) => {
    s.structural.occurrences = s.structural.occurrences.filter(
      (o) => o.id !== "label-restriction-edge",
    );
  },
  ["B24-single-labels"],
);
add(
  "inverse-artifact-label-placement-missing",
  "artifact-all-positionable-matched-inverse",
  (s) => {
    s.visualization.placements = s.visualization.placements.filter(
      (p) => p.occurrence !== "reverse-label",
    );
  },
  ["B24-positionable"],
  "ARTIFACT_INCOMPLETE",
);
add(
  "restriction-artifact-edge-placement-forbidden",
  "artifact-all-positionable-object-exact-unqualified",
  (s) => {
    s.visualization.placements.push({
      occurrence: "restriction-edge",
      position: { x: 0, y: 0 },
      pinned: false,
    });
  },
  ["B24-no-edge-placement"],
  "ARTIFACT_INCOMPLETE",
);
add(
  "unknown-occurrence-token-has-no-default",
  "mixed-class-rdfs-equivalence-group",
  (s) => {
    s.structural.occurrences[0].kind = "unknown-node";
  },
  ["B25-no-unknown-kind-default"],
  "DOCUMENT_TYPE",
);
add(
  "characteristic-copy-on-occurrence-forbidden",
  "characteristics-principal-and-alias",
  (s) => {
    s.structural.occurrences.find(
      (o) => o.kind === "property-edge",
    ).characteristic = "symmetric";
  },
  ["B1-no-semantic-copy"],
  "DOCUMENT_UNKNOWN_FIELD",
);
assert.equal(new Set(cases.map((item) => item.id)).size, cases.length);
async function pinned(path, value) {
  const bytes = Buffer.from(value),
    target = resolve(here, path);
  if (
    process.argv.includes("--update-provenance") &&
    path.endsWith("manifest.json")
  ) {
    const previous = JSON.parse(await readFile(target, "utf8"));
    const next = JSON.parse(bytes);
    assert.deepEqual(
      previous,
      {
        ...next,
        sourceArtifacts: previous.sourceArtifacts,
        positiveManifest: previous.positiveManifest,
      },
      "Only source and unchanged-positive-corpus identity may update; all negative expectations stay frozen",
    );
    await writeFile(target, bytes);
  }
  if (process.argv.includes("--write-new")) {
    await mkdir(dirname(target), { recursive: true });
    try {
      await writeFile(target, bytes, { flag: "wx" });
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
    }
  }
  assert.deepEqual(
    await readFile(target),
    bytes,
    `${path}: no negative expectation overwrite`,
  );
  return {
    path: `supplemental/conditional/${path}`,
    sha256: hash(bytes),
    byteLength: bytes.length,
  };
}
const vectors = [];
for (const { source, ...fixture } of cases)
  vectors.push({
    ...fixture,
    operation: "canonicalize",
    profile: source.visualization ? profiles.artifact : profiles.structural,
    status: "independently-derived-pending-review-and-production-comparison",
    input: await pinned(`negative/${fixture.id}/source.json`, json(source)),
  });
const positiveBytes = await readFile(resolve(here, "manifest.json")),
  positive = JSON.parse(positiveBytes);
const sourceArtifacts = [];
for (const path of [
  "oracle/extended-sources.mjs",
  "supplemental/grammar/sources.mjs",
  "supplemental/conditional/sources.mjs",
  "supplemental/conditional/derive-negatives.mjs",
])
  sourceArtifacts.push({
    path,
    sha256: hash(await readFile(resolve(bundle, path))),
  });
await pinned(
  "negative-manifest.json",
  json({
    format: "canonical-vowl-negative-manifest/1",
    status: "independent-conditional-negatives-pending-review",
    specificationRevision: positive.specificationRevision,
    amendment: positive.amendment,
    sourceArtifacts,
    positiveManifest: {
      path: "supplemental/conditional/manifest.json",
      sha256: hash(positiveBytes),
    },
    precedence:
      "IDs/references/semantic record uniqueness precede exact projection; malformed closed shapes precede both. Duplicate semantic occurrence generation keys use RECORD_DUPLICATE under A5/A7.",
    vectors,
  }),
);
console.log(
  JSON.stringify({
    newNegativeCases: vectors.length,
    result:
      "clause-targeted error inputs reproduce; production comparison pending",
  }),
);
