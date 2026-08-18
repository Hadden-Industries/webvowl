import { jest } from "@jest/globals";

import { loadWithOwlapi } from "./owlapiAdapter.js";

const EXPECTED_CLASS_IRI = "https://example.com/phase7#Person";

const DOCUMENTS = [
  {
    fileName: "ontology.ofn",
    text: `Prefix(:=<https://example.com/phase7#>)
      Ontology(<https://example.com/phase7> Declaration(Class(:Person)))`,
  },
  {
    fileName: "ontology.omn",
    text: `Prefix: : <https://example.com/phase7#>
      Ontology: <https://example.com/phase7>
      Class: :Person`,
  },
  {
    fileName: "ontology.owx",
    text: `<Ontology xmlns="http://www.w3.org/2002/07/owl#"
      ontologyIRI="https://example.com/phase7">
      <Prefix name="" IRI="https://example.com/phase7#"/>
      <Declaration><Class abbreviatedIRI=":Person"/></Declaration>
    </Ontology>`,
  },
  {
    fileName: "ontology.rdf",
    text: `<rdf:RDF
      xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
      xmlns:owl="http://www.w3.org/2002/07/owl#">
      <owl:Ontology rdf:about="https://example.com/phase7"/>
      <owl:Class rdf:about="https://example.com/phase7#Person"/>
    </rdf:RDF>`,
  },
];

describe("development-only owlapi adapter", () => {
  it.each(DOCUMENTS)(
    "loads $fileName through the shared structural builder",
    async ({ fileName, text }) => {
      const result = await loadWithOwlapi(text, { fileName });

      expect(result.header.iri).toBe("https://example.com/phase7");
      expect(result.classAttribute).toContainEqual(
        expect.objectContaining({ iri: EXPECTED_CLASS_IRI }),
      );
      expect(result.diagnostics).toEqual([]);
    },
  );

  it("loads and visualizes the RDF/XML import closure through catalog policy", async () => {
    const importedDocument = `<rdf:RDF
      xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
      xmlns:owl="http://www.w3.org/2002/07/owl#">
      <owl:Ontology rdf:about="https://example.com/imported"/>
      <owl:Class rdf:about="https://example.com/imported#Imported"/>
    </rdf:RDF>`;
    const fetchImpl = jest.fn(async () => ({
      headers: { get: () => "application/rdf+xml" },
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () => importedDocument,
    }));
    const rootDocument = `<rdf:RDF
      xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
      xmlns:owl="http://www.w3.org/2002/07/owl#">
      <owl:Ontology rdf:about="https://example.com/phase7">
        <owl:imports rdf:resource="https://example.com/imported"/>
      </owl:Ontology>
      <owl:Class rdf:about="https://example.com/phase7#Root"/>
    </rdf:RDF>`;

    const result = await loadWithOwlapi(rootDocument, {
      catalog: {
        "https://example.com/imported":
          "https://static.example.com/imported.rdf",
      },
      fetchImpl,
      fileName: "root.rdf",
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(result.header.imports).toEqual(["https://example.com/imported"]);
    expect(result.classAttribute).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ iri: "https://example.com/phase7#Root" }),
        expect.objectContaining({
          attributes: expect.arrayContaining(["external"]),
          iri: "https://example.com/imported#Imported",
        }),
      ]),
    );
  });

  it("rejects malformed RDF/XML without publishing a partial result", async () => {
    await expect(
      loadWithOwlapi(
        '<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description>',
        { fileName: "malformed.rdf" },
      ),
    ).rejects.toMatchObject({ code: "XML_PARSE_ERROR" });
  });

  it("preserves compatible RDF-to-OWL warnings in the development result", async () => {
    const owlFullDocument = `<rdf:RDF
      xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
      xmlns:rdfs="http://www.w3.org/2000/01/rdf-schema#"
      xmlns:owl="http://www.w3.org/2002/07/owl#">
      <owl:Ontology rdf:about="https://example.com/phase7"/>
      <owl:DatatypeProperty rdf:about="https://example.com/phase7#legacy"/>
      <owl:Class rdf:nodeID="legacyRange">
        <owl:unionOf rdf:parseType="Collection">
          <owl:Class rdf:about="https://example.com/phase7#LegacyBoolean"/>
        </owl:unionOf>
      </owl:Class>
      <rdf:Description rdf:about="https://example.com/phase7#legacy">
        <rdfs:range rdf:nodeID="legacyRange"/>
      </rdf:Description>
    </rdf:RDF>`;

    const result = await loadWithOwlapi(owlFullDocument, {
      configuration: { parsingMode: "compatible" },
      fileName: "compatible.rdf",
    });

    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "RDF_OWL_FULL_DATA_PROPERTY_RANGE_AS_CLASS",
        severity: "warning",
      }),
    );
  });

  it("surfaces resource failures before a VOWL result exists", async () => {
    await expect(
      loadWithOwlapi(DOCUMENTS[3].text, {
        configuration: { maxInputBytes: 1 },
        fileName: DOCUMENTS[3].fileName,
      }),
    ).rejects.toMatchObject({
      code: "RESOURCE_LIMIT_EXCEEDED",
      resource: "maxInputBytes",
    });
  });
});
