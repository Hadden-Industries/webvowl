import { readFileSync } from "node:fs";
import {
  selectVowlLabel,
  isVowlExternal,
  selectVowlPrincipal,
  vowlRadiusFactor,
  directMembershipCount,
  cardinalityText,
  projectCanvasPoint,
  cameraCenter,
  compactVowlNotation,
  labelCandidates,
} from "./vowlDisplayProjector.js";

const vectors = JSON.parse(
  readFileSync(
    new URL(
      "../../../../packages/vowl/conformance/display-vectors.json",
      import.meta.url,
    ),
  ),
).vectors;
const operations = {
  "select-label": selectVowlLabel,
  "classify-external": isVowlExternal,
  "radius-factor": vowlRadiusFactor,
  "membership-factor": ({ targets, memberships }) => {
    const count = directMembershipCount(targets, memberships);
    return {
      count,
      factor: vowlRadiusFactor({
        generic: false,
        nodeScaling: "direct-membership",
        directDistinctIndividualCount: count,
      }),
    };
  },
  "principal-and-aliases": (input) => {
    const { principal, aliases } = selectVowlPrincipal(input);
    return {
      principalIri: principal.iri,
      aliasIris: aliases.map(({ iri }) => iri),
    };
  },
  "cardinality-text": cardinalityText,
  "camera-project": projectCanvasPoint,
  "camera-center": cameraCenter,
  "compact-notation": compactVowlNotation,
};

test.each(vectors)(
  "independent display vector: $id",
  ({ operation, input, expected }) => {
    expect(operations[operation](input)).toEqual(expected);
  },
);

test("label selection excludes assertion anchors, other predicates and other subjects", () => {
  const value = {
    kind: "typed",
    lexical: "kept",
    datatype: "http://www.w3.org/2001/XMLSchema#string",
  };
  const label = {
    kind: "annotation-assertion",
    subject: "s1",
    predicate: "http://www.w3.org/2000/01/rdf-schema#label",
    value,
  };
  expect(
    labelCandidates(
      {
        constructs: [
          label,
          { ...label, subject: "s2" },
          { ...label, predicate: "urn:other" },
          { kind: "assertion-anchor", assertion: label, annotations: [label] },
        ],
      },
      "s1",
    ),
  ).toEqual([value]);
});
