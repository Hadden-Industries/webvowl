// SPDX-License-Identifier: AGPL-3.0-only
// Metadata correction/coverage index; original reviewed manifests remain immutable.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
const bundle = resolve(here, "..");
const repo = resolve(bundle, "../../..");
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const json = (value) => JSON.stringify(value, null, 2) + "\n";
const writeNew = process.argv.includes("--write-new");
async function pinned(name, value) {
  const target = resolve(here, name),
    data = json(value);
  if (writeNew) {
    try {
      await writeFile(target, data, { flag: "wx" });
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
    }
  }
  assert.equal(
    await readFile(target, "utf8"),
    data,
    `${name}: reviewed metadata is never silently overwritten`,
  );
}
const activeManifestPath = "supplemental/amended-policy/manifest.json";
const activeBytes = await readFile(resolve(bundle, activeManifestPath));
const active = JSON.parse(activeBytes);
const priorMatrix = JSON.parse(
  await readFile(resolve(bundle, "projection-matrix.json"), "utf8"),
);
const vectors = await Promise.all(
  active.vectors.map(async (item) => ({
    ...item,
    source: JSON.parse(
      await readFile(resolve(bundle, item.files["source.json"].path), "utf8"),
    ),
  })),
);
const collection = {
  role: "roles",
  expression: "expressions",
  construct: "constructs",
};
function matches(value, predicate) {
  if (!value || typeof value !== "object") return false;
  return (
    predicate(value) ||
    Object.values(value).some((child) =>
      Array.isArray(child)
        ? child.some((entry) => matches(entry, predicate))
        : matches(child, predicate),
    )
  );
}
function hasRow(source, row) {
  if (collection[row.category])
    return source.structural[collection[row.category]].some(
      (record) =>
        record.kind === row.kind &&
        (!row.characteristic || record.characteristic === row.characteristic),
    );
  if (row.category === "annotation-value")
    return matches(source, (record) => record.kind === row.kind);
  if (row.kind === "ontology") return Boolean(source.structural.ontology);
  if (row.kind === "imports")
    return source.structural.ontology.imports.length > 0;
  return matches(
    source,
    (record) =>
      Array.isArray(record.annotations) && record.annotations.length > 0,
  );
}
const rows = priorMatrix.rows.flatMap((row) =>
  row.kind === "object-characteristic"
    ? [
        "functional",
        "inverse-functional",
        "symmetric",
        "transitive",
        "reflexive",
        "irreflexive",
        "asymmetric",
      ].map((characteristic) => ({
        ...row,
        characteristic,
        presentation: [
          "functional",
          "inverse-functional",
          "symmetric",
          "transitive",
        ].includes(characteristic)
          ? "visual"
          : "details-only",
        condition: [
          "functional",
          "inverse-functional",
          "symmetric",
          "transitive",
        ].includes(characteristic)
          ? "Only a direct construct on the selected named principal of an ordinary edge or inverse direction receives visual property treatment; other members and inverse-expression subjects remain details-only."
          : "Always details-only under B2.5; no additional occurrence.",
        generationRule: "B1/B2.4/B2.5/B4",
      }))
    : [row],
);
for (const row of rows) {
  row.fixtures = vectors
    .filter((vector) => hasRow(vector.source, row))
    .map((vector) => ({
      id: vector.id,
      source: vector.files["source.json"].path,
      canonical: vector.files["canonical.json"].path,
    }));
  row.coverageStatus = row.fixtures.length
    ? "Token/value appears in pinned positive bytes; this does not prove every conditional branch or renderer treatment."
    : "No positive-byte fixture linked; qualification gap.";
}
const grammarRows = rows.filter((row) => collection[row.category]);
assert.ok(
  grammarRows.every((row) => row.fixtures.length),
  "All A2/A3/A4 tokens and characteristic enum values need positive fixtures",
);
await pinned("coverage-matrix.json", {
  status: "independent-token-and-enum-coverage-pending-review",
  activeManifest: { path: activeManifestPath, sha256: sha256(activeBytes) },
  specificationRevision: active.specificationRevision,
  amendment: active.amendment,
  count: {
    roles: rows.filter((r) => r.category === "role").length,
    expressions: rows.filter((r) => r.category === "expression").length,
    constructTokens: new Set(
      rows.filter((r) => r.category === "construct").map((r) => r.kind),
    ).size,
    constructRowsIncludingCharacteristicValues: rows.filter(
      (r) => r.category === "construct",
    ).length,
  },
  limitation:
    "Fixture linkage proves only recorded token/enum presence. Conditional projection, display execution, hostile-input safety, cross-runtime, browser, accessibility and adapter coverage are separately qualified.",
  rows,
});
const corrections = {
  status:
    "explicit-follow-up-review-metadata-corrections-pending-supplement-review",
  frozenArtifactsChanged: false,
  interpretationChecks: [
    {
      rule: "B1/B2.3/B2.4",
      interpretation:
        "Object and data restriction filler nodes use the exact named-property PropertyContext plus originating subclass scope.",
      status:
        "Specific B2.4 interpretation confirmed by Claude first and follow-up reviews.",
    },
    {
      rule: "B2.4",
      interpretation:
        "Inverse-edge from/to follows the forward partition effective domain/range; it does not follow canonical ID order.",
      status:
        "Explicit oracle interpretation recorded for protocol acceptance.",
      fixtures: [
        "matched-inverse",
        "inverse-orientation-opposes-role-rank",
        "singleton-inverse-self-loop",
      ],
    },
    {
      rule: "B1/B2.4",
      interpretation:
        "Operator-edge from is the operator node and to is the operand occurrence.",
      status:
        "Explicit oracle interpretation recorded for protocol acceptance.",
      fixtures: [
        "class-intersection",
        "class-complement",
        "partial-union-projection",
      ],
    },
    {
      rule: "B5",
      interpretation:
        "For anonymous-root-local, every subject is treated as local when root ontology IRI is absent.",
      status:
        "Follow-up reviewer identified wording ambiguity; retained catalog expectation is not silently promoted to an unambiguous normative rule.",
      fixture: "display-vectors.json anonymous-root-local",
    },
    {
      rule: "A2/A5/B2.2",
      interpretation:
        "Absent-endpoint builtin roles are required only if the relation is drawable; an explicit undrawable opposite endpoint leaves the relation details-only and does not require an otherwise-unused default role.",
      status:
        "Independent reading supplied to integration task; protocol acceptance pending.",
      fixtures: [
        "undrawable-range-no-default-role",
        "undrawable-range-declared-thing",
      ],
    },
  ],
  comparisonRules: active.comparisonRules,
  ruleTagSupplements: [
    {
      fixtures: ["matched-inverse", "unmatched-inverse"],
      add: ["B1", "B2.2", "B2.4"],
    },
    {
      fixtures: [
        "object-min-unqualified",
        "object-max-unqualified",
        "object-exact-unqualified",
        "data-min-unqualified",
        "data-max-unqualified",
        "data-exact-unqualified",
        "object-qualified-details",
        "data-qualified-details",
      ],
      add: ["B1", "B2.3", "B2.4"],
    },
  ],
  precedenceQuestions: [
    {
      rules: "A7/D19",
      original: "negative/lone-surrogate/input.bin",
      issue:
        "A7 puts envelope required/known-profile checks before scalar domains; D19 describes rejecting surrogate values during decode construction. Original input also lacks structural and has unknown profile.",
      isolatedCase:
        "supplemental/negative/vectors/lone-surrogate-in-valid-envelope-and-literal/input.bin",
      status:
        "Original bytes/error preserved. Isolated case does not choose the cross-failure precedence. Parent reports production lexical Unicode rejection, which is execution evidence rather than a spec resolution.",
    },
    {
      rules: "A5/A7",
      original: "negative/duplicate-primary-id/source.json",
      issue:
        "Exact copied record overlaps ID, set-member and named-IRI uniqueness checks.",
      isolatedCase:
        "supplemental/negative/vectors/duplicate-id-distinct-subject-iri/source.json",
      status:
        "Original bytes/error preserved; isolated case avoids same-payload and same-IRI duplication.",
    },
  ],
  producerGuardCorrection: {
    source: "supplemental/check-producer-reasons.mjs",
    exactMessageCases: 12,
    getterInvocations: 0,
    originalGuardScriptPreserved: true,
  },
  historicalBudgetEvidence: {
    originalProducer:
      "0e3f988211f5e80b817d8867e6f026ebfeda38f98c88791b7913556f6f8851d3",
    originalProbe: "experiments/rdfc-budget-probe/result.json",
    currentProducerRerun:
      "supplemental/budget/raw/original-per-property-datatype-current-producer/result.json",
    currentProducer:
      "5097d9726c839afc7b4240dcb5527bd5089f5f847d788e9b32b6d3dd67699fd1",
    sameMinimumPassingBudget: 72,
    originalAndRerunGraphBytesUnchanged: true,
    oldRejections:
      "Pinned library operational evidence under superseded linear policy; never language-neutral RDF invalidity.",
  },
};
await pinned("review-corrections.json", corrections);
async function walk(path = "") {
  const result = [];
  for (const entry of await readdir(resolve(bundle, path), {
    withFileTypes: true,
  })) {
    const child = path ? `${path}/${entry.name}` : entry.name;
    if (entry.isDirectory()) result.push(...(await walk(child)));
    else result.push(child);
  }
  return result;
}
const paths = (await walk())
  .filter(
    (path) =>
      path.endsWith(".mjs") ||
      /(?:^|\/)manifest\.json$/.test(path) ||
      /(?:^|\/)(?:negative-manifest|extended-manifest|projection-matrix|display-vectors|coverage-matrix|review-corrections|growth-results|symmetry-results|retained-positive-proof)\.json$/.test(
        path,
      ) ||
      path === "experiments/rdfc-budget-probe/result.json" ||
      /^supplemental\/budget\/raw\/[^/]+\/(?:result\.json|mapped\.nq|canonical\.nq|source\.json)$/.test(
        path,
      ) ||
      /^supplemental\/budget\/raw-symmetry\/[^/]+\/(?:input|canonical)\.nq$/.test(
        path,
      ),
  )
  .sort();
