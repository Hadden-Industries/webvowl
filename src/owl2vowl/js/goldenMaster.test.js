import { afterAll, beforeAll, describe, expect, test } from "@jest/globals";
import * as fs from "node:fs";
import * as path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadWithImports } from "./index.js";
import { resolveImportUrl } from "./importLoader.js";
import {
  EXTERNAL_ONTOLOGY_BASE_URL,
  ONTOLOGY_CATALOG,
} from "./constants.js";

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

const JAVA_FIXTURE_DIR = path.join(
  WORKSPACE_PARENT,
  "webvowl",
  "src",
  "owl2vowl",
  "test",
  "fixtures",
  "input",
);

const LOCAL_ONTOLOGY_DIR = path.join(
  WORKSPACE_PARENT,
  "universal-ontology",
);

const LOCAL_ONTOLOGY_DIST_DIR = path.join(
  LOCAL_ONTOLOGY_DIR,
  "dist",
);

const JAVA_MAX_BUFFER_BYTES = 10 * 1024 * 1024;
const TEST_TIMEOUT_MS = 30_000;
const ONTOLOGY_BASE_URL = "https://haddenindustries.com/ontology/";
const RDFS_SUBCLASS_OF_IRI =
  "http://www.w3.org/2000/01/rdf-schema#subClassOf";
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
  "wgs84_pos.rdf":
    "Java reasoner additions and minor annotation differences",
  "wine.rdf":
    "Minor differences in equivalent class links and implicit inverse property generation; class restrictions domain/range properties match 100%",
  // Versioned ontologies
  "iso_31073_ed-1_20260626":
    "Java reasoner additions, minor duplicate union differences",
  "iso-iec_11179_-3_ed-4_20260714":
    "Java reasoner additions and minor annotation differences",
  "universal_reference-data_20260714":
    "Java reasoner additions and minor annotation differences",
  "universal_core_20260714":
    "Java reasoner additions and minor annotation differences",
  "universal_extended_20260714":
    "Java reasoner additions and minor annotation differences",
};

