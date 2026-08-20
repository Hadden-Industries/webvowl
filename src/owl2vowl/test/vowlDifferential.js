import * as fs from "node:fs";
import * as path from "node:path";

import { ONTOLOGY_BASE_URL, ONTOLOGY_CATALOG } from "../js/constants.js";
import { LOCAL_ONTOLOGY_DIST_DIR } from "./helpers.js";

// The semantic projection and comparison shared by the two corpus differential
// suites: the retained legacy characterization suite and the production suite
// that gates Phase 8.
//
// Both must measure the same things in the same way, or "the production path
// differs from the oracle here" cannot be compared against "the legacy path
// differed from the oracle here", and the historical register stops being a
// usable baseline. Extracting the logic rather than copying it is what keeps
// that comparison meaningful.
//
// This is deliberately a different mechanism from `vowlSemanticSnapshot.js`.
// That module asserts exact equality and is used for focused fixtures where
// exactness is achievable. Real ontologies are not exactly equal to the oracle,
// so this module projects onto seven independently reportable dimensions,
// which is what makes a difference governable rather than just a failure.

const RDFS_SUBCLASS_OF_IRI = "http://www.w3.org/2000/01/rdf-schema#subClassOf";

export const JAVA_FIXTURE_DIR = fs.realpathSync(
  new URL("./fixtures/java-reference-outputs/", import.meta.url),
);

