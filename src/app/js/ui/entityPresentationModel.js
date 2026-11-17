import {
  ontologyElementReferenceKey,
  ONTOLOGY_ROLE_KINDS,
} from "../controller/webVowlControllerContracts.js";

const kindOrder = ["class", "datatype", "individual", "property"];
const fieldLabels = Object.freeze({
  elementTypeName: "Type",
  commentText: "Comment",
  descriptionText: "Description",
  annotationRecords: "Annotations",
  characteristicNames: "Characteristics",
  unclassifiedAttributeNames: "Other attributes",
  cardinalityRecord: "Cardinality",
  superclassElements: "Superclasses",
  equivalentClassElements: "Equivalent classes",
  disjointClassElements: "Disjoint classes",
  individualElements: "Individuals",
  classElements: "Types",
  domainElements: "Domain",
  rangeElements: "Range",
  superpropertyElements: "Superproperties",
  inversePropertyElements: "Inverse properties",
  equivalentPropertyElements: "Equivalent properties",
  subpropertyElements: "Subproperties",
});

export function readableFieldName(name) {
  return (
    fieldLabels[name] ??
    name
      .replace(/([a-z])([A-Z])/gu, "$1 $2")
      .replace(/^./u, (letter) => letter.toUpperCase())
  );
}

function compact(value, limit = 150) {
  const text = String(value ?? "");
  const points = [...text];
  return points.length > limit
    ? points.slice(0, limit - 1).join("") + "…"
    : text;
}

function relationSummary(label, values = []) {
  if (!values.length) {
    return null;
  }
  return (
    label +
    ": " +
    values
      .slice(0, 2)
      .map((entry) => compact(entry.displayLabel, 45))
      .join(", ") +
    (values.length > 2 ? ` and ${values.length - 2} more` : "")
  );
}

// The annotations a reader most often wants before opening everything, in the
// order the summary shows them. Every other annotation stays in `fields`.
const HIGHLIGHTED_ANNOTATION_PROPERTIES = Object.freeze([
  ["http://www.w3.org/2004/02/skos/core#definition", "Definition"],
  ["http://www.w3.org/2004/02/skos/core#scopeNote", "Scope note"],
  ["http://purl.org/dc/terms/source", "Source"],
  ["http://purl.org/dc/terms/references", "References"],
]);
const HIGHLIGHTED_ANNOTATION_TEXT_LIMIT = 280;

function highlightedAnnotations(annotationRecords = [], preferredLanguageTag) {
  const preferred = preferredLanguageTag?.toLowerCase();
  return HIGHLIGHTED_ANNOTATION_PROPERTIES.flatMap(([propertyIri, label]) => {
    const records = annotationRecords.filter(
      (record) => record.propertyIri === propertyIri,
    );
    const inPreferredLanguage = records.filter(
      (record) => preferred && record.languageTag?.toLowerCase() === preferred,
    );
    const untagged = records.filter((record) => !record.languageTag);
    const chosen = inPreferredLanguage.length
      ? inPreferredLanguage
      : untagged.length
        ? untagged
        : records;
    const values = [];
    for (const record of chosen) {
      const languageTag = record.languageTag ?? null;
      const repeated = values.some(
        (value) =>
          value.complete === record.text && value.languageTag === languageTag,
      );
      if (!repeated) {
        values.push({ complete: record.text, languageTag });
      }
    }
    return values.length
      ? [
          Object.freeze({
            propertyIri,
            label,
            values: Object.freeze(
              values.map(({ complete, languageTag }) =>
                Object.freeze({
                  text: compact(complete, HIGHLIGHTED_ANNOTATION_TEXT_LIMIT),
                  languageTag,
                }),
              ),
            ),
          }),
        ]
      : [];
  });
}

const TYPE_SYMBOLS_BY_KIND = Object.freeze({
  class: "○",
  datatype: "▭",
  individual: "◆",
  property: "→",
});
// Class-expression names win over the role when a description carries one.
const TYPE_SYMBOLS_BY_EXPRESSION_NAME = Object.freeze([
  [/disjoint-?union/u, "⊎"],
  [/union/u, "∪"],
  [/intersection/u, "∩"],
  [/complement/u, "¬"],
]);

