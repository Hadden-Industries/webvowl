import installOwlapiDevelopmentIntegration from "./owlapiDevelopmentIntegration.js";

const RDF_XML = `<rdf:RDF
  xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
  xmlns:owl="http://www.w3.org/2002/07/owl#">
  <owl:Ontology rdf:about="https://example.com/phase7"/>
  <owl:Class rdf:about="https://example.com/phase7#Person"/>
</rdf:RDF>`;

describe("development-app owlapi integration", () => {
  it("installs an explicit route that publishes through the app loading module", async () => {
    const loadedDocuments = [];
    const target = { document: { documentElement: { dataset: {} } } };
    const application = {
      getOptions: () => ({
        loadingModule: () => ({
          directInput: (json) => loadedDocuments.push(JSON.parse(json)),
        }),
      }),
    };

    installOwlapiDevelopmentIntegration({ application, target });
    expect(target.document.documentElement.dataset.owlapiDevelopment).toBe(
      "available",
    );
    const result = await target.owlapiDevelopment.load(RDF_XML, {
      fileName: "phase7.rdf",
    });

    expect(loadedDocuments).toEqual([result]);
    expect(loadedDocuments[0].classAttribute).toContainEqual(
      expect.objectContaining({
        iri: "https://example.com/phase7#Person",
      }),
    );
  });
});
