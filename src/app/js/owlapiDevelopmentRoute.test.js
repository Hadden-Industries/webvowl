import createOwlapiDevelopmentRoute from "./owlapiDevelopmentRoute.js";

const RDF_XML = `<rdf:RDF
  xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
  xmlns:owl="http://www.w3.org/2002/07/owl#">
  <owl:Ontology rdf:about="https://example.com/phase7"/>
  <owl:Class rdf:about="https://example.com/phase7#Person"/>
</rdf:RDF>`;

describe("owlapi development route", () => {
  it("publishes a completed VOWL result and returns it to the caller", async () => {
    const publications = [];
    const route = createOwlapiDevelopmentRoute({
      publish: (result, fileName) => publications.push({ fileName, result }),
    });

    const result = await route.load(RDF_XML, { fileName: "phase7.rdf" });

    expect(publications).toEqual([{ fileName: "phase7.rdf", result }]);
    expect(result.classAttribute).toContainEqual(
      expect.objectContaining({
        iri: "https://example.com/phase7#Person",
      }),
    );
  });

  it("does not publish partial state when ontology loading fails", async () => {
    const publications = [];
    const route = createOwlapiDevelopmentRoute({
      publish: (result) => publications.push(result),
    });

    await expect(
      route.load(
        '<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description>',
        { fileName: "malformed.rdf" },
      ),
    ).rejects.toMatchObject({ code: "XML_PARSE_ERROR" });
    expect(publications).toEqual([]);
  });
});