function typeSymbol(description) {
  const typeName = String(description.elementTypeName ?? "").toLowerCase();
  return (
    TYPE_SYMBOLS_BY_EXPRESSION_NAME.find(([pattern]) =>
      pattern.test(typeName),
    )?.[1] ?? TYPE_SYMBOLS_BY_KIND[description.kind]
  );
}

/** Formats the controller's complete descriptions; it derives no semantic facts. */
export function createEntityPresentation(
  descriptions,
  { preferredLanguageTag } = {},
) {
  const unique = new Map(
    descriptions.map((description) => [
      ontologyElementReferenceKey(description.ontologyElementReference),
      description,
    ]),
  );
  return Object.freeze(
    [...unique.values()]
      .sort((a, b) => {
        const order = kindOrder.indexOf(a.kind) - kindOrder.indexOf(b.kind);
        const aKey = ontologyElementReferenceKey(a.ontologyElementReference);
        const bKey = ontologyElementReferenceKey(b.ontologyElementReference);
        return order || (aKey < bKey ? -1 : aKey > bKey ? 1 : 0);
      })
      .map((description) => {
        const summaries = [];
        if (description.kind === "class") {
          summaries.push(
            relationSummary("Superclasses", description.superclassElements),
          );
          summaries.push(
            `${description.individualElements?.length ?? 0} individuals · ${description.disjointClassElements?.length ?? 0} disjoint classes`,
          );
        } else if (description.kind === "property") {
          summaries.push(relationSummary("Domain", description.domainElements));
          summaries.push(relationSummary("Range", description.rangeElements));
          summaries.push(
            relationSummary("Inverse", description.inversePropertyElements),
          );
          if (description.characteristicNames?.length) {
            summaries.push(compact(description.characteristicNames.join(", ")));
          }
        } else if (description.kind === "individual") {
          summaries.push(relationSummary("Types", description.classElements));
        }
        const fields = Object.entries(description)
          .filter(
            ([key]) =>
              ![
                "ontologyElementReference",
                "kind",
                "displayLabel",
                "iri",
              ].includes(key),
          )
          .map(([key, value]) =>
            Object.freeze({ key, label: readableFieldName(key), value }),
          );
        return Object.freeze({
          key: ontologyElementReferenceKey(
            description.ontologyElementReference,
          ),
          reference: description.ontologyElementReference,
          label:
            description.displayLabel || description.iri || "Anonymous entity",
          role:
            description.ontologyElementReference.roleKind ?? description.kind,
          kind: description.kind,
          type:
            description.elementTypeName || readableFieldName(description.kind),
          typeSymbol: typeSymbol(description),
          iri: description.iri,
          compactIri: description.iri
            ? compact(description.iri, 70)
            : "Anonymous — no IRI",
          summary: compact(
            (
              description.commentText ||
              description.descriptionText ||
              ""
            ).split(/(?<=[.!?])\s/u)[0],
          ),
          summaries: Object.freeze(summaries.filter(Boolean)),
          highlightedAnnotations: Object.freeze(
            highlightedAnnotations(
              description.annotationRecords,
              preferredLanguageTag,
            ),
          ),
          fields: Object.freeze(fields),
        });
      }),
  );
}

export function relatedEntityRoleReferences(reference) {
  if (!reference.iri) {
    return [reference];
  }
  return Object.entries(ONTOLOGY_ROLE_KINDS).flatMap(([kind, roles]) =>
    roles.map((roleKind) => ({ kind, roleKind, iri: reference.iri })),
  );
}

export function sameSemanticSelection(a, b) {
  return (
    a?.length === b?.length &&
    a.every(
      (entry, index) =>
        ontologyElementReferenceKey(entry) ===
        ontologyElementReferenceKey(b[index]),
    )
  );
}
