import {
  cardinalityText,
  indexDirectMemberships,
  countIndexedDirectMemberships,
  isVowlExternal,
  indexVowlLabelCandidates,
  selectVowlLabel,
  selectVowlPrincipal,
  vowlRadiusFactor,
} from "./vowlDisplayProjector.js";

const GENERIC = new Set([
  "http://www.w3.org/2002/07/owl#Thing",
  "http://www.w3.org/2000/01/rdf-schema#Resource",
]);
const OPERATORS = new Map([
  ["class-union", "union"],
  ["class-intersection", "intersection"],
  ["class-complement", "complement"],
]);
const VISUAL_CHARACTERISTICS = new Set([
  "functional",
  "inverse-functional",
  "symmetric",
  "transitive",
]);

/**
 * Prepare drawing data from an admitted inspection and its complete scene.
 * Rows are keyed by exact occurrences. This boundary does not infer endpoints,
 * merge equivalences, manufacture inverse pairs, or create semantic records.
 */
export function createCanonicalVowlRenderProjection(inspection, visualization) {
  const structural = inspection.records;
  const records = new Map(
    ["subjects", "roles", "expressions", "constructs"].flatMap((collection) =>
      structural[collection].map((record) => [record.id, record]),
    ),
  );
  const occurrences = new Map(
    inspection.occurrences.map((occurrence) => [occurrence.id, occurrence]),
  );
  const placements = new Map(
    visualization.placements.map((placement) => [
      placement.occurrence,
      placement,
    ]),
  );
  const hidden = new Set(visualization.hidden);
  const rootOntologyIri = structural.ontology.iri;
  const labelsBySubject = indexVowlLabelCandidates(structural);
  const membersById = new Map();
  const characteristicsByProperty = new Map();
  const operandsByExpression = new Map();
  for (const record of structural.constructs) {
    if (
      record.kind.endsWith("-characteristic") &&
      VISUAL_CHARACTERISTICS.has(record.characteristic)
    ) {
      const values =
        characteristicsByProperty.get(record.property) ?? new Set();
      values.add(record.characteristic);
      characteristicsByProperty.set(record.property, values);
    }
  }
  for (const edge of inspection.occurrences) {
    if (edge.kind === "operator-edge") {
      const targets = operandsByExpression.get(edge.expression) ?? new Set();
      for (const target of occurrences.get(edge.to).targets) {
        targets.add(target);
      }
      operandsByExpression.set(edge.expression, targets);
    }
  }
  const memberships = indexDirectMemberships(
    structural.constructs
      .filter(({ kind }) => kind === "class-membership")
      .map((record) => [record.class, record.individual]),
  );
  function get(id) {
    const record = records.get(id);
    if (!record) {
      throw new TypeError(
        "Render projection requires admitted record references.",
      );
    }
    return record;
  }
  function member(id) {
    if (membersById.has(id)) {
      return membersById.get(id);
    }
    const record = get(id);
    const subject = record.subject && get(record.subject);
    const operator = OPERATORS.get(record.kind);
    const iri = subject?.iri;
    const external = isVowlExternal({ rootOntologyIri, subjectIri: iri });
    const result = {
      record: id,
      kind: record.kind,
      ...(iri === undefined ? {} : { iri }),
      name:
        operator ??
        selectVowlLabel({
          iri,
          unnamedKind: "anonymous class",
          selection: visualization.labelSelection,
          candidates: labelsBySubject.get(subject?.id) ?? [],
          prefixes: visualization.prefixes,
        }),
      external,
      externalStyle: visualization.display.externalColoring && external,
    };
    membersById.set(id, result);
    return result;
  }
  function group(ids) {
    const members = ids.map(member);
    const selected = selectVowlPrincipal({ rootOntologyIri, members });
    // B1 admits unnamed/operator targets only as singleton nodes.
    return {
      principal: selected.principal ?? members[0],
      aliases: selected.aliases,
      members,
    };
  }
  function placed(occurrence) {
    const placement = placements.get(occurrence.id);
    if (!placement) {
      throw new TypeError("Render projection requires a complete scene.");
    }
    return {
      occurrence: occurrence.id,
      hidden: hidden.has(occurrence.id),
      position: { ...placement.position },
      pinned: placement.pinned,
    };
  }
  function characteristics(principal) {
    return [...(characteristicsByProperty.get(principal.record) ?? [])].sort();
  }
  const nodes = inspection.occurrences
    .filter(({ kind }) => kind === "class-node" || kind === "datatype-node")
    .map((occurrence) => {
      const targets = occurrence.targets ?? [occurrence.target];
      const names = group(targets);
      const expression = get(targets[0]);
      const operator = OPERATORS.get(expression.kind);
      const operands = operator
        ? (expression.members ?? [expression.operand])
        : [];
      const drawnOperands =
        operandsByExpression.get(expression.id) ?? new Set();
      return {
        ...placed(occurrence),
        kind: occurrence.kind,
        targets: [...targets],
        ...names,
        ...(operator
          ? {
              operator,
              additionalOperands: operands.filter(
                (id) => !drawnOperands.has(id),
              ),
            }
          : {}),
        ...(occurrence.kind === "class-node"
          ? {
              radiusFactor: vowlRadiusFactor({
                generic:
                  targets.length === 1 && GENERIC.has(names.principal.iri),
                nodeScaling: visualization.display.nodeScaling,
                directDistinctIndividualCount: countIndexedDirectMemberships(
                  targets,
                  memberships,
                ),
              }),
            }
          : {}),
      };
    });
  const edges = inspection.occurrences
    .filter(({ kind }) => kind.endsWith("-edge"))
    .map((occurrence) => ({
      occurrence: occurrence.id,
      kind: occurrence.kind,
      hidden: hidden.has(occurrence.id),
      from: occurrence.from ?? occurrence.ends[0],
      to: occurrence.to ?? occurrence.ends.at(-1),
      records:
        occurrence.properties ??
        (occurrence.kind === "inverse-edge"
          ? [occurrence.construct, ...occurrence.forward, ...occurrence.reverse]
          : [occurrence.construct ?? occurrence.expression]),
    }));
  const labels = inspection.occurrences
    .filter(({ kind }) => kind === "label")
    .map((occurrence) => {
      const edge = occurrences.get(occurrence.edge);
      const base = {
        ...placed(occurrence),
        edge: edge.id,
        direction: occurrence.direction,
      };
      if (edge.kind === "subclass-edge") {
        return {
          ...base,
          name: visualization.display.compactNotation ? "" : "Subclass of",
          description: "Subclass of",
          records: [edge.construct],
          aliases: [],
          characteristics: [],
        };
      }
      const restriction =
        edge.kind === "restriction-edge"
          ? get(get(edge.construct).super)
          : undefined;
      const targets = restriction
        ? [restriction.property]
        : edge.kind === "inverse-edge"
          ? edge[occurrence.direction]
          : edge.properties;
      const names = group(targets);
      return {
        ...base,
        ...names,
        name: names.principal.name,
        records: [...targets],
        // Scoped restrictions do not borrow global characteristic treatment.
        characteristics: restriction ? [] : characteristics(names.principal),
        ...(restriction ? { cardinality: cardinalityText(restriction) } : {}),
      };
    });
  return {
    nodes,
    edges,
    labels,
    camera: structuredClone(visualization.camera),
    display: structuredClone(visualization.display),
    labelSelection: structuredClone(visualization.labelSelection),
    // Exact retained facts remain available for partial/details-only renderings.
    inspection: structuredClone(inspection),
  };
}
