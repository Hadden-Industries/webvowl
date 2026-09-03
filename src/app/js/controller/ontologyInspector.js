import {
  assertCurrentOntologyElementReference,
  truncateOntologyDerivedText,
  truncateResultCollection,
  WEB_VOWL_OPERATION_LIMITS,
} from "./webVowlControllerContracts.js";

const SEARCHABLE_ONTOLOGY_ELEMENT_KINDS = Object.freeze([
  "class",
  "datatype",
  "individual",
  "property",
]);

const RECORD_COLLECTION_FIELD_NAMES_BY_KIND = Object.freeze({
  class: "classRecords",
  datatype: "datatypeRecords",
  individual: "individualRecords",
  property: "propertyRecords",
});

const NEIGHBORHOOD_FIELD_NAMES_BY_KIND = Object.freeze({
  class: Object.freeze([
    "superclassReferences",
    "equivalentClassReferences",
    "disjointClassReferences",
  ]),
  datatype: Object.freeze([]),
  individual: Object.freeze(["classReferences"]),
  property: Object.freeze([
    "domainReferences",
    "rangeReferences",
    "superpropertyReferences",
    "inversePropertyReferences",
  ]),
});

const EXACT_LABEL_RANK = 0;
const LABEL_PREFIX_RANK = 1;
const LABEL_CONTAINS_RANK = 2;
// An equivalent's label identifies the element it is equivalent to, which is
// how the original search reached a class by the name of its equivalent. It
// ranks below every direct label match so a direct hit still wins, and above
// the IRI ranks because it is a name a reader would recognise.
const EQUIVALENT_LABEL_RANK = 3;
const IRI_CONTAINS_RANK = 4;
const NO_MATCH_RANK = Number.MAX_SAFE_INTEGER;

const REFERENCE_KEY_SEPARATOR = "\u0000";

function assertPlainRecord(candidate, description) {
  if (
    candidate === null ||
    typeof candidate !== "object" ||
    Array.isArray(candidate)
  ) {
    throw new TypeError(`${description} must be a plain object.`);
  }
}

function assertAgreeingLoadGeneration(
  ontologyInspectionSnapshot,
  visibleRenderedGraphSnapshot,
) {
  assertPlainRecord(ontologyInspectionSnapshot, "ontologyInspectionSnapshot");
  assertPlainRecord(
    visibleRenderedGraphSnapshot,
    "visibleRenderedGraphSnapshot",
  );
  if (
    ontologyInspectionSnapshot.loadGeneration !==
    visibleRenderedGraphSnapshot.loadGeneration
  ) {
    throw new RangeError(
      "The inspection and visible snapshots must share one load generation.",
    );
  }
  return ontologyInspectionSnapshot.loadGeneration;
}

function ontologyElementReferenceKey(ontologyElementReference) {
  if (typeof ontologyElementReference.iri === "string") {
    return [ontologyElementReference.kind, ontologyElementReference.iri].join(
      REFERENCE_KEY_SEPARATOR,
    );
  }
  return [
    ontologyElementReference.kind,
    String(ontologyElementReference.loadGeneration),
    ontologyElementReference.localId,
  ].join(REFERENCE_KEY_SEPARATOR);
}

function createVisibleReferenceKeySet(visibleRenderedGraphSnapshot) {
  const visibleReferenceKeys = new Set();
  for (const ontologyElementReference of [
    ...visibleRenderedGraphSnapshot.visibleElementReferences,
    ...visibleRenderedGraphSnapshot.visibleRelationshipReferences,
  ]) {
    visibleReferenceKeys.add(
      ontologyElementReferenceKey(ontologyElementReference),
    );
  }
  return visibleReferenceKeys;
}

function selectLocalizedText(localizedTextRecords, selectedLanguage) {
  if (localizedTextRecords.length === 0) {
    return null;
  }
  const selectedRecord =
    localizedTextRecords.find(
      ({ languageTag }) => languageTag === selectedLanguage,
    ) ?? localizedTextRecords[0];
  return selectedRecord.text;
}

function boundOntologyDerivedText(ontologyDerivedText, truncationTracker) {
  if (ontologyDerivedText === null) {
    return null;
  }
  const truncation = truncateOntologyDerivedText(ontologyDerivedText);
  if (truncation.isTruncated) {
    truncationTracker.isTruncated = true;
  }
  return truncation.ontologyDerivedText;
}