export function getFilePathKey(filePath) {
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

// The pinned oracle's outputs are committed, so neither suite needs the Java
// jar present to run. A missing fixture is an error rather than a skip: silently
// comparing nothing is how a differential gate stops measuring anything.
export function readJavaReferenceOutput(filePath) {
  const fixturePath = path.join(
    JAVA_FIXTURE_DIR,
    `${getFilePathKey(filePath)}.java.json`,
  );

  if (!fs.existsSync(fixturePath)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(fixturePath, "utf8"));
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

// Resolves exactly as `src/owl2vowl/js/importResolver.js` does: a catalog hit,
// otherwise the IRI unchanged. It deliberately does NOT use the legacy
// `resolveImportUrl`, whose basename fallback maps any IRI ending in "spatial"
// onto `spatial.rdf`. That heuristic belongs to the retained pipeline, and
// borrowing it here fabricated a same-ontology-ID collision that the production
// resolver cannot produce - the harness was inventing the defect it reported.
const exactLocalOntologyPath = (requestUrl) => {
  const mapped = ONTOLOGY_CATALOG[requestUrl] ?? requestUrl;

  if (!mapped.startsWith(ONTOLOGY_BASE_URL)) {
    return null;
  }

  const relativePath = mapped
    .slice(ONTOLOGY_BASE_URL.length)
    .split(/[?#]/, 1)[0];

  return path.join(
    LOCAL_ONTOLOGY_DIST_DIR,
    ...relativePath.split("/").filter(Boolean),
  );
};

// Serves the corpus from disk so the production differential is deterministic
// and offline. An unresolvable import returns 404 rather than a stand-in
// document: substituting an empty ontology would silently change what is being
// compared, and the production entry already treats a missing import as a
// diagnostic rather than a failure.
//
// `unavailableImports` withholds named IRIs. A differential is only meaningful
// when both sides convert the same ontology, and the pinned reference outputs
// were produced by running the jar against local files, so any import that run
// could not fetch is absent from the fixture. Where this project's catalog
// resolves such an IRI the two closures diverge, and the difference then says
// nothing about either engine. Withholding it here reproduces the conditions the
// reference run actually had. Production import resolution is untouched.
export function installLocalOntologyFetch({ unavailableImports = [] } = {}) {
  const originalFetch = globalThis.fetch;
  // `WebVowlImportResolver` maps an import IRI through the catalog before
  // fetching, so the request never carries the IRI the document declared.
  // Withholding therefore has to name both forms.
  const withheld = new Set(
    unavailableImports.flatMap((iri) =>
      ONTOLOGY_CATALOG[iri] ? [iri, ONTOLOGY_CATALOG[iri]] : [iri],
    ),
  );

  globalThis.fetch = async (input) => {
    const requestUrl = getRequestUrl(input);
    const filePath = withheld.has(requestUrl)
      ? null
      : exactLocalOntologyPath(requestUrl);

    if (filePath && fs.existsSync(filePath)) {
      return {
        headers: { get: () => "application/rdf+xml" },
        ok: true,
        status: 200,
        statusText: "OK",
        text: async () => fs.readFileSync(filePath, "utf8"),
      };
    }

    return {
      headers: { get: () => null },
      ok: false,
      status: 404,
      statusText: "Not Found",
      text: async () => "",
    };
  };

  return () => {
    globalThis.fetch = originalFetch;
  };
}

// A label is a language-keyed map, so ordering is irrelevant but content is not.
const normalizeLabel = (label) =>
  label
    ? JSON.stringify(
        Object.fromEntries(
          Object.keys(label)
            .sort()
            .map((key) => [key, label[key]]),
        ),
      )
    : "";

// The pinned oracle writes a different attribute dialect from WebVOWL's own
// VOWL-JSON. It spells the restriction markers `someValues`/`allValues` where
// WebVOWL writes `someValuesFrom`/`allValuesFrom`, and it never writes the
// `inferred` marker WebVOWL puts on links it derived rather than found
// asserted. `object`, `datatype` and `anonymous` are written by both and are
// already carried by the compared node type.
//
// These terms are suppressed here for the same reason `vowlSemanticSnapshot.js`
// suppresses them under `JAVA_OWL2VOWL_DIALECT`: comparing them against the
// oracle measures a dialect difference rather than a semantic one. Suppression
// is valid only against the Java oracle - a WebVOWL-to-WebVOWL comparison must
// still see them, because `inferred` has no other carrier.
const JAVA_DIALECT_ATTRIBUTES = new Set([
  "allValues",
  "allValuesFrom",
  "anonymous",
  "datatype",
  "inferred",
  "object",
  "someValues",
  "someValuesFrom",
]);

// Visual markers are a set, not a sequence: `["external", "equivalent"]` and
// `["equivalent", "external"]` draw the same node.
const normalizeAttributes = (attributes) =>
  attributes
    ? [...attributes]
        .filter((attribute) => !JAVA_DIALECT_ATTRIBUTES.has(attribute))
        .sort()
        .join(",")
    : "";

export function normalizeAnnotations(annotations) {
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
          // Code-point comparison, not `localeCompare`: this canonicalises both
          // sides of the differential, so locale collation would make the
          // comparison depend on the machine it runs on.
          .sort((left, right) => {
            const leftKey = `${left.language}-${left.value}`;
            const rightKey = `${right.language}-${right.value}`;
            return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
          }),
      ]),
  );

  return JSON.stringify(normalized);
}

export function parseVowlJson(json) {
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

  // Node type is carried on `class`/`property` and keyed by id, while the IRI
  // lives on the matching attribute. Joining them lets a type difference be
  // reported against the entity a reader can actually identify.
  const classNodeTypes = Object.fromEntries(
    (json.class ?? []).map(({ id, type }) => [id, type]),
  );
  const propertyNodeTypes = Object.fromEntries(
    rawProperties.map(({ id, type }) => [id, type]),
  );

  const classes = new Set();
  const classAnnotations = {};
  const classInstances = {};
  const classLabels = {};
  const classTypes = {};
  const classEntityAttributes = {};
  for (const classAttribute of classAttributes) {
    if (classAttribute.iri) {
      classes.add(classAttribute.iri);
      classAnnotations[classAttribute.iri] = normalizeAnnotations(
        classAttribute.annotations,
      );
      classInstances[classAttribute.iri] = classAttribute.instances || 0;
      classLabels[classAttribute.iri] = normalizeLabel(classAttribute.label);
      classTypes[classAttribute.iri] = classNodeTypes[classAttribute.id] ?? "";
      classEntityAttributes[classAttribute.iri] = normalizeAttributes(
        classAttribute.attributes,
      );
    }
  }

  const properties = {};
  const propertyAnnotations = {};
  const propertyLabels = {};
  const propertyTypes = {};
  const propertyEntityAttributes = {};
  for (const propertyAttribute of propertyAttributes) {
    if (
      propertyAttribute.iri &&
      propertyAttribute.iri !== RDFS_SUBCLASS_OF_IRI
    ) {
      propertyLabels[propertyAttribute.iri] = normalizeLabel(
        propertyAttribute.label,
      );
      // The entries under one IRI genuinely differ here - a restriction edge is
      // typed `owl:allValuesFrom` where the property itself is typed
      // `owl:objectProperty` - so keeping only the last would decide the verdict
      // on serialisation order. Every type is collected and canonicalised below.
      (propertyTypes[propertyAttribute.iri] ??= []).push(
        propertyNodeTypes[propertyAttribute.id] ?? "",
      );
      propertyEntityAttributes[propertyAttribute.iri] = normalizeAttributes(
        propertyAttribute.attributes,
      );
      // One IRI can appear many times: once for the declared property and once
      // more for every restriction edge drawn with it. Keeping only the last
      // would make the verdict depend on serialisation order, so every edge is
      // kept and the comparison is made over the whole collection.
      properties[propertyAttribute.iri] ??= [];
      properties[propertyAttribute.iri].push({
        domain:
          classIdToIri[propertyAttribute.domain] ||
          propertyAttribute.domain ||
          null,
        range:
          classIdToIri[propertyAttribute.range] ||
          propertyAttribute.range ||
          null,
      });
      propertyAnnotations[propertyAttribute.iri] = normalizeAnnotations(
        propertyAttribute.annotations,
      );
    }
  }

  // Sorted so the set of types an IRI carries is compared, never the order they
  // were serialised in.
  for (const iri of Object.keys(propertyTypes)) {
    propertyTypes[iri] = propertyTypes[iri].sort().join("|");
  }

  const subclasses = [];
  for (const propertyAttribute of propertyAttributes) {
    const isSubclassProperty = subclassPropertyIds.has(propertyAttribute.id);

    if (isSubclassProperty || propertyAttribute.iri === RDFS_SUBCLASS_OF_IRI) {
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

    if (isDisjointProperty || propertyAttribute.type === "owl:disjointWith") {
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
  const title = json.header?.title?.en || json.header?.title?.undefined || "";

  return {
    ontologyIri: json.header ? json.header.iri : null,
    title,
    classes,
    classAnnotations,
    classInstances,
    classLabels,
    classTypes,
    classEntityAttributes,
    properties,
    propertyAnnotations,
    propertyLabels,
    propertyTypes,
    propertyEntityAttributes,
    subclasses,
    unions,
    disjoints: uniqueDisjoints,
  };
}

export function arrayDifference(left, right) {
  const rightValues = new Set(right);
  return left.filter((value) => !rightValues.has(value));
}

export function referencesMatch(
  leftReference,
  rightReference,
  leftUnions,
  rightUnions,
) {
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

// Compares the reference projection against the candidate projection across the
// seven dimensions the corpus differential governs. The verdict per dimension is
// exactly what the pre-cutover suite computed inline; the `detail` alongside it
// is additive, so a difference can be described rather than merely counted.
export function compareVowlSemantics(reference, candidate) {
  const iriMatch = reference.ontologyIri === candidate.ontologyIri;
  const classesMatch = reference.classes.size === candidate.classes.size;

  const referencePropertyIris = Object.keys(reference.properties).sort();
  const candidatePropertyIris = Object.keys(candidate.properties).sort();
  const missingProperties = referencePropertyIris.filter(
    (iri) => !Object.hasOwn(candidate.properties, iri),
  );
  const extraProperties = candidatePropertyIris.filter(
    (iri) => !Object.hasOwn(reference.properties, iri),
  );
  const commonPropertyIris = referencePropertyIris.filter((iri) =>
    Object.hasOwn(candidate.properties, iri),
  );
  // Both collections must be drawn edge for edge. An entry is matched against
  // an unused entry on the other side rather than by position, so ordering
  // cannot decide the verdict, while an edge one engine draws and the other
  // does not still counts as a difference.
  const edgesMatch = (referenceEdge, candidateEdge) =>
    referencesMatch(
      referenceEdge.domain,
      candidateEdge.domain,
      reference.unions,
      candidate.unions,
    ) &&
    referencesMatch(
      referenceEdge.range,
      candidateEdge.range,
      reference.unions,
      candidate.unions,
    );

  const structureMismatches = commonPropertyIris.filter((iri) => {
    const referenceEdges = reference.properties[iri];
    const candidateEdges = candidate.properties[iri];
    if (referenceEdges.length !== candidateEdges.length) {
      return true;
    }

    const unmatched = [...candidateEdges];
    for (const referenceEdge of referenceEdges) {
      const index = unmatched.findIndex((candidateEdge) =>
        edgesMatch(referenceEdge, candidateEdge),
      );
      if (index === -1) {
        return true;
      }
      unmatched.splice(index, 1);
    }
    return false;
  });
  const propertiesMatch =
    missingProperties.length === 0 &&
    extraProperties.length === 0 &&
    structureMismatches.length === 0;

  const missingSubclasses = arrayDifference(
    reference.subclasses,
    candidate.subclasses,
  );
  const extraSubclasses = arrayDifference(
    candidate.subclasses,
    reference.subclasses,
  );
  const subclassesMatch =
    missingSubclasses.length === 0 && extraSubclasses.length === 0;

  const missingDisjoints = arrayDifference(
    reference.disjoints,
    candidate.disjoints,
  );
  const extraDisjoints = arrayDifference(
    candidate.disjoints,
    reference.disjoints,
  );
  const disjointsMatch =
    missingDisjoints.length === 0 && extraDisjoints.length === 0;

  const commonClasses = [...reference.classes].filter((iri) =>
    candidate.classes.has(iri),
  );
  const classAnnotationMismatches = commonClasses.filter(
    (iri) =>
      reference.classAnnotations[iri] !== candidate.classAnnotations[iri],
  );
  const instanceMismatches = commonClasses.filter(
    (iri) => reference.classInstances[iri] !== candidate.classInstances[iri],
  );
  const propertyAnnotationMismatches = commonPropertyIris.filter(
    (iri) =>
      reference.propertyAnnotations[iri] !== candidate.propertyAnnotations[iri],
  );
  const annotationsMatch =
    classAnnotationMismatches.length === 0 &&
    propertyAnnotationMismatches.length === 0;
  const instancesMatch = instanceMismatches.length === 0;

  // The user-visible tier: what an entity is called, what shape it is drawn as,
  // and which visual markers it carries. Compared only over entities both sides
  // share, so a missing entity is reported once as a class or property
  // difference rather than again under every derived dimension.
  const mismatchesOver = (keys, referenceMap, candidateMap) =>
    keys.filter((key) => referenceMap[key] !== candidateMap[key]);

  const classLabelMismatches = mismatchesOver(
    commonClasses,
    reference.classLabels,
    candidate.classLabels,
  );
  const propertyLabelMismatches = mismatchesOver(
    commonPropertyIris,
    reference.propertyLabels,
    candidate.propertyLabels,
  );
  const classTypeMismatches = mismatchesOver(
    commonClasses,
    reference.classTypes,
    candidate.classTypes,
  );
  const propertyTypeMismatches = mismatchesOver(
    commonPropertyIris,
    reference.propertyTypes,
    candidate.propertyTypes,
  );
  const classAttributeMismatches = mismatchesOver(
    commonClasses,
    reference.classEntityAttributes,
    candidate.classEntityAttributes,
  );
  const propertyAttributeMismatches = mismatchesOver(
    commonPropertyIris,
    reference.propertyEntityAttributes,
    candidate.propertyEntityAttributes,
  );

  const labelsMatch =
    classLabelMismatches.length === 0 && propertyLabelMismatches.length === 0;
  const typesMatch =
    classTypeMismatches.length === 0 && propertyTypeMismatches.length === 0;
  const attributesMatch =
    classAttributeMismatches.length === 0 &&
    propertyAttributeMismatches.length === 0;

  const checks = {
    iri: iriMatch,
    classes: classesMatch,
    props: propertiesMatch,
    subclasses: subclassesMatch,
    annotations: annotationsMatch,
    instances: instancesMatch,
    disjoints: disjointsMatch,
    labels: labelsMatch,
    types: typesMatch,
    attributes: attributesMatch,
  };

  return {
    checks,
    isExactMatch: Object.values(checks).every(Boolean),
    failedChecks: Object.entries(checks)
      .filter(([, matches]) => !matches)
      .map(([name]) => name),
    detail: {
      iri: {
        reference: reference.ontologyIri,
        candidate: candidate.ontologyIri,
      },
      classes: {
        referenceCount: reference.classes.size,
        candidateCount: candidate.classes.size,
        missing: [...reference.classes].filter(
          (iri) => !candidate.classes.has(iri),
        ),
        extra: [...candidate.classes].filter(
          (iri) => !reference.classes.has(iri),
        ),
      },
      properties: {
        missing: missingProperties,
        extra: extraProperties,
        structureMismatches,
      },
      subclasses: { missing: missingSubclasses, extra: extraSubclasses },
      disjoints: { missing: missingDisjoints, extra: extraDisjoints },
      annotations: {
        classes: classAnnotationMismatches,
        properties: propertyAnnotationMismatches,
      },
      instances: instanceMismatches,
      labels: {
        classes: classLabelMismatches,
        properties: propertyLabelMismatches,
      },
      types: {
        classes: classTypeMismatches,
        properties: propertyTypeMismatches,
      },
      attributes: {
        classes: classAttributeMismatches,
        properties: propertyAttributeMismatches,
      },
    },
  };
}
