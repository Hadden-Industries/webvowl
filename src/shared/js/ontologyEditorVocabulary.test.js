import { namespaces } from "vowl";
import { DEFAULT_VOWL_EDITOR_PREFIXES } from "./ontologyEditorVocabulary.js";

test("standard DC elements, DC terms and the legacy editor spelling stay distinct", () => {
  expect(Object.isFrozen(namespaces)).toBe(true);
  expect(namespaces.dc).toBe("http://purl.org/dc/elements/1.1/");
  expect(namespaces.dcterms).toBe("http://purl.org/dc/terms/");
  expect(namespaces.skos).toBe("http://www.w3.org/2004/02/skos/core#");
  expect(DEFAULT_VOWL_EDITOR_PREFIXES.dc).toBe(
    "http://purl.org/dc/elements/1.1/#",
  );
  expect(DEFAULT_VOWL_EDITOR_PREFIXES.xml).toBe(
    "http://www.w3.org/XML/1998/namespace",
  );
});
