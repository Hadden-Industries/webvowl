// RETAINED FOR CHARACTERIZATION - NOT PART OF `npm test`.
//
// This suite compares the *legacy* pipeline against the pinned Java OWL2VOWL
// oracle. After the Phase 8 cutover that pipeline is no longer what WebVOWL
// ships, so section 18.8's requirement to compare Java output against WebVOWL
// output "through new architecture" is met by the production differential, not
// by this file. `npm test` gates deployment and must therefore not run it.
//
// It is kept, and kept green, for one reason: its `expectedDifferences`
// register is the historical record of how the legacy JavaScript pipeline
// differed from the oracle. That baseline is what makes it possible to say a
// difference in the production differential is *new* rather than pre-existing.
//
// Run it with `npm run test:legacy`. The exclusion lives in the `jest` section
// of `package.json` and is guarded by `src/testRunnerScope.architecture.test.js`.
import { afterAll, beforeAll, describe, expect, test } from "@jest/globals";
import * as fs from "node:fs";
import * as path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadWithImports } from "./legacyPipeline.js";
import { ONTOLOGY_CATALOG } from "../js/constants.js";
import { getLocalOntologyPath, LOCAL_ONTOLOGY_DIST_DIR } from "./helpers.js";
import {
  compareVowlSemantics,
  getFilePathKey,
  parseVowlJson,
  readJavaReferenceOutput,
} from "./vowlDifferential.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WORKSPACE_PARENT = path.join(__dirname, "..", "..", "..", "..");

const JAVA_JAR = path.join(
  WORKSPACE_PARENT,
  "VisualDataWeb",
  "OWL2VOWL",
  "target",
  "OWL2VOWL-0.3.7-shaded.jar",
);

const JAVA_MAX_BUFFER_BYTES = 10 * 1024 * 1024;
const TEST_TIMEOUT_MS = 30_000;
const OWL_THING_IRI = "http://www.w3.org/2002/07/owl#Thing";
const RDFS_LITERAL_IRI = "http://www.w3.org/2000/01/rdf-schema#Literal";
const EMPTY_ONTOLOGY_XML =
  '<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:owl="http://www.w3.org/2002/07/owl#"><owl:Ontology/></rdf:RDF>';

const expectedDifferences = {
  "bibo.rdf.xml": "Java reasoner additions and minor annotation differences",
  "cube.rdf": "Java reasoner additions and minor annotation differences",
  "dc.rdf":
    "Permissive parsing of rdf:Property in JS (ignored by Java due to strict OWL)",
  "dcat3.rdf": "Java reasoner additions and minor annotation differences",
  "dcterms.rdf":
    "Permissive parsing of rdf:Property in JS (ignored by Java due to strict OWL)",
  "doap.rdf": "Java reasoner additions and minor annotation differences",
  "foaf.rdf":
    "Java reasoner defaults InverseFunctional DatatypeProperty domains to owl:Thing due to OWL DL semantic clash (JS preserves syntactic foaf:Agent domain)",
  "food.rdf":
    "Java reasoner narrows domain/range properties via class restrictions and adds equivalent class links",
  "BenchmarkOntology.ttl":
    "Java reasoner additions and JS parsing list differences",
  "BenchmarkOntologyModule.ttl":
    "Java reasoner additions and JS parsing list differences",
  "Drammar_NunnaryScene_Optimized_Rules.owl":
    "Java reasoner additions and JS parsing list differences",
  "StackExchange.ttl":
    "Java reasoner additions and JS parsing list differences",
  "allvalues.ttl": "Java reasoner additions and JS parsing list differences",
  "dcmitype.rdf": "Java reasoner additions and JS parsing list differences",
  "fullontobench.ttl":
    "Java reasoner additions and JS parsing list differences",
  "imarinetlo.owl": "Java reasoner additions and JS parsing list differences",
  "marinetlo.owl": "Java reasoner additions and JS parsing list differences",
  "ontology_v3.3.rdf":
    "Java reasoner additions and JS parsing list differences",
  "ontovibe_cardinalities.ttl":
    "Java reasoner additions and JS parsing list differences",
  "protege-dc.owl": "Java reasoner additions and JS parsing list differences",
  "spatial.rdf": "Java reasoner additions and JS parsing list differences",
  "tagont.owl": "Java reasoner additions and JS parsing list differences",
  "full_ontobench_test.ttl":
    "Java does not support owl:hasValue restrictions on data properties; JS preserves nested datatype expression ranges whereas Java falls back to rdfs:Literal",
  "goodrelations.owl": "Java reasoner additions and OWL DL semantic clashes",
  "muto.rdf":
    "Minor annotations differences between Java reasoner and JS (e.g. definition/scopeNote tags)",
  "org.rdf": "Java reasoner additions and minor annotation differences",
  "personasonto.owl":
    "OWL/XML parsing differences of up to five classes and properties compared with Java",
  "prov.owl": "Java reasoner additions and OWL DL semantic clashes",
  "schemaorg.owl": "Java reasoner additions and OWL DL semantic clashes",
  "sioc.rdf":
    "Minor annotations differences between Java reasoner and JS (e.g. definition/scopeNote tags)",
  "skos.rdf":
    "Minor annotations differences between Java reasoner and JS (e.g. definition/scopeNote tags)",
  "sosa.ttl": "Java reasoner additions and minor annotation differences",
  "ssn.ttl": "Java reasoner additions and minor annotation differences",
  "time-gregorian.ttl":
    "Java reasoner additions and minor annotation differences",
  "time.rdf":
    "Minor differences in implicit inverse property generation; class restrictions domain/range properties match 100%",
  "vann-vocab-20100607.rdf":
    "Java reasoner additions and minor annotation differences",
  "void.ttl": "Java reasoner additions and minor annotation differences",
  "wgs84_pos.rdf": "Java reasoner additions and minor annotation differences",
  "wine.rdf":
    "Minor differences in equivalent class links and implicit inverse property generation; class restrictions domain/range properties match 100%",
  // Versioned ontologies
  "iso_31073_ed-1_20260626":
    "Java reasoner additions, minor duplicate union differences",
  "iso-iec_11179_-3_ed-4_20260714":
    "Java reasoner additions and minor annotation differences",
  "universal_reference-data_20260714":
    "Java reasoner additions and minor annotation differences",
  universal_core_20260714:
    "Java reasoner additions and minor annotation differences",
  universal_extended_20260714:
    "Java reasoner additions and minor annotation differences",
};