function boundResultCollection(
  resultEntries,
  maximumEntryCount,
  truncationTracker,
) {
  // An absent ceiling means the caller accepts every entry.
  if (maximumEntryCount === undefined) {
    return [...resultEntries];
  }
  const truncation = truncateResultCollection(resultEntries, maximumEntryCount);
  if (truncation.isTruncated) {
    truncationTracker.isTruncated = true;
  }
  return truncation.retainedEntries;
}

function createTruncationTracker() {
  return { isTruncated: false };
}

function elementIri(ontologyElementReference) {
  return typeof ontologyElementReference.iri === "string"
    ? ontologyElementReference.iri
    : null;
}

function elementIdentitySortKey(ontologyElementReference) {
  return (
    elementIri(ontologyElementReference) ?? ontologyElementReference.localId
  );
}

function displayLabelForRecord(elementRecord, selectedLanguage) {
  const localizedLabel = selectLocalizedText(
    elementRecord.labelRecords,
    selectedLanguage,
  );
  if (localizedLabel !== null) {
    return localizedLabel;
  }
  return elementIdentitySortKey(elementRecord.ontologyElementReference);
}

function labelMatchRank(labelTexts, normalizedQuery) {
  let bestRank = NO_MATCH_RANK;
  for (const labelText of labelTexts) {
    const normalizedLabel = labelText.toLowerCase();
    if (normalizedLabel === normalizedQuery) {
      return EXACT_LABEL_RANK;
    }
    if (normalizedLabel.startsWith(normalizedQuery)) {
      bestRank = Math.min(bestRank, LABEL_PREFIX_RANK);
    } else if (normalizedLabel.includes(normalizedQuery)) {
      bestRank = Math.min(bestRank, LABEL_CONTAINS_RANK);
    }
  }
  return bestRank;
}

function matchRankForRecord(
  elementRecord,
  normalizedQuery,
  labelTextsByReferenceKey,
) {
  const labelTexts = elementRecord.labelRecords.map(({ text }) => text);
  const rank = labelMatchRank(labelTexts, normalizedQuery);
  if (rank !== NO_MATCH_RANK) {
    return rank;
  }
  const equivalentLabelTexts = (
    elementRecord.equivalentClassReferences ?? []
  ).flatMap(
    (equivalentReference) =>
      labelTextsByReferenceKey.get(
        ontologyElementReferenceKey(equivalentReference),
      ) ?? [],
  );
  if (labelMatchRank(equivalentLabelTexts, normalizedQuery) !== NO_MATCH_RANK) {
    return EQUIVALENT_LABEL_RANK;
  }
  const iri = elementIri(elementRecord.ontologyElementReference);
  if (iri !== null && iri.toLowerCase().includes(normalizedQuery)) {
    return IRI_CONTAINS_RANK;
  }
  return NO_MATCH_RANK;
}

// An equivalence names another record by reference, so its labels have to be
// looked up rather than read from the record that carries the equivalence.
function indexLabelTextsByReferenceKey(ontologyInspectionSnapshot) {
  const labelTextsByReferenceKey = new Map();
  for (const elementRecord of ontologyInspectionSnapshot.classRecords) {
    const key = ontologyElementReferenceKey(
      elementRecord.ontologyElementReference,
    );
    const labelTexts = labelTextsByReferenceKey.get(key) ?? [];
    labelTexts.push(...elementRecord.labelRecords.map(({ text }) => text));
    labelTextsByReferenceKey.set(key, labelTexts);
  }
  return labelTextsByReferenceKey;
}

function createNeighborhoodFacts(elementRecord, kind, truncationTracker) {
  const neighborhoodFacts = {};
  for (const neighborhoodFieldName of NEIGHBORHOOD_FIELD_NAMES_BY_KIND[kind]) {
    neighborhoodFacts[neighborhoodFieldName] = boundResultCollection(
      elementRecord[neighborhoodFieldName],
      WEB_VOWL_OPERATION_LIMITS.maxFocusReferences,
      truncationTracker,
    );
  }
  return Object.freeze(neighborhoodFacts);
}

function assertNonEmptyQuery(query) {
  if (typeof query !== "string" || query.trim().length === 0) {
    throw new TypeError("An ontology search query must be a non-empty string.");
  }
}

