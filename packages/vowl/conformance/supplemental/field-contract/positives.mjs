// SPDX-License-Identifier: AGPL-3.0-only
// Supported A4 anchors copied from independently authored complete positive sources.
import assert from "node:assert/strict";
import { baseConstructVariants, select } from "./contracts.mjs";

export function missingAnchors(positives) {
  const covered = new Set(
    positives.flatMap((fixture) =>
      fixture.source.structural.constructs
        .filter((item) => item.kind === "assertion-anchor")
        .map((item) => item.assertion.kind),
    ),
  );
  const missing = Object.keys(baseConstructVariants).filter(
    (kind) => !covered.has(kind),
  );
  assert.equal(
    missing.length,
    29,
    "Frozen baseline has exactly three of 32 legal embedded assertion variants",
  );
  return missing.map((kind) => {
    const witness = positives
      .filter(
        (item) =>
          !item.source.visualization &&
          item.source.structural.constructs.some(
            (record) => record.kind === kind,
          ),
      )
      .sort(
        (a, b) =>
          JSON.stringify(a.source).length - JSON.stringify(b.source).length ||
          (a.id < b.id ? -1 : 1),
      )[0];
    assert(witness, `No independent complete source for ${kind}`);
    const source = structuredClone(witness.source);
    const usedIds = new Set(
      ["subjects", "roles", "expressions", "constructs", "occurrences"].flatMap(
        (key) => source.structural[key].map((item) => item.id),
      ),
    );
    let ordinal = 0;
    const fresh = () => {
      let value;
      do {
        value = `field-anchor-${++ordinal}`;
      } while (usedIds.has(value));
      usedIds.add(value);
      return value;
    };
    function ensureRole(iri, roleKind) {
      let subject = source.structural.subjects.find((item) => item.iri === iri);
      if (!subject) {
        subject = { id: fresh(), iri };
        source.structural.subjects.push(subject);
      }
      let role = source.structural.roles.find(
        (item) => item.subject === subject.id && item.kind === roleKind,
      );
      if (!role) {
        role = { id: fresh(), kind: roleKind, subject: subject.id };
        source.structural.roles.push(role);
      }
      return role.id;
    }
    const predicate = "urn:field-contract:annotation";
    const datatype = "http://www.w3.org/2001/XMLSchema#string";
    ensureRole(predicate, "annotation-property");
    ensureRole(datatype, "datatype");
    const assertion = structuredClone(
      source.structural.constructs.find((item) => item.kind === kind),
    );
    delete assertion.id;
    source.structural.constructs.push({
      id: fresh(),
      kind: "assertion-anchor",
      assertion,
      annotations: [
        {
          predicate,
          value: { kind: "typed", lexical: `${kind} anchor`, datatype },
          annotations: [],
        },
      ],
    });
    return {
      id: `anchor-${kind}`,
      source,
      profile: witness.profile,
      sourceFixture: witness.id,
      sourceWitness: witness.files["source.json"],
      newAssertionKind: kind,
      rules: ["A2", "A4", "A5", "A6", "A10"],
      derivation:
        "Exact supported base assertion without id; one typed annotation and its annotation-property/datatype signature roles. These roles add no occurrences under B2.",
    };
  });
}

export function permute(source) {
  const ids = [
    "subjects",
    "roles",
    "expressions",
    "constructs",
    "occurrences",
  ].flatMap((key) => source.structural[key].map((item) => item.id));
  const names = new Map(
    ids.map((id, index) => [id, `field-permutation-${ids.length - index}`]),
  );
  function scalar(value, type) {
    if (type.type === "reference" || type.type === "handle")
      return names.get(value) ?? value;
    if (type.type === "record") return record(value, type.record);
    if (type.type === "collection") {
      const items = value.map((item) => scalar(item, type.item));
      return type.sequence ? items : items.reverse();
    }
    return value;
  }
  function record(value, name) {
    const shape = select(name, value);
    assert(shape, `No field shape for ${name}`);
    return Object.fromEntries(
      Object.keys(value)
        .reverse()
        .map((field) => {
          assert(
            shape.fields[field],
            `Unknown independent field ${name}.${field}`,
          );
          return [field, scalar(value[field], shape.fields[field])];
        }),
    );
  }
  return record(
    source,
    source.visualization ? "SourceArtifact" : "SourceStructural",
  );
}