function throwFriendlyTestError(message) {
  const error = new Error(message);

  // Prevent Jest from printing the source-code frame and stack trace.
  error.stack = message;

  throw error;
}

function runJavaConverter(filePath) {
  // Use the existing materialised Java output whenever available.
  const materialisedOutput = readJavaReferenceOutput(filePath);
  if (materialisedOutput) {
    return materialisedOutput;
  }

  try {
    /*
     * Keep this call synchronous because each test immediately compares its
     * result. Passing arguments separately avoids shell parsing and the fragile
     * quoting that a single command string would require on Windows and POSIX.
     */
    const stdout = execFileSync(
      "java",
      [
        // 100000 default causes error in processing of
        // e.g. "Drammar_NunnaryScene_Optimized_Rules.owl"
        "-Djdk.xml.totalEntitySizeLimit=1000000",
        "--add-opens",
        "java.base/java.lang=ALL-UNNAMED",
        "-jar",
        JAVA_JAR,
        "-file",
        filePath,
        "-echo",
      ],
      {
        maxBuffer: JAVA_MAX_BUFFER_BYTES,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      },
    );

    const jsonStart = stdout.indexOf("{");
    const jsonEnd = stdout.lastIndexOf("}");

    if (jsonStart === -1 || jsonEnd === -1 || jsonEnd < jsonStart) {
      throw new Error("Could not find valid JSON in Java output");
    }

    return JSON.parse(stdout.slice(jsonStart, jsonEnd + 1));
  } catch {
    return null;
  }
}

function createTextResponse(textContent) {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    text: async () => textContent,
  };
}

function readLocalOntologyResponse(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  return createTextResponse(fs.readFileSync(filePath, "utf8"));
}

function getRequestUrl(input) {
  if (typeof input === "string") {
    return input;
  }

  if (input instanceof URL) {
    return input.href;
  }

  return input.url;
}