function resolveRequestedKinds(kinds) {
  if (kinds === undefined) {
    return SEARCHABLE_ONTOLOGY_ELEMENT_KINDS;
  }
  if (!Array.isArray(kinds) || kinds.length === 0) {
    throw new TypeError(
      "Requested ontology-element kinds must be a non-empty array.",
    );
  }
  for (const kind of kinds) {
    if (!SEARCHABLE_ONTOLOGY_ELEMENT_KINDS.includes(kind)) {
      throw new TypeError(`Unsupported ontology-element kind: ${kind}`);
    }
  }
  return kinds;
}

// A caller that needs a bounded answer says so. The WebMCP tool contract
// supplies that bound for an agent; the interface lists every match, as it
// always has.
function resolveMatchLimit(limit) {
  if (limit === undefined) {
    return undefined;
  }
  if (!Number.isInteger(limit) || limit < 1) {
    throw new RangeError("A search limit must be a positive integer.");
  }
  return limit;
}

export function createOntologyInspector() {
  return Object.freeze({
    getOntologySummary({
      ontologyInspectionSnapshot,
      visibleRenderedGraphSnapshot,
      appliedVisualizationView,
      sourceProvenance,
      warnings = [],
    }) {
      const loadGeneration = assertAgreeingLoadGeneration(
        ontologyInspectionSnapshot,
        visibleRenderedGraphSnapshot,
      );
      assertPlainRecord(appliedVisualizationView, "appliedVisualizationView");
      assertPlainRecord(sourceProvenance, "sourceProvenance");
      if (!Array.isArray(warnings)) {
        throw new TypeError("Summary warnings must be an array.");
      }

      const truncationTracker = createTruncationTracker();
      const selectedLanguage = appliedVisualizationView.language ?? null;
      const ontologyHeaderRecord =
        ontologyInspectionSnapshot.ontologyHeaderRecord;

      const source = { kind: sourceProvenance.kind };
      source.identity = boundOntologyDerivedText(
        sourceProvenance.identity,
        truncationTracker,
      );
      if (sourceProvenance.sha256Hex !== undefined) {
        source.sha256Hex = sourceProvenance.sha256Hex;
      }

      return Object.freeze({
        loadGeneration,
        source: Object.freeze(source),
        ontologyHeader: Object.freeze({
          ontologyIri: ontologyHeaderRecord.ontologyIri,
          versionInformationText: ontologyHeaderRecord.versionInformationText,
          title: boundOntologyDerivedText(
            selectLocalizedText(
              ontologyHeaderRecord.titleRecords,
              selectedLanguage,
            ),
            truncationTracker,
          ),
          description: boundOntologyDerivedText(
            selectLocalizedText(
              ontologyHeaderRecord.descriptionRecords,
              selectedLanguage,
            ),
            truncationTracker,
          ),
          authorNames: Object.freeze(
            ontologyHeaderRecord.authorNames.map((authorName) =>
              boundOntologyDerivedText(authorName, truncationTracker),
            ),
          ),
        }),
        elementCounts: Object.freeze({
          classCount: ontologyInspectionSnapshot.classRecords.length,
          propertyCount: ontologyInspectionSnapshot.propertyRecords.length,
          datatypeCount: ontologyInspectionSnapshot.datatypeRecords.length,
          individualCount: ontologyInspectionSnapshot.individualRecords.length,
        }),
        visibleGraphCounts: visibleRenderedGraphSnapshot.visibleGraphCounts,
        namespaces: ontologyInspectionSnapshot.namespaceRecords,
        imports: ontologyInspectionSnapshot.importRecords,
        availableLabelLanguages:
          ontologyInspectionSnapshot.availableLabelLanguages,
        selectedLanguage,
        filters: Object.freeze({ ...appliedVisualizationView.filters }),
        warnings: boundResultCollection(
          warnings.map((warningText) =>
            boundOntologyDerivedText(warningText, truncationTracker),
          ),
          WEB_VOWL_OPERATION_LIMITS.maxWarnings,
          truncationTracker,
        ),
        isTruncated: truncationTracker.isTruncated,
      });
    },

    findOntologyElements({
      ontologyInspectionSnapshot,
      visibleRenderedGraphSnapshot,
      query,
      kinds,
      limit,
      includeNeighborhood = false,
      language,
    }) {
      const loadGeneration = assertAgreeingLoadGeneration(
        ontologyInspectionSnapshot,
        visibleRenderedGraphSnapshot,
      );
      assertNonEmptyQuery(query);
      const requestedKinds = resolveRequestedKinds(kinds);
      const matchLimit = resolveMatchLimit(limit);
      const selectedLanguage = language ?? null;
      const visibleReferenceKeys = createVisibleReferenceKeySet(
        visibleRenderedGraphSnapshot,
      );
      const normalizedQuery = query.trim().toLowerCase();
      const truncationTracker = createTruncationTracker();

      const labelTextsByReferenceKey = indexLabelTextsByReferenceKey(
        ontologyInspectionSnapshot,
      );
      const rankedMatches = [];
      for (const kind of requestedKinds) {
        const elementRecords =
          ontologyInspectionSnapshot[
            RECORD_COLLECTION_FIELD_NAMES_BY_KIND[kind]
          ];
        for (const elementRecord of elementRecords) {
          const matchRank = matchRankForRecord(
            elementRecord,
            normalizedQuery,
            labelTextsByReferenceKey,
          );
          if (matchRank === NO_MATCH_RANK) {
            continue;
          }
          rankedMatches.push({
            elementRecord,
            kind,
            kindRank: SEARCHABLE_ONTOLOGY_ELEMENT_KINDS.indexOf(kind),
            matchRank,
          });
        }
      }

      rankedMatches.sort((leftMatch, rightMatch) => {
        if (leftMatch.matchRank !== rightMatch.matchRank) {
          return leftMatch.matchRank - rightMatch.matchRank;
        }
        if (leftMatch.kindRank !== rightMatch.kindRank) {
          return leftMatch.kindRank - rightMatch.kindRank;
        }
        return elementIdentitySortKey(
          leftMatch.elementRecord.ontologyElementReference,
        ).localeCompare(
          elementIdentitySortKey(
            rightMatch.elementRecord.ontologyElementReference,
          ),
        );
      });

      const retainedMatches = boundResultCollection(
        rankedMatches,
        matchLimit,
        truncationTracker,
      );

      const matches = retainedMatches.map(({ elementRecord, kind }) => {
        const ontologyElementReference = elementRecord.ontologyElementReference;
        const match = {
          ontologyElementReference,
          kind,
          displayLabel: boundOntologyDerivedText(
            displayLabelForRecord(elementRecord, selectedLanguage),
            truncationTracker,
          ),
          iri: elementIri(ontologyElementReference),
          isFocusable: visibleReferenceKeys.has(
            ontologyElementReferenceKey(ontologyElementReference),
          ),
        };
        if (includeNeighborhood) {
          match.neighborhoodFacts = createNeighborhoodFacts(
            elementRecord,
            kind,
            truncationTracker,
          );
        }
        return Object.freeze(match);
      });

      return Object.freeze({
        loadGeneration,
        matches: Object.freeze(matches),
        isTruncated: truncationTracker.isTruncated,
      });
    },

    resolveFocusableOntologyElementReferences({
      ontologyInspectionSnapshot,
      visibleRenderedGraphSnapshot,
      ontologyElementReferences,
    }) {
      const loadGeneration = assertAgreeingLoadGeneration(
        ontologyInspectionSnapshot,
        visibleRenderedGraphSnapshot,
      );
      if (!Array.isArray(ontologyElementReferences)) {
        throw new TypeError(
          "Ontology-element references must be supplied as an array.",
        );
      }

      const truncationTracker = createTruncationTracker();
      const visibleReferenceKeys = createVisibleReferenceKeySet(
        visibleRenderedGraphSnapshot,
      );
      const focusableReferences = [];
      const unresolvedReferences = [];
      for (const ontologyElementReference of ontologyElementReferences) {
        const currentReference = assertCurrentOntologyElementReference(
          ontologyElementReference,
          loadGeneration,
        );
        if (
          visibleReferenceKeys.has(
            ontologyElementReferenceKey(currentReference),
          )
        ) {
          focusableReferences.push(currentReference);
        } else {
          unresolvedReferences.push(currentReference);
        }
      }

      return Object.freeze({
        loadGeneration,
        focusableReferences: boundResultCollection(
          focusableReferences,
          WEB_VOWL_OPERATION_LIMITS.maxFocusReferences,
          truncationTracker,
        ),
        unresolvedReferences: boundResultCollection(
          unresolvedReferences,
          WEB_VOWL_OPERATION_LIMITS.maxFocusReferences,
          truncationTracker,
        ),
        isTruncated: truncationTracker.isTruncated,
      });
    },
  });
}
