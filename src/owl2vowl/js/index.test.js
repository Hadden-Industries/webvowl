import {
  describe,
  test,
  expect,
  jest,
  beforeEach,
  afterEach,
} from "@jest/globals";
import owl2vowl, { loadWithImports, catalog } from "./index.js";

const RDF_XML = `
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
           xmlns:rdfs="http://www.w3.org/2000/01/rdf-schema#"
           xmlns:owl="http://www.w3.org/2002/07/owl#">
    <owl:Ontology rdf:about="http://example.org/ontology">
      <rdfs:label xml:lang="en">My Ontology</rdfs:label>
    </owl:Ontology>
    <owl:Class rdf:about="http://example.org/ontology#Person">
      <rdfs:label xml:lang="en">Person</rdfs:label>
    </owl:Class>
  </rdf:RDF>
`;

const TURTLE = `
  @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
  @prefix owl: <http://www.w3.org/2002/07/owl#> .
  @prefix : <http://example.org/ontology#> .

  <http://example.org/ontology> a owl:Ontology ;
                                rdfs:label "My Turtle Ontology"@en .

  :Car a owl:Class ;
       rdfs:label "Car"@en .
`;

describe("production owl2vowl entry point", () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test("catalog export matches ONTOLOGY_CATALOG", () => {
    expect(catalog["http://purl.org/dc/elements/1.1"]).toBeDefined();
  });

  test("builds RDF/XML through the structural owlapi-js path", async () => {
    const result = await owl2vowl(RDF_XML);

    expect(result._comment).toBe("Created with owlapi-js VOWLBuilder");
    expect(result.header.iri).toBe("http://example.org/ontology");
    expect(result.header.labels.en).toBe("My Ontology");

    const personAttribute = result.classAttribute.find(
      ({ iri }) => iri === "http://example.org/ontology#Person",
    );
    expect(personAttribute.label.en).toBe("Person");
  });

  test("rejects a legacy-only syntax instead of falling back", async () => {
    await expect(owl2vowl(TURTLE)).rejects.toMatchObject({
      code: "UNPARSABLE_ONTOLOGY",
    });
  });

  test.each([
    {
      fileName: "ontology.ofn",
      text: `Prefix(:=<https://example.com/phase8#>)
        Ontology(<https://example.com/phase8> Declaration(Class(:Person)))`,
    },
    {
      fileName: "ontology.omn",
      text: `Prefix: : <https://example.com/phase8#>
        Ontology: <https://example.com/phase8>
        Class: :Person`,
    },
    {
      fileName: "ontology.owx",
      text: `<Ontology xmlns="http://www.w3.org/2002/07/owl#"
        ontologyIRI="https://example.com/phase8">
        <Prefix name="" IRI="https://example.com/phase8#"/>
        <Declaration><Class abbreviatedIRI=":Person"/></Declaration>
      </Ontology>`,
    },
    {
      fileName: "ontology.rdf",
      text: `<rdf:RDF
        xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
        xmlns:owl="http://www.w3.org/2002/07/owl#">
        <owl:Ontology rdf:about="https://example.com/phase8"/>
        <owl:Class rdf:about="https://example.com/phase8#Person"/>
      </rdf:RDF>`,
    },
  ])(
    "advertises $fileName from the production path",
    async ({ fileName, text }) => {
      const result = await owl2vowl(text, { fileName });

      expect(result.header.iri).toBe("https://example.com/phase8");
      expect(result.classAttribute).toContainEqual(
        expect.objectContaining({ iri: "https://example.com/phase8#Person" }),
      );
      expect(result.diagnostics).toEqual([]);
    },
  );

  // RFC 3986 section 5.1 establishes a base URI from xml:base, then from the
  // retrieval IRI, and only then from an application default. A pasted or
  // uploaded document has no retrieval IRI, so relative references such as
  // rdf:about="" cannot resolve and the whole document is rejected. The
  // application default is the last resort in that hierarchy, and the reserved
  // .invalid TLD makes the substituted authority obviously non-retrievable.
  test("supplies a synthetic base when the caller gives no document IRI", async () => {
    const relativeDocument = `
      <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
               xmlns:owl="http://www.w3.org/2002/07/owl#">
        <owl:Ontology rdf:about="http://example.org/vocab/"/>
        <owl:Class rdf:about="http://example.org/vocab/Work"/>
        <owl:NamedIndividual rdf:about="">
          <rdf:type rdf:resource="http://example.org/vocab/Work"/>
        </owl:NamedIndividual>
      </rdf:RDF>
    `;

    const result = await owl2vowl(relativeDocument, { fileName: "vocab.rdf" });

    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        baseIRI: "https://webvowl.invalid/",
        code: "RDF_SYNTHETIC_BASE_IRI",
        severity: "warning",
      }),
    );
  });

  test("prefers a caller-supplied document IRI over the synthetic base", async () => {
    const relativeDocument = `
      <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
               xmlns:owl="http://www.w3.org/2002/07/owl#">
        <owl:Ontology rdf:about="http://example.org/vocab/"/>
        <owl:Class rdf:about="http://example.org/vocab/Work"/>
        <owl:NamedIndividual rdf:about="">
          <rdf:type rdf:resource="http://example.org/vocab/Work"/>
        </owl:NamedIndividual>
      </rdf:RDF>
    `;

    const result = await owl2vowl(relativeDocument, {
      documentIRI: "http://example.org/vocab/source.rdf",
      fileName: "vocab.rdf",
    });

    expect(result.diagnostics).not.toContainEqual(
      expect.objectContaining({ code: "RDF_SYNTHETIC_BASE_IRI" }),
    );
  });

  test("rejects malformed RDF/XML without publishing a partial result", async () => {
    await expect(
      owl2vowl(
        '<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description>',
        { fileName: "malformed.rdf" },
      ),
    ).rejects.toMatchObject({ code: "XML_PARSE_ERROR" });
  });

  test("preserves compatible RDF-to-OWL warnings on the production result", async () => {
    const owlFullDocument = `<rdf:RDF
      xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
      xmlns:rdfs="http://www.w3.org/2000/01/rdf-schema#"
      xmlns:owl="http://www.w3.org/2002/07/owl#">
      <owl:Ontology rdf:about="https://example.com/phase8"/>
      <owl:DatatypeProperty rdf:about="https://example.com/phase8#legacy"/>
      <owl:Class rdf:nodeID="legacyRange">
        <owl:unionOf rdf:parseType="Collection">
          <owl:Class rdf:about="https://example.com/phase8#LegacyBoolean"/>
        </owl:unionOf>
      </owl:Class>
      <rdf:Description rdf:about="https://example.com/phase8#legacy">
        <rdfs:range rdf:nodeID="legacyRange"/>
      </rdf:Description>
    </rdf:RDF>`;

    const result = await owl2vowl(owlFullDocument, {
      fileName: "compatible.rdf",
    });

    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "RDF_OWL_FULL_DATA_PROPERTY_RANGE_AS_CLASS",
        severity: "warning",
      }),
    );
  });

  test("surfaces resource failures before a VOWL result exists", async () => {
    await expect(
      owl2vowl(RDF_XML, {
        configuration: { maxInputBytes: 1 },
        fileName: "ontology.rdf",
      }),
    ).rejects.toMatchObject({
      code: "RESOURCE_LIMIT_EXCEEDED",
      resource: "maxInputBytes",
    });
  });

  test("fails explicitly when an import closure yields a legacy-only syntax", async () => {
    const mainXml = `
      <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
               xmlns:owl="http://www.w3.org/2002/07/owl#">
        <owl:Ontology rdf:about="http://example.org/main">
          <owl:imports rdf:resource="http://example.org/turtle-ontology"/>
        </owl:Ontology>
      </rdf:RDF>
    `;

    global.fetch = jest.fn(async () => ({
      headers: { get: () => "text/turtle" },
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () => TURTLE,
    }));

    await expect(loadWithImports(mainXml)).rejects.toMatchObject({
      code: "UNPARSABLE_ONTOLOGY",
    });
  });

  // An import that cannot be fetched is ordinary on the open web: the document
  // may be offline, moved, or simply not mirrored. The pinned OWL2VOWL oracle
  // renders such ontologies rather than refusing them, and the retained legacy
  // pipeline did too, so aborting the whole load would be a visible regression
  // for anyone opening `spatial.rdf` or `ontology_v3.3.rdf`.
  //
  // `owl2vowl` already defaults to diagnostic handling. `loadWithImports` is the
  // entry `src/app/js/loadingModule.js` actually calls, so it needs the same
  // default or the application gets the stricter behaviour.
  test("renders the ontology when an import cannot be fetched", async () => {
    const mainXml = `
      <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
               xmlns:owl="http://www.w3.org/2002/07/owl#">
        <owl:Ontology rdf:about="http://example.org/main">
          <owl:imports rdf:resource="http://example.org/unreachable"/>
        </owl:Ontology>
        <owl:Class rdf:about="http://example.org/main#Local"/>
      </rdf:RDF>
    `;

    global.fetch = jest.fn(async () => ({
      ok: false,
      status: 404,
      statusText: "Not Found",
      text: async () => "",
    }));

    const result = await loadWithImports(mainXml);

    expect(result.header.iri).toBe("http://example.org/main");
    expect(result.classAttribute).toContainEqual(
      expect.objectContaining({ iri: "http://example.org/main#Local" }),
    );
  });

  test("resolves an import closure through the structural path", async () => {
    const importedXml = `
      <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
               xmlns:owl="http://www.w3.org/2002/07/owl#"
               xmlns:rdfs="http://www.w3.org/2000/01/rdf-schema#">
        <owl:Ontology rdf:about="http://example.org/imported-ontology"/>
        <owl:Class rdf:about="http://example.org/imported#SpecialClass">
          <rdfs:label xml:lang="en">Special</rdfs:label>
        </owl:Class>
      </rdf:RDF>
    `;
    const mainXml = `
      <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
               xmlns:owl="http://www.w3.org/2002/07/owl#">
        <owl:Ontology rdf:about="http://example.org/main">
          <owl:imports rdf:resource="http://example.org/imported-ontology"/>
        </owl:Ontology>
      </rdf:RDF>
    `;

    global.fetch = jest.fn(async (url) => {
      if (url !== "http://example.org/imported-ontology") {
        throw new Error("Unexpected fetch url: " + url);
      }
      return {
        headers: { get: () => "application/rdf+xml" },
        ok: true,
        status: 200,
        statusText: "OK",
        text: async () => importedXml,
      };
    });

    const result = await loadWithImports(mainXml);

    expect(result._comment).toBe("Created with owlapi-js VOWLBuilder");
    expect(result.header.iri).toBe("http://example.org/main");
    expect(result.classAttribute).toContainEqual(
      expect.objectContaining({
        iri: "http://example.org/imported#SpecialClass",
      }),
    );
  });
});
