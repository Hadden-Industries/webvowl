// SPDX-License-Identifier: AGPL-3.0-only
// Pins exact independent-oracle guard reasons; does not test the product API.
import assert from "node:assert/strict";
import { produce, profiles } from "../oracle/producer.mjs";
import { seedSources } from "../oracle/seed-sources.mjs";
const base = (id = "empty-structural") =>
  structuredClone(seedSources.find((entry) => entry.id === id).source);
const cases = [];
const add = (id, source, profile, message) =>
  cases.push({ id, source, profile, message });
let source = base("named-class-structural");
source.structural.constructs.push({
  id: "declaration",
  kind: "declaration",
  role: "class-role",
});
add(
  "top-level-declaration",
  source,
  profiles.structural,
  "Oracle has no shape for declaration",
);
source = base("named-class-structural");
source.structural.constructs.push({
  id: "anchor",
  kind: "assertion-anchor",
  assertion: {
    kind: "assertion-anchor",
    assertion: { kind: "declaration", role: "class-role" },
    annotations: [],
  },
  annotations: [],
});
add(
  "nested-anchor",
  source,
  profiles.structural,
  "Oracle has no shape for assertion-anchor",
);
source = base();
source.profile = profiles.artifact;
add(
  "closed-envelope",
  source,
  profiles.structural,
  "Oracle requires the closed source envelope",
);
add(
  "missing-artifact-state",
  base(),
  profiles.artifact,
  "Oracle profile/visualization mismatch",
);
add(
  "extra-structural-state",
  base("empty-artifact"),
  profiles.structural,
  "Oracle profile/visualization mismatch",
);
source = base();
delete source.structural.ontology.imports;
add(
  "missing-imports",
  source,
  profiles.structural,
  "Oracle fixture required field missing: imports",
);
source = base("named-class-artifact");
source.visualization.placements[0].pinned = 1;
add(
  "boolean-type",
  source,
  profiles.artifact,
  "Oracle rejects boolean coercion",
);
for (const number of [-0, Infinity]) {
  source = base("named-class-artifact");
  source.visualization.placements[0].position.x = number;
  add(
    Object.is(number, -0) ? "negative-zero" : "infinity",
    source,
    profiles.artifact,
    "Oracle rejects non-finite/non-number/negative-zero scalar",
  );
}
source = base("empty-artifact");
source.visualization.labelSelection = { mode: "language", range: "en-\u212a" };
add(
  "non-ascii-fold",
  source,
  profiles.artifact,
  "Oracle rejects non-ASCII language spelling",
);
source = base();
source.structural.expressions.push({ id: "invalid", kind: "toString" });
add(
  "inherited-discriminator",
  source,
  profiles.structural,
  "Oracle has no shape for toString",
);
let getterCalls = 0;
source = base();
Object.defineProperty(source.structural.ontology, "iri", {
  enumerable: true,
  get() {
    getterCalls++;
    return "urn:example:o";
  },
});
add(
  "descriptor-without-getter-invocation",
  source,
  profiles.structural,
  "Oracle rejects unsafe fixture descriptors",
);
for (const item of cases)
  await assert.rejects(
    produce(item.source, item.profile),
    { name: "Error", message: item.message },
    item.id,
  );
assert.equal(getterCalls, 0);
console.log(
  JSON.stringify({
    exactGuardReasons: cases.length,
    getterInvocations: getterCalls,
    result: "all exact oracle guard reasons match",
  }),
);
