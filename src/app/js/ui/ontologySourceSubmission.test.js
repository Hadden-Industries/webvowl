import { describe, expect, jest, test } from "@jest/globals";
import { createOntologySuggestions } from "./ontologySuggestions.js";
import {
  createOntologySourceSubmission,
  normalizeOntologyUrl,
  resolveOntologySubmission,
} from "./ontologySourceSubmission.js";

const catalogue = createOntologySuggestions((key) => ({
  url: `http://localhost:5173/deployed/base/${key}.json`,
}));
describe("one ontology submission route", () => {
  test("recognizes packaged identity before HTTP normalization", () => {
    expect(
      resolveOntologySubmission(
        " http://localhost:5173/deployed/base/foaf.json ",
        catalogue,
      ),
    ).toMatchObject({
      hash: "foaf",
      normalizedUrl: "http://localhost:5173/deployed/base/foaf.json",
    });
    expect(
      resolveOntologySubmission(
        "http://localhost:5173/deployed/base/foaf.json?edited",
        catalogue,
      ).hash,
    ).toBe("url=https://localhost:5173/deployed/base/foaf.json?edited");
  });
  test.each(["foaf", "benchmark", "unknown", "CORE"])(
    "does not invent a host for %s",
    (value) => {
      expect(normalizeOntologyUrl(value).valid).toBe(false);
    },
  );
  test.each([
    "localhost:5173/x.owl",
    "intranet/ontology",
    "example.org",
    "https://intranet",
  ])("preserves accepted address input %s", (value) => {
    expect(normalizeOntologyUrl(value).valid).toBe(true);
  });
  test.each([
    "javascript:alert(1)",
    "data:text/plain,test",
    "https://u:p@host/x",
    "https://not%20host/x",
  ])("rejects %s", (value) => {
    expect(resolveOntologySubmission(value, catalogue).valid).toBe(false);
  });
  test("preserves explicit route encoding and Hadden addresses", () => {
    const value = "https://example.org/a%2Fb?value=%23&other=one%20two#part";
    expect(
      decodeURIComponent(resolveOntologySubmission(value).hash.slice(4)),
    ).toBe(value);
    expect(resolveOntologySubmission(catalogue[0].url, catalogue).hash).toBe(
      "iri=" + catalogue[0].url,
    );
  });
  test("changed hashes wait for navigation; same-hash retry calls the loader once", () => {
    const locationObject = { hash: "#foaf" };
    const loadOntologyFromLocation = jest.fn(() => Promise.resolve());
    const submit = createOntologySourceSubmission({
      locationObject,
      loadOntologyFromLocation,
      catalogue,
    });
    const result = submit(catalogue[4].url);
    expect(result.completion).toBeInstanceOf(Promise);
    expect(loadOntologyFromLocation).toHaveBeenCalledTimes(1);
    submit(catalogue[5].url);
    expect(locationObject.hash).toBe("goodrelations");
    expect(loadOntologyFromLocation).toHaveBeenCalledTimes(1);
    submit("unmatched");
    expect(locationObject.hash).toBe("goodrelations");
  });
});
