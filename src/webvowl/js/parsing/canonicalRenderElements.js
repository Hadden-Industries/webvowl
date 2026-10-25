import { namespaces } from "vowl";
import { createNodeMap } from "../elements/nodes/nodeMap.js";
import { createPropertyMap } from "../elements/properties/propertyMap.js";
import { createAttributeParser } from "./attributeParser.js";

const nodeTypes = {
  class: "owl:Class",
  "rdf-class": "rdfs:Class",
  datatype: "rdfs:Datatype",
  "class-union": "owl:unionOf",
  "class-intersection": "owl:intersectionOf",
  "class-complement": "owl:complementOf",
};
const builtinTypes = new Map([
  [namespaces.owl + "Thing", "owl:Thing"],
  [namespaces.owl + "Nothing", "owl:Nothing"],
  [namespaces.rdfs + "Resource", "rdfs:Resource"],
  [namespaces.rdfs + "Literal", "rdfs:Literal"],
]);
const propertyTypes = {
  "object-property": "owl:ObjectProperty",
  "data-property": "owl:DatatypeProperty",
  "rdf-property": "rdf:Property",
};

function position(element, placement) {
  element.x = placement.position.x;
  element.y = placement.position.y;
  element.px = element.x;
  element.py = element.y;
  element.pinned(placement.pinned);
}

// The journal is consumed inside installation and cleared. No installed
// closure retains the previous primitive maps or an obsolete drawing owner.
export function installCanonicalRenderPlacements(elements) {
  for (const [element, placement, label] of elements.placements) {
    element.locked(false);
    position(element, placement);
    if (label) {
      element.labelVisible(!label.hidden && Boolean(label.name));
    }
  }
  elements.placements.length = 0;
}

