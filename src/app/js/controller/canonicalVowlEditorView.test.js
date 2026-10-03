import { openOwl } from "vowl/owl";
import { inspectModel } from "vowl";
import { createCanonicalVowlEditorView } from "./canonicalVowlEditorView.js";
import { createCanonicalVowlScene } from "./canonicalVowlScene.js";
import { createLanguageTools } from "../../../shared/js/util/languageTools.js";

test("editor views use semantic records and distinguish ambiguous annotation values", async () => {
  const { model } = await openOwl(
    new TextEncoder().encode(`Ontology(<urn:root> <urn:version>
    Annotation(<http://www.w3.org/2002/07/owl#versionInfo> "Release one")
    Declaration(Class(<urn:A>)) Declaration(ObjectProperty(<urn:p>))
    AnnotationAssertion(<http://www.w3.org/2000/01/rdf-schema#label> <urn:A> "One"@en)
    AnnotationAssertion(<http://www.w3.org/2000/01/rdf-schema#label> <urn:A> "Two"@en)
    SubClassOf(<urn:A> ObjectSomeValuesFrom(<urn:p> <urn:A>)))`),
    { documentIri: "urn:root", mediaType: "text/owl-functional" },
  );
  const inspection = inspectModel(model);
  const subject = inspection.records.subjects.find(
    ({ iri }) => iri === "urn:A",
  );
  const role = inspection.records.roles.find(
    (entry) => entry.subject === subject.id,
  );
  const visualization = createCanonicalVowlScene(inspection.occurrences, {
    loadGeneration: 2,
  }).snapshot();
  const selected = createCanonicalVowlEditorView(inspection, visualization, {
    loadGeneration: 2,
    selectedId: role.id,
  });
  expect(
    createLanguageTools().textInLanguage(
      selected.metadata.version,
      "undefined",
    ),
  ).toBe("Release one");
  expect(selected.selectedRecord).toMatchObject({
    type: "owl:Class",
    iri: "urn:A",
    labelEditable: false,
  });
  expect(selected).not.toHaveProperty("vowlModel");
  expect(selected).not.toHaveProperty("derivedIriBase");
  const assertion = inspection.records.constructs.find(
    ({ kind }) => kind === "subclass",
  );
  const row = createCanonicalVowlEditorView(inspection, visualization, {
    loadGeneration: 2,
    selectedId: assertion.id,
  });
  expect(row.isProperty).toBe(true);
  expect(row.selectedRecord).toMatchObject({
    type: "owl:someValuesFrom",
    iriEditable: false,
    labelEditable: false,
  });
  expect(() =>
    createCanonicalVowlEditorView(inspection, visualization, {
      selectedId: "missing",
    }),
  ).toThrow();
});
