import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
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

test("lexical namespace splitting rejects an adversarial fragment within a bounded process", () => {
  const moduleUrl = new URL("./vowlDisplayProjector.js", import.meta.url).href;
  const program = `
    import { isVowlExternal } from ${JSON.stringify(moduleUrl)};
    try {
      isVowlExternal({
        rootOntologyIri: "urn:root",
        subjectIri: "urn://" + "a".repeat(100000) + "#\\n",
      });
      process.exitCode = 1;
    } catch (error) {
      if (!(error instanceof TypeError)) throw error;
    }
  `;
  expect(() =>
    execFileSync(process.execPath, ["--input-type=module", "-e", program], {
      timeout: 2000,
      stdio: "pipe",
      windowsHide: true,
    }),
  ).not.toThrow();
});

test("lexical namespace splitting preserves long admitted names and query spelling", () => {
  const authority = "a".repeat(100000);
  expect(
    isVowlExternal({
      rootOntologyIri: `https://${authority}/o?x=%2F`,
      subjectIri: `https://${authority}/o?x=%2F#?suffix`,
    }),
  ).toBe(false);
  expect(
    isVowlExternal({
      rootOntologyIri: `https://${authority}/o?x=%2F`,
      subjectIri: `https://${authority}/o?x=%2f#suffix`,
    }),
  ).toBe(true);
});

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