/** Materialize existing SVG primitives directly from authoritative drawing rows. */
export function createCanonicalRenderElements(graph, drawing, retained) {
  const nodeMap = createNodeMap();
  const propertyMap = createPropertyMap();
  const attributes = createAttributeParser();
  const elements = new Map();
  const bindings = new Map();
  const retainedNodes = new Map(
    retained?.nodes.map((node) => [node.id(), node]),
  );
  const retainedProperties = new Map(
    retained?.properties.map((property) => [property.id(), property]),
  );
  const placements = [];
  const dirty = new Set();
  const nodeRows = new Map(drawing.nodes.map((row) => [row.occurrence, row]));
  function named(element, value, id) {
    element.id(id).label(value.name).iri(value.iri);
    return element;
  }
  function nodeType(member) {
    return builtinTypes.get(member.iri) ?? nodeTypes[member.kind];
  }
  const nodes = drawing.nodes.flatMap((row) => {
    bindings.set(row.occurrence, {
      occurrence: row.occurrence,
      records: [...row.targets],
      positionable: true,
    });
    if (row.hidden) {
      return [];
    }
    const Prototype = nodeMap.get(nodeType(row.principal));
    if (!Prototype) {
      throw new TypeError("Unsupported admitted node drawing kind.");
    }
    const retainedNode = retainedNodes.get(row.occurrence);
    const previous =
      retainedNode &&
      retainedNode.indications().includes("additional operands in details") ===
        Boolean(row.additionalOperands?.length)
        ? retainedNode
        : undefined;
    if (previous) {
      if (previous.pinned() !== row.pinned) {
        dirty.add(previous);
      }
      placements.push([previous, row]);
      elements.set(row.occurrence, previous);
      return [previous];
    }
    const element = named(new Prototype(graph), row.principal, row.occurrence);
    element.equivalents(
      row.aliases.map((alias) => {
        const Alias = nodeMap.get(nodeType(alias));
        return named(
          new Alias(graph),
          alias,
          `${row.occurrence}:alias:${alias.record}`,
        );
      }),
    );
    if (row.radiusFactor !== undefined) {
      // Canonical B5 supplies the complete radius factor, including generic nodes.
      // The legacy individual list stays empty; it must not scale this a second time.
      element.radius(50 * row.radiusFactor);
    }
    const styles = [...element.attributes()];
    if (row.principal.externalStyle) {
      styles.push("external");
    }
    if (!row.principal.iri && !row.operator) {
      styles.push("anonymous");
    }
    element.attributes(styles);
    attributes.parseClassAttributes(element);
    if (row.additionalOperands?.length) {
      element.indications([
        ...element.indications(),
        "additional operands in details",
      ]);
    }
    position(element, row);
    elements.set(row.occurrence, element);
    dirty.add(element);
    return [element];
  });
  const labelsByEdge = new Map();
  for (const label of drawing.labels) {
    const labels = labelsByEdge.get(label.edge) ?? [];
    labels.push(label);
    labelsByEdge.set(label.edge, labels);
  }
  const properties = [];
  for (const edge of drawing.edges) {
    if (edge.hidden) {
      continue;
    }
    const labels = labelsByEdge.get(edge.occurrence) ?? [];
    const rows = labels.length ? labels : [undefined];
    for (const label of rows) {
      const type =
        edge.kind === "operator-edge"
          ? "setOperatorProperty"
          : edge.kind === "disjoint-edge"
            ? "owl:disjointWith"
            : edge.kind === "subclass-edge"
              ? "rdfs:subClassOf"
              : propertyTypes[label.principal.kind];
      const Prototype = propertyMap.get(type);
      if (!Prototype) {
        throw new TypeError("Unsupported admitted edge drawing kind.");
      }
      const reverse = label?.direction === "reverse";
      const from = elements.get(reverse ? edge.to : edge.from);
      const to = elements.get(reverse ? edge.from : edge.to);
      if (!from || !to) {
        throw new TypeError("Missing admitted drawing endpoint.");
      }
      const id = label?.occurrence ?? edge.occurrence;
      const previous = retainedProperties.get(id);
      // Endpoints and the entire link/label/force aggregate must agree. A
      // surviving string key alone cannot rebind the closures in a Label.
      const property =
        previous?.domain() === from && previous.range() === to
          ? previous
          : new Prototype(graph);
      const placement = label ?? {
        position: {
          x:
            (nodeRows.get(edge.from).position.x +
              nodeRows.get(edge.to).position.x) /
            2,
          y:
            (nodeRows.get(edge.from).position.y +
              nodeRows.get(edge.to).position.y) /
            2,
        },
        pinned: false,
      };
      if (property === previous) {
        if (
          property.pinned() !== placement.pinned ||
          (label &&
            property.labelVisible() !== (!label.hidden && Boolean(label.name)))
        ) {
          dirty.add(property);
        }
        placements.push([property, placement, label]);
      } else {
        property.id(id).domain(from).range(to);
        if (label) {
          property.label(label.name).iri(label.principal?.iri);
          if (label.principal?.externalStyle) {
            property.attributes([...property.attributes(), "external"]);
          }
          attributes.parsePropertyAttributes(property);
          property.labelVisible(!label.hidden && Boolean(label.name));
          property.cardinality(label.cardinality);
          property.equivalents(
            label.aliases.map((alias) => {
              const Alias = propertyMap.get(propertyTypes[alias.kind]);
              return named(
                new Alias(graph),
                alias,
                `${id}:alias:${alias.record}`,
              );
            }),
          );
          property.indications(
            label.characteristics.map((value) => value.replaceAll("-", " ")),
          );
          position(property, label);
        } else {
          // Edge decorations have derived geometry, never independent scene state.
          position(property, placement);
        }
        dirty.add(property);
      }
      // An inverse occurrence has two routed directions, each bound to its own
      // label placement. Legacy inverse pairing would collapse those placements.
      bindings.set(id, {
        occurrence: edge.occurrence,
        ...(label
          ? { label: label.occurrence, direction: label.direction }
          : {}),
        records: [...(label?.records ?? edge.records)],
        positionable: Boolean(label),
      });
      properties.push(property);
    }
  }
  return {
    nodes,
    properties,
    bindings,
    dirty,
    // Preparation never mutates retained primitives. Apply only inside the
    // renderer transaction, preserving the full builder's px/py reset semantics.
    placements,
  };
}
