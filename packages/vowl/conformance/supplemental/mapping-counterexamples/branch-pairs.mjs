// SPDX-License-Identifier: AGPL-3.0-only
// Discriminator changes keep required branch/reference companions explicit.
import assert from "node:assert/strict";
import {
  baseConstructVariants,
  expressionVariants,
} from "../field-contract/contracts.mjs";
import { at, profiles } from "../field-contract/support.mjs";
import { corePairs } from "./core-pairs.mjs";
import { valueStatePairs } from "./value-state-pairs.mjs";
import { model, projectFixture, IRIS } from "./model.mjs";
const literal = {
  kind: "typed",
  lexical: "branch value",
  datatype: IRIS.string,
};
const dataKinds = new Set([
  "data-intersection",
  "data-union",
  "data-complement",
  "data-enumeration",
  "datatype-restriction",
]);
function fromSource(source) {
  const m = model();
  Object.assign(m.structural, structuredClone(source.structural));
  return m;
}
export function branchPairs() {
  const cores = corePairs(),
    values = valueStatePairs(),
    pairs = [];
  function finish(
    id,
    descriptor,
    field,
    before,
    after,
    path,
    otherDescriptor,
    reason,
    extras = [],
  ) {
    if (!before.visualization) {
      projectFixture(before);
      projectFixture(after);
    }
    pairs.push({
      id,
      descriptor,
      field,
      path,
      profile: before.visualization ? profiles.artifact : profiles.structural,
      before,
      after,
      obligation: `mapping/${descriptor}/${field}`,
      additionalObligations: [
        ...(otherDescriptor ? [`mapping/${otherDescriptor}/${field}`] : []),
        ...extras,
      ],
      reason,
    });
  }
  for (const kind of Object.keys(expressionVariants)) {
    const witness = cores.find(
      (item) => item.descriptor === `Expression:${kind}`,
    );
    const m = fromSource(witness.before);
    m.classes();
    const original = m.structural.expressions.find(
      (item) => item.id === "focus",
    );
    const sameFields = {
      "class-union": "class-intersection",
      "class-intersection": "class-union",
      "object-some": "object-all",
      "object-all": "object-some",
      "data-some": "data-all",
      "data-all": "data-some",
      "object-min-cardinality": "object-max-cardinality",
      "object-max-cardinality": "object-exact-cardinality",
      "object-exact-cardinality": "object-min-cardinality",
      "data-min-cardinality": "data-max-cardinality",
      "data-max-cardinality": "data-exact-cardinality",
      "data-exact-cardinality": "data-min-cardinality",
      "data-union": "data-intersection",
      "data-intersection": "data-union",
    };
    let replacement;
    if (sameFields[kind]) replacement = { ...original, kind: sameFields[kind] };
    else if (kind === "class-complement")
      replacement = {
        id: "focus",
        kind: "data-complement",
        operand: m.alternatives("D")[0],
      };
    else if (kind === "data-complement")
      replacement = { id: "focus", kind: "class-complement", operand: "A" };
    else if (kind === "object-self")
      replacement = {
        id: "focus",
        kind: "object-inverse",
        property: m.alternatives("P")[0],
      };
    else if (kind === "object-inverse")
      replacement = {
        id: "focus",
        kind: "object-self",
        property: m.alternatives("P")[0],
      };
    else if (kind === "object-value") {
      m.role("string", "datatype");
      replacement = {
        id: "focus",
        kind: "data-value",
        property: m.alternatives("DP")[0],
        value: literal,
      };
    } else if (kind === "data-value")
      replacement = {
        id: "focus",
        kind: "object-value",
        property: m.alternatives("P")[0],
        value: m.alternatives("I")[0],
      };
    else if (kind === "datatype-restriction")
      replacement = {
        id: "focus",
        kind: "data-enumeration",
        members: [literal],
      };
    else if (kind === "data-enumeration")
      replacement = {
        id: "focus",
        kind: "datatype-restriction",
        datatype: m.alternatives("D")[0],
        facets: [{ facet: "urn:mapping-pair:facet", value: literal }],
      };
    else {
      assert.equal(kind, "class-enumeration");
      replacement = { id: "focus", kind: "class-union", members: ["A"] };
    }
    if (dataKinds.has(replacement.kind)) m.alternatives("DP");
    if (JSON.stringify(replacement).includes(IRIS.string))
      m.role("string", "datatype");
    const before = structuredClone(m.source),
      after = structuredClone(m.source);
    const index = after.structural.expressions.findIndex(
      (item) => item.id === "focus",
    );
    after.structural.expressions[index] = structuredClone(replacement);
    const owner = after.structural.constructs.findIndex(
      (item) => item.id === "expression-owner",
    );
    if (dataKinds.has(replacement.kind))
      after.structural.constructs[owner] = {
        id: "expression-owner",
        kind: "data-range",
        property: "dp",
        target: "focus",
      };
    else
      after.structural.constructs[owner] = {
        id: "expression-owner",
        kind: "key",
        class: replacement.kind === "object-inverse" ? "A" : "focus",
        objectProperties:
          replacement.kind === "object-inverse" ? ["focus"] : [],
        dataProperties: [],
      };
    finish(
      `expression-kind-${kind}`,
      `Expression:${kind}`,
      "kind",
      before,
      after,
      ["structural", "expressions", index],
      `Expression:${replacement.kind}`,
      "Where constructor fields or result sorts differ, their closed shapes, typed reference values and reachability owner change together; B2 projection is regenerated. Same-shape/sort alternatives can isolate the token.",
    );
  }
  for (const family of ["Construct", "Assertion"]) {
    const kinds = [
      ...Object.keys(baseConstructVariants),
      ...(family === "Assertion" ? ["declaration"] : ["assertion-anchor"]),
    ];
    for (const kind of kinds) {
      const source =
        kind === "assertion-anchor"
          ? values.find((item) => item.id === "assertion-anchor-annotation-set")
              .before
          : cores.find((item) => item.descriptor === `${family}:${kind}`)
              .before;
      const m = fromSource(source);
      m.classes();
      const alternateKind = kind === "key" ? "class-membership" : "key";
      const alternate =
        alternateKind === "key"
          ? {
              kind: "key",
              class: "A",
              objectProperties: [],
              dataProperties: [],
            }
          : {
              kind: "class-membership",
              class: "A",
              individual: m.alternatives("I")[0],
            };
      let index, path;
      if (family === "Assertion") {
        index = m.structural.constructs.findIndex(
          (item) => item.id === "anchor-focus",
        );
        const matches = m.structural.constructs.some(
          (item) =>
            item.kind === alternate.kind &&
            Object.keys(alternate).every(
              (field) =>
                JSON.stringify(item[field]) ===
                JSON.stringify(alternate[field]),
            ),
        );
        if (!matches)
          m.fact(
            "alternate-assertion-support",
            alternate.kind,
            Object.fromEntries(
              Object.entries(alternate).filter(([field]) => field !== "kind"),
            ),
          );
        path = ["structural", "constructs", index, "assertion"];
      } else {
        index = m.structural.constructs.findIndex(
          (item) =>
            item.id === (kind === "assertion-anchor" ? "anchor" : "focus"),
        );
        path = ["structural", "constructs", index];
      }
      assert(index >= 0);
      const before = structuredClone(m.source),
        after = structuredClone(m.source);
      if (family === "Assertion")
        after.structural.constructs[index].assertion =
          structuredClone(alternate);
      else
        after.structural.constructs[index] = {
          id: before.structural.constructs[index].id,
          ...alternate,
        };
      const extras = ["data-characteristic", "rdf-characteristic"].includes(
        kind,
      )
        ? [`mapping/${family}:${kind}/characteristic`]
        : [];
      finish(
        `${family.toLowerCase()}-kind-${kind}`,
        `${family}:${kind}`,
        "kind",
        before,
        after,
        path,
        `${family}:${alternateKind}`,
        "Each branch's discriminator is fixed by its closed record. This valid cross-branch substitution includes mandatory payload/reference changes. Assertions retain both possible supports unchanged; fixed functional characteristic fields disappear only when their entire branch changes. This is not an isolated proof of the discriminator or fixed token.",
        extras,
      );
    }
  }
  for (const family of ["AnnotationValue", "Literal"]) {
    const kinds =
      family === "AnnotationValue"
        ? ["iri", "subject", "typed", "language"]
        : ["typed", "language"];
    for (const kind of kinds) {
      const witness = values.find(
        (item) => item.descriptor === `${family}:${kind}`,
      );
      assert(witness);
      const before = structuredClone(witness.before),
        after = structuredClone(witness.before);
      const alternate =
        kind === "typed"
          ? { kind: "language", lexical: "branch value", language: "en" }
          : literal;
      const parent = at(after, witness.path.slice(0, -1));
      parent[witness.path.at(-1)] = structuredClone(alternate);
      finish(
        `${family.toLowerCase()}-kind-${kind}`,
        `${family}:${kind}`,
        "kind",
        before,
        after,
        witness.path,
        `${family}:${alternate.kind}`,
        "A value union branch changes only with its required/forbidden lexical, datatype, language or reference fields. All signature roles are predeclared; complete after-shape replaces the embedded value. This is a coupled branch witness.",
      );
    }
  }
  {
    const witness = values.find(
        (item) => item.id === "selection-language-range",
      ),
      before = structuredClone(witness.before),
      after = structuredClone(witness.before);
    after.visualization.labelSelection = { mode: "untagged" };
    finish(
      "label-selection-language-branch",
      "LabelSelection:language",
      "mode",
      before,
      after,
      ["visualization", "labelSelection"],
      "LabelSelection:untagged",
      "Changing away from the language branch requires removing its range field; range is forbidden on untagged selection.",
    );
  }
  return pairs;
}
