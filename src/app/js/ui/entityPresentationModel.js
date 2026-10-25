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

/** Formats the controller's complete descriptions; it derives no semantic facts. */
export function createEntityPresentation(descriptions) {
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