const artifacts = [];
for (const path of paths) {
  const bytes = await readFile(resolve(bundle, path));
  artifacts.push({ path, sha256: sha256(bytes), byteLength: bytes.length });
}
const rdfcPath = "node_modules/rdf-canonize/lib/RDFC10.js";
const rdfcBytes = await readFile(resolve(repo, rdfcPath));
await pinned("provenance-index.json", {
  status:
    "reviewed-corpus-preservation-and-supplemental-provenance-pending-review",
  specificationRevision: active.specificationRevision,
  amendment: active.amendment,
  activeManifest: activeManifestPath,
  independentOracle:
    "No production mapping, projection, validation, ID code or tests were read, imported or used to select outputs.",
  dependencies: active.dependencies,
  standardsLibraryCounterEvidence: {
    path: rdfcPath,
    sha256: sha256(rdfcBytes),
    lines: [119, 148, 274, 275, 279, 366],
    conclusion:
      "remainingDeepIterations is initialized once per canonicalization operation; every top-level or recursive hashNDegreeQuads call checks/decrements the same global counter. The bounded binary search measures the minimum accepted parameter for the exact graph/library, not a portable semantic property.",
  },
  artifacts,
});
console.log(
  JSON.stringify({
    grammarRows: grammarRows.length,
    coverageRows: rows.length,
    positiveFixtures: vectors.length,
    pinnedSourceAndMetadataArtifacts: artifacts.length,
    result: "separate coverage/correction/provenance indexes match",
  }),
);
