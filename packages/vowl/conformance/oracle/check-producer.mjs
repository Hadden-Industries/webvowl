// SPDX-License-Identifier: AGPL-3.0-only
// Oracle guard regressions; not tests of the production Canonical VOWL package.
import assert from "node:assert/strict";
import { produce, profiles } from "./producer.mjs";
import { seedSources } from "./seed-sources.mjs";
const base = (id) =>
  structuredClone(seedSources.find((entry) => entry.id === id).source);
const checks = [];
const check = (id, source, profile) => checks.push({ id, source, profile });
let source = base("named-class-structural");
source.structural.constructs.push({
  id: "declaration",
  kind: "declaration",
  role: "class-role",
});
check("top-level-declaration-rejected", source, profiles.structural);
source = base("named-class-structural");
source.structural.constructs.push({
  id: "nested",
  kind: "assertion-anchor",
  assertion: {
    kind: "assertion-anchor",
    assertion: { kind: "declaration", role: "class-role" },
    annotations: [],
  },
  annotations: [],
});
check("nested-assertion-anchor-rejected", source, profiles.structural);
source = base("empty-structural");
source.profile = profiles.artifact;
check("source-profile-override-rejected", source, profiles.structural);
check(
  "missing-artifact-state-rejected",
  base("empty-structural"),
  profiles.artifact,
);
check(
  "extra-structural-state-rejected",
  base("empty-artifact"),
  profiles.structural,
);
source = base("empty-structural");
delete source.structural.ontology.imports;
check("missing-required-field-rejected", source, profiles.structural);
source = base("named-class-artifact");
source.visualization.placements[0].pinned = 1;
check("boolean-coercion-rejected", source, profiles.artifact);
source = base("named-class-artifact");
source.visualization.placements[0].position.x = -0;
check("negative-zero-rejected", source, profiles.artifact);
source = base("named-class-artifact");
source.visualization.camera.zoom = Infinity;
check("nonfinite-number-rejected", source, profiles.artifact);
source = base("empty-artifact");
source.visualization.labelSelection = { mode: "language", range: "en-\u212a" };
check("unicode-to-ascii-language-fold-rejected", source, profiles.artifact);
source = base("empty-structural");
source.structural.expressions.push({ id: "invalid", kind: "toString" });
check("inherited-discriminator-name-rejected", source, profiles.structural);
let getterCalls = 0;
source = base("empty-structural");
Object.defineProperty(source.structural.ontology, "iri", {
  enumerable: true,
  get() {
    getterCalls++;
    return "urn:example:o";
  },
});
check("getter-not-invoked", source, profiles.structural);
for (const fixture of checks)
  await assert.rejects(
    produce(fixture.source, fixture.profile),
    { name: "Error" },
    fixture.id,
  );
assert.equal(getterCalls, 0);
const uppercase = base("empty-artifact");
uppercase.visualization.labelSelection = { mode: "language", range: "EN-gb" };
const lowercase = structuredClone(uppercase);
lowercase.visualization.labelSelection.range = "en-gb";
assert.deepEqual(
  (await produce(uppercase, profiles.artifact)).bytes,
  (await produce(lowercase, profiles.artifact)).bytes,
);
console.log(
  JSON.stringify({
    rejectedGuardCases: checks.length,
    asciiCaseMetamorphic: "pass",
  }),
);