describe("OWL2VOWL Java-to-JavaScript differential tests", () => {
  // Run ontology fixtures through the Java and JavaScript implementations,
  // compare their outputs, and verify the accepted behaviour.
  let originalFetch;

  beforeAll(() => {
    originalFetch = globalThis.fetch;
    globalThis.fetch = async (input) => {
      const requestUrl = getRequestUrl(input);

      const filePath = getLocalOntologyPath(requestUrl);

      const localResponse = readLocalOntologyResponse(filePath);

      if (localResponse) {
        return localResponse;
      }

      /*
       * The loader only consumes the small Response-like contract above. An
       * empty ontology keeps the suite deterministic and prevents accidental
       * network access when an optional import has no local fixture.
       */
      return createTextResponse(EMPTY_ONTOLOGY_XML);
    };
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  const excludedBaseFiles = new Set(["musicontology.rdfs"]);

  const baseTargetFiles = Object.values(ONTOLOGY_CATALOG)
    .map(getLocalOntologyPath)
    .filter((file) => !excludedBaseFiles.has(path.basename(file)));

  const extraTargetFiles = [
    path.join(LOCAL_ONTOLOGY_DIST_DIR, "iso", "31073", "ed-1", "20260626"),
    path.join(
      LOCAL_ONTOLOGY_DIST_DIR,
      "iso-iec",
      "11179",
      "-3",
      "ed-4",
      "20260714",
    ),
    path.join(
      LOCAL_ONTOLOGY_DIST_DIR,
      "universal",
      "reference-data",
      "20260714",
    ),
    path.join(LOCAL_ONTOLOGY_DIST_DIR, "universal", "core", "20260714"),
    path.join(LOCAL_ONTOLOGY_DIST_DIR, "universal", "extended", "20260714"),
  ];

  const targetFiles = [...new Set([...baseTargetFiles, ...extraTargetFiles])]
    .filter((file) => fs.existsSync(file))
    .sort();

  for (const file of targetFiles) {
    const keyName = getFilePathKey(file);
    const testTitle = `Differential test for ${keyName}`;

    test(
      testTitle,
      async () => {
        expect(fs.existsSync(file)).toBe(true);

        const javaRaw = runJavaConverter(file);
        expect(javaRaw).not.toBeNull();
        const javaParsed = parseVowlJson(javaRaw);

        const xml = fs.readFileSync(file, "utf8");
        const jsRaw = await loadWithImports(xml);
        expect(jsRaw).toBeDefined();
        const jsParsed = parseVowlJson(jsRaw);

        if (keyName === "universal_core_20260714") {
          expect(jsRaw.class).toBeDefined();
          expect(jsRaw.classAttribute).toBeDefined();

          const productOrServiceAttribute = jsRaw.classAttribute.find(
            ({ iri }) =>
              iri ===
              "https://haddenindustries.com/ontology/universal/core/ProductOrService",
          );
          expect(productOrServiceAttribute).toBeDefined();

          const productOrServiceNode = jsRaw.class.find(
            ({ id }) => id === productOrServiceAttribute.id,
          );
          expect(productOrServiceNode).toBeDefined();
          expect(productOrServiceNode.type).toBe("owl:unionOf");
          expect(productOrServiceAttribute.attributes).toContain("union");

          expect(productOrServiceAttribute.label).toBeDefined();
          expect(productOrServiceAttribute.label.en).toBe("Product Or Service");

          expect(productOrServiceAttribute.annotations).toBeDefined();
          expect(productOrServiceAttribute.annotations.prefLabel).toBeDefined();
          expect(productOrServiceAttribute.annotations.prefLabel[0].value).toBe(
            "Product Or Service",
          );

          expect(productOrServiceAttribute.annotations.creator).toBeDefined();
          expect(productOrServiceAttribute.annotations.creator[0].value).toBe(
            "https://orcid.org/0000-0001-8017-8797",
          );

          expect(productOrServiceAttribute.annotations.created).toBeDefined();
          expect(productOrServiceAttribute.annotations.created[0].value).toBe(
            "2016-10-14T12:00:00Z",
          );

          expect(productOrServiceAttribute.annotations.modified).toBeDefined();
          expect(productOrServiceAttribute.annotations.modified[0].value).toBe(
            "2026-06-25T13:41:59Z",
          );

          expect(
            productOrServiceAttribute.annotations.definition,
          ).toBeDefined();
          expect(
            productOrServiceAttribute.annotations.definition.some(({ value }) =>
              value.includes("Output or outcome provided by an organisation"),
            ),
          ).toBe(true);

          expect(productOrServiceAttribute.annotations.source).toBeDefined();
          expect(productOrServiceAttribute.annotations.source[0].value).toBe(
            "urn:iso:std:iso:22300:ed-3:v1:term:3.1.191",
          );

          expect(productOrServiceAttribute.annotations.example).toBeDefined();
          expect(productOrServiceAttribute.annotations.example[0].value).toBe(
            "Manufactured items, car insurance, community nursing",
          );
        }

        if (keyName === "personasonto.owl") {
          expect(jsRaw.header.title.en).toBe("PersonasOnto");
          expect(jsRaw.header.iri).toBe(
            "http://blankdots.com/open/personasonto.owl",
          );
          expect(jsRaw.header.version).toBe("1.5");
          expect(jsRaw.header.author).toContain("Stefan Negru");

          expect(jsParsed.classes.size).toBeGreaterThanOrEqual(
            javaParsed.classes.size - 5,
          );
          expect(
            Object.keys(jsParsed.properties).length,
          ).toBeGreaterThanOrEqual(
            Object.keys(javaParsed.properties).length - 5,
          );
        }

        const javaClassAttributes = javaRaw.classAttribute ?? [];
        const jsClassAttributes = jsRaw.classAttribute ?? [];
        const jsPropertyAttributes = jsRaw.propertyAttribute ?? [];
        const jsClasses = jsRaw.class ?? [];

        // Check owl:Thing attributes; neither converter should mark them external.
        const javaThingAttributes = javaClassAttributes.filter(
          ({ iri }) => iri === OWL_THING_IRI,
        );
        const jsThingAttributes = jsClassAttributes.filter(
          ({ iri }) => iri === OWL_THING_IRI,
        );
        for (const attribute of [
          ...javaThingAttributes,
          ...jsThingAttributes,
        ]) {
          if (attribute.attributes) {
            expect(attribute.attributes).not.toContain("external");
          }
        }

        // Check rdfs:Literal attributes; neither converter should mark them external.
        const javaLiteralAttributes = javaClassAttributes.filter(
          ({ iri }) => iri === RDFS_LITERAL_IRI,
        );
        const jsLiteralAttributes = jsClassAttributes.filter(
          ({ iri }) => iri === RDFS_LITERAL_IRI,
        );
        for (const attribute of [
          ...javaLiteralAttributes,
          ...jsLiteralAttributes,
        ]) {
          if (attribute.attributes) {
            expect(attribute.attributes).not.toContain("external");
          }
        }

        // Check the virtual literal class type.
        const jsLiteralAttributeIds = new Set(
          jsLiteralAttributes.map(({ id }) => id),
        );
        const jsLiteralClasses = jsClasses.filter(({ id }) =>
          jsLiteralAttributeIds.has(id),
        );
        for (const literalClass of jsLiteralClasses) {
          expect(literalClass.type).toBe("rdfs:Literal");
        }

        // Check datatype cleanup.
        const connectedNodeIds = new Set();
        for (const propertyAttribute of jsPropertyAttributes) {
          if (propertyAttribute.domain) {
            connectedNodeIds.add(String(propertyAttribute.domain));
          }
          if (propertyAttribute.range) {
            connectedNodeIds.add(String(propertyAttribute.range));
          }
        }

        const jsClassAttributesById = new Map(
          jsClassAttributes.map((attribute) => [attribute.id, attribute]),
        );
        const datatypeAttributes = jsClasses
          .filter(({ type }) => type === "rdfs:Datatype")
          .map(({ id }) => jsClassAttributesById.get(id))
          .filter(Boolean);
        const connectedDatatypeIris = new Set(
          datatypeAttributes
            .filter(({ id, iri }) => connectedNodeIds.has(String(id)) && iri)
            .map(({ iri }) => iri),
        );

        for (const datatypeAttribute of datatypeAttributes) {
          const isConnected = connectedNodeIds.has(
            String(datatypeAttribute.id),
          );

          if (!isConnected && datatypeAttribute.iri) {
            expect(connectedDatatypeIris.has(datatypeAttribute.iri)).toBe(
              false,
            );
          }
        }

        // Verify equivalent-property structure.
        const propertyAttributesById = new Map(
          jsPropertyAttributes.map((attribute) => [
            String(attribute.id),
            attribute,
          ]),
        );
        const propertyMap = new Map();
        for (const property of jsRaw.property ?? []) {
          const attribute = propertyAttributesById.get(String(property.id));
          if (attribute) {
            propertyMap.set(String(property.id), attribute);
          }
        }

        for (const attribute of jsPropertyAttributes) {
          if (attribute.equivalent?.length > 0) {
            expect(attribute.attributes).toContain("equivalent");

            for (const equivalentId of attribute.equivalent) {
              const targetAttribute = propertyMap.get(String(equivalentId));
              expect(targetAttribute).toBeDefined();
              expect(targetAttribute.attributes).toContain("equivalent");
            }
          }
        }

        // Check structural equivalence; documented differences remain permitted.
        const { isExactMatch, failedChecks } = compareVowlSemantics(
          javaParsed,
          jsParsed,
        );

        if (!isExactMatch) {
          process.stderr.write(
            `[DIAGNOSTIC] File ${keyName}: failed ${failedChecks.join(", ")}\n`,
          );
        }

        if (!isExactMatch && !Object.hasOwn(expectedDifferences, keyName)) {
          throwFriendlyTestError(
            [
              `Unexpected Java/JavaScript differences for "${keyName}".`,
              "Add an entry to expectedDifferences, for example:",
              `  "${keyName}": "Describe the expected differences"`,
            ].join("\n"),
          );
        }
      },
      TEST_TIMEOUT_MS,
    );
  }
});
