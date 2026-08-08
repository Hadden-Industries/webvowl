import {
  describe,
  test,
  expect,
  jest,
  beforeEach,
  afterEach,
} from "@jest/globals";
import * as fs from "node:fs";
import {
  resolveImportUrl,
  loadWithImports,
  convertToRdfXmlFallback,
} from "./importLoader.js";
import { getLocalOntologyPath } from "../test/helpers.js";

describe("importLoader.js unit tests", () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test("resolveImportUrl resolves logical catalog IRIs", () => {
    // Exact match in catalog
    const resolvedDc = resolveImportUrl("http://purl.org/dc/elements/1.1");
    expect(resolvedDc).toBe(
      "https://haddenindustries.com/ontology/external/dc.rdf",
    );

    // Absolute remote catalog match
    const resolvedProvO = resolveImportUrl("http://www.w3.org/ns/prov-o");
    expect(resolvedProvO).toBe(
      "https://raw.githubusercontent.com/w3c/ns/refs/heads/main/prov-o.rdf",
    );

    // Protocol normalization (https vs http)
    const resolvedProvHttps = resolveImportUrl("https://www.w3.org/ns/prov-o/");
    expect(resolvedProvHttps).toBe(
      "https://raw.githubusercontent.com/w3c/ns/refs/heads/main/prov-o.rdf",
    );

    // Filename fallback match
    const resolvedProvFilename = resolveImportUrl("prov-o");
    expect(resolvedProvFilename).toBe(
      "https://raw.githubusercontent.com/w3c/ns/refs/heads/main/prov-o.rdf",
    );

    // Normalized match (trailing slash)
    const resolvedFoaf = resolveImportUrl("http://xmlns.com/foaf/0.1/");
    expect(resolvedFoaf).toBe(
      "https://haddenindustries.com/ontology/external/foaf.rdf",
    );

    // Unknown IRI returns as-is
    const unknown = resolveImportUrl("http://example.org/unknown-ontology");
    expect(unknown).toBe("http://example.org/unknown-ontology");
  });

  test("loadWithImports parses imports, fetches external ontologies, and merges transitively", async () => {
    const mainXml = `
      <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
               xmlns:owl="http://www.w3.org/2002/07/owl#">
        <owl:Ontology rdf:about="http://example.org/main">
          <owl:imports rdf:resource="http://purl.org/dc/elements/1.1"/>
        </owl:Ontology>
      </rdf:RDF>
    `;

    const dcXml = `
      <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
               xmlns:owl="http://www.w3.org/2002/07/owl#"
               xmlns:dc="http://purl.org/dc/elements/1.1/"
               xml:base="http://purl.org/dc/elements/1.1/">
        <owl:Ontology rdf:about="http://purl.org/dc/elements/1.1/">
          <owl:imports rdf:resource="http://example.org/transitive"/>
        </owl:Ontology>
        <owl:Class rdf:about="http://purl.org/dc/elements/1.1/Creator"/>
      </rdf:RDF>
    `;

    const transitiveXml = `
      <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
               xmlns:owl="http://www.w3.org/2002/07/owl#">
        <owl:Class rdf:about="http://example.org/transitive#Class"/>
      </rdf:RDF>
    `;

    // Setup mock fetch with getLocalOntologyPath check
    global.fetch = jest.fn((url) => {
      const localPath = getLocalOntologyPath(url);
      const isDc =
        url === "http://purl.org/dc/elements/1.1" ||
        url === "https://haddenindustries.com/ontology/external/dc.rdf" ||
        localPath.endsWith("dc.rdf");

      if (isDc) {
        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: "OK",
          text: () => Promise.resolve(dcXml),
        });
      }
      if (url === "http://example.org/transitive") {
        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: "OK",
          text: () => Promise.resolve(transitiveXml),
        });
      }
      return Promise.reject(new Error("Unexpected fetch url: " + url));
    });

    const rootParserFn = jest.fn((mergedXml) => {
      expect(mergedXml).toContain(
        'xmlns:dc="http://purl.org/dc/elements/1.1/"',
      );
      expect(mergedXml).toContain(
        'rdf:about="http://purl.org/dc/elements/1.1/Creator"',
      );
      expect(mergedXml).toContain(
        'rdf:about="http://example.org/transitive#Class"',
      );
      expect(mergedXml).toContain(
        'xml:base="http://purl.org/dc/elements/1.1/"',
      );
      expect(mergedXml).toContain('xml:base="http://example.org/transitive"');
      return "SUCCESS";
    });

    const result = await loadWithImports(mainXml, rootParserFn);
    expect(result).toBe("SUCCESS");
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  test("loadWithImports resolves ontology fetch locally via getLocalOntologyPath without network callout", async () => {
    const mainXml = `
      <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
               xmlns:owl="http://www.w3.org/2002/07/owl#">
        <owl:Ontology rdf:about="http://example.org/main">
          <owl:imports rdf:resource="http://purl.org/dc/elements/1.1/"/>
        </owl:Ontology>
      </rdf:RDF>
    `;

    global.fetch = jest.fn(async (url) => {
      const filePath = getLocalOntologyPath(url);
      expect(fs.existsSync(filePath)).toBe(true);
      const content = fs.readFileSync(filePath, "utf-8");
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        text: () => Promise.resolve(content),
      };
    });

    const rootParserFn = jest.fn((mergedXml) => {
      expect(mergedXml).toBeDefined();
      return "SUCCESS";
    });

    const result = await loadWithImports(mainXml, rootParserFn);
    expect(result).toBe("SUCCESS");
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test("loadWithImports handles fetch failures gracefully", async () => {
    const mainXml = `
      <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
               xmlns:owl="http://www.w3.org/2002/07/owl#">
        <owl:Ontology rdf:about="http://example.org/main">
          <owl:imports rdf:resource="http://example.org/failed-import"/>
        </owl:Ontology>
      </rdf:RDF>
    `;

    global.fetch = jest.fn((url) => {
      return Promise.resolve({
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: () => Promise.resolve("404 Error details"),
      });
    });

    const rootParserFn = jest.fn();

    await expect(loadWithImports(mainXml, rootParserFn)).rejects.toThrow(
      "HTTP Error 404: Not Found",
    );
  });

  test("loadWithImports deduplicates duplicate imports across protocol and URL variations", async () => {
    const mainXml = `
      <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
               xmlns:owl="http://www.w3.org/2002/07/owl#">
        <owl:Ontology rdf:about="http://example.org/main">
          <owl:imports rdf:resource="http://purl.org/dc/elements/1.1"/>
          <owl:imports rdf:resource="https://purl.org/dc/elements/1.1/"/>
          <owl:imports rdf:resource="https://haddenindustries.com/ontology/external/dc.rdf"/>
        </owl:Ontology>
      </rdf:RDF>
    `;

    const dcXml = `
      <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
               xmlns:owl="http://www.w3.org/2002/07/owl#">
        <owl:Ontology rdf:about="http://purl.org/dc/elements/1.1/"/>
        <owl:Class rdf:about="http://purl.org/dc/elements/1.1/Creator"/>
      </rdf:RDF>
    `;

    global.fetch = jest.fn((url) => {
      return Promise.resolve({
        ok: true,
        status: 200,
        statusText: "OK",
        text: () => Promise.resolve(dcXml),
      });
    });

    const rootParserFn = jest.fn((mergedXml) => {
      expect(mergedXml).toContain(
        'rdf:about="http://purl.org/dc/elements/1.1/Creator"',
      );
      return "SUCCESS";
    });

    const result = await loadWithImports(mainXml, rootParserFn);
    expect(result).toBe("SUCCESS");
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test("convertToRdfXmlFallback tries parsers sequentially and catches errors", async () => {
    // OFN syntax
    const ofnInput = `Prefix(:=<http://example.com/default#>)
Ontology(Declaration(Class(:Test)))`;

    const result = await convertToRdfXmlFallback(ofnInput);
    expect(result).toContain('rdf:about="http://example.com/default#Test"');
    expect(result).toContain(
      'rdf:resource="http://www.w3.org/2002/07/owl#Class"',
    );
  });
});