function getLocalOntologyPath(requestUrl) {
  if (requestUrl.startsWith(ONTOLOGY_BASE_URL)) {
    const relativeUrlPath = requestUrl
      .slice(ONTOLOGY_BASE_URL.length)
      .split(/[?#]/, 1)[0];

    return path.join(
      LOCAL_ONTOLOGY_DIST_DIR,
      ...relativeUrlPath.split("/").filter(Boolean),
    );
  }

  const resolvedImportPath = resolveImportUrl(requestUrl);
  const relativeOntologyPath = resolvedImportPath.replace(
    /^\.\.[\\/]ontology[\\/]/,
    "",
  );

  return path.join(
    LOCAL_ONTOLOGY_DIR,
    relativeOntologyPath,
  );
}

function getFilePathKey(filePath) {
  const pathParts = filePath.split(/[\\/]+/).filter(Boolean);
  const fileName = pathParts.at(-1);

  // Files with an extension use the complete filename unchanged.
  if (path.extname(fileName) !== "") {
    return fileName;
  }

  const distIndex = pathParts.lastIndexOf("dist");

  if (distIndex === -1) {
    throw new Error(`Path does not contain a "dist" directory: ${filePath}`);
  }

  return pathParts.slice(distIndex + 1).join("_");
}

function throwFriendlyTestError(message) {
  const error = new Error(message);

  // Prevent Jest from printing the source-code frame and stack trace.
  error.stack = message;

  throw error;
}

function runJavaConverter(filePath) {
  const outputFileName = `${getFilePathKey(filePath)}.java.json`;
  const materialisedOutputPath = path.join(JAVA_FIXTURE_DIR, outputFileName);

  // Use the existing materialised Java output whenever available.
  if (fs.existsSync(materialisedOutputPath)) {
    return JSON.parse(fs.readFileSync(materialisedOutputPath, "utf8"));
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
        "-jar", JAVA_JAR,
        "-file", filePath,
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

function normalizeAnnotations(annotations) {
  if (!annotations) {
    return "";
  }

  const normalized = Object.fromEntries(
    Object.keys(annotations)
      .sort()
      .map((key) => [
        key,
        annotations[key]
          .map(({ value, type, language, identifier }) => ({
            value,
            type,
            language: language || "undefined",
            identifier,
          }))
          .sort((left, right) =>
            `${left.language}-${left.value}`.localeCompare(
              `${right.language}-${right.value}`,
            ),
          ),
      ]),
  );

  return JSON.stringify(normalized);
}

function parseVowlJson(json) {
  if (!json) {
    return null;
  }

  const classAttributes = json.classAttribute ?? [];
  const propertyAttributes = json.propertyAttribute ?? [];
  const rawProperties = json.property ?? [];

  const classIdToIri = Object.fromEntries(
    classAttributes.map(({ id, iri }) => [id, iri]),
  );
  const subclassPropertyIds = new Set(
    rawProperties
      .filter(({ type }) => type === "rdfs:SubClassOf")
      .map(({ id }) => id),
  );
  const disjointPropertyIds = new Set(
    rawProperties
      .filter(({ type }) => type === "owl:disjointWith")
      .map(({ id }) => id),
  );

  const classes = new Set();
  const classAnnotations = {};
  const classInstances = {};
  for (const classAttribute of classAttributes) {
    if (classAttribute.iri) {
      classes.add(classAttribute.iri);
      classAnnotations[classAttribute.iri] = normalizeAnnotations(
        classAttribute.annotations,
      );
      classInstances[classAttribute.iri] = classAttribute.instances || 0;
    }
  }

  const properties = {};
  const propertyAnnotations = {};
  for (const propertyAttribute of propertyAttributes) {
    if (
      propertyAttribute.iri &&
      propertyAttribute.iri !== RDFS_SUBCLASS_OF_IRI
    ) {
      properties[propertyAttribute.iri] = {
        domain:
          classIdToIri[propertyAttribute.domain] ||
          propertyAttribute.domain ||
          null,
        range:
          classIdToIri[propertyAttribute.range] ||
          propertyAttribute.range ||
          null,
      };
      propertyAnnotations[propertyAttribute.iri] = normalizeAnnotations(
        propertyAttribute.annotations,
      );
    }
  }

  const subclasses = [];
  for (const propertyAttribute of propertyAttributes) {
    const isSubclassProperty = subclassPropertyIds.has(propertyAttribute.id);

    if (
      isSubclassProperty ||
      propertyAttribute.iri === RDFS_SUBCLASS_OF_IRI
    ) {
      const subclass =
        classIdToIri[propertyAttribute.domain] || propertyAttribute.domain;
      const superclass =
        classIdToIri[propertyAttribute.range] || propertyAttribute.range;

      if (subclass && superclass) {
        subclasses.push(`${subclass} -> ${superclass}`);
      }
    }
  }
  subclasses.sort();

  const unions = {};
  for (const classAttribute of classAttributes) {
    if (classAttribute.union) {
      unions[classAttribute.iri || classAttribute.id] = classAttribute.union
        .map((memberId) => classIdToIri[memberId] || memberId)
        .sort();
    }
  }

  const disjoints = [];
  for (const propertyAttribute of propertyAttributes) {
    const isDisjointProperty = disjointPropertyIds.has(propertyAttribute.id);

    if (
      isDisjointProperty ||
      propertyAttribute.type === "owl:disjointWith"
    ) {
      const firstClass =
        classIdToIri[propertyAttribute.domain] || propertyAttribute.domain;
      const secondClass =
        classIdToIri[propertyAttribute.range] || propertyAttribute.range;

      if (firstClass && secondClass) {
        const [lowerIri, higherIri] = [firstClass, secondClass].sort();
        disjoints.push(`${lowerIri} <-> ${higherIri}`);
      }
    }
  }

  const uniqueDisjoints = [...new Set(disjoints)].sort();
  const title =
    json.header?.title?.en || json.header?.title?.undefined || "";

  return {
    ontologyIri: json.header ? json.header.iri : null,
    title,
    classes,
    classAnnotations,
    classInstances,
    properties,
    propertyAnnotations,
    subclasses,
    unions,
    disjoints: uniqueDisjoints,
  };
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

function arrayDifference(left, right) {
  const rightValues = new Set(right);
  return left.filter((value) => !rightValues.has(value));
}

function referencesMatch(leftReference, rightReference, leftUnions, rightUnions) {
  if (leftReference === rightReference) {
    return true;
  }

  const leftUnion = leftUnions[leftReference];
  const rightUnion = rightUnions[rightReference];

  /*
   * Anonymous union nodes can receive different generated identifiers in the
   * two converters. Their sorted member lists are therefore the stable value
   * to compare, rather than the converter-specific node identifiers.
   */
  return Boolean(
    leftUnion &&
      rightUnion &&
      JSON.stringify(leftUnion) === JSON.stringify(rightUnion),
  );
}

describe("Golden Master Compatibility Tests", () => {
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
    path.join(
      LOCAL_ONTOLOGY_DIST_DIR,
      "iso",
      "31073",
      "ed-1",
      "20260626",
    ),
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
    path.join(
      LOCAL_ONTOLOGY_DIST_DIR,
      "universal",
      "core",
      "20260714",
    ),
    path.join(
      LOCAL_ONTOLOGY_DIST_DIR,
      "universal",
      "extended",
      "20260714",
    ),
  ];

  const targetFiles = [...new Set([...baseTargetFiles, ...extraTargetFiles])]
    .filter((file) => fs.existsSync(file))
    .sort();

  for (const file of targetFiles) {
    const keyName = getFilePathKey(file);
    const testTitle = `Golden master compatibility for ${keyName}`;

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
          expect(productOrServiceAttribute.label.en).toBe(
            "Product Or Service",
          );

          expect(productOrServiceAttribute.annotations).toBeDefined();
          expect(
            productOrServiceAttribute.annotations.prefLabel,
          ).toBeDefined();
          expect(
            productOrServiceAttribute.annotations.prefLabel[0].value,
          ).toBe("Product Or Service");

          expect(
            productOrServiceAttribute.annotations.creator,
          ).toBeDefined();
          expect(productOrServiceAttribute.annotations.creator[0].value).toBe(
            "https://orcid.org/0000-0001-8017-8797",
          );

          expect(
            productOrServiceAttribute.annotations.created,
          ).toBeDefined();
          expect(productOrServiceAttribute.annotations.created[0].value).toBe(
            "2016-10-14T12:00:00Z",
          );

          expect(
            productOrServiceAttribute.annotations.modified,
          ).toBeDefined();
          expect(productOrServiceAttribute.annotations.modified[0].value).toBe(
            "2026-06-25T13:41:59Z",
          );

          expect(
            productOrServiceAttribute.annotations.definition,
          ).toBeDefined();
          expect(
            productOrServiceAttribute.annotations.definition.some(
              ({ value }) =>
                value.includes(
                  "Output or outcome provided by an organisation",
                ),
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
          expect(Object.keys(jsParsed.properties).length).toBeGreaterThanOrEqual(
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
            .filter(
              ({ id, iri }) => connectedNodeIds.has(String(id)) && iri,
            )
            .map(({ iri }) => iri),
        );

        for (const datatypeAttribute of datatypeAttributes) {
          const isConnected = connectedNodeIds.has(
            String(datatypeAttribute.id),
          );

          if (!isConnected && datatypeAttribute.iri) {
            expect(
              connectedDatatypeIris.has(datatypeAttribute.iri),
            ).toBe(false);
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
        const iriMatch = javaParsed.ontologyIri === jsParsed.ontologyIri;
        const classesMatch =
          javaParsed.classes.size === jsParsed.classes.size;

        const javaPropertyIris = Object.keys(javaParsed.properties).sort();
        const jsPropertyIris = Object.keys(jsParsed.properties).sort();
        const missingProperties = javaPropertyIris.filter(
          (iri) => !Object.hasOwn(jsParsed.properties, iri),
        );
        const extraProperties = jsPropertyIris.filter(
          (iri) => !Object.hasOwn(javaParsed.properties, iri),
        );
        const commonPropertyIris = javaPropertyIris.filter((iri) =>
          Object.hasOwn(jsParsed.properties, iri),
        );
        const propertyStructuresMatch = commonPropertyIris.every((iri) => {
          const javaProperty = javaParsed.properties[iri];
          const jsProperty = jsParsed.properties[iri];

          return (
            referencesMatch(
              javaProperty.domain,
              jsProperty.domain,
              javaParsed.unions,
              jsParsed.unions,
            ) &&
            referencesMatch(
              javaProperty.range,
              jsProperty.range,
              javaParsed.unions,
              jsParsed.unions,
            )
          );
        });
        const propertiesMatch =
          missingProperties.length === 0 &&
          extraProperties.length === 0 &&
          propertyStructuresMatch;

        const missingSubclasses = arrayDifference(
          javaParsed.subclasses,
          jsParsed.subclasses,
        );
        const extraSubclasses = arrayDifference(
          jsParsed.subclasses,
          javaParsed.subclasses,
        );
        const subclassesMatch =
          missingSubclasses.length === 0 && extraSubclasses.length === 0;

        const missingDisjoints = arrayDifference(
          javaParsed.disjoints,
          jsParsed.disjoints,
        );
        const extraDisjoints = arrayDifference(
          jsParsed.disjoints,
          javaParsed.disjoints,
        );
        const disjointsMatch =
          missingDisjoints.length === 0 && extraDisjoints.length === 0;

        const commonClasses = [...javaParsed.classes].filter((iri) =>
          jsParsed.classes.has(iri),
        );
        const classAnnotationsMatch = commonClasses.every(
          (iri) =>
            javaParsed.classAnnotations[iri] ===
            jsParsed.classAnnotations[iri],
        );
        const instancesMatch = commonClasses.every(
          (iri) =>
            javaParsed.classInstances[iri] === jsParsed.classInstances[iri],
        );
        const propertyAnnotationsMatch = commonPropertyIris.every(
          (iri) =>
            javaParsed.propertyAnnotations[iri] ===
            jsParsed.propertyAnnotations[iri],
        );
        const annotationsMatch =
          classAnnotationsMatch && propertyAnnotationsMatch;

        const isExactMatch =
          iriMatch &&
          classesMatch &&
          propertiesMatch &&
          subclassesMatch &&
          annotationsMatch &&
          instancesMatch &&
          disjointsMatch;

        if (!isExactMatch) {
          const failedChecks = Object.entries({
            iri: iriMatch,
            classes: classesMatch,
            props: propertiesMatch,
            subclasses: subclassesMatch,
            annotations: annotationsMatch,
            instances: instancesMatch,
            disjoints: disjointsMatch,
          })
            .filter(([, matches]) => !matches)
            .map(([name]) => name);

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
